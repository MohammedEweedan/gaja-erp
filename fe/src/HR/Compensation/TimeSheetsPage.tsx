import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Grid } from '@mui/material';
import { buildEncryptedProfilePath } from "../../utils/routeCrypto";
import { 
  buildPayrollAggregation, 
  calculateMissingMinutes, 
  calculateAbsenceDays,
  minutesToSignedHHMM,
  TOLERANCE_MINUTES,
  type PayrollAggData
} from "./shared/payrollCalculations";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  MenuItem,
  Button,
  Divider,
  Select,
  InputLabel,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  IconButton,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

import {
  syncMonth,
  manualPunch,
  listPs,
  PsItem,
  getTimesheetMonth,
  updateTimesheetDay,
  TimesheetDay,
  rangePunches,
  RangePunchesEmployee,
  listPsPoints,
  updateAttendance,
} from "../../api/attendance";
import { getVacationsInRange, VacationRecord } from "../../api/vacations";
import {
  getLeaveRequests,
  getLeaveTypes,
  getHolidays,
  getLeaveBalance,
  getCalendarLog,
} from "../../services/leaveService";
import { listEmployees, updateEmployeeTimes, getEmployeeById } from "../../api/employees";
import { computePayrollV2 } from "../../api/payroll";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { useTranslation } from "react-i18next";
import { useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import html2canvas from "html2canvas";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SettingsIcon from "@mui/icons-material/Settings";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FingerprintIcon from "@mui/icons-material/Fingerprint";

dayjs.extend(utc);
dayjs.extend(isSameOrBefore);

dayjs.extend(utc);

const parseHmToMinutes = (value: any): number | null => {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const match = s.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const total = hh * 60 + mm;
  return Number.isFinite(total) ? total : null;
};

const computeDeltaFromSchedule = (
  entry: string | null | undefined,
  exit: string | null | undefined,
  schedStart: string | null | undefined,
  schedEnd: string | null | undefined
): number | null => {
  const startMinutes = parseHmToMinutes(entry);
  const endMinutes = parseHmToMinutes(exit);
  const expectedStart = parseHmToMinutes(schedStart);
  const expectedEnd = parseHmToMinutes(schedEnd);
  if (
    startMinutes == null ||
    endMinutes == null ||
    endMinutes <= startMinutes ||
    expectedStart == null ||
    expectedEnd == null ||
    expectedEnd <= expectedStart
  ) {
    return null;
  }
  const worked = endMinutes - startMinutes;
  const expected = expectedEnd - expectedStart;
  const actualDelta = worked - expected;
  return normalizeDelta(actualDelta);
};

const toFiniteNumber = (value: any): number | null => {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

// Helper: parse various start-date formats into a dayjs date (no hooks)
function parseStartDateLocal(val: any): dayjs.Dayjs | null {
  if (!val) return null;
  const s = String(val).trim();
  const head = s.slice(0, 10); // strip any time portion
  // DD/MM/YYYY or DD-MM-YYYY
  const m1 = head.match(/^([0-3]?\d)[-/]([0-1]?\d)[-/]([0-9]{4})$/);
  if (m1) {
    const dd = Number(m1[1]);
    const mm = Number(m1[2]);
    const yy = Number(m1[3]);
    const iso = `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    const d1 = dayjs(iso);
    if (d1.isValid()) return d1;
  }
  // YYYY-MM-DD or YYYY/MM/DD
  const m2 = head.match(/^([0-9]{4})[-/]([0-1]?\d)[-/]([0-3]?\d)$/);
  if (m2) {
    const yy = Number(m2[1]);
    const mm = Number(m2[2]);
    const dd = Number(m2[3]);
    const iso = `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    const d2 = dayjs(iso);
    if (d2.isValid()) return d2;
  }
  // Fallback: let dayjs try the original string
  const d0 = dayjs(s);
  if (d0.isValid()) return d0;
  return null;
}

type EmpOption = { 
  id: number; 
  name: string; 
  nameAr?: string; 
  ps?: string; 
  tStart?: string; 
  tEnd?: string; 
  FINGERPRINT_NEEDED?: boolean | null; 
  state?: boolean | null; 
  STATE?: boolean | null;
  ACTIVE?: boolean | null;
  active?: boolean | null;
  Status?: boolean | null;
  STATUS?: boolean | null;
  T_END?: string | null;
  CONTRACT_END?: string | null;
  contract_end?: string | null;
  contractEnd?: string | null;
};

type EmpScheduleInfo = {
  start: string;
  end: string;
  title?: string | null;
};

type PayrollAggRow = {
  id_emp: string | number;
  missing_minutes?: number;
  missingMinutes?: number;
  latencyMinutes?: number;
  absence_days?: number;
  absenceDays?: number;
};

const normalizeDelta = (minutes?: number | null): number | null => {
  if (minutes == null || !Number.isFinite(minutes)) return minutes ?? null;
  return Math.abs(minutes) <= TOLERANCE_MINUTES ? 0 : minutes;
};

const months = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: dayjs().month(i).format("MMMM"),
}));
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

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
  if (s === "true" || s === "1" || s === "yes" || s === "y" || s === "on") return true;
  if (s === "false" || s === "0" || s === "no" || s === "n" || s === "off") return false;
  return undefined;
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
    "FINGERPRINT_NEEDED",
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

function extractStateRaw(obj: any): any {
  const direct = pickField(obj, [
    "STATE",
    "state",
    "ACTIVE",
    "active",
    "Actived",
    "STATUS",
    "Status",
  ]);
  if (direct !== undefined) return direct;
  try {
    for (const k of Object.keys(obj || {})) {
      const lk = k.toLowerCase();
      if (lk === "state" || lk === "active" || lk === "status") return (obj as any)[k];
    }
  } catch {}
  return undefined;
}

