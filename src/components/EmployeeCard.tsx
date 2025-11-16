/* eslint-disable @typescript-eslint/no-unused-vars */
import React from "react";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  Grid,
  Snackbar,
  Alert,
  Divider,
} from "@mui/material";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import WorkOutline from "@mui/icons-material/WorkOutline";
import AccessTimeOutlined from "@mui/icons-material/AccessTimeOutlined";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";
import PersonOutline from "@mui/icons-material/PersonOutline";
import CheckRounded from "@mui/icons-material/CheckRounded";
import Numbers from "@mui/icons-material/Numbers";
import Paid from "@mui/icons-material/Paid";
import PhoneIphone from "@mui/icons-material/PhoneIphone";
import AlternateEmail from "@mui/icons-material/AlternateEmail";

/* ---------- types ---------- */
export type MinimalEmployee = {
  ID_EMP?: number;
  NAME: string;
  TITLE?: string | null;
  STATE?: boolean | null;
  PICTURE_URL?: string | null;
  DATE_OF_BIRTH?: string | null;
  CONTRACT_START?: string | null;
  CONTRACT_END?: string | null;
  T_START?: string | null; // "HH:mm" | "HH:mm:ss" | ISO
  T_END?: string | null;
  PS?: string | number | null;
  BASIC_SALARY?: number | string | null;
  PHONE?: string | null;
  EMAIL?: string | null;
  UPDATED_AT?: string | null;
};

export type EmployeeCardProps<T> = {
  employee: T;
  apiBase?: string;
  dense?: boolean;
  onEdit?: (emp: T) => void;
  onDelete?: (emp: T) => void;
  onUpdateTimes?: (
    id: number,
    times: { T_START: string | null; T_END: string | null }
  ) => Promise<void>;
  onOpenProfile?: (emp: T) => void;
};

/* ---------- helpers ---------- */
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

