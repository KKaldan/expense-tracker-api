// Runs ONCE in a separate process before the entire test suite.
// Drops and rebuilds the test database schema so every run starts clean.

const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env.test") });

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");

module.exports = async function globalSetup() {
  // Guard against wiping a real database if DATABASE_URL is misconfigured.
  const dbName = new URL(process.env.DATABASE_URL).pathname.slice(1);
  if (!dbName.endsWith("_test")) {
    throw new Error(`Refusing to reset "${dbName}" — test database name must end in "_test"`);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Drop and recreate the whole schema for a clean slate. Removes every
  // table, function, and extension regardless of what migrations created,
  // so new migrations never need a matching entry here.
  await pool.query(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
  `);

  // Rebuild schema by running every migration in filename order — same
  // discovery rule as scripts/migrate.js, so new migrations are picked up
  // automatically.
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    await pool.query(sql);
  }

  await pool.end();
};
