const mongoose = require("mongoose");

const incentiveCampaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    period: { type: String, enum: ["daily","weekly"], default: "daily" },
    targetRides: { type: Number, required: true },
    rewardAmount: { type: Number, required: true },
    startsAt: { type: Date, default: () => new Date() },
    endsAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("IncentiveCampaign", incentiveCampaignSchema);
