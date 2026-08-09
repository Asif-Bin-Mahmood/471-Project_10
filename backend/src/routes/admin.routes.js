import express from "express";
import { getDashboard, getVerifications, moderateListing, verifyUser } from "../controllers/admin.controller.js";
import { requireAuth, requireRole } from "../utils/auth.js";

const router = express.Router();

router.get("/dashboard", requireAuth, getDashboard);
router.get("/admin/verifications", requireAuth, requireRole("admin"), getVerifications);
router.put("/admin/users/:id/verify", requireAuth, requireRole("admin"), verifyUser);
router.put("/admin/listings/:id/moderate", requireAuth, requireRole("admin"), moderateListing);

export default router;
