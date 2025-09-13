// src/pages/Home.tsx
import * as React from 'react';
import { createTheme, ThemeProvider, StyledEngineProvider, alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import {
  AppProvider,
  Navigation,
  Router,
  DashboardLayout,
  PageContainer,
} from '@toolpad/core';
import {
  Box,
  IconButton,
  Snackbar,
  Alert,
  Tooltip,
  CssBaseline,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

// Icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import SettingsIcon from '@mui/icons-material/Settings';
import Diversity3Icon from '@mui/icons-material/Diversity3';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import TuneIcon from '@mui/icons-material/Tune';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import CategoryIcon from '@mui/icons-material/Category';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import GradeIcon from '@mui/icons-material/Grade';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import DevicesOtherIcon from '@mui/icons-material/DevicesOther';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import DiamondIcon from '@mui/icons-material/Diamond';
import WatchIcon from '@mui/icons-material/Watch';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import { CurrencyExchange, GifBox, History, Inventory2, Logout, Paid, PaidTwoTone, Sell, TransitEnterexit } from '@mui/icons-material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

// App bits
import Logo from '../ui-component/Logo2';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { hasRole } from '../Setup/getUserInfo';

// Pages
import Dashboard from './Dashboard/Dashboard';
import P404 from './Dashboard/P404';
import GeneralSettings from '../Setup/GS/GeneralSettings';
import HRSettings from '../Setup/HR/HRSettings';
import FinanceSettings from '../Setup/Finance/FinanceSettings';
import SCSSettings from '../Setup/SCS/SCSSettings';
import GPurchase from '../Purchase/Types/GPurchase';
import OPurchase from '../Purchase/OriginalAchat/OPurchase';
import DOPurchase from '../Purchase/OriginalAchat/DOPurchase';
import Wpage from '../Purchase/OriginalAchat/WOPurchase/Wpage';
import GInventory from '../Inventory/GInventory';
import DInventory from '../Inventory/DInventory';
import WInventory from '../Inventory/WInventory';
import BInventory from '../Inventory/BInventory';
import GNew_I from '../Invoices/ListCardInvoice/Gold Invoices/GNew_I';
import InvoiceTypeSelector from '../Invoices/InvoiceTypeSelector';
import SalesReports from '../Invoices/SalesReports';
import CustomersReports from '../Invoices/CustomersReports';
import Revenue from '../Finance/Revenue';
import Expenses from '../Finance/Expenses';
import CashBookReports from '../Finance/CashBookReports';

// Emotion RTL support (only applied when dir === 'rtl')
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';

// ---------- Roles ----------
const showGeneralSettings = hasRole('User');
const showOpurchasde = hasRole('Purchase');
const showReceiveProducts = hasRole('Receive Products');
const showInvoices = hasRole('General Invoices');
const showInventory = hasRole('inventory');
const showcashbook = hasRole('Cash Book');
const showHR = hasRole('User');
const showFin = hasRole('Finance');
const showSales = hasRole('Sales Settings');

// ---------- Theme tokens with gaja palette (must exist globally) ----------
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
    gaja?: Partial<Palette['gaja']>;
  }
}

