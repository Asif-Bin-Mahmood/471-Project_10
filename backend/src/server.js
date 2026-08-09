import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { configureSocket } from "./realtime/socket.js";

const port = Number(process.env.PORT || 5000);
const clientOrigin = process.env.CLIENT_URL || "http://127.0.0.1:5173";
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: clientOrigin, credentials: true }
});

configureSocket(io);
app.set("io", io);

connectDB(process.env.MONGODB_URI)
  .then(() => {
    httpServer.listen(port, () => {
      console.log(`OfficeKhoj BD MERN API running on http://127.0.0.1:${port}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed.");
    console.error(error.message);
    process.exit(1);
  });
