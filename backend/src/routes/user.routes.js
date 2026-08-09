import express from "express";
import User from "../models/User.js";
import { requireAuth, requireSelfOrAdmin } from "../utils/auth.js";

const router = express.Router();

router.get("/profile/:id", requireAuth, requireSelfOrAdmin("id"), async (req, res, next) => {
  try {
    const profile = await User.findById(req.params.id).populate("savedListings");
    if (!profile) return res.status(404).json({ error: "Profile not found." });
    res.json({ profile });
  } catch (error) {
    next(error);
  }
});

router.put("/profile/:id", requireAuth, requireSelfOrAdmin("id"), async (req, res, next) => {
  try {
    const fields = ["businessType", "preferredArea", "budgetMin", "budgetMax", "minSize", "serviceNeed"];
    const update = Object.fromEntries(fields.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]]));
    const profile = await User.findByIdAndUpdate(req.params.id, update, { new: true }).populate("savedListings");
    if (!profile) return res.status(404).json({ error: "Profile not found." });
    res.json({ profile });
  } catch (error) {
    next(error);
  }
});

router.get("/favorites/:userId", requireAuth, requireSelfOrAdmin("userId"), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).populate("savedListings");
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ favorites: user.savedListings });
  } catch (error) {
    next(error);
  }
});

router.post("/favorites/:userId/:listingId", requireAuth, requireSelfOrAdmin("userId"), async (req, res, next) => {
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
});

router.delete("/favorites/:userId/:listingId", requireAuth, requireSelfOrAdmin("userId"), async (req, res, next) => {
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
});

export default router;
