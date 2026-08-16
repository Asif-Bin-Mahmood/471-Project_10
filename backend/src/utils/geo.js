import { landmarkData, nearbySeed } from "../seed/seedSource.js";

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

function hasValidCoordinates(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function locationMetric(listing) {
  const rawLocation = listing.location || listing;
  const lat = Number(rawLocation.lat);
  const lng = Number(rawLocation.lng);

  if (!hasValidCoordinates(lat, lng)) {
    return {
      distanceKm: null,
      metricLabel: "Coordinates unavailable"
    };
  }

  const nearest = landmarkData
    .map((landmark) => ({
      ...landmark,
      distanceKm: haversineKm(lat, lng, landmark.lat, landmark.lng)
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];

  return {
    distanceKm: Number(nearest.distanceKm.toFixed(2)),
    metricLabel: `${nearest.distanceKm.toFixed(2)} km to ${nearest.name}`
  };
}

export function serializeListing(listing) {
  if (!listing) return null;
  const item = listing.toObject ? listing.toObject() : listing;
  return {
    ...item,
    ...locationMetric(item),
    imageTone: item.category ? item.category.toLowerCase() : "office"
  };
}

export function nearbyPlaces(listing) {
  const metric = locationMetric(listing);
  const baseDistance = Number(metric.distanceKm || 0);
  return Object.entries(nearbySeed).flatMap(([category, names], categoryIndex) =>
    names.map((name, index) => ({
      id: `${listing._id}-${category}-${index}`,
      category,
      name,
      distanceKm: Number((0.18 + categoryIndex * 0.11 + index * 0.08 + baseDistance / 20).toFixed(2)),
      walkingMinutes: Math.round((0.18 + categoryIndex * 0.11 + index * 0.08 + baseDistance / 20) * 12)
    }))
  );
}
