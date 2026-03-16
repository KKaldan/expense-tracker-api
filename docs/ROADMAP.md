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

## Week 3 — Categories & Budgets

- Categories module: list (system + user), create, update, delete custom categories
- Budgets module: create, list, update, delete
- Budget check hook in expense service: warns on create/update if a budget is exceeded
- Response envelope includes `budget_status: ok | warning | exceeded`

---

## Week 4 — Reports & Analytics

- `GET /reports/summary` — total spend, count, daily average for a date range
- `GET /reports/by-category` — spend and percentage share per category
- `GET /reports/monthly-trend` — month-by-month totals with configurable lookback window
- All report queries use single-pass SQL aggregation (no N+1 patterns)

---

## Future

- Test suite: Jest unit tests for all services, Supertest integration tests for all endpoints
- Rate limiting on auth endpoints (`express-rate-limit`)
- Security headers (`helmet`)
- CORS configuration
- Refresh token rotation (`POST /auth/refresh`, `POST /auth/logout`)
- Docker containerisation
- CI/CD pipeline
- Frontend dashboard (React)
