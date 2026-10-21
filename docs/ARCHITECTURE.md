# Backend Architecture

This project follows a strict layered backend architecture. Each layer has one responsibility and no knowledge of the layers above it.

---

## Request Flow

```
HTTP Request
      │
      ▼
┌──────────────┐
│    Routes    │  Mount middleware. Wire HTTP verbs to controller methods. No logic.
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Middleware  │  authenticate · validate (Zod) · asyncHandler
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Controllers │  Parse req/res. Call one service method. Return HTTP status + JSON envelope.
└──────┬───────┘  No SQL. No business logic. Always wrapped with asyncHandler().
       │
       ▼
┌──────────────┐
│   Services   │  All business logic. Budget checks. Cross-entity rules. Aggregation logic.
└──────┬───────┘  No req/res knowledge. No SQL. Throws AppError on rule violations.
       │
       ▼
┌──────────────┐
│ Repositories │  All SQL. Parameterised queries only. Returns plain JS objects.
└──────────────┘  No business logic. No AppError — let pg errors bubble to the service.
```

**Rule:** a layer may only call the layer directly below it. Controllers never call repositories. Services never call another module's repository.

**Exception:** the reports module has no repository — its service runs aggregation queries directly via the shared db pool, as the queries don't map to the CRUD repository pattern.

---

## Layer Responsibilities

| Layer | File | Responsibility |
|---|---|---|
| Routes | `*.routes.js` | Mount middleware; map HTTP verbs to controllers |
| Controllers | `*.controller.js` | Parse req/res; call services; return JSON envelope |
| Services | `*.service.js` | All business logic — ownership checks, budget rules, error throwing |
| Repositories | `*.repository.js` | All SQL — parameterised queries only; return plain objects |

---

## Middleware Stack

Registered in `app.js` in this order (after `app.set("trust proxy", TRUST_PROXY)`, which controls whether `req.ip` — and so the rate limiter — reads `X-Forwarded-For`; default `0` trusts no proxy):

1. `helmet()` — security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
2. `cors(corsOptions)` — origin allowlist checked against `CORS_ORIGIN`; `credentials: true`
3. `express.json()` — parse request bodies
4. `cookie-parser` — parse cookies (required for refresh token reads)
5. Routes (`/api/v1/auth`, `/api/v1/expenses`, etc.) — `authRateLimiter` is mounted specifically on `/api/v1/auth`, ahead of the auth router
6. 404 handler — catches unmatched routes
7. `errorHandler` — central 4-arg error handler (must be last)

Per-route middleware applied inside route files:

- `authenticate` (`src/middleware/auth.middleware.js`) — verifies JWT (algorithm pinned to HS256), populates `req.user = { id, email, iat, exp }`
- `validate(schema)` (`src/middleware/validate.js`) — Zod schema validation factory; replaces `req.body` with the parsed output on success

`authRateLimiter` (`src/middleware/rateLimiter.js`) is not referenced inside `auth.routes.js` — it's mounted in `app.js` ahead of the auth router (see step 5 above), scoped to the `/api/v1/auth` path prefix. 10 req/min per IP; skipped when `NODE_ENV=test`.

---

## Database

PostgreSQL 16. All primary keys are UUID (`gen_random_uuid()`). Monetary amounts use `NUMERIC(12,2)` — never float.

### Tables

| Table | Purpose |
|---|---|
| `users` | Account credentials and profile |
| `refresh_tokens` | Rotating refresh tokens stored as SHA-256 hashes |
| `categories` | System defaults (`owner_id = NULL`) and user custom categories |
| `expenses` | Financial records belonging to a user |
| `budgets` | Spending caps scoped per user, optional category, and period |

### Foreign Key Behaviour

| Relationship | On Delete |
|---|---|
| `expenses.owner_id` → `users` | CASCADE |
| `expenses.category_id` → `categories` | **SET NULL** — expenses are preserved when a category is deleted |
| `categories.owner_id` → `users` | CASCADE |
| `budgets.owner_id` → `users` | CASCADE |
| `budgets.category_id` → `categories` | CASCADE |
| `refresh_tokens.user_id` → `users` | CASCADE |

### Indexes

```sql
CREATE INDEX idx_expenses_owner_date  ON expenses(owner_id, date DESC);
CREATE INDEX idx_expenses_owner_cat   ON expenses(owner_id, category_id);
CREATE INDEX idx_budgets_owner        ON budgets(owner_id);
CREATE INDEX idx_refresh_tokens_hash  ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);
```

