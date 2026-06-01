const authService = require("./auth.service");
const AppError = require("../../utils/AppError");
const { NODE_ENV, REFRESH_TOKEN_EXPIRY_DAYS } = require("../../config/env");

const COOKIE_BASE = {
  httpOnly: true,
  secure: NODE_ENV === "production",
  sameSite: "strict",
};

const COOKIE_OPTIONS = {
  ...COOKIE_BASE,
  maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
};

async function register(req, res) {
  const user = await authService.registerUser(req.body);

  res.status(201).json({
    success: true,
    data: user
  });
}

async function login(req, res) {
  const { token, refreshToken, user } = await authService.loginUser(req.body);

  res.cookie("refresh_token", refreshToken, COOKIE_OPTIONS);

  res.json({
    success: true,
    data: { token, user }
  });
}

async function refresh(req, res) {
  const rawToken = req.cookies?.refresh_token;

  if (!rawToken) {
    throw AppError.unauthorized("Refresh token not provided");
  }

  const { token, refreshToken } = await authService.refreshAccessToken(rawToken);

  res.cookie("refresh_token", refreshToken, COOKIE_OPTIONS);

  res.json({
    success: true,
    data: { token }
  });
}

async function logout(req, res) {
  const rawToken = req.cookies?.refresh_token;

  if (rawToken) {
    await authService.logout(rawToken);
  }

  res.clearCookie("refresh_token", COOKIE_BASE);

  res.json({ success: true });
}

async function me(req, res) {
  const user = await authService.getMe(req.user.id);

  res.json({
    success: true,
    data: user,
  });
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  me
};
