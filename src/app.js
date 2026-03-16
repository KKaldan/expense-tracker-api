const express = require("express");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./modules/auth/auth.routes");
const expenseRoutes = require("./modules/expenses/expenses.routes");

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/expenses", expenseRoutes);

// 404 handler — catches any request that didn't match a route above
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "Route not found" },
  });
});

// Central error handler — must be last and must have 4 arguments
app.use(errorHandler);

module.exports = app;
