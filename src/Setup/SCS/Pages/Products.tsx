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

type Product = {
  id_famille: number;
  desig_famille: string;
};

const initialProductState: Product = {
  id_famille: 0,
  desig_famille: '',
};

const Products = () => {
  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const navigate = useNavigate();
  const apiIp = process.env.REACT_APP_API_IP;
  const apiUrl = `http://${apiIp}/products`;

  // Get theme mode from localStorage or default to 'dark'
  const savedThemeMode = localStorage.getItem('themeMode') as 'light' | 'dark' || 'dark';
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(
    (localStorage.getItem('themeMode') as 'light' | 'dark') || 'light'
  );

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return navigate("/");

    try {
      const response = await axios.get<Product[]>(`${apiUrl}/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
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

  const handleEdit = (row: Product) => {
    setEditProduct(row);
    setIsEditMode(true);
    setOpenDialog(true);
  };

  const handleAddNew = () => {
    setEditProduct(initialProductState);
    setIsEditMode(false);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditProduct(null);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: any = {};
    if (!editProduct?.desig_famille) newErrors.desig_famille = 'Designation is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !editProduct) return;
    const token = localStorage.getItem('token');

    try {
      if (isEditMode) {
        await axios.put(`${apiUrl}/Update/${editProduct.id_famille}`, editProduct, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${apiUrl}/Add`, editProduct, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      await fetchData();
      handleCloseDialog();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Save failed');
    }
  };

  const handleDelete = async (row: Product) => {
    if (!window.confirm(`Delete "${row.desig_famille}"?`)) return;
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${apiUrl}/Delete/${row.id_famille}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchData();
    } catch {
      alert('Delete failed');
    }
  };

  const handleExportExcel = () => {
    const headers = ["ID", "Designation"];
    const rows = data.map(product => [
      product.id_famille,
      product.desig_famille
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
    XLSX.writeFile(workbook, "products.xlsx");
  };

  const columns = useMemo<MRT_ColumnDef<Product>[]>(() => [
    { accessorKey: 'id_famille', header: 'ID', size: 60 },
    { accessorKey: 'desig_famille', header: 'Designation', size: 300 },
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
            Products List
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
              New Product
            </Button>
          </Box>
        </Box>

        <MaterialReactTable table={table} />

        <Dialog open={openDialog} onClose={handleCloseDialog}>
          <DialogTitle>
            {isEditMode ? 'Edit Product' : 'New Product'}
            <Divider sx={{ mb: 0, borderColor: themeMode === 'dark' ? 'grey.700' : 'grey.300', borderBottomWidth: 2 }} />
          </DialogTitle>

          <DialogContent sx={{ backgroundColor: themeMode === 'dark' ? '#1e1e1e' : '#fff' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
              <TextField
                label="Designation"
                fullWidth
                value={editProduct?.desig_famille || ''}
                onChange={(e) =>
                  setEditProduct({ ...editProduct!, desig_famille: e.target.value })
                }
                error={!!errors.desig_famille}
                helperText={errors.desig_famille}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ backgroundColor: themeMode === 'dark' ? '#1e1e1e' : '#fff' }}>
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

export default Products;