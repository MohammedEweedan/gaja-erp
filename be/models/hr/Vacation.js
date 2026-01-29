// models/hr/Vacation.js
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

class Vacation extends Model {}

Vacation.init(
  {
    int_con: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
    id_emp: { type: DataTypes.INTEGER, allowNull: false },
    id_can: { type: DataTypes.INTEGER, allowNull: false }, // leave code
    date_depart: { type: DataTypes.DATE, allowNull: false },
    date_end: { type: DataTypes.DATE, allowNull: false },
    date_retour: { type: DataTypes.DATE, allowNull: true },
    nbr_jour: { type: DataTypes.INTEGER, allowNull: false },
    date_creation: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    state: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'Pending' },
    jour_furier: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    directeur_direct: { type: DataTypes.INTEGER, allowNull: true },
    directeur_generale: { type: DataTypes.INTEGER, allowNull: true },
    Cause: { type: DataTypes.STRING(500), allowNull: true },
    id_view: { type: DataTypes.BOOLEAN, allowNull: true },
    COMMENT: { type: DataTypes.TEXT, allowNull: true },
    NEW_SOLDE: { type: DataTypes.STRING(50), allowNull: true },
    SOLDE_INITIAL: { type: DataTypes.STRING(50), allowNull: true },
    usr: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, modelName: 'Vacation', tableName: 'Vacations', freezeTableName: true, timestamps: false }
);

module.exports = Vacation;
