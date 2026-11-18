import "dotenv/config";
import mongoose from "mongoose";
import dns from "dns";

// Only configure custom DNS resolvers on Windows to avoid breaking Linux/Vercel serverless containers
if (process.platform === "win32") {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4", "9.9.9.9"]);
  } catch (e) {}
}

const LOCAL_FALLBACK_URI = "mongodb://127.0.0.1:27017/krishimitra";
const isCloudOrProd = Boolean(process.env.VERCEL || process.env.NODE_ENV === "production");

const PRIMARY_URI = process.env.MONGODB_URI || (isCloudOrProd ? "" : LOCAL_FALLBACK_URI);
const SEEDLIST_URI = process.env.MONGODB_SEEDLIST_URI || "";

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (mongoose.connection.readyState === 2 && cached.promise) {
    await cached.promise;
    return mongoose.connection;
  }

  // If no MongoDB URI is set and we are in production / on Vercel, fail fast without 12-second hang
  if (!PRIMARY_URI) {
    console.warn("⚠️ [MONGODB]: MONGODB_URI is not configured in environment variables. Falling back to in-memory mode.");
    throw new Error("MONGODB_URI_NOT_CONFIGURED");
  }

  cached.promise = null;
  cached.conn = null;

  const opts = {
    serverSelectionTimeoutMS: 2500,
    bufferCommands: false,
  };

  // Step 1: Attempt Primary SRV Atlas Connection
  try {
    if (process.platform === "win32") {
      try {
        dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
      } catch (e) {}
    }

    console.log("⚡ [MONGODB INITIALIZING ATLAS CLOUD CONNECTION]...");
    cached.promise = mongoose.connect(PRIMARY_URI, opts);
    cached.conn = await cached.promise;
    console.log("✅ [MONGODB CONNECTED TO ATLAS CLOUD SUCCESSFULLY]");
    return cached.conn;
  } catch (err1: any) {
    console.warn("⚠️ [ATLAS SRV CONNECTION FAILED / DNS ECONNREFUSED]:", err1.message);
    cached.promise = null;

    // Step 2: Attempt Seedlist Direct Atlas Connection if configured
    if (SEEDLIST_URI) {
      try {
        console.log("⚡ [MONGODB RETRYING WITH ATLAS SEEDLIST FORMAT]...");
        cached.promise = mongoose.connect(SEEDLIST_URI, opts);
        cached.conn = await cached.promise;
        console.log("✅ [MONGODB CONNECTED TO ATLAS SEEDLIST SUCCESSFULLY]");
        return cached.conn;
      } catch (err2: any) {
        console.warn("⚠️ [ATLAS SEEDLIST CONNECTION FAILED]:", err2.message);
        cached.promise = null;
      }
    }

    // Step 3: Only attempt local fallback if running locally (not in production / Vercel)
    if (!isCloudOrProd) {
      try {
        console.log("⚡ [MONGODB FALLBACK TO LOCAL INSTANCE]...");
        cached.promise = mongoose.connect(LOCAL_FALLBACK_URI, opts);
        cached.conn = await cached.promise;
        console.log("✅ [MONGODB CONNECTED TO LOCAL INSTANCE SUCCESSFULLY]");
        return cached.conn;
      } catch (err3: any) {
        console.error("❌ [MONGODB LOCAL INSTANCE UNREACHABLE]:", err3.message);
      }
    }

    cached.promise = null;
    cached.conn = null;
    throw new Error(`MongoDB connection failed: ${err1.message}`);
  }
}

export const db = {} as any;
