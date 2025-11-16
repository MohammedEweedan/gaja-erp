import { useEffect, useState, useMemo, useCallback } from "react";
import axios from "../api";
import { useLocation, useNavigate } from "react-router-dom";
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
  Divider,
  Typography,
  Snackbar,
  Alert,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { Delete, Edit } from "@mui/icons-material";

type Client = {
  id_client: number;
  client_name: string;
  tel_client: string;
};

type Revenue = {
  id_acc_cli: number;
  date: string;
  ps: number;
  id_client: number;
  usr: number;
  montant_currency: number;
  currency: string;
  rate: number;
  Debit: string;
  montant: number;
  comment: string;
  is_closed: boolean;
  is_printed: boolean;
  credit: string;
  Customer?: {
    id_client: number;
    client_name: string;
    tel_client: string;
  };
  User?: {
    id_user: number;
    name_user: string;
    email: string;
  };
};

type Accounts = {
  Acc_No: string;
  Name_M: string;
};

type SnackbarState = {
  open: boolean;
  message: string;
  severity: "success" | "error" | "warning" | "info";
};

const initialRevenueState: Revenue = {
  id_acc_cli: 0,
  date: new Date().toISOString().split("T")[0],
  ps: 0,
  id_client: 0,
  usr: 0,
  montant_currency: 0,
  currency: "LYD",
  Debit: "",
  credit: "",
  rate: 1,
  montant: 0,
  comment: "",
  is_closed: false,
  is_printed: false,
};

interface Props {
  Type?: string;
}

