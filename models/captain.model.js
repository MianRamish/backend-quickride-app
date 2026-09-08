const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const captainSchema = new mongoose.Schema(
  {
    fullname: {
      firstname: {
        type: String,
        required: true,
        minlength: 3,
      },
      lastname: {
        type: String,
      },
    },
    email: {
      type: String,
      required: true,
      unique: true,
      match: /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    phone: {
      type: String,
<<<<<<< HEAD
      trim: true,
      maxlength: 20,
=======
      minlength: 10,
      maxlength: 10,
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
    },
    socketId: {
      type: String,
    },
isApproved: { type: Boolean, default: false },
isOnline: { type: Boolean, default: false },
<<<<<<< HEAD
lastLocationAt: { type: Date, default: null, index: true },
lastLocationAccuracy: { type: Number, default: null },
lastLocationHeading: { type: Number, default: null },
lastLocationSource: { type: String, enum: ["gps", "manual"], default: "gps", index: true },
manualLocationLabel: { type: String, default: "", trim: true, maxlength: 180 },
manualLocationConfirmedAt: { type: Date, default: null },
lastSeenAt: { type: Date, default: null },
currentOfferRide: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", default: null },
currentOfferExpiresAt: { type: Date, default: null },
=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc

activeVehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", default: null },

verificationStatus: {
  type: String,
  enum: ["pending", "approved", "rejected", "suspended", "expired_documents"],
  default: "pending",
},
verificationNote: { type: String, default: "" },
availabilityStatus: {
  type: String,
  enum: ["offline", "online_available", "ride_requested", "on_trip", "paused", "suspended"],
  default: "offline",
},
profilePhotoUrl: { type: String, default: "" },
vehiclePhotoUrl: { type: String, default: "" },
documents: {
  licenseUrl: { type: String, default: "" },
  licenseExpiry: { type: Date, default: null },
  licenseNumber: { type: String, default: "" },
  vehicleRegistrationUrl: { type: String, default: "" },
  vehicleRegistrationExpiry: { type: Date, default: null },
  insuranceUrl: { type: String, default: "" },
  insuranceExpiry: { type: Date, default: null },
  governmentIdUrl: { type: String, default: "" },
  backgroundCheckConsent: { type: Boolean, default: false },
  backgroundCheckStatus: { type: String, enum: ["not_started", "pending", "passed", "failed"], default: "not_started" },
<<<<<<< HEAD
  vehicleDocsUpToDate: { type: Boolean, default: false },
  reviews: {
    license: { status: { type: String, enum: ["missing", "pending", "approved", "rejected", "expired"], default: "missing" }, note: { type: String, default: "" }, reviewedAt: { type: Date, default: null } },
    registration: { status: { type: String, enum: ["missing", "pending", "approved", "rejected", "expired"], default: "missing" }, note: { type: String, default: "" }, reviewedAt: { type: Date, default: null } },
    insurance: { status: { type: String, enum: ["missing", "pending", "approved", "rejected", "expired"], default: "missing" }, note: { type: String, default: "" }, reviewedAt: { type: Date, default: null } },
    governmentId: { status: { type: String, enum: ["missing", "pending", "approved", "rejected"], default: "missing" }, note: { type: String, default: "" }, reviewedAt: { type: Date, default: null } },
    profilePhoto: { status: { type: String, enum: ["missing", "pending", "approved", "rejected"], default: "missing" }, note: { type: String, default: "" }, reviewedAt: { type: Date, default: null } },
    vehiclePhoto: { status: { type: String, enum: ["missing", "pending", "approved", "rejected"], default: "missing" }, note: { type: String, default: "" }, reviewedAt: { type: Date, default: null } }
  }
=======
  vehicleDocsUpToDate: { type: Boolean, default: false }
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
},

stats: {
  acceptedRides: { type: Number, default: 0 },
<<<<<<< HEAD
  rejectedRides: { type: Number, default: 0 },
=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
  cancelledRides: { type: Number, default: 0 },
  completedRides: { type: Number, default: 0 },
  kmTravelled: { type: Number, default: 0 }
},

earnings: {
<<<<<<< HEAD
  balance: { type: Number, default: 0 },
  cashCollectedTotal: { type: Number, default: 0 },
  commissionOwed: { type: Number, default: 0 },
  commissionSettled: { type: Number, default: 0 }
=======
  balance: { type: Number, default: 0 }
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
},

rating: {
  avg: { type: Number, default: 0 },
  count: { type: Number, default: 0 }
},

performanceScore: { type: Number, default: 100 },

    rides: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ride",
      },
    ],
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "inactive",
    },
    vehicle: {
      color: {
        type: String,
        required: true,
        minlength: [3, "Color must be at least 3 characters long"],
      },
      number: {
        type: String,
        required: true,
        minlength: [3, "Plate must be at least 3 characters long"],
      },
      capacity: {
        type: Number,
        required: true,
      },
      type: {
        type: String,
        required: true,
        enum: ["car", "bike"],
      },
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
<<<<<<< HEAD
=======
    emailVerified: {
      type: Boolean,
      default: false,
    },
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
  },
  { timestamps: true }
);

<<<<<<< HEAD
captainSchema.index({ location: "2dsphere" });

=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
captainSchema.statics.hashPassword = async function (password) {
  return await bcrypt.hash(password, 10);
};

captainSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    { id: this._id, userType: "captain" },
    process.env.JWT_SECRET,
    {
      expiresIn: "24h",
    }
  );
};

captainSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("Captain", captainSchema);
