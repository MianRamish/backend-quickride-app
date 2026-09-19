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
const MAP_COUNTRY_CODE_SET = new Set(MAP_COUNTRY_CODES.split(",").filter(Boolean));

const NIGERIA_BBOX = process.env.MAP_SEARCH_BBOX || "2.4,4.2,14.7,13.9";
const bboxParts = NIGERIA_BBOX.split(",").map(Number);
const SERVICE_AREA_NAME = String(process.env.SERVICE_AREA_NAME || "Nigeria").trim() || "Nigeria";
const SERVICE_AREA_BOUNDS = bboxParts.length === 4 && bboxParts.every(Number.isFinite)
  ? { west: bboxParts[0], south: bboxParts[1], east: bboxParts[2], north: bboxParts[3] }
  : { west: 2.4, south: 4.2, east: 14.7, north: 13.9 };
const NOMINATIM_VIEWBOX = bboxParts.length === 4 && bboxParts.every(Number.isFinite)
  ? `${bboxParts[0]},${bboxParts[3]},${bboxParts[2]},${bboxParts[1]}`
  : "2.4,13.9,14.7,4.2";
const GEOCODING_TIMEOUT_MS = Number(process.env.GEOCODING_TIMEOUT_MS || 5000);
const SUGGESTION_TIMEOUT_MS = Number(process.env.SUGGESTION_TIMEOUT_MS || 3000);
const suggestionCache = new Map();
const SUGGESTION_CACHE_TTL = 5 * 60 * 1000;
const resolvedPlaceCache = new Map();
const RESOLVED_PLACE_CACHE_TTL = 30 * 60 * 1000;
const providerDisabledUntil = { nominatim: 0, photon: 0 };

const normalizeText = (value = "") =>
  String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeCoordinatePair = (value) => {
  if (!value) return null;
  const ltd = Number(value.ltd ?? value.lat ?? value.latitude);
  const lng = Number(value.lng ?? value.lon ?? value.longitude);
  if (!Number.isFinite(ltd) || !Number.isFinite(lng)) return null;
  if (ltd < -90 || ltd > 90 || lng < -180 || lng > 180) return null;
  return { ltd, lng, provider: value.provider || "provided-coordinates" };
};

const isWithinServiceArea = (value) => {
  const coordinates = normalizeCoordinatePair(value);
  if (!coordinates) return false;
  return coordinates.lng >= SERVICE_AREA_BOUNDS.west
    && coordinates.lng <= SERVICE_AREA_BOUNDS.east
    && coordinates.ltd >= SERVICE_AREA_BOUNDS.south
    && coordinates.ltd <= SERVICE_AREA_BOUNDS.north;
};

const assertWithinServiceArea = (value, label = "location") => {
  if (isWithinServiceArea(value)) return;
  const error = new Error(
    `QuickRide is not currently available at this ${label} location. Service is currently limited to ${SERVICE_AREA_NAME}.`
  );
  error.code = "OUTSIDE_SERVICE_AREA";
  error.statusCode = 422;
  throw error;
};

const parseCoordinateAddress = (value) => {
  const text = String(value || "");
  const match = text.match(/(?:current\s+location\s*)?\(?\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)\s*\)?/i);
  if (!match) return null;
  return normalizeCoordinatePair({ ltd: Number(match[1]), lng: Number(match[2]), provider: "coordinate-label" });
};

const cacheResolvedPlace = (address, result) => {
  const key = normalizeText(address);
  const coordinates = normalizeCoordinatePair(result);
  if (!key || !coordinates) return;
  resolvedPlaceCache.set(key, {
    createdAt: Date.now(),
    result: { ...coordinates, displayName: result.displayName || address, provider: result.provider || coordinates.provider },
  });
};

const getCachedPlace = (address) => {
  const key = normalizeText(address);
  if (!key) return null;
  const cached = resolvedPlaceCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > RESOLVED_PLACE_CACHE_TTL) {
    resolvedPlaceCache.delete(key);
    return null;
  }
  return cached.result;
};

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

