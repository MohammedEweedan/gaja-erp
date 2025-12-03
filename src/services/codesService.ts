import api from '../api';

export type TSCode = {
  int_can: number;
  desig_can: string;
  code: string;
  max_day: number;      // >0 => treat as "leave" code, 0 => treat as "timesheet" utility
  Rule_days: string;    // free-form rule string
  // Optional explicit columns (may be absent on older endpoints)
  description?: string | null;
  color?: string | null;
  food_allowance?: boolean;
  comm_allowance?: boolean;
  trans_allowance?: boolean;
};

// READ (compatible with your existing route)
export async function listTSCodes(): Promise<TSCode[]> {
  // Prefer /hr/codes to get explicit columns; fallback to /leave/leave-types
  try {
    const r2 = await api.get('/hr/codes');
    return Array.isArray(r2.data) ? r2.data : (r2.data?.data || []);
  } catch {
    const r = await api.get('/leave/leave-types');
    return Array.isArray(r.data) ? r.data : (r.data?.data || []);
  }
}

// CREATE
export async function createTSCode(payload: Partial<TSCode>): Promise<TSCode> {
  const r = await api.post('/hr/codes', payload);
  return r.data;
}

// UPDATE
export async function updateTSCode(id: number, payload: Partial<TSCode>): Promise<TSCode> {
  const r = await api.put(`/hr/codes/${id}`, payload);
  return r.data;
}

// DELETE
export async function deleteTSCode(id: number): Promise<void> {
  await api.delete(`/hr/codes/${id}`);
}
