import User from "../models/User.js";
import { attachProviderRating } from "../utils/providerRating.js";

const profileStringFields = {
  businessType: 80,
  preferredArea: 80,
  serviceNeed: 140
};
const profileNumberFields = ["budgetMin", "budgetMax", "minSize"];

function sanitizeProfileUpdate(body, currentProfile) {
  const update = {};
  const errors = [];

  for (const [field, maxLength] of Object.entries(profileStringFields)) {
    if (body[field] === undefined) continue;
    const value = String(body[field] ?? "").trim();
    if (value.length > maxLength) errors.push(`${field} must be ${maxLength} characters or less.`);
    update[field] = value;
  }

  for (const field of profileNumberFields) {
    if (body[field] === undefined) continue;
    const number = body[field] === "" || body[field] === null ? 0 : Number(body[field]);
    if (!Number.isFinite(number) || number < 0) {
      errors.push(`${field} must be a finite number greater than or equal to 0.`);
      continue;
    }
    update[field] = number;
  }

  const nextBudgetMin = update.budgetMin ?? currentProfile.budgetMin ?? 0;
  const nextBudgetMax = update.budgetMax ?? currentProfile.budgetMax ?? 0;
  if (nextBudgetMin > nextBudgetMax) {
    errors.push("budgetMin must be less than or equal to budgetMax.");
  }

  return { update, errors };
}

export async function getProfile(req, res, next) {
  try {
    const profileId = req.user.role === "admin" ? req.params.id : req.user._id;
    const profile = await User.findById(profileId).populate("savedListings");
    if (!profile) return res.status(404).json({ error: "Profile not found." });
    res.json({ profile: await attachProviderRating(profile) });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const profileId = req.user.role === "admin" ? req.params.id : req.user._id;
    const profile = await User.findById(profileId);
    if (!profile) return res.status(404).json({ error: "Profile not found." });

    const { update, errors } = sanitizeProfileUpdate(req.body, profile);
    if (errors.length) return res.status(422).json({ error: "Profile validation failed.", details: errors });

    Object.assign(profile, update);
    await profile.save();
    await profile.populate("savedListings");
    res.json({ profile: await attachProviderRating(profile) });
  } catch (error) {
    next(error);
  }
}

export async function getFavorites(req, res, next) {
  try {
    const user = await User.findById(req.params.userId).populate("savedListings");
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ favorites: user.savedListings });
  } catch (error) {
    next(error);
  }
}

export async function addFavorite(req, res, next) {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found." });
    if (!user.savedListings.some((id) => String(id) === req.params.listingId)) {
      user.savedListings.push(req.params.listingId);
      await user.save();
    }
    await user.populate("savedListings");
    res.json({ favorites: user.savedListings });
  } catch (error) {
    next(error);
  }
}

export async function removeFavorite(req, res, next) {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found." });
    user.savedListings = user.savedListings.filter((id) => String(id) !== req.params.listingId);
    await user.save();
    await user.populate("savedListings");
    res.json({ favorites: user.savedListings });
  } catch (error) {
    next(error);
  }
}
