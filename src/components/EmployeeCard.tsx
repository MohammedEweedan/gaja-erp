import React from 'react';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import {
  Avatar,
  Box,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import EditOutlined from '@mui/icons-material/EditOutlined';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import EmailOutlined from '@mui/icons-material/EmailOutlined';
import PhoneOutlined from '@mui/icons-material/PhoneOutlined';
import WorkOutline from '@mui/icons-material/WorkOutline';
import LocalAtmOutlined from '@mui/icons-material/LocalAtmOutlined';

// Minimal shape expected from an Employee record
export type MinimalEmployee = {
  ID_EMP?: number;
  NAME: string;
  TITLE?: string | null;
  EMAIL?: string | null;
  PHONE?: string | null;
  STATE?: boolean | null;
  PICTURE_URL?: string | null;
  PS?: string | null; // point of sale id or name (string in your model)
  BASIC_SALARY?: number | null;
  CONTRACT_START?: string | null;
  CONTRACT_END?: string | null;
};

export type EmployeeCardProps<T extends MinimalEmployee = MinimalEmployee> = {
  employee: T;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
  /** Compact spacing */
  dense?: boolean;
  /** Optional map of Point-of-Sale id -> label for display */
  posLabelMap?: Map<number, string> | Record<string, string>;
};

const initials = (name?: string | null) =>
  name ? name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase() : '';

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : '—');
const fmtMoney = (n?: number | null) =>
  n == null ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export const EmployeeCard = <T extends MinimalEmployee>({
  employee: e,
  onEdit,
  onDelete,
  dense = false,
  posLabelMap,
}: EmployeeCardProps<T>) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const accent = (theme.palette as any)?.gaja?.[100] ?? theme.palette.text.primary;
  const posLabel = React.useMemo(() => {
    if (!e.PS) return undefined;
    if (posLabelMap instanceof Map) {
      const n = Number(e.PS);
      return posLabelMap.get(Number.isNaN(n) ? (e.PS as any) : n) || String(e.PS);
    }
    if (posLabelMap && typeof posLabelMap === 'object') {
      // try both numeric and string keys
      return (posLabelMap as any)[e.PS] || (posLabelMap as any)[String(e.PS)] || String(e.PS);
    }
    return String(e.PS);
  }, [e.PS, posLabelMap]);

  return (
    <Paper
      elevation={0}
      sx={{
        p: dense ? 1.5 : 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        position: 'relative',
        bgcolor: 'background.paper',
        transition: (t) => t.transitions.create(['box-shadow', 'transform', 'border-color'], { duration: t.transitions.duration.shorter }),
        '&:hover': {
          boxShadow: 6,
          transform: 'translateY(-2px)',
          borderColor: accent,
        },
        cursor: 'pointer',
      }}
    >
      {/* Action buttons */}
      <Stack
        direction="row"
        spacing={0.5}
        sx={{ position: 'absolute', top: 8, ...(theme.direction === 'rtl' ? { left: 8 } : { right: 8 }) }}
      >
        <Tooltip title={t('common.edit', 'Edit')}>
          <IconButton size="small" onClick={(ev) => { ev.stopPropagation(); onEdit(e); }}>
            <EditOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('common.delete', 'Delete')}>
          <IconButton size="small" color="error" onClick={(ev) => { ev.stopPropagation(); onDelete(e); }}>
            <DeleteOutline fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Header */}
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Avatar
          src={e.PICTURE_URL || undefined}
          sx={{ width: dense ? 42 : 56, height: dense ? 42 : 56, border: '2px solid', borderColor: accent }}
        >
          {initials(e.NAME)}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant={dense ? 'subtitle1' : 'h6'} fontWeight={800} noWrap sx={{ color: accent }}>
            {e.NAME || t('common.notSpecified', '—')}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {e.TITLE || t('common.notSpecified', '—')}
          </Typography>
          <Stack direction="row" spacing={0.75} sx={{ mt: 0.75 }}>
            {e.STATE != null && (
              <Chip size="small" color={e.STATE ? 'success' : 'default'} label={e.STATE ? t('common.active', 'Active') : t('common.inactive', 'Inactive')} sx={{ fontWeight: 600 }} />
            )}
            {posLabel && (
              <Chip size="small" variant="filled" label={posLabel} sx={{ bgcolor: accent, color: 'white', fontWeight: 600 }} />
            )}
          </Stack>
        </Box>
      </Stack>

      <Divider sx={{ my: dense ? 1 : 1.5 }} />

      {/* Body */}
      <Stack spacing={dense ? 1 : 1.25}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <EmailOutlined fontSize="small" />
          <Typography variant="body2" color="text.secondary">{e.EMAIL || t('common.notSpecified', '—')}</Typography>
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <PhoneOutlined fontSize="small" />
          <Typography variant="body2" color="text.secondary">{e.PHONE || t('common.notSpecified', '—')}</Typography>
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <WorkOutline fontSize="small" />
          <Typography variant="body2" color="text.secondary">{e.TITLE || t('common.notSpecified', '—')}</Typography>
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <LocalAtmOutlined fontSize="small" />
          <Typography variant="body2" color="text.secondary">
            {fmtMoney(e.BASIC_SALARY)}
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
};

const Row: React.FC<{ icon: React.ReactNode; value?: string | null }> = ({ icon, value }) => (
  <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
    <Box sx={{ color: 'text.secondary' }}>{icon}</Box>
    <Typography variant="body2" fontWeight={600} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {value || '—'}
    </Typography>
  </Stack>
);

export default EmployeeCard;
