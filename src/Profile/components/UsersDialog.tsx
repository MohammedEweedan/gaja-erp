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
  Switch,
  FormControlLabel,
  FormHelperText,
  Card,
  CardContent,
  CardActions,
  Avatar,
  IconButton,
  Tooltip,
  InputAdornment,
  Paper,
  TablePagination,
} from "@mui/material";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
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
import SendIcon from '@mui/icons-material/Send';
import axios from "../../api";
import PermissionsDialog, { AVAILABLE_ACTIONS } from "./PermissionsDialog";
import RolesDialog, { type Role } from "./RolesDialog";
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
  RoleUsers?: string;
  ps?: any;
  ref_emp?: string;
  [k: string]: any;
};

export default function UsersDialog() {
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [editing, setEditing] = React.useState<User | null>(null);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");

  const apiIp = process.env.REACT_APP_API_IP || "";

  const fetchUsers = React.useCallback(async () => {
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
      setUsers(all || []);
    } catch (e) {
      // fallback to local cache
      try {
        const raw = localStorage.getItem("usersLocalCache");
        if (raw) setUsers(JSON.parse(raw));
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [apiIp]);

  React.useEffect(() => {
    let mounted = true;
    fetchUsers().then(() => {
      if (!mounted) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [fetchUsers]);

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
  const [employees, setEmployees] = React.useState<any[]>([]);
  const [roleUsersField, setRoleUsersField] = React.useState<string>("");
  const [roleOptions, setRoleOptions] = React.useState<Role[]>([]);

  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: "success" | "error" | "info" | "warning" }>({
    open: false,
    message: "",
    severity: "info",
  });
  const [sendConfirm, setSendConfirm] = React.useState<{ open: boolean; email?: string; payload?: any }>({ open: false });
  const [dialogAlert, setDialogAlert] = React.useState<{ open: boolean; message: string; severity: "success" | "error" | "info" | "warning" }>({
    open: false,
    message: "",
    severity: "info",
  });

  const showSnackbar = (message: string, severity: "success" | "error" | "info" | "warning" = "info") => {
    setSnackbar({ open: true, message, severity });
  };

  const sendAccountEmail = async (email: string, data: any) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
      const parts: string[] = [];
      if (data?.name_user) parts.push(`Name: ${data.name_user}`);
      if (data?.name) parts.push(`Name: ${data.name}`);
      if (email) parts.push(`Email: ${email}`);
      if (data?.password) parts.push(`Password: ${data.password}`);
      if (data?.ps) parts.push(`PS: ${data.ps}`);
      const accountInfo = parts.join("\n");

      await axios.post(`${apiIp}/notification/sendAccountDetails`, {
        email,
        name: data?.name_user || data?.name,
        password: data?.password,
        ps: data?.ps,
        note: data?.note,
      }, {
        headers: { Authorization: token ? `Bearer ${token}` : undefined },
      });
      showSnackbar('Account details sent', 'success');
      setSendConfirm({ open: false });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || String(err);
      showSnackbar(`Failed to send email: ${msg}`, 'error');
      setSendConfirm({ open: false });
    }
  };

  const handleCloseSnackbar = (_: any, reason?: string) => {
    if (reason === "clickaway") return;
    setSnackbar((s) => ({ ...s, open: false }));
  };

  React.useEffect(() => {
    let mounted = true;
    const apiIpLocal = process.env.REACT_APP_API_IP || "";
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
    const headers = {
      Authorization: token ? `Bearer ${token}` : undefined,
    } as any;
    const mapEmployeesWithPos = (emps: any[], posOpts: any[]) => {
      if (!Array.isArray(emps)) return emps;
      try {
        return emps.map((emp) => {
          const empEmail = emp?.EMAIL || emp?.Email || emp?.email || emp?.MAIL || emp?.mail || null;
          if (!empEmail) return emp;
          const found = posOpts?.find?.((p: any) => String(p?.Email || "").toLowerCase() === String(empEmail).toLowerCase());
          if (found) {
            // attach canonical point id and name to employee for easier use in UI
            return { ...emp, __matched_ps: String(found.Id_point), __matched_ps_name: found.name_point };
          }
          return emp;
        });
      } catch (err) {
        return emps;
      }
    };
    // Fetch POS first then employees to ensure mapping by email works reliably.
    const fetchPOS = async () => {
      try {
        const res = await axios.get(`${apiIpLocal}/ps/all`, { headers });
        if (mounted && Array.isArray(res?.data)) {
          setPosOptions(res.data);
          return res.data;
        }
      } catch (e) {
        // ignore
      }
      return [] as any[];
    };
    const fetchEmployees = async (posList?: any[]) => {
      try {
        const res = await axios.get(`${apiIpLocal}/employees/`, { headers });
        if (mounted && Array.isArray(res?.data)) {
          const posToUse = Array.isArray(posList) && posList.length > 0 ? posList : posOptions;
          const mapped = mapEmployeesWithPos(res.data, posToUse);
          setEmployees(mapped);
        }
      } catch (e) {
        // ignore
      }
    };
    (async () => {
      const pos = await fetchPOS();
      try {
        await new Promise((r) => setTimeout(r, 50));
      } catch {}
      await fetchEmployees(pos);
    })();
    const fetchRoles = async () => {
      try {
        const res = await axios.get(`/roles`);
        if (mounted && Array.isArray(res?.data)) {
          setRoleOptions(res.data as Role[]);
        }
      } catch (e) {
        // ignore
      }
    };
    fetchRoles();
    return () => {
      mounted = false;
    };
  }, []);

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
    setRoleUsersField("");
    setPsField("");
    setRefEmpField("");
    setEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditDialogOpen(false);
    setEditing(null);
    setIdUser(undefined);
    setNameUserField("");
    setName("");
    setEmail("");
    setPasswordField("");
    setActionUser("");
    setActivedField(true);
    setRolesField("");
    setRoleUsersField("");
    setPsField("");
    setRefEmpField("");
    setDialogAlert({ open: false, message: "", severity: "info" });
  };

  // filters
  const [activedFilter, setActivedFilter] = React.useState<
    "all" | "active" | "inactive"
  >("all");

  // new filters: search by name/email, filter by role, filter by point of sale
  const [searchText, setSearchText] = React.useState<string>("");
  const [roleFilter, setRoleFilter] = React.useState<string>("all");
  const [psFilter, setPsFilter] = React.useState<string>("all");

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
  const [rolesDialogOpen, setRolesDialogOpen] = React.useState(false);

  // pagination
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState<number>(6);

  const toggleShowPassword = (key: string) => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const generatePassword = (length = 12) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let pw = '';
    for (let i = 0; i < length; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
    return pw;
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = parseInt(event.target.value, 10);
    setRowsPerPage(value);
    setPage(0);
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
    setRoleUsersField(String(u?.RoleUsers ?? ""));
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
        permissionUser?.id_user  
    
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
    // returns true on success, false on error (so caller can decide to close dialog)
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
      Roles: rolesField || undefined,
      RoleUsers: roleUsersField || undefined,
      ps: psField || undefined,
      ref_emp: refEmpField || undefined,
    };

    // clear previous dialog alert
    setDialogAlert({ open: false, message: "", severity: "info" });

    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : "";
      let resultUser: any = null;
      if (editing) {
        // attempt update
        const targetId =
          editing?.id_user ;
        await axios.put(`${apiIp}/users/${targetId}`, payload, {
          headers: { Authorization: token ? `Bearer ${token}` : undefined },
        });
        const newUsers = users.map((x) =>
          String(x?.id_user) === String(targetId)
            ? { ...x, ...payload }
            : x
        );
        setUsers(newUsers);
        resultUser = { ...(payload || {}), id_user: targetId };
        try {
          localStorage.setItem("usersLocalCache", JSON.stringify(newUsers));
        } catch {}
        // Refetch to ensure server state
        await fetchUsers();
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
        resultUser = created;
        try {
          localStorage.setItem("usersLocalCache", JSON.stringify(newUsers));
        } catch {}
      }

      // success: clear form state
      setEditing(null);
      setIdUser(undefined);
      setNameUserField("");
      setName("");
      setEmail("");
      setPasswordField("");
      setActionUser("");
      setActivedField(true);
      setRolesField("");
      setRoleUsersField("");
      setPsField("");
      setRefEmpField("");
      // prompt to send account details via email if we created/updated a user with an email
      if (resultUser && (resultUser.email || resultUser.EMAIL || payload?.email)) {
        const userEmail = resultUser.email || resultUser.EMAIL || payload?.email;
        // include password if present in payload (may be undefined)
        setSendConfirm({ open: true, email: String(userEmail), payload: { ...resultUser, password: payload.password } });
      }
      return resultUser || true;
    } catch (e: any) {
      // surface error for debugging and show both toast and inline dialog alert
      try {
        // eslint-disable-next-line no-console
        console.error("Save user error:", e);
        const message = e && e.response ? (e.response?.data?.message || JSON.stringify(e.response?.data)) : (e?.message || String(e));
        // show toast
        try { showSnackbar(message, "error"); } catch {}
        // show inline alert in dialog
        try { setDialogAlert({ open: true, message, severity: "error" }); } catch {}
      } catch (logErr) {
        // ignore logging errors
      }

      // on error, still perform local fallback so UI remains responsive
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
      // keep dialog open and do not clear form fields so user can fix errors
      return false;
    }
  };

  // apply filters once so we can paginate the result
  const filteredUsers = React.useMemo(
    () =>
      users.filter((u) => {
        const isActive = Boolean(
          u?.actived ?? u?.Actived ?? u?.active ?? false
        );
        if (activedFilter === "active" && !isActive) return false;
        if (activedFilter === "inactive" && isActive) return false;

        // search by name or email
        if (searchText && String(searchText).trim() !== "") {
          const q = String(searchText).toLowerCase();
          const nameVal = String(u?.name_user ?? u?.name ?? u?.username ?? "").toLowerCase();
          const emailVal = String(u?.email ?? u?.EMAIL ?? u?.Email ?? "").toLowerCase();
          if (!nameVal.includes(q) && !emailVal.includes(q)) return false;
        }

        // filter by role (RoleUsers, Roles, RoleUsers string)
        if (roleFilter && roleFilter !== "all") {
          const rolesArr: string[] = [];
          if (Array.isArray(u?.Roles)) rolesArr.push(...(u.Roles as string[]));
          if (typeof u?.Roles === "string" && u.Roles) rolesArr.push(...String(u.Roles).split(",").map((s) => s.trim()));
          if (u?.RoleUsers) rolesArr.push(...String(u.RoleUsers).split(",").map((s) => s.trim()));
          const hasRole = rolesArr.map((r) => String(r).toLowerCase()).includes(String(roleFilter).toLowerCase());
          if (!hasRole) return false;
        }

        // filter by point of sale
        if (psFilter && psFilter !== "all") {
          // match by canonical id (u.ps) or by resolving u.ps -> posOptions
          const userPs = String(u?.ps ?? u?.PS ?? "");
          if (userPs && String(userPs) === String(psFilter)) {
            // match
          } else {
            // try to resolve user's ps via posOptions
            const foundPos = posOptions.find(
              (p) => String(p?.Id_point) === String(userPs) || String(p?.name_point).toLowerCase() === String(userPs).toLowerCase()
            );
            if (foundPos) {
              if (String(foundPos.Id_point) !== String(psFilter)) return false;
            } else {
              // user's ps not matching and cannot resolve - no match
              return false;
            }
          }
        }

        return true;
      }),
    [users, activedFilter, searchText, roleFilter, psFilter, posOptions]
  );

  // keep current page in range when filters or page size change
  React.useEffect(() => {
    if (rowsPerPage <= 0) {
      if (page !== 0) setPage(0);
      return;
    }
    const maxPage = Math.max(
      0,
      Math.ceil(filteredUsers.length / rowsPerPage) - 1
    );
    if (page > maxPage) setPage(maxPage);
  }, [filteredUsers.length, rowsPerPage, page]);

  const pagedUsers = React.useMemo(() => {
    if (rowsPerPage <= 0) return filteredUsers;
    const start = page * rowsPerPage;
    return filteredUsers.slice(start, start + rowsPerPage);
  }, [filteredUsers, page, rowsPerPage]);

  return (
    <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto" }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Manage Users
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View and manage application users, roles, and permissions.
        </Typography>
      </Box>
      <Paper variant="outlined" sx={{ p: 2 }}>
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

          <TextField
            size="small"
            placeholder="Search name or email"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            sx={{ ml: 1, minWidth: 220 }}
          />

          <FormControl size="small" sx={{ minWidth: 160, ml: 1 }}>
            <InputLabel id="role-filter-label">Role</InputLabel>
            <Select
              labelId="role-filter-label"
              value={roleFilter}
              label="Role"
              onChange={(e) => setRoleFilter(String(e.target.value))}
            >
              <MenuItem value="all">All</MenuItem>
              {roleOptions.map((r) => (
                <MenuItem key={r.name} value={r.name}>
                  {r.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180, ml: 1 }}>
            <InputLabel id="ps-filter-label">PS</InputLabel>
            <Select
              labelId="ps-filter-label"
              value={psFilter}
              label="PS"
              onChange={(e) => setPsFilter(String(e.target.value))}
            >
              <MenuItem value="all">All</MenuItem>
              {posOptions.map((p) => (
                <MenuItem key={String(p?.Id_point)} value={String(p?.Id_point)}>
                  {p?.name_point || p?.Id_point}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            startIcon={<PersonIcon />}
            onClick={() => setRolesDialogOpen(true)}
            size="small"
            variant="outlined"
            sx={{ ml: "auto" }}
          >
            Roles List
          </Button>

          
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
          {filteredUsers.length === 0 && !loading && (
            <Box>
              <Typography
                variant="body2"
                sx={{ p: 1, color: "text.secondary" }}
              >
                No users found
              </Typography>
            </Box>
          )}

          {pagedUsers.map((u) => (
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
                      {(() => {
                        const emp = employees.find(
                          (e: any) =>
                            String(e?.ref_emp ?? e?.ID_EMP ?? "") ===
                            String(u?.ref_emp ?? "")
                        );
                        const empName = emp?.NAME || emp?.name || "";
                        const displayName =
                          empName ||
                          u?.name_user ||
                          u?.name ||
                          u?.username ||
                          "(no name)";
                        const initial = displayName
                          ? String(displayName).charAt(0).toUpperCase()
                          : "";
                        return (
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
                              {displayName ? initial : <PersonIcon />}
                            </Avatar>
                            <Typography variant="subtitle2">
                              {displayName}
                              {u?.ref_emp
                                ? ` (${String(u.ref_emp)})`
                                : ""}
                            </Typography>
                          </Box>
                        );
                      })()}
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
                          Role Users:
                        </Box>
                        <Box component="span">{String(u?.RoleUsers ?? "")}</Box>
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
                    startIcon={<SendIcon />}
                    onClick={() => {
                      const userEmail = u?.email || u?.EMAIL || u?.Email;
                      if (!userEmail) {
                        try { showSnackbar('User has no email', 'info'); } catch {};
                        return;
                      }
                      setSendConfirm({ open: true, email: String(userEmail), payload: { ...u, password: u?.password } });
                    }}
                    sx={{ mb: 1 }}
                  >
                    Send
                  </Button>
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

        <TablePagination
          component="div"
          count={filteredUsers.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage > 0 ? rowsPerPage : filteredUsers.length}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[6, 20, 50, { label: "All", value: -1 }]}
        />

        {/* footer form hidden - editing is done in the separate Edit dialog */}
      </Paper>
      {/* Edit dialog opened via the Delete button (shows edit form) */}
      <Dialog
        open={editDialogOpen}
        onClose={() => {
          closeEditDialog();
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{editing ? "Edit user" : "Add user"}</DialogTitle>
        <DialogContent>
          {dialogAlert.open && (
            <MuiAlert severity={dialogAlert.severity} sx={{ mb: 1 }}>
              {dialogAlert.message}
            </MuiAlert>
          )}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
            <Autocomplete
              options={employees}
              getOptionLabel={(o: any) => {
                // Display only the employee name in the input when selected.
                return o?.NAME || o?.name || String(o?.ref_emp ?? o?.ID_EMP ?? "");
              }}
              isOptionEqualToValue={(option, value) =>
                String(option?.ref_emp ?? option?.ID_EMP ?? "") ===
                String(value?.ref_emp ?? value?.ID_EMP ?? "")
              }
              value={
                employees.find(
                  (e: any) =>
                    String(e?.ref_emp ?? e?.ID_EMP ?? "") ===
                    String(refEmpField || "")
                ) || null
              }
              onChange={(_e, value) => {
                if (!value) {
                  setRefEmpField("");
                } else {
                  setRefEmpField(String(value.ref_emp ?? value.ID_EMP ?? ""));
                  const mail =
                    (value as any).EMAIL ||
                    (value as any).Email ||
                    (value as any).email ||
                    (value as any).MAIL ||
                    (value as any).mail;
                  if (mail) setEmail(String(mail));
                  const empName = value?.NAME || value?.name || value?.FullName || value?.full_name;
                  if (empName) {
                    setNameUserField(String(empName));
                    setName(String(empName));
                  }
                  // Prioritize mapped PS attached during fetch
                  const mappedPsId = (value as any).__matched_ps;
                  const mappedPsName = (value as any).__matched_ps_name;
                  if (mappedPsId) {
                    setPsField(String(mappedPsId));
                  } else if (mappedPsName) {
                    try {
                      const foundByName = posOptions.find(
                        (p) => String(p?.name_point).toLowerCase() === String(mappedPsName).toLowerCase()
                      );
                      if (foundByName) setPsField(String(foundByName.Id_point));
                      else setPsField(String(mappedPsName));
                    } catch {
                      setPsField(String(mappedPsName));
                    }
                  } else {
                    // set point of sale from employee if available
                    const empPsVal = value?.PS || value?.ps || value?.PS_ID || value?.Id_point || value?.POS || value?.pos || value?.PSId || null;
                    // also consider matching by employee email when no PS field present
                    const empEmail = mail || email || null;
                    if (empPsVal != null) {
                      // try to find matching posOptions entry and set the canonical Id_point
                      try {
                        const found = posOptions.find(
                          (p) => String(p?.Id_point) === String(empPsVal) || String(p?.name_point).toLowerCase() === String(empPsVal).toLowerCase()
                        );
                        if (found) setPsField(String(found.Id_point));
                        else setPsField(String(empPsVal));
                      } catch {
                        setPsField(String(empPsVal));
                      }
                    } else if (empEmail) {
                      try {
                        const foundByEmail = posOptions.find(
                          (p) => String(p?.Email || "").toLowerCase() === String(empEmail).toLowerCase()
                        );
                        if (foundByEmail) setPsField(String(foundByEmail.Id_point));
                      } catch {
                        // ignore
                      }
                    }
                  }
                }
              }}
              renderOption={(props, option) => {
                const name = option?.NAME || option?.name || String(option?.ref_emp ?? option?.ID_EMP ?? "");
                const emailOpt = option?.EMAIL || option?.Email || option?.email || option?.MAIL || option?.mail || "";
                  const empPs =
                    option?.PS || option?.ps || option?.PS_ID || option?.Id_point || option?.POS || option?.pos || option?.PSId || option?.IdPoint || option?.Idpoint || option?.point || option?.point_id || option?.Point || option?.PointOfSale || option?.pos_name || option?.POS_ID || "";
                  const optEmail = option?.EMAIL || option?.Email || option?.email || option?.MAIL || option?.mail || "";
                  const posByEmp = posOptions.find(
                    (p) => String(p?.Id_point) === String(empPs) || String(p?.name_point) === String(empPs)
                  );
                  const posByEmail = optEmail
                    ? posOptions.find((p) => String(p?.Email || "").toLowerCase() === String(optEmail).toLowerCase())
                    : undefined;
                  const posName = (posByEmp || posByEmail)?.name_point;
                return (
                  <li {...props}>
                    <Box sx={{ display: "flex", flexDirection: "column" }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{name}</Typography>
                      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                        {emailOpt ? (
                          <Typography variant="caption" color="text.secondary">
                            {String(emailOpt)}
                          </Typography>
                        ) : null}
                        {posName ? (
                          <Typography variant="caption" color="text.secondary">
                            {posName}
                          </Typography>
                        ) : empPs ? (
                          <Typography variant="caption" color="text.secondary">
                            {String(empPs)}
                          </Typography>
                        ) : null}
                      </Box>
                    </Box>
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Employee"
                  size="small"
                  fullWidth
                  helperText="Select employee; ref will be stored."
                />
              )}
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
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          const pw = generatePassword(12);
                          setPasswordField(pw);
                          try { showSnackbar('Password generated', 'info'); } catch {}
                        }}
                      >
                        Generate
                      </Button>
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
                    </Box>
                  </InputAdornment>
                ),
              }}
            />



            <Autocomplete
              options={roleOptions}
              getOptionLabel={(o: Role) => o?.name || ""}
              value={
                roleOptions.find((r) => r.name === roleUsersField) || null
              }
              onChange={(_e, value) => {
                if (!value) {
                  setRoleUsersField("");
                  setActionUser("");
                } else {
                  setRoleUsersField(value.name || "");
                  setActionUser(value.permissions || "");
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="RoleUsers"
                  size="small"
                  fullWidth
                  helperText="Choose role from RolesTB for this user."
                />
              )}
            />



            <TextField
              label="Permissions"
              value={actionUser}
              onChange={(e) => setActionUser(e.target.value)}
              size="small"
              fullWidth
              multiline
              rows={3}
              helperText="Comma-separated permissions. Click 'Edit permissions' to pick."
              InputProps={{
                readOnly: true,
                
              }}
            />
            
            <FormControl component="fieldset" variant="standard">
              <FormControlLabel
                control={
                  <Switch
                    checked={activedField}
                    onChange={(e) => setActivedField(e.target.checked)}
                    size="small"
                    color="primary"
                  />
                }
                label={activedField ? "Enabled" : "Disabled"}
              />
              <FormHelperText>
                Active users can sign in. Uncheck to deactivate.
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditDialog}>Cancel</Button>
          <Button
            onClick={async () => {
              // call save and only close dialog on success
              const ok = await save();
              if (ok) {
                setEditDialogOpen(false);
                setEditing(null);
                setDialogAlert({ open: false, message: "", severity: "info" });
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
      <RolesDialog open={rolesDialogOpen} onClose={() => setRolesDialogOpen(false)} />
      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={handleCloseSnackbar}>
        <MuiAlert onClose={handleCloseSnackbar} severity={snackbar.severity} elevation={6} variant="filled">
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
      <Snackbar
        open={Boolean(sendConfirm.open)}
        onClose={() => setSendConfirm({ open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ top: '50%', transform: 'translateY(-50%)' }}
      >
        <Paper elevation={6} sx={{ p: 3, minWidth: 560, maxWidth: '92%', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
          <Typography variant="h6" sx={{ textAlign: 'center' }}>
            {sendConfirm.email ? `Send account details to ${sendConfirm.email}?` : 'Send account details?'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              onClick={() => {
                if (sendConfirm.email) sendAccountEmail(sendConfirm.email, sendConfirm.payload);
                else setSendConfirm({ open: false });
              }}
            >
              Send
            </Button>
            <Button variant="outlined" onClick={() => setSendConfirm({ open: false })}>
              Cancel
            </Button>
          </Box>
        </Paper>
      </Snackbar>
    </Box>
  );
}
