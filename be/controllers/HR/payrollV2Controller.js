const { Op, where, literal, fn, col, cast } = require('sequelize');
const moment = require('moment');
const Employee = require('../../models/hr/employee1');
const IClockTransaction = require('../../models/hr/IClockTransaction');
const Holiday = require('../../models/hr/Holiday');
const Vacation = require('../../models/hr/Vacation');
const TSCode = require('../../models/hr/TSCode');
const Timesheet = require('../../models/hr/Timesheet');
const { getExpandedHolidaysBetween } = require('../../utils/leaveDayEngine');
const GLTran = require('../../models/Finance/GLTran');
const PayrollSalary = require('../../models/hr/PayrollSalary');
const PayrollArchivedSalary = require('../../models/hr/PayrollArchivedSalary');
const PayrollLoan = require('../../models/hr/PayrollLoan');
const fs = require('fs');
const path = require('path');

// =====================
// FIXED PAYROLL RULES
// =====================
const FIXED_MONTH_DAYS = 30;
const FIXED_DAY_MINUTES = 8 * 60; // 480
const MISSING_TOLERANCE_MINUTES = 30;

const TZ = 'Africa/Tripoli';

function ymdTripoli(d){
  try {
    const dt = (d instanceof Date) ? d : new Date(d);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(dt);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const da = parts.find(p => p.type === 'day')?.value;
    if (!y || !m || !da) return moment(dt).format('YYYY-MM-DD');
    return `${y}-${m}-${da}`;
  } catch {
    return moment(d).format('YYYY-MM-DD');
  }
}

function tripoliHourNow(){
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ,
      hour: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const hh = parts.find(p => p.type === 'hour')?.value;
    const n = Number(hh);
    return Number.isFinite(n) ? n : new Date().getHours();
  } catch {
    return new Date().getHours();
  }
}

// =====================
// HELPERS
// =====================
function dim(y, m) { return new Date(y, m, 0).getDate(); }
function ymd(d) { return moment(d).format('YYYY-MM-DD'); }
function fri(ymdStr){ return moment(ymdStr,'YYYY-MM-DD').isoWeekday()===5; }
function toN(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
function normalizeCode(s){ return String(s||'').trim().toUpperCase(); }

function parseTimeToMinutes(t) {
  if (!t || typeof t !== 'string') return null;
  const parts = t.split(':');
  const hh = parseInt(parts[0] || '0', 10) || 0;
  const mm = parseInt(parts[1] || '0', 10) || 0;
  const ss = parseInt(parts[2] || '0', 10) || 0;
  return hh * 60 + mm + Math.floor(ss / 60);
}

function readPsSchedule(){
  try {
    const p = path.resolve(__dirname, '../../config/psSchedule.json');
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, 'utf8')) || {};
  } catch { return {}; }
}

function minutesBetween(a,b){
  if(!a || !b) return 0;
  const ms = b.getTime() - a.getTime();
  if(!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms/60000);
}

function minutesTripoli(d){
  try {
    const dt = (d instanceof Date) ? d : new Date(d);
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(dt);
    const hh = Number(parts.find(p => p.type === 'hour')?.value);
    const mm = Number(parts.find(p => p.type === 'minute')?.value);
    if (Number.isFinite(hh) && Number.isFinite(mm)) {
      return hh * 60 + mm;
    }
  } catch {}
  const m = moment(d);
  if (m.isValid()) return m.hours() * 60 + m.minutes();
  return null;
}

/**
 * Sum worked minutes by pairing punches:
 * arr = [t1, t2, t3, t4 ...]
 * pairs: (t1,t2) + (t3,t4) ...
 * if odd count -> last punch ignored => day becomes PP by rule
 */
function sumWorkedMinutesByPairs(arr){
  if(!Array.isArray(arr) || arr.length < 2) return 0;
  let total = 0;
  for(let i=0; i+1 < arr.length; i+=2){
    total += minutesBetween(arr[i], arr[i+1]);
  }
  return total;
}

/**
 * Calculate timesheet exception codes based on punch data and schedule
 * Returns: { code, flags: [], missingMin }
 * 
 * Exception codes:
 * - NI: No In (has exit but no entry)
 * - NO: No Out (has entry but no exit)
 * - MO: Missing final Out (early exit, no final checkout)
 * - IP: Incomplete Presence (worked less than expected)
 * - LI: Late In (flag - arrived after schedule start + tolerance)
 * - EO: Early Out (flag - left before schedule end - tolerance)
 * - P: Present (normal attendance)
 */
