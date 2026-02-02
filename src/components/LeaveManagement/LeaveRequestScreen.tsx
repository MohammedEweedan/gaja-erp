/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Divider,
  Chip,
  Stack,
  Paper,
  Typography,
  Tooltip,
  Snackbar,
  Card,
  CardContent,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import api from "../../api";
import { Close as CloseIcon } from "@mui/icons-material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { enGB } from "date-fns/locale";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { PickersDay, PickersDayProps } from "@mui/x-date-pickers/PickersDay";
import {
  createLeaveRequest,
  getLeaveTypes,
  getHolidays,
  getLeaveBalance,
  getLeaveRequests,
  previewLeaveDays,
} from "../../services/leaveService";

/** ---------------- Types ---------------- */
interface LeaveTypeOption {
  int_can: number;
  desig_can: string;
  code: string;
  max_day?: number | null;
}

interface LeaveRequestForm {
  leaveCode: number | "";
  startDate: Date | null;
  endDate: Date | null;
  reason: string;
  contactNumber: string;
}

type HistoryRow = {
  int_con?: number | string;
  id?: number | string;
  id_can?: number | string;
  code?: string | number;
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

/** ---------------- Sidebar-adaptive props (optional) ---------------- */
type SidebarAdaptive = {
  /** If your layout toggles a sidebar, pass this to animate content width. */
  sidebarOpen?: boolean;
  /** Widths (px) of the sidebar in open/collapsed states. Defaults work with typical drawers. */
  sidebarWidth?: number; // e.g., 280
  sidebarCollapsedWidth?: number; // e.g., 72
};

/** ---------------- Helpers ---------------- */
const firstHolidayInRange = (
  start: Date,
  end: Date,
  isHolidayFn: (d: Date) => boolean
) => {
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(0, 0, 0, 0);
  if (e < s) return null;
  const d = new Date(s);
  while (d <= e) {
    if (isHolidayFn(d)) return new Date(d);
    d.setDate(d.getDate() + 1);
  }
  return null;
};

const isFriday = (d: Date) => d.getDay() === 5; // Friday off
const MAX_SINGLE_REQUEST_CALENDAR_DAYS = 30;

const firstDefined = (...vals: any[]) =>
  vals.find((v) => v !== undefined && v !== null && String(v).trim?.() !== "");

const toISO10 = (v: any) => {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  }
  return "";
};

const parseISOLocal = (iso10: string) => {
  if (!iso10) return new Date(NaN);
  const [y, m, d] = iso10.split("-").map((n) => Number(n));
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
};

const toDMY = (date: Date | string | null | undefined) => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : new Date(date);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
};

/** ---------------- Component ---------------- */
const LeaveRequestScreen: React.FC<
  { employeeId?: number | string } & SidebarAdaptive
