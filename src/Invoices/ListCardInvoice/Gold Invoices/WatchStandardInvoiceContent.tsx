import React, { forwardRef, useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { Box, Typography, Table, TableBody, TableCell, TableHead, TableRow, Checkbox, FormControlLabel } from '@mui/material';
import { Invoice, Client } from './PrintInvoiceDialog';
import axios from 'axios';


interface InvoicePrintData {
    invoice: Invoice;
    items: Invoice[];
    customer: Client | undefined;
    totalAmountLYD: number;
    totalAmountUSD: number;
    totalAmountEur: number;
    totalWeight: number;
    TotalAmountFinal: number;
    itemCount: number;
    amount_currency_LYD: number;
    amount_EUR_LYD: number;
    picint: number;
    remise: number;
    remise_per: number;

}





interface Props {
    data: InvoicePrintData;
    num_fact?: number; // Add num_fact as an optional prop
    showImage?: boolean; // Add showImage prop
}

const WatchStandardInvoiceContent = forwardRef<HTMLDivElement, Props>(({ data, num_fact, showImage = true }, ref) => {

    const { TotalAmountFinal, invoice, items, customer, totalAmountLYD, totalAmountUSD, totalAmountEur, totalWeight, itemCount } = data;
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


    const [typeinv, setTypeinv] = useState(() => {
        // Try to get TYPE_SUPPLIER from the first ACHATs item, fallback to Design_art if available
        if (invoice.ACHATs && invoice.ACHATs.length > 0) {
            return invoice.ACHATs[0]?.Fournisseur?.TYPE_SUPPLIER || '';
        }
        return '';
    });


    // Filter pdata by num_fact at the top of the component
    const [pdata, setPData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const apiUrlinv = "http://102.213.182.8:9000/invoices";
    const apiUrlWatches = "http://102.213.182.8:9000/WOpurchases";



    // Use num_fact from props if provided, otherwise from data.invoice
    const invoiceNumFact = typeof num_fact !== 'undefined' ? num_fact : invoice.num_fact;

    const fetchDataINV = async () => {


        const token = localStorage.getItem('token');
        setLoading(true);
        try {
            const res = await axios.get<any[]>(`${apiUrlinv}/allDetails`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { ps: ps, num_fact: invoiceNumFact }
            });
            setPData(res.data);


          

        } catch (err: any) {

        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDataINV();
        // eslint-disable-next-line
    }, []);

    // Find the invoice in pdata that matches the current invoice number
    const currentInvoiceData = pdata.find((inv: any) => inv.num_fact === invoiceNumFact) || {};

    const qrData = JSON.stringify({
        invoiceNo: invoice.num_fact,
        date: invoice.date_fact,
        customer: customer?.client_name,
        totalLYD: totalAmountLYD,
        totalUSD: totalAmountUSD,
        totalEUR: totalAmountEur,
        totalWeight,
        itemCount,
        items: items.map(i => ({ id: i.id_art, qty: i.qty, price: i.prix_vente, currency: i.currency }))
    });



    // Store all watch details by picint or id_achat
    const [allWatchDetails, setAllWatchDetails] = useState<{ [key: string]: any }>({});

    // Fetch all watch details for each row after pdata loads
    useEffect(() => {
        const fetchAllDetails = async () => {
            if (typeinv && typeinv.toLowerCase().includes('watch')) {
                // Use only inv.picint from each invoice in pdata
                const uniqueIds = Array.from(new Set(pdata.map(inv => inv.picint).filter(Boolean)));
                const token = localStorage.getItem('token');
                const detailsMap: { [key: string]: any } = {};
                await Promise.all(uniqueIds.map(async (id) => {
                    try {
                        const res = await axios.get(`${apiUrlWatches}/getitem/${id}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        detailsMap[id] = Array.isArray(res.data) ? res.data[0] : res.data;
                    } catch {
                        detailsMap[id] = null;
                    }
                }));
                setAllWatchDetails(detailsMap);
            } else {
                setAllWatchDetails({});
            }
        };
        fetchAllDetails();
        // eslint-disable-next-line
    }, [pdata, typeinv]);

    const API_BASEImage = 'http://102.213.182.8:9000/images';



    const [imageUrls, setImageUrls] = useState<Record<string, string[]>>({});

    // Fetch all images for a given picint (or id_achat)
    const fetchImages = async (picint: number) => {
        const token = localStorage.getItem('token');
        try {
            // Adjust the endpoint as needed for your backend
            const res = await axios.get(`${API_BASEImage}/list/${picint}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (Array.isArray(res.data)) {
                setImageUrls(prev => ({ ...prev, [picint]: res.data }));
            } else {
                setImageUrls(prev => ({ ...prev, [picint]: [] }));
            }
        } catch {
            // setImageUrls(prev => ({ ...prev, [picint]: [] }));
        }
    };

    // Fetch images for all relevant rows after allWatchDetails loads
    useEffect(() => {
        if (typeinv && typeinv.toLowerCase().includes('watch')) {
            const picints = Object.keys(allWatchDetails).filter(Boolean);
            picints.forEach(id => {
                if (id && !imageUrls[id]) {
                    fetchImages(Number(id));
                }
            });
        }
        // eslint-disable-next-line
    }, [allWatchDetails, typeinv]);

    return (
        <Box ref={ref} sx={{ p: 1, background: '#fff', color: '#000', minWidth: 700 }}>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>

                    <img src="/logo.png" alt="GAJA Logo" style={{ height: 80, marginBottom: 8, marginLeft: -15 }} />

                    <Typography variant="h5" fontWeight="bold">
                        {typeinv.toLowerCase().includes('gold')
                            ? 'Gold Invoice'
                            : typeinv.toLowerCase().includes('watch')
                                ? 'Watch Invoice'
                                : typeinv.toLowerCase().includes('diamond')
                                    ? 'Diamond Invoice'
                                    : 'Invoice'}
                    </Typography>
                    <Typography variant="subtitle1">
                        Invoice No: {invoiceNumFact === 0 ? (
                            <span style={{ color: 'red' }}>In Progress</span>
                        ) : invoiceNumFact}
                    </Typography>
                    <Typography variant="subtitle2">Date: {currentInvoiceData.date_fact || invoice.date_fact}</Typography>
                    <Typography variant="subtitle2">
                        Customer: {pdata[0]?.Client?.client_name || 'N/A'}
                        ({pdata[0]?.Client?.tel_client})
                    </Typography>
                </Box>
                <Box sx={{ borderColor: '#fff', background: '#fff', p: 1, borderRadius: 2, boxShadow: 1 }}>
                    <QRCode value={qrData} size={100} />
                </Box>
            </Box>
            <Table size="small" sx={{ mb: 2, background: '#fff', fontSize: 11 }}>
                <TableHead sx={{ background: '#fff' }}>
                    <TableRow>
                        {/* New Image column */}
                        {showImage && <TableCell sx={{ color: '#000' }}>Image</TableCell>}
                        <TableCell sx={{ color: '#000' }}>ID</TableCell>

                        {/* Hide Price column if gold */}
                        {!(typeinv && typeinv.toLowerCase().includes('gold')) && (
                            <TableCell sx={{ color: '#000' }}>Price</TableCell>
                        )}
                        {typeinv && typeinv.toLowerCase().includes('gold') && (
                            <>
                                <TableCell sx={{ color: '#000' }}>Weight</TableCell>
                                <TableCell sx={{ color: '#000' }}>Gold Color</TableCell>
                                <TableCell sx={{ color: '#000' }}>Rush Color</TableCell>
                                <TableCell sx={{ color: '#000' }}>Sise</TableCell>
                            </>
                        )}
                        {typeinv && !typeinv.toLowerCase().includes('gold') && (
                            <TableCell sx={{ color: '#000' }}>Details</TableCell>
                        )}
                        <TableCell sx={{ color: '#000' }}></TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={
                                (showImage ? 1 : 0) +
                                2 + // ID, Design
                                (typeinv && typeinv.toLowerCase().includes('gold') ? 4 : 1) + // Weight, Gold Color, Rush Color, Size OR Price/Details
                                1 // IS_GIFT
                            } align="center">
                                Loading data...
                            </TableCell>
                        </TableRow>
                    ) : (
                        <>
                            {pdata
                                .flatMap(inv => (inv.ACHATs || []).map((item: any) => ({ ...item, _parent: inv })))
                                .map((item: any, idx: number) => {
                                    if (!item) return null;
                                    let detailsContent = null;
                                    // Defensive: check if item.id_achat is defined
                                    // Use the parent invoice's picint for mapping details for each row
                                    if (typeinv && typeinv.toLowerCase().includes('watch')) {
                                        const parentInvoice = item._parent;
                                        const rowId = parentInvoice?.picint;

                                        const rowDetails = allWatchDetails[rowId];

 



                                        detailsContent = rowDetails ? (
                                            <Typography sx={{ fontSize: 11, whiteSpace: 'pre-line', textAlign: 'justify' }}>
                                                {rowDetails.id_achat && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Ref.:</span> <span style={{ color: '#1976d2' }}>{rowDetails.id_achat}</span>;{' '}
                                                    </span>
                                                )}
                                                {rowDetails.Brand && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Brand:</span> <span style={{ color: '#1976d2' }}>{rowDetails?.brand.client_name}</span>;{' '}
                                                    </span>
                                                )}

                                                {rowDetails.common_local_brand && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Local Brand:</span> <span style={{ color: '#1976d2' }}>{rowDetails.common_local_brand}</span>;{' '}
                                                    </span>
                                                )}

                                                {rowDetails.model && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Model:</span> <span style={{ color: '#1976d2' }}>{rowDetails.model}</span>;{' '}
                                                    </span>
                                                )}
                                                {rowDetails.reference_number && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Reference Number:</span> <span style={{ color: '#1976d2' }}>{rowDetails.reference_number}</span>;{' '}
                                                    </span>
                                                )}
                                                {rowDetails.serial_number && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Serial Number:</span> <span style={{ color: '#1976d2' }}>{rowDetails.serial_number}</span>;{' '}
                                                    </span>
                                                )}
                                                {rowDetails.movement && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Movement:</span> <span style={{ color: '#1976d2' }}>{rowDetails.movement}</span>;{' '}
                                                    </span>
                                                )}
                                                {rowDetails.caliber && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Caliber:</span> <span style={{ color: '#1976d2' }}>{rowDetails.caliber}</span>;{' '}
                                                    </span>
                                                )}
                                                {rowDetails.gender && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Gender:</span> <span style={{ color: '#1976d2' }}>{rowDetails.gender}</span>;{' '}
                                                    </span>
                                                )}
                                                {rowDetails.condition && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Condition:</span> <span style={{ color: '#1976d2' }}>{rowDetails.condition}</span>;{' '}
                                                    </span>
                                                )}
                                                {rowDetails.case_material && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Case Material:</span> <span style={{ color: '#1976d2' }}>{rowDetails.case_material}</span>;{' '}
                                                    </span>
                                                )}
                                                {rowDetails.case_size && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Case Size:</span> <span style={{ color: '#1976d2' }}>{rowDetails.case_size}</span>;{' '}
                                                    </span>
                                                )}
                                                {rowDetails.bezel && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Bezel:</span> <span style={{ color: '#1976d2' }}>{rowDetails.bezel}</span>;{' '}
                                                    </span>
                                                )}
                                                {rowDetails.bracelet_type && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Bracelet Type:</span> <span style={{ color: '#1976d2' }}>{rowDetails.bracelet_type}</span>;{' '}
                                                    </span>
                                                )}
                                                {rowDetails.bracelet_material && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Bracelet Material:</span> <span style={{ color: '#1976d2' }}>{rowDetails.bracelet_material}</span>;{' '}
                                                    </span>
                                                )}
                                                {rowDetails.dial_color && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Dial Color:</span> <span style={{ color: '#1976d2' }}>{rowDetails.dial_color}</span>;{' '}
                                                    </span>
                                                )}
                                                {rowDetails.dial_style && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Dial Style:</span> <span style={{ color: '#1976d2' }}>{rowDetails.dial_style}</span>;{' '}
                                                    </span>
                                                )}
                                                {rowDetails.crystal && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Crystal:</span> <span style={{ color: '#1976d2' }}>{rowDetails.crystal}</span>;{' '}
                                                    </span>
                                                )}
                                                {rowDetails.water_resistance && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Water Resistance:</span> <span style={{ color: '#1976d2' }}>{rowDetails.water_resistance}</span>;{' '}
                                                    </span>
                                                )}
                                                {rowDetails.functions && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Functions:</span> <span style={{ color: '#1976d2' }}>{rowDetails.functions}</span>;{' '}
                                                    </span>
                                                )}
                                                {rowDetails.power_reserve && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Power Reserve:</span> <span style={{ color: '#1976d2' }}>{rowDetails.power_reserve}</span>;{' '}
                                                    </span>
                                                )}
                                                {rowDetails.box_papers !== undefined && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Box & Papers:</span> <span style={{ color: '#1976d2' }}>{rowDetails.box_papers ? 'Yes' : 'No'}</span>;{' '}
                                                    </span>
                                                )}
                                                {rowDetails.warranty && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Warranty:</span> <span style={{ color: '#1976d2' }}>{  rowDetails.warranty} </span>;{' '}
                                                    </span>
                                                )}
                                            </Typography>
                                        ) : (
                                            <Typography sx={{ fontSize: 11, color: '#888' }}>No data</Typography>
                                        );
                                    } else if (item.DistributionPurchase && item.DistributionPurchase.purchaseD) {
                                        const d = item.DistributionPurchase.purchaseD;
                                        detailsContent = (
                                            <Typography sx={{ fontSize: 11, whiteSpace: 'pre-line', textAlign: 'justify' }}>
                                                Ref.: {d.id_achat ?? ''};
                                                Product Name: {d.Design_art ?? ''};
                                                Carat: {d.carat ?? ''}; Cut: {d.cut ?? ''};
                                                Color: {d.color ?? ''}; Clarity: {d.clarity ?? ''};
                                                Shape: {d.shape ?? ''};
                                                Measurements: {d.measurements ?? ''};
                                                Depth %: {d.depth_percent ?? ''};
                                                Table %: {d.table_percent ?? ''};
                                                Girdle: {d.girdle ?? ''}; Culet: {d.culet ?? ''};
                                                Polish: {d.polish ?? ''};
                                                Symmetry: {d.symmetry ?? ''};
                                                Fluorescence: {d.fluorescence ?? ''};
                                                Certificate Number: {d.certificate_number ?? ''};
                                                Certificate Lab: {d.certificate_lab ?? ''};
                                                Laser Inscription: {d.laser_inscription ?? ''};
                                                Country of Origin: {d.origin_country ?? ''};
                                            </Typography>
                                        );

                                    }



                                    // Inject original watch data for each row if available


                                    return (
                                        <TableRow key={idx} sx={{ background: 'inherit' }}>
                                            {/* New Image cell */}
                                            {showImage && (
                                                <TableCell sx={{ color: '#000', fontSize: 11, padding: '2px 6px', minWidth: 80 }}>
                                                    {(() => {
                                                        const parentInvoice = item._parent;
                                                        const rowId = parentInvoice?.picint;
                                                        const urls = imageUrls[rowId] || [];
                                                        const token = localStorage.getItem('token');
                                                        if (urls.length > 0) {
                                                            return urls.map((imgUrl, i) => {
                                                                let urlWithToken = imgUrl;
                                                                if (token) {
                                                                    urlWithToken += (imgUrl.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
                                                                }
                                                                return (
                                                                    <Box
                                                                        key={i}
                                                                        component="img"
                                                                        src={urlWithToken}
                                                                        alt="Product"
                                                                        loading="lazy"
                                                                        sx={{ width: 160, height: 120, objectFit: 'contain', maxWidth: 200, mb: 0.5 }}
                                                                        onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                                                            e.currentTarget.onerror = null;
                                                                            e.currentTarget.src = '/default-image.png';
                                                                        }}
                                                                    />
                                                                );
                                                            });
                                                        } else {
                                                            return <span style={{ color: '#bbb', fontSize: 10 }}>No Image</span>;
                                                        }
                                                    })()}
                                                </TableCell>
                                            )}
                                            <TableCell sx={{ color: '#000', fontSize: 11, padding: '2px 6px' }}>
                                                {item._parent?.id_fact}

                                            </TableCell>

                                            {/* Hide Price cell if gold */}
                                            {!(typeinv && typeinv.toLowerCase().includes('gold')) && (
                                                <TableCell sx={{ color: '#000', fontSize: 11, padding: '2px 6px' }}>
                                                    {(() => {
                                                        const isGold = (typeinv.toLowerCase().includes('gold'));
                                                        if (isGold) {
                                                            return (item.total_remise_final ?? item._parent?.prix_vente ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' LYD';
                                                        } else {
                                                            return (item.total_remise_final ?? item._parent?.prix_vente ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD';
                                                        }
                                                    })()}
                                                </TableCell>
                                            )}
                                            {typeinv && typeinv.toLowerCase().includes('gold') && (
                                                <>
                                                    <TableCell sx={{ color: '#000', fontSize: 11, padding: '2px 6px' }}>{item.qty + ' g'}</TableCell>
                                                    <TableCell sx={{ color: '#000', fontSize: 11, padding: '2px 6px' }}>{item.Color_Gold ?? ''}</TableCell>
                                                    <TableCell sx={{ color: '#000', fontSize: 11, padding: '2px 6px' }}>{item.Color_Rush ?? ''}</TableCell>
                                                    <TableCell sx={{ color: '#000', fontSize: 11, padding: '2px 6px' }}>{item.Unite ?? ''}</TableCell>
                                                </>
                                            )}
                                            {typeinv && !typeinv.toLowerCase().includes('gold') && (
                                                <TableCell sx={{ color: '#000', minWidth: 120, fontSize: 11, padding: '2px 6px' }}>
                                                    {detailsContent}

                                                </TableCell>
                                            )}
                                            <TableCell sx={{ color: '#000', fontSize: 11, padding: '2px 6px' }}>{item.IS_GIFT ? 'Is Gift' : ''}</TableCell>
                                        </TableRow>
                                    );
                                })}
                        </>
                    )}
                </TableBody>
            </Table>



            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Typography><span style={{ fontWeight: 'bold' }}>Total Items:</span> <span style={{ fontFamily: 'monospace' }}>{itemCount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></Typography>
                    {/* Always show Total LYD */}

                    {typeinv && typeinv.toLowerCase().includes('gold') && (


                        <>


                            <Typography>
                                <span style={{ fontWeight: 'bold' }}>Total LYD:</span>
                                <span style={{ fontFamily: 'monospace' }}>
                                    {totalAmountLYD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </Typography>
                            <Typography>
                                <span style={{ fontWeight: 'bold' }}>Total Weight:</span>
                                <span style={{ fontFamily: 'monospace' }}>
                                    {pdata.flatMap(inv => (inv.ACHATs || [])).reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} g
                                </span>
                            </Typography>
                            <Typography>
                                <span style={{ fontWeight: 'bold' }}>Price /g:</span>
                                <span style={{ fontFamily: 'monospace' }}>
                                    {(() => {
                                        const totalWeight = pdata.flatMap(inv => (inv.ACHATs || [])).reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
                                        return totalWeight > 0 ? (totalAmountLYD / totalWeight).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
                                    })()} LYD
                                </span>
                            </Typography>
                        </>
                    )}
                    {typeinv && !typeinv.toLowerCase().includes('gold') && (
                        <>


                            {/* Total USD after discount */}
                            <Typography>
                                <span style={{ fontWeight: 'bold' }}>Total USD:</span>
                                <span style={{ fontFamily: 'monospace' }}>
                                    {(

                                        (TotalAmountFinal)

                                    ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </Typography>



                            {/* Discount display */}
                            {(data.remise && data.remise > 0) ? (
                                <Typography>
                                    <span style={{ fontWeight: 'bold' }}>Discount: </span>
                                    <span style={{ fontFamily: 'monospace', color: '#d32f2f' }}>
                                        {data.remise.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </Typography>
                            ) : (data.remise_per && data.remise_per > 0) ? (
                                <Typography>
                                    <span style={{ fontWeight: 'bold' }}>Discount ({data.remise_per}%):</span>
                                    <span style={{ fontFamily: 'monospace', color: '#d32f2f' }}>
                                        {(TotalAmountFinal * data.remise_per / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </Typography>
                            ) : null}

                            {/* Total USD after discount */}
                            <Typography>
                                <span style={{ fontWeight: 'bold' }}>Total Saved USD:</span>
                                <span style={{ fontFamily: 'monospace' }}>
                                    {(
                                        (data.remise && data.remise > 0)
                                            ? (TotalAmountFinal - data.remise)
                                            : (data.remise_per && data.remise_per > 0)
                                                ? (TotalAmountFinal - (TotalAmountFinal * data.remise_per / 100))
                                                : TotalAmountFinal
                                    ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </Typography>
                        </>
                    )}
                </Box>
                <Box>
                    <Typography><span style={{ fontWeight: 'bold' }}>LYD Paid:</span> <span style={{ fontFamily: 'monospace' }}>{totalAmountLYD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></Typography>
                    <Typography><span style={{ fontWeight: 'bold' }}>USD Paid:</span> <span style={{ fontFamily: 'monospace' }}>{totalAmountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></Typography>
                    <Typography><span style={{ fontWeight: 'bold' }}>EUR Paid:</span> <span style={{ fontFamily: 'monospace' }}>{totalAmountEur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></Typography>
                </Box>
            </Box>


            {/* Notes & Warnings: Render on a separate page for printing */}
            <div style={{ pageBreakBefore: 'always' }}>
                <Box sx={{ mt: 2, fontSize: 11, color: '#444', background: '#f9f9f9', borderRadius: 1, p: 2, border: '1px dashed #1976d2' }}>
                    {(() => {
                        if (typeinv && typeinv.toLowerCase().includes('gold')) {
                            // Gold standard international sale conditions
                            return (
                                <>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1976d2', mb: 1, fontSize: 12 }}>
                                        Notes & Warnings (International Standard for Gold Sales)
                                    </Typography>
                                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11 }}>
                                        <li>This invoice is issued in accordance with international gold trade standards and may be used for customs, insurance, and legal purposes.</li>
                                        <li>All gold weights, purities, and values are as per the attached certificate and/or supplier declaration.</li>
                                        <li>Buyers are advised to verify all details, including certificate authenticity and gold specifications, before finalizing any transaction.</li>
                                        <li>Gold items are subject to natural variations; minor differences in weight or purity may occur between laboratories or manufacturers.</li>
                                        <li>Returns, exchanges, or claims must be made within the period and under the conditions stated in the company’s policy.</li>
                                        <li>For insurance, customs, or export, always refer to the original certificate and this invoice together.</li>
                                        <li>Warning: Gold may be subject to international trade restrictions, sanctions, or reporting requirements. Ensure compliance with all applicable laws and standards.</li>
                                        <li>For further information, contact our customer service or visit our website.</li>
                                    </ul>
                                </>
                            );
                        } else if (typeinv && typeinv.toLowerCase().includes('watch')) {
                            // Watch warning
                            return (
                                <>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1976d2', mb: 1, fontSize: 12 }}>
                                        Notes & Warnings (International Standard for Watches)
                                    </Typography>
                                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11 }}>
                                        <li>This invoice is issued in accordance with international diamond watch trade standards and may be used for customs, insurance, and legal purposes.</li>
                                        <li>All diamond watch characteristics (carat, cut, color, clarity, shape, measurements, movement, model, etc.) are as per the attached certificate and/or supplier declaration.</li>
                                        <li>Buyers are advised to verify all details, including certificate authenticity and watch specifications, before finalizing any transaction.</li>
                                        <li>Diamond watches are subject to natural variations; minor differences in grading or craftsmanship may occur between laboratories or manufacturers.</li>
                                        <li>Returns, exchanges, or claims must be made within the period and under the conditions stated in the company’s policy.</li>
                                        <li>For insurance, customs, or export, always refer to the original certificate and this invoice together.</li>
                                        <li>Warning: Diamond watches may be subject to international trade restrictions, sanctions, or reporting requirements. Ensure compliance with all applicable laws and standards.</li>
                                        <li>For further information, contact our customer service or visit our website.</li>
                                    </ul>
                                </>
                            );
                        } else {
                            // Diamond warning (existing)
                            return (
                                <>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1976d2', mb: 1, fontSize: 12 }}>
                                        Notes & Warnings (International Standard for Diamonds)
                                    </Typography>
                                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11 }}>
                                        <li>This invoice is issued in accordance with international diamond trade standards and may be used for customs, insurance, and legal purposes.</li>
                                        <li>All diamond characteristics (carat, cut, color, clarity, shape, measurements, etc.) are as per the attached certificate and/or supplier declaration.</li>
                                        <li>Buyers are advised to verify all details, including certificate authenticity, before finalizing any transaction.</li>
                                        <li>Diamonds are subject to natural variations; minor differences in grading may occur between laboratories.</li>
                                        <li>Returns, exchanges, or claims must be made within the period and under the conditions stated in the company’s policy.</li>
                                        <li>For insurance, customs, or export, always refer to the original certificate and this invoice together.</li>
                                        <li>Warning: Diamonds may be subject to international trade restrictions, sanctions, or reporting requirements. Ensure compliance with all applicable laws.</li>
                                        <li>For further information, contact our customer service or visit our website.</li>
                                    </ul>
                                </>
                            );
                        }
                    })()}
                </Box>
            </div>


            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
                <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}> Signature</Typography>
                    <Box sx={{ borderBottom: '1px solid #888', width: 220, height: 32 }} />
                </Box>
            </Box>
        </Box>
    );
});

export default WatchStandardInvoiceContent;
