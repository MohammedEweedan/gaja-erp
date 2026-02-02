// controllers/HR/leaveController.js
const { Op } = require('sequelize');
const moment = require('moment');
const jwt = require("jsonwebtoken");

const Vacation = require('../../models/hr/Vacation');      // Vacations table
const Holiday = require('../../models/hr/Holiday');        // Holidays table
const TSCode = require('../../models/hr/TSCode');          // TS_Codes
const Employee = require('../../models/hr/employee1');     // your existing employee model
const LeaveService = require('../../services/leaveService');
const { createTransporter } = require('../../utils/mailer');
const {
  countWorkingDaysExcludingFridaysAndHolidays: countWorkingDaysEff,
  countWorkingDaysByMonthExcludingFridaysAndHolidays: countWorkingDaysByMonthEff,
  getExpandedHolidaysBetween,
  buildHolidayNameByDate,
  computeEffectiveBreakdownWithHolidayNameByDate,
} = require('../../utils/leaveDayEngine');

async function sendLeaveEmailToEmployee(employeeId, subject, html) {
  try {
    if (employeeId == null) return;
    const emp = await Employee.findByPk(employeeId, { attributes: ['ID_EMP', 'NAME', 'EMAIL'] });
    const email = String(emp?.EMAIL || '').trim();
    if (!email) return;

    const name = String(emp?.NAME || '').trim();
    const safeHtml = String(html || '').replace(/\{\{EMP_NAME\}\}/g, name || 'Colleague');

    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.MAIL_FROM || '"Gaja System" <hr@gaja.ly>',
      to: email,
      subject,
      html: safeHtml,
    });
  } catch (e) {
    console.error('[leave email] failed:', e?.message || e);
  }
}

function normalizeStateLabel(v) {
  const s = String(v || '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

function makeRange(ymdStart, ymdEnd) {
  const s = String(ymdStart).slice(0,10);
  const e = String(ymdEnd).slice(0,10);
  return {
    startAt: `${s} 00:00:00.000`,
    endAt:   `${e} 23:59:59.997`,
  };
}

function isSickLeaveCode(row) {
  return LeaveService._isSickLeave(row);
}

function inclusiveDays(start, end) {
  return LeaveService._inclusiveDays(start, end);
}

// Helper: return [startYMD, endYMD] both as 'YYYY-MM-DD'
function rangeDay(startDate, endDate) {
  const s = String(startDate || '').slice(0, 10);
  const e = String(endDate || '').slice(0, 10);
  return [s, e];
}

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Authorization header missing" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Token missing" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    req.user = decoded;
    next();
  });
};

// 30/45 entitlement rule
async function computeAnnualEntitlement(employee) {
  const now = new Date();
  const dob = employee.DATE_OF_BIRTH ? new Date(employee.DATE_OF_BIRTH) : null;
  const hired = employee.CONTRACT_START ? new Date(employee.CONTRACT_START) : null;
  const age = dob ? Math.floor((now - dob) / (365.25 * 86400000)) : 0;
  const exp = hired ? Math.floor((now - hired) / (365.25 * 86400000)) : 0;
  return (age > 50 || exp > 20) ? 45 : 30;
}

function monthlyAccrualRate(annualEntitlement) {
  // 30 => 2.5 per month; 45 => 3.75 per month
  return Number((annualEntitlement / 12).toFixed(5));
}

