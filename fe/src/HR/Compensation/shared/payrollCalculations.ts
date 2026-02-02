import dayjs from "dayjs";

const LEAVE_FULL_CODES = new Set([
  "AL",
  "SL", 
  "EL",
  "ML",
  "UL",
  "BM",
  "XL",
  "B1",
  "B2",
  "PP",
  "PL",
]);

const LEAVE_HALF_CODES = new Set(["HL"]);

export const TOLERANCE_MINUTES = 30;

export interface TimesheetDay {
  workMin: number;
  date: string;
  code?: string;
  deltaMin?: number;
  isHoliday?: boolean;
  entry?: string;
  exit?: string;
  punches?: string[];    // Tripoli-local strings
  present?: boolean;
}

export interface PayrollAggData {
  presentP: number;
  presentStrict: number;
  phUnits: number;
  fridayA: number;
  missRatio: number;
  phFullDays: number;
  phPartDays: number;
  absenceDays: number;
  missingMinutes: number;
  leaveUnits: number;
  foodEligibleNonFpDays: number;
  displayMissingMinutes: number;
}

/**
 * Calculate missing/latency minutes from timesheet data
 * Uses the same logic as PayrollPage lines 2474-2481
 */
export function calculateMissingMinutes(
  timesheetDays: TimesheetDay[],
  employeeId: number,
  holidaysSet: Set<string>
): { missAll: number; missDisplay: number; missNoPT: number } {
  let missAll = 0;
  let missDisplay = 0;
  let missNoPT = 0;
  const today = dayjs().startOf("day");

  timesheetDays.forEach((d) => {
    const dayDate = dayjs(d.date);
    const isFriday = dayDate.day() === 5;
    const isHoliday = d.isHoliday || holidaysSet.has(d.date);
    
    // Skip future days
    if (dayDate.isBefore(today, "day")) {
      const dm = Number(d.deltaMin || 0);
      if (dm < 0) {
        const abs = Math.abs(dm);
        missAll += abs;
        
        // Apply 30-minute tolerance for display
        if (abs > TOLERANCE_MINUTES) {
          missDisplay += abs;
        }
        
        // Exclude PT (public transport) from some calculations
        const code = String(d.code || "").toUpperCase();
        if (code !== "PT") {
          missNoPT += abs;
        }
      }
    }
  });

  return { missAll, missDisplay, missNoPT };
}

/**
 * Calculate absence days from timesheet data
 * Uses the same logic as PayrollPage lines 2445-2454
 */
export function calculateAbsenceDays(
  timesheetDays: TimesheetDay[],
  holidaysSet: Set<string>
): number {
  let absenceDays = 0;

  timesheetDays.forEach((d) => {
    const dayDate = dayjs(d.date);
    const isFriday = dayDate.day() === 5;
    const isHoliday = d.isHoliday || holidaysSet.has(d.date);
    
    // Only count working days (not Fridays or holidays)
    if (!isFriday && !isHoliday) {
      const code = String(d.code || "").toUpperCase();
      
      // A and UL = 1 day, HL = 0.5 day
      if (code === "A" || code === "UL") {
        absenceDays += 1;
      } else if (code === "HL") {
        absenceDays += 0.5;
      }
    }
  });

  return absenceDays;
}

/**
 * Build payroll aggregation data for an employee
 * Mirrors PayrollPage's tsAgg calculation (lines 2380-2500)
 */
export function buildPayrollAggregation(
  employeeId: number,
  timesheetDays: TimesheetDay[],
  holidaysSet: Set<string>
): PayrollAggData {
  let presentP = 0;
  let presentStrict = 0;
  let phUnits = 0;
  let fridayA = 0;
  let phFullDays = 0;
  let phPartDays = 0;
  let leaveUnits = 0;
  let foodEligibleNonFpDays = 0;

  timesheetDays.forEach((d) => {
    const dayDate = dayjs(d.date);
    const isFriday = dayDate.day() === 5;
    const isHoliday = d.isHoliday || holidaysSet.has(d.date);
    const code = String(d.code || "").toUpperCase();
    const isLeave = LEAVE_FULL_CODES.has(code) || LEAVE_HALF_CODES.has(code);
    const punchesArr = Array.isArray(d.punches) ? d.punches : [];
    const hasPunches = punchesArr.length > 0;
    const hasEntry = d.entry !== null && d.entry !== undefined;
    const hasExit = d.exit !== null && d.exit !== undefined;
    const hasWorkMinutes = Number(d.workMin ?? 0) > 0;
    const hasPresenceFlag = Boolean(d.present);
    const hasPresence = hasPunches || hasEntry || hasExit || hasWorkMinutes || hasPresenceFlag;
    
    // Present days calculation (only when actual attendance exists)
    if (!isFriday && !isHoliday && hasPresence) {
      presentP += 1;
      if (!isLeave) {
        presentStrict += 1;
      }
    }

    // Public holiday units - ONLY if employee actually worked (has punches)
    if (isHoliday) {
      // Check if employee actually has punches/entry/exit on this holiday
      const actuallyWorked = hasPunches || (hasEntry && hasExit) || hasPresenceFlag || hasWorkMinutes;
      
      if (actuallyWorked) {
        phUnits += 1;
        if (code === "PHF") {
          phFullDays += 1;
        } else if (code === "PH") {
          phPartDays += 1;
        } else {
          phPartDays += 1;
        }
        
        // Debug logging for holiday work
        console.log(`[DEBUG] Employee ${employeeId} worked on holiday ${d.date}:`, {
          date: d.date,
          code,
          hasPunches,
          hasEntry,
          hasExit,
          actuallyWorked,
          phUnits,
          phFullDays,
          phPartDays
        });
      } else {
        // Debug logging for holiday not worked
        console.log(`[DEBUG] Employee ${employeeId} did NOT work on holiday ${d.date}:`, {
          date: d.date,
          code,
          hasPunches,
          hasEntry,
          hasExit,
          actuallyWorked,
          reason: 'No punches found - no PH payment'
        });
      }
    }

    // Friday absences
    if (isFriday && code === "A") {
      fridayA += 1;
    }

    // Leave units
    if (isLeave) {
      if (LEAVE_HALF_CODES.has(code)) {
        leaveUnits += 0.5;
      } else {
        leaveUnits += 1;
      }
    }

    // Food eligible non-fingerprint days
    if (!isLeave && !isFriday && !isHoliday) {
      foodEligibleNonFpDays += 1;
    }
  });

  const { missAll, missDisplay, missNoPT } = calculateMissingMinutes(timesheetDays, employeeId, holidaysSet);
  const absenceDays = calculateAbsenceDays(timesheetDays, holidaysSet);
  const missRatio = missAll > 0 ? missNoPT / missAll : 0;

  return {
    presentP,
    presentStrict,
    phUnits,
    fridayA,
    missRatio,
    phFullDays,
    phPartDays,
    absenceDays,
    missingMinutes: missAll,
    leaveUnits,
    foodEligibleNonFpDays,
    displayMissingMinutes: missDisplay,
  };
}

/**
 * Format minutes to signed HHMM string (negative for missing time)
 */
export function minutesToSignedHHMM(minutes: number): string {
  if (minutes === 0) return "0h 0m";
  if (!minutes) return "";
  const absMinutes = Math.abs(minutes);
  const hours = Math.floor(absMinutes / 60);
  const mins = absMinutes % 60;
  const sign = minutes > 0 ? "-" : ""; // missing time shows as negative
  return `${sign}${hours}h ${mins}m`;
}
