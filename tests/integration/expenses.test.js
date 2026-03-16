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

let token;

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
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "amount" })])
    );
  });

  it("returns 400 when date is missing", async () => {
    const { date, ...body } = VALID_EXPENSE;
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "date" })])
    );
  });

  it("returns 400 when amount is zero or negative", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, amount: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when date format is invalid", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_EXPENSE, date: "15-03-2026" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app).post(BASE).send(VALID_EXPENSE);
    expect(res.status).toBe(401);
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

  it("returns 200 with updated fields", async () => {
    const res = await request(app)
      .patch(`${BASE}/${expenseId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 99.99, description: "Updated" });

    expect(res.status).toBe(200);
    expect(parseFloat(res.body.data.amount)).toBe(99.99);
    expect(res.body.data.description).toBe("Updated");
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

  it("returns 401 when no token is provided", async () => {
    const res = await request(app)
      .delete(`${BASE}/00000000-0000-0000-0000-000000000000`);
    expect(res.status).toBe(401);
  });

});
