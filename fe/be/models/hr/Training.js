// models/hr/Training.js
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


class Training extends Model {}

Training.init(
  {
    ID_FORM: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
    DATE_S: { type: DataTypes.DATEONLY, allowNull: false },
    DATE_E: { type: DataTypes.DATEONLY, allowNull: false },
    TYPE: { type: DataTypes.STRING(100), allowNull: false },
    id_emp: { type: DataTypes.INTEGER, allowNull: false },
    NIVEAU: { type: DataTypes.STRING(50), allowNull: false },
    CONSEIL: { type: DataTypes.STRING(50), allowNull: false },
    ETABLISSEMENT: { type: DataTypes.STRING(50), allowNull: false },
  },
  { sequelize, modelName: 'Training', tableName: 'Training', freezeTableName: true, timestamps: false }
);

module.exports = Training;
