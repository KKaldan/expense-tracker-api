const { z } = require("zod");

const dateRangeSchema = z
  .object({
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "from must be in YYYY-MM-DD format" })
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "to must be in YYYY-MM-DD format" })
      .optional(),
  })
  .refine(({ from, to }) => !from || !to || from <= to, {
    message: "from must be on or before to",
    path: ["from"],
  });

const monthlyTrendQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).catch(6),
});

module.exports = { dateRangeSchema, monthlyTrendQuerySchema };
