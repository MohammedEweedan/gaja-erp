const { Sequelize, DataTypes } = require("sequelize");
require('dotenv').config();

const sequelize    = new Sequelize('gj','sa', '@Gaja2024', {
  host: '102.213.182.8',  dialect: 'mssql',
  dialectOptions: {
    options: {
      encrypt: false,   
      trustServerCertificate: true
    }
  }
});

const ApprovalRequests = sequelize.define('ApprovalRequests', {
  IDApprovalRequests: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  request_by: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  date_request: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  type_request: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  approuved_by: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  date_approval: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  Notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  AutoComment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  time_request: {
    type: DataTypes.TIME,
    allowNull: true,
   
  },
usr: {
    type: DataTypes.INTEGER,
    allowNull: true,
  
  },

 Refrences_Number: {
    type: DataTypes.TEXT,
    allowNull: true,
  
  },
 Is_view: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  
  },

  
}, {
  tableName: 'ApprovalRequests',
  timestamps: false
});

module.exports = ApprovalRequests;