function calculateExceptionCode(punches, schedStartMin, schedEndMin, expectedMin, isToday, isDayOver){
  const tolMin = 5; // tolerance for timing flags (late in/out)
  const flags = [];
  let code = '';
  let missingMin = 0;
  
  // No schedule = can't compute timing exceptions
  const hasSchedule = schedStartMin != null && schedEndMin != null && expectedMin != null;
  
  // No punches = not an exception, just absent
  if(!punches || punches.length === 0){
    return { code: '', flags: [], missingMin: 0 };
  }
  
  const entry = punches[0];
  const exit = punches.length > 0 ? punches[punches.length - 1] : null;
  
  // Calculate entry/exit times in minutes
  let entryMin = null;
  let exitMin = null;
  
  if(entry){
    entryMin = minutesTripoli(entry);
  }
  if(exit){
    exitMin = minutesTripoli(exit);
  }
  
  // Missing punch structure codes (highest priority)
  const hasEntry = entry != null;
  const hasExit = exit != null && punches.length >= 2; // Need at least 2 punches for valid exit
  
  // NI: No In - has exit punch but no entry punch
  if(!hasEntry && hasExit){
    code = 'NI';
    return { code, flags, missingMin: 0 };
  }
  
  // NO: No Out - has entry punch but no exit punch
  if(hasEntry && !hasExit){
    code = 'NO';
    return { code, flags, missingMin: 0 };
  }
  
  // From here, we have both entry and exit
  if(hasEntry && hasExit && hasSchedule){
    const isLateIn = entryMin > schedStartMin + tolMin;
    const isEarlyOut = exitMin < schedEndMin - tolMin && !isToday;
    
    // Calculate worked minutes
    const workedMin = sumWorkedMinutesByPairs(punches);
    missingMin = Math.max(0, expectedMin - workedMin);
    if (missingMin && missingMin <= MISSING_TOLERANCE_MINUTES) missingMin = 0;
    
    // Add flags for tracking
    if(isLateIn) flags.push('LI');
    if(isEarlyOut) flags.push('EO');
    
    // Determine primary code based on timing issues
    // Priority: LI (Late In) > EO (Early Out) > IP (Incomplete) > P (Present)
    if(isLateIn && !isEarlyOut){
      code = 'LI'; // Late In only
    } else if(!isLateIn && isEarlyOut){
      code = 'EO'; // Early Out only
    } else if(isLateIn && isEarlyOut){
      // Both late in and early out - use IP (Incomplete Presence)
      code = 'IP';
    } else if(workedMin < expectedMin - tolMin){
      // Worked less than expected but on time - Incomplete Presence
      code = 'IP';
    } else {
      // Normal presence
      code = 'P';
    }
  } else if(hasEntry && hasExit){
    // No schedule to compare against - just mark as present
    code = 'P';
  }
  
  return { code, flags, missingMin };
}

async function holSet(y,m){
  try{
    const start=`${y}-${String(m).padStart(2,'0')}-01`;
    const end=`${y}-${String(m).padStart(2,'0')}-${String(dim(y,m)).padStart(2,'0')}`;
    const rows = await getExpandedHolidaysBetween(start, end);
    return new Set((rows || []).map(r => ymd(r.date || r.DATE_H)));
  }catch{
    return new Set();
  }
}

