import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Card, CardContent, CardHeader, Divider, IconButton, InputAdornment,
  TextField, Typography, Tabs, Tab, Button, Avatar, Chip, MenuItem, Select,
  FormControl, FormHelperText, Dialog, DialogTitle, DialogContent, DialogActions,
  LinearProgress, Tooltip, Stack, Alert, Snackbar, FormControlLabel, Switch, TextareaAutosize
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import PersonIcon from "@mui/icons-material/Person";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import CancelIcon from "@mui/icons-material/Cancel";
import Grid from '@mui/material/Grid';
import axios from "axios";

// DB-aligned type with all fields from your model
export type Employee = {
  ID_EMP?: number;
  NAME?: string;
  ADDRESS?: string;
  PHONE?: string;
  EMAIL?: string;
  COMMENT?: string;
  CONTRACT_START?: string;
  CONTRACT_END?: string;
  TITLE?: string;
  NATIONALITY?: string;
  NUM_OF_CHILDREN?: number;
  EMPLOYER_REF?: string;
  BANK?: number;
  INVESTMENT?: string;
  FINANCE_NUM?: string;
  TYPE_OF_RECRUITMENT?: string;
  DEGREE?: string;
  TYPE_OF_INSURANCE?: string;
  NUM_OF_INSURANCE?: string;
  ACCOUNT_NUMBER?: string;
  DATE_OF_BIRTH?: string;
  PICTURE?: any; // BLOB
  MARITAL_STATUS?: string;
  PLACE_OF_BIRTH?: string;
  NUM_CIN?: string;
  ISSUING_AUTH?: string;
  FAM_BOOK_NUM?: string;
  FAM_BOOK_ISSUING_AUTH?: string;
  PASSPORT_NUM?: string;
  PASSPORT_ISSUING_AUTH?: string;
  ANNUAL_LEAVE_BAL?: number;
  GENDER?: string;
  BLOOD_TYPE?: string;
  DRIVER_LIC_NUM?: string;
  NAME_ENGLISH?: string;
  SCIENTIFIC_CERT?: string;
  BASIC_SALARY?: number;
  STATE?: boolean;
  NUM_NATIONAL?: string;
  IS_FOREINGHT?: boolean;
  RENEWABLE_CONTRACT?: string;
  FINGERPRINT_NEEDED?: boolean;
  ATTACHED_NUMBER?: string;
  JOB_AIM?: string;
  JOB_DESCRIPTION?: string;
  JO_RELATION?: string;
  REQUEST_DEGREE?: string;
  PREFERRED_LANG?: string;
  COST_CENTER?: string;
  MEDICAL_COMMENT?: string;
  OUTFIT_NUM?: string;
  FOOTWEAR_NUM?: string;
  FOOD?: number;
  FUEL?: number;
  COMMUNICATION?: number;
  num_kid?: string;
  T_START?: string;
  T_END?: string;
  GOLD_COMM?: string;
  DIAMOND_COMM?: number;
  FOOD_ALLOWANCE?: number;
  GOLD_COMM_VALUE?: number;
  PS?: number;
  DIAMOND_COMM_TYPE?: string;
  PICTURE_URL?: string | null; // virtual from backend
};

