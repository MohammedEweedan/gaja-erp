// src/api/vacations.ts
const API_BASE = (process.env.REACT_APP_API_IP || '').replace(/\/+$/, '');

function absolute(url: string): string {
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

export type VacationRecord = {
  id_can: number;
  id_emp: number;
  date_depart: string; // ISO date
  date_end: string;    // ISO date
  state: string;       // 'Approved', 'Pending', 'Rejected'
  type?: string;
  comment?: string;
  effectiveDays?: number | null;
  excluded?: any | null;
};

export async function getVacationsInRange(from: string, to: string): Promise<VacationRecord[]> {
  const params = new URLSearchParams({ from, to });
  const url = absolute(`/leave/vacations-range?${params.toString()}`);
  console.log('[getVacationsInRange] Fetching:', url);
  const res = await fetch(url, { headers: authHeaders() });
  console.log('[getVacationsInRange] Response status:', res.status);
  if (!res.ok) {
    const text = await res.text();
    console.error('[getVacationsInRange] Error response:', text);
    throw new Error(`Failed to load vacations: ${res.status} ${text}`);
  }
  const data = await res.json();
  console.log('[getVacationsInRange] Success, got', data.length, 'records');
  return data;
}
