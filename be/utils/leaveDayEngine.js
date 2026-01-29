const Holiday = require('../models/hr/Holiday');

const pad2 = (n) => String(n).padStart(2, '0');

const ymdUTC = (date) => {
  const y = date.getUTCFullYear();
  const m = pad2(date.getUTCMonth() + 1);
  const d = pad2(date.getUTCDate());
  return `${y}-${m}-${d}`;
};

const parseYMDToUTCDate = (ymd) => {
  const s = String(ymd || '').slice(0, 10);
  const [y, m, d] = s.split('-').map((x) => Number(x));
  if (!y || !m || !d) return new Date(NaN);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
};

function islamicToJulianDay(y, m, d) {
  return (
    d +
    Math.ceil(29.5 * (m - 1)) +
    (y - 1) * 354 +
    Math.floor((3 + 11 * y) / 30) +
    1948439.5 -
    1
  );
}

function julianDayToGregorian(jd) {
  jd = Math.floor(jd + 0.5);
  let a = jd + 32044;
  let b = Math.floor((4 * a + 3) / 146097);
  let c = a - Math.floor((146097 * b) / 4);
  let d = Math.floor((4 * c + 3) / 1461);
  let e = c - Math.floor((1461 * d) / 4);
  let m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { year, month, day };
}

