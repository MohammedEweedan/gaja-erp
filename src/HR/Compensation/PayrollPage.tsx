import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Snackbar,
  Alert,
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
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { getLeaveBalance, getLeaveRequests, getLeaveTypes, getHolidays } from "../../services/leaveService";
import { getVacationsInRange } from "../../api/vacations";
import type { VacationRecord } from "../../api/vacations";

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

const LEAVE_FULL_CODES = new Set([
  "AL",
  "SL",
  "EL",
  "ML",
  "UL",
  "BM",
  "XL",
  "B1",
  "B2",
  "PP",
  "PL",
]);
const LEAVE_HALF_CODES = new Set(["HL"]);

function useNowYM() {
  const now = dayjs();
  return { year: now.year(), month: now.month() + 1 };
}

const months = Array.from({ length: 12 }, (_, i) => i + 1);
const years = Array.from({ length: 7 }, (_, i) => dayjs().year() - 3 + i);

function parseLooseBoolean(value: any): boolean | undefined {
  if (value === true) return true;
  if (value === false) return false;
  if (value == null) return undefined;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return undefined;
  }
  const s = String(value).trim().toLowerCase();
  if (!s) return undefined;
  if (["true", "1", "yes", "y", "on"].includes(s)) return true;
  if (["false", "0", "no", "n", "off"].includes(s)) return false;
  return undefined;
}

function toFiniteNumber(value: any): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeFingerprintPayrollRow(row: any, fingerprintOn: boolean) {
  if (fingerprintOn) return row;

  const absenceLyd = toFiniteNumber(row?.absence_lyd);
  const absenceUsd = toFiniteNumber(row?.absence_usd);
  const latencyLyd = toFiniteNumber(row?.missing_lyd ?? row?.latency_lyd);
  const latencyUsd = toFiniteNumber(row?.missing_usd ?? row?.latency_usd);
  const reimbLyd = absenceLyd + latencyLyd;
  const reimbUsd = absenceUsd + latencyUsd;

  const next = { ...row } as any;
  next.absence_days = 0;
  next.absence_lyd = 0;
  next.absence_usd = 0;
  next.missing_lyd = 0;
  next.missing_usd = 0;
  next.latency_lyd = 0;
  next.latency_usd = 0;
  next.missing_minutes = 0;
  next.latencyMinutes = 0;

  if (reimbLyd) {
    const totalLyd = toFiniteNumber(row?.total_salary_lyd ?? row?.totalLyd ?? row?.D7);
    const netLyd = toFiniteNumber(row?.net_salary_lyd ?? row?.netLyd ?? row?.D16);
    next.total_salary_lyd = Number((totalLyd + reimbLyd).toFixed(2));
    next.net_salary_lyd = Number((netLyd + reimbLyd).toFixed(2));
    if (row?.D7 !== undefined) next.D7 = Number((toFiniteNumber(row?.D7) + reimbLyd).toFixed(2));
    if (row?.D16 !== undefined) next.D16 = Number((toFiniteNumber(row?.D16) + reimbLyd).toFixed(2));
  }

  if (reimbUsd) {
    const totalUsd = toFiniteNumber(row?.total_salary_usd ?? row?.totalUsd ?? row?.C7);
    const netUsd = toFiniteNumber(row?.net_salary_usd ?? row?.netUsd ?? row?.C16);
    next.total_salary_usd = Number((totalUsd + reimbUsd).toFixed(2));
    next.net_salary_usd = Number((netUsd + reimbUsd).toFixed(2));
    if (row?.C7 !== undefined) next.C7 = Number((toFiniteNumber(row?.C7) + reimbUsd).toFixed(2));
    if (row?.C16 !== undefined) next.C16 = Number((toFiniteNumber(row?.C16) + reimbUsd).toFixed(2));
  }

  const fallbackDays = toFiniteNumber(row?.workingDays ?? row?.food_days ?? row?.wd_food_days ?? 0);
  if (fallbackDays > 0) {
    next.p_days = fallbackDays;
    if (!toFiniteNumber(next.food_days)) next.food_days = fallbackDays;
  } else if (!Number.isFinite(toFiniteNumber(next.p_days))) {
    next.p_days = 0;
  }

  return next;
}

function pickField(obj: any, keys: string[]): any {
  if (!obj) return undefined;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && (obj as any)[k] !== undefined) {
      return (obj as any)[k];
    }
  }
  return undefined;
}

function extractFingerprintRaw(obj: any): any {
  const direct = pickField(obj, [
    "FINGERPRINT_NEEDED",
    "fingerprint_needed",
    "fingerprintNeeded",
    "FP_REQUIRED",
    "fp_required",
    "NEED_FINGERPRINT",
    "need_fingerprint",
    "IS_FP_REQUIRED",
    "is_fp_required",
    "FINGERPRINT",
    "fingerprint",
    "FP",
    "fp",
  ]);
  if (direct !== undefined) return direct;

  try {
    for (const k of Object.keys(obj || {})) {
      const lk = k.toLowerCase();
      if (lk.includes("finger") || lk === "fp" || lk.includes("biometric")) return (obj as any)[k];
    }
  } catch {}
  return undefined;
}

export default function PayrollPage() {
  const { t } = useTranslation();
  const { year: y, month: m } = useNowYM();
  const [year, setYear] = React.useState<number>(y);
  const [month, setMonth] = React.useState<number>(m);
  const [ps, setPs] = React.useState<string>("");
  const fullscreenRef = React.useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false);
  const [usdToLyd] = React.useState<number>(0); // exchange removed; keep value for PDF logic
  const [psOptions, setPsOptions] = React.useState<PsItem[]>([]);
  const [psPoints, setPsPoints] = React.useState<Record<number, string>>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [colsAnchor, setColsAnchor] = React.useState<null | HTMLElement>(null);
  const [result, setResult] = React.useState<PayrollRunResponse | null>(null);
  const [v2Rows, setV2Rows] = React.useState<any[]>([]);
  const [viewOnly, setViewOnly] = React.useState<boolean>(false);

  const workingDaysExcludingFridays = React.useMemo(() => {
    const start = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
    const daysInMonth = start.daysInMonth();
    let nonFridays = 0;
    for (let i = 1; i <= daysInMonth; i++) {
      const day = start.date(i);
      if (day.day() !== 5) nonFridays += 1;
    }
    return nonFridays;
  }, [year, month]);

  const [calOpen, setCalOpen] = React.useState(false);
  const [calEmp, setCalEmp] = React.useState<{ id_emp: number; name: string } | null>(null);
  const [calDays, setCalDays] = React.useState<TimesheetDay[] | null>(null);
  const [calLoading, setCalLoading] = React.useState(false);
  const [calVacations, setCalVacations] = React.useState<VacationRecord[]>([]);
  const [holidaySet, setHolidaySet] = React.useState<Set<string>>(() => new Set());

  // Adjustments dialog state
  const [adjOpen, setAdjOpen] = React.useState(false);
  const [adjLoading, setAdjLoading] = React.useState(false);
  const [adjEmpId, setAdjEmpId] = React.useState<number | null>(null);
  const [adjRows, setAdjRows] = React.useState<
    Array<{
      id?: number;
      type: string;
      label?: string;
      direction?: string;
      recurring?: boolean;
      startYear?: number;
      startMonth?: number;
      endYear?: number;
      endMonth?: number;
      amount: number;
      currency: string;
      note?: string;
      ts?: string;
    }>
  >([]);
  const [adjForm, setAdjForm] = React.useState<{
    type: string;
    label: string;
    direction: 'ADD' | 'DEDUCT';
    recurring: boolean;
    startYear: number;
    startMonth: number;
    endYear: string;
    endMonth: string;
    amount: string;
    currency: string;
    note: string;
  }>({
    type: 'bonus',
    label: 'Bonus',
    direction: 'ADD',
    recurring: false,
    startYear: y,
    startMonth: m,
    endYear: '',
    endMonth: '',
    amount: '',
    currency: 'LYD',
    note: '',
  });
  const [adjEditId, setAdjEditId] = React.useState<number | null>(null);
  const [adjCurrencyFilter, setAdjCurrencyFilter] = React.useState<'ALL' | 'LYD' | 'USD'>('ALL');
  const [adjDeleteOpen, setAdjDeleteOpen] = React.useState(false);
  const [adjDeleteId, setAdjDeleteId] = React.useState<number | null>(null);

  const adjUsdEligible = React.useMemo(() => {
    if (!adjEmpId) return false;
    const emp = (result?.employees || []).find((x: any) => Number(x.id_emp) === Number(adjEmpId));
    const vr = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(adjEmpId)) || {};
    const usd = Number(
      (emp as any)?.basic_salary_usd ??
        (emp as any)?.base_salary_usd ??
        (emp as any)?.baseSalaryUsd ??
        (vr as any)?.basic_salary_usd ??
        (vr as any)?.base_salary_usd ??
        0
    );
    return Number.isFinite(usd) && usd > 0;
  }, [adjEmpId, result, v2Rows]);

  React.useEffect(() => {
    if (!adjUsdEligible && adjForm.currency === 'USD') {
      setAdjForm((f) => ({ ...f, currency: 'LYD' }));
    }
  }, [adjUsdEligible, adjForm.currency]);

  // Adjustment types and behavior (limited set per requirements)
  const adjTypeOptions: Array<{ value: string; label: string }> = [
    { value: 'bonus', label: 'Bonus' },
    { value: 'deduction', label: 'Deduction' },
    { value: 'eid_bonus', label: 'Eid Bonus' },
    { value: 'ramadan_bonus', label: 'Ramadan Bonus' },
    { value: 'custom', label: 'Custom' },
  ];
  const adjLydOnlyTypes = new Set([
    'bonus',
    'deduction',
    'eid_bonus',
    'ramadan_bonus',
    'custom',
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
  const [fingerprintRequiredMap, setFingerprintRequiredMap] = React.useState<Record<number, boolean>>({});
  const requiresFingerprint = React.useCallback((id: number, fallback?: boolean) => {
    if (Object.prototype.hasOwnProperty.call(fingerprintRequiredMap, id)) {
      return fingerprintRequiredMap[id];
    }
    if (fallback !== undefined) return fallback;
    return false;
  }, [fingerprintRequiredMap]);

  const [advMap, setAdvMap] = React.useState<Record<number, number>>({});
  const [adjSumsByEmp, setAdjSumsByEmp] = React.useState<Record<number, { earnLyd: number; earnUsd: number; dedLyd: number; dedUsd: number }>>({});
  const [nameMap, setNameMap] = React.useState<Record<number, string>>({});
  const [leaveTypeMap, setLeaveTypeMap] = useState<Record<string, { code: string; name: string; color: string }>>({});
  const [leaveRequestsCache, setLeaveRequestsCache] = useState<Record<number, any[]>>({});
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

  const [uiErrorOpen, setUiErrorOpen] = React.useState(false);
  const [uiErrorMessage, setUiErrorMessage] = React.useState<string>('');
  const showUiError = (msg: string) => {
    setUiErrorMessage(String(msg || ''));
    setUiErrorOpen(true);
  };

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

  const [tsAgg, setTsAgg] = React.useState<Record<number, {
    presentP: number;
    presentStrict: number;
    phUnits: number;
    fridayA: number;
    missRatio: number;
    phFullDays: number;
    phPartDays: number;
    absenceDays: number;
    // Total missing minutes from timesheet (sum of negative deltaMin, mirrored from TimeSheetsPage)
    missingMinutes: number;
    leaveUnits: number;
    foodEligibleNonFpDays: number;
    displayMissingMinutes: number;
  }>>({});

const computePPhPhf = (e: Payslip): PPhPhfVals => {
  const vr =
    (v2Rows || []).find(
      (x: any) => Number(x.id_emp) === Number(e.id_emp)
    ) || ({} as any);

  const agg = tsAgg?.[Number(e.id_emp)];

  // Always compute using a fixed 30-day month and timesheet-derived day counts
  const FIXED_MONTH_DAYS = 30;
  const baseLyd = Number(e.baseSalary ?? vr.base_salary_lyd ?? 0) || 0;
  const baseUsd = Number((e as any).baseSalaryUsd ?? vr.base_salary_usd ?? 0) || 0;
  const baseDailyLyd = baseLyd / FIXED_MONTH_DAYS;
  const baseDailyUsd = baseUsd / FIXED_MONTH_DAYS;

  const pDays = Number(agg?.presentP ?? (vr as any).p_days ?? e.presentWorkdays ?? 0) || 0;
  const phDays = Number(agg?.phPartDays ?? (vr as any).ph_days ?? 0) || 0;
  const phfDays = Number(agg?.phFullDays ?? (vr as any).phf_days ?? 0) || 0;

  // Food per day for PHF
  let foodPerDay = Number((e as any).FOOD || (e as any).FOOD_ALLOWANCE || vr.food_per_day_lyd || 0);
  if (!foodPerDay) {
    const totalFoodLyd = Number((vr as any).wd_food_lyd || 0);
    const W = Math.max(1, Number(e.workingDays || vr.workingDays || 0) || 1);
    foodPerDay = totalFoodLyd && W ? totalFoodLyd / W : 0;
  }

  // P = normal daily rate
  const pLyd = pDays * baseDailyLyd;
  const pUsd = pDays * baseDailyUsd;

  // PH = double daily rate (no food)
  const phLyd = phDays * (baseDailyLyd * 2);
  const phUsd = phDays * (baseDailyUsd * 2);

  // PHF = double daily rate + food allowance
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


  const zeroBreakdown = {
    earningsLyd: 0,
    earningsUsd: 0,
    deductionsLyd: 0,
    deductionsUsd: 0,
    goldLyd: 0,
    goldUsd: 0,
    diamondLyd: 0,
    diamondUsd: 0,
    grossLyd: 0,
    grossUsd: 0,
  };

  function resolvePayEntities(id_emp: number): { emp: Payslip | null; v2: any } {
    const emp = (result?.employees || []).find((e) => Number(e.id_emp) === Number(id_emp)) || null;
    const v2 = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(id_emp)) || ({} as any);
    return { emp, v2 };
  }

  function computeFoodAllowance(emp: Payslip | null, v2: any) {
    if (!emp) return { allowance: 0, perDay: 0, paidDays: 0 };
    const foodTotal = Number((v2 as any).wd_food_lyd ?? 0);
    const workingDaysFood = Number((v2 as any).food_days ?? (v2 as any).workingDays ?? emp.workingDays ?? 0);
    const defaultPer = Number((emp as any).FOOD || (emp as any).FOOD_ALLOWANCE || 0);
    let perDay = defaultPer;
    if (!perDay) perDay = workingDaysFood > 0 ? foodTotal / workingDaysFood : 0;
    const empId = Number(emp.id_emp);
    const hasFingerprint = requiresFingerprint(empId, true);
    const agg = tsAgg?.[empId];
    const presentStrict = Number(agg?.presentStrict ?? 0);
    const paidDaysRaw = Number((v2 as any).p_days ?? agg?.presentP ?? emp.presentWorkdays ?? 0) || 0;
    const leaveUnits = Number(agg?.leaveUnits ?? 0);
    const scheduleDays = workingDaysFood || Number(emp.workingDays ?? 0) || workingDaysExcludingFridays || 0;
    let paidDays = paidDaysRaw;
    if (hasFingerprint) {
      let fpDays = presentStrict;
      if (!fpDays) fpDays = Number(agg?.presentP ?? 0);
      if (!fpDays) fpDays = paidDaysRaw;
      if (!fpDays && scheduleDays) {
        fpDays = Math.max(0, scheduleDays - Number(agg?.absenceDays ?? 0));
      }
      if (scheduleDays) fpDays = Math.min(fpDays, scheduleDays);
      paidDays = Math.max(0, fpDays);
    } else {
      const eligibleDerived = Number(agg?.foodEligibleNonFpDays ?? 0);
      let baseline = Math.max(eligibleDerived, scheduleDays, paidDaysRaw);
      paidDays = Math.max(0, baseline - leaveUnits);
    }
    const allowance = Number((perDay * paidDays).toFixed(2));
    return { allowance, perDay, paidDays };
  }

  function getPhAmounts(id_emp: number, opts?: { emp?: Payslip | null; v2?: any; workingDays?: number; baseLyd?: number; baseUsd?: number }) {
    try {
      const resolved = resolvePayEntities(id_emp);
      const v2 = opts?.v2 ?? resolved.v2;
      
      // Use backend-calculated PH values directly (already uses correct formula: dailyRate * 2 * phDays)
      const phLyd = Math.max(0, Number((v2 as any).ph_lyd || 0));
      const phUsd = Math.max(0, Number((v2 as any).ph_usd || 0));
      
      // Also include PHF values
      const phfLyd = Math.max(0, Number((v2 as any).phf_lyd || 0));
      const phfUsd = Math.max(0, Number((v2 as any).phf_usd || 0));
      
      // Return combined PH + PHF for total paid holiday amount
      return { 
        lyd: Number((phLyd + phfLyd).toFixed(2)), 
        usd: Number((phUsd + phfUsd).toFixed(2)) 
      };
    } catch {
      return { lyd: 0, usd: 0 };
    }
  }

  function computePayBreakdown(id_emp: number) {
    try {
      const { emp, v2 } = resolvePayEntities(id_emp);
      if (!emp) return { ...zeroBreakdown };
      const adjSums = adjSumsByEmp[id_emp] || { earnLyd: 0, earnUsd: 0, dedLyd: 0, dedUsd: 0 };
      const W = Math.max(1, Number(emp.workingDays || (v2 as any).workingDays || 0) || 1);
      const base = Math.max(0, Number(v2.base_salary_lyd || emp.baseSalary || 0));
      const baseUsd = Math.max(0, Number((v2 as any).base_salary_usd || (emp as any).baseSalaryUsd || 0));
      const { lyd: ph, usd: phUsd } = getPhAmounts(id_emp, { emp, v2, workingDays: W, baseLyd: base, baseUsd });
      const hasFingerprint = requiresFingerprint(id_emp, true);
      const absence = hasFingerprint ? Math.max(0, Number(v2.absence_lyd || 0)) : 0;
      const absenceUsd = hasFingerprint ? Math.max(0, Number((v2 as any).absence_usd || 0)) : 0;
      const commissionUi = commissionMapUI[id_emp];
      const gold = preferCommissionValue(
        commissionUi?.goldBonusLyd,
        (v2 as any).gold_bonus_lyd,
        (emp as any)?.gold_bonus_lyd
      );
      const dia = preferCommissionValue(
        commissionUi?.diamondBonusLyd,
        (v2 as any).diamond_bonus_lyd,
        (emp as any)?.diamond_bonus_lyd
      );
      const goldUsd = preferCommissionValue(
        commissionUi?.goldBonusUsd,
        (v2 as any).gold_bonus_usd,
        (emp as any)?.gold_bonus_usd
      );
      const diaUsd = preferCommissionValue(
        commissionUi?.diamondBonusUsd,
        (v2 as any).diamond_bonus_usd,
        (emp as any)?.diamond_bonus_usd
      );
      const loanPay = Math.max(0, Number(v2.loan_credit_lyd || (emp.components?.adjustments as any)?.loanPayment || 0));
      const loanPayUsd = Math.max(0, Number((v2 as any).loan_credit_usd || 0));
      const adv = Math.max(0, Number(advMap[id_emp] || 0));
      const otherDedRaw = Math.max(0, Number(v2.other_deductions_lyd || 0));
      const otherDedExAdv = Math.max(0, otherDedRaw - adv);
      const foodInfo = computeFoodAllowance(emp, v2);
      const foodAdj = foodInfo.allowance;

      // Latency deduction: use backend-calculated amounts (legacy approach)
      // so Net matches the original payroll engine.
      const latencyLyd = hasFingerprint ? Math.max(0, Number((v2 as any).missing_lyd || (v2 as any).latency_lyd || 0)) : 0;
      const latencyUsd = hasFingerprint ? Math.max(0, Number((v2 as any).missing_usd || (v2 as any).latency_usd || 0)) : 0;
      // Transportation (FUEL) and Communication allowances — flat monthly amounts
      const fuelMonthly = Number(((emp as any).FUEL ?? (v2 as any).FUEL) || 0);
      const commMonthly = Number(((emp as any).COMMUNICATION ?? (v2 as any).COMMUNICATION) || 0);
      const transportAdj = Math.max(0, Number(fuelMonthly.toFixed(2)));
      const commAdj = Math.max(0, Number(commMonthly.toFixed(2)));
      const fallbackAdjLyd = Math.max(0,
        Number((v2 as any).other_additions_lyd || 0) +
        Number((v2 as any).other_bonus1_lyd || 0) +
        Number((v2 as any).other_bonus2_lyd || 0) +
        Number((v2 as any).loan_debit_lyd || 0)
      );
      const adjEarningsLyd = adjSums.earnLyd > 0.0001 ? adjSums.earnLyd : fallbackAdjLyd;
      const adjDeductionsLyd = adjSums.dedLyd > 0.0001 ? adjSums.dedLyd : otherDedExAdv;
      const totalEarnings = base + ph + foodAdj + transportAdj + commAdj + gold + dia + adjEarningsLyd;
      const totalDeductions = absence + adv + loanPay + adjDeductionsLyd + latencyLyd;
      const totalUsdEarnings = baseUsd + phUsd + goldUsd + diaUsd + Math.max(0, adjSums.earnUsd);
      const totalUsdDeductions = absenceUsd + loanPayUsd + Math.max(0, adjSums.dedUsd) + latencyUsd;
      return {
        earningsLyd: Number(totalEarnings.toFixed(2)),
        deductionsLyd: Number(totalDeductions.toFixed(2)),
        earningsUsd: Number(totalUsdEarnings.toFixed(2)),
        deductionsUsd: Number(totalUsdDeductions.toFixed(2)),
        goldLyd: Number(gold.toFixed(2)),
        goldUsd: Number(goldUsd.toFixed(2)),
        diamondLyd: Number(dia.toFixed(2)),
        diamondUsd: Number(diaUsd.toFixed(2)),
        grossLyd: Number(totalEarnings.toFixed(2)),
        grossUsd: Number(totalUsdEarnings.toFixed(2)),
      };
    } catch {
      return { ...zeroBreakdown };
    }
  }

  const preferCommissionValue = (
    ...values: Array<number | string | null | undefined>
  ): number => {
    let best = 0;
    for (const val of values) {
      const num = Number(val);
      if (Number.isFinite(num)) {
        best = Math.max(best, num);
      }
    }
    return Number(best.toFixed(2));
  };

  // Consistent NET calculator (matches PDF logic). Returns non-negative LYD.
  function computeNetLYDFor(id_emp: number): number {
    const breakdown = computePayBreakdown(id_emp);
    return Math.max(0, Number((breakdown.earningsLyd - breakdown.deductionsLyd).toFixed(2)));
  }

  function computeNetUSDFor(id_emp: number): number {
    const breakdown = computePayBreakdown(id_emp);
    return Math.max(0, Number((breakdown.earningsUsd - breakdown.deductionsUsd).toFixed(2)));
  }

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const safeISO10 = (v: any): string => {
    if (!v) return "";
    const s = String(v).trim();
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    // Common backend/UI formats: DD/MM/YYYY or DD-MM-YYYY (optionally with time)
    const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m1) {
      const dd = String(m1[1]).padStart(2, '0');
      const mm = String(m1[2]).padStart(2, '0');
      const yy = String(m1[3]);
      return `${yy}-${mm}-${dd}`;
    }
    const d = dayjs(s);
    return d.isValid() ? d.format('YYYY-MM-DD') : '';
  };

  // Classify attendance badge for a day
  // PRIORITY ORDER:
  // 1. Backend-provided code from timesheet (includes manual overrides from j_* columns)
  // 2. Approved leave/vacation codes
  // 3. Computed from punch data (fallback)
  function codeBadge(day?: any, schStartMin?: number | null, schEndMin?: number | null, empId?: number): string {
    // If there is no timesheet day at all, do not force an Absent code.
    if (!day) return '';
    
    // PRIORITY 1: Backend-provided code from timesheet (respects manual overrides)
    // The backend timesheetController reads j_* columns which contain manual codes
    const rawCode = String(day.code || day.badge || '').toUpperCase();
    const knownCodes = ['P','A','PT','PL','PH','PHF','AL','SL','EL','ML','UL','HL','BM','XL','B1','B2','NI','NO','MO','IP','LI','EO','W','H','PP'];
    if (rawCode && knownCodes.includes(rawCode)) {
      return rawCode;
    }
    
    // PRIORITY 2: Check if this day falls within any approved leave period
    if (empId && leaveRequestsCache[empId]) {
      const dayDate = new Date(day.date || `${year}-${String(month).padStart(2, '0')}-${String(day.day || 1).padStart(2, '0')}`);
      dayDate.setHours(0, 0, 0, 0);

      const dayNum = Number(day?.day || 1);
      const ymd = String(day?.date || `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`).slice(0, 10);
      const dayMoment = dayjs(ymd);
      
      for (const leave of leaveRequestsCache[empId]) {
        const status = String(leave.status || leave.state || '').toLowerCase();
        if (!status.includes('approved') && !status.includes('موافق') && !status.includes('accepted')) continue;
        
        const st = leave.startDate || leave.DATE_START || leave.date_depart;
        const en = leave.endDate || leave.DATE_END || leave.date_end;
        if (!st || !en) continue;
        
        const stYmd = safeISO10(st);
        const enYmd = safeISO10(en);
        if (!stYmd || !enYmd) continue;

        // Check if current day is within leave period (timezone-safe)
        if (ymd >= stYmd && ymd <= enYmd) {
          // Determine leave code first
          let leaveCode = '';
          
          // 1. Direct code field
          const directCode = String(leave.code || leave.leaveType || leave.leaveTypeCode || '').toUpperCase();
          if (directCode && knownCodes.includes(directCode)) {
            leaveCode = directCode;
          } else {
            // 2. Look up by id_can in leaveTypeMap
            const idCan = leave.id_can ?? leave.typeCode ?? leave.leaveCode;
            if (idCan != null) {
              const lt = leaveTypeMap[String(idCan)];
              if (lt?.code) {
                const ltCode = lt.code.toUpperCase();
                if (knownCodes.includes(ltCode)) leaveCode = ltCode;
              }
            }
          }
          
          // 3. Check leave type name for keywords if no code yet
          if (!leaveCode) {
            const typeName = String(leave.typeName || leave.leaveTypeName || leave.type || '').toUpperCase();
            if (typeName.includes('ANNUAL') || typeName.includes('سنوي')) leaveCode = 'AL';
            else if (typeName.includes('SICK') || typeName.includes('مرض')) leaveCode = 'SL';
            else if (typeName.includes('EMERGENCY') || typeName.includes('طارئ')) leaveCode = 'EL';
            else if (typeName.includes('MATERNITY') || typeName.includes('أمومة')) leaveCode = 'ML';
            else if (typeName.includes('UNPAID') || typeName.includes('بدون')) leaveCode = 'UL';
            else if (typeName.includes('HALF')) leaveCode = 'HL';
            else if (typeName.includes('BEREAVEMENT') || typeName.includes('عزاء')) leaveCode = 'BM';
            else if (typeName.includes('EXAM') || typeName.includes('امتحان')) leaveCode = 'XL';
            else if (directCode && directCode.length <= 3) leaveCode = directCode;
            else leaveCode = 'AL'; // Fallback
          }
          
          // IMPORTANT: Return the leave code for DISPLAY purposes
          // The Friday rule (not counting Fridays as working days) is handled in the backend
          // and in working day calculations, NOT in the display logic
          return leaveCode;
        }
      }
    } else {
      const dayNum = Number(day?.day || 1);
      const ymd = String(day?.date || `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`).slice(0, 10);
      const dayMoment = dayjs(ymd);
      if (dayMoment.isAfter(dayjs(), 'day')) {
        return '';
      }
    }

    const dayNum = Number(day?.day || 1);
    const ymd = String(day?.date || `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`).slice(0, 10);
    const dayMoment = dayjs(ymd);
    if (dayMoment.isAfter(dayjs(), 'day')) {
      return '';
    }
    
    // PRIORITY 3: Compute from punch data (fallback when no backend code)
    const present = !!day.present;
    
    const isHoliday = holidaySet.has(ymd) || !!day.isHoliday || /holiday/i.test(String(day.type||day.reason||''));
    if (!present && isHoliday) return '';
    
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
    const toleranceMinutes = 30;
    const tol = 5;
    
    if (!present) return 'A';
    if (isHoliday) {
      return (worked >= Math.max(0, expDur - tol)) ? 'PHF' : 'PH';
    }
    if (late > tol) return 'PL';
    if (miss > tol && miss > toleranceMinutes) return 'PT';
    return 'P';
  }

  const openCalendar = async (id_emp: number, name: string) => {
    setCalOpen(true);
    setCalEmp({ id_emp, name });
    setCalLoading(true);
    try {
      // Load timesheet
      const res = await getTimesheetMonth(id_emp, year, month);
      setCalDays(res?.data || null);
      
      // Load leave requests for this employee
      if (!leaveRequestsCache[id_emp]) {
        try {
          const leaveRequests = await getLeaveRequests(String(id_emp));
          setLeaveRequestsCache(prev => ({
            ...prev,
            [id_emp]: Array.isArray(leaveRequests) ? leaveRequests : []
          }));
        } catch (e) {
          console.error('Failed to load leave requests:', e);
        }
      }

      try {
        const from = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('YYYY-MM-DD');
        const to = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).endOf('month').format('YYYY-MM-DD');
        const all = await getVacationsInRange(from, to);
        setCalVacations((all || []).filter((v: VacationRecord) => Number(v.id_emp) === Number(id_emp)));
      } catch {
        setCalVacations([]);
      }
    } catch (e: any) {
      setCalDays(null);
    } finally {
      setCalLoading(false);
    }
  };

  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const set = new Set<string>();
        try {
          const holidaysResp = await getHolidays();
          const holidaysArr = Array.isArray(holidaysResp)
            ? holidaysResp
            : (holidaysResp as any)?.data || [];
          (holidaysArr || []).forEach((h: any) => {
            const iso = safeISO10(h.DATE_H ?? h.date ?? h.holiday_date);
            if (iso) set.add(iso);
          });
        } catch {}
        try {
          const raw = localStorage.getItem('custom_holidays');
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              arr.forEach((h: any) => {
                const iso = safeISO10(h.DATE_H ?? h.date ?? h.holiday_date);
                if (iso) set.add(iso);
              });
            }
          }
        } catch {}
        setHolidaySet(set);
      } catch {}
    };
    loadHolidays();
  }, []);

  // Color palette for leave types (matching CalendarLogScreen.tsx)
  const leaveColorPalette = useMemo(() => [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
    "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
  ], []);

  // Generate stable color from leave code (matching CalendarLogScreen.tsx)
  const stableColorFromCode = useCallback((code: string) => {
    const up = code.toUpperCase();
    if (up === "AL") return "#f44336"; // Annual Leave - red
    if (up === "SL") return "#4caf50"; // Sick Leave - green
    if (up === "EL") return "#ff9800"; // Emergency Leave - orange
    if (up === "ML") return "#e91e63"; // Maternity Leave - pink
    if (up === "UL") return "#9c27b0"; // Unpaid Leave - purple
    if (up === "HL") return "#03a9f4"; // Half Day Leave - light blue
    if (up === "BM" || up === "B1" || up === "B2") return "#607d8b"; // Bereavement - gray
    if (up === "XL") return "#8bc34a"; // Exam Leave - light green
    if (up === "PH") return "#424242"; // Public Holiday - dark gray
    // Hash-based fallback for other codes
    let hash = 0;
    for (let i = 0; i < up.length; i++) hash = (hash * 53 + up.charCodeAt(i)) >>> 0;
    return leaveColorPalette[hash % leaveColorPalette.length];
  }, [leaveColorPalette]);

  const hexToRgba = (hex: string, a: number): string => {
    try {
      const h = String(hex || '').replace('#', '').trim();
      const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
      if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(0,0,0,${a})`;
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    } catch {
      return `rgba(0,0,0,${a})`;
    }
  };

  useEffect(() => {
    const loadTypes = async () => {
      try {
        const types = await getLeaveTypes();
        const map: Record<string, { code: string; name: string; color: string }> = {};
        (Array.isArray(types) ? types : []).forEach((t: any) => {
          if (t && t.int_can != null) {
            const code = String(t.code || "").toUpperCase();
            const color = (t.color && /^#([0-9A-F]{3}){1,2}$/i.test(t.color))
              ? t.color
              : stableColorFromCode(code);
            map[String(t.int_can)] = {
              code,
              name: String(t.desig_can || ""),
              color,
            };
          }
        });
        setLeaveTypeMap(map);
      } catch {}
    };
    loadTypes();
  }, [stableColorFromCode]);

  // Helper functions for working day calculations (matching LeaveBalanceScreen.tsx and CalendarLogScreen.tsx)
  const isFridayDate = useCallback((d: Date) => d.getDay() === 5, []);
  const isHolidayDate = useCallback((d: Date) => {
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return holidaySet.has(ymd);
  }, [holidaySet]);
  const isNonWorkingDate = useCallback((d: Date) => isFridayDate(d) || isHolidayDate(d), [isFridayDate, isHolidayDate]);

  // Count working days between two dates (excluding Fridays and holidays) - matching LeaveBalanceScreen.tsx
  const countWorkingDays = useCallback((a: Date, b: Date) => {
    const s = new Date(a);
    s.setHours(0, 0, 0, 0);
    const e = new Date(b);
    e.setHours(0, 0, 0, 0);
    let count = 0;
    const d = new Date(s);
    while (d <= e) {
      if (!isNonWorkingDate(d)) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  }, [isNonWorkingDate]);

  // Split leave period into working-only segments (matching CalendarLogScreen.tsx)
  const splitWorkingSegments = useCallback((start: Date, end: Date) => {
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(end);
    e.setHours(23, 59, 59, 999);

    const segments: Array<{ start: Date; end: Date }> = [];
    let cur: Date | null = null;

    const step = new Date(s);
    while (step <= e) {
      const day = new Date(step);
      const working = !isNonWorkingDate(day);
      if (working) {
        if (!cur) cur = new Date(day);
      } else {
        if (cur) {
          const segEnd = new Date(day);
          segEnd.setDate(segEnd.getDate() - 1);
          segEnd.setHours(23, 59, 59, 999);
          segments.push({ start: cur, end: segEnd });
          cur = null;
        }
      }
      step.setDate(step.getDate() + 1);
    }

    if (cur) {
      const segEnd = new Date(e);
      segments.push({ start: cur, end: segEnd });
    }

    return segments;
  }, [isNonWorkingDate]);

  // Get leave type metadata with color
  const getLeaveTypeMeta = useCallback((idCan?: string | number) => {
    if (idCan == null) return { code: '', name: '', color: '#9e9e9e' };
    const key = String(idCan);
    const entry = leaveTypeMap[key];
    if (entry) return entry;
    // Fallback: try to get color from code
    const code = String(idCan).toUpperCase();
    return { code, name: '', color: stableColorFromCode(code) };
  }, [leaveTypeMap, stableColorFromCode]);

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
            const url = `http://localhost:9000/api/hr/payroll/adjustments?year=${year}&month=${month}&employeeId=${adjEmpId}`;
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
          const res = await fetch(`http://localhost:9000/api/hr/payroll/history/total?${q.toString()}`, { headers: authHeader() as unknown as HeadersInit });
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
        const url = `http://localhost:9000/api/hr/payroll/adjustments?year=${year}&month=${month}&employeeId=${adjEmpId}`;
        const res = await fetch(url, { headers: authHeader() as unknown as HeadersInit });
        if (!res.ok) {
          setAdjRows([]);
          return;
        }
        const js = await res.json();
        const rawRows = (js?.data?.[String(adjEmpId)] || []) as Array<{ id?: number; type: string; label?: string; direction?: string; recurring?: boolean; startYear?: number; startMonth?: number; endYear?: number; endMonth?: number; amount: number; currency: string; note?: string; ts?: string }>;
        // Ensure each row has an ID (generate one for legacy entries without ID)
        const rows = rawRows.map((r, idx) => ({
          ...r,
          id: r.id ?? Date.now() + idx,
        }));
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
      const k = (r.label || r.type || 'other') as string;
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
      const res = await fetch(`${process.env.REACT_APP_API_IP || 'http://localhost:9000/api'}/jobs/jobs`, {
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
    if (adjForm.type === 'custom' && !String(adjForm.label || '').trim()) { alert('Label required'); return; }
    setAdjLoading(true);
    try {
      const isLydOnly = !adjUsdEligible;
      const endY = String(adjForm.endYear || '').trim();
      const endM = String(adjForm.endMonth || '').trim();
      const hasEnd = !!endY && !!endM;
      const payload = {
        year,
        month,
        employeeId: adjEmpId,
        type: adjForm.type,
        label: String(adjForm.label || '').trim() || undefined,
        direction: adjForm.direction,
        recurring: !!adjForm.recurring,
        startYear: adjForm.recurring ? Number(adjForm.startYear) : undefined,
        startMonth: adjForm.recurring ? Number(adjForm.startMonth) : undefined,
        endYear: adjForm.recurring && hasEnd ? Number(endY) : undefined,
        endMonth: adjForm.recurring && hasEnd ? Number(endM) : undefined,
        amount: Number(adjForm.amount),
        currency: isLydOnly ? 'LYD' : adjForm.currency,
        note: adjForm.note,
      };
      const res = await fetch(`http://localhost:9000/api/hr/payroll/adjustments`, { method: 'POST', headers: ({ 'Content-Type': 'application/json', ...authHeader() } as unknown as HeadersInit), body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to add adjustment');
      const js = await res.json();
      setAdjRows(prev => [...prev, js.entry]);
      setAdjForm({
        type: 'bonus',
        label: 'Bonus',
        direction: 'ADD',
        recurring: false,
        startYear: year,
        startMonth: month,
        endYear: '',
        endMonth: '',
        amount: '',
        currency: adjUsdEligible ? adjForm.currency : 'LYD',
        note: '',
      });
      await onRun();
    } catch (e: any) {
      alert(e?.message || 'Failed to add');
    } finally { setAdjLoading(false); }
  };

  const updateAdjustment = async () => {
    if (!adjEditId || !adjEmpId) return;
    if (!adjForm.amount) { alert('Amount required'); return; }
    if (adjForm.type === 'custom' && !String(adjForm.label || '').trim()) { alert('Label required'); return; }
    setAdjLoading(true);
    try {
      const isLydOnly = !adjUsdEligible;
      const endY = String(adjForm.endYear || '').trim();
      const endM = String(adjForm.endMonth || '').trim();
      const hasEnd = !!endY && !!endM;
      const payload = {
        type: adjForm.type,
        label: String(adjForm.label || '').trim() || undefined,
        direction: adjForm.direction,
        recurring: !!adjForm.recurring,
        startYear: adjForm.recurring ? Number(adjForm.startYear) : undefined,
        startMonth: adjForm.recurring ? Number(adjForm.startMonth) : undefined,
        endYear: adjForm.recurring && hasEnd ? Number(endY) : undefined,
        endMonth: adjForm.recurring && hasEnd ? Number(endM) : undefined,
        amount: Number(adjForm.amount),
        currency: isLydOnly ? 'LYD' : adjForm.currency,
        note: adjForm.note,
      };
      const res = await fetch(`http://localhost:9000/api/hr/payroll/adjustments/${adjEditId}`, { 
        method: 'PUT', 
        headers: ({ 'Content-Type': 'application/json', ...authHeader() } as unknown as HeadersInit), 
        body: JSON.stringify(payload) 
      });
      if (!res.ok) throw new Error('Failed to update adjustment');
      const js = await res.json();
      setAdjRows(prev => prev.map(r => r.id === adjEditId ? { ...r, ...js.entry } : r));
      setAdjForm({
        type: 'bonus',
        label: 'Bonus',
        direction: 'ADD',
        recurring: false,
        startYear: year,
        startMonth: month,
        endYear: '',
        endMonth: '',
        amount: '',
        currency: adjUsdEligible ? adjForm.currency : 'LYD',
        note: '',
      });
      setAdjEditId(null);
      await onRun();
    } catch (e: any) {
      alert(e?.message || 'Failed to update');
    } finally { setAdjLoading(false); }
  };

  const deleteAdjustment = async (id: number) => {
    setAdjLoading(true);
    try {
      const res = await fetch(`http://localhost:9000/api/hr/payroll/adjustments/${id}`, { 
        method: 'DELETE', 
        headers: authHeader() as unknown as HeadersInit 
      });
      if (!res.ok) throw new Error('Failed to delete adjustment');
      setAdjRows(prev => prev.filter(r => r.id !== id));
      await onRun();
    } catch (e: any) {
      alert(e?.message || 'Failed to delete');
    } finally { setAdjLoading(false); }
  };

  const requestDeleteAdjustment = (id: number) => {
    setAdjDeleteId(id);
    setAdjDeleteOpen(true);
  };

  const startEditAdjustment = (row: { id?: number; type: string; label?: string; direction?: string; recurring?: boolean; startYear?: number; startMonth?: number; endYear?: number; endMonth?: number; amount: number; currency: string; note?: string }) => {
    if (!row.id) return;
    setAdjEditId(row.id);
    const opt = adjTypeOptions.find((o) => o.value === row.type);
    const fallbackLabel = opt?.label || row.type;
    const dirRaw = String(row.direction || '').toUpperCase();
    const dir: 'ADD' | 'DEDUCT' = dirRaw === 'DEDUCT' || String(row.type || '').toLowerCase() === 'deduction' ? 'DEDUCT' : 'ADD';
    setAdjForm({
      type: row.type,
      label: String(row.label || fallbackLabel || ''),
      direction: dir,
      recurring: !!row.recurring,
      startYear: Number(row.startYear || year),
      startMonth: Number(row.startMonth || month),
      endYear: row.endYear ? String(row.endYear) : '',
      endMonth: row.endMonth ? String(row.endMonth) : '',
      amount: String(row.amount),
      currency: row.currency,
      note: row.note || '',
    });
  };

  const cancelEditAdjustment = () => {
    setAdjEditId(null);
    setAdjForm({
      type: 'bonus',
      label: 'Bonus',
      direction: 'ADD',
      recurring: false,
      startYear: year,
      startMonth: month,
      endYear: '',
      endMonth: '',
      amount: '',
      currency: 'LYD',
      note: '',
    });
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

  React.useEffect(() => {
    if (!isFullscreen) return;
    if (tab !== "payroll") setTab("payroll");
  }, [isFullscreen, tab]);

  const psCycleValues = React.useMemo(() => {
    const cur = String(ps ?? "").trim();
    const fromPsOptions = ((psOptions || []) as any[])
      .map((p: any) => String(p?.PS ?? ""))
      .filter((v) => v != null && String(v).trim() !== "");

    const fromPoints = Object.keys(psPoints || {})
      .map((k) => String(k))
      .filter((v) => v != null && String(v).trim() !== "");

    const combined = Array.from(new Set(["", ...(cur ? [cur] : []), ...fromPsOptions, ...fromPoints]));
    // Keep "All" first, then try to sort numeric-like PS values.
    const rest = combined
      .filter((v) => v !== "")
      .sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        const fa = Number.isFinite(na);
        const fb = Number.isFinite(nb);
        if (fa && fb) return na - nb;
        if (fa && !fb) return -1;
        if (!fa && fb) return 1;
        return String(a).localeCompare(String(b));
      });
    return ["", ...rest];
  }, [ps, psOptions, psPoints]);

  const psCountMap = React.useMemo(() => {
    const m: Record<string, number> = {};
    (psOptions || []).forEach((p: any) => {
      const k = String(p?.PS ?? "");
      if (!k) return;
      const c = Number(p?.count ?? 0) || 0;
      m[k] = c;
    });
    return m;
  }, [psOptions]);

  const shiftMonth = React.useCallback(
    (delta: number) => {
      let yy = year;
      let mm = month + delta;
      while (mm < 1) {
        mm += 12;
        yy -= 1;
      }
      while (mm > 12) {
        mm -= 12;
        yy += 1;
      }
      setYear(yy);
      setMonth(mm);
    },
    [year, month]
  );

  const shiftPs = React.useCallback(
    (delta: number) => {
      const values = psCycleValues;
      if (!values || values.length <= 1) return;
      const current = String(ps ?? "");
      const foundIdx = values.indexOf(current);
      const idx = foundIdx >= 0 ? foundIdx : 0;
      const next = values[(idx + delta + values.length) % values.length];
      setPs(next);
    },
    [ps, psCycleValues]
  );

  const toggleFullscreen = React.useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      const el = fullscreenRef.current;
      if (el && (el as any).requestFullscreen) {
        await (el as any).requestFullscreen();
      }
    } catch {}
  }, []);

  React.useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    onFsChange();
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const fetchSales = React.useCallback(async () => {
    try {
      const url = `http://localhost:9000/api/hr/payroll/sales-metrics?year=${year}&month=${month}`;
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
          const res = await fetch(`http://localhost:9000/api/employees`, { headers: authHeader() as unknown as HeadersInit });
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
            const r = await fetch(`http://localhost:9000/api/employees/${e.id_emp}`, { headers: authHeader() as unknown as HeadersInit });
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
          const r = await fetch(`http://localhost:9000/api/invoices/allDetailsP?${qs}`, { headers: authHeader() as unknown as HeadersInit });
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
          // FUEL is per month
          const per = Number((e as any).FUEL || 0);
          return per;
        }

        case 'comm': {
          // COMMUNICATION is per month
          const per = Number((e as any).COMMUNICATION || 0);
          return per;
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
        }
      }
    }
    // Filter by PS
    if (ps && ps.trim() !== "") {
      const formattedSelectedPs = formatPs(ps) || ps;
      rows = rows.filter((r) => {
        const empPs = (r as any).PS;
        const formattedEmpPs = formatPs(empPs) || empPs;
        return empPs != null && formattedEmpPs === formattedSelectedPs;
      });
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
  }, [result, positionFilter, filterText, sortRows, nameMap, jobs, employeesByTitle, ps]);

  type CommissionResult = {
  sellerUserId: number | null;
  roleKey: string;
  commissionPs: number[];
  goldRate: number;
  diamondPct: number;

  goldGramsSelf: number;
  goldGramsScope: number;
  goldGramsUsed: number;
  goldBonusLyd: number;
  goldBonusUsd: number;

  diamondSelfLyd: number;
  diamondSelfUsd: number;
  diamondItems: number;
  diamondBonusLyd: number;
  diamondBonusUsd: number;

  salesGoldLyd: number;
  salesGoldUsd: number;
  salesDiamondLyd: number;
  salesDiamondUsd: number;
};

const safeNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const getCommissionSettingsV1 = () => {
  try {
    const raw = localStorage.getItem("commissionSettingsV1");
    if (!raw) return {} as any;
    const cfg = JSON.parse(raw);
    return cfg && typeof cfg === "object" ? cfg : ({} as any);
  } catch {
    return {} as any;
  }
};

const getRoleRates = (roleKey: string) => {
  const commissionSettings = getCommissionSettingsV1();

  const goldRates: Record<string, number> = {
    sales_rep: 1,
    senior_sales_rep: 1.25,
    sales_lead: 1.5,
    sales_manager: 1.5,
    ...(commissionSettings.gold || {}),
  };

  const diamondRates: Record<string, number> = {
    sales_rep: 1.5,
    senior_sales_rep: 3,
    sales_lead: 3,
    sales_manager: 3,
    ...(commissionSettings.diamond || {}),
  };

  return {
    goldRate: Number(goldRates[roleKey] ?? 0) || 0,
    diamondPct: Number(diamondRates[roleKey] ?? 0) || 0,
  };
};

const parseEmployeeCommissionProfile = (empObj: any, emp: any) => {
  let sellerUserId: number | null = null;
  let commissionRole = "";
  let commissionPs: number[] = [];

  try {
    const jd = empObj?.JOB_DESCRIPTION ? JSON.parse(empObj.JOB_DESCRIPTION) : {};
    const sid = jd?.__sales__?.userId ?? jd?.__seller__?.userId ?? null;
    if (sid != null && !Number.isNaN(Number(sid))) sellerUserId = Number(sid);

    if (jd?.__commissions__) {
      commissionRole = String(jd.__commissions__.role || "").toLowerCase();
      const psList = jd.__commissions__.ps;
      if (Array.isArray(psList)) {
        commissionPs = psList
          .map((x: any) => Number(x))
          .filter((n: number) => Number.isFinite(n));
      }
    }
  } catch {}

  // IMPORTANT: default/fallback role if missing
  const roleKey = String(commissionRole || "").toLowerCase();

  // IMPORTANT: fallback PS if scope list is empty (same idea as PDF)
  if ((!commissionPs || !commissionPs.length) && emp?.PS != null) {
    const ps = Number(emp.PS);
    if (Number.isFinite(ps)) commissionPs = [ps];
  }

  const rates = getRoleRates(roleKey);

  return {
    sellerUserId,
    roleKey,
    commissionPs,
    goldRate: rates.goldRate,
    diamondPct: rates.diamondPct,
  };
};

const computeCommissionFromInvoicesLikePdf = (emp: any, profile: any, rowsAll: any[]) => {
  const sellerUserId = profile.sellerUserId;
  const roleKey = profile.roleKey;
  const goldRate = profile.goldRate;
  const diamondPct = profile.diamondPct;

  let salesGoldLyd = 0,
    salesGoldUsd = 0,
    salesDiamondLyd = 0,
    salesDiamondUsd = 0;

  let goldGramsSelf = 0;
  let goldGramsScope = 0;

  let diamondSelfLyd = 0,
    diamondSelfUsd = 0;

  let diamondItems = 0;

  if (sellerUserId != null) {
    const filtered = (rowsAll || []).filter((row: any) => {
      const uid = Number(row?.Utilisateur?.id_user ?? row?.user_id ?? NaN);
      return Number.isFinite(uid) && uid === Number(sellerUserId);
    });

    for (const row of filtered) {
      const typeRaw = String(row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || "").toLowerCase();
      const lyd = safeNum(row?.amount_lyd);
      const usd = safeNum(row?.amount_currency);

      if (typeRaw.includes("gold")) {
        salesGoldLyd += lyd;
        salesGoldUsd += usd;

        const achats = Array.isArray(row?.ACHATs) ? row.ACHATs : [];
        for (const a of achats) {
          const st = String(a?.Fournisseur?.TYPE_SUPPLIER || "").toLowerCase();
          if (st.includes("gold")) goldGramsSelf += safeNum(a?.qty);
        }
      } else if (typeRaw.includes("diamond")) {
        salesDiamondLyd += lyd;
        salesDiamondUsd += usd;

        diamondSelfLyd += lyd;
        diamondSelfUsd += usd;

        const achats = Array.isArray(row?.ACHATs) ? row.ACHATs : [];
        for (const a of achats) {
          const st = String(a?.Fournisseur?.TYPE_SUPPLIER || "").toLowerCase();
          if (st.includes("diamond")) {
            const q = safeNum(a?.qty ?? 1);
            diamondItems += Number.isFinite(q) && q > 0 ? q : 1;
          }
        }
      }
    }

    // lead/manager PS scope grams (same logic as PDF)
    const targetPs: number[] = Array.isArray(profile.commissionPs) ? profile.commissionPs : [];
    if ((roleKey === "sales_lead" || roleKey === "sales_manager") && targetPs.length > 0) {
      for (const row of rowsAll || []) {
        const psVal = Number(row?.ps ?? row?.PS ?? NaN);
        if (!Number.isFinite(psVal) || !targetPs.includes(psVal)) continue;

        const achats = Array.isArray(row?.ACHATs) ? row.ACHATs : [];
        for (const a of achats) {
          const st = String(a?.Fournisseur?.TYPE_SUPPLIER || "").toLowerCase();
          if (st.includes("gold")) goldGramsScope += safeNum(a?.qty);
        }
      }
    }
  }

  const goldGramsUsed =
    roleKey === "sales_lead" || roleKey === "sales_manager" ? goldGramsScope : goldGramsSelf;

  const goldBonusLyd = !goldRate ? 0 : Number((goldGramsUsed * goldRate).toFixed(2));
  const goldBonusUsd = 0;

  const diamondBonusLyd = !diamondPct ? 0 : Number(((diamondSelfLyd * diamondPct) / 100).toFixed(2));
  const diamondBonusUsd = !diamondPct ? 0 : Number(((diamondSelfUsd * diamondPct) / 100).toFixed(2));

  const result: CommissionResult = {
    sellerUserId,
    roleKey,
    commissionPs: profile.commissionPs,
    goldRate,
    diamondPct,

    goldGramsSelf,
    goldGramsScope,
    goldGramsUsed,
    goldBonusLyd,
    goldBonusUsd,

    diamondSelfLyd,
    diamondSelfUsd,
    diamondItems,
    diamondBonusLyd,
    diamondBonusUsd,

    salesGoldLyd,
    salesGoldUsd,
    salesDiamondLyd,
    salesDiamondUsd,
  };

  return result;
};

const [commissionMapUI, setCommissionMapUI] = React.useState<Record<number, CommissionResult>>({});
const [commissionLoadingUI, setCommissionLoadingUI] = React.useState(false);

