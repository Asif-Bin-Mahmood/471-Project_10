import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      enum: ["business-owner", "property-owner", "service-provider", "admin"],
      default: "business-owner"
    },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    verificationStatus: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
    nid: { type: String, default: "" },
    tradeLicense: { type: String, default: "" },
    businessType: { type: String, default: "" },
    preferredArea: { type: String, default: "" },
    budgetMin: { type: Number, default: 0 },
    budgetMax: { type: Number, default: 0 },
    minSize: { type: Number, default: 0 },
    serviceNeed: { type: String, default: "" },
    coverageAreas: [{ type: String }],
    savedListings: [{ type: mongoose.Schema.Types.ObjectId, ref: "Listing" }]
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function matchPassword(password) {
  return bcrypt.compare(password, this.password);
};

userSchema.methods.toJSON = function toJSON() {
  const user = this.toObject();
  delete user.password;
  return user;
};

export default mongoose.model("User", userSchema);