function ymdUTC(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isEmergencyLeaveCode(row) {
  if (!row) return false;
  const code = String(row.code || '').trim().toUpperCase();
  const label = String(row.desig_can || '').trim().toUpperCase();
  return code === 'EL' || label.includes('EMERGENCY');
}



function inclusiveDaysByMonth(start, end) {
  const map = new Map(); // 'YYYY-MM' -> days
  let d = new Date(start);
  while (d <= end) {
    const iso = d.toISOString().slice(0,10);
    const ym = iso.slice(0,7);
    map.set(ym, (map.get(ym) || 0) + 1);
    d.setDate(d.getDate() + 1);
  }
  return map;
}

function sumMapValues(m) {
  let s = 0; for (const v of m.values()) s += v; return s;
}

exports.previewLeaveDays = [
  verifyToken,
  async (req, res) => {
    try {
      const { startDate, endDate, leaveType, code, id_can } = req.query || {};

      const startISO = String(startDate || '').slice(0, 10);
      const endISO = String(endDate || '').slice(0, 10);
      if (!startISO || !endISO) {
        return res.status(400).json({ message: 'startDate and endDate are required (YYYY-MM-DD)' });
      }

      // Resolve leave type to int_can
      const rawType = leaveType ?? code ?? id_can;
      if (rawType == null || String(rawType).trim() === '') {
        return res.status(400).json({ message: 'leaveType (or code/id_can) is required' });
      }

      const intCan = await resolveIntCan(rawType);
      if (intCan == null) {
        return res.status(400).json({ message: 'Invalid leave type (cannot resolve id_can)' });
      }

      const codeRow = await TSCode.findByPk(intCan, { attributes: ['int_can', 'code', 'desig_can'] });
      const sickLeave = isSickLeaveCode(codeRow);

      if (sickLeave) {
        const calendarDays = inclusiveDays(startISO, endISO);
        return res.json({
          startDate: startISO,
          endDate: endISO,
          leaveTypeId: intCan,
          effectiveDays: calendarDays,
          calendarDays,
          excluded: null,
        });
      }

      const r = await countWorkingDaysEff(new Date(startISO), new Date(endISO));
      const calendarDays = inclusiveDays(startISO, endISO);
      return res.json({
        startDate: startISO,
        endDate: endISO,
        leaveTypeId: intCan,
        effectiveDays: r.effectiveDays,
        calendarDays,
        excluded: r.excluded,
      });
    } catch (err) {
      console.error('previewLeaveDays error:', err);
      return res.status(500).json({ message: 'Failed to preview leave days' });
    }
  }
];

// Build accrual ledger with CARRY-FORWARD support
// Calculates from contract start date to today, carrying forward unused balance from previous years
async function buildAccrualLedger(employee) {
  const annualEnt = await computeAnnualEntitlement(employee);
  const rate = monthlyAccrualRate(annualEnt); // per month
  const today = new Date();
  
  // Start from contract start date (not just current year) to support carry-forward
  const contractStart = employee.CONTRACT_START ? new Date(employee.CONTRACT_START) : null;
  if (!contractStart) {
    // No contract start - use current year only
    const yearStart = new Date(`${today.getFullYear()}-01-01T00:00:00Z`);
    const ledger = [];
    let cursor = new Date(Date.UTC(yearStart.getUTCFullYear(), yearStart.getUTCMonth(), 1));
    let endMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    let running = 0;
    while (cursor <= endMonth) {
      running += rate;
      ledger.push({
        month: cursor.toISOString().slice(0,7),
        accrued: Number(rate.toFixed(2)),
        runningTotal: Number(running.toFixed(2)),
      });
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    }
    return { annualEntitlement: annualEnt, monthlyRate: rate, accruedToDate: Number(running.toFixed(2)), ledger, carryForward: 0 };
  }

  // Calculate total accrued from contract start to today (supports carry-forward)
  const ledger = [];
  let cursor = new Date(Date.UTC(contractStart.getUTCFullYear(), contractStart.getUTCMonth(), 1));
  let endMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  let running = 0;
  
  while (cursor <= endMonth) {
    running += rate;
    ledger.push({
      month: cursor.toISOString().slice(0,7),
      accrued: Number(rate.toFixed(2)),
      runningTotal: Number(running.toFixed(2)),
    });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  
  const totalAccrued = Number(running.toFixed(2));
  
  // Calculate carry-forward: total accrued from previous years
  const currentYearStart = new Date(`${today.getFullYear()}-01-01T00:00:00Z`);
  let carryForward = 0;
  if (contractStart < currentYearStart) {
    // Count months from contract start to end of previous year
    let prevCursor = new Date(Date.UTC(contractStart.getUTCFullYear(), contractStart.getUTCMonth(), 1));
    const prevYearEnd = new Date(Date.UTC(today.getFullYear() - 1, 11, 1)); // Dec of previous year
    while (prevCursor <= prevYearEnd) {
      carryForward += rate;
      prevCursor = new Date(Date.UTC(prevCursor.getUTCFullYear(), prevCursor.getUTCMonth() + 1, 1));
    }
    carryForward = Number(carryForward.toFixed(2));
  }
  
  return { annualEntitlement: annualEnt, monthlyRate: rate, accruedToDate: totalAccrued, ledger, carryForward };
}

async function buildDeductionLedger(employeeId, fromContractStart = false) {
  const today = new Date();
  const sql = Vacation.sequelize;
  const depDate = sql.literal('CONVERT(date, date_depart, 23)');
  const endDateLit = sql.literal('CONVERT(date, date_end, 23)');
  
  // Get employee contract start for full history
  let contractStart = null;
  if (fromContractStart) {
    try {
      const emp = await Employee.findByPk(employeeId, { attributes: ['CONTRACT_START'] });
      if (emp?.CONTRACT_START) {
        contractStart = new Date(emp.CONTRACT_START);
      }
    } catch {}
  }
  
  // If fromContractStart and we have a contract date, use that; otherwise use current year
  const fromYMD = contractStart 
    ? `${contractStart.getFullYear()}-01-01`
    : `${today.getFullYear()}-01-01`;
  const toYMD = `${today.getFullYear()}-12-31`;
  const windowStart = contractStart 
    ? new Date(`${contractStart.getFullYear()}-01-01T00:00:00Z`)
    : new Date(`${today.getFullYear()}-01-01T00:00:00Z`);
  const windowEnd = new Date(`${today.getFullYear()}-12-31T23:59:59Z`);

  // Include any leave that overlaps the window
  const where = {
    id_emp: employeeId,
    state: 'Approved',
    [Op.and]: [
      sql.where(depDate, { [Op.lte]: toYMD }),
      sql.where(endDateLit, { [Op.gte]: fromYMD }),
    ],
  };

  let leaves = [];
  try {
    leaves = await Vacation.findAll({
      where,
      attributes: ['int_con','id_can','state','date_depart','date_end','nbr_jour'],
      order: [['date_depart', 'ASC']],
    });
  } catch (e) {
    const msg = String(e?.parent?.message || e?.message || '');
    const vacMissing = msg.includes('Invalid object name') && msg.toLowerCase().includes('vacations');
    if (vacMissing) {
      return { entries: [], deductedToDate: 0 };
    }
    throw e;
  }

  const intCans = [...new Set(leaves.map((v) => Number(v.id_can)).filter((v) => !Number.isNaN(v)))]
  let codeByIntCan = new Map();
  if (intCans.length) {
    try {
      const codeRows = await TSCode.findAll({
        where: { int_can: { [Op.in]: intCans } },
        attributes: ['int_can', 'code', 'desig_can'],
      });
      codeByIntCan = new Map(codeRows.map((row) => [Number(row.int_can), row]));
    } catch (_) {
      codeByIntCan = new Map();
    }
  }

  const entries = [];
  let totalDeducted = 0;
  for (const v of leaves) {
    const s = new Date(v.date_depart);
    const e = new Date(v.date_end);
    // Clamp to window so we don't count days outside the range
    const sClamp = new Date(Math.max(s.getTime(), windowStart.getTime()));
    const eClamp = new Date(Math.min(e.getTime(), windowEnd.getTime()));
    const codeRow = codeByIntCan.get(Number(v.id_can));
    let excluded = null;
    let days = 0;
    if (isSickLeaveCode(codeRow)) {
      days = inclusiveDays(sClamp, eClamp);
    } else {
      const r = await countWorkingDaysEff(sClamp, eClamp);
      days = r.effectiveDays;
      excluded = r.excluded;
    }
    totalDeducted += days;
    entries.push({
      id: v.int_con,
      startDate: sClamp.toISOString().slice(0,10),
      endDate: eClamp.toISOString().slice(0,10),
      deducted: days,
      effectiveDays: days,
      excluded,
      runningTotal: totalDeducted,
      leaveTypeId: v.id_can,
    });
  }
  return { entries, deductedToDate: totalDeducted };
}

// Create leave request (Vacations)
exports.createLeaveRequest = [
  verifyToken,
    async (req, res) => {
      try {
      const { employeeId, leaveType, startDate, endDate, reason, days } = req.body; // startDate/endDate = 'YYYY-MM-DD'
      if (!employeeId || !leaveType || !startDate || !endDate) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      // resolve leaveType to int_can
      let id_can = Number(leaveType);
      if (Number.isNaN(id_can)) {
        const code = String(leaveType).trim();
        const row = await TSCode.findOne({ where: { code } });
        if (!row) return res.status(400).json({ message: 'Invalid leave type' });
        id_can = row.int_can;
      }

      const { startAt, endAt } = makeRange(startDate, endDate);

      // Force SQL Server to treat these as datetime (no timezone offset) using style 121 (ODBC canonical with milliseconds)
      const sql = Vacation.sequelize;
      const dateDepartLit = sql.literal(`CONVERT(datetime, '${startAt}', 121)`);
      const dateEndLit = sql.literal(`CONVERT(datetime, '${endAt}', 121)`);
      const dateCreationLit = sql.literal('GETDATE()');

      // If client didn't provide days, compute working days excluding Friday/holidays
      let nbr_jour = days ?? null;
      const codeRow = await TSCode.findByPk(id_can, { attributes: ['int_can','code','desig_can'] });
      const sickLeave = isSickLeaveCode(codeRow);
      if (nbr_jour == null) {
        nbr_jour = sickLeave
          ? inclusiveDays(startDate, endDate)
          : (await countWorkingDaysEff(new Date(startDate), new Date(endDate))).effectiveDays;
      }

      // Emergency leave limits: 12 days/year, 3 days/month (working days excluding Fri/hol)
      if (isEmergencyLeaveCode(codeRow)) {
        const s = new Date(startDate);
        const e = new Date(endDate);
        const newByMonth = await countWorkingDaysByMonthEff(s, e);
        const newByYear = new Map();
        for (const [ym, v] of newByMonth) {
          const y = ym.slice(0,4);
          newByYear.set(y, (newByYear.get(y) || 0) + v);
        }

        // Fetch existing approved EL leaves overlapping the new range year window(s)
        const yearStart = new Date(`${Math.min(...[...newByYear.keys()].map(Number))}-01-01T00:00:00Z`);
        const yearEnd   = new Date(`${Math.max(...[...newByYear.keys()].map(Number))}-12-31T23:59:59Z`);
        const exist = await Vacation.findAll({
          where: {
            id_emp: employeeId,
            state: 'Approved',
          },
          attributes: ['int_con','id_can','date_depart','date_end','nbr_jour'],
        });

        // Filter to emergency only by code
        const codes = await TSCode.findAll({ attributes: ['int_can','code','desig_can'] });
        const codeMap = new Map(codes.map(c => [Number(c.int_can), c]));

        const usedByMonth = new Map();
        const usedByYear = new Map();
        for (const v of exist) {
          const row = codeMap.get(Number(v.id_can));
          if (!isEmergencyLeaveCode(row)) continue;
          const vs = new Date(v.date_depart);
          const ve = new Date(v.date_end);
          // intersect with [yearStart, yearEnd]
          const sClamp = new Date(Math.max(vs.getTime(), yearStart.getTime()));
          const eClamp = new Date(Math.min(ve.getTime(), yearEnd.getTime()));
          if (eClamp < sClamp) continue;
          const byMonth = await countWorkingDaysByMonthEff(sClamp, eClamp);
          for (const [ym, val] of byMonth) {
            usedByMonth.set(ym, (usedByMonth.get(ym) || 0) + val);
            const y = ym.slice(0,4);
            usedByYear.set(y, (usedByYear.get(y) || 0) + val);
          }
        }

        // Validate monthly (<=3) and yearly (<=12)
        for (const [ym, add] of newByMonth) {
          const cur = usedByMonth.get(ym) || 0;
          if (cur + add > 3) {
            return res.status(400).json({ message: `Emergency leave monthly limit exceeded for ${ym}: requested ${add}, existing ${cur}, limit 3` });
          }
        }
        for (const [y, add] of newByYear) {
          const cur = usedByYear.get(y) || 0;
          if (cur + add > 12) {
            return res.status(400).json({ message: `Emergency leave yearly limit exceeded for ${y}: requested ${add}, existing ${cur}, limit 12` });
          }
        }
      }

      const created = await Vacation.create({
        id_emp: employeeId,
        id_can,
        date_depart: dateDepartLit,
        date_end: dateEndLit,
        nbr_jour: nbr_jour,          // computed working days if not provided
        date_creation: dateCreationLit,
        state: 'Pending',
        Cause: reason ?? null,
        COMMENT: reason ?? null,
        id_view: 0,
      });

      res.status(201).json({ id: created.int_con });
    } catch (err) {
      console.error('createLeaveRequest error:', err);
      res.status(500).json({ message: 'Failed to create leave request' });
    }
  }
];

// Get leaves by employee (Vacations)
exports.getLeaveRequests = [
  verifyToken,
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      try {
        const rows = await Vacation.findAll({ where: { id_emp: employeeId }, order: [['date_depart','DESC']] });

        const iso10 = (v) => {
          if (!v) return '';
          if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
          const s = String(v);
          if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
          const d = new Date(s);
          if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
          return s.slice(0, 10);
        };

        const intCans = [...new Set(rows.map((v) => Number(v.id_can)).filter((v) => !Number.isNaN(v)))];
        let codeByIntCan = new Map();
        if (intCans.length) {
          try {
            const codeRows = await TSCode.findAll({
              where: { int_can: { [Op.in]: intCans } },
              attributes: ['int_can', 'code', 'desig_can'],
            });
            codeByIntCan = new Map(codeRows.map((row) => [Number(row.int_can), row]));
          } catch {
            codeByIntCan = new Map();
          }
        }

        // Build one expanded holiday index for the entire returned range, then compute per-row breakdown cheaply.
        let minISO = null;
        let maxISO = null;
        for (const r of rows) {
          const s = iso10(r.date_depart);
          const e = iso10(r.date_end);
          if (s && (!minISO || s < minISO)) minISO = s;
          if (e && (!maxISO || e > maxISO)) maxISO = e;
        }
        let holidayNameByDate = new Map();
        if (minISO && maxISO) {
          try {
            const hols = await getExpandedHolidaysBetween(minISO, maxISO);
            holidayNameByDate = buildHolidayNameByDate(hols);
          } catch {
            holidayNameByDate = new Map();
          }
        }

        const enriched = rows.map((r) => {
          const plain = typeof r.get === 'function' ? r.get({ plain: true }) : r;
          const codeRow = codeByIntCan.get(Number(r.id_can));
          const startISO = iso10(r.date_depart);
          const endISO = iso10(r.date_end);
          if (!startISO || !endISO) return plain;

          if (isSickLeaveCode(codeRow)) {
            // sick leave is inclusive calendar days
            return Object.assign(plain, {
              effectiveDays: LeaveService._inclusiveDays(startISO, endISO),
              excluded: null,
            });
          }

          const b = computeEffectiveBreakdownWithHolidayNameByDate(startISO, endISO, holidayNameByDate);
          return Object.assign(plain, {
            effectiveDays: b.effectiveDays,
            excluded: b.excluded,
          });
        });

        return res.json(enriched);
      } catch (e) {
        const msg = String(e?.parent?.message || e?.message || '');
        const vacMissing = msg.includes('Invalid object name') && msg.toLowerCase().includes('vacations');
        if (vacMissing) {
          return res.json([]);
        }
        throw e;
      }
    } catch (err) {
      console.error('getLeaveRequests error:', err);
      res.status(500).json({ message: 'Error fetching leaves' });
    }
  }
];

