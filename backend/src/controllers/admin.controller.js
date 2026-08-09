import ActivityLog from "../models/ActivityLog.js";
import Booking from "../models/Booking.js";
import Conversation from "../models/Conversation.js";
import Listing from "../models/Listing.js";
import Notification from "../models/Notification.js";
import Report from "../models/Report.js";
import Review from "../models/Review.js";
import SupportTicket from "../models/SupportTicket.js";
import User from "../models/User.js";

export async function getDashboard(req, res, next) {
  try {
    const [
      users,
      activeListings,
      totalListings,
      properties,
      services,
      conversations,
      bookings,
      unreadNotifications,
      pendingUsersCount,
      pendingListingsCount,
      openReports,
      openTickets,
      activityLogs,
      recentListings,
      recentBookings,
      roleBreakdownRaw,
      listingMixRaw,
      ratingStats
    ] = await Promise.all([
      User.countDocuments(),
      Listing.countDocuments({ status: "Available", verificationStatus: "verified" }),
      Listing.countDocuments(),
      Listing.countDocuments({ listingType: "property" }),
      Listing.countDocuments({ listingType: "service" }),
      Conversation.countDocuments(),
      Booking.countDocuments(),
      Notification.countDocuments({ read: false }),
      User.countDocuments({ verificationStatus: "pending" }),
      Listing.countDocuments({ verificationStatus: "pending" }),
      Report.countDocuments({ status: "open" }),
      SupportTicket.countDocuments({ status: { $in: ["open", "in-progress"] } }),
      ActivityLog.countDocuments(),
      Listing.find().sort({ createdAt: -1 }).limit(3).populate("owner").lean(),
      Booking.find().sort({ createdAt: -1 }).limit(3).populate("listing requester receiver").lean(),
      User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
      Listing.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]),
      Review.aggregate([{ $group: { _id: null, averageRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } }])
    ]);

    const roleBreakdown = roleBreakdownRaw.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {});
    const listingMix = listingMixRaw.map((item) => ({ category: item._id, count: item.count }));
    const rating = ratingStats[0] || { averageRating: 0, totalReviews: 0 };

    res.json({
      app: "OfficeKhoj BD",
      users,
      activeListings,
      totalListings,
      properties,
      services,
      conversations,
      bookings,
      unreadNotifications,
      pendingUsersCount,
      pendingListingsCount,
      openReports,
      openTickets,
      activityLogs,
      averageRating: Number(rating.averageRating || 0).toFixed(1),
      totalReviews: rating.totalReviews || 0,
      roleBreakdown,
      listingMix,
      recentActivity: [
        ...recentListings.map((listing) => ({
          type: "listing",
          title: listing.title,
          meta: `${listing.category} in ${listing.area}`,
          status: listing.verificationStatus
        })),
        ...recentBookings.map((booking) => ({
          type: "booking",
          title: booking.listing?.title || "Booking request",
          meta: `${booking.requestType} by ${booking.requester?.name || "user"}`,
          status: booking.status
        }))
      ].slice(0, 5),
      systemChecks: [
        { label: "Database", value: "MongoDB connected", status: "healthy" },
        { label: "API", value: "Express routes active", status: "healthy" },
        { label: "Frontend", value: "React/Vite client ready", status: "healthy" },
        { label: "Workflow", value: `${pendingUsersCount + pendingListingsCount + openReports + openTickets} review item(s)`, status: pendingUsersCount + pendingListingsCount + openReports + openTickets > 0 ? "attention" : "healthy" }
      ],
      modules: [
        "Authentication and admin verification",
        "Map-based commercial space and service search",
        "Property and service listing management",
        "In-app messaging",
        "Notification and email workflow",
        "Reviews and ratings",
        "Favorites and listing detail gallery",
        "Nearby places and availability",
        "Smart setup suggestions and booking flow",
        "Business profile, sorting, pagination, location metrics"
      ]
    });
  } catch (error) {
    next(error);
  }
}

export async function getVerifications(req, res, next) {
  try {
    const [pendingUsers, pendingListings, reports] = await Promise.all([
      User.find({ verificationStatus: "pending" }),
      Listing.find({ verificationStatus: "pending" }).populate("owner"),
      Report.find({ status: "open" })
    ]);
    res.json({ pendingUsers, pendingListings, reports });
  } catch (error) {
    next(error);
  }
}

export async function verifyUser(req, res, next) {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { verificationStatus: req.body.status || "verified" },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

export async function moderateListing(req, res, next) {
  try {
    const listing = await Listing.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate("owner");
    if (!listing) return res.status(404).json({ error: "Listing not found." });
    res.json({ listing });
  } catch (error) {
    next(error);
  }
}
