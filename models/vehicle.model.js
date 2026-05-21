const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
  {
    captain: { type: mongoose.Schema.Types.ObjectId, ref: "Captain", required: true, index: true },
    make: { type: String, default: "" },
    model: { type: String, default: "" },
    year: { type: Number, default: null },
    color: { type: String, default: "" },
    plateNumber: { type: String, default: "", index: true },
    type: { type: String, enum: ["car","bike"], required: true },
    isActive: { type: Boolean, default: true },
    docs: {
      registrationUrl: { type: String, default: "" },
      registrationExpiry: { type: Date, default: null },
      insuranceUrl: { type: String, default: "" },
      insuranceExpiry: { type: Date, default: null }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vehicle", vehicleSchema);
