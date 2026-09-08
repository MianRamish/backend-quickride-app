const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const mapController = require('../controllers/map.controller');
const { query } = require('express-validator');

router.get('/get-coordinates',
    query('address').isString().isLength({ min: 3 }),
    // authMiddleware.authUser,
    mapController.getCoordinates
);

router.get('/get-distance-time',
    query('origin').isString().isLength({ min: 3 }),
    query('destination').isString().isLength({ min: 3 }),
    authMiddleware.authUser,
    mapController.getDistanceTime
)

router.get('/get-suggestions',
    query('input').isString().isLength({ min: 3 }),
<<<<<<< HEAD
    query('lat').optional().isFloat({ min: -90, max: 90 }),
    query('lng').optional().isFloat({ min: -180, max: 180 }),
    authMiddleware.authAny,
=======
    authMiddleware.authUser,
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
    mapController.getAutoCompleteSuggestions
)


<<<<<<< HEAD
router.get('/reverse-geocode',
    query('lat').isFloat({ min: -90, max: 90 }),
    query('lng').isFloat({ min: -180, max: 180 }),
    authMiddleware.authAny,
    mapController.reverseGeocode
);
=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc

module.exports = router;