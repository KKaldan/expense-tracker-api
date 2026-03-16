const expensesRepository = require("./expenses.repository");
const AppError = require("../../utils/AppError");
const { checkBudgetStatus } = require("../budgets/budgets.service");

async function createExpense(userId, data) {

  const expense = await expensesRepository.createExpense({ userId, ...data });

  const budget_status = await checkBudgetStatus(userId, {
    category_id: expense.category_id,
    date: expense.date,
  });

  return { ...expense, budget_status };
}

async function getExpenseById(userId, expenseId) {

  const expense = await expensesRepository.getExpenseById(expenseId, userId);

  if (!expense) {
    throw AppError.notFound("Expense not found");
  }

  return expense;
}

async function getExpenses(userId, filters) {

  const { expenses, total } = await expensesRepository.getExpensesByUser(userId, filters);

  const totalPages = Math.ceil(total / filters.limit);

  return {
    expenses,
    meta: {
      page: filters.page,
      limit: filters.limit,
      total,
      total_pages: totalPages,
    },
  };
}

async function updateExpense(userId, expenseId, updates) {

  const existing = await expensesRepository.getExpenseById(expenseId, userId);

  if (!existing) {
    throw AppError.notFound("Expense not found");
  }

  const updated = await expensesRepository.updateExpense(expenseId, userId, updates);

  // Use updated values where provided, fall back to existing values for unchanged fields
  const budget_status = await checkBudgetStatus(userId, {
    category_id: updated.category_id,
    date: updated.date,
  });

  return { ...updated, budget_status };
}

async function deleteExpense(userId, expenseId) {

  const deleted = await expensesRepository.deleteExpense(userId, expenseId);

  if (!deleted) {
    throw AppError.notFound("Expense not found");
  }

}

module.exports = {
  createExpense,
  getExpenseById,
  getExpenses,
  updateExpense,
  deleteExpense,
};