const safeDate = (s?: string | null): Date | null => {
  if (!s) return null;
  const raw = s.slice(0, 19);
  const dmy = raw.match(/^(\d{2})-(\d{2})-(\d{4})/);
  const iso = dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : raw;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

const fmtDate = (s?: string | null) => {
  const d = safeDate(s);
  return d ? d.toLocaleDateString() : "—";
};

// Accept "HH:mm", "HH:mm:ss", "YYYY-MM-DDTHH:mm:ss", etc. -> "hh:mm am/pm"
const display12h = (val?: string | null) => {
  if (!val) return "—";
  let hh = 0,
    mm = 0;
  const only = val.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (only) {
    hh = Number(only[1]);
    mm = Number(only[2]);
  } else {
    const m = val.match(/T?(\d{2}):(\d{2})(?::\d{2})?/);
    if (m) {
      hh = Number(m[1]);
      mm = Number(m[2]);
    } else return "—";
  }
  const ampm = hh >= 12 ? "pm" : "am";
  const hr12 = ((hh + 11) % 12) + 1;
  const mm2 = String(mm).padStart(2, "0");
  return `${hr12}:${mm2} ${ampm}`;
};

const to24hSeconds = (val?: string | null): string | null => {
  if (!val) return null;
  const only = val.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (only) return `${only[1]}:${only[2]}:${only[3] ?? "00"}`;
  const m = val.match(/T?(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return `${m[1]}:${m[2]}:${m[3] ?? "00"}`;
  return null;
};

function resolveApiBase(explicit?: string) {
  const env = (process.env.REACT_APP_API_IP || "").replace(/\/+$/, "");
  if (explicit && /^https?:\/\//i.test(explicit))
    return explicit.replace(/\/+$/, "");
  if (env && /^https?:\/\//i.test(env)) return env;
  return "";
}
function pictureUrl(e: MinimalEmployee, apiBase?: string) {
  if (
    e.PICTURE_URL &&
    (/^https?:\/\//i.test(e.PICTURE_URL) ||
      e.PICTURE_URL.startsWith("data:image"))
  )
    return e.PICTURE_URL;
  if (e.ID_EMP) {
    const base = resolveApiBase(apiBase);
    const bust =
      e.UPDATED_AT && safeDate(e.UPDATED_AT)
        ? `v=${safeDate(e.UPDATED_AT)!.getTime()}`
        : `v=${e.ID_EMP}`;
    return `${base}/employees/${e.ID_EMP}/picture?${bust}`;
  }
  return undefined;
}

const fmtMoney = (n?: number | string | null) => {
  if (n == null || n === "") return null;
  const v = typeof n === "string" ? Number(n) : n;
  if (Number.isNaN(v as number)) return String(n);
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
    v as number
  );
};

const SmallBadge = ({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
}) => (
  <Chip
    size="small"
    variant="outlined"
    icon={icon as any}
    label={label}
    sx={{
      height: "auto",
      minHeight: 22,
      borderRadius: 8,
      px: 0.5,
      "& .MuiChip-icon": { fontSize: 16, mr: 0.5, ml: 0.25 },
      "& .MuiChip-label": {
        p: 0.25,
        lineHeight: 1.1,
        fontWeight: 700,
        whiteSpace: "normal",
        wordBreak: "break-word",
        overflow: "visible",
      },
      maxWidth: "100%",
    }}
  />
);

/* ---------- Card component ---------- */
export const EmployeeCard = <T extends MinimalEmployee>({
  employee: e,
  onEdit,
  onDelete,
  onUpdateTimes,
  onOpenProfile,
  apiBase,
  dense = false,
}: EmployeeCardProps<T>) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const [broken, setBroken] = React.useState(false);
  const [editing, setEditing] = React.useState<boolean>(false);

  const [tStart, setTStart] = React.useState<string | null>(null);
  const [tEnd, setTEnd] = React.useState<string | null>(null);

  // toast
  const [toast, setToast] = React.useState<{
    open: boolean;
    msg: string;
    sev: "success" | "error" | "info";
  }>({ open: false, msg: "", sev: "info" });

  React.useEffect(() => {
    setTStart(to24hSeconds(e.T_START)?.slice(0, 5) || "");
    setTEnd(to24hSeconds(e.T_END)?.slice(0, 5) || "");
  }, [e.T_START, e.T_END]);

  const imgSrc = !broken ? pictureUrl(e, apiBase) : undefined;

  // age
  const dob = e.DATE_OF_BIRTH;
  const d = safeDate(dob);
  let age: number | null = null;
  if (d) {
    const today = new Date();
    age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  }

  // PS label
  const psChipLabel =
    e.PS == null || e.PS === ""
      ? null
      : String(e.PS).trim().toUpperCase().startsWith("P")
        ? String(e.PS).trim().toUpperCase()
        : `P${String(e.PS).trim()}`;

  const fmt12 = (s?: string | null) => {
    if (!s) return "—";
    const [h, m] = s.split(":").slice(0, 2).map(Number);
    const dd = new Date();
    dd.setHours(h || 0, m || 0, 0, 0);
    return dd
      .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      .toLowerCase();
  };

  const saveTimes = async () => {
    if (!onUpdateTimes || !e.ID_EMP) return;
    const prevStart = e.T_START;
    const prevEnd = e.T_END;

    const nextStart = tStart ? `${tStart}:00` : null;
    const nextEnd = tEnd ? `${tEnd}:00` : null;

    // optimistic: no mutation of 'e' object (parent owns data), just fire and toast
    try {
      await onUpdateTimes(e.ID_EMP, {
        T_START: nextStart,
        T_END: nextEnd,
      });
      setToast({ open: true, msg: t("common.saved", "Saved"), sev: "success" });
      setEditing(false);
    } catch (err: any) {
      // rollback UI state to prev visual values
      setTStart(to24hSeconds(prevStart)?.slice(0, 5) || "");
      setTEnd(to24hSeconds(prevEnd)?.slice(0, 5) || "");
      setToast({
        open: true,
        msg: err?.message || t("common.error", "Failed to save"),
        sev: "error",
      });
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        width: 420,
        maxWidth: "100%",
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
        bgcolor: "background.paper",
        transition: (t) =>
          t.transitions.create(["box-shadow", "transform", "border-color"], {
            duration: t.transitions.duration.shorter,
          }),
        "&:hover": {
          boxShadow: 8,
          transform: "translateY(-1px)",
          borderColor: (theme.palette as any)?.primary?.main || "divider",
        },
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <Box sx={{ position: "relative", p: dense ? 1.25 : 1.5 }}>
        <Box
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 10,
            height: 10,
            borderRadius: "50%",
            bgcolor: e.STATE ? "success.main" : "action.disabled",
            boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
          }}
        />
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          sx={{ cursor: "pointer" }}
          onClick={() => onOpenProfile?.(e)}
        >
          <Avatar
            src={imgSrc}
            onError={() => setBroken(true)}
            imgProps={{
              crossOrigin: "anonymous",
              referrerPolicy: "no-referrer",
            }}
            sx={{
              width: 64,
              height: 64,
              fontWeight: 800,
              border: "2px solid",
              borderColor: "divider",
              bgcolor: "background.default",
            }}
          >
            {initials(e.NAME)}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="h6"
              fontWeight={900}
              sx={{
                whiteSpace: "normal",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
                lineHeight: 1.15,
              }}
            >
              {e.NAME}
            </Typography>
            {e.TITLE ? (
              <Stack
                direction="row"
                spacing={0.5}
                alignItems="center"
                sx={{ mt: 0.5 }}
              >
                <WorkOutline fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  {e.TITLE}
                </Typography>
              </Stack>
            ) : null}
          </Box>
        </Stack>
      </Box>

      {/* Badges */}
      <Box sx={{ px: 1.25 }}>
        <Stack
          direction="row"
          spacing={0.5}
          rowGap={0.5}
          useFlexGap
          flexWrap="wrap"
          sx={{ mb: 1, width: "100%" }}
        >
          {e.ID_EMP != null && (
            <SmallBadge icon={<Numbers />} label={`#${e.ID_EMP}`} />
          )}
          {psChipLabel && (
            <SmallBadge icon={<StorefrontOutlined />} label={psChipLabel} />
          )}
          {fmtMoney(e.BASIC_SALARY) && (
            <SmallBadge icon={<Paid />} label={fmtMoney(e.BASIC_SALARY)} />
          )}
          {e.PHONE && <SmallBadge icon={<PhoneIphone />} label={e.PHONE} />}
          {e.EMAIL && <SmallBadge icon={<AlternateEmail />} label={e.EMAIL} />}
          {age != null && (
            <SmallBadge icon={<PersonOutline />} label={`${age}`} />
          )}
        </Stack>
      </Box>

      <Divider />

      {/* Details */}
      <Box sx={{ px: 1.25, py: 1 }}>
        <Stack spacing={0.75} sx={{ mb: 0.75 }}>
          <Row
            icon={<CalendarMonthOutlined fontSize="small" />}
            label="Start"
            value={fmtDate(e.CONTRACT_START)}
          />
          <Row
            icon={<CalendarMonthOutlined fontSize="small" />}
            label="End"
            value={fmtDate(e.CONTRACT_END)}
          />

          {!editing ? (
            <Stack spacing={0.25}>
              <Row
                icon={<AccessTimeOutlined fontSize="small" />}
                label="Shift start"
                value={display12h(e.T_START)}
              />
              <Row
                icon={<AccessTimeOutlined fontSize="small" />}
                label="Shift end"
                value={display12h(e.T_END)}
              />
            </Stack>
          ) : (
            <Stack spacing={1} sx={{ mt: 0.25 }}>
              <InlineTimeRow
                label="Start"
                value={tStart ?? ""}
                pretty={fmt12(tStart)}
                onChange={setTStart}
              />
              <InlineTimeRow
                label="End"
                value={tEnd ?? ""}
                pretty={fmt12(tEnd)}
                onChange={setTEnd}
              />
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  onClick={saveTimes}
                  startIcon={<CheckRounded />}
                  variant="contained"
                  size="small"
                  sx={{ textTransform: "none", borderRadius: 999 }}
                >
                  {t("common.save", "Save")}
                </Button>
                <Button
                  onClick={() => setEditing(false)}
                  variant="text"
                  size="small"
                  sx={{ textTransform: "none", borderRadius: 999 }}
                >
                  {t("common.cancel", "Cancel")}
                </Button>
              </Box>
            </Stack>
          )}
        </Stack>
      </Box>

      {/* action bar */}
      <Box
        sx={{
          mt: "auto",
          px: 1,
          py: 0.75,
          borderTop: "1px solid",
          borderColor: "divider",
          display: "flex",
          gap: 0.75,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Button
          size="small"
          variant="outlined"
          onClick={(ev) => {
            ev.stopPropagation();
            setEditing((s) => !s);
          }}
          startIcon={<AccessTimeOutlined />}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 999 }}
        >
          {editing
            ? t("common.editOff", "Edit off")
            : t("common.editTime", "Edit time")}
        </Button>
        <Box>
          <Tooltip title={t("common.edit", "Edit")}>
            <IconButton
              size="small"
              onClick={(ev) => {
                ev.stopPropagation();
                onEdit?.(e);
              }}
              data-interactive="true"
            >
              <EditOutlined fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title={t("common.delete", "Delete")}>
            <IconButton
              size="small"
              color="error"
              onClick={(ev) => {
                ev.stopPropagation();
                onDelete?.(e);
              }}
              data-interactive="true"
            >
              <DeleteOutline fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

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
    </Paper>
  );
};

/* compact label/value row */
const Row: React.FC<{
  icon: React.ReactNode;
  label: string;
  value?: string | number | null;
}> = ({ icon, label, value }) =>
  value == null || value === "" ? null : (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="center"
      sx={{ color: "text.secondary" }}
    >
      <Box sx={{ display: "grid", placeItems: "center" }}>{icon}</Box>
      <Typography variant="body2" fontWeight={700}>
        {label}:
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
        {String(value)}
      </Typography>
    </Stack>
  );

/* inline time input with preview */
const InlineTimeRow = ({
  label,
  value,
  pretty,
  onChange,
}: {
  label: string;
  value: string;
  pretty: string;
  onChange: (v: string | null) => void;
}) => (
  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
    <AccessTimeOutlined fontSize="small" />
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <input
      type="time"
      value={value}
      onChange={(ev) => onChange(ev.target.value || null)}
      data-interactive="true"
      style={{
        border: "1px solid var(--mui-palette-divider)",
        borderRadius: 8,
        padding: "4px 8px",
        fontSize: 12,
        height: 28,
      }}
    />
    <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
      {pretty}
    </Typography>
  </Stack>
);

/* ---------- Grid wrapper (unchanged API) ---------- */
export const EmployeeGrid = <T extends MinimalEmployee>({
  rows,
  renderCard,
  spacing = 1,
}: {
  rows: T[];
  renderCard: (row: T) => React.ReactNode;
  spacing?: number;
}) => (
  <Grid container spacing={spacing}>
    {rows.map((r) => (
      <Grid key={r.ID_EMP ?? r.NAME}>
        {renderCard(r)}
      </Grid>
    ))}
  </Grid>
);

export default EmployeeCard;
