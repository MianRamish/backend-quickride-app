const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { body } = require("express-validator");
const { authUser } = require("../middlewares/auth.middleware");
<<<<<<< HEAD
const { normalizeNigeriaPhone, NIGERIA_PHONE_REGEX } = require("../utils/nigeria");
=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc

router.post("/register",
    body("email").isEmail().withMessage("Invalid Email"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters long"),
    body("fullname.firstname").isLength({min:2}).withMessage("First name must be at least 2 characters long"),
<<<<<<< HEAD
    body("phone").customSanitizer(normalizeNigeriaPhone).matches(NIGERIA_PHONE_REGEX).withMessage("Enter a valid Nigerian mobile number, e.g. +2348012345678"),
    body("referralCode").optional({ nullable: true, checkFalsy: true }).isString().isLength({ max: 30 }),
    userController.registerUser
);

=======
    body("phone").isLength({min:10, max:10}).withMessage("Phone number should be of 10 digits only"),
    userController.registerUser
);

router.post("/verify-email", userController.verifyEmail);
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc

router.post("/login", 
    body("email").isEmail().withMessage("Invalid Email"),
    userController.loginUser
);

router.post("/update", authUser,
    body("fullname.firstname").isLength({min:2}).withMessage("First name must be at least 2 characters long"),
    body("fullname.lastname").isLength({min:2}).withMessage("Last name must be at least 2 characters long"),
<<<<<<< HEAD
    body("phone").customSanitizer(normalizeNigeriaPhone).matches(NIGERIA_PHONE_REGEX).withMessage("Enter a valid Nigerian mobile number, e.g. +2348012345678"),
    body("referralCode").optional({ nullable: true, checkFalsy: true }).isString().isLength({ max: 30 }),
=======
    body("phone").isLength({min:10, max:10}).withMessage("Phone number should be of 10 digits only"),
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
    userController.updateUserProfile
);

router.get("/profile", authUser, userController.userProfile);

<<<<<<< HEAD
router.get("/saved-places", authUser, userController.savedPlaces);
router.post("/saved-places", authUser, userController.addSavedPlace);
router.delete("/saved-places/:id", authUser, userController.removeSavedPlace);
router.get("/emergency-contacts", authUser, userController.emergencyContacts);
router.post("/emergency-contacts", authUser, userController.addEmergencyContact);
router.delete("/emergency-contacts/:id", authUser, userController.removeEmergencyContact);
router.get("/notifications", authUser, userController.notifications);
router.patch("/notifications/:id/read", authUser, userController.readNotification);
router.get("/push-config", authUser, userController.pushConfig);
router.post("/push-subscriptions", authUser, userController.savePushSubscription);
router.delete("/push-subscriptions", authUser, userController.removePushSubscription);

=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
router.get("/logout", authUser, userController.logoutUser);

router.post(
    "/reset-password",
    body("token").notEmpty().withMessage("Token is required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters long"),
    userController.resetPassword
);

module.exports = router;
