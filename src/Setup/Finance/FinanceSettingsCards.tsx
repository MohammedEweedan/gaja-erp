import * as React from 'react';
import { Box, Card, CardContent, Typography, CardActionArea } from '@mui/material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import SchemaIcon from '@mui/icons-material/Schema';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CategoryIcon from '@mui/icons-material/Category';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { hasRole } from '../getUserInfo';

type CardDef = {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
};

function FinanceSettingsCards() {
  const [selectedCard, setSelectedCard] = React.useState<number | null>(null);
  const theme = useTheme();
  const { t } = useTranslation();

  // Accent (icons + text)
  const accent = (theme.palette as any)?.gaja?.[500] ?? '#b7a27d';

  // Role gate: Finance & Cash Book users can view
  const canView = hasRole('Finance') || hasRole('Cash Book');
  const cards: CardDef[] = React.useMemo(
    () => [
      {
        id: 1,
        title: t('finance.settings.currency.title', 'Currency'),
        description: t('finance.settings.currency.desc', 'Set up the currency for the system.'),
        icon: <AttachMoneyIcon fontSize="large" />,
      },
      {
        id: 2,
        title: t('finance.settings.coa.title', 'Chart of Accounts'),
        description: t('finance.settings.coa.desc', 'Set up the chart of accounts for the company.'),
        icon: <SchemaIcon fontSize="large" />,
      },
      {
        id: 3,
        title: t('finance.settings.accountsDistribution.title', 'Accounts distribution'),
        description: t('finance.settings.accountsDistribution.desc', 'Set up the accounts distribution.'),
        icon: <AccountTreeIcon fontSize="large" />,
      },
      {
        id: 4,
        title: t('finance.settings.assetsTypes.title', 'Assets Types'),
        description: t('finance.settings.assetsTypes.desc', 'Set up the assets types'),
        icon: <CategoryIcon fontSize="large" />,
      },
    ],
    [t]
  );

  const filteredCards = canView ? cards : [];

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
      {filteredCards.map((card, index) => {
        const isActive = selectedCard === index;
        return (
          <Card
            key={card.id}
            elevation={0}
            sx={{
              borderRadius: 3,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: isActive ? accent : theme.palette.divider,
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
              aria-pressed={isActive}
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
        );
      })}
    </Box>
  );
}

export default FinanceSettingsCards;
