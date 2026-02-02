// src/api/employees.ts

export type Employee = {
  ID_EMP: number;
  NAME: string;
  PS?: number | null;
  T_START?: string | null;
  T_END?: string | null;
  STATE?: boolean | null;
  [key: string]: any; // Allow other fields
};

const API_BASE = (
  (process.env.REACT_APP_API_BASE_URL as string | undefined) ||
  (process.env.REACT_APP_API_IP as string | undefined) ||
  "http://localhost:9000/api"
).replace(/\/+$/, "");

/** Build an absolute URL from API_BASE + path */
function absolute(url: string): string {
  const path = url.startsWith("/") ? url : `/${url}`;
  // Prefer explicit API base when provided
  if (API_BASE && /^https?:\/\//i.test(API_BASE)) return `${API_BASE}${path}`;
  return path;
}

/** Auth + JSON headers */
function authHeaders(): HeadersInit {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("access_token");
  const h: HeadersInit = { Accept: "application/json", "Content-Type": "application/json" };
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

/** Heuristic: decide if an employee is active */
export function isActiveEmployee(e: any): boolean {
  try {
    // Explicit boolean fields first
    const stateLike = (e?.STATE ?? e?.state ?? e?.ACTIVE ?? e?.active ?? e?.Status ?? e?.STATUS);
    if (typeof stateLike === 'boolean') return stateLike;
    if (typeof stateLike === 'number') {
      if (stateLike === 0) return false;
      if (stateLike === 1) return true;
    }
    if (stateLike != null) {
      const s = String(stateLike).trim().toLowerCase();
      if (s === 'inactive' || s === 'false' || s === 'no' || s === '0') return false;
      if (s === 'active' || s === 'true' || s === 'yes' || s === '1') return true;
    }

    // Contract end date check (T_END / CONTRACT_END)
    const endRaw = e?.T_END ?? e?.CONTRACT_END ?? e?.contract_end ?? e?.contractEnd;
    if (endRaw) {
      const d = new Date(String(endRaw));
      if (!isNaN(d.getTime())) {
        const today = new Date();
        // End date strictly before today => inactive
        if (d.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) return false;
      }
    }
    // Default: active unless explicitly ended
    return true;
  } catch {
    return true;
  }
}

/** Convenience: list only active employees */
export async function listActiveEmployees(): Promise<Employee[]> {
  const url = absolute("/employees?state=active");
  try {
    const payload = await http<any>(url, { headers: authHeaders() });
    const list = unwrapList<Employee>(payload);
    if (Array.isArray(list) && list.length) {
      return list.filter(isActiveEmployee);
    }
  } catch (err) {
    console.warn("GET /employees?state=active failed, falling back to local filter:", err);
  }
  const fallbackList = await listEmployees();
  return (Array.isArray(fallbackList) ? fallbackList : []).filter(isActiveEmployee);
}

/** Convenience: list only inactive employees */
export async function listInactiveEmployees(): Promise<Employee[]> {
  const url = absolute("/employees?state=inactive");
  try {
    const payload = await http<any>(url, { headers: authHeaders() });
    const list = unwrapList<Employee>(payload);
    if (Array.isArray(list) && list.length) {
      return list.filter((emp) => !isActiveEmployee(emp));
    }
  } catch (err) {
    console.warn("GET /employees?state=inactive failed, falling back to local filter:", err);
  }
  const fallbackList = await listEmployees();
  return (Array.isArray(fallbackList) ? fallbackList : []).filter((emp) => !isActiveEmployee(emp));
}

/** Get a single employee by id, with graceful fallbacks */
export async function getEmployeeById(id: number): Promise<Employee | null> {
  // Some deployments do not support GET /employees/:id (404), while PATCH/PUT may still exist.
  // Cache support so we don't spam the server/console.
  // null = unknown, true = supported, false = not supported
  // eslint-disable-next-line prefer-const
  let _supports: boolean | null = (getEmployeeById as any)._supportsEmployeeByIdGet ?? null;

  // Preferred: /employees/:id
  if (_supports !== false) {
    try {
      const payload = await http<any>(absolute(`/employees/${id}`), {
        headers: authHeaders(),
      });

      (getEmployeeById as any)._supportsEmployeeByIdGet = true;

      // Some APIs wrap single objects in various shapes
      const obj =
        payload?.data?.employee ??
        payload?.employee ??
        payload?.data?.data ??
        payload?.data ??
        payload;

      if (obj && typeof obj === "object") {
        const maybe =
          (obj as any)?.data && typeof (obj as any).data === "object"
            ? (obj as any).data
            : obj;
        return maybe as Employee;
      }
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (/\b404\b/.test(msg)) {
        (getEmployeeById as any)._supportsEmployeeByIdGet = false;
      }
      // ignore; we'll fall back to list
    }
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
