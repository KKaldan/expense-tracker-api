const db = require("../../config/db");

async function getBudgetsByUser(userId) {
  const { rows } = await db.query(
    `SELECT id, owner_id, category_id, amount, period, created_at, updated_at
     FROM budgets
     WHERE owner_id = $1
     ORDER BY period ASC, created_at ASC`,
    [userId]
  );
  return rows;
}

async function getBudgetById(budgetId) {
  const { rows } = await db.query(
    `SELECT id, owner_id, category_id, amount, period, created_at, updated_at
     FROM budgets
     WHERE id = $1`,
    [budgetId]
  );
  return rows[0] ?? null;
}

async function createBudget(userId, { amount, period, category_id }) {
  const { rows } = await db.query(
    `INSERT INTO budgets (owner_id, category_id, amount, period)
     VALUES ($1, $2, $3, $4)
     RETURNING id, owner_id, category_id, amount, period, created_at, updated_at`,
    [userId, category_id ?? null, amount, period]
  );
  return rows[0];
}

async function updateBudget(budgetId, updates) {
  const fields = [];
  const values = [];
  let idx = 1;

  if (updates.amount !== undefined)      { fields.push(`amount = $${idx++}`);      values.push(updates.amount); }
  if (updates.period !== undefined)      { fields.push(`period = $${idx++}`);      values.push(updates.period); }
  if (updates.category_id !== undefined) { fields.push(`category_id = $${idx++}`); values.push(updates.category_id); }

  values.push(budgetId);

  const { rows } = await db.query(
    `UPDATE budgets
     SET ${fields.join(", ")}
     WHERE id = $${idx}
     RETURNING id, owner_id, category_id, amount, period, created_at, updated_at`,
    values
  );
  return rows[0] ?? null;
}

async function deleteBudget(budgetId) {
  const { rows } = await db.query(
    `DELETE FROM budgets WHERE id = $1 RETURNING id`,
    [budgetId]
  );
  return rows[0] ?? null;
}

/**
 * Finds the most specific budget that applies to an expense:
 * category-specific budget takes priority over a global budget.
 * Returns null if no budget covers this user/category/period combination.
 */
async function findApplicableBudget(userId, categoryId, period) {
  const { rows } = await db.query(
    `SELECT id, amount, period, category_id
     FROM budgets
     WHERE owner_id = $1
       AND period = $2
       AND (category_id = $3 OR category_id IS NULL)
     ORDER BY category_id NULLS LAST
     LIMIT 1`,
    [userId, period, categoryId ?? null]
  );
  return rows[0] ?? null;
}

/**
 * Returns the total amount spent by a user within a given date range,
 * optionally scoped to a specific category (for category budgets)
 * or across all categories (for global budgets).
 */
async function sumExpensesForPeriod(userId, { from, to, categoryId, isGlobal }) {
  const params = [userId, from, to];
  const categoryClause = isGlobal ? "" : `AND category_id = $${params.push(categoryId)}`;

  const { rows } = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM expenses
     WHERE owner_id = $1
       AND date >= $2
       AND date <= $3
       ${categoryClause}`,
    params
  );
  return parseFloat(rows[0].total);
}

module.exports = {
  getBudgetsByUser,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget,
  findApplicableBudget,
  sumExpensesForPeriod,
};
