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
  IconButton,
  Avatar,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import type { PayrollRunResponse, Payslip } from "../../api/payroll";
import { updateEmployee, listEmployees } from "../../api/employees";
import { runPayroll, sendPayslipClient, computePayrollV2, savePayrollV2, closePayrollV2, listV2Loans, createV2Loan, skipV2LoanMonth, payoffV2Loan, getPayrollV2 } from "../../api/payroll";
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

  // Adjustment types and behavior
  const adjTypeOptions: Array<{ value: string; label: string }> = [
    { value: 'bonus', label: 'Bonus (LYD/USD)' },
    { value: 'deduction', label: 'Deduction (LYD/USD)' },
    { value: 'food_allow', label: 'Food Allowance (LYD)' },
    { value: 'comm_allow', label: 'Communication Allowance (LYD)' },
    { value: 'transport_allow', label: 'Transport Allowance (LYD)' },
    { value: 'gold_comm', label: 'Gold Sales Bonus' },
    { value: 'diamond_comm', label: 'Diamond Sales Bonus' },
    { value: 'watch_comm', label: 'Watch Commission' },
    { value: 'eid_bonus', label: 'Eid Bonus' },
    { value: 'advance', label: 'Advance (LYD)' },
    { value: 'loanPayment', label: 'Loan Payment (LYD)' },
  ];
  const adjLydOnlyTypes = new Set([
    'food_allow',
    'comm_allow',
    'transport_allow',
    'gold_comm',
    'diamond_comm',
    'watch_comm',
    'eid_bonus',
    'advance',
    'loanPayment',
  ]);

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
  const [tab, setTab] = React.useState<'payroll'|'advances'|'loans'|'adjustments'|'settings'>('payroll');
  const [filterText, setFilterText] = React.useState<string>('');
  const [sortKey, setSortKey] = React.useState<string>('name');
  const [sortDir, setSortDir] = React.useState<'asc'|'desc'>('asc');
  const [cols, setCols] = React.useState({
    holidayWorked: false,
    p: true,
    ph: true,
    phf: true,
    baseSalary: true,
    food: true,
    fuel: true,
    comm: true,
    advances: true,
    loans: true,
    salesQty: false,
    salesTotal: false,
    gold: true,
    diamond: true,
    watchComm: true,
    totalUsd: true,
  });
  const [loanAmount, setLoanAmount] = React.useState<string>("");
  const [existingAdvances, setExistingAdvances] = React.useState<number>(0);
  const [presentDaysMap, setPresentDaysMap] = React.useState<Record<number, number>>({});
  const [tsAgg, setTsAgg] = React.useState<Record<number, { presentP: number; phUnits: number; fridayA: number; missRatio: number; phFullDays: number; phPartDays: number; absenceDays: number }>>({});
  const [advMap, setAdvMap] = React.useState<Record<number, number>>({});
  const [nameMap, setNameMap] = React.useState<Record<number, string>>({});
  const [contractStartMap, setContractStartMap] = React.useState<Record<number, string | null>>({});
  const [hrEmails, setHrEmails] = React.useState<string>(() => {
    try { return localStorage.getItem('payroll_settings_hr_emails') || ''; } catch { return ''; }
  });
  const [financeEmails, setFinanceEmails] = React.useState<string>(() => {
    try { return localStorage.getItem('payroll_settings_finance_emails') || ''; } catch { return ''; }
  });
  const [jobs, setJobs] = React.useState<Array<{ id_job: number; job_name: string; Job_title: string; Job_code: string }>>([]);
  const [employeesByTitle, setEmployeesByTitle] = React.useState<Record<string, number[]>>({});
  const [sendDialogOpen, setSendDialogOpen] = React.useState(false);
  const [sendSelection, setSendSelection] = React.useState<Record<number, boolean>>({});

  // Loan & Salary Advance rule settings (persisted in localStorage)
  const [loanMaxMultiple, setLoanMaxMultiple] = React.useState<number>(() => {
    try { const v = Number(localStorage.getItem('payroll_settings_loan_max_multiple') || '3'); return Number.isFinite(v) && v > 0 ? v : 3; } catch { return 3; }
  });
  const [loanMonthlyPercent, setLoanMonthlyPercent] = React.useState<number>(() => {
    try { const v = Number(localStorage.getItem('payroll_settings_loan_monthly_percent') || '25'); return Number.isFinite(v) && v >= 0 ? v : 25; } catch { return 25; }
  });
  const [advanceMaxPercent, setAdvanceMaxPercent] = React.useState<number>(() => {
    try { const v = Number(localStorage.getItem('payroll_settings_advance_max_percent') || '50'); return Number.isFinite(v) && v >= 0 ? v : 50; } catch { return 50; }
  });
  const [isAdmin, setIsAdmin] = React.useState<boolean>(false);
  const [commList, setCommList] = React.useState<any[]>([]);
  const [commLoading, setCommLoading] = React.useState<boolean>(false);
  const [commDirty, setCommDirty] = React.useState<Record<number, any>>({});

  // Commission weight mode: 'individual' (seller grams) vs 'total' (aggregate PS scope grams)
  const [commissionWeightMode, setCommissionWeightMode] = React.useState<'individual' | 'total'>(() => {
    try {
      const v = localStorage.getItem('payroll_commission_weight_mode');
      return v === 'total' ? 'total' : 'individual';
    } catch { return 'individual'; }
  });
  React.useEffect(() => {
    try { localStorage.setItem('payroll_commission_weight_mode', commissionWeightMode); } catch {}
  }, [commissionWeightMode]);

  // Position filter (designation/TITLE)
  const [positionFilter, setPositionFilter] = React.useState<string>('all');

  // Row edit & autosave state
  const [rowEditOpen, setRowEditOpen] = React.useState(false);
  const [rowEdit, setRowEdit] = React.useState<any | null>(null);
  const [rowForm, setRowForm] = React.useState<any>({});
  const saveTimersRef = React.useRef<Record<string, any>>({});
  const [savingRows, setSavingRows] = React.useState<Record<number, boolean>>({});

  const toN = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const round2 = (n: number) => Number((n || 0).toFixed(2));

  const formatMoney = (n: number) => {
    const v = Number(n || 0);
    return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const formatInt = (n: number) => {
    const v = Number(n || 0);
    return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  // Arabic name helpers: treat strings of only question marks/spaces as corrupted
  const looksCorrupted = (s?: string) => {
    if (!s) return true;
    const t = String(s).trim();
    return t !== "" && /^\?+(\s\?+)*$/.test(t);
  };
  const chooseDisplayName = (ar?: string, en?: string, id?: number): string => {
    const sAr = (ar ?? "").trim();
    const sEn = (en ?? "").trim();
    if (sAr && !looksCorrupted(sAr)) return sAr;
    if (sEn && !looksCorrupted(sEn)) return sEn;
    return id != null ? `ID: ${id}` : "";
  };

  const applyRowForm = React.useCallback((idEmp: number, draft: any) => {
    setV2Rows((prev: any[]) => {
      const arr = Array.isArray(prev) ? [...prev] : [];
      const idx = arr.findIndex(r => Number(r.id_emp) === Number(idEmp));
      if (idx === -1) return prev;
      const base = arr[idx] || {} as any;
      const next = { ...base, ...draft } as any;
      // Recompute net locally to mirror BE save
      const total = toN(next.total_salary_lyd ?? next.D7);
      const net = total
        + toN(next.gold_bonus_lyd)
        + toN(next.diamond_bonus_lyd)
        + toN(next.other_bonus1_lyd)
        + toN(next.other_bonus2_lyd)
        + toN(next.loan_debit_lyd)
        + toN(next.other_additions_lyd)
        - toN(next.loan_credit_lyd)
        - toN(next.other_deductions_lyd);
      next.net_salary_lyd = round2(net);
      arr[idx] = next;
      return arr;
    });
  }, [setV2Rows]);

  const queueAutoSave = React.useCallback((idEmp: number) => {
    const key = String(idEmp);
    if (saveTimersRef.current[key]) clearTimeout(saveTimersRef.current[key]);
    saveTimersRef.current[key] = setTimeout(async () => {
      const row = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(idEmp));
      if (!row) return;
      try {
        setSavingRows(s => ({ ...s, [idEmp]: true }));
        await savePayrollV2({ year, month, rows: [row] });
      } catch {
        // no-op; UI stays updated and next save will retry
      } finally {
        setSavingRows(s => ({ ...s, [idEmp]: false }));
      }
    }, 600);
  }, [v2Rows, year, month]);

  // Compute monetary values for P / PH / PHF columns.
  // Prefer backend-calculated fields (v2Rows) so UI/PDF share the same logic,
  // but fall back to local tsAgg-based computation if backend fields are missing.
  type PPhPhfVals = {
  pLyd: number;
  pUsd: number;
  phLyd: number;
  phUsd: number;
  phfLyd: number;
  phfUsd: number;
};

const computePPhPhf = (e: Payslip): PPhPhfVals => {
  const vr =
    (v2Rows || []).find(
      (x: any) => Number(x.id_emp) === Number(e.id_emp)
    ) || ({} as any);

  // --- 1) Daily base rate from BASIC SALARY only ---
  const W = Math.max(1, Number(e.workingDays || vr.workingDays || 0) || 1);

  const baseLyd =
    Number(e.baseSalary ?? vr.base_salary_lyd ?? 0) || 0;
  const baseUsd =
    Number((e as any).baseSalaryUsd ?? vr.base_salary_usd ?? 0) || 0;

  const baseDailyLyd = baseLyd / W;
  const baseDailyUsd = baseUsd / W;

  // --- 2) Number of days for each type ---
  const pDays =
    Number((vr as any).p_days ?? e.presentWorkdays ?? 0) || 0;
  const phDays = Number((vr as any).ph_days ?? 0) || 0;
  const phfDays = Number((vr as any).phf_days ?? 0) || 0;

  // --- 3) Food per working day (for PHF) ---
  let foodPerDay = Number(
    (e as any).FOOD || (e as any).FOOD_ALLOWANCE || vr.food_per_day_lyd || 0
  );
  if (!foodPerDay) {
    const totalFoodLyd = Number((vr as any).wd_food_lyd || 0);
    const present =
      Number(pDays || presentDaysMap[e.id_emp] || e.presentWorkdays || 0) || 0;
    foodPerDay =
      totalFoodLyd && present ? totalFoodLyd / present : 0;
  }

  // --- 4) P / PH / PHF amounts ---
  // P = normal daily rate
  const pLyd = pDays * baseDailyLyd;
  const pUsd = pDays * baseDailyUsd;

  // PH = double daily rate (no extra food)
  const phLyd = phDays * (baseDailyLyd * 2);
  const phUsd = phDays * (baseDailyUsd * 2);

  // PHF = double daily rate + normal food allowance
  const phfLyd = phfDays * (baseDailyLyd * 2 + foodPerDay);
  const phfUsd = phfDays * (baseDailyUsd * 2);

  return {
    pLyd: Number(pLyd.toFixed(2)),
    pUsd: Number(pUsd.toFixed(2)),
    phLyd: Number(phLyd.toFixed(2)),
    phUsd: Number(phUsd.toFixed(2)),
    phfLyd: Number(phfLyd.toFixed(2)),
    phfUsd: Number(phfUsd.toFixed(2)),
  };
};


  // Consistent NET calculator (matches PDF logic). Returns non-negative LYD.
  function computeNetLYDFor(id_emp: number): number {
    try {
      const emp = (result?.employees || []).find((e) => Number(e.id_emp) === Number(id_emp));
      const v2 = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(id_emp)) || ({} as any);
      if (!emp) return 0;
      const agg = tsAgg[id_emp] || { presentP: 0, phUnits: 0, fridayA: 0, missRatio: 1, phFullDays: 0, phPartDays: 0 };
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
      // Transportation (FUEL) and Communication allowances — flat monthly amounts
      const fuelMonthly = Number(((emp as any).FUEL ?? (v2 as any).FUEL) || 0);
      const commMonthly = Number(((emp as any).COMMUNICATION ?? (v2 as any).COMMUNICATION) || 0);
      const transportAdj = Math.max(0, Number(fuelMonthly.toFixed(2)));
      const commAdj = Math.max(0, Number(commMonthly.toFixed(2)));
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

  // Load monthly adjustments for the selected employee in the Adjustments tab
  React.useEffect(() => {
    if (tab !== 'adjustments' || !adjEmpId) {
      setAdjRows([]);
      return;
    }
    (async () => {
      try {
        const url = `http://localhost:9000/hr/payroll/adjustments?year=${year}&month=${month}&employeeId=${adjEmpId}`;
        const res = await fetch(url, { headers: authHeader() as unknown as HeadersInit });
        if (!res.ok) {
          setAdjRows([]);
          return;
        }
        const js = await res.json();
        const rows = (js?.data?.[String(adjEmpId)] || []) as Array<{ type: string; amount: number; currency: string; note?: string; ts?: string }>;
        setAdjRows(rows);
      } catch {
        setAdjRows([]);
      }
    })();
  }, [tab, adjEmpId, year, month]);

  // Per-type subtotals for Adjustments dialog
  const adjTypeTotals = React.useMemo(() => {
    const map: Record<string, { lyd: number; usd: number }> = {};
    (adjRows || []).forEach((r) => {
      if (!r) return;
      const k = r.type || 'other';
      if (!map[k]) map[k] = { lyd: 0, usd: 0 };
      const amt = Number(r.amount || 0) || 0;
      if (!amt) return;
      if ((r.currency || 'LYD').toUpperCase() === 'USD') map[k].usd += amt;
      else map[k].lyd += amt;
    });
    return map;
  }, [adjRows]);

  // Dynamic table min width for horizontal scrolling based on visible columns
  const tableMinWidth = React.useMemo(() => {
    let w = 0;
    w += 180; // Employee
    w += 64; // Absence (LYD)
    if (cols.holidayWorked) w += 64;
    if (cols.baseSalary) w += 80;
    if (cols.food) w += 72;
    if (cols.fuel) w += 72;
    if (cols.comm) w += 72;
    if (cols.advances) w += 78;
    if (cols.loans) w += 78;
    if (cols.salesQty) w += 64;
    if (cols.salesTotal) w += 84;
    if (cols.gold) w += 96;
    if (cols.diamond) w += 96;
    if (cols.watchComm) w += 84;
    w += 120; // Gross (LYD | USD)
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

  React.useEffect(() => {
  (async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_IP || 'http://localhost:9000'}/jobs/jobs`, {
        headers: authHeader() as any,
      });
      if (!res.ok) return;
      const js = await res.json();
      const arr = Array.isArray(js) ? js : (js.data || []);
      setJobs(arr);
    } catch {
      // ignore
    }
  })();
}, []);

  const addAdjustment = async () => {
    if (!adjEmpId) return;
    if (!adjForm.amount) { alert('Amount required'); return; }
    setAdjLoading(true);
    try {
      const isLydOnly = adjLydOnlyTypes.has(adjForm.type);
      const payload = {
        year,
        month,
        employeeId: adjEmpId,
        type: adjForm.type,
        amount: Number(adjForm.amount),
        currency: isLydOnly ? 'LYD' : adjForm.currency,
        note: adjForm.note,
      };
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

  // Recompute Gold commissions for all employees based on selected weight mode
  React.useEffect(() => {
    (async () => {
      try {
        if (!result || !Array.isArray(v2Rows) || v2Rows.length === 0) return;
        const monthStartISO = dayjs(`${year}-${String(month).padStart(2,'0')}-01`).format('YYYY-MM-DD');
        const monthEndISO = dayjs(`${year}-${String(month).padStart(2,'0')}-01`).endOf('month').format('YYYY-MM-DD');

        // Load employees to resolve seller userId, role, and PS scope
        let empList: any[] = [];
        try { empList = await listEmployees() as any[]; } catch {}
        const empMeta = new Map<number, { sellerUserId: number | null; roleKey: string; psScope: number[]; psFallback: number | null }>();
        for (const e of (empList || [])) {
          const id = Number(e?.ID_EMP ?? e?.id_emp ?? e?.id);
          if (!Number.isFinite(id)) continue;
          let roleKey = '';
          let psScope: number[] = [];
          let sellerUserId: number | null = null;
          try {
            const jd = e?.JOB_DESCRIPTION ? JSON.parse(e.JOB_DESCRIPTION) : {};
            const sid = jd?.__sales__?.userId ?? jd?.__seller__?.userId ?? null;
            if (sid != null && !Number.isNaN(Number(sid))) sellerUserId = Number(sid);
            roleKey = String(jd?.__commissions__?.role || '').toLowerCase();
            const psList = jd?.__commissions__?.ps;
            if (Array.isArray(psList)) psScope = psList.map((x:any)=>Number(x)).filter((n:number)=>Number.isFinite(n));
          } catch {}
          const psFallback = Number(e?.PS ?? e?.ps ?? NaN);
          empMeta.set(id, { sellerUserId, roleKey, psScope, psFallback: Number.isFinite(psFallback) ? Number(psFallback) : null });
        }

        // Fetch all invoice details once and aggregate gold grams by user and by PS
        let rowsAll: any[] = [];
        try {
          const qs = new URLSearchParams({ from: monthStartISO, to: monthEndISO }).toString();
          const r = await fetch(`http://localhost:9000/invoices/allDetailsP?${qs}`, { headers: authHeader() as unknown as HeadersInit });
          if (r.ok) rowsAll = await r.json();
        } catch {}
        const gramsByUser = new Map<number, number>();
        const gramsByPs = new Map<number, number>();
        for (const row of (Array.isArray(rowsAll) ? rowsAll : [])) {
          const typeRaw = String(row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || '').toLowerCase();
          if (!typeRaw.includes('gold')) continue;
          const achats = Array.isArray(row?.ACHATs) ? row.ACHATs : [];
          let grams = 0;
          for (const a of achats) {
            const st = String(a?.Fournisseur?.TYPE_SUPPLIER || '').toLowerCase();
            if (st.includes('gold')) {
              const q = Number(a?.qty || 0);
              if (!Number.isNaN(q)) grams += q;
            }
          }
          if (grams <= 0) continue;
          const uid = Number(row?.Utilisateur?.id_user ?? row?.user_id ?? NaN);
          if (Number.isFinite(uid)) gramsByUser.set(uid, (gramsByUser.get(uid) || 0) + grams);
          const psVal = Number(row?.ps ?? row?.PS ?? NaN);
          if (Number.isFinite(psVal)) gramsByPs.set(psVal, (gramsByPs.get(psVal) || 0) + grams);
        }

        // Load commission settings (role -> LYD/g)
        const commissionSettings = (() => {
          try {
            const raw = localStorage.getItem('commissionSettingsV1');
            if (!raw) throw new Error('no settings');
            const cfg = JSON.parse(raw);
            return cfg && typeof cfg === 'object' ? cfg : {};
          } catch { return {} as any; }
        })();
        const goldRates: Record<string, number> = {
          sales_rep: 1,
          senior_sales_rep: 1.25,
          sales_lead: 1.5,
          sales_manager: 1.5,
          ...(commissionSettings.gold || {}),
        };

        // Build updated rows with new gold_bonus_lyd
        const byId = new Map<number, any>();
        (v2Rows || []).forEach((r:any) => byId.set(Number(r.id_emp), r));
        const changed: any[] = [];
        for (const emp of (result?.employees || [])) {
          const id = Number((emp as any).id_emp);
          const base = byId.get(id) || {};
          const meta = empMeta.get(id);
          if (!meta || meta.sellerUserId == null) continue;
          const roleKey = String(meta.roleKey || '').toLowerCase();
          const goldRate = goldRates[roleKey] ?? 0;
          if (!goldRate) continue;
          let gramsUsed = 0;
          if (commissionWeightMode === 'total') {
            const scope = (meta.psScope && meta.psScope.length > 0) ? meta.psScope : (meta.psFallback != null ? [meta.psFallback] : []);
            for (const p of scope) gramsUsed += (gramsByPs.get(Number(p)) || 0);
          } else {
            gramsUsed = gramsByUser.get(Number(meta.sellerUserId)) || 0;
          }
          const newBonus = Number((gramsUsed * goldRate).toFixed(2));
          const oldBonus = Number(base.gold_bonus_lyd || 0);
          if (Math.abs(newBonus - oldBonus) > 0.009) {
            const updated = { ...base, id_emp: id, gold_bonus_lyd: newBonus };
            changed.push(updated);
          }
        }
        if (changed.length > 0) {
          setV2Rows((prev:any[]) => {
            const map = new Map<number, any>();
            (prev||[]).forEach((r:any)=> map.set(Number(r.id_emp), r));
            for (const u of changed) map.set(Number(u.id_emp), { ...map.get(Number(u.id_emp)), ...u });
            return Array.from(map.values());
          });
          try {
            if (!viewOnly) await savePayrollV2({ year, month, rows: changed });
          } catch {}
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commissionWeightMode, year, month]);

  // Sort/filter helpers
  const sortRows = React.useCallback((rows: Payslip[]) => {
    const arr = [...rows];
    const getVal = (e: Payslip): any => {
      switch (sortKey) {
        case 'name': return String(nameMap[e.id_emp] ?? e.name ?? '').toLowerCase();
        case 'deductionDays': return Number(e.deductionDays||0);
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
        case 'adjustments': { const a=e.components?.adjustments||{bonus:0,deduction:0,advance:0,loanPayment:0}; return (a.bonus||0)-((a.deduction||0)+(a.advance||0)+(a.loanPayment||0)); }
        case 'salesQty': return Number((sales[String(e.id_emp)]?.qty) || 0);
        case 'salesTotal': return Number((sales[String(e.id_emp)]?.total_lyd) || 0);
        case 'gold': { const vr=(v2Rows||[]).find((x:any)=>Number(x.id_emp)===Number(e.id_emp))||{}; return Number(vr.gold_bonus_lyd||0); }
        case 'diamond': { const vr=(v2Rows||[]).find((x:any)=>Number(x.id_emp)===Number(e.id_emp))||{}; return Number(vr.diamond_bonus_lyd||0); }
        case 'total': {
          const vr=(v2Rows||[]).find((x:any)=>Number(x.id_emp)===Number(e.id_emp))||{};
          return Number((vr as any).net_salary_lyd ?? (vr as any).D16 ?? 0);
        }
        case 'totalUsd': {
          const W=Math.max(1,e.workingDays||1); const baseUsd=e.baseSalaryUsd? (e.baseSalaryUsd/W)*(e.factorSum || 1):0; const vr=(v2Rows||[]).find((x:any)=>Number(x.id_emp)===Number(e.id_emp))||{}; const commUsd=Number((vr as any).diamond_bonus_usd||0)+Number((vr as any).gold_bonus_usd||0); return baseUsd+commUsd;
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
  }, [sortKey, sortDir, sales, v2Rows, advMap, psPoints, nameMap]);

  // Distinct positions for filter UI (from Jobs list)
  const positionOptions = React.useMemo(
    () =>
      jobs.map((j) => ({
        id: j.id_job,
        label: j.Job_title || j.job_name || j.Job_code || String(j.id_job),
      })),
    [jobs]
  );

  const displayedRows: Payslip[] = React.useMemo(() => {
    let rows = result?.employees || [];
    if (positionFilter && positionFilter !== "all") {
      const jobId = Number(positionFilter);
      const job = jobs.find((j) => Number(j.id_job) === jobId);
      if (job) {
        const titleKey = String(job.Job_title || "").trim();
        if (titleKey) {
          const ids = employeesByTitle[titleKey] || [];
          if (ids.length > 0) {
            rows = rows.filter((r) => {
              const id = Number((r as any).id_emp ?? (r as any).ID_EMP);
              return ids.includes(id);
            });
          } else {
            rows = [];
          }
        } else {
          rows = [];
        }
      }
    }
    // Filter by search text
    const f = String(filterText || '').toLowerCase();
    const filtered = f
      ? rows.filter(r => {
          const nm = String(nameMap[r.id_emp] ?? r.name ?? '').toLowerCase();
          return nm.includes(f) || String(r.id_emp).includes(f);
        })
      : rows;
    return sortRows(filtered);
  }, [result, positionFilter, filterText, sortRows, nameMap, jobs, employeesByTitle]);

  // Totals for current view
  const totals = React.useMemo(() => {
    const t = {
      workingDays: 0,
      deductionDays: 0,
      holidayWorked: 0,
      baseSalary: 0,
      baseSalaryUsd: 0,
      base: 0,
      allow: 0,
      food: 0,
      fuel: 0,
      comm: 0,
      adj: 0,
      salesQty: 0,
      salesTotal: 0,
      gold: 0,
      diamond: 0,
      pLyd: 0,
      pUsd: 0,
      phLyd: 0,
      phUsd: 0,
      phfLyd: 0,
      phfUsd: 0,
      grossLyd: 0,
      grossUsd: 0,
      totalLyd: 0,
      totalUsd: 0,
    };
    displayedRows.forEach(e => {
      t.workingDays += Number(e.workingDays || 0);
      const vr = (v2Rows||[]).find((x:any)=> Number(x.id_emp)===Number(e.id_emp)) || {} as any;
      t.deductionDays += Number(vr.absence_lyd || 0);
      t.holidayWorked += Number(e.holidayWorked || 0);
      t.baseSalary += Number(e.baseSalary || 0);
      t.baseSalaryUsd += Number((e as any).baseSalaryUsd || 0);
      t.base += 0;
      t.allow += 0;
      const W = Math.max(1, e.workingDays||1);
      const foodPer = Number((e as any).FOOD || (e as any).FOOD_ALLOWANCE || 0);
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
      t.grossLyd += Number(vr.total_salary_lyd ?? vr.totalLyd ?? 0);
      t.grossUsd += Number(vr.total_salary_usd ?? vr.totalUsd ?? 0);
      t.totalLyd += Number(vr.net_salary_lyd ?? vr.D16 ?? 0);
      t.totalUsd += Number(vr.net_salary_usd ?? vr.C16 ?? 0);
      const pp = computePPhPhf(e);
      t.pLyd += pp.pLyd;
      t.pUsd += pp.pUsd;
      t.phLyd += pp.phLyd;
      t.phUsd += pp.phUsd;
      t.phfLyd += pp.phfLyd;
      t.phfUsd += pp.phfUsd;
    });
    return t;
  }, [displayedRows, sales, v2Rows, advMap, tsAgg]);

  const onRun = async () => {
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      // Always compute fresh for active employees (ignore any saved data)
      const v2 = await computePayrollV2({ year, month });
      // Persist computed rows for this open month so backend tables stay in sync
      try {
        if (!v2.viewOnly && Array.isArray(v2.rows) && v2.rows.length) {
          await savePayrollV2({ year: v2.year, month: v2.month, rows: v2.rows });
        }
      } catch {}
      const start = `${v2.year}-${String(v2.month).padStart(2,'0')}-01`;
      const end = `${v2.year}-${String(v2.month).padStart(2,'0')}-${String(new Date(v2.year, v2.month, 0).getDate()).padStart(2,'0')}`;
      setV2Rows(v2.rows || []);
      // Load employee allowances (FUEL, COMMUNICATION) once and index by id
      let allowMap: Record<number, { fuel: number; comm: number }> = {};
      try {
        const empList = await listEmployees();
        const nm: Record<number, string> = {};
        const byTitle: Record<string, number[]> = {};
        if (Array.isArray(empList)) {
          for (const e of empList as any[]) {
            const id = Number(e?.ID_EMP ?? e?.id_emp);
            if (!Number.isFinite(id)) continue;
            allowMap[id] = {
              fuel: Number(e?.FUEL || 0),
              comm: Number(e?.COMMUNICATION || 0),
            };
            const disp = chooseDisplayName(String(e?.NAME || ''), String(e?.NAME_ENGLISH || ''), id);
            if (disp) nm[id] = disp;
            const title = String((e as any).TITLE || '').trim();
            if (title) {
              if (!byTitle[title]) byTitle[title] = [];
              byTitle[title].push(id);
            }
          }
        }
        setNameMap(nm);
        setEmployeesByTitle(byTitle);
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
        const agg: Record<number, { presentP: number; phUnits: number; fridayA: number; missRatio: number; phFullDays: number; phPartDays: number; absenceDays: number }> = {};
        await Promise.all(employees.map(async (e, idx) => {
          try {
            const days = await ensureTimesheetDays(e.id_emp);
            const vr = (v2.rows || []).find((x: any) => Number(x.id_emp) === Number(e.id_emp)) || {};
            const pick = (s: any): number | null => {
              if (!s) return null; const m = String(s).match(/(\d{1,2}):(\d{2})/); if (!m) return null; const hh=Number(m[1]); const mm=Number(m[2]); if (!Number.isFinite(hh)||!Number.isFinite(mm)) return null; return hh*60+mm;
            };
            const s1 = pick((vr as any).T_START || (vr as any).t_start || (vr as any).SCHEDULE_START || (vr as any).shift_start);
            const s2 = pick((vr as any).T_END || (vr as any).t_end || (vr as any).SCHEDULE_END || (vr as any).shift_end);
            let presentP = 0, phUnits = 0, fridayA = 0, missAll = 0, missNoPT = 0, phFullDays = 0, phPartDays = 0, absenceDays = 0;
            for (let i = 0; i < days.length; i++) {
              const d = days[i];
              const c = codeBadge(d, s1, s2);
              // Treat P, PH, PHF as worked/present days for UI counts
              if (c === 'P' || c === 'PH' || c === 'PHF') presentP += 1;
              // Keep PH/PHF units and day breakdown for holiday pay
              if (c === 'PHF') { phUnits += 2; phFullDays += 1; }
              else if (c === 'PH') { phUnits += 1; phPartDays += 1; }
              if (c === 'A') absenceDays += 1;
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
            agg[e.id_emp] = { presentP, phUnits, fridayA, missRatio, phFullDays, phPartDays, absenceDays };
          } catch {}
        }));
        // Override UI absence_days / presentWorkdays with manual punches
        employees.forEach((emp) => {
          const a = agg[emp.id_emp];
          if (!a) return;
          const working = Number(emp.workingDays || 0);
          const abs = Number(a.absenceDays || 0);
          emp.deductionDays = abs;
          emp.presentWorkdays = Math.max(0, working - abs);
        });
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
  const dispName = String(nameMap[emp.id_emp] ?? emp.name ?? emp.id_emp);
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

  const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const dim = new Date(year, month, 0).getDate();

  const v2 = (v2Rows || []).find((x:any) => Number(x.id_emp) === Number(emp.id_emp)) || {} as any;

  // Net values: use backend/V2 net salaries so PDF matches UI grid "Total" exactly
  let netLyd = Math.max(0, Number(((v2 as any).net_salary_lyd ?? (v2 as any).D16 ?? 0)));
  let netUsd = Math.max(0, Number(((v2 as any).net_salary_usd ?? (v2 as any).C16 ?? 0)));

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
  
  let roleStr = String(emp.designation || '').trim();
  const logoH = 90; // slightly larger logo height
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
        const w = Math.max(logoH * 1.1, (img.naturalWidth || logoH) * scale);
        const w2 = Math.min(w * 1.15, pageW - margin * 2);
        const x = margin; // logo on the left side
        logoX = x; logoW = w2; logoY = Math.max(2, margin - 16);
        doc.addImage(dataBlack, 'PNG', x, logoY, w2, logoH);
        try {
          // Defer drawing PAYSLIP label until after right header block to align heights
          paySlipCenterX = pageW - margin - (w2 / 2);
        } catch {}
        resolve();
      };
      img.onerror = () => resolve();
      img.src = logoData;
    });
  }
  
  // Resolve v2 row for this employee early (used by header values like PS)
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
  const nameY = (logoY || (margin - 16)) + logoH / 2 - 14;
  const idY = nameY + 12;
  const posY = idY + 12;
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

    // Single rounded box for Name / ID (left) and Position / PS (right)
    const boxW = areaPre;
    const boxH = rowH * 2;
    const boxX = tX;
    const boxY = tY;
    doc.setDrawColor('#999999');
    (doc as any).setFillColor(235,235,235);
    try {
      (doc as any).roundedRect(boxX, boxY, boxW, boxH, 5, 5, 'F');
      doc.rect(boxX, boxY, boxW, boxH);
    } catch {
      doc.rect(boxX, boxY, boxW, boxH, 'F');
      doc.rect(boxX, boxY, boxW, boxH);
    }
    // Inner grid lines (2x2 layout)
    try {
      const innerV = boxX + boxW / 2;
      const innerH = boxY + boxH / 2;
      doc.setDrawColor('#bbbbbb');
      doc.line(innerV, boxY, innerV, boxY + boxH);
      doc.line(boxX, innerH, boxX + boxW, innerH);
    } catch {}
    doc.setFont('helvetica','normal');
    doc.setFontSize(10);
    const colW = boxW / 2;
    const col1X = boxX + 10;
    const col2X = boxX + colW + 10;
    const lineGap = rowH;
    const col1: Array<[string,string]> = [
      ['Name', String(dispName || '')],
      ['ID', String(emp.id_emp || '')],
    ];
    const col2: Array<[string,string]> = [
      ['Position', roleStr || '-'],
      ['PS', String(psTxt || '-')],
    ];
    const drawHeaderLine = async (lab: string, val: string, baseX: number, idx: number) => {
      const yLine = boxY + 12 + idx * lineGap;
      doc.text(lab, baseX, yLine);
      const v = val || '';
      const valueX = baseX + 60;
      if (hasArabic(v)) {
        const img = await drawArabicTextImage(v, 10);
        if (img) doc.addImage(img.dataUrl, 'PNG', valueX, yLine - 10, img.wPt, img.hPt);
        else doc.text(v, valueX, yLine);
      } else {
        doc.text(v, valueX, yLine);
      }
    };
    for (let i = 0; i < col1.length; i++) {
      await drawHeaderLine(col1[i][0], col1[i][1], col1X, i);
    }
    for (let i = 0; i < col2.length; i++) {
      await drawHeaderLine(col2[i][0], col2[i][1], col2X, i);
    }
    const boxBottom = boxY + boxH;
    infoBottomYCalc = boxBottom;
    // Right-side Company/Branch/Month block (swapped with logo), right-aligned
    try {
      const bTxt = branchName || '';
      if (bTxt) {
        const topY = (logoY || margin) + 32;
        doc.setFont('helvetica','bold');
        doc.setFontSize(14);
        doc.setTextColor(0,0,0);
        const gj = 'Gaja Jewelry';
        const gjW = doc.getTextWidth(gj);
        const gjX = pageW - margin - gjW;
        doc.text(gj, gjX, Math.max(10, topY));

        const brW = doc.getTextWidth(bTxt);
        const brX = pageW - margin - brW;
        doc.text(bTxt, brX, topY + 18);

        doc.setFont('helvetica','normal');
        doc.setFontSize(10);
        const pmW = doc.getTextWidth(payMonthStr);
        const pmX = pageW - margin - pmW;
        doc.text(payMonthStr, pmX, topY + 32);
      }
    } catch {}
  } catch {}
  // Right side header texts removed; Pay month rendered under branch

  // (net recomputation moved below, after all variables are defined)
  const csStr = (v2 as any).T_START || (v2 as any).contract_start || (v2 as any).contractStart;
  const contractStart = csStr ? dayjs(csStr) : null;
  const missMinNoPT = days.reduce((acc, d) => acc + (((d?.deltaMin ?? 0) < 0 && codeBadge(d, schStartMinPDF, schEndMinPDF) !== 'PT') ? Math.abs(d!.deltaMin!) : 0), 0);
  const missH = Math.floor(missMinNoPT / 60);
  const missM = Math.floor(missMinNoPT % 60);
  const missStr = (missH||missM) ? `${String(missH)}h${missM?` ${String(missM)}m`:''}` : '';
  const bv = (n:any)=>Number(n||0);
  const fmt = (n:number)=> n ? n.toLocaleString(undefined,{maximumFractionDigits:2}) : '';
  // Food allowance present-days should NOT include PH/PHF; count only actual present 'P'
  const presentDaysCount = Array.isArray(days) ? days.filter(d => codeBadge(d as any, schStartMinPDF, schEndMinPDF) === 'P').length : 0;
  const wdFoodLydPDF = Number((v2 as any).wd_food_lyd || 0);
  const foodDaysV2PDF = Number((v2 as any).food_days || (v2 as any).workingDays || emp.workingDays || 0);
  const foodPerDayLydPDF = foodDaysV2PDF > 0 ? wdFoodLydPDF / foodDaysV2PDF : 0;
  const foodLydAdjPDF = Number((foodPerDayLydPDF * presentDaysCount).toFixed(2));
  // PH fallback: if v2 lacks ph amounts, compute daily pay: PHF=2x, PH=1x
  const workingDaysPref = Number(emp.workingDays || (v2 as any).workingDays || foodDaysV2PDF || 0);
  // Travel/Communication allowances from Employee Profile (flat monthly amounts)
  let fuelMonthlyPDF = Number(((emp as any).FUEL ?? (v2 as any).FUEL) || 0);
  let commMonthlyPDF = Number(((emp as any).COMMUNICATION ?? (v2 as any).COMMUNICATION) || 0);
  if (!fuelMonthlyPDF && !commMonthlyPDF) {
    try {
      const resEmp = await fetch(`http://localhost:9000/employees/${emp.id_emp}`, { headers: authHeader() as unknown as HeadersInit });
      if (resEmp.ok) {
        const payload = await resEmp.json();
        const obj = payload?.data ?? payload;
        fuelMonthlyPDF = Number(obj?.FUEL || 0);
        commMonthlyPDF = Number(obj?.COMMUNICATION || 0);
      }
    } catch {}
  }
  const travelLydPDF = Number((fuelMonthlyPDF || 0).toFixed(2));
  const commLydPDF = Number((commMonthlyPDF || 0).toFixed(2));
  // Absence days for PDF: count only true 'A' codes, excluding Friday absences
  const absenceDaysPDF = Array.isArray(days) ? days.reduce((cnt, d, idx) => {
    const c = codeBadge(d as any, schStartMinPDF, schEndMinPDF);
    const dow = dayjs(periodStart).date(idx + 1).day();
    if (c === 'A' && dow !== 5) return cnt + 1;
    return cnt;
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
  
  // Breakdown table driven directly from V2 fields (for the small summary box)
  const breakdown: Array<{label:string; lyd:number; usd:number; note?:string}> = [
    { label: 'Basic Salary', lyd: bv(v2.base_salary_lyd), usd: bv(v2.base_salary_usd) },
    { label: 'Food Allowance', lyd: foodLydAdjPDF, usd: 0, note: String(presentDaysCount || '') },
    { label: 'Absent Days', lyd: bv(v2.absence_lyd), usd: bv(v2.absence_usd), note: String(absenceDaysPDF || '') },
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
  const usdCandidates = ['base_salary_usd','wd_food_usd','gold_bonus_usd','diamond_bonus_usd','other_additions_usd','absence_usd','missing_usd','loan_credit_usd','other_deductions_usd','net_salary_usd','C16'];
  const hasUsd = usdCandidates.some(k => (v2 as any)[k] !== undefined && Number((v2 as any)[k] || 0) !== 0) || (diamondBonusUSDComputed > 0) || (goldBonusUSDComputed > 0);
  const showUsdCol = hasUsd;
  const showLydCol = brShowLyd || !showUsdCol; // if there is no LYD but there is USD, still show USD-only; otherwise at least LYD
  
  // Earnings header (light grey background)
  doc.setDrawColor('#999999');
  (doc as any).setFillColor(240, 240, 240);
  doc.rect(margin, tblY, colW, 26, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text("EARNINGS", margin + 6, tblY + 16);
  // Show LYD and/or USD column headers depending on data presence
  if (showUsdCol && showLydCol) {
    doc.text("LYD", margin + colW - 160, tblY + 16);
    doc.text("USD", margin + colW - 80, tblY + 16);
  } else if (showUsdCol && !showLydCol) {
    doc.text("USD", margin + colW - 80, tblY + 16);
  } else if (showLydCol) {
    doc.text("LYD", margin + colW - 80, tblY + 16);
  }
  // Vertical separators for LYD / USD columns
  try {
    if (showLydCol) doc.line(margin + colW - 170, tblY, margin + colW - 170, tblY + 26);
    if (showUsdCol) doc.line(margin + colW - 90, tblY, margin + colW - 90, tblY + 26);
  } catch {}
  doc.setFont('helvetica', 'normal');
  
  const row = (label: string, lyd: number, usd: number, yy: number) => {
    doc.setDrawColor('#999999');
    (doc as any).setFillColor(240, 240, 240);
    doc.rect(margin, yy, colW, 24, 'F');
    doc.rect(margin, yy, colW, 24);
    // vertical separators for LYD / USD columns
    try {
      if (showLydCol) doc.line(margin + colW - 170, yy, margin + colW - 170, yy + 24);
      if (showUsdCol) doc.line(margin + colW - 90, yy, margin + colW - 90, yy + 24);
    } catch {}
    doc.setFont('helvetica','normal');
    doc.text(label, margin + 6, yy + 15);
    const lydStr = Math.max(0, Number(lyd||0)) > 0.0001 ? `${Math.max(0, Number(lyd||0)).toLocaleString(undefined,{maximumFractionDigits:2})}` : '';
    const usdStr = Math.max(0, Number(usd||0)) > 0.0001 ? `${Math.max(0, Number(usd||0)).toLocaleString(undefined,{maximumFractionDigits:2})}` : '';
    doc.setFont('helvetica','bold');
    if (showLydCol && lydStr) doc.text(lydStr, margin + colW - 160, yy + 15);
    if (showUsdCol && usdStr) doc.text(usdStr, margin + colW - 80, yy + 15);
    doc.setFont('helvetica','normal');
  };
  
  let ey = tblY + 28;
  let earningsLydTotal = 0;
  let earningsUsdTotal = 0;
  {
    // Show base salary only (from v2), and food allowance + split bonuses
    const baseLyd = Math.max(0, Number((v2 as any).base_salary_lyd || emp.baseSalary || 0));
    const baseUsd = Math.max(0, Number((v2 as any).base_salary_usd || 0));
    if (baseLyd > 0.0001 || baseUsd > 0.0001) {
      row("Base", baseLyd, baseUsd, ey);
      earningsLydTotal += baseLyd;
      earningsUsdTotal += baseUsd;
      ey += 24;
    }
    const foodLyd = Math.max(0, Number(foodLydAdjPDF || 0));
    const foodUsd = 0;
    const foodLabel = `Food`;
    if (foodLyd > 0.0001 || foodUsd > 0.0001) {
      row(foodLabel, foodLyd, foodUsd, ey);
      earningsLydTotal += foodLyd;
      earningsUsdTotal += foodUsd;
      ey += 24;
    }
    const travelLyd = Math.max(0, Number(travelLydPDF || 0));
    if (travelLyd > 0.0001) {
      row('Transportation', travelLyd, 0, ey);
      earningsLydTotal += travelLyd;
      ey += 24;
    }
    const commLyd = Math.max(0, Number(commLydPDF || 0));
    if (commLyd > 0.0001) {
      row('Communication', commLyd, 0, ey);
      earningsLydTotal += commLyd;
      ey += 24;
    }
    const goldLyd = Math.max(0, Number(goldBonusLYDComputed || (v2 as any).gold_bonus_lyd || 0));
    const goldUsd = Math.max(0, Number((v2 as any).gold_bonus_usd || goldBonusUSDComputed || 0));
    const goldLabel = 'Gold Bonus **';
    if (goldLyd > 0.0001 || goldUsd > 0.0001) {
      row(goldLabel, goldLyd, goldUsd, ey);
      earningsLydTotal += goldLyd;
      earningsUsdTotal += goldUsd;
      ey += 24;
    }
    const diaLyd = Math.max(0, Number(diamondBonusLYDComputed || (v2 as any).diamond_bonus_lyd || 0));
    const diaUsd = Math.max(0, Number(diamondBonusUSDComputed || (v2 as any).diamond_bonus_usd || 0));
    const diaLabel = 'Diamond Bonus *';
    if (diaLyd > 0.0001 || diaUsd > 0.0001) {
      row(diaLabel, diaLyd, diaUsd, ey);
      earningsLydTotal += diaLyd;
      earningsUsdTotal += diaUsd;
      ey += 24;
    }
    const othLyd = Math.max(0, Number((v2 as any).other_additions_lyd || 0));
    const othUsd = Math.max(0, Number((v2 as any).other_additions_usd || 0));
    if (othLyd > 0.0001 || othUsd > 0.0001) {
      row("Other Bonus", othLyd, othUsd, ey);
      earningsLydTotal += othLyd;
      earningsUsdTotal += othUsd;
      ey += 24;
    }
    // Net Salary row removed per request (only shown in footer boxes)
  }

  // Earnings totals row (position aligned later with Total Deductions)
  let earningsTotalY: number | null = null;
  if (earningsLydTotal > 0.0001 || earningsUsdTotal > 0.0001) {
    earningsTotalY = ey + 4;
  }
  
  // Deductions header (same style as Earnings header)
  const dx = rx; const dy = tblY;
  doc.setDrawColor('#999999');
  (doc as any).setFillColor(240, 240, 240);
  doc.rect(dx, dy, colW, 26, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text("DEDUCTIONS", dx + 6, dy + 16);
  // Show LYD and/or USD column headers depending on data presence (mirroring Earnings)
  if (showUsdCol && showLydCol) {
    doc.text("LYD", dx + colW - 160, dy + 16);
    doc.text("USD", dx + colW - 80, dy + 16);
  } else if (showUsdCol && !showLydCol) {
    doc.text("USD", dx + colW - 80, dy + 16);
  } else if (showLydCol) {
    doc.text("LYD", dx + colW - 80, dy + 16);
  }
  // Vertical separators for LYD / USD columns (same as Earnings header)
  try {
    if (showLydCol) doc.line(dx + colW - 170, dy, dx + colW - 170, dy + 26);
    if (showUsdCol) doc.line(dx + colW - 90, dy, dx + colW - 90, dy + 26);
  } catch {}
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
  const dedTotalLyd = dRowsDual.reduce((s, r) => s + Math.max(0, Number(r.lyd||0)), 0);
  const dedTotalUsd = dRowsDual.reduce((s, r) => s + Math.max(0, Number(r.usd||0)), 0);
  const dedRendered = Math.min(maxDedRows, Math.max(dRowsDual.length, 0));
  for (let i = 0; i < dedRendered; i++) {
    const yy2 = dy + 28 + i * 24;
    doc.setDrawColor('#999999');
    (doc as any).setFillColor(240, 240, 240);
    doc.rect(dx, yy2, colW, 24, 'F');
    doc.rect(dx, yy2, colW, 24);
    // vertical separators for LYD / USD columns
    try {
      if (showLydCol) doc.line(dx + colW - 170, yy2, dx + colW - 170, yy2 + 24);
      if (showUsdCol) doc.line(dx + colW - 90, yy2, dx + colW - 90, yy2 + 24);
    } catch {}
    const rr = dRowsDual[i];
    if (rr) {
      doc.setFontSize(8);
      doc.text(rr.label, dx + 6, yy2 + 15);
      const lydStr = Math.max(0, Number(rr.lyd||0)) > 0.0001 ? `${Math.max(0, Number(rr.lyd||0)).toLocaleString(undefined,{maximumFractionDigits:2})} LYD` : '';
      const usdStr = Math.max(0, Number(rr.usd||0)) > 0.0001 ? `${Math.max(0, Number(rr.usd||0)).toLocaleString(undefined,{maximumFractionDigits:2})} USD` : '';
      doc.setFont('helvetica','bold');
      if (showUsdCol) {
        if (showLydCol && lydStr) doc.text(lydStr, dx + colW - 160, yy2 + 15);
        if (usdStr) doc.text(usdStr, dx + colW - 80, yy2 + 15);
      } else {
        const one = lydStr || usdStr;
        if (one) doc.text(one, dx + colW - 80, yy2 + 15);
      }
      doc.setFont('helvetica','normal');
    }
  }
  let dedBottomY = dy + 28 + dedRendered * 24;
  // Deductions totals row (Y will be aligned with Earnings total if both exist)
  let dedTotalY: number | null = null;
  if (dedTotalLyd > 0.0001 || dedTotalUsd > 0.0001) {
    dedTotalY = dedBottomY + 4;
  }

  // Align Total Earnings and Total Deductions on the same line
  const hasEarnTotal = earningsTotalY != null;
  const hasDedTotal = dedTotalY != null;
  const unifiedTy = hasEarnTotal || hasDedTotal
    ? Math.max(earningsTotalY ?? (dedTotalY as number), dedTotalY ?? (earningsTotalY as number))
    : null;

  if (unifiedTy != null) {
    // Cross out any blank space between last data row and totals to prevent tampering
    try {
      if (hasEarnTotal) {
        const crossTop = ey;
        const crossBottom = (earningsTotalY as number) - 2;
        if (crossBottom > crossTop + 2) {
          doc.setDrawColor('#cccccc');
          doc.setLineWidth(0.5);
          doc.line(margin, crossTop, margin + colW, crossBottom);
        }
      }
      if (hasDedTotal) {
        const crossTopD = dedBottomY;
        const crossBottomD = (dedTotalY as number) - 2;
        if (crossBottomD > crossTopD + 2) {
          doc.setDrawColor('#cccccc');
          doc.setLineWidth(0.5);
          doc.line(dx, crossTopD, dx + colW, crossBottomD);
        }
      }
    } catch {}

    // Draw Total Earnings (left) if any
    if (hasEarnTotal) {
      const ty = unifiedTy;
      doc.setDrawColor('#555555');
      (doc as any).setFillColor(230, 230, 230);
      doc.rect(margin, ty, colW, 20, 'F');
      doc.rect(margin, ty, colW, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Total Earnings', margin + 6, ty + 13);
      const tLydStr = showLydCol && earningsLydTotal > 0.0001 ? earningsLydTotal.toLocaleString(undefined,{maximumFractionDigits:2}) : '';
      const tUsdStr = showUsdCol && earningsUsdTotal > 0.0001 ? earningsUsdTotal.toLocaleString(undefined,{maximumFractionDigits:2}) : '';
      if (showLydCol && tLydStr) doc.text(tLydStr, margin + colW - 160, ty + 13);
      if (showUsdCol && tUsdStr) doc.text(tUsdStr, margin + colW - 80, ty + 13);
      doc.setFont('helvetica', 'normal');
      ey = ty + 20;
    }

    // Draw Total Deductions (right) if any
    if (hasDedTotal) {
      const ty = unifiedTy;
      doc.setDrawColor('#555555');
      (doc as any).setFillColor(230, 230, 230);
      doc.rect(dx, ty, colW, 20, 'F');
      doc.rect(dx, ty, colW, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Total Deductions', dx + 6, ty + 13);
      const tLydStr = dedTotalLyd > 0.0001 ? dedTotalLyd.toLocaleString(undefined,{maximumFractionDigits:2}) : '';
      const tUsdStr = dedTotalUsd > 0.0001 ? dedTotalUsd.toLocaleString(undefined,{maximumFractionDigits:2}) : '';
      if (showLydCol && tLydStr) doc.text(tLydStr, dx + colW - 160, ty + 13);
      if (showUsdCol && tUsdStr) doc.text(tUsdStr, dx + colW - 80, ty + 13);
      if (!showUsdCol && !showLydCol) {
        const one = tUsdStr || tLydStr;
        if (one) doc.text(one, dx + colW - 80, ty + 13);
      }
      doc.setFont('helvetica', 'normal');
      dedBottomY = ty + 20;
    }
  }

  let dedBlockBottom = dedBottomY + 8;
  let netBandBottomY = dedBlockBottom;
  
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
  
  // Filter out zero-amount adjustments
  adjRowsPdf = (adjRowsPdf || []).filter((r) => Number(r.amount || 0) !== 0);
  // Include monthly loan repayment from v2 if present (disabled)
  const loanRepMonth = 0;
  if (loanRepMonth > 0.0001) {
    const ts = dayjs(periodStart).endOf('month').format('YYYY-MM-DD');
    adjRowsPdf.push({ type: 'loan repayment', amount: loanRepMonth, currency: 'LYD', ts } as any);
  }
  
  if (false && adjRowsPdf.length > 0) {
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

  // Add outer borders around Earnings and Deductions blocks
  try {
    const earnTop = tblY;
    const earnBottom = ey;
    if (earnBottom > earnTop) {
      doc.setDrawColor('#555555');
      doc.rect(margin, earnTop, colW, earnBottom - earnTop);
    }
    const dedTop = dy;
    const dedBottom = dedBottomY;
    if (dedBottom > dedTop) {
      doc.setDrawColor('#555555');
      doc.rect(dx, dedTop, colW, dedBottom - dedTop);
    }
  } catch {}

  // Net Pay band just below Earnings/Deductions, above calendar grid
  const netLydFinal = Math.max(0, Number(netLyd.toFixed(2)));
  const netUsdFinal = Math.max(0, Number(netUsd.toFixed(2)));
  const showUsdNet = netUsdFinal > 0.0001;
  {
    const bandTop = Math.max(ey, dedBlockBottom, twoColBottom) + 14;
    const bandW = pageW - margin * 2;
    const rowH = 26;
    let yBand = bandTop;
    doc.setFont('helvetica','bold');
    doc.setFontSize(11);
    (doc as any).setFillColor(205,205,205);

    if (showUsdNet) {
      const halfW = (bandW - 8) / 2;
      // LYD box (left)
      doc.rect(margin, yBand, halfW, rowH, 'F');
      doc.setDrawColor(0,0,0);
      doc.rect(margin, yBand, halfW, rowH);
      doc.text('Net Pay LYD', margin + 8, yBand + 14);
      doc.setFontSize(14);
      const lydTxt = netLydFinal.toLocaleString('en-US',{minimumFractionDigits:2, maximumFractionDigits:2});
      const lydW = doc.getTextWidth(lydTxt);
      doc.text(lydTxt, margin + halfW - lydW - 8, yBand + 14);

      // USD box (right)
      doc.setFontSize(11);
      (doc as any).setFillColor(205,205,205);
      const usdX = margin + halfW + 8;
      doc.rect(usdX, yBand, halfW, rowH, 'F');
      doc.setDrawColor(0,0,0);
      doc.rect(usdX, yBand, halfW, rowH);
      doc.text('Net Pay USD', usdX + 8, yBand + 14);
      doc.setFontSize(14);
      const usdTxt = netUsdFinal.toLocaleString('en-US',{minimumFractionDigits:2, maximumFractionDigits:2});
      const usdW = doc.getTextWidth(usdTxt);
      doc.text(usdTxt, usdX + halfW - usdW - 8, yBand + 14);
      yBand += rowH;
    } else {
      // Only LYD full-width
      doc.rect(margin, yBand, bandW, rowH, 'F');
      doc.setDrawColor(0,0,0);
      doc.rect(margin, yBand, bandW, rowH);
      doc.text('Net Pay LYD', margin + 8, yBand + 14);
      doc.setFontSize(14);
      const lydTxt = netLydFinal.toLocaleString('en-US',{minimumFractionDigits:2, maximumFractionDigits:2});
      const lydW = doc.getTextWidth(lydTxt);
      doc.text(lydTxt, margin + bandW - lydW - 8, yBand + 14);
      yBand += rowH;
    }
    netBandBottomY = yBand;
  }
  
  const gridTop = Math.max(ey + 8, dedBlockBottom, twoColBottom + 8, netBandBottomY + 8);
  const firstDate = dayjs(periodStart);
  
  // Uniform calendar heights
  const hWeek = 16;
  const hDayNum = 16;
  const hCell = 40;
  
  const drawRow = (start: number, end: number, topY: number) => {
    const count = Math.max(1, end - start + 1);
    const usableW = pageW - margin * 2;
    const cw = usableW / count; // exact equal width for all cells
    
    // Week header - uniform size (grayscale)
    for (let idx = 0; idx < count; idx++) {
      const d = start + idx;
      const x = margin + idx * cw;
      const wAdj = cw;
      const dayIdx = firstDate.date(d).day();
      const wd = (() => {
        switch (dayIdx) {
          case 1: return 'M';   // Monday
          case 2: return 'Tu';  // Tuesday
          case 3: return 'W';   // Wednesday
          case 4: return 'Th';  // Thursday
          case 5: return 'F';   // Friday
          case 6: return 'S';   // Saturday
          case 0: return 'Su';  // Sunday
          default: return '';
        }
      })();
      (doc as any).setFillColor(240,240,240);
      doc.rect(x, topY, wAdj, hWeek, 'F');
      doc.setDrawColor(180,180,180);
      doc.rect(x, topY, wAdj, hWeek);
      doc.setFontSize(8);
      const w = doc.getTextWidth(wd);
      doc.text(wd, x + ((wAdj) - w)/2, topY + hWeek - 3);
    }
    
    // Day numbers - uniform size (grayscale)
    for (let idx = 0; idx < count; idx++) {
      const d = start + idx;
      const x = margin + idx * cw;
      const wAdj = cw;
      doc.setDrawColor('#dcdcdc');
      doc.rect(x, topY + hWeek, wAdj, hDayNum);
      doc.setFontSize(8);
      doc.text(String(d), x + 4, topY + hWeek + hDayNum - 5);
    }
    
    // Cells (grayscale backgrounds)
    const cellY = topY + hWeek + hDayNum;
    for (let idx = 0; idx < count; idx++) {
      const d = start + idx;
      const x = margin + idx * cw;
      const wAdj = cw;
      const day = days[d-1] || null;
      const badge = codeBadge(day || undefined, schStartMinPDF, schEndMinPDF);
      const isFri = firstDate.date(d).day() === 5;
      const present = !!day?.present;
      let bg: [number,number,number] | null = null;

      if (isFri && !present) { bg = [215, 215, 215]; }
      else {
        switch (badge) {
          case 'P':  bg = [235, 250, 235]; break; // Present - green tint
          case 'A':  bg = [253, 236, 234]; break; // Absent - red tint
          case 'PHF': bg = [230,255,230]; break;
          case 'PH':  bg = [255,243,205]; break;
          case 'PT':  bg = [224,247,250]; break;
          case 'PL':  bg = [255,235,238]; break;
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
      doc.setDrawColor(140,140,140);
      doc.rect(x, cellY, wAdj, hCell);
      // Cross out Fridays with no presence
      if (isFri && !present) {
        doc.setDrawColor(120,120,120);
        doc.setLineWidth(0.6);
        doc.line(x + 2, cellY + 2, x + wAdj - 2, cellY + hCell - 2);
      }
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
        const show = (dm < 0 && Math.abs(dm) >= 1) || (dm > 0 && Math.abs(dm) >= 30);
        const sgn = dm > 0 ? '+' : (dm < 0 ? '-' : '');
        const abs = Math.abs(dm);
        const hh = Math.floor(abs / 60);
        const mm = Math.floor(abs % 60);
        const txt = show ? `${sgn}${String(hh)}:${String(mm).padStart(2,'0')}` : '';
        doc.setFontSize(5);
        if (show) {
          if (dm < 0) doc.setTextColor(220, 53, 69); else if (dm > 0) doc.setTextColor(34, 139, 34); else doc.setTextColor(0,0,0);
          const tw = doc.getTextWidth(txt);
          doc.text(txt, x + wAdj - tw - 2, cellY + 8);
          doc.setTextColor(0,0,0);
        }
      }
    }
    return topY + hWeek + hDayNum + hCell;
  };
  
  let bottomY = drawRow(1, dim, gridTop);

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

  // Attendance (full-width, grayscale)
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
  doc.setDrawColor('black');
  let ay = tblTop + 14;
  
  const headerBg = (code: string): [number,number,number] | null => {
    switch (code) {
      case 'PHF': return [235,235,235];
      case 'PH':  return [230,230,230];
      case 'PT':  return [240,240,240];
      case 'PL':  return [225,225,225];
      case 'A':   return [215,215,215];
      case 'P':   return [245,245,245];
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
  const codeLabel: Record<string,string> = {
    P: 'Present',
    A: 'Absent',
    PT: 'Short',
    PHF: 'PH Full',
    PH: 'PH',
    PL: 'Late',
  };
  codes.forEach((c, i) => {
    const x = margin + leftW + i*cellW;
    const isLast = i === codes.length - 1;
    const wAdj = isLast ? ((fullW - leftW) - (cellW * (codes.length - 1))) : cellW;
    const tw = doc.getTextWidth(c);
    // main code
    doc.text(c, x + (wAdj - tw)/2, ay + 13);
    // small descriptor beneath
    const desc = codeLabel[c];
    if (desc) {
      doc.setFontSize(7);
      const dw = doc.getTextWidth(desc);
      doc.text(desc, x + (wAdj - dw)/2, ay + 21);
      doc.setFontSize(10);
    }
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
    doc.setDrawColor('black');
    
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

  // Compact attendance summary row right above the signature
  let attCompactBottom = Math.max(ay, leavesBottomY);
  try {
    const pTxt = `P (Present)`;
    const aTxt = `A (Absent)`;
    const line = `${pTxt} | ${aTxt}`;
    doc.setFontSize(9);
    attCompactBottom += 16;
    doc.text(line, margin, attCompactBottom);
  } catch {}

  // Net Salary at absolute bottom (after compact attendance summary)
  // (Net Pay values are now shown in the band above the calendar; footer only contains notes/signature.)
  const footerTop = Math.max(netBandBottomY + 24, attCompactBottom + 24);

  // Footnotes for commissions just above the signature
  let sigBaseY = footerTop;
  try {
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    doc.setTextColor(0,0,0);
    const goldWeightUsed = (commissionRole === 'sales_lead' || commissionRole === 'sales_manager') ? goldGramsScope : goldGramsSelf;
    let footY = footerTop;
    if (diamondItems > 0) {
      const foot1 = `* Diamond items sold: ${Number(diamondItems||0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
      doc.text(foot1, margin, footY);
      footY += 12;
    }
    if (goldWeightUsed > 0) {
      const foot2 = `** Gold grams sold: ${Number(goldWeightUsed||0).toLocaleString('en-US', { maximumFractionDigits: 2 })} g`;
      doc.text(foot2, margin, footY);
      footY += 12;
    }
    sigBaseY = footY + 8;
  } catch {}

  // Employee Signature field at the absolute bottom (label only)
  const sigY = doc.internal.pageSize.getHeight() - margin - 22;
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
  const baseNameRaw = String(dispName || emp.id_emp).trim();
  // Remove illegal filename characters but keep Arabic letters
  const baseName = baseNameRaw.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');
  const periodTag = dayjs(periodStart).format('MMM_YYYY');
  const filename = `${baseName || String(emp.id_emp)}_Payslip_${periodTag}.pdf`;
  return { dataUrl, blobUrl, filename };
};

  const exportPdfClient = async (emp: Payslip) => {
    try {
      const { dataUrl, blobUrl, filename } = await buildPayslipPdf(emp);
      const a = document.createElement("a");
      a.href = blobUrl || dataUrl;
      a.download = filename;
      a.click();
    } catch (e) {
      alert((e as any)?.message || "Failed to build PDF");
    }
  };

  const buildPayslipPdfBase64 = async (emp: Payslip) => {
    const { dataUrl, blobUrl, filename } = await buildPayslipPdf(emp);
    // Strip the data URL prefix if present
    const base64 = dataUrl.includes(",")
      ? dataUrl.split(",")[1]
      : dataUrl;
    return { base64, blobUrl, filename };
  };

  const sendPayslipEmailClient = async (emp: Payslip) => {
    try {
      const { base64, filename } = await buildPayslipPdfBase64(emp);

      await sendPayslipClient({
        employeeId: emp.id_emp,
        year,
        month,
        pdfBase64: base64,
        filename,
        to:
          (emp as any).EMAIL ||
          (emp as any).email ||
          (emp as any).work_email ||
          (emp as any).personal_email ||
          "", // if this ends up empty, backend will fall back to employee EMAIL or hr@
      });

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
        <Tab label={t("Adjustments") || "Adjustments"} value="adjustments" />
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
        <Box minWidth={180}>
          <TextField
            select
            fullWidth
            size="small"
            label={t("Position") || "Position"}
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
          >
            <MenuItem value="all">
              {t("All Positions") || "All Positions"}
            </MenuItem>
            {positionOptions.map((pos) => (
              <MenuItem key={pos.id} value={String(pos.id)}>
                {pos.label}
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

        {/* Actions: export CSV, export PDF, save, close month, bulk send */}
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
                "Base",
                "Food",
                "Transportation",
                "Communication",
                "Base Pay",
                "Allowance Pay",
              ];
              if (cols.advances) headers.push("Advance");
              if (cols.loans) headers.push("Loans");
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
                const advVal = Number(adj.advance || 0) * -1;
                const loanVal = Number(adj.loanPayment || 0) * -1;
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
                  `${nameMap[e.id_emp] ?? e.name}`,
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
                if (cols.advances) row.push(advVal.toFixed(2));
                if (cols.loans) row.push(loanVal.toFixed(2));
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

              // Base header
              const header: string[] = [
                "Employee",
                "WD",
                "DD",
                "PD",
                "HW",
                "Base",
                "Allow",
              ];
              const colX: number[] = [36, 220, 260, 300, 340, 380, 450];

              // Extra columns – make sure X positions never overlap
              if (cols.advances) {
                header.push("Adv");
                colX.push(520);
              }
              if (cols.loans) {
                header.push("Loan");
                colX.push(560);
              }
              if (cols.salesQty) {
                header.push("Qty");
                colX.push(600);
              }
              if (cols.salesTotal) {
                header.push("Sales");
                colX.push(640);
              }

              header.push("Total");
              colX.push(680);

              if (cols.totalUsd) {
                header.push("USD");
                colX.push(740);
              }

              // Header row
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

                const W = Math.max(1, e.workingDays || 1);
                const F =
                  e.factorSum != null && e.factorSum > 0
                    ? e.factorSum
                    : (e.components?.basePay || 0) /
                      (Math.max(1, e.baseSalary || 0) / W);

                const baseUsd = e.baseSalaryUsd
                  ? (e.baseSalaryUsd / W) * F
                  : 0;

                const vr =
                  (v2Rows || []).find(
                    (x: any) => Number(x.id_emp) === Number(e.id_emp)
                  ) || {};
                const commUsd =
                  Number((vr as any).diamond_bonus_usd || 0) +
                  Number((vr as any).gold_bonus_usd || 0);

                const vals: any[] = [
                  e.name,
                  e.workingDays,
                  e.deductionDays,
                  e.presentWorkdays,
                  e.holidayWorked,
                  (e.components?.basePay || 0).toFixed(0),
                  (e.components?.allowancePay || 0).toFixed(0),
                ];

                if (cols.advances)
                  vals.push((Number(adj.advance || 0) * -1).toFixed(2));
                if (cols.loans)
                  vals.push((Number(adj.loanPayment || 0) * -1).toFixed(2));
                if (cols.salesQty) vals.push((s.qty || 0).toFixed(0));
                if (cols.salesTotal)
                  vals.push((s.total_lyd || 0).toFixed(2));

                vals.push(computeNetLYDFor(e.id_emp).toFixed(2));
                if (cols.totalUsd)
                  vals.push((baseUsd + commUsd).toFixed(0));

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
            variant="outlined"
            onClick={() => {
              const sel: Record<number, boolean> = {};
              (displayedRows || []).forEach(e => { sel[e.id_emp] = true; });
              setSendSelection(sel);
              setSendDialogOpen(true);
            }}
          >
            {t("Send Payslips") || "Send Payslips"}
          </Button>

          <Button
            variant="contained"
            disabled={viewOnly}
            onClick={async () => {
              if (viewOnly) return;
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
                const maxAdvance = salary * (advanceMaxPercent / 100);
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
                      helperText={`Available: ${availableAdvance.toFixed(2)} LYD (${advanceMaxPercent}% - existing advances)`}
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
                            alert(`Total advances cannot exceed ${advanceMaxPercent}% of salary (${maxAdvance.toFixed(2)} LYD)`);
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
                  const salary = Number(emp.baseSalary || 0);
                  const maxPrincipal = salary * loanMaxMultiple;
                  return (
                    <Box display="grid" gap={1.5} maxWidth={400}>
                      <Typography variant="caption">
                        Salary: {salary.toFixed(2)} LYD — Max Principal: {(maxPrincipal || 0).toFixed(2)} LYD ({loanMaxMultiple}×)
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
                            const emp = (result?.employees || []).find((x) => x.id_emp === adjEmpId);
                            const baseSalary = Number(emp?.baseSalary || 0);
                            const maxPrincipal = baseSalary * loanMaxMultiple;
                            if (baseSalary > 0 && principal > maxPrincipal) {
                              alert(`Loan exceeds maximum allowed (${loanMaxMultiple}× salary). Max: ${maxPrincipal.toFixed(2)} LYD`);
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
                              monthlyPercent: loanMonthlyPercent / 100,
                              capMultiple: loanMaxMultiple,
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
                                doc2.text(`Monthly Deduction: ${loanMonthlyPercent.toFixed(2)}%`, 36, 104);
                                const dataUrl2 = doc2.output('datauristring');
                                const subject = `Loan Issued — ${empName} (${adjEmpId})`;
                                const html = `<div><p>Loan issued for employee <b>${empName}</b> (ID: ${adjEmpId}).</p><p>Principal: ${principal.toFixed(2)} LYD<br/>Start: ${String(year)}-${String(month).padStart(2,'0')}<br/>Monthly Deduction: ${loanMonthlyPercent.toFixed(2)}%</p></div>`;
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

          {tab === "adjustments" && (
            <Box display="grid" gap={2}>
              <Typography variant="subtitle1">
                {t("Adjustments") || "Adjustments"}
              </Typography>

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

              {adjEmpId && (
                <Box display="grid" gap={2} sx={{ maxWidth: 900 }}>
                  <Box>
                    {(adjRows || []).length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        {t("No adjustments yet") || "No adjustments yet"}
                      </Typography>
                    )}
                    {(adjRows || []).map((r, idx) => {
                      const opt = adjTypeOptions.find((o) => o.value === r.type);
                      const label = opt?.label || r.type;
                      const amt = Number(r.amount || 0).toFixed(2);
                      const dateStr = r.ts ? dayjs(r.ts).format("YYYY-MM-DD HH:mm") : "";
                      return (
                        <Box
                          key={idx}
                          display="flex"
                          justifyContent="space-between"
                          alignItems="flex-start"
                          sx={{ py: 0.5, borderBottom: '1px dashed', borderColor: 'divider' }}
                        >
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {label}
                            </Typography>
                            {r.note && (
                              <Typography variant="body2" color="text.secondary">
                                {r.note}
                              </Typography>
                            )}
                            {dateStr && (
                              <Typography variant="caption" color="text.secondary">
                                {dateStr}
                              </Typography>
                            )}
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {r.currency} {amt}
                          </Typography>
                        </Box>
                      );
                    })}
                    {Object.keys(adjTypeTotals).length > 0 && (
                      <Box mt={1.5} p={1} sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
                        <Typography variant="subtitle2" gutterBottom>
                          {t('Totals this month') || 'Totals this month'}
                        </Typography>
                        {Object.entries(adjTypeTotals).map(([type, totals]) => {
                          const opt = adjTypeOptions.find((o) => o.value === type);
                          const label = opt?.label || type;
                          const parts: string[] = [];
                          if (totals.lyd) parts.push(`${totals.lyd.toFixed(2)} LYD`);
                          if (totals.usd) parts.push(`${totals.usd.toFixed(2)} USD`);
                          if (parts.length === 0) return null;
                          return (
                            <Box key={type} display="flex" justifyContent="space-between" sx={{ py: 0.25 }}>
                              <Typography variant="body2">{label}</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {parts.join('  |  ')}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                  </Box>

                  <Divider sx={{ my: 1.5 }} />

                  <Box display="grid" gridTemplateColumns="repeat(4, 1fr)" gap={1}>
                    <TextField
                      select
                      size="small"
                      label={t("Type") || "Type"}
                      value={adjForm.type}
                      onChange={(e) => {
                        const nextType = e.target.value;
                        setAdjForm((f) => ({
                          ...f,
                          type: nextType,
                          currency: adjLydOnlyTypes.has(nextType) ? 'LYD' : f.currency,
                        }));
                      }}
                    >
                      {adjTypeOptions.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {t(opt.label) || opt.label}
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
                      disabled={adjLydOnlyTypes.has(adjForm.type)}
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
                </Box>
              )}
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
                          <TextField select size="small" sx={{ minWidth: 180 }} label={t('Gold Commission') || 'Gold Comm'} value={val('GOLD_COMM') || ''} onChange={(e)=> setDirty({ GOLD_COMM: e.target.value || '' })}>
                            <MenuItem value="">{t('None') || 'None'}</MenuItem>
                            <MenuItem value="percent">Percent</MenuItem>
                            <MenuItem value="fixed">Fixed</MenuItem>
                          </TextField>
                          {((val('GOLD_COMM') === 'percent') || (val('GOLD_COMM') === 'fixed')) && (
                            <TextField size="small" type="number" sx={{ width: 180 }} label={(val('GOLD_COMM') === 'percent') ? (t('Gold %') || 'Gold %') : (t('Gold Fixed (LYD)') || 'Gold Fixed (LYD)')} value={(val('GOLD_COMM_VALUE') ?? '')} onChange={(e)=> setDirty({ GOLD_COMM_VALUE: e.target.value === '' ? null : Number(e.target.value) })} inputProps={{ step: (val('GOLD_COMM') === 'percent') ? 0.1 : 1 }} />
                          )}
                          <TextField select size="small" sx={{ minWidth: 200 }} label={t('Diamond Comm') || 'Diamond Comm'} value={val('DIAMOND_COMM_TYPE') || ''} onChange={(e)=> setDirty({ DIAMOND_COMM_TYPE: e.target.value || '' })}>
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
            <Box display="flex" flexWrap="wrap" gap={2}>
              <TextField
                type="number"
                size="small"
                sx={{ width: 160 }}
                label={t('Max Multiple of Salary') || 'Max Multiple of Salary'}
                value={loanMaxMultiple}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  const next = Number.isFinite(v) && v > 0 ? v : 0;
                  setLoanMaxMultiple(next);
                  try { localStorage.setItem('payroll_settings_loan_max_multiple', String(next || '')); } catch {}
                }}
                inputProps={{ step: 0.1, min: 0 }}
              />
              <TextField
                type="number"
                size="small"
                sx={{ width: 160 }}
                label={t('Monthly Deduction %') || 'Monthly Deduction %'}
                value={loanMonthlyPercent}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  const next = Number.isFinite(v) && v >= 0 ? v : 0;
                  setLoanMonthlyPercent(next);
                  try { localStorage.setItem('payroll_settings_loan_monthly_percent', String(next || '')); } catch {}
                }}
                inputProps={{ step: 0.1, min: 0, max: 100 }}
              />
            </Box>
            <Divider />
            <Typography variant="subtitle2">{t('Salary Advance Limits') || 'Salary Advance Limits'}</Typography>
            <Box display="flex" flexWrap="wrap" gap={2}>
              <TextField
                type="number"
                size="small"
                sx={{ width: 200 }}
                label={t('Max % of Monthly Salary') || 'Max % of Monthly Salary'}
                value={advanceMaxPercent}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  const next = Number.isFinite(v) && v >= 0 ? v : 0;
                  setAdvanceMaxPercent(next);
                  try { localStorage.setItem('payroll_settings_advance_max_percent', String(next || '')); } catch {}
                }}
                inputProps={{ step: 0.5, min: 0, max: 100 }}
              />
            </Box>
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
            <TableContainer sx={{ overflow: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
              <Table
                stickyHeader
                size="small"
                sx={{
                  tableLayout: "fixed",
                  width: "100%",
                  minWidth: tableMinWidth,
                  "& .MuiTableCell-root": { py: 0.5, px: 1 },
                  "& td, & th": { borderBottom: '1px solid', borderColor: 'divider' },
                }}
              >
               <TableHead
                sx={{
                  backgroundColor: "grey.50",
                  "& .MuiTableCell-head": {
                    fontSize: 11,
                    fontWeight: 600,
                    color: "text.secondary",
                    whiteSpace: "nowrap",
                    lineHeight: 1.3,
                    px: 1,
                  },
                  "& .MuiTableSortLabel-root": {
                    fontSize: 11,
                    "& .MuiTableSortLabel-icon": {
                      opacity: 0.6,
                    },
                    "& .MuiTableSortLabel-label": {
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    },
                  },
                  "& .MuiTableCell-head .MuiIconButton-root": { display: "none" },
                }}
              >
                  <TableRow>
                    {/* Employee column header narrowed */}
                    <TableCell
                      sortDirection={
                        sortKey === "name" ? sortDir : (false as any)
                      }
                      sx={{ width: 180, maxWidth: 180, position: 'sticky', left: 0, zIndex: 6, bgcolor: 'background.paper' }}
                    >
                      <TableSortLabel
                        active={sortKey === "name"}
                        direction={sortKey === "name" ? sortDir : "asc"}
                        onClick={(e: any) => handleSort("name")}
                      >
                        {t("hr.timesheets.employee") || "Employee"}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell
                      align="right"
                      sortDirection={
                        sortKey === "deductionDays" ? sortDir : (false as any)
                      }
                      sx={{ width: 110 }}
                    >
                      <Box display="flex" flexDirection="column" alignItems="flex-end">
                        <TableSortLabel
                          active={sortKey === "deductionDays"}
                          direction={
                            sortKey === "deductionDays" ? sortDir : "asc"
                          }
                          onClick={(e: any) => handleSort("deductionDays")}
                        >
                          {t("Absence") || "Absence"}
                        </TableSortLabel>
                        <span style={{ fontSize: 9 }}>(LYD) | (USD)</span>
                      </Box>
                    </TableCell>
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
                              p: true,
                              ph: true,
                              phf: true,
                              baseSalary: true,
                              food: true,
                              fuel: true,
                              comm: true,
                              advances: true,
                              loans: true,
                              salesQty: true,
                              salesTotal: true,
                              gold: true,
                              diamond: true,
                              watchComm: true,
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
                    {cols.p && (
                      <TableCell align="right" sx={{ width: 110 }}>
                        <Box display="flex" flexDirection="column" alignItems="flex-end">
                          <span>{t("P") || "P"}</span>
                          <span style={{ fontSize: 9 }}>(LYD) | (USD)</span>
                        </Box>
                      </TableCell>
                    )}
                    {cols.ph && (
                      <TableCell align="right" sx={{ width: 110 }}>
                        <Box display="flex" flexDirection="column" alignItems="flex-end">
                          <span>{t("PH") || "PH"}</span>
                          <span style={{ fontSize: 9 }}>(LYD) | (USD)</span>
                        </Box>
                      </TableCell>
                    )}
                    {cols.phf && (
                      <TableCell align="right" sx={{ width: 110 }}>
                        <Box display="flex" flexDirection="column" alignItems="flex-end">
                          <span>{t("PHF") || "PHF"}</span>
                          <span style={{ fontSize: 9 }}>(LYD) | (USD)</span>
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
                          {t("Base") || "Base"}
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
                          {t("Food Allow.") || "Food Allow."}
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
                          {t("Transport.") || "Transport."}
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
                          {t("Comm.") ||
                            "Comm."}
                        </TableSortLabel>
                        <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }} aria-label="hide column"
                          onClick={(e) => { e.stopPropagation(); setCols(c => ({ ...c, comm: !c.comm })); }}>
                          <VisibilityOffIcon fontSize="inherit" />
                        </IconButton>
                        </Box>
                      </TableCell>
                    )}
                    {cols.advances && (
                      <TableCell align="right" sx={{ width: 78 }}>
                        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                          <span>{t("S. Adv") || "S. Adv"}</span>
                          <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }} aria-label="hide column"
                            onClick={(e) => { e.stopPropagation(); setCols(c => ({ ...c, advances: !c.advances })); }}>
                            <VisibilityOffIcon fontSize="inherit" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    )}
                    {cols.loans && (
                      <TableCell align="right" sx={{ width: 78 }}>
                        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                          <span>{t("Loans") || "Loans"}</span>
                          <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }} aria-label="hide column"
                            onClick={(e) => { e.stopPropagation(); setCols(c => ({ ...c, loans: !c.loans })); }}>
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
                          {t("Gold Comm") || "Gold Comm"}
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
                          {t("Diamond Comm") || "Diamond Comm"}
                        </TableSortLabel>
                        <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }} aria-label="hide column"
                          onClick={(e) => { e.stopPropagation(); setCols(c => ({ ...c, diamond: !c.diamond })); }}>
                          <VisibilityOffIcon fontSize="inherit" />
                        </IconButton>
                        </Box>
                      </TableCell>
                    )}
                    {cols.watchComm && (
                      <TableCell align="right" sx={{ width: 84 }}>
                        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                          <span>{t("Watch Comm") || "Watch Comm"}</span>
                          <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }} aria-label="hide column"
                            onClick={(e) => { e.stopPropagation(); setCols(c => ({ ...c, watchComm: !c.watchComm })); }}>
                            <VisibilityOffIcon fontSize="inherit" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    )}
                    <TableCell
                      align="right"
                      sx={{ width: 120 }}
                    >
                      <Box display="flex" flexDirection="column" alignItems="flex-end">
                        <span>{t("Gross") || "Gross"}</span>
                        <span style={{ fontSize: 9 }}>(LYD) | (USD)</span>
                      </Box>
                    </TableCell>
                    <TableCell
                      align="right"
                      sortDirection={
                        sortKey === "total" ? sortDir : (false as any)
                      }
                      sx={{ width: 120 }}
                    >
                      <TableSortLabel
                        active={sortKey === "total"}
                        direction={sortKey === "total" ? sortDir : "asc"}
                        onClick={(e: any) => handleSort("total")}
                      >
                        <Box display="flex" flexDirection="column" alignItems="flex-end">
                          <span>{t("Total") || "Total"}</span>
                          <span style={{ fontSize: 9 }}>(LYD) | (USD)</span>
                        </Box>
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right" sx={{ width: 220, position: 'sticky', right: 0, zIndex: 6, bgcolor: 'background.paper' }}>
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
                      <TableCell sx={{ width: 180, maxWidth: 180, position: 'sticky', left: 0, zIndex: 2, bgcolor: 'background.paper' }}>
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
                              onClick={() => openCalendar(e.id_emp, nameMap[e.id_emp] ?? e.name)}
                            >
                              {nameMap[e.id_emp] ?? e.name}
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
                      <TableCell align="right" sx={{ width: 110 }}>
                        {(() => {
                          const vr = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(e.id_emp)) || {};
                          const lyd = Number((vr as any).absence_lyd || 0) || 0;
                          const usd = Number((vr as any).absence_usd || 0) || 0;
                          if (!lyd && !usd) return "";
                          return (
                            <Box component="span">
                              <Box component="span" sx={{ color: '#65a8bf' }}>
                                {formatMoney(lyd)}
                              </Box>
                              {usd ? (
                                <>
                                  {" | "}
                                  <Box component="span" sx={{ color: '#b7a27d' }}>
                                    {formatMoney(usd)}
                                  </Box>
                                </>
                              ) : null}
                            </Box>
                          );
                        })()}
                      </TableCell>
                      {cols.holidayWorked && (
                        <TableCell align="right" sx={{ width: 64 }}>
                          {e.holidayWorked || ""}
                        </TableCell>
                      )}
                      {cols.p && (
                        <TableCell align="right" sx={{ width: 110 }}>
                          {(() => {
                            const vals = computePPhPhf(e);
                            if (!vals.pLyd && !vals.pUsd) return "";
                            return (
                              <Box component="span">
                                <Box component="span" sx={{ color: '#65a8bf' }}>{formatMoney(vals.pLyd)}</Box>
                                {vals.pUsd ? (
                                  <>
                                    {" | "}
                                    <Box component="span" sx={{ color: '#b7a27d' }}>{formatMoney(vals.pUsd)}</Box>
                                  </>
                                ) : null}
                              </Box>
                            );
                          })()}
                        </TableCell>
                      )}
                      {cols.ph && (
                        <TableCell align="right" sx={{ width: 110 }}>
                          {(() => {
                            const vals = computePPhPhf(e);
                            if (!vals.phLyd && !vals.phUsd) return "";
                            return (
                              <Box component="span">
                                <Box component="span" sx={{ color: '#65a8bf' }}>{formatMoney(vals.phLyd)}</Box>
                                {vals.phUsd ? (
                                  <>
                                    {" | "}
                                    <Box component="span" sx={{ color: '#b7a27d' }}>{formatMoney(vals.phUsd)}</Box>
                                  </>
                                ) : null}
                              </Box>
                            );
                          })()}
                        </TableCell>
                      )}
                      {cols.phf && (
                        <TableCell align="right" sx={{ width: 110 }}>
                          {(() => {
                            const vals = computePPhPhf(e);
                            if (!vals.phfLyd && !vals.phfUsd) return "";
                            return (
                              <Box component="span">
                                <Box component="span" sx={{ color: '#65a8bf' }}>{formatMoney(vals.phfLyd)}</Box>
                                {vals.phfUsd ? (
                                  <>
                                    {" | "}
                                    <Box component="span" sx={{ color: '#b7a27d' }}>{formatMoney(vals.phfUsd)}</Box>
                                  </>
                                ) : null}
                              </Box>
                            );
                          })()}
                        </TableCell>
                      )}
                      {cols.baseSalary && (
                        <TableCell align="right" sx={{ width: 80 }}>
                          {(() => {
                            const lyd = Number(e.baseSalary || 0) || 0;
                            const usd = Number((e as any).baseSalaryUsd || 0) || 0;
                            if (!lyd && !usd) return "";
                            return (
                              <Box component="span">
                                <Box component="span" sx={{ color: '#65a8bf' }}>
                                  {formatMoney(lyd)}
                                </Box>
                                {usd ? (
                                  <>
                                    {" | "}
                                    <Box component="span" sx={{ color: '#b7a27d' }}>
                                      {formatMoney(usd)}
                                    </Box>
                                  </>
                                ) : null}
                              </Box>
                            );
                          })()}
                        </TableCell>
                      )}
                      {cols.food && (
                        <TableCell align="right" sx={{ width: 72 }}>
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
                            return Number.isFinite(v) ? formatMoney(v) : "0.00";
                          })()}
                        </TableCell>
                      )}
                      {cols.fuel && (
                        <TableCell align="right" sx={{ width: 72 }}>
                          {(() => {
                            const vr = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(e.id_emp)) || {};
                            const v = Number(((e as any).FUEL ?? (vr as any).FUEL) || 0);
                            return v ? formatMoney(v) : "";
                          })()}
                        </TableCell>
                      )}
                      {cols.comm && (
                        <TableCell align="right" sx={{ width: 72 }}>
                          {(() => {
                            const vr = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(e.id_emp)) || {};
                            const v = Number(((e as any).COMMUNICATION ?? (vr as any).COMMUNICATION) || 0);
                            return v ? formatMoney(v) : "";
                          })()}
                        </TableCell>
                      )}
                      {/* Base Pay / Allowance Pay columns removed per new layout */}
                      {cols.advances && (
                        <TableCell align="right" sx={{ width: 78 }}>
                          {(() => {
                            const a = e.components?.adjustments || ({} as any);
                            const advFromState = Number(advMap[e.id_emp] || 0);
                            const advLocal = Number(a.advance || 0);
                            const adv = advFromState || advLocal;
                            const v = adv ? -Math.abs(adv) : 0;
                            return v ? (
                              <Box component="span" sx={{ color: 'error.main' }}>{formatMoney(v)}</Box>
                            ) : "";
                          })()}
                        </TableCell>
                      )}
                      {cols.loans && (
                        <TableCell align="right" sx={{ width: 78 }}>
                          {(() => {
                            const vr =
                              (v2Rows || []).find(
                                (x: any) => Number(x.id_emp) === Number(e.id_emp)
                              ) || ({} as any);

                            const remaining = Number(
                              (vr as any).remaining || (vr as any).principal || 0
                            );
                            const thisMonth = Number((vr as any).loan_credit_lyd || 0);
                            const thisMonthNeg = thisMonth ? -Math.abs(thisMonth) : 0;

                            if (!remaining && !thisMonthNeg) return "";

                            return (
                              <Box
                                display="flex"
                                flexDirection="column"
                                alignItems="flex-end"
                              >
                                {/* This month deduction on top */}
                                {thisMonthNeg ? (
                                  <Box component="span" sx={{ color: 'error.main' }}>
                                    {formatMoney(thisMonthNeg)}
                                  </Box>
                                ) : null}
                                {/* Remaining balance under it */}
                                {remaining ? (
                                  <Box component="span">
                                    {formatMoney(remaining)}
                                  </Box>
                                ) : null}
                              </Box>
                            );
                          })()}
                        </TableCell>
                      )}
                      {cols.salesQty && (
                        <TableCell align="right" sx={{ width: 64 }}>
                          {(() => {
                            const v = sales[String(e.id_emp)]?.qty ?? 0;
                            return v ? formatInt(v) : "";
                          })()}
                        </TableCell>
                      )}
                      {cols.salesTotal && (
                        <TableCell align="right" sx={{ width: 84 }}>
                          {(() => {
                            const v = sales[String(e.id_emp)]?.total_lyd ?? 0;
                            return v ? formatMoney(v) : "";
                          })()}
                        </TableCell>
                      )}
                      {cols.gold && (
                        <TableCell align="right" sx={{ width: 96 }}>
                          {(() => {
                            const vr =
                              (v2Rows || []).find(
                                (x: any) =>
                                  Number(x.id_emp) === Number(e.id_emp)
                              ) || {};
                            const v = Number((vr as any).gold_bonus_lyd || 0);
                            return v ? formatMoney(v) : "";
                          })()}
                        </TableCell>
                      )}
                      {cols.diamond && (
                        <TableCell align="right" sx={{ width: 96 }}>
                          {(() => {
                            const vr =
                              (v2Rows || []).find(
                                (x: any) =>
                                  Number(x.id_emp) === Number(e.id_emp)
                              ) || {};
                            const v = Number(
                              (vr as any).diamond_bonus_lyd || 0
                            );
                            return v ? formatMoney(v) : "";
                          })()}
                        </TableCell>
                      )}
                      {cols.watchComm && (
                        <TableCell align="right" sx={{ width: 84 }}>
                          {/* Watch commission placeholder */}
                        </TableCell>
                      )}
                      <TableCell align="right" sx={{ width: 120 }}>
                        {(() => {
                          const vr =
                            (v2Rows || []).find(
                              (x: any) =>
                                Number(x.id_emp) === Number(e.id_emp)
                            ) || ({} as any);
                          const grossLyd = Number(
                            (vr as any).total_salary_lyd ?? (vr as any).totalLyd ?? 0
                          );
                          const grossUsd = Number(
                            (vr as any).total_salary_usd ?? (vr as any).totalUsd ?? 0
                          );
                          if (!grossLyd && !grossUsd) return "";
                          return (
                            <Box component="span">
                              <Box component="span" sx={{ color: '#65a8bf' }}>
                                {formatMoney(grossLyd)}
                              </Box>
                              {grossUsd ? (
                                <>
                                  {" | "}
                                  <Box component="span" sx={{ color: '#b7a27d' }}>
                                    {formatMoney(grossUsd)}
                                  </Box>
                                </>
                              ) : null}
                            </Box>
                          );
                        })()}
                      </TableCell>
                      <TableCell align="right" sx={{ width: 120 }}>
                        {(() => {
                          const vr =
                            (v2Rows || []).find(
                              (x: any) =>
                                Number(x.id_emp) === Number(e.id_emp)
                            ) || ({} as any);
                          const lyd = Number(
                            (vr as any).net_salary_lyd ?? (vr as any).D16 ?? 0
                          );
                          const usd = Number(
                            (vr as any).net_salary_usd ?? (vr as any).C16 ?? 0
                          );
                          if (!lyd && !usd) return "";
                          return (
                            <Box component="span">
                              <Box component="span" sx={{ color: '#65a8bf' }}>
                                {formatMoney(lyd)}
                              </Box>
                              {usd ? (
                                <>
                                  {" | "}
                                  <Box component="span" sx={{ color: '#b7a27d' }}>
                                    {formatMoney(usd)}
                                  </Box>
                                </>
                              ) : null}
                            </Box>
                          );
                        })()}
                      </TableCell>
                      <TableCell align="right" sx={{ width: 220, position: 'sticky', right: 0, zIndex: 2, bgcolor: 'background.paper' }}>
                        <Box display="flex" flexDirection="column" gap={0.5} alignItems="stretch">
                          {savingRows[e.id_emp] && <CircularProgress size={14} />}
                          {/* <Button
                            size="small"
                            variant="text"
                            startIcon={<EditIcon fontSize="small" />}
                            disabled={viewOnly}
                            onClick={() => openRowEditor(e.id_emp)}
                          >
                            {t('Edit') || 'Edit'}
                          </Button> */}
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => exportPdfClient(e)}
                          >
                            Payslip
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
                      <strong style={{ fontSize: 16 }}>{t("Totals") || "Totals"}</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{formatMoney(totals.deductionDays)}</strong>
                    </TableCell>
                    {cols.holidayWorked && (
                      <TableCell align="right">
                        <strong>{formatInt(totals.holidayWorked)}</strong>
                      </TableCell>
                    )}
                    {cols.p && (
                      <TableCell align="right">
                        <strong>
                          <Box component="span">
                            <Box component="span" sx={{ color: '#65a8bf' }}>
                              {formatMoney(totals.pLyd)}
                            </Box>
                            {totals.pUsd ? (
                              <>
                                {" | "}
                                <Box component="span" sx={{ color: '#b7a27d' }}>
                                  {formatMoney(totals.pUsd)}
                                </Box>
                              </>
                            ) : null}
                          </Box>
                        </strong>
                      </TableCell>
                    )}
                    {cols.ph && (
                      <TableCell align="right">
                        <strong>
                          <Box component="span">
                            <Box component="span" sx={{ color: '#65a8bf' }}>
                              {formatMoney(totals.phLyd)}
                            </Box>
                            {totals.phUsd ? (
                              <>
                                {" | "}
                                <Box component="span" sx={{ color: '#b7a27d' }}>
                                  {formatMoney(totals.phUsd)}
                                </Box>
                              </>
                            ) : null}
                          </Box>
                        </strong>
                      </TableCell>
                    )}
                    {cols.phf && (
                      <TableCell align="right">
                        <strong>
                          <Box component="span">
                            <Box component="span" sx={{ color: '#65a8bf' }}>
                              {formatMoney(totals.phfLyd)}
                            </Box>
                            {totals.phfUsd ? (
                              <>
                                {" | "}
                                <Box component="span" sx={{ color: '#b7a27d' }}>
                                  {formatMoney(totals.phfUsd)}
                                </Box>
                              </>
                            ) : null}
                          </Box>
                        </strong>
                      </TableCell>
                    )}
                    {cols.baseSalary && (
                      <TableCell align="right">
                        <strong>
                          <Box component="span">
                            <Box component="span" sx={{ color: '#65a8bf' }}>
                              {formatMoney(totals.baseSalary)}
                            </Box>
                            {totals.baseSalaryUsd ? (
                              <>
                                {" | "}
                                <Box component="span" sx={{ color: '#b7a27d' }}>
                                  {formatMoney(totals.baseSalaryUsd)}
                                </Box>
                              </>
                            ) : null}
                          </Box>
                        </strong>
                      </TableCell>
                    )}
                    {cols.food && (
                      <TableCell align="right">
                        <strong>{formatMoney(totals.food)}</strong>
                      </TableCell>
                    )}
                    {cols.fuel && (
                      <TableCell align="right">
                        <strong>{formatMoney(totals.fuel)}</strong>
                      </TableCell>
                    )}
                    {cols.comm && (
                      <TableCell align="right">
                        <strong>{formatMoney(totals.comm)}</strong>
                      </TableCell>
                    )}
                    {/* Base Pay / Allowance Pay totals removed per new layout */}
                    {cols.advances && (
                      <TableCell align="right">
                        {(() => {
                          const sum = displayedRows.reduce((acc, e) => {
                            const a = e.components?.adjustments || ({} as any);
                            const advFromState = Number(advMap[e.id_emp] || 0);
                            const advLocal = Number(a.advance || 0);
                            const adv = advFromState || advLocal;
                            const v = adv ? -Math.abs(adv) : 0;
                            return acc + v;
                          }, 0);
                          return (
                            <Box
                              component="strong"
                              sx={{ color: sum < 0 ? 'error.main' : undefined }}
                            >
                              {formatMoney(sum)}
                            </Box>
                          );
                        })()}
                      </TableCell>
                    )}
                    {cols.loans && (
                      <TableCell align="right">
                        {(() => {
                          let totalRemaining = 0;
                          let totalThisMonth = 0;

                          (displayedRows || []).forEach((e) => {
                            const vr =
                              (v2Rows || []).find(
                                (x: any) => Number(x.id_emp) === Number(e.id_emp)
                              ) || ({} as any);
                            totalRemaining += Number(
                              (vr as any).remaining || (vr as any).principal || 0
                            );
                            totalThisMonth += Number((vr as any).loan_credit_lyd || 0);
                          });

                          const totalThisMonthNeg = totalThisMonth
                            ? -Math.abs(totalThisMonth)
                            : 0;

                          return (
                            <Box
                              display="flex"
                              flexDirection="column"
                              alignItems="flex-end"
                              component="strong"
                            >
                              {/* This month deduction at top */}
                              <Box
                                component="span"
                                sx={{
                                  color: totalThisMonthNeg < 0 ? 'error.main' : undefined,
                                }}
                              >
                                {formatMoney(totalThisMonthNeg)}
                              </Box>
                              {/* Remaining total under it */}
                              <Box component="span">
                                {formatMoney(totalRemaining)}
                              </Box>
                            </Box>
                          );
                        })()}
                      </TableCell>
                    )}
                    {cols.salesQty && (
                      <TableCell align="right">
                        <strong>{formatInt(totals.salesQty)}</strong>
                      </TableCell>
                    )}
                    {cols.salesTotal && (
                      <TableCell align="right">
                        <strong>{formatMoney(totals.salesTotal)}</strong>
                      </TableCell>
                    )}
                    {cols.gold && (
                      <TableCell align="right">
                        <strong>{formatMoney(totals.gold)}</strong>
                      </TableCell>
                    )}
                    {cols.diamond && (
                      <TableCell align="right">
                        <strong>{formatMoney(totals.diamond)}</strong>
                      </TableCell>
                    )}
                    {cols.watchComm && (
                      <TableCell align="right">
                        {/* Watch commission total placeholder */}
                      </TableCell>
                    )}
                    <TableCell align="right">
                      <strong>
                        <Box component="span">
                          <Box component="span" sx={{ color: '#65a8bf' }}>
                            {formatMoney(totals.grossLyd)}
                          </Box>
                          {totals.grossUsd ? (
                            <>
                              {" | "}
                              <Box component="span" sx={{ color: '#b7a27d' }}>
                                {formatMoney(totals.grossUsd)}
                              </Box>
                            </>
                          ) : null}
                        </Box>
                      </strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>
                        <Box component="span">
                          <Box component="span" sx={{ color: '#65a8bf' }}>
                            {formatMoney(totals.totalLyd)}
                          </Box>
                          {totals.totalUsd ? (
                            <>
                              {" | "}
                              <Box component="span" sx={{ color: '#b7a27d' }}>
                                {formatMoney(totals.totalUsd)}
                              </Box>
                            </>
                          ) : null}
                        </Box>
                      </strong>
                    </TableCell>
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
              ['holidayWorked', 'Holiday Worked'],
              ['p', 'P (LYD|USD)'],
              ['ph', 'PH (LYD|USD)'],
              ['phf', 'PHF (LYD|USD)'],
              ['baseSalary', 'Base'],
              ['food', 'Food'],
              ['fuel', 'Fuel'],
              ['comm', 'Communication'],
              ['advances', 'S. Adv'],
              ['loans', 'Loans'],
              ['salesQty', 'Sales Qty'],
              ['salesTotal', 'Sales Total'],
              ['gold', 'Gold Bonus'],
              ['diamond', 'Diamond Bonus'],
              ['watchComm', 'Watch Comm'],
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

      {/* Bulk Send Payslips dialog */}
      <Dialog
        open={sendDialogOpen}
        onClose={() => setSendDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t('Send Payslips') || 'Send Payslips'}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {t('Select employees to send payslips to for this period.') || 'Select employees to send payslips to for this period.'}
          </Typography>
          <Box sx={{ maxHeight: 360, overflow: 'auto' }}>
            {(displayedRows || []).map(emp => (
              <FormControlLabel
                key={emp.id_emp}
                control={
                  <Checkbox
                    size="small"
                    checked={!!sendSelection[emp.id_emp]}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSendSelection(prev => ({ ...prev, [emp.id_emp]: checked }));
                    }}
                  />
                }
                label={`${nameMap[emp.id_emp] ?? emp.name} (ID: ${emp.id_emp})`}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendDialogOpen(false)}>
            {t('Cancel') || 'Cancel'}
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              const list = (displayedRows || []).filter(e => sendSelection[e.id_emp]);
              if (!list.length) {
                alert(t('No employees selected') || 'No employees selected');
                return;
              }
              try {
                for (const emp of list) {
                  await sendPayslipEmailClient(emp);
                }
                alert(t('Payslips sent') || 'Payslips sent');
              } catch (e: any) {
                alert(e?.message || 'Failed to send some payslips');
              } finally {
                setSendDialogOpen(false);
              }
            }}
          >
            {t('Send') || 'Send'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Row adjustments editor (autosave) */}
      <Dialog open={rowEditOpen} onClose={() => setRowEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {t('Adjustments') || 'Adjustments'} — {String(rowEdit?.name || rowEdit?.id_emp || '')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {t('Autosaves on change') || 'Autosaves on change'}
          </Typography>
          <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={1.25}>
            <TextField size="small" type="number" label="Gold Bonus (LYD)" disabled={viewOnly}
              value={rowForm.gold_bonus_lyd ?? 0}
              onChange={(e)=>{ const v=toN(e.target.value); setRowForm((f:any)=>({...f, gold_bonus_lyd:v})); if(rowEdit){ applyRowForm(rowEdit.id_emp, { gold_bonus_lyd:v }); queueAutoSave(rowEdit.id_emp);} }} />
            <TextField size="small" type="number" label="Diamond Bonus (LYD)" disabled={viewOnly}
              value={rowForm.diamond_bonus_lyd ?? 0}
              onChange={(e)=>{ const v=toN(e.target.value); setRowForm((f:any)=>({...f, diamond_bonus_lyd:v})); if(rowEdit){ applyRowForm(rowEdit.id_emp, { diamond_bonus_lyd:v }); queueAutoSave(rowEdit.id_emp);} }} />

            <TextField size="small" type="number" label="Other Bonus 1 (LYD)" disabled={viewOnly}
              value={rowForm.other_bonus1_lyd ?? 0}
              onChange={(e)=>{ const v=toN(e.target.value); setRowForm((f:any)=>({...f, other_bonus1_lyd:v})); if(rowEdit){ applyRowForm(rowEdit.id_emp, { other_bonus1_lyd:v }); queueAutoSave(rowEdit.id_emp);} }} />
            <TextField size="small" label="Other Bonus 1 Account" disabled={viewOnly}
              value={rowForm.other_bonus1_acc ?? ''}
              onChange={(e)=>{ const v=e.target.value; setRowForm((f:any)=>({...f, other_bonus1_acc:v})); if(rowEdit){ applyRowForm(rowEdit.id_emp, { other_bonus1_acc:v }); queueAutoSave(rowEdit.id_emp);} }} />

            <TextField size="small" type="number" label="Other Bonus 2 (LYD)" disabled={viewOnly}
              value={rowForm.other_bonus2_lyd ?? 0}
              onChange={(e)=>{ const v=toN(e.target.value); setRowForm((f:any)=>({...f, other_bonus2_lyd:v})); if(rowEdit){ applyRowForm(rowEdit.id_emp, { other_bonus2_lyd:v }); queueAutoSave(rowEdit.id_emp);} }} />
            <TextField size="small" label="Other Bonus 2 Account" disabled={viewOnly}
              value={rowForm.other_bonus2_acc ?? ''}
              onChange={(e)=>{ const v=e.target.value; setRowForm((f:any)=>({...f, other_bonus2_acc:v})); if(rowEdit){ applyRowForm(rowEdit.id_emp, { other_bonus2_acc:v }); queueAutoSave(rowEdit.id_emp);} }} />

            <TextField size="small" type="number" label="Other Additions (LYD)" disabled={viewOnly}
              value={rowForm.other_additions_lyd ?? 0}
              onChange={(e)=>{ const v=toN(e.target.value); setRowForm((f:any)=>({...f, other_additions_lyd:v})); if(rowEdit){ applyRowForm(rowEdit.id_emp, { other_additions_lyd:v }); queueAutoSave(rowEdit.id_emp);} }} />
            <TextField size="small" type="number" label="Other Deductions (LYD)" disabled={viewOnly}
              value={rowForm.other_deductions_lyd ?? 0}
              onChange={(e)=>{ const v=toN(e.target.value); setRowForm((f:any)=>({...f, other_deductions_lyd:v})); if(rowEdit){ applyRowForm(rowEdit.id_emp, { other_deductions_lyd:v }); queueAutoSave(rowEdit.id_emp);} }} />

            <TextField size="small" type="number" label="Loan Debit (LYD)" disabled={viewOnly}
              value={rowForm.loan_debit_lyd ?? 0}
              onChange={(e)=>{ const v=toN(e.target.value); setRowForm((f:any)=>({...f, loan_debit_lyd:v})); if(rowEdit){ applyRowForm(rowEdit.id_emp, { loan_debit_lyd:v }); queueAutoSave(rowEdit.id_emp);} }} />
            <TextField size="small" type="number" label="Loan Credit (LYD)" disabled={viewOnly}
              value={rowForm.loan_credit_lyd ?? 0}
              onChange={(e)=>{ const v=toN(e.target.value); setRowForm((f:any)=>({...f, loan_credit_lyd:v})); if(rowEdit){ applyRowForm(rowEdit.id_emp, { loan_credit_lyd:v }); queueAutoSave(rowEdit.id_emp);} }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRowEditOpen(false)}>
            {t('common.close') || 'Close'}
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
                {(adjRows || []).map((r, idx) => {
                  const opt = adjTypeOptions.find((o) => o.value === r.type);
                  const label = opt?.label || r.type;
                  const amt = Number(r.amount || 0).toFixed(2);
                  const dateStr = r.ts ? dayjs(r.ts).format("YYYY-MM-DD HH:mm") : "";
                  return (
                    <Box
                      key={idx}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      sx={{ py: 0.5, borderBottom: '1px dashed', borderColor: 'divider' }}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {label}
                        </Typography>
                        {r.note && (
                          <Typography variant="body2" color="text.secondary">
                            {r.note}
                          </Typography>
                        )}
                        {dateStr && (
                          <Typography variant="caption" color="text.secondary">
                            {dateStr}
                          </Typography>
                        )}
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {r.currency} {amt}
                      </Typography>
                    </Box>
                  );
                })}
                {Object.keys(adjTypeTotals).length > 0 && (
                  <Box mt={1.5} p={1} sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {t('Totals this month') || 'Totals this month'}
                    </Typography>
                    {Object.entries(adjTypeTotals).map(([type, totals]) => {
                      const opt = adjTypeOptions.find((o) => o.value === type);
                      const label = opt?.label || type;
                      const parts: string[] = [];
                      if (totals.lyd) parts.push(`${totals.lyd.toFixed(2)} LYD`);
                      if (totals.usd) parts.push(`${totals.usd.toFixed(2)} USD`);
                      if (parts.length === 0) return null;
                      return (
                        <Box key={type} display="flex" justifyContent="space-between" sx={{ py: 0.25 }}>
                          <Typography variant="body2">{label}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {parts.join('  |  ')}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>
              <Divider sx={{ my: 1.5 }} />
              <Box display="grid" gridTemplateColumns="repeat(4, 1fr)" gap={1}>
                <TextField
                  select
                  size="small"
                  label={t("Type") || "Type"}
                  value={adjForm.type}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    setAdjForm((f) => ({
                      ...f,
                      type: nextType,
                      currency: adjLydOnlyTypes.has(nextType) ? 'LYD' : f.currency,
                    }));
                  }}
                >
                  {adjTypeOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {t(opt.label) || opt.label}
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
                  disabled={adjLydOnlyTypes.has(adjForm.type)}
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