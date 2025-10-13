import React, { forwardRef, useEffect, useState, useMemo } from 'react';
import { useCallback } from 'react';
import QRCode from 'react-qr-code';
import { Box, Typography, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { Invoice, Client } from './PrintInvoiceDialog';
import axios from "../../../api";


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
    // Cuser removed (unused)
    const userStr = localStorage.getItem('user');



    if (userStr) {
        try {
            const userObj = JSON.parse(userStr);
            ps = userObj.ps ?? localStorage.getItem('ps');
            // (removed unused Cuser extraction)
        } catch {
            ps = localStorage.getItem('ps');
        }
    } else {
        ps = localStorage.getItem('ps');
    }


    const [typeinv] = useState(() => {
        // Try to get TYPE_SUPPLIER from the first ACHATs item, fallback to Design_art if available
        if (invoice.ACHATs && invoice.ACHATs.length > 0) {
            return invoice.ACHATs[0]?.Fournisseur?.TYPE_SUPPLIER || '';
        }
        return '';
    });


    // Filter pdata by num_fact at the top of the component
    const [pdata, setPData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    // Detect diamond data regardless of TYPE_SUPPLIER text (robust multi-shape detection)
    const hasDiamondData = useMemo(() => {
        const diamondIndicatorKeys = ['carat','cut','clarity','shape','certificate_number','certificate_lab','color','fluorescence','measurements','girdle','polish','symmetry','depth_percent','table_percent'];
        const clarityValues = ['if','vvs1','vvs2','vs1','vs2','si1','si2','i1','i2','i3'];
        const shapeValues = ['round','princess','emerald','oval','pear','marquise','cushion','radiant','heart','asscher'];

        const valueSuggestsDiamond = (val: any): boolean => {
            if (!val) return false;
            if (typeof val === 'string') {
                const lv = val.toLowerCase();
                if (clarityValues.includes(lv)) return true;
                if (shapeValues.includes(lv)) return true;
                if (/^g?ia\s?\d{5,}$/.test(lv)) return true; // possible certificate number
            }
            if (typeof val === 'number') {
                // carat often between 0 and 30 (broad range) with decimal
                if (val > 0 && val < 50) return true; // heuristic; combined with key tests below
            }
            return false;
        };

        const checkDiamondObj = (obj: any, depth = 0): boolean => {
            if (!obj || typeof obj !== 'object') return false;
            if (obj.OriginalAchatDiamond || obj.purchaseD || obj.OriginalAchat) return true;
            for (const key of Object.keys(obj)) {
                const val = obj[key];
                const lk = key.toLowerCase();
                if (lk.includes('diamond')) return true;
                if (diamondIndicatorKeys.some(k => lk === k || lk.includes(k))) {
                    if (val !== undefined && val !== null && val !== '') return true;
                }
                if (['carat','clarity','cut','shape'].some(k => lk.includes(k)) && valueSuggestsDiamond(val)) return true;
            }
            if (depth < 2) { // search deeper but limit to avoid cycles
                for (const key of Object.keys(obj)) {
                    const val = obj[key];
                    if (val && typeof val === 'object') {
                        if (checkDiamondObj(val, depth + 1)) return true;
                    }
                }
            }
            return false;
        };

        // 1. Quick fallback: items prop
        if ((!pdata || pdata.length === 0) && Array.isArray(items) && items.some(it => checkDiamondObj(it))) return true;
        if (!pdata || pdata.length === 0) return false;

        const detected = pdata.some(inv => {
            // Supplier type hint
            const supplierType = inv?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase?.() || '';
            const achatLevel = (inv.ACHATs || []).some((it: any) => checkDiamondObj(it));
            if (achatLevel || supplierType.includes('diamond')) return true;
            // Deep scan inside DistributionPurchase
            return (inv.ACHATs || []).some((it: any) => {
                const dp: any = it?.DistributionPurchase || it?.DistributionPurchases || it?.distributionPurchase || it?.distributionPurchases;
                if (Array.isArray(dp)) return dp.some(dpo => checkDiamondObj(dpo));
                return checkDiamondObj(dp);
            });
        });

        return detected;
    }, [pdata, items]);

    // Debug one-liner to help verify detection in console
    useEffect(() => {
        if (pdata && pdata.length) {
            // eslint-disable-next-line no-console
            console.log('[DiamondDetect] hasDiamondData=', hasDiamondData, 'ACHAT count first invoice=', pdata[0]?.ACHATs?.length || 0);
            if (!hasDiamondData) {
                const sample = pdata[0]?.ACHATs?.[0];
                if (sample) {
                    const shallow = Object.keys(sample).reduce((acc: any, k) => { acc[k] = sample[k]; return acc; }, {});
                    // eslint-disable-next-line no-console
                    console.log('[DiamondDetect][SampleFirstACHAT]', shallow);
                    const dp: any = sample?.DistributionPurchase || sample?.DistributionPurchases || sample?.distributionPurchase || sample?.distributionPurchases;
                    if (dp) {
                        // eslint-disable-next-line no-console
                        console.log('[DiamondDetect][SampleDistributionPurchase]', dp);
                    }
                }
            }
        }
    }, [hasDiamondData, pdata]);
    const apiUrlinv = "/invoices";
    const apiUrlWatches = "/WOpurchases";
    const apiUrlDiamonds = "/DOpurchases"; // Added diamond endpoint



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
        // Refetch details when invoice number changes so status reflects latest state
        fetchDataINV();
        // eslint-disable-next-line
    }, [invoiceNumFact]);

    // Find the invoice in pdata that matches the current invoice number
    const currentInvoiceData = pdata.find((inv: any) => inv.num_fact === invoiceNumFact) || {};

    // Derive closed status from current invoice data using common flags
    const isClosed = (() => {
        const v = currentInvoiceData;
        const candidates = [v?.is_closed, v?.IS_CLOSED, v?.IS_OK, v?.is_ok];
        return candidates.some((c: any) => c === true || c === 1 || c === '1' || c === 'true');
    })();

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




    // Store all watch & diamond details keyed by picint
    const [allWatchDetails, setAllWatchDetails] = useState<{ [key: string]: any }>({});
    const [allDiamondDetails, setAllDiamondDetails] = useState<{ [key: string]: any }>({});

    // Helper: normalize raw diamond-like object into canonical fields
    const normalizeDiamond = useCallback((raw: any): any | null => {
        if (!raw || typeof raw !== 'object') return null;
        const out: any = {};
        const push = (k: string, v: any) => { if (v !== undefined && v !== null && v !== '') out[k] = v; };
        const pickFirst = (...cands: string[]) => {
            for (const c of cands) { if (raw[c] !== undefined && raw[c] !== null && raw[c] !== '') return raw[c]; }
            // search case-insensitive
            const lowerMap: Record<string,string> = {};
            Object.keys(raw).forEach(k => lowerMap[k.toLowerCase()] = k);
            for (const c of cands) { const lc = c.toLowerCase(); if (lowerMap[lc]) return raw[lowerMap[lc]]; }
            return undefined;
        };
        push('id_achat', pickFirst('id_achat','idAchat','purchase_id'));
        push('Design_art', pickFirst('Design_art','design_art','design','name','product_name','product'));
        push('carat', pickFirst('carat','Carat','cts','carat_weight','weight_carat'));
        push('cut', pickFirst('cut','Cut','cut_grade'));
        push('color', pickFirst('color','Color','colour'));
        push('clarity', pickFirst('clarity','Clarity'));
        push('shape', pickFirst('shape','Shape','stone_shape'));
        push('measurements', pickFirst('measurements','Measurements','measurement','meas','dims','dimensions'));
        push('depth_percent', pickFirst('depth_percent','depth','Depth'));
        push('table_percent', pickFirst('table_percent','table','Table'));
        push('girdle', pickFirst('girdle','Girdle'));
        push('culet', pickFirst('culet','Culet'));
        push('polish', pickFirst('polish','Polish'));
        push('symmetry', pickFirst('symmetry','Symmetry'));
        push('fluorescence', pickFirst('fluorescence','Fluorescence','fluor'));
        push('certificate_number', pickFirst('certificate_number','certificate','cert_number','cert_no','gia_number','gia_no','gia'));
        push('certificate_lab', pickFirst('certificate_lab','certificate_lab_name','lab','Lab'));
        push('laser_inscription', pickFirst('laser_inscription','laser','laser_inscr'));
        push('origin_country', pickFirst('origin_country','origin','country'));
        // Newly added fields for diamond invoice display
        push('CODE_EXTERNAL', pickFirst('CODE_EXTERNAL','code_external','external_code','ref_code','reference_code','reference')); // reference_number intentionally excluded (watch specific)
        push('comment_edit', pickFirst('comment_edit','Comment_Edit','sales_code','salescode','sales_code'));
        if (Object.keys(out).length === 0) return null;
        return out;
    }, []);

    // Fetch all watch details for each row after pdata loads
    useEffect(() => {
        const fetchAllDetails = async () => {
            const token = localStorage.getItem('token');
            // WATCHES
            if (typeinv && typeinv.toLowerCase().includes('watch')) {
                const uniqueIds = Array.from(new Set(pdata.map(inv => inv.picint).filter(Boolean)));
                const watchMap: { [key: string]: any } = {};
                await Promise.all(uniqueIds.map(async (id) => {
                    try {
                        const res = await axios.get(`${apiUrlWatches}/getitem/${id}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        watchMap[id] = Array.isArray(res.data) ? res.data[0] : res.data;
                    } catch {
                        watchMap[id] = null;
                    }
                }));
                setAllWatchDetails(watchMap);
            } else {
                setAllWatchDetails({});
            }

            // DIAMONDS (explicit invoice type or detected diamond data) now mimic watch logic using picint as unique key
            const diamondInvoice = typeinv && typeinv.toLowerCase().includes('diamond');
            if (diamondInvoice || hasDiamondData) {
                const uniqueDiamondPicints = Array.from(new Set(pdata.map(inv => inv.picint).filter(Boolean)));
                // eslint-disable-next-line no-console
                console.log('[DiamondFetch] uniqueDiamondPicints (picint-based)=', uniqueDiamondPicints);
                if (uniqueDiamondPicints.length === 0) {
                    setAllDiamondDetails({});
                } else {
                    const diamondMap: { [key: string]: any } = {};
                    await Promise.all(uniqueDiamondPicints.map(async (pic) => {
                        try {
                            const res = await axios.get(`${apiUrlDiamonds}/getitem/${pic}`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            diamondMap[pic] = Array.isArray(res.data) ? res.data[0] : res.data;
                        } catch (err) {
                            // eslint-disable-next-line no-console
                            console.warn('[DiamondFetch] error fetching picint', pic, err);
                            diamondMap[pic] = null; // fallback inline
                        }
                    }));
                    setAllDiamondDetails(diamondMap);
                }
            } else {
                setAllDiamondDetails({});
            }
        };
        fetchAllDetails();
        // eslint-disable-next-line
    }, [pdata, typeinv, hasDiamondData]);

    const API_BASEImage = '/images';

    const [imageUrls, setImageUrls] = useState<Record<string, string[]>>({});

    // Typed fetch helper (watch | diamond)
    const fetchImagesTyped = async (id: number, type: 'watch' | 'diamond'): Promise<string[] | null> => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`${API_BASEImage}/list/${type}/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (Array.isArray(res.data) && res.data.length) return res.data;
            return [];
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[Images] fetch failed', type, id);
            return null;
        }
    };


    // Fetch images for watch or diamond when detected (typed endpoints)
    useEffect(() => {
        const isWatch = !!(typeinv && typeinv.toLowerCase().includes('watch'));
        const isDiamond = !!((typeinv && typeinv.toLowerCase().includes('diamond')) || hasDiamondData);
        if (!(isWatch || isDiamond)) return;

        // Build candidate ids
        let sourceIds: string[] = [];
        if (isWatch) {
            sourceIds = Object.keys(allWatchDetails);
        } else if (isDiamond) {
            sourceIds = Object.keys(allDiamondDetails);
            if (sourceIds.length === 0) {
                sourceIds = pdata.map(inv => inv.picint).filter(Boolean);
            }
        }
        const unique = Array.from(new Set(sourceIds)).filter(Boolean);
        (async () => {
            for (const id of unique) {
                if (!id) continue;
                if (imageUrls[id]) continue; // already have
                if (isWatch) {
                    const urls = await fetchImagesTyped(Number(id), 'watch');
                    if (urls && urls.length) {
                        setImageUrls(prev => ({ ...prev, [id]: urls }));
                    }
                } else if (isDiamond) {
                    // Try diamond by this id (picint) first
                    let urls = await fetchImagesTyped(Number(id), 'diamond');
                    if (!urls || urls.length === 0) {
                        // Fallback: attempt to find any id_achat inside diamond details object
                        const detail = allDiamondDetails[id];
                        const candidateIds: number[] = [];
                        const pushId = (v: any) => { if (v && !isNaN(Number(v))) candidateIds.push(Number(v)); };
                        if (detail) {
                            const unwrap = detail.OriginalAchatDiamond || detail.purchaseD || detail.OriginalAchat || detail;
                            pushId(unwrap?.id_achat);
                            pushId(unwrap?.ID_ACHAT);
                        }
                        // Also scan ACHAT rows referencing this picint
                        pdata.filter(inv => String(inv.picint) === String(id)).forEach(inv => {
                            (inv.ACHATs || []).forEach((a: any) => pushId(a?.id_achat));
                        });
                        for (const cid of candidateIds) {
                            if (cid && !imageUrls[cid]) {
                                const u2 = await fetchImagesTyped(cid, 'diamond');
                                if (u2 && u2.length) {
                                    // store under both cid and original id so render fallback works
                                    setImageUrls(prev => ({ ...prev, [id]: u2, [cid]: u2 }));
                                    urls = u2;
                                    break;
                                }
                            }
                        }
                    } else {
                        // urls is typed (string[] | null); ensure non-null for state shape
                        setImageUrls(prev => ({ ...prev, [id]: urls || [] }));
                    }
                }
            }
        })();
        // eslint-disable-next-line
    }, [pdata, allWatchDetails, allDiamondDetails, typeinv, hasDiamondData]);

    return (
        <Box ref={ref} sx={{ p: 1, background: '#fff', color: '#000', minWidth: 700 }}>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>

                    <img
                        src="/logo.png"
                        alt="GAJA Logo"
                        style={{ height: 80, marginBottom: 8, borderRadius: 12, padding: 4, background: '#fff' }}
                    />

                    <Typography variant="h5" fontWeight="bold">
                        {typeinv.toLowerCase().includes('gold')
                            ? 'Gold Invoice'
                            : typeinv.toLowerCase().includes('watch')
                                ? 'Watch Invoice'
                                : (typeinv.toLowerCase().includes('diamond') || hasDiamondData)
                                    ? 'Diamond Invoice'
                                    : 'Invoice'}
                    </Typography>
                    <Typography variant="subtitle1">
                        Invoice No: {invoiceNumFact === 0 ? (
                            <span style={{ color: 'red' }}>In Progress</span>
                        ) : invoiceNumFact}
                        {invoiceNumFact !== 0 && (
                            <>
                                {' '}
                                {isClosed ? (
                                    <span style={{ color: '#2e7d32', fontWeight: 700 }}>(Closed)</span>
                                ) : (
                                    <span style={{ color: '#ed6c02', fontWeight: 700 }}>(Open)</span>
                                )}
                            </>
                        )}
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
                                                {(rowDetails.Brand || rowDetails.brand) && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Brand:</span>{' '}
                                                        <span style={{ color: '#1976d2' }}>
                                                            {rowDetails.Brand?.client_name || rowDetails.brand?.client_name || rowDetails.Brand || rowDetails.brand}
                                                        </span>;{' '}
                                                    </span>
                                                )}

                                                {rowDetails.common_local_brand && (
                                                    <span>
                                                        <span style={{ fontWeight: 'bold' }}>Nickname:</span> <span style={{ color: '#1976d2' }}>{rowDetails.common_local_brand}</span>;{' '}
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
                                    } else if ((typeinv && typeinv.toLowerCase().includes('diamond')) || hasDiamondData) {
                                        // Diamond: first try parent picint-based map (mirroring watch logic)
                                        const parentInvoice = item._parent;
                                        const rowPic = parentInvoice?.picint;
                                        const picDetails = rowPic ? allDiamondDetails[rowPic] : null;
                                        let dNorm: any = null;
                                        if (picDetails) {
                                            dNorm = normalizeDiamond(picDetails.OriginalAchatDiamond || picDetails.purchaseD || picDetails.OriginalAchat || picDetails);
                                        }
                                        if (!dNorm) {
                                            // fallback to previous candidate source aggregation
                                            const candidateSources: any[] = [];
                                            if (picDetails) candidateSources.push(picDetails);
                                            const directById = allDiamondDetails[item.id_achat];
                                            if (directById) candidateSources.push(directById);
                                            const dpAny: any = item.DistributionPurchase || item.DistributionPurchases || item.distributionPurchase || item.distributionPurchases;
                                            if (Array.isArray(dpAny)) candidateSources.push(...dpAny);
                                            else if (dpAny) candidateSources.push(dpAny);
                                            candidateSources.push(item);
                                            for (const src of candidateSources) {
                                                if (!src) continue;
                                                const unwrap = src.OriginalAchatDiamond || src.purchaseD || src.OriginalAchat || src;
                                                const n = normalizeDiamond(unwrap);
                                                if (n) { dNorm = n; break; }
                                            }
                                        }
                                        detailsContent = dNorm ? (
                                            <Typography sx={{ fontSize: 11, whiteSpace: 'pre-line', textAlign: 'justify' }}>
                                                {dNorm.id_achat && (<span><span style={{ fontWeight: 'bold' }}>ID.:</span> <span style={{ color: '#1976d2' }}>{dNorm.id_achat}</span>; </span>)}
                                                {dNorm.Design_art && (<span><span style={{ fontWeight: 'bold' }}>Product Name:</span> <span style={{ color: '#1976d2' }}>{dNorm.Design_art}</span>; </span>)}
                                                {dNorm.CODE_EXTERNAL && (<span><span style={{ fontWeight: 'bold' }}>Ref. Code:</span> <span style={{ color: '#1976d2' }}>{dNorm.CODE_EXTERNAL}</span>; </span>)}
                                                {dNorm.comment_edit && (<span><span style={{ fontWeight: 'bold' }}>Sales Code:</span> <span style={{ color: '#1976d2' }}>{dNorm.comment_edit}</span>; </span>)}
                                                {dNorm.carat && (<span><span style={{ fontWeight: 'bold' }}>Carat:</span> <span style={{ color: '#1976d2' }}>{dNorm.carat}</span>; </span>)}
                                                {dNorm.cut && (<span><span style={{ fontWeight: 'bold' }}>Cut:</span> <span style={{ color: '#1976d2' }}>{dNorm.cut}</span>; </span>)}
                                                {dNorm.color && (<span><span style={{ fontWeight: 'bold' }}>Color:</span> <span style={{ color: '#1976d2' }}>{dNorm.color}</span>; </span>)}
                                                {dNorm.clarity && (<span><span style={{ fontWeight: 'bold' }}>Clarity:</span> <span style={{ color: '#1976d2' }}>{dNorm.clarity}</span>; </span>)}
                                                {dNorm.shape && (<span><span style={{ fontWeight: 'bold' }}>Shape:</span> <span style={{ color: '#1976d2' }}>{dNorm.shape}</span>; </span>)}
                                                {dNorm.measurements && (<span><span style={{ fontWeight: 'bold' }}>Measurements:</span> <span style={{ color: '#1976d2' }}>{dNorm.measurements}</span>; </span>)}
                                                {dNorm.depth_percent && (<span><span style={{ fontWeight: 'bold' }}>Depth %:</span> <span style={{ color: '#1976d2' }}>{dNorm.depth_percent}</span>; </span>)}
                                                {dNorm.table_percent && (<span><span style={{ fontWeight: 'bold' }}>Table %:</span> <span style={{ color: '#1976d2' }}>{dNorm.table_percent}</span>; </span>)}
                                                {dNorm.girdle && (<span><span style={{ fontWeight: 'bold' }}>Girdle:</span> <span style={{ color: '#1976d2' }}>{dNorm.girdle}</span>; </span>)}
                                                {dNorm.culet && (<span><span style={{ fontWeight: 'bold' }}>Culet:</span> <span style={{ color: '#1976d2' }}>{dNorm.culet}</span>; </span>)}
                                                {dNorm.polish && (<span><span style={{ fontWeight: 'bold' }}>Polish:</span> <span style={{ color: '#1976d2' }}>{dNorm.polish}</span>; </span>)}
                                                {dNorm.symmetry && (<span><span style={{ fontWeight: 'bold' }}>Symmetry:</span> <span style={{ color: '#1976d2' }}>{dNorm.symmetry}</span>; </span>)}
                                                {dNorm.fluorescence && (<span><span style={{ fontWeight: 'bold' }}>Fluorescence:</span> <span style={{ color: '#1976d2' }}>{dNorm.fluorescence}</span>; </span>)}
                                                {dNorm.certificate_number && (<span><span style={{ fontWeight: 'bold' }}>Certificate #:</span> <span style={{ color: '#1976d2' }}>{dNorm.certificate_number}</span>; </span>)}
                                                {dNorm.certificate_lab && (<span><span style={{ fontWeight: 'bold' }}>Lab:</span> <span style={{ color: '#1976d2' }}>{dNorm.certificate_lab}</span>; </span>)}
                                                {dNorm.laser_inscription && (<span><span style={{ fontWeight: 'bold' }}>Laser Inscription:</span> <span style={{ color: '#1976d2' }}>{dNorm.laser_inscription}</span>; </span>)}
                                                {dNorm.origin_country && (<span><span style={{ fontWeight: 'bold' }}>Origin:</span> <span style={{ color: '#1976d2' }}>{dNorm.origin_country}</span>; </span>)}
                                            </Typography>
                                        ) : <Typography sx={{ fontSize: 11, color: '#888' }}>No data</Typography>;
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
                                                        // Fallback sequence for image source (row picint, direct id_achat, any diamond detail id)
                                                        let urls = imageUrls[rowId] || [];
                                                        if (urls.length === 0 && item.id_achat) urls = imageUrls[item.id_achat] || urls;
                                                        if (urls.length === 0 && (typeinv?.toLowerCase().includes('diamond') || hasDiamondData)) {
                                                            const dDet = allDiamondDetails[rowId] || allDiamondDetails[item.id_achat];
                                                            const unwrap = dDet && (dDet.OriginalAchatDiamond || dDet.purchaseD || dDet.OriginalAchat || dDet);
                                                            const altId = unwrap?.id_achat || unwrap?.ID_ACHAT;
                                                            if (altId && imageUrls[altId] && imageUrls[altId].length) {
                                                                urls = imageUrls[altId];
                                                            }
                                                        }
                                                        const token = localStorage.getItem('token');
                                                        if (urls.length > 0) {
                                                            const imgUrl = urls[0];
                                                            let urlWithToken = imgUrl;
                                                            if (token) {
                                                                urlWithToken += (imgUrl.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
                                                            }
                                                            return (
                                                                <Box
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
