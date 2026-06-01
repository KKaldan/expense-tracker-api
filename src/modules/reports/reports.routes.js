const express = require("express");
const router = express.Router();

const authenticate = require("../../middleware/auth.middleware");
const asyncHandler = require("../../utils/asyncHandler");
const reportsController = require("./reports.controller");

router.get("/summary",       authenticate, asyncHandler(reportsController.getSummary));
router.get("/by-category",   authenticate, asyncHandler(reportsController.getByCategory));
router.get("/monthly-trend", authenticate, asyncHandler(reportsController.getMonthlyTrend));

module.exports = router;