// =====================
// ATTENDANCE ENGINE
// =====================
async function attendance(emp,{year,month,holidaySet}){
  const realDim = dim(year, month);                 // calendar days
  const keyMonth = `${year}-${String(month).padStart(2,'0')}`;
  const todayKey = ymdTripoli(new Date());
  const isDayOver = tripoliHourNow() >= 23;

  const psSched = readPsSchedule();
  let schedStartMin = null;
  let schedEndMin = null;
  try {
    const psKey = (emp.PS || emp.PS === 0) ? `P${emp.PS}` : null;
    if (psKey && psSched[psKey] && psSched[psKey].start && psSched[psKey].end) {
      const s = parseTimeToMinutes(psSched[psKey].start);
      const e = parseTimeToMinutes(psSched[psKey].end);
      if (s != null && e != null && e > s) { schedStartMin = s; schedEndMin = e; }
    }
    if (schedStartMin == null || schedEndMin == null) {
      const s = parseTimeToMinutes(emp.T_START);
      const e = parseTimeToMinutes(emp.T_END);
      if (s != null && e != null && e > s) { schedStartMin = s; schedEndMin = e; }
    }
  } catch {}

  // Widen punch query window (real calendar month)
  const widenStart = moment.utc({year,month:month-1,day:1}).subtract(1,'day').toDate();
  const widenEnd   = moment.utc({year,month:month-1,day:realDim}).add(1,'day').toDate();

  // ---- Load punches for employee and group by dayKey
  let punches = [];
  try{
    punches = await IClockTransaction.findAll({
      where:{
        emp_code: String(emp.ATTACHED_NUMBER||emp.ID_EMP),
        punch_time:{ [Op.between]: [widenStart,widenEnd] }
      },
      attributes:['punch_time'],
      raw:true,
      order:[['punch_time','ASC']]
    });
  }catch{
    punches = [];
  }

  const byDate = new Map();
  for(const p of punches){
    const dayKey = ymdTripoli(p.punch_time);
    if(dayKey.slice(0,7) !== keyMonth) continue;
    if(!byDate.has(dayKey)) byDate.set(dayKey, []);
    byDate.get(dayKey).push(new Date(p.punch_time));
  }

  // ---- Vacation codes overlap (use REAL month end for overlap query)
  const mStart = `${year}-${String(month).padStart(2,'0')}-01`;
  const mEnd   = `${year}-${String(month).padStart(2,'0')}-${String(realDim).padStart(2,'0')}`;

  let vac = [];
  let codeMap = new Map();
  const empIdNum = Number(emp.ID_EMP);
  try{
    // Get ALL vacation records for this employee in this month
    // Use raw SQL to avoid type conversion issues
    const allVac = await Vacation.findAll({
      where:{
        [Op.or]: [
          { id_emp: empIdNum },
          { id_emp: String(empIdNum) }
        ],
        [Op.and]:[
          where(literal('CONVERT(date, date_depart, 23)'),{[Op.lte]:mEnd}),
          where(literal('CONVERT(date, date_end, 23)'),{[Op.gte]:mStart})
        ]
      },
      attributes:['int_con','id_can','date_depart','date_end','state','nbr_jour'],
      raw:true
    });

    // Filter for approved status (case-insensitive)
    vac = allVac.filter(v => {
      const state = String(v.state || '').toLowerCase();
      return state.includes('approved') || state.includes('موافق') || state.includes('accepted');
    });

    const ids=[...new Set((vac||[]).map(v=>v.id_can).filter(Boolean))];
    if(ids.length){
      const codeRows = await TSCode.findAll({
        where:{ int_can: ids },
        attributes:['int_can','code','desig_can'],
        raw:true
      });
      codeMap = new Map((codeRows||[]).map(r=>[String(r.int_can), normalizeCode(r.code)]));
    }
  }catch(err){
    vac=[]; codeMap=new Map();
  }

  const codeOnVacation=(dayKey)=>{
    // FRIDAY RULE: Fridays don't count as leave days EXCEPT for sick leave (SL)
    const isFridayDay = fri(dayKey);
    const isHolidayDay = holidaySet.has(dayKey);
    
    for(const v of (vac||[])){
      const s=ymd(v.date_depart), e=ymd(v.date_end);
      if(dayKey>=s && dayKey<=e) {
        // Try to get leave code from codeMap, fallback to 'AL' if not found
        let leaveCode = normalizeCode(codeMap.get(String(v.id_can))||'');
        if(!leaveCode) leaveCode = 'AL'; // Default to AL if code not found in TSCode

        // Skip non-sick leave on PUBLIC HOLIDAYS - holiday is not a leave day
        // Return '' so holiday logic handles it (PH if worked, otherwise ignored)
        if(isHolidayDay && leaveCode !== 'SL') {
          return '';
        }
        
        // Skip non-sick leave on Fridays - Friday is a day off, not a leave day
        // Return 'F' to indicate Friday within leave period (won't be counted as absence)
        if(isFridayDay && leaveCode !== 'SL') {
          return 'F'; // Friday within leave period - not absence, not working day
        }
        return leaveCode;
      }
    }
    return '';
  };

  // ---- Manual Timesheet codes (j_*)
  let tsCodes = null;
  try{
    const start = new Date(Date.UTC(year, month-1, 1, 0, 0, 0));
    const end   = new Date(Date.UTC(year, month,   1, 0, 0, 0));
    const pickCols = Array.from({length:31},(_,i)=>`j_${i+1}`);
    tsCodes = await Timesheet.findOne({
      where:{
        id_emp: emp.ID_EMP,
        [Op.and]:[ where(cast(col('DATE_JS'),'datetimeoffset'),{ [Op.gte]: start, [Op.lt]: end }) ]
      },
      attributes: pickCols,
      raw:true
    });
    
    // Debug: log if we found codes
    if(tsCodes){
      const nonEmptyCodes = Object.entries(tsCodes).filter(([k,v]) => k.startsWith('j_') && v).length;
      if(nonEmptyCodes > 0){
        console.log(`[payrollV2] Found ${nonEmptyCodes} manual codes for emp ${emp.ID_EMP}, ${year}-${month}`);
      }
    } else {
      console.log(`[payrollV2] No Timesheet row found for emp ${emp.ID_EMP}, ${year}-${month}`);
    }
  }catch(e){
    console.error(`[payrollV2] Failed to load Timesheet codes for emp ${emp.ID_EMP}:`, e?.message || e);
    tsCodes=null;
  }

  const manualCodeForDay = (day) => {
    if(!tsCodes) return '';
    return normalizeCode(tsCodes[`j_${day}`] || '');
  };

  // ---- Determine month non-working set using REAL calendar days (Fridays + holidays)
  // Unique days so holiday-on-Friday only counts once
  const nonWorkingSet = new Set();
  for(let day=1; day<=realDim; day++){
    const dayKey = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    if(fri(dayKey) || holidaySet.has(dayKey)) nonWorkingSet.add(dayKey);
  }

  const workingDays = Math.max(0, FIXED_MONTH_DAYS - nonWorkingSet.size);

  // ---- Counters
  let absenceDays = 0;
  let missingMinutes = 0;
  let holidayWorked = 0;

  // food paid days (present on working days)
  let presentWorkingDays = 0;

  // analytics counters
  let pDays=0, ppDays=0, phDays=0, phfDays=0;
  
  // exception code counters
  let niDays=0, noDays=0, moDays=0, ipDays=0;
  let liCount=0, eoCount=0; // timing flags
  let totalExceptionMissingMin=0;

  // Debug tracking
  const debugDays = [];

  const isPresentCode = (code) => {
    const c = normalizeCode(code);
    // Present codes include normal presence and exception codes (incomplete but present)
    return c === 'P' || c === 'PP' || c === 'PL' || c === 'PT' || 
           c === 'NI' || c === 'NO' || c === 'MO' || c === 'IP' || c === 'LI' || c === 'EO';
  };
  
  const isExceptionCode = (code) => {
    const c = normalizeCode(code);
    return c === 'NI' || c === 'NO' || c === 'MO' || c === 'IP' || c === 'LI' || c === 'EO';
  };

  // Loop ONLY real calendar days for dayKey correctness (no Feb 30)
  for(let day=1; day<=realDim; day++){
    const dayKey = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const hol = holidaySet.has(dayKey);
    const isF = fri(dayKey);
    const isWorkingDay = (!hol && !isF);
    const isToday = (dayKey === todayKey);
    const isFuture = (dayKey > todayKey);

    const arr = byDate.get(dayKey) || [];
    const hasPunches = arr.length > 0;

    // 1) manual override
    const manual = manualCodeForDay(day);
    // 2) vacation override
    const vacCode = codeOnVacation(dayKey);

    let code = manual || vacCode;

    // 3) derive from punches if no manual/vacation code
    let exceptionFlags = [];
    let exceptionMissingMin = 0;
    
    if(!code){
      // Future days: skip - don't count as absent until the day has passed
      if(isFuture){
        code = ''; // No code for future days - they haven't happened yet
      }
      // Non-working days (Friday/holiday) without punches: skip (no code needed)
      else if(!isWorkingDay && !hasPunches){
        code = ''; // No code for non-working days without activity
      }
      // Working days without punches: mark as absent
      else if(!hasPunches){
        code = 'A';
      }
      // Has punches: use exception code system
      else if(hasPunches){
        const expectedMin = schedStartMin != null && schedEndMin != null ? schedEndMin - schedStartMin : FIXED_DAY_MINUTES;
        const exception = calculateExceptionCode(arr, schedStartMin, schedEndMin, expectedMin, isToday, isDayOver);
        code = exception.code;
        exceptionFlags = exception.flags;
        exceptionMissingMin = exception.missingMin;
        
        // If no exception code was set but has punches, default to P
        if(!code) code = 'P';
      }

      // holiday worked tagging (if punches on holiday)
      if(hol && hasPunches) code = 'PH';
    }

    // *** CRITICAL FIX: Skip today if day isn't over (for deductions only) ***
    // Still count the code for analytics, but don't apply deductions/penalties
    const skipDeductions = (isToday && !isDayOver);
    
    if(skipDeductions){
      // Count present codes for analytics but don't penalize
      if(code === 'P') pDays += 1;
      else if(code === 'PP') ppDays += 1;
      else if(code === 'PH') phDays += 1;
      else if(code === 'PHF') phfDays += 1;
      continue; // Skip all deductions/calculations for incomplete today
    }

    // food paid days: present on working day
    if(isWorkingDay && isPresentCode(code)){
      presentWorkingDays += 1;
    }

    // *** CRITICAL FIX: Absence counting logic ***
    // Exception codes (NI, NO, MO, IP) = incomplete presence, NOT absence
    // Only count 'A' (Absent) code on WORKING DAYS ONLY
    const normalizedCode = normalizeCode(code);
    const isManualOrVacation = !!(manual || vacCode);
    
    // Don't count exception codes as absence - they're present but incomplete
    // Don't count absences on non-working days (Fridays/holidays) - even if manually marked
    // ONLY COUNT 'A' CODED DAYS AS ABSENCE
    if(!isExceptionCode(code) && isWorkingDay){
      if(normalizedCode === 'A') {
        absenceDays += 1;
      }
      // UL and HL are leave types, not absences - they're already deducted from leave balance
    }

    // Debug tracking
    const manualCode = manualCodeForDay(day);
    const vacationCode = codeOnVacation(dayKey);
    debugDays.push({
      day,
      dayKey,
      isWorkingDay,
      isF,
      hol,
      isFuture,
      isToday,
      skipDeductions,
      hasPunches,
      manual: manualCode,
      vacCode: vacationCode,
      finalCode: code,
      normalizedCode,
      isManualOrVacation,
      isException: isExceptionCode(code),
      exceptionFlags,
      exceptionMissingMin,
      counted: !isExceptionCode(code) && (normalizedCode === 'A' && isWorkingDay)
    });

    if(isWorkingDay && hasPunches && schedStartMin != null && schedEndMin != null){
      try {
        const entry = arr[0] || null;
        const exit = arr.length ? arr[arr.length - 1] : null;
        if(entry && exit){
          const entryMin = minutesTripoli(entry);
          const exitMin = minutesTripoli(exit);
          const tol = 5;
          const lateMin = Math.max(0, entryMin - schedStartMin);
          const earlyLeaveMin = Math.max(0, schedEndMin - exitMin);
          const onTime = lateMin <= tol;
          const miss = onTime && earlyLeaveMin > tol ? earlyLeaveMin : 0;
          if(miss > 0){
            const effectiveMiss = miss > MISSING_TOLERANCE_MINUTES ? miss : 0;
            if(effectiveMiss > 0) missingMinutes += effectiveMiss;
          }
        }
      } catch {}
    }
    // Note: Positive deltas (overtime) are completely ignored

    // holiday worked counter (calendar holiday + punches)
    if(hol && hasPunches) holidayWorked += 1;

    // analytics
    if(code === 'P') pDays += 1;
    else if(code === 'PP') ppDays += 1;
    else if(code === 'PH') phDays += 1;
    else if(code === 'PHF') phfDays += 1;
    
    // exception code analytics
    if(code === 'NI') niDays += 1;
    else if(code === 'NO') noDays += 1;
    else if(code === 'MO') moDays += 1;
    else if(code === 'IP') ipDays += 1;
    else if(code === 'LI') liCount += 1;
    else if(code === 'EO') eoCount += 1;
    
    // Also count LI/EO from flags (for backward compatibility)
    if(code !== 'LI' && exceptionFlags.includes('LI')) liCount += 1;
    if(code !== 'EO' && exceptionFlags.includes('EO')) eoCount += 1;
    
    // accumulate exception missing minutes
    if(exceptionMissingMin > 0) totalExceptionMissingMin += exceptionMissingMin;
  }

  return {
    totalDays: FIXED_MONTH_DAYS,
    realDays: realDim,

    // independent working-day system
    nonWorkingDays: nonWorkingSet.size,
    workingDays,

    // food-paid days
    presentWorkingDays,

    // payroll factors
    absenceDays: Number(absenceDays.toFixed(2)),
    holidayWorked,
    missingMinutes: Math.round(missingMinutes),

    // analytics
    pDays, ppDays, phDays, phfDays,

    // exception code analytics
    niDays, noDays, moDays, ipDays,
    liCount, eoCount,
    totalExceptionMissingMin: Math.round(totalExceptionMissingMin),

    // debug data
    debugDays,
  };
  
  return result;
}

