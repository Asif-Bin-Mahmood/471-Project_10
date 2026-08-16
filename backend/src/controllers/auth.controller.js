import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { signToken } from "../utils/auth.js";

const PUBLIC_REGISTRATION_ROLES = new Set([
  "business-owner",
  "property-owner",
  "service-provider"
]);

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeCoverageAreas(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  return cleanText(value).split(",").map(cleanText).filter(Boolean);
}

export async function register(req, res, next) {
  try {
    const name = cleanText(req.body.name);
    const email = cleanText(req.body.email).toLowerCase();
    const phone = cleanText(req.body.phone);
    const password = String(req.body.password || "");
    const role = cleanText(req.body.role) || "business-owner";
    const nid = cleanText(req.body.nid);
    const tradeLicense = cleanText(req.body.tradeLicense);
    const coverageAreas = normalizeCoverageAreas(req.body.coverageAreas);

    if (!PUBLIC_REGISTRATION_ROLES.has(role)) {
      return res.status(403).json({ error: "Public admin registration is not available." });
    }
    if (name.length < 2) return res.status(422).json({ error: "Name must be at least 2 characters." });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(422).json({ error: "A valid email is required." });
    if (phone.length < 7) return res.status(422).json({ error: "A valid phone number is required." });
    if (password.length < 6) return res.status(422).json({ error: "Password must be at least 6 characters." });
    if (role === "property-owner" && (!nid || !tradeLicense)) {
      return res.status(422).json({ error: "Property owners must provide NID and trade license details." });
    }
    if (role === "service-provider" && (!tradeLicense || coverageAreas.length === 0)) {
      return res.status(422).json({ error: "Service providers must provide a trade license and coverage area." });
    }

    const exists = await User.findOne({ email });
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
}

export async function login(req, res, next) {
  try {
    const user = await User.findOne({ email: String(req.body.email || "").toLowerCase() });
    if (!user || !(await user.matchPassword(req.body.password || ""))) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    if (user.status === "suspended") {
      return res.status(403).json({ error: "This account is suspended." });
    }
    res.json({ user, token: signToken(user) });
  } catch (error) {
    next(error);
  }
}

export async function getCurrentUser(req, res, next) {
  try {
    const userId = req.params.id || req.user?._id;
    const user = await User.findById(userId).populate("savedListings");
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ user });
  } catch (error) {
    next(error);
  }
}
