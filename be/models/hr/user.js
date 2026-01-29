const { Sequelize, DataTypes } = require("sequelize");
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
 

 

const User = sequelize.define("Utilisateur", {
  id_user: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  password: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  Action_user: {
    type: DataTypes.STRING(4000),
    allowNull: true
  },
  actived: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  Roles: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  ps: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  name_user: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  ref_emp: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  job: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  pic: {
    type: DataTypes.BLOB,
    allowNull: true
  },
  LinkP: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  InventoryCode: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  freezeTableName: true,
  timestamps: false
});

module.exports = User;
