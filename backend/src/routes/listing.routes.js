import express from "express";
import ActivityLog from "../models/ActivityLog.js";
import Listing from "../models/Listing.js";
import Review from "../models/Review.js";
import User from "../models/User.js";
import { addressSuggestions } from "../seed/seedSource.js";
import { resolveMapboxAddress, searchMapboxAddresses } from "../services/mapboxGeocoding.service.js";
import { canManageDocument, requireAuth } from "../utils/auth.js";
import { locationMetric, nearbyPlaces, serializeListing } from "../utils/geo.js";

const router = express.Router();

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function parseNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function hasText(value, min = 1) {
  return String(value || "").trim().length >= min;
}

const listingOwnerRoles = {
  property: "property-owner",
  service: "service-provider"
};

function sanitizeListingUpdate(body) {
  const allowed = ["title", "category", "price", "size", "facilities", "coverageAreas", "photos", "description", "status"];
  return Object.fromEntries(allowed.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));
}

async function resolveListingAddress(addressId) {
  const seedSuggestion = addressSuggestions.find((item) => item.id === addressId);
  return seedSuggestion || resolveMapboxAddress(addressId);
}

router.get("/address-suggestions", async (req, res, next) => {
  try {
    const query = String(req.query.q || "").trim();
    if (!query) return res.status(400).json({ error: "Address query is required." });
    if (query.length < 3) return res.status(422).json({ error: "Enter at least 3 characters to search addresses." });
    const suggestions = await searchMapboxAddresses(query);
    res.set("Cache-Control", "no-store");
    res.json({ suggestions });
  } catch (error) {
    next(error);
  }
});

async function searchListings(req, res, next) {
  try {
    const {
      area = "",
      type = "all",
      listingType,
      category = "all",
      sort = "distance",
      ownerId,
      includeUnavailable = "false"
    } = req.query;
    const maxPrice = parseNumber(req.query.maxPrice, Number.MAX_SAFE_INTEGER);
    const minPrice = parseNumber(req.query.minPrice, 0);
    const minSize = parseNumber(req.query.minSize, 0);
    const page = Math.max(1, parseNumber(req.query.page, 1));
    const pageSize = Math.max(2, Math.min(12, parseNumber(req.query.pageSize, 6)));
    const selectedType = listingType || type;

    const filter = {
      verificationStatus: "verified",
      price: { $gte: minPrice, $lte: maxPrice }
    };
    if (includeUnavailable !== "true") filter.status = "Available";
    if (ownerId) filter.owner = ownerId;
    if (selectedType !== "all") filter.listingType = selectedType;
    if (category !== "all") filter.category = category;
    if (area) {
      filter.$or = [
        { area: new RegExp(area, "i") },
        { address: new RegExp(area, "i") },
        { coverageAreas: new RegExp(area, "i") }
      ];
    }
    if (minSize > 0) {
      filter.$and = [
        ...(filter.$and || []),
        { $or: [{ listingType: "service" }, { size: { $gte: minSize } }] }
      ];
    }

    const total = await Listing.countDocuments(filter);
    const docs = await Listing.find(filter).populate("owner").lean();
    const enriched = docs.map(serializeListing);
    enriched.sort((a, b) => {
      if (sort === "price") return a.price - b.price;
      if (sort === "rating") return b.rating - a.rating;
      if (sort === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
      return a.distanceKm - b.distanceKm;
    });

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * pageSize;
    const avgPrice = enriched.length
      ? Math.round(enriched.reduce((sum, listing) => sum + Number(listing.price || 0), 0) / enriched.length)
      : 0;
    res.json({
      page: currentPage,
      pageSize,
      total,
      totalPages,
      filters: { area, type: selectedType, category, sort, minPrice, maxPrice, minSize },
      summary: {
        avgPrice,
        propertyCount: enriched.filter((listing) => listing.listingType === "property").length,
        serviceCount: enriched.filter((listing) => listing.listingType === "service").length,
        areas: [...new Set(enriched.map((listing) => listing.area))].slice(0, 5)
      },
      results: enriched.slice(start, start + pageSize)
    });
  } catch (error) {
    next(error);
  }
}

router.get("/listings", searchListings);

router.get("/listings/search", searchListings);

router.post("/listings", requireAuth, async (req, res, next) => {
  try {
    if (!req.body.addressId) return res.status(400).json({ error: "Selected address is required." });
    const suggestion = await resolveListingAddress(req.body.addressId);

    const listingType = req.body.listingType || "property";
    const expectedOwnerRole = listingOwnerRoles[listingType];
    if (!expectedOwnerRole) return res.status(422).json({ error: "Listing type must be property or service." });
    if (req.user.role !== "admin" && req.user.role !== expectedOwnerRole) {
      return res.status(403).json({ error: `Only ${expectedOwnerRole} accounts can create ${listingType} listings.` });
    }

    const price = parseNumber(req.body.price, 0);
    const size = listingType === "service" ? 0 : parseNumber(req.body.size, 0);
    const errors = [];
    if (!hasText(req.body.title, 4)) errors.push("Title must be at least 4 characters.");
    if (!hasText(req.body.category, 2)) errors.push("Category is required.");
    if (price <= 0) errors.push("Price must be greater than zero.");
    if (listingType === "property" && size <= 0) errors.push("Property size must be greater than zero.");
    if (errors.length) return res.status(422).json({ error: "Listing validation failed.", details: errors });

    const ownerId = req.user.role === "admin" ? req.body.ownerId : req.user._id;
    const owner = await User.findById(ownerId);
    if (!owner) return res.status(400).json({ error: "A valid listing owner is required." });
    if (owner.role !== expectedOwnerRole) {
      return res.status(422).json({ error: `${listingType} listings must belong to a ${expectedOwnerRole} account.` });
    }

    const listing = await Listing.create({
      owner: owner._id,
      title: String(req.body.title).trim(),
      listingType,
      category: req.body.category || "Office",
      area: suggestion.area,
      coverageAreas: req.body.coverageAreas || [suggestion.area],
      address: suggestion.label,
      location: { lat: suggestion.lat, lng: suggestion.lng },
      price,
      size,
      facilities: req.body.facilities || [],
      photos: req.body.photos || ["uploaded-photo.jpg"],
      description: req.body.description || "New OfficeKhoj BD listing.",
      status: req.body.status || "Available"
    });
    await ActivityLog.create({
      actor: owner._id,
      action: "listing.created",
      entityType: "Listing",
      entityId: listing._id,
      severity: "success",
      message: `${owner.name} created ${listing.title}.`,
      metadata: { listingType: listing.listingType, category: listing.category, area: listing.area }
    });
    res.status(201).json({ listing: serializeListing(await listing.populate("owner")) });
  } catch (error) {
    next(error);
  }
});

router.get("/listings/:id", async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id).populate("owner").lean();
    if (!listing) return res.status(404).json({ error: "Listing not found." });
    res.json({ listing: serializeListing(listing) });
  } catch (error) {
    next(error);
  }
});

