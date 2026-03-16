const expensesService = require("./expenses.service");

async function createExpense(req, res) {

  const expense = await expensesService.createExpense(req.user.userId, req.body);

  res.status(201).json({
    success: true,
    data: expense,
  });
}

async function getExpense(req, res) {

  const expense = await expensesService.getExpenseById(req.user.userId, req.params.id);

  res.json({
    success: true,
    data: expense,
  });
}

async function getExpenses(req, res) {

  const { expenses, meta } = await expensesService.getExpenses(req.user.userId, req.query);

  res.json({
    success: true,
    data: expenses,
    meta,
  });
}

async function updateExpense(req, res) {

  const expense = await expensesService.updateExpense(
    req.user.userId,
    req.params.id,
    req.body
  );

  res.json({
    success: true,
    data: expense,
  });
}

async function deleteExpense(req, res) {

  await expensesService.deleteExpense(req.user.userId, req.params.id);

  res.json({
    success: true,
  });
}

module.exports = {
  createExpense,
  getExpense,
  getExpenses,
  updateExpense,
  deleteExpense,
};
