const { Pool } = require("pg");
const { DATABASE_URL } = require("./env");

const pool = new Pool({ connectionString: DATABASE_URL });

// Verify the database is reachable at startup.
// Fails fast with a clear message rather than silently at runtime.
pool.query("SELECT 1").catch((err) => {
  console.error("Database connection failed:", err.message);
  process.exit(1);
});

module.exports = pool;
