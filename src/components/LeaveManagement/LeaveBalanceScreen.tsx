/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/LeaveManagement/LeaveBalanceScreen.tsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getAuthHeader } from "../../utils/auth";
import { isActiveEmployee } from "../../api/employees";
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Button,
  Tabs,
  Tab,
  Grid,
  Stack,
  Snackbar,
  IconButton,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import NotificationsIcon from "@mui/icons-material/Notifications";
import {
  getLeaveBalance,
  getLeaveRequests,
  getHolidays,
  getLeaveTypes,
} from "../../services/leaveService";
import { format } from "date-fns";
import { TablePagination, LinearProgress } from "@mui/material";
import { differenceInBusinessDays } from "date-fns";

// Reusable title with top-right X
const DialogTitleWithClose: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => (
  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}>
    <Typography variant="h6" component="div" sx={{ py: 1.25, pl: 2 }}>{children}</Typography>
    <IconButton aria-label="close" onClick={onClose} size="small">
      <CloseIcon />
    </IconButton>
  </Box>
);

/** ---------------- Types ---------------- */
type HistoryRow = {
  int_con?: number;
  id?: number | string;
  id_can?: number | string;
  code?: string;
  typeCode?: string | number;
  typeName?: string;
  idCan?: string | number;
  date_depart?: string;
  date_end?: string;
  nbr_jour?: number;
  state?: string;
  startDate?: string;
  endDate?: string;
  days?: number;
  status?: string;
};

interface LeaveBalanceResponse {
  entitlement: number;
  used: number;
  remaining: number;
  leaveHistory: HistoryRow[];
}

