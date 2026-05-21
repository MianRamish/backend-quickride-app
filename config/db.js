const mongoose = require("mongoose");

const ENV = process.env.ENVIRONMENT || "development";

const MONGO_DB = {
  production: {
    url: process.env.MONGODB_PROD_URL,
    type: "Atlas",
  },
  development: {
    url: process.env.MONGODB_DEV_URL,
    type: "Compass",
  },
};

if (!MONGO_DB[ENV] || !MONGO_DB[ENV].url) {
  throw new Error(
    `❌ MongoDB config missing for ENVIRONMENT=${ENV}`
  );
}

mongoose
  .connect(MONGO_DB[ENV].url)
  .then(() => {
    console.log("✅ Connected to Mongo DB:", MONGO_DB[ENV].type);
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err.message);
  });

module.exports = mongoose.connection;
