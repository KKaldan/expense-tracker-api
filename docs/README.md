# Expense Tracker API

A SaaS-style personal expense tracking backend built with Node.js, Express, and PostgreSQL. Demonstrates production-grade REST API architecture including JWT authentication, layered service design, Zod validation, and structured error handling.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | Express 5 |
| Database | PostgreSQL 16 |
| Authentication | JSON Web Tokens (JWT) |
| Validation | Zod |
| Testing | Jest + Supertest *(planned)* |

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
```

**5. Start the server**

```bash
npm run dev   # development (nodemon)
npm start     # production
```

The server starts on `http://localhost:3000` by default.

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
Return the authenticated user's profile.

**Response `200`:**
```json
{
  "success": true,
  "data": { "userId": "uuid", "iat": 1234567890, "exp": 1234568790 }
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

**Response `201`:** Returns the created expense object.

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
Fetch a single expense by ID.

**Response `200`:** Returns the expense object, or `404` if not found.

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

**Response `200`:** Returns the updated expense object.

---

#### `DELETE /expenses/:id` *(auth required)*
Delete an expense. Returns `404` if not found.

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
│   │   ├── db.js            # PostgreSQL pool with startup connection check
│   │   └── env.js           # Validated environment config — single source of truth
│   ├── middleware/
│   │   ├── auth.middleware.js  # JWT verification, sets req.user
│   │   ├── errorHandler.js     # Central error handler (AppError, Zod, JWT, pg)
│   │   └── validate.js         # Zod validation middleware factory
│   ├── modules/
│   │   ├── auth/            # register, login, me
│   │   ├── expenses/        # Full CRUD with pagination and filtering
│   │   ├── categories/      # Planned — Week 3
│   │   ├── budgets/         # Planned — Week 3
│   │   └── reports/         # Planned — Week 4
│   └── utils/
│       ├── AppError.js      # Custom operational error class
│       └── asyncHandler.js  # Wraps async controllers to forward errors to Express
├── migrations/
│   ├── 001_enable_extensions.sql
│   ├── 002_create_users.sql
│   ├── 003_create_refresh_tokens.sql
│   ├── 004_create_categories.sql   # Includes 10 system default categories
│   ├── 005_create_expenses.sql
│   └── 006_create_budgets.sql
├── docs/
│   ├── SPEC.md              # Full software specification
│   ├── ARCHITECTURE.md      # Layer design and responsibilities
│   ├── ROADMAP.md           # Development stages
│   └── AI_CONTEXT.md        # AI development context
├── server.js                # Entry point — listen, graceful shutdown
├── .env.example
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
