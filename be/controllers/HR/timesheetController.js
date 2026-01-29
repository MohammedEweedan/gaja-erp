// controllers/HR/timesheetController.js
/* eslint-disable no-console */
const Timesheet = require("../../models/hr/Timesheet");
const IClockTransaction = require("../../models/hr/IClockTransaction");
const jwt = require("jsonwebtoken");
const Employee = require("../../models/hr/employee1");
const TSCode = require("../../models/hr/TSCode");
const moment = require("moment");
const { Op, col, where, cast } = require("sequelize");
const { getExpandedHolidaysBetween } = require("../../utils/leaveDayEngine");

const TZ = "Africa/Tripoli";
const MISSING_TOLERANCE_MINUTES = 30;

// -------------------- TZ helpers (Tripoli-safe) --------------------
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

function dayInTripoli(date) {
  if (!date) return null;
  return tripoliParts(date).day;
}

function toTripoliISO(date) {
  if (!date) return null;
  const p = tripoliParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}T${String(p.hour).padStart(
    2,
    "0"
  )}:${String(p.minute).padStart(2, "0")}:${String(p.second).padStart(2, "0")}`;
}

function buildMonthRangeUTC(year, month1to12) {
  const start = new Date(Date.UTC(year, month1to12 - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month1to12, 1, 0, 0, 0));
  const daysInMonth = new Date(year, month1to12, 0).getDate();
  return { start, end, daysInMonth };
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

function minutesBetween(d1, d2) {
  if (!d1 || !d2) return null;
  const ms = d2.getTime() - d1.getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 60000);
}

// Pair punches: [in,out,in,out,...]
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

// -------------------- JWT --------------------
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });
    req.user = decoded;
    next();
  });
};

// -------------------- Defaults for TS row --------------------
function emptyMonthPayload() {
  const payload = {};
  for (let d = 1; d <= 31; d++) {
    payload[`j_${d}`] = "";
    payload[`R_${d}`] = "";
    payload[`comm${d}`] = "";
  }
  payload.Comment = "";
  payload.nbr_h = 0;
  payload.PS = 0;
  payload.nbr_DAY = 0;
  payload.j_absence = "";
  payload.nbr_SICK = 0;
  payload.Day_shift_nbr = 0;
  return payload;
}

// -------------------- Controllers --------------------
exports.setDayCode = [
  verifyToken,
  async (req, res) => {
    try {
      const { employeeId, date, code, reasonId = null, comment = "" } = req.body || {};
      if (!employeeId || !date || !code) {
        return res.status(400).json({ ok: false, error: "employeeId, date, and code are required." });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
        return res.status(400).json({ ok: false, error: "date must be YYYY-MM-DD" });
      }

      const id_emp = Number(employeeId);
      if (!Number.isFinite(id_emp)) {
        return res.status(400).json({ ok: false, error: "employeeId must be a number." });
      }

      const rowCode = await TSCode.findOne({ where: { code }, raw: true });
      if (!rowCode) return res.status(400).json({ ok: false, error: `Unknown code: ${code}` });

      const dTripoli = new Date(`${date}T00:00:00+02:00`);
      const year = dTripoli.getUTCFullYear();
      const month = dTripoli.getUTCMonth() + 1;
      const day = dTripoli.getUTCDate();

      const { start, end } = buildMonthRangeUTC(year, month);

      // avoid E/S read issues
      const excludeCols = [];
      for (let i = 1; i <= 31; i++) excludeCols.push(`E${i}`, `S${i}`);

      let ts = await Timesheet.findOne({
        where: {
          id_emp,
          [Op.and]: [where(cast(col("DATE_JS"), "datetimeoffset"), { [Op.gte]: start, [Op.lt]: end })],
        },
        attributes: { exclude: excludeCols },
      });

      if (!ts) ts = await Timesheet.create({ ...emptyMonthPayload(), id_emp, DATE_JS: start });

      await ts.update({
        [`j_${day}`]: code,
        [`R_${day}`]: reasonId ?? "",
        [`comm${day}`]: comment ?? "",
      });

      return res.json({ ok: true, message: `Set ${code} for ${date}`, day });
    } catch (e) {
      console.error("[setDayCode]", e);
      return res.status(500).json({ ok: false, error: "Failed to set day code" });
    }
  },
];

exports.saveMonthlyMissing = async (req, res) => {
  try {
    const { employeeId, year, month, missingMinutes } = req.body || {};
    if (!employeeId || !year || !month) {
      return res.status(400).json({ ok: false, message: "employeeId, year, month required" });
    }

    const id_emp = Number(employeeId);
    const YY = Number(year);
    const MM = Number(month);
    const miss = Math.max(0, Math.floor(Number(missingMinutes || 0)));

    const monthStartDate = new Date(Date.UTC(YY, MM - 1, 1, 0, 0, 0));
    const monthEndDate = new Date(Date.UTC(YY, MM, 1, 0, 0, 0));

    const ts = await Timesheet.findOne({
      where: {
        id_emp,
        [Op.and]: [where(cast(col("DATE_JS"), "datetimeoffset"), { [Op.gte]: monthStartDate, [Op.lt]: monthEndDate })],
      },
      attributes: ["id_tran"],
      raw: true,
    });

    if (ts?.id_tran) {
      await Timesheet.update({ nbr_h: miss }, { where: { id_tran: ts.id_tran } });
    } else {
      await Timesheet.create({
        id_emp,
        DATE_JS: monthStartDate,
        Comment: "",
        nbr_h: miss,
      });
    }

    return res.json({ ok: true, employeeId: id_emp, year: YY, month: MM, nbr_h: miss });
  } catch (e) {
    console.error("saveMonthlyMissing error:", e);
    return res.status(500).json({ ok: false, message: "Failed to save monthly missing" });
  }
};

exports.upsertTimesheet = [
  verifyToken,
  async (req, res) => {
    try {
      const { id_emp, DATE_JS } = req.body || {};
      if (!id_emp || !DATE_JS) return res.status(400).json({ message: "id_emp and DATE_JS are required" });

      const empIdNum = Number(id_emp);
      if (!Number.isFinite(empIdNum)) return res.status(400).json({ message: "id_emp must be a number" });

      const d = new Date(DATE_JS);
      if (isNaN(d.getTime())) return res.status(400).json({ message: "DATE_JS must be a valid date" });

      const { start, end } = buildMonthRangeUTC(d.getUTCFullYear(), d.getUTCMonth() + 1);

      const excludeCols = [];
      for (let i = 1; i <= 31; i++) excludeCols.push(`E${i}`, `S${i}`);

      let row = await Timesheet.findOne({
        where: {
          id_emp: empIdNum,
          [Op.and]: [where(cast(col("DATE_JS"), "datetimeoffset"), { [Op.gte]: start, [Op.lt]: end })],
        },
        attributes: { exclude: excludeCols },
      });

      if (row) {
        const updateBody = { ...req.body };
        delete updateBody.DATE_JS;
        await row.update(updateBody);
        return res.json({ message: "Timesheet saved", timesheet: row });
      }

      const created = await Timesheet.create({ ...emptyMonthPayload(), ...req.body, id_emp: empIdNum, DATE_JS: start });
      return res.json({ message: "Timesheet saved", timesheet: created });
    } catch (err) {
      console.error("upsertTimesheet error:", err);
      res.status(500).json({ message: "Error saving timesheet" });
    }
  },
];

exports.getTimesheet = [
  verifyToken,
  async (req, res) => {
    try {
      const employeeId = Number(req.query.employeeId);
      const year = Number(req.query.year);
      const month = Number(req.query.month); // 1..12
      let emp_code = req.query.emp_code ? String(req.query.emp_code) : null;

      if (!Number.isFinite(employeeId) || !Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        return res.status(400).json({
          ok: false,
          error: "Required query params: employeeId, year, month (1..12). Optional: emp_code.",
        });
      }

      const { start, end, daysInMonth } = buildMonthRangeUTC(year, month);

      // Employee drives schedule ONLY (T_START/T_END)
      let emp = null;
      try {
        emp = await Employee.findByPk(employeeId, {
          raw: true,
          attributes: ["ID_EMP", "ATTACHED_NUMBER", "PS", "T_START", "T_END"],
        });
      } catch (e) {
        console.warn("[getTimesheet] Employee lookup failed:", e?.message || e);
      }

      if (!emp_code && emp) emp_code = emp.ATTACHED_NUMBER ? String(emp.ATTACHED_NUMBER) : String(emp.ID_EMP);

      const schedStartMin = emp ? parseTimeToMinutes(emp.T_START) : null;
      const schedEndMin = emp ? parseTimeToMinutes(emp.T_END) : null;
      const expectedMinDefault =
        schedStartMin != null && schedEndMin != null && schedEndMin > schedStartMin ? schedEndMin - schedStartMin : null;

      // Holidays
      let holidays = [];
      try {
        const ymdStart = `${year}-${String(month).padStart(2, "0")}-01`;
        const ymdEnd = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
        holidays = await getExpandedHolidaysBetween(ymdStart, ymdEnd);
      } catch {}
      const holidaySet = new Set(
        (holidays || [])
          .map((h) => String(h.date ?? h.DATE_H ?? "").slice(0, 10))
          .filter((iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso))
      );

      // Baseline days
      const days = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const ymd = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        days.push({
          day: d,
          ymd,
          code: null,
          reason: null,
          comment: null,
          entry: null,
          exit: null,
          punches: [],
          workMin: null,
          expectedMin: expectedMinDefault,
          deltaMin: null,
          isHoliday: holidaySet.has(ymd),
          payFactor: 1,
          present: false,
        });
      }

      // Manual codes (j_/R_/comm*)
      const pickCols = ["nbr_h", "Comment"];
      for (let i = 1; i <= 31; i++) pickCols.push(`j_${i}`, `R_${i}`, `comm${i}`);

      let ts = null;
      try {
        ts = await Timesheet.findOne({
          where: {
            id_emp: employeeId,
            [Op.and]: [where(cast(col("DATE_JS"), "datetimeoffset"), { [Op.gte]: start, [Op.lt]: end })],
          },
          attributes: pickCols,
          raw: true,
        });
      } catch (e) {
        console.warn("[getTimesheet] Timesheet row read failed (non-fatal):", e?.message || e);
      }

      if (ts) {
        for (let d = 1; d <= daysInMonth; d++) {
          const code = ts[`j_${d}`] || null;
          const reason = ts[`R_${d}`] || null;
          const comment = ts[`comm${d}`] || null;
          if (code || reason || comment) {
            const o = days[d - 1];
            if (code) {
              o.code = String(code);
              o.present = /^(P|PH|PHF|W|PP)$/i.test(String(code));
              if (String(code) === "PH" || String(code) === "PHF") o.payFactor = 2;
            }
            if (reason) o.reason = String(reason);
            if (comment) o.comment = String(comment);
          }
        }
      }

      // FP punches
      if (emp_code) {
        const widenStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);
        const widenEnd = new Date(end.getTime() + 24 * 60 * 60 * 1000);

        const punches = await IClockTransaction.findAll({
          where: { emp_code, punch_time: { [Op.gte]: widenStart, [Op.lt]: widenEnd } },
          order: [["punch_time", "ASC"]],
          attributes: ["punch_time"],
        });

        const todayKey = tripoliYMD(new Date());
        const isDayOver = tripoliHourNow() >= 23;

        // group punches by Tripoli day number within this month
        const byDay = new Map(); // dayNum -> Date[]
        for (const p of punches) {
          const dt = new Date(p.punch_time);
          const dNum = dayInTripoli(dt);
          if (dNum >= 1 && dNum <= daysInMonth) {
            if (!byDay.has(dNum)) byDay.set(dNum, []);
            byDay.get(dNum).push(dt);
          }
        }

        for (const [dNum, arrRaw] of byDay.entries()) {
          const dayObj = days[dNum - 1];
          const arr = arrRaw.slice().sort((a, b) => a.getTime() - b.getTime());

          dayObj.punches = arr.map(toTripoliISO);

          // If manual code exists, don't auto-calc delta (manual override)
          if (dayObj.code) {
            if (arr.length > 0) dayObj.entry = toTripoliISO(arr[0]);
            if (arr.length > 0) dayObj.exit = toTripoliISO(arr[arr.length - 1]);
            continue;
          }

          if (arr.length > 0) dayObj.entry = toTripoliISO(arr[0]);
          if (arr.length > 0) dayObj.exit = toTripoliISO(arr[arr.length - 1]);
          dayObj.present = arr.length > 0;

          const isToday = dayObj.ymd === todayKey;

          if (isToday && !isDayOver) {
            dayObj.code = dayObj.present ? "P" : null;
            dayObj.workMin = null;
            dayObj.deltaMin = null;
            continue;
          }

          const worked = computeWorkedMinutesFromPunches(arr) ?? minutesBetween(arr[0], arr[arr.length - 1]);
          dayObj.workMin = worked;

          const expected = dayObj.expectedMin;
          let missing = 0;
          if (!dayObj.isHoliday && expected != null && expected > 0 && worked != null) {
            const gap = Math.max(0, expected - worked);
            missing = Math.max(0, gap - MISSING_TOLERANCE_MINUTES);
          }
          dayObj.deltaMin = missing > 0 ? -missing : null;

          if (dayObj.present) {
            if (dayObj.isHoliday) {
              dayObj.payFactor = 2;
              dayObj.code = expected != null && worked != null && worked >= expected ? "PHF" : "PH";
            } else if (missing > 0) {
              dayObj.code = "PP";
            } else {
              dayObj.code = "P";
            }
          } else {
            dayObj.code = "A";
          }
        }
      }

      return res.json({
        ok: true,
        meta: {
          employeeId,
          emp_code,
          year,
          month,
          daysInMonth,
          PS: emp && (emp.PS || emp.PS === 0) ? emp.PS : null,
          expectedMinDefault,
          nbr_h: ts?.nbr_h ?? 0,
          Comment: ts?.Comment ?? "",
          sourceOfExpected: "EMPLOYEE1.T_START/T_END",
        },
        data: days,
        raw: { tsRowId: null },
      });
    } catch (err) {
      console.error("getTimesheet error:", err);
      return res.status(500).json({ ok: false, error: "Error fetching timesheet" });
    }
  },
];