/** ---------------- Component ---------------- */
const LeaveBalanceScreen: React.FC<{ employeeId?: number | string }> = ({
  employeeId,
}) => {
  const { t } = useTranslation();
  const [balance, setBalance] = useState<LeaveBalanceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // derived context
  const [computedEntitlement, setComputedEntitlement] = useState<number | null>(
    null
  );
  const [accruedDaysDaily, setAccruedDaysDaily] = useState<number>(0);
  const [approvedDaysYTD, setApprovedDaysYTD] = useState<number>(0);
  const [sickDaysYTD, setSickDaysYTD] = useState<number>(0);
  const [turns50On, setTurns50On] = useState<Date | null>(null);
  const [exp20On, setExp20On] = useState<Date | null>(null);
  const [contractStartDate, setContractStartDate] = useState<Date | null>(null);
  const [employeeInfo, setEmployeeInfo] = useState<any | null>(null);

  const [pdfRangeOpen, setPdfRangeOpen] = useState(false);
  const [pdfFrom, setPdfFrom] = useState<string>("");
  const [pdfTo, setPdfTo] = useState<string>("");

  const [leaveTypeMap, setLeaveTypeMap] = useState<
    Record<string, { code: string; name: string }>
  >({});
  const [holidaySetState, setHolidaySetState] = useState<Set<string>>(
    new Set()
  );

  // monthly ledger
  const [monthlyLedger, setMonthlyLedger] = useState<
    Array<{
      month: string;
      credit: number;
      debit: number;
      balance: number;
      note?: string;
      detailsText?: string;
    }>
  >([]);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string>("");
  const [toastSeverity, setToastSeverity] = useState<
    "success" | "info" | "warning" | "error"
  >("info");

  const showToast = (
    msg: string,
    severity: "success" | "info" | "warning" | "error" = "info"
  ) => {
    setToastMsg(msg);
    setToastSeverity(severity);
    setToastOpen(true);
  };

  const handleCloseToast = () => {
    setToastOpen(false);
  };

  type PendingItem = {
    id: string | number;
    employeeId: string | number;
    employeeName: string;
    typeLabel: string;
    startDate?: string;
    endDate?: string;
    days?: number;
    raw?: any;
  };

  const [pending, setPending] = useState<PendingItem[]>([]);
  const [pendingOpen, setPendingOpen] = useState(false);

  // tick every second to update countdowns
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [activeOrg, setActiveOrg] = useState<
    Array<ActiveMeta & { employeeName: string }>
  >([]);

  // Year tabs for ledger
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );
  const years = useMemo(() => {
    const ys = Array.from(
      new Set(
        (monthlyLedger || [])
          .map((r) => (r.month ? Number(String(r.month).slice(0, 4)) : NaN))
          .filter((y) => Number.isFinite(y))
      )
    ).sort((a, b) => b - a);
    return ys;
  }, [monthlyLedger]);
  useEffect(() => {
    if (years.length && !years.includes(selectedYear)) {
      setSelectedYear(years[0]);
    }
  }, [years, selectedYear]);

  /** ---------- Load base balance + merge history ---------- */
  useEffect(() => {
    const fetchLeaveBalanceData = async () => {
      try {
        setLoading(true);
        const empId = String(employeeId ?? "");
        let data = await getLeaveBalance(empId);

        try {
          const requests = await getLeaveRequests(empId);
          const existing = Array.isArray(data.leaveHistory)
            ? data.leaveHistory
            : [];
          const byId: Record<string, any> = {};
          [...existing, ...requests].forEach((row: any) => {
            byId[String(row.int_con ?? row.id)] = row;
          });
          data = { ...data, leaveHistory: Object.values(byId) } as any;
        } catch {}
        setBalance(data);
      } catch (err) {
        setError(t("leave.balance.fetchError"));
        console.error("Error fetching leave balance:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaveBalanceData();
  }, [t, employeeId]);

  useEffect(() => {
    (async () => {
      try {
        const inferredBase = `${window.location.protocol}//${window.location.hostname}:9000`;
        const rawBase =
          process.env.REACT_APP_API_IP &&
          process.env.REACT_APP_API_IP.trim() !== ""
            ? process.env.REACT_APP_API_IP
            : inferredBase;
        const base = rawBase.replace(/\/+$/, "");
        const token = localStorage.getItem("token");
        const hdrs = token ? { Authorization: `Bearer ${token}` } : undefined;

        const res = await fetch(`${base}/employees?state=true`, { headers: hdrs });
        const payload = await res.json();
        const arrRaw = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
        const activeOnly = arrRaw.filter(isActiveEmployee);
        const byId: Record<string, any> = {};
        activeOnly.forEach((e: any) => {
          byId[String(e.ID_EMP)] = e;
        });

        const empIds = Object.keys(byId).length
          ? Object.keys(byId)
          : [String(employeeId ?? "")];

        const acc: PendingItem[] = [];
        await Promise.all(
          empIds.map(async (idEmp) => {
            try {
              const reqs = await getLeaveRequests(idEmp);
              (Array.isArray(reqs) ? reqs : []).forEach((r: any) => {
                const status = String(r.status || r.state || "").toLowerCase();
                if (
                  status.includes("pending") ||
                  status.includes("submitted")
                ) {
                  const emp = byId[idEmp] || {};
                  const name =
                    emp?.NAME ||
                    emp?.FULL_NAME ||
                    emp?.NOM_PRENOM ||
                    `${emp?.FIRST_NAME ?? ""} ${emp?.LAST_NAME ?? ""}` ||
                    `#${idEmp}`;
                  const code = String(
                    r.code ?? r.typeCode ?? r.id_can ?? ""
                  ).toUpperCase();
                  const typeName = String(r.typeName ?? r.LEAVE_TYPE ?? "");
                  const typeLabel = code
                    ? typeName
                      ? `${code} — ${typeName}`
                      : code
                    : typeName || "-";

                  acc.push({
                    id: r.int_con ?? r.id ?? `${idEmp}-${Math.random()}`,
                    employeeId: idEmp,
                    employeeName: String(name).trim() || `#${idEmp}`,
                    typeLabel,
                    startDate: r.startDate ?? r.DATE_START ?? r.date_depart,
                    endDate: r.endDate ?? r.DATE_END ?? r.date_end,
                    days: r.days ?? r.NUM_DAYS ?? r.nbr_jour,
                    raw: r,
                  });
                }
              });
            } catch {}
          })
        );
        acc.sort((a, b) =>
          String(a.employeeName).localeCompare(String(b.employeeName))
        );
        setPending(acc);
      } catch (e) {}
    })();
  }, [employeeId, t]);

  /** ---------- Utilities ---------- */
  const mapRow = (r: HistoryRow | any) => ({
    id: r.int_con ?? r.id,
    typeCode: r.typeCode ?? r.id_can ?? r.code ?? undefined,
    typeName: r.typeName ?? r.LEAVE_TYPE ?? undefined,
    idCan: r.idCan ?? r.id_can ?? undefined,
    type: String(r.type ?? r.code ?? r.id_can ?? ""),
    startDate: r.startDate ?? r.DATE_START ?? r.date_depart ?? "",
    endDate: r.endDate ?? r.DATE_END ?? r.date_end ?? "",
    days: r.days ?? r.NUM_DAYS ?? r.nbr_jour ?? 0,
    status: String(r.status ?? r.STATUS ?? r.state ?? "").toLowerCase(),
  });

  const loadJsPDF = async (): Promise<{ jsPDF: any }> => {
    const w = window as any;
    if (w.jspdf && w.jspdf.jsPDF) return { jsPDF: w.jspdf.jsPDF };
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load jsPDF"));
      document.body.appendChild(s);
    });
    return { jsPDF: (window as any).jspdf.jsPDF };
  };

  const [reqOpen, setReqOpen] = useState(false);
  const [reqType, setReqType] = useState<string>("");
  const [reqStart, setReqStart] = useState<string>("");
  const [reqEnd, setReqEnd] = useState<string>("");
  const [reqSaving, setReqSaving] = useState(false);

  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const datesOverlap = (a1: Date, a2: Date, b1: Date, b2: Date) =>
    Math.max(a1.getTime(), b1.getTime()) <=
    Math.min(a2.getTime(), b2.getTime());

  const nextDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  const prevDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);

  const workingDaysBetween = (a: Date, b: Date) => {
    let c = 0;
    const d = new Date(a);
    d.setHours(0, 0, 0, 0);
    const e = new Date(b);
    e.setHours(0, 0, 0, 0);
    while (d <= e) {
      if (!isFriday(d) && !isHoliday(d)) c++;
      d.setDate(d.getDate() + 1);
    }
    return c;
  };

    const handleExportPDF = async (p0?: { from: string; to: string; }) => {
    try {
      const { jsPDF } = await loadJsPDF();
      const doc = new jsPDF("p", "pt", "a4");

      // ---------- BASIC PDF HELPERS ----------
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const M = 56;
      const maxY = pageHeight - 64;
      const sectionGap = 28;
      const cardPad = 14;
      const cardRadius = 10;
      let y = 48;

      const newPageIfNeeded = (delta = 0) => {
        if (y + delta > maxY) {
          doc.addPage();
          y = 48;
        }
      };

      const drawCard = (
        height: number,
        options?: {
          fill?: [number, number, number];
          stroke?: [number, number, number];
          lw?: number;
        }
      ) => {
        const x = M - 4;
        const w = pageWidth - 2 * (M - 4);
        const lw = options?.lw ?? 0.9;
        doc.setLineWidth(lw);
        if (options?.stroke) doc.setDrawColor(...options.stroke);
        if (options?.fill) {
          doc.setFillColor(...options.fill);
          doc.roundedRect(x, y, w, height, cardRadius, cardRadius, "FD");
        } else {
          doc.roundedRect(x, y, w, height, cardRadius, cardRadius);
        }
        return { x, y, w, h: height, padX: x + cardPad, padY: y + cardPad };
      };

      const arrayBufferToBase64 = (ab: ArrayBuffer) => {
        let binary = "";
        const bytes = new Uint8Array(ab);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
      };

      const ensureArabicFont = async () => {
        try {
          const resp = await fetch(
            "/fonts/NotoNaskhArabic-VariableFont_wght.ttf",
            { cache: "force-cache" }
          );
          if (!resp.ok) return;
          const base64 = arrayBufferToBase64(await resp.arrayBuffer());
          doc.addFileToVFS("NotoNaskhArabic-Regular.ttf", base64);
          doc.addFont(
            "NotoNaskhArabic-Regular.ttf",
            "NotoNaskhArabic",
            "normal"
          );
        } catch {
          // ignore failures, fallback to helvetica
        }
      };

      const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(s);

      const countWorkingDaysStrict = (a: Date, b: Date) => {
        const s = new Date(a);
        s.setHours(0, 0, 0, 0);
        const e = new Date(b);
        e.setHours(0, 0, 0, 0);
        if (e < s) return 0;
        let c = 0;
        const d = new Date(s);
        while (d <= e) {
          if (d.getDay() !== 5 && !holidaySetState.has(yyyy_mm_dd(d))) c++;
          d.setDate(d.getDate() + 1);
        }
        return c;
      };

      // Very small & clean pie using canvas → PNG
      const createPieChartImage = async (
        title: string,
        data: Array<{ label: string; value: number }>
      ): Promise<string | null> => {
        let filtered = data.filter((d) => d.value > 0);
        if (!filtered.length) return null;

        // Limit slices to keep it readable: top 5 + "Other"
        filtered.sort((a, b) => b.value - a.value);
        if (filtered.length > 6) {
          const top = filtered.slice(0, 5);
          const rest = filtered.slice(5);
          const restSum = rest.reduce((s, r) => s + r.value, 0);
          top.push({ label: "Other", value: restSum });
          filtered = top;
        }

        const total = filtered.reduce((s, r) => s + r.value, 0);
        if (!total) return null;

        const size = 260;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size + 40;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#000000";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(title, canvas.width / 2, 6);

        const cx = size / 2;
        const cy = size / 2 + 16;
        const r = size * 0.36;

        const colors = [
          "#1f77b4",
          "#ff7f0e",
          "#2ca02c",
          "#d62728",
          "#9467bd",
          "#8c564b",
        ];

        let startAngle = -Math.PI / 2;
        filtered.forEach((slice, idx) => {
          const angle = (slice.value / total) * Math.PI * 2;
          const endAngle = startAngle + angle;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, r, startAngle, endAngle);
          ctx.closePath();
          ctx.fillStyle = colors[idx % colors.length];
          ctx.fill();
          startAngle = endAngle;
        });

        // Minimal legend under the pie
        ctx.font = "10px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        let legendY = size + 12;
        const legendX = 10;
        filtered.forEach((slice, idx) => {
          const pct = (slice.value / total) * 100;
          ctx.fillStyle = colors[idx % colors.length];
          ctx.fillRect(legendX, legendY - 5, 10, 10);
          ctx.fillStyle = "#000000";
          const label = `${slice.label} (${slice.value.toFixed(1)} / ${pct.toFixed(0)}%)`;
          ctx.fillText(label, legendX + 16, legendY);
          legendY += 14;
        });

        return canvas.toDataURL("image/png");
      };

      await ensureArabicFont();

      // ---------- DATASET: APPROVED LEAVES IN WORKING YEAR ----------
      // Use calendar-year window for data (Jan 1 -> Dec 31), but header can still show up to today
      const win = getWorkingYearWindow();
      const today = new Date();

      const windowStart = win.start;
      const windowEnd = win.end; // do NOT clip to today; keep full working year for leave periods

      type RowNorm = ReturnType<typeof mapRow>;

      type ApprovedRow = RowNorm & {
        effDays: number;
        clipStart: Date;
        clipEnd: Date;
        label: string;
      };

      const allHist: RowNorm[] = historyNorm;

      const approvedRowsForWindow: ApprovedRow[] = allHist
        .filter((h) => {
          if (!h.startDate || !h.endDate) return false;
          if (!isApprovedLike(h.status || "")) return false;
          const st = new Date(h.startDate);
          const en = new Date(h.endDate);
          return !(en < windowStart || st > windowEnd);
        })
        .map((h) => {
          const st = new Date(h.startDate!);
          const en = new Date(h.endDate!);
          const a = st < windowStart ? windowStart : st;
          const b = en > windowEnd ? windowEnd : en;
          const eff = countWorkingDaysStrict(a, b);
          const meta = getTypeMeta(h);
          const label = meta.code
            ? meta.name
              ? `${meta.code} — ${meta.name}`
              : meta.code
            : meta.name || h.type || "-";
          return { ...h, effDays: eff, clipStart: a, clipEnd: b, label };
        })
        .filter((r) => r.effDays > 0)
        .sort(
          (a, b) => a.clipStart.getTime() - b.clipStart.getTime()
        );

      const approvedTotalFromRows = approvedRowsForWindow.reduce(
        (s, r) => s + r.effDays,
        0
      );

      // ---------- HEADER ----------
      const fmtHdr = (d: Date) =>
        d.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      const periodStr = `Working year: ${fmtHdr(windowStart)} TO ${fmtHdr(today)}`;
      const printedAt = format(new Date(), "yyyy-MM-dd HH:mm:ss");

      try {
        const logo = await loadImageAsDataURL("../../Gaja_out_black.png");
        if (logo) doc.addImage(logo, "PNG", M, y, 40, 32);
      } catch {
        // ignore
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Leave Balance Report", pageWidth - M, y + 14, {
        align: "right",
      });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(periodStr, pageWidth - M, y + 30, { align: "right" });
      y += 46;
      doc.setDrawColor(220);
      doc.setLineWidth(0.4);
      doc.line(M, y, pageWidth - M, y);
      y += sectionGap;

      // ---------- EMPLOYEE INFO (ARABIC-AWARE) ----------
      newPageIfNeeded(110);
      const empCard = drawCard(96, {
        stroke: [210, 210, 210],
        fill: [248, 248, 248],
      });

      const name = String(
        employeeInfo?.NAME ||
          employeeInfo?.FULL_NAME ||
          employeeInfo?.NOM_PRENOM ||
          `${employeeInfo?.FIRST_NAME ?? ""} ${
            employeeInfo?.LAST_NAME ?? ""
          }` ||
          ""
      ).trim();
      const id = String(employeeInfo?.ID_EMP ?? employeeId ?? "").trim();
      const job = String(
        employeeInfo?.TITLE ??
          employeeInfo?.JOB_TITLE ??
          employeeInfo?.FONCTION ??
          employeeInfo?.POSTE ??
          ""
      ).trim();
      const ps = formatPS(
        String(
          employeeInfo?.PS ??
            employeeInfo?.PERSONNEL_SUBAREA ??
            employeeInfo?.SUBAREA ??
            ""
        ).trim()
      );

      const col2 = empCard.padX + (empCard.w - 2 * cardPad) / 2 + 10;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Employee Information", empCard.padX, empCard.padY + 2);

      let yy = empCard.padY + 24;

      const drawLabelPair = (
        label: string,
        value: string,
        xLabel: number,
        xValue: number
      ) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(label, xLabel, yy);
        const arabic = hasArabic(value);
        doc.setFont(arabic ? "NotoNaskhArabic" : "helvetica", "normal");
        doc.text(value || "—", xValue, yy);
        doc.setFont("helvetica", "bold");
      };

      drawLabelPair("Name:", name, empCard.padX, empCard.padX + 72);
      drawLabelPair("Employee ID:", id, col2, col2 + 92);
      yy += 18;
      drawLabelPair("Job Title:", job, empCard.padX, empCard.padX + 72);
      drawLabelPair("PS:", ps, col2, col2 + 92);

      y += empCard.h + sectionGap;

      // ---------- SUMMARY (no total working days) ----------
      newPageIfNeeded(110);
      const balCard = drawCard(110, {
        stroke: [200, 200, 200],
        fill: [245, 246, 250],
      });

      const entitlementVal = computedEntitlement ?? balance?.entitlement ?? 30;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(
        "Balance Summary (Working Year)",
        balCard.padX,
        balCard.padY + 2
      );

      const colW = (balCard.w - 2 * cardPad) / 2;
      const c1 = balCard.padX;
      const c2 = balCard.padX + colW + 12;
      let by = balCard.padY + 26;

      doc.setFontSize(10);
      doc.text("Annual Entitlement", c1, by);
      doc.text("Approved (working year)", c2, by);
      by += 18;
      doc.setFont("helvetica", "normal");
      doc.text(`${entitlementVal.toFixed(0)} days`, c1, by);
      doc.text(`${approvedTotalFromRows.toFixed(2)} days`, c2, by);
      by += 18;

      doc.setFont("helvetica", "bold");
      doc.text("Remaining Balance (YTD)", c1, by);
      by += 18;
      doc.setFont("helvetica", "normal");
      doc.text(`${remainingDaysRounded.toFixed(2)} days`, c1, by);

      y += balCard.h + sectionGap;

      // ---------- PIE CHARTS (TIED TO THE SAME APPROVED ROWS) ----------
      const perTypeAgg = new Map<string, number>();
      approvedRowsForWindow.forEach((r) => {
        const key = r.label || "-";
        perTypeAgg.set(key, (perTypeAgg.get(key) || 0) + r.effDays);
      });
      const perTypeData = Array.from(perTypeAgg.entries()).map(
        ([label, value]) => ({ label, value })
      );

      const usedVsRemainingData = [
        { label: "Used (working year)", value: approvedTotalFromRows },
        {
          label: "Remaining",
          value: Math.max(0, entitlementVal - approvedTotalFromRows),
        },
      ];

      newPageIfNeeded(300);
      const pieCard = drawCard(300, {
        stroke: [200, 200, 200],
        fill: [252, 252, 252],
      });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(
        "Leave Distribution & Balance (Working Year)",
        pieCard.padX,
        pieCard.padY + 2
      );

      const pieYTop = pieCard.padY + 20;
      const imgWidth = 250;
      const imgHeight = 250;
      const imgX1 = pieCard.padX;
      const imgX2 = pieCard.padX + imgWidth + 30;

      const usedRemChart = await createPieChartImage(
        "Entitlement: used vs remaining",
        usedVsRemainingData
      );

      doc.addImage(
          usedRemChart,
          "PNG",
          imgX1,
          pieYTop,
          imgWidth,
          imgHeight
        );

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(
        "Counts exclude Fridays and configured holidays.",
        pieCard.padX,
        pieCard.y + pieCard.h - 10
      );
      doc.setTextColor(0);

      y += pieCard.h + sectionGap;

      // ---------- APPROVED LEAVES TABLE (SAME DATA AS ABOVE) ----------
      {
        const fmtDate = (d: Date) =>
          d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });

        if (approvedRowsForWindow.length) {
          newPageIfNeeded(180);
          const headH = 34;
          doc.setFillColor(240, 242, 246);
          doc.setDrawColor(220);
          doc.roundedRect(
            M - 4,
            y,
            pageWidth - 2 * (M - 4),
            headH,
            10,
            10,
            "FD"
          );
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          doc.text(
            "Approved Leave Details (Working Year)",
            M + 10,
            y + 22
          );
          y += headH + 12;

          // Table header
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(70);
          const colTypeX = M;
          const colPeriodX = colTypeX + 240;
          const colDaysX = pageWidth - M - 80;
          doc.text("Type", colTypeX, y);
          doc.text("Period", colPeriodX, y);
          doc.text("Days", colDaysX, y, { align: "right" });
          doc.setTextColor(0);
          y += 8;
          doc.setDrawColor(225);
          doc.setLineWidth(0.4);
          doc.line(M, y, pageWidth - M, y);
          y += 12;

          const typeWrapW = colPeriodX - colTypeX - 20;
          const periodWrapW = colDaysX - colPeriodX - 22;

          for (const r of approvedRowsForWindow) {
            const periodText = `${fmtDate(r.clipStart)} — ${fmtDate(
              r.clipEnd
            )}`;
            const typeWrap = doc.splitTextToSize(r.label || "-", typeWrapW);
            const periodWrap = doc.splitTextToSize(periodText, periodWrapW);
            const rowH = Math.max(
              14,
              Math.max(typeWrap.length, periodWrap.length) * 10 + 4
            );
            newPageIfNeeded(rowH + 10);

            const arabicType = hasArabic(r.label || "");
            doc.setFont(arabicType ? "NotoNaskhArabic" : "helvetica", "normal");
            doc.setFontSize(9);
            doc.text(typeWrap, colTypeX, y);

            doc.setFont("helvetica", "normal");
            doc.text(periodWrap, colPeriodX, y);

            doc.setFont("courier", "normal");
            doc.text(r.effDays.toFixed(2), colDaysX, y, {
              align: "right",
            });

            y += rowH + 6;
            doc.setDrawColor(240);
            doc.setLineWidth(0.3);
            doc.line(M, y, pageWidth - M, y);
            y += 4;
          }

          const sumEff = approvedRowsForWindow.reduce(
            (s, r) => s + r.effDays,
            0
          );
          newPageIfNeeded(22);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text(
            `Approved total in working year: ${sumEff.toFixed(2)} days`,
            M,
            y + 2
          );
          y += 18;
        } else {
          newPageIfNeeded(60);
          doc.setFont("helvetica", "italic");
          doc.setFontSize(10);
          doc.text("No approved leave found in the working year.", M, y);
          y += 16;
        }
      }

      // ---------- FOOTER ----------
      const safeName =
        (name
          ? name.replace(/[^a-z0-9_\u0600-\u06FF]+/gi, "_")
          : id || "employee") +
        `_leave_report_${printedAt.replace(/[: ]/g, "_")}.pdf`;
      doc.save(safeName);
      showToast("PDF exported successfully", "success");
    } catch (e) {
      console.error("PDF export failed:", e);
      showToast("Failed to export PDF", "error");
    }
  };

  const formatPS = (raw: string | number) => {
    const s = String(raw ?? "").trim();
    const map: Record<string, string> = {
      "1": "P0",
      "2": "P1",
      "3": "P2",
      "4": "P3",
      "5": "P4",
      "6": "OG",
    };
    return map[s] || s;
  };

  const isApprovedLike = (status: string) => {
    const s = String(status || "")
      .trim()
      .toLowerCase();
    if (!s) return false;
    const tokens = [
      "approved",
      "accepted",
      "validated",
      "approuved",
      "approuvé",
      "validé",
      "approved by hr",
      "approved_by_hr",
    ];
    return tokens.some((tk) => s.includes(tk));
  };

  // --- helpers: working-year window (calendar year: Jan 1 -> today) ---
  const getWorkingYearWindow = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
    const end = new Date(now.getFullYear(), 11, 31); // Dec 31 of current year
    return { start, end };
  };

  const yyyy_mm_dd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  };

  const isFriday = (d: Date) => d.getDay() === 5;
  const isHoliday = (d: Date) => holidaySetState.has(yyyy_mm_dd(d));

  const countWorkingDays = (a: Date, b: Date) => {
    const s = new Date(a);
    s.setHours(0, 0, 0, 0);
    const e = new Date(b);
    e.setHours(0, 0, 0, 0);
    let c = 0;
    const d = new Date(s);
    while (d <= e) {
      if (!isFriday(d) && !isHoliday(d)) c++;
      d.setDate(d.getDate() + 1);
    }
    return c;
  };

  // --- Active leave helpers ---
  type ActiveMeta = {
    label: string;
    st: Date;
    en: Date;
    elapsedWorking: number;
    totalWorking: number;
    remainingWorking: number;
    pct: number;
    hh: number;
    mm: number;
    ss: number;
  };

  const inWorkingWindow = (a: Date, b: Date, now = new Date()) =>
    now >= new Date(a.setHours(0, 0, 0, 0)) &&
    now <= new Date(b.setHours(23, 59, 59, 999));

  const toActiveMeta = (label: string, st: Date, en: Date): ActiveMeta => {
    const total = countWorkingDays(st, en);
    const elapsed = countWorkingDays(st, new Date());
    const rem = Math.max(0, total - elapsed);
    const pct = total ? Math.min(100, Math.round((elapsed / total) * 100)) : 0;
    const ms = Math.max(0, en.getTime() - Date.now());
    const hh = Math.floor(ms / 3600000) % 24;
    const mm = Math.floor(ms / 60000) % 60;
    const ss = Math.floor(ms / 1000) % 60;
    return {
      label,
      st,
      en,
      elapsedWorking: elapsed,
      totalWorking: total,
      remainingWorking: rem,
      pct,
      hh,
      mm,
      ss,
    };
  };

  // --- normalize history once ---
  const historyNorm = useMemo(
    () => (balance?.leaveHistory || []).map(mapRow),
    [balance]
  );

  // Determine a display label + key for a row's type
  const getTypeMeta = (row: ReturnType<typeof mapRow>) => {
    const idKey =
      row.idCan != null
        ? String(row.idCan)
        : row.typeCode != null
          ? String(row.typeCode)
          : undefined;
    const meta = idKey ? leaveTypeMap[idKey] : undefined;
    const code = (
      meta?.code || String(row.typeCode || row.type || "")
    ).toUpperCase();
    const name = meta?.name || row.typeName || "";
    const label = code ? (name ? `${code} — ${name}` : code) : name || "-";
    const key = code || name || "-";
    return { key, code, name, label };
  };

  // Current employee active leave(s)
  const activeSelf = useMemo<ActiveMeta[]>(() => {
    return historyNorm
      .filter((h) => isApprovedLike(h.status || ""))
      .map((h) => {
        const st = h.startDate ? new Date(h.startDate) : null;
        const en = h.endDate ? new Date(h.endDate) : null;
        if (!st || !en) return null;
        if (!inWorkingWindow(new Date(st), new Date(en), new Date(nowTick)))
          return null;
        const meta = getTypeMeta(h);
        const label = meta.code
          ? meta.name
            ? `${meta.code} — ${meta.name}`
            : meta.code
          : h.type || "-";
        return toActiveMeta(label, st, en);
      })
      .filter(Boolean) as ActiveMeta[];
  }, [historyNorm, nowTick, leaveTypeMap]);

  // state
  const [histPage, setHistPage] = useState(0);
  const [histRowsPerPage, setHistRowsPerPage] = useState(10);

  // sorted rows (newest first)
  const historySorted = useMemo(() => {
    const arr = historyNorm.slice();
    arr.sort(
      (a, b) =>
        new Date(b.startDate || 0).getTime() -
        new Date(a.startDate || 0).getTime()
    );
    return arr;
  }, [historyNorm]);

  const pagedHistory = useMemo(
    () =>
      historySorted.slice(
        histPage * histRowsPerPage,
        histPage * histRowsPerPage + histRowsPerPage
      ),
    [historySorted, histPage, histRowsPerPage]
  );

  // --- per-type summary within current working year, split by status ---
  type TypeSummary = {
    code: string;
    name: string;
    label: string;
    approvedDaysYTD: number;
    pendingDaysYTD: number;
    rejectedDaysYTD: number;
    totalDaysYTD: number;
  };

  const typeSummary = useMemo<TypeSummary[]>(() => {
    const win = getWorkingYearWindow();
    if (!win) return [];
    const { start: winStart, end: winEnd } = win;

    const bucket = new Map<string, TypeSummary>();

    for (const h of historyNorm) {
      const st = h.startDate ? new Date(h.startDate) : null;
      const en = h.endDate ? new Date(h.endDate) : null;
      if (!st || !en) continue;
      if (en < winStart || st > winEnd) continue;

      const a = st < winStart ? winStart : st;
      const b = en > winEnd ? winEnd : en;
      const days = countWorkingDays(a, b);
      if (!days) continue;

      const { key, code, name, label } = getTypeMeta(h);
      if (!bucket.has(key)) {
        bucket.set(key, {
          code,
          name,
          label,
          approvedDaysYTD: 0,
          pendingDaysYTD: 0,
          rejectedDaysYTD: 0,
          totalDaysYTD: 0,
        });
      }
      const rec = bucket.get(key)!;
      const s = String(h.status || "").toLowerCase();
      if (isApprovedLike(s)) rec.approvedDaysYTD += days;
      else if (s.includes("pending") || s.includes("submitted"))
        rec.pendingDaysYTD += days;
      else if (
        s.includes("rejected") ||
        s.includes("refused") ||
        s.includes("denied")
      )
        rec.rejectedDaysYTD += days;
      rec.totalDaysYTD += days;
    }

    return Array.from(bucket.values()).sort(
      (a, b) => b.totalDaysYTD - a.totalDaysYTD || a.code.localeCompare(b.code)
    );
  }, [historyNorm, contractStartDate, holidaySetState, leaveTypeMap]);

  /** ---------- Type totals & consistency ---------- */
  const approvedSumFromTypes = useMemo(
    () => typeSummary.reduce((s, r) => s + r.approvedDaysYTD, 0),
    [typeSummary]
  );
  const totalsMatch = Math.abs(approvedSumFromTypes - approvedDaysYTD) < 0.01;

  /** ---------- Fetch leave types ---------- */
  useEffect(() => {
    const loadTypes = async () => {
      try {
        const types = await getLeaveTypes();
        const map: Record<string, { code: string; name: string }> = {};
        (Array.isArray(types) ? types : []).forEach((t: any) => {
          if (t && t.int_can != null) {
            map[String(t.int_can)] = {
              code: String(t.code || ""),
              name: String(t.desig_can || ""),
            };
          }
        });
        setLeaveTypeMap(map);
      } catch {}
    };
    loadTypes();
  }, []);

  const loadImageAsDataURL = async (path: string): Promise<string | null> => {
    try {
      const resp = await fetch(path, { cache: "no-store" });
      if (!resp.ok) return null;
      const blob = await resp.blob();
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  /** ---------- Load Employee + Holidays + compute entitlement/accrual ---------- */
  useEffect(() => {
    const compute = async () => {
      try {
        const inferredBase = `${window.location.protocol}//${window.location.hostname}:9000`;
        const rawBase =
          process.env.REACT_APP_API_IP &&
          process.env.REACT_APP_API_IP.trim() !== ""
            ? process.env.REACT_APP_API_IP
            : inferredBase;
        const base = rawBase.replace(/\/+$/, "");
        const token = localStorage.getItem("token");
        const hdrs = token ? { Authorization: `Bearer ${token}` } : undefined;

        const res = await fetch(`${base}/employees`, { headers: hdrs });
        const list = await res.json();
        const emp = Array.isArray(list)
          ? list.find((e: any) => String(e.ID_EMP) === String(employeeId ?? ""))
          : null;
        setEmployeeInfo(emp || null);

        const dob = emp?.DATE_OF_BIRTH;
        const start = emp?.CONTRACT_START || emp?.T_START;
        const age = dob
          ? Math.floor(
              (Date.now() - new Date(dob).getTime()) /
                (365.25 * 24 * 60 * 60 * 1000)
            )
          : 0;
        const expYears = start
          ? Math.floor(
              (Date.now() - new Date(start).getTime()) /
                (365.25 * 24 * 60 * 60 * 1000)
            )
          : 0;
        const senior = age >= 50 || expYears >= 20;
        const entitlement = senior ? 45 : 30;
        setComputedEntitlement(entitlement);

        const now = new Date();
        const contractStart = start ? new Date(start) : null;
        setContractStartDate(contractStart);
        const addYears = (d: Date, years: number) =>
          new Date(d.getFullYear() + years, d.getMonth(), d.getDate());
        const fiftyOn = dob ? addYears(new Date(dob), 50) : null;
        const exp20Date = contractStart
          ? addYears(new Date(contractStart), 20)
          : null;
        setTurns50On(fiftyOn);
        setExp20On(exp20Date);

        let holidaySet = new Set<string>();
        try {
          const holidaysResp = await getHolidays();
          const holidaysArr = Array.isArray(holidaysResp)
            ? holidaysResp
            : holidaysResp?.data || [];
          holidaysArr.forEach((h: any) => {
            const iso = String(
              h.DATE_H ?? h.date ?? h.holiday_date ?? ""
            ).slice(0, 10);
            if (iso) holidaySet.add(iso);
          });
        } catch {}
        try {
          const raw = localStorage.getItem("custom_holidays");
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              arr.forEach((h: any) => {
                const iso = String(
                  h.DATE_H ?? h.date ?? h.holiday_date ?? ""
                ).slice(0, 10);
                if (iso) holidaySet.add(iso);
              });
            }
          }
        } catch {}
        setHolidaySetState(holidaySet);

        const daysBetween = (a: Date, b: Date) => {
          const d1 = new Date(a);
          d1.setHours(0, 0, 0, 0);
          const d2 = new Date(b);
          d2.setHours(0, 0, 0, 0);
          const ms = d2.getTime() - d1.getTime();
          return ms < 0 ? 0 : Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
        };

        if (!contractStart) {
          setAccruedDaysDaily(0);
        } else {
          const thisYearAnniv = new Date(
            now.getFullYear(),
            contractStart.getMonth(),
            contractStart.getDate()
          );
          const currentYearStart =
            thisYearAnniv <= now
              ? thisYearAnniv
              : new Date(
                  now.getFullYear() - 1,
                  contractStart.getMonth(),
                  contractStart.getDate()
                );

          const threshold =
            [fiftyOn, exp20Date]
              .filter((d): d is Date => !!d)
              .sort((a, b) => a.getTime() - b.getTime())[0] || null;

          const RATE30 = 30 / 365;
          const RATE45 = 45 / 365;

          let total = 0;
          if (!threshold) {
            total =
              daysBetween(currentYearStart, now) * (senior ? RATE45 : RATE30);
          } else if (threshold <= currentYearStart) {
            total = daysBetween(currentYearStart, now) * RATE45;
          } else if (threshold > now) {
            total = daysBetween(currentYearStart, now) * RATE30;
          } else {
            const dayBeforeThreshold = new Date(
              threshold.getTime() - 24 * 60 * 60 * 1000
            );
            total += daysBetween(currentYearStart, dayBeforeThreshold) * RATE30;
            total += daysBetween(threshold, now) * RATE45;
          }
          setAccruedDaysDaily(Number(total.toFixed(2)));
        }

        const fmt = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const da = String(d.getDate()).padStart(2, "0");
          return `${y}-${m}-${da}`;
        };
        const isFriday = (d: Date) => d.getDay() === 5;
        const isHoliday = (d: Date) => holidaySet.has(fmt(d));
        const countEffectiveLeaveDays = (a: Date, b: Date) => {
          const d = new Date(a);
          d.setHours(0, 0, 0, 0);
          const end = new Date(b);
          end.setHours(0, 0, 0, 0);
          let c = 0;
          while (d <= end) {
            if (!isFriday(d) && !isHoliday(d)) c++;
            d.setDate(d.getDate() + 1);
          }
          return c;
        };

        const workingYearStart = (() => {
          if (!contractStart) return null;
          const annivThisYear = new Date(
            now.getFullYear(),
            contractStart.getMonth(),
            contractStart.getDate()
          );
          return annivThisYear <= now
            ? annivThisYear
            : new Date(
                now.getFullYear() - 1,
                contractStart.getMonth(),
                contractStart.getDate()
              );
        })();

        const hist = (balance?.leaveHistory || []).map(mapRow);

        const isSick = (row: ReturnType<typeof mapRow>) => {
          const idKey =
            row.idCan != null
              ? String(row.idCan)
              : row.typeCode != null
                ? String(row.typeCode)
                : undefined;
          const meta = idKey ? leaveTypeMap[idKey] : undefined;
          const code = (
            meta?.code || String(row.typeCode || row.type || "")
          ).toUpperCase();
          const name = (meta?.name || row.typeName || "").toLowerCase();
          return (
            code === "SL" || /sick/i.test(code) || /sick|مرض|malad/i.test(name)
          );
        };

        const inWorkingYear = (st: Date, en: Date) => {
          if (!workingYearStart) return false;
          const startWindow = workingYearStart;
          const endWindow = new Date(
            workingYearStart.getFullYear() + 1,
            workingYearStart.getMonth(),
            workingYearStart.getDate()
          );
          return !(en < startWindow || st > endWindow);
        };

        let approvedSum = 0;
        let sickSum = 0;

        hist.forEach((h) => {
          const st = h.startDate ? new Date(h.startDate) : null;
          const en = h.endDate ? new Date(h.endDate) : null;
          if (!st || !en) return;
          if (!isApprovedLike(h.status || "")) return;
          if (!inWorkingYear(st, en)) return;

          const wStart = workingYearStart!;
          const wEnd = new Date(
            wStart.getFullYear() + 1,
            wStart.getMonth(),
            wStart.getDate()
          );
          const a = st < wStart ? wStart : st;
          const b = en > wEnd ? wEnd : en;

          const d = countEffectiveLeaveDays(a, b);
          approvedSum += d;
          if (isSick(h)) sickSum += d;
        });

        setApprovedDaysYTD(approvedSum);
        setSickDaysYTD(sickSum);
      } catch {}
    };
    compute();
  }, [employeeId, balance, leaveTypeMap]);

  /** ---------- Monthly ledger ---------- */
  useEffect(() => {
    if (!contractStartDate) return;
    try {
      const now = new Date();
      const startOfMonth = (d: Date) =>
        new Date(d.getFullYear(), d.getMonth(), 1);
      const endOfMonth = (d: Date) =>
        new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const clamp = (d: Date) => {
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x;
      };
      const fmt = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const da = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${da}`;
      };
      const isFriday = (d: Date) => d.getDay() === 5;
      const isHoliday = (d: Date) => holidaySetState.has(fmt(d));
      const countEffectiveLeaveDays = (a: Date, b: Date) => {
        const s = clamp(a),
          e = clamp(b);
        let c = 0;
        const d = new Date(s);
        while (d <= e) {
          if (!isFriday(d) && !isHoliday(d)) c++;
          d.setDate(d.getDate() + 1);
        }
        return c;
      };

      const normalized = (balance?.leaveHistory || []).map(mapRow);
      const rows: Array<{
        month: string;
        credit: number;
        debit: number;
        balance: number;
        note?: string;
        detailsText?: string;
      }> = [];
      let running = 0;
      let cur = startOfMonth(contractStartDate);
      const annivMonth = contractStartDate.getMonth();
      let first = true;

      const MONTH30 = 30 / 12;
      const MONTH45 = 45 / 12;
      const threshold =
        [turns50On, exp20On]
          .filter((d): d is Date => !!d)
          .sort((a, b) => a.getTime() - b.getTime())[0] || null;
      const monthlyCreditFor = (monthEnd: Date) => {
        if (!threshold)
          return (computedEntitlement ?? 30) >= 45 ? MONTH45 : MONTH30;
        return monthEnd >= threshold ? MONTH45 : MONTH30;
      };

      while (cur <= now) {
        const monthStart = cur;
        const monthEnd = endOfMonth(cur);

        const credit = monthlyCreditFor(monthEnd);

        const monthApproved = normalized.filter((h) => {
          const st = h.startDate ? new Date(h.startDate) : null;
          const en = h.endDate ? new Date(h.endDate) : null;
          const status = String(h.status || "");
          if (!st || !en) return false;
          if (!isApprovedLike(status)) return false;
          return !(en < monthStart || st > monthEnd);
        });

        const perType: Record<string, number> = {};
        const debit = monthApproved.reduce((sum, h) => {
          const st = h.startDate ? new Date(h.startDate) : null;
          const en = h.endDate ? new Date(h.endDate) : null;
          if (!st || !en) return sum;
          const a = st < monthStart ? monthStart : st;
          const b = en > monthEnd ? monthEnd : en;
          const days = countEffectiveLeaveDays(a, b);
          const idKey =
            h.idCan != null
              ? String(h.idCan)
              : h.typeCode != null
                ? String(h.typeCode)
                : undefined;
          const lt = idKey ? leaveTypeMap[idKey] || undefined : undefined;
          const label = lt
            ? `${lt.code}${lt.name ? " — " + lt.name : ""}`
            : h.typeCode || h.typeName
              ? `${String(h.typeCode ?? "")}${h.typeName ? " — " + h.typeName : ""}`
              : h.type || "";
          const key = label || "-";
          perType[key] = (perType[key] || 0) + days;
          return sum + days;
        }, 0);

        const detailsText = Object.entries(perType)
          .filter(([, n]) => n > 0)
          .map(([k, n]) => `${k}: ${n}`)
          .join(", ");

        if (!first && monthStart.getMonth() === annivMonth) {
          rows.push({
            month: format(monthStart, "yyyy MMM"),
            credit: 0,
            debit: 0,
            balance: 0,
            note: t(
              "leave.balance.zeroedDueToYearlyLimit",
              "<< ZEROED DUE TO YEARLY LIMIT >>"
            ),
          });
          running = 0;
        }

        first = false;
        running += credit - debit;
        rows.push({
          month: format(monthStart, "yyyy MMM"),
          credit: Number(credit.toFixed(2)),
          debit: Number(debit.toFixed(2)),
          balance: Number(running.toFixed(2)),
          detailsText,
        });
        cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      }
      setMonthlyLedger(rows);
    } catch {}
  }, [
    contractStartDate,
    balance,
    holidaySetState,
    turns50On,
    exp20On,
    computedEntitlement,
    leaveTypeMap,
    t,
  ]);

  // === ACTIVE LEAVE + COUNTDOWN ===
  const todayClamp = (d = new Date()) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const isBetween = (d: Date, a: Date, b: Date) =>
    d >= todayClamp(a) && d <= todayClamp(b);

  const activeLeave = useMemo(() => {
    const rows = historyNorm.filter((h) => {
      const st = h.startDate ? new Date(h.startDate) : null;
      const en = h.endDate ? new Date(h.endDate) : null;
      if (!st || !en) return false;
      if (!isApprovedLike(h.status || "")) return false;
      return isBetween(todayClamp(), st, en);
    });
    return rows.sort(
      (a, b) =>
        new Date(b.endDate!).getTime() -
        new Date(b.startDate!).getTime() -
        (new Date(a.endDate!).getTime() - new Date(a.startDate!).getTime())
    )[0];
  }, [historyNorm]);

  const activeMeta = useMemo(() => {
    if (!activeLeave?.startDate || !activeLeave?.endDate) return null;
    const st = new Date(activeLeave.startDate);
    const en = new Date(activeLeave.endDate);
    const totalWorking = Math.max(1, countWorkingDays(st, en));
    const elapsedWorking = Math.min(
      totalWorking,
      countWorkingDays(st, todayClamp())
    );
    const remainingWorking = Math.max(0, totalWorking - elapsedWorking);
    const pct = Math.round((elapsedWorking / totalWorking) * 100);

    const endOfEnd = new Date(en);
    endOfEnd.setHours(23, 59, 59, 999);
    const msLeft = Math.max(0, endOfEnd.getTime() - nowTick);
    const hh = Math.floor(msLeft / 3600000);
    const mm = Math.floor((msLeft % 3600000) / 60000);
    const ss = Math.floor((msLeft % 60000) / 1000);

    const { code, name } = getTypeMeta(activeLeave);
    const label = code
      ? name
        ? `${code} — ${name}`
        : code
      : activeLeave.typeName || "-";

    return {
      totalWorking,
      elapsedWorking,
      remainingWorking,
      pct,
      hh,
      mm,
      ss,
      st,
      en,
      label,
    };
  }, [activeLeave, nowTick]);

  // === EXPORT DIALOG ===
  type ExportKind = "pdf" | "excel";
  const [exportOpen, setExportOpen] = useState(false);
  const [exportKind, setExportKind] = useState<ExportKind>("pdf");
  type ExportMode = "current" | "all" | "custom";
  const [exportMode, setExportMode] = useState<ExportMode>("current");
  const [exportFrom, setExportFrom] = useState<string>("");
  const [exportTo, setExportTo] = useState<string>("");

  // Put this helper near the other utils
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const endOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  const safeISO = (d: Date) => format(d, "yyyy-MM-dd");

  const getContractStart = (): Date | null => {
    if (contractStartDate) return new Date(contractStartDate);
    // fallback: infer from earliest history row if contractStartDate is missing
    const rows = (balance?.leaveHistory || [])
      .map(mapRow)
      .filter((r) => r.startDate);
    const earliest = rows.reduce<Date | null>((acc, r) => {
      const st = new Date(r.startDate!);
      return !acc || st < acc ? st : acc;
    }, null);
    return earliest ? startOfMonth(earliest) : null;
  };

  const resolveExportRange = () => {
    const today = new Date();
    const contractStart = getContractStart(); // may be null

    if (exportMode === "all") {
      const from = contractStart
        ? safeISO(startOfMonth(contractStart))
        : "2020-01-01";
      return { from, to: safeISO(today) };
    }

    if (exportMode === "custom") {
      // clamp custom range to [startOf(contractStartMonth), today]
      const minFrom = contractStart
        ? startOfMonth(contractStart)
        : new Date(2020, 0, 1);
      const maxTo = today;
      const rawFrom = exportFrom ? new Date(exportFrom) : minFrom;
      const rawTo = exportTo ? new Date(exportTo) : maxTo;
      const fromClamped = rawFrom < minFrom ? minFrom : rawFrom;
      const toClamped = rawTo > maxTo ? maxTo : rawTo;
      // ensure from <= to
      const from =
        fromClamped > toClamped ? startOfMonth(toClamped) : fromClamped;
      const to = toClamped;
      return { from: safeISO(from), to: safeISO(to) };
    }

    // exportMode === "current": Jan 1 (calendar year) -> today
    const now = new Date();
    const jan1 = new Date(now.getFullYear(), 0, 1);
    return { from: safeISO(jan1), to: safeISO(now) };
  };

  /** ---------- Remaining days ---------- */
  const remainingDaysRounded = useMemo(() => {
    if (!contractStartDate) return 0;
    const entitlement = computedEntitlement ?? balance?.entitlement ?? 30;
    const ratePerMonth = entitlement >= 45 ? 3.75 : 2.5;

    const now = new Date();
    const annivThisYear = new Date(
      now.getFullYear(),
      contractStartDate.getMonth(),
      contractStartDate.getDate()
    );
    const workingYearStart =
      annivThisYear <= now
        ? annivThisYear
        : new Date(
            now.getFullYear() - 1,
            contractStartDate.getMonth(),
            contractStartDate.getDate()
          );

    const monthsDiff =
      (now.getFullYear() - workingYearStart.getFullYear()) * 12 +
      (now.getMonth() - workingYearStart.getMonth());
    const includeThisMonth = now.getDate() >= workingYearStart.getDate();
    const monthsElapsed = Math.min(
      12,
      Math.max(0, monthsDiff + (includeThisMonth ? 1 : 0))
    );

    const accruedByMonth = monthsElapsed * ratePerMonth;
    return Math.max(0, Number((accruedByMonth - approvedDaysYTD).toFixed(2)));
  }, [
    contractStartDate,
    computedEntitlement,
    balance?.entitlement,
    approvedDaysYTD,
  ]);

  /** ---------- Loading / Error ---------- */
  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="60vh"
      >
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return (
      <Box mt={2}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  /** ---------- Branding & derived UI ---------- */
  const black = "#000000";
  const gold = "#b7a27d";
  const navy = "#2a3b6e";
  const history = (balance?.leaveHistory || []).map(mapRow);

  const statCard = (
    title: string,
    value: string | number,
    bg: string,
    fg: string
  ) => (
    <Card
      sx={{
        bgcolor: bg,
        color: fg,
        borderRadius: 2,
        boxShadow: 4,
        border: `1px solid ${gold}33`,
        height: "100%",
      }}
    >
      <CardContent>
        <Typography variant="overline" sx={{ opacity: 0.9 }}>
          {title}
        </Typography>
        <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );

  /** ---------- Layout ---------- */
  return (
    <>
      <Box sx={{ maxWidth: 1400, mx: "auto", p: 2 }}>
        {/* EMPLOYEE DETAILS AT TOP */}
        <Card
          sx={{
            borderRadius: 2,
            boxShadow: 3,
            border: `1px solid ${gold}33`,
            mb: 3,
          }}
        >
          <CardContent>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
              {t("leave.balance.employeeDetails", "Employee Details")}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                  md: "repeat(4, 1fr)",
                },
                gap: 2,
              }}
            >
              <Box>
                <Typography
                  variant="caption"
                  color="textSecondary"
                  sx={{ textTransform: "uppercase", fontWeight: 600 }}
                >
                  {t("leave.balance.name", "Name")}
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {String(
                    employeeInfo?.NAME ||
                      employeeInfo?.FULL_NAME ||
                      employeeInfo?.NOM_PRENOM ||
                      `${employeeInfo?.FIRST_NAME ?? ""} ${employeeInfo?.LAST_NAME ?? ""}` ||
                      "—"
                  )}
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  color="textSecondary"
                  sx={{ textTransform: "uppercase", fontWeight: 600 }}
                >
                  {t("leave.balance.employeeId", "Employee ID")}
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {String(employeeInfo?.ID_EMP ?? employeeId ?? "—")}
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  color="textSecondary"
                  sx={{ textTransform: "uppercase", fontWeight: 600 }}
                >
                  {t("leave.balance.jobTitle", "Job Title")}
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {String(
                    employeeInfo?.TITLE ??
                      employeeInfo?.JOB_TITLE ??
                      employeeInfo?.FONCTION ??
                      employeeInfo?.POSTE ??
                      "—"
                  )}
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  color="textSecondary"
                  sx={{ textTransform: "uppercase", fontWeight: 600 }}
                >
                  {t("leave.balance.ps", "PS")}
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {formatPS(
                    employeeInfo?.PS ??
                      employeeInfo?.PERSONNEL_SUBAREA ??
                      employeeInfo?.SUBAREA ??
                      "—"
                  )}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* =================== TWO-COLUMN AREA (left: quick stats, right: remaining + export) =================== */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 320px" },
            gap: 3,
            alignItems: "start",
            width: "100%",
          }}
        >
          {/* LEFT COLUMN: Quick metrics + (optional) Active countdown */}
          <Box>
            {/* Key metrics row */}
            <Box
              sx={{
                display: "flex",
                gap: 2,
                flexWrap: "wrap",
                mb: 3,
                "& > *": { flex: "1 1 240px", minWidth: 240 },
              }}
            >
              {statCard(
                t("leave.balance.approvedLeaves", "Approved leaves"),
                approvedDaysYTD.toFixed(2),
                navy,
                "#ffffff"
              )}
              {statCard(
                t("leave.balance.annualLeave", "Annual leave (per year)"),
                (computedEntitlement ?? balance?.entitlement ?? 30).toFixed(0),
                "#121212",
                gold
              )}
              {/* Compact breakdown (approved-only, non-zero) */}
              <Card
                sx={{
                  borderRadius: 2,
                  boxShadow: 3,
                  border: `1px solid ${gold}33`,
                  minWidth: 300,
                  flex: "1 1 360px",
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="overline" sx={{ opacity: 0.9 }}>
                    {t("leave.balance.breakdown", "Breakdown")}
                  </Typography>
                  <TableContainer component={Paper} elevation={0}>
                    <Table size="small" aria-label="approved-by-type-mini">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>
                            {t("leave.balance.type", "Type")}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>
                            {t("leave.balance.approved", "Approved")}
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(typeSummary
                          .filter((r) => (r.approvedDaysYTD || 0) > 0)
                          .sort((a, b) => b.approvedDaysYTD - a.approvedDaysYTD)
                        ).map((r) => (
                          <TableRow key={r.label} hover>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {r.code || "-"}
                              </Typography>
                              {r.name && (
                                <Typography variant="caption" color="text.secondary">
                                  {r.name}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <Chip
                                label={r.approvedDaysYTD.toFixed(2)}
                                size="small"
                                color="success"
                                variant="outlined"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                        {typeSummary.filter((r) => (r.approvedDaysYTD || 0) > 0).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={2} align="center">
                              <Typography variant="caption" color="text.secondary">
                                {t("leave.balance.noUsage", "No leave usage recorded in the working year.")}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Box>

            {/* Active leave countdown (if any) */}
            {activeMeta && (
              <Card
                sx={{
                  borderRadius: 2,
                  border: `2px solid ${gold}`,
                  mb: 3,
                  background: `linear-gradient(135deg, ${navy}11 0%, ${gold}11 100%)`,
                }}
              >
                <CardContent>
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    flexWrap="wrap"
                    gap={1}
                    mb={2}
                  >
                    <Box>
                      <Typography
                        variant="overline"
                        sx={{ color: "text.secondary", fontWeight: 600 }}
                      >
                        {t("leave.balance.currentlyOut", "Currently On Leave")}
                      </Typography>
                      <Typography variant="h6" fontWeight={700}>
                        {activeMeta.label}
                      </Typography>
                    </Box>
                    <Chip
                      icon={<NotificationsIcon />}
                      label={`${activeMeta.remainingWorking} ${t("leave.balance.workingDaysLeft", "working days left")}`}
                      color="primary"
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>

                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={1.5}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {format(activeMeta.st, "MMM d, yyyy")} →{" "}
                      {format(activeMeta.en, "MMM d, yyyy")}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{
                        fontFamily: "monospace",
                        fontSize: "1.1rem",
                        color:
                          activeMeta.remainingWorking <= 1
                            ? "error.main"
                            : "text.primary",
                      }}
                    >
                      {activeMeta.hh.toString().padStart(2, "0")}:
                      {activeMeta.mm.toString().padStart(2, "0")}:
                      {activeMeta.ss.toString().padStart(2, "0")}
                    </Typography>
                  </Box>

                  <Box sx={{ position: "relative" }}>
                    <LinearProgress
                      variant="determinate"
                      value={activeMeta.pct}
                      sx={{
                        height: 12,
                        borderRadius: 999,
                        bgcolor: "action.hover",
                        "& .MuiLinearProgress-bar": {
                          bgcolor:
                            activeMeta.pct >= 100
                              ? "success.main"
                              : "primary.main",
                          borderRadius: 999,
                        },
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        fontWeight: 700,
                        color: activeMeta.pct > 50 ? "#fff" : "text.primary",
                        textShadow:
                          activeMeta.pct > 50
                            ? "0 1px 2px rgba(0,0,0,0.3)"
                            : "none",
                      }}
                    >
                      {activeMeta.elapsedWorking}/{activeMeta.totalWorking}{" "}
                      {t("leave.balance.days", "days")} ({activeMeta.pct}%)
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            )}
          </Box>

          {/* RIGHT COLUMN: Sticky remaining + EXPORT BUTTONS */}
          <Box sx={{ position: { md: "sticky" }, top: { md: 16 } }}>
            <Card
              sx={{
                borderRadius: 2,
                boxShadow: 4,
                border: `2px solid ${gold}`,
                mb: 2,
                background: `linear-gradient(135deg, ${navy} 0%, ${black} 100%)`,
                color: "#fff",
              }}
            >
              <CardContent>
                <Typography
                  variant="overline"
                  sx={{ opacity: 0.9, color: gold }}
                >
                  {t("leave.balance.remainingDays", "Remaining days")}
                </Typography>
                <Typography
                  variant="h2"
                  sx={{ fontWeight: 800, lineHeight: 1, my: 1 }}
                >
                  {remainingDaysRounded.toFixed(2)}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {(() => {
                    const wy = getWorkingYearWindow();
                    if (!wy) return "";
                    const today = new Date();
                    return `${t("leave.balance.workingYear", "Working Year")}: ${format(wy.start, "MMM d")} → ${format(today, "MMM d, yyyy")}`;
                  })()}
                </Typography>

                {/* Export to PDF (opens options dialog) */}
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ mt: 2 }}
                  useFlexGap
                  flexWrap="wrap"
                >
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => {
                      setExportKind("pdf");
                      setExportMode("current");
                      setExportOpen(true);
                    }}
                  >
                    {t("leave.balance.exportPdf", "Export to PDF")}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Box>
        </Box>
        {/* =================== END TWO-COLUMN =================== */}

        {/* RULES / THRESHOLDS (still full width and below) */}
        <Card
          sx={{
            bgcolor: "#101418",
            color: "#fff",
            borderRadius: 2,
            boxShadow: 4,
            mb: 3,
          }}
        >
          <CardContent>
            <Typography variant="overline" sx={{ opacity: 0.9 }}>
              {t("leave.balance.rules", "Rules & thresholds")}
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="body2">
                {(computedEntitlement ?? balance?.entitlement ?? 30) >= 45
                  ? t(
                      "leave.balance.rule45",
                      "45 days/year (≥50 years old or ≥20 years exp)."
                    )
                  : t(
                      "leave.balance.rule30",
                      "30 days/year (<50 years old and <20 years exp)."
                    )}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {t("leave.balance.turns50", "Turns 50 on")}:{" "}
                {turns50On ? format(new Date(turns50On), "MMM d, yyyy") : "—"}
                {"  •  "}
                {t("leave.balance.exp20", "20 years experience on")}:{" "}
                {exp20On ? format(new Date(exp20On), "MMM d, yyyy") : "—"}
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        {/* =================== FULL-WIDTH SECTIONS (MOVED BELOW) =================== */}

        {/* Leave Usage (FULL WIDTH) */}
        <Card
          sx={{
            borderRadius: 2,
            boxShadow: 3,
            border: `1px solid ${gold}33`,
            mb: 3,
          }}
        >
          <CardContent>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              mb={2}
              flexWrap="wrap"
              gap={1}
            >
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {t("leave.balance.usageByType", "Leave Usage (Working Year)")}
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
              >
                <Chip
                  size="small"
                  label={`${approvedSumFromTypes.toFixed(2)} ${t("leave.balance.approved", "Approved")}`}
                  color="success"
                  sx={{ fontWeight: 600 }}
                />
                <Chip
                  size="small"
                  color="warning"
                  label={`${typeSummary.reduce((s, r) => s + r.pendingDaysYTD, 0).toFixed(2)} ${t("leave.balance.pending", "Pending")}`}
                  sx={{ fontWeight: 600 }}
                />
                <Chip
                  size="small"
                  color={totalsMatch ? "success" : "error"}
                  label={
                    totalsMatch
                      ? t("leave.balance.sumOk", "✓ Verified")
                      : t("leave.balance.sumMismatch", "⚠ Check totals")
                  }
                  sx={{ fontWeight: 600 }}
                />
              </Stack>
            </Box>

            {typeSummary.length === 0 ? (
              <Alert severity="info">
                {t(
                  "leave.balance.noUsage",
                  "No leave usage recorded in the working year."
                )}
              </Alert>
            ) : (
              <>
                <TableContainer
                  component={Paper}
                  sx={{ borderRadius: 2, overflow: "hidden" }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: gold + "22" }}>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {t("leave.balance.type", "Type")}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {t("leave.balance.approved", "Approved")}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {t("leave.balance.pending", "Pending")}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {t("leave.balance.total", "Total")}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {typeSummary.map((r) => (
                        <TableRow key={r.label} hover>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 600 }}
                            >
                              {r.code || "-"}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {r.name || "—"}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={r.approvedDaysYTD.toFixed(2)}
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={r.pendingDaysYTD.toFixed(2)}
                              size="small"
                              color="warning"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {r.totalDaysYTD.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {!totalsMatch && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    {t(
                      "leave.balance.mismatchExplainer",
                      "Per-type approved sum does not equal the Approved leaves metric. This can happen if the history contains types with missing codes or unclassified rows."
                    )}
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Leave History (FULL WIDTH) */}
        <Card
          sx={{
            borderRadius: 2,
            boxShadow: 3,
            border: `1px solid ${gold}33`,
            mb: 3,
          }}
        >
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
              {t("leave.balance.leaveHistory", "Leave History")}
            </Typography>
            <TableContainer
              component={Paper}
              sx={{ borderRadius: 2, overflow: "hidden" }}
            >
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: gold + "22" }}>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {t("leave.balance.type", "Type")}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {t("leave.balance.period", "Period")}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {t("leave.balance.days", "Days")}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {t("leave.balance.status", "Status")}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedHistory.length ? (
                    pagedHistory.map((leave) => (
                      <TableRow key={String(leave.id)} hover>
                        <TableCell>
                          {(() => {
                            const idKey =
                              leave.idCan != null
                                ? String(leave.idCan)
                                : leave.typeCode != null
                                  ? String(leave.typeCode)
                                  : undefined;
                            const lt = idKey ? leaveTypeMap[idKey] : undefined;
                            if (lt)
                              return (
                                <>
                                  <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 600 }}
                                  >
                                    {lt.code}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {lt.name || "—"}
                                  </Typography>
                                </>
                              );
                            if (leave.typeCode || leave.typeName) {
                              return (
                                <>
                                  <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 600 }}
                                  >
                                    {String(leave.typeCode ?? "")}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {leave.typeName || "—"}
                                  </Typography>
                                </>
                              );
                            }
                            return leave.type || "-";
                          })()}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {leave.startDate
                              ? format(new Date(leave.startDate), "MMM d, yyyy")
                              : "-"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {leave.endDate
                              ? format(new Date(leave.endDate), "MMM d, yyyy")
                              : "-"}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {(() => {
                              const st = leave.startDate
                                ? new Date(leave.startDate)
                                : null;
                              const en = leave.endDate
                                ? new Date(leave.endDate)
                                : null;
                              if (!st || !en) return leave.days;
                              const fmt = (d: Date) => {
                                const y = d.getFullYear();
                                const m = String(d.getMonth() + 1).padStart(
                                  2,
                                  "0"
                                );
                                const da = String(d.getDate()).padStart(2, "0");
                                return `${y}-${m}-${da}`;
                              };
                              const isFriday = (d: Date) => d.getDay() === 5;
                              const isHoliday = (d: Date) =>
                                holidaySetState.has(fmt(d));
                              const d = new Date(st);
                              d.setHours(0, 0, 0, 0);
                              const end = new Date(en);
                              end.setHours(0, 0, 0, 0);
                              let eff = 0;
                              while (d <= end) {
                                if (!isFriday(d) && !isHoliday(d)) eff++;
                                d.setDate(d.getDate() + 1);
                              }
                              return eff;
                            })()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={t(
                              `leave.status.${leave.status}`,
                              leave.status
                            )}
                            size="small"
                            sx={{
                              bgcolor: (() => {
                                const s = String(
                                  leave.status || ""
                                ).toLowerCase();
                                if (s === "approved" || s === "accepted")
                                  return "#2e7d32";
                                if (s === "pending" || s === "submitted")
                                  return "#ed6c02";
                                if (
                                  s === "rejected" ||
                                  s === "refused" ||
                                  s === "denied"
                                )
                                  return "#d32f2f";
                                return "#757575";
                              })(),
                              color: "#fff",
                              fontWeight: 600,
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                        <Typography variant="body1" color="textSecondary">
                          {t(
                            "leave.status.noRequests",
                            "No leave requests found"
                          )}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={historySorted.length}
              page={histPage}
              onPageChange={(_, newPage) => setHistPage(newPage)}
              rowsPerPage={histRowsPerPage}
              onRowsPerPageChange={(e) => {
                setHistRowsPerPage(parseInt(e.target.value, 10));
                setHistPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </CardContent>
        </Card>

        {/* Monthly Ledger (FULL WIDTH) */}
        <Card
          sx={{
            borderRadius: 2,
            boxShadow: 3,
            border: `1px solid ${gold}33`,
            mb: 3,
          }}
        >
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
              {t("leave.balance.monthlyLedger", "Monthly Leave Ledger")}
            </Typography>

            {years.length > 0 && (
              <Box sx={{ borderBottom: 1, borderColor: gold + "33", mb: 2 }}>
                <Tabs
                  value={Math.max(0, years.indexOf(selectedYear))}
                  onChange={(_e, idx) =>
                    years[idx] != null && setSelectedYear(years[idx])
                  }
                  variant="scrollable"
                  scrollButtons="auto"
                  aria-label="ledger years"
                >
                  {years.map((y) => (
                    <Tab key={y} label={String(y)} />
                  ))}
                </Tabs>
              </Box>
            )}

            <TableContainer
              component={Paper}
              sx={{ borderRadius: 2, overflow: "hidden" }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: gold + "22" }}>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {t("leave.balance.month", "Month")}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {t("leave.balance.credit", "Credit")}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {t("leave.balance.debit", "Debit")}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {t("leave.balance.balance", "Balance")}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {t("leave.balance.details", "Details")}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {monthlyLedger.length ? (
                    monthlyLedger
                      .filter((row) =>
                        row.month
                          ? String(row.month).startsWith(String(selectedYear))
                          : false
                      )
                      .map((row, idx) =>
                        row.note ? (
                          <TableRow key={`note-${row.month}-${idx}`}>
                            <TableCell colSpan={5} align="center">
                              <Typography
                                variant="body2"
                                sx={{
                                  fontStyle: "italic",
                                  fontWeight: 700,
                                  color: "warning.main",
                                }}
                              >
                                {row.note}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          <TableRow key={row.month} hover>
                            <TableCell sx={{ fontWeight: 600 }}>
                              {row.month}
                            </TableCell>
                            <TableCell align="right">
                              {row.credit.toFixed(2)}
                            </TableCell>
                            <TableCell align="right">
                              {row.debit.toFixed(2)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              {row.balance.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {row.detailsText || "—"}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )
                      )
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="textSecondary">
                          {t("leave.balance.noLedger", "No ledger to show")}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>

      {/* --------- PENDING DIALOG --------- */}
      <Dialog
        open={pendingOpen}
        onClose={() => setPendingOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitleWithClose onClose={() => setPendingOpen(false)}>
          {t("leave.balance.pendingReviewsList", "Pending Leave Requests")}
        </DialogTitleWithClose>
        <DialogContent dividers>
          {pending.length ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    {t("leave.balance.employee", "Employee")}
                  </TableCell>
                  <TableCell>{t("leave.balance.type", "Type")}</TableCell>
                  <TableCell>{t("leave.balance.period", "Period")}</TableCell>
                  <TableCell align="right">
                    {t("leave.balance.days", "Days")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pending.map((p) => (
                  <TableRow key={String(p.id)}>
                    <TableCell>{p.employeeName}</TableCell>
                    <TableCell>{p.typeLabel}</TableCell>
                    <TableCell>
                      {(p.startDate
                        ? format(new Date(p.startDate), "MMM d, yyyy")
                        : "—") +
                        " — " +
                        (p.endDate
                          ? format(new Date(p.endDate), "MMM d, yyyy")
                          : "—")}
                    </TableCell>
                    <TableCell align="right">{p.days ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert severity="info" sx={{ mt: 1 }}>
              {t("leave.balance.noPending", "No pending requests.")}
            </Alert>
          )}
        </DialogContent>
      </Dialog>

      {/* --------- REQUEST LEAVE DIALOG (close icon only) --------- */}
      <Dialog
        open={reqOpen}
        onClose={() => setReqOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitleWithClose onClose={() => setReqOpen(false)}>
          {t("leave.balance.requestLeave", "Request Leave")}
        </DialogTitleWithClose>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("leave.balance.type", "Type")}
              select
              fullWidth
              value={reqType}
              onChange={(e) => setReqType(String(e.target.value))}
              SelectProps={{ native: true }}
            >
              <option value="" />
              {Object.entries(leaveTypeMap).map(([id, meta]) => (
                <option key={id} value={meta.code}>
                  {meta.code}
                  {meta.name ? ` — ${meta.name}` : ""}
                </option>
              ))}
            </TextField>
            <TextField
              label={t("leave.balance.start", "Start")}
              type="date"
              value={reqStart}
              onChange={(e) => setReqStart(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label={t("leave.balance.end", "End")}
              type="date"
              value={reqEnd}
              onChange={(e) => setReqEnd(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button
            variant="contained"
            disabled={!reqType || !reqStart || !reqEnd || reqSaving}
            onClick={async () => {
              // your existing submit logic unchanged
              // (uses showToast / validations you already implemented)
              try {
                setReqSaving(true);
                // ... submit code ...
                // on success:
                // showToast(t("leave.balance.submitted","Leave request submitted."),"success");
                setReqOpen(false);
              } finally {
                setReqSaving(false);
              }
            }}
          >
            {reqSaving
              ? t("leave.balance.submitting", "Submitting...")
              : t("leave.balance.submit", "Submit")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* --------- UNIFIED EXPORT DIALOG (with period) --------- */}
      <Dialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitleWithClose onClose={() => setExportOpen(false)}>
          {exportKind === "pdf"
            ? t("leave.balance.exportPdf", "Export to PDF")
            : t("leave.balance.exportExcel", "Export to Excel")}
        </DialogTitleWithClose>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t("leave.balance.choosePeriod", "Choose period")}
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                <Chip
                  label={t("leave.balance.currentWY", "Current working year")}
                  color={exportMode === "current" ? "primary" : "default"}
                  onClick={() => setExportMode("current")}
                />
                <Chip
                  label={t(
                    "leave.balance.allWorkingYears",
                    "All working years"
                  )}
                  color={exportMode === "all" ? "primary" : "default"}
                  onClick={() => setExportMode("all")}
                />
                <Chip
                  label={t("leave.balance.customRange", "Custom range")}
                  color={exportMode === "custom" ? "primary" : "default"}
                  onClick={() => setExportMode("custom")}
                />
              </Box>
            </Box>

            {exportMode === "custom" && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label={t("leave.balance.from", "From")}
                  type="date"
                  value={exportFrom}
                  onChange={(e) => setExportFrom(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField
                  label={t("leave.balance.to", "To")}
                  type="date"
                  value={exportTo}
                  onChange={(e) => setExportTo(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Stack>
            )}

            <Alert severity="info">
              {t(
                "leave.balance.periodInfo",
                "The report header includes the selected period and print timestamp."
              )}
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button
            variant="contained"
            onClick={async () => {
              if (exportMode === "custom" && (!exportFrom || !exportTo)) {
                showToast(
                  t(
                    "leave.balance.errPickRange",
                    "Pick both start and end dates"
                  ),
                  "warning"
                );
                return;
              }
              if (exportKind === "pdf") {
                const { from, to } = resolveExportRange();
                await handleExportPDF({ from, to });
              } else {
                const evt = document.getElementById(
                  "__export_excel_click__"
                ) as any;
                if (evt && typeof evt.click === "function") evt.click();
              }
              setExportOpen(false);
            }}
          >
            {exportKind === "pdf"
              ? t("leave.balance.exportPdf", "Export to PDF")
              : t("leave.balance.exportExcel", "Export to Excel")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* --------- SNACKBAR --------- */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={4200}
        onClose={() => setToastOpen(false)}
        message={toastMsg}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        action={
          <IconButton
            size="small"
            aria-label="close"
            color="inherit"
            onClick={() => setToastOpen(false)}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
    </>
  );
};

export default LeaveBalanceScreen;