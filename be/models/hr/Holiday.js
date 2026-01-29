// models/hr/Holiday.js
const { Sequelize, Model, DataTypes, Op } = require('sequelize');
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

class Holiday extends Model {
  // Returns plain rows filtered by DATE_H in [start, end]
  static async getHolidaysBetweenDates(start, end) {
    // Normalize to YYYY-MM-DD strings
    const s = typeof start === 'string' ? start : new Date(start).toISOString().slice(0, 10);
    const e = typeof end === 'string' ? end : new Date(end).toISOString().slice(0, 10);
    const rows = await Holiday.findAll({
      where: {
        DATE_H: { [Op.between]: [s, e] },
      },
      order: [[ 'DATE_H', 'ASC' ]],
    });
    return rows.map(r => r.get({ plain: true }));
  }
}

Holiday.init(
  {
    // Legacy schema columns
    DATE_H: { type: DataTypes.DATEONLY, allowNull: true },
    COMMENT_H: { type: DataTypes.TEXT, allowNull: true },
    ID_HOLIDAYS: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
    IN_CALL: { type: DataTypes.BOOLEAN, allowNull: true },
  },
  { sequelize, modelName: 'Holiday', tableName: 'Holidays', freezeTableName: true, timestamps: false }
);

module.exports = Holiday;
