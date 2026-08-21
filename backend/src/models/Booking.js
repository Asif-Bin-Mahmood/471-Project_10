import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    requestType: { type: String, enum: ["visit", "service-booking"], required: true },
    proposedAt: { type: Date, required: true },
    alternateAt: { type: Date },
    status: {
      type: String,
      enum: ["requested", "accepted", "declined", "alternate-proposed", "completed"],
      default: "requested"
    },
    notes: { type: String, default: "" },
    history: [
      {
        status: String,
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

bookingSchema.index({ listing: 1, requester: 1, proposedAt: 1 }, { unique: true });

export default mongoose.model("Booking", bookingSchema);
