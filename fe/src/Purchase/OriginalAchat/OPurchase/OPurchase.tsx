import { useEffect, useState, useMemo, useCallback, forwardRef } from "react";
import axios from "../../../../src/api";
import { useNavigate, useLocation } from "react-router-dom";
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
  Autocomplete,
} from "@mui/material";

import Snackbar from "@mui/material/Snackbar";
import MuiAlert, { AlertProps } from "@mui/material/Alert";

import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import ImportExportIcon from "@mui/icons-material/ImportExport";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import AttchOPFiles from "./AttchOPFiles";

import EmailIcon from "@mui/icons-material/Email";
import * as XLSX from "xlsx";
import Backdrop from "@mui/material/Backdrop";

import LinearProgress from "@mui/material/LinearProgress";
import Logo from "../../../ui-component/Logo";
import CheckCircleIcon from "@mui/icons-material/Verified";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";

type Supplier = {
  id_client: number;
  client_name: string;
  TYPE_SUPPLIER?: string;
};

type User = {
  id_user: number;
  name?: string;
  name_user?: string;
  email?: string;
};

// 1. Extend OPurchae type (add these fields if not already present)
type OPurchae = {
  id_achat: number;
  Comment_Achat?: string;
  Date_Achat?: string;
  FullWeight?: number;
  NetWeight?: number;
  Usr?: number;
  Brand?: number;
  DocumentNo?: string;
  Stone_Details?: string;
  Net_Details?: string;
  Purity?: string;
  PureWt?: string;
  MakingStoneRate?: string;
  MakingStoneValue?: string;
  MetalValue?: string;
  supplier?: Supplier | null;
  user?: User;
  attachmentUrl?: string;
  MakingCharge?: number;
  ShippingCharge?: number;
  TravelExpesenes?: number;
  LossExpesenes?: number;
  cost_g?: number;
  Rate?: number;
  cost_g_LYD?: number;
  IsApprouved?: string;
  Approval_Date?: string;
  ApprouvedBy?: string;
  ounceCost?: number;
  IndirectCost?: number;
};

type DistributionPurchase = {
  distributionID: number;
  ps: number;
  Weight: number;
  distributionDate: string;
  usr: number;
  PurchaseID: number;
};

type Ps = {
  Id_point: number;
  name_point: string;
  Email: string;
};

const initialBoxeState: OPurchae = {
  id_achat: 0,
  Comment_Achat: "",
  Date_Achat: new Date().toISOString().slice(0, 10),
  FullWeight: undefined,
  NetWeight: undefined,
  Usr: 0,
  Brand: undefined,
  DocumentNo: "",
  Stone_Details: "",
  Net_Details: "",
  Purity: "",
  PureWt: "",
  MakingStoneRate: "",
  MakingStoneValue: "",
  MetalValue: "",
  supplier: null,
  attachmentUrl: undefined,
  IsApprouved: "",
  Approval_Date: new Date().toISOString().slice(0, 10),
  ApprouvedBy: "",
  IndirectCost: undefined,
};

const Alert = forwardRef<HTMLDivElement, AlertProps>((props, ref) => (
  <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />
));

