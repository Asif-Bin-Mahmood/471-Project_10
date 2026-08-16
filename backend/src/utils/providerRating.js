import Listing from "../models/Listing.js";
import Review from "../models/Review.js";

const providerRoles = new Set(["property-owner", "service-provider"]);

export function supportsProviderRating(role) {
  return providerRoles.has(role);
}

export async function getProviderRatingSummary(userId, role) {
  if (!supportsProviderRating(role)) {
    return null;
  }

  const listings = await Listing.find({ owner: userId }).select("_id").lean();
  if (!listings.length) {
    return { averageRating: 0, reviewCount: 0 };
  }

  const [summary] = await Review.aggregate([
    { $match: { listing: { $in: listings.map((listing) => listing._id) } } },
    { $group: { _id: null, averageRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } }
  ]);

  return {
    averageRating: summary ? Number(summary.averageRating.toFixed(1)) : 0,
    reviewCount: summary?.reviewCount || 0
  };
}

export async function attachProviderRating(profile) {
  if (!profile) return profile;
  const data = profile.toJSON ? profile.toJSON() : { ...profile };
  delete data.password;
  const ratingSummary = await getProviderRatingSummary(data._id, data.role);
  if (!ratingSummary) return data;

  return {
    ...data,
    averageRating: ratingSummary.averageRating,
    reviewCount: ratingSummary.reviewCount,
    ratingSummary
  };
}
