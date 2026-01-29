// controllers/HR/holidayController.js
const Holiday = require('../../models/hr/Holiday');
// Simple civil Islamic calendar conversion utilities (approximate, good enough for HR planning)
// Source: algorithms adapted from "Calendrical Calculations" (civil tabular Islamic calendar)
function islamicToJulianDay(y, m, d) {
  return d + Math.ceil(29.5 * (m - 1)) + (y - 1) * 354 + Math.floor((3 + 11 * y) / 30) + 1948439.5 - 1;
}
function julianDayToGregorian(jd) {
  jd = Math.floor(jd + 0.5);
  let a = jd + 32044;
  let b = Math.floor((4 * a + 3) / 146097);
  let c = a - Math.floor(146097 * b / 4);
  let d = Math.floor((4 * c + 3) / 1461);
  let e = c - Math.floor(1461 * d / 4);
  let m = Math.floor((5 * e + 2) / 153);
  let day = e - Math.floor((153 * m + 2) / 5) + 1;
  let month = m + 3 - 12 * Math.floor(m / 10);
  let year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { year, month, day };
}
function gDateToISO(y, m, d) {
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}
function hijriToGregorianISO(y, m, d) {
  const jd = islamicToJulianDay(y, m, d);
  const g = julianDayToGregorian(jd);
  return gDateToISO(g.year, g.month, g.day);
}
function approximateHijriYearForGregorian(gy) {
  // Rough mapping: 1 AH started 622-07-16 CE. 33 solar ~ 34 lunar. Use ratio 32.58.
  return Math.floor((gy - 622) * 33 / 32) + 1;
}
async function ensureHolidayVariable(name, dateStr, comment = null) {
  // Prevent duplicates: check if exists
  const exists = await Holiday.findOne({ where: { DATE_H: dateStr } });
  if (exists) return exists;
  return Holiday.create({ HOLIDAY_NAME: name, HOLIDAY_TYPE: 'variable', DATE_H: dateStr, COMMENT_H: comment, IN_CALL: false });
}

// GET holidays (expanded: returns concrete dates for fixed holidays within optional range)
exports.getHolidays = [
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query; // optional 'YYYY-MM-DD'
      if (startDate && endDate) {
        const s = new Date(startDate);
        const e = new Date(endDate);
        const expanded = await Holiday.getHolidaysBetweenDates(s, e);

        // Compose in-memory computed holidays for the range (Libya fixed + Islamic set)
        const startYear = s.getFullYear();
        const endYear = e.getFullYear();
        const computed = [];

        // Libya fixed (by month/day every year)
        const FIXED = [
          { name: 'Revolution Day (Libya)', m: 2, d: 17 },
          { name: 'Labor Day', m: 5, d: 1 },
          { name: "Martyrs' Day (Libya)", m: 9, d: 16 },
          { name: 'Liberation Day (Libya)', m: 10, d: 23 },
          { name: 'Independence Day (Libya)', m: 12, d: 24 },
        ];
        for (let y = startYear; y <= endYear; y++) {
          for (const f of FIXED) {
            const dt = new Date(Date.UTC(y, f.m - 1, f.d));
            if (dt >= s && dt <= e) {
              computed.push({
                DATE_H: dt.toISOString().slice(0,10),
                HOLIDAY_NAME: f.name,
                HOLIDAY_TYPE: 'fixed',
                COMMENT_H: null,
                PTO: true,
                DOUBLE_PAY: true,
              });
            }
          }
        }

        // Islamic set (civil approximation) for relevant Hijri years overlapping [s,e]
        const addIfInRange = (name, iso) => {
          const d = new Date(iso);
          if (d >= s && d <= e) {
            computed.push({ DATE_H: iso, HOLIDAY_NAME: name, HOLIDAY_TYPE: 'variable', COMMENT_H: null, PTO: true, DOUBLE_PAY: true });
          }
        };
        for (let y = startYear - 1; y <= endYear + 1; y++) {
          const guess = approximateHijriYearForGregorian(y);
          const hijriYears = [guess - 1, guess, guess + 1];
          for (const hy of hijriYears) {
            // Islamic New Year (1 Muharram)
            let iso = hijriToGregorianISO(hy, 1, 1); addIfInRange('Islamic New Year (1 Muharram)', iso);
            // Ashura (10 Muharram)
            iso = hijriToGregorianISO(hy, 1, 10); addIfInRange('Ashura (10 Muharram)', iso);
            // Mawlid (12 Rabi\' al-awwal)
            iso = hijriToGregorianISO(hy, 3, 12); addIfInRange("Mawlid an-Nabi (12 Rabi' al-awwal)", iso);
            // Ramadan (1..30 of month 9)
            for (let d = 1; d <= 30; d++) {
              iso = hijriToGregorianISO(hy, 9, d); addIfInRange('Ramadan', iso);
            }
            // Eid al-Fitr (1 Shawwal) + 2
            iso = hijriToGregorianISO(hy, 10, 1);
            const ef = new Date(iso);
            for (let i = 0; i < 3; i++) addIfInRange('Eid al-Fitr', new Date(ef.getTime() + i*86400000).toISOString().slice(0,10));
            // Eid al-Adha (10 Dhu al-Hijjah) + 3
            iso = hijriToGregorianISO(hy, 12, 10);
            const ea = new Date(iso);
            for (let i = 0; i < 4; i++) addIfInRange('Eid al-Adha', new Date(ea.getTime() + i*86400000).toISOString().slice(0,10));
          }
        }

        // Merge DB expanded and computed, de-duplicate by DATE_H + name (name fallback to COMMENT_H)
        const map = new Map();
        const keyOf = (h) => `${h.DATE_H}|${h.HOLIDAY_NAME || h.COMMENT_H || ''}`;
        for (const h of [...expanded, ...computed]) {
          map.set(keyOf(h), {
            DATE_H: h.DATE_H,
            COMMENT_H: h.COMMENT_H ?? null,
            HOLIDAY_NAME: h.HOLIDAY_NAME ?? null,
            HOLIDAY_TYPE: h.HOLIDAY_TYPE ?? null,
            PTO: true,
            DOUBLE_PAY: true,
          });
        }
        const merged = Array.from(map.values()).sort((a,b)=> String(a.DATE_H).localeCompare(String(b.DATE_H)));
        return res.status(200).json(merged);
      }
      // No range provided: return raw DB rows (legacy behavior)
      const holidays = await Holiday.findAll({ order: [['DATE_H', 'ASC']] });
      res.status(200).json(holidays);
    } catch (err) {
      console.error('getHolidays error:', err);
      res.status(500).json({ message: 'Error fetching holidays' });
    }
  }
];

