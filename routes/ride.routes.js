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
);

module.exports = router;
