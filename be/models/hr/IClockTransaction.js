// models/hr/IClockTransaction.js
const { Sequelize, Model, DataTypes } = require('sequelize');

const sequelize = new Sequelize('fp', 'sa', '@Gaja2024', {
  host: '102.213.182.8',
  dialect: 'mssql',
  dialectOptions: {
    options: {
      encrypt: false,
      trustServerCertificate: true,
      useUTC: false,
    },
  },
  timezone: '+02:00',
});

class IClockTransaction extends Model {}

IClockTransaction.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    emp_code: { type: DataTypes.STRING(20), allowNull: false },
    punch_time: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    modelName: 'IClockTransaction',
    tableName: 'iclock_transaction',
    freezeTableName: true,
    timestamps: false,
  }
);

module.exports = IClockTransaction;