// Update leave status
exports.updateLeaveStatus = [
  verifyToken,
  async (req, res) => {
    try {
      const { leaveId, status, comment } = req.body;
      const row = await Vacation.findByPk(leaveId);
      if (!row) return res.status(404).json({ message: 'Leave request not found' });

      const normalized = normalizeStateLabel(status);
      await row.update({ state: normalized ?? row.state, COMMENT: comment ?? row.COMMENT });

      const nextState = String(row.state || '');
      const nextLower = nextState.toLowerCase();
      const prevState = String(row.state || '');
      const startISO = String(row.date_depart || '').slice(0, 10);
      const endISO = String(row.date_end || '').slice(0, 10);
      const windowText = startISO && endISO ? `${startISO} → ${endISO}` : '';

      if (nextLower.includes('approved') || nextLower.includes('accepted')) {
        await sendLeaveEmailToEmployee(
          row.id_emp,
          'Your Leave Has Been Approved',
          `<p>Dear {{EMP_NAME}},</p><p>Your leave has been approved.</p>${windowText ? `<p><strong>${windowText}</strong></p>` : ''}`
        );
      } else if (nextLower.includes('reject') || nextLower.includes('denied') || nextLower.includes('refus')) {
        await sendLeaveEmailToEmployee(
          row.id_emp,
          'Your Leave Has Been Denied',
          `<p>Dear {{EMP_NAME}},</p><p>Your leave has been denied.</p>${windowText ? `<p><strong>${windowText}</strong></p>` : ''}${comment ? `<p>Comment: ${String(comment)}</p>` : ''}`
        );
      }

      res.json({ message: 'Leave status updated', leaveRequest: row });
    } catch (err) {
      console.error('updateLeaveStatus error:', err);
      res.status(500).json({ message: 'Error updating leave' });
    }
  }
];

