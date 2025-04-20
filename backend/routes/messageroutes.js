// routes/authroutes.js
const express = require("express");
const authenticateToken = require("../middlewares/authenticateToken");

const {
  getMessages,
  sendMessage,
} = require("../controllers/messageController");

const router = express.Router();
router.post("/message/send", authenticateToken, sendMessage);
router.get("/message/:sessionId", authenticateToken, getMessages);
module.exports = router;
