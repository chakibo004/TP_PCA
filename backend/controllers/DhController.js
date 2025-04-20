// controllers/dhController.js
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const sessionDH = {};

const getDHParams = (req, res) => {
  const dh = crypto.createDiffieHellman(2048);
  res.json({ p: dh.getPrime("hex"), g: dh.getGenerator("hex") });
};

const dhInitiate = (req, res) => {
  const { p, g } = req.body;
  if (!p || !g) return res.status(400).json({ message: "p,g manquants" });
  const dh = crypto.createDiffieHellman(
    Buffer.from(p, "hex"),
    Buffer.from(g, "hex")
  );
  const A = dh.generateKeys("hex");
  const sessionId = uuidv4();
  sessionDH[sessionId] = { p, g, A };
  res.json({ sessionId, A });
};

const dhRespond = (req, res) => {
  const { sessionId, p, g, B } = req.body;
  const entry = sessionDH[sessionId];
  if (!entry || entry.p !== p || entry.g !== g)
    return res.status(400).json({ message: "Session invalide" });
  res.json({ B });
};

module.exports = { getDHParams, dhInitiate, dhRespond };
