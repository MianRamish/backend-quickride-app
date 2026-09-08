const asyncHandler = require("express-async-handler");
const userModel = require("../models/user.model");
const userService = require("../services/user.service");
const { validationResult } = require("express-validator");
const blacklistTokenModel = require("../models/blacklistToken.model");
const jwt = require("jsonwebtoken");
const { normalizeNigeriaPhone } = require("../utils/nigeria");

module.exports.registerUser = asyncHandler(async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json(errors.array());
  }

  const { fullname, email, password, phone, referralCode = "" } = req.body;

  const normalizedEmail = String(email).toLowerCase().trim();

  const alreadyExists = await userModel.findOne({ email: normalizedEmail });

  if (alreadyExists) {
    return res.status(400).json({ message: "User already exists" });
  }

  const user = await userService.createUser(
    fullname.firstname,
    fullname.lastname,
    normalizedEmail,
    password,
    phone
  );


  if (referralCode) {
    const referrer = await userModel.findOne({ referralCode: String(referralCode).trim().toUpperCase() });
    if (referrer && String(referrer._id) !== String(user._id)) {
      user.referredBy = referrer.referralCode;
      await user.save();
    }
  }

  const token = user.generateAuthToken();

  res.status(201).json({
    message: "User registered successfully",
    token,
    user,
  });
});

module.exports.loginUser = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(errors.array());
  }

  const { email, password } = req.body;

  const user = await userModel.findOne({ email: String(email).toLowerCase().trim() }).select("+password");
  if (!user) {
    return res.status(404).json({ message: "Invalid email or password" });
  }

  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    return res.status(404).json({ message: "Invalid email or password" });
  }
  if (user.status === "suspended") {
    return res.status(403).json({ message: "Your passenger account has been suspended. Contact QuickRide support." });
  }

  const token = user.generateAuthToken();
  res.cookie("token", token);

  res.json({
    message: "Logged in successfully",
    token,
    user: {
      _id: user._id,
      fullname: {
        firstname: user.fullname.firstname,
        lastname: user.fullname.lastname,
      },
      email: user.email,
      phone: user.phone,
      rides: user.rides,
      socketId: user.socketId,
    },
  });
});

module.exports.userProfile = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user._id).populate("rides");
  res.status(200).json({ user });
});

module.exports.updateUserProfile = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(errors.array());
  }

  const { fullname,  phone } = req.body;

  const updatedUserData = await userModel.findOneAndUpdate(
    { _id: req.user._id },
    {
      fullname: fullname,
      phone: normalizeNigeriaPhone(phone),
    },
    { new: true }
  );

  res
    .status(200)
    .json({ message: "Profile updated successfully", user: updatedUserData });
});

module.exports.logoutUser = asyncHandler(async (req, res) => {
  res.clearCookie("token");
  const token = req.cookies.token || req.headers.token;

  await blacklistTokenModel.create({ token });

  res.status(200).json({ message: "Logged out successfully" });
});

module.exports.resetPassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(errors.array());
  }

  const { token, password } = req.body;
  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(400).json({
        message:
          "This password reset link has expired or is no longer valid. Please request a new one to continue",
      });
    } else {
      return res.status(400).json({
        message:
          "The password reset link is invalid or has already been used. Please request a new one to proceed",
        error: err,
      });
    }
  }

  const user = await userModel.findById(payload.id);
  if (!user)
    return res.status(404).json({
      message: "User not found. Please check your credentials and try again",
    });

  user.password = await userModel.hashPassword(password);
  await user.save();

  res.status(200).json({
    message:
      "Your password has been successfully reset. You can now log in with your new credentials",
  });
});

module.exports.savedPlaces = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user._id).select("savedPlaces");
  res.json(user?.savedPlaces || []);
});

module.exports.addSavedPlace = asyncHandler(async (req, res) => {
  const { label = "Saved place", address, ltd = null, lng = null } = req.body;
  if (!address || String(address).trim().length < 3) return res.status(400).json({ message: "Address is required" });
  const user = await userModel.findById(req.user._id);
  user.savedPlaces = (user.savedPlaces || []).filter((place) => !(place.label === label && place.address === address));
  user.savedPlaces.unshift({ label: String(label).slice(0, 30), address: String(address).trim(), ltd: Number.isFinite(Number(ltd)) ? Number(ltd) : null, lng: Number.isFinite(Number(lng)) ? Number(lng) : null });
  user.savedPlaces = user.savedPlaces.slice(0, 12);
  await user.save();
  res.status(201).json(user.savedPlaces);
});

module.exports.removeSavedPlace = asyncHandler(async (req, res) => {
  const user = await userModel.findByIdAndUpdate(req.user._id, { $pull: { savedPlaces: { _id: req.params.id } } }, { new: true });
  res.json(user?.savedPlaces || []);
});

module.exports.emergencyContacts = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user._id).select("emergencyContacts");
  res.json(user?.emergencyContacts || []);
});

module.exports.addEmergencyContact = asyncHandler(async (req, res) => {
  const { name, phone, relationship = "" } = req.body;
  if (!name || !phone) return res.status(400).json({ message: "Name and phone are required" });
  const user = await userModel.findById(req.user._id);
  user.emergencyContacts.push({ name: String(name).trim(), phone: normalizeNigeriaPhone(phone) || String(phone).trim(), relationship: String(relationship).trim() });
  user.emergencyContacts = user.emergencyContacts.slice(-5);
  await user.save();
  res.status(201).json(user.emergencyContacts);
});

module.exports.removeEmergencyContact = asyncHandler(async (req, res) => {
  const user = await userModel.findByIdAndUpdate(req.user._id, { $pull: { emergencyContacts: { _id: req.params.id } } }, { new: true });
  res.json(user?.emergencyContacts || []);
});

module.exports.notifications = asyncHandler(async (req, res) => {
  const service = require("../services/notification.service");
  const items = await service.listFor({ recipientType: "user", recipient: req.user._id, limit: 80 });
  res.json(items);
});

module.exports.readNotification = asyncHandler(async (req, res) => {
  const service = require("../services/notification.service");
  const item = await service.markRead({ id: req.params.id, recipientType: "user", recipient: req.user._id });
  if (!item) return res.status(404).json({ message: "Notification not found" });
  res.json(item);
});

module.exports.pushConfig = asyncHandler(async (_req, res) => {
  const push = require("../services/push.service");
  res.json(push.getPublicConfig());
});

module.exports.savePushSubscription = asyncHandler(async (req, res) => {
  const push = require("../services/push.service");
  const item = await push.saveSubscription({
    recipientType: "user",
    recipient: req.user._id,
    subscription: req.body.subscription,
    userAgent: req.headers["user-agent"] || "",
  });
  res.status(201).json({ ok: true, id: item._id });
});

module.exports.removePushSubscription = asyncHandler(async (req, res) => {
  const push = require("../services/push.service");
  await push.removeSubscription({ recipientType: "user", recipient: req.user._id, endpoint: req.body.endpoint });
  res.json({ ok: true });
});
