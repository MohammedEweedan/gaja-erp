import React, { useState, useEffect, useCallback, useRef } from "react";
import GroupDialog from "./GroupDialog";
import GroupIcon from "@mui/icons-material/Group";
import axios from "../../../api";
import IconButton from "@mui/material/IconButton";
import { useNavigate } from "react-router-dom";
import { Box, Button, Typography, TextField, MenuItem } from "@mui/material";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";

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
  };
  Original_Invoice: string;
  DistributionPurchase?: DistributionPurchase[];
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
    Rate?: number;
    Total_Price_LYD?: number;
    sale_price?: number;
    common_local_brand?: string;
  };
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

// Helper to prefetch images without triggering CORS preflight
const fetchImageWithAuth = async (url: string, token: string) => {
  try {
    // Skip absolute cross-origin URLs to avoid CORS issues
    if (/^https?:\/\//i.test(url)) {
      return null;
    }
    // For relative URLs, append token param if missing; do not send auth headers
    let finalUrl = url;
    if (token && /^(\/images|\/uploads)\//.test(finalUrl) && !/(^|[&?])token=/.test(finalUrl)) {
      finalUrl += (finalUrl.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
    }
    const res = await fetch(finalUrl, { method: 'GET', credentials: 'same-origin' });
    if (!res.ok) return null;
    // Warm the cache
    await res.blob();
    return null;
  } catch (err) {
    return null;
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

  const fetchImages = async (
    id_achat: number,
    kind?: "diamond" | "watch" | "gold"
  ) => {
    const token = localStorage.getItem("token");
    if (!token || !id_achat) return;
    // Avoid refetch if already loaded (even empty array marks attempted)
    if (imageUrls[id_achat]) return;

    const tryEndpoints: string[] = [];
    if (kind === "diamond") {
      tryEndpoints.push(`${API_BASEImage}/list/diamond/${id_achat}`);
      tryEndpoints.push(`${API_BASEImage}/list/${id_achat}`); // fallback
    } else if (kind === "watch") {
      tryEndpoints.push(`${API_BASEImage}/list/${id_achat}`);
    } else if (kind === "gold") {
      // Gold specific endpoint then generic legacy
      tryEndpoints.push(`${API_BASEImage}/list/gold/${id_achat}`);
      tryEndpoints.push(`${API_BASEImage}/list/${id_achat}`);
    } else {
      // unknown type: attempt gold, diamond then generic to maximize chances
      tryEndpoints.push(`${API_BASEImage}/list/gold/${id_achat}`);
      tryEndpoints.push(`${API_BASEImage}/list/diamond/${id_achat}`);
      tryEndpoints.push(`${API_BASEImage}/list/${id_achat}`);
    }

    for (const ep of tryEndpoints) {
      try {
        const res = await axios.get(ep, {
          headers: { Authorization: `Bearer ${token}` },
        });
        let urls: string[] = [];
        if (
          Array.isArray(res.data) &&
          res.data.length > 0 &&
          typeof res.data[0] === "object"
        ) {
          urls = res.data.map((img: any) => img.url || img);
        } else {
          urls = res.data;
        }
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
        setImageUrls((prev) => ({ ...prev, [id_achat]: urls }));
        await Promise.all(urls.map((url) => fetchImageWithAuth(url, token)));
        return;
      } catch (e) {

      }
    }
    setImageUrls((prev) => ({ ...prev, [id_achat]: [] }));
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
  const [data, setData] = useState<InventoryItem[]>([]);

  const [Sm, setSm] = useState<Sm[]>([]);

  const [customers, setCustomers] = useState<Client[]>([]);

  const apiIp = process.env.REACT_APP_API_IP;
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
    data.forEach((row) => {
      const brand = getBrandName(row);
      if (brand) brands.add(brand);
    });
    return Array.from(brands).sort();
  }, [data]);

  // Distinct gold types (based on Fournisseur.TYPE_SUPPLIER) for dropdown
  const distinctGoldTypes = React.useMemo(() => {
    const types = new Set<string>();
    data.forEach((row) => {
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
        const response = await axios.get<InventoryItem[]>(
          "/Inventory/allActive",
          {
            headers: { Authorization: `Bearer ${token}` },
            params: { ps, type_supplier: typeParam },
          }
        );
        setData(response.data);
      } catch (error: any) {
        if (error.response?.status === 401) navigate("/");
      } finally {
        setLoading(false);
      }
    },
    [navigate, ps, typeFilter]
  );

  useEffect(() => {
    fetchData("gold");
    fetchDataINV();
    fetchCustomers();
    fetchSms();
    // Intentionally not listing fetchCustomers/fetchSms/fetchDataINV since they are stable within this module
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add state for image dialog and selected image
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  // const [selectedImage, setSelectedImage] = useState<string | null>(null); // unused
  // New state for dialog image navigation
  const [dialogImageList, setDialogImageList] = useState<string[]>([]);
  const [dialogImageIndex, setDialogImageIndex] = useState(0);

  const handleViewImage = (row: InventoryItem) => {
    // Determine whether row has diamond or watch purchase to choose endpoint
    let dp: any = row.DistributionPurchase;
    let diamond: any;
    let watch: any;
    let idAchat: any;
    if (Array.isArray(dp) && dp.length > 0) {
      diamond = dp[0]?.OriginalAchatDiamond;
      watch = dp[0]?.OriginalAchatWatch;
    } else if (dp && typeof dp === "object") {
      diamond = dp?.OriginalAchatDiamond;
      watch = dp?.OriginalAchatWatch;
    }
    if (diamond?.id_achat) idAchat = diamond.id_achat;
    else if (watch?.id_achat) idAchat = watch.id_achat;
    else idAchat = row.id_fact;
    const key = String(idAchat);
    let urls = imageUrls[key] || [];
    // If diamond type, apply preferred selection logic for default image
    if (diamond?.id_achat) {
      // Filter out group images; pick marketing -> invoice -> newest
      const filteredUrls = urls.filter((u) => !/group/i.test(u));
      if (filteredUrls.length === 0) {
        setDialogImageList(urls);
        setDialogImageIndex(pickPreferredImageIndex(urls));
      } else {
        setDialogImageList(filteredUrls);
        setDialogImageIndex(pickPreferredImageIndex(filteredUrls));
      }
    } else {
      setDialogImageList(urls);
      setDialogImageIndex(pickPreferredImageIndex(urls));
    }
    setImageDialogOpen(true);
  };

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(3);

  // Add search state
  const [search, setSearch] = useState("");

  // Filtered data based on search (matches all fields) and cost range
  const filteredData = data.filter((row) => {
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
    const typeOk =
      typeFilter === "" ||
      row.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes(typeFilter);

    // Brand filter logic
    const brandValue = getBrandName(row).toLowerCase();
    const brandOk =
      brandFilter === "" || brandValue.includes(brandFilter.toLowerCase());

    // General_Comment filter logic
    const generalCommentValue = (row.General_Comment || "").toLowerCase();
    // If 'الكل' is selected, show only items with unite > 1
    let generalCommentOk = false;
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

    if (!searchLower) return typeOk && costOk && brandOk && generalCommentOk && goldOk;
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
      goldOk
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
        const key = String(id_achat);
        if (imageUrls[key] === undefined && !requested.has(key)) {
          fetchImages(id_achat, kind);
          requested.add(key);
        }
      }
      // Gold items: fetch by id_fact using gold endpoint
      const typeSupplier = row.Fournisseur?.TYPE_SUPPLIER?.toLowerCase() || "";
      if (typeSupplier.includes("gold")) {
        const goldKey = String(row.id_fact);
        if (imageUrls[goldKey] === undefined && !requested.has(goldKey)) {
          fetchImages(row.id_fact, "gold");
          requested.add(goldKey);
        }
      }
    });
    datainv.forEach((inv) => {
      if (inv.picint) {
        const key = String(inv.picint);
        if (imageUrls[key] === undefined && !requested.has(key)) {
          fetchImages(inv.picint);
          requested.add(key);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginatedData, datainv, imageUrls]);

  const apiUrlinv = `${apiIp}/invoices`;

  const fetchDataINV = async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/");
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
    } catch (err: any) {
      if (err.response?.status === 401) navigate("/");
      //showNotification('Failed to fetch invoice data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const [editInvoice, setEditInvoice] = useState<Invoice>(initialInvoiceState);
  const handleSave = async (item?: InventoryItem) => {
    if (!item) return;
    setAddToCartLoading((prev: { [id: number]: boolean }) => ({
      ...prev,
      [item.id_fact]: true,
    }));
    const token = localStorage.getItem("token");
    try {
      // Use item if provided, else use editInvoice
      let prix_vente = 0;
      if (item) {
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
              prix_vente = diamond.SellingPrice; // fallback
            else prix_vente = 0;
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
              prix_vente = watch.SellingPrice; // fallback
            else prix_vente = 0;
            editInvoice.picint = watch.id_achat;
          }
        } else if (type.includes("gold")) {
          const gpg = goldPrice?.usdPerGram ?? 0;
          const factor = parsePurityFactorFromType(item.Fournisseur?.TYPE_SUPPLIER) ?? 1;
          const basePerGramUSD = gpg * factor;
          const margin = (item.Fournisseur?.Price_G_Gold_Sales || 0) / 100;
          prix_vente = (basePerGramUSD * (1 + margin)) * (usdToLyd + 2) * item.qty;
          editInvoice.picint = item.id_fact;
        } else {
          prix_vente = item.Selling_Price_Currency || 0;
        }
      }

      const invoiceData = item
        ? {
          ...editInvoice,
          id_art: item?.id_fact,
          qty: item.qty,
          prix_vente,
          prix_vente_remise: prix_vente,
          total_remise: prix_vente,
          client: 0,
          Design_art: item.Design_art,
          usr: Cuser,
          ps: ps,
          // Add more fields as needed
        }
        : editInvoice;
      await axios
        .post(`${apiUrlinv}/Add`, invoiceData, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .catch((error) => {

        });
      //showNotification('Invoice added successfully', 'success');

      fetchDataINV();
      fetchData();
    } catch (error: any) {
      // Use alert as fallback for error notification
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
        const lyd = usd * (usdToLyd + 2);
        list.push({ type: t, factor: f, usdPerGram: usd, lydPerGram: lyd });
      }
    }
    list.sort((a, b) => b.factor - a.factor);
    return list;
  }, [distinctGoldTypes, goldPrice, usdToLyd]);

  // Common gold purities per-gram (fixed set: 18K, 21K, 24K)
  const commonPurityPrices = React.useMemo(() => {
    const gpg = goldPrice?.usdPerGram;
    if (!gpg || !Number.isFinite(gpg)) return [] as Array<{ k: number; usdPerGram: number; lydPerGram: number }>;
    const karats = [18, 21, 24];
    return karats.map((k) => {
      const f = k / 24;
      const usd = gpg * f;
      const lyd = usd * (usdToLyd + 2);
      return { k, usdPerGram: usd, lydPerGram: lyd };
    });
  }, [goldPrice, usdToLyd]);

  useEffect(() => {
    // Fetch live gold spot (USD/oz and USD/g) via backend proxy and public fallbacks
    const fetchGoldSpot = async () => {
      try {
        let success = false;
        let lastErr: any = null;
        const results: Array<{ usdPerOz: number; usdPerGram: number; source: string; updatedAt: Date }> = [];
        const base = (process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_IP || "http://localhost").replace(/\/+$/, "");

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
    fetchGoldSpot();

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

  // Add a stub for handleEditCartItem to avoid errors
  // Handler for edit button
  const handleEditCartItem2 = (item: Invoice) => {
    setEditDialogItem(item);
    setEditDialogRemise(item.total_remise ?? 0);
    setEditDialogOpen(true);
  };

  const handleOpenTotalsDialog = () => {
    // Calculate totals from datainv
    const goldItems = datainv.filter((i) =>
      i.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes("gold")
    );
    const diamondItems = datainv.filter((i) =>
      i.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes(
        "diamond"
      )
    );
    const watchItems = datainv.filter((i) =>
      i.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes("watch")
    );

    // Calculate totals for each type
    let goldTotal = 0,
      diamondTotal = 0,
      watchTotal = 0;
    let remise,
      remise_per,
      amount_currency = 0,
      amount_lyd = 0,
      amount_EUR = 0,
      amount_currency_LYD = 0,
      amount_EUR_LYD = 0;

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

    const total_remise_final_lyd = datainv.reduce(
      (sum, i) =>
        typeof i.total_remise_final_lyd === "number"
          ? i.total_remise_final_lyd
          : 0,
      0
    );

    // Sum up all relevant fields for dialog
    amount_currency = datainv.reduce(
      (sum, i) =>
        typeof i.amount_currency === "number" ? i.amount_currency : 0,
      0
    );
    amount_lyd = datainv.reduce(
      (sum, i) => (typeof i.amount_lyd === "number" ? i.amount_lyd : 0),
      0
    );
    amount_EUR = datainv.reduce(
      (sum, i) => (typeof i.amount_EUR === "number" ? i.amount_EUR : 0),
      0
    );
    amount_currency_LYD = datainv.reduce(
      (sum, i) =>
        typeof i.amount_currency_LYD === "number" ? i.amount_currency_LYD : 0,
      0
    );
    amount_EUR_LYD = datainv.reduce(
      (sum, i) => (typeof i.amount_EUR_LYD === "number" ? i.amount_EUR_LYD : 0),
      0
    );
    remise = datainv.reduce(
      (sum, i) => (typeof i.remise === "number" ? i.remise : 0),
      0
    );

    remise_per = datainv.reduce(
      (sum, i) => (typeof i.remise_per === "number" ? i.remise_per : 0),
      0
    );

    setTotalsDialog({
      open: true,
      total_remise_final: goldTotal + diamondTotal + watchTotal,
      total_remise_final_lyd: total_remise_final_lyd,
      amount_currency,
      amount_lyd,
      amount_EUR,
      amount_currency_LYD,
      amount_EUR_LYD,
      remise,
      remise_per,
    });
  };

  const handleTotalsDialogChange = (field: string, value: number) => {
    setTotalsDialog((prev) => ({ ...prev, [field]: value }));
  };

  const handleTotalsDialogClose = () => {
    setTotalsDialog((prev) => ({ ...prev, open: false }));
  };

  const handleAddNew = async () => {
    const token = localStorage.getItem("token");

    if (!datainv[0].Client) {
      setSnackbar({
        open: true,
        message: "Please select a client before creating a new invoice",
        severity: "error",
      });
      return;
    }
    if (!datainv[0].total_remise_final || datainv[0].total_remise_final === 0) {
      setSnackbar({
        open: true,
        message:
          "Please add Totals to the invoice before creating a new invoice",
        severity: "error",
      });
      return;
    }

    try {
      const { status } = await axios.get(`${apiUrlinv}/NewNF`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { ps, usr: Cuser },
      });
      if (status !== 200) throw new Error("Failed to fetch new invoice number");

      // Update num_fact for all items in datainv to newNumFact
      setDatainv((prev) =>
        prev.map((item) => ({
          ...item,
          num_fact: 0
        }))
      );

      const latestInvoice = datainv[datainv.length - 1];

      if (latestInvoice) {
        latestInvoice.num_fact = 0;
      }

      setPrintDialog({
        open: true,
        invoice: latestInvoice || null,
      });

      setEditInvoice(initialInvoiceState);
    } catch (error) {


    }
  };

  const [shouldOpenPrintDialog, setShouldOpenPrintDialog] = useState(false); // Add flag state

  const handleTotalsDialogUpdate = async () => {
    // First, get a new invoice number

    try {
      setIsSaving(true);
      try {
        const token = localStorage.getItem("token");

        // Determine invoice destination flags

        await axios.put(
          `${apiIp}/invoices/UpdateTotals/0`,
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
            sm: editInvoice.SourceMark,
            is_chira: editInvoice.is_chira,
            IS_WHOLE_SALE: editInvoice.IS_WHOLE_SALE,
            COMMENT: editInvoice.COMMENT ?? "",
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
            const rowsToUpdate = datainv.filter(inv => inv.num_fact === 0 && String(inv.ps) === String(ps) && String(inv.usr) === String(Cuser));
            for (const inv of rowsToUpdate) {
              try {
                await axios.put(
                  `${apiIp}/invoices/Update/${inv.id_fact}`,
                  { COMMENT: commentVal },
                  { headers: { Authorization: `Bearer ${token2}` } }
                );
              } catch { /* continue on single-row failure */ }
            }
          }
        } catch { /* ignore comment bulk update errors */ }
        //   setSnackbar({ open: true, message: 'Invoice totals updated successfully', severity: 'success' });
        setTotalsDialog((prev) => ({ ...prev, open: false }));
        await fetchDataINV();
      } catch (error) {


        setSnackbar({
          open: true,
          message: "Failed to update invoice totals",
          severity: "error",
        });
      } finally {
        setIsSaving(false);
      }

      // setShouldOpenPrintDialog(true); // Set flag to open print dialog after data is up-to-date and dialog is closed
    } catch (error) {


    }
  };

  useEffect(() => {
    if (shouldOpenPrintDialog) {
      // Find the latest invoice (assuming it's the last one in datainv)
      const latestInvoice = datainv.find(
        (inv) =>
          inv.num_fact === 0 &&
          inv.ps === Number(ps) &&
          inv.usr === Number(Cuser)
      );
      setPrintDialog({
        open: true,
        invoice: latestInvoice || null,
      });
      setShouldOpenPrintDialog(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldOpenPrintDialog, totalsDialog.open, datainv]);

  // Add state for edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDialogItem, setEditDialogItem] = useState<Invoice | null>(null);
  const [editDialogRemise, setEditDialogRemise] = useState<number>(0);

  // const [editDialogIS_Gift, setEditDialogIS_Gift] = useState<boolean>(false);
  // Handler for saving the edited remise
  const handleEditDialogSave = async () => {
    if (!editDialogItem) return;
    try {
      const token = localStorage.getItem("token");
      // Await the API call before updating local state
      await axios.put(
        `${apiIp}/invoices/UpdateTotal/${editDialogItem.id_fact}`,
        {
          total_remise: editDialogRemise,
          prix_vente_remise: editDialogRemise,
          IS_GIFT: editDialogItem.IS_GIFT, // <-- Add this line
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      // Update local state after successful API call
      setDatainv((prev) => {
        const updated = prev.map((inv) =>
          inv.id_art === editDialogItem.id_art
            ? { ...inv, total_remise: editDialogRemise }
            : inv
        );
        // Recalculate totals after update
        const Total = updated.reduce(
          (sum, i) =>
            typeof i.total_remise_final === "number" ? i.total_remise_final : 0,
          0
        );
        const Totallyd = updated.reduce(
          (sum, i) =>
            typeof i.total_remise_final === "number" ? i.total_remise_final : 0,
          0
        );

        const amount_EUR = updated.reduce(
          (sum, i) => (typeof i.amount_EUR === "number" ? i.amount_EUR : 0),
          0
        );
        const amount_currency_LYD = updated.reduce(
          (sum, i) =>
            typeof i.amount_currency_LYD === "number"
              ? i.amount_currency_LYD
              : 0,
          0
        );
        const amount_EUR_LYD = updated.reduce(
          (sum, i) =>
            typeof i.amount_EUR_LYD === "number" ? i.amount_EUR_LYD : 0,
          0
        );
        const amount_currency = updated.reduce(
          (sum, i) =>
            typeof i.amount_currency === "number" ? i.amount_currency : 0,
          0
        );
        const amount_lyd = updated.reduce(
          (sum, i) => (typeof i.amount_lyd === "number" ? i.amount_lyd : 0),
          0
        );
        setTotalsDialog((prev) => ({
          ...prev,
          total_remise_final: Total,
          total_remise_final_lyd: Totallyd,
          amount_currency,
          amount_lyd,
          amount_EUR,
          amount_currency_LYD,
          amount_EUR_LYD,
        }));
        return updated;
      });
      setSnackbar({
        open: true,
        message: "Discount updated successfully",
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Failed to update disscount",
        severity: "error",
      });
    } finally {
      setEditDialogOpen(false);
    }
  };

  const [hiddenIds] = useState<number[]>([]); // Track hidden items

  // Calculate final total after discount for each currency type
  function getFinalTotal(items: any[], currencyType: string) {
    const filtered = items.filter((i: any) => {
      const achat = i.ACHATs?.[0];
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
        total = latest.total_remise_final || 0;
        remise = latest.remise || 0;
        remise_per = latest.remise_per || 0;
      } else {
        total = filtered.reduce(
          (sum: number, i: any) =>
            sum +
            (typeof i.prix_vente_remise === "number" ? i.prix_vente_remise : 0),
          0
        );
      }
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
        onClose={() => setImageDialogOpen(false)}
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
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
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
                  <img
                    src={(() => {
                      let url = dialogImageList[dialogImageIndex];
                      if (!url) return "";
                      const token = localStorage.getItem("token");
                      if (token && !url.includes("token=")) {
                        url +=
                          (url.includes("?") ? "&" : "?") +
                          "token=" +
                          encodeURIComponent(token);
                      }
                      return url;
                    })()}
                    alt={`Product ${dialogImageIndex + 1}`}
                    style={{
                      maxWidth: "80%",
                      maxHeight: "80vh",
                      objectFit: "contain",
                      borderRadius: 8,
                      border: "1px solid #ccc",
                      background: "#f9f9f9",
                    }}
                  />
                  <Button
                    onClick={() =>
                      setDialogImageIndex(
                        (idx) => (idx + 1) % dialogImageList.length
                      )
                    }
                    disabled={dialogImageList.length <= 1}
                  >
                    {">"}
                  </Button>
                </Box>
                <Typography variant="caption" sx={{ mt: 1 }}>
                  {dialogImageIndex + 1} / {dialogImageList.length}
                </Typography>
              </>
            ) : (
              <Typography>No image available</Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
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





            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Filter by Type
            </Typography>
          </Box>
          <Box
            sx={{ display: "flex", flexDirection: "column", gap: 1.2, mb: 1 }}
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
                Filter by Group
              </Typography>

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
          <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
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
              gridTemplateColumns: "1fr",
            }}
          >
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
                  .map((row) => (
                    <Box
                      key={row.id_fact}
                      sx={{
                        borderRadius: 2,
                        pr: 2,
                        display: "flex",
                        flexDirection: "row",
                        minHeight: 200,
                        border: "1px solid #e0e0e0",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <Box
                        sx={{
                          width: 300,
                          height: 220,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 2,
                          overflow: "hidden",
                          position: "relative",
                          mr: 1,
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
                          if (typeSupplierLower.includes("gold")) {
                            const goldKeyStr = String(row.id_fact);
                            const urls = imageUrls[goldKeyStr] || [];
                            // Pick preferred image (marketing -> invoice -> newest)
                            const idx = pickPreferredImageIndex(urls);
                            const token = localStorage.getItem("token");
                            return urls.length > 0 ? (
                              <Box
                                component="img"
                                src={(() => {
                                  let url = urls[idx];
                                  if (!url) return "";
                                  if (token && !url.includes("token=")) {
                                    url += (url.includes("?") ? "&" : "?") +
                                      "token=" + encodeURIComponent(token);
                                  }
                                  return url;
                                })()}
                                alt={`Gold Image ${idx + 1}`}
                                loading="lazy"
                                sx={{
                                  maxHeight: 180,
                                  height: 180,
                                  maxWidth: 180,
                                  borderRadius: 8,
                                  border: "1px solid #ccc",
                                  width: "100%",
                                  objectFit: "contain",
                                  background: "inherit",
                                  cursor: "pointer",
                                }}
                                onClick={() => {
                                  setDialogImageList(urls);
                                  setDialogImageIndex(idx);
                                  setImageDialogOpen(true);
                                }}
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = "/default-image.png";
                                }}
                                title={urls[idx] || "No image URL"}
                              />
                            ) : (
                              <Box
                                component="img"
                                src="/default-image.png"
                                alt="No Image"
                                sx={{
                                  maxHeight: 120,
                                  maxWidth: 120,
                                  opacity: 0.5,
                                  mb: 1,
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
                            const imageKeyStr = String(imageKey);
                            const urls = imageUrls[imageKeyStr] || [];
                            const idx = pickPreferredImageIndex(urls);
                            return urls.length > 0 ? (
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
                                  maxHeight: 180,
                                  height: 180,
                                  maxWidth: 180,
                                  borderRadius: 8,
                                  border: "1px solid #ccc",
                                  width: "100%",
                                  objectFit: "contain",
                                  background: "inherit",
                                  cursor: "pointer",
                                }}
                                onClick={() => {
                                  setDialogImageList([urls[idx]]);
                                  setDialogImageIndex(0);
                                  setImageDialogOpen(true);
                                }}
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = "/default-image.png";
                                }}
                                title={urls[idx] || "No image URL"}
                              />
                            ) : (
                              <Box
                                component="img"
                                src="/default-image.png"
                                alt="No Image"
                                sx={{
                                  maxHeight: 120,
                                  maxWidth: 120,
                                  opacity: 0.5,
                                  mb: 1,
                                }}
                              />
                            );
                          }
                          // Show preferred image for watch (marketing -> invoice -> newest)
                          if (watch) {
                            const imageKey = watch.id_achat;
                            const imageKeyStr = String(imageKey);
                            const urls = imageUrls[imageKeyStr] || [];
                            const idx = pickPreferredImageIndex(urls);

                            return urls.length > 0 ? (
                              (() => {
                                const original = urls[idx];
                                const fileName = (original || '').split('?')[0].split('/').pop() || '';
                                const apiBaseRaw = (process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_IP || 'http://localhost').replace(/\/+$/, '');
                                let origin = '';
                                try { origin = new URL(apiBaseRaw).origin; } catch { origin = window.location.origin; }
                                const originHttps = origin.replace(/^http:\/\//i, 'https://');
                                try { if (origin !== originHttps) console.debug('[IMG][origin] force https', { in: origin, out: originHttps }); } catch { }
                                const primaryRaw = normalizeWatchUrl(original, watch.id_achat);
                                const primary = primaryRaw?.startsWith('/') ? originHttps + primaryRaw : ensureHttps(primaryRaw);
                                const generic = `${originHttps}/images/${watch.id_achat}/${fileName}`;
                                const staticPath = `${originHttps}/uploads/WatchPic/${watch.id_achat}/${fileName}`; // use absolute like WOPurchase
                                const chain = [primary, generic, staticPath];
                                const tokenParam = token ? `token=${encodeURIComponent(token)}` : '';
                                const withToken = (u: string) => {
                                  if (!u) return u;
                                  return tokenParam ? u + (u.includes('?') ? '&' : '?') + tokenParam : u;
                                };
                                return (
                                  <Box
                                    component="img"
                                    src={withToken(chain[0])}
                                    data-fallback-index={0}
                                    data-fallback-chain={chain.join('|')}
                                    alt={`Image ${idx + 1}`}
                                    loading="lazy"
                                    sx={{
                                      maxHeight: 180,
                                      height: 180,
                                      maxWidth: 180,
                                      borderRadius: 8,
                                      border: "1px solid #ccc",
                                      width: "100%",
                                      objectFit: "contain",
                                      background: "inherit",
                                      cursor: "pointer",
                                    }}

                                    onClick={() => {
                                      setDialogImageList([withToken(chain[0])]);
                                      setDialogImageIndex(0);
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
                                );
                              })()
                            ) : (
                              <Box
                                component="img"
                                src="/default-image.png"
                                alt="No Image"
                                sx={{
                                  maxHeight: 120,
                                  maxWidth: 120,
                                  opacity: 0.5,
                                  mb: 1,
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
                          gap: 1,
                          justifyContent: "center",
                          alignItems: "flex-start",
                          textAlign: "left",
                        }}
                      >
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <Typography
                            component="span"
                            sx={{
                              color: "warning.main",
                              fontWeight: "bold",
                              fontSize: 16,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            {row.Fournisseur?.TYPE_SUPPLIER}
                          </Typography>
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
                                  minWidth: 0,
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
                                {row.General_Comment || "بدون تعليق"}
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
                            whiteSpace: "pre-line",
                            fontSize: 13,
                            color: "inherit",
                            "& b": { color: "text.secondary", fontWeight: 700 },
                          }}
                        >
                          <b>ID:</b> {row.id_fact} | {row.Design_art} |{" "}
                          <b>Brand:</b> {row.Fournisseur?.client_name}
                          {row.Fournisseur?.TYPE_SUPPLIER &&
                            row.Fournisseur.TYPE_SUPPLIER.toLowerCase().includes(
                              "gold"
                            ) && (
                              <>
                                <b>Stone:</b> {row.Color_Rush ?? "-"}|{" "}
                                <b>Color:</b> {row.Color_Gold ?? "-"}
                                <div
                                  style={{
                                    color: "inherit",
                                    fontWeight: 900,
                                    marginTop: 2,
                                    fontSize: 18,
                                    textAlign: "left",
                                    width: "100%",
                                  }}
                                >
                                  {row.qty}

                                  <sup style={{ fontSize: 12 }}> g</sup>
                                  {" | "}
                                  {(() => {
                                    const gpg = goldPrice?.usdPerGram ?? 0;
                                    const factor = parsePurityFactorFromType(row.Fournisseur?.TYPE_SUPPLIER) ?? 1;
                                    const basePerGramUSD = gpg * factor;
                                    const margin = (row.Fournisseur?.Price_G_Gold_Sales || 0) / 100;
                                    const val = (basePerGramUSD * (1 + margin)) * (usdToLyd + 2) * row.qty;
                                    return Number(val || 0).toLocaleString("en-LY", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    });
                                  })()}
                                  <sup style={{ fontSize: 12 }}>LYD</sup>
                                </div>{" "}
                              </>
                            )}
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
                                {diamond.Design_art && (
                                  <>
                                    {` | `}
                                    <b>Product Name:</b> {diamond.Design_art}
                                  </>
                                )}
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
                                      style={{ color: "inherit" }}
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
                                {/* Show diamond sale price: prefer sale_price, else SellingPrice (both may be 0) */}
                                {(() => {
                                  let show = false;
                                  let val: any = null;
                                  if ("sale_price" in diamond) {
                                    show = true;
                                    val = diamond.sale_price;
                                  } else if ("SellingPrice" in diamond) {
                                    show = true;
                                    val = diamond.SellingPrice;
                                  }
                                  if (!show) return null;
                                  return (
                                    <div
                                      style={{
                                        color: "inherit",
                                        fontWeight: 900,
                                        marginTop: 2,
                                        fontSize: 18,
                                      }}
                                    >
                                      {val !== undefined && val !== null
                                        ? Number(val).toLocaleString("en-US", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })
                                        : "-"}
                                      <sup
                                        style={{ fontSize: 12, marginLeft: 2 }}
                                      >
                                        USD
                                      </sup>
                                    </div>
                                  );
                                })()}
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
                                {/* Watch sale price: prefer sale_price, else SellingPrice */}
                                {(() => {
                                  let show = false;
                                  let val: any = null;
                                  if ("sale_price" in watch) {
                                    show = true;
                                    val = watch.sale_price;
                                  } else if ("SellingPrice" in watch) {
                                    show = true;
                                    val = watch.SellingPrice;
                                  }
                                  if (!show) return null;
                                  return (
                                    <div
                                      style={{
                                        color: "inherit",
                                        fontWeight: 900,
                                        marginTop: 2,
                                        fontSize: 18,
                                      }}
                                    >
                                      {val !== undefined && val !== null
                                        ? Number(val).toLocaleString("en-US", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })
                                        : "-"}
                                      <sup
                                        style={{ fontSize: 12, marginLeft: 2 }}
                                      >
                                        USD
                                      </sup>
                                    </div>
                                  );
                                })()}
                              </>
                            );
                          })()}
                        </Typography>
                        <Button
                          variant="contained"
                          color="warning"
                          size="small"
                          sx={{
                            mt: 2,
                            fontWeight: 700,
                            borderRadius: 2,
                            alignSelf: "flex-end",
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
                  ))}
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
                  })}
                >
                  <Typography
                    variant="body2"
                    sx={(theme) => ({
                      fontWeight: 600,
                      color: theme.palette.text.primary,
                    })}
                  >
                    Total rows: {filteredData.length}
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
                        color: theme.palette.text.primary,
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
                          color: "inherit",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                          outline: "none",
                          transition: "border 0.2s",
                        }}
                      >
                        <option value={6}>10</option>
                        <option value={10}>20</option>
                        <option value={20}>30</option>
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
                          color: theme.palette.text.primary,
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
                          color: theme.palette.text.primary,
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
                          color: theme.palette.text.primary,
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
                          color: theme.palette.text.primary,
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
                          color: theme.palette.text.primary,
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
            <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
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
                  🛒
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

                const typeSupplier =
                  achat?.Fournisseur?.TYPE_SUPPLIER || "Unknown Type";
                return (
                  <Box
                    key={item.id_art}
                    sx={{
                      mb: 2,
                      p: 1,
                      border: "1px solid #e0e0e0",
                      borderRadius: 2,
                      display: "flex",
                      alignItems: "center",
                      position: "relative",
                      ...(item.IS_GIFT && {
                        bgcolor: "rgba(255, 68, 0, 0.38)",
                        color: "warning.main",
                        border: "2px solid",
                        borderColor: "warning.main",
                      }),
                    }}
                  >
                    {/* Show image if available */}
                    <Box
                      sx={{
                        width: 60,
                        height: 60,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 1,
                        overflow: "hidden",
                        mr: 1,
                        bgcolor: "inherit",
                        border: "1px solid #eee",
                      }}
                    >
                      {(() => {
                        // Show preferred image from imageUrls if available, else fallback to pic

                        const imageKey = item.picint;
                        const imageKeyStr = String(imageKey);

                        const urls = imageUrls?.[imageKeyStr] || [];
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
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = '/default-image.png';
                                }}
                              />
                            );
                          } else {
                            const idx = pickPreferredImageIndex(urls);
                            const original = urls[idx];
                            const fileName = (original || '').split('?')[0].split('/').pop() || '';
                            const apiBaseRaw = (process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_IP || 'http://localhost').replace(/\/+$/, '');
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
                      })()}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">ID: {item.id_art}</Typography>
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
                            <span
                              style={{ color: "orangered", fontWeight: "bold" }}
                            >
                              &#127873; Is Gift
                            </span>
                          ) : (
                            "No"
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
                        {item.total_remise
                          ? typeSupplier.toLowerCase().includes("gold")
                            ? `${item.total_remise.toLocaleString("en-LY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LYD`
                            : `${item.total_remise.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                          : "-"}
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
                      <Button
                        onClick={() => {
                          setDeleteTargetId(item.id_fact);
                          setDeleteConfirmOpen(true);
                        }}
                        size="small"
                        sx={{ minWidth: 0, p: 0.5 }}
                        color="error"
                      >
                        <span role="img" aria-label="delete">
                          🗑️
                        </span>
                      </Button>
                      <Button
                        size="small"
                        sx={{ minWidth: 0, p: 0.5 }}
                        color="error"
                        onClick={() => handleEditCartItem2(item)}
                      >
                        <span role="img" aria-label="edit">
                          ✏️
                        </span>
                      </Button>
                    </Box>
                  </Box>
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
                  Total Amounts
                </Typography>
              </Box>
              <Box sx={{ mb: 1, p: 1, borderTop: "1px solid #eee" }}>
                {/* Gold (LYD) */}
                {(() => {
                  const goldTotal = getFinalTotal(datainv, "gold");
                  return goldTotal > 0 ? (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ color: "goldenrod", fontWeight: 700 }}
                      >
                        Gold:{" "}
                        {goldTotal.toLocaleString("en-LY", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        LYD
                      </Typography>
                      <Button
                        variant="text"
                        color="primary"
                        size="small"
                        startIcon={
                          <span role="img" aria-label="edit">
                            ✏️
                          </span>
                        }
                        sx={{ minWidth: 32, p: 0.5, ml: 1, borderRadius: 1 }}
                        onClick={handleOpenTotalsDialog}
                        disabled={datainv.length === 0}
                      ></Button>
                    </Box>
                  ) : null;
                })()}

                {/* Diamond (USD) */}
                {(() => {
                  const diamondTotal = getFinalTotal(datainv, "diamond");
                  return diamondTotal > 0 ? (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ color: "deepskyblue", fontWeight: 700 }}
                      >
                        Diamond:{" "}
                        {diamondTotal.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        USD
                      </Typography>
                      <Button
                        variant="text"
                        color="primary"
                        size="small"
                        startIcon={
                          <span role="img" aria-label="edit">
                            ✏️
                          </span>
                        }
                        sx={{ minWidth: 32, p: 0.5, ml: 1, borderRadius: 1 }}
                        onClick={handleOpenTotalsDialog}
                        disabled={datainv.length === 0}
                      ></Button>
                    </Box>
                  ) : null;
                })()}
                {/* Watch (USD) */}
                {(() => {
                  const watchTotal = getFinalTotal(datainv, "watch");
                  return watchTotal > 0 ? (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ color: "orange", fontWeight: 700 }}
                      >
                        Watch:{" "}
                        {watchTotal.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        USD
                      </Typography>
                    </Box>
                  ) : null;
                })()}
              </Box>
              <Button
                variant="outlined"
                color="primary"
                size="small"
                sx={{ mt: 1, fontWeight: 700, borderRadius: 2, width: "100%" }}
                onClick={handleOpenTotalsDialog}
                disabled={datainv.length === 0}
              >
                Complete Invoice Details
              </Button>
              <Button
                variant="outlined"
                color="success"
                size="small"
                sx={{ mt: 1, fontWeight: 700, borderRadius: 2, width: "100%" }}
                onClick={() => {
                  // Find the latest invoice (assuming it's the last one in datainv)
                  handleAddNew();
                }}
                disabled={datainv.length === 0}
              >
                Print Invoice
              </Button>
              <InvoiceTotalsDialog
                Type_Supplier={
                  datainv[0]?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || ""
                }
                open={totalsDialog.open}
                // This copy component does not manage live rates; omit rate props
                totals={totalsDialog}
                isSaving={isSaving}
                onChange={handleTotalsDialogChange}
                onClose={handleTotalsDialogClose}
                onUpdate={handleTotalsDialogUpdate}
                Sm={Sm}
                customers={customers}
                editInvoice={editInvoice}
                setEditInvoice={setEditInvoice}
                errors={{ client: "" }} // You may want to handle errors statefully
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
                  totalAmountLYD: totalsDialog.amount_lyd,
                  totalAmountUSD: totalsDialog.amount_currency,
                  totalAmountEur: totalsDialog.amount_EUR,
                  totalWeight: 0, // Add your calculation if needed
                  itemCount: datainv.length,
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
                  fetchDataINV(); // Refresh the cart after closing invoice
                }}
                showCloseInvoiceActions={false}
                showCloseInvoice={false}
              />
            </>
          )}
        </Box>
      </Box>
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
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Edit Discount</DialogTitle>
        <DialogContent>
          <TextField
            label="Discount Amount"
            type="number"
            value={editDialogRemise}
            onChange={(e) => setEditDialogRemise(Number(e.target.value))}
            fullWidth
            margin="normal"
            size="small"
          />
          <Box sx={{ display: "flex", alignItems: "center", mt: 2 }}>
            <input
              type="checkbox"
              checked={editDialogItem?.IS_GIFT}
              onChange={(e) =>
                setEditDialogItem((item) =>
                  item ? { ...item, IS_GIFT: e.target.checked } : item
                )
              }
              id="is-gift-checkbox"
            />
            <label htmlFor="is-gift-checkbox" style={{ marginLeft: 8 }}>
              Is Gift
            </label>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await handleEditDialogSave();
              await fetchDataINV(); // Refresh cart list after save
              setEditDialogOpen(false);
            }}
            color="primary"
            variant="contained"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DNew_I;
