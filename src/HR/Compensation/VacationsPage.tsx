// src/HR/Compensation/VacationsPage.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
  Tabs,
  Tab,
  IconButton,
  Badge,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Alert,
  TableContainer,
  Paper,
  Stack,
} from "@mui/material";
import axios from "axios";
import { useTranslation } from "react-i18next";
import CalendarLogScreen from "../../components/LeaveManagement/CalendarLogScreen";
import LeaveStatusScreen from "../../components/LeaveManagement/LeaveStatusScreen";
import LeaveRequestScreen from "../../components/LeaveManagement/LeaveRequestScreen";
import LeaveBalanceScreen from "../../components/LeaveManagement/LeaveBalanceScreen";
import { getAuthHeader } from "../../utils/auth";
import { getCalendarLog, updateLeaveStatus } from "../../services/leaveService";
import RuleIcon from "@mui/icons-material/Rule"; // distinct icon for review
import CloseIcon from "@mui/icons-material/Close";
import { format } from "date-fns";
import LeaveCodesManagement from "../../components/LeaveManagement/LeaveCodesManagement";

interface EmployeeLite {
  id: string | number;
  name: string;
  title?: string;
  ps?: string;
  subarea?: string;
}

interface PendingLeaveRow {
  id: string | number;
  employeeId?: string | number;
  employeeName?: string;
  typeLabel: string; // "AL - Annual Leave"
  startDate: string; // ISO
  endDate: string; // ISO
  days?: number;
  status: "pending" | "approved" | "rejected" | "cancelled" | string;
  raw?: any;
}