// Seed fixed Libyan holidays (recurring month/day); idempotent
exports.seedFixedLibya = [
  async (_req, res) => {
    try {
      const FIXED = [
        { name: 'Revolution Day (Libya)', m: 2, d: 17 },
        { name: 'Labor Day', m: 5, d: 1 },
        { name: "Martyrs' Day (Libya)", m: 9, d: 16 },
        { name: 'Independence Day (Libya)', m: 12, d: 24 },
      ];
      let created = 0;
      for (const f of FIXED) {
        const found = await Holiday.findOne({ where: { FIXED_MONTH: f.m, FIXED_DAY: f.d } });
        if (!found) {
          await Holiday.create({ HOLIDAY_NAME: f.name, HOLIDAY_TYPE: 'fixed', FIXED_MONTH: f.m, FIXED_DAY: f.d, IN_CALL: false });
          created++;
        }
      }
      res.json({ message: 'Fixed Libyan holidays ensured', created });
    } catch (err) {
      console.error('seedFixedLibya error:', err);
      res.status(500).json({ message: 'Error seeding fixed holidays' });
    }
  }
];

// Seed Islamic holidays for a Gregorian year (civil approximation); idempotent by date
exports.seedIslamicForYear = [
  async (req, res) => {
    try {
      const gy = Number(req.params.year);
      if (!gy || gy < 1900 || gy > 2100) return res.status(400).json({ message: 'Invalid year' });
      const guess = approximateHijriYearForGregorian(gy);
      const hijriYears = [guess - 1, guess, guess + 1];
      let created = 0;
      for (const hy of hijriYears) {
        // Islamic New Year (1 Muharram)
        let iso = hijriToGregorianISO(hy, 1, 1);
        if (iso.startsWith(String(gy))) { await ensureHolidayVariable('Islamic New Year (1 Muharram)', iso); created++; }
        // Ashura (10 Muharram)
        iso = hijriToGregorianISO(hy, 1, 10);
        if (iso.startsWith(String(gy))) { await ensureHolidayVariable('Ashura (10 Muharram)', iso); created++; }
        // Mawlid (12 Rabi' al-awwal)
        iso = hijriToGregorianISO(hy, 3, 12);
        if (iso.startsWith(String(gy))) { await ensureHolidayVariable("Mawlid an-Nabi (12 Rabi' al-awwal)", iso); created++; }
        // Ramadan (month 9) — civil calendar assumes 30 days
        for (let d = 1; d <= 30; d++) {
          iso = hijriToGregorianISO(hy, 9, d);
          if (iso.startsWith(String(gy))) { await ensureHolidayVariable('Ramadan', iso); created++; }
        }
        // Eid al-Fitr (1 Shawwal) + 2 days
        iso = hijriToGregorianISO(hy, 10, 1);
        if (iso.startsWith(String(gy))) {
          const d = new Date(iso);
          for (let i = 0; i < 3; i++) {
            const dayIso = new Date(d.getTime() + i * 86400000).toISOString().slice(0, 10);
            await ensureHolidayVariable('Eid al-Fitr', dayIso);
            created++;
          }
        }
        // Eid al-Adha (10 Dhu al-Hijjah) + 3 days
        iso = hijriToGregorianISO(hy, 12, 10);
        if (iso.startsWith(String(gy))) {
          const d = new Date(iso);
          for (let i = 0; i < 4; i++) {
            const dayIso = new Date(d.getTime() + i * 86400000).toISOString().slice(0, 10);
            await ensureHolidayVariable('Eid al-Adha', dayIso);
            created++;
          }
        }
      }
      res.json({ message: `Islamic holidays ensured for ${gy}`, created });
    } catch (err) {
      console.error('seedIslamicForYear error:', err);
      res.status(500).json({ message: 'Error seeding Islamic holidays' });
    }
  }
];

