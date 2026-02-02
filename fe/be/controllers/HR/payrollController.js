// controllers/HR/payrollController.js
const { Op, fn, col, where, literal, QueryTypes, Sequelize, cast } = require('sequelize');
const moment = require('moment');
const Timesheet = require('../../models/hr/Timesheet');
const IClockTransaction = require('../../models/hr/IClockTransaction');
const Employee = require('../../models/hr/employee1');
const Vacation = require('../../models/hr/Vacation');
const TSCode = require('../../models/hr/TSCode');
const Holiday = require('../../models/hr/Holiday');
const PayrollSalary = require('../../models/hr/PayrollSalary');
const PayrollArchivedSalary = require('../../models/hr/PayrollArchivedSalary');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// Helpers
function firstOfMonth(year, month) {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
}
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}
function fmtYmd(d) {
  return moment(d).format('YYYY-MM-DD');
}

// Treat strings of only question marks/spaces as corrupted (common after non-Unicode insert)
function looksCorruptedName(s) {
  if (!s) return false;
  const t = String(s).trim();
  return t !== '' && /^\?+(\s\?+)*$/.test(t);
}
function chooseDisplayName(ar, en, id) {
  const sAr = (ar || '').trim();
  const sEn = (en || '').trim();
  if (sAr && !looksCorruptedName(sAr)) return sAr;
  if (sEn && !looksCorruptedName(sEn)) return sEn;
  return String(id || '');
}

function buildHolidaySet(year, month) {
  return (async () => {
    const dim = daysInMonth(year, month);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = `${year}-${String(month).padStart(2, '0')}-${String(dim).padStart(2, '0')}`;
    try {
      const rows = await Holiday.getHolidaysBetweenDates(start, end);
      const set = new Set(rows.map(r => fmtYmd(r.DATE_H)));
      return set;
    } catch {
      return new Set();
    }
  })();
}

function isFriday(ymd) {
  return moment(ymd, 'YYYY-MM-DD').isoWeekday() === 5; // 5=Friday
}

// Map leave codes to paid/unpaid/half
const LEAVE_POLICY = Object.freeze({
  // Paid leaves
  AL: { paid: 1 }, // Annual Leave
  SL: { paid: 1 }, // Sick Leave
  EL: { paid: 1 }, // Emergency Leave
  ML: { paid: 1 }, // Maternity Leave
  XL: { paid: 1 }, // Exam Leave
  BM: { paid: 1 }, // Bereavement
  B1: { paid: 1 },
  B2: { paid: 1 },
  HL: { paid: 0.5 }, // Half-day leave → half deduction

  // Unpaid
  UL: { paid: 0 },
});

function normalizeCode(raw) {
  if (!raw) return '';
  return String(raw).trim().toUpperCase();
}

async function getTsRowForMonth(empId, ymdMonth) {
  // ymdMonth is any date within the month (YYYY-MM-01 OK)
  const d = moment(ymdMonth, 'YYYY-MM-DD', true);
  if (!d.isValid()) return null;
  const start = d.clone().startOf('month').utc().toDate();
  const end = d.clone().startOf('month').add(1, 'month').utc().toDate();
  // Grab one row id then fetch specific attributes later per need
  const ids = await Timesheet.sequelize.query(
    'SELECT TOP 1 id_tran FROM TS WHERE id_emp = :emp AND DATE_JS >= CONVERT(date,:s,23) AND DATE_JS < CONVERT(date,:e,23) ORDER BY id_tran DESC',
    { replacements: { emp: Number(empId), s: moment.utc(start).format('YYYY-MM-DD'), e: moment.utc(end).format('YYYY-MM-DD') }, type: QueryTypes.SELECT }
  );
  return ids && ids[0] ? Number(ids[0].id_tran) : null;
}

async function loadMonthlyManualMap(empId, year, month) {
  const id = await getTsRowForMonth(empId, `${year}-${String(month).padStart(2,'0')}-01`);
  const map = new Map();
  if (!id) return map;
  const attrs = [];
  for (let d = 1; d <= 31; d++) attrs.push(`E${d}`, `S${d}`, `j_${d}`, `R_${d}`, `comm${d}`);
  const tsRow = await Timesheet.findOne({ where: { id_tran: id }, attributes: attrs, raw: true });
  if (!tsRow) return map;
  map.set('__row__', tsRow);
  return map;
}

function readPsSchedule() {
  try {
    const p = path.resolve(__dirname, '../../config/psSchedule.json');
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, 'utf8')) || {};
  } catch { return {}; }
}

function parseTimeToMinutes(t) {
  if (!t || typeof t !== 'string') return null;
  const [hh, mm] = t.split(':').map((n) => parseInt(n, 10) || 0);
  return hh * 60 + mm;
}

function minutesBetweenDates(d1, d2) {
  if (!d1 || !d2) return null;
  const ms = d2.getTime() - d1.getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 60000);
}

