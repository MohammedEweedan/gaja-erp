import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { IconButton, Tooltip, styled, Box } from '@mui/material';

const PillIconButton = styled(IconButton)(({ theme }) => ({
  // GAJA gold; fallback
  color: (theme.palette as any)?.gaja?.[100] ?? '#b7a27d',
  borderRadius: 999,
  height: 32,
  minWidth: 48,
  lineHeight: 1,
  fontWeight: 800,
  fontSize: 16,
  letterSpacing: '0.64px',
  textTransform: 'uppercase',
  padding: theme.spacing(0.5, 1),
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const LanguageSwitcher: React.FC = () => {
  const { language, changeLanguage, isRTL } = useLanguage();

  const nextLang = language === 'ar' ? 'en' : 'ar';
  const tooltip = language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية';

  const handleToggle = () => changeLanguage(nextLang);

  // Language configuration with flags
  const languageConfig = {
    ar: {
      flag: '🇱🇾',
      label: 'AR'
    },
    en: {
      flag: '🇬🇧', 
      label: 'EN'
    }
  };

  const currentConfig = languageConfig[language as keyof typeof languageConfig];

  return (
    <Tooltip title={tooltip} placement={isRTL ? 'left' : 'right'}>
      <PillIconButton
        onClick={handleToggle}
      >
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 0.5,
          fontSize: 'inherit'
        }}>
          <span style={{ fontSize: '20' }}>{currentConfig.flag}</span>
        </Box>
      </PillIconButton>
    </Tooltip>
  );
};

export default LanguageSwitcher;