const useApi = () => {
  const apiIp = process.env.REACT_APP_API_IP;
  const client = useMemo(() => {
    const instance = axios.create({ baseURL: `http://${apiIp}/employees` });
    instance.interceptors.request.use((config) => {
      const token = localStorage.getItem("token") || "";
      if (config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    return instance;
  }, [apiIp]);

  return { client };
};

const toMsg = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    const data = (err.response?.data as any) || {};
    return data?.message || err.response?.statusText || err.message || "Request failed";
  }
  return (err as any)?.message || "Something went wrong";
};

export default function EmployeeProfile() {
  const { client } = useApi();
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [tab, setTab] = useState(0);

  const [query, setQuery] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [edit, setEdit] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ 
    open: false, msg: "", severity: 'success' 
  });

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [costCenter, setCostCenter] = useState<string>("");

  // Delete confirmation dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

  const list = async (opts?: { state?: string; cost_center?: string; search?: string }) => {
    setListLoading(true);
    try {
      const params: any = {};
      if (opts?.state && opts.state !== "all") params.state = opts.state;
      if (opts?.cost_center) params.cost_center = opts.cost_center;
      if (opts?.search) params.search = opts.search;
      const res = await client.get("/", { params });
      setEmployees(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setSnack({ open: true, msg: toMsg(e), severity: 'error' });
    } finally {
      setListLoading(false);
    }
  };

  const refresh = () => list({ 
    state: statusFilter, 
    cost_center: costCenter || undefined, 
    search: query || undefined 
  });

  useEffect(() => { 
    list({ state: "all" }); 
  }, []); // eslint-disable-line

  const loadById = async (id: number | string) => {
    setLoading(true);
    try {
      const res = await client.get(`/${id}`);
      setSelected(res.data);
      setEdit(false); // Reset edit mode when loading new employee
    } catch (e) {
      setSnack({ open: true, msg: toMsg(e), severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!selected?.ID_EMP) return;
    setLoading(true);
    try {
      await client.put(`/${selected.ID_EMP}`, selected);
      setSnack({ open: true, msg: "Employee updated successfully", severity: 'success' });
      await loadById(selected.ID_EMP);
      await refresh();
      setEdit(false);
    } catch (e) {
      setSnack({ open: true, msg: toMsg(e), severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const activate = async (on: boolean) => {
    if (!selected?.ID_EMP) return;
    setLoading(true);
    try {
      await client.put(`/${selected.ID_EMP}`, { STATE: on });
      setSnack({ 
        open: true, 
        msg: on ? "Employee activated" : "Employee deactivated", 
        severity: 'success' 
      });
      await loadById(selected.ID_EMP);
      await refresh();
    } catch (e) {
      setSnack({ open: true, msg: toMsg(e), severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const renewContract = async () => {
    if (!selected?.ID_EMP) return;
    setLoading(true);
    try {
      await client.put(`/${selected.ID_EMP}`, { CONTRACT_END: selected.CONTRACT_END });
      setSnack({ open: true, msg: "Contract renewed successfully", severity: 'success' });
      await loadById(selected.ID_EMP);
    } catch (e) {
      setSnack({ open: true, msg: toMsg(e), severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Picture upload via base64 -> PUT /employees/:id { PICTURE_B64 }
  const [picOpen, setPicOpen] = useState(false);
  const [picFile, setPicFile] = useState<File | null>(null);

// uploadPicture (includes severity on success/error)
const uploadPicture = async () => {
  if (!selected?.ID_EMP || !picFile) return;

  const id = selected.ID_EMP;
  setLoading(true);
  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const result = String(reader.result ?? "");
          const comma = result.indexOf(",");
          resolve(comma >= 0 ? result.slice(comma + 1) : result);
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
      reader.readAsDataURL(picFile);
    });

    await client.put(`/${id}`, { PICTURE_B64: base64 });

    setPicOpen(false);
    setPicFile(null);
    setSnack({ open: true, msg: "Profile picture updated", severity: "success" });

    await loadById(id);
  } catch (e) {
    setSnack({ open: true, msg: toMsg(e), severity: "error" });
  } finally {
    setLoading(false);
  }
};

// when closing the dialog, preserve severity
// (so TS doesn't complain that it's missing)
<Dialog
  open={snack.open}
  onClose={() => setSnack((s) => ({ ...s, open: false }))}
/>

  // A minimal shape that your controller.create accepts
type NewEmployee = {
  NAME: string;
  STATE: boolean;
  TITLE: string | null;
  EMPLOYER_REF: string | null;
  EMAIL: string | null;
  PHONE: string | null;
  COST_CENTER: string | null;
  CONTRACT_START: string | null; // yyyy-mm-dd
  CONTRACT_END: string | null;   // yyyy-mm-dd
  BASIC_SALARY: number | null;
  NATIONALITY: string | null;
  MARITAL_STATUS: string | null;
  DEGREE: string | null;
  TYPE_OF_RECRUITMENT: string | null;
};

const [createOpen, setCreateOpen] = useState(false);
const [creating, setCreating] = useState(false);
const [newEmp, setNewEmp] = useState<NewEmployee>({
  NAME: "",
  STATE: true,
  TITLE: null,
  EMPLOYER_REF: null,
  EMAIL: null,
  PHONE: null,
  COST_CENTER: null,
  CONTRACT_START: null,
  CONTRACT_END: null,
  BASIC_SALARY: null,
  NATIONALITY: null,
  MARITAL_STATUS: null,
  DEGREE: null,
  TYPE_OF_RECRUITMENT: null,
});
const [createErrors, setCreateErrors] = useState<Record<string,string>>({});


  const deleteEmployee = async () => {
    if (!employeeToDelete?.ID_EMP) return;
    setLoading(true);
    try {
      await client.delete(`/${employeeToDelete.ID_EMP}`);
      setSnack({ open: true, msg: "Employee deleted successfully", severity: 'success' });
      setDeleteOpen(false);
      setEmployeeToDelete(null);
      // Clear selected if it was the deleted employee
      if (selected?.ID_EMP === employeeToDelete.ID_EMP) {
        setSelected(null);
      }
      await refresh();
    } catch (e) {
      setSnack({ open: true, msg: toMsg(e), severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // UI
  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: { xs: "block", md: "grid" }, gridTemplateColumns: { md: "1fr 2fr" }, gap: 2 }}>
        {/* Left Panel - Employee List */}
        <Card sx={{ height: "fit-content", display: "flex", flexDirection: "column" }}>
          <CardHeader
            title={
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography variant="h6">Employees ({employees.length})</Typography>
                {listLoading && <LinearProgress sx={{ flex: 1 }} />}
              </Stack>
            }
            action={
              <Stack direction="row" gap={1}>
                <Tooltip title="Create Employee">
                  <IconButton onClick={() => setCreateOpen(true)} color="primary">
                    <AddIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Refresh">
                  <IconButton onClick={refresh}>
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            }
          />
          <CardContent>
            <TextField
              size="small"
              fullWidth
              placeholder="Search by name, email, phone..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && refresh()}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <Button onClick={refresh} size="small">Search</Button>
                  </InputAdornment>
                ),
              }}
            />

            <Stack direction="row" gap={1} sx={{ my: 1, flexWrap: "wrap" }}>
              {["all","active","inactive"].map(s => (
                <Chip 
                  key={s} 
                  label={s.charAt(0).toUpperCase() + s.slice(1)}
                  color={statusFilter === s as any ? "primary" : "default"}
                  onClick={() => { 
                    setStatusFilter(s as any); 
                    list({ state: s, cost_center: costCenter || undefined, search: query || undefined }); 
                  }}
                />
              ))}
            </Stack>

            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <Select
                displayEmpty 
                value={costCenter}
                onChange={(e) => { 
                  const v = String(e.target.value); 
                  setCostCenter(v); 
                  list({ state: statusFilter, cost_center: v || undefined, search: query || undefined }); 
                }}
              >
                <MenuItem value=""><em>All cost centers</em></MenuItem>
                <MenuItem value="FIN">Finance</MenuItem>
                <MenuItem value="HR">Human Resources</MenuItem>
                <MenuItem value="OPS">Operations</MenuItem>
                <MenuItem value="SALES">Sales</MenuItem>
                <MenuItem value="IT">Information Technology</MenuItem>
              </Select>
              <FormHelperText>Filter by cost center</FormHelperText>
            </FormControl>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ maxHeight: 480, overflow: "auto", pr: 1 }}>
              {(employees ?? []).map((e) => (
                <Box 
                  key={e.ID_EMP} 
                  onClick={() => loadById(e.ID_EMP!)}
                  sx={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 1.5, 
                    p: 1, 
                    borderRadius: 1.5, 
                    cursor: "pointer", 
                    backgroundColor: selected?.ID_EMP === e.ID_EMP ? "action.selected" : "transparent",
                    "&:hover": { backgroundColor: "action.hover" }, 
                    mb: 0.5 
                  }}
                >
                  <Avatar src={e.PICTURE_URL || undefined} sx={{ width: 40, height: 40 }}>
                    {e.NAME?.[0]?.toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography noWrap fontWeight={600}>{e.NAME || 'Unnamed Employee'}</Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {e.TITLE || e.EMAIL || e.EMPLOYER_REF || 'No details'}
                    </Typography>
                  </Box>
                  <Box sx={{ ml: "auto" }}>
                    <Chip 
                      size="small" 
                      label={e.STATE ? "Active" : "Inactive"} 
                      color={e.STATE ? "success" : "default"} 
                    />
                  </Box>
                </Box>
              ))}
              {employees.length === 0 && !listLoading && (
                <Typography color="text.secondary" textAlign="center" sx={{ py: 2 }}>
                  No employees found
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Right Panel - Employee Details */}
        <Card>
          <CardHeader
            title={
              <Stack direction="row" alignItems="center" gap={2}>
                <Avatar src={selected?.PICTURE_URL || undefined} sx={{ width: 56, height: 56 }}>
                  {selected?.NAME?.[0]?.toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="h6">{selected?.NAME || "Select an employee"}</Typography>
                  {selected && (
                    <Typography variant="body2" color="text.secondary">
                      {selected.TITLE} • {selected.EMPLOYER_REF}
                    </Typography>
                  )}
                </Box>
              </Stack>
            }
            action={selected && (
              <Stack direction="row" gap={1}>
                <Tooltip title="Upload picture">
                  <span>
                    <IconButton onClick={() => setPicOpen(true)} disabled={!selected}>
                      <CloudUploadIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={selected?.STATE ? "Deactivate" : "Activate"}>
                  <IconButton onClick={() => activate(!selected?.STATE)}>
                    {selected?.STATE ? <PersonOffIcon /> : <PersonIcon />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={edit ? "Cancel edit" : "Edit"}>
                  <IconButton onClick={() => setEdit(v => !v)}>
                    {edit ? <CancelIcon /> : <EditIcon />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete employee">
                  <IconButton 
                    onClick={() => {
                      setEmployeeToDelete(selected);
                      setDeleteOpen(true);
                    }}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            )}
          />
          {loading && <LinearProgress />}

          <CardContent>
            {!selected ? (
              <Box textAlign="center" sx={{ py: 4 }}>
                <PersonIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography color="text.secondary" variant="h6">
                  Select an employee from the list to view their profile
                </Typography>
                <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
                  Or create a new employee to get started
                </Typography>
              </Box>
            ) : (
              <>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable">
                  <Tab label="Basic Info" />
                  <Tab label="Contact" />
                  <Tab label="Personal" />
                  <Tab label="Contract" />
                  <Tab label="Financial" />
                  <Tab label="Job Details" />
                  <Tab label="Documents" />
                  <Tab label="Allowances" />
                  <Tab label="Schedule" />
                </Tabs>

                {tab === 0 && <SectionBasic selected={selected} setSelected={setSelected} edit={edit} onSave={save} />}
                {tab === 1 && <SectionContact selected={selected} setSelected={setSelected} edit={edit} onSave={save} />}
                {tab === 2 && <SectionPersonal selected={selected} setSelected={setSelected} edit={edit} onSave={save} />}
                {tab === 3 && <SectionContract selected={selected} setSelected={setSelected} edit={edit} onSave={save} onRenew={renewContract} />}
                {tab === 4 && <SectionFinancial selected={selected} setSelected={setSelected} edit={edit} onSave={save} />}
                {tab === 5 && <SectionJob selected={selected} setSelected={setSelected} edit={edit} onSave={save} />}
                {tab === 6 && <SectionDocuments selected={selected} setSelected={setSelected} edit={edit} onSave={save} />}
                {tab === 7 && <SectionAllowances selected={selected} setSelected={setSelected} edit={edit} onSave={save} />}
                {tab === 8 && <SectionWorkSchedule selected={selected} setSelected={setSelected} edit={edit} onSave={save} />}
              </>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Upload picture dialog */}
      <Dialog open={picOpen} onClose={() => setPicOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Upload Profile Picture</DialogTitle>
        <DialogContent>
          <Button 
            component="label" 
            startIcon={<FileUploadIcon />}
            variant="outlined"
            fullWidth
            sx={{ mb: 2 }}
          >
            Select Image File
            <input 
              type="file" 
              hidden 
              accept="image/*" 
              onChange={(e) => setPicFile(e.target.files?.[0] || null)} 
            />
          </Button>
          {picFile && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Selected: {picFile.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Size: {(picFile.size / 1024).toFixed(1)} KB
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPicOpen(false)}>Cancel</Button>
          <Button 
            onClick={uploadPicture} 
            variant="contained" 
            disabled={!picFile} 
            startIcon={<CloudUploadIcon />}
          >
            Upload
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs">
        <DialogTitle>Delete Employee</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete employee "{employeeToDelete?.NAME}"? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button onClick={deleteEmployee} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Employee creation dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New Employee</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid container spacing={2}>
              <TextField
                label="Full Name *"
                value={newEmp.NAME}
                onChange={(e) => setNewEmp(s => ({ ...s, NAME: e.target.value }))}
                error={!!createErrors.NAME}
                helperText={createErrors.NAME}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid container spacing={2}>
              <TextField
                label="Employee Reference"
                value={newEmp.EMPLOYER_REF ?? ""}
                onChange={(e) => setNewEmp(s => ({ ...s, EMPLOYER_REF: e.target.value || null }))}
                size="small"
                fullWidth
              />
            </Grid>

            <Grid container spacing={2}>
              <TextField
                label="Title"
                value={newEmp.TITLE ?? ""}
                onChange={(e) => setNewEmp(s => ({ ...s, TITLE: e.target.value || null }))}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid container spacing={2}>
              <FormControl size="small" fullWidth>
                <Select
                  displayEmpty
                  value={newEmp.TYPE_OF_RECRUITMENT ?? ""}
                  onChange={(e) =>
                    setNewEmp(s => ({ ...s, TYPE_OF_RECRUITMENT: String(e.target.value) || null }))
                  }
                >
                  <MenuItem value=""><em>Recruitment Type</em></MenuItem>
                  <MenuItem value="Direct">Direct Hire</MenuItem>
                  <MenuItem value="Contract">Contract</MenuItem>
                  <MenuItem value="Temporary">Temporary</MenuItem>
                  <MenuItem value="Internship">Internship</MenuItem>
                </Select>
                <FormHelperText>Type of recruitment</FormHelperText>
              </FormControl>
            </Grid>

            <Grid container spacing={2}>
              <TextField
                label="Email"
                type="email"
                value={newEmp.EMAIL ?? ""}
                onChange={(e) => setNewEmp(s => ({ ...s, EMAIL: e.target.value || null }))}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid container spacing={2}>
              <TextField
                label="Phone"
                type="tel"
                value={newEmp.PHONE ?? ""}
                onChange={(e) => setNewEmp(s => ({ ...s, PHONE: e.target.value || null }))}
                size="small"
                fullWidth
              />
            </Grid>

            <Grid container spacing={2}>
              <FormControl size="small" fullWidth>
                <Select
                  displayEmpty
                  value={newEmp.COST_CENTER ?? ""}
                  onChange={(e) => setNewEmp(s => ({ ...s, COST_CENTER: String(e.target.value) || null }))}
                >
                  <MenuItem value=""><em>Cost Center</em></MenuItem>
                  <MenuItem value="FIN">Finance</MenuItem>
                  <MenuItem value="HR">Human Resources</MenuItem>
                  <MenuItem value="OPS">Operations</MenuItem>
                  <MenuItem value="SALES">Sales</MenuItem>
                  <MenuItem value="IT">Information Technology</MenuItem>
                </Select>
                <FormHelperText>Assign cost center</FormHelperText>
              </FormControl>
            </Grid>
            <Grid container spacing={2}>
              <TextField
                label="Contract Start"
                type="date"
                value={newEmp.CONTRACT_START ?? ""}
                onChange={(e) => setNewEmp(s => ({ ...s, CONTRACT_START: e.target.value || null }))}
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid container spacing={2}>
              <TextField
                label="Contract End"
                type="date"
                value={newEmp.CONTRACT_END ?? ""}
                onChange={(e) => setNewEmp(s => ({ ...s, CONTRACT_END: e.target.value || null }))}
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid container spacing={2}>
              <TextField
                label="Basic Salary"
                type="number"
                value={newEmp.BASIC_SALARY ?? ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setNewEmp(s => ({ ...s, BASIC_SALARY: v === "" ? null : Number(v) }));
                }}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid container spacing={2}>
              <TextField
                label="Nationality"
                value={newEmp.NATIONALITY ?? ""}
                onChange={(e) => setNewEmp(s => ({ ...s, NATIONALITY: e.target.value || null }))}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid container spacing={2}>
              <FormControl size="small" fullWidth>
                <Select
                  displayEmpty
                  value={newEmp.MARITAL_STATUS ?? ""}
                  onChange={(e) => setNewEmp(s => ({ ...s, MARITAL_STATUS: String(e.target.value) || null }))}
                >
                  <MenuItem value=""><em>Marital Status</em></MenuItem>
                  <MenuItem value="Single">Single</MenuItem>
                  <MenuItem value="Married">Married</MenuItem>
                  <MenuItem value="Divorced">Divorced</MenuItem>
                  <MenuItem value="Widowed">Widowed</MenuItem>
                </Select>
                <FormHelperText>Marital status</FormHelperText>
              </FormControl>
            </Grid>

            <Grid container spacing={2}>
              <TextField
                label="Degree"
                value={newEmp.DEGREE ?? ""}
                onChange={(e) => setNewEmp(s => ({ ...s, DEGREE: e.target.value || null }))}
                size="small"
                fullWidth
              />
            </Grid>

            <Grid container spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={!!newEmp.STATE}
                    onChange={(e) => setNewEmp(s => ({ ...s, STATE: e.target.checked }))}
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} startIcon={<CancelIcon />}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled={creating}
            onClick={async () => {
              // client-side minimal validation (NAME required)
              const errs: Record<string,string> = {};
              if (!newEmp.NAME.trim()) errs.NAME = "Name is required";
              setCreateErrors(errs);
              if (Object.keys(errs).length) return;

              setCreating(true);
              try {
                // POST /api/hr/employees  (baseURL already set)
                const res = await client.post("/", newEmp);

                setSnack({ open: true, msg: "Employee created successfully", severity: "success" });
                setCreateOpen(false);
                setNewEmp({
                  NAME: "",
                  STATE: true,
                  TITLE: null,
                  EMPLOYER_REF: null,
                  EMAIL: null,
                  PHONE: null,
                  COST_CENTER: null,
                  CONTRACT_START: null,
                  CONTRACT_END: null,
                  BASIC_SALARY: null,
                  NATIONALITY: null,
                  MARITAL_STATUS: null,
                  DEGREE: null,
                  TYPE_OF_RECRUITMENT: null,
                });

                await refresh();
                if (res.data?.ID_EMP != null) {
                  await loadById(res.data.ID_EMP);
                  setEdit(true); // jump into edit mode on the newly created record
                }
              } catch (e) {
                setSnack({ open: true, msg: toMsg(e), severity: "error" });
              } finally {
                setCreating(false);
              }
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>


      {/* Snackbar for notifications */}
      <Snackbar 
        open={snack.open} 
        autoHideDuration={6000} 
        onClose={() => setSnack(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnack(prev => ({ ...prev, open: false }))} 
          severity={snack.severity} 
          sx={{ width: '100%' }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// Helper Components
function Field({ 
  label, 
  value, 
  onChange, 
  disabled, 
  type = "text",
  multiline = false,
  rows = 1
}: { 
  label: string; 
  value: any; 
  onChange: (v: any) => void; 
  disabled?: boolean; 
  type?: React.InputHTMLAttributes<HTMLInputElement>["type"];
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <TextField 
      label={label} 
      value={value ?? ""} 
      onChange={(e) => onChange(e.target.value)} 
      disabled={disabled} 
      type={type} 
      size="small" 
      fullWidth 
      multiline={multiline}
      rows={rows}
    />
  );
}

function SectionWrapper({ 
  children, 
  onSave, 
  extra, 
  edit 
}: { 
  children: React.ReactNode; 
  onSave?: () => void; 
  extra?: React.ReactNode; 
  edit?: boolean;
}) {
  return (
    <Box>
      <Grid container spacing={2}>
        {children}
      </Grid>
      {edit && (
        <Stack direction="row" gap={1} justifyContent="flex-end" sx={{ mt: 3 }}>
          {extra}
          {onSave && (
            <Button 
              onClick={onSave} 
              variant="contained" 
              startIcon={<SaveIcon />}
            >
              Save Changes
            </Button>
          )}
        </Stack>
      )}
    </Box>
  );
}

// Section Components
function SectionBasic({ selected, setSelected, edit, onSave }: any) {
  return (
    <SectionWrapper onSave={edit ? onSave : undefined} edit={edit}>
      <Grid container spacing={2}>
        <Field 
          label="Full Name" 
          value={selected.NAME} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, NAME: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="English Name" 
          value={selected.NAME_ENGLISH} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, NAME_ENGLISH: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Employee Reference" 
          value={selected.EMPLOYER_REF} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, EMPLOYER_REF: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <FormControl fullWidth size="small" disabled={!edit}>
          <Select 
            value={selected.GENDER || ""} 
            onChange={(e) => setSelected({ ...selected, GENDER: String(e.target.value) })} 
            displayEmpty
          >
            <MenuItem value=""><em>Select Gender</em></MenuItem>
            <MenuItem value="Male">Male</MenuItem>
            <MenuItem value="Female">Female</MenuItem>
            <MenuItem value="Other">Other</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Address" 
          value={selected.ADDRESS} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, ADDRESS: v })} 
          multiline
          rows={2}
        />
      </Grid>
    </SectionWrapper>
  );
}

function SectionContact({ selected, setSelected, edit, onSave }: any) {
  return (
    <SectionWrapper onSave={edit ? onSave : undefined} edit={edit}>
      <Grid container spacing={2}>
        <Field 
          label="Email" 
          value={selected.EMAIL} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, EMAIL: v })}
          type="email" 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Phone" 
          value={selected.PHONE} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, PHONE: v })}
          type="tel" 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Comments" 
          value={selected.COMMENT} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, COMMENT: v })}
          multiline
          rows={3}
        />
      </Grid>
    </SectionWrapper>
  );
}

function SectionPersonal({ selected, setSelected, edit, onSave }: any) {
  return (
    <SectionWrapper onSave={edit ? onSave : undefined} edit={edit}>
      <Grid container spacing={2}>
        <Field 
          label="Date of Birth" 
          type="date" 
          value={selected.DATE_OF_BIRTH} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, DATE_OF_BIRTH: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Place of Birth" 
          value={selected.PLACE_OF_BIRTH} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, PLACE_OF_BIRTH: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Nationality" 
          value={selected.NATIONALITY} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, NATIONALITY: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <FormControl fullWidth size="small" disabled={!edit}>
          <Select 
            value={selected.MARITAL_STATUS || ""} 
            onChange={(e) => setSelected({ ...selected, MARITAL_STATUS: String(e.target.value) })} 
            displayEmpty
          >
            <MenuItem value=""><em>Marital Status</em></MenuItem>
            <MenuItem value="Single">Single</MenuItem>
            <MenuItem value="Married">Married</MenuItem>
            <MenuItem value="Divorced">Divorced</MenuItem>
            <MenuItem value="Widowed">Widowed</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Number of Children" 
          type="number" 
          value={selected.NUM_OF_CHILDREN} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, NUM_OF_CHILDREN: Number(v) })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Blood Type" 
          value={selected.BLOOD_TYPE} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, BLOOD_TYPE: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <FormControlLabel
          control={
            <Switch 
              checked={selected.IS_FOREINGHT || false} 
              onChange={(e) => setSelected({ ...selected, IS_FOREINGHT: e.target.checked })}
              disabled={!edit}
            />
          }
          label="Foreign Employee"
        />
      </Grid>
    </SectionWrapper>
  );
}

function SectionContract({ selected, setSelected, edit, onSave, onRenew }: any) {
  return (
    <SectionWrapper onSave={edit ? onSave : undefined} edit={edit} extra={
      <Button onClick={onRenew} variant="outlined">
        Renew Contract
      </Button>
    }>
      <Grid container spacing={2}>
        <Field 
          label="Contract Start Date" 
          type="date" 
          value={selected.CONTRACT_START} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, CONTRACT_START: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Contract End Date" 
          type="date" 
          value={selected.CONTRACT_END} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, CONTRACT_END: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Renewable Contract Date" 
          type="date" 
          value={selected.RENEWABLE_CONTRACT} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, RENEWABLE_CONTRACT: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <FormControl fullWidth size="small" disabled={!edit}>
          <Select 
            value={selected.TYPE_OF_RECRUITMENT || ""} 
            onChange={(e) => setSelected({ ...selected, TYPE_OF_RECRUITMENT: String(e.target.value) })} 
            displayEmpty
          >
            <MenuItem value=""><em>Recruitment Type</em></MenuItem>
            <MenuItem value="Direct">Direct Hire</MenuItem>
            <MenuItem value="Contract">Contract</MenuItem>
            <MenuItem value="Temporary">Temporary</MenuItem>
            <MenuItem value="Internship">Internship</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid container spacing={2}>
        <FormControlLabel
          control={
            <Switch 
              checked={selected.FINGERPRINT_NEEDED || false} 
              onChange={(e) => setSelected({ ...selected, FINGERPRINT_NEEDED: e.target.checked })}
              disabled={!edit}
            />
          }
          label="Fingerprint Required"
        />
      </Grid>
      <Grid container spacing={2}>
        <FormControlLabel
          control={
            <Switch 
              checked={selected.STATE || false} 
              onChange={(e) => setSelected({ ...selected, STATE: e.target.checked })}
              disabled={!edit}
            />
          }
          label="Active Employee"
        />
      </Grid>
    </SectionWrapper>
  );
}

function SectionFinancial({ selected, setSelected, edit, onSave }: any) {
  return (
    <SectionWrapper onSave={edit ? onSave : undefined} edit={edit}>
      <Grid container spacing={2}>
        <Field 
          label="Basic Salary" 
          type="number" 
          value={selected.BASIC_SALARY} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, BASIC_SALARY: Number(v) || 0 })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Cost Center" 
          value={selected.COST_CENTER} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, COST_CENTER: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Bank" 
          type="number" 
          value={selected.BANK} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, BANK: Number(v) || null })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Account Number" 
          value={selected.ACCOUNT_NUMBER} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, ACCOUNT_NUMBER: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Investment" 
          value={selected.INVESTMENT} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, INVESTMENT: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Finance Number" 
          value={selected.FINANCE_NUM} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, FINANCE_NUM: v })} 
        />
      </Grid>
    </SectionWrapper>
  );
}

