const request = require("supertest");
const app = require("../../src/app");
const { truncateTables } = require("../db");
const { getToken } = require("../helpers/auth.helpers");

const BASE = "/api/v1/budgets";

const VALID_BUDGET = {
  amount: 500,
  period: "monthly",
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
// POST /api/v1/budgets
// ---------------------------------------------------------------------------

describe("POST /api/v1/budgets", () => {

  it("returns 201 with the created budget on valid input", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_BUDGET);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(parseFloat(res.body.data.amount)).toBe(500);
    expect(res.body.data.period).toBe("monthly");
    expect(res.body.data.category_id).toBeNull();
  });

  it("returns 400 when amount has more than 2 decimal places", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_BUDGET, amount: 0.001 });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: "amount", message: "Amount can have at most 2 decimal places" },
    ]);
  });

  it("returns 400 when amount is too large for the column", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_BUDGET, amount: 10000000000 });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: "amount", message: "Amount must be 9,999,999,999.99 or less" },
    ]);
  });

  it("creates a budget linked to a category", async () => {
    const catRes = await request(app)
      .get("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`);
    const categoryId = catRes.body.data[0].id;

    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_BUDGET, category_id: categoryId });

    expect(res.status).toBe(201);
    expect(res.body.data.category_id).toBe(categoryId);
  });

  it("returns 422 when category_id belongs to another user", async () => {
    const otherCategoryId = await createOtherUsersCategory();

    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_BUDGET, category_id: otherCategoryId });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_CATEGORY");
  });

  it("returns 422 when category_id does not exist", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_BUDGET, category_id: UNKNOWN_CATEGORY_ID });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_CATEGORY");
  });

  it("returns 400 when amount is missing", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ period: "monthly" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([
      { field: "amount", message: "Amount is required" },
    ]);
  });

  it("returns 400 when period is missing", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 100 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([
      { field: "period", message: "Period is required" },
    ]);
  });

  it("returns 400 when period is invalid", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 100, period: "weekly" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([
      { field: "period", message: "Period must be 'monthly' or 'yearly'" },
    ]);
  });

  it("returns 400 when amount is zero or negative", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 0, period: "monthly" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 when a duplicate global budget exists for the same period", async () => {
    await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_BUDGET);

    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_BUDGET);

    expect(res.status).toBe(409);
  });

  it("returns 409 when a duplicate category budget exists for the same period", async () => {
    const catRes = await request(app)
      .get("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`);
    const categoryId = catRes.body.data[0].id;

    await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_BUDGET, category_id: categoryId });

    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_BUDGET, category_id: categoryId });

    expect(res.status).toBe(409);
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app).post(BASE).send(VALID_BUDGET);
    expect(res.status).toBe(401);
  });

});

// ---------------------------------------------------------------------------
// GET /api/v1/budgets
// ---------------------------------------------------------------------------

describe("GET /api/v1/budgets", () => {

  it("returns 200 with empty array when user has no budgets", async () => {
    const res = await request(app)
      .get(BASE)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it("returns all budgets belonging to the user", async () => {
    await request(app).post(BASE).set("Authorization", `Bearer ${token}`)
      .send({ amount: 500, period: "monthly" });
    await request(app).post(BASE).set("Authorization", `Bearer ${token}`)
      .send({ amount: 2000, period: "yearly" });

    const res = await request(app)
      .get(BASE)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it("does not return another user's budgets", async () => {
    const otherToken = await getToken({ email: "other@example.com" });
    await request(app).post(BASE).set("Authorization", `Bearer ${otherToken}`)
      .send(VALID_BUDGET);

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
// PATCH /api/v1/budgets/:id
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/budgets/:id", () => {

  let budgetId;

  beforeEach(async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_BUDGET);
    budgetId = res.body.data.id;
  });

  it("returns 200 with updated fields", async () => {
    const res = await request(app)
      .patch(`${BASE}/${budgetId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 750 });

    expect(res.status).toBe(200);
    expect(parseFloat(res.body.data.amount)).toBe(750);
    expect(res.body.data.period).toBe("monthly");
  });

  it("returns 400 when the request body is empty", async () => {
    const res = await request(app)
      .patch(`${BASE}/${budgetId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("returns 404 for a non-existent budget", async () => {
    const res = await request(app)
      .patch(`${BASE}/00000000-0000-0000-0000-000000000000`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 100 });

    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed ID", async () => {
    const res = await request(app)
      .patch(`${BASE}/not-a-uuid`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 100 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("returns 404 when attempting to update another user's budget", async () => {
    const otherToken = await getToken({ email: "other@example.com" });
    const otherRes = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ amount: 300, period: "yearly" });
    const otherId = otherRes.body.data.id;

    const res = await request(app)
      .patch(`${BASE}/${otherId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 100 });

    expect(res.status).toBe(404);
  });

  it("returns 422 when changing category_id to another user's category", async () => {
    const otherCategoryId = await createOtherUsersCategory();

    const res = await request(app)
      .patch(`${BASE}/${budgetId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ category_id: otherCategoryId });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_CATEGORY");
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app)
      .patch(`${BASE}/${budgetId}`)
      .send({ amount: 100 });
    expect(res.status).toBe(401);
  });

});

// ---------------------------------------------------------------------------
// DELETE /api/v1/budgets/:id
// ---------------------------------------------------------------------------

describe("DELETE /api/v1/budgets/:id", () => {

  it("returns 200 and the budget no longer appears in the list", async () => {
    const created = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_BUDGET);
    const id = created.body.data.id;

    const deleteRes = await request(app)
      .delete(`${BASE}/${id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    const listRes = await request(app)
      .get(BASE)
      .set("Authorization", `Bearer ${token}`);
    expect(listRes.body.data).toHaveLength(0);
  });

  it("returns 404 for a non-existent budget", async () => {
    const res = await request(app)
      .delete(`${BASE}/00000000-0000-0000-0000-000000000000`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("returns 404 when attempting to delete another user's budget", async () => {
    const otherToken = await getToken({ email: "other@example.com" });
    const otherRes = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ amount: 300, period: "yearly" });
    const otherId = otherRes.body.data.id;

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
