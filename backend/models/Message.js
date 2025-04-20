// models/message.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Message = sequelize.define("Message", {
  sessionId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  senderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  ciphertext: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
});

module.exports = Message;
