const budgetsRepository = require("./budgets.repository");
const AppError = require("../../utils/AppError");

async function getBudgets(userId) {
  return budgetsRepository.getBudgetsByUser(userId);
}

async function createBudget(userId, data) {
  return budgetsRepository.createBudget(userId, data);
}

async function updateBudget(userId, budgetId, updates) {
  const budget = await budgetsRepository.getBudgetById(budgetId);

  if (!budget) {
    throw AppError.notFound("Budget not found");
  }

  if (budget.owner_id !== userId) {
    throw AppError.notFound("Budget not found");
  }

  return budgetsRepository.updateBudget(budgetId, updates);
}

async function deleteBudget(userId, budgetId) {
  const budget = await budgetsRepository.getBudgetById(budgetId);

  if (!budget) {
    throw AppError.notFound("Budget not found");
  }

  if (budget.owner_id !== userId) {
    throw AppError.notFound("Budget not found");
  }

  await budgetsRepository.deleteBudget(budgetId);
}

module.exports = {
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
};
