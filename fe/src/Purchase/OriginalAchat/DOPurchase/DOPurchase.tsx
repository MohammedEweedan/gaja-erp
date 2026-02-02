/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState, useMemo, forwardRef, useCallback } from "react";
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
  Autocomplete,
  Link,
} from "@mui/material";
import { currencyList } from "../../../constants/currencies";

import Snackbar from "@mui/material/Snackbar";
import MuiAlert, { AlertProps } from "@mui/material/Alert";

import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import ImportExportIcon from "@mui/icons-material/ImportExport";
// Removed ImageIcon: no longer used after removing action button
import ImgDialog from "../WOPurchase/ImgDialog";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import SharePointIcon from "@mui/icons-material/Share";
import PhotoCamera from "@mui/icons-material/PhotoCamera";

import EmailIcon from "@mui/icons-material/Email";
import * as XLSX from "xlsx";
import Backdrop from "@mui/material/Backdrop";

import LinearProgress from "@mui/material/LinearProgress";
import Logo from "../../../ui-component/Logo";
import AttchDiamondFiles from "./AttchDiamondFiles";

// Simple in-memory cache to avoid refetching thumbnails repeatedly
const thumbCache = new Map<number, string>();
//const API_BASE = (process.env.REACT_APP_API_IP as string) || '';
const API_BASEI = "http://localhost:9000/api";
const Thumb: React.FC<{ idAchat: number; onClick?: () => void }> = ({
  idAchat,
  onClick,
}) => {
  const [src, setSrc] = useState<string | null>(
    thumbCache.get(idAchat) || null
  );
  const [loading, setLoading] = useState(!src);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token") || "";
    const load = async () => {
      if (thumbCache.has(idAchat)) {
        setSrc(thumbCache.get(idAchat)!);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASEI}/images/list/diamond/${idAchat}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        let firstUrl: string | undefined;
        if (Array.isArray(data) && data.length > 0) {
          if (typeof data[0] === "string") {
            firstUrl = data[0];
          } else if (typeof data[0] === "object" && data[0]) {
            const obj = data[0] as Record<string, any>;
            const key = Object.keys(obj).find((k) =>
              ["url", "path", "filename", "name"].includes(k)
            );
            if (key) {
              if (key === "filename") {
                firstUrl = `${API_BASEI}/images/diamond/${idAchat}/${obj[key]}`;
              } else {
                firstUrl = String(obj[key]);
              }
            }
          }
        }
        if (!cancelled && firstUrl) {
          const withToken =
            firstUrl + (firstUrl.includes("?") ? "&" : "?") + `token=${token}`;
          thumbCache.set(idAchat, withToken);
          setSrc(withToken);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (!src) load();
    return () => {
      cancelled = true;
    };
  }, [idAchat, src]);

  if (loading || !src) return null;
  return (
    <Box
      onClick={onClick}
      sx={{
        width: 48,
        height: 48,
        borderRadius: 1,
        overflow: "hidden",
        border: "1px solid #e0e0e0",
        background: "#fafafa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: onClick ? "pointer" : "default",
      }}
      title={"Click to view images"}
    >
      <Box
        component="img"
        src={src}
        alt="thumb"
        sx={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </Box>
  );
};

type Supplier = {
  id_client: number;
  client_name: string;
  TYPE_SUPPLIER?: string;
};

type Vendor = {
  ExtraClient_ID: number;
  Client_Name: string;
};

type User = {
  id_user: number;
  name?: string;
  name_user?: string;
  email?: string;
};

type DOPuchase = {
  id_achat: number;
  vendorsID?: number | null;
  carat?: number;
  cut?: string;
  color?: string;
  clarity?: string;
  shape?: string;
  measurements?: string;
  depth_percent?: number;
  Usr?: number;
  table_percent?: number;
  girdle?: string;
  culet?: string;
  polish?: string;
  symmetry?: string;
  fluorescence?: string;
  certificate_number?: string;
  certificate_lab?: string;
  certificate_url?: string;
  laser_inscription?: string;
  price_per_carat?: number;
  total_price?: number;
  origin_country?: string;
  comment?: string;
  image_url?: string;
  video_url?: string;
  Comment_Achat?: string;
  DocumentNo?: string;
  IsApprouved?: string;
  Approval_Date?: string;
  ApprouvedBy?: string;
  attachmentUrl?: string;
  Date_Achat?: string;
  Brand?: number;
  supplier?: Supplier | null;
  vendor?: Vendor | null;
  user?: User;
  CODE_EXTERNAL?: string;
  comment_edit?: string;
  sharepoint_url?: string;
  MakingCharge?: number;
  ShippingCharge?: number;
  TravelExpesenes?: number;
  Rate?: number;
  Total_Price_LYD?: number;
  SellingPrice?: number;
  Design_art?: string;
  currencyRetail?: string;
};

type Product = {
  id_famille: number;
  desig_famille: string;
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

const initialBoxeState: DOPuchase = {
  id_achat: 0,
  vendorsID: null,
  carat: undefined,
  cut: "",
  color: "",
  clarity: "",
  shape: "",
  measurements: "",
  depth_percent: undefined,
  Usr: 0,
  table_percent: undefined,
  girdle: "",
  culet: "",
  polish: "",
  symmetry: "",
  fluorescence: "",
  certificate_number: "",
  certificate_lab: "",
  certificate_url: "",
  laser_inscription: "",
  price_per_carat: undefined,
  total_price: undefined,
  origin_country: "",
  comment: "",
  image_url: "",
  video_url: "",
  Comment_Achat: "",
  DocumentNo: "",
  IsApprouved: "",
  Approval_Date: "",
  ApprouvedBy: "",
  attachmentUrl: "",
  Date_Achat: new Date().toISOString().slice(0, 10),
  Brand: undefined,
  supplier: null,
  vendor: null,
  CODE_EXTERNAL: "",
  comment_edit: "",
  sharepoint_url: "",
  MakingCharge: undefined,
  ShippingCharge: undefined,
  TravelExpesenes: undefined,
  Rate: undefined,
  Total_Price_LYD: undefined,
  SellingPrice: undefined,
  Design_art: "",
  currencyRetail: "",
};

const Alert = forwardRef<HTMLDivElement, AlertProps>((props, ref) => (
  <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />
));

const DOPurchase = () => {
  let Cuser: string | null = null;
  const userStr = localStorage.getItem("user");
  if (userStr) {
    try {
      const userObj = JSON.parse(userStr);
      Cuser = userObj.Cuser ?? localStorage.getItem("Cuser");
    } catch {
      Cuser = localStorage.getItem("Cuser");
    }
  } else {
    Cuser = localStorage.getItem("Cuser");
  }

  const [data, setData] = useState<DOPuchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editOPurchase, setEditOPurchase] = useState<DOPuchase | null>(null);

  // Keep total_price automatically in sync with carat and price_per_carat
  // Ensure null total_price gets set to 0 when computed is 0.
  useEffect(() => {
    setEditOPurchase((prev) => {
      if (!prev) return prev;
      const carat = Number(prev.carat) || 0;
      const ppc = Number(prev.price_per_carat) || 0;
      const computed = carat * ppc;
      const prevTotal = prev.total_price as unknown as number | null | undefined;
      if (prevTotal == null || prevTotal !== computed) {
        return { ...prev, total_price: computed };
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOPurchase?.carat, editOPurchase?.price_per_carat]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info" | "warning";
    actionType?: string;
  }>({ open: false, message: "", severity: "success" });
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [Productsdata, setProductsdata] = useState<Product[]>([]);
  const [_loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [attachmentDialog, setAttachmentDialog] = useState<{
    open: boolean;
    row: DOPuchase | null;
  }>({ open: false, row: null });
  // Multi-file dialog handles its own state
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailProgress, setEmailProgress] = useState(0);
  const [distributionDialog, setDistributionDialog] = useState<{
    open: boolean;
    purchase: DOPuchase | null;
  }>({ open: false, purchase: null });
  const [distributions, setDistributions] = useState<DistributionPurchase[]>(
    []
  );
  const [newDistribution, setNewDistribution] = useState<{
    ps: number;
    distributionDate: string;
  }>({ ps: 0, distributionDate: new Date().toISOString().slice(0, 10) });
  const [_loadingDistributions, setLoadingDistributions] = useState(false);
  const [psList, setPsList] = useState<Ps[]>([]);
  // removed unused pendingDeleteDist state
  const [distributionReady, setDistributionReady] = useState(false);
  const [distributionErrors, setDistributionErrors] = useState<{ ps?: string }>(
    {}
  );
  const [pendingDistribution, setPendingDistribution] = useState(false);
  const [showNotif, setShowNotif] = useState(true);
  const [showOnlyNotDistributed, setShowOnlyNotDistributed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean;
    row: DOPuchase | null;
  }>({
    open: false,
    row: null,
  });
  const [costDialog, setCostDialog] = useState<{
    open: boolean;
    row: DOPuchase | null;
  }>({ open: false, row: null });
  const [costFields, setCostFields] = useState<{
    MakingCharge?: number;
    ShippingCharge?: number;
    TravelExpesenes?: number;
    Rate?: number;
    Total_Price_LYD?: number;
  }>({});
  const [imgDialogOpen, setImgDialogOpen] = useState(false);
  const [imgDialogIdAchat, setImgDialogIdAchat] = useState<number | null>(null);

  const navigate = useNavigate();

  const apiUrl = `/DOpurchases`;

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/");

    try {
      const response = await axios.get<DOPuchase[]>(`/DOpurchases/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(response.data);
    } catch (error: any) {
      if (error.response?.status === 401) navigate("/");
      else
        setSnackbar({
          open: true,
          message: "Error loading data1",
          severity: "error",
        });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const fetchSuppliers = async () => {
    const apiUrlsuppliers = `/suppliers`;
    const token = localStorage.getItem("token");
    try {
      setLoadingSuppliers(true);
      const res = await axios.get<Supplier[]>(`${apiUrlsuppliers}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const goldSuppliers = res.data.filter((supplier) =>
        supplier.TYPE_SUPPLIER?.toLowerCase().includes("diamond")
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
  };

  // Fetch Vendors (for diamond purchases)
  const fetchVendors = async () => {
    const apiUrlVendors = `/vendors`;
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get<Vendor[]>(`${apiUrlVendors}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setVendors(res.data);
    } catch (error) {
      // optional: notify
    }
  };

  const fetchAllDistributions = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get("/Dpurchases/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDistributions(
        res.data.filter((d: any) => d.PurchaseType === "Diamond Purchase")
      );
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to load distributions",
        severity: "error",
      });
    }
  };

  const apiUrlProducts = `/products`;

  const fetchDataProducts = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/");

    try {
      const response = await axios.get<Product[]>(`${apiUrlProducts}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProductsdata(response.data);
    } catch (error: any) {
      if (error.response?.status === 401) navigate("/");
    } finally {
      setLoading(false);
    }
  }, [apiUrlProducts, navigate]);

  useEffect(() => {
    fetchData();
    fetchSuppliers();
    fetchVendors();
    fetchDataProducts(); // <-- Add this
  }, [fetchData, fetchDataProducts, navigate]);
  // eslint-disable-next-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    fetchAllDistributions();
  }, []);

  const handleEdit = useCallback(
    (row: DOPuchase) => {
      setEditOPurchase({
        ...row,
        supplier: suppliers.find((s) => s.id_client === row.Brand) || null,
        vendor:
          vendors.find(
            (v) => v.ExtraClient_ID === (row.vendorsID ?? undefined)
          ) || null,
      });
      setIsEditMode(true);
      setOpenDialog(true);
    },
    [suppliers, vendors]
  );

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
    if (!editOPurchase?.Design_art) newErrors.Design_art = "Required";
    if (!editOPurchase?.vendor) newErrors.vendor = "Required";
    // carat is not required, default is 1
    //if (!editOPurchase?.cut) newErrors.cut = 'Required';
    //if (!editOPurchase?.color) newErrors.color = 'Required';
    if (!editOPurchase?.CODE_EXTERNAL) newErrors.CODE_EXTERNAL = "Required";
    if (!editOPurchase?.SellingPrice && editOPurchase?.SellingPrice !== 0)
      newErrors.SellingPrice = "Required";
    if (!editOPurchase?.comment_edit) newErrors.comment_edit = "Required";
    //if (!editOPurchase?.clarity) newErrors.clarity = 'Required';
    //if (!editOPurchase?.shape) newErrors.shape = 'Required';
    //if (!editOPurchase?.measurements) newErrors.measurements = 'Required';
    //if (!editOPurchase?.depth_percent && editOPurchase?.depth_percent !== 0) newErrors.depth_percent = 'Required';
    //if (!editOPurchase?.table_percent && editOPurchase?.table_percent !== 0) newErrors.table_percent = 'Required';
    //if (!editOPurchase?.girdle) newErrors.girdle = 'Required';
    // if (!editOPurchase?.culet) newErrors.culet = 'Required';
    // if (!editOPurchase?.polish) newErrors.polish = 'Required';
    //if (!editOPurchase?.symmetry) newErrors.symmetry = 'Required';
    // if (!editOPurchase?.fluorescence) newErrors.fluorescence = 'Required';
    //if (!editOPurchase?.certificate_number) newErrors.certificate_number = 'Required';
    //if (!editOPurchase?.certificate_lab) newErrors.certificate_lab = 'Required';
    //if (!editOPurchase?.certificate_url) newErrors.certificate_url = 'Required';
    //if (!editOPurchase?.laser_inscription) newErrors.laser_inscription = 'Required';
    if (!editOPurchase?.price_per_carat && editOPurchase?.price_per_carat !== 0)
      newErrors.price_per_carat = "Required";
    // total_price is derived from carat * price_per_carat; don't force user input
    //if (!editOPurchase?.origin_country) newErrors.origin_country = 'Required';
    if (!editOPurchase?.Date_Achat) newErrors.Date_Achat = "Required";
    if (!editOPurchase?.supplier) newErrors.supplier = "Required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    console.log("[DOPurchase] Save clicked", {
      isEditMode,
      id_achat: editOPurchase?.id_achat,
    });
    if (!validateForm() || !editOPurchase) {
      console.warn("[DOPurchase] Validation failed", { errors, editOPurchase });
      return;
    }
    const token = localStorage.getItem("token");

    // Format dates
    const formatDate = (dateStr?: string) => {
      if (!dateStr) return null;
      return dateStr.slice(0, 10);
    };
    const formatDateTime = (dateStr?: string) => {
      if (!dateStr) return null;
      return dateStr.length > 10
        ? dateStr.slice(0, 19).replace("T", " ")
        : `${dateStr.slice(0, 10)} 00:00:00`;
    };

    // Prepare data
    const payload = {
      ...editOPurchase,
      Brand: editOPurchase.supplier?.id_client,
      vendorsID: editOPurchase.vendor?.ExtraClient_ID ?? null,
      Usr: Cuser,
      Date_Achat: formatDate(editOPurchase.Date_Achat),
      Approval_Date: formatDateTime(editOPurchase.Approval_Date),
    } as any;

    try {
      const url = isEditMode
        ? `${apiUrl}/Update/${editOPurchase.id_achat}`
        : `${apiUrl}/Add`;
      const method = isEditMode ? "PUT" : "POST";
      console.log("[DOPurchase] About to send request", {
        method,
        url,
        baseURL: (axios as any)?.defaults?.baseURL,
        tokenPresent: !!token,
        payloadPreview: {
          id_achat: (payload as any)?.id_achat,
          Brand: (payload as any)?.Brand,
          vendorsID: (payload as any)?.vendorsID,
          Usr: (payload as any)?.Usr,
          Date_Achat: (payload as any)?.Date_Achat,
          Approval_Date: (payload as any)?.Approval_Date,
          CODE_EXTERNAL: (payload as any)?.CODE_EXTERNAL,
          SellingPrice: (payload as any)?.SellingPrice,
          total_price: (payload as any)?.total_price,
          price_per_carat: (payload as any)?.price_per_carat,
        },
      });
      if (isEditMode) {
        await axios.put(
          url,
          payload,
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
        const { id_achat, supplier, vendor, ...purchaseData } = payload as any;
        await axios.post(url, purchaseData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSnackbar({
          open: true,
          message: "Purchase added successfully",
          severity: "success",
        });
      }
      await fetchData();
      handleCloseDialog();
    } catch (error: any) {
      console.error("[DOPurchase] Save failed", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        url: error?.config?.url,
        method: error?.config?.method,
        baseURL: error?.config?.baseURL,
        headers: error?.config?.headers,
      });
      setSnackbar({
        open: true,
        message: error.response?.data?.message || "Save failed",
        severity: "error",
      });
    }
  };

  const handleDelete = async (row: DOPuchase) => {
    // Instead of deleting immediately, show confirmation Snackbar
    setConfirmDelete({ open: true, row });
  };

  const handleRequestApproval = useCallback(
    async (row: DOPuchase) => {
      const email = "hasni.zied@gmail.com";
      if (!email) return;
      setSendingEmail(true);
      setEmailProgress(10);
      try {
        setEmailProgress(20);
        const payload = {
          id_achat: row.id_achat,
          email,
          purchaseInfo: {
            Comment_Achat: row.Comment_Achat,
            Date_Achat: row.Date_Achat,
            carat: row.carat,
            Supplier:
              suppliers.find((s) => s.id_client === row.Brand)?.client_name ||
              "",
            DocumentNo: row.DocumentNo,
            certificate_number: row.certificate_number,
            certificate_lab: row.certificate_lab,
            total_price: row.total_price,
            price_per_carat: row.price_per_carat,
            shape: row.shape,
            color: row.color,
            clarity: row.clarity,
            cut: row.cut,
          },
        };
        setEmailProgress(40);
        const token = localStorage.getItem("token");
        setEmailProgress(60);
        await axios.post(`/DOpurchases/send-approval`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setEmailProgress(90);
        setSnackbar({
          open: true,
          message: "Approval email sent!",
          severity: "success",
        });
        setEmailProgress(100);
        setTimeout(() => setSendingEmail(false), 500);
        setTimeout(() => setEmailProgress(0), 1000);
      } catch (err: any) {
        setSnackbar({
          open: true,
          message:
            err.response?.data?.message || "Failed to send approval email",
          severity: "error",
        });
        setEmailProgress(0);
        setSendingEmail(false);
      }
    },
    [suppliers]
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });
  };

  const handleExportExcel = () => {
    const headers = [
      "ID Achat",
      "Carat",
      "Cut",
      "Color",
      "Clarity",
      "Shape",
      "Measurements",
      "Depth %",
      "Table %",
      "Girdle",
      "Culet",
      "Polish",
      "Symmetry",
      "Fluorescence",
      "Certificate #",
      "Certificate Lab",
      "Certificate URL",
      "Laser Inscription",
      "Item Cost",
      "Selling Price",
      "Total Price",
      "Origin Country",
      "Comment",
      "Image URL",
      "Video URL",
      "Comment Achat",
      "Document No",
      "Is Approved",
      "Approval Date",
      "Approved By",
      "Attachment",
      "Date Achat",
      "Supplier",
    ];
    const rows = data.map((boxe) => [
      boxe.id_achat,
      boxe.carat,
      boxe.cut,
      boxe.color,
      boxe.clarity,
      boxe.shape,
      boxe.measurements,
      boxe.depth_percent,
      boxe.table_percent,
      boxe.girdle,
      boxe.culet,
      boxe.polish,
      boxe.symmetry,
      boxe.fluorescence,
      boxe.certificate_number,
      boxe.certificate_lab,
      boxe.certificate_url,
      boxe.laser_inscription,
      boxe.price_per_carat,
      boxe.SellingPrice,
      boxe.total_price,
      boxe.origin_country,
      boxe.comment,
      boxe.image_url,
      boxe.video_url,
      boxe.Comment_Achat,
      boxe.DocumentNo,
      boxe.IsApprouved,
      boxe.Approval_Date,
      boxe.ApprouvedBy,
      boxe.attachmentUrl,
      boxe.Date_Achat,
      suppliers.find((s) => s.id_client === boxe.Brand)?.client_name ||
        boxe.Brand ||
        "",
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "purchases");
    XLSX.writeFile(workbook, "diamond_purchases.xlsx");
    setSnackbar({ open: true, message: "Excel exported", severity: "info" });
  };

  // --- Attachment logic ---
  const handleOpenAttachmentDialog = (row: DOPuchase) => {
    setAttachmentDialog({ open: true, row });
    // no-op: multi-file dialog handles file selection
  };

  const handleCloseAttachmentDialog = () => {
    setAttachmentDialog({ open: false, row: null });
    // no-op: multi-file dialog handles file selection
  };

  // Removed obsolete single-file upload handlers

  const handleConfirmDistribution = async () => {
    try {
      const token = localStorage.getItem("token");
      // Find if a distribution already exists for this purchase
      const existingDist = distributions.find(
        (d) => d.PurchaseID === distributionDialog.purchase?.id_achat
      );

      if (existingDist) {
        // Update the existing distribution
        await axios.put(
          `/Dpurchases/Update/${existingDist.distributionID}`,
          {
            PurchaseID: distributionDialog.purchase?.id_achat,
            ps: newDistribution.ps,
            distributionDate: newDistribution.distributionDate,
            Weight: 1,
            PurchaseType: "Diamond Purchase",
            usr: Cuser,
            distributionISOK: false,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setSnackbar({
          open: true,
          message: "Distribution updated successfully",
          severity: "success",
        });
      } else {
        // Add a new distribution
        await axios.post(
          "/Dpurchases/Add",
          {
            PurchaseID: distributionDialog.purchase?.id_achat,
            ps: newDistribution.ps,
            distributionDate: newDistribution.distributionDate,
            Weight: 1,
            PurchaseType: "Diamond Purchase",
            usr: Cuser,
            distributionISOK: false,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setSnackbar({
          open: true,
          message: "Distributed successfully",
          severity: "success",
        });
      }

      setDistributionDialog({ open: false, purchase: null });
      await fetchData();
      await fetchAllDistributions();
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || "Distribution failed",
        severity: "error",
      });
    } finally {
      setPendingDistribution(false);
      setSnackbar((s) => ({ ...s, actionType: undefined }));
    }
  };

  const formatAmount = (value?: number) =>
    typeof value === "number"
      ? value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "";

  const handleOpenDistributionDialog = async (purchase: DOPuchase) => {
    setDistributionDialog({ open: true, purchase });
    setLoadingDistributions(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`/Dpurchases/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const filtered = res.data.filter(
        (d: any) =>
          d.PurchaseID === purchase.id_achat &&
          d.PurchaseType === "Diamond Purchase"
      );
      setDistributions(filtered);
      setDistributionReady(
        filtered.some((d: any) => d.distributionISOK === true)
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

  // --- Update columns definition for price group ---
  const columns = useMemo<MRT_ColumnDef<DOPuchase>[]>(
    () => [
      {
        header: "Add Image",
        id: "photo",
        size: 40,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Tooltip title="Add/Take photo">
              <IconButton
                size="small"
                color="primary"
                onClick={() => {
                  setImgDialogIdAchat(row.original.id_achat);
                  setImgDialogOpen(true);
                }}
              >
                <PhotoCamera fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ),
        enableColumnFilter: false,
        enableSorting: false,
      },
      // Show first image for each item, matching WOPurchase logic
      {
        header: "Image",
        id: "image-action",
        size: 60,
        Cell: ({ row }) => {
          const [thumb, setThumb] = useState<string | null>(null);
          const [loading, setLoading] = useState(false);
          const [open, setOpen] = useState(false);
          const id_achat = row.original.id_achat;
          useEffect(() => {
            let mounted = true;
            const fetchThumb = async () => {
              setLoading(true);
              const token = localStorage.getItem("token");
              try {
                const res = await axios.get(
                  `/images/list/diamond/${id_achat}`,
                  {
                    headers: { Authorization: `Bearer ${token}` },
                  }
                );
                let images = res.data;
                // If images is an array of objects, extract the url/path/filename/name
                if (
                  Array.isArray(images) &&
                  images.length > 0 &&
                  typeof images[0] === "object"
                ) {
                  const key = Object.keys(images[0]).find((k) =>
                    ["url", "path", "filename", "name"].includes(k)
                  );
                  if (key) images = images.map((img) => img[key]);
                }
                // Show the latest image (last in array) as default
                let imgUrl =
                  images.length > 0 ? images[images.length - 1] : null;
                if (imgUrl) {
                  // If not absolute, prepend API base
                  if (!/^https?:\/\//i.test(imgUrl)) {
                    imgUrl = `/images/${imgUrl}`;
                  }
                  // Always append token as query param
                  if (token) {
                    imgUrl +=
                      (imgUrl.includes("?") ? "&" : "?") +
                      "token=" +
                      encodeURIComponent(token);
                  }
                }
                if (mounted) setThumb(imgUrl);
              } catch {
                if (mounted) setThumb(null);
              } finally {
                if (mounted) setLoading(false);
              }
            };
            fetchThumb();
            return () => {
              mounted = false;
            };
          }, [id_achat]);
          
          return (
            <>
              <Box
                sx={{
                  width: 50,
                  height: 50,
                  bgcolor: "#eee",
                  borderRadius: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: thumb ? "pointer" : "default",
                }}
                onClick={() => {
                  if (thumb) setOpen(true);
                }}
              >
                {loading ? null : thumb ? (
                  <Box
                    component="img"
                    src={thumb}
                    alt="img"
                    onError={(e) => {
                      console.error(
                        "[DOPurchase] Image failed to load:",
                        thumb,
                        e
                      );
                    }}
                   
                    sx={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: 1,
                    }}
                  />
                ) : null}
              </Box>
              <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md">
                <Box
                  sx={{
                    p: 2,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    bgcolor: "#222",
                  }}
                >
                  {thumb && (
                    <Box
                      component="img"
                      src={thumb}
                      alt="zoomed-img"
                      sx={{
                        maxWidth: "80vw",
                        maxHeight: "80vh",
                        borderRadius: 2,
                        boxShadow: 3,
                      }}
                    />
                  )}
                </Box>
              </Dialog>
            </>
          );
        },
        enableSorting: false,
        enableColumnFilter: false,
      },

      {
        accessorKey: "Date_Achat",
        header: "Date Achat",
        size: 100,
        Cell: ({ cell }) => formatDate(cell.getValue<string>()),
      },
      {
        header: "Vendor",
        id: "vendorsID",
        size: 110,
        Cell: ({ row }) => (
          <Box sx={{ whiteSpace: "normal", wordBreak: "break-word" }}>
            {vendors.find(
              (v) => v.ExtraClient_ID === (row.original as any).vendorsID
            )?.Client_Name || ""}
          </Box>
        ),
      },
      {
        accessorKey: "Brand",
        header: "Brand",
        size: 100,
        Cell: ({ row }) => (
          <Box sx={{ whiteSpace: "normal", wordBreak: "break-word" }}>
            {suppliers.find((s) => s.id_client === row.original.Brand)
              ?.client_name || ""}
          </Box>
        ),
      },

      {
        accessorKey: "Design_art",
        header: "Product Type",
        size: 120,
        Cell: ({ row }) => (
          <Box sx={{ whiteSpace: "normal", wordBreak: "break-word" }}>
            {row.original.Design_art || ""}
          </Box>
        ),
      },

      {
        accessorKey: "user",
        header: "Created By",
        size: 100,
        Cell: ({ row }) =>
          row.original.user?.name_user ||
          row.original.user?.name ||
          row.original.Usr ||
          "",
      },
      {
        header: "Sales/Ref Code",
        id: "sales_ref_group",
        size: 150,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <span>
              <strong>Sales Code:</strong> {row.original.comment_edit || ""}
            </span>
            <span>
              <strong>Ref. Code:</strong> {row.original.CODE_EXTERNAL || ""}
            </span>
          </Box>
        ),
        accessorFn: (row) => `${row.comment_edit} ${row.CODE_EXTERNAL}`,
        enableColumnFilter: false,
        enableSorting: false,
      },

      { accessorKey: "id_achat", header: "ID Achat", size: 60 },

      {
        header: "Item Cost",
        id: "item_cost_group",
        size: 160,
        Cell: ({ row }) => {
          const carat = Number(row.original.carat) || 0;
          const itemCost = Number(row.original.price_per_carat) || 0;
          return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <span>
                <span>Carat:</span> {carat ? carat.toLocaleString() : ""}
              </span>
              <span>
                <span>Item Cost:</span>{" "}
                {itemCost
                  ? itemCost.toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                    })
                  : ""}
              </span>
            </Box>
          );
        },
        accessorFn: (row) =>
          `${row.carat} ${row.price_per_carat} ${row.total_price}`,
        enableColumnFilter: false,
        enableSorting: false,
      },
      {
        accessorKey: "SellingPrice",
        header: "Sales Price",
        size: 120,
        Cell: ({ cell }) =>
          typeof cell.getValue<number>() === "number" && cell.getValue<number>() !== 0
            ? cell
                .getValue<number>()
                .toLocaleString(undefined, { style: "currency", currency: "USD" })
            : "",
      },
      { accessorKey: "cut", header: "Cut", size: 80 },
      { accessorKey: "color", header: "Color", size: 60 },
      { accessorKey: "clarity", header: "Clarity", size: 80 },
      { accessorKey: "shape", header: "Shape", size: 80 },
      { accessorKey: "measurements", header: "Measurements", size: 120 },
      { accessorKey: "depth_percent", header: "Depth %", size: 80 },
      { accessorKey: "table_percent", header: "Table %", size: 80 },
      { accessorKey: "girdle", header: "Girdle", size: 80 },
      { accessorKey: "culet", header: "Culet", size: 80 },
      { accessorKey: "polish", header: "Polish", size: 80 },
      { accessorKey: "symmetry", header: "Symmetry", size: 80 },
      { accessorKey: "fluorescence", header: "Fluorescence", size: 100 },
      {
        header: "Certificate",
        id: "certificate_group",
        size: 120,
        Cell: ({ row }) => {
          const certNum = row.original.certificate_number || "";
          const certLab = row.original.certificate_lab || "";
          const certUrl = row.original.certificate_url || "";
          return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <span>
                <strong>No:</strong> {certNum}
              </span>
              <span>
                <strong>Lab:</strong> {certLab}
              </span>
              <span>
                <strong>URL:</strong>{" "}
                {certUrl ? (
                  <Link
                    href={certUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View
                  </Link>
                ) : (
                  <span style={{ color: "#aaa" }}>N/A</span>
                )}
              </span>
            </Box>
          );
        },
        accessorFn: (row) =>
          `${row.certificate_number} ${row.certificate_lab} ${row.certificate_url}`,
        enableColumnFilter: false,
        enableSorting: false,
      },
      {
        accessorKey: "laser_inscription",
        header: "Laser Inscription",
        size: 120,
      },
      // (removed old image_url column, now handled by image-action column)
      {
        accessorKey: "video_url",
        header: "Video",
        size: 80,
        Cell: ({ cell }) =>
          cell.getValue<string>() ? (
            <Link
              href={cell.getValue<string>()}
              target="_blank"
              rel="noopener noreferrer"
            >
              Video
            </Link>
          ) : (
            ""
          ),
      },
      { accessorKey: "Comment_Achat", header: "Comment", size: 120 },
      { accessorKey: "DocumentNo", header: "Document No", size: 120 },
      { accessorKey: "IsApprouved", header: "Is Approved", size: 80 },
      {
        accessorKey: "Approval_Date",
        header: "Approval Date",
        size: 100,
        Cell: ({ cell }) => formatDate(cell.getValue<string>()),
      },
      { accessorKey: "ApprouvedBy", header: "Approved By", size: 100 },

      {
        header: "Attachment",
        id: "attachment",
        size: 80,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Tooltip title="Attachments">
              <IconButton
                color="primary"
                onClick={() => handleOpenAttachmentDialog(row.original)}
                size="small"
              >
                <AttachFileIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ),
      },
      {
        header: "Edit Cost",
        id: "edit_cost",
        size: 80,
        Cell: ({ row }) => (
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setCostDialog({ open: true, row: row.original });
              setCostFields({
                MakingCharge: row.original.MakingCharge ?? 0,
                ShippingCharge: row.original.ShippingCharge ?? 0,
                TravelExpesenes: row.original.TravelExpesenes ?? 0,
                Rate: row.original.Rate ?? 0,
                Total_Price_LYD: row.original.Total_Price_LYD ?? 0,
              });
            }}
          >
            Edit
          </Button>
        ),
      },
      {
        header: "Actions",
        id: "actions",
        size: 120,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1 }}>
            {/* Hide Edit if approved */}
            {row.original.IsApprouved !== "Accepted" && (
              <Tooltip title="Edit">
                <IconButton
                  color="primary"
                  onClick={() => handleEdit(row.original)}
                  size="small"
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {/* Hide Delete if approved */}
            {row.original.IsApprouved !== "Accepted" && (
              <Tooltip title="Delete">
                <IconButton
                  color="error"
                  onClick={() => handleDelete(row.original)}
                  size="small"
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {/* Show Distribute button only if IsApprouved is Accepted */}
            {row.original.IsApprouved === "Accepted" && (
              <Tooltip title="Distribute">
                <IconButton
                  color="info"
                  onClick={() => handleOpenDistributionDialog(row.original)}
                  size="small"
                >
                  <ImportExportIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {/* Hide Request Approval if already accepted */}
            {row.original.IsApprouved !== "Accepted" && (
              <Tooltip title="Request Approval">
                <IconButton
                  color="warning"
                  onClick={() => handleRequestApproval(row.original)}
                  size="small"
                >
                  <EmailIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        ),
      },
      // {
      //   accessorKey: "sharepoint_url",
      //   header: "SharePoint",
      //   size: 70,
      //   Cell: ({ cell }) => {
      //     const url = cell.getValue<string>();
      //     if (!url) return null;

      //     let isImage = false;
      //     try {
      //       const urlObj = new URL(url);
      //       const idParam = urlObj.searchParams.get("id");
      //       if (
      //         idParam &&
      //         /\.(jpg|jpeg|png|gif|bmp|webp|svg|png)$/i.test(
      //           decodeURIComponent(idParam)
      //         )
      //       ) {
      //         isImage = true;
      //       }
      //     } catch {
      //       // fallback: check for image extension anywhere in the url
      //       isImage = /\.(jpg|jpeg|png|gif|bmp|webp|svg|png)/i.test(url);
      //     }

      //     if (isImage) {
      //       return (
      //         <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      //           <img
      //             src={url}
      //             alt="SharePoint"
      //             style={{
      //               maxWidth: 40,
      //               maxHeight: 40,
      //               borderRadius: 4,
      //               border: "1px solid #eee",
      //             }}
      //           />
      //           <Tooltip title="Open SharePoint Image">
      //             <IconButton
      //               component="a"
      //               href={url}
      //               target="_blank"
      //               rel="noopener noreferrer"
      //               color="primary"
      //               size="small"
      //             >
      //               <SharePointIcon fontSize="small" />
      //             </IconButton>
      //           </Tooltip>
      //         </Box>
      //       );
      //     }

      //     // Otherwise, show the icon link only
      //     return (
      //       <Tooltip title="Open SharePoint Link">
      //         <IconButton
      //           component="a"
      //           href={url}
      //           target="_blank"
      //           rel="noopener noreferrer"
      //           color="primary"
      //           size="small"
      //         >
      //           <SharePointIcon fontSize="small" />
      //         </IconButton>
      //       </Tooltip>
      //     );
      //   },
      //   enableColumnFilter: false,
      //   enableSorting: false,
      // },
      {
        header: "Distribution Status",
        id: "distribution_status",
        size: 180,
        Cell: ({ row }) => {
          const distribution = distributions.find(
            (d) => d.PurchaseID === row.original.id_achat
          );
          if (distribution) {
            const ps = psList.find((ps) => ps.Id_point === distribution.ps);
            return (
              <Box
                sx={{
                  display: "inline-block",
                  px: 2,
                  py: 0.5,
                  bgcolor: "rgba(76, 175, 80, 0.08)",
                  color: "inherit",
                  borderRadius: "16px",
                  border: "1px solid rgba(76, 175, 80, 0.2)",

                  fontWeight: 600,
                  fontSize: "0.95em",
                  textAlign: "center",
                  minWidth: 120,
                }}
              >
                Distributed to {ps ? ps.name_point : `PS#${distribution.ps}`}
              </Box>
            );
          }
          return (
            <Box
              sx={{
                display: "inline-block",
                px: 2,
                py: 0.5,
                bgcolor: "rgba(255, 152, 0, 0.08)",
                border: "1px solid rgba(255, 152, 0, 0.2)",
                color: "inherit",
                borderRadius: "16px",
                fontWeight: 600,
                fontSize: "0.95em",
                textAlign: "center",
                minWidth: 120,
              }}
            >
              Not Distributed Yet
            </Box>
          );
        },
        accessorFn: (row) => {
          const distribution = distributions.find(
            (d) => d.PurchaseID === row.id_achat
          );
          if (distribution) {
            const ps = psList.find((ps) => ps.Id_point === distribution.ps);
            return `Distributed to ${ps ? ps.name_point : `PS#${distribution.ps}`}`;
          }
          return "Not Distributed Yet";
        },
        enableColumnFilter: false,
        enableSorting: false,
      },
    ],
    [
      suppliers,
      vendors,
      distributions,
      psList,
      handleEdit,
      handleRequestApproval,
    ]
  );

  // Filtered data for table
  const filteredData = useMemo(
    () =>
      showOnlyNotDistributed
        ? data.filter(
            (row) => !distributions.find((d) => d.PurchaseID === row.id_achat)
          )
        : data,
    [data, distributions, showOnlyNotDistributed]
  );

  const table = useMaterialReactTable({
    columns,
    data: filteredData,
    state: { isLoading: loading || _loadingSuppliers, density: "compact" },
    enableDensityToggle: true,
    muiTableBodyCellProps: {
      sx: {
        py: 0.5,
        px: 0.5,
      },
    },
    muiTableHeadCellProps: {
      sx: {
        py: 0.5,
        px: 0.5,
      },
    },
    initialState: {
      pagination: {
        pageSize: 5,
        pageIndex: 0,
      },
      columnVisibility: {
        thumb: true,
        photo: true,
        id_achat: false,
        carat: true,
        cut: false,
        color: false,
        clarity: false,
        shape: false,
        certificate_number: true,
        certificate_lab: true,
        price_per_carat: true,
        SellingPrice: true,
        total_price: true,
        origin_country: false,
        Date_Achat: true,
        Brand: true,
        measurements: false,
        depth_percent: false,
        table_percent: false,
        girdle: false,
        culet: false,
        polish: false,
        symmetry: false,
        fluorescence: false,
        certificate_url: true,
        laser_inscription: false,
        comment: false,
        image_url: false,
        video_url: false,
        Comment_Achat: false,
        DocumentNo: false,
        IsApprouved: false,
        Approval_Date: false,
        ApprouvedBy: false,
        attachmentUrl: false,
      },
    },
  });

  const notDistributedRows = useMemo(
    () =>
      data.filter(
        (row) => !distributions.find((d) => d.PurchaseID === row.id_achat)
      ),
    [data, distributions]
  );

  return (
    <Box p={0.5}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: "bold" }}>
          Diamond Purchase List
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
            New Purchase
          </Button>
        </Box>
      </Box>

      {/* Notification bar just above the table */}
      {showNotif && notDistributedRows.length > 0 && (
        <Box
          sx={{
            mb: 2,
            bgcolor: "rgba(255, 68, 0, 0.31)",
            color: "inherit",
            py: 2,
            px: 3,
            borderRadius: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <Box>
            <strong>
              {notDistributedRows.length} purchase
              {notDistributedRows.length > 1 ? "s" : ""} not distributed yet!
            </strong>
          </Box>
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button
              variant="contained"
              color="warning"
              onClick={() => setShowOnlyNotDistributed(true)}
              sx={{ borderRadius: 2, fontWeight: "bold" }}
              disabled={showOnlyNotDistributed}
            >
              Filter Not Distributed
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setShowOnlyNotDistributed(false)}
              sx={{ borderRadius: 2, fontWeight: "bold" }}
              disabled={!showOnlyNotDistributed}
            >
              Show All
            </Button>
            <Button
              variant="contained"
              color="inherit"
              onClick={() => setShowNotif(false)}
              sx={{
                backgroundColor: "#f44336",
                borderRadius: 2,
                fontWeight: "bold",
                ml: 2,
              }}
            >
              Dismiss
            </Button>
          </Box>
        </Box>
      )}

      {sendingEmail && (
        <Backdrop
          open={sendingEmail}
          sx={{ zIndex: 2000, color: "#fff", flexDirection: "column" }}
        >
          <Logo />
          <Typography variant="h6" sx={{ mb: 2 }}>
            Sending approval email...
          </Typography>
          <Box sx={{ width: 400, maxWidth: "90%" }}>
            <LinearProgress variant="determinate" value={emailProgress} />
          </Box>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {emailProgress}%
          </Typography>
        </Backdrop>
      )}
      <MaterialReactTable table={table} />

      {/* --- Edit/Add Dialog --- */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {isEditMode ? "Edit Diamond Purchase" : "New Diamond Purchase"}
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
            {/* Top row: Vendor, Date Achat, Origin Country */}
            <Autocomplete
              id="supplier-select"
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
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Brand (Supplier)"
                  required
                  error={!!errors.supplier}
                  helperText={errors.supplier}
                  FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
                />
              )}
            />

            <Autocomplete
              id="vendors-select"
              options={vendors}
              autoHighlight
              getOptionLabel={(option) => option.Client_Name}
              value={editOPurchase?.vendor || null}
              onChange={(_event, newValue) => {
                setEditOPurchase((prev) => ({
                  ...prev!,
                  vendor: newValue
                    ? {
                        ExtraClient_ID: newValue.ExtraClient_ID,
                        Client_Name: newValue.Client_Name,
                      }
                    : null,
                  vendorsID: newValue ? newValue.ExtraClient_ID : null,
                }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Vendor"
                  required
                  error={!!errors.vendor}
                  helperText={errors.vendor}
                  FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
                />
              )}
            />

            <TextField
              label="Date Achat"
              type="date"
              fullWidth
              value={editOPurchase?.Date_Achat || ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  Date_Achat: e.target.value,
                })
              }
              error={!!errors.Date_Achat}
              helperText={errors.Date_Achat}
              InputLabelProps={{ shrink: true }}
              FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
            />

            <Autocomplete
              options={Productsdata}
              getOptionLabel={(option) => option.desig_famille}
              value={
                Productsdata.find(
                  (p) => p.desig_famille === editOPurchase?.Design_art
                ) || null
              }
              onChange={(_event, newValue) => {
                setEditOPurchase((prev) => ({
                  ...prev!,
                  Design_art: newValue ? newValue.desig_famille : "",
                }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Product Name"
                  required
                  error={!!errors.Design_art}
                  helperText={errors.Design_art || "Select the product design"}
                  FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
                />
              )}
            />
            {/* Move External Code & Edit Comment directly after Product Name */}
            <TextField
              label="Ref Code"
              fullWidth
              required
              value={editOPurchase?.CODE_EXTERNAL || ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  CODE_EXTERNAL: e.target.value,
                })
              }
              error={!!errors.CODE_EXTERNAL}
              helperText={
                errors.CODE_EXTERNAL ||
                (editOPurchase?.CODE_EXTERNAL
                  ? `Sales Code: ${Number(editOPurchase.CODE_EXTERNAL).toLocaleString(undefined, { style: "currency", currency: "USD" })}`
                  : "")
              }
              FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
            />
            <TextField
              label="Sales Code"
              fullWidth
              required
              minRows={2}
              value={editOPurchase?.comment_edit || ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  comment_edit: e.target.value,
                })
              }
              error={!!errors.comment_edit}
              helperText={
                errors.comment_edit ||
                (editOPurchase?.comment_edit
                  ? `Sales Code: ${Number(editOPurchase.comment_edit).toLocaleString(undefined, { style: "currency", currency: "USD" })}`
                  : "")
              }
              FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
            />

            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Carat"
                type="number"
                fullWidth
                value={editOPurchase?.carat ?? ""}
                onChange={(e) => {
                  const carat = Number(e.target.value);
                  setEditOPurchase((prev) => ({
                    ...prev!,
                    carat,
                    total_price: carat * (prev?.price_per_carat || 0),
                  }));
                }}
                error={!!errors.carat}
                helperText={
                  errors.carat ||
                  (editOPurchase?.carat
                    ? `Carat: ${Number(editOPurchase.carat).toLocaleString()}`
                    : " ")
                }
                FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Item Cost"
                type="number"
                fullWidth
                required
                value={editOPurchase?.price_per_carat ?? ""}
                onChange={(e) => {
                  const price_per_carat = Number(e.target.value);
                  setEditOPurchase((prev) => ({
                    ...prev!,
                    price_per_carat,
                    total_price: (prev?.carat || 0) * price_per_carat,
                  }));
                }}
                error={!!errors.price_per_carat}
                helperText={
                  errors.price_per_carat ||
                  (editOPurchase?.price_per_carat
                    ? `Item Cost: ${Number(editOPurchase.price_per_carat).toLocaleString(undefined, { style: "currency", currency: "USD" })}`
                    : "")
                }
                FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
                sx={{ flex: 1 }}
              />
            </Box>

            {/* Currency Retail for Diamond Purchase */}
            <Box sx={{ display: "flex", gap: 2 }}>
              <Autocomplete
                options={currencyList}
                getOptionLabel={(option) =>
                  `${option.flag} ${option.code} - ${option.name}`
                }
                value={
                  currencyList.find(
                    (c) => c.code === (editOPurchase?.currencyRetail || "")
                  ) || null
                }
                onChange={(_e, v) =>
                  setEditOPurchase((prev) =>
                    prev ? { ...prev, currencyRetail: v ? v.code : "" } : prev
                  )
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Currency"
                    placeholder="Select currency"
                    required
                    error={!!errors.currencyRetail}
                    helperText={errors.currencyRetail}
                    FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
                  />
                )}
                isOptionEqualToValue={(option, value) =>
                  option.code === value.code
                }
                sx={{ flex: 1 }}
              />
            </Box>

            <TextField
              label="Selling Price $"
              type="number"
              fullWidth
              sx={{ flex: 1 }}
              required
              value={editOPurchase?.SellingPrice ?? ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  SellingPrice: Number(e.target.value),
                })
              }
              error={!!errors.SellingPrice}
              helperText={
                errors.SellingPrice ||
                (editOPurchase?.SellingPrice
                  ? `Selling Price: ${Number(editOPurchase.SellingPrice).toLocaleString(undefined, { style: "currency", currency: "USD" })}`
                  : "Enter the selling price for this diamond.")
              }
              FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
            />

            <Autocomplete
              options={["Excellent", "Very Good", "Good", "Fair", "Poor"]}
              value={editOPurchase?.cut || ""}
              onChange={(_e, v) =>
                setEditOPurchase({ ...editOPurchase!, cut: v || "" })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Cut"
                  required
                  error={!!errors.cut}
                  helperText={
                    errors.cut ||
                    "Cut grade evaluates how well a diamond’s facets interact with light. Grades are: Excellent, Very Good, Good, Fair, Poor. A higher cut grade means more brilliance and sparkle. This is a key value factor and is determined by the grading lab."
                  }
                  FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
                />
              )}
            />

            <Autocomplete
              options={[
                "D",
                "E",
                "F",
                "G",
                "H",
                "I",
                "J",
                "K",
                "L",
                "M",
                "N",
                "O",
                "P",
                "Q",
                "R",
                "S",
                "T",
                "U",
                "V",
                "W",
                "X",
                "Y",
                "Z",
              ]}
              value={editOPurchase?.color || ""}
              onChange={(_e, v) =>
                setEditOPurchase({ ...editOPurchase!, color: v || "" })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Color"
                  required
                  error={!!errors.color}
                  helperText={
                    errors.color ||
                    "Color grade describes how colorless a diamond is. The GIA scale ranges from D (colorless) to Z (light yellow or brown). D-F are considered colorless, G-J near colorless. Enter the grade as shown on the certificate."
                  }
                  FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
                />
              )}
            />

            <Autocomplete
              options={[
                "FL",
                "IF",
                "VVS1",
                "VVS2",
                "VS1",
                "VS2",
                "SI1",
                "SI2",
                "I1",
                "I2",
                "I3",
              ]}
              value={editOPurchase?.clarity || ""}
              onChange={(_e, v) =>
                setEditOPurchase({ ...editOPurchase!, clarity: v || "" })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Clarity"
                  required
                  error={!!errors.clarity}
                  helperText={
                    errors.clarity ||
                    "Clarity grade measures the presence of internal (inclusions) and external (blemishes) characteristics. Grades: FL (Flawless), IF (Internally Flawless), VVS1/VVS2 (Very Very Slight), VS1/VS2 (Very Slight), SI1/SI2 (Slight), I1/I2/I3 (Included)."
                  }
                  FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
                />
              )}
            />

            <Autocomplete
              options={[
                "Round",
                "Princess",
                "Oval",
                "Emerald",
                "Cushion",
                "Pear",
                "Marquise",
                "Radiant",
                "Asscher",
                "Heart",
              ]}
              value={editOPurchase?.shape || ""}
              onChange={(_e, v) =>
                setEditOPurchase({ ...editOPurchase!, shape: v || "" })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Shape"
                  required
                  error={!!errors.shape}
                  helperText={
                    errors.shape ||
                    "The outline or form of the diamond when viewed from above. Common shapes include Round, Princess, Oval, Emerald, Cushion, Pear, Marquise, Radiant, Asscher, and Heart. Shape is a matter of style and preference."
                  }
                  FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
                />
              )}
            />

            <TextField
              label="Measurements"
              fullWidth
              required
              value={editOPurchase?.measurements || ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  measurements: e.target.value,
                })
              }
              error={!!errors.measurements}
              helperText={
                errors.measurements ||
                "The physical dimensions of the diamond, usually in millimeters (mm). Format: Length × Width × Depth (e.g., 6.45 x 6.42 x 4.03 mm). These are found on the grading certificate and are important for verifying the stone."
              }
              FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
            />

            <TextField
              label="Depth %"
              type="number"
              fullWidth
              required
              value={editOPurchase?.depth_percent || ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  depth_percent: Number(e.target.value),
                })
              }
              error={!!errors.depth_percent}
              helperText={
                errors.depth_percent ||
                "Depth percentage is the ratio of the diamond’s height (from table to culet) to its average diameter, expressed as a percentage. It affects brilliance and is typically between 58% and 63% for round diamonds."
              }
              FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
            />

            <TextField
              label="Table %"
              type="number"
              fullWidth
              required
              value={editOPurchase?.table_percent || ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  table_percent: Number(e.target.value),
                })
              }
              error={!!errors.table_percent}
              helperText={
                errors.table_percent ||
                "Table percentage is the width of the diamond’s top facet (table) divided by its average diameter. It influences how light enters and exits the stone. Typical values for round diamonds are 53%–60%."
              }
              FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
            />

            <Autocomplete
              options={[
                "Thin",
                "Medium",
                "Thick",
                "Thin - Medium",
                "Medium - Thick",
              ]}
              value={editOPurchase?.girdle || ""}
              onChange={(_e, v) =>
                setEditOPurchase({ ...editOPurchase!, girdle: v || "" })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Girdle"
                  required
                  error={!!errors.girdle}
                  helperText={
                    errors.girdle ||
                    "The girdle is the outer edge or perimeter of the diamond, separating the crown from the pavilion. Its thickness can be described as Thin, Medium, Thick, etc. Girdle thickness affects durability and mounting."
                  }
                  FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
                />
              )}
            />

            <Autocomplete
              options={["None", "Small", "Medium", "Large"]}
              value={editOPurchase?.culet || ""}
              onChange={(_e, v) =>
                setEditOPurchase({ ...editOPurchase!, culet: v || "" })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Culet"
                  required
                  error={!!errors.culet}
                  helperText={
                    errors.culet ||
                    "The culet is the small facet at the bottom tip of the diamond. It is graded as None, Small, Medium, Large, etc. A large culet can appear as a visible dot; 'None' or 'Small' is preferred for most stones."
                  }
                  FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
                />
              )}
            />

            <Autocomplete
              options={["Excellent", "Very Good", "Good", "Fair", "Poor"]}
              value={editOPurchase?.polish || ""}
              onChange={(_e, v) =>
                setEditOPurchase({ ...editOPurchase!, polish: v || "" })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Polish"
                  required
                  error={!!errors.polish}
                  helperText={
                    errors.polish ||
                    "Polish refers to the smoothness and luster of the diamond's surface. It affects the diamond's brilliance and is graded as Excellent, Very Good, Good, Fair, or Poor."
                  }
                  FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
                />
              )}
            />

            <Autocomplete
              options={["Excellent", "Very Good", "Good", "Fair", "Poor"]}
              value={editOPurchase?.symmetry || ""}
              onChange={(_e, v) =>
                setEditOPurchase({ ...editOPurchase!, symmetry: v || "" })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Symmetry"
                  required
                  error={!!errors.symmetry}
                  helperText={
                    errors.symmetry ||
                    "Symmetry assesses the precision of the diamond’s cut, including the alignment and placement of facets. Grades: Excellent, Very Good, Good, Fair, Poor. Better symmetry means more sparkle and value."
                  }
                  FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
                />
              )}
            />

            <Autocomplete
              options={["None", "Faint", "Medium", "Strong"]}
              value={editOPurchase?.fluorescence || ""}
              onChange={(_e, v) =>
                setEditOPurchase({ ...editOPurchase!, fluorescence: v || "" })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Fluorescence"
                  required
                  error={!!errors.fluorescence}
                  helperText={
                    errors.fluorescence ||
                    "Fluorescence describes a diamond’s visible reaction to ultraviolet (UV) light. Grades: None, Faint, Medium, Strong. Strong fluorescence can sometimes make a diamond appear hazy or milky."
                  }
                  FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
                />
              )}
            />

            {/* Certification */}
            <TextField
              label="Certificate #"
              fullWidth
              required
              value={editOPurchase?.certificate_number || ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  certificate_number: e.target.value,
                })
              }
              error={!!errors.certificate_number}
              helperText={
                errors.certificate_number ||
                "The unique identification number assigned to the diamond by the grading laboratory (e.g., GIA 1234567890). This number is used to verify the diamond’s authenticity and details online."
              }
              FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
            />

            <Autocomplete
              options={["GIA", "IGI", "HRD", "AGS", "Other"]}
              value={editOPurchase?.certificate_lab || ""}
              onChange={(_e, v) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  certificate_lab: v || "",
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Certificate Lab"
                  required
                  error={!!errors.certificate_lab}
                  helperText={
                    errors.certificate_lab ||
                    "The gemological laboratory that issued the grading certificate. GIA (Gemological Institute of America), IGI (International Gemological Institute), HRD, and AGS are internationally recognized labs."
                  }
                  FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
                />
              )}
            />

            <TextField
              label="Certificate URL"
              fullWidth
              required
              value={editOPurchase?.certificate_url || ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  certificate_url: e.target.value,
                })
              }
              error={!!errors.certificate_url}
              helperText={
                errors.certificate_url ||
                "A direct link to the digital version of the grading certificate (PDF or web page). This is important for verification, export, and resale. Ensure the link is accessible and matches the certificate number."
              }
              FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
            />

            {/* Laser Inscription */}
            <TextField
              label="Laser Inscription"
              fullWidth
              required
              value={editOPurchase?.laser_inscription || ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  laser_inscription: e.target.value,
                })
              }
              error={!!errors.laser_inscription}
              helperText={
                errors.laser_inscription ||
                "A unique number or code inscribed on the diamond’s girdle using a laser. This matches the certificate and helps with identification, security, and anti-theft measures. Enter 'None' if not inscribed."
              }
              FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
            />

            {/* New fields: External Code and Edit Comment */}

            <TextField
              label="SharePoint URL"
              fullWidth
              value={editOPurchase?.sharepoint_url || ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  sharepoint_url: e.target.value,
                })
              }
              helperText="Optional: Link to the related SharePoint document or item."
              FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
            />

            {/* Move Origin Country to the very bottom */}
            <TextField
              label="Origin Country"
              fullWidth
              value={editOPurchase?.origin_country || ""}
              onChange={(e) =>
                setEditOPurchase({
                  ...editOPurchase!,
                  origin_country: e.target.value,
                })
              }
              helperText="Country of origin for this diamond."
              FormHelperTextProps={{ sx: { whiteSpace: "pre-line" } }}
              sx={{ mt: 2 }}
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

      {/* --- Image Dialog (reuse watches) --- */}
      <ImgDialog
        open={imgDialogOpen}
        onClose={() => setImgDialogOpen(false)}
        id_achat={imgDialogIdAchat}
        type="diamond"
      />

      {/* --- Attachment Dialog (Multi-file) --- */}
      <AttchDiamondFiles
        open={attachmentDialog.open}
        onClose={handleCloseAttachmentDialog}
        row={attachmentDialog.row}
        id_achat={attachmentDialog.row?.id_achat}
        onUploadSuccess={fetchData}
        token={localStorage.getItem("token") || ""}
      />

      {/* --- Distribution Dialog --- */}
      <Dialog
        open={distributionDialog.open}
        onClose={() => setDistributionDialog({ open: false, purchase: null })}
      >
        <DialogTitle>Distribute Product</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              mt: 1,
              minWidth: 300,
            }}
          >
            <Autocomplete
              options={psList}
              getOptionLabel={(option) => option.name_point}
              value={
                psList.find((ps) => ps.Id_point === newDistribution.ps) || null
              }
              onChange={(_e, v) => {
                setNewDistribution((nd) => ({ ...nd, ps: v ? v.Id_point : 0 }));
                setDistributionErrors({});
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Point of Sale"
                  required
                  error={!!distributionErrors.ps}
                  helperText={distributionErrors.ps}
                />
              )}
            />
            <TextField
              label="Distribution Date"
              type="date"
              value={newDistribution.distributionDate}
              onChange={(e) =>
                setNewDistribution((nd) => ({
                  ...nd,
                  distributionDate: e.target.value,
                }))
              }
              InputLabelProps={{ shrink: true }}
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              setDistributionDialog({ open: false, purchase: null })
            }
            color="secondary"
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              let hasError = false;
              if (!newDistribution.ps) {
                setDistributionErrors({ ps: "Point of Sale is required" });
                hasError = true;
              } else {
                setDistributionErrors({});
              }
              if (
                hasError ||
                !distributionDialog.purchase ||
                !newDistribution.distributionDate
              )
                return;

              setPendingDistribution(true);
              setSnackbar({
                open: true,
                message: "Are you ready to distribute?",
                severity: "warning",
                actionType: "distributionConfirm",
              });
            }}
            color="primary"
            variant="contained"
            disabled={distributionReady || _loadingDistributions}
          >
            Distribute
          </Button>
          {distributionReady && (
            <Typography color="error" sx={{ mt: 1 }}>
              This product has already been distributed and cannot be
              distributed again.
            </Typography>
          )}
        </DialogActions>
      </Dialog>

      {/* --- Edit Cost Dialog --- */}
      <Dialog
        open={costDialog.open}
        onClose={() => setCostDialog({ open: false, row: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Cost Details</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              gap: 3,
              mt: 1,
            }}
          >
            {/* Fields on the left */}
            <Box
              sx={{
                flex: 1,
                minWidth: 240,
                maxWidth: 400,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <Typography
                variant="h6"
                sx={{ mb: 0.75, fontWeight: "bold", color: "primary.main" }}
              >
                Charges :
                <Divider sx={{ my: 1, borderBottomWidth: 2 }} />
              </Typography>

              <TextField
                label="Making Charge"
                type="number"
                value={costFields.MakingCharge ?? ""}
                onChange={(e) =>
                  setCostFields((f) => ({
                    ...f,
                    MakingCharge: Number(e.target.value),
                  }))
                }
                fullWidth
              />
              <TextField
                label="Shipping Charge"
                type="number"
                value={costFields.ShippingCharge ?? ""}
                onChange={(e) =>
                  setCostFields((f) => ({
                    ...f,
                    ShippingCharge: Number(e.target.value),
                  }))
                }
                fullWidth
              />
              <TextField
                label="Travel Expenses"
                type="number"
                value={costFields.TravelExpesenes ?? ""}
                onChange={(e) =>
                  setCostFields((f) => ({
                    ...f,
                    TravelExpesenes: Number(e.target.value),
                  }))
                }
                fullWidth
              />
              <TextField
                label="Rate"
                type="number"
                value={costFields.Rate ?? ""}
                onChange={(e) =>
                  setCostFields((f) => ({ ...f, Rate: Number(e.target.value) }))
                }
                fullWidth
              />

              {/* Move Origin Country to bottom */}
              <TextField
                label="Origin Country"
                value={costDialog.row?.origin_country ?? ""}
                onChange={(e) => {
                  if (costDialog.row)
                    setCostDialog((d) => ({
                      ...d,
                      row: { ...d.row!, origin_country: e.target.value },
                    }));
                }}
                fullWidth
                sx={{ mt: 2 }}
              />
            </Box>
            {/* Totals Box on the right */}
            <Box
              sx={{
                mt: { xs: 2, md: 0 },
                p: 2,
                minWidth: 340,
                maxWidth: 420,
                fontSize: 14,
                border: "2px solid rgba(76, 175, 80, 0.3)",
                color: "inherit",
                backgroundColor: "rgba(76, 175, 80, 0.10)",
                borderRadius: 3,
                mx: "auto",
                flex: 1,
                alignSelf: "flex-start",
              }}
            >
              <Typography variant="h5">
                Carat: <b>{costDialog.row?.carat ?? 0} ct</b>
              </Typography>
              <Divider sx={{ my: 1, borderBottomWidth: 2 }} />
              {/* Removed total price display */}
              <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
                Add Charges:
              </Typography>
              {[
                { label: "Making Charge", value: costFields.MakingCharge },
                { label: "Shipping Charge", value: costFields.ShippingCharge },
                { label: "Travel Expenses", value: costFields.TravelExpesenes },
              ].map((item) => (
                <Typography variant="body2" key={item.label} sx={{ ml: 1 }}>
                  {item.label}: {formatAmount(item.value)} USD ×{" "}
                  {formatAmount(costFields.Rate)} ={" "}
                  {formatAmount((item.value ?? 0) * (costFields.Rate ?? 0))} LYD
                </Typography>
              ))}
              <Divider sx={{ my: 1, borderBottomWidth: 2 }} />
              <Typography
                variant="body2"
                sx={{ fontWeight: "bold", color: "primary.main" }}
              >
                Grand Total (USD):{" "}
                {(
                  (costDialog.row?.carat ?? 0) *
                    (costDialog.row?.price_per_carat ?? 0) +
                  (costFields.MakingCharge ?? 0) +
                  (costFields.ShippingCharge ?? 0) +
                  (costFields.TravelExpesenes ?? 0)
                ).toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD",
                })}
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontWeight: "bold", color: "primary.main" }}
              >
                Grand Total (LYD):{" "}
                {// (TotalPriceUSD + allChargesUSD) * Rate
                (
                  ((costDialog.row?.carat ?? 0) *
                    (costDialog.row?.price_per_carat ?? 0) +
                    (costFields.MakingCharge ?? 0) +
                    (costFields.ShippingCharge ?? 0) +
                    (costFields.TravelExpesenes ?? 0)) *
                  (costFields.Rate ?? 0)
                ).toLocaleString(undefined, {
                  style: "currency",
                  currency: "LYD",
                })}
              </Typography>
              <Divider sx={{ my: 1, borderBottomWidth: 2 }} />

              <Button
                sx={{ position: "revert" }}
                variant="contained"
                onClick={() => {}}
                color="success"
              >
                Generate Journal
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setCostDialog({ open: false, row: null })}
            color="secondary"
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!costDialog.row) return;

              const token = localStorage.getItem("token");
              try {
                await axios.put(
                  `${apiUrl}/Update/${costDialog.row.id_achat}`,
                  {
                    ...costDialog.row,
                    ...costFields,
                  },
                  {
                    headers: { Authorization: `Bearer ${token}` },
                  }
                );
                setSnackbar({
                  open: true,
                  message: "Cost updated",
                  severity: "success",
                });
                await fetchData();
              } catch {
                setSnackbar({
                  open: true,
                  message: "Failed to update cost",
                  severity: "error",
                });
              }
              setCostDialog({ open: false, row: null });
            }}
            color="primary"
            variant="contained"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for all alerts */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={
          snackbar.actionType === "distributionConfirm" ? null : 6000
        }
        onClose={() => {
          setSnackbar({
            open: false,
            message: "",
            severity: "success",
            actionType: undefined,
          });
          setPendingDistribution(false);
        }}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => {
            setSnackbar({
              open: false,
              message: "",
              severity: "success",
              actionType: undefined,
            });
            setPendingDistribution(false);
          }}
          severity={snackbar.severity}
          icon={pendingDistribution ? <ImportExportIcon /> : undefined}
          sx={{ width: "100%" }}
          action={
            snackbar.actionType === "distributionConfirm" ? (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  mt: 2,
                }}
              >
                <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    onClick={async () => {
                      await handleConfirmDistribution();
                      setSnackbar({
                        open: false,
                        message: "",
                        severity: "success",
                        actionType: undefined,
                      });
                      setPendingDistribution(false);
                    }}
                  >
                    OK
                  </Button>
                  <Button
                    variant="contained"
                    color="info"
                    size="small"
                    onClick={() => {
                      setSnackbar({
                        open: false,
                        message: "",
                        severity: "success",
                        actionType: undefined,
                      });
                      setPendingDistribution(false);
                    }}
                  >
                    Cancel
                  </Button>
                </Box>
              </Box>
            ) : null
          }
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Snackbar for delete confirmation */}
      <Snackbar
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, row: null })}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity="warning"
          sx={{ width: "100%" }}
          action={
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                color="error"
                sx={{ bgcolor: "#f44336", color: "#fff" }}
                size="small"
                onClick={async () => {
                  if (confirmDelete.row) {
                    // Actually delete now
                    setSnackbar({
                      open: true,
                      message: "Deleting...",
                      severity: "info",
                    });
                    const token = localStorage.getItem("token");
                    try {
                      await axios.delete(
                        `${apiUrl}/Delete/${confirmDelete.row.id_achat}`,
                        {
                          headers: { Authorization: `Bearer ${token}` },
                        }
                      );
                      setSnackbar({
                        open: true,
                        message: "Purchase deleted successfully",
                        severity: "success",
                      });
                      await fetchData();
                    } catch {
                      setSnackbar({
                        open: true,
                        message: "Delete failed",
                        severity: "error",
                      });
                    }
                  }
                  setConfirmDelete({ open: false, row: null });
                }}
              >
                OK
              </Button>
              <Button
                sx={{ bgcolor: "#fff", color: "#000" }}
                color="inherit"
                size="small"
                onClick={() => setConfirmDelete({ open: false, row: null })}
              >
                Cancel
              </Button>
            </Box>
          }
        >
          Are you sure you want to delete this purchase?
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DOPurchase;
