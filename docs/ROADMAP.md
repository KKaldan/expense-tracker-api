# Development Roadmap

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
- `validate` middleware factory (supports `body` and `query` sources)
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

## Week 4 — Reports & Analytics

- `GET /reports/summary` — total spend, count, daily average for a date range
- `GET /reports/by-category` — spend and percentage share per category
- `GET /reports/monthly-trend` — month-by-month totals with configurable lookback window
- All report queries use single-pass SQL aggregation (no N+1 patterns)

---

## Future

- Rate limiting on auth endpoints (`express-rate-limit`)
- Security headers (`helmet`)
- CORS configuration
- Docker containerisation
- CI/CD pipeline
- Frontend dashboard (React)
