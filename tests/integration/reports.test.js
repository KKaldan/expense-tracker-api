const request = require("supertest");
const app = require("../../src/app");
const { truncateTables } = require("../db");
const { getToken } = require("../helpers/auth.helpers");

const BASE = "/api/v1/reports";

let token;

beforeEach(async () => {
  await truncateTables();
  token = await getToken();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createExpense(data) {
  const res = await request(app)
    .post("/api/v1/expenses")
    .set("Authorization", `Bearer ${token}`)
    .send(data);
  return res.body.data;
}

async function createCategory(name) {
  const res = await request(app)
    .post("/api/v1/categories")
    .set("Authorization", `Bearer ${token}`)
    .send({ name });
  return res.body.data;
}

// Returns "YYYY-MM-01" for the first day of a month N months ago from today.
function monthStart(monthsAgo = 0) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1))
    .toISOString()
    .slice(0, 10);
}

// Returns "YYYY-MM-DD" for today.
function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// GET /api/v1/reports/summary
// ---------------------------------------------------------------------------

describe("GET /api/v1/reports/summary", () => {

  it("returns 401 without authentication", async () => {
    const res = await request(app).get(`${BASE}/summary`);
    expect(res.status).toBe(401);
  });

  it("returns zeros when no expenses exist in the range", async () => {
    const res = await request(app)
      .get(`${BASE}/summary?from=2020-01-01&to=2020-01-31`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.expense_count).toBe(0);
    expect(parseFloat(res.body.data.total_spend)).toBe(0);
    expect(parseFloat(res.body.data.daily_average)).toBe(0);
  });

  it("returns correct totals for a date range", async () => {
    await createExpense({ amount: 100, date: "2025-03-10", currency: "GBP" });
    await createExpense({ amount: 50,  date: "2025-03-20", currency: "GBP" });
    await createExpense({ amount: 200, date: "2025-04-01", currency: "GBP" }); // outside range

    const res = await request(app)
      .get(`${BASE}/summary?from=2025-03-01&to=2025-03-31`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.expense_count).toBe(2);
    expect(parseFloat(res.body.data.total_spend)).toBe(150);
    // 150 / 31 days = 4.84
    expect(parseFloat(res.body.data.daily_average)).toBeCloseTo(4.84, 1);
  });

  it("includes from and to in the response", async () => {
    const res = await request(app)
      .get(`${BASE}/summary?from=2025-03-01&to=2025-03-31`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.data.from).toBe("2025-03-01");
    expect(res.body.data.to).toBe("2025-03-31");
  });

  it("defaults to current month when no date range provided", async () => {
    const from = monthStart(0);
    await createExpense({ amount: 75, date: from, currency: "GBP" });

    const res = await request(app)
      .get(`${BASE}/summary`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.expense_count).toBe(1);
    expect(parseFloat(res.body.data.total_spend)).toBe(75);
  });

  it("returns 400 when from is an invalid date", async () => {
    const res = await request(app)
      .get(`${BASE}/summary?from=not-a-date&to=2025-03-31`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when from is after to", async () => {
    const res = await request(app)
      .get(`${BASE}/summary?from=2025-03-31&to=2025-03-01`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("does not include expenses from other users", async () => {
    const otherToken = await getToken({ email: "other@example.com" });
    await request(app)
      .post("/api/v1/expenses")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ amount: 999, date: "2025-03-15", currency: "GBP" });

    const res = await request(app)
      .get(`${BASE}/summary?from=2025-03-01&to=2025-03-31`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.data.expense_count).toBe(0);
    expect(parseFloat(res.body.data.total_spend)).toBe(0);
  });

});

// ---------------------------------------------------------------------------
// GET /api/v1/reports/by-category
// ---------------------------------------------------------------------------

describe("GET /api/v1/reports/by-category", () => {

  it("returns 401 without authentication", async () => {
    const res = await request(app).get(`${BASE}/by-category`);
    expect(res.status).toBe(401);
  });

  it("returns empty array when no expenses exist in the range", async () => {
    const res = await request(app)
      .get(`${BASE}/by-category?from=2020-01-01&to=2020-01-31`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it("returns spend grouped by category with percentage", async () => {
    const cat = await createCategory("Food");
    await createExpense({ amount: 75,  date: "2025-03-10", currency: "GBP", category_id: cat.id });
    await createExpense({ amount: 25,  date: "2025-03-15", currency: "GBP", category_id: cat.id });
    await createExpense({ amount: 100, date: "2025-03-20", currency: "GBP" }); // uncategorized

    const res = await request(app)
      .get(`${BASE}/by-category?from=2025-03-01&to=2025-03-31`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const rows = res.body.data;
    expect(rows).toHaveLength(2);

    const food = rows.find((r) => r.category_name === "Food");
    expect(food).toBeDefined();
    expect(parseFloat(food.total_spend)).toBe(100);
    expect(parseFloat(food.percentage)).toBe(50);

    const uncategorized = rows.find((r) => r.category_id === null);
    expect(uncategorized).toBeDefined();
    expect(parseFloat(uncategorized.total_spend)).toBe(100);
    expect(parseFloat(uncategorized.percentage)).toBe(50);
  });

  it("percentages sum to 100", async () => {
    const cat1 = await createCategory("Food");
    const cat2 = await createCategory("Transport");
    await createExpense({ amount: 60, date: "2025-03-10", currency: "GBP", category_id: cat1.id });
    await createExpense({ amount: 30, date: "2025-03-15", currency: "GBP", category_id: cat2.id });
    await createExpense({ amount: 10, date: "2025-03-20", currency: "GBP" });

    const res = await request(app)
      .get(`${BASE}/by-category?from=2025-03-01&to=2025-03-31`)
      .set("Authorization", `Bearer ${token}`);

    const total = res.body.data.reduce((sum, r) => sum + parseFloat(r.percentage), 0);
    expect(total).toBeCloseTo(100, 0);
  });

  it("results are ordered by total_spend descending", async () => {
    const cat1 = await createCategory("Food");
    const cat2 = await createCategory("Transport");
    await createExpense({ amount: 20,  date: "2025-03-10", currency: "GBP", category_id: cat1.id });
    await createExpense({ amount: 200, date: "2025-03-15", currency: "GBP", category_id: cat2.id });

    const res = await request(app)
      .get(`${BASE}/by-category?from=2025-03-01&to=2025-03-31`)
      .set("Authorization", `Bearer ${token}`);

    const spends = res.body.data.map((r) => parseFloat(r.total_spend));
    expect(spends[0]).toBeGreaterThan(spends[1]);
  });

  it("returns 400 when from is after to", async () => {
    const res = await request(app)
      .get(`${BASE}/by-category?from=2025-03-31&to=2025-03-01`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

});

// ---------------------------------------------------------------------------
// GET /api/v1/reports/monthly-trend
// ---------------------------------------------------------------------------

describe("GET /api/v1/reports/monthly-trend", () => {

  it("returns 401 without authentication", async () => {
    const res = await request(app).get(`${BASE}/monthly-trend`);
    expect(res.status).toBe(401);
  });

  it("returns 6 months by default", async () => {
    const res = await request(app)
      .get(`${BASE}/monthly-trend`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(6);
  });

  it("returns the correct number of months when specified", async () => {
    const res = await request(app)
      .get(`${BASE}/monthly-trend?months=3`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
  });

  it("falls back to 6 months for an invalid months value", async () => {
    const res = await request(app)
      .get(`${BASE}/monthly-trend?months=abc`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(6);
  });

  it("delta is null for the first month and a number for subsequent months", async () => {
    const res = await request(app)
      .get(`${BASE}/monthly-trend?months=3`)
      .set("Authorization", `Bearer ${token}`);

    const rows = res.body.data;
    expect(rows[0].delta).toBeNull();
    expect(rows[1].delta).not.toBeNull();
    expect(rows[2].delta).not.toBeNull();
  });

  it("each row has the correct shape", async () => {
    const res = await request(app)
      .get(`${BASE}/monthly-trend?months=2`)
      .set("Authorization", `Bearer ${token}`);

    for (const row of res.body.data) {
      expect(row).toHaveProperty("month");
      expect(row).toHaveProperty("total_spend");
      expect(row).toHaveProperty("expense_count");
      expect(row).toHaveProperty("delta");
      expect(row.month).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it("months are ordered oldest to newest", async () => {
    const res = await request(app)
      .get(`${BASE}/monthly-trend?months=3`)
      .set("Authorization", `Bearer ${token}`);

    const months = res.body.data.map((r) => r.month);
    expect(months[0] < months[1]).toBe(true);
    expect(months[1] < months[2]).toBe(true);
  });

  it("correctly aggregates expense totals by month", async () => {
    const twoMonthsAgo = monthStart(2);
    const lastMonth = monthStart(1);
    const thisMonth = monthStart(0);

    await createExpense({ amount: 100, date: twoMonthsAgo, currency: "GBP" });
    await createExpense({ amount: 50,  date: twoMonthsAgo, currency: "GBP" });
    await createExpense({ amount: 200, date: lastMonth,    currency: "GBP" });
    await createExpense({ amount: 75,  date: thisMonth,    currency: "GBP" });

    const res = await request(app)
      .get(`${BASE}/monthly-trend?months=3`)
      .set("Authorization", `Bearer ${token}`);

    const rows = res.body.data;
    expect(parseFloat(rows[0].total_spend)).toBe(150);  // two months ago
    expect(parseFloat(rows[1].total_spend)).toBe(200);  // last month
    expect(parseFloat(rows[2].total_spend)).toBe(75);   // this month
  });

  it("computes delta correctly between months", async () => {
    const lastMonth = monthStart(1);
    const thisMonth = monthStart(0);

    await createExpense({ amount: 100, date: lastMonth, currency: "GBP" });
    await createExpense({ amount: 160, date: thisMonth, currency: "GBP" });

    const res = await request(app)
      .get(`${BASE}/monthly-trend?months=2`)
      .set("Authorization", `Bearer ${token}`);

    const rows = res.body.data;
    expect(parseFloat(rows[1].delta)).toBeCloseTo(60, 1); // 160 - 100
  });

  it("does not include expenses from other users", async () => {
    const otherToken = await getToken({ email: "other@example.com" });
    await request(app)
      .post("/api/v1/expenses")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ amount: 999, date: monthStart(0), currency: "GBP" });

    const res = await request(app)
      .get(`${BASE}/monthly-trend?months=1`)
      .set("Authorization", `Bearer ${token}`);

    expect(parseFloat(res.body.data[0].total_spend)).toBe(0);
  });

});
