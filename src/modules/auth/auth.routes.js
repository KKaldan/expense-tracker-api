const express = require("express");
const router = express.Router();

const authController = require("./auth.controller");
const authenticate = require("../../middleware/auth.middleware");

router.get("/me", authenticate, authController.me);

router.post("/register", authController.register);
router.post("/login", authController.login);

module.exports = router;