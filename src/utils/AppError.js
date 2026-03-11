/**
 * AppError
 *
 * Custom error class for all *operational* failures — errors that are
 * expected, handleable, and safe to surface to the client (e.g. 404,
 * 409, 401). Extends the native Error so it works naturally with
 * instanceof checks and Express's error handler.
 *
 * Distinguishing operational errors from programmer bugs lets the central
 * errorHandler make a clean decision:
 *   - isOperational === true  → send statusCode + message to the client
 *   - isOperational === false → log the full error, send generic 500
 *
 * Usage:
 *   throw new AppError('Email already in use', 409);
 *   throw new AppError('Expense not found', 404);
 *   throw new AppError('Invalid credentials', 401);
 *
 * Common status codes:
 *   400 Bad Request       — malformed input not caught by Zod
 *   401 Unauthorized      — missing or invalid auth token
 *   403 Forbidden         — authenticated but not allowed (e.g. wrong owner)
 *   404 Not Found         — resource does not exist
 *   409 Conflict          — duplicate resource (e.g. email already registered)
 *   422 Unprocessable     — semantically invalid input (business rule violation)
 */
class AppError extends Error {
  /**
   * @param {string} message     - Human-readable error description (sent to client)
   * @param {number} statusCode  - HTTP status code
   * @param {string} [code]      - Optional machine-readable error code for clients
   *                               e.g. 'RESOURCE_NOT_FOUND', 'EMAIL_IN_USE'
   */
  constructor(message, statusCode, code = null) {
    super(message);

    this.statusCode = statusCode;
    this.code = code ?? AppError._defaultCode(statusCode);
    this.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
    this.isOperational = true;

    // Capture a clean stack trace that starts at the call site,
    // not inside this constructor.
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Derive a default machine-readable code from the HTTP status.
   * Callers can override this by passing an explicit `code` argument.
   *
   * @param {number} statusCode
   * @returns {string}
   */
  static _defaultCode(statusCode) {
    const codes = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
    };
    return codes[statusCode] ?? 'UNKNOWN_ERROR';
  }

  /**
   * Convenience factory methods — keep controllers readable.
   *
   * throw AppError.notFound('Expense not found');
   * throw AppError.forbidden('You do not own this resource');
   */
  static badRequest(message, code)    { return new AppError(message, 400, code); }
  static unauthorized(message, code)  { return new AppError(message, 401, code); }
  static forbidden(message, code)     { return new AppError(message, 403, code); }
  static notFound(message, code)      { return new AppError(message, 404, code); }
  static conflict(message, code)      { return new AppError(message, 409, code); }
}

module.exports = AppError;