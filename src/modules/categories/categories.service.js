const categoriesRepository = require("./categories.repository");
const AppError = require("../../utils/AppError");

async function getCategories(userId) {
  return categoriesRepository.getCategoriesByUser(userId);
}

async function createCategory(userId, data) {
  return categoriesRepository.createCategory(userId, data);
}

async function updateCategory(userId, categoryId, updates) {
  const category = await categoriesRepository.getCategoryById(categoryId);

  if (!category) {
    throw AppError.notFound("Category not found");
  }

  // System categories (owner_id === null) are read-only for everyone
  if (category.owner_id === null) {
    throw AppError.forbidden("System categories cannot be modified");
  }

  if (category.owner_id !== userId) {
    throw AppError.notFound("Category not found");
  }

  return categoriesRepository.updateCategory(categoryId, updates);
}

async function deleteCategory(userId, categoryId) {
  const category = await categoriesRepository.getCategoryById(categoryId);

  if (!category) {
    throw AppError.notFound("Category not found");
  }

  if (category.owner_id === null) {
    throw AppError.forbidden("System categories cannot be deleted");
  }

  if (category.owner_id !== userId) {
    throw AppError.notFound("Category not found");
  }

  await categoriesRepository.deleteCategory(categoryId);
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