// Delete leave
exports.deleteLeaveRequest = [
  verifyToken,
  async (req, res) => {
    try {
      const { leaveId } = req.params;
      const row = await Vacation.findByPk(leaveId);
      if (!row) return res.status(404).json({ message: 'Leave request not found' });
      await row.destroy();
      res.json({ message: 'Leave request deleted' });
    } catch (err) {
      console.error('deleteLeaveRequest error:', err);
      res.status(500).json({ message: 'Error deleting leave' });
    }
  }
];

// Leave balance using accrual-to-date and Friday/holiday-aware deductions
// Now supports CARRY-FORWARD: calculates from contract start, not just current year
exports.getLeaveBalance = [
  verifyToken,
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      const emp = await Employee.findByPk(employeeId, { attributes: ['ID_EMP','NAME','CONTRACT_START','DATE_OF_BIRTH'] });
      if (!emp) return res.status(404).json({ message: 'Employee not found' });

      // Build accrual from contract start (includes carry-forward)
      const { annualEntitlement, monthlyRate, accruedToDate, carryForward } = await buildAccrualLedger(emp);
      
      // Get ALL deductions from contract start for accurate remaining balance
      const { entries, deductedToDate } = await buildDeductionLedger(employeeId, true);

      // Remaining = total accrued from contract start - total deducted from contract start
      const remaining = Number((accruedToDate - deductedToDate).toFixed(2));
      
      // Current year accrual (for display purposes)
      const today = new Date();
      const monthsThisYear = today.getMonth() + 1; // Jan = 1
      const currentYearAccrued = Number((monthlyRate * monthsThisYear).toFixed(2));

      res.json({
        employeeId: emp.ID_EMP,
        employeeName: emp.NAME,
        annualEntitlement,
        monthlyRate,
        accruedToDate,           // Total from contract start
        currentYearAccrued,      // Just this year's accrual
        carryForward: carryForward || 0,  // Balance carried from previous years
        deductedToDate,          // Total deducted from contract start
        remaining,               // Actual remaining balance with carry-forward
        entitlement: annualEntitlement,  // Alias for frontend compatibility
        used: deductedToDate,            // Alias for frontend compatibility
        deductionEntries: entries,
      });
    } catch (err) {
      console.error('getLeaveBalance error:', err);
      res.status(500).json({ message: 'Error fetching leave balance' });
    }
  }
];

