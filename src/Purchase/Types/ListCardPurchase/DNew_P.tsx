import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import axios from "../../../api";
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
  TextField,
  Divider,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Autocomplete,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import DeleteIcon from "@mui/icons-material/Delete";
import PrintIcon from "@mui/icons-material/PrintOutlined";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { CancelOutlined } from "@mui/icons-material";

import React from "react";
type Purchase = {
  id_fact: number;
  date_fact: string;
  client: number;
  id_art: number;
  qty: number;
  Full_qty: number;
  Unite: string;
  num_fact: number;
  usr: number;
  d_time: string;
  Design_art: string;
  Color_Gold: string;
  Color_Rush: string;
  Cost_Currency: number;
  RATE: number;
  Cost_Lyd: number;
  Selling_Price_Currency: number;
  CODE_EXTERNAL: string;
  Selling_Rate: number;
  is_selled: boolean;
  ps: number;
  IS_OK: boolean;
  COMMENT: string;
  comment_edit: string;
  date_inv: string;
  CURRENCY: string;
  General_Comment: string;
  MakingCharge: number;
  ShippingCharge: number;
  TravelExpesenes: number;
  cost_g: number;
  ExtraClient: number;
  Model: string;
  Serial_Number: string;
  WarrantyDate: string;
  Notes: string;
  client_name: string;
  TYPE_SUPPLIER: string;
  Fournisseur?: {
    id_client: number;
    client_name: string;
    TYPE_SUPPLIER: string;
  };
  Original_Invoice: string;
};

type Supplier = {
  id_client: number;
  client_name: string;
  TYPE_SUPPLIER: string;
};

type Product = {
  id_famille: number;
  desig_famille: string;
};

type StickerData = {
  id_fact: number;
  qty: number;
  brand: string;
  design?: string;
  goldColor?: string;
  stoneColor?: string;
};

const initialPurchaseState: Purchase = {
  id_fact: 0,
  date_fact: new Date().toISOString().split("T")[0],
  client: 0,
  id_art: 0,
  qty: 0,
  Full_qty: 0,
  Unite: "",
  num_fact: 0,
  usr: 0,
  d_time: new Date().toISOString(),
  Design_art: "",
  Color_Gold: "",
  Color_Rush: "",
  Cost_Currency: 0,
  RATE: 1,
  Cost_Lyd: 0,
  Selling_Price_Currency: 0,
  CODE_EXTERNAL: "",
  Selling_Rate: 0,
  is_selled: false,
  ps: 0,
  IS_OK: false,
  COMMENT: "",
  comment_edit: "",
  date_inv: "",
  CURRENCY: "USD",
  General_Comment: "",
  MakingCharge: 0,
  ShippingCharge: 0,
  TravelExpesenes: 0,
  cost_g: 0,
  ExtraClient: 0,
  Model: "",
  Serial_Number: "",
  WarrantyDate: "",
  Notes: "",
  client_name: "",
  TYPE_SUPPLIER: "",
  Original_Invoice: "",
};

interface NewPProps {
  num_fact?: number;
  brand?: number;
  receivingweight?: number;
  referencePurchase?: number;
  distribution?: any; // Add this prop
  onReceived?: () => void; // Callback after receiving
}

