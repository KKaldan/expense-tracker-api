const categoriesService = require("./categories.service");

async function getCategories(req, res) {
  const categories = await categoriesService.getCategories(req.user.id);

  res.json({
    success: true,
    data: categories,
  });
}

async function createCategory(req, res) {
  const category = await categoriesService.createCategory(req.user.id, req.body);

  res.status(201).json({
    success: true,
    data: category,
  });
}

async function updateCategory(req, res) {
  const category = await categoriesService.updateCategory(
    req.user.id,
    req.params.id,
    req.body
  );

  res.json({
    success: true,
    data: category,
  });
}

async function deleteCategory(req, res) {
  await categoriesService.deleteCategory(req.user.id, req.params.id);

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
