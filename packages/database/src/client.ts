import "dotenv/config";
import { PrismaClient } from "../generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/telegram_social_uploader?schema=public";

// Mask credentials for startup log
const maskedUrl = connectionString.replace(/:([^:@]+)@/, ":****@");
console.log(`🔌 [Prisma] Initializing resilient DB client with DATABASE_URL: ${maskedUrl}`);

function createPool(): Pool {
  const pool = new Pool({
    connectionString,
    max: 15,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 5000,
  });

  // Handle pool errors to prevent unhandled node crashes
  pool.on("error", (err) => {
    console.error("Unexpected error on idle pg client pool:", err);
  });

  return pool;
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter: new PrismaPg(createPool()) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Resilient query wrapper that automatically catches P1017, socket closed,
 * or connection pool timeout errors, triggers $connect(), and retries.
 */
export async function withPrismaRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err: unknown) {
      attempt++;
      const errMsg = err instanceof Error ? err.message : String(err);
      const isConnectionError =
        errMsg.includes("P1017") ||
        errMsg.includes("Server has closed the connection") ||
        errMsg.includes("ConnectionClosed") ||
        errMsg.includes("closed the connection") ||
        errMsg.includes("Connection terminated") ||
        errMsg.includes("connection timeout") ||
        errMsg.includes("ConnectionTimeout") ||
        errMsg.includes("terminating connection due to administrator command");

      if (isConnectionError && attempt <= retries) {
        console.warn(
          `⚠️ [Prisma] Detected DB connection issue (${errMsg.slice(0, 80)}...) (Attempt ${attempt}/${retries}). Re-establishing connection...`
        );
        try {
          await prisma.$connect();
        } catch {
          // ignore connect error
        }
        await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
      } else {
        throw err;
      }
    }
  }
  return await fn();
}

/**
 * Verifies that Prisma is connected, attempting reconnection if needed.
 */
export async function ensurePrismaConnected(): Promise<void> {
  try {
    await prisma.$connect();
  } catch (err) {
    console.warn("⚠️ [Prisma] Re-connection attempt produced warning:", err);
  }
}

export default prisma;
