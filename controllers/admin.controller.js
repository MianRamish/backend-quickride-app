const { validationResult } = require("express-validator");
const adminModel = require("../models/admin.model");
const captainModel = require("../models/captain.model");
const vehicleModel = require("../models/vehicle.model");
const rideModel = require("../models/ride.model");
const incentiveCampaignModel = require("../models/incentiveCampaign.model");
const payoutModel = require("../models/payout.model");
const userModel = require("../models/user.model");

async function ensureSeedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const exists = await adminModel.findOne({ email });
  if (exists) return;
  const passwordHash = await adminModel.hashPassword(password);
  await adminModel.create({ email, password: passwordHash, name: "Admin" });
}

module.exports.loginAdmin = async (req, res) => {
  await ensureSeedAdmin();

  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  const admin = await adminModel.findOne({ email: String(email).toLowerCase() });
  if (!admin) return res.status(401).json({ message: "Invalid credentials" });

  const ok = await admin.comparePassword(password);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const token = admin.generateAuthToken();
  res.cookie("token", token);
  return res.status(200).json({ token, admin: { id: admin._id, email: admin.email, name: admin.name } });
};

module.exports.listCaptains = async (_req, res) => {
  const captains = await captainModel
    .find({})
    .populate("activeVehicle")
    .sort({ createdAt: -1 });
  return res.json(captains);
};

module.exports.approveCaptain = async (req, res) => {
  const { id } = req.params;
  const captain = await captainModel.findById(id);
  if (!captain) return res.status(404).json({ message: "Captain not found" });
  captain.isApproved = true;
  captain.verificationStatus = "approved";
  captain.verificationNote = req.body?.verificationNote || "Approved by admin";
  captain.status = "active";
  captain.isOnline = false;
  captain.availabilityStatus = "offline";
  captain.documents.backgroundCheckStatus = captain.documents.backgroundCheckStatus === "failed" ? "failed" : "passed";
  captain.documents.vehicleDocsUpToDate = true;
  await captain.save();
  await captain.populate("activeVehicle");
  return res.json({ ok: true, captain });
};

module.exports.setCaptainDocStatus = async (req, res) => {
  const { id } = req.params;
  const { licenseUrl, licenseExpiry, licenseNumber, vehicleRegistrationUrl, vehicleRegistrationExpiry, insuranceUrl, insuranceExpiry, governmentIdUrl, backgroundCheckStatus, vehicleDocsUpToDate, verificationStatus, verificationNote } = req.body;
  const captain = await captainModel.findById(id);
  if (!captain) return res.status(404).json({ message: "Captain not found" });

  if (licenseUrl !== undefined) captain.documents.licenseUrl = licenseUrl;
  if (licenseNumber !== undefined) captain.documents.licenseNumber = licenseNumber;
  if (licenseExpiry !== undefined) captain.documents.licenseExpiry = licenseExpiry ? new Date(licenseExpiry) : null;
  if (vehicleRegistrationUrl !== undefined) captain.documents.vehicleRegistrationUrl = vehicleRegistrationUrl;
  if (vehicleRegistrationExpiry !== undefined) captain.documents.vehicleRegistrationExpiry = vehicleRegistrationExpiry ? new Date(vehicleRegistrationExpiry) : null;
  if (insuranceUrl !== undefined) captain.documents.insuranceUrl = insuranceUrl;
  if (insuranceExpiry !== undefined) captain.documents.insuranceExpiry = insuranceExpiry ? new Date(insuranceExpiry) : null;
  if (governmentIdUrl !== undefined) captain.documents.governmentIdUrl = governmentIdUrl;
  if (backgroundCheckStatus !== undefined) captain.documents.backgroundCheckStatus = backgroundCheckStatus;
  if (vehicleDocsUpToDate !== undefined) captain.documents.vehicleDocsUpToDate = !!vehicleDocsUpToDate;
  if (verificationStatus !== undefined) {
    captain.verificationStatus = verificationStatus;
    captain.isApproved = verificationStatus === "approved";
    captain.status = verificationStatus === "approved" ? "active" : "inactive";
    captain.isOnline = false;
    captain.availabilityStatus = "offline";
    if (verificationStatus === "approved") {
      captain.documents.backgroundCheckStatus = captain.documents.backgroundCheckStatus === "failed" ? "failed" : "passed";
      captain.documents.vehicleDocsUpToDate = true;
    }
  }
  if (verificationNote !== undefined) captain.verificationNote = verificationNote;

  await captain.save();
  return res.json({ ok: true });
};

