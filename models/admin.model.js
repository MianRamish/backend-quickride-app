const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const adminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, default: "Admin" }
  },
  { timestamps: true }
);

adminSchema.statics.hashPassword = async function (password) {
  return await bcrypt.hash(password, 10);
};

adminSchema.methods.generateAuthToken = function () {
  return jwt.sign({ id: this._id, userType: "admin" }, process.env.JWT_SECRET, { expiresIn: "24h" });
};

adminSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("Admin", adminSchema);
