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
  Paper,
  MenuItem,
  Typography,
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
  Menu as MenuIcon,
  MenuOpen as MenuOpenIcon,
  ShoppingBagOutlined,
} from "@mui/icons-material";
import { MoneyOffCsred } from "@mui/icons-material";
import ChatIcon from "@mui/icons-material/Chat";

import Logo from "../ui-component/Logo2";
import LanguageSwitcher from "../components/LanguageSwitcher";
import ChatbotWidget from "../components/ChatbotWidget";
import { hasRole } from "../Setup/getUserInfo";
import { useAuth } from "../contexts/AuthContext";
import axios from "../api";

// Theme switch
import Switch from "../components/Switch";

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

import {
  DYNAMIC_PREFIXES,
  decodeEmployeeToken,
  decodeClientToken,
  decodeSellerToken,
} from "../utils/routeCrypto";
import SellerReports from "../Invoices/SellerReports";
import EmployeeProfile from "../HR/Setting/EmployeeProfile";
import CommissionsPage from "../HR/Setting/CommissionsPage";

// ---------------- CustomerProfileRoute ----------------
function CustomerProfileRoute() {
  const [resolvedId, setResolvedId] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        let id: number | null = null;
        try {
          const raw =
            typeof window !== "undefined"
              ? localStorage.getItem("customerFocusId")
              : null;
          if (raw !== null && raw !== "") id = Number(raw);
        } catch {}
        if (!id || Number.isNaN(id)) {
          let hintName = "";
          let hintPhone = "";
          try {
            hintName = localStorage.getItem("customerFocusName") || "";
            hintPhone = localStorage.getItem("customerFocusPhone") || "";
          } catch {}
          if (hintName || hintPhone) {
            const token =
              typeof window !== "undefined"
                ? localStorage.getItem("token")
                : null;
            try {
              const res = await axios.get(`/customers/all`, {
                headers: {
                  Authorization: token ? `Bearer ${token}` : undefined,
                },
              });
              const list = Array.isArray(res.data) ? res.data : [];
              const byTel = hintPhone
                ? list.find(
                    (c: any) => String(c.tel_client) === String(hintPhone)
                  )
                : null;
              const byName =
                !byTel && hintName
                  ? list.find(
                      (c: any) =>
                        String(c.client_name) === String(hintName)
                    )
                  : null;
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

// ---------------- Theme augmentation ----------------
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

const PANTONE_BLUE = "#0057B8" as const;
const PANTONE_TAN = "#B7A27D" as const;

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

// ---------------- ChangePos ----------------
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

  const currentStoredUserId = React.useMemo(() => {
    try {
      const raw =
        typeof window !== "undefined" ? localStorage.getItem("user") : null;
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return (
        obj?.Cuser ?? obj?.id ?? obj?.id_user ?? obj?.Id_user ?? null
      );
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
      const rawValue =
        selectedId !== undefined ? selectedId : psValue || "";
      const valueToSave = Number(rawValue) === -1 ? "" : rawValue;

      if (auth && typeof (auth as any).updatePs === "function") {
        (auth as any).updatePs(valueToSave);
      }

      try {
        const u = localStorage.getItem("user");
        if (u) {
          const obj = JSON.parse(u);
          obj.ps = valueToSave;
          localStorage.setItem("user", JSON.stringify(obj));
        } else {
          localStorage.setItem("user", JSON.stringify({ ps: valueToSave }));
        }
      } catch {
        try {
          localStorage.setItem(
            "user",
            JSON.stringify({ ps: valueToSave })
          );
        } catch {}
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("selectedPs", String(rawValue ?? ""));
      }
    } catch (e) {
      console.error("Failed to save PS", e);
    }
    handleClosePs();

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
      } catch {}
    };
    fetchPOS();
    return () => {
      mounted = false;
    };
  }, []);

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
        return (
          obj?.Cuser ??
          obj?.id ??
          obj?.id_user ??
          obj?.Id_user ??
          null
        );
      } catch {
        return null;
      }
    };

    const handlePayload = (payloadRaw: any) => {
      try {
        const payload =
          typeof payloadRaw === "string"
            ? JSON.parse(payloadRaw)
            : payloadRaw;
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
            try {
              const raw = localStorage.getItem("user");
              const obj = raw ? JSON.parse(raw) : {};
              const updated = { ...obj, Prvilege: remotePrv };
              localStorage.setItem("user", JSON.stringify(updated));
              try {
                if (
                  typeof (auth as any)?.refreshUser === "function"
                )
                  (auth as any).refreshUser();
              } catch {}
            } catch {}
          }
        }
      } catch {}
    };

    if (inferredSse) {
      try {
        es = new EventSource(inferredSse);
        es.onmessage = (evt) => {
          if (!closed) handlePayload(evt.data);
        };
        es.onerror = () => {};
      } catch {}
    } else if (wsUrl) {
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (evt) => {
          if (!closed) handlePayload(evt.data);
        };
        ws.onerror = () => {};
      } catch {}
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
        startIcon={<Inventory2 />}
        aria-label={t("POS") || "POS"}
        disabled={!(isAdmin || String(currentStoredUserId) === "68")}
      >
        {`${t("POS") || "POS"} (${currentPosName})`}
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
            value={
              posOptions.find((p) => p?.Id_point === selectedId) || null
            }
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

