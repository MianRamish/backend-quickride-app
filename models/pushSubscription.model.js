const mongoose = require("mongoose");

const pushSubscriptionSchema = new mongoose.Schema({
  recipientType: { type: String, enum: ["user", "captain"], required: true, index: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  endpoint: { type: String, required: true, unique: true, index: true },
  subscription: { type: mongoose.Schema.Types.Mixed, required: true },
  userAgent: { type: String, default: "" },
  lastUsedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);
