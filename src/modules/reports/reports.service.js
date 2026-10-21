const db = require("../../config/db");

function currentMonthRange() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

async function getSummary(userId, { from, to }) {
  const defaults = currentMonthRange();
  const dateFrom = from ?? defaults.from;
  const dateTo = to ?? defaults.to;

  const { rows } = await db.query(
    `SELECT
       COUNT(*)::int                                                    AS expense_count,
       COALESCE(SUM(amount), 0)                                        AS total_spend,
       ROUND(COALESCE(SUM(amount), 0) / ($3::date - $2::date + 1), 2) AS daily_average
     FROM expenses
     WHERE owner_id = $1
       AND date >= $2
       AND date <= $3`,
    [userId, dateFrom, dateTo]
  );

  return {
    from: dateFrom,
    to: dateTo,
    expense_count: rows[0].expense_count,
    total_spend: rows[0].total_spend,
    daily_average: rows[0].daily_average,
  };
}

async function getByCategory(userId, { from, to }) {
  const defaults = currentMonthRange();
  const dateFrom = from ?? defaults.from;
  const dateTo = to ?? defaults.to;

  const { rows } = await db.query(
    `SELECT
       e.category_id,
       c.name                                            AS category_name,
       SUM(e.amount)                                     AS total_spend,
       ROUND(SUM(e.amount) * 100.0 / SUM(SUM(e.amount)) OVER (), 2) AS percentage
     FROM expenses e
     -- Owner filter in the join is defence in depth: even if an expense ever
     -- references another user's category, that category's name is not exposed.
     LEFT JOIN categories c
       ON e.category_id = c.id
      AND (c.owner_id IS NULL OR c.owner_id = $1)
     WHERE e.owner_id = $1
       AND e.date >= $2
       AND e.date <= $3
     GROUP BY e.category_id, c.name
     ORDER BY total_spend DESC`,
    [userId, dateFrom, dateTo]
  );

  return rows;
}

async function getMonthlyTrend(userId, { months }) {
  // Both ends of the window are computed here in UTC, like currentMonthRange().
  // Using CURRENT_DATE for the end would follow the DB session's time zone, so
  // near a month boundary the series could gain an extra month.
  const now = new Date();
  const monthStartUTC = (offset) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1)).toISOString().slice(0, 10);
  const fromDate = monthStartUTC(months - 1);
  const toDate = monthStartUTC(0);

  const { rows } = await db.query(
    `WITH months AS (
       SELECT generate_series(
         $2::date::timestamp,
         $3::date::timestamp,
         '1 month'
       ) AS month_start
     ),
     monthly_totals AS (
       SELECT
         date_trunc('month', date::timestamp) AS month_start,
         SUM(amount)                          AS total_spend,
         COUNT(*)::int                        AS expense_count
       FROM expenses
       WHERE owner_id = $1
         AND date >= $2::date
       GROUP BY 1
     )
     SELECT
       to_char(m.month_start, 'YYYY-MM')               AS month,
       COALESCE(mt.total_spend, 0)                      AS total_spend,
       COALESCE(mt.expense_count, 0)                    AS expense_count,
       COALESCE(mt.total_spend, 0)
         - LAG(COALESCE(mt.total_spend, 0)) OVER (ORDER BY m.month_start) AS delta
     FROM months m
     LEFT JOIN monthly_totals mt ON mt.month_start = m.month_start
     ORDER BY m.month_start ASC`,
    [userId, fromDate, toDate]
  );

  return rows;
}

module.exports = { getSummary, getByCategory, getMonthlyTrend };
