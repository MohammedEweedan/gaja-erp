import { useEffect, useState, useMemo, useCallback } from "react";
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
  Card,
  CardContent,
  CardActionArea,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  CircularProgress,
  Alert,
} from "@mui/material";

import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import ImportExportIcon from "@mui/icons-material/ImportExport";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import * as XLSX from "xlsx";

import CategoryIcon from "@mui/icons-material/Category";

type Supplier = {
  id_client: number;
  client_name: string;
  tel_client: string;
  Adresse: string;
  Solde_initial: number;
  code_supplier: string;
  STATE_GOL_DIAMON: boolean;
  TYPE_SUPPLIER: string;
  Price_G_Gold: number;
  Percentage_Diamond: number;
  Price_G_Gold_Sales: number;
  profit_margin?: number;
};

const initialSupplierState: Supplier = {
  id_client: 0,
  client_name: "",
  tel_client: "",
  Adresse: "",
  Solde_initial: 0,
  code_supplier: "",
  STATE_GOL_DIAMON: false,
  TYPE_SUPPLIER: "",
  Price_G_Gold: 0,
  Percentage_Diamond: 0,
  Price_G_Gold_Sales: 0,
  profit_margin: 0,
};

type ItemsTypes = {
  id_unite: number;
  desig_unit: string;
  Main_Name: string;
};

const initialItemsTypeState: ItemsTypes = {
  id_unite: 0,
  desig_unit: "",
  Main_Name: "",
};

const getTypeIcon = (type: string) => {
  return <CategoryIcon sx={{ fontSize: 40 }} color="disabled" />;
};

