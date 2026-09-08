const mongoose = require("mongoose");

const settlementSchema = new mongoose.Schema({
  captain: { type: mongoose.Schema.Types.ObjectId, ref: "Captain", required: true, index: true },
  ride: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", default: null, index: true },
  type: { type: String, enum: ["cash_commission", "manual_adjustment", "payment"], default: "cash_commission" },
  grossCash: { type: Number, default: 0 },
  commissionAmount: { type: Number, default: 0 },
  amount: { type: Number, required: true },
  currency: { type: String, default: "NGN" },
  direction: { type: String, enum: ["captain_owes_platform", "platform_owes_captain"], default: "captain_owes_platform" },
  status: { type: String, enum: ["owed", "partially_settled", "settled", "waived"], default: "owed", index: true },
  settledAmount: { type: Number, default: 0 },
  reference: { type: String, default: "" },
  adminNote: { type: String, default: "" },
  settledAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model("Settlement", settlementSchema);