module.exports.createVehicle = async (req, res) => {
  const { captainId, make, model, year, color, plateNumber, type, registrationUrl, registrationExpiry, insuranceUrl, insuranceExpiry } = req.body;
  if (!captainId || !type) return res.status(400).json({ message: "captainId and type are required" });
  if (!["car", "bike"].includes(type)) return res.status(400).json({ message: "Auto/rickshaw vehicle type is not available in Canada/US." });
  const captain = await captainModel.findById(captainId);
  if (!captain) return res.status(404).json({ message: "Captain not found" });

  const vehicle = await vehicleModel.create({
    captain: captainId, make, model, year, color, plateNumber, type, isActive: true,
    docs: {
      registrationUrl: registrationUrl || "",
      registrationExpiry: registrationExpiry ? new Date(registrationExpiry) : null,
      insuranceUrl: insuranceUrl || "",
      insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : null,
    }
  });
  captain.activeVehicle = vehicle._id;
  captain.vehicle.color = color || captain.vehicle.color;
  captain.vehicle.number = plateNumber || captain.vehicle.number;
  captain.vehicle.type = type;
  await captain.save();
  await vehicle.populate("captain");
  return res.status(201).json(vehicle);
};

module.exports.listVehicles = async (req, res) => {
  const { captainId } = req.query;
  const filter = captainId ? { captain: captainId } : {};
  const vehicles = await vehicleModel.find(filter).populate("captain", "fullname email phone verificationStatus isApproved").sort({ createdAt: -1 });
  return res.json(vehicles);
};

module.exports.updateVehicleDocs = async (req, res) => {
  const { id } = req.params;
  const { registrationUrl, registrationExpiry, insuranceUrl, insuranceExpiry, isActive } = req.body;

  const vehicle = await vehicleModel.findById(id);
  if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

  if (registrationUrl !== undefined) vehicle.docs.registrationUrl = registrationUrl;
  if (registrationExpiry !== undefined) vehicle.docs.registrationExpiry = registrationExpiry ? new Date(registrationExpiry) : null;
  if (insuranceUrl !== undefined) vehicle.docs.insuranceUrl = insuranceUrl;
  if (insuranceExpiry !== undefined) vehicle.docs.insuranceExpiry = insuranceExpiry ? new Date(insuranceExpiry) : null;
  if (isActive !== undefined) vehicle.isActive = !!isActive;

  await vehicle.save();
  return res.json({ ok: true });
};

module.exports.analyticsSummary = async (_req, res) => {
  const totalPassengers = await require("../models/user.model").countDocuments({});
  const totalCaptains = await captainModel.countDocuments({});
  const totalRides = await rideModel.countDocuments({});
  const completed = await rideModel.countDocuments({ status: "completed" });
  const cancelled = await rideModel.countDocuments({ status: "cancelled" });

  const revenueAgg = await rideModel.aggregate([
    { $match: { status: "completed" } },
    { $group: { _id: null, revenue: { $sum: "$fare" } } }
  ]);
  const revenue = revenueAgg?.[0]?.revenue || 0;

  return res.json({ totalPassengers, totalCaptains, totalRides, completed, cancelled, revenue });
};

module.exports.onlineCaptains = async (_req, res) => {
  const captains = await captainModel
    .find({ isOnline: true, socketId: { $ne: null } })
    .select("fullname email location vehicle isApproved isOnline availabilityStatus verificationStatus performanceScore rating stats documents activeVehicle");
  return res.json(captains);
};