async function monthAttendanceSummary(emp, { year, month, holidaySet }) {
  const dim = daysInMonth(year, month);
  const monthKey = `${year}-${String(month).padStart(2,'0')}`;
  const tsMap = await loadMonthlyManualMap(emp.ID_EMP, year, month);
  const tsRow = tsMap.get('__row__') || null;

  // Prefetch all punches slightly widened
  const widenStart = moment.utc({ year, month: month - 1, day: 1 }).subtract(1, 'day').toDate();
  const widenEnd = moment.utc({ year, month: month - 1, day: dim }).add(1, 'day').toDate();
  const empCode = emp.ATTACHED_NUMBER || emp.ID_EMP;
  let punches = [];
  try {
    punches = await IClockTransaction.findAll({
      where: { emp_code: String(empCode), punch_time: { [Op.between]: [widenStart, widenEnd] } },
      attributes: ['punch_time'],
      raw: true,
      order: [['punch_time', 'ASC']]
    });
  } catch (fpErr) {
    // Fingerprint DB may be separate or unavailable; continue without punches
    punches = [];
  }
  const byDate = new Map();
  for (const p of punches) {
    const ymd = fmtYmd(p.punch_time);
    // clamp to visible month only
    if (ymd.slice(0,7) === monthKey) {
      if (!byDate.has(ymd)) byDate.set(ymd, []);
      byDate.get(ymd).push(new Date(p.punch_time));
    }
  }

  // Approved vacations for the month span → map to codes
  const mStart = `${year}-${String(month).padStart(2,'0')}-01`;
  const mEnd = `${year}-${String(month).padStart(2,'0')}-${String(dim).padStart(2,'0')}`;
  let vacRows = [];
  let codeMap = new Map();
  try {
    vacRows = await Vacation.findAll({
      where: {
        id_emp: emp.ID_EMP,
        state: 'Approved',
        [Op.and]: [
          where(literal('CONVERT(date, date_depart, 23)'), { [Op.lte]: mEnd }),
          where(literal('CONVERT(date, date_end, 23)'), { [Op.gte]: mStart }),
        ],
      },
      attributes: ['id_can', 'date_depart', 'date_end'],
      raw: true,
    });
    const idCans = Array.from(new Set(vacRows.map(v => v.id_can).filter(Boolean)));
    if (idCans.length) {
      try {
        const codeRows = await TSCode.findAll({ where: { int_can: idCans }, attributes: ['int_can','code'], raw: true });
        codeMap = new Map(codeRows.map(r => [String(r.int_can), String(r.code).toUpperCase()]));
      } catch {}
    }
  } catch (vacErr) {
    // Vacations/TS_Codes may not exist in this DB; proceed without leave overlays
    vacRows = [];
    codeMap = new Map();
  }

  function leaveCodeOn(ymd) {
    for (const v of vacRows) {
      const vs = fmtYmd(v.date_depart);
      const ve = fmtYmd(v.date_end);
      if (ymd >= vs && ymd <= ve) {
        const c = codeMap.get(String(v.id_can)) || '';
        return normalizeCode(c);
      }
    }
    return '';
  }

  // Expected minutes by default (from PS or T_START/T_END)
  const sched = readPsSchedule();
  const psKey = (emp.PS || emp.PS === 0) ? `P${emp.PS}` : null;
  const defaultExpectedMin = (() => {
    if (psKey && sched[psKey] && sched[psKey].start && sched[psKey].end) {
      const s = parseTimeToMinutes(sched[psKey].start);
      const e = parseTimeToMinutes(sched[psKey].end);
      if (s != null && e != null && e > s) return e - s;
    }
    const s = parseTimeToMinutes(emp.T_START);
    const e = parseTimeToMinutes(emp.T_END);
    if (s != null && e != null && e > s) return e - s;
    return null;
  })();

  // Counters and accumulators
  let workingDays = 0; // excludes Fridays and public holidays
  let deductionDays = 0; // absence + unpaid + half-day portions
  let presentWorkdays = 0; // days with punch on working day (for food)
  let holidayCount = 0; // holidays in month
  let holidayWorked = 0; // holidays with presence
  const leaveSummary = {}; // code -> count (for reporting)
  let baseFactorSum = 0; // sum of daily factors (P=1, PH=2, UL=0, etc.)
  let foodDays = 0; // total days that receive food allowance

  for (let d = 1; d <= dim; d++) {
    const ymd = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isHol = holidaySet.has(ymd);
    const isFri = isFriday(ymd);
    if (isHol) holidayCount += 1;

    const arr = byDate.get(ymd) || [];
    const hasPunch = arr.length > 0;

    // Determine manual/leave code
    let manualJ = '';
    if (tsRow) {
      const keyJ = `j_${d}`;
      manualJ = normalizeCode(tsRow[keyJ] || '');
    }
    const leaveJ = leaveCodeOn(ymd);
    // Base code: for holidays with no punches, use 'H' (non-deductible holiday) instead of 'A'
    let j = manualJ || leaveJ || (hasPunch ? (isHol ? 'PH' : 'P') : (isHol ? 'H' : 'A'));

    if (!isHol && !isFri) workingDays += 1;

    // Track holiday worked
    if (isHol && hasPunch) {
      holidayWorked += 1;
    }

    // Leave summary regardless of paid/unpaid (will reflect final j for most flows)
    if (j) leaveSummary[j] = (leaveSummary[j] || 0) + 1;

    // Compute expected and delta for display-driven codes (PL)
    let deltaMin = null;
    if (hasPunch && defaultExpectedMin != null) {
      const inDt = arr[0];
      const outDt = arr[arr.length - 1];
      const worked = minutesBetweenDates(inDt, outDt);
      if (worked != null) deltaMin = worked - defaultExpectedMin;
    }
    if (!manualJ && hasPunch && !isHol && deltaMin != null && deltaMin < 0 && j === 'P') {
      // auto mark late
      j = 'PL';
      leaveSummary['PL'] = (leaveSummary['PL'] || 0) + 1;
    }

    // On public holidays with presence, distinguish PH vs PHF based on missing hours:
    //  - PHF: worked >= expected (no missing hours) → double pay + food
    //  - PH:  worked < expected (missing hours)      → double pay, no food
    if (!manualJ && isHol && hasPunch && defaultExpectedMin != null && deltaMin != null) {
      j = deltaMin >= 0 ? 'PHF' : 'PH';
    }

    // Base factor per code
    const factor = (() => {
      const jj = j;
      if (jj === 'A' || jj === 'UL' || jj === 'W') return 0;
      if (jj === 'PH' || jj === 'PHF') return hasPunch ? 2 : 0; // double
      if (jj === 'HL') return 0.5;
      // Paid or neutral codes
      return hasPunch || ['AL','SL','EL','ML','XL','BM'].includes(jj) ? 1 : 0;
    })();
    baseFactorSum += factor;

    // Food allowance per code
    const food = (() => {
      const jj = j;
      if (jj === 'PHF' || jj === 'PT') return true;
      if (jj === 'H') return hasPunch; // holiday/Friday display code
      // Remove food on these codes
      if (['AL','XL','UL','BM','PH','A','W'].includes(jj)) return false;
      // Default: no food for plain P/PL per spec (PT carries food)
      return false;
    })();
    const applyFood = food || (isFri && hasPunch);
    if (applyFood) foodDays += 1;
    if (!isHol && !isFri && hasPunch) presentWorkdays += 1; // keep for reference

    // Deductions on working days only for unpaid/partial paid
    if (!isHol && !isFri) {
      const meta = LEAVE_POLICY[j];
      if (j === 'A' || j === 'W') {
        deductionDays += 1;
      } else if (j === 'UL') {
        deductionDays += 1; // explicit unpaid
      } else if (j === 'HL') {
        deductionDays += 0.5;
      } else if (meta) {
        const paid = Number(meta.paid || 0);
        if (paid < 1) deductionDays += (1 - paid);
      }
    }
  }

  return {
    workingDays,
    deductionDays,
    presentWorkdays,
    holidayCount,
    holidayWorked,
    leaveSummary,
    baseFactorSum,
    foodDays,
  };
}

function toNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

async function computePayslip(emp, { year, month, holidaySet }) {
  const summary = await monthAttendanceSummary(emp, { year, month, holidaySet });
  const baseSalary = toNumber(emp.BASIC_SALARY);
  const allowancePerDay = toNumber(emp.FOOD) + toNumber(emp.FUEL) + toNumber(emp.COMMUNICATION) + toNumber(emp.FOOD_ALLOWANCE);

  const wd = Math.max(1, summary.workingDays); // avoid div by zero
  const dailyBase = baseSalary / wd;
  // Base pay = dailyBase multiplied by per-day factor sum (handles PH/PHF=2x, HL=0.5)
  const basePay = Number((summary.baseFactorSum * dailyBase).toFixed(2));
  // Food allowance per day is based on working days only (Fridays/holidays excluded)
  const allowancePay = Number((allowancePerDay * summary.workingDays).toFixed(2));
  // Load period adjustments (bonuses/deductions/advances/loanPayment)
  const { bonusLyd, deductionLyd, advanceLyd: adjAdvanceLyd, loanPaymentLyd: adjLoanPaymentLyd } = await loadPeriodAdjustments(emp.ID_EMP, year, month);
  // Loans/Advances engine: compute scheduled items for this period
  const scheduled = await computeScheduledDebits(emp.ID_EMP, { year, month, baseSalary });
  const advanceLyd = Number((adjAdvanceLyd + (scheduled.advanceLyd || 0)).toFixed(2));
  const loanPaymentLyd = Number(((adjLoanPaymentLyd || 0) + (scheduled.loanPaymentLyd || 0)).toFixed(2));
  const adjPlus = Number((bonusLyd).toFixed(2));
  const adjMinus = Number((deductionLyd + advanceLyd + loanPaymentLyd).toFixed(2));
  const total = Number((basePay + allowancePay + adjPlus - adjMinus).toFixed(2));

  return {
    id_emp: emp.ID_EMP,
    name: chooseDisplayName(emp.NAME, emp.NAME_ENGLISH, emp.ID_EMP),
    PS: emp.PS ?? null,
    baseSalary,
    baseSalaryUsd: toNumber(emp.BASIC_SALARY_USD),
    allowancePerDay,
    workingDays: summary.workingDays,
    deductionDays: Number(summary.deductionDays.toFixed(2)),
    presentWorkdays: summary.presentWorkdays,
    holidayCount: summary.holidayCount,
    holidayWorked: summary.holidayWorked,
    leaveSummary: summary.leaveSummary,
    foodDays: summary.workingDays,
    factorSum: Number(summary.baseFactorSum.toFixed(4)),
    designation: emp.TITLE ?? null,
    costCenter: emp.COST_CENTER ?? null,
    components: {
      basePay: basePay,
      holidayOvertime: 0,
      allowancePay: allowancePay,
      adjustments: {
        bonus: adjPlus,
        deduction: deductionLyd,
        advance: advanceLyd,
        loanPayment: loanPaymentLyd,
      },
    },
    total: total,
  };
}

// ---------- Adjustments store (JSON file) ----------
const ADJ_FILE = path.resolve(__dirname, '../../config/payroll-adjustments.json');
function readAdjFile() {
  try {
    if (!fs.existsSync(ADJ_FILE)) return {};
    const txt = fs.readFileSync(ADJ_FILE, 'utf8');
    return JSON.parse(txt || '{}') || {};
  } catch { return {}; }
}
function writeAdjFile(data) {
  try {
    fs.writeFileSync(ADJ_FILE, JSON.stringify(data, null, 2));
  } catch (e) { console.warn('[adjustments] write failed:', e?.message || e); }
}

function adjYmKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function resolveEffectiveAdjustments(db, year, month, employeeId) {
  const empKey = String(employeeId);
  const curKey = adjYmKey(year, month);
  const outById = new Map();

  const direct = (db[curKey]?.[empKey] || []);
  for (const e of direct || []) {
    if (!e) continue;
    const idKey = e.id ? String(e.id) : null;
    if (idKey) outById.set(idKey, e);
  }

  for (const period of Object.keys(db || {})) {
    const list = (db?.[period]?.[empKey] || []);
    for (const e of list || []) {
      if (!e || !e.recurring) continue;
      const startKey = (e.startYear && e.startMonth) ? adjYmKey(e.startYear, e.startMonth) : period;
      const endKey = (e.endYear && e.endMonth) ? adjYmKey(e.endYear, e.endMonth) : '';
      if (curKey < startKey) continue;
      if (endKey && curKey > endKey) continue;
      const idKey = e.id ? String(e.id) : null;
      if (idKey && !outById.has(idKey)) outById.set(idKey, e);
    }
  }

  return Array.from(outById.values());
}

