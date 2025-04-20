// controllers/messageController.js
const Message = require("../models/Message");

// Envoie d’un message chiffré
const sendMessage = async (req, res) => {
  const { sessionId, ciphertext } = req.body;
  if (!sessionId || !ciphertext) {
    return res.status(400).json({ message: "Champs requis manquants" });
  }
  // req.user.userId vient de authenticateToken
  const senderId = req.user.userId;
  await Message.create({ sessionId, senderId, ciphertext });
  res.status(201).json({ message: "Message envoyé" });
};

// Récupération de tous les messages pour une session
const getMessages = async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json({ message: "SessionId manquant" });
  }
  const msgs = await Message.findAll({
    where: { sessionId },
    order: [["createdAt", "ASC"]],
  });
  res.json(msgs);
};

module.exports = { sendMessage, getMessages };
