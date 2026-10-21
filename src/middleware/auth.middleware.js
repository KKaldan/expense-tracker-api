const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const { JWT_SECRET } = require("../config/env");

function authenticate(req, _res, next) {

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(AppError.unauthorized("No token provided"));
  }

  const token = authHeader.split(" ")[1];

  try {
    // Pin the algorithm — never let the token's own header choose how it's verified.
    req.user = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    next();
  } catch (err) {
    // JsonWebTokenError and TokenExpiredError are handled by the central errorHandler
    next(err);
  }
}

module.exports = authenticate;
