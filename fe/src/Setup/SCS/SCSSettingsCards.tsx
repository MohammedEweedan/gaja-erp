import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CardActionArea,
  Button,
  Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// Icons
import StoreIcon from '@mui/icons-material/Store';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RouteIcon from '@mui/icons-material/Route';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import PercentIcon from '@mui/icons-material/Percent';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import AssessmentIcon from '@mui/icons-material/Assessment';

// Pages
import Customers from './Pages/Customers';
import Suppliers from './Pages/Suppliers';
import ItemsTypes from './Pages/ItemsTypes';
import PointOfSales from './Pages/PointOfSales';
import Products from './Pages/Products';
import Boxes from './Pages/Boxes';
import Sm from './Pages/Sm';
import Vendors from './Pages/Vendors';

// Theme + i18n + roles
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { hasRole } from '../getUserInfo';

type CardDef = {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  component?: React.ReactNode;
};

const SCSSettingsCards: React.FC = () => {
  const [selectedCard, setSelectedCard] = React.useState<number | null>(null);
  const theme = useTheme();
  const { t } = useTranslation();

  // Accent color (icons + titles) — use gaja.500
  const accent = (theme.palette as any)?.gaja?.[500] ?? '#b7a27d';

  // Role-gate (Sales Settings owners). Adjust if needed.
  const canView = hasRole('Sales Settings');

  const cards: CardDef[] = React.useMemo(
    () => [
      {
        id: 1,
        title: t('scs.settings.products.title'),
        description: t('scs.settings.products.desc'),
        icon: <StoreIcon fontSize="large" />,
        component: <Products />,
      },
      {
        id: 2,
        title: t('scs.settings.boxes.title'),
        description: t('scs.settings.boxes.desc'),
        icon: <StoreIcon fontSize="large" />,
        component: <Boxes />,
      },
      {
        id: 3,
        title: t('scs.settings.customers.title'),
        description: t('scs.settings.customers.desc'),
        icon: <StoreIcon fontSize="large" />,
        component: <Customers />,
      },
      {
        id: 4,
        title: t('scs.settings.brands.title'),
        description: t('scs.settings.brands.desc'),
        icon: <LocalOfferIcon fontSize="large" />,
        component: <Suppliers />,
      },
      {
        id: 5,
        title: t('scs.settings.itemsTypes.title'),
        description: t('scs.settings.itemsTypes.desc'),
        icon: <GroupWorkIcon fontSize="large" />,
        component: <ItemsTypes />,
      },
      {
        id: 6,
        title: t('scs.settings.pos.title'),
        description: t('scs.settings.pos.desc'),
        icon: <PointOfSaleIcon fontSize="large" />,
        component: <PointOfSales />,
      },
      {
        id: 7,
        title: t('scs.settings.marketingSource.title'),
        description: t('scs.settings.marketingSource.desc'),
        icon: <PointOfSaleIcon fontSize="large" />,
        component: <Sm />,
      },
      {
        id: 8,
        title: t('scs.settings.sellerBonus.title'),
        description: t('scs.settings.sellerBonus.desc'),
        icon: <EmojiEventsIcon fontSize="large" />,
      },
      {
        id: 9,
        title: t('scs.settings.salesShifts.title'),
        description: t('scs.settings.salesShifts.desc'),
        icon: <AccessTimeIcon fontSize="large" />,
      },
      {
        id: 10,
        title: t('scs.settings.tempReservations.title'),
        description: t('scs.settings.tempReservations.desc'),
        icon: <RouteIcon fontSize="large" />,
      },
      {
        id: 11,
        title: t('scs.settings.salesApproval.title'),
        description: t('scs.settings.salesApproval.desc'),
        icon: <FactCheckIcon fontSize="large" />,
      },
      {
        id: 12,
        title: t('scs.settings.discountTypes.title'),
        description: t('scs.settings.discountTypes.desc'),
        icon: <PercentIcon fontSize="large" />,
      },
      {
        id: 13,
        title: t('scs.settings.chiraApproval.title'),
        description: t('scs.settings.chiraApproval.desc'),
        icon: <VerifiedUserIcon fontSize="large" />,
      },
      {
        id: 14,
        title: t('scs.settings.reportsConfig.title'),
        description: t('scs.settings.reportsConfig.desc'),
        icon: <AssessmentIcon fontSize="large" />,
      },
      {
        id: 15,
        title: t('scs.settings.vendors.title'),
        description: t('scs.settings.vendors.desc'),
        icon: <AssessmentIcon fontSize="large" />,
        component: <Vendors />,
      },
    ],
    [t]
  );

  if (!canView) {
    // If the user lacks the role, render nothing or a friendly note (optional)
    return null;
  }

  if (selectedCard !== null) {
    const node = cards[selectedCard]?.component ?? (
      <Box sx={{ p: 2, color: 'text.secondary' }}>
        {t('scs.settings.comingSoon')}
      </Box>
    );

    return (
      <Box sx={{ p: 3, ml: -3, mt: -3 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 1,
          }}
        >
          <Button
            variant="contained"
            startIcon={<ArrowBackIcon />}
            onClick={() => setSelectedCard(null)}
            sx={{
              borderRadius: 3,
              backgroundColor: '#424242',
              textTransform: 'none',
              fontWeight: 'bold',
              px: 3,
              py: 1,
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
            }}
          >
            {t('common.back')}
          </Button>
        </Box>

        <Divider sx={{ mb: 1, borderColor: 'grey.600', borderBottomWidth: 2 }} />

        {node}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 2,
        pt: 5,
      }}
    >
      {cards.map((card, index) => (
        <Card
          key={card.id}
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
            onClick={() => setSelectedCard(index)}
            sx={{
              height: '100%',
              p: 2,
              borderRadius: 3,
              '& .MuiTouchRipple-root': { opacity: 0.2 },
            }}
          >
            <CardContent sx={{ display: 'grid', gap: 1.25 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box
                  aria-hidden
                  sx={{
                    color: accent,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {card.icon}
                </Box>
                <Typography
                  variant="h6"
                  component="div"
                  sx={{ color: accent, fontWeight: 700, lineHeight: 1.2 }}
                >
                  {card.title}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {card.description}
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      ))}
    </Box>
  );
};

export default SCSSettingsCards;
