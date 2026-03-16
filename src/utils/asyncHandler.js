/**
 * Wraps an async route handler and forwards any rejected promise to Express's
 * next(err), which triggers the central errorHandler middleware.
 *
 * Without this, an unhandled rejection in an async controller silently hangs
 * the request (Express 4) or crashes the process (Express 5).
 *
 * Usage:
 *   router.get('/expenses', asyncHandler(async (req, res) => {
 *     const data = await expenseService.list(req.user.id);
 *     res.json({ success: true, data });
 *   }));
 *
 * @param {Function} fn  Async route handler (req, res, next)
 * @returns {Function}   Standard Express middleware
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
