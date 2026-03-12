const express = require("express");
const router = express.Router();

router.post("/register");
router.post("/login");
router.post("/refresh");
router.post("/logout");
router.get("/me");

module.exports = router;