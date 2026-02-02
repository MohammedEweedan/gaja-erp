import * as React from 'react';
import { Box } from '@mui/material';
import Header from '../components/Header/Header';

interface MainLayoutProps {
  children: React.ReactNode;
  branding?: {
    title: string;
    logo?: React.ReactNode;
    homeUrl: string;
  };
}
export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <Box 
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: '100%',
          overflow: 'auto',
          bgcolor: 'background.default',
          marginTop: '64px' // Account for fixed header
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
