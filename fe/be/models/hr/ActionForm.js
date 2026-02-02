// models/hr/ActionForm.js
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

class ActionForm extends Model {}

ActionForm.init(
  {
    Id_transaction: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
    Date_transaction: { type: DataTypes.DATEONLY, allowNull: false },
    Usr: { type: DataTypes.INTEGER, allowNull: false },
    id_emp: { type: DataTypes.INTEGER, allowNull: false },
    old_basic_salary: { type: DataTypes.DECIMAL(19, 4), allowNull: false },
    new_basic_salary: { type: DataTypes.DECIMAL(19, 4), allowNull: false },
    old_job: { type: DataTypes.STRING(500), allowNull: false },
    new_job: { type: DataTypes.STRING(500), allowNull: false },
    old_num_job: { type: DataTypes.STRING(50), allowNull: false },
    new_num_job: { type: DataTypes.STRING(50), allowNull: false },
    old_degree: { type: DataTypes.STRING(50), allowNull: false },
    new_degree: { type: DataTypes.STRING(50), allowNull: false },
    old_level_candidate: { type: DataTypes.STRING(50), allowNull: false },
    new_level_candidate: { type: DataTypes.STRING(50), allowNull: false },
    add_value: { type: DataTypes.DECIMAL(19, 4), allowNull: false },
    comment: { type: DataTypes.TEXT, allowNull: false },
    Evaluation_EMP: { type: DataTypes.STRING(50), allowNull: false },
  },
  { sequelize, modelName: 'ActionForm', tableName: 'Action_form', freezeTableName: true, timestamps: false }
);

module.exports = ActionForm;
