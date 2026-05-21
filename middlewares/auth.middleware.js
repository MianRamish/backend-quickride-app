const blacklistTokenModel = require("../models/blacklistToken.model");
const jwt = require("jsonwebtoken");
const userModel = require("../models/user.model");
const captainModel = require("../models/captain.model");
const adminModel = require("../models/admin.model");


function getToken(req) {
  const authHeader = req.headers.authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  return req.cookies.token || req.headers.token || bearerToken;
}

module.exports.authUser = async (req, res, next) => {
  const token = getToken(req);

  if (!token) {
    return res.status(401).json({ message: "Unauthorized User" });
  }

  const isBlacklisted = await blacklistTokenModel.findOne({ token });
  if (isBlacklisted) {
    return res.status(401).json({ message: "Blacklisted Unauthorized User" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findOne({ _id: decoded.id }).populate("rides");
    if (!user) {
      return res.status(401).json({ message: "Unauthorized User" });
    }

    req.user = {
      _id: user._id,
      fullname: {
        firstname: user.fullname.firstname,
        lastname: user.fullname.lastname,
      },
      email: user.email,
      phone: user.phone,
      rides: user.rides,
      socketId: user.socketId,
      emailVerified: user.emailVerified || false,
    };
    req.userType = "user";

    next();
  } catch (error) {
    if (error.message === "jwt expired") {
      return res.status(401).json({ message: "Token Expired" });
    } else {
      return res.status(401).json({ message: "Unauthorized User", error });
    }
  }
};

module.exports.authCaptain = async (req, res, next) => {
  const token = getToken(req);

  if (!token) {
    return res.status(401).json({ message: "Unauthorized User" });
  }

  const isBlacklisted = await blacklistTokenModel.findOne({ token });
  if (isBlacklisted) {
    return res.status(401).json({ message: "Unauthorized User" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const captain = await captainModel
      .findOne({ _id: decoded.id })
      .populate("rides");
    if (!captain) {
      return res.status(401).json({ message: "Unauthorized User" });
    }
    req.captain = {
      _id: captain._id,
      fullname: {
        firstname: captain.fullname.firstname,
        lastname: captain.fullname.lastname,
      },
      email: captain.email,
      phone: captain.phone,
      rides: captain.rides,
      socketId: captain.socketId,
      emailVerified: captain.emailVerified,
      vehicle: captain.vehicle,
      status: captain.status,
      isApproved: captain.isApproved,
      verificationStatus: captain.verificationStatus,
      verificationNote: captain.verificationNote,
      availabilityStatus: captain.availabilityStatus,
      isOnline: captain.isOnline,
      activeVehicle: captain.activeVehicle,
      profilePhotoUrl: captain.profilePhotoUrl,
      vehiclePhotoUrl: captain.vehiclePhotoUrl,
      documents: captain.documents,
      stats: captain.stats,
      earnings: captain.earnings,
      rating: captain.rating,
      performanceScore: captain.performanceScore,
      location: captain.location,
    };
    req.userType = "captain";
    next();
  } catch (error) {
    if (error.message === "jwt expired") {
      return res.status(401).json({ message: "Token Expired" });
    } else {
      return res.status(401).json({ message: "Unauthorized User", error });
    }
  }
};


module.exports.authAdmin = async (req, res, next) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  const isBlacklisted = await blacklistTokenModel.findOne({ token });
  if (isBlacklisted) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.userType !== "admin") return res.status(403).json({ message: "Forbidden" });
    const admin = await adminModel.findById(decoded.id);
    if (!admin) return res.status(401).json({ message: "Unauthorized" });
    req.admin = admin;
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
