const { Sequelize, Model, DataTypes } = require("sequelize");
const sequelize1 = new Sequelize('gj', 'sa', '@Gaja2024', {
  dialect: 'mssql'


});






const sequelize    = new Sequelize('gj','sa', '@Gaja2024', {
  host: '102.213.182.8',  dialect: 'mssql',
  dialectOptions: {
    options: {
      encrypt: false,   
      trustServerCertificate: true
    }
  }
});



const employee = sequelize.define("EMPLOYEE", {

  ID_EMP:
  {
    autoIncrement: true,
    type: DataTypes.BIGINT,
    allowNull: false,
    primaryKey: true
  },



  NAME: DataTypes.TEXT,
  STATE: DataTypes.BOOLEAN,
  Picture: DataTypes.BLOB('long'),
  Ref_emp: DataTypes.TEXT,
  investissement: DataTypes.TEXT,


}, {
  freezeTableName: true,
  timestamps: false,
});


module.exports = employee;