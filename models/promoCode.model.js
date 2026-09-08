const mongoose = require("mongoose");

const promoCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  description: { type: String, default: "" },
  type: { type: String, enum: ["percent", "fixed"], default: "percent" },
  value: { type: Number, required: true, min: 0 },
  maxDiscount: { type: Number, default: null },
  minFare: { type: Number, default: 0 },
  usageLimit: { type: Number, default: null },
  usageCount: { type: Number, default: 0 },
  perUserLimit: { type: Number, default: 1 },
  startsAt: { type: Date, default: () => new Date() },
  endsAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("PromoCode", promoCodeSchema);
