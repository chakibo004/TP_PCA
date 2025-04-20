// routes/authroutes.js
const express = require("express");
const authenticateToken = require("../middlewares/authenticateToken");

const {
  register,
  verifyRegisterOtp,
  login,
  verifyOtp,
} = require("../controllers/authcontroller");
const {
  case1Initiate,
  case1Fetch,
  case2Generate,
  case2Fetch,
} = require("../controllers/keyController");
const {
  startKeyAuth,
  respondKeyAuth,
  confirmKeyAuth,
} = require("../controllers/keyAuthController");
const {
  getDHParams,
  dhInitiate,
  dhRespond,
} = require("../controllers/DhController");

const router = express.Router();

// --- Auth classique ---
router.post("/register", register);
router.post("/verifyRegisterOtp", verifyRegisterOtp);
router.post("/login", login);
router.post("/verifyOtp", verifyOtp);

// --- Distribution de clés (cas 1 & 2) ---
router.post("/key/case1/initiate", authenticateToken, case1Initiate);
router.get("/key/case1/fetch/:sessionId", authenticateToken, case1Fetch);
router.post("/key/case2/generate", authenticateToken, case2Generate);
router.get("/key/case2/fetch/:sessionId", authenticateToken, case2Fetch);

// --- Auth mutuelle PAR CLÉS symétriques ---
router.post("/mutual/keyAuth/start", authenticateToken, startKeyAuth);
router.post("/mutual/keyAuth/respond", authenticateToken, respondKeyAuth);
router.post("/mutual/keyAuth/confirm", authenticateToken, confirmKeyAuth);

// --- Diffie‑Hellman (cas 3 pour comparaison) ---
router.get("/dh/params", authenticateToken, getDHParams);
router.post("/dh/initiate", authenticateToken, dhInitiate);
router.post("/dh/respond", authenticateToken, dhRespond);

module.exports = router;
