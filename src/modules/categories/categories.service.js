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
    throw AppError.forbidden("You do not own this category");
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
    throw AppError.forbidden("You do not own this category");
  }

  await categoriesRepository.deleteCategory(categoryId);
}

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
