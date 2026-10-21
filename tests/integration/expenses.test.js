const request = require("supertest");
const app = require("../../src/app");
const { truncateTables } = require("../db");
const { getToken } = require("../helpers/auth.helpers");

const BASE = "/api/v1/expenses";

const VALID_EXPENSE = {
  amount: 42.50,
  date: "2026-03-15",
  description: "Team lunch",
  currency: "GBP",
};

// Well-formed v4 UUID that matches no row.
const UNKNOWN_CATEGORY_ID = "00000000-0000-4000-8000-000000000000";

let token;

// Creates a custom category owned by a second user and returns its ID.
async function createOtherUsersCategory() {
  const otherToken = await getToken({ email: "other@example.com" });
  const res = await request(app)
    .post("/api/v1/categories")
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ name: "Private" });
  return res.body.data.id;
}

beforeEach(async () => {
  await truncateTables();
  token = await getToken();
});

// ---------------------------------------------------------------------------
// POST /api/v1/expenses
// ---------------------------------------------------------------------------

describe("POST /api/v1/expenses", () => {

  it("returns 201 with the created expense on valid input", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_EXPENSE);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(parseFloat(res.body.data.amount)).toBe(42.50);
    expect(res.body.data.date).toBe("2026-03-15");
    expect(res.body.data.currency).toBe("GBP");
  });

  it("lowercased currency is uppercased automatically", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, currency: "gbp" });

    expect(res.status).toBe(201);
    expect(res.body.data.currency).toBe("GBP");
  });

  it("defaults currency to GBP when omitted", async () => {
    const { currency, ...withoutCurrency } = VALID_EXPENSE;
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send(withoutCurrency);

    expect(res.status).toBe(201);
    expect(res.body.data.currency).toBe("GBP");
  });

  it("returns 400 when amount is missing", async () => {
    const { amount, ...body } = VALID_EXPENSE;
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([
      { field: "amount", message: "Amount is required" },
    ]);
  });

  it("returns 400 with a type message when amount is not a number", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, amount: "42.50" });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: "amount", message: "Amount must be a number" },
    ]);
  });

  it("returns 400 when date is missing", async () => {
    const { date, ...body } = VALID_EXPENSE;
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([
      { field: "date", message: "Date is required" },
    ]);
  });

  it("returns 400 when amount is zero or negative", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, amount: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when amount has more than 2 decimal places", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, amount: 0.001 });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: "amount", message: "Amount can have at most 2 decimal places" },
    ]);
  });

  it("returns 400 when amount is too large for the column", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, amount: 10000000000 });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: "amount", message: "Amount must be 9,999,999,999.99 or less" },
    ]);
  });

  it("returns 400 when date format is invalid", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, date: "15-03-2026" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when date does not exist on the calendar", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, date: "2026-02-31" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([
      { field: "date", message: "Date must be a real calendar date" },
    ]);
  });

  it("accepts a leap day", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, date: "2028-02-29" });

    expect(res.status).toBe(201);
    expect(res.body.data.date).toBe("2028-02-29");
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app).post(BASE).send(VALID_EXPENSE);
    expect(res.status).toBe(401);
  });

  it("returns budget_status 'none' when no budget exists", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_EXPENSE);

    expect(res.status).toBe(201);
    expect(res.body.data.budget_status).toBe("none");
  });

  it("returns budget_status 'ok' when spend is under 80% of budget", async () => {
    await request(app).post("/api/v1/budgets")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 1000, period: "monthly" });

    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, amount: 100 });

    expect(res.status).toBe(201);
    expect(res.body.data.budget_status).toBe("ok");
  });

  it("returns budget_status 'warning' when spend is between 80-100% of budget", async () => {
    await request(app).post("/api/v1/budgets")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 100, period: "monthly" });

    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, amount: 85 });

    expect(res.status).toBe(201);
    expect(res.body.data.budget_status).toBe("warning");
  });

  it("returns budget_status 'exceeded' when spend is over budget", async () => {
    await request(app).post("/api/v1/budgets")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 50, period: "monthly" });

    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, amount: 75 });

    expect(res.status).toBe(201);
    expect(res.body.data.budget_status).toBe("exceeded");
  });

  it("returns exceeded when global budget is breached even if category budget is ok", async () => {
    const catRes = await request(app)
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Dining" });
    const categoryId = catRes.body.data.id;

    // Category budget: £500 — expense will be well under this
    await request(app).post("/api/v1/budgets")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 500, period: "monthly", category_id: categoryId });

    // Global budget: £50 — expense will exceed this
    await request(app).post("/api/v1/budgets")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 50, period: "monthly" });

    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, amount: 75, category_id: categoryId });

    expect(res.status).toBe(201);
    expect(res.body.data.budget_status).toBe("exceeded");
  });

  it("accepts a system category", async () => {
    const catRes = await request(app)
      .get("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`);
    const systemCategory = catRes.body.data.find((c) => c.owner_id === null);

    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, category_id: systemCategory.id });

    expect(res.status).toBe(201);
    expect(res.body.data.category_id).toBe(systemCategory.id);
  });

  it("returns 422 when category_id belongs to another user", async () => {
    const otherCategoryId = await createOtherUsersCategory();

    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, category_id: otherCategoryId });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_CATEGORY");
  });

  it("returns 422 when category_id does not exist", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, category_id: UNKNOWN_CATEGORY_ID });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_CATEGORY");
  });

});