function SectionJob({ selected, setSelected, edit, onSave }: any) {
  return (
    <SectionWrapper onSave={edit ? onSave : undefined} edit={edit}>
      <Grid container spacing={2}>
        <Field 
          label="Job Title" 
          value={selected.TITLE} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, TITLE: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Degree" 
          value={selected.DEGREE} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, DEGREE: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Scientific Certificate" 
          value={selected.SCIENTIFIC_CERT} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, SCIENTIFIC_CERT: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Attached Number" 
          value={selected.ATTACHED_NUMBER} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, ATTACHED_NUMBER: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Job Aim" 
          value={selected.JOB_AIM} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, JOB_AIM: v })}
          multiline
          rows={3}
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Job Description" 
          value={selected.JOB_DESCRIPTION} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, JOB_DESCRIPTION: v })}
          multiline
          rows={4}
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Job Relations" 
          value={selected.JO_RELATION} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, JO_RELATION: v })}
          multiline
          rows={2}
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Required Degree" 
          value={selected.REQUEST_DEGREE} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, REQUEST_DEGREE: v })}
          multiline
          rows={2}
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Preferred Languages" 
          value={selected.PREFERRED_LANG} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, PREFERRED_LANG: v })}
          multiline
          rows={2}
        />
      </Grid>
    </SectionWrapper>
  );
}

