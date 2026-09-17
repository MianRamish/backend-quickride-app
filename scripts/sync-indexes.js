require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB, disconnectDB } = require("../config/db");

[
  "../models/admin.model",
  "../models/blacklistToken.model",
  "../models/captain.model",
  "../models/complaint.model",
  "../models/emergency.model",
  "../models/incentiveCampaign.model",
  "../models/payout.model",
  "../models/ride.model",
  "../models/user.model",
  "../models/vehicle.model",
  "../models/withdrawal.model",
].forEach((modelPath) => require(modelPath));

async function main() {
  try {
    await connectDB();
    for (const model of Object.values(mongoose.models)) {
      await model.createIndexes();
      console.log(`Indexes created/verified: ${model.modelName}`);
    }
  } finally {
    await disconnectDB();
  }
}

main().catch((error) => {
  console.error("Index sync failed:", error);
  process.exit(1);
});
