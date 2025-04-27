// routes/authroutes.js
const express = require("express");
const authenticateToken = require("../middlewares/authenticateToken");

const router = express.Router();
const {
    listUsers,
} = require("../controllers/UserController.js");
router.get("/", authenticateToken, listUsers);
module.exports = router;
