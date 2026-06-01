const budgetsService = require("./budgets.service");

async function getBudgets(req, res) {
  const budgets = await budgetsService.getBudgets(req.user.id);

  res.json({
    success: true,
    data: budgets,
  });
}

async function createBudget(req, res) {
  const budget = await budgetsService.createBudget(req.user.id, req.body);

  res.status(201).json({
    success: true,
    data: budget,
  });
}

async function updateBudget(req, res) {
  const budget = await budgetsService.updateBudget(
    req.user.id,
    req.params.id,
    req.body
  );

  res.json({
    success: true,
    data: budget,
  });
}

async function deleteBudget(req, res) {
  await budgetsService.deleteBudget(req.user.id, req.params.id);

  res.json({
    success: true,
  });
}

module.exports = {
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
};
