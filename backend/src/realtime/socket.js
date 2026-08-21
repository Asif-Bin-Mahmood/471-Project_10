import jwt from "jsonwebtoken";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import { getJwtSecret } from "../utils/auth.js";

function conversationRoom(conversationId) {
  return `conversation:${conversationId}`;
}

function userRoom(userId) {
  return `user:${userId}`;
}

function acknowledge(callback, payload) {
  if (typeof callback === "function") callback(payload);
}

export function configureSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication token is required."));

      const payload = jwt.verify(token, getJwtSecret());
      const user = await User.findById(payload.id).select("_id name role status");
      if (!user) return next(new Error("Authenticated user was not found."));
      if (user.status === "suspended") return next(new Error("This account is suspended."));

      socket.data.user = user;
      socket.join(userRoom(user._id));

      const conversations = await Conversation.find({ participants: user._id }).select("_id");
      conversations.forEach((conversation) => socket.join(conversationRoom(conversation._id)));
      next();
    } catch (error) {
      next(new Error("Invalid or expired authentication token."));
    }
  });

  io.on("connection", (socket) => {
    socket.on("conversation:join", async (payload, callback) => {
      try {
        const conversationId = typeof payload === "object" ? payload?.conversationId : payload;
        if (!conversationId) {
          return acknowledge(callback, { ok: false, error: "Conversation ID is required." });
        }

        const conversation = await Conversation.findById(conversationId).select("participants");
        if (!conversation) {
          return acknowledge(callback, { ok: false, error: "Conversation not found." });
        }

        const user = socket.data.user;
        const isParticipant = conversation.participants.some(
          (participantId) => String(participantId) === String(user._id)
        );
        if (user.role !== "admin" && !isParticipant) {
          return acknowledge(callback, { ok: false, error: "You cannot join this conversation." });
        }

        const room = conversationRoom(conversation._id);
        socket.join(room);
        acknowledge(callback, { ok: true, conversationId: String(conversation._id) });
      } catch (error) {
        acknowledge(callback, { ok: false, error: "Unable to join conversation." });
      }
    });
  });
}

export function joinConversationParticipants(io, conversation) {
  if (!io || !conversation) return;
  const room = conversationRoom(conversation._id);
  conversation.participants.forEach((participant) => {
    io.in(userRoom(participant?._id || participant)).socketsJoin(room);
  });
}

export function emitNewMessage(io, conversationId, message) {
  if (!io || !message) return;
  io.to(conversationRoom(conversationId)).emit("message:new", {
    conversationId: String(conversationId),
    message: {
      _id: String(message._id),
      sender: {
        _id: String(message.sender?._id || message.sender),
        name: message.sender?.name || "User",
        role: message.sender?.role || "user"
      },
      body: message.body,
      kind: message.kind || "text",
      attachmentUrl: message.attachmentUrl || "",
      attachmentName: message.attachmentName || "",
      attachmentMimeType: message.attachmentMimeType || "",
      attachmentSize: message.attachmentSize || 0,
      durationSeconds: message.durationSeconds || 0,
      readBy: (message.readBy || []).map((reader) => String(reader?._id || reader)),
      createdAt: message.createdAt
    }
  });
}

export function emitMessagesRead(io, conversationId, messageIds, readerId) {
  if (!io || !messageIds?.length || !readerId) return;
  io.to(conversationRoom(conversationId)).emit("message:read", {
    conversationId: String(conversationId),
    messageIds: messageIds.map(String),
    readerId: String(readerId)
  });
}

export function emitBookingUpdate(io, booking, action = "updated") {
  if (!io || !booking) return;

  const payload = booking.toObject ? booking.toObject() : booking;
  const requesterId = payload.requester?._id || payload.requester;
  const receiverId = payload.receiver?._id || payload.receiver;
  const rooms = [requesterId, receiverId]
    .filter(Boolean)
    .map((userId) => userRoom(userId));

  if (!rooms.length) return;

  let target = io.to(rooms[0]);
  rooms.slice(1).forEach((room) => {
    target = target.to(room);
  });

  target.emit("booking:updated", {
    action,
    booking: payload
  });
}
