const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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

async function loginUser({ email, password }) {

  const user = await authRepository.findUserByEmail(email);

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    throw new AppError("Invalid email or password", 401);
  }

  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
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

module.exports = {
  registerUser,
  loginUser
};