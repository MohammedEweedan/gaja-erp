import React from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Stack,
  useTheme,
} from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isArabic = i18n.language?.startsWith('ar');

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.assign('/');
    }
  };

  const handleHome = () => {
    window.location.assign('/');
  };

  return (
    <Box
      dir={isArabic ? 'rtl' : 'ltr'}
      sx={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        bgcolor: 'background.default',
        backgroundImage: `radial-gradient(circle at 0 0, ${theme.palette.primary.light}22, transparent 50%), radial-gradient(circle at 100% 100%, ${theme.palette.error.light}22, transparent 50%)`,
      }}
    >
      <Paper
        elevation={6}
        sx={{
          maxWidth: 480,
          width: '100%',
          p: { xs: 3, sm: 4 },
          borderRadius: 4,
          textAlign: 'center',
        }}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
            bgcolor: (theme) => theme.palette.error.light + '22',
          }}
        >
          <ErrorOutlineIcon sx={{ fontSize: 48, color: 'error.main' }} />
        </Box>

        <Typography
          variant="h2"
          component="div"
          sx={{
            fontWeight: 800,
            letterSpacing: 4,
            mb: 1,
          }}
        >
          404
        </Typography>

        <Typography
          variant="h5"
          component="h1"
          sx={{ mb: 1.5, fontWeight: 600 }}
        >
          {t('notFound.title')}
        </Typography>

        <Typography
          variant="body1"
          sx={{
            mb: 3,
            maxWidth: 420,
            mx: 'auto',
            opacity: 0.8,
            lineHeight: 1.6,
          }}
        >
          {t('notFound.description')}
        </Typography>

        <Stack
          direction={isArabic ? 'row-reverse' : 'row'}
          spacing={2}
          justifyContent="center"
        >
          <Button
            variant="contained"
            color="primary"
            onClick={handleBack}
          >
            {t('notFound.goBack')}
          </Button>
          <Button
            variant="outlined"
            onClick={handleHome}
          >
            {t('notFound.goHome')}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
