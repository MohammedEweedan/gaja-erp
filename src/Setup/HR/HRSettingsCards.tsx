import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import CardActionArea from '@mui/material/CardActionArea';
import Button from '@mui/material/Button';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import PsychologyAltIcon from '@mui/icons-material/PsychologyAlt';
import AssignmentIcon from '@mui/icons-material/Assignment';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';

import Positions from './Pages/Positions';
import { Divider } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

const cards = [
  {
    id: 1,
    title: 'Positions',
    description: 'Set up the positions for all employees',
    icon: <WorkOutlineIcon fontSize="large" />,
    component: <Positions />,
  },
  {
    id: 2,
    title: 'Cost Centers',
    description: 'Set up the cost centers for the company.',
    icon: <AccountBalanceIcon fontSize="large" />,
    component: <div>Cost Centers Page</div>,
  },
  {
    id: 3,
    title: 'Bank Accounts',
    description: 'Set up the bank accounts for all employees.',
    icon: <AccountBalanceWalletIcon fontSize="large" />,
    component: <div>Bank Accounts Page</div>,
  },
  {
    id: 4,
    title: 'Certificates',
    description: 'Set up the certificates for all employees.',
    icon: <WorkspacePremiumIcon fontSize="large" />,
    component: <div>Certificates Page</div>,
  },
  {
    id: 5,
    title: 'Specialities',
    description: 'Set up the specialities for all employees.',
    icon: <PsychologyAltIcon fontSize="large" />,
    component: <div>Specialities Page</div>,
  },
  {
    id: 6,
    title: 'Contracts Types',
    description: 'Set up the contracts types for all employees.',
    icon: <AssignmentIcon fontSize="large" />,
    component: <div>Contracts Types Page</div>,
  },
  {
    id: 7,
    title: 'Positions Levels',
    description: 'Set up the positions levels.',
    icon: <LeaderboardIcon fontSize="large" />,
    component: <div>Positions Levels Page</div>,
  },
];

function HRSettingsCards() {
  const [selectedCard, setSelectedCard] = React.useState<number | null>(null);

  if (selectedCard !== null) {
    return (
      <Box sx={{ p: 3, ml: -3,mt: -3  }}>
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
            Back
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
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 2fr))',
        gap: 2,
        pt: 5,
      }}
    >
      {cards.map((card, index) => (
        <Card key={card.id}>
          <CardActionArea
            onClick={() => setSelectedCard(index)}
            sx={{
              height: '100%',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <CardContent sx={{ height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                {card.icon}
                <Typography variant="h5" component="div">
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
}

export default HRSettingsCards;
