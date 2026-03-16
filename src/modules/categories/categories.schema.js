const { z } = require("zod");

const createCategorySchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .min(1, { message: "Name cannot be empty" })
    .max(100, { message: "Name must be 100 characters or fewer" }),

  icon: z.string().max(10).optional(),

  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, { message: "Color must be a valid hex code (e.g. #FF5733)" })
    .optional(),
});

const updateCategorySchema = z.object({
  name: z
    .string()
    .min(1, { message: "Name cannot be empty" })
    .max(100, { message: "Name must be 100 characters or fewer" })
    .optional(),

  icon: z.string().max(10).optional(),

  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, { message: "Color must be a valid hex code (e.g. #FF5733)" })
    .optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided" }
);

module.exports = { createCategorySchema, updateCategorySchema };
