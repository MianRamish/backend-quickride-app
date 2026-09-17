const captainModel = require("../models/captain.model");

module.exports.profile = async (req, res) => {
  const captain = await captainModel
    .findById(req.captain._id)
    .select("-password -rides")
    .populate("activeVehicle")
    .lean();

  if (!captain) return res.status(404).json({ message: "Captain not found" });
  return res.status(200).json({ captain });
};

module.exports.performance = async (req, res) => {
  const captain = await captainModel
    .findById(req.captain._id)
    .select("stats rating performanceScore documents isApproved isOnline")
    .lean();

  if (!captain) return res.status(404).json({ message: "Captain not found" });

  const accepted = captain.stats?.acceptedRides || 0;
  const cancelled = captain.stats?.cancelledRides || 0;
  const completed = captain.stats?.completedRides || 0;
  const kilometres = captain.stats?.kmTravelled || 0;
  const ratingAvg = captain.rating?.avg || 0;
  const ratingCount = captain.rating?.count || 0;

  return res.json({
    performanceScore: captain.performanceScore ?? 100,
    accepted,
    cancelled,
    completed,
    kilometres,
    kmTravelled: kilometres,
    miles: kilometres,
    ratingAvg,
    ratingCount,
    docs: captain.documents || {},
    approved: captain.isApproved,
    online: captain.isOnline,
  });
};
