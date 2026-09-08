const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  recipientType: { type: String, enum: ["user", "captain", "admin"], required: true, index: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  type: { type: String, default: "info", index: true },
  title: { type: String, required: true },
  body: { type: String, default: "" },
  ride: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", default: null, index: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  readAt: { type: Date, default: null, index: true },
}, { timestamps: true });

module.exports = mongoose.model("Notification", notificationSchema);
