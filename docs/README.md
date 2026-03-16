# Expense Tracker API

A SaaS-style personal expense tracking backend built with Node.js, Express, and PostgreSQL. Demonstrates production-grade REST API architecture including JWT authentication, layered service design, Zod validation, structured error handling, and a full integration test suite.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | Express 5 |
| Database | PostgreSQL 16 |
| Authentication | JSON Web Tokens (JWT) |
| Validation | Zod |
| Testing | Jest + Supertest (90 integration tests) |

## Prerequisites

- Node.js 20+
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
JWT_SECRET=replace-with-a-long-random-string
```

**3. Create the database**

```bash
createdb expense_tracker
```

Or create it via pgAdmin: right-click Databases → Create → Database → name it `expense_tracker`.

**4. Run migrations**

Run each file in order using psql or pgAdmin's Query Tool:

```bash
psql postgresql://localhost:5432/expense_tracker -f migrations/001_enable_extensions.sql
psql postgresql://localhost:5432/expense_tracker -f migrations/002_create_users.sql
psql postgresql://localhost:5432/expense_tracker -f migrations/003_create_refresh_tokens.sql
psql postgresql://localhost:5432/expense_tracker -f migrations/004_create_categories.sql
psql postgresql://localhost:5432/expense_tracker -f migrations/005_create_expenses.sql
psql postgresql://localhost:5432/expense_tracker -f migrations/006_create_budgets.sql
psql postgresql://localhost:5432/expense_tracker -f migrations/007_add_budgets_unique_constraints.sql
```

**5. Start the server**

```bash
npm run dev   # development (nodemon)
npm start     # production
```

The server starts on `http://localhost:3000` by default.

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

---

### Authentication

#### `POST /auth/register`
Create a new user account.

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
Authenticate and receive an access token.

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
| `from` | `YYYY-MM-DD` | — | Start of date range |
| `to` | `YYYY-MM-DD` | — | End of date range |
| `category_id` | UUID | — | Filter by category |
| `sort` | string | `date:desc` | e.g. `date:desc,amount:asc` |

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
Fetch a single expense by ID. Returns `404` if not found or not owned by the caller.

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

`icon` and `color` are optional. `color` must be a valid hex code (e.g. `#FF5733`).

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

`period` must be `"monthly"` or `"yearly"`. Only one budget per user per category per period is allowed (returns `409` on duplicate).

**Response `201`:** Returns the created budget object.

---

#### `PATCH /budgets/:id` *(auth required)*
Update a budget. All fields optional; at least one required.

**Response `200`:** Returns the updated budget object.

---

#### `DELETE /budgets/:id` *(auth required)*
Delete a budget. Returns `404` if not found.

**Response `200`:**
```json
{ "success": true }
```

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
│   │   ├── errorHandler.js     # Central error handler (AppError, Zod, JWT, pg)
│   │   └── validate.js         # Zod validation middleware factory
│   ├── modules/
│   │   ├── auth/               # register, login, me
│   │   ├── expenses/           # Full CRUD with pagination, filtering, budget status
│   │   ├── categories/         # System defaults + user custom categories
│   │   ├── budgets/            # CRUD + budget check hook
│   │   └── reports/            # Planned — Week 4
│   └── utils/
│       ├── AppError.js         # Custom operational error class
│       └── asyncHandler.js     # Wraps async controllers to forward errors to Express
├── migrations/
│   ├── 001_enable_extensions.sql
│   ├── 002_create_users.sql
│   ├── 003_create_refresh_tokens.sql
│   ├── 004_create_categories.sql       # Includes 10 system default categories
│   ├── 005_create_expenses.sql
│   ├── 006_create_budgets.sql
│   └── 007_add_budgets_unique_constraints.sql
├── tests/
│   ├── integration/            # Jest + Supertest tests (90 tests across 4 suites)
│   ├── helpers/                # Shared test utilities
│   └── setup/                  # globalSetup — runs migrations before test suite
├── docs/
│   ├── SPEC.md                 # Full software specification
│   ├── ARCHITECTURE.md         # Layer design and responsibilities
│   ├── ROADMAP.md              # Development stages
│   └── AI_CONTEXT.md           # AI development context
├── server.js                   # Entry point — listen, graceful shutdown
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
Services        — all business logic, ownership checks, error throwing
    ↓
Repositories    — all SQL, parameterised queries only, return plain objects
    ↓
PostgreSQL
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Secret for signing JWTs (use 256-bit random string) |
| `JWT_EXPIRY` | No | `15m` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRY_DAYS` | No | `7` | Refresh token lifetime in days |
| `PORT` | No | `3000` | HTTP port |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `COOKIE_SECRET` | No | — | Cookie signing secret (required for refresh token feature) |