// ---------------------------------------------------------------------------
// GET /api/v1/expenses
// ---------------------------------------------------------------------------

describe("GET /api/v1/expenses", () => {

  it("returns 200 with empty data and correct meta when no expenses exist", async () => {
    const res = await request(app)
      .get(BASE)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(20);
  });

  it("returns created expenses with correct pagination meta", async () => {
    await request(app).post(BASE).set("Authorization", `Bearer ${token}`).send(VALID_EXPENSE);
    await request(app).post(BASE).set("Authorization", `Bearer ${token}`).send({ ...VALID_EXPENSE, amount: 10 });

    const res = await request(app)
      .get(BASE)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.meta.total_pages).toBe(1);
  });

  it("respects page and limit parameters", async () => {
    for (let i = 1; i <= 3; i++) {
      await request(app)
        .post(BASE)
        .set("Authorization", `Bearer ${token}`)
        .send({ ...VALID_EXPENSE, amount: i });
    }

    const res = await request(app)
      .get(`${BASE}?page=1&limit=2`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(3);
    expect(res.body.meta.total_pages).toBe(2);
    expect(res.body.meta.limit).toBe(2);
  });

  it("filters by date range", async () => {
    await request(app).post(BASE).set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, date: "2026-01-15" });
    await request(app).post(BASE).set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, date: "2026-03-15" });

    const res = await request(app)
      .get(`${BASE}?from=2026-03-01&to=2026-03-31`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].date).toBe("2026-03-15");
  });

  it("returns 400 when from does not exist on the calendar", async () => {
    const res = await request(app)
      .get(`${BASE}?from=2026-02-30`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when from is after to", async () => {
    const res = await request(app)
      .get(`${BASE}?from=2026-06-30&to=2026-01-01`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "from" })])
    );
  });

  it("only returns expenses belonging to the authenticated user", async () => {
    // Create a second user and their expense
    const otherToken = await getToken({ email: "other@example.com" });
    await request(app).post(BASE).set("Authorization", `Bearer ${otherToken}`)
      .send(VALID_EXPENSE);

    const res = await request(app)
      .get(BASE)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it("filters by category_id", async () => {
    const catRes = await request(app)
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Groceries" });
    const categoryId = catRes.body.data.id;

    await request(app).post(BASE).set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, category_id: categoryId });
    await request(app).post(BASE).set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, amount: 10 }); // no category

    const res = await request(app)
      .get(`${BASE}?category_id=${categoryId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].category_id).toBe(categoryId);
  });

  it("sorts results by amount ascending when sort=amount:asc", async () => {
    await request(app).post(BASE).set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, amount: 50 });
    await request(app).post(BASE).set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, amount: 10 });
    await request(app).post(BASE).set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, amount: 30 });

    const res = await request(app)
      .get(`${BASE}?sort=amount:asc`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const amounts = res.body.data.map((e) => parseFloat(e.amount));
    expect(amounts).toEqual([...amounts].sort((a, b) => a - b));
  });

  it("pages through tied rows without repeating or skipping any", async () => {
    for (let i = 0; i < 3; i++) {
      await request(app).post(BASE).set("Authorization", `Bearer ${token}`)
        .send({ ...VALID_EXPENSE, amount: 10 });
    }

    const ids = [];
    for (let page = 1; page <= 3; page++) {
      const res = await request(app)
        .get(`${BASE}?sort=amount:asc&limit=1&page=${page}`)
        .set("Authorization", `Bearer ${token}`);
      ids.push(res.body.data[0].id);
    }

    // Ties are broken by id, so the order is fully defined.
    expect(new Set(ids).size).toBe(3);
    expect(ids).toEqual([...ids].sort());
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(401);
  });

});

// ---------------------------------------------------------------------------
// GET /api/v1/expenses/:id
// ---------------------------------------------------------------------------

describe("GET /api/v1/expenses/:id", () => {

  it("returns 200 with the expense on a valid ID", async () => {
    const created = await request(app)
      .post(BASE).set("Authorization", `Bearer ${token}`).send(VALID_EXPENSE);
    const id = created.body.data.id;

    const res = await request(app)
      .get(`${BASE}/${id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
  });

  it("returns 404 for a non-existent ID", async () => {
    const res = await request(app)
      .get(`${BASE}/00000000-0000-0000-0000-000000000000`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed ID", async () => {
    const res = await request(app)
      .get(`${BASE}/not-a-uuid`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("returns 404 for an expense belonging to another user", async () => {
    const otherToken = await getToken({ email: "other@example.com" });
    const created = await request(app)
      .post(BASE).set("Authorization", `Bearer ${otherToken}`).send(VALID_EXPENSE);
    const id = created.body.data.id;

    // First user should not be able to see second user's expense
    const res = await request(app)
      .get(`${BASE}/${id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app).get(`${BASE}/00000000-0000-0000-0000-000000000000`);
    expect(res.status).toBe(401);
  });

});

// ---------------------------------------------------------------------------
// PATCH /api/v1/expenses/:id
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/expenses/:id", () => {

  let expenseId;

  beforeEach(async () => {
    const res = await request(app)
      .post(BASE).set("Authorization", `Bearer ${token}`).send(VALID_EXPENSE);
    expenseId = res.body.data.id;
  });

  it("returns 200 with updated fields and a budget_status", async () => {
    const res = await request(app)
      .patch(`${BASE}/${expenseId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 99.99, description: "Updated" });

    expect(res.status).toBe(200);
    expect(parseFloat(res.body.data.amount)).toBe(99.99);
    expect(res.body.data.description).toBe("Updated");
    expect(res.body.data.budget_status).toBeDefined();
  });

  it("does not modify fields that were not sent", async () => {
    const res = await request(app)
      .patch(`${BASE}/${expenseId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "Only this changed" });

    expect(res.status).toBe(200);
    expect(parseFloat(res.body.data.amount)).toBe(42.50);
    expect(res.body.data.description).toBe("Only this changed");
  });

  it("returns 400 when the request body is empty", async () => {
    const res = await request(app)
      .patch(`${BASE}/${expenseId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("returns 404 for a non-existent expense", async () => {
    const res = await request(app)
      .patch(`${BASE}/00000000-0000-0000-0000-000000000000`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 10 });

    expect(res.status).toBe(404);
  });

  it("returns 404 when patching another user's expense", async () => {
    const otherToken = await getToken({ email: "other@example.com" });
    const created = await request(app)
      .post(BASE).set("Authorization", `Bearer ${otherToken}`).send(VALID_EXPENSE);
    const otherId = created.body.data.id;

    const res = await request(app)
      .patch(`${BASE}/${otherId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 1 });

    expect(res.status).toBe(404);
  });

  it("returns 422 when changing category_id to another user's category", async () => {
    const otherCategoryId = await createOtherUsersCategory();

    const res = await request(app)
      .patch(`${BASE}/${expenseId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ category_id: otherCategoryId });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_CATEGORY");
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app)
      .patch(`${BASE}/${expenseId}`)
      .send({ amount: 10 });
    expect(res.status).toBe(401);
  });

});

// ---------------------------------------------------------------------------
// DELETE /api/v1/expenses/:id
// ---------------------------------------------------------------------------

describe("DELETE /api/v1/expenses/:id", () => {

  it("returns 200 and the expense no longer exists afterwards", async () => {
    const created = await request(app)
      .post(BASE).set("Authorization", `Bearer ${token}`).send(VALID_EXPENSE);
    const id = created.body.data.id;

    const deleteRes = await request(app)
      .delete(`${BASE}/${id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // Confirm it's gone
    const getRes = await request(app)
      .get(`${BASE}/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(getRes.status).toBe(404);
  });

  it("returns 404 for a non-existent expense", async () => {
    const res = await request(app)
      .delete(`${BASE}/00000000-0000-0000-0000-000000000000`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting another user's expense", async () => {
    const otherToken = await getToken({ email: "other@example.com" });
    const created = await request(app)
      .post(BASE).set("Authorization", `Bearer ${otherToken}`).send(VALID_EXPENSE);
    const otherId = created.body.data.id;

    const res = await request(app)
      .delete(`${BASE}/${otherId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app)
      .delete(`${BASE}/00000000-0000-0000-0000-000000000000`);
    expect(res.status).toBe(401);
  });

});
