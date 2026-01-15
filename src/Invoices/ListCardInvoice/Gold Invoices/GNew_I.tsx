
import React, { useState, useEffect, useCallback, useRef } from "react";
import GroupDialog from "./GroupDialog";
import GroupIcon from "@mui/icons-material/Group";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CardGiftcardOutlinedIcon from "@mui/icons-material/CardGiftcardOutlined";
import ViewModuleOutlinedIcon from "@mui/icons-material/ViewModuleOutlined";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import RemoveOutlinedIcon from "@mui/icons-material/RemoveOutlined";
import axios from "../../../api";

import IconButton from "@mui/material/IconButton";
import { useNavigate } from "react-router-dom";
import { Box, Button, Typography, TextField, MenuItem, Menu, Slider } from "@mui/material";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Collapse from "@mui/material/Collapse";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import { ShoppingCartCheckoutOutlined } from "@mui/icons-material";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { Search } from "@mui/icons-material";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import InvoiceTotalsDialog from "./InvoiceTotalsDialog";
import PrintInvoiceDialog from "./PrintInvoiceDialog"; // Import the PrintInvoiceDialog component
import { hasRole } from "../../../Setup/getUserInfo";

type Invoice = {
  id_fact: number;
  date_fact: string;
  client: number;
  num_fact: number;
  usr: number;
  d_time: string;
  id_art: number;
  prix_vente: number;
  prix_vente_remise: number;
  mode_fact: string;
  COMMENT: string;
  IS_OK: boolean;
  rate: number;
  remise: number;
  remise_per: number; // Discount percentage
  is_printed: boolean;
  ps: number;
  phone_client: string;
  total_remise: number;
  qty: number;
  total_remise_final: number;
  total_remise_final_lyd: number;
  currency: string;
  amount_currency: number;
  amount_lyd: number;
  amount_EUR: number;
  amount_currency_LYD: number;
  amount_EUR_LYD: number;
  accept_discount: boolean;
  return_chira: boolean;
  comment_chira: string;
  usr_receive_chira: number;
  id_box1: number;
  id_box2: number;
  id_box3: number;
  IS_GIFT: boolean;
  IS_WHOLE_SALE: boolean;
  USD_Rate: number;
  EURO_Rate: number;
  TOTAL_INV_FROM_DIAMOND: number;
  is_chira: boolean;
  is_request: boolean;
  is_ok_commission_extra: boolean;
  client_redirected: boolean;
  SourceMark: string;
  picint: number;
  Client?: {
    id_client: number;
    client_name: string;
    tel_client: string;
  };
  Utilisateur?: {
    id_user: number;
    name_user: string;
    email: string;
  };
  ACHATs?: ACHATs[];
  ACHAT_pic?: ACHAT_pic[];
};

const initialInvoiceState: Invoice = {
  id_fact: 0,
  date_fact: new Date().toISOString().split("T")[0],
  client: 0,
  num_fact: 0,
  usr: 0,
  d_time: new Date().toISOString(),
  id_art: 0,
  prix_vente: 0,
  prix_vente_remise: 0,
  mode_fact: "Debitor",
  COMMENT: "",
  IS_OK: false,
  rate: 0,
  remise: 0,
  remise_per: 0,
  is_printed: false,
  ps: 0,
  phone_client: "",
  total_remise: 0,
  qty: 0,
  total_remise_final: 0,
  total_remise_final_lyd: 0,
  currency: "",
  amount_currency: 0,
  amount_lyd: 0,
  amount_EUR: 0,
  amount_currency_LYD: 0,
  amount_EUR_LYD: 0,
  accept_discount: false,
  return_chira: false,
  comment_chira: "",
  usr_receive_chira: 0,
  id_box1: 0,
  id_box2: 0,
  id_box3: 0,
  IS_GIFT: false,
  IS_WHOLE_SALE: false,
  USD_Rate: 0,
  EURO_Rate: 0,
  TOTAL_INV_FROM_DIAMOND: 0,
  is_chira: false,
  is_request: false,
  is_ok_commission_extra: false,
  client_redirected: false,
  SourceMark: "",
  picint: 0,
};

type ACHAT_pic = {
  id_art: number;
  ID_PIC: number;
  PIC1: string;
  PIC2: string;
  PIC3: string;
};

type ACHATs = {
  id_fact: number;
  Design_art: string;
  client: number;
  qty: number;
  TOTAL_INV_FROM_DIAMOND: number;
  Color_Gold: string;
  Color_Rush: string;
  Original_Invoice: string;
  Fournisseur?: {
    id_client: number;
    client_name: string;
    code_fournisseur: string;
    TYPE_SUPPLIER: string;
  };
  DistributionPurchase?: DistributionPurchase[];
};

type InventoryItem = {
  Supplier: any;
  id_fact: number;
  date_fact: string;
  client: number;
  id_art: number;
  qty: number;
  Full_qty: number;
  Unite: string;
  num_fact: number;
  usr: number;
  d_time: string;
  Design_art: string;
  Color_Gold: string;
  Color_Rush: string;
  Cost_Currency: number;
  RATE: number;
  Cost_Lyd: number;
  Selling_Price_Currency: number;
  CODE_EXTERNAL: string;
  Selling_Rate: number;
  is_selled: boolean;
  ps: number;
  IS_OK: boolean;
  COMMENT: string;
  comment_edit: string;
  date_inv: string;
  CURRENCY: string;
  General_Comment: string;
  MakingCharge: number;
  ShippingCharge: number;
  TravelExpesenes: number;
  LossExpesenes: number;
  cost_g: number;
  ExtraClient: number;
  Model: string;
  Serial_Number: string;
  WarrantyDate: string;
  Notes: string;
  client_name: string;
  TYPE_SUPPLIER: string;
  Fournisseur?: {
    id_client: number;
    client_name: string;
    TYPE_SUPPLIER: string;
    Price_G_Gold_Sales: number;
    Price_G_Gold: number;
    Percentage_Diamond: number;
    profit_margin?: number;
  };
  Original_Invoice: string;
  DistributionPurchase?: DistributionPurchase[];
};

type GoldOriginalAchat = {
  id_achat: number;
  MakingCharge?: number;
  ShippingCharge?: number;
  TravelExpesenes?: number;
  LossExpesenes?: number;
  // ...add other fields as needed
};

type DistributionPurchase = {
  distributionID: number;
  ps?: number;
  Weight?: number;
  distributionDate?: string;
  usr?: number;
  PurchaseID?: number;
  CreationDate?: string;
  PurchaseType?: string;
  distributionISOK?: boolean;

  OriginalAchatDiamond?: {
    id_achat: number;
    carat?: number;
    cut?: string;
    color?: string;
    clarity?: string;
    shape?: string;
    measurements?: string;
    depth_percent?: number;
    table_percent?: number;
    girdle?: string;
    culet?: string;
    polish?: string;
    symmetry?: string;
    fluorescence?: string;
    certificate_number?: string;
    certificate_lab?: string;
    certificate_url?: string;
    laser_inscription?: string;
    price_per_carat?: number;
    total_price?: number;
    origin_country?: string;
    comment?: string;
    image_url?: string;
    video_url?: string;
    Comment_Achat?: string;
    DocumentNo?: string;
    IsApprouved?: string;
    Approval_Date?: string;
    ApprouvedBy?: string;
    attachmentUrl?: string;
    Date_Achat?: string;
    Brand?: number;
    Usr?: number;
    CODE_EXTERNAL?: string;
    comment_edit?: string;
    sharepoint_url?: string;
    MakingCharge?: number;
    ShippingCharge?: number;
    TravelExpesenes?: number;
    LossExpesenes?: number;
    Rate?: number;
    Total_Price_LYD?: number;
    sale_price?: number;
    Design_art?: string;
  };
  OriginalAchatWatch?: {
    id_achat: number;
    Brand: number;
    model: string;
    reference_number?: string;
    serial_number?: string;
    movement?: string;
    caliber?: string;
    gender?: string;
    condition?: string;
    diamond_total_carat?: number;
    diamond_quality?: string;
    diamond_setting?: string;
    number_of_diamonds?: number;
    custom_or_factory?: string;
    case_material?: string;
    case_size?: string;
    bezel?: string;
    bracelet_type?: string;
    bracelet_material?: string;
    dial_color?: string;
    dial_style?: string;
    crystal?: string;
    water_resistance?: string;
    functions?: string;
    power_reserve?: string;
    box_papers?: boolean;
    warranty?: string;
    retail_price?: number;

    image_url?: string;
    certificate_url?: string;
    Comment_Achat?: string;
    DocumentNo?: string;
    IsApprouved?: string;
    Approval_Date?: Date;
    ApprouvedBy?: string;
    Comment?: string;
    attachmentUrl?: string;
    Date_Achat?: string;
    Usr?: number;
    sharepoint_url?: string;
    MakingCharge?: number;
    ShippingCharge?: number;
    TravelExpesenes?: number;
    LossExpesenes?: number;
    Rate?: number;
    Total_Price_LYD?: number;
    sale_price?: number;
    common_local_brand?: string;
  };
  GoldOriginalAchat?: GoldOriginalAchat;
};

type Client = {
  id_client: number;
  client_name: string;
  tel_client: string;
};
type Sm = {
  id_SourceMark: number;
  SourceMarketing: string;
  Status: boolean;
};



const API_BASEImage = "/images";

const normalizeImageList = (arr: any): string[] => {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((it: any) => {
      if (typeof it === "string") return it;
      if (it && typeof it === "object") return it.url || it.path || it.href || it.src || "";
      return "";
    })
    .filter(Boolean);
};

const toApiImageAbsolute = (url: string): string => {
  try {
    if (!url) return url;
    if (url.startsWith("data:") || url.startsWith("blob:")) return url;
    if (/^https?:\/\//i.test(url) || url.startsWith("//")) return url;
    if (!url.startsWith("/")) return url;
    const base = (axios as any)?.defaults?.baseURL;
    if (base) {
      const u = new URL(base, window.location.origin);
      const cleanPath = u.pathname.replace(/\/+$/, "");
      const root = `${u.origin}${cleanPath}`;
      return `${root}${url}`;
    }

      return `${window.location.origin}${url}`;
  } catch {
    return url;
  }
};



// Normalize / rewrite watch image URLs to the new alias route
function normalizeWatchUrl(rawUrl: string, idAchat: number): string {
  if (!rawUrl) return rawUrl;
  try {
    // Strip existing token/query for rewriting decisions
    const basePart = rawUrl.split('?')[0];
    const fileName = basePart.split('/').pop() || '';
    // Already in /images/watch form
    if (/\/images\/watch\//i.test(basePart)) {
      return rawUrl;
    }
    // If it matches /images/<id>/<file>
    if (new RegExp(`/images/${idAchat}/`, 'i').test(basePart) && !/\/images\/watch\//i.test(basePart)) {
      const out = basePart.replace(`/images/${idAchat}/`, `/images/watch/${idAchat}/`);
      return out;
    }
    // If it is a static upload path
    if (/\/uploads\/WatchPic\//i.test(basePart)) {
      const out = `/images/watch/${idAchat}/${fileName}`;
      return out;
    }
    return rawUrl; // leave unchanged if pattern not recognized
  } catch {
    return rawUrl;
  }
}

// Force https for any absolute http URL
const ensureHttps = (u: string): string => {
  if (!u) return u;
  if (u.startsWith('http://')) {
    const out = 'https://' + u.substring('http://'.length);

    return out;
  }
  return u;

};

// Remove token query param from a URL for display purposes
function stripToken(u: string): string {
  if (!u) return u;
  try {
    // remove token=... from querystring
    let out = u.replace(/([?&])token=[^&]*(&?)/i, (_m, p1, p2) => (p2 ? p1 : ""));
    // remove trailing ? or & if left behind
    out = out.replace(/[?&]$/g, "");
    return out;
  } catch {
    return u;
  }
}

const canonicalizePrefUrl = (rawUrl: string, kind: "gold" | "diamond" | "watch" | undefined, idAchat: any): string => {
  if (!rawUrl) return rawUrl;
  try {
    let u = stripToken(String(rawUrl));
    if (kind === "watch" && idAchat != null) {
      u = normalizeWatchUrl(u, Number(idAchat));
    }
    // Canonical form: pathname only (stable across origins)
    const urlObj = new URL(u, window.location.origin);
    return urlObj.pathname;
  } catch {
    return stripToken(String(rawUrl));
  }
};

// Parse purity factor from a type string (e.g., "21K" -> 0.875)
const parsePurityFactorFromType = (raw?: string): number | null => {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  const hasKaratMarker = /(\bkarat\b|\bkt\b|\bct\b|k\b|\bk\b|عيار|قيراط)/i.test(lower);

  const pctMatch = lower.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*%/);
  if (pctMatch) {
    const n = Number(pctMatch[1].replace(",", "."));
    if (!Number.isNaN(n) && n > 0 && n <= 100) return n / 100;
  }

  const karatMatch = lower.match(/(\d{1,2})\s*(k|karat|ct|عيار|قيراط)\b/);
  if (karatMatch) {
    const k = Number(karatMatch[1]);
    if (!Number.isNaN(k) && k >= 1 && k <= 24) return k / 24;
  }

  const anyNum = lower.match(/\b(\d{1,2})\b/);
  if (anyNum) {
    const n = Number(anyNum[1]);
    if (!Number.isNaN(n) && n >= 8 && n <= 24 && (hasKaratMarker || /gold|ذهب/i.test(lower))) {
      return n / 24;
    }
  }
  return null;
};


