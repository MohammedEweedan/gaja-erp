// controllers/HR/attendanceController.js
/* eslint-disable no-console */
const { Op, fn, col, where, literal, QueryTypes, cast } = require("sequelize");
const moment = require("moment");
const IClockTransaction = require("../../models/hr/IClockTransaction");
const Timesheet = require("../../models/hr/Timesheet");
const Vacation = require("../../models/hr/Vacation");
const TSCode = require("../../models/hr/TSCode");
const Employee = require("../../models/hr/employee1");

const TZ = "Africa/Tripoli";
const TRIPOLI_OFFSET = "+02:00";

// -------------------- Tripoli helpers --------------------
function tripoliParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce((acc, p) => ((acc[p.type] = p.value), acc), {});
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function tripoliYMD(date) {
  if (!date) return null;
  const p = tripoliParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function tripoliHourNow() {
  return tripoliParts(new Date()).hour;
}

function parseTimeToMinutes(t) {
  if (!t) return null;
  const s = String(t).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hh = Math.max(0, Math.min(23, Number(m[1])));
  const mm = Math.max(0, Math.min(59, Number(m[2])));
  return hh * 60 + mm;
}

function isFridayISO(ymd) {
  return moment(ymd, "YYYY-MM-DD").isoWeekday() === 5; // your “Friday off” rule
}

function computeMissingMinutes({ workedMin, expectedMin, isHoliday, isFriday, isToday, isDayOver }) {
  if (isHoliday || isFriday) return 0;
  if (isToday && !isDayOver) return 0;
  if (expectedMin == null || expectedMin <= 0) return 0;
  if (workedMin == null) return 0;

  const gap = Math.max(0, expectedMin - workedMin);
  const missing = Math.max(0, gap - 30); // same tolerance you use elsewhere
  return missing;
}

function buildTripoliDate(ymd, hhmmss) {
  if (!ymd || !hhmmss) return null;
  const time = hhmmss.length === 5 ? `${hhmmss}:00` : hhmmss;
  const iso = `${ymd}T${time}${TRIPOLI_OFFSET}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function firstOfMonthUTC(year, month1to12) {
  return new Date(Date.UTC(year, month1to12 - 1, 1, 0, 0, 0));
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function parseHHMMToDate(ymd, hhmm) {
  if (!ymd || !hhmm) return null;
  const s = String(hhmm).trim();
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(s)) {
    const [dayPart, timePart] = s.split(/\s+/);
    return buildTripoliDate(dayPart, timePart);
  }
  return buildTripoliDate(ymd, s);
}

function minutesBetween(d1, d2) {
  if (!d1 || !d2) return null;
  const ms = d2.getTime() - d1.getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 60000);
}

function computeWorkedMinutesFromPunches(punchDates) {
  if (!Array.isArray(punchDates) || punchDates.length < 2) return null;
  const arr = punchDates.slice().sort((a, b) => a.getTime() - b.getTime());
  let total = 0;
  for (let i = 0; i + 1 < arr.length; i += 2) {
    const diff = minutesBetween(arr[i], arr[i + 1]);
    if (diff != null && diff >= 0 && diff <= 24 * 60) total += diff;
  }
  return total;
}

// -------------------- EMPLOYEE1 columns cache --------------------
let _empColsCache = null;
async function getExistingEmpColumns() {
  if (_empColsCache) return _empColsCache;
  try {
    const [rows] = await Employee.sequelize.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EMPLOYEE1'"
    );
    _empColsCache = new Set(rows.map((r) => String(r.COLUMN_NAME).toUpperCase()));
  } catch {
    _empColsCache = new Set(["ID_EMP", "NAME"]);
  }
  return _empColsCache;
}

// -------------------- Schedule from EMPLOYEE1 ONLY --------------------
function getScheduleStart(employee, ymd) {
  const t = employee?.T_START;
  if (!t) return null;
  const cleaned = String(t).trim().slice(0, 8) || null;
  return cleaned ? buildTripoliDate(ymd, cleaned) : null;
}
function evalResultFlag({ hasPunch, inTime, schedStart }) {
  if (!hasPunch) return "A";
  if (schedStart && inTime && moment(inTime).isAfter(moment(schedStart))) return "L";
  return "";
}

// -------------------- TS month id helper --------------------
async function getMonthTsId(empId, year, month) {
  const dateJs = firstOfMonthUTC(year, month);
  const startDate = moment.utc(dateJs).format("YYYY-MM-DD");
  const endDate = moment.utc(dateJs).add(1, "month").format("YYYY-MM-DD");

  const rows = await Timesheet.sequelize.query(
    "SELECT TOP 1 id_tran FROM TS WHERE id_emp = :emp AND DATE_JS >= CONVERT(date,:s,23) AND DATE_JS < CONVERT(date,:e,23) ORDER BY id_tran DESC",
    { replacements: { emp: Number(empId), s: startDate, e: endDate }, type: QueryTypes.SELECT }
  );
  return rows && rows[0] ? rows[0].id_tran : null;
}

// -------------------- Punch bounds: TS E/S then FP --------------------
async function getDailyPunchBounds(params, ymd) {
  const empId = Number(params?.empId);
  const empCode = params?.empCode != null ? String(params.empCode) : null;
  if (!empId || !ymd) return { in: null, out: null, source: "none" };

  const [year, month, day] = ymd.split("-").map(Number);

  // 1) TS manual punches
  try {
    const tsId = await getMonthTsId(empId, year, month);
    if (tsId) {
      const eKey = `E${day}`,
        sKey = `S${day}`;
      const tsRow = await Timesheet.findOne({ where: { id_tran: tsId }, attributes: [eKey, sKey], raw: true });
      if (tsRow && (tsRow[eKey] || tsRow[sKey])) {
        return {
          in: tsRow[eKey] ? new Date(tsRow[eKey]) : null,
          out: tsRow[sKey] ? new Date(tsRow[sKey]) : null,
          source: "ts",
        };
      }
    }
  } catch {}

  // 2) FP fallback
  if (!empCode) return { in: null, out: null, source: "none" };

  const start = buildTripoliDate(ymd, "00:00:00");
  const end = buildTripoliDate(ymd, "23:59:59");

  try {
    const rows = await IClockTransaction.findAll({
      where: { emp_code: empCode, punch_time: { [Op.between]: [start, end] } },
      attributes: [[fn("MIN", col("punch_time")), "minPunch"], [fn("MAX", col("punch_time")), "maxPunch"]],
      raw: true,
    });
    const rec = rows && rows[0] ? rows[0] : {};
    return {
      in: rec.minPunch ? new Date(rec.minPunch) : null,
      out: rec.maxPunch ? new Date(rec.maxPunch) : null,
      source: "fp",
    };
  } catch {
    return { in: null, out: null, source: "none" };
  }
}

async function getLeaveCodeForDay(id_emp, ymd) {
  try {
    const depDate = literal("CONVERT(date, date_depart, 23)");
    const endDate = literal("CONVERT(date, date_end, 23)");
    const v = await Vacation.findOne({
      where: {
        id_emp,
        state: "Approved",
        [Op.and]: [where(depDate, { [Op.lte]: ymd }), where(endDate, { [Op.gte]: ymd })],
      },
      attributes: ["id_can"],
      raw: true,
    });
    if (!v) return null;
    const codeRow = await TSCode.findOne({ where: { int_can: v.id_can }, attributes: ["code"], raw: true });
    return codeRow ? codeRow.code : null;
  } catch {
    return null;
  }
}

// -------------------- Endpoints --------------------
exports.previewDaily = async (req, res) => {
  try {
    const { employeeId, date } = req.query;
    if (!employeeId || !date) return res.status(400).json({ message: "employeeId and date are required" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return res.status(400).json({ message: "date must be YYYY-MM-DD" });

    let emp = await Employee.findByPk(employeeId, {
      attributes: ["ID_EMP", "NAME", "PS", "T_START", "T_END", "ATTACHED_NUMBER"],
    });
    if (!emp) emp = await Employee.findOne({ where: { ATTACHED_NUMBER: String(employeeId) } });
    if (!emp) return res.status(404).json({ message: "Employee not found" });

    const empCode = emp.ATTACHED_NUMBER || emp.ID_EMP;
    const bounds = await getDailyPunchBounds({ empId: emp.ID_EMP, empCode }, date);
    const leaveCode = await getLeaveCodeForDay(emp.ID_EMP, date);
    const schedStart = getScheduleStart(emp, date);
    const hasPunch = !!bounds.in;

    // Prefer manual TS day code if present
    let manualJ = null;
    let manualR = null;
    try {
      const d = moment(date, "YYYY-MM-DD", true);
      if (d.isValid()) {
        const day = d.date();
        const monthStart = new Date(Date.UTC(d.year(), d.month(), 1, 0, 0, 0));
        const monthEnd = new Date(Date.UTC(d.year(), d.month() + 1, 1, 0, 0, 0));

        const pick = [`j_${day}`, `R_${day}`];
        const ts = await Timesheet.findOne({
          where: {
            id_emp: emp.ID_EMP,
            [Op.and]: [where(cast(col("DATE_JS"), "datetimeoffset"), { [Op.gte]: monthStart, [Op.lt]: monthEnd })],
          },
          attributes: pick,
          raw: true,
        });
        if (ts) {
          manualJ = ts[`j_${day}`] || null;
          manualR = ts[`R_${day}`] || null;
        }
      }
    } catch {}

    const j = manualJ || (leaveCode ? leaveCode : hasPunch ? "P" : "A");
    const R = manualR || evalResultFlag({ hasPunch, inTime: bounds.in, schedStart });

    res.json({ employeeId: emp.ID_EMP, date, j, R, E: bounds.in, S: bounds.out, PS: emp.PS ?? null, source: bounds.source });
  } catch (e) {
    console.error("previewDaily error:", e);
    res.status(500).json({ message: "Failed to preview daily attendance" });
  }
};

exports.rangePunches = async (req, res) => {
  try {
    const { from, to, ps, employeeId } = req.query;
    if (!from || !to) return res.status(400).json({ message: "from and to are required (YYYY-MM-DD)" });

    const start = moment(from, "YYYY-MM-DD", true);
    const end = moment(to, "YYYY-MM-DD", true);
    if (!start.isValid() || !end.isValid()) return res.status(400).json({ message: "Invalid date format; use YYYY-MM-DD" });
    if (end.isBefore(start)) return res.status(400).json({ message: "to must be on or after from" });

    const whereEmp = {};
    if (ps != null && ps !== "") whereEmp.PS = Number(ps);
    if (employeeId) whereEmp.ID_EMP = Number(employeeId);

    const defaultAttrs = ["ID_EMP", "NAME", "ATTACHED_NUMBER", "PS", "T_START", "T_END", "CONTRACT_START", "TITLE"];
    const cols = await getExistingEmpColumns();
    const safeAttrs = defaultAttrs.filter((c) => cols.has(c));

    const employees = await Employee.findAll({
      where: whereEmp,
      attributes: safeAttrs,
      raw: true,
      order: [["ID_EMP", "ASC"]],
    });

    const daysCount = end.diff(start, "days") + 1;
    const result = [];

    const todayKey = tripoliYMD(new Date());
    const isDayOver = tripoliHourNow() >= 23;

    for (const emp of employees) {
      const code = emp.ATTACHED_NUMBER || emp.ID_EMP;
      const rows = [];

      // months covered
      const monthKeys = new Set();
      for (let i = 0; i < daysCount; i++) monthKeys.add(start.clone().add(i, "days").format("YYYY-MM"));

      // prefetch TS month rows (E/S + manual codes)
      const tsByMonth = new Map();
      for (const mk of monthKeys) {
        const YY = Number(mk.slice(0, 4));
        const MM = Number(mk.slice(5, 7));
        const tsId = await getMonthTsId(emp.ID_EMP, YY, MM);
        if (tsId) {
          const attrs = [];
          for (let d = 1; d <= 31; d++) attrs.push(`E${d}`, `S${d}`, `j_${d}`, `R_${d}`, `comm${d}`);
          const tsRow = await Timesheet.findOne({ where: { id_tran: tsId }, attributes: attrs, raw: true });
          tsByMonth.set(mk, tsRow || null);
        } else {
          tsByMonth.set(mk, null);
        }
      }

      // prefetch FP punches for range (widened)
      const widenStart = start.clone().subtract(1, "day").toDate();
      const widenEnd = end.clone().add(1, "day").toDate();

      let punches = [];
      try {
        punches = await IClockTransaction.findAll({
          where: { emp_code: String(code), punch_time: { [Op.between]: [widenStart, widenEnd] } },
          attributes: ["punch_time"],
          raw: true,
          order: [["punch_time", "ASC"]],
        });
      } catch (fpErr) {
        console.warn("[rangePunches] FP DB unavailable; continuing without punches:", fpErr?.message || fpErr);
        punches = [];
      }

      // group punches by Tripoli ymd
      const byDate = new Map();
      for (const p of punches) {
        const dt = new Date(p.punch_time);
        const ymd = tripoliYMD(dt);
        if (!ymd) continue;
        if (ymd >= start.format("YYYY-MM-DD") && ymd <= end.format("YYYY-MM-DD")) {
          if (!byDate.has(ymd)) byDate.set(ymd, []);
          byDate.get(ymd).push(dt);
        }
      }

      // vacations + codes
      const startYmd = start.format("YYYY-MM-DD");
      const endYmd = end.format("YYYY-MM-DD");
      let vacRows = [];
      let codeMap = new Map();
      try {
        vacRows = await Vacation.findAll({
          where: {
            id_emp: emp.ID_EMP,
            state: "Approved",
            [Op.and]: [
              where(literal("CONVERT(date, date_depart, 23)"), { [Op.lte]: endYmd }),
              where(literal("CONVERT(date, date_end, 23)"), { [Op.gte]: startYmd }),
            ],
          },
          attributes: ["id_can", "date_depart", "date_end"],
          raw: true,
        });
        const idCans = Array.from(new Set(vacRows.map((v) => v.id_can).filter(Boolean)));
        const codeRows = idCans.length
          ? await TSCode.findAll({ where: { int_can: idCans }, attributes: ["int_can", "code"], raw: true })
          : [];
        codeMap = new Map(codeRows.map((r) => [String(r.int_can), r.code]));
      } catch (vacErr) {
        console.warn("[rangePunches] Vacations/TSCode unavailable; continuing without leave codes:", vacErr?.message || vacErr);
        vacRows = [];
        codeMap = new Map();
      }

      for (let i = 0; i < daysCount; i++) {
        const ymd = start.clone().add(i, "days").format("YYYY-MM-DD");
        const mk = ymd.slice(0, 7);
        const dayNum = Number(ymd.slice(8, 10));
        const isToday = ymd === todayKey;

        const tsRow = tsByMonth.get(mk);

        // manual fields
        let manualJ = null,
          manualR = null,
          manualComm = null;
        let E = null,
          S = null;

        if (tsRow) {
          manualJ = tsRow[`j_${dayNum}`] || null;
          manualR = tsRow[`R_${dayNum}`] || null;
          manualComm = tsRow[`comm${dayNum}`] || null;

          const eKey = `E${dayNum}`,
            sKey = `S${dayNum}`;
          E = tsRow[eKey] ? new Date(tsRow[eKey]) : null;
          S = tsRow[sKey] ? new Date(tsRow[sKey]) : null;
        }

        const arr = (byDate.get(ymd) || []).slice().sort((a, b) => a.getTime() - b.getTime());
        if (!E && arr.length > 0) E = arr[0];
        if (!S && arr.length > 0) S = arr[arr.length - 1];

        let leaveCode = null;
        for (const v of vacRows) {
          const vs = moment(v.date_depart).format("YYYY-MM-DD");
          const ve = moment(v.date_end).format("YYYY-MM-DD");
          if (ymd >= vs && ymd <= ve) {
            leaveCode = codeMap.get(String(v.id_can)) || null;
            break;
          }
        }

        const hasPunch = !!E;
        const schedStart = getScheduleStart(emp, ymd); // from EMPLOYEE1.T_START

        let j, R;
        if (isToday && !isDayOver) {
          j = manualJ || (leaveCode ? leaveCode : hasPunch ? "P" : "?");
          R = manualR || "";
        } else {
          j = manualJ || (leaveCode ? leaveCode : hasPunch ? "P" : "A");
          R = manualR || evalResultFlag({ hasPunch, inTime: E, schedStart });
        }

        const workedMin = arr.length ? computeWorkedMinutesFromPunches(arr) : null;

        // schedule from EMPLOYEE1
        const schedStartMin = parseTimeToMinutes(emp.T_START);
        const schedEndMin = parseTimeToMinutes(emp.T_END);
        const expectedMin =
          schedStartMin != null && schedEndMin != null && schedEndMin > schedStartMin
            ? (schedEndMin - schedStartMin)
            : null;

        const isFri = isFridayISO(ymd);
        const isHol = false; // (optional: later you can add holiday engine here)
        const missingTol = 30;

        let missingMin = 0;
        if (!isHol && !isFri && !(isToday && !isDayOver) && expectedMin && workedMin != null) {
          const gap = Math.max(0, expectedMin - workedMin);
          missingMin = Math.max(0, gap - missingTol);
        }

        const deltaMin = missingMin > 0 ? -missingMin : 0;
        rows.push({
          date: ymd,
          j,
          R,
          E,
          S,
          comment: manualComm || "",
          workedMin,
          expectedMin,
          deltaMin, // ✅ frontend uses this for the Δ badge
        });
      }

      const monthMissingMinutes = rows.reduce((acc, d) => {
      const dm = Number(d.deltaMin || 0);
        return dm < 0 ? acc + Math.abs(dm) : acc;
      }, 0);

      result.push({
        id_emp: emp.ID_EMP,
        name: emp.NAME,
        ps: emp.PS ?? null,
        T_START: emp.T_START ?? null,
        T_END: emp.T_END ?? null,
        CONTRACT_START: emp.CONTRACT_START ?? null,
        TITLE: emp.TITLE ?? null,
        monthMissingMinutes, // ✅
        days: rows,
      });
    }

    res.json({ from: start.format("YYYY-MM-DD"), to: end.format("YYYY-MM-DD"), count: result.length, employees: result });
  } catch (e) {
    console.error("rangePunches error:", e);
    res.status(500).json({ message: "Failed to load range punches" });
  }
};

exports.syncMonth = async (req, res) => {
  try {
    const { employeeId, year, month } = req.body;
    if (!employeeId) return res.status(400).json({ message: "employeeId is required" });

    const now = moment();
    const YY = Number(year) || now.year();
    const MM = Number(month) || now.month() + 1;

    const emp = await Employee.findByPk(employeeId, { attributes: ["ID_EMP", "T_START", "T_END", "ATTACHED_NUMBER"] });
    if (!emp) return res.status(404).json({ message: "Employee not found" });

    const empCode = emp.ATTACHED_NUMBER || emp.ID_EMP;
    const dim = daysInMonth(YY, MM);

    const updates = {};
    for (let d = 1; d <= dim; d++) {
      const ymd = moment({ year: YY, month: MM - 1, day: d }).format("YYYY-MM-DD");
      const bounds = await getDailyPunchBounds({ empId: emp.ID_EMP, empCode }, ymd);
      const leaveCode = await getLeaveCodeForDay(emp.ID_EMP, ymd);
      const schedStart = getScheduleStart(emp, ymd);
      const hasPunch = !!bounds.in;

      updates[`j_${d}`] = leaveCode ? leaveCode : hasPunch ? "P" : "A";
      updates[`R_${d}`] = evalResultFlag({ hasPunch, inTime: bounds.in, schedStart });
      updates[`E${d}`] = bounds.in || null;
      updates[`S${d}`] = bounds.out || null;
      updates[`comm${d}`] = "";
    }

    const monthStartDate = firstOfMonthUTC(YY, MM);
    const monthEndDate = firstOfMonthUTC(YY, MM + 1);

    const existing = await Timesheet.findOne({
      where: {
        id_emp: emp.ID_EMP,
        [Op.and]: [where(cast(col("DATE_JS"), "datetimeoffset"), { [Op.gte]: monthStartDate, [Op.lt]: monthEndDate })],
      },
      attributes: ["id_tran"],
      raw: true,
    });

    if (!existing?.id_tran) {
      await Timesheet.create({
        id_emp: emp.ID_EMP,
        DATE_JS: monthStartDate,
        Comment: "",
        nbr_h: 0,
        ...updates,
      });
      return res.json({ message: "Timesheet created and updated" });
    }

    await Timesheet.update({ ...updates }, { where: { id_tran: existing.id_tran } });
    return res.json({ message: "Timesheet updated", id_tran: existing.id_tran });
  } catch (e) {
    console.error("syncMonth error:", e && (e.parent || e.original || e));
    res.status(500).json({ message: "Failed to sync month", error: e && e.message });
  }
};

exports.saveMonthlyMissing = async (req, res) => {
  try {
    const { employeeId, year, month, missingMinutes } = req.body || {};
    if (!employeeId || !year || !month) {
      return res.status(400).json({ ok: false, message: "employeeId, year, month are required" });
    }

    const id_emp = Number(employeeId);
    const YY = Number(year);
    const MM = Number(month);
    const miss = Math.max(0, Math.floor(Number(missingMinutes || 0)));

    const monthStartDate = firstOfMonthUTC(YY, MM);
    const monthEndDate = firstOfMonthUTC(YY, MM + 1);

    // Find existing TS row for this month (same pattern you use elsewhere)
    const existing = await Timesheet.findOne({
      where: {
        id_emp,
        [Op.and]: [
          where(cast(col("DATE_JS"), "datetimeoffset"), { [Op.gte]: monthStartDate, [Op.lt]: monthEndDate }),
        ],
      },
      attributes: ["id_tran"],
      raw: true,
    });

    if (existing?.id_tran) {
      await Timesheet.update({ nbr_h: miss }, { where: { id_tran: existing.id_tran } }); 
      return res.json({ ok: true, updated: true, id_tran: existing.id_tran, nbr_h: miss });
    }

    // No TS row yet -> create minimal month row (NO new tables, just TS)
    await Timesheet.create({
      id_emp,
      DATE_JS: monthStartDate,
      Comment: "",
      nbr_h: miss,
    });

    return res.json({ ok: true, created: true, nbr_h: miss });
  } catch (e) {
    console.error("saveMonthlyMissing error:", e);
    return res.status(500).json({ ok: false, message: "Failed to save monthly missing minutes" });
  }
};

exports.psList = async (_req, res) => {
  try {
    const rows = await Employee.findAll({
      attributes: ["PS", [fn("COUNT", col("ID_EMP")), "count"]],
      where: { PS: { [Op.ne]: null } },
      group: ["PS"],
      raw: true,
      order: [["PS", "ASC"]],
    });
    res.json(rows);
  } catch {
    res.status(500).json({ message: "Failed to load PS list" });
  }
};

exports.psToday = async (req, res) => {
  try {
    const { ps } = req.query;
    if (ps == null) return res.status(400).json({ message: "ps is required" });

    const today = tripoliYMD(new Date());
    const emps = await Employee.findAll({
      where: { PS: Number(ps) },
      attributes: ["ID_EMP", "NAME", "ATTACHED_NUMBER", "PS", "T_START", "T_END"],
      raw: true,
    });

    const result = [];
    for (const emp of emps) {
      const code = emp.ATTACHED_NUMBER || emp.ID_EMP;
      const bounds = await getDailyPunchBounds({ empId: emp.ID_EMP, empCode: code }, today);
      const leaveCode = await getLeaveCodeForDay(emp.ID_EMP, today);
      const schedStart = getScheduleStart(emp, today);
      const hasPunch = !!bounds.in;

      const j = leaveCode ? leaveCode : hasPunch ? "P" : "A";
      const R = evalResultFlag({ hasPunch, inTime: bounds.in, schedStart });

      result.push({ id_emp: emp.ID_EMP, name: emp.NAME, j, R, E: bounds.in, S: bounds.out, source: bounds.source });
    }

    res.json({ ps: Number(ps), date: today, employees: result });
  } catch {
    res.status(500).json({ message: "Failed to load PS attendance" });
  }
};

// ---------- Manual punch ----------
exports.manualPunch = async (req, res) => {
  try {
    const { employeeId, date, statusCode, reason, comment, entry, exit } = req.body;
    if (!employeeId || !date || !statusCode) {
      return res.status(400).json({ error: "employeeId, date, statusCode are required" });
    }

    const d = moment(date, "YYYY-MM-DD", true);
    if (!d.isValid()) return res.status(400).json({ error: "Invalid date (YYYY-MM-DD)" });

    const day = d.date();
    const monthStartDate = new Date(Date.UTC(d.year(), d.month(), 1, 0, 0, 0));
    const monthEndDate = new Date(Date.UTC(d.year(), d.month() + 1, 1, 0, 0, 0));

    const ts = await Timesheet.findOne({
      where: {
        id_emp: Number(employeeId),
        [Op.and]: [where(cast(col("DATE_JS"), "datetimeoffset"), { [Op.gte]: monthStartDate, [Op.lt]: monthEndDate })],
      },
      attributes: ["id_tran"],
      raw: true,
    });

    const E = entry ? parseHHMMToDate(d.format("YYYY-MM-DD"), entry) : null;
    const S = exit ? parseHHMMToDate(d.format("YYYY-MM-DD"), exit) : null;

    if (ts?.id_tran) {
      await Timesheet.update(
        {
          [`j_${day}`]: statusCode,
          [`R_${day}`]: reason || "",
          [`comm${day}`]: comment || "",
          [`E${day}`]: E || null,
          [`S${day}`]: S || null,
        },
        { where: { id_tran: ts.id_tran } }
      );
    } else {
      await Timesheet.create({
        id_emp: Number(employeeId),
        DATE_JS: monthStartDate,
        Comment: "",
        nbr_h: 0,
        [`j_${day}`]: statusCode,
        [`R_${day}`]: reason || "",
        [`comm${day}`]: comment || "",
        [`E${day}`]: E || null,
        [`S${day}`]: S || null,
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Error in manualPunch:", err);
    return res.status(500).json({
      error: "Failed to update attendance",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
