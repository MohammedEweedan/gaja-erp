import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, TextField, InputAdornment, Autocomplete, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel, Alert } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import React from 'react';

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
}



// Helper to parse local formatted string to number
const parseNumber = (value: string) => {
  if (!value) return 0;
  // Remove commas, parse as float
  return parseFloat(value.replace(/,/g, '')) || 0;
};

const InvoiceTotalsDialog: React.FC<InvoiceTotalsDialogProps> = ({
  open, totals, isSaving, Type_Supplier, onChange, onClose, onUpdate, onPrint, SelectedInvoiceNum, Sm, customers, editInvoice, setEditInvoice, errors
}) => {
  // Add state for discount type (value or percentage)
  const [discountType, setDiscountType] = React.useState<'value' | 'percentage'>('value');
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [alertMsg, setAlertMsg] = React.useState('');

  // Validation handler for update
  const validateTotals = () => {
    const totalLyd = Number(totals.total_remise_final_lyd) || 0;
    const paidLyd = Number(totals.amount_lyd) || 0;
    const paidUsd = Number(totals.amount_currency) || 0;
    const paidUsdLyd = Number(totals.amount_currency_LYD) || 0;
    const paidEur = Number(totals.amount_EUR) || 0;
    const paidEurLyd = Number(totals.amount_EUR_LYD) || 0;
    const sumPaid = paidLyd + paidUsdLyd + paidEurLyd;
    const diff = totalLyd - sumPaid;
    const alertList: string[] = [];
    if (Math.abs(diff) > 0.01) {
      alertList.push(`Total Amount (LYD) must equal Amount Paid (LYD) + Equivalent Amount Paid (USD to LYD) + Equivalent Amount Paid (EUR to LYD). Difference: ${diff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }
    if (paidUsdLyd > 0 && paidUsd === 0) {
      alertList.push('If Equivalent Amount Paid (USD to LYD) > 0, Amount Paid (USD) must be greater than 0.');
    }
    if (paidEurLyd > 0 && paidEur === 0) {
      alertList.push('If Equivalent Amount Paid (EUR to LYD) > 0, Amount Paid (EUR) must be greater than 0.');
    }
    if (Type_Supplier.toLowerCase().includes('gold')) {
      if (Math.abs(Number(totals.total_remise_final_lyd) - Number(totals.total_remise_final)) > 0.01) {
        alertList.push(`For gold type, Total Amount (LYD) must equal Total Amount (USD). Difference: ${(Number(totals.total_remise_final_lyd) - Number(totals.total_remise_final)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      }
    }
    if (Number(totals.total_remise_final_lyd) === 0) {
      alertList.push('Total Amount (LYD) is required and cannot be zero.');
    }
    if (alertList.length > 0) {
      setAlertMsg(alertList.map((msg, idx) => `• ${msg}`).join('\n'));
      setAlertOpen(true);
      return false;
    }
    setAlertOpen(false);
    setAlertMsg('');
    return true;
  };

  // Validate on any relevant change
  React.useEffect(() => {
    validateTotals();
    // eslint-disable-next-line
  }, [totals.total_remise_final_lyd, totals.amount_lyd, totals.amount_currency_LYD, totals.amount_EUR_LYD]);

  const handleUpdate = () => {
    if (!validateTotals()) return;
    onUpdate();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { minWidth: 800 } }}>
      <DialogTitle>
        Complete Invoice Details
        {SelectedInvoiceNum !== undefined && (
          <span style={{ fontWeight: 400, fontSize: 16, marginLeft: 12, color: 'var(--mui-palette-text-secondary)' }}>
            (Invoice #{SelectedInvoiceNum})
          </span>
        )}
      </DialogTitle>
      <DialogContent>
        {/* Alert or Verified Icon on top of dialog */}
        {alertOpen ? (
          <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-line' }} onClose={() => setAlertOpen(false)}>
            {alertMsg}
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, color: 'success.main', fontWeight: 500 }}>
            <CheckCircleIcon sx={{ mr: 1, color: 'success.main' }} />
            All totals and payments are verified.
          </Box>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          {/* Row 1: Invoice Type, Customer, Source Marketing */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              select
              label="Invoice Type"
              value={(() => {
                if (editInvoice.is_chira === 1) return 'is_chira';
                if (editInvoice.IS_WHOLE_SALE === 1) return 'IS_WHOLE_SALE';
                return 'invoice';
              })()}
              onChange={e => {
                const val = e.target.value;
                setEditInvoice((prev: any) => ({
                  ...prev,
                  is_chira: val === 'is_chira' ? 1 : 0,
                  IS_WHOLE_SALE: val === 'IS_WHOLE_SALE' ? 1 : 0
                }));
              }}
              fullWidth
               size="small"
              sx={{ minWidth: 180, maxWidth: 220 }}
              SelectProps={{ native: true }}

            >
              <option value="invoice">Invoice</option>
              <option value="is_chira">Is Chira</option>
              <option value="IS_WHOLE_SALE">Is Whole Sale</option>
            </TextField>
            <Autocomplete
              id="customer-select"
              sx={{ width: 350, flexGrow: 2 }}
              options={customers}
              autoHighlight
              getOptionLabel={(option: Client) => `${option.client_name} (${option.tel_client || 'No Phone'})`}
              value={
                editInvoice.Client ||
                customers.find((s: Client) => s.id_client === editInvoice.client) ||
                null
              }
              onChange={(event: any, newValue: Client | null) => {
                setEditInvoice((prev: any) => ({
                  ...prev,
                  client: newValue?.id_client ?? 0,
                  Client: newValue || undefined
                }));
              }}
              renderOption={(props: any, option: Client) => (
                <Box component="li" {...props} key={option.id_client}>
                  <strong>{option.client_name}</strong> — <span style={{ color: 'var(--mui-palette-text-secondary)' }}>{option.tel_client || 'No Phone'}</span>
                </Box>
              )}
              renderInput={(params: any) => (
                <TextField
                  {...params}
                  label="Customer"
                  error={!!errors.client}
                  helperText={errors.client}
                  required
                  size="small"
                />
              )}
            />
            <Autocomplete
              id="MS-select"
              sx={{ width: 220, flexShrink: 1 }}
              options={Sm}
              autoHighlight
              getOptionLabel={(option: Sm) => `${option.SourceMarketing}`}
              value={
                Sm.find((s: Sm) => s.SourceMarketing === editInvoice.SourceMark) || null
              }
              onChange={(event: any, newValue: Sm | null) => {
                setEditInvoice((prev: any) => ({
                  ...prev,
                  SourceMark: newValue?.SourceMarketing ?? '',
                  Sm: newValue || undefined
                }));
              }}
              renderOption={(props: any, option: Sm) => (
                <Box component="li" {...props} key={option.SourceMarketing}>
                  <strong>{option.SourceMarketing}</strong>
                </Box>
              )}
              renderInput={(params: any) => (
                <TextField
                  {...params}
                  label="Source Marketing"
                  error={!!errors.client}
                  helperText={errors.client}
                  required
                  size="small"
                />
              )}
            />
          </Box>
          {/* Info Row: Invoice type and currency note */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, color: 'text.secondary', fontWeight: 500, fontSize: 15 }}>
            <span>
              Type: {Type_Supplier} &nbsp;|&nbsp;
              Currency: {Type_Supplier.toLowerCase().includes('gold') ? 'LYD' : 'USD'}
            </span>
            {/* Ex. rate calculation and display */}
            {(() => {
              const sumLYD = Number(totals.amount_lyd) + Number(totals.amount_currency_LYD) + Number(totals.amount_EUR_LYD);
              const totalUSD = Number(totals.total_remise_final);
              const exRate = sumLYD / totalUSD;
              return (
                <Box sx={{ ml: 2, fontWeight: 'bold', color: 'inherit', minWidth: 120 }}>
                  Ex. rate = {exRate.toLocaleString('en-LY', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </Box>
              );
            })()}
          </Box>

          {/* Row 2: Total Amount (LYD) and Final Total After Discount (USD) in same row */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end', mb: 2 }}>
            
            {/* Final Total After Discount (USD) */}
            <Box sx={{ flex: '1 1 260px', minWidth: 220 }}>
              <TextField
                label="Total Amount (USD)"
                type="text"
                fullWidth
                size="small"
                value={  Number(totals.total_remise_final) }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">USD</InputAdornment>
                  ),
                  readOnly: true
                }}
                disabled
              />
            </Box>
          </Box>
          {/* Row 3: Discount Type & Value/Percentage in same row */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end', mb: 2 }}>
            {/* Discount Type Selector */}
            <FormControl component="fieldset" sx={{ flex: '1 1 180px', minWidth: 180 }}>
              <FormLabel component="legend" sx={{ fontSize: 14, mb: 0.5 }}>Discount Type</FormLabel>
              <RadioGroup
                row
                value={discountType}
                onChange={e => setDiscountType(e.target.value as 'value' | 'percentage')}
                sx={{ gap: 1 }}
              >
                <FormControlLabel value="value" control={<Radio size="small" />} label="By Value" />
                <FormControlLabel value="percentage" control={<Radio size="small" />} label="By %" />
              </RadioGroup>
            </FormControl>

            {/* Discount Value/Percentage */}
            <Box sx={{ flex: '1 1 180px', minWidth: 180 }}>
              {discountType === 'value' ? (
                <TextField
                  label="Discount Value"
                  type="number"
                  fullWidth
                  size="small"
                  value={totals.remise}
                  onChange={e => {
                    const value = parseNumber(e.target.value);
                    onChange('remise', value);
                    if (value > 0) onChange('remise_per', 0); // Reset percentage if value entered
                  }}
                  InputProps={{ startAdornment: <InputAdornment position="start">{Type_Supplier.toLowerCase().includes('gold') ? 'LYD' : 'USD'}</InputAdornment> }}
                />
              ) : (
                <TextField
                  label="Discount Percentage"
                  type="number"
                  fullWidth
                  size="small"
                  value={totals.remise_per}
                  onChange={e => {
                    const value = parseNumber(e.target.value);
                    onChange('remise_per', value);
                    if (value > 0) onChange('remise', 0); // Reset value if percentage entered
                  }}
                  InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                />
              )}
            </Box>
          </Box>
          {/* Row 4: Final Total After Discount in its own row */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end', mb: 2 }}>
            <Box sx={{ flex: '1 1 260px', minWidth: 220 }}>
              <TextField
                label={`Final Total After Discount (${Type_Supplier.toLowerCase().includes('gold') ? 'LYD' : 'USD'})`}
                type="text"
                fullWidth
                size="small"
                value={(() => {
                  const total = Number(totals.total_remise_final) || 0;
                  if (discountType === 'value') {
                    return (total - (Number(totals.remise) || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  } else {
                    return (total - total * ((Number(totals.remise_per) || 0) / 100)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  }
                })()}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">{Type_Supplier.toLowerCase().includes('gold') ? 'LYD' : 'USD'}</InputAdornment>
                  ),
                  readOnly: true
                }}
                disabled
              />
            </Box>

            {/* Total Amount (LYD) */}
            <Box sx={{ flex: '1 1 260px', minWidth: 220 }}>
              <TextField
                label="Total Amount (LYD)"
                type="text"
                fullWidth
                size="small"
                onChange={e => {
                  onChange('total_remise_final_lyd', parseNumber(e.target.value));
                  validateTotals();
                }}
                value={totals.total_remise_final_lyd}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">LYD</InputAdornment>
                  ),
                  inputProps: { inputMode: 'decimal', pattern: '[0-9.,]*' },
                }}
                disabled={Type_Supplier.toLowerCase().includes('gold')}
              />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', my: 1 }}>
            <Box sx={{ borderBottom: '1px solid #e0e0e0', flex: 1 }} />
            <Box sx={{ mx: 2, color: 'text.secondary', fontWeight: 500 }}>Payment Methods</Box>
            <Box sx={{ borderBottom: '1px solid #e0e0e0', flex: 1 }} />
          </Box>
          {/* Row 3: Amount Paid (LYD) */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
            <TextField
              label="Amount Paid (LYD)"
              type="text"
              sx={{ width: '40%' }}
              size="small"
              value={totals.amount_lyd}
              onChange={e => {
                onChange('amount_lyd', parseNumber(e.target.value));
                validateTotals();
              }}
              InputProps={{ startAdornment: <InputAdornment position="start">LYD</InputAdornment> }}
            />
          </Box>
          {/* Row 4: Amount Paid (USD) & Equivalent Amount Paid (USD to LYD) */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Amount Paid (USD)"
              type="text"
              fullWidth
              size="small"
              value={totals.amount_currency}
              onChange={e => {
                onChange('amount_currency', parseNumber(e.target.value));
                validateTotals();
              }}
              InputProps={{ startAdornment: <InputAdornment position="start">USD</InputAdornment> }}
            />
            <TextField
              label="Equivalent Amount Paid (USD to LYD)"
              type="text"
              fullWidth
              size="small"
              value={totals.amount_currency_LYD}
              onChange={e => {
                onChange('amount_currency_LYD', parseNumber(e.target.value));
                validateTotals();
              }}
              InputProps={{ startAdornment: <InputAdornment position="start">LYD</InputAdornment> }}
            />
            {/* Ex. rate for USD to LYD */}
            {(() => {
              const usdToLyd = Number(totals.amount_currency_LYD);
              const usd = Number(totals.amount_currency);
              const exRate = usdToLyd / usd;
              return (
                <Box sx={{ ml: 2, fontWeight: 'bold', color: 'text.secondary', minWidth: 120 }}>
                  Ex. rate = {exRate.toLocaleString('en-LY', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </Box>
              );
            })()}
          </Box>
          {/* Row 5: Amount Paid (EUR) & Equivalent Amount Paid (EUR to LYD) */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              label="Amount Paid (EUR)"
              type="text"
              fullWidth
              size="small"
              value={totals.amount_EUR}
              onChange={e => {
                onChange('amount_EUR', parseNumber(e.target.value));
                validateTotals();
              }}
              InputProps={{ startAdornment: <InputAdornment position="start">EUR</InputAdornment> }}
            />
            <TextField
              label="Equivalent Amount Paid (EUR to LYD)"
              type="text"
              fullWidth
              size="small"
              value={totals.amount_EUR_LYD}
              onChange={e => {
                onChange('amount_EUR_LYD', parseNumber(e.target.value));
                validateTotals();
              }}
              InputProps={{ startAdornment: <InputAdornment position="start">LYD</InputAdornment> }}
            />
            {/* Ex. rate for EUR to LYD */}
            {(() => {
              const eurToLyd = Number(totals.amount_EUR_LYD);
              const eur = Number(totals.amount_EUR);
              const exRate = eurToLyd / eur;
              return (
                <Box sx={{ ml: 2, fontWeight: 'bold', color: 'text.secondary', minWidth: 120 }}>
                  Ex. rate = {exRate.toLocaleString('en-LY', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </Box>
              );
            })()}
          </Box>

        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleUpdate} variant="contained" color="primary" disabled={isSaving}>
          Update
        </Button>
        {onPrint && (
          <Button onClick={onPrint} variant="outlined" color="secondary" disabled={isSaving}>
            Print Invoice
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default InvoiceTotalsDialog;
