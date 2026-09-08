const mongoose = require("mongoose");

const payoutSchema = new mongoose.Schema(
  {
    captain: { type: mongoose.Schema.Types.ObjectId, ref: "Captain", required: true, index: true },
    amount: { type: Number, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    status: { type: String, enum: ["pending","paid"], default: "pending" },
    method: { type: String, enum: ["bank","cash","wallet"], default: "bank" },
    reference: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payout", payoutSchema);
