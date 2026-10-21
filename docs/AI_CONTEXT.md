# AI Development Context

You are acting as a senior backend engineer on this project.

Your responsibilities:
- Write production-quality, clean, maintainable code
- Follow the architecture and conventions documented here exactly
- Challenge poor ideas, suggest best practices, flag risks
- Do not over-engineer — this is a portfolio-scale project, not a FAANG system

---

## What This Project Is

A SaaS-style personal expense tracker backend REST API.
Node.js + Express 5, PostgreSQL, JWT authentication.
Single-user scope — no teams or tenants.

Full specification: `docs/SPEC.md`
Architecture reference: `docs/ARCHITECTURE.md`

---

## Current State

Phases 1–7 are complete. The codebase is clean, tested, and reviewed.

### ✅ Phases 1–6: Core Backend — Complete

| Module | Key details |
|---|---|
| Project scaffold | `app.js`, `server.js`, `src/config/db.js`, `src/config/env.js` (Zod-validated) |
| Auth | register, login, refresh, logout, GET /me — full two-token architecture |
| Categories | System defaults (owner_id=NULL) + user custom CRUD |
| Expenses | Full CRUD — pagination, date-range filter, category filter, multi-column sort, budget_status |
| Budgets | Full CRUD + non-blocking budget-check hook on expense create/update |
| Reports | `summary`, `by-category`, `monthly-trend` — single-pass SQL aggregations, no repository layer |
| Migrations | 001–010 applied (010 = refresh token families) |
| Tests | 177 integration tests across 6 suites — all passing |
| Spec compliance | `WWW-Authenticate` header on all 401s; `from <= to` validated on `GET /expenses`; error `path` set on date-range refines; `clearCookie` options derived from shared constant |

### ✅ Phase 7: Security & Production Hardening — Complete

| Task | Status | Detail |
|---|---|---|
| `helmet` | ✅ Done | `app.use(helmet())` mounted first in app.js — default preset covers CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| CORS | ✅ Done | `cors` middleware with an `origin` allowlist function checked against `CORS_ORIGIN` (comma-separated env var); `credentials: true` for the refresh-token cookie; rejects with `AppError.forbidden` (403) rather than a raw 500 |
| Rate limiting | ✅ Done | `express-rate-limit` mounted on `/api/v1/auth` — 10 req/min per IP; skipped when `NODE_ENV=test` since the integration suite exceeds that rate by design |
| Docker | ✅ Done | `Dockerfile` (node:24-alpine, `NODE_ENV=production`, non-root user) + `docker-compose.yml` (api + postgres:16-alpine, healthcheck-gated). `scripts/migrate.js` tracks applied migrations in a `schema_migrations` table so `npm run migrate` is safe to re-run on every container start |
| CI/CD | ✅ Done | `.github/workflows/ci.yml` — runs the Jest suite against a `postgres:16-alpine` service container on every push/PR to `main` |

### ✅ Post-Phase-7 Audit — Complete

Bugs, correctness fixes, and hardening from a full review — summarised in `docs/ROADMAP.md` (Week 6); the non-obvious decisions are recorded under Key Implementation Details below.

### Next

No backend phases remain on `docs/ROADMAP.md`. The only outstanding item is a frontend dashboard (React) — a separate, not-yet-started effort. Treat this backend as feature-complete unless the user introduces new scope.

---

## Key Implementation Details

Non-obvious decisions a fresh reader must know — do not re-debate these without a good reason.

**Currency:** Default is `GBP`, not USD. This is intentional — matches the target user, diverges from the spec deliberately. Reports and budget checks sum `amount` without conversion, i.e. they assume one currency per user. Documented, not enforced.

**Category ownership guard:** any write that references a category (expense create/update, budget create/update) calls `assertCategoryUsable(userId, categoryId)` from `categories.service.js` first. It allows system categories and the user's own and throws `422 INVALID_CATEGORY` otherwise — the same error for nonexistent and other-user categories, so IDs can't be probed. It lives in the categories *service* because services must not call another module's repository. The `by-category` report join is also owner-filtered as defence in depth.

**Date validation:** every `YYYY-MM-DD` field uses `isoDate(label)` from `src/utils/isoDate.js` — a regex check (with `abort: true`, so a malformed value yields one error) followed by a real-calendar check. Use it for any new date field rather than a bare regex.

**Amount validation:** every money field uses `amount()` from `src/utils/amount.js` — positive, `multipleOf(0.01)`, max `9999999999.99`, matching `NUMERIC(12,2)`. Without it Postgres rounds `0.001` to `0.00` (failing `CHECK amount > 0`) and overflows on `1e10`, both of which were 500s. Over-precise values are rejected, not rounded — so a JS client sending `0.1 + 0.2` gets a 400, which is deliberate.

