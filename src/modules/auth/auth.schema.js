const { z } = require("zod");

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8)
});

module.exports = {
  registerSchema
};