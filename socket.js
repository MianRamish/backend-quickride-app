const moment = require("moment-timezone");
const { Server } = require("socket.io");
const userModel = require("./models/user.model");
const rideModel = require("./models/ride.model");
const captainModel = require("./models/captain.model");
const frontendLogModel = require("./models/frontend-log.model");

let io;

function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

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
  });
}

const sendMessageToSocketId = (socketId, messageObject) => {
  if (io) {
    console.log("message sent to: ", socketId);
    io.to(socketId).emit(messageObject.event, messageObject.data);
  } else {
    console.log("Socket.io not initialized.");
  }
};

module.exports = { initializeSocket, sendMessageToSocketId };
