<<<<<<< HEAD
const express = require("express");
const router = express.Router();
const { body, query } = require("express-validator");
const rideController = require("../controllers/ride.controller");
const auth = require("../middlewares/auth.middleware");

router.get("/shared/:token", rideController.publicSharedTrip);
router.get("/chat-details/:id", auth.authAny, rideController.chatDetails);
router.get("/:id/contact", auth.authAny, rideController.rideContact);
router.get("/payment-methods", auth.authUser, rideController.getPaymentMethods);
router.get("/cancellation-reasons", auth.authAny, rideController.getCancellationReasons);
router.get("/active", auth.authUser, rideController.activeRide);
router.get("/scheduled", auth.authUser, rideController.myScheduledRides);
router.get("/:id/share", auth.authUser, rideController.shareTrip);

router.post("/promo/validate", auth.authUser,
  body("promoCode").isString().isLength({ min: 2, max: 40 }),
  body("fare").isFloat({ gt: 0 }),
  rideController.validatePromo
);

router.post("/create", auth.authUser,
  body("pickup").isString().isLength({ min: 3 }).withMessage("Invalid pickup address"),
  body("destination").isString().isLength({ min: 3 }).withMessage("Invalid destination address"),
  body("vehicleType").isString().isIn(["car", "bike"]).withMessage("Invalid vehicle type"),
  body("rideMode").optional().isIn(["now", "scheduled"]),
  body("scheduledFor").optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage("Invalid scheduled date"),
  body("paymentMethod").optional().isIn(["cash", "card"]).withMessage("Invalid payment method"),
  body("promoCode").optional({ nullable: true, checkFalsy: true }).isString().isLength({ max: 40 }),
  rideController.createRide
);

router.get("/get-fare", auth.authUser,
  query("pickup").isString().isLength({ min: 3 }).withMessage("Invalid pickup address"),
  query("destination").isString().isLength({ min: 3 }).withMessage("Invalid destination address"),
  rideController.getFare
);

router.post("/confirm", auth.authCaptain, body("rideId").isMongoId(), rideController.confirmRide);
router.post("/arriving", auth.authCaptain, body("rideId").isMongoId(), rideController.markArriving);
router.post("/arrived", auth.authCaptain, body("rideId").isMongoId(), rideController.markArrived);
router.post("/reject", auth.authCaptain,
  body("rideId").isMongoId(), body("reasonCode").optional().isString(), body("reasonText").optional().isString(), rideController.rejectRide
);
router.post("/cancel-user", auth.authUser,
  body("rideId").isMongoId(), body("reasonCode").optional().isString(), body("reasonText").optional().isString(), rideController.cancelRideUser
);
router.post("/cancel-captain", auth.authCaptain,
  body("rideId").isMongoId(), body("reasonCode").optional().isString(), body("reasonText").optional().isString(), rideController.cancelRideCaptain
);
router.get("/cancel", auth.authUser, query("rideId").isMongoId(), rideController.cancelRide);

router.get("/start-ride", auth.authCaptain,
  query("rideId").isMongoId(), query("otp").isString().isLength({ min: 6, max: 6 }), rideController.startRide
);
router.post("/end-ride", auth.authCaptain,
  body("rideId").isMongoId(), body("cashCollected").optional().isBoolean(), rideController.endRide
);

router.post("/rate", auth.authUser,
  body("rideId").isMongoId(), body("rating").isInt({ min: 1, max: 5 }), body("review").optional().isString().isLength({ max: 1000 }), body("tags").optional().isArray({ max: 6 }), body("tags.*").optional().isString().isLength({ max: 80 }), rideController.rateRide
);
router.post("/rate-passenger", auth.authCaptain,
  body("rideId").isMongoId(), body("rating").isInt({ min: 1, max: 5 }), body("review").optional().isString().isLength({ max: 1000 }), body("tags").optional().isArray({ max: 6 }), body("tags.*").optional().isString().isLength({ max: 80 }), rideController.ratePassenger
);

