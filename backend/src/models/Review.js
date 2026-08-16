import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "Rating must be an integer between 1 and 5."
      }
    },
    comment: { type: String, required: true, trim: true, minlength: 3, maxlength: 1000 }
  },
  { timestamps: true }
);

reviewSchema.index({ listing: 1, reviewer: 1 });

export default mongoose.model("Review", reviewSchema);
