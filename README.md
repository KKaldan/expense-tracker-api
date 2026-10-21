# Expense Tracker API

A SaaS-style personal expense tracking backend built with Node.js, Express, and PostgreSQL. Demonstrates production-grade REST API architecture including JWT authentication, layered service design, Zod validation, structured error handling, and a full integration test suite.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 LTS |
| Framework | Express 5 |
| Database | PostgreSQL 16 |
| Authentication | JSON Web Tokens (JWT) |
| Validation | Zod |
| Testing | Jest + Supertest (173 integration tests) |

## Prerequisites

- Node.js 24+
- PostgreSQL 16+

## Local Setup

**1. Clone and install dependencies**

```bash
git clone <repo-url>
cd expense-tracker-api
npm install
```

**2. Configure environment variables**

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/expense_tracker
JWT_SECRET=replace-with-256-bit-random-secret
```

Replace `JWT_SECRET` with 32+ random characters (e.g. `openssl rand -hex 32`) — startup fails on shorter values or this placeholder.

**3. Create the database**

```bash
createdb expense_tracker
```

Or create it via pgAdmin: right-click Databases → Create → Database → name it `expense_tracker`.

**4. Run migrations**

```bash
npm run migrate
```

This applies each file in `migrations/` in order and records progress in a `schema_migrations` table, so it's safe to run again on an already-migrated database — already-applied files are skipped.

**5. Start the server**

```bash
npm run dev   # development (nodemon)
npm start     # production
```

The server starts on `http://localhost:3000` by default.

---

## Running with Docker

Requires Docker and Docker Compose.

```bash
cp .env.example .env
# set JWT_SECRET to 32+ random characters — the placeholder is rejected at startup.
# DATABASE_URL and NODE_ENV are overridden by docker-compose for the api container.

docker compose up --build
```

This starts a `postgres:16-alpine` container and the API container. The API container waits for Postgres to report healthy, runs `npm run migrate`, then starts the server on `http://localhost:3000`. The container always runs with `NODE_ENV=production` (so the refresh-token cookie is `Secure`), whatever `.env` says.

---

## Running Tests

The test suite runs integration tests against a real PostgreSQL test database. Migrations are applied automatically before the suite runs.

```bash
cp .env.test.example .env.test
# Fill in your test database credentials (use a separate DB from development)

npm test           # run all tests
npm run test:watch # watch mode
```

---

## API Reference

**Base URL:** `http://localhost:3000/api/v1`

All authenticated endpoints require:
```
Authorization: Bearer <access_token>
```

**Success response envelope:**
```json
{ "success": true, "data": {} }
```

**Error response envelope:**
```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Description" } }
```

**Error codes:**

| Status | `code` | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Body or query failed validation — adds a `details` array of `{ field, message }` |
| `400` | `BAD_REQUEST` | Request body isn't valid JSON, or a value the database can't accept (e.g. a malformed UUID in the URL) |
| `401` | `UNAUTHORIZED` · `TOKEN_EXPIRED` · `INVALID_TOKEN` | Missing, expired, or invalid credentials (always sent with a `WWW-Authenticate` header) |
| `403` | `FORBIDDEN` | Modifying or deleting a system category |
| `403` | `CORS_NOT_ALLOWED` | Browser origin not in `CORS_ORIGIN` |
| `404` | `NOT_FOUND` | Resource doesn't exist *or* belongs to another user (deliberately indistinguishable), or unknown route |
| `409` | `CONFLICT` | Duplicate email, category name, or budget |
| `413` | `PAYLOAD_TOO_LARGE` | Request body over 100kb |
| `422` | `INVALID_CATEGORY` | `category_id` is neither a system category nor one of yours |
| `422` | `INVALID_REFERENCE` | A referenced record was deleted mid-request (rare) |
| `429` | `TOO_MANY_REQUESTS` | Auth rate limit hit (10 requests/min per IP) |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected bug — details are logged server-side, never returned |

---

### Health Check

#### `GET /health`
Liveness probe, mounted at the root (not under `/api/v1`) and unauthenticated.

**Response `200`:**
```json
{ "status": "ok" }
```

---

### Authentication

