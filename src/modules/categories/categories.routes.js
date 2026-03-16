const express = require("express");
const router = express.Router();

const authenticate = require("../../middleware/auth.middleware");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validate");
const categoriesController = require("./categories.controller");
const { createCategorySchema, updateCategorySchema } = require("./categories.schema");

router.get("/",      authenticate,                               asyncHandler(categoriesController.getCategories));
router.post("/",     authenticate, validate(createCategorySchema), asyncHandler(categoriesController.createCategory));
router.patch("/:id", authenticate, validate(updateCategorySchema), asyncHandler(categoriesController.updateCategory));
router.delete("/:id", authenticate,                              asyncHandler(categoriesController.deleteCategory));

module.exports = router;
