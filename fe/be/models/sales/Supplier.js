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

const Supplier = sequelize.define("Fournisseur", {
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
  Solde_initial: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false
  },
  code_supplier: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  STATE_GOL_DIAMON: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  TYPE_SUPPLIER: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  Price_G_Gold: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  Percentage_Diamond: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  Price_G_Gold_Sales: {
    type: DataTypes.FLOAT,
    allowNull: true
  } 
}, {
  freezeTableName: true,
  timestamps: false
});

module.exports = Supplier;
