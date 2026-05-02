import rateLimit from "express-rate-limit";

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path === "/api/health";
  },
});

// Strict rate limiter for authentication
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  skipSuccessfulRequests: true,
  message: { error: "Too many login attempts, please try again later" },
});

// Rate limiter for API with external calls (Gemini)
export const geminiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15, // 15 calls per minute
  message: { error: "API rate limit exceeded" },
});