async function resolveIntCan(leaveTypeOrIdCan) {
  // If caller passed numeric int_can already
  if (leaveTypeOrIdCan != null && !Number.isNaN(Number(leaveTypeOrIdCan))) {
    return Number(leaveTypeOrIdCan);
  }
  // Else resolve by TSCode.code
  const code = String(leaveTypeOrIdCan || '').trim();
  if (!code) return null;
  const row = await TSCode.findOne({ where: { code } });
  return row ? row.int_can : null;
}

exports.updateLeaveRequest = [
  verifyToken,
  async (req, res) => {
    try {
      // Accept either /leave-request/:leaveId or POST body { leaveId, ... }
      const leaveId = req.params.leaveId ?? req.body.leaveId ?? req.body.id ?? req.body.int_con ?? req.body.id_conge;
      const {
        startDate, endDate,              // 'YYYY-MM-DD'
        leaveType, id_can, code,         // any of these may be provided
        comment, COMMENT, Cause,
        days,                             // optional override; if missing we recompute
        keepState,                        // optional: true to keep Approved, else reset to Pending when changing dates/type
      } = req.body || {};

      if (!leaveId) {
        return res.status(400).json({ message: 'leaveId is required' });
      }
      if (!startDate || !endDate) {
        return res.status(400).json({ message: 'startDate and endDate are required (YYYY-MM-DD)' });
      }

      const row = await Vacation.findByPk(leaveId);
      if (!row) return res.status(404).json({ message: 'Leave request not found' });

      const prevStartISO = String(row.date_depart || '').slice(0, 10);
      const prevEndISO = String(row.date_end || '').slice(0, 10);
      const prevState = String(row.state || '');

      // Resolve id_can (int) from any of: id_can | leaveType | code
      const resolvedIntCan =
        (id_can != null && !Number.isNaN(Number(id_can))) ? Number(id_can)
        : await resolveIntCan(leaveType ?? code ?? row.id_can);

      if (resolvedIntCan == null) {
        return res.status(400).json({ message: 'Invalid leave type (cannot resolve id_can)' });
      }

      // Build datetime literals exactly like creation
      const { startAt, endAt } = makeRange(startDate, endDate);
      const sql = Vacation.sequelize;
      const dateDepartLit = sql.literal(`CONVERT(datetime, '${startAt}', 121)`);
      const dateEndLit    = sql.literal(`CONVERT(datetime, '${endAt}', 121)`);

      // Recompute working days if not supplied
      const codeRow = await TSCode.findByPk(resolvedIntCan, { attributes: ['int_can','code','desig_can'] });
      const sickLeave = isSickLeaveCode(codeRow);
      let nbr_jour = days;
      if (nbr_jour == null) {
        nbr_jour = sickLeave
          ? inclusiveDays(startDate, endDate)
          : (await countWorkingDaysEff(new Date(startDate), new Date(endDate))).effectiveDays;
      }

      // Emergency leave limits on update (exclude current row from existing sums)
      if (isEmergencyLeaveCode(codeRow)) {
        const s = new Date(startDate);
        const e = new Date(endDate);
        const newByMonth = await countWorkingDaysByMonthEff(s, e);
        const newByYear = new Map();
        for (const [ym, v] of newByMonth) {
          const y = ym.slice(0,4);
          newByYear.set(y, (newByYear.get(y) || 0) + v);
        }

        const yearStart = new Date(`${Math.min(...[...newByYear.keys()].map(Number))}-01-01T00:00:00Z`);
        const yearEnd   = new Date(`${Math.max(...[...newByYear.keys()].map(Number))}-12-31T23:59:59Z`);
        const exist = await Vacation.findAll({
          where: {
            id_emp: row.id_emp,
            state: 'Approved',
            int_con: { [Op.ne]: row.int_con },
          },
          attributes: ['int_con','id_can','date_depart','date_end','nbr_jour'],
        });
        const codes = await TSCode.findAll({ attributes: ['int_can','code','desig_can'] });
        const codeMap = new Map(codes.map(c => [Number(c.int_can), c]));
        const usedByMonth = new Map();
        const usedByYear = new Map();
        for (const v of exist) {
          const r = codeMap.get(Number(v.id_can));
          if (!isEmergencyLeaveCode(r)) continue;
          const vs = new Date(v.date_depart);
          const ve = new Date(v.date_end);
          const sClamp = new Date(Math.max(vs.getTime(), yearStart.getTime()));
          const eClamp = new Date(Math.min(ve.getTime(), yearEnd.getTime()));
          if (eClamp < sClamp) continue;
          const byMonth = await countWorkingDaysByMonthEff(sClamp, eClamp);
          for (const [ym, val] of byMonth) {
            usedByMonth.set(ym, (usedByMonth.get(ym) || 0) + val);
            const y = ym.slice(0,4);
            usedByYear.set(y, (usedByYear.get(y) || 0) + val);
          }
        }

        for (const [ym, add] of newByMonth) {
          const cur = usedByMonth.get(ym) || 0;
          if (cur + add > 3) {
            return res.status(400).json({ message: `Emergency leave monthly limit exceeded for ${ym}: requested ${add}, existing ${cur}, limit 3` });
          }
        }
        for (const [y, add] of newByYear) {
          const cur = usedByYear.get(y) || 0;
          if (cur + add > 12) {
            return res.status(400).json({ message: `Emergency leave yearly limit exceeded for ${y}: requested ${add}, existing ${cur}, limit 12` });
          }
        }
      }

      // Decide new state:
      // - If dates/type changed and keepState !== true: reset to 'Pending'
      // - Else preserve row.state
      let nextState = row.state;
      const changedDates =
        String(row.date_depart).slice(0,10) !== String(startDate).slice(0,10) ||
        String(row.date_end).slice(0,10) !== String(endDate).slice(0,10);
      const changedType = Number(row.id_can) !== Number(resolvedIntCan);

      const keepStateBool =
        keepState === true ||
        keepState === 1 ||
        String(keepState || '').toLowerCase() === 'true';

      if ((changedDates || changedType) && !keepStateBool) {
        nextState = 'Pending';
      }

      // COMMENT / Cause normalization
      const nextComment = comment ?? COMMENT ?? Cause ?? row.COMMENT ?? null;

      await row.update({
        id_can: resolvedIntCan,
        date_depart: dateDepartLit,
        date_end:    dateEndLit,
        nbr_jour,
        COMMENT: nextComment,
        Cause: nextComment,
        state: nextState,
      });

      // Email on modification of an already-approved leave when keepState=true
      if (
        changedDates &&
        keepStateBool &&
        (String(prevState).toLowerCase().includes('approved') || String(prevState).toLowerCase().includes('accepted')) &&
        (String(nextState).toLowerCase().includes('approved') || String(nextState).toLowerCase().includes('accepted'))
      ) {
        const newStartISO = String(startDate).slice(0, 10);
        const newEndISO = String(endDate).slice(0, 10);
        await sendLeaveEmailToEmployee(
          row.id_emp,
          'Your Leave Dates Have Been Modified',
          `<p>Dear {{EMP_NAME}},</p><p>Your approved leave dates were modified.</p><p><strong>${prevStartISO} → ${prevEndISO}</strong></p><p>New dates:</p><p><strong>${newStartISO} → ${newEndISO}</strong></p>`
        );
      }

      // Shape response similar to calendar log
      return res.json({
        message: 'Leave request updated',
        leaveRequest: {
          id: row.int_con,
          employeeId: row.id_emp,
          startDate: String(startDate).slice(0,10),
          endDate:   String(endDate).slice(0,10),
          days: nbr_jour,
          status: (row.state || '').toLowerCase(),
          leaveTypeId: row.id_can,
        },
      });
    } catch (err) {
      console.error('updateLeaveRequest error:', err);
      return res.status(500).json({ message: 'Error updating leave request' });
    }
  }
];