// CREATE holiday (legacy schema: DATE_H, COMMENT_H, IN_CALL)
exports.createHoliday = [
  async (req, res) => {
    try {
      const date = req.body.DATE_H || req.body.holiday_date || req.body.date;
      const comment = (typeof req.body.COMMENT_H !== 'undefined' ? req.body.COMMENT_H : req.body.comment) ?? null;
      const inCall = typeof req.body.IN_CALL !== 'undefined' ? !!req.body.IN_CALL : (typeof req.body.in_call !== 'undefined' ? !!req.body.in_call : false);

      if (!date) return res.status(400).json({ message: "'DATE_H' (or 'holiday_date') is required" });

      const holiday = await Holiday.create({ DATE_H: date, COMMENT_H: comment, IN_CALL: inCall });
      return res.status(201).json({ message: 'Holiday created successfully', holiday });
    } catch (err) {
      console.error('createHoliday error:', err);
      res.status(500).json({ message: 'Error creating holiday' });
    }
  }
];

// UPDATE holiday (legacy schema)
exports.updateHoliday = [
  async (req, res) => {
    try {
      const { id } = req.params;
      const row = await Holiday.findByPk(id);
      if (!row) return res.status(404).json({ message: 'Holiday not found' });

      const updates = {};
      if (typeof req.body.DATE_H !== 'undefined' || typeof req.body.holiday_date !== 'undefined' || typeof req.body.date !== 'undefined') {
        updates.DATE_H = req.body.DATE_H || req.body.holiday_date || req.body.date;
      }
      if (typeof req.body.COMMENT_H !== 'undefined' || typeof req.body.comment !== 'undefined') {
        updates.COMMENT_H = typeof req.body.COMMENT_H !== 'undefined' ? req.body.COMMENT_H : req.body.comment;
      }
      if (typeof req.body.IN_CALL !== 'undefined' || typeof req.body.in_call !== 'undefined') {
        updates.IN_CALL = typeof req.body.IN_CALL !== 'undefined' ? !!req.body.IN_CALL : !!req.body.in_call;
      }

      await row.update(updates);
      res.json({ message: 'Holiday updated', holiday: row });
    } catch (err) {
      console.error('updateHoliday error:', err);
      res.status(500).json({ message: 'Error updating holiday' });
    }
  }
];

// DELETE holiday
exports.deleteHoliday = [
  async (req, res) => {
    try {
      const { id } = req.params;
      const row = await Holiday.findByPk(id);
      if (!row) return res.status(404).json({ message: 'Holiday not found' });
      await row.destroy();
      res.json({ message: 'Holiday deleted' });
    } catch (err) {
      console.error('deleteHoliday error:', err);
      res.status(500).json({ message: 'Error deleting holiday' });
    }
  }
];
