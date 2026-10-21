const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const env = require("./config/env");
const AppError = require("./utils/AppError");
const errorHandler = require("./middleware/errorHandler");
const { authRateLimiter } = require("./middleware/rateLimiter");
const authRoutes = require("./modules/auth/auth.routes");
const expenseRoutes = require("./modules/expenses/expenses.routes");
const categoryRoutes = require("./modules/categories/categories.routes");
const budgetRoutes = require("./modules/budgets/budgets.routes");
const reportRoutes = require("./modules/reports/reports.routes");

const app = express();

app.set("trust proxy", env.TRUST_PROXY);

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser clients (no Origin header — curl, server-to-server, health checks)
    if (!origin || env.CORS_ORIGIN.includes(origin)) {
      return callback(null, true);
    }
    return callback(AppError.forbidden("Not allowed by CORS", "CORS_NOT_ALLOWED"));
  },
  credentials: true,
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/v1/auth", authRateLimiter, authRoutes);
app.use("/api/v1/expenses", expenseRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/budgets", budgetRoutes);
app.use("/api/v1/reports", reportRoutes);

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
