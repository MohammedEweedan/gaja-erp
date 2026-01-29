// models/hr/Timesheet.js
const { Sequelize, Model, DataTypes } = require('sequelize');

const sequelize = new Sequelize('gj', 'sa', '@Gaja2024', {
  host: '102.213.182.8',
  dialect: 'mssql',
  dialectOptions: {
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  },
  logging: false,
});

const shape = {
  id_tran: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
  id_emp:  { type: DataTypes.INTEGER, allowNull: false },
  // month anchor
  DATE_JS: { type: DataTypes.DATEONLY, allowNull: false },

  // These exist in your table and are NOT NULL → give defaults here too
  Comment: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
  nbr_h:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
};

// Daily NOT NULL text columns → always default to ''
for (let d = 1; d <= 31; d++) {
  shape[`j_${d}`]   = { type: DataTypes.STRING(5),   allowNull: false, defaultValue: '' };
  shape[`R_${d}`]   = { type: DataTypes.STRING(5),   allowNull: false, defaultValue: '' };
  shape[`comm${d}`] = { type: DataTypes.STRING(500), allowNull: false, defaultValue: '' };
}

// Punches (nullable)
for (let d = 1; d <= 31; d++) {
  shape[`E${d}`] = { type: DataTypes.DATE, allowNull: true };
  shape[`S${d}`] = { type: DataTypes.DATE, allowNull: true };
}

class Timesheet extends Model {}
Timesheet.init(shape, {
  sequelize,
  modelName: 'Timesheet',
  tableName: 'TS',
  freezeTableName: true,
  timestamps: false,
});

module.exports = Timesheet;