const looksLikeDetailedAddress = (address = "") => {
  const value = normalizeText(address);
  if (!value) return false;
  if (/\b\d{1,5}[a-z]?\b/.test(value)) return true;
  return /\b(street|st|road|rd|avenue|ave|close|crescent|drive|way|lane|junction|estate|compound|layout|boulevard|highway|expressway)\b/.test(value);
};

const getKnownPlaceResult = (address, { allowContained = true } = {}) => {
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

  if (!allowContained) return null;

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

const nearestKnownLandmark = (lat, lon, maxKm = 4) => {
  const landmarkCategories = new Set(["landmark", "airport", "university", "hospital", "mall", "market", "hotel"]);
  const candidates = NIGERIA_PLACES
    .filter((place) => landmarkCategories.has(place.category))
    .map((place) => ({
      place,
      km: calculateHaversineDistance(
        { ltd: Number(lat), lng: Number(lon) },
        { ltd: Number(place.ltd), lng: Number(place.lng) }
      ) / 1000,
    }))
    .filter((item) => Number.isFinite(item.km) && item.km <= maxKm)
    .sort((a, b) => a.km - b.km);
  return candidates[0] || null;
};

const buildReverseGeocodeDetails = (data, lat, lon) => {
  const address = data?.address || {};
  const road = address.road || address.pedestrian || address.footway || address.path || address.residential || "";
  const street = [address.house_number, road].filter(Boolean).join(" ").trim();
  const area =
    address.neighbourhood ||
    address.suburb ||
    address.quarter ||
    address.city_district ||
    address.village ||
    address.town ||
    "";
  const city =
    address.city ||
    address.town ||
    address.municipality ||
    address.county ||
    "";
  const state = address.state || address.state_district || "";
  const postalCode = address.postcode || "";
  const country = address.country || SERVICE_AREA_NAME;

  const providerLandmark =
    data?.name &&
    !["highway", "place", "boundary"].includes(String(data?.category || "").toLowerCase())
      ? String(data.name).trim()
      : "";
  const nearby = nearestKnownLandmark(lat, lon);
  const landmark = providerLandmark || nearby?.place?.name || "";
  const landmarkDistanceKm = providerLandmark ? null : nearby ? Math.round(nearby.km * 10) / 10 : null;

  const parts = [];
  if (street) parts.push(street);
  if (landmark && !normalizeText(street).includes(normalizeText(landmark))) parts.push(`near ${landmark}`);
  if (area && !parts.some((item) => normalizeText(item).includes(normalizeText(area)))) parts.push(area);
  if (city && !parts.some((item) => normalizeText(item).includes(normalizeText(city)))) parts.push(city);
  if (state && !parts.some((item) => normalizeText(item).includes(normalizeText(state)))) parts.push(state);
  if (postalCode) parts.push(postalCode);
  if (country) parts.push(country);

  const formattedAddress = parts.length ? parts.join(", ") : String(data?.display_name || "").trim();
  return {
    formattedAddress,
    street,
    road,
    area,
    city,
    state,
    postalCode,
    country,
    landmark,
    landmarkDistanceKm,
  };
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
    route: [],
    provider: "approximate-free-fallback",
    approximate: true,
    routeUnavailable: true,
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
    const resolved = {
      ltd: Number(result.lat),
      lng: Number(result.lon),
      displayName: result.display_name,
      provider: "nominatim",
    };
    cacheResolvedPlace(address, resolved);
    if (resolved.displayName) cacheResolvedPlace(resolved.displayName, resolved);
    return resolved;
  } catch (error) {
    disableProviderTemporarily("nominatim", error);
    throw error;
  }
};

const buildPhotonDisplayName = (feature) => {
  const props = feature?.properties || {};
  const houseStreet = [props.housenumber, props.street].filter(Boolean).join(" ").trim();
  const primary = String(props.name || "").trim();
  const firstPart =
    houseStreet && primary && normalizeText(primary) !== normalizeText(props.street)
      ? `${primary}, ${houseStreet}`
      : houseStreet || primary || props.street || "";
  const locality =
    props.district ||
    props.locality ||
    props.city ||
    props.county ||
    "";
  const parts = [
    firstPart,
    locality && normalizeText(locality) !== normalizeText(firstPart) ? locality : "",
    props.city && normalizeText(props.city) !== normalizeText(locality) ? props.city : "",
    props.state,
    props.postcode,
    props.country || SERVICE_AREA_NAME,
  ].filter(Boolean);

  return [...new Set(parts.map((part) => String(part).trim()).filter(Boolean))].join(", ");
};

