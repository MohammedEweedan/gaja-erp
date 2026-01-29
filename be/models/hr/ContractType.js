// models/hr/ContractType.js
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

class ContractType extends Model {}

ContractType.init(
  {
    id_contract_type: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
    contract_name: { type: DataTypes.STRING(100), allowNull: false },
    contract_code: { type: DataTypes.STRING(50), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: 'ContractType', tableName: 'ContractType', freezeTableName: true, timestamps: false }
);

module.exports = ContractType;
