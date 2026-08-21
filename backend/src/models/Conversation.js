import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, default: "", trim: true, maxlength: 4000 },
    kind: { type: String, enum: ["text", "image", "audio"], default: "text" },
    attachmentUrl: { type: String, default: "", trim: true },
    attachmentName: { type: String, default: "", trim: true, maxlength: 180 },
    attachmentMimeType: { type: String, default: "", trim: true, maxlength: 100 },
    attachmentSize: { type: Number, default: 0, min: 0 },
    durationSeconds: { type: Number, default: 0, min: 0, max: 600 },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

const conversationSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    subject: { type: String, required: true },
    messages: [messageSchema]
  },
  { timestamps: true }
);

export default mongoose.model("Conversation", conversationSchema);
