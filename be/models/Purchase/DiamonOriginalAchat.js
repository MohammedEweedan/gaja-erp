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

const WachtchesOriginalAchat = sequelize.define("OriginalAchatDiamonds", {

  id_achat: {
    type: DataTypes.INTEGER,
    allowNull: false,
    autoIncrement: true, // <--- add this if not present
    primaryKey: true     // <--- add this if not present
  },
  carat: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  cut: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  color: {
    type: DataTypes.STRING(5),
    allowNull: true
  },
  clarity: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  shape: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  measurements: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  depth_percent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },

  Usr: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  table_percent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },

  girdle: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  culet: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  polish: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  symmetry: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  fluorescence: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  certificate_number: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  certificate_lab: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  certificate_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  laser_inscription: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  price_per_carat: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true
  },
  total_price: {
    type: DataTypes.VIRTUAL,
    get() {
      // Optionally, compute it in JS if you want
      return null;
    }
  },
  origin_country: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  image_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  video_url: {
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
  attachmentUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  Date_Achat: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  Brand: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  CODE_EXTERNAL: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  comment_edit: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  sharepoint_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  MakingCharge: {
    type: DataTypes.DECIMAL(19, 4), // money type
    allowNull: true
  },
  ShippingCharge: {
    type: DataTypes.DECIMAL(19, 4), // money type
    allowNull: true
  },
  TravelExpesenes: {
    type: DataTypes.DECIMAL(19, 4), // money type
    allowNull: true
  },
  Rate: {
    type: DataTypes.REAL,
    allowNull: true
  },
  Total_Price_LYD: {
    type: DataTypes.DECIMAL(19, 4), // money type
    allowNull: true
  },

  SellingPrice: {
    type: DataTypes.DECIMAL(19, 4), // money type
    allowNull: true
  },

  Design_art: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
   vendorsID: {
    type: DataTypes.BIGINT,
    allowNull: true
  },

   currencyRetail: {
    type: DataTypes.STRING,
    allowNull: true
  } 




   
}, {
  freezeTableName: true,
  timestamps: false
});

module.exports = WachtchesOriginalAchat;
