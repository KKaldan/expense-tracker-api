const express = require("express");
const router = express.Router();

const authenticate = require("../../middleware/auth.middleware");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validate");
const expensesController = require("./expenses.controller");
const { createExpenseSchema, updateExpenseSchema } = require("./expenses.schema");

router.post("/",    authenticate, validate(createExpenseSchema),            asyncHandler(expensesController.createExpense));
router.get("/",     authenticate,                                            asyncHandler(expensesController.getExpenses));
router.get("/:id",  authenticate,                                             asyncHandler(expensesController.getExpense));
router.patch("/:id", authenticate, validate(updateExpenseSchema),            asyncHandler(expensesController.updateExpense));
router.delete("/:id", authenticate,                                           asyncHandler(expensesController.deleteExpense));

module.exports = router;