async function loadPeriodAdjustments(idEmp, year, month) {
  const key = `${year}-${String(month).padStart(2,'0')}`;
  const db = readAdjFile();
  const list = resolveEffectiveAdjustments(db, year, month, idEmp);
  let bonusLyd = 0, bonusUsd = 0,
      deductionLyd = 0, deductionUsd = 0,
      advanceLyd = 0, advanceUsd = 0,
      loanPaymentLyd = 0, loanPaymentUsd = 0;
  for (const a of list) {
    const amt = Number(a.amount || 0);
    if (!amt) continue;
    const cur = String(a.currency || 'LYD').toUpperCase();
    const isUsd = cur === 'USD';
    const t = String(a.type || '').toLowerCase();

    const dir = String(a.direction || '').toUpperCase();
    const isDirDeduct = dir === 'DEDUCT';
    const isDirAdd = dir === 'ADD';

    const isPositive = (
      t === 'bonus' ||
      t === 'eid_bonus' || t === 'eidbonus' || t === 'aleid' || t === 'aleid_bonus' ||
      t === 'food_allow' || t === 'food' ||
      t === 'comm_allow' || t === 'communication_allow' || t === 'communication' ||
      t === 'transport_allow' || t === 'transport' || t === 'transportation' ||
      t === 'gold_comm' || t === 'diamond_comm' || t === 'watch_comm'
    );

    const isNegDeduction = (t === 'deduction');
    const isNegAdvance   = (t === 'advance');

    const isLoanPay = (
      t === 'loanpayment' ||
      t === 'loan_payment' ||
      t === 'loanrepayment' ||
      t === 'loan_repayment'
    );

    if (isNegAdvance) {
      if (isUsd) advanceUsd += amt; else advanceLyd += amt;
    } else if (isLoanPay) {
      if (isUsd) loanPaymentUsd += amt; else loanPaymentLyd += amt;
    } else if (isDirDeduct || isNegDeduction) {
      if (isUsd) deductionUsd += amt; else deductionLyd += amt;
    } else if (isDirAdd || isPositive) {
      if (isUsd) bonusUsd += amt; else bonusLyd += amt;
    }
  }
  return { bonusLyd, bonusUsd, deductionLyd, deductionUsd, advanceLyd, advanceUsd, loanPaymentLyd, loanPaymentUsd, metaAdjustments: list };
}

// ---------- Loans & Advances engine (JSON store) ----------
const LOANS_FILE = path.resolve(__dirname, '../../config/payroll-loans.json');
function readLoansFile() {
  try { if (!fs.existsSync(LOANS_FILE)) return { loans: [] }; return JSON.parse(fs.readFileSync(LOANS_FILE, 'utf8')||'{"loans":[]}'); } catch { return { loans: [] }; }
}
function writeLoansFile(db) {
  try { fs.writeFileSync(LOANS_FILE, JSON.stringify(db, null, 2)); } catch (e) { console.warn('[loans] write failed', e?.message||e); }
}
function ymKey(y, m) { return `${y}-${String(m).padStart(2,'0')}`; }
async function computeScheduledDebits(idEmp, { year, month, baseSalary }) {
  const db = readLoansFile();
  const loans = (db.loans || []).filter(l => String(l.id_emp) === String(idEmp) && !l.closed);
  let loanPaymentLyd = 0;
  for (const l of loans) {
    const startKey = ymKey(l.startYear, l.startMonth);
    const curKey = ymKey(year, month);
    if (curKey < startKey) continue;
    const skipSet = new Set((l.skipMonths || []).map(k => String(k)));
    if (skipSet.has(curKey)) continue;
    const pct = Number(l.monthlyPercent || 0.25);
    const target = Math.max(0, Math.floor((baseSalary * pct) * 100) / 100);
    const rem = Number(l.remaining || l.principal || 0);
    const pay = Math.min(rem, target);
    loanPaymentLyd += pay;
  }
  // Scheduled advances: we reuse adjustments file with explicit year/month entries, so no extra here
  return { loanPaymentLyd, advanceLyd: 0 };
}

// ---------- Loans & Advances API ----------
// GET /hr/payroll/loans?employeeId
exports.listLoans = async (req, res) => {
  try {
    const { employeeId } = req.query || {};
    const db = readLoansFile();
    let rows = db.loans || [];
    if (employeeId) rows = rows.filter(l => String(l.id_emp) === String(employeeId));
    res.json({ ok: true, rows });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Failed to read loans' });
  }
};

// POST /hr/payroll/loans/create { employeeId, principal, startYear, startMonth, monthlyPercent, capMultiple, note }
exports.createLoan = async (req, res) => {
  try {
    const { employeeId, principal, startYear, startMonth, monthlyPercent, capMultiple, note } = req.body || {};
    if (!employeeId || !principal || !startYear || !startMonth) return res.status(400).json({ ok: false, message: 'Missing required fields' });
    const emp = await Employee.findByPk(Number(employeeId), { attributes: ['ID_EMP','BASIC_SALARY'], raw: true });
    if (!emp) return res.status(404).json({ ok: false, message: 'Employee not found' });
    const salary = toNumber(emp.BASIC_SALARY);
    const cap = Number(capMultiple || 3);
    const maxAllowed = salary * cap;
    if (Number(principal) > maxAllowed) return res.status(400).json({ ok: false, message: `Principal exceeds cap (${cap}x salary)` });
    const db = readLoansFile();
    const loan = {
      id: String(Date.now()),
      id_emp: Number(employeeId),
      principal: Number(principal),
      remaining: Number(principal),
      startYear: Number(startYear),
      startMonth: Number(startMonth),
      monthlyPercent: Number(monthlyPercent || 0.25),
      capMultiple: cap,
      skipMonths: [],
      note: note || '',
      createdAt: new Date().toISOString(),
      closed: false,
    };
    db.loans = db.loans || [];
    db.loans.push(loan);
    writeLoansFile(db);
    res.json({ ok: true, loan });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Failed to create loan' });
  }
};

