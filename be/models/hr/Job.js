// models/Job.js
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

class Job extends Model {}

Job.init(
  {
    id_job: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
    job_name: { type: DataTypes.STRING(200), allowNull: false },
    year_job: { type: DataTypes.INTEGER, allowNull: false },
    Job_degree: { type: DataTypes.INTEGER, allowNull: false },
    Job_level: { type: DataTypes.STRING(50), allowNull: false },
    Job_title: { type: DataTypes.STRING(500), allowNull: false },
    Job_code: { type: DataTypes.STRING(50), allowNull: false },
    job_categories: { type: DataTypes.STRING(50), allowNull: false },
  },
  { sequelize, modelName: 'Job', tableName: 'job', freezeTableName: true, timestamps: false }
);

module.exports = Job;
