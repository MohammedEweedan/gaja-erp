import axios from "axios";
import dayjs, { Dayjs } from "dayjs";
import { getAuthHeader } from "../utils/auth";

const API_URL = process.env.REACT_APP_API_IP;
const baseUrl = () => {
  const inferred = `${window.location.protocol}//${window.location.hostname}:9000`;
  const b = (API_URL && API_URL.trim()) ? API_URL : inferred;
  return b.replace(/\/+$/, '');
};

interface CalendarLogParams {
  startDate: string;                  // 'YYYY-MM-DD'
  endDate: string;                    // 'YYYY-MM-DD'
  employeeId?: string | number;
  status?: string;                    // e.g. 'pending' or 'Pending,Approved'
}

export const previewLeaveDays = async (params: {
  startDate: string;
  endDate: string;
  leaveType: string | number; // TS_Codes.code or int_can
}) => {
  const response = await axios.get(`${baseUrl()}/leave/leave-days/preview`, {
    params,
    headers: await getAuthHeader(),
  });
  return response.data;
};

// ---------- Leave Balance ----------
export const getLeaveBalance = async (employeeId: string) => {
  const res = await axios.get(`${baseUrl()}/leave/leave-balance/${employeeId}`, {
    headers: await getAuthHeader(),
  });
  const d = res.data || {};

  // normalize - use new carry-forward fields from backend
  const total = d.annualEntitlement ?? d.entitlement ?? d.totalLeaves ?? 0;
  const used  = d.deductedToDate ?? d.used ?? d.usedLeaves ?? 0;
  const rem   = d.remaining ?? d.remainingLeaves ?? Math.max(0, total - used);
  
  // New carry-forward fields
  const accruedToDate = d.accruedToDate ?? total;
  const carryForward = d.carryForward ?? 0;
  const currentYearAccrued = d.currentYearAccrued ?? total;

  const rawHistory = Array.isArray(d.deductionEntries)
    ? d.deductionEntries
    : (Array.isArray(d.leaveHistory) ? d.leaveHistory : (Array.isArray(d.leaves) ? d.leaves : []));
  const history = rawHistory.map((x: any) => ({
    id: x.ID_LEAVE ?? x.int_con ?? x.id,
    type: x.LEAVE_TYPE ?? x.leaveTypeName ?? x.leaveTypeCode ?? x.type ?? 'annual',
    startDate: x.DATE_START ?? x.startDate ?? x.date_depart,
    endDate:   x.DATE_END   ?? x.endDate   ?? x.date_end,
    days: x.NUM_DAYS ?? x.nbr_jour ?? x.days ?? x.deducted ?? 0,
    effectiveDays: x.effectiveDays ?? x.effective_days ?? x.effective_days_count ?? undefined,
    excluded: x.excluded ?? undefined,
    status: (x.STATUS ?? x.state ?? x.status ?? 'approved').toLowerCase(),
  }));

  const toIso = (value: any): string | null => {
    if (!value) return null;
    if (value instanceof Date && !isNaN(value.getTime())) {
      return dayjs(value).format("YYYY-MM-DD");
    }
    const s = String(value).trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const dmY = s.match(/^([0-3]?\d)[\/-]([0-1]?\d)[\/-](\d{4})/);
    if (dmY) {
      const dd = dmY[1].padStart(2, "0");
      const mm = dmY[2].padStart(2, "0");
      return `${dmY[3]}-${mm}-${dd}`;
    }
    const parsed = dayjs(s);
    return parsed.isValid() ? parsed.format("YYYY-MM-DD") : null;
  };

  const toDay = (value: any): Dayjs | null => {
    const iso = toIso(value);
    if (!iso) return null;
    const parsed = dayjs(iso);
    return parsed.isValid() ? parsed : null;
  };

  const currentYear = dayjs().year();
  const yearStart = dayjs(`${currentYear}-01-01`);
  const yearEnd = dayjs(`${currentYear}-12-31`);

  const approvedThisYear = history.reduce((sum: number, entry: typeof history[number]) => {
    if (entry.status && entry.status !== "approved") return sum;
    const start = toDay(entry.startDate);
    const end = toDay(entry.endDate) || start;
    if (!start) return sum;
    const safeEnd = end && end.isValid() ? end : start;
    if (safeEnd.isBefore(yearStart) || start.isAfter(yearEnd)) {
      return sum;
    }
    const clampedStart = start.isBefore(yearStart) ? yearStart : start;
    const clampedEnd = safeEnd.isAfter(yearEnd) ? yearEnd : safeEnd;
    if (clampedEnd.isBefore(clampedStart)) return sum;

    const spanFromSource = safeEnd.diff(start, "day") + 1;
    const overlapSpan = clampedEnd.diff(clampedStart, "day") + 1;

    const reportedDays = Number(entry.effectiveDays ?? entry.days ?? 0);
    let portion = reportedDays && spanFromSource > 0
      ? (reportedDays * overlapSpan) / spanFromSource
      : overlapSpan;

    if (!Number.isFinite(portion)) portion = 0;
    return sum + Math.max(0, portion);
  }, 0);

  const accrualBaseRaw = d.currentYearAccrued ?? d.accruedToDate ?? total;
  const accrualBase = Number.isFinite(Number(accrualBaseRaw))
    ? Number(accrualBaseRaw)
    : total;
  const usedThisYear = Math.max(0, Number(approvedThisYear.toFixed(2)));
  const adjustedRemaining = Math.max(0, Number((accrualBase - usedThisYear).toFixed(2)));

  return {
    entitlement: total,
    used: usedThisYear,
    remaining: adjustedRemaining,
    accruedToDate: accrualBase,
    carryForward: 0,
    currentYearAccrued: accrualBase,
    monthlyRate: d.monthlyRate ?? 0,
    lastUpdated: d.lastUpdated ?? d.LAST_LEAVE_CALCULATION ?? null,
    leaveHistory: history,
  };
};