function gDateToISO(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function hijriToGregorianISO(y, m, d) {
  const jd = islamicToJulianDay(y, m, d);
  const g = julianDayToGregorian(jd);
  return gDateToISO(g.year, g.month, g.day);
}

function approximateHijriYearForGregorian(gy) {
  return Math.floor(((gy - 622) * 33) / 32) + 1;
}

const mergeHolidayName = (existing, incoming) => {
  const a = String(existing || '').trim();
  const b = String(incoming || '').trim();
  if (a && b) return a;
  return a || b;
};

const buildHolidayNameByDate = (holidays) => {
  const nameByDate = new Map();
  for (const h of holidays || []) {
    const iso = String(h.date || '').slice(0, 10);
    if (!iso) continue;
    nameByDate.set(iso, mergeHolidayName(nameByDate.get(iso), h.name));
  }
  return nameByDate;
};

const computeEffectiveBreakdownWithHolidayNameByDate = (start, end, holidayNameByDate) => {
  const sISO = String(start instanceof Date ? ymdUTC(start) : start).slice(0, 10);
  const eISO = String(end instanceof Date ? ymdUTC(end) : end).slice(0, 10);
  const sDate = parseYMDToUTCDate(sISO);
  const eDate = parseYMDToUTCDate(eISO);

  if (isNaN(sDate.getTime()) || isNaN(eDate.getTime()) || eISO < sISO) {
    return {
      effectiveDays: 0,
      excluded: { fridays: [], holidays: [] },
      holidayCount: 0,
    };
  }

  const excludedFridays = [];
  const excludedHolidays = [];
  let eff = 0;

  let d = new Date(sDate);
  while (d.getTime() <= eDate.getTime()) {
    const iso = ymdUTC(d);
    const isFri = d.getUTCDay() === 5;
    const isHol = !!holidayNameByDate && holidayNameByDate.has(iso);
    if (isFri) excludedFridays.push(iso);
    else if (isHol) excludedHolidays.push({ date: iso, name: holidayNameByDate.get(iso) || null });
    else eff += 1;
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return {
    effectiveDays: eff,
    excluded: { fridays: excludedFridays, holidays: excludedHolidays },
    holidayCount: excludedHolidays.length,
  };
};

const getExpandedHolidaysBetween = async (startISO, endISO) => {
  const s = String(startISO || '').slice(0, 10);
  const e = String(endISO || '').slice(0, 10);
  const sDate = parseYMDToUTCDate(s);
  const eDate = parseYMDToUTCDate(e);
  if (isNaN(sDate.getTime()) || isNaN(eDate.getTime()) || e < s) {
    return [];
  }

  const db = await Holiday.getHolidaysBetweenDates(s, e);

  const computed = [];
  const startYear = Number(s.slice(0, 4));
  const endYear = Number(e.slice(0, 4));

  const FIXED = [
    { name: 'Revolution Day (Libya)', m: 2, d: 17 },
    { name: 'Labor Day', m: 5, d: 1 },
    { name: "Martyrs' Day (Libya)", m: 9, d: 16 },
    { name: 'Liberation Day (Libya)', m: 10, d: 23 },
    { name: 'Independence Day (Libya)', m: 12, d: 24 },
  ];

  for (let y = startYear; y <= endYear; y++) {
    for (const f of FIXED) {
      const iso = gDateToISO(y, f.m, f.d);
      if (iso >= s && iso <= e) {
        computed.push({ DATE_H: iso, HOLIDAY_NAME: f.name, HOLIDAY_TYPE: 'fixed' });
      }
    }
  }

  const addIfInRange = (name, iso) => {
    if (iso >= s && iso <= e) {
      computed.push({ DATE_H: iso, HOLIDAY_NAME: name, HOLIDAY_TYPE: 'variable' });
    }
  };

  for (let y = startYear - 1; y <= endYear + 1; y++) {
    const guess = approximateHijriYearForGregorian(y);
    const hijriYears = [guess - 1, guess, guess + 1];
    for (const hy of hijriYears) {
      let iso = hijriToGregorianISO(hy, 1, 1);
      addIfInRange('Islamic New Year (1 Muharram)', iso);
      iso = hijriToGregorianISO(hy, 1, 10);
      addIfInRange('Ashura (10 Muharram)', iso);
      iso = hijriToGregorianISO(hy, 3, 12);
      addIfInRange("Mawlid an-Nabi (12 Rabi' al-awwal)", iso);

      for (let d = 1; d <= 30; d++) {
        iso = hijriToGregorianISO(hy, 9, d);
        addIfInRange('Ramadan', iso);
      }

      iso = hijriToGregorianISO(hy, 10, 1);
      const ef = parseYMDToUTCDate(iso);
      if (!isNaN(ef.getTime())) {
        for (let i = 0; i < 3; i++) {
          addIfInRange('Eid al-Fitr', ymdUTC(new Date(ef.getTime() + i * 86400000)));
        }
      }

      iso = hijriToGregorianISO(hy, 12, 10);
      const ea = parseYMDToUTCDate(iso);
      if (!isNaN(ea.getTime())) {
        for (let i = 0; i < 4; i++) {
          addIfInRange('Eid al-Adha', ymdUTC(new Date(ea.getTime() + i * 86400000)));
        }
      }
    }
  }

  const map = new Map();
  const iso10 = (v) => {
    if (!v) return '';
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return s.slice(0, 10);
  };
  const keyOf = (h) => `${iso10(h.DATE_H)}|${h.HOLIDAY_NAME || h.COMMENT_H || ''}`;

  for (const h of [...db, ...computed]) {
    const iso = iso10(h.DATE_H);
    if (!iso) continue;
    const name = String(h.HOLIDAY_NAME || h.COMMENT_H || '').trim() || null;
    map.set(keyOf(h), {
      date: iso,
      name,
      type: h.HOLIDAY_TYPE || null,
      in_call: typeof h.IN_CALL !== 'undefined' ? !!h.IN_CALL : null,
    });
  }

  return Array.from(map.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
};

const countWorkingDaysExcludingFridaysAndHolidays = async (start, end) => {
  const sISO = String(start instanceof Date ? ymdUTC(start) : start).slice(0, 10);
  const eISO = String(end instanceof Date ? ymdUTC(end) : end).slice(0, 10);
  const sDate = parseYMDToUTCDate(sISO);
  const eDate = parseYMDToUTCDate(eISO);
  if (isNaN(sDate.getTime()) || isNaN(eDate.getTime()) || eISO < sISO) {
    return {
      effectiveDays: 0,
      excluded: { fridays: [], holidays: [] },
      holidayCount: 0,
      holidays: [],
      holidayNameByDate: new Map(),
    };
  }

  const holidays = await getExpandedHolidaysBetween(sISO, eISO);
  const holidayNameByDate = buildHolidayNameByDate(holidays);

  const breakdown = computeEffectiveBreakdownWithHolidayNameByDate(sISO, eISO, holidayNameByDate);

  return {
    ...breakdown,
    holidays,
    holidayNameByDate,
  };
};

const countWorkingDaysByMonthExcludingFridaysAndHolidays = async (start, end) => {
  const sISO = String(start instanceof Date ? ymdUTC(start) : start).slice(0, 10);
  const eISO = String(end instanceof Date ? ymdUTC(end) : end).slice(0, 10);
  const sDate = parseYMDToUTCDate(sISO);
  const eDate = parseYMDToUTCDate(eISO);
  const map = new Map();
  if (isNaN(sDate.getTime()) || isNaN(eDate.getTime()) || eISO < sISO) return map;

  const holidays = await getExpandedHolidaysBetween(sISO, eISO);
  const holidayNameByDate = buildHolidayNameByDate(holidays);

  let d = new Date(sDate);
  while (d.getTime() <= eDate.getTime()) {
    const iso = ymdUTC(d);
    const isFri = d.getUTCDay() === 5;
    const isHol = holidayNameByDate.has(iso);
    if (!isFri && !isHol) {
      const ym = iso.slice(0, 7);
      map.set(ym, (map.get(ym) || 0) + 1);
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return map;
};

module.exports = {
  getExpandedHolidaysBetween,
  countWorkingDaysExcludingFridaysAndHolidays,
  countWorkingDaysByMonthExcludingFridaysAndHolidays,
  buildHolidayNameByDate,
  computeEffectiveBreakdownWithHolidayNameByDate,
  parseYMDToUTCDate,
  ymdUTC,
};
