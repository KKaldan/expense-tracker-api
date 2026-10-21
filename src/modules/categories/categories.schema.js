const { z } = require("zod");

// .max() counts UTF-16 code units, not visible characters — a ZWJ emoji
// like 👨‍👩‍👧‍👦 is 11. 32 fits any emoji and short identifiers ("shopping-cart").
const icon = z
  .string()
  .max(32, { message: "Icon must be 32 characters or fewer" })
  .nullable()
  .optional();

const color = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, { message: "Color must be a valid hex code (e.g. #FF5733)" })
  .nullable()
  .optional();

// Names are trimmed before the length check, so "   " is rejected and
// "Food " can't sit alongside "Food" as a separate category.
const createCategorySchema = z.object({
  name: z
    .string({ error: (iss) => iss.input === undefined ? "Name is required" : "Name must be a string" })
    .trim()
    .min(1, { message: "Name cannot be empty" })
    .max(100, { message: "Name must be 100 characters or fewer" }),

  icon,

  color,
});

// null clears icon/color; omitting a field leaves it unchanged.
const updateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Name cannot be empty" })
    .max(100, { message: "Name must be 100 characters or fewer" })
    .optional(),

  icon,

  color,
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided" }
);

module.exports = { createCategorySchema, updateCategorySchema };
