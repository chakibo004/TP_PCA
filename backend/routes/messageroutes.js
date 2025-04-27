// routes/authroutes.js
const express = require("express");
const authenticateToken = require("../middlewares/authenticateToken");

const router = express.Router();
const {
  sendPeerMessage,
  getPeerMessages,
} = require("../controllers/messagePeerController");

router.post("/peer/send", authenticateToken, sendPeerMessage);
router.get("/peer/:sessionId", authenticateToken, getPeerMessages);

module.exports = router;
