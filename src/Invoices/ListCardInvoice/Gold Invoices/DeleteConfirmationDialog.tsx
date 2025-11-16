import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  DialogContentText,
} from "@mui/material";

interface DeleteConfirmationDialogProps {
  open: boolean;
  invoiceNum: number | null;
  onCancel: () => void;
  onConfirm: () => void;
}

const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  open,
  invoiceNum,
  onCancel,
  onConfirm,
}) => (
  <Dialog
    open={open}
    onClose={onCancel}
    aria-labelledby="alert-dialog-title"
    aria-describedby="alert-dialog-description"
  >
    <DialogTitle
      id="alert-dialog-title"
      sx={{ bgcolor: "error.light", color: "error.contrastText" }}
    >
      Confirm Deletion
    </DialogTitle>
    <DialogContent sx={{ pt: 3 }}>
      <DialogContentText id="alert-dialog-description">
        Are you sure you want to delete invoice{" "}
        {invoiceNum ? `#${invoiceNum}` : ""}? This action cannot be undone.
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onCancel}>Cancel</Button>
      <Button onClick={onConfirm} color="error" variant="contained">
        Delete
      </Button>
    </DialogActions>
  </Dialog>
);

export default DeleteConfirmationDialog;
