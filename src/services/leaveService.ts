import axios from "../api";
import { getAuthHeader } from '../utils/auth';

const API_URL = process.env.REACT_APP_API_IP;

interface LeaveRequestData {
  employeeId: string;
  // Prefer leaveCode (TS_Codes.int_can); leaveType kept optional for backward compatibility
  leaveCode?: number;
  leaveType?: string;
  startDate: string;
  endDate: string;
  reason: string;
  contactNumber: string;
  status: string;
  days: number;
}

interface CalendarLogParams {
  startDate: string;
  endDate: string;
  employeeId?: string | number;
  status?: string; // comma-separated list (e.g., 'Pending,Approved')
}

// Leave Balance API
export const getLeaveBalance = async (employeeId: string) => {
  const res = await axios.get(`${API_URL}/leave/leave-balance/${employeeId}`, {
    headers: await getAuthHeader(),
  });
  const d = res.data || {};

  // Normalize to the screen’s expected shape
  const total = d.annualEntitlement ?? d.totalLeaves ?? 0;
  const used  = d.used ?? d.usedLeaves ?? 0;
  const rem   = d.remaining ?? d.remainingLeaves ?? Math.max(0, total - used);

  const history = (d.leaveHistory || d.leaves || []).map((x: any) => ({
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

// Leave Requests API
export const getLeaveRequests = async (employeeId: string) => {
  const res = await axios.get(`${API_URL}/leave/leave-requests/${employeeId}`, {
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
    // expose raw identifier so UI can map to code/name
    idCan: v.id_can ?? v.idCan ?? undefined,
  }));
};


interface LeaveRequestCreateInput {
  employeeId: string;
  // Backend requires leaveType; send the TS code (e.g., 'AL'). Keep leaveCode (int_can) for compatibility.
  leaveType?: string | number;
  leaveCode: number;         // TS_Codes.int_can
  startDate: string;         // 'YYYY-MM-DD'
  endDate: string;           // 'YYYY-MM-DD'
  reason: string;
  contactNumber: string;
  days: number;
}

export const createLeaveRequest = async (data: LeaveRequestCreateInput) => {
  const response = await axios.post(`${API_URL}/leave/leave-request`, data, {
    headers: await getAuthHeader(),
  });
  return response.data;
};

export const updateLeaveStatus = async (leaveId: string, status: string, comment?: string) => {
  try {
    const response = await axios.put(
      `${API_URL}/leave/leave-status`,
      { leaveId, status, comment },
      { headers: await getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating leave status:', error);
    throw error;
  }
};

// Calendar & Holidays API
export const getCalendarLog = async (params: CalendarLogParams) => {
  try {
    const response = await axios.get(`${API_URL}/leave/calendar-log`, {
      params,
      headers: await getAuthHeader(),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching calendar log:', error);
    throw error;
  }
};

export const getHolidays = async () => {
  try {
    const response = await axios.get(`${API_URL}/leave/holidays`, {
      headers: await getAuthHeader(),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching holidays:', error);
    throw error;
  }
};

export const createHoliday = async (data: { date: string; name: string; type: string }) => {
  try {
    const response = await axios.post(
      `${API_URL}/leave/holiday`,
      { holiday_date: data.date, holiday_name: data.name, holiday_type: data.type },
      { headers: await getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    console.error('Error creating holiday:', error);
    throw error;
  }
};

// Leave Types API
export const getLeaveTypes = async () => {
  try {
    const response = await axios.get(`${API_URL}/leave/leave-types`, {
      headers: await getAuthHeader(),
    });

    // Return raw rows so components expecting { int_can, desig_can, code, max_day, Rule_days } work as-is
    return response.data;
  } catch (error) {
    console.error('Error fetching leave types:', error);
    throw error;
  }
};
