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

import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import PsychologyAltIcon from '@mui/icons-material/PsychologyAlt';
import AssignmentIcon from '@mui/icons-material/Assignment';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';

import Jobs from './Pages/Jobs';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import EmployeeProfile from "../../../src/HR/Setting/EmployeeProfile";

const HRSettingsCards: React.FC = () => {
  const [selectedCard, setSelectedCard] = React.useState<number | null>(null);
  const theme = useTheme();
  const { t } = useTranslation();

  const accent = (theme.palette as any)?.gaja?.[500] ?? theme.palette.text.primary;

  const cards = React.useMemo(
    () => [
      {
        id: 1,
        title: t("hr.settings.positions.title"),
        description: t("hr.settings.positions.desc"),
        icon: <WorkOutlineIcon fontSize="large" />,
        component: <Jobs />,
      },
      {
        id: 2,
        title: t("hr.settings.employeeProfile.title"),
        description: t("hr.settings.employeeProfile.desc"),
        icon: <AccountBalanceIcon fontSize="large" />,
        component: <EmployeeProfile />,
      },
      {
        id: 3,
        title: t("hr.settings.bankAccounts.title"),
        description: t("hr.settings.bankAccounts.desc"),
        icon: <AccountBalanceWalletIcon fontSize="large" />,
        component: <div>Bank Accounts Page</div>,
      },
      {
        id: 4,
        title: t("hr.settings.certificates.title"),
        description: t("hr.settings.certificates.desc"),
        icon: <WorkspacePremiumIcon fontSize="large" />,
        component: <div>Certificates Page</div>,
      },
      {
        id: 5,
        title: t("hr.settings.specialities.title"),
        description: t("hr.settings.specialities.desc"),
        icon: <PsychologyAltIcon fontSize="large" />,
        component: <div>Specialities Page</div>,
      },
      {
        id: 6,
        title: t("hr.settings.contractsTypes.title"),
        description: t("hr.settings.contractsTypes.desc"),
        icon: <AssignmentIcon fontSize="large" />,
        component: <div>Contracts Types Page</div>,
      },
      {
        id: 7,
        title: t("hr.settings.positionsLevels.title"),
        description: t("hr.settings.positionsLevels.desc"),
        icon: <LeaderboardIcon fontSize="large" />,
        component: <div>Positions Levels Page</div>,
      },
      // {
      //   id: 8,
      //   title: t("hr.settings.costCenters.title"),
      //   description: t("hr.settings.costCenters.desc"),
      //   icon: <LeaderboardIcon fontSize="large" />,
      //   component: <div>Cost Centers Page</div>,
      // },
    ],
    [t]
  );

  if (selectedCard !== null) {
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

        <Divider sx={{ mb: 0, borderColor: 'grey.600', borderBottomWidth: 2 }} />

        {cards[selectedCard].component}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '95%',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 2,
        pt: 5
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

export default HRSettingsCards;
