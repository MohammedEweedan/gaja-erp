// models/hr/Level.js
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

class Level extends Model {}

Level.init(
  {
    id_m3: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
    desig_m3: { type: DataTypes.STRING(200), allowNull: false },
  },
  { sequelize, modelName: 'Level', tableName: 'Levels', freezeTableName: true, timestamps: false }
);

module.exports = Level;
