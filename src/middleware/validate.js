/**
 * Validation middleware factory.
 *
 * Takes a Zod schema and an optional source ('body' or 'query') and returns
 * an Express middleware that validates and coerces the request data against
 * the schema. On success, req[source] is replaced with the parsed output.
 * On failure, the ZodError is forwarded to the central errorHandler which
 * formats it into a 400 response with per-field detail.
 *
 * Usage:
 *   validate(createExpenseSchema)           — validates req.body (default)
 *   validate(listExpensesQuerySchema, 'query') — validates req.query
 *
 * @param {import('zod').ZodSchema} schema
 * @param {'body' | 'query'} source
 * @returns {import('express').RequestHandler}
 */
function validate(schema, source = "body") {
  return (req, _res, next) => {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { validate };
