import * as React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import axios from "../../api";
import PermissionsDialog from "./PermissionsDialog";

export type Role = {
  id?: number;
  name: string;
  description?: string | null;
  permissions?: string | null;
};

type RolesDialogProps = {
  open: boolean;
  onClose: () => void;
};

export default function RolesDialog({ open, onClose }: RolesDialogProps) {
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editing, setEditing] = React.useState<Role | null>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [permissions, setPermissions] = React.useState("");
  const [permissionsPickerOpen, setPermissionsPickerOpen] = React.useState(false);

  const resetForm = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setPermissions("");
  };

  const loadRoles = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get("/roles");
      if (Array.isArray(res?.data)) setRoles(res.data);
    } catch (e) {
      console.error("Failed to load roles", e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      loadRoles();
      resetForm();
    }
  }, [open, loadRoles]);

  const startAdd = () => {
    resetForm();
  };

  const startEdit = (role: Role) => {
    setEditing(role);
    setName(role.name || "");
    setDescription(role.description || "");
    setPermissions(role.permissions || "");
  };

  const saveRole = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload: Role = {
        name: name.trim(),
        description: description.trim() || null,
        permissions: permissions.trim() || null,
      };

      if (editing && editing.id != null) {
        const res = await axios.put(`/roles/${editing.id}`, payload);
        const updated = res?.data ?? payload;
        setRoles((prev) =>
          prev.map((r) => (r.id === editing.id ? { ...r, ...updated } : r))
        );
      } else {
        const res = await axios.post("/roles", payload);
        const created = res?.data ?? payload;
        setRoles((prev) => [created, ...prev]);
      }
      resetForm();
    } catch (e) {
      console.error("Failed to save role", e);
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (role: Role) => {
    if (!role.id) return;
    if (!window.confirm("Delete this role?")) return;
    try {
      await axios.delete(`/roles/${role.id}`);
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
    } catch (e) {
      console.error("Failed to delete role", e);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Roles List</DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Typography variant="subtitle1">
            Manage Roles 
          </Typography>
          
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
          <TextField
            label="Role name"
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
          <TextField
            label="Description"
            size="small"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
          />
          <TextField
            label="Permissions (optional)"
            size="small"
            value={permissions}
            fullWidth
            helperText="Optional: choose actions / permissions for this role."
            InputProps={{
              readOnly: true,
              endAdornment: (
                <Button
                  size="small"
                  onClick={() => setPermissionsPickerOpen(true)}
                >
                  Edit permissions
                </Button>
              ),
            }}
          />
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
            <Button
              variant="contained"
              size="small"
              onClick={saveRole}
              disabled={saving || !name.trim()}
            >
              {editing ? "Update" : "Save"}
            </Button>
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : roles.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No roles found.
          </Typography>
        ) : (
          <List dense>
            {roles.map((role) => (
              <ListItem key={role.id ?? role.name} divider>
                <ListItemText
                  primary={role.name}
                  secondary={
                    <>
                      {role.description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          component="div"
                        >
                          Description: {role.description}
                        </Typography>
                      )}
                      {role.permissions && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          component="div"
                        >
                          Permissions: {role.permissions}
                        </Typography>
                      )}
                    </>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => startEdit(role)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  {role.id != null && (
                    <IconButton
                      edge="end"
                      size="small"
                      sx={{ ml: 1 }}
                      onClick={() => deleteRole(role)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
      <PermissionsDialog
        open={permissionsPickerOpen}
        initial={
          permissions
            ? String(permissions)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : []
        }
        onClose={() => setPermissionsPickerOpen(false)}
        onSave={(selected: string[]) => {
          setPermissions(selected.join(", "));
          setPermissionsPickerOpen(false);
        }}
      />
    </Dialog>
  );
}
