// routes/messageroutes.js
const express = require("express");
const authenticateToken = require("../middlewares/authenticateToken");

const router = express.Router();
const {
  sendPeerMessage,
  getPeerMessages,
} = require("../controllers/messagePeerController");

const {
  sendServerMessage,
  getServerMessages,
} = require("../controllers/messageServerController");

// Peer-to-peer messages
router.post("/peer/send", authenticateToken, sendPeerMessage);
router.get("/peer/:sessionId", authenticateToken, getPeerMessages);

// Server-assisted messages
router.post("/server/send", authenticateToken, sendServerMessage);
router.get("/server/:sessionId", authenticateToken, getServerMessages);

module.exports = router;
