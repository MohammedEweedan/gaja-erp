// models/products/DiamondWatch.js
const { DataTypes, Sequelize } = require("sequelize");
require('dotenv').config();

const sequelize    = new Sequelize('gj','sa', '@Gaja2024', {
  host: '102.213.182.8',  dialect: 'mssql',
  dialectOptions: {
    options: {
      encrypt: false,   
      trustServerCertificate: true
    }
  }
});

const WachtchesOriginalAchat = sequelize.define("OriginalAchatWatches", {
  id_achat: {
    type: DataTypes.INTEGER,
    allowNull: false,
    autoIncrement: true,
    primaryKey: true
  },
  Brand: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  model: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  reference_number: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  serial_number: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  movement: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  caliber: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  gender: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  condition: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  diamond_total_carat: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  diamond_quality: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  diamond_setting: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  number_of_diamonds: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  custom_or_factory: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  case_material: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  case_size: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  bezel: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  bracelet_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  bracelet_material: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  dial_color: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  dial_style: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  crystal: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  water_resistance: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  functions: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  power_reserve: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  box_papers: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  warranty: {
    type: DataTypes.DATE,
    allowNull: true
  },
  retail_price: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true
  },
  sale_price: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true
  },
  image_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  certificate_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  Comment_Achat: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  DocumentNo: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  IsApprouved: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'Accepted'

  },
  Approval_Date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  ApprouvedBy: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  Comment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  attachmentUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  Date_Achat: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  Usr: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  sharepoint_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  MakingCharge: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true
  },
  ShippingCharge: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true
  },
  TravelExpesenes: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true
  },
  Rate: {
    type: DataTypes.REAL,
    allowNull: true
  },
  Total_Price_LYD: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true
  },
  SellingPrice: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true
  },
  vendorsID: {
    type: DataTypes.BIGINT,
    allowNull: true
  },

  manufactureDate: {
    type: DataTypes.DATE,
    allowNull: true
  },




  currencyRetail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  reaRetail: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: true
  },
  RateToLYD: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: true
  },


  ExpiryDate: {
    type: DataTypes.DATE,
    allowNull: true
  },


  warranty: {
    type: DataTypes.TEXT,
    allowNull: true
  },


  discount_by_vendor: {
    type: DataTypes.DECIMAL(18, 2), 
    allowNull: true,
    defaultValue: 0
  },




 common_local_brand: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  
}, {
  freezeTableName: true,
  timestamps: false
});

module.exports = WachtchesOriginalAchat;
