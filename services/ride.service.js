const captainModel = require("../models/captain.model");
const rideModel = require("../models/ride.model");
const mapService = require("./map.service");
const crypto = require("crypto");

const inferMarket = (pickup = "", destination = "", distanceTime = {}) => {
  const text = [pickup, destination, distanceTime?.originCoordinates?.displayName, distanceTime?.destinationCoordinates?.displayName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("canada") || /\b(on|bc|qc|ab|mb|sk|ns|nb|nl|pe|yt|nt|nu)\b/i.test(text)) {
    return { country: "Canada", currency: "CAD", symbol: "$" };
  }

  return { country: "United States", currency: "USD", symbol: "$" };
};

const getFare = async (pickup, destination) => {
  if (!pickup || !destination) {
    throw new Error("Pickup and destination are required");
  }

  const distanceTime = await mapService.getDistanceTime(pickup, destination);

  // Canada/US-friendly demo pricing. Values are in the inferred local currency.
  // Vehicle keys: car = Standard, bike = Economy. Auto/rickshaw is disabled for Canada/US.
  const baseFare = {
    bike: 4.25,
    car: 6.5,
  };

  const perMileRate = {
    bike: 1.05,
    car: 1.75,
  };

  const perMinuteRate = {
    bike: 0.22,
    car: 0.35,
  };

  const miles = distanceTime.distance.value / 1609.344;
  const minutes = distanceTime.duration.value / 60;
  const market = inferMarket(pickup, destination, distanceTime);

  const roundMoney = (amount) => Number(Math.max(amount, 5).toFixed(2));

  const fare = {
    bike: roundMoney(baseFare.bike + miles * perMileRate.bike + minutes * perMinuteRate.bike),
    car: roundMoney(baseFare.car + miles * perMileRate.car + minutes * perMinuteRate.car),
  };

  return { fare, distanceTime, market };
};

module.exports.getFare = getFare;

function getOtp(num) {
  function generateOtp(num) {
    const otp = crypto
      .randomInt(Math.pow(10, num - 1), Math.pow(10, num))
      .toString();
    return otp;
  }
  return generateOtp(num);
}

module.exports.createRide = async ({
  user,
  pickup,
  destination,
  vehicleType,
  rideMode = "now",
  scheduledFor = null,
}) => {
  if (!user || !pickup || !destination || !vehicleType) {
    throw new Error("All fields are required");
  }

  try {
    const { fare, distanceTime, market } = await getFare(pickup, destination);

    if (!fare || typeof fare[vehicleType] !== "number") {
      throw new Error("Invalid vehicle type or fare unavailable");
    }

    const ride = rideModel.create({
      user,
      pickup,
      destination,
      otp: getOtp(6),
      fare: fare[vehicleType],
      currency: market.currency,
      vehicle: vehicleType,
      distance: distanceTime.distance.value,
      duration: distanceTime.duration.value,
      rideMode: rideMode === "scheduled" ? "scheduled" : "now",
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      scheduledStatus: rideMode === "scheduled" ? "waiting" : "none",
      status: rideMode === "scheduled" ? "scheduled" : "pending",
    });

    return ride;
  } catch (error) {
    throw new Error(error.message || "Error occurred while creating ride.");
  }
};

// when ride request is accepted by captain
module.exports.confirmRide = async ({ rideId, captain }) => {
  if (!rideId) {
    throw new Error("Ride id is required");
  }

  try {
    await rideModel.findOneAndUpdate(
      {
        _id: rideId,
      },
      {
        status: "accepted",
        captain: captain._id,
      }
    );

    const captainData = await captainModel.findOne({ _id: captain._id });

    captainData.rides.push(rideId);
    captainData.availabilityStatus = "on_trip";
    captainData.isOnline = true;

    await captainData.save();

    const ride = await rideModel
      .findOne({
        _id: rideId,
      })
      .populate("user")
      .populate({ path: "captain", populate: { path: "activeVehicle" } })
      .select("+otp");

    if (!ride) {
      throw new Error("Ride not found");
    }

    return ride;
  } catch (error) {
    console.log(error)
    throw new Error("Error occured while confirming ride.");
  }
};

