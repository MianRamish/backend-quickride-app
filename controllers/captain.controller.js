const asyncHandler = require("express-async-handler");
const captainModel = require("../models/captain.model");
const captainService = require("../services/captain.service");
const { validationResult } = require("express-validator");
const blacklistTokenModel = require("../models/blacklistToken.model");
const jwt = require("jsonwebtoken");
<<<<<<< HEAD
const { normalizeNigeriaPhone } = require("../utils/nigeria");
=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc

module.exports.registerCaptain = asyncHandler(async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json(errors.array());
  }

  const {
    fullname,
    email,
    password,
    phone,
    vehicle,
    documents = {},
    profilePhotoUrl = "",
    vehiclePhotoUrl = "",
    backgroundCheckConsent = false,
  } = req.body;

  const normalizedEmail = String(email).toLowerCase().trim();

  const alreadyExists = await captainModel.findOne({ email: normalizedEmail });

  if (alreadyExists) {
    return res.status(400).json({ message: "Captain already exists" });
  }

  const captain = await captainService.createCaptain(
    fullname.firstname,
    fullname.lastname,
    normalizedEmail,
    password,
    phone,
    vehicle.color,
    vehicle.number,
    vehicle.capacity,
    vehicle.type
  );

<<<<<<< HEAD
=======
  captain.emailVerified = process.env.DISABLE_EMAIL_VERIFICATION === "true";
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
  captain.profilePhotoUrl = profilePhotoUrl || "";
  captain.vehiclePhotoUrl = vehiclePhotoUrl || "";

  captain.documents = {
    ...captain.documents,
    ...documents,
    backgroundCheckConsent: Boolean(
      backgroundCheckConsent || documents.backgroundCheckConsent
    ),
    backgroundCheckStatus:
      backgroundCheckConsent || documents.backgroundCheckConsent
        ? "pending"
        : "not_started",
  };
<<<<<<< HEAD
  const reviewStatus = (present) => ({ status: present ? "pending" : "missing", note: "", reviewedAt: null });
  captain.documents.reviews = {
    license: reviewStatus(Boolean(documents.licenseUrl)),
    registration: reviewStatus(Boolean(documents.vehicleRegistrationUrl)),
    insurance: reviewStatus(Boolean(documents.insuranceUrl)),
    governmentId: reviewStatus(Boolean(documents.governmentIdUrl)),
    profilePhoto: reviewStatus(Boolean(profilePhotoUrl)),
    vehiclePhoto: reviewStatus(Boolean(vehiclePhotoUrl)),
  };
=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc

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
        registrationExpiry:
          captain.documents?.vehicleRegistrationExpiry || null,
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

<<<<<<< HEAD
  try {
    await require("../services/notification.service").notify({
      recipientType: "admin",
      type: "driver_verification",
      title: "New driver verification",
      body: `${captain.fullname.firstname} ${captain.fullname.lastname || ""}`.trim() + " submitted driver documents for review.",
      data: { captainId: captain._id },
    });
  } catch (_) {}

=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
  res.status(201).json({
    message:
      "Captain registered successfully. Your account is pending admin verification.",
    token,
    captain,
  });
});

<<<<<<< HEAD
=======
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

>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
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
<<<<<<< HEAD
  if (captain.status === "suspended" || captain.verificationStatus === "suspended") {
    return res.status(403).json({ message: "Your driver account has been suspended. Contact QuickRide support." });
  }
=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc

  const token = captain.generateAuthToken();
  res.cookie("token", token);
  res.json({ message: "Logged in successfully", token, captain });
});

module.exports.captainProfile = asyncHandler(async (req, res) => {
<<<<<<< HEAD
  const captain = await captainModel.findById(req.captain._id).populate("rides").populate("activeVehicle");
  res.status(200).json({ captain });
=======
  res.status(200).json({ captain: req.captain });
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
});

module.exports.updateCaptainProfile = asyncHandler(async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json(errors.array());
  }

  const { captainData } = req.body;
<<<<<<< HEAD
  if (captainData?.phone) captainData.phone = normalizeNigeriaPhone(captainData.phone);
