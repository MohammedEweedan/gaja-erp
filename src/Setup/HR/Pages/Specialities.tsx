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
import * as XLSX from "xlsx";
import { useTranslation } from "react-i18next";

type Speciality = {
  id_specialite: number;
  nom_specialite: string;
};

const theme = createTheme();

const initialSpec: Speciality = {
  id_specialite: 0,
  nom_specialite: "",
};

export default function Specialities() {
  const muiTheme = useTheme();
  const { t } = useTranslation();
  const accent: string = (muiTheme.palette as any)?.gaja?.[100] || muiTheme.palette.primary.main;
  const accent2: string = (muiTheme.palette as any)?.gaja?.[200] || muiTheme.palette.primary.light;

  const apiUrl = "http://localhost:9000/specialites";

  const [data, setData] = useState<Speciality[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editItem, setEditItem] = useState<Speciality | null>(null);
  const [errors, setErrors] = useState<any>({});

  const fetchData = async () => {
    const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
    try {
      const res = await axios.get<Speciality[]>(`${apiUrl}/specialites`, {
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
    if (!editItem?.nom_specialite) e.nom_specialite = t("hr.specialities.required.name", "Name is required");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAdd = () => {
    setEditItem(initialSpec);
    setErrors({});
    setOpenDialog(true);
  };

  const handleSave = async () => {
    if (!validate() || !editItem) return;
    const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
    try {
      const payload = {
        nom_specialite: editItem.nom_specialite,
      };
      await axios.post(`${apiUrl}/specialite`, payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      await fetchData();
      setOpenDialog(false);
      setEditItem(null);
    } catch (e: any) {
      alert(e?.response?.data?.message || t("common.saveError", "Save failed"));
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ p: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h5" fontWeight={900} sx={{ color: accent }}>
            {t("hr.specialities.title", "Specialities")}
          </Typography>
          <Box>
            <Tooltip title={t("common.export", "Export") as string}>
              <IconButton
                onClick={() => {
                  const headers = [
                    t("hr.specialities.table.id", "ID"),
                    t("hr.specialities.table.name", "Name"),
                  ];
                  const rows = data.map((s) => [s.id_specialite, s.nom_specialite]);
                  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
                  const workbook = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(workbook, worksheet, "Specialities");
                  XLSX.writeFile(workbook, "specialities.xlsx");
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
              {t("hr.specialities.add", "Add Speciality")}
            </Button>
          </Box>
        </Box>

        <Paper variant="outlined" sx={{ borderColor: accent2, borderRadius: 2, p: 0, overflow: "hidden" }}>
          <Box sx={{ width: "100%", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ backgroundColor: accent }}>
                  <th style={{ position: "sticky", top: 0, zIndex: 1, textAlign: "left", padding: "14px 16px", fontSize: 14, letterSpacing: 0.5, textTransform: "uppercase", color: muiTheme.palette.text.primary, borderBottom: `2px solid ${muiTheme.palette.divider}` }}>
                    {t("hr.specialities.table.id", "ID")}
                  </th>
                  <th style={{ position: "sticky", top: 0, zIndex: 1, textAlign: "left", padding: "14px 16px", fontSize: 14, letterSpacing: 0.5, textTransform: "uppercase", color: muiTheme.palette.text.primary, borderBottom: `2px solid ${muiTheme.palette.divider}` }}>
                    {t("hr.specialities.table.name", "Name")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={2} style={{ padding: 24, textAlign: "center", color: muiTheme.palette.text.secondary }}>
                      {t("common.loading", "Loading…")}
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ padding: 24, textAlign: "center", color: muiTheme.palette.text.secondary }}>
                      {t("hr.specialities.empty", "No specialities found")}
                    </td>
                  </tr>
                ) : (
                  data.map((s, idx) => {
                    const zebra = idx % 2 === 0;
                    return (
                      <tr key={s.id_specialite} style={{ backgroundColor: zebra ? muiTheme.palette.background.paper : muiTheme.palette.background.default }}>
                        <td style={{ padding: "14px 16px", fontWeight: 700, fontSize: 16, color: muiTheme.palette.text.primary }}>
                          {s.id_specialite}
                        </td>
                        <td style={{ padding: "14px 16px", fontWeight: 700, fontSize: 16, color: muiTheme.palette.text.primary }}>
                          {s.nom_specialite}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Box>
        </Paper>

        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 900, color: accent }}>
            {t("hr.specialities.add", "Add Speciality")}
          </DialogTitle>
          <Divider sx={{ mb: 0, borderColor: "divider", borderBottomWidth: 2 }} />
          <DialogContent>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mt: 2 }}>
              <TextField
                label={t("hr.specialities.name", "Speciality Name")}
                fullWidth
                value={editItem?.nom_specialite || ""}
                onChange={(e) => setEditItem({ ...(editItem as Speciality), nom_specialite: e.target.value })}
                error={!!errors.nom_specialite}
                helperText={errors.nom_specialite}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>{t("common.cancel", "Cancel")}</Button>
            <Button onClick={handleSave} variant="contained" sx={{ bgcolor: accent, color: muiTheme.palette.getContrastText(accent), "&:hover": { bgcolor: accent2 } }}>
              {t("common.save", "Save")}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