React.useEffect(() => {
  let cancelled = false;

  const run = async () => {
    try {
      const list = (displayedRows || []).map((x: any) => Number(x.id_emp)).filter(Boolean);
      if (!list.length) {
        setCommissionMapUI({});
        return;
      }

      setCommissionLoadingUI(true);

      const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
      const monthStartISO = dayjs(periodStart).format("YYYY-MM-DD");
      const monthEndISO = dayjs(periodStart).endOf("month").format("YYYY-MM-DD");
      const qs = new URLSearchParams({ from: monthStartISO, to: monthEndISO }).toString();

      const invRes = await fetch(`http://localhost:9000/api/invoices/allDetailsP?${qs}`, {
        headers: authHeader() as unknown as HeadersInit,
      });

      const invJson = invRes.ok ? await invRes.json() : [];
      const rowsAll: any[] = Array.isArray(invJson) ? invJson : [];

      const results: Record<number, CommissionResult> = {};

      await Promise.all(
        (displayedRows || []).map(async (emp: any) => {
          const empId = Number(emp.id_emp);
          if (!empId) return;

          let empObj: any = null;
          try {
            const r = await fetch(`http://localhost:9000/api/employees/${empId}`, {
              headers: authHeader() as unknown as HeadersInit,
            });
            if (r.ok) {
              const payload = await r.json();
              empObj = payload?.data ?? payload;
            }
          } catch {}

          const profile = parseEmployeeCommissionProfile(empObj || {}, emp);
          results[empId] = computeCommissionFromInvoicesLikePdf(emp, profile, rowsAll);
        })
      );

      if (!cancelled) setCommissionMapUI(results);
    } finally {
      if (!cancelled) setCommissionLoadingUI(false);
    }
  };

  run();

  return () => {
    cancelled = true;
  };
}, [year, month, displayedRows]);

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
      absenceLyd: 0,
      absenceUsd: 0,
      latencyLyd: 0,
      latencyUsd: 0,
      latencyMinutes: 0,
    };
    displayedRows.forEach(e => {
      const id = Number(e.id_emp);
      t.workingDays += Number(e.workingDays || 0);
      const vr = (v2Rows||[]).find((x:any)=> Number(x.id_emp)===Number(e.id_emp)) || {} as any;
      t.deductionDays += Number(vr.absence_days || 0);
      t.holidayWorked += Number(e.holidayWorked || 0);
      t.baseSalary += Number(e.baseSalary || 0);
      t.baseSalaryUsd += Number((e as any).baseSalaryUsd || 0);
      t.base += 0;
      t.allow += 0;
      const fuelPer = Number(((e as any).FUEL ?? vr.FUEL) || 0);
      const commPer = Number(((e as any).COMMUNICATION ?? vr.COMMUNICATION) || 0);

      // FOOD is per working day * present days (keep this)
      const pd = Number(presentDaysMap[e.id_emp] || 0);
      const foodPer = Number((e as any).FOOD || (e as any).FOOD_ALLOWANCE || 0);
      t.food += foodPer * pd;

      // FUEL & COMM are per month (NO * W)
      t.fuel += fuelPer;
      t.comm += commPer;

      t.food += foodPer * pd;
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
      t.totalLyd += computeNetLYDFor(e.id_emp);
      t.totalUsd += computeNetUSDFor(e.id_emp);
      const pp = computePPhPhf(e);
      t.pLyd += pp.pLyd;
      t.pUsd += pp.pUsd;
      t.phLyd += pp.phLyd;
      t.phUsd += pp.phUsd;
      t.phfLyd += pp.phfLyd;
      t.phfUsd += pp.phfUsd;
      t.absenceLyd += Number(vr.absence_lyd || 0);
      t.absenceUsd += Number(vr.absence_usd || 0);
      t.latencyLyd += Number(vr.missing_lyd || vr.latency_lyd || 0);
      t.latencyUsd += Number(vr.missing_usd || vr.latency_usd || 0);

      // Latency minutes for totals row: use backend attendance minutes so
      // that the displayed hours match the monetary latency_lyd value.
      const backendLatMin =
        Number((vr as any).latencyMinutes ?? (vr as any).missing_minutes ?? tsAgg?.[id]?.displayMissingMinutes ?? 0) || 0;
      t.latencyMinutes += backendLatMin;
    });
    return t;
  }, [displayedRows, v2Rows]);

  const onRun = async () => {
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      // Always compute fresh for active employees (ignore any saved data)
      const v2 = await computePayrollV2({ year, month });
      const rawRows = Array.isArray(v2.rows) ? v2.rows : [];
      let normalizedRows: any[] = rawRows;
      
      // Persist computed rows for this open month so backend tables stay in sync
      try {
        if (!v2.viewOnly && Array.isArray(v2.rows) && v2.rows.length) {
          await savePayrollV2({ year: v2.year, month: v2.month, rows: v2.rows });
        }
      } catch {}
      const start = `${v2.year}-${String(v2.month).padStart(2,'0')}-01`;
      const end = `${v2.year}-${String(v2.month).padStart(2,'0')}-${String(new Date(v2.year, v2.month, 0).getDate()).padStart(2,'0')}`;
      // Load employee allowances (FUEL, COMMUNICATION) once and index by id
      let allowMap: Record<number, { fuel: number; comm: number }> = {};
      const fingerprintMap: Record<number, boolean> = {};
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
            const fpRaw = extractFingerprintRaw(e);
            const fpBool = parseLooseBoolean(fpRaw);
            if (fpBool !== undefined) fingerprintMap[id] = fpBool;
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
        setFingerprintRequiredMap(fingerprintMap);
        normalizedRows = rawRows.map((row: any) => {
          const id = Number(row?.id_emp ?? row?.ID_EMP ?? row?.ID);
          const fpOn = fingerprintMap[id] ?? true;
          return normalizeFingerprintPayrollRow(row, fpOn);
        });
      } catch {}
      setV2Rows(normalizedRows);
      setViewOnly(!!v2.viewOnly);
      const employees: Payslip[] = normalizedRows.map((r: any) => {
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
        const fingerprintTracked = fingerprintMap[idEmpNum] ?? true;
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
          fingerprintTracked,
        } as Payslip;
      });
      // Fallback fetch per-employee allowances if missing
      try {
        await Promise.all(employees.map(async (empRow) => {
          const hasFuel = Number((empRow as any).FUEL || 0) > 0;
          const hasComm = Number((empRow as any).COMMUNICATION || 0) > 0;
          if (!hasFuel || !hasComm) {
            try {
              const res = await fetch(`http://localhost:9000/api/employees/${empRow.id_emp}`, { headers: authHeader() as unknown as HeadersInit });
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
        const advEntries: Record<number, number> = {};
        const adjTotals: Record<number, { earnLyd: number; earnUsd: number; dedLyd: number; dedUsd: number }> = {};
        await Promise.all(employees.map(async (e) => {
          let earnLyd = 0;
          let earnUsd = 0;
          let dedLyd = 0;
          let dedUsd = 0;
          let advSum = 0;
          try {
            const url = `http://localhost:9000/api/hr/payroll/adjustments?year=${v2.year}&month=${v2.month}&employeeId=${e.id_emp}`;
            const res = await fetch(url, { headers: authHeader() as unknown as HeadersInit });
            if (res.ok) {
              const js = await res.json();
              const arr = (js?.data?.[String(e.id_emp)] || []) as Array<{ type: string; amount: number; currency?: string }>;
              for (const row of arr || []) {
                const amt = Number(row?.amount || 0);
                if (!amt) continue;
                const cur = String(row?.currency || 'LYD').toUpperCase();
                const isUsd = cur === 'USD';
                const type = String(row?.type || '').toLowerCase();
                if (type === 'advance') {
                  if (!isUsd) advSum += amt;
                  continue;
                }
                if (type === 'deduction') {
                  if (isUsd) dedUsd += amt; else dedLyd += amt;
                } else {
                  if (isUsd) earnUsd += amt; else earnLyd += amt;
                }
              }
            }
          } catch {}
          advEntries[e.id_emp] = Number(advSum.toFixed(2));
          adjTotals[e.id_emp] = {
            earnLyd: Number(earnLyd.toFixed(2)),
            earnUsd: Number(earnUsd.toFixed(2)),
            dedLyd: Number(dedLyd.toFixed(2)),
            dedUsd: Number(dedUsd.toFixed(2)),
          };
        }));
        setAdvMap(advEntries);
        setAdjSumsByEmp(adjTotals);
      } catch {}

      // Build per-employee timesheet aggregates used by UI to mirror PDF calculations
      try {
        const agg: Record<number, { presentP: number; presentStrict: number; phUnits: number; fridayA: number; missRatio: number; phFullDays: number; phPartDays: number; absenceDays: number; missingMinutes: number; leaveUnits: number; foodEligibleNonFpDays: number; displayMissingMinutes: number }> = {};
        await Promise.all(
          employees.map(async (e) => {
            try {
              const days = await ensureTimesheetDays(e.id_emp);

              const vr =
                normalizedRows.find((x: any) => Number(x.id_emp) === Number(e.id_emp)) ||
                {};

              const pick = (s: any): number | null => {
                if (!s) return null;
                const m = String(s).match(/(\d{1,2}):(\d{2})/);
                if (!m) return null;
                const hh = Number(m[1]);
                const mm = Number(m[2]);
                if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
                return hh * 60 + mm;
              };

              const schStartMin = pick(
                (vr as any).T_START ||
                  (vr as any).t_start ||
                  (vr as any).SCHEDULE_START ||
                  (vr as any).shift_start
              );

              const schEndMin = pick(
                (vr as any).T_END ||
                  (vr as any).t_end ||
                  (vr as any).SCHEDULE_END ||
                  (vr as any).shift_end
              );

              let presentP = 0,
                presentStrict = 0,
                phUnits = 0,
                fridayA = 0,
                missAll = 0,
                missDisplay = 0,
                missNoPT = 0,
                phFullDays = 0,
                phPartDays = 0,
                absenceDays = 0,
                leaveUnits = 0,
                foodEligibleNonFpDays = 0;

              for (let i = 0; i < days.length; i++) {
                const d: any = days[i];

                const c = codeBadge(d, schStartMin ?? undefined, schEndMin ?? undefined, e.id_emp);

                // Presence counts
                if (c === "P" || c === "PH" || c === "PHF") presentP += 1;
                if (c === "P") presentStrict += 1;

                // Holiday units
                if (c === "PHF") {
                  phUnits += 2;
                  phFullDays += 1;
                } else if (c === "PH") {
                  phUnits += 1;
                  phPartDays += 1;
                }

                // Count absence days matching backend logic:
                // A and UL = 1 day, HL = 0.5 day
                // Only count on working days (not Fridays)
                const dayDate = dayjs(
                  `${v2.year}-${String(v2.month).padStart(2, "0")}-01`
                ).date(i + 1);
                const isFriday = dayDate.day() === 5;
                if (!isFriday) {
                  if (c === "A" || c === "UL") {
                    absenceDays += 1;
                  } else if (c === "HL") {
                    absenceDays += 0.5;
                  }
                }

                // Friday absent count (kept)
                if (dayDate.day() === 5 && c === "A") fridayA += 1;

                if (LEAVE_FULL_CODES.has(c)) {
                  leaveUnits += 1;
                } else if (LEAVE_HALF_CODES.has(c)) {
                  leaveUnits += 0.5;
                }

                if (!isFriday) {
                  const isLeave = LEAVE_FULL_CODES.has(c) || LEAVE_HALF_CODES.has(c);
                  if (!isLeave) foodEligibleNonFpDays += 1;
                }

                // Existing delta stats
                const dm = Number(d?.deltaMin || 0);
                if (dm < 0) {
                  const abs = Math.abs(dm);
                  missAll += abs;
                  if (abs > 30) missDisplay += abs;
                  if (c !== "PT") missNoPT += abs;
                }
              }

              const missRatio = missAll > 0 ? missNoPT / missAll : 0;

              agg[e.id_emp] = {
                presentP,
                presentStrict,
                phUnits,
                fridayA,
                missRatio,
                phFullDays,
                phPartDays,
                absenceDays,
                // Missing minutes from timesheet (sum of negative deltaMin)
                missingMinutes: missAll,
                leaveUnits,
                foodEligibleNonFpDays,
                displayMissingMinutes: missDisplay,
              };
            } catch {
              // ignore per-employee errors
            }
          })
        );

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

    let empProfile: any | null = null;

    // Ensure holidays are available even if the page-level useEffect hasn't finished yet.
    const holidaySetLocal = new Set<string>(Array.from(holidaySet || []));
    try {
      const from = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('YYYY-MM-DD');
      const to = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).endOf('month').format('YYYY-MM-DD');
      const holidaysResp = await getHolidays({ startDate: from, endDate: to });
      const holidaysArr = Array.isArray(holidaysResp)
        ? holidaysResp
        : (holidaysResp as any)?.data || [];
      (holidaysArr || []).forEach((h: any) => {
        const iso = safeISO10(h.DATE_H ?? h.date ?? h.holiday_date);
        if (iso) holidaySetLocal.add(iso);
      });
    } catch {}

    // Also merge locally stored holidays (same behavior as UI loadHolidays)
    try {
      const raw = localStorage.getItem('custom_holidays');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach((h: any) => {
            const iso = safeISO10(h.DATE_H ?? h.date ?? h.holiday_date);
            if (iso) holidaySetLocal.add(iso);
          });
        }
      }
    } catch {}

    let vacations: VacationRecord[] = [];
    try {
      const from = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('YYYY-MM-DD');
      const to = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).endOf('month').format('YYYY-MM-DD');
      const all = await getVacationsInRange(from, to);
      vacations = (all || []).filter((v: VacationRecord) => Number(v.id_emp) === Number(emp.id_emp));
    } catch {
      vacations = [];
    }

    let leaveRequests: any[] = [];
    try {
      const requests = await getLeaveRequests(String(emp.id_emp));
      leaveRequests = Array.isArray(requests) ? requests : [];
    } catch (e) {
      console.error('Failed to load leave requests for PDF:', e);
    }

    const getLeaveCodeForDate = (
      dayDate: Date,
      opts?: { ymd?: string; isHolidayOrFri?: boolean }
    ): string | null => {
      dayDate.setHours(0, 0, 0, 0);
      const knownCodes = ['P','A','PT','PL','PH','PHF','AL','SL','EL','ML','UL','HL','BM','XL','B1','B2','NI','NO','MO','IP','LI','EO','W','H','PP'];
      const ymd = opts?.ymd || dayjs(dayDate).format('YYYY-MM-DD');
      const isHolidayOrFri = Boolean(opts?.isHolidayOrFri);
      
      for (const leave of leaveRequests) {
        const status = String(leave.status || leave.state || '').toLowerCase();
        if (!status.includes('approved') && !status.includes('موافق') && !status.includes('accepted')) continue;
        
        const st = leave.startDate || leave.DATE_START || leave.date_depart;
        const en = leave.endDate || leave.DATE_END || leave.date_end;
        if (!st || !en) continue;
        
        const stYmd = safeISO10(st);
        const enYmd = safeISO10(en);
        if (!stYmd || !enYmd) continue;

        // Check if current day is within leave period (timezone-safe)
        if (ymd >= stYmd && ymd <= enYmd) {
          // Determine leave code first
          let leaveCode = '';
          
          // 1. Direct code field
          const directCode = String(leave.code || leave.leaveType || leave.leaveTypeCode || '').toUpperCase();
          if (directCode && knownCodes.includes(directCode)) {
            leaveCode = directCode;
          } else {
            // 2. Look up by id_can in leaveTypeMap
            const idCan = leave.id_can ?? leave.typeCode ?? leave.leaveCode;
            if (idCan != null) {
              const lt = leaveTypeMap[String(idCan)];
              if (lt?.code) {
                const ltCode = lt.code.toUpperCase();
                if (knownCodes.includes(ltCode)) leaveCode = ltCode;
              }
            }
          }
          
          // 3. Check leave type name for keywords if no code yet
          if (!leaveCode) {
            const typeName = String(leave.typeName || leave.leaveTypeName || leave.type || '').toUpperCase();
            if (typeName.includes('ANNUAL') || typeName.includes('سنوي')) leaveCode = 'AL';
            else if (typeName.includes('SICK') || typeName.includes('مرض')) leaveCode = 'SL';
            else if (typeName.includes('EMERGENCY') || typeName.includes('طارئ')) leaveCode = 'EL';
            else if (typeName.includes('MATERNITY') || typeName.includes('أمومة')) leaveCode = 'ML';
            else if (typeName.includes('UNPAID') || typeName.includes('بدون')) leaveCode = 'UL';
            else if (typeName.includes('HALF')) leaveCode = 'HL';
            else if (typeName.includes('BEREAVEMENT') || typeName.includes('عزاء')) leaveCode = 'BM';
            else if (typeName.includes('EXAM') || typeName.includes('امتحان')) leaveCode = 'XL';
            else if (directCode && directCode.length <= 3) leaveCode = directCode;
            else leaveCode = 'AL'; // Fallback
          }

          // Do NOT show non-sick leave codes on public holidays / Fridays.
          // Those days should appear as holidays (H/PH/PHF), not AL, in the PDF grid.
          const up = String(leaveCode || '').toUpperCase();
          const isSick = up === 'SL';
          if (!isSick && isHolidayOrFri) continue;

          return up;
        }
      }
      return null;
    };

    const codeBadgePDF = (day: any, idx: number, schStartMin?: number | null, schEndMin?: number | null): string => {
      // IMPORTANT:
      // - We must still show Leave/Holiday codes even if there is no timesheet day record.
      // - We must NOT auto-mark missing records as Absent.
      const dayDate = dayjs(periodStart).date(idx + 1).toDate();
      const ymd = dayjs(periodStart).date(idx + 1).format('YYYY-MM-DD');
      const isFri = dayjs(dayDate).day() === 5;
      const rawCode = String(day?.code || day?.badge || '').toUpperCase();
      const isHolidayByDay =
        (holidaySetLocal?.has(ymd) || false) ||
        !!day?.isHoliday ||
        /holiday/i.test(String(day?.type || day?.reason || '')) ||
        rawCode === 'PH' ||
        rawCode === 'PHF';
      const isHolidayOrFri = isHolidayByDay || isFri;

      const normalizeNonSickLeaveOnNonWorking = (codeIn: string, present: boolean): string => {
        const up = String(codeIn || '').toUpperCase();
        const nonSickLeave = ['AL','EL','ML','UL','HL','BM','XL','B1','B2'].includes(up);
        if (!nonSickLeave) return up;
        if (isFri) return '';
        if (isHolidayByDay) return present ? 'PH' : 'H';
        return up;
      };

      // PRIORITY 1: Approved leave override (even if there is no day record)
      // Important: never allow leave (AL/...) to overwrite holidays or Fridays (except SL).
      const leaveCode = getLeaveCodeForDate(dayDate, { ymd, isHolidayOrFri });
      if (leaveCode) return normalizeNonSickLeaveOnNonWorking(leaveCode, !!day?.present);

      // PRIORITY 2: Backend-provided code (only if day record exists)
      if (rawCode) {
        // Only accept attendance/exception codes from the day record.
        // Never accept leave codes here (AL/SL/...) because it causes the PDF to extend leave
        const allowedDayCodes = ['P','A','PT','PL','PH','PHF','NI','NO','MO','IP','LI','EO','W','PP'];
        if (allowedDayCodes.includes(rawCode)) return rawCode;
      }

      // PRIORITY 3: Check vacation records
      try {
        const ymd2 = dayjs(dayDate).format('YYYY-MM-DD');
        const vac = (vacations || []).find((v) => {
          const st = safeISO10((v as any).date_depart);
          const en = safeISO10((v as any).date_end);
          const stateLower = String((v as any).state || '').toLowerCase();
          const okState = stateLower === 'approved' || stateLower.includes('موافق');
          return okState && ymd2 >= st && ymd2 <= en;
        });
        if (vac) {
          const idKey = (vac as any).id_can != null ? String((vac as any).id_can) : undefined;
          const lt = idKey ? leaveTypeMap[idKey] : undefined;
          const codeRaw = String(lt?.code || (vac as any).type || 'V').toUpperCase();
          if (codeRaw) return normalizeNonSickLeaveOnNonWorking(codeRaw, !!day?.present);
        }
      } catch {}
      
      // PRIORITY 4: Derive from timesheet data (fallback)
      const isHoliday = isHolidayByDay;
      if (!day) {
        // If there's no timesheet record, still show holiday on the calendar if applicable.
        // Mark as generic holiday 'H' so we can style it distinctly (crossed-out beige cell).
        return isHoliday ? 'H' : '';
      }

      const present = !!day.present;
      
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
      const tol = 5;
      
      if (!present) {
        if (isFri) return '';
        if (isHoliday) return 'H';
        return 'A';
      }
      if (isHoliday) {
        return (worked >= Math.max(0, expDur - tol)) ? 'PHF' : 'PH';
      }
      if (late > tol) return 'PL';
      if (miss > tol) return 'PT';
      return normalizeNonSickLeaveOnNonWorking('P', true);
    };


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
      const resTitle = await fetch(`http://localhost:9000/api/employees/${emp.id_emp}`, { headers: authHeader() as unknown as HeadersInit });
      if (resTitle.ok) {
        const payload = await resTitle.json();
        const obj = payload?.data ?? payload;
        empProfile = obj;
        const t = String(obj?.TITLE || obj?.title || '').trim();
        if (t) roleStr = t;
      }
    } catch {}
    const psTxt = emp?.PS != null ? (formatPs((v2 as any)?.ps ?? emp.PS) || String(emp.PS)) : '-';
    const branchMap: Record<string, string> = { P1: 'Jraba Mall', P2: 'Jraba Main', P3: 'Ben Ashour', P4: 'HQ', P0: 'Headquarters' };
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
    const areaPre = pageW - margin * 2;
    const tX = margin; // left table x matches earnings block
    const tY = headerH + 10;
    const rowH = 22;

    // Single rounded box with three columns (Name/ID, Position/PS, Leave Bal)
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
    // Inner grid lines (3 columns, 2 rows) with width ratios for better spacing
    const colFractions = [0.36, 0.32, 0.32];
    const colWidths = colFractions.map((frac) => boxW * frac);
    const colEdges: number[] = [];
    {
      let acc = boxX;
      for (let i = 0; i < colWidths.length; i++) {
        colEdges.push(acc);
        acc += colWidths[i];
      }
      colEdges.push(boxX + boxW);
    }
    try {
      doc.setDrawColor('#bbbbbb');
      for (let i = 1; i < colEdges.length - 1; i++) {
        const x = colEdges[i];
        doc.line(x, boxY, x, boxY + boxH);
      }
      doc.line(boxX, boxY + rowH, boxX + boxW, boxY + rowH);
    } catch {}
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);

    let leaveBalanceRemaining = 0;
    try {
      // Use backend API which now includes carry-forward calculation
      const leaveData = await getLeaveBalance(String(emp.id_emp));
      
      // Backend now returns: remaining (with carry-forward), accruedToDate, carryForward, currentYearAccrued
      leaveBalanceRemaining = Number(
        (leaveData as any)?.remaining ??
          (leaveData as any)?.data?.remaining ??
          (leaveData as any)?.balance?.remaining ??
          0
      );
      
      // Fallback to 0 if negative (shouldn't happen with proper backend)
      leaveBalanceRemaining = Math.max(0, leaveBalanceRemaining);
    } catch (err) {
      console.error('Failed to fetch leave balance for PDF:', err);
    }

    const fmtDays = (val: number) => `${(Number.isFinite(val) ? val : 0).toFixed(2)} Days`;
    const leaveBalanceAsOf = dayjs(periodStart).format('MMMM YYYY');

    const col1: Array<[string,string]> = [
      ['Name', String(dispName || '')],
      ['ID', String(emp.id_emp || '')],
    ];
    const col2: Array<[string,string]> = [
      ['Position', roleStr || '-'],
      ['PS', String(psTxt || '-')],
    ];

    let seniorityYears = 0;
    let seniorityMonths = 0;
    let contractStartLabel = '';
    try {
      const contractStartStr = contractStartMap[emp.id_emp] || (v2 as any).CONTRACT_START || null;
      if (contractStartStr) {
        const contractStart = dayjs(contractStartStr);
        if (contractStart.isValid()) {
          const now = dayjs();
          seniorityYears = now.diff(contractStart, 'years');
          seniorityMonths = now.diff(contractStart.add(seniorityYears, 'years'), 'months');
          // Seniority display: show only the start date in DD-MM-YYYY
          contractStartLabel = contractStart.format('DD-MM-YYYY');
        }
      }
    } catch (e) {
      console.warn('Could not calculate seniority:', e);
    }

    const col3: Array<[string,string]> = [
      ['Seniority:', contractStartLabel],
      ['Vacation Balance:', fmtDays(leaveBalanceRemaining)],
    ];
    const colsData = [col1, col2, col3];

    const drawValueText = async (text: string, x: number, y: number, maxWidth: number) => {
      const v = text || '';
      if (!v) return;
      if (hasArabic(v)) {
        const img = await drawArabicTextImage(v, 10);
        if (img) {
          doc.addImage(img.dataUrl, 'PNG', x, y - 10, Math.min(img.wPt, maxWidth), img.hPt);
          return;
        }
      }
      const lines = doc.splitTextToSize(v, maxWidth);
      doc.text(lines, x, y);
    };

    for (let colIdx = 0; colIdx < colsData.length; colIdx++) {
      const entries = colsData[colIdx];
      const cellX = colEdges[colIdx];
      const cellW = colWidths[colIdx] ?? (boxW / colsData.length);

      doc.setFont('helvetica', 'normal');
      const labelMaxW = Math.max(
        0,
        ...entries.map((e) => {
          const lab = String(e?.[0] || '');
          return lab ? doc.getTextWidth(lab) : 0;
        })
      );
      const valueX = cellX + Math.min(cellW - 12, Math.max(60, labelMaxW + 10));
      const valueMaxW = Math.max(10, cellW - (valueX - cellX) - 6);

      for (let rowIdx = 0; rowIdx < entries.length; rowIdx++) {
        const lab = entries[rowIdx][0];
        const val = entries[rowIdx][1] || '';
        const cellY = boxY + rowIdx * rowH;
        const labelY = cellY + 11;
        doc.setFont('helvetica', 'normal');
        if (lab) doc.text(lab, cellX + 6, labelY);
        doc.setFont('helvetica', 'bold');
        if (val) {
          await drawValueText(val, valueX, labelY, valueMaxW);
        }
        doc.setFont('helvetica', 'normal');
      }
    }

    infoBottomYCalc = boxY + boxH;
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
  const csStr = (v2 as any).CONTRACT_START || (v2 as any).contract_start || (v2 as any).contractStart || (v2 as any).T_START;
  const contractStart = csStr ? dayjs(csStr) : null;
  let latencyMinutesPdf = Math.max(0, Number((v2 as any).missing_minutes ?? (v2 as any).latencyMinutes ?? 0) || 0);

  const latencyHoursPdf = latencyMinutesPdf / 60;
  const missH = Math.floor(latencyHoursPdf);
  const missM = Math.floor((latencyHoursPdf % 1) * 60);
  const missStr = latencyMinutesPdf > 0 ? `${missH}h ${missM}m` : '';

  // Latency LYD/USD for PDF: use backend-calculated values (legacy engine)
  const latLydPdf = Math.max(0, Number((v2 as any).missing_lyd || (v2 as any).latency_lyd || 0));
  const latUsdPdf = Math.max(0, Number((v2 as any).missing_usd || (v2 as any).latency_usd || 0));
  const bv = (n:any)=>Number(n||0);
  const fmt = (n:number)=> n ? n.toLocaleString(undefined,{maximumFractionDigits:2}) : '';
  // Food allowance present-days should NOT include PH/PHF; count only actual present 'P'
  const foodInfoPDF = computeFoodAllowance(emp, v2);
  const foodLydAdjPDF = foodInfoPDF.allowance;
  // PH fallback: if v2 lacks ph amounts, compute daily pay: PHF=2x, PH=1x
  // Travel/Communication allowances from Employee Profile (flat monthly amounts)
  let fuelMonthlyPDF = Number(((emp as any).FUEL ?? (v2 as any).FUEL) || 0);
  let commMonthlyPDF = Number(((emp as any).COMMUNICATION ?? (v2 as any).COMMUNICATION) || 0);
  if (!fuelMonthlyPDF && !commMonthlyPDF) {
    try {
      const resEmp = await fetch(`http://localhost:9000/api/employees/${emp.id_emp}`, { headers: authHeader() as unknown as HeadersInit });
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
  const absenceDaysPDF = Number((v2 as any).absence_days ?? 0) || 0;

  // Fetch this month's Salary Advances total for this employee (to deduct from Net Pay)
  let advSumLYD = 0;
  try {
    const adjUrlSum = `http://localhost:9000/api/hr/payroll/adjustments?year=${year}&month=${month}&employeeId=${emp.id_emp}`;
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
    const resEmp = await fetch(`http://localhost:9000/api/employees/${emp.id_emp}`, { headers: authHeader() as unknown as HeadersInit });
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
      const r = await fetch(`http://localhost:9000/api/invoices/allDetailsP?${qs}`, { headers: authHeader() as unknown as HeadersInit });
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

  // Will be filled from Reimbursements API (adjRowsPdf) later in this function
  let adjEarnRowsPdf: Array<{ label: string; lyd: number; usd: number; type?: string }> = [];
  let adjDedRowsPdf: Array<{ label: string; lyd: number; usd: number; type?: string }> = [];
  
  // Breakdown table driven directly from V2 fields (for the small summary box)
  const breakdown: Array<{label:string; lyd:number; usd:number}> = [
    { label: 'Basic Salary', lyd: bv(v2.base_salary_lyd), usd: bv(v2.base_salary_usd) },
    { label: 'Food Allowance', lyd: foodLydAdjPDF, usd: 0 },
    { label: 'Absence', lyd: bv(v2.absence_lyd), usd: bv(v2.absence_usd) },
    { label: 'Paid Holiday', lyd: bv(v2.ph_lyd), usd: bv(v2.ph_usd) },
    { label: 'Latency', lyd: latLydPdf, usd: latUsdPdf },
    { label: 'Total Salary', lyd: bv(v2.total_salary_lyd ?? v2.D7), usd: bv(v2.total_salary_usd ?? v2.C7) },
    { label: 'Gold Bonus', lyd: bv(v2.gold_bonus_lyd), usd: bv(v2.gold_bonus_usd) },
    { label: 'Diamond Bonus', lyd: bv(v2.diamond_bonus_lyd), usd: bv(v2.diamond_bonus_usd) },
    // Map V2 bonus fields to specific adjustment names
    { label: 'Eid Bonus', lyd: bv(v2.other_bonus1_lyd), usd: bv(v2.other_bonus1_usd) },
    { label: 'Ramadan Bonus', lyd: bv(v2.other_bonus2_lyd), usd: bv(v2.other_bonus2_usd) },
    { label: 'Bonus Adjustments', lyd: bv(v2.other_additions_lyd), usd: bv(v2.other_additions_usd) },
    { label: 'Deductions (Adjustments)', lyd: bv(v2.other_deductions_lyd), usd: bv(v2.other_deductions_usd) },
    { label: 'Loan Debit', lyd: bv(v2.loan_debit_lyd), usd: bv(v2.loan_debit_usd) },
    { label: 'Loan Credit', lyd: bv(v2.loan_credit_lyd), usd: bv(v2.loan_credit_usd) },
  ];
  
  let brShowLyd = Number(v2.base_salary_lyd || 0) > 0;
  let brShowUsd = Number(v2.base_salary_usd || 0) > 0;
  if (!brShowLyd && !brShowUsd) brShowLyd = true;

  const rows = breakdown.filter(r => (
    (brShowLyd && Number(r.lyd || 0) > 0) || (brShowUsd && Number(r.usd || 0) > 0)
  ));

  // --- Load period adjustments for this employee and map into earnings/deductions rows ---
  let adjRowsPdf: Array<{ type: string; label?: string; direction?: string; amount: number; currency: string; note?: string; ts?: string }> = [];
  try {
    const url = `http://localhost:9000/api/hr/payroll/adjustments?year=${year}&month=${month}&employeeId=${emp.id_emp}`;
    const res = await fetch(url, { headers: authHeader() as unknown as HeadersInit });
    if (res.ok) {
      const js = await res.json();
      adjRowsPdf = (js?.data?.[String(emp.id_emp)] || []) as Array<{ type: string; label?: string; direction?: string; amount: number; currency: string; note?: string; ts?: string }>;
    }
  } catch {}

  // Filter out zero-amount adjustments
  adjRowsPdf = (adjRowsPdf || []).filter((r) => Number(r.amount || 0) !== 0);

  // Map adjustments into earnings/deductions rows for the Earnings/Deductions tables
  adjEarnRowsPdf = [];
  adjDedRowsPdf = [];
  const mapAdjLabel = (type: string): string => {
    const t = type.toLowerCase();
    if (t === 'eid_bonus') return 'Eid Bonus';
    if (t === 'ramadan_bonus') return 'Ramadan Bonus';
    if (t === 'bonus') return 'Bonus';
    if (t === 'deduction') return 'Deduction';
    return type || 'Adjustment';
  };
  (adjRowsPdf || []).forEach((r) => {
    if (!r) return;
    const amt = Number(r.amount || 0);
    if (!amt) return;
    const cur = String(r.currency || 'LYD').toUpperCase();
    const isUsd = cur === 'USD';
    const lyd = isUsd ? 0 : amt;
    const usd = isUsd ? amt : 0;
    const t = String(r.type || '').toLowerCase();
    // Salary advances are rendered separately as a deduction row (advSumLYD).
    // Exclude them here to avoid showing in Earnings and double counting.
    if (t === 'advance') return;
    const dir = String((r as any).direction || '').toUpperCase();
    const isDirDeduct = dir === 'DEDUCT';
    const label = String((r as any).label || '').trim() || mapAdjLabel(String(r.type || ''));
    if (isDirDeduct || t === 'deduction') {
      adjDedRowsPdf.push({ label, lyd, usd, type: String(r.type || '') });
    } else {
      // Treat all non-deduction types as earnings adjustments
      adjEarnRowsPdf.push({ label, lyd, usd, type: String(r.type || '') });
    }
  });

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
  const hasUsd = usdCandidates.some(k => (v2 as any)[k] !== undefined && Number((v2 as any)[k] || 0) !== 0) || (diamondBonusUSDComputed > 0) || (goldBonusUSDComputed > 0) || (adjEarnRowsPdf || []).some(r => Number(r.usd || 0) > 0.0001) || (adjDedRowsPdf || []).some(r => Number(r.usd || 0) > 0.0001);
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
    {
      const lydCenter = margin + colW - 170 + 40;
      const usdCenter = margin + colW - 90 + 40;
      const lydW = doc.getTextWidth('LYD');
      const usdW = doc.getTextWidth('USD');
      doc.text('LYD', lydCenter - lydW / 2, tblY + 16);
      doc.text('USD', usdCenter - usdW / 2, tblY + 16);
    }
  } else if (showUsdCol && !showLydCol) {
    {
      const oneCenter = margin + colW - 90 + 40;
      const w = doc.getTextWidth('USD');
      doc.text('USD', oneCenter - w / 2, tblY + 16);
    }
  } else if (showLydCol) {
    {
      const oneCenter = margin + colW - 90 + 40;
      const w = doc.getTextWidth('LYD');
      doc.text('LYD', oneCenter - w / 2, tblY + 16);
    }
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
    // Center LYD / USD amounts in their subcolumns (80px width)
    if (showLydCol && lydStr) {
      const twL = doc.getTextWidth(lydStr);
      const lydCenter = margin + colW - 170 + 40;
      doc.text(lydStr, lydCenter - twL / 2, yy + 15);
    }
    if (showUsdCol && usdStr) {
      const twU = doc.getTextWidth(usdStr);
      const usdCenter = margin + colW - 90 + 40;
      doc.text(usdStr, usdCenter - twU / 2, yy + 15);
    }
    doc.setFont('helvetica','normal');
  };
  
  let ey = tblY + 28;
  let earningsLydTotal = 0;
  let earningsUsdTotal = 0;
  {
    // Show base salary only (from v2), and food allowance + split bonuses
    const workingDaysPref = Number(emp.workingDays || (v2 as any).workingDays || 0) || 0;
    const baseLyd = Math.max(0, Number((v2 as any).base_salary_lyd || emp.baseSalary || 0));
    const baseUsd = Math.max(0, Number((v2 as any).base_salary_usd || 0));
    if (baseLyd > 0.0001 || baseUsd > 0.0001) {
      row("Base", baseLyd, baseUsd, ey);
      earningsLydTotal += baseLyd;
      earningsUsdTotal += baseUsd;
      ey += 24;
    }
    const { lyd: phLydRow, usd: phUsdRow } = getPhAmounts(emp.id_emp, { emp, v2, workingDays: workingDaysPref || emp.workingDays || 0, baseLyd: baseLyd, baseUsd: baseUsd });
    if (phLydRow > 0.0001 || phUsdRow > 0.0001) {
      row('Paid Holiday', phLydRow, phUsdRow, ey);
      earningsLydTotal += phLydRow;
      earningsUsdTotal += phUsdRow;
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
    // Earnings adjustments from Reimbursements: keep Eid Bonus separate, show Custom as separate lines, merge the rest into Bonus (LYD + USD)
    {
      let eidAdjLyd = 0;
      let eidAdjUsd = 0;

      let bonusAdjLyd = 0;
      let bonusAdjUsd = 0;
      const customEarnRows: Array<{ label: string; lyd: number; usd: number }> = [];
      (adjEarnRowsPdf || []).forEach((ar) => {
        const label = String((ar as any)?.label || '');
        const type = String((ar as any)?.type || '').toLowerCase();
        const lyd = Math.max(0, Number(ar?.lyd || 0));
        const usd = Math.max(0, Number(ar?.usd || 0));
        if (label === 'Eid Bonus' || type === 'eid_bonus') {
          eidAdjLyd += lyd;
          eidAdjUsd += usd;
          return;
        }
        if (type === 'custom') {
          customEarnRows.push({ label: label || 'Custom', lyd, usd });
          return;
        }
        bonusAdjLyd += lyd;
        bonusAdjUsd += usd;
      });
      if (eidAdjLyd > 0.0001 || eidAdjUsd > 0.0001) {
        row('Eid Bonus', eidAdjLyd, eidAdjUsd, ey);
        earningsLydTotal += eidAdjLyd;
        earningsUsdTotal += eidAdjUsd;
        ey += 24;
      }
      if (bonusAdjLyd > 0.0001 || bonusAdjUsd > 0.0001) {
        row('Bonus', bonusAdjLyd, bonusAdjUsd, ey);
        earningsLydTotal += bonusAdjLyd;
        earningsUsdTotal += bonusAdjUsd;
        ey += 24;
      }

      (customEarnRows || []).forEach((cr) => {
        if (cr.lyd > 0.0001 || cr.usd > 0.0001) {
          row(cr.label, cr.lyd, cr.usd, ey);
          earningsLydTotal += cr.lyd;
          earningsUsdTotal += cr.usd;
          ey += 24;
        }
      });
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
    {
      const lydCenter = dx + colW - 170 + 40;
      const usdCenter = dx + colW - 90 + 40;
      const lydW = doc.getTextWidth('LYD');
      const usdW = doc.getTextWidth('USD');
      doc.text('LYD', lydCenter - lydW / 2, dy + 16);
      doc.text('USD', usdCenter - usdW / 2, dy + 16);
    }
  } else if (showUsdCol && !showLydCol) {
    {
      const oneCenter = dx + colW - 90 + 40;
      const w = doc.getTextWidth('USD');
      doc.text('USD', oneCenter - w / 2, dy + 16);
    }
  } else if (showLydCol) {
    {
      const oneCenter = dx + colW - 90 + 40;
      const w = doc.getTextWidth('LYD');
      doc.text('LYD', oneCenter - w / 2, dy + 16);
    }
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
  
  let dRowsDual: Array<{label:string; lyd:number; usd:number}> = [];
  const absLyd = Math.max(0, Number((v2 as any).absence_lyd || 0));
  const absUsd = Math.max(0, Number((v2 as any).absence_usd || 0));
  if (absLyd > 0.0001 || absUsd > 0.0001) {
    dRowsDual.push({ label: 'Absence', lyd: absLyd, usd: absUsd });
  }
  // Latency: use backend monetary amounts (same as breakdown row)
  const latencyLyd = latLydPdf;
  const latencyUsd = latUsdPdf;
  if (latencyLyd > 0.0001 || latencyUsd > 0.0001) {
    dRowsDual.push({ label: 'Latency', lyd: latencyLyd, usd: latencyUsd });
  }
  const advLyd = Math.max(0, Number(advSumLYD || 0));
  if (advLyd > 0.0001) dRowsDual.push({ label: 'Salary Advance', lyd: advLyd, usd: 0 });
  const loanLyd = Math.max(0, Number((adjComp as any).loanPayment || 0));
  const loanUsd = Math.max(0, Number((v2 as any).loan_credit_usd || 0));
  if (loanLyd > 0.0001 || loanUsd > 0.0001) dRowsDual.push({ label: 'Loan Repayment', lyd: loanLyd, usd: loanUsd });
  // Exclude advances from Other Deductions to avoid double counting
  // Deductions from Reimbursements (type = deduction)
  (adjDedRowsPdf || []).forEach((dr) => {
    if (Math.max(0, Number(dr.lyd || 0)) > 0.0001 || Math.max(0, Number(dr.usd || 0)) > 0.0001) {
      dRowsDual.push({ label: dr.label, lyd: dr.lyd, usd: dr.usd });
    }
  });

  // Merge all reimbursement-type deductions into a single 'Deduction' row,
  // but keep Daily Absence / Latency / Salary Advance / Loan Repayment as
  // separate rows.
  {
    const merged: Array<{label:string; lyd:number; usd:number}> = [];
    let adjLyd = 0;
    let adjUsd = 0;
    for (const row of dRowsDual) {
      if (row.label === 'Deduction') {
        adjLyd += Math.max(0, Number(row.lyd || 0));
        adjUsd += Math.max(0, Number(row.usd || 0));
      } else {
        merged.push(row);
      }
    }
    if (adjLyd > 0.0001 || adjUsd > 0.0001) {
      merged.push({ label: 'Deduction', lyd: adjLyd, usd: adjUsd });
    }
    dRowsDual = merged;
  }
  
  const maxDedRows = 8;
  const dedTotalLyd = dRowsDual.reduce((s, r) => s + Math.max(0, Number(r.lyd||0)), 0);
  const dedTotalUsd = dRowsDual.reduce((s, r) => s + Math.max(0, Number(r.usd||0)), 0);

  const dedRendered = Math.min(maxDedRows, Math.max(dRowsDual.length, 0));
  let dedBottomY = dy + 28;
  for (let i = 0; i < dedRendered; i++) {
    const yy2 = dy + 28 + i * 24;
    const row = dRowsDual[i];
    doc.setDrawColor('#999999');
    (doc as any).setFillColor(240, 240, 240);
    doc.rect(dx, yy2, colW, 24, 'F');
    doc.rect(dx, yy2, colW, 24);
    try {
      if (showLydCol) doc.line(dx + colW - 170, yy2, dx + colW - 170, yy2 + 24);
      if (showUsdCol) doc.line(dx + colW - 90, yy2, dx + colW - 90, yy2 + 24);
    } catch {}
    doc.setFont('helvetica','normal');
    const label = row?.label || '';
    const lyd = Math.max(0, Number(row?.lyd || 0));
    const usd = Math.max(0, Number(row?.usd || 0));

    // Primary label on first line
    doc.text(label, dx + 6, yy2 + 15);
    const lydStrRow = lyd > 0.0001 ? `${lyd.toLocaleString(undefined,{maximumFractionDigits:2})}` : '';
    const usdStrRow = usd > 0.0001 ? `${usd.toLocaleString(undefined,{maximumFractionDigits:2})}` : '';
    doc.setFont('helvetica','bold');
    // Center amounts in their LYD / USD subcolumns
    if (showLydCol && lydStrRow) {
      const twL = doc.getTextWidth(lydStrRow);
      const lydCenter = dx + colW - 170 + 40; // middle of LYD subcolumn (80px wide)
      doc.text(lydStrRow, lydCenter - twL / 2, yy2 + 15);
    }
    if (showUsdCol && usdStrRow) {
      const twU = doc.getTextWidth(usdStrRow);
      const usdCenter = dx + colW - 90 + 40; // middle of USD subcolumn
      doc.text(usdStrRow, usdCenter - twU / 2, yy2 + 15);
    }

    doc.setFont('helvetica','normal');
    dedBottomY = yy2 + 24;
  }
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
      if (showLydCol && tLydStr) {
        const tw = doc.getTextWidth(tLydStr);
        const lydCenter = margin + colW - 170 + 40;
        doc.text(tLydStr, lydCenter - tw / 2, ty + 13);
      }
      if (showUsdCol && tUsdStr) {
        const tw = doc.getTextWidth(tUsdStr);
        const usdCenter = margin + colW - 90 + 40;
        doc.text(tUsdStr, usdCenter - tw / 2, ty + 13);
      }
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
      if (showLydCol && tLydStr) {
        const tw = doc.getTextWidth(tLydStr);
        const lydCenter = dx + colW - 170 + 40;
        doc.text(tLydStr, lydCenter - tw / 2, ty + 13);
      }
      if (showUsdCol && tUsdStr) {
        const tw = doc.getTextWidth(tUsdStr);
        const usdCenter = dx + colW - 90 + 40;
        doc.text(tUsdStr, usdCenter - tw / 2, ty + 13);
      }
      if (!showUsdCol && !showLydCol) {
        const one = tUsdStr || tLydStr;
        if (one) doc.text(one, dx + colW - 80, ty + 13);
      }
      doc.setFont('helvetica', 'normal');
      dedBottomY = ty + 20;
    }
  }

  netLyd = Math.max(0, Number((earningsLydTotal - dedTotalLyd).toFixed(2)));
  netUsd = Math.max(0, Number((earningsUsdTotal - dedTotalUsd).toFixed(2)));

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
      doc.text('Net Pay (LYD)', margin + 8, yBand + 14);
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
      doc.text('Net Pay (USD)', usdX + 8, yBand + 14);
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
      doc.text('Net Pay (LYD)', margin + 8, yBand + 14);
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
    
    // Cells (with leave support)
    const cellY = topY + hWeek + hDayNum;
    for (let idx = 0; idx < count; idx++) {
      const d = start + idx;
      const x = margin + idx * cw;
      const wAdj = cw;
      const day = days[d-1] || null;
      
      // **UPDATED: Use codeBadgePDF which checks leaves**
      const badge = codeBadgePDF(day, d - 1, schStartMinPDF, schEndMinPDF);
      
      const isFri = firstDate.date(d).day() === 5;
      const present = !!day?.present;
      const headerBg = (code: string): [number,number,number] | null => {
        switch (code) {
          // Leave types - distinct colors
          case 'AL': return [220,252,220]; // Annual - light green
          case 'SL': return [232,212,248]; // Sick - light purple
          case 'EL': return [255,228,181]; // Emergency - light orange
          case 'ML': return [255,192,224]; // Maternity - light pink
          case 'UL': return [255,224,224]; // Unpaid - light red
          case 'HL': return [224,240,255]; // Half Day - light blue
          case 'BM': return [211,211,211]; // Bereavement - gray
          case 'XL': return [240,248,208]; // Exam - light yellow-green
          case 'B1': return [200,230,230]; // Bereavement 1 - teal tint
          case 'B2': return [230,210,230]; // Bereavement 2 - lilac tint
          case 'H':  return [183,162,125]; // Public holiday marker (beige / #b7a27d tone)
          // Exception codes - warning colors
          case 'NI': return [255,245,220]; // No In - light amber
          case 'NO': return [255,240,210]; // No Out - light peach
          case 'MO': return [255,235,200]; // Missing Out - light orange
          case 'IP': return [255,250,230]; // Incomplete - light yellow
          // Regular attendance codes
          case 'PHF': return [235,235,235];
          case 'PH':  return [230,230,230];
          case 'PT':  return [240,240,240];
          case 'PL':  return [225,225,225];
          case 'A':   return [215,215,215];
          case 'P':   return [245,245,245];
          default:    return null;
        }
      };
      let bg: [number,number,number] | null = null;

      if (isFri && !present) {
        // Fridays without presence: light grey background
        bg = [215, 215, 215];
      } else {
        bg = headerBg(badge);
      }
      
      if (bg) { 
        (doc as any).setFillColor(bg[0], bg[1], bg[2]); 
        doc.rect(x, cellY, wAdj, hCell, 'F'); 
      }
      doc.setDrawColor(140,140,140);
      doc.rect(x, cellY, wAdj, hCell);
      
      const isHolidayBadge = badge === 'H';

      // Cross out Fridays with no presence and pure holidays (H)
      if ((isFri && !present) || isHolidayBadge) {
        doc.setDrawColor(120,120,120);
        doc.setLineWidth(0.6);
        doc.line(x + 2, cellY + 2, x + wAdj - 2, cellY + hCell - 2);
      }
      
      doc.setTextColor(0);
      doc.setFontSize(8);
      
      // **UPDATED: Show leave codes and exception codes prominently**
      const isLeaveCode = ['AL','SL','EL','ML','UL','HL','BM','XL','B1','B2'].includes(badge);
      const isExceptionCode = ['NI','NO','MO','IP'].includes(badge);
      const showCodes = ['P','PH','PHF','PT','PL','A','H','AL','SL','EL','ML','UL','HL','BM','XL','B1','B2','NI','NO','MO','IP'].includes(badge) && !(isFri && !present);
      
      if (!(isFri && !present) && showCodes && badge) {
        doc.setFont('helvetica','bold');
        // Auto-fit attendance code font to the cell width so codes stay readable
        const baseSize = (isLeaveCode || isExceptionCode || badge === 'H') ? 12 : 11;
        const minSize = 7;
        let fs = baseSize;
        doc.setFontSize(fs);
        while (fs > minSize && doc.getTextWidth(badge) > (wAdj - 4)) {
          fs -= 1;
          doc.setFontSize(fs);
        }
        if (badge === 'H') {
          // Holiday marker: b7a27d tone
          doc.setTextColor(183, 162, 125);
        } else if (isLeaveCode) {
          doc.setTextColor(0, 100, 0); // Dark green for leave codes
        } else if (isExceptionCode) {
          doc.setTextColor(200, 100, 0); // Orange for exception codes
        }
        const bw = doc.getTextWidth(badge);
        doc.text(badge, x + (wAdj - bw)/2, cellY + 20);
        doc.setTextColor(0); // Reset color
        doc.setFont('helvetica','normal');
      }
      
      // Missing hours indicator at top-right of cell (only if not on leave/holiday marker)
      if (!isLeaveCode && badge !== 'H') {
        const dm = Number((day as any)?.deltaMin ?? 0);
        const show = dm < 0 && Math.abs(dm) > 30; // Apply tolerance
        const sgn = '-'; // Always negative
        const abs = Math.abs(dm);
        const hh = Math.floor(abs / 60);
        const mm = Math.floor(abs % 60);
        const txt = show ? `${sgn}${String(hh)}:${String(mm).padStart(2,'0')}` : '';
        
        if (show) {
          doc.setFontSize(5);
          doc.setTextColor(220, 53, 69); // Red for missing hours
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

  // **UPDATE: Attendance counts to include leave codes and exception codes**
  const counts: Record<string, number> = { 
    P:0, A:0, PT:0, PHF:0, PH:0, PL:0,
    AL:0, SL:0, EL:0, ML:0, UL:0, HL:0, BM:0, XL:0, B1:0, B2:0,
    NI:0, NO:0, MO:0, IP:0, LI:0, EO:0,
  };

  for (let d = 1; d <= dim; d++) {
    const monthStartDate = dayjs(periodStart);
    const dayDate = monthStartDate.date(d);
    const effectiveStart = contractStart && contractStart.isAfter(monthStartDate) ? contractStart : monthStartDate;
    if (contractStart && dayDate.isBefore(effectiveStart, 'day')) continue;
    
    const badge = codeBadgePDF(days[d-1] || undefined, d - 1, schStartMinPDF, schEndMinPDF);
    const isFriday = dayDate.day() === 5;
    
    // Count codes with Friday rule:
    // - PH/PHF: Count on all days including Fridays (paid holidays can be on Fridays)
    // - Leave codes (AL, EL, ML, UL, HL, BM, XL, B1, B2): Skip Fridays EXCEPT Sick Leave (SL)
    // - Other codes (P, A, PT, PL, exception codes): Count on all working days
    const isLeaveCode = ['AL','EL','ML','UL','HL','BM','XL','B1','B2'].includes(badge);
    const skipFriday = isFriday && isLeaveCode; // Skip Fridays for non-sick leave codes
    
    // Don't count 'A' here - we'll use backend absence_days instead for consistency
    if (badge && badge !== 'A' && badge in counts && !skipFriday) counts[badge]++;
  }
  
  // Use backend absence_days for 'A' count to match deduction calculation
  counts['A'] = absenceDaysPDF;

  // Full-width Attendance table with leave codes
  doc.setFontSize(14);
  const tblTop = afterGridY + 6;
  const fullW = pageW - margin*2;

  const allCodes = ['P','A','PT','PHF','PH','PL','AL','SL','EL','ML','UL','HL','BM','XL','B1','B2','NI','NO','MO','IP','LI','EO'] as const;
  const codes = allCodes.filter((c) => Number((counts as any)[c] || 0) > 0);
  const leftW = 40;
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
  
  const codeLabel: Record<string,string> = {
    P: 'Present',
    A: 'Absent',
    PT: 'Short',
    PHF: 'PH Full',
    PH: 'PH',
    PL: 'Late',
    AL: 'Annual Leave',
    SL: 'Sick Leave',
    EL: 'Emergency Leave',
    ML: 'Maternity Leave',
    UL: 'Unpaid Leave',
    HL: 'Half Day Leave',
    BM: 'Bereavement',
    XL: 'Exam Leave',
    B1: 'Bereavement 1',
    B2: 'Bereavement 2',
    NI: 'No In',
    NO: 'No Out',
    MO: 'Missing Out',
    IP: 'Incomplete',
    LI: 'Late In',
    EO: 'Early Out',
  };

  const headerBg = (code: string): [number,number,number] | null => {
    switch (code) {
      // Leave types - distinct colors
      case 'AL': return [220,252,220]; // Annual - light green
      case 'SL': return [232,212,248]; // Sick - light purple
      case 'EL': return [255,228,181]; // Emergency - light orange
      case 'ML': return [255,192,224]; // Maternity - light pink
      case 'UL': return [255,224,224]; // Unpaid - light red
      case 'HL': return [224,240,255]; // Hajj - light blue
      case 'BM': return [211,211,211]; // Bereavement - gray
      case 'XL': return [240,248,208]; // Excuse - light yellow-green
      // Exception codes - warning colors
      case 'NI': return [255,245,220]; // No In - light amber
      case 'NO': return [255,240,210]; // No Out - light peach
      case 'MO': return [255,235,200]; // Missing Out - light orange
      case 'IP': return [255,250,230]; // Incomplete - light yellow
      case 'LI': return [255,248,225]; // Late In - light gold
      case 'EO': return [255,243,215]; // Early Out - light apricot
      // Regular attendance codes
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
    if (bg) { 
      (doc as any).setFillColor(bg[0], bg[1], bg[2]); 
      doc.rect(x, ay, wAdj, 24, 'F'); 
    }
    doc.rect(x, ay, wAdj, 24);
  });
  
  doc.text('Code', margin + 8, ay + 16);
  codes.forEach((c, i) => {
    const x = margin + leftW + i*cellW;
    const isLast = i === codes.length - 1;
    const wAdj = isLast ? ((fullW - leftW) - (cellW * (codes.length - 1))) : cellW;
    const tw = doc.getTextWidth(c);
    
    // **Color leave codes and exception codes in the header**
    const isLeaveCode = ['AL','SL','EL','ML','UL','HL','BM','XL','B1','B2'].includes(c);
    const isExceptionCode = ['NI','NO','MO','IP'].includes(c);
    if (isLeaveCode) {
      doc.setTextColor(0, 100, 0);
      doc.setFont('helvetica', 'bold');
    } else if (isExceptionCode) {
      doc.setTextColor(200, 100, 0);
      doc.setFont('helvetica', 'bold');
    }
    
    doc.text(c, x + (wAdj - tw)/2, ay + 13);
    
    // Reset styling
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    
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

  // Employee Signature field at the absolute bottom (bonus + label on same line)
  const sigY = doc.internal.pageSize.getHeight() - margin - 22;
  const sigWidth = 360;

  // --- Build bonus text (no icons) ---
  const goldWeightUsed =
    (commissionRole === 'sales_lead' || commissionRole === 'sales_manager')
      ? goldGramsScope
      : goldGramsSelf;

  const bonusParts: string[] = [];

  if (diamondItems > 0) {
    bonusParts.push(
      `Diamond items sold: ${Number(diamondItems || 0).toLocaleString('en-US', {
        maximumFractionDigits: 0,
      })}`
    );
  }

  if (goldWeightUsed > 0) {
    bonusParts.push(
      `Gold grams sold: ${Number(goldWeightUsed || 0).toLocaleString('en-US', {
        maximumFractionDigits: 2,
      })} g`
    );
  }

  const bonusText = bonusParts.join('   |   ');

  // --- Draw bonus text on same line (smaller, normal styling) ---
  try {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);          // smaller than signature label
    doc.setTextColor(0, 0, 0);

    if (bonusText) doc.text(bonusText, margin, sigY);
  } catch {}

  // --- Signature label (keep your existing sizing) ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);

  const sigLabel = 'Employee signature';
  const sigLabelX = pageW - margin - sigWidth;
  doc.text(sigLabel, sigLabelX, sigY);

  // --- Signature line ---
  try {
    const tw = doc.getTextWidth(sigLabel);
    const x1 = sigLabelX + tw + 6;
    const x2 = pageW - margin;
    doc.setDrawColor('#999999');
    (doc as any).setLineWidth(1);
    if (x2 > x1) doc.line(x1, sigY + 2, x2, sigY + 2);
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

  const pickNum = (obj: any, keys: string[]) => {
    for (const k of keys) {
      const v = obj?.[k];
      const n = Number(v);
      if (Number.isFinite(n) && n !== 0) return n;
    }
    return 0;
  };

  const getVrForEmp = (empId: number) =>
    (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(empId)) || ({} as any);

  const getGoldGrams = (empId: number) => {
    const vr = getVrForEmp(empId);
    return pickNum(vr, [
      "gold_grams",
      "gold_g",
      "goldGram",
      "gold_gram",
      "gold_commission_grams",
      "gold_comm_grams",
      "gold_qty_g",
    ]);
  };

  const getDiamondGrams = (empId: number) => {
    const vr = getVrForEmp(empId);
    return pickNum(vr, [
      "diamond_grams",
      "diamond_g",
      "diamondGram",
      "diamond_gram",
      "diamond_commission_grams",
      "diamond_comm_grams",
      "diamond_qty_g",
    ]);
  };

  const resolveCommissionFigures = (emp: Payslip) => {
    const empId = Number(emp.id_emp);
    const comm = commissionMapUI[empId];
    const vr = getVrForEmp(empId);

    const goldGramsUi = Number(comm?.goldGramsUsed);
    const goldGrams = Number.isFinite(goldGramsUi)
      ? goldGramsUi
      : Number(getGoldGrams(empId) || 0);

    const diamondGramsUi = Number(comm?.diamondItems);
    const diamondGrams = Number.isFinite(diamondGramsUi)
      ? diamondGramsUi
      : Number(getDiamondGrams(empId) || 0);

    const goldLyd = preferCommissionValue(
      comm?.goldBonusLyd,
      (vr as any)?.gold_bonus_lyd,
      (emp as any)?.gold_bonus_lyd
    );

    const diamondLyd = preferCommissionValue(
      comm?.diamondBonusLyd,
      (vr as any)?.diamond_bonus_lyd,
      (emp as any)?.diamond_bonus_lyd
    );

    return {
      goldGrams,
      goldLyd,
      diamondGrams,
      diamondLyd,
    };
  };

  const totalsGold = React.useMemo(() => {
    return (displayedRows || []).reduce(
      (acc: { grams: number; lyd: number }, emp: Payslip) => {
        const figs = resolveCommissionFigures(emp);
        acc.grams += figs.goldGrams;
        acc.lyd += figs.goldLyd;
        return acc;
      },
      { grams: 0, lyd: 0 }
    );
  }, [displayedRows, commissionMapUI, v2Rows]);

  const totalsDiamond = React.useMemo(() => {
    return (displayedRows || []).reduce(
      (acc: { grams: number; lyd: number }, emp: Payslip) => {
        const figs = resolveCommissionFigures(emp);
        acc.grams += figs.diamondGrams;
        acc.lyd += figs.diamondLyd;
        return acc;
      },
      { grams: 0, lyd: 0 }
    );
  }, [displayedRows, resolveCommissionFigures]);

  return (
  <Box
    ref={fullscreenRef}
    sx={{
      p: isFullscreen ? 0 : 2,
      width: isFullscreen ? "100vw" : "auto",
      height: isFullscreen ? "100vh" : "auto",
      overflow: isFullscreen ? "auto" : "visible",
      bgcolor: isFullscreen ? "background.paper" : "transparent",
      position: "relative",
      display: isFullscreen ? "flex" : "block",
      flexDirection: isFullscreen ? "column" : undefined,
      minHeight: isFullscreen ? 0 : undefined,
    }}
  >
    {isFullscreen && (
      <Box sx={{ position: "fixed", top: 12, right: 12, zIndex: 2500 }}>
        <IconButton
          onClick={toggleFullscreen}
          sx={{ bgcolor: "background.paper", boxShadow: 2, "&:hover": { bgcolor: "background.paper" } }}
        >
          <FullscreenExitIcon />
        </IconButton>
      </Box>
    )}

    <Card
      sx={{
        mb: isFullscreen ? 1 : 2,
        width: "100%",
        borderRadius: isFullscreen ? 0 : undefined,
        boxShadow: isFullscreen ? "none" : undefined,
        flexShrink: isFullscreen ? 0 : undefined,
      }}
    >
      <CardContent sx={{ p: isFullscreen ? 1 : undefined }}>
        {!isFullscreen && (
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              mb: 1,
              display: "flex",
              justifyContent: "center",
              "& .MuiTabs-flexContainer": {
                gap: 1,
              },
            }}
            TabIndicatorProps={{ sx: { display: "none" } }}
          >
            {[
              { label: t("Payroll") || "Payroll", value: "payroll" },
              { label: t("Salary Advance") || "Salary Advance", value: "advances" },
              { label: t("Loans") || "Loans", value: "loans" },
              { label: t("Reimbursements") || "Reimbursements", value: "adjustments" },
              ...(isAdmin ? [{ label: t("Settings") || "Settings", value: "settings" }] : []),
            ].map((tdef) => (
              <Tab
                key={tdef.value}
                label={tdef.label}
                value={tdef.value}
                sx={{
                  minHeight: 0,
                  height: 32,
                  padding: "4px 14px",
                  lineHeight: 1,
                  color: "white !important",
                  borderRadius: 1,
                  textTransform: "none",
                  backgroundColor: tab === tdef.value ? "#b7a27d" : "#65a8bf",
                  "&.Mui-selected": {
                    color: "white !important",
                    backgroundColor: "#b7a27d",
                  },
                  "&:hover": {
                    backgroundColor: tab === tdef.value ? "#b7a27d" : "#5793a7",
                  },
                }}
              />
            ))}
          </Tabs>
        )}

        {(tab === "payroll" || isFullscreen) && (
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
              <Box display="flex" alignItems="center" gap={0.5}>
                {!isFullscreen && (
                  <IconButton size="small" onClick={() => shiftMonth(-1)}>
                    <ChevronLeftIcon fontSize="small" />
                  </IconButton>
                )}
                <TextField
                  select
                  fullWidth
                  label={t("hr.timesheets.month") || "Month"}
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  size="small"
                  sx={{ flex: 1 }}
                >
                  {months.map((mm) => (
                    <MenuItem key={mm} value={mm}>
                      {String(mm).padStart(2, "0")}
                    </MenuItem>
                  ))}
                </TextField>
                {!isFullscreen && (
                  <IconButton size="small" onClick={() => shiftMonth(1)}>
                    <ChevronRightIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Box>
            <Box minWidth={160}>
              <Box display="flex" alignItems="center" gap={0.5}>
                {isFullscreen && (
                  <IconButton size="small" onClick={() => shiftPs(-1)} disabled={(psCycleValues?.length || 0) <= 1}>
                    <ChevronLeftIcon fontSize="small" />
                  </IconButton>
                )}
                <TextField
                  select
                  fullWidth
                  label={t("hr.timesheets.psPoint") || "PS"}
                  value={ps}
                  onChange={(e) => setPs(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                >
                  <MenuItem value="">{t("hr.timesheets.allPs") || "All PS"}</MenuItem>
                  {psCycleValues
                    .filter((v) => v !== "")
                    .map((v) => {
                      const cnt = Number(psCountMap[v] ?? 0) || 0;
                      const idPs = Number(v);
                      const ptName = Number.isFinite(idPs) ? String(psPoints[idPs] ?? "") : "";
                      const code = formatPs(v) || String(v);
                      const label = cnt
                        ? `${code} (${cnt})`
                        : ptName && ptName !== code
                          ? `${ptName} (${code})`
                          : code;
                      return (
                        <MenuItem key={v} value={v}>
                          {label}
                        </MenuItem>
                      );
                    })}
                </TextField>
                {isFullscreen && (
                  <IconButton size="small" onClick={() => shiftPs(1)} disabled={(psCycleValues?.length || 0) <= 1}>
                    <ChevronRightIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Box>
            {!isFullscreen && (
              <Box minWidth={180}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label={t("Position") || "Position"}
                  value={positionFilter}
                  onChange={(e) => setPositionFilter(e.target.value)}
                >
                  <MenuItem value="all">{t("All Positions") || "All Positions"}</MenuItem>
                  {positionOptions.map((pos) => (
                    <MenuItem key={pos.id} value={String(pos.id)}>
                      {pos.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            )}
            {!isFullscreen && (
              <Box minWidth={200}>
                <TextField
                  size="small"
                  fullWidth
                  label={t("Search") || "Search"}
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                />
              </Box>
            )}

            <Box display="flex" flexWrap="wrap" alignItems="center" gap={1.5}>
              {!isFullscreen && (
                <IconButton onClick={toggleFullscreen}>
                  <FullscreenIcon />
                </IconButton>
              )}
              {!isFullscreen && (
                <>
                  <Button
                    variant="outlined"
                    onClick={async () => {
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
                    const s = sales[String(e.id_emp)] || { qty: 0, total_lyd: 0 };
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
                        : (e.components?.basePay || 0) / (Math.max(1, e.baseSalary || 0) / W);

                    const baseUsd = e.baseSalaryUsd ? (e.baseSalaryUsd / W) * F : 0;

                    const vr =
                      (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(e.id_emp)) || {};
                    const commUsd =
                      Number((vr as any).diamond_bonus_usd || 0) +
                      Number((vr as any).gold_bonus_usd || 0);

                    const row: any[] = [
                      `${nameMap[e.id_emp] ?? e.name}`,
                      e.workingDays,
                      e.deductionDays,
                      e.presentWorkdays,
                      e.holidayWorked,
                      (e.baseSalary || 0).toFixed(2),
                      (() => {
                        const W = Math.max(1, e.workingDays || 1);
                        const vr =
                          (v2Rows || []).find(
                            (x: any) => Number(x.id_emp) === Number(e.id_emp)
                          ) || {};
                        let foodPer = Number(
                          (e as any).FOOD || (e as any).FOOD_ALLOWANCE || 0
                        );
                        if (!foodPer) {
                          const totalFoodLyd = Number((vr as any).wd_food_lyd || 0);
                          foodPer = totalFoodLyd && W ? totalFoodLyd / W : 0;
                        }
                        const present =
                          Number(presentDaysMap[e.id_emp] ?? e.presentWorkdays ?? 0) || 0;
                        const v = foodPer * present;
                        return (Number.isFinite(v) ? v : 0).toFixed(2);
                      })(),
                      (() => {
                        const W = Math.max(1, e.workingDays || 1);
                        const vr =
                          (v2Rows || []).find(
                            (x: any) => Number(x.id_emp) === Number(e.id_emp)
                          ) || {};
                        const fuel = Number(((e as any).FUEL ?? (vr as any).FUEL) || 0);
                        return (fuel * W).toFixed(2);
                      })(),
                      (() => {
                        const W = Math.max(1, e.workingDays || 1);
                        const vr =
                          (v2Rows || []).find(
                            (x: any) => Number(x.id_emp) === Number(e.id_emp)
                          ) || {};
                        const comm = Number(
                          ((e as any).COMMUNICATION ?? (vr as any).COMMUNICATION) || 0
                        );
                        return (comm * W).toFixed(2);
                      })(),
                      (e.components?.basePay || 0).toFixed(2),
                      (e.components?.allowancePay || 0).toFixed(2),
                    ];

                    if (cols.advances) row.push(advVal.toFixed(2));
                    if (cols.loans) row.push(loanVal.toFixed(2));
                    if (cols.salesQty) row.push((s.qty || 0).toFixed(0));
                    if (cols.salesTotal) row.push((s.total_lyd || 0).toFixed(2));

                    row.push(computeNetLYDFor(e.id_emp).toFixed(2));

                    if (cols.totalUsd) {
                      const totalUsdVal = baseUsd + commUsd;
                      row.push(totalUsdVal.toFixed(2));
                    }

                    lines.push(row.join(","));
                  });

                  const blob = new Blob([lines.join("\n")], {
                    type: "text/csv;charset=utf-8;",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `payroll_${year}-${String(month).padStart(2, "0")}.csv`;
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
                  doc.text(`Payroll ${year}-${String(month).padStart(2, "0")}`, 36, 32);

                  let y0 = 48;

                  const header: string[] = ["Employee", "WD", "DD", "PD", "HW", "Base", "Allow"];
                  const colX: number[] = [36, 220, 260, 300, 340, 380, 450];

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

                  header.forEach((h, i) => doc.text(h, colX[i], y0));
                  y0 += 16;

                  displayedRows.forEach((e) => {
                    const s = sales[String(e.id_emp)] || { qty: 0, total_lyd: 0 };
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
                        : (e.components?.basePay || 0) / (Math.max(1, e.baseSalary || 0) / W);

                    const baseUsd = e.baseSalaryUsd ? (e.baseSalaryUsd / W) * F : 0;

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

                    if (cols.advances) vals.push((Number(adj.advance || 0) * -1).toFixed(2));
                    if (cols.loans)
                      vals.push((Number(adj.loanPayment || 0) * -1).toFixed(2));
                    if (cols.salesQty) vals.push((s.qty || 0).toFixed(0));
                    if (cols.salesTotal) vals.push((s.total_lyd || 0).toFixed(2));

                    vals.push(computeNetLYDFor(e.id_emp).toFixed(2));
                    if (cols.totalUsd) vals.push((baseUsd + commUsd).toFixed(0));

                    vals.forEach((v, i) => doc.text(String(v), colX[i], y0));
                    y0 += 14;
                    if (y0 > 560) {
                      doc.addPage();
                      y0 = 36;
                    }
                  });

                  doc.save(`payroll_${year}_${String(month).padStart(2, "0")}.pdf`);
                }}
                  >
                    {t("Export PDF") || "Export PDF"}
                  </Button>

                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => {
                  const sel: Record<number, boolean> = {};
                  (displayedRows || []).forEach((e) => {
                    sel[e.id_emp] = true;
                  });
                  setSendSelection(sel);
                  setSendDialogOpen(true);
                }}
                  >
                    {t("Send Payslips") || "Send Payslips"}
                  </Button>

                  <Button
                    variant="contained"
                    color="error"
                    disabled={viewOnly}
                    onClick={async () => {
                  if (viewOnly) return;
                  const bankAcc = window.prompt("Bank/Cash Account No", "");
                  if (!bankAcc) return;
                  const salaryExpenseAcc = window.prompt("Salary Expense Account No", "");
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
                </>
              )}
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
                      setAdjForm((f) => ({ ...f, amount: e.target.value }));
                    }}
                    onBlur={() => {
                      const v = Number(adjForm.amount || 0);
                      if (Number.isFinite(v) && v > availableAdvance) {
                        showUiError(`Amount exceeds available advance (${availableAdvance.toFixed(2)} LYD)`);
                      }
                    }}
                    inputProps={{ step: "0.01", min: 0 }}
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
                          showUiError(`Amount exceeds available advance (${availableAdvance.toFixed(2)} LYD)`);
                          setAdjLoading(false);
                          return;
                        }
                        if (amt + existingAdvances > maxAdvance) {
                          showUiError(`Total advances cannot exceed ${advanceMaxPercent}% of salary (${maxAdvance.toFixed(2)} LYD)`);
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
                        const res = await fetch(`http://localhost:9000/api/hr/payroll/adjustments`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", ...authHeader() } as unknown as HeadersInit,
                          body: JSON.stringify(payload),
                        });
                        if (!res.ok) throw new Error("Failed to add advance");
                        await onRun();
                        setAdjForm((f) => ({ ...f, amount: "" }));
                        // success message not required
                      } catch (e: any) {
                        showUiError(e?.message || "Failed");
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
                    const eligible = cs && cs.isValid() ? cs.add(1, "year") : null;
                    const now = dayjs();
                    return (
                      <Box
                        sx={{
                          p: 1,
                          bgcolor: "background.paper",
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 1,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Contract start: {cs && cs.isValid() ? cs.format("DD/MM/YYYY") : "—"}
                        </Typography>
                        <br />
                        <Typography
                          variant="caption"
                          color={eligible && eligible.isBefore(now) ? "success.main" : "warning.main"}
                        >
                          Earliest loan eligibility: {eligible ? eligible.format("DD/MM/YYYY") : "—"}{" "}
                          {eligible ? (eligible.isBefore(now) ? "(eligible)" : "(not yet)") : ""}
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
                    helperText={t("Enter loan principal amount") || "Enter loan principal amount"}
                  />
                  <Button
                    variant="contained"
                    onClick={async () => {
                      if (!adjEmpId || !loanAmount) return;
                      setAdjLoading(true);
                      try {
                        const principal = Number(loanAmount);
                        if (principal <= 0) {
                          showUiError("Loan amount must be greater than 0");
                          setAdjLoading(false);
                          return;
                        }
                        const emp = (result?.employees || []).find((x) => x.id_emp === adjEmpId);
                        const baseSalary = Number(emp?.baseSalary || 0);
                        const maxPrincipal = baseSalary * loanMaxMultiple;
                        if (baseSalary > 0 && principal > maxPrincipal) {
                          showUiError(`Loan exceeds maximum allowed (${loanMaxMultiple}× salary). Max: ${maxPrincipal.toFixed(2)} LYD`);
                          setAdjLoading(false);
                          return;
                        }
                        const vr =
                          (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(adjEmpId)) || ({} as any);
                        const csRaw =
                          contractStartMap[adjEmpId!] ||
                          (vr as any).CONTRACT_START ||
                          (vr as any).contract_start ||
                          (vr as any).contractStart ||
                          (vr as any).T_START;
                        if (!csRaw) {
                          showUiError("Employee contract start date is missing. Loans are only available 1 year after contract start.");
                          setAdjLoading(false);
                          return;
                        }
                        const cs = dayjs(csRaw);
                        if (!cs.isValid() || dayjs().isBefore(cs.add(1, "year"))) {
                          showUiError("Loan not available: must be at least 1 year after contract start date.");
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
                          const empName =
                            (result?.employees || []).find((x) => x.id_emp === adjEmpId)?.name || String(adjEmpId);
                          const toList = [
                            ...String(hrEmails || "")
                              .split(",")
                              .map((s) => s.trim()),
                            ...String(financeEmails || "")
                              .split(",")
                              .map((s) => s.trim()),
                          ]
                            .filter(Boolean)
                            .join(",");
                          if (toList) {
                            const doc2 = new jsPDF({ unit: "pt", format: "a4" });
                            doc2.setFontSize(14);
                            doc2.text("Loan Issued", 36, 36);
                            doc2.setFontSize(11);
                            doc2.text(`Employee: ${empName} (ID: ${adjEmpId})`, 36, 56);
                            doc2.text(`Principal: ${principal.toFixed(2)} LYD`, 36, 72);
                            doc2.text(`Start: ${String(year)}-${String(month).padStart(2, "0")}`, 36, 88);
                            doc2.text(`Monthly Deduction: ${loanMonthlyPercent.toFixed(2)}%`, 36, 104);
                            const dataUrl2 = doc2.output("datauristring");
                            const subject = `Loan Issued — ${empName} (${adjEmpId})`;
                            const html = `<div><p>Loan issued for employee <b>${empName}</b> (ID: ${adjEmpId}).</p><p>Principal: ${principal.toFixed(
                              2
                            )} LYD<br/>Start: ${String(year)}-${String(month).padStart(
                              2,
                              "0"
                            )}<br/>Monthly Deduction: ${loanMonthlyPercent.toFixed(2)}%</p></div>`;
                            await sendPayslipClient({
                              to: toList,
                              subject,
                              html,
                              pdfBase64: dataUrl2,
                              filename: `loan_${adjEmpId}_${year}${String(month).padStart(2, "0")}.pdf`,
                            });
                          }
                        } catch {}

                        await onRun();
                        setLoanAmount("");
                        // success message not required
                      } catch (e: any) {
                        showUiError(e?.message || "Failed");
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
                  const emp = (result?.employees || []).find((x) => x.id_emp === adjEmpId);
                  return emp ? `${emp.name} (ID: ${emp.id_emp})` : "";
                })()}
              </Typography>
              <Box my={1}>
                {(loanRows || []).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {t("No loans")}
                  </Typography>
                )}
                {(loanRows || []).map((ln: any) => (
                  <Box key={ln.id} sx={{ py: 0.5, borderTop: "1px solid", borderColor: "divider" }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="body2">
                          {`Loan #${ln.id}`} — {t("Remaining") || "Remaining"}:{" "}
                          {Number(ln.remaining || 0).toFixed(2)} LYD
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {dayjs(ln.createdAt).format("DD/MM/YYYY")}
                        </Typography>
                      </Box>
                      <Box display="flex" gap={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={async () => {
                            try {
                              await skipV2LoanMonth({ loanId: ln.id, year, month });
                              alert(t("Skipped this month deduction") || "Skipped this month deduction");
                              const js = await listV2Loans(adjEmpId!);
                              setLoanRows(js?.rows || []);
                            } catch (e: any) {
                              alert(e?.message || "Failed");
                            }
                          }}
                        >
                          {t("Skip this month") || "Skip this month"}
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => {
                            setActiveLoan(ln);
                            setPayoffOpen(true);
                          }}
                        >
                          {t("Payoff") || "Payoff"}
                        </Button>
                      </Box>
                    </Box>
                    <Box mt={0.5} ml={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        {t("Payoff history") || "Payoff history"}
                      </Typography>
                      {Array.isArray(ln.history) && ln.history.length ? (
                        <Box>
                          {ln.history.map((h: any, i: number) => (
                            <Box key={i} display="flex" justifyContent="space-between">
                              <Typography variant="caption">{dayjs(h.ts).format("DD/MM/YYYY")}</Typography>
                              <Typography variant="caption">{Number(h.amount || 0).toFixed(2)} LYD</Typography>
                            </Box>
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="caption">{t("No payoffs yet") || "No payoffs yet"}</Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>

              <Box mt={2}>
                <Typography variant="subtitle2">
                  {t("Salary history (last 12 months)") || "Salary history (last 12 months)"}
                </Typography>
                {(historyPoints || []).length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t("No data")}
                  </Typography>
                ) : (
                  <Box>
                    <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
                      <Table size="small" sx={{ minWidth: 900 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>{t("Month") || "Month"}</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>{t("Gold") || "Gold"}</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>{t("Diamond") || "Diamond"}</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>{t("Gross Salary") || "Gross Salary"}</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>{t("Net Salary") || "Net Salary"}</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(historyPoints || []).map((p, idx) => {
                            const hp = p as any;
                            const goldLyd = Number(hp.gold_lyd ?? 0);
                            const goldUsd = Number(hp.gold_usd ?? 0);
                            const diamondLyd = Number(hp.diamond_lyd ?? 0);
                            const diamondUsd = Number(hp.diamond_usd ?? 0);
                            const grossLyd = Number(hp.gross_lyd ?? 0);
                            const grossUsd = Number(hp.gross_usd ?? 0);
                            const netLyd = Number(hp.net_lyd ?? 0);
                            const netUsd = Number(hp.net_usd ?? 0);
                            return (
                              <TableRow key={idx}>
                                <TableCell>
                                  {dayjs(`${hp.year}-${String(hp.month).padStart(2, "0")}-01`).format("MMM YYYY")}
                                </TableCell>
                                <TableCell>
                                  {goldLyd.toFixed(2)} LYD / {goldUsd.toFixed(2)} USD
                                </TableCell>
                                <TableCell>
                                  {diamondLyd.toFixed(2)} LYD / {diamondUsd.toFixed(2)} USD
                                </TableCell>
                                <TableCell>
                                  {grossLyd.toFixed(2)} LYD / {grossUsd.toFixed(2)} USD
                                </TableCell>
                                <TableCell>
                                  {netLyd.toFixed(2)} LYD / {netUsd.toFixed(2)} USD
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        )}

        {tab === "adjustments" && (
          <Box display="grid" gap={2}>
            <Typography variant="subtitle1">{t("Adjustments") || "Adjustments"}</Typography>

            <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
              <TextField
                select
                size="small"
                label={t("Employee") || "Employee"}
                value={adjEmpId || ""}
                onChange={(e) => setAdjEmpId(Number(e.target.value) || null)}
                sx={{ minWidth: 300 }}
              >
                {(result?.employees || []).map((emp) => (
                  <MenuItem key={emp.id_emp} value={emp.id_emp}>
                    {emp.name} (ID: {emp.id_emp})
                  </MenuItem>
                ))}
              </TextField>
              
              <TextField
                select
                size="small"
                label={t("Currency Filter") || "Currency Filter"}
                value={adjCurrencyFilter}
                onChange={(e) => setAdjCurrencyFilter(e.target.value as 'ALL' | 'LYD' | 'USD')}
                sx={{ minWidth: 120 }}
              >
                <MenuItem value="ALL">{t("All") || "All"}</MenuItem>
                <MenuItem value="LYD">LYD</MenuItem>
                <MenuItem value="USD">USD</MenuItem>
              </TextField>
            </Box>

            {adjEmpId && (
              <Box display="grid" gap={2} sx={{ width: '100%', maxWidth: 1400 }}>
                <Box>
                  {(() => {
                    const visible = (adjRows || []).filter((r: any) =>
                      adjCurrencyFilter === 'ALL' || String(r.currency || '').toUpperCase() === String(adjCurrencyFilter).toUpperCase()
                    );
                    if (visible.length === 0) {
                      return (
                        <Typography variant="body2" color="text.secondary">
                          {t("No adjustments yet") || "No adjustments yet"}
                        </Typography>
                      );
                    }

                    const isDeduction = (r: any) => {
                      const dir = String(r?.direction || '').toUpperCase();
                      const type = String(r?.type || '').toLowerCase();
                      return dir === 'DEDUCT' || type === 'deduction';
                    };

                    const showUsd = !!adjUsdEligible;

                    const sumTotals = (rows: any[]) => {
                      let lyd = 0;
                      let usd = 0;
                      (rows || []).forEach((r) => {
                        const amt = Number(r?.amount || 0) || 0;
                        if (!amt) return;
                        const cur = String(r?.currency || 'LYD').toUpperCase();
                        if (cur === 'USD') usd += amt;
                        else lyd += amt;
                      });
                      return { lyd, usd };
                    };

                    const renderRows = (rows: any[]) => {
                      if (!rows.length) {
                        return (
                          <Typography variant="body2" color="text.secondary" sx={{ py: 0.5 }}>
                            {t("None") || "None"}
                          </Typography>
                        );
                      }
                      return rows.map((r: any, idx: number) => {
                        const opt = adjTypeOptions.find((o) => o.value === r.type);
                        const label = String(r.label || opt?.label || r.type || '').trim();
                        const amt = Number(r.amount || 0);
                        const cur = String(r.currency || 'LYD').toUpperCase();
                        const lydStr = cur === 'USD' ? '' : (amt ? amt.toFixed(2) : '');
                        const usdStr = cur === 'USD' ? (amt ? amt.toFixed(2) : '') : '';
                        const note = String(r.note || '').trim();
                        const dateStr = r.ts ? dayjs(r.ts).format('YYYY-MM-DD') : '';
                        const isEditing = adjEditId === r.id;
                        return (
                          <Box
                            key={r.id || idx}
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: showUsd ? '96px 1fr 1fr 90px 90px 72px' : '96px 1fr 1fr 90px 72px',
                              gap: 1,
                              alignItems: 'center',
                              py: 0.5,
                              px: 1,
                              borderBottom: '1px dashed',
                              borderColor: 'divider',
                              bgcolor: isEditing ? 'action.selected' : 'transparent',
                              borderRadius: 1,
                            }}
                          >
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                              {dateStr}
                            </Typography>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {label}
                              </Typography>
                            </Box>
                            <Box>
                              {note ? (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: 'block', lineHeight: 1.2 }}
                                >
                                  {note}
                                </Typography>
                              ) : null}
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>
                              {lydStr}
                            </Typography>
                            {showUsd && (
                              <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>
                                {usdStr}
                              </Typography>
                            )}
                            <Box display="flex" justifyContent="flex-end" gap={0.5}>
                              <IconButton
                                size="small"
                                onClick={() => startEditAdjustment(r)}
                                disabled={adjLoading || isEditing}
                                title={t("Edit") || "Edit"}
                              >
                                <SettingsIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => r.id && requestDeleteAdjustment(r.id)}
                                disabled={adjLoading}
                                color="error"
                                title={t("Delete") || "Delete"}
                              >
                                <VisibilityOffIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>
                        );
                      });
                    };

                    const earnings = visible.filter((r: any) => r && !isDeduction(r));
                    const deductions = visible.filter((r: any) => r && isDeduction(r));

                    const earnTot = sumTotals(earnings);
                    const dedTot = sumTotals(deductions);

                    const TotalsRow = ({ totals }: { totals: { lyd: number; usd: number } }) => (
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: showUsd ? '96px 1fr 1fr 90px 90px 72px' : '96px 1fr 1fr 90px 72px',
                          gap: 1,
                          alignItems: 'center',
                          mt: 0.5,
                          px: 1,
                          py: 0.75,
                          minHeight: 38,
                          bgcolor: (t) =>
                            t.palette.mode === 'dark'
                              ? 'rgba(255,255,255,0.10)'
                              : 'rgba(0,0,0,0.10)',
                          borderRadius: 1,
                        }}
                      >
                        <Box />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {t('Total') || 'Total'}
                        </Typography>
                        <Box />
                        <Typography variant="body2" sx={{ fontWeight: 700, textAlign: 'right' }}>
                          {totals.lyd ? totals.lyd.toFixed(2) : ''}
                        </Typography>
                        {showUsd ? (
                          <Typography variant="body2" sx={{ fontWeight: 700, textAlign: 'right' }}>
                            {totals.usd ? totals.usd.toFixed(2) : ''}
                          </Typography>
                        ) : null}
                        <Box />
                      </Box>
                    );

                    return (
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                          gap: 2,
                          alignItems: 'stretch',
                        }}
                      >
                        <Box
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            height: { xs: 'auto', md: 520 },
                          }}
                        >
                          <Box sx={{ px: 1, py: 0.75, bgcolor: 'background.default' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }} align="center">
                              {t('EARNINGS') || 'EARNINGS'}
                            </Typography>
                            <Box
                              sx={{
                                display: 'grid',
                                gridTemplateColumns: showUsd ? '96px 1fr 1fr 90px 90px 72px' : '96px 1fr 1fr 90px 72px',
                                gap: 1,
                                alignItems: 'center',
                                mt: 0.5,
                              }}
                            >
                              <Typography variant="caption" color="text.secondary">{t('Date') || 'Date'}</Typography>
                              <Typography variant="caption" color="text.secondary">{t('Item') || 'Item'}</Typography>
                              <Typography variant="caption" color="text.secondary">{t('Notes') || 'Notes'}</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>LYD</Typography>
                              {showUsd && (
                                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>USD</Typography>
                              )}
                              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>{t('Actions') || 'Actions'}</Typography>
                            </Box>
                          </Box>
                          <Box sx={{ px: 0.5, pb: 0.5, flex: 1, overflowY: 'auto' }}>
                            {renderRows(earnings)}
                          </Box>
                          <Box sx={{ px: 0.5, pb: 0.75 }}>
                            <Divider sx={{ mt: 0.5 }} />
                            <Box sx={{ px: 0.5 }}>
                              <TotalsRow totals={earnTot} />
                            </Box>
                          </Box>
                        </Box>

                        <Box
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            height: { xs: 'auto', md: 520 },
                          }}
                        >
                          <Box sx={{ px: 1, py: 0.75, bgcolor: 'background.default' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }} align="center">
                              {t('DEDUCTIONS') || 'DEDUCTIONS'}
                            </Typography>
                            <Box
                              sx={{
                                display: 'grid',
                                gridTemplateColumns: showUsd ? '96px 1fr 1fr 90px 90px 72px' : '96px 1fr 1fr 90px 72px',
                                gap: 1,
                                alignItems: 'center',
                                mt: 0.5,
                              }}
                            >
                              <Typography variant="caption" color="text.secondary">{t('Date') || 'Date'}</Typography>
                              <Typography variant="caption" color="text.secondary">{t('Item') || 'Item'}</Typography>
                              <Typography variant="caption" color="text.secondary">{t('Notes') || 'Notes'}</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>LYD</Typography>
                              {showUsd && (
                                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>USD</Typography>
                              )}
                              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>{t('Actions') || 'Actions'}</Typography>
                            </Box>
                          </Box>
                          <Box sx={{ px: 0.5, pb: 0.5, flex: 1, overflowY: 'auto' }}>
                            {renderRows(deductions)}
                          </Box>
                          <Box sx={{ px: 0.5, pb: 0.75 }}>
                            <Divider sx={{ mt: 0.5 }} />
                            <Box sx={{ px: 0.5 }}>
                              <TotalsRow totals={dedTot} />
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    );
                  })()}

                  {Object.keys(adjTypeTotals).length > 0 && (
                    <Box
                      mt={1.5}
                      p={1}
                      sx={{ borderRadius: 1, border: "1px solid", borderColor: "divider", bgcolor: "background.default" }}
                    >
                      <Typography variant="subtitle2" gutterBottom>
                        {t("Totals this month") || "Totals this month"}
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
                              {parts.join("  |  ")}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </Box>

                <Divider sx={{ my: 1.5 }} />

                <Box
                  display="grid"
                  gap={1}
                  sx={{
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, 1fr)',
                      md: 'repeat(4, 1fr)',
                    },
                  }}
                >
                  <TextField
                    select
                    size="small"
                    label={t("Type") || "Type"}
                    value={adjForm.type}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      const opt = adjTypeOptions.find((o) => o.value === nextType);
                      setAdjForm((f) => ({
                        ...f,
                        type: nextType,
                        label: nextType === 'custom' ? '' : String(opt?.label || nextType),
                        direction: nextType === 'deduction' ? 'DEDUCT' : (nextType === 'custom' ? 'ADD' : 'ADD'),
                        recurring: false,
                        startYear: year,
                        startMonth: month,
                        endYear: '',
                        endMonth: '',
                        currency: adjUsdEligible ? f.currency : "LYD",
                      }));
                    }}
                    fullWidth
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
                    onChange={(e) => setAdjForm((f) => ({ ...f, amount: e.target.value }))}
                    inputProps={{ step: "0.01" }}
                    fullWidth
                  />

                  {adjForm.type === 'custom' && (
                    <TextField
                      size="small"
                      label={t("Label") || "Label"}
                      value={adjForm.label}
                      onChange={(e) => setAdjForm((f) => ({ ...f, label: e.target.value }))}
                      placeholder={t("Example: Attendance Bonus") || "Example: Attendance Bonus"}
                      fullWidth
                    />
                  )}

                  {adjForm.type === 'custom' && (
                    <TextField
                      select
                      size="small"
                      label={t("Add / Deduct") || "Add / Deduct"}
                      value={adjForm.direction}
                      onChange={(e) =>
                        setAdjForm((f) => ({
                          ...f,
                          direction: (String(e.target.value || '').toUpperCase() === 'DEDUCT' ? 'DEDUCT' : 'ADD') as 'ADD' | 'DEDUCT',
                        }))
                      }
                      fullWidth
                    >
                      <MenuItem value="ADD">{t("Earnings (+)") || "Earnings (+)"}</MenuItem>
                      <MenuItem value="DEDUCT">{t("Deductions (-)") || "Deductions (-)"}</MenuItem>
                    </TextField>
                  )}

                  {adjForm.type === 'custom' && (
                    <FormControlLabel
                      sx={{ gridColumn: { xs: '1 / -1', md: '1 / -1' }, m: 0 }}
                      control={
                        <Checkbox
                          checked={!!adjForm.recurring}
                          onChange={(e) => {
                            const checked = !!e.target.checked;
                            setAdjForm((f) => ({
                              ...f,
                              recurring: checked,
                              startYear: checked ? Number(f.startYear || year) : Number(f.startYear || year),
                              startMonth: checked ? Number(f.startMonth || month) : Number(f.startMonth || month),
                              endYear: checked ? String(f.endYear || '') : '',
                              endMonth: checked ? String(f.endMonth || '') : '',
                            }));
                          }}
                        />
                      }
                      label={t('Recurring (apply every month)') || 'Recurring (apply every month)'}
                    />
                  )}

                  {adjForm.type === 'custom' && adjForm.recurring && (
                    <TextField
                      select
                      size="small"
                      label={t('Start Year') || 'Start Year'}
                      value={adjForm.startYear}
                      onChange={(e) => setAdjForm((f) => ({ ...f, startYear: Number(e.target.value) }))}
                      fullWidth
                    >
                      {years.map((yy) => (
                        <MenuItem key={yy} value={yy}>
                          {yy}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}

                  {adjForm.type === 'custom' && adjForm.recurring && (
                    <TextField
                      select
                      size="small"
                      label={t('Start Month') || 'Start Month'}
                      value={adjForm.startMonth}
                      onChange={(e) => setAdjForm((f) => ({ ...f, startMonth: Number(e.target.value) }))}
                      fullWidth
                    >
                      {months.map((mm) => (
                        <MenuItem key={mm} value={mm}>
                          {String(mm).padStart(2, '0')}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}

                  {adjForm.type === 'custom' && adjForm.recurring && (
                    <TextField
                      select
                      size="small"
                      label={t('End Year (optional)') || 'End Year (optional)'}
                      value={adjForm.endYear}
                      onChange={(e) => setAdjForm((f) => ({ ...f, endYear: String(e.target.value) }))}
                      fullWidth
                    >
                      <MenuItem value="">—</MenuItem>
                      {years.map((yy) => (
                        <MenuItem key={yy} value={String(yy)}>
                          {yy}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}

                  {adjForm.type === 'custom' && adjForm.recurring && (
                    <TextField
                      select
                      size="small"
                      label={t('End Month (optional)') || 'End Month (optional)'}
                      value={adjForm.endMonth}
                      onChange={(e) => setAdjForm((f) => ({ ...f, endMonth: String(e.target.value) }))}
                      fullWidth
                    >
                      <MenuItem value="">—</MenuItem>
                      {months.map((mm) => (
                        <MenuItem key={mm} value={String(mm)}>
                          {String(mm).padStart(2, '0')}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                  <TextField
                    select
                    size="small"
                    label={t("Currency") || "Currency"}
                    value={adjForm.currency}
                    onChange={(e) => setAdjForm((f) => ({ ...f, currency: e.target.value }))}
                    disabled={!adjUsdEligible}
                    fullWidth
                  >
                    {(adjUsdEligible ? ["LYD", "USD"] : ["LYD"]).map((x) => (
                      <MenuItem key={x} value={x}>
                        {x}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    size="small"
                    label={t("Note") || "Note"}
                    value={adjForm.note}
                    onChange={(e) => setAdjForm((f) => ({ ...f, note: e.target.value }))}
                    fullWidth
                  />
                </Box>

                <Box mt={1} display="flex" justifyContent="flex-end" gap={1}>
                  {adjEditId ? (
                    <>
                      <Button onClick={cancelEditAdjustment} variant="outlined" disabled={adjLoading}>
                        {t("common.cancel") || "Cancel"}
                      </Button>
                      <Button onClick={updateAdjustment} variant="contained" disabled={adjLoading}>
                        {t("common.update") || "Update"}
                      </Button>
                    </>
                  ) : (
                    <Button onClick={addAdjustment} variant="contained" disabled={adjLoading}>
                      {t("common.add") || "Add"}
                    </Button>
                  )}
                </Box>
              </Box>
            )}
          </Box>
        )}

        {tab === "settings" &&
          (!isAdmin ? (
            <Typography color="error">{t("Access denied") || "Access denied"}</Typography>
          ) : (
            <Box display="grid" gap={3}>
              <Box display="flex" alignItems="center" gap={1}>
                <SettingsIcon fontSize="small" />
                <Typography variant="h6">{t("Admin Settings") || "Admin Settings"}</Typography>
              </Box>

              <Box display="grid" gap={2} maxWidth={600}>
                <Typography variant="h6">{t("Loan & Advance Settings") || "Loan & Advance Settings"}</Typography>
                <Typography variant="subtitle2">{t("Default Loan Parameters") || "Default Loan Parameters"}</Typography>
                <Box display="flex" flexWrap="wrap" gap={2}>
                  <TextField
                    type="number"
                    size="small"
                    sx={{ width: 160 }}
                    label={t("Max Multiple of Salary") || "Max Multiple of Salary"}
                    value={loanMaxMultiple}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const next = Number.isFinite(v) && v > 0 ? v : 0;
                      setLoanMaxMultiple(next);
                      try {
                        localStorage.setItem("payroll_settings_loan_max_multiple", String(next || ""));
                      } catch {}
                    }}
                    inputProps={{ step: 0.1, min: 0 }}
                  />
                  <TextField
                    type="number"
                    size="small"
                    sx={{ width: 160 }}
                    label={t("Monthly Deduction %") || "Monthly Deduction %"}
                    value={loanMonthlyPercent}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const next = Number.isFinite(v) && v >= 0 ? v : 0;
                      setLoanMonthlyPercent(next);
                      try {
                        localStorage.setItem("payroll_settings_loan_monthly_percent", String(next || ""));
                      } catch {}
                    }}
                    inputProps={{ step: 0.1, min: 0, max: 100 }}
                  />
                </Box>
                <Divider />
                <Typography variant="subtitle2">{t("Salary Advance Limits") || "Salary Advance Limits"}</Typography>
                <Box display="flex" flexWrap="wrap" gap={2}>
                  <TextField
                    type="number"
                    size="small"
                    sx={{ width: 200 }}
                    label={t("Max % of Monthly Salary") || "Max % of Monthly Salary"}
                    value={advanceMaxPercent}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const next = Number.isFinite(v) && v >= 0 ? v : 0;
                      setAdvanceMaxPercent(next);
                      try {
                        localStorage.setItem("payroll_settings_advance_max_percent", String(next || ""));
                      } catch {}
                    }}
                    inputProps={{ step: 0.5, min: 0, max: 100 }}
                  />
                </Box>
                <Box sx={{ p: 2, bgcolor: "info.light", borderRadius: 1 }}>
                  <Typography variant="caption" color="info.contrastText">
                    {t(
                      "Note: These limits are enforced at the application level. Contact system administrator to modify core parameters."
                    ) ||
                      "Note: These limits are enforced at the application level. Contact system administrator to modify core parameters."}
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))}
      </CardContent>
    </Card>

    {loading && (
      <Box display="flex" alignItems="center" gap={1}>
        <CircularProgress size={20} />
        <Typography>{t("hr.timesheets.loading") || "Loading..."}</Typography>
      </Box>
    )}

    {!loading && result && (tab === "payroll" || isFullscreen) && (
      <Card
        sx={{
          width: "100%",
          borderRadius: isFullscreen ? 0 : undefined,
          boxShadow: isFullscreen ? "none" : undefined,
          display: isFullscreen ? "flex" : "block",
          flexDirection: isFullscreen ? "column" : undefined,
          flex: isFullscreen ? 1 : undefined,
          minHeight: isFullscreen ? 0 : undefined,
          mb: isFullscreen ? 0 : undefined,
        }}
      >
        <CardContent
          sx={{
            p: isFullscreen ? 0 : undefined,
            display: isFullscreen ? "flex" : "block",
            flexDirection: isFullscreen ? "column" : undefined,
            flex: isFullscreen ? 1 : undefined,
            minHeight: isFullscreen ? 0 : undefined,
          }}
        >
          <TableContainer
            sx={{
              overflow: "auto",
              maxHeight: isFullscreen ? "none" : "calc(100vh - 280px)",
              flex: isFullscreen ? 1 : undefined,
              minHeight: isFullscreen ? 0 : undefined,
            }}
          >
            <Table
              stickyHeader
              size="small"
              sx={{
                tableLayout: isFullscreen ? "auto" : "fixed",
                width: "100%",
                minWidth: isFullscreen ? "100%" : tableMinWidth,
                "& .MuiTableCell-root": { py: 0.5, px: 1 },
                "& td, & th": { borderBottom: "1px solid", borderColor: "divider" },
              }}
            >
              <TableHead>
              <TableRow>
                {/* Employee - stays first */}
                <TableCell
                  sortDirection={sortKey === "name" ? sortDir : (false as any)}
                  sx={{ width: 180, maxWidth: 180, position: "sticky", left: 0, zIndex: 6, bgcolor: "background.paper" }}
                >
                  <TableSortLabel
                    active={sortKey === "name"}
                    direction={sortKey === "name" ? sortDir : "asc"}
                    onClick={() => handleSort("name")}
                  >
                    {t("hr.timesheets.employee") || "Employee"}
                  </TableSortLabel>
                </TableCell>

                {/* Basic Salary */}
                {cols.baseSalary && (
                  <TableCell align="right" sortDirection={sortKey === "baseSalary" ? sortDir : (false as any)} sx={{ width: 140 }}>
                    <Box display="flex" flexDirection="column" alignItems="flex-end">
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
                      >
                        <Box display="flex" flexDirection="column" alignItems="flex-end">
                          <span>{t("Basic Salary") || "Base"}</span>
                          <span style={{ fontSize: 9 }}>(LYD) | (USD)</span>
                        </Box>
                      </TableSortLabel>
                    </Box>
                  </TableCell>
                )}

                {/* P (Present Days) */}
                {cols.p && (
                  <TableCell align="right" sx={{ width: 110 }}>
                    <Box display="flex" flexDirection="column" alignItems="flex-end">
                      <span>P</span>
                      <span style={{ fontSize: 9 }}>(LYD) | (USD)</span>
                    </Box>
                  </TableCell>
                )}

                {/* PH (Paid Holiday) */}
                {cols.ph && (
                  <TableCell align="right" sx={{ width: 110 }}>
                    <Box display="flex" flexDirection="column" alignItems="flex-end">
                      <span>PH</span>
                      <span style={{ fontSize: 9 }}>(LYD) | (USD)</span>
                    </Box>
                  </TableCell>
                )}

                {/* PHF (Paid Holiday Full) */}
                {cols.phf && (
                  <TableCell align="right" sx={{ width: 110 }}>
                    <Box display="flex" flexDirection="column" alignItems="flex-end">
                      <span>PHF</span>
                      <span style={{ fontSize: 9 }}>(LYD) | (USD)</span>
                    </Box>
                  </TableCell>
                )}

                {/* Food Allowance */}
                {cols.food && (
                  <TableCell align="right" sortDirection={sortKey === "food" ? sortDir : (false as any)} sx={{ width: 72 }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
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
                      >
                        {t("Food") || "Food"}
                      </TableSortLabel>
                    </Box>
                  </TableCell>
                )}

                {/* Transportation */}
                {cols.fuel && (
                  <TableCell align="right" sortDirection={sortKey === "fuel" ? sortDir : (false as any)} sx={{ width: 72 }}>
                    <Box display="flex" flexDirection="column" alignItems="flex-end">
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
                      >
                        {t("Transport") || "Transport"}
                      </TableSortLabel>
                    </Box>
                  </TableCell>
                )}

                {/* Communication */}
                {cols.comm && (
                  <TableCell align="right" sortDirection={sortKey === "comm" ? sortDir : (false as any)} sx={{ width: 72 }}>
                    <Box display="flex" flexDirection="column" alignItems="flex-end">
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
                      >
                        {t("Comm") || "Comm"}
                      </TableSortLabel>
                    </Box>
                  </TableCell>
                )}

                {/* Gold Commission */}
                {cols.gold && (
                  <TableCell align="right" sortDirection={sortKey === "gold" ? sortDir : (false as any)} sx={{ width: 96 }}>
                    <Box display="flex" flexDirection="column" alignItems="flex-end">
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
                      >
                        {t("Gold") || "Gold"}
                      </TableSortLabel>
                    </Box>
                  </TableCell>
                )}

                {/* Diamond Commission */}
                {cols.diamond && (
                  <TableCell align="right" sortDirection={sortKey === "diamond" ? sortDir : (false as any)} sx={{ width: 96 }}>
                    <Box display="flex" flexDirection="column" alignItems="flex-end">
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
                      >
                        {t("Diamond") || "Diamond"}
                      </TableSortLabel>
                    </Box>
                  </TableCell>
                )}

                {/* Watch Commission */}
                {cols.watchComm && (
                  <TableCell align="right" sx={{ width: 84 }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <span>{t("Watch") || "Watch"}</span>
                    </Box>
                  </TableCell>
                )}

                {/* Salary Advance */}
                {cols.advances && (
                  <TableCell align="right" sx={{ width: 78 }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <span>{t("Advance") || "Advance"}</span>
                    </Box>
                  </TableCell>
                )}

                {/* Loans */}
                {cols.loans && (
                  <TableCell align="right" sx={{ width: 78 }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <span>{t("Loans") || "Loans"}</span>
                    </Box>
                  </TableCell>
                )}

                {/* Adjustments - NEW COLUMN */}
                <TableCell align="right" sx={{ width: 90 }}>
                  <span>{t("Adjustments") || "Adjustments"}</span>
                </TableCell>

                {/* Absence (Deduction Days) */}
                <TableCell align="right" sortDirection={sortKey === "deductionDays" ? sortDir : (false as any)} sx={{ width: 110 }}>
                  <Box display="flex" flexDirection="column" alignItems="flex-end">
                    <TableSortLabel
                      active={sortKey === "deductionDays"}
                      direction={sortKey === "deductionDays" ? sortDir : "asc"}
                      onClick={() => handleSort("deductionDays")}
                    >
                      {t("Absence") || "Absence"}
                    </TableSortLabel>
                    <span style={{ fontSize: 9 }}>(LYD) | (USD)</span>
                  </Box>
                </TableCell>

                {/* Gross Salary */}
                <TableCell align="right" sx={{ width: 120 }}>
                  <Box display="flex" flexDirection="column" alignItems="flex-end">
                    <span>{t("Gross Salary") || "Gross Salary"}</span>
                    <span style={{ fontSize: 9 }}>(LYD) | (USD)</span>
                  </Box>
                </TableCell>

                {/* Net Salary (Total) */}
                <TableCell align="right" sortDirection={sortKey === "total" ? sortDir : (false as any)} sx={{ width: 120 }}>
                  <TableSortLabel
                    active={sortKey === "total"}
                    direction={sortKey === "total" ? sortDir : "asc"}
                    onClick={() => handleSort("total")}
                  >
                    <Box display="flex" flexDirection="column" alignItems="flex-end">
                      <span>{t("Net Salary") || "Net Salary"}</span>
                      <span style={{ fontSize: 9 }}>(LYD) | (USD)</span>
                    </Box>
                  </TableSortLabel>
                </TableCell>

                <TableCell
                  align="right"
                  sx={{ width: 90, position: "sticky", right: 0, zIndex: 6, bgcolor: "background.paper" }}
                >
                  <Box display="center" alignItems="center" justifyContent="center" gap={0.5}>
                    <IconButton onClick={(e) => setColsAnchor(e.currentTarget)}>
                      <SettingsIcon fontSize="inherit" />
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {displayedRows.map((e: Payslip) => {
                const breakdown = computePayBreakdown(e.id_emp);
                const { goldGrams, goldLyd, diamondGrams, diamondLyd } = resolveCommissionFigures(e);
                const netLydVal = Math.max(0, Number((breakdown.earningsLyd - breakdown.deductionsLyd).toFixed(2)));
                const netUsdVal = Math.max(0, Number((breakdown.earningsUsd - breakdown.deductionsUsd).toFixed(2)));

                return (
                  <TableRow key={e.id_emp} hover sx={{ "&:nth-of-type(odd)": { bgcolor: "action.hover" } }}>
                    {/* Employee */}
                    <TableCell
                      sx={{
                        width: 180,
                        maxWidth: 180,
                        position: "sticky",
                        left: 0,
                        zIndex: 2,
                        bgcolor: "background.paper",
                      }}
                    >
                      <Box display="flex" alignItems="center" gap={1.25}>
                        <Avatar
                          src={`http://localhost:9000/api/employees/${e.id_emp}/picture`}
                          sx={{ width: 28, height: 28 }}
                        />
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
                              const vr =
                                (v2Rows || []).find(
                                  (x: any) => Number(x.id_emp) === Number(e.id_emp)
                                ) || {};
                              const pick = (s: any) => {
                                if (!s) return "";
                                const m = String(s).match(/(\d{1,2}):(\d{2})/);
                                return m ? m[0] : "";
                              };
                              const s1 = pick(
                                (vr as any).T_START ||
                                  (vr as any).t_start ||
                                  (vr as any).SCHEDULE_START ||
                                  (vr as any).shift_start
                              );
                              const s2 = pick(
                                (vr as any).T_END ||
                                  (vr as any).t_end ||
                                  (vr as any).SCHEDULE_END ||
                                  (vr as any).shift_end
                              );
                              const sch = s1 && s2 ? ` • ${s1}–${s2}` : "";
                              const psInfo = e.PS != null ? `• PS: ${formatPs(e.PS)}` : "";
                              const designationInfo = e.designation ? `• ${e.designation}` : "";
                              return `ID: ${e.id_emp} ${psInfo} ${designationInfo}${sch}`.trim();
                            })()}
                          </Typography>

                          {(() => {
                            // Use breakdown values instead of the removed variables
                            const commGoldLyd = breakdown.goldLyd || 0;
                            const commGoldUsd = breakdown.goldUsd || 0;
                            const commDiamondLyd = breakdown.diamondLyd || 0;
                            const commDiamondUsd = breakdown.diamondUsd || 0;

                            if (!commGoldLyd && !commDiamondLyd && !commGoldUsd && !commDiamondUsd) return null;
                            
                            const goldLydText = commGoldLyd
                              ? `${t("Gold Comm") || "Gold Comm"}: ${formatMoney(commGoldLyd)}`
                              : "";
                            const goldUsdText = commGoldUsd
                              ? `${commGoldLyd ? " (" : ""}${formatMoney(commGoldUsd)} USD${commGoldLyd ? ")" : ""}`
                              : "";
                            const diamondLydText = commDiamondLyd
                              ? `${t("Diamond Comm") || "Diamond Comm"}: ${formatMoney(commDiamondLyd)}`
                              : "";
                            const diamondUsdText = commDiamondUsd
                              ? `${commDiamondLyd ? " (" : ""}${formatMoney(commDiamondUsd)} USD${commDiamondLyd ? ")" : ""}`
                              : "";
                            const needsDivider =
                              (commGoldLyd || commGoldUsd) && (commDiamondLyd || commDiamondUsd);

                            return (
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                {goldLydText}
                                {goldUsdText ? ` ${goldUsdText}` : ""}
                                {needsDivider ? " | " : ""}
                                {diamondLydText}
                                {diamondUsdText ? ` ${diamondUsdText}` : ""}
                              </Typography>
                            );
                          })()}
                        </Box>
                      </Box>
                    </TableCell>

                    {cols.baseSalary && (
                      <TableCell align="right" sx={{ width: 110 }}>
                        {(() => {
                          const lyd = Number(e.baseSalary || 0) || 0;
                          const usd = Number((e as any).baseSalaryUsd || 0) || 0;
                          if (!lyd && !usd) return "";
                          return (
                            <Box component="span">
                              <Box component="span" sx={{ color: "#65a8bf" }}>
                                {formatMoney(lyd)}
                              </Box>
                              {usd ? (
                                <>
                                  {" | "}
                                  <Box component="span" sx={{ color: "#b7a27d" }}>
                                    {formatMoney(usd)}
                                  </Box>
                                </>
                              ) : null}
                            </Box>
                          );
                        })()}
                      </TableCell>
                    )}

        {/* P */}
        {cols.p && (
          <TableCell align="right" sx={{ width: 110 }}>
            {(() => {
              const vals = computePPhPhf(e);
              if (!vals.pLyd && !vals.pUsd) return "";
              return (
                <Box component="span">
                  <Box component="span" sx={{ color: "#65a8bf" }}>
                    {formatMoney(vals.pLyd)}
                  </Box>
                  {vals.pUsd ? (
                    <>
                      {" | "}
                      <Box component="span" sx={{ color: "#b7a27d" }}>
                        {formatMoney(vals.pUsd)}
                      </Box>
                    </>
                  ) : null}
                </Box>
              );
            })()}
          </TableCell>
        )}

        {/* PH */}
        {cols.ph && (
          <TableCell align="right" sx={{ width: 110 }}>
            {(() => {
              const vals = computePPhPhf(e);
              if (!vals.phLyd && !vals.phUsd) return "";
              return (
                <Box component="span">
                  <Box component="span" sx={{ color: "#65a8bf" }}>
                    {formatMoney(vals.phLyd)}
                  </Box>
                  {vals.phUsd ? (
                    <>
                      {" | "}
                      <Box component="span" sx={{ color: "#b7a27d" }}>
                        {formatMoney(vals.phUsd)}
                      </Box>
                    </>
                  ) : null}
                </Box>
              );
            })()}
          </TableCell>
        )}

        {/* PHF */}
        {cols.phf && (
          <TableCell align="right" sx={{ width: 110 }}>
            {(() => {
              const vals = computePPhPhf(e);
              if (!vals.phfLyd && !vals.phfUsd) return "";
              return (
                <Box component="span">
                  <Box component="span" sx={{ color: "#65a8bf" }}>
                    {formatMoney(vals.phfLyd)}
                  </Box>
                  {vals.phfUsd ? (
                    <>
                      {" | "}
                      <Box component="span" sx={{ color: "#b7a27d" }}>
                        {formatMoney(vals.phfUsd)}
                      </Box>
                    </>
                  ) : null}
                </Box>
              );
            })()}
          </TableCell>
        )}

        {/* Food */}
        {cols.food && (
          <TableCell align="right" sx={{ width: 72 }}>
            {(() => {
              const vr = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(e.id_emp)) || {};
              const foodInfo = computeFoodAllowance(e, vr);
              return Number.isFinite(foodInfo.allowance) ? formatMoney(foodInfo.allowance) : "0.00";
            })()}
          </TableCell>
        )}

        {/* Transportation */}
        {cols.fuel && (
          <TableCell align="right" sx={{ width: 72 }}>
            {(() => {
              const vr = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(e.id_emp)) || {};
              const v = Number(((e as any).FUEL ?? (vr as any).FUEL) || 0);
              return v ? formatMoney(v) : "";
            })()}
          </TableCell>
        )}

        {/* Communication */}
        {cols.comm && (
          <TableCell align="right" sx={{ width: 72 }}>
            {(() => {
              const vr = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(e.id_emp)) || {};
              const v = Number(((e as any).COMMUNICATION ?? (vr as any).COMMUNICATION) || 0);
              return v ? formatMoney(v) : "";
            })()}
          </TableCell>
        )}

        {/* Gold */}
        {cols.gold && (
          <TableCell align="right" sx={{ width: 120 }}>
            <Box component="span">
              {goldGrams > 0 ? (
                <>
                  <Box component="span" sx={{ fontWeight: 700 }}>
                    {goldGrams.toLocaleString(undefined, { maximumFractionDigits: 2 })} g
                  </Box>
                  {"  "}
                </>
              ) : null}
              <Box component="span" sx={{ color: "#65a8bf", fontWeight: 700 }}>
                {formatMoney(goldLyd)}
              </Box>
            </Box>
          </TableCell>
        )}

        {/* Diamond */}
        {cols.diamond && (
          <TableCell align="right" sx={{ width: 120 }}>
            <Box component="span">
              {diamondGrams > 0 ? (
                <>
                  <Box component="span" sx={{ fontWeight: 700 }}>
                    {diamondGrams.toLocaleString(undefined, { maximumFractionDigits: 2 })} g
                  </Box>
                  {"  "}
                </>
              ) : null}
              <Box component="span" sx={{ color: "#65a8bf", fontWeight: 700 }}>
                {formatMoney(diamondLyd)}
              </Box>
            </Box>
          </TableCell>
        )}

        {/* Watch */}
        {cols.watchComm && <TableCell align="right" sx={{ width: 84 }} />}

        {/* Salary Advance */}
        {cols.advances && (
          <TableCell align="right" sx={{ width: 78 }}>
            {(() => {
              const a = e.components?.adjustments || ({} as any);
              const advFromState = Number(advMap[e.id_emp] || 0);
              const advLocal = Number(a.advance || 0);
              const adv = advFromState || advLocal;
              const v = adv ? -Math.abs(adv) : 0;
              return v ? <Box component="span" sx={{ color: "error.main" }}>{formatMoney(v)}</Box> : "";
            })()}
          </TableCell>
        )}

        {/* Loans */}
        {cols.loans && (
          <TableCell align="right" sx={{ width: 78 }}>
            {(() => {
              const vr = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(e.id_emp)) || ({} as any);
              const remaining = Number((vr as any).remaining || (vr as any).principal || 0);
              const thisMonth = Number((vr as any).loan_credit_lyd || 0);
              const thisMonthNeg = thisMonth ? -Math.abs(thisMonth) : 0;

              if (!remaining && !thisMonthNeg) return "";

              return (
                <Box display="flex" flexDirection="column" alignItems="flex-end">
                  {thisMonthNeg ? (
                    <Box component="span" sx={{ color: "error.main" }}>
                      {formatMoney(thisMonthNeg)}
                    </Box>
                  ) : null}
                  {remaining ? <Box component="span">{formatMoney(remaining)}</Box> : null}
                </Box>
              );
            })()}
          </TableCell>
        )}

        {/* Adjustments - NEW COLUMN */}
        <TableCell align="right" sx={{ width: 90 }}>
          {(() => {
            const adjSums = adjSumsByEmp[e.id_emp] || { earnLyd: 0, earnUsd: 0, dedLyd: 0, dedUsd: 0 };
            const netAdj = (adjSums.earnLyd - adjSums.dedLyd) + (adjSums.earnUsd - adjSums.dedUsd);
            if (Math.abs(netAdj) < 0.01) return "";
            const color = netAdj > 0 ? "success.main" : "error.main";
            return (
              <Box component="span" sx={{ color }}>
                {formatMoney(Math.abs(netAdj))}
              </Box>
            );
          })()}
        </TableCell>

        {/* Absence */}
        <TableCell align="right" sx={{ width: 110 }}>
          {(() => {
            const vr = (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(e.id_emp)) || {};
            const absenceLyd = Number((vr as any).absence_lyd || 0) || 0;
            const absenceUsd = Number((vr as any).absence_usd || 0) || 0;

            // Latency minutes for this employee in the grid: use backend attendance
            // minutes so hours line up with the monetary latency_lyd value.
            const backendLatMin =
              Number((vr as any).latencyMinutes ?? (vr as any).missing_minutes ?? 0) || 0;

            // Monetary latency: use backend-calculated missing_lyd/latency_lyd
            const latLyd = Number((vr as any).missing_lyd || (vr as any).latency_lyd || 0) || 0;
            const latUsd = Number((vr as any).missing_usd || (vr as any).latency_usd || 0) || 0;

            const latHours = Math.floor(backendLatMin / 60);
            const latMins = Math.floor(backendLatMin % 60);

            // Absence DAYS: use backend absence_days so that day count
            // matches absence_lyd exactly (A, UL, and 0.5 * HL semantics).
            const absenceDays = Number((vr as any).absence_days ?? 0) || 0;

            // If there is *no* absence money and *no* latency minutes, hide the block.
            // But if there are missing minutes, still show Latency even if its money is 0.
            if (!absenceLyd && !absenceUsd && !latLyd && !latUsd && !backendLatMin) return "";

            return (
              <Box component="span" display="flex" flexDirection="column" alignItems="flex-end" gap={0.5}>
                {(absenceLyd || absenceUsd) ? (
                  <Box component="span" sx={{ color: "#f60b0bc4", fontSize: 11 }}>
                    <Box component="strong" sx={{ display: 'block', mb: 0.25 }}>
                      {t("Absence") || "Absence"}
                    </Box>
                    <Box component="span" sx={{ display: 'block', fontSize: 10 }} fontWeight="bold">
                      {absenceDays} {Math.abs(absenceDays - 1) < 0.01 ? 'day' : 'days'}
                    </Box>
                    <Box component="span" sx={{ color: "#65a8bf" }}>
                      {formatMoney(absenceLyd)}
                    </Box>
                    {absenceUsd ? (
                      <>
                        {" | "}
                        <Box component="span" sx={{ color: "#b7a27d" }}>
                          {formatMoney(absenceUsd)}
                        </Box>
                      </>
                    ) : null}
                  </Box>
                ) : null}

                {(latLyd || latUsd) ? (
                  <Box component="span" sx={{ color: "#8c6c33", fontSize: 11 }}>
                    <Box component="strong" sx={{ display: 'block', mb: 0.25 }}>
                      {t("Latency") || "Latency"}
                    </Box>
                    <Box component="span" sx={{ display: 'block', fontSize: 10, fontWeight: 600 }}>
                      {latHours}h {latMins}m
                    </Box>
                    <Box component="span" sx={{ color: "#65a8bf" }}>
                      {formatMoney(latLyd)}
                    </Box>
                    {latUsd ? (
                      <>
                        {" | "}
                        <Box component="span" sx={{ color: "#b7a27d" }}>
                          {formatMoney(latUsd)}
                        </Box>
                      </>
                    ) : null}
                  </Box>
                ) : null}
              </Box>
            );
          })()}
        </TableCell>

        {/* Gross */}
        <TableCell align="right" sx={{ width: 120 }}>
          {breakdown.grossLyd || breakdown.grossUsd ? (
            <Box component="span">
              <Box component="span" sx={{ color: "#65a8bf" }}>
                {formatMoney(breakdown.grossLyd)}
              </Box>
              {breakdown.grossUsd ? (
                <>
                  {" | "}
                  <Box component="span" sx={{ color: "#b7a27d" }}>
                    {formatMoney(breakdown.grossUsd)}
                  </Box>
                </>
              ) : null}
            </Box>
          ) : (
            ""
          )}
        </TableCell>

        {/* Net */}
        <TableCell align="right" sx={{ width: 120 }}>
          {netLydVal || netUsdVal ? (
            <Box component="span">
              <Box component="span" sx={{ color: "#65a8bf" }}>
                {formatMoney(netLydVal)}
              </Box>
              {netUsdVal ? (
                <>
                  {" | "}
                  <Box component="span" sx={{ color: "#b7a27d" }}>
                    {formatMoney(netUsdVal)}
                  </Box>
                </>
              ) : null}
            </Box>
          ) : (
            ""
          )}
        </TableCell>

        <TableCell
          align="right"
          sx={{ width: 60, position: "sticky", right: 0, zIndex: 2, bgcolor: "background.paper" }}
        >
          <Box display="flex" flexDirection="row" gap={0.5} alignItems="center" justifyContent="flex-end">
            {savingRows[e.id_emp] && <CircularProgress size={14} />}
            <IconButton
              size="small"
              color="success"
              onClick={() => exportPdfClient(e)}
            >
              <PictureAsPdfOutlinedIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() => {
                if (window.confirm(`${t("Are you sure you want to send the payslip email?") || "Are you sure you want to send the payslip email?"}`)) {
                  sendPayslipEmailClient(e);
                }
              }}
            >
              <SendOutlinedIcon fontSize="small" />
            </IconButton>
          </Box>
        </TableCell>
      </TableRow>
    );
  })}

                {/* Totals row */}
                <TableRow
                  sx={{
                    "& > *": {
                      position: "sticky",
                      bottom: 0,
                      bgcolor: "background.paper",
                      zIndex: 3,
                    },
                    "& > *:first-of-type": {
                      left: 0,
                      zIndex: 7,
                    },
                    "& > *:last-of-type": {
                      right: 0,
                      zIndex: 7,
                    },
                  }}
                >
                  <TableCell sx={{ position: "sticky", left: 0, bottom: 0, zIndex: 7, bgcolor: "background.paper" }}>
                    <strong style={{ fontSize: 16 }}>{t("Totals") || "Totals"}</strong>
                  </TableCell>

                  {cols.baseSalary && (
                    <TableCell align="right">
                      <strong>
                        <Box component="span">
                          <Box component="span" sx={{ color: "#65a8bf" }}>
                            {formatMoney(totals.baseSalary)}
                          </Box>
                          {totals.baseSalaryUsd ? (
                            <>
                              {" | "}
                              <Box component="span" sx={{ color: "#b7a27d" }}>
                                {formatMoney(totals.baseSalaryUsd)}
                              </Box>
                            </>
                          ) : null}
                        </Box>
                      </strong>
                    </TableCell>
                  )}

                  {cols.p && (
                    <TableCell align="right">
                      <strong>
                        <Box component="span">
                          <Box component="span" sx={{ color: "#65a8bf" }}>
                            {formatMoney(totals.pLyd)}
                          </Box>
                          {totals.pUsd ? (
                            <>
                              {" | "}
                              <Box component="span" sx={{ color: "#b7a27d" }}>
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
                          <Box component="span" sx={{ color: "#65a8bf" }}>
                            {formatMoney(totals.phLyd)}
                          </Box>
                          {totals.phUsd ? (
                            <>
                              {" | "}
                              <Box component="span" sx={{ color: "#b7a27d" }}>
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
                          <Box component="span" sx={{ color: "#65a8bf" }}>
                            {formatMoney(totals.phfLyd)}
                          </Box>
                          {totals.phfUsd ? (
                            <>
                              {" | "}
                              <Box component="span" sx={{ color: "#b7a27d" }}>
                                {formatMoney(totals.phfUsd)}
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

                  {cols.gold && (
                    <TableCell align="right">
                      <strong>
                        <Box component="span">
                          {totalsGold.grams > 0 ? (
                            <>
                              <Box component="span" sx={{ fontWeight: 700 }}>
                                {totalsGold.grams.toLocaleString(undefined, { maximumFractionDigits: 2 })} g
                              </Box>
                              {"  "}
                            </>
                          ) : null}
                          <Box component="span" sx={{ color: "#65a8bf" }}>
                            {formatMoney(totalsGold.lyd)}
                          </Box>
                        </Box>
                      </strong>
                    </TableCell>
                  )}

                  {cols.diamond && (
                    <TableCell align="right">
                      <strong>
                        <Box component="span">
                          {totalsDiamond.grams > 0 ? (
                            <>
                              <Box component="span" sx={{ fontWeight: 700 }}>
                                {totalsDiamond.grams.toLocaleString(undefined, { maximumFractionDigits: 2 })} g
                              </Box>
                              {"  "}
                            </>
                          ) : null}
                          <Box component="span" sx={{ color: "#65a8bf" }}>
                            {formatMoney(totalsDiamond.lyd)}
                          </Box>
                        </Box>
                      </strong>
                    </TableCell>
                  )}

                  {cols.watchComm && <TableCell align="right" />}

                  {cols.advances && (
                    <TableCell align="right">
                      {(() => {
                        const sum = (displayedRows || []).reduce((acc, e) => {
                          const a = e.components?.adjustments || ({} as any);
                          const advFromState = Number(advMap[e.id_emp] || 0);
                          const advLocal = Number(a.advance || 0);
                          const adv = advFromState || advLocal;
                          const v = adv ? -Math.abs(adv) : 0;
                          return acc + v;
                        }, 0);

                        return (
                          <Box component="strong" sx={{ color: sum < 0 ? "error.main" : undefined }}>
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
                            (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(e.id_emp)) || ({} as any);
                          totalRemaining += Number((vr as any).remaining || (vr as any).principal || 0);
                          totalThisMonth += Number((vr as any).loan_credit_lyd || 0);
                        });

                        const totalThisMonthNeg = totalThisMonth ? -Math.abs(totalThisMonth) : 0;

                        return (
                          <Box display="flex" flexDirection="column" alignItems="flex-end" component="strong">
                            <Box component="span" sx={{ color: totalThisMonthNeg < 0 ? "error.main" : undefined }}>
                              {formatMoney(totalThisMonthNeg)}
                            </Box>
                            <Box component="span">{formatMoney(totalRemaining)}</Box>
                          </Box>
                        );
                      })()}
                    </TableCell>
                  )}

                  {/* Adjustments */}
                  <TableCell align="right">
                    {(() => {
                      const adj = totals.adj || 0;
                      if (!adj) return "";
                      const color = adj > 0 ? "success.main" : "error.main";
                      return (
                        <Box component="strong" sx={{ color }}>
                          {formatMoney(adj)}
                        </Box>
                      );
                    })()}
                  </TableCell>

                  {/* In the totals row, update the absence/latency cell */}
                  <TableCell align="right">
                    <Box component="span" display="flex" flexDirection="column" alignItems="flex-end">
                      {/* Absence total */}
                      <Box component="span">
                        <strong>
                          <Box component="span" sx={{ color: "#65a8bf" }}>
                            {formatMoney(totals.absenceLyd)}
                          </Box>
                          {totals.absenceUsd ? (
                            <>
                              {" | "}
                              <Box component="span" sx={{ color: "#b7a27d" }}>
                                {formatMoney(totals.absenceUsd)}
                              </Box>
                            </>
                          ) : null}
                        </strong>
                        <Typography variant="caption" component="span" sx={{ display: "block", color: "text.secondary" }}>
                          {t("Absence") || "Absence"}
                        </Typography>
                      </Box>
                      
                      {/* Latency total */}
                      <Box component="span" sx={{ mt: 1 }}>
                        <strong>
                          <Box component="span" sx={{ color: "#65a8bf" }}>
                            {formatMoney(totals.latencyLyd)}
                          </Box>
                          {totals.latencyUsd ? (
                            <>
                              {" | "}
                              <Box component="span" sx={{ color: "#b7a27d" }}>
                                {formatMoney(totals.latencyUsd)}
                              </Box>
                            </>
                          ) : null}
                        </strong>
                        <Typography variant="caption" component="span" sx={{ display: "block", color: "text.secondary" }}>
                          {t("Latency") || "Latency"} ({Math.floor(totals.latencyMinutes / 60)}h {Math.floor(totals.latencyMinutes % 60)}m)
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>

                  <TableCell align="right">
                    <strong>
                      <Box component="span">
                        <Box component="span" sx={{ color: "#65a8bf" }}>
                          {formatMoney(totals.grossLyd)}
                        </Box>
                        {totals.grossUsd ? (
                          <>
                            {" | "}
                            <Box component="span" sx={{ color: "#b7a27d" }}>
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
                        <Box component="span" sx={{ color: "#65a8bf" }}>
                          {formatMoney(totals.totalLyd)}
                        </Box>
                        {totals.totalUsd ? (
                          <>
                            {" | "}
                            <Box component="span" sx={{ color: "#b7a27d" }}>
                              {formatMoney(totals.totalUsd)}
                            </Box>
                          </>
                        ) : null}
                      </Box>
                    </strong>
                  </TableCell>

                  <TableCell
                    align="right"
                    sx={{ position: "sticky", right: 0, bottom: 0, zIndex: 7, bgcolor: "background.paper" }}
                  >
                    —
                  </TableCell>
                </TableRow>
                </TableBody>
                </Table>
                </TableContainer>
                </CardContent>
                </Card>
                )}

                <Menu
                  anchorEl={colsAnchor}
                  open={Boolean(colsAnchor)}
                  onClose={() => setColsAnchor(null)}
                  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                  transformOrigin={{ vertical: "top", horizontal: "right" }}
                >
                  <Box px={1} py={0.5} display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={0.5}>
                    {(
                      [
                        ["holidayWorked", "Holiday Worked"],
                        ["p", "P (LYD|USD)"],
                        ["ph", "PH (LYD|USD)"],
                        ["phf", "PHF (LYD|USD)"],
                        ["baseSalary", "Base"],
                        ["food", "Food"],
                        ["fuel", "Fuel"],
                        ["comm", "Communication"],
                        ["advances", "S. Adv"],
                        ["loans", "Loans"],
                        ["salesQty", "Sales Qty"],
                        ["salesTotal", "Sales Total"],
                        ["gold", "Gold Bonus"],
                        ["diamond", "Diamond Bonus"],
                        ["watchComm", "Watch Comm"],
                        ["totalUsd", "Total USD"],
                      ] as Array<[keyof typeof cols, string]>
                    ).map(([k, label]) => (
                      <FormControlLabel
                        key={String(k)}
                        control={
                          <Checkbox
                            size="small"
                            checked={Boolean((cols as any)[k])}
                            onChange={(e) => setCols((c: any) => ({ ...c, [k]: e.target.checked }))}
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
                  maxWidth="xl"
                  PaperProps={{ sx: { width: 'min(1400px, 95vw)' } }}
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
                        <Typography>{t("hr.timesheets.loading") || "Loading..."}</Typography>
                      </Box>
                    )}

                    {!calLoading && calDays && (
                      <Box>
                        <Box sx={{ mb: 2, p: 1.5, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>
                            {t("Attendance & Leave Codes") || "Attendance & Leave Codes"}:
                          </Typography>
                          <Box display="flex" flexWrap="wrap" gap={1.5}>
                            <Typography variant="caption">P: Present</Typography>
                            <Typography variant="caption">A: Absent</Typography>
                            <Typography variant="caption">PH: Holiday (partial)</Typography>
                            <Typography variant="caption">PHF: Holiday (full)</Typography>
                            <Typography variant="caption">PT: Short Hours</Typography>
                            <Typography variant="caption">PL: Late</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: stableColorFromCode("AL") }}>AL: Annual Leave</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: stableColorFromCode("SL") }}>SL: Sick Leave</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: stableColorFromCode("EL") }}>EL: Emergency</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: stableColorFromCode("ML") }}>ML: Maternity</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: stableColorFromCode("UL") }}>UL: Unpaid</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: stableColorFromCode("HL") }}>HL: Half Day</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: stableColorFromCode("XL") }}>XL: Exam Leave</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: stableColorFromCode("BM") }}>BM: Bereavement</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: stableColorFromCode("B1") }}>B1: Bereavement 1</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: stableColorFromCode("B2") }}>B2: Bereavement 2</Typography>
                          </Box>
                        </Box>

                        <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" gap={1}>
                          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                            <Box key={d} sx={{ fontWeight: 600, textAlign: "center" }}>
                              {d}
                            </Box>
                          ))}

                          {(() => {
                            const first = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
                            const dow = first.day();
                            const startIdx = (dow + 6) % 7;
                            const dim = new Date(year, month, 0).getDate();
                            const cells: React.ReactNode[] = [];

                            for (let i = 0; i < startIdx; i++) {
                              cells.push(
                                <Box
                                  key={`e${i}`}
                                  sx={{ p: 1, minHeight: 80, bgcolor: "background.default", border: "1px solid", borderColor: "divider" }}
                                />
                              );
                            }

                            const vrForEmp =
                              (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(calEmp?.id_emp)) || {};

                            const schStartMin = (() => {
                              const s = (vrForEmp as any).T_START || (vrForEmp as any).t_start;
                              if (!s) return null;
                              const m = String(s).match(/(\d{1,2}):(\d{2})/);
                              if (!m) return null;
                              return Number(m[1]) * 60 + Number(m[2]);
                            })();

                            const schEndMin = (() => {
                              const s = (vrForEmp as any).T_END || (vrForEmp as any).t_end;
                              if (!s) return null;
                              const m = String(s).match(/(\d{1,2}):(\d{2})/);
                              if (!m) return null;
                              return Number(m[1]) * 60 + Number(m[2]);
                            })();

                            const timeHM = (v: any): string => {
                              if (!v) return "";
                              const m = String(v).match(/(\d{1,2}):(\d{2})/);
                              if (!m) return "";
                              const hh = String(m[1]).padStart(2, '0');
                              const mm = String(m[2]).padStart(2, '0');
                              return `${hh}:${mm}`;
                            };

                            for (let d = 1; d <= dim; d++) {
                              const day = calDays[d - 1];
                              const ymd = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                              const vac = (calVacations || []).find((v) => {
                                const st = safeISO10((v as any).date_depart);
                                const en = safeISO10((v as any).date_end);
                                const stateLower = String((v as any).state || '').toLowerCase();
                                const okState = stateLower === 'approved' || stateLower.includes('موافق');
                                return okState && ymd >= st && ymd <= en;
                              });
                              const vacIdKey = vac && (vac as any).id_can != null ? String((vac as any).id_can) : undefined;
                              const vacLt = vacIdKey ? leaveTypeMap[vacIdKey] : undefined;
                              const vacCode = vac ? String(vacLt?.code || (vac as any).type || 'V').toUpperCase() : '';

                              // Resolve approved leave code (prefer leaveRequestsCache, fallback to Vacation records)
                              const leaveCode = (() => {
                                const empId = Number(calEmp?.id_emp);
                                const reqs = empId ? leaveRequestsCache[empId] : null;
                                if (Array.isArray(reqs) && reqs.length) {
                                  for (const leave of reqs) {
                                    const status = String((leave as any).status || (leave as any).state || '').toLowerCase();
                                    if (!status.includes('approved') && !status.includes('موافق') && !status.includes('accepted')) continue;
                                    const st = (leave as any).startDate ?? (leave as any).DATE_START ?? (leave as any).date_depart;
                                    const en = (leave as any).endDate ?? (leave as any).DATE_END ?? (leave as any).date_end;
                                    if (!st || !en) continue;
                                    const stYmd = safeISO10(st);
                                    const enYmd = safeISO10(en);
                                    if (ymd < stYmd || ymd > enYmd) continue;

                                    const directCode = String((leave as any).code || (leave as any).leaveType || (leave as any).leaveTypeCode || '').toUpperCase();
                                    if (directCode) return directCode;

                                    const idCan = (leave as any).id_can ?? (leave as any).ID_CAN ?? (leave as any).typeCode;
                                    if (idCan != null) {
                                      const lt = leaveTypeMap[String(idCan)];
                                      if (lt?.code) return String(lt.code).toUpperCase();
                                    }

                                    return 'V';
                                  }
                                }
                                return vacCode || '';
                              })();

                              const badge0 = codeBadge(day, schStartMin, schEndMin, calEmp?.id_emp);
                              const present = !!day?.present;
                              const isFri = dayjs(ymd).day() === 5;
                              const isHol = holidaySet.has(ymd) || !!day?.isHoliday || badge0 === 'PH' || badge0 === 'PHF';

                              const holidayBadge = isHol
                                ? (badge0 === 'PH' || badge0 === 'PHF')
                                    ? badge0
                                    : present
                                        ? 'PH'
                                        : 'H'
                                : '';

                              const badge =
                                (isFri || isHol)
                                  ? (isHol ? holidayBadge : badge0)
                                  : (leaveCode && (badge0 === 'A' || badge0 === 'P' || badge0 === ''))
                                      ? leaveCode
                                      : badge0;
                              const dm = Number(day?.deltaMin ?? 0);
                              const delta = dm < 0 && Math.abs(dm) > 30 ? roundedHoursWithSign(dm) : "";
                              const leaveDesc = (day as any)?.leave_description || (day as any)?.leaveDescription || "";

                              const isLeave = ["AL", "SL", "EL", "ML", "UL", "HL", "BM", "XL", "B1", "B2"].includes(String(badge));
                              
                              // Get leave color from leaveTypeMap or stableColorFromCode (matching CalendarLogScreen.tsx)
                              const getLeaveColor = (code: string) => {
                                const c = code.toUpperCase();
                                // Check if we have this code in leaveTypeMap by searching values
                                const entry = Object.values(leaveTypeMap).find(e => e.code === c);
                                if (entry?.color) return entry.color;
                                return stableColorFromCode(c);
                              };

                              // Backend-authoritative effective days (excludes Fridays + expanded holidays, except sick leave)
                              const effectiveDays = vac ? Number((vac as any).effectiveDays ?? 0) : 0;

                              const leaveAccent = isLeave ? getLeaveColor(badge) : (leaveCode ? getLeaveColor(leaveCode) : '');
                              const vacAccent = vacCode ? getLeaveColor(vacCode) : '';

                              cells.push(
                                <Box
                                  key={`d${d}`}
                                  sx={(theme) => {
                                    const holidayBg = hexToRgba('#b7a27d', 0.22);
                                    const fridayBg = 'rgba(0,0,0,0.06)';
                                    const leaveBg = leaveAccent ? hexToRgba(leaveAccent, 0.16) : '';
                                    const vacBg = vacAccent ? hexToRgba(vacAccent, 0.12) : '';
                                    const bgColor =
                                      isHol ? holidayBg :
                                      (isFri && !present) ? fridayBg :
                                      isLeave ? (leaveBg || theme.palette.action.hover) :
                                      (vac ? (vacBg || theme.palette.action.hover) : theme.palette.background.default);

                                    const crossOut = (isHol && badge === 'H') || (isFri && !present);

                                    return {
                                      p: 1,
                                      minHeight: 80,
                                      bgcolor: bgColor,
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      position: 'relative',
                                      color: 'text.primary',
                                      ...(isLeave || vac ? { borderLeft: `4px solid ${leaveAccent || vacAccent || theme.palette.divider}` } : {}),
                                      ...(crossOut
                                        ? {
                                            '&:after': {
                                              content: '""',
                                              position: 'absolute',
                                              left: 6,
                                              right: 6,
                                              top: '50%',
                                              borderTop: `2px solid ${isHol ? '#b7a27d' : '#bdbdbd'}`,
                                              transform: 'rotate(-18deg)',
                                              transformOrigin: 'center',
                                              opacity: 0.9,
                                              pointerEvents: 'none',
                                            },
                                          }
                                        : {}),
                                    };
                                  }}
                                >
                                  <Box display="flex" justifyContent="space-between">
                                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                      {d}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        fontWeight: 700,
                                        color: badge === 'H' ? '#b7a27d' : 'text.primary',
                                      }}
                                    >
                                      {badge}
                                    </Typography>
                                  </Box>

                                  {isLeave && (
                                    <Box sx={{ mt: 0.5 }}>
                                      {effectiveDays > 0 && (
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            display: "block",
                                            fontSize: "0.6rem",
                                            color: 'text.secondary',
                                            fontWeight: 500,
                                          }}
                                        >
                                          {effectiveDays} working {effectiveDays === 1 ? 'day' : 'days'}
                                        </Typography>
                                      )}
                                      {leaveDesc && (
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            display: "block",
                                            fontSize: "0.6rem",
                                            color: "text.secondary",
                                            fontStyle: "italic",
                                          }}
                                        >
                                          {leaveDesc}
                                        </Typography>
                                      )}
                                    </Box>
                                  )}

                                  {day?.entry ? (
                                    <Typography variant="caption">
                                      {timeHM(day.entry)} →{" "}
                                      {day?.exit ? timeHM(day.exit) : "--:--"}
                                    </Typography>
                                  ) : null}

                                  {delta && Number(delta.replace(/[^\d.-]/g, '')) < 0 ? (
                                    <Typography variant="caption" sx={{ display: "block", color: "error.main" }}>
                                      Δ {delta}
                                    </Typography>
                                  ) : null}
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
                    <Button onClick={() => setCalOpen(false)}>{t("common.close") || "Close"}</Button>
                  </DialogActions>
                </Dialog>

                <Dialog
                  open={sendDialogOpen}
                  onClose={() => setSendDialogOpen(false)}
                  fullWidth
                  maxWidth="lg"
                  PaperProps={{ sx: { width: 'min(1100px, 92vw)' } }}
                >
                  <DialogTitle>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      {t("Send Payslips") || "Send Payslips"}
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          const allSelected = (displayedRows || []).every((e) => sendSelection[e.id_emp]);
                          const newSelection: Record<number, boolean> = {};
                          (displayedRows || []).forEach((emp) => {
                            newSelection[emp.id_emp] = !allSelected;
                          });
                          setSendSelection(newSelection);
                        }}
                      >
                        {(() => {
                          const allSelected = (displayedRows || []).every((e) => sendSelection[e.id_emp]);
                          return allSelected ? (t("Deselect All") || "Deselect All") : (t("Select All") || "Select All");
                        })()}
                      </Button>
                    </Box>
                  </DialogTitle>
                  <DialogContent dividers>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {t("Select employees to send payslips to for this period.") ||
                        "Select employees to send payslips to for this period."}
                    </Typography>
                    <Box sx={{ maxHeight: 400, overflow: "auto" }}>
                      {(() => {
                        const employeesByPs: Record<string, any[]> = {};
                        (displayedRows || []).forEach((emp) => {
                          const ps = formatPs(emp.PS) || emp.PS || 'Unknown';
                          if (!employeesByPs[ps]) employeesByPs[ps] = [];
                          employeesByPs[ps].push(emp);
                        });
                        // Sort employees within each PS by ID
                        Object.keys(employeesByPs).forEach((ps: string) => {
                          employeesByPs[ps].sort((a: any, b: any) => a.id_emp - b.id_emp);
                        });
                        // Sort PS groups
                        const sortedPsKeys = Object.keys(employeesByPs).sort((a: string, b: string) => {
                          if (a === 'Unknown') return 1;
                          if (b === 'Unknown') return -1;
                          const aNum = Number(a.replace('P', ''));
                          const bNum = Number(b.replace('P', ''));
                          if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
                          return a.localeCompare(b);
                        });

                        return sortedPsKeys.map((ps: string, index: number) => (
                          <Box key={ps} sx={{ mb: 2 }}>
                            {index > 0 && (
                              <Divider sx={{ mb: 2, borderColor: 'divider' }} />
                            )}
                            <Box display="flex" justifyContent="center" sx={{ mb: 1 }}>
                              <Typography variant="subtitle2" sx={{ 
                                fontWeight: 600, 
                                color: 'primary.main',
                                px: 2,
                                py: 0.5,
                                bgcolor: 'background.paper',
                                borderRadius: 1,
                                border: 1,
                                borderColor: 'primary.light'
                              }}>
                                {ps === 'Unknown' ? (t("Unknown PS") || "Unknown PS") : ps}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 1 }}>
                              {employeesByPs[ps].map((emp: any) => (
                                <FormControlLabel
                                  key={emp.id_emp}
                                  control={
                                    <Checkbox
                                      size="small"
                                      checked={!!sendSelection[emp.id_emp]}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setSendSelection((prev) => ({ ...prev, [emp.id_emp]: checked }));
                                      }}
                                    />
                                  }
                                  label={
                                    <Box>
                                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        {nameMap[emp.id_emp] ?? emp.name}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        ID: {emp.id_emp}
                                      </Typography>
                                    </Box>
                                  }
                                  sx={{ alignItems: 'flex-start', py: 0.5 }}
                                />
                              ))}
                            </Box>
                          </Box>
                        ));
                      })()}
                    </Box>
                  </DialogContent>
                  <DialogActions>
                    <Box display="flex" justifyContent="space-between" width="100%">
                      <Typography variant="body2" color="text.secondary">
                        {(displayedRows || []).filter((e) => sendSelection[e.id_emp]).length} {(displayedRows || []).filter((e) => sendSelection[e.id_emp]).length === 1 ? (t("employee selected") || "employee selected") : (t("employees selected") || "employees selected")}
                      </Typography>
                      <Box>
                        <Button onClick={() => setSendDialogOpen(false)}>{t("Cancel") || "Cancel"}</Button>
                        <Button
                          variant="contained"
                          onClick={async () => {
                            const list = (displayedRows || []).filter((e) => sendSelection[e.id_emp]);
                            if (!list.length) {
                              alert(t("No employees selected") || "No employees selected");
                              return;
                            }
                            const confirmed = window.confirm(`${t("Are you sure you want to send payslips to") || "Are you sure you want to send payslips to"} ${list.length} ${list.length === 1 ? (t("employee") || "employee") : (t("employees") || "employees")}?`);
                            if (!confirmed) return;
                            
                            try {
                              for (const emp of list) {
                                await sendPayslipEmailClient(emp);
                              }
                              alert(t("Payslips sent") || "Payslips sent");
                            } catch (e: any) {
                              alert(e?.message || "Failed to send some payslips");
                            } finally {
                              setSendDialogOpen(false);
                            }
                          }}
                        >
                          {t("Send") || "Send"}
                        </Button>
                      </Box>
                    </Box>
                  </DialogActions>
                </Dialog>

                <Dialog
                  open={rowEditOpen}
                  onClose={() => setRowEditOpen(false)}
                  fullWidth
                  maxWidth="lg"
                  PaperProps={{ sx: { width: 'min(1100px, 92vw)' } }}
                >
                  <DialogTitle>
                    {t("Adjustments") || "Adjustments"} — {String(rowEdit?.name || rowEdit?.id_emp || "")}
                  </DialogTitle>
                  <DialogContent>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                      {t("Autosaves on change") || "Autosaves on change"}
                    </Typography>
                    <Box
                      display="grid"
                      gap={1.25}
                      sx={{
                        gridTemplateColumns: {
                          xs: '1fr',
                          sm: 'repeat(2, 1fr)',
                        },
                      }}
                    >
                      <TextField
                        size="small"
                        type="number"
                        label="Gold Bonus (LYD)"
                        disabled={viewOnly}
                        value={rowForm.gold_bonus_lyd ?? 0}
                        onChange={(e) => {
                          const v = toN(e.target.value);
                          setRowForm((f: any) => ({ ...f, gold_bonus_lyd: v }));
                          if (rowEdit) {
                            applyRowForm(rowEdit.id_emp, { gold_bonus_lyd: v });
                            queueAutoSave(rowEdit.id_emp);
                          }
                        }}
                        fullWidth
                      />
                      <TextField
                        size="small"
                        type="number"
                        label="Diamond Bonus (LYD)"
                        disabled={viewOnly}
                        value={rowForm.diamond_bonus_lyd ?? 0}
                        onChange={(e) => {
                          const v = toN(e.target.value);
                          setRowForm((f: any) => ({ ...f, diamond_bonus_lyd: v }));
                          if (rowEdit) {
                            applyRowForm(rowEdit.id_emp, { diamond_bonus_lyd: v });
                            queueAutoSave(rowEdit.id_emp);
                          }
                        }}
                        fullWidth
                      />
                      <TextField
                        size="small"
                        type="number"
                        label="Other Bonus 1 (LYD)"
                        disabled={viewOnly}
                        value={rowForm.other_bonus1_lyd ?? 0}
                        onChange={(e) => {
                          const v = toN(e.target.value);
                          setRowForm((f: any) => ({ ...f, other_bonus1_lyd: v }));
                          if (rowEdit) {
                            applyRowForm(rowEdit.id_emp, { other_bonus1_lyd: v });
                            queueAutoSave(rowEdit.id_emp);
                          }
                        }}
                        fullWidth
                      />
                      <TextField
                        size="small"
                        label="Other Bonus 1 Account"
                        disabled={viewOnly}
                        value={rowForm.other_bonus1_acc ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRowForm((f: any) => ({ ...f, other_bonus1_acc: v }));
                          if (rowEdit) {
                            applyRowForm(rowEdit.id_emp, { other_bonus1_acc: v });
                            queueAutoSave(rowEdit.id_emp);
                          }
                        }}
                        fullWidth
                      />
                      <TextField
                        size="small"
                        type="number"
                        label="Other Bonus 2 (LYD)"
                        disabled={viewOnly}
                        value={rowForm.other_bonus2_lyd ?? 0}
                        onChange={(e) => {
                          const v = toN(e.target.value);
                          setRowForm((f: any) => ({ ...f, other_bonus2_lyd: v }));
                          if (rowEdit) {
                            applyRowForm(rowEdit.id_emp, { other_bonus2_lyd: v });
                            queueAutoSave(rowEdit.id_emp);
                          }
                        }}
                        fullWidth
                      />
                      <TextField
                        size="small"
                        label="Other Bonus 2 Account"
                        disabled={viewOnly}
                        value={rowForm.other_bonus2_acc ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRowForm((f: any) => ({ ...f, other_bonus2_acc: v }));
                          if (rowEdit) {
                            applyRowForm(rowEdit.id_emp, { other_bonus2_acc: v });
                            queueAutoSave(rowEdit.id_emp);
                          }
                        }}
                        fullWidth
                      />
                      <TextField
                        size="small"
                        type="number"
                        label="Other Additions (LYD)"
                        disabled={viewOnly}
                        value={rowForm.other_additions_lyd ?? 0}
                        onChange={(e) => {
                          const v = toN(e.target.value);
                          setRowForm((f: any) => ({ ...f, other_additions_lyd: v }));
                          if (rowEdit) {
                            applyRowForm(rowEdit.id_emp, { other_additions_lyd: v });
                            queueAutoSave(rowEdit.id_emp);
                          }
                        }}
                        fullWidth
                      />
                      <TextField
                        size="small"
                        type="number"
                        label="Other Deductions (LYD)"
                        disabled={viewOnly}
                        value={rowForm.other_deductions_lyd ?? 0}
                        onChange={(e) => {
                          const v = toN(e.target.value);
                          setRowForm((f: any) => ({ ...f, other_deductions_lyd: v }));
                          if (rowEdit) {
                            applyRowForm(rowEdit.id_emp, { other_deductions_lyd: v });
                            queueAutoSave(rowEdit.id_emp);
                          }
                        }}
                        fullWidth
                      />
                      <TextField
                        size="small"
                        type="number"
                        label="Loan Debit (LYD)"
                        disabled={viewOnly}
                        value={rowForm.loan_debit_lyd ?? 0}
                        onChange={(e) => {
                          const v = toN(e.target.value);
                          setRowForm((f: any) => ({ ...f, loan_debit_lyd: v }));
                          if (rowEdit) {
                            applyRowForm(rowEdit.id_emp, { loan_debit_lyd: v });
                            queueAutoSave(rowEdit.id_emp);
                          }
                        }}
                        fullWidth
                      />
                      <TextField
                        size="small"
                        type="number"
                        label="Loan Credit (LYD)"
                        disabled={viewOnly}
                        value={rowForm.loan_credit_lyd ?? 0}
                        onChange={(e) => {
                          const v = toN(e.target.value);
                          setRowForm((f: any) => ({ ...f, loan_credit_lyd: v }));
                          if (rowEdit) {
                            applyRowForm(rowEdit.id_emp, { loan_credit_lyd: v });
                            queueAutoSave(rowEdit.id_emp);
                          }
                        }}
                        fullWidth
                      />
                    </Box>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => setRowEditOpen(false)}>{t("common.close") || "Close"}</Button>
                  </DialogActions>
                </Dialog>

                <Dialog
                  open={bdOpen}
                  onClose={() => setBdOpen(false)}
                  fullWidth
                  maxWidth="md"
                  PaperProps={{ sx: { width: 'min(900px, 92vw)' } }}
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
                                  ? r.lyd.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                  : ""}
                              </TableCell>
                            )}
                            {bdShowUsd && (
                              <TableCell align="right">
                                {r.usd
                                  ? r.usd.toLocaleString(undefined, { maximumFractionDigits: 2 })
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
                    <Button onClick={() => setBdOpen(false)}>{t("common.close") || "Close"}</Button>
                  </DialogActions>
                </Dialog>

                <Dialog
                  open={payoffOpen}
                  onClose={() => {
                    setPayoffOpen(false);
                    setPayoffAmt("");
                    setActiveLoan(null);
                  }}
                  fullWidth
                  maxWidth="sm"
                  PaperProps={{ sx: { width: 'min(650px, 92vw)' } }}
                >
                  <DialogTitle>{t("Payoff loan") || "Payoff loan"}</DialogTitle>
                  <DialogContent>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {t("Enter an amount to make a partial payoff, or leave blank to payoff the remaining balance.") ||
                        "Enter an amount to make a partial payoff, or leave blank to payoff the remaining balance."}
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label={t("LYD") || "LYD"}
                      placeholder={t("Leave blank for full payoff") || "Leave blank for full payoff"}
                      value={payoffAmt}
                      onChange={(e) => setPayoffAmt(e.target.value)}
                      inputProps={{ step: "0.01" }}
                    />
                  </DialogContent>
                  <DialogActions>
                    <Button
                      onClick={() => {
                        setPayoffOpen(false);
                        setPayoffAmt("");
                        setActiveLoan(null);
                      }}
                    >
                      {t("common.cancel") || "Cancel"}
                    </Button>
                    <Button
                      variant="contained"
                      onClick={async () => {
                        if (!adjEmpId || !activeLoan) {
                          setPayoffOpen(false);
                          return;
                        }
                        try {
                          const body: any = { loanId: activeLoan.id, employeeId: adjEmpId };
                          const amt = Number(payoffAmt);
                          if (!isNaN(amt) && payoffAmt !== "") body.amount = amt;
                          await payoffV2Loan(body);
                          const js = await listV2Loans(adjEmpId);
                          setLoanRows(js?.rows || []);
                          alert(t("Payoff recorded") || "Payoff recorded");
                        } catch (e: any) {
                          alert(e?.message || "Failed");
                        } finally {
                          setPayoffOpen(false);
                          setPayoffAmt("");
                          setActiveLoan(null);
                        }
                      }}
                    >
                      {t("Confirm") || "Confirm"}
                    </Button>
                  </DialogActions>
                </Dialog>

                <Dialog
                  open={adjDeleteOpen}
                  onClose={() => {
                    if (adjLoading) return;
                    setAdjDeleteOpen(false);
                    setAdjDeleteId(null);
                  }}
                  fullWidth
                  maxWidth="xs"
                >
                  <DialogTitle>{t("Confirm") || "Confirm"}</DialogTitle>
                  <DialogContent>
                    <Typography>
                      {t("Delete this reimbursement?") || "Delete this reimbursement?"}
                    </Typography>
                  </DialogContent>
                  <DialogActions>
                    <Button
                      onClick={() => {
                        setAdjDeleteOpen(false);
                        setAdjDeleteId(null);
                      }}
                      disabled={adjLoading}
                    >
                      {t("common.cancel") || "Cancel"}
                    </Button>
                    <Button
                      color="error"
                      variant="contained"
                      onClick={async () => {
                        if (!adjDeleteId) {
                          setAdjDeleteOpen(false);
                          return;
                        }
                        await deleteAdjustment(adjDeleteId);
                        setAdjDeleteOpen(false);
                        setAdjDeleteId(null);
                      }}
                      disabled={adjLoading}
                    >
                      {t("Delete") || "Delete"}
                    </Button>
                  </DialogActions>
                </Dialog>

                <Dialog
                  open={adjOpen}
                  onClose={() => setAdjOpen(false)}
                  fullWidth
                  maxWidth="md"
                  PaperProps={{ sx: { width: 'min(900px, 92vw)' } }}
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

                          {(() => {
                            const isDeduction = (r: any) => {
                              const dir = String(r?.direction || '').toUpperCase();
                              const type = String(r?.type || '').toLowerCase();
                              return dir === 'DEDUCT' || type === 'deduction';
                            };

                            const renderRow = (r: any, idx: number) => {
                              const opt = adjTypeOptions.find((o) => o.value === r.type);
                              const label = String(r.label || opt?.label || r.type || '').trim();
                              const amt = Number(r.amount || 0).toFixed(2);
                              const dateStr = r.ts ? dayjs(r.ts).format('YYYY-MM-DD HH:mm') : '';
                              return (
                                <Box
                                  key={`${String(r.id ?? idx)}-${idx}`}
                                  display="flex"
                                  justifyContent="space-between"
                                  alignItems="flex-start"
                                  sx={{ py: 0.5, borderBottom: "1px dashed", borderColor: "divider" }}
                                >
                                  <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                      {label}
                                    </Typography>
                                    {r.note ? (
                                      <Typography variant="body2" color="text.secondary">
                                        {r.note}
                                      </Typography>
                                    ) : null}
                                    {dateStr ? (
                                      <Typography variant="caption" color="text.secondary">
                                        {dateStr}
                                      </Typography>
                                    ) : null}
                                  </Box>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {r.currency} {amt}
                                  </Typography>
                                </Box>
                              );
                            };

                            const earnings = (adjRows || []).filter((r) => r && !isDeduction(r));
                            const deductions = (adjRows || []).filter((r) => r && isDeduction(r));

                            return (
                              <>
                                {earnings.length > 0 && (
                                  <Box mb={1}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                                      {t('EARNINGS') || 'EARNINGS'}
                                    </Typography>
                                    {earnings.map((r, idx) => renderRow(r, idx))}
                                  </Box>
                                )}
                                {deductions.length > 0 && (
                                  <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                                      {t('DEDUCTIONS') || 'DEDUCTIONS'}
                                    </Typography>
                                    {deductions.map((r, idx) => renderRow(r, idx))}
                                  </Box>
                                )}
                              </>
                            );
                          })()}

                          {Object.keys(adjTypeTotals).length > 0 ? (
                            <Box
                              mt={1.5}
                              p={1}
                              sx={{ borderRadius: 1, border: "1px solid", borderColor: "divider", bgcolor: "background.default" }}
                            >
                              <Typography variant="subtitle2" gutterBottom>
                                {t("Totals this month") || "Totals this month"}
                              </Typography>
                              {Object.entries(adjTypeTotals).map(([type, totals]) => {
                                const opt = adjTypeOptions.find((o) => o.value === type);
                                const label = opt?.label || type;
                                const parts: string[] = [];
                                if (totals.lyd) parts.push(`${totals.lyd.toFixed(2)} LYD`);
                                if (totals.usd) parts.push(`${totals.usd.toFixed(2)} USD`);
                                if (!parts.length) return null;
                                return (
                                  <Box key={type} display="flex" justifyContent="space-between" sx={{ py: 0.25 }}>
                                    <Typography variant="body2">{label}</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                      {parts.join("  |  ")}
                                    </Typography>
                                  </Box>
                                );
                              })}
                            </Box>
                          ) : null}
                        </Box>

                        <Divider sx={{ my: 1.5 }} />

                        <Box
                          display="grid"
                          gap={1}
                          sx={{
                            gridTemplateColumns: {
                              xs: '1fr',
                              sm: 'repeat(2, 1fr)',
                              md: 'repeat(4, 1fr)',
                            },
                          }}
                        >
                          <TextField
                            select
                            size="small"
                            label={t("Type") || "Type"}
                            value={adjForm.type}
                            onChange={(e) => {
                              const nextType = e.target.value;
                              const opt = adjTypeOptions.find((o) => o.value === nextType);
                              setAdjForm((f) => ({
                                ...f,
                                type: nextType,
                                label: nextType === 'custom' ? '' : String(opt?.label || nextType),
                                direction: nextType === 'deduction' ? 'DEDUCT' : (nextType === 'custom' ? 'ADD' : 'ADD'),
                                recurring: false,
                                startYear: year,
                                startMonth: month,
                                endYear: '',
                                endMonth: '',
                                currency: adjUsdEligible ? f.currency : "LYD",
                              }));
                            }}
                            fullWidth
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
                            onChange={(e) => setAdjForm((f) => ({ ...f, amount: e.target.value }))}
                            inputProps={{ step: "0.01" }}
                            fullWidth
                          />

                          {adjForm.type === 'custom' && (
                            <TextField
                              size="small"
                              label={t("Label") || "Label"}
                              value={adjForm.label}
                              onChange={(e) => setAdjForm((f) => ({ ...f, label: e.target.value }))}
                              placeholder={t("Example: Attendance Bonus") || "Example: Attendance Bonus"}
                              fullWidth
                            />
                          )}

                          {adjForm.type === 'custom' && (
                            <TextField
                              select
                              size="small"
                              label={t("Add / Deduct") || "Add / Deduct"}
                              value={adjForm.direction}
                              onChange={(e) =>
                                setAdjForm((f) => ({
                                  ...f,
                                  direction: (String(e.target.value || '').toUpperCase() === 'DEDUCT' ? 'DEDUCT' : 'ADD') as 'ADD' | 'DEDUCT',
                                }))
                              }
                              fullWidth
                            >
                              <MenuItem value="ADD">{t("Earnings (+)") || "Earnings (+)"}</MenuItem>
                              <MenuItem value="DEDUCT">{t("Deductions (-)") || "Deductions (-)"}</MenuItem>
                            </TextField>
                          )}

                          {adjForm.type === 'custom' && (
                            <FormControlLabel
                              sx={{ gridColumn: { xs: '1 / -1', md: '1 / -1' }, m: 0 }}
                              control={
                                <Checkbox
                                  checked={!!adjForm.recurring}
                                  onChange={(e) => {
                                    const checked = !!e.target.checked;
                                    setAdjForm((f) => ({
                                      ...f,
                                      recurring: checked,
                                      startYear: checked ? Number(f.startYear || year) : Number(f.startYear || year),
                                      startMonth: checked ? Number(f.startMonth || month) : Number(f.startMonth || month),
                                      endYear: checked ? String(f.endYear || '') : '',
                                      endMonth: checked ? String(f.endMonth || '') : '',
                                    }));
                                  }}
                                />
                              }
                              label={t('Recurring (apply every month)') || 'Recurring (apply every month)'}
                            />
                          )}

                          {adjForm.type === 'custom' && adjForm.recurring && (
                            <TextField
                              select
                              size="small"
                              label={t('Start Year') || 'Start Year'}
                              value={adjForm.startYear}
                              onChange={(e) => setAdjForm((f) => ({ ...f, startYear: Number(e.target.value) }))}
                              fullWidth
                            >
                              {years.map((yy) => (
                                <MenuItem key={yy} value={yy}>
                                  {yy}
                                </MenuItem>
                              ))}
                            </TextField>
                          )}

                          {adjForm.type === 'custom' && adjForm.recurring && (
                            <TextField
                              select
                              size="small"
                              label={t('Start Month') || 'Start Month'}
                              value={adjForm.startMonth}
                              onChange={(e) => setAdjForm((f) => ({ ...f, startMonth: Number(e.target.value) }))}
                              fullWidth
                            >
                              {months.map((mm) => (
                                <MenuItem key={mm} value={mm}>
                                  {String(mm).padStart(2, '0')}
                                </MenuItem>
                              ))}
                            </TextField>
                          )}

                          {adjForm.type === 'custom' && adjForm.recurring && (
                            <TextField
                              select
                              size="small"
                              label={t('End Year (optional)') || 'End Year (optional)'}
                              value={adjForm.endYear}
                              onChange={(e) => setAdjForm((f) => ({ ...f, endYear: String(e.target.value) }))}
                              fullWidth
                            >
                              <MenuItem value="">—</MenuItem>
                              {years.map((yy) => (
                                <MenuItem key={yy} value={String(yy)}>
                                  {yy}
                                </MenuItem>
                              ))}
                            </TextField>
                          )}

                          {adjForm.type === 'custom' && adjForm.recurring && (
                            <TextField
                              select
                              size="small"
                              label={t('End Month (optional)') || 'End Month (optional)'}
                              value={adjForm.endMonth}
                              onChange={(e) => setAdjForm((f) => ({ ...f, endMonth: String(e.target.value) }))}
                              fullWidth
                            >
                              <MenuItem value="">—</MenuItem>
                              {months.map((mm) => (
                                <MenuItem key={mm} value={String(mm)}>
                                  {String(mm).padStart(2, '0')}
                                </MenuItem>
                              ))}
                            </TextField>
                          )}

                          <TextField
                            select
                            size="small"
                            label={t("Currency") || "Currency"}
                            value={adjForm.currency}
                            onChange={(e) => setAdjForm((f) => ({ ...f, currency: e.target.value }))}
                            disabled={!adjUsdEligible}
                            fullWidth
                          >
                            {(adjUsdEligible ? ["LYD", "USD"] : ["LYD"]).map((x) => (
                              <MenuItem key={x} value={x}>
                                {x}
                              </MenuItem>
                            ))}
                          </TextField>

                          <TextField
                            size="small"
                            label={t("Note") || "Note"}
                            value={adjForm.note}
                            onChange={(e) => setAdjForm((f) => ({ ...f, note: e.target.value }))}
                            fullWidth
                          />
                        </Box>

                        <Box mt={1} display="flex" justifyContent="flex-end">
                          <Button onClick={addAdjustment} variant="contained" disabled={adjLoading}>
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

                <Snackbar
                  open={uiErrorOpen}
                  autoHideDuration={6000}
                  onClose={() => setUiErrorOpen(false)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                  <Alert onClose={() => setUiErrorOpen(false)} severity="error" sx={{ width: '100%' }}>
                    {uiErrorMessage}
                  </Alert>
                </Snackbar>
                </Box>
                  );
                }