// src/api/attendance.ts
export type DailyPreview = {
    employeeId: number;
    date: string; // YYYY-MM-DD
    j: string;    // P, leave code, or A
    R: string;    // L (late) or A (absent) or ''
    E: string | null; // ISO string or null
    S: string | null; // ISO string or null
    PS: number | null;
  };
  
  // Backend base URL
  // Set REACT_APP_API_BASE in .env, e.g. http://102.213.182.8:8000 or http://localhost:8000
  const API_BASE = "https://system.gaja.ly/api".replace(/\/+$/, '');
  
  function absolute(url: string): string {
    // If API_BASE is configured and absolute, use it; otherwise same-origin with leading slash
    if (API_BASE && /^https?:\/\//i.test(API_BASE)) {
      return `${API_BASE}${url.startsWith('/') ? url : `/${url}`}`;
    }
    return `${url.startsWith('/') ? url : `/${url}`}`;
  }
  
  function authHeaders(): HeadersInit {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) (h as any).Authorization = `Bearer ${token}`;
    return h;
  }
  
  export async function previewDaily(employeeId: number, date: string): Promise<DailyPreview> {
    const params = new URLSearchParams({ employeeId: String(employeeId), date });
    const url = absolute(`/attendance/preview-daily?${params.toString()}`);
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch preview');
    const json = await res.json();
    return json;
  }
  
  export async function syncMonth(employeeId: number, year: number, month: number): Promise<{ message: string; id_tran?: number; }> {
    const url = absolute(`/attendance/sync-month`);
    const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ employeeId, year, month }) });
    if (!res.ok) throw new Error('Failed to sync month');
    return res.json();
  }
  
  // ===== PS Schedule =====
  export type PsSchedule = Record<string, { start: string; end: string }>;
  export async function getPsSchedule(): Promise<PsSchedule> {
    const url = absolute('/attendance/ps-schedule');
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to load PS schedule');
    return res.json();
  }
  
  export async function updatePsSchedule(schedule: PsSchedule): Promise<{ ok: boolean; schedule: PsSchedule }> {
    const url = absolute('/attendance/ps-schedule');
    const res = await fetch(url, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(schedule) });
    if (!res.ok) throw new Error('Failed to update PS schedule');
    return res.json();
  }
  
  // ===== Manual Punch =====
  export async function manualPunch(
    employeeId: number,
    date: string,        // 'YYYY-MM-DD'
    statusCode: string | null     // e.g. 'P', 'A', 'AL', 'SL', ...
  ): Promise<{ ok: boolean; message: string; id_tran?: number; j?: string; manual?: boolean; }> {
    const url = absolute('/attendance/manual-punch');
    const body = { 
      employeeId, 
      date: date.slice(0,10), 
      statusCode,  // Changed from j to statusCode to match backend expectation
      code: statusCode  // Also include as 'code' for backward compatibility
    };
    const res = await fetch(url, { 
      method: 'PUT', 
      headers: { 
        ...authHeaders(),
        'Content-Type': 'application/json' 
      }, 
      body: JSON.stringify(body) 
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to save manual punch');
    }
    return res.json();
  }
  
  export type PsItem = { PS: number; count: number };
  
  export async function listPs(): Promise<PsItem[]> {
    const url = absolute(`/attendance/ps-list`);
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to load PS list');
    return res.json();
  }
  
  // Real PS points from Sales setup (names like OG, P0, etc.)
  export type PsPoint = { Id_point: number; name_point: string };
  export async function listPsPoints(): Promise<PsPoint[]> {
    const url = absolute('/ps/all');
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to load PS points');
    return res.json();
  }
  
  export type PsTodayRow = { id_emp: number; name: string; j: string; R: string; E: string | null; S: string | null };
  export async function psToday(ps: number): Promise<{ ps: number; date: string; employees: PsTodayRow[] }> {
    const params = new URLSearchParams({ ps: String(ps) });
    const url = absolute(`/attendance/ps-today?${params.toString()}`);
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to load PS today');
    return res.json();
  }

  // api/attendance (new or existing place)
export type UpdateAttendanceInput = {
  employeeId: number;
  date: string;          // 'YYYY-MM-DD'
  statusCode?: string;   // 'P' | 'A' | 'PT' | 'PL' | 'PH' | 'PHF'
  reason?: string;       // R
  comment?: string;
  entry?: string | null; // 'HH:mm' or 'HH:mm:ss'
  exit?: string | null;  // same
};

export async function updateAttendance(input: UpdateAttendanceInput) {
  const response = await fetch(`${API_BASE}/attendance/manual-punch`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      employeeId: input.employeeId,
      date: input.date,
      statusCode: input.statusCode ?? undefined,
      code: input.statusCode ?? undefined, // if backend accepts either
      reason: input.reason ?? undefined,
      comment: input.comment ?? undefined,
      entry: input.entry ?? undefined,
      exit: input.exit ?? undefined,
    }),
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : {};

  if (!response.ok || payload?.ok === false) {
    const msg = payload?.message || payload?.error || `HTTP ${response.status}`;
    throw new Error(msg);
  }
  return payload;
}
  
  // ===== Option B: Monthly timesheet via backend aggregation =====
  export type TimesheetDay = {
    leaveDescription: any;
    leave_description: any;
    day: number;
    code: string | null;
    reason: string | null;
    comment: string | null;
    entry: string | null; // Tripoli-local 'YYYY-MM-DDTHH:mm:ss' or null
    exit: string | null;  // Tripoli-local 'YYYY-MM-DDTHH:mm:ss' or null
    punches: string[];    // Tripoli-local strings
    workMin?: number | null;
    expectedMin?: number | null;
    deltaMin?: number | null;
    isHoliday?: boolean;
    payFactor?: number;   // 2 on holidays with presence, else 1
    present?: boolean;
  };
  
  export type TimesheetMonthResponse = {
    ok: boolean;
    meta: {
      employeeId: number;
      emp_code?: string;
      year: number;
      month: number;
      daysInMonth: number;
      PS?: number;
      Comment?: string;
      nbr_h?: number;
      nbr_DAY?: number;
      nbr_SICK?: number;
      j_absence?: string;
      Day_Shift_nbr?: number;
    };
    data: TimesheetDay[];
    raw: { tsRowId: number | null };
  };
  
  export async function getTimesheetMonth(employeeId: number, year: number, month: number): Promise<TimesheetMonthResponse> {
    const params = new URLSearchParams({ employeeId: String(employeeId), year: String(year), month: String(month) });
    const url = absolute(`/hr/timesheet?${params.toString()}`);
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to load timesheet');
    return res.json();
  }

  // Update a single day's j/R/comment in the monthly timesheet row
  export async function updateTimesheetDay(
    employeeId: number,
    ymd: string, // 'YYYY-MM-DD'
    updates: { j?: string | null; R?: string | null; comment?: string | null }
  ): Promise<{
    ok: any;
    response: any; message: string; timesheet?: any 
}> {
    const day = Number(ymd.slice(8, 10));
    if (!day || day < 1 || day > 31) throw new Error('Invalid date');
    const body: any = {
      id_emp: employeeId,
      DATE_JS: ymd, // controller buckets by month
    };
    if (updates.j !== undefined) body[`j_${day}`] = updates.j;
    if (updates.R !== undefined) body[`R_${day}`] = updates.R;
    if (updates.comment !== undefined) {
      let c = updates.comment || '';
      const prefix = `[${ymd}]`;
      if (c && !c.startsWith(prefix)) {
        c = `${prefix} ${c}`;
      }
      body[`comm${day}`] = c;
    }
    // Backend TS model has non-nullable columns Comment and nbr_h; provide safe defaults for create
    if (body.Comment === undefined) body.Comment = updates.comment ?? '';
    if (body.nbr_h === undefined) body.nbr_h = 0;
    const url = absolute('/hr/timesheet');
    const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Failed to update timesheet day');
    return res.json();
  }
  
  // ===== Date range punches for All Employees list =====
  export type RangePunchesDay = { date: string; j: string; R: string; E: string | null; S: string | null };
  export type RangePunchesEmployee = { 
    id_emp: number; 
    name: string; 
    ps: number | null; 
    T_START?: string | null;
    T_END?: string | null;
    CONTRACT_START?: string | null;
    TITLE?: string | null;
    days: RangePunchesDay[] 
  };
  export type RangePunchesResponse = { from: string; to: string; count: number; employees: RangePunchesEmployee[] };
  
  export async function rangePunches(from: string, to: string, options?: { ps?: number | ''; employeeId?: number }): Promise<RangePunchesResponse> {
    const params = new URLSearchParams({ from, to });
    if (options?.ps !== undefined && options.ps !== '') params.set('ps', String(options.ps));
    if (options?.employeeId !== undefined) params.set('employeeId', String(options.employeeId));
    const url = absolute(`/attendance/range-punches?${params.toString()}`);
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to load range punches');
    return res.json();
  }