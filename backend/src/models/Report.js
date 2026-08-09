import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ["listing", "user"], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ["open", "resolved"], default: "open" }
  },
  { timestamps: true }
);

export default mongoose.model("Report", reportSchema);
