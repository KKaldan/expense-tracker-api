const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../src/app");
const { db, truncateTables } = require("../db");
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

  it("stores the email lowercased and trimmed", async () => {
    const res = await registerUser({ email: "  Mixed.Case@Example.COM " });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe("mixed.case@example.com");
  });

  it("returns 409 when the email differs from an existing one only by case", async () => {
    await registerUser();
    const res = await registerUser({ email: DEFAULT_USER.email.toUpperCase() });

    expect(res.status).toBe(409);
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

  it("accepts a password of exactly 72 bytes", async () => {
    const res = await registerUser({ password: "a".repeat(72) });
    expect(res.status).toBe(201);
  });

  it("returns 400 when password is longer than 72 bytes", async () => {
    const res = await registerUser({ password: "a".repeat(73) });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: "password", message: "Password must be 72 bytes or fewer" },
    ]);
  });

  it("counts password length in bytes, not characters", async () => {
    // 19 emoji = 38 UTF-16 characters but 76 UTF-8 bytes
    const res = await registerUser({ password: "🔒".repeat(19) });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: "password", message: "Password must be 72 bytes or fewer" },
    ]);
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

  it("logs in when the email is typed with different case", async () => {
    const res = await loginUser({ email: DEFAULT_USER.email.toUpperCase() });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(DEFAULT_USER.email);
  });

  it("deletes the user's expired refresh tokens but keeps revoked unexpired ones", async () => {
    const { rows: [user] } = await db.query("SELECT id FROM users WHERE email = $1", [DEFAULT_USER.email]);
    await db.query(
      `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at, revoked) VALUES
         ($1, gen_random_uuid(), 'expired-hash', NOW() - INTERVAL '1 day', FALSE),
         ($1, gen_random_uuid(), 'revoked-hash', NOW() + INTERVAL '1 day', TRUE)`,
      [user.id]
    );

    await loginUser();

    const { rows } = await db.query(
      "SELECT token_hash FROM refresh_tokens WHERE token_hash IN ('expired-hash', 'revoked-hash')"
    );
    expect(rows.map((r) => r.token_hash)).toEqual(["revoked-hash"]);
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
// POST /api/v1/auth/refresh
// ---------------------------------------------------------------------------

describe("POST /api/v1/auth/refresh", () => {

  function refreshCookie(res) {
    return res.headers["set-cookie"].find((c) => c.startsWith("refresh_token="));
  }

  beforeEach(async () => {
    await registerUser();
    // Reuse detection logs a warning; keep test output clean and let tests assert on it.
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    console.warn.mockRestore();
  });

  it("returns 200 with a new access token and rotates the refresh token cookie", async () => {
    const loginRes = await loginUser();
    const cookie = loginRes.headers["set-cookie"].find((c) => c.startsWith("refresh_token="));

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(typeof res.body.data.token).toBe("string");

    // A new refresh_token cookie should be issued
    const newCookie = res.headers["set-cookie"]?.find((c) => c.startsWith("refresh_token="));
    expect(newCookie).toBeDefined();
  });

  it("returns 401 when no refresh token cookie is provided", async () => {
    const res = await request(app).post("/api/v1/auth/refresh");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 401 for an invalid refresh token", async () => {
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", "refresh_token=notavalidtoken");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("refresh token is single-use — second use of the same token returns 401", async () => {
    const loginRes = await loginUser();
    const cookie = loginRes.headers["set-cookie"].find((c) => c.startsWith("refresh_token="));

    // First use — should succeed
    await request(app).post("/api/v1/auth/refresh").set("Cookie", cookie);

    // Second use of the same token — must be rejected
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookie);

    expect(res.status).toBe(401);
  });

  it("refresh token is single-use under concurrency — only one of several simultaneous refreshes succeeds", async () => {
    const loginRes = await loginUser();
    const cookie = loginRes.headers["set-cookie"].find((c) => c.startsWith("refresh_token="));

    // Fire every request before any completes — a check-then-revoke
    // implementation lets more than one pass the "not revoked" check.
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app).post("/api/v1/auth/refresh").set("Cookie", cookie)
      )
    );

    const successes = results.filter((r) => r.status === 200);
    expect(successes).toHaveLength(1);

    // The losers are replays of a rotated token, so reuse detection must
    // also revoke the token the winner was just issued. Note: this only
    // catches a non-atomic rotation (successor inserted in a separate query)
    // when a loser lands inside that gap, which in-process requests rarely
    // do — the real guarantee is the single-statement rotateRefreshToken().
    const winnerCookie = refreshCookie(successes[0]);
    const followUp = await request(app).post("/api/v1/auth/refresh").set("Cookie", winnerCookie);
    expect(followUp.status).toBe(401);
  });

  it("replaying a rotated token revokes the token it was rotated into", async () => {
    const original = refreshCookie(await loginUser());
    const rotated = refreshCookie(
      await request(app).post("/api/v1/auth/refresh").set("Cookie", original)
    );

    // Attacker (or anyone) replays the already-used original token
    const replay = await request(app).post("/api/v1/auth/refresh").set("Cookie", original);
    expect(replay.status).toBe(401);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("reuse detected"));

    // The legitimate holder's current token is now dead too
    const res = await request(app).post("/api/v1/auth/refresh").set("Cookie", rotated);
    expect(res.status).toBe(401);
  });

  it("reuse detection leaves the user's other sessions untouched", async () => {
    const laptop = refreshCookie(await loginUser());
    const phone = refreshCookie(await loginUser());

    await request(app).post("/api/v1/auth/refresh").set("Cookie", laptop);
    await request(app).post("/api/v1/auth/refresh").set("Cookie", laptop); // replay → laptop session revoked

    const res = await request(app).post("/api/v1/auth/refresh").set("Cookie", phone);
    expect(res.status).toBe(200);
  });

});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/logout
// ---------------------------------------------------------------------------

