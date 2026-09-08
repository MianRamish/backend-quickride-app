const express = require("express");
const router = express.Router();
const mailController = require("../controllers/mail.controller");
<<<<<<< HEAD

// Email is optional and currently used only for password-reset delivery if SMTP is configured.
router.post("/:userType/reset-password", mailController.forgotPassword);
=======
const { body } = require("express-validator");
const { authUser, authCaptain } = require("../middlewares/auth.middleware");

router.get("/verify-user-email", authUser, mailController.sendVerificationEmail);
router.get("/verify-captain-email", authCaptain, mailController.sendVerificationEmail);

router.post("/:userType/reset-password",  mailController.forgotPassword);

>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc

module.exports = router;
