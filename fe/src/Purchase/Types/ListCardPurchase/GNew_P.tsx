import { useEffect, useState, useMemo, useRef } from "react";
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

const GOLD_COLORS = [
  "Yellow",
  "White",
  "Rose",
  "Green",
  "Red",
  "Blue",
  "Black",
  "Grey",
  "Champagne",
  "Purple",
];
const STONE_COLORS = [
  "White",
  "Black",
  "Blue",
  "Red",
  "Green",
  "Yellow",
  "Pink",
  "Purple",
  "Orange",
  "Brown",
  "Grey",
  "Champagne",
];

const GNew_p = (props: NewPProps) => {
  const { num_fact, distribution, brand, referencePurchase } = props;

  const [totalWeight, setTotalWeight] = useState(0);
  const [FulltotalWeight, setFullTotalWeight] = useState(0);
  const [itemCount, setItemCount] = useState(0);
  const [data, setData] = useState<Purchase[]>([]);
  const [Productsdata, setProductsdata] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editPurchase, setEditPurchase] =
    useState<Purchase>(initialPurchaseState);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "info" | "warning",
  });

  const [isBrandDisabled, setIsBrandDisabled] = useState(false);
  const [isWeightDisabled, setIsWeightDisabled] = useState(false);

  const [stickerDialog, setStickerDialog] = useState({
    open: false,
    data: [] as StickerData[], // Changed to array to hold multiple items
  });

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

  const apiUrl = `/purchases`;
  const apiUrlProducts = `/products`;

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

  const fetchData = async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/");
    try {
      const res = await axios.get<Purchase[]>(`${apiUrl}/Getpurchase`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { ps, num_fact: num_fact },
      });
      setData(res.data);

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
      showNotification("Failed to fetch purchase data", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    const apiUrlsuppliers = `/suppliers`;
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get<Supplier[]>(`${apiUrlsuppliers}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Filter suppliers where type_supplier contains "gold" (case-insensitive)
      const goldSuppliers = res.data.filter((supplier) =>
        supplier.TYPE_SUPPLIER?.toLowerCase().includes("gold")
      );

      setSuppliers(goldSuppliers);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      showNotification("Failed to fetch suppliers", "error");
    }
  };

  useEffect(() => {
    fetchData();
    fetchDataProducts();
    fetchSuppliers();
    resetForm();
  }, [num_fact]);

  const resetForm = () => {
    setEditPurchase({
      ...initialPurchaseState,
      num_fact: num_fact || 0,
      usr: Number(Cuser) || 0,
      ps: Number(ps) || 0,
      date_fact: new Date().toISOString().split("T")[0],
    });
    setErrors({});
    setIsEditMode(false);
  };

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

    setEditPurchase({
      ...row,
      date_fact: formattedDate,
      Fournisseur: row.Fournisseur || supplierData,
      client: row.Fournisseur?.id_client || row.client,
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
    if (!editPurchase.Color_Gold)
      newErrors.Color_Gold = "Gold color is required";
    if (!editPurchase.Color_Rush)
      newErrors.Color_Rush = "Stone color is required";

    if (editPurchase.Full_qty <= 0)
      newErrors.Full_qty = "Full weight must be greater than 0";
    if (editPurchase.qty <= 0) newErrors.qty = "Weight must be greater than 0";

    // Add this validation: Weight must be less than or equal to Full weight
    if (editPurchase.qty > editPurchase.Full_qty) {
      newErrors.qty = "Weight must be less than or equal to Full weight";
    }

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCancel = () => {
    setEditPurchase(initialPurchaseState);
    setErrors({});
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setIsSaving(true);
    const token = localStorage.getItem("token");

    try {
      // If not used supplier, set default values for these fields
      const payloadData = {
        ...editPurchase,
        Selling_Price_Currency: isUsedSupplier
          ? editPurchase.Selling_Price_Currency
          : 0,
        CURRENCY: isUsedSupplier ? editPurchase.CURRENCY : "USD",
        RATE: isUsedSupplier ? editPurchase.RATE : 1,
        Cost_Lyd: isUsedSupplier ? editPurchase.Cost_Lyd : 0,
      };

      const payload = {
        ...payloadData,
        num_fact: num_fact,
        usr: Cuser,
        ps: ps,
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

      // If this was a distribution receive, mark as received
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
    }
  };

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

  const fetchDataProducts = async () => {
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
  };

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

  useEffect(() => {
    // If opened for receiving a distribution
    if (distribution) {
      setEditPurchase((prev) => ({
        ...prev,
        Fournisseur: {
          id_client: distribution.SupplierID || distribution.supplierID || 0,
          client_name:
            distribution.SupplierName || distribution.supplierName || "",
          TYPE_SUPPLIER: "Gold Purchase",
        },
        client: distribution.SupplierID || distribution.supplierID || 0,
        num_fact: distribution.PurchaseID || 0,
        Original_Invoice: referencePurchase
          ? String(referencePurchase)
          : distribution.PurchaseRef || "",
        date_fact: new Date().toISOString().split("T")[0],
      }));
      setIsBrandDisabled(true);
      setIsWeightDisabled(false); // <-- Allow editing weight fields
    } else {
      setIsBrandDisabled(false);
      setIsWeightDisabled(false);
    }
  }, [distribution, referencePurchase]);

  // Set vendor by brand prop if provided
  useEffect(() => {
    if (brand && suppliers.length > 0) {
      const found = suppliers.find(
        (s) =>
          s.id_client === brand ||
          s.client_name.toLowerCase() === String(brand).toLowerCase()
      );
      if (found) {
        setEditPurchase((prev) => ({
          ...prev,
          Fournisseur: {
            id_client: found.id_client,
            client_name: found.client_name,
            TYPE_SUPPLIER: found.TYPE_SUPPLIER,
          },
          client: found.id_client,
        }));
        setIsBrandDisabled(true);
      }
    }
  }, [brand, suppliers]);

  const columnsFiltredTable = useMemo<MRT_ColumnDef<Purchase>[]>(() => {
    // Determine if any row is a 'used' supplier
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
      { accessorKey: "Full_qty", header: "Full Weight", size: 80 },
      { accessorKey: "qty", header: "Weight", size: 80 },
      { accessorKey: "Design_art", header: "Product", size: 80 },
      { accessorKey: "Color_Gold", header: "Gold Color", size: 80 },
      { accessorKey: "Color_Rush", header: "Stone Color", size: 80 },
      { accessorKey: "IS_OK", header: "Is Approved", size: 80 },
    ];
    // Conditionally add columns for used suppliers
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
  }, [data, handleOpenStickerDialog]); // Add handleOpenStickerDialog to dependencies

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
          gap: 2,
        }}
      >
        {/* Left: Purchase No */}
        <Typography variant="h5" fontWeight="bold" sx={{ flex: 1 }}>
          {isEditMode ? "Edit Purchase No:" : "New Purchase No:"} {num_fact}
        </Typography>

        {/* Center: To be received */}
        {distribution && (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Box
              sx={{
                bgcolor: "rgba(255, 152, 0, 0.08)",
                border: "1px solid rgba(255, 152, 0, 0.2)",
                color: "inherit",

                px: 1.5,
                py: 0.2,
                borderRadius: "16px",
                fontSize: "0.9rem",
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                whiteSpace: "nowrap",
              }}
            >
              Total:{" "}
              {Number(distribution.Weight).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              g&nbsp;|&nbsp; Received:{" "}
              {totalWeight.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              g&nbsp;|&nbsp;
              <span style={{ color: "red" }}>
                Rest:{" "}
                {(Number(distribution.Weight) - totalWeight).toLocaleString(
                  undefined,
                  { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                )}
                g
              </span>
            </Box>
          </Box>
        )}

        {/* Right: Total weights */}
        <Box
          sx={{
            bgcolor: "rgba(76, 175, 80, 0.08)",
            color: "inherit",
            borderRadius: "16px",
            border: "1px solid rgba(76, 175, 80, 0.2)",
            px: 1.5,
            py: 0.2,

            fontSize: "0.9rem",
            display: "inline-flex",
            alignItems: "center",

            justifyContent: "center",
          }}
        >
          <Typography component="span" variant="body2">
            {editPurchase.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes(
              "gold"
            ) &&
              `Total Full Weight: ${FulltotalWeight.toFixed(2)} | Total Weight: ${totalWeight.toFixed(2)} | `}
            Number Of Items: {itemCount}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "grid", gap: 2, mt: 2 }}>
        <Box display={"inline-flex"} gap={2} justifyContent={"space-between"}>
          <Autocomplete
            id="supplier-select"
            sx={{ width: "50%" }}
            options={suppliers}
            autoHighlight
            getOptionLabel={(option) => option.client_name}
            value={
              editPurchase.Fournisseur ||
              suppliers.find((s) => s.id_client === editPurchase.client) ||
              null
            }
            onChange={(event, newValue) => {
              if (!isBrandDisabled) {
                setEditPurchase((prev) => ({
                  ...prev,
                  Fournisseur: newValue
                    ? {
                        id_client: newValue.id_client,
                        client_name: newValue.client_name,
                        TYPE_SUPPLIER: newValue.TYPE_SUPPLIER,
                      }
                    : undefined,
                  client: newValue ? newValue.id_client : 0,
                }));
              }
            }}
            onInputChange={(event, inputValue) => {
              if (!isBrandDisabled && inputValue) {
                const found = suppliers.find(
                  (s) =>
                    s.client_name.toLowerCase() === inputValue.toLowerCase()
                );
                if (found) {
                  setEditPurchase((prev) => ({
                    ...prev,
                    Fournisseur: {
                      id_client: found.id_client,
                      client_name: found.client_name,
                      TYPE_SUPPLIER: found.TYPE_SUPPLIER,
                    },
                    client: found.id_client,
                  }));
                }
              }
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
                disabled={isBrandDisabled}
              />
            )}
            disabled={isBrandDisabled}
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
            disabled // <-- Add this prop to disable the field
          />

          <TextField
            label="Date"
            type="date"
            sx={{ width: "30%" }}
            value={
              editPurchase?.date_fact || new Date().toISOString().split("T")[0]
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
              setEditPurchase((prev) => ({ ...prev, COMMENT: e.target.value }))
            }
          />
        </Box>

        <Divider sx={{ mb: 0, borderColor: "#616161", borderBottomWidth: 1 }} />

        <Box display={"inline-flex"} gap={2} justifyContent={"space-between"}>
          <TextField
            label="Full Weight"
            type="number"
            fullWidth
            value={editPurchase?.Full_qty || 0}
            onChange={(e) =>
              setEditPurchase((prev) => ({
                ...prev,
                Full_qty: parseFloat(e.target.value),
              }))
            }
            error={!!errors.Full_qty}
            helperText={errors.Full_qty}
            required
            disabled={isWeightDisabled}
          />

          <TextField
            label="Net Weight"
            type="number"
            fullWidth
            value={editPurchase?.qty || 0}
            onChange={(e) =>
              setEditPurchase((prev) => ({
                ...prev,
                qty: parseFloat(e.target.value),
              }))
            }
            error={!!errors.qty}
            helperText={errors.qty}
            required
            inputProps={{ min: 0.01, step: 0.01 }}
            disabled={isWeightDisabled}
          />

          <Autocomplete
            options={Productsdata}
            fullWidth
            getOptionLabel={(option) =>
              typeof option === "string" ? option : option.desig_famille
            }
            value={
              Productsdata.find(
                (p) => p.desig_famille === editPurchase.Design_art
              ) || null
            }
            onChange={(event, newValue) => {
              setEditPurchase((prev) => ({
                ...prev,
                Design_art: newValue?.desig_famille || "",
              }));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Product Name"
                error={!!errors.Design_art}
                helperText={errors.Design_art}
                required
              />
            )}
          />

          <Autocomplete
            options={STONE_COLORS}
            fullWidth
            value={editPurchase?.Color_Rush || ""}
            onChange={(event, newValue) =>
              setEditPurchase((prev) => ({
                ...prev,
                Color_Rush: newValue || "",
              }))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Stone Color"
                error={!!errors.Color_Rush}
                helperText={errors.Color_Rush}
                required
              />
            )}
          />

          <Autocomplete
            options={GOLD_COLORS}
            fullWidth
            value={editPurchase?.Color_Gold || ""}
            onChange={(event, newValue) =>
              setEditPurchase((prev) => ({
                ...prev,
                Color_Gold: newValue || "",
              }))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Gold Color"
                error={!!errors.Color_Gold}
                helperText={errors.Color_Gold}
                required
              />
            )}
          />

          {isUsedSupplier && (
            <>
              <TextField
                label="Selling Price"
                type="number"
                fullWidth
                value={editPurchase?.Selling_Price_Currency || 0}
                onChange={(e) =>
                  setEditPurchase((prev) => ({
                    ...prev,
                    Selling_Price_Currency: parseFloat(e.target.value),
                  }))
                }
                error={!!errors.Selling_Price_Currency}
                helperText={errors.Selling_Price_Currency}
                required
              />

              <FormControl fullWidth>
                <InputLabel>Currency *</InputLabel>
                <Select
                  value={editPurchase?.CURRENCY || ""}
                  onChange={(e) =>
                    setEditPurchase((prev) => ({
                      ...prev,
                      CURRENCY: e.target.value,
                    }))
                  }
                  label="Currency *"
                  error={!!errors.CURRENCY}
                >
                  <MenuItem value="USD">USD</MenuItem>
                  <MenuItem value="Euro">Euro</MenuItem>
                  <MenuItem value="LYD">LYD</MenuItem>
                  <MenuItem value="GBP">GBP</MenuItem>
                </Select>
                {errors.CURRENCY && (
                  <Typography variant="caption" color="error">
                    {errors.CURRENCY}
                  </Typography>
                )}
              </FormControl>

              <TextField
                label="Exchange Rate"
                type="number"
                fullWidth
                value={editPurchase?.RATE || 1}
                onChange={(e) =>
                  setEditPurchase((prev) => ({
                    ...prev,
                    RATE: parseFloat(e.target.value),
                  }))
                }
                error={!!errors.RATE}
                helperText={errors.RATE}
                required
                inputProps={{ min: 0.01, step: 0.01 }}
              />

              <TextField
                label="Cost (LYD)"
                type="number"
                fullWidth
                value={editPurchase?.Cost_Lyd || 0}
                onChange={(e) =>
                  setEditPurchase((prev) => ({
                    ...prev,
                    Cost_Lyd: parseFloat(e.target.value),
                  }))
                }
                error={!!errors.Cost_Lyd}
                helperText={errors.Cost_Lyd}
                required
                inputProps={{ min: 0.01, step: 0.01 }}
              />
            </>
          )}
        </Box>

        <Divider
          sx={{ mb: 0, borderColor: "grey.300", borderBottomWidth: 1 }}
        />

        <MaterialReactTable table={tableFiltered} />
      </Box>

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 2 }}>
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
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : isEditMode ? "Save Changes" : "Save"}
        </Button>
      </Box>
    </Box>
  );
};

export default GNew_p;
