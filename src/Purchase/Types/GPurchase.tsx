// GPurchase.tsx
import { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    MaterialReactTable,
    useMaterialReactTable,
    type MRT_ColumnDef,
} from 'material-react-table';
import {
    Box, IconButton, Tooltip, Button,
    Divider, Typography,
    Card, CardContent,
    Snackbar,
    Alert as MuiAlert,
    LinearProgress
} from '@mui/material';


import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import { ArrowBack, ListAltSharp } from '@mui/icons-material';
import GNew_p from './ListCardPurchase/GNew_P';
import DNew_p from './ListCardPurchase/DNew_P';
import WNew_p from './ListCardPurchase/WNew_P';
import BNew_p from './ListCardPurchase/BNew_P';

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

type SnackbarState = {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
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
    RATE: 0,
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
    CURRENCY: '',
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
    Original_Invoice: ''
};

interface Props {
    Type?: string;
}

const GPurchase = (props: Props) => {
    const { Type } = props;
    const [data, setData] = useState<Purchase[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showPurchaseForm, setShowPurchaseForm] = useState(false);
    const [editPurchase, setEditPurchase] = useState<Purchase>(initialPurchaseState);
    const [isEditMode, setIsEditMode] = useState(false);
    const [errors, setErrors] = useState<any>({});
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loadingSuppliers, setLoadingSuppliers] = useState(false);
    const [selectedInvoiceNum, setSelectedInvoiceNum] = useState<number | null>(null);
    const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
    const [refreshFlag, setRefreshFlag] = useState(0);
    const [progress, setProgress] = useState(0);
    const [notReceivedDistributions, setNotReceivedDistributions] = useState<any[]>([]);
    const [receiveDistribution, setReceiveDistribution] = useState<any | null>(null);
    const [distributionToReceive, setDistributionToReceive] = useState<any | null>(null);
    const [receivedWeights, setReceivedWeights] = useState<Record<string, number>>({});

    const [snackbar, setSnackbar] = useState<SnackbarState>({
        open: false,
        message: '',
        severity: 'info'
    });

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

    const apiIp = process.env.REACT_APP_API_IP;
    const apiUrl = `http://${apiIp}/purchases`;

    const showSnackbar = (message: string, severity: SnackbarState['severity']) => {
        setSnackbar({ open: true, message, severity });
    };

    const handleCloseSnackbar = () => {
        setSnackbar(prev => ({ ...prev, open: false }));
    };

    const fetchData = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate("/");
            return;
        }

        try {
            setLoading(true);
            setProgress(0);

            // Simulate progress for demo purposes
            const timer = setInterval(() => {
                setProgress((oldProgress) => {
                    if (oldProgress >= 90) {
                        clearInterval(timer);
                        return oldProgress;
                    }
                    return oldProgress + 10;
                });
            }, 300);

            const res = await axios.get<Purchase[]>(`${apiUrl}/all`, {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    ps,
                    type_supplier: Type  // Add TYPE_SUPPLIER filter
                },
                onDownloadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percentCompleted = Math.round(
                            (progressEvent.loaded * 100) / progressEvent.total
                        );
                        setProgress(percentCompleted);
                    }
                }
            });

            clearInterval(timer);
            setProgress(100);
            setData(res.data);
        } catch (err: any) {
            if (err.response?.status === 401) {
                navigate("/");
            } else {
                showSnackbar("Error loading data", 'error');
            }
        } finally {
            setLoading(false);
            setTimeout(() => setProgress(0), 500); // Reset progress after a short delay
        }
    }, [navigate, ps]);

    const fetchSuppliers = useCallback(async () => {
        const apiUrlsuppliers = `http://${apiIp}/suppliers`;
        const token = localStorage.getItem('token');
        try {
            setLoadingSuppliers(true);
            const res = await axios.get<Supplier[]>(`${apiUrlsuppliers}/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSuppliers(res.data);
        } catch (error) {
            console.error("Error fetching suppliers:", error);
            showSnackbar("Error fetching suppliers", 'error');
        } finally {
            setLoadingSuppliers(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        fetchSuppliers();
    }, [refreshFlag]);

    useEffect(() => {
        const fetchNotReceived = async () => {
            const token = localStorage.getItem('token');
            let type = '';
            if (Type === 'gold') type = 'Gold Purchase';
            else if (Type === 'diamond') type = 'Diamond Purchase';
            else if (Type === 'watches') type = 'Watche Purchase';
            else type = 'boxes Purchase';
            try {
                const res = await axios.get(`http://${apiIp}/Dpurchases/not-received`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { type }
                });
                // Filter by current ps
                setNotReceivedDistributions(
                    (res.data || []).filter((dist: any) => dist.ps === ps)
                );


               console.log("Not received distributions:",ps,  (res.data || []).filter((dist: any) => dist.ps === ps));
            } catch (err) {
                setNotReceivedDistributions([]);
            }
        };
        fetchNotReceived();
    }, [Type, refreshFlag, ps]);

    const groupedPurchases = useMemo(() => {
        const groups: Record<string, Purchase[]> = {};
        data.forEach(p => {
            const key = p.Fournisseur?.TYPE_SUPPLIER || p.TYPE_SUPPLIER || 'Unknown';

            // Only include purchases where TYPE_SUPPLIER contains 'gold' (case-insensitive)
            if (key.toLowerCase().includes(Type ?? '')) {
                if (!groups[key]) groups[key] = [];
                groups[key].push(p);
            }
        });
        return groups;
    }, [data]);

    const getLastMonthWeight = (purchases: Purchase[]) => {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        return purchases.reduce((sum, purchase) => {
            const purchaseDate = new Date(purchase.date_fact);
            if (purchaseDate >= oneMonthAgo) {
                return sum + (purchase.qty || 0);
            }
            return sum;
        }, 0);
    };

    const getLastMonthNbr = (purchases: Purchase[]) => {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const uniqueInvoices = new Set<number>();

        return purchases.reduce((count, purchase) => {
            const purchaseDate = new Date(purchase.date_fact);
            if (purchaseDate >= oneMonthAgo && !uniqueInvoices.has(purchase.num_fact)) {
                uniqueInvoices.add(purchase.num_fact);
                return count + 1;
            }
            return count;
        }, 0);
    };

    const handleAddNew = async () => {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`http://${apiIp}/purchases/NewNF`, {
                headers: { Authorization: `Bearer ${token}` },
            });
             if (!response.ok) throw new Error("Failed to fetch new purchase number");
            const result = await response.json();
            const newNumFact = result.new_num_fact;

            setEditPurchase({
                ...initialPurchaseState,
                num_fact: newNumFact,
                usr: Number(Cuser),
                ps: Number(ps),
                date_fact: new Date().toISOString().split('T')[0],
            });

            setSelectedInvoiceNum(newNumFact);
            setIsEditMode(false);
            setShowPurchaseForm(true);
        } catch (error) {
            console.error("Error fetching new num_fact:", error);
            showSnackbar("Failed to create new purchase", 'error');
        }
    };

    const handleEdit = (row: Purchase) => {
        setSelectedInvoiceNum(row.num_fact);
        setEditPurchase(row);
        setIsEditMode(true);
        setShowPurchaseForm(true);
    };

    const handleCancel = () => {
        setShowPurchaseForm(false);
        setEditPurchase(initialPurchaseState);
        setErrors({});
        setSelectedInvoiceNum(null);
    };

    const handleCardClick = (supplier: string) => {
        setSelectedSupplier(supplier === selectedSupplier ? null : supplier);
    };

    const getPurchaseSummary = (purchaseNum: number) => {
        const items = data.filter(item => item.num_fact === purchaseNum);
        const firstItem = items[0];
        const isGold = firstItem?.TYPE_SUPPLIER?.toLowerCase().includes('gold') ||
            firstItem?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes('gold');

        if (isGold) {
            const totalQty = items.reduce((sum, item) => sum + (item.qty || 0), 0);
            const totalFullQty = items.reduce((sum, item) => sum + (item.Full_qty || 0), 0);
            return {
                itemCount: items.length,
                totalQty,
                totalFullQty,
                display: `${items.length} products | ${totalQty.toFixed(2)}g net | ${totalFullQty.toFixed(2)}g Full`
            };
        } else {
            return {
                itemCount: items.length,
                display: `${items.length} products`
            };
        }
    };

    const columns = useMemo<MRT_ColumnDef<Purchase>[]>(() => [
        { accessorKey: 'Fournisseur.client_name', header: 'Vendors', size: 80 },
        { accessorKey: 'Original_Invoice', header: 'Purchase Ref. No', size: 80 },
        { accessorKey: 'num_fact', header: 'Purchase Sys. No', size: 80 },
        {
            header: 'Purchase Summary',
            size: 80,
            Cell: ({ row }) => {
                const summary = getPurchaseSummary(row.original.num_fact);

                return (
                    <Box
                        sx={{
                            backgroundColor: '#558b2f',
                            p: 1,
                            borderRadius: 4,
                            color: 'whitesmoke',
                            textAlign: 'center',
                        }}
                    >
                        {summary.display}
                    </Box>
                );
            }
        },
        {
            accessorKey: 'date_fact',
            header: 'Purchase Date',
            size: 100,
            Cell: ({ cell }) => {
                const date = cell.getValue<Date>();
                return date ? new Date(date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }) : null;
            }
        },
        { accessorKey: 'Utilisateur.name_user', header: 'Created By', size: 80 },
        {
            accessorKey: 'IS_OK',
            header: 'Is Closed',
            size: 60,
            Cell: ({ cell }) => cell.getValue() ? 'Yes' : 'No'
        },
        { accessorKey: 'COMMENT', header: 'Comment', size: 80 },
        {
            header: 'Actions',
            id: 'actions',
            size: 100,
            Cell: ({ row }) => (
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Edit">
                        <IconButton color="primary" onClick={() => handleEdit(row.original)} size="small">
                            <ListAltSharp fontSize="medium" />
                        </IconButton>
                    </Tooltip>
                </Box>
            ),
        },
    ], [data]);

    const distinctByInvoice = useMemo(() => {
        const map = new Map<number, Purchase>();
        const source = selectedSupplier ? groupedPurchases[selectedSupplier] || [] : data;

        source.forEach((purchase) => {
            if (!map.has(purchase.num_fact)) {
                map.set(purchase.num_fact, purchase);
            }
        });

        return Array.from(map.values());
    }, [selectedSupplier, groupedPurchases, data]);

    const table = useMaterialReactTable({
        columns,
        data: distinctByInvoice,
        state: { isLoading: loading, density: 'compact' },
        enableDensityToggle: true,
    });

    const handleMarkReceived = async (distribution: any) => {
       
            const token = localStorage.getItem('token');
            try {
                // 1. Check if purchase with original_invoice exists
                const res = await axios.get(`http://${apiIp}/purchases/findByOriginalInvoice`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { original_invoice: distribution.distributionID }
                });
                const purchases = res.data || [];
                if (purchases.length > 0) {
                    // 2. If exists, show the purchase (edit mode)
                    const purchase = { ...purchases[0], Original_Invoice: distribution.distributionID };
                    setEditPurchase(purchase);
                    setIsEditMode(true);
                    setShowPurchaseForm(true);
                    setSelectedInvoiceNum(purchase.num_fact);
                    setDistributionToReceive(distribution); // <-- Ensure this is set for referencePurchase
                } else {
                    // 3. Else, create new purchase as before
                    const response = await fetch(`http://${apiIp}/purchases/NewNF`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (!response.ok) throw new Error("Failed to fetch new purchase number");
                    const result = await response.json();
                    const newNumFact = result.new_num_fact;

                    setEditPurchase({
                        ...initialPurchaseState,
                        num_fact: newNumFact,
                        usr:Number( Cuser),
                        ps: Number(ps),
                        date_fact: new Date().toISOString().split('T')[0],
                        Original_Invoice: distribution.distributionID
                    });
                    setDistributionToReceive(distribution);
                    setShowPurchaseForm(true);
                    setSelectedInvoiceNum(newNumFact);
                }
            } catch (error) {
                showSnackbar("Failed to process distribution", 'error');
            }
        
       

        
    }  ;

    useEffect(() => {
        const fetchReceivedWeights = async () => {
            const token = localStorage.getItem('token');
            const weights: Record<string, number> = {};
            await Promise.all(
                notReceivedDistributions.map(async (dist) => {
                    try {
                        const res = await axios.get(`http://${apiIp}/purchases/findByOriginalInvoice`, {
                            headers: { Authorization: `Bearer ${token}` },
                            params: { original_invoice: dist.distributionID }
                        });
                        const purchases = res.data || [];
                        const sumQty = purchases.reduce((sum: number, p: any) => sum + (p.qty || 0), 0);
                        weights[dist.distributionID] = sumQty;
                    } catch {
                        weights[dist.distributionID] = 0;
                    }
                })
            );
            setReceivedWeights(weights);
        };
        if (notReceivedDistributions.length > 0) {
            fetchReceivedWeights();
        }
    }, [notReceivedDistributions]);

    return (
        <Box p={2}>
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MuiAlert
                    onClose={handleCloseSnackbar}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                    elevation={6}
                    variant="filled"
                >
                    {snackbar.message}
                </MuiAlert>
            </Snackbar>

            {/* Progress Bar - Only show when loading and progress > 0 */}
            {(loading && progress > 0) && (
                <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 9999,
                        height: 4
                    }}
                />
            )}

            <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" fontWeight="bold">
                    {selectedSupplier
                        ? `${selectedSupplier} Purchases`
                        : `${(Type ?? '').charAt(0).toUpperCase() + (Type ?? '').slice(1).toLowerCase()} Purchases`
                    }
                </Typography>
                <Box display="flex" gap={2}>
                    <Button
                        variant="outlined"
                        color="inherit"
                        sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 'bold', px: 3, py: 1 }}
                        onClick={() => {
                            setSelectedSupplier(null);
                            handleCancel();
                            setRefreshFlag(f => f + 1); // Refresh not received distributions
                        }}
                        startIcon={<ArrowBack />}
                    >
                        Back
                    </Button>
                    <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={handleAddNew}
                        sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 'bold', px: 3, py: 1 }}
                    >
                        New Purchase
                    </Button>
                </Box>
            </Box>

            <Divider sx={{ mb: 2, borderColor: '#616161' }} />

            {!showPurchaseForm ? (
                <>
                    {!selectedSupplier ? (
                        <>
                            {notReceivedDistributions.length > 0 && (
                                <MuiAlert
                                    severity="warning"
                                    sx={{
                                        position: 'sticky',
                                        top: 0,
                                        zIndex: 1000,
                                        mb: 2,
                                        borderRadius: 2,
                                        border: '1px solid #ff9800',
                                        // fontWeight: 'bold',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'flex-start',
                                        minHeight: 320,           // Increase height
                                        minWidth: 900,            // Increase width
                                        fontSize: 18,             // Larger font
                                        px: 4,                    // More horizontal padding
                                        py: 3                     // More vertical padding
                                    }}
                                >
                                    <Box sx={{ mb: 1 }}>
                                        New arrival has come and will be received soon. Please check the distribution list.
                                    </Box>
                                    <Box
                                        sx={{
                                            maxHeight: 180,
                                            overflowY: 'auto',
                                            width: '100%',
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: 2,
                                            alignItems: 'stretch',
                                        }}
                                    >
                                        {notReceivedDistributions.map((dist, idx) => (
                                            <Box
                                                key={dist.DistributionID || idx}
                                                sx={{
                                                    p: 1,
                                                    mb: 1,
                                                    border: '1px solid #eee',
                                                    borderColor: 'rgba(76, 175, 80, 0.50)',
                                                    borderRadius: 1,
                                                    backgroundColor: 'rgba(76, 175, 80, 0.10)',
                                                    fontSize: 12,
                                                    minWidth: 300,
                                                    maxWidth: 340,
                                                    flex: '1 1 300px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: 1,
                                                }}
                                            >
                                                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                                    <li>
                                                        <b>Distr. No:</b> {dist.distributionID}
                                                        <b>  | Date:</b> {new Date(dist.distributionDate).toLocaleDateString('en-GB', {
                                                            day: '2-digit',
                                                            month: 'long',
                                                            year: 'numeric'
                                                        })}
                                                    </li>
                                                    <li>
                                                        <b>Brand:</b>{' '}
                                                        {dist.PurchaseType?.toLowerCase().includes('gold')
                                                            ? dist.purchase?.supplier?.client_name ?? 'N/A'
                                                            : dist.PurchaseType?.toLowerCase().includes('diamond')
                                                                ? dist.purchaseD?.supplier?.client_name ?? 'N/A'
                                                                : dist.PurchaseType?.toLowerCase().includes('watche')
                                                                    ? dist.purchaseW?.supplier?.client_name ?? 'N/A'
                                                                    : 'N/A'
                                                        }
                                                    </li>
                                                    <li>
                                                        <b>Created By:</b> {dist.user?.name_user ?? dist.user?.name ?? 'N/A'}
                                                    </li>
                                                    {/* Only show these fields if Type contains 'gold' */}
                                                    {dist.PurchaseType?.toLowerCase().includes('gold') && (
                                                        <>
                                                            <li>
                                                                <b>Weight:</b> {Number(dist.Weight).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} g
                                                            </li>
                                                            <li>
                                                                <b>Already Received:</b> {receivedWeights[dist.distributionID]?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'} g
                                                            </li>
                                                            <li>
                                                                <b>Rest to be received:</b>{' '}
                                                                <span style={{ color: 'red' }}>
                                                                    {(Number(dist.Weight) - (receivedWeights[dist.distributionID] || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} g
                                                                </span>
                                                            </li>
                                                        </>
                                                    )}
                                                    <li>
                                                        <b>Status:</b>{' '}
                                                        {dist.DistributionISOK ? (
                                                            <span style={{ color: 'green', fontWeight: 'bold' }}>Received</span>
                                                        ) : (
                                                            <span style={{ color: 'orange', fontWeight: 'bold' }}>Not Received</span>
                                                        )}
                                                    </li>

                                                </ul>
                                                {!dist.DistributionISOK && (
                                                    <Button
                                                        sx={{ minWidth: 100, mt: 12 }}
                                                        size="small"
                                                        variant="outlined"
                                                        color="success"
                                                        startIcon={<CheckCircleIcon />}
                                                        onClick={() => handleMarkReceived(dist)}
                                                    >
                                                        Receive
                                                    </Button>
                                                )}
                                            </Box>
                                        ))}
                                    </Box>
                                </MuiAlert>
                            )}
                            <Box sx={{
                                mt: 5,
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                                gap: 2,
                            }}>
                                {Object.entries(groupedPurchases).map(([type, items]) => {
                                    const lastMonthWeight = getLastMonthWeight(items);
                                    const lastMonthNbr = getLastMonthNbr(items);
                                    return (
                                        <Card
                                            key={type}
                                            onClick={() => handleCardClick(type)}
                                            sx={{
                                                minWidth: 200,
                                                cursor: 'pointer',
                                                borderRadius: 2,
                                                p: 2,
                                                boxShadow: 2,
                                                transition: 'all 0.3s ease',
                                                '&:hover': {
                                                    boxShadow: 8,
                                                    transform: 'scale(1.03)',
                                                },
                                            }}
                                        >
                                            <CardContent sx={{ p: 1 }}>
                                                <Box>
                                                    <Typography
                                                        variant="h5"
                                                        sx={{
                                                            fontWeight: 'bold',
                                                            color: 'text.primary',
                                                            mb: 0.5,
                                                        }}
                                                    >
                                                        {type}
                                                    </Typography>
                                                    <Divider sx={{ mb: 2 }} />

                                                    <Typography
                                                        sx={{
                                                            fontSize: 14,
                                                            color: 'text.secondary',
                                                            mb: 0.5,
                                                        }}
                                                    >
                                                        You have{' '}
                                                        <Box component="span" sx={{ color: 'orangered', fontWeight: 'bold' }}>
                                                            ({lastMonthNbr.toLocaleString()})
                                                        </Box>{' '}
                                                        purchase in the last month and{' '}
                                                        <Box component="span" sx={{ color: 'orangered', fontWeight: 'bold' }}>
                                                            ({lastMonthWeight.toLocaleString()})
                                                        </Box>{' '}
                                                        {type?.toLowerCase().includes('diamond') ||
                                                            type?.toLowerCase().includes('boxes') ||
                                                            type?.toLowerCase().includes('watches')
                                                            ? 'Items'
                                                            : '/g'}
                                                    </Typography>
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </Box>
                        </>
                    ) : (
                        <MaterialReactTable table={table} />
                    )}
                </>
            ) : (
                <>
                    {Type === 'gold' && (
                        <GNew_p
                            num_fact={selectedInvoiceNum ?? undefined}
                            distribution={distributionToReceive}
                            brand={distributionToReceive?.purchase?.supplier?.id_client}
                            referencePurchase={distributionToReceive?.distributionID}
                            onReceived={() => {
                                setShowPurchaseForm(false);
                                setDistributionToReceive(null);
                                setRefreshFlag(f => f + 1);
                            }}
                        />
                    )}
                    {Type === 'diamond' && (
                        <DNew_p
                            num_fact={selectedInvoiceNum ?? undefined}
                            distribution={distributionToReceive}
                            brand={distributionToReceive?.purchase?.supplier?.id_client}
                            referencePurchase={distributionToReceive?.distributionID}
                            onReceived={() => {
                               setShowPurchaseForm(false);
                               setDistributionToReceive(null);
                                setRefreshFlag(f => f + 1);
                            }}
                        />
                    )}
                   


                   {Type === 'watches' && (
                        <WNew_p
                            num_fact={selectedInvoiceNum ?? undefined}
                            distribution={distributionToReceive}
                            brand={distributionToReceive?.purchase?.supplier?.id_client}
                            referencePurchase={distributionToReceive?.distributionID}
                            onReceived={() => {
                               setShowPurchaseForm(false);
                               setDistributionToReceive(null);
                                setRefreshFlag(f => f + 1);
                            }}
                        />
                    )}


                    {Type === 'boxes' && <BNew_p num_fact={selectedInvoiceNum ?? undefined} />}
                </>
            )}
        </Box>
    );
};

export default GPurchase;