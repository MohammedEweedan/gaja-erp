import React from "react";
import {
  Avatar,
  Box,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Stack,
  Typography,
  Tooltip,
  Divider,
  Button,
  Snackbar,
  Alert,
  Collapse,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";
import AccessTimeOutlined from "@mui/icons-material/AccessTimeOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";
import Numbers from "@mui/icons-material/Numbers";
import CheckRounded from "@mui/icons-material/CheckRounded";
import PhoneIphone from "@mui/icons-material/PhoneIphone";
import AlternateEmail from "@mui/icons-material/AlternateEmail";
import Paid from "@mui/icons-material/Paid";
import PersonOutline from "@mui/icons-material/PersonOutline";
import WorkOutline from "@mui/icons-material/WorkOutline";
import { MinimalEmployee } from "./EmployeeCard"; // adjust import path

// ---- extend payroll fields (doesn't break existing data) ----
type MinimalEmployeeWithPayroll = MinimalEmployee & {
  FOOD_ALLOWANCE?: number | string | null;
  COMMUNICATION_ALLOWANCE?: number | string | null;
  TRANSPORTATION_ALLOWANCE?: number | string | null;
};

type EmployeeListProps<T extends MinimalEmployeeWithPayroll> = {
  rows: T[];
  apiBase?: string;
  dense?: boolean;
  onOpenProfile?: (emp: T) => void;
  onEdit?: (emp: T) => void;
  onDelete?: (emp: T) => void;
  onUpdateTimes?: (
    id: number,
    times: { T_START: string | null; T_END: string | null }
  ) => Promise<void>;
};

const fmtMoney = (n?: number | string | null) => {
  if (n == null || n === "") return null;
  const v = typeof n === "string" ? Number(n) : n;
  if (Number.isNaN(v as number)) return String(n);
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
    v as number
  );
};

