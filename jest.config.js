const path = require("path");

// Load test environment variables before anything else runs.
// override: true ensures test vars win over any vars already in process.env,
// including anything dotenv or the OS may have set from .env.
require("dotenv").config({
  path: path.resolve(__dirname, ".env.test"),
  override: true,
});

module.exports = {
  testEnvironment: "node",

  // Run migrations once before the entire test suite.
  globalSetup: "./tests/setup/globalSetup.js",

  // Only pick up files inside tests/integration/
  testMatch: ["**/tests/integration/**/*.test.js"],

  // Kill the process after tests finish — prevents Jest hanging on open DB connections.
  forceExit: true,

  // Give async tests (DB queries, bcrypt) plenty of time.
  testTimeout: 15000,
};
