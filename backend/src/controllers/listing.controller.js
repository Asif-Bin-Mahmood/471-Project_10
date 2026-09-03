import ActivityLog from "../models/ActivityLog.js";
import Listing from "../models/Listing.js";
import Review from "../models/Review.js";
import User from "../models/User.js";
import { addressSuggestions } from "../seed/seedSource.js";
import { getFoursquareNearbyPlaces } from "../services/foursquare.service.js";
import { geocodeArea, lookupAddressById, searchAddressSuggestions } from "../services/nominatim.service.js";
import { canManageDocument } from "../utils/auth.js";
import { haversineKm, locationMetric, nearbyPlaces, serializeListing } from "../utils/geo.js";
import { attachProviderRating } from "../utils/providerRating.js";

// -----------------------------------------------------------------------------
// Listing rules shared by Member 1 and Member 2 features
// -----------------------------------------------------------------------------

const PROPERTY_CATEGORIES = ["Office", "Shop"];
const SERVICE_CATEGORIES = ["Interior", "Interior Design", "ISP", "Electrician", "Vendor"];

const SETUP_CATEGORIES_BY_PROPERTY = {
  Office: ["Interior", "Interior Design", "ISP", "Electrician", "Vendor"],
  Shop: ["Interior", "Interior Design", "Electrician", "ISP", "Vendor"]
};

const OWNER_ROLE_BY_TYPE = {
  property: "property-owner",
  service: "service-provider"
};

const STATUS_BY_TYPE = {
  property: ["Available", "Leased"],
  service: ["Available", "Busy"]
};

const EDITABLE_FIELDS = [
  "title",
  "category",
  "price",
  "size",
  "facilities",
  "coverageAreas",
  "photos",
  "description",
  "status"
];

// -----------------------------------------------------------------------------
// Small utility helpers
// -----------------------------------------------------------------------------

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function optionalNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return numberOr(value, fallback);
}

function positiveInteger(value, fallback, max) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number) || number < 1) return fallback;
  return Math.min(number, max);
}

function commaList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSort(value) {
  const sort = String(value || "distance").toLowerCase();
  if (["price", "price-asc"].includes(sort)) return "price-asc";
  if (["price-desc", "price_high", "price-high"].includes(sort)) return "price-desc";
  if (["rating", "rating-desc"].includes(sort)) return "rating";
  if (sort === "newest") return "newest";
  return "distance";
}

function allowedCategories(listingType) {
  return listingType === "service" ? SERVICE_CATEGORIES : PROPERTY_CATEGORIES;
}

function isValidCategory(listingType, category) {
  return allowedCategories(listingType).includes(String(category || "").trim());
}

function isValidStatus(listingType, status) {
  return (STATUS_BY_TYPE[listingType] || []).includes(status);
}

function pickEditableFields(body) {
  const update = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) update[field] = body[field];
  }
  return update;
}

function requireVerifiedManager(req, res) {
  // Admin can manage listings directly. Property/service owners must be verified.
  if (req.user.role === "admin") return true;

  if (req.user.verificationStatus !== "verified") {
    res.status(403).json({ error: "Your account must be verified before managing listings." });
    return false;
  }

  return true;
}

async function getVerifiedOwnerIds(role = { $in: ["property-owner", "service-provider"] }) {
  return User.distinct("_id", {
    role,
    verificationStatus: "verified",
    status: "active"
  });
}

// -----------------------------------------------------------------------------
// Member 1 - Module 1: location search with Nominatim
// -----------------------------------------------------------------------------

function localAreaFallback(query) {
  const searchText = String(query || "").trim().toLowerCase();
  if (!searchText) return null;

  const match = addressSuggestions.find((item) => {
    const area = item.area.toLowerCase();
    const label = item.label.toLowerCase();
    return area === searchText || label.includes(searchText) || searchText.includes(area);
  });

  if (!match) return null;

  return {
    query,
    displayName: match.label,
    area: match.area,
    lat: match.lat,
    lng: match.lng,
    boundingBox: [],
    source: "local-fallback"
  };
}

async function resolveSearchLocation(area) {
  const query = String(area || "").trim();
  if (!query) return { location: null, warning: "" };

  try {
    const location = await geocodeArea(query);
    if (location) return { location, warning: "" };

    const fallback = localAreaFallback(query);
    return {
      location: fallback,
      warning: fallback
        ? "Nominatim returned no match; a local demo coordinate was used."
        : "Nominatim returned no match for this area."
    };
  } catch (error) {
    const fallback = localAreaFallback(query);
    return {
      location: fallback,
      warning: fallback
        ? "Nominatim was unavailable; a local demo coordinate was used."
        : `Nominatim was unavailable: ${error.message}`
    };
  }
}

