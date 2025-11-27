import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  InputAdornment,
  Autocomplete,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Alert,
  IconButton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import React from "react";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import axios from "../../../api";

interface Client {
  id_client: number;
  client_name: string;
  tel_client: string;
}

interface Sm {
  id_SourceMark: number;
  SourceMarketing: string;
  Status: boolean;
}

interface InvoiceTotalsDialogProps {
  Type_Supplier: string;
  open: boolean;
  totals: {
    total_remise_final: number;
    total_remise_final_lyd: number; // Added for LYD total
    amount_currency: number;
    amount_lyd: number;
    amount_EUR: number;
    amount_currency_LYD: number;
    amount_EUR_LYD: number;
    remise: number; // Discount Value
    remise_per: number; // Discount percentage
  };
  isSaving: boolean;
  onChange: (field: string, value: number) => void;
  onClose: () => void;
  onUpdate: () => void;
  onPrint?: () => void;
  SelectedInvoiceNum?: number;
  Sm: Sm[];
  customers: Client[];
  editInvoice: any;
  setEditInvoice: (fn: (prev: any) => any) => void;
  errors: { client: string };
  onCustomerCreated?: (client: Client) => void;
}

// Helper to parse local formatted string to number
const parseNumber = (value: string) => {
  if (!value) return 0;
  // Remove commas, parse as float
  return parseFloat(value.replace(/,/g, "")) || 0;
};

