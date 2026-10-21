const expensesRepository = require("./expenses.repository");
const AppError = require("../../utils/AppError");
const { checkBudgetStatus } = require("../budgets/budgets.service");
const { assertCategoryUsable } = require("../categories/categories.service");

async function createExpense(userId, data) {

  await assertCategoryUsable(userId, data.category_id);

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

  await assertCategoryUsable(userId, updates.category_id);

  // The UPDATE filters on owner_id, so null means "doesn't exist or isn't
  // yours" — no separate existence check, and no window for the row to
  // disappear between a check and the write.
  const updated = await expensesRepository.updateExpense(expenseId, userId, updates);

  if (!updated) {
    throw AppError.notFound("Expense not found");
  }

  // RETURNING gives the full post-update row, so unchanged fields are included
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
