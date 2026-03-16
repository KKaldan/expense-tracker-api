// Runs ONCE in a separate process before the entire test suite.
// Drops and rebuilds the test database schema so every run starts clean.

const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env.test") });

const MIGRATION_FILES = [
  "001_enable_extensions.sql",
  "002_create_users.sql",
  "003_create_refresh_tokens.sql",
  "004_create_categories.sql",
  "005_create_expenses.sql",
  "006_create_budgets.sql",
];

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

  // Rebuild schema by running all migrations in order.
  const migrationsDir = path.resolve(__dirname, "../../migrations");
  for (const file of MIGRATION_FILES) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    await pool.query(sql);
  }

  await pool.end();
};
