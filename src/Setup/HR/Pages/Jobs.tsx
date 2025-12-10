import { useEffect, useState, useMemo } from "react";
import axios from "../../../api";
import { useNavigate } from "react-router-dom";

import {
  ThemeProvider,
  createTheme,
  Box,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  CssBaseline,
  Divider,
  Typography,
  Paper,
  Stack,
  Checkbox,
  FormControlLabel,
} from "@mui/material";

import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import ImportExportIcon from "@mui/icons-material/ImportExport";

import * as XLSX from "xlsx";

import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";

type Job = {
  id_job: number;
  job_name: string;
  Job_title: string;
  Job_code: string;
  job_categories: string;
  NBR_YEAR_FOR_JOB: number;

  // Extended fields for new requirements
  department?: string;
  commissionGold?: number;
  commissionDiamond?: number;
  commissionWatches?: number;
  assignedEmployeeId?: number | null;
  managerId?: number | null;
};

type JobTemplate = {
  id: number;
  job_name: string;
  Job_title: string;
  Job_code?: string;
};

const theme = createTheme();

const jobTemplates: JobTemplate[] = [
  { id: 1, job_name: "Sales Manager", Job_title: "Sales Manager" },
  { id: 2, job_name: "Sales Rep", Job_title: "Sales Rep" },
  { id: 3, job_name: "Sales Lead", Job_title: "Sales Lead" },
  { id: 4, job_name: "Jr.Sales Rep", Job_title: "Jr.Sales Rep" },
  { id: 5, job_name: "Accountant", Job_title: "Accountant" },
  { id: 6, job_name: "Sr.Accountant", Job_title: "Sr.Accountant" },
  { id: 7, job_name: "Marketing Manager", Job_title: "Marketing Manager" },
  { id: 8, job_name: "Marketing Assistant", Job_title: "Marketing Assistant" },
  { id: 9, job_name: "Operation Manager", Job_title: "Operation Manager" },
  { id: 10, job_name: "HR Manager", Job_title: "HR Manager" },
  { id: 11, job_name: "CEO", Job_title: "CEO" },
  { id: 12, job_name: "Chairman", Job_title: "Chairman" },
  { id: 13, job_name: "IT Support", Job_title: "IT Support" },
  { id: 14, job_name: "Cleaner", Job_title: "Cleaner" },
  { id: 15, job_name: "Marketing Specialist", Job_title: "Marketing Specialist" },
  { id: 16, job_name: "Marketing Officer", Job_title: "Marketing Officer" },
  { id: 17, job_name: "photographer", Job_title: "photographer" },
  {
    id: 18,
    job_name: "Customer Support Representative and Warehouse Coordinator",
    Job_title: "Customer Support Representative and Warehouse Coordinator",
  },
  { id: 19, job_name: "Accounting Manager", Job_title: "Accounting Manager" },
  { id: 20, job_name: "Liaison Officer", Job_title: "Liaison Officer" },
  { id: 21, job_name: "Graphic Designer", Job_title: "Graphic Designer" },
  { id: 22, job_name: "Cleaner", Job_title: "Cleaner", Job_code: "101" },
  { id: 23, job_name: "Cleaner", Job_title: "Cleaner" },
  { id: 24, job_name: "Cleaner", Job_title: "Cleaner", Job_code: "101" },
  { id: 25, job_name: "Accountant", Job_title: "Accountant", Job_code: "120" },
];

const initialJobState: Job = {
  id_job: 0,
  job_name: "",
  Job_title: "",
  Job_code: "",
  job_categories: "",
  NBR_YEAR_FOR_JOB: 65,
  department: "",
  commissionGold: 0,
  commissionDiamond: 0,
  commissionWatches: 0,
  assignedEmployeeId: null,
  managerId: null,
};

const jobCategories = ["إدارية", "إشرافية", "حرفية و خدمية", "فنية"];

const departmentOptions = [
  "Sales",
  "Marketing",
  "Operations",
  "HR",
  "Accounting",
  "Management",
  "IT",
  "Warehouse",
  "Customer Support",
  "Cleaning",
  "Other",
];

type EmployeeLite = { ID_EMP?: number; NAME?: string; TITLE?: string | null };

