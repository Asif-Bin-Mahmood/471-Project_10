import ActivityLog from "../models/ActivityLog.js";
import Booking from "../models/Booking.js";
import Conversation from "../models/Conversation.js";
import Listing from "../models/Listing.js";
import Notification from "../models/Notification.js";
import { emitNewMessage, joinConversationParticipants } from "../realtime/socket.js";
import { sendEmail } from "../services/email.service.js";
import { bookingAcceptedEmail, bookingRequestEmail, newMessageEmail } from "../templates/email.templates.js";
import { canAccessUser } from "../utils/auth.js";

function isConversationParticipant(conversation, userId) {
  return conversation.participants.some((id) => String(id) === String(userId));
}

export async function getConversations(req, res, next) {
  try {
    const conversations = await Conversation.find({ participants: req.params.userId })
      .populate("listing participants messages.sender")
      .sort({ updatedAt: -1 });
    res.json({ conversations });
  } catch (error) {
    next(error);
  }
}

export async function createConversation(req, res, next) {
  try {
    const listing = await Listing.findById(req.body.listingId);
    if (!listing) return res.status(404).json({ error: "Listing not found." });
    const requester = req.user;
    if (String(listing.owner) === String(requester._id)) {
      return res.status(422).json({ error: "You cannot start a conversation with your own listing." });
    }
    let conversation = await Conversation.findOne({
      listing: listing._id,
      participants: { $all: [requester._id, listing.owner] }
    });
    if (!conversation) {
      conversation = await Conversation.create({
        listing: listing._id,
        participants: [requester._id, listing.owner],
        subject: `${listing.title} inquiry`,
        messages: []
      });
    }
    await conversation.populate("listing participants messages.sender");
    joinConversationParticipants(req.app.get("io"), conversation);
    res.status(201).json({ conversation });
  } catch (error) {
    next(error);
  }
}

export async function getMessages(req, res, next) {
  try {
    const conversation = await Conversation.findById(req.params.conversationId).populate("messages.sender");
    if (!conversation) return res.status(404).json({ error: "Conversation not found." });
    if (req.user.role !== "admin" && !isConversationParticipant(conversation, req.user._id)) {
      return res.status(403).json({ error: "You can only read messages from your own conversations." });
    }
    res.json({ messages: conversation.messages });
  } catch (error) {
    next(error);
  }
}

