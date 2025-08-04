import React, { useEffect, useState } from 'react';
import { Box, Typography, TextField, Button } from '@mui/material';
import { MaterialReactTable, MRT_ColumnDef } from 'material-react-table';
import axios from 'axios';
import Autocomplete from '@mui/material/Autocomplete';
type Client = {
    id_client: number;
    client_name: string;
    tel_client: string;
};
type Accounts = {
    Acc_No: string;
    Name_M: string;
};
type Transaction = {
    Ind: number;
    Acc_No: string;
    KidNoT: string;
    Date: string;
    Cridt: number;
    Dibt: number;
    Note: string;
    NUM_FACTURE: string;
    ENTETE: string;
    SOURCE: string;
    is_closed: boolean;
    check_number: string;
    usr: number;
    ref_emp: number;
    num_sarf: number;
    DATE_FACT: string;
    fl: boolean;
    Cridt_Curr: number;
    Dibt_Curr: number;
    Id_Cost_Center: number;
    id_supp_cuss: number;
    Cridt_Curr_A: number;
    Dibt_Curr_A: number;
    Cridt_Curr_B: number;
    Dibt_Curr_B: number;
    rate: number;
    date_effect: string;
    sor_1: number;
    fll: boolean;
    original_value_cridt: number;
    original_value_dibt: number;
    Curr_riginal_value: string;
    MrkzName: string;
    NUM_SARFF: string;
    CLIENT: number;
    PS: number;
    coa?: {
        Acc_No: string;
        Name_M: string;
    };
    user?: {
        id_user: number;
        name_user: string;
    };
};

