// GInvoices.tsx
import { useEffect, useState, useMemo, useCallback } from 'react';
import axios from "../api";
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
    Alert,
    LinearProgress
} from '@mui/material';

import { ArrowBack, ListAltSharp } from '@mui/icons-material';

import GNew_I from './ListCardInvoice/Gold Invoices/GNew_I';
//import DNew_I from './ListCardInvoice/Diamond Invoices/DNew_I';
//import WNew_I from './ListCardInvoice/Watches Invoices/WNew_I';


type Invoice = {
    id_art: number;
    date_fact: string;
    client: number;
    num_fact: number;
    usr: number;
    d_time: string;
    prix_vente: number;
    prix_vente_remise: number;
    COMMENT: string;
    IS_OK: boolean;
    rate: number;
    remise: number;
    is_printed: boolean;
    ps: number;
    phone_client: string;
    total_remise: number;
    qty: number;
    total_remise_final: number;
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
    Customer?: {
        id_client: number;
        client_name: string;
        code_customer: string;
    };
    User?: {
        id_user: number;
        name_user: string;
        email: string;
    };
    ACHATs?: ACHATs[];
    TYPE_SUPPLIER?: string;
};

type ACHATs = {
    id_fact: number;
    desig_art: string;
    client: number;
    qty: number;
    TOTAL_INV_FROM_DIAMOND: number;
    Fournisseur?: {
        id_client: number;
        client_name: string;
        code_fournisseur: string;
        TYPE_SUPPLIER: string;
    };
};

type SnackbarState = {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
};

const initialInvoiceState: Invoice = {
    id_art: 0,
    date_fact: new Date().toISOString().split('T')[0],
    client: 0,
    num_fact: 0,
    usr: 0,
    d_time: new Date().toISOString(),
    prix_vente: 0,
    prix_vente_remise: 0,
    COMMENT: '',
    IS_OK: false,
    rate: 0,
    remise: 0,
    is_printed: false,
    ps: 0,
    phone_client: '',
    total_remise: 0,
    qty: 0,
    total_remise_final: 0,
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
};

interface Props {
    Type?: string;
}