router.post("/emergency", auth.authUser,
  body("rideId").optional({ nullable: true }).isMongoId(), body("type").optional().isString(), body("message").optional().isString().isLength({ max: 1000 }), rideController.createEmergency
);
router.post("/complaint", auth.authUser,
  body("rideId").optional({ nullable: true }).isMongoId(), body("category").optional().isString(), body("description").isString().isLength({ min: 5, max: 3000 }), body("attachmentUrl").optional().isString(), rideController.createComplaint
=======
const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const rideController = require('../controllers/ride.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.get('/chat-details/:id', rideController.chatDetails);

router.post('/create',
  authMiddleware.authUser,
  body('pickup').isString().isLength({ min: 3 }).withMessage('Invalid pickup address'),
  body('destination').isString().isLength({ min: 3 }).withMessage('Invalid destination address'),
  body('vehicleType').isString().isIn(['car', 'bike']).withMessage('Invalid vehicle type'),
  body('rideMode').optional().isIn(['now', 'scheduled']),
  body('scheduledFor').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Invalid scheduled date'),
  rideController.createRide
);

router.get('/get-fare',
  authMiddleware.authUser,
  query('pickup').isString().isLength({ min: 3 }).withMessage('Invalid pickup address'),
  query('destination').isString().isLength({ min: 3 }).withMessage('Invalid destination address'),
  rideController.getFare
);


router.post('/emergency',
  authMiddleware.authUser,
  body('rideId').optional({ nullable: true }).isMongoId().withMessage('Invalid ride id'),
  body('type').optional().isString(),
  body('message').optional().isString().isLength({ max: 1000 }),
  rideController.createEmergency
);

router.post('/complaint',
  authMiddleware.authUser,
  body('rideId').optional({ nullable: true }).isMongoId().withMessage('Invalid ride id'),
  body('category').optional().isString(),
  body('description').isString().isLength({ min: 5, max: 3000 }).withMessage('Complaint description is required'),
  body('attachmentUrl').optional().isString(),
  rideController.createComplaint
);

router.get('/scheduled', authMiddleware.authUser, rideController.myScheduledRides);

router.post('/confirm',
  authMiddleware.authCaptain,
  body('rideId').isMongoId().withMessage('Invalid ride id'),
  rideController.confirmRide
);

router.post('/reject',
  authMiddleware.authCaptain,
  body('rideId').isMongoId().withMessage('Invalid ride id'),
  body('reasonCode').optional().isString(),
  body('reasonText').optional().isString(),
  rideController.rejectRide
);

router.post('/cancel-user',
  authMiddleware.authUser,
  body('rideId').isMongoId().withMessage('Invalid ride id'),
  body('reasonCode').optional().isString(),
  body('reasonText').optional().isString(),
  rideController.cancelRideUser
);

router.post('/cancel-captain',
  authMiddleware.authCaptain,
  body('rideId').isMongoId().withMessage('Invalid ride id'),
  body('reasonCode').optional().isString(),
  body('reasonText').optional().isString(),
  rideController.cancelRideCaptain
);

router.post('/rate',
  authMiddleware.authUser,
  body('rideId').isMongoId().withMessage('Invalid ride id'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1 to 5'),
  body('review').optional().isString().isLength({ max: 1000 }),
  rideController.rateRide
);

// Legacy route kept for older frontend builds.
router.get('/cancel',
  query('rideId').isMongoId().withMessage('Invalid ride id'),
  rideController.cancelRide
);

router.get('/start-ride',
  authMiddleware.authCaptain,
  query('rideId').isMongoId().withMessage('Invalid ride id'),
  query('otp').isString().isLength({ min: 6, max: 6 }).withMessage('Invalid OTP'),
  rideController.startRide
);

router.post('/end-ride',
  authMiddleware.authCaptain,
  body('rideId').isMongoId().withMessage('Invalid ride id'),
  rideController.endRide
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
);

module.exports = router;
