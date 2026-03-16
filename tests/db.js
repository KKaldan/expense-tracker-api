// Exposes the app's database pool to test files for cleanup operations.
// The pool connects to the test DB because loadTestEnv.js sets DATABASE_URL
// before env.js is ever imported.

const db = require("../src/config/db");

/**
 * Truncates all user data tables between tests.
 * Cascades to refresh_tokens, expenses, user-owned categories, and budgets.
 * System categories (owner_id = NULL) are unaffected.
 */
async function truncateTables() {
  await db.query("TRUNCATE TABLE users CASCADE");
}

module.exports = { db, truncateTables };