const appendPhotonCommonParams = (params, userLocation = null, limit = 16) => {
  params.append("limit", String(limit));
  params.append("lang", "en");
  params.append("bbox", NIGERIA_BBOX);
  for (const countryCode of MAP_COUNTRY_CODE_SET) params.append("countrycode", countryCode.toUpperCase());
  ["house", "street", "locality", "district", "city", "other"].forEach((layer) => params.append("layer", layer));

  if (userLocation && isWithinServiceArea(userLocation)) {
    params.append("lat", String(userLocation.ltd));
    params.append("lon", String(userLocation.lng));
    params.append("zoom", "14");
    params.append("location_bias_scale", "0.15");
  }
  return params;
};

const buildPhotonSearchParams = (input, userLocation = null, limit = 16) => {
  const params = new URLSearchParams();
  params.append("q", String(input || "").trim());
  return appendPhotonCommonParams(params, userLocation, limit);
};

const parseStructuredStreetQuery = (input = "") => {
  const clean = String(input || "").trim().replace(/,+\s*$/, "");
  if (!clean) return null;

  const houseMatch = clean.match(/^\s*(\d+[a-zA-Z]?(?:[-/]\d+[a-zA-Z]?)?)\s+(.+)$/);
  if (houseMatch) {
    return { housenumber: houseMatch[1], street: houseMatch[2].trim() };
  }

  if (looksLikeDetailedAddress(clean) || /\b(street|road|avenue|close|crescent|drive|lane|way)\b/i.test(clean)) {
    return { street: clean };
  }

  return null;
};

const nearestSearchCity = (userLocation = null) => {
  const point = userLocation && isWithinServiceArea(userLocation)
    ? userLocation
    : { ltd: 6.5244, lng: 3.3792 };

  const city = NIGERIA_PLACES
    .filter((place) => place.category === "city")
    .map((place) => ({
      place,
      distance: calculateHaversineDistance(
        { ltd: Number(point.ltd), lng: Number(point.lng) },
        { ltd: Number(place.ltd), lng: Number(place.lng) }
      ),
    }))
    .filter((item) => Number.isFinite(item.distance))
    .sort((a, b) => a.distance - b.distance)[0];

  return city?.place?.name || "Lagos";
};

const buildPhotonStructuredParams = (input, userLocation = null, limit = 16) => {
  const parsed = parseStructuredStreetQuery(input);
  if (!parsed) return null;
  const params = new URLSearchParams();
  if (parsed.housenumber) params.append("housenumber", parsed.housenumber);
  params.append("street", parsed.street);
  params.append("city", nearestSearchCity(userLocation));
  return appendPhotonCommonParams(params, userLocation, limit);
};

const requestPhotonFeatures = async (endpoint, params, timeout) => {
  const response = await http.get(`${PHOTON_URL}${endpoint}`, { timeout, params });
  return (response.data?.features || []).filter(isPhotonFeatureInServiceArea);
};

const isPhotonFeatureInServiceArea = (feature) => {
  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return false;
  const point = { ltd: Number(coordinates[1]), lng: Number(coordinates[0]) };
  if (!isWithinServiceArea(point)) return false;

  const countryCode = String(feature?.properties?.countrycode || feature?.properties?.countryCode || "").trim().toLowerCase();
  if (countryCode && MAP_COUNTRY_CODE_SET.size && !MAP_COUNTRY_CODE_SET.has(countryCode)) return false;
  return true;
};

