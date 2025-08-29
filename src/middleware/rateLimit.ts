// src/middleware/rateLimit.ts
import rateLimit from "express-rate-limit";
import { logger } from "../utils/logger.js";

const parseEnvInt = (name: string, defaultValue: number): number => {
  const val = process.env[name];    
  return val ? parseInt(val, 10) : defaultValue;
};

const createLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
  routeName: string;
}) =>
  rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: options.message || "Too many requests, please try again later.",
    handler: (req, res, _next, opts) => {
      // Structured logging when user is throttled
      logger.warn("Rate limit exceeded", {
        route: options.routeName,
        ip: req.ip,
        method: req.method,
        path: req.originalUrl,
        userAgent: req.get("User-Agent"),
        limit: opts.max,
        windowMs: opts.windowMs,
      });

      res.status(opts.statusCode).json({
        error: options.message || "Too many requests, please try again later.",
        route: options.routeName,
        retryAfter: res.getHeader("Retry-After"),
      });
    },
  });

// General limiter (defaults to RATE_LIMIT_* if AI/MCP not provided)
export const generalLimiter = createLimiter({
  windowMs: parseEnvInt("GENERAL_WINDOW_MS", parseEnvInt("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000)),
  max: parseEnvInt("GENERAL_RATE_LIMIT", parseEnvInt("RATE_LIMIT_MAX_REQUESTS", 200)),
  routeName: "general",
});

// AI limiter
export const aiLimiter = createLimiter({
  windowMs: parseEnvInt("AI_WINDOW_MS", 60 * 1000),
  max: parseEnvInt("AI_RATE_LIMIT", 20),
  routeName: "ai",
  message: "Too many AI requests. Please wait before retrying.",
});

// MCP limiter
export const mcpLimiter = createLimiter({
  windowMs: parseEnvInt("MCP_WINDOW_MS", 60 * 1000),
  max: parseEnvInt("MCP_RATE_LIMIT", 50),
  routeName: "mcp",
  message: "Too many MCP requests. Slow down.",
});
