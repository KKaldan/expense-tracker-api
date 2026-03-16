const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const authRepository = require("./auth.repository");
const AppError = require("../../utils/AppError");
const { JWT_SECRET, JWT_EXPIRY } = require("../../config/env");

async function registerUser({ email, name, password }) {

  const existingUser = await authRepository.findUserByEmail(email);

  if (existingUser) {
    throw AppError.conflict("Email already in use");
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await authRepository.createUser({
    email,
    name,
    password: hashedPassword
  });

  return user;
}

async function loginUser({ email, password }) {

  const user = await authRepository.findUserByEmail(email);

  if (!user) {
    throw AppError.unauthorized("Invalid email or password");
  }

  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    throw AppError.unauthorized("Invalid email or password");
  }

  const token = jwt.sign(
    { userId: user.id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    }
  };
}

async function getMe(userId) {
  const user = await authRepository.findUserById(userId);

  if (!user) {
    throw AppError.notFound("User not found");
  }

  return user;
}

module.exports = {
  registerUser,
  loginUser,
  getMe,
};