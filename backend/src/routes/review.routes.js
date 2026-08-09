import express from "express";
import Listing from "../models/Listing.js";
import Notification from "../models/Notification.js";
import Review from "../models/Review.js";
import { requireAuth } from "../utils/auth.js";

const router = express.Router();

async function updateListingRating(listingId) {
  const reviews = await Review.find({ listing: listingId });
  const average = reviews.reduce((sum, review) => sum + review.rating, 0) / Math.max(1, reviews.length);
  return Listing.findByIdAndUpdate(
    listingId,
    { rating: Number(average.toFixed(1)), reviewCount: reviews.length },
    { new: true }
  );
}

router.get("/reviews", async (req, res, next) => {
  try {
    const filter = req.query.listingId ? { listing: req.query.listingId } : {};
    const reviews = await Review.find(filter).populate("reviewer").sort({ createdAt: -1 });
    res.json({ reviews });
  } catch (error) {
    next(error);
  }
});

router.get("/reviews/:listingId", async (req, res, next) => {
  try {
    const reviews = await Review.find({ listing: req.params.listingId }).populate("reviewer").sort({ createdAt: -1 });
    res.json({ listingId: req.params.listingId, reviews });
  } catch (error) {
    next(error);
  }
});

router.post("/reviews", requireAuth, async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.body.listingId);
    if (!listing) return res.status(404).json({ error: "Listing not found." });
    if (String(listing.owner) === String(req.user._id)) {
      return res.status(422).json({ error: "You cannot review your own listing." });
    }
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || "").trim();
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(422).json({ error: "Rating must be between 1 and 5." });
    }
    if (comment.length < 3) return res.status(422).json({ error: "Review comment must be at least 3 characters." });
    const review = await Review.create({
      listing: listing._id,
      reviewer: req.user._id,
      rating,
      comment
    });
    const updatedListing = await updateListingRating(listing._id);
    await Notification.create({
      user: listing.owner,
      type: "review",
      title: "New review received",
      message: `${req.user.name} reviewed ${listing.title}.`,
      channel: "email"
    });
    res.status(201).json({ review, listing: updatedListing });
  } catch (error) {
    next(error);
  }
});

router.get("/reviews/:listingId/summary", async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.listingId);
    if (!listing) return res.status(404).json({ error: "Listing not found." });
    const latestReviews = await Review.find({ listing: listing._id }).sort({ createdAt: -1 }).limit(3);
    res.json({
      listingId: listing._id,
      averageRating: listing.rating,
      reviewCount: listing.reviewCount,
      latestReviews
    });
  } catch (error) {
    next(error);
  }
});

export default router;
