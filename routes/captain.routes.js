const express = require("express");
const router = express.Router();
const captainController = require("../controllers/captain.controller");
const { body } = require("express-validator");
const { authCaptain } = require("../middlewares/auth.middleware");
const { normalizeNigeriaPhone, NIGERIA_PHONE_REGEX } = require("../utils/nigeria");

router.post("/register",
    body("email").isEmail().withMessage("Invalid Email"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters long"),
    body("phone").customSanitizer(normalizeNigeriaPhone).matches(NIGERIA_PHONE_REGEX).withMessage("Enter a valid Nigerian mobile number, e.g. +2348012345678"),
    body("fullname.firstname").isLength({min:3}).withMessage("First name must be at least 3 characters long"),
    captainController.registerCaptain
);


router.post("/login", 
    body("email").isEmail().withMessage("Invalid Email"),
    captainController.loginCaptain
);

router.post("/update", 
    body("captainData.phone").customSanitizer(normalizeNigeriaPhone).matches(NIGERIA_PHONE_REGEX).withMessage("Enter a valid Nigerian mobile number, e.g. +2348012345678"),
    body("captainData.fullname.firstname").isLength({min:2}).withMessage("First name must be at least 2 characters long"),
    authCaptain,
    captainController.updateCaptainProfile
);

router.get("/profile", authCaptain, captainController.captainProfile);

router.patch("/documents", authCaptain, captainController.updateDocuments);
router.patch("/availability", authCaptain, captainController.setAvailability);
router.get("/incoming-rides", authCaptain, captainController.incomingRides);
router.get("/current-ride", authCaptain, captainController.currentRide);


router.patch("/location", authCaptain, captainController.updateLocation);
router.get("/notifications", authCaptain, captainController.notifications);
router.patch("/notifications/:id/read", authCaptain, captainController.readNotification);
router.get("/push-config", authCaptain, captainController.pushConfig);
router.post("/push-subscriptions", authCaptain, captainController.savePushSubscription);
router.delete("/push-subscriptions", authCaptain, captainController.removePushSubscription);
router.get("/settlements", authCaptain, captainController.settlements);
router.post("/complaint", authCaptain, captainController.createComplaint);

router.get("/earnings", authCaptain, captainController.earningsSummary);
router.get("/incentives", authCaptain, captainController.incentives);
router.get("/performance", authCaptain, captainController.performance);
router.get("/withdrawals", authCaptain, captainController.listWithdrawals);
router.post("/withdrawals", authCaptain, captainController.requestWithdrawal);

router.get("/logout", authCaptain, captainController.logoutCaptain);

router.post(
    "/reset-password",
    body("token").notEmpty().withMessage("Token is required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters long"),
    captainController.resetPassword
);

module.exports = router;