#### `POST /auth/register`
Create a new user account. Emails are trimmed and lowercased on register and login, so `Jane@Example.com` and `jane@example.com` are the same account. `name` is trimmed and must be at least 2 characters. `password` must be at least 8 characters and at most 72 bytes (bcrypt's limit — emoji and other multi-byte characters count for more than one).

**Request body:**
```json
{
  "email": "user@example.com",
  "name": "Jane Smith",
  "password": "securepassword"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Jane Smith",
    "created_at": "2026-03-16T10:00:00Z"
  }
}
```

---

#### `POST /auth/login`
Authenticate and receive an access token. A refresh token is also set as an `httpOnly` cookie (`refresh_token`, 7-day lifetime).

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "user": { "id": "uuid", "email": "user@example.com", "name": "Jane Smith" }
  }
}
```

---

#### `POST /auth/refresh`
Exchange the `refresh_token` cookie for a new access token. The refresh token is single-use: it is revoked and a new one is set in its place. Returns `401` if the cookie is missing, invalid, expired, or already used.

Presenting an already-used token is treated as theft: that login session is revoked entirely (other devices stay signed in). Clients should therefore never run two refreshes at once — coordinate across tabs, e.g. with the Web Locks API.

**Response `200`:**
```json
{
  "success": true,
  "data": { "token": "<jwt>" }
}
```

---

#### `POST /auth/logout` *(auth required)*
Revoke the current refresh token and clear the `refresh_token` cookie. Succeeds even if the cookie is missing or already revoked.

**Response `200`:**
```json
{ "success": true }
```

---

#### `GET /auth/me` *(auth required)*
Return the authenticated user's profile from the database.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Jane Smith",
    "created_at": "2026-03-16T10:00:00Z"
  }
}
```

---

### Expenses

#### `POST /expenses` *(auth required)*
Create a new expense.

**Request body:**
```json
{
  "amount": 42.50,
  "date": "2026-03-15",
  "description": "Team lunch",
  "currency": "GBP",
  "category_id": "uuid-or-omit"
}
```

`amount` must be greater than 0, have at most 2 decimal places, and be no more than `9999999999.99`. `currency` is optional (default `GBP`), must be three letters, and is stored upper-cased. `date` must be a real calendar date (`2026-02-31` is rejected). `category_id`, if given, must be a system category or one of your own — otherwise `422 INVALID_CATEGORY`.

**Response `201`:** Returns the created expense object including `budget_status`.

| `budget_status` | Meaning |
|---|---|
| `none` | No budget covers this expense |
| `ok` | Under 80% of the applicable budget |
| `warning` | Between 80% and 100% of the budget |
| `exceeded` | Over budget |

---

#### `GET /expenses` *(auth required)*
Paginated list with optional filters.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Results per page (max 100) |
| `from` | `YYYY-MM-DD` | — | Start of date range; must be on or before `to` |
| `to` | `YYYY-MM-DD` | — | End of date range |
| `category_id` | UUID | — | Filter by category |
| `sort` | string | `date:desc` | e.g. `date:desc,amount:asc` |

Omitted parameters take their defaults; an invalid `page` or `limit` (e.g. `limit=500`, `page=0`) returns `400 VALIDATION_ERROR` rather than being silently replaced.

**Response `200`:**
```json
{
  "success": true,
  "data": [ { "id": "uuid", "amount": "42.50", "date": "2026-03-15", ... } ],
  "meta": { "page": 1, "limit": 20, "total": 47, "total_pages": 3 }
}
```

---

#### `GET /expenses/:id` *(auth required)*
Fetch a single expense by ID. Returns `404` if not found or not owned by the caller, `400` if the ID isn't a valid UUID (the same applies to every `/:id` route).

---

#### `PATCH /expenses/:id` *(auth required)*
Partially update an expense. All fields optional; at least one required.

**Request body:**
```json
{
  "amount": 55.00,
  "description": "Updated description"
}
```

**Response `200`:** Returns the updated expense object including `budget_status`.

---

#### `DELETE /expenses/:id` *(auth required)*
Delete an expense. Returns `404` if not found.

**Response `200`:**
```json
{ "success": true }
```

---

### Categories

