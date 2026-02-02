// models/LeaveRequestActionLog.js

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
const LeaveRequest = require('./LeaveRequest');

class LeaveRequestActionLog extends Model {}

LeaveRequestActionLog.init(
  {
    ID_ACTION: {
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    ID_LEAVE: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: LeaveRequest,
        key: 'ID_LEAVE',
      },
    },
    ACTION_TYPE: {
      type: DataTypes.STRING(50), // E.g., Approved, Rejected
    },
    COMMENT: {
      type: DataTypes.STRING(500),
    },
    CREATED_AT: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'LeaveRequestActionLog',
    freezeTableName: true,
    timestamps: false,
  }
);

module.exports = LeaveRequestActionLog;
