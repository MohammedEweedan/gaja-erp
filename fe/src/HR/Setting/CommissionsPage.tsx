// src/HR/Compensation/CommissionsPage.tsx
import React from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  TextField,
  Button,
  Divider,
  Alert,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
} from "@mui/material";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import DiamondIcon from "@mui/icons-material/Diamond";
import WatchIcon from "@mui/icons-material/Watch";
import { useTranslation } from "react-i18next";
import { listEmployees } from "../../api/employees";

function getEmpDisplayName(e: any): string {
  if (!e || typeof e !== "object") return "-";

  // 1) Explicit known keys (EN + AR variants + common patterns)
  const nameCandidates: Array<string | null | undefined> = [
    // existing ones
    e.name_emp,
    e.Nom_prenom,
    e.NomPrenom,
    e.name,
    e.fullName,
    e.employee_name,
    e.emp_name,
    e.displayName,
    e.name_user,

    // first/last combos
    e.first_name && e.last_name
      ? `${e.first_name} ${e.last_name}`
      : null,
    e.firstName && e.lastName
      ? `${e.firstName} ${e.lastName}`
      : null,

    // Arabic-specific / alt naming
    e.name_emp_ar,
    e.Nom_prenom_ar,
    e.NomPrenom_ar,
    e.name_ar,
    e.full_name_ar,
    e.fullNameAr,
    e.employee_name_ar,
    e.emp_name_ar,
    e.displayNameAr,
    e.arabic_name,
    e.arName,
  ];

  const byKnownKey = nameCandidates
    .map((v) => (v == null ? "" : String(v).trim()))
    .find((v) => v.length > 0);

  if (byKnownKey) return byKnownKey;

  // 2) Generic Arabic fallback: pick any string field containing Arabic chars
  const arabicVal = Object.values(e).find(
    (v) =>
      typeof v === "string" &&
      /[\u0600-\u06FF]/.test(v) && // Arabic Unicode range
      v.trim().length > 0
  );

  if (arabicVal) return String(arabicVal).trim();

  // 3) Fallback to an ID if possible
  const idCandidates: Array<string | number | null | undefined> = [
    e.id_emp,
    e.ID_emp,
    e.id_employee,
    e.employee_id,
    e.id,
    e.id_user,
    e.user_id,
  ];

  const id = idCandidates.find(
    (v) => v != null && String(v).trim() !== ""
  );

  return id != null ? String(id) : "-";
}

const DEFAULTS = {
  gold: {
    sales_rep: 1,
    senior_sales_rep: 1.25,
    sales_lead: 1.5,
    sales_manager: 1.5,
  },
  diamond: {
    sales_rep: 1.5,
    senior_sales_rep: 3,
    sales_lead: 3,
    sales_manager: 3,
  },
  watch: {
    // Watch commissions – example defaults (percent of final sale price)
    sales_rep: 1.5,
    senior_sales_rep: 2,
    sales_lead: 2.25,
    sales_manager: 2.5,
  },
} as const;

type Rates = {
  gold: Record<string, number>;
  diamond: Record<string, number>;
  watch: Record<string, number>;
};

type Employee = any; // adjust to your real type if you have it

function loadSettings(): Rates {
  try {
    const raw = localStorage.getItem("commissionSettingsV1");
    if (!raw) return DEFAULTS as Rates;
    const js = JSON.parse(raw);
    return {
      gold: { ...DEFAULTS.gold, ...(js?.gold || {}) },
      diamond: { ...DEFAULTS.diamond, ...(js?.diamond || {}) },
      watch: { ...DEFAULTS.watch, ...(js?.watch || {}) },
    } as Rates;
  } catch {
    return DEFAULTS as Rates;
  }
}

