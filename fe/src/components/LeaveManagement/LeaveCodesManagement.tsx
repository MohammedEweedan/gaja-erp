/* eslint-disable */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
} from "@mui/material";
import { Add, Close, Delete, Edit, Search } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import api from "../../api";
import {
  listTSCodes,
  createTSCode,
  updateTSCode,
  deleteTSCode,
  TSCode,
} from "../../services/codesService";

/** -------------------------------------------------------
 * Types (aligned across both resources for shared logic)
 * ------------------------------------------------------*/
export type KV = { key: string; value: string };

type CodeRow = TSCode; // { int_can, desig_can, code, max_day, Rule_days }

export interface BaseCode {
  id?: string | number;
  code: string;
  label: string;
  description?: string;
  // presentation
  color?: string | null;
  // allowances
  foodAllowance?: boolean;
  commAllowance?: boolean;
  transAllowance?: boolean;
}

export interface LeaveCode extends BaseCode {
  maxDays?: number | null;
  paid?: boolean;
  requiresDoctorNote?: boolean;
}

export interface TimesheetCode extends BaseCode {
  billable?: boolean;
}

/** -------------------------------------------------------
 * Small helpers
 * ------------------------------------------------------*/
const emptyLeave: LeaveCode = {
  code: "",
  label: "",
  description: "",
  maxDays: null,
  paid: false,
  requiresDoctorNote: false,
  color: "",
  foodAllowance: false,
  commAllowance: false,
  transAllowance: false,
};

const emptyTimesheet: TimesheetCode = {
  code: "",
  label: "",
  description: "",
  billable: false,
  color: "",
  foodAllowance: false,
  commAllowance: false,
  transAllowance: false,
};

