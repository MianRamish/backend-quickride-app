const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema(
  {
    captain: { type: mongoose.Schema.Types.ObjectId, ref: "Captain", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
<<<<<<< HEAD
    currency: { type: String, enum: ["NGN", "USD", "CAD"], default: "NGN" },
=======
    currency: { type: String, enum: ["USD", "CAD"], default: "USD" },
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
    method: { type: String, enum: ["bank", "wallet", "cash"], default: "bank" },
    bankName: { type: String, default: "" },
    accountHolder: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    routingNumber: { type: String, default: "" },
<<<<<<< HEAD
    bankCode: { type: String, default: "" },
=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
    payoutEmail: { type: String, default: "" },
    status: { type: String, enum: ["pending", "approved", "paid", "rejected"], default: "pending", index: true },
    adminNote: { type: String, default: "" },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