const InvoiceTotalsDialog: React.FC<InvoiceTotalsDialogProps> = ({
  open,
  totals,
  isSaving,
  Type_Supplier,
  onChange,
  onClose,
  onUpdate,
  onPrint,
  SelectedInvoiceNum,
  Sm,
  customers,
  editInvoice,
  setEditInvoice,
  errors,
  onCustomerCreated,
}) => {
  // Add state for discount type (value or percentage)
  const [discountType, setDiscountType] = React.useState<
    "value" | "percentage"
  >("value");
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [alertMsg, setAlertMsg] = React.useState("");
  const [addCustomerOpen, setAddCustomerOpen] = React.useState(false);
  const [newCustomerName, setNewCustomerName] = React.useState("");
  const [newCustomerPhone, setNewCustomerPhone] = React.useState("");
  const [creatingCustomer, setCreatingCustomer] = React.useState(false);
  // Editable exchange rates (USD/EUR -> LYD)
  const [usdRate, setUsdRate] = React.useState<number>(0);
  const [eurRate, setEurRate] = React.useState<number>(0);
  const [stepIndex, setStepIndex] = React.useState<number>(0);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    // eslint-disable-next-line
  }, [stepIndex]);

  // Validation handler for update
  const validateTotals = () => {
    const totalLyd = Number(totals.total_remise_final_lyd) || 0;
    const paidLyd = Number(totals.amount_lyd) || 0;
    const paidUsdLyd = Number(totals.amount_currency_LYD) || 0;
    const paidEurLyd = Number(totals.amount_EUR_LYD) || 0;
    const sumPaid = paidLyd + paidUsdLyd + paidEurLyd;
    const diff = totalLyd - sumPaid;
    const alertList: string[] = [];
    const errors: Record<string, string> = {};
    if (Number(totalLyd) === 0) {
      alertList.push("Total Amount (LYD) is required and cannot be zero.");
      errors.total_remise_final_lyd = "Required";
    }
    if (Math.abs(diff) > 0.01) {
      const diffMsg = `Difference: ${diff.toLocaleString("en-LY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      alertList.push(`Total (LYD) must equal Amount Paid (LYD) + USD/EUR equivalents (to LYD). ${diffMsg}`);
      // Mark payment fields to guide user
      errors.amount_lyd = diffMsg;
      errors.amount_currency = diffMsg;
      errors.amount_currency_LYD = diffMsg;
      errors.amount_EUR = diffMsg;
      errors.amount_EUR_LYD = diffMsg;
    }
    if (alertList.length > 0) {
      setAlertMsg(alertList.map((msg) => `• ${msg}`).join("\n"));
      setAlertOpen(true);
      setFieldErrors(errors);
      return false;
    }
    setAlertOpen(false);
    setAlertMsg("");
    setFieldErrors({});
    return true;
  };

  // Validate on any relevant change
  React.useEffect(() => {
    validateTotals();
    // Initialize default exchange rates if possible
    if ((Number(totals.amount_currency) || 0) > 0 && (Number(totals.amount_currency_LYD) || 0) > 0) {
      const r = Number(totals.amount_currency_LYD) / Number(totals.amount_currency || 1);
      if (isFinite(r)) setUsdRate(Number(r.toFixed(3)));
    } else if ((Number(totals.total_remise_final) || 0) > 0 && (Number(totals.total_remise_final_lyd) || 0) > 0) {
      const r = Number(totals.total_remise_final_lyd) / Number(totals.total_remise_final || 1);
      if (isFinite(r)) setUsdRate(Number(r.toFixed(3)));
    }
    if ((Number(totals.amount_EUR) || 0) > 0 && (Number(totals.amount_EUR_LYD) || 0) > 0) {
      const r = Number(totals.amount_EUR_LYD) / Number(totals.amount_EUR || 1);
      if (isFinite(r)) setEurRate(Number(r.toFixed(3)));
    } else if ((Number(totals.total_remise_final) || 0) > 0 && (Number(totals.total_remise_final_lyd) || 0) > 0) {
      const r = Number(totals.total_remise_final_lyd) / Number(totals.total_remise_final || 1);
      if (isFinite(r)) setEurRate(Number(r.toFixed(3)));
    }
    // eslint-disable-next-line
  }, [
    totals.total_remise_final_lyd,
    totals.amount_lyd,
    totals.amount_currency_LYD,
    totals.amount_EUR_LYD,
    totals.amount_currency,
    totals.amount_EUR,
    totals.total_remise_final,
  ]);

  const handleUpdate = () => {
    if (!validateTotals()) return;
    onUpdate();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { minWidth: 820, height: "64vh", display: "flex", flexDirection: "column" } }}
    >
      <DialogTitle sx={{ px: 2, py: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {stepIndex > 0 && (
              <IconButton onClick={() => setStepIndex(stepIndex - 1)} size="small">
                <ArrowBackIosNewIcon fontSize="small" />
              </IconButton>
            )}
            <span>Checkout</span>
            {SelectedInvoiceNum !== undefined && (
              <span
                style={{
                  fontWeight: 400,
                  fontSize: 16,
                  marginLeft: 12,
                  color: "var(--mui-palette-text-secondary)",
                }}
              >
                (Invoice #{SelectedInvoiceNum})
              </span>
            )}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {stepIndex < 2 && (
              <IconButton onClick={() => setStepIndex(stepIndex + 1)} size="small" aria-label="next-step">
                <ArrowForwardIosIcon fontSize="small" />
              </IconButton>
            )}
            <IconButton onClick={onClose} aria-label="close-dialog">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ flex: 1, display: "flex", gap: 0.5, overflow: "hidden", pt: 0.25 }}>
        <Box ref={contentRef} sx={{ flex: 1, overflowY: "auto", pr: 1, scrollBehavior: "smooth" }}>
          {!alertOpen && (
            <Box sx={{ display: "flex", alignItems: "center", mb: 1, color: "success.main", fontWeight: 500 }}>
              <CheckCircleIcon sx={{ mr: 1, color: "success.main" }} />
              All totals and payments are verified.
            </Box>
          )}
          {stepIndex === 0 && (
            <>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2 }}>
                {/* Invoice Type (full width) */}
                <TextField
                  select
                  fullWidth
                  label="Invoice Type"
                  value={(() => {
                    if (editInvoice.is_chira === 1) return "is_chira";
                    if (editInvoice.IS_WHOLE_SALE === 1) return "IS_WHOLE_SALE";
                    return "invoice";
                  })()}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditInvoice((prev: any) => ({
                      ...prev,
                      is_chira: val === "is_chira" ? 1 : 0,
                      IS_WHOLE_SALE: val === "IS_WHOLE_SALE" ? 1 : 0,
                    }));
                  }}
                  size="small"
                  SelectProps={{ native: true }}
                >
                  <option value="invoice">Invoice</option>
                  <option value="is_chira">Chira</option>
                  <option value="IS_WHOLE_SALE">Whole Sale</option>
                </TextField>
                {/* Customer (full width) + create button */}
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <Autocomplete
                    id="customer-select"
                    sx={{ flex: 1 }}
                    options={customers}
                    autoHighlight
                    getOptionLabel={(option: Client) => `${option.client_name} (${option.tel_client || "No Phone"})`}
                    value={
                      editInvoice.Client ||
                      customers.find((s: Client) => s.id_client === editInvoice.client) ||
                      null
                    }
                    onChange={(event: any, newValue: Client | null) => {
                      setEditInvoice((prev: any) => ({
                        ...prev,
                        client: newValue?.id_client ?? 0,
                        Client: newValue || undefined,
                      }));
                    }}
                    renderOption={(props: any, option: Client) => (
                      <Box component="li" {...props} key={option.id_client}>
                        <strong>{option.client_name}</strong> — {" "}
                        <span style={{ color: "var(--mui-palette-text-secondary)" }}>{option.tel_client || "No Phone"}</span>
                      </Box>
                    )}
                    renderInput={(params: any) => (
                      <TextField {...params} label="Customer" error={!!errors.client} helperText={errors.client} required size="small" fullWidth />
                    )}
                  />
                  <IconButton onClick={() => setAddCustomerOpen(true)}>
                    <AddIcon />
                  </IconButton>
                </Box>

                {/* Source Marketing (full width) */}
                <Autocomplete
                  id="MS-select"
                  sx={{ width: "100%" }}
                  options={Sm}
                  autoHighlight
                  getOptionLabel={(option: Sm) => `${option.SourceMarketing}`}
                  value={Sm.find((s: Sm) => s.SourceMarketing === editInvoice.SourceMark) || null}
                  onChange={(event: any, newValue: Sm | null) => {
                    setEditInvoice((prev: any) => ({
                      ...prev,
                      SourceMark: newValue?.SourceMarketing ?? "",
                      Sm: newValue || undefined,
                    }));
                  }}
                  renderOption={(props: any, option: Sm) => (
                    <Box component="li" {...props} key={option.SourceMarketing}>
                      <strong>{option.SourceMarketing}</strong>
                    </Box>
                  )}
                  renderInput={(params: any) => (
                    <TextField {...params} label="Source Marketing" error={!!errors.client} helperText={errors.client} required size="small" fullWidth />
                  )}
                />
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", mt: 2, mb: 1, color: "text.secondary", fontWeight: 500, fontSize: 15 }}>
                <span>
                  Type: {Type_Supplier} &nbsp;|&nbsp; Currency: {Type_Supplier.toLowerCase().includes("gold") ? "LYD" : "USD"}
                </span>
              </Box>
            </>
          )}
          {stepIndex === 1 && (
            <>
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-end", mb: 2 }}>
                <FormControl component="fieldset" sx={{ flex: "1 1 180px", minWidth: 180 }}>
                  <FormLabel component="legend" sx={{ fontSize: 14, mb: 0.5 }}>Discount Type</FormLabel>
                  <RadioGroup row value={discountType} onChange={(e) => setDiscountType(e.target.value as "value" | "percentage")} sx={{ gap: 1 }}>
                    <FormControlLabel value="value" control={<Radio size="small" />} label="By Value" />
                    <FormControlLabel value="percentage" control={<Radio size="small" />} label="By %" />
                  </RadioGroup>
                </FormControl>
                <Box sx={{ flex: "1 1 180px", minWidth: 180 }}>
                  {discountType === "value" ? (
                    <TextField
                      label="Discount Value"
                      type="number"
                      fullWidth
                      size="small"
                      value={totals.remise}
                      onChange={(e) => {
                        const value = parseNumber(e.target.value);
                        onChange("remise", value);
                        if (value > 0) onChange("remise_per", 0);
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">{Type_Supplier.toLowerCase().includes("gold") ? "LYD" : "USD"}</InputAdornment>
                        ),
                      }}
                    />
                  ) : (
                    <TextField
                      label="Discount Percentage"
                      type="number"
                      fullWidth
                      size="small"
                      value={totals.remise_per}
                      onChange={(e) => {
                        const value = parseNumber(e.target.value);
                        onChange("remise_per", value);
                        if (value > 0) onChange("remise", 0);
                      }}
                      InputProps={{ endAdornment: (<InputAdornment position="end">%</InputAdornment>) }}
                    />
                  )}
                </Box>
              </Box>
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-end", mb: 2 }}>
                <Box sx={{ flex: "1 1 260px", minWidth: 220 }}>
                  <TextField
                    label={`Final Total After Discount (${Type_Supplier.toLowerCase().includes("gold") ? "LYD" : "USD"})`}
                    type="text"
                    fullWidth
                    size="small"
                    value={(() => {
                      const total = Type_Supplier.toLowerCase().includes("gold") ? Number(totals.total_remise_final_lyd) || 0 : Number(totals.total_remise_final) || 0;
                      if (discountType === "value") {
                        return (total - (Number(totals.remise) || 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      } else {
                        return (total - total * ((Number(totals.remise_per) || 0) / 100)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      }
                    })()}
                    InputProps={{ startAdornment: (<InputAdornment position="start">{Type_Supplier.toLowerCase().includes("gold") ? "LYD" : "USD"}</InputAdornment>), readOnly: true }}
                    disabled
                  />
                </Box>
                <Box sx={{ flex: "1 1 260px", minWidth: 220 }}>
                  <TextField
                    label="Total Amount (LYD)"
                    type="text"
                    fullWidth
                    size="small"
                    onChange={(e) => {
                      onChange("total_remise_final_lyd", parseNumber(e.target.value));
                      validateTotals();
                    }}
                    value={totals.total_remise_final_lyd}
                    InputProps={{ startAdornment: (<InputAdornment position="start">LYD</InputAdornment>), inputProps: { inputMode: "decimal", pattern: "[0-9.,]*" } }}
                    disabled={Type_Supplier.toLowerCase().includes("gold")}
                    error={Boolean(fieldErrors.total_remise_final_lyd)}
                    helperText={fieldErrors.total_remise_final_lyd}
                  />
                </Box>
              </Box>
            </>
          )}
          {stepIndex === 2 && (
            <>
              <Box sx={{ display: "flex", alignItems: "center", my: 1 }}>
                <Box sx={{ borderBottom: "1px solid #e0e0e0", flex: 1 }} />
                <Box sx={{ mx: 2, color: "text.secondary", fontWeight: 500 }}>Payment Methods</Box>
                <Box sx={{ borderBottom: "1px solid #e0e0e0", flex: 1 }} />
              </Box>
              <Box sx={{ display: "flex", justifyContent: "flex-start", mt: 1.5 }}>
                <TextField
                  label="Amount Paid (LYD)"
                  type="text"
                  sx={{ width: 240 }}
                  size="small"
                  value={totals.amount_lyd}
                  onChange={(e) => {
                    onChange("amount_lyd", parseNumber(e.target.value));
                    validateTotals();
                  }}
                  InputProps={{ startAdornment: (<InputAdornment position="start">LYD</InputAdornment>) }}
                  error={Boolean(fieldErrors.amount_lyd)}
                  helperText={fieldErrors.amount_lyd}
                />
              </Box>
              <Box sx={{ display: "flex", gap: 2, mt: 1.5 }}>
                <TextField
                  label="Amount Paid (USD)"
                  type="text"
                  sx={{ width: 240 }}
                  size="small"
                  value={totals.amount_currency}
                  onChange={(e) => {
                    const v = parseNumber(e.target.value);
                    onChange("amount_currency", v);
                    const ex = Number(usdRate) || 0;
                    onChange("amount_currency_LYD", Number((v * ex).toFixed(3)));
                    validateTotals();
                  }}
                  InputProps={{ startAdornment: (<InputAdornment position="start">USD</InputAdornment>) }}
                  error={Boolean(fieldErrors.amount_currency)}
                  helperText={fieldErrors.amount_currency}
                />
                <TextField
                  label="Equivalent Amount Paid (USD to LYD)"
                  type="text"
                  sx={{ width: 240 }}
                  size="small"
                  value={totals.amount_currency_LYD}
                  onChange={(e) => {
                    const v = parseNumber(e.target.value);
                    onChange("amount_currency_LYD", v);
                    const ex = Number(usdRate) || 0;
                    if (ex > 0) {
                      onChange("amount_currency", Number((v / ex).toFixed(3)));
                    }
                    validateTotals();
                  }}
                  InputProps={{ startAdornment: (<InputAdornment position="start">LYD</InputAdornment>) }}
                  error={Boolean(fieldErrors.amount_currency_LYD)}
                  helperText={fieldErrors.amount_currency_LYD}
                />
                <TextField
                  label="USD→LYD rate"
                  type="number"
                  sx={{ width: 160 }}
                  size="small"
                  value={usdRate}
                  onChange={(e) => {
                    const r = parseNumber(e.target.value);
                    setUsdRate(r);
                    const v = Number(totals.amount_currency) || 0;
                    onChange("amount_currency_LYD", Number((v * r).toFixed(3)));
                    validateTotals();
                  }}
                  InputProps={{ startAdornment: (<InputAdornment position="start">LYD</InputAdornment>) }}
                />
              </Box>
              <Box sx={{ display: "flex", gap: 2, alignItems: "center", mt: 1.5 }}>
                <TextField
                  label="Amount Paid (EUR)"
                  type="text"
                  sx={{ width: 240 }}
                  size="small"
                  value={totals.amount_EUR}
                  onChange={(e) => {
                    const v = parseNumber(e.target.value);
                    onChange("amount_EUR", v);
                    const ex = Number(eurRate) || 0;
                    onChange("amount_EUR_LYD", Number((v * ex).toFixed(3)));
                    validateTotals();
                  }}
                  InputProps={{ startAdornment: (<InputAdornment position="start">EUR</InputAdornment>) }}
                  error={Boolean(fieldErrors.amount_EUR)}
                  helperText={fieldErrors.amount_EUR}
                />
                <TextField
                  label="Equivalent Amount Paid (EUR to LYD)"
                  type="text"
                  sx={{ width: 240 }}
                  size="small"
                  value={totals.amount_EUR_LYD}
                  onChange={(e) => {
                    const v = parseNumber(e.target.value);
                    onChange("amount_EUR_LYD", v);
                    const ex = Number(eurRate) || 0;
                    if (ex > 0) {
                      onChange("amount_EUR", Number((v / ex).toFixed(3)));
                    }
                    validateTotals();
                  }}
                  InputProps={{ startAdornment: (<InputAdornment position="start">LYD</InputAdornment>) }}
                  error={Boolean(fieldErrors.amount_EUR_LYD)}
                  helperText={fieldErrors.amount_EUR_LYD}
                />
                <TextField
                  label="EUR→LYD rate"
                  type="number"
                  sx={{ width: 160 }}
                  size="small"
                  value={eurRate}
                  onChange={(e) => {
                    const r = parseNumber(e.target.value);
                    setEurRate(r);
                    const v = Number(totals.amount_EUR) || 0;
                    onChange("amount_EUR_LYD", Number((v * r).toFixed(3)));
                    validateTotals();
                  }}
                  InputProps={{ startAdornment: (<InputAdornment position="start">LYD</InputAdornment>) }}
                />
              </Box>
            </>
          )}
          <Box sx={{ position: "sticky", bottom: 0, pt: 0.75, mt: 1, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, bgcolor: "background.paper", borderTop: "1px solid", borderColor: "divider" }}>
            <Box>
              {stepIndex > 0 && (
                <Button variant="text" startIcon={<ArrowBackIosNewIcon />} onClick={() => setStepIndex(stepIndex - 1)}>
                  Back
                </Button>
              )}
            </Box>
            <Box>
              {stepIndex < 2 ? (
                <Button variant="contained" endIcon={<ArrowForwardIosIcon />} onClick={() => setStepIndex(stepIndex + 1)}>
                  Next
                </Button>
              ) : (
                <Button onClick={handleUpdate} variant="contained" color="primary" startIcon={<CheckCircleIcon />} disabled={isSaving || alertOpen}>
                  Confirm Checkout
                </Button>
              )}
            </Box>
          </Box>
        </Box>
        <Box sx={{ width: 260, flexShrink: 0, alignSelf: "stretch", borderLeft: "1px solid", borderColor: "divider", p: 1, bgcolor: "background.paper", position: "sticky", top: 0, maxHeight: "calc(64vh - 56px)", overflowY: "auto" }}>
          {(() => {
            const isGold = Type_Supplier.toLowerCase().includes("gold");
            const baseTotal = isGold ? Number(totals.total_remise_final_lyd) || 0 : Number(totals.total_remise_final) || 0;
            const discountValBase = discountType === "value" ? (Number(totals.remise) || 0) : baseTotal * ((Number(totals.remise_per) || 0) / 100);
            const finalBase = Math.max(baseTotal - discountValBase, 0);
            const totalLYD = Number(totals.total_remise_final_lyd) || 0;
            const discountValLYD = discountType === "value" ? ((Number(totals.remise) || 0) * (isGold ? 1 : (Number(usdRate) || 0))) : totalLYD * ((Number(totals.remise_per) || 0) / 100);
            const finalLYD = Math.max(totalLYD - discountValLYD, 0);
            const paidLYD = (Number(totals.amount_lyd) || 0) + (Number(totals.amount_currency_LYD) || 0) + (Number(totals.amount_EUR_LYD) || 0);
            const remainingLYD = finalLYD - paidLYD;
            const fmt = (v: number, cur: "USD" | "LYD") => (cur === "USD" ? v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v.toLocaleString("en-LY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
            return (
              <>
                <Box sx={{ fontWeight: 700, mb: 1, color: "#b7a27d" }}>Price breakdown</Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <span>{isGold ? "Subtotal (LYD)" : "Subtotal (USD)"}</span>
                  <span>{fmt(baseTotal, isGold ? "LYD" : "USD")}</span>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <span>Discount{discountType === "percentage" ? ` (${Number(totals.remise_per) || 0}%)` : ""}</span>
                  <span style={{ color: "#d32f2f", fontWeight: 700 }}>− {fmt(isGold ? discountValLYD : discountValBase, isGold ? "LYD" : "USD")}</span>
                </Box>
                {!isGold && (
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <span>Final (USD)</span>
                    <span style={{ color: "#68a5bf", fontWeight: 700 }}>{fmt(finalBase, "USD")}</span>
                  </Box>
                )}
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <span>Final (LYD)</span>
                  <span style={{ color: "#68a5bf", fontWeight: 700 }}>{fmt(finalLYD, "LYD")}</span>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <span>Paid (LYD equiv.)</span>
                  <span>{fmt(paidLYD, "LYD")}</span>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                  <span>Remaining (LYD)</span>
                  <span>{fmt(remainingLYD, "LYD")}</span>
                </Box>
              </>
            );
          })()}
        </Box>
      </DialogContent>
      <Dialog open={addCustomerOpen} onClose={() => setAddCustomerOpen(false)}>
        <DialogTitle>Add Customer</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              size="small"
              fullWidth
            />
            <TextField
              label="Phone"
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              size="small"
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddCustomerOpen(false)} disabled={creatingCustomer}>Cancel</Button>
          <Button
            onClick={async () => {
              if (!newCustomerName || !newCustomerPhone) return;
              try {
                setCreatingCustomer(true);
                const token = localStorage.getItem("token");
                await axios.post(`/customers/Add`, { client_name: newCustomerName, tel_client: newCustomerPhone }, { headers: { Authorization: `Bearer ${token}` } });
                setAddCustomerOpen(false);
                setNewCustomerName("");
                setNewCustomerPhone("");
                if (typeof onCustomerCreated === "function") {
                  onCustomerCreated({ id_client: 0, client_name: newCustomerName, tel_client: newCustomerPhone });
                }
              } finally {
                setCreatingCustomer(false);
              }
            }}
            variant="contained"
            disabled={creatingCustomer}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default InvoiceTotalsDialog;