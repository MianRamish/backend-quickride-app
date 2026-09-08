const moment = require("moment-timezone");
<<<<<<< HEAD
const jwt = require("jsonwebtoken");
=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
const { Server } = require("socket.io");
const userModel = require("./models/user.model");
const rideModel = require("./models/ride.model");
const captainModel = require("./models/captain.model");
<<<<<<< HEAD
const adminModel = require("./models/admin.model");
const blacklistTokenModel = require("./models/blacklistToken.model");
=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
const frontendLogModel = require("./models/frontend-log.model");

let io;

<<<<<<< HEAD
async function verifySocketIdentity(token, expectedType, expectedId = null) {
  if (!token || !process.env.JWT_SECRET) return null;
  const blacklisted = await blacklistTokenModel.findOne({ token }).select("_id").lean();
  if (blacklisted) return null;

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (_) {
    return null;
  }

  const userType = decoded.userType || "user";
  if (userType !== expectedType) return null;
  if (expectedId && String(decoded.id) !== String(expectedId)) return null;

  if (expectedType === "user") {
    const user = await userModel.findById(decoded.id).select("_id status");
    if (!user || user.status === "suspended") return null;
    return { id: String(user._id), userType: "user" };
  }
  if (expectedType === "captain") {
    const captain = await captainModel.findById(decoded.id).select("_id status");
    if (!captain || captain.status === "suspended") return null;
    return { id: String(captain._id), userType: "captain" };
  }
  if (expectedType === "admin") {
    const admin = await adminModel.findById(decoded.id).select("_id");
    if (!admin) return null;
    return { id: String(admin._id), userType: "admin" };
  }
  return null;
}

async function clearSocketPresence(socket) {
  try {
    await captainModel.findOneAndUpdate({ socketId: socket.id }, { socketId: null, lastSeenAt: new Date() });
    await userModel.findOneAndUpdate({ socketId: socket.id }, { socketId: null });
  } catch (_) {}
}

function getAllowedSocketOrigins() {
  const configured = String(process.env.CLIENT_URL || "").split(",").map((item) => item.trim()).filter(Boolean);
  // Socket authentication is JWT-backed, but restricting browser origins still
  // reduces accidental exposure. Local development remains convenient.
  if (process.env.ENVIRONMENT !== "production") configured.push("http://localhost:5173", "http://127.0.0.1:5173");
  return [...new Set(configured)];
}