function SectionDocuments({ selected, setSelected, edit, onSave }: any) {
  return (
    <SectionWrapper onSave={edit ? onSave : undefined} edit={edit}>
      <Grid container spacing={2}>
        <Field 
          label="National ID Number" 
          value={selected.NUM_CIN} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, NUM_CIN: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="ID Issuing Authority" 
          value={selected.ISSUING_AUTH} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, ISSUING_AUTH: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="National Number" 
          value={selected.NUM_NATIONAL} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, NUM_NATIONAL: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Driver License Number" 
          value={selected.DRIVER_LIC_NUM} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, DRIVER_LIC_NUM: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Family Book Number" 
          value={selected.FAM_BOOK_NUM} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, FAM_BOOK_NUM: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Family Book Issuing Authority" 
          value={selected.FAM_BOOK_ISSUING_AUTH} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, FAM_BOOK_ISSUING_AUTH: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Passport Number" 
          value={selected.PASSPORT_NUM} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, PASSPORT_NUM: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Passport Issuing Authority" 
          value={selected.PASSPORT_ISSUING_AUTH} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, PASSPORT_ISSUING_AUTH: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Insurance Type" 
          value={selected.TYPE_OF_INSURANCE} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, TYPE_OF_INSURANCE: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Insurance Number" 
          value={selected.NUM_OF_INSURANCE} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, NUM_OF_INSURANCE: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Medical Comments" 
          value={selected.MEDICAL_COMMENT} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, MEDICAL_COMMENT: v })}
          multiline
          rows={3}
        />
      </Grid>
    </SectionWrapper>
  );
}