// ---------- Leave Requests (per employee) ----------
export const getLeaveRequests = async (employeeId: string | number) => {
  const res = await axios.get(`${baseUrl()}/leave/leave-requests/${employeeId}`, {
    headers: await getAuthHeader(),
  });
  const arr = res.data || [];
  return arr.map((v: any) => ({
    id: String(v.int_con ?? v.ID_LEAVE ?? v.id),
    type: v.leaveTypeName ?? v.leaveTypeCode ?? v.type ?? 'annual',
    startDate: v.date_depart ?? v.DATE_START ?? v.startDate,
    endDate:   v.date_end    ?? v.DATE_END   ?? v.endDate,
    days: v.nbr_jour ?? v.NUM_DAYS ?? v.days ?? 0,
    effectiveDays: v.effectiveDays ?? v.effective_days ?? undefined,
    excluded: v.excluded ?? undefined,
    status: (v.state ?? v.STATUS ?? v.status ?? 'pending').toLowerCase(),
    submittedDate: v.date_creation ?? v.createdAt ?? v.SUBMITTED_AT ?? v.submittedDate ?? v.date_depart,
    reviewedBy: v.reviewedBy ?? undefined,
    reviewedAt: v.reviewedAt ?? undefined,
    comments: v.COMMENT ?? v.Cause ?? v.comments ?? '',
    idCan: v.id_can ?? v.idCan ?? undefined,
    employeeId: v.id_emp ?? undefined,
  }));
};

export const updateLeaveRequestFlexible = async (payload: {
  id: number | string;
  startDate: string; endDate: string;
  code: string; id_can?: string; comment?: string;
  keepState?: boolean;
}) => {
  const headers = await getAuthHeader();
  const id = payload.id;
  const compact = {
    id, int_con: id, id_conge: id,
    startDate: payload.startDate, endDate: payload.endDate,
    DATE_START: payload.startDate, DATE_END: payload.endDate,
    date_depart: payload.startDate, date_end: payload.endDate,
    code: payload.code, id_can: payload.id_can ?? payload.code,
    leaveType: payload.code,
    comment: payload.comment ?? "", COMMENT: payload.comment ?? "",
    keepState: payload.keepState,
  };

  const candidates: Array<{ m:"put"|"post"|"patch"; url:string }> = [
    { m:"put",   url:`${baseUrl()}/leave/leave-request/${id}` },
    { m:"patch", url:`${baseUrl()}/leave/leave-request/${id}` },
    { m:"post",  url:`${baseUrl()}/leave/leave-request/${id}` },

    { m:"put",   url:`${baseUrl()}/leave/leave-request` },
    { m:"patch", url:`${baseUrl()}/leave/leave-request` },
    { m:"post",  url:`${baseUrl()}/leave/leave-request` },

    { m:"post",  url:`${baseUrl()}/leave/leave-request/update` },
    { m:"post",  url:`${baseUrl()}/leave/update-leave-request` },

    // common legacy variants
    { m:"put",   url:`${baseUrl()}/leave/request/${id}` },
    { m:"patch", url:`${baseUrl()}/leave/request/${id}` },
    { m:"put",   url:`${baseUrl()}/leave/requests/${id}` },
    { m:"patch", url:`${baseUrl()}/leave/requests/${id}` },
  ];

  for (const c of candidates) {
    try {
      // @ts-ignore
      await (axios as any)[c.m](c.url, compact, { headers });
      return { ok: true };
    } catch (e:any) {
      const s = e?.response?.status;
      if (s !== 404 && s !== 405 && s !== 400) throw e;
      // keep trying
    }
  }
  return { ok: false, reason: "404" as const };
};

