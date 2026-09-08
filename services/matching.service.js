const Ride = require("../models/ride.model");
const Captain = require("../models/captain.model");
const mapService = require("./map.service");
const operations = require("./operations.service");
const notifications = require("./notification.service");
const { sendMessageToSocketId } = require("../socket");
const promoService = require("./promo.service");

const timers = new Map();

function clearRideTimer(rideId) {
  const key = String(rideId);
  const timer = timers.get(key);
  if (timer) clearTimeout(timer);
  timers.delete(key);
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const toRad = (n) => (n * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function isFreshCaptain(captain, staleMs) {
  if (!captain?.socketId || !captain?.lastLocationAt) return false;
  // GPS must stay very fresh. A driver who explicitly pins a fallback location
  // gets a short grace window so desktop/dev environments can still be tested
  // when the browser refuses geolocation. Manual locations must be reconfirmed.
  const manualStaleMs = 15 * 60 * 1000;
  const allowedAge = captain.lastLocationSource === "manual" ? Math.max(staleMs, manualStaleMs) : staleMs;
  if (Date.now() - new Date(captain.lastLocationAt).getTime() > allowedAge) return false;
  return captain.isOnline === true && captain.availabilityStatus === "online_available";
}

async function releaseCaptain(captainId, rideId) {
  if (!captainId) return;
  await Captain.findOneAndUpdate(
    { _id: captainId, currentOfferRide: rideId, availabilityStatus: "ride_requested" },
    { $set: { currentOfferRide: null, currentOfferExpiresAt: null, availabilityStatus: "online_available" } }
  );
}

async function expireOffer(rideId, captainId) {
  clearRideTimer(rideId);
  const ride = await Ride.findById(rideId);
  if (!ride || ride.status !== "pending" || String(ride.currentRequestCaptain || "") !== String(captainId)) return;

  await releaseCaptain(captainId, rideId);
  await Ride.findByIdAndUpdate(rideId, {
    $addToSet: { rejectedCaptains: captainId },
    $set: { currentRequestCaptain: null, currentRequestExpiresAt: null },
  });
  const captain = await Captain.findById(captainId).select("socketId");
  if (captain?.socketId) sendMessageToSocketId(captain.socketId, { event: "ride-offer-expired", data: { rideId } });
  return dispatchRide(rideId);
}

async function noDriverYet(ride) {
  const overallExpiry = ride.requestExpiresAt ? new Date(ride.requestExpiresAt).getTime() : 0;
  if (overallExpiry && Date.now() >= overallExpiry) {
    const cancelled = await Ride.findOneAndUpdate(
      { _id: ride._id, status: "pending" },
      {
        $set: {
          status: "cancelled",
          cancelledBy: "system",
          cancelReason: { code: "NO_DRIVER_FOUND", text: "No nearby driver accepted the request in time" },
          currentRequestCaptain: null,
          currentRequestExpiresAt: null,
        },
        $push: { statusTimeline: { status: "cancelled", at: new Date(), by: "system", note: "No nearby driver accepted in time" } },
      },
      { new: true }
    ).populate("user", "socketId");
    if (cancelled) await promoService.releasePromoUsage(cancelled._id);
    if (cancelled?.user?.socketId) sendMessageToSocketId(cancelled.user.socketId, { event: "ride-cancelled", data: cancelled });
    if (cancelled?.user?._id) await notifications.notify({ recipientType: "user", recipient: cancelled.user._id, type: "ride", title: "No driver found", body: "No nearby driver accepted this request. Please try again.", ride: cancelled._id });
    return cancelled;
  }

  const retryMs = 10000;
  clearRideTimer(ride._id);
  timers.set(String(ride._id), setTimeout(() => dispatchRide(ride._id).catch(() => {}), retryMs));
  return null;
}

async function dispatchRide(rideId) {
  clearRideTimer(rideId);
  const ride = await Ride.findById(rideId).populate("user", "fullname email phone socketId");
  if (!ride || ride.status !== "pending" || ride.currentRequestCaptain) return ride;

  const config = await operations.getConfig();
  const pickupCoordinates = await mapService.getAddressCoordinate(ride.pickup);
  const radiusKm = Number(config.matchingRadiusKm || 8);
  const staleMs = Number(config.driverLocationStaleSeconds || 120) * 1000;
  const excluded = new Set([...(ride.requestedCaptains || []), ...(ride.rejectedCaptains || [])].map(String));
  let candidates = await mapService.getCaptainsInTheRadius(pickupCoordinates.ltd, pickupCoordinates.lng, radiusKm, ride.vehicle);
  candidates = candidates
    .filter((captain) => !excluded.has(String(captain._id)) && isFreshCaptain(captain, staleMs) && !captain.currentOfferRide)
    .map((captain) => {
      const [lng, lat] = captain.location?.coordinates || [];
      return { captain, distanceKm: Number.isFinite(lat) && Number.isFinite(lng) ? haversineKm(pickupCoordinates.ltd, pickupCoordinates.lng, lat, lng) : 999 };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (!candidates.length) return noDriverYet(ride);

  const { captain, distanceKm } = candidates[0];
  const offerSeconds = Number(config.rideOfferSeconds || 20);
  const expiresAt = new Date(Date.now() + offerSeconds * 1000);
  const updatedRide = await Ride.findOneAndUpdate(
    { _id: ride._id, status: "pending", currentRequestCaptain: null },
    {
      $set: { currentRequestCaptain: captain._id, currentRequestExpiresAt: expiresAt },
      $addToSet: { requestedCaptains: captain._id },
      $inc: { requestAttempt: 1 },
    },
    { new: true }
  ).populate("user", "fullname email phone socketId");
  if (!updatedRide) return dispatchRide(rideId);

  await Captain.findByIdAndUpdate(captain._id, {
    currentOfferRide: ride._id,
    currentOfferExpiresAt: expiresAt,
    availabilityStatus: "ride_requested",
  });

  sendMessageToSocketId(captain.socketId, {
    event: "new-ride",
    data: {
      ...updatedRide.toObject(),
      offerExpiresAt: expiresAt,
      pickupDistanceKm: Math.round(distanceKm * 10) / 10,
    },
  });
  await notifications.notify({
    recipientType: "captain",
    recipient: captain._id,
    type: "ride_request",
    title: "New ride request",
    body: `${updatedRide.pickup} → ${updatedRide.destination}`,
    ride: updatedRide._id,
    data: { offerExpiresAt: expiresAt },
  });

  timers.set(String(ride._id), setTimeout(() => expireOffer(ride._id, captain._id).catch(() => {}), offerSeconds * 1000));
  return updatedRide;
}

async function acceptRide(rideId, captainId) {
  clearRideTimer(rideId);
  const ride = await Ride.findById(rideId);
  if (!ride) throw new Error("Ride not found");
  if (ride.status !== "pending") throw new Error("Ride is no longer available");
  if (!ride.currentRequestCaptain || String(ride.currentRequestCaptain) !== String(captainId)) throw new Error("This ride is not currently offered to you");
  if (ride.currentRequestExpiresAt && new Date(ride.currentRequestExpiresAt).getTime() < Date.now()) throw new Error("This ride offer has expired");
  await Captain.findByIdAndUpdate(captainId, { currentOfferRide: null, currentOfferExpiresAt: null });
  return true;
}

async function rejectRide(rideId, captainId) {
  clearRideTimer(rideId);
  await releaseCaptain(captainId, rideId);
  await Ride.findByIdAndUpdate(rideId, {
    $addToSet: { rejectedCaptains: captainId },
    $set: { currentRequestCaptain: null, currentRequestExpiresAt: null },
  });
  return dispatchRide(rideId);
}

async function stopRideMatching(ride) {
  const rideId = ride?._id || ride;
  clearRideTimer(rideId);
  const doc = ride?._id ? ride : await Ride.findById(rideId);
  if (doc?.currentRequestCaptain) await releaseCaptain(doc.currentRequestCaptain, rideId);
  await Ride.findByIdAndUpdate(rideId, { currentRequestCaptain: null, currentRequestExpiresAt: null });
}

async function restorePendingMatches() {
  const pending = await Ride.find({ status: "pending" }).select("_id").limit(100);
  for (const ride of pending) dispatchRide(ride._id).catch(() => {});
}

module.exports = { dispatchRide, acceptRide, rejectRide, stopRideMatching, restorePendingMatches };
