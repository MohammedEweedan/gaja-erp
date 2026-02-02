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

const SourceMark = sequelize.define("SourceMark", {
    id_SourceMark: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  SourceMarketing: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  Status: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  }   
 
}, {
  freezeTableName: true,
  timestamps: false
});

module.exports = SourceMark;
