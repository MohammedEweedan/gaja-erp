// src/components/Header/Header.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  IconButton,
  Box,
  Container,
  Stack,
  Tooltip,
  styled,
  Chip,
} from '@mui/material';
import {
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
} from '@mui/icons-material';
import LanguageSwitcher from '../LanguageSwitcher';
import { useThemeContext } from '../../theme/ThemeProvider';
import Logo from '../../ui-component/Logo';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  backgroundImage: 'none',
  borderBottom: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(1, 0),
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  position: 'sticky',
  top: 0,
  zIndex: theme.zIndex.appBar,
}));

const Header: React.FC = () => {
  const { t } = useTranslation();
  const { mode, toggleColorMode } = useThemeContext();
  // Read Prvilege and map to friendly label: Admin > Accounting > User
  const roleLabel = (() => {
    const normalizeRoles = (input: any): string[] => {
      if (!input) return [];
      if (Array.isArray(input)) {
        return input
          .map((r) => (typeof r === 'string' ? r : String((r as any)?.name || (r as any)?.role || (r as any)?.value || r)))
          .flatMap((s) => String(s).split(/[\s,;]+/))
          .filter(Boolean)
          .map((s) => s.toUpperCase());
      }
      if (typeof input === 'string') {
        return input
          .split(/[\s,;]+/)
          .filter(Boolean)
          .map((s) => s.toUpperCase());
      }
      if (typeof input === 'object') {
        const s = String((input as any).name || (input as any).role || (input as any).value || '');
        return s
          ? s
              .split(/[\s,;]+/)
              .filter(Boolean)
              .map((x) => x.toUpperCase())
          : [];
      }
      return [];
    };

    try {
      let roles: string[] = [];
      const u = localStorage.getItem('user');
      if (u) {
        const obj = JSON.parse(u);
        roles = roles.concat(normalizeRoles(obj?.Prvilege));
      }
      if (roles.length === 0) {
        const standalone = localStorage.getItem('Prvilege');
        if (standalone) {
          try {
            roles = roles.concat(normalizeRoles(JSON.parse(standalone)));
          } catch {
            roles = roles.concat(normalizeRoles(standalone));
          }
        }
      }

      const has = (needle: string) => roles.some((r) => r === needle || r.includes(needle));
      if (has('ROLE_ADMIN') || has('ADMIN')) return 'Admin';
      if (has('ROLE_ACCOUNT') || has('ACCOUNT')) return 'Accounting';
      if (has('ROLE_USER') || has('USER')) return 'User';
      return '';
    } catch {
      return '';
    }
  })();

  return (
    <StyledAppBar>
      <Container maxWidth={false}>
        <Toolbar disableGutters>
          {/* Brand */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Link to="/">
              <Logo />
            </Link>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Right side actions */}
          <Stack direction="row" spacing={1} alignItems="center">
            {/* User Role (from localStorage.user.Prvilege) */}
            {roleLabel && (
              <Chip
                label={roleLabel}
                color={roleLabel === 'Admin' ? 'warning' : 'default'}
                size="small"
                sx={{ fontWeight: 800, letterSpacing: 0.3 }}
              />
            )}
            {/* Theme Toggle */}
            <Tooltip title={mode === 'dark' ? t('header.lightMode') || 'Light mode' : t('header.darkMode') || 'Dark mode'}>
              <IconButton
                onClick={toggleColorMode}
                color="inherit"
                sx={{ color: 'text.primary', '&:hover': { backgroundColor: 'action.hover' } }}
              >
                {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>

            {/* Language */}
            <LanguageSwitcher />
          </Stack>
        </Toolbar>
      </Container>
    </StyledAppBar>
  );
};

export default Header;
