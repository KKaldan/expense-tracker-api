const express = require("express");
const router = express.Router();

const authController = require("./auth.controller");
const authenticate = require("../../middleware/auth.middleware");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validate");
const { registerSchema, loginSchema } = require("./auth.schema");

router.post("/register", validate(registerSchema), asyncHandler(authController.register));
router.post("/login",    validate(loginSchema),    asyncHandler(authController.login));
router.post("/refresh",                            asyncHandler(authController.refresh));
router.post("/logout",   authenticate,             asyncHandler(authController.logout));
router.get("/me",        authenticate,             asyncHandler(authController.me));

module.exports = router;
