const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const adminController = require("../controllers/admin.controller");
const auth = require("../middlewares/auth.middleware");

router.post("/login",
  body("email").isEmail().withMessage("Invalid email"),
  body("password").isString().isLength({ min: 3 }).withMessage("Invalid password"),
  adminController.loginAdmin
);

// protected

router.get("/users", auth.authAdmin, adminController.listUsers);
router.post("/users", auth.authAdmin, adminController.createUser);
router.patch("/users/:id", auth.authAdmin, adminController.updateUser);
router.delete("/users/:id", auth.authAdmin, adminController.deleteUser);

router.post("/captains", auth.authAdmin, adminController.createCaptain);
router.patch("/captains/:id", auth.authAdmin, adminController.updateCaptain);
router.delete("/captains/:id", auth.authAdmin, adminController.deleteCaptain);

router.patch("/vehicles/:id", auth.authAdmin, adminController.updateVehicle);
router.delete("/vehicles/:id", auth.authAdmin, adminController.deleteVehicle);

router.get("/rides", auth.authAdmin, adminController.listRides);
router.patch("/rides/:id", auth.authAdmin, adminController.updateRide);
router.delete("/rides/:id", auth.authAdmin, adminController.deleteRide);

router.patch("/payouts/:id", auth.authAdmin, adminController.updatePayout);
router.patch("/incentives/:id", auth.authAdmin, adminController.updateIncentive);

router.get("/captains", auth.authAdmin, adminController.listCaptains);
router.patch("/captains/:id/approve", auth.authAdmin, adminController.approveCaptain);
router.patch("/captains/:id/documents", auth.authAdmin, adminController.setCaptainDocStatus);

router.post("/vehicles", auth.authAdmin, adminController.createVehicle);
router.get("/vehicles", auth.authAdmin, adminController.listVehicles);
router.patch("/vehicles/:id/docs", auth.authAdmin, adminController.updateVehicleDocs);

router.get("/analytics/summary", auth.authAdmin, adminController.analyticsSummary);
router.get("/online-captains", auth.authAdmin, adminController.onlineCaptains);

router.post("/incentives", auth.authAdmin, adminController.createIncentive);
router.get("/incentives", auth.authAdmin, adminController.listIncentives);


router.get("/emergencies", auth.authAdmin, adminController.listEmergencies);
router.patch("/emergencies/:id", auth.authAdmin, adminController.updateEmergency);
router.get("/complaints", auth.authAdmin, adminController.listComplaints);
router.patch("/complaints/:id", auth.authAdmin, adminController.updateComplaint);
router.get("/withdrawals", auth.authAdmin, adminController.listWithdrawals);
router.patch("/withdrawals/:id", auth.authAdmin, adminController.updateWithdrawal);
router.get("/scheduled-rides", auth.authAdmin, adminController.listScheduledRides);

router.get("/reviews", auth.authAdmin, adminController.listReviews);
router.patch("/reviews/hide", auth.authAdmin, adminController.hideReview);

router.get("/payouts", auth.authAdmin, adminController.listPayouts);
router.post("/payouts", auth.authAdmin, adminController.createPayout);

module.exports = router;
