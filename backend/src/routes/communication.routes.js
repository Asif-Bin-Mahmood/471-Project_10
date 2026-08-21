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
  respondToBooking,
  uploadMessageAttachment
} from "../controllers/communication.controller.js";
import { requireAuth, requireRole, requireSelfOrAdmin } from "../utils/auth.js";

const router = express.Router();

router.get("/conversations/:userId", requireAuth, requireSelfOrAdmin("userId"), getConversations);
router.post("/conversations", requireAuth, requireRole("business-owner"), createConversation);
router.get("/messages/:conversationId", requireAuth, getMessages);
router.post("/messages", requireAuth, createMessage);
router.post(
  "/uploads/message-attachment",
  requireAuth,
  express.raw({
    type: ["image/jpeg", "image/png", "image/webp", "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav"],
    limit: "12mb"
  }),
  uploadMessageAttachment
);
router.get("/bookings/:userId", requireAuth, requireSelfOrAdmin("userId"), getBookings);
router.post("/bookings", requireAuth, requireRole("business-owner"), createBooking);
router.put("/bookings/:id/respond", requireAuth, respondToBooking);
router.get("/notifications/:userId", requireAuth, requireSelfOrAdmin("userId"), getNotifications);
router.put("/notifications/:id/read", requireAuth, markNotificationRead);

export default router;
