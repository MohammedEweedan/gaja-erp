import React, { createContext, useMemo, useState, useContext, ReactNode, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, ThemeOptions } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { getDesignTokens } from './theme';

type ThemeContextType = {
  mode: 'light' | 'dark';
  toggleColorMode: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};

interface CustomThemeProviderProps {
  children: ReactNode;
}

export const CustomThemeProvider: React.FC<CustomThemeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('themeMode');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'light';
  });

  // Persist mode on change
  useEffect(() => {
    try {
      // Persist the current mode and reflect on html attribute
      localStorage.setItem('themeMode', mode);
      document.documentElement.setAttribute('data-color-mode', mode);
    } catch {}
  }, [mode]);

  const colorMode = useMemo(
    () => ({
      mode,
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
      },
    }),
    [mode]
  );

  // Listen to LanguageContext custom event to adopt direction changes
  const [direction, setDirection] = useState<'ltr' | 'rtl'>(() => (document?.documentElement?.dir as 'ltr' | 'rtl') || 'ltr');
  useEffect(() => {
    const handler = (e: any) => {
      const dir = e?.detail?.direction as 'ltr' | 'rtl' | undefined;
      if (dir === 'ltr' || dir === 'rtl') setDirection(dir);
    };
    window.addEventListener('languageChange', handler as EventListener);
    return () => window.removeEventListener('languageChange', handler as EventListener);
  }, []);

  const theme = useMemo(() => {
    const tokens = getDesignTokens(mode, direction);
    const baseTheme = createTheme(tokens as ThemeOptions);
    // Re-attach custom palette keys that MUI may strip during palette creation
    (baseTheme as any).palette.gaja = (tokens as any).palette.gaja;

    return baseTheme;
  }, [mode, direction]);

  return (
    <ThemeContext.Provider value={colorMode}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export default CustomThemeProvider;
