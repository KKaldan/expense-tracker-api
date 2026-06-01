const expensesService = require("./expenses.service");
const { listExpensesQuerySchema } = require("./expenses.schema");

async function createExpense(req, res) {

  const expense = await expensesService.createExpense(req.user.id, req.body);

  res.status(201).json({
    success: true,
    data: expense,
  });
}

async function getExpense(req, res) {

  const expense = await expensesService.getExpenseById(req.user.id, req.params.id);

  res.json({
    success: true,
    data: expense,
  });
}

async function getExpenses(req, res) {

  const filters = listExpensesQuerySchema.parse(req.query);
  const { expenses, meta } = await expensesService.getExpenses(req.user.id, filters);

  res.json({
    success: true,
    data: expenses,
    meta,
  });
}

async function updateExpense(req, res) {

  const expense = await expensesService.updateExpense(
    req.user.id,
    req.params.id,
    req.body
  );

  res.json({
    success: true,
    data: expense,
  });
}

async function deleteExpense(req, res) {

  await expensesService.deleteExpense(req.user.id, req.params.id);

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
