const { z } = require("zod");

// Normalised before validation so "Jane@X.com " and "jane@x.com" are the
// same account — the users.email UNIQUE constraint is case-sensitive.
const email = z.string().trim().toLowerCase().email({ message: "Must be a valid email address" });

const registerSchema = z.object({
  email,
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  // bcrypt ignores everything past 72 bytes, so a longer password would
  // silently match any other with the same first 72. Bytes, not characters —
  // multi-byte UTF-8 (e.g. emoji) counts for more. Login deliberately has no
  // max, so anyone who registered a longer password before this can still log in.
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .refine((val) => Buffer.byteLength(val, "utf8") <= 72, { message: "Password must be 72 bytes or fewer" }),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, { message: "Password is required" }),
});

module.exports = { registerSchema, loginSchema };