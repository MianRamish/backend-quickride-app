const axios = require("axios");
const captainModel = require("../models/captain.model");

const NOMINATIM_URL = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const PHOTON_URL = process.env.PHOTON_URL || "https://photon.komoot.io";
const OSRM_URL = process.env.OSRM_URL || "https://router.project-osrm.org";
const APP_USER_AGENT = process.env.GEOCODING_USER_AGENT || "QuickRide/1.0 (support@quickride.local)";
const MAP_COUNTRY_CODES = (process.env.MAP_COUNTRY_CODES || "ca,us")
  .split(",")
  .map((code) => code.trim().toLowerCase())
  .filter(Boolean)
  .join(",");

const NORTH_AMERICA_BBOX = process.env.MAP_SEARCH_BBOX || "-168,15,-52,84";

const KNOWN_PLACE_COORDINATES = {
  // Canada
  "canada": { ltd: 56.1304, lng: -106.3468, displayName: "Canada" },
  "toronto": { ltd: 43.6532, lng: -79.3832, displayName: "Toronto, ON, Canada" },
  "toronto canada": { ltd: 43.6532, lng: -79.3832, displayName: "Toronto, ON, Canada" },
  "ontario": { ltd: 43.6532, lng: -79.3832, displayName: "Toronto, ON, Canada" },
  "ontario canada": { ltd: 43.6532, lng: -79.3832, displayName: "Toronto, ON, Canada" },
  "ottawa": { ltd: 45.4215, lng: -75.6972, displayName: "Ottawa, ON, Canada" },
  "montreal": { ltd: 45.5017, lng: -73.5673, displayName: "Montreal, QC, Canada" },
  "vancouver": { ltd: 49.2827, lng: -123.1207, displayName: "Vancouver, BC, Canada" },
  "calgary": { ltd: 51.0447, lng: -114.0719, displayName: "Calgary, AB, Canada" },
  "edmonton": { ltd: 53.5461, lng: -113.4938, displayName: "Edmonton, AB, Canada" },
  "winnipeg": { ltd: 49.8951, lng: -97.1384, displayName: "Winnipeg, MB, Canada" },
  "quebec city": { ltd: 46.8139, lng: -71.2080, displayName: "Quebec City, QC, Canada" },
  "halifax": { ltd: 44.6488, lng: -63.5752, displayName: "Halifax, NS, Canada" },
  "niagara falls": { ltd: 43.0896, lng: -79.0849, displayName: "Niagara Falls, ON, Canada" },

  // United States
  "united states": { ltd: 39.8283, lng: -98.5795, displayName: "United States" },
  "usa": { ltd: 39.8283, lng: -98.5795, displayName: "United States" },
  "new york": { ltd: 40.7128, lng: -74.0060, displayName: "New York, NY, USA" },
  "new york city": { ltd: 40.7128, lng: -74.0060, displayName: "New York, NY, USA" },
  "los angeles": { ltd: 34.0522, lng: -118.2437, displayName: "Los Angeles, CA, USA" },
  "chicago": { ltd: 41.8781, lng: -87.6298, displayName: "Chicago, IL, USA" },
  "houston": { ltd: 29.7604, lng: -95.3698, displayName: "Houston, TX, USA" },
  "phoenix": { ltd: 33.4484, lng: -112.0740, displayName: "Phoenix, AZ, USA" },
  "philadelphia": { ltd: 39.9526, lng: -75.1652, displayName: "Philadelphia, PA, USA" },
  "san antonio": { ltd: 29.4241, lng: -98.4936, displayName: "San Antonio, TX, USA" },
  "san diego": { ltd: 32.7157, lng: -117.1611, displayName: "San Diego, CA, USA" },
  "dallas": { ltd: 32.7767, lng: -96.7970, displayName: "Dallas, TX, USA" },
  "san jose": { ltd: 37.3382, lng: -121.8863, displayName: "San Jose, CA, USA" },
  "san francisco": { ltd: 37.7749, lng: -122.4194, displayName: "San Francisco, CA, USA" },
  "seattle": { ltd: 47.6062, lng: -122.3321, displayName: "Seattle, WA, USA" },
  "boston": { ltd: 42.3601, lng: -71.0589, displayName: "Boston, MA, USA" },
  "miami": { ltd: 25.7617, lng: -80.1918, displayName: "Miami, FL, USA" },
  "washington dc": { ltd: 38.9072, lng: -77.0369, displayName: "Washington, DC, USA" },
};

