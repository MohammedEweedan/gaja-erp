const { Sequelize, DataTypes } = require("sequelize");
require("dotenv").config();

const sequelize    = new Sequelize('gj','sa', '@Gaja2024', {
  host: '102.213.182.8',  dialect: 'mssql',
  dialectOptions: {
    options: {
      encrypt: false,   
      trustServerCertificate: true
    }
  }
});

const Supplier_settlement = sequelize.define('Supplier_settlement', {
  id_settlement: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  date_settlement: {
    type: DataTypes.DATE,
    allowNull: false
  },
  client: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  Debit_Money: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: false,
    defaultValue: 0
  },
  Credit_Money: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: false,
    defaultValue: 0
  },
  Debit_Gold: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  Credit_Gold: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  Comment: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  Brand: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  Reference_number: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  ExchangeRate: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: false,
    defaultValue: 1.0
  }
  ,
  ExchangeRateToLYD: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: false,
    defaultValue: 1.0
  }
  ,

  Paidby: {
    type: DataTypes.INTEGER,
    allowNull: false,

  },
  discount_by_vendor: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: false,
    defaultValue: 0 
  },





}, {
  tableName: 'Supplier_settlement',
  timestamps: false
});

module.exports = Supplier_settlement;
