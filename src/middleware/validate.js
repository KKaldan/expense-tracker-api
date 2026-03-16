/**
 * Validation middleware factory.
 *
 * Takes a Zod schema and returns an Express middleware that validates and
 * coerces req.body against it. On success, req.body is replaced with the
 * parsed (clean, typed) output. On failure, the ZodError is forwarded to
 * the central errorHandler which formats it into a 400 response with
 * per-field detail.
 *
 * Usage:
 *   const { validate } = require('../../middleware/validate');
 *   router.post('/', validate(createExpenseSchema), asyncHandler(handler));
 *
 * @param {import('zod').ZodSchema} schema
 * @returns {import('express').RequestHandler}
 */
function validate(schema) {
  return (req, _res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { validate };
