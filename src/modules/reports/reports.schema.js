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
  months: z.coerce.number().int().min(1).max(24).catch(6),
});

module.exports = { dateRangeSchema, monthlyTrendQuerySchema };
