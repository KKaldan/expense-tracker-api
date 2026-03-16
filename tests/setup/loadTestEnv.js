const path = require("path");

// Load .env.test before any module (including env.js) is imported.
// Because dotenv doesn't override already-set env vars, these values
// take precedence over anything in .env.
require("dotenv").config({ path: path.resolve(__dirname, "../../.env.test") });
