import dotenv from "dotenv";
dotenv.config({
  path: "../.env",
});
import connectDB from "./db/connection.js";
import http from "http";
import { Server as ExpressApp } from "./app.js";
import { initializeSocket } from "./socket/socket.js";
import { startStoryCleanupJob } from "./controllers/story.controller.js";

const Port = process.env.PORT || 3000;

// Create HTTP server
const httpServer = http.createServer(ExpressApp);

// to do cluster configration for production ✅ DONE!

connectDB()
  .then(async () => {
    // Initialize Socket.IO with Redis adapter (async)
    await initializeSocket(httpServer);

    httpServer.listen(Port, () =>
      console.log(`Server is Running on Port http://localhost:${Port}/ And PID is ${process.pid}`)
    );

    // Start automatic story cleanup job (deletes expired stories every hour)
    startStoryCleanupJob();
  })
  .catch((e) => {
    console.error(`Something went wrong while connecting to DB`, e);
    process.exit(1);
  });

// Graceful shutdown handler
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

async function gracefulShutdown() {

  // Close HTTP server
  httpServer.close(() => {
  });

  // Cleanup Socket.IO Redis connections
  const { cleanupRedis } = await import("./socket/socket.js");
  await cleanupRedis();

  process.exit(0);
}
