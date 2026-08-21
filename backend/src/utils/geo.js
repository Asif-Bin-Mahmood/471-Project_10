import { landmarkData, nearbySeed } from "../seed/seedSource.js";

// Calculate straight-line distance between two latitude/longitude points.
// This is the Haversine formula and returns distance in kilometres.
export function haversineKm(aLat, aLng, bLat, bLng) {
  const earthRadiusKm = 6371;
  const toRadians = (degree) => (degree * Math.PI) / 180;

  const latDifference = toRadians(bLat - aLat);
  const lngDifference = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);

  const haversine =
    Math.sin(latDifference / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDifference / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}

function hasValidCoordinates(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

// Existing Module 3 metric: show distance to the nearest seeded landmark.
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

  const nearestLandmark = landmarkData
    .map((landmark) => ({
      ...landmark,
      distanceKm: haversineKm(lat, lng, landmark.lat, landmark.lng)
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];

  return {
    distanceKm: Number(nearestLandmark.distanceKm.toFixed(2)),
    metricLabel: `${nearestLandmark.distanceKm.toFixed(2)} km to ${nearestLandmark.name}`
  };
}

// Convert a Mongoose document into a normal object and add location metrics.
export function serializeListing(listing) {
  if (!listing) return null;

  const item = listing.toObject ? listing.toObject() : listing;
  const owner = item.owner && typeof item.owner === "object" && (item.owner.name || item.owner.role)
    ? {
        _id: item.owner._id,
        name: item.owner.name,
        role: item.owner.role,
        status: item.owner.status,
        verificationStatus: item.owner.verificationStatus,
        coverageAreas: item.owner.coverageAreas,
        averageRating: item.owner.averageRating,
        reviewCount: item.owner.reviewCount,
        ratingSummary: item.owner.ratingSummary
      }
    : item.owner;
  return {
    ...item,
    owner,
    ...locationMetric(item),
    imageTone: item.category ? item.category.toLowerCase() : "office"
  };
}

// Demo fallback used only when live Foursquare nearby-place data is unavailable.
export function nearbyPlaces(listing) {
  const metric = locationMetric(listing);
  const baseDistance = Number(metric.distanceKm || 0);

  return Object.entries(nearbySeed).flatMap(([category, names], categoryIndex) =>
    names.map((name, index) => {
      const distanceKm = 0.18 + categoryIndex * 0.11 + index * 0.08 + baseDistance / 20;

      return {
        id: `${listing._id}-${category}-${index}`,
        category,
        name,
        distanceKm: Number(distanceKm.toFixed(2)),
        walkingMinutes: Math.round(distanceKm * 12)
      };
    })
  );
}
