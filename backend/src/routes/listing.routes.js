import express from "express";
import {
  createListing,
  deleteListing,
  getAddressSuggestions,
  getListing,
  getListingDetail,
  getLocationMetric,
  getNearbyPlaces,
  getSetupSuggestions,
  searchListings,
  updateListing,
  updateListingStatus
} from "../controllers/listing.controller.js";
import { requireAuth } from "../utils/auth.js";

const router = express.Router();

router.get("/address-suggestions", getAddressSuggestions);
router.get("/listings", searchListings);
router.get("/listings/search", searchListings);
router.post("/listings", requireAuth, createListing);
router.get("/listings/:id", getListing);
router.put("/listings/:id", requireAuth, updateListing);
router.delete("/listings/:id", requireAuth, deleteListing);
router.put("/listings/:id/status", requireAuth, updateListingStatus);
router.get("/listings/:id/location-metric", getLocationMetric);
router.get("/listings/:id/nearby", getNearbyPlaces);
router.get("/listings/:id/setup-suggestions", getSetupSuggestions);
router.get("/listings/:id/detail", getListingDetail);

export default router;