module.exports.startRide = async ({ rideId, otp, captain }) => {
  if (!rideId || !otp) {
    throw new Error("Ride id and OTP are required");
  }

  const ride = await rideModel
    .findOne({
      _id: rideId,
    })
    .populate("user")
    .populate({ path: "captain", populate: { path: "activeVehicle" } })
    .select("+otp");

  if (!ride) {
    throw new Error("Ride not found");
  }

  if (ride.status !== "accepted") {
    throw new Error("Ride not accepted");
  }

  if (ride.otp !== otp) {
    throw new Error("Invalid OTP");
  }

  await rideModel.findOneAndUpdate(
    {
      _id: rideId,
    },
    {
      status: "ongoing",
    }
  );

  await captainModel.findByIdAndUpdate(captain._id, { availabilityStatus: "on_trip", isOnline: true });

  return ride;
};

module.exports.endRide = async ({ rideId, captain }) => {
  if (!rideId) {
    throw new Error("Ride id is required");
  }

  const ride = await rideModel
    .findOne({ _id: rideId, captain: captain._id })
    .populate("user")
    .populate({ path: "captain", populate: { path: "activeVehicle" } })
    .select("+otp");

  if (!ride) throw new Error("Ride not found");
  if (ride.status !== "ongoing") throw new Error("Ride not ongoing");

  // earnings breakdown
  const commissionRate = Number(process.env.COMMISSION_RATE || 0.2);
  const gross = Number(ride.fare || 0);
  const commissionAmount = Math.round(gross * commissionRate * 100) / 100;
  let bonusAmount = 0;

  // incentive bonus (simple): if captain hits target at end of ride, award rewardAmount
  try {
    const IncentiveCampaign = require("../models/incentiveCampaign.model");
    const now = new Date();
    const active = await IncentiveCampaign.find({ isActive: true, startsAt: { $lte: now }, $or: [{ endsAt: null }, { endsAt: { $gte: now } }] });

    for (const camp of active) {
      const start = new Date(now);
      const end = new Date(now);
      if (camp.period === "daily") {
        start.setHours(0,0,0,0); end.setHours(23,59,59,999);
      } else {
        // weekly: Monday start
        const day = start.getDay(); // 0 Sun
        const diff = (day === 0 ? 6 : day - 1);
        start.setDate(start.getDate() - diff);
        start.setHours(0,0,0,0);
        end.setTime(start.getTime());
        end.setDate(end.getDate() + 7);
      }

      const completedCount = await rideModel.countDocuments({
        captain: captain._id,
        status: "completed",
        createdAt: { $gte: start, $lte: end }
      });

      // ride not yet marked completed, so +1
      if (completedCount + 1 === camp.targetRides) {
        bonusAmount += Number(camp.rewardAmount || 0);
      }
    }
  } catch (e) {
    // ignore incentive errors
  }

  const netToCaptain = Math.round((gross - commissionAmount + bonusAmount) * 100) / 100;

  await rideModel.findOneAndUpdate(
    { _id: rideId },
    {
      status: "completed",
      earnings: { gross, commissionRate, commissionAmount, bonusAmount, netToCaptain },
    },
    { new: true }
  );

  // Update captain stats + balance
  const Captain = require("../models/captain.model");
  const captainDoc = await Captain.findById(captain._id);
  if (captainDoc) {
    captainDoc.stats.completedRides = (captainDoc.stats.completedRides || 0) + 1;
    // distance is stored in meters; for Canada/US dashboards we keep travelled distance in miles.
    const miles = ride.distance ? (Number(ride.distance) / 1609.344) : 0;
    captainDoc.stats.kmTravelled = Math.round(((captainDoc.stats.kmTravelled || 0) + miles) * 100) / 100;
    captainDoc.earnings.balance = Math.round(((captainDoc.earnings.balance || 0) + netToCaptain) * 100) / 100;

    // performance score slight reward for completion
    captainDoc.performanceScore = Math.min(100, (captainDoc.performanceScore ?? 100) + 1);

    captainDoc.availabilityStatus = "online_available";
    captainDoc.isOnline = true;
    await captainDoc.save();
  }

  const updated = await rideModel.findById(rideId).populate("user").populate({ path: "captain", populate: { path: "activeVehicle" } });
  return updated;
};

