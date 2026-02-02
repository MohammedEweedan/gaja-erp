// services/LeaveService.js
const { Op } = require('sequelize');
const moment = require('moment');
const Employee = require('../models/hr/employee1.js');   // keep your existing employee model
const Vacation = require('../models/hr/Vacation');       // NEW: Vacations table (per PDF)
const Holiday = require('../models/hr/Holiday');         // UPDATED: Holidays table (per PDF)
const TSCode = require('../models/hr/TSCode');           // NEW: TS_Codes table (per PDF)
const {
  countWorkingDaysExcludingFridaysAndHolidays: countWorkingDaysEff,
  getExpandedHolidaysBetween,
} = require('../utils/leaveDayEngine');

class LeaveService {
  /**
   * Helper: 30/45-day entitlement rule
   */
  static _entitlementFromEmp(emp) {
    const now = new Date();
    const dob = emp.DATE_OF_BIRTH ? new Date(emp.DATE_OF_BIRTH) : null;
    const hired = emp.CONTRACT_START ? new Date(emp.CONTRACT_START) : null;

    const age = dob ? Math.floor((now - dob) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
    const exp = hired ? Math.floor((now - hired) / (365.25 * 24 * 60 * 60 * 1000)) : 0;

    return (age > 50 || exp > 20) ? 45 : 30;
  }

  /**
   * Helper: fetch holidays in range
   */
  static async _holidaysBetween(start, end) {
    return Holiday.findAll({
      where: { DATE_H: { [Op.between]: [start, end] } },
      order: [['DATE_H', 'ASC']]
    });
  }

  /**
   * Helper: count working days excluding Fridays + holidays (PDF)
   */
  static async _countWorkingDays(startDate, endDate) {
    const sISO = new Date(startDate).toISOString().slice(0, 10);
    const eISO = new Date(endDate).toISOString().slice(0, 10);

    const res = await countWorkingDaysEff(sISO, eISO);
    return {
      workingDays: res.effectiveDays,
      holidayHits: res.holidayCount,
      holidays: await getExpandedHolidaysBetween(sISO, eISO),
    };
  }

  static _inclusiveDays(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
    const startUtc = Date.UTC(s.getFullYear(), s.getMonth(), s.getDate());
    const endUtc = Date.UTC(e.getFullYear(), e.getMonth(), e.getDate());
    if (endUtc < startUtc) return 0;
    return Math.floor((endUtc - startUtc) / 86400000) + 1;
  }

  static _isSickLeave(codeRow) {
    if (!codeRow) return false;
    const code = String(codeRow.code || "").trim().toUpperCase();
    const label = String(codeRow.desig_can || "").trim().toUpperCase();
    return code === "SL" || label.includes("SICK");
  }

  /**
   * Request a new leave (creates row in Vacations)
   * leaveData: { employeeId, startDate, endDate, leaveCode?, leaveType?, reason? }
   * - leaveCode is TS_Codes.int_can (preferred)
   * - If leaveCode not provided, we try leaveType against TS_Codes.code or desig_can
   */
  static async requestLeave(leaveData) {
    const { employeeId, startDate, endDate, leaveCode, leaveType, reason } = leaveData;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!(start instanceof Date) || isNaN(start)) throw new Error('Invalid startDate');
    if (!(end instanceof Date) || isNaN(end)) throw new Error('Invalid endDate');
    if (start > end) throw new Error('End date must be after start date');

    // Employee
    const employee = await Employee.findByPk(employeeId, {
      attributes: ['ID_EMP', 'NAME', 'CONTRACT_START', 'DATE_OF_BIRTH']
    });
    if (!employee) throw new Error('Employee not found');

    // Map leave code
    let codeRow = null;
    if (leaveCode != null) {
      codeRow = await TSCode.findByPk(leaveCode);
      if (!codeRow) throw new Error(`Leave code not found: ${leaveCode}`);
    } else if (leaveType) {
      codeRow = await TSCode.findOne({
        where: {
          [Op.or]: [{ code: leaveType }, { desig_can: leaveType }]
        }
      });
      if (!codeRow) throw new Error(`Leave type not found: ${leaveType}`);
    } else {
      throw new Error('leaveCode or leaveType is required');
    }

    // Days calc
    const { workingDays, holidayHits } = await this._countWorkingDays(start, end);
    const leaveDays = this._isSickLeave(codeRow)
      ? this._inclusiveDays(start, end)
      : workingDays;

    // Enforce TS_Codes.max_day if provided
    if (codeRow.max_day != null && leaveDays > codeRow.max_day) {
      throw new Error(`Requested days (${leaveDays}) exceed max allowed (${codeRow.max_day}) for code ${codeRow.code}`);
    }

    // Entitlement & used this year
    const entitlement = this._entitlementFromEmp(employee);
    const year = new Date().getFullYear();
    const startOfYear = new Date(`${year}-01-01`);
    const endOfYear = new Date(`${year}-12-31`);

    const approvedThisYear = await Vacation.findAll({
      where: {
        id_emp: employeeId,
        state: 'Approved',
        date_depart: { [Op.between]: [startOfYear, endOfYear] }
      },
      attributes: ['nbr_jour']
    });
    const used = approvedThisYear.reduce((s, r) => s + (r.nbr_jour || 0), 0);
    if (used + leaveDays > entitlement) {
      throw new Error(`Insufficient leave balance. Entitlement=${entitlement}, Used=${used}, Requested=${leaveDays}`);
    }

    // Create Vacation row
    const row = await Vacation.create({
      id_emp: employeeId,
      id_can: codeRow.int_can,
      date_depart: start,
      date_end: end,
      date_retour: moment(end).add(1, 'day').toDate(), // return date (next day)
      nbr_jour: leaveDays,
      date_creation: new Date(),
      state: 'Pending',
      jour_furier: holidayHits,
      COMMENT: reason ?? null,
      Cause: reason ?? null,
      usr: null
    });

    return { ...row.toJSON(), workingDays: leaveDays };
  }

