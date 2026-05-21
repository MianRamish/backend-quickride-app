const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema(
  {
    captain: { type: mongoose.Schema.Types.ObjectId, ref: "Captain", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: ["USD", "CAD"], default: "USD" },
    method: { type: String, enum: ["bank", "wallet", "cash"], default: "bank" },
    bankName: { type: String, default: "" },
    accountHolder: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    routingNumber: { type: String, default: "" },
    payoutEmail: { type: String, default: "" },
    status: { type: String, enum: ["pending", "approved", "paid", "rejected"], default: "pending", index: true },
    adminNote: { type: String, default: "" },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
