import cors from "cors";
import express from "express";
import morgan from "morgan";
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

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    app: "OfficeKhoj BD MERN API",
    stack: ["MongoDB", "Express", "React", "Node"],
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api", adminRoutes);
app.use("/api", listingRoutes);
app.use("/api", operationsRoutes);
app.use("/api", reviewRoutes);
app.use("/api", userRoutes);
app.use("/api", communicationRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || "Server error." });
});

export default app;
