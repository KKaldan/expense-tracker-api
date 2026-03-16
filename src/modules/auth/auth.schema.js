const { z } = require("zod");

const registerSchema = z.object({
  email: z.string().email({ message: "Must be a valid email address" }),
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
});

const loginSchema = z.object({
  email: z.string().email({ message: "Must be a valid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

module.exports = { registerSchema, loginSchema };