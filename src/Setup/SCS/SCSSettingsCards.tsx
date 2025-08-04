import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import CardActionArea from '@mui/material/CardActionArea';
import Button from '@mui/material/Button';
// Icons
import StoreIcon from '@mui/icons-material/Store';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import InventoryIcon from '@mui/icons-material/Inventory';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RouteIcon from '@mui/icons-material/Route';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import PercentIcon from '@mui/icons-material/Percent';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import AssessmentIcon from '@mui/icons-material/Assessment';
import Customers from './Pages/Customers';
import { Divider } from '@mui/material';


import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Suppliers from './Pages/Suppliers';
import ItemsTypes from './Pages/ItemsTypes';

import PointOfSales from './Pages/PointOfSales';
import Products from './Pages/Products';
import Boxes from './Pages/Boxes';
import Sm from './Pages/Sm';
import Vendors from './Pages/Vendors';

const cards = [
  {
    id: 1,
    title: 'Products',
    description: 'Configure your products database and related settings.',
    icon: <StoreIcon fontSize="large" />,
    component: <Products />,
  },
  
  {
    id: 2,
    title: 'Boxes',
    description: 'Configure your Boxes database and related settings.',
    icon: <StoreIcon fontSize="large" />,
    component: <Boxes />,
  },
  
  {
    id: 3,
    title: 'Customers',
    description: 'Configure your customer database and related settings.',
    icon: <StoreIcon fontSize="large" />,
    component: <Customers />,
  },
  {
    id: 4,
    title: 'Brands',
    description: 'Manage brand associations and brand details.',
    icon: <LocalOfferIcon fontSize="large" />,
    component: <Suppliers />,
  },
  {
    id: 5,
    title: 'Items Types',
    description: 'Items Types logically for easier management.',
    icon: <GroupWorkIcon fontSize="large" />,
    component: <ItemsTypes />,
  },
  {
    id: 6,
    title: 'Point of Sale',
    description: 'Configure Point of Sale terminals and behavior.',
    icon: <PointOfSaleIcon fontSize="large" />,
    component: <PointOfSales />,
  },



   {
    id: 7,
    title: 'Marketing Source',
    description: 'Configure Marketing Source terminals and behavior.',
    icon: <PointOfSaleIcon fontSize="large" />,
    component: <Sm />,
  },



  {
    id: 8,
    title: 'Seller Bonus Settings',
    description: 'Define rules for rewarding sellers.',
    icon: <EmojiEventsIcon fontSize="large" />,
  },
  {
    id: 9,
    title: 'Sales Shifts',
    description: 'Configure work shift parameters for sales staff.',
    icon: <AccessTimeIcon fontSize="large" />,
  },
  {
    id: 10,
    title: 'Temporary Reservation Sessions',
    description: 'Generate and manage temporary routing reservations.',
    icon: <RouteIcon fontSize="large" />,
  },
  {
    id: 11,
    title: 'Sales Approval Rules',
    description: 'Set conditions for validating and approving sales.',
    icon: <FactCheckIcon fontSize="large" />,
  },

  {
    id: 12,
    title: 'Sales Discount Types',
    description: 'Configure discount categories and rules.',
    icon: <PercentIcon fontSize="large" />,
  },
  {
    id: 13,
    title: 'Chira Approval Conditions',
    description: 'Set validation rules for Chira-related transactions.',
    icon: <VerifiedUserIcon fontSize="large" />,
  },
  {
    id: 14,
    title: 'Reports Configuration',
    description: 'Customize reports and analytics settings.',
    icon: <AssessmentIcon fontSize="large" />,
  },
   {
    id: 15,
    title: 'Vendors',
    description: 'Vendors List ',
    icon: <AssessmentIcon fontSize="large" />,
     component: <Vendors />,
  },
];

function SCSSettingsCards() {
  const [selectedCard, setSelectedCard] = React.useState<number | null>(null);

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
            Back
          </Button>


        </Box>

        <Divider sx={{ mb: 1, borderColor: 'grey.600', borderBottomWidth: 2 }} />

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

export default SCSSettingsCards;
