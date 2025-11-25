/* eslint-disable react/jsx-pascal-case */
/* eslint-disable react-hooks/exhaustive-deps */
// src/pages/Home.tsx
import * as React from "react";
import {
  createTheme,
  ThemeProvider,
  StyledEngineProvider,
} from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import {
  AppProvider,
  Navigation,
  Router,
  DashboardLayout,
} from "@toolpad/core";
import {
  Box,
  IconButton,
  Snackbar,
  Alert,
  Tooltip,
  CssBaseline,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";

import DashboardIcon from "@mui/icons-material/Dashboard";
import SettingsIcon from "@mui/icons-material/Settings";
import Diversity3Icon from "@mui/icons-material/Diversity3";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import TuneIcon from "@mui/icons-material/Tune";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import CategoryIcon from "@mui/icons-material/Category";
import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import GradeIcon from "@mui/icons-material/Grade";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import DevicesOtherIcon from "@mui/icons-material/DevicesOther";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import DiamondIcon from "@mui/icons-material/Diamond";
import WatchIcon from "@mui/icons-material/Watch";
import {
  CurrencyExchange,
  GifBox,
  GridGoldenratio,
  History,
  Inventory2,
  Logout,
  Paid,
  PaidTwoTone,
  Person2Outlined,
  Sell,
  TransitEnterexit,
} from "@mui/icons-material";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import ChatIcon from "@mui/icons-material/Chat";

import Logo from "../ui-component/Logo2";
import LanguageSwitcher from "../components/LanguageSwitcher";
import ChatbotWidget from "../components/ChatbotWidget";
import { hasRole } from "../Setup/getUserInfo";
import { useAuth } from "../contexts/AuthContext";
import axios from "../api";

import Dashboard from "./Dashboard/Dashboard";
import P404 from "./Dashboard/P404";
import GeneralSettings from "../Setup/GS/GeneralSettings";
import HRSettings from "../Setup/HR/HRSettings";
import FinanceSettings from "../Setup/Finance/FinanceSettings";
import SCSSettings from "../Setup/SCS/SCSSettings";
import GPurchase from "../Purchase/Types/GPurchase";
import OPurchase from "../Purchase/OriginalAchat/OPurchase";
import Dpage from "../Purchase/OriginalAchat/DOPurchase/Dpage";
import Wpage from "../Purchase/OriginalAchat/WOPurchase/Wpage";
import GInventory from "../Inventory/GInventory";
import DInventory from "../Inventory/DInventory";
import WInventory from "../Inventory/WInventory";
import VacationsPage from "../HR/Compensation/VacationsPage";
import TimeSheetsPage from "../HR/Compensation/TimeSheetsPage";
import PayrollPage from "../HR/Compensation/PayrollPage";
import BInventory from "../Inventory/BInventory";
import GNew_I from "../Invoices/ListCardInvoice/Gold Invoices/GNew_I";
import InvoiceTypeSelector from "../Invoices/InvoiceTypeSelector";
import SalesReports from "../Invoices/SalesReports";
import CustomersReports from "../Invoices/CustomersReports";
import CustomerProfile from "../Invoices/CustomerProfile";
import Revenue from "../Finance/Revenue";
import Expenses from "../Finance/Expenses";
import CashBookReports from "../Finance/CashBookReports";

// Emotion (LTR-only cache)
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";

import { DYNAMIC_PREFIXES, decodeEmployeeToken, decodeClientToken, decodeSellerToken } from "../utils/routeCrypto";
import SellerReports from "../Invoices/SellerReports";
import EmployeeProfile from "../HR/Setting/EmployeeProfile";
import CommissionsPage from "../HR/Setting/CommissionsPage";

// Resolve-focused CustomerProfile wrapper for static route
function CustomerProfileRoute() {
  const [resolvedId, setResolvedId] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        let id: number | null = null;
        try {
          const raw = typeof window !== "undefined" ? localStorage.getItem("customerFocusId") : null;
          if (raw !== null && raw !== "") id = Number(raw);
        } catch {}
        if (!id || Number.isNaN(id)) {
          // try resolve from hint (name/phone)
          let hintName = "";
          let hintPhone = "";
          try {
            hintName = localStorage.getItem("customerFocusName") || "";
            hintPhone = localStorage.getItem("customerFocusPhone") || "";
          } catch {}
          if (hintName || hintPhone) {
            const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
            try {
              const res = await axios.get(`/customers/all`, {
                headers: { Authorization: token ? `Bearer ${token}` : undefined },
              });
              const list = Array.isArray(res.data) ? res.data : [];
              const byTel = hintPhone ? list.find((c: any) => String(c.tel_client) === String(hintPhone)) : null;
              const byName = !byTel && hintName ? list.find((c: any) => String(c.client_name) === String(hintName)) : null;
              const found = byTel || byName || null;
              if (found) {
                id = Number(found.id_client || found.Id_client || found.id);
                try {
                  if (typeof window !== "undefined" && id) {
                    localStorage.setItem("customerFocusId", String(id));
                  }
                } catch {}
              }
            } catch {}
          }
        }
        if (mounted) setResolvedId(id && !Number.isNaN(id) ? id : null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);
  if (loading) return <div />;
  if (!resolvedId) return <P404 />;
  return <CustomerProfile id={resolvedId} />;
}

// ---------- Theme augmentation ----------
declare module "@mui/material/styles" {
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
    gaja?: Partial<Palette["gaja"]>;
  }
}

