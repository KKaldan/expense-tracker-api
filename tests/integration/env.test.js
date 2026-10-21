const path = require("path");
const { spawnSync } = require("child_process");

// env.js validates at import time and calls process.exit(1) on failure, so
// it's exercised in a child process rather than required into Jest.
function loadEnvWith(overrides) {
  return spawnSync(process.execPath, ["-e", "require('./src/config/env')"], {
    cwd: path.resolve(__dirname, "../.."),
    env: { ...process.env, ...overrides },
    encoding: "utf8",
  });
}

describe("environment validation", () => {

  it("starts with a valid configuration", () => {
    const result = loadEnvWith({});
    expect(result.status).toBe(0);
  });

  it("refuses to start when JWT_SECRET is shorter than 32 characters", () => {
    const result = loadEnvWith({ JWT_SECRET: "too-short" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("JWT_SECRET must be at least 32 characters");
  });

  it("refuses to start when JWT_SECRET is the .env.example placeholder", () => {
    const result = loadEnvWith({ JWT_SECRET: "replace-with-256-bit-random-secret" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("JWT_SECRET is still the .env.example placeholder");
  });

});
