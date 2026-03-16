const db = require("../../config/db");

// Allowlisted columns and directions for ORDER BY — prevents SQL injection
// since column names cannot be parameterised in pg.
const ALLOWED_SORT_COLUMNS = new Set(["date", "amount", "created_at"]);
const ALLOWED_SORT_DIRECTIONS = new Set(["asc", "desc"]);

/**
 * Parses a sort string like "date:desc,amount:asc" into a safe SQL ORDER BY clause.
 * Any unrecognised column or direction is silently dropped.
 * Falls back to the default ordering if nothing valid remains.
 */
function buildOrderBy(sort) {
  if (!sort) return "date DESC, created_at DESC";

  const parts = sort
    .split(",")
    .map((part) => {
      const [col, dir = "asc"] = part.trim().split(":");
      if (!ALLOWED_SORT_COLUMNS.has(col)) return null;
      if (!ALLOWED_SORT_DIRECTIONS.has(dir.toLowerCase())) return null;
      return `${col} ${dir.toUpperCase()}`;
    })
    .filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "date DESC, created_at DESC";
}

async function createExpense({ userId, amount, currency, description, category_id, date }) {

  const result = await db.query(
    `
    INSERT INTO expenses (owner_id, amount, currency, description, category_id, date)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [userId, amount, currency ?? "GBP", description ?? null, category_id ?? null, date]
  );

  return result.rows[0];
}

async function getExpenseById(expenseId, userId) {

  const result = await db.query(
    `
    SELECT * FROM expenses
    WHERE id = $1 AND owner_id = $2
    `,
    [expenseId, userId]
  );

  return result.rows[0] ?? null;
}

async function getExpensesByUser(userId, { page, limit, from, to, category_id, sort }) {

  const params = [userId];
  const conditions = ["owner_id = $1"];

  if (from) {
    params.push(from);
    conditions.push(`date >= $${params.length}`);
  }

  if (to) {
    params.push(to);
    conditions.push(`date <= $${params.length}`);
  }

  if (category_id) {
    params.push(category_id);
    conditions.push(`category_id = $${params.length}`);
  }

  const whereClause = conditions.join(" AND ");
  const orderBy = buildOrderBy(sort);

  // Total count uses the same WHERE clause but no LIMIT/OFFSET
  const countResult = await db.query(
    `SELECT COUNT(*) FROM expenses WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const offset = (page - 1) * limit;
  params.push(limit, offset);

  const result = await db.query(
    `
    SELECT * FROM expenses
    WHERE ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params
  );

  return { expenses: result.rows, total };
}

async function updateExpense(expenseId, userId, updates) {

  const ALLOWED_FIELDS = ["amount", "currency", "description", "category_id", "date"];
  const fields = [];
  const params = [];

  for (const field of ALLOWED_FIELDS) {
    if (updates[field] !== undefined) {
      params.push(updates[field]);
      fields.push(`${field} = $${params.length}`);
    }
  }

  if (fields.length === 0) return null;

  params.push(expenseId, userId);

  const result = await db.query(
    `
    UPDATE expenses
    SET ${fields.join(", ")}
    WHERE id = $${params.length - 1} AND owner_id = $${params.length}
    RETURNING *
    `,
    params
  );

  return result.rows[0] ?? null;
}

async function deleteExpense(userId, expenseId) {

  const result = await db.query(
    `
    DELETE FROM expenses
    WHERE id = $1 AND owner_id = $2
    RETURNING id
    `,
    [expenseId, userId]
  );

  return result.rows[0] ?? null;
}

module.exports = {
  createExpense,
  getExpenseById,
  getExpensesByUser,
  updateExpense,
  deleteExpense,
};
