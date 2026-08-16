import express from "express";
import {
  createReview,
  getListingReviews,
  getReviewEligibilityStatus,
  getReviews,
  getReviewSummary
} from "../controllers/review.controller.js";
import { requireAuth, requireRole } from "../utils/auth.js";

const router = express.Router();

router.get("/reviews", getReviews);
router.get("/reviews/:listingId", getListingReviews);
router.post("/reviews", requireAuth, requireRole("business-owner"), createReview);
router.get("/reviews/:listingId/summary", getReviewSummary);
router.get("/reviews/:listingId/eligibility", requireAuth, getReviewEligibilityStatus);

export default router;
