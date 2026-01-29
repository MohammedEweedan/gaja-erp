// models/hr/Specialite.js
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

class Specialite extends Model {}

Specialite.init(
  {
    id_specialite: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
    nom_specialite: { type: DataTypes.STRING(50), allowNull: false },
  },
  { sequelize, modelName: 'Specialite', tableName: 'Specialite', freezeTableName: true, timestamps: false }
);

module.exports = Specialite;
