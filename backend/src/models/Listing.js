import mongoose from "mongoose";

const listingSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    listingType: { type: String, enum: ["property", "service"], required: true },
    category: { type: String, required: true, trim: true },
    area: { type: String, required: true, trim: true, index: true },
    coverageAreas: [{ type: String }],
    address: { type: String, required: true, trim: true },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    price: { type: Number, required: true, min: 0, index: true },
    size: { type: Number, default: 0 },
    facilities: [{ type: String }],
    photos: [{ type: String }],
    status: { type: String, enum: ["Available", "Busy", "Leased"], default: "Available", index: true },
    verificationStatus: { type: String, enum: ["pending", "verified", "rejected"], default: "verified" },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    description: { type: String, default: "" }
  },
  { timestamps: true }
);

listingSchema.index({ area: 1, listingType: 1, category: 1, price: 1, status: 1 });
listingSchema.index({ verificationStatus: 1, status: 1, listingType: 1, category: 1, price: 1 });
listingSchema.index({ verificationStatus: 1, status: 1, rating: -1 });

export default mongoose.model("Listing", listingSchema);
