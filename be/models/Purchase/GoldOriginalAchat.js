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

const OriginalAchat = sequelize.define("OriginalAchat", {
  id_achat: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true
  },
  Comment_Achat: {
    type: DataTypes.STRING(DataTypes.TEXT),
    allowNull: true
  },
  Date_Achat: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  FullWeight: {
    type: DataTypes.REAL,
    allowNull: true
  },
  NetWeight: {
    type: DataTypes.REAL,
    allowNull: true
  },
  Usr: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  Brand: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  DocumentNo: {
    type: DataTypes.STRING(DataTypes.TEXT),
    allowNull: true
  },
  Stone_Details: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  Net_Details: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  Purity: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  PureWt: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  MakingStoneRate: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  MakingStoneValue: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  MetalValue: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  // New fields for approval
  IsApprouved: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: 'Accepted'

  },
  Approval_Date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  ApprouvedBy: {
    type: DataTypes.STRING, // nvarchar(MAX)
    allowNull: true
  },
  Comment: {
    type: DataTypes.STRING, // nvarchar(MAX)
    allowNull: true
  },

  attachmentUrl: {
    type: DataTypes.STRING, // nvarchar(MAX)
    allowNull: true
  },

  // Added fields
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
  cost_g: {
    type: DataTypes.DECIMAL(19, 4), // money type
    allowNull: true
  },
  Rate: {
    type: DataTypes.REAL,
    allowNull: true
  },
  cost_g_LYD: {
    type: DataTypes.DECIMAL(19, 4), // money type
    allowNull: true
  },
  ounceCost: {
    type: DataTypes.STRING, // nvarchar(MAX)
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

module.exports = OriginalAchat;
