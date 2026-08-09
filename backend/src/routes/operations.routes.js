import express from "express";
import {
  createSupportTicket,
  getActivity,
  getDatabaseOverview,
  getOperationsSummary,
  getSettings,
  getSupportTickets,
  updateSetting,
  updateSupportTicket
} from "../controllers/operations.controller.js";
import { requireAuth, requireRole } from "../utils/auth.js";

const router = express.Router();

router.get("/operations/summary", requireAuth, getOperationsSummary);
router.get("/activity", requireAuth, requireRole("admin"), getActivity);
router.get("/support/tickets", requireAuth, getSupportTickets);
router.post("/support/tickets", requireAuth, createSupportTicket);
router.put("/support/tickets/:id", requireAuth, updateSupportTicket);
router.get("/settings", requireAuth, requireRole("admin"), getSettings);
router.put("/settings/:key", requireAuth, requireRole("admin"), updateSetting);
router.get("/database/overview", requireAuth, requireRole("admin"), getDatabaseOverview);

export default router;