const getPhotonResult = async (address, userLocation = null) => {
  if (!isProviderAvailable("photon")) return null;
  try {
    let features = [];
    const structuredParams = buildPhotonStructuredParams(address, userLocation, 12);
    if (structuredParams) {
      features = await requestPhotonFeatures("/structured", structuredParams, GEOCODING_TIMEOUT_MS);
    }
    if (!features.length) {
      features = await requestPhotonFeatures("/api/", buildPhotonSearchParams(address, userLocation, 12), GEOCODING_TIMEOUT_MS);
    }
    if (!features.length) {
      const city = nearestSearchCity(userLocation);
      features = await requestPhotonFeatures(
        "/api/",
        buildPhotonSearchParams(`${address}, ${city}, ${SERVICE_AREA_NAME}`, userLocation, 12),
        GEOCODING_TIMEOUT_MS
      );
    }
    if (!features.length) {
      features = await requestPhotonFeatures(
        "/api/",
        buildPhotonSearchParams(`${address}, ${SERVICE_AREA_NAME}`, userLocation, 12),
        GEOCODING_TIMEOUT_MS
      );
    }

    const feature = features[0];
    const coordinates = feature?.geometry?.coordinates;
    if (!coordinates || coordinates.length < 2) return null;

    const displayName = buildPhotonDisplayName(feature);

    const resolved = {
      ltd: Number(coordinates[1]),
      lng: Number(coordinates[0]),
      displayName: displayName || address,
      provider: "photon",
    };
    cacheResolvedPlace(address, resolved);
    if (resolved.displayName) cacheResolvedPlace(resolved.displayName, resolved);
    return resolved;
  } catch (error) {
    disableProviderTemporarily("photon", error);
    throw error;
  }
};

const isNigeriaSuggestionText = (value = "") =>
  /(^|,|\s)nigeria(?:\s|,|$)/i.test(String(value || "").trim());

