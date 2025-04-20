// controllers/keyAuthController.js
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const { sessions2 } = require("./keyController");
// sessions2[sessionId] contient { keyHex }

// stockage des sessions d’auth mutuelle
const sessionsAuth = {};
// sessionsAuth[authSessionId] = { keyHex, initiator, target, Na?, Nb? }

// Étape 1 : A démarre l’auth mutuelle
const startKeyAuth = (req, res) => {
  const initiator = req.user.userId;
  const { keySessionId, targetId } = req.body;
  const keyEntry = sessions2[keySessionId];
  if (!keyEntry)
    return res.status(404).json({ message: "Key session invalide" });

  const Na = crypto.randomBytes(16).toString("hex");
  const authSessionId = uuidv4();
  sessionsAuth[authSessionId] = {
    keyHex: keyEntry.keyHex,
    initiator,
    target: targetId,
    Na,
  };
  res.json({ authSessionId, Na });
};

// Étape 2 : B répond en récupérant Na, génère Nb
const respondKeyAuth = (req, res) => {
  const responder = req.user.userId;
  const { authSessionId } = req.body;
  const entry = sessionsAuth[authSessionId];
  if (!entry) return res.status(404).json({ message: "Auth session inconnue" });
  if (entry.target !== responder)
    return res.status(403).json({ message: "Pas autorisé" });

  const Nb = crypto.randomBytes(16).toString("hex");
  entry.Nb = Nb;
  res.json({ Nb });
};

// Étape 3 : A récupère Nb et la clé pour vérifier
const confirmKeyAuth = (req, res) => {
  const confirmer = req.user.userId;
  const { authSessionId } = req.body;
  const entry = sessionsAuth[authSessionId];
  if (!entry) return res.status(404).json({ message: "Auth session inconnue" });
  if (entry.initiator !== confirmer)
    return res.status(403).json({ message: "Pas autorisé" });

  const { Na, Nb, keyHex } = entry;
  delete sessionsAuth[authSessionId];
  // renvoie both nonces + clé pour que A puisse faire son HMAC et vérifier B également
  res.json({ Na, Nb, keyHex });
};

module.exports = { startKeyAuth, respondKeyAuth, confirmKeyAuth };
