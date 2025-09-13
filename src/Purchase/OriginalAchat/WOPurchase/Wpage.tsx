import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CardActionArea,
  Divider,
  Stack,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';

// Icons
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WatchIcon from '@mui/icons-material/Watch';
import PaymentIcon from '@mui/icons-material/Payment';
import AssessmentIcon from '@mui/icons-material/Assessment';

// Pages
import WOPurchase from './WOPurchase';
import VendorsSettlment from './VendorsSettlment';
import VendorAccountStatement from './VendorAccountStatement';

// Optional: encrypted router helper (kept if you need it elsewhere)
const getEncryptedUrl = (route: string) => {
  const mappingKey = 'routeCryptMappingV1';
  const savedMapping = localStorage.getItem(mappingKey);
  if (savedMapping) {
    try {
      const parsed = JSON.parse(savedMapping);
      if (parsed.routeToEncrypted && parsed.routeToEncrypted[route]) {
        return parsed.routeToEncrypted[route];
      }
    } catch {}
  }
  return route;
};

const Wpage: React.FC = () => {
  const [selected, setSelected] = React.useState<'purchase' | 'settlement' | 'reports' | null>(null);
  const theme = useTheme();
  const { t } = useTranslation();

  // Accent like the rest of the app
  const accent = (theme.palette as any)?.gaja?.[500] ?? '#b7a27d';

  const handleBack = () => setSelected(null);

  const CardButton = ({
    icon,
    title,
    desc,
    onClick,
  }: {
    icon: React.ReactNode;
    title: string;
    desc: string;
    onClick: () => void;
  }) => (
    <Card
      elevation={0}
      sx={{
        borderRadius: 3,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: theme.palette.divider,
        overflow: 'hidden',
        transition: 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 6,
          borderColor: accent,
        },
        '&:focus-within': {
          outline: `2px solid ${accent}`,
          outlineOffset: 2,
        },
      }}
    >
      <CardActionArea
        onClick={onClick}
        sx={{
          height: '100%',
          p: 2.5,
          borderRadius: 3,
          '& .MuiTouchRipple-root': { opacity: 0.2 },
        }}
      >
        <CardContent>
          <Stack alignItems="center" spacing={1.25}>
            <Box sx={{ color: accent, display: 'inline-flex' }}>{icon}</Box>
            <Typography variant="h6" sx={{ color: accent, fontWeight: 700 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              {desc}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );

  // Detail screens
  if (selected) {
    return (
      <Box sx={{ p: 3, ml: -3, mt: -3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Button
            variant="contained"
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            sx={{
              borderRadius: 3,
              backgroundColor: '#424242',
              textTransform: 'none',
              fontWeight: 'bold',
              px: 3,
              py: 1,
              mr: 2,
              '&:hover': { backgroundColor: 'primary.dark' },
            }}
          >
            {t('common.back')}
          </Button>

          <Typography variant="h4" sx={{ m: 0, color: accent, fontWeight: 800 }}>
            {t('watches.title')}
          </Typography>
        </Box>

        <Divider sx={{ mb: 1, borderColor: 'grey.600', borderBottomWidth: 2 }} />

        {selected === 'purchase' && <WOPurchase />}
        {selected === 'settlement' && <VendorsSettlment />}
        {selected === 'reports' && <VendorAccountStatement />}
      </Box>
    );
  }

  // Landing (cards + ISO notes)
  return (
    <Box sx={{ p: 0.5 }}>
      <Box mb={2} display="flex" alignItems="center">
        <Typography variant="h4" sx={{ m: 0, color: accent, fontWeight: 800 }}>
          {t('watches.title')}
        </Typography>
      </Box>

      {/* Card actions */}
      <Box
        display="grid"
        gridTemplateColumns="repeat(auto-fill, minmax(260px, 1fr))"
        gap={2}
        justifyItems="stretch"
        pt={6}
      >
        <CardButton
          icon={<WatchIcon sx={{ fontSize: 48 }} />}
          title={t('watches.cards.purchase.title')}
          desc={t('watches.cards.purchase.desc')}
          onClick={() => setSelected('purchase')}
        />
        <CardButton
          icon={<PaymentIcon sx={{ fontSize: 48 }} />}
          title={t('watches.cards.payment.title')}
          desc={t('watches.cards.payment.desc')}
          onClick={() => setSelected('settlement')}
        />
        <CardButton
          icon={<AssessmentIcon sx={{ fontSize: 48 }} />}
          title={t('watches.cards.reports.title')}
          desc={t('watches.cards.reports.desc')}
          onClick={() => setSelected('reports')}
        />
      </Box>

      {/* ISO Notes */}
      <Card
        elevation={0}
        sx={{
          mt: 4,
          borderRadius: 3,
          border: '1px solid',
          borderColor: theme.palette.divider,
          bgcolor: 'background.paper',
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
          <Stack component="ul" sx={{ m: 0, pl: 2, gap: 1.5 }}>
            <Box component="li">
              <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: 18 }}>
                {t('watches.iso.purchaseVerbatim')}
              </Typography>
            </Box>

            <Box component="li">
              <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: 18 }}>
                {t('watches.iso.paymentVerbatim')}
              </Typography>
            </Box>

            <Box component="li">
              <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: 18 }}>
                {t('watches.iso.reportsVerbatim')}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Wpage;
