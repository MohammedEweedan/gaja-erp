import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import CardActionArea from '@mui/material/CardActionArea';

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupIcon from '@mui/icons-material/Group';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import { getUserInfo, hasRole } from '../getUserInfo';


 
const cards = [
  {
    id: 1,
    title: 'Works Period',
    description: 'Create or set a work period for all users.',
    icon: <AccessTimeIcon fontSize="large" />,
  },
  {
    id: 2,
    title: 'Users list',
    description: 'List of all end users.',
    icon: <GroupIcon fontSize="large" />,
  },
  {
    id: 3,
    title: 'Server Mail',
    description: 'Set up the server mail for sending emails.',
    icon: <MarkEmailUnreadIcon fontSize="large" />,
  },
  {
    id: 4,
    title: 'Chart of Accounts levels',
    description: 'Chart of accounts levels for the system.',
    icon: <AccountTreeIcon fontSize="large" />,
  },
  {
    id: 5,
    title: 'Fingerprint',
    description: 'Set up the fingerprint for the system.',
    icon: <FingerprintIcon fontSize="large" />,
  },
];
 


function SelectActionCard() {
  const [selectedCard, setSelectedCard] = React.useState(0);
  // Only show cards if user has 'user' role
 
  const showCards = hasRole('User');
  const filteredCards = showCards ? cards : [];

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
      {filteredCards.map((card, index) => (
        <Card key={card.id}>
          <CardActionArea
            onClick={() => setSelectedCard(index)}
            data-active={selectedCard === index ? '' : undefined}
            sx={{
              height: '100%',
              '&[data-active]': {
                backgroundColor: 'action.selected',
                '&:hover': {
                  backgroundColor: 'action.selectedHover',
                },
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

export default SelectActionCard;