module.exports.createIncentive = async (req, res) => {
  const { name, description, period, targetRides, rewardAmount, startsAt, endsAt } = req.body;
  const doc = await incentiveCampaignModel.create({
    name, description, period, targetRides, rewardAmount,
    startsAt: startsAt ? new Date(startsAt) : new Date(),
    endsAt: endsAt ? new Date(endsAt) : null,
    isActive: true
  });
  return res.status(201).json(doc);
};

module.exports.listIncentives = async (_req, res) => {
  const docs = await incentiveCampaignModel.find({}).sort({ createdAt: -1 });
  return res.json(docs);
};

module.exports.listReviews = async (_req, res) => {
  const rides = await rideModel.find({ rating: { $ne: null } }).populate("user").populate("captain").sort({ createdAt: -1 }).limit(200);
  return res.json(rides);
};

module.exports.hideReview = async (req, res) => {
  const { rideId } = req.body;
  const ride = await rideModel.findById(rideId);
  if (!ride) return res.status(404).json({ message: "Ride not found" });
  ride.review = "";
  await ride.save();
  return res.json({ ok: true });
};

module.exports.listPayouts = async (req, res) => {
  const { captainId } = req.query;
  const filter = captainId ? { captain: captainId } : {};
  const payouts = await payoutModel.find(filter).populate("captain").sort({ createdAt: -1 }).limit(500);
  return res.json(payouts);
};

module.exports.createPayout = async (req, res) => {
  const { captainId, amount, periodStart, periodEnd, status, method, reference } = req.body;
  if (!captainId || !amount || !periodStart || !periodEnd) return res.status(400).json({ message: "captainId, amount, periodStart, periodEnd required" });
  const payout = await payoutModel.create({
    captain: captainId,
    amount,
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodEnd),
    status: status || "pending",
    method: method || "bank",
    reference: reference || ""
  });
  return res.status(201).json(payout);
};


function pickDefined(source, allowed) {
  return allowed.reduce((acc, key) => {
    if (source[key] !== undefined) acc[key] = source[key];
    return acc;
  }, {});
}

module.exports.listUsers = async (req, res) => {
  const { search = "" } = req.query;
  const q = String(search).trim();
  const filter = q
    ? { $or: [
        { email: { $regex: q, $options: "i" } },
        { "fullname.firstname": { $regex: q, $options: "i" } },
        { "fullname.lastname": { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ] }
    : {};
  const users = await userModel.find(filter).sort({ createdAt: -1 }).limit(500).select("-password");
  return res.json(users);
};

module.exports.createUser = async (req, res) => {
  const { firstname, lastname = "", email, phone = "", password = "Password123!" } = req.body;
  if (!firstname || !email) return res.status(400).json({ message: "firstname and email are required" });
  const exists = await userModel.findOne({ email: String(email).trim().toLowerCase() });
  if (exists) return res.status(409).json({ message: "Passenger email already exists" });
  const passwordHash = await userModel.hashPassword(password);
  const user = await userModel.create({
    fullname: { firstname, lastname },
    email: String(email).trim().toLowerCase(),
    phone,
    password: passwordHash,
    emailVerified: true,
  });
  return res.status(201).json({ ...user.toObject(), password: undefined });
};

module.exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const update = {};
  if (req.body.firstname !== undefined || req.body.lastname !== undefined) {
    update.fullname = {
      firstname: req.body.firstname,
      lastname: req.body.lastname || "",
    };
  }
  Object.assign(update, pickDefined(req.body, ["email", "phone", "emailVerified"]));
  if (update.email) update.email = String(update.email).trim().toLowerCase();
  const user = await userModel.findByIdAndUpdate(id, update, { new: true }).select("-password");
  if (!user) return res.status(404).json({ message: "Passenger not found" });
  return res.json(user);
};

module.exports.deleteUser = async (req, res) => {
  const user = await userModel.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: "Passenger not found" });
  return res.json({ ok: true });
};