// =====================
// PAY CALC
// =====================
function calcSheet(emp, att){
  const baseLyd = toN(emp.BASIC_SALARY);
  const baseUsd = toN(emp.BASIC_SALARY_USD);

  const dailyLyd = baseLyd / FIXED_MONTH_DAYS;
  const dailyUsd = baseUsd / FIXED_MONTH_DAYS;

  // Food: pay ONLY present working days
  const foodPerDay = toN(emp.FOOD_ALLOWANCE) || toN(emp.FOOD) || 0;
  const presentWorkingDays = Math.max(0, toN(att.presentWorkingDays));
  const wdFoodLyd = Number((foodPerDay * presentWorkingDays).toFixed(2));
  const wdFoodUsd = 0;

  // Absence: daily rate * absence days (working days only already)
  const absenceDays = Math.max(0, toN(att.absenceDays));
  const absenceLyd = Number((dailyLyd * absenceDays).toFixed(2));
  const absenceUsd = Number((dailyUsd * absenceDays).toFixed(6));

  // PH (Paid Holiday worked): double daily rate, no food allowance
  const phDays = Math.max(0, toN(att.phDays));
  const phLyd = Number((dailyLyd * 2 * phDays).toFixed(2));
  const phUsd = Number((dailyUsd * 2 * phDays).toFixed(6));
  
  // PHF (Paid Holiday Full): double daily rate + food allowance
  const phfDays = Math.max(0, toN(att.phfDays));
  const phfLyd = Number(((dailyLyd * 2 + foodPerDay) * phfDays).toFixed(2));
  const phfUsd = Number((dailyUsd * 2 * phfDays).toFixed(6));

  // Latency: missing minutes translated to money using fixed 8h day
  const latencyMinutes = Math.max(0, toN(att.missingMinutes));
  const latencyHours = latencyMinutes / 60;
  const schedHours = 8;

  const latencyLyd = Number(((dailyLyd / schedHours) * latencyHours).toFixed(2));
  const latencyUsd = Number(((dailyUsd / schedHours) * latencyHours).toFixed(6));

  const totalLyd = Number((baseLyd + wdFoodLyd - absenceLyd + phLyd + phfLyd - latencyLyd).toFixed(2));
  const totalUsd = Number((baseUsd + wdFoodUsd - absenceUsd + phUsd + phfUsd - latencyUsd).toFixed(6));

  return {
    baseLyd, baseUsd,

    foodPerDay,
    presentWorkingDays,
    wdFoodLyd, wdFoodUsd,

    absenceDays,
    absenceLyd, absenceUsd,

    phDays,
    phLyd, phUsd,
    
    phfDays,
    phfLyd, phfUsd,

    missingMinutes: Math.round(latencyMinutes),
    missingLyd: latencyLyd,
    missingUsd: latencyUsd,

    totalLyd, totalUsd
  };
}

