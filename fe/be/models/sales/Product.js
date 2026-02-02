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

const Produtcs = sequelize.define("Famille", {
  id_famille: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  desig_famille: {
    type: DataTypes.STRING(100),
    allowNull: false
  } 
 
}, {
  freezeTableName: true,
  timestamps: false
});

module.exports = Produtcs;
