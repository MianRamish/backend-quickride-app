const mongoose = require("mongoose");

const rideSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    captain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Captain",
    },
    requestedCaptains: [{ type: mongoose.Schema.Types.ObjectId, ref: "Captain" }],
    rejectedCaptains: [{ type: mongoose.Schema.Types.ObjectId, ref: "Captain" }],
    requestExpiresAt: { type: Date, default: null },
    paymentMethod: { type: String, enum: ["cash", "card", "wallet"], default: "cash" },

    rideMode: { type: String, enum: ["now", "scheduled"], default: "now" },
    scheduledFor: { type: Date, default: null, index: true },
    scheduledStatus: { type: String, enum: ["none", "waiting", "notified", "assigned", "cancelled"], default: "none" },

    pickup: {
      type: String,
      required: true,
    },
    destination: {
      type: String,
      required: true,
    },
    fare: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      enum: ["USD", "CAD"],
      default: "USD",
    },
    vehicle: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "scheduled", "accepted", "ongoing", "completed", "cancelled"],
      default: "pending",
    },
cancelledBy: { type: String, enum: ["user","captain","system"], default: null },
cancelReason: {
  code: { type: String, default: "" },
  text: { type: String, default: "" }
},

rating: { type: Number, min: 1, max: 5, default: null },
review: { type: String, default: "" },

earnings: {
  gross: { type: Number, default: 0 },
  commissionRate: { type: Number, default: 0.2 },
  commissionAmount: { type: Number, default: 0 },
  bonusAmount: { type: Number, default: 0 },
  netToCaptain: { type: Number, default: 0 }
},

    duration: {
      type: Number,
    }, // in seconds

    distance: {
      type: Number,
    }, // in meters

    paymentID: {
      type: String,
    },
    orderId: {
      type: String,
    },
    signature: {
      type: String,
    },
    otp: {
      type: String,
      select: false,
      required: true,
    },
    messages: [
      {
        msg: String,
        by: {
          type: String,
          enum: ["user", "captain"],
        },
        time: String,
        date: String,
        timestamp: Date,
        _id: false
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ride", rideSchema);