#### `GET /categories` *(auth required)*
List all categories available to the user: system defaults (visible to all) and their own custom categories.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    { "id": "uuid", "owner_id": null, "name": "Food & Drink", "icon": "🍔", "color": "#E74C3C", ... },
    { "id": "uuid", "owner_id": "user-uuid", "name": "My Category", "icon": null, "color": null, ... }
  ]
}
```

System categories have `owner_id: null`. User categories have `owner_id` set to the creator's ID.

---

#### `POST /categories` *(auth required)*
Create a custom category.

**Request body:**
```json
{
  "name": "Hobbies",
  "icon": "🎸",
  "color": "#FF5733"
}
```

`name` is trimmed, so `"Hobbies "` is the same name as `"Hobbies"` (`409` if it already exists). `icon` and `color` are optional. `color` must be a valid hex code (e.g. `#FF5733`).

**Response `201`:** Returns the created category object.

---

#### `PATCH /categories/:id` *(auth required)*
Update a custom category. All fields optional; at least one required. Returns `403` for system categories, `404` for another user's categories.

---

#### `DELETE /categories/:id` *(auth required)*
Delete a custom category. Any expenses referencing it will have their `category_id` set to `null`. Returns `403` for system categories.

---

### Budgets

#### `GET /budgets` *(auth required)*
List all budgets belonging to the authenticated user.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    { "id": "uuid", "amount": "500.00", "period": "monthly", "category_id": null, ... },
    { "id": "uuid", "amount": "200.00", "period": "monthly", "category_id": "uuid", ... }
  ]
}
```

A budget with `category_id: null` is a global budget covering all spending. A budget with a `category_id` applies only to that category.

---

#### `POST /budgets` *(auth required)*
Create a budget.

**Request body:**
```json
{
  "amount": 500,
  "period": "monthly",
  "category_id": "uuid-or-omit"
}
```

`amount` follows the same rules as on expenses. `period` must be `"monthly"` or `"yearly"`. Only one budget per user per category per period is allowed (returns `409` on duplicate). `category_id` follows the same rule as on expenses (`422 INVALID_CATEGORY` if it isn't yours).

**Response `201`:** Returns the created budget object.

---

#### `PATCH /budgets/:id` *(auth required)*
Update a budget's `amount`, `period`, or `category_id`. All fields optional; at least one required.

**Response `200`:** Returns the updated budget object.

---

#### `DELETE /budgets/:id` *(auth required)*
Delete a budget. Returns `404` if not found.

**Response `200`:**
```json
{ "success": true }
```

---

### Reports

`summary` and `by-category` accept optional `from` / `to` date parameters (`YYYY-MM-DD`). When omitted, they default to the current calendar month. `from` must be on or before `to`.

"Current month" — the default range here and the end of the `monthly-trend` window — is the current month in UTC, so in the first hour of a month during BST, UK users still see the previous month.

Amounts are summed as stored, without currency conversion — reports (and budget checks) assume a user records expenses in one currency.

#### `GET /reports/summary` *(auth required)*
Total spend, expense count, and daily average for a date range.

**Query parameters:** `from`, `to` (optional — default: current month)

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "from": "2026-06-01",
    "to": "2026-06-30",
    "expense_count": 12,
    "total_spend": "234.50",
    "daily_average": "7.82"
  }
}
```

---

#### `GET /reports/by-category` *(auth required)*
Spend and percentage share per category for a date range. Results ordered by spend descending. Expenses with no category appear with `category_id: null`.

**Query parameters:** `from`, `to` (optional — default: current month)

**Response `200`:**
```json
{
  "success": true,
  "data": [
    { "category_id": "uuid", "category_name": "Food & Drink", "total_spend": "150.00", "percentage": "64.00" },
    { "category_id": null,   "category_name": null,           "total_spend": "84.50",  "percentage": "36.00" }
  ]
}
```

---

#### `GET /reports/monthly-trend` *(auth required)*
Month-by-month totals for a configurable lookback window ending with the current month. All months in the window are returned even if spend is zero.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `months` | integer | `6` | Lookback window in months (1–24); out-of-range or non-numeric values return `400` |

**Response `200`:**
```json
{
  "success": true,
  "data": [
    { "month": "2026-01", "total_spend": "120.00", "expense_count": 4, "delta": null },
    { "month": "2026-02", "total_spend": "95.00",  "expense_count": 3, "delta": "-25.00" },
    { "month": "2026-03", "total_spend": "200.00", "expense_count": 7, "delta": "105.00" }
  ]
}
```

