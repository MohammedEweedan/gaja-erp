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

const ItemsPicture = sequelize.define("ACHAT_pic", {
  ID_PIC: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  id_art: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  PIC1: {
    type: DataTypes.BLOB, // SQL Server 'image' type
    allowNull: true
  },
  PIC2: {
    type: DataTypes.BLOB,
    allowNull: true
  },
  PIC3: {
    type: DataTypes.BLOB,
    allowNull: true
  },
  Added_by: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  Add_Date: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  freezeTableName: true,
  timestamps: false
});

module.exports = ItemsPicture;
