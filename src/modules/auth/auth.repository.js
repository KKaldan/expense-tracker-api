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

async function storeRefreshToken(userId, familyId, tokenHash, expiresAt) {
  await db.query(
    `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, familyId, tokenHash, expiresAt]
  );
}

// Consumes the old token and inserts its successor (same family) in ONE
// statement. Two guarantees depend on that:
//   1. Postgres row locking lets only one concurrent UPDATE match, so a
//      token can't be consumed twice.
//   2. The successor is committed at the same instant the old token is
//      revoked. A losing concurrent request blocks on the row lock until
//      then, so when it goes on to revoke the family (reuse detection) it
//      is guaranteed to see — and revoke — the successor too.
// Do not split this into separate queries. Returns the owning user_id, or
// null if the old token is unknown, already revoked, or expired.
async function rotateRefreshToken(oldTokenHash, newTokenHash, expiresAt) {
  const { rows } = await db.query(
    `WITH consumed AS (
       UPDATE refresh_tokens
       SET revoked = TRUE
       WHERE token_hash = $1 AND revoked = FALSE AND expires_at > NOW()
       RETURNING user_id, family_id
     )
     INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
     SELECT user_id, family_id, $2, $3 FROM consumed
     RETURNING user_id`,
    [oldTokenHash, newTokenHash, expiresAt]
  );
  return rows[0]?.user_id ?? null;
}

// Called when rotation fails. If the presented token was already revoked
// but hasn't expired, it has been used before — someone holds a copy.
// Revokes every live token in its family and returns the user_id, or null
// if nothing was revoked (unknown/expired token, or family already dead,
// e.g. after logout).
async function revokeFamilyOfReplayedToken(tokenHash) {
  const { rows } = await db.query(
    `UPDATE refresh_tokens
     SET revoked = TRUE
     WHERE revoked = FALSE
       AND family_id IN (
         SELECT family_id FROM refresh_tokens
         WHERE token_hash = $1 AND revoked = TRUE AND expires_at > NOW()
       )
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

async function deleteExpiredRefreshTokens(userId) {
  await db.query(
    `DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at <= NOW()`,
    [userId]
  );
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  storeRefreshToken,
  rotateRefreshToken,
  revokeFamilyOfReplayedToken,
  revokeRefreshToken,
  deleteExpiredRefreshTokens,
};
