import React, { useCallback, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Alert,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  Dialog as MuiDialog,
  DialogTitle as MuiDialogTitle,
  DialogContent as MuiDialogContent,
  DialogActions as MuiDialogActions,
} from "@mui/material";

interface AttchOPFilesProps {
  open: boolean;
  onClose: () => void;
  purchase: any | null;
  onUploaded?: () => void | Promise<void>;
}

const apiUrl = "http://localhost:9000/api";

// Note: Opurchases upload endpoint is `POST /Opurchases/upload-attachment`
// and the server stores attachment URLs on the purchase record. We list
// uploaded files by fetching `Opurchases/all` and parsing `attachmentUrl`.

const AttchOPFiles: React.FC<AttchOPFilesProps> = ({
  open,
  onClose,
  purchase,
  onUploaded,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    setFiles([]);
    const currentId = purchase?.id_achat;
    if (!open || !currentId) {
      setUploadedFiles([]);
      return;
    }
    try {
      // The server stores attachment URLs on the purchase record. Fetch all purchases and
      // extract the attachmentUrl for the current purchase id.
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`${apiUrl}/Opurchases/all`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) {
        setUploadedFiles([]);
        return;
      }
      const list = await res.json();
      const current = Array.isArray(list) ? list.find((p: any) => String(p.id_achat) === String(currentId)) : null;
      if (!current || !current.attachmentUrl) {
        setUploadedFiles([]);
        return;
      }
      // attachmentUrl may be a JSON string (array) or a single URL string
      try {
        const parsed = typeof current.attachmentUrl === 'string' ? JSON.parse(current.attachmentUrl) : current.attachmentUrl;
        if (Array.isArray(parsed)) setUploadedFiles(parsed);
        else if (typeof parsed === 'string') setUploadedFiles([parsed]);
        else setUploadedFiles([]);
      } catch (e) {
        // not JSON
        if (typeof current.attachmentUrl === 'string') setUploadedFiles([current.attachmentUrl]);
        else setUploadedFiles([]);
      }
    } catch (err) {
      console.error("Error fetching uploaded files:", err);
      setUploadedFiles([]);
    }
  }, [open, purchase?.id_achat]);

  React.useEffect(() => {
    fetchFiles();
  }, [open, purchase?.id_achat, fetchFiles]);

  // helper: call fetchFiles directly when needed

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => {
        const existingNames = new Set(prev.map((f) => f.name));
        return [...prev, ...newFiles.filter((f) => !existingNames.has(f.name))];
      });
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!files.length || !purchase?.id_achat) {
      setError("No files or purchase selected");
      return;
    }
    setUploading(true);
    setError(null);
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    const currentId = purchase?.id_achat;
    formData.append("id_achat", String(currentId));

    try {
      // Post to the Opurchases endpoint; server expects `id_achat` in body and files under "files"
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`${apiUrl}/Opurchases/upload-attachment?id_achat=${encodeURIComponent(String(currentId))}` , {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Upload failed:", res.status, text);
        setError(`Upload failed: ${res.status}`);
        return;
      }
      const json = await res.json().catch(() => ({}));
      const links = json.links || json.files || [];
      setFiles([]);
      setError(null);
      setSuccessMessage("Files uploaded successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
      onUploaded?.();
      if (Array.isArray(links) && links.length > 0) setUploadedFiles(links);
      else {
        await fetchFiles();
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setError("Upload error");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileUrl: string) => {
    // Deleting individual attachment files for Opurchases is not exposed
    // by the server. Inform the user it's not supported here.
    setError("Delete not supported for Gold purchases via this UI");
  };

  const handleAskDeleteFile = (fileUrl: string) => {
    setFileToDelete(fileUrl);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    await handleDeleteFile(fileToDelete);
    setDeleteDialogOpen(false);
    setFileToDelete(null);
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setFileToDelete(null);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Attach Files to Purchase</DialogTitle>
      <DialogContent>
        <Box mb={2}>
          {successMessage && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {successMessage}
            </Alert>
          )}
          <Button
            variant="outlined"
            component="label"
            disabled={uploading}
            style={{ marginBottom: 16 }}
          >
            Add File
            <input type="file" multiple hidden onChange={handleFileChange} />
          </Button>
          {!uploading && files.length > 0 && (
            <List>
              {files.map((file, idx) => (
                <ListItem key={idx}>
                  <ListItemText primary={file.name} />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handleRemoveFile(idx)}
                      disabled={uploading}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
          {uploadedFiles.length > 0 && (
            <Box mt={2}>
              <Typography variant="subtitle1">Uploaded Files:</Typography>
              <List>
                {uploadedFiles.map((fileUrl, idx) => (
                  <ListItem key={idx}>
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                      {fileUrl.split("/").pop()}
                    </a>
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={() => handleAskDeleteFile(fileUrl)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          {error && <Typography color="error">{error}</Typography>}
          {uploading && <LinearProgress variant="indeterminate" />}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          color="primary"
          variant="contained"
          disabled={uploading || files.length === 0}
        >
          Upload
        </Button>
      </DialogActions>
      <MuiDialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <MuiDialogTitle>Confirm Delete</MuiDialogTitle>
        <MuiDialogContent>
          <Typography>Are you sure you want to delete this file?</Typography>
        </MuiDialogContent>
        <MuiDialogActions>
          <Button onClick={handleCancelDelete} color="primary">
            No
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
          >
            Yes
          </Button>
        </MuiDialogActions>
      </MuiDialog>
    </Dialog>
  );
};

export default AttchOPFiles;