module.exports.createCaptain = async (req, res) => {
  const {
    firstname,
    lastname = "",
    email,
    phone = "",
    password = "Password123!",
    isApproved = false,
    status = "inactive",
    vehicleType = "car",
    vehicleColor = "Black",
    vehicleNumber = "TBD",
    vehicleCapacity = 4,
    longitude = -79.3832,
    latitude = 43.6532,
  } = req.body;
  if (!firstname || !email) return res.status(400).json({ message: "firstname and email are required" });
  const exists = await captainModel.findOne({ email: String(email).trim().toLowerCase() });
  if (exists) return res.status(409).json({ message: "Captain email already exists" });
  const passwordHash = await captainModel.hashPassword(password);
  const captain = await captainModel.create({
    fullname: { firstname, lastname },
    email: String(email).trim().toLowerCase(),
    phone,
    password: passwordHash,
    isApproved: !!isApproved,
    verificationStatus: isApproved ? "approved" : "pending",
    availabilityStatus: "offline",
    status,
    emailVerified: true,
    vehicle: {
      color: vehicleColor,
      number: vehicleNumber,
      capacity: Number(vehicleCapacity) || 4,
      type: vehicleType,
    },
    location: { type: "Point", coordinates: [Number(longitude), Number(latitude)] },
  });
  return res.status(201).json({ ...captain.toObject(), password: undefined });
};

module.exports.updateCaptain = async (req, res) => {
  const { id } = req.params;
  const captain = await captainModel.findById(id);
  if (!captain) return res.status(404).json({ message: "Captain not found" });

  if (req.body.firstname !== undefined) captain.fullname.firstname = req.body.firstname;
  if (req.body.lastname !== undefined) captain.fullname.lastname = req.body.lastname;
  if (req.body.email !== undefined) captain.email = String(req.body.email).trim().toLowerCase();
  if (req.body.phone !== undefined) captain.phone = req.body.phone;
  if (req.body.isApproved !== undefined) {
    captain.isApproved = !!req.body.isApproved;
    captain.verificationStatus = captain.isApproved ? "approved" : "pending";
  }
  if (req.body.verificationStatus !== undefined) {
    captain.verificationStatus = req.body.verificationStatus;
    captain.isApproved = req.body.verificationStatus === "approved";
  }
  if (req.body.isOnline !== undefined) captain.isOnline = !!req.body.isOnline;
  if (req.body.status !== undefined) captain.status = req.body.status;
  if (req.body.performanceScore !== undefined) captain.performanceScore = Number(req.body.performanceScore) || 0;
  if (req.body.vehicleType !== undefined) {
    if (!["car", "bike"].includes(req.body.vehicleType)) return res.status(400).json({ message: "Auto/rickshaw vehicle type is not available in Canada/US." });
    captain.vehicle.type = req.body.vehicleType;
  }
  if (req.body.vehicleColor !== undefined) captain.vehicle.color = req.body.vehicleColor;
  if (req.body.vehicleNumber !== undefined) captain.vehicle.number = req.body.vehicleNumber;
  if (req.body.vehicleCapacity !== undefined) captain.vehicle.capacity = Number(req.body.vehicleCapacity) || captain.vehicle.capacity;
  if (req.body.longitude !== undefined && req.body.latitude !== undefined) {
    captain.location = { type: "Point", coordinates: [Number(req.body.longitude), Number(req.body.latitude)] };
  }
  await captain.save();
  await captain.populate("activeVehicle");
  return res.json(captain);
};

module.exports.deleteCaptain = async (req, res) => {
  const captain = await captainModel.findByIdAndDelete(req.params.id);
  if (!captain) return res.status(404).json({ message: "Captain not found" });
  await vehicleModel.deleteMany({ captain: req.params.id });
  return res.json({ ok: true });
};