export default function CommissionsPage() {
  const { t } = useTranslation();
  const [rates, setRates] = React.useState<Rates>(() => loadSettings());
  const [saveStatus, setSaveStatus] = React.useState<"success" | "error" | null>(
    null
  );
  const [tab, setTab] = React.useState<"gold" | "diamond" | "watch">("gold");

  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = React.useState(false);
  const [employeesError, setEmployeesError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const load = async () => {
      try {
        setEmployeesLoading(true);
        setEmployeesError(null);
        const res: any = await listEmployees();
        // Depending on your API shape, adjust this:
        const items = (res?.data ?? res) as Employee[];
        setEmployees(items || []);
      } catch (err) {
        setEmployeesError("load_failed");
      } finally {
        setEmployeesLoading(false);
      }
    };
    load();
  }, []);

  const setGold = (k: string, v: number) =>
    setRates((prev) => ({ ...prev, gold: { ...prev.gold, [k]: v } }));
  const setDiamond = (k: string, v: number) =>
    setRates((prev) => ({ ...prev, diamond: { ...prev.diamond, [k]: v } }));
  const setWatch = (k: string, v: number) =>
    setRates((prev) => ({ ...prev, watch: { ...prev.watch, [k]: v } }));

  const save = () => {
    try {
      localStorage.setItem("commissionSettingsV1", JSON.stringify(rates));
      setSaveStatus("success");
      setTimeout(() => setSaveStatus(null), 2500);
    } catch {
      setSaveStatus("error");
    }
  };

  const resetDefaults = () => {
    // True reset to hard-coded defaults (doesn't touch localStorage until you save)
    setRates(DEFAULTS as Rates);
  };

  const roles = [
    {
      key: "sales_rep",
      labelKey: "hr.commissions.roles.sales_rep",
      fallback: "Sales Rep",
    },
    {
      key: "senior_sales_rep",
      labelKey: "hr.commissions.roles.senior_sales_rep",
      fallback: "Senior Sales Rep",
    },
    {
      key: "sales_lead",
      labelKey: "hr.commissions.roles.sales_lead",
      fallback: "Sales Lead",
    },
    {
      key: "sales_manager",
      labelKey: "hr.commissions.roles.sales_manager",
      fallback: "Sales Manager",
    },
  ] as const;

  const renderRateFields = (kind: "gold" | "diamond" | "watch") => {
    const setter =
      kind === "gold" ? setGold : kind === "diamond" ? setDiamond : setWatch;

    const step = kind === "gold" ? "0.01" : "0.1";

      return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        gap: 2,
        width: "100%",
      }}
    >
      {roles.map((r) => (
        <Box
          key={r.key}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Typography sx={{ minWidth: 160, fontWeight: 500 }}>
            {t(r.labelKey, r.fallback)}
          </Typography>
          <TextField
            fullWidth
            size="small"
            type="number"
            inputProps={{ step }}
            value={rates[kind][r.key] ?? ""}
            onChange={(e) => setter(r.key, Number(e.target.value || 0))}
          />
        </Box>
      ))}
    </Box>
  );
  };

  return (
    <>
      <Stack spacing={2}>
        <Box textAlign="center">
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }} color="primary">
            {t("hr.commissions.title", "Commissions")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              "hr.commissions.subtitle",
              "Configure default commission rates for gold, diamond, and watch sales. These are used by payslip commission logic."
            )}
          </Typography>
        </Box>

        {saveStatus && (
          <Alert
            severity={saveStatus === "success" ? "success" : "error"}
            sx={{ mb: 1 }}
          >
            {saveStatus === "success"
              ? t(
                  "hr.commissions.savedOk",
                  "Saved successfully. These rates apply to payslip commission calculations."
                )
              : t(
                  "hr.commissions.savedError",
                  "Failed to save commission settings."
                )}
          </Alert>
        )}

        {/* Tabs for product types */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              variant="fullWidth"
              textColor="primary"
              indicatorColor="primary"
              sx={{ maxWidth: 520 }}
            >
              <Tab
                value="gold"
                icon={<WorkspacePremiumIcon fontSize="small" />}
                iconPosition="start"
                label={t("hr.commissions.tabGold", "Gold")}
              />
              <Tab
                value="diamond"
                icon={<DiamondIcon fontSize="small" />}
                iconPosition="start"
                label={t("hr.commissions.tabDiamond", "Diamond")}
              />
              <Tab
                value="watch"
                icon={<WatchIcon fontSize="small" />}
                iconPosition="start"
                label={t("hr.commissions.tabWatch", "Watch")}
              />
            </Tabs>
          </Box>

          <Box mt={2}>
            {tab === "gold" && (
              <Box>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, mb: 1 }}
                >
                  {t("hr.commissions.goldTitle", "Gold — Per-gram (LYD/g)")}
                </Typography>
                {renderRateFields("gold")}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 1, display: "block" }}
                >
                  {t(
                    "hr.commissions.goldHint",
                    "Sales Lead/Manager use grams aggregated from their PS scope (set per employee in profile)."
                  )}
                </Typography>
              </Box>
            )}

            {tab === "diamond" && (
              <Box>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, mb: 1 }}
                >
                  {t(
                    "hr.commissions.diamondTitle",
                    "Diamond — Percent of final sale price (%)"
                  )}
                </Typography>
                {renderRateFields("diamond")}
              </Box>
            )}

            {tab === "watch" && (
              <Box>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, mb: 1 }}
                >
                  {t(
                    "hr.commissions.watchCommissionTitle",
                    "Watch — Percent of final sale price (%)"
                  )}
                </Typography>
                {renderRateFields("watch")}

                <Alert severity="info" sx={{ mt: 2 }}>
                  {t(
                    "hr.commissions.watchNotWired",
                    "Watch commission settings are not wired into the APIs or database yet. Changing these values will not affect payslips until backend support is implemented."
                  )}
                </Alert>
              </Box>
            )}
          </Box>
        </Paper>

        {/* Read-only preview */}
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            bgcolor: (theme) =>
              theme.palette.mode === "light"
                ? "grey.50"
                : theme.palette.background.default,
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            {t(
              "hr.commissions.watchTitle",
              "Current commission settings (read-only)"
            )}
          </Typography>
          <Stack spacing={1.5}>
            {roles.map((r) => {
              const goldVal =
                rates.gold[r.key] ?? (DEFAULTS.gold as any)[r.key] ?? 0;
              const diamondVal =
                rates.diamond[r.key] ??
                (DEFAULTS.diamond as any)[r.key] ??
                0;
              const watchVal =
                rates.watch[r.key] ?? (DEFAULTS.watch as any)[r.key] ?? 0;

              return (
                <Box
                  key={r.key}
                  display="flex"
                  flexWrap="wrap"
                  alignItems="center"
                  gap={2}
                >
                  <Typography sx={{ minWidth: 220, fontWeight: 600 }}>
                    {t(r.labelKey, r.fallback)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("hr.commissions.watchGold", "Gold: {{val}} LYD/g", {
                      val: goldVal.toFixed(2),
                    })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("hr.commissions.watchDiamond", "Diamond: {{val}} %", {
                      val: diamondVal.toFixed(2),
                    })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("hr.commissions.watchWatch", "Watch: {{val}} %", {
                      val: watchVal.toFixed(2),
                    })}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Paper>

        {/* Employees & commission roles (read-only, similar to Payroll Admin Settings) */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
            {t(
              "hr.commissions.employeesTitle",
              "Employees & commission roles"
            )}
          </Typography>

          {employeesLoading && (
            <Box display="flex" alignItems="center" gap={1}>
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                {t(
                  "hr.commissions.employeesLoading",
                  "Loading employees..."
                )}
              </Typography>
            </Box>
          )}

          {employeesError && !employeesLoading && (
            <Alert severity="error">
              {t(
                "hr.commissions.employeesError",
                "Failed to load employees."
              )}
            </Alert>
          )}

          {!employeesLoading && !employeesError && (
            (() => {
              const withRole = employees.filter((e: Employee) => {
                let roleRaw =
                  e.commissionRole ||
                  e.sales_role ||
                  e.role ||
                  e.position ||
                  "";

                // Try to read commission role from JOB_DESCRIPTION JSON (EmployeeProfile stores it there)
                try {
                  if (!roleRaw && e.JOB_DESCRIPTION) {
                    const jd = JSON.parse(e.JOB_DESCRIPTION);
                    if (jd?.__commissions__?.role) {
                      roleRaw = jd.__commissions__.role;
                    }
                  }
                } catch {
                  // ignore bad JSON
                }

                const role = String(roleRaw || "").trim();
                return role !== "";
              });

              if (withRole.length === 0) {
                return (
                  <Typography variant="body2" color="text.secondary">
                    {t(
                      "hr.commissions.employeesEmpty",
                      "No employees with commission roles configured."
                    )}
                  </Typography>
                );
              }

              return (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: 1.5,
                  }}
                >
                  {withRole.map((e: Employee) => {
                    const name = getEmpDisplayName(e);

                    let roleRaw =
                      e.commissionRole ||
                      e.sales_role ||
                      e.role ||
                      e.position ||
                      "";

                    let psRaw: any = e.ps || e.PS || e.ps_scope || e.commissionPs || [];

                    try {
                      if (e.JOB_DESCRIPTION) {
                        const jd = JSON.parse(e.JOB_DESCRIPTION);
                        if (jd?.__commissions__?.role && !roleRaw) {
                          roleRaw = jd.__commissions__.role;
                        }
                        if (jd?.__commissions__?.ps && (!psRaw || psRaw.length === 0)) {
                          psRaw = jd.__commissions__.ps;
                        }
                      }
                    } catch {
                      // ignore
                    }

                    const role = String(roleRaw || "-").trim() || "-";
                    const psList = Array.isArray(psRaw)
                      ? psRaw
                      : psRaw != null
                      ? [psRaw]
                      : [];

                    return (
                      <Box
                        key={e.id || e.employee_id || e.id_employee}
                        sx={{
                          p: 1,
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 1,
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: 1,
                          }}
                        >
                          <Typography variant="subtitle2">
                            {name}  {role}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            {t("PS", "PS")}:
                            {psList.length
                              ? ` ${psList.join(", ")}`
                              : " -"}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              );
            })()
          )}
        </Paper>

        {/* Actions */}
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" onClick={resetDefaults}>
            {t("hr.commissions.resetDefaults", "Reset to defaults")}
          </Button>
          <Button variant="contained" onClick={save}>
            {t("hr.commissions.save", "Save")}
          </Button>
        </Stack>

        {/* Notes */}
        <Divider />
        <Typography variant="body2" color="text.secondary">
          {t("hr.commissions.notesTitle", "Notes:")}
          <br />
          •{" "}
          {t(
            "hr.commissions.noteRolePs",
            "Set each employee's role and PS scope in their profile (Compensation section)."
          )}
          <br />
          •{" "}
          {t(
            "hr.commissions.notePayslip",
            'Payslip PDF shows commission details in Earnings and in the "Missing Hours & Commission" table.'
          )}
          <br />
          •{" "}
          {t(
            "hr.commissions.noteWatchNotWired",
            "Watch commissions are currently front-end only and do not update anything in the database or payroll APIs."
          )}
        </Typography>
      </Stack>
    </>
  );
}
