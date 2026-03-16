const categoriesService = require("./categories.service");

async function getCategories(req, res) {
  const categories = await categoriesService.getCategories(req.user.userId);

  res.json({
    success: true,
    data: categories,
  });
}

async function createCategory(req, res) {
  const category = await categoriesService.createCategory(req.user.userId, req.body);

  res.status(201).json({
    success: true,
    data: category,
  });
}

async function updateCategory(req, res) {
  const category = await categoriesService.updateCategory(
    req.user.userId,
    req.params.id,
    req.body
  );

  res.json({
    success: true,
    data: category,
  });
}

async function deleteCategory(req, res) {
  await categoriesService.deleteCategory(req.user.userId, req.params.id);

  res.json({
    success: true,
  });
}

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