module.exports.updateVehicle = async (req, res) => {
  const { id } = req.params;
  const vehicle = await vehicleModel.findById(id);
  if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });
  ["make", "model", "year", "color", "plateNumber", "type", "isActive"].forEach((key) => {
    if (req.body[key] !== undefined) vehicle[key] = req.body[key];
  });
  if (req.body.type !== undefined && !["car", "bike"].includes(req.body.type)) return res.status(400).json({ message: "Auto/rickshaw vehicle type is not available in Canada/US." });
  if (req.body.registrationUrl !== undefined) vehicle.docs.registrationUrl = req.body.registrationUrl;
  if (req.body.registrationExpiry !== undefined) vehicle.docs.registrationExpiry = req.body.registrationExpiry ? new Date(req.body.registrationExpiry) : null;
  if (req.body.insuranceUrl !== undefined) vehicle.docs.insuranceUrl = req.body.insuranceUrl;
  if (req.body.insuranceExpiry !== undefined) vehicle.docs.insuranceExpiry = req.body.insuranceExpiry ? new Date(req.body.insuranceExpiry) : null;
  await vehicle.save();
  if (req.body.assignAsActive !== undefined && req.body.assignAsActive) {
    await captainModel.findByIdAndUpdate(vehicle.captain, { activeVehicle: vehicle._id });
  }
  return res.json(vehicle);
};

module.exports.deleteVehicle = async (req, res) => {
  const vehicle = await vehicleModel.findByIdAndDelete(req.params.id);
  if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });
  await captainModel.updateMany({ activeVehicle: req.params.id }, { $set: { activeVehicle: null } });
  return res.json({ ok: true });
};

module.exports.listRides = async (req, res) => {
  const { status } = req.query;
  const filter = status ? { status } : {};
  const rides = await rideModel.find(filter).populate("user").populate("captain").sort({ createdAt: -1 }).limit(500);
  return res.json(rides);
};

module.exports.updateRide = async (req, res) => {
  const ride = await rideModel.findById(req.params.id);
  if (!ride) return res.status(404).json({ message: "Ride not found" });
  if (req.body.status !== undefined) ride.status = req.body.status;
  if (req.body.paymentID !== undefined) ride.paymentID = req.body.paymentID;
  if (req.body.fare !== undefined) ride.fare = Number(req.body.fare) || ride.fare;
  if (req.body.currency !== undefined) ride.currency = req.body.currency;
  if (req.body.review !== undefined) ride.review = req.body.review;
  if (req.body.rating !== undefined) ride.rating = req.body.rating;
  if (req.body.cancelReasonText !== undefined) ride.cancelReason.text = req.body.cancelReasonText;
  await ride.save();
  await ride.populate("user");
  await ride.populate("captain");
  return res.json(ride);
};

module.exports.deleteRide = async (req, res) => {
  const ride = await rideModel.findByIdAndDelete(req.params.id);
  if (!ride) return res.status(404).json({ message: "Ride not found" });
  return res.json({ ok: true });
};

module.exports.updatePayout = async (req, res) => {
  const payout = await payoutModel.findById(req.params.id);
  if (!payout) return res.status(404).json({ message: "Payout not found" });
  ["amount", "status", "method", "reference"].forEach((key) => {
    if (req.body[key] !== undefined) payout[key] = req.body[key];
  });
  if (req.body.periodStart !== undefined) payout.periodStart = new Date(req.body.periodStart);
  if (req.body.periodEnd !== undefined) payout.periodEnd = new Date(req.body.periodEnd);
  if (req.body.status === "paid") payout.paidAt = new Date();
  await payout.save();
  return res.json(payout);
};

