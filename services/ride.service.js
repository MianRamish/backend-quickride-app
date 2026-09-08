const captainModel = require("../models/captain.model");
const rideModel = require("../models/ride.model");
<<<<<<< HEAD
const PromoCode = require("../models/promoCode.model");
const mapService = require("./map.service");
const crypto = require("crypto");
const paymentService = require("./payment.service");
const operations = require("./operations.service");
const settlementService = require("./settlement.service");

const inferMarket = () => ({ country: "Nigeria", currency: "NGN", symbol: "₦" });

const getFare = async (pickup, destination) => {
  if (!pickup || !destination) throw new Error("Pickup and destination are required");
  const distanceTime = await mapService.getDistanceTime(pickup, destination);
  const kilometres = distanceTime.distance.value / 1000;
  const minutes = distanceTime.duration.value / 60;
  const config = await operations.getConfig();
  const pricing = config.fares?.toObject ? config.fares.toObject() : config.fares;

  const calculateFare = (vehicleConfig) => {
    const total = Number(vehicleConfig.base || 0) + kilometres * Number(vehicleConfig.perKm || 0) + minutes * Number(vehicleConfig.perMinute || 0);
    return Math.round(Math.max(total, Number(vehicleConfig.minimum || 0)));
  };

  return {
    fare: { bike: calculateFare(pricing.bike), car: calculateFare(pricing.car) },
    distanceTime,
    market: inferMarket(),
    pricing: {
      car: pricing.car,
      bike: pricing.bike,
      commissionRate: Number(config.commissionRate || 0.2),
    },
  };
=======
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
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
};

module.exports.getFare = getFare;

function getOtp(num) {
<<<<<<< HEAD
  return crypto.randomInt(Math.pow(10, num - 1), Math.pow(10, num)).toString();
}

async function validatePromo({ user, promoCode, fare }) {
  const clean = String(promoCode || "").trim().toUpperCase();
  if (!clean) return { code: "", discount: 0, finalFare: fare };
  const promo = await PromoCode.findOne({ code: clean, isActive: true });
  if (!promo) throw new Error("Promo code is invalid or inactive");
  const now = Date.now();
  if (promo.startsAt && new Date(promo.startsAt).getTime() > now) throw new Error("Promo code is not active yet");
  if (promo.endsAt && new Date(promo.endsAt).getTime() < now) throw new Error("Promo code has expired");
  if (promo.usageLimit != null && promo.usageCount >= promo.usageLimit) throw new Error("Promo code usage limit has been reached");
  if (Number(fare) < Number(promo.minFare || 0)) throw new Error(`Promo requires a minimum fare of ₦${Number(promo.minFare || 0).toLocaleString("en-NG")}`);
  const usedByUser = await rideModel.countDocuments({ user, promoCode: clean, status: { $ne: "cancelled" } });
  if (usedByUser >= Number(promo.perUserLimit || 1)) throw new Error("You have already used this promo code");
  let discount = promo.type === "fixed" ? Number(promo.value || 0) : Number(fare) * Number(promo.value || 0) / 100;
  if (promo.maxDiscount != null) discount = Math.min(discount, Number(promo.maxDiscount));
  discount = Math.max(0, Math.min(Number(fare), Math.round(discount)));
  return { code: clean, discount, finalFare: Math.max(0, Math.round(Number(fare) - discount)), promo };
}

module.exports.validatePromo = validatePromo;

=======
  function generateOtp(num) {
    const otp = crypto
      .randomInt(Math.pow(10, num - 1), Math.pow(10, num))
      .toString();
    return otp;
  }
  return generateOtp(num);
}