const Suppliers = () => {
  const [data, setData] = useState<Supplier[]>([]);
  const [filteredData, setFilteredData] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedMainName, setSelectedMainName] = useState<string | null>(null);

  const [dataT, setDataT] = useState<ItemsTypes[]>([]);
  const [editSupplierT, setEditSupplierT] = useState<ItemsTypes | null>(null);

  // Bulk update fields
  const [bulkMaxDiscount, setBulkMaxDiscount] = useState<string>("");
  const [bulkLoading, setBulkLoading] = useState(false);
  // Bulk update handler (only Maximum Discount %)
  const handleBulkApply = async () => {
    if (!selectedType) return;
    setBulkLoading(true);
    const token = localStorage.getItem("token");
    const updates = filteredData.map(async (supplier) => {
      const updatedSupplier = {
        ...supplier,
        ...(bulkMaxDiscount !== ""
          ? { Percentage_Diamond: Number(bulkMaxDiscount) }
          : {}),
      };
      return axios.put(
        `${apiUrl}/Update/${supplier.id_client}`,
        updatedSupplier,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    });
    try {
      await Promise.all(updates);
      await fetchData();
      // Refresh filteredData to reflect latest changes using the new data
      if (selectedType) {
        setFilteredData((prev) => {
          // Use the latest data from setData
          const latest = JSON.parse(JSON.stringify(data));
          return latest.filter(
            (s: Supplier) => s.TYPE_SUPPLIER === selectedType
          );
        });
      }
      setBulkMaxDiscount("");
    } catch (error: any) {
      alert("Bulk update failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const navigate = useNavigate();
  const apiIp = process.env.REACT_APP_API_IP;
  const apiUrl = `${apiIp}/suppliers`;
  const savedThemeMode =
    (localStorage.getItem("themeMode") as "light" | "dark") || "dark";
  const [themeMode, setThemeMode] = useState<"light" | "dark">(savedThemeMode);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/");
    try {
      const response = await axios.get<Supplier[]>(`${apiUrl}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(response.data);
    } catch (error: any) {
      if (error.response?.status === 401) navigate("/");
      else alert("Error loading data");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, navigate]);

  const apiUrlT = `${apiIp}/itemstypes`;

  const fetchDataT = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${apiUrlT}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDataT(response.data); // Set the data to the state
    } catch (error) {
      alert("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  useEffect(() => {
    fetchDataT();
  }, []);
  // Refresh filtered table data whenever base data or selected type changes
  useEffect(() => {
    if (selectedType) {
      setFilteredData(data.filter((s) => s.TYPE_SUPPLIER === selectedType));
    }
  }, [data, selectedType]);

  const handleEdit = useCallback((row: Supplier) => {
    setEditSupplier(row);
    setIsEditMode(true);
    setOpenDialog(true);
  }, []);

  const handleAddNew = () => {
    setEditSupplier(initialSupplierState);
    setEditSupplierT(initialItemsTypeState);

    setIsEditMode(false);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditSupplier(null);
    setEditSupplierT(null);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: any = {};
    if (!editSupplier?.client_name)
      newErrors.client_name = "Brand Name is required";
    //if (!editSupplier?.tel_client) newErrors.tel_client = 'Phone Number is required';
    if (
      editSupplier?.Percentage_Diamond === undefined ||
      editSupplier?.Percentage_Diamond === null ||
      isNaN(editSupplier.Percentage_Diamond)
    ) {
      newErrors.Percentage_Diamond = "Maximum Discount % is required";
    } else if (
      editSupplier.Percentage_Diamond < 0 ||
      editSupplier.Percentage_Diamond > 100
    ) {
      newErrors.Percentage_Diamond =
        "Maximum Discount % must be between 0 and 100";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !editSupplier) return;
    const token = localStorage.getItem("token");
    try {
      if (isEditMode) {
        await axios.put(
          `${apiUrl}/Update/${editSupplier.id_client}`,
          editSupplier,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } else {
        await axios.post(`${apiUrl}/Add`, editSupplier, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      await fetchData();
      handleCloseDialog();
    } catch (error: any) {
      alert(error.response?.data?.message || "Save failed");
    }
  };

  const handleDelete = useCallback(async (row: Supplier) => {
    if (!window.confirm(`Delete "${row.client_name}"?`)) return;
    const token = localStorage.getItem("token");
    try {
      await axios.delete(`${apiUrl}/Delete/${row.id_client}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchData();
    } catch {
      alert("Delete failed");
    }
  }, [apiUrl, fetchData]);

  const handleExportExcel = () => {
    const headers = [
      "ID",
      "Brand Name",
      "Phone",
      "Address",
      "Initial Balance",
      "Brand Code",
      "Diamond State",
      "Type",
      "Gold Price",
      "Diamond %",
      "Gold Sales",
      "Profit Margin",
    ];
    const rows = filteredData.map((s) => [
      s.id_client,
      s.client_name,
      s.tel_client,
      s.Adresse,
      s.Solde_initial,
      s.code_supplier,
      s.STATE_GOL_DIAMON ? "Yes" : "No",
      s.TYPE_SUPPLIER,
      s.Price_G_Gold,
      s.Percentage_Diamond,
      s.Price_G_Gold_Sales,
      s.profit_margin ?? 0,
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Brands");
    XLSX.writeFile(workbook, "Brands.xlsx");
  };

  const supplierTypes = Array.from(new Set(dataT.map((s) => s.desig_unit)));

  const handleTypeSelect = (type: string) => {
    setSelectedType(type);
    setFilteredData(data.filter((s) => s.TYPE_SUPPLIER === type));
  };

  const mainNames = Array.from(new Set(dataT.map((s) => s.Main_Name)));
  const filteredItemTypes = selectedMainName
    ? dataT.filter((item) => item.Main_Name === selectedMainName)
    : [];

  const handleBack = () => {
    setSelectedType(null);
    setFilteredData([]);
  };

  const columns = useMemo<MRT_ColumnDef<Supplier>[]>(
    () => [
      { accessorKey: "id_client", header: "ID", size: 60 },
      { accessorKey: "client_name", header: "Brand Name", size: 150 },
      { accessorKey: "code_supplier", header: "Brand Code", size: 150 },
      { accessorKey: "TYPE_SUPPLIER", header: "Type" },
      {
        accessorKey: "Percentage_Diamond",
        header: "Maximum Discount %",
        Cell: ({ cell }) => `${cell.getValue()}%`,
      },
      {
        accessorKey: "profit_margin",
        header: "Profit Margin %",
        Cell: ({ cell }) => `${cell.getValue() ?? 0}%`,
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
    [handleEdit, handleDelete]
  );

  const table = useMaterialReactTable({
    columns,
    data: filteredData,
    state: { isLoading: loading, density: "compact" },
    enableDensityToggle: true,
  });

  return (
    <Box p={2}>
      {!selectedMainName ? (
        <>
          <Typography variant="h5" fontWeight="bold" mb={2}>
            Brand Categories
          </Typography>
          <Box
            display="flex"
            flexWrap="wrap"
            justifyContent="space-between"
            gap={2}
          >
            {mainNames.map((mainName, i) => (
              <Box key={i} sx={{ width: { md: "18%" } }}>
                <Card>
                  <CardActionArea onClick={() => setSelectedMainName(mainName)}>
                    <CardContent sx={{ textAlign: "center" }}>
                      <CategoryIcon sx={{ fontSize: 40 }} color="disabled" />
                      <Typography variant="h6">{mainName}</Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Box>
            ))}
          </Box>
        </>
      ) : !selectedType ? (
        <>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <IconButton onClick={() => setSelectedMainName(null)}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h5" fontWeight="bold">
              Brand Types in {selectedMainName}
            </Typography>
          </Box>
          <Box
            display="flex"
            flexWrap="wrap"
            justifyContent="space-between"
            gap={2}
          >
            {filteredItemTypes.map((type, i) => (
              <Box key={i} sx={{ width: { xs: "100%", sm: "50%", md: "18%" } }}>
                <Card>
                  <CardActionArea
                    onClick={() => handleTypeSelect(type.desig_unit)}
                  >
                    <CardContent sx={{ textAlign: "center" }}>
                      <CategoryIcon sx={{ fontSize: 40 }} color="disabled" />
                      <Typography variant="h6">{type.desig_unit}</Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Box>
            ))}
          </Box>
        </>
      ) : (
        <>
          <Box display="flex" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <IconButton onClick={handleBack}>
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="h5" fontWeight="bold">
                Brands: {selectedType}
              </Typography>
            </Box>
            <Box display="flex" gap={2}>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<ImportExportIcon />}
                onClick={handleExportExcel}
              >
                Export Excel
              </Button>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<AddIcon />}
                onClick={handleAddNew}
              >
                New Brand
              </Button>
            </Box>
          </Box>
          {/* Bulk update field: Maximum Discount % only */}
          <Box mb={2}>
            <Alert severity="warning" sx={{ mb: 1 }}>
              <b>Clarification:</b> This field allows you to set the{" "}
              <b>maximum discount percentage</b> that can be applied to all
              brands of the selected type. For example, entering <b>10</b> will
              set the maximum allowed discount to <b>10%</b> for every brand in
              this group. This does not apply the discount directly to any
              transaction, but rather sets a limit for future sales or
              operations involving these brands. Please ensure you enter a value
              between 0 and 100. This action will update the "Maximum Discount
              %" column for all brands of the selected type.
            </Alert>
            <Box display="flex" alignItems="center" gap={2}>
              <TextField
                label="Maximum Discount % (all)"
                type="number"
                value={bulkMaxDiscount}
                onChange={(e) => setBulkMaxDiscount(e.target.value)}
                size="small"
                sx={{ width: 220 }}
                inputProps={{ min: 0, max: 100 }}
              />
              <Button
                variant="contained"
                color="success"
                onClick={handleBulkApply}
                disabled={bulkLoading || !bulkMaxDiscount}
              >
                {bulkLoading ? <CircularProgress size={22} /> : "Apply"}
              </Button>
            </Box>
          </Box>
          <MaterialReactTable table={table} />
        </>
      )}

      {/* Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>
          {isEditMode ? "Edit Brand" : "New Brand"}
          <Divider sx={{ mb: 0 }} />
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mt: 2 }}>
            <TextField
              label="Brand Name"
              fullWidth
              value={editSupplier?.client_name || ""}
              onChange={(e) =>
                setEditSupplier({
                  ...editSupplier!,
                  client_name: e.target.value,
                })
              }
              error={!!errors.client_name}
              helperText={errors.client_name}
            />
            <TextField
              label="Phone"
              fullWidth
              value={editSupplier?.tel_client || ""}
              onChange={(e) =>
                setEditSupplier({
                  ...editSupplier!,
                  tel_client: e.target.value,
                })
              }
              error={!!errors.tel_client}
              helperText={errors.tel_client}
            />
            <TextField
              label="Address"
              fullWidth
              value={editSupplier?.Adresse || ""}
              onChange={(e) =>
                setEditSupplier({ ...editSupplier!, Adresse: e.target.value })
              }
            />
            <TextField
              label="Brand Code"
              fullWidth
              value={editSupplier?.code_supplier || ""}
              onChange={(e) =>
                setEditSupplier({
                  ...editSupplier!,
                  code_supplier: e.target.value,
                })
              }
            />
            <TextField
              label="Maximum Discount %"
              type="number"
              fullWidth
              value={editSupplier?.Percentage_Diamond ?? ""}
              onChange={(e) => {
                let val = e.target.value;
                // Only allow numbers and empty string
                if (/^\d{0,3}$/.test(val)) {
                  let num = Number(val);
                  if (val === "") {
                    setEditSupplier({
                      ...editSupplier!,
                      Percentage_Diamond: "" as any,
                    });
                  } else if (num >= 0 && num <= 100) {
                    setEditSupplier({
                      ...editSupplier!,
                      Percentage_Diamond: num,
                    });
                  }
                }
              }}
              inputProps={{ min: 0, max: 100 }}
              error={!!errors.Percentage_Diamond}
              helperText={errors.Percentage_Diamond}
            />
            <TextField
              label="Profit Margin %"
              type="number"
              fullWidth
              value={editSupplier?.profit_margin ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d{0,3}$/.test(val)) {
                  const num = Number(val);
                  if (val === "") {
                    setEditSupplier({ ...editSupplier!, profit_margin: undefined });
                  } else if (num >= 0 && num <= 100) {
                    setEditSupplier({ ...editSupplier!, profit_margin: num });
                  }
                }
              }}
              inputProps={{ min: 0, max: 100 }}
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={editSupplier?.TYPE_SUPPLIER || ""}
                onChange={(e) =>
                  setEditSupplier({
                    ...editSupplier!,
                    TYPE_SUPPLIER: e.target.value,
                  })
                }
                label="Type"
              >
                {supplierTypes.map((type, idx) => (
                  <MenuItem key={idx} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button color="secondary" onClick={handleCloseDialog}>
            Cancel
          </Button>
          <Button color="primary" onClick={handleSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Suppliers;
