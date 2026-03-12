const bcrypt = require("bcrypt");
const authRepository = require("./auth.repository");
const AppError = require("../../utils/AppError");

async function registerUser({ email, name, password }) {

  const existingUser = await authRepository.findUserByEmail(email);

  if (existingUser) {
    throw new AppError("Email already in use", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await authRepository.createUser({
    email,
    name,
    password: hashedPassword
  });

  return user;
}

module.exports = {
  registerUser
};