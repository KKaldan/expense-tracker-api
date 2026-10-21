require("dotenv").config();

const { z } = require("zod");

const envSchema = z.object({
  NODE_ENV:                  z.string().default("development"),
  PORT:                      z.coerce.number().default(3000),
  DATABASE_URL:              z.string().min(1, "DATABASE_URL is required"),
  // HS256 is only as strong as its key — 32+ chars, and never the .env.example placeholder.
  JWT_SECRET: z.string()
    .min(32, "JWT_SECRET must be at least 32 characters (e.g. openssl rand -hex 32)")
    .refine((val) => val !== "replace-with-256-bit-random-secret", "JWT_SECRET is still the .env.example placeholder"),
  JWT_EXPIRY:                z.string().default("15m"),
  REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().default(7),
  // Number of reverse proxies in front of the app (0 = none). Lets req.ip —
  // and so the rate limiter — see the real client IP via X-Forwarded-For.
  // Must match the real topology: too high lets clients spoof their IP.
  TRUST_PROXY:               z.coerce.number().int().min(0).default(0),
  CORS_ORIGIN: z.string()
    .default("http://localhost:3000")
    .transform((val) => val.split(",").map((origin) => origin.trim())),
});

let parsed;
try {
  parsed = envSchema.parse(process.env);
} catch (err) {
  console.error("Invalid environment configuration:");
  err.issues.forEach((issue) => console.error(` - ${issue.path.join(".")}: ${issue.message}`));
  process.exit(1);
}

module.exports = parsed;
