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
  MenuItem,
  Autocomplete,
} from "@mui/material";

import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import ImportExportIcon from "@mui/icons-material/ImportExport";
import * as XLSX from "xlsx";
import { currencyList } from "../../../constants/currencies";
import MuiAlert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";

type Vendor = {
  ExtraClient_ID: number;
  Client_Name: string;
};

type Supplier = {
  id_client: number;
  client_name: string;
  TYPE_SUPPLIER?: string;
};

type SupplierSettlement = {
  id_settlement: number;
  date_settlement: string;
  client: number; // supplier id (brand)
  Debit_Money: number;
  Credit_Money: number;
  Debit_Gold: number;
  Credit_Gold: number;
  Comment: string;
  Brand: number; // vendor id
  Reference_number: string;
  currency: string;
  ExchangeRate?: number;
  ExchangeRateToLYD?: number;
  Paidby?: number;
};

const initialSettlementState: SupplierSettlement = {
  id_settlement: 0,
  date_settlement: "",
  client: -1,
  Debit_Money: 0,
  Credit_Money: 0,
  Debit_Gold: 0,
  Credit_Gold: 0,
  Comment: "",
  Brand: -1,
  Reference_number: "",
  currency: "",
  ExchangeRate: 1,
  ExchangeRateToLYD: 1,
  Paidby: -1,
};

const apiUrl = "/Suppliersettlement";

