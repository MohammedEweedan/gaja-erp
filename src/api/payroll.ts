// src/api/payroll.ts

export type PayrollRunParams = {
  year: number;
  month: number; // 1..12
  ps?: number | null;
  employeeId?: number | null;
};

export type PayslipComponent = {
  basePay: number;
  holidayOvertime: number;
  allowancePay: number;
  adjustments?: {
    bonus: number;
    deduction: number;
    advance: number;
    loanPayment: number;
  };
};

export type Payslip = {
  ok?: boolean;
  id_emp: number;
  name: string;
  PS: number | null;
  baseSalary: number;
  baseSalaryUsd?: number;
  allowancePerDay: number;
  workingDays: number;
  deductionDays: number;
  presentWorkdays: number;
  holidayCount: number;
  holidayWorked: number;
  leaveSummary: Record<string, number>;
  components: PayslipComponent;
  total: number;
  year?: number;
  month?: number;
  foodDays?: number;
  factorSum?: number;
  designation?: string | null;
  costCenter?: string | null;
};

export type PayrollRunResponse = {
  ok: boolean;
  year: number;
  month: number;
  period: { start: string; end: string };
  count: number;
  employees: Payslip[];
};

const API_BASE = "http://localhost:9000".replace(/\/+$/, "");

function absolute(url: string): string {
  if (API_BASE && /^https?:\/\//i.test(API_BASE)) {
    return `${API_BASE}${url.startsWith('/') ? url : `/${url}`}`;
  }
  return `${url.startsWith('/') ? url : `/${url}`}`;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || localStorage.getItem('access_token');
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) (h as any).Authorization = `Bearer ${token}`;
  return h;
}

export async function runPayroll(params: PayrollRunParams): Promise<PayrollRunResponse> {
  const url = absolute('/hr/payroll/run');
  const body: any = { year: params.year, month: params.month };
  if (params.ps != null) body.ps = params.ps;
  if (params.employeeId != null) body.employeeId = params.employeeId;
  const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error('Failed to run payroll, please check your variables');
  return res.json();
}

export async function getPayslip(employeeId: number, year: number, month: number): Promise<Payslip> {
  const q = new URLSearchParams({ employeeId: String(employeeId), year: String(year), month: String(month) });
  const url = absolute(`/hr/payroll/payslip?${q.toString()}`);
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch payslip, please check your variables');
  return res.json();
}

export function payslipPdfUrl(employeeId: number, year: number, month: number): string {
  const q = new URLSearchParams({ employeeId: String(employeeId), year: String(year), month: String(month) });
  return absolute(`/hr/payroll/payslip/pdf?${q.toString()}`);
}

export async function sendPayslip(params: { employeeId: number; year: number; month: number; to?: string }): Promise<{ ok: boolean; sentTo: string }>{
  const url = absolute('/hr/payroll/send-payslip');
  const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: JSON.stringify(params) });
  if (!res.ok) throw new Error('Failed to send payslip, please check your variables');
  return res.json();
}

export async function sendPayslipClient(payload: { employeeId?: number; year?: number; month?: number; to?: string; subject?: string; html?: string; pdfBase64: string; filename?: string }): Promise<{ ok: boolean; sentTo: string }> {
  const url = absolute('/hr/payroll/send-payslip-client');
  const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to send payslip');
  return res.json();
}

export async function computePayrollV2(params: { year: number; month: number; ps?: number | null; employeeId?: number | null }): Promise<any> {
  const q = new URLSearchParams({ year: String(params.year), month: String(params.month) });
  if (params.ps != null) q.set('ps', String(params.ps));
  if (params.employeeId != null) q.set('employeeId', String(params.employeeId));
  const url = absolute(`/hr/payroll/v2/compute?${q.toString()}`);
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to compute payroll, please check your variables');
  return res.json();
}

export async function getPayrollV2(year: number, month: number): Promise<any> {
  const q = new URLSearchParams({ year: String(year), month: String(month) });
  const url = absolute(`/hr/payroll/v2?${q.toString()}`);
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load payroll, please check your variables');
  return res.json();
}

export async function savePayrollV2(payload: { year: number; month: number; rows: any[] }): Promise<any> {
  const url = absolute('/hr/payroll/v2/save');
  const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to save payroll, please check your variables');
  return res.json();
}

export async function closePayrollV2(payload: { year: number; month: number; bankAcc: string; salaryExpenseAcc: string; note?: string }): Promise<any> {
  const url = absolute('/hr/payroll/v2/close');
  const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to close payroll, please check your variables');
  return res.json();
}

export async function listV2Loans(employeeId?: number): Promise<any> {
  const q = new URLSearchParams();
  if (employeeId != null) q.set('employeeId', String(employeeId));
  const url = absolute(`/hr/payroll/v2/loans${q.toString() ? `?${q.toString()}` : ''}`);
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to list loans, please check your variables');
  return res.json();
}

export async function createV2Loan(payload: { employeeId: number; principal: number; startYear: number; startMonth: number; monthlyPercent?: number; capMultiple?: number; note?: string }): Promise<any> {
  const url = absolute('/hr/payroll/v2/loans/create');
  const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to create a loan, please check your variables');
  return res.json();
}

export async function skipV2LoanMonth(payload: { loanId?: number; employeeId?: number; year: number; month: number }): Promise<any> {
  const url = absolute('/hr/payroll/v2/loans/skip');
  const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to skip month for a loan, please check your variables');
  return res.json();
}

export async function payoffV2Loan(payload: { loanId?: number; employeeId?: number; amount?: number }): Promise<any> {
  const url = absolute('/hr/payroll/v2/loans/payoff');
  const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to payoff a loan, please check your variables');
  return res.json();
}
