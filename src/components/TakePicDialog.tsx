import React, { useState, useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, Typography, Button, Box } from '@mui/material';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import MuiAlert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { Camera as CameraComponent } from 'react-camera-pro';
import axios from '../../api';

interface TakePicDialogProps {
    open: boolean;
    onClose: () => void;
    itemId: number | string | null;
    type?: 'watch' | 'diamond'; // default 'watch'
}

const API_HOST = (process.env.REACT_APP_API_IP as string) || '';
const API_BASE = `${API_HOST}/images`;

const TakePicDialog: React.FC<TakePicDialogProps> = ({ open, onClose, itemId, type = 'watch' }) => {
    const [cameraSize, setCameraSize] = useState<{ width: number; height: number }>({ width: 640, height: 480 });
    const cameraRef = useRef<any>(null);
    const [uploading, setUploading] = useState(false);
    const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
    const [error, setError] = useState<string | null>(null);

    // Helper function to resize base64 image using a canvas
    async function resizeBase64Img(base64: string, width: number, height: number): Promise<string> {
        return new Promise((resolve) => {
            const img = new window.Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/png'));
            };
            img.src = base64;
        });
    }

    // Upload image to server
    async function handleUpload(base64: string) {
        if (!itemId) {
            setSnack({ open: true, message: 'No item selected', severity: 'error' });
            return;
        }
        setUploading(true);
        setError(null);
        const token = localStorage.getItem('token');
        // Convert base64 to File
        try {
            const res = await fetch(base64);
            const blob = await res.blob();
            const file = new File([blob], `photo_${Date.now()}.png`, { type: 'image/png' });
            const formData = new FormData();
            formData.append('image', file);
            formData.append('id_achat', String(itemId));
            await axios.post(`${API_BASE}/upload/${type}/${itemId}`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
            });
            setSnack({ open: true, message: 'Image uploaded', severity: 'success' });
        } catch (err) {
            setError('Upload failed');
            setSnack({ open: true, message: 'Upload failed', severity: 'error' });
        } finally {
            setUploading(false);
        }
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Take Picture for Item</DialogTitle>
            <DialogContent>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                    Take a picture for item ID: {itemId ?? 'N/A'}
                </Typography>
                <Box mb={2} display="flex" gap={1} alignItems="center">
                    <Typography variant="body2">Quality:</Typography>
                    <Button size="small" variant={cameraSize.width === 320 ? 'contained' : 'outlined'} onClick={() => setCameraSize({ width: 320, height: 240 })}>Low</Button>
                    <Button size="small" variant={cameraSize.width === 640 ? 'contained' : 'outlined'} onClick={() => setCameraSize({ width: 640, height: 480 })}>Medium</Button>
                    <Button size="small" variant={cameraSize.width === 1280 ? 'contained' : 'outlined'} onClick={() => setCameraSize({ width: 1280, height: 960 })}>High</Button>
                </Box>
                <Box sx={{ width: '100%', maxWidth: 640, height: 480, mb: 2, borderRadius: 2, overflow: 'hidden', boxShadow: 2, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Box sx={{ width: '100%', height: '100%' }}>
                        <CameraComponent
                            ref={cameraRef}
                            aspectRatio={4 / 3}
                            errorMessages={{
                                noCameraAccessible: "No camera accessible",
                                permissionDenied: "Permission denied",
                                switchCamera: "Switch camera",
                                canvas: "Canvas not supported"
                            }}
                        />
                    </Box>
                </Box>
                <Box mt={2} display="flex" gap={2}>
                    <Button variant="contained" color="primary" disabled={uploading} startIcon={<PhotoCamera />} onClick={async () => {
                        if (cameraRef.current) {
                            const photo = cameraRef.current.takePhoto();
                            const resizedBase64 = await resizeBase64Img(photo, cameraSize.width, cameraSize.height);
                            await handleUpload(resizedBase64);
                        }
                    }}>
                        {uploading ? 'Uploading...' : 'Capture & Upload'}
                    </Button>
                    <Button variant="outlined" onClick={onClose}>Cancel</Button>
                    <Button variant="text" onClick={() => {
                        if (cameraRef.current && cameraRef.current.devices && cameraRef.current.devices.length > 1) {
                            const currentIdx = cameraRef.current.devices.findIndex((d: any) => d.deviceId === cameraRef.current.deviceId);
                            const nextIdx = (currentIdx + 1) % cameraRef.current.devices.length;
                            cameraRef.current.setDeviceId(cameraRef.current.devices[nextIdx].deviceId);
                        }
                    }}>
                        Switch Camera
                    </Button>
                </Box>
                {error && <Typography color="error">{error}</Typography>}
            </DialogContent>
            <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <MuiAlert elevation={6} variant="filled" onClose={() => setSnack(s => ({ ...s, open: false }))} severity={snack.severity} sx={{ width: '100%' }}>
                    {snack.message}
                </MuiAlert>
            </Snackbar>
        </Dialog>
    );
};

export default TakePicDialog;