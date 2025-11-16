// src/api/employees.ts

export type Employee = {
  ID_EMP: number;
  NAME: string;
  PS?: number | null;
  T_START?: string | null;
  T_END?: string | null;
  [key: string]: any; // Allow other fields
};

const API_BASE = (process.env.REACT_APP_API_IP || "").replace(/\/+$/, "");

/** Build an absolute URL from API_BASE + path */
function absolute(url: string): string {
  const path = url.startsWith("/") ? url : `/${url}`;
  if (API_BASE && /^https?:\/\//i.test(API_BASE)) return `${API_BASE}${path}`;
  return path;
}

/** Auth + JSON headers */
function authHeaders(): HeadersInit {
  const token =
    localStorage.getItem("token") || localStorage.getItem("accessToken");
  const h: HeadersInit = { Accept: "application/json" };
  if (token) (h as any).Authorization = `Bearer ${token}`;
  return h;
}

/** Unified fetch with useful error text */
async function http<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.message || JSON.stringify(j);
    } catch {
      try {
        detail = await res.text();
      } catch {
        // ignore
      }
    }
    throw new Error(
      `HTTP ${res.status} ${res.statusText}${
        detail ? ` — ${truncate(detail, 500)}` : ""
      }`
    );
  }
  // some endpoints may return 204 on success
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

function truncate(s: string, n: number) {
  return s && s.length > n ? `${s.slice(0, n)}…` : s;
}

/** Many backends return either an array or { data: [] } */
function unwrapList<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

/** Try to parse HH:mm or HH:mm:ss. Returns "HH:mm:ss" or null if blank/invalid */
function normalizeTime(v?: string | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  return null; // invalid format -> let caller decide how to handle
}

/** List employees (unfiltered) */
export async function listEmployees(): Promise<Employee[]> {
  const url = absolute("/employees");
  const payload = await http<any>(url, { headers: authHeaders() });
  return unwrapList<Employee>(payload);
}

/** Get a single employee by id, with graceful fallbacks */
export async function getEmployeeById(id: number): Promise<Employee | null> {
  // Preferred: /employees/:id
  try {
    const payload = await http<any>(absolute(`/employees/${id}`), {
      headers: authHeaders(),
    });
    // Some APIs also wrap single objects in { data: {...} }
    const obj = payload?.data ?? payload;
    if (obj && typeof obj === "object") return obj as Employee;
  } catch {
    // ignore; we'll fall back to list
  }

  // Fallback: search in full list (costly, but last-resort)
  try {
    const list = await listEmployees();
    return list.find((e) => Number(e.ID_EMP) === Number(id)) || null;
  } catch {
    return null;
  }
}

/** General update helper: tries PATCH; on 405/400 requiring NAME, fetches NAME and PUTs */
export async function updateEmployee(
  id: number,
  patch: Partial<Employee>
): Promise<void> {
  const url = absolute(`/employees/${id}`);

  // First attempt: PATCH with only provided fields
  try {
    await http<void>(url, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    return;
  } catch (err: any) {
    // If PATCH not allowed or backend demands full body/NAME, fall through
    const msg = String(err?.message || "");
    const needsPut =
      /405|method not allowed|unsupported/i.test(msg) ||
      /must include.*name|requires.*name/i.test(msg) ||
      /400/i.test(msg);

    if (!needsPut) throw err;
  }

  // Fallback: fetch the employee to include NAME (many backends require it on PUT)
  const emp = await getEmployeeById(id);
  if (!emp || !emp.NAME) {
    throw new Error("Cannot update employee: NAME not found for PUT fallback");
  }

  const body = { ...patch, NAME: emp.NAME };
  await http<void>(url, {
    method: "PUT",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Update T_START / T_END safely.
 * - Accepts 'HH:mm' or 'HH:mm:ss' (converts to HH:mm:ss)
 * - Uses PATCH if available; otherwise falls back to PUT + NAME automatically.
 */
export async function updateEmployeeTimes(
  id: number,
  times: { T_START?: string | null; T_END?: string | null }
): Promise<void> {
  const payload: Partial<Employee> = {};
  if ("T_START" in times) payload.T_START = normalizeTime(times.T_START);
  if ("T_END" in times) payload.T_END = normalizeTime(times.T_END);

  // If both are undefined, nothing to do
  if (!("T_START" in payload) && !("T_END" in payload)) return;

  await updateEmployee(id, payload);
}