function calcNet(vals, x){
  const netLyd = Number((
    vals.totalLyd
    + toN(x.gold_bonus_lyd)+toN(x.other_bonus1_lyd)+toN(x.other_bonus2_lyd)
    + toN(x.loan_debit_lyd)
    - toN(x.loan_credit_lyd)
    + toN(x.other_additions_lyd)
    - toN(x.other_deductions_lyd)
  ).toFixed(2));

  const netUsd = Number((
    vals.totalUsd
    + toN(x.gold_bonus_usd)+toN(x.other_bonus1_usd)+toN(x.other_bonus2_usd)
    + toN(x.loan_debit_usd)
    - toN(x.loan_credit_usd)
    + toN(x.other_additions_usd)
    - toN(x.other_deductions_usd)
  ).toFixed(6));

  return { netLyd, netUsd };
}

function pastMonth(y,m){
  const now=moment();
  const t=moment({year:y, month:m-1, day:1});
  return t.isBefore(now,'month');
}

// =====================
// SALES METRICS
// =====================
async function loadSalesMetrics(year, month){
  try {
    const Invoice = require('../../models/sales/Invoice');
    const startYmd = moment.utc({ year, month: month-1, day: 1 }).format('YYYY-MM-DD');
    const endYmd = moment.utc({ year, month: month-1, day: dim(year, month) }).format('YYYY-MM-DD');
    const betweenLiteral = literal(`CONVERT(date, [Facture].[d_time], 23) BETWEEN '${startYmd}' AND '${endYmd}'`);
    const rows = await Invoice.findAll({
      attributes: [
        'usr',
        [fn('SUM', cast(col('amount_lyd'), 'float')), 'total_lyd'],
        [fn('SUM', cast(col('qty'), 'float')), 'qty'],
      ],
      where: betweenLiteral,
      group: ['usr'],
      raw: true,
    });
    const map = new Map();
    for(const r of rows){
      map.set(Number(r.usr), { total_lyd: Number(r.total_lyd)||0, qty: Number(r.qty)||0 });
    }
    return map;
  } catch (_e) {
    return new Map();
  }
}

// =====================
// ADJUSTMENTS JSON
// =====================
const ADJ_FILE = path.resolve(__dirname, '../../config/payroll-adjustments.json');

function readAdjFile(){
  try{
    if(!fs.existsSync(ADJ_FILE)) return {};
    const txt=fs.readFileSync(ADJ_FILE,'utf8');
    return JSON.parse(txt||'{}')||{};
  }catch{
    return {};
  }
}

function loadPeriodAdjustmentsV2(idEmp, year, month){
  const key = `${year}-${String(month).padStart(2,'0')}`;
  const db = readAdjFile();
  const list = db[key]?.[String(idEmp)] || [];

  let other_additions_lyd=0, other_additions_usd=0;
  let other_deductions_lyd=0, other_deductions_usd=0;
  let loan_credit_lyd=0, loan_credit_usd=0;

  for(const a of list){
    const amt = Number(a.amount || 0);
    if(!amt) continue;
    const cur = String(a.currency || 'LYD').toUpperCase();
    const isUsd = cur === 'USD';
    const t = String(a.type || '').toLowerCase();

    const isPositive = (
      t === 'bonus' || t === 'eid_bonus' || t === 'eidbonus' ||
      t === 'food_allow' || t === 'food' ||
      t === 'comm_allow' || t === 'communication' ||
      t === 'transport' || t === 'transportation' ||
      t === 'gold_comm' || t === 'diamond_comm' || t === 'watch_comm'
    );
    const isNegative = (t === 'deduction' || t === 'advance');
    const isLoanCredit = (t === 'loanpayment' || t === 'loan_payment' || t === 'loanrepayment' || t === 'loan_repayment');

    if(isPositive){
      if(isUsd) other_additions_usd += amt; else other_additions_lyd += amt;
    } else if(isNegative){
      if(isUsd) other_deductions_usd += amt; else other_deductions_lyd += amt;
    } else if(isLoanCredit){
      if(isUsd) loan_credit_usd += amt; else loan_credit_lyd += amt;
    }
  }

  return { other_additions_lyd, other_additions_usd, other_deductions_lyd, other_deductions_usd, loan_credit_lyd, loan_credit_usd };
}

