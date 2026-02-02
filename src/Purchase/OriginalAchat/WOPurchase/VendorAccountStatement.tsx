import { useEffect, useState, useMemo } from 'react';
import axios from "../../../api";
import {
    Box, Typography, Button, TextField, Autocomplete, MenuItem, Divider
} from '@mui/material';
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import EditIcon from '@mui/icons-material/Edit';
import Snackbar from '@mui/material/Snackbar';
import MuiAlert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';

// Types for both models

type Supplier = {
    id_client: number;
    client_name: string;
    TYPE_SUPPLIER?: string;
};

type Vendor = {
    ExtraClient_ID: number;
    Client_Name: string;
};
type SupplierSettlement = {
    id_settlement?: number;
    date_settlement?: string;
    client?: number;
    Debit_Money?: number;
    Credit_Money?: number;
    Debit_Gold?: number;
    Credit_Gold?: number;
    Comment?: string;
    Brand?: number;
    Reference_number?: string;
    currency?: string;
    ExchangeRate?: number; // Added ExchangeRate field
    ExchangeRateToLYD?: number; // Added ExchangeRateToLYD field
    vendor?: Vendor | null;
    retail_price?: number; // Added retail_price field for purchases
    // Add fields for merged data
    id?: string;
    type?: 'payment' | 'purchase' | 'Opening Balance';
    date?: string;
    reference?: string;
    brand?: string | number;
    debit?: number;
    credit?: number;
    netAmountUSD?: number;
    netAmountLYD?: number;
    comment?: string;
    Paidby?: number; // Add paidby for payments
    discount_by_vendor?: number; // Add discount_by_vendor for all settlements
};

const apiUrlPayments = '/Suppliersettlement';
const apiUrlPurchases = '/WOpurchases';
const apiUrlVendors = '/vendors';
const apiUrlBrands = '/suppliers';

