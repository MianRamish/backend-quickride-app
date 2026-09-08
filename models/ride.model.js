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
<<<<<<< HEAD
    currentRequestCaptain: { type: mongoose.Schema.Types.ObjectId, ref: "Captain", default: null },
    currentRequestExpiresAt: { type: Date, default: null },
    requestAttempt: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ["cash", "card"], default: "cash" },
    paymentStatus: {
      type: String,
      enum: ["cash_due", "cash_collected", "card_pending", "paid", "failed", "refunded"],
      default: "cash_due",
      index: true,
    },
    paymentProvider: { type: String, default: "cash" },
    paymentReference: { type: String, default: "" },
    cashCollected: { type: Boolean, default: false },
    cashCollectedAt: { type: Date, default: null },
=======
    paymentMethod: { type: String, enum: ["cash", "card", "wallet"], default: "cash" },
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc

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
<<<<<<< HEAD
      enum: ["NGN", "USD", "CAD"],
      default: "NGN",
=======
      enum: ["USD", "CAD"],
      default: "USD",
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
    },
    vehicle: {
      type: String,
      required: true,
    },
    status: {
      type: String,
<<<<<<< HEAD
      enum: ["pending", "scheduled", "accepted", "arriving", "arrived", "ongoing", "completed", "cancelled"],
      default: "pending",
    },
cancelledBy: { type: String, enum: ["user","captain","system","admin"], default: null },
cancellationFee: { type: Number, default: 0 },
cancellationFeeReason: { type: String, default: "" },
=======
      enum: ["pending", "scheduled", "accepted", "ongoing", "completed", "cancelled"],
      default: "pending",
    },
cancelledBy: { type: String, enum: ["user","captain","system"], default: null },
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
cancelReason: {
  code: { type: String, default: "" },
  text: { type: String, default: "" }
},

rating: { type: Number, min: 1, max: 5, default: null },
review: { type: String, default: "" },
<<<<<<< HEAD
ratingTags: [{ type: String, trim: true, maxlength: 80 }],
passengerRating: { type: Number, min: 1, max: 5, default: null },
passengerReview: { type: String, default: "" },
passengerRatingTags: [{ type: String, trim: true, maxlength: 80 }],
arrivedAt: { type: Date, default: null },
waitingStartedAt: { type: Date, default: null },
startedAt: { type: Date, default: null },
completedAt: { type: Date, default: null },
statusTimeline: [{
  status: { type: String, required: true },
  at: { type: Date, default: Date.now },
  by: { type: String, enum: ["user", "captain", "system", "admin"], default: "system" },
  note: { type: String, default: "" },
  _id: false,
}],
promoCode: { type: String, default: "", uppercase: true, trim: true },
promoDiscount: { type: Number, default: 0 },
promoUsageReleased: { type: Boolean, default: false },
originalFare: { type: Number, default: 0 },
shareToken: { type: String, default: "", index: true },
chatClosedAt: { type: Date, default: null },
=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc

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