// Calendar log: supports optional employeeId and status filters
exports.getCalendarLog = async (req, res) => {
  try {
    const { startDate, endDate, employeeId, status } = req.query; // 'YYYY-MM-DD'
    const [fromYMD, toYMD] = rangeDay(startDate, endDate);

    // Build explicit CONVERT(date, ...) comparisons to support VARCHAR/CHAR date columns
    const sql = Vacation.sequelize;
    const depDate = sql.literal('CONVERT(date, date_depart, 23)');
    const endDateLit = sql.literal('CONVERT(date, date_end, 23)');

    const depBetween = sql.where(depDate, { [Op.between]: [fromYMD, toYMD] });
    const endBetween = sql.where(endDateLit, { [Op.between]: [fromYMD, toYMD] });
    const overlap = {
      [Op.and]: [
        sql.where(depDate, { [Op.lte]: toYMD }),
        sql.where(endDateLit, { [Op.gte]: fromYMD }),
      ],
    };

    // Build base where: include date overlap and optional state/employee filters
    const where = {
      [Op.or]: [depBetween, endBetween, overlap],
    };
    if (employeeId) where.id_emp = employeeId;
    if (status) {
      // Allow comma-separated status values
      const statuses = String(status)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase());
      if (statuses.length) where.state = { [Op.in]: statuses };
    }

    const leaves = await Vacation.findAll({
      where,
      attributes: [
        'int_con','id_emp','id_can','date_depart','date_end','nbr_jour','state','COMMENT','Cause'
      ],
      order: [['date_depart', 'ASC']],
    });

    const empIds = [...new Set(leaves.map(l => l.id_emp).filter(Boolean))];
    const idCans = [...new Set(leaves.map(l => l.id_can).filter(Boolean))];

    const [emps, codes] = await Promise.all([
      empIds.length
        ? Employee.findAll({
            where: { ID_EMP: { [Op.in]: empIds } },
            attributes: ['ID_EMP', 'NAME'],
          })
        : Promise.resolve([]),
      idCans.length
        ? TSCode.findAll({
            where: { int_can: { [Op.in]: idCans } },
            attributes: ['int_can', 'desig_can', 'code'],
          })
        : Promise.resolve([]),
    ]);

    const nameById = new Map(emps.map(e => [e.ID_EMP, e.NAME]));
    const codeById = new Map(codes.map(c => [c.int_can, { name: c.desig_can, code: c.code }]));

    const leaveRequests = leaves.map(v => {
      const sd = new Date(v.date_depart);
      const ed = new Date(v.date_end);
      const sYmd = ymdUTC(sd);
      const eYmd = ymdUTC(ed);
      return {
        id: v.int_con,
        employeeId: v.id_emp,
        employeeName: nameById.get(v.id_emp) || `Emp ${v.id_emp}`,
        startDate: sYmd,   // 'YYYY-MM-DD'
        endDate:   eYmd,   // 'YYYY-MM-DD'
        days: v.nbr_jour,
        status: (v.state || '').toLowerCase(),
        leaveTypeId: v.id_can,
        leaveTypeCode: codeById.get(v.id_can)?.code || null,
        leaveTypeName: codeById.get(v.id_can)?.name || null,
        comments: v.COMMENT ?? v.Cause ?? null,
      };
    });

    // Compute effective days within requested range using backend rules
    if (startDate && endDate) {
      const from = new Date(`${String(startDate).slice(0,10)}T00:00:00Z`);
      const to = new Date(`${String(endDate).slice(0,10)}T00:00:00Z`);
      for (const lr of leaveRequests) {
        const cr = codeById.get(lr.leaveTypeId);
        const s = new Date(`${String(lr.startDate).slice(0,10)}T00:00:00Z`);
        const e = new Date(`${String(lr.endDate).slice(0,10)}T00:00:00Z`);
        const sClamp = new Date(Math.max(s.getTime(), from.getTime()));
        const eClamp = new Date(Math.min(e.getTime(), to.getTime()));
        if (eClamp >= sClamp) {
          const eff = isSickLeaveCode({ code: cr?.code, desig_can: cr?.name })
            ? inclusiveDays(sClamp, eClamp)
            : (await countWorkingDaysEff(sClamp, eClamp)).effectiveDays;
          lr.effectiveDays = eff;
        } else {
          lr.effectiveDays = 0;
        }
      }
    } else {
      // No range provided: compute effective days across each leave's full span for consistency
      for (const lr of leaveRequests) {
        const cr = codeById.get(lr.leaveTypeId);
        const s = new Date(`${String(lr.startDate).slice(0,10)}T00:00:00Z`);
        const e = new Date(`${String(lr.endDate).slice(0,10)}T00:00:00Z`);
        const eff = isSickLeaveCode({ code: cr?.code, desig_can: cr?.name })
          ? inclusiveDays(s, e)
          : (await countWorkingDaysEff(s, e)).effectiveDays;
        lr.effectiveDays = eff;
      }
    }

    // Aggregate per-type totals for returned set using effectiveDays if present
    const perTypeTotals = [];
    const agg = new Map(); // label -> days
    for (const lr of leaveRequests) {
      const code = lr.leaveTypeCode || '';
      const name = lr.leaveTypeName || '';
      const label = code ? (name ? `${code} — ${name}` : code) : (name || '-');
      const d = typeof lr.effectiveDays === 'number' ? lr.effectiveDays : lr.days || 0;
      agg.set(label, (agg.get(label) || 0) + d);
    }
    for (const [label, days] of agg.entries()) perTypeTotals.push({ label, days });

    // Holidays for the same window, expanded (DB + fixed + Islamic)
    const holidays = startDate && endDate
      ? await getExpandedHolidaysBetween(String(startDate).slice(0,10), String(endDate).slice(0,10))
      : [];

    res.json({ leaveRequests, holidays, perTypeTotals });
  } catch (e) {
    const msg = String(e?.parent?.message || e?.message || '');
    const vacMissing = msg.includes('Invalid object name') && msg.toLowerCase().includes('vacations');
    if (vacMissing) {
      return res.json({ leaveRequests: [], holidays: [], perTypeTotals: [] });
    }
    console.error('getCalendarLog error:', e);
    res.status(500).json({ message: 'Failed to fetch calendar log' });
  }
};

