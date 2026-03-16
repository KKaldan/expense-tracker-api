const { z } = require("zod");

const createBudgetSchema = z.object({
  amount: z
    .number({ required_error: "Amount is required", invalid_type_error: "Amount must be a number" })
    .positive({ message: "Amount must be greater than 0" }),

  period: z.enum(["monthly", "yearly"], {
    required_error: "Period is required",
    message: "Period must be 'monthly' or 'yearly'",
  }),

  category_id: z
    .string()
    .uuid({ message: "category_id must be a valid UUID" })
    .nullable()
    .optional(),
});

const updateBudgetSchema = z.object({
  amount: z
    .number({ invalid_type_error: "Amount must be a number" })
    .positive({ message: "Amount must be greater than 0" })
    .optional(),

  period: z
    .enum(["monthly", "yearly"], { message: "Period must be 'monthly' or 'yearly'" })
    .optional(),

  category_id: z
    .string()
    .uuid({ message: "category_id must be a valid UUID" })
    .nullable()
    .optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided" }
);

module.exports = { createBudgetSchema, updateBudgetSchema };
