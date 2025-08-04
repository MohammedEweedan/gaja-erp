import { useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    MaterialReactTable,
    useMaterialReactTable,
    type MRT_ColumnDef,
} from 'material-react-table';
import {
    Box, IconButton, Tooltip, Button, TextField,
    Divider, Typography,
    Select,
    MenuItem,
    FormControl, InputLabel,
    Autocomplete,
    Alert,
    Snackbar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    DialogContentText
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import PrintIcon from '@mui/icons-material/PrintOutlined';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { CancelOutlined, Warning } from '@mui/icons-material';

import React from 'react';
import { Console } from 'console';
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
    date_fact: new Date().toISOString().split('T')[0],
    client: 0,
    id_art: 0,
    qty: 0,
    Full_qty: 0,
    Unite: '',
    num_fact: 0,
    usr: 0,
    d_time: new Date().toISOString(),
    Design_art: '',
    Color_Gold: '',
    Color_Rush: '',
    Cost_Currency: 0,
    RATE: 1,
    Cost_Lyd: 0,
    Selling_Price_Currency: 0,
    CODE_EXTERNAL: '',
    Selling_Rate: 0,
    is_selled: false,
    ps: 0,
    IS_OK: false,
    COMMENT: '',
    comment_edit: '',
    date_inv: '',
    CURRENCY: 'USD',
    General_Comment: '',
    MakingCharge: 0,
    ShippingCharge: 0,
    TravelExpesenes: 0,
    cost_g: 0,
    ExtraClient: 0,
    Model: '',
    Serial_Number: '',
    WarrantyDate: '',
    Notes: '',
    client_name: '',
    TYPE_SUPPLIER: '',
    Original_Invoice: '',
};

interface NewPProps {
    num_fact?: number;
    brand?: number;
    receivingweight?: number;
    referencePurchase?: number;
    distribution?: any; // Add this prop
    onReceived?: () => void; // Callback after receiving
}

