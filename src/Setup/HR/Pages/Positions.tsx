import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from 'material-react-table';
import {
  ThemeProvider, createTheme,
  Box, IconButton, Tooltip, Button, Dialog,
  DialogActions, DialogContent, DialogTitle, TextField,
  FormControl, InputLabel, Select, MenuItem, FormHelperText,
  CssBaseline, Divider
} from '@mui/material';

import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import ImportExportIcon from '@mui/icons-material/ImportExport';

import * as XLSX from 'xlsx';

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
  job_name: '',
  Job_title: '',
  Job_code: '',
  job_categories: '',
  NBR_YEAR_FOR_JOB: 65,
};

const jobCategories = ["إدارية", "إشرافية", "حرفية و خدمية", "فنية"];

const Positions = () => {
  const [data, setData] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const navigate = useNavigate();
  const apiUrl = "http://localhost:9000/positions";

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return navigate("/login");

    try {
      const response = await axios.get<Job[]>(`${apiUrl}/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (error: any) {
      if (error.response?.status === 401) navigate("/login");
      else alert("Error loading data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [navigate]);

  const handleEdit = (row: Job) => {
    setEditJob(row);
    setIsEditMode(true);
    setOpenDialog(true);
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
    if (!editJob?.job_name) newErrors.job_name = 'Job Name is required';
    if (!editJob?.Job_title) newErrors.Job_title = 'Title is required';
    if (!editJob?.Job_code) newErrors.Job_code = 'Job Code is required';
    if (!editJob?.job_categories) newErrors.job_categories = 'Category is required';
    if (!editJob?.NBR_YEAR_FOR_JOB) newErrors.NBR_YEAR_FOR_JOB = 'Years required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !editJob) return;
    const token = localStorage.getItem('token');

    try {
      if (isEditMode) {
        await axios.put(`${apiUrl}/Update/${editJob.id_job}`, editJob, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${apiUrl}/Add`, editJob, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      await fetchData();
      handleCloseDialog();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Save failed');
    }
  };

  const handleDelete = async (row: Job) => {
    if (!window.confirm(`Delete "${row.job_name}"?`)) return;
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${apiUrl}/Delete/${row.id_job}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchData();
    } catch {
      alert('Delete failed');
    }
  };

  const handleExportExcel = () => {
    const headers = ["ID", "Job Name", "Title", "Code", "Category", "Nbr Years"];
    const rows = data.map(job => [
      job.id_job,
      job.job_name,
      job.Job_title,
      job.Job_code,
      job.job_categories,
      job.NBR_YEAR_FOR_JOB
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Jobs");
    XLSX.writeFile(workbook, "jobs.xlsx");
  };

  const columns = useMemo<MRT_ColumnDef<Job>[]>(() => [
    { accessorKey: 'id_job', header: 'ID', size: 60 },
    { accessorKey: 'job_name', header: 'Job Name', size: 150 },
    { accessorKey: 'Job_title', header: 'Title', size: 150 },
    { accessorKey: 'Job_code', header: 'Code', size: 120 },
    { accessorKey: 'job_categories', header: 'Category', size: 120 },
    { accessorKey: 'NBR_YEAR_FOR_JOB', header: 'Nbr Years', size: 80 },
    {
      header: 'Actions',
      id: 'actions',
      size: 100,
      Cell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Edit">
            <IconButton color="primary" onClick={() => handleEdit(row.original)} size="small">
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton color="error" onClick={() => handleDelete(row.original)} size="small">
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ], []);

  const table = useMaterialReactTable({
    columns,
    data,
    state: {
      isLoading: loading,
      density: 'compact',
    },
    enableDensityToggle: true,
    muiTableBodyRowProps: ({ row, table }) => {
      const density = table.getState().density;
      let height = density === 'compact' ? '32px' : density === 'spacious' ? '56px' : '40px';
      return {
        sx: {
          backgroundColor: row.index % 2 === 0 ? '#f9f9f9' : '#ffffff',
          '&:hover': { backgroundColor: '#e0e0e0' },
          height,
        },
      };
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box p={0.5}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <Button variant="outlined" color="secondary" startIcon={<ImportExportIcon />} onClick={handleExportExcel}
            sx={{ mr: 1, borderRadius: 3, textTransform: 'none', fontWeight: 'bold', px: 3, py: 1 }}>
            Export Excel
          </Button>
          <Button variant="outlined" color="primary" startIcon={<AddIcon />} onClick={handleAddNew}
            sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 'bold', px: 3, py: 1 }}>
            New Job
          </Button>
        </Box>

        <MaterialReactTable table={table} />

        <Dialog open={openDialog} onClose={handleCloseDialog}>
          <DialogTitle>{isEditMode ? 'Edit Job' : 'New Job'}
            <Divider sx={{ mb: 0, borderColor: 'grey.300', borderBottomWidth: 2 }} />
          </DialogTitle>

          <DialogContent>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
              <TextField
                label="Job Name"
                fullWidth
                value={editJob?.job_name || ''}
                onChange={(e) => setEditJob({ ...editJob!, job_name: e.target.value })}
                error={!!errors.job_name}
                helperText={errors.job_name}
              />
              <TextField
                label="Title"
                fullWidth
                value={editJob?.Job_title || ''}
                onChange={(e) => setEditJob({ ...editJob!, Job_title: e.target.value })}
                error={!!errors.Job_title}
                helperText={errors.Job_title}
              />
              <TextField
                label="Job Code"
                fullWidth
                value={editJob?.Job_code || ''}
                onChange={(e) => setEditJob({ ...editJob!, Job_code: e.target.value })}
                error={!!errors.Job_code}
                helperText={errors.Job_code}
              />
              <FormControl fullWidth error={!!errors.job_categories}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={editJob?.job_categories || ''}
                  onChange={(e) => setEditJob({ ...editJob!, job_categories: e.target.value })}
                >
                  {jobCategories.map((cat) => (
                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                  ))}
                </Select>
                <FormHelperText>{errors.job_categories}</FormHelperText>
              </FormControl>
              <TextField
                label="Nbr of Years"
                type="number"
                fullWidth
                value={editJob?.NBR_YEAR_FOR_JOB || 0}
                onChange={(e) => setEditJob({ ...editJob!, NBR_YEAR_FOR_JOB: Number(e.target.value) })}
                error={!!errors.NBR_YEAR_FOR_JOB}
                helperText={errors.NBR_YEAR_FOR_JOB}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} color="secondary">Cancel</Button>
            <Button onClick={handleSave} color="primary">{isEditMode ? 'Save Changes' : 'Save'}</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
};

export default Positions;