const VendorAccountStatement = () => {
    // Filters
    const [from, setFrom] = useState(() => {
        const year = new Date().getFullYear();
        return `${year}-01-01`;
    });
    const [to, setTo] = useState(() => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    });
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [brand, setBrand] = useState<Supplier | null>(null);

    // Data
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [brands, setBrands] = useState<Supplier[]>([]);
    const [rows, setRows] = useState<SupplierSettlement[]>([]);
    const [loading, setLoading] = useState(false);

    // Dialog state for editing payment
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editSettlement, setEditSettlement] = useState<any>(null);
    const [editErrors, setEditErrors] = useState<any>({});
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

    // Local state for exchange rate fields as strings for smooth editing
    const [exchangeRateInput, setExchangeRateInput] = useState('');
    const [exchangeRateToLYDInput, setExchangeRateToLYDInput] = useState('');

    // Add currency list for dropdown (copy from VendorsSettlment or define here)
    const currencyList = [
        { code: 'USD', name: 'US Dollar' },
        { code: 'LYD', name: 'Libyan Dinar' },
        { code: 'EUR', name: 'Euro' },
        { code: 'GBP', name: 'British Pound' },
        { code: 'TRY', name: 'Turkish Lira' },
        { code: 'CNY', name: 'Chinese Yuan' },
        { code: 'AED', name: 'UAE Dirham' },
        { code: 'SAR', name: 'Saudi Riyal' },
        { code: 'TND', name: 'Tunisian Dinar' },
        { code: 'EGP', name: 'Egyptian Pound' },
        { code: 'CHF', name: 'Swiss Franc' },
        { code: 'JPY', name: 'Japanese Yen' },
        { code: 'CAD', name: 'Canadian Dollar' },
        { code: 'AUD', name: 'Australian Dollar' },
        { code: 'SDG', name: 'Sudanese Pound' },
        { code: 'MAD', name: 'Moroccan Dirham' },
        { code: 'KWD', name: 'Kuwaiti Dinar' },
        { code: 'QAR', name: 'Qatari Riyal' },
        { code: 'OMR', name: 'Omani Rial' },
        { code: 'BHD', name: 'Bahraini Dinar' },
        { code: 'JOD', name: 'Jordanian Dinar' },
        { code: 'ILS', name: 'Israeli Shekel' },
        { code: 'RUB', name: 'Russian Ruble' },
        { code: 'INR', name: 'Indian Rupee' },
        { code: 'PKR', name: 'Pakistani Rupee' },
        { code: 'SDR', name: 'IMF Special Drawing Rights' },
    ];

    // Add suppliers state for dialog (like VendorsSettlment)
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);

    // Fetch vendors and brands for filters (run only once)
    useEffect(() => {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        axios.get(`${apiUrlVendors}/all`, { headers }).then(res => {
            setVendors(res.data);
        });
        axios.get(`${apiUrlBrands}/all`, { headers }).then(res => {
            const filtered = res.data.filter(
                (supplier: Supplier) => supplier.TYPE_SUPPLIER?.toLowerCase().includes('watche')
            );
            setBrands(filtered);
        });
        fetchSuppliers(); // Fetch suppliers for dialog
    }, []);

    // Fetch suppliers for dialog (copy logic from VendorsSettlment)
    const fetchSuppliers = async () => {
        const apiUrlsuppliers = "/suppliers";
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get<Supplier[]>(`${apiUrlsuppliers}/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const goldSuppliers = res.data.filter(supplier =>
                supplier.TYPE_SUPPLIER?.toLowerCase().includes('watche')
            );
            setSuppliers(goldSuppliers);
        } catch (error) {
            // handle error if needed
        }
    };

    // Fetch and merge payments and purchases
    const fetchData = async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        try {
            // Payments
            const paymentsRes = await axios.get(`${apiUrlPayments}/all`, { headers: { Authorization: `Bearer ${token}` } });
            // Purchases
            const purchasesRes = await axios.get(`${apiUrlPurchases}/all`, { headers: { Authorization: `Bearer ${token}` } });
            // Map and merge
            const payments: SupplierSettlement[] = paymentsRes.data.map((p: any) => ({
                id: 'pay-' + p.id_settlement,
                type: 'payment',
                date: p.date_settlement,
                reference: p.Reference_number,
                vendor: vendors.find(v => v.ExtraClient_ID === p.Brand)?.Client_Name || p.Brand,
                brand: brands.find(b => b.id_client === p.client)?.client_name || p.client,
                debit: Number(-1 * p.Debit_Money) || 0, // payment is always debit (money out)
                credit: 0,
                currency: p.currency,
                comment: p.Comment,
                ExchangeRate: p.ExchangeRate,
                ExchangeRateToLYD: p.ExchangeRateToLYD,
                netAmountUSD: -1 * ((Number(p.Debit_Money) - Number(p.Credit_Money)) * (Number(p.ExchangeRate) || 1)),
                netAmountLYD: -1 * ((Number(p.Debit_Money) - Number(p.Credit_Money)) * (Number(p.ExchangeRate) || 1) * (Number(p.ExchangeRateToLYD) || 1)),
                Paidby: p.Paidby, // Add paidby field
                discount_by_vendor: p.discount_by_vendor || 0, // Ensure discount_by_vendor is mapped
            }));
            const purchases: SupplierSettlement[] = purchasesRes.data.map((p: any) => ({
                id: 'pur-' + p.id_achat,
                type: 'purchase',
                date: p.Date_Achat,
                reference: p.reference_number || '',
                vendor: vendors.find(v => v.ExtraClient_ID === p.vendorsID)?.Client_Name || p.vendorsID,
                brand: brands.find(b => b.id_client === p.Brand)?.client_name || p.Brand,
                debit: Number(p.retail_price) || 0,
                credit: 0,
                currency: p.currencyRetail || '',
                comment: p.Comment_Achat || '',
                ExchangeRate: p.reaRetail,
                ExchangeRateToLYD: p.RateToLYD,
                netAmountUSD: Math.abs((Number(p.retail_price) || 0) * (Number(p.reaRetail) || 1)),
                netAmountLYD: Math.abs((Number(p.retail_price) || 0) * (Number(p.reaRetail) || 1) * (Number(p.RateToLYD) || 1)),
                discount_by_vendor: p.discount_by_vendor || 0, // Ensure discount_by_vendor is mapped
            }));
            // Merge all
            let merged = [...payments, ...purchases];
            // Require both dates and vendor
            if (!from || !to || !vendor) {
                setRows([]);
                setLoading(false);
                return;
            }
            // Filter for selected vendor/brand
            let filtered = merged.filter(r =>
                (r as any).vendor === vendor.Client_Name ||
                (r as any).Paidby === vendor.ExtraClient_ID
            );
            if (brand) {
                filtered = filtered.filter(r => (r as any).brand === brand.client_name);
            }
            // Opening balance: all data before 'from'
            const openingRows = filtered.filter(r => (r as any).date < from);
            const openingUSD = openingRows.reduce((sum, r) => sum + (Number(r.netAmountUSD) || 0), 0);
            const openingLYD = openingRows.reduce((sum, r) => sum + (Number(r.netAmountLYD) || 0), 0);
            // Data between 'from' and 'to'
            const mainRows = filtered.filter(r => (r as any).date >= from && (r as any).date <= to);
            // Sort by date
            mainRows.sort((a, b) => ((a as any).date > (b as any).date ? 1 : -1));
            // Synthetic opening balance row
            const openingRow: SupplierSettlement = {
                id: 'opening-balance',
                type: 'Opening Balance',
                date: from,
                reference: '',
                vendor: undefined, // Vendor type or undefined
                brand: undefined, // Brand type or undefined
                debit: 0,
                credit: 0,
                currency: '',
                comment: 'Opening Balance',
                ExchangeRate: 1,
                ExchangeRateToLYD: 1,
                netAmountUSD: 0,
                netAmountLYD: 0,
            };
            // Set rows: opening row + mainRows
            setRows([openingRow, ...mainRows]);
            // Store opening balances in state for use in running balance
            setOpeningBalances({ USD: openingUSD, LYD: openingLYD });
        } finally {
            setLoading(false);
        }
    };

    // Store opening balances in state
    const [openingBalances, setOpeningBalances] = useState<{ USD: number; LYD: number }>({ USD: 0, LYD: 0 });

    // Calculate running balances for each row, starting from opening balance
    const rowsWithBalance = useMemo(() => {
        let balanceAmount = 0;
        let balanceUSD = openingBalances.USD;
        let balanceLYD = openingBalances.LYD;
        return rows.map(row => {
            if (row.id === 'opening-balance') {
                return { ...row, balanceUSD, balanceLYD, balanceAmount };
            }
            // Use Debit_Money/Credit_Money if present, else fallback to debit/credit
            const debit = row.Debit_Money !== undefined ? Number(row.Debit_Money) : (Number(row.debit) || 0);
            const credit = row.Credit_Money !== undefined ? Number(row.Credit_Money) : (Number(row.credit) || 0);
            const discount = row.discount_by_vendor !== undefined ? Number(row.discount_by_vendor) : 0;
            let adjDebit = debit;
            let adjCredit = credit;
            // Only subtract discount from debit for purchases (credit for payments is always 0)
            if (row.type === 'purchase') {
                adjDebit = debit - discount;
            } else if (row.type === 'payment') {
                adjDebit = debit; // payments: discount is not subtracted from debit
            }
            // Net amounts (USD/LYD) should use adjusted debit
            const netUSD = ((adjDebit - adjCredit) * (Number(row.ExchangeRate) || 1));
            const netLYD = ((adjDebit - adjCredit) * (Number(row.ExchangeRate) || 1) * (Number(row.ExchangeRateToLYD) || 1));
            balanceAmount += (adjDebit - adjCredit);
            balanceUSD += netUSD;
            balanceLYD += netLYD;
            return { ...row, balanceUSD, balanceLYD, balanceAmount, netAmountUSD: netUSD, netAmountLYD: netLYD };
        });
    }, [rows, openingBalances]);

    // Edit button handler (fix property names, use only correct state)
    const handleEditPayment = (row: SupplierSettlement) => {
        setEditSettlement({
            ...row,
            Reference_number: row.reference || row.Reference_number || '',
            date_settlement: row.date || row.date_settlement || '',
            Debit_Money: row.debit ?? row.Debit_Money ?? 0,
            Credit_Money: row.credit ?? row.Credit_Money ?? 0,
            Debit_Gold: row.Debit_Gold ?? 0,
            Credit_Gold: row.Credit_Gold ?? 0,
            Comment: row.comment ?? row.Comment ?? '',
            Brand: vendors.find(v => v.Client_Name === (row.vendor || ''))?.ExtraClient_ID || row.Brand || 0,
            client: suppliers.find(s => s.client_name === (row.brand || ''))?.id_client || row.client || 0,
            currency: row.currency || '',
            ExchangeRate: row.ExchangeRate ?? 1,
            ExchangeRateToLYD: row.ExchangeRateToLYD ?? 1,
        });
        setEditDialogOpen(true);
        setEditErrors({});
        setExchangeRateInput(row.ExchangeRate !== undefined ? String(row.ExchangeRate) : '1');
        setExchangeRateToLYDInput(row.ExchangeRateToLYD !== undefined ? String(row.ExchangeRateToLYD) : '1');
    };
    const handleCloseEditDialog = () => {
        setEditDialogOpen(false);
        setEditSettlement(null);
        setEditErrors({});
    };
    // Validation for edit dialog
    const validateForm = () => {
        const newErrors: any = {};
        if (!editSettlement?.Reference_number) newErrors.Reference_number = 'Reference Number is required';
        if (!editSettlement?.date_settlement) newErrors.date_settlement = 'Date is required';
        if (!editSettlement?.client) newErrors.client = 'Supplier is required';

        if (!editSettlement?.Brand) newErrors.Brand = 'Vendor must be selected';
        if (!editSettlement?.currency) newErrors.currency = 'Currency is required';
        if (!editSettlement?.ExchangeRate || editSettlement.ExchangeRate <= 0) newErrors.ExchangeRate = 'Exchange Rate must be a positive number';
        if (!editSettlement?.ExchangeRateToLYD || editSettlement.ExchangeRateToLYD <= 0) newErrors.ExchangeRateToLYD = 'Exchange Rate To LYD must be a positive number';
        setEditErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    // Save changes (PUT request)
    const handleSaveEdit = async () => {
        if (!validateForm() || !editSettlement) return;
        const token = localStorage.getItem('token');
        try {
            await axios.put(`${apiUrlPayments}/Update/${editSettlement.id?.replace('pay-', '') || editSettlement.id_settlement}`, editSettlement, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSnackbar({ open: true, message: 'Changes saved successfully', severity: 'success' });
            setEditDialogOpen(false);
            setEditSettlement(null);
            fetchData();
        } catch (error: any) {
            setSnackbar({ open: true, message: error.response?.data?.message || 'Save failed', severity: 'error' });
        }
    };

    // Columns
    const columns = useMemo<MRT_ColumnDef<SupplierSettlement & { balanceUSD: number; balanceLYD: number; balanceAmount: number; }>[]>(() => [
        {
            header: 'Type / Date / Reference',
            id: 'type_date_reference',
            size: 180,
            Cell: ({ row }) => {
                const type = row.original.type === 'payment' ? 'Payment' : row.original.type === 'purchase' ? 'Purchase' : row.original.type === 'Opening Balance' ? 'Opening Balance' : '';
                const date = row.original.date;
                const reference = row.original.reference;
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <span style={{ fontWeight: 500 }}><span style={{ color: '#888', fontSize: 12 }}>Type:</span> {type}</span>
                        <span style={{ fontWeight: 500 }}><span style={{ color: '#888', fontSize: 12 }}>Date:</span> {date}</span>
                        <span style={{ fontWeight: 500 }}><span style={{ color: '#888', fontSize: 12 }}>Reference:</span> {reference}</span>
                    </Box>
                );
            },
        },
        {
            header: 'Brand / Vendor',
            id: 'brand_vendor',
            size: 160,
            Cell: ({ row }) => {
                // Brand can be string or number, vendor can be string or Vendor object
                let brand = row.original.brand;
                let vendorLabel: string = '';
                const vendor = row.original.vendor;
                if (typeof vendor === 'object' && vendor !== null && 'Client_Name' in vendor) {
                    vendorLabel = vendor.Client_Name;
                } else if (typeof vendor === 'string' || typeof vendor === 'number') {
                    vendorLabel = String(vendor);
                }
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <span style={{ fontWeight: 500 }}><span style={{ color: '#888', fontSize: 12 }}>Brand:</span> {brand}</span>
                        <span style={{ fontWeight: 500 }}><span style={{ color: '#888', fontSize: 12 }}>Vendor:</span> {vendorLabel}</span>
                    </Box>
                );
            },
        },
       
        {
            accessorKey: 'credit',
            header: 'Debit / Credit / Discount',
            size: 140,
            Cell: ({ row }) => {
                const type = row.original.type;
                let debit = 0;
                let credit = 0;
                let discount = row.original.discount_by_vendor !== undefined ? Number(row.original.discount_by_vendor) : 0;
                if (type === 'payment') {
                    debit = Number((row.original as any).debit) || 0;
                } else if (type === 'purchase') {
                    credit = Number((row.original as any).debit) || 0;
                }
                // Hide the cell if all are zero
                if (!debit && !credit && !discount) return '';
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        {debit !== 0 && (
                            <span><span style={{ color: '#888', fontSize: 12 }}>Debit:</span> {debit.toLocaleString(undefined, { minimumFractionDigits: 2 })} {row.original.currency}</span>
                        )}
                        {credit !== 0 && (
                            <span><span style={{ color: '#888', fontSize: 12 }}>Credit:</span> {credit.toLocaleString(undefined, { minimumFractionDigits: 2 })} {row.original.currency}</span>
                        )}
                        {discount !== 0 && (
                            <span style={{ color: '#d84315', fontSize: 12 }}>
                                <span style={{ color: '#888', fontSize: 12 }}>Discount:</span> {discount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {row.original.currency}
                            </span>
                        )}
                    </Box>
                );
            }
        },
        {
            accessorKey: 'balanceAmount', header: 'Balance (Amount)', size: 120,
            Cell: ({ cell, row }) => cell.getValue() !== undefined ? Number(cell.getValue()).toLocaleString(undefined, { minimumFractionDigits: 2 }) + ' ' + (row.original.currency || '') : '',
            muiTableBodyCellProps: { sx: { fontWeight: 'bold', color: 'violet', backgroundColor: 'inherit' } }
        },
        
        {
            accessorKey: 'netAmountUSD', header: 'Net Amount (USD)',

            size: 120, Cell: ({ cell }) => cell.getValue() ?
                Number(cell.getValue()).toLocaleString(undefined, { minimumFractionDigits: 2 }) + ' USD' : ''
        },

        { accessorKey: 'balanceUSD', header: 'Balance (USD)', size: 120, Cell: ({ cell }) => cell.getValue() ? Number(cell.getValue()).toLocaleString(undefined, { minimumFractionDigits: 2 }) + ' USD' : '', muiTableBodyCellProps: { sx: { fontWeight: 'bold', color: '#1976d2', backgroundColor: 'inherit' } } },
        { accessorKey: 'netAmountLYD', header: 'Net Amount (LYD)', size: 120, Cell: ({ cell }) => cell.getValue() ? Number(cell.getValue()).toLocaleString(undefined, { minimumFractionDigits: 2 }) + ' LYD' : '' },
        { accessorKey: 'balanceLYD', header: 'Balance (LYD)', size: 120, Cell: ({ cell }) => cell.getValue() ? Number(cell.getValue()).toLocaleString(undefined, { minimumFractionDigits: 2 }) + ' LYD' : '', muiTableBodyCellProps: { sx: { fontWeight: 'bold', color: '#388e3c', backgroundColor: 'inherit' } } },
        {
            accessorKey: 'paidby', header: 'Paid By', size: 120, Cell: ({ row }) => {
                // Show name if possible
                if (row.original.type === 'payment' && row.original.Paidby) {
                    const paidByVendor = vendors.find(v => v.ExtraClient_ID === row.original.Paidby);
                    return paidByVendor ? paidByVendor.Client_Name : row.original.Paidby;
                }
                return '';
            }
        },


        { accessorKey: 'comment', header: 'Comment', size: 200, Cell: ({ row }) => {
            const comment = row.original.comment || row.original.Comment || '';
            if (!comment) return '';
            return (
                <Box sx={{ background: 'inherit', borderRadius: 1, p: 1, whiteSpace: 'pre-line', fontSize: 13, maxWidth: 320 }}>
                    {comment}
                </Box>
            );
        } },
    ], [vendors, brands, handleEditPayment]);

    const table = useMaterialReactTable({
        columns,
        data: rowsWithBalance,
        state: { isLoading: loading, density: 'compact' },
        enableDensityToggle: false,
        enableColumnFilters: false,
        enableGlobalFilter: false,
        enableFullScreenToggle: false,
        enableHiding: false,
        enableSorting: false, // Disable all sorting globally
        muiTableBodyRowProps: ({ row }) =>
            row.original.id === 'opening-balance'
                ? {
                    sx: { background: '#e3f2fd' },
                }
                : {},
        muiTableBodyCellProps: ({ row, cell, table }) => {
            if (row.original.id === 'opening-balance') {
                if (cell.column.id === 'date') {
                    // Show date and both opening balances
                    return {
                        colSpan: table.getAllColumns().length,
                        align: 'center',
                        sx: { fontWeight: 'bold', fontSize: 16 },
                        children: `Opening Balance on : ${row.original.date} | USD: ${Number(openingBalances.USD).toLocaleString(undefined, { minimumFractionDigits: 2 })} | LYD: ${Number(openingBalances.LYD).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                    };
                } else {
                    return { style: { display: 'none' } };
                }
            }
            return {};
        },
    });

    // Auto-refresh data when filters change
    useEffect(() => {
        fetchData();
        // eslint-disable-next-line
    }, [from, to, vendor, brand]);

    // Helper to format date as dd-MMM-yyyy
    function formatDateDDMMMYYYY(dateStr: string | undefined): string {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = String(d.getDate()).padStart(2, '0');
        const month = d.toLocaleString('en-US', { month: 'short' });
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    }
    // Export table to HTML file
    const handleExportToHTML = () => {
        // Use columns from closure
        const exportColumns = columns as any[];
        // Build HTML string
        let html = `<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Vendor Account Statement</title><style>
            body { font-family: Arial, sans-serif; background: #f7fafd; }
            .header-row { display: flex; align-items: center; justify-content: space-between; background: #1565c0; color: #fff; padding: 24px 32px 18px 32px; border-radius: 12px 12px 0 0; box-shadow: 0 2px 8px #0001; margin-bottom: 0; }
            .header-left { display: flex; align-items: center; gap: 18px; }
            .header-logo { height: 70px; border-radius: 8px; background: #fff; box-shadow: 0 1px 4px #0002; padding: 6px; }
            .header-right { text-align: right; }
            .header-title { font-size: 2.2rem; font-weight: 700; letter-spacing: 1px; margin-bottom: 2px; }
            .header-subtitle { font-size: 1.15rem; font-weight: 500; color: #e3f2fd; margin-bottom: 2px; }
            .header-period { font-size: 1rem; color: #bbdefb; }
            .info-table { margin: 18px auto 24px auto; border-collapse: collapse; background: #fff; border-radius: 0 0 12px 12px; box-shadow: 0 1px 6px #0001; }
            .info-table td { padding: 7px 18px; font-size: 14px; border: none; }
            .info-table tr td:first-child { font-weight: bold; color: #1976d2; }
            table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; background: #fff; box-shadow: 0 2px 8px #0001; border-radius: 12px; overflow: hidden; }
            th, td { border: 1px solid #bbb; padding: 4px 7px; text-align: center; font-size: 12px; }
            th { background: #1976d2; color: #fff; font-size: 13px; }
            .opening-row { background: #e3f2fd; font-weight: bold; font-size: 13px; }
            .summary-row { background: #f5f5f5; font-weight: bold; }
            .note-section { margin-top: 36px; background: #fffde7; border: 1px solid #ffe082; border-radius: 10px; padding: 18px 24px; color: #795548; font-size: 13px; box-shadow: 0 1px 4px #0001; }
        </style></head><body>`;
        html += `<div class='header-row'>`;
        html += `<div class='header-left'><img src='logo.png' class='header-logo' alt='Gaja Group Logo' /></div>`;
        html += `<div class='header-right'>`;
        html += `<div class='header-title'>Gaja Group</div>`;
        html += `<div class='header-subtitle'>Vendor Account Statement</div>`;
        html += `<div class='header-period'>${formatDateDDMMMYYYY(from)} to ${formatDateDDMMMYYYY(to)}</div>`;
        html += `</div>`;
        html += `</div>`;
        // Info section
        html += `<table class='info-table'>`;
        html += `<tr><td>Vendor:</td><td>${vendor ? vendor.Client_Name : '-'}</td></tr>`;
        html += `<tr><td>Brand:</td><td>${brand ? brand.client_name : '-'}</td></tr>`;
        html += `<tr><td>Period:</td><td>${formatDateDDMMMYYYY(from)} to ${formatDateDDMMMYYYY(to)}</td></tr>`;
        html += `</table>`;
        html += `<table>`;
        // Table header
        html += '<tr>';
        exportColumns.forEach((col: any) => {
            html += `<th>${typeof col.header === 'string' ? col.header : ''}</th>`;
        });
        html += '</tr>';
        // Table body
        rowsWithBalance.forEach((row, idx) => {
            if (row.id === 'opening-balance') {
                html += `<tr class='opening-row'><td colspan='${exportColumns.length}'>Opening Balance on : ${formatDateDDMMMYYYY(row.date)} | USD: ${Number(openingBalances.USD).toLocaleString(undefined, { minimumFractionDigits: 2 })} | LYD: ${Number(openingBalances.LYD).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>`;
            } else {
                html += '<tr>';
                exportColumns.forEach((col: any) => {
                    let val = row[col.accessorKey as keyof typeof row];
                    if (col.accessorKey === 'date' && val) val = formatDateDDMMMYYYY(val as string);
                    if (col.accessorKey === 'balanceUSD' && val !== undefined && val !== null) val = Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 }) + ' USD';
                    if (col.accessorKey === 'balanceLYD' && val !== undefined && val !== null) val = Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 }) + ' LYD';
                    if (col.accessorKey === 'netAmountUSD' && val !== undefined && val !== null) val = Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 }) + ' USD';
                    if (col.accessorKey === 'netAmountLYD' && val !== undefined && val !== null) val = Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 }) + ' LYD';
                    if (col.accessorKey === 'balanceAmount' && val !== undefined && val !== null) val = Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 }) + ' ' + row.currency;
                    html += `<td>${val !== undefined && val !== null ? val : ''}</td>`;
                });
                html += '</tr>';
            }
        });
        // Summary row
        html += `<tr class='summary-row'><td colspan='${exportColumns.length - 1}' style='text-align:right;'>Final Balance (USD):</td><td>${rowsWithBalance.length > 0 ? Number(rowsWithBalance[rowsWithBalance.length - 1].balanceUSD).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'} USD</td></tr>`;
        html += `<tr class='summary-row'><td colspan='${exportColumns.length - 1}' style='text-align:right;'>Final Balance (LYD):</td><td>${rowsWithBalance.length > 0 ? Number(rowsWithBalance[rowsWithBalance.length - 1].balanceLYD).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'} LYD</td></tr>`;
        html += `<tr class='summary-row'><td colspan='${exportColumns.length - 1}' style='text-align:right;'>Final Balance (Amount):</td><td>${rowsWithBalance.length > 0 ? Number(rowsWithBalance[rowsWithBalance.length - 1].balanceAmount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'} ${rowsWithBalance.length > 0 ? rowsWithBalance[rowsWithBalance.length - 1].currency : ''}</td></tr>`;
        // Closing balance row on 'date' at bottom
        if (rowsWithBalance.length > 0) {
            const lastRow = rowsWithBalance[rowsWithBalance.length - 1];
            html += `<tr class='summary-row'><td colspan='${exportColumns.length}'>Closing Balance as of ${formatDateDDMMMYYYY(lastRow.date || to)}: USD: ${Number(lastRow.balanceUSD).toLocaleString(undefined, { minimumFractionDigits: 2 })} | LYD: ${Number(lastRow.balanceLYD).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>`;
        }
        html += '</table>';
        // International standard note section
        html += `<div class='note-section'>
        <b>Note:</b> This statement is generated based on the records available as of the date indicated. If you believe there is any discrepancy, error, or require clarification, please contact our finance department within 15 days of receipt. This statement is prepared in accordance with international accounting standards and is intended solely for the recipient. The balances shown are subject to reconciliation and audit. Gaja Group is not liable for any errors or omissions unless notified in writing within the specified period. For further information or clarification, please refer to your account manager or email <a href='mailto:finance@gaja.ly'>accounts@gajagroup.com</a>.
        </div>`;
        html += '</body></html>';
        // Download
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `VendorAccountStatement_${from}_to_${to}.html`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', mb: 2, flexWrap: 'wrap' }}>
                <Typography color="text.primary" variant="h5" sx={{ fontWeight: 'bold', mr: 2, mb: { xs: 1, sm: 0 } }}>
                    Vendor Account Statement
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', ml: 2 }}>
                    <TextField
                        label="From"
                        type="date"
                        size="small"
                        value={from}
                        onChange={e => setFrom(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ minWidth: 120, maxWidth: 140 }}
                    />
                    <TextField
                        label="To"
                        type="date"
                        size="small"
                        value={to}
                        onChange={e => setTo(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ minWidth: 120, maxWidth: 140 }}
                    />
                    <Autocomplete
                        options={vendors}
                        getOptionLabel={option => option.Client_Name}
                        value={vendor}
                        size="small"
                        onChange={(_e, v) => setVendor(v)}
                        renderInput={params => <TextField {...params} label="Vendor" size="small" sx={{ minWidth: 260, maxWidth: 340 }} />}
                        sx={{ minWidth: 260, maxWidth: 340 }}
                    />
                    <Autocomplete
                        options={brands}
                        getOptionLabel={option => option.client_name}
                        value={brand}
                        size="small"
                        onChange={(_e, v) => setBrand(v)}
                        renderInput={params => <TextField {...params} label="Brand" size="small" sx={{ minWidth: 260, maxWidth: 340 }} />}
                        sx={{ minWidth: 260, maxWidth: 340 }}
                    />
                    <Button variant="contained"
                        color="info"
                        onClick={fetchData}
                    >
                        Preview
                    </Button>

                    <Button variant="outlined" color="primary" sx={{ mb: { xs: 1, sm: 0 } }} onClick={handleExportToHTML}>
                        Export to HTML
                    </Button>
                </Box>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Box>
                <MaterialReactTable
                    table={table}
                />
                {/* Final balances summary below the table */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, gap: 4 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                        Final Balance (Amount): {rowsWithBalance.length > 0 ? Number(rowsWithBalance[rowsWithBalance.length - 1].balanceAmount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'} {rowsWithBalance.length > 0 ? rowsWithBalance[rowsWithBalance.length - 1].currency : ''}
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                        Final Balance (USD): {rowsWithBalance.length > 0 ? Number(rowsWithBalance[rowsWithBalance.length - 1].balanceUSD).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'} USD
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#388e3c' }}>
                        Final Balance (LYD): {rowsWithBalance.length > 0 ? Number(rowsWithBalance[rowsWithBalance.length - 1].balanceLYD).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'} LYD
                    </Typography>
                </Box>
                <style>{`
          .MuiTableCell-root {
            padding-top: 4px !important;
            padding-bottom: 4px !important;
            padding-left: 6px !important;
            padding-right: 6px !important;
            font-size: 13px !important;
          }
        `}</style>
            </Box>
            {/* Edit Payment Dialog - VendorsSettlment style */}
            <Dialog open={editDialogOpen} onClose={handleCloseEditDialog}    >
                <DialogTitle>Edit Payment</DialogTitle>
                <Divider />
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                        {/* Group 1: Reference Number, Date, Vendor, Supplier */}
                        <Box sx={{ display: 'flex', gap: 2, border: '1px solid #e0e0e0', borderRadius: 2, p: 2, mb: 2, flexWrap: 'wrap' }}>
                            <TextField
                                label="Reference Number"
                                fullWidth
                                value={editSettlement?.Reference_number || ''}
                                onChange={(e) => setEditSettlement({ ...editSettlement!, Reference_number: e.target.value })}
                                error={!!editErrors.Reference_number}
                                helperText={editErrors.Reference_number}
                                sx={{ flex: 1, minWidth: 180 }}
                            // required
                            />
                            <TextField
                                label="Date"
                                type="date"
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                                value={editSettlement?.date_settlement || ''}
                                onChange={(e) => setEditSettlement({ ...editSettlement!, date_settlement: e.target.value })}
                                error={!!editErrors.date_settlement}
                                helperText={editErrors.date_settlement}
                                sx={{ flex: 1, minWidth: 180 }}
                            // required
                            />
                            <Autocomplete
                                id="vendors-select"
                                options={vendors}
                                autoHighlight
                                getOptionLabel={(option) => option.Client_Name}
                                value={vendors.find(v => v.ExtraClient_ID === editSettlement?.Brand) || null}
                                onChange={(_event, newValue) => {
                                    setEditSettlement((prev: typeof editSettlement) => prev && ({
                                        ...prev,
                                        Brand: newValue ? newValue.ExtraClient_ID : -1
                                    }));
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label={<span style={{ color: editErrors.Brand ? '#d32f2f' : undefined }}>Vendor</span>}
                                        // required
                                        error={!!editErrors.Brand}
                                        sx={!!editErrors.Brand ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
                                        helperText={editErrors.Brand}
                                    />
                                )}
                                sx={{ flex: 1, minWidth: 180 }}
                            />
                            <Autocomplete
                                id="suppliers-select"
                                options={suppliers}
                                autoHighlight
                                getOptionLabel={(option) => option.client_name}
                                value={suppliers.find(v => v.id_client === editSettlement?.client) || null}
                                onChange={(_event, newValue) => {
                                    setEditSettlement((prev: any) => prev && ({
                                        ...prev,
                                        client: newValue ? newValue.id_client : -1,
                                    }));
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label={<span style={{ color: editErrors.Brand ? '#d32f2f' : undefined }}>Supplier</span>}
                                        // required
                                        error={!!editErrors.Brand}
                                        sx={!!editErrors.Brand ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
                                        helperText={editErrors.Brand}
                                    />
                                )}
                                sx={{ flex: 1, minWidth: 180 }}
                            />
                        </Box>

                        {/* Group 2: Debit/Credit Money, Currency, Exchange Rate */}
                        <Box sx={{ display: 'flex', gap: 2, border: '1px solid #e0e0e0', borderRadius: 2, p: 2, mb: 2, flexWrap: 'wrap' }}>



                            <TextField
                                label="Currency"
                                select
                                fullWidth
                                value={editSettlement?.currency || ''}
                                onChange={(e) => setEditSettlement({ ...editSettlement!, currency: e.target.value })}
                                error={!!editErrors.currency}
                                helperText={editErrors.currency}
                                sx={{ flex: 1, minWidth: 180 }}
                            >
                                {currencyList.map(currency => (
                                    <MenuItem key={currency.code} value={currency.code}>{currency.code} - {currency.name}</MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                label="Exchange Rate"
                                type="number"
                                error={!!editErrors.ExchangeRate}
                                helperText={editErrors.ExchangeRate}
                                fullWidth
                                value={exchangeRateInput}
                                onChange={(e) => {
                                    setExchangeRateInput(e.target.value);
                                    setEditSettlement({ ...editSettlement!, ExchangeRate: Number(e.target.value) });
                                }}
                                onBlur={() => {
                                    if (exchangeRateInput !== '') {
                                        const val = Number(exchangeRateInput);
                                        setExchangeRateInput(val.toFixed(3));
                                        setEditSettlement({ ...editSettlement!, ExchangeRate: Number(val.toFixed(3)) });
                                    }
                                }}
                                sx={{ flex: 1, minWidth: 180 }}
                            />

                            <TextField
                                label="Debit (Money)"
                                type="number"
                                fullWidth
                                error={!!editErrors.Debit_Money}
                                helperText={editErrors.Debit_Money}
                                value={editSettlement?.Debit_Money || 0}
                                onChange={(e) => setEditSettlement({ ...editSettlement!, Debit_Money: Number(e.target.value) })}
                                sx={{ flex: 1, minWidth: 180 }}
                            />
                            <TextField
                                label="Debit (Money) x Exchange Rate"
                                value={
                                    editSettlement && editSettlement.ExchangeRate && editSettlement.Debit_Money
                                        ? (Number(editSettlement.Debit_Money) * Number(editSettlement.ExchangeRate)).toFixed(2)
                                        : ''
                                }
                                InputProps={{ readOnly: true }}
                                fullWidth
                                sx={{ flex: 1, minWidth: 180 }}
                            />
                            <TextField
                                label="Credit (Money)"
                                type="number"
                                fullWidth
                                error={!!editErrors.Credit_Money}
                                helperText={editErrors.Credit_Money}
                                value={editSettlement?.Credit_Money || 0}
                                onChange={(e) => setEditSettlement({ ...editSettlement!, Credit_Money: Number(e.target.value) })}
                                sx={{ flex: 1, minWidth: 180 }}
                            />
                            <TextField
                                label="Credit (Money) x Exchange Rate"
                                value={
                                    editSettlement && editSettlement.ExchangeRate && editSettlement.Credit_Money
                                        ? (Number(editSettlement.Credit_Money) * Number(editSettlement.ExchangeRate)).toFixed(2)
                                        : ''
                                }
                                InputProps={{ readOnly: true }}
                                fullWidth
                                sx={{ flex: 1, minWidth: 180 }}
                            />
                            <TextField
                                label="Exchange Rate To LYD"
                                type="number"
                                error={!!editErrors.ExchangeRateToLYD}
                                helperText={editErrors.ExchangeRateToLYD}
                                fullWidth
                                value={exchangeRateToLYDInput}
                                onChange={(e) => {
                                    setExchangeRateToLYDInput(e.target.value);
                                    setEditSettlement({ ...editSettlement!, ExchangeRateToLYD: Number(e.target.value) });
                                }}
                                onBlur={() => {
                                    if (exchangeRateToLYDInput !== '') {
                                        const val = Number(exchangeRateToLYDInput);
                                        setExchangeRateToLYDInput(val.toFixed(3));
                                        setEditSettlement({ ...editSettlement!, ExchangeRateToLYD: Number(val.toFixed(3)) });
                                    }
                                }}
                                sx={{ flex: 1, minWidth: 180 }}
                            />
                            <TextField
                                label="Net Amount (LYD)"
                                value={
                                    editSettlement && editSettlement.ExchangeRateToLYD !== undefined
                                        ? ((Number(editSettlement.Debit_Money) - Number(editSettlement.Credit_Money)) * Number(editSettlement.ExchangeRate) * Number(editSettlement.ExchangeRateToLYD)).toFixed(2)
                                        : ''
                                }
                                InputProps={{ readOnly: true }}
                                fullWidth
                                sx={{ flex: 1, minWidth: 180 }}
                            />
                        </Box>

                        {/* Group 3: Debit/Credit Gold */}
                        <Box sx={{ display: 'flex', gap: 2, border: '1px solid #e0e0e0', borderRadius: 2, p: 2, mb: 2, flexWrap: 'wrap' }}>
                            <TextField
                                label="Debit (Gold)"
                                type="number"
                                fullWidth
                                error={!!editErrors.Debit_Gold}
                                helperText={editErrors.Debit_Gold}
                                value={editSettlement?.Debit_Gold || ''}
                                onChange={(e) => setEditSettlement({ ...editSettlement!, Debit_Gold: Number(e.target.value) })}
                                sx={{ flex: 1, minWidth: 180 }}

                            />
                            <TextField
                                label="Credit (Gold)"
                                required
                                type="number"
                                error={!!editErrors.Credit_Gold}
                                helperText={editErrors.Credit_Gold}
                                fullWidth
                                value={editSettlement?.Credit_Gold || ''}
                                onChange={(e) => setEditSettlement({ ...editSettlement!, Credit_Gold: Number(e.target.value) })}
                                sx={{ flex: 1, minWidth: 180 }}
                            />
                        </Box>

                        {/* Group 4: Comment as TextArea */}
                        <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 2, p: 2, mb: 2 }}>
                            <TextField
                                label="Comment"
                                fullWidth
                                multiline
                                minRows={3}
                                value={editSettlement?.Comment || ''}
                                onChange={(e) => setEditSettlement({ ...editSettlement!, Comment: e.target.value })}
                            />
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseEditDialog} color="secondary">Cancel</Button>
                    <Button onClick={handleSaveEdit} color="primary" variant="contained">Save Changes</Button>
                </DialogActions>
            </Dialog>
            {/* Snackbar for feedback */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <MuiAlert elevation={6} variant="filled" onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </MuiAlert>
            </Snackbar>
        </Box>
    );
};

export default VendorAccountStatement;