const Jobs = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const accent: string =
    (theme.palette as any)?.gaja?.[100] || theme.palette.primary.main;
  const accent2: string =
    (theme.palette as any)?.gaja?.[200] || theme.palette.primary.light;

  const [data, setData] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const navigate = useNavigate();
  const apiUrl = "/jobs";
  const [employeesByTitle, setEmployeesByTitle] = useState<
    Record<string, EmployeeLite[]>
  >({});
  const [empDialogOpen, setEmpDialogOpen] = useState(false);
  const [empDialogTitle, setEmpDialogTitle] = useState<string>("");
  const [empDialogList, setEmpDialogList] = useState<EmployeeLite[]>([]);
  const [autoAssignManager, setAutoAssignManager] = useState(true);

  const fetchData = async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/login");

    try {
      const response = await axios.get<Job[]>(`${apiUrl}/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const jobs = Array.isArray(response.data)
        ? response.data
        : (response as any).data?.data || [];
      setData(jobs);

      const empRes = await axios.get(
        `${process.env.REACT_APP_API_IP}/employees`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const employees: EmployeeLite[] = Array.isArray(empRes.data)
        ? empRes.data
        : empRes.data?.data || [];
      const map: Record<string, EmployeeLite[]> = {};
      employees.forEach((e) => {
        const t = (e.TITLE || "").trim();
        if (!t) return;
        if (!map[t]) map[t] = [];
        map[t].push({ ID_EMP: e.ID_EMP, NAME: e.NAME, TITLE: e.TITLE });
      });
      setEmployeesByTitle(map);
    } catch (error: any) {
      if (error.response?.status === 401) navigate("/login");
      else alert(t("common.loadError", "Error loading data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [navigate]);

  const allEmployees: EmployeeLite[] = useMemo(
    () => Object.values(employeesByTitle).flat(),
    [employeesByTitle]
  );

  const isSalesRole = useMemo(() => {
    const title = (editJob?.Job_title || "").trim();
    return (
      title === "Sales Rep" ||
      title === "Sales Lead" ||
      title === "Sales Manager"
    );
  }, [editJob?.Job_title]);

  const managerCandidate = useMemo(() => {
    if (!autoAssignManager || !editJob?.department) return null;

    const titleMap: Record<string, string> = {
      Sales: "Sales Manager",
      Marketing: "Marketing Manager",
      Operations: "Operation Manager",
      HR: "HR Manager",
      Accounting: "Accounting Manager",
      IT: "IT Support",
      Cleaning: "Cleaner",
      Warehouse: "Operation Manager",
      "Customer Support":
        "Customer Support Representative and Warehouse Coordinator",
    };

    const managerTitle = titleMap[editJob.department];
    if (!managerTitle) return null;
    const list = employeesByTitle[managerTitle] || [];
    return list[0] || null;
  }, [autoAssignManager, editJob?.department, employeesByTitle]);

  const handleEdit = (row: Job) => {
    setEmpDialogTitle(`${row.Job_title} — ${row.job_name}`);
    setEmpDialogList(employeesByTitle[row.Job_title] || []);
    setEmpDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditJob(initialJobState);
    setIsEditMode(false);
    setErrors({});
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditJob(null);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: any = {};
    if (!editJob?.job_name)
      newErrors.job_name = t(
        "hr.jobs.required.job_name",
        "Job Name is required"
      );
    if (!editJob?.Job_title)
      newErrors.Job_title = t(
        "hr.jobs.required.Job_title",
        "Job Title is required"
      );
    if (!editJob?.Job_code)
      newErrors.Job_code = t(
        "hr.jobs.required.Job_code",
        "Job Code is required"
      );
    if (!editJob?.job_categories)
      newErrors.job_categories = t(
        "hr.jobs.required.job_categories",
        "Category is required"
      );
    if (!editJob?.NBR_YEAR_FOR_JOB)
      newErrors.NBR_YEAR_FOR_JOB = t(
        "hr.jobs.required.NBR_YEAR_FOR_JOB",
        "Years required"
      );

    if (isSalesRole) {
      if (!editJob?.department) {
        newErrors.department = t(
          "hr.jobs.required.department",
          "Department is required"
        );
      }
      if (editJob?.assignedEmployeeId == null) {
        newErrors.assignedEmployeeId = t(
          "hr.jobs.required.assignedEmployeeId",
          "Please choose an employee to assign this position to"
        );
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !editJob) return;
    const token = localStorage.getItem("token");

    try {
      const basePayload: any = {
        job_name: editJob.job_name,
        year_job: editJob.NBR_YEAR_FOR_JOB,
        job_degree: 1,
        job_level: "1",
        job_title: editJob.Job_title,
        job_code: editJob.Job_code,
        job_categories: editJob.job_categories,
      };

      if (isSalesRole) {
        basePayload.department = editJob.department || null;
        basePayload.commission_gold = editJob.commissionGold ?? 0;
        basePayload.commission_diamond = editJob.commissionDiamond ?? 0;
        basePayload.commission_watches = editJob.commissionWatches ?? 0;
        basePayload.employee_id = editJob.assignedEmployeeId ?? null;
        basePayload.manager_id = managerCandidate?.ID_EMP ?? null;
      }

      if (isEditMode) {
        alert("Edit not supported yet");
        return;
      } else {
        await axios.post(`${apiUrl}/job`, basePayload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      await fetchData();
      handleCloseDialog();
    } catch (error: any) {
      alert(error.response?.data?.message || "Save failed");
    }
  };

  const handleDelete = async (_row: Job) => {
    alert("Delete is not supported yet");
  };

  const openEmployees = (job: Job) => {
    const list = employeesByTitle[job.Job_title] || [];
    setEmpDialogTitle(`${job.Job_title} — ${job.job_name}`);
    setEmpDialogList(list);
    setEmpDialogOpen(true);
  };

  const handleJobTemplateChange = (value: string) => {
    const template = jobTemplates.find(
      (j) => j.Job_title === value || j.job_name === value
    );
    setEditJob((prev) => ({
      ...(prev || initialJobState),
      job_name: template?.job_name || value,
      Job_title: template?.Job_title || value,
      Job_code: template?.Job_code || prev?.Job_code || "",
    }));
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ p: 2 }}>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          mb={2}
        >
          <Typography variant="h5" fontWeight={900} sx={{ color: accent }}>
            {t("hr.jobs.title", "Jobs")}
          </Typography>
          <Box>
            <Tooltip title={t("common.export", "Export")}>
              <IconButton
                onClick={() => {
                  const headers = [
                    t("hr.jobs.table.id", "ID"),
                    t("hr.jobs.table.job_name", "Job Name"),
                    t("hr.jobs.table.title", "Job Title"),
                    t("hr.jobs.table.code", "Code"),
                    t("hr.jobs.table.category", "Category"),
                    t("hr.jobs.table.years", "Nbr Years"),
                  ];
                  const rows = data.map((job) => [
                    job.id_job,
                    job.job_name,
                    job.Job_title,
                    job.Job_code,
                    job.job_categories,
                    job.NBR_YEAR_FOR_JOB,
                  ]);
                  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
                  const workbook = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(workbook, worksheet, "Jobs");
                  XLSX.writeFile(workbook, "jobs.xlsx");
                }}
                sx={{ color: accent }}
              >
                <ImportExportIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddNew}
              sx={{
                ml: 1,
                bgcolor: accent,
                color: theme.palette.getContrastText(accent),
                "&:hover": { bgcolor: accent2 },
              }}
            >
              {t("hr.jobs.add", "Add Job")}
            </Button>
          </Box>
        </Box>

        <Paper
          variant="outlined"
          sx={{
            borderColor: accent2,
            borderRadius: 2,
            p: 0,
            overflow: "hidden",
          }}
        >
          <Box sx={{ width: "100%", overflow: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: 0,
              }}
            >
              <thead>
                <tr style={{ backgroundColor: accent }}>
                  <th
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      textAlign: "left",
                      padding: "14px 16px",
                      fontSize: 14,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                      color: theme.palette.text.primary,
                      borderBottom: `2px solid ${theme.palette.divider}`,
                    }}
                  >
                    {t("hr.jobs.table.id", "ID")}
                  </th>
                  <th
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      textAlign: "left",
                      padding: "14px 16px",
                      fontSize: 14,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                      color: theme.palette.text.primary,
                      borderBottom: `2px solid ${theme.palette.divider}`,
                    }}
                  >
                    {t("hr.jobs.table.job_name", "Job Name")}
                  </th>
                  <th
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      textAlign: "left",
                      padding: "14px 16px",
                      fontSize: 14,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                      color: theme.palette.text.primary,
                      borderBottom: `2px solid ${theme.palette.divider}`,
                    }}
                  >
                    {t("hr.jobs.table.title", "Job Title")}
                  </th>
                  <th
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      textAlign: "left",
                      padding: "14px 16px",
                      fontSize: 14,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                      color: theme.palette.text.primary,
                      borderBottom: `2px solid ${theme.palette.divider}`,
                    }}
                  >
                    {t("hr.jobs.table.code", "Code")}
                  </th>
                  <th
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      textAlign: "left",
                      padding: "14px 16px",
                      fontSize: 14,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                      color: theme.palette.text.primary,
                      borderBottom: `2px solid ${theme.palette.divider}`,
                    }}
                  >
                    {t("hr.jobs.table.category", "Category")}
                  </th>
                  <th
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      textAlign: "left",
                      padding: "14px 16px",
                      fontSize: 14,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                      color: theme.palette.text.primary,
                      borderBottom: `2px solid ${theme.palette.divider}`,
                    }}
                  >
                    {t("hr.jobs.table.years", "Nbr Years")}
                  </th>
                  <th
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      textAlign: "left",
                      padding: "14px 16px",
                      fontSize: 14,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                      color: theme.palette.text.primary,
                      borderBottom: `2px solid ${theme.palette.divider}`,
                    }}
                  >
                    {t("hr.jobs.table.employees", "Employees")}
                  </th>
                  <th
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      textAlign: "left",
                      padding: "14px 16px",
                      fontSize: 14,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                      color: theme.palette.text.primary,
                      borderBottom: `2px solid ${theme.palette.divider}`,
                    }}
                  >
                    {t("common.actions.button", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        padding: 24,
                        textAlign: "center",
                        color: theme.palette.text.secondary,
                      }}
                    >
                      {t("common.loading", "Loading…")}
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        padding: 24,
                        textAlign: "center",
                        color: theme.palette.text.secondary,
                      }}
                    >
                      {t("hr.jobs.empty", "No jobs found")}
                    </td>
                  </tr>
                ) : (
                  data.map((job, idx) => {
                    const list = employeesByTitle[job.Job_title] || [];
                    const zebra = idx % 2 === 0;
                    return (
                      <tr
                        key={job.id_job}
                        style={{
                          backgroundColor: zebra
                            ? theme.palette.background.paper
                            : theme.palette.background.default,
                        }}
                      >
                        <td
                          style={{
                            padding: "14px 16px",
                            fontWeight: 700,
                            fontSize: 16,
                            color: theme.palette.text.primary,
                          }}
                        >
                          {job.id_job}
                        </td>
                        <td
                          style={{
                            padding: "14px 16px",
                            fontWeight: 700,
                            fontSize: 16,
                            color: theme.palette.text.primary,
                          }}
                        >
                          {job.job_name}
                        </td>
                        <td
                          style={{
                            padding: "14px 16px",
                            fontWeight: 600,
                            fontSize: 16,
                          }}
                        >
                          {job.Job_title}
                        </td>
                        <td
                          style={{
                            padding: "14px 16px",
                            fontSize: 15,
                            color: theme.palette.text.secondary,
                          }}
                        >
                          {job.Job_code}
                        </td>
                        <td
                          style={{
                            padding: "14px 16px",
                            fontSize: 15,
                            color: theme.palette.text.secondary,
                          }}
                        >
                          {job.job_categories}
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: 15 }}>
                          {job.NBR_YEAR_FOR_JOB}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => openEmployees(job)}
                            sx={{
                              borderColor: accent,
                              color: accent,
                              fontWeight: 700,
                              "&:hover": {
                                borderColor: accent2,
                                backgroundColor: "transparent",
                              },
                            }}
                          >
                            {list.length} {t("hr.jobs.users", "Users")}
                          </Button>
                        </td>
                        <td style={{ padding: "10px 8px" }}>
                          <Tooltip title={t("common.view", "View")}>
                            <IconButton
                              onClick={() => openEmployees(job)}
                              sx={{ color: accent }}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t("common.delete", "Delete")}>
                            <IconButton
                              onClick={() => handleDelete(job)}
                              color="error"
                            >
                              <DeleteOutlineIcon />
                            </IconButton>
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Box>
        </Paper>

        {/* Add/Edit Job / Position Dialog */}
        <Dialog
          open={openDialog}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 900, color: accent }}>
            {isEditMode
              ? t("hr.jobs.edit", "Edit Job")
              : t("hr.jobs.add", "Add Job / Position")}
          </DialogTitle>
          <Divider
            sx={{ mb: 0, borderColor: "divider", borderBottomWidth: 2 }}
          />
          <DialogContent>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mt: 2 }}>
              {/* Job dropdown (all jobs you provided) */}
              <FormControl fullWidth>
                <InputLabel>
                  {t("hr.jobs.job_template", "Job")}
                </InputLabel>
                <Select
                  value={editJob?.Job_title || ""}
                  label={t("hr.jobs.job_template", "Job")}
                  onChange={(e) => handleJobTemplateChange(e.target.value as string)}
                >
                  {jobTemplates.map((j) => (
                    <MenuItem
                      key={j.id}
                      value={j.Job_title || j.job_name}
                    >
                      {j.id}. {j.Job_title || j.job_name}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  {t(
                    "hr.jobs.job_template_hint",
                    "Choose a job from the existing list"
                  )}
                </FormHelperText>
              </FormControl>

              <TextField
                label={t("hr.jobs.job_name", "Job Name")}
                fullWidth
                value={editJob?.job_name || ""}
                onChange={(e) =>
                  setEditJob({ ...(editJob || initialJobState), job_name: e.target.value })
                }
                error={!!errors.job_name}
                helperText={errors.job_name}
              />
              <TextField
                label={t("hr.jobs.Job_title", "Job Title")}
                fullWidth
                value={editJob?.Job_title || ""}
                onChange={(e) =>
                  setEditJob({ ...(editJob || initialJobState), Job_title: e.target.value })
                }
                error={!!errors.Job_title}
                helperText={errors.Job_title}
              />
              <TextField
                label={t("hr.jobs.Job_code", "Job Code")}
                fullWidth
                value={editJob?.Job_code || ""}
                onChange={(e) =>
                  setEditJob({ ...(editJob || initialJobState), Job_code: e.target.value })
                }
                error={!!errors.Job_code}
                helperText={errors.Job_code}
              />
              <FormControl fullWidth error={!!errors.job_categories}>
                <InputLabel>
                  {t("hr.jobs.job_categories", "Category")}
                </InputLabel>
                <Select
                  value={editJob?.job_categories || ""}
                  label={t("hr.jobs.job_categories", "Category")}
                  onChange={(e) =>
                    setEditJob({
                      ...(editJob || initialJobState),
                      job_categories: e.target.value as string,
                    })
                  }
                >
                  {jobCategories.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {cat}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>{errors.job_categories}</FormHelperText>
              </FormControl>
              <TextField
                label={t("hr.jobs.NBR_YEAR_FOR_JOB", "Nbr Years")}
                type="number"
                fullWidth
                value={editJob?.NBR_YEAR_FOR_JOB ?? ""}
                onChange={(e) =>
                  setEditJob({
                    ...(editJob || initialJobState),
                    NBR_YEAR_FOR_JOB: Number(e.target.value),
                  })
                }
                error={!!errors.NBR_YEAR_FOR_JOB}
                helperText={errors.NBR_YEAR_FOR_JOB}
              />
            </Box>

            {/* Extra fields only for Sales Rep / Sales Lead / Sales Manager */}
            {isSalesRole && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                  {t(
                    "hr.jobs.salesSettings",
                    "Sales Commissions & Assignment"
                  )}
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                  <TextField
                    label={t(
                      "hr.jobs.commissionGold",
                      "Gold Commission %"
                    )}
                    type="number"
                    fullWidth
                    value={editJob?.commissionGold ?? ""}
                    onChange={(e) =>
                      setEditJob({
                        ...(editJob || initialJobState),
                        commissionGold: Number(e.target.value),
                      })
                    }
                  />
                  <TextField
                    label={t(
                      "hr.jobs.commissionDiamond",
                      "Diamond Commission %"
                    )}
                    type="number"
                    fullWidth
                    value={editJob?.commissionDiamond ?? ""}
                    onChange={(e) =>
                      setEditJob({
                        ...(editJob || initialJobState),
                        commissionDiamond: Number(e.target.value),
                      })
                    }
                  />
                  <TextField
                    label={t(
                      "hr.jobs.commissionWatches",
                      "Watches Commission %"
                    )}
                    type="number"
                    fullWidth
                    value={editJob?.commissionWatches ?? ""}
                    onChange={(e) =>
                      setEditJob({
                        ...(editJob || initialJobState),
                        commissionWatches: Number(e.target.value),
                      })
                    }
                  />

                  {/* Department field */}
                  <FormControl
                    fullWidth
                    error={!!errors.department}
                  >
                    <InputLabel>
                      {t("hr.jobs.department", "Department")}
                    </InputLabel>
                    <Select
                      value={editJob?.department || ""}
                      label={t("hr.jobs.department", "Department")}
                      onChange={(e) =>
                        setEditJob({
                          ...(editJob || initialJobState),
                          department: e.target.value as string,
                        })
                      }
                    >
                      {departmentOptions.map((dept) => (
                        <MenuItem key={dept} value={dept}>
                          {dept}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>{errors.department}</FormHelperText>
                  </FormControl>

                  {/* Auto assign manager of department */}
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={autoAssignManager}
                          onChange={(e) => setAutoAssignManager(e.target.checked)}
                        />
                      }
                      label={t(
                        "hr.jobs.autoAssignManager",
                        "Auto-assign manager of this department"
                      )}
                    />
                    <TextField
                      label={t("hr.jobs.manager", "Manager")}
                      fullWidth
                      value={
                        managerCandidate?.NAME ||
                        t(
                          "hr.jobs.noManagerFound",
                          "No manager found for this department"
                        )
                      }
                      InputProps={{ readOnly: true }}
                    />
                  </Box>

                  {/* Assign this position to an employee */}
                  <FormControl
                    fullWidth
                    error={!!errors.assignedEmployeeId}
                  >
                    <InputLabel>
                      {t(
                        "hr.jobs.assignEmployee",
                        "Assign To Employee"
                      )}
                    </InputLabel>
                    <Select
                      value={editJob?.assignedEmployeeId ?? ""}
                      label={t(
                        "hr.jobs.assignEmployee",
                        "Assign To Employee"
                      )}
                      onChange={(e) =>
                        setEditJob({
                          ...(editJob || initialJobState),
                          assignedEmployeeId: Number(e.target.value),
                        })
                      }
                    >
                      {allEmployees.map((e) => (
                        <MenuItem key={e.ID_EMP} value={e.ID_EMP}>
                          {e.NAME} {e.TITLE ? `— ${e.TITLE}` : ""}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>
                      {errors.assignedEmployeeId}
                    </FormHelperText>
                  </FormControl>
                </Box>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleSave}
              variant="contained"
              sx={{
                bgcolor: accent,
                color: theme.palette.getContrastText(accent),
                "&:hover": { bgcolor: accent2 },
              }}
            >
              {isEditMode
                ? t("common.saveChanges", "Save Changes")
                : t("common.save", "Save")}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Employees of Job Dialog */}
        <Dialog
          open={empDialogOpen}
          onClose={() => setEmpDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 900, color: accent }}>
            {empDialogTitle}
          </DialogTitle>
          <DialogContent>
            {empDialogList.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t(
                  "hr.jobs.noEmployees",
                  "No employees assigned to this job title."
                )}
              </Typography>
            ) : (
              <Stack component="ul" sx={{ pl: 2 }}>
                {empDialogList.map((e) => (
                  <Typography key={e.ID_EMP} component="li">
                    {e.NAME}
                  </Typography>
                ))}
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEmpDialogOpen(false)}>
              {t("common.close", "Close")}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
};

export default Jobs;
