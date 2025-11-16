// src/components/ScheduleDialog.tsx
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
} from "@mui/material";

export default function ScheduleDialog(props: {
  open: boolean;
  name: string;
  start: string;
  end: string;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onChange: (next: { start: string; end: string }) => void;
  onSave: () => Promise<void> | void;
}) {
  const { open, name, start, end, saving, error, onClose, onChange, onSave } =
    props;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Schedule — {name || ""}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Start"
            type="time"
            value={start}
            onChange={(e) => onChange({ start: e.target.value, end })}
            fullWidth
            inputProps={{ step: 60 }}
          />
          <TextField
            label="End"
            type="time"
            value={end}
            onChange={(e) => onChange({ start, end: e.target.value })}
            fullWidth
            inputProps={{ step: 60 }}
          />
        </Stack>
        {error ? (
          <div style={{ color: "#b91c1c", marginTop: 8, fontSize: 13 }}>
            {error}
          </div>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={!!saving}>
          Cancel
        </Button>
        <Button onClick={onSave} variant="contained" disabled={!!saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