const CashBookReports = () => {


     let ps: string | null = null;
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            const userObj = JSON.parse(userStr);
            ps = userObj.ps ?? localStorage.getItem('ps');
        } catch {
            ps = localStorage.getItem('ps');
        }
    } else {
        ps = localStorage.getItem('ps');
    }


    const [accounts, setAccounts] = useState<Accounts[]>([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    // Default: fromDate = Jan 1 of current year, toDate = today
    const getDefaultFromDate = () => {
        const now = new Date();
        return `${now.getFullYear()}-01-01`;
    };
    const getDefaultToDate = () => {
        const now = new Date();
        return now.toISOString().slice(0, 10);
    };
    const [fromDate, setFromDate] = useState(getDefaultFromDate());
    const [toDate, setToDate] = useState(getDefaultToDate());
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [openingBalance, setOpeningBalance] = useState<number>(0);
    const [prevTransCurr, setPrevTransCurr] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);
  const apiIp = process.env.REACT_APP_API_IP  ;
    useEffect(() => {
      fetchCustomers();
        const token = localStorage.getItem('token') || '';
        const apiUrlAccounts = `http://${apiIp}/Accounts`;
        axios.get<Accounts[]>(`${apiUrlAccounts}/all`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(res => setAccounts(res.data))
            .catch(() => setAccounts([]));
    }, []);

    const handleSearch = async () => {
        if (!selectedAccount || !fromDate || !toDate) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('token') || '';
            const apiUrlGls = `http://${apiIp}/Gls/allGlAP`;
            // Get transactions in period
            const res = await axios.get(apiUrlGls, {
                params: {
                    acc_no: selectedAccount,
                    from: fromDate,
                    to: toDate,
                      ps:ps
                },
                headers: { Authorization: `Bearer ${token}` },
            });
            setTransactions(res.data);

            // Get opening balance before 'fromDate'
            const apiUrlGlsOpening = `http://${apiIp}/Gls/allGlAP`;
            const openingRes = await axios.get(apiUrlGlsOpening, {
                params: {
                    acc_no: selectedAccount,
                    from: '1900-01-01',
                    to: fromDate,
                    ps:ps
                },
                headers: { Authorization: `Bearer ${token}` },
            });
            // Sum all previous transactions for opening balance
            const prevTrans: Transaction[] = openingRes.data;
            let opening = 0;
            for (const t of prevTrans) {
                opening += (t.Dibt || 0) - (t.Cridt || 0);
            }
            setOpeningBalance(opening);
            setPrevTransCurr(prevTrans);
        } catch {
            setTransactions([]);
            setOpeningBalance(0);
        }
        setLoading(false);
    };

    // Define columns for MaterialReactTable
    // Compute running balance for each row
    const transactionsWithBalance = React.useMemo(() => {
        let balance = openingBalance;
        let currBalance = 0;
        let currOpening = 0;
        // Calculate opening Cridt_Curr - Dibt_Curr for all previous transactions (before fromDate)
        for (const t of prevTransCurr) {
            currOpening += (t.Cridt_Curr || 0) - (t.Dibt_Curr || 0);
        }
        currBalance = currOpening;
        const rows = transactions.map((row) => {
            balance += (row.Dibt || 0) - (row.Cridt || 0);
            currBalance += (row.Dibt_Curr || 0) - (row.Cridt_Curr || 0);
            return { ...row, runningBalance: balance, runningCurrBalance: currBalance };
        });
        // Add opening balance row at the top
        const openingRow = {
            Ind: 0,
            Acc_No: selectedAccount,
            KidNoT: '',
            Date: '',
            Cridt: 0,
            Dibt: 0,
            Note: 'Opening Balance',
            NUM_FACTURE: '',
            ENTETE: '',
            SOURCE: '',
            is_closed: false,
            check_number: '',
            usr: 0,
            ref_emp: 0,
            num_sarf: 0,
            DATE_FACT: '',
            fl: false,
            Cridt_Curr: 0,
            Dibt_Curr: 0,
            Id_Cost_Center: 0,
            id_supp_cuss: 0,
            Cridt_Curr_A: 0,
            Dibt_Curr_A: 0,
            Cridt_Curr_B: 0,
            Dibt_Curr_B: 0,
            rate: 0,
            date_effect: '',
            sor_1: 0,
            fll: false,
            original_value_cridt: 0,
            original_value_dibt: 0,
            Curr_riginal_value: '',
            MrkzName: '',
            NUM_SARFF: '',
            CLIENT: 0,
            PS: 0,
            coa: { Acc_No: selectedAccount, Name_M: accounts.find(acc => acc.Acc_No === selectedAccount)?.Name_M || '' },
            user: { id_user: 0, name_user: '' },
            runningBalance: openingBalance,
            runningCurrBalance: currOpening,
        };
        return [openingRow, ...rows];
    }, [transactions, openingBalance, accounts, selectedAccount, prevTransCurr]);

    type TableRow = Transaction & { runningBalance: number; runningCurrBalance: number };
    const columns: MRT_ColumnDef<TableRow>[] = [
        {
            accessorKey: 'date_je_source_doc',
            header: 'Date / JE No / Source / Document No',
            size: 220,
            Cell: ({ row }) => {
                const isOpening = row.original.Note === 'Opening Balance';
                const date = row.original.Date?.slice(0, 10) || '';
                const jeNo = row.original.KidNoT || '';
                const source = row.original.SOURCE || '';
                const docNo = row.original.NUM_FACTURE || '';
                if (isOpening) {
                    // Hide labels and values for opening row
                    return <span style={{ color: '#888', fontStyle: 'italic' }}>Opening Balance</span>;
                }
                return (
                    <span style={{ whiteSpace: 'pre-line', wordBreak: 'break-word', maxWidth: 220, display: 'block' }}>
                        <b>Date:</b> {date} <br />
                        <b>JE No:</b> {jeNo} <br />
                        <b>Source:</b> {source} <br />
                        <b>Document No:</b> {docNo}
                    </span>
                );
            },
        },

        {
            accessorKey: 'CLIENT',
            header: 'Customer',
            size: 120,
            Cell: ({ cell }) => {
                const clientId = cell.getValue<number>();
                const client = customers.find(c => c.id_client === clientId);
                return client ? client.client_name : clientId || '';
            },
        },


        {
            accessorKey: 'accountInfo',
            header: 'Account',
            Cell: ({ row }) => (
                <span>
                    <span style={{ fontWeight: 'bold', color: '#1976d2', fontSize: 13 }}>{row.original.Acc_No}</span>
                    <br />
                    <span style={{ color: '#666', fontSize: 12 }}>{row.original.coa?.Name_M || ''}</span>
                </span>
            ),
        },
        {
            accessorKey: 'Note',
            header: 'Note',
            Cell: ({ cell }) => (
                <span style={{ whiteSpace: 'pre-line', wordBreak: 'break-word', maxWidth: 200, display: 'block' }}>
                    {cell.getValue<string>()}
                </span>
            ),
        },
        {
            accessorKey: 'Cridt',
            header: 'Credit',
               size: 120,
            Cell: ({ cell }) => Number(cell.getValue() || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
        },
        {
            accessorKey: 'Dibt',
            header: 'Debit',
               size: 120,
            Cell: ({ cell }) => Number(cell.getValue() || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
        },
        {
            accessorKey: 'runningBalance',
            header: 'Balance',
            Cell: ({ row }) => Number(row.original.runningBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
        },
        {
            accessorKey: 'Cridt_Curr',
            header: 'Credit Curr',
            size: 120,
            Cell: ({ cell }) => Number(cell.getValue() || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
        },
        {
            accessorKey: 'Dibt_Curr',
            header: 'Debit Curr',
            size: 120,
            Cell: ({ cell }) => Number(cell.getValue() || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
        },
        {
            accessorKey: 'runningCurrBalance',
            header: 'Balance Curr',
            size: 120,
            Cell: ({ row }) => Number(row.original.runningCurrBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
        },
        
       
        {
            accessorKey: 'user.name_user',
            header: 'Created bY',
            Cell: ({ row }) => row.original.user?.name_user || '',
        },

         
    ];




     const apiUrlcustomers = `http://${apiIp}/customers`;
const [customers, setCustomers] = useState<Client[]>([]);
    const fetchCustomers = async () => {
        const token = localStorage.getItem('token');
        try {
            
            const res = await axios.get<Client[]>(`${apiUrlcustomers}/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCustomers(res.data);
        } catch (error) {
           
        } finally {
             
        }
    };
    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontSize: 16, fontWeight: 'bold' }}>Cash Book Reports</Typography>
                <TextField
                    label="From Date"
                    type="date"
                    value={fromDate}
                    onChange={e => setFromDate(e.target.value)}
                    InputLabelProps={{ shrink: true, style: { fontSize: 12 } }}
                    inputProps={{ style: { fontSize: 12, padding: '8px 10px' } }}
                    sx={{ width: 120 }}
                    size="small"
                />
                <TextField
                    label="To Date"
                    type="date"
                    value={toDate}
                    onChange={e => setToDate(e.target.value)}
                    InputLabelProps={{ shrink: true, style: { fontSize: 12 } }}
                    inputProps={{ style: { fontSize: 12, padding: '8px 10px' } }}
                    sx={{ width: 120 }}
                    size="small"
                />
                <Autocomplete
                    options={accounts}
                    getOptionLabel={option => `${option.Acc_No} - ${option.Name_M}`}
                    value={accounts.find(acc => acc.Acc_No === selectedAccount) || null}
                    onChange={(_, newValue) => setSelectedAccount(newValue ? newValue.Acc_No : '')}
                    sx={{ minWidth: 400 }}
                    size="small"
                    renderInput={params => (
                        <TextField
                            {...params}
                            label="Account"
                            InputLabelProps={{ style: { fontSize: 12 } }}
                            inputProps={{
                                ...params.inputProps,
                                style: { fontSize: 12 }
                            }}
                        />
                    )}
                />
                <Button size="small" color='secondary' variant="contained" onClick={handleSearch} disabled={loading}>
                    Search
                </Button>
            </Box>
            <MaterialReactTable
                columns={columns}
                data={transactionsWithBalance}
                state={{ isLoading: loading }}
                enableColumnResizing
                enableStickyHeader
                enableDensityToggle={false}
                enableFullScreenToggle={false}
                enableColumnActions={false}
                enableColumnFilters={false}
                enablePagination={true}
                muiTablePaperProps={{ elevation: 0 }}
                initialState={{ density: 'compact' }}
            />
            {/* Final balances below the table */}
            <Box sx={{ textAlign: 'left', fontWeight: 'bold', color: 'inherit', fontSize: 18 }}>
                <div>
                    Final&nbsp;
                    <span style={{ fontWeight: 'bold', color: '#1976d2', fontSize: 18 }}>{selectedAccount}</span>
                    &nbsp;
                    <span style={{ color: '#388e3c', fontSize: 16, fontStyle: 'italic' }}>{accounts.find(acc => acc.Acc_No === selectedAccount)?.Name_M || ''}</span>
                    &nbsp;LYD Balance: {(() => {
                        if (transactionsWithBalance.length > 0) {
                            const last = transactionsWithBalance[transactionsWithBalance.length - 1];
                            return Number(last.runningBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                        }
                        return Number(openingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                    })()}
                </div>
                <div>
                    Final&nbsp;
                    <span style={{ fontWeight: 'bold', color: '#1976d2', fontSize: 18 }}>{selectedAccount}</span>
                    &nbsp;
                    <span style={{ color: '#388e3c', fontSize: 16, fontStyle: 'italic' }}>{accounts.find(acc => acc.Acc_No === selectedAccount)?.Name_M || ''}</span>
                    &nbsp;Currency Balance: {(() => {
                        if (transactionsWithBalance.length > 0) {
                            const last = transactionsWithBalance[transactionsWithBalance.length - 1];
                            return Number(last.runningCurrBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                        }
                        return '0.000';
                    })()}
                </div>
            </Box>
        </Box>
    );
};

export default CashBookReports;
