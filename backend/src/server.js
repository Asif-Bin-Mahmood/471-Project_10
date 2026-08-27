import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import app, { corsOptions } from "./app.js";
import { connectDB } from "./config/db.js";
import { configureSocket } from "./realtime/socket.js";

const port = Number(process.env.PORT || 5000);
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: corsOptions
});

configureSocket(io);
app.set("io", io);

connectDB(process.env.MONGODB_URI)
  .then(() => {
    httpServer.listen(port, "0.0.0.0", () => {
      console.log(`OfficeKhoj BD MERN API running on 0.0.0.0:${port}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed.");
    console.error(error.message);
    process.exit(1);
  });
