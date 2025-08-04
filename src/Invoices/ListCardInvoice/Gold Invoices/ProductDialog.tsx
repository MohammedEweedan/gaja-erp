import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Table, TableHead, TableRow, TableCell, TableBody, Box } from '@mui/material';

type Purchase = {
    id_fact: number;
    date_fact: string;
    client: number;
    id_art: number;
    qty: number;
    Full_qty: number;
    Unite: string;
    num_fact: number;
    usr: number;
    d_time: string;
    Design_art: string;
    Color_Gold: string;
    Color_Rush: string;
    Cost_Currency: number;
    RATE: number;
    Cost_Lyd: number;
    Selling_Price_Currency: number;
    CODE_EXTERNAL: string;
    Selling_Rate: number;
    is_selled: boolean;
    ps: number;
    IS_OK: boolean;
    COMMENT: string;
    comment_edit: string;
    date_inv: string;
    CURRENCY: string;
    General_Comment: string;
    MakingCharge: number;
    ShippingCharge: number;
    TravelExpesenes: number;
    cost_g: number;
    ExtraClient: number;
    Model: string;
    Serial_Number: string;
    WarrantyDate: string;
    Notes: string;
    client_name: string;
    TYPE_SUPPLIER: string;
    Fournisseur?: {
        id_client: number;
        client_name: string;
        TYPE_SUPPLIER: string;
    };
    Original_Invoice: string;
}

interface ProductDialogProps {
    open: boolean;
    onClose: () => void;
    onSelect: (product: Purchase) => void;
    pdata: Purchase[];
    selectedId: number;
}

const ProductDialog: React.FC<ProductDialogProps> = ({ open, onClose, onSelect, pdata, selectedId }) => {
    const [search, setSearch] = useState('');
    const [hasSearched, setHasSearched] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const [picMap, setPicMap] = useState<{ [id_art: number]: string | null }>({});
    const [largeImg, setLargeImg] = useState<string | null>(null);
    const [largeImgOpen, setLargeImgOpen] = useState(false);
    const apiIp = process.env.REACT_APP_API_IP;

    // Filter products by id_fact or qty (weight), but only show those with TYPE_SUPPLIER containing 'gold' (case-insensitive)
    const filteredProducts = hasSearched
        ? pdata.filter(product => {
            if (!search) return false; // Show nothing until search
            const searchLower = search.toLowerCase();
            const typeSupplier = product.Fournisseur?.TYPE_SUPPLIER || product.TYPE_SUPPLIER || '';
            const isGold = typeSupplier.toLowerCase().includes('gold');
            return isGold && (
                product.id_fact.toString().includes(searchLower) ||
                product.qty.toString().includes(searchLower)
            );
        })
        : [];

    // Helper function for large buffer to base64 conversion
    function bufferToBase64(buffer: number[]): string {
        let binary = '';
        const chunkSize = 0x8000; // 32k
        for (let i = 0; i < buffer.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, buffer.slice(i, i + chunkSize));
        }
        return btoa(binary);
    }

    // Fetch pictures only for filtered products after filter is terminated
    useEffect(() => {
        if (!open || filteredProducts.length === 0) return;
        let isCancelled = false;
        const MAX_IMAGES = 20; // Limit concurrent image fetches
        // Only fetch images for products that are not already in picMap
        const uniqueIdFacts = Array.from(new Set(filteredProducts.map(p => p.id_fact))).slice(0, MAX_IMAGES);
        const idsToFetch = uniqueIdFacts.filter(id => !(id in picMap));
        if (idsToFetch.length === 0) return; // All images already loaded
        const fetchPics = async () => {
            try {
                const token = localStorage.getItem('token');
                const newMap: { [id_fact: number]: string | null } = { ...picMap };
                await Promise.all(
                    idsToFetch.map(async (id_fact) => {
                        try {
                            const res = await axios.get(`http://${apiIp}/GetPICs/PIC/${id_fact}`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            let picData = res.data && res.data.PIC1;

                            console.log(`Fetched picture for id_fact ${id_fact}:`, picData);
                            if (picData && typeof picData === 'object' && picData.type === 'Buffer' && Array.isArray(picData.data)) {
                                picData = bufferToBase64(picData.data);
                            }
                            newMap[id_fact] = picData || null;
                        } catch {
                            newMap[id_fact] = null;
                        }
                    })
                );
                if (!isCancelled) setPicMap(newMap);
            } catch (err) {
                if (!isCancelled) setPicMap({ ...picMap });
                console.error('Error fetching pictures:', err);
            }
        };
        fetchPics();
        return () => { isCancelled = true; };
    }, [open, filteredProducts, picMap]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Select a Product</DialogTitle>
            <DialogContent>
                <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
                    <input
                        type="text"
                        placeholder="Search by ID or Weight"
                        value={searchValue}
                        onChange={e => setSearchValue(e.target.value)}
                        style={{ flex: 1, padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
                        autoFocus
                    />
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={() => {
                            setSearch(searchValue);
                            setHasSearched(true);
                        }}
                    >
                        Find
                    </Button>
                </Box>
                <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>ID</TableCell>
                                <TableCell>Name</TableCell>
                                <TableCell>Weight</TableCell>
                                <TableCell>Price</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Image</TableCell>
                                <TableCell>Select</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {hasSearched && filteredProducts.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} align="center">No products found.</TableCell>
                                </TableRow>
                            )}
                            {filteredProducts.map((product) => (
                                <TableRow key={product.id_fact} selected={selectedId === product.id_fact}>
                                    <TableCell>{product.id_fact}</TableCell>
                                    <TableCell>{product.Design_art}</TableCell>
                                    <TableCell>{product.qty}</TableCell>
                                    <TableCell>{product.Selling_Price_Currency}</TableCell>
                                    <TableCell>{product.Fournisseur?.TYPE_SUPPLIER}</TableCell>
                                    <TableCell>
                                        {picMap[product.id_fact] ? (
                                            <img
                                                src={`data:image/jpeg;base64,${picMap[product.id_fact]}`}
                                                alt="Product"
                                                style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }}
                                                onClick={() => {
                                                    setLargeImg(picMap[product.id_fact]);
                                                    setLargeImgOpen(true);
                                                }}
                                            />
                                        ) : (
                                            <span>No Image</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="contained"
                                            size="small"
                                            onClick={() => onSelect(product)}
                                        >
                                            Select
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
            </DialogActions>
            {largeImgOpen && largeImg && (
                <Dialog open={largeImgOpen} onClose={() => setLargeImgOpen(false)} maxWidth="lg">
                    <DialogTitle>Product Image</DialogTitle>
                    <DialogContent>
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                            <img
                                src={`data:image/jpeg;base64,${largeImg}`}
                                alt="Large Product"
                                style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 10 }}
                            />
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setLargeImgOpen(false)}>Close</Button>
                    </DialogActions>
                </Dialog>
            )}
        </Dialog>
    );
};

export default ProductDialog;
