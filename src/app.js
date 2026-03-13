const express = require("express");

const app = express();

const expenseRoutes = require("./modules/expenses/expenses.routes");

app.use(express.json());

const authRoutes = require("./modules/auth/auth.routes");


app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/v1/auth", authRoutes);

app.use("/api/v1/expenses", expenseRoutes);

module.exports = app;
