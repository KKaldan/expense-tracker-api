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

/**
 * Checks whether an expense triggers a budget warning or breach.
 *
 * Looks for the most specific applicable budget (category-specific first,
 * then global). Calculates total spend for the budget's period window and
 * returns a status string:
 *   'none'     — no budget covers this expense
 *   'ok'       — under 80% of the budget
 *   'warning'  — between 80% and 100% of the budget
 *   'exceeded' — over 100% of the budget
 *
 * @param {string} userId
 * @param {{ category_id?: string|null, date: string }} expenseData
 * @returns {Promise<'none'|'ok'|'warning'|'exceeded'>}
 */
async function checkBudgetStatus(userId, { category_id, date }) {
  const expenseDate = new Date(date);
  const year = expenseDate.getUTCFullYear();
  const month = expenseDate.getUTCMonth(); // 0-indexed

  const SEVERITY = { exceeded: 3, warning: 2, ok: 1, none: 0 };
  let worstStatus = "none";

  for (const period of ["monthly", "yearly"]) {
    const budget = await budgetsRepository.findApplicableBudget(userId, category_id ?? null, period);
    if (!budget) continue;

    let from, to;
    if (period === "monthly") {
      from = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
      to   = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
    } else {
      from = `${year}-01-01`;
      to   = `${year}-12-31`;
    }

    const spent = await budgetsRepository.sumExpensesForPeriod(userId, {
      from,
      to,
      categoryId: category_id ?? null,
      isGlobal: budget.category_id === null,
    });

    const ratio = spent / parseFloat(budget.amount);
    const status = ratio > 1 ? "exceeded" : ratio >= 0.8 ? "warning" : "ok";

    if (SEVERITY[status] > SEVERITY[worstStatus]) {
      worstStatus = status;
    }
  }

  return worstStatus;
}

module.exports = {
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  checkBudgetStatus,
};