=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
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
<<<<<<< HEAD
  const Settlement = require("../models/settlement.model");
  const captain = await captainModel.findById(req.captain._id);
  const rides = await rideModel.find({ captain: req.captain._id, status: "completed" }).sort({ completedAt: -1, createdAt: -1 }).limit(200);
  const payouts = await payoutModel.find({ captain: req.captain._id }).sort({ createdAt: -1 }).limit(20);
  const settlements = await Settlement.find({ captain: req.captain._id }).sort({ createdAt: -1 }).limit(50);
  const now = new Date();
  const dayStart = new Date(now); dayStart.setHours(0,0,0,0);
  const weekStart = new Date(now); const day = weekStart.getDay(); weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1)); weekStart.setHours(0,0,0,0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sumFrom = (from, field = "fare") => rides.filter((r) => new Date(r.completedAt || r.updatedAt) >= from).reduce((sum, r) => sum + Number(field === "fare" ? r.fare : r.earnings?.[field] || 0), 0);
  const totalGrossCash = rides.reduce((s, r) => s + (r.cashCollected ? Number(r.earnings?.gross || r.fare || 0) : 0), 0);
  const totalCommission = rides.reduce((s, r) => s + Number(r.earnings?.commissionAmount || 0), 0);
  const totalBonus = rides.reduce((s, r) => s + Number(r.earnings?.bonusAmount || 0), 0);
  return res.json({
    currency: "NGN", paymentMode: "cash",
    balance: captain?.earnings?.balance || 0,
    cashCollectedTotal: captain?.earnings?.cashCollectedTotal || totalGrossCash,
    commissionOwed: Math.max(0, captain?.earnings?.commissionOwed || 0),
    commissionSettled: captain?.earnings?.commissionSettled || 0,
    totalGrossCash: Math.round(totalGrossCash * 100) / 100,
    totalBonus: Math.round(totalBonus * 100) / 100,
    totalCommission: Math.round(totalCommission * 100) / 100,
    today: { grossCash: sumFrom(dayStart), commission: sumFrom(dayStart, "commissionAmount"), trips: rides.filter((r) => new Date(r.completedAt || r.updatedAt) >= dayStart).length },
    week: { grossCash: sumFrom(weekStart), commission: sumFrom(weekStart, "commissionAmount"), trips: rides.filter((r) => new Date(r.completedAt || r.updatedAt) >= weekStart).length },
    month: { grossCash: sumFrom(monthStart), commission: sumFrom(monthStart, "commissionAmount"), trips: rides.filter((r) => new Date(r.completedAt || r.updatedAt) >= monthStart).length },
    recentTrips: rides.slice(0, 30), payouts, settlements,
=======
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
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
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
<<<<<<< HEAD
    } else if (camp.period === "monthly") {
      start.setDate(1); start.setHours(0,0,0,0);
      end.setMonth(end.getMonth() + 1, 0); end.setHours(23,59,59,999);
=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
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
<<<<<<< HEAD
  const kilometres = c.stats?.kmTravelled || 0;
=======
  const miles = c.stats?.kmTravelled || 0;
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
  const ratingAvg = c.rating?.avg || 0;
  const ratingCount = c.rating?.count || 0;

  return res.json({
    performanceScore: c.performanceScore ?? 100,
    accepted,
    cancelled,
    completed,
<<<<<<< HEAD
    kilometres,
    kmTravelled: kilometres,
    miles: kilometres, // legacy response key retained for older frontend builds
=======
    miles,
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
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
<<<<<<< HEAD
  const reviews = captain.documents.reviews || {};
  const markPending = (key) => { reviews[key] = { ...(reviews[key]?.toObject ? reviews[key].toObject() : reviews[key] || {}), status: "pending", note: "", reviewedAt: null }; };
  if (documents.licenseUrl !== undefined) markPending("license");
  if (documents.vehicleRegistrationUrl !== undefined) markPending("registration");
  if (documents.insuranceUrl !== undefined) markPending("insurance");
  if (documents.governmentIdUrl !== undefined) markPending("governmentId");
  if (profilePhotoUrl !== undefined) markPending("profilePhoto");
  if (vehiclePhotoUrl !== undefined) markPending("vehiclePhoto");
  captain.documents.reviews = reviews;
=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
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

<<<<<<< HEAD
  try {
    await require("../services/notification.service").notify({
      recipientType: "admin",
      type: "driver_verification",
      title: "Driver documents updated",
      body: `${captain.fullname.firstname} updated verification documents.`,
      data: { captainId: captain._id },
    });
  } catch (_) {}

=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
  res.json({ message: "Documents submitted for review", captain });
});

module.exports.setAvailability = asyncHandler(async (req, res) => {
  const { online } = req.body;
<<<<<<< HEAD
  if (typeof online !== "boolean") {
    return res.status(400).json({ message: "online must be true or false." });
  }

  const captain = await captainModel.findById(req.captain._id);
  if (!captain) return res.status(404).json({ message: "Captain not found" });

=======
  const captain = await captainModel.findById(req.captain._id);
  if (!captain) return res.status(404).json({ message: "Captain not found" });
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
  if (!captain.isApproved || captain.verificationStatus !== "approved" || captain.status !== "active") {
    captain.isOnline = false;
    captain.availabilityStatus = captain.status === "suspended" ? "suspended" : "offline";
    await captain.save();
    return res.status(403).json({ message: "Your account must be approved by admin before going online." });
  }
<<<<<<< HEAD

  if (!online && captain.availabilityStatus === "on_trip") {
    return res.status(409).json({ message: "Complete your active trip before going offline." });
  }

  captain.isOnline = online;
  captain.availabilityStatus = online ? "online_available" : "offline";
  await captain.save();

  const liveConnected = Boolean(captain.socketId);
  let message = online ? "You're online and ready for ride requests." : "You're offline. New ride requests are paused.";
  if (online && !liveConnected) {
    message = "Online mode enabled. Reconnecting to live ride requests…";
  }

  res.json({ message, captain, liveConnected });
=======
  captain.isOnline = Boolean(online);
  captain.availabilityStatus = online ? "online_available" : "offline";
  await captain.save();
  res.json({ message: online ? "You are online" : "You are offline", captain });
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
});

module.exports.incomingRides = asyncHandler(async (req, res) => {
  const rideModel = require("../models/ride.model");
  const now = new Date();
  const rides = await rideModel.find({
    status: "pending",
    vehicle: req.captain.vehicle?.type,
<<<<<<< HEAD
    currentRequestCaptain: req.captain._id,
    currentRequestExpiresAt: { $gte: now },
  }).populate("user", "fullname email phone rating").sort({ currentRequestExpiresAt: 1 }).limit(3);
=======
    rejectedCaptains: { $ne: req.captain._id },
    $and: [
      { $or: [{ requestedCaptains: req.captain._id }, { requestedCaptains: { $size: 0 } }] },
      { $or: [{ requestExpiresAt: null }, { requestExpiresAt: { $gte: now } }] },
    ],
  }).populate("user", "fullname email phone").sort({ createdAt: -1 }).limit(20);
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
  res.json(rides);
});

module.exports.currentRide = asyncHandler(async (req, res) => {
  const rideModel = require("../models/ride.model");
  const ride = await rideModel.findOne({
    captain: req.captain._id,
<<<<<<< HEAD
    status: { $in: ["accepted", "arriving", "arrived", "ongoing"] },
=======
    status: { $in: ["accepted", "ongoing"] },
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
  }).populate("user", "fullname email phone").sort({ updatedAt: -1 });
  res.json(ride || null);
});


module.exports.listWithdrawals = asyncHandler(async (req, res) => {
  const Withdrawal = require("../models/withdrawal.model");
  const withdrawals = await Withdrawal.find({ captain: req.captain._id }).sort({ createdAt: -1 }).limit(100);
  res.json(withdrawals);
});

module.exports.requestWithdrawal = asyncHandler(async (req, res) => {
<<<<<<< HEAD
  const { amount, method = "bank", bankName = "", accountHolder = "", accountNumber = "", routingNumber = "", bankCode = "", payoutEmail = "", currency = "NGN" } = req.body;
=======
  const { amount, method = "bank", bankName = "", accountHolder = "", accountNumber = "", routingNumber = "", payoutEmail = "", currency = "USD" } = req.body;
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
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
<<<<<<< HEAD
    routingNumber: routingNumber || bankCode,
    bankCode: bankCode || routingNumber,
=======
    routingNumber,
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
    payoutEmail,
  });
  res.status(201).json(withdrawal);
});
<<<<<<< HEAD

