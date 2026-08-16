const DEFAULT_BASE_URL = "https://places-api.foursquare.com/places/search";
const DEFAULT_API_VERSION = "2025-06-17";
const DEFAULT_RADIUS_METERS = 1500;
const DEFAULT_RESULTS_PER_CATEGORY = 3;
const DEFAULT_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 10 * 60 * 1000;

const PLACE_SEARCHES = [
  { category: "Bank", query: "bank" },
  { category: "Restaurant", query: "restaurant" },
  { category: "Hospital", query: "hospital" },
  { category: "Public transport", query: "public transport" }
];

const cache = new Map();

function coordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function envNumber(name, fallback, min, max) {
  const number = Number(process.env[name]);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function makeCacheKey(lat, lng, radius, limit) {
  return `${lat.toFixed(4)}:${lng.toFixed(4)}:${radius}:${limit}`;
}

function normalizePlace(place, category, listingId, index) {
  const lat = coordinate(place.latitude ?? place.geocodes?.main?.latitude);
  const lng = coordinate(place.longitude ?? place.geocodes?.main?.longitude);
  const distanceMeters = Number(place.distance);
  const distanceKm = Number.isFinite(distanceMeters) ? distanceMeters / 1000 : null;
  const address = place.location?.formatted_address || place.location?.address || place.address || "";

  return {
    id: place.fsq_place_id || place.fsq_id || `fsq-${category}-${index}`,
    category,
    name: place.name || category,
    address,
    lat,
    lng,
    distanceKm: distanceKm === null ? null : Number(distanceKm.toFixed(2)),
    walkingMinutes: distanceKm === null ? null : Math.max(1, Math.round(distanceKm * 12)),
    source: "foursquare",
    listingId: String(listingId || "")
  };
}

function buildSettings(listing) {
  const token = String(process.env.FOURSQUARE_BEARER_TOKEN || "").trim();
  if (!token) throw new Error("FOURSQUARE_BEARER_TOKEN is not configured.");

  const lat = coordinate(listing?.location?.lat);
  const lng = coordinate(listing?.location?.lng);
  if (lat === null || lng === null) {
    throw new Error("Listing coordinates are unavailable for nearby-place search.");
  }

  return {
    token,
    lat,
    lng,
    baseUrl: String(process.env.FOURSQUARE_BASE_URL || DEFAULT_BASE_URL).trim(),
    apiVersion: String(process.env.FOURSQUARE_API_VERSION || DEFAULT_API_VERSION).trim(),
    radius: envNumber("FOURSQUARE_RADIUS_METERS", DEFAULT_RADIUS_METERS, 100, 100000),
    limit: envNumber("FOURSQUARE_RESULTS_PER_CATEGORY", DEFAULT_RESULTS_PER_CATEGORY, 1, 10),
    timeoutMs: envNumber("FOURSQUARE_REQUEST_TIMEOUT_MS", DEFAULT_TIMEOUT_MS, 1000, 20000)
  };
}

async function searchOneCategory(search, listing, settings, signal) {
  const params = new URLSearchParams({
    query: search.query,
    ll: `${settings.lat},${settings.lng}`,
    radius: String(settings.radius),
    limit: String(settings.limit),
    sort: "DISTANCE",
    fields: "fsq_place_id,name,latitude,longitude,distance,categories,location"
  });

  const response = await fetch(`${settings.baseUrl}?${params}`, {
    signal,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${settings.token}`,
      "X-Places-Api-Version": settings.apiVersion
    }
  });

  if (!response.ok) {
    throw new Error(`Foursquare request failed with status ${response.status}.`);
  }

  const data = await response.json();
  const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

  return results.map((place, index) => normalizePlace(place, search.category, listing._id, index));
}

export async function getFoursquareNearbyPlaces(listing) {
  const settings = buildSettings(listing);
  const key = makeCacheKey(settings.lat, settings.lng, settings.radius, settings.limit);
  const cached = cache.get(key);

  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) {
    return cached.places;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), settings.timeoutMs);

  try {
    const groups = await Promise.all(
      PLACE_SEARCHES.map((search) => searchOneCategory(search, listing, settings, controller.signal))
    );

    const places = groups.flat();
    cache.set(key, { places, savedAt: Date.now() });
    return places;
  } finally {
    clearTimeout(timeout);
  }
}
