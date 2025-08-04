import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import {
  Box, IconButton, Tooltip, Button, Dialog,
  DialogActions, DialogContent, DialogTitle, TextField,
  Typography, createTheme, ThemeProvider, Avatar, Card, CardHeader, CardActions, Autocomplete,
  Divider
} from '@mui/material';
import CategoryIcon from '@mui/icons-material/Category';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import * as XLSX from 'xlsx';

type ItemsTypes = {
  id_unite: number;
  desig_unit: string;
  Main_Name: string;
};

const initialItemsTypeState: ItemsTypes = {
  id_unite: 0,
  desig_unit: '',
  Main_Name: '',
};

const ItemsTypes = () => {
  const [data, setData] = useState<ItemsTypes[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editItemType, setEditItemType] = useState<ItemsTypes | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [selectedMainType, setSelectedMainType] = useState<string | null>(null);

  const apiIp = process.env.REACT_APP_API_IP;
  const apiUrl = `http://${apiIp}/itemstypes`;
  const themeMode = localStorage.getItem('themeMode') as 'light' | 'dark' || 'dark';

  const theme = createTheme({
    palette: {
      mode: themeMode,
      background: {
        default: themeMode === localStorage.getItem('themeMode') ? '#121212' : '#fafafa',
        paper: themeMode === localStorage.getItem('themeMode')? '#1E1E1E' : '#fff',
      },
    },
  });

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<ItemsTypes[]>(`${apiUrl}/all`, {
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

  const groupedData = useMemo(() => {
    return data.reduce((acc, item) => {
      acc[item.Main_Name] = acc[item.Main_Name] || [];
      acc[item.Main_Name].push(item);
      return acc;
    }, {} as Record<string, ItemsTypes[]>);
  }, [data]);

  const handleEdit = (item: ItemsTypes) => {
    setEditItemType(item);
    setIsEditMode(true);
    setOpenDialog(true);
  };

  const handleAddNew = () => {
    setEditItemType(initialItemsTypeState);
    setIsEditMode(false);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditItemType(null);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: any = {};
    if (!editItemType?.desig_unit) newErrors.desig_unit = 'Item Type Name is required';
    if (!editItemType?.Main_Name) newErrors.main_type = 'Main Type is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !editItemType) return;
    const token = localStorage.getItem('token');

    try {
      if (isEditMode) {
        await axios.put(`${apiUrl}/Update/${editItemType.id_unite}`, editItemType, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post(`${apiUrl}/Add`, editItemType, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      await fetchData();
      handleCloseDialog();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Save failed');
    }
  };

  const handleDelete = async (item: ItemsTypes) => {
    if (!window.confirm(`Delete "${item.desig_unit}"?`)) return;
    const token = localStorage.getItem('token');

    try {
      await axios.delete(`${apiUrl}/Delete/${item.id_unite}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchData();
    } catch {
      alert("Delete failed");
    }
  };

  const handleExportExcel = () => {
    const headers = ["ID", "Main Type", "Item Type Name"];
    const rows = data.map(row => [row.id_unite, row.Main_Name, row.desig_unit]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ItemsTypes");
    XLSX.writeFile(workbook, "items_types.xlsx");
  };

  return (
 
      <Box p={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {selectedMainType && (
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => setSelectedMainType(null)}
                startIcon={<ArrowBackIcon />}
              >
                Back
              </Button>
            )}
            <Typography variant="h5" fontWeight="bold">
              {selectedMainType ? `Item Types in "${selectedMainType}"` : 'Main Product Types'}
            </Typography>


          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>


            <Button
              variant="outlined"
              color="secondary"
              onClick={handleExportExcel}
              startIcon={<ImportExportIcon />}
            >
              Export Excel
            </Button>
            <Button
              variant="outlined"
              color="primary"
              onClick={handleAddNew}
              startIcon={<AddIcon />}
            >
              New Item Type
            </Button>
          </Box>
        </Box>
        <Divider sx={{ mb: 2, borderColor: 'grey.300' }} />


        <Box


          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: 2,

          }}


        >



          {!selectedMainType
            ? Object.keys(groupedData).map((mainType) => (
              <Card
                key={mainType}
                sx={{ alignContent: 'center', justifyItems: 'center', height: 100, cursor: 'pointer', bgcolor: theme.palette.background.paper }}
                onClick={() => setSelectedMainType(mainType)}
              >
                <CardHeader
                  avatar={<Avatar><CategoryIcon /></Avatar>}
                  title={<Typography fontWeight="bold">{mainType}</Typography>}
                />
              </Card>
            ))
            : groupedData[selectedMainType].map((item) => (
              <Card key={item.id_unite} sx={{ width: 250, bgcolor: theme.palette.background.paper }}>
                <CardHeader title={<Typography>{item.desig_unit}</Typography>} />
                <CardActions sx={{ justifyContent: 'flex-end' }}>
                  <Tooltip title="Edit">
                    <IconButton color="primary" onClick={() => handleEdit(item)} size="small">
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton color="error" onClick={() => handleDelete(item)} size="small">
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            ))}
        </Box>

        <Dialog open={openDialog} onClose={handleCloseDialog}>
          <DialogTitle>{isEditMode ? 'Edit Item Type' : 'New Item Type'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Item Type Name"
                value={editItemType?.desig_unit || ''}
                onChange={(e) => setEditItemType({ ...editItemType!, desig_unit: e.target.value })}
                error={!!errors.desig_unit}
                helperText={errors.desig_unit}
              />
              <Autocomplete
                freeSolo
                options={['Gold', 'Diamond', 'Watches', 'Boxes', 'Accessories', 'Chains']}
                value={editItemType?.Main_Name || ''}
                onChange={(_, newValue) =>
                  setEditItemType({ ...editItemType!, Main_Name: newValue || '' })
                }
                onInputChange={(_, newInputValue) =>
                  setEditItemType({ ...editItemType!, Main_Name: newInputValue })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Main Type"
                    error={!!errors.main_type}
                    helperText={errors.main_type}
                  />
                )}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} color="secondary">Cancel</Button>
            <Button onClick={handleSave} color="primary">{isEditMode ? 'Save Changes' : 'Save'}</Button>
          </DialogActions>
        </Dialog>
      </Box>
    
  );
};

export default ItemsTypes;
