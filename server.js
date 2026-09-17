require("dotenv").config();

const express = require("express");
const { createServer } = require("http");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const mongoose = require("mongoose");

const socket = require("./socket");
const { connectDB, disconnectDB } = require("./config/db");
const userRoutes = require("./routes/user.routes");
const captainRoutes = require("./routes/captain.routes");
const mapsRoutes = require("./routes/maps.routes");
const adminRoutes = require("./routes/admin.routes");
const rideRoutes = require("./routes/ride.routes");
const mailRoutes = require("./routes/mail.routes");

const app = express();
const server = createServer(app);
const PORT = Number(process.env.PORT || 4000);

const allowedOrigins = String(process.env.CLIENT_ORIGINS || process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (
    process.env.ENVIRONMENT !== "production" &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  ) {
    return true;
  }
  if (
    String(process.env.ALLOW_TUNNEL_ORIGINS || "false").toLowerCase() === "true" &&
    (/\.ngrok-free\.app$/.test(origin) || /\.trycloudflare\.com$/.test(origin))
  ) {
    return true;
  }
  return false;
}

app.disable("x-powered-by");
app.use(morgan(process.env.ENVIRONMENT === "production" ? "combined" : "dev"));
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "token", "ngrok-skip-browser-warning"],
  })
);
app.use(cookieParser());
app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || "12mb" }));
app.use(express.urlencoded({ extended: true, limit: process.env.REQUEST_BODY_LIMIT || "12mb" }));

app.get("/", (_req, res) => {
  res.json({ name: "QuickRide API", status: "ok" });
});

app.get("/health", (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  return res.status(dbReady ? 200 : 503).json({
    status: dbReady ? "ok" : "degraded",
    database: dbReady ? "connected" : "disconnected",
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.use("/user", userRoutes);
app.use("/captain", captainRoutes);
app.use("/map", mapsRoutes);
app.use("/ride", rideRoutes);
app.use("/api/admin", adminRoutes);
app.use("/admin", adminRoutes);
app.use("/mail", mailRoutes);

app.use((err, _req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      message: "Uploaded data is too large. Compress files and keep the total upload within the configured limit.",
    });
  }
  if (err?.message === "Origin not allowed by CORS") {
    return res.status(403).json({ message: err.message });
  }
  return next(err);
});

app.use((err, _req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  return res.status(500).json({ message: "Internal server error" });
});

function startOperationalServices() {
  require("./services/scheduler.service").startScheduledRideProcessor();
  require("./services/verification.service").startVerificationSweep();
  require("./services/matching.service").restorePendingMatches().catch(() => {});
  require("./services/operations.service").getConfig({ fresh: true }).catch(() => {});
}

async function start() {
  try {
    await connectDB();
    socket.initializeSocket(server);
    startOperationalServices();

    server.listen(PORT, () => {
      console.log("Server is listening on port", PORT);
    });
  } catch (error) {
    console.error("Unable to start server:", error.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);
  server.close(async () => {
    try {
      await disconnectDB();
    } finally {
      process.exit(0);
    }
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start();
