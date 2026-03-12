const express = require("express");

const app = express();

app.use(express.json());

const authRoutes = require("./modules/auth/auth.routes");


app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/v1/auth", authRoutes);

module.exports = app;
