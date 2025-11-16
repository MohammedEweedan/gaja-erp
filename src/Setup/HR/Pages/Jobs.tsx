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
};

const theme = createTheme();

const initialJobState: Job = {
  id_job: 0,
  job_name: "",
  Job_title: "",
  Job_code: "",
  job_categories: "",
  NBR_YEAR_FOR_JOB: 65,
};

const jobCategories = ["إدارية", "إشرافية", "حرفية و خدمية", "فنية"];

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

  const handleEdit = (row: Job) => {
    setEmpDialogTitle(`${row.Job_title} — ${row.job_name}`);
    setEmpDialogList(employeesByTitle[row.Job_title] || []);
    setEmpDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditJob(initialJobState);
    setIsEditMode(false);
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !editJob) return;
    const token = localStorage.getItem("token");

    try {
      if (isEditMode) {
        alert("Edit not supported yet");
        return;
      } else {
        const payload = {
          job_name: editJob.job_name,
          year_job: editJob.NBR_YEAR_FOR_JOB,
          job_degree: 1,
          job_level: "1",
          job_title: editJob.Job_title,
          job_code: editJob.Job_code,
          job_categories: editJob.job_categories,
        };
        await axios.post(`${apiUrl}/job`, payload, {
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

        <Dialog
          open={openDialog}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 900, color: accent }}>
            {isEditMode
              ? t("hr.jobs.edit", "Edit Job")
              : t("hr.jobs.add", "Add Job")}
          </DialogTitle>
          <Divider
            sx={{ mb: 0, borderColor: "divider", borderBottomWidth: 2 }}
          />
          <DialogContent>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mt: 2 }}>
              <TextField
                label={t("hr.jobs.job_name", "Job Name")}
                fullWidth
                value={editJob?.job_name || ""}
                onChange={(e) =>
                  setEditJob({ ...editJob!, job_name: e.target.value })
                }
                error={!!errors.job_name}
                helperText={errors.job_name}
              />
              <TextField
                label={t("hr.jobs.Job_title", "Job Title")}
                fullWidth
                value={editJob?.Job_title || ""}
                onChange={(e) =>
                  setEditJob({ ...editJob!, Job_title: e.target.value })
                }
                error={!!errors.Job_title}
                helperText={errors.Job_title}
              />
              <TextField
                label={t("hr.jobs.Job_code", "Job Code")}
                fullWidth
                value={editJob?.Job_code || ""}
                onChange={(e) =>
                  setEditJob({ ...editJob!, Job_code: e.target.value })
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
                      ...editJob!,
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
                value={editJob?.NBR_YEAR_FOR_JOB || ""}
                onChange={(e) =>
                  setEditJob({
                    ...editJob!,
                    NBR_YEAR_FOR_JOB: Number(e.target.value),
                  })
                }
              />
            </Box>
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