type _ProfileWithId = React.ComponentType<{ id?: number }>;

// Pantone-inspired accents
const PANTONE_BLUE = "#0057B8" as const; // Reflex Blue-ish
const PANTONE_TAN = "#B7A27D" as const; // provided

const getDesignTokens = (mode: "light" | "dark") => ({
  palette: {
    mode,
    gaja: (() => {
      const accent = mode === "light" ? "#4b5563" : "#9e9e9e";
      return {
        50: "#334d68",
        100: accent,
        200: "#334d68",
        300: accent,
        400: accent,
        500: accent,
        600: "#334d68",
        700: accent,
        800: "#334d68",
        900: accent,
      } as any;
    })(),
    ...(mode === "light"
      ? {
          primary: { main: PANTONE_BLUE },
          secondary: { main: PANTONE_TAN },
          background: { default: "#f5f5f5", paper: "#ffffff" },
          text: {
            primary: "rgba(0, 0, 0, 0.87)",
            secondary: "rgba(0, 0, 0, 0.6)",
          },
        }
      : {
          primary: { main: "#7FB3E5" },
          secondary: { main: "#D6C5A5" },
          background: { default: "#0f1216", paper: "#151922" },
          text: { primary: "#e6e6e6", secondary: "#bdbdbd" },
        }),
  },
  typography: { fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' },
});

// ---------- Change POS (PS selection dropdown) ----------
type ChangePosProps = { currentPosName?: string };

function ChangePos(_props: ChangePosProps) {
  const { t } = useTranslation();
  const auth = useAuth();

  const [openPs, setOpenPs] = React.useState(false);
  const [psValue, setPsValue] = React.useState<string>(() => {
    try {
      const u = localStorage.getItem("user");
      if (u) {
        const obj = JSON.parse(u);
        return obj?.ps ?? "";
      }
    } catch {}
    return "";
  });
  const [posOptions, setPosOptions] = React.useState<any[]>([]);

  // current stored user id used for special-case UI grants (e.g., id 68)
  const currentStoredUserId = React.useMemo(() => {
    try {
      const raw =
        typeof window !== "undefined" ? localStorage.getItem("user") : null;
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return obj?.Cuser ?? obj?.id ?? obj?.id_user ?? obj?.Id_user ?? null;
    } catch {
      return null;
    }
  }, []);

  const [selectedId, setSelectedId] = React.useState<number>(() => {
    try {
      const saved =
        typeof window !== "undefined"
          ? localStorage.getItem("selectedPs")
          : null;
      if (saved !== null && saved !== "") return Number(saved);
    } catch {}
    return -1;
  });

  // Find the current POS name from posOptions using psValue
  const currentPosName = React.useMemo(() => {
    if (psValue === "" || psValue === "-1")
      return t("analytics.posAll") || "All Stores";
    const found = posOptions.find(
      (p: any) => String(p.Id_point) === String(psValue)
    );
    return found?.name_point || psValue;
  }, [psValue, posOptions, t]);

  const handleOpenPs = () => setOpenPs(true);
  const handleClosePs = () => setOpenPs(false);

  const handleSavePs = () => {
    try {
      // persist selected POS id (use '' for All / -1)
      const rawValue = selectedId !== undefined ? selectedId : psValue || "";
      const valueToSave = Number(rawValue) === -1 ? "" : rawValue;

      if (auth && typeof (auth as any).updatePs === "function") {
        (auth as any).updatePs(valueToSave);
      }

      // update or create localStorage.user.ps
      try {
        const u = localStorage.getItem("user");
        if (u) {
          const obj = JSON.parse(u);
          obj.ps = valueToSave;
          localStorage.setItem("user", JSON.stringify(obj));
        } else {
          localStorage.setItem("user", JSON.stringify({ ps: valueToSave }));
        }
      } catch (e) {
        // fallback: set minimal user object
        try {
          localStorage.setItem("user", JSON.stringify({ ps: valueToSave }));
        } catch {}
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("selectedPs", String(rawValue ?? ""));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to save PS", e);
    }
    handleClosePs();

    // Refresh the page so dashboards pick up the new PS immediately
    try {
      if (typeof window !== "undefined") {
        setTimeout(() => window.location.reload(), 120);
      }
    } catch {}
  };

  React.useEffect(() => {
    let mounted = true;
    const apiIp = process.env.REACT_APP_API_IP;
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
    const headers = {
      Authorization: token ? `Bearer ${token}` : undefined,
    } as any;

    const fetchPOS = async () => {
      try {
        const res = await axios.get(`${apiIp}/ps/all`, { headers });
        if (mounted && Array.isArray(res?.data)) {
          setPosOptions(res.data);
        }
      } catch (e) {
        // ignore
      }
    };
    fetchPOS();
    return () => {
      mounted = false;
    };
  }, []);

  // Real-time subscription for privilege changes (kept from original ChangePos)
  React.useEffect(() => {
    const sseUrl = process.env.REACT_APP_USERS_SSE_URL || null;
    const wsUrl = process.env.REACT_APP_USERS_WS_URL || null;
    const apiIp = process.env.REACT_APP_API_IP || "";

    const inferredSse = !sseUrl && apiIp ? `${apiIp}/events/users` : sseUrl;
    const endpoint = inferredSse || wsUrl;
    if (!endpoint) return undefined;

    let es: EventSource | null = null;
    let ws: WebSocket | null = null;
    let closed = false;

    const parseStoredCurrentId = () => {
      try {
        const raw = localStorage.getItem("user");
        if (!raw) return null;
        const obj = JSON.parse(raw);
        return obj?.Cuser ?? obj?.id ?? obj?.id_user ?? obj?.Id_user ?? null;
      } catch {
        return null;
      }
    };

    const handlePayload = (payloadRaw: any) => {
      try {
        const payload =
          typeof payloadRaw === "string" ? JSON.parse(payloadRaw) : payloadRaw;
        const currentId = parseStoredCurrentId();
        const userId =
          payload?.id_user ??
          payload?.Id_user ??
          payload?.Cuser ??
          payload?.user?.id_user ??
          payload?.user?.Id_user ??
          payload?.user?.Cuser ??
          payload?.userId ??
          payload?.user_id ??
          null;
        const remotePrv =
          payload?.Prvilege ??
          payload?.Roles ??
          payload?.roles ??
          payload?.action ??
          payload?.privilege ??
          null;
        if (userId && String(userId) === String(currentId) && remotePrv) {
          if (auth && typeof (auth as any).setPrivilege === "function") {
            try {
              (auth as any).setPrivilege(remotePrv);
            } catch {}
          } else if (typeof window !== "undefined") {
            // fallback: write and refresh
            try {
              const raw = localStorage.getItem("user");
              const obj = raw ? JSON.parse(raw) : {};
              const updated = { ...obj, Prvilege: remotePrv };
              localStorage.setItem("user", JSON.stringify(updated));
              try {
                if (typeof (auth as any)?.refreshUser === "function")
                  (auth as any).refreshUser();
              } catch {}
            } catch {}
          }
        }
      } catch {
        // ignore malformed messages
      }
    };

    if (inferredSse) {
      try {
        es = new EventSource(inferredSse);
        es.onmessage = (evt) => {
          if (!closed) handlePayload(evt.data);
        };
        es.onerror = () => {
          // no-op
        };
      } catch (e) {
        // ignore
      }
    } else if (wsUrl) {
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (evt) => {
          if (!closed) handlePayload(evt.data);
        };
        ws.onerror = () => {
          // ignore
        };
      } catch (e) {
        // ignore
      }
    }

    return () => {
      closed = true;
      try {
        if (es) es.close();
      } catch {}
      try {
        if (ws) ws.close();
      } catch {}
    };
  }, [auth]);

  // Determine if user is ROLE_ADMIN
  let isAdmin = false;
  try {
    const u = localStorage.getItem("user");
    if (u) {
      const obj = JSON.parse(u);
      const roles =
        obj?.Prvilege || obj?.roles || obj?.Roles || obj?.role || "";
      if (Array.isArray(roles)) {
        isAdmin = roles.some((r: any) =>
          String(r).toUpperCase().includes("ROLE_ADMIN")
        );
      } else if (typeof roles === "string") {
        isAdmin = roles.toUpperCase().includes("ROLE_ADMIN");
      }
    }
  } catch {}

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        onClick={handleOpenPs}
        sx={{
          color: "inherit",
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          "& .gaja-spin": {
            animation: "gaja-spin 1500ms linear infinite",
            transformOrigin: "50% 50%",
          },
          "&:hover .gaja-spin": {
            animationDuration: "900ms",
          },
          "@keyframes gaja-spin": {
            "0%": { transform: "rotate(0deg) scale(1)" },
            "50%": { transform: "rotate(180deg) scale(1.04)" },
            "100%": { transform: "rotate(360deg) scale(1)" },
          },
        }}
        startIcon={
          <Box
            component="span"
            sx={{ display: "inline-flex" }}
          >
            {/* <Inventory2 /> */}
          </Box>
        }
        aria-label={t("Change POS") || "Change POS"}
        disabled={!(isAdmin || String(currentStoredUserId) === "68")}
      >
        {`${t("Change POS") || "Change POS"} (${currentPosName})`}
      </Button>

      <Dialog open={openPs} onClose={handleClosePs} fullWidth maxWidth="sm">
        <DialogTitle>
          {t("Change Point of Sale") || "Change Point of Sale"}
        </DialogTitle>
        <DialogContent>
          <Autocomplete
            options={posOptions}
            getOptionLabel={(o: any) =>
              o?.name_point || String(o?.Id_point ?? "")
            }
            value={posOptions.find((p) => p?.Id_point === selectedId) || null}
            onChange={(_e, value) => {
              const valId = value ? Number(value.Id_point) : -1;
              setSelectedId(valId);
              if (valId !== -1) setPsValue(String(valId));
              else setPsValue("");
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t("analytics.posSelect") || "Point of Sale"}
                margin="dense"
                fullWidth
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePs}>
            {t("common.cancel") || "Cancel"}
          </Button>
          <Button onClick={handleSavePs} variant="contained">
            {t("Change")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ---------- Encrypted routing ----------
function generateRandomPath() {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "/";
  for (let i = 0; i < 32; i++)
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

const realRoutes = [
  "/dashboard",
  "/home",
  "/setting/generals",
  "/setting/hrSetting",
  "/setting/finSetting",
  "/setting/spySetting",
  "/receiveProducts/goldPurchase",
  "/receiveProducts/diamondPurshase",
  "/receiveProducts/watchesPurchase",
  "/receiveProducts/boxesPurchase",
  "/invoice/goldInvoice",
  "/invoice/salesReports",
  "/invoice/otherReports",
  "/invoice/customersReports",
  "/invoice/sellerReports",
  "/invoice/commissions",
  "/inventory/diamondinventory",
  "/inventory/watchesinventory",
  "/inventory/boxesinventory",
  "/purchaseProducts/OPurchase",
  "/purchaseProducts/DOPurchase",
  "/purchaseProducts/WOPurchase",
  "/cashBook/cashdeposit",
  "/cashBook/cashexpenses",
  "/cashBook/cashbookReports",
  "/humanResources/regulationscompensations/vacations",
  "/invoice/customerProfile",
  "/humanResources/regulationscompensations/timesheets",
  "/humanResources/regulationscompensations/payroll",
];

let routeToEncrypted: Record<string, string> = {};
let encryptedToRoute: Record<string, string> = {};

const mappingKey = "routeCryptMappingV1";
const savedMapping =
  typeof window !== "undefined" ? localStorage.getItem(mappingKey) : null;
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
  if (typeof window !== "undefined") {
    localStorage.setItem(
      mappingKey,
      JSON.stringify({ routeToEncrypted, encryptedToRoute })
    );
  }
}

function useDemoRouter(initialPath: string): Router {
  const [pathname, setPathname] = React.useState(() => {
    if (typeof window !== "undefined" && window.location?.pathname) {
      const current = window.location.pathname;

      // Keep dynamic prefixes AS-IS
      if (DYNAMIC_PREFIXES.some((p) => current.startsWith(p))) {
        return current;
      }

      // If current is a real route, rewrite to encrypted
      if (routeToEncrypted[current]) {
        const crypted = routeToEncrypted[current];
        window.history.replaceState({}, "", crypted);
        return crypted;
      }

      // If current already looks encrypted, keep it
      if (encryptedToRoute[current]) return current;

      // Otherwise, keep whatever was there (404 handler will catch)
      return current;
    }
    return initialPath;
  });

  React.useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return React.useMemo(
    () => ({
      pathname,
      searchParams: new URLSearchParams(),
      navigate: (path: string | URL) => {
        let newPath = String(path);

        // SKIP encryption for dynamic prefixes like /p/
        const isDynamic = DYNAMIC_PREFIXES.some((p) => newPath.startsWith(p));
        if (!isDynamic && routeToEncrypted[newPath]) {
          newPath = routeToEncrypted[newPath];
        }

        setPathname(newPath);
        if (
          typeof window !== "undefined" &&
          window.history &&
          window.location.pathname !== newPath
        ) {
          window.history.pushState({}, "", newPath);
        }
      },
    }),
    [pathname]
  );
}

// ---------- Page wrappers ----------
const DashboardPage = () => <Dashboard />;
const PurchaseWrapper = ({ type }: { type: string }) => (
  <GPurchase key={type} Type={type} />
);
const InvoiceWrapper = ({ type }: { type: string }) => <GNew_I />;
const SalesReportsWrapper = () => <SalesReports />;
const OtherReportsWrapper = () => <InvoiceTypeSelector />;
const GInventoryWrapper = ({ type }: { type: string }) => (
  <GInventory key={type} Type={type} />
);
const DInventoryWrapper = ({ type }: { type: string }) => (
  <DInventory key={type} Type={type} />
);
const WInventoryWrapper = ({ type }: { type: string }) => (
  <WInventory key={type} Type={type} />
);
const BInventoryWrapper = ({ type }: { type: string }) => (
  <BInventory key={type} Type={type} />
);

const ProfileWithId = EmployeeProfile as unknown as _ProfileWithId;

function getPageComponent(pathname: string) {
  // 1) Handle dynamic /p/<token> FIRST
  if (pathname.startsWith("/p/")) {
    const token = pathname.slice(3);
    const id = decodeEmployeeToken(token);
    if (!id) return <P404 />;
    return <ProfileWithId id={id} />;
  }

  // 1b) Handle dynamic /c/<token> for client (customer) profile redirect (Timesheets-like)
  if (pathname.startsWith("/c/")) {
    const token = pathname.slice(3);
    const id = decodeClientToken(token);
    // Stash focused id for any nested pages to read and render a profile shell
    try {
      if (id && typeof window !== "undefined") {
        localStorage.setItem("customerFocusId", String(id));
      }
    } catch {}
    if (!id) return <P404 />;
    return <CustomerProfile id={id} />;
  }

  // 1c) Handle dynamic /s/<token> for seller reports redirect
  if (pathname.startsWith("/s/")) {
    const token = pathname.slice(3);
    const id = decodeSellerToken(token);
    try {
      if (id && typeof window !== "undefined") {
        localStorage.setItem("sellerFocusId", String(id));
      }
    } catch {}
    return <SellerReports />;
  }

  const realPath = encryptedToRoute[pathname] || pathname;
  switch (realPath) {
    case "/setting/generals":
      return <GeneralSettings />;
    case "/dashboard":
      return <DashboardPage />;
    case "/home":
      return <DashboardPage />;
    case "/setting/hrSetting":
      return <HRSettings />;
    case "/setting/finSetting":
      return <FinanceSettings />;
    case "/setting/spySetting":
      return <SCSSettings />;
    case "/receiveProducts/goldPurchase":
      return <PurchaseWrapper type="gold" />;
    case "/receiveProducts/diamondPurshase":
      return <PurchaseWrapper type="diamond" />;
    case "/receiveProducts/watchesPurchase":
      return <PurchaseWrapper type="watches" />;
    case "/receiveProducts/boxesPurchase":
      return <PurchaseWrapper type="boxes" />;
    case "/invoice/goldInvoice":
      return <InvoiceWrapper type="gold" />;
    case "/invoice/salesReports":
      return <SalesReportsWrapper />;
    case "/invoice/otherReports":
      return <OtherReportsWrapper />;
    case "/invoice/customersReports":
      return <CustomersReports />;
    case "/invoice/sellerReports":
      return <SellerReports />;
    case "/humanResources/regulationscompensations/commissions":
      return <CommissionsPage />;
    case "/inventory/goldinventory":
      return <GInventoryWrapper type="gold" />;
    case "/inventory/diamondinventory":
      return <DInventoryWrapper type="diamond" />;
    case "/inventory/watchesinventory":
      return <WInventoryWrapper type="watches" />;
    case "/inventory/boxesinventory":
      return <BInventoryWrapper type="boxes" />;
    case "/purchaseProducts/OPurchase":
      return <OPurchase />;
    case "/purchaseProducts/DOPurchase":
      return <Dpage />;
    case "/purchaseProducts/WOPurchase":
      return <Wpage />;
    case "/cashBook/cashdeposit":
      return <Revenue />;
    case "/cashBook/cashexpenses":
      return <Expenses />;
    case "/cashBook/cashbookReports":
      return <CashBookReports />;
    case "/humanResources/regulationscompensations/vacations":
      return <VacationsPage />;
    case "/humanResources/regulationscompensations/timesheets":
      return <TimeSheetsPage />;
    case "/humanResources/regulationscompensations/payroll":
      return <PayrollPage />;
    case "/invoice/customerProfile":
      return <CustomerProfileRoute />;
    default:
      return <P404 />;
  }
}

// ---------- Navigation ----------
function buildNavigation(
  t: (k: string) => string,
  accent: string,
  visibility: {
    showGeneralSettings: boolean;
    showOpurchasde: boolean;
    showReceiveProducts: boolean;
    showInvoices: boolean;
    showInventory: boolean;
    showcashbook: boolean;
    showHR: boolean;
    showFin: boolean;
    showSales: boolean;
  }
): Navigation {
  const iconSx = {
    sx: {
      color: accent,
    },
  } as const;

  return [
    { kind: "header", title: t("nav.headers.main") },
    {
      segment: "dashboard",
      title: t("nav.dashboard"),
      icon: <DashboardIcon {...iconSx} />,
    },
    { kind: "divider" },
    { kind: "header", title: t("nav.headers.actions") },
    {
      segment: "setting",
      title: t("nav.setting.root"),
      icon: <TuneIcon {...iconSx} />,
      children: [
        visibility.showGeneralSettings && {
          segment: "generals",
          title: t("nav.setting.general"),
          icon: <SettingsIcon {...iconSx} />,
        },
        visibility.showHR && {
          segment: "hrSetting",
          title: t("nav.setting.hr"),
          icon: <PeopleAltIcon {...iconSx} />,
        },
        visibility.showFin && {
          segment: "finSetting",
          title: t("nav.setting.finance"),
          icon: <MonetizationOnIcon {...iconSx} />,
        },
        visibility.showSales && {
          segment: "spySetting",
          title: t("nav.setting.sales"),
          icon: <WarehouseIcon {...iconSx} />,
        },
      ].filter(Boolean) as any[],
    },
    ...(visibility.showOpurchasde
      ? [
          {
            segment: "purchaseProducts",
            title: t("nav.purchase.root"),
            icon: <ShoppingCartIcon {...iconSx} />,
            children: [
              {
                segment: "OPurchase",
                title: t("nav.purchase.gold"),
                icon: <EmojiEventsIcon {...iconSx} />,
              },
              {
                segment: "DOPurchase",
                title: t("nav.purchase.diamond"),
                icon: <DiamondIcon {...iconSx} />,
              },
              {
                segment: "WOPurchase",
                title: t("nav.purchase.watches"),
                icon: <WatchIcon {...iconSx} />,
              },
            ],
          },
        ]
      : []),
    ...(visibility.showReceiveProducts
      ? [
          {
            segment: "receiveProducts",
            title: t("nav.receive.root"),
            icon: <ShoppingCartIcon {...iconSx} />,
            children: [
              {
                segment: "goldPurchase",
                title: t("nav.receive.gold"),
                icon: <EmojiEventsIcon {...iconSx} />,
              },
              {
                segment: "diamondPurshase",
                title: t("nav.receive.diamond"),
                icon: <DiamondIcon {...iconSx} />,
              },
              {
                segment: "watchesPurchase",
                title: t("nav.receive.watches"),
                icon: <WatchIcon {...iconSx} />,
              },
              {
                segment: "boxesPurchase",
                title: t("nav.receive.boxes"),
                icon: <GifBox {...iconSx} />,
              },
            ],
          },
        ]
      : []),
    ...(visibility.showInvoices
      ? [
          {
            segment: "invoice",
            title: t("nav.invoice.root"),
            icon: <Paid {...iconSx} />,
            children: [
              {
                segment: "goldInvoice",
                title: t("nav.invoice.createNew"),
                icon: <GridGoldenratio {...iconSx} />,
              },
              {
                segment: "salesReports",
                title: t("nav.invoice.salesReports"),
                icon: <History {...iconSx} />,
              },
              {
                segment: "otherReports",
                title: t("nav.invoice.otherReports"),
                icon: <LocalOfferIcon {...iconSx} />,
              },
              {
                segment: "customersReports",
                title: t("nav.invoice.customersReports"),
                icon: <Person2Outlined {...iconSx} />,
              },
              {
                segment: "sellerReports",
                title: t("nav.invoice.sellerReports"),
                icon: <TrendingUpIcon {...iconSx} />,
              },
            ],
          },
        ]
      : []),
    ...(visibility.showInventory
      ? [
          {
            segment: "inventory",
            title: t("nav.inventory.root"),
            icon: <Inventory2 {...iconSx} />,
            children: [
              {
                segment: "goldinventory",
                title: t("nav.inventory.gold"),
                icon: <EmojiEventsIcon {...iconSx} />,
              },
              {
                segment: "diamondinventory",
                title: t("nav.inventory.diamond"),
                icon: <DiamondIcon {...iconSx} />,
              },
              {
                segment: "watchesinventory",
                title: t("nav.inventory.watches"),
                icon: <WatchIcon {...iconSx} />,
              },
              {
                segment: "boxesinventory",
                title: t("nav.inventory.boxes"),
                icon: <GifBox {...iconSx} />,
              },
            ],
          },
        ]
      : []),
    ...(visibility.showcashbook
      ? [
          {
            segment: "cashBook",
            title: t("nav.cashbook.root"),
            icon: <CurrencyExchange {...iconSx} />,
            children: [
              {
                segment: "cashdeposit",
                title: t("nav.cashbook.deposit"),
                icon: <TransitEnterexit {...iconSx} />,
              },
              {
                segment: "cashexpenses",
                title: t("nav.cashbook.expenses"),
                icon: <PaidTwoTone {...iconSx} />,
              },
              {
                segment: "Sell​currency",
                title: t("nav.cashbook.sellCurrency"),
                icon: <Sell {...iconSx} />,
              },
              {
                segment: "buycurrency",
                title: t("nav.cashbook.buyCurrency"),
                icon: <Sell {...iconSx} />,
              },
              {
                segment: "cashbookReports",
                title: t("nav.cashbook.reports"),
                icon: <History {...iconSx} />,
              },
            ],
          },
        ]
      : []),
    ...(visibility.showHR
      ? [
          {
            segment: "humanResources",
            title: t("nav.hr.root"),
            icon: <Diversity3Icon {...iconSx} />,
            children: [
              {
                segment: "regulationscompensations",
                title: t("nav.hr.compensations.root"),
                icon: <CategoryIcon {...iconSx} />,
                children: [
                  {
                    segment: "payroll",
                    title: t("nav.hr.compensations.payroll"),
                    icon: <PaidTwoTone {...iconSx} />,
                  },
                  {
                    segment: "vacations",
                    title: t("nav.hr.compensations.vacations"),
                    icon: <FlightTakeoffIcon {...iconSx} />,
                  },
                  {
                    segment: "timesheets",
                    title: t("nav.hr.compensations.timesheets"),
                    icon: <AccessTimeIcon {...iconSx} />,
                  },
                  {
                    segment: "commissions",
                    title: t("nav.invoice.commissions") || "Commissions",
                    icon: <GradeIcon {...iconSx} />,
                  },
                  {
                    segment: "promotions",
                    title: t("nav.hr.compensations.promotions"),
                    icon: <TrendingUpIcon {...iconSx} />,
                  },
                  {
                    segment: "wletter",
                    title: t("nav.hr.compensations.warningLetter"),
                    icon: <ReportProblemIcon {...iconSx} />,
                  },
                  {
                    segment: "productivity",
                    title: t("nav.hr.compensations.productivity"),
                    icon: <TrendingFlatIcon {...iconSx} />,
                  },
                  {
                    segment: "transfer",
                    title: t("nav.hr.compensations.transfer"),
                    icon: <CompareArrowsIcon {...iconSx} />,
                  },
                  {
                    segment: "evaluation",
                    title: t("nav.hr.compensations.evaluation"),
                    icon: <GradeIcon {...iconSx} />,
                  },
                  {
                    segment: "missions",
                    title: t("nav.hr.compensations.missions"),
                    icon: <AssignmentTurnedInIcon {...iconSx} />,
                  },
                  {
                    segment: "lequipement",
                    title: t("nav.hr.compensations.loanEquipment"),
                    icon: <DevicesOtherIcon {...iconSx} />,
                  },
                  {
                    segment: "delegation",
                    title: t("nav.hr.compensations.delegation"),
                    icon: <PeopleAltIcon {...iconSx} />,
                  },
                ],
              },
            ],
          },
        ]
      : []),
  ];
}

// ---------- LTR cache creator ----------
function createEmotionCacheLTR() {
  return createCache({
    key: "mui-ltr",
    prepend: true,
  });
}

// ---------- Component ----------
export default function Home(props: any) {
  const { t } = useTranslation();

  // Lock to LTR
  const dir: "ltr" = "ltr";

  const [mode, setMode] = React.useState<"light" | "dark">(() => {
    try {
      const saved =
        typeof window !== "undefined"
          ? (localStorage.getItem("themeMode") as "light" | "dark" | null)
          : null;
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return "light";
  });

  // Build theme with **fixed LTR** direction
  const appTheme: Theme = React.useMemo(() => {
    const tokens = getDesignTokens(mode) as any;
    const base = createTheme({ direction: dir, ...tokens }) as any;
    base.palette.gaja = tokens.palette?.gaja;
    return base as Theme;
  }, [mode]);

  const { window } = props;
  const [initialPath] = React.useState(() =>
    typeof window !== "undefined"
      ? window.location?.pathname || "/dashboard"
      : "/dashboard"
  );
  const router = useDemoRouter(initialPath);
  const location = useLocation();
  const demoWindow = typeof window !== "undefined" ? window : undefined;

  const [snackbarOpen, setSnackbarOpen] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);

  // Sync Toolpad router with BrowserRouter so navigating to /p/<token> opens profile instantly
  React.useEffect(() => {
    const path = location.pathname;
    if (path && path !== router.pathname) {
      router.navigate(path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const colorMode = React.useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prev) => {
          const next = prev === "light" ? "dark" : "light";
          if (typeof window !== "undefined")
            localStorage.setItem("themeMode", next);
          setSnackbarOpen(true);
          return next;
        });
      },
    }),
    []
  );

  // Set document dir to LTR once
  React.useEffect(() => {
    document.documentElement.setAttribute("dir", dir);
  }, []);

  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.clear();
    navigate("/", { replace: true });
  };
  const handleCloseSnackbar = (
    _e?: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === "clickaway") return;
    setSnackbarOpen(false);
  };

  const accent = mode === "light" ? "#374151" : "#9e9e9e";

  const visibility = React.useMemo(
    () => ({
      showGeneralSettings: hasRole("User"),
      showOpurchasde: hasRole("Purchase"),
      showReceiveProducts: hasRole("Receive Products"),
      showInvoices: hasRole("General Invoices"),
      showInventory: hasRole("inventory"),
      showcashbook: hasRole("Cash Book"),
      showHR: hasRole("User"),
      showFin: hasRole("Finance"),
      showSales: hasRole("Sales Settings"),
    }),
    []
  );

  const NAV = React.useMemo<Navigation>(
    () => buildNavigation(t, accent, visibility),
    [t, accent, visibility]
  );

  React.useEffect(() => {
    function findTitle(nav: Navigation, path: string): string | null {
      for (const item of nav) {
        if ("segment" in item && item.segment && path.includes(item.segment))
          return item.title ?? null;
        if ("children" in item && item.children) {
          const childTitle = findTitle(item.children as Navigation, path);
          if (childTitle) return childTitle;
        }
      }
      return null;
    }
    const real = encryptedToRoute[router.pathname] || router.pathname;
    const title = findTitle(NAV, real) || t("app.title");
    document.title = title;
  }, [router.pathname, NAV, t]);

  // Role label
  const roleLabel = React.useMemo(() => {
    const normalizeRoles = (input: any): string[] => {
      if (!input) return [];
      if (Array.isArray(input)) {
        return input
          .map((r) =>
            typeof r === "string"
              ? r
              : String(
                  (r as any)?.name || (r as any)?.role || (r as any)?.value || r
                )
          )
          .flatMap((s) => String(s).split(/[\s,;]+/))
          .filter(Boolean)
          .map((s) => s.toUpperCase());
      }
      if (typeof input === "string") {
        return input
          .split(/[\s,;]+/)
          .filter(Boolean)
          .map((s) => s.toUpperCase());
      }
      if (typeof input === "object") {
        const s = String(
          (input as any).name ||
            (input as any).role ||
            (input as any).value ||
            ""
        );
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
      const u = localStorage.getItem("user");
      if (u) {
        const obj = JSON.parse(u);
        roles = roles.concat(normalizeRoles(obj?.Prvilege));
      }
      if (roles.length === 0) {
        const standalone = localStorage.getItem("Prvilege");
        if (standalone) {
          try {
            roles = roles.concat(normalizeRoles(JSON.parse(standalone)));
          } catch {
            roles = roles.concat(normalizeRoles(standalone));
          }
        }
      }

      const has = (needle: string) =>
        roles.some((r) => r === needle || r.includes(needle));
      if (has("ROLE_ADMIN") || has("ADMIN")) return "Admin";
      if (has("ROLE_ACCOUNT") || has("ACCOUNT")) return "Accounting";
      if (has("ROLE_USER") || has("USER")) return "User";
      return "";
    } catch {
      return "";
    }
  }, []);

  // Emotion cache per direction
  const cache = React.useMemo(() => createEmotionCacheLTR(), []);

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
                    display: "center",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    color: accent,
                  }}
                >
                  <Logo />
                </Box>
              ),
              title: "",
            }}
          >
            <DashboardLayout
              sx={{
                bgcolor: "background.default",
                m: 0,
                "& .MuiDrawer-root": { position: "relative", height: "100vh" },
                "& .MuiDrawer-paper": {
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  borderInlineEnd: `1px solid ${accent}`,
                },
                "& .MuiDrawer-paper .MuiListItemIcon-root, & .MuiDrawer-paper .MuiListItemIcon-root svg": {
                  color: `${accent} !important`,
                  fontWeight: 800,
                  letterSpacing: "0.2px",
                },
                "& .MuiDrawer-paper .MuiListItemText-root .MuiTypography-root": {
                  color: `${accent} !important`,
                  fontWeight: 800,
                  fontSize: "1rem",
                  letterSpacing: "0.3px",
                },
                "& .MuiDrawer-paper .Mui-selected .MuiListItemIcon-root svg": {
                  color: `${accent} !important`,
                },
                "& .MuiDrawer-paper .MuiListItemButton-root:hover .MuiListItemIcon-root svg": {
                  color: `${accent} !important`,
                },
              }}
              navigation={NAV}
              slots={{
                toolbarActions: () => (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      width: "100%",
                    }}
                  >
                    {/* LEFT: spacer to push everything to the right */}
                    <Box sx={{ flex: 1 }} />

                    {/* RIGHT cluster — EXACT ORDER: Role → ChangePOS → Logout → Theme → Lang → AI */}
                    {roleLabel && (
                      <>
                        <Chip
                          label={roleLabel}
                          color={roleLabel === "Admin" ? "primary" : "default"}
                          size="small"
                          sx={{ fontWeight: 800, letterSpacing: 0.3 }}
                        />

                        {/* PS selection dropdown button */}
                        <ChangePos />
                      </>
                    )}

                    <Tooltip title={t("tooltip.logout")}>
                      <IconButton
                        onClick={handleLogout}
                        aria-label={t("aria.logout")}
                        sx={{ color: "red" }}
                      >
                        <Logout />
                      </IconButton>
                    </Tooltip>

                    <Tooltip
                      title={
                        mode === "dark"
                          ? t("tooltip.lightMode")
                          : t("tooltip.darkMode")
                      }
                    >
                      <IconButton
                        onClick={colorMode.toggleColorMode}
                        aria-label={t("aria.toggleTheme")}
                        sx={{
                          color: accent,
                          "&:hover": { backgroundColor: "action.hover" },
                        }}
                      >
                        {mode === "dark" ? (
                          <Brightness7Icon />
                        ) : (
                          <Brightness4Icon />
                        )}
                      </IconButton>
                    </Tooltip>

                    <LanguageSwitcher />

                    {/* AI button */}
                    <IconButton
                      onClick={() => setAiOpen(true)}
                      sx={{
                        fontWeight: 900,
                        letterSpacing: 0.4,
                        color: PANTONE_TAN,
                        "& .MuiChip-icon": { color: PANTONE_TAN },
                      }}
                    >
                      <ChatIcon />
                    </IconButton>
                  </Box>
                ),
              }}
            >
              {/* content wrapper to give side padding for inner pages */}
              <Box sx={{ px: 3, py: 1, width: '100%' }}>
                {getPageComponent(router.pathname)}
              </Box>
            </DashboardLayout>

            {/* ChatGPT-style dialog (imported) */}
            <ChatbotWidget open={aiOpen} onClose={() => setAiOpen(false)} />

            <Snackbar
              open={snackbarOpen}
              autoHideDuration={3000}
              onClose={handleCloseSnackbar}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: dir === "ltr" ? "left" : "right",
              }}
            >
              <Alert
                onClose={handleCloseSnackbar}
                severity="success"
                sx={{ width: "100%" }}
                elevation={6}
                variant="filled"
              >
                {t("toast.currentTheme")}:{" "}
                {mode === "dark" ? t("toast.darkMode") : t("toast.lightMode")}
              </Alert>
            </Snackbar>
          </AppProvider>
        </ThemeProvider>
      </StyledEngineProvider>
    </CacheProvider>
  );
}
