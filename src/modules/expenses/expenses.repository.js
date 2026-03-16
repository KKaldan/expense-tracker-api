const db = require("../../config/db");

async function createExpense({ userId, amount, currency, description, categoryId, date }) {

  const result = await db.query(
    `
    INSERT INTO expenses (owner_id, amount, currency, description, category_id, date)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [userId, amount, currency ?? 'GBP', description, categoryId ?? null, date]
  );

  return result.rows[0];
}

async function getExpensesByUser(userId) {

  const result = await db.query(
    `
    SELECT * FROM expenses
    WHERE owner_id = $1
    ORDER BY date DESC, created_at DESC
    `,
    [userId]
  );

  return result.rows;
}

async function deleteExpense(userId, expenseId) {

  await db.query(
    `
    DELETE FROM expenses
    WHERE id = $1 AND owner_id = $2
    `,
    [expenseId, userId]
  );

}

module.exports = {
  createExpense,
  getExpensesByUser,
  deleteExpense
};
