const mongoose = require("mongoose");

const vehicleFareSchema = new mongoose.Schema({
  base: { type: Number, min: 0, required: true },
  perKm: { type: Number, min: 0, required: true },
  perMinute: { type: Number, min: 0, required: true },
  minimum: { type: Number, min: 0, required: true },
}, { _id: false });

const appConfigSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: "operations", index: true },
  currency: { type: String, default: "NGN" },
  fares: {
    car: { type: vehicleFareSchema, default: () => ({ base: 800, perKm: 220, perMinute: 35, minimum: 1200 }) },
    bike: { type: vehicleFareSchema, default: () => ({ base: 500, perKm: 120, perMinute: 20, minimum: 800 }) },
  },
  commissionRate: { type: Number, min: 0, max: 1, default: 0.2 },
  cancellationFee: { type: Number, min: 0, default: 500 },
  cancellationFreeMinutes: { type: Number, min: 0, default: 3 },
  matchingRadiusKm: { type: Number, min: 1, max: 50, default: 8 },
  rideOfferSeconds: { type: Number, min: 8, max: 90, default: 20 },
  driverLocationStaleSeconds: { type: Number, min: 15, max: 900, default: 120 },
  scheduledDispatchMinutes: { type: Number, min: 5, max: 180, default: 20 },
  waitingFreeMinutes: { type: Number, min: 0, max: 60, default: 5 },
  supportPhone: { type: String, default: "" },
  cardPaymentsEnabled: { type: Boolean, default: false },
}, { timestamps: true });

appConfigSchema.statics.getOperations = async function () {
  const defaults = {
    key: "operations",
    currency: "NGN",
    fares: {
      car: {
        base: Number(process.env.FARE_CAR_BASE_NGN || 800),
        perKm: Number(process.env.FARE_CAR_PER_KM_NGN || 220),
        perMinute: Number(process.env.FARE_CAR_PER_MIN_NGN || 35),
        minimum: Number(process.env.FARE_CAR_MIN_NGN || 1200),
      },
      bike: {
        base: Number(process.env.FARE_BIKE_BASE_NGN || 500),
        perKm: Number(process.env.FARE_BIKE_PER_KM_NGN || 120),
        perMinute: Number(process.env.FARE_BIKE_PER_MIN_NGN || 20),
        minimum: Number(process.env.FARE_BIKE_MIN_NGN || 800),
      },
    },
    commissionRate: Number(process.env.COMMISSION_RATE || 0.2),
    cancellationFee: Number(process.env.CANCELLATION_FEE_NGN || 500),
    cancellationFreeMinutes: Number(process.env.CANCELLATION_FREE_MINUTES || 3),
    matchingRadiusKm: Number(process.env.MATCHING_RADIUS_KM || 8),
    rideOfferSeconds: Number(process.env.RIDE_OFFER_SECONDS || 20),
    driverLocationStaleSeconds: Number(process.env.DRIVER_LOCATION_STALE_SECONDS || 120),
    scheduledDispatchMinutes: Number(process.env.SCHEDULED_DISPATCH_MINUTES || 20),
    waitingFreeMinutes: Number(process.env.WAITING_FREE_MINUTES || 5),
    supportPhone: String(process.env.SUPPORT_PHONE || ""),
    // Kept false until a real payment gateway is integrated and explicitly enabled in code.
    cardPaymentsEnabled: false,
  };
  return this.findOneAndUpdate({ key: "operations" }, { $setOnInsert: defaults }, { new: true, upsert: true });
};

module.exports = mongoose.model("AppConfig", appConfigSchema);
