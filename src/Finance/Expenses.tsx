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
    Snackbar,
    Alert,
    LinearProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Autocomplete
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Delete, Edit } from '@mui/icons-material';

type Client = {
    id_client: number;
    client_name: string;
    tel_client: string;
};

type Expense = {
    ID_transaction: number;
    date_trandsaction: string;
    ps: number;
    client: number;
    usr: number;
    montant: number;
    Account_number1: string;
    Account_number2: string;
    Note: string;
    IS_OK: boolean;
    En_tete?: string;
    rate?: number;
    montant_net?: number;
    ref_emp?: number;
    NUM_FACTURE?: string;
    // Add other fields from the Expenses model as needed
    Customer?: {
        id_client: number;
        client_name: string;
        tel_client: string;
    };
    User?: {
        id_user: number;
        name_user: string;
        email: string;
    };
};

type Account = {
    Acc_No: string;
    Name_M: string;
};



type Employee = {
    ID_EMP: string;
    NAME: string;
};



type SnackbarState = {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
};

const initialExpenseState: Expense = {
    ID_transaction: 0,
    date_trandsaction: new Date().toISOString().split('T')[0],
    ps: 0,
    client: 0,
    usr: 0,
    montant: 0,
    Account_number1: '',
    Account_number2: '',
    Note: '',
    IS_OK: false,
    En_tete: '',
    rate: 1,
    montant_net: 0,
    ref_emp: 0,
    NUM_FACTURE: '',
};

interface Props {
    Type?: string;
}

