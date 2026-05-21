require("dotenv").config();
const socket = require("./socket");
const express = require("express");
const { createServer } = require("http");
const app = express();
const server = createServer(app);

socket.initializeSocket(server);

const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");

const userRoutes = require("./routes/user.routes");
const captainRoutes = require("./routes/captain.routes");
const mapsRoutes = require("./routes/maps.routes");
const adminRoutes = require('./routes/admin.routes');
const rideRoutes = require("./routes/ride.routes");
const mailRoutes = require("./routes/mail.routes");
const keepServerRunning = require("./services/active.service");
const dbStream = require("./services/logging.service");
require("./config/db");
const PORT = process.env.PORT || 4000;

if (process.env.ENVIRONMENT == "production") {
  app.use(
    morgan(":method :url :status :response-time ms - :res[content-length]", {
      stream: dbStream,
    })
  );
} else {
  app.use(morgan("dev"));
}
const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    if (/\.ngrok-free\.app$/.test(origin) || /\.trycloudflare\.com$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "token", "ngrok-skip-browser-warning"],
}));
app.use(cookieParser());
app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || "50mb" }));
app.use(express.urlencoded({ extended: true, limit: process.env.REQUEST_BODY_LIMIT || "50mb" }));

if (process.env.ENVIRONMENT == "production") {
  keepServerRunning();
}

app.get("/", (req, res) => {
  res.json("Hello, World!");
});

app.get("/reload", (req, res) => {
  res.json("Server Reloaded");
});

app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      message: "Uploaded files are too large. Please upload smaller/compressed images or PDF files under the allowed size.",
    });
  }
  return next(err);
});

app.use("/user", userRoutes);
app.use("/captain", captainRoutes);
app.use("/map", mapsRoutes);
app.use("/ride", rideRoutes);
app.use('/api/admin', adminRoutes);
app.use('/admin', adminRoutes); // compatibility alias for admin login/API
app.use("/mail", mailRoutes);

server.listen(PORT, () => {
  console.log("Server is listening on port", PORT);
});
