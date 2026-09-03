const DEFAULT_BASE_URL = "https://nominatim.openstreetmap.org";
const DEFAULT_USER_AGENT = "OfficeKhojBD-CSE471/1.0";
const DEFAULT_TIMEOUT_MS = 4500;
const MIN_REQUEST_GAP_MS = 1100;
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const SUGGESTION_LIMIT = 8;

// Bias address suggestions toward metropolitan Dhaka the way the previous
// provider did, without excluding the rest of Bangladesh (bounded=0).
// Nominatim viewbox order is left,top,right,bottom in lon/lat.
const DHAKA_VIEWBOX = "90.30,23.92,90.52,23.68";

const OSM_TYPE_PREFIX = { node: "N", way: "W", relation: "R" };

export class GeocodingError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "GeocodingError";
    this.status = status;
  }
}

const cache = new Map();
const suggestionCache = new Map();
const addressCache = new Map();
let lastRequestTime = 0;
let requestQueue = Promise.resolve();

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value) {
  return String(value || "").trim();
}

function remember(store, key, result) {
  if (!store.has(key) && store.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey !== undefined) store.delete(oldestKey);
  }
  store.set(key, { result, savedAt: Date.now() });
}

function readCache(store, key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.savedAt >= CACHE_TTL_MS) {
    store.delete(key);
    return null;
  }
  return entry.result;
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

// Stable, resolvable identifier for a suggestion: the OSM type prefix plus the
// OSM id, which is exactly what the Nominatim /lookup endpoint accepts.
function suggestionId(result) {
  const prefix = OSM_TYPE_PREFIX[cleanText(result?.osm_type).toLowerCase()];
  const osmId = Number(result?.osm_id);
  if (!prefix || !Number.isInteger(osmId) || osmId <= 0) return "";
  return `${prefix}${osmId}`;
}

// Nominatim display_name carries the full administrative tail
// ("..., Dhaka District, Dhaka Division, 1213, Bangladesh"). The existing
// dropdown expects a short address line, so compose one from address details.
function suggestionLabel(result) {
  const address = result?.address || {};
  const parts = [];
  const push = (value) => {
    const text = cleanText(value);
    if (!text) return;
    if (parts.some((part) => part.toLowerCase() === text.toLowerCase())) return;
    parts.push(text);
  };

  const road = cleanText(address.road);
  const houseNumber = cleanText(address.house_number);

  push(result?.name);
  push(houseNumber && road ? `${houseNumber} ${road}` : road);
  push(address.neighbourhood || address.suburb || address.quarter);
  push(address.city_district || address.town || address.city || address.municipality);

  const label = parts.slice(0, 4).join(", ");
  if (label) return label;

  return cleanText(result?.display_name)
    .split(",")
    .slice(0, 3)
    .map(cleanText)
    .filter(Boolean)
    .join(", ");
}

function normalizeSuggestion(result) {
  const id = suggestionId(result);
  if (!id) return null;

  const lat = Number(result.lat);
  const lng = Number(result.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  const label = suggestionLabel(result);
  if (!label) return null;

  return {
    id,
    label,
    area: getAreaName(result.address, label.split(",")[0]) || "Dhaka",
    lat,
    lng,
    source: "nominatim"
  };
}

async function respectRateLimit() {
  const timeSinceLastRequest = Date.now() - lastRequestTime;
  const remainingWait = MIN_REQUEST_GAP_MS - timeSinceLastRequest;
  if (remainingWait > 0) await wait(remainingWait);
}

// Every outbound call shares one queue so Nominatim never sees more than one
// request per MIN_REQUEST_GAP_MS from this process.
function enqueue(task) {
  const request = requestQueue.then(task);
  requestQueue = request.catch(() => undefined);
  return request;
}

function buildUrl(path, parameters) {
  const baseUrl = cleanText(process.env.NOMINATIM_BASE_URL) || DEFAULT_BASE_URL;
  const url = new URL(path, baseUrl);

  Object.entries(parameters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });

  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "en");

  const contactEmail = cleanText(process.env.NOMINATIM_CONTACT_EMAIL);
  if (contactEmail) url.searchParams.set("email", contactEmail);

  return url;
}

async function requestJson(url) {
  await respectRateLimit();

  const timeoutValue = Number(process.env.NOMINATIM_REQUEST_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(timeoutValue) && timeoutValue > 0 ? timeoutValue : DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    lastRequestTime = Date.now();

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": cleanText(process.env.NOMINATIM_USER_AGENT) || DEFAULT_USER_AGENT
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new GeocodingError("Address search rate limit reached. Please try again shortly.", 503);
      }
      throw new GeocodingError(`Nominatim request failed with status ${response.status}.`, 502);
    }

    try {
      return await response.json();
    } catch {
      throw new GeocodingError("Nominatim returned an invalid response.", 502);
    }
  } catch (error) {
    if (error instanceof GeocodingError) throw error;
    if (error?.name === "AbortError") {
      throw new GeocodingError("Address search timed out. Please try again.", 504);
    }
    throw new GeocodingError("Nominatim is unavailable.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function geocodeArea(query) {
  const cleanQuery = cleanText(query);
  if (cleanQuery.length < 2) return null;

  const key = cleanQuery.toLowerCase();
  const cached = readCache(cache, key);
  if (cached) return { ...cached, cached: true };

  const url = buildUrl("/search", {
    q: cleanQuery,
    limit: 1,
    countrycodes: cleanText(process.env.NOMINATIM_COUNTRY_CODES) || "bd"
  });

  const payload = await enqueue(() => requestJson(url));
  const firstResult = Array.isArray(payload) ? payload[0] : null;
  const result = normalizeResult(cleanQuery, firstResult);
  if (result) remember(cache, key, result);

  return result;
}

export async function searchAddressSuggestions(query) {
  const cleanQuery = cleanText(query);
  if (cleanQuery.length < 3) return [];

  const key = cleanQuery.toLowerCase();
  const cached = readCache(suggestionCache, key);
  if (cached) {
    cached.forEach((suggestion) => remember(addressCache, suggestion.id, suggestion));
    return cached;
  }

  const url = buildUrl("/search", {
    q: cleanQuery,
    limit: SUGGESTION_LIMIT,
    countrycodes: cleanText(process.env.NOMINATIM_COUNTRY_CODES) || "bd",
    viewbox: DHAKA_VIEWBOX,
    bounded: 0
  });

  const payload = await enqueue(() => requestJson(url));
  const results = Array.isArray(payload) ? payload : [];
  const suggestions = [];
  const seen = new Set();

  results.forEach((result) => {
    const suggestion = normalizeSuggestion(result);
    if (!suggestion || seen.has(suggestion.id)) return;
    seen.add(suggestion.id);
    suggestions.push(suggestion);
    remember(addressCache, suggestion.id, suggestion);
  });

  remember(suggestionCache, key, suggestions);
  return suggestions;
}

export async function lookupAddressById(addressId) {
  const id = cleanText(addressId);
  if (!/^[NWR][0-9]+$/.test(id)) {
    throw new GeocodingError("Selected address could not be verified.", 400);
  }

  const cached = readCache(addressCache, id);
  if (cached) return cached;

  const payload = await enqueue(() => requestJson(buildUrl("/lookup", { osm_ids: id })));
  const results = Array.isArray(payload) ? payload : [];
  const suggestion = results.map(normalizeSuggestion).find(Boolean);
  if (!suggestion) {
    throw new GeocodingError("Selected address could not be verified.", 400);
  }

  remember(addressCache, suggestion.id, suggestion);
  return suggestion;
}
