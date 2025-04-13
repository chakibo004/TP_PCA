const express = require("express");
const sequelize = require("./config/database.js");
const Users = require("./models/users");
const authRoutes = require("./routes/authroutes");
const http = require("http");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());
app.use("/auth", authRoutes);
const server = http.createServer(app);

sequelize.sync().then(() => {
  console.log("✅ DB prête");
});

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection established");

    // Sync models
    await Users.sync();
    console.log("Database synchronized");

    server.listen(4000, "0.0.0.0", () => {
      console.log("Server running on port 3002");
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
