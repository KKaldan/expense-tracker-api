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

// Validates and revokes in a single statement so concurrent requests can't
// both consume the same token — Postgres row locking guarantees only one
// UPDATE matches. Returns the owning user_id, or null if the token is
// unknown, already revoked, or expired.
async function consumeRefreshToken(tokenHash) {
  const { rows } = await db.query(
    `UPDATE refresh_tokens
     SET revoked = TRUE
     WHERE token_hash = $1 AND revoked = FALSE AND expires_at > NOW()
     RETURNING user_id`,
    [tokenHash]
  );
  return rows[0]?.user_id ?? null;
}

async function revokeRefreshToken(tokenHash) {
  await db.query(
    `UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`,
    [tokenHash]
  );
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  storeRefreshToken,
  consumeRefreshToken,
  revokeRefreshToken,
};