const safeDate = (s?: string | null): Date | null => {
  if (!s) return null;
  const raw = s.slice(0, 19);
  const dmy = raw.match(/^(\d{2})-(\d{2})-(\d{4})/);
  const iso = dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : raw;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

const calcAge = (dob?: string | null) => {
  const d = safeDate(dob);
  if (!d) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
};

const psOf = (e: MinimalEmployee) => {
  if (e.PS == null || e.PS === "") return "—";
  const raw = String(e.PS).trim().toUpperCase();
  return raw.startsWith("P") ? raw : `P${raw}`;
};

const initials = (name?: string | null) =>
  name
    ? name
        .split(" ")
        .filter(Boolean)
        .map((s) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

const normalizeTimeHHMM = (val?: string | null) =>
  val ? val.toString().match(/^(\d{2}):(\d{2})/)?.[0] ?? "" : "";

export function EmployeeList<T extends MinimalEmployeeWithPayroll>({
  rows,
  apiBase,
  dense = false,
  onOpenProfile,
  onEdit,
  onDelete,
  onUpdateTimes,
}: EmployeeListProps<T>) {
  // grouping & filtering
  const [groupMode, setGroupMode] = React.useState<"none" | "ps">("none");
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | "active" | "inactive"
  >("all");

  // time editing
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editStart, setEditStart] = React.useState<string>("");
  const [editEnd, setEditEnd] = React.useState<string>("");

  // expand row details (show everything like card but list-style)
  const [expandedId, setExpandedId] = React.useState<number | null>(null);

  const [toast, setToast] = React.useState<{
    open: boolean;
    msg: string;
    sev: "success" | "error" | "info";
  }>({ open: false, msg: "", sev: "info" });

  const beginEdit = (emp: T) => {
    setEditingId(emp.ID_EMP ?? null);
    setEditStart(normalizeTimeHHMM(emp.T_START) || "");
    setEditEnd(normalizeTimeHHMM(emp.T_END) || "");
  };

  const saveEdit = async (emp: T) => {
    if (!onUpdateTimes || !emp.ID_EMP) return;
    try {
      await onUpdateTimes(emp.ID_EMP, {
        T_START: editStart ? `${editStart}:00` : null,
        T_END: editEnd ? `${editEnd}:00` : null,
      });
      setToast({ open: true, msg: "Saved", sev: "success" });
      setEditingId(null);
    } catch (err: any) {
      setToast({
        open: true,
        msg: err?.message || "Failed to save",
        sev: "error",
      });
    }
  };

  // filter rows by status
  const filteredRows = React.useMemo(() => {
    return rows.filter((e) => {
      const isActive = !!e.STATE;
      if (statusFilter === "active") return isActive;
      if (statusFilter === "inactive") return !isActive;
      return true;
    });
  }, [rows, statusFilter]);

  // group by PS
  const grouped = React.useMemo(() => {
    if (groupMode !== "ps") return null;
    const map = new Map<string, T[]>();
    for (const e of filteredRows) {
      const key = psOf(e);
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    }
    // stable-ish ordering: P1, P2... then others
    const keys = Array.from(map.keys()).sort((a, b) => {
      const na = Number(a.replace(/^P/i, ""));
      const nb = Number(b.replace(/^P/i, ""));
      const aNum = Number.isFinite(na) ? na : 999999;
      const bNum = Number.isFinite(nb) ? nb : 999999;
      if (aNum !== bNum) return aNum - bNum;
      return a.localeCompare(b);
    });
    return keys.map((k) => ({ key: k, rows: map.get(k)! }));
  }, [filteredRows, groupMode]);

  const renderOne = (e: T, idx: number, showDivider: boolean) => {
    const isActive = !!e.STATE;
    const editing = editingId === (e.ID_EMP ?? -1);
    const age = calcAge(e.DATE_OF_BIRTH);

    const salary = fmtMoney(e.BASIC_SALARY);
    const food = fmtMoney(e.FOOD_ALLOWANCE);
    const comm = fmtMoney(e.COMMUNICATION_ALLOWANCE);
    const trans = fmtMoney(e.TRANSPORTATION_ALLOWANCE);

    const hasPayroll = !!(salary || food || comm || trans);

    const isExpanded = expandedId === (e.ID_EMP ?? -1);

    return (
      <React.Fragment key={e.ID_EMP ?? e.NAME}>
        <ListItem
          alignItems="flex-start"
          sx={{
            px: 1,
            py: dense ? 0.75 : 1,
            borderRadius: 1.5,
            position: "relative",

            // same inactive treatment: darker/muted + X overlay
            ...(isActive
              ? {}
              : {
                  opacity: 0.78,
                  filter: "saturate(0.6)",
                  bgcolor: "action.hover",
                }),

            "&:hover": { bgcolor: "action.hover" },
          }}
          onClick={() => onOpenProfile?.(e)}
        >
          {/* X overlay */}
          {!isActive && (
            <Box
              aria-hidden
              sx={{
                pointerEvents: "none",
                position: "absolute",
                inset: 0,
                zIndex: 1,
                opacity: 0.18,
                backgroundImage: `
                  linear-gradient(45deg, transparent 48%, currentColor 49%, currentColor 51%, transparent 52%),
                  linear-gradient(-45deg, transparent 48%, currentColor 49%, currentColor 51%, transparent 52%)
                `,
                color: "text.primary",
                borderRadius: 1.5,
              }}
            />
          )}

          <ListItemAvatar sx={{ zIndex: 2 }}>
            <Avatar
              src={
                e.PICTURE_URL && e.PICTURE_URL.startsWith("http")
                  ? e.PICTURE_URL
                  : undefined
              }
            >
              {initials(e.NAME)}
            </Avatar>
          </ListItemAvatar>

          <ListItemText
            sx={{ zIndex: 2 }}
            primary={
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
                sx={{ pr: 8 }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Typography
                      variant="subtitle1"
                      fontWeight={900}
                      sx={{
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        maxWidth: 360,
                      }}
                    >
                      {e.NAME}
                    </Typography>

                    {/* ACTIVE / INACTIVE pill (replaces any circle) */}
                    <Chip
                      size="small"
                      label={isActive ? "ACTIVE" : "INACTIVE"}
                      sx={{
                        height: 20,
                        borderRadius: 999,
                        fontWeight: 900,
                        letterSpacing: 0.3,
                        ...(isActive
                          ? {
                              bgcolor: "#39ff14",
                              color: "black",
                              boxShadow: "0 0 14px rgba(57,255,20,.45)",
                            }
                          : {
                              bgcolor: "action.disabledBackground",
                              color: "text.secondary",
                            }),
                      }}
                      onClick={(ev) => ev.stopPropagation()}
                    />
                  </Stack>

                  <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 0.2 }}>
                    <WorkOutline sx={{ fontSize: 16, color: "text.secondary" }} />
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        maxWidth: 360,
                      }}
                    >
                      {e.TITLE || "—"}
                    </Typography>
                    {age != null && (
                      <>
                        <Typography variant="body2" color="text.secondary">
                          •
                        </Typography>
                        <Stack direction="row" gap={0.5} alignItems="center">
                          <PersonOutline sx={{ fontSize: 16, color: "text.secondary" }} />
                          <Typography variant="body2" color="text.secondary" fontWeight={800}>
                            {age}
                          </Typography>
                        </Stack>
                      </>
                    )}
                  </Stack>

                  {/* badges like the card */}
                  <Stack
                    direction="row"
                    gap={1}
                    alignItems="center"
                    sx={{ mt: 0.75, flexWrap: "wrap" }}
                  >
                    {e.ID_EMP != null && (
                      <Badge icon={<Numbers fontSize="inherit" />} text={`#${e.ID_EMP}`} />
                    )}
                    {groupMode !== "ps" && (
                      <Badge
                        icon={<StorefrontOutlined fontSize="inherit" />}
                        text={psOf(e)}
                      />
                    )}
                    {e.PHONE && (
                      <Badge
                        icon={<PhoneIphone fontSize="inherit" />}
                        text={e.PHONE}
                      />
                    )}
                    {e.EMAIL && (
                      <Badge
                        icon={<AlternateEmail fontSize="inherit" />}
                        text={e.EMAIL}
                      />
                    )}
                    {salary && (
                      <Badge icon={<Paid fontSize="inherit" />} text={`Salary: ${salary}`} />
                    )}
                  </Stack>

                  {/* Expand/Collapse to show "everything the cards show" list-style */}
                  <Box sx={{ mt: 0.75 }}>
                    <Button
                      size="small"
                      variant="text"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        const id = e.ID_EMP ?? -1;
                        setExpandedId((cur) => (cur === id ? null : id));
                      }}
                      sx={{ textTransform: "none", fontWeight: 900, borderRadius: 999, px: 1 }}
                    >
                      {isExpanded ? "Hide details" : "Show details"}
                    </Button>
                  </Box>
                </Box>

                {/* right side: time / edit (neutral) */}
                {!editing ? (
                  <Stack
                    direction="row"
                    alignItems="center"
                    gap={2}
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    <Timed label="Start" value={e.T_START} />
                    <Timed label="End" value={e.T_END} />
                    <Tooltip title="Edit time">
                      <IconButton
                        size="small"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          beginEdit(e);
                        }}
                      >
                        <AccessTimeOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                ) : (
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    gap={1}
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    <TimeInput label="Start" value={editStart} onChange={setEditStart} />
                    <TimeInput label="End" value={editEnd} onChange={setEditEnd} />
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<CheckRounded />}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        saveEdit(e);
                      }}
                      sx={{ textTransform: "none", borderRadius: 999 }}
                    >
                      Save
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setEditingId(null);
                      }}
                      sx={{ textTransform: "none", borderRadius: 999 }}
                    >
                      Cancel
                    </Button>
                  </Stack>
                )}
              </Stack>
            }
            secondary={
              <Collapse in={isExpanded} timeout={180} unmountOnExit>
                <Box
                  sx={{
                    mt: 1,
                    ml: 0.5,
                    p: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    bgcolor: "background.default",
                  }}
                  onClick={(ev) => ev.stopPropagation()}
                >
                  {/* This is the "cards" info, but list format */}
                  <Stack spacing={0.75}>
                    <DetailRow label="Employee ID" value={e.ID_EMP != null ? `#${e.ID_EMP}` : "—"} />
                    <DetailRow label="PS" value={psOf(e)} />
                    <DetailRow label="Title" value={e.TITLE || "—"} />
                    <DetailRow label="Shift Start" value={normalizeTimeHHMM(e.T_START) || "—"} />
                    <DetailRow label="Shift End" value={normalizeTimeHHMM(e.T_END) || "—"} />
                    <DetailRow label="Phone" value={e.PHONE || "—"} />
                    <DetailRow label="Email" value={e.EMAIL || "—"} />

                    {/* Payroll details */}
                    {hasPayroll && (
                      <>
                        <Divider />
                        <Typography variant="caption" color="text.secondary" fontWeight={900}>
                          PAYROLL
                        </Typography>
                        <DetailRow label="Basic Salary" value={salary || "—"} />
                        <DetailRow label="Food Allowance" value={food || "—"} />
                        <DetailRow label="Communication Allowance" value={comm || "—"} />
                        <DetailRow label="Transportation Allowance" value={trans || "—"} />
                      </>
                    )}
                  </Stack>
                </Box>
              </Collapse>
            }
          />

          <ListItemSecondaryAction sx={{ zIndex: 2 }}>
            <Tooltip title="Edit">
              <IconButton
                edge="end"
                size="small"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onEdit?.(e);
                }}
              >
                <EditOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                edge="end"
                size="small"
                color="error"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onDelete?.(e);
                }}
              >
                <DeleteOutline fontSize="small" />
              </IconButton>
            </Tooltip>
          </ListItemSecondaryAction>
        </ListItem>

        {showDivider && <Divider component="li" />}
      </React.Fragment>
    );
  };

  return (
    <>
      {/* Controls: Group by PS + Status filter */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        gap={1}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Group</InputLabel>
            <Select
              label="Group"
              value={groupMode}
              onChange={(e) => setGroupMode(e.target.value as any)}
            >
              <MenuItem value="none">No grouping</MenuItem>
              <MenuItem value="ps">Group by PS</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="active">Active only</MenuItem>
              <MenuItem value="inactive">Inactive only</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <Typography variant="body2" color="text.secondary" fontWeight={800}>
          Showing {filteredRows.length} / {rows.length}
        </Typography>
      </Stack>

      <List sx={{ width: "100%", bgcolor: "transparent" }}>
        {groupMode !== "ps" && (
          <>
            {filteredRows.map((e, idx) =>
              renderOne(e, idx, idx < filteredRows.length - 1)
            )}
          </>
        )}

        {groupMode === "ps" &&
          (grouped || []).map((g, gi) => (
            <Box key={g.key} sx={{ mb: 3 }}>
            {/* Divider above each PS group */}
            <Divider sx={{ mb: 1.5 }} />

            {/* Centered PS title */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                mb: 1.5,
              }}
            >
              <Typography
                sx={{
                  fontWeight: 900,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: "#65a8bf",
                }}
              >
                {g.key}
              </Typography>
            </Box>

            <List sx={{ p: 0 }}>
              {g.rows.map((e, idx) =>
                renderOne(e, idx, idx < g.rows.length - 1)
              )}
            </List>
          </Box>
          ))}
      </List>

      <Snackbar
        open={toast.open}
        onClose={() => setToast((s) => ({ ...s, open: false }))}
        autoHideDuration={1800}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={toast.sev}
          onClose={() => setToast((s) => ({ ...s, open: false }))}
          variant="filled"
          sx={{ fontWeight: 700 }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </>
  );
}