module.exports.updateLocation = asyncHandler(async (req, res) => {
  const { ltd, lng, accuracy = null, heading = null, source = "gps", label = "" } = req.body;
  if (!Number.isFinite(Number(ltd)) || !Number.isFinite(Number(lng))) return res.status(400).json({ message: "Valid latitude and longitude are required" });
  const locationSource = source === "manual" ? "manual" : "gps";
  const latitude = Number(ltd);
  const longitude = Number(lng);
  if (locationSource === "manual" && (latitude < 4.0 || latitude > 14.5 || longitude < 2.0 || longitude > 15.5)) {
    return res.status(400).json({ message: "Pinned driver location must be within Nigeria." });
  }
  const now = new Date();
  const update = {
    location: { type: "Point", coordinates: [longitude, latitude] },
    lastLocationAt: now,
    lastLocationAccuracy: Number.isFinite(Number(accuracy)) ? Number(accuracy) : null,
    lastLocationHeading: Number.isFinite(Number(heading)) ? Number(heading) : null,
    lastLocationSource: locationSource,
  };
  if (locationSource === "manual") {
    update.manualLocationConfirmedAt = now;
    update.manualLocationLabel = String(label || "Pinned driver location").trim().slice(0, 180);
  } else {
    update.manualLocationLabel = "";
    update.manualLocationConfirmedAt = null;
  }
  const captain = await captainModel.findByIdAndUpdate(req.captain._id, update, { new: true });
  res.json({
    ok: true,
    lastLocationAt: captain.lastLocationAt,
    lastLocationSource: captain.lastLocationSource,
    manualLocationLabel: captain.manualLocationLabel,
  });
});

