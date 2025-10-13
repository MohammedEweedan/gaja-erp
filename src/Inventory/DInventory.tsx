import React from 'react';
import axios from '../api';
import { useNavigate } from 'react-router-dom';
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import { Box, IconButton, Button, Typography, TextField, MenuItem } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import ExcelJS from 'exceljs';
import { useAuth } from '../contexts/AuthContext';

type InventoryItem = {
  id_fact: number;
  desig_art: string;
  qty: number;
  qty_difference: number;
  Fournisseur: { client_name: string; code_supplier: string; TYPE_SUPPLIER: string; };
  user: { name_user: string; email: string; };
  id_art?: number;
  DistributionPurchase?: { OriginalAchatDiamond?: Record<string, any> };
};

interface Props { Type?: string; }

// Ordered list of diamond fields with labels (mirrors style from WInventory)
// Extend this list if backend adds more attributes.
const DIAMOND_FIELDS_ORDER: { key: string; label: string; format?: (v: any) => string }[] = [
  { key: 'id_achat', label: 'System Original ref.' },
  { key: 'CODE_EXTERNAL', label: 'Ref Code' },
  { key: 'comment_edit', label: 'Sales Code' },
  { key: 'reference_number', label: 'Ref.' },
  { key: 'serial_number', label: 'Serial No.' },
  { key: 'carat', label: 'Carat', format: v => `${v}` },
  { key: 'shape', label: 'Shape' },
  { key: 'color', label: 'Color' },
  { key: 'clarity', label: 'Clarity' },
  { key: 'cut', label: 'Cut' },
  { key: 'polish', label: 'Polish' },
  { key: 'symmetry', label: 'Symmetry' },
  { key: 'fluorescence', label: 'Fluor.' },
  { key: 'measurements', label: 'Measurements' },
  { key: 'depth_percent', label: 'Depth %', format: v => `${v}` },
  { key: 'table_percent', label: 'Table %', format: v => `${v}` },
  { key: 'girdle', label: 'Girdle' },
  { key: 'culet', label: 'Culet' },
  { key: 'certificate_number', label: 'Cert #' },
  { key: 'certificate_lab', label: 'Lab' },
  { key: 'certificate_url', label: 'Cert URL' },
  { key: 'laser_inscription', label: 'Laser Inscription' },
  { key: 'price_per_carat', label: 'Item Cost', format: v => `${v}` },
  { key: 'origin_country', label: 'Origin' },
  { key: 'comment', label: 'Comment' },
  { key: 'Comment_Achat', label: 'Purchase Comment' },
  { key: 'DocumentNo', label: 'Document No.' },
  { key: 'IsApprouved', label: 'Status' },
  { key: 'Approval_Date', label: 'Approval Date', format: v => {
      if (!v) return '';
      try { const d = new Date(v); if (!isNaN(d.getTime())) return d.toISOString().substring(0,10); } catch {}
      return String(v);
    } },
  { key: 'ApprouvedBy', label: 'Approved By' },
  { key: 'attachmentUrl', label: 'Attachment' },
  { key: 'Date_Achat', label: 'Purchase Date', format: v => {
      if (!v) return '';
      try { const d = new Date(v); if (!isNaN(d.getTime())) return d.toISOString().substring(0,10); } catch {}
      return String(v);
    } },
  { key: 'Brand', label: 'Brand Name' },
  { key: 'sharepoint_url', label: 'SharePoint URL' },
  { key: 'MakingCharge', label: 'Making Charge', format: v => `${v}` },
  { key: 'ShippingCharge', label: 'Shipping Charge', format: v => `${v}` },
  { key: 'TravelExpesenes', label: 'Travel Expenses', format: v => `${v}` },
  { key: 'Rate', label: 'Rate', format: v => `${v}` },
  { key: 'Total_Price_LYD', label: 'Total (LYD)', format: v => `${v}` },
   { key: 'Design_art', label: 'Product Name' },
  { key: 'SellingPrice', label: 'Selling Price', format: v => `${v}` },
 
];


