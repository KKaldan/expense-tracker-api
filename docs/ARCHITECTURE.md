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

Registered in `app.js` in this order:

1. `express.json()` — parse request bodies
2. `cookie-parser` — parse cookies (required for refresh token reads)
3. Routes (`/api/v1/auth`, `/api/v1/expenses`, etc.)
4. 404 handler — catches unmatched routes
5. `errorHandler` — central 4-arg error handler (must be last)

Per-route middleware applied inside route files:

- `authenticate` (`src/middleware/auth.middleware.js`) — verifies JWT, populates `req.user = { id, email }`
- `validate(schema)` (`src/middleware/validate.js`) — Zod schema validation factory; replaces `req.body` with the parsed output on success

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
```

Unique constraints on `categories` and `budgets` use partial indexes (not standard UNIQUE) because `NULL != NULL` in SQL — a standard unique constraint cannot enforce uniqueness when `owner_id` or `category_id` is NULL.

---

## Authentication

Two-token strategy — short-lived access tokens paired with rotating refresh tokens.

| Token | Lifetime | Transport | Storage |
|---|---|---|---|
| Access token | 15 min | `Authorization: Bearer` header | Client memory only |
| Refresh token | 7 days | `httpOnly` cookie | `Secure; SameSite=Strict` |

**Refresh token security:** raw token generated via `crypto.randomBytes(64)`, SHA-256 hashed before DB storage. A database breach yields only hashes — no usable tokens.

**Single-use rotation:** every `POST /auth/refresh` immediately revokes the old token and issues a new one. If a stolen token is used first, the legitimate user's next refresh attempt fails (token already revoked).

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
    ├── pg error 23505            → 409 CONFLICT
    └── Unknown                  → 500 INTERNAL_SERVER_ERROR (stack hidden in prod)
```

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

## Planned: Reports Module

The reports module follows a simplified pattern — no repository layer.

```
reports.routes.js  →  reports.controller.js  →  reports.service.js  →  db pool (direct)
```

All three endpoints execute a single aggregated SQL query each. No N+1 patterns.
