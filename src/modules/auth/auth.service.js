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

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: JWT_EXPIRY }
  );
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

  const accessToken = signAccessToken(user);

  // Housekeeping: login is a natural point to drop this user's expired
  // tokens so the table doesn't grow forever. Revoked-but-unexpired rows
  // are kept — they're still needed to recognise a replayed token.
  await authRepository.deleteExpiredRefreshTokens(user.id);

  const rawRefreshToken = generateRefreshToken();
  // Each login starts a new token family (one session/device).
  await authRepository.storeRefreshToken(
    user.id,
    crypto.randomUUID(),
    hashToken(rawRefreshToken),
    refreshTokenExpiry()
  );

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

  const oldHash = hashToken(rawRefreshToken);
  const newRawToken = generateRefreshToken();

  // Single-use: the old token is consumed and its successor issued atomically.
  const userId = await authRepository.rotateRefreshToken(oldHash, hashToken(newRawToken), refreshTokenExpiry());

  if (!userId) {
    // Reuse detection: a revoked-but-unexpired token means a copy exists.
    // We can't tell the thief from the real user, so end that session for
    // both. Other sessions (other families) are untouched.
    const compromisedUserId = await authRepository.revokeFamilyOfReplayedToken(oldHash);
    if (compromisedUserId) {
      console.warn(`Refresh token reuse detected for user ${compromisedUserId} — session revoked`);
    }
    throw AppError.unauthorized("Invalid or expired refresh token");
  }

  const user = await authRepository.findUserById(userId);
  if (!user) {
    throw AppError.unauthorized("User not found");
  }

  return { token: signAccessToken(user), refreshToken: newRawToken };
}

async function logout(rawRefreshToken) {

  // Idempotent — no error if the token is already revoked or not found.
  await authRepository.revokeRefreshToken(hashToken(rawRefreshToken));
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
