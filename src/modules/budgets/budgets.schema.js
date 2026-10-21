const { z } = require("zod");
const { amount } = require("../../utils/amount");

const createBudgetSchema = z.object({
  amount: amount(),

  period: z.enum(["monthly", "yearly"], {
    error: (iss) => iss.input === undefined ? "Period is required" : "Period must be 'monthly' or 'yearly'",
  }),

  category_id: z
    .string()
    .uuid({ message: "category_id must be a valid UUID" })
    .nullable()
    .optional(),
});

const updateBudgetSchema = z.object({
  amount: amount().optional(),

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