const getDiamondFromRow = (row: InventoryItem): any => {
  const dp: any = row.DistributionPurchase;
  let diamond: any;
  if (Array.isArray(dp) && dp.length > 0) diamond = dp[0]?.OriginalAchatDiamond;
  else if (dp && typeof dp === 'object') diamond = dp.OriginalAchatDiamond;
  if (!diamond) return undefined;
  // Inject supplier brand so it appears in Details as 'Brand Name'
  return { ...diamond, Brand: row.Fournisseur?.client_name };
};

const API_BASEImage = '/images';
const fetchImageWithAuth = async (url: string, token: string) => {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null; const blob = await res.blob(); return URL.createObjectURL(blob);
  } catch { return null; }
};

// Format a value as USD with comma thousands and dot decimal, append " USD"
const formatUSD = (v: any): string => {
  if (v === null || v === undefined || v === '') return '';
  const num = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return `${v} USD`;
  try {
    const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    return `${formatted} USD`;
  } catch {
    return `${num} USD`;
  }
};

const DInventory: React.FC<Props> = ({ Type = '' }) => {
  const { user } = useAuth();
  const isAdmin = React.useMemo(() => {
    // 1) Prefer Prvilege from localStorage (backend Users.Roles)
    try {
      const u = localStorage.getItem('user');
      if (u) {
        const obj = JSON.parse(u);
        const prv = obj?.Prvilege;
        const list: string[] = Array.isArray(prv)
          ? prv.map((r: any) => (typeof r === 'string' ? r : String(r?.name || r?.role || r?.value || r)))
          : typeof prv === 'string'
            ? prv.split(/[\s,;|]+/)
            : prv
              ? [String(prv?.name || prv?.role || prv?.value || prv)]
              : [];
        if (list.some(s => String(s).toUpperCase().includes('ROLE_ADMIN') || String(s).toUpperCase() === 'ADMIN')) return true;
      }
    } catch {}
    // 2) Fallback to roles from AuthContext
    const candidates: string[] = [];
    if (user?.role) candidates.push(String(user.role));
    const rs: any = (user as any)?.roles;
    if (Array.isArray(rs)) {
      rs.forEach((r: any) => candidates.push(typeof r === 'string' ? r : String((r && (r.name || r.role || r.value)) ?? r)));
    } else if (typeof rs === 'string') {
      rs.split(/[\s,;]+/).forEach((s: string) => s && candidates.push(s));
    } else if (rs) {
      candidates.push(String((rs && (rs.name || rs.role || rs.value)) ?? rs));
    }
    return candidates.some(s => {
      const up = String(s).toUpperCase();
      return up.includes('ROLE_ADMIN') || up === 'ADMIN';
    });
  }, [user]);
  // session
  let ps: string | null = null;
  try { const u = localStorage.getItem('user'); if (u) { const obj = JSON.parse(u); ps = obj.ps ?? localStorage.getItem('ps'); } else { ps = localStorage.getItem('ps'); } } catch { ps = localStorage.getItem('ps'); }

  const navigate = useNavigate();
  const [data, setData] = React.useState<InventoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [imageUrls, setImageUrls] = React.useState<Record<string, string[]>>({});
  const [images, setImages] = React.useState<Record<string, string[]>>({});
  const [imageDialogOpen, setImageDialogOpen] = React.useState(false);
  const [dialogImages, setDialogImages] = React.useState<string[]>([]);
  const [dialogIndex, setDialogIndex] = React.useState(0);
  // Removed Diamond Details panel; no need to keep diamond data in dialog state
  // Filters
  const [brandFilter, setBrandFilter] = React.useState<string>('');
  const [productName, setProductName] = React.useState<string>('');
  const [costMin, setCostMin] = React.useState<string>('');
  const [costMax, setCostMax] = React.useState<string>('');
  const [refCode, setRefCode] = React.useState<string>('');
  const [salesCode, setSalesCode] = React.useState<string>('');
  // zoom & pan state for dialog image
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [dragging, setDragging] = React.useState(false);
  const dragStartRef = React.useRef<{ x: number; y: number; origX: number; origY: number } | null>(null);

  const resetZoom = React.useCallback(() => {
    setZoom(1); setOffset({ x: 0, y: 0 });
  }, []);

  React.useEffect(() => { if (imageDialogOpen) resetZoom(); }, [imageDialogOpen, dialogIndex, resetZoom]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY; // scroll up -> zoom in
    setZoom(z => {
      let next = z + (delta > 0 ? 0.15 : -0.15);
      if (next < 1) next = 1; if (next > 5) next = 5; return Number(next.toFixed(2));
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom === 1) return; // no pan when normal scale
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, origX: offset.x, origY: offset.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({ x: dragStartRef.current.origX + dx, y: dragStartRef.current.origY + dy });
  };
  const endDrag = () => { setDragging(false); dragStartRef.current = null; };
  const zoomIn = () => setZoom(z => Math.min(5, Number((z + 0.5).toFixed(2))));
  const zoomOut = () => setZoom(z => { const next = z - 0.5; if (next <= 1) { setOffset({ x: 0, y: 0 }); return 1; } return Number(next.toFixed(2)); });

  const fetchData = React.useCallback(async () => {
    const token = localStorage.getItem('token'); if (!token) return navigate('/');
    try { const res = await axios.get<InventoryItem[]>(`/Inventory/allActive`, { headers: { Authorization: `Bearer ${token}` }, params: { ps, type_supplier: Type } }); setData(res.data); }
    catch (e: any) { if (e.response?.status === 401) navigate('/'); else console.error(e); }
    finally { setLoading(false); }
  }, [navigate, ps, Type]);
  React.useEffect(() => { fetchData(); }, [fetchData]);

  // Distinct brands for filter dropdown
  const distinctBrands = React.useMemo(() => {
    const s = new Set<string>();
    data.forEach((row) => {
      const b = row.Fournisseur?.client_name;
      if (b) s.add(b);
    });
    return Array.from(s).sort();
  }, [data]);

  // Fields visible in Details/dialog (hide Item Cost for non-admins; always hide status fields)
  const fieldsToShow = React.useMemo(() => {
    const hiddenAlways = new Set(['IsApprouved', 'Approval_Date', 'ApprouvedBy', 'Total_Price_LYD']);
    // Show price_per_carat (Item Cost) only for admins
    return DIAMOND_FIELDS_ORDER.filter(f => {
      if (hiddenAlways.has(f.key)) return false;
      if (!isAdmin && (f.key === 'price_per_carat')) return false;
      return true;
    });
  }, [isAdmin]);
  // Note: If Item Cost still doesn't show for admins, log current roles from AuthContext to verify format.
  // console.debug('roles:', user?.role, user?.roles, 'isAdmin:', isAdmin);

  const fetchImages = async (id_achat: number) => {
    const token = localStorage.getItem('token'); if (!token || !id_achat) return;
    // Diamond images live under DiamondPic via typed route: /images/list/diamond/:id_achat
    const typedUrl = `${API_BASEImage}/list/diamond/${id_achat}`;
    const legacyUrl = `${API_BASEImage}/list/${id_achat}`; // fallback (watch default)
    try {
      // mark loading placeholder so UI can distinguish between 'not requested' and 'loading'
      setImageUrls(p => p[id_achat] ? p : ({ ...p, [id_achat]: [] }));
      let res;
      try {
        res = await axios.get(typedUrl, { headers: { Authorization: `Bearer ${token}` } });
      } catch (innerErr) {
        // fallback in case backend older version
        res = await axios.get(legacyUrl, { headers: { Authorization: `Bearer ${token}` } });
      }
      let urls: string[] = Array.isArray(res.data) ? (typeof res.data[0] === 'object' ? res.data.map((i: any) => i.url || i) : res.data) : [];
      // Filter to diamond folder just in case legacy returned watch images
      urls = urls.filter(u => /DiamondPic/i.test(u));
      setImageUrls(p => ({ ...p, [id_achat]: urls }));
      const blobs = await Promise.all(urls.map(u => fetchImageWithAuth(u, token)));
      setImages(p => ({ ...p, [id_achat]: blobs.filter((u): u is string => !!u) }));
    } catch (e) {
      console.warn('No diamond images for', id_achat, e);
      setImages(p => ({ ...p, [id_achat]: [] }));
      setImageUrls(p => ({ ...p, [id_achat]: [] }));
    }
  };

  const columns = React.useMemo<MRT_ColumnDef<InventoryItem>[]>(() => [
    {
      header: 'Image', id: 'image', Cell: ({ row }) => {
        let imageKey: number | string | undefined; let diamond: any; const dp: any = row.original.DistributionPurchase;
        if (Array.isArray(dp) && dp.length > 0) { diamond = dp[0]?.OriginalAchatDiamond; imageKey = diamond?.id_achat; }
        else if (dp && typeof dp === 'object') { diamond = dp?.OriginalAchatDiamond; imageKey = diamond?.id_achat; }
        if (!imageKey) imageKey = row.original.id_fact; const k = String(imageKey);
        // Fetch images once per key
        React.useEffect(() => {
          const numericKey = Number(imageKey);
            if (!images[k] && !imageUrls[k] && numericKey) fetchImages(numericKey);
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [k, imageKey]);
        const urls = imageUrls[k] || []; const token = localStorage.getItem('token');
        const openDialog = (i: number) => {
          // Prefer blob/object URLs if already fetched; otherwise use raw urls with token
          let list = images[k];
          if (!list || !list.length) {
            list = urls.map(u => {
              if (!token) return u;
              return u.includes('token=') ? u : u + (u.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
            });
          }
          // Dialog now shows only images
          setDialogImages(list || []);
          setDialogIndex(i);
          setImageDialogOpen(true);
        };
        return <Box sx={{ width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {urls.length ? <Box component='img' onClick={() => openDialog(0)} src={(() => { let u = urls[0]; if (u && token && !u.includes('token=')) u += (u.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token); return u; })()} alt='img' loading='lazy' sx={{ maxHeight: 108, maxWidth: 108, border: '1px solid #ccc', borderRadius: 2, objectFit: 'contain', cursor: 'pointer', '&:hover': { transform: 'scale(1.03)' }, transition: 'transform .3s' }} /> : <Typography variant='caption' color='text.secondary'>{images[k] ? 'No Image' : 'Loading...'}</Typography>}
          {urls.length ? <Typography variant='caption' sx={{ position: 'absolute', bottom: 4, right: 8, background: '#0008', color: '#fff', px: 0.5, borderRadius: 1 }}>{1}/{urls.length}</Typography> : null}
        </Box>;
      }
    },
    { accessorKey: 'id_fact', header: 'ID', size: 50 },
    {
      accessorFn: r => r.Fournisseur?.client_name, header: 'Brand', size: 120,
      Cell: ({ row }) => {
        let diamond: any; const dp: any = row.original.DistributionPurchase; if (Array.isArray(dp) && dp.length) diamond = dp[0]?.OriginalAchatDiamond; else if (dp) diamond = dp?.OriginalAchatDiamond;
        const nickname = diamond?.common_local_brand; const brand = row.original.Fournisseur?.client_name;
        return <Box sx={{ display: 'flex', flexDirection: 'column' }}><Typography variant='body2' sx={{ fontWeight: 600 }}>{brand || '-'}</Typography>{nickname && <Typography variant='caption' color='text.secondary'>{nickname}</Typography>}</Box>;
      }
    },
    {
      header: 'Details', id: 'details', size: 350,
      Cell: ({ row }) => {
        const diamond = getDiamondFromRow(row.original);
        if (!diamond) return <Typography variant='caption' color='text.secondary'>No details</Typography>;
        return <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, lineHeight: 1.1 }}>
          {/* 1) Product Name (Design_art) first line, bold and colored like Selling Price */}
          {(() => {
            const f = fieldsToShow.find(ff => ff.key === 'Design_art');
            if (!f) return null;
            const raw = diamond[f.key];
            if (raw === null || raw === undefined || raw === '') return null;
            const val = f.format ? f.format(raw) : raw;
            return (
              <Box key={f.key} sx={{ width: '100%' }}>
                <Typography variant='subtitle1' sx={{ fontWeight: 800, color: 'warning.main' }}>
                  <b>{f.label}:</b> {String(val)}
                </Typography>
              </Box>
            );
          })()}
          {/* 2) Rest of fields excluding Product Name and Selling Price */}
          {fieldsToShow.filter(f => f.key !== 'Design_art' && f.key !== 'SellingPrice').map(f => {
            const raw = diamond[f.key];
            if (raw === null || raw === undefined || raw === '') return null;
            let val: any = f.format ? f.format(raw) : raw;
            // Combine Item Cost with its currency directly
            if (f.key === 'price_per_carat') {
              const cur = diamond?.currencyRetail;
              if (cur) val = `${val} ${cur}`;
            }
            return <Typography key={f.key} variant='caption'><b>{f.label}:</b> {String(val)}</Typography>;
          })}
          {/* 3) Selling Price last line, bold and colored (always show; default to 0.00 USD when empty) */}
          {(() => {
            const f = fieldsToShow.find(ff => ff.key === 'SellingPrice');
            if (!f) return null;
            const raw = diamond[f.key];
            const val = formatUSD((raw === null || raw === undefined || raw === '') ? 0 : raw);
            return (
              <Box key={f.key} sx={{ width: '100%', mt: 0.25 }}>
                <Typography variant='subtitle1' sx={{ fontWeight: 800, color: 'warning.main' }}>
                  <b>{f.label}:</b> {val}
                </Typography>
              </Box>
            );
          })()}
        </Box>;
      }
    },
  ], [images, imageUrls, fieldsToShow]);

  // Apply filters: Brand, Product Name, and Cost range
  const filteredData = React.useMemo(() => {
    const brandQ = brandFilter.trim().toLowerCase();
    const nameQ = productName.trim().toLowerCase();
    const refQ = refCode.trim().toLowerCase();
    const salesQ = salesCode.trim().toLowerCase();
    const min = costMin ? Number(costMin) : null;
    const max = costMax ? Number(costMax) : null;
    return data.filter((row) => {
      const diamond = getDiamondFromRow(row) || {};
      // Brand filter (supplier brand)
      const brand = (row.Fournisseur?.client_name || '').toLowerCase();
      const brandOk = !brandQ || brand.includes(brandQ);
      // Product Name filter (Design_art)
      const name = (diamond.Design_art || '').toString().toLowerCase();
      const nameOk = !nameQ || name.includes(nameQ);
      // Ref Code and Sales Code filters
      const refVal = (diamond.CODE_EXTERNAL || '').toString().toLowerCase();
      const salesVal = (diamond.comment_edit || '').toString().toLowerCase();
      const refOk = !refQ || refVal.includes(refQ);
      const salesOk = !salesQ || salesVal.includes(salesQ);
      // Cost filter: prefer SellingPrice; admin fallback to price_per_carat
      let cost = 0;
      if (typeof diamond.SellingPrice === 'number') cost = diamond.SellingPrice;
      else if (diamond.SellingPrice != null) {
        const n = Number(String(diamond.SellingPrice).replace(/[^0-9.-]/g, ''));
        cost = isNaN(n) ? 0 : n;
      } else if (isAdmin && typeof diamond.price_per_carat === 'number') {
        cost = diamond.price_per_carat;
      }
      const minOk = min === null || cost >= min;
      const maxOk = max === null || cost <= max;
      return brandOk && nameOk && refOk && salesOk && minOk && maxOk;
    });
  }, [data, brandFilter, productName, refCode, salesCode, costMin, costMax, isAdmin]);

  // Helper to fetch base64 image for export (PNG, resized)
  const getBase64FromUrl = (url: string) => new Promise<string | null>(resolve => {
    const img = new Image(); img.crossOrigin = 'Anonymous';
    img.onload = () => { const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240; const ctx = canvas.getContext('2d'); if (ctx) { ctx.fillStyle = '#fff'; ctx.fillRect(0,0,240,240); ctx.drawImage(img, 0, 0, 240, 240); resolve(canvas.toDataURL('image/png')); } else resolve(null); };
    img.onerror = () => resolve(null); img.src = url;
  });

  // Excel export with all fields + image (first image per item)
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Diamond Inventory');
    // Prepare columns: Image + basic + dynamic diamond fields
    const diamondColumns = fieldsToShow.map(f => ({ header: f.label, key: f.key }));
    sheet.columns = [
      { header: 'Image', key: '__image', width: 15 },
      { header: 'Inventory ID', key: 'id_fact', width: 12 },
      { header: 'Supplier Brand', key: 'brand', width: 18 },
      { header: 'Supplier Type', key: 'stype', width: 14 },
      ...diamondColumns.map(c => ({ ...c, width: 18 }))
    ];
    sheet.getRow(1).font = { bold: true };
    // Find Selling Price column index for styling later
    const sellingPriceColumnIndex = (sheet.columns || []).findIndex((c: any) => c?.key === 'SellingPrice');
    // Add data rows
    for (const row of filteredData) {
      const diamond = getDiamondFromRow(row) || {};
      // Determine image (first one)
      let imageKey: any = diamond?.id_achat || row.id_fact; const k = String(imageKey);
      let firstImg = images[k]?.[0];
      // If we only have original urls not blobs yet, attempt to fetch base64 of first raw url
      if (!firstImg && imageUrls[k]?.length) firstImg = imageUrls[k][0];
      let imgBase64: string | null = null;
      if (firstImg) imgBase64 = await getBase64FromUrl(firstImg);
      const record: any = {
        id_fact: row.id_fact,
        brand: row.Fournisseur?.client_name || '',
        stype: row.Fournisseur?.TYPE_SUPPLIER || ''
      };
      // Map diamond fields
      fieldsToShow.forEach(f => {
        const raw = diamond[f.key];
        const base = (raw === null || raw === undefined || raw === '') ? '' : (f.format ? f.format(raw) : raw);
        if (f.key === 'SellingPrice') {
          record[f.key] = formatUSD((raw === null || raw === undefined || raw === '') ? 0 : raw);
        } else if (f.key === 'price_per_carat') {
          const cur = diamond?.currencyRetail;
          record[f.key] = cur ? `${base} ${cur}` : base;
        } else {
          record[f.key] = base;
        }
      });
      const added = sheet.addRow(record);
      added.height = 60; // space for image
      // Bold Selling Price for admins
      if (isAdmin && sellingPriceColumnIndex >= 0) {
        try {
          const cell = added.getCell(sellingPriceColumnIndex + 1); // 1-based index
          cell.font = { ...(cell.font || {}), bold: true };
        } catch {}
      }
      if (imgBase64) {
        const clean = imgBase64.includes(',') ? imgBase64.split(',')[1] : imgBase64; // remove data url prefix if present
        try {
          const imgId = workbook.addImage({ base64: clean, extension: 'png' });
          const rowIndex = added.number; // 1-based
          sheet.addImage(imgId, {
            tl: { col: 0, row: rowIndex - 1 }, // top-left
            ext: { width: 70, height: 70 }
          });
        } catch (e) {
          console.warn('Failed to embed image for row', row.id_fact, e);
        }
      }
    }
    // Style header
  sheet.getRow(1).eachCell((cell: any) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17618C' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    sheet.columns?.forEach(col => { if (col.key !== '__image') col.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }; });
    // Generate file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'diamond_inventory.xlsx'; document.body.appendChild(a); a.click(); setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  };

  const table = useMaterialReactTable({
    columns,
    data: filteredData,
    state: { isLoading: loading, density: 'compact' },
    initialState: { pagination: { pageSize: 4, pageIndex: 0 } },
    muiTableBodyRowProps: { sx: { height: 44 } },
    muiTableBodyCellProps: { sx: { py: 0.5, px: 0.75 } },
    muiTableHeadCellProps: { sx: { py: 0.5 } },
  });
  const itemCount = React.useMemo(() => filteredData.length, [filteredData]);
  // Grouped counts lists: per Product Name (Design_art) and per Brand (supplier)
  const productCounts = React.useMemo(() => {
    const m = new Map<string, number>();
    filteredData.forEach((row) => {
      const name = String((getDiamondFromRow(row) || {}).Design_art ?? '').trim();
      if (!name) return;
      m.set(name, (m.get(name) || 0) + 1);
    });
    return Array.from(m.entries()).sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
  }, [filteredData]);
  const brandCounts = React.useMemo(() => {
    const m = new Map<string, number>();
    filteredData.forEach((row) => {
      const name = String(row.Fournisseur?.client_name ?? '').trim();
      if (!name) return;
      m.set(name, (m.get(name) || 0) + 1);
    });
    return Array.from(m.entries()).sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
  }, [filteredData]);
  const [productCountsOpen, setProductCountsOpen] = React.useState(false);
  const [brandCountsOpen, setBrandCountsOpen] = React.useState(false);

  return <Box p={0.5}>
    <Dialog open={imageDialogOpen} onClose={() => setImageDialogOpen(false)} maxWidth='md' fullWidth>
      <DialogTitle>Product Images</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 400 }}>
          {/* Image / Viewer */}
          <Box sx={{ position: 'relative', overflow: 'hidden', bgcolor: '#111', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360 }}
               onMouseMove={handleMouseMove} onMouseLeave={endDrag} onMouseUp={endDrag}>
            {dialogImages.length ? <>
              <IconButton sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'white', bgcolor: '#0006', '&:hover': { bgcolor: '#0009' } }} onClick={() => setDialogIndex(i => (i - 1 + dialogImages.length) % dialogImages.length)}>{'\u2039'}</IconButton>
              <Box onWheel={handleWheel} onMouseDown={handleMouseDown} sx={{ cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default', userSelect: 'none' }}>
                <img src={dialogImages[dialogIndex]} alt='Product' draggable={false} style={{ maxWidth: zoom === 1 ? '100%' : 'none', maxHeight: zoom === 1 ? '70vh' : 'none', objectFit: 'contain', transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transition: dragging ? 'none' : 'transform 0.15s ease-out' }} />
              </Box>
              <IconButton sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'white', bgcolor: '#0006', '&:hover': { bgcolor: '#0009' } }} onClick={() => setDialogIndex(i => (i + 1) % dialogImages.length)}>{'\u203A'}</IconButton>
              <Typography variant='caption' sx={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', color: '#fff', px: 1, py: 0.25, bgcolor: '#0007', borderRadius: 1 }}>{dialogIndex + 1} / {dialogImages.length}</Typography>
              <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 1 }}>
                <IconButton size='small' onClick={zoomOut} sx={{ bgcolor: '#0006', color: '#fff', '&:hover': { bgcolor: '#0009' } }}><ZoomOutIcon fontSize='small' /></IconButton>
                <IconButton size='small' onClick={zoomIn} sx={{ bgcolor: '#0006', color: '#fff', '&:hover': { bgcolor: '#0009' } }}><ZoomInIcon fontSize='small' /></IconButton>
                <IconButton size='small' onClick={resetZoom} sx={{ bgcolor: '#0006', color: '#fff', '&:hover': { bgcolor: '#0009' } }}><RestartAltIcon fontSize='small' /></IconButton>
              </Box>
              <Typography variant='caption' sx={{ position: 'absolute', top: 8, left: 8, color: '#fff', bgcolor: '#0007', px: 1, py: 0.25, borderRadius: 1 }}>Zoom: {zoom.toFixed(2)}x</Typography>
            </> : <Typography color='white'>No image available</Typography>}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions><Button onClick={() => setImageDialogOpen(false)}>Close</Button></DialogActions>
    </Dialog>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
      <Typography variant='h5' sx={{ fontWeight: 'bold' }}>Diamond Inventory List</Typography>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Typography variant='body2' sx={{ color: 'text.secondary' }}>Total Items: {itemCount.toLocaleString()}</Typography>
        <Button variant='outlined' color='primary' onClick={() => setProductCountsOpen(true)} sx={{ textTransform: 'none', fontWeight: 600 }}>Counts by Product</Button>
        <Button variant='outlined' color='secondary' onClick={() => setBrandCountsOpen(true)} sx={{ textTransform: 'none', fontWeight: 600 }}>Counts by Brand</Button>
        <Button variant='contained' color='primary' onClick={handleExportExcel} sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 'bold', px: 3, py: 1 }}>Export Excel</Button>
      </Box>
    </Box>
    {/* Dialog: Counts by Product Name */}
    <Dialog open={productCountsOpen} onClose={() => setProductCountsOpen(false)} maxWidth='sm' fullWidth>
      <DialogTitle>Counts by Product Name</DialogTitle>
      <DialogContent>
        {productCounts.length ? (
          <Box sx={{ maxHeight: 400, overflowY: 'auto', pr: 1 }}>
            {productCounts.map(([name, count]) => (
              <Box key={name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant='body2' sx={{ mr: 2, wordBreak: 'break-word' }}>{name}</Typography>
                <Box sx={{ backgroundColor: 'primary.main', color: 'primary.contrastText', px: 1, py: 0.25, borderRadius: 2, minWidth: 36, textAlign: 'center', fontWeight: 700 }}>{count}</Box>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant='body2' color='text.secondary'>No items to summarize.</Typography>
        )}
      </DialogContent>
      <DialogActions><Button onClick={() => setProductCountsOpen(false)}>Close</Button></DialogActions>
    </Dialog>
    {/* Dialog: Counts by Brand */}
    <Dialog open={brandCountsOpen} onClose={() => setBrandCountsOpen(false)} maxWidth='sm' fullWidth>
      <DialogTitle>Counts by Brand</DialogTitle>
      <DialogContent>
        {brandCounts.length ? (
          <Box sx={{ maxHeight: 400, overflowY: 'auto', pr: 1 }}>
            {brandCounts.map(([name, count]) => (
              <Box key={name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant='body2' sx={{ mr: 2, wordBreak: 'break-word' }}>{name}</Typography>
                <Box sx={{ backgroundColor: 'secondary.main', color: 'secondary.contrastText', px: 1, py: 0.25, borderRadius: 2, minWidth: 36, textAlign: 'center', fontWeight: 700 }}>{count}</Box>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant='body2' color='text.secondary'>No items to summarize.</Typography>
        )}
      </DialogContent>
      <DialogActions><Button onClick={() => setBrandCountsOpen(false)}>Close</Button></DialogActions>
    </Dialog>
    <Box sx={{ display: 'flex', gap: 2 }}>
      {/* Left Filter Sidebar */}
      <Box sx={(theme) => ({
        width: 260,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        p: 1,
        borderRadius: 2,
        bgcolor: theme.palette.mode === 'dark' ? '#1f2937' : '#f8fafc',
        border: `1px solid ${theme.palette.divider}`,
      })}>
        <Typography variant='subtitle1' sx={{ fontWeight: 700, mb: 0.5 }}>Filters</Typography>
        {/* Brand */}
        <Box>
          <Typography variant='caption' sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>Brand</Typography>
          <TextField select size='small' fullWidth value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
            <MenuItem value=''>All Brands</MenuItem>
            {distinctBrands.map((b) => (
              <MenuItem key={b} value={b}>{b}</MenuItem>
            ))}
          </TextField>
        </Box>
        {/* Product Name */}
        <Box>
          <Typography variant='caption' sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>Product Name</Typography>
          <TextField size='small' fullWidth value={productName} onChange={(e) => setProductName(e.target.value)} placeholder='e.g. خاتم' />
        </Box>
        {/* Ref Code */}
        <Box>
          <Typography variant='caption' sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>Ref Code</Typography>
          <TextField size='small' fullWidth value={refCode} onChange={(e) => setRefCode(e.target.value)} placeholder='e.g., HP123' />
        </Box>
        {/* Sales Code */}
        <Box>
          <Typography variant='caption' sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>Sales Code</Typography>
          <TextField size='small' fullWidth value={salesCode} onChange={(e) => setSalesCode(e.target.value)} placeholder='e.g., 456' />
        </Box>
        {/* Cost Range */}
        <Box>
          <Typography variant='caption' sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>Cost (Selling Price)</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField size='small' type='number' fullWidth value={costMin} onChange={(e) => setCostMin(e.target.value)} placeholder='Min' />
            <TextField size='small' type='number' fullWidth value={costMax} onChange={(e) => setCostMax(e.target.value)} placeholder='Max' />
          </Box>
        </Box>
        <Button
          variant='contained'
          color='inherit'
          onClick={() => { setBrandFilter(''); setProductName(''); setRefCode(''); setSalesCode(''); setCostMin(''); setCostMax(''); }}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          Reset Filters
        </Button>
      </Box>
      {/* Table Area */}
      <Box sx={{ flex: 1 }}>
        <MaterialReactTable table={table} />
      </Box>
    </Box>
  </Box>;
};

export default DInventory;