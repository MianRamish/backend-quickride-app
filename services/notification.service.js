const Notification = require("../models/notification.model");
const { sendMessageToSocketId, emitToAdmins } = require("../socket");
const User = require("../models/user.model");
const Captain = require("../models/captain.model");

async function resolveSocket(recipientType, recipient) {
  if (!recipient) return null;
  if (recipientType === "user") return (await User.findById(recipient).select("socketId"))?.socketId || null;
  if (recipientType === "captain") return (await Captain.findById(recipient).select("socketId"))?.socketId || null;
  return null;
}

async function notify({ recipientType, recipient = null, type = "info", title, body = "", ride = null, data = {} }) {
  const notification = await Notification.create({ recipientType, recipient, type, title, body, ride, data });
  const socketId = await resolveSocket(recipientType, recipient);
  if (socketId) {
    sendMessageToSocketId(socketId, { event: "notification", data: notification.toObject() });
  }
  if (recipientType === "admin") {
    emitToAdmins("notification", notification.toObject());
  }
  if (["user", "captain"].includes(recipientType) && recipient) {
    try {
      await require("./push.service").sendToRecipient({
        recipientType,
        recipient,
        title,
        body,
        data: { ...data, notificationId: notification._id, rideId: ride || data?.rideId || null, url: data?.url || "" },
      });
    } catch (_) {}
  }
  return notification;
}

async function listFor({ recipientType, recipient, limit = 50 }) {
  return Notification.find({ recipientType, recipient }).sort({ createdAt: -1 }).limit(limit);
}

async function markRead({ id, recipientType, recipient }) {
  return Notification.findOneAndUpdate({ _id: id, recipientType, recipient }, { readAt: new Date() }, { new: true });
}

module.exports = { notify, listFor, markRead };