const GInvoices = (props: Props) => {
    const { Type = '' } = props;
    const [data, setData] = useState<Invoice[]>([]);
    const [Alldata, setAllData] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInvoiceForm, setShowInvoiceForm] = useState(false);
    const [editInvoice, setEditInvoice] = useState<Invoice>(initialInvoiceState);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedInvoiceNum, setSelectedInvoiceNum] = useState<number | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [refreshFlag, setRefreshFlag] = useState(0);
    const [progress, setProgress] = useState(0);

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
    const apiUrl = `${apiIp}/invoices`;

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

            const timer = setInterval(() => {
                setProgress(oldProgress => (oldProgress >= 90 ? oldProgress : oldProgress + 10));
            }, 300);

            const res = await axios.get<Invoice[]>(`${apiUrl}/all`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { ps, type_supplier: Type }
            });


            clearInterval(timer);
            setProgress(100);

            // Filter out duplicate invoices by num_fact
            const uniqueInvoices = res.data.reduce((acc: Invoice[], current: Invoice) => {
                const x = acc.find(item => item.num_fact === current.num_fact);
                if (!x) {
                    return acc.concat([current]);
                } else {
                    return acc;
                }
            }, []);

            setData(uniqueInvoices);



        } catch (err: any) {
            console.error("Error fetching data:", err);
            if (err.response?.status === 401) {
                navigate("/");
            } else {
                showSnackbar("Error loading data", 'error');
            }
        } finally {
            setLoading(false);
            setTimeout(() => setProgress(0), 500);
        }
    }, [navigate, ps, Type]);

    useEffect(() => {
        fetchData();


    }, [fetchData, refreshFlag]);

    const groupedInvoices = useMemo(() => {
        const groups: Record<string, Invoice[]> = {
            'Chira': [],
            'Whole sale': [],
            'Invoices': []
        };

        data.forEach(i => {
            // Access TYPE_SUPPLIER from the first ACHAT item (if exists)
            const supplierType = i?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER;

            if (Type) {
                if (!supplierType || !supplierType.toLowerCase().includes(Type.toLowerCase())) {
                    return; // Skip if no match
                }
            }

            // Original grouping logic
            if (i.is_chira) {
                groups['Chira'].push(i);
            } else if (i.IS_WHOLE_SALE) {
                groups['Whole sale'].push(i);
            } else {
                groups['Invoices'].push(i);
            }
        });

        return groups;
    }, [data, Type]);

    const getLastMonthAmount = (invoices: Invoice[]) => {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        return invoices.reduce((sum, invoice) => {
            const invoiceDate = new Date(invoice.date_fact);
            return invoiceDate >= oneMonthAgo ? sum + (invoice.amount_lyd || 0) : sum;
        }, 0);




    };

    const getLastMonthCount = (invoices: Invoice[]) => {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        return invoices.reduce((count, invoice) => {
            const invoiceDate = new Date(invoice.date_fact);
            return invoiceDate >= oneMonthAgo ? count + 1 : count;
        }, 0);
    };

    const handleAddNew = async () => {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`${apiUrl}/NewNF`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) throw new Error("Failed to fetch new invoice number");

            const result = await response.json();
            const newNumFact = result.new_num_fact;

            setEditInvoice({
                ...initialInvoiceState,
                num_fact: newNumFact,
                usr: Number(Cuser),
                ps: Number(ps),
                date_fact: new Date().toISOString().split('T')[0],
            });

            setSelectedInvoiceNum(newNumFact);
            setIsEditMode(false);
            setShowInvoiceForm(true);
        } catch (error) {
            console.error("Error creating new invoice:", error);
            showSnackbar("Failed to create new invoice", 'error');
        }
    };

    const handleEdit = (row: Invoice) => {


        setSelectedInvoiceNum(row.num_fact);


        setEditInvoice(row);
        setIsEditMode(true);
        setShowInvoiceForm(true);
    };

    const handleCardClick = (group: string) => {
        setSelectedGroup(group);
        setShowInvoiceForm(false);
    };

    const getInvoiceSummary = async (num_fact: number): Promise<{
        itemCount: number;
        totalQty: number;
        SumInv: number;
        display: string;
    }> => {
        try {

            const token = localStorage.getItem('token');


            // Assuming you need to fetch data first (though Alldata is used later)
            const res = await axios.get<Invoice[]>(`${apiUrl}/Getinvoice`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { ps, num_fact: num_fact }
            });

            // Assuming Alldata comes from the response or is defined elsewhere
            const Alldata = res.data;
            const items = Alldata.filter(item => item.num_fact === num_fact);

            if (items.length === 0) {
                return {
                    itemCount: 0,
                    totalQty: 0,
                    SumInv: 0,
                    display: 'No items found'
                };
            }

            const totalQty = items.reduce((sum, item) => sum + (item.qty || 0), 0);
            const SumInv = items.reduce((sum, item) => sum + (item.TOTAL_INV_FROM_DIAMOND || 0), 0);

            return {
                itemCount: items.length,
                totalQty,
                SumInv,
                display: Type === 'gold'
                    ? `${items.length} products | ${totalQty.toFixed(2)}g net | ${Math.round(SumInv).toLocaleString('en')} LYD`
                    : `${items.length} products | ${Math.round(SumInv).toLocaleString('en')} USD`
            };
        } catch (error) {
            console.error('Error fetching invoice summary:', error);
            return {
                itemCount: 0,
                totalQty: 0,
                SumInv: 0,
                display: 'Error loading invoice data'
            };
        }
    };




    const columns = useMemo<MRT_ColumnDef<Invoice>[]>(() => [
        {
            accessorKey: 'ACHATs.0.Fournisseur.TYPE_SUPPLIER',
            header: 'Type',
            size: 80
        },
        {
            accessorKey: 'Customer.client_name',
            header: 'Customer',
            size: 80
        },
        {
            accessorKey: 'num_fact',
            header: 'Invoice No',
            size: 80
        },
        {
            header: 'Summary',
            size: 100,
            Cell: ({ row }) => {
                const [summary, setSummary] = useState<{
                    itemCount: number;
                    totalQty: number;
                    SumInv: number;
                    display: string;
                } | null>(null);

                useEffect(() => {
                    const fetchSummary = async () => {
                        try {
                            const result = await getInvoiceSummary(row.original.num_fact);
                            setSummary(result);
                        } catch (error) {
                            console.error('Error loading summary:', error);
                            setSummary({
                                itemCount: 0,
                                totalQty: 0,
                                SumInv: 0,
                                display: 'Error loading summary'
                            });
                        }
                    };

                    fetchSummary();
                }, [row.original.num_fact]);

                return (
                    <Box sx={{
                        backgroundColor: 'rgba(241, 94, 8, 0.28)',
                        p: 0.5,
                        borderRadius: 4,
                        borderColor: 'warning.main',
                        border: 1,
                        color: 'inherit',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5
                    }}>
                        <Box>{summary?.display || 'Loading...'}</Box>
                    </Box>
                );
            }
        },
        {
            accessorKey: 'date_fact',
            header: 'Invoice Date',
            size: 100,
            Cell: ({ cell }) => cell.getValue<string>() ?
                new Date(cell.getValue<string>()).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }) : null
        },
        {
            accessorKey: 'User.name_user',
            header: 'Created By',
            size: 80
        },
        {
            accessorKey: 'IS_OK',
            header: 'Is Closed',
            size: 60,
            Cell: ({ cell }) => cell.getValue() ? 'Yes' : 'No'
        },
        {
            accessorKey: 'COMMENT',
            header: 'Comment',
            size: 80
        },
        {
            accessorKey: 'SourceMark',
            header: 'Marketing Source',
            size: 80
        },
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
    ], []);

    const table = useMaterialReactTable({
        columns,
        data: selectedGroup ? groupedInvoices[selectedGroup] || [] : [],
        state: { isLoading: loading, density: 'compact' },
        enableDensityToggle: true,
        muiTableBodyCellProps: ({ row }) => ({
            sx: {
                color: row.original.IS_OK ? 'success.main' : 'warning.main',
                '&:hover': {
                    color: row.original.IS_OK ? 'success.main' : 'warning.main',
                }
            }
        }),
    });

    return (
        <Box p={2}>
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>

            {loading && progress > 0 && (
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

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" fontWeight="bold">
                    {selectedGroup
                        ? (
                            <>
                                {selectedGroup}-
                                {Type ? (
                                    <>
                                        {Type.charAt(0).toUpperCase() + Type.slice(1)}{' '}
                                        {Type === 'gold' && <span style={{ verticalAlign: 'middle' }}>🥇</span>}
                                        {Type === 'diamond' && <span style={{ verticalAlign: 'middle' }}>💎</span>}
                                        {Type === 'watches' && <span style={{ verticalAlign: 'middle' }}>⌚</span>}
                                    </>
                                ) : null}
                            </>
                        )
                        : 'All Invoices Types'}
                </Typography>
                <Box display="flex" gap={2}>
                    {selectedGroup && (

                        <>
                            <Button
                                variant="outlined"
                                color="inherit"
                                onClick={() => {
                                    setSelectedGroup(null);
                                    setShowInvoiceForm(false);
                                }}
                                startIcon={<ArrowBack />}
                                sx={{ borderRadius: 3, fontWeight: 'bold', px: 3, py: 1 }}
                            >
                                Back
                            </Button>



                        </>
                    )

                    }

                </Box>
            </Box>

            <Divider sx={{ mb: 2, mt: -1 }} />

            {!showInvoiceForm ? (
                !selectedGroup ? (
                    <Box sx={{
                        mt: 5,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                        gap: 2,
                    }}>
                        {Object.entries(groupedInvoices).map(([group, items]) => {
                            const lastMonthAmount = getLastMonthAmount(items);
                            const lastMonthCount = getLastMonthCount(items);

                            return (
                                <Card
                                    key={group}
                                    onClick={() => handleCardClick(group)}
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
                                        <Typography variant="h5" fontWeight="bold" mb={0.5}>
                                            {group}
                                        </Typography>
                                        <Divider sx={{ mb: 2 }} />
                                        <Typography fontSize={14} color="text.secondary" mb={0.5}>
                                            Total Invoices: {items.length}
                                        </Typography>
                                        <Typography fontSize={14} color="text.secondary" mb={0.5}>
                                            Last Month: {lastMonthCount} invoices
                                        </Typography>
                                        <Typography fontSize={14} color="text.secondary">
                                            Amount: {lastMonthAmount.toLocaleString()} LYD
                                        </Typography>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </Box>
                ) : (
                    <MaterialReactTable table={table} />
                )
            ) : (




                <>
                    {Type === 'gold' && <GNew_I />}
                    {/*Type === 'diamond' && <DNew_I num_fact={selectedInvoiceNum ?? undefined} />*/}
                    /  {/*Type === 'watches' && <WNew_I num_fact={selectedInvoiceNum ?? undefined} />*/}

                </>

            )}
        </Box>
    );
};

export default GInvoices;