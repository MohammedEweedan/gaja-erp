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

const DistributionPurchase = sequelize.define("DistributionPurchase", {
  distributionID: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  ps: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  Weight: {
    type: DataTypes.REAL,
    allowNull: false
  },
  distributionDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  usr: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  PurchaseID: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
,


  PurchaseType: {
    type: DataTypes.STRING(50),
    allowNull: false
  }

  ,

  distributionISOK: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  freezeTableName: true,
  timestamps: false
});

module.exports = DistributionPurchase;
