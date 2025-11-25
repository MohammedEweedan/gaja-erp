import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  MenuItem,
  Button,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Tabs,
  Tab,
  TableSortLabel,
  TableContainer,
  Menu,
  FormControlLabel,
  Checkbox,
  Tooltip,
  IconButton,
  Avatar,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import type { PayrollRunResponse, Payslip } from "../../api/payroll";
import { updateEmployee, listEmployees } from "../../api/employees";
import { runPayroll, sendPayslipClient, computePayrollV2, savePayrollV2, closePayrollV2, listV2Loans, createV2Loan, skipV2LoanMonth, payoffV2Loan } from "../../api/payroll";
import type { TimesheetDay } from "../../api/attendance";
import { getTimesheetMonth, listPs, PsItem, listPsPoints } from "../../api/attendance";
import jsPDF from "jspdf";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import SettingsIcon from "@mui/icons-material/Settings";

// Format PS as codes: keep OG/HQ, turn numerals into P#
function formatPs(ps: any): string | undefined {
  if (ps == null || ps === "") return undefined;
  const s = String(ps).trim();
  if (!s) return undefined;
  const sUp = s.toUpperCase();
  if (/^P\d+$/.test(sUp)) return sUp;
  if (/^\d+$/.test(s)) return `P${s}`;
  return sUp;
}

function useNowYM() {
  const now = dayjs();
  return { year: now.year(), month: now.month() + 1 };
}

const months = Array.from({ length: 12 }, (_, i) => i + 1);
const years = Array.from({ length: 7 }, (_, i) => dayjs().year() - 3 + i);

