const categoriesRepository = require("./categories.repository");
const AppError = require("../../utils/AppError");

async function getCategories(userId) {
  return categoriesRepository.getCategoriesByUser(userId);
}

async function createCategory(userId, data) {
  return categoriesRepository.createCategory(userId, data);
}

/**
 * Called when an owner-filtered write matched nothing, to pick the right
 * error. System categories (owner_id === null) are read-only for everyone
 * → 403. Missing and other users' categories get the same 404, so IDs
 * can't be probed.
 */
async function throwUnwritableCategory(categoryId, systemMessage) {
  const category = await categoriesRepository.getCategoryById(categoryId);

  if (category && category.owner_id === null) {
    throw AppError.forbidden(systemMessage);
  }

  throw AppError.notFound("Category not found");
}

async function updateCategory(userId, categoryId, updates) {
  // The write itself enforces ownership; the lookup only runs on failure.
  const updated = await categoriesRepository.updateCategory(categoryId, userId, updates);

  if (!updated) {
    await throwUnwritableCategory(categoryId, "System categories cannot be modified");
  }

  return updated;
}

async function deleteCategory(userId, categoryId) {
  const deleted = await categoriesRepository.deleteCategory(categoryId, userId);

  if (!deleted) {
    await throwUnwritableCategory(categoryId, "System categories cannot be deleted");
  }
}

/**
 * Guards any write that references a category (expenses, budgets).
 * Allows system categories and the user's own; rejects everything else
 * with 422. Nonexistent and other users' categories get the same error so
 * the response can't be used to probe for other users' category IDs.
 * A null/undefined categoryId is allowed — the record is uncategorised.
 */
async function assertCategoryUsable(userId, categoryId) {
  if (categoryId === undefined || categoryId === null) return;

  const category = await categoriesRepository.getCategoryById(categoryId);

  if (!category || (category.owner_id !== null && category.owner_id !== userId)) {
    throw AppError.unprocessable("Category not found", "INVALID_CATEGORY");
  }
}

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  assertCategoryUsable,
};