Unique constraints on `categories` and `budgets` use partial indexes (not standard UNIQUE) because `NULL != NULL` in SQL — a standard unique constraint cannot enforce uniqueness when `owner_id` or `category_id` is NULL.

---

## Authentication

Two-token strategy — short-lived access tokens paired with rotating refresh tokens.

| Token | Lifetime | Transport | Storage |
|---|---|---|---|
| Access token | 15 min | `Authorization: Bearer` header | Client memory only |
| Refresh token | 7 days | `httpOnly` cookie | `SameSite=Strict`; `Secure` in production |

**Refresh token security:** raw token generated via `crypto.randomBytes(64)`, SHA-256 hashed before DB storage. A database breach yields only hashes — no usable tokens.

**Single-use rotation:** every `POST /auth/refresh` revokes the old token and issues a successor in one SQL statement (`UPDATE ... RETURNING` feeding an `INSERT`), so even simultaneous requests with the same token cannot both succeed.

**Reuse detection (token families):** every token rotated from one login shares a `family_id`. If a revoked-but-unexpired token is presented, a copy of it exists — the server can't tell thief from owner, so it revokes the whole family. Whoever holds the current token is logged out of that session; the user's other sessions (other families) are untouched. Because the successor is inserted in the same statement that revokes its parent, a concurrent replay can never revoke the family before the successor exists. Trade-off: a client that fires two refreshes at once looks like a replay and loses the session — clients must serialise refreshes (e.g. Web Locks API across tabs). No grace window is used, as it would reopen the window an attacker needs.

`req.user` shape after `authenticate` middleware: `{ id, email, iat, exp }`

---

## Error Handling

```
Controller (wrapped by asyncHandler)
    │  throws AppError or unknown Error
    ▼
errorHandler.js (central 4-arg Express handler)
    ├── AppError (isOperational)  → err.statusCode + err.code + err.message
    ├── ZodError                  → 400 VALIDATION_ERROR + details array
    ├── TokenExpiredError         → 401 TOKEN_EXPIRED
    ├── JsonWebTokenError         → 401 INVALID_TOKEN
    ├── entity.parse.failed       → 400 BAD_REQUEST        (body isn't valid JSON)
    ├── entity.too.large          → 413 PAYLOAD_TOO_LARGE  (body over express.json's 100kb limit)
    ├── pg error 23505            → 409 CONFLICT           (unique violation)
    ├── pg error 23503            → 422 INVALID_REFERENCE  (FK violation — backstop)
    ├── pg error 22P02 / 22008    → 400 BAD_REQUEST        (malformed UUID / date — backstop)
    ├── pg error 22003 / 23514    → 400 BAD_REQUEST        (numeric overflow / CHECK violation — backstop)
    └── Unknown                   → 500 INTERNAL_SERVER_ERROR (logged server-side; never sent to client)
```

The pg mappings are backstops. Services validate first — e.g. `assertCategoryUsable()` in `categories.service.js` rejects a `category_id` the user can't use with `422 INVALID_CATEGORY` before any write, the shared `isoDate()` schema (`src/utils/isoDate.js`) rejects impossible dates at validation time, and the shared `amount()` schema (`src/utils/amount.js`) rejects amounts that don't fit `NUMERIC(12,2)`.

---

## HTTP Response Envelope

Every endpoint returns one of these two shapes. No exceptions.

**Success:**
```json
{ "success": true, "data": { } }
```

**Error:**
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Expense not found" } }
```

**Validation error** (400 only — adds `details`):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "email", "message": "Must be a valid email address" }
    ]
  }
}
```

---

## Reports Module

The reports module follows a simplified pattern — no repository layer.

```
reports.routes.js  →  reports.controller.js  →  reports.service.js  →  db pool (direct)
```

All three endpoints execute a single aggregated SQL query each. No N+1 patterns.

| Endpoint | SQL technique |
|---|---|
| `GET /reports/summary` | `COUNT` / `SUM` / `ROUND` — divides by days in range for daily average |
| `GET /reports/by-category` | `SUM(...) OVER ()` window function for percentage share in one pass |
| `GET /reports/monthly-trend` | `generate_series` CTE ensures all months appear; `LAG()` window function for delta |

Query parameters for `summary` and `by-category` are validated in the controller via `schema.parse(req.query)` — Express 5 makes `req.query` a computed getter that cannot be reassigned, so the `validate` middleware only works for `body`.
