const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
  {
    fullname: {
      firstname: {
        type: String,
        required: true,
        minlength: 3,
      },
      lastname: {
        type: String,
        minlength: 3,
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
      trim: true,
      maxlength: 20,
    },
    socketId: {
      type: String,
    },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    savedPlaces: [{
      label: { type: String, trim: true },
      address: { type: String, required: true },
      ltd: { type: Number, default: null },
      lng: { type: Number, default: null },
    }],
    emergencyContacts: [{
      name: { type: String, required: true },
      phone: { type: String, required: true },
      relationship: { type: String, default: "" },
    }],
    rating: {
      avg: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    referralCode: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
    referredBy: { type: String, default: "", uppercase: true, trim: true },
    rides: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ride",
      },
    ],
  },
  { timestamps: true }
);

userSchema.statics.hashPassword = async function (password) {
  return await bcrypt.hash(password, 10);
};

userSchema.methods.generateAuthToken = function () {
  return jwt.sign({ id: this._id, userType: "user" }, process.env.JWT_SECRET, {
    expiresIn: "24h",
  });
};

userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);
