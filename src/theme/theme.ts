// src/theme/theme.ts
import { createTheme, PaletteMode, Theme, ThemeOptions } from '@mui/material/styles';

// ✅ Extend MUI Palette to include gaja
declare module '@mui/material/styles' {
  interface Palette {
    gaja: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
  }

  interface PaletteOptions {
    gaja?: {
      50?: string;
      100?: string;
      200?: string;
      300?: string;
      400?: string;
      500?: string;
      600?: string;
      700?: string;
      800?: string;
      900?: string;
    };
  }
}

/**
 * Design tokens for the theme.
 * Includes: palette, direction, global typography, and component overrides.
 */
export const getDesignTokens = (
  mode: PaletteMode,
  direction: 'ltr' | 'rtl' = 'ltr',
): ThemeOptions => {
  // Unified accent across the app for labels/text
  // Darken the light-mode accent a bit (#374151), keep dark mode accent (#9e9e9e)
  const accent = mode === 'light' ? '#374151' : '#9e9e9e';

  const themeOptions: ThemeOptions = {
    direction,
    palette: {
      mode,
      gaja: {
        50: '#334d68',
        100: accent,
        200: '#334d68',
        300: accent,
        400: accent,
        500: accent,
        600: '#334d68',
        700: accent,
        800: '#334d68',
        900: accent,
      },
      ...(mode === 'light'
        ? {
            primary: { main: '#000000', light: '#000000', dark: '#000000', contrastText: '#fff' },
            secondary: { main: '#000000', light: '#000000', dark: '#000000', contrastText: '#fff' },
            background: { default: '#f5f5f5', paper: '#ffffff' },
            text: { primary: accent, secondary: accent, disabled: 'rgba(0, 0, 0, 0.38)' },
          }
        : {
            primary: { main: '#ffffff', light: '#ffffff', dark: '#ffffff', contrastText: 'rgba(0, 0, 0, 0.87)' },
            secondary: { main: '#ffffff', light: '#ffffff', dark: '#ffffff', contrastText: '#fff' },
            background: { default: '#121212', paper: '#1e1e1e' },
            text: { primary: accent, secondary: accent, disabled: 'rgba(255, 255, 255, 0.5)' },
          }),
    },

    // 🔥 Global typography: heavier & slightly larger
    typography: {
      fontFamily:
        direction === 'rtl'
          ? '"Cairo", "Tajawal", "Noto Kufi Arabic", "Roboto", "Helvetica", "Arial", sans-serif'
          : '"Roboto", "Helvetica", "Arial", sans-serif',
      fontWeightRegular: 500,
      fontWeightMedium: 700,
      fontWeightBold: 800,
      h1: { fontWeight: 900, letterSpacing: 0.3 },
      h2: { fontWeight: 900, letterSpacing: 0.3 },
      h3: { fontWeight: 800, letterSpacing: 0.25 },
      h4: { fontWeight: 800, letterSpacing: 0.2, fontSize: '1.6rem' },
      h5: { fontWeight: 800, letterSpacing: 0.2, fontSize: '1.25rem' },
      h6: { fontWeight: 700, letterSpacing: 0.15 },
      subtitle1: { fontWeight: 700 },
      subtitle2: { fontWeight: 700 },
      body1: { fontWeight: 600, fontSize: '0.98rem' },
      body2: { fontWeight: 600, fontSize: '0.92rem' },
      button: { fontWeight: 800, textTransform: 'none', letterSpacing: 0.3 },
      overline: { fontWeight: 700, letterSpacing: 0.8 },
      caption: { fontWeight: 600 },
    },

    components: {
      // Buttons
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: '8px 16px',
            fontWeight: 700,
            textTransform: 'none',
            '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' },
            '&:active': { transform: 'translateY(0)' },
          },
          contained: { boxShadow: 'none', '&:hover': { boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' } },
        },
      },

      // Inputs
      MuiInputBase: { styleOverrides: { root: { borderRadius: 8 } } },

      // Labels and text accents
      MuiFormLabel: { styleOverrides: { root: { color: accent } } },
      MuiInputLabel: { styleOverrides: { root: { color: accent } } },
      MuiFormControlLabel: { styleOverrides: { label: { color: accent } } },

      // 🧭 Drawer/Navigation labels (ListItemText primary)
      MuiListItemText: {
        styleOverrides: {
          primary: {
            fontWeight: 800,
            fontSize: '1rem',
            letterSpacing: '0.3px',
          },
        },
      },
    },
  };

  return themeOptions;
};

/**
 * Factory to create the theme.
 * Pass the current direction from i18n: createCustomTheme(mode, i18n.dir() as 'ltr' | 'rtl')
 */
export const createCustomTheme = (
  mode: PaletteMode,
  direction: 'ltr' | 'rtl' = 'ltr',
): Theme => {
  const options = getDesignTokens(mode, direction);
  const theme = createTheme(options);

  // Ensure custom palette key exists on runtime theme
  (theme.palette as any).gaja =
    (options.palette as any)?.gaja ?? (theme.palette as any).gaja;

  return theme;
};
