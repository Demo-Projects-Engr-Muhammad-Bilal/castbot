import cors from "cors";

const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:3000";

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman) or matching allowedOrigin
    if (!origin || origin === allowedOrigin || allowedOrigin === "*") {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-tenant-id", "X-Tenant-Id"],
});