const OPurchase = () => {
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
  // reference to avoid unused var warning in strict settings
  void ps;

  const [data, setData] = useState<OPurchae[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editOPurchase, setEditOPurchase] = useState<OPurchae | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info" | "warning";
  }>({ open: false, message: "", severity: "success" });
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  // reference to avoid unused var warning in strict settings
  void loadingSuppliers;
  const [attachmentDialog, setAttachmentDialog] = useState<{
    open: boolean;
    row: OPurchae | null;
  }>({ open: false, row: null });

  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailProgress, setEmailProgress] = useState(0);
  const [distributionDialog, setDistributionDialog] = useState<{
    open: boolean;
    purchase: OPurchae | null;
  }>({ open: false, purchase: null });
  const [distributions, setDistributions] = useState<DistributionPurchase[]>(
    []
  );
  const [newDistribution, setNewDistribution] = useState<{
    ps: number;
    Weight: number;
    distributionDate: string;
    PurchaseType: string;
  }>({
    ps: 0,
    Weight: 0,
    distributionDate: new Date().toISOString().slice(0, 10),
    PurchaseType: "Gold Purchase",
  });
  const [loadingDistributions, setLoadingDistributions] = useState(false);
  const [psList, setPsList] = useState<Ps[]>([]);
  const [pendingDeleteDist, setPendingDeleteDist] =
    useState<DistributionPurchase | null>(null);
  const [distributionErrors, setDistributionErrors] = useState<{
    ps?: boolean;
    Weight?: boolean;
    distributionDate?: boolean;
  }>({});
  // 2. Add state for journal dialog
  const [openJournalDialog, setOpenJournalDialog] = useState(false);
  const [journalRow, setJournalRow] = useState<OPurchae | null>(null);
  const [journalFields, setJournalFields] = useState({
    MakingCharge: 0,
    ShippingCharge: 0,
    TravelExpesenes: 0,
    LossExpesenes: 0,
    IndirectCost: 0,
    cost_g: 0,
    Rate: 0,
    cost_g_LYD: 0,
    ounceCost: 0,
  });

  // Edit cost by brand dialog state
  const [openBrandCostDialog, setOpenBrandCostDialog] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<Supplier | null>(null);
  const [brandCosts, setBrandCosts] = useState({
    MakingCharge: 0,
    ShippingCharge: 0,
    TravelExpesenes: 0,
    LossExpesenes: 0,
    IndirectCost: 0,
  });

  // When a brand is selected, populate the brandCosts from an existing
  // purchase record for that brand if available. This avoids needing a
  // dedicated backend endpoint — we reuse the already-fetched `data`.
  useEffect(() => {
    if (!selectedBrand) {
      setBrandCosts({
        MakingCharge: 0,
        ShippingCharge: 0,
        TravelExpesenes: 0,
        LossExpesenes: 0,
        IndirectCost: 0,
      });
      return;
    }

    // Prefer a purchase that already has cost fields set (non-null).
    const purchaseWithCosts = data.find((r) =>
      r.Brand === selectedBrand.id_client && (
        r.MakingCharge != null ||
        r.ShippingCharge != null ||
        r.TravelExpesenes != null ||
        r.LossExpesenes != null ||
        r.IndirectCost != null
      )
    );

    if (purchaseWithCosts) {
      setBrandCosts({
        MakingCharge: purchaseWithCosts.MakingCharge ?? 0,
        ShippingCharge: purchaseWithCosts.ShippingCharge ?? 0,
        TravelExpesenes: purchaseWithCosts.TravelExpesenes ?? 0,
        LossExpesenes: purchaseWithCosts.LossExpesenes ?? 0,
        IndirectCost: purchaseWithCosts.IndirectCost ?? 0,
      });
    } else {
      // No existing costs found for this brand — reset to defaults (zeros).
      setBrandCosts({
        MakingCharge: 0,
        ShippingCharge: 0,
        TravelExpesenes: 0,
        LossExpesenes: 0,
        IndirectCost: 0,
      });
    }
  }, [selectedBrand, data]);

  const navigate = useNavigate();
  const rawApiIp = process.env.REACT_APP_API_IP || "";
  const apiIp = rawApiIp.replace(/\/+$/, "");
  // If API IP is not provided, use relative path so axios baseURL will be used
  const apiUrl = apiIp ? `${apiIp}/Opurchases` : "/Opurchases";

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/");

    try {
      const response = await axios.get<OPurchae[]>(`${apiUrl}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(response.data);
    } catch (error: any) {
      if (error.response?.status === 401) navigate("/");
      else
        setSnackbar({
          open: true,
          message: "Error loading data",
          severity: "error",
        });
    } finally {
      setLoading(false);
    }
  }, [navigate, apiUrl]);

  const fetchSuppliers = useCallback(async () => {
    const apiUrlsuppliers = "/suppliers";
    const token = localStorage.getItem("token");
    try {
      setLoadingSuppliers(true);
      const res = await axios.get<Supplier[]>(`${apiUrlsuppliers}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Filter suppliers where type_supplier contains "gold" (case-insensitive)
      const goldSuppliers = res.data.filter((supplier) =>
        supplier.TYPE_SUPPLIER?.toLowerCase().includes("gold")
      );
      setSuppliers(goldSuppliers);
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Failed to fetch suppliers",
        severity: "error",
      });
    } finally {
      setLoadingSuppliers(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchSuppliers();
  }, [fetchData, fetchSuppliers]);

  useEffect(() => {
    const fetchPsList = async () => {
      const token = localStorage.getItem("token");
      try {
        const res = await axios.get("/ps/all", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPsList(res.data);
      } catch {
        setSnackbar({
          open: true,
          message: "Failed to load points of sale",
          severity: "error",
        });
      }
    };
    fetchPsList();
  }, []);

  const handleEdit = useCallback((row: OPurchae) => {
    setEditOPurchase({
      ...row,
      supplier: suppliers.find((s) => s.id_client === row.Brand) || null,
    });
    setIsEditMode(true);
    setOpenDialog(true);
  }, [suppliers]);

  const handleAddNew = () => {
    setEditOPurchase(initialBoxeState);
    setIsEditMode(false);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditOPurchase(null);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: any = {};
    if (!editOPurchase?.Comment_Achat) newErrors.Comment_Achat = "Required";
    if (!editOPurchase?.Date_Achat) newErrors.Date_Achat = "Required";
    if (!editOPurchase?.FullWeight && editOPurchase?.FullWeight !== 0)
      newErrors.FullWeight = "Required";
    if (!editOPurchase?.NetWeight && editOPurchase?.NetWeight !== 0)
      newErrors.NetWeight = "Required";
    if (
      (editOPurchase?.FullWeight || editOPurchase?.FullWeight === 0) &&
      (editOPurchase?.NetWeight || editOPurchase?.NetWeight === 0) &&
      editOPurchase.FullWeight < editOPurchase.NetWeight
    ) {
      newErrors.FullWeight =
        "Full Weight must be greater than or equal to Net Weight";
      newErrors.NetWeight =
        "Net Weight must be less than or equal to Full Weight";
    }
    if (!editOPurchase?.Usr && editOPurchase?.Usr !== 0)
      newErrors.Usr = "Required";
    if (!editOPurchase?.supplier) newErrors.supplier = "Required";
    if (!editOPurchase?.DocumentNo) newErrors.DocumentNo = "Required";
    if (!editOPurchase?.Stone_Details) newErrors.Stone_Details = "Required";
    if (!editOPurchase?.Net_Details) newErrors.Net_Details = "Required";
    //if (!editOPurchase?.Purity) newErrors.Purity = 'Required';
    // if (!editOPurchase?.PureWt) newErrors.PureWt = 'Required';
    if (!editOPurchase?.MakingStoneRate) newErrors.MakingStoneRate = "Required";
    if (!editOPurchase?.MakingStoneValue)
      newErrors.MakingStoneValue = "Required";
    if (!editOPurchase?.MetalValue) newErrors.MetalValue = "Required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !editOPurchase) return;
    const token = localStorage.getItem("token");
    try {
      if (isEditMode) {
        await axios.put(
          `${apiUrl}/Update/${editOPurchase.id_achat}`,
          {
            ...editOPurchase,
            Brand: editOPurchase.supplier?.id_client,
            Usr: Cuser,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setSnackbar({
          open: true,
          message: "Purchase updated successfully",
          severity: "success",
        });
      } else {
        const { id_achat, supplier, ...purchaseData } = editOPurchase;
        await axios.post(
          `${apiUrl}/Add`,
          {
            ...purchaseData,
            Brand: supplier?.id_client,
            Usr: Cuser,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setSnackbar({
          open: true,
          message: "Purchase added successfully",
          severity: "success",
        });
      }
      await fetchData();
      handleCloseDialog();
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || "Save failed",
        severity: "error",
      });
    }
  };

  const handleDelete = useCallback(async (row: OPurchae) => {
    if (!window.confirm(`Delete "${row.Comment_Achat}"?`)) return;
    const token = localStorage.getItem("token");
    try {
      await axios.delete(`${apiUrl}/Delete/${row.id_achat}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSnackbar({
        open: true,
        message: "Purchase deleted successfully",
        severity: "success",
      });
      await fetchData();
    } catch {
      setSnackbar({ open: true, message: "Delete failed", severity: "error" });
    }
  }, [apiUrl, fetchData]);

  // Helper for formatting numbers with comma and point (local)
  const formatAmount = (value?: number) =>
    typeof value === "number"
      ? value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      : "";

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });
  };

  // Format loss percentages with 3 decimal places
  const formatLoss = (value?: number) =>
    typeof value === "number"
      ? value.toLocaleString(undefined, {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      })
      : "";

  const handleExportExcel = () => {
    const headers = [
      "System ID",
      "Product Name",
      "Date",
      "Full Weight",
      "Net Weight",
      "User",
      "Supplier",
      "Document No",
      "Stone Details",
      "Net Details",
      "Purity",
      "Pure Wt",
      "Making Stone Rate",
      "Making Stone Value",
      "Metal Value",
    ];
    const rows = data.map((boxe) => [
      boxe.id_achat,
      boxe.Comment_Achat,
      formatDate(boxe.Date_Achat),
      formatAmount(boxe.FullWeight),
      formatAmount(boxe.NetWeight),
      boxe.user?.name_user || boxe.user?.name || boxe.Usr,
      suppliers.find((s) => s.id_client === boxe.Brand)?.client_name ||
      boxe.Brand ||
      "",
      boxe.DocumentNo,
      boxe.Stone_Details,
      boxe.Net_Details,
      boxe.Purity,
      boxe.PureWt,
      boxe.MakingStoneRate,
      boxe.MakingStoneValue,
      boxe.MetalValue,
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "purchases");
    XLSX.writeFile(workbook, "purchases.xlsx");
    setSnackbar({ open: true, message: "Excel exported", severity: "info" });
  };

  const handleOpenBrandCost = () => {
    setSelectedBrand(null);
    setBrandCosts({
      MakingCharge: 0,
      ShippingCharge: 0,
      TravelExpesenes: 0,
      LossExpesenes: 0,
      IndirectCost: 0,
    });
    setOpenBrandCostDialog(true);
  };

  const handleSaveBrandCosts = async () => {
    if (!selectedBrand) {
      setSnackbar({ open: true, message: "Please select a brand", severity: "warning" });
      return;
    }
    const token = localStorage.getItem("token");
    try {
      await axios.put(
        `${apiUrl}/UpdateCostsByBrand/${selectedBrand.id_client}`,
        { ...brandCosts },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSnackbar({ open: true, message: "Costs updated for brand", severity: "success" });
      setOpenBrandCostDialog(false);
      await fetchData();
    } catch (e: any) {
      setSnackbar({
        open: true,
        message: e?.response?.data?.message || "Failed to update costs",
        severity: "error",
      });
    }
  };

  // --- Attachment logic ---
  const handleOpenAttachmentDialog = (row: OPurchae) => {
    setAttachmentDialog({ open: true, row });
  };

  const handleCloseAttachmentDialog = () => {
    setAttachmentDialog({ open: false, row: null });
  };

  const handleOpenDistributionDialog = async (purchase: OPurchae) => {
    setDistributionDialog({ open: true, purchase });
    setLoadingDistributions(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("/Dpurchases/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Filter by PurchaseID and PurchaseType === 'Gold Purchase'
      setDistributions(
        res.data.filter(
          (d: any) =>
            d.PurchaseID === purchase.id_achat &&
            d.PurchaseType === "Gold Purchase"
        )
      );
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to load distributions",
        severity: "error",
      });
    } finally {
      setLoadingDistributions(false);
    }
  };

  const columns = useMemo<MRT_ColumnDef<OPurchae>[]>(
    () => [
      { accessorKey: "id_achat", header: "System ID", size: 60 },
      { accessorKey: "Comment_Achat", header: "Product Name", size: 120 },
      {
        accessorKey: "Date_Achat",
        header: "Date",
        size: 140,
        Cell: ({ cell }) => formatDate(cell.getValue<string>()),
      },
      {
        accessorKey: "FullWeight",
        header: "Full Weight",
        size: 100,
        Cell: ({ cell }) => formatAmount(cell.getValue<number>()),
      },
      {
        accessorKey: "NetWeight",
        header: "Net Weight",
        size: 100,
        Cell: ({ cell }) => formatAmount(cell.getValue<number>()),
      },
      {
        accessorKey: "user",
        header: "Created By",
        size: 120,
        Cell: ({ row }) =>
          row.original.user?.name_user ||
          row.original.user?.name ||
          row.original.Usr ||
          "",
      },
      {
        id: "Supplier",
        header: "Supplier",
        size: 140,
        accessorFn: (row) =>
          suppliers.find((s) => s.id_client === row.Brand)?.client_name || "",
        filterFn: "includesString",
        filterVariant: "autocomplete",
        filterSelectOptions: suppliers.map((s) => s.client_name),
      },
      {
        accessorKey: "DocumentNo",
        header: "Document No",
        size: 120,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <span>{row.original.DocumentNo}</span>
            {row.original.IsApprouved === "Accepted" ? (
              <Tooltip title="Verified">
                <CheckCircleIcon color="success" fontSize="small" />
              </Tooltip>
            ) : (
              <Tooltip title="In Progress">
                <HourglassEmptyIcon color="warning" fontSize="small" />
              </Tooltip>
            )}
          </Box>
        ),
      },
      { accessorKey: "Stone_Details", header: "Stone Details", size: 100 },
      { accessorKey: "Net_Details", header: "Net Details", size: 100 },
      // { accessorKey: 'Purity', header: 'Purity', size: 80 },
      // { accessorKey: 'PureWt', header: 'Pure Wt', size: 80 },
      {
        accessorKey: "MakingStoneRate",
        header: "Making Stone Rate",
        size: 100,
      },
      {
        accessorKey: "MakingStoneValue",
        header: "Making Stone Value",
        size: 100,
      },
      { accessorKey: "MetalValue", header: "Metal Value", size: 100 },
      {
        header: "Attachment",
        id: "attachment",
        size: 140,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Tooltip title="Open Attachments">
              <IconButton
                color="primary"
                onClick={() => handleOpenAttachmentDialog(row.original)}
                size="small"
              >
                <AttachFileIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Send Approval Email">
              <IconButton
                color="secondary"
                size="small"
                onClick={async () => {
                  const email = "hasni.zied@gmail.com";
                  if (!email) return;
                  setSendingEmail(true);
                  setEmailProgress(0);

                  // Simulate progress
                  let progress = 0;
                  const interval = setInterval(() => {
                    progress += Math.floor(Math.random() * 10) + 5;
                    setEmailProgress(progress > 95 ? 95 : progress);
                  }, 200);

                  try {
                    await axios.post("/Opurchases/send-approval", {
                      id_achat: row.original.id_achat,
                      email,
                      purchaseInfo: {
                        Comment_Achat: row.original.Comment_Achat,
                        Date_Achat: row.original.Date_Achat,
                        FullWeight: row.original.FullWeight,
                        NetWeight: row.original.NetWeight,
                        Supplier:
                          suppliers.find(
                            (s) => s.id_client === row.original.Brand
                          )?.client_name || "",
                        DocumentNo: row.original.DocumentNo,
                        Stone_Details: row.original.Stone_Details,
                        Net_Details: row.original.Net_Details,
                        //Purity: row.original.Purity,
                        // PureWt: row.original.PureWt,
                        MakingStoneRate: row.original.MakingStoneRate,
                        MakingStoneValue: row.original.MakingStoneValue,
                        MetalValue: row.original.MetalValue,
                      },
                    });
                    setSnackbar({
                      open: true,
                      message: "Approval email sent!",
                      severity: "success",
                    });
                  } catch (err) {
                    setSnackbar({
                      open: true,
                      message: "Failed to send email",
                      severity: "error",
                    });
                  } finally {
                    clearInterval(interval);
                    setEmailProgress(100);
                    setTimeout(() => {
                      setSendingEmail(false);
                      setEmailProgress(0);
                    }, 500);
                  }
                }}
              >
                <EmailIcon fontSize="small" />
              </IconButton>
            </Tooltip>
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
            <Tooltip title="Distribute">
              <IconButton
                color="info"
                onClick={() => handleOpenDistributionDialog(row.original)}
                size="small"
              >
                <ImportExportIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ),
      },
      // 5. Add columns to the table
      {
        accessorKey: "MakingCharge",
        header: "Making Charge",
        size: 100,
        Cell: ({ cell }) => formatAmount(cell.getValue<number>()),
      },
      {
        accessorKey: "ShippingCharge",
        header: "Shipping Charge",
        size: 100,
        Cell: ({ cell }) => formatAmount(cell.getValue<number>()),
      },
      {
        accessorKey: "TravelExpesenes",
        header: "Travel Expenses",
        size: 100,
        Cell: ({ cell }) => formatAmount(cell.getValue<number>()),
      },
      {
        accessorKey: "LossExpesenes",
        header: "Loss Expenses (%)",
        size: 100,
        Cell: ({ cell }) => formatLoss(cell.getValue<number>()),
      },
      {
        accessorKey: "IndirectCost",
        header: "Indirect Cost",
        size: 100,
        Cell: ({ cell }) => formatAmount(cell.getValue<number>()),
      },
      {
        accessorKey: "cost_g",
        header: "Cost (g)",
        size: 100,
        Cell: ({ cell }) => formatAmount(cell.getValue<number>()),
      },
      {
        accessorKey: "Rate",
        header: "Rate",
        size: 100,
        Cell: ({ cell }) => formatAmount(cell.getValue<number>()),
      },
      {
        accessorKey: "cost_g_LYD",
        header: "Cost (g) LYD",
        size: 100,
        Cell: ({ cell }) => formatAmount(cell.getValue<number>()),
      },
      {
        header: "Edit Cost",
        id: "journal",
        size: 80,
        Cell: ({ row }) => (
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleOpenJournalDialog(row.original)}
          >
            Edit
          </Button>
        ),
      },
    ],
    [suppliers, handleEdit, handleDelete]
  );

  // Compute rows missing costs or having LossExpesenes == 2
  const missingCostRows = useMemo(() =>
    data.filter((r) =>
      r.MakingCharge == null ||
      r.ShippingCharge == null ||
      r.TravelExpesenes == null ||
      r.LossExpesenes == null ||
      r.LossExpesenes === 2
    ),
    [data]);

  const brandsWithCompleteCosts = useMemo(() => {
    const goodBrandIds = new Set<number>();
    data.forEach((r) => {
      if (
        r.Brand != null &&
        r.MakingCharge != null &&
        r.ShippingCharge != null &&
        r.TravelExpesenes != null &&
        r.LossExpesenes != null &&
        r.LossExpesenes !== 2
      ) {
        goodBrandIds.add(r.Brand as number);
      }
    });
    const names = suppliers
      .filter((s) => goodBrandIds.has(s.id_client))
      .map((s) => s.client_name);
    return Array.from(new Set(names)).sort();
  }, [data, suppliers]);

  const brandsWithIncompleteCosts = useMemo(() => {
    const badBrandIds = new Set<number>();
    data.forEach((r) => {
      if (
        r.Brand != null && (
          r.MakingCharge == null ||
          r.ShippingCharge == null ||
          r.TravelExpesenes == null ||
          r.LossExpesenes == null ||
          r.LossExpesenes === 2
        )
      ) {
        badBrandIds.add(r.Brand as number);
      }
    });
    const names = suppliers
      .filter((s) => badBrandIds.has(s.id_client))
      .map((s) => s.client_name);
    return Array.from(new Set(names)).sort();
  }, [data, suppliers]);

  const table = useMaterialReactTable({
    columns,
    data,
    state: { isLoading: loading, density: "compact" },
    enableDensityToggle: true,
    enableColumnFilters: true,
    enableGlobalFilter: true,
    initialState: {
      showColumnFilters: true,
      showGlobalFilter: true,
      columnVisibility: {
        MetalValue: false,
        Stone_Details: false,
        Net_Details: false,
        // Purity: false,
        //PureWt: false,
        MakingStoneRate: false,
        MakingStoneValue: false,
        // Hide journal columns:
        MakingCharge: false,
        ShippingCharge: false,
        TravelExpesenes: false,
        IndirectCost: false,
        LossExpesenes: false,
        cost_g: false,
        Rate: false,
        cost_g_LYD: false,
      },
    },
  });

  // 3. Handler to open dialog and populate fields
  const handleOpenJournalDialog = (row: OPurchae) => {
    setJournalRow(row);
    setJournalFields({
      MakingCharge: row.MakingCharge ?? 0,
      ShippingCharge: row.ShippingCharge ?? 0,
      TravelExpesenes: row.TravelExpesenes ?? 0,
      LossExpesenes: row.LossExpesenes ?? 0,
      IndirectCost: row.IndirectCost ?? 0,
      cost_g: row.cost_g ?? 0,
      Rate: row.Rate ?? 0,
      cost_g_LYD: row.cost_g_LYD ?? 0,
      ounceCost: row.ounceCost ?? 0,
    });
    setOpenJournalDialog(true);
  };

  // 4. Handler to save changes
  const handleSaveJournal = async () => {
    if (!journalRow) return;
    const token = localStorage.getItem("token");
    try {
      await axios.put(
        `${apiUrl}/Update/${journalRow.id_achat}`,
        {
          ...journalRow,
          ...journalFields,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSnackbar({
        open: true,
        message: "Journal updated",
        severity: "success",
      });
      await fetchData();
      setOpenJournalDialog(false);
      setJournalRow(null);
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to update journal",
        severity: "error",
      });
    }
  };

  return (
    <Box p={0.5}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Typography
          color="text.primary"
          variant="h5"
          sx={{ fontWeight: "bold" }}
        >
          Purchase List
        </Typography>
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={handleOpenBrandCost}
            sx={{
              borderRadius: 3,
              textTransform: "none",
              fontWeight: "bold",
              px: 3,
              py: 1,
            }}
          >
            Edit Cost by Brand
          </Button>
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
            New Purchase
          </Button>
        </Box>
      </Box>



      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        {brandsWithCompleteCosts.map((name) => (
          <Box
            key={`ok-${name}`}
            sx={{
              px: 1.25,
              py: 0.5,
              borderRadius: 2,
              bgcolor: 'rgba(76,175,80,0.08)',
              border: '1px solid rgba(76,175,80,0.3)',
              fontSize: 12,
            }}
          >
            {name}
          </Box>
        ))}
        {brandsWithIncompleteCosts.map((name) => (
          <Box
            key={`bad-${name}`}
            sx={{
              px: 1.25,
              py: 0.5,
              borderRadius: 2,
              bgcolor: 'rgba(244,67,54,0.08)',
              border: '1px solid rgba(244,67,54,0.3)',
              fontSize: 12,
            }}
          >
            {name}
          </Box>
        ))}
      </Box>

      <MaterialReactTable table={table} />

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>
          {isEditMode ? "Edit Purchase" : "New Purchase"}
          <Divider sx={{ mb: 0 }} />
        </DialogTitle>

        <DialogContent>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
              mt: 2,
            }}
          >
            <TextField
              label="Comment"
              fullWidth
              required
              value={editOPurchase?.Comment_Achat || ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  Comment_Achat: e.target.value,
                })
              }
              error={!!errors.Comment_Achat}
              helperText={errors.Comment_Achat}
            />
            <TextField
              label="Date"
              type="date"
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
              value={editOPurchase?.Date_Achat || ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  Date_Achat: e.target.value,
                })
              }
              error={!!errors.Date_Achat}
              helperText={errors.Date_Achat}
            />
            <TextField
              label="Full Weight"
              type="number"
              fullWidth
              required
              value={editOPurchase?.FullWeight || ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  FullWeight: Number(e.target.value),
                })
              }
              error={!!errors.FullWeight}
              helperText={errors.FullWeight}
            />
            <TextField
              label="Net Weight"
              type="number"
              fullWidth
              required
              value={editOPurchase?.NetWeight || ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  NetWeight: Number(e.target.value),
                })
              }
              error={!!errors.NetWeight}
              helperText={errors.NetWeight}
            />
            <Autocomplete
              id="supplier-select"
              sx={{ width: "100%" }}
              options={suppliers}
              autoHighlight
              getOptionLabel={(option) => option.client_name}
              value={editOPurchase?.supplier || null}
              onChange={(_event, newValue) => {
                setEditOPurchase((prev) => ({
                  ...prev!,
                  supplier: newValue
                    ? {
                      id_client: newValue.id_client,
                      client_name: newValue.client_name,
                      TYPE_SUPPLIER: newValue.TYPE_SUPPLIER,
                    }
                    : null,
                  Brand: newValue ? newValue.id_client : undefined,
                }));
              }}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.id_client}>
                  {option.client_name}
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Choose a Vendor"
                  error={!!errors.supplier}
                  helperText={errors.supplier}
                  required
                />
              )}
            />
            <TextField
              label="Document No"
              fullWidth
              required
              value={editOPurchase?.DocumentNo || ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  DocumentNo: e.target.value,
                })
              }
              error={!!errors.DocumentNo}
              helperText={errors.DocumentNo}
            />
            <TextField
              label="Stone Details"
              fullWidth
              required
              value={editOPurchase?.Stone_Details || ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  Stone_Details: e.target.value,
                })
              }
              error={!!errors.Stone_Details}
              helperText={errors.Stone_Details}
            />
            <TextField
              label="Net Details"
              fullWidth
              required
              value={editOPurchase?.Net_Details || ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  Net_Details: e.target.value,
                })
              }
              error={!!errors.Net_Details}
              helperText={errors.Net_Details}
            />
            {/* <TextField label="Purity" fullWidth required value={editOPurchase?.Purity || ''} onChange={e => setEditOPurchase({ ...editOPurchase!, Purity: e.target.value })} error={!!errors.Purity} helperText={errors.Purity} /> */}
            {/* <TextField label="Pure Wt" fullWidth required value={editOPurchase?.PureWt || ''} onChange={e => setEditOPurchase({ ...editOPurchase!, PureWt: e.target.value })} error={!!errors.PureWt} helperText={errors.PureWt} /> */}
            <TextField
              label="Making Stone Rate"
              fullWidth
              required
              value={editOPurchase?.MakingStoneRate || ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  MakingStoneRate: e.target.value,
                })
              }
              error={!!errors.MakingStoneRate}
              helperText={errors.MakingStoneRate}
            />
            <TextField
              label="Making Stone Value"
              fullWidth
              required
              value={editOPurchase?.MakingStoneValue || ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  MakingStoneValue: e.target.value,
                })
              }
              error={!!errors.MakingStoneValue}
              helperText={errors.MakingStoneValue}
            />
            <TextField
              label="Metal Value"
              fullWidth
              required
              value={editOPurchase?.MetalValue || ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  MetalValue: e.target.value,
                })
              }
              error={!!errors.MetalValue}
              helperText={errors.MetalValue}
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

      {/* Attachment Dialog (replaced by AttchOPFiles component) */}
      <AttchOPFiles
        open={attachmentDialog.open}
        onClose={handleCloseAttachmentDialog}
        purchase={attachmentDialog.row}
        onUploaded={fetchData}
      />

      <Dialog
        open={distributionDialog.open}
        onClose={() => setDistributionDialog({ open: false, purchase: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Distribute Purchase #{distributionDialog.purchase?.id_achat}
          <Divider sx={{ mb: 0 }} />
        </DialogTitle>
        <DialogContent>
          {/* --- Show Net Weight, Distributed, and Difference with "g" --- */}
          <Box sx={{ mb: 2, display: "flex", gap: 4, flexWrap: "wrap" }}>
            <Typography variant="body2">
              <b>Net Weight:</b>{" "}
              {formatAmount(distributionDialog.purchase?.NetWeight ?? 0)} g
            </Typography>
            <Typography variant="body2">
              <b>Distributed:</b>{" "}
              {formatAmount(
                distributions.reduce(
                  (sum, d) => sum + (Number(d.Weight) || 0),
                  0
                )
              )}{" "}
              g
            </Typography>
            <Typography variant="body2">
              <b>Difference:</b>{" "}
              {formatAmount(
                (distributionDialog.purchase?.NetWeight ?? 0) -
                distributions.reduce(
                  (sum, d) => sum + (Number(d.Weight) || 0),
                  0
                )
              )}{" "}
              g
            </Typography>
          </Box>
          {/* --- END NEW --- */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Add Distribution
            </Typography>
            <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
              <Autocomplete
                options={psList}
                getOptionLabel={(option) => option.name_point}
                value={
                  psList.find((ps) => ps.Id_point === newDistribution.ps) ||
                  null
                }
                onChange={(_e, value) =>
                  setNewDistribution((nd) => ({
                    ...nd,
                    ps: value ? value.Id_point : 0,
                  }))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Point of Sale"
                    size="small"
                    error={!!distributionErrors.ps}
                    helperText={distributionErrors.ps ? "Required" : ""}
                  />
                )}
                sx={{ minWidth: 180 }}
              />
              <TextField
                label="Weight"
                type="number"
                value={newDistribution.Weight}
                onChange={(e) =>
                  setNewDistribution((nd) => ({
                    ...nd,
                    Weight: Number(e.target.value),
                  }))
                }
                size="small"
                fullWidth
                error={!!distributionErrors.Weight}
                helperText={distributionErrors.Weight ? "Required" : ""}
                InputProps={{
                  endAdornment: <span style={{ marginLeft: 4 }}>g</span>,
                }}
              />
              <TextField
                label="Date"
                type="date"
                value={newDistribution.distributionDate}
                onChange={(e) =>
                  setNewDistribution((nd) => ({
                    ...nd,
                    distributionDate: e.target.value,
                  }))
                }
                size="small"
                sx={{ minWidth: 180 }}
                InputLabelProps={{ shrink: true }}
                error={!!distributionErrors.distributionDate}
                helperText={
                  distributionErrors.distributionDate ? "Required" : ""
                }
              />
              {/* Hide Add button if difference is 0 */}
              {(distributionDialog.purchase?.NetWeight ?? 0) -
                distributions.reduce(
                  (sum, d) => sum + (Number(d.Weight) || 0),
                  0
                ) >
                0 && (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={async () => {
                      if (!distributionDialog.purchase) return;
                      // Validation for required fields
                      const errors = {
                        ps: !newDistribution.ps,
                        Weight: !newDistribution.Weight,
                        distributionDate: !newDistribution.distributionDate,
                      };
                      setDistributionErrors(errors);

                      if (errors.ps || errors.Weight || errors.distributionDate) {
                        setSnackbar({
                          open: true,
                          message:
                            "All fields (Point of Sale, Weight, Date) are required.",
                          severity: "warning",
                        });
                        return;
                      }

                      // Prevent distributing more than Net Weight
                      const distributed = distributions.reduce(
                        (sum, d) => sum + (Number(d.Weight) || 0),
                        0
                      );
                      const netWeight =
                        distributionDialog.purchase?.NetWeight ?? 0;
                      if (
                        distributed + Number(newDistribution.Weight) >
                        netWeight
                      ) {
                        setSnackbar({
                          open: true,
                          message: "Cannot distribute more than the Net Weight.",
                          severity: "error",
                        });
                        setDistributionErrors((prev) => ({
                          ...prev,
                          Weight: true,
                        }));
                        return;
                      }

                      const token = localStorage.getItem("token");
                      try {
                        await axios.post(
                          "/Dpurchases/Add",
                          {
                            ...newDistribution,
                            usr: Cuser,
                            PurchaseID: distributionDialog.purchase.id_achat,
                          },
                          {
                            headers: { Authorization: `Bearer ${token}` },
                          }
                        );
                        setSnackbar({
                          open: true,
                          message: "Distribution added",
                          severity: "success",
                        });
                        // Refresh list
                        const res = await axios.get(`/Dpurchases/all`, {
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        setDistributions(
                          res.data.filter(
                            (d: any) =>
                              d.PurchaseID ===
                              distributionDialog.purchase!.id_achat &&
                              d.PurchaseType === "Gold Purchase"
                          )
                        );
                        setNewDistribution({
                          ps: 0,
                          Weight: 0,
                          distributionDate: new Date().toISOString().slice(0, 10),
                          PurchaseType: "Gold Purchase",
                        });
                        setDistributionErrors({});
                      } catch {
                        setSnackbar({
                          open: true,
                          message: "Failed to add distribution",
                          severity: "error",
                        });
                      }
                    }}
                  >
                    Add
                  </Button>
                )}
            </Box>
            <Divider />
          </Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Distributions
          </Typography>
          <Box sx={{ maxHeight: 200, overflow: "auto" }}>
            {loadingDistributions ? (
              <Typography>Loading...</Typography>
            ) : (
              <>
                {/* Hidden printable area for all distributions */}
                <div id="print-receipt-area" style={{ display: "none" }}>
                  <div
                    style={{
                      width: 160,
                      height: 80,
                      textAlign: "left",
                      marginBottom: 8,
                      overflow: "hidden",
                    }}
                  >
                    <Logo />
                  </div>
                  <h2 style={{ textAlign: "center" }}>
                    Distribution Transaction
                  </h2>
                  <p>
                    <b>Purchase ID:</b> {distributionDialog.purchase?.id_achat}
                  </p>
                  <table>
                    <thead>
                      <tr>
                        <th>PS</th>
                        <th>Weight (g)</th>
                        <th>Date</th>
                        <th>Distribution ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {distributions.map((dist) => (
                        <tr key={dist.distributionID}>
                          <td>
                            {psList.find((ps) => ps.Id_point === dist.ps)
                              ?.name_point || dist.ps}
                          </td>
                          <td>{formatAmount(dist.Weight)} g</td>
                          <td>{dist.distributionDate?.slice(0, 10)}</td>
                          <td>{dist.distributionID}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Clarification and signature area */}
                  <div
                    style={{ marginTop: 32, fontSize: 14, textAlign: "center" }}
                  >
                    <b>ملاحظة هامة:</b>
                    <div>
                      يجب على محاسب الفرع أن يدخل إلى النظام والقيام باستلام هذا
                      الطرد ومطابقته، لأنها حالياً تعتبر في عهدته.
                      <br />
                      كما يجب إضافة توقيع المستلم.
                    </div>
                    <hr style={{ margin: "16px 0" }} />
                    <b>Important Note:</b>
                    <div>
                      The branch accountant must log into the system to receive
                      and verify this package, as it is currently under their
                      responsibility.
                      <br />
                      The recipient's signature must also be added.
                    </div>
                    <div style={{ marginTop: 24, textAlign: "left" }}>
                      <b>توقيع المستلم / Recipient Signature:</b>
                      <div
                        style={{
                          borderBottom: "1px solid #888",
                          width: 220,
                          height: 32,
                          marginTop: 8,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th>PS</th>
                      <th>Weight</th>
                      <th>Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distributions.map((dist) => (
                      <tr key={dist.distributionID}>
                        <td>
                          {psList.find((ps) => ps.Id_point === dist.ps)
                            ?.name_point || dist.ps}
                        </td>
                        <td>{formatAmount(dist.Weight)} g</td>
                        <td>{dist.distributionDate?.slice(0, 10)}</td>
                        <td>
                          <Button
                            color="error"
                            size="small"
                            onClick={() => setPendingDeleteDist(dist)}
                          >
                            Delete
                          </Button>
                          <Button
                            color="primary"
                            size="small"
                            sx={{ ml: 1 }}
                            onClick={() => {
                              const printAreaId = `print-distribution-${dist.distributionID}`;
                              const printContents =
                                document.getElementById(printAreaId)?.innerHTML;
                              const printWindow = window.open(
                                "",
                                "",
                                "height=600,width=800"
                              );
                              if (printWindow && printContents) {
                                printWindow.document.write(
                                  "<html><head><title>Distribution Receipt</title>"
                                );
                                printWindow.document.write(
                                  "<style>body{font-family:sans-serif;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ccc;padding:8px;text-align:left;} th{background:#eee;}</style>"
                                );
                                printWindow.document.write("</head><body>");
                                printWindow.document.write(printContents);
                                printWindow.document.write("</body></html>");
                                printWindow.document.close();
                                printWindow.focus();
                                setTimeout(() => printWindow.print(), 500);
                              }
                            }}
                          >
                            Print Receipt
                          </Button>
                          {/* Hidden printable area for this row */}
                          <div
                            id={`print-distribution-${dist.distributionID}`}
                            style={{ display: "none" }}
                          >
                            <div
                              style={{
                                width: 160,
                                height: 80,
                                textAlign: "left",
                                marginBottom: 8,
                                overflow: "hidden",
                              }}
                            >
                              <Logo />
                            </div>
                            <h2 style={{ textAlign: "center" }}>
                              Transfer No : {dist.distributionID}
                            </h2>
                            <table>
                              <tbody>
                                <tr>
                                  <th>PS</th>
                                  <td>
                                    {psList.find(
                                      (ps) => ps.Id_point === dist.ps
                                    )?.name_point || dist.ps}
                                  </td>
                                </tr>
                                <tr>
                                  <th>Weight (g)</th>
                                  <td>{dist.Weight}</td>
                                </tr>
                                <tr>
                                  <th>Date</th>
                                  <td>{dist.distributionDate?.slice(0, 10)}</td>
                                </tr>

                                <tr>
                                  <th>Purchase ID</th>
                                  <td>
                                    {distributionDialog.purchase?.id_achat}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                            {/* Clarification and signature area */}
                            <div
                              style={{
                                marginTop: 32,
                                fontSize: 14,
                                textAlign: "center",
                              }}
                            >
                              <b>ملاحظة هامة:</b>
                              <div>
                                يجب على محاسب الفرع أن يدخل إلى النظام والقيام
                                باستلام هذا الطرد ومطابقته، لأنها حالياً تعتبر
                                في عهدته.
                                <br />
                                كما يجب إضافة توقيع المستلم.
                              </div>
                              <hr style={{ margin: "16px 0" }} />
                              <b>Important Note:</b>
                              <div>
                                The branch accountant must log into the system
                                to receive and verify this package, as it is
                                currently under their responsibility.
                                <br />
                                The recipient's signature must also be added.
                              </div>
                              <div style={{ marginTop: 24, textAlign: "left" }}>
                                <b>توقيع المستلم / Recipient Signature:</b>
                                <div
                                  style={{
                                    borderBottom: "1px solid #888",
                                    width: 220,
                                    height: 32,
                                    marginTop: 8,
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {distributions.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          style={{ textAlign: "center", color: "#888" }}
                        >
                          No distributions yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => {
              const printContents =
                document.getElementById("print-receipt-area")?.innerHTML;
              const printWindow = window.open("", "", "height=600,width=800");
              if (printWindow && printContents) {
                printWindow.document.write(
                  "<html><head><title>Distribution Receipt</title>"
                );
                printWindow.document.write(
                  "<style>body{font-family:sans-serif;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ccc;padding:8px;text-align:left;} th{background:#eee;}</style>"
                );
                printWindow.document.write("</head><body>");
                printWindow.document.write(printContents);
                printWindow.document.write("</body></html>");
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => printWindow.print(), 500);
              }
            }}
          >
            Print All Receipt
          </Button>

          <Button
            onClick={() =>
              setDistributionDialog({ open: false, purchase: null })
            }
            variant="outlined"
            color="inherit"
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!pendingDeleteDist}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        onClose={() => setPendingDeleteDist(null)}
      >
        <Box
          sx={{
            background: "#fff",
            color: "#222",
            //  border: '2px solid #f44336',
            boxShadow: 6,
            minWidth: 340,
            textAlign: "center",
            borderRadius: 2,
            p: 2,
          }}
        >
          <Typography sx={{ mb: 1, fontWeight: "bold", color: "#f44336" }}>
            Confirm Deletion
          </Typography>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to delete this distribution?
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "center", gap: 2 }}>
            <Button
              variant="contained"
              color="error"
              onClick={async () => {
                if (!pendingDeleteDist) return;
                const token = localStorage.getItem("token");
                try {
                  await axios.delete(
                    `/Dpurchases/Delete/${pendingDeleteDist.distributionID}`,
                    {
                      headers: { Authorization: `Bearer ${token}` },
                    }
                  );
                  setSnackbar({
                    open: true,
                    message: "Distribution deleted",
                    severity: "success",
                  });
                  setDistributions((prev) =>
                    prev.filter(
                      (d) =>
                        d.distributionID !== pendingDeleteDist.distributionID
                    )
                  );
                } catch {
                  setSnackbar({
                    open: true,
                    message: "Failed to delete",
                    severity: "error",
                  });
                } finally {
                  setPendingDeleteDist(null);
                }
              }}
            >
              Yes, Delete
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => setPendingDeleteDist(null)}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      </Snackbar>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Backdrop
        sx={{
          color: "#fff",
          zIndex: (theme) => theme.zIndex.drawer + 1,
          flexDirection: "column",
        }}
        open={sendingEmail}
      >
        <Box
          sx={{
            width: 300,
            bgcolor: "background.paper",
            p: 4,
            borderRadius: 2,
            boxShadow: 3,
            textAlign: "center",
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, color: "text.primary" }}>
            Sending Approval Email...
          </Typography>
          <LinearProgress
            variant="determinate"
            value={emailProgress}
            sx={{ height: 10, borderRadius: 5, mb: 2 }}
          />
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
            {emailProgress}%
          </Typography>
        </Box>
      </Backdrop>

      {/* Edit Cost by Brand Dialog */}
      <Dialog
        open={openBrandCostDialog}
        onClose={() => setOpenBrandCostDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Edit Cost by Brand
          <Divider sx={{ mb: 0 }} />
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
            <Autocomplete
              options={suppliers}
              getOptionLabel={(o) => o.client_name}
              value={selectedBrand}
              onChange={(_e, v) => setSelectedBrand(v)}
              renderInput={(params) => (
                <TextField {...params} label="Gold Brand" placeholder="Select brand" />
              )}
            />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <TextField
                label="Making Charge (USD/g)"
                type="number"
                value={brandCosts.MakingCharge}
                onChange={(e) => setBrandCosts((c) => ({ ...c, MakingCharge: Number(e.target.value) }))}
              />
              <TextField
                label="Shipping Charge (USD/g)"
                type="number"
                value={brandCosts.ShippingCharge}
                onChange={(e) => setBrandCosts((c) => ({ ...c, ShippingCharge: Number(e.target.value) }))}
              />
              <TextField
                label="Travel Expenses (USD/g)"
                type="number"
                value={brandCosts.TravelExpesenes}
                onChange={(e) => setBrandCosts((c) => ({ ...c, TravelExpesenes: Number(e.target.value) }))}
              />
              <TextField
                label="Loss Expenses (%)"
                type="number"
                value={brandCosts.LossExpesenes?.toFixed(3)}
                onChange={(e) => setBrandCosts((c) => ({ ...c, LossExpesenes: e.target.value === '' ? 0 : parseFloat(e.target.value) }))}
                inputProps={{ step: "0.001" }}
              />
              <TextField
                label="Indirect Cost (%)"
                type="number"
                value={brandCosts.IndirectCost}
                onChange={(e) => setBrandCosts((c) => ({ ...c, IndirectCost: Number(e.target.value) }))}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Note: Updates apply to all purchases for the selected brand.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBrandCostDialog(false)} color="inherit" variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleSaveBrandCosts} color="primary" variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* 6. Add the dialog component in the return block (before export default) */}
      <Dialog
        open={openJournalDialog}
        onClose={() => setOpenJournalDialog(false)}
        maxWidth="md"
        fullWidth
        sx={{
          "& .MuiDialog-paper": {
            minWidth: 500,
            maxWidth: 800,
          },
        }}
      >
        <DialogTitle>Edit Journal Fields</DialogTitle>
        <DialogContent sx={{ minWidth: 600 }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              gap: 2,
              mt: 1,
              minWidth: 420,
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                ml: 2,
                mt: 1,
                minWidth: 280,
              }}
            >
              <TextField
                label="Making Charge"
                type="number"
                value={journalFields.MakingCharge}
                onChange={(e) =>
                  setJournalFields((f) => ({
                    ...f,
                    MakingCharge: Number(e.target.value),
                  }))
                }
                fullWidth
              />
              <TextField
                label="Shipping Charge"
                type="number"
                value={journalFields.ShippingCharge}
                onChange={(e) =>
                  setJournalFields((f) => ({
                    ...f,
                    ShippingCharge: Number(e.target.value),
                  }))
                }
                fullWidth
              />
              <TextField
                label="Travel Expenses"
                type="number"
                value={journalFields.TravelExpesenes}
                onChange={(e) =>
                  setJournalFields((f) => ({
                    ...f,
                    TravelExpesenes: Number(e.target.value),
                  }))
                }
                fullWidth
              />
              <TextField
                label="Loss Expenses (%)"
                type="number"
                value={journalFields.LossExpesenes?.toFixed(3) ?? "0.000"}
                onChange={(e) =>
                  setJournalFields((f) => ({
                    ...f,
                    LossExpesenes: e.target.value === '' ? 0 : parseFloat(e.target.value),
                  }))
                }
                inputProps={{ step: "0.001" }}
                fullWidth
              />
              <TextField
                label="Indirect Cost (%)"
                type="number"
                value={journalFields.IndirectCost ?? 0}
                onChange={(e) =>
                  setJournalFields((f) => ({
                    ...f,
                    IndirectCost: Number(e.target.value),
                  }))
                }
                fullWidth
              />
              <TextField
                label="Cost (g) [USD]"
                type="number"
                value={journalFields.cost_g}
                onChange={(e) => {
                  const cost_g = Number(e.target.value);
                  setJournalFields((f) => ({
                    ...f,
                    cost_g,
                    cost_g_LYD: cost_g * (f.Rate || 0),
                  }));
                }}
                fullWidth
              />
              <TextField
                label="Rate"
                type="number"
                value={journalFields.Rate}
                onChange={(e) => {
                  const Rate = Number(e.target.value);
                  setJournalFields((f) => ({
                    ...f,
                    Rate,
                    cost_g_LYD: (f.cost_g || 0) * Rate,
                  }));
                }}
                fullWidth
              />
              <TextField
                label="Cost (g) [LYD]"
                type="number"
                value={journalFields.cost_g_LYD}
                InputProps={{ readOnly: true }}
                fullWidth
              />
             
            </Box>

            <Box
              sx={{
                mt: 1,
                p: 4,
                minWidth: 400,
                maxWidth: 600,
                fontSize: 18,
                border: "2px solid rgba(76, 175, 80, 0.3)",
                color: "inherit",
                backgroundColor: "rgba(76, 175, 80, 0.10)",
                borderRadius: 3,
                mx: "auto",
              }}
            >
              <Typography variant="h5">
                Net Weight: <b>{formatAmount(journalRow?.NetWeight ?? 0)} g</b>
              </Typography>

              <Divider sx={{ my: 1, borderBottomWidth: 2 }} />

              <Typography variant="body2" sx={{ mt: 1 }}>
                <b>Total (USD):</b>{" "}
                {formatAmount(
                  (journalRow?.NetWeight ?? 0) * (journalFields.cost_g || 0)
                )}
              </Typography>
              <Typography variant="body2">
                <b>Total (LYD):</b>{" "}
                {formatAmount(
                  (journalRow?.NetWeight ?? 0) * (journalFields.cost_g_LYD || 0)
                )}
              </Typography>

              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
                Add Charges:
              </Typography>
              {[
                { label: "Making Charge", value: journalFields.MakingCharge },
                {
                  label: "Shipping Charge",
                  value: journalFields.ShippingCharge,
                },
                {
                  label: "Travel Expenses",
                  value: journalFields.TravelExpesenes,
                },
              ].map((item, idx) => (
                <Typography variant="body2" key={item.label} sx={{ ml: 1 }}>
                  {item.label}: {formatAmount(item.value)} USD ×{" "}
                  {formatAmount(journalFields.Rate)} ={" "}
                  {formatAmount(item.value * (journalFields.Rate || 0))} LYD
                </Typography>
              ))}
              <Divider sx={{ my: 1, borderBottomWidth: 2 }} />
              <Typography
                variant="body2"
                sx={{ fontWeight: "bold", color: "primary.main" }}
              >
                Grand Total (USD):{" "}
                {formatAmount(
                  (journalRow?.NetWeight ?? 0) * (journalFields.cost_g || 0) +
                  journalFields.MakingCharge +
                  journalFields.ShippingCharge +
                  journalFields.TravelExpesenes
                )}
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontWeight: "bold", color: "primary.main" }}
              >
                Grand Total (LYD):{" "}
                {formatAmount(
                  (journalRow?.NetWeight ?? 0) *
                  (journalFields.cost_g_LYD || 0) +
                  (journalFields.MakingCharge +
                    journalFields.ShippingCharge +
                    journalFields.TravelExpesenes) *
                  (journalFields.Rate || 0)
                )}
              </Typography>

              <Divider sx={{ my: 1, borderBottomWidth: 2 }} />

              <Button
                sx={{ position: "revert" }}
                variant="contained"
                onClick={() => {
                  setOpenJournalDialog(false);
                  setJournalRow(null);
                }}
                color="success"
              >
                Generate Journal
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ pr: 4 }}>
          <Button
            variant="contained"
            onClick={() => setOpenJournalDialog(false)}
            color="secondary"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveJournal}
            color="primary"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OPurchase;
