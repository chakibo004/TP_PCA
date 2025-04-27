// controllers/messageServerController.js
const Message = require("../models/Message");
const { sessionServer } = require("./dhServerController");

const sendServerMessage = async (req, res) => {
  const { sessionId, ciphertext } = req.body;
  if (!sessionId || !ciphertext)
    return res.status(400).json({ message: "Champs manquants" });

  const entry = sessionServer[sessionId];
  if (!entry) return res.status(404).json({ message: "Session invalide" });

  const userId = req.user.userId;
  if (userId !== entry.initiator && userId !== entry.target) {
    return res.status(403).json({ message: "Pas autorisé" });
  }

  await Message.create({ sessionId, senderId: userId, ciphertext });
  res.status(201).json({ message: "Message envoyé (server‑assisted)" });
};

const getServerMessages = async (req, res) => {
  const { sessionId } = req.params;
  const entry = sessionServer[sessionId];
  if (!entry) return res.status(404).json({ message: "Session invalide" });

  const userId = req.user.userId;
  if (userId !== entry.initiator && userId !== entry.target) {
    return res.status(403).json({ message: "Pas autorisé" });
  }

  const msgs = await Message.findAll({
    where: { sessionId },
    order: [["createdAt", "ASC"]],
  });
  res.json(msgs);
};

module.exports = { sendServerMessage, getServerMessages };
