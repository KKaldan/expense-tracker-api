const expensesRepository = require("./expenses.repository");
const AppError = require("../../utils/AppError");

async function createExpense(userId, data) {

  return await expensesRepository.createExpense({ userId, ...data });

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

  // Verify the expense exists and is owned by this user before attempting update
  const existing = await expensesRepository.getExpenseById(expenseId, userId);

  if (!existing) {
    throw AppError.notFound("Expense not found");
  }

  const updated = await expensesRepository.updateExpense(expenseId, userId, updates);

  return updated;
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
