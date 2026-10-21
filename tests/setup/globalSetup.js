// Runs ONCE in a separate process before the entire test suite.
// Drops and rebuilds the test database schema so every run starts clean.

const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env.test") });

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");

module.exports = async function globalSetup() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Drop all tables in reverse dependency order for a clean slate.
  await pool.query(`
    DROP TABLE IF EXISTS budgets          CASCADE;
    DROP TABLE IF EXISTS expenses         CASCADE;
    DROP TABLE IF EXISTS categories       CASCADE;
    DROP TABLE IF EXISTS refresh_tokens   CASCADE;
    DROP TABLE IF EXISTS users            CASCADE;
    DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
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
