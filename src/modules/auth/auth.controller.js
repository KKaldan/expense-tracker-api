const authService = require("./auth.service");

async function register(req, res) {
  const user = await authService.registerUser(req.body);

  res.status(201).json({
    success: true,
    data: user
  });
}

module.exports = {
  register
};