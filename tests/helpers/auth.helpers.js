const request = require("supertest");
const app = require("../../src/app");

const DEFAULT_USER = {
  email: "test@example.com",
  name: "Test User",
  password: "password123",
};

/**
 * Registers a user. Accepts partial overrides for the default user data.
 * Returns the full supertest response so callers can assert on status/body.
 */
function registerUser(overrides = {}) {
  return request(app)
    .post("/api/v1/auth/register")
    .send({ ...DEFAULT_USER, ...overrides });
}

/**
 * Logs in with the given credentials (defaults to the default test user).
 * Returns the full supertest response.
 */
function loginUser(overrides = {}) {
  return request(app)
    .post("/api/v1/auth/login")
    .send({
      email: DEFAULT_USER.email,
      password: DEFAULT_USER.password,
      ...overrides,
    });
}

/**
 * Registers and logs in a user in one step.
 * Returns the JWT access token string.
 */
async function getToken(overrides = {}) {
  await registerUser(overrides);
  const res = await loginUser({
    email: overrides.email || DEFAULT_USER.email,
    password: overrides.password || DEFAULT_USER.password,
  });
  return res.body.data.token;
}

module.exports = { registerUser, loginUser, getToken, DEFAULT_USER };