const Expenses = (props: Props) => {
    const { Type = '' } = props;
    const [customers, setCustomers] = useState<Client[]>([]);
      const [employees, setEmployees] = useState<Employee[]>([]);


    const [data, setData] = useState<Expense[]>([]);
    const [dataAccounts, setDataAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInvoiceForm, setShowInvoiceForm] = useState(false);
    const [editExpense, setEditExpense] = useState<Expense>(initialExpenseState);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedInvoiceNum, setSelectedInvoiceNum] = useState<number | null>(null);
    const [refreshFlag, setRefreshFlag] = useState(0);
    const [progress, setProgress] = useState(0);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [revenueToDelete, setRevenueToDelete] = useState<number | null>(null);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    const [snackbar, setSnackbar] = useState<SnackbarState>({
        open: false,
        message: '',
        severity: 'success',
    });


    const [loadingCustomers, setLoadingCustomers] = useState(false);

    const apiIp = process.env.REACT_APP_API_IP;
    const apiUrlcustomers = `http://${apiIp}/customers`;

    const fetchCustomers = useCallback(async () => {
        const token = localStorage.getItem('token');
        try {
            setLoadingCustomers(true);
            const res = await axios.get<Client[]>(`${apiUrlcustomers}/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCustomers(res.data);
        } catch (error) {
            console.error("Error fetching customers:", error);
            showSnackbar("Failed to fetch customers", 'error');
        } finally {
            setLoadingCustomers(false);
        }
    }, [apiUrlcustomers]);


   const apiUrlemployee = `http://${apiIp}/employees`;
    const fetchEmployee = useCallback(async () => {
       
        const token = localStorage.getItem('token');
        try {
            setLoadingCustomers(true);
            const res = await axios.get<Employee[]>(`${apiUrlemployee}/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEmployees(res.data);
        } catch (error) {
            console.error("Error fetching customers:", error);
            showSnackbar("Failed to fetch customers", 'error');
        } finally {
            setLoadingCustomers(false);
        }
    }, [apiUrlemployee]);

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







    const apiUrl = "http://102.213.182.8:9000/Expense";
    const apiUrlAccounts = `http://${apiIp}/Accounts`;

    const showSnackbar = (message: string, severity: SnackbarState['severity']) => {
        setSnackbar({ open: true, message, severity });
    };

    const handleCloseSnackbar = () => {
        setSnackbar(prev => ({ ...prev, open: false }));
    };

    const fetchDataAccounts = useCallback(async () => {
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
            const res = await axios.get<Account[]>(`${apiUrlAccounts}/all`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            clearInterval(timer);
            setProgress(100);
            setDataAccounts(res.data);
        } catch (err: any) {
            console.error("Error fetching accounts data:", err);
            if (err.response?.status === 401) {
                navigate("/");
            } else {
                showSnackbar("Error loading accounts data", 'error');
            }
        } finally {
            setLoading(false);
            setTimeout(() => setProgress(0), 500);
        }
    }, [navigate, apiUrlAccounts]);

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

            const res = await axios.get<Expense[]>(`${apiUrl}/all`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { ps }
            });

            clearInterval(timer);
            setProgress(100);
            setData(res.data);

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
    }, [navigate, ps]);

    useEffect(() => {
        fetchData();
        fetchDataAccounts();
        fetchCustomers();
        fetchEmployee();
    }, [fetchData, fetchDataAccounts, fetchCustomers,fetchEmployee, refreshFlag]);

    const handleAddNew = async () => {
        try {
            setEditExpense({
                ...initialExpenseState,
                usr: Number(Cuser) || 0,
                ps: Number(ps) || 0,
                date_trandsaction: new Date().toISOString().split('T')[0], // always today
            });
            setIsEditMode(false);
            setShowInvoiceForm(true);
            showSnackbar("Ready to create new expense", 'info');
        } catch (error) {
            console.error("Error creating new expense:", error);
            showSnackbar("Failed to create new expense", 'error');
        }
    };

    const handleEdit = useCallback((row: Expense) => {

        setSelectedInvoiceNum(row.ID_transaction);
        setEditExpense({
            ...row,
            Customer: row.Customer || customers.find(c => c.id_client === row.client)
        });
        setIsEditMode(true);
        setShowInvoiceForm(true);
        showSnackbar(`Editing expense #${row.ID_transaction}`, 'info');
    }, [customers]);

    const openDeleteDialog = (id: number) => {
        setRevenueToDelete(id);
        setDeleteDialogOpen(true);
    };

    const closeDeleteDialog = () => {
        setDeleteDialogOpen(false);
        setRevenueToDelete(null);
    };

    const handleDeleteConfirm = async () => {
        if (!revenueToDelete) return;

        const token = localStorage.getItem('token');
        try {
            await axios.delete(`${apiUrl}/delete/${revenueToDelete}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showSnackbar("Expense deleted successfully", 'success');
            setRefreshFlag(prev => prev + 1);
        } catch (error) {
            console.error("Error deleting expense:", error);
            showSnackbar("Failed to delete expense", 'error');
        } finally {
            closeDeleteDialog();
        }
    };

    const handleCloseInvoiceForm = (success: boolean = false) => {
        setShowInvoiceForm(false);
        if (success) {
            setRefreshFlag(prev => prev + 1);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setEditExpense(prev => {
            const updated = {
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            };
            if (name === 'montant' || name === 'rate') {
                const montant = name === 'montant' ? Number(value) : Number(updated.montant);
                const rate = name === 'rate' ? Number(value) : Number(updated.rate);
                updated.montant_net = montant * rate;
            }
            return updated;
        });
    };

    const handleSubmit = async () => {
        // Validate form
        const validationErrors: { [key: string]: string } = {};
        // Customer is now optional, so no validation error
        if (editExpense.montant === undefined || editExpense.montant === null  ) validationErrors.montant = "Amount is required";
        if (!editExpense.Account_number1) validationErrors.Account_number1 = "Debit account is required";
        if (!editExpense.Account_number2) validationErrors.Account_number2 = "Credit account is required";
        // Ensure date_trandsaction is always a valid date string
        if (!editExpense.date_trandsaction || isNaN(Date.parse(editExpense.date_trandsaction))) {
            editExpense.date_trandsaction = new Date().toISOString().split('T')[0];
        }
        setErrors(validationErrors);
        if (Object.keys(validationErrors).length > 0) {
            showSnackbar("Please fix the errors in the form", 'error');
            return;
        }
        const token = localStorage.getItem('token');
        try {
            const url = isEditMode
                ? `${apiUrl}/update/${editExpense.ID_transaction}`
                : `${apiUrl}/Add`;
            const method = isEditMode ? 'PUT' : 'POST';
            editExpense.ps = Number(ps) || 0;
            await axios({
                method,
                url,
                data: editExpense,
                headers: { Authorization: `Bearer ${token}` }
            });
            showSnackbar(
                isEditMode
                    ? "Expense updated successfully"
                    : "Expense created successfully",
                'success'
            );
            handleCloseInvoiceForm(true);
        } catch (error) {
            console.error("Error saving expense:", error);
            showSnackbar("Failed to save expense", 'error');
        }
    };

    const columns = useMemo<MRT_ColumnDef<Expense>[]>(() => [
        {
            accessorKey: 'txn_date_doc_group',
            header: 'Transaction / Date / Document',
            size: 220,
            Cell: ({ row }) => {
                const txn = row.original.ID_transaction;
                const dateStr = row.original.date_trandsaction;
                const date = dateStr ? new Date(dateStr).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }) : '';
                const docNum = row.original.NUM_FACTURE ?? '';
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.3 }}>
                        <span><strong>Txn No:</strong> {txn}</span>
                        <span><strong>Date:</strong> {date}</span>
                        <span><strong>Document:</strong> {docNum}</span>
                    </Box>
                );
            }
        },
        
        {
            accessorKey: 'En_tete',
            header: 'Pay to',
            size: 150,
            Cell: ({ cell }) => (
                <Box sx={{ whiteSpace: 'pre-line', wordBreak: 'break-word', lineHeight: 1.5 }}>
                    {cell.getValue<string>()}
                </Box>
            )
        },
        {
            accessorKey: 'client',
            header: 'Customer',
            size: 150,
            Cell: ({ cell, row }) => {
                const customer = customers.find(c => c.id_client === row.original.client);
                return customer ? customer.client_name : '';
            }
        },
        {
            accessorKey: 'Account_number1',
            header: 'Debit Account',
            size: 140,
            Cell: ({ cell }) => {
                const accNo = cell.getValue<string>();
                const account = dataAccounts.find(acc => acc.Acc_No === accNo);
                return account ? (
                    <div style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        <strong>{account.Acc_No}</strong><br />
                        {account.Name_M}
                    </div>
                ) : accNo;
            }
        },
        {
            accessorKey: 'Account_number2',
            header: 'Credit Account',
            size: 140,
            Cell: ({ cell }) => {
                const accNo = cell.getValue<string>();
                const account = dataAccounts.find(acc => acc.Acc_No === accNo);
                return account ? (
                    <div style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        <strong>{account.Acc_No}</strong><br />
                        {account.Name_M}
                    </div>
                ) : accNo;
            }
        },
        
        {
            accessorKey: 'Note',
            header: 'Note',
            size: 200,
            Cell: ({ cell }) => (
                <Box sx={{ whiteSpace: 'pre-line', wordBreak: 'break-word', lineHeight: 1.5 }}>
                    {cell.getValue<string>()}
                </Box>
            )
        },
        {
            accessorKey: 'IS_OK',
            header: 'Status',
            size: 100,
            Cell: ({ cell }) => (
                <Box
                    sx={{
                        color: cell.getValue() ? 'success.main' : 'warning.main',
                        fontWeight: 'bold'
                    }}
                >
                    {cell.getValue() ? 'Closed' : 'Open'}
                </Box>
            )
        },
        {
            accessorKey: 'usr',
            header: 'Created By',
            size: 120
        },
       
        {
            accessorKey: 'amount_group',
            header: 'Amount / Rate / LYD',
            size: 220,
            Cell: ({ row }) => {
                const amount = row.original.montant?.toLocaleString('en') || '0';
                const rate = row.original.rate ?? 1;
                const lyd = (row.original.montant_net ?? (row.original.montant * rate)).toLocaleString('en');
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.3 }}>
                        <span><strong>Amount:</strong> {amount}</span>
                        <span><strong>Rate:</strong> {rate}</span>
                        <span><strong>LYD:</strong> {lyd}</span>
                    </Box>
                );
            }
        },
        {
            accessorKey: 'ref_emp',
            header: 'Employee',
            size: 180,
            Cell: ({ cell }) => {
                const emp = employees.find(e => Number(e.ID_EMP) === Number(cell.getValue()));
                return <span>{emp ? `${emp.NAME} (${emp.ID_EMP})` : String(cell.getValue())}</span>;
            }
        },
        // ...existing code...
    ], [dataAccounts, customers, handleEdit]);
    const table = useMaterialReactTable({
        columns,
        data,
        state: { isLoading: loading },
        enableDensityToggle: false,
        enableFullScreenToggle: false,
        enableColumnFilters: false,
        enableHiding: false,
        initialState: {
            density: 'compact',
            sorting: [{ id: 'date_trandsaction', desc: true }],
            pagination: {
                pageSize: 7,
                pageIndex: 0
            }
        },




    });

    // Filter accounts to only those with Acc_No length 8
    const filteredAccounts = useMemo(() => dataAccounts.filter(acc => acc.Acc_No.length === 8), [dataAccounts]);

    return (
        <Box p={2}>






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

            <Dialog
                open={deleteDialogOpen}
                onClose={closeDeleteDialog}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">
                    Confirm Delete
                </DialogTitle>
                <DialogContent>
                    Are you sure you want to delete this revenue record? This action cannot be undone.
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDeleteDialog}>Cancel</Button>
                    <Button
                        onClick={handleDeleteConfirm}
                        color="error"
                        autoFocus
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={showInvoiceForm}
                onClose={() => handleCloseInvoiceForm()}
                fullWidth
                maxWidth="md"
            >
                <DialogTitle>
                    {isEditMode ? `Edit Expense #${editExpense.ID_transaction}` : 'Create New Expense'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                         {/* Pay to */}
                        <TextField
                            label="Date"
                            name="date_trandsaction"
                            value={editExpense.date_trandsaction}
                            disabled
                            fullWidth
                        />
                        <TextField
                            label="Pay to"
                            name="En_tete"
                            value={editExpense.En_tete}
                            onChange={handleInputChange}
                            fullWidth
                        />
                        
                        
                         {/* Customer */}
                        <Autocomplete
                            id="customer-select"
                            options={customers}
                            loading={loadingCustomers}
                            getOptionLabel={(option) => `${option.client_name} (${option.tel_client || 'No Phone'})`}
                            value={customers.find(c => c.id_client === editExpense.client) || null}
                            onChange={(event, newValue) => {
                                setEditExpense(prev => ({
                                    ...prev,
                                    client: newValue?.id_client || 0,
                                    Customer: newValue || undefined
                                }));
                                setErrors(prev => ({ ...prev, client: '' }));
                            }}
                            renderOption={(props, option) => (
                                <Box component="li" {...props} key={option.id_client}>
                                    {option.client_name} ({option.tel_client || 'No Phone'})
                                </Box>
                            )}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Customer"
                                    error={!!errors.client}
                                    helperText={errors.client}
                                    // required removed to make customer optional
                                />
                            )}
                            fullWidth
                        />

                      

                        {/* Document Number */}
                        <TextField
                            label="Document Number"
                            name="NUM_FACTURE"
                            value={editExpense.NUM_FACTURE}
                            onChange={handleInputChange}
                            fullWidth
                        />

                        {/* Debit and Credit Accounts */}
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Autocomplete
                                id="debit-account-select"
                                options={filteredAccounts}
                                getOptionLabel={(option) => `${option.Name_M} (${option.Acc_No})`}
                                value={dataAccounts.find(c => c.Acc_No === editExpense.Account_number1) || null}
                                onChange={(event, newValue) => {
                                    setEditExpense(prev => ({
                                        ...prev,
                                        Account_number1: newValue?.Acc_No || '',
                                    }));
                                    setErrors(prev => ({ ...prev, Account_number1: '' }));
                                }}
                                renderOption={(props, option) => (
                                    <Box component="li" {...props} key={option.Acc_No}>
                                        {option.Name_M} ({option.Acc_No})
                                    </Box>
                                )}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Debit Account"
                                        error={!!errors.Account_number1}
                                        helperText={errors.Account_number1}
                                        required
                                    />
                                )}
                                fullWidth
                                sx={{ flex: 1 }}
                            />
                            <Autocomplete
                                id="credit-account-select"
                                options={filteredAccounts}
                                getOptionLabel={(option) => `${option.Name_M} (${option.Acc_No})`}
                                value={dataAccounts.find(c => c.Acc_No === editExpense.Account_number2) || null}
                                onChange={(event, newValue) => {
                                    setEditExpense(prev => ({
                                        ...prev,
                                        Account_number2: newValue?.Acc_No || '',
                                    }));
                                    setErrors(prev => ({ ...prev, Account_number2: '' }));
                                }}
                                renderOption={(props, option) => (
                                    <Box component="li" {...props} key={option.Acc_No}>
                                        {option.Name_M} ({option.Acc_No})
                                    </Box>
                                )}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Credit Account"
                                        error={!!errors.Account_number2}
                                        helperText={errors.Account_number2}
                                        required
                                    />
                                )}
                                fullWidth
                                sx={{ flex: 1 }}
                            />
                        </Box>

                        {/* Amount, Exchange Rate, Net Amount */}
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <TextField
                                label="Amount *"
                                name="montant"
                                type="number"
                                value={editExpense.montant}
                                onChange={handleInputChange}
                                error={!!errors.montant}
                                helperText={errors.montant}
                                fullWidth
                                inputProps={{ step: 0.01 }}
                            />
                            <TextField
                                label="Exchange Rate"
                                name="rate"
                                type="number"
                                value={editExpense.rate}
                                onChange={handleInputChange}
                                fullWidth
                                inputProps={{ min: 0, step: 0.0001 }}
                            />
                            <TextField
                                label="Net Amount"
                                name="montant_net"
                                type="number"
                                value={editExpense.montant_net ?? (editExpense.montant * (editExpense.rate || 1))}
                                 
                                fullWidth
                            />
                        </Box>

                        {/* Employee */}
                        <Autocomplete
                            id="employee-select"
                            options={employees}
                            getOptionLabel={(option) => `${option.NAME} (${option.ID_EMP})`}
                            value={employees.find(e => Number(e.ID_EMP) === Number(editExpense.ref_emp)) || null}
                            onChange={(event, newValue) => {
                                setEditExpense(prev => ({
                                    ...prev,
                                    ref_emp: newValue ? Number(newValue.ID_EMP) : 0
                                }));
                            }}
                            renderOption={(props, option) => (
                                <Box component="li" {...props} key={option.ID_EMP}>
                                    {option.NAME} ({option.ID_EMP})
                                </Box>
                            )}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Employee"
                                    fullWidth
                                />
                            )}
                            fullWidth
                        />

                        {/* Note */}
                        <TextField
                            label="Note"
                            name="Note"
                            value={editExpense.Note}
                            onChange={handleInputChange}
                            multiline
                            rows={3}
                            fullWidth
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => handleCloseInvoiceForm()}>Cancel</Button>
                    <Button
                        onClick={handleSubmit}
                        variant="contained"
                        color="primary"
                    >
                        {isEditMode ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

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
                    Expenses List
                </Typography>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={handleAddNew}
                    sx={{ borderRadius: 2, fontWeight: 'bold' }}
                >
                    New Expense
                </Button>
            </Box>

            <Divider sx={{ mb: 2 }} />

            <MaterialReactTable table={table} />
        </Box>
    );
};

export default Expenses;