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
import { runPayroll, sendPayslipClient, computePayrollV2, savePayrollV2, closePayrollV2, listV2Loans, createV2Loan, skipV2LoanMonth, payoffV2Loan } from "../../api/payroll";
import type { TimesheetDay } from "../../api/attendance";
import { getTimesheetMonth, listPs, PsItem } from "../../api/attendance";
import jsPDF from "jspdf";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import EditNoteIcon from "@mui/icons-material/EditNote";

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
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
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

  // Sales metrics per employee (qty, total_lyd)
  const [sales, setSales] = React.useState<Record<string, { qty: number; total_lyd: number }>>({});

  // Payroll table UI state
  const [tab, setTab] = React.useState<'payroll'|'loans'>('payroll');
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
  const [advMonthOffset, setAdvMonthOffset] = React.useState<number>(0); // 0=this month, 1=next month

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const [colMenuEl, setColMenuEl] = React.useState<null | HTMLElement>(null);
  const openCols = (e: React.MouseEvent<HTMLElement>) => setColMenuEl(e.currentTarget);
  const closeCols = () => setColMenuEl(null);
  const toggleCol = (k: keyof typeof cols) => setCols(c => ({ ...c, [k]: !c[k] }));

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
      const missMin = days.reduce((acc, d) => acc + ((d?.deltaMin ?? 0) < 0 ? Math.abs(d!.deltaMin!) : 0), 0);
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
        case 'workingDays': return Number(e.workingDays||0);
        case 'deductionDays': return Number(e.deductionDays||0);
        case 'presentWorkdays': return Number(e.presentWorkdays||0);
        case 'holidayWorked': return Number(e.holidayWorked||0);
        case 'baseSalary': return Number(e.baseSalary||0);
        case 'food': {
          const W=Math.max(1,e.workingDays||1); const per=Number((e as any).FOOD||(e as any).FOOD_ALLOWANCE||0); const fd=Number(((e as any).foodDays ?? e.workingDays)||0)||W; return per*fd;
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
        case 'total': return Number(e.total||0);
        case 'totalUsd': {
          const W=Math.max(1,e.workingDays||1); const F=e.factorSum!=null&&e.factorSum>0?e.factorSum:((e.components?.basePay||0)/(Math.max(1,e.baseSalary||0)/W)); const baseUsd=e.baseSalaryUsd? (e.baseSalaryUsd/W)*F:0; return baseUsd;
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
  }, [sortKey, sortDir, sales, v2Rows]);

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
      const fuelPer = Number((e as any).FUEL || 0);
      const commPer = Number((e as any).COMMUNICATION || 0);
      const foodDays = Number(((e as any).foodDays ?? e.workingDays) || 0) || W;
      t.food += foodPer * foodDays;
      t.fuel += fuelPer * W;
      t.comm += commPer * W;
      const adj = e.components?.adjustments || { bonus:0, deduction:0, advance:0, loanPayment:0 };
      t.adj += (Number(adj.bonus||0) - (Number(adj.deduction||0)+Number(adj.advance||0)+Number(adj.loanPayment||0)));
      const s = sales[String(e.id_emp)] || { qty: 0, total_lyd: 0 };
      t.salesQty += Number(s.qty||0);
      t.salesTotal += Number(s.total_lyd||0);
      const vr = (v2Rows||[]).find((x:any)=> Number(x.id_emp)===Number(e.id_emp)) || {} as any;
      t.gold += Number(vr.gold_bonus_lyd||0);
      t.diamond += Number(vr.diamond_bonus_lyd||0);
      t.totalLyd += Number(e.total||0);
      // Approximate USD: use baseSalaryUsd/factor if available
      const W2 = Math.max(1, e.workingDays||1);
      const F = e.factorSum != null && e.factorSum > 0 ? e.factorSum : ((e.components?.basePay||0) / (Math.max(1, e.baseSalary||0)/W2));
      const baseUsd = e.baseSalaryUsd ? (e.baseSalaryUsd/W2)*F : 0;
      t.totalUsd += baseUsd; // no conversion of LYD
    });
    return t;
  }, [displayedRows, sales, v2Rows]);

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
        return {
          ok: true,
          id_emp: Number(r.id_emp),
          name: String(r.name || r.id_emp),
          PS: r.ps ?? null,
          baseSalary,
          baseSalaryUsd: Number(r.base_salary_usd ?? r.baseUsd ?? 0),
          allowancePerDay,
          workingDays: Number(r.workingDays ?? workingDays),
          deductionDays: Number(r.absence_days ?? r.absenceDays ?? 0),
          presentWorkdays: Number(r.workingDays ?? workingDays),
          holidayCount: 0,
          holidayWorked: Number(r.ph_days ?? r.holidayWorked ?? 0),
          leaveSummary: {},
          components: {
            basePay: basePortion,
            holidayOvertime: 0,
            allowancePay,
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
          designation: null,
          costCenter: null,
        } as Payslip;
      });
      const adapted: PayrollRunResponse = { ok: true, year: v2.year, month: v2.month, period: { start, end }, count: employees.length, employees };
      setResult(adapted);
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

  const codeBadge = (d?: TimesheetDay | null): string => {
    if (!d) return "";
    const c = String(d.code || "").toUpperCase();
    if (c) return c;
    if (d.present) return d.isHoliday ? "PH" : "P";
    return "A";
  };

  const buildPayslipPdf = async (emp: Payslip): Promise<{ dataUrl: string; blobUrl: string; filename: string }> => {
    const days = await ensureTimesheetDays(emp.id_emp);
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
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
        const fontPx = Math.max(10, Math.round(fontPt * 6.3333)); // 1pt≈1.333px
        const cnv = document.createElement('canvas');
        const ctx = cnv.getContext('2d');
        if (!ctx) return null;
        ctx.direction = 'rtl';
        ctx.font = `${fontPx}px GajaArabicPDF, 'Noto Naskh Arabic', 'Amiri', Arial`;
        const w = Math.ceil((ctx.measureText(text).width || (fontPx * text.length * 0.6)) + 8);
        const h = Math.ceil(fontPx * 1.6);
        cnv.width = w; cnv.height = h;
        const ctx2 = cnv.getContext('2d');
        if (!ctx2) return null;
        ctx2.direction = 'rtl';
        ctx2.fillStyle = '#000';
        ctx2.font = `${fontPx}px GajaArabicPDF, 'Noto Naskh Arabic', 'Amiri', Arial`;
        // baseline approx: draw 0.8*fontPx from top
        ctx2.fillText(text, w - 2, Math.floor(fontPx * 1.1));
        const dataUrl = cnv.toDataURL('image/png');
        const hPt = fontPt + 6; // slight padding
        const scale = hPt / h;
        const wPt = w * scale;
        return { dataUrl, wPt, hPt };
      } catch { return null; }
    };

    const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const dim = new Date(year, month, 0).getDate();

    // Compute net values consistent with table (V2)
    const netLyd = Number(((emp.total || 0)).toFixed(2));
    const netUsd = usdToLyd > 0 ? Number((((emp.total || 0)) / usdToLyd).toFixed(2)) : 0;

    // Header band (logo centered h=20, title + month + print date at font 12)
    doc.setFontSize(12);
    const pageH = doc.internal.pageSize.getHeight();
    // Light grey page background
    try {
      (doc as any).setFillColor(242, 242, 242);
      (doc as any).rect(0, 0, pageW, pageH, 'F');
    } catch {}
    const title = `${emp.name}`;
    const logoH = 30;
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
    const logoData = (await tryFetch('/GJ_LOGO.png')) || (await tryFetch('/GJ%20LOGO.png'));
    if (logoData) {
      // compute width from image natural sizes
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const scale = logoH / (img.naturalHeight || logoH);
          const w = Math.max(logoH, (img.naturalWidth || logoH) * scale);
          const x = (pageW - w) / 2;
          doc.addImage(logoData, 'PNG', x, margin - 10, w, logoH);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = logoData;
      });
    }
    // Title (employee name) on the RIGHT, printed info on the LEFT
    doc.setFontSize(14);
    if (hasArabic(title)) {
      const img = await drawArabicTextImage(title, 14);
      if (img) {
        const x = pageW - margin - img.wPt;
        doc.addImage(img.dataUrl, 'PNG', x, margin - 10 + logoH - (img.hPt - 14), img.wPt, img.hPt);
      } else {
        const tw = doc.getTextWidth(title);
        const x = pageW - margin - tw;
        doc.text(title, x, margin - 10 + logoH);
      }
    } else {
      const tw = doc.getTextWidth(title);
      const x = pageW - margin - tw;
      doc.text(title, x, margin - 10 + logoH);
    }
    // Left side details
    doc.setFontSize(10);
    const printedOnStr = `Printed on: ${dayjs().format('DD/MM/YYYY')}`;
    const forMonthStr = `For the month of ${dayjs(periodStart).format('MMMM YYYY')}`;
    doc.text(printedOnStr, margin, margin - 10 + logoH + 14);
    doc.text(forMonthStr, margin, margin - 10 + logoH + 28);
    // divider
    doc.setDrawColor('#3c3c3c');
    doc.setFillColor('#3c3c3c');
    doc.rect(margin, margin + 56, pageW - margin * 2, 2, "F");

    const v2 = (v2Rows || []).find((x:any) => Number(x.id_emp) === Number(emp.id_emp)) || {} as any;
    const csStr = (v2 as any).T_START || (v2 as any).contract_start || (v2 as any).contractStart;
    const contractStart = csStr ? dayjs(csStr) : null;
    const missMin = days.reduce((acc, d) => acc + ((d?.deltaMin ?? 0) < 0 ? Math.abs(d!.deltaMin!) : 0), 0);
    const missH = Math.floor(missMin / 60);
    const missM = Math.floor(missMin % 60);
    const missStr = (missH||missM) ? `${String(missH)}h${missM?` ${String(missM)}m`:''}` : '';
    const bv = (n:any)=>Number(n||0);
    const fmt = (n:number)=> n ? n.toLocaleString(undefined,{maximumFractionDigits:2}) : '';
    const breakdown: Array<{label:string; lyd:number; usd:number; note?:string}> = [
      { label: 'Basic Salary', lyd: bv(v2.base_salary_lyd), usd: bv(v2.base_salary_usd) },
      { label: 'Food Allowance', lyd: bv(v2.wd_food_lyd), usd: bv(v2.wd_food_usd), note: String(v2.food_days || emp.workingDays || '') },
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
      { label: 'Net Salary', lyd: bv(v2.net_salary_lyd ?? v2.D16), usd: bv(v2.net_salary_usd ?? v2.C16) },
    ];
    // Show LYD and/or USD columns depending on base salary presence
    let brShowLyd = Number(v2.base_salary_lyd || 0) > 0;
    let brShowUsd = Number(v2.base_salary_usd || 0) > 0;
    if (!brShowLyd && !brShowUsd) brShowLyd = true; // fallback to LYD if neither explicitly present

    // Filter out rows with no values in the displayed currency columns
    const rows = breakdown.filter(r => (
      (brShowLyd && Number(r.lyd || 0) > 0) || (brShowUsd && Number(r.usd || 0) > 0)
    ));

    const area = (pageW - margin*2);
    const colL = Math.floor(area * (brShowLyd && brShowUsd ? 0.40 : 0.50));
    const colA = brShowLyd ? Math.floor(area * (brShowUsd ? 0.15 : 0.20)) : 0;
    const colB = brShowUsd ? Math.floor(area * (brShowLyd ? 0.15 : 0.20)) : 0;
    const colN = area - colL - colA - colB;

    // defer drawing of breakdown; will render after Earnings/Deductions blocks
    let breakdownBottom = margin + 64 + 10;

    // Helper to fit text within a width by ellipsizing
    const fitText = (text: string, maxWidth: number) => {
      let t = String(text || "");
      if (!t) return "";
      if (doc.getTextWidth(t) <= maxWidth) return t;
      while (t.length > 0 && doc.getTextWidth(t + "…") > maxWidth) t = t.slice(0, -1);
      return t ? t + "…" : "";
    };

    // Employee details + Earnings/Deductions boxes area (new page if breakdown ended near bottom)
    let y: number;
    if (margin + 64 + 10 > pageH - margin - 120) {
      doc.addPage();
      y = margin + 60;
    } else {
      y = Math.max(margin + 60, margin + 64 + 10);
    }
    doc.setFontSize(11);
    const blockW = (pageW - margin * 2) / 2 - 8;
    const rx = margin + blockW + 16;

    // Compact 3-field info table (PS, Position, Employee ID) with border color #b7a27d
    const infoY = y;
    const cellH = 26;
    const fields: Array<[string, string]> = [
      ["PS", emp.PS != null ? String(emp.PS) : ""],
      ["Position", String(emp.designation ?? "")],
      ["Employee ID", String(emp.id_emp)],
    ];
    const infoW = pageW - margin * 2;
    const infoColW = Math.floor(infoW / 3);
    doc.setDrawColor('#b7a27d');
    for (let i = 0; i < 3; i++) {
      const x = margin + i * infoColW;
      doc.rect(x, infoY, infoColW, cellH);
      doc.text(`${fields[i][0]}:`, x + 6, infoY + 16);
      const maxW = infoColW - 100;
      doc.text(fitText(fields[i][1], maxW), x + 70, infoY + 16);
    }
    // Tiny margin below the info row
    y = infoY + cellH + 2;

    // Earnings & Deductions tables (hide zero rows)
    const tblY = y;
    const colW = blockW;
    // Earnings header
    doc.setDrawColor('#b7a27d');
    doc.rect(margin, tblY, colW, 26);
    doc.setFontSize(10);
    doc.text("EARNINGS", margin + 6, tblY + 16);
    doc.text("AMOUNT", margin + colW - 120, tblY + 16);
    // Rows (content 10px, slightly taller rows)
    const row = (label: string, value: string, yy: number) => {
      doc.setDrawColor('#b7a27d');
      doc.rect(margin, yy, colW, 24);
      doc.text(label, margin + 6, yy + 15);
      doc.text(value, margin + colW - 120, yy + 15);
    };
    let ey = tblY + 28;
    // Base and Allowance pay (aligned with table view)
    {
      const basePay = Number(emp.components?.basePay || 0);
      const allowancePay = Number(emp.components?.allowancePay || 0);
      if (basePay > 0.0001) { row("Base Pay", `${basePay.toLocaleString(undefined,{maximumFractionDigits:2})} LYD`, ey); ey += 24; }
      if (allowancePay > 0.0001) { row("Allowance Pay", `${allowancePay.toLocaleString(undefined,{maximumFractionDigits:2})} LYD`, ey); ey += 24; }
    }
    // Bonus from adjustments
    const adjComp = (emp.components?.adjustments || { bonus: 0, deduction: 0, advance: 0, loanPayment: 0 });
    if ((adjComp.bonus || 0) > 0.0001) { row("Bonus", `${Number(adjComp.bonus || 0).toLocaleString(undefined,{maximumFractionDigits:2})} LYD`, ey); ey += 24; }

    // Deductions header
    const dx = rx; const dy = tblY;
    doc.setDrawColor('#b7a27d');
    doc.rect(dx, dy, colW, 26);
    doc.setFontSize(10);
    doc.text("DEDUCTIONS", dx + 6, dy + 16);
    doc.text("AMOUNT", dx + colW - 120, dy + 16);
    // Deductions rows in LYD: Absent/UL/HL amounts + adjustments (deduction/advance/loan)
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
    const dRows: Array<[string, number]> = [];
    const absAmt = dailyBase2 * aCnt;
    const ulAmt = dailyBase2 * ulCnt;
    const hlAmt = dailyBase2 * 0.5 * hlCnt;
    if (absAmt > 0) dRows.push(["Absence", absAmt]);
    if (ulAmt > 0) dRows.push(["Unpaid Leave (UL)", ulAmt]);
    if (hlAmt > 0) dRows.push(["Half-day Leave (HL)", hlAmt]);
    if ((adjComp.deduction || 0) > 0) dRows.push(["Deduction", Number(adjComp.deduction || 0)]);
    if ((adjComp.advance || 0) > 0) dRows.push(["Advance", Number(adjComp.advance || 0)]);
    if ((adjComp.loanPayment || 0) > 0) dRows.push(["Loan Payment", Number(adjComp.loanPayment || 0)]);
    const maxDedRows = 8;
    const dedRendered = Math.min(maxDedRows, Math.max(dRows.length, 0));
    for (let i = 0; i < dedRendered; i++) {
      const yy2 = dy + 28 + i * 24;
      doc.setDrawColor('#b7a27d');
      doc.rect(dx, yy2, colW, 24);
      const rr = dRows[i];
      if (rr) {
        doc.setFontSize(10);
        doc.text(rr[0], dx + 6, yy2 + 15);
        doc.text(`${rr[1].toLocaleString(undefined,{maximumFractionDigits:2})} LYD`, dx + colW - 120, yy2 + 15);
      }
    }

    // Calendar grid: 2 rows (1-15) and (16-end), Fridays always shown; grey when no work
    // Use updated header/row heights to push grid correctly
    const dedBlockBottom = dy + 28 + dedRendered * 24 + 8;
    // ---- Salary Breakdown table (now under Earnings/Deductions, above day grid) ----
    {
      let by = Math.max(ey, dedBlockBottom) + 8;
      const drawHeader = () => {
        doc.setFontSize(9);
        doc.setDrawColor('#b7a27d');
        let x = margin;
        doc.rect(x, by, colL, 24); x += colL;
        if (brShowLyd) { doc.rect(x, by, colA, 24); x += colA; }
        if (brShowUsd) { doc.rect(x, by, colB, 24); x += colB; }
        doc.rect(x, by, colN, 24);
        doc.text('Item', margin + 6, by + 16);
        let tx = margin + colL + 6;
        if (brShowLyd) { doc.text('LYD', tx, by + 16); tx += colA; }
        if (brShowUsd) { doc.text('USD', tx, by + 16); tx += colB; }
        doc.text('Note', tx, by + 16);
        by += 24;
      };
      const ensure = (h: number) => {
        if (by + h > pageH - margin) { doc.addPage(); by = margin; drawHeader(); }
      };
      drawHeader();
      rows.forEach((r)=>{
        ensure(22);
        let x = margin;
        doc.rect(x, by, colL, 22); x += colL;
        if (brShowLyd) { doc.rect(x, by, colA, 22); x += colA; }
        if (brShowUsd) { doc.rect(x, by, colB, 22); x += colB; }
        doc.rect(x, by, colN, 22);
        doc.text(r.label, margin + 6, by + 14);
        let tx = margin + colL;
        if (brShowLyd) {
          const lyd = fmt(Number(r.lyd||0));
          if (lyd) doc.text(lyd, tx + colA - doc.getTextWidth(lyd) - 6, by + 14);
          tx += colA;
        }
        if (brShowUsd) {
          const usd = fmt(Number(r.usd||0));
          if (usd) doc.text(usd, tx + colB - doc.getTextWidth(usd) - 6, by + 14);
          tx += colB;
        }
        if (r.note) doc.text(String(r.note), tx + 6, by + 14);
        by += 22;
      });
      breakdownBottom = by;
    }
    // Net pay boxes (fixed area before calendar, with grey fill)
    let netBoxesBottom = 0;
    {
      const boxY = Math.max(ey + 8, dedBlockBottom, breakdownBottom + 6);
      const boxH = 18;
      const gap = 8;
      const colW = Math.floor((pageW - margin * 2 - gap) / 2);
      ;(doc as any).setFillColor(235,235,235);
      // USD (left)
      doc.rect(margin, boxY, colW, boxH, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica','bold');
      doc.text(`Net Pay (USD):`, margin + 4, boxY + 12);
      doc.setFont('helvetica','normal');
      doc.text(String(netUsd || 0), margin + colW - doc.getTextWidth(String(netUsd || 0)) - 4, boxY + 12);
      // LYD (right)
      doc.rect(margin + colW + gap, boxY, colW, boxH, 'F');
      doc.setFont('helvetica','bold');
      doc.text(`Net Pay (LYD):`, margin + colW + gap + 4, boxY + 12);
      doc.setFont('helvetica','normal');
      doc.text(String(netLyd || 0), margin + colW + gap + colW - doc.getTextWidth(String(netLyd || 0)) - 4, boxY + 12);
      netBoxesBottom = boxY + boxH;
    }
    const gridTop = Math.max(ey + 8, dedBlockBottom, breakdownBottom + 6, netBoxesBottom + 6);
    const firstDate = dayjs(periodStart);
    // Calendar sizing: scale to fit remaining space to keep one page
    let hWeek = 16, hDayNum = 20, hCell = 38;
    const drawRow = (start: number, end: number, topY: number) => {
      const count = Math.max(1, end - start + 1);
      const cw = Math.floor((pageW - margin * 2) / count);
      // Week header
      for (let idx = 0; idx < count; idx++) {
        const d = start + idx;
        const x = margin + idx * cw;
        const wd = firstDate.date(d).format('ddd');
        doc.setDrawColor('#dcdcdc');
        doc.rect(x, topY, cw, hWeek);
        const w = doc.getTextWidth(wd);
        doc.text(wd, x + (cw - w)/2, topY + 10);
      }
      // Day numbers
      for (let idx = 0; idx < count; idx++) {
        const d = start + idx;
        const x = margin + idx * cw;
        doc.setDrawColor('#dcdcdc');
        doc.rect(x, topY + hWeek, cw, hDayNum);
        doc.text(String(d), x + 4, topY + hWeek + 12);
      }
      // Cells
      const cellY = topY + hWeek + hDayNum;
      for (let idx = 0; idx < count; idx++) {
        const d = start + idx;
        const x = margin + idx * cw;
        const day = days[d-1] || null;
        const badge = codeBadge(day || undefined);
        const isFri = firstDate.date(d).day() === 5;
        const present = !!day?.present;
        let bg: [number,number,number] | null = null;
        if (isFri && !present) { bg = [240,240,240]; }
        else {
          switch (badge) {
            case 'PHF': bg = [230,255,230]; break;
            case 'PH': bg = [255,243,205]; break;
            case 'PT': bg = [224,247,250]; break;
            case 'PL': bg = [255,235,238]; break;
            case 'A': bg = [253,236,234]; break;
            case 'AL': bg = [220,240,220]; break; // Annual Leave
            case 'SL': bg = [230,230,255]; break; // Sick Leave
            case 'EL': bg = [255,245,230]; break; // Emergency Leave
            case 'ML': bg = [240,230,255]; break; // Maternity Leave
            case 'XL': bg = [230,255,255]; break; // Exam Leave
            case 'BM': bg = [240,240,240]; break; // Bereavement
            case 'UL': bg = [255,228,225]; break; // Unpaid Leave
            case 'HL': bg = [255,255,210]; break; // Half-day Leave
            default: bg = null;
          }
        }
        if (bg) { (doc as any).setFillColor(bg[0], bg[1], bg[2]); doc.rect(x, cellY, cw, hCell, 'F'); }
        doc.setDrawColor('#dcdcdc');
        doc.rect(x, cellY, cw, hCell);
        doc.setTextColor(0);
        doc.setFontSize(8);
        const showCodes = ['P','PH','PHF','PT','PL','A','AL','SL','EL','ML','XL','BM','UL','HL'].includes(badge);
        if (showCodes && badge) {
          const prevSize = (doc as any).getFontSize();
          doc.setFont('helvetica','bold');
          doc.setFontSize(10);
          const bw = doc.getTextWidth(badge);
          doc.text(badge, x + (cw - bw)/2, cellY + Math.min(18, Math.max(12, Math.round(hCell/2))));
          doc.setFont('helvetica','normal');
          doc.setFontSize(prevSize);
        }
      }
      return topY + hWeek + hDayNum + hCell;
    };
    // Fit calendar into remaining height by scaling if needed
    const rowsNeeded = dim > 15 ? 2 : 1;
    const desiredGap = dim > 15 ? 6 : 0;
    const desiredHeight = rowsNeeded * (hWeek + hDayNum + hCell) + desiredGap;
    const remaining = pageH - gridTop - 56; // keep some bottom margin
    const scale = Math.min(1, Math.max(0.6, remaining / Math.max(1, desiredHeight)));
    hWeek = Math.round(hWeek * scale);
    hDayNum = Math.round(hDayNum * scale);
    hCell = Math.round(hCell * scale);
    let bottomY = drawRow(1, Math.min(15, dim), gridTop);
    if (dim > 15) bottomY = drawRow(16, dim, bottomY + Math.round(6 * scale));

    // Adjustment rows (for the period) — fetched now but rendered later in table next to Attendance
    // Tiny margin below earnings/deductions before subsequent sections
    let afterGridY = bottomY + 12;
    let adjRowsPdf: Array<{ type: string; amount: number; currency: string; note?: string; ts?: string }> = [];
    try {
      const url = `http://localhost:9000/hr/payroll/adjustments?year=${year}&month=${month}&employeeId=${emp.id_emp}`;
      const res = await fetch(url, { headers: authHeader() as unknown as HeadersInit });
      if (res.ok) {
        const js = await res.json();
        adjRowsPdf = (js?.data?.[String(emp.id_emp)] || []) as Array<{ type: string; amount: number; currency: string; note?: string; ts?: string }>;
      }
    } catch {}
    // No immediate rendering; will render as table alongside Attendance Summary

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
      const effectiveStart = contractStart && contractStart.isAfter(monthStartDate) ? contractStart : monthStartDate;
      const dayDate = monthStartDate.date(d);
      if (contractStart && dayDate.isBefore(effectiveStart, 'day')) continue;
      const badge = codeBadge(days[d-1] || undefined);
      if (badge && badge in counts) counts[badge]++;
    }
    // Full-width tables: Attendance, then Adjustments, then Leaves
    doc.setFontSize(14);
    const tblTop = afterGridY + 8;
    const fullW = pageW - margin*2;

    // Attendance (full-width): headers P/A/PT/PHF/PH/PL with counts underneath, and left label column
    const codes = ['P','A','PT','PHF','PH','PL'] as const;
    const leftW = 80;
    const cellW = Math.floor((fullW - leftW) / codes.length);
    doc.setFont('helvetica', 'bold');
    const attTitle = 'Attendance Summary';
    const attTitleW = doc.getTextWidth(attTitle);
    doc.setFontSize(10);
    doc.text(attTitle, margin + (fullW - attTitleW)/2, tblTop + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setDrawColor('#b7a27d');
    let ay = tblTop + 14; // 6px margin under title
    // Header row with colored backgrounds per code (matching calendar colors)
    const headerBg = (code: string): [number,number,number] | null => {
      switch (code) {
        case 'PHF': return [230,255,230]; // Public Holiday (Worked)
        case 'PH':  return [255,243,205]; // Public Holiday
        case 'PT':  return [224,247,250]; // Present Friday
        case 'PL':  return [255,235,238]; // Partial/Late
        case 'A':   return [253,236,234]; // Absent
        case 'P':   return null;          // Present (no bg used in cells)
        default:    return null;
      }
    };
    doc.rect(margin, ay, leftW, 24);
    codes.forEach((c, i) => {
      const x = margin + leftW + i*cellW;
      const bg = headerBg(c);
      if (bg) { (doc as any).setFillColor(bg[0], bg[1], bg[2]); doc.rect(x, ay, cellW, 24, 'F'); }
      doc.rect(x, ay, cellW, 24);
    });
    doc.text('Code', margin + 8, ay + 16);
    codes.forEach((c, i) => {
      const tw = doc.getTextWidth(c);
      doc.text(c, margin + leftW + i*cellW + (cellW - tw)/2, ay + 16);
    });
    ay += 24;
    // Count row
    doc.rect(margin, ay, leftW, 24);
    codes.forEach((c, i) => { doc.rect(margin + leftW + i*cellW, ay, cellW, 24); });
    doc.text('Count', margin + 8, ay + 16);
    codes.forEach((c, i) => {
      const raw = Number((counts as any)[c] || 0);
      const val = raw > 0 ? String(raw) : '';
      const tw = doc.getTextWidth(val);
      if (val) doc.text(val, margin + leftW + i*cellW + (cellW - tw)/2, ay + 16);
    });
    ay += 24;

    // Adjustments (full-width) stacked below attendance
    const adjTop = ay + 8;
    const adjCols = [140, 120, fullW - 140 - 120]; // Date, Amount, Adjustment
    doc.setFont('helvetica', 'bold');
    const adjTitle = 'Financial Log';
    const adjTitleW = doc.getTextWidth(adjTitle);
    doc.setFontSize(10);
    doc.text(adjTitle, margin + (fullW - adjTitleW)/2, adjTop + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    let adjY = adjTop + 14; // 6px margin under title
    doc.setDrawColor('#b7a27d');
    // header
    doc.rect(margin, adjY, adjCols[0], 24);
    doc.rect(margin + adjCols[0], adjY, adjCols[1], 24);
    doc.rect(margin + adjCols[0] + adjCols[1], adjY, adjCols[2], 24);
    const hh1 = 'Date', hh2 = 'Amount', hh3 = 'Adjustment';
    doc.text(hh1, margin + 8, adjY + 16);
    doc.text(hh2, margin + adjCols[0] + 8, adjY + 16);
    doc.text(hh3, margin + adjCols[0] + adjCols[1] + 8, adjY + 16);
    adjY += 24;
    const fmtDMY = (s?: string) => s ? dayjs(s).format('DD/MM/YYYY') : '';
    (adjRowsPdf || []).forEach((r) => {
      const dateStr = fmtDMY(r.ts);
      const amtStr = `${r.currency} ${Number(r.amount||0).toFixed(2)}`;
      const nameStr = (r.note && String(r.note).trim().length > 0) ? String(r.note) : (r.type || '');
      doc.rect(margin, adjY, adjCols[0], 22);
      doc.rect(margin + adjCols[0], adjY, adjCols[1], 22);
      doc.rect(margin + adjCols[0] + adjCols[1], adjY, adjCols[2], 22);
      doc.text(dateStr, margin + 8, adjY + 14);
      doc.text(amtStr, margin + adjCols[0] + 8, adjY + 14);
      doc.text(fitText(nameStr, adjCols[2]-12), margin + adjCols[0] + adjCols[1] + 8, adjY + 14);
      adjY += 22;
    });

    // Prepare leaves table (only render if there are leaves)
    const leavesCols = [Math.floor(fullW*0.28), Math.floor(fullW*0.12), fullW - Math.floor(fullW*0.28) - Math.floor(fullW*0.12)]; // Leave, Days, Dates
    const leavesX = margin;
    let leavesBottomY = adjY;

    // Build Leaves data and draw into the leaves table started above
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
          // Approximate: only include days after startLimit
          const incDays = Math.max(0, eClamp.diff(sClamp, 'day') + 1);
          leaveDaysByCode[code] = (leaveDaysByCode[code] || 0) + incDays;
        }
      }
    } catch {}
    const leaves = Object.keys(leaveName).filter(k => (ls as any)[k] != null || leaveRanges[k]?.length);
    if (leaves.length) {
      const leavesTitleY = adjY + 8;
      let ly2 = leavesTitleY + 14; // 6px margin under title
      doc.setFont('helvetica', 'bold');
      const leavesTitle = 'Leaves This Month';
      const leavesTitleW = doc.getTextWidth(leavesTitle);
      doc.setFontSize(10);
      doc.text(leavesTitle, margin + (fullW - leavesTitleW)/2, leavesTitleY + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setDrawColor('#b7a27d');
      // header
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
    afterGridY = Math.max(ay, adjY, leavesBottomY);

    // Net pay boxes at bottom (hide zeros; if single currency center it)
    const npY = afterGridY + 8;
    doc.setFontSize(11);
    doc.setDrawColor('#c8c8c8');
    const npShowUsd = netUsd > 0.0001;
    const npShowLyd = netLyd > 0.0001;
    if (npShowUsd && npShowLyd) {
      doc.rect(margin, npY, colW - 4, 24);
      doc.text(`Net Pay (USD) :    ${netUsd.toLocaleString(undefined,{maximumFractionDigits:2})}`, margin + 6, npY + 16);
      doc.rect(rx, npY, colW - 4, 24);
      doc.text(`Net Pay (LYD) :    ${netLyd.toLocaleString(undefined,{maximumFractionDigits:2})} LYD`, rx + 6, npY + 16);
    } else if (npShowUsd || npShowLyd) {
      const text = npShowUsd ? `Net Pay (USD) :    ${netUsd.toLocaleString(undefined,{maximumFractionDigits:2})}` : `Net Pay (LYD) :    ${netLyd.toLocaleString(undefined,{maximumFractionDigits:2})} LYD`;
      const w = pageW - margin * 2;
      const x = margin;
      doc.rect(x, npY, w, 24);
      const tw = doc.getTextWidth(text);
      doc.text(text, margin + (w - tw)/2, npY + 16);
    }

    // Signature removed per request

    // Footer removed per request

    const dataUrl = doc.output("datauristring");
    const blobUrl = (doc as any).output('bloburl');
    const filename = `payslip_${emp.id_emp}_${year}_${String(month).padStart(2,'0')}.pdf`;
    return { dataUrl, blobUrl, filename };
  };

  const exportPdfClient = async (emp: Payslip) => {
    try {
      const { dataUrl, blobUrl, filename } = await buildPayslipPdf(emp);
      // Prefer blob URL to avoid blank viewer issues
      const opened = window.open(blobUrl, '_blank');
      if (!opened) {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename;
        a.click();
      }
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
      <Typography variant="h5" gutterBottom>
        {t("nav.hr.compensations.payroll") || "Payroll"}
      </Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
            <Tab label={t("Payroll") || "Payroll"} value="payroll" />
            <Tab
              label={t("Loans & Advances") || "Loans & Advances"}
              value="loans"
            />
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
                      {`${p.PS} (${p.count})`}
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
              <Box display="flex" gap={1}>
                <Button variant="outlined" onClick={openCols}>
                  {t("Columns") || "Columns"}
                </Button>
                <Menu
                  anchorEl={colMenuEl}
                  open={!!colMenuEl}
                  onClose={closeCols}
                  keepMounted
                >
                  <MenuItem dense onClick={(e) => e.stopPropagation()}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={cols.presentWorkdays}
                          onChange={() => toggleCol("presentWorkdays")}
                        />
                      }
                      label={t("Present Days") || "Present Days"}
                    />
                  </MenuItem>
                  <MenuItem dense onClick={(e) => e.stopPropagation()}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={cols.holidayWorked}
                          onChange={() => toggleCol("holidayWorked")}
                        />
                      }
                      label={t("Holidays Worked") || "Holidays Worked"}
                    />
                  </MenuItem>
                  <MenuItem dense onClick={(e) => e.stopPropagation()}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={cols.baseSalary}
                          onChange={() => toggleCol("baseSalary")}
                        />
                      }
                      label={t("Base Salary") || "Base Salary"}
                    />
                  </MenuItem>
                  <MenuItem dense onClick={(e) => e.stopPropagation()}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={cols.food}
                          onChange={() => toggleCol("food")}
                        />
                      }
                      label={t("Food Allowance") || "Food Allowance"}
                    />
                  </MenuItem>
                  <MenuItem dense onClick={(e) => e.stopPropagation()}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={cols.fuel}
                          onChange={() => toggleCol("fuel")}
                        />
                      }
                      label={t("Fuel Allowance") || "Fuel Allowance"}
                    />
                  </MenuItem>
                  <MenuItem dense onClick={(e) => e.stopPropagation()}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={cols.comm}
                          onChange={() => toggleCol("comm")}
                        />
                      }
                      label={
                        t("Communication Allowance") ||
                        "Communication Allowance"
                      }
                    />
                  </MenuItem>
                  <MenuItem dense onClick={(e) => e.stopPropagation()}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={cols.basePay}
                          onChange={() => toggleCol("basePay")}
                        />
                      }
                      label={t("Base Pay") || "Base Pay"}
                    />
                  </MenuItem>
                  <MenuItem dense onClick={(e) => e.stopPropagation()}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={cols.allowancePay}
                          onChange={() => toggleCol("allowancePay")}
                        />
                      }
                      label={t("Allowance Pay") || "Allowance Pay"}
                    />
                  </MenuItem>
                  <MenuItem dense onClick={(e) => e.stopPropagation()}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={cols.adjustments}
                          onChange={() => toggleCol("adjustments")}
                        />
                      }
                      label={t("Adjustments") || "Adjustments"}
                    />
                  </MenuItem>
                  <MenuItem dense onClick={(e) => e.stopPropagation()}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={cols.salesQty}
                          onChange={() => toggleCol("salesQty")}
                        />
                      }
                      label={t("Sales Qty") || "Sales Qty"}
                    />
                  </MenuItem>
                  <MenuItem dense onClick={(e) => e.stopPropagation()}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={cols.salesTotal}
                          onChange={() => toggleCol("salesTotal")}
                        />
                      }
                      label={t("Sales Total (LYD)") || "Sales Total (LYD)"}
                    />
                  </MenuItem>
                  <MenuItem dense onClick={(e) => e.stopPropagation()}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={cols.gold}
                          onChange={() => toggleCol("gold")}
                        />
                      }
                      label={t("Gold Commission") || "Gold Commission"}
                    />
                  </MenuItem>
                  <MenuItem dense onClick={(e) => e.stopPropagation()}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={cols.diamond}
                          onChange={() => toggleCol("diamond")}
                        />
                      }
                      label={t("Diamond Commission") || "Diamond Commission"}
                    />
                  </MenuItem>
                  <MenuItem dense onClick={(e) => e.stopPropagation()}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={cols.totalUsd}
                          onChange={() => toggleCol("totalUsd")}
                        />
                      }
                      label={t("Total (USD)") || "Total (USD)"}
                    />
                  </MenuItem>
                </Menu>
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
                      "Food Allowance",
                      "Fuel Allowance",
                      "Communication Allowance",
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
                      const baseUsd = e.baseSalaryUsd
                        ? (e.baseSalaryUsd / W) * F
                        : 0;
                      const row: any[] = [
                        `${e.name}`,
                        e.workingDays,
                        e.deductionDays,
                        e.presentWorkdays,
                        e.holidayWorked,
                        (e.baseSalary || 0).toFixed(2),
                        (() => {
                          const W = Math.max(1, e.workingDays || 1);
                          const foodPer = Number(
                            (e as any).FOOD || (e as any).FOOD_ALLOWANCE || 0
                          );
                          const fd =
                            Number(
                              ((e as any).foodDays ?? e.workingDays) || 0
                            ) || W;
                          return (foodPer * fd).toFixed(2);
                        })(),
                        (() => {
                          const W = Math.max(1, e.workingDays || 1);
                          const fuel = Number((e as any).FUEL || 0);
                          return (fuel * W).toFixed(2);
                        })(),
                        (() => {
                          const W = Math.max(1, e.workingDays || 1);
                          const comm = Number((e as any).COMMUNICATION || 0);
                          return (comm * W).toFixed(2);
                        })(),
                        (e.components?.basePay || 0).toFixed(2),
                        (e.components?.allowancePay || 0).toFixed(2),
                      ];
                      if (cols.adjustments) row.push(netAdj.toFixed(2));
                      if (cols.salesQty) row.push((s.qty || 0).toFixed(0));
                      if (cols.salesTotal)
                        row.push((s.total_lyd || 0).toFixed(2));
                      row.push(e.total.toFixed(2));
                      if (cols.totalUsd) row.push(baseUsd.toFixed(2));
                      lines.push(row.join(","));
                    });
                    const blob = new Blob([lines.join("\n")], {
                      type: "text/csv;charset=utf-8;",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `payroll_${year}_${String(month).padStart(2, "0")}.csv`;
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
                      vals.push(e.total.toFixed(0));
                      if (cols.totalUsd) vals.push(baseUsd.toFixed(0));
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

          {tab === "loans" && (
            <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={2}>
              <Box display="grid" gap={1}>
                <Typography variant="subtitle1">
                  {t("Salary Advance")}
                </Typography>
                <TextField
                  select
                  size="small"
                  label={t("Employee") || "Employee"}
                  value={adjEmpId || ""}
                  onChange={(e) => setAdjEmpId(Number(e.target.value) || null)}
                >
                  {(result?.employees || []).map((emp) => (
                    <MenuItem key={emp.id_emp} value={emp.id_emp}>
                      {emp.name} (ID: {emp.id_emp})
                    </MenuItem>
                  ))}
                </TextField>
                {(() => {
                  const emp = (result?.employees || []).find(
                    (x) => x.id_emp === adjEmpId
                  );
                  return emp ? (
                    <Typography variant="caption">
                      Salary: {emp.baseSalary.toFixed(2)} LYD
                    </Typography>
                  ) : null;
                })()}
                <TextField
                  size="small"
                  label={t("Amount (LYD)") || "Amount (LYD)"}
                  value={adjForm.amount}
                  onChange={(e) =>
                    setAdjForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
                <TextField
                  select
                  size="small"
                  label={t("Apply to") || "Apply to"}
                  value={String(advMonthOffset)}
                  onChange={(e) =>
                    setAdvMonthOffset(Number(e.target.value) || 0)
                  }
                >
                  <MenuItem value={0}>
                    {t("This month") || "This month"}
                  </MenuItem>
                  <MenuItem value={1}>
                    {t("Next month") || "Next month"}
                  </MenuItem>
                </TextField>
                <Button
                  variant="contained"
                  onClick={async () => {
                    if (!adjEmpId || !adjForm.amount) return;
                    setAdjLoading(true);
                    try {
                      let ty = year,
                        tm = month;
                      if (advMonthOffset === 1) {
                        const d = dayjs(
                          `${year}-${String(month).padStart(2, "0")}-01`
                        ).add(1, "month");
                        ty = d.year();
                        tm = d.month() + 1;
                      }
                      const payload = {
                        year: ty,
                        month: tm,
                        employeeId: adjEmpId,
                        type: "advance",
                        amount: Number(adjForm.amount),
                        currency: "LYD",
                        note: "advance",
                      };
                      const res = await fetch(
                        `http://localhost:9000/hr/payroll/adjustments`,
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            ...authHeader(),
                          } as unknown as HeadersInit,
                          body: JSON.stringify(payload),
                        }
                      );
                      if (!res.ok) throw new Error("Failed to add advance");
                      await onRun();
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
              <Box display="grid" gap={1}>
                <Typography variant="subtitle1">{t("Create Loan")}</Typography>
                <TextField
                  select
                  size="small"
                  label={t("Employee") || "Employee"}
                  value={adjEmpId || ""}
                  onChange={(e) => setAdjEmpId(Number(e.target.value) || null)}
                >
                  {(result?.employees || []).map((emp) => (
                    <MenuItem key={emp.id_emp} value={emp.id_emp}>
                      {emp.name} (ID: {emp.id_emp})
                    </MenuItem>
                  ))}
                </TextField>
                {(() => {
                  const emp = (result?.employees || []).find(
                    (x) => x.id_emp === adjEmpId
                  );
                  return emp ? (
                    <Typography variant="caption">
                      Salary: {emp.baseSalary.toFixed(2)} LYD
                    </Typography>
                  ) : null;
                })()}
                <TextField
                  size="small"
                  label={t("Loan Amount (LYD)") || "Loan Amount (LYD)"}
                  value={(adjForm as any).principal || ""}
                  onChange={(e) =>
                    setAdjForm((f: any) => ({
                      ...f,
                      principal: e.target.value,
                    }))
                  }
                />
                <TextField
                  select
                  size="small"
                  label={t("Monthly % of salary") || "Monthly % of salary"}
                  value={(adjForm as any).percent || "0.25"}
                  onChange={(e) =>
                    setAdjForm((f: any) => ({ ...f, percent: e.target.value }))
                  }
                >
                  {[
                    "0.10",
                    "0.15",
                    "0.20",
                    "0.25",
                    "0.30",
                    "0.35",
                    "0.40",
                    "0.50",
                  ].map((v) => (
                    <MenuItem key={v} value={v}>
                      {(Number(v) * 100).toFixed(0)}%
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label={t("Cap multiple") || "Cap multiple"}
                  value={(adjForm as any).cap || "3"}
                  onChange={(e) =>
                    setAdjForm((f: any) => ({ ...f, cap: e.target.value }))
                  }
                >
                  {["2", "3", "4", "5", "6", "8", "10"].map((v) => (
                    <MenuItem key={v} value={v}>
                      {v}x
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="contained"
                  onClick={async () => {
                    if (!adjEmpId || !(adjForm as any).principal) return;
                    setAdjLoading(true);
                    try {
                      const emp = (result?.employees || []).find(
                        (x) => x.id_emp === adjEmpId
                      );
                      const monthlyPercent = Number(
                        (adjForm as any).percent || 0.25
                      );
                      const capMultiple = Number((adjForm as any).cap || 3);
                      const principal = Number((adjForm as any).principal);
                      const overDefaults =
                        capMultiple > 3 ||
                        monthlyPercent > 0.25 ||
                        (emp && principal > emp.baseSalary * 3);
                      if (overDefaults) {
                        const ok = window.confirm(
                          "You are setting values above standard (3x cap or 25% monthly). Proceed?"
                        );
                        if (!ok) {
                          setAdjLoading(false);
                          return;
                        }
                      }
                      await createV2Loan({
                        employeeId: adjEmpId,
                        principal,
                        startYear: year,
                        startMonth: month,
                        monthlyPercent,
                        capMultiple,
                      });
                      await onRun();
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
              <Box gridColumn="1 / span 2">
                <Typography variant="subtitle1">
                  {t("Loans for Employee") || "Loans for Employee"}{" "}
                  {(() => {
                    const emp = (result?.employees || []).find(
                      (x) => x.id_emp === adjEmpId
                    );
                    return emp ? `${emp.name} (ID: ${emp.id_emp})` : "";
                  })()}
                </Typography>
                <Box display="flex" gap={1} my={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={async () => {
                      if (!adjEmpId) return;
                      try {
                        const js = await listV2Loans(adjEmpId);
                        setAdjRows(
                          (js?.rows || []).map((x: any) => ({
                            type: "loan",
                            amount: x.remaining,
                            currency: "LYD",
                            note: `loan#${x.id}`,
                            ts: x.createdAt,
                          }))
                        );
                      } catch (e: any) {
                        alert(e?.message || "Failed");
                      }
                    }}
                  >
                    {t("Refresh Loans") || "Refresh Loans"}
                  </Button>
                  <Button
                    size="small"
                    onClick={async () => {
                      if (!adjEmpId) return;
                      try {
                        await skipV2LoanMonth({
                          employeeId: adjEmpId,
                          year,
                          month,
                        });
                      } catch (e: any) {
                        alert(e?.message || "Failed");
                        return;
                      }
                      alert("Skipped this month deduction");
                      await onRun();
                    }}
                  >
                    {t("Skip this month") || "Skip this month"}
                  </Button>
                  <Button
                    size="small"
                    onClick={async () => {
                      if (!adjEmpId) return;
                      const amount = prompt(
                        "Payoff amount (leave empty for full payoff):",
                        ""
                      );
                      const body: any = { employeeId: adjEmpId };
                      if (amount && !isNaN(Number(amount)))
                        body.amount = Number(amount);
                      try {
                        await payoffV2Loan(body);
                      } catch (e: any) {
                        alert(e?.message || "Failed");
                        return;
                      }
                      alert("Payoff recorded");
                      await onRun();
                    }}
                  >
                    {t("Payoff") || "Payoff"}
                  </Button>
                  <Button
                    size="small"
                    onClick={async () => {
                      if (!adjEmpId) return;
                      const q = new URLSearchParams({
                        employeeId: String(adjEmpId),
                      });
                      const res = await fetch(
                        `http://localhost:9000/hr/payroll/history/total?${q.toString()}`,
                        { headers: authHeader() as unknown as HeadersInit }
                      );
                      const js = await res.json();
                      if (!res.ok) {
                        alert(js?.message || "Failed");
                        return;
                      }
                      alert(`Total salaries paid (LYD): ${js.totalLyd}`);
                    }}
                  >
                    {t("History totals") || "History totals"}
                  </Button>
                </Box>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {loading && (
        <Box display="flex" alignItems="center" gap={1}>
          <CircularProgress size={20} />
          <Typography>{t("hr.timesheets.loading") || "Loading..."}</Typography>
        </Box>
      )}
      {!loading && result && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              {t("Period") || "Period"}:{" "}
              {`${year}-${String(month).padStart(2, "0")}-01`} →{" "}
              {`${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`}{" "}
              — {t("common.showing") || "Showing"} {result?.count ?? 0}
            </Typography>
            <Box display="grid" gridTemplateColumns={{ xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' }} gap={1.25} sx={{ mb: 1 }}>
              <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">{t('Employees') || 'Employees'}</Typography>
                <Typography fontWeight={600}>{result?.count ?? 0}</Typography>
              </Box>
              <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">{t('Base Salary') || 'Base Salary'}</Typography>
                <Typography fontWeight={600}>{totals.baseSalary.toFixed(2)} LYD</Typography>
              </Box>
              <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">{t('Allowance Pay') || 'Allowance Pay'}</Typography>
                <Typography fontWeight={600}>{totals.allow.toFixed(2)} LYD</Typography>
              </Box>
              <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">{t('Adjustments') || 'Adjustments'}</Typography>
                <Typography fontWeight={600}>{totals.adj.toFixed(2)} LYD</Typography>
              </Box>
              <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">{t('Total (LYD)') || 'Total (LYD)'}</Typography>
                <Typography fontWeight={700}>{totals.totalLyd.toFixed(2)} LYD</Typography>
              </Box>
              {cols.totalUsd && (
                <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">{t('Total (USD)') || 'Total (USD)'}</Typography>
                  <Typography fontWeight={700}>{totals.totalUsd.toFixed(2)} USD</Typography>
                </Box>
              )}
            </Box>
            <TableContainer sx={{ overflowX: 'hidden' }}>
              <Table
                stickyHeader
                size="small"
                sx={{
                  tableLayout: "fixed",
                  width: "100%",
                  "& .MuiTableCell-root": { py: 0.5, px: 1 },
                }}
              >
                <TableHead
                  sx={{
                    backgroundColor: "grey.50",
                    "& .MuiTableCell-head": {
                      fontSize: 10,
                      fontWeight: 700,
                      color: "text.secondary",
                      whiteSpace: "nowrap",
                      lineHeight: 1.2,
                      px: 0.5,
                    },
                    "& .MuiTableSortLabel-root": {
                      fontSize: 10,
                      maxWidth: "100%",
                      "& .MuiTableSortLabel-label": {
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      },
                    },
                  }}
                >
                  <TableRow>
                    {/* Employee column header narrowed */}
                    <TableCell
                      sortDirection={
                        sortKey === "name" ? sortDir : (false as any)
                      }
                      sx={{ width: 180, maxWidth: 180 }}
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
                        <TableSortLabel
                          active={sortKey === "presentWorkdays"}
                          direction={
                            sortKey === "presentWorkdays" ? sortDir : "asc"
                          }
                          onClick={(e: any) => handleSort("presentWorkdays")}
                        >
                          {t("Present Days") || "Present Days"}
                        </TableSortLabel>
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
                        <TableSortLabel
                          active={sortKey === "holidayWorked"}
                          direction={
                            sortKey === "holidayWorked" ? sortDir : "asc"
                          }
                          onClick={(e: any) => handleSort("holidayWorked")}
                        >
                          {t("Holidays Worked") || "Holidays Worked"}
                        </TableSortLabel>
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
                        <TableSortLabel
                          active={sortKey === "baseSalary"}
                          direction={sortKey === "baseSalary" ? sortDir : "asc"}
                          onClick={(e: any) => handleSort("baseSalary")}
                        >
                          {t("Base Salary") || "Base Salary"}
                        </TableSortLabel>
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
                        <TableSortLabel
                          active={sortKey === "food"}
                          direction={sortKey === "food" ? sortDir : "asc"}
                          onClick={(e: any) => handleSort("food")}
                        >
                          {t("Food Allowance") || "Food Allowance"}
                        </TableSortLabel>
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
                        <TableSortLabel
                          active={sortKey === "fuel"}
                          direction={sortKey === "fuel" ? sortDir : "asc"}
                          onClick={(e: any) => handleSort("fuel")}
                        >
                          {t("Fuel Allowance") || "Fuel Allowance"}
                        </TableSortLabel>
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
                        <TableSortLabel
                          active={sortKey === "comm"}
                          direction={sortKey === "comm" ? sortDir : "asc"}
                          onClick={(e: any) => handleSort("comm")}
                        >
                          {t("Communication Allowance") ||
                            "Communication Allowance"}
                        </TableSortLabel>
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
                        <TableSortLabel
                          active={sortKey === "basePay"}
                          direction={sortKey === "basePay" ? sortDir : "asc"}
                          onClick={(e: any) => handleSort("basePay")}
                        >
                          {t("Base Pay") || "Base Pay"}
                        </TableSortLabel>
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
                        <TableSortLabel
                          active={sortKey === "allowancePay"}
                          direction={
                            sortKey === "allowancePay" ? sortDir : "asc"
                          }
                          onClick={(e: any) => handleSort("allowancePay")}
                        >
                          {t("Allowance Pay") || "Allowance Pay"}
                        </TableSortLabel>
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
                        <TableSortLabel
                          active={sortKey === "gold"}
                          direction={sortKey === "gold" ? sortDir : "asc"}
                          onClick={(e: any) => handleSort("gold")}
                        >
                          {t("Gold Commission") || "Gold Commission"}
                        </TableSortLabel>
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
                        <TableSortLabel
                          active={sortKey === "diamond"}
                          direction={sortKey === "diamond" ? sortDir : "asc"}
                          onClick={(e: any) => handleSort("diamond")}
                        >
                          {t("Diamond Commission") || "Diamond Commission"}
                        </TableSortLabel>
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
                      </TableCell>
                    )}
                    <TableCell align="right" sx={{ width: 220 }}>
                      {t("Actions") || "Actions"}
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
                      <TableCell>
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
                              ID: {e.id_emp} {e.PS != null ? `• PS: ${e.PS}` : ""}
                            </Typography>
                          </Box>
                        </Box>
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
                            const per = Number(
                              (e as any).FOOD || (e as any).FOOD_ALLOWANCE || 0
                            );
                            const fd =
                              Number(
                                ((e as any).foodDays ?? e.workingDays) || 0
                              ) || W;
                            const v = per * fd;
                            return v ? v.toFixed(2) : "";
                          })()}
                        </TableCell>
                      )}
                      {cols.fuel && (
                        <TableCell align="right">
                          {(() => {
                            const W = Math.max(1, e.workingDays || 1);
                            const per = Number((e as any).FUEL || 0);
                            const v = per * W;
                            return v ? v.toFixed(2) : "";
                          })()}
                        </TableCell>
                      )}
                      {cols.comm && (
                        <TableCell align="right">
                          {(() => {
                            const W = Math.max(1, e.workingDays || 1);
                            const per = Number((e as any).COMMUNICATION || 0);
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
                        <strong>{e.total ? e.total.toFixed(2) : ""}</strong>
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
                            return baseUsd ? baseUsd.toFixed(2) : "";
                          })()}
                        </TableCell>
                      )}
                      <TableCell align="right">
                        <Box
                          display="flex"
                          gap={0.5}
                          justifyContent="flex-end"
                          alignItems="center"
                        >
                          <Tooltip title={t("Breakdown") || "Breakdown"} arrow>
                            <IconButton
                              size="small"
                              onClick={() => openBreakdown(e)}
                              aria-label="breakdown"
                            >
                              <ReceiptLongIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip
                            title={t("Adjustments") || "Adjustments"}
                            arrow
                          >
                            <IconButton
                              size="small"
                              onClick={() => openAdjust(e)}
                              aria-label="adjustments"
                            >
                              <EditNoteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
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
