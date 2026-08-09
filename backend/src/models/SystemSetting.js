import mongoose from "mongoose";

const systemSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    label: { type: String, required: true, trim: true },
    category: { type: String, enum: ["platform", "listing", "booking", "notification", "support"], default: "platform", index: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    valueType: { type: String, enum: ["string", "number", "boolean", "json"], default: "string" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("SystemSetting", systemSettingSchema);
