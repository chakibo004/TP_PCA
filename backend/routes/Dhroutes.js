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
  sessionsPeer,
} = require("../controllers/dhPeerController");

// Server-Assisted Controller Functions
const {
  getServerDhParams,
  exchangeDhKeys,
  requestSessionKey,
  getSessionKey,
  findServerSession,
  serverClientDhSessions,
  serverSessionKeys,
  checkUserDhStatus,
} = require("../controllers/dhServerController");

const router = express.Router();

// Vérifier qu'une session peer existe
router.get("/peer/check/:sessionId", authenticateToken, (req, res) => {
  const { sessionId } = req.params;
  if (!sessionsPeer[sessionId]) {
    return res.status(404).json({ message: "Session introuvable" });
  }
  res.sendStatus(204);
});

// Vérifier qu'une session server‑assisted existe
router.get("/server/check/:sessionId", authenticateToken, (req, res) => {
  const { sessionId } = req.params;
  if (!serverSessionKeys[sessionId]) {
    return res.status(404).json({ message: "Session introuvable" });
  }
  res.sendStatus(204);
});

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
router.post("/peer/find", authenticateToken, findSession);

// --- Server-Assisted DH Routes (KDC Model) ---
router.get("/server/params", authenticateToken, getServerDhParams);
router.post("/server/exchange", authenticateToken, exchangeDhKeys);
router.post(
  "/server/request-session-key",
  authenticateToken,
  requestSessionKey
);
router.get("/server/session-key/:sessionId", authenticateToken, getSessionKey);
router.post("/server/find", authenticateToken, findServerSession);

// Optional: Check if user has established DH with server
// Ajouter cette route à vos routes existantes
router.get('/server/check/user/:userId', authenticateToken, checkUserDhStatus);

module.exports = router;
