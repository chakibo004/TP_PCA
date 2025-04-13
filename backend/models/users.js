const { DataTypes } = require("sequelize");

const sequelize = require("../config/database");
const Users = sequelize.define("Users", {
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  password_hash: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
});

module.exports = Users;
