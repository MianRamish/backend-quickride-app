const crypto = require("crypto");
const { validationResult } = require("express-validator");
const rideService = require("../services/ride.service");
const matchingService = require("../services/matching.service");
const notificationService = require("../services/notification.service");
const operationsService = require("../services/operations.service");
const { sendMessageToSocketId } = require("../socket");
const rideModel = require("../models/ride.model");
const userModel = require("../models/user.model");
const captainModel = require("../models/captain.model");
const paymentService = require("../services/payment.service");
const promoService = require("../services/promo.service");

const USER_CANCEL_REASONS = [
  { code: "DRIVER_LATE", label: "Driver is taking too long" },
  { code: "DRIVER_ASKED", label: "Driver asked me to cancel" },
  { code: "WRONG_PICKUP", label: "Pickup location is wrong" },
  { code: "CHANGE_OF_PLANS", label: "My plans changed" },
  { code: "FOUND_OTHER_RIDE", label: "I found another ride" },
  { code: "OTHER", label: "Other" },
];
const CAPTAIN_CANCEL_REASONS = [
  { code: "PASSENGER_NO_SHOW", label: "Passenger did not show" },
  { code: "PASSENGER_UNREACHABLE", label: "Passenger is not responding" },
  { code: "UNSAFE_PICKUP", label: "Unsafe pickup situation" },
  { code: "WRONG_LOCATION", label: "Pickup location is incorrect" },
  { code: "VEHICLE_ISSUE", label: "Vehicle issue" },
  { code: "OTHER", label: "Other" },
];

function errorsOrNull(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
}

async function notifyRideUser(ride, event, title, body) {
  if (ride?.user?.socketId) sendMessageToSocketId(ride.user.socketId, { event, data: ride });
  if (ride?.user?._id) await notificationService.notify({ recipientType: "user", recipient: ride.user._id, type: "ride", title, body, ride: ride._id });
}

module.exports.getPaymentMethods = async (_req, res) => {
  return res.status(200).json({ defaultMethod: "cash", methods: paymentService.getPaymentMethods() });
};

module.exports.getCancellationReasons = async (_req, res) => res.json({ user: USER_CANCEL_REASONS, captain: CAPTAIN_CANCEL_REASONS });

