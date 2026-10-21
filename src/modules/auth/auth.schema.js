const { z } = require("zod");

// Normalised before validation so "Jane@X.com " and "jane@x.com" are the
// same account — the users.email UNIQUE constraint is case-sensitive.
const email = z.string().trim().toLowerCase().email({ message: "Must be a valid email address" });

const registerSchema = z.object({
  email,
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, { message: "Password is required" }),
});

module.exports = { registerSchema, loginSchema };