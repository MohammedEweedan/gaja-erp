import React from "react";
import axios from "../api";
import EditIcon from "@mui/icons-material/Edit";
import { useNavigate } from "react-router-dom";
import { type MRT_ColumnDef } from "material-react-table";
import {
  Box,
  IconButton,
  Button,
  Typography,
  TextField,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormGroup,
  CircularProgress,
  Chip,
} from "@mui/material";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import LinkIcon from "@mui/icons-material/Link";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
// ExcelJS was previously used for embedding images; we now use MHTML export similar to SalesReportsTable
import { useAuth } from "../contexts/AuthContext";
// Export image settings (mirrors SalesReportsTable approach for compatibility)
const EXPORT_IMG_SIZE = 55; // px size for exported thumbnails
const EXPORT_IMG_QUALITY = 0.7; // jpeg quality
const EXPORT_MAX_IMAGES = 800; // global cap across export
const EXPORT_FALLBACK_COLOR = "#f0f0f0";

// Utility: fetch image URL (already tokenized) and downscale to fixed size JPEG base64 to reduce XLS size
// `quality` is optional and defaults to `EXPORT_IMG_QUALITY`.
async function fetchAndDownscaleToBase64(
  rawUrl: string,
  size: number,
  quality?: number
): Promise<string | null> {
  try {
    const resp = await fetch(rawUrl, { method: "GET" });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    // If already small just convert to base64
    if (blob.size < 3500) {
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    }
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = URL.createObjectURL(blob);
    });
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // object-fit: cover
    const ratio = Math.max(size / img.width, size / img.height);
    const nw = img.width * ratio;
    const nh = img.height * ratio;
    const dx = (size - nw) / 2;
    const dy = (size - nh) / 2;
    ctx.fillStyle = EXPORT_FALLBACK_COLOR;
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, dx, dy, nw, nh);
    const q = typeof quality === "number" ? quality : EXPORT_IMG_QUALITY;
    let dataUrl = canvas.toDataURL("image/jpeg", q);
    URL.revokeObjectURL(img.src);
    // If the produced base64 blob is very large, progressively lower quality as fallback.
    if (dataUrl.length > 60000)
      dataUrl = canvas.toDataURL("image/jpeg", Math.min(0.85, q));
    if (dataUrl.length > 120000)
      dataUrl = canvas.toDataURL("image/jpeg", Math.min(0.6, q));
    return dataUrl;
  } catch {
    try {
      const r2 = await fetch(rawUrl);
      if (!r2.ok) return null;
      const b2 = await r2.blob();
      return await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onloadend = () => resolve(fr.result as string);
        fr.onerror = reject;
        fr.readAsDataURL(b2);
      });
    } catch {
      return null;
    }
  }
}

// Fetch image list for export (tries typed diamond folder then fallback)
async function fetchImageListForExport(id: number): Promise<string[]> {
  const token = localStorage.getItem("token");
  const API_BASEImage = "/images";
  const endpoints = [
    `${API_BASEImage}/list/diamond/${id}`,
    `${API_BASEImage}/list/${id}`,
  ];
  for (const url of endpoints) {
    try {
      const res = await axios.get(
        url,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );
      if (Array.isArray(res.data)) {
        return res.data
          .map((u: string) => {
            if (typeof u !== "string") return "";
            if (
              u.startsWith("https://system.gaja.ly") ||
              u.startsWith("http://system.gaja.ly")
            ) {
              u =
                "https://system.gaja.ly" +
                u.substring(
                  u.indexOf("system.gaja.ly") + "system.gaja.ly".length
                );
            }
            if (
              window?.location?.protocol === "https:" &&
              u.startsWith("http://")
            ) {
              try {
                const after = u.substring("http://".length);
                u = "https://" + after;
              } catch {}
            }
            if (token) {
              try {
                const urlObj = new URL(u, window.location.origin);
                urlObj.searchParams.delete("token");
                urlObj.searchParams.append("token", token);
                u = urlObj.toString();
              } catch {
                /* ignore */
              }
            }
            return u;
          })
          .filter(Boolean);
      }
    } catch {
      /* try next */
    }
  }
  return [];
}

type InventoryItem = {
  id_fact: number;
  desig_art: string;
  qty: number;
  qty_difference: number;
  Fournisseur: {
    client_name: string;
    code_supplier: string;
    TYPE_SUPPLIER: string;
  };
  user: { name_user: string; email: string };
  id_art?: number;
  DistributionPurchase?: { OriginalAchatDiamond?: Record<string, any> };
  General_Comment?: string;
};

interface Props {
  Type?: string;
}

// Ordered list of diamond fields with labels (mirrors style from WInventory)
// Extend this list if backend adds more attributes.
export const DIAMOND_FIELDS_ORDER: {
  key: string;
  label: string;
  format?: (v: any) => string;
}[] = [
  { key: "id_achat", label: " System ID." },
  { key: "CODE_EXTERNAL", label: "  Ref Code" },
  { key: "comment_edit", label: "  Sales Code" },
  { key: "reference_number", label: "  Ref." },
  { key: "serial_number", label: "  Serial No." },
  { key: "carat", label: "  Carat", format: (v) => `${v}` },
  { key: "shape", label: " Shape" },
  { key: "color", label: " Color" },
  { key: "clarity", label: " Clarity" },
  { key: "cut", label: " Cut" },
  { key: "polish", label: " Polish" },
  { key: "symmetry", label: " Symmetry" },
  { key: "fluorescence", label: " Fluor." },
  { key: "measurements", label: " Measurements" },
  { key: "depth_percent", label: " Depth %", format: (v) => `${v}` },
  { key: "table_percent", label: " Table %", format: (v) => `${v}` },
  { key: "girdle", label: " Girdle" },
  { key: "culet", label: " Culet" },
  { key: "certificate_number", label: " Cert #" },
  { key: "certificate_lab", label: " Lab" },
  { key: "certificate_url", label: " Cert URL" },
  { key: "laser_inscription", label: " Laser Inscription" },
  { key: "price_per_carat", label: " Item Cost", format: (v) => `${v}` },
  { key: "origin_country", label: " Origin" },
  { key: "Brand", label: " Brand Name" },
  {
    key: "Rate",
    label: " Rate",
    format: (v) => {
      const n = Number(v);
      return isNaN(n) ? String(v ?? "") : n.toFixed(2);
    },
  },
  { key: "Total_Price_LYD", label: " Total (LYD)", format: (v) => `${v}` },
  { key: "Design_art", label: " Product Name" },
  { key: "SellingPrice", label: " Selling Price", format: (v) => `${v}` },
];

const getDiamondFromRow = (row: InventoryItem): any => {
  const dp: any = row.DistributionPurchase;
  let diamond: any;
  if (Array.isArray(dp) && dp.length > 0) diamond = dp[0]?.OriginalAchatDiamond;
  else if (dp && typeof dp === "object") diamond = dp.OriginalAchatDiamond;
  if (!diamond) return undefined;
  // Inject supplier brand so it appears in Details as 'Brand Name'
  return { ...diamond, Brand: row.Fournisseur?.client_name };
};

const API_BASEImage = "/images";
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

// Ensure URLs that reference the application's images use the proper host and HTTPS.
// Handles cases returned as relative paths like 'images/...' or malformed host like 'https://images/...'
const ensureHttpsSystemGaja = (u?: string | null): string => {
  if (!u) return "";
  try {
    const s = String(u || "");
    // If already a blob or data URL, return as-is
    if (/^blob:|^data:/i.test(s)) return s;

    // Extract pathname+search from the input
    try {
      // If the URL is absolute, parse it
      const parsed = new URL(s, window.location.origin);
      const host = (parsed.hostname || "").toLowerCase();
      const pathAndQuery =
        parsed.pathname + (parsed.search || "") + (parsed.hash || "");
      // If hostname looks like 'images' (no domain) or equals 'images', rewrite to system.gaja.ly
      if (host === "images" || /^images$/i.test(host)) {
        return `https://system.gaja.ly${pathAndQuery}`;
      }
      // If host is system.gaja.ly but using http, upgrade to https
      if (/^system\.gaja\.ly$/i.test(host)) {
        return `https://${parsed.host}${pathAndQuery}`;
      }
      // Otherwise return the original absolute URL (no change)
      return parsed.toString();
    } catch {
      // Not an absolute URL; handle common relative forms like '/images/...' or 'images/...'
      const rel = s.replace(/^\/+/, ""); // strip leading slashes
      if (/^images\//i.test(rel)) {
        return `https://system.gaja.ly/${rel}`;
      }
      return s;
    }
  } catch (e) {
    return String(u || "");
  }
};

