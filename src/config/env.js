require("dotenv").config();

const { z } = require("zod");

const envSchema = z.object({
  NODE_ENV:                  z.string().default("development"),
  PORT:                      z.coerce.number().default(3000),
  DATABASE_URL:              z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET:                z.string().min(1, "JWT_SECRET is required"),
  JWT_EXPIRY:                z.string().default("15m"),
  REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().default(7),
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
