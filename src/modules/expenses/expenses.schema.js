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

module.exports = { createExpenseSchema };