// Normalize URLs for dialog display: append token if present and ensure https for system.gaja.ly
const normalizeDialogUrls = (urls: string[] | undefined): string[] => {
  const token = localStorage.getItem("token");
  if (!urls || !urls.length) return [];
  try {
    return urls
      .map((u) => {
        try {
          let out = String(u || "");
          // If the URL is already a blob: or data: URL (object URL or inline), don't modify it.
          // Appending a token or manipulating these schemes will break the resource.
          if (/^blob:|^data:/i.test(out)) return out;
          // Try to build an absolute URL using the browser URL parser.
          try {
            let urlObj = new URL(out, window.location.origin);
            // If hostname looks invalid (e.g. "images" or missing a dot), treat as relative path
            const host = (urlObj.hostname || "").toLowerCase();
            const looksLikeBareHost =
              host && host.indexOf(".") === -1 && host !== "localhost";
            if (looksLikeBareHost) {
              // Rebuild as origin + pathname + search
              const path = urlObj.pathname + (urlObj.search || "");
              urlObj = new URL(path, window.location.origin);
            }
            if (token) urlObj.searchParams.set("token", token);
            out = urlObj.toString();
          } catch {
            // Fallback: append token manually if URL constructor fails
            if (token && !out.includes("token="))
              out =
                out +
                (out.includes("?") ? "&" : "?") +
                "token=" +
                encodeURIComponent(token);
            // If out started without protocol but without leading slash, ensure leading slash so browser resolves correctly
            if (!/^[a-zA-Z]+:\/\//.test(out) && !out.startsWith("/"))
              out = "/" + out;
            // Prepend origin to make absolute
            try {
              out = window.location.origin + out;
            } catch {
              /* ignore */
            }
          }
          out = ensureHttpsSystemGaja(out);
          // Do not rewrite external origins here. Some deployments don't have a server proxy.
          // Keep the URL absolute and tokenized so the browser will request it directly (matching the working copy).
          return out;
        } catch {
          return String(u || "");
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
};

// Format a value as USD with comma thousands and dot decimal, append " USD"
const formatUSD = (v: any): string => {
  if (v === null || v === undefined || v === "") return "";
  const num =
    typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return `${v} USD`;
  try {
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
    return `${formatted} USD`;
  } catch {
    return `${num} USD`;
  }
};

const DInventory: React.FC<Props> = ({ Type = "" }) => {
  // Image type filter state
  // '' = all, 'Marketing', 'Invoice', 'Group', 'Other' = not containing any
  const [imageTypeFilter, setImageTypeFilter] = React.useState<string>("");
  // Snackbar for notifications
  const [snackbar, setSnackbar] = React.useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info" | "warning";
  }>({ open: false, message: "", severity: "info" });
  const handleCloseSnackbar = () =>
    setSnackbar((prev) => ({ ...prev, open: false }));
  // State for edit dialog
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [editItem, setEditItem] = React.useState<InventoryItem | null>(null);
  const [editDesignArt, setEditDesignArt] = React.useState("");
  // Famille list for desig_famille
  const [familleList, setFamilleList] = React.useState<
    { id_famille: number; desig_famille: string }[]
  >([]);
  React.useEffect(() => {
    const fetchFamilleList = async () => {
      const token = localStorage.getItem("token");
      try {
        const res = await axios.get("/products/all", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFamilleList(res.data);
      } catch (e) {
        console.error("Failed to fetch Famille list", e);
      }
    };
    fetchFamilleList();
  }, []);
  const { user } = useAuth();
  const isAdmin = React.useMemo(() => {
    // 1) Prefer Prvilege from localStorage (backend Users.Roles)
    try {
      const u = localStorage.getItem("user");
      if (u) {
        const obj = JSON.parse(u);
        const prv = obj?.Prvilege;
        const list: string[] = Array.isArray(prv)
          ? prv.map((r: any) =>
              typeof r === "string"
                ? r
                : String(r?.name || r?.role || r?.value || r)
            )
          : typeof prv === "string"
            ? prv.split(/[\s,;|]+/)
            : prv
              ? [String(prv?.name || prv?.role || prv?.value || prv)]
              : [];
        if (
          list.some(
            (s) =>
              String(s).toUpperCase().includes("ROLE_ADMIN") ||
              String(s).toUpperCase() === "ADMIN"
          )
        )
          return true;
      }
    } catch {}
    // 2) Fallback to roles from AuthContext
    const candidates: string[] = [];
    if (user?.role) candidates.push(String(user.role));
    const rs: any = (user as any)?.roles;
    if (Array.isArray(rs)) {
      rs.forEach((r: any) =>
        candidates.push(
          typeof r === "string"
            ? r
            : String((r && (r.name || r.role || r.value)) ?? r)
        )
      );
    } else if (typeof rs === "string") {
      rs.split(/[\s,;]+/).forEach((s: string) => s && candidates.push(s));
    } else if (rs) {
      candidates.push(String((rs && (rs.name || rs.role || rs.value)) ?? rs));
    }
    return candidates.some((s) => {
      const up = String(s).toUpperCase();
      return up.includes("ROLE_ADMIN") || up === "ADMIN";
    });
  }, [user]);
  // session: PS filter state.
  // NOTE: We prefill the Autocomplete input from localStorage (`ps`) but
  // do NOT apply it as the active filter on first load. The user must
  // explicitly select an option or press Enter to apply the filter.
  const initialPs = (() => {
    try {
      return localStorage.getItem("ps") || "";
    } catch {
      return "";
    }
  })();
  const [psFilter, setPsFilter] = React.useState<string>("");
  const [psOptions, setPsOptions] = React.useState<string[]>([]);
  // Map from displayed label -> id (string). When available, use id for server filter.
  const psLabelToIdRef = React.useRef<Record<string, string>>({});
  // Input buffer for PS Autocomplete: typing updates this, but we only apply
  // the actual filter (`psFilter`) when the user selects an option or presses Enter.
  const [psInput, setPsInput] = React.useState<string>(initialPs);
  const initialLoadRef = React.useRef<boolean>(true);

  const navigate = useNavigate();
  const [data, setData] = React.useState<InventoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [imageUrls, setImageUrls] = React.useState<Record<string, string[]>>(
    {}
  );
  const [images, setImages] = React.useState<Record<string, string[]>>({});
  const [imageDialogOpen, setImageDialogOpen] = React.useState(false);
  const [dialogImages, setDialogImages] = React.useState<string[]>([]);
  const [dialogIndex, setDialogIndex] = React.useState(0);
  // Auto-select rename type based on filename
  React.useEffect(() => {
    if (!imageDialogOpen || !dialogImages.length) return;
    const url = dialogImages[dialogIndex];
    if (!url) return;
    const filename = url.split("/").pop()?.split("?")[0] || "";
    if (/invoice/i.test(filename)) {
      setRenameChoice("Invoice");
    } else if (/marketing/i.test(filename)) {
      setRenameChoice("Marketing");
    } else if (/group/i.test(filename)) {
      setRenameChoice("Group");
    } else {
      setRenameChoice(null);
    }
  }, [imageDialogOpen, dialogImages, dialogIndex]);

  // Auto-select rename type based on filename
  React.useEffect(() => {
    if (!imageDialogOpen || !dialogImages.length) return;
    const url = dialogImages[dialogIndex];
    if (!url) return;
    const filename = url.split("/").pop()?.split("?")[0] || "";
    if (/invoice/i.test(filename)) {
      setRenameChoice("Invoice");
    } else if (/marketing/i.test(filename)) {
      setRenameChoice("Marketing");
    } else if (/group/i.test(filename)) {
      setRenameChoice("Group");
    } else {
      setRenameChoice(null);
    }
  }, [imageDialogOpen, dialogImages, dialogIndex]);
  // Removed Diamond Details panel; no need to keep diamond data in dialog state
  // Filters
  const [brandFilter, setBrandFilter] = React.useState<string>("");
  const [productName, setProductName] = React.useState<string>("");
  const [costMin, setCostMin] = React.useState<string>("");
  const [costMax, setCostMax] = React.useState<string>("");
  const [refCode, setRefCode] = React.useState<string>("");
  const [salesCode, setSalesCode] = React.useState<string>("");
  // zoom & pan state for dialog image
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [dragging, setDragging] = React.useState(false);
  const dragStartRef = React.useRef<{
    x: number;
    y: number;
    origX: number;
    origY: number;
  } | null>(null);

  const resetZoom = React.useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  React.useEffect(() => {
    if (imageDialogOpen) resetZoom();
  }, [imageDialogOpen, dialogIndex, resetZoom]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY; // scroll up -> zoom in
    setZoom((z) => {
      let next = z + (delta > 0 ? 0.15 : -0.15);
      if (next < 1) next = 1;
      if (next > 5) next = 5;
      return Number(next.toFixed(2));
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom === 1) return; // no pan when normal scale
    setDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      origX: offset.x,
      origY: offset.y,
    };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({
      x: dragStartRef.current.origX + dx,
      y: dragStartRef.current.origY + dy,
    });
  };
  const endDrag = () => {
    setDragging(false);
    dragStartRef.current = null;
  };
  const zoomIn = () =>
    setZoom((z) => Math.min(5, Number((z + 0.5).toFixed(2))));
  const zoomOut = () =>
    setZoom((z) => {
      const next = z - 0.5;
      if (next <= 1) {
        setOffset({ x: 0, y: 0 });
        return 1;
      }
      return Number(next.toFixed(2));
    });

  const fetchData = React.useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/");
    try {
      // On the very first load, ignore any saved PS and do not send it to the server.
      // This ensures the initial list is not filtered by localStorage.ps.
      const psParam = initialLoadRef.current
        ? undefined
        : psFilter || undefined;
      const paramsObj: any = { type_supplier: Type };
      if (psParam !== undefined) paramsObj.ps = psParam;
      console.debug(
        "DInventory.fetchData: sending params=",
        paramsObj,
        "psFilter=",
        psFilter,
        "initialLoad=",
        initialLoadRef.current
      );
      let res = await axios.get<InventoryItem[]>(`/Inventory/allActive`, {
        headers: { Authorization: `Bearer ${token}` },
        params: paramsObj,
      });
      console.debug(
        "DInventory.fetchData: response length=",
        Array.isArray(res.data) ? res.data.length : "not-array"
      );
      // Fallback: some backends behave differently when a ps param is absent vs present.
      // If initial load returned empty, try once more without any params to see if data appears.
      if (
        initialLoadRef.current &&
        Array.isArray(res.data) &&
        res.data.length === 0
      ) {
        try {
          console.debug(
            "DInventory.fetchData: initial load empty, retrying without params"
          );
          res = await axios.get<InventoryItem[]>(`/Inventory/allActive`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          console.debug(
            "DInventory.fetchData: retry response length=",
            Array.isArray(res.data) ? res.data.length : "not-array"
          );
        } catch (inner) {
          console.debug(
            "DInventory.fetchData: retry without params failed",
            inner
          );
        }
      }
      if (res && res.data) setData(res.data);
    } catch (e: any) {
      if (e.response?.status === 401) navigate("/");
      else console.error(e);
    } finally {
      initialLoadRef.current = false;
      setLoading(false);
    }
  }, [navigate, psFilter, Type]);
  // Fetch data on mount and whenever the active PS filter or Type changes.
  React.useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Fetch PS options for autocomplete (fallback to server '/ps/all')
  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get("/ps/all", {
          headers: { Authorization: token ? `Bearer ${token}` : undefined },
        });
        if (!mounted) return;
        if (Array.isArray(res.data)) {
          // res.data may be array of objects or strings
          const opts: string[] = [];
          const map: Record<string, string> = {};
          for (const p of res.data) {
            if (typeof p === "string") {
              const label = p;
              opts.push(label);
              map[label] = label;
            } else {
              const label =
                p.name_point ||
                p.name ||
                (p.Id_point ? String(p.Id_point) : JSON.stringify(p));
              const id = p.Id_point ? String(p.Id_point) : label;
              opts.push(label);
              map[label] = id;
            }
          }
          psLabelToIdRef.current = map;
          // build inverse id -> label map
          const inv: Record<string, string> = {};
          Object.entries(map).forEach(([label, id]) => {
            if (id) inv[String(id)] = label;
          });
          psIdToLabelRef.current = inv;
          setPsOptions(Array.from(new Set(opts)).filter(Boolean));
        }
      } catch (e) {
        // ignore
      } finally {
        // finished loading PS options
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Distinct brands for filter dropdown
  const distinctBrands = React.useMemo(() => {
    const s = new Set<string>();
    data.forEach((row) => {
      const b = row.Fournisseur?.client_name;
      if (b) s.add(b);
    });
    return Array.from(s).sort();
  }, [data]);

  // Map id -> label for PS options (inverse of psLabelToIdRef)
  const psIdToLabelRef = React.useRef<Record<string, string>>({});

  const getPsLabelFromRow = (row: any): string => {
    try {
      const dpAny = row?.DistributionPurchase;
      let p: any = null;
      if (Array.isArray(dpAny)) {
        for (const d of dpAny) {
          p = d?.ps ?? d?.PS ?? d?.Id_point ?? d?.ps_id;
          if (p != null) break;
        }
      } else if (dpAny && typeof dpAny === "object") {
        p = dpAny?.ps ?? dpAny?.PS ?? dpAny?.Id_point ?? dpAny?.ps_id;
      }
      if (p == null) return "";
      const key = String(p);
      // prefer label mapping if available
      return psIdToLabelRef.current[key] || key;
    } catch {
      return "";
    }
  };

  // Fields visible in Details/dialog (hide Item Cost for non-admins; always hide status fields)
  const fieldsToShow = React.useMemo(() => {
    const hiddenAlways = new Set([
      "IsApprouved",
      "Approval_Date",
      "ApprouvedBy",
      "Total_Price_LYD",
    ]);
    // Show price_per_carat (Item Cost) only for admins
    return DIAMOND_FIELDS_ORDER.filter((f) => {
      if (hiddenAlways.has(f.key)) return false;
      if (!isAdmin && f.key === "price_per_carat") return false;
      return true;
    });
  }, [isAdmin]);
  // Note: If Item Cost still doesn't show for admins, log current roles from AuthContext to verify format.
  // console.debug('roles:', user?.role, user?.roles, 'isAdmin:', isAdmin);

  // Helper to filter image URLs by type
  const filterImageUrlsByType = (urls: string[], type: string) => {
    if (!type) return urls;
    if (type === "Other") {
      // Exclude images containing any of the three types
      return urls.filter((u) => {
        const name = u.split("/").pop()?.split("?")[0] || "";
        return !["Invoice", "Group", "Marketing"].some((t) => name.includes(t));
      });
    }
    return urls.filter((u) => {
      const name = u.split("/").pop()?.split("?")[0] || "";
      return name.includes(type);
    });
  };

  const fetchImages = async (id_achat: number) => {
    const token = localStorage.getItem("token");
    if (!token || !id_achat) return;
    // Diamond images live under DiamondPic via typed route: /images/list/diamond/:id_achat
    const typedUrl = `${API_BASEImage}/list/diamond/${id_achat}`;
    const legacyUrl = `${API_BASEImage}/list/${id_achat}`; // fallback (watch default)
    try {
      // mark loading placeholder so UI can distinguish between 'not requested' and 'loading'
      setImageUrls((p) => (p[id_achat] ? p : { ...p, [id_achat]: [] }));
      let res;
      try {
        res = await axios.get(typedUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (innerErr) {
        // fallback in case backend older version
        res = await axios.get(legacyUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      let urls: string[] = Array.isArray(res.data)
        ? typeof res.data[0] === "object"
          ? res.data.map((i: any) => i.url || i)
          : res.data
        : [];
      // Filter to diamond folder just in case legacy returned watch images
      urls = urls.filter((u) => /DiamondPic/i.test(u));
      setImageUrls((p) => ({ ...p, [id_achat]: urls }));
      const blobs = await Promise.all(
        urls.map((u) => fetchImageWithAuth(u, token))
      );
      setImages((p) => ({
        ...p,
        [id_achat]: blobs.filter((u): u is string => !!u),
      }));
      return urls;
    } catch (e) {
      console.warn("No diamond images for", id_achat, e);
      setImages((p) => ({ ...p, [id_achat]: [] }));
      setImageUrls((p) => ({ ...p, [id_achat]: [] }));
      return [];
    }
  };

  const [groupDialogOpen, setGroupDialogOpen] = React.useState(false);
  const [groupDialogItems, setGroupDialogItems] = React.useState<any[]>([]);
  const [groupDialogName, setGroupDialogName] = React.useState<string>("");
  // State for image rename dialog
  const [renameChoice, setRenameChoice] = React.useState<string | null>(null);
  const [renaming, setRenaming] = React.useState(false);
  const [renameError, setRenameError] = React.useState<string>("");
  const [renameSuccess, setRenameSuccess] = React.useState<string>("");
  const columns = React.useMemo<MRT_ColumnDef<InventoryItem>[]>(
    () => [
      {
        header: "Image",
        id: "image",
        Cell: ({ row }) => {
          let imageKey;
          let diamond;
          const dp = row.original.DistributionPurchase;
          if (Array.isArray(dp) && dp.length > 0) {
            diamond = dp[0]?.OriginalAchatDiamond;
            imageKey = diamond?.id_achat;
          } else if (dp && typeof dp === "object") {
            diamond = dp?.OriginalAchatDiamond;
            imageKey = diamond?.id_achat;
          }
          if (!imageKey) imageKey = row.original.id_fact;
          const k = String(imageKey);
          React.useEffect(() => {
            const numericKey = Number(imageKey);
            if (!images[k] && !imageUrls[k] && numericKey)
              fetchImages(numericKey);
          }, [k, imageKey]);
          let urls = imageUrls[k] || [];
          // Apply image type filter if set
          urls = filterImageUrlsByType(urls, imageTypeFilter);
          const token = localStorage.getItem("token");
          // Removed unused variable 'name'
          // Filter out any image whose filename contains 'group'
          let filteredUrls = urls.filter(
            (u) => !/group/i.test(u.split("/").pop() || "")
          );
          // Apply image type filter if set
          filteredUrls = filterImageUrlsByType(filteredUrls, imageTypeFilter);
          // Find the latest image that does NOT contain 'PIC' in its filename
          let defaultIdx = -1;
          for (let i = filteredUrls.length - 1; i >= 0; i--) {
            if (!/PIC/i.test(filteredUrls[i].split("/").pop() || "")) {
              defaultIdx = i;
              break;
            }
          }
          // If all images contain 'PIC', fallback to the first image that does not contain 'group'
          if (defaultIdx === -1 && filteredUrls.length) {
            defaultIdx = 0;
          }
          if (defaultIdx === -1) {
            return (
              <Box
                sx={{
                  width: 120,
                  height: 120,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  No Image
                </Typography>
              </Box>
            );
          }
          const openDialog = () => {
            // Prevent opening dialog for group images
            // Removed unused variable 'name' (no longer needed)
            let list = images[k];
            if (!list || !list.length) {
              list = filteredUrls.map((u) => {
                if (!token) return u;
                return u.includes("token=")
                  ? u
                  : u +
                      (u.includes("?") ? "&" : "?") +
                      "token=" +
                      encodeURIComponent(token);
              });
            }
            {
              console.debug("DInventory.openDialog (image cell) raw list:", {
                k,
                rawList: list,
              });
              const normalized = normalizeDialogUrls(list || []);
              const clampedIndex = Math.min(
                Math.max(0, defaultIdx),
                Math.max(0, normalized.length - 1)
              );
              const urlInfo = normalized.map((u) => {
                try {
                  const p = new URL(u);
                  return { url: u, hostname: p.hostname };
                } catch {
                  return { url: u, hostname: null };
                }
              });
              console.debug("DInventory.openDialog (image cell) normalized:", {
                k,
                defaultIdx,
                clampedIndex,
                normalized,
                urlInfo,
              });
              setDialogImages(normalized);
              setDialogIndex(clampedIndex);
              setImageDialogOpen(true);
            }
          };
          return (
            <Box
              sx={{
                width: 120,
                height: 120,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <Box
                component="img"
                onClick={openDialog}
                src={(() => {
                  let u = filteredUrls[defaultIdx];
                  if (u && token && !u.includes("token="))
                    u +=
                      (u.includes("?") ? "&" : "?") +
                      "token=" +
                      encodeURIComponent(token);
                  u = ensureHttpsSystemGaja(u);
                  return u;
                })()}
                alt="img"
                loading="lazy"
                sx={{
                  maxHeight: 108,
                  maxWidth: 108,
                  border: "1px solid #ccc",
                  borderRadius: 2,
                  objectFit: "contain",
                  cursor: "pointer",
                  "&:hover": { transform: "scale(1.03)" },
                  transition: "transform .3s",
                }}
              />
              {filteredUrls.length ? (
                <Typography
                  variant="caption"
                  sx={{
                    position: "absolute",
                    bottom: 4,
                    right: 8,
                    background: "#0008",
                    color: "#fff",
                    px: 0.5,
                    borderRadius: 1,
                  }}
                >
                  {filteredUrls.length}/{filteredUrls.length}
                </Typography>
              ) : null}
            </Box>
          );
        },
      },
      {
        header: "Image Group",
        id: "image_group",
        Cell: ({ row }) => {
          let imageKey;
          let diamond;
          const dp = row.original.DistributionPurchase;
          if (Array.isArray(dp) && dp.length > 0) {
            diamond = dp[0]?.OriginalAchatDiamond;
            imageKey = diamond?.id_achat;
          } else if (dp && typeof dp === "object") {
            diamond = dp?.OriginalAchatDiamond;
            imageKey = diamond?.id_achat;
          }
          if (!imageKey) imageKey = row.original.id_fact;
          const k = String(imageKey);
          React.useEffect(() => {
            const numericKey = Number(imageKey);
            if (!images[k] && !imageUrls[k] && numericKey)
              fetchImages(numericKey);
          }, [k, imageKey]);
          let urls = imageUrls[k] || [];
          // Apply image type filter if set
          urls = filterImageUrlsByType(urls, imageTypeFilter);
          const token = localStorage.getItem("token");
          // Removed unused variable 'name'
          // Only show images whose filename contains 'group' in Image Group column
          const groupImages = urls.filter((u) =>
            /group/i.test(u.split("/").pop() || "")
          );
          if (!groupImages.length) {
            return (
              <Box
                sx={{
                  width: 120,
                  height: 120,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  No Image
                </Typography>
              </Box>
            );
          }
          // Only show one image if all group images have the same filename
          const filenames = groupImages.map(
            (u) => u.split("/").pop()?.split("?")[0] || ""
          );
          const uniqueFilenames = Array.from(new Set(filenames));
          let displayImage = groupImages[0];
          if (uniqueFilenames.length === 1) {
            // All images have the same filename, show only the first
            displayImage = groupImages[0];
          } else {
            // Show all unique images (if needed, but for now just show the first)
            displayImage = groupImages[0];
          }
          const openDialog = () => {
            let list = images[k];
            if (!list || !list.length) {
              list = [displayImage].map((u) => {
                if (!token) return u;
                return u.includes("token=")
                  ? u
                  : u +
                      (u.includes("?") ? "&" : "?") +
                      "token=" +
                      encodeURIComponent(token);
              });
            }
            {
              console.debug("DInventory.openDialog (image group) raw list:", {
                k,
                rawList: list,
              });
              const normalized = normalizeDialogUrls(list || []);
              const clampedIndex = Math.min(
                Math.max(0, 0),
                Math.max(0, normalized.length - 1)
              );
              const urlInfo = normalized.map((u) => {
                try {
                  const p = new URL(u);
                  return { url: u, hostname: p.hostname };
                } catch {
                  return { url: u, hostname: null };
                }
              });
              console.debug("DInventory.openDialog (image group) normalized:", {
                k,
                clampedIndex,
                normalized,
                urlInfo,
              });
              setDialogImages(normalized);
              setDialogIndex(clampedIndex);
              setImageDialogOpen(true);
            }
          };
          return (
            <Box
              sx={{
                width: 120,
                height: 120,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <Box
                component="img"
                onClick={openDialog}
                src={(() => {
                  let u = displayImage;
                  if (u && token && !u.includes("token="))
                    u +=
                      (u.includes("?") ? "&" : "?") +
                      "token=" +
                      encodeURIComponent(token);
                  u = ensureHttpsSystemGaja(u);
                  return u;
                })()}
                alt="img-group"
                loading="lazy"
                sx={{
                  maxHeight: 108,
                  maxWidth: 108,
                  border: "1px solid #ccc",
                  borderRadius: 2,
                  objectFit: "contain",
                  cursor: "pointer",
                  "&:hover": { transform: "scale(1.03)" },
                  transition: "transform .3s",
                }}
              />
            </Box>
          );
        },
      },
      {
        header: "",
        id: "group",
        size: 50,
        Cell: ({ row }) => {
          // Check for group in unite field and General_Comment
          const Unite = (row.original as any).Unite;
          const generalComment = (row.original as any).General_Comment;
          // Only show group button if Unite contains more than one code/id
          let groupCount = 0;
          if (
            typeof Unite === "string" &&
            Unite.startsWith("{") &&
            Unite.endsWith("}")
          ) {
            const ids = Unite.replace(/[{}]/g, "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            groupCount = ids.length;
          } else if (Array.isArray(Unite)) {
            groupCount = Unite.length;
          }
          // If groupCount <= 1, do not show button
          if (groupCount <= 1) return null;
          return (
            <IconButton
              color="primary"
              onClick={() => {
                let items: any[] = [];
                if (
                  typeof Unite === "string" &&
                  Unite.startsWith("{") &&
                  Unite.endsWith("}")
                ) {
                  const ids = Unite.replace(/[{}]/g, "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  items = ids
                    .map((id) =>
                      data.find((item) => String(item.id_fact) === id)
                    )
                    .filter(Boolean);
                } else if (Array.isArray(Unite)) {
                  items = Unite;
                }
                setGroupDialogItems(items);
                setGroupDialogName(generalComment || "Group");
                setGroupDialogOpen(true);
              }}
              title={generalComment || "Group"}
            >
              <LinkIcon />
            </IconButton>
          );
        },
      },
      {
        header: "Ref Code",
        id: "ref_code",
        size: 140,
        Cell: ({ row }) => {
          const diamond = getDiamondFromRow(row.original) || {};
          const val =
            diamond?.CODE_EXTERNAL ||
            diamond?.reference_number ||
            row.original.id_fact;
          return (
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {val ?? "-"}
            </Typography>
          );
        },
      },
      {
        accessorFn: (r) => r.Fournisseur?.client_name,
        header: "Brand",
        size: 120,
        Cell: ({ row }) => {
          let diamond: any;
          const dp: any = row.original.DistributionPurchase;
          if (Array.isArray(dp) && dp.length)
            diamond = dp[0]?.OriginalAchatDiamond;
          else if (dp) diamond = dp?.OriginalAchatDiamond;
          const nickname = diamond?.common_local_brand;
          const brand = row.original.Fournisseur?.client_name;
          return (
            <Box sx={{ display: "flex", flexDirection: "column" }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {brand || "-"}
              </Typography>
              {nickname && (
                <Typography variant="caption" color="text.secondary">
                  {nickname}
                </Typography>
              )}
            </Box>
          );
        },
      },
      {
        header: "Details",
        id: "details",
        size: 350,
        Cell: ({ row }) => {
          const diamond = getDiamondFromRow(row.original);
          const generalComment = row.original.General_Comment;
          if (!diamond)
            return (
              <Typography variant="caption" color="text.secondary">
                No details
              </Typography>
            );
          return (
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 0.75,
                lineHeight: 1.1,
              }}
            >
              {/* Show group name if General_Comment exists and not empty */}
              {generalComment && generalComment.trim() !== "" && (
                <Box sx={{ width: "100%" }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, color: "primary.main", mb: 0.5 }}
                  >
                    <b>Group Name:</b> {generalComment}
                  </Typography>
                </Box>
              )}
              {/* 1) Product Name (Design_art) first line, bold and colored like Selling Price, with edit button */}
              {(() => {
                const f = fieldsToShow.find((ff) => ff.key === "Design_art");
                if (!f) return null;
                const raw = diamond[f.key];
                if (raw === null || raw === undefined || raw === "")
                  return null;
                const val = f.format ? f.format(raw) : raw;
                return (
                  <Box
                    key={f.key}
                    sx={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 800, color: "warning.main" }}
                    >
                      <b>{f.label}:</b> {String(val)}
                    </Typography>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => {
                        setEditItem(row.original);
                        setEditDesignArt(val || "");
                        setEditDialogOpen(true);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Box>
                );
              })()}
              {/* 2) Rest of fields excluding Product Name and Selling Price */}
              {fieldsToShow
                .filter(
                  (f) => f.key !== "Design_art" && f.key !== "SellingPrice"
                )
                .map((f) => {
                  const raw = diamond[f.key];
                  if (raw === null || raw === undefined || raw === "")
                    return null;
                  let val: any = f.format ? f.format(raw) : raw;
                  // Combine Item Cost with its currency directly
                  if (f.key === "price_per_carat") {
                    const cur = diamond?.currencyRetail;
                    if (cur) val = `${val} ${cur}`;
                  }
                  return (
                    <Typography key={f.key} variant="caption">
                      <b>{f.label}:</b> {String(val)}
                    </Typography>
                  );
                })}
              {/* Selling Price moved to the Ref/Brand column to keep key info together. */}
            </Box>
          );
        },
      },
    ],
    [images, imageUrls, fieldsToShow, data, imageTypeFilter]
  );

  // small usage so 'columns' isn't considered unused (we render a flat list instead of the table)
  React.useEffect(() => {
    console.debug && console.debug("columns count", columns?.length);
  }, [columns?.length]);

  // Apply filters: Brand, Product Name, and Cost range
  const filteredData = React.useMemo(() => {
    const brandQ = brandFilter.trim().toLowerCase();
    const nameQ = productName.trim().toLowerCase();
    const refQ = refCode.trim().toLowerCase();
    const salesQ = salesCode.trim().toLowerCase();
    const min = costMin ? Number(costMin) : null;
    const max = costMax ? Number(costMax) : null;
    return data.filter((row) => {
      const diamond = getDiamondFromRow(row) || {};
      // PS filter: if set, ensure at least one DistributionPurchase entry matches the PS id
      if (psFilter && psFilter.trim() !== "") {
        const psVal = psFilter.trim();
        let matchPs = false;
        const dpAny = (row as any).DistributionPurchase;
        if (Array.isArray(dpAny)) {
          for (const d of dpAny) {
            const p = d?.ps ?? d?.PS ?? d?.Id_point ?? d?.ps_id;
            if (
              p != null &&
              (String(p) === psVal ||
                String(Number(p)) === String(Number(psVal)))
            ) {
              matchPs = true;
              break;
            }
          }
        } else if (dpAny && typeof dpAny === "object") {
          const p = dpAny?.ps ?? dpAny?.PS ?? dpAny?.Id_point ?? dpAny?.ps_id;
          if (
            p != null &&
            (String(p) === psVal || String(Number(p)) === String(Number(psVal)))
          )
            matchPs = true;
        }
        if (!matchPs) return false;
      }
      // Brand filter (supplier brand)
      const brand = (row.Fournisseur?.client_name || "").toLowerCase();
      const brandOk = !brandQ || brand.includes(brandQ);
      // Product Name filter (Design_art)
      const name = (diamond.Design_art || "").toString().toLowerCase();
      const nameOk = !nameQ || name.includes(nameQ);
      // Ref Code and Sales Code filters
      const refVal = (diamond.CODE_EXTERNAL || "").toString().toLowerCase();
      const salesVal = (diamond.comment_edit || "").toString().toLowerCase();
      const refOk = !refQ || refVal.includes(refQ);
      const salesOk = !salesQ || salesVal.includes(salesQ);
      // Cost filter: prefer SellingPrice; admin fallback to price_per_carat
      let cost = 0;
      if (typeof diamond.SellingPrice === "number") cost = diamond.SellingPrice;
      else if (diamond.SellingPrice != null) {
        const n = Number(String(diamond.SellingPrice).replace(/[^0-9.-]/g, ""));
        cost = isNaN(n) ? 0 : n;
      } else if (isAdmin && typeof diamond.price_per_carat === "number") {
        cost = diamond.price_per_carat;
      }
      const minOk = min === null || cost >= min;
      const maxOk = max === null || cost <= max;
      return brandOk && nameOk && refOk && salesOk && minOk && maxOk;
    });
  }, [
    data,
    brandFilter,
    productName,
    refCode,
    salesCode,
    costMin,
    costMax,
    isAdmin,
    psFilter,
  ]);

  // Helper to fetch base64 image for export by fetching the image blob (appending token if needed)
  // and converting to a data URL. This avoids canvas CORS issues and mirrors how images are
  // displayed in the table (token as query param).
  const getBase64FromUrl = async (
    url: string
  ): Promise<{ base64: string | null; ext?: string; contentType?: string }> => {
    try {
      if (!url) return { base64: null };
      // If already a data URL, return stripped base64
      if (url.startsWith("data:")) {
        const idx = url.indexOf(",");
        const header = url.substring(5, idx);
        const mime = header.split(";")[0];
        let ext = "png";
        if (mime === "image/jpeg" || mime === "image/jpg") ext = "jpeg";
        else if (mime === "image/gif") ext = "gif";
        return { base64: idx === -1 ? url : url.substring(idx + 1), ext };
      }
      let fetchUrl = url;
      const token = localStorage.getItem("token");

      const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const slice = bytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, Array.from(slice) as any);
        }
        return btoa(binary);
      };

      // 0) Optional same-origin proxy attempt. This requires a backend endpoint that
      // proxies an external image and returns the raw bytes with correct CORS headers.
      // If you add such endpoint (e.g. GET /images/proxy?url=...) this will attempt it first.
      try {
        const u = new URL(fetchUrl, window.location.href);
        const isCrossOrigin = u.origin !== window.location.origin;
        if (isCrossOrigin) {
          try {
            const proxyPaths = [
              "/images/proxy",
              "/api/images/proxy",
              "/proxy-image",
            ];
            for (const p of proxyPaths) {
              try {
                const proxyUrl = `${window.location.origin}${p}?url=${encodeURIComponent(fetchUrl)}`;
                const pr = await fetch(proxyUrl, { method: "GET" });
                if (pr.ok) {
                  const contentType = pr.headers.get("content-type") || "";
                  const buffer = await pr.arrayBuffer();
                  const base64 = arrayBufferToBase64(buffer);
                  let ext = "png";
                  if (/jpeg|jpg/.test(contentType)) ext = "jpeg";
                  else if (/gif/.test(contentType)) ext = "gif";
                  return { base64, ext, contentType };
                }
              } catch (e) {
                // ignore per-proxy attempt errors
              }
            }
          } catch (e) {
            // ignore proxy attempt errors
          }
        }
      } catch (e) {
        // ignore URL parsing errors
      }

      // FIRST attempt: try fetching with token as query param (simple GET — sometimes avoids preflight)
      try {
        if (fetchUrl.startsWith("/"))
          fetchUrl = window.location.origin + fetchUrl;
        let fetchUrlWithToken = fetchUrl;
        try {
          const u2 = new URL(fetchUrl);
          if (token && !u2.searchParams.has("token"))
            u2.searchParams.set("token", token);
          fetchUrlWithToken = u2.toString();
        } catch (e) {
          if (token && !fetchUrlWithToken.includes("token="))
            fetchUrlWithToken =
              fetchUrlWithToken +
              (fetchUrlWithToken.includes("?") ? "&" : "?") +
              "token=" +
              encodeURIComponent(token || "");
        }
        const res = await fetch(fetchUrlWithToken);
        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          const buffer = await res.arrayBuffer();
          const base64 = arrayBufferToBase64(buffer);
          let ext = "png";
          if (/jpeg|jpg/.test(contentType)) ext = "jpeg";
          else if (/gif/.test(contentType)) ext = "gif";
          return { base64, ext, contentType };
        }
      } catch (err) {
        console.debug(
          "getBase64FromUrl: fetch with token-as-query failed or blocked (preflight avoided). Will try Authorization header next.",
          err
        );
      }

      // SECOND attempt: try fetch with Authorization header (may trigger preflight)
      try {
        const resAuth = await fetch(fetchUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (resAuth.ok) {
          const contentType = resAuth.headers.get("content-type") || "";
          const buffer = await resAuth.arrayBuffer();
          const base64 = arrayBufferToBase64(buffer);
          let ext = "png";
          if (/jpeg|jpg/.test(contentType)) ext = "jpeg";
          else if (/gif/.test(contentType)) ext = "gif";
          return { base64, ext, contentType };
        }
      } catch (err) {
        console.debug(
          "getBase64FromUrl: fetch with Authorization header failed",
          err
        );
      }

      // FINAL fallback: use axios with arraybuffer (some servers behave differently)
      try {
        const axiosRes = await axios.get(fetchUrl, {
          responseType: "arraybuffer",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (axiosRes && axiosRes.status === 200 && axiosRes.data) {
          const buffer = axiosRes.data as ArrayBuffer;
          const base64 = arrayBufferToBase64(buffer);
          const contentType =
            (axiosRes.headers && axiosRes.headers["content-type"]) || "";
          let ext3 = "png";
          if (/jpeg|jpg/.test(contentType)) ext3 = "jpeg";
          else if (/gif/.test(contentType)) ext3 = "gif";
          return { base64, ext: ext3, contentType };
        }
      } catch (err) {
        console.debug(
          "getBase64FromUrl: axios arraybuffer fallback failed",
          err
        );
      }

      return { base64: null };
    } catch (err) {
      return { base64: null };
    }
  };

  // Excel export with all fields + image (first image per item)
  // Excel export dialog state
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
  const [exportProgress, setExportProgress] = React.useState(0);
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState("");
  // Diagnostics for export (per-image fetch/embed attempts)
  const [exportDiagnostics, setExportDiagnostics] = React.useState<Array<any>>(
    []
  );
  // Export filter state
  const [exportFilterType, setExportFilterType] = React.useState<
    "all" | "brand" | "name"
  >("all");
  const [exportBrand, setExportBrand] = React.useState("");
  const [exportName, setExportName] = React.useState("");
  // Export fields selection (checklist)
  // default selected: all DIAMOND_FIELDS_ORDER keys
  const defaultSelected = React.useMemo(
    () => DIAMOND_FIELDS_ORDER.map((f) => f.key),
    []
  );
  const [exportSelectedFields, setExportSelectedFields] =
    React.useState<string[]>(defaultSelected);

  // Export all data directly from fetched data
  const handleExportExcel = async () => {
    setExportDialogOpen(true);
    setExporting(true);
    setExportProgress(0);
    setExportError("");
    setExportDiagnostics([]);
    // Filter data based on export filter (same as before)
    let exportData = filteredData;
    if (exportFilterType === "brand" && exportBrand) {
      exportData = filteredData.filter(
        (row) =>
          (row.Fournisseur?.client_name || "").toLowerCase() ===
          exportBrand.toLowerCase()
      );
    } else if (exportFilterType === "name" && exportName) {
      exportData = filteredData.filter((row) =>
        (getDiamondFromRow(row)?.Design_art || "")
          .toLowerCase()
          .includes(exportName.toLowerCase())
      );
    }
    try {
      // Generate MHTML (Excel-friendly .xls) with embedded images using cid parts
      // `fieldsToExport` is an array of diamond field keys (from exportSelectedFields)
      const generateExportMhtml = async (
        rows: any[],
        fieldsToExport: string[]
      ) => {
        const parseDataUrl = (
          dataUrl: string
        ): { mime: string; base64: string } | null => {
          const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
          if (!match) return null;
          return { mime: match[1] || "image/png", base64: match[2] };
        };

        const picintToCidImages: Record<
          string,
          { cid: string; mime: string; base64: string }[]
        > = {};
        const allImages: { cid: string; mime: string; base64: string }[] = [];
        let idx = 1;
        let globalImageCount = 0;
        let truncated = false;

        // Collect unique image keys (imageKey same as table logic)
        const neededKeys = new Set<string>();
        rows.forEach((row: any) => {
          let imageKey: any;
          const dp = row.DistributionPurchase;
          if (Array.isArray(dp) && dp.length > 0)
            imageKey = dp[0]?.OriginalAchatDiamond?.id_achat;
          else if (dp && typeof dp === "object")
            imageKey = dp.OriginalAchatDiamond?.id_achat;
          if (!imageKey) imageKey = row.id_fact;
          if (imageKey) neededKeys.add(String(imageKey));
        });

        // Choose an image size for Excel export and make row height match it
        const excelImgSize = Math.max(EXPORT_IMG_SIZE, 110); // px image size for Excel export
        const rowHeight = excelImgSize; // make row height equal to the image size

        for (const key of Array.from(neededKeys)) {
          if (truncated) break;
          const pic = Number(key);
          let candidateUrls: string[] = imageUrls[key] || [];
          if ((!candidateUrls || !candidateUrls.length) && pic) {
            try {
              candidateUrls = await fetchImageListForExport(pic);
            } catch {
              candidateUrls = [];
            }
          }
          const limited = candidateUrls.slice(0, 2);
          const parts: { cid: string; mime: string; base64: string }[] = [];
          for (const raw of limited) {
            if (globalImageCount >= EXPORT_MAX_IMAGES) {
              truncated = true;
              break;
            }
            try {
              // Use a larger size and higher quality for Excel exports so images look sharp.
              const exportQuality = 0.9; // higher JPEG quality for Excel export
              const down = await fetchAndDownscaleToBase64(
                raw,
                excelImgSize || EXPORT_IMG_SIZE,
                exportQuality
              );
              if (!down) continue;
              const parsed = parseDataUrl(down);
              if (!parsed) continue;
              const cid = `image${String(idx++).padStart(4, "0")}`;
              const part = { cid, mime: parsed.mime, base64: parsed.base64 };
              parts.push(part);
              allImages.push(part);
              globalImageCount++;
            } catch {
              /* skip */
            }
          }
          picintToCidImages[key] = parts;
        }

        // Build HTML table using selected fields
        const fieldDefs = DIAMOND_FIELDS_ORDER;
        const headerCols = (fieldsToExport || []).map((k) => {
          const fd = fieldDefs.find((f) => f.key === k);
          return fd ? fd.label : k;
        });
        // We'll always append an Images column at the end
        let html =
          `
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Diamond Inventory Export</title>
          <style>
            body { font-family: Roboto, 'Segoe UI', Arial, sans-serif; }
            table { width: 98%; margin: 8px auto; border-collapse: collapse; }
            th, td { border: 1px solid #e0e0e0; padding: 8px; vertical-align: top; }
            th { background: #f5f5f5; font-weight: 700; }
            .img-row { display:flex; gap:6px; align-items:center; }
            .img-row img { width: ${excelImgSize}px; height: ${excelImgSize}px; object-fit: cover; border-radius:4px; border:1px solid #eee; }
          </style>
        </head>
        <body>
          <h2 style="margin-left:12px;color:#1976d2">Diamond Inventory</h2>
          <table>
            <thead>
              <tr>` +
          headerCols.map((h) => `<th>${h}</th>`).join("") +
          `<th>Images</th></tr>
            </thead>
            <tbody>`;

        for (const row of rows) {
          let imageKey: any;
          const dp = row.DistributionPurchase;
          if (Array.isArray(dp) && dp.length > 0)
            imageKey = dp[0]?.OriginalAchatDiamond?.id_achat;
          else if (dp && typeof dp === "object")
            imageKey = dp.OriginalAchatDiamond?.id_achat;
          if (!imageKey) imageKey = row.id_fact;
          const key = String(imageKey);
          const diamond = getDiamondFromRow(row) || {};

          const cellValues = (fieldsToExport || []).map((k) => {
            const fd = fieldDefs.find((f) => f.key === k);
            let raw: any = undefined;
            if (fd) raw = (diamond as any)[fd.key];
            if (raw === undefined) raw = (row as any)[k];
            if (fd && fd.format) {
              try {
                return fd.format(raw);
              } catch {
                return String(raw ?? "");
              }
            }
            return raw == null ? "" : String(raw);
          });

          const imgs = picintToCidImages[key] || [];
          let imagesHtml = "";
          if (imgs.length > 0) {
            const visible = imgs.slice(0, 2);
            const extra = imgs.length - visible.length;
            imagesHtml =
              `<div class='img-row'>` +
              visible
                .map(
                  (p) =>
                    `<img src='cid:${p.cid}' alt='img' width='${excelImgSize}' height='${excelImgSize}' style='width:${excelImgSize}px;height:${excelImgSize}px;object-fit:cover;border-radius:4px;border:1px solid #eee;mso-width-source:userset;mso-height-source:userset;' />`
                )
                .join("") +
              (extra > 0
                ? `<div style='width:${excelImgSize}px;height:${excelImgSize}px;display:flex;align-items:center;justify-content:center;background:#f5f5f5;border:1px solid #e0e0e0;border-radius:4px;font-weight:700;'>+${extra}</div>`
                : "") +
              `</div>`;
          } else {
            imagesHtml = `<span style='color:#9e9e9e'>No Image</span>`;
          }

          // Build the row HTML
          html +=
            `<tr style="height:${rowHeight}px; mso-height-source:userset;">` +
            cellValues.map((v) => `<td>${String(v)}</td>`).join("") +
            `<td>${imagesHtml}</td></tr>`;
        }

        html += `</tbody></table><div style="margin:12px;font-size:12px;color:#666">Generated on ${new Date().toLocaleString()}</div></body></html>`;

        // Assemble MHTML
        const boundary = "----=_NextPart_000_0000";
        const EOL = "\r\n";
        let mhtml = "";
        mhtml += "MIME-Version: 1.0" + EOL;
        mhtml +=
          `Content-Type: multipart/related; boundary="${boundary}"; type="text/html"` +
          EOL +
          EOL;

        // HTML part
        mhtml += `--${boundary}` + EOL;
        mhtml += 'Content-Type: text/html; charset="utf-8"' + EOL;
        mhtml += "Content-Transfer-Encoding: 8bit" + EOL + EOL;
        mhtml += html + EOL + EOL;

        // Image parts
        allImages.forEach((img, i) => {
          mhtml += `--${boundary}` + EOL;
          mhtml += `Content-Location: file:///image${i + 1}` + EOL;
          mhtml += `Content-Transfer-Encoding: base64` + EOL;
          mhtml += `Content-Type: ${img.mime}` + EOL;
          mhtml += `Content-ID: <${img.cid}>` + EOL + EOL;
          for (let p = 0; p < img.base64.length; p += 76) {
            mhtml += img.base64.substring(p, p + 76) + EOL;
          }
          mhtml += EOL;
        });

        // Closing boundary
        mhtml += `--${boundary}--` + EOL;
        return {
          mhtml,
          diagnostics: { imageCount: globalImageCount, truncated },
        };
      };

      setExportProgress(10);
      const fieldsToExport =
        exportSelectedFields && exportSelectedFields.length
          ? exportSelectedFields
          : DIAMOND_FIELDS_ORDER.map((f) => f.key);
      const result = await generateExportMhtml(exportData, fieldsToExport);
      setExportProgress(90);
      const blob = new Blob([result.mhtml], {
        type: "application/vnd.ms-excel;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date()
        .toISOString()
        .replace(/[:T]/g, "-")
        .split(".")[0];
      a.download = `diamond_inventory_${stamp}.xls`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportProgress(100);
      setExporting(false);
      setExportDiagnostics([result.diagnostics]);
    } catch (e: any) {
      setExportError(e?.message || "Export failed");
      setExporting(false);
    }
  };

  // State for group filter: 'all' = show all, 'groups' = show only groups, 'hide' = hide groups
  const [groupFilterMode, setGroupFilterMode] = React.useState<
    "all" | "groups" | "hide"
  >("all");
  // Sort by price: 'none' | 'asc' | 'desc'
  const [priceSort, setPriceSort] = React.useState<"none" | "asc" | "desc">(
    "none"
  );
  // Order items by brand before filtering for groups
  const orderedData = React.useMemo(() => {
    const arr = [...filteredData];
    const getPriceValue = (row: InventoryItem) => {
      const diamond: any = getDiamondFromRow(row) || {};
      let cost = 0;
      if (typeof diamond.SellingPrice === "number") cost = diamond.SellingPrice;
      else if (diamond.SellingPrice != null) {
        const n = Number(String(diamond.SellingPrice).replace(/[^0-9.-]/g, ""));
        cost = isNaN(n) ? 0 : n;
      } else if (isAdmin && typeof diamond.price_per_carat === "number") {
        cost = diamond.price_per_carat;
      } else if (diamond.price_per_carat != null) {
        const n = Number(
          String(diamond.price_per_carat).replace(/[^0-9.-]/g, "")
        );
        cost = isNaN(n) ? 0 : n;
      }
      return cost;
    };

    if (priceSort && priceSort !== "none") {
      arr.sort((a, b) => {
        const pa = getPriceValue(a);
        const pb = getPriceValue(b);
        if (pa < pb) return priceSort === "asc" ? -1 : 1;
        if (pa > pb) return priceSort === "asc" ? 1 : -1;
        // fallback to brand
        const brandA = (a.Fournisseur?.client_name || "").toLowerCase();
        const brandB = (b.Fournisseur?.client_name || "").toLowerCase();
        if (brandA < brandB) return -1;
        if (brandA > brandB) return 1;
        return 0;
      });
    } else {
      arr.sort((a, b) => {
        const brandA = (a.Fournisseur?.client_name || "").toLowerCase();
        const brandB = (b.Fournisseur?.client_name || "").toLowerCase();
        if (brandA < brandB) return -1;
        if (brandA > brandB) return 1;
        return 0;
      });
    }
    return arr;
  }, [filteredData, priceSort, isAdmin]);

  const groupFilteredData = React.useMemo(() => {
    if (groupFilterMode === "all") return orderedData;
    if (groupFilterMode === "groups") {
      return orderedData.filter((row) => {
        const Unite = (row as any).Unite;
        if (
          typeof Unite === "string" &&
          Unite.startsWith("{") &&
          Unite.endsWith("}")
        ) {
          const ids = Unite.replace(/[{}]/g, "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          return ids.length > 1;
        } else if (Array.isArray(Unite)) {
          return Unite.length > 1;
        }
        return false;
      });
    }
    // hide groups => return only standalone (non-group) rows
    return orderedData.filter((row) => {
      const Unite = (row as any).Unite;
      if (
        typeof Unite === "string" &&
        Unite.startsWith("{") &&
        Unite.endsWith("}")
      ) {
        const ids = Unite.replace(/[{}]/g, "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        return ids.length <= 1;
      } else if (Array.isArray(Unite)) {
        return Unite.length <= 1;
      }
      return true;
    });
  }, [orderedData, groupFilterMode]);

  // Build grouping structure: groups (Unite with >1 ids) and standalone items
  const { groupsByKey, standaloneItems } = React.useMemo(() => {
    const groups = new Map<string, any[]>();
    const standalone: any[] = [];
    // Use groupFilteredData here so groupFilterMode takes effect
    for (const row of groupFilteredData) {
      const Unite = (row as any).Unite;
      let ids: string[] = [];
      if (
        typeof Unite === "string" &&
        Unite.startsWith("{") &&
        Unite.endsWith("}")
      ) {
        ids = Unite.replace(/[{}]/g, "")
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
      } else if (Array.isArray(Unite)) {
        ids = Unite.map((x: any) => String(x));
      }
      if (ids.length > 1) {
        // normalize group key to sorted stable string
        const key = ids.slice().sort().join("|");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      } else {
        standalone.push(row);
      }
    }
    return { groupsByKey: groups, standaloneItems: standalone };
  }, [groupFilteredData]);

  // Track expanded groups by key
  const [expandedGroups, setExpandedGroups] = React.useState<
    Record<string, boolean>
  >({});
  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  // Prefetch images for visible rows so image boxes render quickly
  React.useEffect(() => {
    (async () => {
      for (let i = 0; i < groupFilteredData.length; i++) {
        const row = groupFilteredData[i];
        let imageKey: any;
        const dp = row.DistributionPurchase;
        if (Array.isArray(dp) && dp.length > 0)
          imageKey = dp[0]?.OriginalAchatDiamond?.id_achat;
        else if (dp && typeof dp === "object")
          imageKey = dp.OriginalAchatDiamond?.id_achat;
        if (!imageKey) imageKey = row.id_fact;
        const k = String(imageKey);
        const numericKey = Number(imageKey);
        if (numericKey && !imageUrls[k] && !images[k]) {
          // fire and forget
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          fetchImages(numericKey);
        }
      }
    })();
  }, [groupFilteredData, imageUrls, images]);
  // Pagination: default 5 rows per page
  const [rowsPerPage, setRowsPerPage] = React.useState<number>(5);
  const [page, setPage] = React.useState<number>(0);

  // Build display list combining groups (as single rows) and standalone items
  const displayList = React.useMemo(() => {
    const groupsArray = Array.from(groupsByKey.entries()).map(
      ([key, items], idx) => ({ type: "group" as const, key, items, idx })
    );
    const standaloneArray = standaloneItems.map((item) => ({
      type: "item" as const,
      item,
    }));
    return [...groupsArray, ...standaloneArray];
  }, [groupsByKey, standaloneItems]);

  const totalRows = displayList.length;
  const effectiveRowsPerPage =
    rowsPerPage === -1 ? Math.max(1, totalRows) : rowsPerPage;
  const pageCount = Math.max(1, Math.ceil(totalRows / effectiveRowsPerPage));

  // Ensure current page is within range when dependencies change
  React.useEffect(() => {
    if (page >= pageCount) setPage(0);
  }, [page, pageCount]);

  const paginatedList = React.useMemo(() => {
    const start = page * effectiveRowsPerPage;
    return displayList.slice(start, start + effectiveRowsPerPage);
  }, [displayList, page, effectiveRowsPerPage]);

  // itemCount should reflect the total number of inventory items (not the number of grouped rows)
  const itemCount = filteredData.length;
  // Grouped counts lists: per Product Name (Design_art) and per Brand (supplier)
  const productCounts = React.useMemo(() => {
    const m = new Map<string, number>();
    filteredData.forEach((row) => {
      const name = String(
        (getDiamondFromRow(row) || {}).Design_art ?? ""
      ).trim();
      if (!name) return;
      m.set(name, (m.get(name) || 0) + 1);
    });
    return Array.from(m.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
    );
  }, [filteredData]);
  const brandCounts = React.useMemo(() => {
    const m = new Map<string, number>();
    filteredData.forEach((row) => {
      const name = String(row.Fournisseur?.client_name ?? "").trim();
      if (!name) return;
      m.set(name, (m.get(name) || 0) + 1);
    });
    return Array.from(m.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
    );
  }, [filteredData]);
  const [productCountsOpen, setProductCountsOpen] = React.useState(false);
  const [brandCountsOpen, setBrandCountsOpen] = React.useState(false);

  // Import GroupDialogPage
  const GroupDialogPage = React.lazy(
    () => import("../Purchase/OriginalAchat/DOPurchase/GroupDialogPage")
  );
  // Auto-select rename type based on filename
  React.useEffect(() => {
    if (!imageDialogOpen || !dialogImages.length) return;
    const url = dialogImages[dialogIndex];
    if (!url) return;
    const filename = url.split("/").pop()?.split("?")[0] || "";
    if (/invoice/i.test(filename)) {
      setRenameChoice("Invoice");
    } else if (/marketing/i.test(filename)) {
      setRenameChoice("Marketing");
    } else if (/group/i.test(filename)) {
      setRenameChoice("Group");
    } else {
      setRenameChoice(null);
    }
  }, [imageDialogOpen, dialogImages, dialogIndex]);

  return (
    <Box p={0.5}>
      {/* Edit Design_art Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Edit Product Name</DialogTitle>
        <DialogContent>
          <TextField
            sx={{ mt: 2 }}
            label="Product Name"
            value={editDesignArt}
            onChange={(e) => setEditDesignArt(e.target.value)}
            fullWidth
            autoFocus
            select
          >
            {familleList
              .filter(
                (fam) =>
                  fam.desig_famille !== "طاقم" && fam.desig_famille !== "سيت"
              )
              .map((fam) => (
                <MenuItem key={fam.id_famille} value={fam.desig_famille}>
                  {fam.desig_famille}
                </MenuItem>
              ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!editItem) return;
              setLoading(true); // Show spinner
              // Update UI immediately
              setData((prev) =>
                prev.map((item) =>
                  item.id_fact === editItem.id_fact
                    ? {
                        ...item,
                        DistributionPurchase: {
                          ...item.DistributionPurchase,
                          OriginalAchatDiamond: {
                            ...((item.DistributionPurchase &&
                              item.DistributionPurchase.OriginalAchatDiamond) ||
                              {}),
                            Design_art: editDesignArt,
                          },
                        },
                      }
                    : item
                )
              );
              setEditDialogOpen(false);
              const diamond =
                (editItem.DistributionPurchase &&
                  editItem.DistributionPurchase.OriginalAchatDiamond) ||
                {};
              // Update ACHAT (id_fact)
              try {
                const token = localStorage.getItem("token");
                if (editItem.id_fact) {
                  await axios.put(
                    `/purchases/Update/${editItem.id_fact}`,
                    { Design_art: editDesignArt },
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                }
              } catch (e) {}
              // Update OriginalAchatDiamonds (id_achat)
              try {
                if (diamond.id_achat) {
                  const token = localStorage.getItem("token");
                  await axios.put(
                    `/DOpurchases/Update/${diamond.id_achat}`,
                    { Design_art: editDesignArt },
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                }
              } catch (e) {}
              // Refresh inventory data
              try {
                await fetchData();
                //  setSnackbar({ open: true, message: success ? 'Rename successful and inventory refreshed.' : 'Rename failed.', severity: success ? 'success' : 'error' });
              } catch (e) {
                //  setSnackbar({ open: true, message: 'Refresh failed.', severity: 'error' });
              }
              setLoading(false);
            }}
            color="primary"
            variant="contained"
          >
            Save
          </Button>
          {/* Snackbar notification */}
          <Box>
            <Dialog open={snackbar.open} onClose={handleCloseSnackbar}>
              <DialogContent>
                <Typography
                  color={snackbar.severity === "error" ? "error" : "primary"}
                >
                  {snackbar.message}
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleCloseSnackbar}>Close</Button>
              </DialogActions>
            </Dialog>
          </Box>
        </DialogActions>
      </Dialog>
      <Dialog
        open={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Product Images</DialogTitle>
        {/* Image filename below title */}
        {dialogImages.length > 0 && (
          <Box sx={{ px: 3, pt: 1, pb: 0 }}>
            <Typography
              variant="caption"
              sx={{
                color: "#333",
                bgcolor: "#f5f5f5",
                px: 1,
                py: 0.5,
                borderRadius: 1,
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              {(() => {
                const url = dialogImages[dialogIndex];
                if (!url) return "";
                try {
                  const parts = url.split("/");
                  return parts[parts.length - 1].split("?")[0];
                } catch {
                  return url;
                }
              })()}
            </Typography>
          </Box>
        )}

        <DialogContent>
          {/* Rename buttons at top of dialog */}
          <Box
            sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mb: 2 }}
          >
            {renameChoice && (
              <Button
                variant="contained"
                color="success"
                size="small"
                disabled={renaming}
                sx={{ fontWeight: 700 }}
                onClick={async () => {
                  setRenaming(true);
                  setRenameError("");
                  setRenameSuccess("");
                  try {
                    // Get current filename
                    const url = dialogImages[dialogIndex];
                    if (!url) throw new Error("No image URL");
                    const filename = url.split("/").pop()?.split("?")[0] || "";
                    // Get id_achat and type from URL
                    const parts = url.split("/");
                    let type = parts[parts.length - 3];
                    let id_achat = parts[parts.length - 2];
                    // Remove extension from filename
                    const extIdx = filename.lastIndexOf(".");
                    let baseName =
                      extIdx !== -1 ? filename.substring(0, extIdx) : filename;
                    const ext = extIdx !== -1 ? filename.substring(extIdx) : "";
                    // Remove all previous suffixes (Invoice, Group, Marketing) from baseName
                    baseName = baseName.replace(
                      /-(Invoice|Group|Marketing)+/gi,
                      ""
                    );
                    const newName = `${baseName}-${renameChoice}${ext}`;
                    const token = localStorage.getItem("token");
                    const apiUrl = `/images/update-name/${type}/${id_achat}/${filename}`;
                    const res = await axios.put(
                      apiUrl,
                      { newName },
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (res.data?.success) {
                      setRenameSuccess(`Renamed to ${newName}`);
                      setRenameError("");
                      // Refresh images and update dialogImages to reflect new filenames
                      const updatedUrls = await fetchImages(Number(id_achat));
                      if (Array.isArray(updatedUrls) && updatedUrls.length) {
                        const normalized = normalizeDialogUrls(
                          updatedUrls || []
                        );
                        setDialogImages(normalized);
                        // Optionally reset dialogIndex to the renamed image (clamped)
                        const idx = updatedUrls.findIndex((u) =>
                          u.includes(newName)
                        );
                        if (idx >= 0)
                          setDialogIndex(
                            Math.min(
                              Math.max(0, idx),
                              Math.max(0, normalized.length - 1)
                            )
                          );
                      }
                    } else {
                      throw new Error(res.data?.error || "Rename failed");
                    }
                  } catch (err: any) {
                    if (err?.response?.status === 409) {
                      setRenameError(
                        "A file with this name already exists. Please choose a different rename type or try again."
                      );
                    } else {
                      setRenameError(err?.message || "Rename failed");
                    }
                    setRenameSuccess("");
                  } finally {
                    setRenaming(false);
                  }
                }}
              >
                Save
              </Button>
            )}
            <Box sx={{ flex: 1 }} />
            {["Invoice", "Group", "Marketing"].map((choice) => (
              <Button
                key={choice}
                variant={renameChoice === choice ? "contained" : "outlined"}
                color="primary"
                size="small"
                onClick={() => {
                  setRenameChoice(choice);
                  setRenameError("");
                  setRenameSuccess("");
                }}
                sx={{ fontWeight: 700 }}
              >
                {choice}
              </Button>
            ))}
          </Box>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minHeight: 400,
            }}
          >
            {/* Image / Viewer */}
            <Box
              sx={{
                position: "relative",
                overflow: "hidden",
                bgcolor: "#111",
                borderRadius: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 360,
              }}
              onMouseMove={handleMouseMove}
              onMouseLeave={endDrag}
              onMouseUp={endDrag}
            >
              {dialogImages.length ? (
                <>
                  <IconButton
                    sx={{
                      position: "absolute",
                      left: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "white",
                      bgcolor: "#0006",
                      "&:hover": { bgcolor: "#0009" },
                    }}
                    onClick={() =>
                      setDialogIndex(
                        (i) =>
                          (i - 1 + dialogImages.length) % dialogImages.length
                      )
                    }
                  >
                    {"\u2039"}
                  </IconButton>
                  <Box
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    sx={{
                      cursor:
                        zoom > 1 ? (dragging ? "grabbing" : "grab") : "default",
                      userSelect: "none",
                    }}
                  >
                    <img
                      src={dialogImages[dialogIndex]}
                      alt="Product"
                      draggable={false}
                      style={{
                        maxWidth: zoom === 1 ? "100%" : "none",
                        maxHeight: zoom === 1 ? "70vh" : "none",
                        objectFit: "contain",
                        transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                        transition: dragging
                          ? "none"
                          : "transform 0.15s ease-out",
                      }}
                    />
                  </Box>
                  <IconButton
                    sx={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "white",
                      bgcolor: "#0006",
                      "&:hover": { bgcolor: "#0009" },
                    }}
                    onClick={() =>
                      setDialogIndex((i) => (i + 1) % dialogImages.length)
                    }
                  >
                    {"\u203A"}
                  </IconButton>
                  <Typography
                    variant="caption"
                    sx={{
                      position: "absolute",
                      bottom: 8,
                      left: "50%",
                      transform: "translateX(-50%)",
                      color: "#fff",
                      px: 1,
                      py: 0.25,
                      bgcolor: "#0007",
                      borderRadius: 1,
                    }}
                  >
                    {dialogIndex + 1} / {dialogImages.length}
                  </Typography>
                  <Box
                    sx={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      display: "flex",
                      gap: 1,
                    }}
                  >
                    <IconButton
                      size="small"
                      onClick={zoomOut}
                      sx={{
                        bgcolor: "#0006",
                        color: "#fff",
                        "&:hover": { bgcolor: "#0009" },
                      }}
                    >
                      <ZoomOutIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={zoomIn}
                      sx={{
                        bgcolor: "#0006",
                        color: "#fff",
                        "&:hover": { bgcolor: "#0009" },
                      }}
                    >
                      <ZoomInIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={resetZoom}
                      sx={{
                        bgcolor: "#0006",
                        color: "#fff",
                        "&:hover": { bgcolor: "#0009" },
                      }}
                    >
                      <RestartAltIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      position: "absolute",
                      top: 36,
                      left: 8,
                      color: "#fff",
                      bgcolor: "#0007",
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                    }}
                  >
                    Zoom: {zoom.toFixed(2)}x
                  </Typography>
                  {/* Rename result message */}
                  {(renameError || renameSuccess) && (
                    <Box
                      sx={{
                        position: "absolute",
                        bottom: 56,
                        left: 16,
                        bgcolor: renameError ? "error.main" : "success.main",
                        color: "#fff",
                        px: 2,
                        py: 0.5,
                        borderRadius: 2,
                      }}
                    >
                      <Typography variant="caption">
                        {renameError || renameSuccess}
                      </Typography>
                    </Box>
                  )}
                </>
              ) : (
                <Typography color="white">No image available</Typography>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setImageDialogOpen(false);
              setRenameChoice(null);
              setRenameError("");
              setRenameSuccess("");
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: "bold" }}>
            Diamond Inventory List
          </Typography>
          {/* (PS moved to Filters panel) */}
        </Box>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Total Items: {itemCount.toLocaleString()}
          </Typography>

          <Button
            variant="outlined"
            color="primary"
            onClick={() => setProductCountsOpen(true)}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Counts by Product
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => setBrandCountsOpen(true)}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Counts by Brand
          </Button>

          <TextField
            size="small"
            select
            value={priceSort}
            onChange={(e) =>
              setPriceSort(e.target.value as "none" | "asc" | "desc")
            }
            sx={{ width: 180 }}
          >
            <MenuItem value="none">Sort: None</MenuItem>
            <MenuItem value="asc">Price: Low → High</MenuItem>
            <MenuItem value="desc">Price: High → Low</MenuItem>
          </TextField>

          <Button
            variant={groupFilterMode === "groups" ? "contained" : "outlined"}
            color="primary"
            startIcon={<LinkIcon />}
            onClick={() =>
              setGroupFilterMode((m) => (m === "groups" ? "all" : "groups"))
            }
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Show Groups Only
          </Button>

          {isAdmin && (
            <>
              <Button
                variant="contained"
                color="primary"
                onClick={() => setExportDialogOpen(true)}
                sx={{
                  borderRadius: 3,
                  textTransform: "none",
                  fontWeight: "bold",
                  px: 3,
                  py: 1,
                }}
              >
                Export Excel
              </Button>
              {/* Export Excel Dialog with filter options */}
              <Dialog
                open={exportDialogOpen}
                onClose={() => setExportDialogOpen(false)}
                maxWidth="sm"
                fullWidth
              >
                <DialogTitle>Export Excel</DialogTitle>
                <DialogContent>
                  <Box
                    sx={{
                      py: 2,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <Typography variant="body2">
                      Choose export filter:
                    </Typography>
                    <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                      <Button
                        variant={
                          exportFilterType === "all" ? "contained" : "outlined"
                        }
                        onClick={() => setExportFilterType("all")}
                      >
                        All
                      </Button>
                      <Button
                        variant={
                          exportFilterType === "brand"
                            ? "contained"
                            : "outlined"
                        }
                        onClick={() => setExportFilterType("brand")}
                      >
                        By Brand
                      </Button>
                      <Button
                        variant={
                          exportFilterType === "name" ? "contained" : "outlined"
                        }
                        onClick={() => setExportFilterType("name")}
                      >
                        By Product Name
                      </Button>
                    </Box>
                    {exportFilterType === "brand" && (
                      <TextField
                        select
                        label="Brand"
                        value={exportBrand}
                        onChange={(e) => setExportBrand(e.target.value)}
                        fullWidth
                      >
                        <MenuItem value="">Select Brand</MenuItem>
                        {distinctBrands.map((b) => (
                          <MenuItem key={b} value={b}>
                            {b}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                    {exportFilterType === "name" && (
                      <TextField
                        label="Product Name Contains"
                        value={exportName}
                        onChange={(e) => setExportName(e.target.value)}
                        fullWidth
                        placeholder="e.g. خاتم"
                      />
                    )}
                    {/* Fields checklist */}
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Fields to export
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          gap: 1,
                          alignItems: "center",
                          mt: 1,
                        }}
                      >
                        <Button
                          size="small"
                          onClick={() =>
                            setExportSelectedFields(defaultSelected)
                          }
                        >
                          Select All
                        </Button>
                        <Button
                          size="small"
                          onClick={() => setExportSelectedFields([])}
                        >
                          Clear
                        </Button>
                      </Box>
                      <FormGroup
                        row
                        sx={{ mt: 1, maxHeight: 200, overflow: "auto" }}
                      >
                        {DIAMOND_FIELDS_ORDER.map((f) => (
                          <FormControlLabel
                            key={f.key}
                            control={
                              <Checkbox
                                size="small"
                                checked={exportSelectedFields.includes(f.key)}
                                onChange={(e) => {
                                  setExportSelectedFields((prev) =>
                                    e.target.checked
                                      ? Array.from(new Set([...prev, f.key]))
                                      : prev.filter((x) => x !== f.key)
                                  );
                                }}
                              />
                            }
                            label={f.label}
                          />
                        ))}
                      </FormGroup>
                    </Box>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleExportExcel}
                      disabled={
                        exporting ||
                        (exportFilterType === "brand" && !exportBrand) ||
                        (exportFilterType === "name" && !exportName)
                      }
                      sx={{ mt: 2 }}
                    >
                      Export
                    </Button>
                    <Box sx={{ width: "100%", mt: 2 }}>
                      <Box
                        sx={{
                          width: `${exportProgress}%`,
                          height: 24,
                          bgcolor: "#eee",
                          borderRadius: 2,
                          overflow: "hidden",
                        }}
                      >
                        <Box
                          sx={{
                            width: `${exportProgress}%`,
                            height: "100%",
                            bgcolor: "primary.main",
                            transition: "width 0.3s",
                          }}
                        />
                      </Box>
                      <Typography variant="caption" sx={{ mt: 1 }}>
                        {exportProgress}%
                      </Typography>
                    </Box>
                    {exportError && (
                      <Typography color="error" sx={{ mt: 2 }}>
                        {exportError}
                      </Typography>
                    )}
                    {exportDiagnostics && exportDiagnostics.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 700 }}
                        >
                          Image export diagnostics ({exportDiagnostics.length})
                        </Typography>
                        <Box sx={{ maxHeight: 160, overflow: "auto", mt: 1 }}>
                          {exportDiagnostics.map((d, idx) => {
                            const last =
                              d.attempts && d.attempts.length
                                ? d.attempts[d.attempts.length - 1]
                                : null;
                            const statusText = last
                              ? last.ok
                                ? "embedded"
                                : last.error || last.status || "failed"
                              : "no attempts";
                            const authText =
                              d.authStrategy ||
                              (d.attempts &&
                                d.attempts[0] &&
                                d.attempts[0].method) ||
                              "unknown";
                            const displayUrl = d.fetchUrl || d.url;
                            return (
                              <Box key={idx} sx={{ mb: 0.5 }}>
                                <Typography variant="caption">
                                  {displayUrl} — {statusText} [{authText}]
                                </Typography>
                              </Box>
                            );
                          })}
                        </Box>
                      </Box>
                    )}
                  </Box>
                </DialogContent>
                <DialogActions>
                  <Button
                    onClick={() => setExportDialogOpen(false)}
                    disabled={exporting}
                  >
                    Close
                  </Button>
                </DialogActions>
              </Dialog>
            </>
          )}
        </Box>
      </Box>
      {/* Dialog: Counts by Product Name */}
      <Dialog
        open={productCountsOpen}
        onClose={() => setProductCountsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Counts by Product Name</DialogTitle>
        <DialogContent>
          {productCounts.length ? (
            <Box sx={{ maxHeight: 400, overflowY: "auto", pr: 1 }}>
              {productCounts.map(([name, count]) => (
                <Box
                  key={name}
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    py: 0.75,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ mr: 2, wordBreak: "break-word" }}
                  >
                    {name}
                  </Typography>
                  <Box
                    sx={{
                      backgroundColor: "primary.main",
                      color: "primary.contrastText",
                      px: 1,
                      py: 0.25,
                      borderRadius: 2,
                      minWidth: 36,
                      textAlign: "center",
                      fontWeight: 700,
                    }}
                  >
                    {count}
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No items to summarize.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProductCountsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      {/* Dialog: Counts by Brand */}
      <Dialog
        open={brandCountsOpen}
        onClose={() => setBrandCountsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Counts by Brand</DialogTitle>
        <DialogContent>
          {brandCounts.length ? (
            <Box sx={{ maxHeight: 400, overflowY: "auto", pr: 1 }}>
              {brandCounts.map(([name, count]) => (
                <Box
                  key={name}
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    py: 0.75,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ mr: 2, wordBreak: "break-word" }}
                  >
                    {name}
                  </Typography>
                  <Box
                    sx={{
                      backgroundColor: "secondary.main",
                      color: "secondary.contrastText",
                      px: 1,
                      py: 0.25,
                      borderRadius: 2,
                      minWidth: 36,
                      textAlign: "center",
                      fontWeight: 700,
                    }}
                  >
                    {count}
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No items to summarize.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBrandCountsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Box sx={{ display: "flex", gap: 2 }}>
        {/* Left Filter Sidebar */}
        <Box
          sx={(theme) => ({
            width: 260,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: 1.25,
            p: 1,
            borderRadius: 2,
            //bgcolor: theme.palette.mode === 'dark' ? '#1f2937' : '#f8fafc',
            border: `1px solid ${theme.palette.divider}`,
          })}
        >
          {/* Removed image filter buttons from top of sidebar */}
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            Filters
          </Typography>
          {/* PS Autocomplete placed in Filters panel */}
          <Box>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, display: "block", mb: 0.5 }}
            >
              PS
            </Typography>
            <Box>
              <TextField
                select
                size="small"
                fullWidth
                value={psInput || ""}
                onChange={(e) => {
                  const v = e.target.value || "";
                  if (v === "") {
                    setPsInput("");
                    setPsFilter("");
                    try {
                      localStorage.removeItem("ps");
                    } catch {}
                  } else {
                    setPsInput(String(v));
                    // Map label -> id when possible; otherwise send label
                    const mapped =
                      psLabelToIdRef.current[String(v)] || String(v);
                    setPsFilter(String(mapped));
                    try {
                      localStorage.setItem("ps", String(mapped));
                    } catch {}
                  }
                }}
              >
                <MenuItem value="">All</MenuItem>
                {psOptions.map((p) => (
                  <MenuItem key={p} value={p}>
                    {p}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </Box>
          {/* Brand */}
          <Box>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, display: "block", mb: 0.5 }}
            >
              Brand
            </Typography>
            <TextField
              select
              size="small"
              fullWidth
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
            >
              <MenuItem value="">All Brands</MenuItem>
              {distinctBrands.map((b) => (
                <MenuItem key={b} value={b}>
                  {b}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          {/* Product Name */}
          <Box>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, display: "block", mb: 0.5 }}
            >
              Product Name
            </Typography>
            <TextField
              size="small"
              fullWidth
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. خاتم"
            />
          </Box>
          {/* Ref Code */}
          <Box>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, display: "block", mb: 0.5 }}
            >
              Ref Code
            </Typography>
            <TextField
              size="small"
              fullWidth
              value={refCode}
              onChange={(e) => setRefCode(e.target.value)}
              placeholder="e.g., HP123"
            />
          </Box>
          {/* Sales Code */}
          <Box>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, display: "block", mb: 0.5 }}
            >
              Sales Code
            </Typography>
            <TextField
              size="small"
              fullWidth
              value={salesCode}
              onChange={(e) => setSalesCode(e.target.value)}
              placeholder="e.g., 456"
            />
          </Box>
          {/* Cost Range */}
          <Box>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, display: "block", mb: 0.5 }}
            >
              Cost (Selling Price)
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                size="small"
                type="number"
                fullWidth
                value={costMin}
                onChange={(e) => setCostMin(e.target.value)}
                placeholder="Min"
              />
              <TextField
                size="small"
                type="number"
                fullWidth
                value={costMax}
                onChange={(e) => setCostMax(e.target.value)}
                placeholder="Max"
              />
            </Box>
          </Box>

          {/* Group Filter: All / Show Groups Only / Hide Groups */}
          <Box>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, display: "block", mb: 0.5 }}
            >
              Groups
            </Typography>
            <TextField
              select
              size="small"
              fullWidth
              value={groupFilterMode}
              onChange={(e) =>
                setGroupFilterMode(e.target.value as "all" | "groups" | "hide")
              }
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="groups">Show Groups Only</MenuItem>
              <MenuItem value="hide">Hide Groups</MenuItem>
            </TextField>
          </Box>

          <Typography
            variant="caption"
            sx={{ fontWeight: 700, display: "block", mb: 0.5 }}
          >
            Filter Images By
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 2 }}>
            <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
              {["Marketing", "Invoice"].map((type) => (
                <Button
                  key={type}
                  variant={imageTypeFilter === type ? "contained" : "outlined"}
                  color="primary"
                  size="small"
                  onClick={() =>
                    setImageTypeFilter(imageTypeFilter === type ? "" : type)
                  }
                  sx={{
                    fontWeight: 600,
                    minWidth: 60,
                    px: 1,
                    py: 0.25,
                    fontSize: 12,
                  }}
                >
                  {type}
                </Button>
              ))}

              {["Other"].map((type) => (
                <Button
                  key={type}
                  variant={imageTypeFilter === type ? "contained" : "outlined"}
                  color="primary"
                  size="small"
                  onClick={() =>
                    setImageTypeFilter(imageTypeFilter === type ? "" : type)
                  }
                  sx={{
                    fontWeight: 600,
                    minWidth: 60,
                    px: 1,
                    py: 0.25,
                    fontSize: 12,
                  }}
                >
                  {type === "Other" ? "Other" : type}
                </Button>
              ))}
            </Box>
          </Box>

          <Button
            variant="contained"
            onClick={() => {
              setBrandFilter("");
              setProductName("");
              setRefCode("");
              setSalesCode("");
              setCostMin("");
              setCostMax("");
              setGroupFilterMode("all");
            }}
            sx={{ fontWeight: 700 }}
          >
            Reset Filters
          </Button>
          {/* Image Type Filter Buttons (Bottom) */}
        </Box>
        {/* Table Area */}
        <Box sx={{ flex: 1 }}>
          {/* Flat list view (mapped) */}
          {loading ? (
            <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
              <CircularProgress />
            </Box>
          ) : itemCount === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No items
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {/* Paginated list (groups + standalone items) */}
              {paginatedList.map((entry: any) => {
                if (entry.type === "group") {
                  const key = entry.key;
                  const items = entry.items as any[];
                  const idx = entry.idx as number;
                  // palette for group borders (cycled). We no longer use a background for the header.
                  const borderPalette = [
                    "#1976d2",
                    "#ff8a65",
                    "#43a047",
                    "#fb8c00",
                    "#7b1fa2",
                    "#d81b60",
                  ];
                  const borderColor = borderPalette[idx % borderPalette.length];
                  // Determine a display image for the group: prefer any 'group' image from first item's imageUrls
                  const first = items[0];
                  let imageKey: any;
                  const dp = first.DistributionPurchase;
                  if (Array.isArray(dp) && dp.length > 0)
                    imageKey = dp[0]?.OriginalAchatDiamond?.id_achat;
                  else if (dp && typeof dp === "object")
                    imageKey = dp.OriginalAchatDiamond?.id_achat;
                  if (!imageKey) imageKey = first.id_fact;
                  const k = String(imageKey);
                  const urls = (imageUrls[k] || []).slice();
                  // Prefer group images
                  const groupImgs = urls.filter((u) =>
                    /group/i.test(u.split("/").pop() || "")
                  );
                  const token = localStorage.getItem("token");
                  const displayImgRaw = groupImgs.length
                    ? groupImgs[0]
                    : urls.find(
                        (u) => !/PIC/i.test(u.split("/").pop() || "")
                      ) || urls[0];
                  const displayImg =
                    displayImgRaw && token && !displayImgRaw.includes("token=")
                      ? displayImgRaw +
                        (displayImgRaw.includes("?") ? "&" : "?") +
                        "token=" +
                        encodeURIComponent(token)
                      : displayImgRaw;
                  // Compute total price and brand(s)
                  let total = 0;
                  const brands = new Set<string>();
                  for (const r of items) {
                    const d = getDiamondFromRow(r) || {};
                    const p =
                      typeof d.SellingPrice === "number"
                        ? d.SellingPrice
                        : Number(
                            String(d.SellingPrice || "").replace(
                              /[^0-9.-]/g,
                              ""
                            )
                          );
                    if (!isNaN(p)) total += p;
                    if (r.Fournisseur?.client_name)
                      brands.add(r.Fournisseur.client_name);
                  }
                  const brandDisplay = Array.from(brands).join(", ");
                  // Group title (General_Comment) - prefer the comment from the first item if present
                  const groupTitle =
                    items[0] && items[0].General_Comment
                      ? String(items[0].General_Comment).trim()
                      : "";
                  const expanded = !!expandedGroups[key];
                  return (
                    <Box
                      key={`group-${key}`}
                      sx={{
                        border: "2px solid",
                        borderColor: borderColor,
                        borderRadius: 1,
                        overflow: "hidden",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                        mb: 1,
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                          p: 1.25,
                          backgroundColor: "transparent",
                        }}
                      >
                        <Box
                          sx={{
                            width: 92,
                            height: 92,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {displayImg ? (
                            <Box
                              component="img"
                              src={displayImg}
                              alt="group-img"
                              loading="lazy"
                              onClick={() => {
                                // Build group image list preferring images containing 'group'
                                const allGroupImgs: string[] = [];
                                const allOtherImgs: string[] = [];
                                for (const r of items) {
                                  let ik: any;
                                  const dpp = r.DistributionPurchase;
                                  if (Array.isArray(dpp) && dpp.length > 0)
                                    ik = dpp[0]?.OriginalAchatDiamond?.id_achat;
                                  else if (dpp && typeof dpp === "object")
                                    ik = dpp.OriginalAchatDiamond?.id_achat;
                                  if (!ik) ik = r.id_fact;
                                  const kk2 = String(ik);
                                  const ulist = imageUrls[kk2] || [];
                                  ulist.forEach((u) => {
                                    const fname = u.split("/").pop() || "";
                                    if (/group/i.test(fname))
                                      allGroupImgs.push(u);
                                    else allOtherImgs.push(u);
                                  });
                                }
                                const chosen = allGroupImgs.length
                                  ? Array.from(new Set(allGroupImgs))
                                  : Array.from(new Set(allOtherImgs));
                                const tokenLocal =
                                  localStorage.getItem("token");
                                const mapped = chosen.map((u) => {
                                  const out =
                                    tokenLocal && !u.includes("token=")
                                      ? u +
                                        (u.includes("?") ? "&" : "?") +
                                        "token=" +
                                        encodeURIComponent(tokenLocal)
                                      : u;
                                  return ensureHttpsSystemGaja(out);
                                });
                                {
                                  console.debug(
                                    "DInventory.openDialog (group-click) raw mapped:",
                                    { key, rawMapped: mapped }
                                  );
                                  const normalized = normalizeDialogUrls(
                                    mapped || []
                                  );
                                  const clampedIndex = Math.min(
                                    Math.max(0, 0),
                                    Math.max(0, normalized.length - 1)
                                  );
                                  const urlInfo = normalized.map((u) => {
                                    try {
                                      const p = new URL(u);
                                      return { url: u, hostname: p.hostname };
                                    } catch {
                                      return { url: u, hostname: null };
                                    }
                                  });
                                  console.debug(
                                    "DInventory.openDialog (group-click) normalized:",
                                    { key, clampedIndex, normalized, urlInfo }
                                  );
                                  setDialogImages(normalized);
                                  setDialogIndex(clampedIndex);
                                  setImageDialogOpen(true);
                                }
                              }}
                              sx={{
                                maxHeight: 88,
                                maxWidth: 88,
                                border: "1px solid #ccc",
                                borderRadius: 2,
                                objectFit: "contain",
                                cursor: "pointer",
                              }}
                            />
                          ) : (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              No Image
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          {/* First row: group title, item count and inline chips (horizontal scroll if overflowing) */}
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              width: "100%",
                            }}
                          >
                            {groupTitle ? (
                              <Typography
                                variant="subtitle2"
                                sx={{
                                  fontWeight: 700,
                                  color: "primary.main",
                                  whiteSpace: "nowrap",
                                  mr: 1,
                                }}
                              >
                                {groupTitle}
                              </Typography>
                            ) : null}
                            {
                              // Compute PS label(s) for this group (unique values)
                              (() => {
                                const psSet = new Set<string>();
                                for (const r of items) {
                                  const lbl = getPsLabelFromRow(r);
                                  if (lbl) psSet.add(lbl);
                                }
                                const labels =
                                  Array.from(psSet).filter(Boolean);
                                const groupPsLabel =
                                  labels.length === 0 ? "-" : labels.join(", ");
                                return (
                                  <Box
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1,
                                    }}
                                  >
                                    <Typography
                                      variant="h6"
                                      sx={{
                                        fontWeight: 800,
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {items.length} items
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      sx={{ color: "text.secondary" }}
                                    >
                                      PS: {groupPsLabel}
                                    </Typography>
                                  </Box>
                                );
                              })()
                            }
                            <Box
                              sx={{
                                display: "flex",
                                gap: 1,
                                overflowX: "auto",
                                py: 0.25,
                                px: 0.25,
                                "&::-webkit-scrollbar": { height: 6 },
                                flex: 1,
                              }}
                            >
                              {items.slice(0, 12).map((r: any) => {
                                const d = getDiamondFromRow(r) || {};
                                const ref =
                                  d?.CODE_EXTERNAL ||
                                  d?.reference_number ||
                                  String(r.id_fact);
                                return (
                                  <Chip
                                    key={String(r.id_fact)}
                                    label={String(ref)}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                      fontSize: 12,
                                      height: 26,
                                      borderColor: borderColor,
                                    }}
                                  />
                                );
                              })}
                              {items.length > 12 && (
                                <Chip
                                  label={`+${items.length - 12} more`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: 12, height: 26 }}
                                />
                              )}
                            </Box>
                          </Box>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 0.25 }}
                          >
                            {brandDisplay || "-"}
                          </Typography>
                          <Typography
                            variant="subtitle1"
                            sx={{
                              fontWeight: 800,
                              color: "warning.main",
                              mt: 0.5,
                            }}
                          >
                            {formatUSD(total)}
                          </Typography>
                        </Box>
                        <Box>
                          <Button
                            variant="outlined"
                            onClick={() => toggleGroup(key)}
                          >
                            {expanded ? "Collapse" : "Expand"}
                          </Button>
                        </Box>
                      </Box>
                      {expanded && (
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 1,
                            p: 1,
                          }}
                        >
                          {items.map((row: any) => {
                            const diamond = getDiamondFromRow(row) || {};
                            let imageKey2: any;
                            const dp2 = row.DistributionPurchase;
                            if (Array.isArray(dp2) && dp2.length > 0)
                              imageKey2 =
                                dp2[0]?.OriginalAchatDiamond?.id_achat;
                            else if (dp2 && typeof dp2 === "object")
                              imageKey2 = dp2.OriginalAchatDiamond?.id_achat;
                            if (!imageKey2) imageKey2 = row.id_fact;
                            const kk = String(imageKey2);
                            let urls2 = imageUrls[kk] || [];
                            urls2 = filterImageUrlsByType(
                              urls2,
                              imageTypeFilter
                            );
                            let filteredUrls2 = urls2.filter(
                              (u) => !/group/i.test(u.split("/").pop() || "")
                            );
                            filteredUrls2 = filterImageUrlsByType(
                              filteredUrls2,
                              imageTypeFilter
                            );
                            let defaultIdx2 = -1;
                            for (
                              let i = filteredUrls2.length - 1;
                              i >= 0;
                              i--
                            ) {
                              if (
                                !/PIC/i.test(
                                  filteredUrls2[i].split("/").pop() || ""
                                )
                              ) {
                                defaultIdx2 = i;
                                break;
                              }
                            }
                            if (defaultIdx2 === -1 && filteredUrls2.length)
                              defaultIdx2 = 0;
                            const openDialog2 = () => {
                              let list = images[kk];
                              if (!list || !list.length) {
                                list = filteredUrls2.map((u) => {
                                  if (!token) return u;
                                  return u.includes("token=")
                                    ? u
                                    : u +
                                        (u.includes("?") ? "&" : "?") +
                                        "token=" +
                                        encodeURIComponent(token);
                                });
                              }
                              {
                                const normalized = normalizeDialogUrls(
                                  list || []
                                );
                                const clampedIndex = Math.min(
                                  Math.max(0, defaultIdx2),
                                  Math.max(0, normalized.length - 1)
                                );
                                console.debug(
                                  "DInventory.openDialog (group item):",
                                  { kk, defaultIdx2, clampedIndex, normalized }
                                );
                                setDialogImages(normalized);
                                setDialogIndex(clampedIndex);
                                setImageDialogOpen(true);
                              }
                            };
                            return (
                              <Box
                                key={row.id_fact}
                                sx={{
                                  display: "flex",
                                  gap: 2,
                                  alignItems: "flex-start",
                                  p: 1,
                                  borderBottom: "1px dashed",
                                  borderColor: "divider",
                                }}
                              >
                                <Box
                                  sx={{
                                    width: 72,
                                    height: 72,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  {defaultIdx2 === -1 ? (
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      No Image
                                    </Typography>
                                  ) : (
                                    <Box
                                      component="img"
                                      onClick={openDialog2}
                                      src={(() => {
                                        let u = filteredUrls2[defaultIdx2];
                                        if (u && token && !u.includes("token="))
                                          u +=
                                            (u.includes("?") ? "&" : "?") +
                                            "token=" +
                                            encodeURIComponent(token);
                                        u = ensureHttpsSystemGaja(u);
                                        return u;
                                      })()}
                                      alt="img"
                                      loading="lazy"
                                      sx={{
                                        maxHeight: 68,
                                        maxWidth: 68,
                                        border: "1px solid #ccc",
                                        borderRadius: 2,
                                        objectFit: "contain",
                                        cursor: "pointer",
                                      }}
                                    />
                                  )}
                                </Box>
                                <Box sx={{ minWidth: 120 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 600 }}
                                  >
                                    {diamond?.CODE_EXTERNAL ||
                                      diamond?.reference_number ||
                                      row.id_fact}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {row.Fournisseur?.client_name || "-"}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    PS: {getPsLabelFromRow(row) || "-"}
                                  </Typography>
                                  {(() => {
                                    const raw = diamond?.SellingPrice;
                                    const val = formatUSD(
                                      raw === null ||
                                        raw === undefined ||
                                        raw === ""
                                        ? 0
                                        : raw
                                    );
                                    return (
                                      <Typography
                                        variant="subtitle2"
                                        sx={{
                                          fontWeight: 800,
                                          color: "warning.main",
                                          mt: 0.25,
                                        }}
                                      >
                                        {val}
                                      </Typography>
                                    );
                                  })()}
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                  {(() => {
                                    const f = fieldsToShow.find(
                                      (ff) => ff.key === "Design_art"
                                    );
                                    if (!f) return null;
                                    const raw = diamond[f.key];
                                    if (
                                      raw === null ||
                                      raw === undefined ||
                                      raw === ""
                                    )
                                      return null;
                                    const val = f.format ? f.format(raw) : raw;
                                    return (
                                      <Box
                                        sx={{
                                          width: "100%",
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 1,
                                        }}
                                      >
                                        <Typography
                                          variant="subtitle1"
                                          sx={{
                                            fontWeight: 800,
                                            color: "warning.main",
                                          }}
                                        >
                                          <b>{f.label}:</b> {String(val)}
                                        </Typography>
                                        <IconButton
                                          size="small"
                                          color="primary"
                                          onClick={() => {
                                            setEditItem(row);
                                            setEditDesignArt(val || "");
                                            setEditDialogOpen(true);
                                          }}
                                        >
                                          <EditIcon />
                                        </IconButton>
                                      </Box>
                                    );
                                  })()}
                                  {fieldsToShow
                                    .filter(
                                      (f) =>
                                        f.key !== "Design_art" &&
                                        f.key !== "SellingPrice"
                                    )
                                    .map((f) => {
                                      const raw = diamond[f.key];
                                      if (
                                        raw === null ||
                                        raw === undefined ||
                                        raw === ""
                                      )
                                        return null;
                                      let val: any = f.format
                                        ? f.format(raw)
                                        : raw;
                                      if (f.key === "price_per_carat") {
                                        const cur = diamond?.currencyRetail;
                                        if (cur) val = `${val} ${cur}`;
                                      }
                                      return (
                                        <Typography
                                          key={f.key}
                                          variant="caption"
                                        >
                                          <b>{f.label}:</b> {String(val)}
                                        </Typography>
                                      );
                                    })}
                                </Box>
                              </Box>
                            );
                          })}
                        </Box>
                      )}
                    </Box>
                  );
                }
                // item
                const row = entry.item as any;
                const diamond = getDiamondFromRow(row) || {};
                let imageKey: any;
                const dp = row.DistributionPurchase;
                if (Array.isArray(dp) && dp.length > 0)
                  imageKey = dp[0]?.OriginalAchatDiamond?.id_achat;
                else if (dp && typeof dp === "object")
                  imageKey = dp.OriginalAchatDiamond?.id_achat;
                if (!imageKey) imageKey = row.id_fact;
                const k = String(imageKey);
                let urls = imageUrls[k] || [];
                urls = filterImageUrlsByType(urls, imageTypeFilter);
                const token = localStorage.getItem("token");
                let filteredUrls = urls.filter(
                  (u) => !/group/i.test(u.split("/").pop() || "")
                );
                filteredUrls = filterImageUrlsByType(
                  filteredUrls,
                  imageTypeFilter
                );
                let defaultIdx = -1;
                for (let i = filteredUrls.length - 1; i >= 0; i--) {
                  if (!/PIC/i.test(filteredUrls[i].split("/").pop() || "")) {
                    defaultIdx = i;
                    break;
                  }
                }
                if (defaultIdx === -1 && filteredUrls.length) defaultIdx = 0;
                const openDialog = () => {
                  let list = images[k];
                  if (!list || !list.length) {
                    list = filteredUrls.map((u) => {
                      if (!token) return u;
                      return u.includes("token=")
                        ? u
                        : u +
                            (u.includes("?") ? "&" : "?") +
                            "token=" +
                            encodeURIComponent(token);
                    });
                  }
                  {
                    const normalized = normalizeDialogUrls(list || []);
                    setDialogImages(normalized);
                    setDialogIndex(
                      Math.min(
                        Math.max(0, defaultIdx),
                        Math.max(0, normalized.length - 1)
                      )
                    );
                    setImageDialogOpen(true);
                  }
                };

                const generalComment = row.General_Comment;
                return (
                  <Box
                    key={row.id_fact}
                    sx={{
                      display: "flex",
                      gap: 2,
                      alignItems: "flex-start",
                      p: 1,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Box
                      sx={{
                        width: 88,
                        height: 88,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {defaultIdx === -1 ? (
                        <Typography variant="caption" color="text.secondary">
                          No Image
                        </Typography>
                      ) : (
                        <Box
                          component="img"
                          onClick={openDialog}
                          src={(() => {
                            let u = filteredUrls[defaultIdx];
                            if (u && token && !u.includes("token="))
                              u +=
                                (u.includes("?") ? "&" : "?") +
                                "token=" +
                                encodeURIComponent(token);
                            return u;
                          })()}
                          alt="img"
                          loading="lazy"
                          sx={{
                            maxHeight: 84,
                            maxWidth: 84,
                            border: "1px solid #ccc",
                            borderRadius: 2,
                            objectFit: "contain",
                            cursor: "pointer",
                          }}
                        />
                      )}
                    </Box>
                    <Box sx={{ minWidth: 140 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {diamond?.CODE_EXTERNAL ||
                          diamond?.reference_number ||
                          row.id_fact}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.Fournisseur?.client_name || "-"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        PS: {getPsLabelFromRow(row) || "-"}
                      </Typography>
                      {/* Selling Price shown with Ref & Brand to keep key info together */}
                      {(() => {
                        const raw = diamond?.SellingPrice;
                        const val = formatUSD(
                          raw === null || raw === undefined || raw === ""
                            ? 0
                            : raw
                        );
                        return (
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: 800,
                              color: "warning.main",
                              mt: 0.25,
                            }}
                          >
                            {" "}
                            {val}
                          </Typography>
                        );
                      })()}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      {generalComment && generalComment.trim() !== "" && (
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 700,
                            color: "primary.main",
                            mb: 0.5,
                          }}
                        >
                          <b>Group Name:</b> {generalComment}
                        </Typography>
                      )}
                      {(() => {
                        const f = fieldsToShow.find(
                          (ff) => ff.key === "Design_art"
                        );
                        if (!f) return null;
                        const raw = diamond[f.key];
                        if (raw === null || raw === undefined || raw === "")
                          return null;
                        const val = f.format ? f.format(raw) : raw;
                        return (
                          <Box
                            sx={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 800, color: "warning.main" }}
                            >
                              <b>{f.label}:</b> {String(val)}
                            </Typography>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => {
                                setEditItem(row);
                                setEditDesignArt(val || "");
                                setEditDialogOpen(true);
                              }}
                            >
                              <EditIcon />
                            </IconButton>
                          </Box>
                        );
                      })()}
                      {fieldsToShow
                        .filter(
                          (f) =>
                            f.key !== "Design_art" && f.key !== "SellingPrice"
                        )
                        .map((f) => {
                          const raw = diamond[f.key];
                          if (raw === null || raw === undefined || raw === "")
                            return null;
                          let val: any = f.format ? f.format(raw) : raw;
                          if (f.key === "price_per_carat") {
                            const cur = diamond?.currencyRetail;
                            if (cur) val = `${val} ${cur}`;
                          }
                          return (
                            <Typography key={f.key} variant="caption">
                              <b>{f.label}:</b> {String(val)}
                            </Typography>
                          );
                        })}
                      {/* Selling Price moved to the Ref/Brand column */}
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      {/* no group icon for standalone */}
                    </Box>
                  </Box>
                );
              })}
              {/* Footer: pagination controls */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 1,
                  mt: 1,
                }}
              >
                <Typography variant="caption">Rows per page:</Typography>
                <TextField
                  size="small"
                  select
                  value={rowsPerPage}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setRowsPerPage(v);
                    setPage(0);
                  }}
                  sx={{ width: 110 }}
                >
                  <MenuItem value={5}>5</MenuItem>
                  <MenuItem value={12}>12</MenuItem>
                  <MenuItem value={24}>24</MenuItem>
                  <MenuItem value={48}>48</MenuItem>
                  <MenuItem value={-1}>All</MenuItem>
                </TextField>
                <Button
                  size="small"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page <= 0}
                >
                  Prev
                </Button>
                <Typography variant="caption">
                  {page + 1} / {pageCount}
                </Typography>
                <Button
                  size="small"
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={page >= pageCount - 1}
                >
                  Next
                </Button>
              </Box>
            </Box>
          )}
          {/* Group Dialog */}
          <React.Suspense fallback={null}>
            {groupDialogOpen && (
              <GroupDialogPage
                open={groupDialogOpen}
                onClose={() => setGroupDialogOpen(false)}
                groupName={groupDialogName}
                items={groupDialogItems}
                imageUrls={imageUrls}
              />
            )}
          </React.Suspense>
        </Box>
      </Box>
    </Box>
  );
};

export default DInventory;