**UTC month boundaries:** "current month" (report defaults, the monthly-trend window) is computed in JS with UTC getters. Never use `CURRENT_DATE` / `NOW()` for month boundaries in SQL — they follow the DB session time zone (the dev DB is `Europe/London`), which disagreed with the JS side near month boundaries and gave monthly-trend an extra month.

**Ownership in the write, not a prior read:** updates and deletes of expenses, budgets, and categories filter on `id AND owner_id` in the `UPDATE`/`DELETE` itself; no row back → `404`. Don't reintroduce a read-check-then-write — the row can vanish in between (→ `200` with `data: null`). Categories are the one exception needing a lookup: `owner_id = $user` never matches a system category, so when the write matches nothing, `throwUnwritableCategory()` reads the row to choose `403` (system) vs `404` (missing / another user's). The lookup only runs on the failure path.

**Password length:** register enforces 8 chars min and 72 *bytes* max (`Buffer.byteLength`) — bcrypt silently ignores everything past 72 bytes. Login deliberately has no max: anyone who registered a longer password before the limit still logs in, because bcrypt truncates consistently on hash and compare.

**Query params fail loudly:** `page`, `limit`, `months` use `z.coerce.number()...default(n)` — missing → default, invalid → `400`. Don't use `.catch()`; it silently masked client bugs like `limit=500` → 20. (`.default()` does work with `z.coerce` in Zod 4 — an old comment claiming otherwise was wrong.)

**Stable pagination:** `buildOrderBy()` always appends `id` as a final tiebreaker. Without a unique last key, rows that tie on every sort column have no defined order and LIMIT/OFFSET pages can repeat or skip them.

**Zod 4 error messages:** Zod 4 silently ignores v3's `required_error` / `invalid_type_error`. Use `{ error: (iss) => iss.input === undefined ? "X is required" : "X must be a ..." }`. Check-level messages (`.min(…, { message })`) still work.

**Email normalisation:** the shared `email` schema in `auth.schema.js` trims and lowercases before validating, for both register and login. The DB unique index on `users.email` is case-sensitive, so this normalisation is what prevents case-only duplicates.

