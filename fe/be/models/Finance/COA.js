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
const Accounts = sequelize.define("Master", {
  IND: {
    type: DataTypes.INTEGER,
    allowNull: false,
    autoIncrement: true,
    primaryKey: true,
  },
  Acc_No: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  Name_M: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  Date_m: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  State: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  solde_initiale: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: false,
  },
  type_acc: {
    type: DataTypes.STRING(2),
    allowNull: false,
  },
  ancien_acc_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  percent_budget: {
    type: DataTypes.REAL,
    allowNull: false,
  },
  solde_by_currency: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: false,
  },
  d1: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  d2: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  L10: {
    type: DataTypes.INTEGER,
    allowNull: false,
  }
}, {
  freezeTableName: true,
  timestamps: false,
});

module.exports = Accounts;