function extractArabicNameRaw(obj: any): string | null {
  const direct = pickField(obj, [
    "NAME_AR",
    "name_ar",
    "NAME_ARABIC",
    "name_arabic",
    "AR_NAME",
    "ar_name",
    "FULL_NAME_AR",
    "full_name_ar",
  ]);
  const val = direct != null ? String(direct).trim() : "";
  return val ? val : null;
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizePossiblyMojibakeUtf8(input: any): string {
  const s = input == null ? "" : String(input);
  if (!s) return "";
  const hasLatin1Bytes = /[\u0080-\u00FF]/.test(s);
  if (!hasLatin1Bytes) return s;
  try {
    const bytes = Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const decodedHasArabic = /[\u0600-\u06FF]/.test(decoded);
    if (decoded && decodedHasArabic) return decoded;
  } catch {}
  return s;
}

// ---- TIME UTILITIES ----

// Minimal shape used in this file
interface Employee {
  ID_EMP: number;
  NAME?: string;
  ps?: number | string; // backend may return number; we normalize later
  T_START?: string | null;
  T_END?: string | null;
  TITLE?: string | null;
  FINGERPRINT_NEEDED?: boolean | null;
}

/**
 * Formats time to 12-hour format (e.g., "14:30" -> "2:30 PM")
 */
export function to12h(kind?: string | null) {
  if (!kind) return "—";
  // 1) plain HH:mm or HH:mm:ss
  let m = kind.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (m) return to12(`${m[1]}:${m[2]}`);
  // 2) any ISO-ish with time
  m = kind.match(/T(\d{2}):(\d{2})(?::\d{2})?/);
  if (m) return to12(`${m[1]}:${m[2]}`);
  return "—";
}

function to12(hhmm: string) {
  const [hStr, mStr] = hhmm.split(":");
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = ((h + 11) % 12) + 1;
  return `${h}:${mStr} ${ampm}`;
}

const BASE_URL = process.env.REACT_APP_BASE_URL;

// Helper function to get auth headers
function authHeaders(): HeadersInit {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ---- TOKEN: base64url encode/decode emp id ----
export function encodeEmployeeToken(id: number) {
  const raw = `emp:${id}:gaja`;
  const b64 = btoa(unescape(encodeURIComponent(raw)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
export function decodeEmployeeToken(token: string): number | null {
  try {
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    const raw = decodeURIComponent(escape(atob(b64)));
    const m = raw.match(/^emp:(\d+):gaja$/);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

// Strict, no-slice normalizer for leave labels/codes.
// Returns canonical code from: AL, SL, EL, UL, ML, XL, B1, B2, HL, BM
function normalizeLeaveCode(
  input?: string
):
  | ""
  | "AL"
  | "SL"
  | "EL"
  | "UL"
  | "ML"
  | "XL"
  | "B1"
  | "B2"
  | "HL"
  | "BM"
  | "PH"
  | "PHF"
  | "PT"
  | "PL" {
  if (!input) return "";
  const up = String(input).trim().toUpperCase();

  // exact codes first
  const exact = new Set([
    "AL",
    "SL",
    "EL",
    "UL",
    "ML",
    "XL",
    "B1",
    "B2",
    "HL",
    "BM",
    "PH",
    "PHF",
    "PT",
    "PL",
  ]);
  
  if (exact.has(up)) return up as any;

  // synonyms / substrings (EN + a few common variants)
  if (/\bANNUAL\b|ANNUA|ANUAL/.test(up)) return "AL";
  if (/\bSICK\b|MEDICAL|DOCTOR/.test(up)) return "SL";
  if (/EMERG/.test(up)) return "EL";
  if (/PAID\s*HOLIDAY|\bPH\b/.test(up)) return "PH";
  if (/PAID\s*HOLIDAY.*FOOD|\bPHF\b/.test(up)) return "PHF";
  if (/PRESENT.*FOOD|\bPT\b/.test(up)) return "PT";
  if (/PRESENT.*LATE|\bPL\b/.test(up)) return "PL";
  if (/UNPAID|WITHOUT\s*PAY|\bUP\b/.test(up)) return "UL";
  if (/MATERN/.test(up)) return "ML";
  if (/EXAM|TEST\b/.test(up)) return "XL";
  if (/\bB1\b|BEREAVE.?1/.test(up)) return "B1";
  if (/\bB2\b|BEREAVE.?2/.test(up)) return "B2";
  if (/\bHALF\b|HALF[-\s]?DAY|\bHL\b/.test(up)) return "HL";
  if (/BEREAVE(?!.*\b[12]\b)|\bBM\b/.test(up)) return "BM";

  // Arabic quick heuristics (optional — expand as needed)
  if (/سنو/.test(up)) return "AL";     // سنوي
  if (/مرض/.test(up)) return "SL";     // مرضي
  if (/طار/.test(up)) return "EL";     // طارئ
  if (/بدون\s*مرتب|غير\s*مدفو/.test(up)) return "UL";
  if (/أموم|أمومة/.test(up)) return "ML";
  if (/امتح/.test(up)) return "XL";
  if (/نصف/.test(up)) return "HL";

  // unknown → no code; do NOT slice to 2 letters
  return "";
}

// Justification codes
// Timesheet (attendance) codes only — leave codes removed
const JUSTIFICATION_CODES = [
  { value: "P", label: "Present" },
  { value: "A", label: "Absent" },
  { value: "PT", label: "Present (Full Day + Food Allowance)" },
  { value: "PL", label: "Present but Late" },
  { value: "PH", label: "Paid Holiday (Double Pay, No Food)" },
  { value: "PHF", label: "Paid Holiday with Food Allowance" },
];

export default function TimeSheetsPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [employees, setEmployees] = useState<EmpOption[]>([]);
  const [empStartDateMap, setEmpStartDateMap] = useState<Map<number, string>>(new Map());
  const [empLoading, setEmpLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState<number>(0);
  const [employeeName, setEmployeeName] = useState<string>("");
  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState<"single" | "all">("single");
  const [exportEmployeeId, setExportEmployeeId] = useState<number | null>(null);
  const [exportYear, setExportYear] = useState<number>(currentYear);
  const [exportPeriod, setExportPeriod] = useState<"month" | "year" | "ytd" | "custom">("month");
  const [exportStartDate, setExportStartDate] = useState<Dayjs | null>(dayjs().startOf('month'));
  const [exportEndDate, setExportEndDate] = useState<Dayjs | null>(dayjs());
  const fullscreenRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const fmtTime = (t: any) => {
    if (!t) return "—";
    // handle Date, dayjs, or string-like
    try {
      if (t instanceof Date) return dayjs(t).format("HH:mm");
      const s = String(t);
      // common "HH:mm[:ss]" or "YYYY-MM-DDTHH:mm" cases
      const m = s.match(/\d{2}:\d{2}(?::\d{2})?/);
      if (m) return m[0].slice(0, 5);
      // numeric minutes since midnight?
      const n = Number(s);
      if (Number.isFinite(n))
        return dayjs().startOf("day").add(n, "minute").format("HH:mm");
      return s;
    } catch {
      return String(t);
    }
  };
  
  const fmtYMD = (y: number, m: number, d: number) =>
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const [exportMonth, setExportMonth] = useState<number>(
    new Date().getMonth() + 1
  );
  const [exportLoading, setExportLoading] = useState(false);
  const pdfLibRef = useRef<{ jsPDF: any; autoTable: any } | null>(null);
  const exportCacheRef = useRef<Map<string, TimesheetDay[]>>(new Map());
  const pdfLogoRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const PS_KEYS = ["P1", "P2", "P3", "P4"];
  const [timeLogDialogOpen, setTimeLogDialogOpen] = useState(false);
  const [timeLogData, setTimeLogData] = useState<{
    employeeId: number;
    employeeName: string;
    days: Array<{
      date: string;
      dateFormatted: string;
      expectedHours: number;
      workedHours: number;
      deltaHours: number;
      isWeekend: boolean;
      isHoliday: boolean;
      isAbsentDay: boolean;
      missingHoursOnly: number;
    }>;
    total: {
      expectedHours: number;
      workedHours: number;
      deltaHours: number;
      missingHoursOnly: number;
    };
    missingHoursFromPayroll?: number | null;
  } | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [payrollAggByEmp, setPayrollAggByEmp] = useState<Map<number, PayrollAggRow>>(new Map());

  function arrayBufferToBase64(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  async function getLogoBase64(): Promise<string | null> {
    if (pdfLogoRef.current) return pdfLogoRef.current;
    try {
      const response = await fetch("/Gaja_out_black.png");
      if (!response.ok) return null;
      const buffer = await response.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      const dataUrl = `data:image/png;base64,${base64}`;
      pdfLogoRef.current = dataUrl;
      return dataUrl;
    } catch (err) {
      console.error("Failed to load logo for PDF", err);
      return null;
    }
  }

  const [v2Rows, setV2Rows] = React.useState<any[]>([]);

  const closeExportDialog = useCallback(() => {
    setExportOpen(false);
    setExportLoading(false);
  }, []);

  async function getPdfLibraries() {
    if (pdfLibRef.current) return pdfLibRef.current;
    const [{ jsPDF }, autoTableModule] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const libs = {
      jsPDF,
      autoTable: (autoTableModule as any).default || autoTableModule,
    };
    pdfLibRef.current = libs;
    return libs;
  }

  const getVr = (empId: number) =>
    (v2Rows || []).find((x: any) => Number(x.id_emp) === Number(empId)) || ({} as any);

  const resolveAttendance = (empId: number) => {
    const vr = getVr(empId);

    const latencyMinutes = Number(vr.latencyMinutes ?? vr.missing_minutes ?? 0) || 0;
    const latLyd = Number(vr.missing_lyd ?? vr.latency_lyd ?? 0) || 0;
    const latUsd = Number(vr.missing_usd ?? vr.latency_usd ?? 0) || 0;

    const absenceDays = Number(vr.absence_days ?? 0) || 0;
    const absenceLyd = Number(vr.absence_lyd ?? 0) || 0;
    const absenceUsd = Number(vr.absence_usd ?? 0) || 0;

    return { vr, latencyMinutes, latLyd, latUsd, absenceDays, absenceLyd, absenceUsd };
  };

  const getTimesheetDays = useCallback(
    async (empId: number, year: number, month: number): Promise<TimesheetDay[] | null> => {
      const key = `${empId}-${year}-${month}`;
      if (exportCacheRef.current.has(key)) {
        return exportCacheRef.current.get(key) ?? null;
      }
      try {
        const { data } = await getTimesheetMonth(
          empId,
          year,
          month
        );
        exportCacheRef.current.set(key, data);
        return data;
      } catch (err) {
        console.error("Failed to fetch timesheet for export", err);
        exportCacheRef.current.set(key, []);
        return null;
      }
    },
    []
  );

  const formatEntryExit = (value?: string | null) => {
    if (!value) return "";
    const raw = String(value);
    if (raw.length >= 16) {
      return raw.slice(11, 16);
    }
    return raw;
  };
  
  const mapDaysToRows = useCallback((days: TimesheetDay[]): string[][] => {
    return days.map((day) => {
      const deltaLabel = roundedHoursWithSign(day.deltaMin ?? null);
      const presentLabel = day.present
        ? "Yes"
        : day.entry || day.exit
          ? "Yes"
          : "";
      const normalizedCode = day.code ? String(day.code).toUpperCase() : "";
      const codeLabel = day.isHoliday
        ? normalizedCode === "PH" || normalizedCode === "PHF"
          ? normalizedCode
          : ""
        : normalizedCode
          ? normalizedCode
          : isAbsentDay(day)
            ? "A"
            : "";
      return [
        String(day.day ?? ""),
        codeLabel,
        day.reason ? String(day.reason) : "",
        formatEntryExit(day.entry),
        formatEntryExit(day.exit),
        deltaLabel,
        presentLabel,
        day.isHoliday ? "Yes" : "",
        day.comment ? String(day.comment) : "",
      ];
    });
  }, []);

  const selectedExportEmployee = useMemo(() => {
    if (exportMode !== "single" || exportEmployeeId == null) return null;
    return employees.find((emp) => emp.id === exportEmployeeId) || null;
  }, [exportMode, exportEmployeeId, employees]);

  const getEmployeeLabelForExport = useCallback(
    (empId: number) => {
      const meta = employees.find((e) => e.id === empId) || null;
      const ar = meta?.nameAr ? normalizePossiblyMojibakeUtf8(meta.nameAr).trim() : "";
      const en = meta?.name ? normalizePossiblyMojibakeUtf8(meta.name).trim() : "";
      return {
        ar: ar || en || String(empId),
        en: en || ar || String(empId),
        ps: meta?.ps ? String(meta.ps) : "",
      };
    },
    [employees]
  );

  const generateSingleEmployeeCorporatePrint = useCallback(
    async (empId: number) => {
      const mm = String(exportMonth).padStart(2, "0");
      const monthStart = dayjs(`${exportYear}-${mm}-01`).startOf("day");
      const daysInMonth = monthStart.daysInMonth();
      const days = await getTimesheetDays(empId, exportYear, exportMonth);
      if (!days || days.length === 0) throw new Error("No timesheet data available for the selected month.");

      const dayMap = new Map<number, TimesheetDay>();
      for (const d of days) {
        const n = Number((d as any).day ?? 0);
        if (n > 0) dayMap.set(n, d);
      }

      const sched = empSchedule.get(empId) || null;
      const start12 = sched?.start ? to12h(sched.start) : "—";
      const end12 = sched?.end ? to12h(sched.end) : "—";
      const label = getEmployeeLabelForExport(empId);

      const fileSafe = (s: string) =>
        s
          .trim()
          .replace(/[\\/:*?"<>|]+/g, "_")
          .replace(/\s+/g, "_")
          .slice(0, 80);
      const fileBase = `${fileSafe(label.ar || label.en || String(empId))}_timesheet_${mm}_${exportYear}`;

      const dayCodes: string[] = [];
      const dayIn: string[] = [];
      const dayOut: string[] = [];
      const dayMissing: string[] = [];

      let totalMissingMin = 0;
      let fridayCount = 0;

      const weekdayLabels: string[] = [];
      const isFridayCol: boolean[] = [];

      let lateCount = 0;
      let absentCount = 0;
      let earlyCount = 0;
      let holidayCount = 0;
      let holidayWorkedCount = 0;
      let presentCount = 0;

      const lateDays: number[] = [];
      const absentDays: number[] = [];
      const earlyDays: number[] = [];
      const holidayWorkedDays: number[] = [];

      const fpNotNeeded = isEmpFingerprintNotNeeded(empId);

      for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const ymd = `${exportYear}-${mm}-${String(dayNum).padStart(2, "0")}`;
        const d = dayMap.get(dayNum) || null;
        const isFriday = dayjs(ymd).day() === 5;
        const isHoliday = Boolean(d?.isHoliday) || holidaysSet.has(ymd);
        const isAbsent = fpNotNeeded ? false : isAbsentDay(d);
        const isPresent = fpNotNeeded ? true : hasPresence(d);

        const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayjs(ymd).day()] || "";
        weekdayLabels.push(dow);
        isFridayCol.push(isFriday);
        if (isFriday) fridayCount++;

        if (isPresent) presentCount++;
        if (isAbsent && !isHoliday && !isFriday) {
          absentCount++;
          absentDays.push(dayNum);
        }
        if (isHoliday) holidayCount++;
        if (isHoliday && isPresent) {
          holidayWorkedCount++;
          holidayWorkedDays.push(dayNum);
        }

        const entry = d?.entry ? formatEntryExit(d.entry) : "";
        const exit = d?.exit ? formatEntryExit(d.exit) : "";

        let code = "";
        const rawCode = String((d as any)?.code || "").toUpperCase();
        if (rawCode) code = rawCode;
        if (isFriday) code = "";
        else if (isAbsent && !isHoliday) code = "A";
        if (isHoliday && isPresent) code = "PHF";

        let isLate = false;
        if (sched?.start && entry && !isHoliday) {
          try {
            const st = dayjs(`${ymd}T${sched.start}:00`);
            const et = dayjs(`${ymd}T${entry}:00`);
            const diff = et.diff(st, "minute");
            if (diff > 0) {
              isLate = true;
              lateCount++;
              lateDays.push(dayNum);
              if (code === "P") code = "PL";
            }
          } catch {}
        }

        let isEarly = false;
        if (sched?.end && exit && !isHoliday && isPresent) {
          try {
            const et = dayjs(`${ymd}T${sched.end}:00`);
            const xt = dayjs(`${ymd}T${exit}:00`);
            const diff = et.diff(xt, "minute");
            if (diff > 0) {
              isEarly = true;
              earlyCount++;
              earlyDays.push(dayNum);
            }
          } catch {}
        }

        const excludeMissing = isFriday || isHoliday;
        const missingHrs =
          !excludeMissing && typeof (d as any)?.deltaMin === "number" && (d as any).deltaMin < 0
            ? (Math.abs((d as any).deltaMin) / 60).toFixed(2)
            : "";

        if (!excludeMissing && typeof (d as any)?.deltaMin === "number" && (d as any).deltaMin < 0) {
          const abs = Math.abs((d as any).deltaMin);
          if (abs > TOLERANCE_MINUTES) totalMissingMin += abs;
        }

        dayCodes.push(code);
        dayIn.push(entry);
        dayOut.push(exit);
        dayMissing.push(missingHrs && missingHrs !== "0.00" ? missingHrs : "");
      }

      const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
      const renderRow = (labelText: string, values: string[]) => {
        const labelCell = `<th class="rowHdr">${escapeHtml(labelText)}</th>`;
        const tds = values
          .map((v, idx) =>
            `<td class="v${isFridayCol[idx] ? " fri" : ""}">${v ? escapeHtml(String(v)) : ""}</td>`
          )
          .join("");
        return `<tr>${labelCell}${tds}</tr>`;
      };

      const hasAnyValue = (arr: string[]) => arr.some((v) => String(v || "").trim() !== "");
      const showCodeRow = hasAnyValue(dayCodes);
      const showInRow = hasAnyValue(dayIn);
      const showOutRow = hasAnyValue(dayOut);
      const showMissingRow = hasAnyValue(dayMissing);

      const exceptionsParts: string[] = [];
      const fmtDays = (arr: number[]) => arr.join(", ");
      if (absentDays.length) exceptionsParts.push(`<div><b>Absent:</b> ${escapeHtml(fmtDays(absentDays))}</div>`);
      if (lateDays.length) exceptionsParts.push(`<div><b>Late:</b> ${escapeHtml(fmtDays(lateDays))}</div>`);
      if (earlyDays.length) exceptionsParts.push(`<div><b>Left Early:</b> ${escapeHtml(fmtDays(earlyDays))}</div>`);
      if (holidayWorkedDays.length) exceptionsParts.push(`<div><b>Holiday Worked:</b> ${escapeHtml(fmtDays(holidayWorkedDays))}</div>`);
      const exceptionsHtml = exceptionsParts.length
        ? `<div class="box"><div class="title">Exceptions</div><div class="meta">${exceptionsParts.join("")}</div></div>`
        : ``;

      const missingHoursTotal = totalMissingMin > 0 ? Number((totalMissingMin / 60).toFixed(2)) : 0;
      const summaryItems: Array<{ k: string; v: number | string }> = [
        { k: "Present", v: presentCount },
        { k: "Absent", v: absentCount },
        { k: "Late", v: lateCount },
        { k: "Left Early", v: earlyCount },
        { k: "Holidays", v: holidayCount },
        { k: "Holiday Worked", v: holidayWorkedCount },
        { k: "Missing (hrs)", v: missingHoursTotal },
      ].filter((x) => (typeof x.v === "number" ? x.v > 0 : String(x.v).trim() !== "") || x.k === "Present" || x.k === "Absent");
      const summaryHtml = summaryItems.length
        ? `<div class="box"><div class="title">Summary</div><div class="summary">${summaryItems
            .map((it) => `<div class="kpi"><div class="k">${escapeHtml(it.k)}</div><div class="v">${escapeHtml(String(it.v))}</div></div>`)
            .join("")}</div></div>`
        : ``;

      const logoUrl = new URL("/Gaja_out_black.png", window.location.href).toString();

      const html = `<!doctype html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <base href="${escapeHtml(window.location.origin)}/" />
  <title>${escapeHtml(fileBase)}.pdf</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { margin: 0; font-family: Cairo, Arial, sans-serif; color: #0f172a; }
    .page { --padX: 34px; position: relative; padding: 18px var(--padX) 44px var(--padX); }
    .wrap { display: flex; flex-direction: column; gap: 12px; }
    .topbar { display: grid; grid-template-columns: 1fr 1.4fr auto; align-items: center; column-gap: 14px; }
    .headerTitle { font-weight: 900; font-size: 20px; letter-spacing: 0.2px; }
    .employeeName { font-weight: 800; font-size: 18px; text-align: center; direction: auto; unicode-bidi: plaintext; }
    .logo { height: 42px; max-width: 180px; width: auto; object-fit: contain; object-position: right center; }
    .headerGrid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 14px 18px; align-items: start; margin-top: 12px; }
    .meta { margin-top: 10px; display: grid; gap: 8px; }
    .kv { display: grid; grid-template-columns: 150px 1fr; column-gap: 12px; align-items: baseline; font-size: 12px; line-height: 1.35; }
    .kv .k { font-weight: 800; }
    .kv .k::after { content: ":"; margin-left: 0; margin-right: 10px; }
    .kv .v { font-weight: 500; direction: auto; unicode-bidi: plaintext; }
    .box { border: 0; border-radius: 14px; padding: 14px 16px; background: #ffffff; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.10); }
    .title { font-weight: 800; font-size: 16px; margin-bottom: 6px; }
    .matrix { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .matrix th, .matrix td { border: 1px solid #e2e8f0; padding: 4px 3px; font-size: 9px; text-align: center; }
    .matrix thead th { background: #0ea5e9; color: #fff; border-color: #0284c7; font-weight: 800; }
    .matrix thead th.fri { background: #e2e8f0; color: #475569; border-color: #cbd5e1; }
    .matrix .rowHdr { background: #f1f5f9; text-align: left; font-weight: 800; width: 120px; }
    .matrix td.v { font-weight: 700; }
    .matrix td.fri { background: #f8fafc; color: #94a3b8; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px; }
    .kpi { border: 0; border-radius: 12px; padding: 10px 12px; background: #f8fafc; }
    .kpi .k { font-size: 10px; opacity: 0.8; }
    .kpi .v { font-size: 16px; font-weight: 800; margin-top: 2px; }
    .legend { font-size: 11px; display: flex; gap: 12px; flex-wrap: wrap; }
    .legend span { border: 1px solid #e2e8f0; padding: 4px 8px; border-radius: 999px; background: #fff; }
    .footer { position: absolute; right: var(--padX); bottom: 14px; font-size: 10px; opacity: 0.75; text-align: right; }
    .noPrint { display: none; }
    .wk { font-weight: 700; font-size: 8px; opacity: 0.9; }
  </style>
</head>
  <body>
  <div class="page">
    <div class="wrap">
      <div class="topbar">
        <div class="headerTitle">Timesheet</div>
        <div class="employeeName" style="text-align: center; direction: auto; unicode-bidi: plaintext;">${escapeHtml(label.ar || label.en || String(empId))}</div>
        <img class="logo" src="${escapeHtml(logoUrl)}" alt="GAJA" />
      </div>

      <div class="headerGrid">
        <div class="box">
          <div class="meta">
            <div class="kv"><div class="k">Employee ID</div><div class="v">${empId}</div></div>
            <div class="kv"><div class="k">Month</div><div class="v">${escapeHtml(monthStart.format("MMMM"))} ${exportYear}</div></div>
            <div class="kv"><div class="k">Shift</div><div class="v">${escapeHtml(start12)} — ${escapeHtml(end12)}</div></div>
            ${label.ps ? `<div class="kv"><div class="k">PS</div><div class="v">${escapeHtml(label.ps)}</div></div>` : ``}
          </div>
        </div>
        <div>${summaryHtml}</div>
      </div>

    <div class="box">
      <table class="matrix">
        <thead>
          <tr>
            <th class="rowHdr">Day</th>
            ${dayHeaders
              .map((d, idx) => `<th class="${isFridayCol[idx] ? "fri" : ""}">${escapeHtml(d)}</th>`)
              .join("")}
          </tr>
          <tr>
            <th class="rowHdr"></th>
            ${weekdayLabels
              .map((w, idx) =>
                `<th class="wk ${isFridayCol[idx] ? "fri" : ""}">${escapeHtml(w)}</th>`
              )
              .join("")}
          </tr>
        </thead>
        <tbody>
          ${showCodeRow ? renderRow("Code", dayCodes) : ""}
          ${showInRow ? renderRow("In", dayIn) : ""}
          ${showOutRow ? renderRow("Out", dayOut) : ""}
          ${showMissingRow ? renderRow("Missing (hrs)", dayMissing) : ""}
        </tbody>
      </table>
    </div>

    ${exceptionsHtml}

    <div class="box">
      <div class="legend">
        <span><b>P</b> Present</span>
        <span><b>A</b> Absent</span>
        <span><b>PL</b> Present Late</span>
        <span><b>PH</b> Holiday</span>
        <span><b>PHF</b> Holiday Worked</span>
      </div>
    </div>

      <div class="footer">Generated: ${escapeHtml(dayjs().format("YYYY-MM-DD HH:mm"))}</div>
    </div>
  </div>
  </body>
  </html>`;

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.left = "-10000px";
      iframe.style.top = "0";
      iframe.style.width = "1200px";
      iframe.style.height = "900px";
      iframe.style.border = "0";
      iframe.style.opacity = "0";
      iframe.setAttribute("aria-hidden", "true");
      document.body.appendChild(iframe);

      try {
        iframe.srcdoc = html;

        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(() => {
            reject(new Error("Timed out rendering export document"));
          }, 15000);

          iframe.onload = () => {
            window.clearTimeout(timer);
            resolve();
          };
        });

        const doc = iframe.contentDocument;
        if (!doc || !iframe.contentWindow) throw new Error("Failed to render export document");

        try {
          await (doc as any).fonts?.ready;
        } catch {}

        const target = (doc.querySelector(".page") as HTMLElement) || doc.body;

        try {
          const imgs = Array.from(doc.images || []);
          await Promise.all(
            imgs.map((img: any) =>
              img?.complete
                ? Promise.resolve()
                : new Promise<void>((resolve) => {
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                  })
            )
          );
        } catch {}

        const canvas = await html2canvas(target, {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
          windowWidth: target.scrollWidth,
          windowHeight: target.scrollHeight,
        });

        const { jsPDF } = await getPdfLibraries();
        const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();

        const pxPerPt = canvas.width / pageW;
        const pageHPx = Math.floor(pageH * pxPerPt);

        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        const sliceCtx = sliceCanvas.getContext("2d");
        if (!sliceCtx) throw new Error("Failed to prepare export canvas");

        let y = 0;
        let pageIndex = 0;
        while (y < canvas.height) {
          const sliceH = Math.min(pageHPx, canvas.height - y);
          sliceCanvas.height = sliceH;
          sliceCtx.clearRect(0, 0, sliceCanvas.width, sliceH);
          sliceCtx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

          const imgData = sliceCanvas.toDataURL("image/png");
          const imgW = pageW;
          const imgH = (sliceH / pxPerPt);

          if (pageIndex > 0) pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, 0, imgW, imgH);

          y += sliceH;
          pageIndex++;
        }

        pdf.save(`${fileBase}.pdf`);
      } finally {
        document.body.removeChild(iframe);
      }
    },
    [exportMonth, exportYear, getTimesheetDays, getEmployeeLabelForExport, getPdfLibraries]
  );

  // Quick lookup: employee meta by id (name + fallback times)
  const empById = useMemo(() => {
    const m = new Map<number, EmpOption>();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  const isEmpFingerprintNeeded = useCallback(
    (empId: number, row?: any): boolean => {
      const meta = empById.get(Number(empId));
      const fpRaw =
        extractFingerprintRaw(row) ??
        meta?.FINGERPRINT_NEEDED ??
        (meta as any)?.fingerprint_needed;
      return parseLooseBoolean(fpRaw) === true;
    },
    [empById]
  );

  const isEmpFingerprintNotNeeded = useCallback(
    (empId: number, row?: any): boolean => {
      const meta = empById.get(Number(empId));
      const fpRaw =
        extractFingerprintRaw(row) ??
        meta?.FINGERPRINT_NEEDED ??
        (meta as any)?.fingerprint_needed;
      return parseLooseBoolean(fpRaw) === false;
    },
    [empById]
  );

  function isAbsentDay(day?: TimesheetDay | null): boolean {
    if (!day) return false;
    if (day.isHoliday) return false;
    const code = String(day.code || "").toUpperCase();
    if (code === "A") return true;
    if (day.present) return false;
    if (day.entry || day.exit) return false;
    return !code;
  }

  // place alongside isAbsentDay, e.g. above computeLeaveCount
  function hasPresence(day?: TimesheetDay | null): boolean {
    if (!day) return false;
    return Boolean(day.present) || Boolean(day.entry) || Boolean(day.exit);
  }

  function computeLeaveSummary(
    days: TimesheetDay[] | null
  ): Record<string, number> {
    const summary: Record<string, number> = {};
    if (!days) return summary;
    for (const day of days) {
      const normalized = normalizeLeaveCode(day.code || day.reason || "");
      if (normalized) {
        summary[normalized] = (summary[normalized] || 0) + 1;
      }
    }
    return summary;
  }

  const LEAVE_TYPES = {
    AL: { label: "Annual Leave", color: "#3B82F6" },
    SL: { label: "Sick Leave", color: "#EF4444" },
    EL: { label: "Emergency Leave", color: "#F59E0B" },
    UL: { label: "Unpaid Leave", color: "#6B7280" },
    ML: { label: "Maternity Leave", color: "#EC4899" },
    XL: { label: "Exam Leave", color: "#8B5CF6" },
    B1: { label: "Bereavement 1", color: "#60fe04ff" },
    B2: { label: "Bereavement 2", color: "#9a8c10ff" },
    HL: { label: "Half Day Leave", color: "#14B8A6" },
    BM: { label: "Bereavement", color: "#84a2e4ff" },
  } as const;

  const ATTENDANCE_TYPES = {
    P: { label: "Present", color: "#00bf63" },
    PO: { label: "Present Overtime", color: "#16a34a" },
    PH: { label: "Paid Holiday", color: "#f59e0b" },
    PHF: { label: "Paid Holiday + Food", color: "#22c55e" },
    PT: { label: "Present + Food", color: "#06b6d4" },
    PL: { label: "Present Late", color: "#f97316" },
    PM: { label: "Present Missing", color: "#dc2626" },
    A: { label: "Absent", color: "#ef4444" },
  } as const;

  const leaveColumnOrderRef = useRef(
    Object.keys(LEAVE_TYPES) as (keyof typeof LEAVE_TYPES)[]
  );
  const leaveColumnOrder = leaveColumnOrderRef.current;
  const [visibleLeaveColumns, setVisibleLeaveColumns] = useState<string[]>([]);
  const visibleLeaveSet = useMemo(
    () => new Set<string>(visibleLeaveColumns),
    [visibleLeaveColumns]
  );
  const activeLeaveColumns = useMemo<(keyof typeof LEAVE_TYPES)[]>(
    () =>
      leaveColumnOrder.filter((code) =>
        visibleLeaveSet.has(code)
      ) as (keyof typeof LEAVE_TYPES)[],
    [leaveColumnOrder, visibleLeaveSet]
  );

  const attendanceColumnOrderRef = useRef(
    Object.keys(ATTENDANCE_TYPES) as (keyof typeof ATTENDANCE_TYPES)[]
  );
  const attendanceColumnOrder = attendanceColumnOrderRef.current;
  const [visibleAttendanceColumns, setVisibleAttendanceColumns] = useState<
    string[]
  >(["P"]);
  const visibleAttendanceSet = useMemo(
    () => new Set<string>(visibleAttendanceColumns),
    [visibleAttendanceColumns]
  );
  const activeAttendanceColumns = useMemo<(keyof typeof ATTENDANCE_TYPES)[]>(
    () =>
      attendanceColumnOrder.filter((code) =>
        visibleAttendanceSet.has(code)
      ) as (keyof typeof ATTENDANCE_TYPES)[],
    [attendanceColumnOrder, visibleAttendanceSet]
  );

  function hexToRgb(hex: string): [number, number, number] | null {
    const normalized = hex.replace("#", "");
    const base = normalized.length === 8 ? normalized.slice(0, 6) : normalized;
    if (base.length !== 6) return null;
    const r = parseInt(base.slice(0, 2), 16);
    const g = parseInt(base.slice(2, 4), 16);
    const b = parseInt(base.slice(4, 6), 16);
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return [r, g, b];
  }

  function mixRgb(
    a: [number, number, number],
    b: [number, number, number],
    amount: number
  ): [number, number, number] {
    const amt = Math.max(0, Math.min(1, amount));
    return [
      Math.round(a[0] * (1 - amt) + b[0] * amt),
      Math.round(a[1] * (1 - amt) + b[1] * amt),
      Math.round(a[2] * (1 - amt) + b[2] * amt),
    ];
  }

  function ensureRgb(
    color: string,
    fallback: [number, number, number]
  ): [number, number, number] {
    const rgb = hexToRgb(color);
    return rgb || fallback;
  }

  const ATTENDANCE_BASE_COLORS: Record<string, string> = {
    P: "#10b981",
    PO: "#16a34a",
    PT: "#06b6d4",
    PL: "#f97316",
    PH: "#f59e0b",
    PHF: "#22c55e",
    PM: "#dc2626",
    A: "#ef4444",
  };

  const DEFAULT_DAY_BG = ensureRgb("#ffffff", [255, 255, 255]);
  const HOLIDAY_BG = ensureRgb("#facc15", [250, 204, 21]);
  const FRIDAY_BG = ensureRgb("#065f46", [6, 95, 70]);

  function getLeaveFillColor(
    code: string,
    dark: boolean
  ): [number, number, number] {
    const meta = LEAVE_TYPES[code as keyof typeof LEAVE_TYPES];
    const base = ensureRgb(meta?.color || "#94a3b8", [148, 163, 184]);
    return dark
      ? mixRgb(base, [0, 0, 0], 0.55)
      : mixRgb(base, [255, 255, 255], 0.72);
  }

  function getAttendanceFillColor(
    code: string,
    dark: boolean
  ): [number, number, number] {
    const base = ensureRgb(
      ATTENDANCE_BASE_COLORS[code] || "#9ca3af",
      [156, 163, 175]
    );
    return dark
      ? mixRgb(base, [0, 0, 0], 0.5)
      : mixRgb(base, [255, 255, 255], 0.65);
  }

  function getDayFillColor(options: {
    leaveCode: string;
    centerCode: string;
    isHoliday: boolean;
    isFriday: boolean;
    isHolidayWorked: boolean;
    isAbsent: boolean;
    dark: boolean;
  }): [number, number, number] {
    const {
      leaveCode,
      centerCode,
      isHoliday,
      isFriday,
      isHolidayWorked,
      isAbsent,
      dark,
    } = options;
    if (leaveCode) return getLeaveFillColor(leaveCode, dark);
    if (centerCode && ATTENDANCE_BASE_COLORS[centerCode]) {
      return getAttendanceFillColor(centerCode, dark);
    }
    if (isHoliday) {
      return isHolidayWorked
        ? getAttendanceFillColor("PHF", dark)
        : mixRgb(HOLIDAY_BG, [255, 255, 255], dark ? 0.2 : 0.6);
    }
    if (isFriday) {
      return mixRgb(FRIDAY_BG, [255, 255, 255], dark ? 0.25 : 0.8);
    }
    if (isAbsent) {
      return getAttendanceFillColor("A", dark);
    }
    return mixRgb(DEFAULT_DAY_BG, [0, 0, 0], dark ? 0.6 : 0.02);
  }

  function getLegendItems(dark: boolean) {
    const items: { label: string; color: [number, number, number] }[] = [];
    leaveColumnOrder.forEach((code) => {
      const meta = LEAVE_TYPES[code as keyof typeof LEAVE_TYPES];
      if (!meta) return;
      const color = meta ? ensureRgb(meta.color, [148, 163, 184]) : getLeaveFillColor(code, dark);
      items.push({ label: `${code} — ${meta.label}`, color });
    });
    const attendanceEntries: [string, string][] = [
      ["P", t("hr.timesheets.present") || "Present"],
      ["A", t("hr.timesheets.absent") || "Absent"],
    ];
    attendanceEntries.forEach(([code, label]) => {
      items.push({ label: `${code} — ${label}`, color: getAttendanceFillColor(code, dark) });
    });
    items.push({ label: t("hr.timesheets.legendHoliday") || "Holiday", color: mixRgb(HOLIDAY_BG, [255, 255, 255], dark ? 0.2 : 0.6) });
    items.push({ label: t("hr.timesheets.legendFriday") || "Friday", color: mixRgb(FRIDAY_BG, [255, 255, 255], dark ? 0.25 : 0.8) });
    return items;
  }

  function renderPdfLegendInline(
    doc: any,
    dark: boolean,
    options?: {
      x?: number;
      y?: number;
      columns?: number;
      columnWidth?: number;
      rowHeight?: number;
    }
  ) {
    const items = getLegendItems(dark);
    if (!items.length) return;
    const {
      x = 320,
      y = 44,
      columns = 2,
      columnWidth = 160,
      rowHeight = 12,
    } = options || {};
    const header = t("hr.timesheets.legend") || "Legend";
    doc.setFontSize(11);
    doc.text(header, x, y);
    doc.setFontSize(8);
    doc.setDrawColor(255, 255, 255);

    const totalColumns = Math.max(1, columns);
    const rowsPerColumn = Math.ceil(items.length / totalColumns) || 1;
    const startY = y + 10;

    items.forEach((item, idx) => {
      const columnIndex = Math.floor(idx / rowsPerColumn);
      const rowIndex = idx % rowsPerColumn;
      const itemX = x + columnIndex * columnWidth;
      const itemY = startY + rowIndex * rowHeight;
      const [r, g, b] = item.color;
      doc.setFillColor(r, g, b);
      doc.rect(itemX, itemY - 6.5, 8, 8, "F");
      doc.text(item.label, itemX + 12, itemY);
    });
  }

  const generateSingleEmployeePdf = useCallback(
    async (empId: number) => {
      // Determine which months to load based on export period
      let monthsToLoad: number[] = [];
      let startDate: dayjs.Dayjs;
      let endDate: dayjs.Dayjs;
      
      if (exportPeriod === "month") {
        monthsToLoad = [exportMonth];
        startDate = dayjs(new Date(exportYear, exportMonth - 1, 1));
        endDate = startDate.endOf('month');
      } else if (exportPeriod === "year") {
        monthsToLoad = Array.from({ length: 12 }, (_, i) => i + 1);
        startDate = dayjs(new Date(exportYear, 0, 1));
        endDate = dayjs(new Date(exportYear, 11, 31));
      } else if (exportPeriod === "ytd") {
        const today = dayjs();
        const currentMonth = today.month() + 1;
        monthsToLoad = Array.from({ length: currentMonth }, (_, i) => i + 1);
        startDate = dayjs(new Date(exportYear, 0, 1));
        endDate = today;
      } else if (exportPeriod === "custom" && exportStartDate && exportEndDate) {
        startDate = exportStartDate;
        endDate = exportEndDate;
        // Calculate which months are covered
        const monthsSet = new Set<number>();
        let current = startDate.startOf('month');
        while (current.isSameOrBefore(endDate, 'month')) {
          monthsSet.add(current.month() + 1);
          current = current.add(1, 'month');
        }
        monthsToLoad = Array.from(monthsSet);
      } else {
        monthsToLoad = [exportMonth];
        startDate = dayjs(new Date(exportYear, exportMonth - 1, 1));
        endDate = startDate.endOf('month');
      }
      
      const monthlyData: { month: number; days: TimesheetDay[] }[] = [];
      for (const mm of monthsToLoad) {
        const d = await getTimesheetDays(empId, exportYear, mm);
        if (d && d.length) monthlyData.push({ month: mm, days: d });
      }
      // Flatten and filter days based on date range
      const allDays = monthlyData.flatMap(m => m.days);
      const days = allDays.filter(day => {
        const monthData = monthlyData.find(m => m.days.includes(day));
        if (!monthData) return false;
        const dayDate = dayjs(new Date(exportYear, monthData.month - 1, day.day));
        return !dayDate.isBefore(startDate, 'day') && !dayDate.isAfter(endDate, 'day');
      });
      
      if (!days || days.length === 0) throw new Error("No timesheet data available for the selected period.");
      const { jsPDF, autoTable } = await getPdfLibraries();
      
      const periodStart = startDate.format('YYYY-MM-DD');
      const periodEnd = endDate.format('YYYY-MM-DD');
      const mm = String(startDate.month() + 1).padStart(2, "0");

      const employeeMeta =
        selectedExportEmployee ||
        employees.find((emp) => emp.id === empId) ||
        null;
      const employeeLabel = employeeMeta?.name?.trim() || String(empId);

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });
      const logo = await getLogoBase64();
      const pageWidth = doc.internal.pageSize.getWidth();
      const logoSize = 56;
      const margin = 30;
      if (logo)
        doc.addImage(
          logo,
          "PNG",
          pageWidth - logoSize - margin,
          30,
          logoSize,
          logoSize
        );
      doc.setFontSize(18);
      doc.text(`Timesheet — ${employeeLabel}`, 110, 48);
      doc.setFontSize(10);
      doc.text(`Employee ID: ${empId}`, 110, 64);
      doc.text(`Period: ${periodStart} → ${periodEnd}`, 110, 78);
      doc.text(`Generated: ${dayjs().format("YYYY-MM-DD HH:mm")}`, 110, 92);

      // Show assigned schedule (from T_START/T_END seeded into empSchedule)
      try {
        const schedHdr = empSchedule.get(empId);
        if (schedHdr?.start && schedHdr?.end) {
          const s12 = to12h(schedHdr.start);
          const e12 = to12h(schedHdr.end);
          doc.text(`Assigned: ${s12} — ${e12}`, 110, 106);
        }
      } catch {}

      renderPdfLegendInline(doc, isDark, { x: 320, y: 44 });

      // Metrics for month and year
      const sched = empSchedule.get(empId) || null;
      const lateness = (daysList: TimesheetDay[]) => {
        let lateCount = 0;
        let lateMinTotal = 0;
        const lateRows: { date: string; entry?: string | null; minutes: number }[] = [];
        daysList.forEach((d) => {
          if (!sched?.start) return;
          const entryRaw = d.entry ? String(d.entry) : "";
          const m = entryRaw.match(/\d{2}:\d{2}/);
          const entry = m ? m[0] : "";
          if (!entry) return;
          try {
            const dayNum = Number(d.day ?? 1);
            const dateStr = `${exportYear}-${String(exportMonth).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`;
            const start = dayjs(`${dateStr}T${sched.start}:00`);
            const ent = dayjs(`${dateStr}T${entry}:00`);
            const diff = ent.diff(start, "minute");
            if (diff > 0) {
              lateCount += 1;
              lateMinTotal += diff;
              lateRows.push({ date: dateStr, entry, minutes: diff });
            }
          } catch {}
        });
        return { lateCount, lateMinTotal, lateRows };
      };
      const missing = (daysList: TimesheetDay[]) => {
        const today = dayjs();
        const pastDays = daysList.filter((d) => {
          const dayNum = (d as any).day ?? null;
          if (!dayNum) return false;
          const dateStr = `${exportYear}-${String(exportMonth).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`;
          const dt = dayjs(dateStr);
          return dt.isBefore(today, "day");
        });
        const totalMissing = pastDays.reduce((acc, d) => {
          const val = normalizeDelta(d.deltaMin);
          if (!val || val >= 0) return acc;
          return acc + val;
        }, 0);
        return { missingMin: Math.abs(totalMissing) };
      };

      const today = dayjs();
      const pastDays = days.filter((d) => {
        const dayNum = (d as any).day ?? null;
        if (!dayNum) return false;
        const dateStr = `${exportYear}-${String(exportMonth).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`;
        const dt = dayjs(dateStr);
        return dt.isBefore(today, "day");
      });

      const totalWorkMin = pastDays.reduce((sum, d) => sum + (d.workMin ?? 0), 0);
      const totalHours = Number.isFinite(totalWorkMin) ? (totalWorkMin / 60).toFixed(2) : "0.00";
      const { lateCount, lateMinTotal, lateRows } = lateness(pastDays);
      const { missingMin } = missing(pastDays);
      const deltaTotalMin = pastDays.reduce((acc, d) => {
        const val = normalizeDelta(d.deltaMin);
        if (!val) return acc;
        return acc + val;
      }, 0);
      const deltaLabel = roundedHoursWithSign(deltaTotalMin);
      const daysWorked = pastDays.filter((d) => hasPresence(d)).length;
      const absentDays = pastDays.filter((d) => isAbsentDay(d)).length;
      const leaveSummary = computeLeaveSummary(pastDays);
      
      // Convert minutes to hours for display
      const lateHours = (lateMinTotal / 60).toFixed(2);
      const missingHours = (missingMin / 60).toFixed(2);
      
      const summaryHeaders = ["±h", "Absent", "Late (cnt)", "Late (hrs)", "Missing (hrs)", ...leaveColumnOrder];
      const summaryRow = [deltaLabel, String(absentDays), String(lateCount), lateHours, missingHours, ...leaveColumnOrder.map((code) => String(leaveSummary[code] ?? 0))];
      doc.text(`Total Hours Worked: ${totalHours}`, 110, 120);

      autoTable(doc, {
        startY: 126,
        head: [
          [
            "Day",
            "Code",
            "Reason",
            "Entry",
            "Exit",
            "Δ",
            "Present",
            "Holiday",
            "Comment",
          ],
        ],
        body: mapDaysToRows(days),
        styles: { fontSize: 9, cellPadding: 6, overflow: "linebreak" },
        headStyles: {
          fillColor: [10, 132, 255],
          textColor: 255,
          fontSize: 10,
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 55 },
          2: { cellWidth: 95 },
          3: { cellWidth: 55 },
          4: { cellWidth: 55 },
          5: { cellWidth: 45 },
        },
        margin: { left: 30, right: 30 },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable?.finalY
          ? (doc as any).lastAutoTable.finalY + 18
          : 150,
        head: [summaryHeaders],
        body: [summaryRow],
        styles: { fontSize: 9, cellPadding: 6, overflow: "linebreak" },
        headStyles: {
          fillColor: [10, 132, 255],
          textColor: 255,
          fontSize: 9,
          fontStyle: "bold",
        },
        margin: { left: 30, right: 30 },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 48 },
          2: { cellWidth: 48 },
        },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index >= 3) {
            const code = leaveColumnOrder[data.column.index - 3];
            if (!code) return;
            const fillColor = getLeaveFillColor(code, isDark);
            const brightness =
              0.299 * fillColor[0] +
              0.587 * fillColor[1] +
              0.114 * fillColor[2];
            const cellStyles = data.cell.styles as any;
            cellStyles.fillColor = fillColor;
            cellStyles.textColor =
              brightness < 140 ? [255, 255, 255] : [33, 33, 33];
            cellStyles.halign = "center";
          }
        },
      });

      const slug = employeeLabel
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      doc.save(`timesheet_${slug || empId}_${exportYear}_${mm}.pdf`);
    },
    [exportPeriod, exportMonth, exportYear, exportStartDate, exportEndDate, selectedExportEmployee, employees, getLogoBase64, renderPdfLegendInline, isDark, leaveColumnOrder, mapDaysToRows, getTimesheetDays, getLeaveFillColor]
  );


  const generateAllEmployeesPdf = useCallback(
    async (employeeRows: RangePunchesEmployee[]) => {
      const { jsPDF, autoTable } = await getPdfLibraries();
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });
      const mm = String(exportMonth).padStart(2, "0");
      const periodStart = `${exportYear}-${mm}-01`;
      const periodEnd = `${exportYear}-${mm}-${String(new Date(exportYear, exportMonth, 0).getDate()).padStart(2, "0")}`;
      const daysInMonth = new Date(exportYear, exportMonth, 0).getDate();
      const dayNumbers = Array.from(
        { length: daysInMonth },
        (_, idx) => idx + 1
      );
      const dayHeaders = dayNumbers.map((d) => String(d).padStart(2, "0"));

      const logo = await getLogoBase64();
      const pageWidth = doc.internal.pageSize.getWidth();
      const logoSize = 56;
      const margin = 30;
      if (logo)
        doc.addImage(
          logo,
          "PNG",
          pageWidth - logoSize - margin,
          30,
          logoSize,
          logoSize
        );
      doc.setFontSize(18);
      doc.text(`Timesheets — All Employees`, 50, 48);
      doc.setFontSize(10);
      doc.text(`Period: ${periodStart} → ${periodEnd}`, 50, 64);
      doc.text(`Generated: ${dayjs().format("YYYY-MM-DD HH:mm")}`, 50, 78);
      doc.text(`Employees: ${employeeRows.length}`, 50, 92);

      renderPdfLegendInline(doc, isDark, {
        x: 300,
        y: 44,
        columns: 2,
        columnWidth: 150,
      });

      const body: any[][] = [];
      const sortedRows = [...employeeRows].sort((a, b) => {
        const nameA = (a.name || "").toLowerCase();
        const nameB = (b.name || "").toLowerCase();
        return nameA.localeCompare(nameB);
      });

      for (const row of sortedRows) {
        const days = await getTimesheetDays(row.id_emp, exportYear, exportMonth);
        if (!days || days.length === 0) continue;
        const dayMap = new Map<number, TimesheetDay>();
        days.forEach((d) => {
          const dayNum = Number(d.day ?? 0);
          if (dayNum > 0) dayMap.set(dayNum, d);
        });

        const totalWorkMin = days.reduce((sum, d) => sum + (d.workMin ?? 0), 0);
        const totalHours = Number.isFinite(totalWorkMin)
          ? (totalWorkMin / 60).toFixed(2)
          : "0.00";
        const deltaTotalMin = days.reduce(
          (sum, d) => sum + (d.deltaMin ?? 0),
          0
        );
        const deltaLabel = roundedHoursWithSign(deltaTotalMin);
        const daysWorked = days.filter((d) => hasPresence(d)).length;
        const leaveSummary = computeLeaveSummary(days);
        const displayName = row.name?.trim() || String(row.id_emp);
        const psLabel = row.ps != null ? `PS: ${row.ps}` : "";
        const absentCount = days.filter((d) => isAbsentDay(d)).length;
        const metaLinesParts: string[] = [displayName, `ID: ${row.id_emp}`];
        if (row.ps != null) metaLinesParts.push(`PS: ${row.ps}`);
        metaLinesParts.push(`Total: ${totalHours}h`);
        metaLinesParts.push(`Worked: ${daysWorked}`);
        metaLinesParts.push(`Absent: ${absentCount}`);
        const metaLines = metaLinesParts.join("\n");

        const rowCells: any[] = [
          {
            content: metaLines,
            styles: {
              fontStyle: "bold",
              valign: "middle",
            },
          },
        ];

        dayNumbers.forEach((dayNum) => {
          const d = dayMap.get(dayNum) || null;
          const ymd = `${exportYear}-${mm}-${String(dayNum).padStart(2, "0")}`;
          const isHoliday = Boolean(d?.isHoliday) || holidaysSet.has(ymd);
          const isFriday = dayjs(ymd).day() === 5;
          const finalLeave = finalLeaveCodeForDay(
            row.id_emp,
            ymd,
            d || undefined
          );
          const leaveCode = finalLeave;
          const rawCode = String(d?.code || "").toUpperCase();
          const absent = isAbsentDay(d || undefined);
          let centerCode = "";
          if (["P", "A", "PT", "PL", "PH", "PHF"].includes(rawCode)) {
            centerCode = isHoliday && rawCode === "A" ? "" : rawCode;
          } else if (!leaveCode && hasPresence(d)) {
            centerCode = isHoliday ? "PHF" : "P";
          }
          if (absent && !leaveCode && !isHoliday) {
            centerCode = "A";
          }
          if (isHoliday && !centerCode && hasPresence(d)) {
            centerCode = "PHF";
          }
          const isHolidayWorked = isHoliday && hasPresence(d);
          const fillColor = getDayFillColor({
            leaveCode,
            centerCode,
            isHoliday,
            isFriday,
            isHolidayWorked,
            isAbsent: absent,
            dark: isDark,
          });
          const brightness =
            0.299 * fillColor[0] + 0.587 * fillColor[1] + 0.114 * fillColor[2];
          const textColor = brightness < 140 ? [255, 255, 255] : [28, 28, 28];
          const entry = formatEntryExit(d?.entry);
          const exit = formatEntryExit(d?.exit);
          const parts: string[] = [];
          if (leaveCode) parts.push(leaveCode);
          else if (centerCode) parts.push(centerCode);
          if (entry || exit) parts.push(`${entry || "--"} → ${exit || "--"}`);
          if (d?.deltaMin != null && d.deltaMin !== 0)
            parts.push(roundedHoursWithSign(d.deltaMin));
          if (d?.comment) {
            const trimmed = String(d.comment);
            parts.push(
              trimmed.length > 28 ? `${trimmed.slice(0, 28)}…` : trimmed
            );
          }
          rowCells.push({
            content: parts.join("\n"),
            styles: {
              fillColor,
              textColor,
              valign: "middle",
              minCellHeight: 30,
              lineWidth: 0.2,
            },
          });
        });

        rowCells.push({
          content: deltaLabel,
          styles: { halign: "center", fontStyle: "bold" },
        });

        rowCells.push({
          content: String(daysWorked),
          styles: { halign: "center", fontStyle: "bold" },
        });

        rowCells.push({
          content: String(absentCount),
          styles: { halign: "center", fontStyle: "bold" },
        });

        leaveColumnOrder.forEach((code) => {
          const value = leaveSummary[code] ?? 0;
          const fillColor = getLeaveFillColor(code, isDark);
          const brightness =
            0.299 * fillColor[0] + 0.587 * fillColor[1] + 0.114 * fillColor[2];
          const textColor = brightness < 140 ? [255, 255, 255] : [33, 33, 33];
          rowCells.push({
            content: value ? String(value) : "0",
            styles: {
              fillColor,
              textColor,
              halign: "center",
              fontStyle: value ? "bold" : "normal",
            },
          });
        });

        body.push(rowCells);
      }

      if (!body.length) {
        throw new Error("No timesheet data found for the selected employees.");
      }

      const columnStyles: Record<number, any> = {
        0: { cellWidth: 135, fontStyle: "bold" },
      };
      columnStyles[dayHeaders.length + 1] = { cellWidth: 48 };
      columnStyles[dayHeaders.length + 2] = { cellWidth: 48 };
      columnStyles[dayHeaders.length + 3] = { cellWidth: 48 };
      leaveColumnOrder.forEach((_, idx) => {
        columnStyles[dayHeaders.length + 4 + idx] = { cellWidth: 48 };
      });

      autoTable(doc, {
        startY: 120,
        head: [
          [
            "Employee",
            ...dayHeaders,
            "±h",
            "Days Worked",
            "Absent",
            ...leaveColumnOrder,
          ],
        ],
        body,
        styles: {
          fontSize: 6.1,
          cellPadding: 2,
          overflow: "linebreak",
          valign: "middle",
        },
        headStyles: {
          fillColor: [10, 132, 255],
          textColor: 255,
          fontSize: 7,
          fontStyle: "bold",
        },
        columnStyles,
        margin: { left: 30, right: 30 },
        tableWidth: "auto",
        didParseCell(data: {
          section: string;
          column: { index: number };
          cell: { raw: any; styles: { fontStyle: string } };
        }) {
          if (
            data.section === "body" &&
            data.column.index > 0 &&
            data.cell.raw
          ) {
            (data.cell.styles as any).fontStyle = "bold";
          }
          const leaveStartIndex = 1 + dayHeaders.length + 3;
          if (data.section === "body" && data.column.index >= leaveStartIndex) {
            const leaveIndex = data.column.index - leaveStartIndex;
            const code = leaveColumnOrder[leaveIndex];
            const fillColor = getLeaveFillColor(code, isDark);
            const brightness =
              0.299 * fillColor[0] +
              0.587 * fillColor[1] +
              0.114 * fillColor[2];
            const cellStyles = data.cell.styles as any;
            cellStyles.fillColor = fillColor;
            cellStyles.textColor =
              brightness < 140 ? [255, 255, 255] : [33, 33, 33];
            cellStyles.halign = "center";
          }
        },
      });

      doc.save(`timesheets_all_${exportYear}_${mm}.pdf`);
    },
    [exportMonth, exportYear, getTimesheetDays, getLogoBase64]
  );

  const handleExportModeChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value as "single" | "all";
    setExportMode(value);
    if (value === "single") {
      const fallbackId =
        exportEmployeeId ??
        employeeId ??
        (employees.length ? employees[0].id : null);
      setExportEmployeeId(fallbackId);
    } else {
      setExportEmployeeId(null);
    }
  };

  const handleExportEmployeeChange = (event: SelectChangeEvent) => {
    const val = event.target.value;
    setExportEmployeeId(val ? Number(val) : null);
  };

  const handleExportMonthChange = (event: SelectChangeEvent) => {
    setExportMonth(Number(event.target.value));
  };

  const handleExportYearChange = (event: SelectChangeEvent) => {
    setExportYear(Number(event.target.value));
  };

  async function handleExportSubmit() {
    if (!exportYear || !exportMonth) {
      showToast("Select a year and month to export", "warning");
      return;
    }
    if (
      exportMode === "single" &&
      (!exportEmployeeId || exportEmployeeId <= 0)
    ) {
      showToast("Select an employee to export", "warning");
      return;
    }
    if (exportMode === "all" && (!rangeResults || rangeResults.length === 0)) {
      showToast("Load the All Timesheets data before exporting", "warning");
      return;
    }

    try {
      setExportLoading(true);
      if (exportMode === "single" && exportEmployeeId) {
        if (exportPeriod === "month") {
          await generateSingleEmployeeCorporatePrint(exportEmployeeId);
        } else {
          await generateSingleEmployeePdf(exportEmployeeId);
        }
      } else if (exportMode === "all" && rangeResults) {
        await generateAllEmployeesPdf(rangeResults);
      }

      showToast("Timesheet PDF download started", "success");
      closeExportDialog();
    } catch (err) {
      console.error("generateTimesheetPdf failed", err);
      showToast(
        err instanceof Error ? err.message : "Failed to export timesheet PDF",
        "error"
      );
    } finally {
      setExportLoading(false);
    }
  }

  const [monthGrid, setMonthGrid] = useState<TimesheetDay[] | null>(null);
  const [employeeVacations, setEmployeeVacations] = useState<VacationRecord[]>(
    []
  );

  function to12h(hhmm?: string | null) {
    if (!hhmm) return "—";
    const m = String(hhmm).match(/(\d{2}):(\d{2})/);
    if (!m) return "—";
    let h = parseInt(m[1], 10);
    const min = m[2];
    const ampm = h >= 12 ? "PM" : "AM";
    h = ((h + 11) % 12) + 1; // 0→12, 13→1
    return `${h}:${min} ${ampm}`;
  }

  // Very simple, URL-safe obfuscation for the route token
  function encodeEmployeeToken(id: number) {
    const raw = `emp:${id}:gaja`; // add/change pepper if you like
    const base64 = btoa(unescape(encodeURIComponent(raw)));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  const daysInMonth = useMemo(
    () => new Date(year, month, 0).getDate(),
    [year, month]
  );
  const [monthPreviewMap, setMonthPreviewMap] = useState<
    Map<string, { j: string; R: string; E: string | null; S: string | null }>
  >(new Map());

  const [psList, setPsList] = useState<PsItem[]>([]);
  const [ps, setPs] = useState<number | "">("");

  const [psPoints, setPsPoints] = useState<PsPoint[]>([]);
  const [psPointName, setPsPointName] = useState<string>("");

  const [rangeFrom, setRangeFrom] = useState<Dayjs | null>(
    dayjs(new Date(currentYear, new Date().getMonth(), 1))
  );
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const shiftRangeMonth = useCallback((deltaMonths: number) => {
    setRangeFrom((prev) => {
      const base = prev ?? dayjs().startOf("month");
      return base.add(deltaMonths, "month").startOf("month");
    });
  }, []);

  // Declare the shape once (adjust if your backend differs)
  type PsPoint = {
    Id_point: number;
    name_point: string;
    code_point?: string | null;
  };

  const [psOptions, setPsOptions] = useState<PsPoint[]>([]);
  const [psFilter, setPsFilter] = useState<string | ''>('');

  useEffect(() => {
    listPsPoints()
      .then((rows: PsPoint[]) => setPsOptions(rows ?? []))
      .catch((err) => console.error("Failed to load PS points", err));
  }, []);

  const [rangeResults, setRangeResults] = useState<
    RangePunchesEmployee[] | null
  >(null);
  const [empFilter, setEmpFilter] = useState<string>("");
  const [onlyAbsent, setOnlyAbsent] = useState<boolean>(false);
  const [holidaysSet, setHolidaysSet] = useState<Set<string>>(new Set());
  const [onlyOnLeave, setOnlyOnLeave] = useState<boolean>(false);
  const [onlyHolidayWorked, setOnlyHolidayWorked] = useState<boolean>(false);
  const [tsByEmp, setTsByEmp] = useState<
    Map<number, Map<string, TimesheetDay>>
  >(new Map());
  const [vacationsByEmp, setVacationsByEmp] = useState<
    Map<number, VacationRecord[]>
  >(new Map());
  const [leavesByEmp, setLeavesByEmp] = useState<
    Map<number, Map<string, string>>
  >(new Map());
  const [leaveCodeByIntCan, setLeaveCodeByIntCan] = useState<
    Map<number, string>
  >(new Map());

  // Cache for inferred first active day (per employee, current month)
  const firstActiveCacheRef = useRef<Map<number, string>>(new Map());

  const [empSchedule, setEmpSchedule] = useState<Map<number, EmpScheduleInfo>>(
    new Map()
  );

  const resolveScheduleFor = useCallback(
    (empId: number, row?: RangePunchesEmployee | null) => {
      const pickTime = (val: any): string | null => {
        if (!val) return null;
        const s = String(val).match(/(\d{1,2}):(\d{2})/);
        if (!s) return null;
        const hh = s[1].padStart(2, "0");
        const mm = s[2];
        return `${hh}:${mm}`;
      };

      const sched = empSchedule.get(empId);
      const rowObj = row as any;
      const start =
        sched?.start ?? pickTime(rowObj?.T_START) ?? pickTime(rowObj?.t_start) ?? null;
      const end =
        sched?.end ?? pickTime(rowObj?.T_END) ?? pickTime(rowObj?.t_end) ?? null;

      return { start, end };
    },
    [empSchedule]
  );

  const [detailOpen, setDetailOpen] = useState(false);

  const [detailData, setDetailData] = useState<{
    id_emp: number;
    name: string;
    date: string;
    j: string;
    R: string;
    E: string | null;
    S: string | null;
    psName?: string;
    expectedMin?: number | null;
    workedMin?: number | null;
    deltaMin?: number | null;
  } | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editDay, setEditDay] = useState<number | null>(null);
  const [editJ, setEditJ] = useState<string>("");
  const [editR, setEditR] = useState<string>("");
  const [editComment, setEditComment] = useState<string>("");
  const [editE, setEditE] = useState<string>("");
  const [editS, setEditS] = useState<string>("");
  const [detailExistingComment, setDetailExistingComment] =
    useState<string>("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Employee schedule settings dialog
  const [schedDialogOpen, setSchedDialogOpen] = useState<boolean>(false);
  const [schedDialogEmpId, setSchedDialogEmpId] = useState<number | null>(null);
  const [schedDialogEmpName, setSchedDialogEmpName] = useState<string>("");
  const [schedDialogStart, setSchedDialogStart] = useState<string>("");
  const [schedDialogEnd, setSchedDialogEnd] = useState<string>("");
  const navigate = useNavigate();

  // Leave Ledger dialog state
  const [leaveLedgerDialogOpen, setLeaveLedgerDialogOpen] = useState(false);
  const [leaveLedgerMode, setLeaveLedgerMode] = useState<"single" | "all">(
    "single"
  );
  const [leaveLedgerEmployeeId, setLeaveLedgerEmployeeId] = useState<
    number | null
  >(null);
  const [leaveLedgerYear, setLeaveLedgerYear] = useState<number>(currentYear);
  const [leaveLedgerMonth, setLeaveLedgerMonth] = useState<number>(
    new Date().getMonth() + 1
  );
  const [leaveLedgerPeriod, setLeaveLedgerPeriod] = useState<"month" | "ytd">(
    "month"
  );
  const [leaveLedgerLoading, setLeaveLedgerLoading] = useState(false);

  const DARK_YELLOW = "#8B6F00";

  // Fallback: if listEmployees() didn't include CONTRACT_START for some employees,
  // fetch per-employee detail and merge CONTRACT_START into empStartDateMap.
  useEffect(() => {
    (async () => {
      try {
        if (!employees.length) return;
        const next = new Map(empStartDateMap);
        const missing: number[] = [];
        for (const e of employees) {
          if (!next.has(e.id)) missing.push(e.id);
        }
        if (!missing.length) return;
        for (const id of missing) {
          try {
            const emp = await getEmployeeById(id);
            const startRaw =
              (emp as any)?.CONTRACT_START ||
              (emp as any)?.contract_start ||
              (emp as any)?.contractStart ||
              (emp as any)?.START_DATE ||
              (emp as any)?.startDate ||
              (emp as any)?.DATE_START ||
              (emp as any)?.date_start ||
              (emp as any)?.JOIN_DATE ||
              (emp as any)?.join_date ||
              (emp as any)?.JOINING_DATE ||
              (emp as any)?.joining_date ||
              (emp as any)?.DOJ ||
              (emp as any)?.EMPLOYMENT_START ||
              (emp as any)?.employmentStart ||
              null;
            const parsed = parseStartDateLocal(startRaw);
            if (parsed) next.set(id, parsed.format("YYYY-MM-DD"));
          } catch {}
        }
        if (next.size !== empStartDateMap.size) setEmpStartDateMap(next);
      } catch {}
    })();
  }, [employees]);

  // Load employees with PS filter
useEffect(() => {
  (async () => {
    try {
      setEmpLoading(true);
      const list = await listEmployees();
      
      // DEBUG: Log first employee to see actual data structure
      if (list.length > 0) {
        console.log('[DEBUG] First employee full data:', list[0]);
        try {
          const fpKeys = Object.keys(list[0] as any).filter((k) => {
            const lk = k.toLowerCase();
            return lk.includes('finger') || lk === 'fp' || lk.includes('biometric');
          });
          console.log('[DEBUG] Fingerprint-like keys:', fpKeys);
          const fpRaw = extractFingerprintRaw(list[0]);
          console.log('[DEBUG] Fingerprint raw + parsed:', { raw: fpRaw, parsed: parseLooseBoolean(fpRaw) });
        } catch {}
        console.log('[DEBUG] CONTRACT_START variants:', {
          CONTRACT_START: (list[0] as any).CONTRACT_START,
          contract_start: (list[0] as any).contract_start,
          contractStart: (list[0] as any).contractStart,
          START_DATE: (list[0] as any).START_DATE,
          startDate: (list[0] as any).startDate,
        });
        console.log('[DEBUG] T_START/T_END variants:', {
          T_START: (list[0] as any).T_START,
          t_start: (list[0] as any).t_start,
          T_END: (list[0] as any).T_END,
          t_end: (list[0] as any).t_end,
        });
      }

      try {
        let fpTrue = 0;
        let fpFalse = 0;
        let fpUnknown = 0;
        for (const e of list as any[]) {
          const p = parseLooseBoolean(extractFingerprintRaw(e));
          if (p === true) fpTrue++;
          else if (p === false) fpFalse++;
          else fpUnknown++;
        }
        console.log('[DEBUG] listEmployees fingerprint distribution:', { fpTrue, fpFalse, fpUnknown, total: list.length });
      } catch {}

      const filtered = list.filter((r: Employee) => {
        if (!empFilter) return true;
        const f = empFilter.toLowerCase();
        return (
          (r.NAME || "").toLowerCase().includes(f) || String(r.ID_EMP).includes(f)
        );
      });

      let filtered2 = filtered;

      const options: EmpOption[] = list.map((r: any) => {
        // Extract HH:mm from T_START/T_END if present
        const extractTime = (val: any): string => {
          if (!val) return "";
          const s = String(val);
          const m = s.match(/(\d{2}):(\d{2})/);
          return m ? `${m[1]}:${m[2]}` : "";
        };
        const tStart = extractTime((r as any).T_START || (r as any).t_start);
        const tEnd = extractTime((r as any).T_END || (r as any).t_end);
        const FINGERPRINT_NEEDED = extractFingerprintRaw(r);
        const stateRaw = extractStateRaw(r);
        const nameAr = extractArabicNameRaw(r);
        const nameEnRaw = r.NAME || r.name || String(r.ID_EMP);
        const nameEn = normalizePossiblyMojibakeUtf8(nameEnRaw);
        let nameArClean = nameAr ? normalizePossiblyMojibakeUtf8(nameAr) : null;
        // Some backends store Arabic in NAME (not NAME_AR). If NAME contains Arabic, treat it as Arabic display name.
        if (!nameArClean && /[\u0600-\u06FF]/.test(nameEn)) {
          nameArClean = nameEn;
        }
        return {
          id: Number(r.ID_EMP),
          name: nameEn || String(r.ID_EMP),
          nameAr: nameArClean || undefined,
          ps: (r.PS || r.ps || r.PS_POINT || r.psPoint || "").toString(),
          tStart,
          tEnd,
          FINGERPRINT_NEEDED: FINGERPRINT_NEEDED === undefined ? null : (FINGERPRINT_NEEDED as any),
          state: stateRaw === undefined ? null : (stateRaw as any),
          STATE: r.STATE === undefined ? null : (r.STATE as any),
        } as EmpOption;
      });
      setEmployees(options);

      // Build start-date map for pre-employment detection
      try {
        const map = new Map<number, string>();
        for (const e of list as any[]) {
          const id = Number((e as any).ID_EMP);
          if (!Number.isFinite(id)) continue;
          const startRaw =
            (e as any).CONTRACT_START ||
            (e as any).contract_start ||
            (e as any).contractStart ||
            (e as any).START_DATE ||
            (e as any).startDate ||
            (e as any).DATE_START ||
            (e as any).date_start ||
            (e as any).JOIN_DATE ||
            (e as any).join_date ||
            (e as any).JOINING_DATE ||
            (e as any).joining_date ||
            (e as any).DOJ ||
            (e as any).EMPLOYMENT_START ||
            (e as any).employmentStart ||
            null;
          const parsed = parseStartDateLocal(startRaw);
          console.log(`[empStartDateMap] Employee ${id}: raw=${startRaw}, parsed=${parsed?.format("YYYY-MM-DD") || "null"}`);
          if (parsed) map.set(id, parsed.format("YYYY-MM-DD"));
        }
        console.log(`[empStartDateMap] Final map size: ${map.size}`, Array.from(map.entries()).slice(0, 5));
        setEmpStartDateMap(map);
      } catch {}
      if (!employeeId && options.length) {
        setEmployeeId(options[0].id);
        setEmployeeName(options[0].name);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load employees");
    } finally {
      setEmpLoading(false);
    }
  })();
  // depend on psFilter because we re-filter by PS
}, [employeeId, psFilter, empFilter]);

  // Load employee schedules from backend (T_START, T_END, TITLE)
  useEffect(() => {
    (async () => {
      try {
        console.log("[empSchedule] Loading employee schedules from backend...");
        const list: any[] = await listEmployees();
        const seeds: Array<[number, EmpScheduleInfo]> = [];

        for (const e of list) {
          const id = Number((e as any).ID_EMP);
          if (!Number.isFinite(id)) continue;

          // Get T_START and T_END from employee record (try both cases)
          const tStart = (e as any).T_START || (e as any).t_start || "";
          const tEnd = (e as any).T_END || (e as any).t_end || "";
          const title = (e as any).TITLE || (e as any).title || null;

          // Extract HH:mm from various formats (handles HH:mm:ss, ISO timestamps, etc.)
          const extractTime = (val: any): string => {
            if (!val) return "";
            const str = String(val);
            // Try to extract HH:mm from various formats
            const match = str.match(/(\d{2}):(\d{2})/);
            return match ? `${match[1]}:${match[2]}` : "";
          };

          const start = extractTime(tStart);
          const end = extractTime(tEnd);

          if (start && end) {
            const entry: EmpScheduleInfo = { start, end };
            if (title && String(title).trim()) {
              entry.title = String(title).trim();
            }
            seeds.push([id, entry]);
            console.log(`[empSchedule] Employee ${id}: ${start}-${end}${title ? ` (${title})` : ""}`);
          } else if (start || end) {
            console.warn(`[empSchedule] Employee ${id}: incomplete schedule - start=${start}, end=${end}`);
          }
        }

        console.log(`[empSchedule] Loaded ${seeds.length} employee schedules`);

        if (seeds.length) {
          setEmpSchedule((prev) => {
            const next = new Map(prev);
            for (const [id, val] of seeds) {
              next.set(id, val); // Always update to ensure latest data
            }
            console.log(`[empSchedule] Schedule map now has ${next.size} entries`);
            return next;
          });
        }
      } catch (err) {
        console.error("[empSchedule] Failed to load schedules from backend:", err);
      }
    })();
  }, []);

  // Save schedule to localStorage whenever it changes
  useEffect(() => {
    try {
      const arr = Array.from(empSchedule.entries());
      if (arr.length > 0) {
        localStorage.setItem("empSchedule", JSON.stringify(arr));
        console.log(
          "[empSchedule] Saved to localStorage:",
          arr.length,
          "employees"
        );
      }
    } catch (err) {
      console.error("[empSchedule] Failed to save to localStorage:", err);
    }
  }, [empSchedule]);

  const APPLE = {
    cardBg: isDark ? "rgba(255, 255, 255, 0)" : "rgba(255, 255, 255, 0.65)",
    border: "rgba(60,60,67,0.16)",
    shadow: "0 1px 2px rgba(0,0,0,0.05)",
    todayRing: "#007AFF",
    presentBg: "rgba(80, 182, 74, 0.81)",
    absentBg: "rgb(236, 132, 132)",
    futureBg: isDark ? "rgba(148, 148, 148, 0.5)" : "#F2F3F7",
    holidayBg: isDark ? "#b7a27d" : "#b7a27d",
    textMuted: isDark ? "rgba(255, 255, 255, 0.82)" : "rgba(0, 0, 0, 0.65)",
    datePillBg: isDark ? "rgba(38, 32, 32, 0.95)" : "rgba(98, 98, 98, 0.95)",
    lateES: "rgb(189, 183, 171)",
    cellBg: isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
    fridayBg: isDark ? "rgba(255,255,255,0.04)" : "#F2F3F7",
    fridayHeaderBg: "#064e3b",
    fridayHeaderText: "#f0fdf4",
    fridayColumnBg: isDark ? "rgba(8, 51, 39, 0.65)" : "#5eead4",
  };

  useEffect(() => {
    (async () => {
      try {
        const types: any[] = await getLeaveTypes();
        const m = new Map<number, string>();
        types?.forEach((t: any) => {
          const k = Number(t?.int_can ?? t?.INT_CAN);
          const code = String(
            t.type || (t as any).leaveType || (t as any).name || ""
          ).toUpperCase();
          if (Number.isFinite(k) && code) m.set(k, code);
        });
        setLeaveCodeByIntCan(m);
      } catch (err) {
        console.error("Failed to fetch leave types:", err);
      }
    })();
  }, []);

  // Load leave types mapping
  useEffect(() => {
    (async () => {
      try {
        console.log(
          "[useEffect] Triggered with rangeResults:",
          rangeResults?.length,
          "rangeFrom:",
          rangeFrom?.format("YYYY-MM-DD")
        );
        if (!rangeResults || !rangeFrom) {
          console.log(
            "[useEffect] Skipping - missing rangeResults or rangeFrom"
          );
          return;
        }
        const monthStart = rangeFrom.startOf("month");
        const monthEnd = monthStart.endOf("month");

        // Robust matcher across EN/AR labels
        const pickCodeFromStrings = (raw: string): string => {
          const s = String(raw || "")
            .trim()
            .toUpperCase();

          // exact 2–3 char tokens first
          const allowed = new Set([
            "AL",
            "SL",
            "EL",
            "UL",
            "ML",
            "XL",
            "B1",
            "B2",
            "HL",
            "BM",
          ]);
          const m = s.match(/\b([A-Z0-9]{2,3})\b/);
          if (m && allowed.has(m[1])) return m[1];

          // English synonyms
          if (/ANNU|VAC/.test(s)) return "AL";
          if (/SICK/.test(s)) return "SL";
          if (/EMER|URG/.test(s)) return "EL";
          if (/UNPAID/.test(s)) return "UL";
          if (/MATERN/.test(s)) return "ML";
          if (/EXAM/.test(s)) return "XL";
          if (/\bB1\b/.test(s)) return "B1";
          if (/\bB2\b/.test(s)) return "B2";
          if (/\bHL\b|HALF/.test(s)) return "HL";
          if (/BEREAVE/.test(s)) return "BM";

          // Arabic keywords
          const sAr = s; // already uppercased; matching by Arabic words is fine case-insensitive
          if (/سَنَوِي|سنوي|إجازة\s*سنوية/.test(raw)) return "AL";
          if (/مَرَضِي|مرضي|مرضية/.test(raw)) return "SL";
          if (/طارئ|طوارئ/.test(raw)) return "EL";
          if (/بدون\s*أجر|غير\s*مدفوعة/.test(raw)) return "UL";
          if (/أموم|أمومة/.test(raw)) return "ML";
          if (/امتحان|اختبار/.test(raw)) return "XL";
          if (/وفاة|حداد/.test(raw)) return "BM";
          if (/نصف\s*يوم/.test(raw)) return "HL";

          return ""; // don't force AL as a fallback
        };

        const isApprovedLike = (status: any): boolean => {
          const s = String(status || "")
            .trim()
            .toLowerCase();
          if (!s) return false;
          return [
            "approved",
            "accepted",
            "validated",
            "approuved",
            "approuvé",
            "validé",
            "approved by hr",
            "approved_by_hr",
          ].some((tk) => s.includes(tk));
        };

        const ymd10 = (v: any): string => {
          if (!v) return "";
          // Use the same robust parser used elsewhere in this file.
          // This correctly handles DD/MM/YYYY, YYYY-MM-DD, and mixed inputs.
          const d = parseStartDateLocal(v);
          return d && d.isValid() ? d.format("YYYY-MM-DD") : "";
        };

        const normalizeExcludedISOSet = (excluded: any): Set<string> => {
          const set = new Set<string>();
          if (!excluded) return set;

          // Backend shape: { fridays: string[], holidays: [{date,name}] }
          if (!Array.isArray(excluded) && typeof excluded === "object") {
            const fr = Array.isArray((excluded as any).fridays)
              ? (excluded as any).fridays
              : [];
            const hol = Array.isArray((excluded as any).holidays)
              ? (excluded as any).holidays
              : [];
            for (const x of fr) {
              const iso = String(x || "").slice(0, 10);
              if (iso) set.add(iso);
            }
            for (const x of hol) {
              const iso = String((x as any)?.date ?? (x as any)?.iso ?? x ?? "").slice(0, 10);
              if (iso) set.add(iso);
            }
            return set;
          }

          // Frontend/legacy shapes: array<string> or array<{iso,date}>
          const arr = Array.isArray(excluded) ? excluded : [];
          for (const x of arr) {
            if (!x) continue;
            if (typeof x === "string") {
              set.add(x.slice(0, 10));
              continue;
            }
            const iso = String((x as any).iso ?? (x as any).date ?? "").slice(0, 10);
            if (iso) set.add(iso);
          }
          return set;
        };

        const next = new Map<number, Map<string, string>>();

        await Promise.all(
          rangeResults.map(async (r) => {
            try {
              const reqs = await getLeaveRequests(String(r.id_emp));
              const map = new Map<string, string>();

              for (const lr of reqs || []) {
                if (!isApprovedLike((lr as any).status ?? (lr as any).state)) continue;

                // Prefer numeric ID → lookup table
                const idCanRaw =
                  (lr as any).idCan ??
                  (lr as any).id_can ??
                  (lr as any).int_can ??
                  null;
                let code = "";
                if (
                  Number.isFinite(Number(idCanRaw)) &&
                  leaveCodeByIntCan.has(Number(idCanRaw))
                ) {
                  code = String(
                    leaveCodeByIntCan.get(Number(idCanRaw)) || ""
                  ).toUpperCase();
                }

                // Otherwise, try explicit fields then names
                if (!code) {
                  code = pickCodeFromStrings(
                    (lr as any).code ??
                      (lr as any).type ??
                      (lr as any).leaveType ??
                      (lr as any).leaveTypeName ??
                      (lr as any).name ??
                      (lr as any).reason ??
                      ""
                  );
                }

                if (!code) continue; // unrecognized — don't mislabel as AL

                const isSick = String(code || "").toUpperCase() === "SL";
                const excludedSet = normalizeExcludedISOSet((lr as any).excluded);

                // Date span clamp to the visible month
                const sISO = ymd10((lr as any).startDate || (lr as any).date_depart || (lr as any).from);
                const eISO = ymd10((lr as any).endDate || (lr as any).date_end || (lr as any).to || (lr as any).startDate);
                if (!sISO || !eISO) continue;
                const s = dayjs(sISO);
                const e = dayjs(eISO);
                if (!s.isValid() || !e.isValid()) continue;
                const first = s.isAfter(monthStart) ? s : monthStart;
                const last = e.isBefore(monthEnd) ? e : monthEnd;

                let cur = first;
                while (!cur.isAfter(last, "day")) {
                  const ymd = cur.format("YYYY-MM-DD");
                  const isFri = cur.day() === 5;
                  const isHol = holidaysSet.has(ymd);
                  // effective-day rule: do not count leave on Fri/holidays (except sick leave)
                  const isExcluded = excludedSet.has(ymd);
                  if (isSick || (!isFri && !isHol && !isExcluded)) {
                    map.set(ymd, code);
                  }
                  cur = cur.add(1, "day");
                }
              }

              if (map.size) next.set(r.id_emp, map);
            } catch {
              /* ignore per-emp errors */
            }
          })
        );

        setLeavesByEmp(next);
      } catch (e) {
        console.error("Failed to build leavesByEmp:", e);
        setLeavesByEmp(new Map());
      }
    })();
  }, [rangeFrom, rangeResults, leaveCodeByIntCan, holidaysSet]);

  const getPsParam = (val: string) => {
    if (val === "ALL" || !val) return null;
    const m = val.match(/^P?(\d+)$/i);
    return {
      id: m ? Number(m[1]) : null, // numeric form, e.g. 3
      code: val.toUpperCase(), // string form, e.g. "P3"
    };
  };

  async function openDetail(
    row: RangePunchesEmployee,
    d: dayjs.Dayjs,
    rec?: { j: string; R: string; E: string | null; S: string | null }
  ) {
    const ymd = d.format("YYYY-MM-DD");
    const tsd = tsByEmp.get(row.id_emp)?.get(ymd);
    const psName = getPsPointName(row.ps ?? null);
    const sched = resolveScheduleFor(row.id_emp, row);
    const entryPref: any = (tsd?.entry as any) || (rec?.E as any) || null;
    const exitPref: any = (tsd?.exit as any) || (rec?.S as any) || null;

    // Extract time from entry/exit (handle various formats)
    const extractTimeHHMM = (val: any): string => {
      if (!val) return "";
      const s = String(val);
      // Try to match HH:mm pattern
      const m = s.match(/(\d{2}):(\d{2})/);
      return m ? `${m[1]}:${m[2]}` : "";
    };

    const entryTime = extractTimeHHMM(entryPref);
    const exitTime = extractTimeHHMM(exitPref);
    const fallbackWorked = (() => {
      const startMin = parseHmToMinutes(entryTime);
      const endMin = parseHmToMinutes(exitTime);
      if (startMin == null || endMin == null || endMin <= startMin) return null;
      return endMin - startMin;
    })();
    const workedMinutes = Number.isFinite(tsd?.workMin)
      ? tsd?.workMin ?? null
      : fallbackWorked;
    const scheduleExpected = (() => {
      if (!sched.start || !sched.end) return null;
      const startMin = parseHmToMinutes(sched.start);
      const endMin = parseHmToMinutes(sched.end);
      if (startMin == null || endMin == null || endMin <= startMin) return null;
      return endMin - startMin;
    })();
    const expectedMinutes = Number.isFinite(tsd?.expectedMin)
      ? tsd?.expectedMin ?? null
      : scheduleExpected;
    const rawDelta = Number.isFinite(tsd?.deltaMin) ? tsd?.deltaMin ?? null : null;
    const fallbackDelta = sched.start && sched.end
      ? computeDeltaFromSchedule(entryTime || null, exitTime || null, sched.start, sched.end)
      : null;
    const deltaMinutes = rawDelta ?? fallbackDelta;

    setDetailData({
      id_emp: row.id_emp,
      name: row.name,
      date: ymd,
      j: String(tsd?.code || rec?.j || "").toUpperCase(),
      R: tsd?.reason || rec?.R || "",
      E: tsd?.entry || rec?.E || null,
      S: tsd?.exit || rec?.S || null,
      psName,
      workedMin: workedMinutes,
      expectedMin: expectedMinutes,
      deltaMin: deltaMinutes,
    });

    setEditJ(String(tsd?.code || rec?.j || "").toUpperCase());
    setEditR(tsd?.reason || rec?.R || "");
    setEditE(entryTime);
    setEditS(exitTime);

    try {
      const y = d.year();
      const m = d.month() + 1;
      const ts = await getTimesheetMonth(row.id_emp, y, m);
      const idx = d.date() - 1;
      const tsDay = ts?.data?.[idx];
      let existing = tsDay?.comment || "";
      const prefix = `[${d.format("YYYY-MM-DD")}]`;
      if (existing.startsWith(prefix)) {
        existing = existing.slice(prefix.length).trim();
      }
      console.log("[openDetail] TS day data:", tsDay);
      console.log(
        "[openDetail] Loaded comment for",
        d.format("YYYY-MM-DD"),
        ":",
        existing
      );
      setEditComment(existing || "");
      setDetailExistingComment(existing || "");
    } catch (err) {
      console.error("[openDetail] Failed to load comment:", err);
    }
    setDetailOpen(true);
  }

  useEffect(() => {
    (async () => {
      try {
        const pts = await listPsPoints();
        setPsPoints(pts || []);
      } catch (e) {
        setPsPoints([]);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        console.log(
          "[useEffect] Triggered with rangeResults:",
          rangeResults?.length,
          "rangeFrom:",
          rangeFrom?.format("YYYY-MM-DD")
        );
        if (!rangeResults || !rangeFrom) {
          console.log(
            "[useEffect] Skipping - missing rangeResults or rangeFrom"
          );
          return;
        }
        const monthStart = rangeFrom.startOf("month");
        const monthEnd = monthStart.endOf("month");
        const y = monthStart.year();
        const m = monthStart.month() + 1;
        const resultMap = new Map<number, Map<string, TimesheetDay>>();
        const holidayDates = new Set<string>();
        const batchSize = 10;
        for (let i = 0; i < rangeResults.length; i += batchSize) {
          const batch = rangeResults.slice(i, i + batchSize);
          const res = await Promise.all(
            batch.map((r: RangePunchesEmployee) =>
              getTimesheetMonth(r.id_emp, y, m).catch(() => null)
            )
          );
          for (let j = 0; j < batch.length; j++) {
            const r = batch[j];
            const ts = res[j];
            if (ts && Array.isArray(ts.data)) {
              const dayMap = new Map<string, TimesheetDay>();
              for (const d of ts.data) {
                const ymd = `${y}-${String(m).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
                dayMap.set(ymd, d);
                if (d.isHoliday) {
                  holidayDates.add(ymd);
                }
              }
              resultMap.set(r.id_emp, dayMap);
            }
          }
        }
        console.log(
          "[tsByEmp] Loaded TS for",
          resultMap.size,
          "employees, holidays:",
          holidayDates.size
        );
        const apiHolidaySet = new Set<string>();
        try {
          const startIso = monthStart.format("YYYY-MM-DD");
          const endIso = monthEnd.format("YYYY-MM-DD");
          const apiRes = await getHolidays({
            startDate: startIso,
            endDate: endIso,
          });
          const apiArr = Array.isArray(apiRes) ? apiRes : apiRes?.data || [];
          apiArr.forEach((h: any) => {
            const iso = String(
              h?.DATE_H ??
                h?.date ??
                h?.holiday_date ??
                h?.date_h ??
                h?.DATE ??
                ""
            ).slice(0, 10);
            if (iso) apiHolidaySet.add(iso);
          });
        } catch (err) {
          console.error("[holidays] Failed to fetch public holidays:", err);
        }
        try {
          const raw = localStorage.getItem("custom_holidays");
          if (raw) {
            const custom = JSON.parse(raw);
            if (Array.isArray(custom)) {
              custom.forEach((h: any) => {
                const iso = String(h?.DATE_H ?? h?.date ?? "").slice(0, 10);
                if (iso) apiHolidaySet.add(iso);
              });
            }
          }
        } catch (err) {
          console.error("[holidays] Failed to parse custom holidays:", err);
        }

        const mergedHolidays = new Set<string>([
          ...Array.from(holidayDates),
          ...Array.from(apiHolidaySet),
        ]);

        setTsByEmp(resultMap);
        setHolidaysSet(mergedHolidays);

        const vacFrom = rangeFrom.format("YYYY-MM-DD");
        const vacTo = dayjs().add(3, "month").format("YYYY-MM-DD");
        console.log("[vacations] Fetching from", vacFrom, "to", vacTo);
        try {
          const vacations = await getVacationsInRange(vacFrom, vacTo);
          console.log("[vacations] Raw response:", vacations);
          if (!Array.isArray(vacations)) {
            console.error("[vacations] Response is not an array:", vacations);
            setVacationsByEmp(new Map());
          } else {
            const vacMap = new Map<number, VacationRecord[]>();
            for (const v of vacations) {
              const empId = Number(v.id_emp);
              if (!vacMap.has(empId)) vacMap.set(empId, []);
              vacMap.get(empId)!.push(v);
            }
            console.log(
              "[vacations] Loaded",
              vacations.length,
              "vacation records for",
              vacMap.size,
              "employees"
            );
            console.log("[vacations] Sample:", vacations.slice(0, 3));
            console.log("[vacations] Map keys:", Array.from(vacMap.keys()));
            setVacationsByEmp(vacMap);
          }
        } catch (err: any) {
          console.error("[vacations] Failed to load:", err);
          console.error("[vacations] Error details:", err?.message, err?.stack);
          setVacationsByEmp(new Map());
        }
      } catch {}
    })();
  }, [rangeResults, rangeFrom]);

  const getPsPointName = useCallback(
    (n?: number | null): string => {
      if (n == null) return "";
      const found = psPoints.find((p) => p.Id_point === n);
      return found?.name_point || `P${n}`;
    },
    [psPoints]
  );

  useEffect(() => {
    if (ps === "") {
      setPsPointName("");
    } else {
      setPsPointName(getPsPointName(ps as number));
    }
  }, [ps, psPoints, getPsPointName]);

  function fmtLocalTimeHM(s?: string | null): string {
    if (!s) return "-";
    return dayjs(s).format("hh:mm A");
  }

  function fmtClockHM(s?: string | null): string {
    if (!s) return "-";
    const raw = String(s);
    if (/Z$/i.test(raw) || /[+-]\d{2}:\d{2}$/i.test(raw)) {
      let curr = 0;
      if (/Z$/i.test(raw)) curr = 0;
      else {
        const m = raw.match(/([+-])(\d{2}):(\d{2})$/);
        if (m) {
          const sign = m[1] === "+" ? 1 : -1;
          curr = sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
        }
      }
      const diff = 120 - curr;
      return dayjs(raw).add(diff, "minute").format("hh:mm A");
    }
    return dayjs(raw).format("hh:mm A");
  }

  const handleToggleAllLeaveColumns = (checked: boolean) => {
    setVisibleLeaveColumns(checked ? [...leaveColumnOrder] : []);
  };

  const handleToggleLeave = (code: string) => {
    setVisibleLeaveColumns((prev) => {
      if (prev.includes(code)) {
        return prev.filter((c) => c !== code);
      }
      return [...prev, code];
    });
  };

  const handleToggleAllAttendanceColumns = (checked: boolean) => {
    setVisibleAttendanceColumns(checked ? [...attendanceColumnOrder] : []);
  };

  const handleToggleAttendance = (code: string) => {
    setVisibleAttendanceColumns((prev) => {
      if (prev.includes(code)) {
        return prev.filter((c) => c !== code);
      }
      return [...prev, code];
    });
  };

  function isPresent(tsd?: TimesheetDay, rec?: any): boolean {
    return !!(tsd?.entry || tsd?.exit || tsd?.present || rec?.E || rec?.S);
  }

  function finalLeaveCodeForDay(
    empId: number,
    ymd: string,
    tsd?: TimesheetDay,
    rec?: { j?: string }
  ): string {
    const isFri = dayjs(ymd).day() === 5;
    const dayRaw0 =
      (rec as any)?.j ??
      (rec as any)?.code ??
      (rec as any)?.leaveCode ??
      (rec as any)?.leave_type ??
      tsd?.code ??
      tsd?.reason ??
      "";
    const dayCode0 = normalizeLeaveCode(dayRaw0);
    const dayUp0 = String(dayCode0 || "").toUpperCase();
    const isHol =
      Boolean((tsd as any)?.isHoliday) ||
      Boolean((rec as any)?.isHoliday) ||
      holidaysSet.has(ymd) ||
      dayUp0 === "PH" ||
      dayUp0 === "PHF";

    // Day-level attendance codes must win over overlays (PH/PHF/PT/PL).
    const dayRaw =
      (rec as any)?.j ??
      (rec as any)?.code ??
      (rec as any)?.leaveCode ??
      (rec as any)?.leave_type ??
      tsd?.code ??
      tsd?.reason ??
      "";
    const dayCode = normalizeLeaveCode(dayRaw);
    if (dayCode && ["PH", "PHF", "PT", "PL"].includes(String(
      dayCode
    ).toUpperCase())) {
      return String(dayCode).toUpperCase();
    }

    // Prefer leave-request overlay (authoritative span) over any daily-coded data.
    // This prevents the grid from showing AL beyond the actual request end date.
    const overlayRaw = leavesByEmp.get(empId)?.get(ymd) || "";
    const overlayCode = normalizeLeaveCode(overlayRaw);
    if (overlayCode) {
      const up = String(overlayCode).toUpperCase();
      const isSick = up === "SL";
      if (!isSick && (isFri || isHol)) return "";
      return up;
    }

    return "";
  }

  // put this right under LEAVE_TYPES
  const getLeaveMeta = (code?: string) => {
    if (!code) return null;
    const k = code.toUpperCase() as keyof typeof LEAVE_TYPES;
    return LEAVE_TYPES[k] || null;
  };

  function fmtClock24(s?: string | null): string {
    if (!s) return "";
    const raw = String(s);
    if (/Z$/i.test(raw) || /[+-]\d{2}:\d{2}$/i.test(raw)) {
      let curr = 0;
      if (/Z$/i.test(raw)) curr = 0;
      else {
        const m = raw.match(/([+-])(\d{2}):(\d{2})$/);
        if (m) {
          const sign = m[1] === "+" ? 1 : -1;
          curr = sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
        }
      }
      const diff = 120 - curr;
      return dayjs(raw).add(diff, "minute").format("HH:mm");
    }
    return dayjs(raw).format("HH:mm");
  }

  // ---- PDF: Employee Leave Ledger (single employee / full year) ----------------
  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ] as const;

  type LeaveLedgerInputs = {
    alEntitlement?: number; // Annual leave entitlement days (default 24)
    sickEntitlement?: number; // Sick leave entitlement (default 10)
    emergencyEntitlement?: number; // Emergency entitlement (default 5)
    carryForwardAL?: number; // Carry-forward AL from previous year (default 0)
    endMonth?: number; // Month to end the report at (1-12)
    monthOnly?: boolean; // If true, limit period to the selected month only
  };

  const generateEmployeeLeaveLedgerPdf = useCallback(
    async (empId: number, year: number, opts?: LeaveLedgerInputs) => {
      const {
        alEntitlement = 30,
        sickEntitlement = 10,
        emergencyEntitlement = 5,
        carryForwardAL = 0,
      } = opts || {};

      // 1) Collect employee meta + whole-year daily data
      const emp = employees.find((e) => e.id === empId) || null;
      const employeeName = emp?.name || String(empId);

      // Get PS label
      let psLabel = "";
      try {
        // Prefer PS from employee list if present
        const psRaw = (emp as any)?.ps;
        if (psRaw != null && String(psRaw).trim() !== "") {
          const m = String(psRaw).match(/\d+/);
          const psNum = m ? parseInt(m[0], 10) : NaN;
          if (Number.isFinite(psNum)) {
            psLabel = `P${psNum} — ${getPsPointName(psNum)}`;
          }
        }
        // Fallback to range results
        if (!psLabel) {
          const row = rangeResults?.find((r) => r.id_emp === empId);
          if (row?.ps != null) {
            psLabel = `P${row.ps} — ${getPsPointName(row.ps)}`;
          }
        }
      } catch (err) {
        console.log("Could not get PS label:", err);
      }

      // Determine export period
      const today = dayjs();
      const fallbackEndMonth = year === today.year() ? today.month() + 1 : 12;
      const endMonth = Math.max(1, Math.min(12, Number((opts as any)?.endMonth ?? fallbackEndMonth)));
      const monthOnly = Boolean((opts as any)?.monthOnly ?? true);
      const monthStart = dayjs(new Date(year, endMonth - 1, 1));
      const monthEnd = monthStart.endOf("month");
      const periodStart = monthOnly ? monthStart : dayjs(new Date(year, 0, 1));
      const selectedMonthEnd = monthEnd;
      const periodEnd = monthOnly
        ? (year === today.year() && endMonth === today.month() + 1 ? today : selectedMonthEnd)
        : (year === today.year() && endMonth === today.month() + 1 ? today : selectedMonthEnd);

      // Pull months needed for the period
      const allDays: TimesheetDay[] = [];
      let hasAnyData = false;
      const monthsToLoad: number[] = monthOnly
        ? [endMonth]
        : Array.from({ length: endMonth }, (_, i) => i + 1);

      for (const m of monthsToLoad) {
        try {
          const res = await getTimesheetMonth(empId, year, m);
          if (res?.data && Array.isArray(res.data)) {
            // attach month/day index so we can count by month later
            res.data.forEach((d: any) => {
              (d as any).__month = m; // 1..12
            });
            allDays.push(...res.data);
            if (res.data.length > 0) hasAnyData = true;
          }
        } catch (err) {
          console.log(`No data for month ${m}:`, err);
          // Continue to next month instead of failing
        }
      }

      // If no data at all, create placeholder data structure
      if (!hasAnyData) {
        console.warn(
          `No timesheet data found for employee ${empId} in year ${year}, generating empty report`
        );
        // Create empty days for each month to still generate a report
        for (let m = 1; m <= 12; m++) {
          const daysInMonth = new Date(year, m, 0).getDate();
          for (let d = 1; d <= daysInMonth; d++) {
            allDays.push({
              day: d,
              code: null,
              reason: null,
              comment: null,
              entry: null,
              exit: null,
              punches: [],
              present: false,
              isHoliday: false,
              workMin: 0,
              expectedMin: 0,
              deltaMin: 0,
              __month: m,
            } as any);
          }
        }
      }

      // Fetch leave requests (used for approved totals and history)
      let pendingAL = 0;
      let allReqs: any[] = [];
      let leaveBal: { entitlement?: number; used?: number; remaining?: number } | null = null;
      try {
        const reqs = await getLeaveRequests(String(empId));
        allReqs = Array.isArray(reqs) ? reqs : [];
        if (allReqs.length) {
          pendingAL = allReqs.filter((r: any) => {
            const status = String(r.status || "").toLowerCase();
            const code = normalizeLeaveCode(
              r.code ?? r.type ?? r.leaveType ?? r.leaveTypeName ?? r.name ?? ""
            );
            return status === "pending" && code === "AL";
          }).length;
        }
      } catch (err) {
        console.log("Could not fetch leave requests:", err);
        // Continue without pending leave data
      }

      try {
        const bal = await getLeaveBalance(String(empId));
        if (bal && typeof bal === "object") {
          leaveBal = {
            annualEntitlement: Number((bal as any).annualEntitlement ?? NaN),
            accruedToDate: Number((bal as any).accruedToDate ?? NaN),
            deductedToDate: Number((bal as any).deductedToDate ?? NaN),
            remaining: Number((bal as any).remaining ?? NaN),
          } as any;
        }
      } catch {}

      // Build leave type lookup (id_can/code -> {code, name}) for accurate labels
      let leaveTypeMap: Record<string, { code: string; name: string }> = {};
      try {
        const rows = await getLeaveTypes();
        if (Array.isArray(rows)) {
          rows.forEach((row: any) => {
            const id = String(row.int_can ?? row.id_can ?? row.id ?? row.ID ?? "").trim();
            const code = String(row.code ?? row.CODE ?? row.id_can ?? row.int_can ?? "").trim().toUpperCase();
            const name = String(row.desig_can ?? row.name ?? row.DESIG_CAN ?? row.typeName ?? row.leaveTypeName ?? "").trim();
            const meta = { code: code || (id ? `C${id}` : ""), name };
            if (id) leaveTypeMap[id] = meta;
            if (code) leaveTypeMap[code] = meta;
          });
        }
      } catch {}

      // 2) Filter to period and helper counters
      const inPeriodDays: TimesheetDay[] = allDays.filter((d) => {
        const m = (d as any).__month as number;
        const ymd = `${year}-${String(m).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
        const dy = dayjs(ymd);
        return !dy.isBefore(periodStart, "day") && !dy.isAfter(periodEnd, "day");
      });

      const countIf = (predicate: (d: TimesheetDay) => boolean) =>
        inPeriodDays.reduce((acc, d) => (predicate(d) ? acc + 1 : acc), 0);

      const isPresentDay = (d?: TimesheetDay) =>
        !!(d?.entry || d?.exit || d?.present);

      const daysPresentCount = countIf(isPresentDay);

      const isAbsentUnexcused = (d?: TimesheetDay) => {
        if (!d) return false;
        const ymd = `${year}-${String((d as any).__month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
        const leave = finalLeaveCodeForDay(empId, ymd, d);
        const hol = Boolean(d.isHoliday) || holidaysSet.has(ymd);
        const fri = dayjs(ymd).day() === 5;
        const raw = String(d.code || "").toUpperCase();
        const explicitA = raw === "A";
        // unexcused absence = A, not on leave, not a holiday
        return explicitA && !leave && !hol && !fri;
      };

      const countByLeaveCode = (code: string) =>
        inPeriodDays.reduce((acc, d) => {
          const ymd = `${year}-${String((d as any).__month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
          const c = finalLeaveCodeForDay(empId, ymd, d);
          return String(c).toUpperCase() === code ? acc + 1 : acc;
        }, 0);

      const countPublicHolidays = () =>
        inPeriodDays.reduce((acc, d) => acc + (d.isHoliday ? 1 : 0), 0);

      // Build data arrays for Late/Missing, Absences
      const lateRows: Array<[string, string, string, string]> = []; // [Date, Entry, Exit, Missing(min)]
      const absentRows: Array<[string, string]> = []; // [Date, Note]
      let totalMissingMin = 0;

      inPeriodDays.forEach((d) => {
        const m = (d as any).__month as number;
        const ymd = fmtYMD(year, m, d.day);

        // Late / missing hours (present but negative delta)
        const isFri = dayjs(ymd).day() === 5;
        const isHol = Boolean(d.isHoliday) || holidaysSet.has(ymd);
        const onLeave = !!finalLeaveCodeForDay(empId, ymd, d);
        const excludeMissing = isFri || isHol || onLeave;
        if (
          isPresentDay(d) &&
          typeof d.deltaMin === "number" &&
          d.deltaMin < 0 &&
          !excludeMissing
        ) {
          lateRows.push([
            ymd,
            fmtTime(d.entry),
            fmtTime(d.exit),
            String(Math.abs(d.deltaMin)), // missing minutes
          ]);
          totalMissingMin += Math.abs(d.deltaMin || 0);
        }

        // Unexcused absence
        if (isAbsentUnexcused(d)) {
          absentRows.push([ymd, "Unexcused absence (A)"]);
        }
      });

      // 3) Totals for summary
      const aTaken = countIf(isAbsentUnexcused);
      const phTaken = countPublicHolidays();

      // Period-limited values (kept for period label, but not used for 'Consumed')
      let approvedInPeriodDays = 0;

      // All-time consumed values (for 'Consumed' and history/summary tables)
      const formatDays = (n: number): string => {
        const neg = n < 0;
        const v = Math.abs(n);
        const base = Math.floor(v);
        const frac = v - base;
        let rounded = base;
        if (frac >= 0.75) rounded = base + 1;
        else if (frac >= 0.5) rounded = base + 0.5;
        const out = neg ? -rounded : rounded;
        return out.toFixed(2);
      };

      // All-time consumed values (for 'Consumed' and history/summary tables)
      let consumedAllDays = 0;
      type HistRow = [string, string, string];
      const historyRows: HistRow[] = [];
      let typeTotalsRows: Array<[string, string]> = [];

      try {
        // 1) All-time approved/accepted leaves for 'Consumed' and full history
        const todayYMD = dayjs().format("YYYY-MM-DD");
        const allCal = await getCalendarLog({
          startDate: "1900-01-01",
          endDate: todayYMD,
          employeeId: empId,
          status: "Approved,Accepted",
        } as any);
        const allReqs = Array.isArray(allCal?.leaveRequests) ? allCal.leaveRequests : [];
        const allPerTypeTotals = Array.isArray(allCal?.perTypeTotals) ? allCal.perTypeTotals : [];

        consumedAllDays = allReqs.reduce(
          (sum: number, r: any) => sum + (Number(r?.effectiveDays ?? r?.days ?? 0) || 0),
          0
        );

        for (const r of allReqs) {
          const code = String(r?.leaveTypeCode || "").toUpperCase();
          const name = String(r?.leaveTypeName || "").trim();
          const typeLabel = code ? (name ? `${code} — ${name}` : code) : name || "Leave";
          const s = dayjs(String(r?.startDate || "").slice(0, 10));
          const e = dayjs(String(r?.endDate || "").slice(0, 10));
          const days = Number(r?.effectiveDays ?? r?.days ?? 0) || 0;
          const period = days > 1 ? `${s.format("DD MMM YYYY")} — ${e.format("DD MMM YYYY")}` : s.format("DD MMM YYYY");
          historyRows.push([typeLabel, period, formatDays(days)]);
        }

        typeTotalsRows = allPerTypeTotals
          .slice()
          .sort((a: any, b: any) => (Number(b?.days) || 0) - (Number(a?.days) || 0))
          .map((t: any) => [String(t?.label || "-"), formatDays(Number(t?.days) || 0)]);

        // 2) Period-limited value (used only if you still want to show period-specific numbers elsewhere)
        const cal = await getCalendarLog({
          startDate: periodStart.format("YYYY-MM-DD"),
          endDate: periodEnd.format("YYYY-MM-DD"),
          employeeId: empId,
          status: "Approved,Accepted",
        } as any);
        const leaveReqs = Array.isArray(cal?.leaveRequests) ? cal.leaveRequests : [];
        approvedInPeriodDays = leaveReqs.reduce(
          (sum: number, r: any) => sum + (Number(r?.effectiveDays ?? r?.days ?? 0) || 0),
          0
        );
      } catch (e) {
        console.warn("getCalendarLog failed, falling back to local computation");
      }

      // 4) Render PDF with clean modern design
      const { jsPDF, autoTable } = await getPdfLibraries();
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 50;
      let y = margin;

      // Logo (top left)
      const logo = await getLogoBase64().catch(() => null);
      if (logo) {
        // scale logo proportionally to fit within 60x60
        const getImageSize = (src: string) =>
          new Promise<{ w: number; h: number }>((resolve) => {
            try {
              const img = new Image();
              img.onload = () => resolve({ w: (img as any).naturalWidth || img.width, h: (img as any).naturalHeight || img.height });
              img.onerror = () => resolve({ w: 60, h: 60 });
              img.src = src;
            } catch {
              resolve({ w: 60, h: 60 });
            }
          });
        const { w, h } = await getImageSize(logo);
        const maxW = 60;
        const maxH = 60;
        const scale = Math.min(maxW / Math.max(1, w), maxH / Math.max(1, h));
        const drawW = Math.max(1, Math.round(w * scale));
        const drawH = Math.max(1, Math.round(h * scale));
        doc.addImage(logo, "PNG", margin, y, drawW, drawH);
      }

      // Title (top right)
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 33, 33);
      doc.text("Timesheet Report", pageW - margin, y + 20, { align: "right" });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      const periodText = `Period: ${periodStart.format("DD MMM YYYY")} - ${periodEnd.format("DD MMM YYYY")}`;
      doc.text(periodText, pageW - margin, y + 36, { align: "right" });

      y += 90;

      const employeeLabelPdf = (() => {
        try {
          const meta = employees.find((e) => e.id === empId) || null;
          const raw = String(meta?.name || employeeName || "").trim();
          const ascii = raw.replace(/[\u0080-\uFFFF]/g, "").trim();
          return ascii || `Employee #${empId}`;
        } catch {
          return `Employee #${empId}`;
        }
      })();

      // === EMPLOYEE INFORMATION SECTION (Rounded Box) ===
      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(248, 248, 248);
      doc.roundedRect(margin, y, pageW - 2 * margin, 80, 8, 8, 'FD');
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 33, 33);
      doc.text("Employee Information", margin + 15, y + 25);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      
      // Left column
      doc.setFont("helvetica", "bold");
      doc.text("Name:", margin + 15, y + 45);
      doc.setFont("helvetica", "normal");
      doc.text(employeeLabelPdf, margin + 80, y + 45);
      
      doc.setFont("helvetica", "bold");
      doc.text("Job Title:", margin + 15, y + 62);
      doc.setFont("helvetica", "normal");
      const jobTitle =
        empSchedule.get(empId)?.title ||
        (emp as any)?.TITLE ||
        (emp as any)?.JOB_TITLE ||
        (emp as any)?.FONCTION ||
        (emp as any)?.POSTE ||
        "—";
      doc.text(jobTitle, margin + 80, y + 62);
      
      // Right column
      const midPoint = margin + (pageW - 2 * margin) / 2;
      doc.setFont("helvetica", "bold");
      doc.text("Employee ID:", midPoint, y + 45);
      doc.setFont("helvetica", "normal");
      doc.text(String(empId), midPoint + 85, y + 45);
      
      doc.setFont("helvetica", "bold");
      doc.text("PS:", midPoint, y + 62);
      doc.setFont("helvetica", "normal");
      doc.text(psLabel || "—", midPoint + 85, y + 62);
      
      y += 100;

      // === BALANCE SUMMARY SECTION (Rounded Box) ===
      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(248, 248, 248);
      doc.roundedRect(margin, y, pageW - 2 * margin, 140, 8, 8, 'FD');
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 33, 33);
      doc.text("Balance Summary (as of today)", margin + 15, y + 25);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      
      // Three columns for balance
      const col1X = margin + 15;
      const col2X = margin + (pageW - 2 * margin) / 3 + 15;
      const col3X = margin + 2 * (pageW - 2 * margin) / 3 + 15;
      
      doc.setFont("helvetica", "bold");
      doc.text("Annual Entitlement", col1X, y + 50);
      doc.setFontSize(14);
      const entitlementDisplay = (() => {
        const a = Number((leaveBal as any)?.annualEntitlement);
        if (Number.isFinite(a) && a > 0) return a;
        const e = Number((leaveBal as any)?.entitlement);
        if (Number.isFinite(e) && e > 0) return e;
        return alEntitlement;
      })();
      doc.text(`${entitlementDisplay} days`, col1X, y + 70);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Consumed", col2X, y + 50);
      doc.setFontSize(14);
      doc.text(`${formatDays(consumedAllDays)} days`, col2X, y + 70);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Remaining Balance", col3X, y + 50);
      doc.setFontSize(14);
      const remainingDisplay = (() => {
        const rem = Number((leaveBal as any)?.remaining);
        if (Number.isFinite(rem)) return rem;
        const deducted = Number((leaveBal as any)?.deductedToDate);
        if (Number.isFinite(deducted)) return Math.max(0, (entitlementDisplay + carryForwardAL) - deducted);
        const used = Number((leaveBal as any)?.used);
        if (Number.isFinite(used)) return Math.max(0, (entitlementDisplay + carryForwardAL) - used);
        return Math.max(0, (entitlementDisplay + carryForwardAL) - consumedAllDays);
      })();
      doc.setTextColor(remainingDisplay < 5 ? 220 : 33, remainingDisplay < 5 ? 38 : 33, remainingDisplay < 5 ? 38 : 33);
      doc.text(`${remainingDisplay.toFixed(2)} days`, col3X, y + 70);
      
      // Second row: Days Present, Absence Days (A), Missing Hours
      const missingHoursTotal = (totalMissingMin / 60).toFixed(2);
      
      // Labels
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text("Days Present", col1X, y + 95);
      doc.text("Absence Days (A)", col2X, y + 95);
      doc.text("Missing Hours", col3X, y + 95);
      
      // Values
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(33, 33, 33);
      doc.text(`${daysPresentCount}`, col1X, y + 115);
      doc.text(`${aTaken}`, col2X, y + 115);
      doc.text(`${missingHoursTotal} hrs`, col3X, y + 115);
      
      y += 160;

      // === PRESENCE SUMMARY (in period) ===
      try {
        const targetCodes = ["P", "PT", "PL", "PH", "PHF"] as const;
        const codeOf = (d: TimesheetDay) => String(d?.code || "").toUpperCase();
        const presenceCounts: Array<[string, string]> = targetCodes.map((c) => [c, String(inPeriodDays.filter((d) => codeOf(d) === c).length)]);

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(33, 33, 33);
        doc.text("Presence Summary (in period)", margin, y);
        y += 10;

        if (presenceCounts.some((r) => Number(r[1]) > 0)) {
          autoTable(doc, {
            startY: y,
            head: [["Code", "Days"]],
            body: presenceCounts,
            styles: { fontSize: 10, cellPadding: 8 },
            headStyles: {
              fillColor: [248, 248, 248],
              textColor: [33, 33, 33],
              fontStyle: "bold",
              lineWidth: 0,
            },
            bodyStyles: {
              lineColor: [240, 240, 240],
              lineWidth: 0.5,
            },
            alternateRowStyles: { fillColor: [252, 252, 252] },
            margin: { left: margin, right: margin },
          });
          y = (doc as any).lastAutoTable.finalY + 16;
        } else {
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 100);
          doc.text("No presence in the selected period.", margin, y);
          y += 16;
        }
      } catch {}

      // === PRESENCE DETAILS (in period) ===
      try {
        const codeOf = (d: TimesheetDay) => String(d?.code || "").toUpperCase();
        const isTarget = (c: string) => c === "P" || c === "PT" || c === "PL" || c === "PH" || c === "PHF";
        const detailsRows: Array<[string, string, string, string, string]> = [];
        for (const d of inPeriodDays) {
          const m = (d as any).__month as number;
          const ymd = fmtYMD(year, m, d.day);
          const c = codeOf(d);
          if (!isTarget(c)) continue;
          const entry = fmtTime(d.entry);
          const exit = fmtTime(d.exit);
          const isFri = dayjs(ymd).day() === 5;
          const isHol = Boolean(d.isHoliday) || holidaysSet.has(ymd);
          const onLeave = !!finalLeaveCodeForDay(empId, ymd, d);
          const excludeMissing = isFri || isHol || onLeave;
          const miss = !excludeMissing && typeof d.deltaMin === "number" && d.deltaMin < 0 ? (Math.abs(d.deltaMin) / 60).toFixed(2) : "0.00";
          detailsRows.push([ymd, c, entry, exit, miss]);
        }

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(33, 33, 33);
        doc.text("Presence Details (in period)", margin, y);
        y += 10;

        if (detailsRows.length) {
          autoTable(doc, {
            startY: y,
            head: [["Date", "Code", "Entry", "Exit", "Missing (hrs)"]],
            body: detailsRows,
            styles: { fontSize: 10, cellPadding: 8 },
            headStyles: {
              fillColor: [248, 248, 248],
              textColor: [33, 33, 33],
              fontStyle: "bold",
              lineWidth: 0,
            },
            bodyStyles: {
              lineColor: [240, 240, 240],
              lineWidth: 0.5,
            },
            alternateRowStyles: { fillColor: [252, 252, 252] },
            margin: { left: margin, right: margin },
          });
          y = (doc as any).lastAutoTable.finalY + 16;
        } else {
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 100);
          doc.text("No presence details for the selected period.", margin, y);
          y += 16;
        }
      } catch {}

      // === LEAVE TYPES SUMMARY (All Approved) ===
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 33, 33);
      doc.text("Leave Types Summary (All Approved)", margin, y);
      y += 10;

      if (typeTotalsRows.length) {
        autoTable(doc, {
          startY: y,
          head: [["Type", "Days"]],
          body: typeTotalsRows,
          styles: { fontSize: 10, cellPadding: 8 },
          headStyles: {
            fillColor: [248, 248, 248],
            textColor: [33, 33, 33],
            fontStyle: "bold",
            lineWidth: 0,
          },
          bodyStyles: {
            lineColor: [240, 240, 240],
            lineWidth: 0.5,
          },
          alternateRowStyles: {
            fillColor: [252, 252, 252],
          },
          margin: { left: margin, right: margin },
        });
        y = (doc as any).lastAutoTable.finalY + 16;
      }

      // === LEAVE HISTORY (All Approved) ===
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 33, 33);
      doc.text("Leave History (All Approved)", margin, y);
      y += 10;

      if (historyRows.length) {
        autoTable(doc, {
          startY: y,
          head: [["Type", "Period", "Days"]],
          body: historyRows,
          styles: { fontSize: 10, cellPadding: 8 },
          headStyles: {
            fillColor: [248, 248, 248],
            textColor: [33, 33, 33],
            fontStyle: "bold",
            lineWidth: 0,
          },
          bodyStyles: {
            lineColor: [240, 240, 240],
            lineWidth: 0.5,
          },
          alternateRowStyles: {
            fillColor: [252, 252, 252],
          },
          margin: { left: margin, right: margin },
        });
        y = (doc as any).lastAutoTable.finalY + 16;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(33, 33, 33);
        doc.text(`Consumed total: ${formatDays(consumedAllDays)} days`, margin, y);
        y += 20;
      }

      

      // Remove all old detailed logs sections (holiday work, etc.) — Not applicable

      // Footer
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(150, 150, 150);
      const generated = `Generated: ${dayjs().format("YYYY-MM-DD HH:mm")}`;
      doc.text(generated, margin, pageH - 20);

      const slug = employeeName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_");

      const slugSafe = employeeLabelPdf
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_");
      doc.save(`leave_balance_${slugSafe || slug || empId}_${year}.pdf`);
    },
    [
      employees,
      empSchedule,
      rangeResults,
      getTimesheetMonth,
      getLeaveRequests,
      getCalendarLog,
      getLogoBase64,
      getPdfLibraries,
      getPsPointName,
      holidaysSet,
      finalLeaveCodeForDay,
    ]
  );

  const parseTimeHHMMSS = useCallback(
    (raw?: string | null): string | null => {
      if (!raw) return null;
      const trimmed = String(raw).trim();
      if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
      if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
      return null;
    },
    []
  );

  const formatTimeForApi = useCallback(
    (value: string | null): string | null => {
      if (!value) return null;
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
      if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
      return null;
    },
    []
  );

  function isLeaveCode(j?: string | null): boolean {
    if (!j) return false;
    const c = String(j).trim().toUpperCase();
    // None of these are considered leave anymore — only TS codes
    return false;
  }

  function roundedHoursWithSign(min?: number | null): string {
    if (min == null) return "";
    const sign = min >= 0 ? "+" : "-";
    const a = Math.abs(min);
    const h = Math.floor(a / 60);
    const m = Math.floor(a % 60);
    if (h === 0 && m < 1) return "";
    return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function fmtDelta(min?: number | null): string {
    if (min == null) return "";
    const sign = min >= 0 ? "+" : "-";
    const a = Math.abs(min);
    const h = Math.floor(a / 60);
    const m = a % 60;
    return `${sign}${String(h)}:${String(m).padStart(2, "0")}`;
  }

  const isDayFinalized = (date: dayjs.Dayjs): boolean => {
    const now = dayjs();
    if (date.isBefore(now, "day")) return true;
    if (date.isSame(now, "day")) return now.hour() >= 23;
    return false;
  };

  function ordinal(n: number): string {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
  }

  function isSameDay(a: dayjs.Dayjs, b: dayjs.Dayjs) {
    return a.isSame(b, "day");
  }

  async function saveEdit() {
    if (!editDay) return;
    try {
      setEditSaving(true);
      setEditError(null);

      if (!editJ) throw new Error("Status code is required");

      const ymd = `${year}-${String(month).padStart(2, "0")}-${String(editDay).padStart(2, "0")}`;
      const statusCode = String(editJ).trim().toUpperCase();

      await updateAttendance({
        employeeId: Number(employeeId),
        date: ymd,
        statusCode,
        reason: editR || undefined,
        comment: editComment || undefined,
      });

      // optimistic local cache
      setMonthPreviewMap((prev) => {
        const next = new Map(prev);
        next.set(ymd, { j: statusCode, R: editR || "", E: null, S: null });
        return next;
      });

      setEditOpen(false);

      // refresh UI from source of truth
      await loadMonthGrid(year, month);
      await fetchRangeData({ silent: true });

      showToast("Attendance updated successfully", "success");
    } catch (e: any) {
      console.error("[saveEdit] Error:", e);
      setEditError(e?.message || "Failed to save");
    } finally {
      setEditSaving(false);
    }
  }

  function dateRangeArray(from: Dayjs, to: Dayjs): Dayjs[] {
    const arr: Dayjs[] = [];
    let d = from.startOf("day");
    const end = to.startOf("day");
    while (!d.isAfter(end)) {
      arr.push(d);
      d = d.add(1, "day");
    }
    return arr;
  }

  const fetchRangeData = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!rangeFrom) return;
      const { silent } = opts ?? {};
      try {
        if (!silent) setRangeLoading(true);
        setRangeError(null);
        const fromIso = rangeFrom.format("YYYY-MM-DD");
        const toIso = rangeFrom.endOf("month").format("YYYY-MM-DD");
        const payload: Record<string, any> = {};
        const psParam = getPsParam(psFilter.toString()); // If it expects a string
        if (psParam) {
          // pick one that your backend expects:
          // payload.ps = psParam.id;     // if API expects numeric ID
          payload.ps = psParam.code; // if API expects "P3"
        }
        const data = await rangePunches(fromIso, toIso, payload);
        try {
          const y = rangeFrom.year();
          const m = rangeFrom.month() + 1;

          // IMPORTANT: call the same function/endpoint PayrollPage uses
          const pr = await computePayrollV2({ year: y, month: m }); // adjust signature if yours is computePayrollV2(y,m)

          const rows: PayrollAggRow[] = Array.isArray(pr?.rows)
            ? pr.rows
            : Array.isArray(pr?.data?.rows)
              ? pr.data.rows
              : [];
          setV2Rows(rows);
          const map = new Map<number, PayrollAggRow>();
          for (const row of rows) {
            const id = asEmpId(
              (row as any).id_emp ?? (row as any).ID_EMP ?? (row as any).employeeId
            );
            if (id) map.set(id, row);
          }
          setPayrollAggByEmp(map);
        } catch (e) {
          console.warn("[TimeSheets] computePayrollV2 failed; falling back to local aggregation", e);
          setPayrollAggByEmp(new Map());
          setV2Rows([]);
        }
        setRangeResults(data.employees);
        
        // Populate empSchedule and empStartDateMap from rangeResults
        if (data.employees && data.employees.length > 0) {
          const schedMap = new Map<number, EmpScheduleInfo>();
          const startMap = new Map<number, string>();
          
          for (const emp of data.employees) {
            const id = emp.id_emp;
            
            // Extract schedule
            if (emp.T_START && emp.T_END) {
              const extractTime = (val: string): string => {
                const match = String(val).match(/(\d{2}):(\d{2})/);
                return match ? `${match[1]}:${match[2]}` : "";
              };
              const start = extractTime(emp.T_START);
              const end = extractTime(emp.T_END);
              if (start && end) {
                const entry: EmpScheduleInfo = { start, end };
                if (emp.TITLE) entry.title = String(emp.TITLE).trim();
                schedMap.set(id, entry);
              }
            }
            
            // Extract start date
            if (emp.CONTRACT_START) {
              const parsed = parseStartDateLocal(emp.CONTRACT_START);
              if (parsed && parsed.isValid()) {
                startMap.set(id, parsed.format("YYYY-MM-DD"));
              }
            }
          }
          
          if (schedMap.size > 0) {
            setEmpSchedule(prev => {
              const next = new Map(prev);
              Array.from(schedMap.entries()).forEach(([id, val]) => {
                next.set(id, val);
              });
              console.log(`[rangePunches] Updated empSchedule with ${schedMap.size} entries from API`);
              return next;
            });
          }
          
          if (startMap.size > 0) {
            setEmpStartDateMap(prev => {
              const next = new Map(prev);
              Array.from(startMap.entries()).forEach(([id, val]) => {
                next.set(id, val);
              });
              console.log(`[rangePunches] Updated empStartDateMap with ${startMap.size} entries from API`);
              return next;
            });
          }
        }
      } catch (e: any) {
        setRangeResults(null);
        setRangeError(e?.message || "Failed to search");
      } finally {
        if (!silent) setRangeLoading(false);
      }
    },
    [ps, rangeFrom]
  );

  const loadMonthGrid = useCallback(
    async (y: number, m: number, empId?: number) => {
      const targetId = empId ?? employeeId;
      if (!targetId) return;
      const res = await getTimesheetMonth(targetId, y, m);
      setMonthGrid(res.data);

      try {
        const from = dayjs(new Date(y, m - 1, 1)).format("YYYY-MM-DD");
        const to = dayjs(new Date(y, m - 1, 1))
          .add(6, "month")
          .format("YYYY-MM-DD");
        const vacations = await getVacationsInRange(from, to);
        const empVacs = vacations.filter((v) => v.id_emp === targetId);
        console.log(
          "[loadMonthGrid] Loaded",
          empVacs.length,
          "vacations for employee",
          targetId
        );
        setEmployeeVacations(empVacs);
      } catch (err) {
        console.error("[loadMonthGrid] Failed to load vacations:", err);
        setEmployeeVacations([]);
      }

      try {
        const from = dayjs(new Date(y, m - 1, 1)).format("YYYY-MM-DD");
        const to = dayjs(new Date(y, m, 0)).format("YYYY-MM-DD");
        const pr = await rangePunches(from, to, { employeeId: targetId });
        const map = new Map<
          string,
          { j: string; R: string; E: string | null; S: string | null }
        >();
        const emp = (pr.employees || [])[0];
        if (emp && Array.isArray(emp.days)) {
          for (const d of emp.days) {
            map.set(d.date, {
              j: d.j || "",
              R: d.R || "",
              E: (d.E as any) || null,
              S: (d.S as any) || null,
            });
          }
        }
        setMonthPreviewMap(map);
      } catch {
        setMonthPreviewMap(new Map());
      }
    },
    [employeeId]
  );

  useEffect(() => {
    if (!rangeFrom) return;
    fetchRangeData({ silent: false }).catch(() => {});
  }, [fetchRangeData, rangeFrom]);

  useEffect(() => {
    if (!employeeId) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await loadMonthGrid(year, month, employeeId);
      } catch (e: any) {
        setError(e?.message || "Failed to load month");
      } finally {
        setLoading(false);
      }
    })();
  }, [employeeId, month, year, loadMonthGrid]);

  const canSync = useMemo(
    () => employeeId > 0 && year > 2000 && month >= 1 && month <= 12,
    [employeeId, year, month]
  );

  const asEmpId = (v: any): number => {
  const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const getAggMissingMinutes = (r?: PayrollAggRow | null): number => {
    if (!r) return 0;
    const a =
      Number((r as any).missing_minutes ?? (r as any).missingMinutes ?? (r as any).latencyMinutes ?? 0) || 0;
    return Math.max(0, Math.round(a));
  };

  const getAggAbsenceDays = (r?: PayrollAggRow | null): number => {
    if (!r) return 0;
    const a = Number((r as any).absence_days ?? (r as any).absenceDays ?? 0) || 0;
    // payroll uses decimals sometimes (HL = 0.5), keep as-is
    return a;
  };

  async function handleLoadMonth() {
    setError(null);
    setLoading(true);
    try {
      await loadMonthGrid(year, month);
      setSyncMsg(null);
    } catch (e: any) {
      setError(e?.message || "Failed to load month");
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    try {
      setLoading(true);
      setError(null);
      const res = await syncMonth(employeeId, year, month);
      setSyncMsg(res.message || "Synced");
      await loadMonthGrid(year, month);
    } catch (e: any) {
      setError(e?.message || "Failed to sync");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMonthGrid(null);
  }, [employeeId, year, month]);

  const toggleFullscreen = useCallback(async () => {
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

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    onFsChange();
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function LegendChip({
    label,
    bg,
    border,
    hatch,
  }: {
    label: string;
    bg?: string;
    border?: string;
    hatch?: boolean;
  }) {
    return (
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          px: 1,
          py: 0.25,
          borderRadius: 1,
          border: border || `1px solid ${APPLE.border}`,
          bgcolor: bg || "transparent",
          backgroundImage: hatch
            ? "linear-gradient(45deg, rgba(120,120,120,0.25) 0, rgba(120,120,120,0.25) 2px, transparent 2px), linear-gradient(-45deg, rgba(120,120,120,0.25) 0, rgba(120,120,120,0.25) 2px, transparent 2px)"
            : undefined,
        }}
      >
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: 0.5,
            bgcolor: bg ? bg : "transparent",
            border: border ? border : "none",
          }}
        />
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
      </Box>
    );
  }

  // Toasts
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string>("");
  const [toastSeverity, setToastSeverity] = useState<
    "success" | "error" | "warning" | "info"
  >("info");

  function showToast(
    msg: string,
    severity: "success" | "error" | "warning" | "info" = "info"
  ) {
    setToastMsg(msg);
    setToastSeverity(severity);
    setToastOpen(true);
  }

  function DayCell(props: {
    y: number;
    m: number;
    d: number;
    rec?: TimesheetDay | null;
    overlay?:
      | { j: string; R: string; E: string | null; S: string | null }
      | undefined;
    isFriday: boolean;
    onEdit: () => void;
    t: (k: string, ...args: any[]) => string;
    color: string;
    vacations?: VacationRecord[];
  }) {
    const {
      y,
      m,
      d,
      rec,
      overlay,
      isFriday,
      onEdit,
      t,
      color,
      vacations,
    } = props;
    const cellDate = dayjs(new Date(y, m - 1, d));
    const today = dayjs();
    const isToday = cellDate.isSame(today, "day");
    const isFuture = cellDate.isAfter(today, "day");

    const ymd = cellDate.format("YYYY-MM-DD");
    const safeISO10 = (v: any): string => {
      if (!v) return "";
      const s = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      const d = parseStartDateLocal(s);
      return d && d.isValid() ? d.format("YYYY-MM-DD") : "";
    };

    const onVacation = (vacations || []).find((v) => {
      const start = safeISO10(v.date_depart);
      const end = safeISO10(v.date_end);
      if (!start || !end) return false;
      const stateLower = (v.state || "").toLowerCase();
      const isValidState =
        stateLower === "approved" ||
        stateLower === "pending" ||
        stateLower === "موافق عليه";
      return ymd >= start && ymd <= end && isValidState;
    });

    const rawCode = String((overlay?.j ?? rec?.code ?? "") || "").trim().toUpperCase();
    const present = !isFuture && (!!rec?.present || rec?.code === "P" || !!overlay?.E);
    const isHoliday = Boolean(rec?.isHoliday) || holidaysSet.has(ymd) || rawCode === "PH" || rawCode === "PHF";
    const isAbsent = (overlay?.j || rec?.code || "") === "A" && !onVacation;
    
    // Auto-generate P punches for non-fingerprint employees on absent days
    // Note: This logic needs access to employee data which isn't available in DayCell props
    // For now, we'll skip auto-generation in DayCell and handle it in the grid view
    const needsFp = true; // Default to true since we can't determine in DayCell
    const isWorkingDay = !isFriday && !isHoliday && !onVacation;
    
    let autoEntryTime = "";
    let autoExitTime = "";
    let shouldShowAutoPunches = false;
    
    // Auto-generation disabled in DayCell due to missing employee data
    // This is handled in the compact grid view instead
    
    const normalizedDelta =
      typeof rec?.deltaMin === "number" && Number.isFinite(rec.deltaMin)
        ? rec.deltaMin
        : null;
    const hasMissingHours = normalizedDelta != null && normalizedDelta < 0;
    const hasExtraHours = normalizedDelta != null && normalizedDelta > 0;
    const isLate =
      (!hasMissingHours && rec?.deltaMin != null && rec.deltaMin < 0) || overlay?.R === "L";

    let displayJ = (() => {
      const recJ = (overlay?.j ?? rec?.code) || "";
      if (onVacation && recJ !== "P" && !isFriday && !isHoliday) {
        return onVacation.type || "V";
      }
      if (isFriday && !(recJ && recJ !== "A")) return t("off") || "Off";
      return recJ || (isHoliday ? t("holiday") : "");
    })();

    if (hasMissingHours && !isHoliday && !isFriday && !onVacation) {
      displayJ = "PS";
    } else if (hasExtraHours && !isHoliday && present && !onVacation) {
      displayJ = "P";
    }

    const R = overlay?.R ?? rec?.reason ?? "";
    const eRaw = overlay?.E
      ? fmtClockHM(overlay.E)
      : rec?.entry
        ? fmtLocalTimeHM(rec.entry)
        : "";
    const sRaw = overlay?.S
      ? fmtClockHM(overlay.S)
      : rec?.exit
        ? fmtLocalTimeHM(rec.exit)
        : "";

    const LATE_ACCENT = "rgb(188, 135, 36)";

    let baseBg = isHoliday
      ? APPLE.holidayBg
      : isFuture
        ? APPLE.futureBg
        : isAbsent
          ? APPLE.absentBg
          : present
            ? APPLE.presentBg
            : APPLE.cardBg;

    if (onVacation && !isHoliday) {
      baseBg = "rgba(156, 136, 255, 0.2)";
    }

    let borderColor: any = APPLE.border;
    if (hasMissingHours) borderColor = "#c62828";
    else if (hasExtraHours) borderColor = "#2e7d32";
    else if (isLate) borderColor = LATE_ACCENT;
    if (isToday && !hasMissingHours && !hasExtraHours) {
      borderColor = APPLE.todayRing;
    }
    const showEdit = !isFuture;

    return (
      <Box
        sx={{
          position: "relative",
          p: 1,
          height: { xs: 140, sm: 132 },
          borderRadius: 2,
          bgcolor: baseBg,
          border: "2.5px solid",
          minWidth: 0,
          borderColor,
          boxShadow: APPLE.shadow,
          display: "flex",
          flexDirection: "column",
          gap: { xs: 0.25, sm: 0.25 },
          transition: "transform 120ms ease, box-shadow 120ms ease",
          "&:hover": { transform: "translateY(-1px)" },
          opacity: isFuture ? 0.9 : 1,
        }}
      >
        {showEdit && !isFuture && (
          <Button
            size="small"
            variant="outlined"
            onClick={onEdit}
            sx={{
              position: "absolute",
              top: 4,
              left: 4,
              textTransform: "none",
              minWidth: 0,
              px: 1,
              py: 0.25,
              fontWeight: 700,
              bgcolor: "#FFFFFF",
              "&:hover": { bgcolor: "#FFFFFF" },
            }}
          >
            {t("common.edit") || "Edit"}
          </Button>
        )}

        {/* Punch In - top center (green text) */}
        <Box
          sx={{
            position: "absolute",
            top: 4,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <Typography
            sx={{
              color: "#b7a27d",
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.3,
              backgroundColor: "rgba(255,255,255,0.9)",
              px: 1,
              py: 0.25,
              borderRadius: 1,
            }}
          >
            {eRaw || autoEntryTime}
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <Box
            sx={{
              minWidth: 28,
              height: 22,
              px: 1,
              borderRadius: 999,
              bgcolor: APPLE.datePillBg,
              border: isSameDay(cellDate, today)
                ? `2.5px solid ${APPLE.todayRing}`
                : "1px solid rgba(60,60,67,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {ordinal(Number(cellDate.format("D")))}
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            mt: 0.25,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 0.25,
            overflow: "hidden",
          }}
        >
          <>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                lineHeight: 1.15,
                fontSize: { xs: "12px", sm: "13px", md: "14px" },
                whiteSpace: "normal",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                color: onVacation
                  ? "rgb(124, 58, 237)"
                  : isDark
                    ? "rgba(255,255,255,0.92)"
                    : "rgba(0,0,0,0.92)",
              }}
            >
              {displayJ}
            </Typography>

            {!!R && (
              <Typography
                variant="caption"
                sx={{
                  color: isDark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.92)",
                  whiteSpace: "normal",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                  fontSize: { xs: "10px", sm: "11px", md: "12px" },
                }}
              >
                R: {R}
              </Typography>
            )}
          </>
        </Box>

        {/* Punch Out - bottom center (green text) */}
        <Box
          sx={{
            position: "absolute",
            bottom: 4,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <Typography
            sx={{
              color: "#b7a27d",
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.3,
              backgroundColor: "rgba(255,255,255,0.9)",
              px: 1,
              py: 0.25,
              borderRadius: 1,
            }}
          >
            {sRaw || autoExitTime || "N/A"}
          </Typography>
        </Box>
      </Box>
    );
  }

  const showTimeLog = useCallback(
    async (row: RangePunchesEmployee, d: dayjs.Dayjs) => {
      try {
        const employeeId = asEmpId(row.id_emp);
        const year = d.year();
        const month = d.month(); // 0-indexed for JavaScript Date
        const monthStart = dayjs(new Date(year, month, 1));
        const monthEnd = monthStart.endOf("month");
        const schedule = resolveScheduleFor(employeeId, row);
        const today = dayjs().startOf("day");
        const payrollRow = payrollAggByEmp.get(employeeId) || null;
        const payrollMissingMinutes = getAggMissingMinutes(payrollRow);
        const payrollMissingHours = payrollMissingMinutes > 0 ? payrollMissingMinutes / 60 : null;

        console.log(
          `[showTimeLog] Fetching data for employee ${employeeId}, ${year}-${month + 1}`
        );

        const scheduleSpanMinutes = (() => {
          if (!schedule.start || !schedule.end) return null;
          const startMin = parseHmToMinutes(schedule.start);
          const endMin = parseHmToMinutes(schedule.end);
          if (startMin == null || endMin == null || endMin <= startMin) return null;
          return endMin - startMin;
        })();

        const computeDayMetrics = (
          day: TimesheetDay | null | undefined,
          ymd: string
        ) => {
          const dateObj = dayjs(ymd);
          const isFutureOrToday = !dateObj.isBefore(today, "day");
          const entrySrc = (day as any)?.entry ?? (day as any)?.E ?? null;
          const exitSrc = (day as any)?.exit ?? (day as any)?.S ?? null;
          const entryStrRaw = entrySrc ? fmtClock24(entrySrc) : "";
          const exitStrRaw = exitSrc ? fmtClock24(exitSrc) : "";
          const entryStr = entryStrRaw || null;
          const exitStr = exitStrRaw || null;
          const entryMin = entryStr ? parseHmToMinutes(entryStr) : null;
          const exitMin = exitStr ? parseHmToMinutes(exitStr) : null;

          const expectedMin = !isFutureOrToday
            ? toFiniteNumber((day as any)?.expectedMin) ?? scheduleSpanMinutes ?? null
            : null;

          const workedMin = !isFutureOrToday
            ? toFiniteNumber((day as any)?.workMin) ??
              (entryMin != null && exitMin != null && exitMin > entryMin
                ? exitMin - entryMin
                : null)
            : null;

          let normalizedDelta: number | null = null;
          if (!isFutureOrToday) {
            const rawDelta = toFiniteNumber((day as any)?.deltaMin);
            if (rawDelta != null) normalizedDelta = normalizeDelta(rawDelta);
            if (
              normalizedDelta == null &&
              schedule.start &&
              schedule.end &&
              entryStr &&
              exitStr
            ) {
              normalizedDelta = computeDeltaFromSchedule(
                entryStr,
                exitStr,
                schedule.start,
                schedule.end
              );
            }
            if (
              normalizedDelta == null &&
              expectedMin != null &&
              workedMin != null
            ) {
              normalizedDelta = normalizeDelta(workedMin - expectedMin);
            }

            // Apply 30‑minute tolerance: ignore deficits ≤30 minutes like PayrollPage
            if (normalizedDelta != null && normalizedDelta < 0 && Math.abs(normalizedDelta) <= 30) {
              normalizedDelta = 0;
            }

            // Ensure full absences show as -expectedHours when no punches
            if (normalizedDelta == null && expectedMin != null) {
              const hasPunches = Boolean(entryStr) || Boolean(exitStr);
              const dayCode = String((day as any)?.code || "").toUpperCase();
              const treatedAsLeave = Boolean(dayCode && LEAVE_TYPES[dayCode as keyof typeof LEAVE_TYPES]);
              const isHoliday = Boolean((day as any)?.isHoliday) || holidaysSet.has(ymd);
              if (!hasPunches && !treatedAsLeave && !isHoliday) {
                normalizedDelta = -expectedMin;
              }
            }
          }

          const expectedHours = (expectedMin ?? 0) / 60;
          const workedHours = (workedMin ?? 0) / 60;
          const deltaHours = normalizedDelta != null ? normalizedDelta / 60 : 0;
          const missingHoursOnly =
            normalizedDelta != null && normalizedDelta < 0
              ? Math.abs(normalizedDelta) / 60
              : 0;

          return {
            date: ymd,
            dateFormatted: dateObj.format("ddd, MMM D"),
            expectedHours,
            workedHours,
            deltaHours,
            isWeekend: dateObj.day() === 5 || dateObj.day() === 6,
            isHoliday: Boolean((day as any)?.isHoliday) || holidaysSet.has(ymd),
            isAbsentDay: isAbsentDay(day || undefined),
            missingHoursOnly,
          };
        };

        // Try to fetch fresh data from getTimesheetMonth
        try {
          const response = await getTimesheetMonth(employeeId, year, month + 1);
          if (response && response.data) {
            const days = response.data.map((day: TimesheetDay) => {
              const ymd = `${year}-${String(month + 1).padStart(2, "0")}-${String(
                day.day
              ).padStart(2, "0")}`;
              return computeDayMetrics(day, ymd);
            });

            const totals = days.reduce(
              (acc: any, day: any) => ({
                expectedHours: acc.expectedHours + (day.expectedHours || 0),
                workedHours: acc.workedHours + (day.workedHours || 0),
                deltaHours: acc.deltaHours + (day.deltaHours || 0),
                missingHoursOnly:
                  acc.missingHoursOnly + (day.missingHoursOnly || 0),
              }),
              { expectedHours: 0, workedHours: 0, deltaHours: 0, missingHoursOnly: 0 }
            );

            const timeLogData = {
              employeeId,
              employeeName: row.name,
              days,
              total: totals,
              missingHoursFromPayroll: payrollMissingHours,
            };

            console.log("[showTimeLog] Setting timeLogData:", timeLogData);
            setTimeLogData(timeLogData);
            setTimeLogDialogOpen(true);
            return;
          }
        } catch (error) {
          console.error("Error fetching timesheet data:", error);
        }

        // Fallback: use cached data from tsByEmp
        console.warn("[showTimeLog] Using cached data as fallback");
        const employeeData = tsByEmp.get(employeeId);
        if (!employeeData || employeeData.size === 0) {
          throw new Error("No timesheet data available for this employee");
        }

        const days: any[] = [];
        let current = monthStart;
        while (current.isSameOrBefore(monthEnd, "day")) {
          const ymd = current.format("YYYY-MM-DD");
          const dayData = employeeData.get(ymd);
          days.push(computeDayMetrics(dayData, ymd));
          current = current.add(1, "day");
        }

        const totals = days.reduce(
          (acc: any, day: any) => ({
            expectedHours: acc.expectedHours + (day.expectedHours || 0),
            workedHours: acc.workedHours + (day.workedHours || 0),
            deltaHours: acc.deltaHours + (day.deltaHours || 0),
            missingHoursOnly: acc.missingHoursOnly + (day.missingHoursOnly || 0),
          }),
          { expectedHours: 0, workedHours: 0, deltaHours: 0, missingHoursOnly: 0 }
        );

        const finalTimeLogData = {
          employeeId,
          employeeName: row.name,
          days,
          total: totals,
          missingHoursFromPayroll: payrollMissingHours,
        };

        console.log(
          "[showTimeLog] Setting cached timeLogData:",
          finalTimeLogData
        );
        setTimeLogData(finalTimeLogData);
        setTimeLogDialogOpen(true);
      } catch (error) {
        console.error("Error in showTimeLog:", error);
        showToast(
          error instanceof Error ? error.message : "Failed to load time log",
          "error"
        );
      }
    },
    [
      tsByEmp,
      resolveScheduleFor,
      holidaysSet,
      showToast,
      payrollAggByEmp,
      getAggMissingMinutes,
    ]
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
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
            ...(isFullscreen && {
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }),
          }}
        >
          <CardContent
            sx={{
              p: isFullscreen ? 1 : undefined,
              ...(isFullscreen && {
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
              }),
            }}
          >
            <Box
              sx={{
                ...(isFullscreen && {
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                }),
              }}
            >
              {!isFullscreen && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mt: 1 }}>
                  <Accordion
                    disableGutters
                    sx={{ flex: 1, minWidth: 260 }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography sx={{ fontWeight: 700 }}>Leave Legend</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <LegendChip label="AL — Annual Leave" bg={alpha(LEAVE_TYPES.AL.color, isDark ? 0.48 : 0.34)} />
                        <LegendChip label="SL — Sick Leave" bg={alpha(LEAVE_TYPES.SL.color, isDark ? 0.48 : 0.34)} />
                        <LegendChip label="EL — Emergency Leave" bg={alpha(LEAVE_TYPES.EL.color, isDark ? 0.48 : 0.34)} />
                        <LegendChip label="UL — Unpaid Leave" bg={alpha(LEAVE_TYPES.UL.color, isDark ? 0.48 : 0.34)} />
                        <LegendChip label="ML — Maternity Leave" bg={alpha(LEAVE_TYPES.ML.color, isDark ? 0.48 : 0.34)} />
                        <LegendChip label="XL — Exam Leave" bg={alpha(LEAVE_TYPES.XL.color, isDark ? 0.48 : 0.34)} />
                        <LegendChip label="B1 — Bereavement 1" bg={alpha(LEAVE_TYPES.B1.color, isDark ? 0.48 : 0.34)} />
                        <LegendChip label="B2 — Bereavement 2" bg={alpha(LEAVE_TYPES.B2.color, isDark ? 0.48 : 0.34)} />
                        <LegendChip label="HL — Half Day Leave" bg={alpha(LEAVE_TYPES.HL.color, isDark ? 0.48 : 0.34)} />
                        <LegendChip label="BM — Bereavement" bg={alpha(LEAVE_TYPES.BM.color, isDark ? 0.48 : 0.34)} />
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                  <Accordion disableGutters sx={{ flex: 1, minWidth: 260 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography sx={{ fontWeight: 700 }}>Attendance Legend</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <LegendChip label="P — Present" bg={alpha(ATTENDANCE_TYPES.P.color, isDark ? 0.48 : 0.34)} />
                        <LegendChip label="PO — Present Overtime" bg={alpha(ATTENDANCE_TYPES.PO.color, isDark ? 0.48 : 0.34)} />
                        <LegendChip label="PM — Present Missing" bg={alpha(ATTENDANCE_TYPES.PM.color, isDark ? 0.48 : 0.34)} />
                        <LegendChip label="PH — Paid Holiday" bg={alpha(ATTENDANCE_TYPES.PH.color, isDark ? 0.48 : 0.34)} />
                        <LegendChip label="PHF — Paid Holiday + Food" bg={alpha(ATTENDANCE_TYPES.PHF.color, isDark ? 0.48 : 0.34)} />
                        <LegendChip label="PT — Present + Food" bg={alpha(ATTENDANCE_TYPES.PT.color, isDark ? 0.48 : 0.34)} />
                        <LegendChip label="PL — Present Late" bg={alpha(ATTENDANCE_TYPES.PL.color, isDark ? 0.48 : 0.34)} />
                        <LegendChip label="A — Absent" bg={alpha(ATTENDANCE_TYPES.A.color, isDark ? 0.48 : 0.34)} />
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                </Box>
              )}
              {/* Column toggles moved into Settings dialog */}
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 1.5,
                  mb: 1.5,
                }}
              >
                <IconButton
                  size="small"
                  aria-label="Previous month"
                  onClick={() => shiftRangeMonth(-1)}
                >
                  <ChevronLeftIcon />
                </IconButton>

                <TextField
                  select
                  label={t("hr.timesheets.month") || "Month"}
                  size="small"
                  value={
                    rangeFrom
                      ? rangeFrom.month() + 1
                      : new Date().getMonth() + 1
                  }
                  onChange={(e) => {
                    const selectedMonth = Number(e.target.value);
                    const currentYear = rangeFrom
                      ? rangeFrom.year()
                      : new Date().getFullYear();
                    setRangeFrom(
                      dayjs(new Date(currentYear, selectedMonth - 1, 1))
                    );
                  }}
                  sx={{ minWidth: 140 }}
                >
                  {months.map((m) => (
                    <MenuItem key={m.value} value={m.value}>
                      {m.label}
                    </MenuItem>
                  ))}
                </TextField>

                <IconButton
                  size="small"
                  aria-label="Next month"
                  onClick={() => shiftRangeMonth(1)}
                >
                  <ChevronRightIcon />
                </IconButton>

                <TextField
                  select
                  label={t("hr.timesheets.year") || "Year"}
                  size="small"
                  value={
                    rangeFrom ? rangeFrom.year() : new Date().getFullYear()
                  }
                  onChange={(e) => {
                    const selectedYear = Number(e.target.value);
                    const currentMonth = rangeFrom
                      ? rangeFrom.month()
                      : new Date().getMonth();
                    setRangeFrom(
                      dayjs(new Date(selectedYear, currentMonth, 1))
                    );
                  }}
                  sx={{ minWidth: 120 }}
                >
                  {years.map((y) => (
                    <MenuItem key={y} value={y}>
                      {y}
                    </MenuItem>
                  ))}
                </TextField>

                {!isFullscreen && (
                  <IconButton onClick={toggleFullscreen}>
                    <FullscreenIcon />
                  </IconButton>
                )}

                <TextField
                  label={t("hr.timesheets.searchEmployee") || "Search employee"}
                  size="small"
                  value={empFilter}
                  onChange={(event) => setEmpFilter(event.target.value)}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={onlyAbsent}
                      onChange={(e) => setOnlyAbsent(e.target.checked)}
                    />
                  }
                  label={t("hr.timesheets.onlyAbsent") || "Only absent"}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={onlyOnLeave}
                      onChange={(e) => setOnlyOnLeave(e.target.checked)}
                    />
                  }
                  label={t("hr.timesheets.onlyOnLeave") || "Only on leave"}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={onlyHolidayWorked}
                      onChange={(e) => setOnlyHolidayWorked(e.target.checked)}
                    />
                  }
                  label={
                    t("hr.timesheets.onlyHolidayWorked") ||
                    "Only holiday worked"
                  }
                />
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>{t("hr.timesheets.psPoint") || "PS Point"}</InputLabel>
                  <Select
                    label={t("hr.timesheets.psPoint") || "PS Point"}
                    value={psFilter}
                    onChange={(e) => setPsFilter((e.target.value as string) || '')}
                  >
                    <MenuItem value="">{t("hr.timesheets.allPs") || "All PS"}</MenuItem>
                    {psOptions.map((ps) => {
                      const code = (ps.code_point ?? `P${ps.Id_point}`).toUpperCase();
                      return (
                        <MenuItem key={ps.Id_point} value={code}>
                          {code} — {ps.name_point}
                        </MenuItem>
                      );
                    })}
                    <MenuItem value="OG">OG</MenuItem>
                  </Select>
                </FormControl>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setExportMode("single");
                      setExportPeriod("month");
                      setExportEmployeeId(
                        employeeId || (employees.length ? employees[0].id : null)
                      );
                      setExportOpen(true);
                    }}
                  >
                    {t("hr.timesheets.export") || "Export Timesheets"}
                  </Button>
                  <IconButton aria-label="settings" onClick={() => setSettingsOpen(true)} size="large">
                    <SettingsIcon fontSize="large" />
                  </IconButton>
                </Box>
              </Box>
              <Divider sx={{ mb: 2 }} />
              {rangeError && (
                <Box sx={{ mt: 2 }}>
                  <Alert severity="error">{rangeError}</Alert>
                </Box>
              )}
              {rangeResults && rangeFrom && (
                <Box
                  sx={{
                    mt: 2,
                    ...(isFullscreen && {
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      minHeight: 0,
                    }),
                  }}
                >
                  {(() => {
                    const monthStart = rangeFrom.startOf("month");
                    const monthEnd = monthStart.endOf("month");
                    const dates = dateRangeArray(monthStart, monthEnd);

                    const filtered = rangeResults.filter(
                      (r: RangePunchesEmployee) => {
                        if (!empFilter) return true;
                        const f = empFilter.toLowerCase();
                        return (
                          r.name?.toLowerCase().includes(f) ||
                          String(r.id_emp).includes(f)
                        );
                      }
                    );

                    let filtered2 = filtered;

                    if (psFilter !== '') {
                      filtered2 = filtered2.filter((r: RangePunchesEmployee) => {
                        const rp = (r as any).ps;
                        const norm = typeof rp === 'number' ? `P${rp}` : String(rp || '').toUpperCase();
                        return norm === String(psFilter).toUpperCase();
                      });
                    }

                    if (onlyAbsent) {
                      filtered2 = filtered2.filter((r: RangePunchesEmployee) =>
                        (r.days || []).some((d: any) => {
                          const tsd = tsByEmp.get(r.id_emp)?.get(d.date);
                          const leaveCode = finalLeaveCodeForDay(
                            r.id_emp,
                            d.date,
                            tsd,
                            d
                          );
                          const fpNotNeeded = isEmpFingerprintNotNeeded(r.id_emp, r);
                          const present = fpNotNeeded ? true : isPresent(tsd, d);
                          const codeFromTsOrRange = String(
                            tsd?.code || d.j || ""
                          ).toUpperCase();
                          return (
                            codeFromTsOrRange === "A" && !present && !leaveCode
                          );
                        })
                      );
                    }

                    if (onlyOnLeave) {
                      filtered2 = filtered2.filter((r: RangePunchesEmployee) =>
                        (r.days || []).some((d: any) => {
                          const tsd = tsByEmp.get(r.id_emp)?.get(d.date);
                          return !!finalLeaveCodeForDay(
                            r.id_emp,
                            d.date,
                            tsd,
                            d
                          );
                        })
                      );
                    }

                    if (onlyHolidayWorked) {
                      filtered2 = filtered2.filter((r: RangePunchesEmployee) =>
                        (r.days || []).some((d: any) => {
                          const tsd = tsByEmp.get(r.id_emp)?.get(d.date);
                          const fpNotNeeded = isEmpFingerprintNotNeeded(r.id_emp, r);
                          return holidaysSet.has(d.date) && (fpNotNeeded ? true : isPresent(tsd, d));
                        })
                      );
                    }

                    const cellFor = (
                      rec: any | undefined,
                      d: dayjs.Dayjs,
                      row: RangePunchesEmployee
                    ) => {
                      const ymd = d.format("YYYY-MM-DD");
                      const tsd = tsByEmp.get(row.id_emp)?.get(ymd);
                      const sched = resolveScheduleFor(row.id_emp, row);
                      const fpNotNeeded = isEmpFingerprintNotNeeded(row.id_emp, row);

                      // Pre-employment guard: if the day is before employee's start date, render as disabled dark grey with an X
                      try {
                        let start: dayjs.Dayjs | null = null;
                        const startIso = empStartDateMap.get(row.id_emp) || null;
                        
                        if (startIso) {
                          start = dayjs(startIso);
                        } else {
                          // Try to get from row data directly
                          const startRaw =
                            (row as any).CONTRACT_START ||
                            (row as any).contract_start ||
                            (row as any).contractStart ||
                            (row as any).START_DATE ||
                            (row as any).startDate ||
                            (row as any).DATE_START ||
                            (row as any).date_start ||
                            (row as any).JOIN_DATE ||
                            (row as any).join_date ||
                            (row as any).JOINING_DATE ||
                            (row as any).joining_date ||
                            (row as any).DOJ ||
                            (row as any).EMPLOYMENT_START ||
                            (row as any).employmentStart ||
                            null;
                          
                          if (startRaw) {
                            start = parseStartDateLocal(startRaw);
                          }
                        }
                        
                        if (start && start.isValid() && d.isBefore(start, "day")) {
                          const disabledBg = isDark
                            ? alpha("#111827", 0.75)
                            : "#d1d5db";
                          return {
                            centerCode: "X",
                            isFri: d.day() === 5,
                            textColor: isDark ? "#ffffff" : "#111827",
                            bg: disabledBg,
                            border: `1px solid ${APPLE.border}`,
                            manualStar: false,
                            hasComment: false,
                            disabled: true,
                            pillText: "",
                            pillTone: "neutral" as const,
                          };
                        }

                      } catch (err) {
                        console.error(`[cellFor] Error checking pre-employment for emp ${row.id_emp}:`, err);
                      }

                      const rawFromTs = String(tsd?.code || "").trim();
                      const rawFromRange = String(rec?.j || "").trim();
                      const rawMerged = (
                        rawFromTs || rawFromRange
                      ).toUpperCase();

                      const todayStart = dayjs().startOf("day");
                      const isFri = d.day() === 5;
                      const rawUp = String(rawMerged || "").toUpperCase();
                      const isHolidayByCode = rawUp === "PH" || rawUp === "PHF";
                      const isHolidayDate =
                        holidaysSet.has(ymd) ||
                        Boolean((tsd as any)?.isHoliday) ||
                        Boolean((rec as any)?.isHoliday) ||
                        isHolidayByCode;
                      // Treat today as not finished: only days strictly before today are "past"
                      const isFuture = d.isAfter(todayStart, "day");
                      const isFutureOrToday = !d.isBefore(todayStart, "day");

                      const hasE = !isFuture && !!(tsd?.entry || rec?.E);
                      const hasS = !isFuture && !!(tsd?.exit || rec?.S);
                      const hasES = hasE && hasS;

                      const leaveCodeFinal = finalLeaveCodeForDay(
                        row.id_emp,
                        ymd,
                        tsd,
                        rec as any
                      );

                      const safeISO10 = (v: any): string => {
                        if (!v) return "";
                        const s = String(v).trim();
                        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
                        const dd = parseStartDateLocal(s);
                        return dd && dd.isValid() ? dd.format("YYYY-MM-DD") : "";
                      };

                      const onVacation = (() => {
                        const arr = vacationsByEmp.get(row.id_emp) || [];
                        for (const v of arr) {
                          const st = safeISO10((v as any).date_depart);
                          const en = safeISO10((v as any).date_end);
                          if (!st || !en) continue;
                          const stateLower = String((v as any).state || "").toLowerCase();
                          const ok =
                            stateLower === "approved" ||
                            stateLower === "pending" ||
                            stateLower === "موافق عليه";
                          if (ok && ymd >= st && ymd <= en) return v as any;
                        }
                        return null;
                      })();

                      let workMin: number | null = null;
                      const eHM = tsd?.entry
                        ? fmtClock24(tsd.entry)
                        : rec?.E
                          ? fmtClock24(rec.E)
                          : "";
                      const sHM = tsd?.exit
                        ? fmtClock24(tsd.exit)
                        : rec?.S
                          ? fmtClock24(rec.S)
                          : "";
                      if (eHM && sHM) {
                        const et = dayjs(`${ymd}T${eHM}:00`);
                        const st = dayjs(`${ymd}T${sHM}:00`);
                        const diff = st.diff(et, "minute");
                        if (Number.isFinite(diff) && diff >= 0) workMin = diff;
                      } else if (tsd?.workMin != null) {
                        workMin = tsd.workMin;
                      }

                      let expectedMin: number | null = null;
                      if (!isFutureOrToday) {
                        if (sched.start && sched.end) {
                          const startMin = parseHmToMinutes(sched.start);
                          const endMin = parseHmToMinutes(sched.end);
                          if (
                            startMin != null &&
                            endMin != null &&
                            endMin > startMin
                          ) {
                            expectedMin = endMin - startMin;
                          }
                        } else if (tsd?.expectedMin != null) {
                          expectedMin = tsd.expectedMin;
                        }
                      }

                      let deltaMin: number | null = null;
                      // Use backend-computed deltaMin (missing hours only) when available.
                      // Backend already ignores today / future and only records early-leave
                      // minutes when entry was on time and exit was before schedule end.
                      const rawDelta =
                        typeof tsd?.deltaMin === "number"
                          ? tsd.deltaMin
                          : typeof (rec as any)?.deltaMin === "number"
                            ? (rec as any).deltaMin
                            : null;
                      if (!isFutureOrToday && rawDelta != null) {
                        deltaMin = normalizeDelta(rawDelta);
                      }
                      if (
                        deltaMin == null &&
                        !isFutureOrToday &&
                        sched.start &&
                        sched.end &&
                        hasES
                      ) {
                        const fallback = computeDeltaFromSchedule(
                          eHM || null,
                          sHM || null,
                          sched.start,
                          sched.end
                        );
                        if (fallback != null) deltaMin = fallback;
                      }

                      const attCode = (() => {
                        const allowed = new Set([
                          // Pure attendance / holiday-work codes only; leave codes are handled via overlay
                          "P",
                          "PM",
                          "PO",
                          "A",
                          "PT",
                          "PL",
                          "PH",
                          "PHF",
                          // Exception / special status codes
                          "NI",
                          "NO",
                          "MO",
                          "IP",
                        ]);
                        return allowed.has(rawMerged) ? rawMerged : "";
                      })();

                      const workedFullDay =
                        hasES && (deltaMin == null || deltaMin >= 0);

                      let centerCode = "";
                      // Holiday wins over everything (including leave/vacation): never paint AL over PH/PHF.
                      if (isHolidayDate) {
                        if (isHolidayByCode) {
                          centerCode = rawUp;
                        } else if (hasES) {
                          centerCode = workedFullDay ? "PHF" : "PH";
                        } else {
                          // Pure holiday (no punches, no explicit PH/PHF): colored column, empty code
                          centerCode = "";
                        }
                      } else if (isFri && hasES) {
                        centerCode = workedFullDay ? "PHF" : "PH";
                      } else if (leaveCodeFinal) {
                        centerCode = leaveCodeFinal;
                      } else if (onVacation && !isFri) {
                        centerCode = String((onVacation as any)?.type || "V").toUpperCase();
                      } else if (hasES) {
                        // Presence overrides raw 'A'; keep explicit PT/PL if provided
                        centerCode = attCode && attCode !== "A" ? attCode : "P";
                      } else if (attCode && !isFuture) {
                        centerCode = attCode === "A" && isHolidayDate ? "" : attCode;
                      }

                      if (
                        fpNotNeeded &&
                        !isFuture &&
                        !isHolidayDate &&
                        !leaveCodeFinal &&
                        !onVacation &&
                        !isFri
                      ) {
                        if (centerCode === "" || centerCode === "A") centerCode = "P";
                      }

                      let deltaForPmPo: number | null = null;
                      if (!isFutureOrToday) {
                        let computedDeltaForPmPo: number | null = null;
                        if (sched.start && sched.end && hasES && eHM && sHM) {
                          const entryMin = parseHmToMinutes(eHM);
                          const exitMin = parseHmToMinutes(sHM);
                          const startMin = parseHmToMinutes(sched.start);
                          const endMin = parseHmToMinutes(sched.end);
                          if (
                            entryMin != null &&
                            exitMin != null &&
                            startMin != null &&
                            endMin != null &&
                            exitMin > entryMin &&
                            endMin > startMin
                          ) {
                            computedDeltaForPmPo = (exitMin - entryMin) - (endMin - startMin);
                          }
                        }

                        const computedMeaningful =
                          computedDeltaForPmPo != null &&
                          Math.abs(computedDeltaForPmPo) > TOLERANCE_MINUTES;

                        if (computedMeaningful) {
                          // Prefer punch+schedule delta so PM/PO doesn't flicker when backend delta arrives as 0
                          deltaForPmPo = computedDeltaForPmPo;
                        } else if (typeof rawDelta === "number") {
                          deltaForPmPo = rawDelta;
                        } else {
                          deltaForPmPo = deltaMin;
                        }
                      }
                      const missingOverTol =
                        deltaForPmPo != null &&
                        deltaForPmPo < 0 &&
                        Math.abs(deltaForPmPo) > TOLERANCE_MINUTES;
                      const overtime = deltaForPmPo != null && deltaForPmPo > 0;
                      const presentLikeCodes = new Set(["", "P", "PT", "PL", "PM", "PO"]);
                      if (
                        !isFuture &&
                        !isHolidayDate &&
                        !leaveCodeFinal &&
                        !onVacation &&
                        !isFri &&
                        presentLikeCodes.has(centerCode)
                      ) {
                        if (missingOverTol) centerCode = "PM";
                        else if (overtime) centerCode = "PO";
                      }

                      if (isFuture && !leaveCodeFinal && !onVacation && !isHolidayDate) {
                        centerCode = "";
                      }

                      if (
                        isFri &&
                        centerCode &&
                        !["SL", "PH", "PHF"].includes(centerCode)
                      ) {
                        centerCode = "";
                      }

                      const leaveMeta = getLeaveMeta(centerCode);

                      // Background
                      let bg = APPLE.cellBg;
                      if (isHolidayDate) bg = APPLE.holidayBg;
                      if (isFri) bg = APPLE.fridayColumnBg;
                      if (leaveMeta)
                        bg = alpha(leaveMeta.color, isDark ? 0.48 : 0.34);
                      if (centerCode === "PHF")
                        bg = isDark ? alpha("#22c55e", 0.38) : "#50f858ff";
                      if (centerCode === "PH")
                        bg = isDark ? alpha("#f59e0b", 0.38) : "#fff3cd";
                      if (centerCode === "PT")
                        bg = isDark ? alpha("#06b6d4", 0.38) : "#e0f7fa";
                      if (centerCode === "PL")
                        bg = isDark ? alpha("#f97316", 0.34) : "#ffe8cc";
                      if (centerCode === "PO")
                        bg = isDark ? alpha("#16a34a", 0.26) : "#dcfce7";
                      if (centerCode === "PM")
                        bg = isDark ? alpha("#dc2626", 0.22) : "#fee2e2";

                      const leaveColors: Record<string, string> = {
                        AL: isDark
                          ? "rgba(59,130,246,0.28)"
                          : "rgba(59,130,246,0.18)",
                        SL: isDark
                          ? "rgba(239,68,68,0.30)"
                          : "rgba(239,68,68,0.20)",
                        EL: isDark
                          ? "rgba(245,158,11,0.30)"
                          : "rgba(245,158,11,0.20)",
                        UL: isDark
                          ? "rgba(107,114,128,0.30)"
                          : "rgba(107,114,128,0.16)",
                        ML: isDark
                          ? "rgba(236,72,153,0.28)"
                          : "rgba(236,72,153,0.18)",
                        XL: isDark
                          ? "rgba(139,92,246,0.28)"
                          : "rgba(139,92,246,0.18)",
                        B1: isDark
                          ? "rgba(20,184,166,0.28)"
                          : "rgba(20,184,166,0.18)",
                        B2: isDark
                          ? "rgba(250,204,21,0.28)"
                          : "rgba(250,204,21,0.18)",
                        HL: isDark
                          ? "rgba(124,58,237,0.28)"
                          : "rgba(124,58,237,0.18)",
                        BM: isDark
                          ? "rgba(96,165,250,0.30)"
                          : "rgba(96,165,250,0.20)",
                      };
                      if (leaveColors[centerCode]) {
                        bg = leaveColors[centerCode];
                      }

                      let border = `1px solid ${APPLE.border}`;
                      if (deltaForPmPo != null) {
                        if (deltaForPmPo < 0 && Math.abs(deltaForPmPo) > TOLERANCE_MINUTES) {
                          border = `2px solid ${isDark ? "#ef4444" : "#dc2626"}`;
                        } else if (deltaForPmPo > 0) {
                          border = `2px solid ${isDark ? "#22c55e" : "#16a34a"}`;
                        }
                      }

                      let textColor: any;
                      if (leaveMeta) textColor = "#111";
                      else if (centerCode === "PM") textColor = "error.main";
                      else if (centerCode === "A") textColor = "error.main";
                      else if (centerCode === "PO") textColor = "#16a34a";
                      else if (
                        centerCode === "P" ||
                        centerCode === "PT" ||
                        centerCode === "PHF"
                      )
                        textColor = "success.main";
                      else if (centerCode === "PL") textColor = "#b58900";

                      let pillTone: "positive" | "negative" | "neutral" =
                        "neutral";
                      let pillText = "";
                      if (
                        deltaForPmPo != null &&
                        deltaForPmPo !== 0 &&
                        Math.abs(deltaForPmPo) > TOLERANCE_MINUTES
                      ) {
                        pillText = fmtDelta(deltaForPmPo);
                        if (deltaForPmPo < 0) pillTone = "negative";
                        else if (deltaForPmPo > 0) pillTone = "positive";
                      }
                      if (isFri) {
                        pillText = "";
                        pillTone = "neutral";
                      }

                      const hasComment = !!(tsd?.comment && tsd.comment.trim());

                      return {
                        bg,
                        border,
                        isFri,
                        centerCode,
                        textColor,
                        hasComment,
                        pillText,
                        pillTone,
                        manualStar: /(^|\s)@manual:[A-Z]{1,3}\b/i.test(
                          String(tsd?.comment || "")
                        ),
                        disabled: isFuture,
                      };
                    };

                    const gridTemplateColumns = (() => {
                      const base = ["56px", "180px"];
                      const dayCols = dates.map(() => "1fr");
                      // single summary column for ±h only
                      const summary = ["56px"];
                      const leaveCols = leaveColumnOrder
                        .filter((code) => visibleLeaveSet.has(code))
                        .map(() => "70px");
                      const attendanceCols = attendanceColumnOrder
                        .filter((code) => visibleAttendanceSet.has(code))
                        .map(() => "70px");
                      return [
                        ...base,
                        ...dayCols,
                        ...summary,
                        ...leaveCols,
                        ...attendanceCols,
                      ].join(" ");
                    })();

                    const visibleRows = (() => {
                      const isAllowed = (row: any) => {
                        const empId = Number(row.id_emp);
                        const meta = empById.get(empId);
                        
                        // Use same logic as isActiveEmployee from employees.ts
                        const stateLike = (meta?.STATE ?? meta?.state ?? meta?.ACTIVE ?? meta?.active ?? meta?.Status ?? meta?.STATUS);
                        
                        let isActive = false; // Default to false, only show if explicitly active
                        if (typeof stateLike === 'boolean') {
                          isActive = stateLike;
                        } else if (typeof stateLike === 'number') {
                          isActive = stateLike === 1;
                        } else if (stateLike != null) {
                          const s = String(stateLike).trim().toLowerCase();
                          if (s === 'inactive' || s === 'false' || s === 'no' || s === '0') isActive = false;
                          else if (s === 'active' || s === 'true' || s === 'yes' || s === '1') isActive = true;
                        }

                        // Contract end date check
                        const endRaw = meta?.T_END ?? meta?.CONTRACT_END ?? meta?.contract_end ?? meta?.contractEnd;
                        if (endRaw) {
                          const d = new Date(String(endRaw));
                          if (!isNaN(d.getTime())) {
                            const today = new Date();
                            if (d.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) {
                              isActive = false;
                            }
                          }
                        }

                        // Only show if explicitly active
                        const result = isActive;
                        console.log(`[DEBUG] Employee ${empId} (${row.name}): active=${isActive}, show=${result}`);
                        console.log(`[DEBUG]   Meta STATE: ${meta?.STATE}, stateLike: ${stateLike}`);
                        return result;
                      };

                      const result = filtered2.filter((r: any) => isAllowed(r));
                      console.log('[DEBUG] Final visible employees count:', result.length);
                      return result;
                    })();

                    // Show only active employees (like PayrollPage shows all)
                    const fingerprintFilteredRows = visibleRows;

                    const visibleDiag = (() => {
                      let activeTrue = 0;
                      let activeFalse = 0;
                      let activeUnknown = 0;
                      for (const row of fingerprintFilteredRows as any[]) {
                        const meta = empById.get(row.id_emp);
                        const stateRaw = extractStateRaw(row) ?? meta?.state;
                        const p = parseLooseBoolean(stateRaw);
                        if (p === true) activeTrue++;
                        else if (p === false) activeFalse++;
                        else activeUnknown++;
                      }
                      return {
                        total: (fingerprintFilteredRows as any[])?.length ?? 0,
                        visible: (fingerprintFilteredRows as any[])?.length ?? 0,
                        activeTrue,
                        activeFalse,
                        activeUnknown,
                      };
                    })();

                    const totalsAgg = (() => {
                      const leaveCounts: Record<string, number> = {};
                      const attendanceCounts: Record<string, number> = {};
                      let deltaMinTotal = 0;
                      const today = dayjs().startOf("day");

                      visibleRows.forEach((row) => {
                        const aggRow = payrollAggByEmp.get(row.id_emp) || null;
                        const payrollMissing = getAggMissingMinutes(aggRow);
                        const hasPayrollMissing = payrollMissing > 0;
                        if (hasPayrollMissing) {
                          deltaMinTotal -= payrollMissing;
                        }
                        let fallbackDelta = 0;
                        const schedForRow = resolveScheduleFor(row.id_emp, row);
                        const byDate = new Map(row.days.map((day: any) => [day.date, day]));
                        dates.forEach((date) => {
                          const ymd = date.format("YYYY-MM-DD");
                          const tsd = tsByEmp.get(row.id_emp)?.get(ymd);
                          const rec = byDate.get(ymd);

                          const isFuture = date.isAfter(today, "day");
                          const isFriday = date.day() === 5;

                          const rawDelta =
                            typeof tsd?.deltaMin === "number"
                              ? tsd.deltaMin
                              : typeof rec?.deltaMin === "number"
                                ? (rec as any).deltaMin
                                : null;
                          let normalized =
                            rawDelta != null ? normalizeDelta(rawDelta) : null;
                          if (
                            normalized == null &&
                            schedForRow.start &&
                            schedForRow.end &&
                            (tsd?.entry || rec?.E) &&
                            (tsd?.exit || rec?.S)
                          ) {
                            const entryStr = tsd?.entry
                              ? fmtClock24(tsd.entry)
                              : rec?.E
                                ? fmtClock24(rec.E)
                                : null;
                            const exitStr = tsd?.exit
                              ? fmtClock24(tsd.exit)
                              : rec?.S
                                ? fmtClock24(rec.S)
                                : null;
                            if (entryStr && exitStr) {
                              normalized = computeDeltaFromSchedule(
                                entryStr,
                                exitStr,
                                schedForRow.start,
                                schedForRow.end
                              );
                            }
                          }
                          if (!hasPayrollMissing && !isFuture && normalized && normalized < 0) {
                            fallbackDelta += normalized;
                          }

                          const baseCell = cellFor(rec, date, row);
                          const centerCode = baseCell.centerCode;
                          const finalCode = finalLeaveCodeForDay(
                            row.id_emp,
                            ymd,
                            tsd,
                            rec as any
                          );

                          const dayUp = String((rec as any)?.j ?? tsd?.code ?? "").toUpperCase();
                          const isHoliday =
                            holidaysSet.has(ymd) ||
                            Boolean((tsd as any)?.isHoliday) ||
                            Boolean((rec as any)?.isHoliday) ||
                            dayUp === "PH" ||
                            dayUp === "PHF";
                          const isSick = /^(SL)$/i.test(finalCode || "");

                          if (finalCode && visibleLeaveSet.has(finalCode)) {
                            const shouldCountLeave = isSick || (!isHoliday && !isFriday);
                            if (shouldCountLeave && LEAVE_TYPES[finalCode as keyof typeof LEAVE_TYPES]) {
                              leaveCounts[finalCode] = (leaveCounts[finalCode] || 0) + 1;
                            }
                          }

                          if (centerCode && visibleAttendanceSet.has(centerCode)) {
                            if (ATTENDANCE_TYPES[centerCode as keyof typeof ATTENDANCE_TYPES]) {
                              attendanceCounts[centerCode] = (attendanceCounts[centerCode] || 0) + 1;
                            }
                          }
                        });
                        if (!hasPayrollMissing && fallbackDelta < 0) {
                          deltaMinTotal += fallbackDelta;
                        }
                      });

                      return { leaveCounts, attendanceCounts, deltaMinTotal };
                    })();

                    return (
                      <Box
                        sx={{
                          overflowX: "auto",
                          overflowY: "auto",
                          ...(isFullscreen
                            ? {
                                flex: 1,
                                minHeight: 0,
                              }
                            : { maxHeight: "70vh" }),
                        }}
                      >
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns,
                            alignItems: "stretch",
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 1,
                          }}
                          onMouseLeave={() => {
                            setHoveredRow(null);
                            setHoveredCol(null);
                          }}
                        >
                          {/* sticky headers */}
                          <Box
                            sx={{
                              p: 0.5,
                              bgcolor: APPLE.datePillBg,
                              position: "sticky",
                              top: 0,
                              left: 0,
                              zIndex: 400,
                              minWidth: 56,
                              maxWidth: 56,
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{ fontWeight: 700 }}
                            >
                              Emp#
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              p: 0.5,
                              bgcolor: APPLE.datePillBg,
                              position: "sticky",
                              top: 0,
                              left: 56,
                              zIndex: 400,
                              minWidth: 180,
                              maxWidth: 180,
                            }}
                            onMouseEnter={() => setHoveredRow(-1)}
                            onMouseLeave={() => setHoveredRow(null)}
                          >
                            <Typography
                              variant="caption"
                              sx={{ fontWeight: 700 }}
                            >
                              Employee Name
                            </Typography>
                          </Box>

                          {/* day headers */}
                          {dates.map((d) => {
                            const isFri = d.day() === 5;
                            const isToday = d.isSame(dayjs(), "day");
                            return (
                              <Box
                                key={d.format("YYYYMMDD")}
                                onMouseEnter={() => setHoveredCol(d.date())}
                                sx={{
                                  p: 0.5,
                                  textAlign: "center",
                                  borderLeft: `1px solid ${APPLE.border}`,
                                  position: "sticky",
                                  top: 0,
                                  zIndex: 400,
                                  bgcolor: isFri
                                    ? APPLE.fridayHeaderBg
                                    : APPLE.datePillBg,
                                  transition: "background-color 140ms ease, box-shadow 140ms ease",
                                  "& > *": { position: "relative", zIndex: 2 },
                                  boxShadow: isToday
                                    ? (theme) =>
                                        `inset 0 0 0 2px ${alpha(
                                          theme.palette.primary.main,
                                          theme.palette.mode === "dark" ? 0.95 : 0.95
                                        )}`
                                    : undefined,
                                  ...(hoveredCol === d.date()
                                    ? {
                                        "&::before": {
                                          content: '""',
                                          position: "absolute",
                                          top: 0,
                                          left: 0,
                                          right: 0,
                                          bottom: 0,
                                          backgroundColor: (theme: any) =>
                                            alpha(
                                              theme.palette.primary.main,
                                              theme.palette.mode === "dark" ? 0.22 : 0.14
                                            ),
                                          boxShadow: (theme: any) =>
                                            `inset 0 0 0 1px ${alpha(
                                              theme.palette.primary.main,
                                              theme.palette.mode === "dark" ? 0.38 : 0.28
                                            )}`,
                                          pointerEvents: "none",
                                          zIndex: 0,
                                        }
                                      }
                                    : {}),
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontWeight: 800,
                                    display: "block",
                                    letterSpacing: 0.4,
                                    color: isFri
                                      ? APPLE.fridayHeaderText
                                      : undefined,
                                  }}
                                >
                                  {d.format("ddd")}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontWeight: 700,
                                    color: isFri
                                      ? APPLE.fridayHeaderText
                                      : undefined,
                                  }}
                                >
                                  {d.format("D")}
                                </Typography>
                              </Box>
                            );
                          })}

                          {/* summary header: ±h only */}
                          <Box
                            sx={{
                              p: 0.5,
                              bgcolor: APPLE.datePillBg,
                              textAlign: "center",
                              position: "sticky",
                              top: 0,
                              zIndex: 3,
                            }}
                            onMouseEnter={() => setHoveredRow(-1)}
                            onMouseLeave={() => setHoveredRow(null)}
                          >
                            <Typography
                              variant="caption"
                              sx={{ fontWeight: 700 }}
                            >
                              −/+h
                            </Typography>
                          </Box>

                          {/* leave headers */}
                          {leaveColumnOrder
                            .filter((code) => visibleLeaveSet.has(code))
                            .map((code) => {
                              const meta = LEAVE_TYPES[code];
                              return (
                                <Box
                                  key={`head-${code}`}
                                  sx={{
                                    p: 0.5,
                                    textAlign: "center",
                                    borderLeft: `1px solid ${APPLE.border}`,
                                    position: "sticky",
                                    top: 0,
                                    zIndex: 3,
                                    bgcolor: alpha(
                                      meta.color,
                                      isDark ? 0.3 : 0.18
                                    ),
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontWeight: 800,
                                      display: "block",
                                      color: isDark
                                        ? "rgba(255,255,255,0.9)"
                                        : "rgba(0,0,0,0.82)",
                                    }}
                                  >
                                    {code}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontSize: 10,
                                      color: isDark
                                        ? "rgba(255,255,255,0.72)"
                                        : "rgba(0,0,0,0.6)",
                                    }}
                                  >
                                    {meta.label}
                                  </Typography>
                                </Box>
                              );
                            })}

                          {/* attendance headers */}
                          {attendanceColumnOrder
                            .filter((code) => visibleAttendanceSet.has(code))
                            .map((code) => {
                              const meta = ATTENDANCE_TYPES[code];
                              return (
                                <Box
                                  key={`head-att-${code}`}
                                  sx={{
                                    p: 0.5,
                                    textAlign: "center",
                                    borderLeft: `1px solid ${APPLE.border}`,
                                    position: "sticky",
                                    top: 0,
                                    zIndex: 3,
                                    bgcolor: alpha(
                                      meta.color,
                                      isDark ? 0.3 : 0.18
                                    ),
                                  }}
                                  onMouseEnter={() => setHoveredRow(-1)}
                                  onMouseLeave={() => setHoveredRow(null)}
                                >
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontWeight: 800,
                                      display: "block",
                                      color: isDark
                                        ? "rgba(255,255,255,0.9)"
                                        : "rgba(0,0,0,0.82)",
                                    }}
                                  >
                                    {code}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontWeight: 500,
                                      color: isDark
                                        ? "rgba(255,255,255,0.72)"
                                        : "rgba(0,0,0,0.6)",
                                    }}
                                  >
                                    {meta.label}
                                  </Typography>
                                </Box>
                              );
                            })}

                          {/* rows */}
                          {fingerprintFilteredRows.map((r) => {
                            const byDate = new Map(
                              r.days.map((d: any) => [d.date, d])
                            );
                            const schedRow = resolveScheduleFor(r.id_emp, r);
                            const fpNotNeededRow = isEmpFingerprintNotNeeded(r.id_emp, r);

                            const aggRow = payrollAggByEmp.get(r.id_emp) || null;
                            const missingMinTruth = getAggMissingMinutes(aggRow);

                            // aggregates
                            let deltaMinFallback = 0; // sum of negative deltaMin (missing minutes)
                            let workDaysTotal = 0;
                            let sickDaysTotal = 0;
                            const leaveCounts: Record<string, number> = {};
                            const attendanceCounts: Record<string, number> = {};
                            let debugDeltaCount = 0;

                            const today = dayjs().startOf("day");
                            dates.forEach((d) => {
                              const ymd = d.format("YYYY-MM-DD");
                              const tsd = tsByEmp.get(r.id_emp)?.get(ymd);
                              const rec = byDate.get(ymd);

                              const hasE = !!(tsd?.entry || rec?.E);
                              const hasS = !!(tsd?.exit || rec?.S);
                              const isFuture = d.isAfter(today, "day");
                              const isFriday = d.day() === 5;
                              const isHolidayBasic =
                                holidaysSet.has(ymd) ||
                                Boolean((tsd as any)?.isHoliday) ||
                                Boolean((rec as any)?.isHoliday);

                              const present = fpNotNeededRow
                                ? !isFuture && !isFriday && !isHolidayBasic
                                : hasE || hasS || !!tsd?.present;
                              if (present) workDaysTotal++;

                              // minutes (for optional fallback / debugging)
                              let workMin: number | null = null;
                              const eHM = tsd?.entry
                                ? fmtClock24(tsd.entry)
                                : rec?.E
                                  ? fmtClock24(rec.E)
                                  : "";
                              const sHM = tsd?.exit
                                ? fmtClock24(tsd.exit)
                                : rec?.S
                                  ? fmtClock24(rec.S)
                                  : "";
                              if (eHM && sHM) {
                                const et = dayjs(`${ymd}T${eHM}:00`);
                                const st = dayjs(`${ymd}T${sHM}:00`);
                                const diff = st.diff(et, "minute");
                                if (Number.isFinite(diff) && diff >= 0)
                                  workMin = diff;
                              } else if (tsd?.workMin != null) {
                                workMin = tsd.workMin;
                              }

                              // expected (from PS schedule or tsd.expectedMin)
                              let expectedMin: number | null = null;
                              // isFuture / isFriday declared above
                              // Only consider completed, non-Friday days in aggregates
                              if (!isFuture) {
                                if (schedRow.start && schedRow.end) {
                                  const startMin = parseHmToMinutes(schedRow.start);
                                  const endMin = parseHmToMinutes(schedRow.end);
                                  if (
                                    startMin != null &&
                                    endMin != null &&
                                    endMin > startMin
                                  ) {
                                    expectedMin = endMin - startMin;
                                  }
                                } else if (tsd?.expectedMin != null) {
                                  expectedMin = tsd.expectedMin;
                                }
                              }

                              // Use timesheet deltaMin when available (backend semantics).
                              // Do not recompute workMin-expectedMin here to avoid
                              // diverging from the source-of-truth missing-hours logic.
                              let deltaMin: number | null = null;
                              const rawDelta =
                                typeof tsd?.deltaMin === "number"
                                  ? tsd.deltaMin
                                  : typeof (rec as any)?.deltaMin === "number"
                                    ? (rec as any).deltaMin
                                    : null;
                              if (rawDelta != null) {
                                deltaMin = normalizeDelta(rawDelta);
                              }

                              if (
                                deltaMin == null &&
                                !isFuture &&
                                schedRow.start &&
                                schedRow.end &&
                                eHM &&
                                sHM
                              ) {
                                const fallback = computeDeltaFromSchedule(
                                  eHM,
                                  sHM,
                                  schedRow.start,
                                  schedRow.end
                                );
                                if (fallback != null) deltaMin = fallback;
                              }

                              if (deltaMin != null && deltaMin < 0) {
                                // Apply 30-minute tolerance like PayrollPage (line 2479)
                                const abs = Math.abs(deltaMin);
                                if (abs > 30) {
                                  deltaMinFallback += deltaMin; // deltaMin is negative
                                  debugDeltaCount++;
                                }
                              }

                              // Handle full absences (no punches, not leave/holiday) - ONLY if no payroll data
                              if (!fpNotNeededRow && deltaMin == null && !isFuture && expectedMin != null && !missingMinTruth) {
                                const hasPunches = Boolean(eHM) || Boolean(sHM);
                                const dayCode = String(tsd?.code || "").toUpperCase();
                                const treatedAsLeave = Boolean(dayCode && LEAVE_TYPES[dayCode as keyof typeof LEAVE_TYPES]);
                                const isHoliday = Boolean((tsd as any)?.isHoliday) || holidaysSet.has(ymd);
                                if (!hasPunches && !treatedAsLeave && !isHoliday && !isFriday) {
                                  deltaMinFallback -= expectedMin;
                                  debugDeltaCount++;
                                }
                              }

                              // counts
                              const baseCell = cellFor(rec, d, r);
                              const centerCode = baseCell.centerCode;

                              const finalCode = finalLeaveCodeForDay(
                                r.id_emp,
                                ymd,
                                tsd,
                                rec as any
                              );
                              const dayUp = String((rec as any)?.j ?? tsd?.code ?? "").toUpperCase();
                              const isHolidayForCounts =
                                holidaysSet.has(ymd) ||
                                Boolean((tsd as any)?.isHoliday) ||
                                Boolean((rec as any)?.isHoliday) ||
                                dayUp === "PH" ||
                                dayUp === "PHF";
                              const isSick = /^(SL)$/i.test(finalCode || "");

                              if (finalCode) {
                                const shouldCountLeave =
                                  isSick || (!isHolidayForCounts && !isFriday);
                                if (
                                  shouldCountLeave &&
                                  LEAVE_TYPES[
                                    finalCode as keyof typeof LEAVE_TYPES
                                  ]
                                ) {
                                  leaveCounts[finalCode] =
                                    (leaveCounts[finalCode] || 0) + 1;
                                }
                              }

                              if (
                                centerCode &&
                                ATTENDANCE_TYPES[
                                  centerCode as keyof typeof ATTENDANCE_TYPES
                                ]
                              ) {
                                attendanceCounts[centerCode] =
                                  (attendanceCounts[centerCode] || 0) + 1;
                              }
                              if (isSick) sickDaysTotal++;
                            });

                            console.log(`[DEBUG] Employee ${r.id_emp}: backendLatMin=${Number((aggRow as any)?.latencyMinutes ?? (aggRow as any)?.missing_minutes ?? 0)}, deltaMinFallback=${deltaMinFallback}, aggRow=`, aggRow);

                            // Calculate positive hours worked and missing hours separately
                            const monthlyStats = (() => {
                              let totalWorkedMinutes = 0;
                              let totalMissingMinutes = 0;
                              
                              dates.forEach((date) => {
                                const ymd = date.format("YYYY-MM-DD");
                                const tsd = tsByEmp.get(r.id_emp)?.get(ymd);
                                const rec = new Map(r.days.map((day: any) => [day.date, day])).get(ymd);
                                
                                if (tsd || rec) {
                                  const entryTime = tsd?.entry || rec?.E;
                                  const exitTime = tsd?.exit || rec?.S;
                                  const sched = resolveScheduleFor(r.id_emp, r);
                                  
                                  if (entryTime && exitTime && sched?.start && sched?.end) {
                                    const [entryH, entryM] = entryTime.split(':').map(Number);
                                    const [exitH, exitM] = exitTime.split(':').map(Number);
                                    const [schedStartH, schedStartM] = sched.start.split(':').map(Number);
                                    const [schedEndH, schedEndM] = sched.end.split(':').map(Number);
                                    
                                    const entryMinutes = entryH * 60 + entryM;
                                    const exitMinutes = exitH * 60 + exitM;
                                    const schedStartMinutes = schedStartH * 60 + schedStartM;
                                    const schedEndMinutes = schedEndH * 60 + schedEndM;
                                    
                                    const workedMinutes = Math.max(0, exitMinutes - entryMinutes);
                                    const scheduledMinutes = schedEndMinutes - schedStartMinutes;
                                    const dailyDelta = workedMinutes - scheduledMinutes;
                                    
                                    if (dailyDelta > 0) {
                                      totalWorkedMinutes += dailyDelta;
                                    } else if (dailyDelta < -30) { // Only count missing if more than 30 minutes
                                      totalMissingMinutes += Math.abs(dailyDelta);
                                    }
                                  }
                                }
                              });
                              
                              // Add backend missing minutes if available
                              const backendMissing = Number((v2Rows || []).find((x: any) => Number(x.id_emp) === Number(r.id_emp))?.latencyMinutes || 0);
                              if (backendMissing > 0) {
                                totalMissingMinutes += backendMissing;
                              }
                              
                              return { totalWorkedMinutes, totalMissingMinutes };
                            })();

                            // Format to show both positive and negative hours separately
                            const agg_delta_label = (() => {
                              const workedHours = Math.floor(monthlyStats.totalWorkedMinutes / 60);
                              const workedMins = Math.floor(monthlyStats.totalWorkedMinutes % 60);
                              const missingHours = Math.floor(monthlyStats.totalMissingMinutes / 60);
                              const missingMins = Math.floor(monthlyStats.totalMissingMinutes % 60);
                              
                              const parts = [];
                              if (workedHours > 0 || workedMins > 0) {
                                parts.push(`+${workedHours}h ${workedMins}m`);
                              }
                              if (missingHours > 0 || missingMins > 0) {
                                parts.push(`-${missingHours}h ${missingMins}m`);
                              }
                              
                              return parts.length > 0 ? parts.join(' ') : '';
                            })();
                            
                            const agg_delta_is_positive = monthlyStats.totalWorkedMinutes > 0;
                            const agg_delta_is_negative = monthlyStats.totalMissingMinutes > 0;

                            const agg_nbr_day = workDaysTotal;

                            return (
                              <React.Fragment key={r.id_emp}>
                                {/* sticky id */}
                                <Box
                                  sx={{
                                    p: 0.5,
                                    position: "sticky",
                                    left: 0,
                                    bgcolor: (theme) =>
                                      hoveredRow === r.id_emp
                                        ? alpha(
                                            theme.palette.primary.main,
                                            theme.palette.mode === "dark" ? 0.18 : 0.1
                                          )
                                        : theme.palette.background.paper,
                                    zIndex: 3,
                                    minWidth: 56,
                                    maxWidth: 56,
                                    borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                                    borderRight: (theme) => `1px solid ${theme.palette.divider}`,
                                    transition: "background-color 140ms ease",
                                  }}
                                  onMouseEnter={() => setHoveredRow(r.id_emp)}
                                >
                                  <Typography
                                    variant="caption"
                                    sx={{ fontWeight: 700 }}
                                  >
                                    {r.id_emp}
                                  </Typography>
                                </Box>

                                {/* sticky name */}
                                <Box
                                  sx={{
                                    p: 0.5,
                                    position: "sticky",
                                    left: 56,
                                    bgcolor: (theme) =>
                                      hoveredRow === r.id_emp
                                        ? alpha(
                                            theme.palette.primary.main,
                                            theme.palette.mode === "dark" ? 0.18 : 0.1
                                          )
                                        : theme.palette.background.paper,
                                    zIndex: 3,
                                    minWidth: 150,
                                    maxWidth: 170,
                                    borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                                    borderRight: (theme) => `1px solid ${theme.palette.divider}`,
                                    transition: "background-color 140ms ease",
                                  }}
                                  onMouseEnter={() => setHoveredRow(r.id_emp)}
                                >
                                  <Box
                                    sx={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 0.5,
                                    }}
                                  >
                                    {(() => {
                                      const meta = empById.get(r.id_emp);
                                      const stateRaw = extractStateRaw(r) ?? meta?.state;
                                      const isActive = parseLooseBoolean(stateRaw) === false ? false : true;

                                      return (
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                                          <Box
                                            title={isActive ? "Active" : "Inactive"}
                                            sx={{
                                              width: 8,
                                              height: 8,
                                              borderRadius: "50%",
                                              bgcolor: isActive ? "success.main" : "text.disabled",
                                              boxShadow: isActive
                                                ? (theme) => `0 0 0 3px ${alpha(theme.palette.success.main, 0.12)}`
                                                : "none",
                                            }}
                                          />
                                          {(() => {
                                            const fpRaw = extractFingerprintRaw(r) ?? meta?.FINGERPRINT_NEEDED;
                                            const needsFp = isEmpFingerprintNeeded(r.id_emp, r);
                                            return needsFp ? (
                                              <FingerprintIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                                            ) : null;
                                          })()}

                                          <Typography
                                            component={Link}
                                            to={buildEncryptedProfilePath(r.id_emp)}
                                            sx={{
                                              fontWeight: 800,
                                              color: "primary.main",
                                              textDecoration: "none",
                                              "&:hover": {
                                                textDecoration: "underline",
                                              },
                                            }}
                                          >
                                            {r.name || meta?.name || String(r.id_emp)}
                                          </Typography>
                                        </Box>
                                      );
                                    })()}

                                    {/* Hours in AM/PM */}
                                    {(() => {
                                      const sched = empSchedule.get(r.id_emp); // Map<number, {start: string; end: string}>
                                      if (sched?.start && sched?.end) {
                                        return (
                                          <Typography
                                            variant="caption"
                                            sx={(theme) => ({
                                              fontWeight: 700,
                                              fontSize: 11,
                                              color: theme.palette.mode === 'dark' ? '#fff' : '#000',
                                              letterSpacing: 0.1,
                                            })}
                                            title={`${sched.start} - ${sched.end}`} // raw as tooltip
                                          >
                                            {to12h(sched.start)} —{" "}
                                            {to12h(sched.end)}
                                          </Typography>
                                        );
                                      } else {
                                        // Fallback to raw row or preloaded employees list
                                        const meta = empById.get(r.id_emp);
                                        const rStart = (r as any)?.T_START || meta?.tStart || null;
                                        const rEnd = (r as any)?.T_END || meta?.tEnd || null;
                                        if (rStart && rEnd) {
                                          return (
                                            <Typography
                                              variant="caption"
                                              sx={(theme) => ({
                                                fontWeight: 700,
                                                fontSize: 11,
                                                color: theme.palette.mode === 'dark' ? '#fff' : '#000',
                                                letterSpacing: 0.1,
                                              })}
                                              title={`${rStart} - ${rEnd}`}
                                            >
                                              {to12h(rStart)} — {to12h(rEnd)}
                                            </Typography>
                                          );
                                        }
                                        return null;
                                      }
                                    })()}
                                  </Box>
                                </Box>

                                {/* day cells */}
                                {dates.map((d) => {
                                  const ymd = d.format("YYYY-MM-DD");
                                  const isToday = d.isSame(dayjs(), "day");
                                  const rec = byDate.get(ymd);
                                  const sty = cellFor(rec, d, r);                                
                                  // Calculate onVacation for this day
                                  const safeISO10 = (v: any): string => {
                                    if (!v) return "";
                                    const s = String(v).trim();
                                    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
                                    const dParsed = parseStartDateLocal(s);
                                    return dParsed && dParsed.isValid() ? dParsed.format("YYYY-MM-DD") : "";
                                  };
                                
                                const onVacation = (employeeVacations || []).find((v: any) => {
                                  const start = safeISO10(v.date_depart);
                                  const end = safeISO10(v.date_end);
                                  if (!start || !end) return false;
                                  const stateLower = (v.state || "").toLowerCase();
                                  const isValidState =
                                    stateLower === "approved" ||
                                    stateLower === "pending" ||
                                    stateLower === "موافق عليه";
                                  return ymd >= start && ymd <= end && isValidState && v.id_emp === r.id_emp;
                                });
                                  return (
                                    <Box
                                      key={`${r.id_emp}-${d.format("YYYYMMDD")}`}
                                      onClick={sty.disabled ? undefined : () =>
                                        openDetail(r, d, rec as any)
                                      }
                                      onMouseEnter={() => {
                                        setHoveredRow(r.id_emp);
                                        setHoveredCol(d.date());
                                      }}
                                      sx={{
                                        minHeight: 56,
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        bgcolor: sty.bg,
                                        border: sty.border,
                                        borderLeft: String(sty.border || "").startsWith("2px")
                                          ? undefined
                                          : `1px solid ${APPLE.border}`,
                                        boxShadow: isToday
                                          ? (theme) =>
                                              `inset 0 0 0 2px ${alpha(
                                                theme.palette.primary.main,
                                                theme.palette.mode === "dark" ? 0.5 : 0.32
                                              )}`
                                          : undefined,
                                        cursor: sty.disabled ? "default" : "pointer",
                                        p: 0.5,
                                        position: "relative",
                                        transition: "transform 120ms ease, box-shadow 140ms ease",
                                        "& > *": { position: "relative", zIndex: 1 },
                                        ...(hoveredRow === r.id_emp || hoveredCol === d.date()
                                          ? {
                                              "&::after": {
                                                content: '""',
                                                position: "absolute",
                                                inset: 0,
                                                backgroundColor: (theme: any) =>
                                                  alpha(
                                                    theme.palette.primary.main,
                                                    theme.palette.mode === "dark" ? 0.16 : 0.1
                                                  ),
                                                pointerEvents: "none",
                                                zIndex: 0,
                                              },
                                              boxShadow: (theme: any) =>
                                                `inset 0 0 0 1px ${alpha(
                                                  theme.palette.primary.main,
                                                  theme.palette.mode === "dark" ? 0.32 : 0.22
                                                )}`,
                                            }
                                          : {}),
                                      }}
                                    >
                                      {/* Punches removed per user request */}
                                      {(() => {
                                        const tsd = tsByEmp.get(r.id_emp)?.get(ymd);
                                        const entryPref: any = (tsd?.entry as any) || (rec?.E as any) || null;
                                        const exitPref: any = (tsd?.exit as any) || (rec?.S as any) || null;

                                        const extractTimeHHMM = (val: any): string => {
                                          if (!val) return "";
                                          const s = String(val);
                                          const m = s.match(/(\d{2}):(\d{2})/);
                                          return m ? `${m[1]}:${m[2]}` : "";
                                        };

                                        const entryTime = extractTimeHHMM(entryPref);
                                        const exitTime = extractTimeHHMM(exitPref);
                                        const sched = resolveScheduleFor(r.id_emp, r);
                                        
                                        // Auto-generate P punches for non-fingerprint employees on absent days
                                        const needsFp = isEmpFingerprintNeeded(r.id_emp, r);
                                        const isWorkingDay = !sty.isFri && !rec?.isHoliday && !onVacation;
                                        const hasRealPunches = Boolean(entryTime) || Boolean(exitTime);
                                        
                                        let autoEntryTime = "";
                                        let autoExitTime = "";
                                        
                                        if (!needsFp && !hasRealPunches && isWorkingDay && sched.start && sched.end) {
                                          autoEntryTime = sched.start;
                                          autoExitTime = sched.end;
                                        }
                                        
                                        let dailyDelta = 0;
                                        if ((entryTime || autoEntryTime) && (exitTime || autoExitTime) && sched.start && sched.end) {
                                          const entryMin = parseHmToMinutes(entryTime || autoEntryTime);
                                          const exitMin = parseHmToMinutes(exitTime || autoExitTime);
                                          const startMin = parseHmToMinutes(sched.start);
                                          const endMin = parseHmToMinutes(sched.end);
                                          
                                          if (entryMin != null && exitMin != null && startMin != null && endMin != null) {
                                            const worked = exitMin - entryMin;
                                            const expected = endMin - startMin;
                                            dailyDelta = worked - expected;
                                          }
                                        }

                                        return (
                                          <>
                                            {!(sty.centerCode === "PM" || sty.centerCode === "PO") && (
                                              <>
                                                {/* Punch In - top center (green text) */}
                                                {(entryTime || autoEntryTime) && (
                                                  <Box
                                                    sx={{
                                                      position: "absolute",
                                                      top: 2,
                                                      left: 0,
                                                      right: 0,
                                                      display: "flex",
                                                      justifyContent: "center",
                                                      pointerEvents: "none",
                                                      zIndex: 10,
                                                    }}
                                                  >
                                                    <Typography
                                                      sx={{
                                                        color: "#b7a27d",
                                                        fontSize: "8px",
                                                        fontWeight: 700,
                                                        textTransform: "uppercase",
                                                        px: 0.5,
                                                        py: 0.15,
                                                        borderRadius: 1,
                                                      }}
                                                    >
                                                      {entryTime || autoEntryTime}
                                                    </Typography>
                                                  </Box>
                                                )}

                                                {/* Punch Out - bottom center (green text) */}
                                                {(exitTime || autoExitTime) && (
                                                  <Box
                                                    sx={{
                                                      position: "absolute",
                                                      bottom: 2,
                                                      left: 0,
                                                      right: 0,
                                                      display: "flex",
                                                      justifyContent: "center",
                                                      pointerEvents: "none",
                                                      zIndex: 10,
                                                    }}
                                                  >
                                                    <Typography
                                                      sx={{
                                                        color: "#b7a27d",
                                                        fontSize: "8px",
                                                        fontWeight: 700,
                                                        textTransform: "uppercase",
                                                        px: 0.5,
                                                        py: 0.15,
                                                        borderRadius: 1,
                                                      }}
                                                    >
                                                      {exitTime || autoExitTime}
                                                    </Typography>
                                                  </Box>
                                                )}
                                              </>
                                            )}
                                          </>
                                        );
                                      })()}
                                      {sty.manualStar && (
                                        <Box
                                          sx={{
                                            position: "absolute",
                                            top: 2,
                                            right: 2,
                                            fontSize: 12,
                                            lineHeight: 1,
                                            fontWeight: 900,
                                            opacity: 0.9,
                                            userSelect: "none",
                                            zIndex: 50,
                                          }}
                                          aria-label="manual override"
                                          title="Manual code override"
                                        >
                                          ⭐
                                        </Box>
                                      )}

                                      {(!onlyAbsent ||
                                        sty.centerCode === "A" ||
                                        sty.centerCode === "X") && (
                                        <>
                                          <Box
                                            sx={{
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              gap: 0.6,
                                            }}
                                          >
                                            <Typography
                                              variant="body2"
                                              sx={{
                                                fontWeight: 800,
                                                lineHeight: 1.05,
                                                color: sty.textColor,
                                                fontSize:
                                                  sty.centerCode === "PM" || sty.centerCode === "PO" ? 12 : 16,
                                                transform:
                                                  sty.centerCode === "PM" || sty.centerCode === "PO"
                                                    ? "translateX(-2px)"
                                                    : undefined,
                                              }}
                                            >
                                              {sty.centerCode ||
                                                (sty.isFri ? "" : "\u00A0")}
                                            </Typography>

                                            {(sty.centerCode === "PM" || sty.centerCode === "PO") && (
                                              <>
                                                {(() => {
                                                  const tsd = tsByEmp.get(r.id_emp)?.get(ymd);
                                                  const entryPref: any =
                                                    (tsd?.entry as any) || (rec?.E as any) || null;
                                                  const exitPref: any =
                                                    (tsd?.exit as any) || (rec?.S as any) || null;

                                                  const extractTimeHHMM = (val: any): string => {
                                                    if (!val) return "";
                                                    const s = String(val);
                                                    const m = s.match(/(\d{2}):(\d{2})/);
                                                    return m ? `${m[1]}:${m[2]}` : "";
                                                  };

                                                  const entryTime = extractTimeHHMM(entryPref);
                                                  const exitTime = extractTimeHHMM(exitPref);
                                                  const sched = resolveScheduleFor(r.id_emp, r);
                                                  const needsFp = isEmpFingerprintNeeded(r.id_emp, r);
                                                  const isWorkingDay =
                                                    !sty.isFri && !rec?.isHoliday && !onVacation;
                                                  const hasRealPunches =
                                                    Boolean(entryTime) || Boolean(exitTime);

                                                  let autoEntryTime = "";
                                                  let autoExitTime = "";
                                                  if (
                                                    !needsFp &&
                                                    !hasRealPunches &&
                                                    isWorkingDay &&
                                                    sched.start &&
                                                    sched.end
                                                  ) {
                                                    autoEntryTime = sched.start;
                                                    autoExitTime = sched.end;
                                                  }

                                                  const e = entryTime || autoEntryTime;
                                                  const x = exitTime || autoExitTime;
                                                  if (!e && !x) return null;

                                                  return (
                                                    <Box
                                                      sx={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        alignItems: "flex-start",
                                                        minWidth: 34,
                                                        transform: "translateX(2px)",
                                                      }}
                                                    >
                                                      <Typography
                                                        sx={{
                                                          color: "#b7a27d",
                                                          fontSize: "8px",
                                                          fontWeight: 800,
                                                          textTransform: "uppercase",
                                                          lineHeight: 1,
                                                        }}
                                                      >
                                                        {e || "--"}
                                                      </Typography>
                                                      <Typography
                                                        sx={{
                                                          color: "#b7a27d",
                                                          fontSize: "8px",
                                                          fontWeight: 800,
                                                          textTransform: "uppercase",
                                                          lineHeight: 1,
                                                        }}
                                                      >
                                                        {x || "--"}
                                                      </Typography>
                                                    </Box>
                                                  );
                                                })()}
                                              </>
                                            )}
                                          </Box>

                                          {sty.pillText && (
                                            <Typography
                                              variant="caption"
                                              sx={{
                                                position: "absolute",
                                                bottom: 1,
                                                right: 1,
                                                px: 0.35,
                                                py: 0,
                                                fontSize: 8,
                                                lineHeight: 1,
                                                fontWeight: 800,
                                                color:
                                                  sty.pillTone === "negative"
                                                    ? "error.main"
                                                    : sty.pillTone ===
                                                        "positive"
                                                      ? "success.main"
                                                      : "text.secondary",
                                                bgcolor: isDark
                                                  ? "rgba(17,24,39,0.66)"
                                                  : "rgba(255,255,255,0.78)",
                                                borderRadius: 0.4,
                                              }}
                                            >
                                              {sty.pillText}
                                            </Typography>
                                          )}

                                          {sty.hasComment && (
                                            <Box
                                              sx={{
                                                position: "absolute",
                                                bottom: 2,
                                                left: 2,
                                                width: 6,
                                                height: 6,
                                                borderRadius: "50%",
                                                bgcolor: "info.main",
                                              }}
                                            />
                                          )}

                                          {/* Bottom: Check-in/Check-out times */}
                                          {/* Punches removed per user request */}
                                        </>
                                      )}
                                    </Box>
                                  );
                                })}

                                {/* summary cells */}
                                <Box
                                  sx={{
                                    minHeight: 56,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderLeft: `1px solid ${APPLE.border}`,
                                    cursor: agg_delta_label
                                      ? "pointer"
                                      : "default",
                                    "&:hover": {
                                      bgcolor: agg_delta_label
                                        ? "action.hover"
                                        : "transparent",
                                    },
                                  }}
                                  onMouseEnter={() => setHoveredRow(r.id_emp)}
                                  onMouseLeave={() => setHoveredRow(null)}
                                  onClick={() => {
                                    if (agg_delta_label) {
                                      showTimeLog(r, dates?.[0] || dayjs());
                                    }
                                  }}
                                >
                                  {!!agg_delta_label && (
                                    <Tooltip title="Click to view detailed time log">
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          fontWeight: 800,
                                          color: agg_delta_is_positive
                                            ? "success.main"
                                            : agg_delta_is_negative
                                              ? "error.main"
                                              : "text.secondary",
                                          textDecoration: "underline",
                                          textUnderlineOffset: "2px",
                                          "&:hover": {
                                            textDecoration: "underline",
                                          },
                                        }}
                                      >
                                        {agg_delta_label}
                                      </Typography>
                                    </Tooltip>
                                  )}
                                </Box>

                                {/* leave counts */}
                                {leaveColumnOrder
                                  .filter((code) => visibleLeaveSet.has(code))
                                  .map((code) => {
                                    const count = leaveCounts[code] || 0;
                                    const meta = LEAVE_TYPES[code];
                                    const shadeColor = meta?.color || "#94a3b8";
                                    return (
                                      <Box
                                        key={`${r.id_emp}-leave-${code}`}
                                        sx={{
                                          minHeight: 56,
                                          minWidth: 70,
                                          maxWidth: 70,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          borderLeft: `1px solid ${APPLE.border}`,
                                          borderRight: (theme) => `1px solid ${theme.palette.divider}`,
                                          bgcolor: count
                                            ? alpha(
                                                shadeColor,
                                                isDark ? 0.32 : 0.18
                                              )
                                            : "transparent",
                                        }}
                                        onMouseEnter={() => setHoveredRow(r.id_emp)}
                                        onMouseLeave={() => setHoveredRow(null)}
                                      >
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            fontWeight: 700,
                                            color:
                                              count > 0
                                                ? isDark
                                                  ? "rgba(255,255,255,0.92)"
                                                  : "rgba(0,0,0,0.82)"
                                                : "text.disabled",
                                          }}
                                        >
                                          {count}
                                        </Typography>
                                      </Box>
                                    );
                                  })}

                                {/* attendance counts */}
                                {attendanceColumnOrder
                                  .filter((code) =>
                                    visibleAttendanceSet.has(code)
                                  )
                                  .map((code) => {
                                    const count = attendanceCounts[code] || 0;
                                    const meta = ATTENDANCE_TYPES[code];
                                    const shadeColor = meta?.color || "#94a3b8";
                                    return (
                                      <Box
                                        key={`${r.id_emp}-att-${code}`}
                                        sx={{
                                          minHeight: 56,
                                          minWidth: 70,
                                          maxWidth: 70,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          borderLeft: `1px solid ${APPLE.border}`,
                                          borderRight: (theme) => `1px solid ${theme.palette.divider}`,
                                          bgcolor: count
                                            ? alpha(
                                                shadeColor,
                                                isDark ? 0.32 : 0.18
                                              )
                                            : "transparent",
                                        }}
                                        onMouseEnter={() => setHoveredRow(r.id_emp)}
                                        onMouseLeave={() => setHoveredRow(null)}
                                      >
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            fontWeight: 700,
                                            color:
                                              count > 0
                                                ? isDark
                                                  ? "rgba(255,255,255,0.92)"
                                                  : "rgba(0,0,0,0.82)"
                                                : "text.disabled",
                                          }}
                                        >
                                          {count}
                                        </Typography>
                                      </Box>
                                    );
                                  })}
                              </React.Fragment>
                            );
                          })}

                          <React.Fragment key="__totals__">
                            <Box
                              sx={{
                                p: 0.5,
                                position: "sticky",
                                bottom: 0,
                                left: 0,
                                bgcolor: "background.paper",
                                zIndex: 4,
                                minWidth: 56,
                                maxWidth: 56,
                                borderTop: (theme) => `2px solid ${theme.palette.divider}`,
                                borderRight: (theme) => `1px solid ${theme.palette.divider}`,
                              }}
                            />
                            <Box
                              sx={{
                                p: 0.5,
                                position: "sticky",
                                bottom: 0,
                                left: 56,
                                bgcolor: "background.paper",
                                zIndex: 4,
                                minWidth: 180,
                                maxWidth: 180,
                                borderTop: (theme) => `2px solid ${theme.palette.divider}`,
                                borderRight: (theme) => `1px solid ${theme.palette.divider}`,
                              }}
                            >
                              <Typography variant="caption" sx={{ fontWeight: 900 }}>
                                TOTAL
                              </Typography>
                            </Box>

                            {dates.map((d) => (
                              <Box
                                key={`tot-${d.format("YYYYMMDD")}`}
                                sx={{
                                  p: 0.5,
                                  textAlign: "center",
                                  borderLeft: `1px solid ${APPLE.border}`,
                                  position: "sticky",
                                  bottom: 0,
                                  zIndex: 2,
                                  bgcolor: "background.paper",
                                  borderTop: (theme) => `2px solid ${theme.palette.divider}`,
                                }}
                              />
                            ))}

                            <Box
                              sx={{
                                p: 0.5,
                                textAlign: "center",
                                position: "sticky",
                                bottom: 0,
                                zIndex: 2,
                                bgcolor: "background.paper",
                                borderTop: (theme) => `2px solid ${theme.palette.divider}`,
                              }}
                            >
                              <Typography variant="caption" sx={{ fontWeight: 900 }}>
                                {totalsAgg.deltaMinTotal !== 0
                                  ? roundedHoursWithSign(totalsAgg.deltaMinTotal)
                                  : ""}
                              </Typography>
                            </Box>

                            {leaveColumnOrder
                              .filter((code) => visibleLeaveSet.has(code))
                              .map((code) => (
                                <Box
                                  key={`tot-leave-${code}`}
                                  sx={{
                                    p: 0.5,
                                    textAlign: "center",
                                    borderLeft: `1px solid ${APPLE.border}`,
                                    position: "sticky",
                                    bottom: 0,
                                    zIndex: 2,
                                    bgcolor: "background.paper",
                                    borderTop: (theme) => `2px solid ${theme.palette.divider}`,
                                  }}
                                >
                                  <Typography variant="caption" sx={{ fontWeight: 800 }}>
                                    {totalsAgg.leaveCounts[code] || 0}
                                  </Typography>
                                </Box>
                              ))}

                            {attendanceColumnOrder
                              .filter((code) => visibleAttendanceSet.has(code))
                              .map((code) => (
                                <Box
                                  key={`tot-att-${code}`}
                                  sx={{
                                    p: 0.5,
                                    textAlign: "center",
                                    borderLeft: `1px solid ${APPLE.border}`,
                                    position: "sticky",
                                    bottom: 0,
                                    zIndex: 2,
                                    bgcolor: "background.paper",
                                    borderTop: (theme) => `2px solid ${theme.palette.divider}`,
                                  }}
                                >
                                  <Typography variant="caption" sx={{ fontWeight: 800 }}>
                                    {totalsAgg.attendanceCounts[code] || 0}
                                  </Typography>
                                </Box>
                              ))}
                          </React.Fragment>
                        </Box>
                      </Box>
                    );
                  })()}
                </Box>
              )}
            </Box>
          </CardContent>
          </Card>

          <Dialog
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Settings</DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography sx={{ fontWeight: 700, mb: 1 }}>Filters</Typography>
                  <TextField
                    label="Search Employee"
                    value={empFilter}
                    onChange={(e) => setEmpFilter(e.target.value)}
                    size="small"
                    fullWidth
                    sx={{ mb: 1 }}
                  />
                <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                  <InputLabel>PS Filter</InputLabel>
                  <Select
                    label="PS Filter"
                    value={psFilter}
                    onChange={(e) => setPsFilter((e.target.value as string) || '')}
                  >
                    <MenuItem value="">All PS</MenuItem>
                    {psOptions.map((ps) => {
                      const code = (ps.code_point ?? `P${ps.Id_point}`).toUpperCase();
                      return (
                        <MenuItem key={ps.Id_point} value={code}>
                          {code} — {ps.name_point}
                        </MenuItem>
                      );
                    })}
                    <MenuItem value="OG">OG</MenuItem>
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={<Checkbox checked={onlyAbsent} onChange={(e) => setOnlyAbsent(e.target.checked)} />}
                  label="Only Absent"
                />
                <FormControlLabel
                  control={<Checkbox checked={onlyOnLeave} onChange={(e) => setOnlyOnLeave(e.target.checked)} />}
                  label="Only On Leave"
                />
                <FormControlLabel
                  control={<Checkbox checked={onlyHolidayWorked} onChange={(e) => setOnlyHolidayWorked(e.target.checked)} />}
                  label="Only Holiday Worked"
                />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, mb: 1 }}>Columns</Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>Attendance</Typography>
                {attendanceColumnOrder.map((code) => (
                  <FormControlLabel
                    key={`att-col-${code}`}
                    control={
                      <Checkbox
                        checked={visibleAttendanceSet.has(code)}
                        onChange={(e) => {
                          const next = new Set(visibleAttendanceSet);
                          if (e.target.checked) next.add(code);
                          else next.delete(code);
                          setVisibleAttendanceColumns(Array.from(next));
                        }}
                      />
                    }
                    label={`${code} — ${ATTENDANCE_TYPES[code].label}`}
                  />
                ))}
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mt: 1, mb: 0.5 }}>Leave</Typography>
                {leaveColumnOrder.map((code) => (
                  <FormControlLabel
                    key={`leave-col-${code}`}
                    control={
                      <Checkbox
                        checked={visibleLeaveSet.has(code)}
                        onChange={(e) => {
                          const next = new Set(visibleLeaveSet);
                          if (e.target.checked) next.add(code);
                          else next.delete(code);
                          setVisibleLeaveColumns(Array.from(next));
                        }}
                      />
                    }
                    label={`${code} — ${LEAVE_TYPES[code].label}`}
                  />
                ))}
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSettingsOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={exportOpen}
          onClose={closeExportDialog}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>
            {t("hr.timesheets.exportDialogTitle") || "Export Timesheets"}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
              <FormControl component="fieldset">
                <FormLabel component="legend">
                  {t("hr.timesheets.exportMode") || "Export Mode"}
                </FormLabel>
                <RadioGroup
                  row
                  value={exportMode}
                  onChange={handleExportModeChange}
                >
                  <FormControlLabel
                    value="single"
                    control={<Radio />}
                    label={t("hr.timesheets.exportSingle") || "Single Employee"}
                  />
                  <FormControlLabel
                    value="all"
                    control={<Radio />}
                    label={
                      t("hr.timesheets.exportAllEmployees") || "All Employees"
                    }
                  />
                </RadioGroup>
              </FormControl>

              {exportMode === "single" && (
                <Grid container spacing={2}>
                  <Grid>
                    <FormControl fullWidth>
                      <InputLabel>PS Filter</InputLabel>
                      <Select
                        value={psFilter}
                        onChange={(e) => setPsFilter((e.target.value as string) || '')}
                        label="PS Filter"
                      >
                        <MenuItem value="">All PS</MenuItem>
                        {psOptions.map((ps) => {
                          const code = (ps.code_point ?? `P${ps.Id_point}`).toUpperCase();
                          return (
                            <MenuItem key={ps.Id_point} value={code}>
                              {code} — {ps.name_point}
                            </MenuItem>
                          );
                        })}
                        <MenuItem value="OG">OG</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid>
                    <FormControl fullWidth>
                      <InputLabel>Employee</InputLabel>
                      <Select
                        value={exportEmployeeId || ''}
                        onChange={(e) => {
                          const selectedId = Number(e.target.value);
                          setExportEmployeeId(isNaN(selectedId) ? null : selectedId);
                          const selected = employees.find(emp => emp.id === selectedId);
                          if (selected) setEmployeeName(selected.name);
                        }}
                        label="Employee"
                        disabled={employees.length === 0}
                      >
                        {employees.length === 0 ? (
                          <MenuItem disabled>No employees found</MenuItem>
                        ) : (
                          employees.map((emp) => (
                            <MenuItem key={emp.id} value={emp.id}>
                              {emp.name}
                            </MenuItem>
                          ))
                        )}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              )}

              {/* Export period selection */}
              <FormControl component="fieldset" fullWidth>
                <FormLabel component="legend">Export Period</FormLabel>
                <RadioGroup
                  value={exportPeriod}
                  onChange={(e) => setExportPeriod(e.target.value as any)}
                >
                  <FormControlLabel value="month" control={<Radio size="small"/>} label="Specific Month" />
                  <FormControlLabel value="year" control={<Radio size="small"/>} label="Full Year" />
                  <FormControlLabel value="ytd" control={<Radio size="small"/>} label="Year to Date (Jan 1 - Today)" />
                  <FormControlLabel value="custom" control={<Radio size="small"/>} label="Custom Range" />
                </RadioGroup>
              </FormControl>
              
              {/* Month/Year selection for non-custom periods */}
              {exportPeriod !== 'custom' && (
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                  {exportPeriod === 'month' && (
                    <TextField
                      select
                      label={t("hr.timesheets.month") || "Month"}
                      value={exportMonth}
                      onChange={(event) =>
                        handleExportMonthChange(
                          event as unknown as SelectChangeEvent
                        )
                      }
                      fullWidth
                    >
                      {months.map((m) => (
                        <MenuItem key={m.value} value={m.value}>
                          {m.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                  <TextField
                    select
                    label={t("hr.timesheets.year") || "Year"}
                    value={exportYear}
                    onChange={(event) =>
                      handleExportYearChange(
                        event as unknown as SelectChangeEvent
                      )
                    }
                    fullWidth
                  >
                    {years.map((y) => (
                      <MenuItem key={y} value={y}>
                        {y}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
              )}
              
              {/* Custom Date Range Pickers */}
              {exportPeriod === 'custom' && (
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                  <TextField
                    type="date"
                    label="Start Date"
                    value={exportStartDate?.format('YYYY-MM-DD') || ''}
                    onChange={(e) => setExportStartDate(dayjs(e.target.value))}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                  <TextField
                    type="date"
                    label="End Date"
                    value={exportEndDate?.format('YYYY-MM-DD') || ''}
                    onChange={(e) => setExportEndDate(dayjs(e.target.value))}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                </Box>
              )}
              </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeExportDialog} disabled={exportLoading}>
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button
              variant="contained"
              onClick={handleExportSubmit}
              disabled={exportLoading}
            >
              {exportLoading ? (
                <CircularProgress size={18} />
              ) : (
                t("hr.timesheets.export") || "Export"
              )}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Edit Day</DialogTitle>
          <DialogContent>
            {editError && (
              <Alert severity="error" sx={{ mb: 1 }}>
                {editError}
              </Alert>
            )}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 2,
                mt: 1,
              }}
            >
              <TextField
                label="Status"
                value={editJ}
                onChange={(e) => setEditJ(e.target.value)}
                fullWidth
              />
              <TextField
                label="Reason"
                value={editR}
                onChange={(e) => setEditR(e.target.value)}
                fullWidth
              />
            </Box>
            <Box sx={{ mt: 2 }}>
              <TextField
                label="Comment"
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              disabled={editSaving || !editDay}
              onClick={saveEdit}
            >
              {editSaving ? (
                <CircularProgress size={18} />
              ) : (
                t("common.save") || "Save"
              )}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          fullWidth
          sx={{
            zIndex: 6000
          }}
          maxWidth="md"
        >
          <DialogTitle sx={{ pr: 6, position: "relative" }}>
            {t("hr.timesheets.dayDetails") || "Day Details"}
            <IconButton
              aria-label={t("common.close") || "Close"}
              onClick={() => setDetailOpen(false)}
              sx={{ position: "absolute", right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {detailData && (
              <Box>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 2,
                    mb: 3,
                  }}
                >
                  <Info
                    label={t("hr.timesheets.employee") || "Employee"}
                    value={`${detailData.name} (#${detailData.id_emp})`}
                  />
                  <Info
                    label={t("hr.timesheets.date") || "Date"}
                    value={dayjs(detailData.date).format("DD-MM-YYYY")}
                  />
                  <Info
                    label={t("hr.timesheets.status") || "Status"}
                    value={detailData.j || "-"}
                  />
                  <Info
                    label={t("hr.timesheets.psOptional") || "PS"}
                    value={detailData.psName || "-"}
                  />
                  <Info
                    label={t("hr.timesheets.in") || "In (E)"}
                    value={detailData.E ? fmtClock24(detailData.E) : "-"}
                  />
                  <Info
                    label={t("hr.timesheets.out") || "Out (S)"}
                    value={detailData.S ? fmtClock24(detailData.S) : "-"}
                  />
                </Box>

                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                  {t("common.edit") || "Edit"}
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 2,
                  }}
                >
                  <TextField
                    select
                    label={
                      isLeaveCode(editJ)
                        ? t("hr.timesheets.vacationType") || "Vacation Type"
                        : t("hr.timesheets.status") || "Status"
                    }
                    value={editJ}
                    onChange={(e) => setEditJ(e.target.value)}
                    size="small"
                    fullWidth
                  >
                    {JUSTIFICATION_CODES.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 2,
                    mt: 2,
                  }}
                >
                  <TextField
                    type="time"
                    label={t("hr.timesheets.punchIn") || "Punch In"}
                    value={editE || ""}
                    onChange={(e) => setEditE(e.target.value)}
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ step: 60 }}
                  />
                  <TextField
                    type="time"
                    label={t("hr.timesheets.punchOut") || "Punch Out"}
                    value={editS || ""}
                    onChange={(e) => setEditS(e.target.value)}
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ step: 60 }}
                  />
                </Box>
                <Box sx={{ mt: 2 }}>
                  <TextField
                    label={t("common.comment") || "Comment"}
                    value={editComment}
                    onChange={(e) => setEditComment(e.target.value)}
                    size="small"
                    fullWidth
                    multiline
                    minRows={2}
                  />
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              disabled={editSaving || !detailData}
              onClick={async () => {
                if (!detailData) return;
                try {
                  setEditSaving(true);
                  setEditError(null);

                  const toIsoLocal = (ymd: string, hm: string | null) => {
                    if (!hm) return null;
                    const s = hm.length === 5 ? `${hm}:00` : hm; // 'HH:mm' -> 'HH:mm:ss'
                    return s; // backend expects time only (if it expects ISO, keep ymd+'T'+s)
                  };

                  await updateAttendance({
                    employeeId: detailData.id_emp,
                    date: detailData.date,
                    statusCode: editJ
                      ? String(editJ).trim().toUpperCase()
                      : undefined,
                    comment: editComment || undefined,
                    reason: editR || undefined,
                    entry: toIsoLocal(detailData.date, editE),
                    exit: toIsoLocal(detailData.date, editS),
                  });

                  // refresh + close
                  if (rangeFrom) {
                    const rf = rangeFrom.format("YYYY-MM-DD");
                    const rt = dayjs().add(2, "weeks").format("YYYY-MM-DD");
                    const data = await rangePunches(rf, rt, {
                      employeeId: detailData.id_emp,
                    });
                    const updated = data.employees?.[0];
                    if (updated) {
                      setRangeResults((prev) =>
                        prev
                          ? prev.map((e) =>
                              e.id_emp === updated.id_emp ? updated : e
                            )
                          : [updated]
                      );
                    }
                  }
                  setDetailOpen(false);
                } catch (e: any) {
                  setEditError(e?.message || "Failed to save");
                } finally {
                  setEditSaving(false);
                }
              }}
            >
              {editSaving ? (
                <CircularProgress size={18} />
              ) : (
                t("common.save") || "Save"
              )}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Leave Ledger Export Dialog */}
        <Dialog
          open={leaveLedgerDialogOpen}
          onClose={() => setLeaveLedgerDialogOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>
            {t("hr.timesheets.exportLeaveLedger") || "Export Leave Ledger"}
          </DialogTitle>
          <DialogContent>
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1 }}
            >
              <FormControl component="fieldset">
                <FormLabel component="legend">
                  {t("hr.timesheets.exportMode") || "Export Mode"}
                </FormLabel>
                <RadioGroup
                  row
                  value={leaveLedgerMode}
                  onChange={(e) => {
                    const mode = e.target.value as "single" | "all";
                    setLeaveLedgerMode(mode);
                    if (mode === "single" && !leaveLedgerEmployeeId) {
                      setLeaveLedgerEmployeeId(
                        employeeId ||
                          (employees.length ? employees[0].id : null)
                      );
                    }
                  }}
                >
                  <FormControlLabel
                    value="single"
                    control={<Radio />}
                    label={t("hr.timesheets.exportSingle") || "Single Employee"}
                  />
                  <FormControlLabel
                    value="all"
                    control={<Radio />}
                    label={
                      t("hr.timesheets.exportAllEmployees") || "All Employees"
                    }
                  />
                </RadioGroup>
              </FormControl>

              {leaveLedgerMode === "single" && (
                <TextField
                  select
                  label={t("hr.timesheets.employee") || "Employee"}
                  value={leaveLedgerEmployeeId ?? ""}
                  onChange={(e) =>
                    setLeaveLedgerEmployeeId(Number(e.target.value))
                  }
                  fullWidth
                >
                  {employees.map((emp) => (
                    <MenuItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              <TextField
                select
                label={t("hr.timesheets.year") || "Year"}
                value={leaveLedgerYear}
                onChange={(e) => setLeaveLedgerYear(Number(e.target.value))}
                fullWidth
              >
                {years.map((y) => (
                  <MenuItem key={y} value={y}>
                    {y}
                  </MenuItem>
                ))}
              </TextField>

              <FormControl component="fieldset">
                <FormLabel component="legend">
                  {t("hr.timesheets.period") || "Period"}
                </FormLabel>
                <RadioGroup
                  row
                  value={leaveLedgerPeriod}
                  onChange={(e) => setLeaveLedgerPeriod(e.target.value as "month" | "ytd")}
                >
                  <FormControlLabel
                    value="month"
                    control={<Radio />}
                    label={t("hr.timesheets.periodMonthOnly") || "Selected Month Only"}
                  />
                  <FormControlLabel
                    value="ytd"
                    control={<Radio />}
                    label={t("hr.timesheets.periodYtd") || "Year to Date (Jan 1 → Today)"}
                  />
                </RadioGroup>
              </FormControl>

              {leaveLedgerPeriod === "month" && (
                <TextField
                  select
                  label={t("hr.timesheets.month") || "Month"}
                  value={leaveLedgerMonth}
                  onChange={(e) => setLeaveLedgerMonth(Number(e.target.value))}
                  fullWidth
                >
                  {MONTHS.map((m, idx) => (
                    <MenuItem key={idx + 1} value={idx + 1}>
                      {m}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setLeaveLedgerDialogOpen(false)}
              disabled={leaveLedgerLoading}
            >
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button
              variant="contained"
              onClick={async () => {
                if (leaveLedgerMode === "single" && !leaveLedgerEmployeeId) {
                  showToast("Please select an employee", "warning");
                  return;
                }

                try {
                  setLeaveLedgerLoading(true);

                  if (leaveLedgerMode === "single" && leaveLedgerEmployeeId) {
                    await generateEmployeeLeaveLedgerPdf(
                      leaveLedgerEmployeeId,
                      leaveLedgerYear,
                      leaveLedgerPeriod === "month"
                        ? { monthOnly: true, endMonth: leaveLedgerMonth }
                        : { monthOnly: false }
                    );
                  } else if (leaveLedgerMode === "all") {
                    // Generate for all employees
                    let successCount = 0;
                    let errorCount = 0;

                    for (const emp of employees) {
                      try {
                        await generateEmployeeLeaveLedgerPdf(
                          emp.id,
                          leaveLedgerYear,
                          leaveLedgerPeriod === "month"
                            ? { monthOnly: true, endMonth: leaveLedgerMonth }
                            : { monthOnly: false }
                        );
                        successCount++;
                        // Add a small delay between PDFs to avoid overwhelming the browser
                        await new Promise((resolve) =>
                          setTimeout(resolve, 500)
                        );
                      } catch (err) {
                        console.error(
                          `Failed to generate PDF for employee ${emp.id}:`,
                          err
                        );
                        errorCount++;
                      }
                    }

                    if (errorCount > 0) {
                      showToast(
                        `Generated ${successCount} PDFs, ${errorCount} failed`,
                        "warning"
                      );
                    }
                  }

                  showToast("Leave ledger exported successfully", "success");
                  setLeaveLedgerDialogOpen(false);
                } catch (err) {
                  console.error("Failed to export leave ledger:", err);
                  showToast(
                    err instanceof Error
                      ? err.message
                      : "Failed to export leave ledger",
                    "error"
                  );
                } finally {
                  setLeaveLedgerLoading(false);
                }
              }}
              disabled={leaveLedgerLoading}
            >
              {leaveLedgerLoading ? (
                <CircularProgress size={18} />
              ) : (
                t("hr.timesheets.export") || "Export"
              )}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={schedDialogOpen}
          onClose={() => setSchedDialogOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>
            {t("hr.timesheets.scheduleSettings") || "Schedule Settings"} —{" "}
            {schedDialogEmpName}
          </DialogTitle>
          <DialogContent>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 2,
                mt: 2,
              }}
            >
              <TextField
                type="time"
                label={t("hr.timesheets.startTime") || "Start Time"}
                value={schedDialogStart}
                onChange={(e) => setSchedDialogStart(e.target.value)}
                fullWidth
                inputProps={{ step: 60 }}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                type="time"
                label={t("hr.timesheets.endTime") || "End Time"}
                value={schedDialogEnd}
                onChange={(e) => setSchedDialogEnd(e.target.value)}
                fullWidth
                inputProps={{ step: 60 }}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSchedDialogOpen(false)}>
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button
              variant="contained"
              onClick={async () => {
                if (schedDialogEmpId == null) return;
                try {
                  setEmpSchedule((prev) => {
                    const next = new Map(prev);
                    const previous = next.get(schedDialogEmpId);
                    next.set(schedDialogEmpId, {
                      ...(previous ?? {}),
                      start: schedDialogStart,
                      end: schedDialogEnd,
                    });
                    return next;
                  });
                  await updateEmployeeTimes(schedDialogEmpId, {
                    T_START: formatTimeForApi(schedDialogStart),
                    T_END: formatTimeForApi(schedDialogEnd),
                  });
                  setSchedDialogOpen(false);
                } catch (err) {
                  console.error("Failed to save schedule:", err);
                }
              }}
            >
              {t("common.save") || "Save"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Time Log Dialog */}
        <Dialog
          open={timeLogDialogOpen}
          onClose={() => setTimeLogDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Time Log for {timeLogData?.employeeName || "Employee"}
            {timeLogData?.days && timeLogData.days.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                {dayjs(timeLogData.days[0].date).format("MMM D")} -{" "}
                {dayjs(
                  timeLogData.days[timeLogData.days.length - 1].date
                ).format("MMM D, YYYY")}
              </Typography>
            )}
          </DialogTitle>
          <DialogContent>
            {timeLogData ? (
              <Box>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    mb: 2,
                    p: 2,
                    bgcolor: "background.paper",
                    borderRadius: 1,
                  }}
                >
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Total Expected
                    </Typography>
                    <Typography variant="h6">
                      {timeLogData.total.expectedHours.toFixed(2)} hrs
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Total Worked
                    </Typography>
                    <Typography variant="h6">
                      {timeLogData.total.workedHours.toFixed(2)} hrs
                    </Typography>
                  </Box>
                  {timeLogData.missingHoursFromPayroll != null ? (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Missing Hours (Payroll)
                      </Typography>
                      <Typography
                        variant="h6"
                        color="error.main"
                      >
                        {timeLogData.missingHoursFromPayroll.toFixed(2)} hrs
                      </Typography>
                    </Box>
                  ) : (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Missing Hours (Timesheet)
                      </Typography>
                      <Typography
                        variant="h6"
                        color={timeLogData.total.missingHoursOnly > 0 ? "error.main" : "text.secondary"}
                      >
                        {timeLogData.total.missingHoursOnly.toFixed(2)} hrs
                      </Typography>
                    </Box>
                  )}
                </Box>

                <Box sx={{ maxHeight: "60vh", overflowY: "auto" }}>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell align="right">Expected</TableCell>
                          <TableCell align="right">Worked</TableCell>
                          <TableCell align="right">Difference</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {timeLogData.days
                          .filter((day) => {
                            const d = dayjs(day.date);
                            const isPast = d.isBefore(dayjs(), "day");
                            const isFriday = d.day() === 5;
                            return isPast && !isFriday && (day.deltaHours < -0.01 || (timeLogData.missingHoursFromPayroll != null && day.expectedHours > 0 && day.workedHours < day.expectedHours));
                          }) // Show past non-Friday days with missing hours, or any day contributing to payroll total
                          .map((day) => (
                            <TableRow
                              key={day.date}
                            sx={{
                              bgcolor: day.isWeekend
                                ? "action.hover"
                                : "transparent",
                              "&:hover": { bgcolor: "action.hover" },
                            }}
                          >
                            <TableCell>
                              {day.dateFormatted}
                              {day.isHoliday && (
                                <Chip
                                  label="Holiday"
                                  size="small"
                                  sx={{ ml: 1, height: 20, fontSize: "0.7rem" }}
                                />
                              )}
                            </TableCell>
                            <TableCell align="right">
                              {day.expectedHours.toFixed(2)} hrs
                            </TableCell>
                            <TableCell align="right">
                              {day.workedHours.toFixed(2)} hrs
                            </TableCell>
                            <TableCell align="right" sx={{ color: "error.main" }}>
                              {day.deltaHours < 0 ? `-${Math.abs(day.deltaHours).toFixed(2)} hrs` : `-${(day.expectedHours - day.workedHours).toFixed(2)} hrs`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </Box>
            ) : (
              <Box sx={{ p: 3, textAlign: "center" }}>
                <Typography color="text.secondary">
                  No data available
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTimeLogDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
        {/* Toasts */}
        <Alert
          severity={toastSeverity}
          sx={{
            position: "fixed",
            bottom: 16,
            left: "50%",
            transform: `translateX(-50%) ${toastOpen ? "" : "translateY(120%)"}`,
            transition: "transform 180ms ease",
            zIndex: 1400,
            minWidth: 280,
            maxWidth: "80vw",
            pointerEvents: "none",
          }}
          onTransitionEnd={() => {
            /* no-op */
          }}
        >
          {toastMsg}
        </Alert>
      </Box>
    </LocalizationProvider>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" sx={{ fontWeight: 600 }}>
        {value || "-"}
      </Typography>
    </Box>
  );
}
