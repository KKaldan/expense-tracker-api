const express = require("express");
const router = express.Router();

const authenticate = require("../../middleware/auth.middleware");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validate");
const budgetsController = require("./budgets.controller");
const { createBudgetSchema, updateBudgetSchema } = require("./budgets.schema");

router.get("/",       authenticate,                              asyncHandler(budgetsController.getBudgets));
router.post("/",      authenticate, validate(createBudgetSchema), asyncHandler(budgetsController.createBudget));
router.patch("/:id",  authenticate, validate(updateBudgetSchema), asyncHandler(budgetsController.updateBudget));
router.delete("/:id", authenticate,                              asyncHandler(budgetsController.deleteBudget));

module.exports = router;