const getDesignTokens = (mode: 'light' | 'dark') => ({
  palette: {
    mode,
    gaja: {
      50: '#334d68',
      100: '#b7a27d', // ← gold accent
      200: '#334d68',
      300: '#b7a27d',
      400: '#b7a27d',
      500: '#b7a27d',
      600: '#334d68',
      700: '#b7a27d',
      800: '#334d68',
      900: '#b7a27d',
    },
    ...(mode === 'light'
      ? {
          primary: { main: '#1976d2' },
          secondary: { main: '#9c27b0' },
          background: { default: '#f5f5f5', paper: '#ffffff' },
          text: { primary: 'rgba(0, 0, 0, 0.87)', secondary: 'rgba(0, 0, 0, 0.6)' },
        }
      : {
          primary: { main: '#90caf9' },
          secondary: { main: '#ce93d8' },
          background: { default: '#121212', paper: '#1e1e1e' },
          text: { primary: '#ffffff', secondary: 'rgba(255, 255, 255, 0.7)' },
        }),
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

// ---------- Encrypted routing (unchanged) ----------
function generateRandomPath() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '/';
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

const realRoutes = [
  '/dashboard',
  '/home',
  '/setting/generals',
  '/setting/hrSetting',
  '/setting/finSetting',
  '/setting/spySetting',
  '/receiveProducts/goldPurchase',
  '/receiveProducts/diamondPurshase',
  '/receiveProducts/watchesPurchase',
  '/receiveProducts/boxesPurchase',
  '/invoice/goldInvoice',
  '/invoice/salesReports',
  '/invoice/otherReports',
  '/invoice/customersReports',
  '/inventory/diamondinventory',
  '/inventory/watchesinventory',
  '/inventory/boxesinventory',
  '/purchaseProducts/OPurchase',
  '/purchaseProducts/DOPurchase',
  '/purchaseProducts/WOPurchase',
  '/cashBook/cashdeposit',
  '/cashBook/cashexpenses',
  '/cashBook/cashbookReports',
];

let routeToEncrypted: Record<string, string> = {};
let encryptedToRoute: Record<string, string> = {};

const mappingKey = 'routeCryptMappingV1';
const savedMapping = typeof window !== 'undefined' ? localStorage.getItem(mappingKey) : null;
if (savedMapping) {
  try {
    const parsed = JSON.parse(savedMapping);
    routeToEncrypted = parsed.routeToEncrypted || {};
    encryptedToRoute = parsed.encryptedToRoute || {};
  } catch {}
}
if (Object.keys(routeToEncrypted).length !== realRoutes.length) {
  routeToEncrypted = {};
  encryptedToRoute = {};
  realRoutes.forEach((route) => {
    let crypted;
    do {
      crypted = generateRandomPath();
    } while (Object.values(routeToEncrypted).includes(crypted));
    routeToEncrypted[route] = crypted;
    encryptedToRoute[crypted] = route;
  });
  if (typeof window !== 'undefined') {
    localStorage.setItem(mappingKey, JSON.stringify({ routeToEncrypted, encryptedToRoute }));
  }
}

function useDemoRouter(initialPath: string): Router {
  const [pathname, setPathname] = React.useState(() => {
    if (typeof window !== 'undefined' && window.location?.pathname) {
      const current = window.location.pathname;
      if (routeToEncrypted[current]) {
        const crypted = routeToEncrypted[current];
        window.history.replaceState({}, '', crypted);
        return crypted;
      }
      if (encryptedToRoute[current]) return current;
      return current;
    }
    return initialPath;
  });

  React.useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return React.useMemo(
    () => ({
      pathname,
      searchParams: new URLSearchParams(),
      navigate: (path: string | URL) => {
        let newPath = String(path);
        if (routeToEncrypted[newPath]) newPath = routeToEncrypted[newPath];
        setPathname(newPath);
        if (window && window.history && window.location.pathname !== newPath) {
          window.history.pushState({}, '', newPath);
        }
      },
    }),
    [pathname],
  );
}



// ---------- Page wrappers ----------
const DashboardPage = () => <Dashboard />;
const PurchaseWrapper = ({ type }: { type: string }) => <GPurchase key={type} Type={type} />;
// eslint-disable-next-line react/jsx-pascal-case
const InvoiceWrapper = ({ type }: { type: string }) => <GNew_I />;
const SalesReportsWrapper = () => <SalesReports />;
const OtherReportsWrapper = () => <InvoiceTypeSelector />;
const GInventoryWrapper = ({ type }: { type: string }) => <GInventory key={type} Type={type} />;
const DInventoryWrapper = ({ type }: { type: string }) => <DInventory key={type} Type={type} />;
const WInventoryWrapper = ({ type }: { type: string }) => <WInventory key={type} Type={type} />;
const BInventoryWrapper = ({ type }: { type: string }) => <BInventory key={type} Type={type} />;

function getPageComponent(pathname: string) {
  const realPath = encryptedToRoute[pathname] || pathname;
  switch (realPath) {
    case '/setting/generals': return <GeneralSettings />;
    case '/dashboard': return <DashboardPage />;
    case '/home': return <DashboardPage />;
    case '/setting/hrSetting': return <HRSettings />;
    case '/setting/finSetting': return <FinanceSettings />;
    case '/setting/spySetting': return <SCSSettings />;
    case '/receiveProducts/goldPurchase': return <PurchaseWrapper type="gold" />;
    case '/receiveProducts/diamondPurshase': return <PurchaseWrapper type="diamond" />;
    case '/receiveProducts/watchesPurchase': return <PurchaseWrapper type="watches" />;
    case '/receiveProducts/boxesPurchase': return <PurchaseWrapper type="boxes" />;
    case '/invoice/goldInvoice': return <InvoiceWrapper type="gold" />;
    case '/invoice/salesReports': return <SalesReportsWrapper />;
    case '/invoice/otherReports': return <OtherReportsWrapper />;
    case '/invoice/customersReports': return <CustomersReports />;
    case '/inventory/goldinventory': return <GInventoryWrapper type="gold" />;
    case '/inventory/diamondinventory': return <DInventoryWrapper type="diamond" />;
    case '/inventory/watchesinventory': return <WInventoryWrapper type="watches" />;
    case '/inventory/boxesinventory': return <BInventoryWrapper type="boxes" />;
    case '/purchaseProducts/OPurchase': return <OPurchase />;
    case '/purchaseProducts/DOPurchase': return <DOPurchase />;
    case '/purchaseProducts/WOPurchase': return <Wpage />;
    case '/cashBook/cashdeposit': return <Revenue />;
    case '/cashBook/cashexpenses': return <Expenses />;
    case '/cashBook/cashbookReports': return <CashBookReports />;
    default: return <P404 />;
  }
}

// ---------- Navigation using i18n & gaja.100 on icons ----------
function buildNavigation(t: (k: string) => string): Navigation {
  const iconSx = {
    sx: (th: Theme) => ({
      color: ((th.palette as any)?.gaja?.[100]) ?? '#b7a27d',
    }),
  } as const;

  return [
    { kind: 'header', title: t('nav.headers.main'), },
    { segment: 'dashboard', title: t('nav.dashboard'), icon: <DashboardIcon {...iconSx} /> },
    { kind: 'divider' },
    { kind: 'header', title: t('nav.headers.actions') },
    {
      segment: 'setting',
      title: t('nav.setting.root'),
      icon: <TuneIcon {...iconSx} />,
      children: [
        showGeneralSettings && { segment: 'generals', title: t('nav.setting.general'), icon: <SettingsIcon {...iconSx} /> },
        showHR && { segment: 'hrSetting', title: t('nav.setting.hr'), icon: <PeopleAltIcon {...iconSx} /> },
        showFin && { segment: 'finSetting', title: t('nav.setting.finance'), icon: <MonetizationOnIcon {...iconSx} /> },
        showSales && { segment: 'spySetting', title: t('nav.setting.sales'), icon: <WarehouseIcon {...iconSx} /> },
      ].filter(Boolean) as any[],
    },
    ...(showOpurchasde
      ? [{
          segment: 'purchaseProducts',
          title: t('nav.purchase.root'),
          icon: <ShoppingCartIcon {...iconSx} />,
          children: [
            { segment: 'OPurchase', title: t('nav.purchase.gold'), icon: <EmojiEventsIcon {...iconSx} /> },
            { segment: 'DOPurchase', title: t('nav.purchase.diamond'), icon: <DiamondIcon {...iconSx} /> },
            { segment: 'WOPurchase', title: t('nav.purchase.watches'), icon: <WatchIcon {...iconSx} /> },
          ],
        }]
      : []),
    ...(showReceiveProducts
      ? [{
          segment: 'receiveProducts',
          title: t('nav.receive.root'),
          icon: <ShoppingCartIcon {...iconSx} />,
          children: [
            { segment: 'goldPurchase', title: t('nav.receive.gold'), icon: <EmojiEventsIcon {...iconSx} /> },
            { segment: 'diamondPurshase', title: t('nav.receive.diamond'), icon: <DiamondIcon {...iconSx} /> },
            { segment: 'watchesPurchase', title: t('nav.receive.watches'), icon: <WatchIcon {...iconSx} /> },
            { segment: 'boxesPurchase', title: t('nav.receive.boxes'), icon: <Inventory2Icon {...iconSx} /> },
          ],
        }]
      : []),
    ...(showInvoices
      ? [{
          segment: 'invoice',
          title: t('nav.invoice.root'),
          icon: <Paid {...iconSx} />,
          children: [
            { segment: 'goldInvoice', title: t('nav.invoice.createNew'), icon: <History {...iconSx} /> },
            { segment: 'salesReports', title: t('nav.invoice.salesReports'), icon: <History {...iconSx} /> },
            { segment: 'otherReports', title: t('nav.invoice.otherReports'), icon: <History {...iconSx} /> },
            { segment: 'customersReports', title: t('nav.invoice.customersReports'), icon: <History {...iconSx} /> },
          ],
        }]
      : []),
    ...(showInventory
      ? [{
          segment: 'inventory',
          title: t('nav.inventory.root'),
          icon: <Inventory2 {...iconSx} />,
          children: [
            { segment: 'goldinventory', title: t('nav.inventory.gold'), icon: <EmojiEventsIcon {...iconSx} /> },
            { segment: 'diamondinventory', title: t('nav.inventory.diamond'), icon: <DiamondIcon {...iconSx} /> },
            { segment: 'watchesinventory', title: t('nav.inventory.watches'), icon: <WatchIcon {...iconSx} /> },
            { segment: 'boxesinventory', title: t('nav.inventory.boxes'), icon: <GifBox {...iconSx} /> },
          ],
        }]
      : []),
    ...(showcashbook
      ? [{
          segment: 'cashBook',
          title: t('nav.cashbook.root'),
          icon: <CurrencyExchange {...iconSx} />,
          children: [
            { segment: 'cashdeposit', title: t('nav.cashbook.deposit'), icon: <TransitEnterexit {...iconSx} /> },
            { segment: 'cashexpenses', title: t('nav.cashbook.expenses'), icon: <PaidTwoTone {...iconSx} /> },
            { segment: 'Sell​currency', title: t('nav.cashbook.sellCurrency'), icon: <Sell {...iconSx} /> },
            { segment: 'buycurrency', title: t('nav.cashbook.buyCurrency'), icon: <Sell {...iconSx} /> },
            { segment: 'cashbookReports', title: t('nav.cashbook.reports'), icon: <History {...iconSx} /> },
          ],
        }]
      : []),
    ...(showHR
      ? [{
          segment: 'humanRessources',
          title: t('nav.hr.root'),
          icon: <Diversity3Icon {...iconSx} />,
          children: [
            {
              segment: 'regulationscompensations',
              title: t('nav.hr.compensations.root'),
              icon: <CategoryIcon {...iconSx} />,
              children: [
                { segment: 'vacations', title: t('nav.hr.compensations.vacations'), icon: <FlightTakeoffIcon {...iconSx} /> },
                { segment: 'timeheets', title: t('nav.hr.compensations.timesheets'), icon: <AccessTimeIcon {...iconSx} /> },
                { segment: 'promotions', title: t('nav.hr.compensations.promotions'), icon: <TrendingUpIcon {...iconSx} /> },
                { segment: 'wletter', title: t('nav.hr.compensations.warningLetter'), icon: <ReportProblemIcon {...iconSx} /> },
                { segment: 'productivity', title: t('nav.hr.compensations.productivity'), icon: <TrendingFlatIcon {...iconSx} /> },
                { segment: 'transfer', title: t('nav.hr.compensations.transfer'), icon: <CompareArrowsIcon {...iconSx} /> },
                { segment: 'evaluation', title: t('nav.hr.compensations.evaluation'), icon: <GradeIcon {...iconSx} /> },
                { segment: 'missions', title: t('nav.hr.compensations.missions'), icon: <AssignmentTurnedInIcon {...iconSx} /> },
                { segment: 'lequipement', title: t('nav.hr.compensations.loanEquipment'), icon: <DevicesOtherIcon {...iconSx} /> },
                { segment: 'delegation', title: t('nav.hr.compensations.delegation'), icon: <PeopleAltIcon {...iconSx} /> },
              ],
            },
          ],
        }]
      : []),
  ];
}

// ---------- RTL cache creator ----------
function createEmotionCache(direction: 'ltr' | 'rtl') {
  return createCache({
    key: direction === 'rtl' ? 'mui-rtl' : 'mui',
    prepend: true,
  });
}

// ---------- Component ----------
export default function Home(props: any) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = React.useState<'light' | 'dark'>(() => 'dark');
  const dir = i18n.dir() as 'ltr' | 'rtl';


  // Build theme with direction + tokens and re-attach custom palette keys
  const appTheme: Theme = React.useMemo(
    () => {
      const tokens = getDesignTokens(mode) as any;
      const base = createTheme({ direction: dir, ...tokens }) as any;
      // Ensure custom palette key persists on runtime theme
      base.palette.gaja = tokens.palette?.gaja;
      return base as Theme;
    },
    [mode, dir],
  );

  const { window } = props;
  const [initialPath] = React.useState(() =>
    typeof window !== 'undefined' ? window.location?.pathname || '/dashboard' : '/dashboard',
  );

  const router = useDemoRouter(initialPath);
  const demoWindow = typeof window !== 'undefined' ? window : undefined;

  const [snackbarOpen, setSnackbarOpen] = React.useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const colorMode = React.useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => {
          const newMode = prevMode === 'light' ? 'dark' : 'light';
          if (typeof window !== 'undefined') localStorage.setItem('themeMode', newMode);
          setSnackbarOpen(true);
          return newMode;
        });
      },
    }),
    [window],
  );

  // Keep document dir in sync (lets browser handle logical CSS like start/end)
  React.useEffect(() => {
    document.documentElement.setAttribute('dir', dir);
  }, [dir]);

  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.clear();
    navigate('/', { replace: true });
  };

  const handleCloseSnackbar = (_e?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setSnackbarOpen(false);
  };

  const NAV = React.useMemo<Navigation>(() => buildNavigation(t), [t]);

  const DesktopDynamicIsland: React.FC<{
    dir: 'ltr' | 'rtl';
    accent: string;
    mode: 'light' | 'dark';
    t: (k: string) => string;
    onToggleTheme: () => void;
    onLogout: () => void;
  }> = ({ dir, accent, mode, t, onToggleTheme, onLogout }) => {
    const isRTL = dir === 'rtl';
    const [hovered, setHovered] = React.useState(false);

    return (
      <Box
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        sx={(theme) => ({
          position: 'fixed',
          top: '50%',
          left: isRTL ? 20 : 'auto',
          right: isRTL ? 'auto' : 20,
          transform: 'translateY(-50%)',
          zIndex: theme.zIndex.drawer + 2,
          display: { xs: 'none', md: 'flex' }, // desktop only
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,                     // no gaps for perfect alignment
          width: 56,                  // fixed width for pill shape
          height: 'auto',
          minHeight: 160,             // bigger overall size
          padding: '12px 0',          // vertical padding only
          borderRadius: 28,           // perfect pill shape
          border: '3px solid',
          borderColor: accent,        // gold border
          backgroundColor: mode === 'light' 
            ? alpha('#1a1a1a', hovered ? 0.95 : 0.85)  // dark background in light mode
            : alpha(theme.palette.background.paper, hovered ? 0.95 : 0.7), // lighter in dark mode
          backdropFilter: 'blur(16px)',
          boxShadow: hovered
            ? `0 20px 60px ${alpha(accent, 0.5)}`      // gold shadow on hover
            : `0 12px 40px ${alpha(accent, 0.3)}`,      // subtle gold shadow
          transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: hovered ? 1 : 0.85,
          '&:focus-within': {
            opacity: 1,
            backgroundColor: mode === 'light' 
              ? alpha('#1a1a1a', 0.98) 
              : alpha(theme.palette.background.paper, 0.98),
            boxShadow: `0 24px 72px ${alpha(accent, 0.6)}`,
            transform: 'translateY(-50%) scale(1.02)',
          },
        })}
      >
        <Tooltip title={mode === 'dark' ? t('tooltip.lightMode') : t('tooltip.darkMode')}>
          <IconButton
            onClick={onToggleTheme}
            aria-label={t('aria.toggleTheme')}
            size="medium"
            sx={{
              color: accent, // gold color always
              '&:hover': { 
                backgroundColor: alpha(accent, 0.1),
                transform: 'scale(1.1)',
              },
              width: 40,
              height: 40,
              margin: '4px 0',
              transition: 'all 200ms ease',
            }}
          >
            {mode === 'dark' ? <Brightness7Icon fontSize="medium" /> : <Brightness4Icon fontSize="medium" />}
          </IconButton>
        </Tooltip>

        <Box sx={{ margin: '4px 0' }}>
          <LanguageSwitcher />
        </Box>

        <Tooltip title={t('tooltip.logout')}>
          <IconButton
            onClick={onLogout}
            aria-label={t('aria.logout')}
            size="medium"
            sx={{
              color: '#ff4757', // red color
              '&:hover': { 
                backgroundColor: alpha('#ff4757', 0.1),
                transform: 'scale(1.1)',
              },
              width: 40,
              height: 40,
              margin: '4px 0',
              transition: 'all 200ms ease',
            }}
          >
            <Logout fontSize="medium" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  };

  // Tab title from NAV (i18n-aware)
  React.useEffect(() => {
    function findTitle(nav: Navigation, path: string): string | null {
      for (const item of nav) {
        if ('segment' in item && item.segment && path.includes(item.segment)) return item.title ?? null;
        if ('children' in item && item.children) {
          const childTitle = findTitle(item.children as Navigation, path);
          if (childTitle) return childTitle;
        }
      }
      return null;
    }
    const realPath = encryptedToRoute[router.pathname] || router.pathname;
    const title = findTitle(NAV, realPath) || t('app.title');
    document.title = title;
  }, [router.pathname, NAV, t]);

  // Emotion cache per direction to avoid layout shifts
  const cache = React.useMemo(() => createEmotionCache(dir), [dir]);

  // Force gold everywhere as requested
  const accent = '#b7a27d';

  return (
    <CacheProvider value={cache}>
      <StyledEngineProvider injectFirst>
        <ThemeProvider theme={appTheme}>
          <CssBaseline />
          <AppProvider
            navigation={NAV}
            router={router}
            theme={appTheme}
            window={demoWindow}
            branding={{
              logo: (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    color: accent, // all children (incl. Logo SVG) inherit
                  }}
                >
                  <Logo />
                </Box>
              ),
              title: ''
            }}
          >
             <DesktopDynamicIsland
                dir={dir}
                accent={accent}
                mode={mode}
                t={t}
                onToggleTheme={colorMode.toggleColorMode}
                onLogout={handleLogout}
              />
            <DashboardLayout
              sx={{
                bgcolor: 'background.default',
                '& .MuiDrawer-root': { position: 'relative', height: '100vh' },
                '& .MuiDrawer-paper': {
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderInlineEnd: `1px solid #b7a27d`,
                },
                // keep your gold-for-everything overrides...
                '& .MuiDrawer-paper .MuiListItemIcon-root, & .MuiDrawer-paper .MuiListItemIcon-root svg': {
                  color: `#b7a27d !important`,
                  fontWeight: 800,
                  letterSpacing: '0.2px',
                },
                '& .MuiDrawer-paper .MuiListItemText-root .MuiTypography-root': {
                  color: `#b7a27d !important`,
                  fontWeight: 800,
                  fontSize: '1rem',
                  letterSpacing: '0.3px',
                },
                '& .MuiDrawer-paper .Mui-selected .MuiListItemIcon-root svg': {
                  color: `#b7a27d !important`,
                },
                '& .MuiDrawer-paper .MuiListItemButton-root:hover .MuiListItemIcon-root svg': {
                  color: `#b7a27d !important`,
                },
              }}
              navigation={NAV}
              slots={{
                toolbarActions: () => (
                  <Box
                    sx={{
                      display: { xs: 'flex', md: 'none' },  // ← mobile only
                      alignItems: 'center',
                      gap: 1,
                      flexDirection: dir === 'rtl' ? 'row-reverse' : 'row',
                      justifyContent: dir === 'rtl' ? 'flex-start' : 'flex-end',
                      width: '100%',
                    }}
                  >
                    <Tooltip
                      title={mode === 'dark' ? t('tooltip.lightMode') : t('tooltip.darkMode')}
                      placement={dir === 'rtl' ? 'bottom-start' : 'bottom-end'}
                    >
                      <IconButton
                        onClick={colorMode.toggleColorMode}
                        aria-label={t('aria.toggleTheme')}
                        sx={{ color: accent, '&:hover': { backgroundColor: 'action.hover' } }}
                      >
                        {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                      </IconButton>
                    </Tooltip>

                    <LanguageSwitcher />

                    <Tooltip title={t('tooltip.logout')} placement={dir === 'rtl' ? 'bottom-start' : 'bottom-end'}>
                      <IconButton
                        onClick={handleLogout}
                        aria-label={t('aria.logout')}
                        sx={{ color: accent, '&:hover': { backgroundColor: 'action.hover' } }}
                      >
                        <Logout />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ),
              }}
            >
              <PageContainer title="">
                {getPageComponent(router.pathname)}
              </PageContainer>
            </DashboardLayout>

            <Snackbar
              open={snackbarOpen}
              autoHideDuration={3000}
              onClose={handleCloseSnackbar}
              anchorOrigin={{ vertical: 'bottom', horizontal: dir === 'rtl' ? 'left' : 'right' }}
            >
              <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: '100%' }} elevation={6} variant="filled">
                {t('toast.currentTheme')}: {mode === 'dark' ? t('toast.darkMode') : t('toast.lightMode')}
              </Alert>
            </Snackbar>
          </AppProvider>
        </ThemeProvider>
      </StyledEngineProvider>
    </CacheProvider>
  );
}
