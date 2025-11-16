import api from '../api';

export type TSCode = {
  int_can: number;
  desig_can: string;
  code: string;
  max_day: number;      // >0 => treat as "leave" code, 0 => treat as "timesheet" utility
  Rule_days: string;    // free-form rule string
};

// READ (compatible with your existing route)
export async function listTSCodes(): Promise<TSCode[]> {
  try {
    const r = await api.get('/leave/leave-types'); // your controller
    return Array.isArray(r.data) ? r.data : (r.data?.data || []);
  } catch {
    // fallback to new CRUD list if you prefer
    const r2 = await api.get('/hr/codes');
    return Array.isArray(r2.data) ? r2.data : (r2.data?.data || []);
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
