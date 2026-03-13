const expensesRepository = require("./expenses.repository");

async function createExpense(userId, data) {

  return await expensesRepository.createExpense({
    userId,
    ...data
  });

}

async function getExpenses(userId) {

  return await expensesRepository.getExpensesByUser(userId);

}

async function deleteExpense(userId, expenseId) {

  return await expensesRepository.deleteExpense(userId, expenseId);

}

module.exports = {
  createExpense,
  getExpenses,
  deleteExpense
};