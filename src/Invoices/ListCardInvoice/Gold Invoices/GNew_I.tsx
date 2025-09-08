import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import IconButton from '@mui/material/IconButton';
import { useNavigate } from 'react-router-dom';
import {
    Box, Button, Typography, TextField
} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';

import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from '@mui/material';
import { Search } from '@mui/icons-material';
import Snackbar from '@mui/material/Snackbar';
import MuiAlert from '@mui/material/Alert';
import InvoiceTotalsDialog from './InvoiceTotalsDialog';
import PrintInvoiceDialog from './PrintInvoiceDialog'; // Import the PrintInvoiceDialog component


type Invoice = {
    id_fact: number;
    date_fact: string;
    client: number;
    num_fact: number;
    usr: number;
    d_time: string;
    id_art: number;
    prix_vente: number;
    prix_vente_remise: number;
    mode_fact: string
    COMMENT: string;
    IS_OK: boolean;
    rate: number;
    remise: number;
    remise_per: number; // Discount percentage
    is_printed: boolean;
    ps: number;
    phone_client: string;
    total_remise: number;
    qty: number;
    total_remise_final: number;
    total_remise_final_lyd: number;
    currency: string;
    amount_currency: number;
    amount_lyd: number;
    amount_EUR: number;
    amount_currency_LYD: number;
    amount_EUR_LYD: number;
    accept_discount: boolean;
    return_chira: boolean;
    comment_chira: string;
    usr_receive_chira: number;
    id_box1: number;
    id_box2: number;
    id_box3: number;
    IS_GIFT: boolean;
    IS_WHOLE_SALE: boolean;
    USD_Rate: number;
    EURO_Rate: number;
    TOTAL_INV_FROM_DIAMOND: number;
    is_chira: boolean;
    is_request: boolean;
    is_ok_commission_extra: boolean;
    client_redirected: boolean;
    SourceMark: string;
    picint: number;
    Client?: {
        id_client: number;
        client_name: string;
        tel_client: string;
    };
    Utilisateur?: {
        id_user: number;
        name_user: string;
        email: string;
    };
    ACHATs?: ACHATs[];
    ACHAT_pic?: ACHAT_pic[];

};


const initialInvoiceState: Invoice = {
    id_fact: 0,
    date_fact: new Date().toISOString().split('T')[0],
    client: 0,
    num_fact: 0,
    usr: 0,
    d_time: new Date().toISOString(),
    id_art: 0,
    prix_vente: 0,
    prix_vente_remise: 0,
    mode_fact: 'Debitor',
    COMMENT: '',
    IS_OK: false,
    rate: 0,
    remise: 0,
    remise_per: 0,
    is_printed: false,
    ps: 0,
    phone_client: '',
    total_remise: 0,
    qty: 0,
    total_remise_final: 0,
    total_remise_final_lyd: 0,
    currency: '',
    amount_currency: 0,
    amount_lyd: 0,
    amount_EUR: 0,
    amount_currency_LYD: 0,
    amount_EUR_LYD: 0,
    accept_discount: false,
    return_chira: false,
    comment_chira: '',
    usr_receive_chira: 0,
    id_box1: 0,
    id_box2: 0,
    id_box3: 0,
    IS_GIFT: false,
    IS_WHOLE_SALE: false,
    USD_Rate: 0,
    EURO_Rate: 0,
    TOTAL_INV_FROM_DIAMOND: 0,
    is_chira: false,
    is_request: false,
    is_ok_commission_extra: false,
    client_redirected: false,
    SourceMark: '',
    picint: 0,
};



type ACHAT_pic = {
    id_art: number;
    ID_PIC: number;
    PIC1: string;
    PIC2: string;
    PIC3: string;
};

type ACHATs = {
    id_fact: number;
    Design_art: string;
    client: number;
    qty: number;
    TOTAL_INV_FROM_DIAMOND: number;
    Color_Gold: string;
    Color_Rush: string;
    Original_Invoice: string;
    Fournisseur?: {
        id_client: number;
        client_name: string;
        code_fournisseur: string;
        TYPE_SUPPLIER: string;
    };
    DistributionPurchase?: DistributionPurchase[];

};

type InventoryItem = {
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
        Price_G_Gold_Sales: number;
        Price_G_Gold: number;
        Percentage_Diamond: number;
    };
    Original_Invoice: string;
    DistributionPurchase?: DistributionPurchase[];

};




type DistributionPurchase = {
    distributionID: number;
    ps?: number;
    Weight?: number;
    distributionDate?: string;
    usr?: number;
    PurchaseID?: number;
    CreationDate?: string;
    PurchaseType?: string;
    distributionISOK?: boolean;



    OriginalAchatDiamond?: {
        id_achat: number;
        carat?: number;
        cut?: string;
        color?: string;
        clarity?: string;
        shape?: string;
        measurements?: string;
        depth_percent?: number;
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
        Usr?: number;
        CODE_EXTERNAL?: string;
        comment_edit?: string;
        sharepoint_url?: string;
        MakingCharge?: number;
        ShippingCharge?: number;
        TravelExpesenes?: number;
        Rate?: number;
        Total_Price_LYD?: number;
        sale_price?: number;
        Design_art?: string;
    };
    OriginalAchatWatch?: {
        id_achat: number;
        Brand: number;
        model: string;
        reference_number?: string;
        serial_number?: string;
        movement?: string;
        caliber?: string;
        gender?: string;
        condition?: string;
        diamond_total_carat?: number;
        diamond_quality?: string;
        diamond_setting?: string;
        number_of_diamonds?: number;
        custom_or_factory?: string;
        case_material?: string;
        case_size?: string;
        bezel?: string;
        bracelet_type?: string;
        bracelet_material?: string;
        dial_color?: string;
        dial_style?: string;
        crystal?: string;
        water_resistance?: string;
        functions?: string;
        power_reserve?: string;
        box_papers?: boolean;
        warranty?: string;
        retail_price?: number;

        image_url?: string;
        certificate_url?: string;
        Comment_Achat?: string;
        DocumentNo?: string;
        IsApprouved?: string;
        Approval_Date?: Date;
        ApprouvedBy?: string;
        Comment?: string;
        attachmentUrl?: string;
        Date_Achat?: string;
        Usr?: number;
        sharepoint_url?: string;
        MakingCharge?: number;
        ShippingCharge?: number;
        TravelExpesenes?: number;
        Rate?: number;
        Total_Price_LYD?: number;
        sale_price?: number;
        common_local_brand?: string;
    };
};

type Client = {
    id_client: number;
    client_name: string;
    tel_client: string;
};
type Sm = {
    id_SourceMark: number;
    SourceMarketing: string;
    Status: boolean;
};

const API_BASEImage = 'http://localhost:9000/images';

// Helper to fetch image as blob with auth
const fetchImageWithAuth = async (url: string, token: string) => {
    try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return null;
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    } catch {
        return null;
    }
};



