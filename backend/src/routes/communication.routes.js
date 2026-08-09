import express from "express";
import {
  createBooking,
  createConversation,
  createMessage,
  getBookings,
  getConversations,
  getMessages,
  getNotifications,
  markNotificationRead,
  respondToBooking
} from "../controllers/communication.controller.js";
import { requireAuth, requireSelfOrAdmin } from "../utils/auth.js";

const router = express.Router();

router.get("/conversations/:userId", requireAuth, requireSelfOrAdmin("userId"), getConversations);
router.post("/conversations", requireAuth, createConversation);
router.get("/messages/:conversationId", requireAuth, getMessages);
router.post("/messages", requireAuth, createMessage);
router.get("/bookings/:userId", requireAuth, requireSelfOrAdmin("userId"), getBookings);
router.post("/bookings", requireAuth, createBooking);
router.put("/bookings/:id/respond", requireAuth, respondToBooking);
router.get("/notifications/:userId", requireAuth, requireSelfOrAdmin("userId"), getNotifications);
router.put("/notifications/:id/read", requireAuth, markNotificationRead);

export default router;