// ---------------- Encrypted routing ----------------
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
// Preserve existing mapping; only add missing routes. Never blow away old mappings
// to ensure currently open encrypted URLs remain valid across reloads/UI changes.
{
  const used = new Set<string>(Object.values(routeToEncrypted));
  let changed = false;
  for (const route of realRoutes) {
    const existing = routeToEncrypted[route];
    if (existing) {
      if (!encryptedToRoute[existing]) {
        encryptedToRoute[existing] = route;
        changed = true;
      }
      continue;
    }
    let crypted: string;
    do {
      crypted = generateRandomPath();
    } while (used.has(crypted));
    routeToEncrypted[route] = crypted;
    encryptedToRoute[crypted] = route;
    used.add(crypted);
    changed = true;
  }
  if (changed && typeof window !== "undefined") {
    try {
      localStorage.setItem(
        mappingKey,
        JSON.stringify({ routeToEncrypted, encryptedToRoute })
      );
    } catch {}
  }
}

function useDemoRouter(initialPath: string): Router {
  const [pathname, setPathname] = React.useState(() => {
    if (typeof window !== "undefined" && window.location?.pathname) {
      const current = window.location.pathname;

      if (DYNAMIC_PREFIXES.some((p) => current.startsWith(p))) {
        return current;
      }

      if (routeToEncrypted[current]) {
        const crypted = routeToEncrypted[current];
        window.history.replaceState({}, "", crypted);
        return crypted;
      }

      if (encryptedToRoute[current]) return current;

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

        const isDynamic = DYNAMIC_PREFIXES.some((p) =>
          newPath.startsWith(p)
        );
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

// ---------------- Page wrappers ----------------
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
  if (pathname.startsWith("/p/")) {
    const token = pathname.slice(3);
    const id = decodeEmployeeToken(token);
    if (!id) return <P404 />;
    return <ProfileWithId id={id} />;
  }

  if (pathname.startsWith("/c/")) {
    const token = pathname.slice(3);
    const id = decodeClientToken(token);
    try {
      if (id && typeof window !== "undefined") {
        localStorage.setItem("customerFocusId", String(id));
      }
    } catch {}
    if (!id) return <P404 />;
    return <CustomerProfile id={id} />;
  }

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

// ---------------- Navigation -> Dock ----------------
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
            icon: <ShoppingBagOutlined {...iconSx} />,
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
                icon: <MoneyOffCsred {...iconSx} />,
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

type DockItem = {
  key: string;
  title: string;
  icon?: React.ReactNode;
  path?: string;
  children?: DockItem[];
};

function buildDockItems(nav: Navigation): DockItem[] {
  const getPath = (segment?: string, parentPath?: string) => {
    if (!segment) return parentPath || "";
    if (segment.startsWith("/")) return segment;
    if (parentPath) return `${parentPath}/${segment}`;
    return `/${segment}`;
  };

  const collectLeaves = (node: any, parentPath: string): DockItem[] => {
    if (node?.kind === "header" || node?.kind === "divider") return [];
    const path = getPath(node.segment, parentPath);

    if (node.children && node.children.length) {
      return (node.children as any[]).flatMap((child) =>
        collectLeaves(child, path)
      );
    }

    if (!node.segment) return [];
    return [
      {
        key: path,
        title: node.title ?? "",
        icon: node.icon,
        path,
      },
    ];
  };

  return (nav as any[])
    .map((item, index) => {
      if (item.kind === "header" || item.kind === "divider") return null;

      const basePath = item.segment ? getPath(item.segment, "") : "";
      const leaves = item.children
        ? (item.children as any[]).flatMap((child: any) =>
            collectLeaves(child, basePath)
          )
        : undefined;

      return {
        key: item.segment || `root-${index}`,
        title: item.title ?? "",
        icon: item.icon,
        path: !leaves?.length ? (basePath || undefined) : undefined,
        children: leaves,
      } as DockItem;
    })
    .filter(Boolean) as DockItem[];
}

interface DockNavigationProps {
  nav: Navigation;
  router: Router;
  accent: string;
  currentPath: string;
  mode: "light" | "dark";
  onHoverChange?: (hover: boolean) => void;
}

function DockNavigation({
  nav,
  router,
  accent,
  currentPath,
  mode,
  onHoverChange,
}: DockNavigationProps) {
  const items = React.useMemo(() => buildDockItems(nav), [nav]);
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(
    null
  );
  const [openKey, setOpenKey] = React.useState<string | null>(null);

  return (
    <Box
      sx={{
        position: "fixed",
        left: 16,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: (theme) => theme.zIndex.drawer + 2,
        pointerEvents: "auto",
      }}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      <Paper
        elevation={8}
        sx={{
          pointerEvents: "auto",
          px: 0.5,
          py: 0.75,
          borderRadius: "999px",
          bgcolor:
            mode === "dark" ? "rgba(10, 12, 18, 0.92)" : "#ffffff",
          border:
            mode === "dark"
              ? "1px solid rgba(255,255,255,0.16)"
              : "1px solid rgba(55,65,81,0.4)",
          boxShadow:
            mode === "dark"
              ? "0 18px 50px rgba(0,0,0,0.7)"
              : "0 14px 30px rgba(15,23,42,0.18)",
          backdropFilter: mode === "dark" ? "blur(16px)" : "blur(10px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0.75,
        }}
      >
        {items.map((item, index) => {
          const hasChildren = !!item.children?.length;

          const isActive =
            (item.path && currentPath.startsWith(item.path)) ||
            (hasChildren &&
              item.children!.some(
                (c) => c.path && currentPath.startsWith(c.path)
              ));

          const dist =
            hoveredIndex == null ? Infinity : Math.abs(hoveredIndex - index);
          const scale =
            hoveredIndex == null
              ? 1
              : dist === 0
              ? 1.25
              : dist === 1
              ? 1.12
              : 1;

          return (
            <Box
              key={item.key}
              sx={{ position: "relative" }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <Tooltip title={item.title} placement="right">
                <IconButton
                  onClick={() => {
                    if (hasChildren) {
                      setOpenKey((prev) =>
                        prev === item.key ? null : item.key
                      );
                    } else if (item.path) {
                      setOpenKey(null);
                      router.navigate(item.path);
                    }
                  }}
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    color: accent,
                    transform: `scale(${scale})`,
                    transition:
                      "transform 180ms ease-out, box-shadow 180ms ease-out, background-color 180ms ease-out",
                    bgcolor: isActive
                      ? mode === "dark"
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(15,23,42,0.06)"
                      : "transparent",
                    boxShadow: isActive
                      ? mode === "dark"
                        ? "0 0 0 1px rgba(237, 237, 237, 0.3), 0 12px 30px rgba(0,0,0,0.65)"
                        : "0 0 0 1px rgba(55,65,81,0.4), 0 10px 24px rgba(15,23,42,0.25)"
                      : "none",
                    "&:hover": {
                      bgcolor:
                        mode === "dark"
                          ? "rgba(255,255,255,0.04)"
                          : "rgba(15,23,42,0.04)",
                    },
                  }}
                >
                  {item.icon}
                </IconButton>
              </Tooltip>

              {isActive && (
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 2,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    bgcolor:
                      mode === "dark"
                        ? "rgba(255,255,255,0.9)"
                        : "rgba(55,65,81,0.95)",
                    boxShadow:
                      mode === "dark"
                        ? "0 0 10px rgba(255,255,255,0.75)"
                        : "0 0 8px rgba(55,65,81,0.7)",
                  }}
                />
              )}

              {hasChildren && openKey === item.key && (
                <Paper
                  elevation={8}
                  sx={{
                    position: "absolute",
                    left: 60,
                    top: "50%",
                    transform: "translateY(-50%)",
                    minWidth: 220,
                    bgcolor:
                      mode === "dark"
                        ? "rgba(15, 18, 26, 0.98)"
                        : "#ffffff",
                    borderRadius: 3,
                    border:
                      mode === "dark"
                        ? "1px solid rgba(255,255,255,0.16)"
                        : "1px solid rgba(55,65,81,0.2)",
                    boxShadow:
                      mode === "dark"
                        ? "0 18px 50px rgba(0,0,0,0.75)"
                        : "0 16px 36px rgba(15,23,42,0.22)",
                    overflow: "hidden",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <Box
                    sx={{
                      px: 2,
                      py: 1,
                      borderBottom:
                        mode === "dark"
                          ? "1px solid rgba(255,255,255,0.04)"
                          : "1px solid rgba(15,23,42,0.06)",
                    }}
                  >
                    <Typography
                      sx={{
                        fontWeight: 700,
                        letterSpacing: 0.6,
                        textTransform: "uppercase",
                        fontSize: 11,
                        color:
                          mode === "dark" ? "#f5f5f5" : "#111827",
                      }}
                    >
                      {item.title || "Menu"}
                    </Typography>
                  </Box>
                  {item.children!.map((child) => {
                    const childActive =
                      child.path && currentPath.startsWith(child.path);
                    return (
                      <MenuItem
                        key={child.key}
                        onClick={() => {
                          if (child.path) {
                            router.navigate(child.path);
                            setOpenKey(null);
                          }
                        }}
                        sx={{
                          py: 1,
                          px: 2,
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          color: childActive
                            ? mode === "dark"
                              ? "#fef9c3"
                              : "#0f172a"
                            : mode === "dark"
                            ? "#e5e5e5"
                            : "#374151",
                          "&:hover": {
                            bgcolor:
                              mode === "dark"
                                ? "rgba(255,255,255,0.06)"
                                : "rgba(15,23,42,0.04)",
                          },
                        }}
                      >
                        {child.icon && (
                          <Box
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 26,
                              height: 26,
                              borderRadius: "50%",
                              bgcolor:
                                mode === "dark"
                                  ? "rgba(255,255,255,0.03)"
                                  : "rgba(15,23,42,0.03)",
                              color: accent,
                            }}
                          >
                            {child.icon}
                          </Box>
                        )}
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: childActive ? 700 : 500 }}
                        >
                          {child.title}
                        </Typography>
                      </MenuItem>
                    );
                  })}
                </Paper>
              )}
            </Box>
          );
        })}
      </Paper>
    </Box>
  );
}

