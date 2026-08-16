const DEFAULT_BASE_URL = "https://nominatim.openstreetmap.org";
const DEFAULT_TIMEOUT_MS = 4500;
const MIN_REQUEST_GAP_MS = 1100;
const CACHE_TTL_MS = 30 * 60 * 1000;

const cache = new Map();
let lastRequestTime = 0;
let requestQueue = Promise.resolve();

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value) {
  return String(value || "").trim();
}

function getAreaName(address = {}, fallback = "") {
  return cleanText(
    address.suburb ||
      address.neighbourhood ||
      address.quarter ||
      address.city_district ||
      address.town ||
      address.city ||
      address.municipality ||
      fallback
  );
}

function normalizeResult(query, result) {
  if (!result) return null;

  const lat = Number(result.lat);
  const lng = Number(result.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const boundingBox = Array.isArray(result.boundingbox)
    ? result.boundingbox.map(Number).filter(Number.isFinite)
    : [];

  return {
    query,
    displayName: result.display_name || query,
    area: getAreaName(result.address, query.split(",")[0]),
    lat,
    lng,
    boundingBox: boundingBox.length === 4 ? boundingBox : [],
    osmType: result.osm_type || "",
    osmId: result.osm_id || null,
    source: "nominatim"
  };
}

async function respectRateLimit() {
  const timeSinceLastRequest = Date.now() - lastRequestTime;
  const remainingWait = MIN_REQUEST_GAP_MS - timeSinceLastRequest;
  if (remainingWait > 0) await wait(remainingWait);
}

function buildSearchUrl(query) {
  const baseUrl = cleanText(process.env.NOMINATIM_BASE_URL) || DEFAULT_BASE_URL;
  const url = new URL("/search", baseUrl);

  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", cleanText(process.env.NOMINATIM_COUNTRY_CODES) || "bd");
  url.searchParams.set("accept-language", "en");

  const contactEmail = cleanText(process.env.NOMINATIM_CONTACT_EMAIL);
  if (contactEmail) url.searchParams.set("email", contactEmail);

  return url;
}

async function requestNominatim(query) {
  await respectRateLimit();

  const timeoutValue = Number(process.env.NOMINATIM_REQUEST_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(timeoutValue) ? timeoutValue : DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    lastRequestTime = Date.now();

    const response = await fetch(buildSearchUrl(query), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": cleanText(process.env.NOMINATIM_USER_AGENT) || "OfficeKhojBD-CSE471/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim request failed with status ${response.status}.`);
    }

    const results = await response.json();
    const firstResult = Array.isArray(results) ? results[0] : null;
    return normalizeResult(query, firstResult);
  } finally {
    clearTimeout(timeout);
  }
}

export async function geocodeArea(query) {
  const cleanQuery = cleanText(query);
  if (cleanQuery.length < 2) return null;

  const key = cleanQuery.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) {
    return { ...cached.result, cached: true };
  }

  const request = requestQueue.then(() => requestNominatim(cleanQuery));
  requestQueue = request.catch(() => undefined);

  const result = await request;
  if (result) cache.set(key, { result, savedAt: Date.now() });

  return result;
}