const VacationsPage: React.FC = () => {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [selected, setSelected] = useState<string>("all");
  const employeeId = selected === "all" ? undefined : selected;

  const API_URL = process.env.REACT_APP_API_IP;
  const inferredBase = `${window.location.protocol}//${window.location.hostname}:9000`;
  const base = useMemo(
    () =>
      (API_URL && API_URL.trim() ? API_URL : inferredBase).replace(/\/+$/, ""),
    [API_URL, inferredBase]
  );

  // name lookup map (id -> name)
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) {
      m.set(String(e.id), e.name);
    }
    return m;
  }, [employees]);

  // tabs
  const [tab, setTab] = useState(0);
  const emp = employeeId
    ? employees.find((e) => String(e.id) === String(employeeId))
    : undefined;

  // Pending dialog
  const [pendingOpen, setPendingOpen] = useState(false);
  const [pendingRows, setPendingRows] = useState<PendingLeaveRow[]>([]);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [moderatingId, setModeratingId] = useState<string | number | null>(
    null
  );
  const [loadingPending, setLoadingPending] = useState(false);

  const handleChange = (e: SelectChangeEvent<string>) =>
    setSelected(e.target.value);

  // Load employees
  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const res = await axios.get(`${base}/employees`, {
          headers: await getAuthHeader(),
        });
        const arr = Array.isArray(res.data) ? res.data : res.data?.data || [];
        const mapped: EmployeeLite[] = arr
          .map((e: any) => ({
            id: e?.ID_EMP ?? e?.id ?? e?.id_emp,
            name:
              e?.NAME ??
              e?.NAME_ENGLISH ??
              e?.name ??
              e?.employeeName ??
              e?.employee_name ??
              "Employee",
            title: e?.TITLE ?? e?.FONCTION ?? e?.POSTE ?? undefined,
            ps: String(e?.PS ?? e?.PERSONNEL_SUBAREA ?? e?.SUBAREA ?? ""),
            subarea: String(e?.SUBAREA ?? e?.PERSONNEL_SUBAREA ?? ""),
          }))
          .filter((e: EmployeeLite) => e.id != null);
        setEmployees(mapped);
      } catch {
        setEmployees([]);
      }
    };
    loadEmployees();
  }, [base]);

  // Helper: get a wide range for pending fetch
  const rangeForPending = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setFullYear(now.getFullYear() - 1);
    const end = new Date(now);
    end.setFullYear(now.getFullYear() + 1);
    const toIso10 = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    return { startDate: toIso10(start), endDate: toIso10(end) };
  }, []);

  // Fetch pending from /leave/calendar-log with status=pending
  const fetchPending = useCallback(async () => {
    try {
      setLoadingPending(true);
      setPendingError(null);

      const params = {
        startDate: rangeForPending.startDate,
        endDate: rangeForPending.endDate,
        status: "pending",
        employeeId: employeeId ?? undefined,
      };

      const data = await getCalendarLog(params);
      const list: any[] = Array.isArray(data?.leaveRequests)
        ? data.leaveRequests
        : [];

      const rows: PendingLeaveRow[] = list
        .filter((v) => String(v.status || "").toLowerCase() === "pending")
        .map((v) => {
          // prefer server-provided name; fallback to client-side lookup; then "Emp {id}"
          const lookupName =
            v.employeeId != null
              ? nameById.get(String(v.employeeId))
              : undefined;
          const finalName =
            (v.employeeName && String(v.employeeName).trim()) ||
            lookupName ||
            (v.employeeId ? `Emp ${v.employeeId}` : "-");

          return {
            id: v.id,
            employeeId: v.employeeId,
            employeeName: finalName,
            typeLabel: v.leaveTypeCode
              ? v.leaveTypeName
                ? `${v.leaveTypeCode} - ${v.leaveTypeName}`
                : String(v.leaveTypeCode)
              : v.leaveTypeName || "-",
            startDate: v.startDate,
            endDate: v.endDate,
            days: v.days,
            status: String(v.status || "").toLowerCase(),
            raw: v,
          };
        });

      setPendingRows(rows);
    } catch (e: any) {
      setPendingError(
        e?.response?.data?.message ||
          e?.message ||
          t("leave.status.fetchError", "Error fetching leave requests")
      );
      setPendingRows([]);
    } finally {
      setLoadingPending(false);
    }
  }, [employeeId, rangeForPending, t, nameById]);

  // Badge count = number of pending rows (for selected employee if filtered)
  const pendingCount = pendingRows.length;

  const openPendingDialog = async () => {
    await fetchPending();
    setPendingOpen(true);
  };
  const closePendingDialog = () => setPendingOpen(false);

  // Actions
  const onModerate = async (
    row: PendingLeaveRow,
    status: "approved" | "rejected" | "cancelled"
  ) => {
    try {
      setModeratingId(row.id);
      await updateLeaveStatus(String(row.id), status);
      // local update
      setPendingRows((prev) =>
        prev.filter((p) => String(p.id) !== String(row.id))
      );
    } catch (e: any) {
      setPendingError(
        e?.response?.data?.message ||
          e?.message ||
          t("leave.status.actionFailed", "Action failed")
      );
    } finally {
      setModeratingId(null);
    }
  };

  return (
    <Box
      sx={{
        p: { xs: 1.5, md: 2.5 },
        flexDirection: "column",
        gap: 2.5,
      }}
    >
      {/* Header and employee selector */}
      <Card variant="outlined">
        <CardHeader
          title={
            <Stack spacing={0.5}>
              <Typography variant="h5" fontWeight={700}>
                {t("leave.vacations.title", "Vacations")}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t(
                  "leave.vacations.subtitle",
                  "Company calendar and leave tools"
                )}
              </Typography>
            </Stack>
          }
          action={
            <Tooltip
              title={
                employeeId
                  ? t("leave.pending.tooltipOne", "Pending for this employee")
                  : t("leave.pending.tooltipAll", "Pending for all employees")
              }
            >
              <span>
                <Badge
                  color="error"
                  overlap="circular"
                  badgeContent={pendingCount}
                  invisible={pendingCount === 0}
                  sx={{ "& .MuiBadge-badge": { fontWeight: 700 } }}
                >
                  <IconButton
                    size="small"
                    onClick={openPendingDialog}
                    aria-label={t(
                      "leave.pending.open",
                      "Open pending requests"
                    )}
                  >
                    <RuleIcon />
                  </IconButton>
                </Badge>
              </span>
            </Tooltip>
          }
          sx={{ pb: 0.5 }}
        />

        <CardContent sx={{ pt: 1.5 }}>
          <Box
            sx={{
              display: "flex",
              gap: 2,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <FormControl size="small" sx={{ minWidth: 280 }}>
              <InputLabel>
                {t("leave.vacations.employee", "Employee")}
              </InputLabel>
              <Select
                label={t("leave.vacations.employee", "Employee")}
                value={selected}
                onChange={handleChange}
                MenuProps={{ PaperProps: { elevation: 3 } }}
              >
                <MenuItem value="all">
                  {t("leave.vacations.allEmployees", "All employees")}
                </MenuItem>
                {employees.map((e) => (
                  <MenuItem key={String(e.id)} value={String(e.id)}>
                    {e.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {employeeId && (
              <Typography variant="body2" color="text.secondary">
                {t("leave.vacations.selected", "Showing data for")}:{" "}
                <strong>{emp?.name || `Emp ${employeeId}`}</strong>
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Calendar when no employee selected */}
      {!employeeId && (
        <Card variant="outlined">
          <CardHeader
            sx={{ pb: 0 }}
            title={t("leave.calendar.title", "Calendar")}
          />
          <CardContent sx={{ pt: 1.5 }}>
            <CalendarLogScreen employeeId={undefined} />
          </CardContent>
        </Card>
      )}

      {/* Tabs only when employee is selected */}
      {employeeId && (
        <Card variant="outlined">
          <CardHeader
            sx={{ pb: 0 }}
            title={t("leave.vacations.tools", "Leave Tools")}
          />
          <CardContent sx={{ pt: 1.5 }}>
            <Tabs
              value={tab}
              onChange={(_e, v) => setTab(v)}
              variant="scrollable"
              allowScrollButtonsMobile
              sx={{ mb: 2 }}
            >
              <Tab label={t("leave.calendar.title", "Calendar")} />
              <Tab label={t("leave.status.title", "Leave Status")} />
              <Tab label={t("leave.request.title", "Leave Request")} />
              <Tab label={t("leave.balance.title", "Leave Balance")} />
              <Tab label={t("leave.codes.title", "Leave Codes")} />
            </Tabs>

            {tab === 0 && (
              <Box>
                <CalendarLogScreen employeeId={employeeId} />
              </Box>
            )}
            {tab === 1 && (
              <Box>
                <LeaveStatusScreen employeeId={employeeId} />
              </Box>
            )}
            {tab === 2 && (
              <Box>
                <LeaveRequestScreen employeeId={employeeId} />
              </Box>
            )}
            {tab === 3 && (
              <Box>
                <LeaveBalanceScreen employeeId={employeeId} />
              </Box>
            )}
            {tab === 4 && (
              <Box>
                <LeaveCodesManagement />
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pending dialog */}
      <Dialog
        open={pendingOpen}
        onClose={closePendingDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ 
          pb: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          pr: 6
        }}>
          <Typography variant="h6" fontWeight={700}>
            {t("leave.pending.title", "Review Leave Requests")} for {emp?.name || `Emp ${employeeId}`}
          </Typography>
          <IconButton
            aria-label="close"
            onClick={closePendingDialog}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 1.5, pb: 0, px: 0 }}>
          {pendingError && (
            <Box mb={2} px={2}>
              <Alert severity="error">{pendingError}</Alert>
            </Box>
          )}
          <TableContainer component={Paper} elevation={0}>
            <Table size="medium">
              <TableHead>
                <TableRow>
                  {!employeeId && (
                    <TableCell sx={{ fontWeight: 600 }}>
                      {t("leave.status.employee", "Employee")}
                    </TableCell>
                  )}
                  <TableCell sx={{ fontWeight: 600 }}>
                    {t("leave.status.type", "Leave Type")}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {t("leave.status.period", "Period")}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {t("leave.status.days", "Days")}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {t("leave.status.actions", "Actions")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingRows.length ? (
                  pendingRows.map((row: PendingLeaveRow) => (
                    <TableRow key={String(row.id)} hover>
                      {!employeeId && (
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          {row.employeeName && row.employeeName.trim()
                            ? row.employeeName
                            : row.employeeId
                              ? `Emp ${row.employeeId}`
                              : "-"}
                        </TableCell>
                      )}
                      <TableCell>{row.typeLabel}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {row.startDate
                          ? format(new Date(row.startDate), "dd/MM/yyyy")
                          : "-"}{" "}
                        —{" "}
                        {row.endDate
                          ? format(new Date(row.endDate), "dd/MM/yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell align="right">
                        {typeof row.days === "number" ? row.days : "-"}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            label={t(`leave.status.${row.status}`, row.status)}
                            size="small"
                            variant="outlined"
                          />
                          <Box flex={1} />
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            disabled={moderatingId === row.id}
                            onClick={() => onModerate(row, "rejected")}
                          >
                            {t("common.reject", "Deny")}
                          </Button>
                          <Button
                            size="small"
                            color="inherit"
                            disabled={moderatingId === row.id}
                            onClick={() => onModerate(row, "cancelled")}
                          >
                            {t("common.cancel", "Cancel")}
                          </Button>
                          <Button
                            size="small"
                            color="success"
                            variant="contained"
                            disabled={moderatingId === row.id}
                            onClick={() => onModerate(row, "approved")}
                          >
                            {t("common.approve", "Approve")}
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={employeeId ? 4 : 5}
                      align="center"
                      sx={{ py: 3 }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {loadingPending
                          ? t("common.loading", "Loading…")
                          : t("leave.status.noPending", "No pending requests")}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button onClick={fetchPending} variant="outlined">
            {t("common.refresh", "Refresh")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VacationsPage;
