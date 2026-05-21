const asyncHandler = require("express-async-handler");
const captainModel = require("../models/captain.model");
const captainService = require("../services/captain.service");
const { validationResult } = require("express-validator");
const blacklistTokenModel = require("../models/blacklistToken.model");
const jwt = require("jsonwebtoken");

module.exports.registerCaptain = asyncHandler(async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json(errors.array());
  }

  const { fullname, email, password, phone, vehicle, documents = {}, profilePhotoUrl = "", vehiclePhotoUrl = "", backgroundCheckConsent = false } = req.body;

  const alreadyExists = await captainModel.findOne({ email });

  if (alreadyExists) {
    return res.status(400).json({ message: "Captain already exists" });
  }

  const captain = await captainService.createCaptain(
    fullname.firstname,
    fullname.lastname,
    email,
    password,
    phone,
    vehicle.color,
    vehicle.number,
    vehicle.capacity,
    vehicle.type
  );

  captain.profilePhotoUrl = profilePhotoUrl || "";
  captain.vehiclePhotoUrl = vehiclePhotoUrl || "";
  captain.documents = {
    ...captain.documents,
    ...documents,
    backgroundCheckConsent: Boolean(backgroundCheckConsent || documents.backgroundCheckConsent),
    backgroundCheckStatus: backgroundCheckConsent || documents.backgroundCheckConsent ? "pending" : "not_started",
  };
  captain.verificationStatus = "pending";
  captain.isApproved = false;
  captain.status = "inactive";
  captain.availabilityStatus = "offline";
  await captain.save();

  try {
    const Vehicle = require("../models/vehicle.model");
    const linkedVehicle = await Vehicle.create({
      captain: captain._id,
      color: vehicle.color || "",
      plateNumber: vehicle.number || "",
      type: vehicle.type,
      isActive: true,
      docs: {
        registrationUrl: captain.documents?.vehicleRegistrationUrl || "",
        registrationExpiry: captain.documents?.vehicleRegistrationExpiry || null,
        insuranceUrl: captain.documents?.insuranceUrl || "",
        insuranceExpiry: captain.documents?.insuranceExpiry || null,
      },
    });
    captain.activeVehicle = linkedVehicle._id;
    await captain.save();
  } catch (e) {
    // Do not block captain registration if linked vehicle creation fails.
  }

  const token = captain.generateAuthToken();
  res
    .status(201)
    .json({ message: "Captain registered successfully. Your account is pending admin verification.", token, captain });
});

module.exports.verifyEmail = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(errors.array());
  }

  const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: "Invalid verification link", error: "Token is required" });
    }
  
    let decodedTokenData = jwt.verify(token, process.env.JWT_SECRET);
    if (!decodedTokenData || decodedTokenData.purpose !== "email-verification") {
      return res.status(400).json({ message: "You're trying to use an invalid or expired verification link", error: "Invalid token" });
    }
  
    let captain = await captainModel.findOne({ _id: decodedTokenData.id });
  
    if (!captain) {
      return res.status(404).json({ message: "User not found. Please ask for another verification link." });
    }
  
    if (captain.emailVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }
  
    captain.emailVerified = true;
    await captain.save();
  
    res.status(200).json({
      message: "Email verified successfully",
    });
});

module.exports.loginCaptain = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(errors.array());
  }

  const { email, password } = req.body;

  const captain = await captainModel.findOne({ email: String(email).toLowerCase().trim() }).select("+password");
  if (!captain) {
    return res.status(404).json({ message: "Invalid email or password" });
  }

  const isMatch = await captain.comparePassword(password);

  if (!isMatch) {
    return res.status(404).json({ message: "Invalid email or password" });
  }

  const token = captain.generateAuthToken();
  res.cookie("token", token);
  res.json({ message: "Logged in successfully", token, captain });
});

module.exports.captainProfile = asyncHandler(async (req, res) => {
  res.status(200).json({ captain: req.captain });
});

module.exports.updateCaptainProfile = asyncHandler(async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json(errors.array());
  }

  const { captainData } = req.body;
  const updatedCaptainData = await captainModel.findOneAndUpdate(
    { email: req.captain.email },
    captainData,
    { new: true }
  );

  res.status(200).json({
    message: "Profile updated successfully",
    user: updatedCaptainData,
  });
});

