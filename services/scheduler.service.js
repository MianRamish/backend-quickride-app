const Ride = require("../models/ride.model");
const operations = require("./operations.service");
const matching = require("./matching.service");
const notifications = require("./notification.service");

let interval = null;
let running = false;

async function processScheduledRides() {
  if (running) return;
  running = true;
  try {
    const config = await operations.getConfig();
    const leadMs = Number(config.scheduledDispatchMinutes || 20) * 60 * 1000;
    const now = new Date();
    const cutoff = new Date(Date.now() + leadMs);
    const rides = await Ride.find({
      status: "scheduled",
      scheduledStatus: { $in: ["waiting", "notified"] },
      scheduledFor: { $gte: new Date(Date.now() - 15 * 60 * 1000), $lte: cutoff },
    }).populate("user", "_id").limit(100);

    for (const ride of rides) {
      const wasWaiting = ride.scheduledStatus === "waiting";
      ride.status = "pending";
      ride.scheduledStatus = "notified";
      ride.requestExpiresAt = new Date(Math.max(new Date(ride.scheduledFor).getTime() + 15 * 60 * 1000, Date.now() + 5 * 60 * 1000));
      ride.statusTimeline.push({ status: "pending", at: now, by: "system", note: "Scheduled ride released for driver matching" });
      await ride.save();
      if (wasWaiting && ride.user?._id) {
        await notifications.notify({ recipientType: "user", recipient: ride.user._id, type: "scheduled_ride", title: "Finding your scheduled driver", body: `QuickRide is now matching a driver for your ${new Date(ride.scheduledFor).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })} pickup.`, ride: ride._id });
      }
      matching.dispatchRide(ride._id).catch(() => {});
    }
  } catch (error) {
    console.error("Scheduled ride processor failed:", error.message);
  } finally {
    running = false;
  }
}

function startScheduledRideProcessor() {
  if (interval) return;
  processScheduledRides().catch(() => {});
  interval = setInterval(() => processScheduledRides().catch(() => {}), 30000);
}

module.exports = { startScheduledRideProcessor, processScheduledRides };
