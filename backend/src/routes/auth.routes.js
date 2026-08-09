import express from "express";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { requireAuth, requireSelfOrAdmin, signToken } from "../utils/auth.js";

const router = express.Router();

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, phone, password, role, nid, tradeLicense, coverageAreas } = req.body;
    const exists = await User.findOne({ email: String(email || "").toLowerCase() });
    if (exists) return res.status(409).json({ error: "Email is already registered." });

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: role || "business-owner",
      nid,
      tradeLicense,
      coverageAreas,
      verificationStatus: role === "business-owner" ? "verified" : "pending"
    });

    const admin = await User.findOne({ role: "admin" });
    if (admin && user.verificationStatus === "pending") {
      await Notification.create({
        user: admin._id,
        type: "verification",
        title: "New verification request",
        message: `${user.name} submitted ${user.role} documents.`
      });
    }

    res.status(201).json({ user, token: signToken(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const user = await User.findOne({ email: String(req.body.email || "").toLowerCase() });
    if (!user || !(await user.matchPassword(req.body.password || ""))) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    res.json({ user, token: signToken(user) });
  } catch (error) {
    next(error);
  }
});

router.get("/me/:id", requireAuth, requireSelfOrAdmin("id"), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).populate("savedListings");
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;
