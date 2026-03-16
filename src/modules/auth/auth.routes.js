const express = require("express");
const router = express.Router();

const authController = require("./auth.controller");
const authenticate = require("../../middleware/auth.middleware");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validate");
const { registerSchema, loginSchema } = require("./auth.schema");

router.get("/me", authenticate, asyncHandler(authController.me));

router.post("/register", validate(registerSchema), asyncHandler(authController.register));
router.post("/login", validate(loginSchema), asyncHandler(authController.login));

module.exports = router;