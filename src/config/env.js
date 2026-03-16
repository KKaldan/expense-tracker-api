require("dotenv").config();

const REQUIRED = ["DATABASE_URL", "JWT_SECRET"];

for (const key of REQUIRED) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT, 10) || 3000,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRY: process.env.JWT_EXPIRY || "15m",
  REFRESH_TOKEN_EXPIRY_DAYS: parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS, 10) || 7,
  COOKIE_SECRET: process.env.COOKIE_SECRET || null,
};
