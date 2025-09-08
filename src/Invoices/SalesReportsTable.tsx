import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, FormControl, InputLabel, Select, MenuItem, TextField, Dialog, DialogTitle, DialogContent, Button } from '@mui/material';
import axios from 'axios';
import { MaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import LockIcon from '@mui/icons-material/Lock';

import PrintInvoiceDialog from '../Invoices/ListCardInvoice/Gold Invoices/PrintInvoiceDialog';
import ChiraReturnPage from './ChiraReturnPage';


const MODEL_LABELS = {
    all: 'All Types',
    gold: 'Gold',
    diamond: 'Diamond',
    watch: 'Watch',
};

const typeOptions = [
    { label: 'All', value: 'all' },
    { label: 'Gold', value: 'gold' },
    { label: 'Diamond', value: 'diamond' },
    { label: 'Watch', value: 'watch' },
];



type Users = {
    id_user: number;
    name_user: string;

};


const SalesReportsTable = ({ type: initialType }: { type?: 'gold' | 'diamond' | 'watch' }) => {
    // Fetch users on mount

    const [type, setType] = useState<'all' | 'gold' | 'diamond' | 'watch'>(initialType || 'all');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    // Set default periodFrom and periodTo to current date
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const currentDate = `${yyyy}-${mm}-${dd}`;
    const [periodFrom, setPeriodFrom] = useState(currentDate);
    const [periodTo, setPeriodTo] = useState(currentDate);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [detailsData] = useState<any>(null);
    const [isChira, setIsChira] = useState<'all' | 'yes' | 'no'>('all');
    const [isWholeSale, setIsWholeSale] = useState<'all' | 'yes' | 'no'>('all');
    const [printDialogOpen, setPrintDialogOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
    // Trigger refresh after closing an invoice
    const [invoiceRefreshFlag, setInvoiceRefreshFlag] = useState(0);
    const [chiraDialogOpen, setChiraDialogOpen] = useState(false);
    const [chiraDialogIdFact, setChiraDialogIdFact] = useState(null);
    const [chiraRefreshFlag, setChiraRefreshFlag] = useState(0);
    const printRef = React.useRef(null);




    const apiUrlusers = `http://localhost:9000/users`;
    const [users, setUsers] = useState<Users[]>([]);
    const fetchUsers = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get<Users[]>(`${apiUrlusers}/ListUsers`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(res.data);
            
        } catch (error) {
            console.error("Error fetching Users:", error);

        } finally {
            // no-op
        }
    };


    useEffect(() => {
        fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    const API_BASEImage = 'http://localhost:9000/images';
    const [imageUrls, setImageUrls] = useState<Record<string, string[]>>({});
    const [imageBlobUrls, setImageBlobUrls] = useState<Record<string, string[]>>({});
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

    // Fetch all images for a given picint (or id_achat)
    const fetchImages = async (picint: number) => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`${API_BASEImage}/list/${picint}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (Array.isArray(res.data)) {
                setImageUrls(prev => ({ ...prev, [picint]: res.data }));
            } else {
                setImageUrls(prev => ({ ...prev, [picint]: [] }));
            }
        } catch {
            setImageUrls(prev => ({ ...prev, [picint]: [] }));
        }


    };

    // Helper to fetch image as blob and store object URL
    const fetchImageBlobs = async (picint: number, urls: string[]) => {
        const token = localStorage.getItem('token');
        const blobUrls: string[] = [];
        for (const url of urls) {
            try {
                const imgUrl = url.startsWith('http') ? url : `${API_BASEImage}/${url}`;
                const res = await axios.get(imgUrl, {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'blob',
                });
                const blobUrl = URL.createObjectURL(res.data);
                blobUrls.push(blobUrl);
            } catch {
                // fallback: skip or push empty
            }
        }
        setImageBlobUrls(prev => ({ ...prev, [picint]: blobUrls }));
    };

    // Fetch blobs for protected images when imageUrls changes
    useEffect(() => {
        Object.entries(imageUrls).forEach(([picint, urls]) => {
            if (urls.length > 0 && !imageBlobUrls[picint]) {
                fetchImageBlobs(Number(picint), urls);
            }
        });
        // eslint-disable-next-line


    }, [imageUrls, imageBlobUrls]);

    // Cleanup blob URLs on unmount or when imageBlobUrls changes
    useEffect(() => {
        return () => {
            Object.values(imageBlobUrls).flat().forEach(url => URL.revokeObjectURL(url));
        };
    }, [imageBlobUrls]);

    useEffect(() => {
        setLoading(true);
        const token = localStorage.getItem('token');
        axios.get(`http://localhost:9000/invoices/allDetailsP`, {
            headers: { Authorization: `Bearer ${token}` },
            params: {
                ps: ps,
                ...(type !== 'all' ? { type } : {}),
                ...(isChira !== 'all' ? { is_chira: isChira === 'yes' ? 1 : 0 } : {}),
                ...(isWholeSale !== 'all' ? { is_whole_sale: isWholeSale === 'yes' ? 1 : 0 } : {}),
                from: periodFrom || undefined,
                to: periodTo || undefined
            }
        })
            .then(res => {
                setData(res.data);
            })
            .catch(() => setData([]))
            .finally(() => setLoading(false));
    }, [type, periodFrom, periodTo, ps, isChira, isWholeSale, chiraRefreshFlag, invoiceRefreshFlag]);

    // Calculate total weight in gram (sum of qty for all rows)
    const totalWeight = data.reduce((sum, row) => {
        const achats = row.ACHATs || [];
        if (achats.length > 0) {
            const achat = achats[0];
            // Only sum qty if TYPE_SUPPLIER contains 'gold'
            const typeSupplier = achat.Fournisseur?.TYPE_SUPPLIER || '';
            if (typeSupplier.toLowerCase().includes('gold')) {
                const qty = Number(achat.qty);
                if (!isNaN(qty)) return sum + qty;
            }
        }
        return sum;
    }, 0);

    // Calculate total invoice amounts by type (sum max per invoice)
    function getMaxTotalByType(typeStr: string) {
        // Map from num_fact to max total_remise_final for that invoice and type
        const invoiceMap = new Map();
        data.forEach(row => {
            const achats = row.ACHATs || [];
            if (achats.length > 0) {
                const achat = achats[0];
                const typeSupplier = achat.Fournisseur?.TYPE_SUPPLIER || '';
                if (typeSupplier.toLowerCase().includes(typeStr)) {
                    const numFact = row.num_fact;
                    let val = 0;
                    if (row.remise > 0) {
                        val = Number(row.total_remise_final - row.remise);
                    } else if (row.remise_per > 0) {
                        val = Number(row.total_remise_final - (row.total_remise_final * row.remise_per / 100));
                    } else {
                        val = Number(row.total_remise_final);
                    }
                    if (!isNaN(val)) {
                        if (!invoiceMap.has(numFact) || invoiceMap.get(numFact) < val) {
                            invoiceMap.set(numFact, val);
                        }
                    }
                }
            }
        });
        // Sum the max values
        let sum = 0;
        Array.from(invoiceMap.values()).forEach(v => { sum += v; });
        return sum;
    }
    const totalGold = getMaxTotalByType('gold');
    const totalDiamond = getMaxTotalByType('diamond');
    const totalWatch = getMaxTotalByType('watch');

    // Helper to format numbers with comma and point
    const formatNumber = (value: any) => {
        if (typeof value === 'number') {
            return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        if (typeof value === 'string' && value !== '') {
            const num = Number(value);
            if (!isNaN(num)) {
                return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
            return value;
        }
        return value;
    };

    // --- Merge rows by num_fact and aggregate product details ---
    function mergeRowsByInvoice(data: any[]) {
        const invoiceMap = new Map<string, any>();
        data.forEach((row: any) => {
            const numFact = row.num_fact;
            if (!invoiceMap.has(numFact)) {
                // Clone the row and initialize product details list
                invoiceMap.set(numFact, { ...row, _productDetails: [] });
            }
            // Extract product details from ACHATs
            const achats: any[] = row.ACHATs || [];
            achats.forEach((achat: any) => {
                const design = achat.Design_art || '';
                const code = achat.id_fact || '';
                const typeSupplier = achat.Fournisseur?.TYPE_SUPPLIER || '';
                let weight = '';
                if (typeSupplier.toLowerCase().includes('gold')) {
                    weight = achat.qty?.toString() || '';
                }
                const picint = row.picint || '';

                const IS_GIFT = row.IS_GIFT || '';


                invoiceMap.get(numFact)._productDetails.push({
                    design,
                    weight,
                    code,
                    typeSupplier,
                    picint, // Add picint to product details
                    IS_GIFT
                });
            });
        });
        return Array.from(invoiceMap.values());
    }

    // Sort data by date_fact descending
    const mergedData = mergeRowsByInvoice(data);
    const sortedData = [...mergedData].sort((a, b) => {
        const dateA = new Date(a.date_fact).getTime();
        const dateB = new Date(b.date_fact).getTime();
        return dateB - dateA;
    });


    // Fetch images for all invoices in sortedData when data changes
    useEffect(() => {
        const picints: Set<number> = new Set();
        data.forEach((row: any) => {
            if (row.picint && !imageUrls[row.picint]) {
                picints.add(row.picint);
            }
        });
        Array.from(picints).forEach(picint => fetchImages(picint));
        // eslint-disable-next-line
    }, [sortedData]);

    // Fetch images for all product-level picints in sortedData when data changes
    useEffect(() => {
        const allPicints: Set<number> = new Set();
        sortedData.forEach((row: any) => {
            // Collect invoice-level picint
            if (row.picint && !imageUrls[row.picint]) {
                allPicints.add(row.picint);
            }
            // Collect all product-level picints from ACHATs
            if (Array.isArray(row.ACHATs)) {
                row.ACHATs.forEach((achat: any) => {
                    if (achat.picint && !imageUrls[achat.picint]) {
                        allPicints.add(achat.picint);
                    }
                });
            }
        });
        Array.from(allPicints).forEach(picint => fetchImages(picint));
        // eslint-disable-next-line
    }, [sortedData]);



    // Explicit column definitions for full control
    const columns: MRT_ColumnDef<any>[] = [

        {
            accessorKey: 'invoice_info',
            header: 'Invoice Info',
            Cell: ({ row }) => {
                const date = row.original.date_fact || '';
                const num = row.original.num_fact || '';
                const created = row.original.d_time ? new Date(row.original.d_time) : null;
                const ps = row.original.ps || '';
                let createdStr = '';
                if (created) {
                    let hours = created.getHours();
                    const minutes = created.getMinutes().toString().padStart(2, '0');
                    const ampm = hours >= 12 ? 'PM' : 'AM';
                    hours = hours % 12;
                    hours = hours ? hours : 12;
                    createdStr = `${hours}:${minutes} ${ampm}`;
                }
                const user = row.original.Utilisateur && row.original.Utilisateur.name_user ? row.original.Utilisateur.name_user : '';
                const isChira = row.original.is_chira === true || row.original.is_chira === 1;
                const returnChira = row.original.return_chira;
                const commentChira = row.original.comment_chira;


                const usrReceiveChira = row.original.usr_receive_chira;
                // Find user name from users array by id_user
                let usrReceiveChiraName = usrReceiveChira;

              
                if (usrReceiveChira && Array.isArray(users) && users.length > 0) {
                    
                    const foundUser = users.find(u => String(u.id_user) === String(usrReceiveChira));
                    if (foundUser) {
                        usrReceiveChiraName = foundUser.name_user;
                    }
                }

                

                // Helper to check if all chira fields are empty, null, or zero
                const isChiraFieldsEmpty = (
                    (!returnChira || returnChira === '0') &&
                    (!commentChira || commentChira === '0') &&
                    (!usrReceiveChira || usrReceiveChira === '0')
                );
                return (
                    <div style={{ whiteSpace: 'pre-line', fontSize: 12 }}>
                        <div>
                            <span style={{ fontWeight: 'bold', color: 'inherit' }}>Date:</span>
                            <span style={{ marginLeft: 6, color: '#666' }}>{date}</span>
                        </div>
                        <div>
                            <span style={{ fontWeight: 'bold', color: 'inherit' }}>Invoice No:</span>
                            <span style={{ marginLeft: 6, color: '#666' }}>{num}</span>
                        </div>
                        <div>
                            <span style={{ fontWeight: 'bold', color: 'inherit' }}>Time:</span>
                            <span style={{ marginLeft: 6, color: '#666' }}>{createdStr}</span>
                        </div>
                        <div>
                            <span style={{ fontWeight: 'bold', color: 'inherit' }}>Point Of Sale:</span>
                            <span style={{ marginLeft: 6, color: '#666' }}>{ps}</span>
                        </div>
                        {user && (
                            <div>
                                <span style={{ fontWeight: 'bold', color: 'inherit' }}>Created by:</span>
                                <span style={{ marginLeft: 6, color: '#666' }}>{user}</span>
                            </div>
                        )}
                        <div>
                            <span style={{ fontWeight: 'bold', color: 'inherit' }}>Is Chira:</span>
                            <span style={{ marginLeft: 6, color: isChira ? '#388e3c' : '#d32f2f' }}>{isChira ? 'Yes' : 'No'}</span>
                            {isChira ? (
                                <Button
                                    variant="outlined"
                                    color="primary"
                                    size="small"
                                    sx={{ ml: 2, fontSize: 12, py: 0.5, px: 1.5 }}
                                    onClick={() => {
                                        setChiraDialogIdFact(row.original.id_fact);
                                        setChiraDialogOpen(true);
                                    }}
                                >
                                    Return Chira
                                </Button>
                            ) : (
                                !isChiraFieldsEmpty && (
                                    <div style={{ marginTop: 8, background: '#f9fbe7', borderRadius: 4, padding: '8px 12px', fontSize: 12 }}>
                                        <div>
                                            <span style={{ fontWeight: 'bold', color: '#388e3c' }}>Return Date:</span>
                                            <span style={{ marginLeft: 6 }}>{returnChira || '-'}</span>
                                        </div>
                                       
                                        <div>
                                            <span style={{ fontWeight: 'bold', color: '#d32f2f' }}>Return By:</span>
                                            <span style={{ marginLeft: 6 }}>{usrReceiveChiraName || '-'}</span>
                                        </div>
                                         <div>
                                            <span style={{ fontWeight: 'bold', color: '#1976d2' }}>Comment Chira:</span>
                                            <span style={{ marginLeft: 6 }}>{commentChira || '-'}</span>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                );
            },
            size: 250,
        },



        {
            accessorKey: 'design_weight_code',
            header: 'Product Details',
            Cell: (props: any) => {
                const { row } = props;
                // Show all product details for this invoice
                const details: any[] = row.original._productDetails || [];
                const prix_vente_remise = row.original.prix_vente_remise;



                // For each product, fetch its own images (by achat.picint) if available
                // Show product-level images if present, else fallback to invoice-level images

                if (details.length === 0) return '';
                return (
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <tbody>
                            {details.map((d: any, idx: number) => {
                                // Find the matching row in the original data by id_fact
                                const matchingRow = data.find((row: any) => {
                                    if (Array.isArray(row.ACHATs)) {
                                        return row.ACHATs.some((achat: any) => achat.id_fact === d.code);
                                    }
                                    return false;
                                });

                                // Get the picint for this product row
                                let productPicint = matchingRow.picint;



                                const getProductImages = (achatPicint: number | undefined) => {

                                    if (achatPicint && imageBlobUrls[achatPicint]) {
                                        return imageBlobUrls[achatPicint];
                                    }
                                    return [];
                                };

                                const productBlobUrls = getProductImages(productPicint);
                                return (
                                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '2px 6px', verticalAlign: 'middle' }}>
                                            {d.design} | {d.weight} | {d.code} | {d.typeSupplier} | {prix_vente_remise } {d.typeSupplier?.toLowerCase().includes('gold') ? 'LYD' : 'USD'}  
                                            {d.IS_GIFT === true && (
                                                <span title="Gift" style={{ marginLeft: 8, color: '#d32f2f', verticalAlign: 'middle' }}>
                                                    🎁
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '2px 6px', verticalAlign: 'middle', minWidth: 52, maxWidth: 220 }}>
                                            {productBlobUrls.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: 4, overflowX: 'auto', whiteSpace: 'nowrap' }}>
                                                    {productBlobUrls.map((url: string, i: number) => (
                                                        <img
                                                            key={i}
                                                            src={url}
                                                            alt={`Product Img ${i + 1}`}
                                                            style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4, border: '1px solid #eee', flex: '0 0 auto', cursor: 'pointer' }}
                                                            onClick={() => {
                                                                setImageDialogUrl(url);
                                                                setImageDialogOpen(true);
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            ) : (
                                                <span style={{ color: '#aaa' }}>No Image</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                );
            },
            size: 320,
        },


        {
            accessorKey: 'Client',
            header: 'Client',
            Cell: ({ cell }) => {
                const value = cell.getValue() as any;
                let display = '';
                if (value && typeof value === 'object') {
                    const name = value.client_name || '';
                    const tel = value.tel_client || '';
                    display = `${name}${name && tel ? ' - ' : ''}${tel}`;
                } else if (value === 0) {
                    display = '';
                }
                return (
                    <div style={{ minWidth: 120, maxWidth: 220, whiteSpace: 'wrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {display}
                    </div>
                );
            },
            size: 180,
        },

        //  { accessorKey: 'COMMENT', header: 'Comment', size: 200 },
        {
            accessorKey: 'IS_OK',
            header: 'Is Closed',
            Cell: ({ cell, row }) => {
                const isClosed = cell.getValue();
                if (isClosed) {
                    return (
                        <span style={{ display: 'flex', alignItems: 'center', color: '#388e3c', fontWeight: 600, gap: 4 }}>
                            <LockIcon fontSize="small" sx={{ mr: 0.5 }} />
                            {'Closed Invoice'}
                        </span>
                    );
                }
                return (
                    <span style={{ display: 'flex', alignItems: 'center', color: '#fbc02d', fontWeight: 600, gap: 4 }}>
                        <LockIcon fontSize="small" sx={{ mr: 0.5, opacity: 0.6, transform: 'rotate(-45deg)' }} />
                        {'Open invoice'}
                    </span>
                );
            },
            size: 170,
        },
        {
            header: 'Amounts',
            id: 'amounts',
            size: 320,
            Cell: ({ row }) => {
                const totalRemiseFinal = row.original.total_remise_final ?? '';
                const amountCurrency = row.original.amount_currency ?? '';
                const amountLyd = row.original.amount_lyd ?? '';
                const amountEur = row.original.amount_EUR ?? '';
                const amountCurrencyLyd = row.original.amount_currency_LYD ?? '';
                const amountEurLyd = row.original.amount_EUR_LYD ?? '';

                // Helper to format numbers with comma and point
                const formatNumber = (value: any) => {
                    if (typeof value === 'number') {
                        return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    }
                    if (typeof value === 'string' && value !== '') {
                        const num = Number(value);
                        if (!isNaN(num)) {
                            return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        }
                        return value;
                    }
                    return value;
                };

                return (
                    <div style={{ whiteSpace: 'pre-line', fontSize: 12 }}>
                        {totalRemiseFinal !== 0 && (
                            <div>
                                <span style={{ fontWeight: 'bold', color: '#1976d2' }}>Total Invoice:</span>
                                <span style={{ marginLeft: 6 }}>
                                    {row.original?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes('gold')
                                        ? `${formatNumber(totalRemiseFinal)} LYD`
                                        : `${formatNumber(totalRemiseFinal)} USD`}
                                </span>
                                {/* Price/g for gold only */}
                                {row.original?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes('gold') && (() => {
                                    const qty = Number(row.original?.ACHATs?.[0]?.qty);
                                    const total = Number(row.original.total_remise_final);
                                    if (!isNaN(qty) && qty > 0 && !isNaN(total) && total > 0) {
                                        return (
                                            <span style={{ marginLeft: 12, color: '#388e3c', fontWeight: 'bold' }}>
                                                Price/g: {formatNumber(total / qty)}
                                            </span>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        )}
                        {/* Discount Value */}
                        {row.original.remise > 0 && (
                            <div>
                                <span style={{ fontWeight: 'bold', color: '#d32f2f' }}>Discount Value:</span>
                                <span style={{ marginLeft: 6, color: '#d32f2f' }}>{formatNumber(row.original.remise)}</span>
                            </div>
                        )}
                        {/* Discount Percentage */}
                        {row.original.remise_per > 0 && (
                            <div>
                                <span style={{ fontWeight: 'bold', color: '#d32f2f' }}>Discount %:</span>
                                <span style={{ marginLeft: 6, color: '#d32f2f' }}>{formatNumber(row.original.remise_per)}</span>
                            </div>
                        )}
                        {amountLyd !== 0 && (
                            <div>
                                <span style={{ fontWeight: 'bold', color: '#555' }}>LYD Due:</span>
                                <span style={{ marginLeft: 6 }}>{formatNumber(amountLyd)}</span>
                            </div>
                        )}
                        {amountCurrency !== 0 && (
                            <div>
                                <span style={{ fontWeight: 'bold', color: '#555' }}>USD Due:</span>
                                <span style={{ marginLeft: 6 }}>{formatNumber(amountCurrency)}</span>
                                {amountCurrencyLyd !== 0 && (
                                    <>
                                        <span style={{ fontWeight: 'bold', color: '#888', marginLeft: 12 }}>Equi. in LYD:</span>
                                        <span style={{ marginLeft: 6 }}>{formatNumber(amountCurrencyLyd)}</span>
                                    </>
                                )}
                            </div>
                        )}
                        {amountEur !== 0 && (
                            <div>
                                <span style={{ fontWeight: 'bold', color: '#555' }}>EUR Due:</span>
                                <span style={{ marginLeft: 6 }}>{formatNumber(amountEur)}</span>
                                {amountEurLyd !== 0 && (
                                    <>
                                        <span style={{ fontWeight: 'bold', color: '#888', marginLeft: 12 }}>Equi. in LYD:</span>
                                        <span style={{ marginLeft: 6 }}>{formatNumber(amountEurLyd)}</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                );
            },
        },

        {
            accessorKey: 'SourceMark',
            header: 'Source Mark',
        },


        // Nested fields as JSON



        {
            accessorKey: 'print_invoice',
            header: 'Print Invoice',
            size: 180,
            Cell: ({ row }) => (
                <Button
                    variant="outlined"
                    color="inherit"
                    style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
                    onClick={() => {
                        setSelectedInvoice(row.original);
                        setPrintDialogOpen(true);
                    }}
                >
                    Print Invoice
                </Button>
            ),
        },



    ];

    // Helper to build PrintInvoiceDialog data (mimic GNew_I)
    function buildPrintDialogData(invoice: any) {
        // Find client info
        const customer = invoice.Client || undefined;
        // Items: for compatibility, pass as array with one invoice
        const items = [invoice];
        // Totals
        const totalAmountLYD = Number(invoice.amount_lyd) || 0;
        const totalAmountUSD = Number(invoice.amount_currency) || 0;
        const totalAmountEur = Number(invoice.amount_EUR) || 0;
        const totalWeight = invoice._productDetails?.reduce((sum: number, d: any) => sum + (Number(d.weight) || 0), 0) || 0;
        const itemCount = invoice._productDetails?.length || 0;
        const amount_currency_LYD = Number(invoice.amount_currency_LYD) || 0;
        const amount_EUR_LYD = Number(invoice.amount_EUR_LYD) || 0;
        return {
            invoice,
            items,
            customer,
            totalAmountLYD,
            totalAmountUSD,
            totalAmountEur,
            totalWeight,
            itemCount,
            amount_currency_LYD,
            amount_EUR_LYD,
            type: invoice?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase() || '',
            picint: invoice.picint,
            Original_Invoice: invoice.Original_Invoice || '',
            remise: invoice.remise,
            remise_per: invoice.remise_per,
        };
    }

    // Build styled HTML with embedded images for export (used by HTML and Excel exports)
    async function generateExportHtml(): Promise<string> {
        // Convert all product images to base64 for export
        async function blobUrlToBase64(blobUrl: string): Promise<string> {
            return new Promise((resolve, reject) => {
                fetch(blobUrl)
                    .then(res => res.blob())
                    .then(blob => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    })
                    .catch(reject);
            });
        }
        // Build a map of picint to base64 image data URLs
        const picintToBase64: Record<string, string[]> = {};
        for (const [picint, urls] of Object.entries(imageBlobUrls)) {
            picintToBase64[picint] = [];
            for (const url of urls) {
                try {
                    const base64 = await blobUrlToBase64(url);
                    picintToBase64[picint].push(base64);
                } catch {
                    // skip if error
                }
            }
        }
        const logoUrl = '/logo.png';
        let html = `
        <html>
        <head>
            <meta charset="utf-8" />
            <title>Sales Report Export</title>
            <style>
                body { font-family: Roboto, 'Segoe UI', Arial, sans-serif; background: #fafafa; color: #212121; margin: 0; padding: 0; }
                .export-header { display: flex; align-items: center; gap: 16px; background: #fff; padding: 16px 24px; border-bottom: 1px solid #e0e0e0; }
                .export-logo { height: 48px; }
                .export-title { font-size: 1.5rem; font-weight: 600; color: #1976d2; letter-spacing: .3px; }
                .export-table { width: 98%; margin: 16px auto; border-collapse: collapse; background: #fff; border: 1px solid #e0e0e0; }
                .export-table th, .export-table td { border: 1px solid #e0e0e0; padding: 8px 12px; font-size: 0.95rem; vertical-align: top; }
                .export-table th { background: #f5f5f5; color: #424242; font-weight: 600; text-align: left; }
                .export-table tr:nth-child(even) { background: #fafafa; }
                .export-footer { margin: 16px auto 0 auto; text-align: center; color: #757575; font-size: 0.9rem; }
                .export-img-row { display: flex; flex-direction: row; gap: 6px; flex-wrap: wrap; }
                .export-img-row img { width: 64px; height: 64px; object-fit: cover; border-radius: 4px; border: 1px solid #e0e0e0; }
                .export-product-table { width: 100%; border-collapse: collapse; margin: 0; }
                .export-product-table th, .export-product-table td { border: 1px solid #eeeeee; padding: 4px 6px; font-size: 0.9rem; }
                .export-product-table th { background: #f0f7ff; color: #1976d2; font-weight: 600; }
                .export-product-label { font-weight: 600; color: #1976d2; margin: 6px 0 4px; display: block; }
                .chip { display:inline-block; padding: 2px 6px; font-size:.8rem; border-radius: 12px; border:1px solid #e0e0e0; background:#fafafa; color:#616161 }
            </style>
        </head>
        <body>
            <div class="export-header">
                <img src="${logoUrl}" class="export-logo" alt="Logo" />
                <span class="export-title">Sales Report</span>
            </div>
            <table class="export-table">
                <thead>
                    <tr>
                        <th>Invoice Info</th>
                        <th>Product Details</th>
                        <th>Client</th>
                        <th>Is Closed</th>
                        <th>Amounts</th>
                        <th>Source Mark</th>
                    </tr>
                </thead>
                <tbody>
        `;
        sortedData.forEach((row: any) => {
            const client = row.Client ? `${row.Client.client_name || ''}${row.Client.client_name && row.Client.tel_client ? ' - ' : ''}${row.Client.tel_client || ''}` : '';

            // Build Invoice Info block (mimics on-screen cell)
            const created = row.d_time ? new Date(row.d_time) : null;
            let createdStr = '';
            if (created) {
                let hours = created.getHours();
                const minutes = created.getMinutes().toString().padStart(2, '0');
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12; hours = hours ? hours : 12;
                createdStr = `${hours}:${minutes} ${ampm}`;
            }
            const user = row.Utilisateur && row.Utilisateur.name_user ? row.Utilisateur.name_user : '';
            const isChiraFlag = row.is_chira === true || row.is_chira === 1;
            const returnChira = row.return_chira;
            const commentChira = row.comment_chira;
            const usrReceiveChira = row.usr_receive_chira;
            const invoiceInfoHtml = `
                <div style="font-size:12px;line-height:1.35">
                    <div><b>Date:</b> <span class="chip">${row.date_fact || ''}</span></div>
                    <div><b>Invoice No:</b> <span class="chip">${row.num_fact || ''}</span></div>
                    <div><b>Time:</b> ${createdStr}</div>
                    <div><b>Point Of Sale:</b> ${row.ps || ''}</div>
                    ${user ? `<div><b>Created by:</b> ${user}</div>` : ''}
                    <div><b>Is Chira:</b> <span style="color:${isChiraFlag ? '#388e3c' : '#d32f2f'};font-weight:600">${isChiraFlag ? 'Yes' : 'No'}</span></div>
                    ${(!isChiraFlag && (returnChira || commentChira || usrReceiveChira)) ? `
                        <div style="margin-top:4px;background:#f9fbe7;border-radius:4px;padding:6px 8px">
                            ${returnChira ? `<div><b style='color:#388e3c'>Return Date:</b> ${returnChira}</div>` : ''}
                            ${usrReceiveChira ? `<div><b style='color:#d32f2f'>Return By:</b> ${usrReceiveChira}</div>` : ''}
                            ${commentChira ? `<div><b style='color:#1976d2'>Comment Chira:</b> ${commentChira}</div>` : ''}
                        </div>` : ''}
                </div>
            `;

            // Product Details with inline images (mimics on-screen layout)
            let detailsHtml = '';
            if (row._productDetails && row._productDetails.length > 0) {
                detailsHtml = `<table class='export-product-table'><thead><tr><th>Design | Weight | Code | Type | Price</th></tr></thead><tbody>`;
                row._productDetails.forEach((d: any, idx: number) => {
                    const price = row.prix_vente_remise ? `${row.prix_vente_remise} ${d.typeSupplier?.toLowerCase().includes('gold') ? 'LYD' : 'USD'}` : '';
                    const lineText = `${d.design} | ${d.weight || ''} | ${d.code} | ${d.typeSupplier} ${price ? ' | ' + price : ''}`;
                    const picint = d.picint;
                    const urls = picint && picintToBase64[picint] ? picintToBase64[picint] : [];
                    const gift = d.IS_GIFT === true ? ' <span title="Gift">🎁</span>' : '';
                    const imagesRow = urls.length > 0
                        ? `<div class='export-img-row'>${urls.map((u: string) => `<img src='${u}' alt='Product' />`).join('')}</div>`
                        : `<span style='color:#9e9e9e'>No Image</span>`;
                    detailsHtml += `<tr><td>${lineText}${gift}<div style='margin-top:4px'>${imagesRow}</div></td></tr>`;
                });
                detailsHtml += `</tbody></table>`;
            }

            const isClosed = row.IS_OK
                ? '<span style="color:#388e3c;font-weight:600">🔒 Closed Invoice</span>'
                : '<span style="color:#fbc02d;font-weight:600">🔓 Open invoice</span>';

            // Amounts block matches screen content
            const isGold = !!row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes('gold');
            const total = Number(row.total_remise_final) || 0;
            let pricePerG = '';
            if (isGold) {
                const qtyG = Number(row?.ACHATs?.[0]?.qty);
                if (!isNaN(qtyG) && qtyG > 0 && total > 0) pricePerG = (total / qtyG).toFixed(2);
            }
            const amountsHtml = `
                <div style='font-size:12px;line-height:1.4'>
                    ${total ? `<div><b style='color:#1976d2'>Total Invoice:</b> ${total.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})} ${isGold ? 'LYD' : 'USD'} ${pricePerG ? `<span style='margin-left:8px;color:#388e3c;font-weight:600'>Price/g: ${pricePerG}</span>` : ''}</div>` : ''}
                    ${row.remise > 0 ? `<div><b style='color:#d32f2f'>Discount Value:</b> ${Number(row.remise).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>` : ''}
                    ${row.remise_per > 0 ? `<div><b style='color:#d32f2f'>Discount %:</b> ${Number(row.remise_per).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>` : ''}
                    ${row.amount_lyd ? `<div><b>LYD Due:</b> ${Number(row.amount_lyd).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>` : ''}
                    ${row.amount_currency ? `<div><b>USD Due:</b> ${Number(row.amount_currency).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}${row.amount_currency_LYD ? `<span style='margin-left:8px;color:#616161'><b>Equi. in LYD:</b> ${Number(row.amount_currency_LYD).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>` : ''}</div>` : ''}
                    ${row.amount_EUR ? `<div><b>EUR Due:</b> ${Number(row.amount_EUR).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}${row.amount_EUR_LYD ? `<span style='margin-left:8px;color:#616161'><b>Equi. in LYD:</b> ${Number(row.amount_EUR_LYD).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>` : ''}</div>` : ''}
                </div>`;

            html += `
                <tr>
                    <td>${invoiceInfoHtml}</td>
                    <td>${detailsHtml}</td>
                    <td>${client}</td>
                    <td>${isClosed}</td>
                    <td>${amountsHtml}</td>
                    <td>${row.SourceMark || ''}</td>
                </tr>
            `;
        });
        html += `
                </tbody>
                <tfoot>
                    <tr style="background:#e3f2fd;font-weight:bold;">
                        <td colspan="5" style="text-align:right;">Total Gold:</td>
                        <td colspan="3" style="text-align:left; color:#1976d2;">${formatNumber(totalGold)} LYD</td>
                    </tr>
                    <tr style="background:#e3f2fd;font-weight:bold;">
                        <td colspan="5" style="text-align:right;">Total Diamond:</td>
                        <td colspan="3" style="text-align:left; color:#1976d2;">${formatNumber(totalDiamond)} USD</td>
                    </tr>
                    <tr style="background:#e3f2fd;font-weight:bold;">
                        <td colspan="5" style="text-align:right;">Total Watch:</td>
                        <td colspan="3" style="text-align:left; color:#1976d2;">${formatNumber(totalWatch)} USD</td>
                    </tr>
                </tfoot>
            </table>
            <div class="export-footer">Generated on ${new Date().toLocaleString()}</div>
        </body>
        </html>
        `;
        return html;
    }

    // --- Export Table to HTML with all data, details, and images ---
    async function exportTableToHtml() {
        const html = await generateExportHtml();
        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
        }
    }

    // --- Export to Excel (.xls via HTML) with styles and images ---
    async function exportTableToExcel() {
        // Build MHTML so images render in Excel
        const mhtml = await generateExportMhtml();
        const blob = new Blob([mhtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const stamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
        link.href = url;
        link.download = `SalesReport_${stamp}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // Generate an MHTML document with embedded images (cid) for Excel
    async function generateExportMhtml(): Promise<string> {
        // 1) Collect images as base64
        async function blobUrlToBase64(blobUrl: string): Promise<string> {
            return new Promise((resolve, reject) => {
                fetch(blobUrl)
                    .then(res => res.blob())
                    .then(blob => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    })
                    .catch(reject);
            });
        }
        const parseDataUrl = (dataUrl: string): { mime: string; base64: string } | null => {
            const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
            if (!match) return null;
            return { mime: match[1] || 'image/png', base64: match[2] };
        };

        // Map picint -> [{ cid, mime, base64 }]
        const picintToCidImages: Record<string, { cid: string; mime: string; base64: string }[]> = {};
        const allImages: { cid: string; mime: string; base64: string }[] = [];
        let idx = 1;
        for (const [picint, urls] of Object.entries(imageBlobUrls)) {
            picintToCidImages[picint] = [];
            for (const url of urls) {
                try {
                    const b64url = await blobUrlToBase64(url);
                    const parsed = parseDataUrl(b64url);
                    if (!parsed) continue;
                    const cid = `image${String(idx++).padStart(4, '0')}`;
                    const part = { cid, mime: parsed.mime, base64: parsed.base64 };
                    picintToCidImages[picint].push(part);
                    allImages.push(part);
                } catch {
                    // skip
                }
            }
        }

        // 2) Build HTML body that references images by cid
    // optional: embed a logo if desired by adding a cid image part and referencing it here
        const headerHtml = `
            <div class="export-header">
                <span class="export-title">Sales Report</span>
            </div>`;

        // Reuse same styles and table structure as generateExportHtml
        let htmlBody = `
        <html>
        <head>
            <meta charset="utf-8" />
            <title>Sales Report Export</title>
            <style>
                body { font-family: Roboto, 'Segoe UI', Arial, sans-serif; background: #fafafa; color: #212121; margin: 0; padding: 0; }
                .export-header { display: flex; align-items: center; gap: 16px; background: #fff; padding: 16px 24px; border-bottom: 1px solid #e0e0e0; }
                .export-title { font-size: 1.5rem; font-weight: 600; color: #1976d2; letter-spacing: .3px; }
                .export-table { width: 98%; margin: 16px auto; border-collapse: collapse; background: #fff; border: 1px solid #e0e0e0; }
                .export-table th, .export-table td { border: 1px solid #e0e0e0; padding: 8px 12px; font-size: 0.95rem; vertical-align: top; }
                .export-table th { background: #f5f5f5; color: #424242; font-weight: 600; text-align: left; }
                .export-table tr:nth-child(even) { background: #fafafa; }
                .export-footer { margin: 16px auto 0 auto; text-align: center; color: #757575; font-size: 0.9rem; }
                .export-img-row { display: flex; flex-direction: row; gap: 6px; flex-wrap: wrap; }
                .export-img-row img { width: 64px; height: 64px; object-fit: cover; border-radius: 4px; border: 1px solid #e0e0e0; }
                .export-product-table { width: 100%; border-collapse: collapse; margin: 0; }
                .export-product-table th, .export-product-table td { border: 1px solid #eeeeee; padding: 4px 6px; font-size: 0.9rem; }
                .export-product-table th { background: #f0f7ff; color: #1976d2; font-weight: 600; }
                .export-product-label { font-weight: 600; color: #1976d2; margin: 6px 0 4px; display: block; }
                .chip { display:inline-block; padding: 2px 6px; font-size:.8rem; border-radius: 12px; border:1px solid #e0e0e0; background:#fafafa; color:#616161 }
            </style>
        </head>
        <body>
            ${headerHtml}
            <table class="export-table">
                <thead>
                    <tr>
                        <th>Invoice Info</th>
                        <th>Product Details</th>
                        <th>Client</th>
                        <th>Is Closed</th>
                        <th>Amounts</th>
                        <th>Source Mark</th>
                    </tr>
                </thead>
                <tbody>`;

        sortedData.forEach((row: any) => {
            const client = row.Client ? `${row.Client.client_name || ''}${row.Client.client_name && row.Client.tel_client ? ' - ' : ''}${row.Client.tel_client || ''}` : '';
            const created = row.d_time ? new Date(row.d_time) : null;
            let createdStr = '';
            if (created) {
                let hours = created.getHours();
                const minutes = created.getMinutes().toString().padStart(2, '0');
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12; hours = hours ? hours : 12;
                createdStr = `${hours}:${minutes} ${ampm}`;
            }
            const user = row.Utilisateur && row.Utilisateur.name_user ? row.Utilisateur.name_user : '';
            const isChiraFlag = row.is_chira === true || row.is_chira === 1;
            const returnChira = row.return_chira;
            const commentChira = row.comment_chira;
            const usrReceiveChira = row.usr_receive_chira;
            const invoiceInfoHtml = `
                <div style="font-size:12px;line-height:1.35">
                    <div><b>Date:</b> <span class="chip">${row.date_fact || ''}</span></div>
                    <div><b>Invoice No:</b> <span class="chip">${row.num_fact || ''}</span></div>
                    <div><b>Time:</b> ${createdStr}</div>
                    <div><b>Point Of Sale:</b> ${row.ps || ''}</div>
                    ${user ? `<div><b>Created by:</b> ${user}</div>` : ''}
                    <div><b>Is Chira:</b> <span style="color:${isChiraFlag ? '#388e3c' : '#d32f2f'};font-weight:600">${isChiraFlag ? 'Yes' : 'No'}</span></div>
                    ${(!isChiraFlag && (returnChira || commentChira || usrReceiveChira)) ? `
                        <div style="margin-top:4px;background:#f9fbe7;border-radius:4px;padding:6px 8px">
                            ${returnChira ? `<div><b style='color:#388e3c'>Return Date:</b> ${returnChira}</div>` : ''}
                            ${usrReceiveChira ? `<div><b style='color:#d32f2f'>Return By:</b> ${usrReceiveChira}</div>` : ''}
                            ${commentChira ? `<div><b style='color:#1976d2'>Comment Chira:</b> ${commentChira}</div>` : ''}
                        </div>` : ''}
                </div>`;

            // Build details with cid images
            let detailsHtml = '';
            if (row._productDetails && row._productDetails.length > 0) {
                detailsHtml = `<table class='export-product-table'><thead><tr><th>Design | Weight | Code | Type | Price</th></tr></thead><tbody>`;
                row._productDetails.forEach((d: any) => {
                    const price = row.prix_vente_remise ? `${row.prix_vente_remise} ${d.typeSupplier?.toLowerCase().includes('gold') ? 'LYD' : 'USD'}` : '';
                    const lineText = `${d.design} | ${d.weight || ''} | ${d.code} | ${d.typeSupplier}${price ? ' | ' + price : ''}`;
                    const picint = d.picint;
                    const imgs = picint && picintToCidImages[String(picint)] ? picintToCidImages[String(picint)] : [];
                    const gift = d.IS_GIFT === true ? ' <span title="Gift">🎁</span>' : '';
                    const imagesRow = imgs.length > 0
                        ? `<div class='export-img-row'>${imgs.map((p) => `<img src='cid:${p.cid}' alt='Product' />`).join('')}</div>`
                        : `<span style='color:#9e9e9e'>No Image</span>`;
                    detailsHtml += `<tr><td>${lineText}${gift}<div style='margin-top:4px'>${imagesRow}</div></td></tr>`;
                });
                detailsHtml += `</tbody></table>`;
            }

            const isClosed = row.IS_OK
                ? '<span style="color:#388e3c;font-weight:600">🔒 Closed Invoice</span>'
                : '<span style="color:#fbc02d;font-weight:600">🔓 Open invoice</span>';

            const isGold = !!row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes('gold');
            const total = Number(row.total_remise_final) || 0;
            let pricePerG = '';
            if (isGold) {
                const qtyG = Number(row?.ACHATs?.[0]?.qty);
                if (!isNaN(qtyG) && qtyG > 0 && total > 0) pricePerG = (total / qtyG).toFixed(2);
            }
            const amountsHtml = `
                <div style='font-size:12px;line-height:1.4'>
                    ${total ? `<div><b style='color:#1976d2'>Total Invoice:</b> ${total.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})} ${isGold ? 'LYD' : 'USD'} ${pricePerG ? `<span style='margin-left:8px;color:#388e3c;font-weight:600'>Price/g: ${pricePerG}</span>` : ''}</div>` : ''}
                    ${row.remise > 0 ? `<div><b style='color:#d32f2f'>Discount Value:</b> ${Number(row.remise).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>` : ''}
                    ${row.remise_per > 0 ? `<div><b style='color:#d32f2f'>Discount %:</b> ${Number(row.remise_per).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>` : ''}
                    ${row.amount_lyd ? `<div><b>LYD Due:</b> ${Number(row.amount_lyd).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>` : ''}
                    ${row.amount_currency ? `<div><b>USD Due:</b> ${Number(row.amount_currency).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}${row.amount_currency_LYD ? `<span style='margin-left:8px;color:#616161'><b>Equi. in LYD:</b> ${Number(row.amount_currency_LYD).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>` : ''}</div>` : ''}
                    ${row.amount_EUR ? `<div><b>EUR Due:</b> ${Number(row.amount_EUR).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}${row.amount_EUR_LYD ? `<span style='margin-left:8px;color:#616161'><b>Equi. in LYD:</b> ${Number(row.amount_EUR_LYD).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>` : ''}</div>` : ''}
                </div>`;

            htmlBody += `
                <tr>
                    <td>${invoiceInfoHtml}</td>
                    <td>${detailsHtml}</td>
                    <td>${client}</td>
                    <td>${isClosed}</td>
                    <td>${amountsHtml}</td>
                    <td>${row.SourceMark || ''}</td>
                </tr>`;
        });

        htmlBody += `
                </tbody>
                <tfoot>
                    <tr style="background:#f0f7ff;font-weight:bold;">
                        <td colspan="4" style="text-align:right;">Total Gold:</td>
                        <td colspan="2" style="text-align:left; color:#1976d2;">${formatNumber(totalGold)} LYD</td>
                    </tr>
                    <tr style="background:#f0f7ff;font-weight:bold;">
                        <td colspan="4" style="text-align:right;">Total Diamond:</td>
                        <td colspan="2" style="text-align:left; color:#1976d2;">${formatNumber(totalDiamond)} USD</td>
                    </tr>
                    <tr style="background:#f0f7ff;font-weight:bold;">
                        <td colspan="4" style="text-align:right;">Total Watch:</td>
                        <td colspan="2" style="text-align:left; color:#1976d2;">${formatNumber(totalWatch)} USD</td>
                    </tr>
                </tfoot>
            </table>
            <div class="export-footer">Generated on ${new Date().toLocaleString()}</div>
        </body>
        </html>`;

        // 3) Assemble MHTML
        const boundary = '----=_NextPart_000_0000';
        const EOL = '\r\n';
        let mhtml = '';
        mhtml += 'MIME-Version: 1.0' + EOL;
        mhtml += `Content-Type: multipart/related; boundary="${boundary}"; type="text/html"` + EOL + EOL;

        // HTML part
        mhtml += `--${boundary}` + EOL;
        mhtml += 'Content-Type: text/html; charset="utf-8"' + EOL;
        mhtml += 'Content-Transfer-Encoding: 8bit' + EOL + EOL;
        mhtml += htmlBody + EOL + EOL;

        // Image parts
        allImages.forEach((img, i) => {
            mhtml += `--${boundary}` + EOL;
            mhtml += `Content-Location: file:///image${i + 1}` + EOL;
            mhtml += `Content-Transfer-Encoding: base64` + EOL;
            mhtml += `Content-Type: ${img.mime}` + EOL;
            mhtml += `Content-ID: <${img.cid}>` + EOL + EOL;
            // Excel tolerates unwrapped base64; still split by 76 chars for safety
            for (let p = 0; p < img.base64.length; p += 76) {
                mhtml += img.base64.substring(p, p + 76) + EOL;
            }
            mhtml += EOL;
        });

        // Closing boundary
        mhtml += `--${boundary}--` + EOL;
        return mhtml;
    }

    // Add a ref for the table container
    const tableRef = React.useRef<HTMLDivElement>(null);

    // State for image dialog
    const [imageDialogOpen, setImageDialogOpen] = React.useState(false);
    const [imageDialogUrl, setImageDialogUrl] = React.useState<string | null>(null);

    return (
        <Box sx={{ mt: 4 }}>
            <React.Fragment>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
                    <Typography variant="h5" sx={{ mr: 2 }}>{MODEL_LABELS[type]} All Data</Typography>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel id="type-select-label">Type</InputLabel>
                        <Select
                            labelId="type-select-label"
                            value={type}
                            label="Type"
                            onChange={e => setType(e.target.value as 'all' | 'gold' | 'diamond' | 'watch')}
                        >
                            {typeOptions.map(opt => (
                                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
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
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel id="is-chira-select-label">Is Chra</InputLabel>
                        <Select
                            labelId="is-chira-select-label"
                            value={isChira}
                            label="Is Chra"
                            onChange={e => setIsChira(e.target.value as 'all' | 'yes' | 'no')}
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="yes">Yes</MenuItem>
                            <MenuItem value="no">No</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel id="is-whole-sale-select-label">Is Whole Sale</InputLabel>
                        <Select
                            labelId="is-whole-sale-select-label"
                            value={isWholeSale}
                            label="Is Whole Sale"
                            onChange={e => setIsWholeSale(e.target.value as 'all' | 'yes' | 'no')}
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="yes">Yes</MenuItem>
                            <MenuItem value="no">No</MenuItem>
                        </Select>
                    </FormControl>
                    <Button
                        variant="contained"
                        color="info"
                        sx={{ ml: 2, fontWeight: 600, boxShadow: 2 }}
                        onClick={exportTableToHtml}
                    >
                        Export to HTML
                    </Button>
                    <Button
                        variant="contained"
                        color="success"
                        sx={{ fontWeight: 600, boxShadow: 2 }}
                        onClick={exportTableToExcel}
                    >
                        Export to EXcel
                    </Button>
                </Box>
                {/* Wrap the table in a div with a ref for export */}
                <div ref={tableRef} id="export-table-container">
                    {loading ? <CircularProgress /> : (
                        <MaterialReactTable
                            columns={columns}
                            data={sortedData}
                            enableColumnResizing
                            enableStickyHeader
                            initialState={{ pagination: { pageSize: 6, pageIndex: 0 } }}
                            enableFilters={false}
                            enableGlobalFilter={false}
                            enableFullScreenToggle={false}
                        />
                    )}
                </div>
                {/* Summary totals at the bottom */}
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, gap: 2, flexWrap: 'wrap' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', ml: 2 }}>
                        Invoice Count: {sortedData.length}
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', ml: 2 }}>
                        Item Count: {sortedData.reduce((sum, row) => sum + (Array.isArray(row._productDetails) ? row._productDetails.length : 0), 0)}
                    </Typography>
                    {totalWeight !== 0 && (
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', ml: 2 }}>
                            Total Weight (gram): {formatNumber(totalWeight)}
                        </Typography>
                    )}
                    {totalGold !== 0 && (
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', ml: 2 }}>
                            Gold Total: {formatNumber(totalGold)} LYD
                        </Typography>
                    )}
                    {totalDiamond !== 0 && (
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', ml: 2 }}>
                            Diamond Total: {formatNumber(totalDiamond)} USD
                        </Typography>
                    )}
                    {totalWatch !== 0 && (
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', ml: 2 }}>
                            Watch Total: {formatNumber(totalWatch)} USD
                        </Typography>
                    )}
                </Box>
                <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
                    <DialogTitle>Details</DialogTitle>
                    <DialogContent>
                        <pre style={{ fontSize: 10, margin: 0 }}>{JSON.stringify(detailsData, null, 2)}</pre>
                    </DialogContent>
                </Dialog>
                {printDialogOpen && selectedInvoice && (
                    <PrintInvoiceDialog
                        open={printDialogOpen}
                        invoice={selectedInvoice}
                        data={buildPrintDialogData(selectedInvoice)}
                        printRef={printRef}
                        onClose={() => setPrintDialogOpen(false)}
                        onInvoiceClosed={() => setInvoiceRefreshFlag((f) => f + 1)}
                        showCloseInvoiceActions={true}
                        showCloseInvoice={selectedInvoice && selectedInvoice.IS_OK === false}
                    />
                )}
                {/* Chira Return Dialog */}
                <Dialog open={chiraDialogOpen} onClose={() => setChiraDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Return Chira</DialogTitle>
                    <DialogContent>
                        {chiraDialogIdFact && (
                            <ChiraReturnPage
                                id_fact={chiraDialogIdFact}
                                onClose={() => setChiraDialogOpen(false)}
                                onUpdated={() => setChiraRefreshFlag(f => f + 1)}
                            />
                        )}
                    </DialogContent>
                </Dialog>
                {/* Image Dialog for big image preview */}
                <Dialog open={imageDialogOpen} onClose={() => setImageDialogOpen(false)} maxWidth="md" fullWidth>
                    <DialogTitle>Product Image</DialogTitle>
                    <DialogContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                        {imageDialogUrl ? (
                            <img src={imageDialogUrl} alt="Big Product" style={{ maxWidth: '100%', maxHeight: 500, borderRadius: 8, boxShadow: '0 2px 12px #0002', display: 'block' }} />
                        ) : (
                            <Typography variant="body2" color="text.secondary">No image selected</Typography>
                        )}
                    </DialogContent>
                </Dialog>
            </React.Fragment>
        </Box>
    );
};

export default SalesReportsTable;
