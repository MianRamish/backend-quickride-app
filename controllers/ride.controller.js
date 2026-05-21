const rideService = require("../services/ride.service");
const { validationResult } = require("express-validator");
const mapService = require("../services/map.service");
const { sendMessageToSocketId } = require("../socket");
const rideModel = require("../models/ride.model");
const userModel = require("../models/user.model");

module.exports.chatDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const ride = await rideModel
      .findOne({ _id: id })
      .populate("user", "socketId fullname phone")
      .populate("captain", "socketId fullname phone");

    if (!ride) {
      return res.status(400).json({ message: "Ride not found" });
    }

    const response = {
      user: {
        socketId: ride.user?.socketId,
        fullname: ride.user?.fullname,
        phone: ride.user?.phone,
        _id: ride.user?._id,
      },
      captain: {
        socketId: ride.captain?.socketId,
        fullname: ride.captain?.fullname,
        phone: ride.captain?.phone,
        _id: ride.captain?._id,
      },
      messages: ride.messages,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports.createRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { pickup, destination, vehicleType, rideMode = "now", scheduledFor = null } = req.body;

  try {
    const ride = await rideService.createRide({
      user: req.user._id,
      pickup,
      destination,
      vehicleType,
      rideMode,
      scheduledFor,
    });

    const user = await userModel.findOne({ _id: req.user._id });
    if (user) {
      user.rides.push(ride._id);
      await user.save();
    }

    res.status(201).json(ride);

    if (ride.status === "scheduled") {
      return;
    }

    Promise.resolve().then(async () => {
      try {
        const pickupCoordinates = await mapService.getAddressCoordinate(pickup);
        console.log("Pickup Coordinates", pickupCoordinates);

        const captainsInRadius = await mapService.getCaptainsInTheRadius(
          pickupCoordinates.ltd,
          pickupCoordinates.lng,
          4,
          vehicleType
        );

        await rideModel.findByIdAndUpdate(ride._id, {
          requestedCaptains: captainsInRadius.map((captain) => captain._id),
          requestExpiresAt: new Date(Date.now() + Number(process.env.RIDE_REQUEST_TIMEOUT_MS || 90000)),
        });

        ride.otp = "";

        const rideWithUser = await rideModel
          .findOne({ _id: ride._id })
          .populate("user", "fullname email phone");

        console.log(
          captainsInRadius.map(
            (ride) => `${ride.fullname.firstname} ${ride.fullname.lastname} `
          )
        );
        captainsInRadius.map((captain) => {
          sendMessageToSocketId(captain.socketId, {
            event: "new-ride",
            data: rideWithUser,
          });
        });
      } catch (e) {
        console.error("Background task failed:", e.message);
      }
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.getFare = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { pickup, destination } = req.query;

  try {
    const { fare, distanceTime, market } = await rideService.getFare(
      pickup,
      destination
    );
    return res.status(200).json({ fare, distanceTime, market });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.confirmRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { rideId } = req.body;

  try {
    const rideDetails = await rideModel.findOne({ _id: rideId });

    if (!rideDetails) {
      return res.status(404).json({ message: "Ride not found." });
    }

    if (!req.captain.isApproved || req.captain.verificationStatus !== "approved" || req.captain.status !== "active") {
      return res.status(403).json({ message: "Your account must be approved and active before accepting rides." });
    }
    if (req.captain.availabilityStatus !== "online_available" && req.captain.availabilityStatus !== "ride_requested") {
      return res.status(403).json({ message: "Go online before accepting rides." });
    }
    if ((rideDetails.rejectedCaptains || []).map(String).includes(String(req.captain._id))) {
      return res.status(400).json({ message: "You already rejected this ride." });
    }

    switch (rideDetails.status) {
      case "accepted":
        return res
          .status(400)
          .json({
            message:
              "The ride is accepted by another captain before you. Better luck next time.",
          });

      case "ongoing":
        return res
          .status(400)
          .json({
            message: "The ride is currently ongoing with another captain.",
          });

      case "completed":
        return res
          .status(400)
          .json({ message: "The ride has already been completed." });

      case "cancelled":
        return res
          .status(400)
          .json({ message: "The ride has been cancelled." });

      default:
        break;
    }

    const ride = await rideService.confirmRide({
      rideId,
      captain: req.captain,
    });

    sendMessageToSocketId(ride.user.socketId, {
      event: "ride-confirmed",
      data: ride,
    });

    await require("../models/captain.model").findByIdAndUpdate(req.captain._id, {
      availabilityStatus: "on_trip",
      isOnline: true,
      $inc: { "stats.acceptedRides": 1 },
    });

    (rideDetails.requestedCaptains || []).forEach((captainId) => {
      if (String(captainId) !== String(req.captain._id)) {
        // Other captains will refresh their incoming list when they receive this event.
      }
    });

    return res.status(200).json(ride);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.startRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { rideId, otp } = req.query;

  try {
    const ride = await rideService.startRide({
      rideId,
      otp,
      captain: req.captain,
    });

    sendMessageToSocketId(ride.user.socketId, {
      event: "ride-started",
      data: ride,
    });

    return res.status(200).json(ride);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.endRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { rideId } = req.body;

  try {
    const ride = await rideService.endRide({ rideId, captain: req.captain });

    sendMessageToSocketId(ride.user.socketId, {
      event: "ride-ended",
      data: ride,
    });

    return res.status(200).json(ride);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.cancelRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { rideId } = req.query;

  try {
    const ride = await rideModel.findOneAndUpdate(
      { _id: rideId },
      {
        status: "cancelled",
      },
      { new: true }
    );

    const pickupCoordinates = await mapService.getAddressCoordinate(ride.pickup);
    const captainsInRadius = await mapService.getCaptainsInTheRadius(
      pickupCoordinates.ltd,
      pickupCoordinates.lng,
      4,
      ride.vehicle
    );

    captainsInRadius.map((captain) => {
      sendMessageToSocketId(captain.socketId, {
        event: "ride-cancelled",
        data: ride,
      });
    });
    return res.status(200).json(ride);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};


module.exports.rejectRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { rideId, reasonCode = "", reasonText = "" } = req.body;
  try {
    const ride = await rideModel.findOneAndUpdate(
      { _id: rideId, status: "pending" },
      { $addToSet: { rejectedCaptains: req.captain._id }, $set: { lastRejectReason: { code: reasonCode, text: reasonText } } },
      { new: true }
    ).populate("user", "fullname email phone");

    if (!ride) return res.status(404).json({ message: "Ride request not found or already accepted." });

    await require("../models/captain.model").findByIdAndUpdate(req.captain._id, {
      availabilityStatus: "online_available",
      $inc: { "stats.rejectedRides": 1 },
    });

    return res.json({ ok: true, ride });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};


module.exports.cancelRideUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { rideId, reasonCode = "", reasonText = "" } = req.body;
  try {
    const ride = await rideModel.findOneAndUpdate(
      { _id: rideId, user: req.user._id },
      { status: "cancelled", cancelledBy: "user", cancelReason: { code: reasonCode, text: reasonText } },
      { new: true }
    ).populate("user").populate("captain");

    if (!ride) return res.status(404).json({ message: "Ride not found" });

    if (ride.captain?.socketId) {
      sendMessageToSocketId(ride.captain.socketId, { event: "ride-cancelled", data: ride });
    }

    return res.status(200).json(ride);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.cancelRideCaptain = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { rideId, reasonCode = "", reasonText = "" } = req.body;
  try {
    const ride = await rideModel.findOneAndUpdate(
      { _id: rideId, captain: req.captain._id },
      { status: "cancelled", cancelledBy: "captain", cancelReason: { code: reasonCode, text: reasonText } },
      { new: true }
    ).populate("user").populate("captain");

    if (!ride) return res.status(404).json({ message: "Ride not found" });

    // captain stats
    const captain = await require("../models/captain.model").findById(req.captain._id);
    if (captain) {
      captain.stats.cancelledRides = (captain.stats.cancelledRides || 0) + 1;
      captain.performanceScore = Math.max(0, (captain.performanceScore ?? 100) - 5);
      await captain.save();
    }

    if (ride.user?.socketId) {
      sendMessageToSocketId(ride.user.socketId, { event: "ride-cancelled", data: ride });
    }

    return res.status(200).json(ride);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.rateRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { rideId, rating, review = "" } = req.body;
  try {
    const ride = await rideModel.findOne({ _id: rideId }).populate("captain").populate("user");
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    if (String(ride.user._id) !== String(req.user._id)) return res.status(403).json({ message: "Forbidden" });
    if (ride.status !== "completed") return res.status(400).json({ message: "Ride must be completed first" });

    ride.rating = rating;
    ride.review = review || "";
    await ride.save();

    // update captain rating + performance
    if (ride.captain) {
      const captainModel = require("../models/captain.model");
      const captain = await captainModel.findById(ride.captain._id);
      if (captain) {
        const oldCount = captain.rating?.count || 0;
        const oldAvg = captain.rating?.avg || 0;
        const newCount = oldCount + 1;
        const newAvg = Math.round(((oldAvg * oldCount) + rating) / newCount * 100) / 100;
        captain.rating.avg = newAvg;
        captain.rating.count = newCount;

        // performance nudges
        if (rating >= 4) captain.performanceScore = Math.min(100, (captain.performanceScore ?? 100) + 1);
        if (rating <= 2) captain.performanceScore = Math.max(0, (captain.performanceScore ?? 100) - 3);

        await captain.save();

        if (captain.socketId) {
          sendMessageToSocketId(captain.socketId, { event: "ride-rated", data: { rideId, rating, review } });
        }
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};


module.exports.createEmergency = async (req, res) => {
  const { rideId = null, type = "other", message = "", location = {} } = req.body;
  try {
    const Emergency = require("../models/emergency.model");
    let ride = null;
    if (rideId) ride = await rideModel.findById(rideId).populate("captain").populate("user");
    const emergency = await Emergency.create({
      user: req.user._id,
      captain: ride?.captain?._id || null,
      ride: ride?._id || null,
      type,
      message,
      location,
    });
    if (ride?.captain?.socketId) {
      sendMessageToSocketId(ride.captain.socketId, { event: "passenger-emergency", data: emergency });
    }
    return res.status(201).json(emergency);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.createComplaint = async (req, res) => {
  const { rideId = null, category = "other", description = "", attachmentUrl = "" } = req.body;
  if (!description || String(description).trim().length < 5) {
    return res.status(400).json({ message: "Complaint description is required." });
  }
  try {
    const Complaint = require("../models/complaint.model");
    let ride = null;
    if (rideId) ride = await rideModel.findById(rideId).populate("captain").populate("user");
    const complaint = await Complaint.create({
      user: req.user._id,
      captain: ride?.captain?._id || null,
      ride: ride?._id || null,
      category,
      description,
      attachmentUrl,
    });
    return res.status(201).json(complaint);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.myScheduledRides = async (req, res) => {
  try {
    const rides = await rideModel
      .find({ user: req.user._id, status: "scheduled" })
      .populate("captain", "fullname phone vehicle rating")
      .sort({ scheduledFor: 1 })
      .limit(100);
    return res.json(rides);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