>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
module.exports.createRide = async ({
  user,
  pickup,
  destination,
  vehicleType,
  rideMode = "now",
  scheduledFor = null,
<<<<<<< HEAD
  paymentMethod = "cash",
  promoCode = "",
}) => {
  if (!user || !pickup || !destination || !vehicleType) throw new Error("All fields are required");
  const payment = paymentService.assertPaymentMethodAvailable(paymentMethod);
  const { fare, distanceTime, market } = await getFare(pickup, destination);
  if (!fare || typeof fare[vehicleType] !== "number") throw new Error("Invalid vehicle type or fare unavailable");

  if (rideMode === "scheduled") {
    const when = new Date(scheduledFor || "");
    if (Number.isNaN(when.getTime())) throw new Error("Choose a valid scheduled pickup time");
    if (when.getTime() < Date.now() + 10 * 60 * 1000) throw new Error("Scheduled rides must be at least 10 minutes in the future");
  }

  const promo = await validatePromo({ user, promoCode, fare: fare[vehicleType] });
  const initialStatus = rideMode === "scheduled" ? "scheduled" : "pending";
  const ride = await rideModel.create({
    user,
    pickup,
    destination,
    otp: getOtp(6),
    fare: promo.finalFare,
    originalFare: fare[vehicleType],
    promoCode: promo.code,
    promoDiscount: promo.discount,
    shareToken: crypto.randomBytes(18).toString("hex"),
    currency: market.currency,
    paymentMethod: payment.id,
    paymentStatus: paymentService.getInitialPaymentStatus(payment.id),
    paymentProvider: payment.id === "cash" ? "cash" : "",
    paymentReference: "",
    cashCollected: false,
    cashCollectedAt: null,
    vehicle: vehicleType,
    distance: distanceTime.distance.value,
    duration: distanceTime.duration.value,
    rideMode: rideMode === "scheduled" ? "scheduled" : "now",
    scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
    scheduledStatus: rideMode === "scheduled" ? "waiting" : "none",
    status: initialStatus,
    statusTimeline: [{ status: initialStatus, at: new Date(), by: "user", note: rideMode === "scheduled" ? "Ride scheduled" : "Ride requested" }],
  });
  if (promo.promo) await PromoCode.findByIdAndUpdate(promo.promo._id, { $inc: { usageCount: 1 } });
  return ride;
};

module.exports.confirmRide = async ({ rideId, captain }) => {
  if (!rideId) throw new Error("Ride id is required");
  const ride = await rideModel.findOneAndUpdate(
    { _id: rideId, status: "pending" },
    {
      status: "accepted",
      captain: captain._id,
      currentRequestCaptain: null,
      currentRequestExpiresAt: null,
      $push: { statusTimeline: { status: "accepted", at: new Date(), by: "captain", note: "Driver accepted the ride" } },
    },
    { new: true }
  ).populate("user").populate({ path: "captain", populate: { path: "activeVehicle" } }).select("+otp");
  if (!ride) throw new Error("Ride is no longer available");

  await captainModel.findByIdAndUpdate(captain._id, {
    $addToSet: { rides: rideId },
    availabilityStatus: "on_trip",
    isOnline: true,
    currentOfferRide: null,
    currentOfferExpiresAt: null,
  });
  return ride;
};

module.exports.markArriving = async ({ rideId, captain }) => {
  const ride = await rideModel.findOneAndUpdate(
    { _id: rideId, captain: captain._id, status: "accepted" },
    { status: "arriving", $push: { statusTimeline: { status: "arriving", at: new Date(), by: "captain", note: "Driver is heading to pickup" } } },
    { new: true }
  ).populate("user").populate({ path: "captain", populate: { path: "activeVehicle" } }).select("+otp");
  if (!ride) throw new Error("Ride must be accepted before heading to pickup");
  return ride;
};

module.exports.markArrived = async ({ rideId, captain }) => {
  const now = new Date();
  const ride = await rideModel.findOneAndUpdate(
    { _id: rideId, captain: captain._id, status: { $in: ["accepted", "arriving"] } },
    { status: "arrived", arrivedAt: now, waitingStartedAt: now, $push: { statusTimeline: { status: "arrived", at: now, by: "captain", note: "Driver arrived at pickup" } } },
    { new: true }
  ).populate("user").populate({ path: "captain", populate: { path: "activeVehicle" } }).select("+otp");
  if (!ride) throw new Error("Ride is not ready for arrival confirmation");
  return ride;
};

module.exports.startRide = async ({ rideId, otp, captain }) => {
  if (!rideId || !otp) throw new Error("Ride id and OTP are required");
  const ride = await rideModel.findOne({ _id: rideId, captain: captain._id }).populate("user").populate({ path: "captain", populate: { path: "activeVehicle" } }).select("+otp");
  if (!ride) throw new Error("Ride not found");
  if (ride.status !== "arrived") throw new Error("Confirm that you have arrived at pickup before starting the trip");
  if (ride.otp !== otp) throw new Error("Invalid OTP");
  const now = new Date();
  ride.status = "ongoing";
  ride.startedAt = now;
  ride.statusTimeline.push({ status: "ongoing", at: now, by: "captain", note: "Trip PIN verified and trip started" });
  await ride.save();
  await captainModel.findByIdAndUpdate(captain._id, { availabilityStatus: "on_trip", isOnline: true });
  return ride;
};

