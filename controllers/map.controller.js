const mapService = require("../services/map.service");
const { validationResult } = require("express-validator");

module.exports.getCoordinates = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { address } = req.query;

  try {
    const coordinates = await mapService.getAddressCoordinate(address);
    res.status(200).json(coordinates);
  } catch (error) {
    res.status(404).json({ message: "Coordinates not found", error: error });
  }
};

module.exports.getDistanceTime = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { origin, destination } = req.query;

    const distanceTime = await mapService.getDistanceTime(origin, destination);

    res.status(200).json(distanceTime);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Map service error" });
  }
};

module.exports.getAutoCompleteSuggestions = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

<<<<<<< HEAD
    const { input, lat, lng } = req.query;
    const userLocation = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
      ? { ltd: Number(lat), lng: Number(lng) }
      : null;

    const suggestions = await mapService.getAutoCompleteSuggestions(input, userLocation);
=======
    const { input } = req.query;

    const suggestions = await mapService.getAutoCompleteSuggestions(input);
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc

    res.status(200).json(suggestions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Map service error" });
  }
};
<<<<<<< HEAD

module.exports.reverseGeocode = async (req, res) => {
  try {
    const result = await mapService.reverseGeocode(req.query.lat, req.query.lng);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message || "Unable to resolve current location" });
  }
};
=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