const Revenue = (props: Props) => {
  const { Type = "" } = props;
  const [customers, setCustomers] = useState<Client[]>([]);
  const [data, setData] = useState<Revenue[]>([]);
  const [dataAccounts, setDataAccounts] = useState<Accounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [editRevenue, setEditRevenue] = useState<Revenue>(initialRevenueState);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedInvoiceNum, setSelectedInvoiceNum] = useState<number | null>(
    null
  );
  // const refreshFlag removed; we reapply active filters explicitly after changes
  const [progress, setProgress] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [revenueToDelete, setRevenueToDelete] = useState<number | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "info" | "warning",
  });

  const [loadingCustomers, setLoadingCustomers] = useState(false);
  // Filter states: preset and custom
  const [selectedRange, setSelectedRange] = useState<string>("");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const apiIp = process.env.REACT_APP_API_IP;
  const apiUrlcustomers = `${apiIp}/customers`;

  const fetchCustomers = useCallback(async () => {
    const token = localStorage.getItem("token");
    try {
      setLoadingCustomers(true);
      const res = await axios.get<Client[]>(`${apiUrlcustomers}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCustomers(res.data);
    } catch (error) {
      console.error("Error fetching customers:", error);
      setSnackbar({
        open: true,
        message: "Failed to fetch customers",
        severity: "error",
      });
    } finally {
      setLoadingCustomers(false);
    }
  }, [apiUrlcustomers]);

  const navigate = useNavigate();
  let ps: string | null = null;
  let Cuser: string | null = null;
  const userStr = localStorage.getItem("user");
  if (userStr) {
    try {
      const userObj = JSON.parse(userStr);
      ps = userObj.ps ?? localStorage.getItem("ps");
      Cuser = userObj.Cuser ?? localStorage.getItem("Cuser");
    } catch {
      ps = localStorage.getItem("ps");
      Cuser = localStorage.getItem("Cuser");
    }
  } else {
    ps = localStorage.getItem("ps");
    Cuser = localStorage.getItem("Cuser");
  }

  const apiUrl = "/Revenue";
  const apiUrlAccounts = `${apiIp}/Accounts`;

  const showSnackbar = (
    message: string,
    severity: SnackbarState["severity"]
  ) => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const fetchDataAccounts = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    try {
      setLoading(true);
      setProgress(0);

      const timer = setInterval(() => {
        setProgress((oldProgress) =>
          oldProgress >= 90 ? oldProgress : oldProgress + 10
        );
      }, 300);

      const res = await axios.get<Accounts[]>(`${apiUrlAccounts}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      clearInterval(timer);
      setProgress(100);
      setDataAccounts(res.data);
    } catch (err: any) {
      console.error("Error fetching accounts data:", err);
      if (err.response?.status === 401) {
        navigate("/");
      } else {
        showSnackbar("Error loading accounts data", "error");
      }
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 500);
    }
  }, [navigate]);

  const fetchData = useCallback(
    async (fromDate?: string, toDate?: string) => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/");
        return;
      }

      try {
        setLoading(true);
        setProgress(0);

        const timer = setInterval(() => {
          setProgress((oldProgress) =>
            oldProgress >= 90 ? oldProgress : oldProgress + 10
          );
        }, 300);

        const res = await axios.get<Revenue[]>(`${apiUrl}/all`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { ps },
        });

        clearInterval(timer);
        setProgress(100);

        // If fromDate/toDate provided, filter results client-side by date.
        if (fromDate && toDate) {
          const from = new Date(fromDate);
          const to = new Date(toDate);
          // normalize to include whole 'to' day
          to.setHours(23, 59, 59, 999);
          const filtered = res.data.filter((r) => {
            if (!r.date) return false;
            const d = new Date(r.date);
            return d >= from && d <= to;
          });
          setData(filtered);
        } else {
          // No date range specified -> don't show any revenue by default
          setData([]);
        }
      } catch (err: any) {
        console.error("Error fetching data:", err);
        if (err.response?.status === 401) {
          navigate("/");
        } else {
          showSnackbar("Error loading data", "error");
        }
      } finally {
        setLoading(false);
        setTimeout(() => setProgress(0), 500);
      }
    },
    [navigate, ps]
  );

  // Helper to format Date -> YYYY-MM-DD for input[type=date]
  const formatDateInput = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // Compute start and end dates for presets
  const computeRangeDates = (range: string) => {
    const today = new Date();
    let from = new Date();
    let to = new Date();
    switch (range) {
      case "today":
        from = new Date(today);
        to = new Date(today);
        break;
      case "last_week":
        from = new Date(today);
        from.setDate(from.getDate() - 7);
        to = new Date(today);
        break;
      case "last_month":
        from = new Date(today);
        from.setMonth(from.getMonth() - 1);
        to = new Date(today);
        break;
      case "last_quarter":
        from = new Date(today);
        from.setMonth(from.getMonth() - 3);
        to = new Date(today);
        break;
      case "last_year":
        from = new Date(today);
        from.setFullYear(from.getFullYear() - 1);
        to = new Date(today);
        break;
      default:
        from = new Date(today);
        to = new Date(today);
    }
    return { from: formatDateInput(from), to: formatDateInput(to) };
  };

  // Apply a given preset or custom filter
  const applyFilter = async (range: string) => {
    if (!range) {
      showSnackbar("Please select a filter", "warning");
      return;
    }

    if (range === "custom") {
      if (!customFrom || !customTo) {
        showSnackbar(
          "Please pick both from and to dates for custom range",
          "warning"
        );
        return;
      }
      if (new Date(customFrom) > new Date(customTo)) {
        showSnackbar("From date cannot be after To date", "warning");
        return;
      }
      setSelectedRange(range);
      await fetchData(customFrom, customTo);
      return;
    }

    const { from, to } = computeRangeDates(range);
    setSelectedRange(range);
    await fetchData(from, to);
  };

  const applyCurrentFilter = async () => {
    if (!selectedRange) return;
    if (selectedRange === "custom") {
      if (!customFrom || !customTo) return;
      await fetchData(customFrom, customTo);
    } else {
      const { from, to } = computeRangeDates(selectedRange);
      await fetchData(from, to);
    }
  };

  const clearFilter = () => {
    setSelectedRange("");
    setCustomFrom("");
    setCustomTo("");
    setData([]);
  };

  useEffect(() => {
    // Do not fetch revenues on mount. Only fetch accounts and customers.
    fetchDataAccounts();
    fetchCustomers();
  }, [fetchDataAccounts, fetchCustomers]);

  const handleAddNew = async () => {
    try {
      setEditRevenue({
        ...initialRevenueState,
        usr: Number(Cuser) || 0,
        ps: Number(ps) || 0,
        date: new Date().toISOString().split("T")[0],
      });

      setIsEditMode(false);
      setShowInvoiceForm(true);
      showSnackbar("Ready to create new revenue", "info");
    } catch (error) {
      console.error("Error creating new revenue:", error);
      showSnackbar("Failed to create new revenue", "error");
    }
  };

  const handleEdit = (row: Revenue) => {
    setSelectedInvoiceNum(row.id_acc_cli);
    setEditRevenue({
      ...row,
      Customer:
        row.Customer || customers.find((c) => c.id_client === row.id_client),
    });
    setIsEditMode(true);
    setShowInvoiceForm(true);
    showSnackbar(`Editing revenue #${row.id_acc_cli}`, "info");
  };

  const openDeleteDialog = (id: number) => {
    setRevenueToDelete(id);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setRevenueToDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!revenueToDelete) return;

    const token = localStorage.getItem("token");
    try {
      await axios.delete(`${apiUrl}/delete/${revenueToDelete}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      showSnackbar("Revenue deleted successfully", "success");
      // reapply current filter if any
      applyCurrentFilter();
    } catch (error) {
      console.error("Error deleting revenue:", error);
      showSnackbar("Failed to delete revenue", "error");
    } finally {
      closeDeleteDialog();
    }
  };

  const handleCloseInvoiceForm = (success: boolean = false) => {
    setShowInvoiceForm(false);
    if (success) {
      applyCurrentFilter();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setEditRevenue((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSelectChange = (e: any) => {
    const { name, value } = e.target;
    setEditRevenue((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const calculateAmountLYD = useCallback(() => {
    if (editRevenue.currency === "LYD") {
      return editRevenue.montant_currency;
    }
    return editRevenue.montant_currency * (editRevenue.rate || 1);
  }, [editRevenue.montant_currency, editRevenue.currency, editRevenue.rate]);

  useEffect(() => {
    setEditRevenue((prev) => ({
      ...prev,
      amount_lyd: calculateAmountLYD(),
    }));
  }, [
    editRevenue.montant_currency,
    editRevenue.currency,
    editRevenue.rate,
    calculateAmountLYD,
  ]);

  const handleSubmit = async () => {
    // Validate form
    const newErrors: { [key: string]: string } = {};
    if (!editRevenue.id_client) newErrors.id_client = "Customer is required";
    if (!editRevenue.currency) newErrors.currency = "Currency is required";
    if (
      editRevenue.montant_currency === undefined ||
      editRevenue.montant_currency === null
    )
      newErrors.amount = "Amount is required";
    if (!editRevenue.rate || editRevenue.rate <= 0)
      newErrors.rate = "Rate must be greater than 0";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      showSnackbar("Please fix the errors in the form", "error");
      return;
    }

    const token = localStorage.getItem("token");
    try {
      const url = isEditMode
        ? `${apiUrl}/update/${editRevenue.id_acc_cli}`
        : `${apiUrl}/Add`;

      const method = isEditMode ? "PUT" : "POST";

      await axios({
        method,
        url,
        data: {
          ...editRevenue,
          amount_lyd: calculateAmountLYD(),
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      showSnackbar(
        isEditMode
          ? "Revenue updated successfully"
          : "Revenue created successfully",
        "success"
      );
      handleCloseInvoiceForm(true);
    } catch (error) {
      console.error("Error saving revenue:", error);
      showSnackbar("Failed to save revenue", "error");
    }
  };

  const columns = useMemo<MRT_ColumnDef<Revenue>[]>(
    () => [
      {
        id: "invoice_number",
        header: "Invoice Number",
        size: 120,
        Cell: ({ row }) => {
          const comment = (row.original.comment || "").toString();
          // Match patterns like: 'invoice number 19', 'invoice 19', 'invoice#19', etc.
          const m = comment.match(/invoice(?:\s+number)?\s*(?:#|:)?\s*(\d+)/i);
          return m ? m[1] : "";
        },
      },
      {
        accessorKey: "id_acc_cli",
        header: "Transaction No",
        size: 100,
      },
      {
        accessorKey: "date",
        header: "Date",
        size: 120,
        Cell: ({ cell }) =>
          cell.getValue<string>()
            ? new Date(cell.getValue<string>()).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : null,
      },
      {
        accessorKey: "Client.client_name",
        header: "Customer",
        size: 150,
      },
      {
        accessorKey: "Debit",
        header: "Debit Account",
        size: 140,
        Cell: ({ cell }) => {
          const debitAccNo = cell.getValue<string>();
          const account = dataAccounts.find((acc) => acc.Acc_No === debitAccNo);
          return account ? (
            <div style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
              <strong>{account.Acc_No}</strong>
              <br />
              {account.Name_M}
            </div>
          ) : (
            debitAccNo
          );
        },
      },
      {
        accessorKey: "credit",
        header: "Credit Account",
        size: 140,
        Cell: ({ cell }) => {
          const creditAccNo = cell.getValue<string>();
          const account = dataAccounts.find(
            (acc) => acc.Acc_No === creditAccNo
          );
          return account ? (
            <div style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
              <strong>{account.Acc_No}</strong>
              <br />
              {account.Name_M}
            </div>
          ) : (
            creditAccNo
          );
        },
      },

      {
        accessorKey: "currency",
        header: "Currency",
        size: 80,
      },
      {
        accessorKey: "montant_currency",
        header: "Amount",
        size: 120,
        Cell: ({ cell }) =>
          cell.getValue<number>()?.toLocaleString("en") || "0",
      },

      {
        accessorKey: "montant",
        header: "Amount (LYD)",
        size: 120,
        Cell: ({ cell }) =>
          cell.getValue<number>()?.toLocaleString("en") || "0",
      },
      {
        accessorKey: "IS_OK",
        header: "Status",
        size: 100,
        Cell: ({ cell }) => (
          <Box
            sx={{
              color: cell.getValue() ? "success.main" : "warning.main",
              fontWeight: "bold",
            }}
          >
            {cell.getValue() ? "Closed" : "Open"}
          </Box>
        ),
      },
      {
        accessorKey: "Utilisateur.name_user",
        header: "Created By",
        size: 120,
      },
      {
        accessorKey: "comment",
        header: "Comment",
        size: 180,
        Cell: ({ cell }) => (
          <span style={{ whiteSpace: "pre-line" }}>
            {cell.getValue<string>()}
          </span>
        ),
      },
    ],
    [dataAccounts]
  );
  const table = useMaterialReactTable({
    columns,
    data,
    state: { isLoading: loading },
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    enableColumnFilters: false,
    enableHiding: false,
    initialState: {
      density: "compact",
      sorting: [{ id: "date", desc: true }],
      pagination: {
        pageSize: 7,
        pageIndex: 0,
      },
    },
  });

  // Filter accounts to only those with Acc_No length 8
  const filteredAccounts = useMemo(
    () => dataAccounts.filter((acc) => acc.Acc_No.length === 8),
    [dataAccounts]
  );

  return (
    <Box p={2}>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
          elevation={6}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={deleteDialogOpen}
        onClose={closeDeleteDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Confirm Delete</DialogTitle>
        <DialogContent>
          Are you sure you want to delete this revenue record? This action
          cannot be undone.
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showInvoiceForm}
        onClose={() => handleCloseInvoiceForm()}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {isEditMode
            ? `Edit Revenue #${editRevenue.id_acc_cli}`
            : "Create New Revenue"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", gap: 2 }}>
              {/* Transaction Number field hidden as requested */}
              {/* <TextField
                                label="Transaction Number"
                                name="id_acc_cli"
                                value={editRevenue.id_acc_cli}
                                onChange={handleInputChange}
                                disabled
                                fullWidth
                            /> */}

              <TextField
                label="Date"
                type="date"
                name="date"
                value={editRevenue.date}
                onChange={handleInputChange}
                InputLabelProps={{ shrink: true }}
                disabled
                sx={{ minWidth: 250 }}
              />

              <Autocomplete
                id="customer-select"
                options={customers}
                loading={loadingCustomers}
                getOptionLabel={(option) =>
                  `${option.client_name} (${option.tel_client || "No Phone"})`
                }
                value={
                  customers.find(
                    (c) => c.id_client === editRevenue.id_client
                  ) || null
                }
                onChange={(event, newValue) => {
                  setEditRevenue((prev) => ({
                    ...prev,
                    id_client: newValue?.id_client || 0,
                    Customer: newValue || undefined,
                  }));
                  setErrors((prev) => ({ ...prev, id_client: "" }));
                }}
                renderOption={(props, option) => (
                  <Box component="li" {...props} key={option.id_client}>
                    {option.client_name} ({option.tel_client || "No Phone"})
                  </Box>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Customer"
                    error={!!errors.id_client}
                    helperText={errors.id_client}
                    required
                  />
                )}
                fullWidth
              />
            </Box>

            <Autocomplete
              id="account-select"
              options={filteredAccounts}
              getOptionLabel={(option) => `${option.Name_M} (${option.Acc_No})`}
              value={
                dataAccounts.find((c) => c.Acc_No === editRevenue.Debit) || null
              }
              onChange={(event, newValue) => {
                setEditRevenue((prev) => ({
                  ...prev,
                  Debit: newValue?.Acc_No || "",
                }));
                setErrors((prev) => ({ ...prev, Acc_No: "" }));
              }}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.Acc_No}>
                  {option.Name_M} ({option.Acc_No})
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Debit Account"
                  error={!!errors.id_client}
                  helperText={errors.id_client}
                  required
                />
              )}
            />

            <Autocomplete
              id="account-select"
              options={filteredAccounts}
              getOptionLabel={(option) => `${option.Name_M} (${option.Acc_No})`}
              value={
                dataAccounts.find((c) => c.Acc_No === editRevenue.credit) ||
                null
              }
              onChange={(event, newValue) => {
                setEditRevenue((prev) => ({
                  ...prev,
                  credit: newValue?.Acc_No || "",
                }));
                setErrors((prev) => ({ ...prev, Acc_No: "" }));
              }}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.Acc_No}>
                  {option.Name_M} ({option.Acc_No})
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Credit Account"
                  error={!!errors.Acc_No}
                  helperText={errors.Acc_No}
                  required
                />
              )}
            />

            <Box sx={{ display: "flex", gap: 2 }}>
              <FormControl fullWidth error={!!errors.currency}>
                <InputLabel>Currency *</InputLabel>
                <Select
                  name="currency"
                  value={editRevenue.currency}
                  onChange={handleSelectChange}
                  label="Currency *"
                >
                  <MenuItem value="LYD">LYD</MenuItem>
                  <MenuItem value="USD">USD</MenuItem>
                  <MenuItem value="EUR">EUR</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Amount *"
                name="montant_currency"
                type="number"
                value={editRevenue.montant_currency}
                onChange={handleInputChange}
                error={!!errors.amount}
                helperText={errors.amount}
                fullWidth
                inputProps={{ step: 0.01 }}
              />

              <TextField
                label="Exchange Rate *"
                name="rate"
                type="number"
                value={editRevenue.rate}
                onChange={handleInputChange}
                error={!!errors.rate}
                helperText={errors.rate}
                fullWidth
                inputProps={{ min: 0, step: 0.0001 }}
              />

              <TextField
                label="Amount in LYD"
                name="amount_lyd"
                type="number"
                value={editRevenue.montant_currency * (editRevenue.rate || 1)}
                disabled
                fullWidth
              />
            </Box>
            <TextField
              label="Comment"
              name="comment"
              value={editRevenue.comment}
              onChange={handleInputChange}
              multiline
              rows={3}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleCloseInvoiceForm()}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {isEditMode ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {loading && progress > 0 && (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            height: 4,
          }}
        />
      )}

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h5" fontWeight="bold">
          Revenue List
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddNew}
          sx={{ borderRadius: 2, fontWeight: "bold" }}
        >
          New Revenue
        </Button>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Date filters: presets + custom */}
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 2 }}>
        <FormControl sx={{ minWidth: 220 }}>
          <InputLabel id="revenue-filter-label">Filter Range</InputLabel>
          <Select
            labelId="revenue-filter-label"
            value={selectedRange}
            label="Filter Range"
            onChange={(e) => setSelectedRange(e.target.value)}
          >
            <MenuItem value="">None</MenuItem>
            <MenuItem value="today">Today</MenuItem>
            <MenuItem value="last_week">Last 7 Days</MenuItem>
            <MenuItem value="last_month">Last Month</MenuItem>
            <MenuItem value="last_quarter">Last Quarter</MenuItem>
            <MenuItem value="last_year">Last Year</MenuItem>
            <MenuItem value="custom">Custom Range</MenuItem>
          </Select>
        </FormControl>

        {selectedRange === "custom" && (
          <>
            <TextField
              label="From"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="To"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </>
        )}

        <Button
          variant="contained"
          color="primary"
          onClick={() => applyFilter(selectedRange)}
        >
          Apply
        </Button>

        <Button variant="outlined" onClick={() => clearFilter()}>
          Clear
        </Button>
      </Box>

      <MaterialReactTable table={table} />
    </Box>
  );
};

export default Revenue;
