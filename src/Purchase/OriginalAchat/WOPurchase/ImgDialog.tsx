import React, { useState, useEffect, ChangeEvent, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Button,
  Box,
} from "@mui/material";
import PhotoCamera from "@mui/icons-material/PhotoCamera";
import { AttachFile } from "@mui/icons-material";
import DeleteIcon from "@mui/icons-material/Delete";
import { Camera as CameraComponent } from "react-camera-pro";
import axios from "../../../api";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";

interface ImgDialogProps {
  open: boolean;
  onClose: () => void;
  id_achat: number | null;
  // Logical purchase type; backend maps these to folders WatchPic / DiamondPic / GoldPic
  type?: "watch" | "diamond" | "gold"; // default 'watch'
}

// Use relative base so axios instance baseURL handles host & optional /api prefix.
const API_BASE = "/images";

const ImgDialog: React.FC<ImgDialogProps> = ({
  open,
  onClose,
  id_achat,
  type = "watch",
}) => {
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraSize, setCameraSize] = useState<{
    width: number;
    height: number;
  }>({ width: 640, height: 480 });
  const cameraRef = React.useRef<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [snack, setSnack] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const fetchImages = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token || !id_achat) return;
    try {
      // Backend list endpoints:
      // watch -> /images/list/:id
      // diamond -> /images/list/diamond/:id
      // gold -> /images/list/gold/:id
      const listSegment = type === "watch" ? "" : `/${type}`;
      const listPath = `${API_BASE}/list${listSegment}/${id_achat}`.replace(/\/\/{2,}/g, "/");
      const res = await axios.get(listPath, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Normalize payload (array of strings OR array of objects with url/path/filename/name)
      if (
        Array.isArray(res.data) &&
        res.data.length > 0 &&
        typeof res.data[0] === "object"
      ) {
        const key = Object.keys(res.data[0]).find((k) =>
          ["url", "path", "filename", "name"].includes(k)
        );
        if (key) {
          setImages(res.data.map((img: any) => img[key]));
        } else {
          setImages([]);
        }
      } else {
        setImages(res.data);
      }
    } catch (err) {
      setImages([]);
    }
  }, [id_achat, type]);

  useEffect(() => {
    if (open && id_achat) {
      fetchImages();
    } else {
      setImages([]);
    }
    setSelectedFile(null);
    setError(null);
  }, [open, id_achat, type, fetchImages]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !id_achat) return;
    setUploading(true);
    setError(null);
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("id_achat", String(id_achat));
    try {
      // Upload endpoint always typed for uniform folder mapping (WatchPic / DiamondPic / GoldPic)
      await axios.post(`${API_BASE}/upload/${type}/${id_achat}`.replace(/\/\/{2,}/g, "/"), formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      setSelectedFile(null);
      fetchImages();
    } catch (err: any) {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Add Images</DialogTitle>
        <DialogContent>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Add images for purchase ID: {id_achat ?? "N/A"}
        </Typography>
        <Box mb={2}>
          <input
            accept="image/*"
            style={{ display: "none" }}
            id="upload-image-input"
            type="file"
            onChange={handleFileChange}
          />
          <label htmlFor="upload-image-input">
            <Button
              color="secondary"
              variant="contained"
              component="span"
              startIcon={<AttachFile />}
              disabled={uploading}
              sx={{ textTransform: "none", mr: 2 }}
            >
              Add image
            </Button>
          </label>
          <Button
            color="primary"
            variant="contained"
            component="span"
            startIcon={<PhotoCamera />}
            disabled={uploading}
            sx={{ textTransform: "none" }}
            onClick={() => setShowCamera(true)}
          >
            Take a photo
          </Button>
          {selectedFile && (
            <Button
              onClick={handleUpload}
              variant="outlined"
              sx={{ ml: 2 }}
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          )}
        </Box>
        {error && <Typography color="error">{error}</Typography>}
        <Box mt={2}>
          <Typography variant="subtitle1">Uploaded Images:</Typography>
          <Box display="flex" flexWrap="wrap" gap={2}>
            {images.length === 0 && (
              <Box width="100%">
                <Typography color="text.secondary">
                  No images uploaded yet.
                </Typography>
              </Box>
            )}
            {images.map((url, idx) => {
              // Ensure the image URL is absolute and append token as query param
              const token = localStorage.getItem("token");
              let imgSrc = url;
              if (token) {
                imgSrc += (imgSrc.includes("?") ? "&" : "?") + "token=" + token;
              }
              // Extract filename for delete
              const filename = url.split("/").pop()?.split("?")[0] || "";
              return (
                <Box
                  key={idx}
                  sx={{
                    width: {
                      xs: "100%",
                      sm: "48%",
                      md: "31%",
                    },
                    aspectRatio: "4/3",
                    minWidth: 120,
                    maxWidth: 300,
                    mb: 2,
                    boxShadow: 2,
                    borderRadius: 2,
                    overflow: "hidden",
                    position: "relative",
                    display: "flex",
                    alignItems: "stretch",
                    transition: "box-shadow 0.3s",
                    "&:hover": {
                      boxShadow: 6,
                    },
                  }}
                >
                  <Box
                    component="img"
                    src={imgSrc}
                    alt={`img-${idx}`}
                    loading="lazy"
                    onError={(e) => {
                      // Fallback sequence for watch type only
                      if (type === 'watch') {
                        const target = e.currentTarget as HTMLImageElement;
                        try {
                          const original = imgSrc.split('?')[0];
                          if (/\/images\//.test(original)) {
                            const u = new URL(original, window.location.origin);
                            const parts = u.pathname.split('/'); // ['', 'images', id, filename]
                            if (parts.length >= 4) {
                              const idPart = parts[2];
                              const filePart = parts.slice(3).join('/');
                              const fallback = `${u.protocol}//${u.host}/uploads/WatchPic/${idPart}/${filePart}`;
                              console.warn('[ImgDialog] watch image failed; retrying via static path:', fallback);
                              target.onerror = null; // prevent loop
                              target.src = fallback;
                              return;
                            }
                          }
                        } catch (err) {
                          console.warn('[ImgDialog] fallback build error:', err);
                        }
                        // Inline placeholder if fallback not applied
                        const placeholder =
                          'data:image/svg+xml;utf8,' +
                          encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120"><rect width="160" height="120" fill="#f0f0f0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12" fill="#999">No Image</text></svg>`);
                        (e.currentTarget as HTMLImageElement).src = placeholder;
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const src = (e.currentTarget as HTMLImageElement).src;
                      setZoomImg(src);
                    }}
                    sx={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      flex: 1,
                      display: "block",
                      background: "#f9f9f9",
                      imageRendering: "auto",
                      transition: "transform 0.3s",
                      cursor: "zoom-in",
                      "&:hover": {
                        transform: "scale(1.04)",
                      },
                    }}
                  />
                  <Button
                    size="small"
                    sx={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      minWidth: 0,
                      width: 32,
                      height: 32,
                      zIndex: 2,
                      background: "rgba(255,255,255,0.7)",
                      color: "error.main",
                      "&:hover": { background: "rgba(255,255,255,1)" },
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(filename);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </Button>
                </Box>
              );
            })}
          </Box>
        </Box>
      </DialogContent>
      <Box display="flex" justifyContent="flex-end" gap={1} p={2}>
        <Button onClick={onClose} color="primary" variant="outlined">
          Close
        </Button>
      </Box>
    </Dialog>

    {/* Zoom Dialog */}
    <Dialog
        open={!!zoomImg}
        onClose={() => setZoomImg(null)}
        maxWidth={false}
        fullScreen
      >
        <Box
          sx={{
            position: "relative",
            bgcolor: "#000",
            width: "100vw",
            height: "100vh",
            p: 0,
            m: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Button
            onClick={() => setZoomImg(null)}
            sx={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 2,
              color: "#fff",
              background: "rgba(0,0,0,0.4)",
              fontSize: 20,
              px: 2,
              py: 1,
            }}
          >
            Close
          </Button>
          {zoomImg && (
            <Box
              component="img"
              src={zoomImg}
              alt="zoomed-img"
              sx={{
                maxWidth: "100vw",
                maxHeight: "100vh",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                borderRadius: 2,
                boxShadow: 6,
                background: "#222",
                m: "auto",
                display: "block",
              }}
            />
          )}
        </Box>
      </Dialog>

      {/* Camera Dialog */}
      <Dialog
        open={showCamera}
        onClose={() => setShowCamera(false)}
        maxWidth="md"
        fullWidth
      >
        <Box
          sx={{
            p: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            maxWidth: 700,
            mx: "auto",
          }}
        >
          <Box mb={2} display="flex" gap={1} alignItems="center">
            <Typography variant="body2">Quality:</Typography>
            <Button
              size="small"
              variant={cameraSize.width === 320 ? "contained" : "outlined"}
              onClick={() => setCameraSize({ width: 320, height: 240 })}
            >
              Low
            </Button>
            <Button
              size="small"
              variant={cameraSize.width === 640 ? "contained" : "outlined"}
              onClick={() => setCameraSize({ width: 640, height: 480 })}
            >
              Medium
            </Button>
            <Button
              size="small"
              variant={cameraSize.width === 1280 ? "contained" : "outlined"}
              onClick={() => setCameraSize({ width: 1280, height: 960 })}
            >
              High
            </Button>
          </Box>
          <Box
            sx={{
              width: "100%",
              maxWidth: 640,
              height: 480,
              mb: 2,
              borderRadius: 2,
              overflow: "hidden",
              boxShadow: 2,
              background: "#000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Box sx={{ width: "100%", height: "100%" }}>
              <CameraComponent
                ref={cameraRef}
                aspectRatio={4 / 3}
                errorMessages={{
                  noCameraAccessible: "No camera accessible",
                  permissionDenied: "Permission denied",
                  switchCamera: "Switch camera",
                  canvas: "Canvas not supported",
                }}
              />
            </Box>
          </Box>
          <Box mt={2} display="flex" gap={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={async () => {
                if (cameraRef.current) {
                  const photo = cameraRef.current.takePhoto();
                  // Resize base64 image using canvas
                  const resizedBase64 = await resizeBase64Img(
                    photo,
                    cameraSize.width,
                    cameraSize.height
                  );
                  // Convert base64 to File
                  fetch(resizedBase64)
                    .then((res) => res.blob())
                    .then((blob) => {
                      const file = new File([blob], `photo_${Date.now()}.png`, {
                        type: "image/png",
                      });
                      setSelectedFile(file);
                      setShowCamera(false);
                    });
                }
              }}
            >
              Capture
            </Button>
            <Button variant="outlined" onClick={() => setShowCamera(false)}>
              Cancel
            </Button>
            <Button
              variant="text"
              onClick={() => {
                if (
                  cameraRef.current &&
                  cameraRef.current.devices &&
                  cameraRef.current.devices.length > 1
                ) {
                  const currentIdx = cameraRef.current.devices.findIndex(
                    (d: any) => d.deviceId === cameraRef.current.deviceId
                  );
                  const nextIdx =
                    (currentIdx + 1) % cameraRef.current.devices.length;
                  cameraRef.current.setDeviceId(
                    cameraRef.current.devices[nextIdx].deviceId
                  );
                }
              }}
            >
              Switch Camera
            </Button>
          </Box>
        </Box>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Image</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this image?</Typography>
        </DialogContent>
        <Box display="flex" justifyContent="flex-end" gap={1} p={2}>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              if (deleteTarget) {
                await handleDeleteImage(deleteTarget);
                setDeleteTarget(null);
                //  setSnack(result);
              }
            }}
          >
            Delete
          </Button>
        </Box>
      </Dialog>
      {/* Snackbar for feedback */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert
          elevation={6}
          variant="filled"
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.severity}
          sx={{ width: "100%" }}
        >
          {snack.message}
        </MuiAlert>
      </Snackbar>
    </>
  );

  // Helper function to resize base64 image using a canvas
  async function resizeBase64Img(
    base64: string,
    width: number,
    height: number
  ): Promise<string> {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = function () {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = base64;
    });
  }

  // Update handleDeleteImage to return snackbar state
  async function handleDeleteImage(filename: string) {
    if (!id_achat)
      return { open: true, message: "No purchase ID", severity: "error" };
    const token = localStorage.getItem("token");
    try {
      await axios.delete(`${API_BASE}/delete/${type}/${id_achat}/${filename}`.replace(/\/\/{2,}/g, "/"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchImages();
      return { open: true, message: "Image deleted", severity: "success" };
    } catch (err) {
      setError("Delete failed");
      return { open: true, message: "Delete failed", severity: "error" };
    }
  }
};

export default ImgDialog;
