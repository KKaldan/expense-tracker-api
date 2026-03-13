const express = require("express");
const router = express.Router();

const authenticate = require("../../middleware/auth.middleware");
const expensesController = require("./expenses.controller");

router.post("/", authenticate, expensesController.createExpense);
router.get("/", authenticate, expensesController.getExpenses);
router.delete("/:id", authenticate, expensesController.deleteExpense);

module.exports = router;