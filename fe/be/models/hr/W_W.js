const { Sequelize, Model, DataTypes } = require("sequelize");
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

const ww = sequelize.define("WADH3_WADHIFI", {

    int_can:
    {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true
    },

 
    desig_can: DataTypes.TEXT,
    code: DataTypes.TEXT ,
}, {
    freezeTableName: true,
    timestamps: false,
});

module.exports = sequelize.model("WADH3_WADHIFI", ww);
