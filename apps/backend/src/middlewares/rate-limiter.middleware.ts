import rateLimit from "express-rate-limit";

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  validate: false, // Disables express-rate-limit strict validations (resolves TS type & IPv6 warning)
  keyGenerator: (req) => {
    // Strip port numbers from Azure proxy IPs (e.g., '110.38.254.19:57568' -> '110.38.254.19')
    return req.ip?.replace(/:\d+$/, "") || req.socket.remoteAddress || "unknown";
  },
  message: {
    success: false,
    error: "Too many requests from this IP, please try again after 15 minutes.",
  },
});