// Leave types from TS_Codes
exports.getLeaveTypes = [
  verifyToken,
  async (_req, res) => {
    try {
      // Determine which columns actually exist to avoid selecting invalid columns
      let existing = new Set(['int_can','desig_can','code']);
      try {
        const [rows] = await TSCode.sequelize.query(
          "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TS_Codes'"
        );
        existing = new Set(rows.map(r => String(r.COLUMN_NAME).toLowerCase()));
      } catch {}
      const preferred = ['int_can','desig_can','code','max_day','Rule_days'];
      // Normalize case when matching
      const attrs = preferred.filter(c => existing.has(String(c).toLowerCase()));
      const codes = await TSCode.findAll({ attributes: attrs.length ? attrs : ['int_can','desig_can','code'], order: [['int_can','ASC']] });
      res.json(codes);
    } catch (err) {
      const msg = String(err?.parent?.message || err?.message || '');
      const tableMissing = msg.includes('Invalid object name') && msg.toLowerCase().includes('ts_codes');
      if (tableMissing) {
        const fallback = [
          { int_can: -1, desig_can: 'Annual Leave', code: 'AL' },
          { int_can: -2, desig_can: 'Sick Leave', code: 'SL' },
          { int_can: -3, desig_can: 'Emergency Leave', code: 'EL' },
          { int_can: -4, desig_can: 'Public Holiday', code: 'PH' },
          { int_can: -5, desig_can: 'Unpaid Leave', code: 'UL' },
          { int_can: -6, desig_can: 'Half Day Leave', code: 'HL' },
        ];
        return res.json(fallback);
      }
      console.error('getLeaveTypes error:', err);
      res.status(500).json({ message: 'Error fetching leave types' });
    }
  }
];

// Build a detailed accrual and deduction ledger for the employee (current year)
exports.getLeaveLedger = [
  verifyToken,
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      const emp = await Employee.findByPk(employeeId, { attributes: ['ID_EMP','NAME','CONTRACT_START','DATE_OF_BIRTH'] });
      if (!emp) return res.status(404).json({ message: 'Employee not found' });

      const accrual = await buildAccrualLedger(emp);
      const deduction = await buildDeductionLedger(employeeId);
      const remaining = Number((accrual.accruedToDate - deduction.deductedToDate).toFixed(2));

      res.json({ employeeId: emp.ID_EMP, employeeName: emp.NAME, ...accrual, ...deduction, remaining });
    } catch (err) {
      console.error('getLeaveLedger error:', err);
      res.status(500).json({ message: 'Error building leave ledger' });
    }
  }
];

// CSV exports (Excel-compatible)
function toCSV(rows, headers) {
  const h = headers.join(',');
  const body = rows.map(r => headers.map(k => {
    const v = r[k] ?? '';
    const s = String(v).replace(/"/g, '""');
    if (/[",\n]/.test(s)) return `"${s}"`;
    return s;
  }).join(',')).join('\n');
  return `${h}\n${body}`;
}

exports.exportLeaveLedgerCSV = [
  verifyToken,
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      const emp = await Employee.findByPk(employeeId, { attributes: ['ID_EMP','NAME','CONTRACT_START','DATE_OF_BIRTH'] });
      if (!emp) return res.status(404).json({ message: 'Employee not found' });

      const accrual = await buildAccrualLedger(emp);
      const deduction = await buildDeductionLedger(employeeId);

      const accrualRows = accrual.ledger.map(x => ({ month: x.month, accrued: x.accrued, runningTotal: x.runningTotal }));
      const deductionRows = deduction.entries.map(x => ({ id: x.id, startDate: x.startDate, endDate: x.endDate, deducted: x.deducted, runningTotal: x.runningTotal }));

      const parts = [];
      parts.push('Accruals');
      parts.push(toCSV(accrualRows, ['month','accrued','runningTotal']));
      parts.push('\nDeductions');
      parts.push(toCSV(deductionRows, ['id','startDate','endDate','deducted','runningTotal']));

      const csv = parts.join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="leave_ledger_${emp.ID_EMP}.csv"`);
      res.status(200).send(csv);
    } catch (err) {
      console.error('exportLeaveLedgerCSV error:', err);
      res.status(500).json({ message: 'Error exporting leave ledger' });
    }
  }
];

exports.exportAllLeaveLedgersCSV = [
  verifyToken,
  async (_req, res) => {
    try {
      const today = new Date();
      const emps = await Employee.findAll({ attributes: ['ID_EMP','NAME','CONTRACT_START','DATE_OF_BIRTH'] });
      const rows = [];
      for (const emp of emps) {
        const accrual = await buildAccrualLedger(emp);
        const deduction = await buildDeductionLedger(emp.ID_EMP);
        const remaining = Number((accrual.accruedToDate - deduction.deductedToDate).toFixed(2));
        rows.push({
          employeeId: emp.ID_EMP,
          employeeName: emp.NAME,
          accruedToDate: accrual.accruedToDate,
          deductedToDate: deduction.deductedToDate,
          remaining,
          annualEntitlement: accrual.annualEntitlement,
          monthlyRate: accrual.monthlyRate,
        });
      }
      const csv = toCSV(rows, ['employeeId','employeeName','annualEntitlement','monthlyRate','accruedToDate','deductedToDate','remaining']);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="leave_ledgers_${today.toISOString().slice(0,10)}.csv"`);
      res.status(200).send(csv);
    } catch (err) {
      console.error('exportAllLeaveLedgersCSV error:', err);
      res.status(500).json({ message: 'Error exporting all leave ledgers' });
    }
  }
];