router.put("/listings/:id", requireAuth, async (req, res, next) => {
  try {
    const existing = await Listing.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Listing not found." });
    if (!canManageDocument(req, existing.owner)) {
      return res.status(403).json({ error: "Only the listing owner or an admin can update this listing." });
    }

    const update = sanitizeListingUpdate(req.body);
    if (update.price !== undefined) update.price = parseNumber(update.price, existing.price);
    if (update.size !== undefined) update.size = existing.listingType === "service" ? 0 : parseNumber(update.size, existing.size);
    if (update.status && !["Available", "Busy", "Leased"].includes(update.status)) {
      return res.status(422).json({ error: "Status must be Available, Busy, or Leased." });
    }
    if (req.body.addressId) {
      const suggestion = await resolveListingAddress(req.body.addressId);
      update.area = suggestion.area;
      update.address = suggestion.label;
      update.location = { lat: suggestion.lat, lng: suggestion.lng };
    }

    const listing = await Listing.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).populate("owner");
    res.json({ listing: serializeListing(listing) });
  } catch (error) {
    next(error);
  }
});

router.delete("/listings/:id", requireAuth, async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Listing not found." });
    if (!canManageDocument(req, listing.owner)) {
      return res.status(403).json({ error: "Only the listing owner or an admin can delete this listing." });
    }
    await listing.deleteOne();
    res.json({ listing });
  } catch (error) {
    next(error);
  }
});

router.put("/listings/:id/status", requireAuth, async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Listing not found." });
    if (!canManageDocument(req, listing.owner)) {
      return res.status(403).json({ error: "Only the listing owner or an admin can update listing status." });
    }
    if (!["Available", "Busy", "Leased"].includes(req.body.status)) {
      return res.status(422).json({ error: "Status must be Available, Busy, or Leased." });
    }
    listing.status = req.body.status;
    await listing.save();
    await listing.populate("owner");
    res.json({ listing: serializeListing(listing) });
  } catch (error) {
    next(error);
  }
});

router.get("/listings/:id/location-metric", async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id).lean();
    if (!listing) return res.status(404).json({ error: "Listing not found." });
    res.json({ listingId: listing._id, title: listing.title, ...locationMetric(listing) });
  } catch (error) {
    next(error);
  }
});

router.get("/listings/:id/nearby", async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id).lean();
    if (!listing) return res.status(404).json({ error: "Listing not found." });
    res.json({ nearbyPlaces: nearbyPlaces(listing) });
  } catch (error) {
    next(error);
  }
});

router.get("/listings/:id/setup-suggestions", async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id).lean();
    if (!listing) return res.status(404).json({ error: "Listing not found." });
    const suggestions = await Listing.find({
      listingType: "service",
      status: "Available",
      verificationStatus: "verified",
      coverageAreas: new RegExp(listing.area, "i")
    }).populate("owner").lean();
    res.json({ suggestions: suggestions.map(serializeListing) });
  } catch (error) {
    next(error);
  }
});

router.get("/listings/:id/detail", async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id).populate("owner").lean();
    if (!listing) return res.status(404).json({ error: "Listing not found." });
    const reviews = await Review.find({ listing: req.params.id }).populate("reviewer").sort({ createdAt: -1 }).lean();
    const serialized = serializeListing(listing);
    serialized.reviews = reviews.slice(0, 3);
    const suggestions = await Listing.find({
      listingType: "service",
      status: "Available",
      verificationStatus: "verified",
      coverageAreas: new RegExp(listing.area, "i")
    }).populate("owner").lean();
    res.json({
      listing: serialized,
      nearbyPlaces: nearbyPlaces(listing),
      setupSuggestions: suggestions.map(serializeListing)
    });
  } catch (error) {
    next(error);
  }
});

export default router;
