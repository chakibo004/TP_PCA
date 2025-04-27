const express = require("express");
const authenticateToken = require("../middlewares/authenticateToken");

// P2P Controller Functions
const {
  getParams,
  initiate,
  respond,
  getSession,
  getParamsForResponse,
  findSession,
  sessionsPeer, // Import P2P sessions store
} = require("../controllers/dhPeerController");

// Server-Assisted Controller Functions
const {
  getServerDhParams,
  exchangeDhKeys,
  requestSessionKey,
  serverClientDhSessions, // Import Server-Client DH sessions store
} = require("../controllers/dhServerController");

const router = express.Router();

// Vérifier qu’une session peer existe
router.get("/peer/check/:sessionId", authenticateToken, (req, res) => {
  const { sessionId } = req.params;
  if (!sessionsPeer[sessionId]) {
    return res.status(404).json({ message: "Session peer inconnue" });
  }
  res.sendStatus(204);
});

// Vérifier qu’une session server‑assisted existe

// Peer‑to‑peer DH
router.get("/peer/params", authenticateToken, getParams);
router.get(
  "/peer/params/response/:sessionId",
  authenticateToken,
  getParamsForResponse
);
router.post("/peer/initiate", authenticateToken, initiate);
router.post("/peer/respond", authenticateToken, respond);
router.get("/peer/session/:sessionId", authenticateToken, getSession);
// **nouvelle** route pour retrouver une session existante
router.post("/peer/find", authenticateToken, findSession);
router.get("/peer/check/:sessionId", authenticateToken, (req, res) => {
  const { sessionId } = req.params;
  if (!sessionsPeer[sessionId]) {
    return res.status(404).json({ message: "Session peer inconnue" });
  }
  res.sendStatus(204); // OK, session exists
});

// --- Server-Assisted DH Routes (KDC Model) ---
router.get("/server/params", authenticateToken, getServerDhParams); // Get p, g for server DH
router.post("/server/exchange", authenticateToken, exchangeDhKeys); // Exchange pub keys with server
router.post(
  "/server/request-session-key",
  authenticateToken,
  requestSessionKey // Request E2EE session key (Ks)
);
// Optional: Check if user has established DH with server
router.get("/server/check/user/:userId", authenticateToken, (req, res) => {
  const userIdToCheck = parseInt(req.params.userId, 10);
  if (isNaN(userIdToCheck)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }
  if (serverClientDhSessions[userIdToCheck]?.sharedSecretHex) {
    res.sendStatus(204); // OK, DH established
  } else {
    res.status(404).json({ message: "User DH session with server not found" });
  }
});

module.exports = router;
