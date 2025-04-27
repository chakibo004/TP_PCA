// controllers/messageServerController.js
const Message = require("../models/Message");
const { serverSessionKeys } = require("./dhServerController");

const sendServerMessage = async (req, res) => {
  console.log("⇨ POST /message/server/send body:", req.body);
  const { sessionId, ciphertext } = req.body;

  if (!sessionId || !ciphertext) {
    return res.status(400).json({ message: "Champs manquants" });
  }

  const session = serverSessionKeys[sessionId];
  if (!session) {
    return res.status(400).json({ message: "Session invalide" });
  }

  const userId = req.user.userId;
  if (userId !== session.initiator && userId !== session.target) {
    console.log(
      `🚫 Unauthorized sendServerMessage by ${userId} on ${sessionId}`
    );
    return res.status(403).json({ message: "Pas autorisé" });
  }

  const message = await Message.create({
    sessionId,
    senderId: userId,
    ciphertext,
    isServerSession: true, // Add flag to distinguish between peer and server sessions
  });

  console.log(
    `✅ Message saved for server session ${sessionId} by user ${userId}`
  );

  // Get the io instance from the app
  const io = req.app.get("io");

  // Emit to the session room
  io.to(`session:${sessionId}`).emit("new-message", {
    id: message.id,
    sessionId,
    senderId: userId,
    ciphertext,
    createdAt: message.createdAt,
    isServerSession: true,
  });

  res.status(201).json({ message: "Message envoyé (server-assisted)" });
};

const getServerMessages = async (req, res) => {
  console.log("⇨ GET /message/server/:sessionId params:", req.params);
  const { sessionId } = req.params;

  const session = serverSessionKeys[sessionId];
  if (!session) {
    return res.status(400).json({ message: "Session invalide" });
  }

  const userId = req.user.userId;
  if (userId !== session.initiator && userId !== session.target) {
    console.log(
      `🚫 Unauthorized getServerMessages by ${userId} on ${sessionId}`
    );
    return res.status(403).json({ message: "Pas autorisé" });
  }

  const msgs = await Message.findAll({
    where: {
      sessionId,
      isServerSession: true,
    },
    order: [["createdAt", "ASC"]],
  });

  console.log(`📨 Returning ${msgs.length} server messages for ${sessionId}`);
  res.json(msgs);
};

module.exports = { sendServerMessage, getServerMessages };
