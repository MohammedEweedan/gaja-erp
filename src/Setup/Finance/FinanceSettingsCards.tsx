import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import CardActionArea from '@mui/material/CardActionArea';

// New appropriate icons
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import SchemaIcon from '@mui/icons-material/Schema';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CategoryIcon from '@mui/icons-material/Category';

const cards = [
  {
    id: 1,
    title: 'Currency',
    description: 'Set up the currency for the system.',
    icon: <AttachMoneyIcon fontSize="large" />,
  },
  {
    id: 2,
    title: 'Chart of Accounts',
    description: 'Set up the chart of accounts for the company.',
    icon: <SchemaIcon fontSize="large" />,
  },
  {
    id: 3,
    title: 'Accounts distribution',
    description: 'Set up the accounts distribution.',
    icon: <AccountTreeIcon fontSize="large" />,
  },
  {
    id: 4,
    title: 'Assets Types',
    description: 'Set up the assets types',
    icon: <CategoryIcon fontSize="large" />,
  },
];

function FinanceSettingsCards() {
  const [selectedCard, setSelectedCard] = React.useState(0);
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

export default FinanceSettingsCards;
