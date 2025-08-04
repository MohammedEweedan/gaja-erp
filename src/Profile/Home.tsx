import * as React from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import {
  AppProvider,
  Navigation,
  Router,
  DashboardLayout,
  PageContainer,
} from '@toolpad/core';

import Wpage from '../Purchase/OriginalAchat/WOPurchase/Wpage';

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
import {
  Box,
  IconButton,
  Snackbar,
  Alert
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

import Logo from '../ui-component/Logo2';
import GeneralSettings from '../Setup/GS/GeneralSettings';
import HRSettings from '../Setup/HR/HRSettings';
import FinanceSettings from '../Setup/Finance/FinanceSettings';
import SCSSettings from '../Setup/SCS/SCSSettings';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import DiamondIcon from '@mui/icons-material/Diamond';
import WatchIcon from '@mui/icons-material/Watch';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import GPurchase from '../Purchase/Types/GPurchase';
import { CurrencyExchange, GifBox, History, Inventory2, Logout, NewLabel, Paid, PaidTwoTone, PreviewOutlined, Report, Sailing, Sell, Shop, TransitEnterexit } from '@mui/icons-material';

import InvoiceTypeSelector from '../Invoices/InvoiceTypeSelector';
import { useNavigate } from 'react-router-dom';
import GInventory from '../Inventory/GInventory';
import DInventory from '../Inventory/DInventory';
import WInventory from '../Inventory/WInventory';
import BInventory from '../Inventory/BInventory';
import Revenue from '../Finance/Revenue';
import OPurchase from '../Purchase/OriginalAchat/OPurchase';
import DOPurchase from '../Purchase/OriginalAchat/DOPurchase';

import Dashboard from './Dashboard/Dashboard';
import P404 from './Dashboard/P404';
import GNew_I from '../Invoices/ListCardInvoice/Gold Invoices/GNew_I';
import SalesReports from '../Invoices/SalesReports';
import { hasRole } from '../Setup/getUserInfo';
import Expenses from '../Finance/Expenses';
import CustomersReports from '../Invoices/CustomersReports';
import CashBookReports from '../Finance/CashBookReports';
const showGeneralSettings = hasRole('User'); // or whatever role you want
const showOpurchasde = hasRole('Purchase');
const showReceiveProducts = hasRole('Receive Products');
const showInvoices = hasRole('General Invoices');
const showInventory = hasRole('inventory');
const showcashbook = hasRole('Cash Book');
const showHR = hasRole('HR');
const showFin = hasRole('Finance');

const showSales = hasRole('Sales Settings');

const NAVIGATION: Navigation = [
  {
    kind: 'header',
    title: 'Main items',
  },
  {
    segment: 'dashboard',
    title: 'Dashboard',
    icon: <DashboardIcon />,
  },
  {
    kind: 'divider',
  },
  {
    kind: 'header',
    title: 'Actions',
  },
  {
    segment: 'setting',
    title: 'Setting',
    icon: <TuneIcon />,
    children: [
      showGeneralSettings && {
        segment: 'generals',
        title: 'General Settings',
        icon: <SettingsIcon />,
      },
      showHR && {
        segment: 'hrSetting',
        title: 'HR Settings',
        icon: <PeopleAltIcon />,
      },
      showFin && {
        segment: 'finSetting',
        title: 'Finance Settings',
        icon: <MonetizationOnIcon />,
      },
      showSales && {
        segment: 'spySetting',
        title: 'Sales Settings',
        icon: <WarehouseIcon />,
      },
    ].filter(Boolean) as any[],
  },
  ...(showOpurchasde
    ? [
      {
        segment: 'purchaseProducts',
        title: 'Purchase Products',
        icon: <ShoppingCartIcon />,
        children: [
          {
            segment: 'OPurchase',
            title: 'Gold Purchase',
            icon: <EmojiEventsIcon />,
          },
          {
            segment: 'DOPurchase',
            title: 'Diamond Purchase',
            icon: <DiamondIcon />,
          },
          {
            segment: 'WOPurchase',
            title: 'Watches Purchase',
            icon: <WatchIcon />,
          },
        ],
      },
    ]
    : []),
  ...(showReceiveProducts
    ? [
      {
        segment: 'receiveProducts',
        title: 'Receive Products',
        icon: <ShoppingCartIcon />,
        children: [
          {
            segment: 'goldPurchase',
            title: 'Gold Purchase',
            icon: <EmojiEventsIcon />,
          },
          {
            segment: 'diamondPurshase',
            title: 'Diamond Purchase',
            icon: <DiamondIcon />,
          },
          {
            segment: 'watchesPurchase',
            title: 'Watches Purchase',
            icon: <WatchIcon />,
          },
          {
            segment: 'boxesPurchase',
            title: 'Boxes Purchase',
            icon: <Inventory2Icon />,
          },
        ],
      },
    ]
    : []),
  ...(showInvoices
    ? [
      {
        segment: 'invoice',
        title: 'Invoice',
        icon: <Paid />,
        children: [
          {
            segment: 'goldInvoice',
            title: 'Create new Invoice',
            icon: <NewLabel />,
          },
          {
            segment: 'salesReports',
            title: 'Sales Reports',
            icon: <History />,
          },
          {
            segment: 'otherReports',
            title: 'OtherReports',
            icon: <History />,
          },


          {
            segment: 'customersReports',
            title: 'Customers Reports',
            icon: <History />,
          },



        ],
      },
    ]
    : []),
  ...(showInventory
    ? [
      {
        segment: 'inventory',
        title: 'Inventory',
        icon: <Inventory2 />,
        children: [
          {
            segment: 'goldinventory',
            title: 'Gold Inventory',
            icon: <EmojiEventsIcon />,
          },
          {
            segment: 'diamondinventory',
            title: 'Diamond Inventory',
            icon: <DiamondIcon />,
          },
          {
            segment: 'watchesinventory',
            title: 'Watches Inventory',
            icon: <WatchIcon />,
          },
          {
            segment: 'boxesinventory',
            title: 'Boxes Inventory',
            icon: <GifBox />,
          },
        ],
      },
    ]
    : []),
  ...(showcashbook
    ? [
      {
        segment: 'cashBook',
        title: 'Cash Book',
        icon: <CurrencyExchange />,
        children: [
          {
            segment: 'cashdeposit',
            title: 'Cash Deposit',
            icon: <TransitEnterexit />,
          },
          {
            segment: 'cashexpenses',
            title: 'Cash Expenses',
            icon: <PaidTwoTone />,
          },
          {
            segment: 'Sell​currency',
            title: 'Sell ​Currency',
            icon: <Sell />,
          },
          {
            segment: 'buycurrency',
            title: 'Buy Currency',
            icon: <Sell />,
          },



          {
            segment: 'cashbookReports',
            title: 'Cash Book Reports',
            icon: <History />,
          },



        ],
      },
    ]
    : []),
  ...(showHR
    ? [
      {
        segment: 'humanRessources',
        title: 'Human Ressources',
        icon: <Diversity3Icon />,
        children: [
          {
            segment: 'regulationscompensations',
            title: 'Compensations',
            icon: <CategoryIcon />,
            children: [
              {
                segment: 'vacations',
                title: 'Vacations',
                icon: <FlightTakeoffIcon />,
              },
              {
                segment: 'timeheets',
                title: 'Time Sheets',
                icon: <AccessTimeIcon />,
              },
              {
                segment: 'promotions',
                title: 'Promotions',
                icon: <TrendingUpIcon />,
              },
              {
                segment: 'wletter',
                title: 'Warning Letter',
                icon: <ReportProblemIcon />,
              },
              {
                segment: 'productivity',
                title: 'Productivity',
                icon: <TrendingFlatIcon />,
              },
              {
                segment: 'transfer',
                title: 'Transfer',
                icon: <CompareArrowsIcon />,
              },
              {
                segment: 'evaluation',
                title: 'Evaluation',
                icon: <GradeIcon />,
              },
              {
                segment: 'missions',
                title: 'Missions',
                icon: <AssignmentTurnedInIcon />,
              },
              {
                segment: 'lequipement',
                title: 'Loan Equipment',
                icon: <DevicesOtherIcon />,
              },
              {
                segment: 'delegation',
                title: 'Delegation',
                icon: <PeopleAltIcon />,
              },
            ],
          },
        ],
      },
    ]
    : []),
];

const getDesignTokens = (mode: 'light' | 'dark') => ({
  palette: {
    mode,
    ...(mode === 'light'
      ? {
        primary: {
          main: '#1976d2',
        },
        secondary: {
          main: '#9c27b0',
        },
        background: {
          default: '#f5f5f5',
          paper: '#ffffff',
        },
        text: {
          primary: 'rgba(0, 0, 0, 0.87)',
          secondary: 'rgba(0, 0, 0, 0.6)',
        },
      }
      : {
        primary: {
          main: '#90caf9',
        },
        secondary: {
          main: '#ce93d8',
        },
        background: {
          default: '#121212',
          paper: '#1e1e1e',
        },
        text: {
          primary: '#ffffff',
          secondary: 'rgba(255, 255, 255, 0.7)',
        },
      }),
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

// --- Dynamic Encrypted URL mapping ---
function generateRandomPath() {
  // 32 random alphanumeric chars for longer cryptage
  let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '/';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// On every load, use or generate a persistent mapping
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
  // ...add more as needed
];

let routeToEncrypted: Record<string, string> = {};
let encryptedToRoute: Record<string, string> = {};

const mappingKey = 'routeCryptMappingV1';
const savedMapping = localStorage.getItem(mappingKey);
if (savedMapping) {
  try {
    const parsed = JSON.parse(savedMapping);
    routeToEncrypted = parsed.routeToEncrypted || {};
    encryptedToRoute = parsed.encryptedToRoute || {};
  } catch (e) {
    // fallback to regeneration
  }
}

if (Object.keys(routeToEncrypted).length !== realRoutes.length) {
  // Generate new mapping if missing or incomplete
  routeToEncrypted = {};
  encryptedToRoute = {};
  realRoutes.forEach(route => {
    let crypted;
    do {
      crypted = generateRandomPath();
    } while (Object.values(routeToEncrypted).includes(crypted));
    routeToEncrypted[route] = crypted;
    encryptedToRoute[crypted] = route;
  });
  localStorage.setItem(mappingKey, JSON.stringify({ routeToEncrypted, encryptedToRoute }));
}
// ---

function useDemoRouter(initialPath: string): Router {
  const [pathname, setPathname] = React.useState(() => {
    // On first load, use the actual browser URL if available
    if (typeof window !== 'undefined' && window.location?.pathname) {
      let current = window.location.pathname;
      // If the current path is a real route, redirect to the encrypted version
      if (routeToEncrypted[current]) {
        const crypted = routeToEncrypted[current];
        window.history.replaceState({}, '', crypted);
        return crypted;
      }
      // If the current path is not in our encrypted map, but matches an encrypted path, keep it
      if (encryptedToRoute[current]) {
        return current;
      }
      // Otherwise, fallback
      return current;
    }
    return initialPath;
  });

  React.useEffect(() => {
    // Listen for browser navigation (back/forward)
    const onPopState = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const router = React.useMemo(() => {
    return {
      pathname,
      searchParams: new URLSearchParams(),
      navigate: (path: string | URL) => {
        // Map real route to encrypted path for browser
        let newPath = String(path);
        if (routeToEncrypted[newPath]) {
          newPath = routeToEncrypted[newPath];
        }
        setPathname(newPath);
        if (window && window.history && window.location.pathname !== newPath) {
          window.history.pushState({}, '', newPath);
        }
      },
    };
  }, [pathname]);

  return router;
}

const DashboardPage = () => <Dashboard />;

// Create a wrapper component that will force remount when type changes
const PurchaseWrapper = ({ type }: { type: string }) => {
  // Use a key based on the type to force remount
  return <GPurchase key={type} Type={type} />;
};

const InvoiceWrapper = ({ type }: { type: string }) => {
  // Use a key based on the type to force remount
  return <GNew_I />;
};

const SalesReportsWrapper = () => {
  // Use a key based on the type to force remount
  return <SalesReports />;
};


const OtherReportsWrapper = () => {
  // Use a key based on the type to force remount
  return <InvoiceTypeSelector />;
};


const GInventoryWrapper = ({ type }: { type: string }) => {
  // Use a key based on the type to force remount
  return <GInventory key={type} Type={type} />;
};

const DInventoryWrapper = ({ type }: { type: string }) => {
  // Use a key based on the type to force remount
  return <DInventory key={type} Type={type} />;
};

const WInventoryWrapper = ({ type }: { type: string }) => {
  // Use a key based on the type to force remount
  return <WInventory key={type} Type={type} />;
};

const BInventoryWrapper = ({ type }: { type: string }) => {
  // Use a key based on the type to force remount
  return <BInventory key={type} Type={type} />;
};


function getPageComponent(pathname: string) {
  // Map encrypted path to real route
  const realPath = encryptedToRoute[pathname] || pathname;
  switch (realPath) {

    case '/setting/generals':
      return <GeneralSettings />;
    case '/dashboard':
      return <DashboardPage />;
    case '/home':
      return <DashboardPage />;
    case '/setting/hrSetting':
      return <HRSettings />;
    case '/setting/finSetting':
      return <FinanceSettings />;
    case '/setting/spySetting':
      return <SCSSettings />;
    case '/receiveProducts/goldPurchase':
      return <PurchaseWrapper type="gold" />;
    case '/receiveProducts/diamondPurshase':
      return <PurchaseWrapper type="diamond" />;
    case '/receiveProducts/watchesPurchase':
      return <PurchaseWrapper type="watches" />;
    case '/receiveProducts/boxesPurchase':
      return <PurchaseWrapper type="boxes" />;
    case '/invoice/goldInvoice':
      return <InvoiceWrapper type="gold" />;
    case '/invoice/salesReports':
      return <SalesReportsWrapper />;
    case '/invoice/otherReports':
      return <OtherReportsWrapper />;
    case '/invoice/customersReports':
      return <CustomersReports />;



    case '/inventory/goldinventory':
      return <GInventoryWrapper type="gold" />;
    case '/inventory/diamondinventory':
      return <DInventoryWrapper type="diamond" />;
    case '/inventory/watchesinventory':
      return <WInventoryWrapper type="watches" />;
    case '/inventory/boxesinventory':
      return <BInventoryWrapper type="boxes" />;
    case '/purchaseProducts/OPurchase':
      return <OPurchase />;
    case '/purchaseProducts/DOPurchase':
      return <DOPurchase />;
    case '/purchaseProducts/WOPurchase':
      return <Wpage />;

    case '/cashBook/cashdeposit':
      return <Revenue />;


    case '/cashBook/cashexpenses':
      return <Expenses />;

    case '/cashBook/cashbookReports':
      return <CashBookReports />;
    default:
      return <P404 />;
  }
}

export default function Home(props: any) {
  const { window } = props;
  const [initialPath] = React.useState(() => {
    return typeof window !== 'undefined' ? window.location?.pathname || '/dashboard' : '/dashboard';
  });

  const router = useDemoRouter(initialPath);
  const demoWindow = typeof window !== 'undefined' ? window : undefined;

  // Use system preference for initial theme if not set in localStorage
  const [mode, setMode] = React.useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('themeMode');
      if (savedMode === 'dark' || savedMode === 'light') {
        return savedMode as 'dark' | 'light';
      }
      // Use system preference if no saved mode
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    }
    return 'light';
  });

  const [snackbarOpen, setSnackbarOpen] = React.useState(false);

  const colorMode = React.useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => {
          const newMode = prevMode === 'light' ? 'dark' : 'light';
          localStorage.setItem('themeMode', newMode);
          setSnackbarOpen(true);
          return newMode;
        });
      },
    }),
    []
  );

  const theme = React.useMemo(
    () => createTheme(getDesignTokens(mode)),
    [mode]
  );

  const handleCloseSnackbar = (
    event?: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };



  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear(); // or remove specific auth token
    navigate("/", { replace: true }); // or something like window.location...

  };

  // --- Set tab title based on selected navigation item ---
  React.useEffect(() => {
    // Helper to find title from NAVIGATION by pathname
    function findTitle(nav: Navigation, path: string): string | null {
      for (const item of nav) {
        if ('segment' in item && item.segment && path.includes(item.segment)) {
          return item.title ?? null;
        }
        if ('children' in item && item.children) {
          const childTitle = findTitle(item.children as Navigation, path);
          if (childTitle) return childTitle;
        }
      }
      return null;
    }
    // Map encrypted path to real route
    const realPath = encryptedToRoute[router.pathname] || router.pathname;
    const title = findTitle(NAVIGATION, realPath) || 'Gaja Sys 1.0';
    document.title = title;
  }, [router.pathname]);

  return (
    <AppProvider
      navigation={NAVIGATION}
      router={router}
      theme={theme}
      window={demoWindow}
      branding={{
        logo: (
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%'
          }}>
            <Logo />
          </Box>
        ),
        title: 'Gaja Sys 1.0',
        homeUrl: '/home',
      }}
    >
      <DashboardLayout
        sx={{
          '& .MuiContainer-root': {
            maxWidth: '100%',
          },
          '& .MuiDrawer-root': {
            position: 'relative',
            height: '100vh',
          },
          '& .MuiDrawer-paper': {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          },
        }}
        navigation={NAVIGATION}
        slots={{
          sidebarFooter: () => (
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: 2,
                borderTop: `1px solid ${theme.palette.divider}`,
                display: 'grid',
                justifyContent: 'space-between'
              }}
            >
              <IconButton
                onClick={colorMode.toggleColorMode}
                color="inherit"
                aria-label="Toggle theme"
                sx={{ mr: 1 }}
              >
                {mode === 'dark' ? (
                  <Brightness7Icon sx={{ color: 'text.primary' }} />
                ) : (
                  <Brightness4Icon sx={{ color: 'text.primary' }} />
                )}
              </IconButton>
              <IconButton
                onClick={handleLogout}
                color="inherit"
                aria-label="Toggle theme"
                sx={{ mr: 1 }}
              >
                <Logout sx={{ color: 'text.primary' }} />

              </IconButton>
            </Box>
          ),
        }}
      >
        <PageContainer title=''>
          {getPageComponent(router.pathname)}
        </PageContainer>
      </DashboardLayout>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity="success"
          sx={{ width: '100%' }}
          elevation={6}
          variant="filled"
        >
          Current theme: {mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
        </Alert>
      </Snackbar>
    </AppProvider>
  );
}