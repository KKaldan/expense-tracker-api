const db = require("../../config/db");

async function createExpense({ userId, amount, description, category }) {

  const result = await db.query(
    `
    INSERT INTO expenses (user_id, amount, description, category)
    VALUES ($1, $2, $3, $4)
    RETURNING *
    `,
    [userId, amount, description, category]
  );

  return result.rows[0];
}

async function getExpensesByUser(userId) {

  const result = await db.query(
    `
    SELECT * FROM expenses
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [userId]
  );

  return result.rows;
}

async function deleteExpense(userId, expenseId) {

  await db.query(
    `
    DELETE FROM expenses
    WHERE id = $1 AND user_id = $2
    `,
    [expenseId, userId]
  );

}

module.exports = {
  createExpense,
  getExpensesByUser,
  deleteExpense
};