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

const DOCK_GREY_LIGHT = '#6b7280'; // light grey
const DOCK_GREY = '#374151';       // main dock grey
const DOCK_GREY_DARK = '#111827';  // deep charcoal
const ACCENT_DARK = '#9e9e9e';     // dark mode accent

/**
 * Design tokens for the theme.
 */
export const getDesignTokens = (
  mode: PaletteMode,
  direction: 'ltr' | 'rtl' = 'ltr',
): ThemeOptions => {
  const accent = mode === 'light' ? DOCK_GREY : ACCENT_DARK;

  const themeOptions: ThemeOptions = {
    direction,
    palette: {
      mode,
      // 💀 NO MORE #334d68, only greys
      gaja: {
        50: DOCK_GREY_LIGHT,
        100: DOCK_GREY,
        200: DOCK_GREY_DARK,
        300: DOCK_GREY,
        400: DOCK_GREY_LIGHT,
        500: DOCK_GREY,
        600: DOCK_GREY_DARK,
        700: DOCK_GREY,
        800: DOCK_GREY_DARK,
        900: DOCK_GREY,
      },
      ...(mode === 'light'
        ? {
            primary: {
              main: DOCK_GREY,
              light: DOCK_GREY_LIGHT,
              dark: DOCK_GREY_DARK,
              contrastText: '#ffffff',
            },
            secondary: {
              main: DOCK_GREY,
              light: DOCK_GREY_LIGHT,
              dark: DOCK_GREY_DARK,
              contrastText: '#ffffff',
            },
            background: {
              default: '#f5f5f5',
              paper: '#ffffff',
            },
            text: {
              primary: accent,
              secondary: accent,
              disabled: 'rgba(0, 0, 0, 0.38)',
            },
          }
        : {
            primary: {
              main: ACCENT_DARK,
              light: '#d1d5db',
              dark: '#4b5563',
              contrastText: '#020617',
            },
            secondary: {
              main: ACCENT_DARK,
              light: '#d1d5db',
              dark: '#4b5563',
              contrastText: '#020617',
            },
            background: {
              // dark neutral greys, no blue tint
              default: '#111827',
              paper: '#020617',
            },
            text: {
              primary: accent,
              secondary: accent,
              disabled: 'rgba(255, 255, 255, 0.5)',
            },
          }),
    },

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
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: '8px 16px',
            fontWeight: 700,
            textTransform: 'none',
            '&:hover': {
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            },
            '&:active': { transform: 'translateY(0)' },
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            },
          },
        },
      },

      MuiInputBase: { styleOverrides: { root: { borderRadius: 8 } } },

      MuiFormLabel: { styleOverrides: { root: { color: accent } } },
      MuiInputLabel: { styleOverrides: { root: { color: accent } } },
      MuiFormControlLabel: { styleOverrides: { label: { color: accent } } },

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

export const createCustomTheme = (
  mode: PaletteMode,
  direction: 'ltr' | 'rtl' = 'ltr',
): Theme => {
  const options = getDesignTokens(mode, direction);
  const theme = createTheme(options);

  (theme.palette as any).gaja =
    (options.palette as any)?.gaja ?? (theme.palette as any).gaja;

  return theme;
};