module.exports.endRide = async ({ rideId, captain, cashCollected = false }) => {
  if (!rideId) throw new Error("Ride id is required");
  const ride = await rideModel.findOne({ _id: rideId, captain: captain._id }).populate("user").populate({ path: "captain", populate: { path: "activeVehicle" } }).select("+otp");
  if (!ride) throw new Error("Ride not found");
  if (ride.status !== "ongoing") throw new Error("Ride not ongoing");
  paymentService.confirmRidePaymentBeforeCompletion({ ride, cashCollected });

  const config = await operations.getConfig();
  const commissionRate = Number(config.commissionRate || 0.2);
=======
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
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
  const gross = Number(ride.fare || 0);
  const commissionAmount = Math.round(gross * commissionRate * 100) / 100;
  let bonusAmount = 0;

<<<<<<< HEAD
=======
  // incentive bonus (simple): if captain hits target at end of ride, award rewardAmount
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
  try {
    const IncentiveCampaign = require("../models/incentiveCampaign.model");
    const now = new Date();
    const active = await IncentiveCampaign.find({ isActive: true, startsAt: { $lte: now }, $or: [{ endsAt: null }, { endsAt: { $gte: now } }] });
<<<<<<< HEAD
=======

>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
    for (const camp of active) {
      const start = new Date(now);
      const end = new Date(now);
      if (camp.period === "daily") {
        start.setHours(0,0,0,0); end.setHours(23,59,59,999);
<<<<<<< HEAD
      } else if (camp.period === "monthly") {
        start.setDate(1); start.setHours(0,0,0,0); end.setMonth(end.getMonth()+1, 0); end.setHours(23,59,59,999);
      } else {
        const day = start.getDay();
        const diff = (day === 0 ? 6 : day - 1);
        start.setDate(start.getDate() - diff); start.setHours(0,0,0,0);
        end.setTime(start.getTime()); end.setDate(end.getDate() + 7);
      }
      const completedCount = await rideModel.countDocuments({ captain: captain._id, status: "completed", completedAt: { $gte: start, $lte: end } });
      if (completedCount + 1 === camp.targetRides) bonusAmount += Number(camp.rewardAmount || 0);
    }
  } catch (_) {}

  const netToCaptain = Math.round((gross - commissionAmount + bonusAmount) * 100) / 100;
  const now = new Date();
  ride.status = "completed";
  ride.completedAt = now;
  ride.cashCollected = ride.paymentMethod === "cash" ? true : ride.cashCollected;
  ride.cashCollectedAt = ride.paymentMethod === "cash" ? now : ride.cashCollectedAt;
  ride.paymentStatus = ride.paymentMethod === "cash" ? "cash_collected" : ride.paymentStatus;
  ride.earnings = { gross, commissionRate, commissionAmount, bonusAmount, netToCaptain };
  ride.chatClosedAt = now;
  ride.statusTimeline.push({ status: "completed", at: now, by: "captain", note: "Trip completed" });
  await ride.save();

  const captainDoc = await captainModel.findById(captain._id);
  if (captainDoc) {
    captainDoc.stats.completedRides = (captainDoc.stats.completedRides || 0) + 1;
    const kilometres = ride.distance ? Number(ride.distance) / 1000 : 0;
    captainDoc.stats.kmTravelled = Math.round(((captainDoc.stats.kmTravelled || 0) + kilometres) * 100) / 100;
    captainDoc.earnings.balance = Math.round(((captainDoc.earnings.balance || 0) + bonusAmount) * 100) / 100;
    captainDoc.performanceScore = Math.min(100, (captainDoc.performanceScore ?? 100) + 1);
=======
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

>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
    captainDoc.availabilityStatus = "online_available";
    captainDoc.isOnline = true;
    await captainDoc.save();
  }

<<<<<<< HEAD
  if (ride.paymentMethod === "cash") {
    await settlementService.createCashCommission({ captainId: captain._id, rideId: ride._id, grossCash: gross, commissionAmount, currency: ride.currency || "NGN" });
  }

  return rideModel.findById(rideId).populate("user").populate({ path: "captain", populate: { path: "activeVehicle" } });
};
=======
  const updated = await rideModel.findById(rideId).populate("user").populate({ path: "captain", populate: { path: "activeVehicle" } });
  return updated;
};

>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
