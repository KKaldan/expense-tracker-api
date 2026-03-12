const express = require("express");

const authRoutes = require("./modules/auth/auth.routes");

const app = express();

app.use(express.json());

app.use("/api/v1/auth", authRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

module.exports = app;