// =====================
// LOANS
// =====================
async function computeLoanScheduleCreditV2(idEmp, { year, month, baseSalary }){
  const loans = await PayrollLoan.findAll({ where:{ id_emp: Number(idEmp), closed: false }, raw:true });
  const key = `${year}-${String(month).padStart(2,'0')}`;
  let loan_credit_lyd = 0;

  for(const l of loans){
    const startKey = `${l.startYear}-${String(l.startMonth).padStart(2,'0')}`;
    if(key < startKey) continue;

    const skips = new Set(String(l.skipMonths||'').split(',').map(s=>s.trim()).filter(Boolean));
    if(skips.has(key)) continue;

    const pct = Number(l.monthlyPercent||0.25);
    const target = Math.max(0, Math.floor((Number(baseSalary||0)*pct)*100)/100);
    const rem = Number(l.remaining||l.principal||0);
    const pay = Math.min(rem, target);
    if(pay>0) loan_credit_lyd += pay;
  }

  return { loan_credit_lyd, loan_credit_usd: 0 };
}

// =====================
// MAIN ENDPOINTS
// =====================
exports.compute = async (req,res)=>{
  try{
    const YY = Number(req.query.year) || moment().year();
    const MM = Number(req.query.month) || (moment().month()+1);

    const whereEmp = { STATE:true };
    if(req.query.employeeId) whereEmp.ID_EMP = Number(req.query.employeeId);
    if(req.query.ps!=null && req.query.ps!=='') whereEmp.PS = Number(req.query.ps);

    const emps = await Employee.findAll({
      where: whereEmp,
      attributes:[
        'ID_EMP','NAME','PS','ATTACHED_NUMBER',
        'T_START','T_END',
        'BASIC_SALARY','BASIC_SALARY_USD',
        'FOOD','FOOD_ALLOWANCE',
        'GOLD_COMM',
        'GOLD_COMM_VALUE'
      ],
      raw:true,
      order:[['ID_EMP','ASC']]
    });

    const hs = await holSet(YY,MM);
    const salesMap = await loadSalesMetrics(YY, MM);

    const rows = [];

    for(const e of emps){
      const att = await attendance(e,{year:YY,month:MM,holidaySet:hs});
      const vals = calcSheet(e, att);

      const adj = loadPeriodAdjustmentsV2(e.ID_EMP, YY, MM);
      const sched = await computeLoanScheduleCreditV2(e.ID_EMP, { year: YY, month: MM, baseSalary: e.BASIC_SALARY });

      // sales commission (unchanged)
      const s = salesMap.get(Number(e.ID_EMP)) || { total_lyd: 0, qty: 0 };
      const goldRate = Number(e.GOLD_COMM_VALUE || 0);
      const goldCommType = String(e.GOLD_COMM || '').toLowerCase();
      const gold_bonus_lyd = (() => {
        if (!(goldRate > 0)) return 0;
        // If configured as fixed, interpret GOLD_COMM_VALUE as LYD per gram, and use sales qty as grams
        if (goldCommType === 'fixed') {
          return Number((((s.qty || 0) * goldRate) || 0).toFixed(2));
        }
        // Default: percent of total LYD sales
        return Number((((s.total_lyd || 0) * (goldRate / 100)) || 0).toFixed(2));
      })();

      const extras = {
        gold_bonus_lyd,
        gold_bonus_usd: 0,

        other_bonus1_lyd: 0, other_bonus1_usd: 0,
        other_bonus2_lyd: 0, other_bonus2_usd: 0,

        loan_debit_lyd: 0, loan_debit_usd: 0,

        loan_credit_lyd: (adj.loan_credit_lyd || 0) + (sched.loan_credit_lyd || 0),
        loan_credit_usd: adj.loan_credit_usd || 0,

        other_additions_lyd: adj.other_additions_lyd || 0,
        other_additions_usd: adj.other_additions_usd || 0,

        other_deductions_lyd: adj.other_deductions_lyd || 0,
        other_deductions_usd: adj.other_deductions_usd || 0,
      };

      const net = calcNet(vals, extras);

      rows.push({
        year: YY, month: MM, id_emp: e.ID_EMP, name: e.NAME, ps: e.PS,

        // attendance summary
        totalDays: att.totalDays,
        realDays: att.realDays,
        nonWorkingDays: att.nonWorkingDays,
        workingDays: att.workingDays,
        presentWorkingDays: att.presentWorkingDays,

        absenceDays: att.absenceDays,
        holidayWorked: att.holidayWorked,
        missingMinutes: att.missingMinutes,

        pDays: att.pDays,
        ppDays: att.ppDays,
        phDays: att.phDays,
        phfDays: att.phfDays,

        // exception code analytics
        niDays: att.niDays,
        noDays: att.noDays,
        moDays: att.moDays,
        ipDays: att.ipDays,
        liCount: att.liCount,
        eoCount: att.eoCount,
        totalExceptionMissingMin: att.totalExceptionMissingMin,

        // calc results
        baseLyd: vals.baseLyd, baseUsd: vals.baseUsd,
        wdFoodLyd: vals.wdFoodLyd, wdFoodUsd: vals.wdFoodUsd,
        absenceLyd: vals.absenceLyd, absenceUsd: vals.absenceUsd,
        phLyd: vals.phLyd, phUsd: vals.phUsd,
        missingLyd: vals.missingLyd, missingUsd: vals.missingUsd,
        totalLyd: vals.totalLyd, totalUsd: vals.totalUsd,

        latencyMinutes: vals.missingMinutes,
        latencyLyd: vals.missingLyd,
        latencyUsd: vals.missingUsd,

        // db-like fields (keep compatibility)
        base_salary_lyd: vals.baseLyd,
        base_salary_usd: vals.baseUsd,

        food_days: att.presentWorkingDays,        // IMPORTANT: paid food days
        wd_food_lyd: vals.wdFoodLyd,
        wd_food_usd: vals.wdFoodUsd,

        absence_days: att.absenceDays,
        absence_lyd: vals.absenceLyd,
        absence_usd: vals.absenceUsd,

        p_days: att.pDays,
        pp_days: att.ppDays,
        ph_days: att.phDays,
        phf_days: att.phfDays,
        ph_lyd: vals.phLyd,
        ph_usd: vals.phUsd,
        phf_lyd: vals.phfLyd,
        phf_usd: vals.phfUsd,

        missing_minutes: att.missingMinutes,
        missing_lyd: vals.missingLyd,
        missing_usd: vals.missingUsd,

        total_salary_lyd: vals.totalLyd,
        total_salary_usd: vals.totalUsd,

        ...extras,

        net_salary_lyd: net.netLyd,
        net_salary_usd: net.netUsd,
        D16: net.netLyd,
        C16: net.netUsd,

        // debug data
        debugDays: att.debugDays,
      });
    }

    res.json({ ok:true, year:YY, month:MM, rows, viewOnly: pastMonth(YY,MM) });
  }catch(e){
    res.status(500).json({ ok:false, message:'compute failed', error:e?.message||String(e) });
  }
};

