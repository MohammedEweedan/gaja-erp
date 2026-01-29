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

const Revenue = sequelize.define("Account_cl", {
  id_acc_cli: {
    type: DataTypes.INTEGER,
    allowNull: false,
    autoIncrement: true,
    primaryKey: true,
  },
  id_client: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  montant: {
    type: DataTypes.DECIMAL(19, 4), // money type, use high precision
    allowNull: true,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  comment: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  usr: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  id_commercial: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  commition: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: true,
  },
  rate: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: true,
  },
  Debit: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  IS_OK: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  ps: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  montant_currency: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: true,
  },
  currency: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  credit: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  is_watches: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: true, // Default value for is_watches
  }
}, {
  freezeTableName: true,
  timestamps: false
});

module.exports = Revenue;
