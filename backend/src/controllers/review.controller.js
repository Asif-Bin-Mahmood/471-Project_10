import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Listing from "../models/Listing.js";
import Review from "../models/Review.js";
import { notifyUser } from "../services/notification.service.js";

const REVIEWER_SAFE_FIELDS = "name role";
const COMMENT_MAX_LENGTH = 1000;

function validObjectId(id) {
  return mongoose.isValidObjectId(id);
}

function normalizeRating(value) {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  return rating;
}

function normalizeComment(value) {
  const comment = String(value ?? "").trim();
  if (comment.length < 3) return { error: "Review comment must be at least 3 characters." };
  if (comment.length > COMMENT_MAX_LENGTH) {
    return { error: `Review comment must be ${COMMENT_MAX_LENGTH} characters or fewer.` };
  }
  return { comment };
}

function buildDistribution(reviews) {
  return reviews.reduce(
    (distribution, review) => {
      const key = String(review.rating);
      if (distribution[key] !== undefined) distribution[key] += 1;
      return distribution;
    },
    { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  );
}

async function updateListingRating(listingId) {
  const reviews = await Review.find({ listing: listingId });
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  return Listing.findByIdAndUpdate(
    listingId,
    { rating: Number(average.toFixed(1)), reviewCount: reviews.length },
    { new: true }
  );
}

async function getReviewEligibility(listing, user) {
  if (!user) {
    return {
      eligible: false,
      alreadyReviewed: false,
      hasCompletedBooking: false,
      reason: "Sign in before leaving a review."
    };
  }

  if (user.role !== "business-owner") {
    return {
      eligible: false,
      alreadyReviewed: false,
      hasCompletedBooking: false,
      reason: "Only Business Owners can submit reviews."
    };
  }

  if (String(listing.owner) === String(user._id)) {
    return {
      eligible: false,
      alreadyReviewed: false,
      hasCompletedBooking: false,
      reason: "You cannot review your own listing."
    };
  }

  const [alreadyReviewed, completedBooking] = await Promise.all([
    Review.exists({ listing: listing._id, reviewer: user._id }),
    Booking.exists({ listing: listing._id, requester: user._id, status: "completed" })
  ]);

  if (alreadyReviewed) {
    return {
      eligible: false,
      alreadyReviewed: true,
      hasCompletedBooking: Boolean(completedBooking),
      reason: "You have already reviewed this listing."
    };
  }

  if (!completedBooking) {
    return {
      eligible: false,
      alreadyReviewed: false,
      hasCompletedBooking: false,
      reason: "Complete a booking before leaving a review."
    };
  }

  return {
    eligible: true,
    alreadyReviewed: false,
    hasCompletedBooking: true,
    reason: "You can review this listing."
  };
}

export async function getReviews(req, res, next) {
  try {
    const filter = req.query.listingId ? { listing: req.query.listingId } : {};
    if (req.query.listingId && !validObjectId(req.query.listingId)) {
      return res.status(400).json({ error: "Invalid listing id." });
    }
    const reviews = await Review.find(filter).populate("reviewer", REVIEWER_SAFE_FIELDS).sort({ createdAt: -1 });
    res.json({ reviews });
  } catch (error) {
    next(error);
  }
}

export async function getListingReviews(req, res, next) {
  try {
    if (!validObjectId(req.params.listingId)) return res.status(400).json({ error: "Invalid listing id." });
    const reviews = await Review.find({ listing: req.params.listingId })
      .populate("reviewer", REVIEWER_SAFE_FIELDS)
      .sort({ createdAt: -1 });
    res.json({ listingId: req.params.listingId, reviews });
  } catch (error) {
    next(error);
  }
}

export async function createReview(req, res, next) {
  try {
    if (!validObjectId(req.body.listingId)) return res.status(400).json({ error: "Invalid listing id." });
    const listing = await Listing.findById(req.body.listingId);
    if (!listing) return res.status(404).json({ error: "Listing not found." });
    if (String(listing.owner) === String(req.user._id)) {
      return res.status(422).json({ error: "You cannot review your own listing." });
    }

    const completedBooking = await Booking.exists({
      listing: listing._id,
      requester: req.user._id,
      status: "completed"
    });
    if (!completedBooking) {
      return res.status(403).json({ error: "Complete a booking before leaving a review." });
    }

    const duplicate = await Review.findOne({ listing: listing._id, reviewer: req.user._id });
    if (duplicate) {
      return res.status(409).json({ error: "You have already reviewed this listing." });
    }

    const rating = Number(req.body.rating);
    const validRating = normalizeRating(rating);
    if (!validRating) {
      return res.status(422).json({ error: "Rating must be an integer between 1 and 5." });
    }
    const commentResult = normalizeComment(req.body.comment);
    if (commentResult.error) return res.status(422).json({ error: commentResult.error });

    const review = await Review.create({
      listing: listing._id,
      reviewer: req.user._id,
      rating: validRating,
      comment: commentResult.comment
    });
    await review.populate("reviewer", REVIEWER_SAFE_FIELDS);
    const updatedListing = await updateListingRating(listing._id);
    await notifyUser(req.app.get("io"), {
      user: listing.owner,
      type: "review",
      title: "New review received",
      message: `${req.user.name} reviewed ${listing.title}.`
    });
    res.status(201).json({ review, listing: updatedListing });
  } catch (error) {
    next(error);
  }
}

export async function getReviewSummary(req, res, next) {
  try {
    if (!validObjectId(req.params.listingId)) return res.status(400).json({ error: "Invalid listing id." });
    const listing = await Listing.findById(req.params.listingId);
    if (!listing) return res.status(404).json({ error: "Listing not found." });
    const allReviews = await Review.find({ listing: listing._id }).populate("reviewer", REVIEWER_SAFE_FIELDS).sort({ createdAt: -1 });
    const average = allReviews.length
      ? Number((allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length).toFixed(1))
      : 0;
    if (listing.rating !== average || listing.reviewCount !== allReviews.length) {
      listing.rating = average;
      listing.reviewCount = allReviews.length;
      await listing.save();
    }
    res.json({
      listingId: listing._id,
      averageRating: average,
      reviewCount: allReviews.length,
      latestReviews: allReviews.slice(0, 3),
      distribution: buildDistribution(allReviews)
    });
  } catch (error) {
    next(error);
  }
}

export async function getReviewEligibilityStatus(req, res, next) {
  try {
    if (!validObjectId(req.params.listingId)) return res.status(400).json({ error: "Invalid listing id." });
    const listing = await Listing.findById(req.params.listingId);
    if (!listing) return res.status(404).json({ error: "Listing not found." });
    const eligibility = await getReviewEligibility(listing, req.user);
    res.json({ listingId: listing._id, ...eligibility });
  } catch (error) {
    next(error);
  }
}