const Badge = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <Stack
    direction="row"
    gap={0.5}
    alignItems="center"
    sx={{
      px: 0.75,
      py: 0.2,
      bgcolor: "action.hover",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 800,
      color: "text.secondary",
    }}
  >
    <Box sx={{ display: "grid", placeItems: "center", fontSize: 14 }}>{icon}</Box>
    <span>{text}</span>
  </Stack>
);

const TimeInput = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <Stack direction="row" gap={0.75} alignItems="center">
    <Typography variant="caption" color="text.secondary" fontWeight={800}>
      {label}
    </Typography>
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        border: "1px solid var(--mui-palette-divider)",
        borderRadius: 8,
        padding: "4px 8px",
        fontSize: 12,
        height: 28,
      }}
    />
  </Stack>
);

const Timed = ({ label, value }: { label: string; value?: string | null }) => (
  <Stack direction="row" gap={0.5} alignItems="center">
    <Typography variant="caption" color="text.secondary" fontWeight={800}>
      {label}
    </Typography>
    <Typography variant="body2" fontWeight={900}>
      {value ? value.toString().slice(0, 5) : "—"}
    </Typography>
  </Stack>
);

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Stack direction="row" gap={1} alignItems="baseline" sx={{ flexWrap: "wrap" }}>
    <Typography variant="caption" color="text.secondary" fontWeight={900} sx={{ minWidth: 160 }}>
      {label}
    </Typography>
    <Typography variant="body2" fontWeight={800}>
      {value}
    </Typography>
  </Stack>
);