// POST /hr/payroll/loans/skip { loanId, employeeId, year, month }
exports.skipLoanMonth = async (req, res) => {
  try {
    const { loanId, employeeId, year, month } = req.body || {};
    if (!year || !month) return res.status(400).json({ ok: false, message: 'Missing year/month' });
    const key = ymKey(Number(year), Number(month));
    const db = readLoansFile();
    let updated = false;
    for (const l of (db.loans || [])) {
      if (loanId && String(l.id) !== String(loanId)) continue;
      if (!loanId && employeeId && String(l.id_emp) !== String(employeeId)) continue;
      if (l.closed) continue;
      if (!l.skipMonths) l.skipMonths = [];
      if (!l.skipMonths.includes(key)) l.skipMonths.push(key);
      updated = true;
    }
    if (updated) writeLoansFile(db);
    res.json({ ok: true, skipped: key, updated });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Failed to skip month' });
  }
};

// POST /hr/payroll/loans/payoff { loanId, employeeId, amount }
exports.payoffLoan = async (req, res) => {
  try {
    const { loanId, employeeId, amount } = req.body || {};
    const db = readLoansFile();
    let updated = false;
    for (const l of (db.loans || [])) {
      if (loanId && String(l.id) !== String(loanId)) continue;
      if (!loanId && employeeId && String(l.id_emp) !== String(employeeId)) continue;
      if (l.closed) continue;
      const pay = amount != null ? Math.max(0, Number(amount)) : Number(l.remaining || 0);
      l.remaining = Math.max(0, Number(l.remaining || 0) - pay);
      if (l.remaining <= 0) { l.remaining = 0; l.closed = true; }
      updated = true;
    }
    if (updated) writeLoansFile(db);
    res.json({ ok: true, updated });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Failed to payoff loan' });
  }
};

// GET /hr/payroll/history/total?employeeId&from=YYYY-MM&to=YYYY-MM
exports.historyTotals = async (req, res) => {
  try {
    const { employeeId, from, to } = req.query || {};
    if (!employeeId) return res.status(400).json({ ok: false, message: 'employeeId is required' });
    const start = from ? moment(from, 'YYYY-MM') : moment().subtract(11, 'month');
    const end = to ? moment(to, 'YYYY-MM') : moment();
    if (!start.isValid() || !end.isValid() || end.isBefore(start)) return res.status(400).json({ ok: false, message: 'Invalid range' });
    const emp = await Employee.findByPk(Number(employeeId), {
      attributes: ['ID_EMP','NAME','PS','ATTACHED_NUMBER','BASIC_SALARY','FOOD','FUEL','COMMUNICATION','FOOD_ALLOWANCE','STATE','TITLE','COST_CENTER'],
      raw: true,
    });
    if (!emp) return res.status(404).json({ ok: false, message: 'Employee not found' });
    let cursor = start.clone().startOf('month');
    const points = [];
    let totalLyd = 0;
    while (cursor.isSameOrBefore(end, 'month')) {
      const YY = cursor.year();
      const MM = cursor.month() + 1;

      // Prefer V2 saved/archived payroll rows (contain gold/diamond/gross/net)
      const whereMonth = { year: YY, month: MM, id_emp: Number(employeeId) };
      let row = null;
      try {
        row = await PayrollArchivedSalary.findOne({ where: whereMonth, raw: true });
      } catch {}
      if (!row) {
        try {
          row = await PayrollSalary.findOne({ where: whereMonth, raw: true });
        } catch {}
      }

      if (row) {
        const goldLyd = Number(row.gold_bonus_lyd || 0) || 0;
        const goldUsd = Number(row.gold_bonus_usd || 0) || 0;
        const diamondLyd = Number(row.diamond_bonus_lyd || 0) || 0;
        const diamondUsd = Number(row.diamond_bonus_usd || 0) || 0;
        const grossLyd = Number(row.total_salary_lyd || 0) || 0;
        const grossUsd = Number(row.total_salary_usd || 0) || 0;
        const netLyd = Number(row.net_salary_lyd || 0) || 0;
        const netUsd = Number(row.net_salary_usd || 0) || 0;

        points.push({
          year: YY,
          month: MM,
          total: netLyd,
          gold_lyd: goldLyd,
          gold_usd: goldUsd,
          diamond_lyd: diamondLyd,
          diamond_usd: diamondUsd,
          gross_lyd: grossLyd,
          gross_usd: grossUsd,
          net_lyd: netLyd,
          net_usd: netUsd,
        });
        totalLyd += netLyd;
      } else {
        // Fallback: legacy compute (LYD only)
        const holidaySet = await buildHolidaySet(YY, MM);
        const slip = await computePayslip(emp, { year: YY, month: MM, holidaySet });
        const total = Number(slip.total) || 0;
        points.push({
          year: YY,
          month: MM,
          total,
          gold_lyd: 0,
          gold_usd: 0,
          diamond_lyd: 0,
          diamond_usd: 0,
          gross_lyd: total,
          gross_usd: 0,
          net_lyd: total,
          net_usd: 0,
        });
        totalLyd += total;
      }
      cursor = cursor.add(1, 'month');
    }
    res.json({ ok: true, totalLyd: Number(totalLyd.toFixed(2)), points });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Failed to compute history totals' });
  }
};

