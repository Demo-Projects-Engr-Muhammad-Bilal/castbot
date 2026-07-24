import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import Redis, { RedisOptions } from "ioredis";

// Explicitly load .env files from workspace and root
const envPaths = [
  path.resolve(__dirname, "../../.env"),
  path.resolve(process.cwd(), "apps/backend/.env"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../../../.env"),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }
}

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.warn("⚠️ [Redis] REDIS_URL environment variable is missing! Falling back to localhost.");
}

const targetUrl = redisUrl || "redis://localhost:6379";
const isTls = targetUrl.startsWith("rediss://");
const sanitizedUrl = targetUrl.replace(/:[^:@]+@/, ":****@");

console.log(`🔌 Initializing Redis Client (TLS: ${isTls}) with URL: ${sanitizedUrl}`);

const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  connectTimeout: 20000,
  keepAlive: 10000,
  ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
};

export const redis = new Redis(targetUrl, redisOptions);
export const redisConnection = redis;

redis.on("connect", () => {
  console.log("✅ [Redis] Connection established successfully!");
});

redis.on("ready", () => {
  console.log("🚀 [Redis] Client ready to receive commands.");
});

redis.on("error", (err: Error) => {
  if (err.message && err.message.includes("max requests limit exceeded")) {
    console.error("⛔ [Redis Quota Exceeded] Upstash free tier limit reached (50,000/500,000 requests). Please upgrade Upstash Redis or switch REDIS_URL to an unlimited Redis instance.");
  } else {
    console.error("❌ [Redis] Connection error:", err.message);
  }
});
