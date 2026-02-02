import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemeProvider, createTheme } from '@mui/material/styles';

type LanguageContextType = {
  language: string;
  direction: 'ltr' | 'rtl';
  changeLanguage: (lng: string) => void;
  isRTL: boolean;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('i18nextLng') || localStorage.getItem('lang');
      if (saved) return String(saved).split('-')[0];
    } catch {}
    return String(i18n.language || 'en').split('-')[0];
  });
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr');
  const isRTL = direction === 'rtl';

  // Ensure i18n instance starts on the hydrated language
  useEffect(() => {
    const desired = String(language || 'en').split('-')[0];
    const current = String(i18n.language || 'en').split('-')[0];
    if (desired && desired !== current) {
      try {
        i18n.changeLanguage(desired);
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update document direction and language when language changes
  useEffect(() => {
    const dir = language === 'ar' ? 'rtl' : 'ltr';
    setDirection(dir);
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
    
    // Save language preference
    localStorage.setItem('i18nextLng', language);
    localStorage.setItem('lang', language);
  }, [language]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setLanguage(lng);
    
    // Dispatch event for components that need to react to language changes
    window.dispatchEvent(new CustomEvent('languageChange', { 
      detail: { 
        language: lng,
        direction: lng === 'ar' ? 'rtl' : 'ltr'
      } 
    }));
  };

  // Create theme with direction
  const theme = createTheme({
    direction,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            direction,
          },
          body: {
            direction,
            '& .MuiTypography-root': {
              direction,
            },
          },
        },
      },
    },
  });

  return (
    <LanguageContext.Provider value={{ language, direction, changeLanguage, isRTL }}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;