const getFirstAddressResult = async (address) => {
  const cleanAddress = String(address || "").trim();
  if (!cleanAddress) throw new Error("Address is required");
  const detailedAddress = looksLikeDetailedAddress(cleanAddress);

  const coordinateResult = parseCoordinateAddress(cleanAddress);
  if (coordinateResult) return { ...coordinateResult, displayName: cleanAddress };

  const cachedPlace = getCachedPlace(cleanAddress);
  if (cachedPlace) return cachedPlace;

  const knownPlaceResult = getKnownPlaceResult(cleanAddress, { allowContained: !detailedAddress });
  if (knownPlaceResult) return knownPlaceResult;

  const localCandidates = getLocalPlaceSuggestions(cleanAddress, 6);
  if (!detailedAddress && localCandidates.length === 1) {
    const uniqueLocalResult = getKnownPlaceResult(localCandidates[0]);
    if (uniqueLocalResult) return uniqueLocalResult;
  }
  if (!detailedAddress && localCandidates.length > 1) {
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

const getPhotonSuggestions = async (input, userLocation = null) => {
  if (!isProviderAvailable("photon")) return [];
  try {
    const featureGroups = [];

    const structuredParams = buildPhotonStructuredParams(input, userLocation, 12);
    if (structuredParams) {
      featureGroups.push(await requestPhotonFeatures("/structured", structuredParams, SUGGESTION_TIMEOUT_MS));
    }

    featureGroups.push(
      await requestPhotonFeatures("/api/", buildPhotonSearchParams(input, userLocation, 18), SUGGESTION_TIMEOUT_MS)
    );

    let currentCount = featureGroups.flat().length;
    if (currentCount < 6) {
      const city = nearestSearchCity(userLocation);
      featureGroups.push(
        await requestPhotonFeatures(
          "/api/",
          buildPhotonSearchParams(`${input}, ${city}, ${SERVICE_AREA_NAME}`, userLocation, 18),
          SUGGESTION_TIMEOUT_MS
        )
      );
      currentCount = featureGroups.flat().length;
    }
    if (currentCount < 6) {
      featureGroups.push(
        await requestPhotonFeatures(
          "/api/",
          buildPhotonSearchParams(`${input}, ${SERVICE_AREA_NAME}`, userLocation, 18),
          SUGGESTION_TIMEOUT_MS
        )
      );
    }

    return featureGroups
      .flat()
      .filter((feature, index, all) => {
        const coordinates = feature?.geometry?.coordinates || [];
        const props = feature?.properties || {};
        const key = [
          props.osm_type,
          props.osm_id,
          props.name,
          props.street,
          props.housenumber,
          coordinates[0],
          coordinates[1],
        ].join("|");
        return all.findIndex((candidate) => {
          const candidateCoords = candidate?.geometry?.coordinates || [];
          const candidateProps = candidate?.properties || {};
          return [
            candidateProps.osm_type,
            candidateProps.osm_id,
            candidateProps.name,
            candidateProps.street,
            candidateProps.housenumber,
            candidateCoords[0],
            candidateCoords[1],
          ].join("|") === key;
        }) === index;
      })
      .map((feature) => {
        const displayName = buildPhotonDisplayName(feature);
        const coordinates = feature?.geometry?.coordinates;
        if (displayName && Array.isArray(coordinates) && coordinates.length >= 2) {
          cacheResolvedPlace(displayName, {
            ltd: Number(coordinates[1]),
            lng: Number(coordinates[0]),
            displayName,
            provider: "photon-suggestion",
          });
        }
        return displayName;
      })
      .filter(Boolean)
      .slice(0, 8);
  } catch (error) {
    disableProviderTemporarily("photon", error);
    console.warn(`Photon suggestions unavailable (${error?.response?.status || error.code || error.message}). Using local Nigeria search.`);
    return [];
  }
};

module.exports.getAddressCoordinate = async (address) => {
  const result = await getFirstAddressResult(address);
  assertWithinServiceArea(result, "selected");
  return result;
};

module.exports.getDistanceTime = async (origin, destination, options = {}) => {
  if (!origin || !destination) throw new Error("Origin and destination are required");

  const suppliedOrigin = normalizeCoordinatePair(options.originCoordinates);
  const suppliedDestination = normalizeCoordinatePair(options.destinationCoordinates);
  const [originCoordinates, destinationCoordinates] = await Promise.all([
    suppliedOrigin ? Promise.resolve({ ...suppliedOrigin, displayName: origin }) : getFirstAddressResult(origin),
    suppliedDestination ? Promise.resolve({ ...suppliedDestination, displayName: destination }) : getFirstAddressResult(destination),
  ]);

  assertWithinServiceArea(originCoordinates, "pickup");
  assertWithinServiceArea(destinationCoordinates, "drop-off");

  const coordinates = `${originCoordinates.lng},${originCoordinates.ltd};${destinationCoordinates.lng},${destinationCoordinates.ltd}`;

  let lastRoutingError = null;
  for (const timeout of [7000, 12000]) {
    try {
      const response = await http.get(`${OSRM_URL}/route/v1/driving/${coordinates}`, {
        timeout,
        params: {
          overview: "full",
          geometries: "geojson",
          alternatives: false,
          steps: false,
          continue_straight: "default",
        },
      });

      const route = response.data?.routes?.[0];
      if (!route) throw new Error(response.data?.message || "No OSRM route found");

      const routeCoordinates = (route.geometry?.coordinates || [])
        .map(([lng, lat]) => [Number(lat), Number(lng)])
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

      if (routeCoordinates.length < 3) {
        throw new Error("Routing provider returned incomplete road geometry");
      }

      return {
        distance: { text: formatDistance(route.distance), value: Math.round(route.distance) },
        duration: { text: formatDuration(route.duration), value: Math.round(route.duration) },
        originCoordinates,
        destinationCoordinates,
        route: routeCoordinates,
        provider: "openstreetmap-osrm",
        approximate: false,
        routeUnavailable: false,
      };
    } catch (err) {
      lastRoutingError = err;
      console.warn(`OSRM route attempt failed after ${timeout}ms:`, err.message);
    }
  }

  console.warn("OSRM route unavailable after retry, using estimate without navigation line:", lastRoutingError?.message);
  return getApproximateRoute(originCoordinates, destinationCoordinates);
};

module.exports.getAutoCompleteSuggestions = async (input, userLocation = null) => {
  const cleanInput = String(input || "").trim();
  if (!cleanInput) throw new Error("query is required");

  const locationKey = userLocation && Number.isFinite(userLocation.ltd) && Number.isFinite(userLocation.lng)
    ? `${userLocation.ltd.toFixed(1)},${userLocation.lng.toFixed(1)}`
    : "default";
  const cacheKey = `${normalizeText(cleanInput)}|${locationKey}`;
  const cached = suggestionCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < SUGGESTION_CACHE_TTL) {
    return (cached.items || []).filter(isNigeriaSuggestionText);
  }

  const localSuggestions = getLocalPlaceSuggestions(cleanInput, 8, userLocation);

  // Search Photon as well as the local index so street, road and house-level
  // OpenStreetMap results are not hidden by a matching city or area.
  const remoteSuggestions = await getPhotonSuggestions(cleanInput, userLocation);

  const detailedQuery = looksLikeDetailedAddress(cleanInput);
  const orderedSuggestions = detailedQuery
    ? [...remoteSuggestions, ...localSuggestions]
    : [...localSuggestions.slice(0, 3), ...remoteSuggestions, ...localSuggestions.slice(3)];

  const items = [...new Set(orderedSuggestions)]
    .filter(isNigeriaSuggestionText)
    .slice(0, 8);
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
  const serviceAvailable = isWithinServiceArea({ ltd: lat, lng: lon });

  if (isProviderAvailable("nominatim")) {
    try {
      const response = await http.get(`${NOMINATIM_URL}/reverse`, {
        timeout: GEOCODING_TIMEOUT_MS,
        params: {
          lat,
          lon,
          format: "jsonv2",
          zoom: 18,
          addressdetails: 1,
          namedetails: 1,
          extratags: 1,
          layer: "address,poi",
          ...(GEOCODING_CONTACT_EMAIL ? { email: GEOCODING_CONTACT_EMAIL } : {}),
        },
      });
      const displayName = response.data?.display_name;
      if (displayName) {
        const details = buildReverseGeocodeDetails(response.data, lat, lon);
        const preferredAddress = details.formattedAddress || displayName;
        const resolved = { ltd: lat, lng: lon, displayName: preferredAddress, provider: "nominatim-reverse" };
        cacheResolvedPlace(preferredAddress, resolved);
        cacheResolvedPlace(displayName, resolved);
        return {
          address: preferredAddress,
          rawAddress: displayName,
          ltd: lat,
          lng: lon,
          source: "nominatim",
          serviceAvailable,
          serviceArea: SERVICE_AREA_NAME,
          ...details,
        };
      }
    } catch (error) {
      disableProviderTemporarily("nominatim", error);
      console.warn(`Reverse geocoding unavailable (${error?.response?.status || error.code || error.message}). Using coordinate fallback.`);
    }
  }

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
    const nearbyLandmark = nearestKnownLandmark(lat, lon);
    const details = {
      formattedAddress: nearest.place.displayName,
      street: "",
      road: "",
      area: nearest.place.category === "area" ? nearest.place.name : "",
      city: nearest.place.category === "city" ? nearest.place.name : "",
      state: "",
      postalCode: "",
      country: SERVICE_AREA_NAME,
      landmark: nearbyLandmark?.place?.name || (["landmark", "airport", "university", "hospital", "mall", "market", "hotel"].includes(nearest.place.category) ? nearest.place.name : ""),
      landmarkDistanceKm: nearbyLandmark ? Math.round(nearbyLandmark.km * 10) / 10 : null,
    };
    cacheResolvedPlace(nearest.place.displayName, { ltd: lat, lng: lon, displayName: nearest.place.displayName, provider: "nigeria-index-reverse" });
    return {
      address: nearest.place.displayName,
      ltd: lat,
      lng: lon,
      source: "nigeria_index",
      serviceAvailable,
      serviceArea: SERVICE_AREA_NAME,
      distanceKm: Math.round(nearest.km * 10) / 10,
      ...details,
    };
  }

  const coordinateLabel = `Current location (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
  cacheResolvedPlace(coordinateLabel, { ltd: lat, lng: lon, displayName: coordinateLabel, provider: "coordinates" });
  return {
    address: coordinateLabel,
    ltd: lat,
    lng: lon,
    source: "coordinates",
    serviceAvailable,
    serviceArea: SERVICE_AREA_NAME,
    formattedAddress: coordinateLabel,
    street: "",
    road: "",
    area: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    landmark: "",
    landmarkDistanceKm: null,
  };
};
