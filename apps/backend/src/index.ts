import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { corsMiddleware } from "./middlewares/cors.middleware";
import { apiRateLimiter } from "./middlewares/rate-limiter.middleware";
import { authMiddleware } from "./middlewares/auth.middleware";
import { errorHandlerMiddleware } from "./middlewares/error-handler.middleware";
import { prisma } from "./lib/prisma";
import "./workers/publish.worker";

import accountsRoutes from "./routes/accounts.routes";
import authRoutes from "./routes/auth.routes";
import publishRoutes from "./routes/publish.routes";
import scheduledRoutes from "./routes/scheduled.routes";
import telegramRoutes from "./routes/telegram.routes";
import workspaceRoutes from "./routes/workspace.routes";
import stripeRoutes from "./routes/stripe.routes";
import metricsRoutes from "./routes/metrics.routes";

const app = express();

// Trust Azure App Service reverse proxy for accurate client IP identification
app.set("trust proxy", 1);

const PORT = process.env.PORT || 5000;

// Request Logging Middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  const origin = req.headers.origin || "Direct/Browser";
  console.log(`[${timestamp}] 📡 ${req.method} ${req.originalUrl} (Origin: ${origin})`);
  next();
});

// Security Middlewares
app.use(corsMiddleware);

// Raw middleware specifically for Stripe Webhooks BEFORE express.json()
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

// Global JSON body parser (MUST be mounted before routes that consume JSON req.body)
app.use(express.json());

// API Rate Limiter
app.use("/api/", apiRateLimiter);

// Health Check Endpoint
app.get("/api/health", async (_req: Request, res: Response) => {
  let dbStatus = "disconnected";
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "connected";
  } catch (err) {
    dbStatus = "error";
    console.error("❌ Health check DB query error:", err);
  }

  res.status(200).json({
    status: "ok",
    service: "CastBot Express Daemon",
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// Register Backend Domain Routes
app.use("/api/stripe", stripeRoutes);
app.use("/api/accounts", authMiddleware, accountsRoutes);
app.use("/api/auth", authRoutes); // Auth OAuth initiation & callbacks handle redirection
app.use("/api/publish", authMiddleware, publishRoutes);
app.use("/api/scheduled", authMiddleware, scheduledRoutes);
app.use("/api/telegram", telegramRoutes);
app.use("/api/workspaces", authMiddleware, workspaceRoutes);
app.use("/api/metrics", metricsRoutes);

// Centralized Error Handling Middleware — MUST be the last app.use() call.
app.use(errorHandlerMiddleware);

app.listen(PORT, async () => {
  console.log(`🚀 CastBot Express Backend Server running on port ${PORT}`);
  try {
    await prisma.$connect();
    console.log("✅ [Database] Prisma successfully connected to PostgreSQL instance.");
  } catch (dbErr) {
    console.error("❌ [Database] Connection verification failed during server boot:", dbErr);
  }
});

export default app;