describe("POST /api/v1/auth/logout", () => {

  beforeEach(async () => {
    await registerUser();
  });

  it("returns 200 and clears the refresh token cookie", async () => {
    const loginRes = await loginUser();
    const token = loginRes.body.data.token;
    const cookie = loginRes.headers["set-cookie"].find((c) => c.startsWith("refresh_token="));

    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${token}`)
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // The Set-Cookie header should clear the refresh_token cookie
    const clearedCookie = res.headers["set-cookie"]?.find((c) => c.startsWith("refresh_token="));
    expect(clearedCookie).toBeDefined();
  });

  it("revokes the refresh token so it cannot be used after logout", async () => {
    const loginRes = await loginUser();
    const token = loginRes.body.data.token;
    const cookie = loginRes.headers["set-cookie"].find((c) => c.startsWith("refresh_token="));

    // Logout
    await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${token}`)
      .set("Cookie", cookie);

    // Attempt to use the revoked refresh token
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookie);

    expect(res.status).toBe(401);
  });

  it("returns 401 when no access token is provided", async () => {
    const res = await request(app).post("/api/v1/auth/logout");

    expect(res.status).toBe(401);
  });

});

// ---------------------------------------------------------------------------
// GET /api/v1/auth/me
// ---------------------------------------------------------------------------

describe("GET /api/v1/auth/me", () => {

  it("returns 200 with the user's profile for a valid token", async () => {
    const token = await getToken();
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.email).toBe(DEFAULT_USER.email);
    expect(res.body.data.name).toBe(DEFAULT_USER.name);
    expect(res.body.data.created_at).toBeDefined();
    expect(res.body.data.password).toBeUndefined();
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

  it("returns 401 for a token signed with a different algorithm", async () => {
    // Same secret, valid signature — only the algorithm differs. Without
    // algorithm pinning, jsonwebtoken would accept this.
    const forged = jwt.sign(
      { id: "00000000-0000-4000-8000-000000000000", email: DEFAULT_USER.email },
      process.env.JWT_SECRET,
      { algorithm: "HS512" }
    );

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${forged}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });

  it("returns 401 when the Authorization header is missing the Bearer prefix", async () => {
    const token = await getToken();
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", token);

    expect(res.status).toBe(401);
  });

});
