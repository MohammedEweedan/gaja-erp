/* eslint-disable @typescript-eslint/no-unused-vars */
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import { useTheme, alpha, darken, lighten } from "@mui/material/styles";
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
  Button,
  Menu,
  MenuItem,
  ListItemText,
  Tooltip,
  Dialog,
  DialogTitle,
  Chip,
  DialogContent,
  DialogActions,
  InputLabel,
  Select,
  FormControl,
  Checkbox,
  FormControlLabel,
  Card,
  CardHeader,
  CardContent,
  TextField,
} from "@mui/material";
import {
  getCalendarLog,
  updateLeaveStatus,
  getLeaveBalance,
  createHoliday,
  updateHoliday as updateHolidayApi,
  deleteHoliday as deleteHolidayApi,
  getHolidays as getHolidaysApi,
} from "../../services/leaveService";
import {
  Calendar as BigCalendar,
  momentLocalizer,
  Event as CalendarEvent,
  View,
  SlotInfo,
} from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import {
  Event as EventIcon,
  Today as TodayIcon,
  ViewWeek as ViewWeekIcon,
  ViewAgenda as ViewAgendaIcon,
  FilterList as FilterIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { format, isSameDay, differenceInCalendarDays } from "date-fns";
import { hasRole } from "../../Setup/getUserInfo";
import axios from "axios";
import {
  createLeaveRequest,
  getLeaveTypes as getLeaveTypesSvc,
  updateLeaveRequestFlexible,
} from "../../services/leaveService";
import { getAuthHeader } from "../../utils/auth";
import { isActiveEmployee } from "../../api/employees";

const localizer = momentLocalizer(moment);

interface CalendarEventExtended extends CalendarEvent {
  id?: string | number;
  type: "leave" | "holiday";
  status?:
    | "pending"
    | "approved"
    | "rejected"
    | "cancelled"
    | "accepted"
    | "approve"
    | "accept";
  employeeName?: string;
  leaveType?: string; // e.g., AL, SL, PH
  leaveLabel?: string; // same as leaveType (kept for backwards compat)
  effectiveDays?: number;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource?: any;
}

type LeaveTypeApiRow = {
  code: string; // "AL"
  name?: string; // "Annual Leave"
  color?: string; // "#f44336"
  [k: string]: any;
};

const CalendarLogScreen: React.FC<{ employeeId?: string | number }> = ({
  employeeId,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  // Brand primitives
  const brand: string = (theme.palette as any)?.gaja?.[100] || "#b7a27d";
  const brandHover = isDark ? lighten(brand, 0.08) : darken(brand, 0.12);
  const brandSoft = alpha(brand, isDark ? 0.18 : 0.1);
  const gridBorder = alpha(isDark ? "#ffffff" : "#000000", 0.1);
  const CONFIRMED_STATUSES = new Set([
    "approved",
    "accepted",
    "approve",
    "accept",
  ]);
  const cardBg = theme.palette.background.paper;
  const cardBorder = alpha(isDark ? "#ffffff" : "#000000", 0.14);
  // Explicit overrides
  const COLOR_AL = "#f44336"; // Annual Leave
  const COLOR_SL = "#4caf50"; // Sick Leave

  // Public Holiday theme
  const PH_BG = "#424242"; // darkish gray
  const PH_BRAND = "#b7a27d"; // border + text

  const API_URL = process.env.REACT_APP_API_IP;

  const [loading, setLoading] = useState<boolean>(true);
  const [events, setEvents] = useState<CalendarEventExtended[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState<Date>(new Date());
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedEvent, setSelectedEvent] =
    useState<CalendarEventExtended | null>(null);
  const [eventDetailsOpen, setEventDetailsOpen] = useState<boolean>(false);
  // --- EDIT MODE state for leave events ---
  const [editMode, setEditMode] = useState(false);
  const [confirmApprovedEditOpen, setConfirmApprovedEditOpen] = useState(false);
  const [confirmApprovedEditLoading, setConfirmApprovedEditLoading] = useState(false);
  const [editForm, setEditForm] = useState<{
    startDate: string;
    endDate: string;
    typeCode: string; 
    comment: string;
  }>({
    startDate: "",
    endDate: "",
    typeCode: "",
    comment: "",
  });

  const startOfMonth = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  
  const endOfMonth = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

  const addMonths = (d: Date, n: number) => {
    const x = new Date(d);
    x.setMonth(x.getMonth() + n);
    return x;
  };

  const [filters, setFilters] = useState({
    showLeaves: true,
    showHolidays: true,
    leaveTypes: [] as string[], // stores TYPE CODES (uppercase)
  });

  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    severity: "success" | "error" | "info";
  }>({
    open: false,
    msg: "",
    severity: "success",
  });

  const [empNameById, setEmpNameById] = useState<
    Record<string | number, string>
  >({});
  const [holidays, setHolidays] = useState<any[]>([]);
  const [customHolidays, setCustomHolidays] = useState<any[]>([]);

  // Dynamic leave types (legend + colors) -> code => { name, color }
  const [leaveTypesMap, setLeaveTypesMap] = useState<
    Record<string, { name: string; color: string }>
  >({});
  const [activeEmpIds, setActiveEmpIds] = useState<Set<string | number>>(new Set());

  const [leaveCodeMap, setLeaveCodeMap] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      try {
        const rows = await getLeaveTypesSvc();
        const m: Record<string, number> = {};
        (Array.isArray(rows) ? rows : []).forEach((r: any) => {
          const code = (r?.code || r?.desig_can || "").toUpperCase();
          const can = r?.int_can;
          if (code && Number.isFinite(can)) m[code] = Number(can);
        });
        setLeaveCodeMap(m);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    if (!events.length) return;

    let changed = false;
    const next = events.map((ev) => {
      if (ev.type !== "leave") return ev;

      const rid = ev.resource || {};
      const empId = rid.employeeId ?? rid.id_emp ?? rid.ID_EMP ?? null;

      // Current label or value the UI is showing
      const current = (ev.employeeName || ev.title || "").toString().trim();

      // If the current value is missing or looks numeric/"Emp 123", try to hydrate from map
      const looksNumeric = /^\d+$/.test(current);
      const looksEmpPlaceholder = /^Emp\s+\d+$/i.test(current);

      const mapped =
        (empId != null && (empNameById[empId] || empNameById[String(empId)])) ||
        null;

      if ((looksNumeric || looksEmpPlaceholder || !current) && mapped) {
        changed = true;
        return {
          ...ev,
          title: mapped,
          employeeName: mapped,
          resource: { ...rid, employeeName: mapped },
        };
      }

      return ev;
    });

    if (changed) setEvents(next);
  }, [empNameById, events, setEvents]);

  const resolveLeaveCode = (codeRaw?: string) => {
    const c = (codeRaw || "").toUpperCase();
    return leaveCodeMap[c];
  };

  // Add-Holiday Dialog state
  const [addHolidayOpen, setAddHolidayOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    type: "variable" as const,
    date: "",
    name: "",
    comment: "",
  });

  // Pending requests
  const [pendingRequests, setPendingRequests] = useState<
    CalendarEventExtended[]
  >([]);

  // Edit-Holiday state
  const [holidayEditDate, setHolidayEditDate] = useState<string>("");
  const [holidayEditComment, setHolidayEditComment] = useState<string>("");

  // Hash palette for stable color generation when API doesn't provide a color
  const palette = useMemo(
    () => [
      "#1f77b4",
      "#ff7f0e",
      "#2ca02c",
      "#d62728",
      "#9467bd",
      "#8c564b",
      "#e377c2",
      "#7f7f7f",
      "#bcbd22",
      "#17becf",
    ],
    []
  );

  const canModerate = useMemo(
    () =>
      hasRole("User") ||
      hasRole("Admin") ||
      hasRole("HR Manager") ||
      hasRole("Super Admin"),
    []
  );

  const didRefetchEmployees = useRef(false);

  const inferredBase = useMemo(
    () => `${window.location.protocol}//${window.location.hostname}:9000`,
    []
  );

  const apiBase = useMemo(
    () =>
      (API_URL && API_URL.trim() ? API_URL : inferredBase).replace(/\/+$/, ""),
    [API_URL, inferredBase]
  );

  const stableColorFromCode = useCallback(
    (code: string) => {
      const up = code.toUpperCase();
      if (up === "AL") return COLOR_AL;
      if (up === "SL") return COLOR_SL;
      // Unique, stable fallback for all other codes
      let hash = 0;
      for (let i = 0; i < up.length; i++)
        hash = (hash * 53 + up.charCodeAt(i)) >>> 0;
      const base = palette[hash % palette.length];
      return isDark ? alpha(base, 0.65) : alpha(base, 0.85);
    },
    [palette, isDark]
  );

  const tryUpdateLeaveRequest = async (payload: any): Promise<"ok" | "404"> => {
    const headers = await getAuthHeader();
    const id = payload.id || payload.int_con || payload.id_conge;
    const compact = {
      id,
      int_con: id,
      id_conge: id,
      startDate: payload.startDate,
      endDate: payload.endDate,
      DATE_START: payload.startDate,
      DATE_END: payload.endDate,
      date_depart: payload.startDate,
      date_end: payload.endDate,
      code: payload.code,
      id_can: payload.id_can,
      leaveType: payload.code,
      comment: payload.comment ?? "",
      COMMENT: payload.comment ?? "",
    };
    const candidates: Array<{ m: "put" | "post" | "patch"; url: string }> = [
      { m: "put", url: `${apiBase}/leave/leave-request/${id}` },
      { m: "patch", url: `${apiBase}/leave/leave-request/${id}` },
      { m: "post", url: `${apiBase}/leave/leave-request/${id}` },
      { m: "put", url: `${apiBase}/leave/leave-request` },
      { m: "patch", url: `${apiBase}/leave/leave-request` },
      { m: "post", url: `${apiBase}/leave/leave-request` },
      { m: "post", url: `${apiBase}/leave/leave-request/update` },
      { m: "post", url: `${apiBase}/leave/update-leave-request` },
      { m: "patch", url: `${apiBase}/leave/update-leave-request` },
    ];
    for (const c of candidates) {
      try {
        await (axios as any)[c.m](c.url, compact, { headers });
        return "ok";
      } catch (e: any) {
        const s = e?.response?.status;
        if (s !== 404 && s !== 405 && s !== 400) throw e;
        if (s === 404) continue;
        // keep trying on 400/405 too
      }
    }
    return "404";
  };

  const recreateLeaveIfAllowed = async (
    edited: {
      employeeId?: string | number;
      startDate: string;
      endDate: string;
      code: string;
      comment?: string;
      days: number;
    },
    currentStatus?: string
  ) => {
    // Don’t auto-recreate approved/accepted items — keep original visible
    const s = String(currentStatus || "").toLowerCase();
    if (["approved", "accepted", "approve", "accept"].includes(s)) {
      throw new Error(
        "Server doesn’t support editing this leave. Ask admin to enable update route."
      );
    }
    // Need a numeric leaveCode
    const leaveCode = resolveLeaveCode(edited.code);
    if (!leaveCode) {
      throw new Error(
        `Unknown leave code "${edited.code}". Update your leave types or pick a valid code.`
      );
    }
    if (!edited.employeeId) {
      throw new Error("Missing employeeId for recreate.");
    }
    // Create a fresh request (status will be whatever backend defaults to, usually pending)
    await createLeaveRequest({
      employeeId: String(edited.employeeId),
      leaveCode,
      leaveType: edited.code, // optional
      startDate: edited.startDate,
      endDate: edited.endDate,
      reason: edited.comment || "",
      contactNumber: "",
      days: edited.days,
    });
  };

  // PURE lookup used during render — never writes state
  const getTypeMeta = useCallback(
    (codeRaw?: any) => {
      const code = canonicalCode(codeRaw);
      if (!code) return { code, name: "", color: brandSoft };
      if (code === "PH")
        return {
          code,
          name: t("leave.holidays.title", "Public Holiday"),
          color: PH_BG,
        };
      const entry = leaveTypesMap[code];
      return {
        code,
        name: entry?.name || code,
        color: entry?.color || stableColorFromCode(code),
      };
    },
    [leaveTypesMap, stableColorFromCode, brandSoft, t]
  );

  // Fetch employees (for missing names)
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${apiBase}/employees`, {
          headers: await getAuthHeader(),
          params: { state: true },
        });
        const arrRaw = Array.isArray(res.data) ? res.data : res.data?.data || [];
        // backend already filtered by state=true, keep guard just in case
        const arr = arrRaw.filter(isActiveEmployee);
        const m: Record<string | number, string> = {};
        const ids = new Set<string | number>();
        for (const e of arr) {
          const id = e?.ID_EMP ?? e?.id ?? e?.id_emp;
          const name =
            e?.NAME ??
            e?.NAME_ENGLISH ??
            e?.name ??
            e?.employeeName ??
            e?.employee_name;
          if (id != null && name) {
            m[id] = String(name);
            m[String(id)] = String(name);
            ids.add(id);
            ids.add(String(id));
          }
        }
        setEmpNameById(m);
        setActiveEmpIds(ids);
      } catch {
        /* ignore */
      }
    })();
  }, [apiBase]);

  const safeEmployeeName = (empId?: any, maybeName?: any) => {
    const name = (maybeName ?? "").toString().trim();
    const looksNumeric = /^\d+$/.test(name);
    if (!name || looksNumeric) {
      const nId = empId ?? "";
      return (
        empNameById[nId] ||
        empNameById[String(nId)] ||
        (nId ? `Emp ${nId}` : t("common.unknown", "Unknown"))
      );
    }
    return name;
  };

  // Deterministic hash for a string
  const hashStr = (s: string) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  // HSL → HEX
  const hslToHex = (h: number, s: number, l: number) => {
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) =>
      l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = (x: number) =>
      Math.round(255 * x)
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
  };

  // Produce a series of visually distinct HSL hues using the golden angle
  const distinctHexByIndex = (idx: number, seed = 0) => {
    const golden = 137.508; // degrees
    const h = (seed + idx * golden) % 360;
    const s = 0.65; // 65% saturation
    const l = 0.52; // 52% lightness (good contrast)
    return hslToHex(h, s, l);
  };

  const handleSaveEditedLeave = async () => {
    if (!selectedEvent || selectedEvent.type !== "leave") return;

    const selectedStatus = String(selectedEvent.status || '').toLowerCase();
    const isApproved = selectedStatus === 'approved' || selectedStatus === 'accepted' || selectedStatus === 'approve' || selectedStatus === 'accept';

    const origStart = selectedEvent.resource?.startDate
      ? String(selectedEvent.resource.startDate).slice(0, 10)
      : format(selectedEvent.start, 'yyyy-MM-dd');
    const origEnd = selectedEvent.resource?.endDate
      ? String(selectedEvent.resource.endDate).slice(0, 10)
      : format(selectedEvent.end, 'yyyy-MM-dd');

    const datesChanged = String(editForm.startDate).slice(0, 10) !== String(origStart).slice(0, 10) ||
      String(editForm.endDate).slice(0, 10) !== String(origEnd).slice(0, 10);

    // validate
    if (!editForm.startDate || !editForm.endDate) {
      setSnack({
        open: true,
        msg: t("common.dateRequired", "Start and end dates are required"),
        severity: "error",
      });
      return;
    }
    if (new Date(editForm.endDate) < new Date(editForm.startDate)) {
      setSnack({
        open: true,
        msg: t("common.invalidRange", "End date must be after start date"),
        severity: "error",
      });
      return;
    }

    const leaveId =
      selectedEvent.resource?.id ??
      selectedEvent.resource?.int_con ??
      selectedEvent.id;

    const employeeId =
      selectedEvent.resource?.employeeId ??
      selectedEvent.resource?.id_emp ??
      selectedEvent.resource?.ID_EMP;

    // normalize code
    let codeToSend = (editForm.typeCode || selectedEvent.leaveType || "")
      .toString()
      .toUpperCase();
    if (!codeToSend) {
      setSnack({
        open: true,
        msg: t("leave.request.invalidType", "Please choose a valid leave type"),
        severity: "error",
      });
      return;
    }

    const doUpdate = async (keepState?: boolean) => {
      setActionLoading(true);

      // 1) Try update
      const upd = await updateLeaveRequestFlexible({
        id: leaveId,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        code: codeToSend,
        comment: editForm.comment ?? "",
        keepState,
      } as any);

      // 2) Fallback: recreate as pending when server cannot edit in place
      if (!upd.ok) {
        // Never recreate approved ones
        if (isApproved) {
          throw new Error(
            "The server doesn’t support editing approved leaves. Ask admin to enable the update route."
          );
        }
        const leaveCode = resolveLeaveCode(codeToSend);
        if (!leaveCode) {
          throw new Error(
            `Unknown leave code "${codeToSend}". Update leave types or pick a valid code.`
          );
        }
        await createLeaveRequest({
          employeeId: String(employeeId),
          leaveCode,
          leaveType: codeToSend,
          startDate: editForm.startDate,
          endDate: editForm.endDate,
          reason: editForm.comment ?? "",
          contactNumber: "",
        });
        setSnack({
          open: true,
          msg: t(
            "leave.status.recreated",
            "Updated by creating a new request (server has no edit route)"
          ),
          severity: "success",
        });
      } else {
        setSnack({
          open: true,
          msg: t("leave.status.updated", "Leave updated"),
          severity: "success",
        });
      }

      // close UI
      setEditMode(false);
      setEventDetailsOpen(false);
      setSelectedEvent(null);

      // 3) Make sure the edited item stays visible:
      const editedStart = new Date(editForm.startDate);
      const monthStart = new Date(
        editedStart.getFullYear(),
        editedStart.getMonth(),
        1
      );
      const monthEnd = new Date(
        editedStart.getFullYear(),
        editedStart.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );

      if (view === "month") {
        // navigate calendar if outside current month
        if (date < monthStart || date > monthEnd) {
          setView("month");
          setDate(editedStart);
        }
      } else {
        // any other view — just jump to the edited day
        setDate(editedStart);
      }

      await refresh();
    };

    try {
      if (isApproved && datesChanged) {
        setConfirmApprovedEditOpen(true);
        return;
      }

      await doUpdate(false);
    } catch (e: any) {
      setSnack({
        open: true,
        msg:
          e?.message ||
          e?.response?.data?.message ||
          t("leave.status.actionFailed", "Action failed"),
        severity: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const confirmApprovedEdit = async () => {
    if (!selectedEvent || selectedEvent.type !== 'leave') return;
    try {
      setConfirmApprovedEditLoading(true);
      await updateLeaveRequestFlexible({
        id: selectedEvent.resource?.id ?? selectedEvent.resource?.int_con ?? selectedEvent.id,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        code: (editForm.typeCode || selectedEvent.leaveType || '').toString().toUpperCase(),
        comment: editForm.comment ?? '',
        keepState: true,
      } as any);

      setSnack({ open: true, msg: t('leave.status.updated', 'Leave updated'), severity: 'success' });
      setConfirmApprovedEditOpen(false);
      setEditMode(false);
      setEventDetailsOpen(false);
      setSelectedEvent(null);
      await refresh();
    } catch (e: any) {
      setSnack({
        open: true,
        msg: e?.message || e?.response?.data?.message || t('leave.status.actionFailed', 'Action failed'),
        severity: 'error',
      });
    } finally {
      setConfirmApprovedEditLoading(false);
    }
  };

  // Fetch holidays (±1 year)
  const reloadHolidays = useCallback(async () => {
    try {
      const now = new Date();
      const y = now.getFullYear();
      const headers = await getAuthHeader();
      const res = await axios.get(`${apiBase}/holiday/holidays`, {
        params: { startDate: `${y - 1}-01-01`, endDate: `${y + 1}-12-31` },
        headers,
      });
      const arr = Array.isArray(res.data) ? res.data : [];
      setHolidays(arr);
    } catch (e) {
      console.error("Failed to reload holidays", e);
      setHolidays([]);
    }
  }, [apiBase]);

  useEffect(() => {
    reloadHolidays();
  }, [reloadHolidays]);

  // Load custom holidays
  useEffect(() => {
    try {
      const raw = localStorage.getItem("custom_holidays");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setCustomHolidays(arr);
      }
    } catch {}
  }, []);
  const persistCustom = (arr: any[]) => {
    setCustomHolidays(arr);
    try {
      localStorage.setItem("custom_holidays", JSON.stringify(arr));
    } catch {}
  };
  const removeCustomHoliday = (dateIso: string) => {
    const next = customHolidays.filter((h) => h.DATE_H !== dateIso);
    persistCustom(next);
    setDate((d) => new Date(d));
    setSnack({
      open: true,
      msg: t("leave.holidays.removed", "Holiday removed"),
      severity: "success",
    });
  };

  // Merge server + custom and index by date
  const allHolidays = useMemo(() => {
    const map: Record<string, any> = {};
    holidays.forEach((h: any) => {
      if (h?.DATE_H) map[h.DATE_H] = h;
    });
    customHolidays.forEach((h: any) => {
      if (h?.DATE_H) map[h.DATE_H] = { ...map[h.DATE_H], ...h };
    });
    return Object.values(map);
  }, [holidays, customHolidays]);

  const holidaySet = useMemo(() => {
    const set = new Set<string>();
    allHolidays.forEach((h: any) => {
      if (h?.DATE_H) set.add(String(h.DATE_H).slice(0, 10));
    });
    return set;
  }, [allHolidays]);

  const isHoliday = useCallback(
    (d: Date) => holidaySet.has(format(d, "yyyy-MM-dd")),
    [holidaySet]
  );
  // ✅ Replace your current isNonWorking with this:
  const isFriday = (d: Date) => d.getDay() === 5;
  const isNonWorking = useCallback(
    (d: Date) => isHoliday(d) || isFriday(d),
    [isHoliday]
  );

  const splitWorkingSegments = (start: Date, end: Date) => {
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(end);
    e.setHours(23, 59, 59, 999);

    const segments: Array<{ start: Date; end: Date }> = [];
    let cur: Date | null = null;

    const step = new Date(s);
    while (step <= e) {
      const day = new Date(step);
      const working = !isNonWorking(day);
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
      // next day
      step.setDate(step.getDate() + 1);
    }

    if (cur) {
      const segEnd = new Date(e);
      segments.push({ start: cur, end: segEnd });
    }

    return segments;
  };

  // Fetch dynamic leave types (legend)
  useEffect(() => {
    (async () => {
      try {
        const rows: any[] = await getLeaveTypesSvc(); // hits /leave/leave-types
        const next: Record<
          string,
          { name: string; color: string; id_can?: number }
        > = {};
        const idToCode: Record<number, string> = {};

        for (const r of Array.isArray(rows) ? rows : []) {
          const code = String(r?.code ?? "").toUpperCase();
          const name = r?.desig_can || r?.name || code;
          const idCan = Number(r?.int_can);
          if (!code || !Number.isFinite(idCan)) continue;

          next[code] = {
            name,
            color:
              r?.color && /^#([0-9A-F]{3}){1,2}$/i.test(r.color)
                ? r.color
                : stableColorFromCode(code),
            id_can: idCan,
          };
          idToCode[idCan] = code;
        }
        setLeaveTypesMap(next);
        // keep your existing map of code -> id_can
        setLeaveCodeMap(
          Object.fromEntries(
            Object.entries(idToCode).map(([id, c]) => [
              next[c] ? c : c,
              Number(id),
            ])
          )
        );
        // also store reverse for numeric -> code
        (window as any).__idCanToCode__ = idToCode;
      } catch {
        setLeaveTypesMap({});
      }
    })();
  }, [stableColorFromCode]);

  const canonicalCode = (raw: any): string => {
    if (raw == null) return "";
    // already code?
    const s = typeof raw === "string" ? raw.trim().toUpperCase() : "";
    if (s) return s;
    // numeric id_can?
    const n = Number(raw);
    if (Number.isFinite(n) && (window as any).__idCanToCode__) {
      return ((window as any).__idCanToCode__[n] || "").toUpperCase();
    }
    return "";
  };

  const computeEffectiveDays = useCallback(
    (start: Date, end: Date) => {
      const s = new Date(start);
      s.setHours(0, 0, 0, 0);
      const e = new Date(end);
      e.setHours(0, 0, 0, 0);
      let count = 0;
      const d = new Date(s);
      while (d <= e) {
        if (!isNonWorking(d)) count += 1;
        d.setDate(d.getDate() + 1);
      }
      return count;
    },
    [isNonWorking]
  );

  // Load calendar events
  useEffect(() => {
    const fetchCalendarData = async () => {
      try {
        setLoading(true);

        // ----- compute extended window for fetching -----
        const current = new Date(date);

        const startOfMonth = (d: Date) =>
          new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
        const endOfMonth = (d: Date) =>
          new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

        const baseStart =
          view === "week"
            ? new Date(
                new Date(current).setDate(
                  current.getDate() - ((current.getDay() || 7) - 1)
                )
              ) // Mon
            : view === "day"
              ? new Date(current)
              : startOfMonth(current);

        const baseEnd =
          view === "week"
            ? new Date(new Date(baseStart).setDate(baseStart.getDate() + 6))
            : view === "day"
              ? new Date(current)
              : endOfMonth(current);

        const HISTORY_MONTHS_BACK = 18;
        const FUTURE_MONTHS_FWD = 3;

        const addMonths = (d: Date, n: number) => {
          const x = new Date(d);
          x.setMonth(x.getMonth() + n);
          return x;
        };

        const windowStart = addMonths(
          startOfMonth(baseStart),
          -HISTORY_MONTHS_BACK
        );
        const windowEnd = addMonths(endOfMonth(baseEnd), FUTURE_MONTHS_FWD);

        // de-dup network if we already fetched this window
        const windowSig = `${format(windowStart, "yyyy-MM-dd")}__${format(windowEnd, "yyyy-MM-dd")}`;
        if (lastFetchedWindowRef.current === windowSig && events.length) {
          setLoading(false);
          return;
        }
        lastFetchedWindowRef.current = windowSig;

        // Build params for your API
        const params: any = {
          startDate: format(windowStart, "yyyy-MM-dd"),
          endDate: format(windowEnd, "yyyy-MM-dd"),
        };
        if (employeeId != null && employeeId !== "")
          params.employeeId = employeeId;

        const data = await getCalendarLog(params);

        const calendarEvents: CalendarEventExtended[] = [];
        const pending: CalendarEventExtended[] = [];
        const seenCodes = new Set<string>();

        // Leaves
        // Leaves
        if (data?.leaveRequests?.length) {
          data.leaveRequests.forEach((lr: any) => {
            const id = lr.id ?? lr.int_con;
            const start = lr.startDate ?? lr.date_depart;
            const end = lr.endDate ?? lr.date_end;
            const status = String(
              lr.status ?? lr.state ?? "pending"
            ).toLowerCase() as any;

            const codeRaw =
              lr.leaveTypeCode ?? lr.code ?? lr.id_can ?? lr.leaveType ?? "";
            const { code, color } = getTypeMeta(codeRaw);

            const empId = lr.employeeId ?? lr.id_emp ?? lr.ID_EMP;
            // Skip events for inactive employees when we know the active set
            if (empId != null && activeEmpIds && activeEmpIds.size > 0) {
              if (!activeEmpIds.has(empId) && !activeEmpIds.has(String(empId))) {
                return; // exclude inactive employee's event
              }
            } else {
              // Fallback: if active set is not loaded, infer from record
              if (!isActiveEmployee(lr)) return;
            }
            const rawName =
              lr.employeeName ?? lr.employee_name ?? lr.NAME ?? lr.name ?? "";
            const nameFromMap =
              empId != null
                ? empNameById[empId] || empNameById[String(empId)]
                : "";
            const looksNumeric = /^\d+$/.test(String(rawName || "").trim());
            const empName =
              !rawName || looksNumeric
                ? nameFromMap ||
                  (empId != null
                    ? `Emp ${empId}`
                    : t("common.unknown", "Unknown"))
                : String(rawName);

            const startD = new Date(start);
            const endD = new Date(end);
            endD.setHours(23, 59, 59, 999);

            // 👉 split into working-only spans so the UI never draws bars over Fridays/holidays
            const spans = splitWorkingSegments(startD, endD);

            const effectiveDays = Number(
              lr.effectiveDays ?? lr.effective_days ?? lr.days ?? 0
            );

            // Only show approved/accepted (keep your rule)
            if (
              ["approved", "accepted", "approve", "accept"].includes(status)
            ) {
              spans.forEach((seg, idx) => {
                const ev: CalendarEventExtended = {
                  id: `${id}-${idx}`,
                  title: empName,
                  start: seg.start,
                  end: seg.end,
                  allDay: true,
                  type: "leave",
                  status,
                  employeeName: empName,
                  leaveType: code,
                  leaveLabel: code,
                  effectiveDays,
                  resource: {
                    ...lr,
                    __color: color,
                    employeeName: empName,
                    id_emp: empId,
                  },
                };
                calendarEvents.push(ev);
              });
            }
          });
        }

        // Holidays -> "PH" (use computed window)
        const inRange = allHolidays.filter((h: any) => {
          const d = new Date(h.DATE_H);
          return d >= windowStart && d <= windowEnd;
        });
        if (inRange.length) {
          const phMeta = getTypeMeta("PH");
          seenCodes.add("PH");
          calendarEvents.push(
            ...inRange.map((h: any) => ({
              id: `holiday-${h.DATE_H}`,
              type: "holiday" as const,
              title:
                h.HOLIDAY_NAME ||
                h.COMMENT_H ||
                t("leave.holidays.title", "Public Holiday"),
              start: new Date(`${h.DATE_H}T00:00:00`),
              end: new Date(`${h.DATE_H}T23:59:59.999`),
              allDay: true,
              leaveType: "PH",
              resource: { ...h, __color: phMeta.color },
            }))
          );
        }

        // Filters (plus active employees safety)
        const filtered = calendarEvents.filter((ev) => {
          // If we know the active set, drop events for inactive employees
          const rid = (ev as any)?.resource?.id_emp ?? (ev as any)?.resource?.ID_EMP;
          if (rid != null && activeEmpIds && activeEmpIds.size > 0) {
            if (!activeEmpIds.has(rid) && !activeEmpIds.has(String(rid))) return false;
          }
          if (ev.type === "leave" && !filters.showLeaves) return false;
          if (ev.type === "holiday" && !filters.showHolidays) return false;
          if (filters.leaveTypes.length) {
            const c = String(ev.leaveType || "").toUpperCase();
            return filters.leaveTypes.includes(c);
          }
          return true;
        });

        // Ensure type entries exist
        setLeaveTypesMap((prev) => {
          let changed = false;
          const next = { ...prev };
          seenCodes.forEach((c) => {
            if (!next[c]) {
              const m = getTypeMeta(c);
              next[c] = { name: m.name, color: m.color };
              changed = true;
            }
          });
          return changed ? next : prev;
        });

        setEvents((prev) => {
          const sig = (e: any) =>
            `${e.id}|${e.type}|${e.start?.toISOString?.() || ""}|${e.end?.toISOString?.() || ""}|${e.title}`;
          const prevSig = prev.map(sig).join(",");
          const nextSig = filtered.map(sig).join(",");
          return prevSig !== nextSig ? filtered : prev;
        });
        setPendingRequests(pending);

        // Ensure timesheets exist for every month in the fetched window
        const monthStarts: Date[] = [];
        const cursor = new Date(
          windowStart.getFullYear(),
          windowStart.getMonth(),
          1
        );
        while (cursor <= windowEnd) {
          monthStarts.push(new Date(cursor));
          cursor.setMonth(cursor.getMonth() + 1);
        }
      } catch (err) {
        setError(t("leave.calendar.fetchError"));
        console.error("Error fetching calendar data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCalendarData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    apiBase,
    date,
    view,
    allHolidays,
    filters.showHolidays,
    filters.showLeaves,
    filters.leaveTypes,
    employeeId,
    empNameById,
    activeEmpIds,
    computeEffectiveDays,
    getTypeMeta,
    t,
  ]);

  // Build filter list dynamically from known types (plus PH if holidays shown)
  const availableTypeCodes = useMemo(() => {
    const codes = new Set<string>(Object.keys(leaveTypesMap));
    if (filters.showHolidays) codes.add("PH");
    return Array.from(codes).sort();
  }, [leaveTypesMap, filters.showHolidays]);

  // cache last fetched window signature
  const lastFetchedWindowRef = useRef<string>("");

  // timesheet ensuring (one-time per month)
  const ensuredMonthsRef = useRef<Set<string>>(new Set());

  // Event coloring from dynamic map
  const eventStyleGetter = (event: CalendarEventExtended) => {
    const code = String(event.leaveType || "").toUpperCase();
    if (code === "PH" || event.type === "holiday") {
      /* unchanged */
    }

    const typeEntry = code ? leaveTypesMap[code] : undefined;
    const backgroundColor =
      typeEntry?.color || stableColorFromCode(code || "GEN");
    const color = theme.palette.getContrastText(backgroundColor);

    const isPending = (event.status || "").toLowerCase() === "pending";
    return {
      style: {
        backgroundColor,
        color,
        borderRadius: "4px",
        border: isPending ? `2px dashed ${alpha(color, 0.6)}` : 0,
        opacity: 0.95,
        display: "block",
        padding: "2px 4px",
        fontSize: "0.8rem",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      },
    };
  };

  // Legend (dynamic)
  const LeaveTypeLegend = () => {
    // Build a working list of [code, {name,color}]
    const legendMap: Record<string, { name: string; color: string }> = {
      ...leaveTypesMap,
    };
    if (filters.showHolidays) {
      const ph = getTypeMeta("PH");
      legendMap["PH"] = {
        name: ph.name || t("leave.holidays.title", "Public Holiday"),
        color: ph.color,
      };
    }

    const entries = Object.entries(legendMap).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
    if (!entries.length) return null;

    // Ensure uniqueness of colors for the legend render
    const used = new Set<string>(); // lowercase hex for uniqueness
    const uniqueEntries = entries.map(([code, meta], i) => {
      const baseList = [
        (meta.color || "").toLowerCase(),
        stableColorFromCode(code).toLowerCase(),
      ].filter(Boolean);

      let color = baseList.find((c) => !used.has(c));

      if (!color) {
        // Generate a new distinct color deterministically based on code
        // seed the series with a stable per-code offset to keep it consistent across renders
        const seed = hashStr(code) % 360;
        let attempt = 0;
        do {
          color = distinctHexByIndex(attempt++, seed).toLowerCase();
        } while (used.has(color) && attempt < 24); // 24 tries is plenty for a legend
      }

      used.add(color!);
      return [code, { ...meta, color: color! }] as const;
    });

    return (
      <Box
        display="flex"
        flexWrap="wrap"
        gap={2}
        mb={2}
        p={1.5}
        bgcolor="background.paper"
        borderRadius={1}
        border="1px solid"
        borderColor="divider"
      >
        <Typography variant="subtitle2" width="100%" color="text.secondary">
          {t("leave.legend.title", "Leave Types")}
        </Typography>

        {uniqueEntries.map(([code, meta]) => {
          const isPH = code === "PH";
          const swatchColor = isPH ? PH_BG : meta.color;
          return (
            <Box
              key={code}
              display="flex"
              alignItems="center"
              mr={2}
              title={`${code} — ${meta.name}`}
            >
              <Box
                width={16}
                height={16}
                bgcolor={swatchColor}
                mr={1}
                borderRadius="2px"
                border={`1px solid ${isPH ? PH_BRAND : "var(--mui-palette-divider)"}`}
              />
              <Typography variant="caption">{`${code} — ${meta.name}`}</Typography>
            </Box>
          );
        })}
      </Box>
    );
  };

  const handleViewChange = (newView: View) => setView(newView);
  const handleNavigate = (newDate: Date) => setDate(newDate);
  const handleSelectEvent = (event: CalendarEventExtended) => {
    setSelectedEvent(event);
    setEditMode(false); // reset each time we open

    if (event?.type === "holiday") {
      const d = event.resource?.DATE_H || format(event.start, "yyyy-MM-dd");
      const c = event.resource?.COMMENT_H || "";
      setHolidayEditDate(String(d));
      setHolidayEditComment(String(c || ""));
    }

    // Prefill edit form for LEAVE events
    if (event?.type === "leave") {
      const rawStart =
        event.resource?.startDate || event.resource?.DATE_START || event.start;
      const rawEnd =
        event.resource?.endDate || event.resource?.DATE_END || event.end;
      const code = (
        event.leaveType ||
        event.resource?.code ||
        event.resource?.id_can ||
        ""
      )
        .toString()
        .toUpperCase();
      const comment = event.resource?.COMMENT || event.resource?.Cause || "";
      setEditForm({
        startDate: format(new Date(rawStart), "yyyy-MM-dd"),
        endDate: format(new Date(rawEnd), "yyyy-MM-dd"),
        typeCode: code || "",
        comment: comment || "",
      });
    }

    setEventDetailsOpen(true);
  };

  const handleCloseEventDetails = () => {
    setEventDetailsOpen(false);
    setSelectedEvent(null);
  };
  const handleSelectSlot = (slotInfo: SlotInfo) => {
    /* optional */
  };

  const refresh = async () => setDate((d) => new Date(d));

  const onModerate = async (
    status: "approved" | "rejected" | "edited" | "cancelled"
  ) => {
    if (!selectedEvent || selectedEvent.type !== "leave") return;
    const leaveId =
      selectedEvent.resource?.id ?? selectedEvent.resource?.int_con;
    if (!leaveId) return;
    try {
      setActionLoading(true);
      await updateLeaveStatus(String(leaveId), status);
      const empId =
        selectedEvent.resource?.id_emp ?? selectedEvent.resource?.ID_EMP;
      if (status === "approved" && empId) {
        try {
          await getLeaveBalance(String(empId));
        } catch {}
        try {
          const headers = await getAuthHeader();
          const startIso = selectedEvent.resource?.startDate
            ? String(selectedEvent.resource.startDate)
            : format(selectedEvent.start, "yyyy-MM-dd");
          const endIso = selectedEvent.resource?.endDate
            ? String(selectedEvent.resource.endDate)
            : format(selectedEvent.end, "yyyy-MM-dd");
          await axios.post(
            `${apiBase}/holidays/send-delegate`,
            {
              id_emp: empId,
              date_start: startIso,
              date_end: endIso,
              comment:
                selectedEvent.resource?.comments ||
                selectedEvent.resource?.COMMENT ||
                undefined,
            },
            { headers }
          );
          setSnack({
            open: true,
            msg: t("leave.delegate.emailSent", "Delegation emails sent"),
            severity: "success",
          });
        } catch {
          setSnack({
            open: true,
            msg: t(
              "leave.delegate.emailFailed",
              "Delegation email failed to send"
            ),
            severity: "error",
          });
        }
      }
      setSnack({ open: true, msg: `Leave ${status}`, severity: "success" });
      setEventDetailsOpen(false);
      setSelectedEvent(null);
      await refresh();
    } catch (e: any) {
      setSnack({
        open: true,
        msg: e?.response?.data?.message || e?.message || "Action failed",
        severity: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getHolidayRowByDate = async (isoDate: string): Promise<any | null> => {
    try {
      const rows = await getHolidaysApi();
      if (!Array.isArray(rows)) return null;
      const norm = (v: any) => String(v || "").slice(0, 10);
      return rows.find((r: any) => norm(r.DATE_H) === isoDate) || null;
    } catch {
      return null;
    }
  };

  const handleSaveHoliday = async () => {
    if (!selectedEvent || selectedEvent.type !== "holiday") return;
    const originalDate: string = String(
      selectedEvent.resource?.DATE_H ||
        format(selectedEvent.start, "yyyy-MM-dd")
    );
    try {
      setActionLoading(true);
      const row = await getHolidayRowByDate(originalDate);
      if (row && (row.ID_HOLIDAYS != null || row.id != null)) {
        const id = row.ID_HOLIDAYS ?? row.id;
        await updateHolidayApi(id, {
          date: holidayEditDate,
          comment: holidayEditComment,
        });
        setSnack({
          open: true,
          msg: t("leave.holidays.updated", "Holiday updated"),
          severity: "success",
        });
      } else {
        const name =
          selectedEvent.resource?.HOLIDAY_NAME ||
          t("leave.holidays.title", "Public Holiday");
        await createHoliday({
          type: "variable",
          name,
          date: holidayEditDate,
          comment: holidayEditComment || undefined,
        });
        setSnack({
          open: true,
          msg: t("leave.holidays.added", "Holiday added"),
          severity: "success",
        });
      }
      await reloadHolidays();
      setEventDetailsOpen(false);
      setSelectedEvent(null);
      setDate((d) => new Date(d));
    } catch (e: any) {
      setSnack({
        open: true,
        msg:
          e?.response?.data?.message ||
          e?.message ||
          t("leave.holidays.updateFailed", "Failed to save holiday"),
        severity: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteHoliday = async () => {
    if (!selectedEvent || selectedEvent.type !== "holiday") return;
    const originalDate: string = String(
      selectedEvent.resource?.DATE_H ||
        format(selectedEvent.start, "yyyy-MM-dd")
    );
    try {
      setActionLoading(true);
      const row = await getHolidayRowByDate(originalDate);
      if (row && (row.ID_HOLIDAYS != null || row.id != null)) {
        const id = row.ID_HOLIDAYS ?? row.id;
        await deleteHolidayApi(id);
        setSnack({
          open: true,
          msg: t("leave.holidays.removed", "Holiday removed"),
          severity: "success",
        });
        await reloadHolidays();
        setEventDetailsOpen(false);
        setSelectedEvent(null);
        setDate((d) => new Date(d));
      } else {
        const isCustom = customHolidays.some(
          (h: any) => String(h.DATE_H).slice(0, 10) === originalDate
        );
        if (isCustom) {
          removeCustomHoliday(originalDate);
          setEventDetailsOpen(false);
          setSelectedEvent(null);
        } else {
          setSnack({
            open: true,
            msg: t(
              "leave.holidays.deleteUnavailable",
              "This holiday is computed and cannot be deleted"
            ),
            severity: "info",
          });
        }
      }
    } catch (e: any) {
      setSnack({
        open: true,
        msg:
          e?.response?.data?.message ||
          e?.message ||
          t("leave.holidays.deleteFailed", "Failed to delete holiday"),
        severity: "error",
      });
    } finally {
      setActionLoading(false);
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

  if (error) {
    return (
      <Box mt={2}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  // Theme skin for react-big-calendar
  const calendarSkin = {
    "& .rbc-toolbar": { color: theme.palette.text.primary },
    "& .rbc-btn-group > button": {
      borderColor: gridBorder,
      color: theme.palette.text.secondary,
      backgroundColor: isDark ? alpha("#fff", 0.02) : alpha("#000", 0.02),
      "&:hover": {
        backgroundColor: isDark ? alpha("#fff", 0.06) : alpha("#000", 0.06),
      },
    },
    "& .rbc-month-view .rbc-friday, & .rbc-time-view .rbc-friday": {
    backgroundColor: alpha(theme.palette.text.primary, 0.04),
  },
    "& .rbc-month-row, & .rbc-time-content": { borderColor: gridBorder },
    "& .rbc-day-bg + .rbc-day-bg, & .rbc-time-header-content": {
      borderColor: gridBorder,
    },
    "& .rbc-off-range-bg": {
      backgroundColor: isDark ? alpha("#fff", 0.03) : alpha("#000", 0.03),
    },
    "& .rbc-today": { backgroundColor: brandSoft },
    "& .rbc-event": {
      boxShadow: isDark
        ? "0 2px 4px rgba(0,0,0,0.6)"
        : "0 2px 4px rgba(0,0,0,0.15)",
    },
    "& .rbc-time-slot": { borderColor: gridBorder },
  } as const;

  const activePillSx = {
    bgcolor: brand,
    color: theme.palette.getContrastText(brand),
    "&:hover": { bgcolor: brandHover },
    borderRadius: 999,
    px: 1.25,
    py: 0.75,
  };

  const openAddHoliday = () => setAddHolidayOpen(true);
  const closeAddHoliday = () => {
    setAddHolidayOpen(false);
    setHolidayForm({
      type: "variable",
      date: "",
      name: "",
      comment: "",
    });
  };

  const handleCreateHoliday = async () => {
    try {
      const name =
        holidayForm.name?.trim() || t("leave.holidays.title", "Public Holiday");
      const comment = holidayForm.comment?.trim() || undefined;

      if (!holidayForm.date) {
        setSnack({
          open: true,
          msg: t("leave.holidays.dateRequired", "Please choose a date"),
          severity: "error",
        });
        return;
      }

      setActionLoading(true);
      await createHoliday({
        type: "variable",
        name,
        date: holidayForm.date,
        comment,
      });

      await reloadHolidays();
      setSnack({
        open: true,
        msg: t("leave.holidays.added", "Holiday added"),
        severity: "success",
      });
      closeAddHoliday();
      setDate((d) => new Date(d));
    } catch (e: any) {
      setSnack({
        open: true,
        msg:
          e?.response?.data?.message ||
          e?.message ||
          t("leave.holidays.addFailed", "Failed to add holiday"),
        severity: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <DialogContent sx={{ p: 0 }}>
      <Card
        variant="outlined"
        sx={{ boxShadow: 3, p: 2, bgcolor: cardBg, borderColor: cardBorder }}
      >
        <CardHeader title={t("leave.calendar.title")} />
        <CardContent>
          <Box
            mb={3}
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            rowGap={1}
          >
            <Box display="flex" alignItems="center" flexWrap="wrap" rowGap={1}>
              <Tooltip title={t("leave.calendar.today")}>
                <IconButton
                  onClick={() => setDate(new Date())}
                  size="large"
                  sx={activePillSx}
                >
                  <TodayIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title={t("leave.calendar.dayView")}>
                <IconButton
                  onClick={() => setView("day")}
                  size="large"
                  sx={
                    view === "day"
                      ? activePillSx
                      : { color: theme.palette.text.secondary }
                  }
                >
                  <ViewAgendaIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title={t("leave.calendar.weekView")}>
                <IconButton
                  onClick={() => setView("week")}
                  size="large"
                  sx={
                    view === "week"
                      ? activePillSx
                      : { color: theme.palette.text.secondary }
                  }
                >
                  <ViewWeekIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title={t("leave.calendar.monthView")}>
                <IconButton
                  onClick={() => setView("month")}
                  size="large"
                  sx={
                    view === "month"
                      ? activePillSx
                      : { color: theme.palette.text.secondary }
                  }
                >
                  <EventIcon />
                </IconButton>
              </Tooltip>

              <Box ml={2}>
                <Typography variant="h5">
                  {view === "month"
                    ? format(date, "MMMM yyyy")
                    : view === "week"
                      ? `${format(date, "MMM d")} - ${format(new Date(date).setDate(date.getDate() + 6), "MMM d, yyyy")}`
                      : format(date, "MMMM d, yyyy")}
                </Typography>
              </Box>
            </Box>

            <Box display="flex" alignItems="center" sx={{ gap: 1 }}>
              {canModerate && (
                <Button
                  variant="contained"
                  size="small"
                  onClick={openAddHoliday}
                >
                  {t("leave.holidays.addGlobal", "Add Holiday")}
                </Button>
              )}
              <IconButton
                onClick={(e) => setAnchorEl(e.currentTarget)}
                size="large"
                sx={{
                  color: theme.palette.text.secondary,
                  border: `1px solid ${gridBorder}`,
                }}
              >
                <FilterIcon />
              </IconButton>
            </Box>
          </Box>

          {/* Dynamic legend */}
          <LeaveTypeLegend />

          {/* Filters menu (dynamic types) */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem>
              <FormControl fullWidth>
                <InputLabel>{t("leave.calendar.filters")}</InputLabel>
                <Select
                  multiple
                  value={filters.leaveTypes}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      leaveTypes: (e.target.value as string[]).map((c) =>
                        c.toUpperCase()
                      ),
                    }))
                  }
                  renderValue={(selected) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {(selected as string[]).map((code) => (
                        <Chip key={code} label={code} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {availableTypeCodes.map((code) => (
                    <MenuItem key={code} value={code}>
                      <Checkbox checked={filters.leaveTypes.includes(code)} />
                      <ListItemText
                        primary={`${code} — ${leaveTypesMap[code]?.name || (code === "PH" ? t("leave.holidays.title", "Public Holiday") : code)}`}
                      />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </MenuItem>

            <MenuItem>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={filters.showLeaves}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        showLeaves: e.target.checked,
                      }))
                    }
                  />
                }
                label={t("leave.calendar.showLeaves")}
              />
            </MenuItem>
            <MenuItem>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={filters.showHolidays}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        showHolidays: e.target.checked,
                      }))
                    }
                  />
                }
                label={t("leave.calendar.showHolidays")}
              />
            </MenuItem>
          </Menu>

          {/* Calendar */}
          <Box height="calc(100vh - 300px)" minHeight={500} sx={calendarSkin}>
            <BigCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: "100%" }}
              view={view}
              onView={handleViewChange}
              date={date}
              onNavigate={handleNavigate}
              selectable
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventStyleGetter}
              messages={{
                today: t("common.today"),
                previous: t("common.previous"),
                next: t("common.next"),
                month: t("common.month"),
                week: t("common.week"),
                day: t("common.day"),
                agenda: t("common.agenda"),
                date: t("common.date"),
                time: t("common.time"),
                event: t("common.event"),
                noEventsInRange: t("leave.calendar.noEvents"),
              }}
              dayPropGetter={(date) => {
                if (isFriday(date)) {
                  return {
                    className: "rbc-friday",
                    style: {
                      background: alpha(theme.palette.text.primary, 0.4),
                      filter: "grayscale(0.3)",
                    },
                  };
                }
                return {};
              }}
            />
            {events.length === 0 && (
              <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                height="100%"
              >
                <Alert severity="info">
                  {t("leave.calendar.noEvents", "No events in range")}
                </Alert>
              </Box>
            )}
          </Box>

          {/* Add Holiday Dialog */}
          {/* Add Holiday Dialog */}
          <Dialog
            open={addHolidayOpen}
            onClose={closeAddHoliday}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                position: "relative",
                pr: 6,
              }}
            >
              {t("leave.holidays.addGlobal", "Add Holiday")}
              <IconButton
                aria-label="close"
                onClick={closeAddHoliday}
                sx={{
                  position: "absolute",
                  right: 8,
                  top: 8,
                  color: (theme) => theme.palette.grey[500],
                }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <Box mt={1} display="flex" flexDirection="column" gap={2}>
                <TextField
                  type="date"
                  fullWidth
                  label={t("leave.holidays.date", "Date")}
                  InputLabelProps={{ shrink: true }}
                  value={holidayForm.date}
                  onChange={(e) =>
                    setHolidayForm((f) => ({ ...f, date: e.target.value }))
                  }
                />
                <TextField
                  fullWidth
                  label={t("leave.holidays.name", "Holiday name")}
                  value={holidayForm.name}
                  onChange={(e) =>
                    setHolidayForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label={t("common.comment", "Comment")}
                  value={holidayForm.comment}
                  onChange={(e) =>
                    setHolidayForm((f) => ({ ...f, comment: e.target.value }))
                  }
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={handleCreateHoliday}
                variant="contained"
                disabled={actionLoading}
              >
                {t("common.save", "Save")}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Event Details */}
          {selectedEvent && (
            <Dialog
              open={eventDetailsOpen}
              onClose={handleCloseEventDetails}
              maxWidth="sm"
              fullWidth
            >
              <DialogTitle
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  position: "relative",
                  pr: 6,
                }}
              >
                <span>
                  {selectedEvent.type === "holiday"
                    ? selectedEvent.title
                    : `${selectedEvent.employeeName || ""}${
                        selectedEvent.leaveType
                          ? ` - ${leaveTypesMap[selectedEvent.leaveType]?.name || selectedEvent.leaveType}`
                          : ""
                      }`}
                </span>
                <IconButton
                  aria-label="close"
                  onClick={handleCloseEventDetails}
                  sx={{
                    position: "absolute",
                    right: 8,
                    top: 8,
                    color: (theme) => theme.palette.grey[500],
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </DialogTitle>
              <DialogContent>
                <Box mb={2}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t("common.date")}
                  </Typography>
                  <Typography>
                    {format(selectedEvent.start, "PPP")}
                    {selectedEvent.end &&
                      !isSameDay(selectedEvent.start, selectedEvent.end) &&
                      ` - ${format(selectedEvent.end, "PPP")}`}
                  </Typography>
                </Box>

                {selectedEvent.type === "holiday" && (
                  <>
                    <Box mb={2}>
                      <Typography variant="subtitle2" color="text.secondary">
                        {t("leave.holidays.name", "Holiday")}
                      </Typography>
                      <Typography>
                        {selectedEvent.resource?.HOLIDAY_NAME ||
                          t("leave.holidays.title", "Public Holiday")}
                      </Typography>
                    </Box>
                    <Box mb={2}>
                      <TextField
                        type="date"
                        fullWidth
                        label={t("leave.holidays.date", "Date")}
                        InputLabelProps={{ shrink: true }}
                        value={holidayEditDate}
                        onChange={(e) => setHolidayEditDate(e.target.value)}
                      />
                    </Box>
                    <Box mb={2}>
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        label={t("common.comment", "Comment")}
                        value={holidayEditComment}
                        onChange={(e) => setHolidayEditComment(e.target.value)}
                      />
                    </Box>
                  </>
                )}

                {selectedEvent.type === "leave" && selectedEvent.status && (
                  <Box mb={2}>
                    <Typography variant="subtitle2" color="text.secondary">
                      {t("leave.status.status")}
                    </Typography>
                    <Chip
                      label={t(
                        `leave.status.${selectedEvent.status.toLowerCase()}`
                      )}
                      color={
                        selectedEvent.status === "approved"
                          ? "success"
                          : selectedEvent.status === "rejected"
                            ? "error"
                            : selectedEvent.status === "cancelled"
                              ? "default"
                              : "warning"
                      }
                      variant="outlined"
                      size="small"
                    />
                  </Box>
                )}

                {selectedEvent.type === "leave" && editMode && (
                  <Box
                    display="grid"
                    gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr" }}
                    gap={2}
                    mt={1}
                  >
                    <TextField
                      type="date"
                      fullWidth
                      label={t("leave.balance.start", "Start")}
                      InputLabelProps={{ shrink: true }}
                      value={editForm.startDate}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          startDate: e.target.value,
                        }))
                      }
                    />
                    <TextField
                      type="date"
                      fullWidth
                      label={t("leave.balance.end", "End")}
                      InputLabelProps={{ shrink: true }}
                      value={editForm.endDate}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, endDate: e.target.value }))
                      }
                    />

                    <FormControl
                      fullWidth
                      sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}
                    >
                      <InputLabel id="edit-type-label">
                        {t("leave.balance.type", "Type")}
                      </InputLabel>
                      <Select
                        labelId="edit-type-label"
                        label={t("leave.balance.type", "Type")}
                        value={editForm.typeCode}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            typeCode: String(e.target.value).toUpperCase(),
                          }))
                        }
                      >
                        {Object.keys(leaveTypesMap)
                          .sort()
                          .map((code) => (
                            <MenuItem key={code} value={code}>
                              {code} — {leaveTypesMap[code]?.name || code}
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>

                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      label={t("leave.request.comments", "Comments")}
                      value={editForm.comment}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, comment: e.target.value }))
                      }
                      sx={{ gridColumn: "1 / -1" }}
                    />
                  </Box>
                )}

                {selectedEvent.type === "leave" && (
                  <Box mb={2}>
                    <Typography variant="subtitle2" color="text.secondary">
                      {t("leave.status.days", "Days")}
                    </Typography>
                    <Typography>
                      {Number(
                        selectedEvent.resource?.effectiveDays ??
                          selectedEvent.resource?.effective_days ??
                          selectedEvent.effectiveDays ??
                          selectedEvent.resource?.days ??
                          selectedEvent.resource?.nbr_jour ??
                          0
                      )}
                    </Typography>
                  </Box>
                )}

                {selectedEvent.type === "leave" &&
                  (selectedEvent.resource?.COMMENT ||
                    selectedEvent.resource?.Cause) && (
                    <Box mb={2}>
                      <Typography variant="subtitle2" color="text.secondary">
                        {t("leave.request.comments")}
                      </Typography>
                      <Typography>
                        {selectedEvent.resource?.COMMENT ||
                          selectedEvent.resource?.Cause}
                      </Typography>
                    </Box>
                  )}
              </DialogContent>
              <DialogActions>
                {selectedEvent.type === "holiday" && canModerate && (
                  <>
                    <Button
                      onClick={handleDeleteHoliday}
                      color="error"
                      disabled={actionLoading}
                    >
                      {t("common.delete", "Delete")}
                    </Button>
                    <Button
                      onClick={handleSaveHoliday}
                      variant="contained"
                      disabled={actionLoading}
                    >
                      {t("common.save", "Save")}
                    </Button>
                  </>
                )}
                {selectedEvent.type === "leave" && canModerate && (
                  <>
                    <Button
                      onClick={() => onModerate("rejected")}
                      color="error"
                      disabled={actionLoading}
                    >
                      {t("leave.status.reject", "Deny")}
                    </Button>
                    <Button
                      onClick={() => onModerate("cancelled")}
                      color="warning"
                      disabled={actionLoading || String(selectedEvent.status || '').toLowerCase() === 'cancelled'}
                    >
                      {t("common.cancel", "Cancel")}
                    </Button>
                    {!editMode ? (
                      <Button
                        onClick={() => setEditMode(true)}
                        color="inherit"
                        disabled={actionLoading}
                      >
                        {t("leave.status.edit", "Edit")}
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={() => setEditMode(false)}
                          color="inherit"
                          disabled={actionLoading}
                        >
                          {t("common.cancel", "Cancel")}
                        </Button>
                        <Button
                          onClick={handleSaveEditedLeave}
                          variant="contained"
                          disabled={actionLoading}
                        >
                          {t("common.save", "Save")}
                        </Button>
                      </>
                    )}
                    <Button
                      onClick={() => onModerate("approved")}
                      variant="contained"
                      color="success"
                      disabled={actionLoading}
                    >
                      {t("leave.status.approve", "Approve")}
                    </Button>
                  </>
                )}
              </DialogActions>
            </Dialog>
          )}

          {/* Confirm: edit approved leave without re-approval */}
          {selectedEvent?.type === 'leave' && (
            <Dialog
              open={confirmApprovedEditOpen}
              onClose={() => setConfirmApprovedEditOpen(false)}
              maxWidth="sm"
              fullWidth
            >
              <DialogTitle>
                {t('leave.editApproved.title', 'Update approved leave?')}
              </DialogTitle>
              <DialogContent>
                <Typography variant="body2" color="text.secondary">
                  {t(
                    'leave.editApproved.body',
                    `This leave is already approved for ${selectedEvent.employeeName || 'this employee'}. Do you want to update the dates and keep it approved?`
                  )}
                </Typography>
                <Box mt={2}>
                  <Typography variant="subtitle2">{t('leave.editApproved.old', 'Current')}</Typography>
                  <Typography>
                    {String(selectedEvent.resource?.startDate || format(selectedEvent.start, 'yyyy-MM-dd')).slice(0, 10)}
                    {' → '}
                    {String(selectedEvent.resource?.endDate || format(selectedEvent.end, 'yyyy-MM-dd')).slice(0, 10)}
                  </Typography>
                </Box>
                <Box mt={2}>
                  <Typography variant="subtitle2">{t('leave.editApproved.new', 'New')}</Typography>
                  <Typography>
                    {String(editForm.startDate).slice(0, 10)}
                    {' → '}
                    {String(editForm.endDate).slice(0, 10)}
                  </Typography>
                </Box>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={() => setConfirmApprovedEditOpen(false)}
                  color="inherit"
                  disabled={confirmApprovedEditLoading}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  onClick={confirmApprovedEdit}
                  variant="contained"
                  color="warning"
                  disabled={confirmApprovedEditLoading}
                >
                  {t('leave.editApproved.confirm', 'Update & notify')}
                </Button>
              </DialogActions>
            </Dialog>
          )}

          {/* Snackbar */}
          {snack.open && (
            <Box sx={{ position: "fixed", bottom: 16, right: 16 }}>
              <Alert
                severity={snack.severity}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
              >
                {snack.msg}
              </Alert>
            </Box>
          )}
        </CardContent>
      </Card>
    </DialogContent>
  );
};

export default CalendarLogScreen;
