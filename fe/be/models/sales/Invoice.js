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

const Invoice = sequelize.define("Facture", {
  id_fact: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  date_fact: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  num_fact: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  client: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  mode_fact: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  id_art: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  prix_vente: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: true
  },
  prix_vente_remise: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: true
  },
  usr: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  COMMENT: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  d_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  IS_OK: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  rate: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  remise: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  is_printed: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  ps: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  phone_client: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  total_remise: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: true
  },
  qty: {
    type: DataTypes.DECIMAL(18, 3),
    allowNull: true
  },
  total_remise_final: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: true
  },
  currency: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  amount_currency: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: true
  },
  amount_lyd: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: true
  },
  amount_EUR: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: true
  },
  amount_currency_LYD: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: true
  },
  amount_EUR_LYD: {
    type: DataTypes.CHAR(10),
    allowNull: true
  },
  accept_discount: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  return_chira: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  comment_chira: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  usr_receive_chira: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  id_box1: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  id_box2: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  id_box3: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  IS_GIFT: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  IS_WHOLE_SALE: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  USD_Rate: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  EURO_Rate: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  TOTAL_INV_FROM_DIAMOND: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: true
  },
  is_chira: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  is_request: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  is_ok_commission_extra: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  client_redirected: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  SourceMark: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  picint: {
    type: DataTypes.INTEGER,
    allowNull: true
  },


  remise_per: {
    type: DataTypes.FLOAT,
    allowNull: true
  },

 





  total_remise_final_lyd: {
    type: DataTypes.DECIMAL(19, 4),
    allowNull: true
  },
}, {
  freezeTableName: true,
  timestamps: false,
  hasTrigger: true,   
});

module.exports = Invoice;