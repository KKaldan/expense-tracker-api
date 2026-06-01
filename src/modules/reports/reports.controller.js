const reportsService = require("./reports.service");
const { dateRangeSchema, monthlyTrendQuerySchema } = require("./reports.schema");

async function getSummary(req, res) {
  const filters = dateRangeSchema.parse(req.query);
  const data = await reportsService.getSummary(req.user.id, filters);

  res.json({ success: true, data });
}

async function getByCategory(req, res) {
  const filters = dateRangeSchema.parse(req.query);
  const data = await reportsService.getByCategory(req.user.id, filters);

  res.json({ success: true, data });
}

async function getMonthlyTrend(req, res) {
  const filters = monthlyTrendQuerySchema.parse(req.query);
  const data = await reportsService.getMonthlyTrend(req.user.id, filters);

  res.json({ success: true, data });
}

module.exports = { getSummary, getByCategory, getMonthlyTrend };
