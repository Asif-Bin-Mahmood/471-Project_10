import express from "express";
import { createReport, updateReportStatus } from "../controllers/report.controller.js";
import { requireAuth, requireRole } from "../utils/auth.js";

const router = express.Router();

router.post("/reports", requireAuth, createReport);
router.put("/admin/reports/:id", requireAuth, requireRole("admin"), updateReportStatus);

export default router;
