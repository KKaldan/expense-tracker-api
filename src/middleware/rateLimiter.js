const rateLimit = require("express-rate-limit");
const env = require("../config/env");

/**
 * Applied to all /auth/* routes. Brute-force and credential-stuffing
 * attempts are the primary threat on these endpoints, so the limit is
 * keyed per-IP rather than per-account.
 *
 * Skipped in the test env — the integration suite exercises /auth/*
 * far more than 10 times/min from a single IP by design.
 */
const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test",
  handler(_req, res) {
    res.status(429).json({
      success: false,
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Too many requests. Please try again later.",
      },
    });
  },
});

module.exports = { authRateLimiter };