`delta` is the difference from the previous month (`null` for the first entry in the window).

---

## Project Structure

```
expense-tracker-api/
├── src/
│   ├── config/
│   │   ├── db.js               # PostgreSQL pool with startup connection check
│   │   └── env.js              # Validated environment config — single source of truth
│   ├── middleware/
│   │   ├── auth.middleware.js  # JWT verification, sets req.user
│   │   ├── errorHandler.js     # Central error handler (AppError, Zod, JWT, body parsing, pg)
│   │   ├── rateLimiter.js      # express-rate-limit config — mounted on /api/v1/auth
│   │   └── validate.js         # Zod validation middleware factory
│   ├── modules/
│   │   ├── auth/               # register, login, refresh, logout, me
│   │   ├── expenses/           # Full CRUD with pagination, filtering, budget status
│   │   ├── categories/         # System defaults + user custom categories
│   │   ├── budgets/            # CRUD + budget check hook
│   │   └── reports/            # summary, by-category, monthly-trend
│   ├── utils/
│   │   ├── AppError.js         # Custom operational error class
│   │   ├── amount.js           # Shared Zod schema for NUMERIC(12,2) money amounts
│   │   ├── asyncHandler.js     # Wraps async controllers to forward errors to Express
│   │   └── isoDate.js          # Shared Zod schema for real YYYY-MM-DD calendar dates
│   └── app.js                  # Express wiring — middleware, routes, error handler (no listen())
├── scripts/
│   └── migrate.js              # Applies pending migrations; tracked via schema_migrations table
├── migrations/
│   ├── 001_enable_extensions.sql
│   ├── 002_create_users.sql
│   ├── 003_create_refresh_tokens.sql
│   ├── 004_create_categories.sql       # Includes 10 system default categories
│   ├── 005_create_expenses.sql
│   ├── 006_create_budgets.sql
│   ├── 007_add_budgets_unique_constraints.sql
│   ├── 008_add_users_updated_at_trigger.sql
│   ├── 009_users_timestamps_not_null.sql
│   └── 010_add_refresh_token_families.sql
├── tests/
│   ├── integration/            # Jest + Supertest tests (173 tests across 6 suites)
│   ├── helpers/                # Shared test utilities
│   └── setup/                  # globalSetup — resets the schema and runs migrations
├── docs/
│   ├── SPEC.md                 # Full software specification
│   ├── ARCHITECTURE.md         # Layer design and responsibilities
│   ├── ROADMAP.md              # Development stages
│   └── AI_CONTEXT.md           # AI development context
├── server.js                   # Entry point — listen, graceful shutdown
├── Dockerfile
├── docker-compose.yml          # api + postgres:16-alpine, healthcheck-gated
├── .github/workflows/ci.yml    # Runs Jest suite against a Postgres service container
├── .env.example
├── .env.test.example
└── package.json
```

## Architecture

The project follows a strict layered pattern. Each layer has one responsibility and never reaches past its neighbour.

```
HTTP Request
    ↓
Routes          — mount middleware, map HTTP verbs to controllers
    ↓
Middleware      — authenticate, validate (Zod), asyncHandler
    ↓
Controllers     — parse req/res, call service, return JSON envelope
    ↓
Services        — all business logic, cross-entity rules, error throwing
    ↓
Repositories    — all SQL, parameterised queries only, ownership enforced in the query itself
    ↓
PostgreSQL
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Secret for signing JWTs — at least 32 characters; startup fails otherwise (e.g. `openssl rand -hex 32`) |
| `JWT_EXPIRY` | No | `15m` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRY_DAYS` | No | `7` | Refresh token lifetime in days |
| `PORT` | No | `3000` | HTTP port |
| `NODE_ENV` | No | `development` | `development`, `production`, or `test` — any other value fails startup |
| `CORS_ORIGIN` | No | `http://localhost:3000` | Comma-separated list of allowed browser origins. Set it to your frontend's origin (e.g. `http://localhost:5173` for a Vite dev server) — the default is the API's own port, so a separate frontend is rejected with `403 CORS_NOT_ALLOWED` |
| `TRUST_PROXY` | No | `0` | Number of reverse proxies in front of the API, so rate limiting sees real client IPs. Leave at `0` unless deployed behind a proxy |
