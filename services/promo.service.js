const Ride = require("../models/ride.model");
const PromoCode = require("../models/promoCode.model");

/**
 * Release a promo redemption when a ride is cancelled before completion.
 * The ride is atomically marked first so repeated cancellation/admin calls
 * cannot decrement the same promo more than once.
 */
async function releasePromoUsage(rideOrId) {
  const rideId = rideOrId?._id || rideOrId;
  if (!rideId) return false;

  const claimed = await Ride.findOneAndUpdate(
    {
      _id: rideId,
      promoCode: { $nin: [null, ""] },
      promoUsageReleased: { $ne: true },
    },
    { $set: { promoUsageReleased: true } },
    { new: false }
  ).select("promoCode");

  if (!claimed?.promoCode) return false;
  await PromoCode.updateOne(
    { code: String(claimed.promoCode).toUpperCase(), usageCount: { $gt: 0 } },
    { $inc: { usageCount: -1 } }
  );
  return true;
}

module.exports = { releasePromoUsage };
