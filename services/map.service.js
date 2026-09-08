const axios = require("axios");
const captainModel = require("../models/captain.model");
<<<<<<< HEAD
const NIGERIA_PLACES = require("../data/nigeria.places");
=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc

const NOMINATIM_URL = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const PHOTON_URL = process.env.PHOTON_URL || "https://photon.komoot.io";
const OSRM_URL = process.env.OSRM_URL || "https://router.project-osrm.org";
<<<<<<< HEAD
const APP_USER_AGENT = process.env.GEOCODING_USER_AGENT || "QuickRideNigeria/1.1";
const GEOCODING_CONTACT_EMAIL = String(process.env.GEOCODING_CONTACT_EMAIL || "").trim();
const MAP_COUNTRY_CODES = (process.env.MAP_COUNTRY_CODES || "ng")
=======
const APP_USER_AGENT = process.env.GEOCODING_USER_AGENT || "QuickRide/1.0 (support@quickride.local)";
const MAP_COUNTRY_CODES = (process.env.MAP_COUNTRY_CODES || "ca,us")
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
  .split(",")
  .map((code) => code.trim().toLowerCase())
  .filter(Boolean)
  .join(",");

<<<<<<< HEAD
const NIGERIA_BBOX = process.env.MAP_SEARCH_BBOX || "2.4,4.2,14.7,13.9";
const bboxParts = NIGERIA_BBOX.split(",").map(Number);
const NOMINATIM_VIEWBOX = bboxParts.length === 4 && bboxParts.every(Number.isFinite)
  ? `${bboxParts[0]},${bboxParts[3]},${bboxParts[2]},${bboxParts[1]}`
  : "2.4,13.9,14.7,4.2";
const GEOCODING_TIMEOUT_MS = Number(process.env.GEOCODING_TIMEOUT_MS || 5000);
const SUGGESTION_TIMEOUT_MS = Number(process.env.SUGGESTION_TIMEOUT_MS || 3000);
const suggestionCache = new Map();
const SUGGESTION_CACHE_TTL = 5 * 60 * 1000;
const providerDisabledUntil = { nominatim: 0, photon: 0 };

const normalizeText = (value = "") =>
  String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const placeSearchText = (place) =>
  normalizeText([place.name, place.displayName, place.category, ...(place.aliases || [])].join(" "));

const scoreLocalPlace = (place, query, userLocation = null) => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return -1;

  const name = normalizeText(place.name);
  const displayName = normalizeText(place.displayName);
  const aliases = (place.aliases || []).map(normalizeText);
  const haystack = placeSearchText(place);
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  let marketBoost = displayName.includes("lagos") ? 14 : displayName.includes("abuja") ? 6 : 0;
  if (userLocation && Number.isFinite(userLocation.ltd) && Number.isFinite(userLocation.lng)) {
    const latDelta = place.ltd - userLocation.ltd;
    const lngDelta = place.lng - userLocation.lng;
    const roughDistanceKm = Math.sqrt(latDelta * latDelta + lngDelta * lngDelta) * 111;
    marketBoost = roughDistanceKm <= 30 ? 30 : roughDistanceKm <= 80 ? 22 : roughDistanceKm <= 200 ? 12 : roughDistanceKm <= 450 ? 5 : 0;
  }

  if (name === normalizedQuery || displayName === normalizedQuery || aliases.includes(normalizedQuery)) return 120 + marketBoost;
  if (name.startsWith(normalizedQuery)) return 100 + marketBoost;
  if (aliases.some((alias) => alias.startsWith(normalizedQuery))) return 92 + marketBoost;
  if (name.includes(normalizedQuery)) return 84 + marketBoost;
  if (aliases.some((alias) => alias.includes(normalizedQuery))) return 78 + marketBoost;
  if (!tokens.every((token) => haystack.includes(token))) return -1;

  let score = 55 + tokens.length * 4 + marketBoost;
  if (place.category === "city") score += 5;
  if (place.category === "university" && normalizedQuery.includes("univers")) score += 10;
  if (place.category === "airport" && normalizedQuery.includes("airport")) score += 10;
  return score;
};

