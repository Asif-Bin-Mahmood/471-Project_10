const MAPBOX_FORWARD_URL = "https://api.mapbox.com/search/geocode/v6/forward";
const DEFAULT_TIMEOUT_MS = 5000;
const DHAKA_PROXIMITY = "90.4125,23.8103";

export class GeocodingError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "GeocodingError";
    this.status = status;
  }
}

function getAccessToken() {
  const token = String(process.env.MAPBOX_ACCESS_TOKEN || "").trim();
  if (!token) throw new GeocodingError("Address suggestion service is not configured.", 503);
  return token;
}

function getTimeoutMs() {
  const configured = Number(process.env.MAPBOX_REQUEST_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

function pointCoordinates(feature) {
  const propertyCoordinates = feature?.properties?.coordinates;
  const geometryCoordinates = feature?.geometry?.coordinates;
  const lng = Number(propertyCoordinates?.longitude ?? geometryCoordinates?.[0]);
  const lat = Number(propertyCoordinates?.latitude ?? geometryCoordinates?.[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function areaName(properties) {
  const context = properties?.context || {};
  const featureType = properties?.feature_type;
  const ownName = properties?.name_preferred || properties?.name;
  const candidates = [
    featureType === "neighborhood" ? ownName : null,
    context.neighborhood?.name,
    featureType === "locality" ? ownName : null,
    context.locality?.name,
    featureType === "place" ? ownName : null,
    context.place?.name,
    context.district?.name,
    ownName
  ];
  return candidates.find((value) => String(value || "").trim()) || "Dhaka";
}

function normalizeFeature(feature) {
  const properties = feature?.properties || {};
  const coordinates = pointCoordinates(feature);
  const id = properties.mapbox_id || feature?.id;
  const name = properties.name_preferred || properties.name;
  const label = properties.full_address || [name, properties.place_formatted].filter(Boolean).join(", ");
  if (!id || !label || !coordinates) return null;

  return {
    id: String(id),
    label: String(label),
    area: String(areaName(properties)),
    lat: coordinates.lat,
    lng: coordinates.lng,
    source: "mapbox"
  };
}

async function requestMapbox(parameters) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const url = new URL(process.env.MAPBOX_GEOCODING_BASE_URL || MAPBOX_FORWARD_URL);
    Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    url.searchParams.set("access_token", getAccessToken());

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new GeocodingError("Address suggestion service rate limit reached. Please try again shortly.", 503);
      }
      throw new GeocodingError("Address suggestion service is unavailable.", 502);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new GeocodingError("Address suggestion service returned an invalid response.", 502);
    }

    if (data?.type !== "FeatureCollection" || !Array.isArray(data.features)) {
      throw new GeocodingError("Address suggestion service returned an invalid response.", 502);
    }
    return data.features.map(normalizeFeature).filter(Boolean);
  } catch (error) {
    if (error instanceof GeocodingError) throw error;
    if (error?.name === "AbortError") {
      throw new GeocodingError("Address suggestion service timed out.", 504);
    }
    throw new GeocodingError("Address suggestion service is unavailable.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchMapboxAddresses(query) {
  return requestMapbox({
    q: query,
    autocomplete: true,
    country: "bd",
    proximity: DHAKA_PROXIMITY,
    types: "address,street,neighborhood,locality,place",
    limit: 6
  });
}

export async function resolveMapboxAddress(mapboxId) {
  const results = await requestMapbox({
    q: mapboxId,
    autocomplete: false,
    country: "bd",
    permanent: true,
    limit: 1
  });
  if (!results.length) throw new GeocodingError("Selected address could not be verified.", 400);
  return results[0];
}
