import { useEffect, useState } from 'react';
import axios from "../../../api";
import {
  Box, IconButton, Tooltip, Button, Dialog,
  DialogActions, DialogContent, DialogTitle, TextField,
  Divider, Typography, createTheme, ThemeProvider, Paper
} from '@mui/material';

import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import * as XLSX from 'xlsx';

type PointOfSalesType = {
  Id_point: number;
  name_point: string;
  Email: string;
};

const initialPointState: PointOfSalesType = {
  Id_point: 0,
  name_point: '',
  Email: '',
};

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#121212',
      paper: '#1E1E1E',
    },
    primary: { main: '#90caf9' },
    secondary: { main: '#f48fb1' },
    text: { primary: '#9e9e9e', secondary: '#9e9e9e' },
  },
  components: {
    MuiFormLabel: { styleOverrides: { root: { color: '#9e9e9e' } } },
    MuiInputLabel: { styleOverrides: { root: { color: '#9e9e9e' } } },
    MuiFormControlLabel: { styleOverrides: { label: { color: '#9e9e9e' } } },
  },
});

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    background: { default: '#fafafa', paper: '#ffffff' },
    primary: { main: '#3f51b5' },
    secondary: { main: '#f50057' },
    text: { primary: '#374151', secondary: '#374151' },
  },
  components: {
    MuiFormLabel: { styleOverrides: { root: { color: '#374151' } } },
    MuiInputLabel: { styleOverrides: { root: { color: '#374151' } } },
    MuiFormControlLabel: { styleOverrides: { label: { color: '#374151' } } },
  },
});

const PointOfSales = () => {
  const [data, setData] = useState<PointOfSalesType[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editItem, setEditItem] = useState<PointOfSalesType | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const apiIp = process.env.REACT_APP_API_IP;
  const apiUrl = `${apiIp}/ps`;

  const savedThemeMode = localStorage.getItem('themeMode') as 'light' | 'dark' || 'dark';
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(savedThemeMode);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<PointOfSalesType[]>(`${apiUrl}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(response.data);
    } catch {
      alert("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEdit = (row: PointOfSalesType) => {
    setEditItem(row);
    setIsEditMode(true);
    setOpenDialog(true);
  };

  const handleAddNew = () => {
    setEditItem(initialPointState);
    setIsEditMode(false);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditItem(null);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: any = {};
    if (!editItem?.name_point) newErrors.name_point = 'Name is required';
    if (!editItem?.Email) newErrors.Email = 'Email is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !editItem) return;
    const token = localStorage.getItem('token');

    try {
      if (isEditMode) {
        await axios.put(`${apiUrl}/Update/${editItem.Id_point}`, editItem, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post(`${apiUrl}/Add`, editItem, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      await fetchData();
      handleCloseDialog();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Save failed');
    }
  };

  const handleDelete = async (row: PointOfSalesType) => {
    if (!window.confirm(`Delete "${row.name_point}"?`)) return;
    const token = localStorage.getItem('token');

    try {
      await axios.delete(`${apiUrl}/Delete/${row.Id_point}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchData();
    } catch {
      alert("Delete failed");
    }
  };

  const handleExportExcel = () => {
    const headers = ["ID", "Name", "Email"];
    const rows = data.map(row => [row.Id_point, row.name_point, row.Email]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "PointOfSales");
    XLSX.writeFile(workbook, "point_of_sales.xlsx");
  };

  return (
    <ThemeProvider theme={themeMode === 'dark' ? darkTheme : lightTheme}>
      <Box p={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            Points of Sales
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<ImportExportIcon />}
              onClick={handleExportExcel}
              sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 'bold', px: 3, py: 1 }}
            >
              Export Excel
            </Button>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleAddNew}
              sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 'bold', px: 3, py: 1 }}
            >
              New Point
            </Button>
          </Box>
        </Box>

        <Box  sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: 2,
          }}   >
          {data.map((point) => (
            <Paper
              key={point.Id_point}
              elevation={3}
              sx={{
                width: 270,
                p: 2,
                backgroundColor: themeMode === 'dark' ? '#1e1e1e' : '#fff',
                borderRadius: 3,
                display: 'Grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography variant="h6" fontWeight="bold">{point.name_point}</Typography>
                <Typography variant="body2" color="text.secondary">{point.Email}</Typography>
              </Box>
              <Box mt={2} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Tooltip title="Edit">
                  <IconButton color="primary" onClick={() => handleEdit(point)} size="small">
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton color="error" onClick={() => handleDelete(point)} size="small">
                    <DeleteOutlineIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Paper>
          ))}
        </Box>

        <Dialog open={openDialog} onClose={handleCloseDialog}>
          <DialogTitle>
            {isEditMode ? 'Edit Point of Sale' : 'New Point of Sale'}
            <Divider sx={{ mb: 0, borderColor: themeMode === 'dark' ? 'grey.700' : 'grey.300', borderBottomWidth: 2 }} />
          </DialogTitle>

          <DialogContent sx={{ backgroundColor: themeMode === 'dark' ? '#1e1e1e' : '#fff' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField
                label="Name"
                fullWidth
                value={editItem?.name_point || ''}
                onChange={(e) =>
                  setEditItem({ ...editItem!, name_point: e.target.value })
                }
                error={!!errors.name_point}
                helperText={errors.name_point}
              />
              <TextField
                label="Email"
                fullWidth
                value={editItem?.Email || ''}
                onChange={(e) =>
                  setEditItem({ ...editItem!, Email: e.target.value })
                }
                error={!!errors.Email}
                helperText={errors.Email}
              />
            </Box>
          </DialogContent>

          <DialogActions sx={{ backgroundColor: themeMode === 'dark' ? '#1e1e1e' : '#fff' }}>
            <Button onClick={handleCloseDialog} color="secondary">Cancel</Button>
            <Button onClick={handleSave} color="primary">
              {isEditMode ? 'Save Changes' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
};

export default PointOfSales;