function safeParseJson(txt?: string | null) {
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function kvToObject(kv?: KV[]) {
  const out: Record<string, string> = {};
  (kv || []).forEach(({ key, value }) => {
    if (key) out[key] = value ?? "";
  });
  return out;
}

/** -------------------------------------------------------
 * Reusable form drawer (used for both tabs)
 * ------------------------------------------------------*/
type ResourceKind = "leave" | "timesheet";

// Map backend TS_Codes -> UI LeaveCode/TimesheetCode
function tsToUi(row: TSCode): LeaveCode | TimesheetCode {
  const base = {
    id: row.int_can,
    code: row.code,
    label: row.desig_can,
    description: (row as any).description ?? "",
    color: (row as any).color ?? "",
    foodAllowance: !!(row as any).food_allowance,
    commAllowance: !!(row as any).comm_allowance,
    transAllowance: !!(row as any).trans_allowance,
  };
  // Try to populate color from Rule_days if it's a JSON string
  try {
    const meta = safeParseJson(row.Rule_days);
    if (meta && typeof meta === 'object') {
      if ((meta as any).color && !base.color) (base as any).color = String((meta as any).color || "");
      if ((meta as any).description && !base.description) (base as any).description = String((meta as any).description || "");
      if ((meta as any).foodAllowance != null) (base as any).foodAllowance = !!(meta as any).foodAllowance;
      if ((meta as any).commAllowance != null) (base as any).commAllowance = !!(meta as any).commAllowance;
      if ((meta as any).transAllowance != null) (base as any).transAllowance = !!(meta as any).transAllowance;
    }
  } catch {}

  if ((row.max_day ?? 0) > 0) {
    // Leave code
    const lc: LeaveCode = {
      ...base,
      maxDays: row.max_day,
      paid: false,               // flags not in DB; keep in rulesJson if needed
      requiresDoctorNote: false,
    };
    return lc;
  } else {
    // Timesheet/utility code
    const tc: TimesheetCode = {
      ...base,
      billable: false,           // same note as above
    };
    return tc;
  }
}

// Map UI -> backend TS_Codes payload
function uiToTsPayload(ui: LeaveCode | TimesheetCode): Partial<TSCode> {
  const isLeave = Number((ui as any).maxDays ?? 0) > 0;
  return {
    desig_can: ui.label,
    code: ui.code?.toUpperCase(),
    max_day: isLeave ? Number((ui as any).maxDays ?? 0) : 0,
    // Write explicit columns directly to match DB schema
    description: ui.description ?? null,
    color: ui.color ?? null,
    food_allowance: (ui as any).foodAllowance ?? false,
    comm_allowance: (ui as any).commAllowance ?? false,
    trans_allowance: (ui as any).transAllowance ?? false,
    // Keep Rule_days empty to avoid truncation in legacy installs
    Rule_days: "",
  };
}

type DrawerProps =
  | {
      kind: "leave";
      open: boolean;
      onClose: () => void;
      onSubmit: (data: LeaveCode) => Promise<void>;
      initial?: LeaveCode | null;
      submitting?: boolean;
    }
  | {
      kind: "timesheet";
      open: boolean;
      onClose: () => void;
      onSubmit: (data: TimesheetCode) => Promise<void>;
      initial?: TimesheetCode | null;
      submitting?: boolean;
    };

const CodeFormDrawer: React.FC<DrawerProps> = ({
  kind,
  open,
  onClose,
  onSubmit,
  initial,
  submitting,
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState<LeaveCode | TimesheetCode>(
    (kind === "leave" ? emptyLeave : emptyTimesheet) as any
  );
  // no rules JSON field anymore

  useEffect(() => {
    if (!open) return;
    if (initial) setData(initial);
    else setData((kind === "leave" ? emptyLeave : emptyTimesheet) as any);
  }, [open, initial, kind]);

  const [allCodes, setAllCodes] = useState<CodeRow[]>([]);
  const [tab, setTab] = useState<"leave" | "timesheet">("leave");

  const load = useCallback(async () => {
    const rows = await listTSCodes();
    setAllCodes(rows);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // Heuristic: leave codes have a positive max_day. Utility/timesheet codes sit at max_day === 0.
  const activeRows = useMemo(() => {
    const list =
      tab === "leave"
        ? allCodes.filter((r) => (r.max_day ?? 0) > 0)
        : allCodes.filter((r) => (r.max_day ?? 0) === 0);
    // apply your search filter here if you have one
    return list;
  }, [allCodes, tab]);

  const trySubmit = async () => {
    await onSubmit(data as any);
  };

  const isLeave = Number((data as any)?.maxDays ?? 0) > 0;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        px={2}
        py={1.5}
      >
        <Typography variant="h6" fontWeight={700}>
          {initial?.id
            ? t("codes.edit", "Edit Code")
            : t("codes.new", "New Code")}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </Box>
      <Divider />
      <Box
        component="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          trySubmit();
        }}
      >
        <Stack spacing={2} sx={{ p: 2 }}>
          <TextField
            required
            label={t("codes.code", "Code")}
            value={data.code}
            onChange={(e) =>
              setData({ ...data, code: e.target.value.toUpperCase() })
            }
            inputProps={{ maxLength: 12 }}
          />
          <TextField
            required
            label={t("codes.label", "Label")}
            value={data.label}
            onChange={(e) => setData({ ...data, label: e.target.value })}
          />

          {/* Type selector to allow reassignment between Leave and Timesheet */}
          <FormControl fullWidth>
            <InputLabel>{t("codes.type", "Type")}</InputLabel>
            <Select
              label={t("codes.type", "Type")}
              value={isLeave ? "leave" : "timesheet"}
              onChange={(e) => {
                const v = String(e.target.value);
                if (v === "leave") {
                  const current = Number((data as any).maxDays ?? 0);
                  setData({
                    ...data,
                    maxDays: current > 0 ? current : 1,
                  } as any);
                } else {
                  setData({
                    ...data,
                    maxDays: 0,
                  } as any);
                }
              }}
            >
              <MenuItem value="leave">{t("codes.leave", "Leave")}</MenuItem>
              <MenuItem value="timesheet">{t("codes.timesheet", "Timesheet")}</MenuItem>
            </Select>
          </FormControl>

          {/* Description */}
          <TextField
            label={t("codes.description", "Description")}
            value={data.description || ""}
            onChange={(e) => setData({ ...data, description: e.target.value })}
            multiline
            minRows={2}
          />

          {isLeave ? (
            <>
              <TextField
                type="number"
                label={t("codes.maxDays", "Max days")}
                value={(data as LeaveCode).maxDays ?? ""}
                onChange={(e) =>
                  setData({
                    ...data,
                    maxDays:
                      e.target.value === "" ? null : Number(e.target.value),
                  } as any)
                }
                inputProps={{ min: 0 }}
              />
              <Stack direction="row" spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!(data as LeaveCode).paid}
                      onChange={(e) =>
                        setData(
                          { ...data, paid: e.target.checked } as any
                        )
                      }
                    />
                  }
                  label={t("codes.paid", "Paid")}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!(data as LeaveCode).requiresDoctorNote}
                      onChange={(e) =>
                        setData(
                          { ...data, requiresDoctorNote: e.target.checked } as any
                        )
                      }
                    />
                  }
                  label={t("codes.requiresDoctorNote", "Requires doctor note")}
                />
              </Stack>
            </>
          ) : (
            <FormControlLabel
              control={
                <Switch
                  checked={!!(data as TimesheetCode).billable}
                  onChange={(e) =>
                    setData({ ...data, billable: e.target.checked } as any)
                  }
                />
              }
              label={t("codes.paid", "Paid")}
            />
          )}

          {/* Allowances: Yes/No radios per item */}
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <Box sx={{ flex: "1 1 200px", minWidth: 200 }}>
              <FormControl component="fieldset" fullWidth>
                <Typography variant="caption" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {t("codes.foodAllowance", "Food allowance")}
                </Typography>
                <RadioGroup
                  row
                  value={data.foodAllowance ? "yes" : "no"}
                  onChange={(e) =>
                    setData({ ...data, foodAllowance: e.target.value === "yes" })
                  }
                >
                  <FormControlLabel
                    value="yes"
                    control={<Radio size="small" />}
                    label={t("common.yes", "Yes")}
                  />
                  <FormControlLabel
                    value="no"
                    control={<Radio size="small" />}
                    label={t("common.no", "No")}
                  />
                </RadioGroup>
              </FormControl>
            </Box>

            <Box sx={{ flex: "1 1 200px", minWidth: 200 }}>
              <FormControl component="fieldset" fullWidth>
                <Typography variant="caption" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {t("codes.commAllowance", "Communication allowance")}
                </Typography>
                <RadioGroup
                  row
                  value={data.commAllowance ? "yes" : "no"}
                  onChange={(e) =>
                    setData({ ...data, commAllowance: e.target.value === "yes" })
                  }
                >
                  <FormControlLabel
                    value="yes"
                    control={<Radio size="small" />}
                    label={t("common.yes", "Yes")}
                  />
                  <FormControlLabel
                    value="no"
                    control={<Radio size="small" />}
                    label={t("common.no", "No")}
                  />
                </RadioGroup>
              </FormControl>
            </Box>

            <Box sx={{ flex: "1 1 200px", minWidth: 200 }}>
              <FormControl component="fieldset" fullWidth>
                <Typography variant="caption" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {t("codes.transAllowance", "Transportation (fuel)")}
                </Typography>
                <RadioGroup
                  row
                  value={data.transAllowance ? "yes" : "no"}
                  onChange={(e) =>
                    setData({ ...data, transAllowance: e.target.value === "yes" })
                  }
                >
                  <FormControlLabel
                    value="yes"
                    control={<Radio size="small" />}
                    label={t("common.yes", "Yes")}
                  />
                  <FormControlLabel
                    value="no"
                    control={<Radio size="small" />}
                    label={t("common.no", "No")}
                  />
                </RadioGroup>
              </FormControl>
            </Box>
          </Box>

          <TextField
            label={t("codes.color", "Color (hex or name)")}
            placeholder="#1976d2"
            value={data.color || ""}
            onChange={(e) => setData({ ...data, color: e.target.value })}
          />
          <Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <input
                aria-label="color-picker"
                type="color"
                value={(data.color && /^#/.test(data.color)) ? (data.color as string) : (data.color ? `#${String(data.color).replace(/^#/, '')}` : "#1976d2")}
                onChange={(e) => {
                  const hex = e.target.value;
                  setData({ ...data, color: hex });
                }}
                style={{ width: 44, height: 32, border: 'none', background: 'transparent', padding: 0 }}
              />
              <Typography variant="caption" color="text.secondary">
                {t("codes.color", "Color")}
              </Typography>
            </Stack>
          </Box>

          <Stack
            direction="row"
            spacing={1}
            justifyContent="flex-end"
            sx={{ pt: 1 }}
          >
            <Button
              type="submit"
              variant="contained"
              disabled={!!submitting}
            >
              {submitting ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                t("common.save", "Save")
              )}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Dialog>
  );
};

