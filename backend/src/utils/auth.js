import jwt from "jsonwebtoken";
import User from "../models/User.js";

export function getJwtSecret() {
  return process.env.JWT_SECRET || "officekhoj_cse471_secret";
}

export function signToken(user) {
  return jwt.sign(
    {
      id: user._id,
      role: user.role
    },
    getJwtSecret(),
    { expiresIn: "7d" }
  );
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.get("authorization") || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Authentication token is required." });
    }

    const payload = jwt.verify(token, getJwtSecret());
    const user = await User.findById(payload.id).select("-password");
    if (!user) return res.status(401).json({ error: "Authenticated user was not found." });
    if (user.status === "suspended") return res.status(403).json({ error: "This account is suspended." });

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired authentication token." });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Authentication token is required." });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }
    next();
  };
}

export function requireSelfOrAdmin(paramName = "id") {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Authentication token is required." });
    if (req.user.role === "admin" || String(req.user._id) === String(req.params[paramName])) return next();
    return res.status(403).json({ error: "You can only access your own account data." });
  };
}

export function canAccessUser(req, userId) {
  return req.user?.role === "admin" || String(req.user?._id) === String(userId);
}

export function canManageDocument(req, ownerId) {
  return req.user?.role === "admin" || String(req.user?._id) === String(ownerId);
}