function SectionAllowances({ selected, setSelected, edit, onSave }: any) {
  return (
    <SectionWrapper onSave={edit ? onSave : undefined} edit={edit}>
      <Grid container spacing={2}>
        <Field 
          label="Food Allowance" 
          type="number" 
          value={selected.FOOD_ALLOWANCE} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, FOOD_ALLOWANCE: Number(v) || 0 })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Food" 
          type="number" 
          value={selected.FOOD} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, FOOD: Number(v) || 0 })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Fuel" 
          type="number" 
          value={selected.FUEL} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, FUEL: Number(v) || 0 })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Communication" 
          type="number" 
          value={selected.COMMUNICATION} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, COMMUNICATION: Number(v) || 0 })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Gold Commission" 
          value={selected.GOLD_COMM} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, GOLD_COMM: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Gold Commission Value" 
          type="number" 
          value={selected.GOLD_COMM_VALUE} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, GOLD_COMM_VALUE: Number(v) || 0 })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Diamond Commission" 
          type="number" 
          value={selected.DIAMOND_COMM} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, DIAMOND_COMM: Number(v) || 0 })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Diamond Commission Type" 
          value={selected.DIAMOND_COMM_TYPE} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, DIAMOND_COMM_TYPE: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Outfit Number" 
          value={selected.OUTFIT_NUM} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, OUTFIT_NUM: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Footwear Number" 
          value={selected.FOOTWEAR_NUM} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, FOOTWEAR_NUM: v })} 
        />
      </Grid>
    </SectionWrapper>
  );
}

function SectionWorkSchedule({ selected, setSelected, edit, onSave }: any) {
  return (
    <SectionWrapper onSave={edit ? onSave : undefined} edit={edit}>
      <Grid container spacing={2}>
        <Field 
          label="Start Time" 
          type="time" 
          value={selected.T_START} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, T_START: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="End Time" 
          type="time" 
          value={selected.T_END} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, T_END: v })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Annual Leave Balance" 
          type="number" 
          value={selected.ANNUAL_LEAVE_BAL} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, ANNUAL_LEAVE_BAL: Number(v) || 0 })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="PS" 
          type="number" 
          value={selected.PS} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, PS: Number(v) || null })} 
        />
      </Grid>
      <Grid container spacing={2}>
        <Field 
          label="Kid Number" 
          value={selected.num_kid} 
          disabled={!edit} 
          onChange={(v) => setSelected({ ...selected, num_kid: v })} 
        />
      </Grid>
    </SectionWrapper>
  );
}