module.exports.logoutCaptain = asyncHandler(async (req, res) => {
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
      return res.status(400).json({ message: "This password reset link has expired or is no longer valid. Please request a new one to continue" });
    } else {
      return res.status(400).json({ message: "The password reset link is invalid or has already been used. Please request a new one to proceed", error: err });
    }
  }

  const captain = await captainModel.findById(payload.id);
  if (!captain) return res.status(404).json({ message: "User not found. Please check your credentials and try again" });

  captain.password = await captainModel.hashPassword(password);
  await captain.save();

  res.status(200).json({ message: "Your password has been successfully reset. You can now log in with your new credentials" });
});


module.exports.earningsSummary = async (req, res) => {
  const rideModel = require("../models/ride.model");
  const payoutModel = require("../models/payout.model");
  const rides = await rideModel.find({ captain: req.captain._id, status: "completed" }).sort({ createdAt: -1 }).limit(50);
  const payouts = await payoutModel.find({ captain: req.captain._id }).sort({ createdAt: -1 }).limit(20);

  const totalNet = rides.reduce((s, r) => s + (r.earnings?.netToCaptain || 0), 0);
  const totalBonus = rides.reduce((s, r) => s + (r.earnings?.bonusAmount || 0), 0);
  const totalCommission = rides.reduce((s, r) => s + (r.earnings?.commissionAmount || 0), 0);

  return res.json({
    currency: "USD",
    balance: req.captain.earnings?.balance || 0,
    totalNet: Math.round(totalNet * 100) / 100,
    totalBonus: Math.round(totalBonus * 100) / 100,
    totalCommission: Math.round(totalCommission * 100) / 100,
    recentTrips: rides,
    payouts,
  });
};

module.exports.incentives = async (req, res) => {
  const IncentiveCampaign = require("../models/incentiveCampaign.model");
  const rideModel = require("../models/ride.model");
  const now = new Date();

  const campaigns = await IncentiveCampaign.find({ isActive: true, startsAt: { $lte: now }, $or: [{ endsAt: null }, { endsAt: { $gte: now } }] });

  const progress = [];
  for (const camp of campaigns) {
    const start = new Date(now);
    const end = new Date(now);
    if (camp.period === "daily") {
      start.setHours(0,0,0,0); end.setHours(23,59,59,999);
    } else {
      const day = start.getDay();
      const diff = (day === 0 ? 6 : day - 1);
      start.setDate(start.getDate() - diff);
      start.setHours(0,0,0,0);
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 7);
    }

    const completedCount = await rideModel.countDocuments({
      captain: req.captain._id,
      status: "completed",
      createdAt: { $gte: start, $lte: end }
    });

    progress.push({
      campaign: camp,
      completedCount,
      target: camp.targetRides,
      remaining: Math.max(0, camp.targetRides - completedCount),
      percent: Math.min(100, Math.round((completedCount / camp.targetRides) * 100))
    });
  }

  return res.json(progress);
};

module.exports.performance = async (req, res) => {
  const c = req.captain;
  const accepted = c.stats?.acceptedRides || 0;
  const cancelled = c.stats?.cancelledRides || 0;
  const completed = c.stats?.completedRides || 0;
  const miles = c.stats?.kmTravelled || 0;
  const ratingAvg = c.rating?.avg || 0;
  const ratingCount = c.rating?.count || 0;

  return res.json({
    performanceScore: c.performanceScore ?? 100,
    accepted,
    cancelled,
    completed,
    miles,
    ratingAvg,
    ratingCount,
    docs: c.documents || {},
    approved: c.isApproved,
    online: c.isOnline,
  });
};