  /**
   * Approve or reject a leave request
   * status: 'approved' | 'rejected' (case-insensitive)
   */
  static async updateLeaveStatus(leaveId, status, approverId, comment = '') {
    const row = await Vacation.findByPk(leaveId);
    if (!row) throw new Error('Leave request not found');

    const normalized = status
      ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
      : row.state;

    await row.update({
      state: normalized,
      COMMENT: comment || row.COMMENT,
      directeur_direct: approverId ?? row.directeur_direct
    });

    return row;
  }

  /**
   * Get leave balance for an employee (derived, no EMPLOYEE1 balance fields)
   */
  static async getLeaveBalance(employeeId) {
    const emp = await Employee.findByPk(employeeId, {
      attributes: ['ID_EMP', 'NAME', 'CONTRACT_START', 'DATE_OF_BIRTH']
    });
    if (!emp) throw new Error('Employee not found');

    const entitlement = this._entitlementFromEmp(emp);

    const year = new Date().getFullYear();
    const startOfYear = new Date(`${year}-01-01`);
    const endOfYear = new Date(`${year}-12-31`);

    const leaves = await Vacation.findAll({
      where: {
        id_emp: employeeId,
        state: 'Approved',
        date_depart: { [Op.between]: [startOfYear, endOfYear] }
      },
      attributes: [
        'int_con', 'id_can', 'state', 'date_depart', 'date_end', 'nbr_jour'
      ],
      order: [['date_depart', 'DESC']]
    });

    const used = leaves.reduce((s, l) => s + (l.nbr_jour || 0), 0);
    const remaining = Math.max(0, entitlement - used);

    const today = new Date();
    const history = leaves.map(l => {
      const ongoing = l.date_depart <= today && today <= l.date_end;
      return { ...l.toJSON(), uiStatus: ongoing ? 'Ongoing' : 'Expired' };
    });

    return {
      employeeId: emp.ID_EMP,
      employeeName: emp.NAME,
      entitlement,
      used,
      remaining,
      leaveHistory: history
    };
  }

  /**
   * Team leave calendar (Approved Vacations overlapping range)
   */
  static async getTeamLeaveCalendar(managerId, startDate, endDate) {
    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Team members (expects MANAGER_ID on employee1 table)
    const team = await Employee.findAll({
      where: { MANAGER_ID: managerId },
      attributes: ['ID_EMP', 'NAME']
    });
    if (!team.length) return [];

    const ids = team.map(t => t.ID_EMP);

    const leaves = await Vacation.findAll({
      where: {
        id_emp: { [Op.in]: ids },
        state: 'Approved',
        [Op.or]: [
          { date_depart: { [Op.between]: [start, end] } },
          { date_end:    { [Op.between]: [start, end] } },
          { [Op.and]: [{ date_depart: { [Op.lte]: start } }, { date_end: { [Op.gte]: end } }] }
        ]
      },
      order: [['date_depart', 'ASC']]
    });

    const nameById = new Map(team.map(t => [t.ID_EMP, t.NAME]));

    return leaves.map(l => ({
      id: l.int_con,
      title: `${nameById.get(l.id_emp) || ''} - Code ${l.id_can}`,
      start: l.date_depart,
      end: moment(l.date_end).add(1, 'day').toDate(), // exclusive end
      allDay: true,
      extendedProps: {
        employeeId: l.id_emp,
        employeeName: nameById.get(l.id_emp) || '',
        code: l.id_can,
        status: l.state,
        duration: l.nbr_jour
      }
    }));
  }

  /**
   * Calculate working days utility (kept public)
   */
  static async calculateWorkingDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const { workingDays, holidayHits, holidays } = await this._countWorkingDays(start, end);
    return {
      workingDays,
      holidays: holidays.map(h => ({
        date: h.DATE_H ?? h.date,
        comment: h.COMMENT_H ?? h.name,
        type: (h.IN_CALL ?? h.in_call) ? 'On-call' : 'Public'
      }))
    };
  }
}

module.exports = LeaveService;