module.exports.updateIncentive = async (req, res) => {
  const campaign = await incentiveCampaignModel.findById(req.params.id);
  if (!campaign) return res.status(404).json({ message: "Campaign not found" });
  ["name", "description", "period", "targetRides", "rewardAmount", "isActive"].forEach((key) => {
    if (req.body[key] !== undefined) campaign[key] = req.body[key];
  });
  if (req.body.startsAt !== undefined) campaign.startsAt = new Date(req.body.startsAt);
  if (req.body.endsAt !== undefined) campaign.endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
  await campaign.save();
  return res.json(campaign);
};


module.exports.listEmergencies = async (req, res) => {
  const Emergency = require("../models/emergency.model");
  const { status } = req.query;
  const filter = status ? { status } : {};
  const items = await Emergency.find(filter).populate("user", "fullname email phone").populate("captain", "fullname email phone vehicle").populate("ride").sort({ createdAt: -1 }).limit(500);
  return res.json(items);
};

module.exports.updateEmergency = async (req, res) => {
  const Emergency = require("../models/emergency.model");
  const item = await Emergency.findById(req.params.id);
  if (!item) return res.status(404).json({ message: "Emergency report not found" });
  if (req.body.status !== undefined) item.status = req.body.status;
  if (req.body.adminNote !== undefined) item.adminNote = req.body.adminNote;
  if (["resolved", "dismissed"].includes(item.status)) item.resolvedAt = new Date();
  await item.save();
  await item.populate("user", "fullname email phone");
  await item.populate("captain", "fullname email phone vehicle");
  await item.populate("ride");
  return res.json(item);
};

module.exports.listComplaints = async (req, res) => {
  const Complaint = require("../models/complaint.model");
  const { status } = req.query;
  const filter = status ? { status } : {};
  const items = await Complaint.find(filter).populate("user", "fullname email phone").populate("captain", "fullname email phone vehicle").populate("ride").sort({ createdAt: -1 }).limit(500);
  return res.json(items);
};

module.exports.updateComplaint = async (req, res) => {
  const Complaint = require("../models/complaint.model");
  const item = await Complaint.findById(req.params.id);
  if (!item) return res.status(404).json({ message: "Complaint not found" });
  if (req.body.status !== undefined) item.status = req.body.status;
  if (req.body.adminNote !== undefined) item.adminNote = req.body.adminNote;
  if (["resolved", "dismissed"].includes(item.status)) item.resolvedAt = new Date();
  await item.save();
  await item.populate("user", "fullname email phone");
  await item.populate("captain", "fullname email phone vehicle");
  await item.populate("ride");
  return res.json(item);
};

module.exports.listWithdrawals = async (req, res) => {
  const Withdrawal = require("../models/withdrawal.model");
  const { status } = req.query;
  const filter = status ? { status } : {};
  const items = await Withdrawal.find(filter).populate("captain", "fullname email phone earnings vehicle").sort({ createdAt: -1 }).limit(500);
  return res.json(items);
};

module.exports.updateWithdrawal = async (req, res) => {
  const Withdrawal = require("../models/withdrawal.model");
  const item = await Withdrawal.findById(req.params.id).populate("captain");
  if (!item) return res.status(404).json({ message: "Withdrawal request not found" });
  const oldStatus = item.status;
  if (req.body.status !== undefined) item.status = req.body.status;
  if (req.body.adminNote !== undefined) item.adminNote = req.body.adminNote;
  if (["paid", "rejected"].includes(item.status)) item.processedAt = new Date();
  await item.save();
  if (oldStatus !== "paid" && item.status === "paid" && item.captain) {
    const captain = await captainModel.findById(item.captain._id);
    if (captain) {
      captain.earnings.balance = Math.max(0, Math.round(((captain.earnings?.balance || 0) - item.amount) * 100) / 100);
      await captain.save();
    }
  }
  await item.populate("captain", "fullname email phone earnings vehicle");
  return res.json(item);
};

module.exports.listScheduledRides = async (_req, res) => {
  const rides = await rideModel.find({ status: "scheduled" }).populate("user", "fullname email phone").populate("captain", "fullname email phone vehicle").sort({ scheduledFor: 1 }).limit(500);
  return res.json(rides);
};
