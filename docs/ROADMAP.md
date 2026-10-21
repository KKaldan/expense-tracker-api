# Development Roadmap

Organised chronologically by development week. `docs/SPEC.md` §8 groups the same work by component as Phases 1–7: Weeks 1–4 delivered Phases 1–6 (scaffold, auth, categories, expenses, budgets, reports), Week 5 is Phase 7, and Week 6 is a post-launch audit.

---

## Week 1 — Foundation ✅

- Project scaffold: Express server, PostgreSQL connection, environment config
- Auth module: register, login, JWT middleware, `GET /auth/me`
- Expenses module: create, list, delete
- Layered architecture: Routes → Controllers → Services → Repositories
- Database migrations: users, refresh_tokens, categories (with system defaults), expenses, budgets
- Error handling: `AppError` class, `asyncHandler` utility

---

## Week 2 — API Hardening ✅

- `PATCH /expenses/:id` — partial update with ownership check
- `GET /expenses/:id` — single expense fetch
- `GET /expenses` — pagination, date range filter, category filter, multi-column sort
- Zod validation on all write endpoints and query parameters
- `validate` middleware factory for request bodies (query params are parsed in controllers — Express 5's `req.query` can't be reassigned)
- Central `errorHandler` middleware (AppError, Zod, JWT, pg errors, unexpected bugs)
- 404 handler for unmatched routes
- `asyncHandler` wired into all routes
- `env.js` — validated environment config, single source of truth for all `process.env` access
- Startup checks: env validation, database connection test
- Graceful shutdown: drains pg pool on `SIGTERM`/`SIGINT`

---

## Week 3 — Categories, Budgets & Auth Hardening ✅

- Categories module: list (system + user), create, update, delete custom categories
- System categories (owner_id = NULL) are read-only for all users
- Budgets module: create, list, update, delete
- Unique constraint on (owner_id, category_id, period) via partial indexes to handle NULL category
- Budget check hook in expense service: warns on create/update if a budget is exceeded
- Response envelope includes `budget_status: none | ok | warning | exceeded`
- `POST /auth/refresh` — single-use refresh token rotation; new access token + new cookie issued
- `POST /auth/logout` — revokes refresh token in DB and clears cookie
- Refresh tokens stored as SHA-256 hashes (raw token never persisted)
- JWT payload standardised to `{ id, email }` — `req.user.id` and `req.user.email` available everywhere
- Migration 008: `updated_at` trigger added to `users` table
- Integration tests: 97 tests across 4 suites (auth, expenses, categories, budgets)

---

## Week 4 — Reports & Analytics ✅

- `GET /reports/summary` — total spend, count, daily average for a date range
- `GET /reports/by-category` — spend and percentage share per category
- `GET /reports/monthly-trend` — month-by-month totals with configurable lookback window
- All report queries use single-pass SQL aggregation (no N+1 patterns)
- `from`/`to` optional (default to current calendar month); `months` param 1–24 (default 6)
- Integration tests: 30 tests, 127 total across 5 suites — all passing

---

## Week 5 — Security & Production Hardening ✅

- `helmet` — security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- CORS — `CORS_ORIGIN` allowlist env var; `credentials: true` for the refresh-token cookie
- Rate limiting — `express-rate-limit` on `/api/v1/auth` (10 req/min per IP, skipped in test env)
- Docker — `Dockerfile` (node:24-alpine, `NODE_ENV=production`, non-root user) + `docker-compose.yml` (api + postgres:16-alpine)
- Migration tracking — `scripts/migrate.js` with a `schema_migrations` table, safe to re-run on every container start
- CI/CD — GitHub Actions (`.github/workflows/ci.yml`): runs the full Jest suite against a Postgres service container on every push/PR to main

---

## Week 6 — Audit, Bug Fixes & Hardening ✅

A full review of the codebase, probing the API with hostile inputs as well as reading the code.

**Bugs fixed**
- Cross-user data leak: expenses and budgets accepted another user's `category_id`, and `by-category` reports exposed that category's name. Now rejected with `422 INVALID_CATEGORY`; the report join is owner-filtered as defence in depth
- `500`s on bad input: malformed UUIDs, nonexistent foreign keys, and impossible dates (`2026-02-31`) now return `400` / `422`

**Correctness**
- Zod 4 had silently dropped the `required_error` / `invalid_type_error` options — custom messages restored via the `error` option
- Emails trimmed and lowercased on register/login
- `updateExpense` no longer crashes if the row disappears between check and write

**Hardening**
- JWT verification pinned to HS256; `JWT_SECRET` must be 32+ characters
- `TRUST_PROXY` setting so rate limiting sees real client IPs behind a proxy
- pg pool idle-client errors logged instead of crashing the process
- Expired refresh tokens pruned on login
- Refresh-token reuse detection with token families (migration 010) — a replayed token revokes that one session
- Docker Compose forces `NODE_ENV=production`

Integration tests: 154 across 6 suites — all passing

---

## Future

- Frontend dashboard (React)
