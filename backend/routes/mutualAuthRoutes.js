const express = require("express");
const router = express.Router();
const authenticateToken = require("../middlewares/authenticateToken");
const mutualAuthController = require("../controllers/mutualAuthController");

router.post(
  "/request-challenge",
  authenticateToken,
  mutualAuthController.requestChallenge
);
router.post(
  "/verify-challenge",
  authenticateToken,
  mutualAuthController.verifyChallenge
);

module.exports = router;
