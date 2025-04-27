// controllers/messagePeerController.js
const Message = require("../models/Message");
const { sessionsPeer } = require("./dhPeerController");

const sendPeerMessage = async (req, res) => {
  console.log("⇨ POST /auth/message/peer/send body:", req.body);
  const { sessionId, ciphertext } = req.body;
  if (!sessionId || !ciphertext)
    return res.status(400).json({ message: "Champs manquants" });

  const entry = sessionsPeer[sessionId];
  if (!entry) return res.status(400).json({ message: "Session invalide" });

  const userId = req.user.userId;
  if (userId !== entry.initiator && userId !== entry.target) {
    console.log(`🚫 Unauthorized sendPeerMessage by ${userId} on ${sessionId}`);
    return res.status(403).json({ message: "Pas autorisé" });
  }

  const message = await Message.create({
    sessionId,
    senderId: userId,
    ciphertext,
  });
  console.log(`✅ Message saved for session ${sessionId} by user ${userId}`);

  // Get the io instance from the app
  const io = req.app.get("io");

  // Emit to the session room
  io.to(`session:${sessionId}`).emit("new-message", {
    id: message.id,
    sessionId,
    senderId: userId,
    ciphertext,
    createdAt: message.createdAt,
  });

  res.status(201).json({ message: "Message envoyé (peer‑to‑peer)" });
};

const getPeerMessages = async (req, res) => {
  console.log("⇨ GET /auth/message/peer/:sessionId params:", req.params);
  const { sessionId } = req.params;
  const entry = sessionsPeer[sessionId];
  if (!entry) return res.status(400).json({ message: "Session invalide" });

  const userId = req.user.userId;
  if (userId !== entry.initiator && userId !== entry.target) {
    console.log(`🚫 Unauthorized getPeerMessages by ${userId} on ${sessionId}`);
    return res.status(403).json({ message: "Pas autorisé" });
  }

  const msgs = await Message.findAll({
    where: { sessionId },
    order: [["createdAt", "ASC"]],
  });
  console.log(`📨 Returning ${msgs.length} messages for ${sessionId}`);
  res.json(msgs);
};

module.exports = { sendPeerMessage, getPeerMessages };