// GET /hr/payroll/adjustments?year&month&employeeId
exports.getAdjustments = async (req, res) => {
  try {
    const { year, month, employeeId } = req.query || {};
    const db = readAdjFile();
    let needsSave = false;
    
    // Migrate: add IDs to any entries that don't have them
    for (const period of Object.keys(db)) {
      for (const empId of Object.keys(db[period])) {
        const entries = db[period][empId] || [];
        for (let i = 0; i < entries.length; i++) {
          if (!entries[i].id) {
            entries[i].id = Date.now() + Math.floor(Math.random() * 10000) + i;
            needsSave = true;
          }
        }
      }
    }
    if (needsSave) writeAdjFile(db);
    
    if (!year || !month) return res.json({ ok: true, data: db });
    const y = Number(year);
    const m = Number(month);
    if (!y || !m) return res.json({ ok: true, data: {} });
    const key = `${y}-${String(m).padStart(2,'0')}`;
    let rows = db[key] || {};
    if (employeeId) {
      const list = resolveEffectiveAdjustments(db, y, m, employeeId);
      rows = { [String(employeeId)]: list };
    } else {
      const out = {};
      for (const empId of Object.keys(rows || {})) {
        out[String(empId)] = resolveEffectiveAdjustments(db, y, m, empId);
      }
      rows = out;
    }
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Failed to read adjustments' });
  }
};

// POST /hr/payroll/adjustments { year, month, employeeId, type, amount, currency, note }
exports.addAdjustment = async (req, res) => {
  try {
    const { year, month, employeeId, type, amount, currency, note, label, direction, recurring, startYear, startMonth, endYear, endMonth } = req.body || {};
    if (!year || !month || !employeeId || !type) return res.status(400).json({ ok: false, message: 'Missing year, month, employeeId, or type' });
    const key = `${year}-${String(month).padStart(2,'0')}`;
    const db = readAdjFile();
    if (!db[key]) db[key] = {};
    if (!db[key][String(employeeId)]) db[key][String(employeeId)] = [];
    // Generate unique ID for the entry
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const entry = {
      id,
      type: String(type),
      label: label !== undefined ? String(label) : undefined,
      direction: direction !== undefined ? String(direction).toUpperCase() : undefined,
      recurring: !!recurring,
      startYear: startYear !== undefined ? Number(startYear) : undefined,
      startMonth: startMonth !== undefined ? Number(startMonth) : undefined,
      endYear: endYear !== undefined && endYear !== null && endYear !== '' ? Number(endYear) : undefined,
      endMonth: endMonth !== undefined && endMonth !== null && endMonth !== '' ? Number(endMonth) : undefined,
      amount: Number(amount || 0),
      currency: (currency || 'LYD').toUpperCase(),
      note: note || '',
      ts: new Date().toISOString(),
    };
    db[key][String(employeeId)].push(entry);
    writeAdjFile(db);
    res.json({ ok: true, entry });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Failed to add adjustment' });
  }
};

// PUT /hr/payroll/adjustments/:id { type, amount, currency, note }
exports.updateAdjustment = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, currency, note, label, direction, recurring, startYear, startMonth, endYear, endMonth } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, message: 'Missing adjustment id' });
    
    const db = readAdjFile();
    let found = false;
    let updatedEntry = null;
    
    // Search through all periods and employees to find the entry
    for (const period of Object.keys(db)) {
      for (const empId of Object.keys(db[period])) {
        const entries = db[period][empId] || [];
        const idx = entries.findIndex(e => String(e.id) === String(id));
        if (idx !== -1) {
          // Update the entry
          if (type !== undefined) entries[idx].type = String(type);
          if (label !== undefined) entries[idx].label = label !== null ? String(label) : undefined;
          if (direction !== undefined) entries[idx].direction = direction !== null ? String(direction).toUpperCase() : undefined;
          if (recurring !== undefined) entries[idx].recurring = !!recurring;
          if (startYear !== undefined) entries[idx].startYear = startYear !== null && startYear !== '' ? Number(startYear) : undefined;
          if (startMonth !== undefined) entries[idx].startMonth = startMonth !== null && startMonth !== '' ? Number(startMonth) : undefined;
          if (endYear !== undefined) entries[idx].endYear = endYear !== null && endYear !== '' ? Number(endYear) : undefined;
          if (endMonth !== undefined) entries[idx].endMonth = endMonth !== null && endMonth !== '' ? Number(endMonth) : undefined;
          if (amount !== undefined) entries[idx].amount = Number(amount);
          if (currency !== undefined) entries[idx].currency = (currency || 'LYD').toUpperCase();
          if (note !== undefined) entries[idx].note = note || '';
          entries[idx].updatedAt = new Date().toISOString();
          updatedEntry = entries[idx];
          found = true;
          break;
        }
      }
      if (found) break;
    }
    
    if (!found) return res.status(404).json({ ok: false, message: 'Adjustment not found' });
    
    writeAdjFile(db);
    res.json({ ok: true, entry: updatedEntry });
  } catch (e) {
    console.error('[updateAdjustment] error:', e);
    res.status(500).json({ ok: false, message: 'Failed to update adjustment' });
  }
};

// DELETE /hr/payroll/adjustments/:id
exports.deleteAdjustment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ ok: false, message: 'Missing adjustment id' });
    
    const db = readAdjFile();
    let found = false;
    
    // Search through all periods and employees to find and remove the entry
    for (const period of Object.keys(db)) {
      for (const empId of Object.keys(db[period])) {
        const entries = db[period][empId] || [];
        const idx = entries.findIndex(e => String(e.id) === String(id));
        if (idx !== -1) {
          entries.splice(idx, 1);
          found = true;
          break;
        }
      }
      if (found) break;
    }
    
    if (!found) return res.status(404).json({ ok: false, message: 'Adjustment not found' });
    
    writeAdjFile(db);
    res.json({ ok: true });
  } catch (e) {
    console.error('[deleteAdjustment] error:', e);
    res.status(500).json({ ok: false, message: 'Failed to delete adjustment' });
  }
};

