import React from "react";
import {
  Avatar,
  Box,
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
} from "@mui/material";
import AccessTimeOutlined from "@mui/icons-material/AccessTimeOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";
import Numbers from "@mui/icons-material/Numbers";
import CheckRounded from "@mui/icons-material/CheckRounded";
import { MinimalEmployee } from "./EmployeeCard"; // adjust import path

type EmployeeListProps<T extends MinimalEmployee> = {
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

export function EmployeeList<T extends MinimalEmployee>({
  rows,
  apiBase,
  dense = false,
  onOpenProfile,
  onEdit,
  onDelete,
  onUpdateTimes,
}: EmployeeListProps<T>) {
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editStart, setEditStart] = React.useState<string>("");
  const [editEnd, setEditEnd] = React.useState<string>("");
  const [toast, setToast] = React.useState<{
    open: boolean;
    msg: string;
    sev: "success" | "error" | "info";
  }>({ open: false, msg: "", sev: "info" });

  const beginEdit = (emp: T) => {
    setEditingId(emp.ID_EMP ?? null);
    const s = (emp.T_START || "").toString().slice(0, 5);
    const e = (emp.T_END || "").toString().slice(0, 5);
    setEditStart(s || "");
    setEditEnd(e || "");
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

  return (
    <>
      <List sx={{ width: "100%", bgcolor: "transparent" }}>
        {rows.map((e, idx) => {
          const psLabel =
            e.PS == null || e.PS === ""
              ? null
              : String(e.PS).trim().toUpperCase().startsWith("P")
                ? String(e.PS).trim().toUpperCase()
                : `P${String(e.PS).trim()}`;

          const editing = editingId === (e.ID_EMP ?? -1);

          return (
            <React.Fragment key={e.ID_EMP ?? e.NAME}>
              <ListItem
                alignItems="flex-start"
                sx={{
                  px: 1,
                  py: dense ? 0.75 : 1,
                  "&:hover": { bgcolor: "action.hover" },
                  borderRadius: 1.5,
                }}
                onClick={() => onOpenProfile?.(e)}
              >
                <ListItemAvatar>
                  <Avatar
                    src={
                      e.PICTURE_URL && e.PICTURE_URL.startsWith("http")
                        ? e.PICTURE_URL
                        : undefined
                    }
                  >
                    {e.NAME.split(" ")
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      gap={1}
                      sx={{ pr: 7 }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="subtitle1"
                          fontWeight={800}
                          sx={{
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                            maxWidth: 360,
                          }}
                        >
                          {e.NAME}
                        </Typography>
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
                        <Stack
                          direction="row"
                          gap={1}
                          alignItems="center"
                          sx={{ mt: 0.5, flexWrap: "wrap" }}
                        >
                          {e.ID_EMP != null && (
                            <Badge
                              icon={<Numbers fontSize="inherit" />}
                              text={`#${e.ID_EMP}`}
                            />
                          )}
                          {psLabel && (
                            <Badge
                              icon={<StorefrontOutlined fontSize="inherit" />}
                              text={psLabel}
                            />
                          )}
                        </Stack>
                      </Box>

                      {/* right side: time / edit */}
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
                          <TimeInput
                            label="Start"
                            value={editStart}
                            onChange={setEditStart}
                          />
                          <TimeInput
                            label="End"
                            value={editEnd}
                            onChange={setEditEnd}
                          />
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
                />
                <ListItemSecondaryAction>
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
              {idx < rows.length - 1 && <Divider component="li" />}
            </React.Fragment>
          );
        })}
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
      fontWeight: 700,
      color: "text.secondary",
    }}
  >
    <Box sx={{ display: "grid", placeItems: "center", fontSize: 14 }}>
      {icon}
    </Box>
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
    <Typography variant="caption" color="text.secondary">
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
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="body2" fontWeight={700}>
      {value ? value.toString().slice(0, 5) : "—"}
    </Typography>
  </Stack>
);