**pg error mapping:** `errorHandler.js` maps `23505` → 409, `23503` → 422 `INVALID_REFERENCE`, `22P02`/`22008`/`22003`/`23514` → 400 `BAD_REQUEST` (not `VALIDATION_ERROR`, which promises a `details` array the DB error can't provide). These are backstops — validate in schemas/services first. Body-parser errors from `express.json()` (identified by `err.type`) map to `400 BAD_REQUEST` (invalid JSON) and `413 PAYLOAD_TOO_LARGE` — they're thrown before any route runs, so without this branch they'd be 500s.

**JWT & proxy config:** `jwt.verify` pins `algorithms: ["HS256"]`; `env.js` requires a 32+ char `JWT_SECRET` and rejects the `.env.example` placeholder. `NODE_ENV` is an enum (`development` / `production` / `test`) so a typo fails startup instead of silently dropping the `Secure` cookie flag. `TRUST_PROXY` (default `0`) feeds `app.set("trust proxy")` — only raise it to match the real number of proxies, or clients can spoof their IP past the rate limiter.

**Express 5 / req.query:** Express 5 makes `req.query` a computed getter that cannot be reassigned. The `validate()` middleware factory only works for `req.body`. All query-param validation is done by calling `schema.parse(req.query)` directly inside the controller (which is wrapped in `asyncHandler`, so ZodErrors propagate to the central error handler correctly).

**Sort safety:** `buildOrderBy()` in `expenses.repository.js` uses an allowlist (`Set`) for both column names and directions. Column names can't be parameterised in pg, so the allowlist is the correct SQL-injection defence here. Unrecognised values are silently dropped; an empty result falls back to the default ordering.

**Budget check:** `checkBudgetStatus` iterates both `monthly` and `yearly` periods, fetching all applicable budgets (category-specific + global) for each. Every budget is evaluated independently and the worst severity across all is returned. Severity order: `exceeded > warning > ok > none`. A global cap breach surfaces even when the category budget is fine.

**WWW-Authenticate header:** All 401 responses include `WWW-Authenticate: Bearer error="invalid_token"` (RFC 6750). This is handled centrally in `errorHandler.js` — both `AppError` 401s and raw JWT errors (`TokenExpiredError`, `JsonWebTokenError`) go through the same header-setting logic. Do not replicate this in individual controllers.

**Cookie constants:** `COOKIE_BASE` (httpOnly, secure, sameSite) is shared between `COOKIE_OPTIONS` (set on login/refresh, includes maxAge) and the `clearCookie` call on logout. This prevents the two from drifting apart silently.

**`updated_at` triggers:** All mutable tables (users, categories, expenses, budgets) have a `BEFORE UPDATE` trigger calling `set_updated_at()`. The function is defined in migration 003. Do not add `updated_at = NOW()` to repository UPDATE queries — the trigger handles it.

**pg DATE type parser:** `pg.types.setTypeParser(1082, val => val)` is set in `db.js`. This returns `DATE` columns as `"YYYY-MM-DD"` strings instead of JavaScript `Date` objects. This is critical for the budget period calculations and the `date` field on expenses.

**Test isolation:** `truncateTables()` runs `DELETE FROM users` (not `TRUNCATE CASCADE`) so that the system default categories (owner_id = NULL) survive between tests. TRUNCATE CASCADE would wipe them.

**CORS allowlist:** `CORS_ORIGIN` in `env.js` is a comma-separated string transformed into an array by a Zod `.transform()`. Requests with no `Origin` header (curl, server-to-server, health checks) are always allowed — only browser-sent origins are checked against the list. Rejections throw `AppError.forbidden`, so they go through the normal error envelope instead of an unhandled 500.

**Rate limiter test skip:** `authRateLimiter` (`src/middleware/rateLimiter.js`) checks `env.NODE_ENV === "test"` and no-ops via the `skip` option. The integration suite legitimately calls `/auth/register` and `/auth/login` far more than 10 times/min from one IP; without the skip, the suite would fail on its own traffic, not a real bug.

**Atomic refresh-token rotation + reuse detection:** `rotateRefreshToken()` in `auth.repository.js` revokes the old token and inserts its successor (same `family_id`) in one statement — a CTE `UPDATE ... RETURNING` feeding an `INSERT`. If rotation fails, `revokeFamilyOfReplayedToken()` checks whether the token was revoked-but-unexpired (a replay) and, if so, revokes every live token in its family. Do not split rotation into separate queries: (1) a SELECT-then-UPDATE lets concurrent requests reuse a token; (2) an UPDATE-then-INSERT lets a concurrent replay revoke the family before the successor exists, so the successor survives. (2) was verified empirically — the concurrency test in `auth.test.js` only catches it when a request lands in the gap, so it is not a reliable guard on its own. Families are per login, so a replay ends one session, not all of the user's devices. No grace window, by design. Clients must serialise refreshes.

**Migration tracking:** `scripts/migrate.js` records each applied file in a `schema_migrations` table and skips rows already present. This is what actually makes migrations safe to re-run (the raw SQL files themselves are not idempotent — e.g. `CREATE TABLE` without `IF NOT EXISTS`). Both `npm run migrate` and the `docker-compose.yml` `api` service command run this before starting the server. The Jest suite does not use this script — `tests/setup/globalSetup.js` runs `DROP SCHEMA public CASCADE` and re-applies every migration in filename order instead. It refuses to run unless the database name ends in `_test`, as a guard against wiping a real database.

---

## Architecture

```
Routes → Controllers → Services → Repositories → PostgreSQL
```

- Routes: mount middleware, wire HTTP verbs to controllers. No logic.
- Controllers: parse req/res, call one service method, return JSON envelope. No SQL.
- Services: all business logic. Throws AppError on rule violations. No req/res.
- Repositories: all SQL. Parameterised queries only. Returns plain objects.

The reports module has no repository — its service runs queries directly via the db pool (aggregation queries don't map to the CRUD repository pattern).

**A layer may only call the layer directly below it.**

---

## Conventions

- Module files: `<module>.<layer>.js` — e.g. `expenses.service.js`
- `const` over `let`; `let` only when reassignment is needed
- No default exports except Express routers and the app
- All async functions use `async/await` — no `.then()` chains
- All controllers wrapped with `asyncHandler()` — no bare try/catch in controllers
- Errors thrown as `new AppError(message, statusCode)` or factory methods (`AppError.notFound(...)`)
- No raw `process.env` access outside `src/config/env.js`
- No SQL outside repository files (or reports.service.js)

---

## Auth Details

Two-token strategy:
- **Access token** — JWT, HS256, `{ id, email }` payload, 15m expiry — `Authorization: Bearer` header
- **Refresh token** — `crypto.randomBytes(64)`, SHA-256 hashed before DB storage, 7-day expiry, `httpOnly` cookie

`req.user` after `authenticate` middleware: `{ id, email, iat, exp }`

Refresh tokens are single-use. Every `POST /auth/refresh` revokes the old token and issues a new one.

---

## Response Envelope

Every endpoint returns one of these two shapes — no exceptions.

```json
{ "success": true, "data": { } }
```
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Expense not found" } }
```

Validation errors (400 only) add a `details` array:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "email", "message": "Must be a valid email address" }]
  }
}
```

---

## Test Conventions

- Integration tests in `tests/integration/` — run against a real test database
- Test database schema is rebuilt by `tests/setup/globalSetup.js` before each full run
- Tables are truncated between individual tests via `tests/db.js` `truncateTables()`
- Shared test helpers in `tests/helpers/auth.helpers.js`
- Test files named `<module>.test.js`