// ---------- Create / Update ----------
export const createLeaveRequest = async (data: {
  employeeId: string | number;
  leaveCode: number;               // TS_Codes.int_can
  leaveType?: string | number;     // optional; backend can resolve code too
  startDate: string;               // 'YYYY-MM-DD'
  endDate: string;                 // 'YYYY-MM-DD'
  reason?: string;
  contactNumber?: string;
  days?: number;
}) => {
  const headers = await getAuthHeader();
  // Backend expects: { employeeId, leaveType, startDate, endDate, reason, days }
  const payload: any = {
    employeeId: String(data.employeeId),
    leaveType: data.leaveType ?? data.leaveCode, // allow int_can or code
    startDate: data.startDate,
    endDate: data.endDate,
    reason: data.reason ?? undefined,
    days: typeof data.days === 'number' ? data.days : undefined,
  };
  const response = await axios.post(`${baseUrl()}/leave/leave-request`, payload, { headers });
  return response.data;
};

export const updateLeaveStatus = async (leaveId: string | number, status: string, comment?: string) => {
  const headers = await getAuthHeader();
  const response = await axios.put(
    `${baseUrl()}/leave/leave-status`,
    { leaveId, status, comment },
    { headers }
  );
  return response.data;
};

// ---------- Calendar / Holidays ----------
export const getCalendarLog = async (params: CalendarLogParams) => {
  const response = await axios.get(`${baseUrl()}/leave/calendar-log`, {
    params,
    headers: await getAuthHeader(),
  });
  return response.data;
};

export const getHolidays = async (params?: { startDate?: string; endDate?: string }) => {
  const response = await axios.get(`${baseUrl()}/holiday/holidays`, {
    params,
    headers: await getAuthHeader(),
  });
  return response.data;
};

export const createHoliday = async (data: {
  type: 'fixed' | 'variable';
  name: string;
  date?: string;          // required if variable
  fixedMonth?: number;    // required if fixed
  fixedDay?: number;      // required if fixed
  comment?: string;
}) => {
  const payload: any = {
    holiday_type: data.type,
    holiday_name: data.name,
    comment: data.comment ?? null,
  };
  if (data.type === 'variable') {
    payload.holiday_date = data.date;
  } else {
    payload.fixed_month = data.fixedMonth;
    payload.fixed_day = data.fixedDay;
  }

  const headers = await getAuthHeader();
  const url = `${baseUrl()}/holiday/holiday`;
  const res = await axios.post(url, payload, { headers });
  return res.data;
};

export const updateHoliday = async (
  id: number | string,
  data: { date?: string; comment?: string; in_call?: boolean; DATE_H?: string; COMMENT_H?: string; IN_CALL?: boolean }
) => {
  const headers = await getAuthHeader();
  const payload: any = {
    DATE_H: data.DATE_H ?? data.date ?? undefined,
    COMMENT_H: data.COMMENT_H ?? data.comment ?? undefined,
    IN_CALL: typeof data.IN_CALL !== 'undefined' ? !!data.IN_CALL : (typeof data.in_call !== 'undefined' ? !!data.in_call : undefined),
  };
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  const url = `${baseUrl()}/holiday/holiday/${id}`;
  const res = await axios.put(url, payload, { headers });
  return res.data;
};

export const deleteHoliday = async (id: number | string) => {
  const headers = await getAuthHeader();
  const url = `${baseUrl()}/holiday/holiday/${id}`;
  const res = await axios.delete(url, { headers });
  return res.data;
};

// ---------- Leave Types ----------
export const getLeaveTypes = async () => {
  const response = await axios.get(`${baseUrl()}/leave/leave-types`, {
    headers: await getAuthHeader(),
  });
  return response.data; // raw rows { int_can, code, desig_can, ... }
};

// ---------- Pending for ALL (uses calendar-log) ----------
export const getPendingAllInRange = async (startISO: string, endISO: string) => {
  const headers = await getAuthHeader();
  const { data } = await axios.get(`${baseUrl()}/leave/calendar-log`, {
    headers,
    params: { startDate: startISO, endDate: endISO, status: 'pending' },
  });
  const rows = data?.leaveRequests || [];
  return rows.map((r: any) => ({
    id: r.id,
    type: r.leaveTypeCode
      ? `${r.leaveTypeCode}${r.leaveTypeName ? ' - ' + r.leaveTypeName : ''}`
      : r.leaveTypeName || '',
    startDate: r.startDate,
    endDate: r.endDate,
    days: r.days,
    status: (r.status || '').toLowerCase(),
    submittedDate: r.date_creation || r.submittedDate || null,
    comments: r.comments || null,
    employeeName: r.employeeName || '',
    employeeId: r.employeeId,
  }));
};
