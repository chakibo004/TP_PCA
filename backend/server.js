// ============================= Backend: src/server.js =============================
const express = require("express");
const http = require("http");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const sequelize = require("./config/database.js");
const Users = require("./models/users");
const Message = require("./models/Message");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const authRoutes = require("./routes/authroutes");
const dhRoutes = require("./routes/Dhroutes");
const MessageRoutes = require("./routes/messageroutes");
const UserRoutes = require("./routes/userroutes");
require("dotenv").config();

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:4001",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.use("/users", UserRoutes);
app.use("/auth", authRoutes);
app.use("/dh", dhRoutes);
app.use("/message", MessageRoutes);
// Synchronisation et démarrage
const server = http.createServer(app);

// Initialize Socket.IO with CORS settings
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:4001",
    credentials: true,
  },
});

io.use((socket, next) => {
  console.log("Socket authentication attempt");

  // Get cookie from handshake
  const cookies = socket.handshake.headers.cookie;
  if (!cookies) {
    console.error("No cookies in handshake");
    return next(new Error("Authentication error: No cookies provided"));
  }

  // Parse cookies string with better logging
  const parseCookies = (cookieStr) => {
    const cookies = {};
    cookieStr.split(";").forEach((cookie) => {
      const parts = cookie.split("=");
      if (parts.length >= 2) {
        cookies[parts[0].trim()] = parts[1].trim();
      }
    });
    return cookies;
  };

  const parsedCookies = parseCookies(cookies);
  console.log("Parsed cookies:", Object.keys(parsedCookies));

  // Change from 'jwt' to 'token' to match the cookie name sent from the browser
  const token = parsedCookies.token;

  if (!token) {
    console.error("JWT token not found in cookies");
    return next(new Error("Authentication error: JWT not found"));
  }

  // Verify token
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("JWT verification failed:", err.message);
      return next(new Error("Authentication error: Invalid JWT"));
    }
    socket.user = decoded;
    console.log(`Socket authenticated for user ${decoded.userId}`);
    next();
  });
});
// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.user.userId}`);

  // Join user to their personal room
  socket.join(`user:${socket.user.userId}`);

  // Join a chat session room
  socket.on("join-session", (sessionId) => {
    socket.join(`session:${sessionId}`);
    console.log(`User ${socket.user.userId} joined session ${sessionId}`);
  });

  // Leave a chat session room
  socket.on("leave-session", (sessionId) => {
    socket.leave(`session:${sessionId}`);
    console.log(`User ${socket.user.userId} left session ${sessionId}`);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.user.userId}`);
  });
});

// Export io instance to be used in controllers
app.set("io", io);

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection established");
    await sequelize.sync();
    console.log("✅ Database synchronized");
    await Users.sync();
    await Message.sync();
    const PORT = process.env.PORT || 4000;
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();
