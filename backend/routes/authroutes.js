// routes/authroutes.js
const express = require("express");
const {
  register,
  verifyRegisterOtp,
  login,
  verifyOtp,
} = require("../controllers/authController");

const router = express.Router();

// --- Auth classique ---
router.post("/register", register);
router.post("/verifyRegisterOtp", verifyRegisterOtp);
router.post("/login", login);
router.post("/verifyOtp", verifyOtp);

module.exports = router;
