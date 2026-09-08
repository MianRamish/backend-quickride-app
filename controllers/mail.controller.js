const asyncHandler = require("express-async-handler");
const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");

const { sendMail } = require("../services/mail.service");
let { fillTemplate } = require("../templates/mail.template");

const captainModel = require("../models/captain.model");
const userModel = require("../models/user.model");

module.exports.forgotPassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(errors.array());
  }

  const { email } = req.body;
  const { userType } = req.params;

  let user = null;
  if (userType === "user") {
    user = await userModel.findOne({ email });
  } else if (userType === "captain") {
    user = await captainModel.findOne({ email });
  }
  if (!user) return res.status(404).json({ message: "User not found. Please check your credentials and try again" });

  const token = jwt.sign(
    { id: user._id, type: "user" },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  const resetLink = `${process.env.CLIENT_URL}/${userType}/reset-password?token=${token}`;

  let mailHtml = fillTemplate({
    title: "Reset Password",
    name: user.fullname.firstname,
    message: "We received a request to reset the password associated with your QuickRide account. If you made this request, please click the button below to proceed.",
    cta_link: resetLink,
    cta_text: "Reset Password",
    note: "If you didn’t request a password reset, you can safely ignore this email. Your current password will remain unchanged. <br/>This password-reset link is valid for <strong>15 minutes</strong> only.",
  });

  await sendMail(user.email, "QuickRide - Reset Password", mailHtml);

  res.status(200).json({ message: "Reset password email sent successfully" });
});

// Reset Password
module.exports.resetPassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json(errors.array());

  const { token, password } = req.body;
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }

  const user = await userModel.findById(payload.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  user.password = await userModel.hashPassword(password);
  await user.save();

  res.status(200).json({ message: "Password reset successfully" });
});
