const express = require("express");
const router = express.Router();
const mailController = require("../controllers/mail.controller");

// Email is optional and currently used only for password-reset delivery if SMTP is configured.
router.post("/:userType/reset-password", mailController.forgotPassword);

module.exports = router;
