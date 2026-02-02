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

const gl = sequelize.define("YearTran", {
  Ind: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true
  },
  Acc_No: {
    type: DataTypes.STRING(11),
    allowNull: false
  },
  KidNoT: {
    type: DataTypes.STRING(6),
    allowNull: false
  },
  Date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  Cridt: {
    type: DataTypes.DECIMAL(18, 3),
    allowNull: false
  },
  Dibt: {
    type: DataTypes.DECIMAL(18, 3),
    allowNull: false
  },
  Note: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  NUM_FACTURE: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  ENTETE: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  SOURCE: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  is_closed: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  check_number: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  usr: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  ref_emp: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  num_sarf: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  DATE_FACT: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  fl: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  Cridt_Curr: {
    type: DataTypes.DECIMAL(19, 4), // money
    allowNull: false
  },
  Dibt_Curr: {
    type: DataTypes.DECIMAL(19, 4), // money
    allowNull: false
  },
  
  Id_Cost_Center: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  id_supp_cuss: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
   
  Cridt_Curr_A: {
    type: DataTypes.DECIMAL(19, 4), // money
    allowNull: false
  },
  Dibt_Curr_A: {
    type: DataTypes.DECIMAL(19, 4), // money
    allowNull: false
  },
  Cridt_Curr_B: {
    type: DataTypes.DECIMAL(19, 4), // money
    allowNull: false
  },
  Dibt_Curr_B: {
    type: DataTypes.DECIMAL(19, 4), // money
    allowNull: false
  },
  rate: {
    type: DataTypes.REAL,
    allowNull: false
  },
  date_effect: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  sor_1: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  fll: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  original_value_cridt: {
    type: DataTypes.DECIMAL(19, 4), // money
    allowNull: false
  },
  original_value_dibt: {
    type: DataTypes.DECIMAL(19, 4), // money
    allowNull: false
  },
  Curr_riginal_value: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  MrkzName: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  NUM_SARFF: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  CLIENT: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  PS: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  freezeTableName: true,
  timestamps: false,
});


// Define associations
const COA = require('./COA');
const User = require('../../models/hr/user');
if (COA && COA.associate === undefined) {
  gl.belongsTo(COA, { foreignKey: 'Acc_No', targetKey: 'Acc_No', as: 'coa' });
}
if (User && User.associate === undefined) {
  gl.belongsTo(User, { foreignKey: 'usr', targetKey: 'id_user', as: 'user' });
}

module.exports = gl;
