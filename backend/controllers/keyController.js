// controllers/keyController.js
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");

const sessions1 = {}; // cas 1
const sessions2 = {}; // cas 2

// Cas 1 : A génère et envoie K à B via le serveur
const case1Initiate = (req, res) => {
  const initiator = req.user.userId;
  const { targetId } = req.body;
  if (!targetId) return res.status(400).json({ message: "targetId manquant" });
  const sessionId = uuidv4();
  const keyHex = crypto.randomBytes(32).toString("hex");
  sessions1[sessionId] = { initiator, target: targetId, keyHex };
  res.json({ sessionId });
};

const case1Fetch = (req, res) => {
  const sessionId = req.params.sessionId;
  const entry = sessions1[sessionId];
  if (!entry) return res.status(404).json({ message: "Session inconnue" });
  if (entry.target !== req.user.userId)
    return res.status(403).json({ message: "Pas autorisé" });
  res.json({ keyHex: entry.keyHex });
};

// Cas 2 : le serveur génère la clé et la distribue
const case2Generate = (req, res) => {
  const sessionId = uuidv4();
  const keyHex = crypto.randomBytes(32).toString("hex");
  sessions2[sessionId] = { keyHex };
  res.json({ sessionId });
};

const case2Fetch = (req, res) => {
  const sessionId = req.params.sessionId;
  const entry = sessions2[sessionId];
  if (!entry) return res.status(404).json({ message: "Session inconnue" });
  res.json({ keyHex: entry.keyHex });
};

module.exports = { case1Initiate, case1Fetch, case2Generate, case2Fetch };
