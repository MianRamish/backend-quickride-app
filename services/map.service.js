const axios = require("axios");
const captainModel = require("../models/captain.model");
const NIGERIA_PLACES = require("../data/nigeria.places");

const NOMINATIM_URL = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const PHOTON_URL = process.env.PHOTON_URL || "https://photon.komoot.io";
const OSRM_URL = process.env.OSRM_URL || "https://router.project-osrm.org";
const APP_USER_AGENT = process.env.GEOCODING_USER_AGENT || "QuickRideNigeria/1.1";
const GEOCODING_CONTACT_EMAIL = String(process.env.GEOCODING_CONTACT_EMAIL || "").trim();
const MAP_COUNTRY_CODES = (process.env.MAP_COUNTRY_CODES || "ng")
  .split(",")
  .map((code) => code.trim().toLowerCase())
  .filter(Boolean)
  .join(",");

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
  const roadMultiplier = 1.35;
  const averageSpeedMetersPerSecond = 48_000 / 3600;
  const distance = Math.max(
    1000,
    calculateHaversineDistance(originCoordinates, destinationCoordinates) * roadMultiplier
  );
  const duration = distance / averageSpeedMetersPerSecond;

  return {
    distance: { text: formatDistance(distance), value: Math.round(distance) },
    duration: { text: formatDuration(duration), value: Math.round(duration) },
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
};

const getFirstAddressResult = async (address) => {
  const cleanAddress = String(address || "").trim();
  if (!cleanAddress) throw new Error("Address is required");

  const knownPlaceResult = getKnownPlaceResult(cleanAddress);
  if (knownPlaceResult) return knownPlaceResult;

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

  const [originCoordinates, destinationCoordinates] = await Promise.all([
    getFirstAddressResult(origin),
    getFirstAddressResult(destination),
  ]);

  const coordinates = `${originCoordinates.lng},${originCoordinates.ltd};${destinationCoordinates.lng},${destinationCoordinates.ltd}`;

  try {
    const response = await http.get(`${OSRM_URL}/route/v1/driving/${coordinates}`, {
      timeout: 7000,
      params: { overview: "full", geometries: "geojson", alternatives: false, steps: false },
    });

    const route = response.data?.routes?.[0];
    if (!route) throw new Error(response.data?.message || "No OSRM route found");

    const routeCoordinates = (route.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]);
    return {
      distance: { text: formatDistance(route.distance), value: Math.round(route.distance) },
      duration: { text: formatDuration(route.duration), value: Math.round(route.duration) },
      originCoordinates,
      destinationCoordinates,
      route: routeCoordinates,
      provider: "openstreetmap-osrm",
      approximate: false,
    };
  } catch (err) {
    console.warn("OSRM route unavailable, using approximate route:", err.message);
    return getApproximateRoute(originCoordinates, destinationCoordinates);
  }
};

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
};

module.exports.getCaptainsInTheRadius = async (ltd, lng, radius, vehicleType) => {
  try {
    return await captainModel.find({
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
      socketId: { $ne: null },
    });
  } catch (error) {
    throw new Error("Error in getting captain in radius: " + error.message);
  }
};

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