const getKnownPlaceResult = (address) => {
  const key = String(address || "").trim().toLowerCase().replace(/\s+/g, " ");
  const exact = KNOWN_PLACE_COORDINATES[key];
  if (exact) return { ...exact, provider: "known-place-fallback" };

  const partialKey = Object.keys(KNOWN_PLACE_COORDINATES).find((place) =>
    key.includes(place) || place.includes(key)
  );

  if (!partialKey) return null;
  return { ...KNOWN_PLACE_COORDINATES[partialKey], provider: "known-place-fallback" };
};


const http = axios.create({
  timeout: 15000,
  headers: {
    "User-Agent": APP_USER_AGENT,
    "Accept-Language": "en",
  },
});

const formatDistance = (meters = 0) => {
  const miles = meters / 1609.344;
  if (miles < 0.1) return `${Math.round(meters * 3.28084)} ft`;
  return `${miles.toFixed(1)} mi`;
};

const formatDuration = (seconds = 0) => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours} hr ${mins} min` : `${hours} hr`;
};

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const calculateHaversineDistance = (from, to) => {
  const earthRadiusMeters = 6371000;
  const lat1 = toRadians(from.ltd);
  const lat2 = toRadians(to.ltd);
  const deltaLat = toRadians(to.ltd - from.ltd);
  const deltaLng = toRadians(to.lng - from.lng);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
};

const getApproximateRoute = (originCoordinates, destinationCoordinates) => {
  // Road routes are usually longer than straight-line distance.
  const roadMultiplier = 1.35;
  const averageSpeedMetersPerSecond = 48_000 / 3600;
  const distance = Math.max(
    1000,
    calculateHaversineDistance(originCoordinates, destinationCoordinates) * roadMultiplier
  );
  const duration = distance / averageSpeedMetersPerSecond;

  return {
    distance: {
      text: formatDistance(distance),
      value: Math.round(distance),
    },
    duration: {
      text: formatDuration(duration),
      value: Math.round(duration),
    },
    originCoordinates,
    destinationCoordinates,
    route: [
      [originCoordinates.ltd, originCoordinates.lng],
      [destinationCoordinates.ltd, destinationCoordinates.lng],
    ],
    provider: "approximate-free-fallback",
    approximate: true,
  };
};

const getNominatimResult = async (address) => {
  const response = await http.get(`${NOMINATIM_URL}/search`, {
    params: {
      q: address,
      format: "jsonv2",
      addressdetails: 1,
      limit: 1,
      countrycodes: MAP_COUNTRY_CODES,
      bounded: 1,
      viewbox: NORTH_AMERICA_BBOX,
    },
  });

  const result = response.data?.[0];
  if (!result) return null;

  return {
    ltd: Number(result.lat),
    lng: Number(result.lon),
    displayName: result.display_name,
    provider: "nominatim",
  };
};

const getPhotonResult = async (address) => {
  const response = await http.get(`${PHOTON_URL}/api/`, {
    params: {
      q: address,
      limit: 1,
      lang: "en",
      bbox: NORTH_AMERICA_BBOX,
    },
  });

  const feature = response.data?.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) return null;

  const props = feature.properties || {};
  const displayName = [props.name, props.city, props.state, props.country]
    .filter(Boolean)
    .join(", ");

  return {
    ltd: Number(coordinates[1]),
    lng: Number(coordinates[0]),
    displayName: displayName || address,
    provider: "photon",
  };
};

const getFirstAddressResult = async (address) => {
  const cleanAddress = String(address || "").trim();
  if (!cleanAddress) {
    throw new Error("Address is required");
  }

  const knownPlaceResult = getKnownPlaceResult(cleanAddress);
  if (knownPlaceResult) return knownPlaceResult;

  const errors = [];

  try {
    const nominatimResult = await getNominatimResult(cleanAddress);
    if (nominatimResult) return nominatimResult;
  } catch (error) {
    errors.push(`Nominatim: ${error.message}`);
  }

  try {
    const photonResult = await getPhotonResult(cleanAddress);
    if (photonResult) return photonResult;
  } catch (error) {
    errors.push(`Photon: ${error.message}`);
  }

  throw new Error(
    `No location found for "${cleanAddress}". Please choose a more specific address from the suggestions. ${errors.join(" | ")}`
  );
};

module.exports.getAddressCoordinate = async (address) => {
  return getFirstAddressResult(address);
};

module.exports.getDistanceTime = async (origin, destination) => {
  if (!origin || !destination) {
    throw new Error("Origin and destination are required");
  }

  const [originCoordinates, destinationCoordinates] = await Promise.all([
    getFirstAddressResult(origin),
    getFirstAddressResult(destination),
  ]);

  const coordinates = `${originCoordinates.lng},${originCoordinates.ltd};${destinationCoordinates.lng},${destinationCoordinates.ltd}`;

  try {
    const response = await http.get(`${OSRM_URL}/route/v1/driving/${coordinates}`, {
      params: {
        overview: "full",
        geometries: "geojson",
        alternatives: false,
        steps: false,
      },
    });

    const route = response.data?.routes?.[0];
    if (!route) {
      throw new Error(response.data?.message || "No OSRM route found");
    }

    const routeCoordinates = (route.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]);

    return {
      distance: {
        text: formatDistance(route.distance),
        value: Math.round(route.distance),
      },
      duration: {
        text: formatDuration(route.duration),
        value: Math.round(route.duration),
      },
      originCoordinates,
      destinationCoordinates,
      route: routeCoordinates,
      provider: "openstreetmap-osrm",
      approximate: false,
    };
  } catch (err) {
    console.warn("OSRM route failed, using approximate distance fallback:", err.message);
    return getApproximateRoute(originCoordinates, destinationCoordinates);
  }
};

module.exports.getAutoCompleteSuggestions = async (input) => {
  const cleanInput = String(input || "").trim();
  if (!cleanInput) {
    throw new Error("query is required");
  }

  try {
    const response = await http.get(`${NOMINATIM_URL}/search`, {
      params: {
        q: cleanInput,
        format: "jsonv2",
        addressdetails: 1,
        limit: 6,
        countrycodes: MAP_COUNTRY_CODES,
        bounded: 1,
        viewbox: NORTH_AMERICA_BBOX,
      },
    });

    const nominatimSuggestions = (response.data || [])
      .map((place) => place.display_name)
      .filter(Boolean);

    if (nominatimSuggestions.length) {
      return [...new Set(nominatimSuggestions)];
    }
  } catch (err) {
    console.warn("Nominatim suggestions failed, trying Photon:", err.message);
  }

  try {
    const response = await http.get(`${PHOTON_URL}/api/`, {
      params: { q: cleanInput, limit: 6, lang: "en", bbox: NORTH_AMERICA_BBOX },
    });

    return [...new Set((response.data?.features || []).map((feature) => {
      const props = feature.properties || {};
      return [props.name, props.city, props.state, props.country].filter(Boolean).join(", ");
    }).filter(Boolean))];
  } catch (err) {
    console.warn("Photon suggestions failed:", err.message);
    return [];
  }
};

module.exports.getCaptainsInTheRadius = async (ltd, lng, radius, vehicleType) => {
  try {
    const captains = await captainModel.find({
      location: {
        $geoWithin: {
          $centerSphere: [[lng, ltd], radius / 6371],
        },
      },
      "vehicle.type": vehicleType,
      isApproved: true,
      status: "active",
      availabilityStatus: "online_available",
      isOnline: true,
    });
    return captains;
  } catch (error) {
    throw new Error("Error in getting captain in radius: " + error.message);
  }
};
