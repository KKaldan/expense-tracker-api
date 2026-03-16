const authService = require("./auth.service");

async function register(req, res) {
  const user = await authService.registerUser(req.body);

  res.status(201).json({
    success: true,
    data: user
  });
}

async function login(req, res) {
  const result = await authService.loginUser(req.body);

  res.json({
    success: true,
    data: result
  });
}

async function me(req, res) {
  const user = await authService.getMe(req.user.userId);

  res.json({
    success: true,
    data: user,
  });
}

module.exports = {
  register,
  login,
  me
};