export async function createMessage(req, res, next) {
  try {
    const conversation = await Conversation.findById(req.body.conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found." });
    if (req.user.role !== "admin" && !isConversationParticipant(conversation, req.user._id)) {
      return res.status(403).json({ error: "You can only send messages in your own conversations." });
    }
    const body = String(req.body.message || req.body.body || "").trim();
    if (body.length < 1) return res.status(422).json({ error: "Message body is required." });
    conversation.messages.push({
      sender: req.user._id,
      body,
      readBy: [req.user._id]
    });
    await conversation.save();
    await Notification.insertMany(
      conversation.participants
        .filter((id) => String(id) !== String(req.user._id))
        .map((user) => ({
          user,
          type: "message",
          title: "New message",
          message: body,
          channel: "email"
        }))
    );
    await ActivityLog.create({
      actor: req.user._id,
      action: "message.sent",
      entityType: "Conversation",
      entityId: conversation._id,
      severity: "info",
      message: "A new message was sent.",
      metadata: { subject: conversation.subject }
    });
    await conversation.populate("listing participants messages.sender");
    const message = conversation.messages.at(-1);
    for (const recipient of conversation.participants.filter((participant) => String(participant._id) !== String(req.user._id))) {
      try {
        await sendEmail({
          to: recipient.email,
          ...newMessageEmail({
            recipientName: recipient.name,
            senderName: req.user.name,
            conversationSubject: conversation.subject,
            body
          }),
          event: "inquiry.message"
        });
      } catch (emailError) {
        console.error(`[email] inquiry.message failed: ${emailError.message}`);
      }
    }
    emitNewMessage(req.app.get("io"), conversation._id, message);
    res.status(201).json({ conversation, message });
  } catch (error) {
    next(error);
  }
}

export async function getBookings(req, res, next) {
  try {
    const bookings = await Booking.find({
      $or: [{ requester: req.params.userId }, { receiver: req.params.userId }]
    }).populate("listing requester receiver").sort({ createdAt: -1 });
    res.json({ bookings });
  } catch (error) {
    next(error);
  }
}

export async function createBooking(req, res, next) {
  try {
    const listing = await Listing.findById(req.body.listingId);
    if (!listing) return res.status(404).json({ error: "Listing not found." });
    const requester = req.user;
    if (String(listing.owner) === String(requester._id)) {
      return res.status(422).json({ error: "You cannot book your own listing." });
    }
    const booking = await Booking.create({
      listing: listing._id,
      requester: requester._id,
      receiver: listing.owner,
      requestType: req.body.requestType || (listing.listingType === "property" ? "visit" : "service-booking"),
      proposedAt: req.body.proposedAt || new Date(),
      notes: req.body.notes,
      history: [{ status: "requested", by: requester._id }]
    });
    await Notification.create({
      user: listing.owner,
      type: "booking",
      title: "New booking request",
      message: `${requester.name} requested ${listing.title}.`,
      channel: "email"
    });
    await ActivityLog.create({
      actor: requester._id,
      action: "booking.requested",
      entityType: "Booking",
      entityId: booking._id,
      severity: "success",
      message: `${requester.name} requested ${listing.title}.`,
      metadata: { requestType: booking.requestType, listing: listing.title }
    });
    await booking.populate("listing requester receiver");
    try {
      await sendEmail({
        to: booking.receiver?.email,
        ...bookingRequestEmail({
          recipientName: booking.receiver?.name,
          requesterName: requester.name,
          listingTitle: booking.listing?.title || listing.title,
          requestType: booking.requestType,
          proposedAt: booking.proposedAt,
          notes: booking.notes
        }),
        event: "booking.requested"
      });
    } catch (emailError) {
      console.error(`[email] booking.requested failed: ${emailError.message}`);
    }
    res.status(201).json({ booking });
  } catch (error) {
    next(error);
  }
}

export async function respondToBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: "Booking not found." });
    if (req.user.role !== "admin" && String(booking.receiver) !== String(req.user._id)) {
      return res.status(403).json({ error: "Only the listing owner or an admin can respond to this booking." });
    }
    booking.status = req.body.status || "accepted";
    if (req.body.alternateAt) booking.alternateAt = req.body.alternateAt;
    booking.history.push({ status: booking.status, by: req.user._id });
    await booking.save();
    await Notification.create({
      user: booking.requester,
      type: "booking",
      title: `Booking ${booking.status}`,
      message: `Your request is ${booking.status}.`,
      channel: "email"
    });
    await ActivityLog.create({
      actor: req.user._id,
      action: "booking.responded",
      entityType: "Booking",
      entityId: booking._id,
      severity: booking.status === "accepted" ? "success" : "warning",
      message: `Booking status changed to ${booking.status}.`,
      metadata: { status: booking.status }
    });
    await booking.populate("listing requester receiver");
    if (booking.status === "accepted") {
      try {
        await sendEmail({
          to: booking.requester?.email,
          ...bookingAcceptedEmail({
            recipientName: booking.requester?.name,
            listingTitle: booking.listing?.title || "your OfficeKhoj listing",
            proposedAt: booking.proposedAt,
            alternateAt: booking.alternateAt
          }),
          event: "booking.accepted"
        });
      } catch (emailError) {
        console.error(`[email] booking.accepted failed: ${emailError.message}`);
      }
    }
    res.json({ booking });
  } catch (error) {
    next(error);
  }
}

export async function getNotifications(req, res, next) {
  try {
    const filter = { user: req.params.userId };
    if (req.query.type) filter.type = req.query.type;
    const notifications = await Notification.find(filter).sort({ createdAt: -1 });
    res.json({ notifications });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ error: "Notification not found." });
    if (!canAccessUser(req, notification.user)) {
      return res.status(403).json({ error: "You can only update your own notifications." });
    }
    notification.read = true;
    await notification.save();
    res.json({ notification });
  } catch (error) {
    next(error);
  }
}