module.exports.chatDetails = async (req, res) => {
  try {
    const ride = await rideModel.findById(req.params.id)
      .populate("user", "socketId fullname phone")
      .populate("captain", "socketId fullname phone");
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    const isUser = req.userType === "user" && String(ride.user?._id) === String(req.user?._id);
    const isCaptain = req.userType === "captain" && String(ride.captain?._id) === String(req.captain?._id);
    const isAdmin = req.userType === "admin";
    if (!isUser && !isCaptain && !isAdmin) return res.status(403).json({ message: "You are not part of this ride" });
    return res.json({
      user: { fullname: ride.user?.fullname, _id: ride.user?._id },
      captain: { fullname: ride.captain?.fullname, _id: ride.captain?._id },
      messages: ride.messages,
      status: ride.status,
      chatClosed: Boolean(ride.chatClosedAt || ["completed", "cancelled"].includes(ride.status)),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

module.exports.createRide = async (req, res) => {
  if (errorsOrNull(req, res)) return;
  const { pickup, destination, vehicleType, rideMode = "now", scheduledFor = null, paymentMethod = "cash", promoCode = "" } = req.body;
  try {
    const ride = await rideService.createRide({ user: req.user._id, pickup, destination, vehicleType, rideMode, scheduledFor, paymentMethod, promoCode });
    await userModel.findByIdAndUpdate(req.user._id, { $addToSet: { rides: ride._id } });
    const populated = await rideModel.findById(ride._id).populate("user", "fullname email phone socketId").select("+otp");
    res.status(201).json(populated);
    if (ride.status === "scheduled") {
      await notificationService.notify({ recipientType: "user", recipient: req.user._id, type: "scheduled_ride", title: "Ride scheduled", body: `Pickup scheduled for ${new Date(ride.scheduledFor).toLocaleString("en-NG")}.`, ride: ride._id });
      return;
    }
    const config = await operationsService.getConfig();
    await rideModel.findByIdAndUpdate(ride._id, { requestExpiresAt: new Date(Date.now() + Math.max(60000, Number(config.rideOfferSeconds || 20) * 5 * 1000)) });
    matchingService.dispatchRide(ride._id).catch((error) => console.error("Ride matching failed:", error.message));
  } catch (err) {
    return res.status(err.statusCode || 400).json({ message: err.message });
  }
};

module.exports.getFare = async (req, res) => {
  if (errorsOrNull(req, res)) return;
  try {
    const result = await rideService.getFare(req.query.pickup, req.query.destination);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.validatePromo = async (req, res) => {
  try {
    const fare = Number(req.body.fare || 0);
    if (!fare) return res.status(400).json({ message: "Fare is required" });
    const result = await rideService.validatePromo({ user: req.user._id, promoCode: req.body.promoCode, fare });
    return res.json({ code: result.code, discount: result.discount, finalFare: result.finalFare });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

module.exports.confirmRide = async (req, res) => {
  if (errorsOrNull(req, res)) return;
  const { rideId } = req.body;
  try {
    const rideDetails = await rideModel.findById(rideId);
    if (!rideDetails) return res.status(404).json({ message: "Ride not found" });
    if (!req.captain.isApproved || req.captain.verificationStatus !== "approved" || req.captain.status !== "active") return res.status(403).json({ message: "Your driver account must be approved and active" });
    if (!["online_available", "ride_requested"].includes(req.captain.availabilityStatus)) return res.status(403).json({ message: "Go online before accepting rides" });
    await matchingService.acceptRide(rideId, req.captain._id);
    const ride = await rideService.confirmRide({ rideId, captain: req.captain });
    await captainModel.findByIdAndUpdate(req.captain._id, { $inc: { "stats.acceptedRides": 1 } });
    await notifyRideUser(ride, "ride-confirmed", "Driver accepted", `${ride.captain?.fullname?.firstname || "Your driver"} accepted your ride.`);
    return res.json(ride);
  } catch (err) {
    return res.status(409).json({ message: err.message });
  }
};

module.exports.markArriving = async (req, res) => {
  if (errorsOrNull(req, res)) return;
  try {
    const ride = await rideService.markArriving({ rideId: req.body.rideId, captain: req.captain });
    await notifyRideUser(ride, "driver-arriving", "Driver is on the way", "Your driver is heading to the pickup point.");
    return res.json(ride);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

module.exports.markArrived = async (req, res) => {
  if (errorsOrNull(req, res)) return;
  try {
    const ride = await rideService.markArrived({ rideId: req.body.rideId, captain: req.captain });
    await notifyRideUser(ride, "driver-arrived", "Your driver has arrived", "Meet your driver at the pickup point and share the trip PIN when ready.");
    return res.json(ride);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

module.exports.startRide = async (req, res) => {
  if (errorsOrNull(req, res)) return;
  try {
    const ride = await rideService.startRide({ rideId: req.query.rideId, otp: req.query.otp, captain: req.captain });
    await notifyRideUser(ride, "ride-started", "Trip started", "Your trip PIN was verified and the ride has started.");
    return res.json(ride);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

module.exports.endRide = async (req, res) => {
  if (errorsOrNull(req, res)) return;
  try {
    const ride = await rideService.endRide({ rideId: req.body.rideId, captain: req.captain, cashCollected: req.body.cashCollected });
    await notifyRideUser(ride, "ride-ended", "Trip completed", `Trip complete. ${ride.paymentMethod === "cash" ? "Cash payment was confirmed." : "Payment completed."}`);
    return res.json(ride);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

async function cancellationFeeFor(ride, by) {
  if (by !== "user" || !["accepted", "arriving", "arrived"].includes(ride.status)) return { fee: 0, reason: "" };
  const config = await operationsService.getConfig();
  const reference = ride.arrivedAt || ride.updatedAt || ride.createdAt;
  const elapsedMinutes = (Date.now() - new Date(reference).getTime()) / 60000;
  if (ride.status === "arrived" || elapsedMinutes > Number(config.cancellationFreeMinutes || 3)) {
    return { fee: Number(config.cancellationFee || 0), reason: ride.status === "arrived" ? "Driver already arrived" : "Cancelled after free cancellation window" };
  }
  return { fee: 0, reason: "" };
}

module.exports.cancelRideUser = async (req, res) => {
  if (errorsOrNull(req, res)) return;
  const { rideId, reasonCode = "OTHER", reasonText = "" } = req.body;
  try {
    const current = await rideModel.findOne({ _id: rideId, user: req.user._id }).populate("captain").populate("user");
    if (!current) return res.status(404).json({ message: "Ride not found" });
    if (["completed", "cancelled"].includes(current.status)) return res.status(400).json({ message: "Ride can no longer be cancelled" });
    const { fee, reason } = await cancellationFeeFor(current, "user");
    await matchingService.stopRideMatching(current);
    current.status = "cancelled";
    current.cancelledBy = "user";
    current.cancelReason = { code: reasonCode, text: reasonText };
    current.cancellationFee = fee;
    current.cancellationFeeReason = reason;
    current.scheduledStatus = current.rideMode === "scheduled" ? "cancelled" : current.scheduledStatus;
    current.chatClosedAt = new Date();
    current.statusTimeline.push({ status: "cancelled", at: new Date(), by: "user", note: reasonText || reasonCode });
    await current.save();
    await promoService.releasePromoUsage(current._id);
    if (current.captain?._id) {
      await captainModel.findByIdAndUpdate(current.captain._id, { availabilityStatus: "online_available", currentOfferRide: null, currentOfferExpiresAt: null });
      await notificationService.notify({ recipientType: "captain", recipient: current.captain._id, type: "ride", title: "Passenger cancelled", body: reasonText || "The passenger cancelled this ride.", ride: current._id });
    }
    if (current.captain?.socketId) sendMessageToSocketId(current.captain.socketId, { event: "ride-cancelled", data: current });
    await notificationService.notify({ recipientType: "user", recipient: current.user._id, type: "ride", title: "Ride cancelled", body: fee > 0 ? `Ride cancelled. A ₦${Number(fee).toLocaleString("en-NG")} cancellation fee applies.` : "Your ride was cancelled.", ride: current._id });
    return res.json(current);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.cancelRideCaptain = async (req, res) => {
  if (errorsOrNull(req, res)) return;
  const { rideId, reasonCode = "OTHER", reasonText = "" } = req.body;
  try {
    const ride = await rideModel.findOne({ _id: rideId, captain: req.captain._id }).populate("user").populate("captain");
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    if (["ongoing", "completed", "cancelled"].includes(ride.status)) return res.status(400).json({ message: "This ride can no longer be cancelled by the driver" });
    ride.status = "cancelled";
    ride.cancelledBy = "captain";
    ride.cancelReason = { code: reasonCode, text: reasonText };
    ride.chatClosedAt = new Date();
    ride.statusTimeline.push({ status: "cancelled", at: new Date(), by: "captain", note: reasonText || reasonCode });
    await ride.save();
    await promoService.releasePromoUsage(ride._id);
    await captainModel.findByIdAndUpdate(req.captain._id, {
      availabilityStatus: "online_available",
      currentOfferRide: null,
      currentOfferExpiresAt: null,
      $inc: { "stats.cancelledRides": 1 },
    });
    if (ride.user?.socketId) sendMessageToSocketId(ride.user.socketId, { event: "ride-cancelled", data: ride });
    await notificationService.notify({ recipientType: "user", recipient: ride.user._id, type: "ride", title: "Driver cancelled", body: "Your driver cancelled the ride. You can request another trip.", ride: ride._id });
    return res.json(ride);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.rejectRide = async (req, res) => {
  if (errorsOrNull(req, res)) return;
  try {
    const ride = await rideModel.findOne({ _id: req.body.rideId, status: "pending" });
    if (!ride) return res.status(404).json({ message: "Ride request is no longer available" });
    if (ride.currentRequestCaptain && String(ride.currentRequestCaptain) !== String(req.captain._id)) return res.status(403).json({ message: "This ride is not currently assigned to you" });
    await rideModel.findByIdAndUpdate(ride._id, { $set: { lastRejectReason: { code: req.body.reasonCode || "NOT_AVAILABLE", text: req.body.reasonText || "" } } });
    await captainModel.findByIdAndUpdate(req.captain._id, { $inc: { "stats.rejectedRides": 1 } });
    matchingService.rejectRide(ride._id, req.captain._id).catch(() => {});
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.rateRide = async (req, res) => {
  if (errorsOrNull(req, res)) return;
  try {
    const ride = await rideModel.findById(req.body.rideId).populate("captain").populate("user");
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    if (String(ride.user._id) !== String(req.user._id)) return res.status(403).json({ message: "Forbidden" });
    if (ride.status !== "completed") return res.status(400).json({ message: "Ride must be completed first" });
    if (ride.rating != null) return res.status(409).json({ message: "You have already rated this trip" });
    ride.rating = req.body.rating;
    ride.review = req.body.review || "";
    ride.ratingTags = Array.isArray(req.body.tags) ? req.body.tags.slice(0, 6).map((tag) => String(tag).trim()).filter(Boolean) : [];
    await ride.save();
    if (ride.captain) {
      const captain = await captainModel.findById(ride.captain._id);
      if (captain) {
        const count = captain.rating?.count || 0;
        captain.rating.avg = Math.round((((captain.rating?.avg || 0) * count + req.body.rating) / (count + 1)) * 100) / 100;
        captain.rating.count = count + 1;
        if (req.body.rating >= 4) captain.performanceScore = Math.min(100, (captain.performanceScore ?? 100) + 1);
        if (req.body.rating <= 2) captain.performanceScore = Math.max(0, (captain.performanceScore ?? 100) - 3);
        await captain.save();
        if (captain.socketId) sendMessageToSocketId(captain.socketId, { event: "ride-rated", data: { rideId: ride._id, rating: req.body.rating, review: req.body.review || "" } });
      }
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.ratePassenger = async (req, res) => {
  if (errorsOrNull(req, res)) return;
  try {
    const ride = await rideModel.findOne({ _id: req.body.rideId, captain: req.captain._id }).populate("user");
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    if (ride.status !== "completed") return res.status(400).json({ message: "Ride must be completed first" });
    if (ride.passengerRating != null) return res.status(409).json({ message: "You have already rated this passenger for this trip" });
    ride.passengerRating = req.body.rating;
    ride.passengerReview = req.body.review || "";
    ride.passengerRatingTags = Array.isArray(req.body.tags) ? req.body.tags.slice(0, 6).map((tag) => String(tag).trim()).filter(Boolean) : [];
    await ride.save();
    const user = await userModel.findById(ride.user._id);
    if (user) {
      const count = user.rating?.count || 0;
      user.rating.avg = Math.round((((user.rating?.avg || 0) * count + req.body.rating) / (count + 1)) * 100) / 100;
      user.rating.count = count + 1;
      await user.save();
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.createEmergency = async (req, res) => {
  try {
    const Emergency = require("../models/emergency.model");
    const { rideId = null, type = "other", message = "", location = {} } = req.body;
    let ride = null;
    if (rideId) ride = await rideModel.findById(rideId).populate("captain").populate("user");
    const emergency = await Emergency.create({ user: req.user._id, captain: ride?.captain?._id || null, ride: ride?._id || null, type, message, location });
    if (ride?.captain?.socketId) sendMessageToSocketId(ride.captain.socketId, { event: "passenger-emergency", data: emergency });
    await notificationService.notify({ recipientType: "admin", type: "emergency", title: "Passenger SOS", body: message || type, ride: ride?._id || null, data: { emergencyId: emergency._id } });
    return res.status(201).json(emergency);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.createComplaint = async (req, res) => {
  const { rideId = null, category = "other", description = "", attachmentUrl = "" } = req.body;
  if (!description || String(description).trim().length < 5) return res.status(400).json({ message: "Complaint description is required" });
  try {
    const Complaint = require("../models/complaint.model");
    const ride = rideId ? await rideModel.findById(rideId).populate("captain") : null;
    const complaint = await Complaint.create({ user: req.user._id, captain: ride?.captain?._id || null, ride: ride?._id || null, category, description, attachmentUrl });
    await notificationService.notify({ recipientType: "admin", type: "complaint", title: "New passenger support case", body: `${category}: ${String(description).slice(0, 180)}`, ride: ride?._id || null, data: { complaintId: complaint._id } });
    return res.status(201).json(complaint);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.myScheduledRides = async (req, res) => {
  try {
    const rides = await rideModel.find({ user: req.user._id, rideMode: "scheduled", status: { $ne: "completed" } }).populate("captain", "fullname phone vehicle rating").sort({ scheduledFor: 1 }).limit(100);
    return res.json(rides);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.activeRide = async (req, res) => {
  try {
    const ride = await rideModel.findOne({ user: req.user._id, status: { $in: ["pending", "accepted", "arriving", "arrived", "ongoing"] } })
      .populate({ path: "captain", populate: { path: "activeVehicle" } }).select("+otp").sort({ createdAt: -1 });
    return res.json(ride || null);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.shareTrip = async (req, res) => {
  try {
    const ride = await rideModel.findOne({ _id: req.params.id, user: req.user._id }).populate("captain", "fullname vehicle rating location lastLocationAt");
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    if (!ride.shareToken) { ride.shareToken = crypto.randomBytes(18).toString("hex"); await ride.save(); }
    const base = process.env.CLIENT_URL?.split(",")[0] || "http://localhost:5173";
    return res.json({ token: ride.shareToken, url: `${base.replace(/\/$/, "")}/trip/share/${ride.shareToken}` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.publicSharedTrip = async (req, res) => {
  try {
    const ride = await rideModel.findOne({ shareToken: req.params.token }).populate("captain", "fullname vehicle rating location lastLocationAt");
    if (!ride) return res.status(404).json({ message: "Shared trip not found" });
    return res.json({
      pickup: ride.pickup,
      destination: ride.destination,
      status: ride.status,
      captain: ride.captain ? { fullname: ride.captain.fullname, vehicle: ride.captain.vehicle, rating: ride.captain.rating, location: ride.captain.location, lastLocationAt: ride.captain.lastLocationAt } : null,
      updatedAt: ride.updatedAt,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Legacy GET cancellation route for older clients.
module.exports.cancelRide = async (req, res) => {
  req.body = { rideId: req.query.rideId, reasonCode: "LEGACY_CANCEL", reasonText: "Cancelled from legacy client" };
  return module.exports.cancelRideUser(req, res);
};

module.exports.rideContact = async (req, res) => {
  try {
    const ride = await rideModel.findById(req.params.id).populate("user", "phone fullname").populate("captain", "phone fullname");
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    if (["completed", "cancelled"].includes(ride.status)) return res.status(410).json({ message: "Ride contact access has ended" });
    if (req.userType === "user" && String(ride.user?._id) === String(req.user?._id)) return res.json({ phone: ride.captain?.phone || "", name: ride.captain?.fullname || null });
    if (req.userType === "captain" && String(ride.captain?._id) === String(req.captain?._id)) return res.json({ phone: ride.user?.phone || "", name: ride.user?.fullname || null });
    return res.status(403).json({ message: "You are not part of this ride" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
