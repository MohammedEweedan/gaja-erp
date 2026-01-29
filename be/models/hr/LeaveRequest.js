// models/LeaveRequest.js

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

class LeaveRequest extends Model {}

LeaveRequest.init(
  {
    ID_LEAVE: {
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    ID_EMP: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'EMPLOYEE', // Use table name instead of model reference
        key: 'ID_EMP',
      },
    },
    DATE_START: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    DATE_END: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    NUM_DAYS: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    LEAVE_TYPE: {
      type: DataTypes.STRING(50),
      allowNull: false, // E.g., Annual, Sick, etc.
    },
    STATUS: {
      type: DataTypes.STRING(50),
      allowNull: false, // E.g., Pending, Approved, Rejected
      defaultValue: 'Pending',
    },
    COMMENT: {
      type: DataTypes.STRING(500),
    },
    CREATED_AT: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    UPDATED_AT: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      onUpdate: 'CURRENT_TIMESTAMP',
    },
  },
  {
    sequelize,
    modelName: 'LeaveRequest',
    tableName: 'LeaveRequest', // Make sure table name is consistent
    freezeTableName: true,
    timestamps: false,
    hooks: {
      beforeCreate: async (leaveRequest) => {
        // Calculate NUM_DAYS automatically if not provided
        if (!leaveRequest.NUM_DAYS && leaveRequest.DATE_START && leaveRequest.DATE_END) {
          const moment = require('moment');
          const startDate = moment(leaveRequest.DATE_START);
          const endDate = moment(leaveRequest.DATE_END);
          leaveRequest.NUM_DAYS = endDate.diff(startDate, 'days') + 1;
        }
      },
      beforeUpdate: async (leaveRequest) => {
        // Recalculate NUM_DAYS if dates are updated
        if (leaveRequest.changed('DATE_START') || leaveRequest.changed('DATE_END')) {
          const moment = require('moment');
          const startDate = moment(leaveRequest.DATE_START);
          const endDate = moment(leaveRequest.DATE_END);
          leaveRequest.NUM_DAYS = endDate.diff(startDate, 'days') + 1;
        }
      }
    }
  }
);

module.exports = LeaveRequest;