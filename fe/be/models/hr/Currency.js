const { Sequelize, DataTypes } = require("sequelize");
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

const currency = sequelize.define("curr", {

  INt_c:
  {
    autoIncrement: true,
    type: DataTypes.BIGINT,
    allowNull: false,
    primaryKey: true
  },


  name_c: DataTypes.TEXT,
  Code_TIP: DataTypes.TEXT,
  is_local: DataTypes.BOOLEAN,


}, {
  freezeTableName: true,
  timestamps: false,
});

module.exports = sequelize.model("curr", currency);
