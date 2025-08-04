import React, { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from 'material-react-table';
import {
  Box, IconButton, Tooltip, Button, Typography
} from '@mui/material';


import ImportExportIcon from '@mui/icons-material/ImportExport';
import * as XLSX from 'xlsx';
import PhotoIcon from '@mui/icons-material/Photo';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';



type InventoryItem = {
  id_fact: number;
  desig_art: string;
  qty: number;
  qty_difference: number;
  Fournisseur: {
    client_name: string;
    code_supplier: string;
    TYPE_SUPPLIER: string;
  };
  user: {
    name_user: string;
    email: string;
  };
  id_art?: number; // Added for image reference
  DistributionPurchase?: {
    OriginalAchatWatch?: Record<string, any>;
    // ...other fields if needed
  };
};



interface Props {
  Type?: string;
}

const API_BASEImage = 'http://102.213.182.8:9000/images';

// Helper to fetch image as blob with auth
const fetchImageWithAuth = async (url: string, token: string) => {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
};

const WInventory = (props: Props) => {
  const { Type = '' } = props;
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
  const [data, setData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [imageUrls, setImageUrls] = useState<Record<string, string[]>>({});
  const [images, setImages] = useState<Record<string, string[]>>({});
  const [carouselIndex, setCarouselIndex] = useState<Record<string, number>>({});

  const navigate = useNavigate();
  const apiUrl = "http://102.213.182.8:9000/Inventory";

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return navigate("/");

    try {
      const response = await axios.get<InventoryItem[]>(`${apiUrl}/allActive`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { ps, type_supplier: Type }
      });
      setData(response.data);


      console.log("Fetched data:", response.data);
    } catch (error: any) {
      if (error.response?.status === 401) navigate("/");
      else console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [navigate, ps, Type]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);



  const fetchImages = async (id_achat: number) => {
    const token = localStorage.getItem('token');
    if (!token || !id_achat) return;
    try {
      const res = await axios.get(`${API_BASEImage}/list/${id_achat}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let urls: string[] = [];
      if (Array.isArray(res.data) && res.data.length > 0 && typeof res.data[0] === 'object') {
        urls = res.data.map((img: any) => img.url || img);
      } else {
        urls = res.data;
      }
      setImageUrls(prev => ({ ...prev, [id_achat]: urls }));
      // Fetch all images as blobs with auth
      const blobUrls = await Promise.all(urls.map(url => fetchImageWithAuth(url, token)));
      setImages(prev => ({ ...prev, [id_achat]: blobUrls.filter((url): url is string => Boolean(url)) }));
    } catch (err) {
      setImages(prev => ({ ...prev, [id_achat]: [] }));
      setImageUrls(prev => ({ ...prev, [id_achat]: [] }));
    }
  };



  const columns = useMemo<MRT_ColumnDef<InventoryItem>[]>(() => [
    {
      header: 'Image',
      id: 'image',
      Cell: ({ row }) => {
        // Robustly determine imageKey for this row
        let imageKey: string | number | undefined = undefined;
        let watch: any = undefined;
        let dp: any = row.original.DistributionPurchase;
        if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === 'object') {
          watch = dp[0]?.OriginalAchatWatch;
          imageKey = watch?.id_achat;
        } else if (dp && typeof dp === 'object') {
          watch = dp?.OriginalAchatWatch;
          imageKey = watch?.id_achat;
        }
        if (!imageKey) imageKey = row.original.id_fact;
        const imageKeyStr = String(imageKey);
        // Fetch images if not already fetched
        useEffect(() => {
          if (!images[imageKeyStr] && !imageUrls[imageKeyStr]) {
            fetchImages(Number(imageKey));
          }
        }, [imageKeyStr]);
        const urls = imageUrls[imageKeyStr] || [];
        const idx = carouselIndex[imageKeyStr] ?? 0;
        const token = localStorage.getItem('token');
        // Carousel navigation handlers


        // Dialog open handler
        const handleOpenDialog = (imgIdx: number) => {
          setDialogImages(images[imageKeyStr] || []); // Use blob/object URLs for dialog
          setDialogIndex(imgIdx);
          setImageDialogOpen(true);
        };
        return (
          <Box
            sx={{
              width: 200,
              height: 220,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 2,
              overflow: 'hidden',
              position: 'relative',
              mr: 3,
            }}
          >
            {urls.length > 0 ? (
              <>
                <Box sx={{ flex: 1, height: 200, minWidth: 120, maxWidth: 200, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>

                    <Box
                      component="img"
                      src={(() => {
                        let url = urls[idx];
                        if (!url) return '';
                        if (token && !url.includes('token=')) {
                          url += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
                        }
                        return url;
                      })()}
                      alt={`Image ${idx + 1}`}
                      loading="lazy"
                      sx={{
                        maxHeight: 180,
                        height: 180,
                        maxWidth: 180,
                        borderRadius: 8,
                        border: '1px solid #ccc',
                        cursor: 'pointer',
                        width: '100%',
                        objectFit: 'contain',
                        flex: 1,
                        display: 'block',
                        background: '#f9f9f9',
                        imageRendering: 'auto',
                        transition: 'transform 0.3s',
                        '&:hover': {
                          transform: 'scale(1.04)',
                        },
                      }}
                      onClick={() => handleOpenDialog(idx)}
                      onError={e => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/default-image.png';
                      }}
                      title={urls[idx] || 'No image URL'}
                    />

                  </Box>
                  <Typography variant="caption" sx={{ mt: 1 }}>{idx + 1} / {urls.length}</Typography>
                </Box>
              </>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180 }}>
                <Box
                  component="img"
                  src="/default-image.png"
                  alt="No Image"
                  sx={{ maxHeight: 120, maxWidth: 120, opacity: 0.5, mb: 1 }}
                />
                <Typography variant="caption" color="text.secondary">No Image</Typography>
              </Box>
            )}
          </Box>
        );
      }
    },
    {
      accessorKey: 'id_fact',
      header: 'ID',
      size: 30
    },


    {
      accessorKey: 'Design_art',
      header: 'Model',
      size: 100
    },



    {
      accessorFn: (row) => row.Fournisseur?.client_name,
      header: 'Brand',
      size: 80
    },


    {
      header: 'Details',
      id: 'details',
      size: 300,
      Cell: ({ row }) => {
        const watch = row.original.DistributionPurchase?.OriginalAchatWatch;
        if (!watch) return <Typography variant="caption" color="text.secondary">No details</Typography>;
        return (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            {watch.id_achat && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>system Original ref.:</b> {watch.id_achat}
              </Typography>
            )}
            {watch.reference_number && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Ref.:</b> {watch.reference_number}
              </Typography>
            )}
            {watch.serial_number && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Serial No.:</b> {watch.serial_number}
              </Typography>
            )}
            {watch.movement && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Movement:</b> {watch.movement}
              </Typography>
            )}
            {watch.caliber && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Caliber:</b> {watch.caliber}
              </Typography>
            )}
            {watch.gender && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Gender:</b> {watch.gender}
              </Typography>
            )}
            {watch.condition && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Condition:</b> {watch.condition}
              </Typography>
            )}
            {watch.diamond_total_carat && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Diamond Carat:</b> {watch.diamond_total_carat}
              </Typography>
            )}
            {watch.diamond_quality && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Diamond Quality:</b> {watch.diamond_quality}
              </Typography>
            )}
            {watch.diamond_setting && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Diamond Setting:</b> {watch.diamond_setting}
              </Typography>
            )}
            {watch.number_of_diamonds && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Diamonds #:</b> {watch.number_of_diamonds}
              </Typography>
            )}
            {watch.custom_or_factory && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Custom/Factory:</b> {watch.custom_or_factory}
              </Typography>
            )}
            {watch.case_material && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Case Material:</b> {watch.case_material}
              </Typography>
            )}
            {watch.case_size && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Case Size:</b> {watch.case_size}
              </Typography>
            )}
            {watch.bezel && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Bezel:</b> {watch.bezel}
              </Typography>
            )}
            {watch.bracelet_type && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Bracelet Type:</b> {watch.bracelet_type}
              </Typography>
            )}
            {watch.bracelet_material && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Bracelet Material:</b> {watch.bracelet_material}
              </Typography>
            )}
            {watch.dial_color && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Dial Color:</b> {watch.dial_color}
              </Typography>
            )}
            {watch.dial_style && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Dial Style:</b> {watch.dial_style}
              </Typography>
            )}
            {watch.crystal && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Crystal:</b> {watch.crystal}
              </Typography>
            )}
            {watch.water_resistance && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Water Resistance:</b> {watch.water_resistance}
              </Typography>
            )}
            {watch.functions && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Functions:</b> {watch.functions}
              </Typography>
            )}
            {watch.power_reserve && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Power Reserve:</b> {watch.power_reserve}
              </Typography>
            )}
            {typeof watch.box_papers !== 'undefined' && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Box/Papers:</b> {watch.box_papers ? 'Yes' : 'No'}
              </Typography>
            )}
            {watch.warranty && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Warranty:</b> {watch.warranty}
              </Typography>
            )}
            {watch.common_local_brand && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <b>Local Brand:</b> {watch.common_local_brand}
              </Typography>
            )}


          </Box>
        );
      }
    },

  ], [images]);

  const table = useMaterialReactTable({
    columns,
    data,
    state: { isLoading: loading, density: 'compact' },
    enableDensityToggle: true,
    initialState: {
      pagination: {
        pageSize: 5,
        pageIndex: 0
      }
    },
  });



  const { totalAmount, itemCount } = useMemo(() => {
    const totalAmount = data.reduce((sum, item) => sum + (item.qty || 0), 0);

    const itemCount = data.length;
    return { totalAmount, itemCount };
  }, [data]);



  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [dialogImages, setDialogImages] = useState<string[]>([]);
  const [dialogIndex, setDialogIndex] = useState(0);


  // Helper to convert blob/object URL to base64 data URL (high quality, larger canvas)
  const getBase64FromUrl = (url: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.crossOrigin = 'Anonymous';
      img.onload = function () {
        // Use a much larger canvas for better quality
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, 300, 300);
          resolve(canvas.toDataURL('image/png', 1.0));
        } else {
          resolve(null);
        }
      };
      img.onerror = function () { resolve(null); };
      img.src = url;
    });
  };

  // PDF Export Handler
  const handleExportPDF = async () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'A4' });
    const tableColumn = [
      'Image',
      'ID',
      'Designation',
      'Brand',
      'Type',
      'Responsible',
      'Details',
    ];
    // Prepare table rows and keep a reference to the original data
    const pdfRowData: any[] = [];
    const tableRows = await Promise.all(data.map(async (row) => {
      let imageKey;
      let watch;
      let dp = row.DistributionPurchase;
      if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === 'object') {
        watch = dp[0]?.OriginalAchatWatch;
        imageKey = watch?.id_achat;
      } else if (dp && typeof dp === 'object') {
        watch = dp?.OriginalAchatWatch;
        imageKey = watch?.id_achat;
      }
      if (!imageKey) imageKey = row.id_fact;
      const imageKeyStr = String(imageKey);
      const imgUrl = images[imageKeyStr]?.[0];
      let imgBase64: string | null = null;
      if (imgUrl) {
        // Use a larger canvas for better quality
        imgBase64 = await new Promise((resolve) => {
          const img = new window.Image();
          img.crossOrigin = 'Anonymous';
          img.onload = function () {
            const canvas = document.createElement('canvas');
            canvas.width = 240; // 2x size for better quality
            canvas.height = 240;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, 240, 240);
              resolve(canvas.toDataURL('image/png'));
            } else {
              resolve(null);
            }
          };
          img.onerror = function () { resolve(null); };
          img.src = imgUrl;
        });
      }
      let details = '';
      if (watch) {
        details =
          (watch.id_achat ? `| system Original ref.: ${watch.id_achat} ` : '') +
          (watch.reference_number ? `| Ref.: ${watch.reference_number} ` : '') +
          (watch.serial_number ? `| Serial No.: ${watch.serial_number} ` : '') +
          (watch.movement ? `| Movement: ${watch.movement} ` : '') +
          (watch.caliber ? `| Caliber: ${watch.caliber} ` : '') +
          (watch.gender ? `| Gender: ${watch.gender} ` : '') +
          (watch.condition ? `| Condition: ${watch.condition} ` : '') +
          (watch.diamond_total_carat ? `| Diamond Carat: ${watch.diamond_total_carat} ` : '') +
          (watch.diamond_quality ? `| Diamond Quality: ${watch.diamond_quality} ` : '') +
          (watch.diamond_setting ? `| Diamond Setting: ${watch.diamond_setting} ` : '') +
          (watch.number_of_diamonds ? `| Diamonds #: ${watch.number_of_diamonds} ` : '') +
          (watch.custom_or_factory ? `| Custom/Factory: ${watch.custom_or_factory} ` : '') +
          (watch.case_material ? `| Case Material: ${watch.case_material} ` : '') +
          (watch.case_size ? `| Case Size: ${watch.case_size} ` : '') +
          (watch.bezel ? `| Bezel: ${watch.bezel} ` : '') +
          (watch.bracelet_type ? `| Bracelet Type: ${watch.bracelet_type} ` : '') +
          (watch.bracelet_material ? `| Bracelet Material: ${watch.bracelet_material} ` : '') +
          (watch.dial_color ? `| Dial Color: ${watch.dial_color} ` : '') +
          (watch.dial_style ? `| Dial Style: ${watch.dial_style} ` : '') +
          (watch.crystal ? `| Crystal: ${watch.crystal} ` : '') +
          (watch.water_resistance ? `| Water Resistance: ${watch.water_resistance} ` : '') +
          (watch.functions ? `| Functions: ${watch.functions} ` : '') +
          (watch.power_reserve ? `| Power Reserve: ${watch.power_reserve} ` : '') +
          (typeof watch.box_papers !== 'undefined' ? `| Box/Papers: ${watch.box_papers ? 'Yes' : 'No'} ` : '') +
          (watch.warranty ? `| Warranty: ${watch.warranty} ` : '');
      }
      pdfRowData.push({ imageKeyStr, imgBase64 });
      return [
        imgBase64 ? '' : '',
        row.id_fact,
        row.desig_art,
        row.Fournisseur?.client_name || '',
        row.Fournisseur?.TYPE_SUPPLIER || '',
        row.user?.name_user || '',
        details,
      ];
    }));

    doc.setFontSize(20);
    doc.text('Watch Inventory List', 40, 40);
    autoTable(doc, {
      startY: 60,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      styles: {
        fontSize: 12,
        cellPadding: 8,
        overflow: 'linebreak',
        valign: 'middle',
        halign: 'center',
        minCellHeight: 80,
      },
      headStyles: {
        fillColor: [22, 160, 133],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 13,
        halign: 'center',
        valign: 'middle',
      },
      columnStyles: {
        0: { cellWidth: 100, halign: 'center', valign: 'middle' }, // image
        1: { cellWidth: 50 },
        2: { cellWidth: 120 },
        3: { cellWidth: 90 },
        4: { cellWidth: 90 },
        5: { cellWidth: 90 },
        6: { cellWidth: 350 },
      },
      didDrawCell: (data) => {
        if (data.column.index === 0) {
          const rowIdx = data.row.index;
          const imgBase64 = pdfRowData[rowIdx]?.imgBase64;
          if (imgBase64) {
            // Center image in cell
            const cellWidth = data.cell.width;
            const cellHeight = data.cell.height;
            const imgSize = 80; // px
            const x = data.cell.x + (cellWidth - imgSize) / 2;
            const y = data.cell.y + (cellHeight - imgSize) / 2;
            doc.addImage(imgBase64, 'PNG', x, y, imgSize, imgSize);
          }
        }
      },
      margin: { left: 30, right: 30 },
      tableWidth: 'auto',
      willDrawCell: (data) => {
        // Set min row height for all rows
        data.cell.height = Math.max(data.cell.height, 90);
      },
    });
    doc.save('inventory_list.pdf');
  };

  // HTML Export Handler
  const handleExportHTML = async () => {
    let html = `<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Watch Inventory List</title><style>
      body { font-family: Arial, sans-serif; background: #f7f7f7; margin: 0; padding: 24px; }
      h2 { color: #17618c; }
      table { border-collapse: collapse; width: 100%; background: #fff; box-shadow: 0 2px 8px #0001; }
      th, td { border: 1px solid #e0e0e0; padding: 10px 8px; text-align: center; }
      th { background: #17618c; color: #fff; font-size: 1.05em; }
      tr:nth-child(even) { background: #f3f8fa; }
      img { max-width: 90px; max-height: 90px; border-radius: 8px; border: 1px solid #ccc; background: #fafafa; }
      .details { text-align: left; font-size: 0.98em; }
    </style></head><body>`;
    html += `<h2>Watch Inventory List</h2>`;
    html += `<table><thead><tr>`;
    html += `<th style='width:90px;'>Image</th><th style='width:60px;'>ID</th><th style='width:90px;'>Brand</th><th style='width:90px;'>Type</th><th style='width:420px;'>Details</th>`;
    html += `</tr></thead><tbody>`;
    for (const row of data) {
      let imageKey;
      let watch;
      let dp = row.DistributionPurchase;
      if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === 'object') {
        watch = dp[0]?.OriginalAchatWatch;
        imageKey = watch?.id_achat;
      } else if (dp && typeof dp === 'object') {
        watch = dp?.OriginalAchatWatch;
        imageKey = watch?.id_achat;
      }
      if (!imageKey) imageKey = row.id_fact;
      const imageKeyStr = String(imageKey);
      const imgUrl = images[imageKeyStr]?.[0];
      let imgTag = `<span style='color:#aaa;'>No Image</span>`;
      if (imgUrl) {
        // Convert to base64 for HTML export
        // eslint-disable-next-line no-await-in-loop
        const base64 = await getBase64FromUrl(imgUrl);
        if (base64) {
          imgTag = `<img src='${base64}' alt='' />`;
        }
      }
      let details = '';
      if (watch) {
        details =
          (watch.id_achat ? `| system Original ref.: ${watch.id_achat} ` : '') +
          (watch.reference_number ? `| Ref.: ${watch.reference_number} ` : '') +
          (watch.serial_number ? `| Serial No.: ${watch.serial_number} ` : '') +
          (watch.movement ? `| Movement: ${watch.movement} ` : '') +
          (watch.caliber ? `| Caliber: ${watch.caliber} ` : '') +
          (watch.gender ? `| Gender: ${watch.gender} ` : '') +
          (watch.condition ? `| Condition: ${watch.condition} ` : '') +
          (watch.diamond_total_carat ? `| Diamond Carat: ${watch.diamond_total_carat} ` : '') +
          (watch.diamond_quality ? `| Diamond Quality: ${watch.diamond_quality} ` : '') +
          (watch.diamond_setting ? `| Diamond Setting: ${watch.diamond_setting} ` : '') +
          (watch.number_of_diamonds ? `| Diamonds #: ${watch.number_of_diamonds} ` : '') +
          (watch.custom_or_factory ? `| Custom/Factory: ${watch.custom_or_factory} ` : '') +
          (watch.case_material ? `| Case Material: ${watch.case_material} ` : '') +
          (watch.case_size ? `| Case Size: ${watch.case_size} ` : '') +
          (watch.bezel ? `| Bezel: ${watch.bezel} ` : '') +
          (watch.bracelet_type ? `| Bracelet Type: ${watch.bracelet_type} ` : '') +
          (watch.bracelet_material ? `| Bracelet Material: ${watch.bracelet_material} ` : '') +
          (watch.dial_color ? `| Dial Color: ${watch.dial_color} ` : '') +
          (watch.dial_style ? `| Dial Style: ${watch.dial_style} ` : '') +
          (watch.crystal ? `| Crystal: ${watch.crystal} ` : '') +
          (watch.water_resistance ? `| Water Resistance: ${watch.water_resistance} ` : '') +
          (watch.functions ? `| Functions: ${watch.functions} ` : '') +
          (watch.power_reserve ? `| Power Reserve: ${watch.power_reserve} ` : '') +
          (typeof watch.box_papers !== 'undefined' ? `| Box/Papers: ${watch.box_papers ? 'Yes' : 'No'} ` : '') +
          (watch.warranty ? `| Warranty: ${watch.warranty} ` : '');
      }
      html += `<tr>`;
      html += `<td>${imgTag}</td>`;
      html += `<td style='width:60px;'>${row.id_fact}</td>`;
      html += `<td style='width:90px;'>${row.Fournisseur?.client_name || ''}</td>`;
      html += `<td style='width:90px;'>${row.Fournisseur?.TYPE_SUPPLIER || ''}</td>`;
      html += `<td class='details' style='width:420px;'>${details}</td>`;
      html += `</tr>`;
    }
    html += `</tbody></table></body></html>`;
    // Download
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_list.html';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  return (
    <Box p={0.5}>
      {/* Image Dialog */}
      <Dialog
        open={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Product Images</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              minHeight: '400px',
              position: 'relative',
            }}
          >
            {dialogImages.length > 0 ? (
              <>
                <IconButton
                  size="large"
                  sx={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)' }}
                  onClick={() => setDialogIndex(idx => (idx - 1 + dialogImages.length) % dialogImages.length)}
                  aria-label="Previous image"
                >
                  {'\u2039'}
                </IconButton>
                <img
                  src={dialogImages[dialogIndex]}
                  alt={`Product image ${dialogIndex + 1}`}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '80vh',
                    objectFit: 'contain',
                    margin: '0 auto',
                    display: 'block',
                  }}
                />
                <IconButton
                  size="large"
                  sx={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}
                  onClick={() => setDialogIndex(idx => (idx + 1) % dialogImages.length)}
                  aria-label="Next image"
                >
                  {'\u203A'}
                </IconButton>
                <Typography variant="caption" sx={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)' }}>{dialogIndex + 1} / {dialogImages.length}</Typography>
              </>
            ) : (
              <Typography>No image available</Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>


      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
          Watch Inventory List
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>




          <Box
            sx={{
              backgroundColor: 'error.main',
              color: 'inherit',
              px: 1.5,
              py: 0.5,
              borderRadius: 4,
              fontSize: '0.9rem',
              display: 'inline-flex',
              alignItems: 'center'
            }}
          >
            <Typography variant="body2" style={{ fontWeight: '500' }}>
              Items Count: {itemCount.toLocaleString()}
            </Typography>


          </Box>



          <Button
            variant="contained"
            color="success"
            onClick={handleExportHTML}
            sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 'bold', px: 3, py: 1, ml: 1, boxShadow: 2 }}
          >
            Export HTML
          </Button>

        </Box>
      </Box>

      <MaterialReactTable table={table} />
    </Box>
  );
};

export default WInventory;