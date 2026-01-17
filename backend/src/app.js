import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import errorMiddleware from "./middleware/error.middleware.js";
import { checkMaintenanceMode } from "./middleware/maintenance.middleware.js";
import morgan from "morgan";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
const app = express();

app.use(cors({
  origin: true, // Allow all origins in development/production
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["set-cookie"],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
app.use(express.static("public"));

// Security Middleware
app.use(helmet()); // Set security HTTP headers
// app.use(mongoSanitize()); // Prevent NoSQL injection (Disabled due to Express 5 conflict)

// Global Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per `window` (per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: "Too many requests from this IP, please try again after 15 minutes",
});
app.use("/api", limiter);

// Serve uploaded files
app.use("/uploads", express.static("uploads"));

// HTTP request logger middleware
app.use(morgan("dev"));

// Maintenance mode check (must be before routes)
app.use(checkMaintenanceMode);

// home route
app.get("", (req, res) => res.json({ msg: "API Is Running" }))

// routes
import { userRoutes } from "./routes/user.routes.js";
import { healthRoutes } from "./routes/health.routes.js";
import { followRoutes } from "./routes/follow.routes.js";
import postRoutes from "./routes/post.routes.js";
import storyRoutes from "./routes/story.routes.js";
import reelRoutes from "./routes/reel.routes.js";
import feedRoutes from "./routes/feed.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import systemRoutes from "./routes/system.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import searchRoutes from "./routes/search.routes.js";
import { commentRoutes } from "./routes/comment.routes.js";

// routes register
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/follow", followRoutes);
app.use("/api/v1/post", postRoutes);
app.use("/api/v1/story", storyRoutes);
app.use("/api/v1/reel", reelRoutes);
app.use("/api/v1/feed", feedRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/system", systemRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/search", searchRoutes);
app.use("/api/v1/comment", commentRoutes);
app.use(healthRoutes);

//  404 route
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Global error middleware (last)
app.use(errorMiddleware);

export { app as Server };
