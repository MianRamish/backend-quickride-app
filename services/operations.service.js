const AppConfig = require("../models/appConfig.model");

let cache = null;
let cacheAt = 0;
const CACHE_MS = 15000;

async function getConfig({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cacheAt < CACHE_MS) return cache;
  cache = await AppConfig.getOperations();
  cacheAt = Date.now();
  return cache;
}

function invalidateConfig() {
  cache = null;
  cacheAt = 0;
}

module.exports = { getConfig, invalidateConfig };