// Default type, can be changed based on your requirements;
const DNew_I = () => {
  // State for group dialog
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupDialogData, setGroupDialogData] = useState<{
    groupName: string;
    generalComment: string;
    items: any[];
  }>({ groupName: "", generalComment: "", items: [] });

  // const [images, setImages] = useState<Record<number, string[]>>({});
  const [imageUrls, setImageUrls] = useState<Record<string, string[]>>({});
  const [resolvedImgSrc, setResolvedImgSrc] = useState<Record<string, string>>({});

  // Image key namespacing to isolate gold/watch/diamond
  const getImageKey = (kind: "gold" | "watch" | "diamond" | undefined, id: number | string): string => {
    const k = kind || "generic";
    return `${k}:${String(id)}`;
  };

  // Helper to extract date from image filename (assumes format includes date or timestamp)
  function extractDateFromFilename(filename: string): number {
    // Example: IMG_20231025_123456.jpg or ..._2023-10-25_12-34-56.jpg
    const dateMatch = filename.match(/(\d{4})[-_]?((\d{2})[-_]?(\d{2}))/);
    if (dateMatch) {
      const year = dateMatch[1];
      const month = dateMatch[3];
      const day = dateMatch[4];
      if (year && month && day) {
        return new Date(`${year}-${month}-${day}`).getTime();
      }
    }
    // fallback: use filename as string for sorting
    return filename.length ? filename.charCodeAt(0) : 0;
  }

  // Preference helpers: prioritize files containing 'marketing', then 'invoice', then others
  function getNamePriorityFromUrl(url: string): number {
    try {
      const base = (url || '').split('?')[0];
      const file = base.split('/').pop() || base;
      const lower = file.toLowerCase();
      if (lower.includes('marketing')) return 0;
      if (lower.includes('invoice')) return 1;
      return 2;
    } catch {
      return 2;
    }
  }

  function sortByMarketingInvoicePreference(urls: string[]): string[] {
    // Sort by preference asc (marketing -> invoice -> other), then by date desc (latest first)
    return [...urls].sort((a, b) => {
      const pa = getNamePriorityFromUrl(a);
      const pb = getNamePriorityFromUrl(b);
      if (pa !== pb) return pa - pb;
      const fa = (a.split('/')?.pop() || '');
      const fb = (b.split('/')?.pop() || '');
      // newer first
      return extractDateFromFilename(fb) - extractDateFromFilename(fa);
    });
  }





  const [lastUsdRate, setLastUsdRate] = useState<number | null>(null);
  const [lastEurRate, setLastEurRate] = useState<number | null>(null);

  // Fetch last USD/EUR rates using RateTbList approach and expose as callback
  const fetchLastUsdRate = useCallback(async () => {
    try {
      const res = await axios.get("/rate-tb");
      const rows: any[] = Array.isArray(res.data) ? res.data : [];
      // Keep only USD/EUR rows and pick the one with highest Id_Ex for each
      let latestUsd: any | null = null;
      let latestEur: any | null = null;
      for (const item of rows) {
        if (!item) continue;
        const currency = (item.currency || item.Currency || "").toString();
        const upper = currency.toUpperCase();
        const id = Number(item.Id_Ex);
        if (!Number.isFinite(id)) continue;

        if (upper === "USD") {
          if (!latestUsd || id > Number(latestUsd.Id_Ex)) {
            latestUsd = item;
          }
        } else if (upper === "EUR") {
          if (!latestEur || id > Number(latestEur.Id_Ex)) {
            latestEur = item;
          }
        }
      }
      if (latestUsd && (latestUsd.rate !== undefined && latestUsd.rate !== null)) {
        setLastUsdRate(Number(latestUsd.rate));
      } else {
        setLastUsdRate(null);
      }

      if (latestEur && (latestEur.rate !== undefined && latestEur.rate !== null)) {
        setLastEurRate(Number(latestEur.rate));
      } else {
        setLastEurRate(null);
      }
    } catch (e) {
      setLastUsdRate(null);
      setLastEurRate(null);
    }
  }, []);

  // useEffect to run initial fetch and poll periodically
  useEffect(() => {
    let mounted = true;
    // call once immediately
    fetchLastUsdRate();
    // poll every 60s
    const id = window.setInterval(() => {
      if (mounted) fetchLastUsdRate();
    }, 10000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [fetchLastUsdRate]);

  // Fetch gold spot (USD/oz and USD/g) via backend proxy and public fallbacks
  const fetchGoldSpot = useCallback(async () => {
    try {
      let success = false;
      let lastErr: any = null;
      const results: Array<{ usdPerOz: number; usdPerGram: number; source: string; updatedAt: Date }> = [];
      const base = (process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_IP || "https://system.gaja.ly/api").replace(/\/+$/, "");

      // 1) Try backend proxy
      try {
        const r = await fetch(base + "/external/gold-spot", { method: "GET", credentials: "include" });
        if (r.ok) {
          const data = await r.json();
          if (data && typeof data.usdPerOz === "number" && data.usdPerOz > 0) {
            results.push({
              usdPerOz: data.usdPerOz,
              usdPerGram: typeof data.usdPerGram === "number" ? data.usdPerGram : data.usdPerOz / 31.1034768,
              source: data.source || "proxy",
              updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
            });
            success = true;
          } else {
            lastErr = new Error("Proxy returned no numeric usdPerOz");
          }
        } else {
          lastErr = new Error(`Proxy HTTP ${r.status}`);
        }
      } catch (e: any) {
        lastErr = e;
      }

      // 2) metals.live fallback
      const tryMetalsLive = async () => {
        try {
          const r2 = await fetch("https://api.metals.live/v1/spot/gold", { method: "GET" });
          if (!r2.ok) throw new Error(`metals.live HTTP ${r2.status}`);
          const arr = await r2.json();
          if (Array.isArray(arr)) {
            let price: number | null = null;
            for (let i = arr.length - 1; i >= 0; i--) {
              const it = arr[i];
              if (it && typeof it === "object" && "price" in it) {
                const p = Number((it as any).price);
                if (!Number.isNaN(p) && p > 0) { price = p; break; }
              } else if (Array.isArray(it) && it.length >= 2) {
                const p = Number(it[1]);
                if (!Number.isNaN(p) && p > 0) { price = p; break; }
              }
            }
            if (price) {
              results.push({ usdPerOz: price, usdPerGram: price / 31.1034768, source: "metals.live", updatedAt: new Date() });
              return true;
            }
          }
        } catch (e: any) { lastErr = e; }
        return false;
      };
      if (!success) success = await tryMetalsLive();

      // 3) goldprice.org fallback
      const tryGoldPriceOrg = async () => {
        try {
          const r3 = await fetch("https://data-asg.goldprice.org/dbXRates/USD", { method: "GET" });
          if (!r3.ok) throw new Error(`goldprice.org HTTP ${r3.status}`);
          const data3 = await r3.json();
          const items = (data3 && (data3 as any).items) as any[];
          if (Array.isArray(items) && items.length) {
            const p = Number((items[0] as any).xauPrice || (items[0] as any).xauPrice24h || (items[0] as any).xauPricel3m);
            if (!Number.isNaN(p) && p > 0) {
              results.push({ usdPerOz: p, usdPerGram: p / 31.1034768, source: "goldprice.org", updatedAt: new Date() });
              return true;
            }
          }
        } catch (e: any) { lastErr = e; }
        return false;
      };
      if (!success) success = await tryGoldPriceOrg();

      if (success && results.length) {
        const preferred = results.find((r) => r.source === "proxy") || results[0];
        setGoldPrice(preferred);
        try { localStorage.setItem("goldSpotCache", JSON.stringify(preferred)); } catch { }
      } else {
        let cached: any = null;
        try { const raw = localStorage.getItem("goldSpotCache"); if (raw) cached = JSON.parse(raw); } catch { }
        if (cached && typeof cached.usdPerOz === "number") {
          setGoldPrice({
            usdPerOz: cached.usdPerOz,
            usdPerGram: cached.usdPerGram,
            updatedAt: cached.updatedAt ? new Date(cached.updatedAt) : new Date(),
            source: (cached.source || "cache") + " (cached)",
            error: lastErr ? lastErr.message : "Live fetch failed",
          });
        } else {
          throw lastErr || new Error("All gold price sources failed");
        }
      }
    } catch (e: any) {
      setGoldPrice({ error: e?.message || "Failed to fetch gold price" });
    }
  }, []);

  // useEffect to run initial fetch for gold spot and poll periodically
  useEffect(() => {
    let mounted = true;
    fetchGoldSpot();
    const id = window.setInterval(() => { if (mounted) fetchGoldSpot(); }, 10000);
    return () => { mounted = false; clearInterval(id); };
  }, [fetchGoldSpot]);



  // Select preferred image index: marketing -> invoice -> newest
  function pickPreferredImageIndex(urls: string[]): number {
    if (!Array.isArray(urls) || urls.length === 0) return 0;
    const byName = (needle: string) =>
      urls
        .map((u, i) => ({ u, i }))
        .filter(({ u }) => {
          const base = (u || '').split('?')[0];
          const file = base.split('/').pop() || base;
          return file.toLowerCase().includes(needle);
        })
        .sort((a, b) => {
          const fa = (a.u.split('/')?.pop() || '');
          const fb = (b.u.split('/')?.pop() || '');
          return extractDateFromFilename(fb) - extractDateFromFilename(fa);
        });
    const marketing = byName('marketing');
    if (marketing.length > 0) return marketing[0].i;
    const invoice = byName('invoice');
    if (invoice.length > 0) return invoice[0].i;
    // else pick newest overall by filename date
    let bestIdx = 0;
    let bestTs = -Infinity;
    urls.forEach((u, i) => {
      const f = (u.split('/')?.pop() || '');
      const ts = extractDateFromFilename(f);
      if (ts > bestTs) {
        bestTs = ts;
        bestIdx = i;
      }
    });
    return bestIdx;
  }

  const IMAGE_BASES = (() => {
    const unique = new Set<string>();
    const add = (s: string) => {
      const v = String(s || "").trim().replace(/\/+$/, "");
      if (v) unique.add(v);
    };
    const candidates: string[] = [];
    const envBase =
      (process.env.REACT_APP_API_BASE_URL ||
        process.env.REACT_APP_API_IP ||
        axios.defaults.baseURL ||
        "")
        .toString()
        .trim();
    if (envBase) candidates.push(envBase);
    candidates.push(window.location.origin);

    for (const c of candidates) {
      let origin = "";
      try {
        origin = new URL(c).origin;
      } catch {
        origin = c.replace(/\/+$/, "");
      }
      if (!origin) continue;
      add(`${origin}/images`);
      add(`${origin}/api/images`);
      // If base already contains /api, still ensure non-api images base exists
      add(origin.replace(/\/+$/, "") + "/images");
    }

    return Array.from(unique);
  })();

  const fetchImages = async (
    id_achat: number,
    kind?: "diamond" | "watch" | "gold",
    storeKeyOverride?: string
  ): Promise<string[] | null> => {
    const token = localStorage.getItem("token");
    if (!token || !id_achat) {
      console.debug('[fetchImages] skip: missing token or id', { id_achat, kind, hasToken: !!token });
      return null;
    }
    // Avoid refetch if already loaded (even empty array marks attempted)
    const nsKey = storeKeyOverride || getImageKey(kind, id_achat);
    // If we already have a non-empty list, don't refetch.
    // IMPORTANT: empty list should NOT block retries (gold often needs fallbacks id_achat -> id_fact).
    if (Array.isArray(imageUrls[nsKey]) && imageUrls[nsKey].length > 0) return imageUrls[nsKey];

    const tryEndpoints: string[] = [];
    for (const base of IMAGE_BASES) {
      if (kind === "diamond") {
        tryEndpoints.push(`${base}/list/diamond/${id_achat}`);
        tryEndpoints.push(`${base}/list/${id_achat}`); // fallback
      } else if (kind === "watch") {
        // Be explicit for watches: only read from WatchPic
        tryEndpoints.push(`${base}/list/watch/${id_achat}`);
        // Fallback to legacy watch list just in case
        tryEndpoints.push(`${base}/list/${id_achat}`);
      } else if (kind === "gold") {
        // Gold specific endpoint then generic legacy
        tryEndpoints.push(`${base}/list/gold/${id_achat}`);
        tryEndpoints.push(`${base}/list/${id_achat}`);
      }
    }

    for (const ep of tryEndpoints) {
      try {
        console.debug('[fetchImages] requesting', { ep, id_achat, kind });
        const res = await axios.get(ep, {
          headers: { Authorization: `Bearer ${token}` },
        });
        let urls: string[] = normalizeImageList(res.data);
        // For diamond type, sort images by creation date (if possible) and show last image as default
        if (kind === "diamond") {
          // Keep all images; sort by date/name for stable ordering
          urls = urls.sort((a, b) => {
            const fa = a.split("/").pop() || "";
            const fb = b.split("/").pop() || "";
            return extractDateFromFilename(fa) - extractDateFromFilename(fb);
          });
        } else if (kind === "gold") {
          // For gold, prioritize filenames containing 'marketing', then 'invoice', then others; latest first within group
          urls = sortByMarketingInvoicePreference(urls);
        } else if (kind === "watch") {
          // Keep all images; sort by date/name for stable ordering
          urls = urls.sort((a, b) => {
            const fa = a.split("/").pop() || "";
            const fb = b.split("/").pop() || "";
            return extractDateFromFilename(fa) - extractDateFromFilename(fb);
          });
        }
        console.debug('[fetchImages] received', { nsKey, urlsLength: urls.length, sample: urls[0] });
        setImageUrls((prev) => ({ ...prev, [nsKey]: urls }));
        // await Promise.all(urls.map((url) => fetchImageWithAuth(url, token)));
        return urls;
      } catch (e) {
        console.debug('[fetchImages] endpoint error', { ep, err: (e as any)?.message });
      }
    }
    // Mark attempted (empty). Candidate-id fetchers may still retry with another id and override.
    setImageUrls((prev) => ({ ...prev, [nsKey]: [] }));
    console.debug('[fetchImages] no urls found, set empty for', nsKey);

    return null;
  };

  // const   Type  = 'gold';
  // Replace useLocation state with localStorage
  // Get ps and Cuser from localStorage 'user' object if available, else fallback to individual keys
  let ps: string | null = null;
  let Cuser: string | null = null;
  const userStr = localStorage.getItem("user");
  if (userStr) {
    try {
      const userObj = JSON.parse(userStr);
      ps = userObj.ps ?? localStorage.getItem("ps");
      Cuser = userObj.Cuser ?? localStorage.getItem("Cuser");
    } catch {
      ps = localStorage.getItem("ps");
      Cuser = localStorage.getItem("Cuser");
    }
  } else {
    ps = localStorage.getItem("ps");
    Cuser = localStorage.getItem("Cuser");
  }
  // Determine admin status using the same role logic as Profile/Home.tsx
  const isAdmin = (() => {
    try {
      if (hasRole("admin") || hasRole("ADMIN") || hasRole("Admin")) return true;
      const raw = localStorage.getItem("user");
      if (!raw) return false;
      const u = JSON.parse(raw);
      const type = String(u?.TYPE_USER ?? u?.type_user ?? u?.type ?? u?.role ?? "").toLowerCase();
      return type === "admin";
    } catch {
      return false;
    }
  })();
  const [data, setData] = useState<InventoryItem[]>([]);

  const [Sm, setSm] = useState<Sm[]>([]);

  const [customers, setCustomers] = useState<Client[]>([]);

  const apiIp = process.env.REACT_APP_API_IP || process.env.REACT_APP_API_BASE_URL || "";
  const apiUrlcustomers = `/customers`;

  const fetchCustomers = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get<Client[]>(`${apiUrlcustomers}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCustomers(res.data);
    } catch (error) { }
  };

  const fetchSms = async () => {
    const apiUrlsm = "/sm";
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get<Sm[]>(`${apiUrlsm}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSm(res.data);
    } catch (error) { }
  };

  const [datainv, setDatainv] = useState<Invoice[]>([]);

  // Memoized calculations for cart totals display
  const goldWeightTotal = React.useMemo(() => {
    if (!Array.isArray(datainv)) return 0;
    return datainv.reduce((sum: number, item: any) => {
      if (item?.IS_GIFT) return sum;
      const supplierType = String(
        item?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || ""
      ).toLowerCase();
      if (!supplierType.includes("gold")) return sum;
      const weight = Number(item?.qty ?? item?.Weight ?? 0);
      if (!Number.isFinite(weight)) return sum;
      return sum + weight;
    }, 0);
  }, [datainv]);

  const diamondItemCount = React.useMemo(() => {
    if (!Array.isArray(datainv)) return 0;
    return datainv.reduce((count: number, item: any) => {
      if (item?.IS_GIFT) return count;
      const supplierType = String(
        item?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || ""
      ).toLowerCase();
      return supplierType.includes("diamond") ? count + 1 : count;
    }, 0);
  }, [datainv]);

  const watchItemCount = React.useMemo(() => {
    if (!Array.isArray(datainv)) return 0;
    return datainv.reduce((count: number, item: any) => {
      if (item?.IS_GIFT) return count;
      const supplierType = String(
        item?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || ""
      ).toLowerCase();
      return supplierType.includes("watch") ? count + 1 : count;
    }, 0);
  }, [datainv]);

  const [issuedInvoicesOpen, setIssuedInvoicesOpen] = useState(false);
  const [issuedInvoicesLoading, setIssuedInvoicesLoading] = useState(false);
  const [issuedInvoices, setIssuedInvoices] = useState<Invoice[]>([]);
  const [issuedDeleteConfirm, setIssuedDeleteConfirm] = useState<{ open: boolean; numFact: number | null }>({
    open: false,
    numFact: null,
  });
  const [issuedDeleteLoading, setIssuedDeleteLoading] = useState(false);
  const [issuedReissueConfirm, setIssuedReissueConfirm] = useState<{ open: boolean; numFact: number | null }>({
    open: false,
    numFact: null,
  });
  const [issuedReissueLoading, setIssuedReissueLoading] = useState(false);

  const [emptyCartConfirmOpen, setEmptyCartConfirmOpen] = useState(false);
  const [emptyCartLoading, setEmptyCartLoading] = useState(false);

  const [carouselIndex, setCarouselIndex] = useState<Record<string, number>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Move typeFilter state above fetchData and useEffect
  const [typeFilter, setTypeFilter] = useState<string>("gold");
  // Cost range filter state
  const [costMin, setCostMin] = useState<string>("");
  const [costMax, setCostMax] = useState<string>("");
  // Sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(true);
  // Brand filter state
  const [brandFilter, setBrandFilter] = useState<string>("");
  // General_Comment filter state
  const [generalCommentFilter, setGeneralCommentFilter] = useState<string>("");
  // Gold-only filters
  const [goldWeightMin, setGoldWeightMin] = useState<string>("");
  const [goldWeightMax, setGoldWeightMax] = useState<string>("");
  const [goldIdMin, setGoldIdMin] = useState<string>("");
  const [goldIdMax, setGoldIdMax] = useState<string>("");
  const [goldColorRush, setGoldColorRush] = useState<string>(""); // Stone
  const [goldColorGold, setGoldColorGold] = useState<string>(""); // Color
  const [goldSeniority, setGoldSeniority] = useState<string>(""); // '', 'last7d','last1m','last3m','last6m','last1y','last2y','gt2y'
  const [goldWeightSort, setGoldWeightSort] = useState<string>(""); // '', 'asc', 'desc'
  const [goldTypeFilters, setGoldTypeFilters] = useState<string[]>([]); // multi-select supplier types for gold
  // Diamond-only filters
  const [diamondIdFilter, setDiamondIdFilter] = useState<string>("");

  // (Removed distinct lists; using free-text inputs for stone/color)
  // Compute distinct brands from data
  // Helper to get display brand name
  function getBrandName(row: any): string {
    // Try Fournisseur first
    if (row.Fournisseur && typeof row.Fournisseur.client_name === "string")
      return row.Fournisseur.client_name;
    if (row.Fournisseur && typeof row.Fournisseur.brand_name === "string")
      return row.Fournisseur.brand_name;
    // Try diamond/watch objects
    let dp = row.DistributionPurchase;
    if (Array.isArray(dp) && dp.length > 0) {
      const diamond = dp[0]?.OriginalAchatDiamond;
      const watch = dp[0]?.OriginalAchatWatch;
      if (diamond && typeof diamond.client_name === "string")
        return diamond.client_name;
      if (diamond && typeof diamond.brand_name === "string")
        return diamond.brand_name;
      if (watch && typeof watch.client_name === "string")
        return watch.client_name;
      // For watch purchases, prefer common_local_brand as display name
      if (watch && typeof watch.common_local_brand === "string" && watch.common_local_brand)
        return watch.common_local_brand;
      // Some datasets may keep only a numeric Brand id; as a last resort, show it
      if (watch && typeof watch.Brand === "number")
        return `Brand ${watch.Brand}`;
    } else if (dp && typeof dp === "object") {
      const diamond = dp.OriginalAchatDiamond;
      const watch = dp.OriginalAchatWatch;
      if (diamond && typeof diamond.client_name === "string")
        return diamond.client_name;
      if (diamond && typeof diamond.brand_name === "string")
        return diamond.brand_name;
      if (watch && typeof watch.client_name === "string")
        return watch.client_name;
      if (watch && typeof watch.common_local_brand === "string" && watch.common_local_brand)
        return watch.common_local_brand;
      if (watch && typeof watch.Brand === "number")
        return `Brand ${watch.Brand}`;
    }
    // Fallbacks
    if (typeof row.client_name === "string" && row.client_name)
      return row.client_name;
    return "";
  }

  const distinctBrands = React.useMemo(() => {
    const brands = new Set<string>();
    const arr = Array.isArray(data) ? data : [];
    arr.forEach((row) => {
      const brand = getBrandName(row);
      if (brand) brands.add(brand);
    });
    return Array.from(brands).sort();
  }, [data]);


  // Distinct gold types (based on Fournisseur.TYPE_SUPPLIER) for dropdown
  const distinctGoldTypes = React.useMemo(() => {
    const types = new Set<string>();
    const arr = Array.isArray(data) ? data : [];
    arr.forEach((row) => {
      const ts = (row.Fournisseur?.TYPE_SUPPLIER || '').toString().trim();
      if (ts) types.add(ts);
    });
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const fetchData = useCallback(
    async (typeParam = typeFilter) => {
      if (!typeParam) {
        typeParam = "Watch";
      }
      if (typeof typeFilter === "undefined" || typeFilter === null) return;
      setLoading(true);

      const token = localStorage.getItem("token");
      if (!token) return navigate("/");

      try {
        const response = await axios.get(
          "/Inventory/allActive",
          {
            headers: { Authorization: `Bearer ${token}` },
            params: { ps, type_supplier: typeParam },
          }
        );

        // backend shape: { success: true, count: 658, purchases: [...] }
        const payload: any = response.data;

        const rawList: any[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.purchases)
          ? payload.purchases
          : [];

        // Normalize property names so the rest of your code keeps working
        const list: InventoryItem[] = rawList.map((row: any) => ({
          ...row,
          // map Supplier → Fournisseur (your code expects Fournisseur)
          Fournisseur: row.Fournisseur ?? row.Supplier ?? null,
          // map Distribution → DistributionPurchase if needed
          DistributionPurchase: row.DistributionPurchase ?? row.Distribution ?? null,
        }));

        setData(list);

        // Debug: log gold API response

      } catch (error: any) {
        if (error.response?.status === 401) navigate("/");
      } finally {
        setLoading(false);
      }
    },
    [navigate, ps, typeFilter]
  );

  // Pagination + view state (must be declared before useEffects that reference them)
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);
  const [gridView, setGridView] = useState<"3" | "4" | "5" | "6" | "8" | "icons">(
    typeFilter === "gold" ? "3" : "4"
  );
  const [viewAnchorEl, setViewAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    fetchData("gold");
    fetchDataINV();
    fetchCustomers();
    fetchSms();
    // Adjust pagination defaults for gold type
    setRowsPerPage(12);
    // Intentionally not listing fetchCustomers/fetchSms/fetchDataINV since they are stable within this module
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (gridView === "icons") {
      setRowsPerPage(24);
      setPage(0);
      return;
    }

    if (gridView === "3" || gridView === "4" || gridView === "5" || gridView === "6" || gridView === "8") {
      setRowsPerPage(12);
      setPage(0);
    }
  }, [gridView]);

  // Add state for image dialog and selected image
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  // const [selectedImage, setSelectedImage] = useState<string | null>(null); // unused
  // New state for dialog image navigation
  const [dialogImageList, setDialogImageList] = useState<string[]>([]);
  const [dialogImageIndex, setDialogImageIndex] = useState(0);
  const [dialogZoom, setDialogZoom] = useState(1);
  const [dialogPan, setDialogPan] = useState({ x: 0, y: 0 });
  const dialogPanStartRef = useRef<{ x: number; y: number } | null>(null);
  const dialogPointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const [dialogIsPanning, setDialogIsPanning] = useState(false);
  const [dialogItem, setDialogItem] = useState<InventoryItem | null>(null);

  useEffect(() => {
    if (imageDialogOpen) {
      setDialogZoom(1);
      setDialogPan({ x: 0, y: 0 });
      setDialogIsPanning(false);
      dialogPanStartRef.current = null;
      dialogPointerStartRef.current = null;
    }
  }, [imageDialogOpen]);

  useEffect(() => {
    if (!dialogIsPanning) return;
    const onMove = (e: PointerEvent) => {
      if (!dialogPanStartRef.current || !dialogPointerStartRef.current) return;
      const dx = e.clientX - dialogPointerStartRef.current.x;
      const dy = e.clientY - dialogPointerStartRef.current.y;
      setDialogPan({
        x: dialogPanStartRef.current.x + dx,
        y: dialogPanStartRef.current.y + dy,
      });
    };
    const onUp = () => {
      setDialogIsPanning(false);
      dialogPanStartRef.current = null;
      dialogPointerStartRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dialogIsPanning]);

  // Charges dialog (admin only)
  const [chargesDialogOpen, setChargesDialogOpen] = useState(false);
  const [chargesDialogRow, setChargesDialogRow] = useState<any | null>(null);

  const getPreferredImageKey = React.useCallback(
    (kind: "gold" | "diamond" | "watch", id: any) =>
      `prefImg:${kind}:${String(id ?? "").trim()}`,
    []
  );

  const pickPreferredIndexWithOverride = React.useCallback(
    (urls: string[], kind?: "gold" | "diamond" | "watch", id?: any) => {
      try {
        if (kind && id != null) {
          const prefRaw = localStorage.getItem(getPreferredImageKey(kind, id)) || "";
          const pref = canonicalizePrefUrl(prefRaw, kind, id);
          if (pref) {
            const idx = urls.findIndex((u) => canonicalizePrefUrl(String(u), kind, id) === pref);
            if (idx >= 0) return idx;
          }
        }
      } catch {
        // ignore
      }
      return pickPreferredImageIndex(urls);
    },
    [getPreferredImageKey]
  );

  const normalizeDialogUrls = React.useCallback(
    (raw: any): string[] => {
      const list = normalizeImageList(raw);
      return list.map((u) => toApiImageAbsolute(String(u)));
    },
    [normalizeImageList]
  );

  const handleViewImage = (row: InventoryItem) => {
    // Determine whether row has diamond or watch purchase to choose endpoint
    let dp: any = row.DistributionPurchase;
    let diamond: any;
    let watch: any;
    let gold: any;
    let idAchat: any;
    if (Array.isArray(dp) && dp.length > 0) {
      diamond = dp[0]?.OriginalAchatDiamond;
      watch = dp[0]?.OriginalAchatWatch;
      gold = dp.find((d: any) => d?.GoldOriginalAchat)?.GoldOriginalAchat;
    } else if (dp && typeof dp === "object") {
      diamond = dp?.OriginalAchatDiamond;
      watch = dp?.OriginalAchatWatch;
      gold = (dp as any)?.GoldOriginalAchat;
    }
    if (diamond?.id_achat) idAchat = diamond.id_achat;
    else if (watch?.id_achat) idAchat = watch.id_achat;
    else if (gold?.id_achat) idAchat = gold.id_achat;
    else idAchat = row.id_fact;
    const kind: "diamond" | "watch" | "gold" | undefined = diamond?.id_achat
      ? "diamond"
      : watch?.id_achat
        ? "watch"
        : (row.Fournisseur?.TYPE_SUPPLIER || "").toLowerCase().includes("gold")
          ? "gold"
          : undefined;
    const key = getImageKey(kind, idAchat);
    let urls = imageUrls[key] || [];
    urls = normalizeDialogUrls(urls);
    // If diamond type, apply preferred selection logic for default image
    if (kind === "gold") {
      // Filter out group images; pick marketing -> invoice -> newest
      const filteredUrls = urls.filter((u) => !/group/i.test(u));
      if (filteredUrls.length === 0) {
        setDialogImageList(urls);
        setDialogImageIndex(pickPreferredIndexWithOverride(urls, kind, idAchat));
      } else {
        setDialogImageList(filteredUrls);
        setDialogImageIndex(
          pickPreferredIndexWithOverride(filteredUrls, kind, idAchat)
        );
      }
    } else {
      setDialogImageList(urls);
      setDialogImageIndex(pickPreferredIndexWithOverride(urls, kind, idAchat));
    }
    setDialogItem(row);
    setImageDialogOpen(true);
  };

  // Add search state
  const [search, setSearch] = useState("");

  // Filtered data based on search (matches all fields) and cost range
  const filteredData = (Array.isArray(data) ? data : []).filter((row) => {
    // Hide items that are already present in the current cart
    const isAlreadyInCart = datainv.some((inv) => {
      if (inv.id_art === row.id_fact) return true;
      const achat = inv.ACHATs?.[0];
      // Fallbacks: sometimes the inventory id might live under ACHATs
      if (achat && (achat as any).id_fact && (achat as any).id_fact === row.id_fact) return true;
      if (achat && (achat as any).id_art && (achat as any).id_art === row.id_fact) return true;
      return false;
    });
    if (isAlreadyInCart) return false;

    const searchLower = search.trim().toLowerCase();
    // Cost filter logic: check top-level and nested price fields
    let cost = 0;
    if (typeof row.Cost_Currency === "number" && row.Cost_Currency > 0)
      cost = row.Cost_Currency;
    else if (
      typeof row.Selling_Price_Currency === "number" &&
      row.Selling_Price_Currency > 0
    )
      cost = row.Selling_Price_Currency;
    else {
      // Check nested diamond/watch price fields
      let dp = row.DistributionPurchase;
      if (Array.isArray(dp) && dp.length > 0) {
        const diamond = dp[0]?.OriginalAchatDiamond;
        const watch = dp[0]?.OriginalAchatWatch;
        if (
          diamond &&
          typeof diamond.sale_price === "number" &&
          diamond.sale_price > 0
        )
          cost = diamond.sale_price;
        else if (
          watch &&
          typeof watch.sale_price === "number" &&
          watch.sale_price > 0
        )
          cost = watch.sale_price;
      } else if (dp && typeof dp === "object") {
        const diamond = (dp as any).OriginalAchatDiamond;
        const watch = (dp as any).OriginalAchatWatch;
        if (
          diamond &&
          typeof diamond.sale_price === "number" &&
          diamond.sale_price > 0
        )
          cost = diamond.sale_price;
        else if (
          watch &&
          typeof watch.sale_price === "number" &&
          watch.sale_price > 0
        )
          cost = watch.sale_price;
      }
    }
    let min = costMin ? Number(costMin) : null;
    let max = costMax ? Number(costMax) : null;
    const costOk =
      (min === null || cost >= min) && (max === null || cost <= max);

    // Type filter logic
    const supplierType =
      row.Fournisseur?.TYPE_SUPPLIER ||
      row.Supplier?.TYPE_SUPPLIER ||
      "";

    const typeOk =
      !typeFilter ||
      supplierType.toLowerCase().includes(typeFilter.toLowerCase());


    // Brand filter logic
    const brandValue = getBrandName(row).toLowerCase();
    const brandOk =
      brandFilter === "" || brandValue.includes(brandFilter.toLowerCase());

    // General_Comment filter logic (used mainly for diamond groups)
    const generalCommentValue = (row.General_Comment || "").toLowerCase();
    let generalCommentOk = true;
    if ((typeFilter || "").toLowerCase() === "diamond") {
      // If 'الكل' is selected, show only items with unite > 1
      if (generalCommentFilter === "") {
        generalCommentOk = true;
      } else if (generalCommentFilter === "الكل") {
        // Check if Unite contains more than one item (comma-separated inside curly braces)
        if (
          typeof row.Unite === "string" &&
          row.Unite.startsWith("{") &&
          row.Unite.endsWith("}")
        ) {
          const items = row.Unite.slice(1, -1)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          generalCommentOk = items.length > 1;
        } else {
          generalCommentOk = false;
        }
      } else {
        generalCommentOk = generalCommentValue.includes(
          generalCommentFilter.toLowerCase()
        );
      }
    }

    // Diamond-specific ID/group filter
    let diamondExtraOk = true;
    if ((typeFilter || "").toLowerCase() === "diamond" && diamondIdFilter.trim() !== "") {
      const targetRaw = diamondIdFilter.trim();
      const targetNum = Number(targetRaw);

      const matchesIdFact = Number(row.id_fact) === targetNum;
      const matchesIdArt = Number((row as any).id_art) === targetNum;

      let matchesUnite = false;
      if (
        typeof (row as any).Unite === "string" &&
        (row as any).Unite.startsWith("{") &&
        (row as any).Unite.endsWith("}")
      ) {
        const ids = (row as any).Unite.slice(1, -1)
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
        matchesUnite = ids.includes(targetRaw);
      }

      let matchesDiamondAchat = false;
      const dpAny: any = (row as any).DistributionPurchase;
      if (Array.isArray(dpAny) && dpAny.length > 0) {
        const diamond = dpAny[0]?.OriginalAchatDiamond;
        if (diamond && typeof diamond.id_achat !== "undefined") {
          matchesDiamondAchat = Number(diamond.id_achat) === targetNum;
        }
      } else if (dpAny && typeof dpAny === "object") {
        const diamond = dpAny.OriginalAchatDiamond;
        if (diamond && typeof diamond.id_achat !== "undefined") {
          matchesDiamondAchat = Number(diamond.id_achat) === targetNum;
        }
      }

      diamondExtraOk = matchesIdFact || matchesIdArt || matchesUnite || matchesDiamondAchat;
    }

    // Gold-specific extra filters
    let goldOk = true;
    if ((typeFilter || '').toLowerCase().includes('gold')) {
      const isGold = (row.Fournisseur?.TYPE_SUPPLIER || '').toLowerCase().includes('gold');
      if (isGold) {
        // Weight filter
        const w = Number(row.qty || 0);
        const wMin = goldWeightMin ? Number(goldWeightMin) : null;
        const wMax = goldWeightMax ? Number(goldWeightMax) : null;
        if ((wMin !== null && !(w >= wMin)) || (wMax !== null && !(w <= wMax))) goldOk = false;

        // ID range filter
        const idMin = goldIdMin ? Number(goldIdMin) : null;
        const idMax = goldIdMax ? Number(goldIdMax) : null;
        if ((idMin !== null && !(row.id_fact >= idMin)) || (idMax !== null && !(row.id_fact <= idMax))) goldOk = false;

        // Color filters (substring match, case-insensitive)
        if (goldColorRush) {
          const v = (row.Color_Rush || '').toString().toLowerCase();
          if (!v || !v.includes(goldColorRush.toLowerCase())) goldOk = false;
        }
        if (goldColorGold) {
          const v = (row.Color_Gold || '').toString().toLowerCase();
          if (!v || !v.includes(goldColorGold.toLowerCase())) goldOk = false;
        }

        // Seniority filter by date (strictly from date_fact in ACHAT table)
        if (goldSeniority) {
          const dateStr = (row.date_fact || '').toString();
          const d = dateStr ? new Date(dateStr) : null;
          if (!d || isNaN(d.getTime())) {
            goldOk = false;
          } else {
            const now = new Date();
            const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
            const within = (days: number) => diffDays <= days;
            switch (goldSeniority) {
              case 'last7d':
                goldOk = within(7);
                break;
              case 'last1m':
                goldOk = within(30);
                break;
              case 'last3m':
                goldOk = within(90);
                break;
              case 'last6m':
                goldOk = within(180);
                break;
              case 'last1y':
                goldOk = within(365);
                break;
              case 'last2y':
                goldOk = within(730);
                break;
              case 'gt2y':
                goldOk = diffDays > 730;
                break;
              default:
                goldOk = true;
            }
          }
        }

        // Type filter by supplier type (Fournisseur.TYPE_SUPPLIER) - multi-select
        if (goldTypeFilters && goldTypeFilters.length > 0) {
          const t = (row.Fournisseur?.TYPE_SUPPLIER || '').toString().toLowerCase();
          const anyMatch = goldTypeFilters.some(sel => t.includes(sel.toLowerCase()));
          if (!anyMatch) goldOk = false;
        }
      }
    }

    if (!searchLower) return typeOk && costOk && brandOk && generalCommentOk && goldOk && diamondExtraOk;
    // Add to filter panel UI (JSX):
    // <TextField
    //   select
    //   label="General Comment Filter"
    //   value={generalCommentFilter}
    //   onChange={e => setGeneralCommentFilter(e.target.value)}
    //   variant="outlined"
    //   size="small"
    //   style={{ minWidth: 160, marginRight: 8 }}
    // >
    //   <MenuItem value="">All</MenuItem>
    //   <MenuItem value="توينز">توينز</MenuItem>
    //   <MenuItem value="سيت">سيت</MenuItem>
    //   <MenuItem value="طاقم">طاقم</MenuItem>
    // </TextField>

    // Recursively flatten all values in the row object
    function flattenValues(obj: any): string[] {
      let values: string[] = [];
      if (obj == null) return values;
      if (typeof obj === "object") {
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            values = values.concat(flattenValues(obj[key]));
          }
        }
      } else {
        values.push(String(obj));
      }
      return values;
    }

    const allValues = flattenValues(row).map((v) => v.toLowerCase());
    return (
      allValues.some((v) => v.includes(searchLower)) &&
      typeOk &&
      costOk &&
      brandOk &&
      goldOk &&
      diamondExtraOk
    );
  });

  // Sort filteredData; for gold, allow sorting by weight
  const sortedData = (() => {
    const arr = [...filteredData];
    const isGold = (typeFilter || "").toLowerCase().includes("gold");
    if (isGold && goldWeightSort) {
      arr.sort((a, b) => {
        const wa = Number(a.qty || 0);
        const wb = Number(b.qty || 0);
        if (goldWeightSort === "asc") return wa - wb;
        if (goldWeightSort === "desc") return wb - wa;
        return 0;
      });
      // Tiebreaker by brand to keep stable grouping
      arr.sort((a, b) => {
        const wa = Number(a.qty || 0);
        const wb = Number(b.qty || 0);
        if (wa !== wb) return 0; // already ordered by weight
        const brandA = getBrandName(a).toLowerCase();
        const brandB = getBrandName(b).toLowerCase();
        if (brandA < brandB) return -1;
        if (brandA > brandB) return 1;
        return 0;
      });
      return arr;
    }
    // Default: sort by brand name
    arr.sort((a, b) => {
      const brandA = getBrandName(a).toLowerCase();
      const brandB = getBrandName(b).toLowerCase();
      if (brandA < brandB) return -1;
      if (brandA > brandB) return 1;
      return 0;
    });
    return arr;
  })();
  const paginatedData = sortedData.slice(
    page * rowsPerPage,
    (page + 1) * rowsPerPage
  );
  // Fetch images for current page and datainv (cart)
  useEffect(() => {
    const requested = new Set<string>();
    paginatedData.forEach((row) => {
      let dp: any = row.DistributionPurchase;
      let diamond: any;
      let watch: any;
      if (Array.isArray(dp) && dp.length > 0) {
        diamond = dp[0]?.OriginalAchatDiamond;
        watch = dp[0]?.OriginalAchatWatch;
      } else if (dp && typeof dp === "object") {
        diamond = dp?.OriginalAchatDiamond;
        watch = dp?.OriginalAchatWatch;
      }
      const id_achat: number | null =
        diamond?.id_achat || watch?.id_achat || null;
      const kind: "diamond" | "watch" | undefined = diamond?.id_achat
        ? "diamond"
        : watch?.id_achat
          ? "watch"
          : undefined;
      if (id_achat) {
        const key = getImageKey(kind, id_achat);
        if (imageUrls[key] === undefined && !requested.has(key)) {
          fetchImages(id_achat, kind);
          requested.add(key);
        }
      }
      // Gold items: fetch by id_fact using gold endpoint
      const typeSupplier = row.Fournisseur?.TYPE_SUPPLIER?.toLowerCase() || "";
      if (typeSupplier.includes("gold")) {
        const goldDp: any = row.DistributionPurchase;
        const goldObj = Array.isArray(goldDp) && goldDp.length > 0
          ? goldDp.find((d: any) => d?.GoldOriginalAchat)?.GoldOriginalAchat || goldDp[0]?.GoldOriginalAchat
          : (goldDp && typeof goldDp === 'object' ? (goldDp as any).GoldOriginalAchat : null);
        const candidates = [
          goldObj?.id_achat,
          (row as any).id_art,
          (row as any).picint,
          row.id_fact,
        ]
          .map((v) => Number(v || 0))
          .filter((v) => v > 0);
        const storeId = candidates[0];
        if (storeId) {
          const storeKey = getImageKey("gold", storeId);
          if (imageUrls[storeKey] === undefined && !requested.has(storeKey)) {
            (async () => {
              for (const cid of candidates) {
                const got = await fetchImages(cid, "gold", storeKey);
                if (Array.isArray(got) && got.length > 0) break;
              }
            })();
            requested.add(storeKey);
          }
        }
      }
    });
    datainv.forEach((inv) => {
      const achat = inv.ACHATs?.[0];
      const ts = String(achat?.Fournisseur?.TYPE_SUPPLIER || '').toLowerCase();
      const dp: any = (achat as any)?.DistributionPurchase || (inv as any)?.DistributionPurchase;
      let diamond: any;
      let watch: any;
      let gold: any;
      if (Array.isArray(dp) && dp.length > 0) {
        diamond = dp[0]?.OriginalAchatDiamond;
        watch = dp[0]?.OriginalAchatWatch;
        gold = dp.find((d: any) => d?.GoldOriginalAchat)?.GoldOriginalAchat || dp[0]?.GoldOriginalAchat;
      } else if (dp && typeof dp === 'object') {
        diamond = (dp as any)?.OriginalAchatDiamond;
        watch = (dp as any)?.OriginalAchatWatch;
        gold = (dp as any)?.GoldOriginalAchat;
      }

      const isGold = ts.includes('gold') && !ts.includes('watch') && !ts.includes('diamond');
      const kind: "gold" | "watch" | "diamond" | undefined = isGold
        ? 'gold'
        : ts.includes('watch')
          ? 'watch'
          : ts.includes('diamond')
            ? 'diamond'
            : undefined;

      const goldCandidates = kind === 'gold'
        ? [
          gold?.id_achat,
          (inv as any).id_art,
          (inv as any).picint,
          inv.id_fact,
        ]
          .map((v) => Number(v || 0))
          .filter((v) => v > 0)
        : [];

      const imageId =
        kind === 'gold'
          ? goldCandidates[0]
          : (diamond?.id_achat || watch?.id_achat || (inv as any).picint || inv.id_fact);

      if (!kind || !imageId) return;
      const key = getImageKey(kind, imageId);
      if (imageUrls[key] === undefined && !requested.has(key)) {
        if (kind === 'gold' && goldCandidates.length > 0) {
          // try invoice/item ids until we get a non-empty list, store under the key used by UI
          const storeKey = key;
          (async () => {
            for (const cid of goldCandidates) {
              const got = await fetchImages(cid, kind, storeKey);
              if (Array.isArray(got) && got.length > 0) break;
            }
          })();
        } else {
          fetchImages(imageId, kind);
        }
        requested.add(key);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginatedData, datainv]);

  const apiUrlinv = `/invoices`;

  const fetchIssuedInvoices = async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/");
    setIssuedInvoicesLoading(true);
    try {
      const res = await axios.get<Invoice[]>(`${apiUrlinv}/Getinvoice`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          ps: ps,
          num_fact: -1,
          usr: isAdmin ? -1 : Cuser,
        },
      });
      const list = Array.isArray(res.data) ? res.data : [];
      setIssuedInvoices(list.filter((r) => Number(r.num_fact || 0) > 0));
    } catch (err: any) {
      if (err.response?.status === 401) navigate("/");
      setIssuedInvoices([]);
    } finally {
      setIssuedInvoicesLoading(false);
    }
  };

  const issuedInvoiceSummaries = React.useMemo(() => {
    const map = new Map<number, { num_fact: number; date_fact?: string; client_name?: string; itemCount: number }>();
    for (const row of issuedInvoices) {
      const nf = Number(row.num_fact || 0);
      if (!nf) continue;
      const existing = map.get(nf);
      const next = {
        num_fact: nf,
        date_fact: row.date_fact,
        client_name: (row as any)?.Client?.client_name,
        itemCount: (existing?.itemCount || 0) + 1,
      };
      if (!existing) {
        map.set(nf, next);
      } else {
        map.set(nf, { ...existing, ...next, itemCount: next.itemCount });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.num_fact - a.num_fact);
  }, [issuedInvoices]);

  const handleOpenIssuedInvoices = async () => {
    setIssuedInvoicesOpen(true);
    await fetchIssuedInvoices();
  };

  const handleLoadIssuedInvoice = async (numFact: number) => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/");
    try {
      const res = await axios.get<Invoice[]>(`${apiUrlinv}/Getinvoice`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          ps: ps,
          num_fact: numFact,
          usr: isAdmin ? -1 : Cuser,
        },
      });
      const items = Array.isArray(res.data) ? res.data : [];
      setDatainv(items);
      setCanPrint(true);
      setIssuedInvoicesOpen(false);
      setPrintDialog({ open: true, invoice: items[0] || null });
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to load invoice");
    }
  };

  const handleDeleteIssuedInvoice = async (numFact: number) => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/");
    setIssuedDeleteLoading(true);
    try {
      const res = await axios.get<Invoice[]>(`${apiUrlinv}/Getinvoice`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          ps: ps,
          num_fact: numFact,
          usr: isAdmin ? -1 : Cuser,
        },
      });
      const items = Array.isArray(res.data) ? res.data : [];
      for (const row of items) {
        await axios.delete(`${apiUrlinv}/Delete/${row.id_fact}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      setSnackbar({ open: true, message: `Invoice #${numFact} deleted`, severity: "success" });
      await fetchIssuedInvoices();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to delete invoice");
    } finally {
      setIssuedDeleteLoading(false);
      setIssuedDeleteConfirm({ open: false, numFact: null });
    }
  };

  const handleReissueInvoice = async (numFact: number) => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/");
    setIssuedReissueLoading(true);
    try {
      const res = await axios.get<Invoice[]>(`${apiUrlinv}/Getinvoice`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          ps: ps,
          num_fact: numFact,
          usr: isAdmin ? -1 : Cuser,
        },
      });
      const items = Array.isArray(res.data) ? res.data : [];
      if (items.length === 0) return;

      for (const row of items) {
        const invoiceData = {
          ...row,
          id_fact: undefined,
          num_fact: 0,
          usr: Cuser,
          ps: ps,
        } as any;
        await axios.post(`${apiUrlinv}/Add`, invoiceData, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      await fetchDataINV();
      setCanPrint(false);
      setIssuedInvoicesOpen(false);
      setSnackbar({ open: true, message: `Invoice #${numFact} reissued to cart`, severity: "success" });
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to reissue invoice");
    } finally {
      setIssuedReissueLoading(false);
      setIssuedReissueConfirm({ open: false, numFact: null });
    }
  };

  const fetchDataINV = async (): Promise<Invoice[]> => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return [];
    }
    try {
      const res = await axios.get<Invoice[]>(`${apiUrlinv}/Getinvoice`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { ps: ps, num_fact: 0, usr: Cuser },
      });
      setDatainv(res.data);

      setEditInvoice((prevState) => ({
        ...prevState,
        client: res.data[0]?.client ?? prevState.client,
        Client: res.data[0]?.Client ?? prevState.Client,
        SourceMark: res.data[0]?.SourceMark ?? prevState.SourceMark,
      }));
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 401) navigate("/");
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Compute sales price for a gold item (LYD) using same logic as displayed in UI
  const computeGoldSalesPrice = (item: InventoryItem): number | null => {
    try {
      const goldObj = Array.isArray(item.DistributionPurchase)
        ? (item.DistributionPurchase as DistributionPurchase[]).find(
          (dp: DistributionPurchase) => !!dp.GoldOriginalAchat
        )?.GoldOriginalAchat
        : (item.DistributionPurchase && typeof item.DistributionPurchase === 'object'
          ? (item.DistributionPurchase as DistributionPurchase).GoldOriginalAchat
          : undefined);
      const MakingCharge = goldObj?.MakingCharge ?? item.MakingCharge;
      const ShippingCharge = goldObj?.ShippingCharge ?? item.ShippingCharge;
      const TravelExpesenes = goldObj?.TravelExpesenes ?? item.TravelExpesenes;
      const LossExpesenes = goldObj?.LossExpesenes ?? item.LossExpesenes;
      const profitMargin = item.Fournisseur?.profit_margin ?? 0;

      const typeStr = (item.Fournisseur?.TYPE_SUPPLIER || '').toLowerCase();
      const usdPerOz = goldPrice?.usdPerOz ?? 0;
      const usdPerGramPure = usdPerOz > 0 ? (usdPerOz / 31.1034768) : (goldPrice?.usdPerGram ?? 0);

      let kVal: number | null = null;
      const mK = typeStr.match(/(?:gold\s*)(18|21|24)|\b(18|21|24)\b|(?:\b(\d{2})\s*k)/i);
      if (mK) {
        const picked = mK[1] || mK[2] || mK[3];
        kVal = Number(picked);
      } else {
        const fParsed = parsePurityFactorFromType(item.Fournisseur?.TYPE_SUPPLIER);
        if (fParsed && fParsed > 0 && fParsed <= 1) {
          kVal = Math.round(fParsed * 24);
        }
      }

      if (!kVal) return null;
      const f = kVal / 24;
      const basePerGram = usdPerGramPure > 0 ? usdPerGramPure : (commonPurityPrices.find(p => p.k === 24)?.usdPerGram ?? 0);
      const makingVal = Number(MakingCharge || 0);
      const shippingVal = Number(ShippingCharge || 0);
      const travelVal = Number(TravelExpesenes || 0);
      const qtyVal = Number(item.qty || 0);

      // IMPORTANT: match the UI card formula used for displayMainNum/displaySubNum.
      const indirectCostPct = Number((((goldObj as any)?.IndirectCost || 0)) / 100);
      const profitPct = Number((profitMargin || 0) / 100);
      const lossPct = Number(LossExpesenes || 0) / 100;

      const perGramUsd = basePerGram * f * (1 + lossPct) + makingVal + shippingVal + travelVal;
      const fx = Number(lastUsdRate || 1);
      const sales = qtyVal * perGramUsd * (1 + indirectCostPct + profitPct) * fx;
      if (!Number.isFinite(sales)) return null;
      return sales;
    } catch (e) {
      return null;
    }
  };

  const [editInvoice, setEditInvoice] = useState<Invoice>(initialInvoiceState);

  const handleSave = async (item?: InventoryItem) => {
    if (!item) return;
    // Use already-fetched rates; do not block on external APIs here
    setAddToCartLoading((prev: { [id: number]: boolean }) => ({
      ...prev,
      [item.id_fact]: true,
    }));
    const token = localStorage.getItem("token");
    try {
      let prix_vente = 0;
      let price_per_gram: number | null = null;
      let price_per_piece: number | null = null;
      const type = item.Fournisseur?.TYPE_SUPPLIER?.toLowerCase() || "";

      if (type.includes("diamond")) {
        let diamond: any = undefined;
        let dp: any = item.DistributionPurchase;
        if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
          diamond = dp[0]?.OriginalAchatDiamond;
        } else if (dp && typeof dp === "object") {
          diamond = dp?.OriginalAchatDiamond;
        }
        if (diamond) {
          if (typeof diamond.sale_price === "number")
            prix_vente = diamond.sale_price;
          else if (typeof diamond.SellingPrice === "number")
            prix_vente = diamond.SellingPrice;
          editInvoice.picint = diamond.id_achat;
        }
      } else if (type.includes("watch")) {
        let watch: any = undefined;
        let dp: any = item.DistributionPurchase;
        if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
          watch = dp[0]?.OriginalAchatWatch;
        } else if (dp && typeof dp === "object") {
          watch = dp?.OriginalAchatWatch;
        }
        if (watch) {
          if (typeof watch.sale_price === "number")
            prix_vente = watch.sale_price;
          else if (typeof watch.SellingPrice === "number")
            prix_vente = watch.SellingPrice;
          editInvoice.picint = watch.id_achat;
        }
      } else if (type.includes("gold")) {
        const salesPrice = computeGoldSalesPrice(item);
        if (salesPrice !== null) {
          prix_vente = salesPrice;
        } else {
          const gpg = goldPrice?.usdPerGram ?? 0;
          const factor = parsePurityFactorFromType(item.Fournisseur?.TYPE_SUPPLIER) ?? 1;
          const basePerGramUSD = gpg * factor;
          const margin = (item.Fournisseur?.Price_G_Gold_Sales || 0) / 100;
          prix_vente = (basePerGramUSD * (1 + margin)) * (effectiveUsdToLyd || 1) * item.qty;
        }

        // Explicitly store per-gram and per-piece prices for printing.
        // - per-piece: total selling price (LYD)
        // - per-gram: per-piece / weight
        const w = Number(item.qty || 0);
        price_per_piece = Number(prix_vente) || 0;
        price_per_gram = w > 0 ? (Number(prix_vente) || 0) / w : 0;
      } else {
        prix_vente = item.Selling_Price_Currency || 0;
      }

      const commentWithMeta = String(editInvoice?.COMMENT ?? "");

      const invoiceData = {
        ...editInvoice,
        id_art: item.id_fact,
        qty: item.qty,
        prix_vente,
        prix_vente_remise: prix_vente,
        total_remise: prix_vente,
        price_per_gram,
        price_per_piece,
        COMMENT: commentWithMeta,
        client: 0,
        Design_art: item.Design_art,
        usr: Cuser,
        ps: ps,
      };

      await axios.post(`${apiUrlinv}/Add`, invoiceData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Refresh only the cart; inventory list is large and static
      await fetchDataINV();
    } catch (error: any) {
      alert(error.response?.data?.message || "Save failed");
    } finally {
      setAddToCartLoading((prev: { [id: number]: boolean }) => ({
        ...prev,
        [item.id_fact]: false,
      }));
    }
  };

  type GoldSpot = { usdPerOz?: number; usdPerGram?: number; updatedAt?: Date; source?: string; error?: string };
  const [goldPrice, setGoldPrice] = useState<GoldSpot | null>(null);
  const [usdToLyd, setUsdToLyd] = useState<number | 0>(0);
  const [blackMarketUsdToLyd, setBlackMarketUsdToLyd] = useState<number | null>(null);

  const effectiveUsdToLyd = React.useMemo(() => {
    // Prefer black market rate when available; otherwise fall back to existing USD->LYD + 2 heuristic.
    if (blackMarketUsdToLyd != null && Number.isFinite(Number(blackMarketUsdToLyd)) && Number(blackMarketUsdToLyd) > 0) {
      return Number(blackMarketUsdToLyd);
    }
    const v = Number(usdToLyd);
    if (Number.isFinite(v) && v > 0) return v + 2;
    return 0;
  }, [blackMarketUsdToLyd, usdToLyd]);

  const handleToggleCartGift = async (item: Invoice, checked: boolean) => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `${apiUrlinv}/update/${item.id_fact}`,
        {
          total_remise: item.total_remise ?? item.prix_vente_remise ?? item.prix_vente ?? 0,
          prix_vente_remise: item.prix_vente_remise ?? item.prix_vente ?? 0,
          IS_GIFT: checked,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      await fetchDataINV();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to update gift status");
    }
  };

  // Compute price-per-gram for each purity/type (like GInventory)
  const purityPriceList = React.useMemo(() => {
    const gpg = goldPrice?.usdPerGram;
    if (!gpg || !Number.isFinite(gpg)) return [] as Array<{ type: string; factor: number; usdPerGram: number; lydPerGram: number }>;
    const list: Array<{ type: string; factor: number; usdPerGram: number; lydPerGram: number }> = [];
    const seen = new Set<string>();
    for (const t of distinctGoldTypes) {
      const f = parsePurityFactorFromType(t);
      if (f && f > 0 && f <= 1) {
        const key = `${t}@@${f.toFixed(4)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const usd = gpg * f;
        const lyd = usd * (effectiveUsdToLyd || 1);
        list.push({ type: t, factor: f, usdPerGram: usd, lydPerGram: lyd });
      }
    }
    list.sort((a, b) => b.factor - a.factor);
    return list;
  }, [distinctGoldTypes, goldPrice, effectiveUsdToLyd]);

  // Common gold purities per-gram (fixed set: 18K, 21K, 24K)
  const commonPurityPrices = React.useMemo(() => {
    const gpg = goldPrice?.usdPerGram;
    if (!gpg || !Number.isFinite(gpg)) return [] as Array<{ k: number; usdPerGram: number; lydPerGram: number }>;
    const karats = [18, 21, 24];
    return karats.map((k) => {
      const f = k / 24;
      const usd = gpg * f;
      const lyd = usd * (effectiveUsdToLyd || 1);
      return { k, usdPerGram: usd, lydPerGram: lyd };
    });
  }, [goldPrice, effectiveUsdToLyd]);

  useEffect(() => {
    // Fetch live gold spot (USD/oz and USD/g) via backend proxy and public fallbacks
    const fetchGoldSpotOnce = async () => {
      try {
        let success = false;
        let lastErr: any = null;
        const results: Array<{ usdPerOz: number; usdPerGram: number; source: string; updatedAt: Date }> = [];
        const base = (process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_IP || "https://system.gaja.ly/api").replace(/\/+$/, "");

        // 1) Try backend proxy
        try {
          const r = await fetch(base + "/external/gold-spot", { method: "GET", credentials: "include" });
          if (r.ok) {
            const data = await r.json();
            if (data && typeof data.usdPerOz === "number" && data.usdPerOz > 0) {
              results.push({
                usdPerOz: data.usdPerOz,
                usdPerGram: typeof data.usdPerGram === "number" ? data.usdPerGram : data.usdPerOz / 31.1034768,
                source: data.source || "proxy",
                updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
              });
              success = true;
            } else {
              lastErr = new Error("Proxy returned no numeric usdPerOz");
            }
          } else {
            lastErr = new Error(`Proxy HTTP ${r.status}`);
          }
        } catch (e: any) {
          lastErr = e;
        }

        // 2) metals.live fallback
        const tryMetalsLive = async () => {
          try {
            const r2 = await fetch("https://api.metals.live/v1/spot/gold", { method: "GET" });
            if (!r2.ok) throw new Error(`metals.live HTTP ${r2.status}`);
            const arr = await r2.json();
            if (Array.isArray(arr)) {
              let price: number | null = null;
              for (let i = arr.length - 1; i >= 0; i--) {
                const it = arr[i];
                if (it && typeof it === "object" && "price" in it) {
                  const p = Number((it as any).price);
                  if (!Number.isNaN(p) && p > 0) { price = p; break; }
                } else if (Array.isArray(it) && it.length >= 2) {
                  const p = Number(it[1]);
                  if (!Number.isNaN(p) && p > 0) { price = p; break; }
                }
              }
              if (price) {
                results.push({ usdPerOz: price, usdPerGram: price / 31.1034768, source: "metals.live", updatedAt: new Date() });
                return true;
              }
            }
          } catch (e: any) { lastErr = e; }
          return false;
        };
        if (!success) success = await tryMetalsLive();

        // 3) goldprice.org fallback
        const tryGoldPriceOrg = async () => {
          try {
            const r3 = await fetch("https://data-asg.goldprice.org/dbXRates/USD", { method: "GET" });
            if (!r3.ok) throw new Error(`goldprice.org HTTP ${r3.status}`);
            const data3 = await r3.json();
            const items = (data3 && (data3 as any).items) as any[];
            if (Array.isArray(items) && items.length) {
              const p = Number((items[0] as any).xauPrice || (items[0] as any).xauPrice24h || (items[0] as any).xauPricel3m);
              if (!Number.isNaN(p) && p > 0) {
                results.push({ usdPerOz: p, usdPerGram: p / 31.1034768, source: "goldprice.org", updatedAt: new Date() });
                return true;
              }
            }
          } catch (e: any) { lastErr = e; }
          return false;
        };
        if (!success) success = await tryGoldPriceOrg();

        if (success && results.length) {
          const preferred = results.find((r) => r.source === "proxy") || results[0];
          setGoldPrice(preferred);
          try { localStorage.setItem("goldSpotCache", JSON.stringify(preferred)); } catch { }
        } else {
          let cached: any = null;
          try { const raw = localStorage.getItem("goldSpotCache"); if (raw) cached = JSON.parse(raw); } catch { }
          if (cached && typeof cached.usdPerOz === "number") {
            setGoldPrice({
              usdPerOz: cached.usdPerOz,
              usdPerGram: cached.usdPerGram,
              updatedAt: cached.updatedAt ? new Date(cached.updatedAt) : new Date(),
              source: (cached.source || "cache") + " (cached)",
              error: lastErr ? lastErr.message : "Live fetch failed",
            });
          } else {
            throw lastErr || new Error("All gold price sources failed");
          }
        }
      } catch (e: any) {
        setGoldPrice({ error: e?.message || "Failed to fetch gold price" });
      }
    };
    fetchGoldSpotOnce();

    // Fetch USD to LYD exchange rate from alternative free API (open.er-api.com)
    const fetchUsdToLyd = async () => {
      try {
        const res = await axios.get("https://open.er-api.com/v6/latest/USD");
        // The rates object contains LYD if available
        if (res.data && res.data.rates && res.data.rates.LYD) {
          setUsdToLyd(res.data.rates.LYD);
        } else {
          //setUsdToLydError('USD/LYD rate not found');
          setUsdToLyd(0);
        }
      } catch (err: any) {
        //setUsdToLydError('Failed to fetch USD/LYD rate');
        setUsdToLyd(0);
      }
    };
    fetchUsdToLyd();

    // Fetch USD->LYD black market rate (Fulus) from backend proxy
    const fetchBlackMarketUsdToLyd = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setBlackMarketUsdToLyd(null);
          return;
        }
        const res = await axios.get("/fx/blackmarket/usd-lyd", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const rate = Number(res?.data?.rate);
        if (Number.isFinite(rate) && rate > 0) {
          setBlackMarketUsdToLyd(rate);
        } else {
          setBlackMarketUsdToLyd(null);
        }
      } catch {
        setBlackMarketUsdToLyd(null);
      }
    };
    fetchBlackMarketUsdToLyd();
  }, []);

  // 1. Fix useEffect infinite loop issues (example pattern):
  // Find all useEffect hooks and ensure correct dependency arrays.
  // Example fix:
  // useEffect(() => { ... }, []); // Only run once on mount
  // useEffect(() => { ... }, [someVar]); // Only run when someVar changes
  // 2. (If you have a useEffect without dependencies, add []):
  // Example:
  // useEffect(() => {
  //   fetchData();
  // }, []); // <-- add [] if missing
  // 3. (If you have a useEffect with a dependency that changes every render, memoize it or remove it from dependencies if safe)
  // 4. (If you want me to scan and fix all useEffect hooks, please confirm or provide the relevant code section)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const [addToCartLoading, setAddToCartLoading] = useState<{
    [id: number]: boolean;
  }>({});
  const [deleteLoading, setDeleteLoading] = useState(false);
  // Approval context for totals dialog (same approach as EditTotalRN)
  const [minPer, setMinPer] = useState<number | null>(null);
  const [totalPrixVente, setTotalPrixVente] = useState<number | null>(null);
  const [totalsDialog, setTotalsDialog] = useState({
    open: false,
    total_remise_final: 0,
    amount_currency: 0,
    amount_lyd: 0,
    amount_EUR: 0,
    amount_currency_LYD: 0,
    total_remise_final_lyd: 0,
    amount_EUR_LYD: 0,
    remise: 0,
    remise_per: 0,
  });
  const [isSaving, setIsSaving] = useState(false);

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });

  const [printDialog, setPrintDialog] = useState({
    open: false,
    invoice: null as Invoice | null,
  });

  const printRef = useRef<HTMLDivElement>(null);

  const handleOpenTotalsDialog = () => {
    // Calculate totals from datainv
    const nonGift = (datainv || []).filter((i: any) => !i?.IS_GIFT);

    const goldItems = nonGift.filter((i) =>
      i.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes("gold")
    );
    const diamondItems = nonGift.filter((i) =>
      i.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes(
        "diamond"
      )
    );
    const watchItems = nonGift.filter((i) =>
      i.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes("watch")
    );

    // Calculate totals for each type
    let goldTotal = 0,
      diamondTotal = 0,
      watchTotal = 0;

    if (goldItems.length > 0) {
      const goldWithRemise = goldItems.filter(
        (i) =>
          typeof i.total_remise_final === "number" && i.total_remise_final > 0
      );
      goldTotal =
        goldWithRemise.length > 0
          ? Math.max(...goldWithRemise.map((i) => i.total_remise_final ?? 0))
          : goldItems.reduce(
            (sum, i) =>
              sum + (typeof i.prix_vente === "number" ? i.prix_vente : 0),
            0
          );
    }
    if (diamondItems.length > 0) {
      const diamondWithRemise = diamondItems.filter(
        (i) =>
          typeof i.total_remise_final === "number" && i.total_remise_final > 0
      );
      diamondTotal =
        diamondWithRemise.length > 0
          ? Math.max(...diamondWithRemise.map((i) => i.total_remise_final ?? 0))
          : diamondItems.reduce(
            (sum, i) =>
              sum + (typeof i.prix_vente === "number" ? i.prix_vente : 0),
            0
          );
    }
    if (watchItems.length > 0) {
      const watchWithRemise = watchItems.filter(
        (i) =>
          typeof i.total_remise_final === "number" && i.total_remise_final > 0
      );
      watchTotal =
        watchWithRemise.length > 0
          ? Math.max(...watchWithRemise.map((i) => i.total_remise_final ?? 0))
          : watchItems.reduce(
            (sum, i) =>
              sum + (typeof i.total_remise === "number" ? i.total_remise : 0),
            0
          );
    }

    // Calculate minPer (minimum allowed discount %) across all items, same as CartScreen
    let computedMinPer: number | null = null;
    if (datainv && datainv.length > 0) {
      computedMinPer = datainv.reduce((min: number | null, item: any) => {
        const achat = item?.ACHATs?.[0];
        const per = achat?.Fournisseur?.Percentage_Diamond;
        if (typeof per === "number") {
          if (min === null) return per;
          return Math.min(min, per);
        }
        return min;
      }, null as number | null);
    }

    // Calculate totalPrixVente (sum of prix_vente), same as CartScreen
    const computedTotalPrixVente = datainv
      ? datainv.reduce(
          (sum, item) =>
            sum +
            (!item?.IS_GIFT && typeof item.prix_vente === "number" ? item.prix_vente : 0),
          0
        )
      : 0;

    setMinPer(computedMinPer);
    setTotalPrixVente(computedTotalPrixVente || null);

    const totalRemiseFinalLydSum = nonGift.reduce(
      (sum, i) =>
        sum +
        (typeof i.total_remise_final_lyd === "number"
          ? i.total_remise_final_lyd
          : 0),
      0
    );

    // Sum up all relevant fields for dialog
    const amountCurrencySum = nonGift.reduce(
      (sum, i) =>
        typeof i.amount_currency === "number" ? i.amount_currency : 0,
      0
    );
    const amountLydSum = nonGift.reduce(
      (sum, i) => (typeof i.amount_lyd === "number" ? i.amount_lyd : 0),
      0
    );
    const amountEurSum = nonGift.reduce(
      (sum, i) =>
        typeof i.amount_EUR === "number" ? i.amount_EUR : 0,
      0
    );
    const amountCurrencyLydSum = nonGift.reduce(
      (sum, i) =>
        typeof i.amount_currency_LYD === "number"
          ? i.amount_currency_LYD
          : 0,
      0
    );
    const amountEurLydSum = nonGift.reduce(
      (sum, i) =>
        typeof i.amount_EUR_LYD === "number" ? i.amount_EUR_LYD : 0,
      0
    );
    const remiseSum = nonGift.reduce(
      (sum, i) => (typeof i.remise === "number" ? i.remise : 0),
      0
    );

    const remisePerSum = nonGift.reduce(
      (sum, i) => (typeof i.remise_per === "number" ? i.remise_per : 0),
      0
    );

    setTotalsDialog({
      open: true,
      total_remise_final: goldTotal + diamondTotal + watchTotal,
      total_remise_final_lyd: totalRemiseFinalLydSum,
      amount_currency: amountCurrencySum,
      amount_lyd: amountLydSum,
      amount_EUR: amountEurSum,
      amount_currency_LYD: amountCurrencyLydSum,
      amount_EUR_LYD: amountEurLydSum,
      remise: remiseSum,
      remise_per: remisePerSum,
    });
  };

  const handleTotalsDialogChange = (field: string, value: number) => {
    setTotalsDialog((prev) => ({ ...prev, [field]: value }));
  };

  const handleTotalsDialogClose = () => {
    setTotalsDialog((prev) => ({ ...prev, open: false }));
  };

  const [approvalPolling, setApprovalPolling] = useState(false);

  const handleAddNew = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    try {
      // ensure latest USD rate before creating new invoice
      try { await fetchLastUsdRate(); } catch { }
      try { await fetchGoldSpot(); } catch { }

      // IMPORTANT: backend /NewNF only generates a number. /SetNF issues (assigns num_fact).
      const res = await axios.get(`${apiUrlinv}/SetNF`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: { ps, usr: Cuser, t: Date.now() },
      });
      if (res.status !== 200) throw new Error("Failed to issue invoice");

      const maybeNum =
        (res.data && typeof res.data === "object" && (res.data as any).new_num_fact != null)
          ? Number((res.data as any).new_num_fact)
          : (res.data && typeof res.data === "object" && (res.data as any).num_fact != null)
            ? Number((res.data as any).num_fact)
            : (typeof res.data === "number" || typeof res.data === "string")
              ? Number(res.data)
              : NaN;

      // Issuing should remove draft rows. Clear local state immediately.
      setDatainv([]);
      setEditInvoice(initialInvoiceState);
      setCanPrint(false);

      try {
        await fetchDataINV();
      } catch { }

      setSnackbar({
        open: true,
        message:
          Number.isFinite(maybeNum) && maybeNum > 0
            ? `Invoice #${maybeNum} created.`
            : "Invoice created.",
        severity: "success",
      });
      
      // Open print dialog after successful invoice generation
      if (Number.isFinite(maybeNum) && maybeNum > 0) {
        try {
          const token = localStorage.getItem("token");
          const res = await axios.get<Invoice[]>(`${apiUrlinv}/Getinvoice`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { ps: ps, num_fact: maybeNum, usr: Cuser },
          });
          if (res.data && res.data.length > 0) {
            setPrintDialog({ open: true, invoice: res.data[0] });
          }
        } catch (e) {
          console.error("Failed to fetch invoice for print dialog:", e);
        }
      }
      
      return maybeNum;
    } catch (error) {
      setSnackbar({
        open: true,
        message:
          (error as any)?.response?.data?.message ||
          (error as any)?.response?.data?.error ||
          (error as any)?.message ||
          "Failed to create invoice number",
        severity: "error",
      });
      return null;
    }
  };

  const [canPrint, setCanPrint] = useState(false);

  const pollApprovalAndGenerate = async (refId: number) => {
    if (!refId) return;
    if (approvalPolling) return;
    setApprovalPolling(true);

    const token = localStorage.getItem("token");
    const started = Date.now();
    const maxMs = 2 * 60 * 1000;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    setSnackbar({ open: true, message: "Waiting for discount approval...", severity: "success" });

    try {
      while (Date.now() - started < maxMs) {
        try {
          const res = await axios.get(`/ApprovalRequests/prequestsNot`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const list: any[] = Array.isArray(res?.data?.data) ? res.data.data : [];
          const match = list.find(
            (r: any) =>
              String(r?.type_request || "") === "Invoice" &&
              String(r?.Refrences_Number || "") === String(refId)
          );
          if (match) {
            const st = String(match.status || "").toLowerCase();
            if (st === "accepted" || st === "approve" || st === "approved") {
              await handleAddNew();
              return;
            }
            if (st === "refused" || st === "rejected" || st === "deny" || st === "denied") {
              setSnackbar({ open: true, message: "Discount approval was refused.", severity: "error" });
              return;
            }
          }
        } catch { }

        await sleep(4000);
      }
      setSnackbar({ open: true, message: "Approval check timed out. Please try again later.", severity: "error" });
    } finally {
      setApprovalPolling(false);
    }
  };

  const persistTotalsOnly = async () => {
    // ensure latest USD rate before totals update
    try { await fetchLastUsdRate(); } catch { }
    try { await fetchGoldSpot(); } catch { }

    setIsSaving(true);
    try {
      const token = localStorage.getItem("token");

      await axios.put(
        `/invoices/UpdateTotals/0`,
        {
          total_remise_final: totalsDialog.total_remise_final,
          total_remise_final_lyd: totalsDialog.total_remise_final_lyd,
          amount_currency: totalsDialog.amount_currency,
          amount_lyd: totalsDialog.amount_lyd,
          amount_EUR: totalsDialog.amount_EUR,
          amount_currency_LYD: totalsDialog.amount_currency_LYD,
          amount_EUR_LYD: totalsDialog.amount_EUR_LYD,
          remise: totalsDialog.remise,
          remise_per: totalsDialog.remise_per,
          num_fact: 0,
          usr: Cuser,
          ps: ps,
          customer: editInvoice.client,
          tel_client: (editInvoice as any).tel_client || editInvoice.Client?.tel_client || "",
          sm: editInvoice.SourceMark,
          is_chira: editInvoice.is_chira,
          IS_WHOLE_SALE: editInvoice.IS_WHOLE_SALE,
          COMMENT: editInvoice.COMMENT ?? "",
          // Ensure all essential fields are included
          date_fact: editInvoice.date_fact || new Date().toISOString().split("T")[0],
          mode_fact: editInvoice.mode_fact || "Debitor",
          phone_client: (editInvoice as any).phone_client || editInvoice.Client?.tel_client || "",
          accept_discount: editInvoice.accept_discount ?? false,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // After totals update, persist COMMENT to all current invoice rows (num_fact=0 for this ps+usr)
      try {
        const commentVal = editInvoice.COMMENT ?? "";
        if (commentVal && datainv && datainv.length) {
          const token2 = localStorage.getItem("token");
          const rowsToUpdate = datainv.filter(
            (inv) =>
              inv.num_fact === 0 &&
              String(inv.ps) === String(ps) &&
              String(inv.usr) === String(Cuser)
          );
          for (const inv of rowsToUpdate) {
            try {
              await axios.put(
                `/invoices/Update/${inv.id_fact}`,
                { COMMENT: commentVal },
                { headers: { Authorization: `Bearer ${token2}` } }
              );
            } catch {
              /* continue on single-row failure */
            }
          }
        }
      } catch {
        /* ignore comment bulk update errors */
      }

      setTotalsDialog((prev) => ({ ...prev, open: false }));
    } catch (error) {
      console.error("[persistTotalsOnly] Error:", error);
      const errorMsg =
        (error as any)?.response?.data?.message ||
        (error as any)?.response?.data?.error ||
        (error as any)?.message ||
        "Failed to update invoice totals";
      setSnackbar({ open: true, message: errorMsg, severity: "error" });
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  // Request Approval: update totals only (do NOT issue invoice number)
  const handleTotalsDialogUpdateForApproval = async () => {
    try {
      await persistTotalsOnly();
    } catch {
      // errors already surfaced via snackbar
    }
  };

  // Confirm Checkout: update totals then issue invoice
  const handleTotalsDialogUpdate = async () => {
    try {
      await persistTotalsOnly();
      await handleAddNew();
    } catch {
      // errors already surfaced via snackbar
    }
  };

  useEffect(() => {
    // Reset print ability when cart becomes empty or invoice state is reset
    if (!datainv || datainv.length === 0) {
      setCanPrint(false);
    }
  }, [datainv]);

  const [hiddenIds] = useState<number[]>([]); // Track hidden items

  // Calculate final total after discount for each currency type
  function getFinalTotal(items: any[], currencyType: string) {
    const filtered = items.filter((i: any) => {
      const achat = i.ACHATs?.[0];
      if (i?.IS_GIFT) return false;
      return achat?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes(
        currencyType
      );
    });
    let total = 0;
    let remise = 0;
    let remise_per = 0;
    if (filtered.length > 0) {
      // Use the latest (max) total_remise_final, remise, remise_per for this type
      const withRemise = filtered.filter(
        (i: any) =>
          typeof i.total_remise_final === "number" && i.total_remise_final > 0
      );
      if (withRemise.length > 0) {
        const latest = withRemise.reduce((a: any, b: any) =>
          a.id_fact > b.id_fact ? a : b
        );
        remise = latest.remise || 0;
        remise_per = latest.remise_per || 0;
      } else {
        // fall through to computed total below
      }

      // Always compute total from non-gift item prices to ensure gifts don't affect totals
      total = filtered.reduce(
        (sum: number, i: any) =>
          sum +
          (typeof i.prix_vente_remise === "number"
            ? i.prix_vente_remise
            : typeof i.prix_vente === "number"
              ? i.prix_vente
              : 0),
        0
      );
    }
    // Apply discount
    let finalTotal = total;
    if (remise > 0) {
      finalTotal = total - remise;
    } else if (remise_per > 0) {
      finalTotal = total - total * (remise_per / 100);
    }
    return finalTotal;
  }

  return (
    <Box>
      {/* Image Dialog */}
      <Dialog
        open={imageDialogOpen}
        onClose={() => {
          setImageDialogOpen(false);
          setDialogItem(null);
          setDialogZoom(1);
          setDialogPan({ x: 0, y: 0 });
          setDialogIsPanning(false);
          dialogPanStartRef.current = null;
          dialogPointerStartRef.current = null;
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Product Image</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              minHeight: "400px",
            }}
          >
            {dialogImageList.length > 0 ? (
              <>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                  <Button
                    onClick={() =>
                      setDialogImageIndex(
                        (idx) =>
                          (idx - 1 + dialogImageList.length) %
                          dialogImageList.length
                      )
                    }
                    disabled={dialogImageList.length <= 1}
                  >
                    {"<"}
                  </Button>

                  <Box
                    sx={{
                      flex: 1,
                      height: 420,
                      overflow: "hidden",
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      touchAction: "none",
                      cursor:
                        dialogZoom > 1
                          ? dialogIsPanning
                            ? "grabbing"
                            : "grab"
                          : "default",
                    }}
                    onPointerDown={(e) => {
                      if (dialogZoom <= 1) return;
                      setDialogIsPanning(true);
                      dialogPanStartRef.current = { x: dialogPan.x, y: dialogPan.y };
                      dialogPointerStartRef.current = { x: e.clientX, y: e.clientY };
                    }}
                  >
                    <img
                      src={(() => {
                        let url = dialogImageList[dialogImageIndex];
                        if (!url) return "/default-image.png";
                        url = toApiImageAbsolute(url);
                        const token = localStorage.getItem("token");
                        if (token && url && !url.includes("token=")) {
                          url +=
                            (url.includes("?") ? "&" : "?") +
                            "token=" +
                            encodeURIComponent(token);
                        }
                        return url;
                      })()}
                      alt="Selected"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        transform: `translate(${dialogPan.x}px, ${dialogPan.y}px) scale(${dialogZoom})`,
                        transformOrigin: "center center",
                        transition: dialogIsPanning ? "none" : "transform 120ms ease",
                        userSelect: "none",
                        pointerEvents: "none",
                      }}
                      draggable={false}
                    />
                  </Box>

                  <Button
                    onClick={() =>
                      setDialogImageIndex((idx) => (idx + 1) % dialogImageList.length)
                    }
                    disabled={dialogImageList.length <= 1}
                  >
                    {">"}
                  </Button>
                </Box>

                <Box
                  sx={{
                    width: "100%",
                    mt: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <Typography sx={{ fontWeight: 800, color: "text.secondary", minWidth: 56 }}>
                    {Math.round(dialogZoom * 100)}%
                  </Typography>
                  <Slider
                    value={dialogZoom}
                    min={1}
                    max={3}
                    step={0.05}
                    onChange={(_, val) => {
                      const v = Array.isArray(val) ? val[0] : val;
                      const next = Number(v);
                      setDialogZoom(next);
                      if (next <= 1) setDialogPan({ x: 0, y: 0 });
                    }}
                  />
                </Box>
              </>
            ) : (
              <Typography>No Image Available</Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              try {
                if (!dialogItem) return;
                const urls = dialogImageList || [];
                const selected = urls[dialogImageIndex];
                if (!selected) return;
                const typeSupplierLower =
                  (dialogItem as any)?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase?.() ||
                  "";
                const dp: any = (dialogItem as any)?.DistributionPurchase;
                let diamond: any = undefined;
                let watch: any = undefined;
                if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
                  diamond = dp[0]?.OriginalAchatDiamond;
                  watch = dp[0]?.OriginalAchatWatch;
                } else if (dp && typeof dp === "object") {
                  diamond = dp?.OriginalAchatDiamond;
                  watch = dp?.OriginalAchatWatch;
                }
                let kind: "gold" | "diamond" | "watch" | undefined = undefined;
                let imageKey: any = (dialogItem as any).picint || (dialogItem as any).id_fact;
                if (diamond?.id_achat) {
                  kind = "diamond";
                  imageKey = diamond.id_achat;
                } else if (watch?.id_achat) {
                  kind = "watch";
                  imageKey = watch.id_achat;
                } else if (typeSupplierLower.includes("gold")) {
                  kind = "gold";
                }
                if (!kind) return;
                const canonical = canonicalizePrefUrl(String(selected), kind, imageKey);
                localStorage.setItem(getPreferredImageKey(kind, imageKey), canonical);
              } catch {
                // ignore
              }
            }}
            disabled={!dialogItem || dialogImageList.length <= 1}
          >
            Use This Image As Default
          </Button>
          <Button onClick={() => setImageDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Cards Grid */}

      <Box sx={{ display: "flex", flexDirection: "row", width: "100%" }}>
        <Box
          sx={{
            width: sidebarCollapsed ? "60px" : "13%",
            minWidth: sidebarCollapsed ? 60 : 160,
            mr: 2,
            transition: "width 0.3s",
          }}
        >
          {/* Left Sidebar Filter */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 2,

            }}
          >
            <Typography variant="h6" sx={{ color: "text.secondary", fontWeight: 700 }}>
              Filter Images By
            </Typography>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              onClick={() => setFiltersExpanded((v) => !v)}
              sx={{ textTransform: "none", borderRadius: 2, fontWeight: 800 }}
            >
              {filtersExpanded ? "Hide" : "Show"}
            </Button>
          </Box>
          <Box
            sx={{ color: "text.secondary", display: "flex", flexDirection: "column", gap: 1.2, mb: 1 }}
          >
            <Box
              sx={{ display: "flex", flexDirection: "row", gap: 0.5, mb: 0.5 }}
            >
              <Button
                variant={typeFilter === "gold" ? "contained" : "outlined"}
                size="small"
                color="inherit"
                onClick={() => {
                  setTypeFilter("gold");
                  fetchData("gold");
                }}
                sx={{
                  textTransform: "none",
                  borderRadius: 1,
                  display: "flex",
                  alignItems: "center",
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  px: 1,
                  py: 0.5,
                }}
                startIcon={
                  <span role="img" aria-label="Gold" style={{ fontSize: 14 }}>
                    🥇
                  </span>
                }
              >
                Gold
              </Button>
            </Box>
            <Box
              sx={{ display: "flex", flexDirection: "row", gap: 0.5, mb: 0.5 }}
            >
              <Button
                variant={typeFilter === "diamond" ? "contained" : "outlined"}
                color="inherit"
                size="small"
                onClick={() => {
                  setTypeFilter("diamond");
                  fetchData("diamond");
                }}
                sx={{
                  textTransform: "none",
                  borderRadius: 1,
                  display: "flex",
                  alignItems: "center",
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  px: 1,
                  py: 0.5,
                }}
                startIcon={
                  <span
                    role="img"
                    aria-label="Diamond"
                    style={{ fontSize: 14 }}
                  >
                    💎
                  </span>
                }
              >
                Diamond
              </Button>
              <Button
                variant={typeFilter === "watch" ? "contained" : "outlined"}
                color="inherit"
                size="small"
                onClick={() => {
                  setTypeFilter("watch");
                  fetchData("watch");
                }}
                sx={{
                  textTransform: "none",
                  borderRadius: 1,
                  display: "flex",
                  alignItems: "center",
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  px: 1,
                  py: 0.5,
                }}
                startIcon={
                  <span role="img" aria-label="Watch" style={{ fontSize: 14 }}>
                    ⌚
                  </span>
                }
              >
                Watch
              </Button>
            </Box>

            <Collapse in={filtersExpanded}>
            {/* Cost Range Filter */}
            <Box
              sx={(theme) => ({
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                bgcolor: theme.palette.mode === "dark" ? "#222" : "#f5f5f5",
                borderRadius: 1,
                p: 1,
                boxShadow:
                  theme.palette.mode === "dark"
                    ? "0 1px 8px rgba(0,0,0,0.18)"
                    : "0 1px 8px rgba(0,0,0,0.07)",
              })}
            >
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, mb: 0.5, fontSize: 13 }}
              >
                Filter by Cost
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  gap: 1,
                  alignItems: "center",
                  width: "100%",
                }}
              >
                <input
                  type="number"
                  value={costMin}
                  onChange={(e) => setCostMin(e.target.value)}
                  placeholder="Min"
                  style={{
                    width: "45%",
                    minWidth: 60,
                    maxWidth: 120,
                    padding: "6px 10px",
                    borderRadius: 4,
                    border: "1px solid #ccc",
                    fontSize: 14,
                    background: "inherit",
                    color: "inherit",
                    boxSizing: "border-box",
                    transition: "width 0.3s",
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{ fontSize: 13, minWidth: 18, textAlign: "center" }}
                >
                  to
                </Typography>
                <input
                  type="number"
                  value={costMax}
                  onChange={(e) => setCostMax(e.target.value)}
                  placeholder="Max"
                  style={{
                    width: "45%",
                    minWidth: 60,
                    maxWidth: 120,
                    padding: "6px 10px",
                    borderRadius: 4,
                    border: "1px solid #ccc",
                    fontSize: 14,
                    background: "inherit",
                    color: "inherit",
                    boxSizing: "border-box",
                    transition: "width 0.3s",
                  }}
                />
              </Box>
            </Box>
            {/* Brand Filter Dropdown */}
            <Box
              sx={(theme) => ({
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                bgcolor: theme.palette.mode === "dark" ? "#222" : "#f5f5f5",
                borderRadius: 1,
                p: 1,
                boxShadow:
                  theme.palette.mode === "dark"
                    ? "0 1px 8px rgba(0,0,0,0.18)"
                    : "0 1px 8px rgba(0,0,0,0.07)",
              })}
            >
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, mb: 0.5, fontSize: 13 }}
              >
                Filter by Brand
              </Typography>
              <TextField
                select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                placeholder="Select Brand"
                size="small"
                variant="outlined"
                sx={{
                  width: "100%",
                  bgcolor: "inherit",
                  borderRadius: 1,
                  fontSize: 12,
                  mb: 1,
                }}
                SelectProps={{ native: false }}
              >
                <MenuItem value="" sx={{ fontSize: 12 }}>
                  All Brands
                </MenuItem>
                {distinctBrands.map((brand) => (
                  <MenuItem key={brand} value={brand} sx={{ fontSize: 12 }}>
                    {brand}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            {/* Gold-only Filters */}
            {typeFilter === "gold" && (
              <Box
                sx={(theme) => ({
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.5,
                  bgcolor: theme.palette.mode === "dark" ? "#222" : "#f5f5f5",
                  borderRadius: 1,
                  p: 1,
                  boxShadow:
                    theme.palette.mode === "dark"
                      ? "0 1px 8px rgba(0,0,0,0.18)"
                      : "0 1px 8px rgba(0,0,0,0.07)",
                })}
              >
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, mb: 0.5, fontSize: 13 }}
                >
                  Gold Filters
                </Typography>
                {/* Weight range */}
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <input
                    type="number"
                    value={goldWeightMin}
                    onChange={(e) => setGoldWeightMin(e.target.value)}
                    placeholder="Weight min (g)"
                    style={{
                      width: "45%",
                      minWidth: 60,
                      maxWidth: 120,
                      padding: "6px 10px",
                      borderRadius: 4,
                      border: "1px solid #ccc",
                      fontSize: 14,
                      background: "inherit",
                      color: "inherit",
                      boxSizing: "border-box",
                    }}
                  />
                  <input
                    type="number"
                    value={goldWeightMax}
                    onChange={(e) => setGoldWeightMax(e.target.value)}
                    placeholder="Weight max (g)"
                    style={{
                      width: "45%",
                      minWidth: 60,
                      maxWidth: 120,
                      padding: "6px 10px",
                      borderRadius: 4,
                      border: "1px solid #ccc",
                      fontSize: 14,
                      background: "inherit",
                      color: "inherit",
                      boxSizing: "border-box",
                    }}
                  />
                </Box>
                {/* ID range */}
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <input
                    type="number"
                    value={goldIdMin}
                    onChange={(e) => setGoldIdMin(e.target.value)}
                    placeholder="ID min"
                    style={{
                      width: "45%",
                      minWidth: 60,
                      maxWidth: 120,
                      padding: "6px 10px",
                      borderRadius: 4,
                      border: "1px solid #ccc",
                      fontSize: 14,
                      background: "inherit",
                      color: "inherit",
                      boxSizing: "border-box",
                    }}
                  />
                  <input
                    type="number"
                    value={goldIdMax}
                    onChange={(e) => setGoldIdMax(e.target.value)}
                    placeholder="ID max"
                    style={{
                      width: "45%",
                      minWidth: 60,
                      maxWidth: 120,
                      padding: "6px 10px",
                      borderRadius: 4,
                      border: "1px solid #ccc",
                      fontSize: 14,
                      background: "inherit",
                      color: "inherit",
                      boxSizing: "border-box",
                    }}
                  />
                </Box>
                {/* Type (Supplier) filter - multi-select buttons */}

                {/* Stone and Color text inputs */}
                <TextField
                  value={goldColorRush}
                  onChange={(e) => setGoldColorRush(e.target.value)}
                  placeholder="Stone contains..."
                  size="small"
                  variant="outlined"
                  sx={{ width: "100%", bgcolor: "inherit", borderRadius: 1, fontSize: 12 }}
                />
                <TextField
                  value={goldColorGold}
                  onChange={(e) => setGoldColorGold(e.target.value)}
                  placeholder="Gold color contains..."
                  size="small"
                  variant="outlined"
                  sx={{ width: "100%", bgcolor: "inherit", borderRadius: 1, fontSize: 12 }}
                />
                {/* Seniority */}
                <TextField
                  select
                  value={goldSeniority}
                  onChange={(e) => setGoldSeniority(e.target.value)}
                  placeholder="Seniority"
                  size="small"
                  variant="outlined"
                  sx={{ width: "100%", bgcolor: "inherit", borderRadius: 1, fontSize: 12 }}
                  SelectProps={{ native: false }}
                >
                  <MenuItem value="" sx={{ fontSize: 12 }}>Any Date</MenuItem>
                  <MenuItem value="last7d" sx={{ fontSize: 12 }}>Last 7 days</MenuItem>
                  <MenuItem value="last1m" sx={{ fontSize: 12 }}>Last month</MenuItem>
                  <MenuItem value="last3m" sx={{ fontSize: 12 }}>Last 3 months</MenuItem>
                  <MenuItem value="last6m" sx={{ fontSize: 12 }}>Last 6 months</MenuItem>
                  <MenuItem value="last1y" sx={{ fontSize: 12 }}>Last year</MenuItem>
                  <MenuItem value="last2y" sx={{ fontSize: 12 }}>Last 2 years</MenuItem>
                  <MenuItem value="gt2y" sx={{ fontSize: 12 }}>&gt; 2 years</MenuItem>
                </TextField>
                {/* Sort by Weight */}
                <TextField
                  select
                  value={goldWeightSort}
                  onChange={(e) => setGoldWeightSort(e.target.value)}
                  placeholder="Sort by weight"
                  size="small"
                  variant="outlined"
                  sx={{ width: "100%", bgcolor: "inherit", borderRadius: 1, fontSize: 12 }}
                  SelectProps={{ native: false }}
                >
                  <MenuItem value="" sx={{ fontSize: 12 }}>No sorting</MenuItem>
                  <MenuItem value="asc" sx={{ fontSize: 12 }}>Weight: Low → High</MenuItem>
                  <MenuItem value="desc" sx={{ fontSize: 12 }}>Weight: High → Low</MenuItem>
                </TextField>
              </Box>
            )}

            {typeFilter === "diamond" && (
              <Box
                sx={(theme) => ({
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.5,
                  bgcolor: theme.palette.mode === "dark" ? "#222" : "#f5f5f5",
                  borderRadius: 1,
                  p: 1,
                  boxShadow:
                    theme.palette.mode === "dark"
                      ? "0 1px 8px rgba(0,0,0,0.18)"
                      : "0 1px 8px rgba(0,0,0,0.07)",
                })}
              >
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, mb: 0.5, fontSize: 13 }}
                >
                  Filter by ID / Group
                </Typography>

                {/* Diamond ID filter */}
                <TextField
                  label="ID"
                  type="number"
                  value={diamondIdFilter}
                  onChange={(e) => setDiamondIdFilter(e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{
                    width: "100%",
                    bgcolor: "inherit",
                    borderRadius: 1,
                    fontSize: 12,
                    mb: 0.75,
                  }}
                />

                {/* Diamond groups filter (by General_Comment / Unite) */}
                <TextField
                  select
                  label="Groups"
                  value={generalCommentFilter}
                  onChange={(e) => setGeneralCommentFilter(e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{
                    width: "100%",
                    bgcolor: "inherit",
                    borderRadius: 1,
                    fontSize: 12,
                  }}
                  SelectProps={{ native: false }}
                >
                  <MenuItem value="" sx={{ fontSize: 12 }}>
                    All
                  </MenuItem>
                  <MenuItem value="الكل" sx={{ fontSize: 12 }}>
                    الكل
                  </MenuItem>
                  <MenuItem value="توينز" sx={{ fontSize: 12 }}>
                    توينز
                  </MenuItem>
                  <MenuItem value="سيت" sx={{ fontSize: 12 }}>
                    سيت
                  </MenuItem>
                  <MenuItem value="طاقم" sx={{ fontSize: 12 }}>
                    طاقم
                  </MenuItem>
                </TextField>
              </Box>
            )}
            {/* Reset Filter Button */}
            <Button
              variant="contained"
              color="primary"
              size="small"
              sx={{
                mt: 2,
                fontWeight: 700,
                borderRadius: 1,
                boxShadow: 1,
                fontSize: 12,
                py: 0.5,
                px: 1.5,
              }}
              onClick={() => {
                setTypeFilter("gold");
                setCostMin("");
                setCostMax("");
                setSearch("");
                setBrandFilter("");
                setGeneralCommentFilter("");
                setDiamondIdFilter("");
                setGoldWeightMin("");
                setGoldWeightMax("");
                setGoldIdMin("");
                setGoldIdMax("");
                setGoldColorRush("");
                setGoldColorGold("");
                setGoldSeniority("");
                setGoldTypeFilters([]);
                setGoldWeightSort("");
              }}
            >
              Reset Filter
            </Button>

            </Collapse>
          </Box>
        </Box>
        <Box sx={{ flex: 1, mr: 2 }}>
          {/* Search Field + Gold Ounce Price */}
          <Box sx={{ display: "flex", alignItems: "center", mb: 1, gap: 1 }}>
            <TextField
              variant="outlined"
              size="small"
              placeholder="Search by designation, brand, type, or ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              InputProps={{
                startAdornment: <Search color="action" sx={{ mr: 1 }} />,
                style: {
                  background: "transparent",
                  fontSize: 16,
                  borderRadius: 20,
                },
              }}
              sx={{ flex: 1, bgcolor: "inherit", borderRadius: 2 }}
            />

          </Box>
          <Box sx={{ mt: 2, mb: 2, display: "flex", alignItems: "center", gap: 2, whiteSpace: "nowrap", flexWrap: 'wrap' }}>

            {/* Latest USD exchange rate from RateTb (Id_Ex latest) */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                color="primary"
                variant="outlined"
                label={
                  lastUsdRate && Number.isFinite(Number(lastUsdRate))
                    ? `USD Rate: ${Number(lastUsdRate).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`
                    : 'USD Rate: --'
                }
                sx={{ fontWeight: 700 }}
              />
            </Box>

            <Typography variant="body2" sx={{ fontWeight: 700, color: "goldenrod" }}>
              {goldPrice?.usdPerOz
                ? `${Number(goldPrice.usdPerOz).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD/oz`
                : "-- USD/oz"}
            </Typography>
            {typeFilter === 'gold' && commonPurityPrices.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                {commonPurityPrices.map((p) => (
                  <Chip
                    key={`k${p.k}`}
                    color="warning"
                    variant="outlined"
                    label={`${p.k}K: $${p.usdPerGram.toFixed(2)}/g`}
                    sx={{ fontWeight: 700 }}
                  />
                ))}
              </Box>
            )}
            {typeFilter === 'gold' && purityPriceList.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                {purityPriceList.map((p) => (
                  <Chip
                    key={`${p.type}-${p.factor}`}
                    color="info"
                    variant="outlined"
                    label={`${p.type}: $${p.usdPerGram.toFixed(2)}/g`}
                    sx={{ fontWeight: 700 }}
                  />
                ))}
              </Box>
            )}

          </Box>
          {/* Selected Filters Chips */}
          <Box sx={{  color:"text.secondary" ,mb: 1, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              <Button
                size="small"
                color="inherit"
                variant={goldTypeFilters.length === 0 ? 'contained' : 'outlined'}
                sx={{ textTransform: 'none', borderRadius: 1, fontSize: 12, px: 1, py: 0.5 }}
                onClick={() => setGoldTypeFilters([])}
              >
                All Types
              </Button>
              {distinctGoldTypes.map((t) => {
                const selected = goldTypeFilters.includes(t);
                return (
                  <Button
                    key={t}
                    size="small"
                    color="inherit"
                    variant={selected ? 'contained' : 'outlined'}
                    sx={{ textTransform: 'none', borderRadius: 1, fontSize: 12, px: 1, py: 0.5 }}
                    onClick={() => {
                      setGoldTypeFilters((prev) => {
                        const has = prev.includes(t);
                        if (has) return prev.filter((x) => x !== t);
                        return [...prev, t];
                      });
                    }}
                  >
                    {t}
                  </Button>
                );
              })}
            </Box>
          </Box>








          <Box
            sx={{
              display: "grid",
              gridTemplateColumns:
                gridView === "icons"
                  ? "repeat(4, minmax(0, 1fr))"
                  : gridView === "8"
                    ? "repeat(8, minmax(0, 1fr))"
                    : gridView === "6"
                      ? "repeat(6, minmax(0, 1fr))"
                      : gridView === "5"
                        ? "repeat(5, minmax(0, 1fr))"
                        : gridView === "4"
                          ? "repeat(4, minmax(0, 1fr))"
                          : "repeat(3, minmax(0, 1fr))",
              gap: 2,
            }}
          >
            <Box
              sx={{
                gridColumn: "1 / -1",
                display: "flex",
                justifyContent: "flex-end",
                gap: 1,
                mb: 1,
              }}
            >
              <Button
                size="small"
                variant="outlined"
                startIcon={<ViewModuleOutlinedIcon />}
                onClick={(e) => setViewAnchorEl(e.currentTarget)}
                sx={{ fontWeight: 900, borderRadius: 2, textTransform: "none" }}
              >
                View
              </Button>
              <Menu
                anchorEl={viewAnchorEl}
                open={Boolean(viewAnchorEl)}
                onClose={() => setViewAnchorEl(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
              >
                <MenuItem
                  selected={gridView === "3"}
                  onClick={() => {
                    setGridView("3");
                    setViewAnchorEl(null);
                  }}
                >
                  3 Columns
                </MenuItem>
                <MenuItem
                  selected={gridView === "4"}
                  onClick={() => {
                    setGridView("4");
                    setViewAnchorEl(null);
                  }}
                >
                  4 Columns
                </MenuItem>
                <MenuItem
                  selected={gridView === "5"}
                  onClick={() => {
                    setGridView("5");
                    setViewAnchorEl(null);
                  }}
                >
                  5 Columns
                </MenuItem>
                <MenuItem
                  selected={gridView === "6"}
                  onClick={() => {
                    setGridView("6");
                    setViewAnchorEl(null);
                  }}
                >
                  6 Columns
                </MenuItem>
                <MenuItem
                  selected={gridView === "8"}
                  onClick={() => {
                    setGridView("8");
                    setViewAnchorEl(null);
                  }}
                >
                  8 Columns
                </MenuItem>
                <MenuItem
                  selected={gridView === "icons"}
                  onClick={() => {
                    setGridView("icons");
                    setViewAnchorEl(null);
                  }}
                >
                  Icons Only
                </MenuItem>
              </Menu>
            </Box>
            {loading ? (
              <Box sx={{ gridColumn: "1/-1", textAlign: "center", py: 6 }}>
                <Typography
                  variant="h6"
                  color="text.secondary"
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <CircularProgress
                    color="inherit"
                    size={36}
                    thickness={4}
                    sx={{ mb: 2 }}
                  />
                  Loading...
                </Typography>
              </Box>
            ) : (
              <>
                {paginatedData
                  .filter((row) => !hiddenIds.includes(row.id_fact))
                  .map((row) => {
                    // compute display price for top-right badge (gold)
                    const goldObj = Array.isArray(row.DistributionPurchase)
                      ? (row.DistributionPurchase as DistributionPurchase[]).find(
                        (dp: DistributionPurchase) => !!dp.GoldOriginalAchat
                      )?.GoldOriginalAchat
                      : (row.DistributionPurchase && typeof row.DistributionPurchase === 'object'
                        ? (row.DistributionPurchase as DistributionPurchase).GoldOriginalAchat
                        : undefined);
                    const MakingCharge = goldObj?.MakingCharge ?? row.MakingCharge;
                    const ShippingCharge = goldObj?.ShippingCharge ?? row.ShippingCharge;
                    const TravelExpesenes = goldObj?.TravelExpesenes ?? row.TravelExpesenes;
                    const LossExpesenes = goldObj?.LossExpesenes ?? row.LossExpesenes;
                    const profitMargin = row.Fournisseur?.profit_margin ?? 0;

                    // compute sales price (same formula used previously)
                    let displayMainNum: number | null = null;
                    let displaySubNum: number | null = null;
                    // generic sale price (USD) for diamond/watch, shown near ID
                    let salePriceUsd: number | null = null;
                    // header identifier: for diamonds show Ref. Code (CODE_EXTERNAL) if present, else id_fact
                    let headerIdLabel: string | number = row.id_fact;
                    try {
                      const typeStr = (row.Fournisseur?.TYPE_SUPPLIER || '').toLowerCase();
                      if (typeStr.includes('gold')) {
                        const usdPerOz = goldPrice?.usdPerOz ?? 0;
                        const usdPerGramPure = usdPerOz > 0 ? (usdPerOz / 31.1034768) : (goldPrice?.usdPerGram ?? 0);
                        let kVal: number | null = null;
                        const mK = typeStr.match(/(?:gold\s*)(18|21|24)|\b(18|21|24)\b|(?:\b(\d{2})\s*k)/i);
                        if (mK) {
                          const picked = mK[1] || mK[2] || mK[3];
                          kVal = Number(picked);
                        } else {
                          const fParsed = parsePurityFactorFromType(row.Fournisseur?.TYPE_SUPPLIER);
                          if (fParsed && fParsed > 0 && fParsed <= 1) {
                            kVal = Math.round(fParsed * 24);
                          }
                        }
                        if (kVal) {
                          const f = kVal / 24;
                          const basePerGram = usdPerGramPure > 0 ? usdPerGramPure : (commonPurityPrices.find(p => p.k === 24)?.usdPerGram ?? 0);
                          const makingVal = Number(MakingCharge || 0);
                          const shippingVal = Number(ShippingCharge || 0);
                          const travelVal = Number(TravelExpesenes || 0);
                          const qtyVal = Number(row.qty || 0);
                          const indirectCostPct = Number((((goldObj as any)?.IndirectCost || 0)) / 100);
                          const profitPct = Number((profitMargin || 0) / 100);

                          displayMainNum = qtyVal * (basePerGram * f * (1 + LossExpesenes / 100) + makingVal + shippingVal + travelVal) * (1 + indirectCostPct + profitPct) * (lastUsdRate || 1);
                          displaySubNum = (basePerGram * f * (1 + LossExpesenes / 100) + makingVal + shippingVal + travelVal) * (1 + indirectCostPct + profitPct) * (lastUsdRate || 1);

                          //sales = (subtotal + lossPct + indirectCostPct + profitPct) * (lastUsdRate || 1);
                        }
                      } else {
                        // diamond or watch: prefer sale_price, else SellingPrice
                        const dp: any = row.DistributionPurchase;
                        let diamond: any = undefined;
                        let watch: any = undefined;
                        if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
                          diamond = dp[0]?.OriginalAchatDiamond;
                          watch = dp[0]?.OriginalAchatWatch;
                        } else if (dp && typeof dp === "object") {
                          diamond = dp?.OriginalAchatDiamond;
                          watch = dp?.OriginalAchatWatch;
                        }

                        if (diamond) {
                          const code = diamond.CODE_EXTERNAL;
                          if (code !== undefined && code !== null && String(code).trim() !== "") {
                            headerIdLabel = String(code);
                          } else {
                            headerIdLabel = row.id_fact;
                          }
                          if ("sale_price" in diamond && diamond.sale_price != null) {
                            salePriceUsd = Number(diamond.sale_price);
                          } else if ("SellingPrice" in diamond && diamond.SellingPrice != null) {
                            salePriceUsd = Number(diamond.SellingPrice);
                          }
                        } else if (watch) {
                          if ("sale_price" in watch && watch.sale_price != null) {
                            salePriceUsd = Number(watch.sale_price);
                          } else if ("SellingPrice" in watch && watch.SellingPrice != null) {
                            salePriceUsd = Number(watch.SellingPrice);
                          }
                        }
                      }
                    } catch (e) {
                      displayMainNum = null;
                      displaySubNum = null;
                    }
                    // Prepare formatted strings
                    const displayMain = (displayMainNum !== null && !isNaN(displayMainNum))
                      ? displayMainNum.toLocaleString('en-LY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '';
                    const displaySub = (displaySubNum !== null && !isNaN(displaySubNum))
                      ? displaySubNum.toLocaleString('en-LY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '';
                    const salePriceDisplay = (salePriceUsd !== null && !isNaN(salePriceUsd))
                      ? salePriceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '';

                    const isIconsOnly = gridView === "icons";
                    const isGoldItem = (row.Fournisseur?.TYPE_SUPPLIER || '').toLowerCase().includes('gold');
                    const goldLabel = (() => {
                      const typeStr = String(row.Fournisseur?.TYPE_SUPPLIER || "");
                      const m = typeStr.match(/\b(18|21|24)\b/);
                      if (m) return `Gold${m[1]}`;
                      // common format: "Gold18" already
                      const m2 = typeStr.match(/gold\s*(18|21|24)/i);
                      if (m2) return `Gold${m2[1]}`;
                      return "Gold";
                    })();

                    if (isIconsOnly) {
                      const priceText = (() => {
                        if (isGoldItem) {
                          if (displayMain) return `${displayMain} LYD`;
                          return "";
                        }
                        if (salePriceDisplay) return `${salePriceDisplay} USD`;
                        return "";
                      })();

                      return (
                        <Box
                          key={row.id_fact}
                          sx={{
                            borderRadius: 2,
                            border: "none",
                            overflow: "hidden",
                            bgcolor: "background.paper",
                            display: "flex",
                            flexDirection: "column",
                            boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                            transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
                            '&:hover': {
                              transform: 'scale(1.03)',
                              boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
                              borderColor: 'rgba(0,0,0,0.18)'
                            },
                          }}
                        >
                          <Box
                            sx={{
                              width: '100%',
                              aspectRatio: '1 / 1',
                              display: 'flex',
                              alignItems: 'stretch',
                              justifyContent: 'stretch',
                              bgcolor: 'rgba(0,0,0,0.02)',
                            }}
                          >
                            {(() => {
                              const typeSupplierLower = row.Fournisseur?.TYPE_SUPPLIER?.toLowerCase() || "";
                              const token = localStorage.getItem("token");

                              let kind: "gold" | "diamond" | "watch" | undefined = undefined;
                              let imageKey: any = (row as any).picint || row.id_fact;

                              const dp: any = row.DistributionPurchase;
                              let diamond: any = undefined;
                              let watch: any = undefined;
                              if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
                                diamond = dp[0]?.OriginalAchatDiamond;
                                watch = dp[0]?.OriginalAchatWatch;
                              } else if (dp && typeof dp === "object") {
                                diamond = dp?.OriginalAchatDiamond;
                                watch = dp?.OriginalAchatWatch;
                              }

                              if (diamond?.id_achat) {
                                kind = "diamond";
                                imageKey = diamond.id_achat;
                              } else if (watch?.id_achat) {
                                kind = "watch";
                                imageKey = watch.id_achat;
                              } else if (typeSupplierLower.includes("gold")) {
                                kind = "gold";
                              }

                              if (!kind) {
                                return (
                                  <Box
                                    component="img"
                                    src={"/GJ LOGO.png"}
                                    alt="Product"
                                    loading="lazy"
                                    sx={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9, display: 'block' }}
                                  />
                                );
                              }

                              const keyStr = getImageKey(kind, imageKey);
                              const urls = normalizeImageList(imageUrls?.[keyStr] || []);
                              if (!urls.length) {
                                return (
                                  <Box
                                    component="img"
                                    src={"/GJ LOGO.png"}
                                    alt="Product"
                                    loading="lazy"
                                    sx={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9, display: 'block' }}
                                  />
                                );
                              }

                              const idx = pickPreferredIndexWithOverride(urls, kind, imageKey);
                              let url = urls[idx] || "";
                              // Some endpoints return legacy /uploads/... paths; normalize to /images/* routes when possible
                              try {
                                if (url && typeof url === 'string' && url.startsWith('/uploads/')) {
                                  const parts = url.split('/').filter(Boolean);
                                  const len = parts.length;
                                  if (len >= 3) {
                                    const filename = parts[len - 1];
                                    const idSeg = parts[len - 2];
                                    url = `/images/gold/${encodeURIComponent(idSeg)}/${encodeURIComponent(filename)}`;
                                  }
                                }
                              } catch { }
                              url = ensureHttps(toApiImageAbsolute(url));
                              if (token && url && !url.includes('token=')) {
                                url += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
                              }

                              const resolved = resolvedImgSrc[keyStr];
                              const finalSrc = resolved || url;

                              return (
                                <Box
                                  component="img"
                                  src={finalSrc}
                                  alt="Product"
                                  loading="lazy"
                                  sx={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in', display: 'block' }}
                                  onClick={() => {
                                    setDialogImageList(normalizeDialogUrls(urls));
                                    setDialogImageIndex(idx);
                                    setDialogItem(row);
                                    setImageDialogOpen(true);
                                  }}
                                  onError={(e) => {
                                    const img = e.currentTarget as HTMLImageElement;
                                    img.onerror = null;
                                    setResolvedImgSrc((prev) => ({ ...prev, [keyStr]: "/GJ LOGO.png" }));
                                  }}
                                />
                              );
                            })()}
                          </Box>
                          <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                              <Typography sx={{ fontWeight: 900, fontSize: 12, lineHeight: 1.2, flex: 1, minWidth: 0 }}>
                                {`ID: ${String(headerIdLabel)}`}{row.Design_art ? ` - ${row.Design_art}` : ""}
                              </Typography>
                              {priceText ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.05 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 900, fontSize: 12, color: isGoldItem ? 'warning.main' : 'info.main' }}
                                  >
                                    {priceText}
                                  </Typography>
                                  {isGoldItem && displaySub ? (
                                    <Typography
                                      variant="caption"
                                      sx={{ fontWeight: 800, fontSize: 10.5, color: 'text.secondary' }}
                                    >
                                      {displaySub} LYD/g
                                    </Typography>
                                  ) : null}
                                </Box>
                              ) : null}
                            </Box>
                            {isGoldItem && (
                              <Typography sx={{ fontWeight: 800, fontSize: 12, lineHeight: 1.1, color: 'text.secondary' }}>
                                Weight: {row.qty}
                                <Box component="span" sx={{ ml: 0.5 }}>
                                  g
                                </Box>
                              </Typography>
                            )}
                            {isGoldItem && (
                              <Typography sx={{ fontWeight: 900, fontSize: 12, lineHeight: 1.1, color: 'warning.main' }}>
                                {goldLabel}
                              </Typography>
                            )}
                            {row.Fournisseur?.client_name && (
                              <Typography sx={{ fontWeight: 800, fontSize: 12, lineHeight: 1.1, color: 'text.secondary' }}>
                                {row.Fournisseur?.client_name}
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ p: 1, pt: 0 }}>
                            <Button
                              variant="contained"
                              color="warning"
                              size="small"
                              sx={{ fontWeight: 800, borderRadius: 2, width: '100%' }}
                              onClick={() => handleSave(row)}
                              disabled={
                                addToCartLoading[row.id_fact] ||
                                datainv.some((item) => item.id_art === row.id_fact)
                              }
                            >
                              {addToCartLoading[row.id_fact]
                                ? "Adding..."
                                : datainv.some((item) => item.id_art === row.id_fact)
                                  ? "In Cart"
                                  : "Add to cart"}
                            </Button>
                          </Box>
                        </Box>
                      );
                    }

                    return (
                      <Box
                        key={row.id_fact}
                        sx={{
                          position: 'relative',
                          borderRadius: 2,
                          
                          display: "flex",
                          flexDirection: "column",
                          border: "none",
                          alignItems: "stretch",
                          justifyContent: "flex-start",
                          gap: gridView === "3" ? 0.5 : 0.75,
                          mb: 0.75,
                          bgcolor: "background.paper",
                          overflow: "hidden",
                          cursor: "default",
                          boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                          transition: "box-shadow 160ms ease, transform 160ms ease, border-color 160ms ease",
                          '&:hover': {
                            boxShadow: '0 10px 24px rgba(0,0,0,0.10)',
                            transform: 'translateY(-1px)',
                            borderColor: 'rgba(0,0,0,0.18)'
                          },
                          ...(row.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes('gold') && {
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            justifyContent: 'flex-start',
                            padding: 0,
                            // background: '#fffbe7',
                            boxShadow: '0 2px 8px 0 rgba(255, 215, 0, 0.07)',
                          }),
                        }}  >
                        <Box
                          sx={{
                            width: '100%',
                            aspectRatio: '1 / 1',
                            display: "flex",
                            alignItems: "stretch",
                            justifyContent: "stretch",
                            borderRadius: 0,
                            overflow: "hidden",
                            position: "relative",
                            bgcolor: 'transparent',

                          }}
                        >
                          {(() => {
                            // Get brand name for this row
                            const brandName = getBrandName(row).toLowerCase();
                            if (brandName.includes("group")) {
                              // Do not show image for brands containing 'group'
                              return null;
                            }
                            // Gold supplier images (use id_fact)
                            const typeSupplierLower = row.Fournisseur?.TYPE_SUPPLIER?.toLowerCase() || "";
                            // If the supplier type indicates a watch, do not use gold images here
                            if (typeSupplierLower.includes("gold") && !typeSupplierLower.includes("watch")) {
                              const goldDp: any = row.DistributionPurchase;
                              const goldObj = Array.isArray(goldDp) && goldDp.length > 0
                                ? goldDp.find((d: any) => d?.GoldOriginalAchat)?.GoldOriginalAchat
                                : (goldDp && typeof goldDp === 'object' ? (goldDp as any).GoldOriginalAchat : null);
                              const goldId = goldObj?.id_achat || (row as any).picint || row.id_fact;
                              const goldKeyStr = getImageKey("gold", goldId);
                              const urls = normalizeImageList(imageUrls[goldKeyStr] || []);
                              // Pick preferred image (marketing -> invoice -> newest)
                              const idx = pickPreferredImageIndex(urls);
                              const token = localStorage.getItem("token");
                              const resolved = resolvedImgSrc[goldKeyStr];
                              return urls.length > 0 ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', width: '100%', height: '100%' }}>
                                  <Box
                                    component="img"
                                    src={(() => {
                                      if (resolved) return resolved;
                                      let url = urls[idx];
                                      if (!url) return "";
                                      url = ensureHttps(toApiImageAbsolute(url));
                                      if (token && !url.includes("token=")) {
                                        url += (url.includes("?") ? "&" : "?") +
                                          "token=" + encodeURIComponent(token);
                                      }
                                      return url;
                                    })()}
                                    alt={`Gold Image ${idx + 1}`}
                                    loading="lazy"
                                    sx={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                      background: "inherit",
                                      cursor: "pointer",
                                      display: 'block',
                                    }}
                                    onClick={() => {
                                      setDialogImageList(urls);
                                      setDialogImageIndex(idx);
                                      setImageDialogOpen(true);
                                    }}
                                    onError={(e) => {
                                      const img = e.currentTarget as HTMLImageElement;
                                      img.onerror = null;
                                      setResolvedImgSrc((prev) => ({ ...prev, [goldKeyStr]: "/GJ LOGO.png" }));
                                    }}
                                    title={urls[idx] || "No image URL"}
                                  />

                                </Box>
                              ) : (
                                <Box
                                  component="img"
                                  src="/GJ LOGO.png"
                                  alt="No Image"
                                  sx={{
                                    opacity: 0.5,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    display: 'block',
                                  }}
                                />
                              );
                            }
                            let dp: any = row.DistributionPurchase;
                            let diamond: any = undefined;
                            let watch: any = undefined;
                            if (
                              Array.isArray(dp) &&
                              dp.length > 0 &&
                              typeof dp[0] === "object"
                            ) {
                              diamond = dp[0]?.OriginalAchatDiamond;
                              watch = dp[0]?.OriginalAchatWatch;
                            } else if (dp && typeof dp === "object") {
                              diamond = dp?.OriginalAchatDiamond;
                              watch = dp?.OriginalAchatWatch;
                            }
                            const token = localStorage.getItem("token");
                            // Show preferred image for diamond (marketing -> invoice -> newest)
                            if (diamond) {
                              const imageKey = diamond.id_achat;
                              const imageKeyStr = getImageKey("diamond", imageKey);
                              const urls = imageUrls[imageKeyStr] || [];
                              const idx = pickPreferredImageIndex(urls);
                              return urls.length > 0 ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', width: '100%', height: '100%' }}>
                                  <Box
                                    component="img"
                                    src={(() => {
                                      // Hide image if brand name contains 'group'
                                      const brandName =
                                        getBrandName(row).toLowerCase();
                                      if (brandName.includes("group")) return "";
                                      let url = urls[idx];
                                      if (!url) return "";
                                      if (token && !url.includes("token=")) {
                                        url +=
                                          (url.includes("?") ? "&" : "?") +
                                          "token=" +
                                          encodeURIComponent(token);
                                      }
                                      return url;
                                    })()}
                                    alt={`Image ${idx + 1}`}
                                    loading="lazy"
                                    sx={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                      background: "inherit",
                                      cursor: "pointer",
                                      display: 'block',
                                    }}
                                    onClick={() => {
                                      // Open dialog with ALL images for this diamond (no marketing/invoice filtering)
                                      setDialogImageList(normalizeDialogUrls(urls));
                                      setDialogImageIndex(idx);
                                      setImageDialogOpen(true);
                                    }}
                                    onError={(e) => {
                                      const img = e.currentTarget as HTMLImageElement;
                                      img.onerror = null;
                                      img.src = "/default-image.png";
                                    }}
                                    title={urls[idx] || "No image URL"}
                                  />

                                </Box>
                              ) : (
                                <Box
                                  component="img"
                                  src="/default-image.png"
                                  alt="No Image"
                                  sx={{
                                    opacity: 0.5,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    display: 'block',
                                  }}
                                />
                              );
                            }
                            // Show preferred image for watch (marketing -> invoice -> newest)
                            if (watch) {
                              const imageKey = watch.id_achat;
                              const imageKeyStr = getImageKey("watch", imageKey);
                              const urls = imageUrls[imageKeyStr] || [];
                              const idx = pickPreferredImageIndex(urls);

                              return urls.length > 0 ? (
                                (() => {
                                  const original = urls[idx];

                                  const fileName = (original || '').split('?')[0].split('/').pop() || '';
                                  const apiBaseRaw = ('https://system.gaja.ly/api/');
                                  let origin = '';
                                  try { origin = new URL(apiBaseRaw).origin; } catch { origin = window.location.origin; }
                                  const originHttps = origin.replace(/^http:\/\//i, 'https://');
                                  try { if (origin !== originHttps) console.debug('[IMG][origin] force https', { in: origin, out: originHttps }); } catch { }
                                  const staticPath = `${originHttps}/uploads/WatchPic/${watch.id_achat}/${fileName}`; // use absolute like WOPurchase
                                  const chain = [staticPath];
                                  const tokenParam = token ? `token=${encodeURIComponent(token)}` : '';
                                  const withToken = (u: string) => {
                                    if (!u) return u;
                                    return tokenParam ? u + (u.includes('?') ? '&' : '?') + tokenParam : u;
                                  };
                                  return (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', width: '100%', height: '100%' }}>
                                      <Box
                                        component="img"
                                        src={withToken(chain[0])}
                                        data-fallback-index={0}
                                        data-fallback-chain={chain.join('|')}
                                        alt={`Image ${idx + 1}`}
                                        loading="lazy"
                                        sx={{
                                          width: "100%",
                                          height: "100%",
                                          objectFit: "cover",
                                          background: "inherit",
                                          cursor: "pointer",
                                          display: 'block',
                                        }}

                                        onClick={() => {
                                          // Open dialog with ALL watch images for this product (no marketing/invoice filtering)
                                          const token2 = localStorage.getItem("token");
                                          const urlsForDialog = urls.map((u) => {
                                            if (!u) return u;
                                            if (token2 && !u.includes("token=")) {
                                              return (
                                                u +
                                                (u.includes("?") ? "&" : "?") +
                                                "token=" +
                                                encodeURIComponent(token2)
                                              );
                                            }
                                            return u;
                                          });
                                          setDialogImageList(normalizeDialogUrls(urlsForDialog));
                                          setDialogImageIndex(idx);
                                          setImageDialogOpen(true);
                                        }}
                                        onError={(e) => {
                                          const img = e.currentTarget as HTMLImageElement;
                                          const currentIdx = Number(img.dataset.fallbackIndex || '0');
                                          const chainRaw = img.dataset.fallbackChain || '';
                                          const parts = chainRaw.split('|').filter(Boolean);
                                          const nextIdx = currentIdx + 1;
                                          if (nextIdx < parts.length) {
                                            img.dataset.fallbackIndex = String(nextIdx);
                                            const nextUrl = withToken(parts[nextIdx]);
                                            img.src = nextUrl;
                                          } else {
                                            img.onerror = null;
                                            img.src = '/default-image.png';
                                          }
                                        }}
                                        title={original || 'No image URL'}
                                      />

                                    </Box>
                                  );
                                })()
                              ) : (
                                <Box
                                  component="img"
                                  src="/default-image.png"
                                  alt="No Image"
                                  sx={{
                                    opacity: 0.5,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    display: 'block',
                                  }}
                                />
                              );
                            }
                            // For other types, show nothing
                            return null;
                          })()}
                        </Box>
                        {/* Details column */}
                        <Box
                          sx={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            gap: 0.75,
                            justifyContent: "flex-start",
                            alignItems: "flex-start",
                            textAlign: "left",
                            px: 1,
                            pb: 1,
                          }}
                        >
                          <Box
                            sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 1, width: '100%' }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, width: '100%' }}>
                              <Typography
                                component="div"
                                sx={{
                                  color: "text.primary",
                                  fontWeight: 800,
                                  fontSize: gridView === "3" ? 13 : 14,
                                  lineHeight: 1.2,
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                  wordBreak: 'break-word',
                                  flex: 1,
                                  minWidth: 0,
                                }}
                              >
                                {`ID: ${String(headerIdLabel)}`}{row.Design_art ? ` - ${row.Design_art}` : ""}
                              </Typography>
                              {(() => {
                                const priceText = (() => {
                                  if (isGoldItem) {
                                    if (displayMain) return `${displayMain} LYD`;
                                    return "";
                                  }
                                  if (salePriceDisplay) return `${salePriceDisplay} USD`;
                                  return "";
                                })();
                                if (!priceText) return null;
                                return (
                                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.05 }}>
                                    <Typography
                                      variant="body2"
                                      sx={{ fontWeight: 900, fontSize: 12, color: isGoldItem ? 'warning.main' : 'info.main' }}
                                    >
                                      {priceText}
                                    </Typography>
                                    {isGoldItem && displaySub ? (
                                      <Typography
                                        variant="caption"
                                        sx={{ fontWeight: 800, fontSize: 10.5, color: 'text.secondary' }}
                                      >
                                        {displaySub} LYD/g
                                      </Typography>
                                    ) : null}
                                  </Box>
                                );
                              })()}
                            </Box>

                            {row.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes('gold') && (
                              <Typography
                                variant="body2"
                                sx={{ color: 'text.secondary', fontWeight: 800, fontSize: 12 }}
                              >
                                Weight: {row.qty}
                                <Box component="span" sx={{ ml: 0.5, fontSize: 12 }}>
                                  g
                                </Box>
                              </Typography>
                            )}

                            {row.Fournisseur?.TYPE_SUPPLIER && (
                              <Typography
                                variant="body2"
                                sx={{
                                  color: 'warning.main',
                                  fontWeight: 900,
                                  fontSize: 12,
                                  lineHeight: 1.1,
                                }}
                              >
                                {row.Fournisseur?.TYPE_SUPPLIER}
                              </Typography>
                            )}

                            {row.Fournisseur?.client_name && (
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                {row.Fournisseur?.client_name}
                              </Typography>
                            )}
                            {/* Gold Charges Row: show only Sales Price inline; admin can open details */}
                            {row.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes('gold') && (() => {
                              const goldObj = Array.isArray(row.DistributionPurchase)
                                ? (row.DistributionPurchase as DistributionPurchase[]).find(
                                  (dp: DistributionPurchase) => !!dp.GoldOriginalAchat
                                )?.GoldOriginalAchat
                                : (row.DistributionPurchase && typeof row.DistributionPurchase === 'object'
                                  ? (row.DistributionPurchase as DistributionPurchase).GoldOriginalAchat
                                  : undefined);
                              const MakingCharge = goldObj?.MakingCharge ?? row.MakingCharge;
                              const ShippingCharge = goldObj?.ShippingCharge ?? row.ShippingCharge;
                              const TravelExpesenes = goldObj?.TravelExpesenes ?? row.TravelExpesenes;
                              const LossExpesenes = goldObj?.LossExpesenes ?? row.LossExpesenes;
                              const profitMargin = row.Fournisseur?.profit_margin ?? 0;

                              // compute sales price (same formula used previously)
                              let sales: number | null = null;
                              let salesg: number | null = null;
                              try {
                                const typeStr = (row.Fournisseur?.TYPE_SUPPLIER || '').toLowerCase();
                                if (typeStr.includes('gold')) {
                                  const usdPerOz = goldPrice?.usdPerOz ?? 0;
                                  const usdPerGramPure = usdPerOz > 0 ? (usdPerOz / 31.1034768) : (goldPrice?.usdPerGram ?? 0);
                                  let kVal: number | null = null;
                                  const mK = typeStr.match(/(?:gold\s*)(18|21|24)|\b(18|21|24)\b|(?:\b(\d{2})\s*k)/i);
                                  if (mK) {
                                    const picked = mK[1] || mK[2] || mK[3];
                                    kVal = Number(picked);
                                  } else {
                                    const fParsed = parsePurityFactorFromType(row.Fournisseur?.TYPE_SUPPLIER);
                                    if (fParsed && fParsed > 0 && fParsed <= 1) {
                                      kVal = Math.round(fParsed * 24);
                                    }
                                  }
                                  if (kVal) {
                                    const f = kVal / 24;
                                    const basePerGram = usdPerGramPure > 0 ? usdPerGramPure : (commonPurityPrices.find(p => p.k === 24)?.usdPerGram ?? 0);
                                    const makingVal = Number(MakingCharge || 0);
                                    const shippingVal = Number(ShippingCharge || 0);
                                    const travelVal = Number(TravelExpesenes || 0);
                                    const qtyVal = Number(row.qty || 0);
                                    const indirectCostPct = Number((((goldObj as any)?.IndirectCost || 0)) / 100);
                                    const profitPct = Number((profitMargin || 0) / 100);


                                    sales = qtyVal * (basePerGram * f * (1 + LossExpesenes / 100) + makingVal + shippingVal + travelVal) * (1 + indirectCostPct + profitPct) * (lastUsdRate || 1);
                                    salesg = (basePerGram * f * (1 + LossExpesenes / 100) + makingVal + shippingVal + travelVal) * (1 + indirectCostPct + profitPct) * (lastUsdRate || 1)

                                    //sales = (subtotal + lossPct + indirectCostPct + profitPct) * (lastUsdRate || 1);
                                  }
                                }
                              } catch (e) {
                                sales = null;
                              }

                              // Do not show weight here; weight is already in the header for gold.
                              return null;
                            })()}
                            {typeof row.Unite === "string" &&
                              row.Unite.startsWith("{") &&
                              row.Unite.endsWith("}") &&
                              row.Unite.slice(1, -1)
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean).length > 1 && (
                                <Button
                                  variant="outlined"
                                  color="primary"
                                  size="small"
                                  startIcon={<GroupIcon />}
                                  sx={{
                                    borderRadius: 2,
                                    fontWeight: 700,
                                   
                                    p: 0.5,
                                    border: "none",
                                    boxShadow: "none",
                                  }}
                                  onClick={async () => {
                                    const groupIds =
                                      typeof row.Unite === "string" &&
                                        row.Unite.startsWith("{") &&
                                        row.Unite.endsWith("}")
                                        ? row.Unite.slice(1, -1)
                                          .split(",")
                                          .map((s) => s.trim())
                                          .filter(Boolean)
                                        : [];
                                    const groupItems = data.filter((item) => {
                                      if (!item.Unite) return false;
                                      const itemIds =
                                        typeof item.Unite === "string" &&
                                          item.Unite.startsWith("{") &&
                                          item.Unite.endsWith("}")
                                          ? item.Unite.slice(1, -1)
                                            .split(",")
                                            .map((s) => s.trim())
                                            .filter(Boolean)
                                          : [];
                                      return groupIds.some((id) =>
                                        itemIds.includes(id)
                                      );
                                    });
                                    // Ensure images are loaded for all group items before opening dialog
                                    await Promise.all(
                                      groupItems.map(async (item) => {
                                        if (
                                          item.id_fact &&
                                          !imageUrls[item.id_fact]
                                        ) {
                                          await fetchImages(
                                            item.id_fact,
                                            "diamond"
                                          );
                                        }
                                      })
                                    );
                                    // Also ensure group images for the first item (for right column)
                                    if (
                                      groupItems.length > 0 &&
                                      groupItems[0].id_fact &&
                                      !imageUrls[groupItems[0].id_fact]
                                    ) {
                                      await fetchImages(
                                        groupItems[0].id_fact,
                                        "diamond"
                                      );
                                    }
                                    setGroupDialogData({
                                      groupName:
                                        row.Fournisseur?.client_name || "",
                                      generalComment: row.General_Comment || "",
                                      items: groupItems,
                                    });
                                    setGroupDialogOpen(true);
                                  }}
                                >
                                  {row.General_Comment}
                                </Button>
                              )}
                          </Box>
                          {/* Group Dialog */}
                          <GroupDialog
                            open={groupDialogOpen}
                            onClose={() => setGroupDialogOpen(false)}
                            groupName={groupDialogData.groupName}
                            items={groupDialogData.items}
                            imageUrls={imageUrls}
                          />

                          <Typography
                            variant="body2"
                            component="div"
                            sx={{
                              // whiteSpace: "pre-line",

                              fontSize: 13,
                              color: "text.secondary",
                              "& b": { color: "text.secondary", fontWeight: 700 },
                              width: '100%',
                            }}
                          >
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                              {row.Fournisseur?.TYPE_SUPPLIER &&
                                row.Fournisseur.TYPE_SUPPLIER.toLowerCase().includes("gold") && (
                                  <>
                                    <li>
                                      <b>Stone:</b> {row.Color_Rush ?? "-"}
                                    </li>
                                    <li>
                                      <b>Color:</b> {row.Color_Gold ?? "-"}
                                    </li>

                                  </>
                                )}
                            </ul>
                            {/* Exchange rate today: {(usdToLyd + 2.05).toLocaleString('en-LY', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}*/}
                            {(() => {
                              let diamond: any = undefined;
                              let dp: any = row.DistributionPurchase;
                              if (
                                Array.isArray(dp) &&
                                dp.length > 0 &&
                                typeof dp[0] === "object"
                              ) {
                                diamond = dp[0]?.OriginalAchatDiamond;
                              } else if (dp && typeof dp === "object") {
                                diamond = dp?.OriginalAchatDiamond;
                              }
                              if (!diamond) return null;
                              return (
                                <>
                                 
                                  {diamond.carat && (
                                    <>
                                      {` | `}
                                      <b>Carat:</b> {diamond.carat}
                                    </>
                                  )}
                                  {diamond.cut && (
                                    <>
                                      {` | `}
                                      <b>Cut:</b> {diamond.cut}
                                    </>
                                  )}
                                  {diamond.color && (
                                    <>
                                      {` | `}
                                      <b>Color:</b> {diamond.color}
                                    </>
                                  )}
                                  {diamond.clarity && (
                                    <>
                                      {` | `}
                                      <b>Clarity:</b> {diamond.clarity}
                                    </>
                                  )}
                                  {diamond.shape && (
                                    <>
                                      {` | `}
                                      <b>Shape:</b> {diamond.shape}
                                    </>
                                  )}
                                  {diamond.measurements && (
                                    <>
                                      {` | `}
                                      <b>Measurements:</b> {diamond.measurements}
                                    </>
                                  )}
                                  {diamond.depth_percent && (
                                    <>
                                      {` | `}
                                      <b>Depth %:</b> {diamond.depth_percent}
                                    </>
                                  )}
                                  {diamond.table_percent && (
                                    <>
                                      {` | `}
                                      <b>Table %:</b> {diamond.table_percent}
                                    </>
                                  )}
                                  {diamond.girdle && (
                                    <>
                                      {` | `}
                                      <b>Girdle:</b> {diamond.girdle}
                                    </>
                                  )}
                                  {diamond.culet && (
                                    <>
                                      {` | `}
                                      <b>Culet:</b> {diamond.culet}
                                    </>
                                  )}
                                  {diamond.polish && (
                                    <>
                                      {` | `}
                                      <b>Polish:</b> {diamond.polish}
                                    </>
                                  )}
                                  {diamond.symmetry && (
                                    <>
                                      {` | `}
                                      <b>Symmetry:</b> {diamond.symmetry}
                                    </>
                                  )}
                                  {diamond.fluorescence && (
                                    <>
                                      {` | `}
                                      <b>Fluorescence:</b> {diamond.fluorescence}
                                    </>
                                  )}
                                  {diamond.certificate_number && (
                                    <>
                                      {` | `}
                                      <b>Certificate Number:</b> {diamond.certificate_number}
                                    </>
                                  )}
                                  {diamond.certificate_lab && (
                                    <>
                                      {` | `}
                                      <b>Certificate Lab:</b> {diamond.certificate_lab}
                                    </>
                                  )}
                                  {diamond.certificate_url && (
                                    <>
                                      {` | `}
                                      <b>Certificate URL:</b>{" "}
                                      <a
                                        href={diamond.certificate_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: "text.secondary" }}
                                      >
                                        Link
                                      </a>
                                    </>
                                  )}
                                  {diamond.laser_inscription && (
                                    <>
                                      {` | `}
                                      <b>Laser Inscription:</b> {diamond.laser_inscription}
                                    </>
                                  )}
                                  {diamond.origin_country && (
                                    <>
                                      {` | `}
                                      <b>Origin Country:</b> {diamond.origin_country}
                                    </>
                                  )}
                                  {(diamond.CODE_EXTERNAL || row.id_fact) && (
                                    <>
                                      {` | `}
                                      <b>Ref. Code:</b> {diamond.CODE_EXTERNAL || row.id_fact}
                                    </>
                                  )}
                                </>
                              );
                            })()}
                            {(() => {
                              let watch: any = undefined;
                              let dp: any = row.DistributionPurchase;
                              if (
                                Array.isArray(dp) &&
                                dp.length > 0 &&
                                typeof dp[0] === "object"
                              ) {
                                watch = dp[0]?.OriginalAchatWatch;
                              } else if (dp && typeof dp === "object") {
                                watch = dp?.OriginalAchatWatch;
                              }
                              if (!watch) return null;
                              return (
                                <>
                                  {/* Render only non-empty fields for watch info */}
                                  {(() => {
                                    const fields = [
                                      {
                                        key: "id_achat",
                                        label: "system Original ref.",
                                      },
                                      { key: "reference_number", label: "Ref." },
                                      {
                                        key: "serial_number",
                                        label: "Serial No.",
                                      },
                                      { key: "movement", label: "Movement" },
                                      { key: "caliber", label: "Caliber" },
                                      { key: "gender", label: "Gender" },
                                      { key: "condition", label: "Condition" },
                                      {
                                        key: "diamond_total_carat",
                                        label: "Diamond Carat",
                                      },
                                      {
                                        key: "diamond_quality",
                                        label: "Diamond Quality",
                                      },
                                      {
                                        key: "diamond_setting",
                                        label: "Diamond Setting",
                                      },
                                      {
                                        key: "number_of_diamonds",
                                        label: "Diamonds #",
                                      },
                                      {
                                        key: "custom_or_factory",
                                        label: "Custom/Factory",
                                      },
                                      {
                                        key: "case_material",
                                        label: "Case Material",
                                      },
                                      { key: "case_size", label: "Case Size" },
                                      { key: "bezel", label: "Bezel" },
                                      {
                                        key: "bracelet_type",
                                        label: "Bracelet Type",
                                      },
                                      {
                                        key: "bracelet_material",
                                        label: "Bracelet Material",
                                      },
                                      { key: "dial_color", label: "Dial Color" },
                                      { key: "dial_style", label: "Dial Style" },
                                      { key: "crystal", label: "Crystal" },
                                      {
                                        key: "water_resistance",
                                        label: "Water Resistance",
                                      },
                                      { key: "functions", label: "Functions" },
                                      {
                                        key: "power_reserve",
                                        label: "Power Reserve",
                                      },
                                      {
                                        key: "common_local_brand",
                                        label: "Nickname",
                                      },
                                    ];
                                    return fields.map((f) => {
                                      const val = watch[f.key];
                                      if (
                                        val === undefined ||
                                        val === null ||
                                        val === ""
                                      )
                                        return null;
                                      return (
                                        <span key={f.key}>
                                          {" "}
                                          | <b>{f.label}:</b> {val}
                                        </span>
                                      );
                                    });
                                  })()}
                                  {/* Box/Papers special case */}
                                  {typeof watch.box_papers !== "undefined" &&
                                    watch.box_papers !== null ? (
                                    <>
                                      {" "}
                                      | <b>Box/Papers:</b>{" "}
                                      {watch.box_papers ? "Yes" : "No"}
                                    </>
                                  ) : null}
                                  {/* Warranty */}
                                  {watch.warranty ? (
                                    <>
                                      {" "}
                                      | <b>Warranty:</b> {watch.warranty}
                                    </>
                                  ) : null}
                                </>
                              );
                            })()}
                          </Typography>
                          <Button
                            variant="contained"
                            color="warning"
                            size="small"
                            sx={{
                              mt: 1,
                              fontWeight: 700,
                              borderRadius: 2,
                              alignSelf: "stretch",
                              width: '100%',
                              py: 1,
                            }}
                            onClick={() => handleSave(row)}
                            disabled={
                              addToCartLoading[row.id_fact] ||
                              datainv.some((item) => item.id_art === row.id_fact)
                            }
                            startIcon={
                              addToCartLoading[row.id_fact] ? (
                                <CircularProgress size={18} color="inherit" />
                              ) : null
                            }
                          >
                            {addToCartLoading[row.id_fact]
                              ? "Adding..."
                              : datainv.some(
                                (item) => item.id_art === row.id_fact
                              )
                                ? "In Cart"
                                : "Add to cart"}
                          </Button>
                        </Box>
                      </Box>
                    )
                  })}
                {/* Footer: Rows per page selector */}
                <Box
                  sx={(theme) => ({
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    justifyContent: "space-between",
                    alignItems: "center",
                    mt: 2,
                    mb: 1,
                    gap: 2,
                    flexWrap: "wrap",
                    bgcolor: theme.palette.mode === "dark" ? "#222" : "#fafafa",
                    borderRadius: 2,
                    boxShadow:
                      theme.palette.mode === "dark"
                        ? "0 1px 8px rgba(0,0,0,0.25)"
                        : "0 1px 8px rgba(0,0,0,0.07)",
                    p: { xs: 1, sm: 2 },
                    position: 'sticky',
                    bottom: 0,
                    zIndex: 10,
                    backdropFilter: 'blur(4px)',
                    borderTop: '1px solid #e0e0e0',
                    gridColumn: '1 / -1',
                  })}
                >
                  <Typography
                    variant="body2"
                    sx={(theme) => ({
                      fontWeight: 600,
                      color: "text.secondary",
                    })}
                  >
                    Product Count: {filteredData.length}
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      flexWrap: "wrap",
                    }}
                  >


                    <Typography
                      variant="body2"
                      sx={(theme) => ({
                        mr: 1,
                        fontWeight: 600,
                        color: "text.secondary",
                      })}
                    >
                      Rows per page:
                    </Typography>
                    <Box sx={{ minWidth: 100 }}>
                      <select
                        value={rowsPerPage}
                        onChange={(e) => {
                          setRowsPerPage(Number(e.target.value));
                          setPage(0);
                        }}
                        style={{
                          padding: "8px 18px",
                          borderRadius: 8,
                          border: "1px solid #e0e0e0",
                          fontSize: 15,
                          background: "inherit",
                          fontWeight: 500,
                          color: "text.secondary",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                          outline: "none",
                          transition: "border 0.2s",
                        }}
                      >
                        {gridView === 'icons' ? (
                          <>
                            <option value={24}>24</option>
                          </>
                        ) : gridView === '3' || gridView === '4' || gridView === '5' || gridView === '6' || gridView === '8' ? (
                          <>
                            <option value={12}>12</option>
                            <option value={24}>24</option>
                            <option value={48}>48</option>
                            <option value={96}>96</option>
                          </>
                        ) : (
                          <>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={30}>30</option>
                          </>
                        )}
                      </select>
                    </Box>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        ml: 2,
                        flexWrap: "wrap",
                      }}
                    >
                      <IconButton
                        size="small"
                        onClick={() => setPage(0)}
                        disabled={page === 0}
                        sx={(theme) => ({
                          borderRadius: 2,
                          bgcolor:
                            page === 0
                              ? theme.palette.mode === "dark"
                                ? "#333"
                                : "#eee"
                              : "inherit",
                          border: "1px solid #e0e0e0",
                          color: "text.secondary",
                        })}
                      >
                        <span style={{ fontSize: 18, fontWeight: 700 }}>
                          &#8676;
                        </span>
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                        disabled={page === 0}
                        sx={(theme) => ({
                          borderRadius: 2,
                          bgcolor:
                            page === 0
                              ? theme.palette.mode === "dark"
                                ? "#333"
                                : "#eee"
                              : "inherit",
                          border: "1px solid #e0e0e0",
                          color: "text.secondary",
                        })}
                      >
                        <span style={{ fontSize: 18, fontWeight: 700 }}>
                          &larr;
                        </span>
                      </IconButton>
                      <Typography
                        variant="body2"
                        sx={(theme) => ({
                          minWidth: 32,
                          textAlign: "center",
                          fontWeight: 600,
                          color: "text.secondary",
                        })}
                      >
                        {page + 1}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() =>
                          setPage((prev) =>
                            prev + 1 <
                              Math.ceil(filteredData.length / rowsPerPage)
                              ? prev + 1
                              : prev
                          )
                        }
                        disabled={
                          page + 1 >=
                          Math.ceil(filteredData.length / rowsPerPage)
                        }
                        sx={(theme) => ({
                          borderRadius: 2,
                          bgcolor:
                            page + 1 >=
                              Math.ceil(filteredData.length / rowsPerPage)
                              ? theme.palette.mode === "dark"
                                ? "#333"
                                : "#eee"
                              : "inherit",
                          border: "1px solid #e0e0e0",
                          color: "text.secondary",
                        })}
                      >
                        <span style={{ fontSize: 18, fontWeight: 700 }}>
                          &rarr;
                        </span>
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() =>
                          setPage(
                            Math.max(
                              Math.ceil(filteredData.length / rowsPerPage) - 1,
                              0
                            )
                          )
                        }
                        disabled={
                          page + 1 >=
                          Math.ceil(filteredData.length / rowsPerPage)
                        }
                        sx={(theme) => ({
                          borderRadius: 2,
                          bgcolor:
                            page + 1 >=
                              Math.ceil(filteredData.length / rowsPerPage)
                              ? theme.palette.mode === "dark"
                                ? "#333"
                                : "#eee"
                              : "inherit",
                          border: "1px solid #e0e0e0",
                          color: "text.secondary",
                        })}
                      >
                        <span style={{ fontSize: 18, fontWeight: 700 }}>
                          &#8677;
                        </span>
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              </>
            )}
          </Box>
        </Box>
        <Box sx={{ width: "15%", minWidth: 200 }}>
          {/* Right Sidebar - Cart */}
          <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, flex: 1, color: "text.secondary", }}>
              Cart
            </Typography>
            <Box
              sx={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <Box sx={{ color: "warning.main", fontSize: 28, mr: 0.5 }}>
                <span role="img" aria-label="cart">
                  <ShoppingCartCheckoutOutlined />
                </span>
              </Box>
              <Box
                sx={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  bgcolor: "error.main",
                  color: "white",
                  borderRadius: "50%",
                  width: 22,
                  height: 22,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 14,
                  border: "2px solid #fff",
                  zIndex: 1,
                }}
              >
                {datainv.length}
              </Box>
            </Box>
          </Box>
          <Button
            variant="outlined"
            color="error"
            size="small"
            sx={{ mb: 2, fontWeight: 700, borderRadius: 2, width: "100%" }}
            onClick={() => {
              setEditInvoice(initialInvoiceState); // <-- Empty editInvoice
              setEmptyCartConfirmOpen(true);
            }}
            disabled={datainv.length === 0}
          >
            Empty my cart
          </Button>
          {/* Cart Items List */}
          {datainv.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No items in cart
            </Typography>
          ) : (
            <>
              {datainv.map((item, idx) => {
                // Extract display fields from ACHATs[0] if available
                const achat = item.ACHATs?.[0];

                const itemName =
                  (achat as any)?.Design_art || (item as any)?.Design_art || "";

                const typeSupplier =
                  achat?.Fournisseur?.TYPE_SUPPLIER || "Unknown Type";
                return (
                  <React.Fragment key={item.id_art}>
                    <Box
                      sx={{
                        mb: 0,
                        border: "none",
                        borderRadius: 0,
                        display: "flex",
                        alignItems: "center",
                        position: "relative",
                        bgcolor: "transparent",
                        ...(item.IS_GIFT && {
                          bgcolor: "rgba(255, 68, 0, 0.08)",
                          color: "warning.main",
                        }),
                      }}
                    >
                    {/* Show image if available */}
                    <Box
                      sx={{
                        width: 60,
                        height: 60,
                        display: "flex",
                        alignItems: "stretch",
                        justifyContent: "stretch",
                        borderRadius: 0,
                        overflow: "hidden",
                        mr: 1,
                        bgcolor: "inherit",
                        border: "none",
                      }}
                    >
                      {(() => {
                        // Show preferred image from imageUrls if available, else fallback to pic
 
                        const kind: "gold" | "watch" | "diamond" | undefined =
                          typeSupplier.toLowerCase().includes("gold")
                            ? "gold"
                            : typeSupplier.toLowerCase().includes("watch")
                            ? "watch"
                            : typeSupplier.toLowerCase().includes("diamond")
                            ? "diamond"
                            : undefined;

                        // Align the lookup ids with the ones used when fetching gold images
                        const dp: any = (achat as any)?.DistributionPurchase || (item as any)?.DistributionPurchase;
                        const goldObj = Array.isArray(dp) && dp.length > 0
                          ? dp.find((d: any) => d?.GoldOriginalAchat)?.GoldOriginalAchat || dp[0]?.GoldOriginalAchat
                          : (dp && typeof dp === "object" ? (dp as any).GoldOriginalAchat : null);
                        const goldCandidates = kind === "gold"
                          ? [
                              goldObj?.id_achat,
                              (item as any).id_art,
                              (item as any).picint,
                              item.id_fact,
                            ]
                              .map((v) => Number(v || 0))
                              .filter((v) => v > 0)
                          : [];

                        const baseImageId = kind === "gold"
                          ? (goldCandidates.find((cid) => !!imageUrls[getImageKey("gold", cid)]) || goldCandidates[0])
                          : (item as any).picint || (item as any).id_fact;

                        const imageKey = baseImageId;

                        const candidateKeys = kind === "gold"
                          ? goldCandidates.map((cid) => getImageKey("gold", cid))
                          : [getImageKey(kind, baseImageId)];

                        const urls = Array.from(
                          new Set(
                            candidateKeys.flatMap((k) => imageUrls?.[k] || [])
                          )
                        );
                        const token = localStorage.getItem("token");
                        if (urls.length > 0) {
                          const isWatch = typeSupplier.toLowerCase().includes('watch');
                          if (!isWatch) {
                            const idx = pickPreferredImageIndex(urls);
                            let url = urls[idx];
                            if (token && url && !url.includes('token=')) {
                              url += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
                            }
                            return (
                              <Box
                                component="img"
                                src={url}
                                alt="Product"
                                loading="lazy"
                                sx={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "contain",
                                  borderRadius: 1,
                                  border: "1px solid #ccc",
                                }}
                                onError={(e) => {
                                  const img = e.currentTarget as HTMLImageElement;
                                  img.onerror = null;
                                  img.src = '/default-image.png';
                                }}
                              />
                            );
                          } else {
                            const idx = pickPreferredImageIndex(urls);
                            const original = urls[idx];
                            const fileName = (original || '').split('?')[0].split('/').pop() || '';
                            const apiBaseRaw = (process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_IP || 'https://system.gaja.ly/api').replace(/\/+$/, '');
                            let origin = '';
                            try { origin = new URL(apiBaseRaw).origin; } catch { origin = window.location.origin; }
                            const originHttps = origin.replace(/^http:\/\//i, 'https://');
                            try { if (origin !== originHttps) console.debug('[IMG][origin] force https', { in: origin, out: originHttps }); } catch { }
                            const primaryRaw = normalizeWatchUrl(original, imageKey);
                            const primary = primaryRaw?.startsWith('/') ? originHttps + primaryRaw : ensureHttps(primaryRaw);
                            const generic = `${originHttps}/images/${imageKey}/${fileName}`;
                            const staticPath = `${originHttps}/uploads/WatchPic/${imageKey}/${fileName}`;
                            const chain = [primary, generic, staticPath];
                            const tokenParam = token ? `token=${encodeURIComponent(token)}` : '';
                            const withToken = (u: string) => tokenParam ? u + (u.includes('?') ? '&' : '?') + tokenParam : u;
                            return (
                              <Box
                                component="img"
                                src={withToken(chain[0])}
                                data-fallback-index={0}
                                data-fallback-chain={chain.join('|')}
                                alt="Product"
                                loading="lazy"
                                sx={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "contain",
                                  borderRadius: 1,
                                  border: "1px solid #ccc",
                                }}
 
                                onError={(e) => {
                                  const img = e.currentTarget as HTMLImageElement;
                                  const currentIdx = Number(img.dataset.fallbackIndex || '0');
                                  const chainRaw = img.dataset.fallbackChain || '';
                                  const parts = chainRaw.split('|').filter(Boolean);
                                  const nextIdx = currentIdx + 1;
                                  if (nextIdx < parts.length) {
                                    img.dataset.fallbackIndex = String(nextIdx);
                                    const nextUrl = withToken(parts[nextIdx]);
                                    img.src = nextUrl;
                                  } else {
                                    img.onerror = null;
                                    img.src = '/default-image.png';
                                  }
                                }}
                              />
                            );
                          }
                        }
 
                        // If we reach here there are no image URLs available for this item.
                        // Fall back to any inline `pic` field the item might have, otherwise a default image.
                        const fallbackSrc = (item as any)?.pic || '/default-image.png';
                        return (
                          <Box
                            component="img"
                            src={fallbackSrc}
                            alt="Product"
                            loading="lazy"
                            sx={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                              borderRadius: 1,
                              border: "1px solid #ccc",
                            }}
                            onError={(e) => {
                              const img = e.currentTarget as HTMLImageElement;
                              img.onerror = null;
                              img.src = '/default-image.png';
                            }}
                          />
                        );
                      })()}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        ID: {item.id_art}
                        {itemName ? ` — ${itemName}` : ""}
                      </Typography>

                      {typeSupplier.toLowerCase().includes("gold") && (
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary", fontWeight: 500 }}
                        >
                          Weight: {item.qty} g
                        </Typography>
                      )}
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          mb: 0.5,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            color: "warning.main",
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          {typeSupplier}
                        </Typography>
                        <Typography variant="body2">
                          {item.IS_GIFT ? (
                            <Box
                              component="span"
                              sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.5,
                                color: "orangered",
                                fontWeight: 900,
                              }}
                            >
                              <CardGiftcardOutlinedIcon sx={{ fontSize: 18 }} />
                              Marked as Gift
                            </Box>
                          ) : (
                            ""
                          )}
                        </Typography>
                      </Box>

                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: "bold",
                          color: typeSupplier.toLowerCase().includes("gold")
                            ? "goldenrod"
                            : "deepskyblue",
                          fontSize: 16,
                          letterSpacing: 0.5,
                        }}
                      >
                        {(() => {
                          const isGold = typeSupplier.toLowerCase().includes("gold");
                          const value =
                            typeof item.prix_vente_remise === "number"
                              ? item.prix_vente_remise
                              : typeof item.prix_vente === "number"
                              ? item.prix_vente
                              : null;

                          if (value === null) return "-";

                          return (
                            <>
                              {value.toLocaleString(isGold ? "en-LY" : "en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                              <Box component="sup" sx={{ fontSize: 12, ml: 0.6, lineHeight: 1 }}>
                                {isGold ? "LYD" : "USD"}
                              </Box>
                            </>
                          );
                        })()}
                      </Typography>
                    </Box>
                    {/* Delete icon */}
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "row",
                        gap: 1,
                        position: "absolute",
                        top: 4,
                        right: 4,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                        <Switch
                          checked={!!item.IS_GIFT}
                          onChange={(e) => handleToggleCartGift(item, e.target.checked)}
                          color="warning"
                          size="small"
                        />
                        <CardGiftcardOutlinedIcon
                          sx={{
                            fontSize: 18,
                            color: item.IS_GIFT ? "warning.main" : "text.disabled",
                          }}
                        />
                      </Box>
                      <Button
                        onClick={() => {
                          setDeleteTargetId(item.id_fact);
                          setDeleteConfirmOpen(true);
                        }}
                        size="small"
                        sx={{ minWidth: 0, p: 0.5 }}
                        color="error"
                      >
                        <DeleteOutlineIcon />
                      </Button>
                    </Box>
                    </Box>
                    {idx < datainv.length - 1 && <Divider sx={{ my: 0.75 }} />}
                  </React.Fragment>
                );
              })}
              {/* Total Amounts by Currency */}
              <Box
                sx={{
                  mt: 0.5,
                  p: 1,
                  borderTop: "1px solid #eee",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    mb: 0,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  Total
                </Typography>
                {(() => {
                  const goldTotal = getFinalTotal(datainv, "gold");
                  const diamondTotal = getFinalTotal(datainv, "diamond");
                  const watchTotal = getFinalTotal(datainv, "watch");

                  if (goldTotal > 0) {
                    return (
                      <Typography
                        variant="subtitle2"
                        sx={{ color: "goldenrod", fontWeight: 800 }}
                      >
                        {goldTotal.toLocaleString("en-LY", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        LYD
                      </Typography>
                    );
                  }
                  if (diamondTotal > 0) {
                    return (
                      <Typography
                        variant="subtitle2"
                        sx={{ color: "deepskyblue", fontWeight: 800 }}
                      >
                        {diamondTotal.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        USD
                      </Typography>
                    );
                  }
                  if (watchTotal > 0) {
                    return (
                      <Typography
                        variant="subtitle2"
                        sx={{ color: "orange", fontWeight: 800 }}
                      >
                        {watchTotal.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        USD
                      </Typography>
                    );
                  }
                  return null;
                })()}
              </Box>
              <Box
                sx={{
                  mb: 1,
                  p: 1,
                  borderTop: "1px solid #eee",
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.5,
                }}
              >
                {goldWeightTotal > 0 ? (
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Gold Weight: {goldWeightTotal.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    g
                  </Typography>
                ) : null}
                {diamondItemCount > 0 ? (
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Diamond Items: {diamondItemCount}
                  </Typography>
                ) : null}
                {watchItemCount > 0 ? (
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Watch Items: {watchItemCount}
                  </Typography>
                ) : null}
              </Box>
              {!canPrint ? (
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  sx={{ mt: 1, fontWeight: 700, borderRadius: 2, width: "100%" }}
                  onClick={handleOpenTotalsDialog}
                  disabled={datainv.length === 0}
                >
                  Checkout
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  sx={{ mt: 1, fontWeight: 900, borderRadius: 2, width: "100%" }}
                  onClick={() => {
                    const latestInvoice = datainv.find(
                      (inv) =>
                        inv.num_fact === 0 &&
                        inv.ps === Number(ps) &&
                        inv.usr === Number(Cuser)
                    );
                    setPrintDialog({ open: true, invoice: latestInvoice || null });
                  }}
                  disabled={datainv.length === 0}
                >
                  Proceed to Invoice
                </Button>
              )}

              <Button
                variant="text"
                color="primary"
                size="small"
                sx={{ mt: 0.5, fontWeight: 700, borderRadius: 2, width: "100%" }}
                onClick={handleOpenIssuedInvoices}
              >
                View Issued Invoices
              </Button>

              <Dialog
                open={issuedInvoicesOpen}
                onClose={() => setIssuedInvoicesOpen(false)}
                fullWidth
                maxWidth="sm"
              >
                <DialogTitle>Issued Invoices</DialogTitle>
                <DialogContent dividers>
                  {issuedInvoicesLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
                      <CircularProgress size={28} />
                    </Box>
                  ) : issuedInvoiceSummaries.length === 0 ? (
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      No issued invoices found.
                    </Typography>
                  ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      {issuedInvoiceSummaries.map((inv, idx) => (
                        <React.Fragment key={inv.num_fact}>
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "row",
                              gap: 1,
                              alignItems: "stretch",
                            }}
                          >
                            <Button
                              variant="outlined"
                              onClick={() => handleLoadIssuedInvoice(inv.num_fact)}
                              sx={{
                                flex: 1,
                                justifyContent: "space-between",
                                textTransform: "none",
                                borderRadius: 2,
                              }}
                            >
                              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                                <Typography sx={{ fontWeight: 900 }}>#{inv.num_fact}</Typography>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                  {inv.client_name || ""}{inv.date_fact ? ` — ${inv.date_fact}` : ""}
                                </Typography>
                              </Box>
                              <Chip label={`${inv.itemCount} items`} size="small" />
                            </Button>
                            <Button
                              variant="outlined"
                              color="warning"
                              onClick={() => setIssuedReissueConfirm({ open: true, numFact: inv.num_fact })}
                              sx={{ minWidth: 90, borderRadius: 2, fontWeight: 800 }}
                            >
                              Reissue
                            </Button>
                            <Button
                              variant="outlined"
                              color="error"
                              onClick={() => setIssuedDeleteConfirm({ open: true, numFact: inv.num_fact })}
                              sx={{ minWidth: 90, borderRadius: 2, fontWeight: 800 }}
                            >
                              Delete
                            </Button>
                          </Box>
                          {idx < issuedInvoiceSummaries.length - 1 ? (
                            <Divider sx={{ my: 0.5 }} />
                          ) : null}
                        </React.Fragment>
                      ))}
                    </Box>
                  )}
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setIssuedInvoicesOpen(false)}>Close</Button>
                </DialogActions>
              </Dialog>

              <Dialog
                open={issuedDeleteConfirm.open}
                onClose={() => setIssuedDeleteConfirm({ open: false, numFact: null })}
                fullWidth
                maxWidth="xs"
              >
                <DialogTitle>Delete Issued Invoice</DialogTitle>
                <DialogContent dividers>
                  <Typography>
                    Delete invoice #{issuedDeleteConfirm.numFact}? This will remove all items.
                  </Typography>
                </DialogContent>
                <DialogActions>
                  <Button
                    onClick={() => setIssuedDeleteConfirm({ open: false, numFact: null })}
                    disabled={issuedDeleteLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    color="error"
                    variant="contained"
                    disabled={issuedDeleteLoading || !issuedDeleteConfirm.numFact}
                    onClick={() => {
                      if (!issuedDeleteConfirm.numFact) return;
                      handleDeleteIssuedInvoice(issuedDeleteConfirm.numFact);
                    }}
                  >
                    {issuedDeleteLoading ? <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} /> : null}
                    Delete
                  </Button>
                </DialogActions>
              </Dialog>

              <Dialog
                open={issuedReissueConfirm.open}
                onClose={() => setIssuedReissueConfirm({ open: false, numFact: null })}
                fullWidth
                maxWidth="xs"
              >
                <DialogTitle>Reissue Invoice</DialogTitle>
                <DialogContent dividers>
                  <Typography>
                    Reissue invoice #{issuedReissueConfirm.numFact} into your current cart (draft invoice)?
                  </Typography>
                </DialogContent>
                <DialogActions>
                  <Button
                    onClick={() => setIssuedReissueConfirm({ open: false, numFact: null })}
                    disabled={issuedReissueLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    color="warning"
                    variant="contained"
                    disabled={issuedReissueLoading || !issuedReissueConfirm.numFact}
                    onClick={() => {
                      if (!issuedReissueConfirm.numFact) return;
                      handleReissueInvoice(issuedReissueConfirm.numFact);
                    }}
                  >
                    {issuedReissueLoading ? <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} /> : null}
                    Reissue
                  </Button>
                </DialogActions>
              </Dialog>

              <InvoiceTotalsDialog
                Type_Supplier={
                  datainv[0]?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || ""
                }
                open={totalsDialog.open}
                lastUsdRate={lastUsdRate}
                lastEurRate={lastEurRate}
                totals={totalsDialog}
                isSaving={isSaving}
                onChange={handleTotalsDialogChange}
                onClose={handleTotalsDialogClose}
                onUpdate={handleTotalsDialogUpdate}
                onUpdateTotalsOnly={handleTotalsDialogUpdateForApproval}
                Sm={Sm}
                customers={customers}
                editInvoice={editInvoice}
                setEditInvoice={setEditInvoice}
                errors={{ client: "" }} // You may want to handle errors statefully
                minPer={minPer ?? undefined}
                totalPrixVente={totalPrixVente ?? undefined}
                referenceId={datainv[0]?.id_fact ?? 0}
              />
              <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() =>
                  setSnackbar((prev) => ({ ...prev, open: false }))
                }
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
              >
                <MuiAlert
                  elevation={6}
                  variant="filled"
                  severity={snackbar.severity}
                  onClose={() =>
                    setSnackbar((prev) => ({ ...prev, open: false }))
                  }
                >
                  {snackbar.message}
                </MuiAlert>
              </Snackbar>
              <PrintInvoiceDialog
                open={printDialog.open}
                invoice={printDialog.invoice}
                data={{
                  invoice: printDialog.invoice || initialInvoiceState,
                  items: datainv,
                  customer: customers.find(
                    (c) => c.id_client === editInvoice.client
                  ),
                  totalAmountLYD: totalsDialog.total_remise_final_lyd,
                  totalAmountUSD: totalsDialog.total_remise_final,
                  totalAmountEur: totalsDialog.amount_EUR,
                  totalWeight: 0, // Add your calculation if needed
                  itemCount: datainv.length,
                  amount_lyd: totalsDialog.amount_lyd,
                  amount_currency: totalsDialog.amount_currency,
                  amount_EUR: totalsDialog.amount_EUR,
                  amount_currency_LYD: totalsDialog.amount_currency_LYD,
                  amount_EUR_LYD: totalsDialog.amount_EUR_LYD,
                  Original_Invoice:
                    datainv[0]?.ACHATs?.[0]?.Original_Invoice || "",
                  picint: datainv[0]?.picint || 0,
                  remise: totalsDialog.remise, // <-- Pass remise
                  remise_per: totalsDialog.remise_per, // <-- Pass remise_per
                }}
                printRef={printRef}
                onClose={() =>
                  setPrintDialog((prev) => ({ ...prev, open: false }))
                }
                onInvoiceClosed={() => {
                  fetchData(typeFilter); // Refresh data after closing invoice
                }}
                onCartRefresh={() => {
                  // Issuing an invoice number should remove draft rows from the cart immediately.
                  setDatainv([]);
                  setEditInvoice(initialInvoiceState);
                  setCanPrint(false);
                  fetchDataINV(); // Refresh the cart after closing invoice
                }}
                showCloseInvoiceActions={false}
                showCloseInvoice={false}
              />

            </>
          )}
        </Box>
      </Box>
      {/* Charges Dialog (global instance) - ensure dialog renders even when cart is empty */}

      <Snackbar
        open={deleteConfirmOpen}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <Box
          sx={{
            background: "#fff",
            color: "#222",
            boxShadow: 6,
            minWidth: 340,
            textAlign: "center",
            borderRadius: 2,
            p: 2,
          }}
        >
          <Typography sx={{ mb: 1, fontWeight: "bold", color: "#f44336" }}>
            Confirm Deletion
          </Typography>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to delete this item from the cart?
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "center", gap: 2 }}>
            <Button
              variant="contained"
              color="error"
              disabled={deleteLoading}
              onClick={async () => {
                setDeleteLoading(true);
                if (deleteTargetId !== null) {
                  const token = localStorage.getItem("token");
                  await axios.delete(`${apiUrlinv}/Delete/${deleteTargetId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  await fetchDataINV();
                  await fetchData();
                }
                setDeleteConfirmOpen(false);
                setDeleteTargetId(null);
                setDeleteLoading(false);
              }}
            >
              {deleteLoading ? (
                <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
              ) : null}
              Yes, Delete
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      </Snackbar>
      <Snackbar
        open={emptyCartConfirmOpen}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        onClose={() => setEmptyCartConfirmOpen(false)}
      >
        <Box
          sx={{
            background: "#fff",
            color: "#222",
            boxShadow: 6,
            minWidth: 340,
            textAlign: "center",
            borderRadius: 2,
            p: 2,
          }}
        >
          <Typography sx={{ mb: 1, fontWeight: "bold", color: "#f44336" }}>
            Confirm Empty Cart
          </Typography>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to remove all items from your cart?
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "center", gap: 2 }}>
            <Button
              variant="contained"
              color="error"
              disabled={emptyCartLoading}
              onClick={async () => {
                setEmptyCartLoading(true);
                try {
                  for (const item of datainv) {
                    await axios.delete(`${apiUrlinv}/Delete/${item.id_fact}`, {
                      headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                      },
                    });
                  }
                  await fetchDataINV();
                  // Reset customer selection when cart is emptied
                  setEditInvoice((prev) => ({
                    ...initialInvoiceState,
                    client: 0,
                    Client: undefined,
                  }));
                } finally {
                  setEmptyCartLoading(false);
                  setEmptyCartConfirmOpen(false);
                }
              }}
            >
              {emptyCartLoading ? (
                <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
              ) : null}
              Yes, Empty
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => setEmptyCartConfirmOpen(false)}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      </Snackbar>
    </Box>
  );
};

export default DNew_I;