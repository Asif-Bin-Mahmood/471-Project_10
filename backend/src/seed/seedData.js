import "dotenv/config";
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
import { connectDB } from "../config/db.js";
import { seedUsers } from "./seedSource.js";

await connectDB(process.env.MONGODB_URI);

await Promise.all([
  User.deleteMany({}),
  Listing.deleteMany({}),
  Review.deleteMany({}),
  Conversation.deleteMany({}),
  Notification.deleteMany({}),
  Booking.deleteMany({}),
  Report.deleteMany({}),
  ActivityLog.deleteMany({}),
  SupportTicket.deleteMany({}),
  SystemSetting.deleteMany({})
]);

const users = {};
for (const user of seedUsers) {
  const { key, ...data } = user;
  users[key] = await User.create(data);
}

const listings = await Listing.insertMany([
  {
    owner: users.property._id,
    title: "Roadside Retail Shop",
    listingType: "property",
    category: "Shop",
    area: "Banani",
    address: "Road 11, Banani, Dhaka",
    location: { lat: 23.794, lng: 90.4056 },
    price: 90000,
    size: 650,
    facilities: ["Glass frontage", "Washroom", "Road access"],
    photos: ["retail-front.jpg", "retail-floor.jpg"],
    status: "Available",
    verificationStatus: "verified",
    rating: 4.7,
    reviewCount: 18,
    description: "Compact roadside retail space with glass frontage and high foot traffic."
  },
  {
    owner: users.service._id,
    title: "Interior Fit-Out Package",
    listingType: "service",
    category: "Interior",
    area: "Gulshan",
    coverageAreas: ["Banani", "Gulshan", "Mohakhali"],
    address: "Gulshan 1 Circle, Dhaka",
    location: { lat: 23.7806, lng: 90.4169 },
    price: 45000,
    facilities: ["Layout planning", "Furniture sourcing", "Lighting plan"],
    photos: ["portfolio-1.jpg", "portfolio-2.jpg"],
    status: "Available",
    verificationStatus: "verified",
    rating: 4.6,
    reviewCount: 18,
    description: "Workspace planning, false ceiling, wall treatment, furniture sourcing, and setup supervision."
  },
  {
    owner: users.service._id,
    title: "Business Internet Setup",
    listingType: "service",
    category: "ISP",
    area: "Banani",
    coverageAreas: ["Banani", "Gulshan", "Uttara"],
    address: "Chairman Bari Road, Banani, Dhaka",
    location: { lat: 23.7898, lng: 90.401 },
    price: 12000,
    facilities: ["Router placement", "Cabling", "Business support"],
    photos: ["isp-rack.jpg"],
    status: "Available",
    verificationStatus: "verified",
    rating: 4.8,
    reviewCount: 26,
    description: "Office internet setup with router placement, cabling, and business support."
  },
  {
    owner: users.property._id,
    title: "Small Office Floor",
    listingType: "property",
    category: "Office",
    area: "Gulshan",
    address: "Gulshan Avenue, Dhaka",
    location: { lat: 23.7898, lng: 90.4193 },
    price: 135000,
    size: 1050,
    facilities: ["Lift", "Generator", "Parking"],
    photos: ["office-floor.jpg"],
    status: "Available",
    verificationStatus: "verified",
    rating: 4.3,
    reviewCount: 9,
    description: "Ready commercial office floor suitable for a compact team or agency."
  },
  {
    owner: users.pendingService._id,
    title: "Electrical Setup Team",
    listingType: "service",
    category: "Electrician",
    area: "Dhanmondi",
    coverageAreas: ["Dhanmondi", "Banani"],
    address: "Dhanmondi 27, Dhaka",
    location: { lat: 23.755, lng: 90.3751 },
    price: 18000,
    facilities: ["Wiring", "Lighting setup", "Maintenance"],
    photos: ["electric-team.jpg"],
    status: "Busy",
    verificationStatus: "pending",
    rating: 4.1,
    reviewCount: 12,
    description: "Commercial wiring, lighting setup, and maintenance support."
  }
]);

users.business.savedListings = [listings[0]._id, listings[2]._id];
await users.business.save();

await Review.insertMany([
  {
    listing: listings[1]._id,
    reviewer: users.business._id,
    rating: 5,
    comment: "Clear pricing and fast planning support for the office setup."
  },
  {
    listing: listings[0]._id,
    reviewer: users.business._id,
    rating: 4,
    comment: "Good location and easy owner communication."
  }
]);

