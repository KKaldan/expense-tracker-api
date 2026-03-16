const express = require("express");
const router = express.Router();

const authController = require("./auth.controller");
const authenticate = require("../../middleware/auth.middleware");
const asyncHandler = require("../../utils/asyncHandler");

router.get("/me", authenticate, asyncHandler(authController.me));

router.post("/register", asyncHandler(authController.register));
router.post("/login", asyncHandler(authController.login));

module.exports = router;