const getLocalPlaceSuggestions = (input, limit = 6, userLocation = null) => {
  const normalizedInput = normalizeText(input);
  if (normalizedInput === "nigeria" || normalizedInput === "ng") {
    const featuredCities = ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Kano", "Enugu"];
    return featuredCities
      .map((name) => NIGERIA_PLACES.find((place) => place.name === name)?.displayName)
      .filter(Boolean)
      .slice(0, limit);
  }

  return NIGERIA_PLACES
    .map((place) => ({ place, score: scoreLocalPlace(place, input, userLocation) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score || a.place.displayName.localeCompare(b.place.displayName))
    .slice(0, limit)
    .map(({ place }) => place.displayName);
};

const getKnownPlaceResult = (address) => {
  const key = normalizeText(address);
  if (!key) return null;

  const matches = NIGERIA_PLACES.filter((place) => {
    const name = normalizeText(place.name);
    const displayName = normalizeText(place.displayName);
    const aliases = (place.aliases || []).map(normalizeText);
    return name === key || displayName === key || aliases.includes(key);
  });

  if (matches.length === 1) {
    const place = matches[0];
    return {
      ltd: place.ltd,
      lng: place.lng,
      displayName: place.displayName,
      provider: "nigeria-local-index",
    };
  }

  // A full suggestion string normally contains a distinctive place name.
  const contained = NIGERIA_PLACES
    .filter((place) => {
      const name = normalizeText(place.name);
      return name.length >= 5 && key.includes(name);
    })
    .sort((a, b) => b.name.length - a.name.length);

  if (contained.length) {
    const place = contained[0];
    return {
      ltd: place.ltd,
      lng: place.lng,
      displayName: place.displayName,
      provider: "nigeria-local-index",
    };
  }

  return null;
};

const http = axios.create({
  headers: {
    "User-Agent": APP_USER_AGENT,
    "Accept-Language": "en-NG,en;q=0.9",
    Accept: "application/json",
  },
});

const isProviderAvailable = (provider) => Date.now() >= (providerDisabledUntil[provider] || 0);

const disableProviderTemporarily = (provider, error) => {
  const status = error?.response?.status;
  const isBlocked = status === 403 || status === 429;
  const isTimeout = error?.code === "ECONNABORTED" || String(error?.message || "").toLowerCase().includes("timeout");
  const delay = isBlocked ? 10 * 60 * 1000 : isTimeout ? 60 * 1000 : 30 * 1000;
  providerDisabledUntil[provider] = Date.now() + delay;
};

const formatDistance = (meters = 0) => {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
=======
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
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
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
<<<<<<< HEAD
=======
  // Road routes are usually longer than straight-line distance.
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
  const roadMultiplier = 1.35;
  const averageSpeedMetersPerSecond = 48_000 / 3600;
  const distance = Math.max(
    1000,
    calculateHaversineDistance(originCoordinates, destinationCoordinates) * roadMultiplier
  );
  const duration = distance / averageSpeedMetersPerSecond;

  return {
<<<<<<< HEAD
    distance: { text: formatDistance(distance), value: Math.round(distance) },
    duration: { text: formatDuration(duration), value: Math.round(duration) },
=======
    distance: {
      text: formatDistance(distance),
      value: Math.round(distance),
    },
    duration: {
      text: formatDuration(duration),
      value: Math.round(duration),
    },
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
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
<<<<<<< HEAD
  if (!isProviderAvailable("nominatim")) return null;
  try {
    const response = await http.get(`${NOMINATIM_URL}/search`, {
      timeout: GEOCODING_TIMEOUT_MS,
      params: {
        q: address,
        format: "jsonv2",
        addressdetails: 1,
        limit: 1,
        countrycodes: MAP_COUNTRY_CODES,
        bounded: 1,
        viewbox: NOMINATIM_VIEWBOX,
        ...(GEOCODING_CONTACT_EMAIL ? { email: GEOCODING_CONTACT_EMAIL } : {}),
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
  } catch (error) {
    disableProviderTemporarily("nominatim", error);
    throw error;
  }
};

const getPhotonResult = async (address) => {
  if (!isProviderAvailable("photon")) return null;
  try {
    const response = await http.get(`${PHOTON_URL}/api/`, {
      timeout: GEOCODING_TIMEOUT_MS,
      params: { q: address, limit: 1, lang: "en", bbox: NIGERIA_BBOX },
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
  } catch (error) {
    disableProviderTemporarily("photon", error);
    throw error;
  }
=======
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
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
};

const getFirstAddressResult = async (address) => {
  const cleanAddress = String(address || "").trim();
<<<<<<< HEAD
  if (!cleanAddress) throw new Error("Address is required");
=======
  if (!cleanAddress) {
    throw new Error("Address is required");
  }
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc

  const knownPlaceResult = getKnownPlaceResult(cleanAddress);
  if (knownPlaceResult) return knownPlaceResult;

<<<<<<< HEAD
  const localCandidates = getLocalPlaceSuggestions(cleanAddress, 6);
  if (localCandidates.length === 1) {
    const uniqueLocalResult = getKnownPlaceResult(localCandidates[0]);
    if (uniqueLocalResult) return uniqueLocalResult;
  }
  if (localCandidates.length > 1) {
    const error = new Error(`"${cleanAddress}" is too broad. Please select a specific location from the suggestions.`);
    error.code = "AMBIGUOUS_LOCATION";
    throw error;
  }

  const errors = [];
=======
  const errors = [];

>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
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
<<<<<<< HEAD
    `No location found for "${cleanAddress}". Select one of the suggested Nigerian locations or enter a more specific address.${errors.length ? ` (${errors.join(" | ")})` : ""}`
  );
};

const getPhotonSuggestions = async (input) => {
  if (!isProviderAvailable("photon")) return [];
  try {
    const response = await http.get(`${PHOTON_URL}/api/`, {
      timeout: SUGGESTION_TIMEOUT_MS,
      params: { q: input, limit: 6, lang: "en", bbox: NIGERIA_BBOX },
    });
    return (response.data?.features || [])
      .map((feature) => {
        const props = feature.properties || {};
        return [props.name, props.city, props.state, props.country].filter(Boolean).join(", ");
      })
      .filter(Boolean);
  } catch (error) {
    disableProviderTemporarily("photon", error);
    console.warn(`Photon suggestions unavailable (${error?.response?.status || error.code || error.message}). Using local Nigeria search.`);
    return [];
  }
};

module.exports.getAddressCoordinate = async (address) => getFirstAddressResult(address);

module.exports.getDistanceTime = async (origin, destination) => {
  if (!origin || !destination) throw new Error("Origin and destination are required");
=======
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
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc

  const [originCoordinates, destinationCoordinates] = await Promise.all([
    getFirstAddressResult(origin),
    getFirstAddressResult(destination),
  ]);

  const coordinates = `${originCoordinates.lng},${originCoordinates.ltd};${destinationCoordinates.lng},${destinationCoordinates.ltd}`;

  try {
    const response = await http.get(`${OSRM_URL}/route/v1/driving/${coordinates}`, {
<<<<<<< HEAD
      timeout: 7000,
      params: { overview: "full", geometries: "geojson", alternatives: false, steps: false },
    });

    const route = response.data?.routes?.[0];
    if (!route) throw new Error(response.data?.message || "No OSRM route found");

    const routeCoordinates = (route.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]);
    return {
      distance: { text: formatDistance(route.distance), value: Math.round(route.distance) },
      duration: { text: formatDuration(route.duration), value: Math.round(route.duration) },
=======
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
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
      originCoordinates,
      destinationCoordinates,
      route: routeCoordinates,
      provider: "openstreetmap-osrm",
      approximate: false,
    };
  } catch (err) {
<<<<<<< HEAD
    console.warn("OSRM route unavailable, using approximate route:", err.message);
=======
    console.warn("OSRM route failed, using approximate distance fallback:", err.message);
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
    return getApproximateRoute(originCoordinates, destinationCoordinates);
  }
};

<<<<<<< HEAD
module.exports.getAutoCompleteSuggestions = async (input, userLocation = null) => {
  const cleanInput = String(input || "").trim();
  if (!cleanInput) throw new Error("query is required");

  const locationKey = userLocation && Number.isFinite(userLocation.ltd) && Number.isFinite(userLocation.lng)
    ? `${userLocation.ltd.toFixed(1)},${userLocation.lng.toFixed(1)}`
    : "default";
  const cacheKey = `${normalizeText(cleanInput)}|${locationKey}`;
  const cached = suggestionCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < SUGGESTION_CACHE_TTL) return cached.items;

  const localSuggestions = getLocalPlaceSuggestions(cleanInput, 8, userLocation);

  // Known Nigerian places should feel instant and must not depend on public providers.
  if (localSuggestions.length > 0) {
    const items = localSuggestions.slice(0, 6);
    suggestionCache.set(cacheKey, { createdAt: Date.now(), items });
    return items;
  }

  // Public Nominatim is used only for one-off geocoding, not type-ahead autocomplete.
  // Unknown autocomplete queries fall back to Photon; production can replace this provider later.
  const remoteSuggestions = await getPhotonSuggestions(cleanInput);

  const items = [...new Set([...localSuggestions, ...remoteSuggestions])].slice(0, 6);
  suggestionCache.set(cacheKey, { createdAt: Date.now(), items });
  return items;
=======
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
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
};

module.exports.getCaptainsInTheRadius = async (ltd, lng, radius, vehicleType) => {
  try {
<<<<<<< HEAD
    return await captainModel.find({
=======
    const captains = await captainModel.find({
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
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
<<<<<<< HEAD
      socketId: { $ne: null },
    });
=======
    });
    return captains;
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
  } catch (error) {
    throw new Error("Error in getting captain in radius: " + error.message);
  }
};
<<<<<<< HEAD

module.exports.reverseGeocode = async (ltd, lng) => {
  const lat = Number(ltd);
  const lon = Number(lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("Valid coordinates are required");
  const toRad = (n) => (n * Math.PI) / 180;
  const distanceKm = (aLat, aLng, bLat, bLng) => {
    const r = 6371;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };
  const nearest = NIGERIA_PLACES
    .map((place) => ({ place, km: distanceKm(lat, lon, Number(place.ltd), Number(place.lng)) }))
    .sort((a, b) => a.km - b.km)[0];
  if (nearest && nearest.km <= 8) {
    return { address: nearest.place.displayName, ltd: lat, lng: lon, source: "nigeria_index", distanceKm: Math.round(nearest.km * 10) / 10 };
  }
  return { address: `Current location (${lat.toFixed(5)}, ${lon.toFixed(5)}), Nigeria`, ltd: lat, lng: lon, source: "coordinates" };
};
=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
