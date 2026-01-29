// models/Employee.js
const { Sequelize, DataTypes, Op } = require("sequelize");
const moment = require("moment");
const Vacation = require("./Vacation");

const sequelize = new Sequelize("gj", "sa", "@Gaja2024", {
  host: "102.213.182.8",
  dialect: "mssql",
  dialectOptions: {
    options: { encrypt: false, trustServerCertificate: true },
  },
});

// Helper: safe JSON parse for env toggles, etc.
const truthy = (v) => String(v ?? "").toLowerCase() === "true";

const Employee = sequelize.define(
  "EMPLOYEE1",
  {
    ID_EMP: {
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },

    // ===== Core identity / contact =====
    NAME: { type: DataTypes.STRING(100) },
    NAME_ENGLISH: { type: DataTypes.STRING(100) },
    ADDRESS: { type: DataTypes.STRING(100) },
    PHONE: { type: DataTypes.STRING(100) },
    EMAIL: { type: DataTypes.STRING(300) },
    COMMENT: { type: DataTypes.STRING(100) },

    // ===== Contract & job =====
    CONTRACT_START: { type: DataTypes.DATE },
    CONTRACT_END: { type: DataTypes.DATE },
    TITLE: { type: DataTypes.STRING(20) },
    COST_CENTER: { type: DataTypes.STRING(50) },
    PS: { type: DataTypes.INTEGER },

    // Manager relationship used by the UI — make it a numeric FK
    JOB_RELATION: { type: DataTypes.INTEGER, allowNull: true },

    TYPE_OF_RECRUITMENT: { type: DataTypes.STRING(20) },
    DEGREE: { type: DataTypes.STRING(30) },

    // ===== Demographics =====
    NATIONALITY: { type: DataTypes.STRING(30) },
    MARITAL_STATUS: { type: DataTypes.STRING(20) },
    NUM_OF_CHILDREN: { type: DataTypes.INTEGER },
    DATE_OF_BIRTH: { type: DataTypes.DATE },
    PLACE_OF_BIRTH: { type: DataTypes.STRING(500) },
    GENDER: { type: DataTypes.STRING(50) },
    BLOOD_TYPE: { type: DataTypes.STRING(50) },
    MOTHER_NAME_AR: { type: DataTypes.STRING(100) },

    // ===== IDs & docs =====
    NUM_CIN: { type: DataTypes.STRING(50) },
    NUM_NATIONAL: { type: DataTypes.STRING(50) },
    ISSUING_AUTH: { type: DataTypes.STRING(50) },
    FAM_BOOK_NUM: { type: DataTypes.STRING(50) },
    FAM_BOOK_ISSUING_AUTH: { type: DataTypes.STRING(50) },
    PASSPORT_NUM: { type: DataTypes.STRING(50) },
    PASSPORT_ISSUING_AUTH: { type: DataTypes.STRING(50) },
    DRIVER_LIC_NUM: { type: DataTypes.STRING(50) },
    SCIENTIFIC_CERT: { type: DataTypes.STRING(200) },
    // DB column is misspelled as DUCATION_CERT_URL; map it explicitly
    EDUCATION_CERT_URL: { type: DataTypes.STRING(500), field: "DUCATION_CERT_URL" },

    // ===== Compensation =====
    BASIC_SALARY: { type: DataTypes.DECIMAL(19, 4) },
    BASIC_SALARY_USD: { type: DataTypes.DECIMAL(19, 4) },

    FOOD: { type: DataTypes.DECIMAL(19, 4) },          // daily
    FUEL: { type: DataTypes.DECIMAL(19, 4) },          // daily
    COMMUNICATION: { type: DataTypes.DECIMAL(19, 4) }, // daily
    FOOD_ALLOWANCE: { type: DataTypes.DECIMAL(19, 4) }, // legacy daily

    GOLD_COMM: { type: DataTypes.STRING(50) },
    GOLD_COMM_VALUE: { type: DataTypes.REAL },
    DIAMOND_COMM_TYPE: { type: DataTypes.STRING(50) },
    DIAMOND_COMM: { type: DataTypes.REAL },

    BANK: { type: DataTypes.INTEGER },
    ACCOUNT_NUMBER: { type: DataTypes.STRING(30) },
    EMPLOYER_REF: { type: DataTypes.STRING(50) },
    INVESTMENT: { type: DataTypes.STRING(50) },
    FINANCE_NUM: { type: DataTypes.STRING(50) },

    // ===== Insurance =====
    TYPE_OF_INSURANCE: { type: DataTypes.STRING(30) },
    NUM_OF_INSURANCE: { type: DataTypes.STRING(30) },

    // ===== Employment state / timings =====
    STATE: { type: DataTypes.BOOLEAN },
    IS_FOREINGHT: { type: DataTypes.BOOLEAN },
    FINGERPRINT_NEEDED: { type: DataTypes.BOOLEAN },
    RENEWABLE_CONTRACT: { type: DataTypes.DATEONLY },

    ANNUAL_LEAVE_BAL: { type: DataTypes.INTEGER }, // manual override / initial seed
    T_START: { type: DataTypes.TIME },
    T_END: { type: DataTypes.TIME },

    // ===== Misc / prefs =====
    JOB_AIM: { type: DataTypes.TEXT },
    JOB_DESCRIPTION: { type: DataTypes.TEXT },
    REQUEST_DEGREE: { type: DataTypes.TEXT },
    PREFERRED_LANG: { type: DataTypes.TEXT },
    MEDICAL_COMMENT: { type: DataTypes.TEXT },
    OUTFIT_NUM: { type: DataTypes.STRING(50) },
    FOOTWEAR_NUM: { type: DataTypes.STRING(50) },
    num_kid: { type: DataTypes.STRING(50) }, // legacy

    // ===== Media =====
    PICTURE: { type: DataTypes.BLOB("long") },
    PICTURE_URL: { type: DataTypes.STRING(500) },

    // Fingerprint / device code mapping (used in attendance)
    ATTACHED_NUMBER: { type: DataTypes.STRING(50), allowNull: true },

    // ===== Timestamps (manual since timestamps=false) =====
    CREATED_AT: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    UPDATED_AT: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    freezeTableName: true,
    timestamps: false, // we maintain CREATED_AT / UPDATED_AT manually
    hasTrigger: true,
    hooks: {
      beforeCreate: (emp) => {
        emp.UPDATED_AT = new Date();
      },
      beforeUpdate: (emp) => {
        emp.UPDATED_AT = new Date();
      },
    },
  }
);