await Conversation.create({
  listing: listings[0]._id,
  participants: [users.business._id, users.property._id],
  subject: "Roadside Retail Shop inquiry",
  messages: [
    { sender: users.business._id, body: "Is the Banani shop available for a weekend visit?", readBy: [users.business._id] },
    { sender: users.property._id, body: "Yes, Saturday 4 PM is open. I can confirm the visit.", readBy: [users.property._id] }
  ]
});

const visitBooking = await Booking.create({
  listing: listings[0]._id,
  requester: users.business._id,
  receiver: users.property._id,
  requestType: "visit",
  proposedAt: new Date("2026-08-12T16:00:00.000Z"),
  status: "accepted",
  notes: "Weekend visit for shop inspection.",
  history: [{ status: "requested", by: users.business._id }, { status: "accepted", by: users.property._id }]
});

const serviceBooking = await Booking.create({
  listing: listings[1]._id,
  requester: users.business._id,
  receiver: users.service._id,
  requestType: "service-booking",
  proposedAt: new Date("2026-08-14T10:00:00.000Z"),
  status: "requested",
  notes: "Need a setup estimate for a 650 sqft retail shop.",
  history: [{ status: "requested", by: users.business._id }]
});

await Notification.insertMany([
  {
    user: users.business._id,
    type: "booking",
    title: "Visit request accepted",
    message: "Roadside Retail Shop visit is confirmed.",
    channel: "email"
  },
  {
    user: users.property._id,
    type: "inquiry",
    title: "New property inquiry",
    message: "M A OBAEED asked about Roadside Retail Shop.",
    channel: "email"
  }
]);

await Report.create({
  targetType: "listing",
  targetId: listings[4]._id,
  reason: "Provider verification is pending.",
  status: "open"
});

await SupportTicket.insertMany([
  {
    requester: users.business._id,
    assignedTo: users.admin._id,
    subject: "Need help comparing Banani spaces",
    category: "listing",
    priority: "medium",
    status: "in-progress",
    tags: ["search", "recommendation"],
    messages: [
      { sender: users.business._id, body: "I need help shortlisting a shop with ISP and interior support." },
      { sender: users.admin._id, body: "We are checking Banani listings and setup packages.", internal: false }
    ]
  },
  {
    requester: users.property._id,
    assignedTo: users.admin._id,
    subject: "Verification document update",
    category: "account",
    priority: "high",
    status: "open",
    tags: ["verification"],
    messages: [{ sender: users.property._id, body: "Please confirm if the trade license image is clear enough." }]
  }
]);

await SystemSetting.insertMany([
  {
    key: "platform_commission_rate",
    label: "Platform commission rate",
    category: "platform",
    value: 5,
    valueType: "number",
    updatedBy: users.admin._id
  },
  {
    key: "auto_verify_business_owners",
    label: "Auto verify business owners",
    category: "platform",
    value: true,
    valueType: "boolean",
    updatedBy: users.admin._id
  },
  {
    key: "max_booking_window_days",
    label: "Maximum booking window",
    category: "booking",
    value: 30,
    valueType: "number",
    updatedBy: users.admin._id
  },
  {
    key: "email_notifications_enabled",
    label: "Email notifications enabled",
    category: "notification",
    value: true,
    valueType: "boolean",
    updatedBy: users.admin._id
  },
  {
    key: "customer_service_phone",
    label: "Customer service phone",
    category: "support",
    value: "+8801636317693",
    valueType: "string",
    updatedBy: users.admin._id
  }
]);

await ActivityLog.insertMany([
  {
    actor: users.business._id,
    action: "search.saved",
    entityType: "Listing",
    severity: "info",
    message: "M A OBAEED saved Banani listing preferences.",
    metadata: { area: "Banani", budgetMax: 100000 }
  },
  {
    actor: users.property._id,
    action: "listing.created",
    entityType: "Listing",
    entityId: listings[0]._id,
    severity: "success",
    message: "Roadside Retail Shop was listed and verified.",
    metadata: { area: "Banani", category: "Shop" }
  },
  {
    actor: users.business._id,
    action: "booking.requested",
    entityType: "Booking",
    entityId: visitBooking._id,
    severity: "success",
    message: "Visit request accepted for Roadside Retail Shop.",
    metadata: { status: "accepted" }
  },
  {
    actor: users.business._id,
    action: "booking.requested",
    entityType: "Booking",
    entityId: serviceBooking._id,
    severity: "info",
    message: "Interior service booking request submitted.",
    metadata: { status: "requested" }
  },
  {
    actor: users.admin._id,
    action: "verification.review",
    entityType: "Report",
    severity: "warning",
    message: "Electrical provider verification is waiting for admin review.",
    metadata: { queue: "provider-verification" }
  }
]);

console.log("OfficeKhoj BD MongoDB seed complete.");
await mongoose.disconnect();
