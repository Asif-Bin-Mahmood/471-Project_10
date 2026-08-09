import express from "express";
import { addFavorite, getFavorites, getProfile, removeFavorite, updateProfile } from "../controllers/user.controller.js";
import { requireAuth, requireSelfOrAdmin } from "../utils/auth.js";

const router = express.Router();

router.get("/profile/:id", requireAuth, requireSelfOrAdmin("id"), getProfile);
router.put("/profile/:id", requireAuth, requireSelfOrAdmin("id"), updateProfile);
router.get("/favorites/:userId", requireAuth, requireSelfOrAdmin("userId"), getFavorites);
router.post("/favorites/:userId/:listingId", requireAuth, requireSelfOrAdmin("userId"), addFavorite);
router.delete("/favorites/:userId/:listingId", requireAuth, requireSelfOrAdmin("userId"), removeFavorite);

export default router;
