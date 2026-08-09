import express from "express";
import { createReview, getListingReviews, getReviews, getReviewSummary } from "../controllers/review.controller.js";
import { requireAuth } from "../utils/auth.js";

const router = express.Router();

router.get("/reviews", getReviews);
router.get("/reviews/:listingId", getListingReviews);
router.post("/reviews", requireAuth, createReview);
router.get("/reviews/:listingId/summary", getReviewSummary);

export default router;
