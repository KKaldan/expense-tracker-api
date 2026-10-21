const db = require("../../config/db");

/**
 * Returns all categories visible to a user:
 * system defaults (owner_id IS NULL) + their own custom categories.
 */
async function getCategoriesByUser(userId) {
  const { rows } = await db.query(
    `SELECT id, owner_id, name, icon, color, created_at, updated_at
     FROM categories
     WHERE owner_id IS NULL OR owner_id = $1
     ORDER BY owner_id NULLS FIRST, name ASC`,
    [userId]
  );
  return rows;
}

async function getCategoryById(categoryId) {
  const { rows } = await db.query(
    `SELECT id, owner_id, name, icon, color, created_at, updated_at
     FROM categories
     WHERE id = $1`,
    [categoryId]
  );
  return rows[0] ?? null;
}

async function createCategory(userId, { name, icon, color }) {
  const { rows } = await db.query(
    `INSERT INTO categories (owner_id, name, icon, color)
     VALUES ($1, $2, $3, $4)
     RETURNING id, owner_id, name, icon, color, created_at, updated_at`,
    [userId, name, icon ?? null, color ?? null]
  );
  return rows[0];
}

// Only matches the user's own categories — `owner_id = $n` never matches a
// system category (owner_id IS NULL). Returns null if nothing matched.
async function updateCategory(categoryId, userId, updates) {
  const fields = [];
  const values = [];
  let idx = 1;

  if (updates.name !== undefined)  { fields.push(`name = $${idx++}`);  values.push(updates.name); }
  if (updates.icon !== undefined)  { fields.push(`icon = $${idx++}`);  values.push(updates.icon); }
  if (updates.color !== undefined) { fields.push(`color = $${idx++}`); values.push(updates.color); }

  values.push(categoryId, userId);

  const { rows } = await db.query(
    `UPDATE categories
     SET ${fields.join(", ")}
     WHERE id = $${idx} AND owner_id = $${idx + 1}
     RETURNING id, owner_id, name, icon, color, created_at, updated_at`,
    values
  );
  return rows[0] ?? null;
}

async function deleteCategory(categoryId, userId) {
  const { rows } = await db.query(
    `DELETE FROM categories WHERE id = $1 AND owner_id = $2 RETURNING id`,
    [categoryId, userId]
  );
  return rows[0] ?? null;
}

module.exports = {
  getCategoriesByUser,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
