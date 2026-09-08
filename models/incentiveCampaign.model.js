const mongoose = require("mongoose");

const incentiveCampaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
<<<<<<< HEAD
    period: { type: String, enum: ["daily","weekly","monthly"], default: "daily" },
=======
    period: { type: String, enum: ["daily","weekly"], default: "daily" },
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
    targetRides: { type: Number, required: true },
    rewardAmount: { type: Number, required: true },
    startsAt: { type: Date, default: () => new Date() },
    endsAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("IncentiveCampaign", incentiveCampaignSchema);