// GET /hr/payroll/sales-metrics?year&month&employeeId
exports.salesMetrics = async (req, res) => {
  try {
    const { year, month, employeeId } = req.query || {};
    const YY = Number(year) || moment().year();
    const MM = Number(month) || (moment().month() + 1);
    const startYmd = moment.utc({ year: YY, month: MM - 1, day: 1 }).format('YYYY-MM-DD');
    const endYmd = moment.utc({ year: YY, month: MM - 1, day: daysInMonth(YY, MM) }).format('YYYY-MM-DD');

    const Invoice = require('../../models/sales/Invoice');
    const betweenLiteral = literal(`CONVERT(date, [Facture].[d_time], 23) BETWEEN '${startYmd}' AND '${endYmd}'`);
    const whereClause = employeeId ? { [Op.and]: [betweenLiteral, { usr: Number(employeeId) }] } : betweenLiteral;
    const rows = await Invoice.findAll({
      attributes: [ 'usr', [fn('SUM', cast(col('amount_lyd'), 'float')), 'total_lyd'], [fn('SUM', cast(col('qty'), 'float')), 'qty'] ],
      where: whereClause,
      group: ['usr'],
      raw: true,
    });
    res.json({ ok: true, rows });
  } catch (e) {
    console.error('[salesMetrics] error:', e);
    res.status(500).json({ ok: false, message: 'Failed to compute sales metrics' });
  }
};