function buildLocationFilter(area, searchLocation) {
  const requestedArea = String(area || "").trim();
  const requestedLocality = requestedArea.split(",")[0]?.trim();
  const resolvedArea = String(searchLocation?.area || "").trim();
  const genericDhakaTerms = new Set(["dhaka", "dhaka city", "dhaka district", "dhaka division"]);
  const includeResolvedArea = resolvedArea && (
    !genericDhakaTerms.has(resolvedArea.toLowerCase()) ||
    genericDhakaTerms.has(requestedLocality.toLowerCase())
  );
  const rawTerms = [requestedArea, requestedLocality, includeResolvedArea ? resolvedArea : ""].filter(Boolean);

  // Remove duplicate area names, e.g. "Banani" and "banani".
  const seen = new Set();
  const terms = rawTerms.filter((term) => {
    const key = term.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!terms.length) return null;

  const clauses = [];
  for (const term of terms) {
    const pattern = new RegExp(escapeRegex(term), "i");
    clauses.push({ area: pattern }, { address: pattern }, { coverageAreas: pattern });
  }

  return { $or: clauses };
}

function addDistanceFromSearch(listing, searchLocation) {
  const searchLat = Number(searchLocation?.lat);
  const searchLng = Number(searchLocation?.lng);
  const listingLat = Number(listing?.location?.lat);
  const listingLng = Number(listing?.location?.lng);

  if (![searchLat, searchLng, listingLat, listingLng].every(Number.isFinite)) {
    return listing;
  }

  const distanceKm = haversineKm(searchLat, searchLng, listingLat, listingLng);

  return {
    ...listing,
    searchDistanceKm: Number(distanceKm.toFixed(2)),
    searchDistanceLabel: `${distanceKm.toFixed(2)} km from searched area`
  };
}

// -----------------------------------------------------------------------------
// Member 1 - Module 2: unified category, price and size filters
// -----------------------------------------------------------------------------

function normalizeServiceCategory(category) {
  // Old seed data may use "Interior" while the UI uses "Interior Design".
  if (["Interior", "Interior Design"].includes(category)) {
    return { $in: ["Interior", "Interior Design"] };
  }
  return category;
}

function buildCategoryFilter(selectedType, propertyType, serviceCategory, legacyCategory) {
  let property = propertyType;
  let service = serviceCategory;

  // Keep the old `category` query parameter working for teammate code.
  if (legacyCategory && legacyCategory !== "all" && property === "all" && service === "all") {
    if (PROPERTY_CATEGORIES.includes(legacyCategory)) property = legacyCategory;
    else if (SERVICE_CATEGORIES.includes(legacyCategory)) service = legacyCategory;
    else return { category: legacyCategory };
  }

  const propertyFilter = property === "all"
    ? { listingType: "property" }
    : { listingType: "property", category: property };

  const serviceFilter = service === "all"
    ? { listingType: "service" }
    : { listingType: "service", category: normalizeServiceCategory(service) };

  if (selectedType === "property") return propertyFilter;
  if (selectedType === "service") return serviceFilter;
  return { $or: [propertyFilter, serviceFilter] };
}

function buildSizeFilter(minSize, maxSize) {
  if (minSize === 0 && maxSize === 0) return null;

  const size = {};
  if (minSize > 0) size.$gte = minSize;
  if (maxSize > 0) size.$lte = maxSize;

  // Service listings do not have a meaningful square-foot size, so they stay visible.
  return {
    $or: [
      { listingType: "service" },
      { listingType: "property", size }
    ]
  };
}

function distanceValue(listing) {
  if (Number.isFinite(listing.searchDistanceKm)) return listing.searchDistanceKm;
  if (Number.isFinite(listing.distanceKm)) return listing.distanceKm;
  return Number.POSITIVE_INFINITY;
}

function sortListingResults(listings, sort) {
  listings.sort((a, b) => {
    if (sort === "price-asc") return Number(a.price || 0) - Number(b.price || 0);
    if (sort === "price-desc") return Number(b.price || 0) - Number(a.price || 0);
    if (sort === "rating") return Number(b.rating || 0) - Number(a.rating || 0);
    if (sort === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
    return distanceValue(a) - distanceValue(b);
  });
}

// -----------------------------------------------------------------------------
// Member 2 - Module 1/2: listing management helpers
// -----------------------------------------------------------------------------

async function resolveListingAddress(addressId) {
  const localSuggestion = addressSuggestions.find((item) => item.id === addressId);
  return localSuggestion || lookupAddressById(addressId);
}

function validateCreateRequest(body, listingType) {
  const errors = [];
  const price = numberOr(body.price, 0);
  const size = listingType === "service" ? 0 : numberOr(body.size, 0);
  const category = String(body.category || "").trim();
  const status = body.status || "Available";
  const coverageAreas = commaList(body.coverageAreas);

  if (String(body.title || "").trim().length < 4) {
    errors.push("Title must be at least 4 characters.");
  }
  if (!isValidCategory(listingType, category)) {
    errors.push(`Category must be one of: ${allowedCategories(listingType).join(", ")}.`);
  }
  if (price <= 0) errors.push("Price must be greater than zero.");
  if (listingType === "property" && size <= 0) {
    errors.push("Property size must be greater than zero.");
  }
  if (!isValidStatus(listingType, status)) {
    errors.push(`Invalid ${listingType} status.`);
  }
  if (listingType === "service" && coverageAreas.length === 0) {
    errors.push("At least one coverage area is required for a service listing.");
  }

  return { errors, price, size, category, status, coverageAreas };
}

function validateListingUpdate(body, existingListing) {
  const update = pickEditableFields(body);

  if (update.title !== undefined) {
    update.title = String(update.title).trim();
    if (update.title.length < 4) return { error: "Title must be at least 4 characters." };
  }

  if (update.category !== undefined) {
    update.category = String(update.category).trim();
    if (!isValidCategory(existingListing.listingType, update.category)) {
      return { error: `Category must be one of: ${allowedCategories(existingListing.listingType).join(", ")}.` };
    }
  }

  if (update.price !== undefined) {
    update.price = numberOr(update.price, existingListing.price);
    if (update.price <= 0) return { error: "Price must be greater than zero." };
  }

  if (update.size !== undefined) {
    update.size = existingListing.listingType === "service"
      ? 0
      : numberOr(update.size, existingListing.size);

    if (existingListing.listingType === "property" && update.size <= 0) {
      return { error: "Property size must be greater than zero." };
    }
  }

  if (update.facilities !== undefined) update.facilities = commaList(update.facilities);
  if (update.photos !== undefined) update.photos = commaList(update.photos);
  if (update.description !== undefined) update.description = String(update.description || "").trim();

  if (update.coverageAreas !== undefined) {
    update.coverageAreas = commaList(update.coverageAreas);
    if (existingListing.listingType === "service" && update.coverageAreas.length === 0) {
      return { error: "At least one coverage area is required for a service listing." };
    }
  }

  if (update.status !== undefined && !isValidStatus(existingListing.listingType, update.status)) {
    return { error: `Invalid ${existingListing.listingType} status.` };
  }

  return { update };
}

// -----------------------------------------------------------------------------
// Member 2 - Module 3: Foursquare nearby places + demo fallback
// -----------------------------------------------------------------------------

async function loadNearbyPlaces(listing) {
  try {
    const places = await getFoursquareNearbyPlaces(listing);
    return {
      nearbyPlaces: places,
      nearbySource: "foursquare",
      nearbyWarning: null
    };
  } catch (error) {
    return {
      nearbyPlaces: nearbyPlaces(listing),
      nearbySource: "demo-fallback",
      nearbyWarning: error?.message || "Foursquare nearby-place data is unavailable."
    };
  }
}

// Member 3 - Module 3: deterministic setup matching from stored category and coverage data.
async function findSetupServicesForListing(propertyListing) {
  if (propertyListing?.listingType !== "property") return [];

  const area = String(propertyListing.area || "").trim();
  const categories = SETUP_CATEGORIES_BY_PROPERTY[propertyListing.category] || SERVICE_CATEGORIES;
  if (!area || !categories.length) return [];

  const coveragePattern = new RegExp(escapeRegex(area), "i");
  const verifiedOwners = await User.find({
    role: "service-provider",
    verificationStatus: "verified",
    status: "active"
  })
    .select("_id coverageAreas")
    .lean();

  const verifiedOwnerIds = verifiedOwners.map((owner) => owner._id);
  const ownerCoverageIds = verifiedOwners
    .filter((owner) => (owner.coverageAreas || []).some((coverageArea) => coveragePattern.test(coverageArea)))
    .map((owner) => owner._id);

  return Listing.find({
    listingType: "service",
    owner: { $in: verifiedOwnerIds },
    category: { $in: categories },
    status: "Available",
    verificationStatus: "verified",
    $or: [
      { coverageAreas: coveragePattern },
      { owner: { $in: ownerCoverageIds } }
    ]
  })
    .populate("owner", "name role verificationStatus status coverageAreas")
    .sort({ rating: -1, reviewCount: -1, createdAt: -1 })
    .lean();
}

// -----------------------------------------------------------------------------
// Public location/address/search endpoints
// -----------------------------------------------------------------------------

export async function getAddressSuggestions(req, res, next) {
  try {
    const query = String(req.query.q || "").trim();

    if (!query) return res.status(400).json({ error: "Address query is required." });
    if (query.length < 3) {
      return res.status(422).json({ error: "Enter at least 3 characters to search addresses." });
    }

    const suggestions = await searchAddressSuggestions(query);
    res.set("Cache-Control", "no-store");
    res.json({ suggestions });
  } catch (error) {
    next(error);
  }
}

export async function geocodeLocation(req, res, next) {
  try {
    const query = String(req.query.q || "").trim();

    if (query.length < 2) {
      return res.status(422).json({ error: "Enter at least 2 characters to geocode an area." });
    }

    const { location, warning } = await resolveSearchLocation(query);
    if (!location) {
      return res.status(404).json({ error: "No matching location was found.", warning });
    }

    res.set("Cache-Control", "public, max-age=600");
    res.json({ location, warning });
  } catch (error) {
    next(error);
  }
}

export async function searchListings(req, res, next) {
  try {
    // 1) Read and normalize query parameters.
    const area = String(req.query.area || "").trim();
    const requestedType = req.query.listingType || req.query.type || "all";
    const selectedType = ["property", "service"].includes(requestedType) ? requestedType : "all";
    const selectedPropertyType = PROPERTY_CATEGORIES.includes(req.query.propertyType)
      ? req.query.propertyType
      : "all";
    const selectedServiceCategory = SERVICE_CATEGORIES.includes(req.query.serviceCategory)
      ? req.query.serviceCategory
      : "all";
    const selectedSort = normalizeSort(req.query.sort);

    const minPrice = Math.max(0, optionalNumber(req.query.minPrice, 0));
    const maxPrice = Math.max(0, optionalNumber(req.query.maxPrice, Number.MAX_SAFE_INTEGER));
    const minSize = Math.max(0, optionalNumber(req.query.minSize, 0));
    const maxSize = Math.max(0, optionalNumber(req.query.maxSize, 0));
    const page = positiveInteger(req.query.page, 1, Number.MAX_SAFE_INTEGER);
    const pageSize = positiveInteger(req.query.pageSize, 6, 50);

    if (maxPrice < minPrice) {
      return res.status(422).json({ error: "Maximum price cannot be lower than minimum price." });
    }
    if (maxSize > 0 && maxSize < minSize) {
      return res.status(422).json({ error: "Maximum size cannot be lower than minimum size." });
    }

    // 2) Resolve the searched area and build MongoDB filters.
    const { location: searchLocation, warning: geocodeWarning } = await resolveSearchLocation(area);
    const verifiedOwners = await getVerifiedOwnerIds();

    let ownerFilter = { $in: verifiedOwners };
    if (req.query.ownerId) {
      const allowedOwner = verifiedOwners.some((id) => String(id) === String(req.query.ownerId));
      ownerFilter = allowedOwner ? req.query.ownerId : { $in: [] };
    }

    const mongoFilter = {
      verificationStatus: "verified",
      owner: ownerFilter,
      price: { $gte: minPrice, $lte: maxPrice }
    };

    if (req.query.includeUnavailable !== "true") {
      mongoFilter.status = "Available";
    }

    const conditions = [];
    const locationFilter = buildLocationFilter(area, searchLocation);
    if (locationFilter) conditions.push(locationFilter);

    conditions.push(
      buildCategoryFilter(
        selectedType,
        selectedPropertyType,
        selectedServiceCategory,
        req.query.category || "all"
      )
    );

    const sizeFilter = buildSizeFilter(minSize, maxSize);
    if (sizeFilter) conditions.push(sizeFilter);
    if (conditions.length) mongoFilter.$and = conditions;

    // 3) Load results, add distance information and sort them.
    const docs = await Listing.find(mongoFilter).populate("owner").lean();
    const results = docs.map((doc) => addDistanceFromSearch(serializeListing(doc), searchLocation));
    sortListingResults(results, selectedSort);

    // 4) Apply pagination after sorting.
    const total = results.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * pageSize;
    const averagePrice = total
      ? Math.round(results.reduce((sum, listing) => sum + Number(listing.price || 0), 0) / total)
      : 0;

    res.json({
      page: currentPage,
      pageSize,
      total,
      totalPages,
      searchLocation,
      geocodeWarning,
      filters: {
        area,
        type: selectedType,
        propertyType: selectedPropertyType,
        serviceCategory: selectedServiceCategory,
        sort: selectedSort,
        minPrice,
        maxPrice,
        minSize,
        maxSize,
        includeUnavailable: req.query.includeUnavailable === "true"
      },
      summary: {
        avgPrice: averagePrice,
        propertyCount: results.filter((listing) => listing.listingType === "property").length,
        serviceCount: results.filter((listing) => listing.listingType === "service").length,
        areas: [...new Set(results.map((listing) => listing.area))].slice(0, 5)
      },
      results: results.slice(start, start + pageSize)
    });
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------------------------------------
// Listing CRUD endpoints
// -----------------------------------------------------------------------------

export async function getMyListings(req, res, next) {
  try {
    const selectedType = ["property", "service"].includes(req.query.type)
      ? req.query.type
      : "all";

    const ownerId = req.user.role === "admin" && req.query.ownerId
      ? req.query.ownerId
      : req.user._id;

    const filter = { owner: ownerId };
    if (selectedType !== "all") filter.listingType = selectedType;

    const docs = await Listing.find(filter)
      .populate("owner")
      .sort({ createdAt: -1 })
      .lean();

    const results = docs.map(serializeListing);

    res.json({
      total: results.length,
      results,
      summary: {
        propertyCount: results.filter((listing) => listing.listingType === "property").length,
        serviceCount: results.filter((listing) => listing.listingType === "service").length
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function createListing(req, res, next) {
  try {
    if (!requireVerifiedManager(req, res)) return;
    if (!req.body.addressId) {
      return res.status(400).json({ error: "Selected address is required." });
    }

    const listingType = req.body.listingType || "property";
    const expectedOwnerRole = OWNER_ROLE_BY_TYPE[listingType];

    if (!expectedOwnerRole) {
      return res.status(422).json({ error: "Listing type must be property or service." });
    }
    if (req.user.role !== "admin" && req.user.role !== expectedOwnerRole) {
      return res.status(403).json({
        error: `Only ${expectedOwnerRole} accounts can create ${listingType} listings.`
      });
    }

    const validation = validateCreateRequest(req.body, listingType);
    if (validation.errors.length) {
      return res.status(422).json({
        error: "Listing validation failed.",
        details: validation.errors
      });
    }

    const ownerId = req.user.role === "admin" ? req.body.ownerId : req.user._id;
    const owner = await User.findById(ownerId);

    if (!owner) return res.status(400).json({ error: "A valid listing owner is required." });
    if (owner.role !== expectedOwnerRole) {
      return res.status(422).json({
        error: `${listingType} listings must belong to a ${expectedOwnerRole} account.`
      });
    }
    if (owner.verificationStatus !== "verified" || owner.status !== "active") {
      return res.status(403).json({
        error: "The listing owner must have an active verified account."
      });
    }

    const address = await resolveListingAddress(req.body.addressId);
    const photos = commaList(req.body.photos);

    const listing = await Listing.create({
      owner: owner._id,
      title: String(req.body.title).trim(),
      listingType,
      category: validation.category,
      area: address.area,
      coverageAreas: validation.coverageAreas.length ? validation.coverageAreas : [address.area],
      address: address.label,
      location: { lat: address.lat, lng: address.lng },
      price: validation.price,
      size: validation.size,
      facilities: commaList(req.body.facilities),
      photos: photos.length ? photos : ["uploaded-photo.jpg"],
      description: String(req.body.description || "").trim() || "New OfficeKhoj BD listing.",
      status: validation.status,
      verificationStatus: "verified"
    });

    await ActivityLog.create({
      actor: owner._id,
      action: "listing.created",
      entityType: "Listing",
      entityId: listing._id,
      severity: "success",
      message: `${owner.name} created ${listing.title}.`,
      metadata: {
        listingType: listing.listingType,
        category: listing.category,
        area: listing.area
      }
    });

    await listing.populate("owner");
    res.status(201).json({ listing: serializeListing(listing) });
  } catch (error) {
    next(error);
  }
}

export async function getListing(req, res, next) {
  try {
    const listing = await Listing.findById(req.params.id).populate("owner").lean();
    if (!listing) return res.status(404).json({ error: "Listing not found." });
    res.json({ listing: serializeListing(listing) });
  } catch (error) {
    next(error);
  }
}

export async function updateListing(req, res, next) {
  try {
    if (!requireVerifiedManager(req, res)) return;

    const existing = await Listing.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Listing not found." });

    if (!canManageDocument(req, existing.owner)) {
      return res.status(403).json({
        error: "Only the listing owner or an admin can update this listing."
      });
    }

    const { update, error } = validateListingUpdate(req.body, existing);
    if (error) return res.status(422).json({ error });

    if (req.body.addressId) {
      const address = await resolveListingAddress(req.body.addressId);
      update.area = address.area;
      update.address = address.label;
      update.location = { lat: address.lat, lng: address.lng };
    }

    const listing = await Listing.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true
    }).populate("owner");

    res.json({ listing: serializeListing(listing) });
  } catch (error) {
    next(error);
  }
}

export async function deleteListing(req, res, next) {
  try {
    if (!requireVerifiedManager(req, res)) return;

    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Listing not found." });

    if (!canManageDocument(req, listing.owner)) {
      return res.status(403).json({
        error: "Only the listing owner or an admin can delete this listing."
      });
    }

    await listing.deleteOne();
    res.json({ listing });
  } catch (error) {
    next(error);
  }
}

export async function updateListingStatus(req, res, next) {
  try {
    if (!requireVerifiedManager(req, res)) return;

    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Listing not found." });

    if (!canManageDocument(req, listing.owner)) {
      return res.status(403).json({
        error: "Only the listing owner or an admin can update listing status."
      });
    }

    if (!isValidStatus(listing.listingType, req.body.status)) {
      return res.status(422).json({ error: `Invalid ${listing.listingType} status.` });
    }

    listing.status = req.body.status;
    await listing.save();
    await listing.populate("owner");

    res.json({ listing: serializeListing(listing) });
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------------------------------------
// Detail/nearby/setup endpoints
// -----------------------------------------------------------------------------

export async function getLocationMetric(req, res, next) {
  try {
    const listing = await Listing.findById(req.params.id).lean();
    if (!listing) return res.status(404).json({ error: "Listing not found." });

    res.json({
      listingId: listing._id,
      title: listing.title,
      ...locationMetric(listing)
    });
  } catch (error) {
    next(error);
  }
}

export async function getNearbyPlaces(req, res, next) {
  try {
    const listing = await Listing.findById(req.params.id).lean();
    if (!listing) return res.status(404).json({ error: "Listing not found." });

    res.json(await loadNearbyPlaces(listing));
  } catch (error) {
    next(error);
  }
}

export async function getSetupSuggestions(req, res, next) {
  try {
    const listing = await Listing.findById(req.params.id).lean();
    if (!listing) return res.status(404).json({ error: "Listing not found." });

    const suggestions = await findSetupServicesForListing(listing);
    res.json({ suggestions: suggestions.map(serializeListing) });
  } catch (error) {
    next(error);
  }
}

export async function getListingDetail(req, res, next) {
  try {
    const listing = await Listing.findById(req.params.id).populate("owner").lean();
    if (!listing) return res.status(404).json({ error: "Listing not found." });

    const reviews = await Review.find({ listing: req.params.id })
      .populate("reviewer", "name role")
      .sort({ createdAt: -1 })
      .lean();

    const serializedListing = serializeListing(listing);
    serializedListing.owner = await attachProviderRating(serializedListing.owner);
    serializedListing.reviews = reviews.slice(0, 3);

    const suggestions = await findSetupServicesForListing(listing);
    const nearby = await loadNearbyPlaces(listing);

    res.json({
      listing: serializedListing,
      ...nearby,
      setupSuggestions: suggestions.map(serializeListing)
    });
  } catch (error) {
    next(error);
  }
}
