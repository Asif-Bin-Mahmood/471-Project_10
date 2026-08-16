import express from "express";
import { uploadPhoto } from "../controllers/upload.controller.js";
import {
  createListing,
  deleteListing,
  geocodeLocation,
  getAddressSuggestions,
  getListing,
  getListingDetail,
  getLocationMetric,
  getMyListings,
  getNearbyPlaces,
  getSetupSuggestions,
  searchListings,
  updateListing,
  updateListingStatus
} from "../controllers/listing.controller.js";
import { requireAuth, requireRole } from "../utils/auth.js";

const router = express.Router();

// Public search/location routes.
router.get("/address-suggestions", getAddressSuggestions);
router.get("/locations/geocode", geocodeLocation);
router.get("/listings", searchListings);
router.get("/listings/search", searchListings); // Alias kept for older frontend code.

// Property owner / service provider dashboard routes.
router.get(
  "/listings/mine",
  requireAuth,
  requireRole("property-owner", "service-provider", "admin"),
  getMyListings
);
router.post(
  "/uploads/listing-photo",
  requireAuth,
  requireRole("property-owner", "service-provider", "admin"),
  express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "8mb" }),
  uploadPhoto
);
router.post("/listings", requireAuth, createListing);
router.put("/listings/:id", requireAuth, updateListing);
router.delete("/listings/:id", requireAuth, deleteListing);
router.put("/listings/:id/status", requireAuth, updateListingStatus);

// Public listing detail routes.
router.get("/listings/:id", getListing);
router.get("/listings/:id/location-metric", getLocationMetric);
router.get("/listings/:id/nearby", getNearbyPlaces);
router.get("/listings/:id/setup-suggestions", getSetupSuggestions);
router.get("/listings/:id/detail", getListingDetail);

export default router;