// Get all vacations in a date range (for All Employees grid)
// Uses the same logic as getCalendarLog to ensure consistency
exports.getVacationsInRange = [
  verifyToken,
  async (req, res) => {
    try {
      const { from, to } = req.query;
      if (!from || !to) {
        return res.status(400).json({ message: 'from and to query params required (YYYY-MM-DD)' });
      }
      
      // Use SQL Server date conversion for DATE columns (same as getCalendarLog)
      const sql = Vacation.sequelize;
      const depDate = sql.literal('CONVERT(date, date_depart, 23)');
      const endDateLit = sql.literal('CONVERT(date, date_end, 23)');
      
      // Build overlap condition (same as getCalendarLog)
      const overlap = {
        [Op.and]: [
          sql.where(depDate, { [Op.lte]: to }),
          sql.where(endDateLit, { [Op.gte]: from }),
        ],
      };
      
      // Fetch vacations with proper date comparison
      let vacations = [];
      try {
        vacations = await Vacation.findAll({
          where: overlap,
          attributes: ['int_con', 'id_can', 'id_emp', 'date_depart', 'date_end', 'state', 'nbr_jour', 'COMMENT'],
          order: [['date_depart', 'ASC']],
        });
      } catch (ve) {
        const m = String(ve?.parent?.message || ve?.message || '');
        const vacMissing = m.includes('Invalid object name') && m.toLowerCase().includes('vacations');
        if (vacMissing) {
          return res.json([]);
        }
        throw ve;
      }
      
      console.log(`[getVacationsInRange] Found ${vacations.length} raw vacations from ${from} to ${to}`);
      console.log(`[getVacationsInRange] Sample states:`, vacations.slice(0, 5).map(v => ({ id: v.int_con, emp: v.id_emp, state: v.state })));
      
      // Check for employee 1 specifically
      const emp1Vacs = vacations.filter(v => v.id_emp === 1);
      console.log(`[getVacationsInRange] Employee 1 has ${emp1Vacs.length} vacations:`, emp1Vacs.map(v => ({
        id: v.int_con,
        dates: `${v.date_depart} to ${v.date_end}`,
        state: v.state,
        type: v.id_can
      })));
      
      // RAW SQL CHECK - see what's ACTUALLY in the database
      const [rawResults] = await Vacation.sequelize.query(`
        SELECT TOP 5 int_con, id_emp, date_depart, date_end, state, id_can
        FROM Vacations
        WHERE id_emp = 1 
        AND CONVERT(date, date_end, 23) >= '${from}'
        ORDER BY date_depart DESC
      `);
      console.log('[getVacationsInRange] RAW SQL for employee 1:', rawResults);
      
      // Fetch leave codes for all id_can values (tolerate TS_Codes issues)
      const idCans = [...new Set(vacations.map(v => v.id_can))];
      let codeMap = new Map();
      if (idCans.length > 0) {
        try {
          const codes = await TSCode.findAll({
            where: { int_can: idCans },
            attributes: ['int_can', 'code', 'desig_can'],
          });
          codeMap = new Map(codes.map(c => [Number(c.int_can), c]));
        } catch (codeErr) {
          console.warn('[getVacationsInRange] TS_Codes lookup failed; continuing without leave type codes:', codeErr?.message || codeErr);
        }
      }
      
      // Build one expanded holiday index for the whole range, then compute excluded breakdown quickly per row
      const fromISO = String(from).slice(0, 10);
      const toISO = String(to).slice(0, 10);
      let holidayNameByDate = new Map();
      try {
        const hols = await getExpandedHolidaysBetween(fromISO, toISO);
        holidayNameByDate = buildHolidayNameByDate(hols);
      } catch {
        holidayNameByDate = new Map();
      }

      const mapped = vacations.map(v => {
        const codeRow = codeMap.get(Number(v.id_can));
        const startISO = String(v.date_depart).slice(0, 10);
        const endISO = String(v.date_end).slice(0, 10);

        let effectiveDays = null;
        let excluded = null;
        if (startISO && endISO) {
          if (isSickLeaveCode(codeRow)) {
            effectiveDays = inclusiveDays(startISO, endISO);
          } else {
            const b = computeEffectiveBreakdownWithHolidayNameByDate(startISO, endISO, holidayNameByDate);
            effectiveDays = b.effectiveDays;
            excluded = b.excluded;
          }
        }

        return {
          id_can: v.id_can,
          id_emp: v.id_emp,
          date_depart: v.date_depart,
          date_end: v.date_end,
          state: v.state,
          type: (codeRow && codeRow.code) ? String(codeRow.code) : null,
          comment: v.COMMENT || null,
          nbr_jour: v.nbr_jour,
          effectiveDays,
          excluded,
        };
      });
      
      console.log(`[getVacationsInRange] Returning ${mapped.length} vacations`);
      res.json(mapped);
    } catch (err) {
      console.error('getVacationsInRange error:', err);
      res.status(500).json({ message: 'Error fetching vacations' });
    }
  }
];