// Default type, can be changed based on your requirements;
const DNew_I = () => {

    const [images, setImages] = useState<Record<number, string[]>>({});
    const [imageUrls, setImageUrls] = useState<Record<string, string[]>>({});

    const fetchImages = async (id_achat: number) => {

        const token = localStorage.getItem('token');
        if (!token || !id_achat) return;
        try {




            const res = await axios.get(`${API_BASEImage}/list/${id_achat}`, {
                headers: { Authorization: `Bearer ${token}` },
            }).then(
                async (res) => {

                    let urls: string[] = [];
                    if (Array.isArray(res.data) && res.data.length > 0 && typeof res.data[0] === 'object') {
                        urls = res.data.map((img: any) => img.url || img);
                    } else {
                        urls = res.data;
                    }
                    setImageUrls(prev => ({ ...prev, [id_achat]: urls })); // Store original URLs
                    // Fetch all images as blobs with auth
                    const blobUrls = await Promise.all(urls.map(url => fetchImageWithAuth(url, token)));
                    setImages(prev => ({ ...prev, [id_achat]: blobUrls.filter((url): url is string => Boolean(url)) }));


                }


            );




        } catch (err) {
            // console.error('Error fetching images:', err);
            //  setImages(prev => ({ ...prev, [id_achat]: [] }));
            //  setImageUrls(prev => ({ ...prev, [id_achat]: [] }));
        }
    };


    // const   Type  = 'gold';
    // Replace useLocation state with localStorage
    // Get ps and Cuser from localStorage 'user' object if available, else fallback to individual keys
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
    const [data, setData] = useState<InventoryItem[]>([]);


    const [Sm, setSm] = useState<Sm[]>([]);

    const [customers, setCustomers] = useState<Client[]>([]);

    const apiIp = process.env.REACT_APP_API_IP;
    const apiUrlcustomers = `http://localhost:9000/customers`;

    const fetchCustomers = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get<Client[]>(`${apiUrlcustomers}/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCustomers(res.data);
        } catch (error) {


        }
    };



    const fetchSms = async () => {
        const apiUrlsm = "http://localhost:9000/sm";
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get<Sm[]>(`${apiUrlsm}/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSm(res.data);
        } catch (error) {


        }
    };





    const [datainv, setDatainv] = useState<Invoice[]>([]);

    const [emptyCartConfirmOpen, setEmptyCartConfirmOpen] = useState(false);
    const [emptyCartLoading, setEmptyCartLoading] = useState(false);

    const [carouselIndex, setCarouselIndex] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();


    // Move typeFilter state above fetchData and useEffect
    const [typeFilter, setTypeFilter] = useState<string>('');

    const fetchData = useCallback(async (typeParam = typeFilter) => {

        if (!typeParam) {
            typeParam = 'Watch';
        }
        if (typeof typeFilter === 'undefined' || typeFilter === null) return;
        setLoading(true);

        const token = localStorage.getItem('token');
        if (!token) return navigate("/");

        try {
            const response = await axios.get<InventoryItem[]>("http://localhost:9000/Inventory/allActive", {
                headers: { Authorization: `Bearer ${token}` },
                params: { ps, type_supplier: typeParam }
            });
            setData(response.data);



        } catch (error: any) {
            if (error.response?.status === 401) navigate("/");

        } finally {
            setLoading(false);
        }
    }, [navigate, ps, typeFilter]);

    useEffect(() => {
        fetchData();
        fetchDataINV();
        fetchCustomers();
        fetchSms();

    }, [fetchData]);





    // Add state for image dialog and selected image
    const [imageDialogOpen, setImageDialogOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    // New state for dialog image navigation
    const [dialogImageList, setDialogImageList] = useState<string[]>([]);
    const [dialogImageIndex, setDialogImageIndex] = useState(0);

    const handleViewImage = (row: InventoryItem) => {
        // Find the image key for this row (id_achat or id_fact)
        let imageKey: string | number | undefined = undefined;
        let watch: any = undefined;
        let dp: any = row.DistributionPurchase;
        if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === 'object') {
            watch = dp[0]?.OriginalAchatWatch;
            imageKey = watch?.id_achat;
        } else if (dp && typeof dp === 'object') {
            watch = dp?.OriginalAchatWatch;
            imageKey = watch?.id_achat;
        }
        if (!imageKey) imageKey = row.id_fact;
        const imageKeyStr = String(imageKey);
        const urls = imageUrls[imageKeyStr] || [];
        if (urls.length > 0) {
            setSelectedImage(urls[0]);
            setImageDialogOpen(true);
            setDialogImageList(urls); // New: store all images for dialog navigation
            setDialogImageIndex(0);
        } else {
            setSelectedImage(null);
            setImageDialogOpen(true);
            setDialogImageList([]);
            setDialogImageIndex(0);
        }
    };

    // Pagination state
    const [page, setPage] = useState(0);
    const rowsPerPage = 6;

    // Add search state
    const [search, setSearch] = useState('');

    // Filtered data based on search
    const filteredData = data.filter(row => {
        const searchLower = search.trim().toLowerCase();
        let referenceNumbers: string[] = [];
        let serial_number: string[] = [];

        let CODE_EXTERNAL: string[] = [];
        const dp = row.DistributionPurchase;
        if (Array.isArray(dp)) {
            dp.forEach(item => {
                if (item?.OriginalAchatWatch) {
                    if (item.OriginalAchatWatch.reference_number) {
                        referenceNumbers.push(item.OriginalAchatWatch.reference_number.toString().toLowerCase());
                    }
                    if (item.OriginalAchatWatch.DocumentNo) {
                        serial_number.push(item.OriginalAchatWatch.DocumentNo.toString().toLowerCase());
                    }
                }
                if (item?.OriginalAchatDiamond) {
                    if (item.OriginalAchatDiamond.DocumentNo) {
                        serial_number.push(item.OriginalAchatDiamond.DocumentNo.toString().toLowerCase());
                    }
                }
            });
        } else if (dp && typeof dp === 'object') {
            // Type guard: ensure dp is not null and not an array
            const dpObj = dp as Partial<DistributionPurchase>;
            if (dpObj.OriginalAchatWatch) {
                if (dpObj.OriginalAchatWatch.reference_number) {
                    referenceNumbers.push(dpObj.OriginalAchatWatch.reference_number.toString().toLowerCase());
                }
                if (dpObj.OriginalAchatWatch.serial_number) {
                    serial_number.push(dpObj.OriginalAchatWatch.serial_number.toString().toLowerCase());
                }
            }
            if (dpObj.OriginalAchatDiamond) {
                if (dpObj.OriginalAchatDiamond.CODE_EXTERNAL) {
                    CODE_EXTERNAL.push(dpObj.OriginalAchatDiamond.CODE_EXTERNAL.toString().toLowerCase());
                }
            }
        }
        return (
            searchLower === '' ||
            (row.Design_art?.toLowerCase().includes(searchLower)) ||
            (row.Fournisseur?.client_name?.toLowerCase().includes(searchLower)) ||
            (row.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes(searchLower)) ||
            (row.id_fact?.toString().includes(searchLower)) ||
            referenceNumbers.some(ref => ref.includes(searchLower)) ||
            serial_number.some(doc => doc.includes(searchLower))
        ) &&
            (typeFilter === '' || (row.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes(typeFilter)));
    });

    const paginatedData = filteredData.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
    // Fetch images for current page and datainv (cart)
    useEffect(() => {
        // Track which ids have been requested in this render
        const requested = new Set<string>();
        paginatedData.forEach(row => {
            let watch: any = undefined;
            let dp: any = row.DistributionPurchase;
            if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === 'object') {
                watch = dp[0]?.OriginalAchatWatch;
            } else if (dp && typeof dp === 'object') {
                watch = dp?.OriginalAchatWatch;
            }
            const id_achat = watch && watch.id_achat ? watch.id_achat : null;
            const idStr = String(id_achat);
            if (id_achat && imageUrls[idStr] === undefined && !requested.has(idStr)) {
                fetchImages(id_achat);
                requested.add(idStr);
            }
        });
        datainv.forEach(inv => {
            const idStr = String(inv.picint);
            if (inv.picint && imageUrls[idStr] === undefined && !requested.has(idStr)) {
                fetchImages(inv.picint);
                requested.add(idStr);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paginatedData, datainv, imageUrls]);



    const apiUrlinv = `http://${apiIp}/invoices`;

    const fetchDataINV = async () => {


        const token = localStorage.getItem('token');
        if (!token) return navigate("/");
        try {
            const res = await axios.get<Invoice[]>(`${apiUrlinv}/Getinvoice`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { ps: ps, num_fact: 0, usr: Cuser }
            });
            setDatainv(res.data);

            setEditInvoice(prevState => ({
                ...prevState,
                client: res.data[0]?.client ?? prevState.client,
                Client: res.data[0]?.Client ?? prevState.Client,
                SourceMark: res.data[0]?.SourceMark ?? prevState.SourceMark
            }));






        } catch (err: any) {
            if (err.response?.status === 401) navigate("/");
            //showNotification('Failed to fetch invoice data', 'error');
        } finally {
            setLoading(false);
        }
    };





    const [editInvoice, setEditInvoice] = useState<Invoice>(initialInvoiceState);
    const handleSave = async (item?: InventoryItem) => {
        if (!item) return;
        setAddToCartLoading((prev: { [id: number]: boolean }) => ({ ...prev, [item.id_fact]: true }));
        const token = localStorage.getItem('token');
        try {
            // Use item if provided, else use editInvoice
            let prix_vente = 0;
            if (item) {
                const type = item.Fournisseur?.TYPE_SUPPLIER?.toLowerCase() || '';
                if (type.includes('diamond')) {
                    let diamond: any = undefined;
                    let dp: any = item.DistributionPurchase;
                    if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === 'object') {
                        diamond = dp[0]?.OriginalAchatDiamond;
                    } else if (dp && typeof dp === 'object') {
                        diamond = dp?.OriginalAchatDiamond;
                    }
                    prix_vente = diamond && typeof diamond.sale_price === 'number' ? diamond.sale_price : 0;

                    editInvoice.picint = diamond.id_achat;

                } else if (type.includes('watch')) {
                    let watch: any = undefined;
                    let dp: any = item.DistributionPurchase;
                    if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === 'object') {
                        watch = dp[0]?.OriginalAchatWatch;
                    } else if (dp && typeof dp === 'object') {
                        watch = dp?.OriginalAchatWatch;
                    }
                    prix_vente = watch && typeof watch.sale_price === 'number' ? watch.sale_price : 0;

                    editInvoice.picint = watch.id_achat;
                } else if (type.includes('gold')) {





                    prix_vente = ((goldPrice / 31.10350) + ((goldPrice / 31.10350) * ((item.Fournisseur?.Price_G_Gold_Sales || 0) / 100))) * (usdToLyd + 2) * item.qty;
                    editInvoice.picint = item.id_fact;

                } else {
                    prix_vente = item.Selling_Price_Currency || 0;
                }


            }



            const invoiceData = item ? {
                ...editInvoice,
                id_art: item?.id_fact,
                qty: item.qty,
                prix_vente,
                prix_vente_remise: prix_vente,
                total_remise: prix_vente,
                client: 0,
                Design_art: item.Design_art,
                usr: Cuser,
                ps: ps
                // Add more fields as needed
            } : editInvoice;
            await axios.post(`${apiUrlinv}/Add`, invoiceData, {
                headers: { Authorization: `Bearer ${token}` },
            }).catch((error) => {
                console.error('Error saving invoice:', error);
            });
            //showNotification('Invoice added successfully', 'success');

            fetchDataINV();
            fetchData();
        } catch (error: any) {
            // Use alert as fallback for error notification
            alert(error.response?.data?.message || 'Save failed');
        } finally {
            setAddToCartLoading((prev: { [id: number]: boolean }) => ({ ...prev, [item.id_fact]: false }));
        }



    };






    const [goldPrice, setGoldPrice] = useState<number | 0>(0);
    const [usdToLyd, setUsdToLyd] = useState<number | 0>(0);

    useEffect(() => {
        // Fetch gold price from a free API (e.g., metals-api.com or goldapi.io)
        // Example using goldapi.io (replace with your API key if needed)
        const fetchGoldPrice = async () => {
            try {
                const res = await axios.get('https://api.metalpriceapi.com/v1/latest', {
                    params: {
                        apikey: 'e3306dd8cb67cc2cdfcd14207ccbf305',
                        base: 'USD',
                        symbols: 'XAU'
                    }
                });
                setGoldPrice(res.data.rates.XAU);

            } catch (err: any) {
                //setGoldError('Failed to fetch gold price');
                setGoldPrice(0);
            }
        };
        fetchGoldPrice();

        // Fetch USD to LYD exchange rate from alternative free API (open.er-api.com)
        const fetchUsdToLyd = async () => {
            try {
                const res = await axios.get('https://open.er-api.com/v6/latest/USD');
                // The rates object contains LYD if available
                if (res.data && res.data.rates && res.data.rates.LYD) {
                    setUsdToLyd(res.data.rates.LYD);
                } else {
                    //setUsdToLydError('USD/LYD rate not found');
                    setUsdToLyd(0);
                }
            } catch (err: any) {
                //setUsdToLydError('Failed to fetch USD/LYD rate');
                setUsdToLyd(0);
            }
        };
        fetchUsdToLyd();











    }, []);






    // 1. Fix useEffect infinite loop issues (example pattern):
    // Find all useEffect hooks and ensure correct dependency arrays.
    // Example fix:
    // useEffect(() => { ... }, []); // Only run once on mount
    // useEffect(() => { ... }, [someVar]); // Only run when someVar changes
    // 2. (If you have a useEffect without dependencies, add []):
    // Example:
    // useEffect(() => {
    //   fetchData();
    // }, []); // <-- add [] if missing
    // 3. (If you have a useEffect with a dependency that changes every render, memoize it or remove it from dependencies if safe)
    // 4. (If you want me to scan and fix all useEffect hooks, please confirm or provide the relevant code section)

    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

    const [addToCartLoading, setAddToCartLoading] = useState<{ [id: number]: boolean }>({});
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [totalsDialog, setTotalsDialog] = useState({
        open: false,
        total_remise_final: 0,
        amount_currency: 0,
        amount_lyd: 0,
        amount_EUR: 0,
        amount_currency_LYD: 0,
        total_remise_final_lyd: 0,
        amount_EUR_LYD: 0,
        remise: 0,
        remise_per: 0
    });
    const [isSaving, setIsSaving] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

    const [printDialog, setPrintDialog] = useState({
        open: false,
        invoice: null as Invoice | null,
    });

    const printRef = useRef<HTMLDivElement>(null);

    // Add a stub for handleEditCartItem to avoid errors
    // Handler for edit button
    const handleEditCartItem2 = (item: Invoice) => {


        setEditDialogItem(item);
        setEditDialogRemise(item.total_remise ?? 0);
        setEditDialogIS_Gift(item.IS_GIFT ?? false);
        setEditDialogOpen(true);

    };

    const handleOpenTotalsDialog = () => {
        // Calculate totals from datainv
        const goldItems = datainv.filter(i => i.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes('gold'));
        const diamondItems = datainv.filter(i => i.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes('diamond'));
        const watchItems = datainv.filter(i => i.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes('watch'));

        // Calculate totals for each type
        let goldTotal = 0, diamondTotal = 0, watchTotal = 0;
        let remise, remise_per, amount_currency = 0, amount_lyd = 0, amount_EUR = 0, amount_currency_LYD = 0, amount_EUR_LYD = 0;

        if (goldItems.length > 0) {
            const goldWithRemise = goldItems.filter(i => typeof i.total_remise_final === 'number' && i.total_remise_final > 0);
            goldTotal = goldWithRemise.length > 0
                ? Math.max(...goldWithRemise.map(i => i.total_remise_final ?? 0))
                : goldItems.reduce((sum, i) => sum + (typeof i.prix_vente === 'number' ? i.prix_vente : 0), 0);
        }
        if (diamondItems.length > 0) {
            const diamondWithRemise = diamondItems.filter(i => typeof i.total_remise_final === 'number' && i.total_remise_final > 0);
            diamondTotal = diamondWithRemise.length > 0
                ? Math.max(...diamondWithRemise.map(i => i.total_remise_final ?? 0))
                : diamondItems.reduce((sum, i) => sum + (typeof i.prix_vente === 'number' ? i.prix_vente : 0), 0);
        }
        if (watchItems.length > 0) {
            const watchWithRemise = watchItems.filter(i => typeof i.total_remise_final === 'number' && i.total_remise_final > 0);
            watchTotal = watchWithRemise.length > 0
                ? Math.max(...watchWithRemise.map(i => i.total_remise_final ?? 0))
                : watchItems.reduce((sum, i) => sum + (typeof i.total_remise === 'number' ? i.total_remise : 0), 0);
        }


        const total_remise_final_lyd = datainv.reduce((sum, i) => (typeof i.total_remise_final_lyd === 'number' ? i.total_remise_final_lyd : 0), 0);


        // Sum up all relevant fields for dialog
        amount_currency = datainv.reduce((sum, i) => (typeof i.amount_currency === 'number' ? i.amount_currency : 0), 0);
        amount_lyd = datainv.reduce((sum, i) => (typeof i.amount_lyd === 'number' ? i.amount_lyd : 0), 0);
        amount_EUR = datainv.reduce((sum, i) => (typeof i.amount_EUR === 'number' ? i.amount_EUR : 0), 0);
        amount_currency_LYD = datainv.reduce((sum, i) => (typeof i.amount_currency_LYD === 'number' ? i.amount_currency_LYD : 0), 0);
        amount_EUR_LYD = datainv.reduce((sum, i) => (typeof i.amount_EUR_LYD === 'number' ? i.amount_EUR_LYD : 0), 0);
        remise = datainv.reduce((sum, i) => (typeof i.remise === 'number' ? i.remise : 0), 0);

        remise_per = datainv.reduce((sum, i) => (typeof i.remise_per === 'number' ? i.remise_per : 0), 0);

        setTotalsDialog({
            open: true,
            total_remise_final: goldTotal + diamondTotal + watchTotal,
            total_remise_final_lyd: total_remise_final_lyd,
            amount_currency,
            amount_lyd,
            amount_EUR,
            amount_currency_LYD,
            amount_EUR_LYD,
            remise,
            remise_per
        });
    };

    const handleTotalsDialogChange = (field: string, value: number) => {
        setTotalsDialog(prev => ({ ...prev, [field]: value }));
    };

    const handleTotalsDialogClose = () => {
        setTotalsDialog(prev => ({ ...prev, open: false }));
    };




    const handleAddNew = async () => {
        const token = localStorage.getItem('token');


        if (!datainv[0].Client) {
            setSnackbar({ open: true, message: 'Please select a client before creating a new invoice', severity: 'error' });
            return;
        }
        if (!datainv[0].total_remise_final || datainv[0].total_remise_final === 0) {
            setSnackbar({ open: true, message: 'Please add Totals to the invoice before creating a new invoice', severity: 'error' });
            return;
        }



        try {


            const response = await fetch(`${apiUrlinv}/NewNF?ps=${ps}&usr=${Cuser}`, {

                //  const response = await fetch(`${apiUrl}/NewNF`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) throw new Error("Failed to fetch new invoice number");

            const result = await response.json();
            let newNumFact = result.new_num_fact;

            // Update num_fact for all items in datainv to newNumFact
            setDatainv(prev =>
                prev.map(item => ({
                    ...item,
                    num_fact: 0
                }))
            );


            const latestInvoice = datainv[datainv.length - 1];

            if (latestInvoice) {
                latestInvoice.num_fact = 0;
            }

            setPrintDialog({
                open: true,
                invoice: latestInvoice || null
            });

            setEditInvoice(initialInvoiceState);


        } catch (error) {
            console.error("Error creating new invoice:", error);
        }
    };



    const [shouldOpenPrintDialog, setShouldOpenPrintDialog] = useState(false); // Add flag state

    const handleTotalsDialogUpdate = async () => {
        // First, get a new invoice number




        try {






            setIsSaving(true);
            try {
                const token = localStorage.getItem('token');



                // Determine invoice destination flags


                await axios.put(
                    `http://${apiIp}/invoices/UpdateTotals/0`,
                    {
                        total_remise_final: totalsDialog.total_remise_final,
                        total_remise_final_lyd: totalsDialog.total_remise_final_lyd,
                        amount_currency: totalsDialog.amount_currency,
                        amount_lyd: totalsDialog.amount_lyd,
                        amount_EUR: totalsDialog.amount_EUR,
                        amount_currency_LYD: totalsDialog.amount_currency_LYD,
                        amount_EUR_LYD: totalsDialog.amount_EUR_LYD,
                        remise: totalsDialog.remise,
                        remise_per: totalsDialog.remise_per,
                        num_fact: 0,
                        usr: Cuser,
                        ps: ps,
                        customer: editInvoice.client,
                        sm: editInvoice.SourceMark,
                        is_chira: editInvoice.is_chira,
                        IS_WHOLE_SALE: editInvoice.IS_WHOLE_SALE,


                    },
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                )
                //   setSnackbar({ open: true, message: 'Invoice totals updated successfully', severity: 'success' });
                setTotalsDialog(prev => ({ ...prev, open: false }));
                await fetchDataINV();

            } catch (error) {
                console.error('Error updating invoice totals:', error);
                setSnackbar({ open: true, message: 'Failed to update invoice totals', severity: 'error' });
            } finally {
                setIsSaving(false);
            }



            // setShouldOpenPrintDialog(true); // Set flag to open print dialog after data is up-to-date and dialog is closed



        } catch (error) {
            console.error('Error updating invoice totals:', error);
        }







    };





    useEffect(() => {
        if (shouldOpenPrintDialog) {



            // Find the latest invoice (assuming it's the last one in datainv)
            const latestInvoice = datainv.find(
                inv => inv.num_fact === 0 && inv.ps === Number(ps) && inv.usr === Number(Cuser)
            );
            setPrintDialog({
                open: true,
                invoice: latestInvoice || null
            });
            setShouldOpenPrintDialog(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shouldOpenPrintDialog, totalsDialog.open, datainv]);



    // Add state for edit dialog
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editDialogItem, setEditDialogItem] = useState<Invoice | null>(null);
    const [editDialogRemise, setEditDialogRemise] = useState<number>(0);

    const [editDialogIS_Gift, setEditDialogIS_Gift] = useState<boolean>(false);
    // Handler for saving the edited remise
    const handleEditDialogSave = async () => {
        if (!editDialogItem) return;
        try {
            const token = localStorage.getItem('token');
            // Await the API call before updating local state
            await axios.put(
                `http://${apiIp}/invoices/UpdateTotal/${editDialogItem.id_fact}`,
                {
                    total_remise: editDialogRemise,
                    prix_vente_remise: editDialogRemise,
                    IS_GIFT: editDialogItem.IS_GIFT, // <-- Add this line
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            // Update local state after successful API call
            setDatainv(prev => {
                const updated = prev.map(inv =>
                    inv.id_art === editDialogItem.id_art ? { ...inv, total_remise: editDialogRemise } : inv
                );
                // Recalculate totals after update
                const Total = updated.reduce((sum, i) => (typeof i.total_remise_final === 'number' ? i.total_remise_final : 0), 0);
                const Totallyd = updated.reduce((sum, i) => (typeof i.total_remise_final === 'number' ? i.total_remise_final : 0), 0);

                const amount_EUR = updated.reduce((sum, i) => (typeof i.amount_EUR === 'number' ? i.amount_EUR : 0), 0);
                const amount_currency_LYD = updated.reduce((sum, i) => (typeof i.amount_currency_LYD === 'number' ? i.amount_currency_LYD : 0), 0);
                const amount_EUR_LYD = updated.reduce((sum, i) => (typeof i.amount_EUR_LYD === 'number' ? i.amount_EUR_LYD : 0), 0);
                const amount_currency = updated.reduce((sum, i) => (typeof i.amount_currency === 'number' ? i.amount_currency : 0), 0);
                const amount_lyd = updated.reduce((sum, i) => (typeof i.amount_lyd === 'number' ? i.amount_lyd : 0), 0);
                setTotalsDialog(prev => ({
                    ...prev,
                    total_remise_final: Total,
                    total_remise_final_lyd: Totallyd,
                    amount_currency,
                    amount_lyd,
                    amount_EUR,
                    amount_currency_LYD,
                    amount_EUR_LYD
                }));
                return updated;
            });
            setSnackbar({ open: true, message: 'Discount updated successfully', severity: 'success' });
        } catch (error) {
            setSnackbar({ open: true, message: 'Failed to update disscount', severity: 'error' });

        } finally {
            setEditDialogOpen(false);
        }
    };



    const [hiddenIds, setHiddenIds] = useState<number[]>([]); // Track hidden items

    // Calculate final total after discount for each currency type
    function getFinalTotal(items: any[], currencyType: string) {
        const filtered = items.filter((i: any) => {
            const achat = i.ACHATs?.[0];
            return achat?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes(currencyType);
        });
        let total = 0;
        let remise = 0;
        let remise_per = 0;
        if (filtered.length > 0) {
            // Use the latest (max) total_remise_final, remise, remise_per for this type
            const withRemise = filtered.filter((i: any) => typeof i.total_remise_final === 'number' && i.total_remise_final > 0);
            if (withRemise.length > 0) {
                const latest = withRemise.reduce((a: any, b: any) => (a.id_fact > b.id_fact ? a : b));
                total = latest.total_remise_final || 0;
                remise = latest.remise || 0;
                remise_per = latest.remise_per || 0;
            } else {
                total = filtered.reduce((sum: number, i: any) => sum + (typeof i.prix_vente_remise === 'number' ? i.prix_vente_remise : 0), 0);
            }
        }
        // Apply discount
        let finalTotal = total;
        if (remise > 0) {
            finalTotal = total - remise;
        } else if (remise_per > 0) {
            finalTotal = total - total * (remise_per / 100);
        }
        return finalTotal;
    }



    return (
        <Box >
            {/* Image Dialog */}
            <Dialog
                open={imageDialogOpen}
                onClose={() => setImageDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Product Image</DialogTitle>
                <DialogContent>
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            minHeight: '400px'
                        }}
                    >
                        {dialogImageList.length > 0 ? (
                            <>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Button
                                        onClick={() => setDialogImageIndex(idx => (idx - 1 + dialogImageList.length) % dialogImageList.length)}
                                        disabled={dialogImageList.length <= 1}
                                    >
                                        {'<'}
                                    </Button>
                                    <img
                                        src={(() => {
                                            let url = dialogImageList[dialogImageIndex];
                                            if (!url) return '';
                                            const token = localStorage.getItem('token');
                                            if (token && !url.includes('token=')) {
                                                url += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
                                            }
                                            return url;
                                        })()}
                                        alt={`Product ${dialogImageIndex + 1}`}
                                        style={{
                                            maxWidth: '80%',
                                            maxHeight: '80vh',
                                            objectFit: 'contain',
                                            borderRadius: 8,
                                            border: '1px solid #ccc',
                                            background: '#f9f9f9',
                                        }}
                                    />
                                    <Button
                                        onClick={() => setDialogImageIndex(idx => (idx + 1) % dialogImageList.length)}
                                        disabled={dialogImageList.length <= 1}
                                    >
                                        {'>'}
                                    </Button>
                                </Box>
                                <Typography variant="caption" sx={{ mt: 1 }}>{dialogImageIndex + 1} / {dialogImageList.length}</Typography>
                            </>
                        ) : (
                            <Typography>No image available</Typography>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setImageDialogOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Cards Grid */}

            <Box sx={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
                <Box sx={{ width: '15%', minWidth: 200, mr: 2 }}>
                    {/* Left Sidebar Filter */}
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Filter by Type</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, mb: 1 }}>

                            <Button
                                variant={typeFilter === 'gold' ? 'contained' : 'outlined'}
                                size="small"
                                color="inherit"
                                onClick={() => {
                                    setTypeFilter('gold');
                                    fetchData('gold');
                                }}
                                sx={{ textTransform: 'none', borderRadius: 2, display: 'flex', alignItems: 'center', flex: 1 }}
                                startIcon={<span role="img" aria-label="Gold">🥇</span>}
                            >
                                Gold
                            </Button>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, mb: 2 }}>
                            <Button
                                variant={typeFilter === 'diamond' ? 'contained' : 'outlined'}
                                color="inherit"
                                size="small"
                                onClick={() => {
                                    setTypeFilter('diamond');
                                    fetchData('diamond');
                                }}
                                sx={{ textTransform: 'none', borderRadius: 2, display: 'flex', alignItems: 'center', flex: 1 }}
                                startIcon={<span role="img" aria-label="Diamond">💎</span>}
                            >
                                Diamond
                            </Button>
                            <Button
                                variant={typeFilter === 'watch' ? 'contained' : 'outlined'}
                                color="inherit"
                                size="small"
                                onClick={() => {
                                    setTypeFilter('watch');
                                    fetchData('watch');
                                }}
                                sx={{ textTransform: 'none', borderRadius: 2, display: 'flex', alignItems: 'center', flex: 1 }}
                                startIcon={<span role="img" aria-label="Watch">⌚</span>}
                            >
                                Watch
                            </Button>
                        </Box>
                    </Box>
                </Box>
                <Box sx={{ flex: 1, mr: 2 }}>
                    {/* Search Field */}
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <TextField
                            variant="outlined"
                            size="small"
                            placeholder="Search by designation, brand, type, or ID..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(0); }}
                            InputProps={{
                                startAdornment: <Search color="action" sx={{ mr: 1 }} />,
                                style: {
                                    background: 'transparent',
                                    fontSize: 16,
                                    borderRadius: 20,
                                },
                            }}
                            sx={{ width: '100%', bgcolor: 'inherit', borderRadius: 2 }}
                        />
                    </Box>
                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: '1fr',   }}>
                        {loading ? (
                            <Box sx={{ gridColumn: '1/-1', textAlign: 'center', py: 6 }}>
                                <Typography variant="h6" color="text.secondary" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                    <CircularProgress color="inherit" size={36} thickness={4} sx={{ mb: 2 }} />
                                    Loading...
                                </Typography>
                            </Box>
                        ) : (
                            paginatedData.filter(row => !hiddenIds.includes(row.id_fact)).map((row) => (
                                <Box
                                    key={row.id_fact}
                                    sx={{
                                        borderRadius: 2,
                                        pr: 2,
                                        display: 'flex',
                                        flexDirection: 'row',
                                        minHeight: 200,
                                        border: '1px solid #e0e0e0',
                                        alignItems: 'center',
                                        justifyContent: 'flex-start',
                                        gap: 1,
                                    }}
                                >

                                    <Box
                                        sx={{
                                            width: 300,
                                            height: 220,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: 2,
                                            overflow: 'hidden',
                                            position: 'relative',
                                            mr: 1,
                                        }}
                                    >
                                        {(() => {



                                            // Robustly determine imageKey for this row
                                            let imageKey: string | number | undefined = undefined;
                                            let watch: any = undefined;
                                            let dp: any = row.DistributionPurchase;
                                            if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === 'object') {
                                                watch = dp[0]?.OriginalAchatWatch;
                                                imageKey = watch?.id_achat;
                                            } else if (dp && typeof dp === 'object') {
                                                watch = dp?.OriginalAchatWatch;
                                                imageKey = watch?.id_achat;
                                            }
                                            // Fallback to row.id_fact if imageKey is falsy
                                            if (!imageKey) imageKey = row.id_fact;
                                            const imageKeyStr = String(imageKey); // Always use string keys
                                            // Defensive: ensure imageUrls[imageKeyStr] exists and is an array
                                            const urls = imageUrls[imageKeyStr] || [];
                                            // Defensive: ensure carouselIndex[imageKeyStr] is valid
                                            const idx = carouselIndex[imageKeyStr] ?? 0;
                                            // Defensive: append token to every image URL if not present
                                            const token = localStorage.getItem('token');

                                            return urls.length > 0 ? (
                                                <>
                                                    <Box sx={{ flex: 1, height: 200, minWidth: 120, maxWidth: 200, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <IconButton size="small" onClick={() => setCarouselIndex(prevIdx => ({ ...prevIdx, [imageKeyStr]: (((prevIdx[imageKeyStr] ?? 0) - 1 + urls.length) % urls.length) }))}>
                                                                {'<'}
                                                            </IconButton>
                                                            <Box
                                                                component="img"
                                                                src={(() => {
                                                                    let url = urls[idx];
                                                                    if (!url) return '';
                                                                    if (token && !url.includes('token=')) {
                                                                        url += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
                                                                    }
                                                                    return url;
                                                                })()}
                                                                alt={`Image ${idx + 1}`}
                                                                loading="lazy"
                                                                sx={{
                                                                    maxHeight: 180,
                                                                    height: 180,
                                                                    maxWidth: 180,
                                                                    borderRadius: 8,
                                                                    border: '1px solid #ccc',
                                                                    cursor: 'pointer',
                                                                    width: '100%',
                                                                    objectFit: 'contain',
                                                                    flex: 1,
                                                                    display: 'block',
                                                                    background: 'inherit',
                                                                    imageRendering: 'auto',
                                                                    transition: 'transform 0.3s',
                                                                    '&:hover': {
                                                                        transform: 'scale(1.04)',
                                                                    },
                                                                }}
                                                                onClick={() => handleViewImage(row)}
                                                                onError={e => {
                                                                    e.currentTarget.onerror = null;
                                                                    e.currentTarget.src = '/default-image.png'; // Use a default image in your public folder
                                                                }}
                                                                title={urls[idx] || 'No image URL'}
                                                            />
                                                            <IconButton size="small" onClick={() => setCarouselIndex(prevIdx => ({ ...prevIdx, [imageKeyStr]: (((prevIdx[imageKeyStr] ?? 0) + 1) % urls.length) }))}>
                                                                {'>'}
                                                            </IconButton>
                                                        </Box>
                                                        <Typography variant="caption" sx={{ mt: 1 }}>{idx + 1} / {urls.length}</Typography>

                                                    </Box>
                                                </>
                                            ) : (
                                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180 }}>
                                                    <Box
                                                        component="img"
                                                        src="/default-image.png"
                                                        alt="No Image"
                                                        sx={{ maxHeight: 120, maxWidth: 120, opacity: 0.5, mb: 1 }}
                                                    />
                                                    <Typography variant="caption" color="text.secondary">No Image</Typography>
                                                </Box>
                                            );
                                        })()}


                                    </Box>
                                    {/* Details column */}
                                    <Box
                                        sx={{
                                            flex: 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 1,
                                            justifyContent: 'center',
                                            alignItems: 'flex-start',
                                            textAlign: 'left',
                                        }}
                                    >

                                        <Typography component="span" sx={{ color: 'warning.main', fontWeight: 'bold', fontSize: 16, display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                                            {row.Fournisseur?.TYPE_SUPPLIER}
                                            {/* Show sale_price only if type is NOT gold */}

                                            {row.Fournisseur?.TYPE_SUPPLIER && !row.Fournisseur.TYPE_SUPPLIER.toLowerCase().includes('gold')}
                                        </Typography>

                                        <Typography variant="body2" sx={{ whiteSpace: 'pre-line', fontSize: 13, color: 'inherit' }}>


                                            <b>ID:</b> {row.id_fact} |   {row.Design_art} | <b>Brand:</b> {row.Fournisseur?.client_name}



                                            {row.Fournisseur?.TYPE_SUPPLIER && row.Fournisseur.TYPE_SUPPLIER.toLowerCase().includes('gold') && (
                                                <>


                                                    | <b>Stone:</b> {row.Color_Rush ?? '-'}
                                                    | <b>Color:</b> {row.Color_Gold ?? '-'}

                                                    <div style={{ color: 'inherit', fontWeight: 900, marginTop: 2, fontSize: 18, textAlign: 'left', width: '100%' }}>
                                                        {row.qty}

                                                        <sup style={{ fontSize: 12, }}>/g</sup>
                                                        {' | '}
                                                        {(((goldPrice / 31.10350) + ((goldPrice / 31.10350) * ((row.Fournisseur?.Price_G_Gold_Sales || 0) / 100))) * (usdToLyd + 2) * row.qty).toLocaleString('en-LY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        <sup style={{ fontSize: 12 }}>LYD</sup>
                                                    </div>  </>
                                            )}

                                            {/* Exchange rate today: {(usdToLyd + 2.05).toLocaleString('en-LY', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}*/}




                                            {(() => {


                                                let diamond: any = undefined;
                                                let dp: any = row.DistributionPurchase;
                                                if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === 'object') {
                                                    diamond = dp[0]?.OriginalAchatDiamond;
                                                } else if (dp && typeof dp === 'object') {
                                                    diamond = dp?.OriginalAchatDiamond;
                                                }
                                                if (!diamond) return null;
                                                return (
                                                    <>


                                                        {diamond.Design_art && ` | `}<b>Product Name:</b> {diamond.Design_art ?? '-'}
                                                        {diamond.carat && ` | `}<b>Carat:</b> {diamond.carat ?? '-'}
                                                        {diamond.cut && ` | `}<b>Cut:</b> {diamond.cut ?? '-'}
                                                        {diamond.color && ` | `}<b>Color:</b> {diamond.color ?? '-'}
                                                        {diamond.clarity && ` | `}<b>Clarity:</b> {diamond.clarity ?? '-'}
                                                        {diamond.shape && ` | `}<b>Shape:</b> {diamond.shape ?? '-'}
                                                        {diamond.measurements && ` | `}<b>Measurements:</b> {diamond.measurements ?? '-'}
                                                        {diamond.depth_percent && ` | `}<b>Depth %:</b> {diamond.depth_percent ?? '-'}
                                                        {diamond.table_percent && ` | `}<b>Table %:</b> {diamond.table_percent ?? '-'}
                                                        {diamond.girdle && ` | `}<b>Girdle:</b> {diamond.girdle ?? '-'}
                                                        {diamond.culet && ` | `}<b>Culet:</b> {diamond.culet ?? '-'}
                                                        {diamond.polish && ` | `}<b>Polish:</b> {diamond.polish ?? '-'}
                                                        {diamond.symmetry && ` | `}<b>Symmetry:</b> {diamond.symmetry ?? '-'}
                                                        {diamond.fluorescence && ` | `}<b>Fluorescence:</b> {diamond.fluorescence ?? '-'}
                                                        {diamond.certificate_number && ` | `}<b>Certificate Number:</b> {diamond.certificate_number ?? '-'}
                                                        {diamond.certificate_lab && ` | `}<b>Certificate Lab:</b> {diamond.certificate_lab ?? '-'}
                                                        {diamond.certificate_url && ` | `}<b>Certificate URL:</b> <a href={diamond.certificate_url} target="_blank" rel="noopener noreferrer">Link</a>
                                                        {diamond.laser_inscription && ` | `}<b>Laser Inscription:</b> {diamond.laser_inscription ?? '-'}
                                                        {diamond.origin_country && ` | `}<b>Origin Country:</b> {diamond.origin_country ?? '-'}
                                                        {diamond.DocumentNo && ` | `}<b>Document No:</b> {diamond.DocumentNo ?? '-'}
                                                        {diamond.CODE_EXTERNAL && ` | `}<b>External Code:</b> {diamond.CODE_EXTERNAL ?? '-'}
                                                        {/* Always show sale_price if present, even if 0 */}
                                                        {'sale_price' in diamond && (
                                                            <div style={{ color: 'inherit', fontWeight: 900, marginTop: 2, fontSize: 18 }}>
                                                                {diamond.sale_price !== undefined && diamond.sale_price !== null
                                                                    ? diamond.sale_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                                                    : '-'}
                                                                <sup style={{ fontSize: 12, marginLeft: 2 }}>USD</sup>
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}




                                            {(() => {

                                                let watch: any = undefined;
                                                let dp: any = row.DistributionPurchase;
                                                if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === 'object') {
                                                    watch = dp[0]?.OriginalAchatWatch;
                                                } else if (dp && typeof dp === 'object') {
                                                    watch = dp?.OriginalAchatWatch;
                                                }
                                                if (!watch) return null;
                                                return (
                                                    <>
                                                        {/* Render only non-empty fields for watch info */}
                                                        {(() => {
                                                            const fields = [
                                                                { key: 'id_achat', label: 'system Original ref.' },
                                                                { key: 'reference_number', label: 'Ref.' },
                                                                { key: 'serial_number', label: 'Serial No.' },
                                                                { key: 'movement', label: 'Movement' },
                                                                { key: 'caliber', label: 'Caliber' },
                                                                { key: 'gender', label: 'Gender' },
                                                                { key: 'condition', label: 'Condition' },
                                                                { key: 'diamond_total_carat', label: 'Diamond Carat' },
                                                                { key: 'diamond_quality', label: 'Diamond Quality' },
                                                                { key: 'diamond_setting', label: 'Diamond Setting' },
                                                                { key: 'number_of_diamonds', label: 'Diamonds #' },
                                                                { key: 'custom_or_factory', label: 'Custom/Factory' },
                                                                { key: 'case_material', label: 'Case Material' },
                                                                { key: 'case_size', label: 'Case Size' },
                                                                { key: 'bezel', label: 'Bezel' },
                                                                { key: 'bracelet_type', label: 'Bracelet Type' },
                                                                { key: 'bracelet_material', label: 'Bracelet Material' },
                                                                { key: 'dial_color', label: 'Dial Color' },
                                                                { key: 'dial_style', label: 'Dial Style' },
                                                                { key: 'crystal', label: 'Crystal' },
                                                                { key: 'water_resistance', label: 'Water Resistance' },
                                                                { key: 'functions', label: 'Functions' },
                                                                { key: 'power_reserve', label: 'Power Reserve' },
                                                                { key: 'common_local_brand', label: 'Local Brand' },
                                                            ];
                                                            return fields.map(f => {
                                                                const val = watch[f.key];
                                                                if (val === undefined || val === null || val === '') return null;
                                                                return <span key={f.key}> | <b>{f.label}:</b> {val}</span>;
                                                            });
                                                        })()}
                                                        {/* Box/Papers special case */}
                                                        {typeof watch.box_papers !== 'undefined' && watch.box_papers !== null ? <> | <b>Box/Papers:</b> {watch.box_papers ? 'Yes' : 'No'}</> : null}
                                                        {/* Warranty */}
                                                        {watch.warranty ? <> | <b>Warranty:</b> {watch.warranty}</> : null}
                                                        {/* Sale price */}
                                                        {'sale_price' in watch ? (
                                                            <div style={{ color: 'inherit', fontWeight: 900, marginTop: 2, fontSize: 18 }}>
                                                                {watch.sale_price !== undefined && watch.sale_price !== null
                                                                    ? watch.sale_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                                                    : '-'}
                                                                <sup style={{ fontSize: 12, marginLeft: 2 }}>USD</sup>
                                                            </div>
                                                        ) : null}
                                                    </>
                                                );
                                            })()}
                                        </Typography>
                                        <Button
                                            variant="contained"
                                            color="warning"
                                            size="small"
                                            sx={{ mt: 2, fontWeight: 700, borderRadius: 2, alignSelf: 'flex-end' }}
                                            onClick={() => handleSave(row)}
                                            disabled={addToCartLoading[row.id_fact] || datainv.some(item => item.id_art === row.id_fact)}
                                            startIcon={addToCartLoading[row.id_fact] ? <CircularProgress size={18} color="inherit" /> : null}
                                        >
                                            {addToCartLoading[row.id_fact]
                                                ? 'Adding...'
                                                : datainv.some(item => item.id_art === row.id_fact)
                                                    ? 'In Cart'
                                                    : 'Add to cart'}
                                        </Button>
                                    </Box>
                                </Box>
                            ))
                        )}
                    </Box>
                </Box>
                <Box sx={{ width: '15%', minWidth: 200 }}>
                    {/* Right Sidebar - Cart */}
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>Cart</Typography>
                        <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                            <Box sx={{ color: 'warning.main', fontSize: 28, mr: 0.5 }}>
                                <span role="img" aria-label="cart">🛒</span>
                            </Box>
                            <Box sx={{
                                position: 'absolute',
                                top: -6,
                                right: -6,
                                bgcolor: 'error.main',
                                color: 'white',
                                borderRadius: '50%',
                                width: 22,
                                height: 22,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: 14,
                                border: '2px solid #fff',
                                zIndex: 1
                            }}>
                                {datainv.length}
                            </Box>
                        </Box>
                    </Box>
                    <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        sx={{ mb: 2, fontWeight: 700, borderRadius: 2, width: '100%' }}
                        onClick={() => {
                            setEditInvoice(initialInvoiceState); // <-- Empty editInvoice
                            setEmptyCartConfirmOpen(true);
                        }}
                        disabled={datainv.length === 0}
                    >
                        Empty my cart
                    </Button>
                    {/* Cart Items List */}
                    {datainv.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">No items in cart</Typography>
                    ) : (
                        <>
                            {datainv.map((item, idx) => {
                                // Extract display fields from ACHATs[0] if available
                                const achat = item.ACHATs?.[0];

                                const typeSupplier = achat?.Fournisseur?.TYPE_SUPPLIER || 'Unknown Type';
                                return (
                                    <Box
                                        key={item.id_art}
                                        sx={{
                                            mb: 2,
                                            p: 1,
                                            border: '1px solid #e0e0e0',
                                            borderRadius: 2,
                                            display: 'flex',
                                            alignItems: 'center',
                                            position: 'relative',
                                            ...(item.IS_GIFT && {
                                                bgcolor: 'rgba(255, 68, 0, 0.38)',
                                                color: 'warning.main',
                                                border: '2px solid',
                                                borderColor: 'warning.main',
                                            }),
                                        }}
                                    >
                                        {/* Show image if available */}
                                        <Box sx={{ width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 1, overflow: 'hidden', mr: 1, bgcolor: 'inherit', border: '1px solid #eee' }}>
                                            {(() => {
                                                // Show only the first image from imageUrls if available, else fallback to pic


                                                const imageKey = item.picint;
                                                const imageKeyStr = String(imageKey);



                                                const urls = imageUrls?.[imageKeyStr] || [];
                                                const token = localStorage.getItem('token');

                                                if (urls.length > 0 && urls[0]) {
                                                    let url = urls[0];
                                                    if (token && url && !url.includes('token=')) {
                                                        url += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
                                                    }


                                                    return (
                                                        <Box
                                                            component="img"
                                                            src={url}
                                                            alt="Product"
                                                            loading="lazy"
                                                            sx={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 1, border: '1px solid #ccc' }}
                                                            //  onClick={() => handleViewImage(item)}
                                                            onError={e => {
                                                                e.currentTarget.onerror = null;
                                                                e.currentTarget.src = '/default-image.png';
                                                            }}
                                                        />
                                                    );
                                                }

                                            })()}
                                        </Box>
                                        <Box sx={{ flex: 1 }}>


                                            <Typography variant="body2">ID: {item.id_art}</Typography>
                                            {typeSupplier.toLowerCase().includes('gold') && (
                                                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                                                    Weight: {item.qty} g
                                                </Typography>
                                            )}
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                <Typography variant="body2" sx={{ color: 'warning.main', fontWeight: 700, fontSize: 13 }}>
                                                    {typeSupplier}
                                                </Typography>
                                                <Typography variant="body2">
                                                    {item.IS_GIFT ? <span style={{ color: 'orangered', fontWeight: 'bold' }}>&#127873; Is Gift</span> : 'No'}
                                                </Typography>
                                            </Box>


                                            <Typography variant="body2" color="success.main" sx={{ fontWeight: 700 }}>
                                                {item.total_remise ?
                                                    (typeSupplier.toLowerCase().includes('gold')
                                                        ? `${item.total_remise.toLocaleString('en-LY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LYD`
                                                        : `${item.total_remise.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`)
                                                    : '-'}
                                            </Typography>
                                        </Box>
                                        {/* Delete icon */}
                                        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, position: 'absolute', top: 4, right: 4 }}>
                                            <Button
                                                onClick={() => {
                                                    setDeleteTargetId(item.id_fact);
                                                    setDeleteConfirmOpen(true);
                                                }}
                                                size="small"
                                                sx={{ minWidth: 0, p: 0.5 }}
                                                color="error"
                                            >
                                                <span role="img" aria-label="delete">🗑️</span>
                                            </Button>
                                            <Button
                                                size="small"
                                                sx={{ minWidth: 0, p: 0.5 }}
                                                color="error"
                                                onClick={() => handleEditCartItem2(item)}
                                            >
                                                <span role="img" aria-label="edit">✏️</span>
                                            </Button>
                                        </Box>
                                    </Box>
                                );
                            })}
                            {/* Total Amounts by Currency */}
                            <Box sx={{ mt: 0.5, p: 1, borderTop: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0, display: 'flex', alignItems: 'center' }}>
                                    Total Amounts
                                </Typography>

                            </Box>
                            <Box sx={{ mb: 1, p: 1, borderTop: '1px solid #eee' }}>
                                {/* Gold (LYD) */}
                                {(() => {
                                    const goldTotal = getFinalTotal(datainv, 'gold');
                                    return goldTotal > 0 ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Typography variant="body2" sx={{ color: 'goldenrod', fontWeight: 700 }}>
                                                Gold: {goldTotal.toLocaleString('en-LY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LYD
                                            </Typography>
                                            <Button
                                                variant="text"
                                                color="primary"
                                                size="small"
                                                startIcon={<span role="img" aria-label="edit">✏️</span>}
                                                sx={{ minWidth: 32, p: 0.5, ml: 1, borderRadius: 1 }}
                                                onClick={handleOpenTotalsDialog}
                                                disabled={datainv.length === 0}
                                            >

                                            </Button>
                                        </Box>
                                    ) : null;
                                })()}

                                {/* Diamond (USD) */}
                                {(() => {
                                    const diamondTotal = getFinalTotal(datainv, 'diamond');
                                    return diamondTotal > 0 ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Typography variant="body2" sx={{ color: 'deepskyblue', fontWeight: 700 }}>
                                                Diamond: {diamondTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                                            </Typography>
                                            <Button
                                                variant="text"
                                                color="primary"
                                                size="small"
                                                startIcon={<span role="img" aria-label="edit">✏️</span>}
                                                sx={{ minWidth: 32, p: 0.5, ml: 1, borderRadius: 1 }}
                                                onClick={handleOpenTotalsDialog}
                                                disabled={datainv.length === 0}
                                            >

                                            </Button>
                                        </Box>
                                    ) : null;
                                })()}
                                {/* Watch (USD) */}
                                {(() => {
                                    const watchTotal = getFinalTotal(datainv, 'watch');
                                    return watchTotal > 0 ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Typography variant="body2" sx={{ color: 'orange', fontWeight: 700 }}>
                                                Watch: {watchTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                                            </Typography>

                                        </Box>
                                    ) : null;
                                })()}
                            </Box>
                            <Button
                                variant="outlined"
                                color="primary"
                                size="small"

                                sx={{ mt: 1, fontWeight: 700, borderRadius: 2, width: '100%' }}
                                onClick={handleOpenTotalsDialog}
                                disabled={datainv.length === 0}
                            >
                                Complete Invoice Details
                            </Button>
                            <Button
                                variant="outlined"
                                color="success"
                                size="small"
                                sx={{ mt: 1, fontWeight: 700, borderRadius: 2, width: '100%' }}
                                onClick={() => {
                                    // Find the latest invoice (assuming it's the last one in datainv)
                                    handleAddNew();
                                }}
                                disabled={datainv.length === 0}
                            >
                                Print Invoice
                            </Button>
                            <InvoiceTotalsDialog
                                Type_Supplier={datainv[0]?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || ''}
                                open={totalsDialog.open}
                                totals={totalsDialog}
                                isSaving={isSaving}
                                onChange={handleTotalsDialogChange}
                                onClose={handleTotalsDialogClose}
                                onUpdate={handleTotalsDialogUpdate}
                                Sm={Sm}
                                customers={customers}
                                editInvoice={editInvoice}

                                setEditInvoice={setEditInvoice}
                                errors={{ client: '' }} // You may want to handle errors statefully
                            />
                            <Snackbar
                                open={snackbar.open}
                                autoHideDuration={4000}
                                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                            >
                                <MuiAlert elevation={6} variant="filled" severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
                                    {snackbar.message}
                                </MuiAlert>
                            </Snackbar>
                            <PrintInvoiceDialog
                                open={printDialog.open}
                                invoice={printDialog.invoice}
                                data={{
                                    invoice: printDialog.invoice || initialInvoiceState,
                                    items: datainv,
                                    customer: customers.find(c => c.id_client === editInvoice.client),
                                    totalAmountLYD: totalsDialog.amount_lyd,
                                    totalAmountUSD: totalsDialog.amount_currency,
                                    totalAmountEur: totalsDialog.amount_EUR,
                                    totalWeight: 0, // Add your calculation if needed
                                    itemCount: datainv.length,
                                    amount_currency_LYD: totalsDialog.amount_currency_LYD,
                                    amount_EUR_LYD: totalsDialog.amount_EUR_LYD,
                                    Original_Invoice: datainv[0]?.ACHATs?.[0]?.Original_Invoice || '',
                                    picint: datainv[0]?.picint || 0,
                                    remise: totalsDialog.remise, // <-- Pass remise
                                    remise_per: totalsDialog.remise_per // <-- Pass remise_per
                                }}
                                printRef={printRef}
                                onClose={() => setPrintDialog((prev) => ({ ...prev, open: false }))}
                                onInvoiceClosed={() => {
                                    fetchData(typeFilter); // Refresh data after closing invoice
                                }}
                                onCartRefresh={() => {
                                    fetchDataINV(); // Refresh the cart after closing invoice
                                }}
                                showCloseInvoiceActions={false}
                                showCloseInvoice={false}
                            />
                        </>
                    )}
                </Box>
            </Box>
            <Snackbar
                open={deleteConfirmOpen}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                onClose={() => setDeleteConfirmOpen(false)}
            >
                <Box
                    sx={{
                        background: '#fff',
                        color: '#222',
                        boxShadow: 6,
                        minWidth: 340,
                        textAlign: 'center',
                        borderRadius: 2,
                        p: 2
                    }}
                >
                    <Typography sx={{ mb: 1, fontWeight: 'bold', color: '#f44336' }}>
                        Confirm Deletion
                    </Typography>
                    <Typography sx={{ mb: 2 }}>
                        Are you sure you want to delete this item from the cart?
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                        <Button
                            variant="contained"
                            color="error"
                            disabled={deleteLoading}
                            onClick={async () => {
                                setDeleteLoading(true);
                                if (deleteTargetId !== null) {

                                    const token = localStorage.getItem('token');
                                    await axios.delete(`${apiUrlinv}/Delete/${deleteTargetId}`, {
                                        headers: { Authorization: `Bearer ${token}` }
                                    });
                                    await fetchDataINV();
                                    await fetchData();
                                }
                                setDeleteConfirmOpen(false);
                                setDeleteTargetId(null);
                                setDeleteLoading(false);
                            }}
                        >
                            {deleteLoading ? <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} /> : null}
                            Yes, Delete
                        </Button>
                        <Button
                            variant="outlined"
                            color="inherit"
                            onClick={() => setDeleteConfirmOpen(false)}
                        >
                            Cancel
                        </Button>
                    </Box>
                </Box>
            </Snackbar>
            <Snackbar
                open={emptyCartConfirmOpen}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                onClose={() => setEmptyCartConfirmOpen(false)}
            >
                <Box
                    sx={{
                        background: '#fff',
                        color: '#222',
                        boxShadow: 6,
                        minWidth: 340,
                        textAlign: 'center',
                        borderRadius: 2,
                        p: 2
                    }}
                >
                    <Typography sx={{ mb: 1, fontWeight: 'bold', color: '#f44336' }}>
                        Confirm Empty Cart
                    </Typography>
                    <Typography sx={{ mb: 2 }}>
                        Are you sure you want to remove all items from your cart?
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                        <Button
                            variant="contained"
                            color="error"
                            disabled={emptyCartLoading}
                            onClick={async () => {
                                setEmptyCartLoading(true);
                                try {
                                    for (const item of datainv) {
                                        await axios.delete(`${apiUrlinv}/Delete/${item.id_fact}`, {
                                            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                                        });
                                    }
                                    await fetchDataINV();
                                    // Reset customer selection when cart is emptied
                                    setEditInvoice(prev => ({
                                        ...initialInvoiceState,
                                        client: 0,
                                        Client: undefined
                                    }));
                                } finally {
                                    setEmptyCartLoading(false);
                                    setEmptyCartConfirmOpen(false);
                                }
                            }}
                        >
                            {emptyCartLoading ? <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} /> : null}
                            Yes, Empty
                        </Button>
                        <Button
                            variant="outlined"
                            color="inherit"
                            onClick={() => setEmptyCartConfirmOpen(false)}
                        >
                            Cancel
                        </Button>
                    </Box>
                </Box>
            </Snackbar>
            <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
                <DialogTitle>Edit Discount</DialogTitle>
                <DialogContent>
                    <TextField
                        label="Discount Amount"
                        type="number"
                        value={editDialogRemise}
                        onChange={e => setEditDialogRemise(Number(e.target.value))}
                        fullWidth
                        margin="normal"
                        size="small"
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                        <input
                            type="checkbox"
                            checked={editDialogItem?.IS_GIFT}
                            onChange={e =>
                                setEditDialogItem(item =>
                                    item ? { ...item, IS_GIFT: e.target.checked } : item
                                )
                            }
                            id="is-gift-checkbox"
                        />
                        <label htmlFor="is-gift-checkbox" style={{ marginLeft: 8 }}>
                            Is Gift
                        </label>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditDialogOpen(false)} color="inherit">Cancel</Button>
                    <Button onClick={async () => {
                        await handleEditDialogSave();
                        await fetchDataINV(); // Refresh cart list after save
                        setEditDialogOpen(false);
                    }} color="primary" variant="contained">Save</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default DNew_I;
