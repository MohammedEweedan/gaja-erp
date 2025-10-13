import React, { useEffect, useState } from 'react';
import { Autocomplete, Box, TextField, Typography, CircularProgress } from '@mui/material';
import axios from "../api";
import { MaterialReactTable, type MRT_ColumnDef } from 'material-react-table';

interface Client {
    id_client: number;
    client_name: string;
    tel_client: string;
}

interface Invoice {
    num_fact: string;
    date_fact: string;
    total_remise_final: number;
    Client: Client;
    // ...add more fields as needed
}

const CustomersReports = () => {
    const [customers, setCustomers] = useState<Client[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Client | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(false);

    const apiIp = process.env.REACT_APP_API_IP;
    const apiUrlcustomers = `${apiIp}/customers`;
    const apiUrlInvoices = `${apiIp}/invoices`;

    // Fetch customers
    const fetchCustomers = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get<Client[]>(`${apiUrlcustomers}/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCustomers(res.data);
        } catch (error) {}
    };

    // Fetch invoices for selected customer and date range
    const fetchInvoices = async () => {
        if (!selectedCustomer) return;
        setLoading(true);
        const token = localStorage.getItem('token');
        const ps = localStorage.getItem('ps');
        try {
            const res = await axios.get(`/invoices/allDetailsPC`, {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    ps: ps,
                   // id_client: selectedCustomer.id_client,
                    from: periodFrom || undefined,
                    to: periodTo || undefined
                }
            });


            setInvoices(res.data);
        } catch (error) {
            setInvoices([]);
        } finally {
            setLoading(false);
        }
    };

    // Set default periodFrom and periodTo to current date
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const currentDate = `${yyyy}-${mm}-${dd}`;
    const [periodFrom, setPeriodFrom] = useState(currentDate);
    const [periodTo, setPeriodTo] = useState(currentDate);

    useEffect(() => {
        fetchCustomers();
        // eslint-disable-next-line
    }, []);

    useEffect(() => {
        if (selectedCustomer) {
            fetchInvoices();
        } else {
            setInvoices([]);
        }
        // eslint-disable-next-line
    }, [selectedCustomer, periodFrom, periodTo]);

    // Table columns
    const columns: MRT_ColumnDef<Invoice>[] = [
        { accessorKey: 'num_fact', header: 'Invoice No' },
        { accessorKey: 'date_fact', header: 'Date' },
        { accessorKey: 'total_remise_final', header: 'Total', Cell: ({ cell }) => cell.getValue<number>().toLocaleString('en-US', { minimumFractionDigits: 2 }) },
        { accessorKey: 'Client.client_name', header: 'Customer', Cell: ({ row }) => row.original.Client?.client_name || '' },
        { accessorKey: 'Client.tel_client', header: 'Phone', Cell: ({ row }) => row.original.Client?.tel_client || '' },
        // ...add more columns as needed
    ];

    return (
        <Box sx={{ mt: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography variant="h6" sx={{ mr: 2 }}>Customer Reports</Typography>
                <TextField
                    label="From"
                    type="date"
                    size="small"
                    sx={{ width: 140 }}
                    value={periodFrom}
                    onChange={e => setPeriodFrom(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                />
                <TextField
                    label="To"
                    type="date"
                    size="small"
                    sx={{ width: 140 }}
                    value={periodTo}
                    onChange={e => setPeriodTo(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                />
                <Autocomplete
                    id="customer-select"
                    sx={{ width: '25%' }}
                    options={customers}
                    autoHighlight
                    getOptionLabel={(option: Client) => `${option.client_name} (${option.tel_client || 'No Phone'})`}
                    size="small"
                    value={selectedCustomer}
                    onChange={(_, value) => setSelectedCustomer(value)}
                    renderOption={(props: any, option: Client) => (
                        <Box component="li" {...props} key={option.id_client}>
                            <strong>{option.client_name}</strong> — <span style={{ color: 'gray' }}>{option.tel_client || 'No Phone'}</span>
                        </Box>
                    )}
                    renderInput={(params: any) => (
                        <TextField
                            {...params}
                            label="Customer"
                            required
                        />
                    )}
                />
            </Box>
            <Box sx={{ mt: 2 }}>
                {loading ? (
                    <CircularProgress />
                ) : (
                    <MaterialReactTable
                        columns={columns}
                        data={invoices}
                        enableColumnResizing
                        enableStickyHeader
                        initialState={{ pagination: { pageSize: 10, pageIndex: 0 } }}
                        enableFilters={false}
                        enableGlobalFilter={false}
                        enableFullScreenToggle={false}
                    />
                )}
            </Box>
        </Box>
    );
};

export default CustomersReports;