const OVendorsSettlment = () => {
  const [data, setData] = useState<SupplierSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editSettlement, setEditSettlement] =
    useState<SupplierSettlement | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorsPby, setVendorsPby] = useState<Vendor[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allData, setAllData] = useState<SupplierSettlement[]>([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "warning" | "info",
  });

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/");
    try {
      const response = await axios.get<SupplierSettlement[]>(`${apiUrl}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // store full dataset and let supplier-filtering reduce visible rows
      setAllData(response.data);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const fetchSuppliers = async () => {
    const apiUrlsuppliers = "/suppliers";
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get<Supplier[]>(`${apiUrlsuppliers}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const diamondSuppliers = res.data.filter((s) =>
        s.TYPE_SUPPLIER?.toLowerCase().includes("gold")
      );
      setSuppliers(diamondSuppliers);
    } catch (error) {}
  };

  const fetchVendors = async () => {
    const apiUrlVendors = "/vendors";
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get<Vendor[]>(`${apiUrlVendors}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setVendors(res.data);
      setVendorsPby(res.data);
    } catch (error) {}
  };

  useEffect(() => {
    fetchData();
    fetchVendors();
    fetchSuppliers();
  }, [fetchData]);

  // When suppliers (filtered to gold) or the full dataset change,
  // compute the visible `data` to include only settlements whose
  // `client` matches one of the suppliers (i.e. gold suppliers).
  useEffect(() => {
    if (allData.length === 0) {
      setData([]);
      return;
    }
    if (suppliers.length === 0) {
      // If suppliers not loaded yet, keep list empty until suppliers fetched
      setData([]);
      return;
    }
    const supplierIds = new Set(suppliers.map((s) => s.id_client));
    const filtered = allData.filter((sett) => supplierIds.has(sett.client));
    setData(filtered);
  }, [allData, suppliers]);

  const handleEdit = (row: SupplierSettlement) => {
    setEditSettlement({
      ...row,
      ExchangeRateToLYD: row.ExchangeRateToLYD ?? 1,
    });
    setIsEditMode(true);
    setOpenDialog(true);
  };

  const handleAddNew = () => {
    setEditSettlement({
      ...initialSettlementState,
      date_settlement: new Date().toISOString().slice(0, 10),
      ExchangeRateToLYD: 1,
      Brand: -1,
      client: -1,
      Paidby: -1,
    });
    setIsEditMode(false);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditSettlement(null);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: any = {};
    if (!editSettlement?.Reference_number)
      newErrors.Reference_number = "Reference Number is required";
    if (!editSettlement?.date_settlement)
      newErrors.date_settlement = "Date is required";
    if (!editSettlement?.client || editSettlement.client < 0)
      newErrors.client = "Supplier (Brand) must be selected";
    if (!editSettlement?.Brand || editSettlement.Brand < 0)
      newErrors.Brand = "Vendor must be selected";
    if (!editSettlement?.Paidby || editSettlement.Paidby < 0)
      newErrors.Paidby = "Paid By must be selected";
    if (!editSettlement?.currency) newErrors.currency = "Currency is required";
    if (!editSettlement?.ExchangeRate || editSettlement.ExchangeRate <= 0)
      newErrors.ExchangeRate = "Exchange Rate must be a positive number";
    if (
      !editSettlement?.ExchangeRateToLYD ||
      editSettlement.ExchangeRateToLYD <= 0
    )
      newErrors.ExchangeRateToLYD =
        "Exchange Rate To LYD must be a positive number";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !editSettlement) return;
    const token = localStorage.getItem("token");
    try {
      if (isEditMode) {
        await axios.put(
          `${apiUrl}/Update/${editSettlement.id_settlement}`,
          editSettlement,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } else {
        await axios.post(`${apiUrl}/Add`, editSettlement, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      await fetchData();
      handleCloseDialog();
      setSnackbar({
        open: true,
        message: isEditMode
          ? "Changes saved successfully"
          : "Saved successfully",
        severity: "success",
      });
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || "Save failed",
        severity: "error",
      });
    }
  };

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    row: SupplierSettlement | null;
  }>({ open: false, row: null });

  const handleDelete = useCallback(async (row: SupplierSettlement) => {
    setDeleteDialog({ open: true, row });
  }, []);

  const confirmDelete = async () => {
    if (!deleteDialog.row) return;
    const token = localStorage.getItem("token");
    try {
      await axios.delete(`${apiUrl}/Delete/${deleteDialog.row.id_settlement}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchData();
      setSnackbar({
        open: true,
        message: "Deleted successfully",
        severity: "success",
      });
    } catch {
      setSnackbar({ open: true, message: "Delete failed", severity: "error" });
    } finally {
      setDeleteDialog({ open: false, row: null });
    }
  };

  const handleExportExcel = () => {
    const headers = [
      "ID",
      "Reference Number",
      "Date",
      "Supplier",
      "Debit Money",
      "Credit Money",
      "Debit Gold",
      "Credit Gold",
      "Comment",
      "Vendor",
      "Currency",
    ];
    const rows = data.map((settlement) => [
      settlement.id_settlement,
      settlement.Reference_number,
      settlement.date_settlement,
      suppliers.find((s) => s.id_client === settlement.client)?.client_name ||
        settlement.client,
      settlement.Debit_Money,
      settlement.Credit_Money,
      settlement.Debit_Gold,
      settlement.Credit_Gold,
      settlement.Comment,
      vendors.find((v) => v.ExtraClient_ID === settlement.Brand)?.Client_Name ||
        settlement.Brand,
      settlement.currency,
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "diamond_settlements");
    XLSX.writeFile(workbook, "diamond_settlements.xlsx");
  };

  const columns = useMemo<MRT_ColumnDef<SupplierSettlement>[]>(
    () => [
      {
        header: "Ref. Number / Date",
        id: "ref_date",
        size: 130,
        Cell: ({ row }) => {
          const ref = row.original.Reference_number || "-";
          const value = row.original.date_settlement;
          let dateStr = "";
          if (value) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              const day = String(date.getDate()).padStart(2, "0");
              const monthNames = [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Nov",
                "Dec",
              ];
              const month = monthNames[date.getMonth()];
              const year = date.getFullYear();
              dateStr = `${day}-${month}-${year}`;
            } else {
              dateStr = value;
            }
          }
          return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <span style={{ fontWeight: 500 }}>
                <span style={{ color: "#888", fontSize: 12 }}>
                  Ref. number:
                </span>{" "}
                {ref}
              </span>
              <span style={{ color: "#666", fontSize: 13 }}>
                <span style={{ color: "#888", fontSize: 12 }}>Date:</span>{" "}
                {dateStr}
              </span>
            </Box>
          );
        },
      },
      {
        header: "Brand / Vendor",
        id: "brand_vendor",
        size: 160,
        Cell: ({ row }) => {
          const supplier = suppliers.find(
            (s) => s.id_client === row.original.client
          );
          const vendor = vendors.find(
            (v) => v.ExtraClient_ID === row.original.Brand
          );
          return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <span style={{ fontWeight: 500 }}>
                <span style={{ color: "#888", fontSize: 12 }}>Brand:</span>{" "}
                {supplier ? supplier.client_name : row.original.client || "-"}
              </span>
              <span style={{ fontWeight: 500 }}>
                <span style={{ color: "#888", fontSize: 12 }}>Vendor:</span>{" "}
                {vendor ? vendor.Client_Name : row.original.Brand || "-"}
              </span>
            </Box>
          );
        },
      },
      {
        header: "Debit / Credit Money",
        id: "debit_credit_money",
        size: 140,
        Cell: ({ row }) => {
          const debit = Number(row.original.Debit_Money) || 0;
          const credit = Number(row.original.Credit_Money) || 0;
          const currency = row.original.currency || "";
          return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              {debit !== 0 && (
                <span style={{ fontWeight: 500 }}>
                  <span style={{ color: "#888", fontSize: 12 }}>Debit:</span>{" "}
                  {debit.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  {currency}
                </span>
              )}
              {credit !== 0 && (
                <span style={{ fontWeight: 500 }}>
                  <span style={{ color: "#888", fontSize: 12 }}>Credit:</span>{" "}
                  {credit.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  {currency}
                </span>
              )}
            </Box>
          );
        },
      },
      {
        header: "Exchange Rates & Net Amounts",
        id: "exchange_net_amounts",
        size: 260,
        Cell: ({ row }) => {
          const s = row.original;
          const rateUSD = Number(s.ExchangeRate) || 1;
          const rateLYD = Number(s.ExchangeRateToLYD) || 1;
          const debit = Number(s.Debit_Money) || 0;
          const credit = Number(s.Credit_Money) || 0;
          const netUSD = (debit - credit) * rateUSD;
          const netLYD = (debit - credit) * rateUSD * rateLYD;
          return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Box sx={{ display: "flex", flexDirection: "row", gap: 1 }}>
                <span style={{ color: "#888", fontSize: 12 }}>Ex. Rate USD:</span>
                <span style={{ fontWeight: 500 }}>{rateUSD.toFixed(3)}</span>
                <span style={{ color: "#888", fontSize: 12, marginLeft: 12 }}>Net USD:</span>
                <span style={{ fontWeight: 500 }}>
                  {!isNaN(netUSD)
                    ? netUSD.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : ""}{" "}
                  USD
                </span>
              </Box>
              <Box sx={{ display: "flex", flexDirection: "row", gap: 1 }}>
                <span style={{ color: "#888", fontSize: 12 }}>Ex. Rate LYD:</span>
                <span style={{ fontWeight: 500 }}>{rateLYD.toFixed(3)}</span>
                <span style={{ color: "#888", fontSize: 12, marginLeft: 12 }}>Net LYD:</span>
                <span style={{ fontWeight: 500 }}>
                  {!isNaN(netLYD)
                    ? netLYD.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : ""}{" "}
                  LYD
                </span>
              </Box>
            </Box>
          );
        },
      },
      {
        accessorKey: "Paidby",
        header: "Paid By",
        size: 120,
        Cell: ({ cell }) => {
          const vendor = vendors.find(
            (v) => v.ExtraClient_ID === cell.getValue<number>()
          );
          return vendor ? vendor.Client_Name : cell.getValue<number>() || "";
        },
      },
      {
        accessorKey: "Comment",
        header: "Comment",
        size: 200,
        Cell: ({ cell }) => (
          <Box
            sx={{
              whiteSpace: "pre-line",
              wordBreak: "break-word",
              maxWidth: 300,
            }}
          >
            {cell.getValue<string>()}
          </Box>
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
    [handleDelete, suppliers, vendors]
  );

  const table = useMaterialReactTable({
    columns,
    data,
    state: { isLoading: loading, density: "compact" },
    enableDensityToggle: true,
  });

  const [exchangeRateInput, setExchangeRateInput] = useState("");
  const [exchangeRateToLYDInput, setExchangeRateToLYDInput] = useState("");

  useEffect(() => {
    if (openDialog && editSettlement) {
      setExchangeRateInput(
        editSettlement.ExchangeRate !== undefined
          ? String(editSettlement.ExchangeRate)
          : ""
      );
      setExchangeRateToLYDInput(
        editSettlement.ExchangeRateToLYD !== undefined
          ? String(editSettlement.ExchangeRateToLYD)
          : ""
      );
    }
  }, [openDialog, editSettlement]);

  return (
    <Box p={0.5}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Typography
          color="text.primary"
          variant="h5"
          sx={{ fontWeight: "bold" }}
        >
          Gold Vendor Payment List
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
            Export to Excel
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
            New Payment
          </Button>
        </Box>
      </Box>

      <MaterialReactTable table={table} />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <MuiAlert
          elevation={6}
          variant="filled"
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </MuiAlert>
      </Snackbar>

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>
          {isEditMode ? "Edit Payment" : "New Payment"}
          <Divider />
        </DialogTitle>

        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            <Autocomplete
              id="vendors-select-pb"
              options={vendorsPby}
              autoHighlight
              getOptionLabel={(option) => option.Client_Name}
              value={
                vendorsPby.find(
                  (v) => v.ExtraClient_ID === editSettlement?.Paidby
                ) || null
              }
              onChange={(_event, newValue) => {
                setEditSettlement(
                  (prev) =>
                    prev && {
                      ...prev,
                      Paidby: newValue ? newValue.ExtraClient_ID : -1,
                    }
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={
                    <span
                      style={{ color: errors.Paidby ? "#d32f2f" : undefined }}
                    >
                      Paid By
                    </span>
                  }
                  error={!!errors.Paidby}
                  sx={
                    !!errors.Paidby
                      ? {
                          "& .MuiOutlinedInput-root": {
                            "& fieldset": {
                              borderColor: "#d32f2f",
                              borderWidth: 2,
                            },
                          },
                        }
                      : {}
                  }
                  helperText={errors.Paidby}
                />
              )}
              sx={{ flex: 1, minWidth: 180 }}
            />

            <Box
              sx={{
                display: "flex",
                gap: 2,
                border: "1px solid #e0e0e0",
                borderRadius: 2,
                p: 2,
                mb: 2,
                flexWrap: "wrap",
              }}
            >
              <TextField
                label="Reference Number"
                fullWidth
                value={editSettlement?.Reference_number || ""}
                onChange={(e) =>
                  setEditSettlement({
                    ...editSettlement!,
                    Reference_number: e.target.value,
                  })
                }
                error={!!errors.Reference_number}
                helperText={errors.Reference_number}
                sx={{ flex: 1, minWidth: 180 }}
              />
              <TextField
                label="Date"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={editSettlement?.date_settlement || ""}
                onChange={(e) =>
                  setEditSettlement({
                    ...editSettlement!,
                    date_settlement: e.target.value,
                  })
                }
                error={!!errors.date_settlement}
                helperText={errors.date_settlement}
                sx={{ flex: 1, minWidth: 180 }}
              />
              <Autocomplete
                id="vendors-select"
                options={vendors}
                autoHighlight
                getOptionLabel={(option) => option.Client_Name}
                value={
                  vendors.find((v) => v.ExtraClient_ID === editSettlement?.Brand) || null
                }
                onChange={(_event, newValue) => {
                  setEditSettlement(
                    (prev) =>
                      prev && {
                        ...prev,
                        Brand: newValue ? newValue.ExtraClient_ID : -1,
                        client: newValue ? (suppliers[0]?.id_client ?? -1) : -1,
                      }
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={
                      <span
                        style={{ color: errors.Brand ? "#d32f2f" : undefined }}
                      >
                        Vendor
                      </span>
                    }
                    error={!!errors.Brand}
                    sx={
                      !!errors.Brand
                        ? {
                            "& .MuiOutlinedInput-root": {
                              "& fieldset": {
                                borderColor: "#d32f2f",
                                borderWidth: 2,
                              },
                            },
                          }
                        : {}
                    }
                    helperText={errors.Brand}
                  />
                )}
                sx={{ flex: 1, minWidth: 180 }}
              />
              <Autocomplete
                id="suppliers-select"
                options={suppliers}
                autoHighlight
                getOptionLabel={(option) => option.client_name}
                value={
                  suppliers.find((v) => v.id_client === editSettlement?.client) || null
                }
                onChange={(_event, newValue) => {
                  setEditSettlement(
                    (prev) =>
                      prev && {
                        ...prev,
                        client: newValue ? newValue.id_client : 0,
                      }
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={
                      <span
                        style={{ color: errors.client ? "#d32f2f" : undefined }}
                      >
                        Supplier
                      </span>
                    }
                    error={!!errors.client}
                    sx={
                      !!errors.client
                        ? {
                            "& .MuiOutlinedInput-root": {
                              "& fieldset": {
                                borderColor: "#d32f2f",
                                borderWidth: 2,
                              },
                            },
                          }
                        : {}
                    }
                    helperText={errors.client}
                  />
                )}
                sx={{ flex: 1, minWidth: 180 }}
              />
            </Box>

            <Box
              sx={{
                display: "flex",
                gap: 2,
                border: "1px solid #e0e0e0",
                borderRadius: 2,
                p: 2,
                mb: 2,
                flexWrap: "wrap",
              }}
            >
              <TextField
                label="Currency"
                select
                fullWidth
                value={editSettlement?.currency || ""}
                onChange={(e) =>
                  setEditSettlement({
                    ...editSettlement!,
                    currency: e.target.value,
                  })
                }
                error={!!errors.currency}
                helperText={errors.currency}
                sx={{ flex: 1, minWidth: 180 }}
              >
                {currencyList.map((currency) => (
                  <MenuItem key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Exchange Rate"
                type="number"
                error={!!errors.ExchangeRate}
                helperText={errors.ExchangeRate}
                fullWidth
                value={exchangeRateInput}
                onChange={(e) => {
                  setExchangeRateInput(e.target.value);
                  setEditSettlement({
                    ...editSettlement!,
                    ExchangeRate: Number(e.target.value),
                  });
                }}
                sx={{ flex: 1, minWidth: 180 }}
              />

              <TextField
                label="Debit (Money)"
                type="number"
                fullWidth
                error={!!errors.Debit_Money}
                helperText={errors.Debit_Money}
                value={editSettlement?.Debit_Money || 0}
                onChange={(e) =>
                  setEditSettlement({
                    ...editSettlement!,
                    Debit_Money: Number(e.target.value),
                  })
                }
                sx={{ flex: 1, minWidth: 180 }}
              />
              <TextField
                label="Debit (Money) x Exchange Rate"
                value={
                  editSettlement &&
                  editSettlement.ExchangeRate &&
                  editSettlement.Debit_Money
                    ? (
                        Number(editSettlement.Debit_Money) *
                        Number(editSettlement.ExchangeRate)
                      ).toFixed(2)
                    : ""
                }
                InputProps={{ readOnly: true }}
                fullWidth
                sx={{ flex: 1, minWidth: 180 }}
              />
              <TextField
                label="Credit (Money)"
                type="number"
                fullWidth
                error={!!errors.Credit_Money}
                helperText={errors.Credit_Money}
                value={editSettlement?.Credit_Money || 0}
                onChange={(e) =>
                  setEditSettlement({
                    ...editSettlement!,
                    Credit_Money: Number(e.target.value),
                  })
                }
                sx={{ flex: 1, minWidth: 180 }}
              />
              <TextField
                label="Credit (Money) x Exchange Rate"
                value={
                  editSettlement &&
                  editSettlement.ExchangeRate &&
                  editSettlement.Credit_Money
                    ? (
                        Number(editSettlement.Credit_Money) *
                        Number(editSettlement.ExchangeRate)
                      ).toFixed(2)
                    : ""
                }
                InputProps={{ readOnly: true }}
                fullWidth
                sx={{ flex: 1, minWidth: 180 }}
              />

              <TextField
                label="Exchange Rate To LYD"
                type="number"
                error={!!errors.ExchangeRateToLYD}
                helperText={errors.ExchangeRateToLYD}
                fullWidth
                value={exchangeRateToLYDInput}
                onChange={(e) => {
                  setExchangeRateToLYDInput(e.target.value);
                  setEditSettlement({
                    ...editSettlement!,
                    ExchangeRateToLYD: Number(e.target.value),
                  });
                }}
                onBlur={() => {
                  if (exchangeRateToLYDInput !== "") {
                    const val = Number(exchangeRateToLYDInput);
                    setExchangeRateToLYDInput(val.toFixed(3));
                    setEditSettlement({
                      ...editSettlement!,
                      ExchangeRateToLYD: Number(val.toFixed(3)),
                    });
                  }
                }}
                sx={{ flex: 1, minWidth: 180 }}
              />
              <TextField
                label="Net Amount (LYD)"
                value={
                  editSettlement &&
                  editSettlement.ExchangeRateToLYD !== undefined
                    ? (
                        (Number(editSettlement.Debit_Money) > 0
                          ? Number(editSettlement.Debit_Money)
                          : Number(editSettlement.Credit_Money)) *
                        Number(editSettlement.ExchangeRate) *
                        Number(editSettlement.ExchangeRateToLYD)
                      ).toFixed(2)
                    : ""
                }
                InputProps={{ readOnly: true }}
                fullWidth
                sx={{ flex: 1, minWidth: 180 }}
              />
            </Box>

            <Box
              sx={{ border: "1px solid #e0e0e0", borderRadius: 2, p: 2, mb: 2 }}
            >
              <TextField
                label="Comment"
                fullWidth
                multiline
                minRows={3}
                value={editSettlement?.Comment || ""}
                onChange={(e) =>
                  setEditSettlement({
                    ...editSettlement!,
                    Comment: e.target.value,
                  })
                }
              />
            </Box>
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

      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, row: null })}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          Are you sure you want to delete payment #
          {deleteDialog.row?.id_settlement}?
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialog({ open: false, row: null })}
            color="secondary"
          >
            Cancel
          </Button>
          <Button onClick={confirmDelete} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OVendorsSettlment;
