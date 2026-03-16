const express = require("express");
const router = express.Router();

const authenticate = require("../../middleware/auth.middleware");
const expensesController = require("./expenses.controller");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validate");
const { createExpenseSchema } = require("./expenses.schema");

router.post("/", authenticate, validate(createExpenseSchema), asyncHandler(expensesController.createExpense));
router.get("/", authenticate, asyncHandler(expensesController.getExpenses));
router.delete("/:id", authenticate, asyncHandler(expensesController.deleteExpense));

module.exports = router;