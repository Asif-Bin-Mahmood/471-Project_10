import cors from "cors";
import express from "express";
import morgan from "morgan";
import { getHealth } from "./controllers/system.controller.js";
import { errorHandler, notFound } from "./middleware/error.middleware.js";
import adminRoutes from "./routes/admin.routes.js";
import authRoutes from "./routes/auth.routes.js";
import communicationRoutes from "./routes/communication.routes.js";
import listingRoutes from "./routes/listing.routes.js";
import operationsRoutes from "./routes/operations.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import userRoutes from "./routes/user.routes.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/api/health", getHealth);

app.use("/api/auth", authRoutes);
app.use("/api", adminRoutes);
app.use("/api", listingRoutes);
app.use("/api", operationsRoutes);
app.use("/api", reviewRoutes);
app.use("/api", userRoutes);
app.use("/api", communicationRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
