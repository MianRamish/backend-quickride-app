const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    captain: { type: mongoose.Schema.Types.ObjectId, ref: "Captain", default: null, index: true },
    ride: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", default: null, index: true },
    category: { type: String, default: "other" },
    description: { type: String, required: true },
    attachmentUrl: { type: String, default: "" },
    status: { type: String, enum: ["open", "in_review", "resolved", "dismissed"], default: "open", index: true },
    adminNote: { type: String, default: "" },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Complaint", complaintSchema);