> = ({
  employeeId,
  sidebarOpen,
  sidebarWidth = 280,
  sidebarCollapsedWidth = 72,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const upMd = useMediaQuery(theme.breakpoints.up("md"));
  const upLg = useMediaQuery(theme.breakpoints.up("lg"));

  const [formData, setFormData] = useState<LeaveRequestForm>({
    leaveCode: "",
    startDate: null,
    endDate: null,
    reason: "",
    contactNumber: "",
  });

  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const [calculatedDays, setCalculatedDays] = useState<number>(0);
  const [daysRequested, setDaysRequested] = useState<number>(0);
  const [previewExcluded, setPreviewExcluded] = useState<any | null>(null);

  const [holidaySet, setHolidaySet] = useState<Set<string>>(new Set());
  const [holidayNameMap, setHolidayNameMap] = useState<Record<string, string>>(
    {}
  );
  const [remainingDays, setRemainingDays] = useState<number | null>(null);
  const [daysError, setDaysError] = useState<string | null>(null);
  const [submitLock, setSubmitLock] = useState(false);

  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);

  const [leaveHistory, setLeaveHistory] = useState<
    Array<{
      id?: string | number;
      startISO: string;
      endISO: string;
      status?: string;
    }>
  >([]);

  // Sidebar-adaptive wrapper (works even if you don’t pass props; also respects CSS var)
  const contentRef = useRef<HTMLDivElement | null>(null);
  const effectiveSidebarWidth =
    typeof window !== "undefined"
      ? Number(
          getComputedStyle(document.documentElement)
            .getPropertyValue("--sidebar-width")
            .replace("px", "")
        ) || (sidebarOpen ? sidebarWidth : sidebarCollapsedWidth)
      : sidebarOpen
        ? sidebarWidth
        : sidebarCollapsedWidth;

  useEffect(() => {
    if (!contentRef.current) return;
    contentRef.current.style.setProperty(
      "--content-ml",
      `${effectiveSidebarWidth}px`
    );
  }, [effectiveSidebarWidth]);

  useEffect(() => {
    const fetchLeaveTypes = async () => {
      try {
        setLoading(true);
        const types = await getLeaveTypes();
        setLeaveTypes(Array.isArray(types) ? types : []);
      } catch (err) {
        setError(t("leave.request.fetchError"));
        console.error("Error fetching leave types:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaveTypes();
  }, [t]);

  const StatTile: React.FC<{ title: string; value: React.ReactNode }> = ({
    title,
    value,
  }) => (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        height: "100%",
        bgcolor: (t) =>
          t.palette.mode === "dark" ? "background.default" : "background.paper",
      }}
    >
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ letterSpacing: 0.5 }}
      >
        {title}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
    </Paper>
  );

  const refreshBalanceAndHistory = useCallback(async () => {
    const empId = String(employeeId ?? "");
    if (!empId) return;

    const [bal, reqs] = await Promise.allSettled([
      getLeaveBalance(empId),
      getLeaveRequests(empId),
    ]);

    if (bal.status === "fulfilled") {
      const b: any = bal.value;
      const rem = Number(
        b?.remaining ?? b?.Remaining ?? b?.data?.remaining ?? 0
      );
      setRemainingDays(Number.isFinite(rem) ? rem : 0);
    }

    const histA: HistoryRow[] =
      bal.status === "fulfilled" && Array.isArray(bal.value?.leaveHistory)
        ? bal.value.leaveHistory
        : [];
    const histB: HistoryRow[] =
      reqs.status === "fulfilled" && Array.isArray(reqs.value)
        ? reqs.value
        : [];

    const byId = new Map<string, HistoryRow>();
    [...histA, ...histB].forEach((r) => {
      const k = String(r.int_con ?? r.id ?? Math.random());
      byId.set(k, r);
    });

    const norm = Array.from(byId.values())
      .map((r) => {
        const startISO = toISO10(
          firstDefined(
            r.startDate,
            (r as any).DATE_START,
            r.date_depart,
            (r as any).DATE_DEPART,
            (r as any).start_date
          )
        );
        const endISO = toISO10(
          firstDefined(
            r.endDate,
            (r as any).DATE_END,
            r.date_end,
            (r as any).DATE_FIN,
            (r as any).end_date
          )
        );
        const status = String(
          firstDefined(
            r.status,
            (r as any).STATUS,
            r.state,
            (r as any).STATUT
          ) || ""
        ).toLowerCase();
        return { id: r.int_con ?? r.id, startISO, endISO, status };
      })
      .filter((r) => r.startISO && r.endISO);

    setLeaveHistory(norm);
  }, [employeeId]);

  const sumEmergencyDays = (
    history: { startISO: string; endISO: string; status?: string }[],
    year: number,
    month?: number,
    isNonWorkingFn?: (d: Date) => boolean
  ) => {
    const relevant = history.filter((r) => {
      const st = parseISOLocal(r.startISO);
      const en = parseISOLocal(r.endISO);
      if (isNaN(st.getTime()) || isNaN(en.getTime())) return false;
      const yMatches =
        st.getFullYear() === year ||
        en.getFullYear() === year ||
        (st.getFullYear() < year && en.getFullYear() > year);
      if (!yMatches) return false;
      return true;
    });

    let total = 0;
    for (const r of relevant) {
      const st = parseISOLocal(r.startISO);
      const en = parseISOLocal(r.endISO);
      const winStart = new Date(year, month ?? 0, 1, 0, 0, 0, 0);
      const winEnd = new Date(
        year,
        month != null ? month : 11,
        month != null ? new Date(year, month + 1, 0).getDate() : 31,
        23,
        59,
        59,
        999
      );
      const a = st > winStart ? st : winStart;
      const b = en < winEnd ? en : winEnd;
      if (b >= a) {
        total += countWorkingDays(a, b, isNonWorking);
      }
    }
    return total;
  };

  // Load holidays (use ranged query so backend expands fixed/islamic holidays)
  const holidayRangeKeyRef = useRef<string>("");
  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const now = new Date();
        const st = formData.startDate ?? now;
        const en = formData.endDate ?? formData.startDate ?? now;
        const a = new Date(st);
        const b = new Date(en);
        if (isNaN(a.getTime()) || isNaN(b.getTime())) return;

        const minY = Math.min(a.getFullYear(), b.getFullYear()) - 1;
        const maxY = Math.max(a.getFullYear(), b.getFullYear()) + 1;
        const rangeStart = `${minY}-01-01`;
        const rangeEnd = `${maxY}-12-31`;
        const key = `${rangeStart}|${rangeEnd}`;
        if (holidayRangeKeyRef.current === key) return;
        holidayRangeKeyRef.current = key;

        const resp: any = await getHolidays({ startDate: rangeStart, endDate: rangeEnd });
        const arr = Array.isArray(resp) ? resp : resp?.data || [];
        const set = new Set<string>();
        const names: Record<string, string> = {};
        arr.forEach((h: any) => {
          const iso = toISO10(firstDefined(h.DATE_H, h.date, h.holiday_date));
          if (iso) {
            set.add(iso);
            const nm = String(
              firstDefined(h.HOLIDAY_NAME, h.holiday_name, h.COMMENT_H, h.comment) ||
                ""
            ).trim();
            if (nm) names[iso] = nm;
          }
        });
        try {
          const raw = localStorage.getItem("custom_holidays");
          if (raw) {
            const extra = JSON.parse(raw);
            if (Array.isArray(extra)) {
              extra.forEach((h: any) => {
                const iso = toISO10(
                  firstDefined(h.DATE_H, h.date, h.holiday_date)
                );
                if (iso) {
                  set.add(iso);
                  const nm = String(
                    firstDefined(
                      h.HOLIDAY_NAME,
                      h.holiday_name,
                      h.COMMENT_H,
                      h.comment
                    ) || ""
                  ).trim();
                  if (nm) names[iso] = nm;
                }
              });
            }
          }
        } catch {}
        setHolidaySet(set);
        setHolidayNameMap(names);
      } catch {}
    };
    loadHolidays();
  }, [formData.startDate, formData.endDate]);

  useEffect(() => {
    refreshBalanceAndHistory().catch(() => {
      setRemainingDays(null);
      setLeaveHistory([]);
    });
  }, [refreshBalanceAndHistory]);

  const fmtISO = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  };

  const isHoliday = useCallback(
    (d: Date) => holidaySet.has(fmtISO(d)),
    [holidaySet]
  );
  const isNonWorking = useCallback(
    (d: Date) => isFriday(d) || isHoliday(d),
    [isHoliday]
  );

  const computeEndDate = useCallback(
    (start: Date, requestedDays: number, lt?: LeaveTypeOption | null) => {
      if (!start || !Number.isFinite(requestedDays) || requestedDays <= 0)
        return null;

      const s = new Date(start);
      s.setHours(0, 0, 0, 0);

      // Sick leave counts calendar days (do not skip Fridays/holidays)
      if (isSickLike(lt)) {
        const d = new Date(s);
        d.setDate(d.getDate() + (requestedDays - 1));
        return d;
      }

      // For all other leave types: count working days only (skip Fridays + holidays)
      let counted = 0;
      const d = new Date(s);
      while (counted < requestedDays) {
        if (!isNonWorking(d)) counted += 1;
        if (counted >= requestedDays) break;
        d.setDate(d.getDate() + 1);
        if (d.getTime() - s.getTime() > 1000 * 60 * 60 * 24 * 370) break;
      }
      return d;
    },
    [isNonWorking]
  );

  const uploadDoctorNote = async (requestId: number | string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    await api.post(`/leave/leave-request/${requestId}/doctor-note`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  };

  const toDate = (v: any): Date | null => {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof (v as any).toDate === "function") {
      const d = (v as any).toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    }
    if (typeof v === "string") {
      const d = new Date(v);
      return !isNaN(d.getTime()) ? d : null;
    }
    try {
      const d = new Date(v as any);
      return !isNaN(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  };

  const isApprovedLike = (status?: string) => {
    const s = String(status || "").toLowerCase();
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
  const isPendingLike = (status?: string) => {
    const s = String(status || "").toLowerCase();
    return [
      "pending",
      "submitted",
      "awaiting",
      "waiting",
      "in review",
      "under review",
      "en attente",
    ].some((tk) => s.includes(tk));
  };

  const [doctorNoteFile, setDoctorNoteFile] = useState<File | null>(null);
  const [doctorNotePreview, setDoctorNotePreview] = useState<string | null>(
    null
  );
  const [uploadingNote, setUploadingNote] = useState(false);

  const onDoctorNoteChange = (file: File | null) => {
    if (!file) {
      setDoctorNoteFile(null);
      setDoctorNotePreview(null);
      return;
    }
    if (file.type !== "image/jpeg") {
      setError(
        t("leave.request.noteTypeError", "Doctor's note must be a JPG image.")
      );
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(
        t("leave.request.noteSizeError", "Doctor's note must be under 5MB.")
      );
      return;
    }
    setError(null);
    setDoctorNoteFile(file);
    setDoctorNotePreview(URL.createObjectURL(file));
  };

  const validateNoOverlap = useCallback(
    (startISO: string, endISO: string) => {
      const s = parseISOLocal(startISO);
      const e = parseISOLocal(endISO);
      if (isNaN(s.getTime()) || isNaN(e.getTime()))
        return { ok: false, conflicts: [] as typeof leaveHistory };

      const conflicts = leaveHistory.filter((r) => {
        const st = parseISOLocal(r.startISO);
        const en = parseISOLocal(r.endISO);
        if (isNaN(st.getTime()) || isNaN(en.getTime())) return false;
        if (!isApprovedLike(r.status) && !isPendingLike(r.status)) return false;
        return s <= en && e >= st;
      });

      return { ok: conflicts.length === 0, conflicts };
    },
    [leaveHistory]
  );

  const isSickLike = (lt?: LeaveTypeOption | null) => {
    if (!lt) return false;
    const code = (lt.code || "").toUpperCase();
    const name = (lt.desig_can || "").toUpperCase();
    return code === "SL" || name.includes("SICK");
  };

  const isEmergencyLike = (lt?: LeaveTypeOption | null) => {
    if (!lt) return false;
    const code = (lt.code || "").toUpperCase();
    const name = (lt.desig_can || "").toUpperCase();
    return code === "EL" || name.includes("EMERGENCY");
  };

  const EMERGENCY_DAYS_PER_YEAR_MAX = 12;
  const EMERGENCY_DAYS_PER_MONTH_MAX = 3;

  const countWorkingDays = (
    start: Date,
    end: Date,
    isNonWorkingFn: (d: Date) => boolean
  ) => {
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(end);
    e.setHours(0, 0, 0, 0);
    if (e < s) return 0;
    let c = 0;
    const d = new Date(s);
    while (d <= e) {
      if (!isNonWorkingFn(d)) c++;
      d.setDate(d.getDate() + 1);
      if (c > 1000) break;
    }
    return c;
  };

  const violatesSameDayDuplicate = (startISO: string, endISO: string) => {
    const { ok } = validateNoOverlap(startISO, endISO);
    return !ok;
  };

  const activeLeaveType = useMemo(
    () =>
      leaveTypes.find((lt) => lt.int_can === Number(formData.leaveCode)) ||
      null,
    [leaveTypes, formData.leaveCode]
  );
  const perTypeMaxDays = activeLeaveType?.max_day ?? null;

  useEffect(() => {
    if (remainingDays != null && daysRequested > remainingDays) {
      setDaysRequested(remainingDays);
      setDaysError(t("leave.request.maxReached", "Exceeds remaining balance"));
    } else if (perTypeMaxDays != null && daysRequested > perTypeMaxDays) {
      setDaysRequested(perTypeMaxDays);
      setDaysError(
        t(
          "leave.request.maxPerType",
          `Exceeds ${activeLeaveType?.desig_can} limit (${perTypeMaxDays})`
        )
      );
    } else if (daysRequested > MAX_SINGLE_REQUEST_CALENDAR_DAYS) {
      setDaysRequested(MAX_SINGLE_REQUEST_CALENDAR_DAYS);
      setDaysError(
        t(
          "leave.request.maxSpan",
          `Single request capped at ${MAX_SINGLE_REQUEST_CALENDAR_DAYS} days`
        )
      );
    } else {
      setDaysError(null);
    }

    if (formData.startDate && daysRequested > 0) {
      const end = computeEndDate(formData.startDate, daysRequested, activeLeaveType);
      setFormData((prev) => ({ ...prev, endDate: end }));
      setCalculatedDays(0);
      setPreviewExcluded(null);
    } else {
      setFormData((prev) => ({ ...prev, endDate: null }));
      setCalculatedDays(0);
      setPreviewExcluded(null);
    }
  }, [
    formData.startDate,
    daysRequested,
    computeEndDate,
    activeLeaveType,
    remainingDays,
    perTypeMaxDays,
    activeLeaveType?.desig_can,
    t,
  ]);

  useEffect(() => {
    (async () => {
      try {
        if (!formData.startDate || !formData.endDate || !activeLeaveType) {
          setCalculatedDays(0);
          setPreviewExcluded(null);
          return;
        }
        const startISO = toISO10(formData.startDate);
        const endISO = toISO10(formData.endDate);
        if (!startISO || !endISO) {
          setCalculatedDays(0);
          setPreviewExcluded(null);
          return;
        }
        const js = await previewLeaveDays({
          startDate: startISO,
          endDate: endISO,
          leaveType: activeLeaveType.code || String(activeLeaveType.int_can),
        });
        const eff = Number(js?.effectiveDays ?? 0);
        setCalculatedDays(Number.isFinite(eff) ? eff : 0);
        setPreviewExcluded(js?.excluded ?? null);
      } catch {
        setCalculatedDays(0);
        setPreviewExcluded(null);
      }
    })();
  }, [formData.startDate, formData.endDate, activeLeaveType]);

  const startISOForLive = formData.startDate ? toISO10(formData.startDate) : "";
  const endISOForLive = formData.endDate
    ? toISO10(formData.endDate)
    : startISOForLive;
  const liveOverlapResult = useMemo(() => {
    if (!startISOForLive || !endISOForLive)
      return { ok: true, conflicts: [] as typeof leaveHistory };
    return validateNoOverlap(startISOForLive, endISOForLive);
  }, [startISOForLive, endISOForLive, validateNoOverlap]);

  const liveOverlap =
    !!startISOForLive && !!endISOForLive && !liveOverlapResult.ok;

  const liveApprovedConflicts = useMemo(() => {
    return (liveOverlapResult.conflicts || []).filter((c) =>
      isApprovedLike((c as any)?.status)
    );
  }, [liveOverlapResult]);

  const liveHolidayISOList = useMemo(() => {
    const hols = previewExcluded?.holidays;
    if (!Array.isArray(hols)) return [] as string[];
    return hols.map((h: any) => String(h?.date || '').slice(0, 10)).filter(Boolean);
  }, [previewExcluded]);

  const liveFridayISOList = useMemo(() => {
    const fr = previewExcluded?.fridays;
    if (!Array.isArray(fr)) return [] as string[];
    return fr.map((x: any) => String(x).slice(0, 10)).filter(Boolean);
  }, [previewExcluded]);

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name as keyof LeaveRequestForm]: value,
    }));
  };

  const handleDateChange = (
    name: keyof LeaveRequestForm,
    date: Date | null
  ) => {
    setFormData((prev) => ({ ...prev, [name]: date }));
  };

  const startDateDep = formData.startDate;
  const endDateDep = formData.endDate;

  const CustomDay = useMemo(() => {
    return function CustomDayComponent(props: PickersDayProps) {
      const { day } = props;
      const dayDate: Date = new Date(day as any);
      const s0 = startDateDep
        ? new Date(new Date(startDateDep).setHours(0, 0, 0, 0))
        : null;
      const e0 = endDateDep
        ? new Date(new Date(endDateDep).setHours(0, 0, 0, 0))
        : null;
      const inRange = !!s0 && !!e0 && dayDate >= s0 && dayDate <= e0;
      const nonWorking = isNonWorking(dayDate);
      const iso = fmtISO(dayDate);
      const isHol = holidaySet.has(iso);
      const markNonWorkingInRange =
        inRange && nonWorking && !isSickLike(activeLeaveType);
      const disable = nonWorking && !isSickLike(activeLeaveType);

      const outOfRangeNonWorkingBg =
        !inRange && disable ? "rgba(158,158,158,0.18)" : undefined;
      const inRangeBg = markNonWorkingInRange
        ? "rgba(244,67,54,0.18)"
        : "rgba(33,150,243,0.18)";
      const inRangeBorder = markNonWorkingInRange
        ? "1px solid #f44336"
        : "1px solid #b7a27d";

      return (
        <PickersDay
          {...props}
          disabled={disable}
          sx={{
            bgcolor: inRange ? inRangeBg : outOfRangeNonWorkingBg,
            border: inRange ? inRangeBorder : undefined,
            borderRadius: 1.2,
            opacity: !inRange && nonWorking ? 0.6 : 1,
            color: !inRange && isHol ? "text.disabled" : undefined,

            "&.Mui-disabled": {
              opacity: !inRange && nonWorking ? 0.6 : 1,
              color: !inRange && isHol ? "rgba(0,0,0,0.38)" : undefined,
              backgroundColor: inRange ? inRangeBg : outOfRangeNonWorkingBg,
              border: inRange ? inRangeBorder : undefined,
            },
          }}
        />
      );
    };
  }, [startDateDep, endDateDep, isNonWorking, activeLeaveType, holidaySet, fmtISO]);

  const validateBusinessRules = () => {
    if (!formData.leaveCode || !formData.startDate || !daysRequested) {
      return t(
        "leave.request.validation.required",
        "Please complete all required fields."
      );
    }
    if (remainingDays != null && daysRequested > remainingDays) {
      return t("leave.request.maxReached", "Exceeds remaining balance");
    }
    if (!formData.endDate || formData.startDate > formData.endDate) {
      return t(
        "leave.request.validation.invalidDateRange",
        "Invalid date range."
      );
    }
    if (isNonWorking(formData.startDate)) {
      return t(
        "leave.request.validation.startNonWorking",
        "Start date cannot be a Friday or holiday."
      );
    }
    if (isEmergencyLike(activeLeaveType)) {
      if (currentRequestEmergencyDays > emergencyYearRemaining) {
        return t(
          "leave.request.emergencyYearCap",
          `Emergency leave exceeds remaining annual quota (${emergencyYearRemaining}/${EMERGENCY_DAYS_PER_YEAR_MAX}).`
        );
      }
      if (currentRequestEmergencyDays > emergencyMonthRemaining) {
        return t(
          "leave.request.emergencyMonthCap",
          `Emergency leave exceeds remaining monthly quota (${emergencyMonthRemaining}/${EMERGENCY_DAYS_PER_MONTH_MAX}).`
        );
      }
    }
    if (perTypeMaxDays != null && calculatedDays > perTypeMaxDays) {
      return t(
        "leave.request.maxPerType",
        `Exceeds ${activeLeaveType?.desig_can} limit (${perTypeMaxDays})`
      );
    }
    const span =
      Math.floor(
        (formData.endDate.getTime() - formData.startDate.getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1;
    if (span > MAX_SINGLE_REQUEST_CALENDAR_DAYS) {
      return t(
        "leave.request.maxSpan",
        `Single request capped at ${MAX_SINGLE_REQUEST_CALENDAR_DAYS} days`
      );
    }
    if (isNonWorking(formData.startDate)) {
      return t(
        "leave.request.validation.startNonWorking",
        "Start date cannot be a Friday or holiday."
      );
    }

    const startISO = toISO10(formData.startDate);
    const endISO = toISO10(formData.endDate ?? formData.startDate);
    const { ok, conflicts } = validateNoOverlap(startISO, endISO);
    if (!ok) {
      const first = conflicts[0];
      return t(
        "leave.request.overlap",
        `Your request overlaps an existing ${first.status?.toUpperCase()} leave (${toDMY(first.startISO)} → ${toDMY(first.endISO)}). Please choose different dates.`
      );
    }
    return null;
  };

  const yearNow = (formData.startDate ?? new Date()).getFullYear();
  const monthNow = (formData.startDate ?? new Date()).getMonth();

  const emergencyUsedThisYear = useMemo(
    () => sumEmergencyDays(leaveHistory, yearNow, undefined, isNonWorking),
    [leaveHistory, yearNow, isNonWorking, sumEmergencyDays]
  );
  const emergencyUsedThisMonth = useMemo(
    () => sumEmergencyDays(leaveHistory, yearNow, monthNow, isNonWorking),
    [leaveHistory, yearNow, monthNow, isNonWorking, sumEmergencyDays]
  );

  const currentRequestEmergencyDays = useMemo(() => {
    if (!isEmergencyLike(activeLeaveType)) return 0;
    if (!formData.startDate || !formData.endDate) return 0;
    return countWorkingDays(formData.startDate, formData.endDate, isNonWorking);
  }, [activeLeaveType, formData.startDate, formData.endDate, isNonWorking]);

  const emergencyYearRemaining = Math.max(
    0,
    EMERGENCY_DAYS_PER_YEAR_MAX - emergencyUsedThisYear
  );
  const emergencyMonthRemaining = Math.max(
    0,
    EMERGENCY_DAYS_PER_MONTH_MAX - emergencyUsedThisMonth
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLock) return;
    setError(null);
    setSuccess(false);
    await refreshBalanceAndHistory();

    const businessError = validateBusinessRules();
    if (businessError) {
      setError(businessError);
      setShowError(true);
      return;
    }

    try {
      setSubmitting(true);
      setSubmitLock(true);

      const startISO = toISO10(formData.startDate);
      const endISO = toISO10(formData.endDate ?? formData.startDate);

      if (violatesSameDayDuplicate(startISO, endISO)) {
        setError(
          t(
            "leave.request.overlapSameDay",
            "You already have a pending or approved request overlapping these dates. Please adjust the period."
          )
        );
        setShowError(true);
        return;
      }

      const payload: any = {
        employeeId: String(employeeId),
        leaveCode: Number(formData.leaveCode),
        leaveType: activeLeaveType?.code || undefined,
        startDate: startISO,
        endDate: endISO,
        reason: formData.reason?.trim?.() || undefined,
        contactNumber: formData.contactNumber?.trim(),
        days: undefined,
        clientDedupKey: `${employeeId || ""}:${startISO}:${endISO}:${formData.leaveCode}`,
      };

      const created = await createLeaveRequest(payload);

      let newRequestId: string | number | undefined =
        created?.id ??
        created?.int_con ??
        created?.data?.id ??
        created?.data?.int_con;

      if (!newRequestId) {
        try {
          const list = await getLeaveRequests(String(employeeId ?? ""));
          const match = (Array.isArray(list) ? list : []).find((r: any) => {
            const s = toISO10(
              firstDefined(r.startDate, r.DATE_START, r.date_depart)
            );
            const e = toISO10(firstDefined(r.endDate, r.DATE_END, r.date_end));
            const st = String(
              firstDefined(r.status, r.STATUS, r.state, r.STATUT) || ""
            ).toLowerCase();
            return s === startISO && e === endISO && st.includes("pending");
          });
          if (match) newRequestId = match.id ?? match.int_con;
        } catch {}
      }

      if (doctorNoteFile && newRequestId != null) {
        try {
          setUploadingNote(true);
          await uploadDoctorNote(newRequestId, doctorNoteFile);
        } catch (e: any) {
          console.error("Doctor note upload failed", e);
          setError(
            e?.response?.data?.message ||
              t(
                "leave.request.noteUploadError",
                "Leave created, but doctor's note failed to upload."
              )
          );
        } finally {
          setUploadingNote(false);
        }
      }

      setDoctorNoteFile(null);
      setDoctorNotePreview(null);

      setLeaveHistory((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, startISO, endISO, status: "pending" },
      ]);

      setSuccess(true);
      setShowSuccess(true);
      setFormData({
        leaveCode: "",
        startDate: null,
        endDate: null,
        reason: "",
        contactNumber: "",
      });
      setDaysRequested(0);
      setCalculatedDays(0);

      await refreshBalanceAndHistory();
    } catch (err: any) {
      setError(err?.message || t("leave.request.submitError"));
      setShowError(true);
    } finally {
      setSubmitting(false);
      setTimeout(() => setSubmitLock(false), 1500);
    }
  };

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

  /** ---------- UI (Responsive & Sidebar-Adaptive, NO Grid) ---------- */
  return (
    <Box
      ref={contentRef}
      sx={{
        width: "100%",
        ml: { xs: 0, lg: "var(--content-ml, 0px)" },
        transition: "margin-left 200ms ease, width 200ms ease",
        px: { xs: 1.5, sm: 2, md: 2.5 },
        py: { xs: 1.5, sm: 2 },
      }}
    >
      {/* Center content and keep a comfortable max width */}
      <Box sx={{ maxWidth: 1200, mx: "auto" }}>
        {/* Header */}
        <Stack spacing={0.5} sx={{ mb: 2 }}>
          <Typography variant="h5" fontWeight={700}>
            {t("leave.request.title", "Request Time Off")}
          </Typography>
        </Stack>

        {/* Alerts */}
        {(error || success) && (
          <Box sx={{ mb: 2 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {success && (
              <Alert severity="success" sx={{ mt: error ? 1 : 0 }}>
                {t(
                  "leave.request.success",
                  "Your request has been submitted."
                )}
              </Alert>
            )}
          </Box>
        )}

        {/* Form */}
        <Box component="form" onSubmit={handleSubmit} noValidate>
          {/* Main 2-column layout: calendar | right side */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "320px minmax(0, 1fr)",
              },
              gap: 3,
              alignItems: "flex-start",
            }}
          >
            {/* Left: Calendar card */}
            <Card
              variant="outlined"
              sx={{ borderRadius: 3, overflow: "hidden" }}
            >
              <CardContent sx={{ pb: 1 }}>
                <LocalizationProvider
                  dateAdapter={AdapterDateFns}
                  adapterLocale={enGB}
                >
                  <DateCalendar
                    value={formData.startDate}
                    onChange={(value) =>
                      handleDateChange("startDate", toDate(value))
                    }
                    disablePast
                    shouldDisableDate={(day) => {
                      const d = toDate(day);
                      if (!d) return true;
                      if (isSickLike(activeLeaveType)) return false;
                      return isNonWorking(d);
                    }}
                    slots={{ day: CustomDay }}
                    sx={{
                      mx: "auto",
                      "& .MuiPickersDay-root": {
                        height: 36,
                        width: 36,
                        fontSize: 12,
                      },
                      "& .MuiDayCalendar-weekDayLabel": {
                        fontSize: 11,
                        opacity: 0.7,
                      },
                    }}
                  />
                </LocalizationProvider>

                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ mt: 1 }}
                  alignItems="center"
                  flexWrap="wrap"
                >
                  <Chip
                    size="small"
                    label={t("leave.legend.range", "Selected range")}
                  />
                  <Tooltip
                    title={
                      t(
                        "leave.legend.holidayFri",
                        "Holiday/Friday (disabled)"
                      ) as string
                    }
                  >
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t("leave.legend.nonWorking", "Non-working")}
                    />
                  </Tooltip>
                </Stack>
              </CardContent>
            </Card>

            {/* Right: summary + form fields */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "260px minmax(0, 1fr)",
                },
                gap: 3,
                alignItems: "flex-start",
              }}
            >
              {/* Summary tiles (sticky on desktop) */}
              <Box
                sx={{
                  position: { md: "sticky" },
                  top: { md: theme.spacing(2) },
                  zIndex: 1,
                }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "1fr" },
                    gap: 1.5,
                  }}
                >
                  <StatTile
                    title={t("leave.request.remaining", "Remaining")}
                    value={remainingDays ?? "—"}
                  />
                  <StatTile
                    title={t(
                      "leave.request.daysRequested",
                      "Days requested"
                    )}
                    value={daysRequested || 0}
                  />
                  <StatTile
                    title={t("leave.request.effective", "Net Vacation")}
                    value={(() => {
                      const holidayLabel = (iso: string) => {
                        const m = Array.isArray(previewExcluded?.holidays)
                          ? (previewExcluded.holidays as any[]).find((h) => String(h?.date).slice(0, 10) === iso)
                          : null;
                        const nm = String(m?.name || holidayNameMap[iso] || '').trim();
                        return nm ? `${iso} — ${nm}` : iso;
                      };
                      const reasons: string[] = [];
                      if (liveFridayISOList.length)
                        reasons.push(`Fridays: ${liveFridayISOList.join(", ")}`);
                      if (liveHolidayISOList.length)
                        reasons.push(
                          `Public holidays: ${liveHolidayISOList
                            .map(holidayLabel)
                            .join(", ")}`
                        );
                      const tip =
                        reasons.length > 0
                          ? reasons.join("\n")
                          : "No excluded non-working days in selected range.";
                      const excluded = liveFridayISOList.length + liveHolidayISOList.length;
                      return (
                        <Tooltip title={<pre style={{ margin: 0 }}>{tip}</pre>} arrow>
                          <Box sx={{ display: "inline-flex", flexDirection: "column" }}>
                            <Box component="span">{calculatedDays || 0}</Box>
                            {excluded > 0 ? (
                              <Typography variant="caption" color="text.secondary">
                                -{excluded} excluded
                              </Typography>
                            ) : null}
                          </Box>
                        </Tooltip>
                      );
                    })()}
                  />
                  <StatTile
                    title={t("leave.request.endDate", "End date")}
                    value={
                      formData.endDate ? toDMY(formData.endDate) : "—"
                    }
                  />

                  {isEmergencyLike(activeLeaveType) && (
                    <>
                      <StatTile
                        title={t(
                          "leave.request.emergencyYear",
                          "Emergency (Y rem)"
                        )}
                        value={emergencyYearRemaining}
                      />
                      <StatTile
                        title={t(
                          "leave.request.emergencyMonth",
                          "Emergency (M rem)"
                        )}
                        value={emergencyMonthRemaining}
                      />
                    </>
                  )}

                  {perTypeMaxDays != null && (
                    <Box>
                      <Chip
                        size="small"
                        variant="outlined"
                        color="warning"
                        sx={{ mt: 0.5 }}
                        label={`${t(
                          "leave.request.perTypeLimit",
                          "Type limit"
                        )}: ${perTypeMaxDays}`}
                      />
                    </Box>
                  )}
                </Box>
              </Box>

              {(liveApprovedConflicts?.length || 0) > 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  {t(
                    "leave.request.approvedOverlapNote",
                    "Note: This employee already has an approved vacation/leave overlapping these dates."
                  )}
                </Alert>
              )}

              {(liveHolidayISOList?.length || 0) > 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  {t(
                    "leave.request.holidayConflictResolved",
                    "This request includes public holiday date(s). Holidays will not be counted in Net Vacation."
                  )}
                  {" "}
                  {liveHolidayISOList.map((iso) => toDMY(iso)).join(", ")}
                </Alert>
              )}

              {/* Form fields */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 2,
                }}
              >
                {/* Leave Type */}
                <Box sx={{ gridColumn: "1 / -1" }}>
                  <FormControl fullWidth required>
                    <InputLabel id="leave-type-label">
                      {t("leave.request.leaveType", "Leave type")}
                    </InputLabel>
                    <Select
                      labelId="leave-type-label"
                      name="leaveCode"
                      value={formData.leaveCode}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          leaveCode: Number((e.target as any).value),
                        }))
                      }
                      label={t("leave.request.leaveType", "Leave type")}
                    >
                      {leaveTypes.map((lt) => (
                        <MenuItem key={lt.int_can} value={lt.int_can}>
                          {lt.code
                            ? `${lt.code} — ${lt.desig_can}`
                            : lt.desig_can}
                          {typeof lt.max_day === "number"
                            ? `  (${lt.max_day} ${t(
                                "leave.request.days",
                                "days"
                              )})`
                            : ""}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                {/* Start Date */}
                <Box>
                  <LocalizationProvider
                    dateAdapter={AdapterDateFns}
                    adapterLocale={enGB}
                  >
                    <DatePicker
                      label={t("leave.request.startDate", "Start date")}
                      value={formData.startDate}
                      onChange={(value) =>
                        handleDateChange("startDate", toDate(value))
                      }
                      minDate={new Date()}
                      shouldDisableDate={(day) => {
                        const d = toDate(day);
                        if (!d) return true;
                        if (isSickLike(activeLeaveType)) return false;
                        return isNonWorking(d);
                      }}
                      slotProps={{ textField: { fullWidth: true } }}
                      format="dd-MM-yyyy"
                    />
                  </LocalizationProvider>
                </Box>

                {/* Days requested */}
                <Box>
                  <TextField
                    type="number"
                    margin="normal"
                    label={t(
                      "leave.request.daysRequested",
                      "Days requested"
                    )}
                    value={daysRequested || ""}
                    onChange={(e) => {
                      const raw = Number(
                        (e.target as HTMLInputElement).value
                      );
                      const v = Math.max(0, Number.isFinite(raw) ? raw : 0);
                      let capped = v;
                      if (remainingDays != null)
                        capped = Math.min(capped, remainingDays);
                      if (perTypeMaxDays != null)
                        capped = Math.min(capped, perTypeMaxDays);
                      capped = Math.min(
                        capped,
                        MAX_SINGLE_REQUEST_CALENDAR_DAYS
                      );
                      setDaysRequested(capped);
                      if (v !== capped) {
                        setDaysError(
                          t(
                            "leave.request.maxReached",
                            "Adjusted to allowed maximum for your balance/policy."
                          )
                        );
                      } else {
                        setDaysError(null);
                      }
                    }}
                    inputProps={{
                      min: 0,
                      max:
                        remainingDays != null
                          ? Math.min(
                              remainingDays,
                              perTypeMaxDays ?? Number.MAX_SAFE_INTEGER,
                              MAX_SINGLE_REQUEST_CALENDAR_DAYS
                            )
                          : perTypeMaxDays ??
                            MAX_SINGLE_REQUEST_CALENDAR_DAYS,
                    }}
                    helperText={
                      daysError ||
                      (remainingDays != null
                        ? t("leave.request.remaining", "Remaining: ") +
                          remainingDays
                        : "")
                    }
                    error={!!daysError}
                    fullWidth
                  />
                </Box>

                {/* End Date (auto, full width on small, half on larger) */}
                <Box>
                  <TextField
                    label={t(
                      "leave.request.endDate",
                      "End date (auto)"
                    )}
                    value={formData.endDate ? toDMY(formData.endDate) : ""}
                    InputProps={{ readOnly: true }}
                    fullWidth
                  />
                </Box>

                {/* Contact Number */}
                <Box>
                  <TextField
                    fullWidth
                    label={t(
                      "leave.request.contactNumber",
                      "Contact number during leave"
                    )}
                    name="contactNumber"
                    value={formData.contactNumber}
                    onChange={handleChange}
                    variant="outlined"
                  />
                </Box>

                {/* Reason (full width) */}
                <Box sx={{ gridColumn: "1 / -1" }}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    label={t("leave.request.reason", "Reason")}
                    name="reason"
                    value={formData.reason}
                    onChange={handleChange}
                    variant="outlined"
                  />
                </Box>

                {/* Doctor note (Sick only) */}
                {isSickLike(activeLeaveType) && (
                  <Box sx={{ gridColumn: "1 / -1" }}>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                      <Stack spacing={1.5}>
                        <Typography variant="subtitle1">
                          {t(
                            "leave.request.doctorNoteTitle",
                            "Doctor’s note (optional, JPG)"
                          )}
                        </Typography>

                        <Stack
                          direction="row"
                          spacing={2}
                          alignItems="center"
                          flexWrap="wrap"
                        >
                          <Button
                            variant="outlined"
                            component="label"
                            disabled={uploadingNote || submitting}
                          >
                            {doctorNoteFile
                              ? t(
                                  "leave.request.replaceNote",
                                  "Replace doctor’s note"
                                )
                              : t(
                                  "leave.request.uploadNote",
                                  "Upload doctor’s note (JPG)"
                                )}
                            <input
                              hidden
                              type="file"
                              accept="image/jpeg"
                              onChange={(e) =>
                                onDoctorNoteChange(
                                  e.target.files?.[0] ?? null
                                )
                              }
                            />
                          </Button>
                          {doctorNoteFile && (
                            <Chip
                              label={doctorNoteFile.name}
                              onDelete={() => onDoctorNoteChange(null)}
                              deleteIcon={<CloseIcon />}
                              variant="outlined"
                            />
                          )}
                        </Stack>

                        {doctorNotePreview && (
                          <Box sx={{ mt: 1 }}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: "block", mb: 0.5 }}
                            >
                              {t("leave.request.notePreview", "Preview")}
                            </Typography>
                            <Box
                              component="img"
                              src={doctorNotePreview}
                              alt="Doctor note preview"
                              sx={{
                                maxWidth: "100%",
                                width: 360,
                                maxHeight: 260,
                                borderRadius: 1,
                                border: "1px solid",
                                borderColor: "divider",
                                display: "block",
                              }}
                            />
                          </Box>
                        )}
                      </Stack>
                    </Paper>
                  </Box>
                )}

                {/* Submit (full width) */}
                <Box sx={{ gridColumn: "1 / -1" }}>
                  <Divider sx={{ my: 1.5 }} />
                  <Box
                    sx={{
                      display: "flex",
                      gap: 1,
                      justifyContent: "stretch",
                    }}
                  >
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      fullWidth
                      disabled={
                        submitting ||
                        uploadingNote ||
                        submitLock ||
                        calculatedDays === 0 ||
                        !formData.startDate ||
                        !formData.leaveCode ||
                        !!daysError
                      }
                      startIcon={
                        submitting ? (
                          <CircularProgress size={20} color="inherit" />
                        ) : null
                      }
                    >
                      {submitting
                        ? t("common.submitting", "Submitting…")
                        : t("leave.request.submit", "Submit request")}
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Toasts */}
        <Snackbar
          open={showSuccess}
          autoHideDuration={3000}
          onClose={() => setShowSuccess(false)}
          message={t(
            "leave.request.success",
            "Your request has been submitted."
          )}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        />
        <Snackbar
          open={showError && !!error}
          autoHideDuration={4000}
          onClose={() => setShowError(false)}
          message={String(
            error ||
              t("leave.request.submitError", "Could not submit request.")
          )}
          anchorOrigin={{ vertical: "bottom", "horizontal": "center" }}
        />
      </Box>
    </Box>
  );
};


export default LeaveRequestScreen;
