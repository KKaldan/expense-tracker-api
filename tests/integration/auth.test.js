const request = require("supertest");
const app = require("../../src/app");
const { truncateTables } = require("../db");
const { registerUser, loginUser, getToken, DEFAULT_USER } = require("../helpers/auth.helpers");

beforeEach(async () => {
  await truncateTables();
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/register
// ---------------------------------------------------------------------------

describe("POST /api/v1/auth/register", () => {

  it("returns 201 with user data on valid registration", async () => {
    const res = await registerUser();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(DEFAULT_USER.email);
    expect(res.body.data.name).toBe(DEFAULT_USER.name);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.created_at).toBeDefined();
  });

  it("never returns the password in the response", async () => {
    const res = await registerUser();
    expect(res.body.data.password).toBeUndefined();
  });

  it("returns 409 when email is already registered", async () => {
    await registerUser();
    const res = await registerUser();

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("returns 400 with validation detail on invalid email", async () => {
    const res = await registerUser({ email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "email" }),
      ])
    );
  });

  it("returns 400 when password is shorter than 8 characters", async () => {
    const res = await registerUser({ password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "password" }),
      ])
    );
  });

  it("returns 400 when name is shorter than 2 characters", async () => {
    const res = await registerUser({ name: "A" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/login
// ---------------------------------------------------------------------------

describe("POST /api/v1/auth/login", () => {

  beforeEach(async () => {
    await registerUser();
  });

  it("returns 200 with a token and user data on valid credentials", async () => {
    const res = await loginUser();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(typeof res.body.data.token).toBe("string");
    expect(res.body.data.user.email).toBe(DEFAULT_USER.email);
  });

  it("never returns the password in the login response", async () => {
    const res = await loginUser();
    expect(res.body.data.user.password).toBeUndefined();
  });

  it("returns 401 on wrong password", async () => {
    const res = await loginUser({ password: "wrongpassword" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 401 on unknown email (no account enumeration)", async () => {
    const res = await loginUser({ email: "nobody@example.com" });

    // Same 401 as wrong password — must not reveal whether the account exists
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 when fields are missing", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

});

// ---------------------------------------------------------------------------
// GET /api/v1/auth/me
// ---------------------------------------------------------------------------

describe("GET /api/v1/auth/me", () => {

  it("returns 200 with user payload for a valid token", async () => {
    const token = await getToken();
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBeDefined();
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app).get("/api/v1/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 401 for a malformed token", async () => {
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer this.is.not.a.valid.token");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 401 when the Authorization header is missing the Bearer prefix", async () => {
    const token = await getToken();
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", token);

    expect(res.status).toBe(401);
  });

});
