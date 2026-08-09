import mongoose from "mongoose";
import ActivityLog from "../models/ActivityLog.js";
import Booking from "../models/Booking.js";
import Conversation from "../models/Conversation.js";
import Listing from "../models/Listing.js";
import Notification from "../models/Notification.js";
import Report from "../models/Report.js";
import Review from "../models/Review.js";
import SupportTicket from "../models/SupportTicket.js";
import SystemSetting from "../models/SystemSetting.js";
import User from "../models/User.js";

function money(value) {
  return Math.round(Number(value || 0));
}

async function databaseCounts() {
  const [users, listings, bookings, conversations, reviews, notifications, reports, tickets, activityLogs, settings] = await Promise.all([
    User.countDocuments(),
    Listing.countDocuments(),
    Booking.countDocuments(),
    Conversation.countDocuments(),
    Review.countDocuments(),
    Notification.countDocuments(),
    Report.countDocuments(),
    SupportTicket.countDocuments(),
    ActivityLog.countDocuments(),
    SystemSetting.countDocuments()
  ]);

  return [
    { name: "users", label: "Users", count: users },
    { name: "listings", label: "Listings", count: listings },
    { name: "bookings", label: "Bookings", count: bookings },
    { name: "conversations", label: "Conversations", count: conversations },
    { name: "reviews", label: "Reviews", count: reviews },
    { name: "notifications", label: "Notifications", count: notifications },
    { name: "reports", label: "Reports", count: reports },
    { name: "supporttickets", label: "Support tickets", count: tickets },
    { name: "activitylogs", label: "Activity logs", count: activityLogs },
    { name: "systemsettings", label: "System settings", count: settings }
  ];
}

export async function getOperationsSummary(req, res, next) {
  try {
    const [
      collections,
      areaDemand,
      categoryMix,
      bookingPipeline,
      ticketPipeline,
      recentActivity,
      tickets,
      settings,
      dbCounts,
      activeProperties,
      availableServices,
      unreadNotifications
    ] = await Promise.all([
      mongoose.connection.db.listCollections().toArray(),
      Listing.aggregate([{ $group: { _id: "$area", count: { $sum: 1 }, avgPrice: { $avg: "$price" } } }, { $sort: { count: -1, avgPrice: -1 } }]),
      Listing.aggregate([{ $group: { _id: "$category", count: { $sum: 1 }, avgPrice: { $avg: "$price" } } }, { $sort: { count: -1 } }]),
      Booking.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      SupportTicket.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      ActivityLog.find().sort({ createdAt: -1 }).limit(8).populate("actor", "name role").lean(),
      SupportTicket.find().sort({ updatedAt: -1 }).limit(6).populate("requester assignedTo", "name role").lean(),
      SystemSetting.find().sort({ category: 1, key: 1 }).populate("updatedBy", "name").lean(),
      databaseCounts(),
      Listing.countDocuments({ listingType: "property", status: "Available", verificationStatus: "verified" }),
      Listing.countDocuments({ listingType: "service", status: "Available", verificationStatus: "verified" }),
      Notification.countDocuments({ read: false })
    ]);

    const totalDocuments = dbCounts.reduce((sum, item) => sum + item.count, 0);
    const pipeline = Object.fromEntries(bookingPipeline.map((item) => [item._id, item.count]));
    const ticketStatus = Object.fromEntries(ticketPipeline.map((item) => [item._id, item.count]));

    res.json({
      database: {
        status: mongoose.connection.readyState === 1 ? "connected" : "not-ready",
        name: mongoose.connection.name,
        collections: collections.length,
        totalDocuments,
        counts: dbCounts
      },
      operations: {
        activeProperties,
        availableServices,
        unreadNotifications,
        conversionRate: pipeline.accepted && pipeline.requested ? Math.round((pipeline.accepted / (pipeline.accepted + pipeline.requested)) * 100) : 100,
        openTickets: ticketStatus.open || 0,
        reviewQueue: await Report.countDocuments({ status: "open" })
      },
      areaDemand: areaDemand.map((item) => ({ area: item._id, count: item.count, avgPrice: money(item.avgPrice) })),
      categoryMix: categoryMix.map((item) => ({ category: item._id, count: item.count, avgPrice: money(item.avgPrice) })),
      bookingPipeline: bookingPipeline.map((item) => ({ status: item._id, count: item.count })),
      ticketPipeline: ticketPipeline.map((item) => ({ status: item._id, count: item.count })),
      recentActivity,
      tickets,
      settings
    });
  } catch (error) {
    next(error);
  }
}

