const express = require("express");
const router = express.Router();

const authenticate = require("../../middleware/auth.middleware");
const expensesController = require("./expenses.controller");
const asyncHandler = require("../../utils/asyncHandler");

router.post("/", authenticate, asyncHandler(expensesController.createExpense));
router.get("/", authenticate, asyncHandler(expensesController.getExpenses));
router.delete("/:id", authenticate, asyncHandler(expensesController.deleteExpense));

module.exports = router;