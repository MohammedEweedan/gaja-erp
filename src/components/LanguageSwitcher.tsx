import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { IconButton, Tooltip, styled, Box } from '@mui/material';

const PillIconButton = styled(IconButton)(({ theme }) => ({
  // Use theme accent: black (light) / white (dark)
  color: (theme.palette as any)?.gaja?.[100] ?? theme.palette.text.primary,
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

  // Normalize language to base code ('ar' | 'en'), and provide a default
  const normalizedLang = (typeof language === 'string' ? language.split('-')[0] : 'en') as 'ar' | 'en';

  const nextLang = normalizedLang === 'ar' ? 'en' : 'ar';
  const tooltip = normalizedLang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية';

  const handleToggle = () => changeLanguage(nextLang);

  // Language configuration
  const languageConfig = {
    ar: { label: 'AR' },
    en: { label: 'EN' },
  } as const;

  const currentConfig = languageConfig[normalizedLang] ?? { label: 'EN' };

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
          <span style={{ fontSize: 20 }}>{currentConfig.label}</span>
        </Box>
      </PillIconButton>
    </Tooltip>
  );
};

export default LanguageSwitcher;