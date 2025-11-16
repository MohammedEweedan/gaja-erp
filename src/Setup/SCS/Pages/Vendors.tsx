import { useEffect, useState, useMemo } from "react";
import axios from "../../../api";
import { useNavigate } from "react-router-dom";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from "material-react-table";
import {
  Box,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Divider,
  Typography,
  createTheme,
  ThemeProvider,
} from "@mui/material";

import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import ImportExportIcon from "@mui/icons-material/ImportExport";
import * as XLSX from "xlsx";

type Vendor = {
  ExtraClient_ID: number;
  Client_Name: string;
  Intial_Sold_Money: number;
  Intial_Sold_Gold: number;
};

const initialVendorState: Vendor = {
  ExtraClient_ID: 0,
  Client_Name: "",
  Intial_Sold_Money: 0,
  Intial_Sold_Gold: 0,
};

const Vendors = () => {
  const [data, setData] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const navigate = useNavigate();
  const apiIp = process.env.REACT_APP_API_IP;
  const apiUrl = `${apiIp}/vendors`;

  // Get theme mode from localStorage or default to 'dark'

  const fetchData = async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/");

    try {
      const response = await axios.get<Vendor[]>(`${apiUrl}/all`, {
        headers: { Authorization: `Bearer ${token}` },
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

  const handleEdit = (row: Vendor) => {
    setEditVendor(row);
    setIsEditMode(true);
    setOpenDialog(true);
  };

  const handleAddNew = () => {
    setEditVendor(initialVendorState);
    setIsEditMode(false);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditVendor(null);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: any = {};
    if (!editVendor?.Client_Name)
      newErrors.Client_Name = "Client Name is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !editVendor) return;
    const token = localStorage.getItem("token");

    try {
      if (isEditMode) {
        await axios.put(
          `${apiUrl}/Update/${editVendor.ExtraClient_ID}`,
          editVendor,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } else {
        await axios.post(`${apiUrl}/Add`, editVendor, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      await fetchData();
      handleCloseDialog();
    } catch (error: any) {
      alert(error.response?.data?.message || "Save failed");
    }
  };

  const handleDelete = async (row: Vendor) => {
    if (!window.confirm(`Delete "${row.Client_Name}"?`)) return;
    const token = localStorage.getItem("token");
    try {
      await axios.delete(`${apiUrl}/Delete/${row.ExtraClient_ID}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchData();
    } catch {
      alert("Delete failed");
    }
  };

  const handleExportExcel = () => {
    const headers = [
      "ExtraClient ID",
      "Client Name",
      "Initial Sold Money",
      "Initial Sold Gold",
    ];
    const rows = data.map((vendor) => [
      vendor.ExtraClient_ID,
      vendor.Client_Name,
      vendor.Intial_Sold_Money,
      vendor.Intial_Sold_Gold,
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Vendors");
    XLSX.writeFile(workbook, "vendors.xlsx");
  };

  const columns = useMemo<MRT_ColumnDef<Vendor>[]>(
    () => [
      { accessorKey: "ExtraClient_ID", header: "ExtraClient ID", size: 80 },
      { accessorKey: "Client_Name", header: "Client Name", size: 180 },
      {
        accessorKey: "Intial_Sold_Money",
        header: "Initial Sold Money",
        size: 120,
      },
      {
        accessorKey: "Intial_Sold_Gold",
        header: "Initial Sold Gold",
        size: 120,
      },
      {
        header: "Actions",
        id: "actions",
        size: 100,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Tooltip title="Edit">
              <IconButton
                color="primary"
                onClick={() => handleEdit(row.original)}
                size="small"
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                color="error"
                onClick={() => handleDelete(row.original)}
                size="small"
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ),
      },
    ],
    []
  );

  const table = useMaterialReactTable({
    columns,
    data,
    state: { isLoading: loading, density: "compact" },
    enableDensityToggle: true,
  });

  return (
    <Box p={0.5}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: "bold" }}>
          Vendors List
        </Typography>
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<ImportExportIcon />}
            onClick={handleExportExcel}
            sx={{
              borderRadius: 3,
              textTransform: "none",
              fontWeight: "bold",
              px: 3,
              py: 1,
            }}
          >
            Export Excel
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddNew}
            sx={{
              borderRadius: 3,
              textTransform: "none",
              fontWeight: "bold",
              px: 3,
              py: 1,
            }}
          >
            New Vendor
          </Button>
        </Box>
      </Box>

      <MaterialReactTable table={table} />

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>
          {isEditMode ? "Edit Vendor" : "New Vendor"}
          <Divider sx={{ mb: 0, borderBottomWidth: 2 }} />
        </DialogTitle>

        <DialogContent>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mt: 2 }}>
            <TextField
              label="Client Name"
              fullWidth
              value={editVendor?.Client_Name || ""}
              onChange={(e) =>
                setEditVendor({ ...editVendor!, Client_Name: e.target.value })
              }
              error={!!errors.Client_Name}
              helperText={errors.Client_Name}
            />
            <TextField
              label="Initial Sold Money"
              fullWidth
              type="number"
              value={editVendor?.Intial_Sold_Money || ""}
              onChange={(e) =>
                setEditVendor({
                  ...editVendor!,
                  Intial_Sold_Money: Number(e.target.value),
                })
              }
            />
            <TextField
              label="Initial Sold Gold"
              fullWidth
              type="number"
              value={editVendor?.Intial_Sold_Gold || ""}
              onChange={(e) =>
                setEditVendor({
                  ...editVendor!,
                  Intial_Sold_Gold: Number(e.target.value),
                })
              }
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="secondary">
            Cancel
          </Button>
          <Button onClick={handleSave} color="primary">
            {isEditMode ? "Save Changes" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Vendors;
