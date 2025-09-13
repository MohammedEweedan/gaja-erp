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
