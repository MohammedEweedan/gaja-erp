import { useEffect, useState } from "react";
import axios from "axios";
import {
  ThemeProvider,
  createTheme,
  Box,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  CssBaseline,
  Divider,
  Typography,
  Paper,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ImportExportIcon from "@mui/icons-material/ImportExport";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import * as XLSX from "xlsx";
import { useTranslation } from "react-i18next";

type ContractType = {
  id_contract_type: number;
  contract_name: string;
  contract_code?: string | null;
  description?: string | null;
};

const theme = createTheme();

const initialContract: ContractType = {
  id_contract_type: 0,
  contract_name: "",
  contract_code: "",
  description: "",
};

export default function ContractTypes() {
  const muiTheme = useTheme();
  const { t } = useTranslation();
  const accent: string = (muiTheme.palette as any)?.gaja?.[100] || muiTheme.palette.primary.main;
  const accent2: string = (muiTheme.palette as any)?.gaja?.[200] || muiTheme.palette.primary.light;

  const apiUrl = "http://localhost:9000/contract-types";

  const [data, setData] = useState<ContractType[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editItem, setEditItem] = useState<ContractType | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState<any>({});

  const fetchData = async () => {
    const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
    try {
      const res = await axios.get<ContractType[]>(`${apiUrl}/contract-types`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const list = Array.isArray(res.data) ? res.data : (res as any).data?.data || [];
      setData(list);
    } catch (e) {
      alert(t("common.loadError", "Error loading data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = () => {
    const e: any = {};
    if (!editItem?.contract_name) e.contract_name = t("hr.contractTypes.required.name", "Contract name is required");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAdd = () => {
    setEditItem(initialContract);
    setIsEditMode(false);
    setErrors({});
    setOpenDialog(true);
  };

  const handleEdit = (item: ContractType) => {
    setEditItem(item);
    setIsEditMode(true);
    setErrors({});
    setOpenDialog(true);
  };

  const handleSave = async () => {
    if (!validate() || !editItem) return;
    const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
    try {
      const payload = {
        contract_name: editItem.contract_name,
        contract_code: editItem.contract_code || "",
        description: editItem.description || "",
      };
      if (isEditMode) {
        await axios.put(`${apiUrl}/contract-type/${editItem.id_contract_type}`, payload, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      } else {
        await axios.post(`${apiUrl}/contract-type`, payload, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      }
      await fetchData();
      setOpenDialog(false);
      setEditItem(null);
    } catch (e: any) {
      alert(e?.response?.data?.message || t("common.saveError", "Save failed"));
    }
  };

  const handleDelete = async (item: ContractType) => {
    if (!window.confirm(t("hr.contractTypes.confirmDelete", "Are you sure you want to delete this contract type?"))) return;
    const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
    try {
      await axios.delete(`${apiUrl}/contract-type/${item.id_contract_type}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      await fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.message || t("common.deleteError", "Delete failed"));
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ p: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h5" fontWeight={900} sx={{ color: accent }}>
            {t("hr.contractTypes.title", "Contract Types")}
          </Typography>
          <Box>
            <Tooltip title={t("common.export", "Export") as string}>
              <IconButton
                onClick={() => {
                  const headers = [
                    t("hr.contractTypes.table.id", "ID"),
                    t("hr.contractTypes.table.name", "Name"),
                    t("hr.contractTypes.table.code", "Code"),
                    t("hr.contractTypes.table.description", "Description"),
                  ];
                  const rows = data.map((c) => [c.id_contract_type, c.contract_name, c.contract_code || "", c.description || ""]);
                  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
                  const workbook = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(workbook, worksheet, "ContractTypes");
                  XLSX.writeFile(workbook, "contract_types.xlsx");
                }}
                sx={{ color: accent }}
              >
                <ImportExportIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAdd}
              sx={{ ml: 1, bgcolor: accent, color: muiTheme.palette.getContrastText(accent), "&:hover": { bgcolor: accent2 } }}
            >
              {t("hr.contractTypes.add", "Add Contract Type")}
            </Button>
          </Box>
        </Box>

        <Paper variant="outlined" sx={{ borderColor: accent2, borderRadius: 2, p: 0, overflow: "hidden" }}>
          <Box sx={{ width: "100%", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ backgroundColor: accent }}>
                  <th style={{ position: "sticky", top: 0, zIndex: 1, textAlign: "left", padding: "14px 16px", fontSize: 14, letterSpacing: 0.5, textTransform: "uppercase", color: muiTheme.palette.text.primary, borderBottom: `2px solid ${muiTheme.palette.divider}` }}>
                    {t("hr.contractTypes.table.id", "ID")}
                  </th>
                  <th style={{ position: "sticky", top: 0, zIndex: 1, textAlign: "left", padding: "14px 16px", fontSize: 14, letterSpacing: 0.5, textTransform: "uppercase", color: muiTheme.palette.text.primary, borderBottom: `2px solid ${muiTheme.palette.divider}` }}>
                    {t("hr.contractTypes.table.name", "Name")}
                  </th>
                  <th style={{ position: "sticky", top: 0, zIndex: 1, textAlign: "left", padding: "14px 16px", fontSize: 14, letterSpacing: 0.5, textTransform: "uppercase", color: muiTheme.palette.text.primary, borderBottom: `2px solid ${muiTheme.palette.divider}` }}>
                    {t("hr.contractTypes.table.code", "Code")}
                  </th>
                  <th style={{ position: "sticky", top: 0, zIndex: 1, textAlign: "left", padding: "14px 16px", fontSize: 14, letterSpacing: 0.5, textTransform: "uppercase", color: muiTheme.palette.text.primary, borderBottom: `2px solid ${muiTheme.palette.divider}` }}>
                    {t("hr.contractTypes.table.description", "Description")}
                  </th>
                  <th style={{ position: "sticky", top: 0, zIndex: 1, textAlign: "left", padding: "14px 16px", fontSize: 14, letterSpacing: 0.5, textTransform: "uppercase", color: muiTheme.palette.text.primary, borderBottom: `2px solid ${muiTheme.palette.divider}` }}>
                    {t("common.actions.button", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: "center", color: muiTheme.palette.text.secondary }}>
                      {t("common.loading", "Loading…")}
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: "center", color: muiTheme.palette.text.secondary }}>
                      {t("hr.contractTypes.empty", "No contract types found")}
                    </td>
                  </tr>
                ) : (
                  data.map((c, idx) => {
                    const zebra = idx % 2 === 0;
                    return (
                      <tr key={c.id_contract_type} style={{ backgroundColor: zebra ? muiTheme.palette.background.paper : muiTheme.palette.background.default }}>
                        <td style={{ padding: "14px 16px", fontWeight: 700, fontSize: 16, color: muiTheme.palette.text.primary }}>
                          {c.id_contract_type}
                        </td>
                        <td style={{ padding: "14px 16px", fontWeight: 700, fontSize: 16, color: muiTheme.palette.text.primary }}>
                          {c.contract_name}
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: 15, color: muiTheme.palette.text.secondary }}>
                          {c.contract_code || ""}
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: 15, color: muiTheme.palette.text.secondary }}>
                          {c.description || ""}
                        </td>
                        <td style={{ padding: "10px 8px" }}>
                          <Tooltip title={t("common.edit", "Edit") as string}>
                            <IconButton onClick={() => handleEdit(c)} sx={{ color: accent }}>
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t("common.delete", "Delete") as string}>
                            <IconButton onClick={() => handleDelete(c)} color="error">
                              <DeleteOutlineIcon />
                            </IconButton>
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Box>
        </Paper>

        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontWeight: 900, color: accent }}>
            {isEditMode ? t("hr.contractTypes.edit", "Edit Contract Type") : t("hr.contractTypes.add", "Add Contract Type")}
          </DialogTitle>
          <Divider sx={{ mb: 0, borderColor: "divider", borderBottomWidth: 2 }} />
          <DialogContent>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mt: 2 }}>
              <TextField
                label={t("hr.contractTypes.name", "Contract Name")}
                fullWidth
                value={editItem?.contract_name || ""}
                onChange={(e) => setEditItem({ ...(editItem as ContractType), contract_name: e.target.value })}
                error={!!errors.contract_name}
                helperText={errors.contract_name}
              />
              <TextField
                label={t("hr.contractTypes.code", "Contract Code")}
                fullWidth
                value={editItem?.contract_code || ""}
                onChange={(e) => setEditItem({ ...(editItem as ContractType), contract_code: e.target.value })}
              />
              <TextField
                label={t("hr.contractTypes.description", "Description")}
                fullWidth
                multiline
                minRows={3}
                value={editItem?.description || ""}
                onChange={(e) => setEditItem({ ...(editItem as ContractType), description: e.target.value })}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>{t("common.cancel", "Cancel")}</Button>
            <Button onClick={handleSave} variant="contained" sx={{ bgcolor: accent, color: muiTheme.palette.getContrastText(accent), "&:hover": { bgcolor: accent2 } }}>
              {isEditMode ? t("common.saveChanges", "Save Changes") : t("common.save", "Save")}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}