export async function getActivity(req, res, next) {
  try {
    const activity = await ActivityLog.find()
      .sort({ createdAt: -1 })
      .limit(Math.min(30, Number(req.query.limit || 12)))
      .populate("actor", "name role")
      .lean();
    res.json({ activity });
  } catch (error) {
    next(error);
  }
}

export async function getSupportTickets(req, res, next) {
  try {
    const filter = req.user.role === "admin" ? {} : { requester: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    const tickets = await SupportTicket.find(filter).sort({ updatedAt: -1 }).populate("requester assignedTo", "name role").lean();
    res.json({ tickets });
  } catch (error) {
    next(error);
  }
}

export async function createSupportTicket(req, res, next) {
  try {
    const requester = req.user;
    const subject = String(req.body.subject || "").trim();
    const body = String(req.body.message || "").trim();
    if (subject.length < 5 || body.length < 5) {
      return res.status(422).json({ error: "Ticket subject and message must be at least 5 characters." });
    }
    const ticket = await SupportTicket.create({
      requester: requester._id,
      subject,
      category: req.body.category || "technical",
      priority: req.body.priority || "medium",
      messages: [{ sender: requester._id, body }]
    });
    await ActivityLog.create({
      actor: requester._id,
      action: "support.ticket.created",
      entityType: "SupportTicket",
      entityId: ticket._id,
      severity: ticket.priority === "urgent" ? "critical" : "info",
      message: `${requester.name} opened a support ticket.`,
      metadata: { category: ticket.category, priority: ticket.priority }
    });
    await ticket.populate("requester assignedTo", "name role");
    res.status(201).json({ ticket });
  } catch (error) {
    next(error);
  }
}

export async function updateSupportTicket(req, res, next) {
  try {
    const existing = await SupportTicket.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Ticket not found." });
    const isOwner = String(existing.requester) === String(req.user._id);
    if (req.user.role !== "admin" && !isOwner) {
      return res.status(403).json({ error: "You can only update your own support tickets." });
    }

    const update = {};
    const allowedFields = req.user.role === "admin" ? ["status", "priority", "assignedTo"] : ["status"];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    }
    const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, update, { new: true }).populate("requester assignedTo", "name role");
    await ActivityLog.create({
      actor: req.user._id,
      action: "support.ticket.updated",
      entityType: "SupportTicket",
      entityId: ticket._id,
      severity: "success",
      message: `Support ticket moved to ${ticket.status}.`,
      metadata: update
    });
    res.json({ ticket });
  } catch (error) {
    next(error);
  }
}

export async function getSettings(req, res, next) {
  try {
    const settings = await SystemSetting.find().sort({ category: 1, key: 1 }).populate("updatedBy", "name role").lean();
    res.json({ settings });
  } catch (error) {
    next(error);
  }
}

export async function updateSetting(req, res, next) {
  try {
    const setting = await SystemSetting.findOneAndUpdate(
      { key: req.params.key },
      { value: req.body.value, updatedBy: req.user._id },
      { new: true }
    ).populate("updatedBy", "name role");
    if (!setting) return res.status(404).json({ error: "Setting not found." });
    await ActivityLog.create({
      actor: req.user._id,
      action: "settings.updated",
      entityType: "SystemSetting",
      entityId: setting._id,
      severity: "success",
      message: `${setting.label} was updated.`,
      metadata: { key: setting.key, value: setting.value }
    });
    res.json({ setting });
  } catch (error) {
    next(error);
  }
}

export async function getDatabaseOverview(req, res, next) {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const counts = await databaseCounts();
    res.json({
      database: {
        name: mongoose.connection.name,
        status: mongoose.connection.readyState === 1 ? "connected" : "not-ready",
        collections: collections.map((collection) => collection.name).sort(),
        counts
      }
    });
  } catch (error) {
    next(error);
  }
}