export default function PayrollPage() {
  const { t } = useTranslation();
  const { year: y, month: m } = useNowYM();
  const [year, setYear] = React.useState<number>(y);
  const [month, setMonth] = React.useState<number>(m);
  const [ps, setPs] = React.useState<string>("");
  const [usdToLyd] = React.useState<number>(0); // exchange removed; keep value for PDF logic
  const [psOptions, setPsOptions] = React.useState<PsItem[]>([]);
  const [psPoints, setPsPoints] = React.useState<Record<number, string>>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [colsAnchor, setColsAnchor] = React.useState<null | HTMLElement>(null);
  const [result, setResult] = React.useState<PayrollRunResponse | null>(null);
  const [v2Rows, setV2Rows] = React.useState<any[]>([]);
  const [viewOnly, setViewOnly] = React.useState<boolean>(false);

  const [calOpen, setCalOpen] = React.useState(false);
  const [calEmp, setCalEmp] = React.useState<{ id_emp: number; name: string } | null>(null);
  const [calDays, setCalDays] = React.useState<TimesheetDay[] | null>(null);
  const [calLoading, setCalLoading] = React.useState(false);

  // Adjustments dialog state
  const [adjOpen, setAdjOpen] = React.useState(false);
  const [adjLoading, setAdjLoading] = React.useState(false);
  const [adjEmpId, setAdjEmpId] = React.useState<number | null>(null);
  const [adjRows, setAdjRows] = React.useState<Array<{ type: string; amount: number; currency: string; note?: string; ts?: string }>>([]);
  const [adjForm, setAdjForm] = React.useState<{ type: string; amount: string; currency: string; note: string }>({ type: "bonus", amount: "", currency: "LYD", note: "" });

  const [bdOpen, setBdOpen] = React.useState(false);
  const [bdEmp, setBdEmp] = React.useState<Payslip | null>(null);
  const [bdLines, setBdLines] = React.useState<Array<{ label: string; lyd: number; usd: number; note?: string }>>([]);
  const [bdShowLyd, setBdShowLyd] = React.useState<boolean>(true);
  const [bdShowUsd, setBdShowUsd] = React.useState<boolean>(false);

  // Loans & History state
  const [loanRows, setLoanRows] = React.useState<any[]>([]);
  const [payoffOpen, setPayoffOpen] = React.useState(false);
  const [payoffAmt, setPayoffAmt] = React.useState<string>("");
  const [activeLoan, setActiveLoan] = React.useState<any | null>(null);
  const [historyPoints, setHistoryPoints] = React.useState<Array<{ year: number; month: number; total: number }>>([]);

  // Sales metrics per employee (qty, total_lyd)
  const [sales, setSales] = React.useState<Record<string, { qty: number; total_lyd: number }>>({});

  // Payroll table UI state
  const [tab, setTab] = React.useState<'payroll'|'advances'|'loans'|'settings'>('payroll');
  const [filterText, setFilterText] = React.useState<string>('');
  const [sortKey, setSortKey] = React.useState<string>('name');
  const [sortDir, setSortDir] = React.useState<'asc'|'desc'>('asc');
  const [cols, setCols] = React.useState({
    presentWorkdays: true,
    holidayWorked: true,
    baseSalary: true,
    food: true,
    fuel: true,
    comm: true,
    basePay: true,
    allowancePay: true,
    adjustments: true,
    salesQty: false,
    salesTotal: false,
    gold: true,
    diamond: true,
    totalUsd: true,
  });
  const [loanAmount, setLoanAmount] = React.useState<string>("");
  const [existingAdvances, setExistingAdvances] = React.useState<number>(0);
  const [presentDaysMap, setPresentDaysMap] = React.useState<Record<number, number>>({});
  const [tsAgg, setTsAgg] = React.useState<Record<number, { presentP: number; phUnits: number; fridayA: number; missRatio: number }>>({});
  const [advMap, setAdvMap] = React.useState<Record<number, number>>({});
  const [contractStartMap, setContractStartMap] = React.useState<Record<number, string | null>>({});
  const [hrEmails, setHrEmails] = React.useState<string>(() => {
    try { return localStorage.getItem('payroll_settings_hr_emails') || ''; } catch { return ''; }
  });
  const [financeEmails, setFinanceEmails] = React.useState<string>(() => {
    try { return localStorage.getItem('payroll_settings_finance_emails') || ''; } catch { return ''; }
  });
  const [isAdmin, setIsAdmin] = React.useState<boolean>(false);
  const [commList, setCommList] = React.useState<any[]>([]);
  const [commLoading, setCommLoading] = React.useState<boolean>(false);
  const [commDirty, setCommDirty] = React.useState<Record<number, any>>({});

  // Consistent NET calculator (matches PDF logic). Returns non-negative LYD.
  function computeNetLYDFor(id_emp: number): number {
    try {
      const emp = (result?.employees || []).find((e) => Number(e.id_emp) === Number(id_emp));
      const v2 = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(id_emp)) || ({} as any);
      if (!emp) return 0;
      const agg = tsAgg[id_emp] || { presentP: 0, phUnits: 0, fridayA: 0, missRatio: 1 };
      const W = Math.max(1, Number(emp.workingDays || (v2 as any).workingDays || 0) || 1);
      const base = Math.max(0, Number(v2.base_salary_lyd || emp.baseSalary || 0));
      const dailyLyd = W > 0 ? base / W : 0;
      const ph = Math.max(0, Number(v2.ph_lyd || (agg.phUnits > 0 ? dailyLyd * agg.phUnits : 0)));
      let absence = Math.max(0, Number(v2.absence_lyd || 0));
      if (agg.fridayA > 0 && dailyLyd > 0) absence = Math.max(0, Number((absence - dailyLyd * agg.fridayA).toFixed(2)));
      const missingV2 = Math.max(0, Number(v2.missing_lyd || 0));
      const missing = Number((missingV2 * (agg.missRatio || 0)).toFixed(2));
      const gold = Math.max(0, Number(v2.gold_bonus_lyd || 0));
      const dia = Math.max(0, Number(v2.diamond_bonus_lyd || 0));
      const otherAdds = Math.max(0, Number(v2.other_additions_lyd || 0));
      const loanPay = Math.max(0, Number(v2.loan_credit_lyd || (emp.components?.adjustments as any)?.loanPayment || 0));
      const adv = Math.max(0, Number(advMap[id_emp] || 0));
      const otherDedRaw = Math.max(0, Number(v2.other_deductions_lyd || 0));
      const otherDedExAdv = Math.max(0, otherDedRaw - adv);
      // Food allowance adjusted to present P days
      let per = Number((emp as any).FOOD || (emp as any).FOOD_ALLOWANCE || 0);
      if (!per) {
        const totalFood = Number(v2.wd_food_lyd || 0);
        per = totalFood && W ? totalFood / W : 0;
      }
      const present = Number(tsAgg[id_emp]?.presentP ?? emp.presentWorkdays ?? 0) || 0;
      const foodAdj = Math.max(0, Number((per * present).toFixed(2)));
      // Transportation (FUEL) and Communication allowances — per working day
      const fuelPer = Number(((emp as any).FUEL ?? (v2 as any).FUEL) || 0);
      const commPer = Number(((emp as any).COMMUNICATION ?? (v2 as any).COMMUNICATION) || 0);
      const transportAdj = Math.max(0, Number((fuelPer * W).toFixed(2)));
      const commAdj = Math.max(0, Number((commPer * W).toFixed(2)));
      const net = base + ph + foodAdj + transportAdj + commAdj + gold + dia + otherAdds - absence - missing - adv - loanPay - otherDedExAdv;
      return Math.max(0, Number(net.toFixed(2)));
    } catch { return 0; }
  }

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  // Classify attendance badge for a day
  function codeBadge(day?: any, schStartMin?: number | null, schEndMin?: number | null): string {
    if (!day) return 'A';
    const present = !!day.present;
    const rawCode = String(day.code || day.badge || '').toUpperCase();
    if (rawCode) return rawCode;
    const isHoliday = !!day.isHoliday || /holiday/i.test(String(day.type||day.reason||'')) || rawCode === 'PH' || rawCode === 'PHF';
    const parseMin = (s: any): number | null => {
      if (!s) return null;
      const txt = String(s);
      const m = txt.match(/(\d{1,2}):(\d{2})/);
      if (!m) return null;
      const hh = Number(m[1]); const mm = Number(m[2]);
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
      return hh * 60 + mm;
    };
    const expStart = parseMin(day.T_START || day.t_start) ?? (schStartMin ?? 9*60);
    const expEnd = parseMin(day.T_END || day.t_end) ?? (schEndMin ?? ((schStartMin ?? 9*60) + 8*60));
    const expDur = Math.max(0, expEnd - expStart);
    const entryMin = parseMin(day.entry);
    const exitMin = parseMin(day.exit);
    const worked = (entryMin != null && exitMin != null && exitMin > entryMin) ? (exitMin - entryMin) : 0;
    const late = (entryMin != null) ? Math.max(0, entryMin - expStart) : 0;
    const miss = Number(day.deltaMin || 0) < 0 ? Math.abs(Number(day.deltaMin||0)) : 0;
    const tol = 5; // minutes tolerance
    if (!present) return 'A';
    if (isHoliday) {
      return (worked >= Math.max(0, expDur - tol)) ? 'PHF' : 'PH';
    }
    if (late > tol) return 'PL';
    if (miss > tol) return 'PT';
    return 'P';
  }

  // Auto-load data when tabs change
  React.useEffect(() => {
    if ((tab === 'loans' || tab === 'advances') && adjEmpId) {
      (async () => {
        if (tab === 'loans') {
          try {
            const js = await listV2Loans(adjEmpId);
            setLoanRows(js?.rows || []);
          } catch {}
        }
        if (tab === 'advances') {
          try {
            const url = `http://localhost:9000/hr/payroll/adjustments?year=${year}&month=${month}&employeeId=${adjEmpId}`;
            const res = await fetch(url, { headers: authHeader() as unknown as HeadersInit });
            if (res.ok) {
              const js = await res.json();
              const advs = (js?.data?.[String(adjEmpId)] || []).filter((a: any) => a.type === 'advance');
              const total = advs.reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0);
              setExistingAdvances(total);
            }
          } catch {}
        }
        try {
          const q = new URLSearchParams({ employeeId: String(adjEmpId) });
          const res = await fetch(`http://localhost:9000/hr/payroll/history/total?${q.toString()}`, { headers: authHeader() as unknown as HeadersInit });
          const js = await res.json();
          if (res.ok) setHistoryPoints(Array.isArray(js?.points) ? js.points : []);
          else setHistoryPoints([]);
        } catch { setHistoryPoints([]); }
      })();
    }
  }, [tab, adjEmpId, year, month]);

  // Dynamic table min width for horizontal scrolling based on visible columns
  const tableMinWidth = React.useMemo(() => {
    let w = 0;
    w += 180; // Employee
    w += 64; // Working Days
    w += 64; // Deduction Days
    if (cols.presentWorkdays) w += 64;
    if (cols.holidayWorked) w += 64;
    if (cols.baseSalary) w += 80;
    if (cols.food) w += 72;
    if (cols.fuel) w += 72;
    if (cols.comm) w += 72;
    if (cols.basePay) w += 84;
    if (cols.allowancePay) w += 84;
    if (cols.adjustments) w += 72;
    if (cols.salesQty) w += 64;
    if (cols.salesTotal) w += 84;
    if (cols.gold) w += 96;
    if (cols.diamond) w += 96;
    w += 96; // Total (LYD)
    if (cols.totalUsd) w += 84; // Total (USD)
    w += 220; // Actions
    return Math.max(1100, w);
  }, [cols]);

  const authHeader = (): Record<string, string> => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || localStorage.getItem('access_token') || '';
      return token ? { Authorization: `Bearer ${token}` } : {} as Record<string, string>;
    } catch { return {} as Record<string, string>; }
  };

  const openBreakdown = async (empRow: Payslip) => {
    try {
      const v2 = (v2Rows || []).find((x:any) => Number(x.id_emp) === Number(empRow.id_emp)) || {} as any;
      const days = await ensureTimesheetDays(empRow.id_emp);
      const missMin = days.reduce((acc, d) => acc + (((d?.deltaMin ?? 0) < 0 && codeBadge(d) !== 'PT') ? Math.abs(d!.deltaMin!) : 0), 0);
      const missH = Math.floor(missMin / 60);
      const missM = Math.floor(missMin % 60);
      const missStr = (missH||missM) ? `${String(missH)}h${missM?` ${String(missM)}m`:''}` : '';
      const bv = (n:any)=>Number(n||0);
      const lines: Array<{ label: string; lyd: number; usd: number; note?: string }> = [
        { label: 'bs', lyd: bv(v2.base_salary_lyd), usd: bv(v2.base_salary_usd) },
        { label: 'wd (food)', lyd: bv(v2.wd_food_lyd), usd: bv(v2.wd_food_usd), note: String(v2.food_days || empRow.workingDays || '') },
        { label: 'absence day', lyd: bv(v2.absence_lyd), usd: bv(v2.absence_usd), note: String(v2.absence_days || '') },
        { label: 'ph', lyd: bv(v2.ph_lyd), usd: bv(v2.ph_usd), note: String(v2.ph_days || '') },
        { label: 'missing hour', lyd: bv(v2.missing_lyd), usd: bv(v2.missing_usd), note: missStr },
        { label: 'total salary', lyd: bv(v2.total_salary_lyd ?? v2.D7), usd: bv(v2.total_salary_usd ?? v2.C7) },
        { label: 'gold bonus', lyd: bv(v2.gold_bonus_lyd), usd: bv(v2.gold_bonus_usd) },
        { label: 'diamond bonus', lyd: bv(v2.diamond_bonus_lyd), usd: bv(v2.diamond_bonus_usd) },
        { label: 'other bonus 1', lyd: bv(v2.other_bonus1_lyd), usd: bv(v2.other_bonus1_usd), note: v2.other_bonus1_acc ? String(v2.other_bonus1_acc) : '' },
        { label: 'other bonus 2', lyd: bv(v2.other_bonus2_lyd), usd: bv(v2.other_bonus2_usd), note: v2.other_bonus2_acc ? String(v2.other_bonus2_acc) : '' },
        { label: 'loan (debit)', lyd: bv(v2.loan_debit_lyd), usd: bv(v2.loan_debit_usd) },
        { label: 'loan (credit)', lyd: bv(v2.loan_credit_lyd), usd: bv(v2.loan_credit_usd) },
        { label: 'other addit.', lyd: bv(v2.other_additions_lyd), usd: bv(v2.other_additions_usd) },
        { label: 'other deduct.', lyd: bv(v2.other_deductions_lyd), usd: bv(v2.other_deductions_usd) },
        { label: 'net salary', lyd: bv(v2.net_salary_lyd ?? v2.D16), usd: bv(v2.net_salary_usd ?? v2.C16) },
      ];
      let sL = Number(v2.base_salary_lyd || 0) > 0;
      let sU = Number(v2.base_salary_usd || 0) > 0;
      if (!sL && !sU) sL = true;
      const rows = lines.filter(r => ((sL && Number(r.lyd||0) > 0) || (sU && Number(r.usd||0) > 0)));
      setBdEmp(empRow);
      setBdLines(rows);
      setBdShowLyd(sL);
      setBdShowUsd(sU);
      setBdOpen(true);
    } catch {
      setBdEmp(empRow);
      setBdLines([]);
      setBdOpen(true);
    }
  };

  const openAdjust = async (empRow: Payslip) => {
    const id_emp = empRow.id_emp;
    setAdjOpen(true); setAdjLoading(true); setAdjEmpId(id_emp);
    try {
      const url = `http://localhost:9000/hr/payroll/adjustments?year=${year}&month=${month}&employeeId=${id_emp}`;
      const res = await fetch(url, { headers: authHeader() as unknown as HeadersInit });
      if (res.ok) {
        const js = await res.json();
        const data = js?.data || {};
        const rows = data[String(id_emp)] || [];
        setAdjRows(rows);
      } else {
        setAdjRows([]);
      }
    } catch {
      setAdjRows([]);
    } finally { setAdjLoading(false); }
  };

  const addAdjustment = async () => {
    if (!adjEmpId) return;
    if (!adjForm.amount) { alert('Amount required'); return; }
    setAdjLoading(true);
    try {
      const payload = { year, month, employeeId: adjEmpId, type: adjForm.type, amount: Number(adjForm.amount), currency: adjForm.currency, note: adjForm.note };
      const res = await fetch(`http://localhost:9000/hr/payroll/adjustments`, { method: 'POST', headers: ({ 'Content-Type': 'application/json', ...authHeader() } as unknown as HeadersInit), body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to add adjustment');
      const js = await res.json();
      setAdjRows(prev => [...prev, js.entry]);
      setAdjForm({ type: 'bonus', amount: '', currency: 'LYD', note: '' });
      await onRun();
    } catch (e: any) {
      alert(e?.message || 'Failed to add');
    } finally { setAdjLoading(false); }
  };

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await listPs();
        if (mounted) setPsOptions(rows || []);
      } catch {}
      try {
        const pts = await listPsPoints();
        const map: Record<number, string> = {};
        (pts || []).forEach((p: any) => {
          const id = Number(p?.Id_point ?? p?.PS ?? NaN);
          const name = String(p?.name_point || '').trim();
          if (Number.isFinite(id) && name) map[id] = name;
        });
        if (mounted) setPsPoints(map);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  // Auto-run payroll whenever year/month/ps changes
  React.useEffect(() => {
    onRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, ps]);

  // Fetch sales metrics for the current window
  const fetchSales = React.useCallback(async () => {
    try {
      const url = `http://localhost:9000/hr/payroll/sales-metrics?year=${year}&month=${month}`;
      const res = await fetch(url, { headers: authHeader() as unknown as HeadersInit });
      if (!res.ok) return setSales({});
      const js = await res.json();
      const map: Record<string, { qty: number; total_lyd: number }> = {};
      (js.rows || []).forEach((r: any) => {
        const key = String(r.usr);
        map[key] = { qty: Number(r.qty || 0), total_lyd: Number(r.total_lyd || 0) };
      });
      setSales(map);
    } catch { setSales({}); }
  }, [year, month]);
  React.useEffect(() => { fetchSales(); }, [fetchSales]);

  React.useEffect(() => {
    let flag = false;
    try {
      const u = localStorage.getItem('user');
      if (u) {
        const obj = JSON.parse(u);
        const roles = obj?.Prvilege || obj?.roles || obj?.Roles || obj?.role || '';
        if (Array.isArray(roles)) flag = roles.some((r: any) => String(r).toUpperCase().includes('ROLE_ADMIN') || String(r).toLowerCase()==='admin');
        else if (typeof roles === 'string') flag = roles.toUpperCase().includes('ROLE_ADMIN') || roles.toLowerCase()==='admin';
      }
    } catch {}
    setIsAdmin(flag);
  }, []);

  React.useEffect(() => {
    if (!isAdmin && tab === 'settings') {
      setTab('payroll');
    }
  }, [isAdmin, tab]);

  React.useEffect(() => {
    if (tab === 'settings' && isAdmin) {
      setCommLoading(true);
      (async () => {
        try {
          const res = await fetch(`http://localhost:9000/employees`, { headers: authHeader() as unknown as HeadersInit });
          if (res.ok) {
            const js = await res.json();
            const arr: any[] = Array.isArray(js) ? js : (Array.isArray(js?.data) ? js.data : []);
            const roleKeys = ['sales_rep','senior_sales_rep','sales_lead','sales_manager'];
            const list = arr.map((e: any) => {
              let role = '';
              let ps: number[] = [];
              try { const jd = e?.JOB_DESCRIPTION ? JSON.parse(e.JOB_DESCRIPTION) : {}; role = String(jd?.__commissions__?.role || '').toLowerCase(); const psArr = jd?.__commissions__?.ps; if (Array.isArray(psArr)) ps = psArr.map((x:any)=>Number(x)).filter((n:number)=>Number.isFinite(n)); } catch {}
              return { id: Number(e.ID_EMP || e.id_emp || e.id), name: e.NAME || e.name, role, ps, GOLD_COMM: e.GOLD_COMM ?? e.gold_comm ?? '', GOLD_COMM_VALUE: e.GOLD_COMM_VALUE ?? null, DIAMOND_COMM_TYPE: e.DIAMOND_COMM_TYPE ?? e.diamond_comm_type ?? '', DIAMOND_COMM: e.DIAMOND_COMM ?? null };
            }).filter((r:any)=> roleKeys.includes(r.role));
            setCommList(list);
          }
        } catch {}
        setCommLoading(false);
      })();
    }
  }, [tab, isAdmin]);

  // Load precise present days from timesheets for exact Food Allowance parity with PDF
  React.useEffect(() => {
    (async () => {
      try {
        const emps = result?.employees || [];
        const mp: Record<number, number> = {};
        const cs: Record<number, string | null> = {};
        for (const e of emps) {
          try {
            const res = await getTimesheetMonth(e.id_emp, year, month);
            const days = res?.data || [];
            mp[e.id_emp] = days.filter((d: any) => !!d?.present).length;
          } catch {}
          try {
            const r = await fetch(`http://localhost:9000/employees/${e.id_emp}`, { headers: authHeader() as unknown as HeadersInit });
            if (r.ok) {
              const js = await r.json();
              const obj = js?.data ?? js;
              cs[e.id_emp] = obj?.CONTRACT_START || obj?.contract_start || obj?.contractStart || null;
            }
          } catch {}
        }
        setPresentDaysMap(mp);
        setContractStartMap(cs);
      } catch { setPresentDaysMap({}); }
    })();
  }, [result, year, month]);

  // Auto-run payroll when filters change or when returning to Payroll tab
  React.useEffect(() => {
    if (tab === 'payroll') {
      onRun();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, ps, tab]);

  // Sort/filter helpers
  const sortRows = React.useCallback((rows: Payslip[]) => {
    const arr = [...rows];
    const getVal = (e: Payslip): any => {
      switch (sortKey) {
        case 'name': return String(e.name||'').toLowerCase();
        case 'ps': {
          const raw = e.PS != null ? String(e.PS) : '';
          const label = psPoints[Number(e.PS)] || formatPs(raw) || '';
          // Sort by numeric when P#; otherwise by label
          const m = String(label).match(/^P(\d+)$/i);
          return m ? Number(m[1]) : String(label);
        }
        case 'workingDays': return Number(e.workingDays||0);
        case 'deductionDays': return Number(e.deductionDays||0);
        case 'presentWorkdays': return Number(e.presentWorkdays||0);
        case 'holidayWorked': return Number(e.holidayWorked||0);
        case 'baseSalary': return Number(e.baseSalary||0);
        case 'food': {
          const per=Number((e as any).FOOD||(e as any).FOOD_ALLOWANCE||0);
          const pd = Number(presentDaysMap[e.id_emp] ?? e.presentWorkdays ?? 0) || 0;
          const fd = pd;
          return per*fd;
        }
        case 'fuel': {
          const W=Math.max(1,e.workingDays||1); const per=Number((e as any).FUEL||0); return per*W;
        }
        case 'comm': {
          const W=Math.max(1,e.workingDays||1); const per=Number((e as any).COMMUNICATION||0); return per*W;
        }
        case 'basePay': return Number(e.components?.basePay||0);
        case 'allowancePay': return Number(e.components?.allowancePay||0);
        case 'adjustments': { const a=e.components?.adjustments||{bonus:0,deduction:0,advance:0,loanPayment:0}; return (a.bonus||0)-((a.deduction||0)+(a.advance||0)+(a.loanPayment||0)); }
        case 'salesQty': return Number((sales[String(e.id_emp)]?.qty) || 0);
        case 'salesTotal': return Number((sales[String(e.id_emp)]?.total_lyd) || 0);
        case 'gold': { const vr=(v2Rows||[]).find((x:any)=>Number(x.id_emp)===Number(e.id_emp))||{}; return Number(vr.gold_bonus_lyd||0); }
        case 'diamond': { const vr=(v2Rows||[]).find((x:any)=>Number(x.id_emp)===Number(e.id_emp))||{}; return Number(vr.diamond_bonus_lyd||0); }
        case 'total': return computeNetLYDFor(e.id_emp);
        case 'totalUsd': {
          const W=Math.max(1,e.workingDays||1); const F=e.factorSum!=null&&e.factorSum>0?e.factorSum:((e.components?.basePay||0)/(Math.max(1,e.baseSalary||0)/W)); const baseUsd=e.baseSalaryUsd? (e.baseSalaryUsd/W)*F:0; const vr=(v2Rows||[]).find((x:any)=>Number(x.id_emp)===Number(e.id_emp))||{}; const commUsd=Number((vr as any).diamond_bonus_usd||0)+Number((vr as any).gold_bonus_usd||0); return baseUsd+commUsd;
        }
        default: return 0;
      }
    };
    arr.sort((a, b) => {
      const mult = sortDir === 'asc' ? 1 : -1;
      const va = getVal(a);
      const vb = getVal(b);
      if (va < vb) return -1 * mult;
      if (va > vb) return 1 * mult;
      return 0;
    });
    return arr;
  }, [sortKey, sortDir, sales, v2Rows, advMap, psPoints]);

  const displayedRows: Payslip[] = React.useMemo(() => {
    const rows = result?.employees || [];
    const f = String(filterText || '').toLowerCase();
    const filtered = f ? rows.filter(r => String(r.name||'').toLowerCase().includes(f) || String(r.id_emp).includes(f)) : rows;
    return sortRows(filtered);
  }, [result, filterText, sortRows]);

  // Totals for current view
  const totals = React.useMemo(() => {
    const t = { baseSalary: 0, base: 0, allow: 0, food: 0, fuel: 0, comm: 0, adj: 0, salesQty: 0, salesTotal: 0, gold: 0, diamond: 0, totalLyd: 0, totalUsd: 0 };
    displayedRows.forEach(e => {
      t.baseSalary += Number(e.baseSalary || 0);
      t.base += Number(e.components?.basePay||0);
      t.allow += Number(e.components?.allowancePay||0);
      const W = Math.max(1, e.workingDays||1);
      const foodPer = Number((e as any).FOOD || (e as any).FOOD_ALLOWANCE || 0);
      const vr = (v2Rows||[]).find((x:any)=> Number(x.id_emp)===Number(e.id_emp)) || {} as any;
      const fuelPer = Number(((e as any).FUEL ?? vr.FUEL) || 0);
      const commPer = Number(((e as any).COMMUNICATION ?? vr.COMMUNICATION) || 0);
      const pd = Number(presentDaysMap[e.id_emp] || 0);
      t.food += foodPer * pd;
      t.fuel += fuelPer * W;
      t.comm += commPer * W;
      const adj = e.components?.adjustments || { bonus:0, deduction:0, advance:0, loanPayment:0 };
      t.adj += (Number(adj.bonus||0) - (Number(adj.deduction||0)+Number(adj.advance||0)+Number(adj.loanPayment||0)));
      const s = sales[String(e.id_emp)] || { qty: 0, total_lyd: 0 };
      t.salesQty += Number(s.qty||0);
      t.salesTotal += Number(s.total_lyd||0);
      // vr defined above
      t.gold += Number(vr.gold_bonus_lyd||0);
      t.diamond += Number(vr.diamond_bonus_lyd||0);
      { t.totalLyd += computeNetLYDFor(e.id_emp); }
      // Approximate USD: use baseSalaryUsd/factor if available
      const W2 = Math.max(1, e.workingDays||1);
      const F = e.factorSum != null && e.factorSum > 0 ? e.factorSum : ((e.components?.basePay||0) / (Math.max(1, e.baseSalary||0)/W2));
      const baseUsd = e.baseSalaryUsd ? (e.baseSalaryUsd/W2)*F : 0;
      const commUsd = Number(vr?.diamond_bonus_usd||0) + Number(vr?.gold_bonus_usd||0);
      t.totalUsd += baseUsd + commUsd;
    });
    return t;
  }, [displayedRows, sales, v2Rows, advMap]);

  const onRun = async () => {
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      // Prefer V2 compute; adapt to legacy shape expected by this UI
      const v2 = await computePayrollV2({ year, month, ps: ps !== "" ? Number(ps) : undefined });
      const start = `${v2.year}-${String(v2.month).padStart(2,'0')}-01`;
      const end = `${v2.year}-${String(v2.month).padStart(2,'0')}-${String(new Date(v2.year, v2.month, 0).getDate()).padStart(2,'0')}`;
      setV2Rows(v2.rows || []);
      // Load employee allowances (FUEL, COMMUNICATION) once and index by id
      let allowMap: Record<number, { fuel: number; comm: number }> = {};
      try {
        const empList = await listEmployees();
        if (Array.isArray(empList)) {
          for (const e of empList as any[]) {
            const id = Number(e?.ID_EMP ?? e?.id_emp);
            if (!Number.isFinite(id)) continue;
            allowMap[id] = {
              fuel: Number(e?.FUEL || 0),
              comm: Number(e?.COMMUNICATION || 0),
            };
          }
        }
      } catch {}
      setViewOnly(!!v2.viewOnly);
      const employees: Payslip[] = (v2.rows || []).map((r: any) => {
        const baseSalary = Number(r.base_salary_lyd ?? r.baseLyd ?? 0);
        const workingDays = Number(r.food_days ?? r.workingDays ?? 0) || 0;
        const wdFoodLyd = Number(r.wd_food_lyd ?? r.wdFoodLyd ?? 0);
        const absenceLyd = Number(r.absence_lyd ?? r.absenceLyd ?? 0);
        const phLyd = Number(r.ph_lyd ?? r.phLyd ?? 0);
        const missingLyd = Number(r.missing_lyd ?? r.missingLyd ?? 0);
        const basePortion = Number((baseSalary - absenceLyd + phLyd - missingLyd).toFixed(2));
        const allowancePay = wdFoodLyd;
        const total = Number(r.net_salary_lyd ?? r.D16 ?? r.total_salary_lyd ?? r.D7 ?? 0);
        const allowancePerDay = workingDays > 0 ? (wdFoodLyd / workingDays) : 0;
        const absenceDays = Number(r.absence_days ?? r.absenceDays ?? 0);
        const presentW = Math.max(0, Number(workingDays || 0) - Number(absenceDays || 0));
        const idEmpNum = Number(r.id_emp);
        const extra = allowMap[idEmpNum] || { fuel: 0, comm: 0 };
        return {
          ok: true,
          id_emp: idEmpNum,
          name: String(r.name || r.id_emp),
          PS: r.ps ?? null,
          baseSalary,
          baseSalaryUsd: Number(r.base_salary_usd ?? r.baseUsd ?? 0),
          // attach allowances so UI/PDF can display them
          FUEL: extra.fuel,
          COMMUNICATION: extra.comm,
          allowancePerDay,
          workingDays: Number(r.workingDays ?? workingDays),
          deductionDays: absenceDays,
          presentWorkdays: presentW,
          holidayCount: 0,
          holidayWorked: Number(r.ph_days ?? r.holidayWorked ?? 0),
          leaveSummary: {},
          components: {
            basePay: basePortion,
            holidayOvertime: 0,
            allowancePay: 0,
            adjustments: {
              bonus: Number(r.gold_bonus_lyd ?? 0) + Number(r.diamond_bonus_lyd ?? 0) + Number(r.other_bonus1_lyd ?? 0) + Number(r.other_bonus2_lyd ?? 0) + Number(r.other_additions_lyd ?? 0) + Number(r.loan_debit_lyd ?? 0),
              deduction: Number(r.other_deductions_lyd ?? 0),
              advance: 0,
              loanPayment: Number(r.loan_credit_lyd ?? 0),
            },
          },
          total,
          year: v2.year,
          month: v2.month,
          foodDays: Number(r.food_days ?? workingDays),
          factorSum: 0,
          designation: ((): string | null => {
            const jt = (r as any).Job_title ?? (r as any).job_title ?? (r as any).TITLE ?? (r as any).title;
            const s = String(jt || '').trim();
            return s ? s : null;
          })(),
          costCenter: null,
        } as Payslip;
      });
      // Fallback fetch per-employee allowances if missing
      try {
        await Promise.all(employees.map(async (empRow) => {
          const hasFuel = Number((empRow as any).FUEL || 0) > 0;
          const hasComm = Number((empRow as any).COMMUNICATION || 0) > 0;
          if (!hasFuel || !hasComm) {
            try {
              const res = await fetch(`http://localhost:9000/employees/${empRow.id_emp}`, { headers: authHeader() as unknown as HeadersInit });
              if (res.ok) {
                const payload = await res.json();
                const obj = payload?.data ?? payload;
                if (!hasFuel) (empRow as any).FUEL = Number(obj?.FUEL || 0);
                if (!hasComm) (empRow as any).COMMUNICATION = Number(obj?.COMMUNICATION || 0);
              }
            } catch {}
          }
        }));
      } catch {}

      const adapted: PayrollRunResponse = { ok: true, year: v2.year, month: v2.month, period: { start, end }, count: employees.length, employees };
      setResult(adapted);
      // Preload monthly advances per employee to align UI totals with PDF
      try {
        const entries: Record<number, number> = {};
        await Promise.all(employees.map(async (e) => {
          try {
            const url = `http://localhost:9000/hr/payroll/adjustments?year=${v2.year}&month=${v2.month}&employeeId=${e.id_emp}`;
            const res = await fetch(url, { headers: authHeader() as unknown as HeadersInit });
            if (res.ok) {
              const js = await res.json();
              const arr = (js?.data?.[String(e.id_emp)] || []) as Array<{ type: string; amount: number }>;
              const sum = arr.filter(r => String(r.type).toLowerCase() === 'advance').reduce((s, r) => s + Number(r.amount || 0), 0);
              entries[e.id_emp] = sum;
            }
          } catch {}
        }));
        setAdvMap(entries);
      } catch {}

      // Build per-employee timesheet aggregates used by UI to mirror PDF calculations
      try {
        const agg: Record<number, { presentP: number; phUnits: number; fridayA: number; missRatio: number }> = {};
        await Promise.all(employees.map(async (e, idx) => {
          try {
            const days = await ensureTimesheetDays(e.id_emp);
            const vr = (v2.rows || []).find((x: any) => Number(x.id_emp) === Number(e.id_emp)) || {};
            const pick = (s: any): number | null => {
              if (!s) return null; const m = String(s).match(/(\d{1,2}):(\d{2})/); if (!m) return null; const hh=Number(m[1]); const mm=Number(m[2]); if (!Number.isFinite(hh)||!Number.isFinite(mm)) return null; return hh*60+mm;
            };
            const s1 = pick((vr as any).T_START || (vr as any).t_start || (vr as any).SCHEDULE_START || (vr as any).shift_start);
            const s2 = pick((vr as any).T_END || (vr as any).t_end || (vr as any).SCHEDULE_END || (vr as any).shift_end);
            let presentP = 0, phUnits = 0, fridayA = 0, missAll = 0, missNoPT = 0;
            for (let i = 0; i < days.length; i++) {
              const d = days[i];
              const c = codeBadge(d, s1, s2);
              if (c === 'P') presentP += 1;
              else if (c === 'PHF') phUnits += 2;
              else if (c === 'PH') phUnits += 1;
              const dayDate = dayjs(`${v2.year}-${String(v2.month).padStart(2,'0')}-01`).date(i+1);
              if (dayDate.day() === 5 && c === 'A') fridayA += 1;
              const dm = Number(d?.deltaMin || 0);
              if (dm < 0) {
                const abs = Math.abs(dm);
                missAll += abs;
                if (c !== 'PT') missNoPT += abs;
              }
            }
            const missRatio = missAll > 0 ? (missNoPT / missAll) : 0;
            agg[e.id_emp] = { presentP, phUnits, fridayA, missRatio };
          } catch {}
        }));
        setTsAgg(agg);
        // Keep presentDaysMap for any legacy uses (derived from presentP)
        const pd: Record<number, number> = {};
        Object.keys(agg).forEach(k => { pd[Number(k)] = agg[Number(k)].presentP; });
        setPresentDaysMap(pd);
      } catch {}
    } catch (e: any) {
      // Fallback to legacy endpoint
      try {
        const body: any = { year, month };
        if (ps !== "") body.ps = Number(ps);
        const data = await runPayroll(body);
        setResult(data);
      } catch (e2: any) {
        setError(e2?.message || "Failed to run payroll");
      }
    } finally {
      setLoading(false);
    }
  };

  const openCalendar = async (id_emp: number, name: string) => {
    setCalOpen(true);
    setCalEmp({ id_emp, name });
    setCalLoading(true);
    try {
      const res = await getTimesheetMonth(id_emp, year, month);
      setCalDays(res?.data || null);
    } catch (e: any) {
      setCalDays(null);
    } finally {
      setCalLoading(false);
    }
  };
  
  const roundedHoursWithSign = (mins: number | null | undefined) => {
    if (mins == null) return "";
    const sign = mins >= 0 ? "+" : "-";
    const abs = Math.abs(mins);
    const h = Math.floor(abs / 60);
    const m = Math.floor(abs % 60);
    if (h === 0 && m < 1) return "";
    return `${sign}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  };

  const ensureTimesheetDays = async (empId: number): Promise<TimesheetDay[]> => {
    try {
      const res = await getTimesheetMonth(empId, year, month);
      return res?.data || [];
    } catch {
      return [];
    }
  };

  const buildPayslipPdf = async (emp: Payslip): Promise<{ dataUrl: string; blobUrl: string; filename: string }> => {
  const days = await ensureTimesheetDays(emp.id_emp);
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 36;

  // Arabic utilities (canvas-based rendering to preserve shaping/RTL)
  const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(String(s || ""));
  let arabicFontLoaded = false;
  const ensureArabicCanvasFont = async () => {
    if (arabicFontLoaded) return;
    const candidates = [
      "/fonts/NotoNaskhArabic-Regular.ttf",
      "/fonts/NotoNaskhArabic-VariableFont_wght.ttf",
      "/fonts/Amiri-Regular.ttf",
    ];
    for (const url of candidates) {
      try {
        const ff = new (window as any).FontFace("GajaArabicPDF", `url(${url})`);
        await ff.load();
        (document as any).fonts.add(ff);
        arabicFontLoaded = true;
        break;
      } catch {}
    }
  };
  const drawArabicTextImage = async (text: string, fontPt: number): Promise<{ dataUrl: string; wPt: number; hPt: number } | null> => {
    try {
      await ensureArabicCanvasFont();
      const fontPx = Math.max(10, Math.round(fontPt * 6.3333));
      const cnv = document.createElement('canvas');
      const ctxm = cnv.getContext('2d');
      if (!ctxm) return null;
      ctxm.direction = 'rtl';
      ctxm.font = `${fontPx}px GajaArabicPDF, 'Noto Naskh Arabic', 'Amiri', Arial`;
      const metrics = ctxm.measureText(text);
      const w = Math.max(10, Math.ceil((metrics?.width || (fontPx * String(text||'').length)) + 6));
      const h = Math.ceil(fontPx * 1.3);
      cnv.width = w; cnv.height = h;
      const ctx2 = cnv.getContext('2d');
      if (!ctx2) return null;
      ctx2.direction = 'rtl';
      ctx2.textBaseline = 'alphabetic';
      ctx2.fillStyle = '#000000';
      ctx2.font = `${fontPx}px GajaArabicPDF, 'Noto Naskh Arabic', 'Amiri', Arial`;
      ctx2.fillText(text, w - 2, Math.ceil(fontPx));
      const dataUrl = cnv.toDataURL('image/png');
      const hPt = fontPt + 4;
      const scale = hPt / h;
      const wPt = w * scale;
      return { dataUrl, wPt, hPt };
    } catch { return null; }
  };

  const downscaleToJpeg = async (dataUrl: string, maxW: number = 800, quality: number = 0.7): Promise<string | null> => {
    try {
      const img = new Image();
      const res: string = await new Promise((resolve, reject) => {
        img.onload = () => {
          const scale = Math.min(1, maxW / (img.naturalWidth || img.width || maxW));
          const targetW = Math.max(1, Math.round((img.naturalWidth || img.width || maxW) * scale));
          const targetH = Math.max(1, Math.round((img.naturalHeight || img.height || maxW) * scale));
          const cnv = document.createElement('canvas');
          cnv.width = targetW; cnv.height = targetH;
          const ctx = cnv.getContext('2d');
          if (!ctx) { resolve(dataUrl); return; }
          ctx.drawImage(img, 0, 0, targetW, targetH);
          const out = cnv.toDataURL('image/jpeg', quality);
          resolve(out);
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      });
      return res;
    } catch { return dataUrl; }
  };

  const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const dim = new Date(year, month, 0).getDate();

  // Compute net values (we will override with a consistent recomputation below)
  let netLyd = 0;
  let netUsd = 0;

  // Slightly darker grey page background
  const pageH = doc.internal.pageSize.getHeight();
  try {
    (doc as any).setFillColor(255, 255, 255);
    (doc as any).rect(0, 0, pageW, pageH, 'F');
  } catch {}
  
  // Light grey header background at top
  doc.setFontSize(12);
  try {
    (doc as any).setFillColor(205, 205, 205);
    (doc as any).rect(0, 0, pageW, 95, 'F'); // 5px shorter than before
  } catch {}
  const headerH = 95;
  
  const title = `${emp.name}`;
  let roleStr = String(emp.designation || '').trim();
  const logoH = 80; // slightly smaller logo height
  let logoX = -10, logoW = 0, logoY = 0;
  let paySlipCenterX = 0; // center x for PAYSLIP, drawn later
  const tryFetch = async (p: string) => {
    try {
      const r = await fetch(p);
      if (!r.ok) return null;
      const blob = await r.blob();
      return await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
    } catch { return null; }
  };
  const logoData = (await tryFetch('/Gaja Black.png')) || (await tryFetch('/GJ LOGO.png'));
  if (logoData) {
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        let dataBlack = logoData;
        try {
          const cnv = document.createElement('canvas');
          cnv.width = img.naturalWidth || img.width; cnv.height = img.naturalHeight || img.height;
          const ctx = cnv.getContext('2d');
          if (ctx && cnv.width && cnv.height) {
            ctx.drawImage(img, 0, 0);
            const id = ctx.getImageData(0, 0, cnv.width, cnv.height);
            const a = id.data;
            for (let i = 0; i < a.length; i += 4) {
              const alpha = a[i + 3];
              if (alpha > 0) { a[i] = 0; a[i + 1] = 0; a[i + 2] = 0; }
            }
            ctx.putImageData(id, 0, 0);
            dataBlack = cnv.toDataURL('image/png');
          }
        } catch {}
        const scale = logoH / (img.naturalHeight || logoH);
        const w = Math.max(logoH, (img.naturalWidth || logoH) * scale);
        const w2 = Math.min(w * 1.1, pageW - margin * 2);
        const x = pageW - margin - w2;
        logoX = x; logoW = w2; logoY = Math.max(2, margin - 16);
        doc.addImage(dataBlack, 'PNG', x, logoY, w2, logoH);
        try {
          // Defer drawing PAYSLIP label until after left header block to align heights
          paySlipCenterX = x + (w2 / 2);
        } catch {}
        resolve();
      };
      img.onerror = () => resolve();
      img.src = logoData;
    });
  }
  
  // Resolve v2 row for this employee early (used by header values like PS)
  const v2 = (v2Rows || []).find((x:any) => Number(x.id_emp) === Number(emp.id_emp)) || {} as any;
  // Schedule mins for classification fallback
  const parseMin2 = (s:any): number | null => {
    if (!s) return null; const m = String(s).match(/(\d{1,2}):(\d{2})/); if (!m) return null; const hh=Number(m[1]); const mm=Number(m[2]); if (!Number.isFinite(hh)||!Number.isFinite(mm)) return null; return hh*60+mm;
  };
  const schStartMinPDF = parseMin2((v2 as any).T_START || (v2 as any).t_start || (v2 as any).SCHEDULE_START || (v2 as any).shift_start);
  const schEndMinPDF = parseMin2((v2 as any).T_END || (v2 as any).t_end || (v2 as any).SCHEDULE_END || (v2 as any).shift_end);
  let infoBottomYCalc = 0;

  // Place header texts next to the logo: left side = labeled employee fields (left-aligned), right side = pay month/printed on
  doc.setTextColor(22, 22, 22);
  const payMonthStr = `${dayjs(periodStart).format('MMMM, YYYY')}`;
  const printedOnStr = `Printed on: ${dayjs().format('DD/MM/YYYY')}`;
  const leftAnchorX = margin + 12; // left column anchor
  const rightAnchorX = Math.max(margin + 140, (logoX || (pageW - margin)) - 180); // right-side texts to the left of the logo
  const leftColX = margin + 12;
  const nameY = (logoY || (margin - 16)) + logoH / 2 - 14;
  const idY = nameY + 12;
  const posY = idY + 12;
  const psY = posY + 12;
  const payMonthY = (logoY || (margin - 16)) + logoH / 2 - 14;
  const printedOnY = payMonthY + 12;

  // Employee quick table (Company, Branch, Name, ID, Position, PS, Working Hours)
  try {
    // Resolve Position (TITLE) before drawing header
    try {
      const resTitle = await fetch(`http://localhost:9000/employees/${emp.id_emp}`, { headers: authHeader() as unknown as HeadersInit });
      if (resTitle.ok) {
        const payload = await resTitle.json();
        const obj = payload?.data ?? payload;
        const t = String(obj?.TITLE || obj?.title || '').trim();
        if (t) roleStr = t;
      }
    } catch {}
    const psTxt = emp?.PS != null ? (formatPs((v2 as any)?.ps ?? emp.PS) || String(emp.PS)) : '-';
    const branchMap: Record<string, string> = { P1: 'Jraba Mall', P2: 'Jraba Main', P3: 'Ben Ashour' };
    const branchName = (() => {
      const pRaw = (v2 as any).ps ?? emp.PS;
      const code = formatPs(pRaw) || (Number(pRaw) ? `P${Number(pRaw)}` : String(pRaw || ''));
      const idPs = Number(pRaw);
      const fromPoints = Number.isFinite(idPs) ? psPoints[idPs] : '';
      const mapped = branchMap[code] || '';
      return (mapped || fromPoints || '').trim();
    })();
    const fmtHM = (min: number | null | undefined) => {
      if (min == null) return '';
      const h = Math.floor(min/60);
      const mm = Math.floor(min % 60);
      return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
    };
    const schedTxt = (schStartMinPDF != null && schEndMinPDF != null) ? `${fmtHM(schStartMinPDF)}–${fmtHM(schEndMinPDF)}` : '';
    // Separator line exactly at the bottom of the grey header spanning full width
    try { doc.setDrawColor(0,0,0); doc.setLineWidth(1); doc.line(0, headerH, pageW, headerH); } catch {}

    // Two tables under the header line, aligned to earnings/deductions column widths
    const areaPre = (pageW - margin * 2);
    const colWPre = (areaPre / 2) - 8;
    const tX = margin; // left table x matches earnings block
    const rightX = margin + colWPre + 16; // matches deductions block x
    const tY = headerH + 10;
    const rowH = 18;
    const labW = Math.floor(colWPre * 0.34);
    const valW = Math.max(0, Math.floor(colWPre) - labW);

    const leftRows: Array<[string, string]> = [
      ['Name', String(emp.name || '')],
      ['ID', String(emp.id_emp || '')],
    ];
    const rightRows: Array<[string, string]> = [
      ['Position', roleStr || '-'],
      ['PS', String(psTxt || '-')],
    ];
    doc.setFont('helvetica','normal');
    doc.setFontSize(10);
    for (let i=0;i<leftRows.length;i++){
      const y0 = tY + i*rowH;
      doc.setDrawColor('#999999');
      (doc as any).setFillColor(240,240,240);
      doc.rect(tX, y0, labW, rowH, 'F');
      doc.rect(tX, y0, labW, rowH);
      doc.rect(tX + labW, y0, valW, rowH, 'F');
      doc.rect(tX + labW, y0, valW, rowH);
      doc.text(leftRows[i][0], tX + 6, y0 + 12);
      const val = leftRows[i][1] || '';
      if (hasArabic(val)) {
        const img = await drawArabicTextImage(val, 10);
        if (img) doc.addImage(img.dataUrl, 'PNG', tX + labW + 6, y0 + 2, img.wPt, img.hPt);
        else doc.text(val, tX + labW + 6, y0 + 12);
      } else {
        doc.text(val, tX + labW + 6, y0 + 12);
      }
    }
    for (let i=0;i<rightRows.length;i++){
      const y0 = tY + i*rowH;
      doc.setDrawColor('#999999');
      (doc as any).setFillColor(240,240,240);
      doc.rect(rightX, y0, labW, rowH, 'F');
      doc.rect(rightX, y0, labW, rowH);
      doc.rect(rightX + labW, y0, valW, rowH, 'F');
      doc.rect(rightX + labW, y0, valW, rowH);
      doc.text(rightRows[i][0], rightX + 6, y0 + 12);
      const val = rightRows[i][1] || '';
      if (hasArabic(val)) {
        const img = await drawArabicTextImage(val, 10);
        if (img) doc.addImage(img.dataUrl, 'PNG', rightX + labW + 6, y0 + 2, img.wPt, img.hPt);
        else doc.text(val, rightX + labW + 6, y0 + 12);
      } else {
        doc.text(val, rightX + labW + 6, y0 + 12);
      }
    }
    const leftBottom = tY + leftRows.length * rowH;
    const rightBottom = tY + rightRows.length * rowH;
    infoBottomYCalc = Math.max(leftBottom, rightBottom);
    // Top-left Branch label in bold, same style as PAYSLIP, aligned with logo row
    try {
      const bTxt = branchName || '';
      if (bTxt) {
        doc.setFont('helvetica','bold');
        doc.setFontSize(14);
        doc.setTextColor(0,0,0);
        const topLeftY = (logoY || margin) + 44;
        // Company above branch with extra spacing
        doc.text('Gaja Jewelry', margin, Math.max(10, topLeftY - 18));
        doc.text(bTxt, margin, topLeftY);
        // Pay month directly under branch name
        doc.setFont('helvetica','normal');
        doc.setFontSize(10);
        doc.text(payMonthStr, margin, topLeftY + 12);
      }
    } catch {}
  } catch {}
  // Right side header texts removed; Pay month rendered under branch

  // (net recomputation moved below, after all variables are defined)
  const csStr = (v2 as any).T_START || (v2 as any).contract_start || (v2 as any).contractStart;
  const contractStart = csStr ? dayjs(csStr) : null;
  const missMinAll = days.reduce((acc, d) => acc + ((d?.deltaMin ?? 0) < 0 ? Math.abs(d!.deltaMin!) : 0), 0);
  const missMinNoPT = days.reduce((acc, d) => acc + (((d?.deltaMin ?? 0) < 0 && codeBadge(d, schStartMinPDF, schEndMinPDF) !== 'PT') ? Math.abs(d!.deltaMin!) : 0), 0);
  const missH = Math.floor(missMinNoPT / 60);
  const missM = Math.floor(missMinNoPT % 60);
  const missStr = (missH||missM) ? `${String(missH)}h${missM?` ${String(missM)}m`:''}` : '';
  const bv = (n:any)=>Number(n||0);
  const fmt = (n:number)=> n ? n.toLocaleString(undefined,{maximumFractionDigits:2}) : '';
  // Food allowance present-days should NOT include PH/PHF; count only actual present 'P'
  const presentDaysCount = Array.isArray(days) ? days.filter(d => codeBadge(d as any, schStartMinPDF, schEndMinPDF) === 'P').length : 0;
  const wdFoodLydPDF = Number((v2 as any).wd_food_lyd || 0);
  const wdFoodUsdPDF = Number((v2 as any).wd_food_usd || 0);
  const foodDaysV2PDF = Number((v2 as any).food_days || (v2 as any).workingDays || emp.workingDays || 0);
  const foodPerDayLydPDF = foodDaysV2PDF > 0 ? wdFoodLydPDF / foodDaysV2PDF : 0;
  const foodLydAdjPDF = Number((foodPerDayLydPDF * presentDaysCount).toFixed(2));
  // PH fallback: if v2 lacks ph amounts, compute daily pay: PHF=2x, PH=1x
  const workingDaysPref = Number(emp.workingDays || (v2 as any).workingDays || foodDaysV2PDF || 0);
  // Travel/Communication allowances from Employee Profile (per working day)
  let fuelPerDayPDF = Number(((emp as any).FUEL ?? (v2 as any).FUEL) || 0);
  let commPerDayPDF = Number(((emp as any).COMMUNICATION ?? (v2 as any).COMMUNICATION) || 0);
  if (!fuelPerDayPDF && !commPerDayPDF) {
    try {
      const resEmp = await fetch(`http://localhost:9000/employees/${emp.id_emp}`, { headers: authHeader() as unknown as HeadersInit });
      if (resEmp.ok) {
        const payload = await resEmp.json();
        const obj = payload?.data ?? payload;
        fuelPerDayPDF = Number(obj?.FUEL || 0);
        commPerDayPDF = Number(obj?.COMMUNICATION || 0);
      }
    } catch {}
  }
  const travelLydPDF = Number(((fuelPerDayPDF || 0) * (workingDaysPref || 0)).toFixed(2));
  const commLydPDF = Number(((commPerDayPDF || 0) * (workingDaysPref || 0)).toFixed(2));
  const phFullDays = Array.isArray(days) ? days.filter(d => codeBadge(d as any, schStartMinPDF, schEndMinPDF) === 'PHF').length : 0;
  const phPartDays = Array.isArray(days) ? days.filter(d => codeBadge(d as any, schStartMinPDF, schEndMinPDF) === 'PH').length : 0;
  const dailyLyd = workingDaysPref > 0 ? Number(((v2 as any).base_salary_lyd || emp.baseSalary || 0)) / workingDaysPref : 0;
  const dailyUsd = workingDaysPref > 0 ? Number(((v2 as any).base_salary_usd || 0)) / workingDaysPref : 0;
  const phUnits = (phFullDays * 2) + (phPartDays * 1);
  const phLydFallback = phUnits > 0 && Number((v2 as any).ph_lyd || 0) <= 0 ? Number((dailyLyd * phUnits).toFixed(2)) : 0;
  const phUsdFallback = phUnits > 0 && Number((v2 as any).ph_usd || 0) <= 0 ? Number((dailyUsd * phUnits).toFixed(2)) : 0;
  // Fridays off: do not count Friday 'A' as absence
  const fridayA = Array.isArray(days) ? days.reduce((cnt, d, idx) => {
    const dow = dayjs(periodStart).date(idx + 1).day();
    return cnt + ((dow === 5 && codeBadge(d as any, schStartMinPDF, schEndMinPDF) === 'A') ? 1 : 0);
  }, 0) : 0;

  // Fetch this month's Salary Advances total for this employee (to deduct from Net Pay)
  let advSumLYD = 0;
  try {
    const adjUrlSum = `http://localhost:9000/hr/payroll/adjustments?year=${year}&month=${month}&employeeId=${emp.id_emp}`;
    const res = await fetch(adjUrlSum, { headers: authHeader() as unknown as HeadersInit });
    if (res.ok) {
      const js = await res.json();
      const arr = (js?.data?.[String(emp.id_emp)] || []) as Array<{ type: string; amount: number }>;
      advSumLYD = arr.filter(r => String(r.type).toLowerCase() === 'advance').reduce((s, r) => s + Number(r.amount || 0), 0);
    }
  } catch {}
  
  // Fetch commission settings for this employee (Gold/Diamond)
  let goldCommTypeRaw = '';
  let goldCommVal: number | null = null;
  let diamondCommTypeRaw = '';
  let diamondCommVal: number | null = null;
  let sellerUserId: number | null = null;
  let commissionRole: string = '';
  let commissionPs: number[] = [];
  try {
    const resEmp = await fetch(`http://localhost:9000/employees/${emp.id_emp}`, { headers: authHeader() as unknown as HeadersInit });
    if (resEmp.ok) {
      const payload = await resEmp.json();
      const obj = payload?.data ?? payload;
      // Set role/title from employee TITLE if available
      if (!roleStr) {
        const t = String(obj?.TITLE || obj?.title || '').trim();
        if (t) roleStr = t;
      }
      goldCommTypeRaw = String((obj?.GOLD_COMM ?? obj?.gold_comm) || '').toLowerCase();
      goldCommVal = obj?.GOLD_COMM_VALUE != null ? Number(obj.GOLD_COMM_VALUE) : null;
      diamondCommTypeRaw = String((obj?.DIAMOND_COMM_TYPE ?? obj?.diamond_comm_type) || '').toLowerCase();
      diamondCommVal = obj?.DIAMOND_COMM != null ? Number(obj.DIAMOND_COMM) : null;
      // Try map to seller userId and commission role/scope from JOB_DESCRIPTION JSON
      try {
        const jd = obj?.JOB_DESCRIPTION ? JSON.parse(obj.JOB_DESCRIPTION) : {};
        const sid = jd?.__sales__?.userId ?? jd?.__seller__?.userId ?? null;
        if (sid != null && !Number.isNaN(Number(sid))) sellerUserId = Number(sid);
        if (jd?.__commissions__) {
          commissionRole = String(jd.__commissions__.role || '').toLowerCase();
          const psList = jd.__commissions__.ps;
          if (Array.isArray(psList)) commissionPs = psList.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n));
        }
      } catch {}
    }
  }
  catch {}
  // Fetch seller sales totals for this period
  const monthStartISO = dayjs(periodStart).format('YYYY-MM-DD');
  const monthEndISO = dayjs(periodStart).endOf('month').format('YYYY-MM-DD');
  let salesGoldLYD = 0, salesGoldUSD = 0, salesDiamondLYD = 0, salesDiamondUSD = 0;
  let goldGramsSelf = 0;
  let goldGramsScope = 0; // for lead/manager PS aggregation
  let diamondSelfLYD = 0, diamondSelfUSD = 0;
  let diamondItems = 0;
  if (sellerUserId != null) {
    try {
      const qs = new URLSearchParams({ from: monthStartISO, to: monthEndISO }).toString();
      const r = await fetch(`http://localhost:9000/invoices/allDetailsP?${qs}`, { headers: authHeader() as unknown as HeadersInit });
      if (r.ok) {
        const js = await r.json();
        const rowsAll: any[] = Array.isArray(js) ? js : [];
        const rows: any[] = rowsAll;
        const filtered = rows.filter((row: any) => {
          const uid = Number(row?.Utilisateur?.id_user ?? row?.user_id ?? NaN);
          return Number.isFinite(uid) && uid === Number(sellerUserId);
        });
        for (const row of filtered) {
          const typeRaw = String(row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || '').toLowerCase();
          const lyd = Number(row?.amount_lyd || 0);
          const usd = Number(row?.amount_currency || 0);
          if (typeRaw.includes('gold')) {
            salesGoldLYD += lyd; salesGoldUSD += usd;
            const achats = Array.isArray(row?.ACHATs) ? row.ACHATs : [];
            for (const a of achats) {
              const st = String(a?.Fournisseur?.TYPE_SUPPLIER || '').toLowerCase();
              if (st.includes('gold')) {
                const q = Number(a?.qty || 0);
                if (!Number.isNaN(q)) goldGramsSelf += q;
              }
            }
          } else if (typeRaw.includes('diamond')) {
            salesDiamondLYD += lyd; salesDiamondUSD += usd;
            diamondSelfLYD += Number(row?.amount_lyd || 0);
            diamondSelfUSD += Number(row?.amount_currency || 0);
            const achats = Array.isArray(row?.ACHATs) ? row.ACHATs : [];
            for (const a of achats) {
              const st = String(a?.Fournisseur?.TYPE_SUPPLIER || '').toLowerCase();
              if (st.includes('diamond')) {
                const q = Number(a?.qty ?? 1);
                diamondItems += Number.isFinite(q) && q > 0 ? q : 1;
              }
            }
          }
        }
        // For lead/manager: aggregate gold grams by PS scope (from job description or fallback to employee PS)
        const targetPs: number[] = (commissionPs && commissionPs.length > 0)
          ? commissionPs
          : (emp?.PS != null ? [Number(emp.PS)] : []);
        if ((commissionRole === 'sales_lead' || commissionRole === 'sales_manager') && targetPs.length > 0) {
          for (const row of rowsAll) {
            const psVal = Number(row?.ps ?? row?.PS ?? NaN);
            if (!Number.isFinite(psVal) || !targetPs.includes(psVal)) continue;
            const achats = Array.isArray(row?.ACHATs) ? row.ACHATs : [];
            for (const a of achats) {
              const st = String(a?.Fournisseur?.TYPE_SUPPLIER || '').toLowerCase();
              if (st.includes('gold')) {
                const q = Number(a?.qty || 0);
                if (!Number.isNaN(q)) goldGramsScope += q;
              }
            }
          }
        }
      }
    } catch {}
  }

  // (net recomputation moved below commission/adjustments/deductions)
  // Commission settings (editable via Commissions page); defaults if not set
  const commissionSettings = (() => {
    try {
      const raw = localStorage.getItem('commissionSettingsV1');
      if (!raw) throw new Error('no settings');
      const cfg = JSON.parse(raw);
      return cfg && typeof cfg === 'object' ? cfg : {};
    } catch {
      return {} as any;
    }
  })();
  const goldRates = {
    sales_rep: 1,
    senior_sales_rep: 1.25,
    sales_lead: 1.5,
    sales_manager: 1.5,
    ...(commissionSettings.gold || {}),
  } as Record<string, number>;
  const diamondRates = {
    sales_rep: 1.5,
    senior_sales_rep: 3,
    sales_lead: 3,
    sales_manager: 3,
    ...(commissionSettings.diamond || {}),
  } as Record<string, number>;

  const roleKey = (commissionRole || '').toLowerCase();
  const goldRate = goldRates[roleKey] ?? 0;
  const diamondPct = diamondRates[roleKey] ?? 0;

  // Compute commission values
  const goldBonusLYDComputed = (() => {
    if (!goldRate) return 0;
    if (roleKey === 'sales_lead' || roleKey === 'sales_manager') {
      return Number((goldGramsScope * goldRate).toFixed(2));
    }
    return Number((goldGramsSelf * goldRate).toFixed(2));
  })();
  const goldBonusUSDComputed = 0; // per-gram rules in LYD only

  const diamondBonusLYDComputed = Number(((diamondSelfLYD * diamondPct) / 100).toFixed(2));
  const diamondBonusUSDComputed = Number(((diamondSelfUSD * diamondPct) / 100).toFixed(2));
  const adjComp = (emp.components?.adjustments || { bonus: 0, deduction: 0, advance: 0, loanPayment: 0 });
  
  // Recompute NET from visible components (LYD) and USD candidate
  {
    const baseLyd2 = Math.max(0, Number((v2 as any).base_salary_lyd || emp.baseSalary || 0));
    const phLyd2 = Math.max(0, Number((v2 as any).ph_lyd || phLydFallback || 0));
    let absenceLyd2 = Math.max(0, Number((v2 as any).absence_lyd || 0));
    if (fridayA > 0 && dailyLyd > 0) absenceLyd2 = Math.max(0, Number((absenceLyd2 - dailyLyd * fridayA).toFixed(2)));
    const missingLydV2 = Math.max(0, Number((v2 as any).missing_lyd || 0));
    const missingLyd2 = missMinAll > 0 ? Number(((missingLydV2 * (missMinNoPT / missMinAll))).toFixed(2)) : 0;
    const goldLyd2 = Math.max(0, Number(goldBonusLYDComputed || (v2 as any).gold_bonus_lyd || 0));
    const diaLyd2 = Math.max(0, Number(diamondBonusLYDComputed || (v2 as any).diamond_bonus_lyd || 0));
    const othAddLyd2 = Math.max(0, Number((v2 as any).other_additions_lyd || 0));
    const loanPayLyd2 = Math.max(0, Number((v2 as any).loan_credit_lyd || 0));
    const otherDedExAdv2 = Math.max(0, Number((v2 as any).other_deductions_lyd || 0) - Math.max(0, Number(advSumLYD || 0)));
    const foodLyd2 = Math.max(0, Number(foodLydAdjPDF || 0));
    const travelLyd2 = Math.max(0, Number(travelLydPDF || 0));
    const commLyd2 = Math.max(0, Number(commLydPDF || 0));
    netLyd = Number((baseLyd2 + phLyd2 + foodLyd2 + travelLyd2 + commLyd2 + goldLyd2 + diaLyd2 + othAddLyd2 - absenceLyd2 - missingLyd2 - Math.max(0, Number(advSumLYD || 0)) - loanPayLyd2 - otherDedExAdv2).toFixed(2));
    // Always recompute USD net from components and include diamond bonus USD
    const baseUsd2 = Math.max(0, Number((v2 as any).base_salary_usd || 0));
    const phUsd2 = Math.max(0, Number((v2 as any).ph_usd || phUsdFallback || 0));
    let absenceUsd2 = Math.max(0, Number((v2 as any).absence_usd || 0));
    if (fridayA > 0 && dailyUsd > 0) absenceUsd2 = Math.max(0, Number((absenceUsd2 - dailyUsd * fridayA).toFixed(2)));
    const missingUsdV2 = Math.max(0, Number((v2 as any).missing_usd || 0));
    const missingUsd2 = missMinAll > 0 ? Number(((missingUsdV2 * (missMinNoPT / missMinAll))).toFixed(2)) : 0;
    const goldUsd2 = Math.max(0, Number((v2 as any).gold_bonus_usd || 0));
    const diaUsd2 = Math.max(0, Number(diamondBonusUSDComputed || (v2 as any).diamond_bonus_usd || 0));
    const othAddUsd2 = Math.max(0, Number((v2 as any).other_additions_usd || 0));
    const loanPayUsd2 = Math.max(0, Number((v2 as any).loan_credit_usd || 0));
    const otherDedUsd2 = Math.max(0, Number((v2 as any).other_deductions_usd || 0));
    netUsd = Number((baseUsd2 + phUsd2 + goldUsd2 + diaUsd2 + othAddUsd2 - absenceUsd2 - missingUsd2 - loanPayUsd2 - otherDedUsd2).toFixed(2));
  }
  // Force LYD net to match UI net exactly
  try {
    const netFromUI = computeNetLYDFor(emp.id_emp);
    if (netFromUI !== undefined && netFromUI !== null && !Number.isNaN(Number(netFromUI))) {
      netLyd = Math.max(0, Number(Number(netFromUI).toFixed(2)));
    }
  } catch {}
  // (moved below deductions rendering)
  const breakdown: Array<{label:string; lyd:number; usd:number; note?:string}> = [
    { label: 'Basic Salary', lyd: bv(v2.base_salary_lyd), usd: bv(v2.base_salary_usd) },
    { label: 'Food Allowance', lyd: foodLydAdjPDF, usd: 0, note: String(presentDaysCount || '') },
    { label: 'Absent Days', lyd: bv(v2.absence_lyd), usd: bv(v2.absence_usd), note: String(v2.absence_days || '') },
    { label: 'Paid Holiday', lyd: bv(v2.ph_lyd), usd: bv(v2.ph_usd), note: String(v2.ph_days || '') },
    { label: 'Missing Hours', lyd: bv(v2.missing_lyd), usd: bv(v2.missing_usd), note: missStr },
    { label: 'Total Salary', lyd: bv(v2.total_salary_lyd ?? v2.D7), usd: bv(v2.total_salary_usd ?? v2.C7) },
    { label: 'Gold Bonus', lyd: bv(v2.gold_bonus_lyd), usd: bv(v2.gold_bonus_usd) },
    { label: 'Diamond Bonus', lyd: bv(v2.diamond_bonus_lyd), usd: bv(v2.diamond_bonus_usd) },
    { label: 'Other Bonus', lyd: bv(v2.other_bonus1_lyd), usd: bv(v2.other_bonus1_usd), note: v2.other_bonus1_acc ? String(v2.other_bonus1_acc) : '' },
    { label: 'Other Bonus', lyd: bv(v2.other_bonus2_lyd), usd: bv(v2.other_bonus2_usd), note: v2.other_bonus2_acc ? String(v2.other_bonus2_acc) : '' },
    { label: 'Loan Debit', lyd: bv(v2.loan_debit_lyd), usd: bv(v2.loan_debit_usd) },
    { label: 'Loan Credit', lyd: bv(v2.loan_credit_lyd), usd: bv(v2.loan_credit_usd) },
    { label: 'Other Adds', lyd: bv(v2.other_additions_lyd), usd: bv(v2.other_additions_usd) },
    { label: 'Other Deduct', lyd: bv(v2.other_deductions_lyd), usd: bv(v2.other_deductions_usd) },
  ];
  
  let brShowLyd = Number(v2.base_salary_lyd || 0) > 0;
  let brShowUsd = Number(v2.base_salary_usd || 0) > 0;
  if (!brShowLyd && !brShowUsd) brShowLyd = true;

  const rows = breakdown.filter(r => (
    (brShowLyd && Number(r.lyd || 0) > 0) || (brShowUsd && Number(r.usd || 0) > 0)
  ));

  const area = (pageW - margin*2);
  const colL = Math.floor(area * (brShowLyd && brShowUsd ? 0.40 : 0.50));
  const colA = brShowLyd ? Math.floor(area * (brShowUsd ? 0.15 : 0.20)) : 0;
  const colB = brShowUsd ? Math.floor(area * (brShowLyd ? 0.15 : 0.20)) : 0;
  const colN = area - colL - colA - colB;

  const fitText = (text: string, maxWidth: number) => {
    let t = String(text || "");
    if (!t) return "";
    if (doc.getTextWidth(t) <= maxWidth) return t;
    while (t.length > 0 && doc.getTextWidth(t + "…") > maxWidth) t = t.slice(0, -1);
    return t ? t + "…" : "";
  };

  let y: number;
  if (margin + 64 + 10 > pageH - margin - 120) {
    doc.addPage();
    y = margin + 60;
  } else {
    y = Math.max(margin + 60, margin + 64 + 10);
  }
  y = Math.max(y, (infoBottomYCalc || 0) + 14);
  // (separator already drawn under header)
  doc.setFontSize(11);
  const blockW = (pageW - margin * 2) / 2 - 8;
  const rx = margin + blockW + 16;

  const tblY = y;
  const colW = blockW;
  
  // Determine amount columns to show
  const showLydCol = true;
  const usdCandidates = ['base_salary_usd','wd_food_usd','gold_bonus_usd','diamond_bonus_usd','other_additions_usd','absence_usd','missing_usd','loan_credit_usd','other_deductions_usd','net_salary_usd','C16'];
  const hasUsd = usdCandidates.some(k => (v2 as any)[k] !== undefined) || (diamondBonusUSDComputed > 0) || (goldBonusUSDComputed > 0);
  const showUsdCol = true; // Always show USD column; blank when 0
  
  // Earnings header (light grey background)
  doc.setDrawColor('#999999');
  (doc as any).setFillColor(240, 240, 240);
  doc.rect(margin, tblY, colW, 26, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text("EARNINGS", margin + 6, tblY + 16);
  // Show LYD and USD columns headers
  if (showLydCol) doc.text("LYD", margin + colW - 160, tblY + 16);
  if (showUsdCol) doc.text("USD", margin + colW - 80, tblY + 16);
  doc.setFont('helvetica', 'normal');
  
  const row = (label: string, lyd: number, usd: number, yy: number) => {
    doc.setDrawColor('#999999');
    (doc as any).setFillColor(240, 240, 240);
    doc.rect(margin, yy, colW, 24, 'F');
    doc.rect(margin, yy, colW, 24);
    doc.text(label, margin + 6, yy + 15);
    const lydStr = Math.max(0, Number(lyd||0)) > 0.0001 ? `${Math.max(0, Number(lyd||0)).toLocaleString(undefined,{maximumFractionDigits:2})}` : '';
    const usdStr = Math.max(0, Number(usd||0)) > 0.0001 ? `${Math.max(0, Number(usd||0)).toLocaleString(undefined,{maximumFractionDigits:2})}` : '';
    doc.setTextColor(34, 139, 34);
    if (showLydCol && lydStr) doc.text(lydStr, margin + colW - 160, yy + 15);
    if (showUsdCol && usdStr) doc.text(usdStr, margin + colW - 80, yy + 15);
    doc.setTextColor(0, 0, 0);
  };
  
  let ey = tblY + 28;
  {
    // Show base salary only (from v2), and food allowance + split bonuses
    const baseLyd = Math.max(0, Number((v2 as any).base_salary_lyd || emp.baseSalary || 0));
    const baseUsd = Math.max(0, Number((v2 as any).base_salary_usd || 0));
    if (baseLyd > 0.0001 || baseUsd > 0.0001) { row("Base Salary", baseLyd, baseUsd, ey); ey += 24; }
    const foodLyd = Math.max(0, Number(foodLydAdjPDF || 0));
    const foodUsd = 0;
    const foodLabel = `Food`;
    if (foodLyd > 0.0001 || foodUsd > 0.0001) { row(foodLabel, foodLyd, foodUsd, ey); ey += 24; }
    const travelLyd = Math.max(0, Number(travelLydPDF || 0));
    if (travelLyd > 0.0001) { row('Transportation', travelLyd, 0, ey); ey += 24; }
    const commLyd = Math.max(0, Number(commLydPDF || 0));
    if (commLyd > 0.0001) { row('Communication', commLyd, 0, ey); ey += 24; }
    const goldLyd = Math.max(0, Number(goldBonusLYDComputed || (v2 as any).gold_bonus_lyd || 0));
    const goldUsd = Math.max(0, Number((v2 as any).gold_bonus_usd || goldBonusUSDComputed || 0));
    const goldLabel = 'Gold Bonus **';
    if (goldLyd > 0.0001 || goldUsd > 0.0001) { row(goldLabel, goldLyd, goldUsd, ey); ey += 24; }
    const diaLyd = Math.max(0, Number(diamondBonusLYDComputed || (v2 as any).diamond_bonus_lyd || 0));
    const diaUsd = Math.max(0, Number(diamondBonusUSDComputed || (v2 as any).diamond_bonus_usd || 0));
    const diaLabel = 'Diamond Bonus *';
    if (diaLyd > 0.0001 || diaUsd > 0.0001) { row(diaLabel, diaLyd, diaUsd, ey); ey += 24; }
    const othLyd = Math.max(0, Number((v2 as any).other_additions_lyd || 0));
    const othUsd = Math.max(0, Number((v2 as any).other_additions_usd || 0));
    if (othLyd > 0.0001 || othUsd > 0.0001) { row("Other Bonus", othLyd, othUsd, ey); ey += 24; }
    // Net Salary row removed per request (only shown in footer boxes)
  }
  
  // Deductions header (light grey background)
  const dx = rx; const dy = tblY;
  doc.setDrawColor('#787575ff');
  (doc as any).setFillColor(240, 240, 240);
  doc.rect(dx, dy, colW, 26, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text("DEDUCTIONS", dx + 6, dy + 16);
  if (showUsdCol) {
    doc.text("USD", dx + colW - 80, dy + 16);
    if (showLydCol) doc.text("LYD", dx + colW - 160, dy + 16);
  } else {
    doc.text("LYD", dx + colW - 80, dy + 16);
  }
  doc.setFont('helvetica', 'normal');
  
  const wd2 = Math.max(1, emp.workingDays || 1);
  const dailyBase2 = (emp.baseSalary || 0) / wd2;
  let aCnt = 0, ulCnt = 0, hlCnt = 0;
  for (let d = 1; d <= dim; d++) {
    const monthStartDate = dayjs(periodStart);
    const effectiveStart = contractStart && contractStart.isAfter(monthStartDate) ? contractStart : monthStartDate;
    const dayDate = monthStartDate.date(d);
    if (contractStart && dayDate.isBefore(effectiveStart, 'day')) continue;
    const day = days[d-1] as TimesheetDay | undefined;
    const isHol = !!day?.isHoliday;
    const isFri = dayjs(periodStart).date(d).day() === 5;
    if (isHol || isFri) continue;
    const c = codeBadge(day);
    if (c === 'A') aCnt += 1;
    else if (c === 'UL') ulCnt += 1;
    else if (c === 'HL') hlCnt += 1;
  }
  
  const dRowsDual: Array<{label:string; lyd:number; usd:number}> = [];
  const absLyd = Math.max(0, Number((v2 as any).absence_lyd || 0));
  const absUsd = Math.max(0, Number((v2 as any).absence_usd || 0));
  if (absLyd > 0.0001 || absUsd > 0.0001) dRowsDual.push({ label: 'Absence', lyd: absLyd, usd: absUsd });
  // Remove Missing Hours row per request
  const advLyd = Math.max(0, Number(advSumLYD || 0));
  if (advLyd > 0.0001) dRowsDual.push({ label: 'Salary Advance', lyd: advLyd, usd: 0 });
  const loanLyd = Math.max(0, Number((adjComp as any).loanPayment || 0));
  const loanUsd = Math.max(0, Number((v2 as any).loan_credit_usd || 0));
  if (loanLyd > 0.0001 || loanUsd > 0.0001) dRowsDual.push({ label: 'Loan Repayment', lyd: loanLyd, usd: loanUsd });
  // Exclude advances from Other Deductions to avoid double counting
  const rawOtherDed = Math.max(0, Number((v2 as any).other_deductions_lyd || 0));
  const otherDedLyd = Math.max(0, rawOtherDed - advLyd);
  const otherDedUsd = Math.max(0, Number((v2 as any).other_deductions_usd || 0));
  if (otherDedLyd > 0.0001 || otherDedUsd > 0.0001) dRowsDual.push({ label: 'Other Deductions', lyd: otherDedLyd, usd: otherDedUsd });
  
  const maxDedRows = 8;
  const dedRendered = Math.min(maxDedRows, Math.max(dRowsDual.length, 0));
  for (let i = 0; i < dedRendered; i++) {
    const yy2 = dy + 28 + i * 24;
    doc.setDrawColor('#999999');
    (doc as any).setFillColor(240, 240, 240);
    doc.rect(dx, yy2, colW, 24, 'F');
    doc.rect(dx, yy2, colW, 24);
    const rr = dRowsDual[i];
    if (rr) {
      doc.setFontSize(8);
      doc.text(rr.label, dx + 6, yy2 + 15);
      const lydStr = Math.max(0, Number(rr.lyd||0)) > 0.0001 ? `${Math.max(0, Number(rr.lyd||0)).toLocaleString(undefined,{maximumFractionDigits:2})} LYD` : '';
      const usdStr = Math.max(0, Number(rr.usd||0)) > 0.0001 ? `${Math.max(0, Number(rr.usd||0)).toLocaleString(undefined,{maximumFractionDigits:2})} USD` : '';
      if (showUsdCol) {
        doc.setTextColor(220, 53, 69);
        if (showLydCol && lydStr) doc.text(lydStr, dx + colW - 160, yy2 + 15);
        if (usdStr) doc.text(usdStr, dx + colW - 80, yy2 + 15);
        doc.setTextColor(0, 0, 0);
      } else {
        const one = lydStr || usdStr;
        doc.setTextColor(220, 53, 69);
        if (one) doc.text(one, dx + colW - 80, yy2 + 15);
        doc.setTextColor(0, 0, 0);
      }
    }
  }

  const dedBlockBottom = dy + 28 + dedRendered * 24 + 8;
  
  const commissionHasValue = false;
  let twoColBottom = 0;
  // Commission Summary — left column (side-by-side with Financial Log)
  const twoColTop = Math.max(ey, dedBlockBottom) + 12;
  if (commissionHasValue) {
    const fullW = pageW - margin * 2;
    const gap = 12;
    const leftW = Math.floor((fullW - gap) * 0.5);
    const leftX = margin;
    const cCols = [Math.floor(leftW * 0.36), Math.floor(leftW * 0.30), leftW - Math.floor(leftW * 0.36) - Math.floor(leftW * 0.30)];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const cTitle = 'Commission Summary';
    const cTitleW = doc.getTextWidth(cTitle);
    doc.text(cTitle, leftX + (leftW - cTitleW)/2, twoColTop + 6);
    doc.setFont('helvetica', 'normal');
    let cy = twoColTop + 14;
    doc.setDrawColor('#999999');
    (doc as any).setFillColor(240, 240, 240);
    // Header
    doc.rect(leftX, cy, cCols[0], 24, 'F');
    doc.rect(leftX + cCols[0], cy, cCols[1], 24, 'F');
    doc.rect(leftX + cCols[0] + cCols[1], cy, cCols[2], 24, 'F');
    doc.rect(leftX, cy, cCols[0], 24);
    doc.rect(leftX + cCols[0], cy, cCols[1], 24);
    doc.rect(leftX + cCols[0] + cCols[1], cy, cCols[2], 24);
    doc.text('Item', leftX + 8, cy + 16);
    doc.text('Amount', leftX + cCols[0] + 8, cy + 16);
    doc.text('Commission', leftX + cCols[0] + cCols[1] + 8, cy + 16);
    cy += 24;
    // Rows
    const gramsUsed = (roleKey === 'sales_lead' || roleKey === 'sales_manager') ? goldGramsScope : goldGramsSelf;
    const goldAmountTxt = `${gramsUsed.toLocaleString('en-US',{maximumFractionDigits:2})} g`;
    const diaAmountTxt = `Items: ${diamondItems.toLocaleString('en-US',{maximumFractionDigits:0})}`;
    const goldCommTxt = `LYD: ${goldBonusLYDComputed.toLocaleString('en-US',{maximumFractionDigits:2})}`;
    const diaCommTxt = `USD: ${diamondBonusUSDComputed.toLocaleString('en-US',{maximumFractionDigits:2})}`;
    const items: Array<{ name:string; amount:string; val:string }> = [];
    if ((goldBonusLYDComputed > 0.0001) || Number((v2 as any).gold_bonus_usd || 0) > 0.0001) {
      items.push({ name: 'Gold', amount: goldAmountTxt, val: goldCommTxt });
    }
    if ((diamondBonusUSDComputed > 0.0001) || Number((v2 as any).diamond_bonus_lyd || 0) > 0.0001) {
      items.push({ name: 'Diamond', amount: diaAmountTxt, val: diaCommTxt });
    }
    items.forEach(it => {
      (doc as any).setFillColor(240, 240, 240);
      doc.rect(leftX, cy, cCols[0], 22, 'F');
      doc.rect(leftX + cCols[0], cy, cCols[1], 22, 'F');
      doc.rect(leftX + cCols[0] + cCols[1], cy, cCols[2], 22, 'F');
      doc.rect(leftX, cy, cCols[0], 22);
      doc.rect(leftX + cCols[0], cy, cCols[1], 22);
      doc.rect(leftX + cCols[0] + cCols[1], cy, cCols[2], 22);
      doc.text(it.name, leftX + 8, cy + 14);
      doc.text(fitText(it.amount, cCols[1]-12), leftX + cCols[0] + 8, cy + 14);
      doc.text(fitText(it.val, cCols[2]-12), leftX + cCols[0] + cCols[1] + 8, cy + 14);
      cy += 22;
    });
    twoColBottom = Math.max(twoColBottom, cy);
  }
  
  // Fetch and render Financial Log (adjustments) if any exist
  let adjRowsPdf: Array<{ type: string; amount: number; currency: string; note?: string; ts?: string }> = [];
  try {
    const url = `http://localhost:9000/hr/payroll/adjustments?year=${year}&month=${month}&employeeId=${emp.id_emp}`;
    const res = await fetch(url, { headers: authHeader() as unknown as HeadersInit });
    if (res.ok) {
      const js = await res.json();
      adjRowsPdf = (js?.data?.[String(emp.id_emp)] || []) as Array<{ type: string; amount: number; currency: string; note?: string; ts?: string }>;
    }
  } catch {}
  
  // Filter out zero-amount adjustments and suppress Financial Log output entirely
  adjRowsPdf = [];
  // Include monthly loan repayment from v2 if present (disabled)
  const loanRepMonth = 0;
  if (loanRepMonth > 0.0001) {
    const ts = dayjs(periodStart).endOf('month').format('YYYY-MM-DD');
    adjRowsPdf.push({ type: 'loan repayment', amount: loanRepMonth, currency: 'LYD', ts } as any);
  }
  
  if (adjRowsPdf.length > 0) {
    if (commissionHasValue) {
      // Right column (side-by-side with Commission Summary)
      const fullW = pageW - margin * 2;
      const gap = 12;
      const leftW = Math.floor((fullW - gap) * 0.5);
      const rightW = fullW - leftW - gap;
      const rightX = margin + leftW + gap;
      const adjCols = [Math.floor(rightW * 0.36), Math.floor(rightW * 0.30), rightW - Math.floor(rightW * 0.36) - Math.floor(rightW * 0.30)];
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      const adjTitle = 'Financial Log';
      const adjTitleW = doc.getTextWidth(adjTitle);
      doc.text(adjTitle, rightX + (rightW - adjTitleW)/2, twoColTop + 6);
      doc.setFont('helvetica', 'normal');
      let ry = twoColTop + 14;
      doc.setDrawColor('#999999');
      (doc as any).setFillColor(240, 240, 240);
      doc.rect(rightX, ry, adjCols[0], 24, 'F');
      doc.rect(rightX + adjCols[0], ry, adjCols[1], 24, 'F');
      doc.rect(rightX + adjCols[0] + adjCols[1], ry, adjCols[2], 24, 'F');
      doc.rect(rightX, ry, adjCols[0], 24);
      doc.rect(rightX + adjCols[0], ry, adjCols[1], 24);
      doc.rect(rightX + adjCols[0] + adjCols[1], ry, adjCols[2], 24);
      doc.text('Date', rightX + 8, ry + 16);
      doc.text('Amount', rightX + adjCols[0] + 8, ry + 16);
      doc.text('Type', rightX + adjCols[0] + adjCols[1] + 8, ry + 16);
      ry += 24;
      const fmtDMY = (s?: string) => s ? dayjs(s).format('DD/MM/YYYY') : '';
      adjRowsPdf.forEach((r) => {
        const dateStr = fmtDMY(r.ts);
        const amtStr = `${r.currency} ${Number(r.amount||0).toFixed(2)}`;
        const nameStr = (r.note && String(r.note).trim().length > 0) ? String(r.note) : (r.type || '');
        (doc as any).setFillColor(240, 240, 240);
        doc.rect(rightX, ry, adjCols[0], 22, 'F');
        doc.rect(rightX + adjCols[0], ry, adjCols[1], 22, 'F');
        doc.rect(rightX + adjCols[0] + adjCols[1], ry, adjCols[2], 22, 'F');
        doc.rect(rightX, ry, adjCols[0], 22);
        doc.rect(rightX + adjCols[0], ry, adjCols[1], 22);
        doc.rect(rightX + adjCols[0] + adjCols[1], ry, adjCols[2], 22);
        doc.text(dateStr, rightX + 8, ry + 14);
        doc.text(amtStr, rightX + adjCols[0] + 8, ry + 14);
        doc.text(fitText(nameStr, adjCols[2]-12), rightX + adjCols[0] + adjCols[1] + 8, ry + 14);
        ry += 22;
      });
      twoColBottom = Math.max(twoColBottom, ry);
    } else {
      // Full-width Financial Log when no commission values
      const fullW = pageW - margin * 2;
      const logTop = Math.max(ey, dedBlockBottom) + 12;
      const adjCols = [140, 160, fullW - 140 - 160];
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      const adjTitle = 'Financial Log';
      const adjTitleW = doc.getTextWidth(adjTitle);
      doc.text(adjTitle, margin + (fullW - adjTitleW)/2, logTop + 6);
      doc.setFont('helvetica', 'normal');
      let ly = logTop + 14;
      doc.setDrawColor('#999999');
      (doc as any).setFillColor(240, 240, 240);
      doc.rect(margin, ly, adjCols[0], 24, 'F');
      doc.rect(margin + adjCols[0], ly, adjCols[1], 24, 'F');
      doc.rect(margin + adjCols[0] + adjCols[1], ly, adjCols[2], 24, 'F');
      doc.rect(margin, ly, adjCols[0], 24);
      doc.rect(margin + adjCols[0], ly, adjCols[1], 24);
      doc.rect(margin + adjCols[0] + adjCols[1], ly, adjCols[2], 24);
      doc.text('Date', margin + 8, ly + 16);
      doc.text('Amount', margin + adjCols[0] + 8, ly + 16);
      doc.text('Type', margin + adjCols[0] + adjCols[1] + 8, ly + 16);
      ly += 24;
      const fmtDMY = (s?: string) => s ? dayjs(s).format('DD/MM/YYYY') : '';
      adjRowsPdf.forEach((r) => {
        const dateStr = fmtDMY(r.ts);
        const amtStr = `${r.currency} ${Number(r.amount||0).toFixed(2)}`;
        const nameStr = (r.note && String(r.note).trim().length > 0) ? String(r.note) : (r.type || '');
        (doc as any).setFillColor(240, 240, 240);
        doc.rect(margin, ly, adjCols[0], 22, 'F');
        doc.rect(margin + adjCols[0], ly, adjCols[1], 22, 'F');
        doc.rect(margin + adjCols[0] + adjCols[1], ly, adjCols[2], 22, 'F');
        doc.rect(margin, ly, adjCols[0], 22);
        doc.rect(margin + adjCols[0], ly, adjCols[1], 22);
        doc.rect(margin + adjCols[0] + adjCols[1], ly, adjCols[2], 22);
        doc.text(dateStr, margin + 8, ly + 14);
        doc.text(amtStr, margin + adjCols[0] + 8, ly + 14);
        doc.text(fitText(nameStr, adjCols[2]-12), margin + adjCols[0] + adjCols[1] + 8, ly + 14);
        ly += 22;
      });
      twoColBottom = Math.max(twoColBottom, ly);
    }
  }
  
  const gridTop = Math.max(ey + 8, dedBlockBottom, twoColBottom + 8);
  const firstDate = dayjs(periodStart);
  
  // Uniform calendar heights
  const rowsNeeded = dim > 15 ? 2 : 1;
  const desiredGap = dim > 15 ? 6 : 0;
  const hWeek = 16;
  const hDayNum = 16;
  const hCell = 40;
  
  const drawRow = (start: number, end: number, topY: number) => {
    const count = Math.max(1, end - start + 1);
    const usableW = pageW - margin * 2;
    const cw = Math.floor(usableW / count);
    const rem = usableW - cw * count;
    
    // Week header - uniform size
    for (let idx = 0; idx < count; idx++) {
      const d = start + idx;
      const x = margin + idx * cw;
      const wAdj = idx === count - 1 ? (cw + rem) : cw;
      const wd = firstDate.date(d).format('ddd');
      (doc as any).setFillColor(240,240,240);
      doc.rect(x, topY, wAdj, hWeek, 'F');
      doc.setDrawColor('#dcdcdc');
      doc.rect(x, topY, wAdj, hWeek);
      doc.setFontSize(8);
      const w = doc.getTextWidth(wd);
      doc.text(wd, x + ((wAdj) - w)/2, topY + hWeek - 3);
    }
    
    // Day numbers - uniform size
    for (let idx = 0; idx < count; idx++) {
      const d = start + idx;
      const x = margin + idx * cw;
      const wAdj = idx === count - 1 ? (cw + rem) : cw;
      doc.setDrawColor('#dcdcdc');
      doc.rect(x, topY + hWeek, wAdj, hDayNum);
      doc.setFontSize(8);
      doc.text(String(d), x + 4, topY + hWeek + hDayNum - 5);
    }
    
    // Cells
    const cellY = topY + hWeek + hDayNum;
    for (let idx = 0; idx < count; idx++) {
      const d = start + idx;
      const x = margin + idx * cw;
      const wAdj = idx === count - 1 ? (cw + rem) : cw;
      const day = days[d-1] || null;
      const badge = codeBadge(day || undefined, schStartMinPDF, schEndMinPDF);
      const isFri = firstDate.date(d).day() === 5;
      const present = !!day?.present;
      let bg: [number,number,number] | null = null;
      
      if (isFri && !present) { bg = [200, 200, 200]; }
      else {
        switch (badge) {
          case 'P': bg = [235, 250, 235]; break;
          case 'PHF': bg = [230,255,230]; break;
          case 'PH':  bg = [255,243,205]; break;
          case 'PT':  bg = [224,247,250]; break;
          case 'PL':  bg = [255,235,238]; break;
          case 'A':   bg = [253,236,234]; break;
          case 'AL':  bg = [220,240,220]; break;
          case 'SL':  bg = [230,230,255]; break;
          case 'EL':  bg = [255,245,230]; break;
          case 'ML':  bg = [240,230,255]; break;
          case 'XL':  bg = [230,255,255]; break;
          case 'BM':  bg = [220,220,220]; break;
          case 'UL':  bg = [255,228,225]; break;
          case 'HL':  bg = [255,255,210]; break;
          default: bg = null;
        }
      }
      if (bg) { (doc as any).setFillColor(bg[0], bg[1], bg[2]); doc.rect(x, cellY, wAdj, hCell, 'F'); }
      doc.setDrawColor('#b7a27d');
      doc.rect(x, cellY, wAdj, hCell);
      doc.setTextColor(0);
      doc.setFontSize(8);
      
      const showCodes = ['P','PH','PHF','PT','PL','A','AL','SL','EL','ML','XL','BM','UL','HL'].includes(badge) && !(isFri && !present);
      if (isFri && !present) {
        doc.setFont('helvetica','bold');
        doc.setFontSize(14);
        const topLeftY = (logoY || margin) + 44;
        const cap = 'PAYSLIP';
        const tw = doc.getTextWidth(cap);
        doc.setTextColor(0,0,0);
        const payY = topLeftY;
        const midX = pageW / 2;
        doc.text(cap, midX - (tw/2), payY);
      } else if (showCodes && badge) {
        doc.setFont('helvetica','bold');
        doc.setFontSize(10);
        const bw = doc.getTextWidth(badge);
        doc.text(badge, x + (wAdj - bw)/2, cellY + 20);
        doc.setFont('helvetica','normal');
      }
      // Missing hours indicator at top-right of cell
      {
        const dm = Number((day as any)?.deltaMin ?? 0);
        const show = Math.abs(dm) >= 45;
        const sgn = dm > 0 ? '+' : (dm < 0 ? '-' : '');
        const abs = Math.abs(dm);
        const hh = Math.floor(abs / 60);
        const mm = Math.floor(abs % 60);
        const txt = show ? `${sgn}${String(hh)}:${String(mm).padStart(2,'0')}` : '';
        doc.setFontSize(7);
        if (show) {
          if (dm < 0) doc.setTextColor(220, 53, 69); else if (dm > 0) doc.setTextColor(34, 139, 34); else doc.setTextColor(0,0,0);
          const tw = doc.getTextWidth(txt);
          doc.text(txt, x + wAdj - tw - 2, cellY + 8);
          doc.setTextColor(0,0,0);
        }
      }
      
      if (badge === 'P' && present) {
        const es = String((day as any)?.entry || '').slice(11,16);
        const ss = String((day as any)?.exit || '').slice(11,16);
        doc.setFontSize(6);
        const base = cellY + hCell - 10;
        if (es) doc.text(`${es}`, x + 3, base);
        if (ss) doc.text(`${ss}`, x + 3, base + 7);
      }
    }
    return topY + hWeek + hDayNum + hCell;
  };
  
  let bottomY = drawRow(1, Math.min(15, dim), gridTop);
  if (dim > 15) bottomY = drawRow(16, dim, bottomY + Math.round(6));

  // Reserve after-grid Y
  let afterGridY = bottomY + 12;
  // Financial Log already rendered above

  // Salary/Allowance change logs
  try {
    const url2 = `http://localhost:9000/hr/payroll/change-logs?year=${year}&month=${month}&employeeId=${emp.id_emp}`;
    const res2 = await fetch(url2, { headers: authHeader() as unknown as HeadersInit });
    if (res2.ok) {
      const js2 = await res2.json();
      const rows2 = (js2?.rows || []) as Array<{ ts?: string; actor?: string; changes?: Record<string,{before:any,after:any}> }>; 
      if (rows2.length > 0) {
        doc.setFontSize(10);
        doc.text('Salary/Allowance Change Log', margin, afterGridY);
        afterGridY += 12;
        doc.setFontSize(8);
        for (const r of rows2) {
          const when = r.ts ? dayjs(r.ts).format('DD/MM/YYYY HH:mm') : '';
          const who = r.actor || '';
          const ch = r.changes || {};
          const fields = Object.keys(ch).slice(0, 4).map(k => `${k}: ${ch[k].before}→${ch[k].after}`).join(', ');
          const lineTxt = `${when}  ${who}  ${fields}`;
          doc.text(fitText(lineTxt, pageW - margin*2), margin, afterGridY);
          afterGridY += 10;
          if (afterGridY > 760) break;
        }
      }
    }
  } catch {}

  // Attendance counts summary
  const counts: Record<string, number> = { P:0, A:0, PT:0, PHF:0, PH:0, PL:0 };
  for (let d = 1; d <= dim; d++) {
    const monthStartDate = dayjs(periodStart);
    const dayDate = monthStartDate.date(d);
    // Skip Fridays in summary (days off)
    if (dayDate.day() === 5) continue;
    const effectiveStart = contractStart && contractStart.isAfter(monthStartDate) ? contractStart : monthStartDate;
    if (contractStart && dayDate.isBefore(effectiveStart, 'day')) continue;
    const badge = codeBadge(days[d-1] || undefined, schStartMinPDF, schEndMinPDF);
    if (badge && badge in counts) counts[badge]++;
  }

  // Full-width tables: Attendance, then Adjustments, then Leaves
  doc.setFontSize(14);
  const tblTop = afterGridY + 8;
  const fullW = pageW - margin*2;

  // Attendance (full-width)
  const allCodes = ['P','A','PT','PHF','PH','PL'] as const;
  const codes = allCodes.filter((c) => Number((counts as any)[c] || 0) > 0);
  const leftW = 80;
  const cellW = Math.floor((fullW - leftW) / Math.max(1, codes.length));
  doc.setFont('helvetica', 'bold');
  const attTitle = 'Attendance Summary';
  const attTitleW = doc.getTextWidth(attTitle);
  doc.setFontSize(10);
  doc.text(attTitle, margin + (fullW - attTitleW)/2, tblTop + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setDrawColor('#b7a27d');
  let ay = tblTop + 14;
  
  const headerBg = (code: string): [number,number,number] | null => {
    switch (code) {
      case 'PHF': return [230,255,230];
      case 'PH':  return [255,243,205];
      case 'PT':  return [224,247,250];
      case 'PL':  return [255,235,238];
      case 'A':   return [253,236,234];
      case 'P':   return [235, 250, 235];
      default:    return null;
    }
  };
  
  doc.rect(margin, ay, leftW, 24);
  codes.forEach((c, i) => {
    const x = margin + leftW + i*cellW;
    const isLast = i === codes.length - 1;
    const wAdj = isLast ? ((fullW - leftW) - (cellW * (codes.length - 1))) : cellW;
    const bg = headerBg(c);
    if (bg) { (doc as any).setFillColor(bg[0], bg[1], bg[2]); doc.rect(x, ay, wAdj, 24, 'F'); }
    doc.rect(x, ay, wAdj, 24);
  });
  doc.text('Code', margin + 8, ay + 16);
  codes.forEach((c, i) => {
    const x = margin + leftW + i*cellW;
    const isLast = i === codes.length - 1;
    const wAdj = isLast ? ((fullW - leftW) - (cellW * (codes.length - 1))) : cellW;
    const tw = doc.getTextWidth(c);
    doc.text(c, x + (wAdj - tw)/2, ay + 16);
  });
  ay += 24;
  
  doc.rect(margin, ay, leftW, 24);
  codes.forEach((c, i) => {
    const x = margin + leftW + i*cellW;
    const isLast = i === codes.length - 1;
    const wAdj = isLast ? ((fullW - leftW) - (cellW * (codes.length - 1))) : cellW;
    doc.rect(x, ay, wAdj, 24);
  });
  doc.text('Count', margin + 8, ay + 16);
  codes.forEach((c, i) => {
    const raw = Number((counts as any)[c] || 0);
    const val = raw > 0 ? String(raw) : '';
    const x = margin + leftW + i*cellW;
    const isLast = i === codes.length - 1;
    const wAdj = isLast ? ((fullW - leftW) - (cellW * (codes.length - 1))) : cellW;
    const tw = doc.getTextWidth(val);
    if (val) doc.text(val, x + (wAdj - tw)/2, ay + 16);
  });
  ay += 24;

  // Missing Hours section removed
  ay = ay;

  // Adjustments table under attendance removed (already shown next to Commission Summary)
  let adjY = ay;

  // Leaves table
  const leavesCols = [Math.floor(fullW*0.28), Math.floor(fullW*0.12), fullW - Math.floor(fullW*0.28) - Math.floor(fullW*0.12)];
  const leavesX = margin;
  let leavesBottomY = adjY;

  const ls = emp.leaveSummary || ({} as Record<string,number>);
  const leaveName: Record<string,string> = { AL:'Annual Leave', SL:'Sick Leave', EL:'Emergency Leave', ML:'Maternity Leave', XL:'Exam Leave', BM:'Bereavement', UL:'Unpaid Leave', HL:'Half-day Leave' };
  const monthStart = dayjs(`${year}-${String(month).padStart(2,'0')}-01`).format('YYYY-MM-DD');
  const monthEnd = dayjs(`${year}-${String(month).padStart(2,'0')}-01`).endOf('month').format('YYYY-MM-DD');
  type LeaveRow = { id_emp:number; type:string|null; date_depart:string; date_end:string; state?:string|null; nbr_jour?: number };
  const leaveRanges: Record<string, Array<{ start:string; end:string }>> = {};
  const leaveDaysByCode: Record<string, number> = {};
  
  try {
    const resLeaves = await fetch(`http://localhost:9000/leave/vacations-range?from=${monthStart}&to=${monthEnd}`, { headers: authHeader() as unknown as HeadersInit });
    if (resLeaves.ok) {
      const rows = await resLeaves.json() as LeaveRow[];
      const my = rows.filter(r => Number(r.id_emp) === Number(emp.id_emp) && String(r.state||'').toLowerCase() !== 'rejected');
      for (const r of my) {
        const code = (r.type || '').toUpperCase();
        if (!code || !(code in leaveName)) continue;
        const s = dayjs(r.date_depart);
        const e = dayjs(r.date_end);
        const ms = dayjs(monthStart);
        const me = dayjs(monthEnd);
        const startLimit = (contractStart && contractStart.isAfter(ms)) ? contractStart : ms;
        let sClamp = s.isAfter(startLimit) ? s : startLimit;
        const eClamp = e.isBefore(me) ? e : me;
        if (eClamp.isBefore(sClamp)) continue;
        (leaveRanges[code] ||= []).push({ start: sClamp.format('DD/MM/YYYY'), end: eClamp.format('DD/MM/YYYY') });
        const incDays = Math.max(0, eClamp.diff(sClamp, 'day') + 1);
        leaveDaysByCode[code] = (leaveDaysByCode[code] || 0) + incDays;
      }
    }
  } catch {}
  
  const leaves = Object.keys(leaveName).filter(k => (ls as any)[k] != null || leaveRanges[k]?.length);
  if (leaves.length) {
    const leavesTitleY = adjY + 8;
    let ly2 = leavesTitleY + 14;
    doc.setFont('helvetica', 'bold');
    const leavesTitle = 'Leaves This Month';
    const leavesTitleW = doc.getTextWidth(leavesTitle);
    doc.setFontSize(10);
    doc.text(leavesTitle, margin + (fullW - leavesTitleW)/2, leavesTitleY + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setDrawColor('#b7a27d');
    
    doc.rect(leavesX, ly2, leavesCols[0], 24);
    doc.rect(leavesX + leavesCols[0], ly2, leavesCols[1], 24);
    doc.rect(leavesX + leavesCols[0] + leavesCols[1], ly2, leavesCols[2], 24);
    const lh1='Leave', lh2='Days', lh3='Dates';
    doc.text(lh1, leavesX + 8, ly2 + 16);
    doc.text(lh2, leavesX + leavesCols[0] + 8, ly2 + 16);
    doc.text(lh3, leavesX + leavesCols[0] + leavesCols[1] + 8, ly2 + 16);
    ly2 += 24;
    
    leaves.forEach((k)=>{
      const ranges = (leaveRanges[k]||[]).map(r => `${r.start} — ${r.end}`).join(', ');
      const days = leaveDaysByCode[k] || (ls as any)[k] || 0;
      doc.rect(leavesX, ly2, leavesCols[0], 16);
      doc.rect(leavesX + leavesCols[0], ly2, leavesCols[1], 16);
      doc.rect(leavesX + leavesCols[0] + leavesCols[1], ly2, leavesCols[2], 16);
      doc.text(`${leaveName[k]||k} (${k})`, leavesX + 6, ly2 + 11);
      const dStr = String(days);
      const dw = doc.getTextWidth(dStr);
      doc.text(dStr, leavesX + leavesCols[0] + (leavesCols[1]-dw)/2, ly2 + 11);
      doc.text(fitText(ranges, leavesCols[2]-12), leavesX + leavesCols[0] + leavesCols[1] + 6, ly2 + 11);
      ly2 += 16;
    });
    leavesBottomY = ly2;
  }

  // Net Salary at absolute bottom (after attendance summary)
  // Adjust nets to include computed commissions (replace any v2 gold/diamond entries with computed ones)
  const netLydFinal = Math.max(0, Number(netLyd.toFixed(2)));
  const netUsdFinal = Math.max(0, Number(netUsd.toFixed(2)));
  // Always show USD box alongside LYD to avoid hiding when source is 0 or missing
  const showUsd = true;
  const boxWBoth = Math.floor((pageW - margin * 2 - 12) / 2);
  const boxWSolo = pageW - margin * 2;
  const boxH = 40;
  const neededHeight = boxH + 70; // boxes + signature area
  let finalY = pageH - margin - neededHeight; // anchor to bottom of current page
  const contentBottom = Math.max(ay, adjY, leavesBottomY) + 20;
  if (contentBottom + neededHeight > pageH - margin) {
    // Start a new page for the footer to avoid overlap
    doc.addPage();
    try { (doc as any).setFillColor(245,245,245); (doc as any).rect(0,0,pageW, doc.internal.pageSize.getHeight(), 'F'); } catch {}
    finalY = doc.internal.pageSize.getHeight() - margin - neededHeight;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);

  if (showUsd) {
    // LYD box (left)
    (doc as any).setFillColor(205, 205, 205); // header grey
    doc.rect(margin, finalY, boxWBoth, boxH, 'F');
    (doc as any).setDrawColor(0, 0, 0);
    doc.rect(margin, finalY, boxWBoth, boxH);
    doc.setTextColor(0, 0, 0);
    doc.text('Net Pay (LYD)', margin + 8, finalY + 16);
    doc.setFontSize(14);
    const lydValLeft = netLydFinal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    doc.setTextColor(0, 0, 0);
    doc.text(lydValLeft, margin + boxWBoth - doc.getTextWidth(lydValLeft) - 8, finalY + 28);
    
    // USD box (right)
    doc.setFontSize(11);
    (doc as any).setFillColor(205, 205, 205); // header grey
    doc.rect(margin + boxWBoth + 12, finalY, boxWBoth, boxH, 'F');
    (doc as any).setDrawColor(0, 0, 0);
    doc.rect(margin + boxWBoth + 12, finalY, boxWBoth, boxH);
    doc.setTextColor(0, 0, 0);
    doc.text('Net Pay (USD)', margin + boxWBoth + 12 + 8, finalY + 16);
    doc.setFontSize(14);
    const usdValRight = netUsdFinal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    doc.setTextColor(0, 0, 0);
    doc.text(usdValRight, margin + boxWBoth + 12 + boxWBoth - doc.getTextWidth(usdValRight) - 8, finalY + 28);
  } else {
    // Only LYD
    (doc as any).setFillColor(205, 205, 205);
    doc.rect(margin, finalY, boxWSolo, boxH, 'F');
    (doc as any).setDrawColor(0, 0, 0);
    doc.rect(margin, finalY, boxWSolo, boxH);
    doc.setTextColor(0, 0, 0);
    doc.text('Net Pay (LYD)', margin + 8, finalY + 16);
    doc.setFontSize(14);
    const lydVal = netLyd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    doc.setTextColor(0,0,0);
    doc.text(lydVal, margin + boxWSolo - doc.getTextWidth(lydVal) - 8, finalY + 28);
  }

  // Footnotes for commissions just above the signature
  try {
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    doc.setTextColor(0,0,0);
    const goldWeightUsed = (commissionRole === 'sales_lead' || commissionRole === 'sales_manager') ? goldGramsScope : goldGramsSelf;
    const foot1 = `* Diamond items sold: ${Number(diamondItems||0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    const foot2 = `** Gold grams sold: ${Number(goldWeightUsed||0).toLocaleString('en-US', { maximumFractionDigits: 2 })} g`;
    const footY = finalY + boxH + 20;
    doc.text(foot1, margin, footY);
    doc.text(foot2, margin, footY + 12);
  } catch {}

  // Employee Signature field lower near the absolute bottom (label only)
  const sigY = Math.min(doc.internal.pageSize.getHeight() - margin - 22, finalY + boxH + 40);
  const sigWidth = 360;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  const sigLabel = 'Employee signature';
  const sigLabelX = pageW - margin - sigWidth;
  doc.text(sigLabel, sigLabelX, sigY);
  try {
    const tw = doc.getTextWidth(sigLabel);
    const x1 = sigLabelX + tw + 6;
    const x2 = pageW - margin;
    doc.setDrawColor('#999999');
    (doc as any).setLineWidth(1);
    if (x2 > x1) doc.line(x1, sigY + 2, x2, sigY + 2);
  } catch {}

  // Printed on at lower-left corner
  try {
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    doc.setTextColor(0,0,0);
    const footerY = doc.internal.pageSize.getHeight() - Math.max(12, margin/2);
    doc.text(printedOnStr, margin, footerY);
  } catch {}

  const dataUrl = doc.output("datauristring");
  const blobUrl = (doc as any).output('bloburl');
  const safeName = String(emp.name || emp.id_emp).trim().replace(/\s+/g, '_');
  const periodTag = dayjs(periodStart).format('MMM_YYYY');
  const filename = `${safeName}_Payslip_${periodTag}.pdf`;
  return { dataUrl, blobUrl, filename };
};

  const exportPdfClient = async (emp: Payslip) => {
    try {
      const { dataUrl, blobUrl, filename } = await buildPayslipPdf(emp);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      a.click();
    } catch (e) {
      alert((e as any)?.message || 'Failed to build PDF');
    }
  };

  const sendPayslipEmailClient = async (emp: Payslip) => {
    try {
      const days = await ensureTimesheetDays(emp.id_emp);
      const { dataUrl, filename } = await buildPayslipPdf(emp);
      const prettyMonth = dayjs(`${year}-${String(month).padStart(2,'0')}-01`).format('MMMM YYYY');
      const subject = `Payslip — ${prettyMonth}`;
      // Recompute with overrides for email summary
      const baseLyd = Number(emp.components?.basePay || 0);
      const allowLyd = Number(emp.components?.allowancePay || 0);
      const netLyd = Number(emp.total || 0);
      const netUsd = usdToLyd > 0 ? Number((netLyd / usdToLyd).toFixed(2)) : 0;
      // Counts and missing hours
      const totalMissingMin = days.reduce((acc, d) => acc + ((d?.deltaMin ?? 0) < 0 ? Math.abs(d!.deltaMin!) : 0), 0);
      const mh = Math.floor(totalMissingMin / 60); const mm = Math.floor(totalMissingMin % 60);
      const counts: Record<string, number> = { P:0, A:0, PHF:0, PH:0, PT:0, PL:0 };
      days.forEach(d => { const c = (codeBadge(d) || ''); if (c in counts) counts[c]++; });
      // Fetch adjustments and leaves for email (DD/MM/YYYY; leaves use working days only)
      const adjUrl = `http://localhost:9000/hr/payroll/adjustments?year=${year}&month=${month}&employeeId=${emp.id_emp}`;
      let adjRows: Array<{ ts?:string; type:string; amount:number; currency:string; note?:string }> = [];
      try {
        const r = await fetch(adjUrl, { headers: authHeader() as unknown as HeadersInit });
        if (r.ok) { const js = await r.json(); adjRows = (js?.data?.[String(emp.id_emp)] || []) as any[]; }
      } catch {}
      const monthStart = dayjs(`${year}-${String(month).padStart(2,'0')}-01`).format('YYYY-MM-DD');
      const monthEnd = dayjs(`${year}-${String(month).padStart(2,'0')}-01`).endOf('month').format('YYYY-MM-DD');
      type LeaveRow2 = { id_emp:number; type:string|null; date_depart:string; date_end:string; state?:string|null; nbr_jour?:number };
      const leaveName: Record<string,string> = { AL:'Annual Leave', SL:'Sick Leave', EL:'Emergency Leave', ML:'Maternity Leave', XL:'Exam Leave', BM:'Bereavement', UL:'Unpaid Leave', HL:'Half-day Leave' };
      const leaveRanges: Record<string, Array<{ start:string; end:string }>> = {};
      const leaveDaysByCode: Record<string, number> = {};
      try {
        const r = await fetch(`http://localhost:9000/leave/vacations-range?from=${monthStart}&to=${monthEnd}`, { headers: authHeader() as unknown as HeadersInit });
        if (r.ok) {
          const rows = await r.json() as LeaveRow2[];
          const my = rows.filter(v => Number(v.id_emp) === Number(emp.id_emp) && String(v.state||'').toLowerCase() !== 'rejected');
          my.forEach(v => {
            const code = (v.type||'').toUpperCase(); if (!code || !(code in leaveName)) return;
            const s = dayjs(v.date_depart); const e = dayjs(v.date_end);
            const ms = dayjs(monthStart); const me = dayjs(monthEnd);
            const sClamp = s.isAfter(ms)?s:ms; const eClamp = e.isBefore(me)?e:me;
            (leaveRanges[code] ||= []).push({ start: sClamp.format('DD/MM/YYYY'), end: eClamp.format('DD/MM/YYYY') });
            leaveDaysByCode[code] = (leaveDaysByCode[code]||0) + Number(v.nbr_jour||0);
          });
        }
      } catch {}

      const b = '#b7a27d';
      const th = 'style="font-weight:700;text-align:center;border:1px solid '+b+';padding:6px;"';
      const td = 'style="border:1px solid '+b+';padding:6px;"';
      const tdC = 'style="border:1px solid '+b+';padding:6px;text-align:center;"';
      const section = (title: string, header: string[], rows: string[][]) => `
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0;">
          <tr><td colspan="${header.length}" style="text-align:center;font-weight:700;padding:4px 0;">${title}</td></tr>
          <tr>${header.map(h=>`<td ${th}>${h}</td>`).join('')}</tr>
          ${rows.map(r=>`<tr>${r.map((c,i)=>`<td ${i===1?tdC:td}>${c}</td>`).join('')}</tr>`).join('')}
        </table>`;

      const attRowsEmail: string[][] = [
        ['Present (P)', String(counts.P)],
        ['Absent (A)', String(counts.A)],
        ['Present (Friday) (PT)', String(counts.PT)],
        ['Public Holiday (Worked) (PHF)', String(counts.PHF)],
        ['Public Holiday (PH)', String(counts.PH)],
        ['Partial/Late (PL)', String(counts.PL)],
      ];
      const adjRowsEmail: string[][] = (adjRows||[]).map(r=>[
        r.ts ? dayjs(r.ts).format('DD/MM/YYYY') : '',
        `${r.currency} ${Number(r.amount||0).toFixed(2)}`,
        r.note ? String(r.note) : ''
      ]);
      const leaveRowsEmail: string[][] = Object.keys(leaveName)
        .filter(k=>leaveRanges[k]?.length)
        .map(k=>[
          `${leaveName[k]} (${k})`,
          String(leaveDaysByCode[k]||0),
          leaveRanges[k].map(r=>`${r.start} — ${r.end}`).join(', ')
        ]);

      const grid = `
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:10px 0;width:100%;">
          <tr>
            <td valign="top" style="padding-right:12px;">${section('Attendance Summary',['Code','Count'], attRowsEmail)}</td>
            <td valign="top" style="padding:0 12px;">${section('Adjustments Log',['Date','Amount','Note'], adjRowsEmail)}</td>
            <td valign="top" style="padding-left:12px;">${section('Leaves This Month',['Leave','Days','Dates'], leaveRowsEmail)}</td>
          </tr>
        </table>`;

      const html = `
        <div style="font-family:Inter,Arial,sans-serif;">
          <h2 style="margin:0 0 8px;">${emp.name}'s Payslip — ${prettyMonth}</h2>
          <p style="margin:0 0 8px;">Dear ${emp.name} (ID: ${emp.id_emp}),</p>
          <p style="margin:0 0 8px;">Please find attached your payslip. Summary below:</p>
          ${grid}
          <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;border:1px solid ${b};min-width:520px;margin-top:8px;">
            <tr><td><b>Working days</b></td><td>${emp.workingDays}</td><td><b>Missing Hours</b></td><td>${String(mh).padStart(2,'0')}:${String(mm).padStart(2,'0')}</td></tr>
            <tr><td><b>Base salary (used)</b></td><td>${emp.baseSalary.toFixed(2)} LYD</td><td><b>Allowance/day (used)</b></td><td>${emp.allowancePerDay.toFixed(2)} LYD</td></tr>
            <tr><td><b>Base Pay</b></td><td>${baseLyd.toFixed(2)} LYD</td><td><b>Allowance Pay</b></td><td>${allowLyd.toFixed(2)} LYD</td></tr>
            <tr><td><b>Net Pay (USD)</b></td><td>${netUsd.toFixed(2)}</td><td><b>Net Pay (LYD)</b></td><td>${netLyd.toFixed(2)}</td></tr>
            <tr><td><b>Total</b></td><td colspan="3"><b>${netLyd.toFixed(2)} LYD</b></td></tr>
          </table>
          <p style="margin:8px 0 0;">If anything looks incorrect, please contact HR.</p>
        </div>`;
      await sendPayslipClient({ employeeId: emp.id_emp, year, month, pdfBase64: dataUrl, filename, subject, html });
      alert("Payslip sent");
    } catch (e: any) {
      alert(e?.message || "Failed to send payslip");
    }
  };

  return (
    <Box p={2}>
      <Card sx={{ mb: 2 }}>
  <CardContent>
    <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }} TabIndicatorProps={{ sx: { display: 'none' } }}>
      <Tab label={t("Payroll") || "Payroll"} value="payroll" />
      <Tab label={t("Salary Advance") || "Salary Advance"} value="advances" />
      <Tab label={t("Loans") || "Loans"} value="loans" />
      {isAdmin && (<Tab label={t("Settings") || "Settings"} value="settings" />)}
    </Tabs>

    {tab === "payroll" && (
      <Box display="flex" flexWrap="wrap" alignItems="center" gap={2}>
        <Box minWidth={140}>
          <TextField
            select
            fullWidth
            label={t("hr.timesheets.year") || "Year"}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            size="small"
          >
            {years.map((yy) => (
              <MenuItem key={yy} value={yy}>
                {yy}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Box minWidth={140}>
          <TextField
            select
            fullWidth
            label={t("hr.timesheets.month") || "Month"}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            size="small"
          >
            {months.map((mm) => (
              <MenuItem key={mm} value={mm}>
                {String(mm).padStart(2, "0")}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Box minWidth={160}>
          <TextField
            select
            fullWidth
            label={t("hr.timesheets.psPoint") || "PS"}
            value={ps}
            onChange={(e) => setPs(e.target.value)}
            size="small"
          >
            <MenuItem value="">
              {t("hr.timesheets.allPs") || "All PS"}
            </MenuItem>
            {psOptions.map((p) => (
              <MenuItem key={String(p.PS)} value={String(p.PS)}>
                {`${formatPs(p.PS)} (${p.count})`}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Box minWidth={200}>
          <TextField
            size="small"
            fullWidth
            label={t("Search") || "Search"}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </Box>

        {/* Actions: export CSV, export PDF, save, close month */}
        <Box display="flex" flexWrap="wrap" alignItems="center" gap={1.5}>
          <Button
            variant="outlined"
            onClick={async () => {
              // Export CSV
              const headers: string[] = [
                "Employee",
                "Working Days",
                "Deduction Days",
                "Present Days",
                "Holidays Worked",
                "Base Salary",
                "Food",
                "Transportation",
                "Communication",
                "Base Pay",
                "Allowance Pay",
              ];
              if (cols.adjustments) headers.push("Adjustments");
              if (cols.salesQty) headers.push("Sales Qty");
              if (cols.salesTotal) headers.push("Sales Total (LYD)");
              headers.push("Total (LYD)");
              if (cols.totalUsd) headers.push("Total (USD)");
              const lines = [headers.join(",")];
              displayedRows.forEach((e) => {
                const s = sales[String(e.id_emp)] || {
                  qty: 0,
                  total_lyd: 0,
                };
                const adj = e.components?.adjustments || {
                  bonus: 0,
                  deduction: 0,
                  advance: 0,
                  loanPayment: 0,
                };
                const netAdj =
                  (adj.bonus || 0) -
                  ((adj.deduction || 0) +
                    (adj.advance || 0) +
                    (adj.loanPayment || 0));
                const W = Math.max(1, e.workingDays || 1);
                const F =
                  e.factorSum != null && e.factorSum > 0
                    ? e.factorSum
                    : (e.components?.basePay || 0) /
                      (Math.max(1, e.baseSalary || 0) / W);
                const baseUsd = e.baseSalaryUsd ? (e.baseSalaryUsd / W) * F : 0;
                const vr = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(e.id_emp)) || {};
                const commUsd = Number((vr as any).diamond_bonus_usd || 0) + Number((vr as any).gold_bonus_usd || 0);
                const row: any[] = [
                  `${e.name}`,
                  e.workingDays,
                  e.deductionDays,
                  e.presentWorkdays,
                  e.holidayWorked,
                  (e.baseSalary || 0).toFixed(2),
                  (() => {
                    const W = Math.max(1, e.workingDays || 1);
                    const vr = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(e.id_emp)) || {};
                    let foodPer = Number((e as any).FOOD || (e as any).FOOD_ALLOWANCE || 0);
                    if (!foodPer) {
                      const totalFoodLyd = Number((vr as any).wd_food_lyd || 0);
                      foodPer = totalFoodLyd && W ? totalFoodLyd / W : 0;
                    }
                    const present = Number(presentDaysMap[e.id_emp] ?? e.presentWorkdays ?? 0) || 0;
                    const fd = present;
                    const v = foodPer * fd;
                    return (Number.isFinite(v) ? v : 0).toFixed(2);
                  })(),
                  (() => {
                    const W = Math.max(1, e.workingDays || 1);
                    const vr = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(e.id_emp)) || {};
                    const fuel = Number(((e as any).FUEL ?? (vr as any).FUEL) || 0);
                    return (fuel * W).toFixed(2);
                  })(),
                  (() => {
                    const W = Math.max(1, e.workingDays || 1);
                    const vr = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(e.id_emp)) || {};
                    const comm = Number(((e as any).COMMUNICATION ?? (vr as any).COMMUNICATION) || 0);
                    return (comm * W).toFixed(2);
                  })(),
                  (e.components?.basePay || 0).toFixed(2),
                  (e.components?.allowancePay || 0).toFixed(2),
                ];
                if (cols.adjustments) row.push(netAdj.toFixed(2));
                if (cols.salesQty) row.push((s.qty || 0).toFixed(0));
                if (cols.salesTotal)
                  row.push((s.total_lyd || 0).toFixed(2));
                { row.push(computeNetLYDFor(e.id_emp).toFixed(2)); }
                if (cols.totalUsd) { const vr=(v2Rows||[]).find((x:any)=>Number(x.id_emp)===Number(e.id_emp))||{}; const commUsd=Number((vr as any).diamond_bonus_usd||0)+Number((vr as any).gold_bonus_usd||0); const totalUsdVal=baseUsd+commUsd; row.push(totalUsdVal.toFixed(2)); }
                lines.push(row.join(","));
              });
              const blob = new Blob([lines.join("\n")], {
                type: "text/csv;charset=utf-8;",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `payroll_${year}-${String(month).padStart(
                2,
                "0"
              )}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            {t("Export CSV") || "Export CSV"}
          </Button>

          <Button
            variant="outlined"
            onClick={async () => {
              const doc = new jsPDF({
                orientation: "landscape",
                unit: "pt",
                format: "a4",
              });
              doc.setFontSize(12);
              doc.text(
                `Payroll ${year}-${String(month).padStart(2, "0")}`,
                36,
                32
              );
              let y0 = 48;
              const header = [
                "Employee",
                "WD",
                "DD",
                "PD",
                "HW",
                "Base",
                "Allow",
              ];
              const colX: number[] = [36, 220, 260, 300, 340, 380, 450];
              if (cols.adjustments) {
                header.push("Adj");
                colX.push(520);
              }
              if (cols.salesQty) {
                header.push("Qty");
                colX.push(560);
              }
              if (cols.salesTotal) {
                header.push("Sales");
                colX.push(600);
              }
              header.push("Total");
              colX.push(660);
              if (cols.totalUsd) {
                header.push("USD");
                colX.push(720);
              }
              header.forEach((h, i) => doc.text(h, colX[i], y0));
              y0 += 16;
              displayedRows.forEach((e) => {
                const s = sales[String(e.id_emp)] || {
                  qty: 0,
                  total_lyd: 0,
                };
                const adj = e.components?.adjustments || {
                  bonus: 0,
                  deduction: 0,
                  advance: 0,
                  loanPayment: 0,
                };
                const netAdj =
                  (adj.bonus || 0) -
                  ((adj.deduction || 0) +
                    (adj.advance || 0) +
                    (adj.loanPayment || 0));
                const W = Math.max(1, e.workingDays || 1);
                const F =
                  e.factorSum != null && e.factorSum > 0
                    ? e.factorSum
                    : (e.components?.basePay || 0) /
                      (Math.max(1, e.baseSalary || 0) / W);
                const baseUsd = e.baseSalaryUsd
                  ? (e.baseSalaryUsd / W) * F
                  : 0;
                const vr = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(e.id_emp)) || {};
                const commUsd = Number((vr as any).diamond_bonus_usd || 0) + Number((vr as any).gold_bonus_usd || 0);
                const vals: any[] = [
                  e.name,
                  e.workingDays,
                  e.deductionDays,
                  e.presentWorkdays,
                  e.holidayWorked,
                  (e.components?.basePay || 0).toFixed(0),
                  (e.components?.allowancePay || 0).toFixed(0),
                ];
                if (cols.adjustments) vals.push(netAdj.toFixed(0));
                if (cols.salesQty) vals.push((s.qty || 0).toFixed(0));
                if (cols.salesTotal)
                  vals.push((s.total_lyd || 0).toFixed(0));
                { vals.push(computeNetLYDFor(e.id_emp).toFixed(0)); }
                if (cols.totalUsd) vals.push((baseUsd + commUsd).toFixed(0));
                vals.forEach((v, i) => doc.text(String(v), colX[i], y0));
                y0 += 14;
                if (y0 > 560) {
                  doc.addPage();
                  y0 = 36;
                }
              });
              doc.save(
                `payroll_${year}_${String(month).padStart(2, "0")}.pdf`
              );
            }}
          >
            {t("Export PDF") || "Export PDF"}
          </Button>

          <Button
            variant="contained"
            disabled={viewOnly}
            onClick={async () => {
              try {
                await savePayrollV2({ year, month, rows: v2Rows });
                alert("Saved");
              } catch (e: any) {
                alert(e?.message || "Failed to save");
              }
            }}
          >
            {t("Save Month") || "Save Month"}
          </Button>

          <Button
            variant="outlined"
            disabled={viewOnly}
            onClick={async () => {
              const bankAcc = window.prompt("Bank/Cash Account No", "");
              if (!bankAcc) return;
              const salaryExpenseAcc = window.prompt(
                "Salary Expense Account No",
                ""
              );
              if (!salaryExpenseAcc) return;
              const note = window.prompt("Note", "");
              try {
                await closePayrollV2({
                  year,
                  month,
                  bankAcc,
                  salaryExpenseAcc,
                  note: note || undefined,
                });
                alert("Month closed");
                setViewOnly(true);
              } catch (e: any) {
                alert(e?.message || "Failed to close");
              }
            }}
          >
            {t("Close Month") || "Close Month"}
          </Button>
        </Box>
      </Box>
    )}

    {tab === "advances" && (
            <Box display="grid" gap={2}>
              <Typography variant="subtitle1">{t("Salary Advance")}</Typography>
              <TextField
                select
                size="small"
                label={t("Employee") || "Employee"}
                value={adjEmpId || ""}
                onChange={(e) => setAdjEmpId(Number(e.target.value) || null)}
                sx={{ maxWidth: 400 }}
              >
                {(result?.employees || []).map((emp) => (
                  <MenuItem key={emp.id_emp} value={emp.id_emp}>
                    {emp.name} (ID: {emp.id_emp})
                  </MenuItem>
                ))}
              </TextField>
              {(() => {
                const emp = (result?.employees || []).find((x) => x.id_emp === adjEmpId);
                if (!emp) return null;
                const salary = Number(emp.baseSalary || 0);
                const maxAdvance = salary * 0.5;
                const availableAdvance = Math.max(0, maxAdvance - existingAdvances);
                return (
                  <Box display="grid" gap={1.5} maxWidth={400}>
                    <Typography variant="caption">
                      Salary: {salary.toFixed(2)} LYD | Existing Advances: {existingAdvances.toFixed(2)} LYD
                    </Typography>
                    <TextField
                      size="small"
                      type="number"
                      label={t("LYD") || "LYD"}
                      value={adjForm.amount}
                      onChange={(e) => {
                        const v = Number(e.target.value || 0);
                        const clamped = Math.min(Math.max(v, 0), availableAdvance);
                        setAdjForm((f) => ({ ...f, amount: String(clamped) }));
                      }}
                      inputProps={{ step: "0.01", min: 0, max: availableAdvance }}
                      helperText={`Available: ${availableAdvance.toFixed(2)} LYD (50% - existing advances)`}
                    />
                    <Button
                      variant="contained"
                      onClick={async () => {
                        if (!adjEmpId || !adjForm.amount) return;
                        setAdjLoading(true);
                        try {
                          const amt = Number(adjForm.amount);
                          if (amt > availableAdvance) {
                            alert(`Amount exceeds available advance (${availableAdvance.toFixed(2)} LYD)`);
                            setAdjLoading(false);
                            return;
                          }
                          if (amt + existingAdvances > maxAdvance) {
                            alert(`Total advances cannot exceed 50% of salary (${maxAdvance.toFixed(2)} LYD)`);
                            setAdjLoading(false);
                            return;
                          }
                          const payload = {
                            year,
                            month,
                            employeeId: adjEmpId,
                            type: "advance",
                            amount: amt,
                            currency: "LYD",
                            note: "salary advance",
                          };
                          const res = await fetch(`http://localhost:9000/hr/payroll/adjustments`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", ...authHeader() } as unknown as HeadersInit,
                            body: JSON.stringify(payload),
                          });
                          if (!res.ok) throw new Error("Failed to add advance");
                          await onRun();
                          setAdjForm({ type: "bonus", amount: "", currency: "LYD", note: "" });
                          alert("Advance added");
                        } catch (e: any) {
                          alert(e?.message || "Failed");
                        } finally {
                          setAdjLoading(false);
                        }
                      }}
                    >
                      {t("Add Advance") || "Add Advance"}
                    </Button>
                  </Box>
                );
              })()}
            </Box>
    )}

    {tab === "loans" && (
              <Box display="grid" gap={2}>
                <Typography variant="subtitle1">{t("Create Loan")}</Typography>
                <TextField
                  select
                  size="small"
                  label={t("Employee") || "Employee"}
                  value={adjEmpId || ""}
                  onChange={(e) => setAdjEmpId(Number(e.target.value) || null)}
                  sx={{ maxWidth: 400 }}
                >
                  {(result?.employees || []).map((emp) => (
                    <MenuItem key={emp.id_emp} value={emp.id_emp}>
                      {emp.name} (ID: {emp.id_emp})
                    </MenuItem>
                  ))}
                </TextField>
                {(() => {
                  const emp = (result?.employees || []).find((x) => x.id_emp === adjEmpId);
                  if (!emp) return null;
                  return (
                    <Box display="grid" gap={1.5} maxWidth={400}>
                      <Typography variant="caption">
                        Salary: {emp.baseSalary.toFixed(2)} LYD
                      </Typography>
                      {(() => {
                        const csStr = contractStartMap[adjEmpId!] || null;
                        const cs = csStr ? dayjs(csStr) : null;
                        const eligible = cs && cs.isValid() ? cs.add(1, 'year') : null;
                        const now = dayjs();
                        return (
                          <Box sx={{ p: 1, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              Contract start: {cs && cs.isValid() ? cs.format('DD/MM/YYYY') : '—'}
                            </Typography>
                            <br />
                            <Typography variant="caption" color={eligible && eligible.isBefore(now) ? 'success.main' : 'warning.main'}>
                              Earliest loan eligibility: {eligible ? eligible.format('DD/MM/YYYY') : '—'} {eligible ? (eligible.isBefore(now) ? '(eligible)' : '(not yet)') : ''}
                            </Typography>
                          </Box>
                        );
                      })()}
                      <TextField
                        size="small"
                        type="number"
                        label={t("LYD") || "LYD"}
                        value={loanAmount}
                        onChange={(e) => setLoanAmount(e.target.value)}
                        inputProps={{ step: "0.01", min: 0 }}
                        helperText={t('Enter loan principal amount') || 'Enter loan principal amount'}
                      />
                      <Button
                        variant="contained"
                        onClick={async () => {
                          if (!adjEmpId || !loanAmount) return;
                          setAdjLoading(true);
                          try {
                            const principal = Number(loanAmount);
                            if (principal <= 0) {
                              alert("Loan amount must be greater than 0");
                              setAdjLoading(false);
                              return;
                            }
                            const vr = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(adjEmpId)) || {} as any;
                            const csRaw = contractStartMap[adjEmpId!] || (vr as any).CONTRACT_START || (vr as any).contract_start || (vr as any).contractStart || (vr as any).T_START;
                            if (!csRaw) {
                              alert('Employee contract start date is missing. Loans are only available 1 year after contract start.');
                              setAdjLoading(false);
                              return;
                            }
                            const cs = dayjs(csRaw);
                            if (!cs.isValid() || dayjs().isBefore(cs.add(1, 'year'))) {
                              alert('Loan not available: must be at least 1 year after contract start date.');
                              setAdjLoading(false);
                              return;
                            }
                            await createV2Loan({
                              employeeId: adjEmpId,
                              principal,
                              startYear: year,
                              startMonth: month,
                              monthlyPercent: 0.25,
                              capMultiple: 3,
                            });
                            try {
                              const empName = (result?.employees || []).find((x)=>x.id_emp===adjEmpId)?.name || String(adjEmpId);
                              const toList = [
                                ...String(hrEmails||'').split(',').map(s=>s.trim()),
                                ...String(financeEmails||'').split(',').map(s=>s.trim()),
                              ].filter(Boolean).join(',');
                              if (toList) {
                                const doc2 = new jsPDF({ unit: 'pt', format: 'a4' });
                                doc2.setFontSize(14);
                                doc2.text('Loan Issued', 36, 36);
                                doc2.setFontSize(11);
                                doc2.text(`Employee: ${empName} (ID: ${adjEmpId})`, 36, 56);
                                doc2.text(`Principal: ${principal.toFixed(2)} LYD`, 36, 72);
                                doc2.text(`Start: ${String(year)}-${String(month).padStart(2,'0')}`, 36, 88);
                                doc2.text(`Monthly Deduction: 25%`, 36, 104);
                                const dataUrl2 = doc2.output('datauristring');
                                const subject = `Loan Issued — ${empName} (${adjEmpId})`;
                                const html = `<div><p>Loan issued for employee <b>${empName}</b> (ID: ${adjEmpId}).</p><p>Principal: ${principal.toFixed(2)} LYD<br/>Start: ${String(year)}-${String(month).padStart(2,'0')}<br/>Monthly Deduction: 25%</p></div>`;
                                await sendPayslipClient({ to: toList, subject, html, pdfBase64: dataUrl2, filename: `loan_${adjEmpId}_${year}${String(month).padStart(2,'0')}.pdf` });
                              }
                            } catch {}
                            await onRun();
                            setLoanAmount("");
                            alert("Loan created");
                          } catch (e: any) {
                            alert(e?.message || "Failed");
                          } finally {
                            setAdjLoading(false);
                          }
                        }}
                      >
                        {t("Create Loan") || "Create Loan"}
                      </Button>
                    </Box>
                  );
                })()}
              <Box>
                <Typography variant="subtitle1">
                  {t("Loans for Employee") || "Loans for Employee"}{" "}
                  {(() => {
                    const emp = (result?.employees || []).find(
                      (x) => x.id_emp === adjEmpId
                    );
                    return emp ? `${emp.name} (ID: ${emp.id_emp})` : "";
                  })()}
                </Typography>
                <Box my={1}>
                  {(loanRows || []).length === 0 && (
                    <Typography variant="body2" color="text.secondary">{t('No loans')} </Typography>
                  )}
                  {(loanRows || []).map((ln: any) => (
                    <Box key={ln.id} sx={{ py: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography variant="body2">{`Loan #${ln.id}`} — {t('Remaining') || 'Remaining'}: {Number(ln.remaining||0).toFixed(2)} LYD</Typography>
                          <Typography variant="caption" color="text.secondary">{dayjs(ln.createdAt).format('DD/MM/YYYY')}</Typography>
                        </Box>
                        <Box display="flex" gap={1}>
                          <Button size="small" variant="outlined" onClick={async ()=>{
                            try {
                              await skipV2LoanMonth({ loanId: ln.id, year, month });
                              alert(t('Skipped this month deduction')||'Skipped this month deduction');
                              const js = await listV2Loans(adjEmpId!); setLoanRows(js?.rows||[]);
                            } catch(e:any){ alert(e?.message||'Failed'); }
                          }}>{t('Skip this month')||'Skip this month'}</Button>
                          <Button size="small" variant="contained" onClick={()=>{ setActiveLoan(ln); setPayoffOpen(true); }}>{t('Payoff')||'Payoff'}</Button>
                        </Box>
                      </Box>
                      <Box mt={0.5} ml={0.5}>
                        <Typography variant="caption" color="text.secondary">{t('Payoff history') || 'Payoff history'}</Typography>
                        {Array.isArray(ln.history) && ln.history.length ? (
                          <Box>
                            {ln.history.map((h: any, i: number) => (
                              <Box key={i} display="flex" justifyContent="space-between">
                                <Typography variant="caption">{dayjs(h.ts).format('DD/MM/YYYY')}</Typography>
                                <Typography variant="caption">{Number(h.amount||0).toFixed(2)} LYD</Typography>
                              </Box>
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="caption">{t('No payoffs yet') || 'No payoffs yet'}</Typography>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Box>
                <Box mt={2}>
                  <Typography variant="subtitle2">{t('Salary history (last 12 months)') || 'Salary history (last 12 months)'}</Typography>
                  {(historyPoints||[]).length===0 ? (
                    <Typography variant="body2" color="text.secondary">{t('No data')} </Typography>
                  ) : (
                    <Box>
                      {(historyPoints||[]).map(p => (
                        <Box key={`${p.year}-${p.month}`} display="flex" justifyContent="space-between" sx={{ py: 0.25, borderTop: '1px dotted', borderColor: 'divider' }}>
                          <Typography variant="caption">{dayjs(`${p.year}-${String(p.month).padStart(2,'0')}-01`).format('MMM YYYY')}</Typography>
                          <Typography variant="caption">{Number(p.total||0).toFixed(2)} LYD</Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          )}

    {tab === "settings" && (() => {
      if (!isAdmin) return <Typography color="error">{t('Access denied') || 'Access denied'}</Typography>;
      return (
        <Box display="grid" gap={3}>
          <Box display="flex" alignItems="center" gap={1}>
            <SettingsIcon fontSize="small" />
            <Typography variant="h6">{t('Admin Settings') || 'Admin Settings'}</Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2">{t('Commission Management') || 'Commission Management'}</Typography>
            {commLoading ? (
              <Box display="flex" alignItems="center" gap={1} sx={{ mt: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2">{t('Loading') || 'Loading...'}</Typography>
              </Box>
            ) : (
              <Box sx={{ display:'grid', gap: 1, mt: 1 }}>
                {commList.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">{t('No employees with commission roles') || 'No employees with commission roles'}</Typography>
                ) : (
                  commList.map((row:any) => {
                    const dirty = commDirty[row.id] || {};
                    const val = (k: string) => (dirty[k] !== undefined ? dirty[k] : row[k]);
                    const setDirty = (patch: any) => setCommDirty((d) => ({ ...d, [row.id]: { ...(d[row.id]||{}), ...patch } }));
                    const saveRow = async () => {
                      const patch = commDirty[row.id];
                      if (!patch || Object.keys(patch).length === 0) return;
                      try {
                        await updateEmployee(row.id, patch);
                        setCommDirty(d => { const nd={...d}; delete nd[row.id]; return nd; });
                        alert(t('Saved') || 'Saved');
                      } catch (e:any) {
                        alert(e?.message || 'Failed');
                      }
                    };
                    return (
                      <Box key={row.id} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap: 1 }}>
                          <Typography variant="subtitle2">{row.name} — {row.role || '-'}</Typography>
                          <Typography variant="caption" color="text.secondary">{t('PS') || 'PS'}: {Array.isArray(row.ps) && row.ps.length ? row.ps.join(', ') : '-'}</Typography>
                        </Box>
                        <Box sx={{ display:'flex', alignItems:'center', gap: 1, flexWrap:'wrap', mt: 1 }}>
                          <TextField select size="small" sx={{ minWidth: 180 }} label={t('Gold Commission') || 'Gold Commission'} value={val('GOLD_COMM') || ''} onChange={(e)=> setDirty({ GOLD_COMM: e.target.value || '' })}>
                            <MenuItem value="">{t('None') || 'None'}</MenuItem>
                            <MenuItem value="percent">Percent</MenuItem>
                            <MenuItem value="fixed">Fixed</MenuItem>
                          </TextField>
                          {((val('GOLD_COMM') === 'percent') || (val('GOLD_COMM') === 'fixed')) && (
                            <TextField size="small" type="number" sx={{ width: 180 }} label={(val('GOLD_COMM') === 'percent') ? (t('Gold %') || 'Gold %') : (t('Gold Fixed (LYD)') || 'Gold Fixed (LYD)')} value={(val('GOLD_COMM_VALUE') ?? '')} onChange={(e)=> setDirty({ GOLD_COMM_VALUE: e.target.value === '' ? null : Number(e.target.value) })} inputProps={{ step: (val('GOLD_COMM') === 'percent') ? 0.1 : 1 }} />
                          )}
                          <TextField select size="small" sx={{ minWidth: 200 }} label={t('Diamond Commission') || 'Diamond Commission'} value={val('DIAMOND_COMM_TYPE') || ''} onChange={(e)=> setDirty({ DIAMOND_COMM_TYPE: e.target.value || '' })}>
                            <MenuItem value="">{t('None') || 'None'}</MenuItem>
                            <MenuItem value="percent">Percent</MenuItem>
                            <MenuItem value="fixed">Fixed</MenuItem>
                          </TextField>
                          {((val('DIAMOND_COMM_TYPE') === 'percent') || (val('DIAMOND_COMM_TYPE') === 'fixed')) && (
                            <TextField size="small" type="number" sx={{ width: 200 }} label={(val('DIAMOND_COMM_TYPE') === 'percent') ? (t('Diamond %') || 'Diamond %') : (t('Diamond Fixed (LYD)') || 'Diamond Fixed (LYD)')} value={(val('DIAMOND_COMM') ?? '')} onChange={(e)=> setDirty({ DIAMOND_COMM: e.target.value === '' ? null : Number(e.target.value) })} inputProps={{ step: (val('DIAMOND_COMM_TYPE') === 'percent') ? 0.1 : 1 }} />
                          )}
                          <Button size="small" variant="contained" onClick={saveRow}>{t('Save') || 'Save'}</Button>
                        </Box>
                      </Box>
                    );
                  })
                )}
              </Box>
            )}
          </Box>

          <Box display="grid" gap={2} maxWidth={600}>
            <Typography variant="h6">{t('Loan & Advance Settings') || 'Loan & Advance Settings'}</Typography>
            <Typography variant="subtitle2">{t('Default Loan Parameters') || 'Default Loan Parameters'}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('These settings control the default behavior for new loans. Loans use a fixed 25% monthly deduction rate with a 3x salary cap.') || 'These settings control the default behavior for new loans. Loans use a fixed 25% monthly deduction rate with a 3x salary cap.'}
            </Typography>
            <Divider />
            <Typography variant="subtitle2">{t('Salary Advance Limits') || 'Salary Advance Limits'}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('Salary advances are capped at 50% of the employee\'s monthly salary. The system automatically tracks existing advances and prevents exceeding this limit.') || 'Salary advances are capped at 50% of the employee\'s monthly salary. The system automatically tracks existing advances and prevents exceeding this limit.'}
            </Typography>
            <TextField
              size="small"
              fullWidth
              label={t('HR Emails (comma separated)') || 'HR Emails (comma separated)'}
              placeholder="hr@example.com, hr2@example.com"
              value={hrEmails}
              onChange={(e)=>{ setHrEmails(e.target.value); try{ localStorage.setItem('payroll_settings_hr_emails', e.target.value);}catch{} }}
            />
            <TextField
              size="small"
              fullWidth
              label={t('Finance Emails (comma separated)') || 'Finance Emails (comma separated)'}
              placeholder="finance@example.com, fin2@example.com"
              value={financeEmails}
              onChange={(e)=>{ setFinanceEmails(e.target.value); try{ localStorage.setItem('payroll_settings_finance_emails', e.target.value);}catch{} }}
            />
            <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="caption" color="info.contrastText">
                {t('Note: These limits are enforced at the application level. Contact system administrator to modify core parameters.') || 'Note: These limits are enforced at the application level. Contact system administrator to modify core parameters.'}
              </Typography>
            </Box>
          </Box>
        </Box>
      );
    })()}
        </CardContent>
      </Card>

      {loading && (
        <Box display="flex" alignItems="center" gap={1}>
          <CircularProgress size={20} />
          <Typography>{t("hr.timesheets.loading") || "Loading..."}</Typography>
        </Box>
      )}
      {!loading && result && tab === "payroll" && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              {t("Period") || "Period"}:{" "}
              {`${year}-${String(month).padStart(2, "0")}-01`} →{" "}
              {`${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`} {" "}
              — {t("common.showing") || "Showing"} {result?.count ?? 0}
            </Typography>
            {/* summary boxes removed per request */}
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table
                stickyHeader
                size="small"
                sx={{
                  tableLayout: "fixed",
                  width: "100%",
                  minWidth: tableMinWidth,
                  "& .MuiTableCell-root": { py: 0.5, px: 1 },
                }}
              >
                <TableHead
              sx={{
                backgroundColor: "grey.50",
                "& .MuiTableCell-head": {
                  fontSize: 8,
                  fontWeight: 600,
                  color: "text.secondary",
                  whiteSpace: "nowrap",
                  lineHeight: 1.2,
                  px: 1,
                },
                "& .MuiTableSortLabel-root": {
                  fontSize: 8,
                  maxWidth: "100%",
                  "& .MuiTableSortLabel-label": {
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  },
                },
                // Hide per-column eye icons; use gear menu instead
                "& .MuiTableCell-head .MuiIconButton-root": { display: "none" },
              }}
            >
                  <TableRow>
                    {/* Employee column header narrowed */}
                    <TableCell
                      sortDirection={
                        sortKey === "name" ? sortDir : (false as any)
                      }
                      sx={{ width: 180, maxWidth: 180, position: 'sticky', left: 0, zIndex: 3, bgcolor: 'background.paper' }}
                    >
                      <TableSortLabel
                        active={sortKey === "name"}
                        direction={sortKey === "name" ? sortDir : "asc"}
                        onClick={(e: any) => handleSort("name")}
                      >
                        {t("hr.timesheets.employee") || "Employee"}
                      </TableSortLabel>
                    </TableCell>
                    {/* PS column */}
                    <TableCell
                      align="left"
                      sortDirection={
                        sortKey === "ps" ? sortDir : (false as any)
                      }
                      sx={{ width: 64 }}
                    >
                      <TableSortLabel
                        active={sortKey === "ps"}
                        direction={sortKey === "ps" ? sortDir : "asc"}
                        onClick={(e: any) => handleSort("ps")}
                      >
                        {t("hr.timesheets.psPoint") || "PS"}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell
                      align="right"
                      sortDirection={
                        sortKey === "workingDays" ? sortDir : (false as any)
                      }
                      sx={{ width: 64 }}
                    >
                      <TableSortLabel
                        active={sortKey === "workingDays"}
                        direction={sortKey === "workingDays" ? sortDir : "asc"}
                        onClick={(e: any) => handleSort("workingDays")}
                      >
                        {t("Working Days") || "Working Days"}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell
                      align="right"
                      sortDirection={
                        sortKey === "deductionDays" ? sortDir : (false as any)
                      }
                      sx={{ width: 64 }}
                    >
                      <TableSortLabel
                        active={sortKey === "deductionDays"}
                        direction={
                          sortKey === "deductionDays" ? sortDir : "asc"
                        }
                        onClick={(e: any) => handleSort("deductionDays")}
                      >
                        {t("Deduction Days") || "Deduction Days"}
                      </TableSortLabel>
                    </TableCell>
                    {cols.presentWorkdays && (
                      <TableCell
                        align="right"
                        sortDirection={
                          sortKey === "presentWorkdays"
                            ? sortDir
                            : (false as any)
                        }
                        sx={{ width: 64 }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                        <TableSortLabel
                          active={sortKey === "presentWorkdays"}
                          direction={
                            sortKey === "presentWorkdays" ? sortDir : "asc"
                          }
                          onClick={(e: any) => {
                            if (e.altKey) {
                              e.preventDefault();
                              e.stopPropagation();
                              setCols((c) => ({ ...c, presentWorkdays: !c.presentWorkdays }));
                            } else handleSort("presentWorkdays");
                          }}
                          onDoubleClick={() => setCols((c) => ({
                            ...c,
                            presentWorkdays: true,
                            holidayWorked: true,
                            baseSalary: true,
                            food: true,
                            fuel: true,
                            comm: true,
                            basePay: true,
                            allowancePay: true,
                            adjustments: true,
                            salesQty: true,
                            salesTotal: true,
                            gold: true,
                            diamond: true,
                            totalUsd: true,
                          }))}
                        >
                          {t("Present Days") || "Present Days"}
                        </TableSortLabel>
                        <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }} aria-label="hide column"
                          onClick={(e) => { e.stopPropagation(); setCols(c => ({ ...c, presentWorkdays: !c.presentWorkdays })); }}>
                          <VisibilityOffIcon fontSize="inherit" />
                        </IconButton>
                        </Box>
                      </TableCell>
                    )}
                    {cols.holidayWorked && (
                      <TableCell
                        align="right"
                        sortDirection={
                          sortKey === "holidayWorked" ? sortDir : (false as any)
                        }
                        sx={{ width: 64 }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                        <TableSortLabel
                          active={sortKey === "holidayWorked"}
                          direction={
                            sortKey === "holidayWorked" ? sortDir : "asc"
                          }
                          onClick={(e: any) => {
                            if (e.altKey) {
                              e.preventDefault();
                              e.stopPropagation();
                              setCols((c) => ({ ...c, holidayWorked: !c.holidayWorked }));
                            } else handleSort("holidayWorked");
                          }}
                          onDoubleClick={() => setCols((c) => ({
                            ...c,
                            presentWorkdays: true,
                            holidayWorked: true,
                            baseSalary: true,
                            food: true,
                            fuel: true,
                            comm: true,
                            basePay: true,
                            allowancePay: true,
                            adjustments: true,
                            salesQty: true,
                            salesTotal: true,
                            gold: true,
                            diamond: true,
                            totalUsd: true,
                          }))}
                        >
                          {t("Holidays Worked") || "Holidays Worked"}
                        </TableSortLabel>
                        <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }} aria-label="hide column"
                          onClick={(e) => { e.stopPropagation(); setCols(c => ({ ...c, holidayWorked: !c.holidayWorked })); }}>
                          <VisibilityOffIcon fontSize="inherit" />
                        </IconButton>
                        </Box>
                      </TableCell>
                    )}
                    {cols.baseSalary && (
                      <TableCell
                        align="right"
                        sortDirection={
                          sortKey === "baseSalary" ? sortDir : (false as any)
                        }
                        sx={{ width: 80 }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                        <TableSortLabel
                          active={sortKey === "baseSalary"}
                          direction={sortKey === "baseSalary" ? sortDir : "asc"}
                          onClick={(e: any) => {
                            if (e.altKey) {
                              e.preventDefault();
                              e.stopPropagation();
                              setCols((c) => ({ ...c, baseSalary: !c.baseSalary }));
                            } else handleSort("baseSalary");
                          }}
                          onDoubleClick={() => setCols((c) => ({
                            ...c,
                            presentWorkdays: true,
                            holidayWorked: true,
                            baseSalary: true,
                            food: true,
                            fuel: true,
                            comm: true,
                            basePay: true,
                            allowancePay: true,
                            adjustments: true,
                            salesQty: true,
                            salesTotal: true,
                            gold: true,
                            diamond: true,
                            totalUsd: true,
                          }))}
                        >
                          {t("Base Salary") || "Base Salary"}
                        </TableSortLabel>
                        <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }} aria-label="hide column"
                          onClick={(e) => { e.stopPropagation(); setCols(c => ({ ...c, baseSalary: !c.baseSalary })); }}>
                          <VisibilityOffIcon fontSize="inherit" />
                        </IconButton>
                        </Box>
                      </TableCell>
                    )}
                    {cols.food && (
                      <TableCell
                        align="right"
                        sortDirection={
                          sortKey === "food" ? sortDir : (false as any)
                        }
                        sx={{ width: 72 }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                        <TableSortLabel
                          active={sortKey === "food"}
                          direction={sortKey === "food" ? sortDir : "asc"}
                          onClick={(e: any) => {
                            if (e.altKey) {
                              e.preventDefault();
                              e.stopPropagation();
                              setCols((c) => ({ ...c, food: !c.food }));
                            } else handleSort("food");
                          }}
                          onDoubleClick={() => setCols((c) => ({
                            ...c,
                            presentWorkdays: true,
                            holidayWorked: true,
                            baseSalary: true,
                            food: true,
                            fuel: true,
                            comm: true,
                            basePay: true,
                            allowancePay: true,
                            adjustments: true,
                            salesQty: true,
                            salesTotal: true,
                            gold: true,
                            diamond: true,
                            totalUsd: true,
                          }))}
                        >
                          {t("Food Allowance") || "Food Allowance"}
                        </TableSortLabel>
                        <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }} aria-label="hide column"
                          onClick={(e) => { e.stopPropagation(); setCols(c => ({ ...c, food: !c.food })); }}>
                          <VisibilityOffIcon fontSize="inherit" />
                        </IconButton>
                        </Box>
                      </TableCell>
                    )}
                    {cols.fuel && (
                      <TableCell
                        align="right"
                        sortDirection={
                          sortKey === "fuel" ? sortDir : (false as any)
                        }
                        sx={{ width: 72 }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                        <TableSortLabel
                          active={sortKey === "fuel"}
                          direction={sortKey === "fuel" ? sortDir : "asc"}
                          onClick={(e: any) => {
                            if (e.altKey) {
                              e.preventDefault();
                              e.stopPropagation();
                              setCols((c) => ({ ...c, fuel: !c.fuel }));
                            } else handleSort("fuel");
                          }}
                          onDoubleClick={() => setCols((c) => ({
                            ...c,
                            presentWorkdays: true,
                            holidayWorked: true,
                            baseSalary: true,
                            food: true,
                            fuel: true,
                            comm: true,
                            basePay: true,
                            allowancePay: true,
                            adjustments: true,
                            salesQty: true,
                            salesTotal: true,
                            gold: true,
                            diamond: true,
                            totalUsd: true,
                          }))}
                        >
                          {t("Transportation") || "Transportation"}
                        </TableSortLabel>
                        <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }} aria-label="hide column"
                          onClick={(e) => { e.stopPropagation(); setCols(c => ({ ...c, fuel: !c.fuel })); }}>
                          <VisibilityOffIcon fontSize="inherit" />
                        </IconButton>
                        </Box>
                      </TableCell>
                    )}
                    {cols.comm && (
                      <TableCell
                        align="right"
                        sortDirection={
                          sortKey === "comm" ? sortDir : (false as any)
                        }
                        sx={{ width: 72 }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                        <TableSortLabel
                          active={sortKey === "comm"}
                          direction={sortKey === "comm" ? sortDir : "asc"}
                          onClick={(e: any) => {
                            if (e.altKey) {
                              e.preventDefault();
                              e.stopPropagation();
                              setCols((c) => ({ ...c, comm: !c.comm }));
                            } else handleSort("comm");
                          }}
                          onDoubleClick={() => setCols((c) => ({
                            ...c,
                            presentWorkdays: true,
                            holidayWorked: true,
                            baseSalary: true,
                            food: true,
                            fuel: true,
                            comm: true,
                            basePay: true,
                            allowancePay: true,
                            adjustments: true,
                            salesQty: true,
                            salesTotal: true,
                            gold: true,
                            diamond: true,
                            totalUsd: true,
                          }))}
                        >
                          {t("Communication") ||
                            "Communication"}
                        </TableSortLabel>
                        <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }} aria-label="hide column"
                          onClick={(e) => { e.stopPropagation(); setCols(c => ({ ...c, comm: !c.comm })); }}>
                          <VisibilityOffIcon fontSize="inherit" />
                        </IconButton>
                        </Box>
                      </TableCell>
                    )}
                    {cols.basePay && (
                      <TableCell
                        align="right"
                        sortDirection={
                          sortKey === "basePay" ? sortDir : (false as any)
                        }
                        sx={{ width: 84 }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                        <TableSortLabel
                          active={sortKey === "basePay"}
                          direction={sortKey === "basePay" ? sortDir : "asc"}
                          onClick={(e: any) => {
                            if (e.altKey) {
                              e.preventDefault();
                              e.stopPropagation();
                              setCols((c) => ({ ...c, basePay: !c.basePay }));
                            } else handleSort("basePay");
                          }}
                          onDoubleClick={() => setCols((c) => ({
                            ...c,
                            presentWorkdays: true,
                            holidayWorked: true,
                            baseSalary: true,
                            food: true,
                            fuel: true,
                            comm: true,
                            basePay: true,
                            allowancePay: true,
                            adjustments: true,
                            salesQty: true,
                            salesTotal: true,
                            gold: true,
                            diamond: true,
                            totalUsd: true,
                          }))}
                        >
                          {t("Base Pay") || "Base Pay"}
                        </TableSortLabel>
                        <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }} aria-label="hide column"
                          onClick={(e) => { e.stopPropagation(); setCols(c => ({ ...c, basePay: !c.basePay })); }}>
                          <VisibilityOffIcon fontSize="inherit" />
                        </IconButton>
                        </Box>
                      </TableCell>
                    )}
                    {cols.allowancePay && (
                      <TableCell
                        align="right"
                        sortDirection={
                          sortKey === "allowancePay" ? sortDir : (false as any)
                        }
                        sx={{ width: 84 }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                        <TableSortLabel
                          active={sortKey === "allowancePay"}
                          direction={
                            sortKey === "allowancePay" ? sortDir : "asc"
                          }
                          onClick={(e: any) => {
                            if (e.altKey) {
                              e.preventDefault();
                              e.stopPropagation();
                              setCols((c) => ({ ...c, allowancePay: !c.allowancePay }));
                            } else handleSort("allowancePay");
                          }}
                          onDoubleClick={() => setCols((c) => ({
                            ...c,
                            presentWorkdays: true,
                            holidayWorked: true,
                            baseSalary: true,
                            food: true,
                            fuel: true,
                            comm: true,
                            basePay: true,
                            allowancePay: true,
                            adjustments: true,
                            salesQty: true,
                            salesTotal: true,
                            gold: true,
                            diamond: true,
                            totalUsd: true,
                          }))}
                        >
                          {t("Allowance Pay") || "Allowance Pay"}
                        </TableSortLabel>
                        <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }} aria-label="hide column"
                          onClick={(e) => { e.stopPropagation(); setCols(c => ({ ...c, allowancePay: !c.allowancePay })); }}>
                          <VisibilityOffIcon fontSize="inherit" />
                        </IconButton>
                        </Box>
                      </TableCell>
                    )}
                    {cols.adjustments && (
                      <TableCell
                        align="right"
                        sortDirection={
                          sortKey === "adjustments" ? sortDir : (false as any)
                        }
                        sx={{ width: 72 }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                        <TableSortLabel
                          active={sortKey === "adjustments"}
                          direction={
                            sortKey === "adjustments" ? sortDir : "asc"
                          }
                          onClick={(e: any) => {
                            if (e.altKey) {
                              setCols((c) => ({
                                ...c,
                                adjustments: !c.adjustments,
                              }));
                              e.preventDefault();
                              e.stopPropagation();
                            } else handleSort("adjustments");
                          }}
                        >
                          {t("Adjustments") || "Adjustments"}
                        </TableSortLabel>
                        <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }} aria-label="hide column"
                          onClick={(e) => { e.stopPropagation(); setCols(c => ({ ...c, adjustments: !c.adjustments })); }}>
                          <VisibilityOffIcon fontSize="inherit" />
                        </IconButton>
                        </Box>
                      </TableCell>
                    )}
                    {cols.salesQty && (
                      <TableCell
                        align="right"
                        sortDirection={
                          sortKey === "salesQty" ? sortDir : (false as any)
                        }
                        sx={{ width: 64 }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                        <TableSortLabel
                          active={sortKey === "salesQty"}
                          direction={sortKey === "salesQty" ? sortDir : "asc"}
                          onClick={(e: any) => {
                            if (e.altKey) {
                              setCols((c) => ({ ...c, salesQty: !c.salesQty }));
                              e.preventDefault();
                              e.stopPropagation();
                            } else handleSort("salesQty");
                          }}
                        >
                          {t("Sales Qty") || "Sales Qty"}
                        </TableSortLabel>
                        <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }} aria-label="hide column"
                          onClick={(e) => { e.stopPropagation(); setCols(c => ({ ...c, salesQty: !c.salesQty })); }}>
                          <VisibilityOffIcon fontSize="inherit" />
                        </IconButton>
                        </Box>
                      </TableCell>
                    )}
                    {cols.salesTotal && (
                      <TableCell
                        align="right"
                        sortDirection={
                          sortKey === "salesTotal" ? sortDir : (false as any)
                        }
                        sx={{ width: 84 }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                        <TableSortLabel
                          active={sortKey === "salesTotal"}
                          direction={sortKey === "salesTotal" ? sortDir : "asc"}
                          onClick={(e: any) => {
                            if (e.altKey) {
                              setCols((c) => ({
                                ...c,
                                salesTotal: !c.salesTotal,
                              }));
                              e.preventDefault();
                              e.stopPropagation();
                            } else handleSort("salesTotal");
                          }}
                        >
                          {t("Sales Total (LYD)") || "Sales Total (LYD)"}
                        </TableSortLabel>
                        <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }} aria-label="hide column"
                          onClick={(e) => { e.stopPropagation(); setCols(c => ({ ...c, salesTotal: !c.salesTotal })); }}>
                          <VisibilityOffIcon fontSize="inherit" />
                        </IconButton>
                        </Box>
                      </TableCell>
                    )}
                    {cols.gold && (
                      <TableCell
                        align="right"
                        sortDirection={
                          sortKey === "gold" ? sortDir : (false as any)
                        }
                        sx={{ width: 96 }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                        <TableSortLabel
                          active={sortKey === "gold"}
                          direction={sortKey === "gold" ? sortDir : "asc"}
                          onClick={(e: any) => {
                            if (e.altKey) {
                              e.preventDefault();
                              e.stopPropagation();
                              setCols((c) => ({ ...c, gold: !c.gold }));
                            } else handleSort("gold");
                          }}
                          onDoubleClick={() => setCols((c) => ({
                            ...c,
                            presentWorkdays: true,
                            holidayWorked: true,
                            baseSalary: true,
                            food: true,
                            fuel: true,
                            comm: true,
                            basePay: true,
                            allowancePay: true,
                            adjustments: true,
                            salesQty: true,
                            salesTotal: true,
                            gold: true,
                            diamond: true,
                            totalUsd: true,
                          }))}
                        >
                          {t("Gold Commission") || "Gold Commission"}
                        </TableSortLabel>
                        <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }} aria-label="hide column"
                          onClick={(e) => { e.stopPropagation(); setCols(c => ({ ...c, gold: !c.gold })); }}>
                          <VisibilityOffIcon fontSize="inherit" />
                        </IconButton>
                        </Box>
                      </TableCell>
                    )}
                    {cols.diamond && (
                      <TableCell
                        align="right"
                        sortDirection={
                          sortKey === "diamond" ? sortDir : (false as any)
                        }
                        sx={{ width: 96 }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                        <TableSortLabel
                          active={sortKey === "diamond"}
                          direction={sortKey === "diamond" ? sortDir : "asc"}
                          onClick={(e: any) => {
                            if (e.altKey) {
                              e.preventDefault();
                              e.stopPropagation();
                              setCols((c) => ({ ...c, diamond: !c.diamond }));
                            } else handleSort("diamond");
                          }}
                          onDoubleClick={() => setCols((c) => ({
                            ...c,
                            presentWorkdays: true,
                            holidayWorked: true,
                            baseSalary: true,
                            food: true,
                            fuel: true,
                            comm: true,
                            basePay: true,
                            allowancePay: true,
                            adjustments: true,
                            salesQty: true,
                            salesTotal: true,
                            gold: true,
                            diamond: true,
                            totalUsd: true,
                          }))}
                        >
                          {t("Diamond Commission") || "Diamond Commission"}
                        </TableSortLabel>
                        <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }} aria-label="hide column"
                          onClick={(e) => { e.stopPropagation(); setCols(c => ({ ...c, diamond: !c.diamond })); }}>
                          <VisibilityOffIcon fontSize="inherit" />
                        </IconButton>
                        </Box>
                      </TableCell>
                    )}
                    <TableCell
                      align="right"
                      sortDirection={
                        sortKey === "total" ? sortDir : (false as any)
                      }
                      sx={{ width: 96 }}
                    >
                      <TableSortLabel
                        active={sortKey === "total"}
                        direction={sortKey === "total" ? sortDir : "asc"}
                        onClick={(e: any) => handleSort("total")}
                      >
                        {t("Total (LYD)") || "Total (LYD)"}
                      </TableSortLabel>
                    </TableCell>
                    {cols.totalUsd && (
                      <TableCell
                        align="right"
                        sortDirection={
                          sortKey === "totalUsd" ? sortDir : (false as any)
                        }
                        sx={{ width: 84 }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                        <TableSortLabel
                          active={sortKey === "totalUsd"}
                          direction={sortKey === "totalUsd" ? sortDir : "asc"}
                          onClick={(e: any) => {
                            if (e.altKey) {
                              setCols((c) => ({ ...c, totalUsd: !c.totalUsd }));
                              e.preventDefault();
                              e.stopPropagation();
                            } else handleSort("totalUsd");
                          }}
                        >
                          {t("Total (USD)") || "Total (USD)"}
                        </TableSortLabel>
                        <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }} aria-label="hide column"
                          onClick={(e) => { e.stopPropagation(); setCols(c => ({ ...c, totalUsd: !c.totalUsd })); }}>
                          <VisibilityOffIcon fontSize="inherit" />
                        </IconButton>
                        </Box>
                      </TableCell>
                    )}
                    <TableCell align="right" sx={{ width: 220, position: 'sticky', right: 0, zIndex: 3, bgcolor: 'background.paper' }}>
                      <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                        <span>{t("Actions") || "Actions"}</span>
                        <IconButton size="small" aria-label="columns" onClick={(e)=> setColsAnchor(e.currentTarget)}>
                          <SettingsIcon fontSize="inherit" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayedRows.map((e: Payslip) => (
                    <TableRow
                      key={e.id_emp}
                      hover
                      sx={{ "&:nth-of-type(odd)": { bgcolor: "action.hover" } }}
                    >
                      <TableCell sx={{ position: 'sticky', left: 0, zIndex: 2, bgcolor: 'background.paper' }}>
                        <Box display="flex" alignItems="center" gap={1.25}>
                          <Avatar src={`http://localhost:9000/employees/${e.id_emp}/picture`} sx={{ width: 28, height: 28 }} />
                          <Box
                            display="flex"
                            flexDirection="column"
                            sx={{
                              maxWidth: 220,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            <Typography
                              fontWeight={500}
                              noWrap
                              sx={{ cursor: "pointer" }}
                              onClick={() => openCalendar(e.id_emp, e.name)}
                            >
                              {e.name}
                            </Typography>
                            <Typography variant="caption">
                              {(() => {
                                const vr = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(e.id_emp)) || {};
                                const pick = (s: any) => {
                                  if (!s) return '';
                                  const m = String(s).match(/(\d{1,2}):(\d{2})/);
                                  return m ? m[0] : '';
                                };
                                const s1 = pick((vr as any).T_START || (vr as any).t_start || (vr as any).SCHEDULE_START || (vr as any).shift_start);
                                const s2 = pick((vr as any).T_END || (vr as any).t_end || (vr as any).SCHEDULE_END || (vr as any).shift_end);
                                const sch = s1 && s2 ? ` • ${s1}–${s2}` : '';
                                return `ID: ${e.id_emp} ${e.PS != null ? `• PS: ${formatPs(e.PS)}` : ''} ${e.designation ? `• ${e.designation}` : ''}${sch}`;
                              })()}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      {/* PS column cell */}
                      <TableCell>
                        {e.PS != null ? formatPs(e.PS) : "-"}
                      </TableCell>
                      <TableCell align="right">{e.workingDays || ""}</TableCell>
                      <TableCell align="right">
                        {e.deductionDays
                          ? Number(e.deductionDays).toFixed(2)
                          : ""}
                      </TableCell>
                      {cols.presentWorkdays && (
                        <TableCell align="right">
                          {e.presentWorkdays || ""}
                        </TableCell>
                      )}
                      {cols.holidayWorked && (
                        <TableCell align="right">
                          {e.holidayWorked || ""}
                        </TableCell>
                      )}
                      {cols.baseSalary && (
                        <TableCell align="right">
                          {e.baseSalary || 0
                            ? Number(e.baseSalary || 0).toFixed(2)
                            : ""}
                        </TableCell>
                      )}
                      {cols.food && (
                        <TableCell align="right">
                          {(() => {
                            const W = Math.max(1, e.workingDays || 1);
                            const vr = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(e.id_emp)) || {};
                            let per = Number((e as any).FOOD || (e as any).FOOD_ALLOWANCE || 0);
                            if (!per) {
                              const totalFoodLyd = Number((vr as any).wd_food_lyd || 0);
                              per = totalFoodLyd && W ? totalFoodLyd / W : 0;
                            }
                            const present = Number(presentDaysMap[e.id_emp] ?? e.presentWorkdays ?? 0) || 0;
                            const fd = present;
                            const v = per * fd;
                            return Number.isFinite(v) ? v.toFixed(2) : "0.00";
                          })()}
                        </TableCell>
                      )}
                      {cols.comm && (
                        <TableCell align="right">
                          {(() => {
                            const W = Math.max(1, e.workingDays || 1);
                            const vr = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(e.id_emp)) || {};
                            const per = Number(((e as any).COMMUNICATION ?? (vr as any).COMMUNICATION) || 0);
                            const v = per * W;
                            return v ? v.toFixed(2) : "";
                          })()}
                        </TableCell>
                      )}
                      {cols.basePay && (
                        <TableCell align="right">
                          {e.components?.basePay || 0
                            ? (e.components?.basePay || 0).toFixed(2)
                            : ""}
                        </TableCell>
                      )}
                      {cols.allowancePay && (
                        <TableCell align="right">
                          {e.components?.allowancePay || 0
                            ? (e.components?.allowancePay || 0).toFixed(2)
                            : ""}
                        </TableCell>
                      )}
                      {cols.adjustments && (
                        <TableCell align="right">
                          {(() => {
                            const a = e.components?.adjustments || {
                              bonus: 0,
                              deduction: 0,
                              advance: 0,
                              loanPayment: 0,
                            };
                            const v =
                              (a.bonus || 0) -
                              ((a.deduction || 0) +
                                (a.advance || 0) +
                                (a.loanPayment || 0));
                            return v ? v.toFixed(2) : "";
                          })()}
                        </TableCell>
                      )}
                      {cols.salesQty && (
                        <TableCell align="right">
                          {(() => {
                            const v = sales[String(e.id_emp)]?.qty ?? 0;
                            return v ? v.toFixed(0) : "";
                          })()}
                        </TableCell>
                      )}
                      {cols.salesTotal && (
                        <TableCell align="right">
                          {(() => {
                            const v = sales[String(e.id_emp)]?.total_lyd ?? 0;
                            return v ? v.toFixed(2) : "";
                          })()}
                        </TableCell>
                      )}
                      {cols.gold && (
                        <TableCell align="right">
                          {(() => {
                            const vr =
                              (v2Rows || []).find(
                                (x: any) =>
                                  Number(x.id_emp) === Number(e.id_emp)
                              ) || {};
                            const v = Number((vr as any).gold_bonus_lyd || 0);
                            return v ? v.toFixed(2) : "";
                          })()}
                        </TableCell>
                      )}
                      {cols.diamond && (
                        <TableCell align="right">
                          {(() => {
                            const vr =
                              (v2Rows || []).find(
                                (x: any) =>
                                  Number(x.id_emp) === Number(e.id_emp)
                              ) || {};
                            const v = Number(
                              (vr as any).diamond_bonus_lyd || 0
                            );
                            return v ? v.toFixed(2) : "";
                          })()}
                        </TableCell>
                      )}
                      <TableCell align="right">
                        <strong>{(() => {
                          const val = computeNetLYDFor(e.id_emp);
                          return val ? val.toFixed(2) : "";
                        })()}</strong>
                      </TableCell>
                      {cols.totalUsd && (
                        <TableCell align="right">
                          {(() => {
                            const W = Math.max(1, e.workingDays || 1);
                            const F =
                              e.factorSum != null && e.factorSum > 0
                                ? e.factorSum
                                : (e.components?.basePay || 0) /
                                  (Math.max(1, e.baseSalary || 0) / W);
                            const baseUsd = e.baseSalaryUsd
                              ? (e.baseSalaryUsd / W) * F
                              : 0;
                            const vr = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(e.id_emp)) || {};
                            const commUsd = Number((vr as any).diamond_bonus_usd || 0) + Number((vr as any).gold_bonus_usd || 0);
                            const totalUsdVal = baseUsd + commUsd;
                            return totalUsdVal ? totalUsdVal.toFixed(2) : "";
                          })()}
                        </TableCell>
                      )}
                      <TableCell align="right" sx={{ position: 'sticky', right: 0, zIndex: 2, bgcolor: 'background.paper' }}>
                        <Box display="flex" gap={0.5} justifyContent="flex-end" alignItems="center">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => exportPdfClient(e)}
                          >
                            PDF
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => sendPayslipEmailClient(e)}
                          >
                            Send
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow>
                    <TableCell>
                      <strong>{t("Totals") || "Totals"}</strong>
                    </TableCell>
                    {/* PS column placeholder */}
                    <TableCell align="right">—</TableCell>
                    <TableCell align="right">—</TableCell>
                    <TableCell align="right">—</TableCell>
                    {cols.presentWorkdays && (
                      <TableCell align="right">—</TableCell>
                    )}
                    {cols.holidayWorked && (
                      <TableCell align="right">—</TableCell>
                    )}
                    {cols.baseSalary && (
                      <TableCell align="right">
                        <strong>{totals.baseSalary.toFixed(2)}</strong>
                      </TableCell>
                    )}
                    {cols.food && (
                      <TableCell align="right">
                        <strong>{totals.food.toFixed(2)}</strong>
                      </TableCell>
                    )}
                    {cols.fuel && (
                      <TableCell align="right">
                        <strong>{totals.fuel.toFixed(2)}</strong>
                      </TableCell>
                    )}
                    {cols.comm && (
                      <TableCell align="right">
                        <strong>{totals.comm.toFixed(2)}</strong>
                      </TableCell>
                    )}
                    {cols.basePay && (
                      <TableCell align="right">
                        <strong>{totals.base.toFixed(2)}</strong>
                      </TableCell>
                    )}
                    {cols.allowancePay && (
                      <TableCell align="right">
                        <strong>{totals.allow.toFixed(2)}</strong>
                      </TableCell>
                    )}
                    {cols.adjustments && (
                      <TableCell align="right">
                        <strong>{totals.adj.toFixed(2)}</strong>
                      </TableCell>
                    )}
                    {cols.salesQty && (
                      <TableCell align="right">
                        <strong>{totals.salesQty.toFixed(0)}</strong>
                      </TableCell>
                    )}
                    {cols.salesTotal && (
                      <TableCell align="right">
                        <strong>{totals.salesTotal.toFixed(2)}</strong>
                      </TableCell>
                    )}
                    {cols.gold && (
                      <TableCell align="right">
                        <strong>{totals.gold.toFixed(2)}</strong>
                      </TableCell>
                    )}
                    {cols.diamond && (
                      <TableCell align="right">
                        <strong>{totals.diamond.toFixed(2)}</strong>
                      </TableCell>
                    )}
                    <TableCell align="right">
                      <strong>{totals.totalLyd.toFixed(2)}</strong>
                    </TableCell>
                    {cols.totalUsd && (
                      <TableCell align="right">
                        <strong>{totals.totalUsd.toFixed(2)}</strong>
                      </TableCell>
                    )}
                    <TableCell align="right">—</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
        </CardContent>
      </Card>
      )}

      {/* Columns gear menu */}
      <Menu
        anchorEl={colsAnchor}
        open={Boolean(colsAnchor)}
        onClose={() => setColsAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box px={1} py={0.5} display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={0.5}>
          {(
            [
              ['presentWorkdays', 'Present WD'],
              ['holidayWorked', 'Holiday Worked'],
              ['baseSalary', 'Base Salary'],
              ['food', 'Food'],
              ['fuel', 'Fuel'],
              ['comm', 'Communication'],
              ['basePay', 'Base Pay'],
              ['allowancePay', 'Allowance Pay'],
              ['adjustments', 'Adjustments'],
              ['salesQty', 'Sales Qty'],
              ['salesTotal', 'Sales Total'],
              ['gold', 'Gold Bonus'],
              ['diamond', 'Diamond Bonus'],
              ['totalUsd', 'Total USD'],
            ] as Array<[keyof typeof cols, string]>
          ).map(([k, label]) => (
            <FormControlLabel
              key={String(k)}
              control={
                <Checkbox
                  size="small"
                  checked={Boolean((cols as any)[k])}
                  onChange={(e) => setCols((c:any) => ({ ...c, [k]: e.target.checked }))}
                />
              }
              label={label}
            />
          ))}
        </Box>
      </Menu>

      {error && (
        <Box mt={2}>
          <Typography color="error">{error}</Typography>
        </Box>
      )}

      <Dialog
        open={calOpen}
        onClose={() => setCalOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {calEmp
            ? `${calEmp.name} — ${String(year)}-${String(month).padStart(2, "0")}`
            : "Calendar"}
        </DialogTitle>
        <DialogContent>
          {calLoading && (
            <Box display="flex" alignItems="center" gap={1}>
              <CircularProgress size={18} />
              <Typography>
                {t("hr.timesheets.loading") || "Loading..."}
              </Typography>
            </Box>
          )}
          {!calLoading && calDays && (
            <Box>
              <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" gap={1}>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <Box key={d} sx={{ fontWeight: 600, textAlign: "center" }}>
                    {d}
                  </Box>
                ))}
                {(() => {
                  const first = dayjs(
                    `${year}-${String(month).padStart(2, "0")}-01`
                  );
                  const dow = first.day(); // 0..6, Sunday=0
                  const startIdx = (dow + 6) % 7; // convert to Monday-first 0..6
                  const dim = new Date(year, month, 0).getDate();
                  const cells: React.ReactNode[] = [];
                  for (let i = 0; i < startIdx; i++)
                    cells.push(
                      <Box
                        key={`e${i}`}
                        sx={{ p: 1, minHeight: 80, bgcolor: "#fafafa" }}
                      />
                    );
                  for (let d = 1; d <= dim; d++) {
                    const day = calDays[d - 1];
                    const code = String(day?.code || "").toUpperCase();
                    const delta = roundedHoursWithSign(day?.deltaMin ?? null);
                    const badge =
                      code ||
                      (day?.present ? (day?.isHoliday ? "PH" : "P") : "A");
                    const bg = (() => {
                      if (badge === "PHF") return "#e6ffe6";
                      if (badge === "PH") return "#fff3cd";
                      if (badge === "PT") return "#e0f7fa";
                      if (badge === "PL") return "#ffebee";
                      if (badge === "A") return "#fdecea";
                      if (badge) return "#eef7ff";
                      return "#fafafa";
                    })();
                    cells.push(
                      <Box
                        key={`d${d}`}
                        sx={{
                          p: 1,
                          minHeight: 80,
                          bgcolor: bg,
                          border: "1px solid #eee",
                        }}
                      >
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="caption">{d}</Typography>
                          <Typography variant="caption">{badge}</Typography>
                        </Box>
                        {day?.entry && (
                          <Typography variant="caption">
                            {String(day.entry).slice(11, 16)} →{" "}
                            {day?.exit
                              ? String(day.exit).slice(11, 16)
                              : "--:--"}
                          </Typography>
                        )}
                        {delta && (
                          <Typography variant="caption">Δ {delta}</Typography>
                        )}
                      </Box>
                    );
                  }
                  return cells;
                })()}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCalOpen(false)}>
            {t("common.close") || "Close"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={bdOpen}
        onClose={() => setBdOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {bdEmp
            ? `${bdEmp.name} — Breakdown (${String(year)}-${String(month).padStart(2, "0")})`
            : "Breakdown"}
        </DialogTitle>
        <DialogContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                {bdShowLyd && <TableCell align="right">LYD</TableCell>}
                {bdShowUsd && <TableCell align="right">USD</TableCell>}
                <TableCell>Note</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bdLines.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{r.label}</TableCell>
                  {bdShowLyd && (
                    <TableCell align="right">
                      {r.lyd
                        ? r.lyd.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })
                        : ""}
                    </TableCell>
                  )}
                  {bdShowUsd && (
                    <TableCell align="right">
                      {r.usd
                        ? r.usd.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })
                        : ""}
                    </TableCell>
                  )}
                  <TableCell>{r.note || ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBdOpen(false)}>
            {t("common.close") || "Close"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={payoffOpen} onClose={() => { setPayoffOpen(false); setPayoffAmt(""); setActiveLoan(null); }} fullWidth maxWidth="xs">
        <DialogTitle>{t('Payoff loan') || 'Payoff loan'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {t('Enter an amount to make a partial payoff, or leave blank to payoff the remaining balance.') || 'Enter an amount to make a partial payoff, or leave blank to payoff the remaining balance.'}
          </Typography>
          <TextField
            fullWidth
            size="small"
            type="number"
            label={t('LYD') || 'LYD'}
            placeholder={t('Leave blank for full payoff') || 'Leave blank for full payoff'}
            value={payoffAmt}
            onChange={(e) => setPayoffAmt(e.target.value)}
            inputProps={{ step: '0.01' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setPayoffOpen(false); setPayoffAmt(""); setActiveLoan(null); }}>
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (!adjEmpId || !activeLoan) { setPayoffOpen(false); return; }
              try {
                const body: any = { loanId: activeLoan.id, employeeId: adjEmpId };
                const amt = Number(payoffAmt);
                if (!isNaN(amt) && payoffAmt !== '') body.amount = amt;
                await payoffV2Loan(body);
                const js = await listV2Loans(adjEmpId);
                setLoanRows(js?.rows || []);
                alert(t('Payoff recorded') || 'Payoff recorded');
              } catch (e: any) {
                alert(e?.message || 'Failed');
              } finally {
                setPayoffOpen(false); setPayoffAmt(''); setActiveLoan(null);
              }
            }}
          >
            {t('Confirm') || 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={adjOpen}
        onClose={() => setAdjOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t("Adjustments") || "Adjustments"}</DialogTitle>
        <DialogContent>
          {adjLoading ? (
            <Box display="flex" alignItems="center" gap={1}>
              <CircularProgress size={18} />
              <Typography>{t("common.loading") || "Loading..."}</Typography>
            </Box>
          ) : (
            <>
              <Box>
                {(adjRows || []).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {t("No adjustments yet") || "No adjustments yet"}
                  </Typography>
                )}
                {(adjRows || []).map((r, idx) => (
                  <Box
                    key={idx}
                    display="flex"
                    justifyContent="space-between"
                    sx={{ py: 0.5 }}
                  >
                    <Typography variant="body2">
                      {r.type} — {r.currency} {Number(r.amount || 0).toFixed(2)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.ts ? dayjs(r.ts).format("YYYY-MM-DD HH:mm") : ""}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Divider sx={{ my: 1.5 }} />
              <Box display="grid" gridTemplateColumns="repeat(4, 1fr)" gap={1}>
                <TextField
                  select
                  size="small"
                  label={t("Type") || "Type"}
                  value={adjForm.type}
                  onChange={(e) =>
                    setAdjForm((f) => ({ ...f, type: e.target.value }))
                  }
                >
                  {["bonus", "deduction", "advance", "loanPayment"].map((x) => (
                    <MenuItem key={x} value={x}>
                      {x}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  type="number"
                  label={t("Amount") || "Amount"}
                  value={adjForm.amount}
                  onChange={(e) =>
                    setAdjForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  inputProps={{ step: "0.01" }}
                />
                <TextField
                  select
                  size="small"
                  label={t("Currency") || "Currency"}
                  value={adjForm.currency}
                  onChange={(e) =>
                    setAdjForm((f) => ({ ...f, currency: e.target.value }))
                  }
                >
                  {["LYD", "USD"].map((x) => (
                    <MenuItem key={x} value={x}>
                      {x}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  label={t("Note") || "Note"}
                  value={adjForm.note}
                  onChange={(e) =>
                    setAdjForm((f) => ({ ...f, note: e.target.value }))
                  }
                />
              </Box>
              <Box mt={1} display="flex" justifyContent="flex-end">
                <Button
                  onClick={addAdjustment}
                  variant="contained"
                  disabled={adjLoading}
                >
                  {t("common.add") || "Add"}
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjOpen(false)} disabled={adjLoading}>
            {t("common.close") || "Close"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