// GET /hr/payroll/change-logs?year&month&employeeId
exports.changeLogs = async (req, res) => {
  try {
    const { year, month, employeeId } = req.query || {};
    const YY = Number(year) || moment().year();
    const MM = Number(month) || (moment().month() + 1);
    const start = moment.utc({ year: YY, month: MM - 1, day: 1 });
    const end = start.clone().endOf('month');
    const LOG_FILE = path.resolve(__dirname, '../../logs/hr-change-log.json');
    if (!fs.existsSync(LOG_FILE)) return res.json({ ok: true, rows: [] });
    let arr = [];
    try { arr = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8') || '[]') || []; } catch { arr = []; }
    const rows = (arr || []).filter((r) => {
      if (employeeId && String(r.id_emp) !== String(employeeId)) return false;
      const ts = moment(r.ts);
      return ts.isValid() && ts.isSameOrAfter(start) && ts.isSameOrBefore(end);
    });
    res.json({ ok: true, rows });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Failed to read change logs' });
  }
};

exports.run = async (req, res) => {
  try {
    const { year, month, ps, employeeId } = req.body || {};
    const now = moment();
    const YY = Number(year) || now.year();
    const MM = Number(month) || (now.month() + 1);

    const whereEmp = {};
    if (ps != null && ps !== '') whereEmp.PS = Number(ps);
    if (employeeId) whereEmp.ID_EMP = Number(employeeId);

    // Select minimal fields
    const employees = await Employee.findAll({
      where: whereEmp,
      attributes: ['ID_EMP','NAME','NAME_ENGLISH','PS','ATTACHED_NUMBER','BASIC_SALARY','FOOD','FUEL','COMMUNICATION','FOOD_ALLOWANCE','STATE','TITLE','COST_CENTER'],
      raw: true,
      order: [['ID_EMP', 'ASC']],
    });

    const holidaySet = await buildHolidaySet(YY, MM);

    const slips = [];
    for (const emp of employees) {
      // Optionally skip inactive employees
      if (emp.STATE === false) continue;
      const slip = await computePayslip(emp, { year: YY, month: MM, holidaySet });
      slips.push(slip);
    }

    const dim = daysInMonth(YY, MM);
    const start = `${YY}-${String(MM).padStart(2,'0')}-01`;
    const end = `${YY}-${String(MM).padStart(2,'0')}-${String(dim).padStart(2,'0')}`;

    res.json({ ok: true, year: YY, month: MM, period: { start, end }, count: slips.length, employees: slips });
  } catch (e) {
    console.error('[payroll.run] error:', e);
    res.status(500).json({ ok: false, message: 'Failed to run payroll', error: e?.message || String(e) });
  }
};

// Single payslip (JSON)
exports.payslip = async (req, res) => {
  try {
    const { employeeId, year, month } = req.query || {};
    if (!employeeId) return res.status(400).json({ ok: false, message: 'employeeId is required' });
    const YY = Number(year) || moment().year();
    const MM = Number(month) || (moment().month() + 1);

    const emp = await Employee.findByPk(Number(employeeId), {
      attributes: ['ID_EMP','NAME','NAME_ENGLISH','EMAIL','PS','ATTACHED_NUMBER','BASIC_SALARY','FOOD','FUEL','COMMUNICATION','FOOD_ALLOWANCE','STATE','T_START','T_END','TITLE','COST_CENTER'],
      raw: true,
    });
    if (!emp) return res.status(404).json({ ok: false, message: 'Employee not found' });

    const holidaySet = await buildHolidaySet(YY, MM);
    const slip = await computePayslip(emp, { year: YY, month: MM, holidaySet });
    res.json({ ok: true, ...slip, year: YY, month: MM });
  } catch (e) {
    console.error('[payroll.payslip] error:', e);
    res.status(500).json({ ok: false, message: 'Failed to compute payslip', error: e?.message || String(e) });
  }
};

// Data helper for email sender
exports.getPayslipData = async (employeeId, year, month) => {
  const YY = Number(year) || moment().year();
  const MM = Number(month) || (moment().month() + 1);
  const emp = await Employee.findByPk(Number(employeeId), {
    attributes: ['ID_EMP','NAME','NAME_ENGLISH','EMAIL','PS','ATTACHED_NUMBER','BASIC_SALARY','FOOD','FUEL','COMMUNICATION','FOOD_ALLOWANCE','STATE','T_START','T_END'],
    raw: true,
  });
  if (!emp) throw new Error('Employee not found');
  const holidaySet = await buildHolidaySet(YY, MM);
  const slip = await computePayslip(emp, { year: YY, month: MM, holidaySet });
  const dim = daysInMonth(YY, MM);
  const period = { start: `${YY}-${String(MM).padStart(2,'0')}-01`, end: `${YY}-${String(MM).padStart(2,'0')}-${String(dim).padStart(2,'0')}` };
  return { slip: { ...slip, year: YY, month: MM }, emp, period };
};

// PDF buffer generator
function makePayslipPdfBuffer({ slip, period, company = { name: 'GAJA ERP' } }) {
  const doc = new PDFDocument({ margin: 36 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  // Try to register an Arabic-capable font if present in the repo (frontend fonts)
  let hasArabicFont = false;
  try {
    const FONT_DIR = path.resolve(__dirname, '../../..', 'GAJA-FrontEnd', 'public', 'fonts');
    const candidates = [
      'NotoNaskhArabic-VariableFont_wght.ttf',
      'NotoNaskhArabic-Regular.ttf',
      'Amiri-Regular.ttf',
    ];
    for (const fname of candidates) {
      const p = path.join(FONT_DIR, fname);
      if (fs.existsSync(p)) {
        try { const fontkit = require('fontkit'); /* eslint-disable-line no-unused-vars */ } catch {}
        const buf = fs.readFileSync(p);
        doc.registerFont('Arabic', buf);
        hasArabicFont = true;
        doc.font('Arabic');
        break;
      }
    }
  } catch {}

  const shapedCompany = shapeArabicIfPossible(company?.name || 'GAJA ERP');
  const companyHasArabic = /[\u0600-\u06FF]/.test(String(company?.name || ''));
  if (hasArabicFont && companyHasArabic) {
    try { doc.font('Arabic').fontSize(18).text(`${shapedCompany} — Payslip`, { align: 'right' }); } catch { doc.fontSize(18).text(`${shapedCompany} — Payslip`, { align: 'left' }); }
  } else {
    doc.fontSize(18).text(`${shapedCompany} — Payslip`, { align: 'left' });
  }
  doc.moveDown(0.2);
  // Shape Arabic text if possible (using optional deps). Safe no-op if not installed.
  function shapeArabicIfPossible(text) {
    try {
      const reshaper = require('arabic-reshaper');
      const raw = String(text || '');
      const reshaped = reshaper.reshape(raw);
      try {
        // Prefer bidi-js if available
        const bidi = require('bidi-js');
        const bidiText = bidi.from_string(reshaped, { direction: 'RTL' });
        bidiText.reorder_visually();
        return bidiText.toString();
      } catch {
        // Fallback: naive RTL reversal (good enough for names)
        if (/^[\u0600-\u06FF\s'\-]+$/.test(reshaped)) {
          return [...reshaped].reverse().join('');
        }
        return reshaped;
      }
    } catch {
      return text;
    }
  }
  const shapedName = shapeArabicIfPossible(slip.name);
  const nameLine = `Employee: ${shapedName} (ID: ${slip.id_emp})`;
  const nameHasArabic = /[\u0600-\u06FF]/.test(String(slip.name || ''));
  if (hasArabicFont && nameHasArabic) {
    try { doc.font('Arabic').fontSize(10).text(nameLine, { align: 'right' }); } catch { doc.fontSize(10).text(nameLine); }
  } else {
    doc.fontSize(10).text(nameLine);
  }
  doc.text(`PS: ${slip.PS ?? '—'}`);
  doc.text(`Period: ${period.start} → ${period.end}`);
  doc.moveDown(0.5);
  doc.rect(36, doc.y, 540, 0.5).fillAndStroke('#e0e0e0', '#e0e0e0');
  doc.moveDown(0.8);
  doc.fontSize(11).text('Summary', { underline: true });
  const rows = [
    ['Working days', String(slip.workingDays)],
    ['Deduction days', String(slip.deductionDays)],
    ['Present days', String(slip.presentWorkdays)],
    ['Holidays worked', String(slip.holidayWorked)],
  ];
  rows.forEach(([k, v]) => doc.text(`${k}: ${v}`));
  doc.moveDown(0.8);
  doc.fontSize(11).text('Components', { underline: true });
  doc.text(`Base salary: ${Number(slip.baseSalary).toFixed(2)}`);
  doc.text(`Daily base: ${(Number(slip.baseSalary)/Math.max(1, Number(slip.workingDays))).toFixed(2)}`);
  doc.text(`Base pay (factors): ${Number(slip.components?.basePay||0).toFixed(2)}`);
  doc.text(`Food allowance/day: ${Number(slip.allowancePerDay).toFixed(2)}`);
  if (typeof slip.foodDays !== 'undefined') doc.text(`Food days: ${String(slip.foodDays)}`);
  doc.text(`Allowance pay: ${Number(slip.components?.allowancePay||0).toFixed(2)}`);
  doc.moveDown(0.8);
  doc.fontSize(12).text(`Total: ${Number(slip.total).toFixed(2)}`);
  doc.end();
  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

exports.payslipPdf = async (req, res) => {
  try {
    const { employeeId, year, month } = req.query || {};
    if (!employeeId) return res.status(400).send('employeeId is required');
    const { slip, period } = await exports.getPayslipData(Number(employeeId), year, month);
    const buf = await makePayslipPdfBuffer({ slip, period });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="payslip_${slip.id_emp}_${slip.year}_${slip.month}.pdf"`);
    return res.status(200).send(buf);
  } catch (e) {
    console.error('[payslipPdf] error:', e);
    res.status(500).send('Failed to generate payslip PDF');
  }
};

// Export generator for index.js usage
exports.makePayslipPdfBuffer = makePayslipPdfBuffer;
