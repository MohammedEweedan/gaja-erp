import React from 'react';
import { useTheme } from '@mui/material/styles';

// ==============================|| LOGO COMPONENT ||============================== //

const Logo = () => {
  const theme = useTheme();

  return (
    <img 
      src="/banner-logo.png" 
      alt="GAJA ERP" 
      style={{ 
        maxWidth: '100%', 
        height: 'auto',
        maxHeight: '80px',
        paddingBottom: 10 
      }} 
    />
  );
};

export default Logo;
