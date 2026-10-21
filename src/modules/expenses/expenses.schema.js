const { z } = require("zod");
const { isoDate } = require("../../utils/isoDate");

const createExpenseSchema = z.object({
  amount: z
    .number({ error: (iss) => iss.input === undefined ? "Amount is required" : "Amount must be a number" })
    .positive({ message: "Amount must be greater than 0" }),

  currency: z
    .string()
    .length(3, { message: "Currency must be a 3-letter ISO 4217 code" })
    .transform((v) => v.toUpperCase())
    .default("GBP"),

  description: z
    .string()
    .max(500, { message: "Description must be 500 characters or fewer" })
    .optional(),

  category_id: z
    .string()
    .uuid({ message: "category_id must be a valid UUID" })
    .nullable()
    .optional(),

  date: isoDate("Date"),
});

// All fields optional for PATCH — at least one must be provided.
// Defined independently (not via .partial()) so no defaults are inherited,
// otherwise an empty body would get { currency: "GBP" } injected and pass.
const updateExpenseSchema = z.object({
  amount: z
    .number({ error: "Amount must be a number" })
    .positive({ message: "Amount must be greater than 0" })
    .optional(),

  currency: z
    .string()
    .length(3, { message: "Currency must be a 3-letter ISO 4217 code" })
    .transform((v) => v.toUpperCase())
    .optional(),

  description: z.string().max(500).optional(),

  category_id: z
    .string()
    .uuid({ message: "category_id must be a valid UUID" })
    .nullable()
    .optional(),

  date: isoDate("Date").optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided" }
);

// Query parameters for GET /expenses.
// .catch(n) is used instead of .default(n) because z.coerce.number() in Zod v4
// converts undefined to NaN before .default() can apply — .catch() handles any failure.
const listExpensesQuerySchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(20),
  from: isoDate("from").optional(),
  to: isoDate("to").optional(),
  category_id: z.string().uuid({ message: "category_id must be a valid UUID" }).optional(),
  sort: z.string().optional(),
}).refine(
  ({ from, to }) => !from || !to || from <= to,
  { message: "from must be on or before to", path: ["from"] }
);

module.exports = { createExpenseSchema, updateExpenseSchema, listExpensesQuerySchema };
