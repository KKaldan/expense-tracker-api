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

Phases 1–6 are complete. The codebase is clean, tested, and reviewed.

### ✅ Complete

| Module | Key details |
|---|---|
| Project scaffold | `app.js`, `server.js`, `src/config/db.js`, `src/config/env.js` (Zod-validated) |
| Auth | register, login, refresh, logout, GET /me — full two-token architecture |
| Categories | System defaults (owner_id=NULL) + user custom CRUD |
| Expenses | Full CRUD — pagination, date-range filter, category filter, multi-column sort, budget_status |
| Budgets | Full CRUD + non-blocking budget-check hook on expense create/update |
| Reports | `summary`, `by-category`, `monthly-trend` — single-pass SQL aggregations, no repository layer |
| Migrations | 001–008 applied (008 = users updated_at trigger) |
| Tests | 121 integration tests across 5 suites — all passing |

### ⬜ Next — Phase 7: Security & Production Hardening

| Task | Detail |
|---|---|
| `helmet` | Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| CORS | Whitelist approved origins; required for any browser client |
| Rate limiting | `express-rate-limit` on `/auth/*` — 10 req/min per IP |
| Docker | `Dockerfile` + `docker-compose.yml` — API + PostgreSQL, runnable with one command |
| CI/CD | GitHub Actions — run test suite on every push to main |

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
