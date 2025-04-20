// ============================= Backend: src/server.js =============================
const express = require("express");
const http = require("http");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const sequelize = require("./config/database.js");
const Users = require("./models/users");
const Message = require("./models/Message");

const authRoutes = require("./routes/authroutes");
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

app.use("/auth", authRoutes);

// Synchronisation et démarrage
const server = http.createServer(app);
(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection established");
    await sequelize.sync();
    console.log("✅ Database synchronized");
    await Users.sync({ alter: true });
    await Message.sync({ alter: true });
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