module.exports.notifications = asyncHandler(async (req, res) => {
  const service = require("../services/notification.service");
  res.json(await service.listFor({ recipientType: "captain", recipient: req.captain._id, limit: 80 }));
});

module.exports.readNotification = asyncHandler(async (req, res) => {
  const service = require("../services/notification.service");
  const item = await service.markRead({ id: req.params.id, recipientType: "captain", recipient: req.captain._id });
  if (!item) return res.status(404).json({ message: "Notification not found" });
  res.json(item);
});

module.exports.settlements = asyncHandler(async (req, res) => {
  const Settlement = require("../models/settlement.model");
  const items = await Settlement.find({ captain: req.captain._id }).populate("ride", "pickup destination fare completedAt").sort({ createdAt: -1 }).limit(100);
  res.json(items);
});

module.exports.createComplaint = asyncHandler(async (req, res) => {
  const Complaint = require("../models/complaint.model");
  const rideModel = require("../models/ride.model");
  const { rideId = null, category = "passenger_behavior", description = "" } = req.body;
  if (String(description).trim().length < 5) return res.status(400).json({ message: "Describe the issue" });
  const ride = rideId ? await rideModel.findOne({ _id: rideId, captain: req.captain._id }) : null;
  if (!ride?.user && !req.body.userId) return res.status(400).json({ message: "A ride is required for driver support cases" });
  const complaint = await Complaint.create({ user: ride?.user || req.body.userId, captain: req.captain._id, ride: ride?._id || null, category, description });
  await require("../services/notification.service").notify({ recipientType: "admin", type: "complaint", title: "New driver support case", body: `${category}: ${String(description).slice(0, 180)}`, ride: ride?._id || null, data: { complaintId: complaint._id } });
  res.status(201).json(complaint);
});

module.exports.pushConfig = asyncHandler(async (_req, res) => {
  const push = require("../services/push.service");
  res.json(push.getPublicConfig());
});

module.exports.savePushSubscription = asyncHandler(async (req, res) => {
  const push = require("../services/push.service");
  const item = await push.saveSubscription({
    recipientType: "captain",
    recipient: req.captain._id,
    subscription: req.body.subscription,
    userAgent: req.headers["user-agent"] || "",
  });
  res.status(201).json({ ok: true, id: item._id });
});

module.exports.removePushSubscription = asyncHandler(async (req, res) => {
  const push = require("../services/push.service");
  await push.removeSubscription({ recipientType: "captain", recipient: req.captain._id, endpoint: req.body.endpoint });
  res.json({ ok: true });
});
=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
