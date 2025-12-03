import React, { useState, useEffect, useCallback, useRef } from "react";
import GroupIcon from "@mui/icons-material/Group";
import axios from "../../../api";
import IconButton from "@mui/material/IconButton";
import { useNavigate } from "react-router-dom";
import { Box, Button, Typography, TextField, MenuItem } from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import ShoppingCartOutlined from "@mui/icons-material/ShoppingCartOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import EditOutlined from "@mui/icons-material/EditOutlined";
import Collapse from "@mui/material/Collapse";
import ExpandMore from "@mui/icons-material/ExpandMore";
import VerifiedUserOutlined from "@mui/icons-material/VerifiedUserOutlined";
import PaletteOutlined from "@mui/icons-material/PaletteOutlined";
import ContentCutOutlined from "@mui/icons-material/ContentCutOutlined";
import Straighten from "@mui/icons-material/Straighten";
import AssignmentTurnedInOutlined from "@mui/icons-material/AssignmentTurnedInOutlined";
import QrCode2Outlined from "@mui/icons-material/QrCode2Outlined";
import WaterDropOutlined from "@mui/icons-material/WaterDropOutlined";
import WatchOutlined from "@mui/icons-material/WatchOutlined";
import LinkOutlined from "@mui/icons-material/LinkOutlined";
import BuildOutlined from "@mui/icons-material/BuildOutlined";
import PrecisionManufacturingOutlined from "@mui/icons-material/PrecisionManufacturingOutlined";
import AllOutOutlined from "@mui/icons-material/AllOutOutlined";
import DiamondOutlined from "@mui/icons-material/DiamondOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import WorkspacePremiumOutlined from "@mui/icons-material/WorkspacePremiumOutlined";
import Add from "@mui/icons-material/Add";
import Remove from "@mui/icons-material/Remove";

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

// Lightweight TradingView single-quote embed for XAUUSD (gold per ounce)
const SingleQuoteWidget: React.FC = () => {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    // Prevent duplicate script injection
    if (container.current.childElementCount > 0) return;
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js";
    s.async = true;
    s.innerHTML = JSON.stringify({
      symbol: "OANDA:XAUUSD",
      width: 240,
      isTransparent: true,
      locale: "en",
      colorTheme: "light",
      largeChartUrl: ""
    });
    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container__widget";
    const outer = document.createElement("div");
    outer.className = "tradingview-widget-container";
    outer.appendChild(wrapper);
    container.current.appendChild(outer);
    container.current.appendChild(s);
    return () => {
      if (container.current) container.current.innerHTML = "";
    };
  }, []);
  return <Box ref={container} sx={{ minHeight: 36 }} />;
};

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

// Helper to fetch image as blob with auth
const fetchImageWithAuth = async (url: string, token: string) => {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
};

