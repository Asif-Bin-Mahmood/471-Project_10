const nowIso = () => new Date().toISOString();

let sequence = 1000;

function nextId(prefix) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function numberOrDefault(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function publicUser(user) {
  if (!user) return null;
  const { password, token, ...safeUser } = user;
  return safeUser;
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const radiusKm = 6371;
  const toRad = (degree) => (degree * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(h));
}

let users = [
  {
    id: "user-001",
    name: "M A OBAEED",
    email: "asifnzs118+officekhoj.business@gmail.com",
    phone: "01700001382",
    password: "demo123",
    token: "token-business-owner",
    role: "business-owner",
    status: "active",
    verificationStatus: "verified",
    businessType: "Startup Office",
    preferredArea: "Banani",
    budgetMin: 50000,
    budgetMax: 100000,
    minSize: 500,
    serviceNeed: "Interior + ISP setup",
    savedListingIds: ["listing-001", "listing-003"]
  },
  {
    id: "user-002",
    name: "Nusrat Property Holdings",
    email: "asifnzs118+officekhoj.property@gmail.com",
    phone: "01711001100",
    password: "demo123",
    token: "token-property-owner",
    role: "property-owner",
    status: "active",
    verificationStatus: "verified",
    nid: "NID-PO-4421",
    tradeLicense: "TL-PO-2026-11",
    savedListingIds: []
  },
  {
    id: "user-003",
    name: "FitOut Studio BD",
    email: "asifnzs118+officekhoj.service@gmail.com",
    phone: "01722002200",
    password: "demo123",
    token: "token-service-provider",
    role: "service-provider",
    status: "active",
    verificationStatus: "verified",
    nid: "NID-SP-5532",
    tradeLicense: "TL-SP-2026-31",
    coverageAreas: ["Banani", "Gulshan", "Mohakhali"],
    savedListingIds: []
  },
  {
    id: "user-004",
    name: "OfficeKhoj Admin",
    email: "asifnzs118+officekhoj.admin@gmail.com",
    phone: "01733003300",
    password: "admin123",
    token: "token-admin",
    role: "admin",
    status: "active",
    verificationStatus: "verified",
    savedListingIds: []
  },
  {
    id: "user-005",
    name: "Spark Electrical Team",
    email: "electric@officekhoj.bd",
    phone: "01744004400",
    password: "demo123",
    token: "token-electric",
    role: "service-provider",
    status: "active",
    verificationStatus: "pending",
    nid: "NID-SP-7744",
    tradeLicense: "TL-SP-2026-55",
    coverageAreas: ["Dhanmondi", "Banani"],
    savedListingIds: []
  }
];

const addressSuggestions = [
  { id: "addr-banani-11", label: "Road 11, Banani, Dhaka", area: "Banani", lat: 23.7939, lng: 90.4054 },
  { id: "addr-banani-chairmanbari", label: "Chairman Bari Road, Banani, Dhaka", area: "Banani", lat: 23.7895, lng: 90.4006 },
  { id: "addr-gulshan-1", label: "Gulshan 1 Circle, Dhaka", area: "Gulshan", lat: 23.7806, lng: 90.4169 },
  { id: "addr-gulshan-avenue", label: "Gulshan Avenue, Dhaka", area: "Gulshan", lat: 23.7898, lng: 90.4193 },
  { id: "addr-motijheel", label: "Motijheel Commercial Area, Dhaka", area: "Motijheel", lat: 23.7337, lng: 90.4175 },
  { id: "addr-dhanmondi-27", label: "Dhanmondi 27, Dhaka", area: "Dhanmondi", lat: 23.7550, lng: 90.3751 },
  { id: "addr-uttara-sector-7", label: "Uttara Sector 7, Dhaka", area: "Uttara", lat: 23.8759, lng: 90.3992 }
];

const landmarks = [
  { name: "Banani 11", lat: 23.7942, lng: 90.4059 },
  { name: "Gulshan 1 Circle", lat: 23.7805, lng: 90.4169 },
  { name: "Kamal Ataturk Avenue", lat: 23.7932, lng: 90.4030 },
  { name: "Motijheel Road", lat: 23.7338, lng: 90.4177 },
  { name: "Dhanmondi 27", lat: 23.7552, lng: 90.3751 },
  { name: "Uttara Sector 7", lat: 23.8758, lng: 90.3994 }
];

let listings = [
  {
    id: "listing-001",
    ownerId: "user-002",
    title: "Roadside Retail Shop",
    listingType: "property",
    category: "Shop",
    area: "Banani",
    address: "Road 11, Banani, Dhaka",
    lat: 23.7940,
    lng: 90.4056,
    price: 90000,
    size: 650,
    facilities: ["Glass frontage", "Washroom", "Road access"],
    photos: ["retail-front.jpg", "retail-floor.jpg", "nearby-road.jpg"],
    status: "Available",
    verificationStatus: "verified",
    rating: 4.7,
    reviewCount: 18,
    imageTone: "retail",
    description: "Compact roadside retail space with glass frontage and high foot traffic."
  },
  {
    id: "listing-002",
    ownerId: "user-003",
    title: "Interior Fit-Out Package",
    listingType: "service",
    category: "Interior",
    area: "Gulshan",
    coverageAreas: ["Banani", "Gulshan", "Mohakhali"],
    address: "Gulshan 1 Circle, Dhaka",
    lat: 23.7806,
    lng: 90.4169,
    price: 45000,
    size: 0,
    facilities: ["Layout planning", "Furniture sourcing", "Lighting plan"],
    photos: ["portfolio-1.jpg", "portfolio-2.jpg", "portfolio-3.jpg"],
    status: "Available",
    verificationStatus: "verified",
    rating: 4.6,
    reviewCount: 18,
    imageTone: "interior",
    description: "Workspace planning, false ceiling, wall treatment, furniture sourcing, and setup supervision."
  },
  {
    id: "listing-003",
    ownerId: "user-003",
    title: "Business Internet Setup",
    listingType: "service",
    category: "ISP",
    area: "Banani",
    coverageAreas: ["Banani", "Gulshan", "Uttara"],
    address: "Chairman Bari Road, Banani, Dhaka",
    lat: 23.7898,
    lng: 90.4010,
    price: 12000,
    size: 0,
    facilities: ["Router placement", "Cabling", "Business support"],
    photos: ["isp-rack.jpg", "isp-router.jpg"],
    status: "Available",
    verificationStatus: "verified",
    rating: 4.8,
    reviewCount: 26,
    imageTone: "isp",
    description: "Office internet setup with router placement, cabling, and business support."
  },
  {
    id: "listing-004",
    ownerId: "user-002",
    title: "Small Office Floor",
    listingType: "property",
    category: "Office",
    area: "Gulshan",
    address: "Gulshan Avenue, Dhaka",
    lat: 23.7898,
    lng: 90.4193,
    price: 135000,
    size: 1050,
    facilities: ["Lift", "Generator", "Parking"],
    photos: ["office-floor.jpg", "office-window.jpg"],
    status: "Available",
    verificationStatus: "verified",
    rating: 4.3,
    reviewCount: 9,
    imageTone: "office",
    description: "Ready commercial office floor suitable for a compact team or agency."
  },
  {
    id: "listing-005",
    ownerId: "user-005",
    title: "Electrical Setup Team",
    listingType: "service",
    category: "Electrician",
    area: "Dhanmondi",
    coverageAreas: ["Dhanmondi", "Banani"],
    address: "Dhanmondi 27, Dhaka",
    lat: 23.7550,
    lng: 90.3751,
    price: 18000,
    size: 0,
    facilities: ["Wiring", "Lighting setup", "Maintenance"],
    photos: ["electric-panel.jpg", "electric-team.jpg"],
    status: "Busy",
    verificationStatus: "pending",
    rating: 4.1,
    reviewCount: 12,
    imageTone: "electric",
    description: "Commercial wiring, lighting setup, and maintenance support."
  },
  {
    id: "listing-006",
    ownerId: "user-002",
    title: "Motijheel Office Unit",
    listingType: "property",
    category: "Office",
    area: "Motijheel",
    address: "Motijheel Commercial Area, Dhaka",
    lat: 23.7337,
    lng: 90.4175,
    price: 78000,
    size: 720,
    facilities: ["Near bank", "Public transport", "Open floor"],
    photos: ["motijheel-office.jpg"],
    status: "Available",
    verificationStatus: "verified",
    rating: 4.2,
    reviewCount: 11,
    imageTone: "office",
    description: "Budget-friendly office unit near banks, transport, and commercial services."
  }
];

let conversations = [
  {
    id: "conv001",
    listingId: "listing-001",
    participantIds: ["user-001", "user-002"],
    subject: "Roadside Retail Shop inquiry",
    updatedAt: "2026-07-18T10:30:00.000Z"
  },
  {
    id: "conv002",
    listingId: "listing-002",
    participantIds: ["user-001", "user-003"],
    subject: "Interior fit-out quotation",
    updatedAt: "2026-07-18T11:15:00.000Z"
  }
];

let messages = [
  {
    id: "msg001",
    conversationId: "conv001",
    senderId: "user-001",
    body: "Is the Banani shop available for a weekend visit?",
    readBy: ["user-001", "user-002"],
    createdAt: "2026-07-18T10:20:00.000Z"
  },
  {
    id: "msg002",
    conversationId: "conv001",
    senderId: "user-002",
    body: "Yes, Saturday 4 PM is open. I can confirm the visit.",
    readBy: ["user-002"],
    createdAt: "2026-07-18T10:30:00.000Z"
  },
  {
    id: "msg003",
    conversationId: "conv002",
    senderId: "user-003",
    body: "We can cover space planning, false ceiling, and ISP coordination.",
    readBy: ["user-003"],
    createdAt: "2026-07-18T11:15:00.000Z"
  }
];

let notifications = [
  {
    id: "notif001",
    userId: "user-001",
    type: "booking",
    title: "Visit request accepted",
    message: "Roadside Retail Shop visit is confirmed for Saturday at 4 PM.",
    read: false,
    channel: "email",
    createdAt: "2026-07-18T12:00:00.000Z"
  },
  {
    id: "notif002",
    userId: "user-002",
    type: "inquiry",
    title: "New property inquiry",
    message: "M A OBAEED asked about Roadside Retail Shop.",
    read: false,
    channel: "email",
    createdAt: "2026-07-18T10:21:00.000Z"
  },
  {
    id: "notif003",
    userId: "user-001",
    type: "review",
    title: "Review submitted",
    message: "Your review was saved successfully.",
    read: true,
    channel: "email",
    createdAt: "2026-07-17T15:30:00.000Z"
  }
];

let emailLogs = [
  {
    id: "email001",
    to: "asifnzs118+officekhoj.business@gmail.com",
    event: "booking-confirmation",
    subject: "OfficeKhoj BD booking confirmation",
    status: "queued",
    provider: "In-app notifications",
    createdAt: "2026-07-18T12:00:00.000Z"
  }
];

let bookings = [
  {
    id: "booking001",
    listingId: "listing-001",
    requesterId: "user-001",
    receiverId: "user-002",
    requestType: "visit",
    proposedAt: "2026-07-20T16:00:00.000Z",
    status: "accepted",
    notes: "Weekend visit for shop inspection.",
    history: [
      { status: "requested", at: "2026-07-18T09:00:00.000Z", by: "user-001" },
      { status: "accepted", at: "2026-07-18T12:00:00.000Z", by: "user-002" }
    ]
  }
];

let reviews = [
  {
    id: "review-001",
    listingId: "listing-002",
    reviewerId: "user-001",
    author: "Sample Business Owner",
    rating: 5,
    comment: "Clear pricing and fast planning support for the office setup.",
    createdAt: "2026-07-12T10:30:00.000Z"
  },
  {
    id: "review-002",
    listingId: "listing-001",
    reviewerId: "user-001",
    author: "Sample Business Owner",
    rating: 4,
    comment: "Good location and easy owner communication.",
    createdAt: "2026-07-13T12:10:00.000Z"
  }
];

let reports = [
  {
    id: "report001",
    targetType: "listing",
    targetId: "listing-005",
    reason: "Provider verification pending but listing was visible.",
    status: "open",
    createdAt: "2026-07-18T08:20:00.000Z"
  }
];

const nearbySeed = {
  Bank: ["BRAC Bank Booth", "Dutch-Bangla ATM", "City Bank Branch"],
  Restaurant: ["Lunch Box Cafe", "Kacchi Corner", "Coffee Yard"],
  Hospital: ["Banani Clinic", "Gulshan Health Point", "Central Hospital Desk"],
  Transport: ["Bus Stop", "Ride-share Point", "CNG Stand"]
};

function getLocationMetric(listing) {
  const nearest = landmarks
    .map((landmark) => ({
      ...landmark,
      distanceKm: haversineKm(listing.lat, listing.lng, landmark.lat, landmark.lng)
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];

  return {
    distanceKm: Number(nearest.distanceKm.toFixed(2)),
    metricLabel: `${nearest.distanceKm.toFixed(2)} km to ${nearest.name}`
  };
}

function enrichListing(listing) {
  const owner = users.find((item) => item.id === listing.ownerId);
  return {
    ...listing,
    owner: publicUser(owner),
    ...getLocationMetric(listing),
    reviews: getReviews(listing.id).slice(0, 3)
  };
}

function addNotification(userId, type, title, message, channel = "in-app") {
  const notification = {
    id: nextId("notif"),
    userId,
    type,
    title,
    message,
    read: false,
    channel,
    createdAt: nowIso()
  };
  notifications.unshift(notification);
  return notification;
}

function addEmailLog(to, event, subject) {
  const log = {
    id: nextId("email"),
    to,
    event,
    subject,
    status: "queued",
    provider: "In-app notifications",
    createdAt: nowIso()
  };
  emailLogs.unshift(log);
  return log;
}

function getUserById(id) {
  return users.find((user) => user.id === id);
}

function getDefaultUserId(role = "business-owner") {
  return (users.find((user) => user.role === role) || users[0]).id;
}

function registerUser(payload) {
  const email = normalize(payload.email);
  if (!payload.name || !email || !payload.phone || !payload.password) {
    const error = new Error("Name, email, phone, and password are required.");
    error.status = 400;
    throw error;
  }
  if (users.some((user) => normalize(user.email) === email)) {
    const error = new Error("This email is already registered.");
    error.status = 409;
    throw error;
  }

  const role = payload.role || "business-owner";
  const user = {
    id: nextId("user"),
    name: String(payload.name).trim(),
    email,
    phone: String(payload.phone).trim(),
    password: String(payload.password),
    token: `token-${Date.now()}`,
    role,
    status: "active",
    verificationStatus: role === "business-owner" ? "verified" : "pending",
    nid: payload.nid || "",
    tradeLicense: payload.tradeLicense || "",
    coverageAreas: asArray(payload.coverageAreas),
    savedListingIds: []
  };
  users.push(user);
  addNotification("user-004", "verification", "New verification request", `${user.name} submitted a ${role} account.`);
  return { user: publicUser(user), token: user.token };
}

function loginUser(payload) {
  const email = normalize(payload.email);
  const user = users.find((item) => normalize(item.email) === email && item.password === payload.password);
  if (!user) {
    const error = new Error("Invalid email or password.");
    error.status = 401;
    throw error;
  }
  return { user: publicUser(user), token: user.token };
}

function getProfile(userId = "user-001") {
  return publicUser(getUserById(userId) || getUserById("user-001"));
}

function updateProfile(payload, userId = "user-001") {
  const user = getUserById(payload.userId || userId) || getUserById("user-001");
  user.businessType = String(payload.businessType || user.businessType || "").trim();
  user.preferredArea = String(payload.preferredArea || user.preferredArea || "").trim();
  user.budgetMin = numberOrDefault(payload.budgetMin, user.budgetMin || 0);
  user.budgetMax = numberOrDefault(payload.budgetMax, user.budgetMax || 0);
  user.minSize = numberOrDefault(payload.minSize, user.minSize || 0);
  user.serviceNeed = String(payload.serviceNeed || user.serviceNeed || "").trim();
  return publicUser(user);
}

function listAddressSuggestions(query) {
  const normalizedQuery = normalize(query);
  return addressSuggestions
    .filter((suggestion) => {
      if (!normalizedQuery) return true;
      return normalize(suggestion.label).includes(normalizedQuery) || normalize(suggestion.area).includes(normalizedQuery);
    })
    .slice(0, 6);
}

function createListing(payload) {
  const suggestion = addressSuggestions.find((item) => item.id === payload.addressId);
  const title = String(payload.title || "").trim();
  const listingType = String(payload.listingType || "property").trim();
  const category = String(payload.category || "Office").trim();
  const price = numberOrDefault(payload.price, 0);
  const size = numberOrDefault(payload.size, 0);
  const ownerId = payload.ownerId || (listingType === "service" ? "user-003" : "user-002");

  if (!title || !suggestion || price <= 0) {
    const error = new Error("Title, selected address, and positive price are required.");
    error.status = 400;
    throw error;
  }

  const listing = {
    id: nextId("listing"),
    ownerId,
    title,
    listingType,
    category,
    area: suggestion.area,
    coverageAreas: asArray(payload.coverageAreas || suggestion.area),
    address: suggestion.label,
    lat: suggestion.lat,
    lng: suggestion.lng,
    price,
    size: listingType === "service" ? 0 : size,
    facilities: asArray(payload.facilities || payload.portfolio || "New listing"),
    photos: asArray(payload.photos || "uploaded-photo.jpg"),
    status: payload.status || "Available",
    verificationStatus: "verified",
    rating: 0,
    reviewCount: 0,
    imageTone: listingType === "service" ? "service" : "office",
    description: String(payload.description || "").trim() || "Newly created OfficeKhoj BD listing.",
    createdAt: nowIso()
  };

  listings.unshift(listing);
  addNotification(ownerId, "listing", "Listing saved", `${title} is now saved on OfficeKhoj BD.`);
  return enrichListing(listing);
}

function updateListing(id, payload) {
  const listing = listings.find((item) => item.id === id);
  if (!listing) {
    const error = new Error("Listing not found.");
    error.status = 404;
    throw error;
  }

  Object.assign(listing, {
    title: payload.title === undefined ? listing.title : String(payload.title).trim(),
    category: payload.category === undefined ? listing.category : String(payload.category).trim(),
    price: payload.price === undefined ? listing.price : numberOrDefault(payload.price, listing.price),
    size: payload.size === undefined ? listing.size : numberOrDefault(payload.size, listing.size),
    status: payload.status || listing.status,
    facilities: payload.facilities === undefined ? listing.facilities : asArray(payload.facilities),
    coverageAreas: payload.coverageAreas === undefined ? listing.coverageAreas : asArray(payload.coverageAreas),
    description: payload.description === undefined ? listing.description : String(payload.description).trim()
  });
  return enrichListing(listing);
}

function deleteListing(id) {
  const index = listings.findIndex((item) => item.id === id);
  if (index === -1) {
    const error = new Error("Listing not found.");
    error.status = 404;
    throw error;
  }
  const [removed] = listings.splice(index, 1);
  return enrichListing(removed);
}

function updateListingStatus(id, status) {
  return updateListing(id, { status });
}

function getListings(searchParams = new URLSearchParams()) {
  const area = normalize(searchParams.get("area"));
  const type = normalize(searchParams.get("type") || searchParams.get("listingType") || "all");
  const category = normalize(searchParams.get("category") || "all");
  const maxPrice = numberOrDefault(searchParams.get("maxPrice"), Infinity);
  const minPrice = numberOrDefault(searchParams.get("minPrice"), 0);
  const minSize = numberOrDefault(searchParams.get("minSize"), 0);
  const sort = normalize(searchParams.get("sort") || "distance");
  const includeUnavailable = normalize(searchParams.get("includeUnavailable")) === "true";
  const page = Math.max(1, Math.floor(numberOrDefault(searchParams.get("page"), 1)));
  const pageSize = Math.min(12, Math.max(2, Math.floor(numberOrDefault(searchParams.get("pageSize"), 6))));

  let results = listings.map(enrichListing).filter((listing) => {
    const matchesArea =
      !area ||
      normalize(listing.area).includes(area) ||
      normalize(listing.address).includes(area) ||
      (listing.coverageAreas || []).some((item) => normalize(item).includes(area));
    const matchesType = type === "all" || normalize(listing.listingType) === type;
    const matchesCategory = category === "all" || normalize(listing.category) === category;
    const matchesPrice = listing.price >= minPrice && listing.price <= maxPrice;
    const matchesSize = listing.listingType === "service" || listing.size >= minSize;
    const matchesStatus = includeUnavailable || listing.status === "Available";
    const verified = listing.verificationStatus === "verified";
    return matchesArea && matchesType && matchesCategory && matchesPrice && matchesSize && matchesStatus && verified;
  });

  if (sort === "price") {
    results.sort((a, b) => a.price - b.price);
  } else if (sort === "rating") {
    results.sort((a, b) => b.rating - a.rating);
  } else if (sort === "newest") {
    results.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  } else {
    results.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    page: currentPage,
    pageSize,
    total: results.length,
    totalPages,
    results: results.slice(start, start + pageSize)
  };
}

function getListingById(id) {
  const listing = listings.find((item) => item.id === id);
  return listing ? enrichListing(listing) : null;
}

function getNearbyPlaces(listingId) {
  const listing = getListingById(listingId);
  if (!listing) {
    const error = new Error("Listing not found.");
    error.status = 404;
    throw error;
  }
  return Object.entries(nearbySeed).flatMap(([category, names], categoryIndex) =>
    names.slice(0, 2).map((name, index) => ({
      id: `${listingId}-${category}-${index}`,
      category,
      name,
      distanceKm: Number((0.18 + categoryIndex * 0.11 + index * 0.08 + listing.distanceKm / 20).toFixed(2)),
      walkingMinutes: Math.round((0.18 + categoryIndex * 0.11 + index * 0.08 + listing.distanceKm / 20) * 12)
    }))
  );
}

function getSmartSetupSuggestions(listingId) {
  const listing = getListingById(listingId);
  if (!listing) {
    const error = new Error("Listing not found.");
    error.status = 404;
    throw error;
  }
  if (listing.listingType !== "property") {
    return [];
  }
  const needed = ["Interior", "ISP", "Electrician"];
  return listings
    .filter((item) => item.listingType === "service" && item.status === "Available" && needed.includes(item.category))
    .map(enrichListing)
    .filter((item) => (item.coverageAreas || []).some((area) => normalize(area) === normalize(listing.area)))
    .sort((a, b) => b.rating - a.rating || a.price - b.price)
    .slice(0, 4);
}

function toggleFavorite(listingId, userId = "user-001", forceSaved) {
  const user = getUserById(userId) || getUserById("user-001");
  if (!getListingById(listingId)) {
    const error = new Error("Listing not found.");
    error.status = 404;
    throw error;
  }
  const hasSaved = user.savedListingIds.includes(listingId);
  const shouldSave = forceSaved === undefined ? !hasSaved : Boolean(forceSaved);
  if (shouldSave && !hasSaved) user.savedListingIds.push(listingId);
  if (!shouldSave && hasSaved) user.savedListingIds = user.savedListingIds.filter((id) => id !== listingId);
  return { saved: shouldSave, favorites: getFavorites(user.id) };
}

function getFavorites(userId = "user-001") {
  const user = getUserById(userId) || getUserById("user-001");
  return user.savedListingIds.map(getListingById).filter(Boolean);
}

function getReviews(listingId) {
  const filtered = listingId ? reviews.filter((review) => review.listingId === listingId) : reviews;
  return filtered.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function createReview(payload) {
  const listing = listings.find((item) => item.id === payload.listingId);
  const rating = Math.max(1, Math.min(5, Math.round(numberOrDefault(payload.rating, 0))));
  const comment = String(payload.comment || "").trim();
  const reviewer = getUserById(payload.reviewerId || "user-001") || getUserById("user-001");

  if (!listing || !rating || !comment) {
    const error = new Error("Listing, rating, and review comment are required.");
    error.status = 400;
    throw error;
  }

  const review = {
    id: nextId("review"),
    listingId: listing.id,
    reviewerId: reviewer.id,
    author: reviewer.name,
    rating,
    comment,
    createdAt: nowIso()
  };
  reviews.push(review);

  const listingReviews = reviews.filter((item) => item.listingId === listing.id);
  const average = listingReviews.reduce((sum, item) => sum + item.rating, 0) / listingReviews.length;
  listing.reviewCount = listingReviews.length;
  listing.rating = Number(average.toFixed(1));

  addNotification(listing.ownerId, "review", "New review received", `${reviewer.name} reviewed ${listing.title}.`, "email");
  addEmailLog((getUserById(listing.ownerId) || {}).email, "review-submission", `New review for ${listing.title}`);

  return { review, listing: enrichListing(listing) };
}

function getReviewSummary(listingId) {
  const listing = getListingById(listingId);
  if (!listing) {
    const error = new Error("Listing not found.");
    error.status = 404;
    throw error;
  }
  return {
    listingId,
    averageRating: listing.rating,
    reviewCount: listing.reviewCount,
    latestReviews: getReviews(listingId).slice(0, 3)
  };
}

function serializeConversation(conversation) {
  const lastMessage = messages
    .filter((message) => message.conversationId === conversation.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return {
    ...conversation,
    listing: getListingById(conversation.listingId),
    participants: conversation.participantIds.map(getUserById).map(publicUser),
    lastMessage
  };
}

function getConversations(userId = "user-001") {
  return conversations
    .filter((conversation) => conversation.participantIds.includes(userId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(serializeConversation);
}

function getMessages(conversationId) {
  return messages
    .filter((message) => message.conversationId === conversationId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((message) => ({
      ...message,
      sender: publicUser(getUserById(message.senderId))
    }));
}

function createConversation(payload) {
  const listing = getListingById(payload.listingId);
  if (!listing) {
    const error = new Error("Listing not found.");
    error.status = 404;
    throw error;
  }
  const requesterId = payload.requesterId || "user-001";
  const existing = conversations.find(
    (conversation) =>
      conversation.listingId === listing.id &&
      conversation.participantIds.includes(requesterId) &&
      conversation.participantIds.includes(listing.ownerId)
  );
  if (existing) return serializeConversation(existing);

  const conversation = {
    id: nextId("conv"),
    listingId: listing.id,
    participantIds: [requesterId, listing.ownerId],
    subject: `${listing.title} inquiry`,
    updatedAt: nowIso()
  };
  conversations.unshift(conversation);
  return serializeConversation(conversation);
}

function sendMessage(payload) {
  const conversation = conversations.find((item) => item.id === payload.conversationId) || createConversation(payload);
  const senderId = payload.senderId || "user-001";
  const body = String(payload.message || payload.body || "").trim();
  if (!body) {
    const error = new Error("Message body is required.");
    error.status = 400;
    throw error;
  }
  const message = {
    id: nextId("msg"),
    conversationId: conversation.id,
    senderId,
    body,
    readBy: [senderId],
    createdAt: nowIso()
  };
  messages.push(message);
  conversation.updatedAt = message.createdAt;
  const sender = getUserById(senderId);
  conversation.participantIds
    .filter((participantId) => participantId !== senderId)
    .forEach((participantId) => addNotification(participantId, "message", "New message", `${sender.name}: ${body}`, "email"));
  return { conversation: serializeConversation(conversation), message };
}

function getNotifications(userId = "user-001", type = "") {
  const normalizedType = normalize(type);
  return notifications
    .filter((notification) => notification.userId === userId)
    .filter((notification) => !normalizedType || normalize(notification.type) === normalizedType)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function markNotificationRead(id) {
  const notification = notifications.find((item) => item.id === id);
  if (!notification) {
    const error = new Error("Notification not found.");
    error.status = 404;
    throw error;
  }
  notification.read = true;
  return notification;
}

function getEmailLogs() {
  return emailLogs.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function getBookings(userId = "user-001") {
  return bookings
    .filter((booking) => booking.requesterId === userId || booking.receiverId === userId)
    .map((booking) => ({
      ...booking,
      listing: getListingById(booking.listingId),
      requester: publicUser(getUserById(booking.requesterId)),
      receiver: publicUser(getUserById(booking.receiverId))
    }))
    .sort((a, b) => String(b.proposedAt).localeCompare(String(a.proposedAt)));
}

function createBooking(payload) {
  const listing = getListingById(payload.listingId);
  if (!listing) {
    const error = new Error("Listing not found.");
    error.status = 404;
    throw error;
  }
  const requesterId = payload.requesterId || "user-001";
  const booking = {
    id: nextId("booking"),
    listingId: listing.id,
    requesterId,
    receiverId: listing.ownerId,
    requestType: payload.requestType || (listing.listingType === "property" ? "visit" : "service-booking"),
    proposedAt: payload.proposedAt || nowIso(),
    status: "requested",
    notes: String(payload.notes || "").trim(),
    history: [{ status: "requested", at: nowIso(), by: requesterId }]
  };
  bookings.unshift(booking);
  const receiver = getUserById(listing.ownerId);
  addNotification(receiver.id, "booking", "New booking request", `${listing.title} has a new request.`, "email");
  addEmailLog(receiver.email, "booking-inquiry", `New request for ${listing.title}`);
  return getBookings(requesterId).find((item) => item.id === booking.id);
}

function respondBooking(id, payload) {
  const booking = bookings.find((item) => item.id === id);
  if (!booking) {
    const error = new Error("Booking not found.");
    error.status = 404;
    throw error;
  }
  const status = payload.status || "accepted";
  booking.status = status;
  if (payload.alternateAt) booking.alternateAt = payload.alternateAt;
  booking.history.push({ status, at: nowIso(), by: payload.userId || booking.receiverId });
  const listing = getListingById(booking.listingId);
  addNotification(booking.requesterId, "booking", `Booking ${status}`, `${listing.title} request is ${status}.`, "email");
  addEmailLog((getUserById(booking.requesterId) || {}).email, "booking-confirmation", `Booking ${status}: ${listing.title}`);
  return getBookings(booking.requesterId).find((item) => item.id === booking.id);
}

function getAdminQueue() {
  return {
    pendingUsers: users.filter((user) => user.verificationStatus === "pending").map(publicUser),
    pendingListings: listings.filter((listing) => listing.verificationStatus === "pending").map(enrichListing),
    reports
  };
}

function verifyUser(id, status = "verified") {
  const user = getUserById(id);
  if (!user) {
    const error = new Error("User not found.");
    error.status = 404;
    throw error;
  }
  user.verificationStatus = status;
  addNotification(user.id, "verification", "Verification updated", `Your account is now ${status}.`);
  return publicUser(user);
}

function moderateListing(id, payload) {
  const listing = listings.find((item) => item.id === id);
  if (!listing) {
    const error = new Error("Listing not found.");
    error.status = 404;
    throw error;
  }
  listing.verificationStatus = payload.verificationStatus || listing.verificationStatus;
  listing.status = payload.status || listing.status;
  return enrichListing(listing);
}

function getDashboard() {
  const activeListings = listings.filter((listing) => listing.status === "Available").length;
  return {
    app: "OfficeKhoj BD",
    users: users.length,
    activeListings,
    conversations: conversations.length,
    unreadNotifications: notifications.filter((item) => !item.read).length,
    bookings: bookings.length,
    modules: [
      "Authentication and admin verification",
      "Map-based space and service search",
      "Property and service listing management",
      "In-app messaging",
      "Email notification queue",
      "Reviews and ratings",
      "Listing detail, gallery, favorites",
      "Nearby places and availability",
      "Smart setup suggestions and booking flow",
      "Business profile, sorting, pagination, location metrics"
    ]
  };
}

function getMember4Info() {
  return {
    member: {
      name: "M A OBAEED",
      studentId: "21201382",
      groupMemberNo: 4
    },
    collaborationPattern: {
      backend: "backend/features/week-XX-member-YY-feature-name.js",
      frontend: "frontend/public/features/week-XX-member-YY-feature-name.js"
    },
    features: [
      "Address Suggestion Integration",
      "Review & Rating System",
      "Business Profile & Saved Preferences",
      "Search Sorting, Pagination & Location Metrics"
    ]
  };
}

module.exports = {
  createBooking,
  createConversation,
  createListing,
  createReview,
  deleteListing,
  getAdminQueue,
  getBookings,
  getConversations,
  getDashboard,
  getDefaultUserId,
  getEmailLogs,
  getFavorites,
  getListingById,
  getListings,
  getMember4Info,
  getMessages,
  getNearbyPlaces,
  getNotifications,
  getProfile,
  getReviewSummary,
  getReviews,
  getSmartSetupSuggestions,
  getUserById,
  listAddressSuggestions,
  loginUser,
  markNotificationRead,
  moderateListing,
  registerUser,
  respondBooking,
  sendMessage,
  toggleFavorite,
  updateListing,
  updateListingStatus,
  updateProfile,
  verifyUser
};