exports.getMonth = async (req,res)=>{
  try{
    const YY=Number(req.query.year), MM=Number(req.query.month);
    if(!YY||!MM) return res.status(400).json({ok:false,message:'year/month required'});

    const arch=await PayrollArchivedSalary.findAll({ where:{ year:YY, month:MM }, raw:true });
    if(arch.length) return res.json({ ok:true, year:YY, month:MM, rows:arch, archived:true, viewOnly:true });

    const open=await PayrollSalary.findAll({ where:{ year:YY, month:MM }, raw:true });
    res.json({ ok:true, year:YY, month:MM, rows:open, viewOnly: pastMonth(YY,MM) });
  }catch(e){
    res.status(500).json({ ok:false, message:'load failed', error:e?.message||String(e) });
  }
};

exports.saveMonth = async (req,res)=>{
  try{
    const { year, month, rows } = req.body||{};
    if(!year||!month) return res.status(400).json({ok:false,message:'year/month required'});
    if(pastMonth(Number(year),Number(month))) return res.status(403).json({ ok:false, message:'Past months are archived and view-only' });
    if(!Array.isArray(rows)) return res.status(400).json({ ok:false, message:'rows must be array' });

    for(const r of rows){
      const data={
        year: Number(r.year),
        month: Number(r.month),
        id_emp: Number(r.id_emp),
        name: r.name || null,
        ps: r.ps != null ? Number(r.ps) : null,

        base_salary_lyd: r.base_salary_lyd ?? r.baseLyd ?? 0,
        base_salary_usd: r.base_salary_usd ?? r.baseUsd ?? 0,

        // food_days is now PAID FOOD DAYS (presentWorkingDays)
        food_days: r.food_days ?? r.presentWorkingDays ?? 0,
        wd_food_lyd: r.wd_food_lyd ?? r.wdFoodLyd ?? 0,
        wd_food_usd: r.wd_food_usd ?? r.wdFoodUsd ?? 0,

        absence_days: r.absence_days ?? r.absenceDays ?? 0,
        absence_lyd: r.absence_lyd ?? r.absenceLyd ?? 0,
        absence_usd: r.absence_usd ?? r.absenceUsd ?? 0,

        ph_days: r.ph_days ?? r.holidayWorked ?? 0,
        ph_lyd: r.ph_lyd ?? r.phLyd ?? 0,
        ph_usd: r.ph_usd ?? r.phUsd ?? 0,

        missing_minutes: r.missing_minutes ?? r.missingMinutes ?? 0,
        missing_lyd: r.missing_lyd ?? r.missingLyd ?? 0,
        missing_usd: r.missing_usd ?? r.missingUsd ?? 0,

        total_salary_lyd: r.total_salary_lyd ?? r.totalLyd ?? 0,
        total_salary_usd: r.total_salary_usd ?? r.totalUsd ?? 0,

        gold_bonus_lyd: r.gold_bonus_lyd ?? 0,
        gold_bonus_usd: r.gold_bonus_usd ?? 0,

        other_bonus1_lyd: r.other_bonus1_lyd ?? 0,
        other_bonus1_usd: r.other_bonus1_usd ?? 0,
        other_bonus2_lyd: r.other_bonus2_lyd ?? 0,
        other_bonus2_usd: r.other_bonus2_usd ?? 0,

        loan_debit_lyd: r.loan_debit_lyd ?? 0,
        loan_debit_usd: r.loan_debit_usd ?? 0,
        loan_credit_lyd: r.loan_credit_lyd ?? 0,
        loan_credit_usd: r.loan_credit_usd ?? 0,

        other_additions_lyd: r.other_additions_lyd ?? 0,
        other_additions_usd: r.other_additions_usd ?? 0,
        other_deductions_lyd: r.other_deductions_lyd ?? 0,
        other_deductions_usd: r.other_deductions_usd ?? 0,

        net_salary_lyd: r.net_salary_lyd ?? r.netLyd ?? 0,
        net_salary_usd: r.net_salary_usd ?? r.netUsd ?? 0,

        locked: false,
      };

      const found=await PayrollSalary.findOne({ where:{ year:data.year, month:data.month, id_emp:data.id_emp } });
      if(found) await found.update(data);
      else await PayrollSalary.create(data);
    }

    res.json({ ok:true });
  }catch(e){
    res.status(500).json({ ok:false, message:'save failed', error:e?.message||String(e) });
  }
};

