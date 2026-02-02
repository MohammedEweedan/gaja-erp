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
const Expenses = sequelize.define("Sarf_cash", {
  ID_transaction: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  date_trandsaction: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  Note: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  Project: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  Account_number1: {
    type: DataTypes.STRING(11),
    allowNull: true,
  },
  Account_number2: {
    type: DataTypes.STRING(11),
    allowNull: true,
  },
  montant: {
    type: DataTypes.DECIMAL(19, 4), // money type
    allowNull: true,
  },
  num_sarf: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  NUM_FACTURE: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  En_tete: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  NUM_CHECK: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  IS_OK: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  ref_emp: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  usr: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  
  id_supp_cuss: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  Cost_center: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  Note_en: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  sor: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  Elements: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  rate: {
    type: DataTypes.REAL,
    allowNull: true,
  },
  montant_net: {
    type: DataTypes.DECIMAL(19, 4), // money type
    allowNull: true,
  },
  client: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  PS: {
    type: DataTypes.INTEGER,
    allowNull: true,
  }
}, {
  freezeTableName: true,
  timestamps: false
});

module.exports = Expenses;