const WNew_p = (props: NewPProps) => {

    const { num_fact, distribution, onReceived, brand, referencePurchase } = props;

    //const { num_fact, distribution, onReceived } = props;
    const [totalWeight, setTotalWeight] = useState(0);
    const [FulltotalWeight, setFullTotalWeight] = useState(0);
    const [itemCount, setItemCount] = useState(0);
    const [data, setData] = useState<Purchase[]>([]);
    const [Productsdata, setProductsdata] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showPurchaseForm, setShowPurchaseForm] = useState(false);
    const [editPurchase, setEditPurchase] = useState<Purchase>(initialPurchaseState);
    const [isEditMode, setIsEditMode] = useState(false);
    const [errors, setErrors] = useState<any>({});
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loadingSuppliers, setLoadingSuppliers] = useState(false);
    const [refreshFlag, setRefreshFlag] = useState(0);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success' as 'success' | 'error' | 'info' | 'warning',
    });
    const [stickerDialog, setStickerDialog] = useState({
        open: false,
        data: [] as StickerData[] // Changed to array to hold multiple items
    });
    const [productDetails, setProductDetails] = useState<any>(null);
    const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
    const [pendingSave, setPendingSave] = useState(false);

    const navigate = useNavigate();
    let ps: string | null = null;
    let Cuser: string | null = null;
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            const userObj = JSON.parse(userStr);
            ps = userObj.ps ?? localStorage.getItem('ps');
            Cuser = userObj.Cuser ?? localStorage.getItem('Cuser');
        } catch {
            ps = localStorage.getItem('ps');
            Cuser = localStorage.getItem('Cuser');
        }
    } else {
        ps = localStorage.getItem('ps');
        Cuser = localStorage.getItem('Cuser');
    }
    const apiUrl = "http://102.213.182.8:9000/purchases";


    const API_BASEImage = 'http://102.213.182.8:9000/images'; // Adjust if needed
    const [images, setImages] = useState<string[]>([]);
    const [carouselIndex, setCarouselIndex] = useState(0); // Add carousel index state

    // Helper to fetch image as blob with auth and return object URL
    const fetchImageWithAuth = async (url: string, token: string) => {
        try {
            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob',
            });
            return URL.createObjectURL(res.data);
        } catch (err) {
            return '';
        }
    };

    // Update fetchImages to fetch blobs with auth
    const fetchImages = async (id_achat: number) => {
        const token = localStorage.getItem('token');
        if (!token || !id_achat) return;
        try {
            const res = await axios.get(`${API_BASEImage}/list/${id_achat}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            let urls: string[] = [];
            if (Array.isArray(res.data) && res.data.length > 0 && typeof res.data[0] === 'object') {
                urls = res.data.map((img: any) => img.url || img);
            } else {
                urls = res.data;
            }
            // Fetch all images as blobs with auth
            const blobUrls = await Promise.all(urls.map(url => fetchImageWithAuth(url, token)));
            setImages(blobUrls.filter(Boolean));
        } catch (err) {
            setImages([]);
        }
    };

    // Fetch images when productDetails[0].id_achat changes
    useEffect(() => {
        // Try to get id_achat from productDetails or from distribution.purchaseW
        let id_achat: number | undefined;

        if (productDetails && productDetails[0]?.id_achat) {
            id_achat = productDetails[0].id_achat;
        } else if (distribution?.purchaseW?.id_achat) {
            id_achat = distribution.purchaseW.id_achat;
        }

        if (id_achat) {
          //  console.log("Fetching images for id_achat:", id_achat);
            fetchImages(id_achat);
        }
    }, [productDetails, distribution]);

    const isUsedSupplier = useMemo(() => {
        return editPurchase.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes('used') ?? false;
    }, [editPurchase.Fournisseur]);

    const stickerRef = useRef<HTMLDivElement>(null);
    const handlePrintSticker = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            const content = stickerDialog.data.map(item => `
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
    `).join('');

            printWindow.document.write(`
      <html>
        <head>
          <title>Stickers-${stickerDialog.data[0]?.id_fact || ''}</title>
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

    const StickerPrintContent = React.forwardRef<HTMLDivElement, { items: StickerData[] }>(
        ({ items }, ref) => (
            <div ref={ref} style={{ display: 'none' }}>
                {items.map((item, index) => (
                    <div
                        key={index}
                        style={{
                            width: '80mm',
                            height: '50mm',
                            padding: '2mm',
                            border: '1px solid #000',
                            margin: '0 auto',
                            pageBreakAfter: 'always',
                            fontFamily: 'Arial, sans-serif'
                        }}
                    >
                        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                            {item.brand}
                        </div>
                        <hr style={{ margin: '2px 0', borderColor: '#000' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                            <span>ID: {item.id_fact}</span>
                            <span>Wt: {item.qty}g</span>
                        </div>
                        <div style={{ fontSize: '12px' }}>Design: {item.design}</div>
                        <div style={{ fontSize: '12px' }}>Gold: {item.goldColor}</div>
                        <div style={{ fontSize: '12px' }}>Stone: {item.stoneColor}</div>
                    </div>
                ))}
            </div>
        )
    );
    const handleCloseSnackbar = () => {
        setSnackbar(prev => ({ ...prev, open: false }));
    };

    const showNotification = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
        setSnackbar({
            open: true,
            message,
            severity,
        });
    };

    const fetchData = async () => {
        const token = localStorage.getItem('token');
        if (!token) return navigate("/");
        try {
            const res = await axios.get<Purchase[]>(`${apiUrl}/Getpurchase`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { ps, num_fact: num_fact }
            });
            setData(res.data);

            setEditPurchase(prevState => ({
                ...prevState,
                client: res.data[0]?.client ?? prevState.client,  // Only update if data has client
                Fournisseur: res.data[0]?.Fournisseur ?? prevState.Fournisseur
            }));

            const weightSum = res.data.reduce((sum, item) => sum + (item.qty || 0), 0);
            setTotalWeight(weightSum);
            const FullweightSum = res.data.reduce((sum, item) => sum + (item.Full_qty || 0), 0);
            setFullTotalWeight(FullweightSum);
            setItemCount(res.data.length);
        } catch (err: any) {
            if (err.response?.status === 401) navigate("/");
            showNotification('Failed to fetch purchase data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchSuppliers = async () => {
        const apiUrlsuppliers = "http://102.213.182.8:9000/suppliers";
        const token = localStorage.getItem('token');
        try {
            setLoadingSuppliers(true);
            const res = await axios.get<Supplier[]>(`${apiUrlsuppliers}/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Filter suppliers where type_supplier contains "gold" (case-insensitive)
            const goldSuppliers = res.data.filter(supplier =>
                supplier.TYPE_SUPPLIER?.toLowerCase().includes('watche')
            );

            setSuppliers(goldSuppliers);
        } catch (error) {
            console.error("Error fetching suppliers:", error);
            showNotification('Failed to fetch suppliers', 'error');
        } finally {
            setLoadingSuppliers(false);
        }
    };

    const fetchProductDetails = async (distributionID: number, type: string) => {
        const token = localStorage.getItem('token');


        try {
            const response = await axios.get(
                `http://102.213.182.8:9000/Dpurchases/ProductDetails`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { distributionID, type }
                }
            );


            setProductDetails(response.data); // Store product details in state
            return response.data;


        } catch (error) {
            showNotification('Failed to fetch product details', 'error');
            return null;
        }
    };

    useEffect(() => {
        resetForm();
        fetchData();
        fetchSuppliers();
        fetchDataProducts();
    }, [num_fact]);

    // Prefill fields from distribution if present
    useEffect(() => {
        const fillFromDistribution = async () => {
            if (distribution) {
                const type = distribution.PurchaseType?.toLowerCase();
                const details = await fetchProductDetails(distribution.distributionID, type);
                if (details && details[0]?.purchaseW) {
                    setProductDetails(details);

                    // Set vendor from productDetails if available
                    const vendorObj = details[0].purchaseW.supplier
                        ? {
                            id_client: details[0].purchaseW.supplier.id_client || 0,
                            client_name: details[0].purchaseW.supplier.client_name || '',
                            TYPE_SUPPLIER: details[0].purchaseW.supplier.TYPE_SUPPLIER || 'Watche Purchase'
                        }
                        : {
                            id_client: 0,
                            client_name: details[0].purchaseW.Brand || '',
                            TYPE_SUPPLIER: 'Watche Purchase'
                        };

                    setSuppliers(prev => {
                        if (
                            vendorObj.client_name &&
                            !prev.some(s => s.client_name === vendorObj.client_name)
                        ) {
                            return [...prev, vendorObj];
                        }
                        return prev;
                    });

                    setEditPurchase(prev => ({
                        ...prev,
                        Fournisseur: vendorObj,
                        client: vendorObj.id_client,
                        CODE_EXTERNAL: details[0].purchaseW.reference_number || '',
                        comment_edit: details[0].purchaseW.comment_edit || '',
                        Design_art: details[0].purchaseW.model || prev.Design_art,
                        Brand: details[0].purchaseW.Brand,
                        model: details[0].purchaseW.model,
                        reference_number: details[0].purchaseW.reference_number,
                        serial_number: details[0].purchaseW.serial_number,
                        movement: details[0].purchaseW.movement,
                        caliber: details[0].purchaseW.caliber,
                        gender: details[0].purchaseW.gender,
                        condition: details[0].purchaseW.condition,
                        diamond_total_carat: details[0].purchaseW.diamond_total_carat,
                        diamond_quality: details[0].purchaseW.diamond_quality,
                        diamond_setting: details[0].purchaseW.diamond_setting,
                        number_of_diamonds: details[0].purchaseW.number_of_diamonds,
                        custom_or_factory: details[0].purchaseW.custom_or_factory,
                        case_material: details[0].purchaseW.case_material,
                        case_size: details[0].purchaseW.case_size,
                        bezel: details[0].purchaseW.bezel,
                        bracelet_type: details[0].purchaseW.bracelet_type,
                        bracelet_material: details[0].purchaseW.bracelet_material,
                        dial_color: details[0].purchaseW.dial_color,
                        dial_style: details[0].purchaseW.dial_style,
                        crystal: details[0].purchaseW.crystal,
                        water_resistance: details[0].purchaseW.water_resistance,
                        functions: details[0].purchaseW.functions,
                        power_reserve: details[0].purchaseW.power_reserve,
                        box_papers: details[0].purchaseW.box_papers,
                        warranty: details[0].purchaseW.warranty,
                        retail_price: details[0].purchaseW.retail_price,
                        sale_price: details[0].purchaseW.sale_price,
                        image_url: details[0].purchaseW.image_url,
                        certificate_url: details[0].purchaseW.certificate_url,
                        Comment_Achat: details[0].purchaseW.Comment_Achat,
                        DocumentNo: details[0].purchaseW.DocumentNo,
                        IsApprouved: details[0].purchaseW.IsApprouved,
                        Approval_Date: details[0].purchaseW.Approval_Date,
                        ApprouvedBy: details[0].purchaseW.ApprouvedBy,
                        Comment: details[0].purchaseW.Comment,
                        attachmentUrl: details[0].purchaseW.attachmentUrl,
                        Date_Achat: details[0].purchaseW.Date_Achat,
                        Usr: details[0].purchaseW.Usr,
                        sharepoint_url: details[0].purchaseW.sharepoint_url,
                        MakingCharge: details[0].purchaseW.MakingCharge,
                        ShippingCharge: details[0].purchaseW.ShippingCharge,
                        TravelExpesenes: details[0].purchaseW.TravelExpesenes,
                        Rate: details[0].purchaseW.Rate,
                        Total_Price_LYD: details[0].purchaseW.Total_Price_LYD,
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
        if (distribution && (distribution.SupplierID || distribution.supplierID || brand)) {
            const vendorObj = {
                id_client: distribution.SupplierID || distribution.supplierID || brand || 0,
                client_name: distribution.SupplierName || distribution.supplierName || '',
                TYPE_SUPPLIER: 'Watche Purchase'
            };
            setEditPurchase(prev => ({
                ...prev,
                Fournisseur: vendorObj,
                client: vendorObj.id_client
            }));
            setSuppliers(prev => {
                if (!prev.some(s => s.id_client === vendorObj.id_client)) {
                    return [...prev, vendorObj];
                }
                return prev;
            });
        }
    }, [distribution, brand]);

    const resetForm = () => {
        setEditPurchase({
            ...initialPurchaseState,
            num_fact: num_fact || 0,
            usr: Number(Cuser),
            ps: Number(ps),
            date_fact: new Date().toISOString().split('T')[0]
        });
        setErrors({});
        setIsEditMode(false);
    };



    const handleEdit = (row: Purchase) => {
        const formattedDate = row.date_fact
            ? new Date(row.date_fact).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];

        const supplierData = row.Fournisseur
            ? {
                id_client: row.Fournisseur.id_client,
                client_name: row.Fournisseur.client_name,
                TYPE_SUPPLIER: row.Fournisseur.TYPE_SUPPLIER
            }
            : undefined;

        setEditPurchase({
            ...row,
            date_fact: formattedDate,
            Fournisseur: row.Fournisseur || supplierData,
            client: row.Fournisseur?.id_client || row.client
        });
        setIsEditMode(true);
        setShowPurchaseForm(true);
    };

    const validateForm = () => {
        const newErrors: any = {};

        if (!editPurchase.date_fact) newErrors.date_fact = 'Date is required';

        if (!editPurchase.Fournisseur?.id_client && !editPurchase.client) {
            newErrors.client = 'Vendor is required';
        } else if (editPurchase.Fournisseur?.id_client && !suppliers.some(s => s.id_client === editPurchase.Fournisseur?.id_client)) {
            newErrors.client = 'Selected vendor is invalid';
        }

        if (!editPurchase.Design_art) newErrors.Design_art = 'Design is required';
        //if (!editPurchase.Color_Gold) newErrors.Color_Gold = 'Gold color is required';
        //if (!editPurchase.Color_Rush) newErrors.Color_Rush = 'Stone color is required';

        if (editPurchase.Full_qty <= 0) editPurchase.Full_qty = 1;
        if (editPurchase.qty <= 0) editPurchase.qty = 1;

        // Only validate these fields if it's a used supplier
        if (isUsedSupplier) {
            if (editPurchase.Selling_Price_Currency <= 0) newErrors.Selling_Price_Currency = 'Selling price must be greater than 0';
            if (!editPurchase.CURRENCY) newErrors.CURRENCY = 'Currency is required';
            if (editPurchase.RATE <= 0) newErrors.RATE = 'Exchange rate must be greater than 0';
            if (editPurchase.Cost_Lyd <= 0) newErrors.Cost_Lyd = 'Cost (LYD) must be greater than 0';
        }

        // Reference purchase is NOT required anymore
        // if (!editPurchase.Original_Invoice) newErrors.Original_Invoice = 'Reference purchase is required';

        setErrors(newErrors);

        console.log(newErrors)
        return Object.keys(newErrors).length === 0;
    };

    const handleCancel = () => {
        setShowPurchaseForm(false);
        setEditPurchase(initialPurchaseState);
        setErrors({});
    };

    const handleSave = async () => {
        const token = localStorage.getItem('token');
        if (!validateForm()) return;
        setIsSaving(true);
        try {
            // If not used supplier, set default values for these fields
            const payloadData = {
                ...editPurchase,
                Selling_Price_Currency: productDetails[0].purchaseW.sale_price,
                CURRENCY: isUsedSupplier ? editPurchase.CURRENCY : 'USD',
                RATE: isUsedSupplier ? editPurchase.RATE : 1,
                Cost_Lyd: isUsedSupplier ? editPurchase.Cost_Lyd : 0,
            };

            const payload = {
                ...payloadData,
                num_fact: num_fact,
                usr: Cuser,
                ps: ps,
                client: editPurchase.Fournisseur?.id_client || editPurchase.client
            };
            let responseData: Purchase;

            if (isEditMode) {
                const response = await axios.put(`${apiUrl}/Update/${editPurchase.id_fact}`, payload, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                responseData = response.data;
                showNotification('Item updated successfully', 'success');
            } else {
                const response = await axios.post(`${apiUrl}/Add`, payload, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                responseData = response.data;
                showNotification('Item added successfully', 'success');
            }

            setRefreshFlag(prev => prev + 1);
            setShowPurchaseForm(true);
            fetchData();

            setIsEditMode(false);






            if (distribution && distribution.distributionID) {




                await axios.put(
                    `http://102.213.182.8:9000/Dpurchases/UpdateStatus/${distribution.distributionID}`,
                    { DistributionISOK: true },
                    { headers: { Authorization: `Bearer ${token}` } }
                ).catch((error) => {
                    console.error("Error updating distribution:", error);
                })


                //  if (onReceived) onReceived();
            }



        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'Save failed';
            showNotification(errorMessage, 'error');
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

        const token = localStorage.getItem('token');
        try {
            await axios.delete(`${apiUrl}/Delete/${deleteDialog.purchaseId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRefreshFlag(prev => prev + 1);
            fetchData();
            showNotification('Item deleted successfully', 'success');
        } catch (error) {
            console.error("Error deleting purchase:", error);
            showNotification('Failed to delete purchase', 'error');
        } finally {
            setDeleteDialog({ open: false, purchaseId: null, purchaseNum: null });
        }
    };

    const handleDeleteCancel = () => {
        setDeleteDialog({ open: false, purchaseId: null, purchaseNum: null });
    };

    const apiUrlProducts = "http://102.213.182.8:9000/products";

    const fetchDataProducts = async () => {
        const token = localStorage.getItem('token');
        if (!token) return navigate("/");

        try {
            const response = await axios.get<Product[]>(`${apiUrlProducts}/all`, {
                headers: { Authorization: `Bearer ${token}` }
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
        const currentIndex = data.findIndex(item => item.id_fact === stickerData.id_fact);

        // Get the next item if it exists
        const nextItem = currentIndex < data.length - 1 ? data[currentIndex + 1] : null;

        // Prepare sticker data for both items
        const itemsToPrint: StickerData[] = [{
            id_fact: stickerData.id_fact,
            qty: stickerData.qty,
            brand: stickerData.brand,
            design: stickerData.design,
            goldColor: stickerData.goldColor,
            stoneColor: stickerData.stoneColor
        }];

        if (nextItem) {
            itemsToPrint.push({
                id_fact: nextItem.id_fact,
                qty: nextItem.qty,
                brand: nextItem.Fournisseur?.client_name ?? '',
                design: nextItem.Design_art,
                goldColor: nextItem.Color_Gold,
                stoneColor: nextItem.Color_Rush
            });
        }

        setStickerDialog({
            open: true,
            data: itemsToPrint
        });
    };

    const handleCloseStickerDialog = () => {
        setStickerDialog({
            open: false,
            data: []
        });
    };

    const columnsFiltredTable = useMemo<MRT_ColumnDef<Purchase>[]>(() => {
        const hasUsedSupplier = data.some(row => row.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes('used'));
        const baseColumns: MRT_ColumnDef<Purchase>[] = [
            { accessorKey: 'id_fact', header: 'ID', size: 80 },
            { accessorKey: 'Fournisseur.TYPE_SUPPLIER', header: 'Product Type', size: 80 },
            { accessorKey: 'Fournisseur.client_name', header: 'Brand', size: 80 },
            { accessorKey: 'CODE_EXTERNAL', header: 'Product Reference', size: 80 },
            { accessorKey: 'comment_edit', header: 'Sales Code', size: 80 },
            { accessorKey: 'Design_art', header: 'Product', size: 80 },
            { accessorKey: 'Color_Gold', header: 'Gold Color', size: 80 },
            { accessorKey: 'Color_Rush', header: 'Stone Color', size: 80 },
        ];
        if (hasUsedSupplier) {
            baseColumns.push(
                { accessorKey: 'Selling_Price_Currency', header: 'Selling Price', size: 80 },
                { accessorKey: 'CURRENCY', header: 'Currency', size: 80 },
                { accessorKey: 'RATE', header: 'Exchange Rate', size: 80 },
                { accessorKey: 'Cost_Lyd', header: 'Cost (LYD)', size: 80 }
            );
        }
        baseColumns.push({
            header: 'Actions',
            id: 'actions',
            size: 130,
            Cell: ({ row }) => (
                <Box sx={{ display: 'flex', gap: 1 }}>
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
                            onClick={() => handleOpenStickerDialog({
                                id_fact: row.original.id_fact,
                                qty: row.original.qty,
                                brand: row.original.Fournisseur?.client_name ?? '',
                                design: row.original.Design_art,
                                goldColor: row.original.Color_Gold,
                                stoneColor: row.original.Color_Rush
                            })}
                            size="small"
                        >
                            <PrintIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            ),
        });
        return baseColumns;
    }, [data]);

    const tableFiltered = useMaterialReactTable({
        columns: columnsFiltredTable,
        data: data,
        initialState: {
            pagination: {
                pageSize: 5,
                pageIndex: 0
            }
        },
        state: { isLoading: loading || isSaving, density: 'compact' },
        enableDensityToggle: true,
    });

    useEffect(() => {
        const handlePopState = () => {
            window.location.reload();
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
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
                        <Box sx={{
                            border: '1px dashed #ccc',
                            p: 2,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center'
                        }}>
                            {stickerDialog.data.map((item, index) => (
                                <Box
                                    key={index}
                                    sx={{
                                        width: '80mm',
                                        height: '50mm',
                                        p: 1,
                                        border: '1px solid #000',
                                        mb: 2,
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}
                                >
                                    <Typography variant="subtitle1" align="center" fontWeight="bold">
                                        {item.brand}
                                    </Typography>
                                    <Divider sx={{ my: 0.5 }} />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="body2">ID: {item.id_fact}</Typography>
                                        <Typography variant="body2">Wt: {item.qty}g</Typography>
                                    </Box>
                                    <Typography variant="body2">Design: {item.design}</Typography>
                                    <Typography variant="body2">Gold: {item.goldColor}</Typography>
                                    <Typography variant="body2">Stone: {item.stoneColor}</Typography>
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
                <DialogTitle id="alert-dialog-title" sx={{ bgcolor: 'error.light', color: 'error.contrastText' }}>
                    Confirm Deletion
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Box
                        sx={{
                            p: 2,
                            borderRadius: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                        }}
                    >
                        <ErrorOutlineIcon color="error" />
                        <DialogContentText
                            id="alert-dialog-description"
                            sx={{ color: 'inherit', m: 0 }}
                        >
                            Are you sure you want to delete this product #{deleteDialog.purchaseNum}?
                            <br />
                            <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 'bold' }}>
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
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Alert
                    onClose={handleCloseSnackbar}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                    elevation={6}
                    variant="filled"
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" fontWeight="bold">
                    {isEditMode ? 'Edit Purchase No:' : 'New Purchase No:'} {num_fact}
                </Typography>

                <Box
                    sx={{
                        backgroundColor: '#1b5e20',
                        color: '#c8e6c9',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 4,
                        fontSize: '0.9rem',
                        display: 'inline-flex',
                        alignItems: 'center'
                    }}
                >
                    <Typography component="span" variant="body2">
                        {
                            editPurchase.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes('gold') &&
                            `Total Full Weight: ${FulltotalWeight.toFixed(2)} | Total Weight: ${totalWeight.toFixed(2)} | `
                        }
                        {!distribution && (
                            <>Number Of Items: {itemCount}</>
                        )}
                    </Typography>
                </Box>
            </Box>



            {productDetails?.[0]?.purchaseW && (
                <Alert
                    severity="info"
                    sx={{
                        mb: 2,
                        borderRadius: 2,
                        borderColor: '#1b5e20',
                        backgroundColor: 'inherit',
                        color: 'inherit',
                        borderWidth: 2,
                        borderStyle: 'solid',
                        fontSize: 15,

                    }}
                >
                    <strong>Watche Details:</strong>

              
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'row',
                            gap: 4,
                            padding: 1,
                            justifyContent: 'center',
                            borderColor: '#1b5e20',
                          
                            margin: '0 auto',
                            overflowX: 'auto',
                            scrollBehavior: 'smooth',
                            width: '100%',
                            maxWidth: '100vw',
                            '& > *:first-of-type': { marginRight: 4 }, // space between details and images
                            '&::-webkit-scrollbar': { display: 'none' }, // Hide scrollbar for Chrome/Safari
                            scrollbarWidth: 'none', // Hide scrollbar for Firefox
                            alignItems: 'center',
                        }}
                    >
                        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'row', gap: 3, padding: 1 }}>
                            {/* Details Table */}
                            <Box sx={{ flex: 2 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Brand:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.supplier?.client_name || productDetails[0].purchaseW.Brand || 'N/A'}</td>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Model:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.model}</td>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Reference Number:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.reference_number}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Serial Number:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.serial_number}</td>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Movement:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.movement}</td>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Caliber:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.caliber}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Gender:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.gender}</td>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Condition:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.condition}</td>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Diamond Total Carat:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.diamond_total_carat}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Diamond Quality:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.diamond_quality}</td>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Diamond Setting:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.diamond_setting}</td>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Number of Diamonds:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.number_of_diamonds}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Custom/Factory:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.custom_or_factory}</td>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Case Material:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.case_material}</td>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Case Size:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.case_size}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Bezel:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.bezel}</td>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Bracelet Type:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.bracelet_type}</td>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Bracelet Material:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.bracelet_material}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Dial Color:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.dial_color}</td>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Dial Style:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.dial_style}</td>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Crystal:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.crystal}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Water Resistance:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.water_resistance}</td>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Functions:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.functions}</td>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Power Reserve:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.power_reserve}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Box & Papers:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.box_papers ? 'Yes' : 'No'}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#1b5e20', fontWeight: 500 }}>Sale Price:</td>
                                            <td style={{ color: '#0d47a1' }}>{productDetails[0].purchaseW.sale_price}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </Box>
                        </Box>



                        <Box sx={{
                            display: 'flex', flexDirection: 'row', justifyItems: 'stretch', gap: 2, alignItems: 'center',
                            padding: 1,
                        }}>
                            {/* Carousel for images */}
                            {images.length > 0 ? (
                                <Box sx={{ flex: 1, height:300,minWidth: 320, maxWidth: 520, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <Typography variant="subtitle1" sx={{ mb: 1 }}>Images</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <IconButton onClick={() => setCarouselIndex(i => (i - 1 + images.length) % images.length)}>
                                            {'<'}
                                        </IconButton>
                                        <img
                                            src={images[carouselIndex]}
                                            alt={`Watch ${carouselIndex + 1}`}
                                            style={{ maxHeight: 500,height:250, maxWidth: 480, borderRadius: 8, border: '1px solid #ccc' }}
                                        />
                                        <IconButton onClick={() => setCarouselIndex(i => (i + 1) % images.length)}>
                                            {'>'}
                                        </IconButton>
                                    </Box>
                                    <Typography variant="caption" sx={{ mt: 1 }}>{carouselIndex + 1} / {images.length}</Typography>
                                </Box>
                            ) : null}
                        </Box>

                        <Box /> {/* Spacer between details and image */}
                    </Box>
                </Alert>
            )}




            <Box sx={{ display: 'grid', gap: 2, mt: 2 }}>
                {/* Hide this section if distribution exists */}
                {!distribution && (
                    <Box display={'inline-flex'} gap={2} justifyContent={'space-between'}>
                        <Autocomplete
                            id="supplier-select"
                            sx={{ width: '50%' }}
                            options={suppliers}
                            autoHighlight
                            getOptionLabel={(option) => option.client_name}
                            value={editPurchase.Fournisseur || null}
                            isOptionEqualToValue={(option, value) => option.id_client === value.id_client}
                            onChange={(event, newValue) => {
                                setEditPurchase(prev => ({
                                    ...prev,
                                    Fournisseur: newValue
                                        ? {
                                            id_client: newValue.id_client,
                                            client_name: newValue.client_name,
                                            TYPE_SUPPLIER: newValue.TYPE_SUPPLIER
                                        }
                                        : undefined
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
                            sx={{ width: '30%' }}
                            label="Reference Purchase"
                            type="text"
                            fullWidth
                            value={editPurchase?.Original_Invoice || ''}
                            onChange={(e) =>
                                setEditPurchase(prev => ({ ...prev, Original_Invoice: e.target.value }))
                            }
                            error={!!errors.Original_Invoice}
                            helperText={errors.Original_Invoice}
                            required
                            disabled={!!distribution}
                        />

                        <TextField
                            label="Date"
                            type="date"
                            sx={{ width: '30%' }}
                            value={editPurchase?.date_fact || new Date().toISOString().split('T')[0]}
                            onChange={(e) => setEditPurchase(prev => ({ ...prev, date_fact: e.target.value }))}
                            error={!!errors.date_fact}
                            helperText={errors.date_fact}
                            required
                        />

                        <TextField
                            label="Comment"
                            type="text"
                            fullWidth
                            value={editPurchase?.COMMENT || ''}
                            onChange={(e) =>
                                setEditPurchase(prev => ({ ...prev, COMMENT: e.target.value }))
                            }
                        />
                    </Box>
                )}

                <Divider sx={{ mb: 0, borderColor: '#616161', borderBottomWidth: 1 }} />

                <Box display={'inline-flex'} gap={2} justifyContent={'space-between'}>
                    {/* Only show these fields if there is NO distribution */}
                    {!distribution && (
                        <>
                            <TextField
                                label="Full Weight"
                                type="number"
                                fullWidth
                                value={editPurchase?.Full_qty || 1}
                                onChange={(e) =>
                                    setEditPurchase(prev => ({ ...prev, Full_qty: 1 }))
                                }
                                error={!!errors.Full_qty}
                                helperText={errors.Full_qty}
                            />

                            <TextField
                                label="Weight"
                                type="number"
                                fullWidth
                                value={editPurchase?.qty || 1}
                                onChange={(e) =>
                                    setEditPurchase(prev => ({ ...prev, qty: 1 }))
                                }
                                error={!!errors.qty}
                                helperText={errors.qty}
                            />


                            <TextField
                                label="Product Refrence"
                                type="text"
                                fullWidth
                                value={editPurchase?.CODE_EXTERNAL || ''}
                                onChange={(e) =>
                                    setEditPurchase(prev => ({ ...prev, CODE_EXTERNAL: e.target.value }))
                                }
                                error={!!errors.CODE_EXTERNAL}
                                helperText={errors.CODE_EXTERNAL}
                            />


                            <TextField
                                label="Sales Code"
                                type="text"
                                fullWidth
                                value={editPurchase?.comment_edit || ''}
                                onChange={(e) =>
                                    setEditPurchase(prev => ({ ...prev, comment_edit: e.target.value }))
                                }
                                error={!!errors.comment_edit}
                                helperText={errors.comment_edit}
                            />


                            <Autocomplete
                                options={Productsdata}
                                fullWidth
                                getOptionLabel={(option) => typeof option === 'string' ? option : option.desig_famille}
                                value={Productsdata.find((p) => p.desig_famille === editPurchase.Design_art) || null}
                                onChange={(event, newValue) => {
                                    setEditPurchase(prev => ({
                                        ...prev,
                                        Design_art: newValue?.desig_famille || ''
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

                            <TextField
                                label="Stone Color"
                                fullWidth
                                value={editPurchase?.Color_Rush || ''}
                                onChange={(e) =>
                                    setEditPurchase(prev => ({ ...prev, Color_Rush: e.target.value }))
                                }
                                error={!!errors.Color_Rush}
                                helperText={errors.Color_Rush}
                            />

                            <TextField
                                label="Gold Color"
                                fullWidth
                                value={editPurchase?.Color_Gold || ''}
                                onChange={(e) =>
                                    setEditPurchase(prev => ({ ...prev, Color_Gold: e.target.value }))
                                }
                                error={!!errors.Color_Gold}
                                helperText={errors.Color_Gold}
                            />
                        </>
                    )}

                    {/* In the form section (add/edit), show Selling Price, Currency, Exchange Rate, and Cost fields if isUsedSupplier is true */}
                    {isUsedSupplier && (
                        <>
                            <TextField
                                label="Selling Price"
                                type="number"
                                fullWidth
                                value={editPurchase?.Selling_Price_Currency || 0}
                                onChange={(e) => setEditPurchase(prev => ({ ...prev, Selling_Price_Currency: parseFloat(e.target.value) }))}
                                error={!!errors.Selling_Price_Currency}
                                helperText={errors.Selling_Price_Currency}
                                required
                            />
                            <FormControl fullWidth>
                                <InputLabel>Currency *</InputLabel>
                                <Select
                                    value={editPurchase?.CURRENCY || ''}
                                    onChange={(e) => setEditPurchase(prev => ({ ...prev, CURRENCY: e.target.value }))}
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
                                onChange={(e) => setEditPurchase(prev => ({ ...prev, RATE: parseFloat(e.target.value) }))}
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
                                onChange={(e) => setEditPurchase(prev => ({ ...prev, Cost_Lyd: parseFloat(e.target.value) }))}
                                error={!!errors.Cost_Lyd}
                                helperText={errors.Cost_Lyd}
                                required
                                inputProps={{ min: 0.01, step: 0.01 }}
                            />
                        </>
                    )}
                </Box>

                <Divider sx={{ mb: 0, borderColor: 'grey.300', borderBottomWidth: 1 }} />

                {/* Hide table if distribution exists */}
                {!distribution && <MaterialReactTable table={tableFiltered} />}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
                {/* Hide Cancel button if distribution exists */}
                {distribution == null && !saveDisabled && (
                    <Button
                        variant="outlined"
                        color="secondary"
                        onClick={handleCancel}
                        disabled={isSaving}
                        startIcon={<CancelOutlined />}
                        sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 'bold', px: 3, py: 1 }}
                    >
                        Cancel
                    </Button>
                )}
                {!saveDisabled && (
                    <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<AddIcon />}
                        sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 'bold', px: 3, py: 1 }}
                        onClick={() => setReceiveDialogOpen(true)}
                        disabled={isSaving || saveDisabled}
                        style={saveDisabled ? { display: 'none' } : {}}
                    >
                        {isSaving
                            ? 'Saving...'
                            : distribution
                                ? 'Receive this item'
                                : isEditMode
                                    ? 'Save Changes'
                                    : 'Save'}
                    </Button>
                )}
            </Box>

            {/* Success/Verified Info Dialog */}
            <Dialog open={saveDisabled} onClose={() => { setSaveDisabled(false); if (onReceived) onReceived(); }} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ textAlign: 'center', pb: 0 }}>Operation Succeeded!</DialogTitle>
                <DialogContent>
                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 2 }}>
                        <svg width="100" height="100" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="12" fill="#4caf50" />
                            <path d="M7 13.5L11 17L17 9.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <Typography variant="h4" color="success.main" fontWeight="bold" sx={{ mt: 2 }}>
                            Operation Succeeded!
                        </Typography>
                        <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                            This item has been received and verified.
                        </Typography>
                        <Button
                            variant="contained"
                            color="primary"
                            size="medium"
                            sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 'bold', px: 4, py: 1.5 }}
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
            <Dialog open={receiveDialogOpen} onClose={() => setReceiveDialogOpen(false)}>
                <DialogTitle>Confirm Receive</DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        Are you ready to receive this item?<br />
                        <strong>If you receive this item, it cannot be deleted again.</strong>
                    </Alert>
                    <DialogContentText>
                        Please confirm if you want to proceed.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setReceiveDialogOpen(false)} color="primary" variant="outlined">
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

export default WNew_p;