async function postGL({ date, acc, debit=0, credit=0, note, usr=0, empId=0, ps=0, docNo }){
  return GLTran.create({
    Acc_No: String(acc),
    KidNoT:'PAYR',
    Date: date,
    Cridt: credit,
    Dibt: debit,
    Note: note||'',
    NUM_FACTURE: docNo||'',
    ENTETE:'PAYROLL',
    SOURCE:'PAYROLL',
    is_closed:false,
    check_number:'',
    usr,
    ref_emp: empId,
    num_sarf:0,
    DATE_FACT: date,
    fl:false,
    Cridt_Curr:0,
    Dibt_Curr:0,
    Id_Cost_Center:0,
    id_supp_cuss:0,
    Cridt_Curr_A:0,
    Dibt_Curr_A:0,
    Cridt_Curr_B:0,
    Dibt_Curr_B:0,
    rate:1,
    date_effect: date,
    sor_1:0,
    fll:false,
    original_value_cridt: credit,
    original_value_dibt: debit,
    Curr_riginal_value:'LYD',
    MrkzName:'',
    NUM_SARFF:'',
    CLIENT:0,
    PS: ps||0
  });
}

exports.closeMonth = async (req,res)=>{
  try{
    const { year, month, bankAcc, salaryExpenseAcc, note } = req.body||{};
    if(!year||!month||!bankAcc||!salaryExpenseAcc)
      return res.status(400).json({ ok:false, message:'year, month, bankAcc, salaryExpenseAcc required' });

    const YY=Number(year), MM=Number(month);
    const rows=await PayrollSalary.findAll({ where:{ year:YY, month:MM }, raw:true });
    if(!rows.length) return res.status(404).json({ ok:false, message:'no rows to close' });

    const date=new Date(YY, MM-1, dim(YY,MM));
    const userId=(req.user&&req.user.id_user)||0;

    for(const r of rows){
      const arch={ ...r, locked:true, closed_by:userId, closed_at:new Date(), gl_doc_no:`PR-${YY}${String(MM).padStart(2,'0')}-${r.id_emp}` };
      delete arch.id;
      await PayrollArchivedSalary.create(arch);

      const net=Number(r.net_salary_lyd||0);
      if(net>0){
        const doc=arch.gl_doc_no;
        await postGL({ date, acc: salaryExpenseAcc, debit: net, credit: 0, note, usr: userId, empId: r.id_emp, ps: r.ps||0, docNo: doc });
        await postGL({ date, acc: bankAcc, debit: 0, credit: net, note, usr: userId, empId: r.id_emp, ps: r.ps||0, docNo: doc });
      }
    }

    await PayrollSalary.destroy({ where:{ year:YY, month:MM } });
    res.json({ ok:true, archived: rows.length });
  }catch(e){
    res.status(500).json({ ok:false, message:'close failed', error:e?.message||String(e) });
  }
};

// ===== Loans (unchanged) =====
exports.listLoans = async (req, res) => {
  try {
    const { employeeId } = req.query || {};
    const where0 = employeeId ? { id_emp: Number(employeeId) } : {};
    const rows = await PayrollLoan.findAll({ where: where0, order: [['id','ASC']], raw: true });
    res.json({ ok: true, rows });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Failed to read loans', error: e?.message || String(e) });
  }
};

exports.createLoan = async (req, res) => {
  try {
    const { employeeId, principal, startYear, startMonth, monthlyPercent, capMultiple, note } = req.body || {};
    if (!employeeId || !principal || !startYear || !startMonth)
      return res.status(400).json({ ok: false, message: 'Missing required fields' });

    const emp = await Employee.findByPk(Number(employeeId), { attributes: ['ID_EMP','BASIC_SALARY'], raw: true });
    if (!emp) return res.status(404).json({ ok: false, message: 'Employee not found' });

    const salary = toN(emp.BASIC_SALARY);
    const cap = Number(capMultiple || 3);
    if (Number(principal) > salary * cap)
      return res.status(400).json({ ok: false, message: `Principal exceeds cap (${cap}x salary)` });

    const rec = await PayrollLoan.create({
      id_emp: Number(employeeId),
      principal: Number(principal),
      remaining: Number(principal),
      startYear: Number(startYear),
      startMonth: Number(startMonth),
      monthlyPercent: Number(monthlyPercent || 0.25),
      capMultiple: cap,
      skipMonths: '',
      note: note || '',
      closed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.json({ ok: true, loan: rec });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Failed to create loan', error: e?.message || String(e) });
  }
};

exports.skipLoanMonth = async (req, res) => {
  try {
    const { loanId, employeeId, year, month } = req.body || {};
    if (!year || !month) return res.status(400).json({ ok: false, message: 'Missing year/month' });

    const key = `${Number(year)}-${String(Number(month)).padStart(2,'0')}`;
    const where0 = loanId ? { id: Number(loanId) } : (employeeId ? { id_emp: Number(employeeId), closed: false } : { closed: false });

    const loans = await PayrollLoan.findAll({ where: where0 });
    let count = 0;

    for (const l of loans) {
      const list = String(l.skipMonths||'').split(',').map(s => s.trim()).filter(Boolean);
      if (!list.includes(key)) list.push(key);
      await l.update({ skipMonths: list.join(','), updatedAt: new Date() });
      count++;
    }

    res.json({ ok: true, skipped: key, updated: count });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Failed to skip month', error: e?.message || String(e) });
  }
};

exports.payoffLoan = async (req, res) => {
  try {
    const { loanId, employeeId, amount } = req.body || {};
    const where0 = loanId ? { id: Number(loanId) } : (employeeId ? { id_emp: Number(employeeId), closed: false } : { closed: false });

    const loans = await PayrollLoan.findAll({ where: where0 });
    if (!loans.length) return res.json({ ok: true, updated: 0 });

    let updated = 0;

    for (const l of loans) {
      const rem = Number(l.remaining || 0);
      const pay = amount != null ? Math.max(0, Number(amount)) : rem;
      const newRem = Math.max(0, rem - pay);
      const closed = newRem <= 0 ? true : l.closed;
      await l.update({ remaining: newRem, closed, updatedAt: new Date() });
      updated++;
    }

    res.json({ ok: true, updated });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Failed to payoff loan', error: e?.message || String(e) });
  }
};