module.exports.updateDocuments = asyncHandler(async (req, res) => {
  const { documents = {}, profilePhotoUrl, vehiclePhotoUrl, backgroundCheckConsent } = req.body;
  const captain = await captainModel.findById(req.captain._id);
  if (!captain) return res.status(404).json({ message: "Captain not found" });

  captain.documents = {
    ...captain.documents,
    ...documents,
    backgroundCheckConsent: backgroundCheckConsent !== undefined ? Boolean(backgroundCheckConsent) : captain.documents.backgroundCheckConsent,
  };
  if (profilePhotoUrl !== undefined) captain.profilePhotoUrl = profilePhotoUrl;
  if (vehiclePhotoUrl !== undefined) captain.vehiclePhotoUrl = vehiclePhotoUrl;
  captain.verificationStatus = "pending";
  captain.verificationNote = "Updated documents submitted for admin review";
  captain.isApproved = false;
  captain.status = "inactive";
  captain.isOnline = false;
  captain.availabilityStatus = "offline";
  await captain.save();

  try {
    const Vehicle = require("../models/vehicle.model");
    const vehiclePayload = {};
    if (documents.vehicleRegistrationUrl !== undefined) vehiclePayload["docs.registrationUrl"] = documents.vehicleRegistrationUrl;
    if (documents.vehicleRegistrationExpiry !== undefined) vehiclePayload["docs.registrationExpiry"] = documents.vehicleRegistrationExpiry ? new Date(documents.vehicleRegistrationExpiry) : null;
    if (documents.insuranceUrl !== undefined) vehiclePayload["docs.insuranceUrl"] = documents.insuranceUrl;
    if (documents.insuranceExpiry !== undefined) vehiclePayload["docs.insuranceExpiry"] = documents.insuranceExpiry ? new Date(documents.insuranceExpiry) : null;
    if (Object.keys(vehiclePayload).length) {
      await Vehicle.findOneAndUpdate(
        { captain: captain._id },
        { $set: { ...vehiclePayload, isActive: true } },
        { upsert: false }
      );
    }
  } catch (e) {
    // keep document update successful even if linked vehicle is missing
  }

  res.json({ message: "Documents submitted for review", captain });
});

module.exports.setAvailability = asyncHandler(async (req, res) => {
  const { online } = req.body;
  const captain = await captainModel.findById(req.captain._id);
  if (!captain) return res.status(404).json({ message: "Captain not found" });
  if (!captain.isApproved || captain.verificationStatus !== "approved" || captain.status !== "active") {
    captain.isOnline = false;
    captain.availabilityStatus = captain.status === "suspended" ? "suspended" : "offline";
    await captain.save();
    return res.status(403).json({ message: "Your account must be approved by admin before going online." });
  }
  captain.isOnline = Boolean(online);
  captain.availabilityStatus = online ? "online_available" : "offline";
  await captain.save();
  res.json({ message: online ? "You are online" : "You are offline", captain });
});

module.exports.incomingRides = asyncHandler(async (req, res) => {
  const rideModel = require("../models/ride.model");
  const now = new Date();
  const rides = await rideModel.find({
    status: "pending",
    vehicle: req.captain.vehicle?.type,
    rejectedCaptains: { $ne: req.captain._id },
    $and: [
      { $or: [{ requestedCaptains: req.captain._id }, { requestedCaptains: { $size: 0 } }] },
      { $or: [{ requestExpiresAt: null }, { requestExpiresAt: { $gte: now } }] },
    ],
  }).populate("user", "fullname email phone").sort({ createdAt: -1 }).limit(20);
  res.json(rides);
});

module.exports.currentRide = asyncHandler(async (req, res) => {
  const rideModel = require("../models/ride.model");
  const ride = await rideModel.findOne({
    captain: req.captain._id,
    status: { $in: ["accepted", "ongoing"] },
  }).populate("user", "fullname email phone").sort({ updatedAt: -1 });
  res.json(ride || null);
});


module.exports.listWithdrawals = asyncHandler(async (req, res) => {
  const Withdrawal = require("../models/withdrawal.model");
  const withdrawals = await Withdrawal.find({ captain: req.captain._id }).sort({ createdAt: -1 }).limit(100);
  res.json(withdrawals);
});

module.exports.requestWithdrawal = asyncHandler(async (req, res) => {
  const { amount, method = "bank", bankName = "", accountHolder = "", accountNumber = "", routingNumber = "", payoutEmail = "", currency = "USD" } = req.body;
  const numericAmount = Number(amount);
  if (!numericAmount || numericAmount <= 0) return res.status(400).json({ message: "Enter a valid withdrawal amount." });
  const captain = await captainModel.findById(req.captain._id);
  if (!captain) return res.status(404).json({ message: "Captain not found" });
  const balance = Number(captain.earnings?.balance || 0);
  if (numericAmount > balance) return res.status(400).json({ message: "Withdrawal amount exceeds available balance." });
  const Withdrawal = require("../models/withdrawal.model");
  const withdrawal = await Withdrawal.create({
    captain: captain._id,
    amount: Math.round(numericAmount * 100) / 100,
    currency,
    method,
    bankName,
    accountHolder,
    accountNumber,
    routingNumber,
    payoutEmail,
  });
  res.status(201).json(withdrawal);
});
