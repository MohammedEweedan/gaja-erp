import * as React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  ListItemIcon,
} from "@mui/material";

export const AVAILABLE_ACTIONS = [
  "Users",
  "Purchase",
  "Receive Products",
  "General Invoices",
  "Cash Book",
  "inventory",
  "Finance",
  "Sales Settings",
  "ItemsTakingPicture",
  "Change POS",
  "Change PS of Product",
  "Show Cost",
];

export default function PermissionsDialog({
  open,
  initial = [],
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: string[];
  onClose: () => void;
  onSave: (selected: string[]) => void;
}) {
  const [selected, setSelected] = React.useState<string[]>(() => initial || []);

  React.useEffect(() => {
    setSelected(initial || []);
  }, [initial]);

  const toggle = (name: string) => {
    setSelected((s) =>
      s.includes(name) ? s.filter((x) => x !== name) : [...s, name]
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Choose actions / permissions</DialogTitle>
      <DialogContent>
        <List>
          {AVAILABLE_ACTIONS.map((a) => (
            <ListItem
              key={a}
              onClick={() => toggle(a)}
              sx={{ cursor: "pointer" }}
            >
              <ListItemIcon>
                <Checkbox
                  edge="start"
                  checked={selected.includes(a)}
                  tabIndex={-1}
                  disableRipple
                />
              </ListItemIcon>
              <ListItemText primary={a} />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            setSelected((s) =>
              s.length === AVAILABLE_ACTIONS.length ? [] : [...AVAILABLE_ACTIONS]
            );
          }}
        >
          {selected.length === AVAILABLE_ACTIONS.length ? "Clear all" : "Select all"}
        </Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => {
            onSave(selected);
          }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
