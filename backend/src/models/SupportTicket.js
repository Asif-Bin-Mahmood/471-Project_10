import mongoose from "mongoose";

const supportMessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true },
    internal: { type: Boolean, default: false }
  },
  { timestamps: true }
);

const supportTicketSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    subject: { type: String, required: true, trim: true },
    category: { type: String, enum: ["account", "listing", "booking", "payment", "technical"], default: "technical", index: true },
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium", index: true },
    status: { type: String, enum: ["open", "in-progress", "resolved", "closed"], default: "open", index: true },
    messages: [supportMessageSchema],
    tags: [{ type: String, trim: true }]
  },
  { timestamps: true }
);

supportTicketSchema.index({ status: 1, priority: 1, updatedAt: -1 });

export default mongoose.model("SupportTicket", supportTicketSchema);
