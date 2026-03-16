const { z } = require("zod");

const createExpenseSchema = z.object({
  amount: z
    .number({ required_error: "Amount is required", invalid_type_error: "Amount must be a number" })
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

  date: z
    .string({ required_error: "Date is required" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be in YYYY-MM-DD format" }),
});

// All fields optional for PATCH — at least one must be provided
const updateExpenseSchema = createExpenseSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided" }
);

// Query parameters for GET /expenses
const listExpensesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "from must be in YYYY-MM-DD format" })
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "to must be in YYYY-MM-DD format" })
    .optional(),
  category_id: z.string().uuid({ message: "category_id must be a valid UUID" }).optional(),
  sort: z.string().optional(),
});

module.exports = { createExpenseSchema, updateExpenseSchema, listExpensesQuerySchema };
