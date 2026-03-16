/**
 * Validation middleware factory.
 *
 * Takes a Zod schema and an optional source and returns an Express middleware
 * that validates and coerces req[source] against the schema. On success,
 * req[source] is replaced with the parsed output. On failure, the ZodError
 * is forwarded to the central errorHandler which formats it into a 400
 * response with per-field detail.
 *
 * NOTE: Only use this for 'body'. Express 5 makes req.query a computed getter
 * that cannot be reassigned, so validate(schema, 'query') silently has no
 * effect. For query parameter validation, call schema.parse(req.query)
 * directly inside the controller instead.
 *
 * @param {import('zod').ZodSchema} schema
 * @param {'body'} source
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
