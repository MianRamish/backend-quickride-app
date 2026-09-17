const blacklistTokenModel = require("../models/blacklistToken.model");
const jwt = require("jsonwebtoken");
const userModel = require("../models/user.model");
const captainModel = require("../models/captain.model");
const adminModel = require("../models/admin.model");

function getToken(req) {
  const authHeader = req.headers.authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  return req.cookies?.token || req.headers.token || bearerToken || null;
}

async function decodeRequestToken(req) {
  const token = getToken(req);
  if (!token) return { error: "missing" };

  const isBlacklisted = await blacklistTokenModel.exists({ token });
  if (isBlacklisted) return { error: "blacklisted" };

  try {
    return { token, decoded: jwt.verify(token, process.env.JWT_SECRET) };
  } catch (error) {
    return { error: error.name === "TokenExpiredError" ? "expired" : "invalid" };
  }
}

function authError(res, result, message = "Unauthorized User") {
  if (result.error === "expired") return res.status(401).json({ message: "Token Expired" });
  return res.status(401).json({ message });
}

module.exports.getToken = getToken;

module.exports.authUser = async (req, res, next) => {
  const result = await decodeRequestToken(req);
  if (result.error) return authError(res, result);
  if (result.decoded.userType && result.decoded.userType !== "user") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const user = await userModel
    .findById(result.decoded.id)
    .select("_id fullname email phone socketId emailVerified status")
    .lean();

  if (!user) return res.status(401).json({ message: "Unauthorized User" });
  if (user.status === "suspended") {
    return res.status(403).json({ message: "Your passenger account has been suspended. Contact support." });
  }

  req.user = user;
  req.userType = "user";
  req.authToken = result.token;
  return next();
};

module.exports.authCaptain = async (req, res, next) => {
  const result = await decodeRequestToken(req);
  if (result.error) return authError(res, result);
  if (result.decoded.userType && result.decoded.userType !== "captain") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const captain = await captainModel
    .findById(result.decoded.id)
    .select(
      "_id fullname email phone socketId vehicle status isApproved verificationStatus verificationNote availabilityStatus isOnline activeVehicle location lastLocationAt lastLocationSource manualLocationLabel"
    )
    .lean();

  if (!captain) return res.status(401).json({ message: "Unauthorized User" });
  if (captain.status === "suspended" || captain.verificationStatus === "suspended") {
    return res.status(403).json({ message: "Your driver account has been suspended. Contact QuickRide support." });
  }

  req.captain = captain;
  req.userType = "captain";
  req.authToken = result.token;
  return next();
};

module.exports.authAdmin = async (req, res, next) => {
  const result = await decodeRequestToken(req);
  if (result.error) return res.status(401).json({ message: "Unauthorized" });
  if (result.decoded.userType !== "admin") return res.status(403).json({ message: "Forbidden" });

  const admin = await adminModel.findById(result.decoded.id).lean();
  if (!admin) return res.status(401).json({ message: "Unauthorized" });

  req.admin = admin;
  req.userType = "admin";
  req.authToken = result.token;
  return next();
};

module.exports.authAny = async (req, res, next) => {
  const result = await decodeRequestToken(req);
  if (result.error) return res.status(401).json({ message: "Unauthorized" });

  if (result.decoded.userType === "captain") {
    const captain = await captainModel
      .findById(result.decoded.id)
      .select("_id fullname email phone socketId status verificationStatus")
      .lean();
    if (!captain) return res.status(401).json({ message: "Unauthorized" });
    if (captain.status === "suspended" || captain.verificationStatus === "suspended") {
      return res.status(403).json({ message: "Driver account suspended" });
    }
    req.captain = captain;
    req.userType = "captain";
  } else if (result.decoded.userType === "admin") {
    const admin = await adminModel.findById(result.decoded.id).lean();
    if (!admin) return res.status(401).json({ message: "Unauthorized" });
    req.admin = admin;
    req.userType = "admin";
  } else {
    const user = await userModel.findById(result.decoded.id).select("_id fullname email phone socketId status").lean();
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.status === "suspended") {
      return res.status(403).json({ message: "Passenger account suspended" });
    }
    req.user = user;
    req.userType = "user";
  }

  req.authToken = result.token;
  return next();
};
