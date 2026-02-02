const { Sequelize, DataTypes } = require("sequelize");

const sequelize    = new Sequelize('gj','sa', '@Gaja2024', {
  host: '102.213.182.8',  dialect: 'mssql',
  dialectOptions: {
    options: {
      encrypt: false,   
      trustServerCertificate: true
    }
  }
});

const Ps = sequelize.define("P_sales", {
  Id_point: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  name_point: {
    type: DataTypes.STRING(100),
    allowNull: false
  }  
  ,
  Email: {
    type: DataTypes.STRING(100),
    allowNull: false
  }  
}, {
  freezeTableName: true,
  timestamps: false
});

module.exports = Ps;
