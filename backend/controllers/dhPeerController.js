// controllers/dhPeerController.js
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

// sessionsPeer[sessionId] = { p, g, Apub, Bpub?, initiator, target, verifiedUsers }
const sessionsPeer = {};

/**
 * GET /auth/dh/peer/params
 */
const getParams = (req, res) => {
  const dh = crypto.getDiffieHellman("modp14");
  dh.generateKeys();
  res.json({
    p: dh.getPrime("hex"),
    g: dh.getGenerator("hex"),
  });
};

/**
 * POST /auth/dh/peer/initiate
 */
const initiate = (req, res) => {
  const { p, g, Apub, targetId } = req.body;
  if (!p || !g || !Apub || !targetId)
    return res.status(400).json({ message: "Paramètres manquants" });

  const initiator = req.user.userId;
  const sessionId = uuidv4();
  sessionsPeer[sessionId] = {
    p,
    g,
    Apub,
    initiator,
    target: Number(targetId),
    verifiedUsers: new Set(),
  };
  console.log(`Session initiée ${sessionId}`, {
    initiator,
    target: Number(targetId),
  });
  res.json({ sessionId });
};

/**
 * POST /auth/dh/peer/respond
 */

const respond = (req, res) => {
  const { sessionId, Bpub } = req.body;
  const entry = sessionsPeer[sessionId];
  if (!entry) return res.status(400).json({ message: "Session invalide" });

  const responder = req.user.userId;
  if (responder !== entry.target)
    return res.status(403).json({ message: "Pas autorisé" });

  entry.Bpub = Bpub;

  // Get the io instance from the app
  const io = req.app.get("io");

  // Emit to both initiator and target that handshake is completed
  io.to(`user:${entry.initiator}`).emit("handshake-completed", { sessionId });
  io.to(`user:${entry.target}`).emit("handshake-completed", { sessionId });

  res.json({ Apub: entry.Apub, Bpub });
};

/**
 * GET /auth/dh/peer/session/:sessionId
 */
const getSession = (req, res) => {
  const { sessionId } = req.params;
  const entry = sessionsPeer[sessionId];
  if (!entry) return res.status(404).json({ message: "Session inconnue" });

  const userId = req.user.userId;
  if (userId !== entry.initiator && userId !== entry.target)
    return res.status(403).json({ message: "Non autorisé" });

  res.json({ initiator: entry.initiator, target: entry.target });
};

/**
 * POST /auth/dh/peer/find
 * Body: { otherId }
 * Essaie de retrouver une session existante entre `req.user.userId` et `otherId`.
 */
const findSession = (req, res) => {
  const me = req.user.userId;
  const other = Number(req.body.otherId);
  for (const [sid, e] of Object.entries(sessionsPeer)) {
    if (
      (e.initiator === me && e.target === other) ||
      (e.initiator === other && e.target === me)
    ) {
      return res.json({ sessionId: sid });
    }
  }
  res.status(404).json({ message: "Pas de session existante" });
};

function getParamsForResponse(req, res) {
  const { sessionId } = req.params;
  const entry = sessionsPeer[sessionId];
  if (!entry) {
    return res.status(404).json({ message: "Session inconnue" });
  }
  const userId = req.user.userId;
  if (userId !== entry.initiator && userId !== entry.target) {
    return res.status(403).json({ message: "Non autorisé" });
  }
  // On renvoie les paramètres pour que chaque côté calcule le shared
  res.json({ p: entry.p, g: entry.g, Apub: entry.Apub, Bpub: entry.Bpub });
}

module.exports = {
  getParams,
  initiate,
  respond,
  getSession,
  findSession,
  sessionsPeer,
  getParamsForResponse,
};
