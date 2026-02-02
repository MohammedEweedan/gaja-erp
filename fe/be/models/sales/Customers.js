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

const Customers = sequelize.define("Client", {
  id_client: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  client_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  tel_client: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  Adresse: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(500),
    allowNull: true
  }
}, {
  freezeTableName: true,
  timestamps: false
});

module.exports = Customers;
