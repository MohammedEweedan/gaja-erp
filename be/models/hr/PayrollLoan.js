const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize('gj', 'sa', '@Gaja2024', {
  host: '102.213.182.8',
  dialect: 'mssql',
  dialectOptions: { options: { encrypt: false, trustServerCertificate: true } },
});

const PayrollLoan = sequelize.define('PayrollLoan', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  id_emp: { type: DataTypes.BIGINT, allowNull: false },
  principal: { type: DataTypes.DECIMAL(19,4), allowNull: false },
  remaining: { type: DataTypes.DECIMAL(19,4), allowNull: false },
  startYear: { type: DataTypes.INTEGER, allowNull: false },
  startMonth: { type: DataTypes.INTEGER, allowNull: false },
  monthlyPercent: { type: DataTypes.REAL, allowNull: false, defaultValue: 0.25 },
  capMultiple: { type: DataTypes.REAL, allowNull: false, defaultValue: 3 },
  skipMonths: { type: DataTypes.TEXT, allowNull: true }, // CSV of YYYY-MM values
  note: { type: DataTypes.STRING(200), allowNull: true },
  closed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'PayrollLoan',
  freezeTableName: true,
  timestamps: false,
});

module.exports = PayrollLoan;
