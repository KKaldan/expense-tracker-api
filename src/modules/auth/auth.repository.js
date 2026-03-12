const db = require("../../config/db");

async function createUser({ email, name, password }) {
  const result = await db.query(
    `
    INSERT INTO users (email, name, password)
    VALUES ($1, $2, $3)
    RETURNING id, email, name, created_at
    `,
    [email, name, password]
  );

  return result.rows[0];
}

async function findUserByEmail(email) {
  const result = await db.query(
    `SELECT * FROM users WHERE email = $1`,
    [email]
  );

  return result.rows[0];
}

module.exports = {
  createUser,
  findUserByEmail
};