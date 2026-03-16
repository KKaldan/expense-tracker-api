const request = require("supertest");
const app = require("../../src/app");
const { truncateTables } = require("../db");
const { getToken } = require("../helpers/auth.helpers");

const BASE = "/api/v1/categories";

let token;

beforeEach(async () => {
  await truncateTables();
  token = await getToken();
});

// ---------------------------------------------------------------------------
// GET /api/v1/categories
// ---------------------------------------------------------------------------

describe("GET /api/v1/categories", () => {

  it("returns 200 with system categories when user has no custom ones", async () => {
    const res = await request(app)
      .get(BASE)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(10);
    // System categories have no owner_id
    const systemCats = res.body.data.filter((c) => c.owner_id === null);
    expect(systemCats.length).toBeGreaterThanOrEqual(10);
  });

  it("includes user-created categories alongside system ones", async () => {
    await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "My Custom Category" });

    const res = await request(app)
      .get(BASE)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.data.map((c) => c.name);
    expect(names).toContain("My Custom Category");
  });

  it("does not include another user's custom categories", async () => {
    const otherToken = await getToken({ email: "other@example.com" });
    await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ name: "Other User Category" });

    const res = await request(app)
      .get(BASE)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.data.map((c) => c.name);
    expect(names).not.toContain("Other User Category");
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(401);
  });

});

// ---------------------------------------------------------------------------
// POST /api/v1/categories
// ---------------------------------------------------------------------------

describe("POST /api/v1/categories", () => {

  it("returns 201 with the created category", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Hobbies", icon: "🎸", color: "#FF5733" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.name).toBe("Hobbies");
    expect(res.body.data.icon).toBe("🎸");
    expect(res.body.data.color).toBe("#FF5733");
    expect(res.body.data.owner_id).toBeDefined();
  });

  it("creates a category with only a name (icon and color are optional)", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Minimal" });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("Minimal");
  });

  it("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ icon: "🎸" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when color is not a valid hex code", async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Bad Color", color: "red" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 when a category with the same name already exists for this user", async () => {
    await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Duplicate" });

    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Duplicate" });

    expect(res.status).toBe(409);
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app).post(BASE).send({ name: "Test" });
    expect(res.status).toBe(401);
  });

});

// ---------------------------------------------------------------------------
// PATCH /api/v1/categories/:id
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/categories/:id", () => {

  let categoryId;

  beforeEach(async () => {
    const res = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Original Name", color: "#AABBCC" });
    categoryId = res.body.data.id;
  });

  it("returns 200 with updated fields", async () => {
    const res = await request(app)
      .patch(`${BASE}/${categoryId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated Name" });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Updated Name");
    // color was not sent — should be unchanged
    expect(res.body.data.color).toBe("#AABBCC");
  });

  it("returns 400 when the request body is empty", async () => {
    const res = await request(app)
      .patch(`${BASE}/${categoryId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("returns 403 when attempting to modify a system category", async () => {
    // Fetch a system category id
    const listRes = await request(app)
      .get(BASE)
      .set("Authorization", `Bearer ${token}`);
    const systemCat = listRes.body.data.find((c) => c.owner_id === null);

    const res = await request(app)
      .patch(`${BASE}/${systemCat.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Hacked" });

    expect(res.status).toBe(403);
  });

  it("returns 403 when attempting to modify another user's category", async () => {
    const otherToken = await getToken({ email: "other@example.com" });
    const otherRes = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ name: "Other's Category" });
    const otherId = otherRes.body.data.id;

    const res = await request(app)
      .patch(`${BASE}/${otherId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Stolen" });

    expect(res.status).toBe(403);
  });

  it("returns 404 for a non-existent category", async () => {
    const res = await request(app)
      .patch(`${BASE}/00000000-0000-0000-0000-000000000000`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Ghost" });

    expect(res.status).toBe(404);
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app)
      .patch(`${BASE}/${categoryId}`)
      .send({ name: "Unauthed" });
    expect(res.status).toBe(401);
  });

});

// ---------------------------------------------------------------------------
// DELETE /api/v1/categories/:id
// ---------------------------------------------------------------------------

describe("DELETE /api/v1/categories/:id", () => {

  it("returns 200 and the category no longer appears in the list", async () => {
    const created = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "To Delete" });
    const id = created.body.data.id;

    const deleteRes = await request(app)
      .delete(`${BASE}/${id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    const listRes = await request(app)
      .get(BASE)
      .set("Authorization", `Bearer ${token}`);
    const names = listRes.body.data.map((c) => c.name);
    expect(names).not.toContain("To Delete");
  });

  it("nullifies category_id on related expenses instead of blocking deletion", async () => {
    // Create a category and an expense using it
    const catRes = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Temporary Category" });
    const catId = catRes.body.data.id;

    const expRes = await request(app)
      .post("/api/v1/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 10, date: "2026-03-15", category_id: catId });
    const expenseId = expRes.body.data.id;

    // Delete the category
    const deleteRes = await request(app)
      .delete(`${BASE}/${catId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);

    // Expense should still exist with category_id nulled out
    const expGetRes = await request(app)
      .get(`/api/v1/expenses/${expenseId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(expGetRes.status).toBe(200);
    expect(expGetRes.body.data.category_id).toBeNull();
  });

  it("returns 403 when attempting to delete a system category", async () => {
    const listRes = await request(app)
      .get(BASE)
      .set("Authorization", `Bearer ${token}`);
    const systemCat = listRes.body.data.find((c) => c.owner_id === null);

    const res = await request(app)
      .delete(`${BASE}/${systemCat.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("returns 403 when attempting to delete another user's category", async () => {
    const otherToken = await getToken({ email: "other@example.com" });
    const otherRes = await request(app)
      .post(BASE)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ name: "Other's Category" });
    const otherId = otherRes.body.data.id;

    const res = await request(app)
      .delete(`${BASE}/${otherId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("returns 404 for a non-existent category", async () => {
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
