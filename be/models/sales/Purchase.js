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

const Purchase = sequelize.define("ACHAT", {
  id_fact: {
    type: DataTypes.BIGINT,
    allowNull: false,
    autoIncrement: true,
    primaryKey: true
  },
  date_fact: {
    type: DataTypes.DATE,
    allowNull: false
  },
  client: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  id_art: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  qty: {
    type: DataTypes.DECIMAL(18, 3),
    allowNull: false
  },

  Full_qty: {
    type: DataTypes.DECIMAL(18, 3),
    allowNull: false
  },


  
  Unite: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  num_fact: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  usr: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  d_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  Design_art: {
    type: DataTypes.TEXT,  // For large text (nvarchar(MAX))
    allowNull: true
  },
  Color_Gold: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  Color_Rush: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  Cost_Currency: {
    type: DataTypes.DOUBLE,
    allowNull: false
  },
  RATE: {
    type: DataTypes.REAL,
    allowNull: false
  },
  Cost_Lyd: {
    type: DataTypes.DOUBLE,
    allowNull: false
  },
  Selling_Price_Currency: {
    type: DataTypes.DOUBLE,
    allowNull: false
  },
  CODE_EXTERNAL: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  Selling_Rate: {
    type: DataTypes.DOUBLE,
    allowNull: false
  },
  is_selled: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  ps: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  IS_OK: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  COMMENT: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  comment_edit: {
    type: DataTypes.TEXT,  // For large text (nvarchar(MAX))
    allowNull: true
  },
  date_inv: {
    type: DataTypes.DATE,
    allowNull: true
  },
  CURRENCY: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  General_Comment: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  MakingCharge: {
    type: DataTypes.DOUBLE,
    allowNull: true
  },
  ShippingCharge: {
    type: DataTypes.DOUBLE,
    allowNull: true
  },
  TravelExpesenes: {
    type: DataTypes.DOUBLE,
    allowNull: true
  },
  cost_g: {
    type: DataTypes.DOUBLE,
    allowNull: true
  },
  ExtraClient: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  Model: {
    type: DataTypes.TEXT,  // For large text (nvarchar(MAX))
    allowNull: true
  },
  Serial_Number: {
    type: DataTypes.TEXT,  // For large text (nvarchar(MAX))
    allowNull: true
  },
  WarrantyDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  Notes: {
    type: DataTypes.TEXT,   
    allowNull: true
  },
  Original_Invoice: {
    type: DataTypes.TEXT,   
    allowNull: true
  },



  
}, {
  freezeTableName: true,
  timestamps: false
});

module.exports = Purchase;