// Default type, can be changed based on your requirements;
const GNew_I = () => {
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

  const fetchImages = async (id_achat: number, kind?: "diamond" | "watch") => {
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
    } else {
      // unknown type: attempt diamond then generic
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
          urls = urls
            .filter((u) => /DiamondPic/i.test(u))
            .sort((a, b) => {
              const fa = a.split("/").pop() || "";
              const fb = b.split("/").pop() || "";
              return extractDateFromFilename(fa) - extractDateFromFilename(fb);
            });
        }
        setImageUrls((prev) => ({ ...prev, [id_achat]: urls }));
        await Promise.all(urls.map((url) => fetchImageWithAuth(url, token)));
        return;
      } catch (e) {
        // continue to next endpoint
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
    } catch (error) {}
  };

  const fetchSms = async () => {
    const apiUrlsm = "/sm";
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get<Sm[]>(`${apiUrlsm}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSm(res.data);
    } catch (error) {}
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
  const [typeFilter, setTypeFilter] = useState<string>("diamond");
  // Cost range filter state
  const [costMin, setCostMin] = useState<string>("");
  const [costMax, setCostMax] = useState<string>("");
  // Sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  // Brand filter state
  const [brandFilter, setBrandFilter] = useState<string>("");
  // General_Comment filter state
  const [generalCommentFilter, setGeneralCommentFilter] = useState<string>("");
  // Currency and category filters
  const [currencyFilter, setCurrencyFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [goldKaratFilter, setGoldKaratFilter] = useState<"all" | "18" | "21" | "24">("all");
  const [goldKindFilter, setGoldKindFilter] = useState<"all" | "used" | "crashed">("all");
  // Expanded details per card
  const [expandedMap, setExpandedMap] = useState<Record<number, boolean>>({});
  const isAdminRole = React.useMemo(() => {
    try {
      const uRaw = localStorage.getItem("user");
      if (uRaw) {
        if (uRaw.toUpperCase().includes("ROLE_ADMIN")) return true;
        const obj = JSON.parse(uRaw) as any;
        const roleField = (obj?.role ?? obj?.roles ?? obj?.Prvilege ?? obj?.Roles ?? obj?.Action_user) as any;
        const toStr = (v: any) => (Array.isArray(v) ? v.join(" ") : String(v || ""));
        const s = toStr(roleField).toLowerCase();
        return s.includes("admin");
      }
      return false;
    } catch {
      return false;
    }
  }, []);
  const extractKarat = (row: InventoryItem): string => {
    const m = String(row.Design_art || "").match(/\b(24|21|18)\b/);
    return m ? m[1] : "";
  };
  const isUsedGoldRow = (row: InventoryItem): boolean => {
    const txt = [row.Design_art, row.General_Comment, (row as any).COMMENT, (row as any).comment_edit]
      .map((v) => String(v || "").toLowerCase())
      .join(" ");
    return /(used|مستعمل)/i.test(txt);
  };
  const isCrashedGoldRow = (row: InventoryItem): boolean => {
    const txt = [row.Design_art, row.General_Comment, (row as any).COMMENT, (row as any).comment_edit]
      .map((v) => String(v || "").toLowerCase())
      .join(" ");
    return /(crash|crashed|scrap|broken|كسر|كسور)/i.test(txt);
  };

  // Standardized color mapping with variant spellings
  const colorHex = (name: string): string => {
    const raw = String(name || "").toUpperCase();
    const n = raw.replace(/[^A-Z]/g, "");
    // Gem families with broad variant matching
    if (/(SAPH|SAPPH|SAHPH|SHAPPH|ZAFIR|ZAPP|ZAPH|ZAPHH|SAPHIR|SAPPHIRE|SAPHIRE|SAPPHIER)/.test(n)) return "#0F52BA"; // Sapphire
    if (/(ZUM|ZUMR|ZUMM|ZUMO|ZUMOR|ZUMOUR|ZUMAR|ZAMURD)/.test(n)) return "#50C878"; // Emerald / Zumrrod
    if (/AMETH/.test(n)) return "#9966CC"; // Amethyst
    if (/(RUBY|RUBI|RUBBY|ROBY)/.test(n)) return "#E0115F"; // Ruby
    if (/(NAVY)/.test(n)) return "#000080"; // Navy
    if (/(BLUE|BULE)/.test(n)) return "#0000FF"; // Blue
    if (/(GREEN|GRENE)/.test(n)) return "#008000"; // Green
    if (/(WHITE|OFFWHITE)/.test(n)) return "#FFFFFF"; // White
    if (/(BROWN|MAROON|MARRON|WINE)/.test(n)) return "#964B00"; // Brown family
    if (/(GOLDEN|GOLD|GLID)/.test(n)) return "#D4AF37"; // Gold family
    if (/(AMBER|ORANGE|PEACH)/.test(n)) return "#FFBF00"; // Amber/Orange/Peach
    if (/PURPLE/.test(n)) return "#800080"; // Purple
    if (/(PINK|ROSE|MORGANITE)/.test(n)) return "#F7CAC9"; // Pink/Morganite
    if (/(AQUA|AQUAMARINE|AQWA)/.test(n)) return "#7FFFD4"; // Aquamarine
    if (/(BLACK|BLACKE)/.test(n)) return "#000000"; // Black
    if (/(SILVER|GRAY|GREY)/.test(n)) return "#C0C0C0"; // Silver/Gray
    if (/GARNET/.test(n)) return "#8B0000"; // Garnet
    if (/PEARL/.test(n)) return "#F0EDE5"; // Pearl
    if (/(CHOCOLATE|COCO)/.test(n)) return "#7B3F00"; // Chocolate/Coco
    if (/BERYL/.test(n)) return "#E6E6FA"; // Beryl
    if (/TURQUOISE/.test(n)) return "#40E0D0"; // Turquoise
    if (/OPAL/.test(n)) return "#A8C3BC"; // Opal
    if (/ONYX/.test(n)) return "#353839"; // Onyx
    if (/(CHAMPAGNE|CHAMPING)/.test(n)) return "#F7E7CE"; // Champagne
    if (/MERCURY/.test(n)) return "#E5E5E5"; // Mercury
    // Basic fallbacks
    if (/YELLOW/.test(n)) return "#f5d061";
    if (/(ROSE|PINK)/.test(n)) return "#ECC5C0";
    if (/(WHITE|SILVER|OFFWHITE)/.test(n)) return "#C0C0C0";
    return "#eee";
  };
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
      if (watch && typeof watch.brand_name === "string")
        return watch.brand_name;
    } else if (dp && typeof dp === "object") {
      const diamond = dp.OriginalAchatDiamond;
      const watch = dp.OriginalAchatWatch;
      if (diamond && typeof diamond.client_name === "string")
        return diamond.client_name;
      if (diamond && typeof diamond.brand_name === "string")
        return diamond.brand_name;
      if (watch && typeof watch.client_name === "string")
        return watch.client_name;
      if (watch && typeof watch.brand_name === "string")
        return watch.brand_name;
    }
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
    fetchData("diamond");
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
    // If diamond type, apply DInventory logic for default image selection
    if (diamond?.id_achat) {
      // Filter out group images
      const filteredUrls = urls.filter((u) => !/group/i.test(u));
      // Find last image not containing 'PIC' (case-insensitive)
      let defaultIdx = filteredUrls.length - 1;
      for (let i = filteredUrls.length - 1; i >= 0; i--) {
        if (!/PIC/i.test(filteredUrls[i])) {
          defaultIdx = i;
          break;
        }
      }
      // Fallback to first image if none found
      if (filteredUrls.length === 0) {
        setDialogImageList(urls);
        setDialogImageIndex(0);
      } else {
        setDialogImageList(filteredUrls);
        setDialogImageIndex(defaultIdx);
      }
    } else {
      setDialogImageList(urls);
      setDialogImageIndex(0);
    }
    setImageDialogOpen(true);
  };

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(4);

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

    // Currency filter logic (LYD->gold, USD->diamond/watch)
    const supplierType = row.Fournisseur?.TYPE_SUPPLIER?.toLowerCase() || "";
    let currencyOk = true;
    if (currencyFilter === "LYD") {
      currencyOk = supplierType.includes("gold");
    } else if (currencyFilter === "USD") {
      currencyOk = supplierType.includes("diamond") || supplierType.includes("watch");
    }
    // Gold-specific filters
    let goldKaratOk = true;
    let goldKindOk = true;
    if (supplierType.includes("gold")) {
      if (goldKaratFilter !== "all") {
        goldKaratOk = extractKarat(row) === goldKaratFilter;
      }
      if (goldKindFilter !== "all") {
        goldKindOk = goldKindFilter === "used" ? isUsedGoldRow(row) : isCrashedGoldRow(row);
      }
    }

    // Category filter logic using Design_art text
    const catValue = (row.Design_art || "").toLowerCase();
    const categoryOk = categoryFilter === "" || catValue.includes(categoryFilter.toLowerCase());

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

    if (!searchLower) return typeOk && costOk && brandOk && generalCommentOk && currencyOk && categoryOk && goldKaratOk && goldKindOk;
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
      generalCommentOk &&
      currencyOk &&
      categoryOk &&
      goldKaratOk &&
      goldKindOk
    );
  });

  // Sort filteredData by brand name before paginating
  const sortedData = [...filteredData].sort((a, b) => {
    const brandA = getBrandName(a).toLowerCase();
    const brandB = getBrandName(b).toLowerCase();
    if (brandA < brandB) return -1;
    if (brandA > brandB) return 1;
    return 0;
  });
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
          prix_vente =
            (goldPrice / 31.1035 +
              (goldPrice / 31.1035) *
                ((item.Fournisseur?.Price_G_Gold_Sales || 0) / 100)) *
            (usdToLyd + 2) *
            item.qty;
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
          console.error("Error saving invoice:", error);
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

  const [goldPrice, setGoldPrice] = useState<number | 0>(0);
  const [usdToLyd, setUsdToLyd] = useState<number | 0>(0);
  const [cogsOpen, setCogsOpen] = useState(false);
  const [cogsRow, setCogsRow] = useState<InventoryItem | null>(null);
  const [cogs, setCogs] = useState({
    usdRate: 0,
    making: 0,
    shipping: 0,
    travel: 0,
    lossPercent: 0,
    profitPercent: 0,
    weight: 0,
  });
  const perGram24USD = React.useMemo(() => (Number(goldPrice) || 0) / 31.1035, [goldPrice]);
  const perGram21USD = React.useMemo(() => perGram24USD * (21 / 24), [perGram24USD]);
  const perGram18USD = React.useMemo(() => perGram24USD * (18 / 24), [perGram24USD]);

  useEffect(() => {
    // Fetch gold price from a free API (e.g., metals-api.com or goldapi.io)
    // Example using goldapi.io (replace with your API key if needed)
    const fetchGoldPrice = async () => {
      try {
        const res = await axios.get("https://api.metalpriceapi.com/v1/latest", {
          params: {
            apikey: "e3306dd8cb67cc2cdfcd14207ccbf305",
            base: "USD",
            symbols: "XAU",
          },
        });
        setGoldPrice(res.data.rates.XAU);
      } catch (err: any) {
        //setGoldError('Failed to fetch gold price');
        setGoldPrice(0);
      }
    };
    fetchGoldPrice();

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

  // Override usdToLyd from localStorage (usd_lyd_rates_v1) and keep in sync
  useEffect(() => {
    const readLatest = () => {
      try {
        const raw = localStorage.getItem("usd_lyd_rates_v1");
        if (!raw) return;
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) {
          const sorted = [...arr].sort((a: any, b: any) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
          const latest = sorted[sorted.length - 1];
          const rate = Number(latest?.rate);
          if (!Number.isNaN(rate) && rate > 0) setUsdToLyd(rate);
        }
      } catch {}
    };
    readLatest();
    const onStorage = (e: StorageEvent) => {
      if (e && e.key === "usd_lyd_rates_v1") readLatest();
    };
    const w: any = (typeof globalThis !== "undefined" && (globalThis as any).window) ? (globalThis as any).window : undefined;
    if (w && typeof w.addEventListener === "function") {
      w.addEventListener("storage", onStorage);
      return () => {
        try { w.removeEventListener("storage", onStorage); } catch {}
      };
    }
    return () => {};
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

  const handleCOGS = (row: InventoryItem) => {
    const kar = extractKarat(row);
    const w = typeof row.qty === "number" ? Number(row.qty) : 0;
    setCogsRow(row);
    setCogs((prev) => ({
      usdRate: Number(usdToLyd) || 0,
      making: 0,
      shipping: 0,
      travel: 0,
      lossPercent: 0,
      profitPercent: Number((row as any)?.Fournisseur?.Price_G_Gold_Sales) || 0,
      weight: w || 0,
    }));
    setCogsOpen(true);
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
      const { data, status } = await axios.get(`${apiUrlinv}/NewNF`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { ps, usr: Cuser },
      });
      if (status !== 200) throw new Error("Failed to fetch new invoice number");

      // Update num_fact for all items in datainv to newNumFact
      setDatainv((prev) =>
        prev.map((item) => ({
          ...item,
          num_fact: 0,
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
      console.error("Error creating new invoice:", error);
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
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        //   setSnackbar({ open: true, message: 'Invoice totals updated successfully', severity: 'success' });
        setTotalsDialog((prev) => ({ ...prev, open: false }));
        await fetchDataINV();
      } catch (error) {
        console.error("Error updating invoice totals:", error);
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
      console.error("Error updating invoice totals:", error);
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
  const [editDiscountType, setEditDiscountType] = useState<"value" | "percentage">("value");

  // const [editDialogIS_Gift, setEditDialogIS_Gift] = useState<boolean>(false);
  // Handler for saving the edited remise
  const handleEditDialogSave = async () => {
    if (!editDialogItem) return;
    try {
      const token = localStorage.getItem("token");
      // Compute final price from discount input
      const original = Number(editDialogItem.prix_vente) || 0;
      const discount = Number(editDialogRemise) || 0;
      const finalPrice = Math.max(
        0,
        editDiscountType === "percentage"
          ? original - original * (discount / 100)
          : original - discount
      );
      await axios.put(`${apiIp}/invoices/UpdateTotal/${editDialogItem.id_fact}`,
        { total_remise: finalPrice, prix_vente_remise: finalPrice },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Update local state after successful API call
      setDatainv((prev) => {
        const updated = prev.map((inv) =>
          inv.id_art === editDialogItem.id_art
            ? { ...inv, total_remise: finalPrice, prix_vente_remise: finalPrice }
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
        message: "Discount applied",
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
            <Typography variant="h6" sx={{ fontWeight: 700, color: (theme) => theme.palette.text.primary }}>
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
                startIcon={<WorkspacePremiumOutlined sx={{ fontSize: 16 }} />}
              >
                Gold
              </Button>
            </Box>
            <Box
              sx={{ display: "flex", flexDirection: "row", gap: 0.5, mb: 0.5 }}
            >
              <Button
                variant={typeFilter === "diamond" ? "contained" : "outlined"}
                
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
                startIcon={<DiamondOutlined sx={{ fontSize: 16 }} />}
              >
                Diamond
              </Button>
              <Button
                variant={typeFilter === "watch" ? "contained" : "outlined"}
                
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
                startIcon={<WatchOutlined sx={{ fontSize: 16 }} />}
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
                sx={{
                  fontWeight: 600,
                  mb: 0.5,
                  fontSize: 13,
                  color: (theme) => theme.palette.text.primary,
                }}
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
                sx={{ fontWeight: 600, mb: 0.5, fontSize: 13, color: (theme) => theme.palette.text.primary }}
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
                sx={{ fontWeight: 600, mb: 0.5, fontSize: 13, color: (theme) => theme.palette.text.primary }}
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
                setTypeFilter("");
                setCostMin("");
                setCostMax("");
                setSearch("");
                setBrandFilter("");
                setGeneralCommentFilter("");
                setCurrencyFilter("");
                setCategoryFilter("");
              }}
            >
              Reset Filter
            </Button>
          </Box>
        </Box>
        <Box sx={{ flex: 1, mr: 2 }}>
          {/* Search Field */}
          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
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
              sx={{ width: "100%", bgcolor: "inherit", borderRadius: 2 }}
            />
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
              gap: 1.5,
            }}
          >
            {loading ? (
              <Box sx={{ gridColumn: "1/-1", textAlign: "center", py: 6 }}>
                <Typography
                  variant="h6"
                  
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <CircularProgress
                    
                    size={36}
                    thickness={4}
                    sx={{ mb: 2 }}
                  />
                  Loading...
                </Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ gridColumn: "1/-1", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, mb: 1 }}>
                  {goldPrice > 0 && (
                    <>
                      <Chip size="small" label={`${goldPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sx={{ fontWeight: 800, '& .MuiChip-label': { fontSize: 12 } }} />
                      <Chip size="small" label={`18K: $${perGram18USD.toFixed(2)}/g`} sx={{ '& .MuiChip-label': { fontSize: 12 } }} />
                      <Chip size="small" label={`21K: $${perGram21USD.toFixed(2)}/g`} sx={{ '& .MuiChip-label': { fontSize: 12 } }} />
                      <Chip size="small" label={`24K: $${perGram24USD.toFixed(2)}/g`} sx={{ '& .MuiChip-label': { fontSize: 12 } }} />
                    </>
                  )}
                </Box>
                <Box sx={{ gridColumn: "1/-1", display: "flex", flexWrap: "wrap", gap: 1, mb: 1 }}>
                  <Button size="small" variant={goldKaratFilter === "all" && goldKindFilter === "all" ? "contained" : "outlined"} onClick={() => { setGoldKaratFilter("all"); setGoldKindFilter("all"); }}>All Types</Button>
                  <Button size="small" variant={goldKindFilter === "crashed" ? "contained" : "outlined"} onClick={() => { setGoldKindFilter("crashed"); setGoldKaratFilter("all"); }}>Crashed Gold</Button>
                  <Button size="small" variant={goldKaratFilter === "18" ? "contained" : "outlined"} onClick={() => { setGoldKaratFilter("18"); setGoldKindFilter("all"); }}>18K</Button>
                  <Button size="small" variant={goldKaratFilter === "21" ? "contained" : "outlined"} onClick={() => { setGoldKaratFilter("21"); setGoldKindFilter("all"); }}>21K</Button>
                  <Button size="small" variant={goldKaratFilter === "24" ? "contained" : "outlined"} onClick={() => { setGoldKaratFilter("24"); setGoldKindFilter("all"); }}>24K</Button>
                  <Button size="small" variant={goldKindFilter === "used" ? "contained" : "outlined"} onClick={() => { setGoldKindFilter("used"); setGoldKaratFilter("all"); }}>Used Gold</Button>
                </Box>
                {paginatedData
                  .filter((row) => !hiddenIds.includes(row.id_fact))
                  .map((row) => (
                    <Box
                      key={row.id_fact}
                      sx={{
                        borderRadius: 2,
                        pr: 2,
                        pl: 1.5,
                        py: 1.5,
                        display: "flex",
                        flexDirection: "row",
                        minHeight: 200,
                        border: "1px solid #eaeaea",
                        bgcolor: (theme) =>
                          theme.palette.mode === "dark" ? "#1f1f1f" : "#f7f7f7",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1.5,
                        mb: 1.5,
                        transition: "box-shadow 0.2s ease, transform 0.1s ease",
                        "&:hover": {
                          boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
                          transform: "translateY(-1px)",
                        },
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
                          // Show image normally
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
                          // Show latest image for diamond
                          if (diamond) {
                            const imageKey = diamond.id_achat;
                            const imageKeyStr = String(imageKey);
                            const urls = imageUrls[imageKeyStr] || [];
                            const idx = urls.length > 0 ? urls.length - 1 : 0;
                            return urls.length > 0 ? (
                              <Box
                                component="img"
                                src={(() => {
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
                          // Show first image for watch
                          if (watch) {
                            const imageKey = watch.id_achat;
                            const imageKeyStr = String(imageKey);
                            const urls = imageUrls[imageKeyStr] || [];
                            const idx = 0;
                            return urls.length > 0 ? (
                              <Box
                                component="img"
                                src={(() => {
                                  let url = urls[idx];
                                  if (!url) return "";
                                  if (token && !url.includes("token=")) {
                                    url += (url.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
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
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                          {(() => {
                            let dp: any = row.DistributionPurchase;
                            let watch: any = undefined;
                            if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
                              watch = dp[0]?.OriginalAchatWatch;
                            } else if (dp && typeof dp === "object") {
                              watch = dp?.OriginalAchatWatch;
                            }
                            if (watch) {
                              const brand = watch.common_local_brand || row.Fournisseur?.client_name || "";
                              const model = watch.model || "";
                              return (
                                <>
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                    <Typography sx={{ fontWeight: 800, fontSize: 18, color: (theme) => theme.palette.text.primary }}>
                                      {brand}
                                    </Typography>
                                  </Box>
                                  {model && (
                                    <Typography sx={{ color: "text.secondary", fontWeight: 500, fontSize: 13 }}>
                                      {model}
                                    </Typography>
                                  )}
                                  <Typography variant="caption" sx={{ color: (theme) => theme.palette.text.secondary }}>
                                    ID: {row.id_fact}
                                  </Typography>
                                </>
                              );
                            }
                            const name = (row.Design_art || "").toString();
                            return (
                              <>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                  <Typography sx={{ fontWeight: 800, fontSize: 18, color: (theme) => theme.palette.text.primary }}>
                                    {name.replace(/diamond\/gold\s*18\s*no/gi, "").trim()}
                                  </Typography>
                                </Box>
                                <Typography sx={{ color: "text.secondary", fontWeight: 500, fontSize: 13 }}>
                                  by {row.Fournisseur?.client_name || ""}
                                </Typography>
                                {(() => {
                                  const t = row.Fournisseur?.TYPE_SUPPLIER?.toLowerCase() || "";
                                  if (!t.includes("gold")) return null;
                                  const karatMatch = String(row.Design_art || "").match(/\b(24|22|21|18|14)\b/);
                                  const karat = karatMatch ? `${karatMatch[1]}K` : "";
                                  const weight = typeof row.qty === "number" ? `${row.qty} g` : "";
                                  if (!karat && !weight) return null;
                                  return (
                                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                                      {karat && `Karat: ${karat}`}
                                      {karat && weight ? " • " : ""}
                                      {weight && `Weight: ${weight}`}
                                    </Typography>
                                  );
                                })()}
                              </>
                            );
                          })()}
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                            {(() => {
                              const t = row.Fournisseur?.TYPE_SUPPLIER?.toLowerCase() || "";
                              // Gold: show weight chip
                              if (t.includes("gold")) {
                                return (
                                  <>
                                    {row.Color_Gold && (() => {
                                      const raw = String(row.Color_Gold || "").trim();
                                      const parts = raw.split(/[,\/\-\s]+/).filter(Boolean);
                                      const filtered = parts.filter((p) => !/^white$/i.test(p));
                                      const multi = /multi/i.test(raw);
                                      const hasGoldRaw = /gold/i.test(raw);
                                      const pick = (filtered[0] || parts[0] || raw);
                                      const normalized = pick.toLowerCase();
                                      const display = (multi && hasGoldRaw)
                                        ? "Gold/Multi"
                                        : (/white/i.test(raw) && filtered.length === 0 ? "White Gold"
                                          : normalized.includes("yellow") ? "Yellow Gold"
                                          : (normalized.includes("rose") || normalized.includes("pink")) ? "Rose Gold"
                                          : normalized.includes("gold") ? "Gold" : pick);
                                      let sxStyle: any = {};
                                      if (multi && hasGoldRaw) {
                                        sxStyle = { background: "linear-gradient(90deg, #D4AF37 0%, #D4AF37 50%, #f44336 50%, #ff9800 62.5%, #ffeb3b 75%, #4caf50 87.5%, #2196f3 100%)", color: "#111" };
                                      } else if (multi) {
                                        sxStyle = { background: "linear-gradient(90deg, #f44336, #ff9800, #ffeb3b, #4caf50, #2196f3, #3f51b5, #9c27b0)", color: "#111" };
                                      } else {
                                        let bg = "#eee"; let fg = "#111";
                                        if (normalized.includes("white")) { bg = "#C0C0C0"; fg = "#111"; }
                                        else if (normalized.includes("yellow")) { bg = "#f5d061"; fg = "#111"; }
                                        else if (normalized.includes("rose") || normalized.includes("pink")) { bg = "#ECC5C0"; fg = "#111"; }
                                        else if (normalized.includes("gold")) { bg = "#D4AF37"; fg = "#111"; }
                                        sxStyle = { bgcolor: bg, color: fg };
                                      }
                                      return (
                                        <Chip size="small" variant="filled" icon={<PaletteOutlined sx={{ fontSize: 16 }} />} label={`Color: ${display}`} sx={{ ...sxStyle }} />
                                      );
                                    })()}
                                    {typeof row.qty === "number" && row.qty > 0 && (
                                      <Chip
                                        size="small"
                                        variant="outlined"
                                        icon={<Straighten sx={{ fontSize: 16 }} />}
                                        label={`Weight: ${row.qty} g${(() => {
                                          const m = String(row.Design_art || "").match(/\b(24|22|21|18|14)\b/);
                                          return m ? ` • ${m[1]}K` : "";
                                        })()}`}
                                        sx={(theme) => ({ borderColor: theme.palette.divider, color: theme.palette.text.secondary })}
                                      />
                                    )}
                                  </>
                                );
                              }
                              // Diamond: show cut, clarity, color chips
                              if (t.includes("diamond")) {
                                let dp: any = row.DistributionPurchase;
                                let diamond: any;
                                if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
                                  diamond = dp[0]?.OriginalAchatDiamond;
                                } else if (dp && typeof dp === "object") {
                                  diamond = dp?.OriginalAchatDiamond;
                                }
                                if (!diamond) return null;
                                return (
                                  <>
                                    {diamond.cut && (
                                      <Chip size="small" variant="outlined" icon={<ContentCutOutlined sx={{ fontSize: 16 }} />} label={`Cut: ${diamond.cut}`} />
                                    )}
                                    {diamond.clarity && (
                                      <Chip size="small" variant="outlined" icon={<AllOutOutlined sx={{ fontSize: 16 }} />} label={`Clarity: ${diamond.clarity}`} />
                                    )}
                                    {diamond.color && (() => {
                                      const raw = String(diamond.color || "").trim();
                                      const parts = raw.split(/[,/\-\s]+/).filter(Boolean);
                                      const filtered = parts.filter((p) => !/^white$/i.test(p));
                                      const multi = /multi/i.test(raw);
                                      const hasGoldRaw = /gold/i.test(raw);
                                      const twoColors = !multi && filtered.length === 2;
                                      const display = multi ? (hasGoldRaw ? "Gold/Multi" : "Multi") : (twoColors ? filtered.join("/") : (filtered[0] || parts[0] || raw));
                                      const toHex = (name: string) => colorHex(name);
                                      let sxStyle: any = {};
                                      if (multi && hasGoldRaw) {
                                        sxStyle = { background: "linear-gradient(90deg, #D4AF37 0%, #D4AF37 50%, #f44336 50%, #ff9800 62.5%, #ffeb3b 75%, #4caf50 87.5%, #2196f3 100%)", color: "#111" };
                                      } else if (multi) {
                                        sxStyle = { background: "linear-gradient(90deg, #f44336, #ff9800, #ffeb3b, #4caf50, #2196f3, #3f51b5, #9c27b0)", color: "#111" };
                                      } else if (twoColors) {
                                        const c1 = toHex(filtered[0]);
                                        const c2 = toHex(filtered[1]);
                                        sxStyle = { background: `linear-gradient(90deg, ${c1} 0%, ${c1} 50%, ${c2} 50%, ${c2} 100%)`, color: "#111" };
                                      } else {
                                        const bg = toHex(display);
                                        const fg = bg === "#212121" ? "#fff" : "#111";
                                        sxStyle = { bgcolor: bg, color: fg };
                                      }
                                      return (
                                        <>
                                          <Chip size="small" variant="filled" icon={<PaletteOutlined sx={{ fontSize: 16 }} />} label={`Color: ${display}`} sx={sxStyle} />
                                          <Chip size="small" variant="outlined" label={`ID: ${row.id_fact}`} sx={(theme) => ({ borderColor: theme.palette.divider, ml: 0.5 })} />
                                        </>
                                      );
                                    })()}
                                  </>
                                );
                              }
                              // Watch: show case size chip (brand/model already shown above)
                              if (t.includes("watch")) {
                                let dp: any = row.DistributionPurchase;
                                let watch: any;
                                if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
                                  watch = dp[0]?.OriginalAchatWatch;
                                } else if (dp && typeof dp === "object") {
                                  watch = dp?.OriginalAchatWatch;
                                }
                                if (!watch) return null;
                                return (
                                  <>
                                    {watch.case_size && (
                                      <Chip size="small" variant="outlined" icon={<Straighten sx={{ fontSize: 16 }} />} label={`Case: ${watch.case_size}`} />
                                    )}
                                    {watch.dial_color && (() => {
                                      const raw = String(watch.dial_color || "").trim();
                                      const parts = raw.split(/[,/\-\s]+/).filter(Boolean);
                                      const filtered = parts.filter((p) => !/^white$/i.test(p));
                                      const multi = /multi/i.test(raw);
                                      const hasGoldRaw = /gold/i.test(raw);
                                      const twoColors = !multi && filtered.length === 2;
                                      const display = twoColors ? filtered.join("/") : (filtered[0] || parts[0] || raw);
                                      const toHex = (name: string) => colorHex(name);
                                      let sxStyle: any = {};
                                      if (multi && hasGoldRaw) {
                                        sxStyle = { background: "linear-gradient(90deg, #D4AF37 0%, #D4AF37 50%, #f44336 50%, #ff9800 62.5%, #ffeb3b 75%, #4caf50 87.5%, #2196f3 100%)", color: "#111" };
                                      } else if (multi) {
                                        sxStyle = { background: "linear-gradient(90deg, #f44336, #ff9800, #ffeb3b, #4caf50, #2196f3, #3f51b5, #9c27b0)", color: "#111" };
                                      } else if (twoColors) {
                                        const c1 = toHex(filtered[0]);
                                        const c2 = toHex(filtered[1]);
                                        sxStyle = { background: `linear-gradient(90deg, ${c1} 0%, ${c1} 50%, ${c2} 50%, ${c2} 100%)`, color: "#111" };
                                      } else {
                                        const bg = toHex(display);
                                        const fg = bg === "#212121" ? "#fff" : "#111";
                                        sxStyle = { bgcolor: bg, color: fg };
                                      }
                                      return (
                                        <>
                                          <Chip size="small" variant="filled" icon={<PaletteOutlined sx={{ fontSize: 16 }} />} label={`Color: ${display}`} sx={{ ...sxStyle, ml: 0.5 }} />
                                          <Chip size="small" variant="outlined" label={`ID: ${row.id_fact}`} sx={(theme) => ({ borderColor: theme.palette.divider, ml: 0.5 })} />
                                        </>
                                      );
                                    })()}
                                  </>
                                );
                              }
                              // Supplier and Group chips
                              return (
                                <>
                                  <Chip
                                    size="small"
                                    variant="outlined"
                                    label={`ID: ${row.id_fact}`}
                                    sx={(theme) => ({
                                      bgcolor: "transparent",
                                      borderColor: theme.palette.divider,
                                      color: theme.palette.text.secondary,
                                      "& .MuiChip-label": { fontSize: 12 },
                                    })}
                                  />
                                  {row.Fournisseur?.client_name && (
                                    <Chip
                                      size="small"
                                      variant="outlined"
                                      icon={<LinkOutlined sx={{ fontSize: 16 }} />}
                                      label={`Supplier: ${row.Fournisseur.client_name}`}
                                      sx={(theme) => ({ borderColor: theme.palette.divider, color: theme.palette.text.secondary })}
                                    />
                                  )}
                                  {row.General_Comment && (
                                    <Chip
                                      size="small"
                                      variant="outlined"
                                      icon={<GroupIcon sx={{ fontSize: 16 }} />}
                                      label={`Group: ${row.General_Comment}`}
                                      sx={(theme) => ({ borderColor: theme.palette.divider, color: theme.palette.text.secondary })}
                                    />
                                  )}
                                </>
                              );
                            })()}
                          </Box>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <IconButton
                            size="small"
                            onClick={() =>
                              setExpandedMap((prev) => ({
                                ...prev,
                                [row.id_fact]: !prev[row.id_fact],
                              }))
                            }
                            aria-label="toggle-details"
                          >
                            <ExpandMore
                              sx={{
                                fontSize: 20,
                                transition: "transform 0.2s",
                                transform: expandedMap[row.id_fact] ? "rotate(180deg)" : "rotate(0deg)",
                              }}
                            />
                          </IconButton>
                          <Typography
                            variant="body2"
                            sx={{ cursor: "pointer", userSelect: "none", color: (theme) => theme.palette.text.secondary }}
                            onClick={() =>
                              setExpandedMap((prev) => ({
                                ...prev,
                                [row.id_fact]: !prev[row.id_fact],
                              }))
                            }
                          >
                            Details
                          </Typography>
                        </Box>
                        <Collapse in={!!expandedMap[row.id_fact]} timeout="auto" unmountOnExit>
                          <Box
                            sx={(theme) => ({
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 0.75,
                              rowGap: 0.75,
                              alignItems: "center",
                              fontSize: 13,
                              color: theme.palette.text.secondary,
                              mt: 0.5,
                            })}
                          >
                            <Chip size="small" variant="outlined" label={`ID: ${row.id_fact}`} sx={(theme) => ({ borderColor: theme.palette.divider, color: theme.palette.text.secondary, "& .MuiChip-label": { fontSize: 12 } })} />
                            {row.Fournisseur?.client_name && (
                              <Chip size="small" variant="outlined" icon={<LinkOutlined sx={{ fontSize: 16 }} />} label={`Supplier: ${row.Fournisseur.client_name}`} sx={(theme) => ({ borderColor: theme.palette.divider, color: theme.palette.text.secondary })} />
                            )}
                            {row.General_Comment && (
                              <Chip size="small" variant="outlined" icon={<GroupIcon sx={{ fontSize: 16 }} />} label={`Group: ${row.General_Comment}`} sx={(theme) => ({ borderColor: theme.palette.divider, color: theme.palette.text.secondary })} />
                            )}

                            {/* Gold details */}
                            {row.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes("gold") && (
                              <>
                                {row.Color_Rush && (() => {
                                  const bg = colorHex(String(row.Color_Rush));
                                  const lower = bg.toLowerCase();
                                  const fg = (lower === '#000000' || lower === '#212121' || lower === '#353839') ? '#fff' : '#111';
                                  return (
                                    <Chip size="small" variant="filled" icon={<DiamondOutlined sx={{ fontSize: 16 }} />} label={`Stone: ${row.Color_Rush}`} sx={{ bgcolor: bg, color: fg }} />
                                  );
                                })()}
                                {row.Color_Gold && (() => {
                                  const raw = String(row.Color_Gold || "").trim();
                                  const parts = raw.split(/[,\/\-\s]+/).filter(Boolean);
                                  const filtered = parts.filter((p) => !/^white$/i.test(p));
                                  const multi = /multi/i.test(raw);
                                  const hasGoldRaw = /gold/i.test(raw);
                                  const pick = (filtered[0] || parts[0] || raw);
                                  const normalized = pick.toLowerCase();
                                  const display = multi && hasGoldRaw
                                    ? "Gold/Multi"
                                    : (/white/i.test(raw) && !filtered.length ? "White Gold"
                                      : normalized.includes("yellow") ? "Yellow Gold"
                                      : (normalized.includes("rose") || normalized.includes("pink")) ? "Rose Gold"
                                      : normalized.includes("gold") ? "Gold" : (multi ? "Multi" : pick));
                                  if (multi && hasGoldRaw) {
                                    return (
                                      <Chip size="small" variant="filled" icon={<PaletteOutlined sx={{ fontSize: 16, color: "white" }} />} label={`Color: ${display}`} sx={{ background: "linear-gradient(90deg, #D4AF37 0%, #D4AF37 50%, #f44336 50%, #ff9800 62.5%, #ffeb3b 75%, #4caf50 87.5%, #2196f3 100%)", color: "#111" }} />
                                    );
                                  } else if (multi) {
                                    return (
                                      <Chip size="small" variant="filled" icon={<PaletteOutlined sx={{ fontSize: 16 }} />} label={`Color: ${display}`} sx={{ background: "linear-gradient(90deg, #f44336, #ff9800, #ffeb3b, #4caf50, #2196f3, #3f51b5, #9c27b0)", color: "#111" }} />
                                    );
                                  }
                                  let bg = "#eee"; let fg = "#111";
                                  if (normalized.includes("white")) { bg = "#C0C0C0"; fg = "#111"; }
                                  else if (normalized.includes("yellow")) { bg = "#f5d061"; fg = "#111"; }
                                  else if (normalized.includes("rose") || normalized.includes("pink")) { bg = "#ECC5C0"; fg = "#111"; }
                                  else if (normalized.includes("gold")) { bg = "#D4AF37"; fg = "#111"; }
                                  return (
                                    <Chip size="small" variant="filled" icon={<PaletteOutlined sx={{ fontSize: 16 }} />} label={`Color: ${display}`} sx={{ bgcolor: bg, color: fg }} />
                                  );
                                })()}
                              {typeof row.qty === "number" && row.qty > 0 && (
                                <Chip size="small" variant="outlined" icon={<Straighten sx={{ fontSize: 16 }} />} label={`Weight: ${row.qty} g`} sx={(theme) => ({ borderColor: theme.palette.divider, color: theme.palette.text.secondary })} />
                              )}
                              {/* Weight and total summary */}
                              <Typography sx={{ fontWeight: 700, mt: 0.5, color: (theme) => theme.palette.text.primary }}>
                                  {`${(row.qty ?? 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}/g`} {" | "}
                                  {(() => {
                                    const total = (
                                      (goldPrice / 31.1035 + (goldPrice / 31.1035) * (((row as any).Fournisseur?.Price_G_Gold_Sales) || 0) / 100)) *
                                      (usdToLyd + 2) *
                                      (row.qty || 0);
                                    return `${total.toLocaleString("en-LY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LYD`;
                                  })()}
                                </Typography>
                              </>
                            )}

                            {/* Diamond details */}
                            {(() => {
                              let diamond: any = undefined;
                              let dp: any = row.DistributionPurchase;
                              if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
                                diamond = dp[0]?.OriginalAchatDiamond;
                              } else if (dp && typeof dp === "object") {
                                diamond = dp?.OriginalAchatDiamond;
                              }
                              if (!diamond) return null;
                              const dFields = [
                                { key: "Design_art", label: "Product Name", icon: <AllOutOutlined sx={{ fontSize: 16 }} /> },
                                { key: "carat", label: "Carat", icon: <DiamondOutlined sx={{ fontSize: 16 }} /> },
                                { key: "cut", label: "Cut", icon: <ContentCutOutlined sx={{ fontSize: 16 }} /> },
                                { key: "color", label: "Color", icon: <PaletteOutlined sx={{ fontSize: 16 }} /> },
                                { key: "clarity", label: "Clarity", icon: <AllOutOutlined sx={{ fontSize: 16 }} /> },
                                { key: "shape", label: "Shape", icon: <AllOutOutlined sx={{ fontSize: 16 }} /> },
                                { key: "measurements", label: "Measurements", icon: <Straighten sx={{ fontSize: 16 }} /> },
                                { key: "depth_percent", label: "Depth %", icon: <Straighten sx={{ fontSize: 16 }} /> },
                                { key: "table_percent", label: "Table %", icon: <Straighten sx={{ fontSize: 16 }} /> },
                                { key: "girdle", label: "Girdle", icon: <AllOutOutlined sx={{ fontSize: 16 }} /> },
                                { key: "culet", label: "Culet", icon: <AllOutOutlined sx={{ fontSize: 16 }} /> },
                                { key: "polish", label: "Polish", icon: <AllOutOutlined sx={{ fontSize: 16 }} /> },
                                { key: "symmetry", label: "Symmetry", icon: <AllOutOutlined sx={{ fontSize: 16 }} /> },
                                { key: "fluorescence", label: "Fluorescence", icon: <AllOutOutlined sx={{ fontSize: 16 }} /> },
                                { key: "certificate_number", label: "Cert #", icon: <QrCode2Outlined sx={{ fontSize: 16 }} /> },
                                { key: "certificate_lab", label: "Lab", icon: <AssignmentTurnedInOutlined sx={{ fontSize: 16 }} /> },
                                { key: "laser_inscription", label: "Laser Inscription", icon: <QrCode2Outlined sx={{ fontSize: 16 }} /> },
                                { key: "origin_country", label: "Origin Country", icon: <AllOutOutlined sx={{ fontSize: 16 }} /> },
                                { key: "document_no", label: "Document No", icon: <AssignmentTurnedInOutlined sx={{ fontSize: 16 }} /> },
                                { key: "external_code", label: "External Code", icon: <AssignmentTurnedInOutlined sx={{ fontSize: 16 }} /> },
                              ];
                              return (
                                <>
                                  {/* Brand chip */}
                                  {(() => {
                                    const brand = (getBrandName ? getBrandName(row) : (row.Fournisseur?.client_name || ""));
                                    return brand ? (
                                      <Chip size="small" variant="outlined" label={`Brand: ${brand}`} sx={(theme) => ({ borderColor: theme.palette.divider, color: theme.palette.text.secondary })} />
                                    ) : null;
                                  })()}
                                  {dFields.map((f) => {
                                    const val = diamond[f.key as keyof typeof diamond] as any;
                                    if (val === undefined || val === null || val === "") return null;
                                    const isColor = f.key === "color";
                                    let bg = "transparent" as string;
                                    let fg = undefined as string | undefined;
                                    let customStyle: any = undefined;
                                    if (isColor) {
                                      const raw = String(val).trim();
                                      const parts = raw.split(/[,\/\-\s]+/).filter(Boolean);
                                      const filtered = parts.filter((p) => !/^white$/i.test(p));
                                      const multi = /multi/i.test(raw);
                                      const hasGoldRaw = /gold/i.test(raw);
                                      const twoColors = !multi && filtered.length === 2;
                                      const toHex = (name: string) => {
                                        const n = name.toLowerCase();
                                        if (/(zum|zumr|zumor|zumur|zamar|zamr|zumrr|zumurr)/.test(n)) return "#50C878"; // emerald
                                        if (n.includes("sapph") || n.includes("saphir")) return "#0F52BA"; // sapphire
                                        if (n.includes("gold")) return "#b7a27d";
                                        if (n.includes("amethyst")) return "#9966cc";
                                        if (n.includes("opal")) return "#cfd8dc";
                                        if (n.includes("turq") || n.includes("turqu")) return "#40E0D0";
                                        if (n.includes("yellow")) return "#f5d061";
                                        if (n.includes("rose") || n.includes("pink")) return "#ECC5C0";
                                        if (n.includes("white") || n.includes("silver")) return "#C0C0C0";
                                        if (n.includes("black")) return "#212121";
                                        if (n.includes("blue")) return "#90caf9";
                                        if (n.includes("green")) return "#a5d6a7";
                                        if (n.includes("red")) return "#ef9a9a";
                                        if (n.includes("brown") || n.includes("champagne")) return "#d7ccc8";
                                        if (n.includes("orange")) return "#ffcc80";
                                        if (n.includes("purple")) return "#ce93d8";
                                        return "#eee";
                                      };
                                      if (multi && hasGoldRaw) {
                                        customStyle = { background: "linear-gradient(90deg, #D4AF37 0%, #D4AF37 50%, #f44336 50%, #ff9800 62.5%, #ffeb3b 75%, #4caf50 87.5%, #2196f3 100%)", color: "#111" };
                                      } else if (multi) {
                                        customStyle = { background: "linear-gradient(90deg, #f44336, #ff9800, #ffeb3b, #4caf50, #2196f3, #3f51b5, #9c27b0)", color: "#111" };
                                      } else if (twoColors) {
                                        const c1 = toHex(filtered[0]);
                                        const c2 = toHex(filtered[1]);
                                        customStyle = { background: `linear-gradient(90deg, ${c1} 0%, ${c1} 50%, ${c2} 50%, ${c2} 100%)`, color: "#111" };
                                      } else {
                                        bg = toHex(filtered[0] || parts[0] || raw);
                                        fg = bg === "#212121" ? "#fff" : "#111";
                                      }
                                    }
                                    return (
                                      <Chip
                                        key={`d-${String(f.key)}`}
                                        size="small"
                                        variant={isColor ? "filled" : "outlined"}
                                        icon={f.icon as any}
                                        label={`${f.label}: ${val}`}
                                        sx={(theme) => ({ borderColor: theme.palette.divider, ...(customStyle ? customStyle : { bgcolor: bg, color: isColor ? fg : theme.palette.text.secondary }) })}
                                      />
                                    );
                                  })}
                                  {diamond.certificate_url && (
                                    <Chip
                                      size="small"
                                      variant="outlined"
                                      icon={<LinkOutlined sx={{ fontSize: 16 }} />}
                                      label={
                                        <a href={String(diamond.certificate_url)} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
                                          Certificate URL
                                        </a>
                                      }
                                      sx={(theme) => ({ borderColor: theme.palette.divider, color: theme.palette.text.secondary })}
                                    />
                                  )}
                                </>
                              );
                            })()}

                            {/* Watch details */}
                            {(() => {
                              let watch: any = undefined;
                              let dp: any = row.DistributionPurchase;
                              if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
                                watch = dp[0]?.OriginalAchatWatch;
                              } else if (dp && typeof dp === "object") {
                                watch = dp?.OriginalAchatWatch;
                              }
                              if (!watch) return null;
                              const wFields = [
                                { key: "reference_number", label: "Ref.", icon: <QrCode2Outlined sx={{ fontSize: 16 }} /> },
                                { key: "serial_number", label: "Serial", icon: <QrCode2Outlined sx={{ fontSize: 16 }} /> },
                                { key: "movement", label: "Movement", icon: <BuildOutlined sx={{ fontSize: 16 }} /> },
                                { key: "caliber", label: "Caliber", icon: <PrecisionManufacturingOutlined sx={{ fontSize: 16 }} /> },
                                { key: "case_material", label: "Case", icon: <Inventory2Outlined sx={{ fontSize: 16 }} /> },
                                { key: "case_size", label: "Case Size", icon: <Straighten sx={{ fontSize: 16 }} /> },
                                { key: "bracelet_type", label: "Bracelet", icon: <WatchOutlined sx={{ fontSize: 16 }} /> },
                                { key: "dial_color", label: "Dial", icon: <PaletteOutlined sx={{ fontSize: 16 }} /> },
                                { key: "water_resistance", label: "WR", icon: <WaterDropOutlined sx={{ fontSize: 16 }} /> },
                                { key: "warranty", label: "Warranty", icon: <VerifiedUserOutlined sx={{ fontSize: 16 }} /> },
                                { key: "gender", label: "Gender", icon: <VerifiedUserOutlined sx={{ fontSize: 16 }} /> },
                                { key: "condition", label: "Condition", icon: <VerifiedUserOutlined sx={{ fontSize: 16 }} /> },
                              ];
                              return (
                                <>
                                  {/* Brand / Model */}
                                  {(watch.common_local_brand || watch.model) && (
                                    <>
                                      {watch.common_local_brand && (
                                        <Chip size="small" variant="outlined" label={`Brand: ${watch.common_local_brand}`} sx={(theme) => ({ borderColor: theme.palette.divider, color: theme.palette.text.secondary })} />
                                      )}
                                      {watch.model && (
                                        <Chip size="small" variant="outlined" label={`Model: ${watch.model}`} sx={(theme) => ({ borderColor: theme.palette.divider, color: theme.palette.text.secondary })} />
                                      )}
                                    </>
                                  )}
                                  {wFields.map((f) => {
                                    const val = watch[f.key as keyof typeof watch] as any;
                                    if (val === undefined || val === null || val === "") return null;
                                    return (
                                      <Chip key={`w-${String(f.key)}`} size="small" variant="outlined" icon={f.icon as any} label={`${f.label}: ${val}`} sx={(theme) => ({ borderColor: theme.palette.divider, color: theme.palette.text.secondary })} />
                                    );
                                  })}
                                  {/* Optional system/original ref fields */}
                                  {watch.system_original_ref && (
                                    <Chip size="small" variant="outlined" label={`System Original Ref.: ${watch.system_original_ref}`} sx={(theme) => ({ borderColor: theme.palette.divider, color: theme.palette.text.secondary })} />
                                  )}
                                  {watch.original_ref && (
                                    <Chip size="small" variant="outlined" label={`Original Ref.: ${watch.original_ref}`} sx={(theme) => ({ borderColor: theme.palette.divider, color: theme.palette.text.secondary })} />
                                  )}
                                  {watch.original_reference && (
                                    <Chip size="small" variant="outlined" label={`Original Ref.: ${watch.original_reference}`} sx={(theme) => ({ borderColor: theme.palette.divider, color: theme.palette.text.secondary })} />
                                  )}
                                  {typeof watch.box_papers !== "undefined" && watch.box_papers !== null && (
                                    <Chip size="small" variant="outlined" icon={<AssignmentTurnedInOutlined sx={{ fontSize: 16 }} />} label={`Box/Papers: ${watch.box_papers ? "Yes" : "No"}`} sx={(theme) => ({ borderColor: theme.palette.divider, color: theme.palette.text.secondary })} />
                                  )}
                                </>
                              );
                            })()}
                          </Box>
                        </Collapse>
                        {/* Prominent price above Add to cart */}
                        {/* End of details: thumbnails gallery */}
                        {(() => {
                          // Try to resolve images for diamond or watch
                          let dp: any = row.DistributionPurchase;
                          let diamond: any = undefined;
                          let watch: any = undefined;
                          if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
                            diamond = dp[0]?.OriginalAchatDiamond;
                            watch = dp[0]?.OriginalAchatWatch;
                          } else if (dp && typeof dp === "object") {
                            diamond = dp?.OriginalAchatDiamond;
                            watch = dp?.OriginalAchatWatch;
                          }
                          const obj = diamond || watch;
                          if (!obj) return null;
                          const imageKeyStr = String(obj.id_achat || "");
                          const urls = imageUrls[imageKeyStr] || [];
                          if (!urls.length) return null;
                          const token = localStorage.getItem("token");
                          return (
                            <Box sx={{ display: "flex", gap: 0.5, mt: 1, flexWrap: "wrap" }}>
                              {urls.slice(0, 8).map((u, idx) => {
                                let src = u || "";
                                if (src && token && !src.includes("token=")) {
                                  src += (src.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
                                }
                                return (
                                  <Box
                                    key={`${imageKeyStr}-${idx}`}
                                    component="img"
                                    src={src}
                                    alt={`Thumb ${idx + 1}`}
                                    loading="lazy"
                                    sx={(theme) => ({
                                      width: 56,
                                      height: 56,
                                      objectFit: "cover",
                                      borderRadius: 1,
                                      border: `1px solid ${theme.palette.divider}`,
                                      cursor: "pointer",
                                      background: "inherit",
                                    })}
                                    onClick={() => {
                                      setDialogImageList(urls);
                                      setDialogImageIndex(idx);
                                      setImageDialogOpen(true);
                                    }}
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src = "/default-image.png";
                                    }}
                                  />
                                );
                              })}
                            </Box>
                          );
                        })()}
                        {(() => {
                          const t = row.Fournisseur?.TYPE_SUPPLIER?.toLowerCase() || "";
                          let price = 0;
                          let currency = "USD";
                          if (t.includes("diamond") || t.includes("watch")) {
                            let dp: any = row.DistributionPurchase;
                            let obj: any = undefined;
                            if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
                              obj = t.includes("diamond") ? dp[0]?.OriginalAchatDiamond : dp[0]?.OriginalAchatWatch;
                            } else if (dp && typeof dp === "object") {
                              obj = t.includes("diamond") ? dp?.OriginalAchatDiamond : dp?.OriginalAchatWatch;
                            }
                            if (obj) {
                              if (typeof obj.sale_price === "number") price = obj.sale_price;
                              else if (typeof obj.SellingPrice === "number") price = obj.SellingPrice;
                            }
                          } else if (t.includes("gold")) {
                            currency = "LYD";
                            price =
                              (goldPrice / 31.1035 +
                                (goldPrice / 31.1035) * (((row as any).Fournisseur?.Price_G_Gold_Sales) || 0) / 100) *
                              (usdToLyd + 2) *
                              (row.qty || 0);
                          }
                          return (
                            <Typography
                              variant="body2"
                              sx={{ color: "#68a5bf", fontWeight: 900, fontSize: 18, alignSelf: "flex-end" }}
                            >
                              {price > 0
                                ? `${price.toLocaleString(currency === "LYD" ? "en-LY" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
                                : "-"}
                            </Typography>
                          );
                        })()}
                        <Box sx={{ mt: 2, display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                          {isAdminRole ? (
                            <Button
                              variant="outlined"
                              color="info"
                              size="small"
                              onClick={() => handleCOGS(row)}
                              sx={{ bgcolor: "transparent", borderColor: (theme) => theme.palette.divider }}
                            >
                              COGS
                            </Button>
                          ) : <Box />}
                          <Button
                            variant="contained"
                            color="warning"
                            size="small"
                            sx={{
                              fontWeight: 700,
                              borderRadius: 2,
                              bgcolor: "#ffa41c",
                              color: (theme) => (theme.palette.mode === "dark" ? "#fff" : "#111"),
                              "&:hover": { bgcolor: "#f08804" },
                            }}
                            onClick={() => handleSave(row)}
                            disabled={
                              addToCartLoading[row.id_fact] ||
                              datainv.some((item) => item.id_art === row.id_fact)
                            }
                            startIcon={
                              addToCartLoading[row.id_fact] ? (
                                <CircularProgress size={18} />
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
                    color: theme.palette.mode === "dark" ? "#fff" : "#111",
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
                        <option value={4}>4</option>
                        <option value={8}>8</option>
                        <option value={12}>12</option>
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
        <Box sx={{ width: "20%", minWidth: 240, position: "sticky", top: 8, alignSelf: "flex-start" }}>
          {/* Right Sidebar - Cart */}
          <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, flex: 1, color: (theme) => theme.palette.text.primary }}>
              Your Cart
            </Typography>
            <Box
              sx={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <Box sx={{ color: "warning.main", mr: 0.5 }}>
                <ShoppingCartOutlined sx={{ fontSize: 28 }} />
              </Box>
              <Box
                sx={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  bgcolor: "error.main",
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
            <Typography variant="body2" >
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
                      border: "1px solid #eaeaea",
                      borderRadius: 2,
                      display: "flex",
                      alignItems: "center",
                      position: "relative",
                      bgcolor: "background.paper",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
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
                        // Show only the first image from imageUrls if available, else fallback to pic

                        const imageKey = item.picint;
                        const imageKeyStr = String(imageKey);

                        const urls = imageUrls?.[imageKeyStr] || [];
                        const token = localStorage.getItem("token");

                        if (urls.length > 0 && urls[0]) {
                          let url = urls[0];
                          if (token && url && !url.includes("token=")) {
                            url +=
                              (url.includes("?") ? "&" : "?") +
                              "token=" +
                              encodeURIComponent(token);
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
                              //  onClick={() => handleViewImage(item)}
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = "/default-image.png";
                              }}
                            />
                          );
                        }
                      })()}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      {(() => {
                        const type = (typeSupplier || "").toLowerCase();
                        const dp = (achat as any)?.DistributionPurchase;
                        let watch: any = undefined;
                        if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
                          watch = dp[0]?.OriginalAchatWatch;
                        } else if (dp && typeof dp === "object") {
                          watch = dp?.OriginalAchatWatch;
                        }
                        if (type.includes("watch") && watch) {
                          const brand = watch.common_local_brand || achat?.Fournisseur?.client_name || "";
                          const model = watch.model || "";
                          return (
                            <>
                              <Typography variant="body2" sx={{ fontWeight: 800, color: (theme) => theme.palette.text.primary }}>
                                {brand}
                              </Typography>
                              {model && (
                                <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 500 }}>
                                  {model}
                                </Typography>
                              )}
                              <Typography variant="body2" sx={{ color: (theme) => theme.palette.text.secondary }}>ID: {item.id_art}</Typography>
                            </>
                          );
                        }
                        const n = (achat?.Design_art || (item as any).Design_art || "").toString();
                        return (
                          <>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: (theme) => theme.palette.text.primary }}>
                              {n.replace(/diamond\/gold\s*18\s*no/gi, "").trim()}
                            </Typography>
                            <Typography variant="body2" sx={{ color: (theme) => theme.palette.text.secondary }}>ID: {item.id_art}</Typography>
                          </>
                        );
                      })()}
                      {(() => {
                        const dp = (achat as any)?.DistributionPurchase;
                        let watch: any, diamond: any;
                        if (Array.isArray(dp) && dp.length > 0) {
                          watch = dp[0]?.OriginalAchatWatch;
                          diamond = dp[0]?.OriginalAchatDiamond;
                        } else if (dp && typeof dp === "object") {
                          watch = dp?.OriginalAchatWatch;
                          diamond = dp?.OriginalAchatDiamond;
                        }
                        const brand = (watch && (watch.common_local_brand || "")) || achat?.Fournisseur?.client_name || "";
                        return !watch && brand ? (
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>by {brand}</Typography>
                        ) : null;
                      })()}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
                        {(() => {
                          const dp = (achat as any)?.DistributionPurchase;
                          let watch: any = undefined;
                          if (Array.isArray(dp) && dp.length > 0) {
                            watch = dp[0]?.OriginalAchatWatch;
                          } else if (dp && typeof dp === "object") {
                            watch = dp?.OriginalAchatWatch;
                          }
                          if (!watch) return null;
                          return (
                            <>
                              {watch.case_size && (
                                <Chip size="small" variant="outlined" icon={<Straighten sx={{ fontSize: 16 }} />} label={`Case: ${watch.case_size}`} />
                              )}
                              {watch.gender && (
                                <Chip size="small" variant="outlined" label={`Gender: ${watch.gender}`} />
                              )}
                            </>
                          );
                        })()}
                        {(() => {
                          const dp = (achat as any)?.DistributionPurchase;
                          let diamond: any = undefined;
                          if (Array.isArray(dp) && dp.length > 0) {
                            diamond = dp[0]?.OriginalAchatDiamond;
                          } else if (dp && typeof dp === "object") {
                            diamond = dp?.OriginalAchatDiamond;
                          }
                          if (!diamond) return null;
                          return (
                            <>
                              {diamond.clarity && (
                                <Chip size="small" variant="outlined" icon={<AllOutOutlined sx={{ fontSize: 16 }} />} label={`Clarity: ${diamond.clarity}`} />
                              )}
                              {diamond.cut && (
                                <Chip size="small" variant="outlined" icon={<ContentCutOutlined sx={{ fontSize: 16 }} />} label={`Cut: ${diamond.cut}`} />
                              )}
                            </>
                          );
                        })()}
                      </Box>
                      {typeSupplier.toLowerCase().includes("gold") && (
                        <Chip label={`Weight: ${item.qty} g`} variant="outlined" sx={{ mt: 0.5 }} />
                      )}

                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: "bold",
                          color: "#68a5bf",
                          fontSize: 17,
                          letterSpacing: 0.5,
                        }}
                      >
                        {item.total_remise
                          ? typeSupplier.toLowerCase().includes("gold")
                            ? `${item.total_remise.toLocaleString("en-LY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LYD`
                            : `${item.total_remise.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                          : "-"}
                      </Typography>
                      {typeSupplier.toLowerCase().includes("gold") && null}
                    </Box>
                    {/* Delete icon */}
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "row",
                        gap: 0.5,
                        position: "absolute",
                        top: 4,
                        right: 4,
                      }}
                    >
                      <IconButton
                        onClick={() => {
                          setDeleteTargetId(item.id_fact);
                          setDeleteConfirmOpen(true);
                        }}
                        size="small"
                        color="error"
                        aria-label="remove"
                      >
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        
                        onClick={() => handleEditCartItem2(item)}
                        aria-label="edit"
                      >
                        <EditOutlined fontSize="small" />
                      </IconButton>
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
                    color: (theme) => theme.palette.text.primary,
                  }}
                >
                  Total
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
                variant="contained"
                size="small"
                sx={{
                  mt: 1,
                  fontWeight: 700,
                  borderRadius: 2,
                  width: "100%",
                  bgcolor: "#ffa41c",
                  color: (theme) => (theme.palette.mode === "dark" ? "#fff" : "#111"),
                  "&:hover": { bgcolor: "#f08804" },
                }}
                onClick={handleOpenTotalsDialog}
                disabled={datainv.length === 0}
              >
                Checkout
              </Button>
              <InvoiceTotalsDialog
                Type_Supplier={
                  datainv[0]?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || ""
                }
                open={totalsDialog.open}
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
                onCustomerCreated={async (c) => {
                  await fetchCustomers();
                  setEditInvoice((prev) => {
                    const found = customers.find(
                      (x) =>
                        x.tel_client === c.tel_client || x.client_name === c.client_name
                    );
                    return {
                      ...prev,
                      client: found?.id_client ?? prev.client,
                      Client: found || prev.Client,
                    };
                  });
                }}
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
      {/* COGS dialog */}
      <Dialog open={cogsOpen} onClose={() => setCogsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Charges & Rates</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {/* Price references */}
            <Typography variant="body2" sx={{ fontWeight: 700 }}>Gold Price (oz): {goldPrice ? goldPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</Typography>
            <Typography variant="body2">
              per gram: ${perGram24USD.toFixed(4)} (24K), ${perGram21USD.toFixed(4)} (21K), ${perGram18USD.toFixed(4)} (18K)
            </Typography>

            {/* Inputs */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
              <TextField label="USD→LYD Rate" type="number" size="small" value={cogs.usdRate} onChange={(e) => setCogs((p) => ({ ...p, usdRate: Number(e.target.value) }))} inputProps={{ step: '0.0001' }} />
              <TextField label="Weight (g)" type="number" size="small" value={cogs.weight} onChange={(e) => setCogs((p) => ({ ...p, weight: Number(e.target.value) }))} inputProps={{ step: '0.01' }} />
              <TextField label="Making (per item)" type="number" size="small" value={cogs.making} onChange={(e) => setCogs((p) => ({ ...p, making: Number(e.target.value) }))} inputProps={{ step: '0.01' }} />
              <TextField label="Shipping (per item)" type="number" size="small" value={cogs.shipping} onChange={(e) => setCogs((p) => ({ ...p, shipping: Number(e.target.value) }))} inputProps={{ step: '0.01' }} />
              <TextField label="Travel (per item)" type="number" size="small" value={cogs.travel} onChange={(e) => setCogs((p) => ({ ...p, travel: Number(e.target.value) }))} inputProps={{ step: '0.01' }} />
              <TextField label="Loss %" type="number" size="small" value={cogs.lossPercent} onChange={(e) => setCogs((p) => ({ ...p, lossPercent: Number(e.target.value) }))} inputProps={{ step: '0.01' }} />
              <TextField label="Profit Margin %" type="number" size="small" value={cogs.profitPercent} onChange={(e) => setCogs((p) => ({ ...p, profitPercent: Number(e.target.value) }))} inputProps={{ step: '0.01' }} />
            </Box>

            {/* Breakdown */}
            {(() => {
              const kar = cogsRow ? extractKarat(cogsRow) : '';
              const perGram = kar === '18' ? perGram18USD : kar === '21' ? perGram21USD : perGram24USD;
              const baseUSD = perGram * (Number(cogs.weight) || 0);
              const lossUSD = baseUSD * ((Number(cogs.lossPercent) || 0) / 100);
              const subTotalBeforeMargin = baseUSD + lossUSD + (Number(cogs.making) || 0) + (Number(cogs.shipping) || 0) + (Number(cogs.travel) || 0);
              const profitUSD = subTotalBeforeMargin * ((Number(cogs.profitPercent) || 0) / 100);
              const totalUSD = subTotalBeforeMargin + profitUSD;
              const totalLYD = totalUSD * (Number(cogs.usdRate) || 0);
              return (
                <Box sx={{ mt: 1, fontSize: 14 }}>
                  <Typography variant="body2">USD Rate: {Number(cogs.usdRate || 0).toFixed(4)}</Typography>
                  <Typography variant="body2">Making (per item): {Number(cogs.making || 0).toFixed(2)}</Typography>
                  <Typography variant="body2">Shipping (per item): {Number(cogs.shipping || 0).toFixed(2)}</Typography>
                  <Typography variant="body2">Travel (per item): {Number(cogs.travel || 0).toFixed(2)}</Typography>
                  <Typography variant="body2">Loss %: {Number(cogs.lossPercent || 0).toFixed(2)}%</Typography>
                  <Typography variant="body2">Profit Margin %: {Number(cogs.profitPercent || 0).toFixed(2)}%</Typography>
                  <Typography variant="body2">Weight (g): {Number(cogs.weight || 0).toFixed(3)}</Typography>
                  <Typography variant="body2">Per-gram (USD): {perGram.toFixed(4)}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 700 }}>Total: {totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD • {totalLYD.toLocaleString('en-LY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LYD</Typography>
                </Box>
              );
            })()}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCogsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
              {/* Print invoice removed per request */}
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
            bgcolor: (theme) => theme.palette.background.paper,
            color: (theme) => theme.palette.text.primary,
            boxShadow: 6,
            minWidth: 340,
            textAlign: "center",
            borderRadius: 2,
            p: 2,
          }}
        >
          <Typography sx={{ mb: 1, fontWeight: "bold", color: (theme) => theme.palette.text.primary }}>
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
                <CircularProgress size={20}  sx={{ mr: 1 }} />
              ) : null}
              Yes, Delete
            </Button>
            <Button
              variant="outlined"
              
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
            bgcolor: (theme) => theme.palette.background.paper,
            color: (theme) => theme.palette.text.primary,
            boxShadow: 6,
            minWidth: 340,
            textAlign: "center",
            borderRadius: 2,
            p: 2,
          }}
        >
          <Typography sx={{ mb: 1, fontWeight: "bold", color: (theme) => theme.palette.text.primary }}>
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
                <CircularProgress size={20}  sx={{ mr: 1 }} />
              ) : null}
              Yes, Empty
            </Button>
            <Button
              variant="outlined"
              
              onClick={() => setEmptyCartConfirmOpen(false)}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      </Snackbar>
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Apply Discount</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Type</Typography>
            <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="radio"
                name="discountType"
                checked={editDiscountType === "value"}
                onChange={() => setEditDiscountType("value")}
              />
              Value
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="radio"
                name="discountType"
                checked={editDiscountType === "percentage"}
                onChange={() => setEditDiscountType("percentage")}
              />
              %
            </label>
          </Box>
          <TextField
            label={editDiscountType === "percentage" ? "Discount %" : "Discount Value"}
            type="number"
            value={editDialogRemise}
            onChange={(e) => setEditDialogRemise(Number(e.target.value))}
            fullWidth
            margin="normal"
            size="small"
          />
          {editDialogItem && (
            <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
              Original: {Number(editDialogItem.prix_vente || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {"  "}| Final: {(() => {
                const original = Number(editDialogItem.prix_vente) || 0;
                const discount = Number(editDialogRemise) || 0;
                const finalPrice = Math.max(0, editDiscountType === "percentage" ? original - original * (discount / 100) : original - discount);
                return finalPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              })()}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await handleEditDialogSave();
              await fetchDataINV(); // Refresh cart list after save
              setEditDialogOpen(false);
            }}
            
            variant="contained"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GNew_I;