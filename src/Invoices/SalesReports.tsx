import React, { useState } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import DiamondIcon from '@mui/icons-material/Diamond';
import WatchIcon from '@mui/icons-material/Watch';
import SalesReportsTable from './SalesReportsTable';

const typeOptions = [
  { label: 'Gold', value: 'gold', icon: <EmojiEventsIcon sx={{ fontSize: 60, color: '#FFD700' }} /> },
  { label: 'Diamond', value: 'diamond', icon: <DiamondIcon sx={{ fontSize: 60, color: '#B9F2FF' }} /> },
  { label: 'Watch', value: 'watch', icon: <WatchIcon sx={{ fontSize: 60, color: '#888' }} /> },
];

export default function SalesReports() {
  
  return (
    <Box  >
   
       
      <SalesReportsTable  />
    </Box>
  );
}
