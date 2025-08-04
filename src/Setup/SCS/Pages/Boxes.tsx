import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from 'material-react-table';
import {
  Box, IconButton, Tooltip, Button, Dialog,
  DialogActions, DialogContent, DialogTitle, TextField,
  Divider, Typography, createTheme, ThemeProvider
} from '@mui/material';

import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import * as XLSX from 'xlsx';

type Boxe = {
  id_fact: number;
  desig_art: string;
};

const initialBoxeState: Boxe = {
  id_fact: 0,
  desig_art: '',
};

const apiIp = process.env.REACT_APP_API_IP;
const apiUrl = `http://${apiIp}/boxes`;

const Boxes = () => {
  const [data, setData] = useState<Boxe[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editBoxe, setEditBoxe] = useState<Boxe | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const navigate = useNavigate();

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return navigate("/");

    try {
      const response = await axios.get<Boxe[]>(`${apiUrl}/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);

      console.log("Boxes data loaded:", response.data);
    } catch (error: any) {
      if (error.response?.status === 401) navigate("/");
      else alert("Error loading data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [navigate]);

  const handleEdit = (row: Boxe) => {
    setEditBoxe(row);
    setIsEditMode(true);
    setOpenDialog(true);
  };

  const handleAddNew = () => {
    setEditBoxe(initialBoxeState);
    setIsEditMode(false);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditBoxe(null);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: any = {};
    if (!editBoxe?.desig_art) newErrors.desig_famille = 'Designation is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !editBoxe) return;
    const token = localStorage.getItem('token');

    try {
      if (isEditMode) {
        await axios.put(`${apiUrl}/Update/${editBoxe.id_fact}`, editBoxe, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${apiUrl}/Add`, editBoxe, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      await fetchData();
      handleCloseDialog();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Save failed');
    }
  };

  const handleDelete = async (row: Boxe) => {
    if (!window.confirm(`Delete "${row.desig_art}"?`)) return;
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${apiUrl}/Delete/${row.id_fact }`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchData();
    } catch {
      alert('Delete failed');
    }
  };

  const handleExportExcel = () => {
    const headers = ["ID", "Designation"];
    const rows = data.map(boxe => [
      boxe.id_fact,
      boxe.desig_art
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "boxes");
    XLSX.writeFile(workbook, "boxes.xlsx");
  };

  const columns = useMemo<MRT_ColumnDef<Boxe>[]>(() => [
    { accessorKey: 'id_fact', header: 'ID', size: 60 },
    { accessorKey: 'desig_art', header: 'Designation', size: 300 },
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
    state: { isLoading: loading, density: 'compact' },
    enableDensityToggle: true,
   
  });

  return (
       <Box p={0.5}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            Boxes List
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
              New Box
            </Button>
          </Box>
        </Box>

        <MaterialReactTable table={table} />

        <Dialog open={openDialog} onClose={handleCloseDialog}>
          <DialogTitle>
            {isEditMode ? 'Edit Boxe' : 'New Boxe'}
            <Divider   />
          </DialogTitle>

          <DialogContent  >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
              <TextField
                label="Designation"
                fullWidth
                value={editBoxe?.desig_art || ''}
                onChange={(e) =>
                  setEditBoxe({ ...editBoxe!, desig_art: e.target.value })
                }
                error={!!errors.desig_art}
                helperText={errors.desig_art}
              />
            </Box>
          </DialogContent>
          <DialogActions  >
            <Button onClick={handleCloseDialog} color="secondary">
              Cancel
            </Button>
            <Button onClick={handleSave} color="primary">
              {isEditMode ? 'Save Changes' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
 
  );
};

export default Boxes;