const DNew_p = (props: NewPProps) => {
  const theme = useTheme();
  const labelColor = theme.palette.text.secondary;
  const valueColor = theme.palette.primary.main;

  const { num_fact, distribution, onReceived, brand } = props;

  //const { num_fact, distribution, onReceived } = props;
  const [totalWeight, setTotalWeight] = useState(0);
  const [FulltotalWeight, setFullTotalWeight] = useState(0);
  const [itemCount, setItemCount] = useState(0);
  const [data, setData] = useState<Purchase[]>([]);
  const [Productsdata, setProductsdata] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // Removed unused showPurchaseForm
  const [editPurchase, setEditPurchase] =
    useState<Purchase>(initialPurchaseState);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  // Removed unused loadingSuppliers and refreshFlag
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "info" | "warning",
  });
  const [stickerDialog, setStickerDialog] = useState({
    open: false,
    data: [] as StickerData[], // Changed to array to hold multiple items
  });
  const [productDetails, setProductDetails] = useState<any>(null);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  // Removed unused pendingSave

  const navigate = useNavigate();
  const location = useLocation();
  // Robust ps/Cuser derivation: prefer route state, fallback to localStorage(user JSON -> keys) -> localStorage keys -> 0
  const statePs = (location.state as any)?.ps;
  const stateCuser = (location.state as any)?.Cuser;
  let psVal = 0;
  let CuserVal = 0;
  try {
    const userStr = localStorage.getItem("user");
    const userObj = userStr ? JSON.parse(userStr) : undefined;
    const lsPs = userObj?.ps ?? localStorage.getItem("ps");
    const lsCuser = userObj?.Cuser ?? localStorage.getItem("Cuser");
    psVal = Number(statePs ?? lsPs) || 0;
    CuserVal = Number(stateCuser ?? lsCuser) || 0;
  } catch {
    const lsPs = localStorage.getItem("ps");
    const lsCuser = localStorage.getItem("Cuser");
    psVal = Number(statePs ?? lsPs) || 0;
    CuserVal = Number(stateCuser ?? lsCuser) || 0;
  }

  const apiUrl = `/purchases`;
  const apiUrlProducts = `/products`;
  // Image carousel (diamond images like DOPurchase)
  const API_BASE = (process.env.REACT_APP_API_IP as string) || "";
  const API_BASEImage = `${API_BASE}/images`;
  // Secondary fallback for images host (matches WNew_P pattern)
  const API_FALLBACK_IMAGE = "/images";
  const [images, setImages] = useState<string[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Robust computation for displayed sale price for the current product
  const productSalePrice = useMemo(() => {
    const d = productDetails?.[0]?.purchaseD;
    if (!d) return null;
    if (d.sale_price !== undefined && d.sale_price !== null) return Number(d.sale_price);
    if (typeof d.SellingPrice === "number") return d.SellingPrice;
    if (d.total_price !== undefined && d.total_price !== null) return Number(d.total_price);
    if (d.price_per_carat !== undefined && d.price_per_carat !== null && d.carat !== undefined && d.carat !== null)
      return Number(d.price_per_carat) * Number(d.carat);
    return null;
  }, [productDetails]);
  // Fetch images using the same approach as watches (WNew_P): call `/images/list/:id`,
  // include auth header when present, normalize URLs to https, and fallback to
  // the `/images` host if needed. This keeps behavior consistent between types.
  const fetchImages = useCallback(
    async (id_achat: number) => {
      if (!id_achat) return false;
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_BASEImage}/list/${id_achat}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = res.data;
        let urls: string[] = [];
        if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
          urls = data.map((img: any) => img.url || img);
        } else {
          urls = data;
        }
        urls = urls.map((u) =>
          typeof u === "string" && u.startsWith("http://") ? u.replace("http://", "https://") : u
        );
        setImages(urls.filter(Boolean));
        return true;
      } catch (err) {
        // try fallback host
        try {
          const token = localStorage.getItem("token");
          const res = await axios.get(`${API_FALLBACK_IMAGE}/list/${id_achat}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const data = res.data;
          let urls: string[] = [];
          if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
            urls = data.map((img: any) => img.url || img);
          } else {
            urls = data;
          }
          urls = urls.map((u) =>
            typeof u === "string" && u.startsWith("http://") ? u.replace("http://", "https://") : u
          );
          setImages(urls.filter(Boolean));
          return true;
        } catch (e) {
          setImages([]);
          return false;
        }
      }
    },
    [API_BASEImage, API_FALLBACK_IMAGE]
  );

  // Fetch images when product details provide an `id_achat` (mirror WNew_P) and
  // fallback to any single `image_url` inside the diamond details if no list is found.
  useEffect(() => {
    // Prefer top-level id_achat on productDetails, then diamond-specific id, then distribution
    let id_achat: number | undefined;

    id_achat =
      productDetails?.[0]?.id_achat || productDetails?.[0]?.purchaseD?.id_achat ||
      distribution?.purchaseD?.id_achat || distribution?.id_achat;

    (async () => {
      if (id_achat) {
        console.log("DNew_P: Fetching images for id_achat:", id_achat);
        try {
          const ok = await fetchImages(id_achat);
          console.log("DNew_P: fetchImages result for", id_achat, ":", ok);
          if (!ok) {
            const url = productDetails?.[0]?.purchaseD?.image_url;
            if (url) {
              console.log("DNew_P: Falling back to single image_url", url);
              setImages([url]);
            }
          }
        } catch (err) {
          console.error("DNew_P: Error during fetchImages for", id_achat, err);
        }
      } else {
        const url = productDetails?.[0]?.purchaseD?.image_url;
        if (url) {
          console.log("DNew_P: Using productDetails.purchaseD.image_url as fallback:", url);
          setImages([url]);
        }
      }
    })();
  }, [productDetails, distribution, fetchImages]);

  // Log productDetails state for debugging
  useEffect(() => {
    console.log("DNew_P: productDetails state changed:", productDetails);
  }, [productDetails]);

  // Reset carousel index when images change
  useEffect(() => {
    setCarouselIndex(0);
  }, [images]);

  const isUsedSupplier = useMemo(() => {
    return (
      editPurchase.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes("used") ??
      false
    );
  }, [editPurchase.Fournisseur]);

  const stickerRef = useRef<HTMLDivElement>(null);
  const handlePrintSticker = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      const content = stickerDialog.data
        .map(
          (item) => `
      <div style="width:80mm;height:50mm;padding:2mm;border:1px solid #000;margin:0 auto;page-break-after:always;font-family:Arial,sans-serif;">
        <div style="text-align:center;font-weight:bold;font-size:14px;">${item.brand}</div>
        <hr style="margin:2px 0;border-color:#000;">
        <div style="display:flex;justify-content:space-between;font-size:12px;">
          <span>ID: ${item.id_fact}</span>
          <span>Wt: ${item.qty}g</span>
        </div>
        <div style="font-size:12px;">Design: ${item.design}</div>
        <div style="font-size:12px;">Gold: ${item.goldColor}</div>
        <div style="font-size:12px;">Stone: ${item.stoneColor}</div>
      </div>
    `
        )
        .join("");

      printWindow.document.write(`
      <html>
        <head>
          <title>Stickers-${stickerDialog.data[0]?.id_fact || ""}</title>
          <style>
            @page { size: 80mm 50mm; margin: 0; }
            body { margin: 0; padding: 0; }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 200);
    }
  };

  const StickerPrintContent = React.forwardRef<
    HTMLDivElement,
    { items: StickerData[] }
  >(({ items }, ref) => (
    <div ref={ref} style={{ display: "none" }}>
      {items.map((item, index) => (
        <div
          key={index}
          style={{
            width: "80mm",
            height: "50mm",
            padding: "2mm",
            border: "1px solid #000",
            margin: "0 auto",
            pageBreakAfter: "always",
            fontFamily: "Arial, sans-serif",
          }}
        >
          <div
            style={{
              textAlign: "center",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            {item.brand}
          </div>
          <hr style={{ margin: "2px 0", borderColor: "#000" }} />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px",
            }}
          >
            <span>ID: {item.id_fact}</span>
            <span>Wt: {item.qty}g</span>
          </div>
          <div style={{ fontSize: "12px" }}>Design: {item.design}</div>
          <div style={{ fontSize: "12px" }}>Gold: {item.goldColor}</div>
          <div style={{ fontSize: "12px" }}>Stone: {item.stoneColor}</div>
        </div>
      ))}
    </div>
  ));
  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const showNotification = (
    message: string,
    severity: "success" | "error" | "info" | "warning"
  ) => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
  };

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/");
    try {
      const res = await axios.get<Purchase[]>(`${apiUrl}/Getpurchase`, {
        headers: { Authorization: `Bearer ${token}` },
        // Ensure ps is always present
        params: { ps: psVal, num_fact: Number(num_fact) || 0 },
      });
      setData(res.data);

      console.log("Fetched purchase data:", res.data);

      setEditPurchase((prevState) => ({
        ...prevState,
        client: res.data[0]?.client ?? prevState.client, // Only update if data has client
        Fournisseur: res.data[0]?.Fournisseur ?? prevState.Fournisseur,
      }));

      const weightSum = res.data.reduce(
        (sum, item) => sum + (item.qty || 0),
        0
      );
      setTotalWeight(weightSum);
      const FullweightSum = res.data.reduce(
        (sum, item) => sum + (item.Full_qty || 0),
        0
      );
      setFullTotalWeight(FullweightSum);
      setItemCount(res.data.length);
    } catch (err: any) {
      if (err.response?.status === 401) navigate("/");
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Failed to fetch purchase data";
      console.error("Fetch purchases error:", err);
      showNotification(`${msg}`, "error");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, navigate, num_fact, psVal]);

  const fetchSuppliers = useCallback(async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get<Supplier[]>(`/suppliers/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Filter suppliers where type_supplier contains "gold" (case-insensitive)
      const goldSuppliers = res.data.filter((supplier) =>
        supplier.TYPE_SUPPLIER?.toLowerCase().includes("diamond")
      );

      setSuppliers(goldSuppliers);
    } catch (error) {
      showNotification("Failed to fetch suppliers", "error");
    } finally {
      // no-op
    }
  }, []);

  const fetchProductDetails = async (distributionID: number, type: string) => {
    const token = localStorage.getItem("token");

    try {
      const response = await axios.get(`/Dpurchases/ProductDetails`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { distributionID, type },
      });

      console.log("Product details response:", response.data);

      // Normalize response shape: ensure we always have an array of detail objects
      let details: any = response.data;

      // If response contains a `data` wrapper (common in some APIs), unwrap it
      if (details && !Array.isArray(details) && details.data) {
        details = details.data;
      }

      // If it's a single object with purchaseD/purchaseW, wrap into an array
      if (details && !Array.isArray(details)) {
        details = [details];
      }

      // Guard: ensure we have an array, otherwise set to empty array
      if (!Array.isArray(details)) details = [];

      console.log("Normalized product details:", details);
      setProductDetails(details); // Store normalized product details in state
      return details;
    } catch (error) {
      showNotification("Failed to fetch product details", "error");
      return null;
    }
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    resetForm();
    fetchData();
    fetchSuppliers();
    fetchDataProducts();
  }, [num_fact]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Prefill fields from distribution if present
  useEffect(() => {
    const fillFromDistribution = async () => {
      if (distribution) {
        const type = distribution.PurchaseType?.toLowerCase();
        console.log("fillFromDistribution: distribution:", distribution, "type:", type);
        const details = await fetchProductDetails(
          distribution.distributionID,
          type
        );
        console.log("fillFromDistribution: fetched details:", details);
        if (details && details.length > 0) {
          // Try to select the detail matching the PurchaseID (or id_achat) from distribution
          const targetPurchaseId =
            distribution?.PurchaseID ||
            distribution?.purchase?.id_achat ||
            distribution?.purchaseD?.id_achat ||
            distribution?.id_achat ||
            null;

          let selectedDetail: any = null;
          if (targetPurchaseId != null) {
            selectedDetail = details.find((d: any) => {
              const pid = d?.purchaseD?.id_achat ?? d?.id_achat ?? d?.purchaseW?.id_achat ?? d?.purchase?.id_achat;
              return pid === targetPurchaseId;
            }) || null;
            console.log("fillFromDistribution: targetPurchaseId:", targetPurchaseId, "selectedDetail:", selectedDetail);
          }

          // Fallback to first item if none matched
          const detailToUse = selectedDetail || details[0];
          setProductDetails([detailToUse]);

          // Set vendor from selected detail if available
          const purchaseD = detailToUse.purchaseD || detailToUse.purchaseW || detailToUse.purchase || {};
          const vendorObj = purchaseD.supplier
            ? {
                id_client: purchaseD.supplier.id_client || 0,
                client_name: purchaseD.supplier.client_name || "",
                TYPE_SUPPLIER: purchaseD.supplier.TYPE_SUPPLIER || "Diamond Purchase",
              }
            : {
                id_client: 0,
                client_name: purchaseD.brand || "",
                TYPE_SUPPLIER: "Diamond Purchase",
              };

          // Add vendor to suppliers if not present
          setSuppliers((prev) => {
            if (vendorObj.client_name && !prev.some((s) => s.client_name === vendorObj.client_name)) {
              return [...prev, vendorObj];
            }
            return prev;
          });

          setEditPurchase((prev) => ({
            ...prev,
            Fournisseur: vendorObj,
            client: vendorObj.id_client,
            CODE_EXTERNAL: purchaseD.CODE_EXTERNAL || "",
            comment_edit: purchaseD.comment_edit || "",
            Design_art: purchaseD.Design_art || prev.Design_art,
            Original_Invoice: distribution.distributionID,
          }));
        }
      }
    };
    fillFromDistribution();
    // eslint-disable-next-line
  }, [distribution]);

  // Add this useEffect after your other useEffects

  useEffect(() => {
    // If vendor is passed in props (brand/distribution), set it in editPurchase and suppliers
    if (
      distribution &&
      (distribution.SupplierID || distribution.supplierID || brand)
    ) {
      const vendorObj = {
        id_client:
          distribution.SupplierID || distribution.supplierID || brand || 0,
        client_name:
          distribution.SupplierName || distribution.supplierName || "",
        TYPE_SUPPLIER: "Diamond Purchase",
      };
      setEditPurchase((prev) => ({
        ...prev,
        Fournisseur: vendorObj,
        client: vendorObj.id_client,
      }));
      setSuppliers((prev) => {
        if (!prev.some((s) => s.id_client === vendorObj.id_client)) {
          return [...prev, vendorObj];
        }
        return prev;
      });
    }
  }, [distribution, brand]);

  const resetForm = useCallback(() => {
    setEditPurchase({
      ...initialPurchaseState,
      num_fact: num_fact || 0,
      usr: CuserVal,
      ps: psVal,
      date_fact: new Date().toISOString().split("T")[0],
    });
    setErrors({});
    setIsEditMode(false);
  }, [num_fact, CuserVal, psVal]);

  const handleEdit = (row: Purchase) => {
    const formattedDate = row.date_fact
      ? new Date(row.date_fact).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    const supplierData = row.Fournisseur
      ? {
          id_client: row.Fournisseur.id_client,
          client_name: row.Fournisseur.client_name,
          TYPE_SUPPLIER: row.Fournisseur.TYPE_SUPPLIER,
        }
      : undefined;

    // Do not copy product name or selling price into the edit form
    setEditPurchase({
      ...row,
      date_fact: formattedDate,
      Fournisseur: row.Fournisseur || supplierData,
      client: row.Fournisseur?.id_client || row.client,
      Design_art: "", // Clear product name when selecting item to edit
      Selling_Price_Currency: 0, // Clear selling price when selecting item to edit
    });
    setIsEditMode(true);
  };

  const validateForm = () => {
    const newErrors: any = {};

    if (!editPurchase.date_fact) newErrors.date_fact = "Date is required";

    if (!editPurchase.Fournisseur?.id_client && !editPurchase.client) {
      newErrors.client = "Vendor is required";
    } else if (
      editPurchase.Fournisseur?.id_client &&
      !suppliers.some(
        (s) => s.id_client === editPurchase.Fournisseur?.id_client
      )
    ) {
      newErrors.client = "Selected vendor is invalid";
    }

    if (!editPurchase.Design_art) newErrors.Design_art = "Design is required";
    //if (!editPurchase.Color_Gold) newErrors.Color_Gold = 'Gold color is required';
    //if (!editPurchase.Color_Rush) newErrors.Color_Rush = 'Stone color is required';

    if (editPurchase.Full_qty <= 0) editPurchase.Full_qty = 1;
    if (editPurchase.qty <= 0) editPurchase.qty = 1;

    // Only validate these fields if it's a used supplier
    if (isUsedSupplier) {
      if (editPurchase.Selling_Price_Currency <= 0)
        newErrors.Selling_Price_Currency =
          "Selling price must be greater than 0";
      if (!editPurchase.CURRENCY) newErrors.CURRENCY = "Currency is required";
      if (editPurchase.RATE <= 0)
        newErrors.RATE = "Exchange rate must be greater than 0";
      if (editPurchase.Cost_Lyd <= 0)
        newErrors.Cost_Lyd = "Cost (LYD) must be greater than 0";
    }

    // Reference purchase is NOT required anymore
    // if (!editPurchase.Original_Invoice) newErrors.Original_Invoice = 'Reference purchase is required';

    setErrors(newErrors);

    console.log(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCancel = () => {
    setEditPurchase(initialPurchaseState);
    setErrors({});
  };

  const handleSave = async () => {
    const token = localStorage.getItem("token");
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      // If not used supplier, set default values for these fields
      const payloadData = {
        ...editPurchase,
        // For non-used suppliers, mirror WNew_P behavior by using product details price when available
        Selling_Price_Currency: isUsedSupplier
          ? editPurchase.Selling_Price_Currency
          : (productDetails?.[0]?.purchaseD?.SellingPrice ??
            editPurchase.Selling_Price_Currency ??
            0),
        CURRENCY: isUsedSupplier ? editPurchase.CURRENCY : "USD",
        RATE: isUsedSupplier ? editPurchase.RATE : 1,
        Cost_Lyd: isUsedSupplier ? editPurchase.Cost_Lyd : 0,
      };

      const payload = {
        ...payloadData,
        num_fact: num_fact,
        usr: CuserVal,
        ps: psVal,
        client: editPurchase.Fournisseur?.id_client || editPurchase.client,
      };
      if (isEditMode) {
        await axios.put(`${apiUrl}/Update/${editPurchase.id_fact}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showNotification("Item updated successfully", "success");
      } else {
        await axios.post(`${apiUrl}/Add`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showNotification("Item added successfully", "success");
      }

      fetchData();

      setIsEditMode(false);

      if (distribution && distribution.distributionID) {
        await axios
          .put(
            `/Dpurchases/UpdateStatus/${distribution.distributionID}`,
            { DistributionISOK: true },
            { headers: { Authorization: `Bearer ${token}` } }
          )
          .catch((error) => {
            console.error("Error updating distribution:", error);
          });

        //  if (onReceived) onReceived();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "Save failed";
      showNotification(errorMessage, "error");
    } finally {
      setIsSaving(false);
      setSaveDisabled(true); // Disable/hide save button
      // if (onReceived) onReceived(); // Notify parent
    }
  };

  // Add state to disable save button after save
  const [saveDisabled, setSaveDisabled] = useState(false);

  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    purchaseId: null as number | null,
    purchaseNum: null as number | null,
  });

  const handleDeleteClick = (row: Purchase) => {
    setDeleteDialog({
      open: true,
      purchaseId: row.id_fact,
      purchaseNum: row.num_fact,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.purchaseId) return;

    const token = localStorage.getItem("token");
    try {
      // Use the same base purchases API as elsewhere in this component
      await axios.delete(`${apiUrl}/Delete/${deleteDialog.purchaseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchData();
      showNotification("Item deleted successfully", "success");
    } catch (error) {
      console.error("Error deleting purchase:", error);
      showNotification("Failed to delete purchase", "error");
    } finally {
      setDeleteDialog({ open: false, purchaseId: null, purchaseNum: null });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ open: false, purchaseId: null, purchaseNum: null });
  };

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
      else alert("Error loading data");
    } finally {
      setLoading(false);
    }
  }, [apiUrlProducts, navigate]);

  const handleOpenStickerDialog = (stickerData: StickerData) => {
    // Find the current item index in the data array
    const currentIndex = data.findIndex(
      (item) => item.id_fact === stickerData.id_fact
    );

    // Get the next item if it exists
    const nextItem =
      currentIndex < data.length - 1 ? data[currentIndex + 1] : null;

    // Prepare sticker data for both items
    const itemsToPrint: StickerData[] = [
      {
        id_fact: stickerData.id_fact,
        qty: stickerData.qty,
        brand: stickerData.brand,
        design: stickerData.design,
        goldColor: stickerData.goldColor,
        stoneColor: stickerData.stoneColor,
      },
    ];

    if (nextItem) {
      itemsToPrint.push({
        id_fact: nextItem.id_fact,
        qty: nextItem.qty,
        brand: nextItem.Fournisseur?.client_name ?? "",
        design: nextItem.Design_art,
        goldColor: nextItem.Color_Gold,
        stoneColor: nextItem.Color_Rush,
      });
    }

    setStickerDialog({
      open: true,
      data: itemsToPrint,
    });
  };

  const handleCloseStickerDialog = () => {
    setStickerDialog({
      open: false,
      data: [],
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const columnsFiltredTable = useMemo<MRT_ColumnDef<Purchase>[]>(() => {
    const hasUsedSupplier = data.some((row) =>
      row.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes("used")
    );
    const baseColumns: MRT_ColumnDef<Purchase>[] = [
      { accessorKey: "id_fact", header: "ID", size: 80 },
      {
        accessorKey: "Fournisseur.TYPE_SUPPLIER",
        header: "Product Type",
        size: 80,
      },
      { accessorKey: "Fournisseur.client_name", header: "Brand", size: 80 },
      { accessorKey: "CODE_EXTERNAL", header: "Product Reference", size: 80 },
      { accessorKey: "comment_edit", header: "Sales Code", size: 80 },
      { accessorKey: "Design_art", header: "Product", size: 80 },
      { accessorKey: "Color_Gold", header: "Gold Color", size: 80 },
      { accessorKey: "Color_Rush", header: "Stone Color", size: 80 },
    ];
    if (hasUsedSupplier) {
      baseColumns.push(
        {
          accessorKey: "Selling_Price_Currency",
          header: "Selling Price",
          size: 80,
        },
        { accessorKey: "CURRENCY", header: "Currency", size: 80 },
        { accessorKey: "RATE", header: "Exchange Rate", size: 80 },
        { accessorKey: "Cost_Lyd", header: "Cost (LYD)", size: 80 }
      );
    }
    baseColumns.push({
      header: "Actions",
      id: "actions",
      size: 130,
      Cell: ({ row }) => (
        <Box sx={{ display: "flex", gap: 1 }}>
          {/* Hide Edit button if IS_OK is true */}
          {!row.original.IS_OK && (
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

          {!row.original.IS_OK && (
            <Tooltip title="Delete">
              <IconButton
                color="error"
                onClick={() => handleDeleteClick(row.original)}
                size="small"
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="Print Sticker">
            <IconButton
              color="secondary"
              onClick={() =>
                handleOpenStickerDialog({
                  id_fact: row.original.id_fact,
                  qty: row.original.qty,
                  brand: row.original.Fournisseur?.client_name ?? "",
                  design: row.original.Design_art,
                  goldColor: row.original.Color_Gold,
                  stoneColor: row.original.Color_Rush,
                })
              }
              size="small"
            >
              <PrintIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    });
    return baseColumns;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const tableFiltered = useMaterialReactTable({
    columns: columnsFiltredTable,
    data: data,
    initialState: {
      pagination: {
        pageSize: 5,
        pageIndex: 0,
      },
    },
    state: { isLoading: loading || isSaving, density: "compact" },
    enableDensityToggle: true,
  });

  useEffect(() => {
    const handlePopState = () => {
      window.location.reload();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <Box>
      {/* Sticker Dialog */}
      <Dialog
        open={stickerDialog.open}
        onClose={handleCloseStickerDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Sticker Preview</DialogTitle>
        <DialogContent>
          <Box sx={{ p: 2 }}>
            <StickerPrintContent ref={stickerRef} items={stickerDialog.data} />
            <Box
              sx={{
                border: "1px dashed #ccc",
                p: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              {stickerDialog.data.map((item, index) => (
                <Box
                  key={index}
                  sx={{
                    width: "80mm",
                    height: "50mm",
                    p: 1,
                    border: "1px solid #000",
                    mb: 2,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Typography
                    variant="subtitle1"
                    align="center"
                    fontWeight="bold"
                  >
                    {item.brand}
                  </Typography>
                  <Divider sx={{ my: 0.5 }} />
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Typography variant="body2">ID: {item.id_fact}</Typography>
                    <Typography variant="body2">Wt: {item.qty}g</Typography>
                  </Box>
                  <Typography variant="body2">Design: {item.design}</Typography>
                  <Typography variant="body2">
                    Gold: {item.goldColor}
                  </Typography>
                  <Typography variant="body2">
                    Stone: {item.stoneColor}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseStickerDialog}>Cancel</Button>
          <Button
            onClick={handlePrintSticker}
            variant="contained"
            color="primary"
            startIcon={<PrintIcon />}
          >
            Print Stickers
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={handleDeleteCancel}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle
          id="alert-dialog-title"
          sx={{ bgcolor: "error.light", color: "error.contrastText" }}
        >
          Confirm Deletion
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 1,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <ErrorOutlineIcon color="error" />
            <DialogContentText
              id="alert-dialog-description"
              sx={{ color: "inherit", m: 0 }}
            >
              Are you sure you want to delete this product #
              {deleteDialog.purchaseNum}?
              <br />
              <Typography
                variant="caption"
                sx={{ color: "inherit", fontWeight: "bold" }}
              >
                This action cannot be undone!
              </Typography>
            </DialogContentText>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleDeleteCancel}
            variant="outlined"
            color="primary"
            sx={{ mr: 1 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="warning"
            startIcon={<DeleteIcon />}
          >
            Confirm Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
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

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h5" fontWeight="bold">
          {isEditMode ? "Edit Purchase No:" : "New Purchase No:"} {num_fact}
        </Typography>

        <Box
          sx={{
            backgroundColor: "#1b5e20",
            color: "#c8e6c9",
            px: 1.5,
            py: 0.5,
            borderRadius: 4,
            fontSize: "0.9rem",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <Typography component="span" variant="body2">
            {editPurchase.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes(
              "gold"
            ) &&
              `Total Full Weight: ${FulltotalWeight.toFixed(2)} | Total Weight: ${totalWeight.toFixed(2)} | `}
            {!distribution && <>Number Of Items: {itemCount}</>}
          </Typography>
        </Box>
      </Box>

      {productDetails?.[0]?.purchaseD && (
        <Alert
          severity="info"
          sx={{
            mb: 2,
            borderRadius: 2,
            borderColor: "success.main",
            backgroundColor: "inherit",
            color: "inherit",
            borderWidth: 2,
            borderStyle: "solid",
            fontSize: 15,
          }}
        >
          <strong>Diamond Details:</strong>

          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              gap: 4,
              padding: 1,
              justifyContent: "center",
              margin: "0 auto",
              overflowX: "auto",
              scrollBehavior: "smooth",
              width: "100%",
              maxWidth: "100vw",
              "& > *:first-of-type": { marginRight: 4 },
              "&::-webkit-scrollbar": { display: "none" },
              scrollbarWidth: "none",
              alignItems: "center",
            }}
          >
            <Box
              sx={{
                mt: 1,
                display: "flex",
                flexDirection: "row",
                gap: 3,
                padding: 1,
              }}
            >
              {/* Details Table */}
              <Box sx={{ flex: 2 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    <tr>
                      <td
                        style={{
                          color: labelColor,
                          fontWeight: 500,
                          width: 110,
                        }}
                      >
                        Brand:
                      </td>
                        <td style={{ color: valueColor, width: 140 }}>
                        {distribution?.PurchaseType?.toLowerCase().includes("gold")
                          ? (distribution?.purchase?.supplier?.client_name ?? "N/A")
                          : distribution?.PurchaseType?.toLowerCase().includes("diamond")
                            ? (distribution?.purchaseD?.supplier?.client_name ?? "N/A")
                            : distribution?.PurchaseType?.toLowerCase().includes("watche")
                              ? (distribution?.purchaseW?.supplier?.client_name ?? "N/A")
                              : distribution?.SupplierName
                                || distribution?.supplierName
                                || (typeof brand === 'string' ? brand : '')
                                || productDetails?.[0]?.purchaseD?.supplier?.client_name
                                || "N/A"}
                        </td>
                        <td
                        style={{
                          color: labelColor,
                          fontWeight: 500,
                          width: 110,
                        }}
                        >
                        Ref Code:
                        </td>
                      <td style={{ color: valueColor, width: 140 }}>
                        {productDetails[0].purchaseD.CODE_EXTERNAL}
                      </td>
                      <td
                        style={{
                          color: labelColor,
                          fontWeight: 500,
                          width: 110,
                        }}
                      >
                        Sales Code:
                      </td>
                      <td style={{ color: valueColor, width: 140 }}>
                        {productDetails[0].purchaseD.comment_edit
                          ? Number(
                              productDetails[0].purchaseD.comment_edit
                            ).toLocaleString()
                          : productDetails[0].purchaseD.comment_edit}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Product Name:
                      </td>
                      <td style={{ color: valueColor }}>
                        {productDetails[0].purchaseD.Design_art}
                      </td>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Sales Price:
                      </td>
                      <td style={{ color: valueColor }}>
                        {productSalePrice != null
                          ? Number(productSalePrice).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : "-"}
                      </td>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Carat:
                      </td>
                      <td style={{ color: valueColor }}>
                        {productDetails[0].purchaseD.carat}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Cut:
                      </td>
                      <td style={{ color: valueColor }}>
                        {productDetails[0].purchaseD.cut}
                      </td>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Color:
                      </td>
                      <td style={{ color: valueColor }}>
                        {productDetails[0].purchaseD.color}
                      </td>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Clarity:
                      </td>
                      <td style={{ color: valueColor }}>
                        {productDetails[0].purchaseD.clarity}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Shape:
                      </td>
                      <td style={{ color: valueColor }}>
                        {productDetails[0].purchaseD.shape}
                      </td>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Measurements:
                      </td>
                      <td style={{ color: valueColor }}>
                        {productDetails[0].purchaseD.measurements}
                      </td>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Depth %:
                      </td>
                      <td style={{ color: valueColor }}>
                        {productDetails[0].purchaseD.depth_percent}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Table %:
                      </td>
                      <td style={{ color: valueColor }}>
                        {productDetails[0].purchaseD.table_percent}
                      </td>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Girdle:
                      </td>
                      <td style={{ color: valueColor }}>
                        {productDetails[0].purchaseD.girdle}
                      </td>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Culet:
                      </td>
                      <td style={{ color: valueColor }}>
                        {productDetails[0].purchaseD.culet}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Polish:
                      </td>
                      <td style={{ color: valueColor }}>
                        {productDetails[0].purchaseD.polish}
                      </td>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Symmetry:
                      </td>
                      <td style={{ color: valueColor }}>
                        {productDetails[0].purchaseD.symmetry}
                      </td>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Fluorescence:
                      </td>
                      <td style={{ color: valueColor }}>
                        {productDetails[0].purchaseD.fluorescence}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Cert No:
                      </td>
                      <td style={{ color: valueColor }}>
                        {productDetails[0].purchaseD.certificate_number}
                      </td>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Lab:
                      </td>
                      <td style={{ color: valueColor }}>
                        {productDetails[0].purchaseD.certificate_lab}
                      </td>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Certificate:
                      </td>
                      <td style={{ color: valueColor }}>
                        <a
                          href={productDetails[0].purchaseD.certificate_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Link
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Laser Inscription:
                      </td>
                      <td style={{ color: valueColor }}>
                        {productDetails[0].purchaseD.laser_inscription}
                      </td>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Total Price:
                      </td>
                      <td style={{ color: valueColor }}>
                        {Number(
                          productDetails[0].purchaseD.total_price
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Origin:
                      </td>
                      <td style={{ color: valueColor }}>
                        {productDetails[0].purchaseD.origin_country}
                      </td>
                      <td style={{ color: labelColor, fontWeight: 500 }}>
                        Comment:
                      </td>
                      <td style={{ color: valueColor }}>
                        {productDetails[0].purchaseD.comment}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tbody>
                </table>
              </Box>
            </Box>

            {/* Carousel for images - same behavior as WNew_P */}
            <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                justifyItems: "stretch",
                gap: 2,
                alignItems: "center",
                padding: 1,
                border: "1px solid #ccc",
              }}
            >
              {images.length > 0 ? (
                <Box
                  sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    Images
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <IconButton
                      onClick={() =>
                        setCarouselIndex(
                          (i) => (i - 1 + images.length) % images.length
                        )
                      }
                    >
                      {"<"}
                    </IconButton>
                    <img
                      src={images[carouselIndex]}
                      alt={`Diamond ${carouselIndex + 1}`}
                      style={{
                        maxHeight: 240,
                        height: 240,
                        maxWidth: 410,
                        borderRadius: 8,
                        border: "1px solid #ccc",
                        objectFit: "contain",
                      }}
                    />
                    <IconButton
                      onClick={() =>
                        setCarouselIndex((i) => (i + 1) % images.length)
                      }
                    >
                      {">"}
                    </IconButton>
                  </Box>
                  <Typography variant="caption" sx={{ mt: 1 }}>
                    {carouselIndex + 1} / {images.length}
                  </Typography>
                </Box>
              ) : null}
            </Box>
          </Box>
        </Alert>
      )}

      <Box sx={{ display: "grid", gap: 2, mt: 2 }}>
        {/* Hide this section if distribution exists */}
        {!distribution && (
          <Box display={"inline-flex"} gap={2} justifyContent={"space-between"}>
            <Autocomplete
              id="supplier-select"
              sx={{ width: "50%" }}
              options={suppliers}
              autoHighlight
              getOptionLabel={(option) => option.client_name}
              value={editPurchase.Fournisseur || null}
              isOptionEqualToValue={(option, value) =>
                option.id_client === value.id_client
              }
              onChange={(event, newValue) => {
                setEditPurchase((prev) => ({
                  ...prev,
                  Fournisseur: newValue
                    ? {
                        id_client: newValue.id_client,
                        client_name: newValue.client_name,
                        TYPE_SUPPLIER: newValue.TYPE_SUPPLIER,
                      }
                    : undefined,
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
                  error={!!errors.client}
                  helperText={errors.client}
                  required
                />
              )}
            />

            <TextField
              sx={{ width: "30%" }}
              label="Reference Purchase"
              type="text"
              fullWidth
              value={editPurchase?.Original_Invoice || ""}
              onChange={(e) =>
                setEditPurchase((prev) => ({
                  ...prev,
                  Original_Invoice: e.target.value,
                }))
              }
              error={!!errors.Original_Invoice}
              helperText={errors.Original_Invoice}
              required
              disabled={!!distribution}
            />

            <TextField
              label="Date"
              type="date"
              sx={{ width: "30%" }}
              value={
                editPurchase?.date_fact ||
                new Date().toISOString().split("T")[0]
              }
              onChange={(e) =>
                setEditPurchase((prev) => ({
                  ...prev,
                  date_fact: e.target.value,
                }))
              }
              error={!!errors.date_fact}
              helperText={errors.date_fact}
              required
            />

            <TextField
              label="Comment"
              type="text"
              fullWidth
              value={editPurchase?.COMMENT || ""}
              onChange={(e) =>
                setEditPurchase((prev) => ({
                  ...prev,
                  COMMENT: e.target.value,
                }))
              }
            />
          </Box>
        )}
      </Box>

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 2 }}>
        {/* Hide Cancel button if distribution exists */}
        {distribution == null && !saveDisabled && (
          <Button
            variant="outlined"
            color="secondary"
            onClick={handleCancel}
            disabled={isSaving}
            startIcon={<CancelOutlined />}
            sx={{
              borderRadius: 3,
              textTransform: "none",
              fontWeight: "bold",
              px: 3,
              py: 1,
            }}
          >
            Cancel
          </Button>
        )}
        {!saveDisabled && (
          <Button
            variant="outlined"
            color="primary"
            startIcon={<AddIcon />}
            sx={{
              borderRadius: 3,
              textTransform: "none",
              fontWeight: "bold",
              px: 3,
              py: 1,
            }}
            onClick={() => setReceiveDialogOpen(true)}
            disabled={isSaving || saveDisabled}
            style={saveDisabled ? { display: "none" } : {}}
          >
            {isSaving
              ? "Saving..."
              : distribution
                ? "Receive this item"
                : isEditMode
                  ? "Save Changes"
                  : "Save"}
          </Button>
        )}
      </Box>

      {/* Success/Verified Info Dialog */}
      <Dialog
        open={saveDisabled}
        onClose={() => {
          setSaveDisabled(false);
          if (onReceived) onReceived();
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ textAlign: "center", pb: 0 }}>
          Operation Succeeded!
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              mt: 2,
            }}
          >
            <svg
              width="100"
              height="100"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="12" cy="12" r="12" fill="#4caf50" />
              <path
                d="M7 13.5L11 17L17 9.5"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <Typography
              variant="h4"
              color="success.main"
              fontWeight="bold"
              sx={{ mt: 2 }}
            >
              Operation Succeeded!
            </Typography>
            <Typography
              variant="subtitle1"
              color="text.secondary"
              sx={{ mt: 1, mb: 2 }}
            >
              This item has been received and verified.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              size="medium"
              sx={{
                borderRadius: 3,
                textTransform: "none",
                fontWeight: "bold",
                px: 4,
                py: 1.5,
              }}
              onClick={() => {
                setSaveDisabled(false);
                // if (onReceived) onReceived();
              }}
            >
              Ok
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Receive Confirmation Dialog */}
      <Dialog
        open={receiveDialogOpen}
        onClose={() => setReceiveDialogOpen(false)}
      >
        <DialogTitle>Confirm Receive</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Are you ready to receive this item?
            <br />
            <strong>
              If you receive this item, it cannot be deleted again.
            </strong>
          </Alert>
          <DialogContentText>
            Please confirm if you want to proceed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setReceiveDialogOpen(false)}
            color="primary"
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              setReceiveDialogOpen(false);
              await handleSave(); // Call your save logic
            }}
            color="success"
            variant="contained"
          >
            Confirm Receive
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DNew_p;