// ---------------- LTR cache ----------------
function createEmotionCacheLTR() {
  return createCache({
    key: "mui-ltr",
    prepend: true,
  });
}

// ---------------- Home ----------------
export default function Home(props: any) {
  const { t } = useTranslation();

  const dir: "ltr" = "ltr";

  const [mode, setMode] = React.useState<"light" | "dark">(() => {
    try {
      const saved =
        typeof window !== "undefined"
          ? (localStorage.getItem("themeMode") as
              | "light"
              | "dark"
              | null)
          : null;
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return "light";
  });

  const appTheme: Theme = React.useMemo(() => {
    const tokens = getDesignTokens(mode) as any;
    const base = createTheme({ direction: dir, ...tokens }) as any;
    base.palette.gaja = tokens.palette?.gaja;
    return base as Theme;
  }, [mode]);

  // DON'T shadow global window
  const { window: win } = props;

  const [initialPath] = React.useState(() =>
    typeof win !== "undefined" && win?.location
      ? win.location.pathname || "/dashboard"
      : "/dashboard"
  );
  const router = useDemoRouter(initialPath);
  const location = useLocation();
  const demoWindow = typeof win !== "undefined" ? win : undefined;

  const [snackbarOpen, setSnackbarOpen] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);

  // Dock pin/auto-hide
  const [dockPinned, setDockPinned] = React.useState(true);
  const [dockHoveringEdge, setDockHoveringEdge] = React.useState(false);
  const [dockHovering, setDockHovering] = React.useState(false);
  const [dockEdgeActive, setDockEdgeActive] = React.useState(false);

  const dockVisible = dockPinned || dockHoveringEdge || dockHovering;

  // Guard: lock route while toggling dock to avoid accidental navigation
  const routeLockRef = React.useRef<string>("");
  const suppressNavRef = React.useRef(false);

  React.useEffect(() => {
    const path = location.pathname;
    if (!path) return;
    if (suppressNavRef.current) return; // do not sync while dock toggle is in-flight
    // Normalize: if a real route was pushed, translate to encrypted; if already encrypted, keep
    let target = path;
    const isDynamic = DYNAMIC_PREFIXES.some((p) => path.startsWith(p));
    if (!isDynamic && routeToEncrypted[path]) {
      target = routeToEncrypted[path];
    }
    if (target && target !== router.pathname) {
      router.navigate(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Auto-restore route if something changed it during dock toggle
  React.useEffect(() => {
    if (!suppressNavRef.current) return;
    const locked = routeLockRef.current;
    if (!locked) return;
    if (router.pathname !== locked) {
      router.navigate(locked);
    }
    if (
      typeof window !== "undefined" &&
      window.location &&
      window.location.pathname !== locked
    ) {
      try { window.history.replaceState({}, "", locked); } catch {}
    }
  }, [router.pathname]);

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

  React.useEffect(() => {
    document.documentElement.setAttribute("dir", dir);
  }, []);

  // macOS-style auto-hide: show when pointer hits left edge
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const handleMove = (e: MouseEvent) => {
      if (dockPinned) {
        if (dockEdgeActive) setDockEdgeActive(false);
        return;
      }

      const threshold = 15;
      const atEdge = e.clientX <= threshold;

      if (atEdge !== dockEdgeActive) {
        if (atEdge) {
          clearTimeout(timeoutId);
          setDockEdgeActive(true);
        } else {
          timeoutId = setTimeout(() => {
            if (!dockHovering) {
              setDockEdgeActive(false);
            }
          }, 120);
        }
      }
    };

    window.addEventListener("mousemove", handleMove);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      clearTimeout(timeoutId);
    };
  }, [dockPinned, dockEdgeActive, dockHovering]);

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
          const childTitle = findTitle(
            item.children as Navigation,
            path
          );
          if (childTitle) return childTitle;
        }
      }
      return null;
    }
    const real = encryptedToRoute[router.pathname] || router.pathname;
    const title = findTitle(NAV, real) || t("app.title");
    document.title = title;
  }, [router.pathname, NAV, t]);

  const roleLabel = React.useMemo(() => {
    const normalizeRoles = (input: any): string[] => {
      if (!input) return [];
      if (Array.isArray(input)) {
        return input
          .map((r) =>
            typeof r === "string"
              ? r
              : String(
                  (r as any)?.name ||
                    (r as any)?.role ||
                    (r as any)?.value ||
                    r
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

  const cache = React.useMemo(() => createEmotionCacheLTR(), []);

  const handleDockHoverChange = React.useCallback((hover: boolean) => {
    setDockHovering(hover);
  }, []);

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
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    maxHeight: 40,
                    "& svg, & img": {
                      maxHeight: "40px",
                      width: "auto",
                    },
                    color: accent,
                  }}
                >
                  <Tooltip
                    title={
                      dockPinned
                        ? t("tooltip.hideDock") || "Hide dock (auto-hide)"
                        : t("tooltip.showDock") || "Show dock (pin open)"
                    }
                  >
                    <IconButton
                      edge="start"
                      onClick={() => {
                        // Lock current encrypted route and suppress sync briefly
                        routeLockRef.current = router.pathname;
                        try { localStorage.setItem("lastEncryptedPath", router.pathname); } catch {}
                        suppressNavRef.current = true;
                        setTimeout(() => { suppressNavRef.current = false; }, 200);

                        setDockPinned((prev) => {
                          const next = !prev;
                          if (!next) {
                            setDockEdgeActive(false);
                            setDockHovering(false);
                          }
                          return next;
                        });
                      }}
                      aria-label={t("aria.toggleDock") || "Toggle dock"}
                      sx={{ color: accent }}
                    >
                      {dockPinned ? <MenuOpenIcon /> : <MenuIcon />}
                    </IconButton>
                  </Tooltip>

                  <Logo />
                </Box>
              ),
              title: "",
            }}
          >
            {dockVisible && (
              <DockNavigation
                nav={NAV}
                router={router}
                accent={accent}
                currentPath={
                  encryptedToRoute[router.pathname] || router.pathname
                }
                mode={mode}
                onHoverChange={handleDockHoverChange}
              />
            )}

            <DashboardLayout
              hideNavigation
              navigation={NAV}
              sx={{
                bgcolor: "background.default",
                m: 0,
                transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                "& .MuiDrawer-root": {
                  display: "none",
                },
                "& .MuiDrawer-paper": {
                  display: "none",
                },
              }}
              slots={{
                // Only RIGHT SIDE actions here now
                toolbarActions: () => (
                  <Box
                    sx={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      minHeight: 56,
                      pr: 1,
                      gap: 1,
                    }}
                  >
                    {roleLabel && (
                      <>
                        <Chip
                          label={roleLabel}
                          color={
                            roleLabel === "Admin" ? "primary" : "default"
                          }
                          size="small"
                          sx={{
                            fontWeight: 800,
                            letterSpacing: 0.3,
                          }}
                        />
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
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <Switch
                          checked={mode === "dark"}
                          onChange={colorMode.toggleColorMode}
                        />
                      </Box>
                    </Tooltip>

                    <LanguageSwitcher />

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
              <Box
                sx={{
                  px: 3,
                  py: 1,
                  width: "100%",
                  pl: dockVisible ? "96px" : "32px",
                  transition: "padding-left 200ms ease-out",
                }}
              >
                {getPageComponent(router.pathname)}
              </Box>
            </DashboardLayout>

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
                {mode === "dark"
                  ? t("toast.darkMode")
                  : t("toast.lightMode")}
              </Alert>
            </Snackbar>
          </AppProvider>
        </ThemeProvider>
      </StyledEngineProvider>
    </CacheProvider>
  );
}