/**
 * Compute the base annual leave per policy:
 * - 45 days if age > 50 OR experience > 20 years
 * - otherwise 30 days
 */
Employee.prototype.getBaseAnnualLeaveDays = function () {
  const now = new Date();
  let age = null;
  let experience = null;

  if (this.DATE_OF_BIRTH) {
    const birth = new Date(this.DATE_OF_BIRTH);
    age = now.getFullYear() - birth.getFullYear();
    const hadBirthday =
      now.getMonth() > birth.getMonth() ||
      (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
    if (!hadBirthday) age -= 1;
  }

  if (this.CONTRACT_START) {
    const start = new Date(this.CONTRACT_START);
    experience = now.getFullYear() - start.getFullYear();
    const passedAnniv =
      now.getMonth() > start.getMonth() ||
      (now.getMonth() === start.getMonth() && now.getDate() >= start.getDate());
    if (!passedAnniv) experience -= 1;
  }

  const isSenior = (age != null && age > 50) || (experience != null && experience > 20);
  return isSenior ? 45 : 30;
};

/**
 * Compute used leave days from approved requests, excluding Fridays and holidays.
 * Returns a positive integer.
 */
Employee.prototype.getUsedLeaveDays = async function () {
  // Pull holidays if model exists
  let holidays = [];
  try {
    const Holiday = require("./Holiday");
    holidays = await Holiday.findAll({
      where: { HOLIDAY_DATE: { [Op.lte]: new Date() } },
      attributes: ["HOLIDAY_DATE"],
      raw: true,
    });
  } catch (e) {
    // optional model
  }
  const holidaySet = new Set(
    holidays
      .map((h) => moment(h.HOLIDAY_DATE).format("YYYY-MM-DD"))
      .filter(Boolean)
  );

  // Pull approved leave requests if model exists
  let leaveRequests = [];
  try {
    const LeaveRequest = require("./LeaveRequest");
    leaveRequests = await LeaveRequest.findAll({
      where: { ID_EMP: this.ID_EMP, STATUS: "Approved" },
      attributes: ["DATE_START", "DATE_END"],
      raw: true,
    });
  } catch (e) {
    // optional model
  }

  let used = 0;

  for (const lr of leaveRequests) {
    const start = moment(lr.DATE_START).startOf("day");
    const end = moment(lr.DATE_END).startOf("day");
    if (!start.isValid() || !end.isValid() || end.isBefore(start)) continue;

    // iterate inclusive
    for (let d = start.clone(); !d.isAfter(end); d.add(1, "day")) {
      const iso = d.isoWeekday(); // 1..7 (Mon..Sun)
      const key = d.format("YYYY-MM-DD");

      // Exclude Fridays (isoWeekday 5) and holidays
      if (iso === 5) continue;
      if (holidaySet.has(key)) continue;

      used += 1;
    }
  }

  return used;
};

/**
 * Compute current leave balance:
 * - If ANNUAL_LEAVE_BAL has a value, use it as the starting annual allocation,
 *   otherwise use the policy base (30/45).
 * - Subtract used leave days (excludes Fridays & holidays).
 * - Never returns less than 0.
 */
Employee.prototype.computeLeaveBalance = async function () {
  // Determine allocation
  const allocation =
    this.ANNUAL_LEAVE_BAL == null
      ? this.getBaseAnnualLeaveDays()
      : Number(this.ANNUAL_LEAVE_BAL) || 0;

  const used = await this.getUsedLeaveDays();
  const remaining = Math.max(allocation - used, 0);
  return { allocation, used, remaining };
};

// ===== Associations =====
const setupAssociations = () => {
  try {
    const LeaveRequest = require("./LeaveRequest");

    // Employee has many leave requests
    Employee.hasMany(LeaveRequest, {
      foreignKey: "ID_EMP",
      as: "leaveRequests",
    });

    LeaveRequest.belongsTo(Employee, {
      foreignKey: "ID_EMP",
      as: "employee",
    });
  } catch (error) {
    console.log("LeaveRequest model not found for associations");
  }

  // Self-referential: manager/subordinates via JOB_RELATION
  Employee.belongsTo(Employee, {
    as: "manager",
    foreignKey: "JOB_RELATION",
  });

  Employee.hasMany(Employee, {
    as: "subordinates",
    foreignKey: "JOB_RELATION",
  });

  // Vacations table links by lowercase id_emp
  try {
    Vacation.belongsTo(Employee, {
      foreignKey: "id_emp",
      as: "employee",
    });
  } catch (e) {
    // optional
  }
};

// Defer association setup to avoid circular require issues
setTimeout(setupAssociations, 100);

module.exports = Employee;
