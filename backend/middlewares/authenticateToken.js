// middleware/authenticateToken.js
const jwt = require("jsonwebtoken");
require("dotenv").config();

const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: "Authentification requise" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Token invalide" });
    }
    req.user = user; // { userId, username, iat, exp }
    next();
  });
};

module.exports = authenticateToken;
