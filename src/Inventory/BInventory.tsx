import { useEffect, useState, useMemo, useCallback } from 'react';
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
};



interface Props {
  Type?: string;
}

const BInventory = (props: Props) => {
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
 
  const [images, setImages] = useState<Record<number, string>>({});
  const navigate = useNavigate();
  const apiIp = process.env.REACT_APP_API_IP;
  const apiUrl = `http://${apiIp}/Inventory`;

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return navigate("/");

    try {
      const response = await axios.get<InventoryItem[]>(`${apiUrl}/allActive`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { ps, type_supplier: Type }
      });
      setData(response.data);
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



  const getPic = useCallback(async (id_art: number): Promise<void> => {
    if (!id_art || images[id_art]) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await axios.get(`${apiUrl}/getpic`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { id_art }
      });

      if (response.data?.[0]?.PIC1?.data) {
        // Convert Buffer array to Uint8Array
        const uint8Array = new Uint8Array(response.data[0].PIC1.data);

        // Convert to binary string
        let binary = '';
        uint8Array.forEach(byte => {
          binary += String.fromCharCode(byte);
        });

        // Create base64 string
        const base64Image = `data:image/png;base64,${window.btoa(binary)}`;

        setImages(prev => ({ ...prev, [id_art]: base64Image }));
      }
    } catch (error) {
      console.error("Error loading image:", error);
      setImages(prev => ({ ...prev, [id_art]: '' }));
    }
  }, [apiUrl, images]);



   



  const handleExportExcel = () => {
    const headers = [
      "ID",
      "Designation",
      "Qty",
      "Available Qty",
      "Fournisseur Name",
      "Fournisseur Code",
      "Fournisseur Type",
      "Responsible User",
      "User Email",
      "Image URL" // New column for image reference
    ];

    const rows = data.map(item => [
      item.id_fact,
      item.desig_art,
      item.qty,
      item.qty_difference,
      item.Fournisseur?.client_name || '',
      item.Fournisseur?.code_supplier || '',
      item.Fournisseur?.TYPE_SUPPLIER || '',
      item.user?.name_user || '',
      item.user?.email || '',
      item.id_art ? `${apiUrl}/getpic?id_fact=${item.id_fact}` : '' // Image URL
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
    XLSX.writeFile(workbook, "inventory.xlsx");
  };



  const columns = useMemo<MRT_ColumnDef<InventoryItem>[]>(() => [
    {
      accessorKey: 'id_fact',
      header: 'ID',
      size: 60
    },
    {
      accessorKey: 'Design_art',
      header: 'Designation',
      size: 200
    },
    {
      accessorKey: 'qty',
      header: 'Weight',
      size: 100
    },
    {
      accessorKey: 'qty_difference',
      header: 'Available',
      size: 100
    },
    {
      accessorFn: (row) => row.Fournisseur?.client_name,
      header: 'Brand',
      size: 150
    },
    {
      accessorFn: (row) => row.Fournisseur?.code_supplier,
      header: 'Fournisseur Code',
      size: 120
    },
    {
      accessorFn: (row) => row.Fournisseur?.TYPE_SUPPLIER,
      header: 'Fournisseur Type',
      size: 120
    },
    {
      accessorFn: (row) => row.user?.name_user,
      header: 'Responsible',
      size: 150
    },

    {
      header: 'Image',
      id: 'image',
      // size: 100,
      Cell: ({ row }) => {
        const id_art = row.original.id_fact;

        if (!id_art) return null;

        // Trigger image load if not already loaded
        if (!images[id_art]) {
          getPic(id_art);
        }

        return (
          <Box
            sx={{
              width: '70%',
              height: '40%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              position: 'relative', // Added for loading indicator
              overflow: 'hidden', // Prevent image overflow
              borderRadius: 5 // Optional: subtle rounded corners
            }}
          >
            {images[id_art] ? (
              <Box
                component="img"
                src={images[id_art]}
                alt="Product"
                sx={{
                  width: '80%',
                  height: '80%',
                  objectFit: 'contain',
                  transition: 'opacity 0.3s ease', // Smooth appearance
                  opacity: 1,
                  '&:hover': {
                    transform: 'scale(1.05)', // Optional: slight zoom on hover
                    transition: 'transform 0.2s ease'
                  }
                }}
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.style.display = 'none';
                  // Consider setting a fallback background color or icon here
                }}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <>
                {/* Loading skeleton */}
                <Box
                  sx={{
                    position: 'absolute',
                    width: '80%',
                    height: '80%',
                    backgroundColor: '#e0e0e0',
                    borderRadius: '8px'
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    color: 'text.secondary'
                  }}
                >
                  Loading...
                </Typography>
              </>
            )}
          </Box>
        );
      }
    },
    {
      header: 'Actions',
      id: 'actions',
      size: 120, // Increased size to accommodate additional button
      Cell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="View Image">
            <IconButton
              color="info"
              onClick={() => handleViewImage(row.original)}
              size="small"
              disabled={!row.original.id_fact || !images[row.original.id_fact]}
            >
              <PhotoIcon fontSize="small" />
            </IconButton>
          </Tooltip>

        </Box>
      ),
    },
  ], [getPic, images]);

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



  const { totalAmount, totalAmountQty, itemCount } = useMemo(() => {
    const totalAmount = data.reduce((sum, item) => sum + (item.qty || 0), 0);
    const totalAmountQty = data.reduce((sum, item) => sum + (item.qty_difference || 0), 0);
    const itemCount = data.length;
    return { totalAmount, totalAmountQty, itemCount };
  }, [data]);



  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleViewImage = (row: InventoryItem) => {
    if (row.id_fact && images[row.id_fact]) {
      setSelectedImage(images[row.id_fact]);
      setImageDialogOpen(true);
    } else {
      alert('No image available for this item');
    }
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
        <DialogTitle>Product Image</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              minHeight: '400px'
            }}
          >
            {selectedImage ? (
              <img
                src={selectedImage}
                alt="Product"
                style={{
                  maxWidth: '100%',
                  maxHeight: '80vh',
                  objectFit: 'contain'
                }}
              />
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
          Inventory List
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
              Total Weight: {totalAmountQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /g , Items Count: {itemCount.toLocaleString()}
            </Typography>


          </Box>



          <Button
            variant="outlined"
            color="secondary"
            startIcon={<ImportExportIcon />}
            onClick={handleExportExcel}
            sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 'bold', px: 3, py: 1 }}
          >
            Export Excel
          </Button>

        </Box>
      </Box>

      <MaterialReactTable table={table} />
    </Box>
  );
};

export default BInventory;