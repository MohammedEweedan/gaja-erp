import React, { useState, useEffect, useMemo } from "react";
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
} from "@mui/material";
import { getCalendarLog, updateLeaveStatus, getLeaveBalance } from "../../services/leaveService";
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
} from "@mui/icons-material";
import { format, isSameDay, differenceInCalendarDays } from "date-fns";
import { hasRole } from "../../Setup/getUserInfo";
import axios from "axios";
import { getAuthHeader } from "../../utils/auth";

const localizer = momentLocalizer(moment);

interface CalendarEventExtended extends CalendarEvent {
  id?: string | number;
  type: "leave" | "holiday";
  status?: "pending" | "approved" | "rejected" | "cancelled";
  employeeName?: string;
  leaveType?: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource?: any;
}

const CalendarLogScreen: React.FC<{ employeeId?: string | number }> = ({
  employeeId,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  // Brand color (gaja.100) with safe fallback
  const brand: string = (theme.palette as any)?.gaja?.[100] || theme.palette.text.primary;
  const brandHover = isDark ? lighten(brand, 0.08) : darken(brand, 0.12);
  const brandSoft = alpha(brand, isDark ? 0.18 : 0.1);
  const gridBorder = alpha(isDark ? "#ffffff" : "#000000", 0.1);
  const cardBg = theme.palette.background.paper;
  const cardBorder = alpha(isDark ? "#ffffff" : "#000000", 0.14);

  const [loading, setLoading] = useState<boolean>(true);
  const [events, setEvents] = useState<CalendarEventExtended[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState<Date>(new Date());
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventExtended | null>(null);
  const [eventDetailsOpen, setEventDetailsOpen] = useState<boolean>(false);
  const [filters, setFilters] = useState({
    showLeaves: true,
    showHolidays: true,
    leaveTypes: [] as string[],
  });
  const [employeeColors, setEmployeeColors] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' | 'info' }>({ open: false, msg: '', severity: 'success' });
  const [empNameById, setEmpNameById] = useState<Record<string | number, string>>({});
  const API_URL = process.env.REACT_APP_API_IP;

  // Simple but stable palette to hash employee names into
  const palette: string[] = [
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
  ];
  const colorForName = (name: string, indexHint: number) => {
    if (!name) return brand; // default to brand if no name
    let h = 0;
    for (let i = 0; i < name.length; i++)
      h = (h * 31 + name.charCodeAt(i)) >>> 0;
    const idx = (h + indexHint) % palette.length;
    const c = palette[idx];
    // soften for dark/light
    return isDark ? alpha(c, 0.7) : alpha(c, 0.85);
  };

  const canModerate = useMemo(() => hasRole('HR') || hasRole('Admin') || hasRole('HR Manager') || hasRole('Super Admin'), []);

  useEffect(() => {
    // Fetch employees list once to enrich events with names when backend omits them
    const fetchEmployees = async () => {
      try {
        const res = await axios.get(`${API_URL}/employees`, { headers: await getAuthHeader() });
        const arr = Array.isArray(res.data) ? res.data : res.data?.data || [];
        const m: Record<string | number, string> = {};
        for (const e of arr) {
          const id = e?.ID_EMP ?? e?.id ?? e?.id_emp;
          const name = e?.NAME ?? e?.name ?? e?.employeeName;
          if (id != null && name) m[id] = String(name);
        }
        setEmpNameById(m);
      } catch {
        // ignore
      }
    };
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchCalendarData = async () => {
      try {
        setLoading(true);

        // derive range by view
        let startDate: Date;
        let endDate: Date;
        const current = new Date(date);

        if (view === "month") {
          startDate = new Date(current.getFullYear(), current.getMonth(), 1);
          endDate = new Date(current.getFullYear(), current.getMonth() + 1, 0);
        } else if (view === "week") {
          const dow = current.getDay();
          const diff = current.getDate() - dow + (dow === 0 ? -6 : 1);
          startDate = new Date(current.setDate(diff));
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
        } else {
          startDate = new Date(current);
          endDate = new Date(current);
        }

        const fmt = (d: Date) => format(d, "yyyy-MM-dd");

        const params: any = { startDate: fmt(startDate), endDate: fmt(endDate) };
        if (employeeId != null && employeeId !== '') params.employeeId = employeeId;
        const data = await getCalendarLog(params);

        const calendarEvents: CalendarEventExtended[] = [];
        const nameSet = new Set<string>();

        // Normalize new backend shape → events
        if (data?.leaveRequests?.length) {
          data.leaveRequests.forEach((lr: any) => {
            const id = lr.id ?? lr.int_con;
            const start = lr.startDate ?? lr.date_depart;
            const end = lr.endDate ?? lr.date_end;
            const status = String(
              lr.status ?? lr.state ?? "pending"
            ).toLowerCase() as any;
            const typeName =
              lr.leaveTypeName ??
              lr.leaveType ??
              String(lr.code ?? lr.id_can ?? "");
            const empId = lr.employeeId ?? lr.id_emp ?? lr.ID_EMP;
            const empNameRaw = lr.employeeName ?? lr.employee_name ?? "";
            const empName = empNameRaw && String(empNameRaw).trim() !== ""
              ? empNameRaw
              : (empId != null ? (empNameById[empId] || `Emp ${empId}`) : "Employee");
            const startD = new Date(start);
            const endD = new Date(new Date(end).setHours(23, 59, 59));
            const days =
              lr.days ??
              lr.nbr_jour ??
              differenceInCalendarDays(endD, startD) + 1;

            nameSet.add(empName);

            calendarEvents.push({
              id,
              title: `${empName}${typeName ? " - " + typeName : ""}${
                days ? ` (${days}d)` : ""
              }`,
              start: startD,
              end: endD,
              allDay: true,
              type: "leave",
              status,
              employeeName: empName,
              leaveType: typeName,
              resource: lr,
            });
          });
        }

        // Holidays if your API returns them
        if (Array.isArray(data?.holidays)) {
          data.holidays.forEach((h: any) => {
            calendarEvents.push({
              id: `h-${h.date}-${h.name}`,
              title: h.name,
              start: new Date(h.date),
              end: new Date(h.date),
              allDay: true,
              type: "holiday",
              resource: h,
            });
          });
        }

        // Client-side filters
        const filtered = calendarEvents.filter((ev) => {
          if (ev.type === "leave" && !filters.showLeaves) return false;
          if (ev.type === "holiday" && !filters.showHolidays) return false;
          if (ev.type === "leave" && filters.leaveTypes.length) {
            return filters.leaveTypes.includes(
              String(ev.leaveType).toLowerCase()
            );
          }
          return true;
        });

        // Build/update employee color map
        const names = Array.from(nameSet).filter(Boolean);
        const newMap: Record<string, string> = { ...employeeColors };
        names.forEach((n, i) => {
          if (!newMap[n]) newMap[n] = colorForName(n, i);
        });
        setEmployeeColors(newMap);
        setEvents(filtered);
      } catch (err) {
        setError(t("leave.calendar.fetchError"));
        console.error("Error fetching calendar data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCalendarData();
  }, [
    date,
    view,
    t,
    filters.showHolidays,
    filters.showLeaves,
    filters.leaveTypes,
    // react to theme mode changes too
    theme.palette.mode,
    employeeId,
    empNameById,
  ]);

  const handleViewChange = (newView: View) => setView(newView);
  const handleNavigate = (newDate: Date) => setDate(newDate);
  const handleSelectEvent = (event: CalendarEventExtended) => {
    setSelectedEvent(event);
    setEventDetailsOpen(true);
  };
  const handleCloseEventDetails = () => {
    setEventDetailsOpen(false);
    setSelectedEvent(null);
  };
  const handleSelectSlot = (slotInfo: SlotInfo) => {
    console.log("Selected slot:", slotInfo);
  };

  const eventStyleGetter = (event: CalendarEventExtended) => {
    // Color-code by employee; fallback to brand tint
    const empColor = event.employeeName
      ? employeeColors[event.employeeName]
      : undefined;
    let backgroundColor =
      empColor || (isDark ? alpha(brand, 0.4) : alpha(brand, 0.25));
    let borderColor = brand;

    // Status border hint
    if (event.status) {
      switch (event.status.toLowerCase()) {
        case "approved":
          borderColor = theme.palette.success.main;
          break;
        case "rejected":
          borderColor = theme.palette.error.main;
          break;
        case "cancelled":
          borderColor = theme.palette.grey[500];
          break;
        case "pending":
        default:
          borderColor = theme.palette.warning.main;
          break;
      }
    }

    return {
      style: {
        backgroundColor,
        borderRadius: "6px",
        opacity: 0.95,
        color: theme.palette.getContrastText(
          isDark ? alpha(backgroundColor, 0.7) : backgroundColor
        ),
        border: `2px solid ${borderColor}`,
        display: "block",
        padding: "4px 8px",
        fontSize: "0.85rem",
        cursor: "pointer",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      },
    };
  };

  const refresh = async () => {
    // Trigger a refetch by nudging date state (or call the inner fetch directly if refactoring)
    setDate((d) => new Date(d));
  };

  const onModerate = async (status: 'approved' | 'rejected' | 'cancelled') => {
    if (!selectedEvent || selectedEvent.type !== 'leave') return;
    const leaveId = selectedEvent.resource?.id ?? selectedEvent.resource?.int_con;
    if (!leaveId) return;
    try {
      setActionLoading(true);
      await updateLeaveStatus(String(leaveId), status);
      // Optionally trigger server-side balance refresh by reading it once
      const empId = selectedEvent.resource?.id_emp ?? selectedEvent.resource?.ID_EMP;
      if (status === 'approved' && empId) {
        try { await getLeaveBalance(String(empId)); } catch { }
      }
      setSnack({ open: true, msg: `Leave ${status}`, severity: 'success' });
      setEventDetailsOpen(false);
      setSelectedEvent(null);
      await refresh();
    } catch (e: any) {
      setSnack({ open: true, msg: e?.response?.data?.message || e?.message || 'Action failed', severity: 'error' });
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

  // Styles to theme react-big-calendar for dark/light + brand
  const calendarSkin = {
    "& .rbc-toolbar": {
      color: theme.palette.text.primary,
    },
    "& .rbc-btn-group > button": {
      borderColor: gridBorder,
      color: theme.palette.text.secondary,
      backgroundColor: isDark ? alpha("#fff", 0.02) : alpha("#000", 0.02),
      "&:hover": {
        backgroundColor: isDark ? alpha("#fff", 0.06) : alpha("#000", 0.06),
      },
    },
    "& .rbc-month-view, & .rbc-time-view": {
      borderColor: gridBorder,
      backgroundColor: theme.palette.background.default,
    },
    "& .rbc-month-row, & .rbc-time-content": {
      borderColor: gridBorder,
    },
    "& .rbc-day-bg + .rbc-day-bg, & .rbc-time-header-content": {
      borderColor: gridBorder,
    },
    "& .rbc-off-range-bg": {
      backgroundColor: isDark ? alpha("#fff", 0.03) : alpha("#000", 0.03),
    },
    "& .rbc-today": {
      backgroundColor: brandSoft,
    },
    "& .rbc-event": {
      boxShadow: isDark
        ? "0 2px 4px rgba(0,0,0,0.6)"
        : "0 2px 4px rgba(0,0,0,0.15)",
    },
    "& .rbc-time-slot": {
      borderColor: gridBorder,
    },
  } as const;

  const activePillSx = {
    bgcolor: brand,
    color: theme.palette.getContrastText(brand),
    "&:hover": { bgcolor: brandHover },
  };

  return (
    <DialogContent sx={{ p: 0 }}>
      <Card
        variant="outlined"
        sx={{
          boxShadow: 3,
          p: 2,
          bgcolor: cardBg,
          borderColor: cardBorder,
        }}
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
                  onClick={() => handleViewChange("day")}
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
                  onClick={() => handleViewChange("week")}
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
                  onClick={() => handleViewChange("month")}
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
                      ? `${format(date, "MMM d")} - ${format(
                          new Date(date).setDate(date.getDate() + 6),
                          "MMM d, yyyy"
                        )}`
                      : format(date, "MMMM d, yyyy")}
                </Typography>
              </Box>
            </Box>
            <Box display="flex" alignItems="center">

              <IconButton
                onClick={(e) => setAnchorEl(e.currentTarget)}
                size="large"
                sx={{
                  ml: 1,
                  color: theme.palette.text.secondary,
                  border: `1px solid ${gridBorder}`,
                }}
              >
                <FilterIcon />
              </IconButton>
            </Box>

            {/* Legend */}
            <Box
              ml={2}
              maxWidth={480}
              sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}
            >
              {Object.keys(employeeColors).length ? (
                Object.entries(employeeColors).map(([name, color]) => (
                  <Box
                    key={name}
                    sx={{ display: "flex", alignItems: "center", mr: 1 }}
                  >
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        bgcolor: color,
                        borderRadius: "2px",
                        mr: 0.5,
                        border: `1px solid ${alpha("#000", isDark ? 0.5 : 0.2)}`,
                      }}
                    />
                    <Typography variant="caption" noWrap title={name}>
                      {name}
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography variant="caption" color="text.secondary">
                  {t(
                    "leave.calendar.legend",
                    "Legend appears when events load"
                  )}
                </Typography>
              )}
            </Box>
          </Box>
        </CardContent>

        {/* Filters Menu */}
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
                  setFilters({
                    ...filters,
                    leaveTypes: e.target.value as string[],
                  })
                }
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {(selected as string[]).map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {[
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
                ].map((type) => (
                  <MenuItem key={type} value={type.toLowerCase()}>
                    <Checkbox
                      checked={filters.leaveTypes.includes(type.toLowerCase())}
                    />
                    <ListItemText primary={type} />
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
                    setFilters({ ...filters, showLeaves: e.target.checked })
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
                    setFilters({ ...filters, showHolidays: e.target.checked })
                  }
                />
              }
              label={t("leave.calendar.showHolidays")}
            />
          </MenuItem>
        </Menu>

        <Box height="calc(100vh - 300px)" minHeight={500} sx={calendarSkin}>
          {events.length === 0 ? (
            <Box display="flex" alignItems="center" justifyContent="center" height="100%">
              <Alert severity="info">{t('leave.calendar.noEvents', 'No events in range')}</Alert>
            </Box>
          ) : (
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
            />
          )}
        </Box>

        {/* Event Details */}
        {selectedEvent && (
          <Dialog
            open={eventDetailsOpen}
            onClose={handleCloseEventDetails}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              {selectedEvent.type === "holiday"
                ? selectedEvent.title
                : `${selectedEvent.employeeName || ""}${
                    selectedEvent.leaveType ? ` - ${selectedEvent.leaveType}` : ""
                  }`}
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

              {selectedEvent.type === "leave" && (
                <Box mb={2}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t("leave.status.days", "Days")}
                  </Typography>
                  <Typography>
                    {selectedEvent.resource?.nbr_jour ??
                      selectedEvent.resource?.days ??
                      differenceInCalendarDays(
                        selectedEvent.end,
                        selectedEvent.start
                      ) + 1}
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

              {selectedEvent.type === "holiday" &&
                selectedEvent.resource?.description && (
                  <Box mb={2}>
                    <Typography variant="subtitle2" color="text.secondary">
                      {t("common.description")}
                    </Typography>
                    <Typography>
                      {selectedEvent.resource.description}
                    </Typography>
                  </Box>
                )}
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseEventDetails} disabled={actionLoading}>
                {t("common.close")}
              </Button>
              {selectedEvent.type === 'leave' && canModerate && (
                <>
                  <Button onClick={() => onModerate('rejected')} color="error" disabled={actionLoading}>
                    {t('leave.status.reject', 'Reject')}
                  </Button>
                  <Button onClick={() => onModerate('cancelled')} color="inherit" disabled={actionLoading}>
                    {t('leave.status.cancel', 'Cancel')}
                  </Button>
                  <Button onClick={() => onModerate('approved')} variant="contained" color="success" disabled={actionLoading}>
                    {t('leave.status.approve', 'Approve')}
                  </Button>
                </>
              )}
            </DialogActions>
          </Dialog>
        )}
        {/* Snackbar */}
        {snack.open && (
          <Box sx={{ position: 'fixed', bottom: 16, right: 16 }}>
            <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>{snack.msg}</Alert>
          </Box>
        )}
      </Card>
    </DialogContent>
  );
};

export default CalendarLogScreen;
