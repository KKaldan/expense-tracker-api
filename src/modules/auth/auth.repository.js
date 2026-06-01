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

  return result.rows[0] ?? null;
}

async function findUserById(id) {
  const result = await db.query(
    `SELECT id, email, name, created_at FROM users WHERE id = $1`,
    [id]
  );

  return result.rows[0] ?? null;
}

async function storeRefreshToken(userId, tokenHash, expiresAt) {
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

async function findRefreshToken(tokenHash) {
  const { rows } = await db.query(
    `SELECT id, user_id, revoked, expires_at
     FROM refresh_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );
  return rows[0] ?? null;
}

async function revokeRefreshToken(id) {
  await db.query(
    `UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1`,
    [id]
  );
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  storeRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
};
