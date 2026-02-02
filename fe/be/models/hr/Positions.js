const { Sequelize, DataTypes } = require("sequelize");
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

const positions = sequelize.define("job", {
    id_job: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      job_name: {
        type: DataTypes.STRING(200),
        allowNull: true
      },
      year_job: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      Job_degree: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      Job_level: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      Job_title: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      Job_code: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      job_categories: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      NBR_YEAR_FOR_JOB: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    }, {
      freezeTableName: true,  
      timestamps: false       
    });
    

module.exports = sequelize.model("job", positions);
