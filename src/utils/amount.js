const { z } = require("zod");

/**
 * Zod schema for a monetary amount stored in a NUMERIC(12,2) column.
 * Without the precision and max checks, Postgres rounds 0.001 to 0.00
 * (failing CHECK amount > 0) and overflows on 1e10 — both surfaced as 500s.
 */
function amount() {
  return z
    .number({ error: (iss) => iss.input === undefined ? "Amount is required" : "Amount must be a number" })
    .positive({ message: "Amount must be greater than 0" })
    .multipleOf(0.01, { message: "Amount can have at most 2 decimal places" })
    .max(9999999999.99, { message: "Amount must be 9,999,999,999.99 or less" });
}

module.exports = { amount };
