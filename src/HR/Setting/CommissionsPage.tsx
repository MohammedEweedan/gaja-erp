// src/HR/Compensation/CommissionsPage.tsx
import React from 'react';
import { Box, Paper, Stack, Typography, TextField, Button, Divider, Alert } from '@mui/material';

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
};

type Rates = {
  gold: Record<string, number>;
  diamond: Record<string, number>;
};

function loadSettings(): Rates {
  try {
    const raw = localStorage.getItem('commissionSettingsV1');
    if (!raw) return DEFAULTS as Rates;
    const js = JSON.parse(raw);
    return {
      gold: { ...DEFAULTS.gold, ...(js?.gold || {}) },
      diamond: { ...DEFAULTS.diamond, ...(js?.diamond || {}) },
    } as Rates;
  } catch {
    return DEFAULTS as Rates;
  }
}

export default function CommissionsPage() {
  const [rates, setRates] = React.useState<Rates>(() => loadSettings());
  const [saved, setSaved] = React.useState<string | null>(null);

  const setGold = (k: string, v: number) => setRates(prev => ({ ...prev, gold: { ...prev.gold, [k]: v } }));
  const setDiamond = (k: string, v: number) => setRates(prev => ({ ...prev, diamond: { ...prev.diamond, [k]: v } }));

  const save = () => {
    try {
      localStorage.setItem('commissionSettingsV1', JSON.stringify(rates));
      setSaved('Saved successfully. These rates apply to payslip commission calculations.');
      setTimeout(()=> setSaved(null), 2500);
    } catch {
      setSaved('Failed to save.');
    }
  };

  const resetDefaults = () => setRates(loadSettings());

  const roles = [
    { key: 'sales_rep', label: 'Sales Rep' },
    { key: 'senior_sales_rep', label: 'Senior Sales Rep' },
    { key: 'sales_lead', label: 'Sales Lead' },
    { key: 'sales_manager', label: 'Sales Manager' },
  ];

  return (
    <Box sx={{ p: 2, maxWidth: 960, mx: 'auto' }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>Commissions</Typography>

      {saved && <Alert severity="success" sx={{ mb: 2 }}>{saved}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Gold — Per-gram (LYD/g)</Typography>
        <Stack spacing={2}>
          {roles.map(r => (
            <Box key={r.key} sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Typography sx={{ minWidth: 220 }}>{r.label}</Typography>
              <TextField
                size="small"
                type="number"
                inputProps={{ step: '0.01' }}
                value={rates.gold[r.key] ?? ''}
                onChange={e => setGold(r.key, Number(e.target.value || 0))}
              />
            </Box>
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Sales Lead/Manager use grams aggregated from their PS scope (set per employee in profile).
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Diamond — Percent of final sale price (%)</Typography>
        <Stack spacing={2}>
          {roles.map(r => (
            <Box key={r.key} sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Typography sx={{ minWidth: 220 }}>{r.label}</Typography>
              <TextField
                size="small"
                type="number"
                inputProps={{ step: '0.1' }}
                value={rates.diamond[r.key] ?? ''}
                onChange={e => setDiamond(r.key, Number(e.target.value || 0))}
              />
            </Box>
          ))}
        </Stack>
      </Paper>

      <Stack direction="row" spacing={2}>
        <Button variant="outlined" onClick={resetDefaults}>Reset to defaults</Button>
        <Button variant="contained" onClick={save}>Save</Button>
      </Stack>

      <Divider sx={{ my: 3 }} />
      <Typography variant="body2" color="text.secondary">
        Notes:
        <br />• Set each employee's role and PS scope in their profile (Compensation section).
        <br />• Payslip PDF shows commission details in Earnings and in the "Missing Hours & Commission" table.
      </Typography>
    </Box>
  );
}
