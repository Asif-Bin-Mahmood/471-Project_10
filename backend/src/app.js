import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { getHealth } from "./controllers/system.controller.js";
import { errorHandler, notFound } from "./middleware/error.middleware.js";
import adminRoutes from "./routes/admin.routes.js";
import authRoutes from "./routes/auth.routes.js";
import communicationRoutes from "./routes/communication.routes.js";
import listingRoutes from "./routes/listing.routes.js";
import operationsRoutes from "./routes/operations.routes.js";
import reportRoutes from "./routes/report.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import userRoutes from "./routes/user.routes.js";

const app = express();

const configuredOrigins = String(process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([
  ...configuredOrigins,
  ...(process.env.NODE_ENV === "production" ? [] : ["http://127.0.0.1:5173", "http://localhost:5173"])
]);
const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    const error = new Error("This web origin is not allowed.");
    error.status = 403;
    return callback(error);
  }
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment and try again." }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please wait before trying again." }
});

app.disable("x-powered-by");
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/api/health", getHealth);

app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api", adminRoutes);
app.use("/api", listingRoutes);
app.use("/api", operationsRoutes);
app.use("/api", reportRoutes);
app.use("/api", reviewRoutes);
app.use("/api", userRoutes);
app.use("/api", communicationRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
