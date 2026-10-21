# ExpenseTracker API — Software Specification

> **Version:** 1.0 &nbsp;·&nbsp; **Status:** Complete &nbsp;·&nbsp; **Prepared:** March 11, 2026

| | |
|---|---|
| **Tech Stack** | Node.js · Express · PostgreSQL · JWT |
| **Architecture** | REST API · Layered MVC · Repository Pattern |
| **Auth Strategy** | Access Token (15 min) + Refresh Token (7 days, httpOnly cookie) |
| **Target Scale** | Single-user SaaS — extensible to multi-tenant |

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Core Features](#2-core-features)
3. [Database Schema](#3-database-schema)
4. [API Endpoints](#4-api-endpoints)
5. [Authentication Flow](#5-authentication-flow)
6. [Project Architecture](#6-project-architecture)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Recommended Build Order](#8-recommended-build-order)

---

## 1. System Overview

ExpenseTracker is a SaaS-style backend REST API enabling individual users to record, categorise, and analyse personal financial expenditure. The system enforces per-user data isolation, provides flexible budget controls, and exposes aggregation endpoints designed to power rich client dashboards.

### 1.1 Design Principles

- **Security-first** — all resources are scoped to the authenticated user; cross-user data leakage is architecturally impossible.
- **Layered architecture** — strict `Routes → Controllers → Services → Repositories` separation prevents coupling and makes unit testing trivial.
- **Money is exact** — amounts stored as `NUMERIC(12,2)`, never floating-point.
- **Forward-compatible schema** — `owner_id` foreign-key pattern enables future multi-tenancy with no breaking changes.
- **Fail-safe budget checks** — budget overages surface as warnings in the response body; they never block write operations.

### 1.2 Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Node.js 24 LTS | LTS support; non-blocking I/O ideal for API workloads |
| Framework | Express 5 | Minimal, composable; vast middleware ecosystem |
| Database | PostgreSQL 16 | ACID guarantees; `NUMERIC` type; powerful aggregation |
| Auth | jsonwebtoken | Stateless access tokens paired with rotating refresh tokens |
| Validation | Zod | Schema validation with precise, field-level error messages |
| Testing | Jest + Supertest | Unit + integration coverage; first-class Express support |
| Migrations | Raw SQL files | Full control; reproducible; zero ORM abstraction leakage |

---

## 2. Core Features

### 2.1 Authentication & Session Management

- User registration with email and bcrypt-hashed password (cost factor 12); emails are trimmed and lowercased so addresses differing only by case are one account; names are trimmed
- Passwords are 8 characters to 72 bytes — bcrypt ignores anything past 72 bytes, so longer passwords are rejected at registration rather than silently truncated
- Login issues a short-lived access token (15 min) and a long-lived `httpOnly` refresh token (7 days)
- Single-use refresh token rotation on every `/auth/refresh` call, with reuse detection: replaying an already-used token revokes that login session (token family) — see §5.4
- Logout revokes the refresh token in the database and clears the cookie
- JWT middleware guards all resource endpoints; token passed as `Authorization: Bearer`

### 2.2 Expense Management

- Full CRUD: create, read (single + paginated list), partial update (`PATCH`), delete
- List endpoint supports pagination, ISO 8601 date-range filtering, category filter, and multi-column sort
- `amount` must fit `NUMERIC(12,2)` — positive, at most 2 decimal places, at most `9999999999.99` — and is rejected with `400` otherwise, never rounded (also applies to budgets)
- `currency` must be three letters (upper-cased on write); defaults to `GBP`
- `date` field is `DATE` (user intent), not a server timestamp; it must be a real calendar date
- List results always end with `id` as a sort tiebreaker, so pagination is stable when rows tie on the requested sort
- Invalid query parameters (`page`, `limit`, and report `months`) are rejected with `400`, never silently replaced by defaults
- `category_id` must be a system category or one of the user's own — anything else is rejected with `422 INVALID_CATEGORY` (also applies to budgets)
- Deleting a category sets `category_id = NULL` on linked expenses rather than cascade-deleting them

### 2.3 Category Management

- System default categories (`owner_id = NULL`) are visible to all users without duplication
- Users can create, rename, and delete their own custom categories
- Partial unique indexes prevent duplicate category names — one across system categories, one per user; names are trimmed first, so surrounding whitespace can't create a near-duplicate

### 2.4 Budget Controls

- Budgets scoped per `(user, optional category, period)`; period is `monthly` or `yearly`
- `NULL category_id` = a global spending cap across all categories
- Budget evaluation runs inside the expense service on every create/update
- Response envelope includes `budget_status: none | ok | warning | exceeded` — write always succeeds

### 2.5 Reports & Analytics

- **Summary** — total spend, expense count, and daily average for any date range
- **By-category** — spend and percentage share per category for a date range
- **Monthly trend** — configurable lookback window (default 6 months) with month-over-month delta
- All report endpoints execute a single aggregated SQL query — no N+1 patterns
- Amounts are summed without currency conversion; reports and budget checks assume each user records expenses in a single currency
- "Current month" (report defaults, the monthly-trend window) is computed in UTC, independent of the database time zone

---

## 3. Database Schema

All primary keys are `UUID` (`gen_random_uuid()`). Mutable tables carry both `created_at` and `updated_at TIMESTAMPTZ` columns defaulting to `NOW()`.

### 3.1 `users`

| Column | Type | Null? | Notes |
|---|---|---|---|
| `id` | `UUID` | NO | Primary key — `gen_random_uuid()` |
| `email` | `TEXT` | NO | Unique login identifier |
| `password` | `TEXT` | NO | bcrypt hash, cost factor 12 — never logged |
| `name` | `TEXT` | NO | Display name |
| `created_at` | `TIMESTAMPTZ` | NO | `DEFAULT NOW()` |
| `updated_at` | `TIMESTAMPTZ` | NO | `DEFAULT NOW()`, maintained by trigger |

### 3.2 `refresh_tokens`

| Column | Type | Null? | Notes |
|---|---|---|---|
| `id` | `UUID` | NO | Primary key |
| `user_id` | `UUID` | NO | FK → `users(id)` ON DELETE CASCADE |
| `family_id` | `UUID` | NO | Shared by every token rotated from one login; indexed. Reuse detection revokes by family |
| `token_hash` | `TEXT` | NO | SHA-256 of the raw token — raw value never stored |
| `expires_at` | `TIMESTAMPTZ` | NO | `NOW() + 7 days` at issue time |
| `revoked` | `BOOLEAN` | NO | `DEFAULT FALSE`; set `TRUE` on rotation or logout |
| `created_at` | `TIMESTAMPTZ` | NO | `DEFAULT NOW()` |

### 3.3 `categories`

| Column | Type | Null? | Notes |
|---|---|---|---|
| `id` | `UUID` | NO | Primary key |
| `owner_id` | `UUID` | YES | FK → `users(id)` ON DELETE CASCADE; `NULL` = system default |
| `name` | `TEXT` | NO | Unique per owner — partial indexes on `(name) WHERE owner_id IS NULL` and `(owner_id, name) WHERE owner_id IS NOT NULL` |
| `icon` | `TEXT` | YES | Emoji or icon identifier for client UI |
| `color` | `TEXT` | YES | Hex colour string e.g. `#27AE60` |
| `created_at` | `TIMESTAMPTZ` | NO | `DEFAULT NOW()` |
| `updated_at` | `TIMESTAMPTZ` | NO | `DEFAULT NOW()`, maintained by trigger |

### 3.4 `expenses`

| Column | Type | Null? | Notes |
|---|---|---|---|
| `id` | `UUID` | NO | Primary key |
| `owner_id` | `UUID` | NO | FK → `users(id)` ON DELETE CASCADE |
| `category_id` | `UUID` | YES | FK → `categories(id)` ON DELETE SET NULL |
| `amount` | `NUMERIC(12,2)` | NO | `CHECK (amount > 0)` — never `FLOAT` |
| `currency` | `CHAR(3)` | NO | ISO 4217 code; `DEFAULT 'GBP'` |
| `description` | `TEXT` | YES | Free-text note |
| `date` | `DATE` | NO | User-supplied expenditure date |
| `created_at` | `TIMESTAMPTZ` | NO | `DEFAULT NOW()` |
| `updated_at` | `TIMESTAMPTZ` | NO | `DEFAULT NOW()`, maintained by trigger |

### 3.5 `budgets`

| Column | Type | Null? | Notes |
|---|---|---|---|
| `id` | `UUID` | NO | Primary key |
| `owner_id` | `UUID` | NO | FK → `users(id)` ON DELETE CASCADE |
| `category_id` | `UUID` | YES | FK → `categories(id)` ON DELETE CASCADE; `NULL` = global cap |
| `amount` | `NUMERIC(12,2)` | NO | `CHECK (amount > 0)` |
| `period` | `TEXT` | NO | `CHECK (period IN ('monthly','yearly'))` |
| `created_at` | `TIMESTAMPTZ` | NO | `DEFAULT NOW()` |
| `updated_at` | `TIMESTAMPTZ` | NO | `DEFAULT NOW()`, maintained by trigger |

### 3.6 Indexes

```sql
CREATE INDEX idx_expenses_owner_date  ON expenses(owner_id, date DESC);
CREATE INDEX idx_expenses_owner_cat   ON expenses(owner_id, category_id);
CREATE INDEX idx_budgets_owner        ON budgets(owner_id);
CREATE INDEX idx_refresh_tokens_hash  ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);
```

---

## 4. API Endpoints

**Base path:** `/api/v1`

Authenticated endpoints require `Authorization: Bearer <access_token>`.

**Success envelope:**
```json
{ "success": true, "data": { } }
```
**Error envelope:**
```json
{ "success": false, "error": { "code": "...", "message": "..." } }
```

### 4.1 Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | None | Create a new user account |
| `POST` | `/auth/login` | None | Authenticate; receive access + refresh tokens |
| `POST` | `/auth/refresh` | Cookie | Rotate refresh token; issue new access token |
| `POST` | `/auth/logout` | Required | Revoke refresh token; clear cookie |
| `GET` | `/auth/me` | Required | Return authenticated user profile |

### 4.2 Expenses

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/expenses` | Required | Paginated list with filters and sorting |
| `POST` | `/expenses` | Required | Create a new expense record |
| `GET` | `/expenses/:id` | Required | Fetch a single expense by UUID |
| `PATCH` | `/expenses/:id` | Required | Partially update an expense |
| `DELETE` | `/expenses/:id` | Required | Delete an expense record |

**`GET /expenses` query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `page` | integer | Page number (default: `1`) |
| `limit` | integer | Results per page (default: `20`, max: `100`) |
| `from` | ISO 8601 date | Start of date range filter; must be on or before `to` |
| `to` | ISO 8601 date | End of date range filter |
| `category_id` | UUID | Filter by category |
| `sort` | string | e.g. `date:desc,amount:asc` |

### 4.3 Categories

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/categories` | Required | List system defaults + user custom categories |
| `POST` | `/categories` | Required | Create a custom category |
| `PATCH` | `/categories/:id` | Required | Update own custom category |
| `DELETE` | `/categories/:id` | Required | Delete own custom category |

### 4.4 Budgets

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/budgets` | Required | List all budgets for the authenticated user |
| `POST` | `/budgets` | Required | Create a budget for a category + period |
| `PATCH` | `/budgets/:id` | Required | Update budget amount, period, or category |
| `DELETE` | `/budgets/:id` | Required | Delete a budget |

### 4.5 Reports

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/reports/summary` | Required | Total spend, count, daily average for a date range |
| `GET` | `/reports/by-category` | Required | Spend + percentage share per category |
| `GET` | `/reports/monthly-trend` | Required | Month-by-month totals (default 6-month window) |

---

## 5. Authentication Flow

### 5.1 Token Architecture

| Token | Lifetime | Transport | Client Storage |
|---|---|---|---|
| Access Token | 15 minutes | `Authorization: Bearer` header | In-memory only |
| Refresh Token | 7 days | `httpOnly` cookie | `httpOnly; SameSite=Strict`; `Secure` in production |

### 5.2 Registration

1. Client `POST`s `{ email, name, password }` to `/auth/register`
2. Zod validates schema — returns `400` with field-level errors on failure
3. Email uniqueness checked — returns `409 Conflict` if duplicate
4. Password hashed with bcrypt (cost 12) — plaintext never persisted or logged
5. `201` response returns user profile (no tokens issued at registration stage)

### 5.3 Login

1. Client `POST`s `{ email, password }` to `/auth/login`
2. User fetched by email — `401` returned if not found (no account enumeration)
3. `bcrypt.compare` validates password — `401` returned on mismatch
4. Access token signed HS256 (`JWT_SECRET`, 15m expiry)
5. Refresh token generated via `crypto.randomBytes(64)`, SHA-256 hashed, hash stored in `refresh_tokens`
6. `200` response: access token in JSON body; raw refresh token set as `httpOnly` cookie

### 5.4 Token Rotation

1. Client `POST`s to `/auth/refresh` — browser sends cookie automatically
2. Server reads cookie and hashes the raw token
3. One SQL statement revokes the old token (only where the hash matches, `revoked = FALSE` and `expires_at > NOW()`) and inserts its successor in the same family — concurrent requests cannot both consume the same token, and the successor exists the instant the old token is revoked
4. If no row was consumed: when the token exists, is revoked, and has not expired, it is being **replayed** — every live token in its family is revoked (that session ends; the user's other sessions are untouched) and a warning is logged. Either way the response is `401`
5. Otherwise a new access token is issued and the cookie replaced with the successor

Each login starts a new family. Clients must not run refreshes concurrently (e.g. coordinate across tabs with the Web Locks API): a concurrent duplicate looks identical to a replay and ends the session.

### 5.5 `authenticate` Middleware

```
1. Extract token from "Authorization: Bearer <token>" header
2. jwt.verify(token, JWT_SECRET) — throws TokenExpiredError or JsonWebTokenError
3. Attach decoded payload → req.user = { id, email, iat, exp }
4. next()  —or—  return 401 with header: WWW-Authenticate: Bearer error="invalid_token"
```

All 401 responses from authenticated endpoints include the `WWW-Authenticate: Bearer error="invalid_token"` header (per RFC 6750).

---

## 6. Project Architecture

### 6.1 Directory Structure

```
expense-tracker-api/
├── src/
│   ├── config/
│   │   ├── db.js                  # pg Pool singleton
│   │   └── env.js                 # Validated env vars — no raw process.env access elsewhere
│   ├── modules/
│   │   ├── auth/                  # auth.routes · auth.controller · auth.service · auth.repository · auth.schema
│   │   ├── expenses/              # expenses.routes · expenses.controller · expenses.service · expenses.repository · expenses.schema
│   │   ├── categories/            # categories.routes · categories.controller · categories.service · categories.repository · categories.schema
│   │   ├── budgets/               # budgets.routes · budgets.controller · budgets.service · budgets.repository · budgets.schema
│   │   └── reports/               # reports.routes · reports.controller · reports.service · reports.schema (no repository)
│   ├── middleware/
│   │   ├── auth.middleware.js     # JWT verification; sets req.user = { id, email, iat, exp }
│   │   ├── validate.js            # Zod schema validation factory
│   │   ├── rateLimiter.js         # express-rate-limit config for /auth/*
│   │   └── errorHandler.js        # Central 4-arg error handler
│   ├── utils/
│   │   ├── AppError.js            # Custom error class with statusCode
│   │   ├── amount.js              # Shared Zod schema for NUMERIC(12,2) amounts
│   │   ├── asyncHandler.js        # Eliminates try/catch boilerplate in controllers
│   │   └── isoDate.js             # Shared Zod schema for real calendar dates
│   └── app.js                     # Express wiring — no listen() call
├── tests/
│   ├── integration/               # Jest + Supertest (173 tests across 6 suites)
│   ├── helpers/                   # Shared test utilities
│   └── setup/                     # globalSetup — resets the schema and runs migrations
├── migrations/
│   ├── 001_enable_extensions.sql
│   ├── 002_create_users.sql
│   ├── 003_create_refresh_tokens.sql
│   ├── 004_create_categories.sql
│   ├── 005_create_expenses.sql
│   ├── 006_create_budgets.sql
│   ├── 007_add_budgets_unique_constraints.sql
│   ├── 008_add_users_updated_at_trigger.sql
│   ├── 009_users_timestamps_not_null.sql
│   └── 010_add_refresh_token_families.sql
├── scripts/
│   └── migrate.js                 # Applies pending migrations; tracked in schema_migrations
├── docs/
├── .github/workflows/ci.yml       # Runs the test suite on every push/PR to main
├── Dockerfile
├── docker-compose.yml             # api + postgres, healthcheck-gated
├── .env.example
├── .env.test.example
└── server.js                      # Entry point — app.listen() lives here only
```

### 6.2 Layer Responsibilities

| Layer | File Pattern | Responsibility |
|---|---|---|
| Routes | `*.routes.js` | Mount middleware; wire controller methods to HTTP verbs and paths. No logic. |
| Controllers | `*.controller.js` | Parse req/res; call services; return HTTP status + JSON envelope. No SQL. |
| Services | `*.service.js` | All business logic: budget checks, aggregation rules, cross-entity validation. |
| Repositories | `*.repository.js` | All SQL: parameterised queries only; return plain JS objects to services. |

### 6.3 Error Handling

- All controllers wrapped with `asyncHandler(fn)` — uncaught rejections forwarded to Express error handler automatically
- `new AppError(message, statusCode)` used for all expected failures: `400`, `401`, `403`, `404`, `409`, `422`
- Central `errorHandler.js` distinguishes operational `AppError` instances from unexpected bugs
- Unexpected errors return `500` with a generic message in every environment; stack traces are only logged server-side
- Zod validation failures mapped to `400` with structured field-level error detail
- Request bodies that aren't valid JSON return `400 BAD_REQUEST`; bodies over 100kb return `413 PAYLOAD_TOO_LARGE`
- Known PostgreSQL errors are mapped instead of surfacing as `500`: `23505` → `409 CONFLICT`, `23503` → `422 INVALID_REFERENCE`, `22P02` / `22008` / `22003` / `23514` → `400 BAD_REQUEST`

### 6.4 Environment Variables

```env
NODE_ENV=development

# Server
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/expense_tracker

# JWT — 32+ characters; startup fails on shorter values or this placeholder
JWT_SECRET=replace-with-256-bit-random-secret
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY_DAYS=7

# CORS — comma-separated list of allowed browser origins
CORS_ORIGIN=http://localhost:3000

# Reverse proxies in front of the API (0 = none) — lets rate limiting see real client IPs
TRUST_PROXY=0
```

---

## 7. Non-Functional Requirements

### 7.1 Security

- Passwords hashed with bcrypt cost factor 12 — plaintext never stored, logged, or returned
- All SQL uses parameterised queries — SQL injection is architecturally prevented
- Rate limiting on `/auth/*` endpoints (recommended: 10 req/min per IP via `express-rate-limit`)
- CORS configured to whitelist approved origins only
- `Helmet.js` sets security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- Refresh tokens stored as SHA-256 hashes — token theft from DB does not yield usable tokens
- Access tokens verified with the algorithm pinned to `HS256`; `JWT_SECRET` must be at least 32 characters
- Cross-user references are rejected in the service layer (e.g. another user's `category_id`), not just hidden on read

### 7.2 Reliability

- `pg` Pool with max 10 connections; connection errors surfaced at startup, not silently at runtime; idle-client errors are logged rather than crashing the process
- Migrations are version-numbered (`001_`, `002_`, ...) and recorded in a `schema_migrations` table, so each is applied exactly once — safe to run on every deploy
- Graceful shutdown: `SIGTERM` stops accepting connections, drains pg pool, then exits

### 7.3 Performance

- Report endpoints use single-pass SQL aggregations — no application-level loops or N+1 queries
- Compound indexes on `(owner_id, date)` and `(owner_id, category_id)` cover the primary access patterns
- Pagination enforced on the expenses list, the only collection that grows without bound; categories and budgets are small per user and returned whole. Every list query is scoped to the user, so no endpoint scans other users' rows
- Connection pooling via `node-postgres` Pool — no per-request TCP connections

### 7.4 Testability

- `app.js` and `server.js` are separated — Jest imports the Express app without binding a port
- Integration tests exercise every endpoint end-to-end against a dedicated test database
- The test schema is rebuilt from the migrations before each run; user data is cleared between tests

---

## 8. Recommended Build Order

Follow this sequence to keep each layer independently testable before the next is built on top of it.

| Phase | Deliverable | Key Outputs |
|---|---|---|
| 1 | Project scaffold | `app.js`, `server.js`, env config, pg Pool, `errorHandler`, `asyncHandler` |
| 2 | Auth module | `register`, `login`, `refresh`, `logout` endpoints + `authenticate` middleware |
| 3 | Categories module | CRUD + seed migration for system default categories |
| 4 | Expenses module | CRUD with pagination, date range filter, category filter, sorting |
| 5 | Budgets module | CRUD + budget-check hook inside the expense service layer |
| 6 | Reports module | `summary`, `by-category`, and `monthly-trend` aggregation endpoints |
| 7 | Security & production hardening | `helmet`, CORS allowlist, auth rate limiting, Docker, CI pipeline |

Integration tests are written alongside each phase rather than as a separate final step.
