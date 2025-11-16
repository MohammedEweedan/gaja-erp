import * as React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  FormHelperText,
  Card,
  CardContent,
  CardActions,
  Avatar,
  IconButton,
  Tooltip,
  InputAdornment,
} from "@mui/material";
import Chip from "@mui/material/Chip";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import OutlinedInput from "@mui/material/OutlinedInput";
import ListItemText from "@mui/material/ListItemText";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import PersonIcon from "@mui/icons-material/Person";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import axios from "../../api";
import PermissionsDialog, { AVAILABLE_ACTIONS } from "./PermissionsDialog";
import Autocomplete from "@mui/material/Autocomplete";

type User = {
  id_user?: number | string;
  Id_user?: number | string;
  Cuser?: number | string;
  name?: string; // legacy
  name_user?: string;
  email?: string;
  password?: string;
  Action_user?: any;
  actived?: boolean;
  Roles?: any;
  ps?: any;
  ref_emp?: string;
  [k: string]: any;
};

export default function UsersDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [editing, setEditing] = React.useState<User | null>(null);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");

  const apiIp = process.env.REACT_APP_API_IP || "";

  React.useEffect(() => {
    if (!open) return;
    let mounted = true;
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : "";
        const res = await axios.get(`${apiIp}/users/ListUsersP`, {
          headers: { Authorization: token ? `Bearer ${token}` : undefined },
        });
        const all = Array.isArray(res?.data)
          ? res.data
          : (res?.data?.users ?? res?.data?.data ?? []);
        if (mounted) setUsers(all || []);
      } catch (e) {
        // fallback to local cache
        try {
          const raw = localStorage.getItem("usersLocalCache");
          if (raw) setUsers(JSON.parse(raw));
        } catch {}
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchUsers();
    return () => {
      mounted = false;
    };
  }, [open, apiIp]);

  const [idUser, setIdUser] = React.useState<string | number | undefined>(
    undefined
  );
  const [passwordField, setPasswordField] = React.useState("");
  const [actionUser, setActionUser] = React.useState<any>("");
  const [activedField, setActivedField] = React.useState<boolean>(true);
  const [rolesField, setRolesField] = React.useState<string>("");
  const [psField, setPsField] = React.useState<string>("");
  const [refEmpField, setRefEmpField] = React.useState<string>("");
  const [nameUserField, setNameUserField] = React.useState<string>("");
  // POS options fetched from backend to match the Change POS list in Home
  const [posOptions, setPosOptions] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!open) return;
    let mounted = true;
    const apiIpLocal = process.env.REACT_APP_API_IP || "";
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
    const headers = {
      Authorization: token ? `Bearer ${token}` : undefined,
    } as any;
    const fetchPOS = async () => {
      try {
        const res = await axios.get(`${apiIpLocal}/ps/all`, { headers });
        if (mounted && Array.isArray(res?.data)) setPosOptions(res.data);
      } catch (e) {
        // ignore
      }
    };
    fetchPOS();
    return () => {
      mounted = false;
    };
  }, [open]);

  const startAdd = () => {
    setEditing(null);
    setIdUser(undefined);
    setNameUserField("");
    setName("");
    setEmail("");
    setPasswordField("");
    setActionUser("");
    setActivedField(true);
    setRolesField("");
    setPsField("");
    setRefEmpField("");
    setEditDialogOpen(true);
  };

  // filters
  const [activedFilter, setActivedFilter] = React.useState<
    "all" | "active" | "inactive"
  >("all");
  const [rolesFilter, setRolesFilter] = React.useState<string[]>([]);

  const [permissionsOpen, setPermissionsOpen] = React.useState(false);
  const [permissionUser, setPermissionUser] = React.useState<User | null>(null);
  // picker used inside the Edit dialog to pick actions and return a comma-separated string
  const [permissionsPickerOpen, setPermissionsPickerOpen] =
    React.useState(false);
  const [expandedUserId, setExpandedUserId] = React.useState<
    string | number | null
  >(null);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [showPasswords, setShowPasswords] = React.useState<
    Record<string, boolean>
  >({});
  const [editShowPassword, setEditShowPassword] = React.useState(false);

  const toggleShowPassword = (key: string) => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openEditDialog = (u: User) => {
    // populate form fields with user values
    setEditing(u);
    setIdUser(u?.id_user ?? u?.Id_user ?? u?.Cuser);
    setNameUserField(u?.name_user ?? u?.name ?? "");
    setName(u?.name_user ?? u?.name ?? "");
    setEmail(u?.email ?? "");
    setPasswordField(u?.password ?? ""); // prefill password when editing
    // normalize Action_user to a comma-separated string for editing
    if (Array.isArray(u?.Action_user)) {
      setActionUser((u.Action_user as any).join(", "));
    } else if (Array.isArray(u?.Action)) {
      setActionUser((u.Action as any).join(", "));
    } else {
      // handle case where Action_user might be a JSON string like '["Users","Purchase"]'
      const raw = u?.Action_user ?? u?.Action ?? "";
      if (typeof raw === "string" && raw.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setActionUser(parsed.join(", "));
          } else {
            setActionUser(String(raw));
          }
        } catch {
          setActionUser(String(raw));
        }
      } else {
        setActionUser(String(raw));
      }
    }
    setActivedField(Boolean(u?.actived ?? u?.Actived ?? u?.active ?? false));
    // store single role value for edit dialog (use first role if array)
    if (Array.isArray(u?.Roles)) {
      setRolesField((u.Roles as any)[0] ?? "");
    } else {
      setRolesField(String(u?.Roles ?? ""));
    }
    setPsField(String(u?.ps ?? ""));
    setRefEmpField(String(u?.ref_emp ?? ""));
    setEditDialogOpen(true);
  };

  const closePermissions = () => {
    setPermissionUser(null);
    setPermissionsOpen(false);
  };

  const handleSavePermissions = async (selected: string[]) => {
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : "";
      const targetId =
        permissionUser?.id_user ??
        permissionUser?.Id_user ??
        permissionUser?.Cuser;
      if (targetId != null) {
        // send Action_user as a comma-separated string (no brackets/quotes)
        await axios.put(
          `${apiIp}/users/${targetId}`,
          { Action_user: selected.join(", "), Roles: selected },
          { headers: { Authorization: token ? `Bearer ${token}` : undefined } }
        );
      }
      const newUsers = users.map((x) =>
        String(x?.id_user ?? x?.Id_user ?? x?.Cuser) === String(targetId)
          ? { ...x, Action_user: selected.join(", "), Roles: selected }
          : x
      );
      setUsers(newUsers);
      try {
        localStorage.setItem("usersLocalCache", JSON.stringify(newUsers));
      } catch {}
    } catch (e) {
      // fallback local update
      const targetId =
        permissionUser?.id_user ??
        permissionUser?.Id_user ??
        permissionUser?.Cuser;
      const newUsers = users.map((x) =>
        String(x?.id_user ?? x?.Id_user ?? x?.Cuser) === String(targetId)
          ? { ...x, Action_user: selected.join(", "), Roles: selected }
          : x
      );
      setUsers(newUsers);
      try {
        localStorage.setItem("usersLocalCache", JSON.stringify(newUsers));
      } catch {}
    } finally {
      closePermissions();
      // collapse inline panel too
      setExpandedUserId(null);
    }
  };

  const save = async () => {
    const normalizeActionToString = (val: any) => {
      if (!val && val !== 0) return undefined;
      // If it's already an array, join
      if (Array.isArray(val)) return val.join(", ");
      // If it's a string that looks like a JSON array, try parse
      if (typeof val === "string") {
        const raw = val.trim();
        if (raw.startsWith("[") && raw.endsWith("]")) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.join(", ");
          } catch {
            // fallthrough
          }
        }
        // if the string contains quotes and commas like \"X\",\"Y\" or has surrounding quotes, remove them
        // remove any leading/trailing [ ] or quotes
        const stripped = raw.replace(/^\[|\]$/g, "").replace(/"/g, "");
        // split by comma and re-join trimmed values to normalize spacing
        const parts = stripped
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        return parts.join(", ");
      }
      // fallback to string
      return String(val);
    };

    const payload: any = {
      name_user: nameUserField || name,
      name: nameUserField || name,
      email,
      password: passwordField || undefined,
      // ensure Action_user is sent as a plain comma-separated string (no brackets/quotes)
      Action_user: normalizeActionToString(actionUser),
      actived: activedField,
      Roles: rolesField
        ? rolesField.split(",").map((s) => s.trim())
        : undefined,
      ps: psField || undefined,
      ref_emp: refEmpField || undefined,
    };

    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : "";
      if (editing) {
        // attempt update
        const targetId =
          editing?.id_user ?? editing?.Id_user ?? editing?.Cuser ?? idUser;
        await axios.put(`${apiIp}/users/${targetId}`, payload, {
          headers: { Authorization: token ? `Bearer ${token}` : undefined },
        });
        const newUsers = users.map((x) =>
          String(x?.id_user ?? x?.Id_user ?? x?.Cuser) === String(targetId)
            ? { ...x, ...payload }
            : x
        );
        setUsers(newUsers);
        try {
          localStorage.setItem("usersLocalCache", JSON.stringify(newUsers));
        } catch {}
      } else {
        // attempt create
        const res = await axios.post(`${apiIp}/users`, payload, {
          headers: { Authorization: token ? `Bearer ${token}` : undefined },
        });
        // Backend returns { success, message, user }
        let created = res?.data?.user ?? res?.data ?? payload;
        // normalize created.Action_user to plain comma-separated string if needed
        if (created && created.Action_user) {
          created = {
            ...created,
            Action_user: normalizeActionToString(created.Action_user),
          };
        }
        const newUsers = [created, ...users];
        setUsers(newUsers);
        try {
          localStorage.setItem("usersLocalCache", JSON.stringify(newUsers));
        } catch {}
      }

      setEditing(null);
      setIdUser(undefined);
      setNameUserField("");
      setName("");
      setEmail("");
      setPasswordField("");
      setActionUser("");
      setActivedField(true);
      setRolesField("");
      setPsField("");
      setRefEmpField("");
    } catch (e) {
      // on error, fallback to local update
      if (editing) {
        const newUsers = users.map((x) =>
          x === editing ? { ...x, ...payload } : x
        );
        setUsers(newUsers);
        try {
          localStorage.setItem("usersLocalCache", JSON.stringify(newUsers));
        } catch {}
      } else {
        const fallback = { id_user: `local-${Date.now()}`, ...payload } as User;
        const newUsers = [fallback, ...users];
        setUsers(newUsers);
        try {
          localStorage.setItem("usersLocalCache", JSON.stringify(newUsers));
        } catch {}
      }
      setEditing(null);
      setIdUser(undefined);
      setNameUserField("");
      setName("");
      setEmail("");
      setPasswordField("");
      setActionUser("");
      setActivedField(true);
      setRolesField("");
      setPsField("");
      setRefEmpField("");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{ sx: { width: "95%", maxWidth: "1200px" } }}
    >
      <DialogTitle>Manage Users</DialogTitle>
      <DialogContent>
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, mt: 4 }}
        >
          <Button startIcon={<AddIcon />} onClick={startAdd} size="small">
            Add user
          </Button>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {loading ? "Loading..." : `${users.length} user(s)`}
          </Typography>
          <FormControl size="small" sx={{ minWidth: 120, ml: 1 }}>
            <InputLabel id="actived-filter-label">Actived</InputLabel>
            <Select
              labelId="actived-filter-label"
              value={activedFilter}
              label="Actived"
              onChange={(e) => setActivedFilter(e.target.value as any)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180, ml: 1 }}>
            <InputLabel id="roles-filter-label">Roles</InputLabel>
            <Select
              labelId="roles-filter-label"
              multiple
              value={rolesFilter}
              onChange={(e) =>
                setRolesFilter(
                  typeof e.target.value === "string"
                    ? (e.target.value.split(",") as string[])
                    : (e.target.value as string[])
                )
              }
              input={<OutlinedInput label="Roles" />}
              renderValue={(selected) => (selected as string[]).join(", ")}
            >
              <MenuItem value={"ROLE_ADMIN"}>
                <Checkbox checked={rolesFilter.indexOf("ROLE_ADMIN") > -1} />
                <ListItemText primary="ROLE_ADMIN" />
              </MenuItem>
              <MenuItem value={"ROLE_USER"}>
                <Checkbox checked={rolesFilter.indexOf("ROLE_USER") > -1} />
                <ListItemText primary="ROLE_USER" />
              </MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {users.length === 0 && !loading && (
            <Box>
              <Typography
                variant="body2"
                sx={{ p: 1, color: "text.secondary" }}
              >
                No users found
              </Typography>
            </Box>
          )}

          {users
            .filter((u) => {
              // actived filter
              const isActive = Boolean(
                u?.actived ?? u?.Actived ?? u?.active ?? false
              );
              if (activedFilter === "active" && !isActive) return false;
              if (activedFilter === "inactive" && isActive) return false;
              // roles filter
              if (rolesFilter.length > 0) {
                const rolesArr = Array.isArray(u?.Roles)
                  ? u.Roles
                  : typeof u?.Roles === "string" && u?.Roles
                    ? String(u.Roles).split(",")
                    : [];
                const has = rolesFilter.some((r) => rolesArr.includes(r));
                if (!has) return false;
              }
              return true;
            })
            .map((u) => (
              <Card
                key={String(
                  u?.id_user ??
                    u?.Id_user ??
                    u?.Cuser ??
                    u?.email ??
                    JSON.stringify(u)
                )}
                variant="outlined"
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "stretch",
                  width: "100%",
                }}
              >
                <CardContent sx={{ flex: 1, py: 2 }}>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "row",
                      gap: 2,
                      alignItems: "flex-start",
                      width: "100%",
                    }}
                  >
                    <Box sx={{ minWidth: 220 }}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          mb: 0.5,
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            bgcolor: "primary.main",
                          }}
                        >
                          {u?.name_user ? (
                            String(u.name_user).charAt(0).toUpperCase()
                          ) : (
                            <PersonIcon />
                          )}
                        </Avatar>
                        <Typography variant="subtitle2">
                          {u?.name_user ??
                            u?.name ??
                            u?.username ??
                            "(no name)"}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: "flex", flexDirection: "row", gap: 2 }}>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", display: "block" }}
                      >
                        <Box component="span" sx={{ fontWeight: 700, mr: 0.5 }}>
                          Email:
                        </Box>
                        <Box component="span">{u?.email ?? ""}</Box>
                      </Typography>

                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", display: "block" }}
                      >
                        <Box component="span" sx={{ fontWeight: 700, mr: 0.5 }}>
                          Employee Number:
                        </Box>
                        <Box component="span">{u?.ref_emp ?? ""}</Box>
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", display: "block" }}
                      >
                        <Box component="span" sx={{ fontWeight: 700, mr: 0.5 }}>
                          PS:
                        </Box>
                        <Box component="span">
                          {(() => {
                            try {
                              const found = posOptions.find(
                                (p) =>
                                  String(p?.Id_point) === String(u?.ps) ||
                                  String(p?.name_point) === String(u?.ps)
                              );
                              return found
                                ? found.name_point
                                : String(u?.ps ?? "");
                            } catch {
                              return String(u?.ps ?? "");
                            }
                          })()}
                        </Box>
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", display: "block" }}
                      >
                        <Box component="span" sx={{ fontWeight: 700, mr: 0.5 }}>
                          Roles:
                        </Box>
                        <Box component="span">
                          {Array.isArray(u?.Roles)
                            ? (u.Roles as any).join(",")
                            : String(u?.Roles ?? "")}
                        </Box>
                      </Typography>
                      {/* Action field intentionally hidden from row */}
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <Chip
                          label={
                            String(
                              u?.actived ?? u?.Actived ?? u?.active ?? false
                            ) === "true" ||
                            Boolean(
                              u?.actived ?? u?.Actived ?? u?.active ?? false
                            )
                              ? "Active"
                              : "Inactive"
                          }
                          color={
                            Boolean(
                              u?.actived ?? u?.Actived ?? u?.active ?? false
                            )
                              ? "success"
                              : "warning"
                          }
                          size="small"
                        />
                      </Box>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary", display: "block" }}
                        >
                          <Box
                            component="span"
                            sx={{ fontWeight: 700, mr: 0.5 }}
                          >
                            Password:
                          </Box>
                          <Box component="span">
                            {showPasswords[
                              String(
                                u?.id_user ??
                                  u?.Id_user ??
                                  u?.Cuser ??
                                  u?.email ??
                                  JSON.stringify(u)
                              )
                            ] && u?.password
                              ? String(u?.password)
                              : u?.password
                                ? "•".repeat(6)
                                : ""}
                          </Box>
                        </Typography>
                        {u?.password ? (
                          <Tooltip
                            title={
                              showPasswords[
                                String(
                                  u?.id_user ??
                                    u?.Id_user ??
                                    u?.Cuser ??
                                    u?.email ??
                                    JSON.stringify(u)
                                )
                              ]
                                ? "Hide password"
                                : "Show password"
                            }
                          >
                            <IconButton
                              size="small"
                              onClick={() =>
                                toggleShowPassword(
                                  String(
                                    u?.id_user ??
                                      u?.Id_user ??
                                      u?.Cuser ??
                                      u?.email ??
                                      JSON.stringify(u)
                                  )
                                )
                              }
                            >
                              {showPasswords[
                                String(
                                  u?.id_user ??
                                    u?.Id_user ??
                                    u?.Cuser ??
                                    u?.email ??
                                    JSON.stringify(u)
                                )
                              ] ? (
                                <VisibilityOff fontSize="small" />
                              ) : (
                                <Visibility fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        ) : null}
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
                <CardActions
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    pr: 2,
                  }}
                >
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => openEditDialog(u)}
                  >
                    Edit
                  </Button>
                </CardActions>
              </Card>
            ))}
        </Box>

        {/* Inline expanded permissions panel for the selected user (immediate feedback) */}
        {expandedUserId !== null && (
          <Box
            sx={{
              mt: 2,
              p: 2,
              border: "1px dashed",
              borderColor: "divider",
              borderRadius: 1,
            }}
          >
            <Typography variant="subtitle2">Edit permissions</Typography>
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}
            >
              {AVAILABLE_ACTIONS.map((a) => {
                const isChecked = (
                  permissionUser && Array.isArray(permissionUser.Action_user)
                    ? permissionUser.Action_user
                    : permissionUser && Array.isArray(permissionUser.Roles)
                      ? permissionUser.Roles
                      : []
                ).includes(a as any);
                return (
                  <FormControlLabel
                    key={a}
                    control={
                      <Checkbox
                        checked={isChecked}
                        onChange={() => {
                          // toggle in permissionUser preview locally
                          setPermissionUser((prev) => {
                            if (!prev) return prev;
                            const current = Array.isArray(prev.Action_user)
                              ? [...prev.Action_user]
                              : Array.isArray(prev.Roles)
                                ? [...prev.Roles]
                                : [];
                            const idx = current.indexOf(a);
                            if (idx >= 0) current.splice(idx, 1);
                            else current.push(a);
                            return {
                              ...prev,
                              Action_user: current,
                              Roles: current,
                            };
                          });
                        }}
                      />
                    }
                    label={a}
                  />
                );
              })}
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  variant="outlined"
                  onClick={() => setExpandedUserId(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    // Save inline: use current permissionUser selection
                    if (!permissionUser) return;
                    const current = Array.isArray(permissionUser.Action_user)
                      ? permissionUser.Action_user
                      : Array.isArray(permissionUser.Roles)
                        ? permissionUser.Roles
                        : [];
                    handleSavePermissions(current as string[]);
                  }}
                >
                  Save
                </Button>
              </Box>
            </Box>
          </Box>
        )}

        {/* footer form hidden - editing is done in the separate Edit dialog */}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
      {/* Edit dialog opened via the Delete button (shows edit form) */}
      <Dialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditing(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit user</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
            <TextField
              label="Full name"
              value={nameUserField}
              onChange={(e) => setNameUserField(e.target.value)}
              size="small"
              fullWidth
              helperText="Full name of the user."
            />
            <TextField
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              size="small"
              fullWidth
              helperText="User email used for login and notifications."
            />
            <TextField
              label="Password"
              value={passwordField}
              onChange={(e) => setPasswordField(e.target.value)}
              size="small"
              fullWidth
              type={editShowPassword ? "text" : "password"}
              helperText="Leave empty to keep the current password."
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setEditShowPassword((s) => !s)}
                    >
                      {editShowPassword ? (
                        <VisibilityOff fontSize="small" />
                      ) : (
                        <Visibility fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Permissions"
              value={actionUser}
              onChange={(e) => setActionUser(e.target.value)}
              size="small"
              fullWidth
              helperText="Comma-separated permissions. Click 'Edit permissions' to pick."
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <Button
                    size="small"
                    onClick={() => setPermissionsPickerOpen(true)}
                  >
                    Edit permissions
                  </Button>
                ),
              }}
            />
            <FormControl component="fieldset" variant="standard">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={activedField}
                    onChange={(e) => setActivedField(e.target.checked)}
                  />
                }
                label="Actived"
              />
              <FormHelperText>
                Active users can sign in. Uncheck to deactivate.
              </FormHelperText>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel id="edit-roles-label">Roles</InputLabel>
              <Select
                labelId="edit-roles-label"
                value={rolesField || ""}
                onChange={(e) => {
                  setRolesField(String(e.target.value));
                }}
                input={<OutlinedInput label="Roles" />}
              >
                <MenuItem value={"ROLE_ADMIN"}>ROLE_ADMIN</MenuItem>
                <MenuItem value={"ROLE_USER"}>ROLE_USER</MenuItem>
              </Select>
              <FormHelperText>
                Select a single role for the user.
              </FormHelperText>
            </FormControl>
            <Autocomplete
              options={posOptions}
              getOptionLabel={(o: any) =>
                o?.name_point || String(o?.Id_point ?? "")
              }
              value={
                posOptions.find(
                  (p) =>
                    String(p?.Id_point) === String(psField) ||
                    String(p?.name_point) === String(psField)
                ) || null
              }
              onChange={(_e, value) => {
                if (!value) setPsField("");
                else setPsField(String(value.Id_point ?? value));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Point of Sale"
                  size="small"
                  fullWidth
                  helperText="Assign the point of sale for this user."
                />
              )}
            />
            <TextField
              label="Employee ref"
              value={refEmpField}
              onChange={(e) => setRefEmpField(e.target.value)}
              size="small"
              fullWidth
              helperText="Employee reference or ID (optional)."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditDialogOpen(false);
              setEditing(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              // call existing save logic; ensure editing is set
              try {
                await save();
              } finally {
                setEditDialogOpen(false);
                setEditing(null);
              }
            }}
            variant="contained"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
      <PermissionsDialog
        open={permissionsOpen}
        initial={
          permissionUser
            ? Array.isArray(permissionUser.Action_user)
              ? permissionUser.Action_user
              : Array.isArray(permissionUser.Roles)
                ? permissionUser.Roles
                : []
            : []
        }
        onClose={closePermissions}
        onSave={handleSavePermissions}
      />
      {/* Permissions picker for Edit dialog: returns selected array which we store as a comma-separated string in actionUser */}
      <PermissionsDialog
        open={permissionsPickerOpen}
        initial={
          actionUser
            ? Array.isArray(actionUser)
              ? actionUser
              : String(actionUser)
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
            : []
        }
        onClose={() => setPermissionsPickerOpen(false)}
        onSave={(selected: string[]) => {
          setActionUser(selected.join(", "));
          setPermissionsPickerOpen(false);
        }}
      />
    </Dialog>
  );
}
