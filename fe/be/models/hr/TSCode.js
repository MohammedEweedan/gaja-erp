// models/hr/TSCode.js
const { Sequelize, Model, DataTypes } = require('sequelize');
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

class TSCode extends Model {}

TSCode.init(
  {
    int_can: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
    desig_can: { type: DataTypes.STRING(50), allowNull: false },
    code: { type: DataTypes.STRING(10), allowNull: false },
    max_day: { type: DataTypes.INTEGER, allowNull: false },
    Rule_days: { type: DataTypes.TEXT, allowNull: false },
    // New explicit columns (nullable or with defaults in DB)
    description: { type: DataTypes.STRING(500), allowNull: true },
    color: { type: DataTypes.STRING(16), allowNull: true },
    food_allowance: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    comm_allowance: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    trans_allowance: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { sequelize, modelName: 'TSCode', tableName: 'TS_Codes', freezeTableName: true, timestamps: false }
);

module.exports = TSCode;
