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
  Switch,
  FormControlLabel,
} from "@mui/material";

import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import ImportExportIcon from "@mui/icons-material/ImportExport";
import * as XLSX from "xlsx";

type Sm = {
  id_SourceMark: number;
  SourceMarketing: string;
  Status: boolean;
};

const initialBoxeState: Sm = {
  id_SourceMark: 0,
  SourceMarketing: "",
  Status: true,
};

const Sm = () => {
  const [data, setData] = useState<Sm[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editBoxe, setEditBoxe] = useState<Sm | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const navigate = useNavigate();
  const apiIp = process.env.REACT_APP_API_IP;
  const apiUrl = `${apiIp}/sm`;

  const [themeMode, setThemeMode] = useState<"light" | "dark">(
    (localStorage.getItem("themeMode") as "light" | "dark") || "light"
  );

  const fetchData = async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/");

    try {
      const response = await axios.get<Sm[]>(`${apiUrl}/all`, {
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

  const handleEdit = (row: Sm) => {
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
    if (!editBoxe?.SourceMarketing)
      newErrors.SourceMarketing = "Designation is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !editBoxe) return;
    const token = localStorage.getItem("token");

    try {
      if (isEditMode) {
        await axios.put(
          `${apiUrl}/Update/${editBoxe.id_SourceMark}`,
          editBoxe,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } else {
        await axios.post(`${apiUrl}/Add`, editBoxe, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      await fetchData();
      handleCloseDialog();
    } catch (error: any) {
      alert(error.response?.data?.message || "Save failed");
    }
  };

  const handleDelete = async (row: Sm) => {
    if (!window.confirm(`Delete "${row.SourceMarketing}"?`)) return;
    const token = localStorage.getItem("token");
    try {
      await axios.delete(`${apiUrl}/Delete/${row.id_SourceMark}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchData();
    } catch {
      alert("Delete failed");
    }
  };

  const handleExportExcel = () => {
    const headers = ["ID", "Designation", "Status"];
    const rows = data.map((boxe) => [
      boxe.id_SourceMark,
      boxe.SourceMarketing,
      boxe.Status ? "Active" : "Inactive",
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sm");
    XLSX.writeFile(workbook, "Sm.xlsx");
  };

  const columns = useMemo<MRT_ColumnDef<Sm>[]>(
    () => [
      { accessorKey: "id_SourceMark", header: "ID", size: 60 },
      { accessorKey: "SourceMarketing", header: "Designation", size: 300 },
      {
        accessorKey: "Status",
        header: "Status",
        size: 100,
        Cell: ({ cell }) => (
          <Box>{cell.getValue<boolean>() ? "Active" : "Inactive"}</Box>
        ),
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
          Source List
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
            New Source
          </Button>
        </Box>
      </Box>

      <MaterialReactTable table={table} />

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>
          {isEditMode ? "Edit Boxe" : "New Boxe"}
          <Divider
            sx={{
              mb: 0,
              borderColor: themeMode === "dark" ? "grey.700" : "grey.300",
              borderBottomWidth: 2,
            }}
          />
        </DialogTitle>

        <DialogContent
          sx={{ backgroundColor: themeMode === "dark" ? "#1e1e1e" : "#fff" }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            <TextField
              label="Designation"
              fullWidth
              value={editBoxe?.SourceMarketing || ""}
              onChange={(e) =>
                setEditBoxe({ ...editBoxe!, SourceMarketing: e.target.value })
              }
              error={!!errors.SourceMarketing}
              helperText={errors.SourceMarketing}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={editBoxe?.Status || false}
                  onChange={(e) =>
                    setEditBoxe({ ...editBoxe!, Status: e.target.checked })
                  }
                  color="primary"
                />
              }
              label="Status"
            />
          </Box>
        </DialogContent>
        <DialogActions
          sx={{ backgroundColor: themeMode === "dark" ? "#1e1e1e" : "#fff" }}
        >
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

export default Sm;
