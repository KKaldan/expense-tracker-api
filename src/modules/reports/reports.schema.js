const { z } = require("zod");
const { isoDate } = require("../../utils/isoDate");

const dateRangeSchema = z
  .object({
    from: isoDate("from").optional(),
    to: isoDate("to").optional(),
  })
  .refine(({ from, to }) => !from || !to || from <= to, {
    message: "from must be on or before to",
    path: ["from"],
  });

const monthlyTrendQuerySchema = z.object({
  months: z.coerce
    .number({ error: "months must be a number" })
    .int({ message: "months must be a whole number" })
    .min(1, { message: "months must be between 1 and 24" })
    .max(24, { message: "months must be between 1 and 24" })
    .default(6),
});

module.exports = { dateRangeSchema, monthlyTrendQuerySchema };
