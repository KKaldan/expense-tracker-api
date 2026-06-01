const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const authRepository = require("./auth.repository");
const AppError = require("../../utils/AppError");
const { JWT_SECRET, JWT_EXPIRY, REFRESH_TOKEN_EXPIRY_DAYS } = require("../../config/env");

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

function refreshTokenExpiry() {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

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

  const accessToken = jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  const rawRefreshToken = generateRefreshToken();
  await authRepository.storeRefreshToken(user.id, hashToken(rawRefreshToken), refreshTokenExpiry());

  return {
    token: accessToken,
    refreshToken: rawRefreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    }
  };
}

async function refreshAccessToken(rawRefreshToken) {

  const stored = await authRepository.findRefreshToken(hashToken(rawRefreshToken));

  if (!stored || stored.revoked || new Date(stored.expires_at) < new Date()) {
    throw AppError.unauthorized("Invalid or expired refresh token");
  }

  // Single-use: revoke the consumed token before issuing the replacement.
  await authRepository.revokeRefreshToken(stored.id);

  const user = await authRepository.findUserById(stored.user_id);
  if (!user) {
    throw AppError.unauthorized("User not found");
  }

  const accessToken = jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  const newRawToken = generateRefreshToken();
  await authRepository.storeRefreshToken(user.id, hashToken(newRawToken), refreshTokenExpiry());

  return { token: accessToken, refreshToken: newRawToken };
}

async function logout(rawRefreshToken) {

  const stored = await authRepository.findRefreshToken(hashToken(rawRefreshToken));

  if (stored && !stored.revoked) {
    await authRepository.revokeRefreshToken(stored.id);
  }
  // Idempotent — no error if the token is already revoked or not found.
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
  refreshAccessToken,
  logout,
  getMe,
};
