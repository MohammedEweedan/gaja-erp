import React, { useState } from "react";
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

interface AttchWatchFilesProps {
  open: boolean;
  onClose: () => void;
  row?: any; // optional now
  id_achat?: number;
  onUploadSuccess: () => void;
  token: string;
}
const apiUrl = "https://system.gaja.ly/api";
const AttchWatchFiles: React.FC<AttchWatchFilesProps> = ({
  open,
  onClose,
  row,
  id_achat,
  onUploadSuccess,
  token,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  // Fetch uploaded files
  const fetchFiles = async () => {
    setFiles([]);

    const currentId = id_achat || row?.id_achat;
    if (!open || !currentId) {
      setUploadedFiles([]);
      return;
    }
    try {
      const res = await fetch(
        `${apiUrl}/uploads/WOpurchase/upload-attachment/${currentId}`,
        {
          ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setUploadedFiles(data.files || []);
      } else {
        setUploadedFiles([]);
      }
    } catch (err) {
      console.error("Error fetching uploaded files:", err);
      setUploadedFiles([]);
    }
  };

  // Fetch uploaded files when dialog opens or id_achat changes
  React.useEffect(() => {
    fetchFiles();
  }, [open, id_achat, row]);

  // Helper to refresh file list
  const refreshFiles = fetchFiles;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // Append new files to the existing list, avoiding duplicates by name
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
    if (!files.length || !(id_achat || row?.id_achat)) {
      setError("No files or purchase selected");
      return;
    }
    setUploading(true);
    setError(null);
    setProgress(0);
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      // Use the new endpoint for watch purchase attachments
      await fetch(
        `${apiUrl}/uploads/WOpurchase/upload-attachment/${id_achat || row?.id_achat}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );
      setFiles([]); // Reset file input after upload
      setError(null); // Clear any error
      setSuccessMessage("Files uploaded successfully!");
      setTimeout(() => setSuccessMessage(null), 3000); // Auto-hide after 3s
      onUploadSuccess();
      fetchFiles(); // Refresh the file list after adding new files

      // Do not close the dialog automatically
      // onClose();
    } catch (err: any) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  // Delete an uploaded file
  const handleDeleteFile = async (fileUrl: string) => {
    const currentId = id_achat || row?.id_achat;
    if (!currentId) return;
    const filename = decodeURIComponent(fileUrl.split("/").pop() || "");
    try {
      const res = await fetch(
        `${apiUrl}/uploads/WOpurchase/upload-attachment/${currentId}/${filename}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        await refreshFiles();
      } else {
        setError("Failed to delete file");
      }
    } catch (err) {
      setError("Failed to delete file");
    }
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
          {/* Only show the file input list if there are files to upload */}
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
          {/* Uploaded files list */}
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
      {/* Delete confirmation dialog */}
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

export default AttchWatchFiles;
