import axios from 'axios';
import { getAuthHeader } from '../utils/auth';

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

// ---------- Leave Balance ----------
export const getLeaveBalance = async (employeeId: string) => {
  const res = await axios.get(`${baseUrl()}/leave/leave-balance/${employeeId}`, {
    headers: await getAuthHeader(),
  });
  const d = res.data || {};

  // normalize
  const total = d.annualEntitlement ?? d.totalLeaves ?? 0;
  const used  = d.used ?? d.usedLeaves ?? 0;
  const rem   = d.remaining ?? d.remainingLeaves ?? Math.max(0, total - used);

  const rawHistory = Array.isArray(d.leaveHistory)
    ? d.leaveHistory
    : (Array.isArray(d.leaves) ? d.leaves : []);
  const history = rawHistory.map((x: any) => ({
    id: x.ID_LEAVE ?? x.int_con ?? x.id,
    type: x.LEAVE_TYPE ?? x.leaveTypeName ?? x.leaveTypeCode ?? x.type ?? 'annual',
    startDate: x.DATE_START ?? x.startDate ?? x.date_depart,
    endDate:   x.DATE_END   ?? x.endDate   ?? x.date_end,
    days: x.NUM_DAYS ?? x.nbr_jour ?? x.days ?? 0,
    status: (x.STATUS ?? x.state ?? x.status ?? 'pending').toLowerCase(),
  }));

  return {
    entitlement: total,
    used,
    remaining: rem,
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
