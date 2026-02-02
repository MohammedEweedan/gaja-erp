const { Sequelize, DataTypes } = require("sequelize");
require('dotenv').config();

const sequelize = new Sequelize('gj', 'sa', '@Gaja2024', {
  host: '102.213.182.8',
  dialect: 'mssql',
  dialectOptions: {
    options: {
      encrypt: false,
      trustServerCertificate: true
    }
  }
});

const Vendor = sequelize.define("ExtraClientTB", {
  ExtraClient_ID: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
      autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  Client_Name: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  Intial_Sold_Money: {
    type: DataTypes.REAL,
    allowNull: false
  },
  Intial_Sold_Gold: {
    type: DataTypes.REAL,
    allowNull: false
  }
}, {
  freezeTableName: true,
  timestamps: false
});

module.exports = Vendor;
