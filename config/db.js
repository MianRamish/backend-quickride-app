const mongoose = require("mongoose");

let connectionPromise = null;

function getMongoUri() {
  return (
    process.env.MONGODB_URI ||
    (process.env.ENVIRONMENT === "production"
      ? process.env.MONGODB_PROD_URL
      : process.env.MONGODB_DEV_URL)
  );
}

async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;

  const uri = getMongoUri();
  if (!uri) {
    throw new Error(
      "MongoDB connection string is missing. Set MONGODB_URI (recommended for MongoDB Atlas)."
    );
  }

  connectionPromise = mongoose.connect(uri, {
    maxPoolSize: Math.max(5, Number(process.env.MONGODB_MAX_POOL_SIZE || 20)),
    minPoolSize: Math.max(0, Number(process.env.MONGODB_MIN_POOL_SIZE || 0)),
    maxIdleTimeMS: Number(process.env.MONGODB_MAX_IDLE_TIME_MS || 30000),
    serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 10000),
    socketTimeoutMS: Number(process.env.MONGODB_SOCKET_TIMEOUT_MS || 45000),
    autoIndex: process.env.MONGODB_AUTO_INDEX !== "false",
  });

  try {
    await connectionPromise;
    console.log(`MongoDB connected: ${mongoose.connection.name}`);
    return mongoose.connection;
  } catch (error) {
    connectionPromise = null;
    throw error;
  }
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  connectionPromise = null;
}

module.exports = { connectDB, disconnectDB, getMongoUri, connection: mongoose.connection };
