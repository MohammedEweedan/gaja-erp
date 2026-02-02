const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

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

// Inventory model (like invoice) with provided fields
const Inventory = sequelize.define(
	'Inventory',
	{
		// id_inv bigint Unchecked (NOT NULL) — assume primary key, auto-increment
		id_inv: {
			type: DataTypes.BIGINT,
			allowNull: false,
			autoIncrement: true,
			primaryKey: true,
		},
		// date_inv date Checked (NULL allowed)
		date_inv: {
			type: DataTypes.DATEONLY,
			allowNull: true,
		},
		// Teams nvarchar(MAX) Checked
		Teams: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		// ps int Checked
		ps: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		// id_art int Checked
		id_art: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		// date_time_check datetime Checked
		date_time_check: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		// checked_by nvarchar(MAX) Checked
		checked_by: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		// device nvarchar(50) Checked
		device: {
			type: DataTypes.STRING(50),
			allowNull: true,
		},
		// location nvarchar(MAX) Checked
		location: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		// ip_Address nvarchar(50) Checked
		ip_Address: {
			type: DataTypes.STRING(50),
			allowNull: true,
		},
			// is_active bit Checked
			is_active: {
				type: DataTypes.BOOLEAN,
				allowNull: true,
			},
	},
	{
		freezeTableName: true,
		timestamps: false,
	}
);

module.exports = Inventory;

