const { z } = require("zod");
const { isoDate } = require("../../utils/isoDate");
const { amount } = require("../../utils/amount");

// Three letters, normalised to upper case. Shape only — not checked against
// the real ISO 4217 list.
const currency = z
  .string()
  .regex(/^[A-Za-z]{3}$/, { message: "Currency must be a 3-letter ISO 4217 code" })
  .transform((v) => v.toUpperCase());

const createExpenseSchema = z.object({
  amount: amount(),

  currency: currency.default("GBP"),

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
  amount: amount().optional(),

  currency: currency.optional(),

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

// Query parameters for GET /expenses. Missing values take the default;
// invalid ones (e.g. limit=500, page=abc) are a 400, not silently replaced.
const listExpensesQuerySchema = z.object({
  page: z.coerce
    .number({ error: "page must be a number" })
    .int({ message: "page must be a whole number" })
    .min(1, { message: "page must be at least 1" })
    .default(1),
  limit: z.coerce
    .number({ error: "limit must be a number" })
    .int({ message: "limit must be a whole number" })
    .min(1, { message: "limit must be at least 1" })
    .max(100, { message: "limit must be at most 100" })
    .default(20),
  from: isoDate("from").optional(),
  to: isoDate("to").optional(),
  category_id: z.string().uuid({ message: "category_id must be a valid UUID" }).optional(),
  sort: z.string().optional(),
}).refine(
  ({ from, to }) => !from || !to || from <= to,
  { message: "from must be on or before to", path: ["from"] }
);

module.exports = { createExpenseSchema, updateExpenseSchema, listExpensesQuerySchema };
