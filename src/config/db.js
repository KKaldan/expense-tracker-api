const pg = require("pg");
const { DATABASE_URL } = require("./env");

// Return DATE columns as "YYYY-MM-DD" strings instead of JavaScript Date objects.
// Without this, pg converts DATE to a Date object which JSON.stringify serialises
// as a full ISO timestamp (e.g. "2026-03-15T00:00:00.000Z").
pg.types.setTypeParser(1082, (val) => val);

const pool = new pg.Pool({ connectionString: DATABASE_URL });

// An idle client can error (e.g. the DB restarts). Without a listener, pg
// emits an unhandled 'error' event and the whole process crashes. The pool
// discards the broken client and opens a fresh one on the next query.
pool.on("error", (err) => {
  console.error("Idle database client error:", err.message);
});

// Verify the database is reachable at startup.
// Fails fast with a clear message rather than silently at runtime.
pool.query("SELECT 1").catch((err) => {
  console.error("Database connection failed:", err.message);
  process.exit(1);
});

module.exports = pool;