function initializeSocket(server) {
  const origins = getAllowedSocketOrigins();
  io = new Server(server, {
    cors: { origin: origins.length ? origins : false, methods: ["GET", "POST"], credentials: true },
    pingTimeout: 20000,
    pingInterval: 25000,
=======
function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
  });

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

<<<<<<< HEAD
    if (process.env.ENVIRONMENT === "production") {
      socket.on("log", async (log) => {
        log.formattedTimestamp = moment().tz("Africa/Lagos").format("MMM DD hh:mm:ss A");
        try { await frontendLogModel.create(log); } catch (_) {}
      });
    }

    // Authenticate the socket with the same JWT used by the REST API. The client
    // still sends userId/userType for backwards compatibility, but the token is
    // authoritative and must match the requested identity.
    socket.on("join", async (data = {}) => {
      const { userId, userType, token } = data;
      if (!userId || !["user", "captain"].includes(userType)) {
        return socket.emit("session-error", { message: "Invalid live-session request" });
      }
      const identity = await verifySocketIdentity(token, userType, userId);
      if (!identity) return socket.emit("session-error", { message: "Live session authentication failed" });

      socket.data.userId = identity.id;
      socket.data.userType = identity.userType;
      socket.data.authenticated = true;

      if (userType === "user") {
        await userModel.findByIdAndUpdate(identity.id, { socketId: socket.id });
      } else {
        const captain = await captainModel.findById(identity.id);
        if (captain) {
          captain.socketId = socket.id;
          captain.lastSeenAt = new Date();
          const reconnectableStatuses = ["online_available", "ride_requested", "on_trip"];
          if (captain.isApproved && captain.verificationStatus === "approved" && captain.status === "active" && reconnectableStatuses.includes(captain.availabilityStatus)) captain.isOnline = true;
          await captain.save();
        }
      }

      const roomFilter = userType === "user" ? { user: identity.id } : { captain: identity.id };
      const activeRooms = await rideModel.find({ ...roomFilter, status: { $in: ["pending", "accepted", "arriving", "arrived", "ongoing"] } }).select("_id").limit(5);
      activeRooms.forEach((ride) => socket.join(String(ride._id)));
      socket.emit("session-ready", { userId: identity.id, userType: identity.userType });
    });

    socket.on("join-admin", async (data = {}) => {
      const identity = await verifySocketIdentity(data.token, "admin", data.adminId || null);
      if (!identity) return socket.emit("session-error", { message: "Admin live-session authentication failed" });
      socket.data.userId = identity.id;
      socket.data.userType = "admin";
      socket.data.authenticated = true;
      socket.join("admin-operations");
      socket.emit("admin-session-ready", { adminId: identity.id });
    });

    socket.on("update-location-captain", async (data = {}) => {
      const { userId, location } = data;
      if (!socket.data.authenticated || socket.data.userType !== "captain" || socket.data.userId !== String(userId)) {
        return socket.emit("location-error", { message: "Driver session mismatch" });
      }
      if (!location || !Number.isFinite(Number(location.ltd)) || !Number.isFinite(Number(location.lng))) {
        return socket.emit("location-error", { message: "Invalid location data" });
      }
      const now = new Date();
      const updatedCaptain = await captainModel.findByIdAndUpdate(userId, {
        location: { type: "Point", coordinates: [Number(location.lng), Number(location.ltd)] },
        lastLocationAt: now,
        lastLocationAccuracy: Number.isFinite(Number(data.accuracy)) ? Number(data.accuracy) : null,
        lastLocationHeading: Number.isFinite(Number(data.heading)) ? Number(data.heading) : null,
        lastLocationSource: "gps",
        manualLocationLabel: "",
        manualLocationConfirmedAt: null,
        lastSeenAt: now,
      }, { new: true });
      socket.emit("location-ack", { updatedAt: now });

      try {
        const activeRide = await rideModel.findOne({ captain: userId, status: { $in: ["accepted", "arriving", "arrived", "ongoing"] } })
          .populate("user", "socketId")
          .populate("captain", "fullname vehicle rating location lastLocationAt");
        const payload = {
          captainId: userId,
          rideId: activeRide?._id || null,
          location: {
            ltd: Number(location.ltd),
            lng: Number(location.lng),
            accuracy: data.accuracy ?? null,
            heading: data.heading ?? null,
          },
          captain: updatedCaptain,
          updatedAt: now,
        };
        if (activeRide?.user?.socketId) io.to(activeRide.user.socketId).emit("captain-location-updated", payload);
        if (activeRide?._id) io.to(String(activeRide._id)).emit("captain-location-updated", payload);
        io.to("admin-operations").emit("admin-captain-location", payload);
      } catch (error) {
        console.log("Unable to broadcast captain location", error.message);
      }
    });

    socket.on("join-room", async (roomId) => {
      if (!roomId || !socket.data.authenticated || !socket.data.userId) return;
      const ride = await rideModel.findById(roomId).select("user captain status chatClosedAt");
      if (!ride) return;
      const allowed =
        (socket.data.userType === "user" && String(ride.user) === socket.data.userId) ||
        (socket.data.userType === "captain" && String(ride.captain || "") === socket.data.userId);
      if (allowed) socket.join(String(roomId));
    });

    socket.on("message", async ({ rideId, msg, userType, time } = {}) => {
      if (!rideId || !msg || !socket.data.authenticated || !socket.data.userId || socket.data.userType !== userType) return;
      try {
        const ride = await rideModel.findById(rideId);
        if (!ride || ride.chatClosedAt || ["completed", "cancelled"].includes(ride.status)) return socket.emit("chat-closed", { rideId });
        const isParticipant =
          (userType === "user" && String(ride.user) === socket.data.userId) ||
          (userType === "captain" && String(ride.captain || "") === socket.data.userId);
        if (!isParticipant) return;
        const message = {
          msg: String(msg).slice(0, 1000),
          by: userType,
          time: time || moment().tz("Africa/Lagos").format("hh:mm A"),
          date: moment().tz("Africa/Lagos").format("MMM DD"),
          timestamp: new Date(),
        };
        ride.messages.push(message);
        await ride.save();
        socket.to(String(rideId)).emit("receiveMessage", message);
      } catch (error) {
        console.log("Error saving message:", error.message);
      }
    });

    socket.on("leave-session", async () => {
      await clearSocketPresence(socket);
      socket.data.userId = null;
      socket.data.userType = null;
      socket.data.authenticated = false;
      socket.leave("admin-operations");
    });

    socket.on("disconnect", async () => {
      await clearSocketPresence(socket);
    });
=======
    if (process.env.ENVIRONMENT == "production") {
      socket.on("log", async (log) => {
        log.formattedTimestamp = moment().tz("Asia/Kolkata").format("MMM DD hh:mm:ss A");
        try {
          await frontendLogModel.create(log);
        } catch (error) {
          console.log("Error sending logs...");
        }
      });
    }

    socket.on("join", async (data) => {
      const { userId, userType } = data;
      console.log(userType + " connected: " + userId);
      if (userType === "user") {
        await userModel.findByIdAndUpdate(userId, { socketId: socket.id });
      } else if (userType === "captain") {
        const captain = await captainModel.findById(userId);
        if (captain) {
          captain.socketId = socket.id;
          if (captain.isApproved && captain.verificationStatus === "approved" && captain.status === "active" && captain.availabilityStatus !== "offline") {
            captain.isOnline = true;
          }
          await captain.save();
        }
      }
    });

    socket.on("update-location-captain", async (data) => {
      const { userId, location } = data;

      if (!location || !location.ltd || !location.lng) {
        return socket.emit("error", { message: "Invalid location data" });
      }
      const updatedCaptain = await captainModel.findByIdAndUpdate(userId, {
        location: {
          type: "Point",
          coordinates: [location.lng, location.ltd],
        },
      }, { new: true });

      try {
        const activeRide = await rideModel
          .findOne({ captain: userId, status: { $in: ["accepted", "ongoing"] } })
          .populate("user", "socketId")
          .populate("captain", "fullname phone vehicle rating location");
        const payload = {
          captainId: userId,
          rideId: activeRide?._id || null,
          location,
          captain: updatedCaptain,
          updatedAt: new Date(),
        };
        if (activeRide?.user?.socketId) {
          io.to(activeRide.user.socketId).emit("captain-location-updated", payload);
        }
        if (activeRide?._id) {
          io.to(String(activeRide._id)).emit("captain-location-updated", payload);
        }
        io.emit("admin-captain-location", payload);
      } catch (e) {
        console.log("Unable to broadcast captain location", e.message);
      }
    });

    socket.on("join-room", (roomId) => {
      socket.join(roomId);
      console.log(`${socket.id} joined room: ${roomId}`);
    });

    socket.on("message", async ({ rideId, msg, userType, time }) => {
      const date = moment().tz("Asia/Kolkata").format("MMM DD");
      socket.to(rideId).emit("receiveMessage", { msg, by: userType, time });
      try {
        const ride = await rideModel.findOne({ _id: rideId });
        ride.messages.push({
          msg: msg,
          by: userType,
          time: time,
          date: date,
          timestamp: new Date(),
        });
        await ride.save();
      } catch (error) {
        console.log("Error saving message: ", error);
      }
    });

socket.on("disconnect", async () => {
  try {
    // mark offline
    // we don't know type here; best-effort based on stored id
    // If a captain disconnects, clear socketId and isOnline
    // If a user disconnects, clear socketId
    // NOTE: join event sets these; we keep this safe.
    await captainModel.findOneAndUpdate({ socketId: socket.id }, { socketId: null, isOnline: false, availabilityStatus: "offline" });
    await userModel.findOneAndUpdate({ socketId: socket.id }, { socketId: null });
  } catch (e) {}
});
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
  });
}

const sendMessageToSocketId = (socketId, messageObject) => {
<<<<<<< HEAD
  if (io && socketId) io.to(socketId).emit(messageObject.event, messageObject.data);
};

const emitToAdmins = (event, data) => {
  if (io) io.to("admin-operations").emit(event, data);
};

module.exports = { initializeSocket, sendMessageToSocketId, emitToAdmins };
=======
  if (io) {
    console.log("message sent to: ", socketId);
    io.to(socketId).emit(messageObject.event, messageObject.data);
  } else {
    console.log("Socket.io not initialized.");
  }
};

module.exports = { initializeSocket, sendMessageToSocketId };
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
