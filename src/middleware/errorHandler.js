/**
 * Central Express error handler. Must be registered last in app.js
 * (after all routes) as a 4-argument middleware.
 *
 * Handles three categories:
 *   1. AppError (isOperational) — expected failures thrown by services/controllers
 *   2. Known third-party errors — Zod validation, JWT errors, pg unique violation
 *   3. Unexpected bugs — log full error, return generic 500
 */
function errorHandler(err, _req, res, _next) {

  // --- 1. Operational errors (thrown deliberately with AppError) ---
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  // --- 2a. Zod validation errors ---
  // Zod v4 renamed .errors to .issues; support both for compatibility.
  if (err.name === "ZodError") {
    const issues = err.issues ?? err.errors ?? [];
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      },
    });
  }

  // --- 2b. JWT errors ---
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      error: { code: "TOKEN_EXPIRED", message: "Access token has expired" },
    });
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      error: { code: "INVALID_TOKEN", message: "Invalid access token" },
    });
  }

  // --- 2c. PostgreSQL unique constraint violation ---
  if (err.code === "23505") {
    return res.status(409).json({
      success: false,
      error: { code: "CONFLICT", message: "A resource with that value already exists" },
    });
  }

  // --- 3. Unexpected programmer error ---
  // Log the full error server-side but never expose internals to the client.
  console.error("Unexpected error:", err);

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong. Please try again later.",
    },
  });
}

module.exports = errorHandler;
