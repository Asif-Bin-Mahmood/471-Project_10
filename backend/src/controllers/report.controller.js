import ActivityLog from "../models/ActivityLog.js";
import Listing from "../models/Listing.js";
import Notification from "../models/Notification.js";
import Report from "../models/Report.js";
import User from "../models/User.js";

const REPORT_STATUSES = new Set(["resolved", "dismissed"]);
const RESOLUTION_ACTIONS = new Set(["resolved", "dismissed", "target-removed"]);

function validObjectId(value) {
  return /^[a-f\d]{24}$/i.test(String(value || ""));
}

export async function attachReportTargets(reportDocuments) {
  const reports = reportDocuments.map((report) => (
    typeof report.toObject === "function" ? report.toObject() : report
  ));
  const listingIds = reports.filter((report) => report.targetType === "listing").map((report) => report.targetId);
  const userIds = reports.filter((report) => report.targetType === "user").map((report) => report.targetId);
  const [listings, users] = await Promise.all([
    Listing.find({ _id: { $in: listingIds } }).populate("owner", "name email role verificationStatus status").lean(),
    User.find({ _id: { $in: userIds } }).select("name email role verificationStatus status tradeLicense nid").lean()
  ]);
  const listingMap = new Map(listings.map((listing) => [String(listing._id), listing]));
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return reports.map((report) => ({
    ...report,
    target: report.targetType === "listing"
      ? listingMap.get(String(report.targetId)) || null
      : userMap.get(String(report.targetId)) || null
  }));
}

export async function createReport(req, res, next) {
  try {
    const targetType = String(req.body.targetType || "").trim();
    const targetId = String(req.body.targetId || "").trim();
    const reason = String(req.body.reason || "").trim();

    if (!new Set(["listing", "user"]).has(targetType)) {
      return res.status(422).json({ error: "Report target must be a listing or user." });
    }
    if (!validObjectId(targetId)) return res.status(400).json({ error: "Invalid report target." });
    if (reason.length < 5 || reason.length > 500) {
      return res.status(422).json({ error: "Report reason must be between 5 and 500 characters." });
    }

    const target = targetType === "listing"
      ? await Listing.findById(targetId)
      : await User.findById(targetId).select("name role");
    if (!target) return res.status(404).json({ error: "Reported target was not found." });

    const targetOwnerId = targetType === "listing" ? target.owner : target._id;
    if (String(targetOwnerId) === String(req.user._id)) {
      return res.status(422).json({ error: "You cannot report your own listing or account." });
    }

    const duplicate = await Report.findOne({
      reporter: req.user._id,
      targetType,
      targetId,
      status: "open"
    });
    if (duplicate) return res.status(409).json({ error: "You already have an open report for this target." });

    const report = await Report.create({ reporter: req.user._id, targetType, targetId, reason });
    const admins = await User.find({ role: "admin", status: "active" }).select("_id");
    if (admins.length) {
      await Notification.insertMany(admins.map((admin) => ({
        user: admin._id,
        type: "system",
        title: "New content report",
        message: `${req.user.name} reported a ${targetType}.`,
        channel: "in-app"
      })));
    }
    await ActivityLog.create({
      actor: req.user._id,
      action: "report.created",
      entityType: "Report",
      entityId: report._id,
      severity: "warning",
      message: `${req.user.name} reported a ${targetType}.`,
      metadata: { targetType, targetId }
    });

    await report.populate("reporter", "name email role");
    const [result] = await attachReportTargets([report]);
    res.status(201).json({ report: result });
  } catch (error) {
    next(error);
  }
}

export async function updateReportStatus(req, res, next) {
  try {
    const status = String(req.body.status || "").trim();
    const resolutionAction = String(req.body.resolutionAction || status).trim();
    if (!REPORT_STATUSES.has(status) || !RESOLUTION_ACTIONS.has(resolutionAction)) {
      return res.status(422).json({ error: "Choose a valid report resolution." });
    }
    if ((status === "dismissed" && resolutionAction !== "dismissed") ||
        (status === "resolved" && !["resolved", "target-removed"].includes(resolutionAction))) {
      return res.status(422).json({ error: "Report status and resolution action do not match." });
    }

    const report = await Report.findById(req.params.id).populate("reporter", "name email role");
    if (!report) return res.status(404).json({ error: "Report not found." });
    report.status = status;
    report.resolutionAction = resolutionAction;
    report.resolvedBy = req.user._id;
    report.resolvedAt = new Date();
    await report.save();

    await ActivityLog.create({
      actor: req.user._id,
      action: "report.moderated",
      entityType: "Report",
      entityId: report._id,
      severity: status === "resolved" ? "success" : "info",
      message: `Report marked ${status}.`,
      metadata: { resolutionAction }
    });

    const [result] = await attachReportTargets([report]);
    res.json({ report: result });
  } catch (error) {
    next(error);
  }
}
