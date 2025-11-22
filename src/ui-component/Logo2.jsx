import { useTheme } from '@mui/material/styles';

const Logo2 = () => {
  const theme = useTheme();
  const logo =
    theme.palette.mode === 'dark' || theme.palette.mode === 'system'
      ? '/GJ_LOGO.png'
      : '/GJ_LOGO.png';

  return (
    <img
      src={logo}
      alt="Gaja ERP"
      style={{
        width: 'auto',
        height: 'auto',
        maxWidth: '100%',
        objectFit: 'contain',
      }}
    />
  );
};

export default Logo2;
