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

type Customer = {
  id_client: number;
  client_name: string;
  tel_client: string;
  Adresse: string;
  email: string;
};

const initialCustomerState: Customer = {
  id_client: 0,
  client_name: '',
  tel_client: '',
  Adresse: '',
  email: '',
};

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#121212',
      paper: '#1E1E1E',
    },
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
  },
});

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: '#fafafa',
      paper: '#ffffff',
    },
    primary: {
      main: '#3f51b5',
    },
    secondary: {
      main: '#f50057',
    },
  },
});

const Customers = () => {
  const [data, setData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const navigate = useNavigate();
  const apiIp = process.env.REACT_APP_API_IP;
  const apiUrl = `http://${apiIp}/customers`;

  // Get theme mode from localStorage or default to 'dark'
  const savedThemeMode = localStorage.getItem('themeMode') as 'light' | 'dark' || 'dark';
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(
    (localStorage.getItem('themeMode') as 'light' | 'dark') || 'light'
  );

 


  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return navigate("/");

    try {
      const response = await axios.get<Customer[]>(`${apiUrl}/all`, {
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

  const handleEdit = (row: Customer) => {
    setEditCustomer(row);
    setIsEditMode(true);
    setOpenDialog(true);
  };

  const handleAddNew = () => {
    setEditCustomer(initialCustomerState);
    setIsEditMode(false);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditCustomer(null);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: any = {};
    if (!editCustomer?.client_name) newErrors.client_name = 'Client Name is required';
    if (!editCustomer?.tel_client) newErrors.tel_client = 'Phone Number is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !editCustomer) return;
    const token = localStorage.getItem('token');

    try {
      if (isEditMode) {
        await axios.put(`${apiUrl}/Update/${editCustomer.id_client}`, editCustomer, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${apiUrl}/Add`, editCustomer, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      await fetchData();
      handleCloseDialog();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Save failed');
    }
  };

  const handleDelete = async (row: Customer) => {
    if (!window.confirm(`Delete "${row.client_name}"?`)) return;
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${apiUrl}/Delete/${row.id_client}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchData();
    } catch {
      alert('Delete failed');
    }
  };

  const handleExportExcel = () => {
    const headers = ["ID", "Client Name", "Phone Number", "Address", "Email"];
    const rows = data.map(customer => [
      customer.id_client,
      customer.client_name,
      customer.tel_client,
      customer.Adresse,
      customer.email
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");
    XLSX.writeFile(workbook, "customers.xlsx");
  };

  const columns = useMemo<MRT_ColumnDef<Customer>[]>(() => [
    { accessorKey: 'id_client', header: 'ID', size: 60 },
    { accessorKey: 'client_name', header: 'Client Name', size: 150 },
    { accessorKey: 'tel_client', header: 'Phone Number', size: 120 },
    { accessorKey: 'Adresse', header: 'Address', size: 180 },
    { accessorKey: 'email', header: 'Email', size: 200 },
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
    state: { isLoading: loading,  density: 'compact', },
    enableDensityToggle: true,
   
  });

  return (
    
      <Box p={0.5} >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            Customers List
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
              New Customer
            </Button>
          </Box>
        </Box>

        <MaterialReactTable table={table} />

        <Dialog open={openDialog} onClose={handleCloseDialog}>
          <DialogTitle>
            {isEditMode ? 'Edit Customer' : 'New Customer'}
            <Divider sx={{ mb: 0, borderColor: themeMode === localStorage.getItem('themeMode') ? 'grey.700' : 'grey.300', borderBottomWidth: 2 }} />
          </DialogTitle>

          <DialogContent sx={{ backgroundColor: themeMode === localStorage.getItem('themeMode') ? '#1e1e1e' : '#fff' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
              <TextField
                label="Client Name"
                fullWidth
                value={editCustomer?.client_name || ''}
                onChange={(e) =>
                  setEditCustomer({ ...editCustomer!, client_name: e.target.value })
                }
                error={!!errors.client_name}
                helperText={errors.client_name}
              />
              <TextField
                label="Phone Number"
                fullWidth
                value={editCustomer?.tel_client || ''}
                onChange={(e) =>
                  setEditCustomer({ ...editCustomer!, tel_client: e.target.value })
                }
                error={!!errors.tel_client}
                helperText={errors.tel_client}
              />
              <TextField
                label="Address"
                fullWidth
                value={editCustomer?.Adresse || ''}
                onChange={(e) =>
                  setEditCustomer({ ...editCustomer!, Adresse: e.target.value })
                }
              />
              <TextField
                label="Email"
                fullWidth
                value={editCustomer?.email || ''}
                onChange={(e) =>
                  setEditCustomer({ ...editCustomer!, email: e.target.value })
                }
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ backgroundColor: themeMode === localStorage.getItem('themeMode') ? '#1e1e1e' : '#fff' }}>
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

export default Customers;