const expensesService = require("./expenses.service");

async function createExpense(req, res) {

  const expense = await expensesService.createExpense(
    req.user.userId,
    req.body
  );

  res.status(201).json({
    success: true,
    data: expense
  });
}

async function getExpenses(req, res) {

  const expenses = await expensesService.getExpenses(req.user.userId);

  res.json({
    success: true,
    data: expenses
  });
}

async function deleteExpense(req, res) {

  await expensesService.deleteExpense(
    req.user.userId,
    req.params.id
  );

  res.json({
    success: true
  });
}

module.exports = {
  createExpense,
  getExpenses,
  deleteExpense
};