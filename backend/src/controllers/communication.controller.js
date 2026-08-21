import ActivityLog from "../models/ActivityLog.js";
import Booking from "../models/Booking.js";
import Conversation from "../models/Conversation.js";
import Listing from "../models/Listing.js";
import Notification from "../models/Notification.js";
import { emitBookingUpdate, emitMessagesRead, emitNewMessage, joinConversationParticipants } from "../realtime/socket.js";
import { uploadCloudinaryMessageAttachment } from "../services/cloudinaryStorage.service.js";
import { sendEmail } from "../services/email.service.js";
import { bookingAcceptedEmail, bookingRequestEmail, newMessageEmail } from "../templates/email.templates.js";
import { canAccessUser } from "../utils/auth.js";

function isConversationParticipant(conversation, userId) {
  return conversation.participants.some((id) => String(id) === String(userId));
}

const BOOKING_RESPONSE_STATUSES = new Set(["accepted", "declined", "alternate-proposed", "completed"]);

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function decodedFileName(headerValue) {
  if (!headerValue) return "attachment";
  try {
    return decodeURIComponent(headerValue);
  } catch {
    return String(headerValue);
  }
}

function safeAttachmentUrl(value, kind) {
  try {
    const url = new URL(String(value || ""));
    const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim().toLowerCase();
    const expectedFolder = `/officekhoj/message-${kind}/`;
    const belongsToProject = url.pathname.toLowerCase().startsWith(`/${cloudName}/`) && url.pathname.includes(expectedFolder);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com" && cloudName && belongsToProject
      ? url.toString()
      : "";
  } catch {
    return "";
  }
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
    const newlyRead = [];
    for (const message of conversation.messages) {
      const senderId = message.sender?._id || message.sender;
      const alreadyRead = (message.readBy || []).some((reader) => String(reader) === String(req.user._id));
      if (String(senderId) !== String(req.user._id) && !alreadyRead) {
        message.readBy.addToSet(req.user._id);
        newlyRead.push(message._id);
      }
    }
    if (newlyRead.length) {
      await conversation.save();
      emitMessagesRead(req.app.get("io"), conversation._id, newlyRead, req.user._id);
    }
    res.json({ messages: conversation.messages });
  } catch (error) {
    next(error);
  }
}

export async function uploadMessageAttachment(req, res, next) {
  try {
    const kind = String(req.get("x-attachment-kind") || "").trim().toLowerCase();
    if (!["image", "audio"].includes(kind)) {
      return res.status(422).json({ error: "Attachment type must be image or audio." });
    }
    const conversation = await Conversation.findById(req.get("x-conversation-id")).select("participants");
    if (!conversation) return res.status(404).json({ error: "Conversation not found." });
    if (req.user.role !== "admin" && !isConversationParticipant(conversation, req.user._id)) {
      return res.status(403).json({ error: "You can only upload attachments to your own conversations." });
    }
    const attachment = await uploadCloudinaryMessageAttachment({
      buffer: req.body,
      contentType: String(req.get("content-type") || "").split(";")[0].trim().toLowerCase(),
      originalName: decodedFileName(req.get("x-file-name")),
      ownerId: req.user._id,
      kind
    });
    res.status(201).json({ attachment });
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
    const requestedKind = String(req.body.kind || "text").trim().toLowerCase();
    const kind = ["image", "audio"].includes(requestedKind) ? requestedKind : "text";
    const attachmentUrl = safeAttachmentUrl(req.body.attachmentUrl, kind);
    if (!body && !attachmentUrl) return res.status(422).json({ error: "Write a message or attach a file." });
    if (kind !== "text" && !attachmentUrl) return res.status(422).json({ error: "Upload the attachment before sending." });
    if (body.length > 4000) return res.status(422).json({ error: "Messages can contain up to 4,000 characters." });
    conversation.messages.push({
      sender: req.user._id,
      body,
      kind: attachmentUrl ? kind : "text",
      attachmentUrl,
      attachmentName: attachmentUrl ? String(req.body.attachmentName || "").trim().slice(0, 180) : "",
      attachmentMimeType: attachmentUrl ? String(req.body.attachmentMimeType || "").trim().slice(0, 100) : "",
      attachmentSize: attachmentUrl ? Math.max(0, Number(req.body.attachmentSize) || 0) : 0,
      durationSeconds: kind === "audio" ? Math.min(600, Math.max(0, Number(req.body.durationSeconds) || 0)) : 0,
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
          message: body || (kind === "image" ? "Sent an image." : "Sent a voice message."),
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
            body: body || (kind === "image" ? "Sent an image." : "Sent a voice message.")
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
    if (listing.status !== "Available") {
      return res.status(422).json({ error: "This listing is not currently available for booking." });
    }

    const expectedRequestType = listing.listingType === "property" ? "visit" : "service-booking";
    if (req.body.requestType && req.body.requestType !== expectedRequestType) {
      return res.status(422).json({ error: `This listing requires a ${expectedRequestType} request.` });
    }

    if (!req.body.proposedAt) {
      return res.status(422).json({ error: "A proposed date and time is required." });
    }
    const proposedAt = validDate(req.body.proposedAt);
    if (!proposedAt || proposedAt.getTime() <= Date.now()) {
      return res.status(422).json({ error: "Choose a valid future date and time." });
    }

    const activeBooking = await Booking.findOne({
      listing: listing._id,
      requester: requester._id,
      status: { $in: ["requested", "accepted", "alternate-proposed"] }
    }).select("_id status");
    if (activeBooking) {
      return res.status(409).json({
        error: "You already have an active request for this listing. Wait for it to be completed or declined before booking again."
      });
    }

    const booking = await Booking.create({
      listing: listing._id,
      requester: requester._id,
      receiver: listing.owner,
      requestType: expectedRequestType,
      proposedAt,
      notes: String(req.body.notes || "").trim(),
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
    emitBookingUpdate(req.app.get("io"), booking, "created");
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

    const nextStatus = String(req.body.status || "").trim();
    if (!BOOKING_RESPONSE_STATUSES.has(nextStatus)) {
      return res.status(422).json({ error: "Choose accept, decline, alternate time, or complete." });
    }

    const allowedTransitions = {
      requested: new Set(["accepted", "declined", "alternate-proposed"]),
      "alternate-proposed": new Set(["accepted", "declined", "alternate-proposed"]),
      accepted: new Set(["completed", "declined", "alternate-proposed"]),
      declined: new Set(),
      completed: new Set()
    };
    if (!allowedTransitions[booking.status]?.has(nextStatus)) {
      return res.status(409).json({
        error: `A ${booking.status} booking cannot be changed to ${nextStatus}.`
      });
    }

    if (nextStatus === "alternate-proposed") {
      const alternateAt = validDate(req.body.alternateAt);
      if (!alternateAt || alternateAt.getTime() <= Date.now()) {
        return res.status(422).json({ error: "A valid future alternate date and time is required." });
      }
      booking.alternateAt = alternateAt;
    }

    booking.status = nextStatus;
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
    emitBookingUpdate(req.app.get("io"), booking, "status-changed");
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