/** -------------------------------------------------------
 * Row actions: edit/delete with confirm
 * ------------------------------------------------------*/
const ConfirmDeleteDialog: React.FC<{
  open: boolean;
  name: string;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}> = ({ open, name, onClose, onConfirm, loading }) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("codes.deleteTitle", "Delete code?")}</DialogTitle>
      <DialogContent>
        <Typography>
          {t("codes.deleteBody", "Are you sure you want to delete")}{" "}
          <b>{name}</b>?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          color="error"
          variant="contained"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            t("common.delete", "Delete")
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/** -------------------------------------------------------
 * Main component
 * ------------------------------------------------------*/
const LeaveCodesManagement: React.FC = () => {
  const { t } = useTranslation();

  // layout stability (won’t jump on sidebar toggle)
  const containerSx = {
    maxWidth: 1400,
    mx: "auto",
    px: { xs: 1, sm: 2, md: 3 }, // just gets wider without reflow jumps
    py: 2,
  } as const;

  const [tab, setTab] = useState<ResourceKind>("leave");

  // lists
  const [leaveCodes, setLeaveCodes] = useState<LeaveCode[]>([]);
  const [timesheetCodes, setTimesheetCodes] = useState<TimesheetCode[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // search
  const [q, setQ] = useState("");

  // drawer/dialog
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveCode | TimesheetCode | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);

  const [confirm, setConfirm] = useState<{
    open: boolean;
    id?: string | number;
    name?: string;
  }>({
    open: false,
  });
  const [deleting, setDeleting] = useState(false);

  // toast
  const [toast, setToast] = useState<{
    open: boolean;
    severity: "success" | "error";
    msg: string;
  }>({
    open: false,
    severity: "success",
    msg: "",
  });

  const activeList = tab === "leave" ? leaveCodes : timesheetCodes;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return activeList;
    return activeList.filter((c) => {
      const blob = `${c.code}|${c.label}|${c.description || ""}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [activeList, q]);

  const loadAll = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const raw = await listTSCodes(); // GET /leave/leave-types (fallbacks to /hr/codes inside codesService)
      const mapped = raw.map(tsToUi);
      setLeaveCodes(
        mapped.filter(
          (c): c is LeaveCode =>
            (c as LeaveCode).maxDays != null && (c as LeaveCode).maxDays! > 0
        )
      );
      setTimesheetCodes(
        mapped.filter(
          (c): c is TimesheetCode =>
            (c as any).maxDays == null || (c as any).maxDays === 0
        )
      );
    } catch (e: any) {
      setError(e?.message || "Failed to load codes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // CRUD handlers
  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };
  const openEdit = (row: LeaveCode | TimesheetCode) => {
    setEditing(row);
    setDrawerOpen(true);
  };

  const submitForm = async (payload: LeaveCode | TimesheetCode) => {
    setSubmitting(true);
    try {
      const tsPayload = uiToTsPayload(payload);
      if (editing?.id) {
        await updateTSCode(Number(editing.id), tsPayload);
      } else {
        await createTSCode(tsPayload);
      }
      await loadAll();
      setToast({ open: true, severity: "success", msg: t("codes.saved", "Code saved") });
      setDrawerOpen(false);
      setEditing(null);
    } catch (e: any) {
      setToast({
        open: true,
        severity: "error",
        msg: e?.response?.data?.message || e?.message || "Error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const askDelete = (row: LeaveCode | TimesheetCode) => {
    setConfirm({ open: true, id: row.id, name: `${row.code} — ${row.label}` });
  };

  const doDelete = async () => {
    if (!confirm.id) return;
    setDeleting(true);
    try {
      await deleteTSCode(Number(confirm.id));
      if (tab === "leave") {
        setLeaveCodes((prev) => prev.filter((x) => x.id !== confirm.id));
      } else {
        setTimesheetCodes((prev) => prev.filter((x) => x.id !== confirm.id));
      }
      setToast({
        open: true,
        severity: "success",
        msg: t("codes.deleted", "Code deleted"),
      });
      setConfirm({ open: false });
    } catch (e: any) {
      setToast({
        open: true,
        severity: "error",
        msg: e?.response?.data?.message || e?.message || "Error",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={containerSx}>
      <Stack spacing={0.5} sx={{ mb: 2 }} alignItems="center">
        <Typography variant="h5" fontWeight={700}>
          {t("codes.title", "Codes Management")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(
            "codes.subtitle",
            "Create, edit, and organize your leave and timesheet codes."
          )}
        </Typography>
      </Stack>

      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          bgcolor: (theme) =>
            theme.palette.mode === "dark"
              ? "background.default"
              : "background.paper",
        }}
      >
        <Box sx={{ px: 2, pt: 2 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
          >
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="codes-tabs"
              sx={{ ".MuiTabs-indicator": { borderRadius: 1 } }}
            >
              <Tab value="leave" label={t("codes.leaveTab", "Leave Codes")} />
              <Tab
                value="timesheet"
                label={t("codes.timesheetTab", "Timesheet Codes")}
              />
            </Tabs>

            <Stack direction="row" spacing={1.5} alignItems="center">
              <OutlinedInput
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("codes.search", "Search codes")}
                size="small"
                startAdornment={
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                }
                sx={{ minWidth: { xs: "100%", sm: 260 } }}
              />
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={openCreate}
              >
                {t("codes.newCode", "New Code")}
              </Button>
            </Stack>
          </Stack>
        </Box>

        <Divider sx={{ mt: 2 }} />

        <Box sx={{ p: 2 }}>
          {loading ? (
            <Stack alignItems="center" py={5}>
              <CircularProgress />
            </Stack>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={140}>{t("codes.code", "Code")}</TableCell>
                    <TableCell>{t("codes.label", "Label")}</TableCell>
                    {tab === "leave" ? (
                      <>
                        <TableCell width={120} align="right">
                          {t("codes.maxDays", "Max days")}
                        </TableCell>
                        <TableCell width={120}>
                          {t("codes.paid", "Paid")}
                        </TableCell>
                        <TableCell width={170}>
                          {t("codes.requiresDoctorNote", "Requires note")}
                        </TableCell>
                      </>
                    ) : (
                      <TableCell width={120}>
                        {t("codes.paid", "Paid")}
                      </TableCell>
                    )}
                    <TableCell width={120}>
                      {t("codes.color", "Color")}
                    </TableCell>
                    <TableCell>
                      {t("codes.description", "Description")}
                    </TableCell>
                    <TableCell width={120} align="right">
                      {t("actions", "Actions")}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={tab === "leave" ? 8 : 6}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          align="center"
                          py={3}
                        >
                          {t(
                            "codes.empty",
                            "No codes yet. Create your first one."
                          )}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}

                  {filtered.map((row) => (
                    <TableRow key={String(row.id ?? row.code)}>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip label={row.code} size="small" />
                        </Stack>
                      </TableCell>
                      <TableCell>{row.label}</TableCell>

                      {tab === "leave" ? (
                        <>
                          <TableCell align="right">
                            {(row as LeaveCode).maxDays ?? "—"}
                          </TableCell>
                          <TableCell>
                            {(row as LeaveCode).paid ? (
                              <Chip
                                size="small"
                                color="success"
                                label={t("common.yes", "Yes")}
                              />
                            ) : (
                              <Chip size="small" label={t("common.no", "No")} />
                            )}
                          </TableCell>
                          <TableCell>
                            {(row as LeaveCode).requiresDoctorNote ? (
                              <Chip
                                size="small"
                                color="warning"
                                label={t("common.yes", "Yes")}
                              />
                            ) : (
                              <Chip size="small" label={t("common.no", "No")} />
                            )}
                          </TableCell>
                        </>
                      ) : (
                        <TableCell>
                          {(row as TimesheetCode).billable ? (
                            <Chip
                              size="small"
                              color="success"
                              label={t("common.yes", "Yes")}
                            />
                          ) : (
                            <Chip size="small" label={t("common.no", "No")} />
                          )}
                        </TableCell>
                      )}

                      <TableCell>
                        {row.color ? (
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                          >
                            <Box
                              sx={{
                                width: 16,
                                height: 16,
                                borderRadius: "50%",
                                bgcolor: row.color,
                                border: "1px solid",
                                borderColor: "divider",
                              }}
                            />
                            <Typography variant="caption">
                              {row.color}
                            </Typography>
                          </Stack>
                        ) : (
                          "—"
                        )}
                      </TableCell>

                      <TableCell sx={{ maxWidth: 260 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {row.description || "—"}
                        </Typography>
                      </TableCell>

                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="flex-end"
                        >
                          <Tooltip title={t("common.edit", "Edit") as string}>
                            <IconButton
                              onClick={() => openEdit(row)}
                              size="small"
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip
                            title={t("common.delete", "Delete") as string}
                          >
                            <IconButton
                              onClick={() => askDelete(row)}
                              size="small"
                              color="error"
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Paper>

      {/* Drawer for create/edit */}
      <CodeFormDrawer
        kind={tab}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditing(null);
        }}
        onSubmit={submitForm}
        initial={editing as any}
        submitting={submitting}
      />

      {/* Delete confirm */}
      <ConfirmDeleteDialog
        open={confirm.open}
        name={confirm.name || ""}
        onClose={() => setConfirm({ open: false })}
        onConfirm={doDelete}
        loading={deleting}
      />

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3500}
        onClose={() => setToast((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setToast((s) => ({ ...s, open: false }))}
          severity={toast.severity}
          variant="filled"
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default LeaveCodesManagement;
