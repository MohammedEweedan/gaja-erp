import { useEffect, useState, useMemo, useCallback } from "react";
import axios from "../api";
import { useNavigate } from "react-router-dom";
import {
  Box,
  IconButton,
  Tooltip,
  Button,
  Typography,
  TextField,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
} from "@mui/material";

import ImportExportIcon from "@mui/icons-material/ImportExport";
// Replacing simple XLSX export with MHTML (Excel-compatible) export including embedded images (mirrors DInventory approach)
// (ExcelJS path omitted to keep dependency footprint small)
import PhotoIcon from "@mui/icons-material/Photo";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import EditIcon from "@mui/icons-material/Edit";
// Removed manual refresh icon (auto reactive updates)
import { MenuItem } from "@mui/material";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";

type InventoryItem = {
  id_fact: number;
  Design_art: string;
  qty: number;
  qty_difference: number;
  ps?: number | string | null;
  date_fact?: string; // purchase date for seniority filtering
  Fournisseur: {
    client_name: string;
    code_supplier: string;
    TYPE_SUPPLIER: string;
  };
  user: {
    name_user: string;
    email: string;
  };
  id_art?: number; // Added for image reference
};

type PointOfSaleOption = {
  id: string;
  label: string;
};

interface Props {
  Type?: string;
}

const GInventory = (props: Props) => {
  const { Type = "Gold" } = props;
  let ps: string | null = null;
  const userStr = localStorage.getItem("user");
  if (userStr) {
    try {
      const userObj = JSON.parse(userStr);
      ps = userObj.ps ?? localStorage.getItem("ps");
    } catch {
      ps = localStorage.getItem("ps");
    }
  } else {
    ps = localStorage.getItem("ps");
  }
  const [data, setData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Live gold price (free API: metals.live)
  const [goldLoading, setGoldLoading] = useState(false);
  const [goldPrice, setGoldPrice] = useState<{
    usdPerOz?: number;
    usdPerGram?: number;
    updatedAt?: Date;
    source?: string;
    error?: string;
  } | null>(null);

  const [images, setImages] = useState<Record<number, string>>({});
  // Export dialog state (similar to DInventory)
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFilterType, setExportFilterType] = useState<"all" | "brand" | "name">("all");
  const [exportBrand, setExportBrand] = useState("");
  const [exportName, setExportName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState("");
  const [psOptions, setPsOptions] = useState<PointOfSaleOption[]>([]);
  const [psDialogOpen, setPsDialogOpen] = useState(false);
  const [psDialogItem, setPsDialogItem] = useState<InventoryItem | null>(null);
  const [psSelection, setPsSelection] = useState("");
  const [psDialogError, setPsDialogError] = useState("");
  const [psSaving, setPsSaving] = useState(false);
  const canChangePs = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const obj = JSON.parse(raw);
        const currentId =
          obj?.Cuser  
          
        if (currentId != null && String(currentId) === "68") return true;
      }
    } catch {}
    try {
      const fallback = localStorage.getItem("Cuser");
      if (fallback != null && String(fallback) === "68") return true;
    } catch {}
    return false;
  }, []);
  const navigate = useNavigate();
  const apiIp = process.env.REACT_APP_API_IP;
  const apiUrl = `${apiIp}/Inventory`;

  // Parse purity factor from a brand type string (e.g., "21K" -> 0.875)
  const parsePurityFactorFromType = useCallback((raw?: string): number | null => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    const lower = s.toLowerCase();
    // Common markers indicating karat context
    const hasKaratMarker = /(\bkarat\b|\bkt\b|\bct\b|k\b|\bk\b|عيار|قيراط)/i.test(lower);

    // 1) Try percentage like "91.6%" or "91.7 %"
    const pctMatch = lower.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*%/);
    if (pctMatch) {
      const n = Number(pctMatch[1].replace(",", "."));
      if (!Number.isNaN(n) && n > 0 && n <= 100) return n / 100;
    }

    // 2) Try explicit karat pattern like "21k" / "18 k" / "22 karat" / "21 ct"
    const karatMatch = lower.match(/(\d{1,2})\s*(k|karat|ct|عيار|قيراط)\b/);
    if (karatMatch) {
      const k = Number(karatMatch[1]);
      if (!Number.isNaN(k) && k >= 1 && k <= 24) return k / 24;
    }

    // 3) Fallback: any number 8..24 in a context that likely denotes karat (has markers elsewhere or contains word gold)
    const anyNum = lower.match(/\b(\d{1,2})\b/);
    if (anyNum) {
      const n = Number(anyNum[1]);
      if (!Number.isNaN(n) && n >= 8 && n <= 24 && (hasKaratMarker || /gold|ذهب/i.test(lower))) {
        return n / 24;
      }
    }
    return null;
  }, []);

  // Ensure image URLs use https and the production host for /images/* resources
  const ensureHttpsSystemGaja = (u?: string | null): string => {
    if (!u) return "";
    const fallback = String(u || "");
    try {
      const s = String(u);
      if (/^blob:|^data:/i.test(s)) return s;
      // Try to parse as URL; if relative, base it on current origin so we can inspect pathname
      let parsed: URL;
      try {
        parsed = new URL(s, window.location.origin);
      } catch {
        // Not a URL; if it looks like images/<path>, force absolute on prod host
        const rel = s.replace(/^\/+/, "");
        if (/^images\//i.test(rel)) return `http://localhost:9000/${rel}`;
        return s;
      }

      const pathname = parsed.pathname || "";
      const pathAndQuery = pathname + (parsed.search || "") + (parsed.hash || "");
      const hostLower = (parsed.hostname || "").toLowerCase();
      const isHttp = parsed.protocol === "http:";

      // If this is an images or uploads route, always pin to prod host over https
      if (/^\/(images|uploads)\//i.test(pathname)) {
        return `http://localhost:9000${pathAndQuery}`;
      }
      // If host already system.gaja.ly, ensure https
      if (/^system\.gaja\.ly$/i.test(hostLower)) {
        return `https://${parsed.host}${pathAndQuery}`;
      }
      // If protocol is http and likely came from backend self-host (IP/localhost), upgrade to https when possible
      if (isHttp) {
        // Prefer keeping same host but upgrading to https if it matches prod domain, otherwise leave as-is
        if (/^system\.gaja\.ly$/i.test(hostLower)) {
          return `https://${parsed.host}${pathAndQuery}`;
        }
        // For unknown hosts that still reference images path, handled above; otherwise just switch scheme
        return `https://${parsed.host}${pathAndQuery}`;
      }
      // Default: return as absolute string
      return `${parsed.protocol}//${parsed.host}${pathAndQuery}`;
    } catch {
      return fallback;
    }
  };

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/");

    try {
      const response = await axios.get<InventoryItem[]>(`${apiUrl}/allActive`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { ps, type_supplier: Type },
      });
      setData(response.data);

   
    } catch (error: any) {
      if (error.response?.status === 401) navigate("/");
     
    } finally {
      setLoading(false);
    }
  }, [navigate, ps, Type, apiUrl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch live gold price from a free API (metals.live)
  const fetchGoldPrice = useCallback(async () => {
    try {
      setGoldLoading(true);
      // Use backend proxy to avoid CORS and centralize fallbacks
      const base = (process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_IP || "http://localhost:9000/api").replace(/\/+$/,'');
      let success = false;
      let lastErr: any = null;
      const results: Array<{usdPerOz:number;usdPerGram:number;source:string;updatedAt:Date}> = [];

      // 1) Proxy attempt
      try {
        const r = await fetch(base + "/external/gold-spot", { method: "GET", credentials: "include" });
        if (r.ok) {
          const data = await r.json();
          if (data && typeof data.usdPerOz === "number" && data.usdPerOz > 0) {
            results.push({
              usdPerOz: data.usdPerOz,
              usdPerGram: typeof data.usdPerGram === 'number' ? data.usdPerGram : data.usdPerOz/31.1034768,
              source: data.source || 'proxy',
              updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
            });
            success = true;
          } else {
            lastErr = new Error('Proxy returned no numeric usdPerOz');
          }
        } else {
          lastErr = new Error(`Proxy HTTP ${r.status}`);
        }
      } catch (e:any) { lastErr = e; }

      // Helper for external fetch (metals.live spot gold)
      const tryMetalsLive = async () => {
        try {
          const r2 = await fetch("https://api.metals.live/v1/spot/gold", { method: 'GET' });
          if (!r2.ok) throw new Error(`metals.live HTTP ${r2.status}`);
            const arr = await r2.json();
            if (Array.isArray(arr)) {
              let price: number | null = null;
              for (let i = arr.length - 1; i >= 0; i--) {
                const it = arr[i];
                if (it && typeof it === 'object' && 'price' in it) {
                  const p = Number(it.price); if (!Number.isNaN(p) && p>0){ price=p; break; }
                } else if (Array.isArray(it) && it.length >= 2) {
                  const p = Number(it[1]); if (!Number.isNaN(p) && p>0){ price=p; break; }
                }
              }
              if (price) {
                results.push({ usdPerOz: price, usdPerGram: price/31.1034768, source: 'metals.live', updatedAt: new Date() });
                return true;
              }
            }
        } catch (e:any) { lastErr = e; }
        return false;
      };

      // 2) External fallback if proxy failed
      if (!success) success = await tryMetalsLive();

      // 3) goldprice.org fallback
      const tryGoldPriceOrg = async () => {
        try {
          const r3 = await fetch("https://data-asg.goldprice.org/dbXRates/USD", { method:'GET' });
          if (!r3.ok) throw new Error(`goldprice.org HTTP ${r3.status}`);
          const data3 = await r3.json();
          const items = data3 && data3.items;
          if (Array.isArray(items) && items.length) {
            const p = Number(items[0].xauPrice || items[0].xauPrice24h || items[0].xauPricel3m);
            if (!Number.isNaN(p) && p > 0) {
              results.push({ usdPerOz: p, usdPerGram: p/31.1034768, source: 'goldprice.org', updatedAt: new Date() });
              return true;
            }
          }
        } catch (e:any) { lastErr = e; }
        return false;
      };
      if (!success) success = await tryGoldPriceOrg();

      // 4) Choose the best (prefer proxy, else first) and store
      if (success && results.length) {
        // Prefer proxy result
        const preferred = results.find(r => r.source === 'proxy') || results[0];
        setGoldPrice(preferred);
        try { localStorage.setItem('goldSpotCache', JSON.stringify(preferred)); } catch {}
      } else {
        // Load cached if exists
        let cached: any = null;
        try { const raw = localStorage.getItem('goldSpotCache'); if (raw) cached = JSON.parse(raw); } catch {}
        if (cached && typeof cached.usdPerOz === 'number') {
          setGoldPrice({
            usdPerOz: cached.usdPerOz,
            usdPerGram: cached.usdPerGram,
            updatedAt: cached.updatedAt ? new Date(cached.updatedAt) : new Date(),
            source: cached.source + ' (cached)',
            error: lastErr ? lastErr.message : 'Live fetch failed'
          });
        } else {
          throw lastErr || new Error('All gold price sources failed');
        }
      }
    } catch (e: any) {
      setGoldPrice({ error: e?.message || "Failed to fetch gold price" });
    } finally {
      setGoldLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load and reactive polling (every 60s) + quick retry if first attempt fails
    let active = true;
    const run = async () => { if (!active) return; await fetchGoldPrice(); };
    run();
    // Poll every 60s
    const id = window.setInterval(() => { if (active) fetchGoldPrice(); }, 60_000);
    // Quick retry after 10s if first fetch did not populate price
    const retryTimer = window.setTimeout(() => { if (active && !goldPrice?.usdPerOz) fetchGoldPrice(); }, 10_000);
    return () => { active = false; window.clearInterval(id); window.clearTimeout(retryTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchGoldPrice]);

  useEffect(() => {
    let active = true;
    const loadPointOfSales = async () => {
      try {
        const res = await axios.get("/ps/all");
        if (!active) return;
        if (Array.isArray(res.data)) {
          const seen = new Set<string>();
          const normalized: PointOfSaleOption[] = [];
          res.data.forEach((raw: any) => {
            if (raw == null) return;
            if (typeof raw === "string" || typeof raw === "number") {
              const id = String(raw);
              if (seen.has(id)) return;
              seen.add(id);
              normalized.push({ id, label: String(raw) });
              return;
            }
            const idValue =
              raw.Id_point ??
              raw.id_point ??
              raw.id ??
              raw.value ??
              raw.code ??
              raw.ID ??
              raw.Id ??
              null;
            const id = idValue != null ? String(idValue) : raw.name_point || raw.name || "";
            if (!id || seen.has(id)) return;
            seen.add(id);
            normalized.push({
              id,
              label: raw.name_point || raw.name || raw.label || `POS ${id}`,
            });
          });
          setPsOptions(normalized);
        }
      } catch (error) {
        console.error("Failed to load points of sale", error);
      }
    };
    loadPointOfSales();
    return () => {
      active = false;
    };
  }, []);

  const psLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    psOptions.forEach((opt) => {
      map[opt.id] = opt.label;
    });
    return map;
  }, [psOptions]);

  const resolvePsLabel = useCallback(
    (value?: string | number | null) => {
      if (value === undefined || value === null || value === "") return "—";
      const key = String(value);
      return psLabelMap[key] || key;
    },
    [psLabelMap]
  );

  const handleOpenChangePsDialog = (item: InventoryItem) => {
    setPsDialogItem(item);
    setPsSelection(item?.ps != null ? String(item.ps) : "");
    setPsDialogError("");
    setPsDialogOpen(true);
  };

  const handleClosePsDialog = () => {
    if (psSaving) return;
    setPsDialogOpen(false);
    setPsDialogItem(null);
    setPsDialogError("");
    setPsSelection("");
  };

  const handleSavePsChange = useCallback(async () => {
    if (!psDialogItem) return;
    if (!psSelection) {
      setPsDialogError("Please select a point of sale.");
      return;
    }
    setPsSaving(true);
    setPsDialogError("");
    const trimmed = psSelection.trim();
    const numericValue = Number(trimmed);
    const payloadValue = Number.isNaN(numericValue) ? trimmed : numericValue;
    try {
      await axios.put(`/purchases/Update/${psDialogItem.id_fact}`, {
        ps: payloadValue,
      });
      setData((prev) =>
        prev.map((row) =>
          row.id_fact === psDialogItem.id_fact ? { ...row, ps: payloadValue } : row
        )
      );
      setPsDialogOpen(false);
      setPsDialogItem(null);
      setPsSelection("");
    } catch (error: any) {
      const message =
        error?.response?.data?.message || "Failed to update point of sale.";
      setPsDialogError(message);
    } finally {
      setPsSaving(false);
    }
  }, [psDialogItem, psSelection]);

  const getPic = useCallback(
    async (id_art: number): Promise<void> => {
      if (!id_art || images[id_art]) return;
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        // Try typed Gold list endpoint first, then fallback to legacy
        let urls: string[] = [];
        try {
          const resGold = await axios.get(`/images/list/gold/${id_art}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (Array.isArray(resGold.data)) urls = resGold.data as string[];
        } catch {
          // Fallback to legacy list
          const res = await axios.get(`/images/list/${id_art}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (Array.isArray(res.data)) urls = res.data as string[];
        }

        // Normalize/secure URLs and append token
        urls = (urls || [])
          .map((u) => {
            let out = String(u || "");
            try {
              const urlObj = new URL(out, window.location.origin);
              if (token) urlObj.searchParams.set("token", token);
              out = urlObj.toString();
            } catch {
              if (token && !out.includes("token="))
                out = out + (out.includes("?") ? "&" : "?") + `token=${encodeURIComponent(token)}`;
            }
            return ensureHttpsSystemGaja(out);
          })
          .filter(Boolean);

        // Prefer GoldPic images; choose latest non-group, non-PIC if possible
        const goldOnly = urls.filter((u) => /GoldPic/i.test(u));
        let candidates = goldOnly.length ? goldOnly : urls;
        let chosen = "";
        for (let i = candidates.length - 1; i >= 0; i--) {
          const name = candidates[i].split("/").pop()?.split("?")[0] || "";
          if (!/group/i.test(name) && !/PIC/i.test(name)) {
            chosen = candidates[i];
            break;
          }
        }
        if (!chosen && candidates.length) chosen = candidates[candidates.length - 1];

        setImages((prev) => ({ ...prev, [id_art]: chosen || "" }));
      } catch (error) {
       
        setImages((prev) => ({ ...prev, [id_art]: "" }));
      }
    },
    [images]
  );

  // --- Begin DInventory-style image export helpers ---
  const EXPORT_IMG_SIZE = 160; // px
  const EXPORT_MAX_IMAGES = 800;
  const EXPORT_IMG_QUALITY = 0.92;
  const EXPORT_FALLBACK_COLOR = "#f0f0f0";
  const EXPORT_IMAGES_PER_ITEM = 3; // limit images per item to speed up export

  async function fetchAndDownscaleToBase64(rawUrl: string, size: number): Promise<string | null> {
    try {
      const resp = await fetch(rawUrl, { method: "GET" });
      if (!resp.ok) return null;
      const blob = await resp.blob();
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
      (ctx as any).imageSmoothingEnabled = true;
      (ctx as any).imageSmoothingQuality = "high";
      const ratio = Math.max(size / img.width, size / img.height);
      const nw = img.width * ratio;
      const nh = img.height * ratio;
      const dx = (size - nw) / 2;
      const dy = (size - nh) / 2;
      ctx.fillStyle = EXPORT_FALLBACK_COLOR;
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, dx, dy, nw, nh);
      URL.revokeObjectURL(img.src);
      let dataUrl = canvas.toDataURL("image/jpeg", EXPORT_IMG_QUALITY);
      if (dataUrl.length > 120000) dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      if (dataUrl.length > 200000) dataUrl = canvas.toDataURL("image/jpeg", 0.75);
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
      } catch { return null; }
    }
  }

  const ensureHttpsSystemGajaSimple = (u?: string | null): string => {
    if (!u) return "";
    try {
      const parsed = new URL(u, window.location.origin);
      const hostLower = parsed.hostname.toLowerCase();
      const pathAndQuery = parsed.pathname + (parsed.search || "") + (parsed.hash || "");
      if (/^system\.gaja\.ly$/i.test(hostLower)) return `https://${parsed.host}${pathAndQuery}`;
      if (/^\/(images|uploads)\//i.test(parsed.pathname)) return `http://localhost:9000${pathAndQuery}`;
      return parsed.toString();
    } catch {
      const rel = String(u).replace(/^\/+/, "");
      if (/^images\//i.test(rel)) return `http://localhost:9000/${rel}`;
      return String(u);
    }
  };

  // Replaces previous XLSX export with MHTML including embedded images
  // Perform export using current dialog filter selections
  const handleExportExcel = async () => {
    setExporting(true);
    setExportProgress(5);
    setExportError("");
    const token = localStorage.getItem("token");
    // Columns to export (Gold specific)
    const headers = [
      "ID",
      "Product Name",
      "Weight (g)",
      "Available Weight (g)",
      "Brand Name",
      "Brand Code",
      "Brand Type",
      "Created By",
      "Email",
    ];

    // Helper to fetch all image URLs for a gold item (reuse existing gold route + legacy fallback)
    const fetchGoldImages = async (id: number): Promise<string[]> => {
      if (!id) return [];
      const urls: string[] = [];
      try {
        try {
          const rGold = await axios.get(`/images/list/gold/${id}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
          if (Array.isArray(rGold.data)) urls.push(...rGold.data);
        } catch {
          const rLegacy = await axios.get(`/images/list/${id}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
          if (Array.isArray(rLegacy.data)) urls.push(...rLegacy.data);
        }
      } catch {}
      return urls;
    };

    const parseDataUrl = (dataUrl: string): { mime: string; base64: string } | null => {
      const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
      if (!match) return null;
      return { mime: match[1] || "image/jpeg", base64: match[2] };
    };

    // Collect unique item keys
    const keyToCidImages: Record<string, { cid: string; mime: string; base64: string }[]> = {};
    const allImages: { cid: string; mime: string; base64: string }[] = [];
    let idx = 1;
    let globalImageCount = 0;
    let truncated = false;

    // Apply export-specific filtering up front and only process selected rows
    let exportRows = filteredData; // start from already filtered set
    if (exportFilterType === 'brand' && exportBrand) {
      exportRows = exportRows.filter(r => (r.Fournisseur?.client_name || '').toLowerCase() === exportBrand.toLowerCase());
    } else if (exportFilterType === 'name' && exportName) {
      exportRows = exportRows.filter(r => (r.Design_art || '').toLowerCase().includes(exportName.toLowerCase()));
    }
    const totalItems = exportRows.length || 1;
    let processedItems = 0;
    for (const item of exportRows) {
      if (truncated) break;
      const key = String(item.id_fact);
      let urls: string[] = await fetchGoldImages(item.id_fact);
      // Prefer marketing/invoice naming, else all
      const prioritize = (arr: string[], needle: string) => arr.filter(u => (u.split('/').pop() || '').toLowerCase().includes(needle));
      const marketing = prioritize(urls, 'marketing');
      const invoice = prioritize(urls, 'invoice');
      if (marketing.length) urls = marketing.concat(urls.filter(u => !marketing.includes(u)));
      else if (invoice.length) urls = invoice.concat(urls.filter(u => !invoice.includes(u)));
      // Limit number of images per item to speed up export
      urls = urls.slice(0, EXPORT_IMAGES_PER_ITEM);
      const parts: { cid: string; mime: string; base64: string }[] = [];
      for (const raw of urls) {
        if (globalImageCount >= EXPORT_MAX_IMAGES) { truncated = true; break; }
        try {
          let url = ensureHttpsSystemGajaSimple(raw);
          if (token && !/^blob:|^data:/i.test(url)) {
            try { const u = new URL(url, window.location.origin); if (!u.searchParams.has('token')) u.searchParams.set('token', token); url = u.toString(); } catch { url += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token); }
          }
          const down = await fetchAndDownscaleToBase64(url, EXPORT_IMG_SIZE);
          if (!down) continue;
          const parsed = parseDataUrl(down); if (!parsed) continue;
          const cid = `image${String(idx++).padStart(4,'0')}`;
          const part = { cid, mime: parsed.mime, base64: parsed.base64 };
          parts.push(part); allImages.push(part); globalImageCount++;
        } catch { /* skip */ }
      }
      keyToCidImages[key] = parts;
      // Reactive progress: from 30%..85% according to processed items
      processedItems++;
      const pct = 30 + Math.min(55, Math.floor((processedItems / totalItems) * 55));
      setExportProgress(pct);
    }

    // Build HTML table
    const excelImgSize = EXPORT_IMG_SIZE;
    let html = `<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Gold Inventory Export</title><style>body{font-family:Roboto,'Segoe UI',Arial,sans-serif;}table{width:98%;margin:8px auto;border-collapse:collapse;}th,td{border:1px solid #e0e0e0;padding:8px;vertical-align:top;}th{background:#f5f5f5;font-weight:700;}img{width:${excelImgSize}px;height:${excelImgSize}px;object-fit:cover;border-radius:4px;border:1px solid #eee;display:block;} .img-stack{display:flex;flex-direction:column;gap:4px;} </style></head><body>`;
    html += `<h2 style='margin-left:12px;color:#1976d2'>Gold Inventory</h2><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}<th>Images</th></tr></thead><tbody>`;
    setExportProgress(30);

    for (const item of exportRows) {
      const key = String(item.id_fact);
      const imgs = keyToCidImages[key] || [];
      const cells = [
        item.id_fact,
        item.Design_art || '',
        item.qty ?? '',
        item.qty_difference ?? '',
        item.Fournisseur?.client_name || '',
        item.Fournisseur?.code_supplier || '',
        item.Fournisseur?.TYPE_SUPPLIER || '',
        item.user?.name_user || '',
        item.user?.email || ''
      ].map(v => `<td>${String(v ?? '')}</td>`).join('');
      let imagesHtml = "<span style='color:#9e9e9e'>No Image</span>";
      if (imgs.length) {
        imagesHtml = `<div class='img-stack'>${imgs.map(p => `<img src='cid:${p.cid}' alt='img' width='${excelImgSize}' height='${excelImgSize}' style='mso-width-source:userset;mso-height-source:userset;'/>`).join('')}</div>`;
      }
      html += `<tr>${cells}<td>${imagesHtml}</td></tr>`;
    }
    html += `</tbody></table><div style='margin:12px;font-size:12px;color:#666'>Generated on ${new Date().toLocaleString()}${truncated? ' • Images truncated':''}</div></body></html>`;

    // Assemble MHTML multipart/related with CID images
    const boundary = "----=_NextPart_000_0000"; const EOL = "\r\n";
    let mhtml = "MIME-Version: 1.0" + EOL;
    mhtml += `Content-Type: multipart/related; boundary="${boundary}"; type="text/html"` + EOL + EOL;
    mhtml += `--${boundary}` + EOL + 'Content-Type: text/html; charset="utf-8"' + EOL + 'Content-Transfer-Encoding: 8bit' + EOL + EOL + html + EOL + EOL;
    allImages.forEach((img,i)=>{
      mhtml += `--${boundary}` + EOL;
      mhtml += `Content-Location: file:///image${i+1}` + EOL;
      mhtml += `Content-Transfer-Encoding: base64` + EOL;
      mhtml += `Content-Type: ${img.mime}` + EOL;
      mhtml += `Content-ID: <${img.cid}>` + EOL + EOL;
      for (let p=0; p<img.base64.length; p+=76) mhtml += img.base64.substring(p,p+76) + EOL;
      mhtml += EOL;
    });
    mhtml += `--${boundary}--` + EOL;

    setExportProgress(85);
    const blob = new Blob([mhtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:T]/g,'-').split('.')[0];
    a.download = `gold_inventory_${stamp}.xls`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setExportProgress(100);
    setExporting(false);
    setTimeout(() => setExportDialogOpen(false), 400);
  };
  // --- End DInventory-style image export helpers ---

  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [dialogImages, setDialogImages] = useState<string[]>([]);
  const [dialogIndex, setDialogIndex] = useState(0);
  const [renameChoice, setRenameChoice] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState("");
  const [renameSuccess, setRenameSuccess] = useState("");

  // Edit product name dialog (same approach as DInventory)
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [editDesignArt, setEditDesignArt] = useState("");
  const [familleList, setFamilleList] = useState<
    { id_famille: number; desig_famille: string }[]
  >([]);
  useEffect(() => {
    const fetchFamilleList = async () => {
      const token = localStorage.getItem("token");
      try {
        const res = await axios.get("/products/all", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (Array.isArray(res.data)) setFamilleList(res.data);
      } catch {}
    };
    fetchFamilleList();
  }, []);

  // Fetch full image list for a given item (typed gold route first, then legacy)
  const fetchImageList = useCallback(async (id: number): Promise<string[]> => {
    const token = localStorage.getItem("token");
    if (!token) return [];
    const urls: string[] = [];
    try {
      try {
        const resGold = await axios.get(`/images/list/gold/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (Array.isArray(resGold.data)) urls.push(...resGold.data);
      } catch {
        const res = await axios.get(`/images/list/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (Array.isArray(res.data)) urls.push(...res.data);
      }
    } catch {
      // ignore
    }
    // normalize + append token
    const normalized = (urls || [])
      .map((u) => {
        let out = String(u || "");
        try {
          const urlObj = new URL(out, window.location.origin);
          if (token) urlObj.searchParams.set("token", token);
          out = urlObj.toString();
        } catch {
          if (token && !out.includes("token="))
            out = out + (out.includes("?") ? "&" : "?") + `token=${encodeURIComponent(token)}`;
        }
        return ensureHttpsSystemGaja(out);
      })
      .filter(Boolean);
    return normalized;
  }, []);

  const handleViewImage = useCallback(
    async (row: InventoryItem) => {
      const id = row.id_fact;
      if (!id) {
        alert("No image available for this item");
        return;
      }
      const list = await fetchImageList(id);
      if (!list.length) {
        alert("No image available for this item");
        return;
      }
      setDialogImages(list);
      // Try to focus the currently displayed card image if present
      const current = images[id];
      const idx = current ? Math.max(0, list.findIndex((u) => u === current || u.includes(current.split("?")[0]))) : 0;
      setDialogIndex(idx >= 0 ? idx : 0);
      setSelectedImage(list[idx >= 0 ? idx : 0]);
      // Auto-pick rename choice based on filename
      try {
        const filename = (list[idx >= 0 ? idx : 0]).split("/").pop()?.split("?")[0] || "";
        if (/invoice/i.test(filename)) setRenameChoice("Invoice");
        else if (/marketing/i.test(filename)) setRenameChoice("Marketing");
        else if (/group/i.test(filename)) setRenameChoice("Group");
        else setRenameChoice(null);
      } catch {
        setRenameChoice(null);
      }
      setRenameError("");
      setRenameSuccess("");
      setImageDialogOpen(true);
    },
    [fetchImageList, images]
  );

  // Filters (left sidebar)
  const [brandFilter, setBrandFilter] = useState("");
  const [brandTypeFilter, setBrandTypeFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [minWeight, setMinWeight] = useState("");
  const [maxWeight, setMaxWeight] = useState("");
  const [seniorityFilter, setSeniorityFilter] = useState<string>("all"); // all | last7 | last30 | lastMonth | lastYear

  const distinctBrands = useMemo(() => {
    const s = new Set<string>();
    data.forEach((r) => {
      const b = r.Fournisseur?.client_name;
      if (b) s.add(b);
    });
    return Array.from(s).sort();
  }, [data]);

  const distinctBrandTypes = useMemo(() => {
    const s = new Set<string>();
    data.forEach((r) => {
      const t = r.Fournisseur?.TYPE_SUPPLIER;
      if (t) s.add(t);
    });
    return Array.from(s).sort();
  }, [data]);

  // Compute price per gram for each distinct Brand Type (treated as purity)
  const purityPriceList = useMemo(() => {
    const gpg = goldPrice?.usdPerGram;
    if (!gpg || !Number.isFinite(gpg)) return [] as Array<{ type: string; factor: number; usdPerGram: number }>;
    const list: Array<{ type: string; factor: number; usdPerGram: number }> = [];
    const seen = new Set<string>();
    for (const t of distinctBrandTypes) {
      const f = parsePurityFactorFromType(t);
      if (f && f > 0 && f <= 1) {
        const key = `${t}@@${f.toFixed(4)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        list.push({ type: t, factor: f, usdPerGram: gpg * f });
      }
    }
    // Sort by descending factor (e.g., 24K first)
    list.sort((a, b) => b.factor - a.factor);
    return list;
  }, [distinctBrandTypes, goldPrice, parsePurityFactorFromType]);

  const filteredData = useMemo(() => {
    const bq = brandFilter.trim().toLowerCase();
    const btq = brandTypeFilter.trim().toLowerCase();
    const nq = nameFilter.trim().toLowerCase();
    const min = minWeight ? Number(minWeight) : null;
    const max = maxWeight ? Number(maxWeight) : null;
    // compute date range based on seniorityFilter
    const now = new Date();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
    const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    const last7 = new Date(now);
    last7.setDate(now.getDate() - 7);
    const last30 = new Date(now);
    last30.setDate(now.getDate() - 30);

    const inSeniority = (dstr?: string) => {
      if (!dstr || seniorityFilter === "all") return true;
      const d = new Date(dstr);
      if (isNaN(d.getTime())) return false;
      switch (seniorityFilter) {
        case "last7":
          return d >= last7 && d <= now;
        case "last30":
          return d >= last30 && d <= now;
        case "lastMonth":
          return d >= startOfLastMonth && d <= endOfLastMonth;
        case "lastYear":
          return d >= startOfLastYear && d <= endOfLastYear;
        default:
          return true;
      }
    };
    return data.filter((r) => {
      const brand = (r.Fournisseur?.client_name || "").toLowerCase();
      const brandType = (r.Fournisseur?.TYPE_SUPPLIER || "").toLowerCase();
      const name = (r.Design_art || "").toString().toLowerCase();
      const w = Number(r.qty ?? 0);
      const brandOk = !bq || brand.includes(bq);
      const brandTypeOk = !btq || brandType.includes(btq);
      const nameOk = !nq || name.includes(nq);
      const minOk = min === null || w >= min;
      const maxOk = max === null || w <= max;
      const seniorityOk = inSeniority(r.date_fact);
      return brandOk && brandTypeOk && nameOk && minOk && maxOk && seniorityOk;
    });
  }, [data, brandFilter, brandTypeFilter, nameFilter, minWeight, maxWeight, seniorityFilter]);

  // Pagination
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(8); // 0 means "All"
  const totalItems = filteredData.length;
  const isAll = pageSize === 0;
  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalItems / Math.max(1, pageSize)));
  useEffect(() => {
    // clamp page when filters or pageSize change
    const maxPage = Math.max(0, totalPages - 1);
    if (pageIndex > maxPage) setPageIndex(maxPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages, pageIndex]);
  useEffect(() => {
    // reset to first page on filter changes
    setPageIndex(0);
  }, [brandFilter, brandTypeFilter, nameFilter, minWeight, maxWeight, seniorityFilter]);
  const pageStart = isAll ? 0 : pageIndex * pageSize;
  const pageEnd = isAll ? totalItems : Math.min(pageStart + pageSize, totalItems);
  const pageData = isAll ? filteredData : filteredData.slice(pageStart, pageEnd);

  const { totalAmountQty, itemCount } = useMemo(() => {
    const totalAmountQty = data.reduce(
      (sum, item) => sum + (item.qty_difference || 0),
      0
    );
    const itemCount = data.length;
    return { totalAmountQty, itemCount };
  }, [data]);

  
  return (
    <Box p={0.5}>
      {/* Image Dialog */}
      <Dialog
        open={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Product Images</DialogTitle>
        <DialogContent>
          {/* Rename controls */}
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mb: 1 }}>
            {renameChoice && (
              <Button
                variant="contained"
                color="success"
                size="small"
                disabled={renaming}
                sx={{ fontWeight: 700 }}
                onClick={async () => {
                  if (!dialogImages.length) return;
                  setRenaming(true);
                  setRenameError("");
                  setRenameSuccess("");
                  try {
                    const url = dialogImages[dialogIndex];
                    const filename = url.split("/").pop()?.split("?")[0] || "";
                    const parts = url.split("/");
                    // Expect .../images/gold/{id}/{filename}
                    let type = parts[parts.length - 3];
                    let idPart = parts[parts.length - 2];
                    if (!type || !idPart || !filename) throw new Error("Cannot parse image path");
                    // Build new name by adding suffix replacing previous
                    const extIdx = filename.lastIndexOf(".");
                    let baseName = extIdx !== -1 ? filename.substring(0, extIdx) : filename;
                    const ext = extIdx !== -1 ? filename.substring(extIdx) : "";
                    baseName = baseName.replace(/-(Invoice|Group|Marketing)+/gi, "");
                    const newName = `${baseName}-${renameChoice}${ext}`;
                    const token = localStorage.getItem("token");
                    const apiUrl = `/images/update-name/${type}/${idPart}/${filename}`;
                    const res = await axios.put(
                      apiUrl,
                      { newName },
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (res.data?.success) {
                      setRenameSuccess(`Saved successfully`);
                      // Refresh images
                      const idNum = Number(idPart);
                      const updated = await fetchImageList(idNum);
                      if (updated && updated.length) {
                        setDialogImages(updated);
                        const idx = updated.findIndex((u) => u.includes(newName));
                        setDialogIndex(idx >= 0 ? idx : 0);
                        setSelectedImage(updated[idx >= 0 ? idx : 0] || null);
                        // refresh card preview image
                        if (!isNaN(idNum)) {
                          try { await getPic(idNum); } catch {}
                        }
                      }
                    } else {
                      throw new Error(res.data?.error || "Rename failed");
                    }
                  } catch (err: any) {
                    
                  } finally {
                    setRenaming(false);
                  }
                }}
              >
                Save
              </Button>
            )}
            <Box sx={{ flex: 1 }} />
            {(["Invoice", "Group", "Marketing"]).map((choice) => (
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
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
              minHeight: "400px",
              position: "relative",
            }}
          >
            {dialogImages.length ? (
              <>
                <IconButton
                  sx={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", bgcolor: "#0006", color: "#fff", "&:hover": { bgcolor: "#0009" } }}
                  onClick={() => setDialogIndex((i) => (i - 1 + dialogImages.length) % dialogImages.length)}
                >
                  {"\u2039"}
                </IconButton>
                <img
                  src={dialogImages[dialogIndex]}
                  alt="Product"
                  style={{ width: "100%", height: "70vh", objectFit: "contain", borderRadius: 8, border: "1px solid #eee" }}
                />
                <IconButton
                  sx={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", bgcolor: "#0006", color: "#fff", "&:hover": { bgcolor: "#0009" } }}
                  onClick={() => setDialogIndex((i) => (i + 1) % dialogImages.length)}
                >
                  {"\u203A"}
                </IconButton>
                <Typography variant="caption" sx={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", color: "#fff", px: 1, py: 0.25, bgcolor: "#0007", borderRadius: 1 }}>
                  {dialogIndex + 1} / {dialogImages.length}
                </Typography>
                {(renameError || renameSuccess) && (
                  <Box sx={{ position: "absolute", bottom: 56, left: 16, bgcolor: renameError ? "error.main" : "success.main", color: "#fff", px: 2, py: 0.5, borderRadius: 2 }}>
                    <Typography variant="caption">{renameError || renameSuccess}</Typography>
                  </Box>
                )}
              </>
            ) : selectedImage ? (
              <img
                src={selectedImage}
                alt="Product"
                style={{ width: "100%", height: "70vh", objectFit: "contain", borderRadius: 8, border: "1px solid #eee" }}
              />
            ) : (
              <Typography>No image available</Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setImageDialogOpen(false); setRenameChoice(null); setRenameError(""); setRenameSuccess(""); }}>Close</Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ display: "flex", gap: 2 }}>
        {/* Left filter sidebar */}
        <Box
          sx={{
            width: 280,
            flexShrink: 0,
            border: "1px solid #e0e0e0",
            borderRadius: 2,
            p: 2,
            height: "calc(100vh - 170px)",
            position: "sticky",
            top: 8,
            overflowY: "auto",
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Filters
          </Typography>
          <TextField
            select
           // label="Brand"
            size="small"
            fullWidth
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            SelectProps={{ native: true }}
            sx={{ mb: 1.5 }}
          >
            <option value="">All</option>
            {distinctBrands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </TextField>
          <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>
            Brand Type
          </Typography>
          <ToggleButtonGroup
            value={brandTypeFilter || "all"}
            exclusive
            onChange={(e, val) => setBrandTypeFilter(!val || val === "all" ? "" : String(val))}
            size="small"
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
              mb: 1.5,
              "& .MuiToggleButton-root": { textTransform: "none", px: 1.25, py: 0.5 },
            }}
          >
            <ToggleButton value="all">All</ToggleButton>
            {distinctBrandTypes.map((t) => (
              <ToggleButton key={t} value={t}>
                {t}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <TextField
            label="Product Name"
            size="small"
            fullWidth
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            sx={{ mb: 1.5 }}
          />
          <TextField
            select
            label="Seniority"
            size="small"
            fullWidth
            value={seniorityFilter}
            onChange={(e) => setSeniorityFilter(e.target.value)}
            SelectProps={{ native: true }}
            sx={{ mb: 1.5 }}
          >
            <option value="all">All</option>
            <option value="last7">Last 7 days</option>
            <option value="last30">Last 30 days</option>
            <option value="lastMonth">Last Month</option>
            <option value="lastYear">Last Year</option>
          </TextField>
          <Box sx={{ display: "flex", gap: 1.5, mb: 1.5 }}>
            <TextField
              label="Min Weight"
              size="small"
              type="number"
              fullWidth
              value={minWeight}
              onChange={(e) => setMinWeight(e.target.value)}
            />
            <TextField
              label="Max Weight"
              size="small"
              type="number"
              fullWidth
              value={maxWeight}
              onChange={(e) => setMaxWeight(e.target.value)}
            />
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              onClick={() => {
                setBrandFilter("");
                setBrandTypeFilter("");
                setNameFilter("");
                setMinWeight("");
                setMaxWeight("");
                setSeniorityFilter("all");
              }}
              fullWidth
            >
              Reset
            </Button>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Box
            sx={{
              backgroundColor: "error.main",
              color: (theme) => theme.palette.getContrastText(theme.palette.error.main),
              px: 1.5,
              py: 0.75,
              borderRadius: 1.5,
              fontSize: "0.9rem",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                letterSpacing: 0.2,
                display: "flex",
                alignItems: "baseline",
                gap: 0.5,
                "& .label": { opacity: 0.9 },
                "& .value": { fontSize: "1.1rem" },
                "& .unit": { fontSize: "0.8rem", opacity: 0.9 },
              }}
            >
              <span className="label">Total Weight:</span>
              <span className="value">
                {totalAmountQty.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="unit">g</span>
            </Typography>
          </Box>
          <Typography
            variant="caption"
            sx={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: 0.5,
              mt: 0.75,
              color: "text.secondary",
              "& .label": { fontWeight: 600, opacity: 0.9 },
              "& .value": {
                fontWeight: 700,
                fontSize: "0.9rem",
                color: "text.primary",
              },
            }}
          >
            <span className="label">Items:</span>
            <span className="value">{itemCount.toLocaleString()}</span>
          </Typography>
        </Box>

        {/* Right content: header + cards grid + footer pagination */}
        <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 2, flexWrap: "wrap" }}>
            <Typography variant="h5" sx={{ fontWeight: "bold" }}>
              Gold Inventory List
            </Typography>
            <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
              {/* Live Gold Price widget (free API) */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Chip
                  color="warning"
                  variant="outlined"
                  label={(() => {
                    if (goldLoading && !goldPrice?.usdPerOz) return "Gold: loading…";
                    if (goldPrice?.error || !goldPrice?.usdPerOz) {
                      return goldPrice?.error ? `Gold: n/a (${goldPrice.error})` : "Gold: n/a";
                    }
                    const oz = goldPrice.usdPerOz ?? 0;
                    const g = goldPrice.usdPerGram ?? 0;
                    const stale = (() => {
                      if (!goldPrice?.updatedAt) return false;
                      const ageMs = Date.now() - goldPrice.updatedAt.getTime();
                      return ageMs > 5 * 60 * 1000; // >5m
                    })();
                    const ageMin = goldPrice.updatedAt ? Math.floor((Date.now() - goldPrice.updatedAt.getTime())/60000) : 0;
                    return `Gold${stale ? ' (stale)' : ''}: $${oz.toFixed(2)}/oz ($${g.toFixed(2)}/g) • ${ageMin}m • ${goldPrice.source}`;
                  })()}
                  sx={{ fontWeight: 700 }}
                />
                {/* Manual refresh removed: now fully reactive */}
              </Box>
              {/* Per-Purity price per gram (Brand Type interpreted as purity) */}
              {purityPriceList.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', maxWidth: '100%' }}>
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
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<ImportExportIcon />}
                onClick={() => setExportDialogOpen(true)}
                sx={{
                  borderRadius: 3,
                  textTransform: "none",
                  fontWeight: "bold",
                  px: 2.5,
                }}
              >
                Export Excel
              </Button>
            </Box>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 1.5,
              flex: 1,
            }}
          >
            {(loading ? Array.from({ length: pageSize }) : pageData).map(
              (item, idx) => {
                const isSkeleton = loading;
                const idKey = isSkeleton ? idx : (item as InventoryItem).id_fact;
                const imgUrl = !isSkeleton && images[(item as InventoryItem).id_fact];
                if (!isSkeleton) {
                  const it = item as InventoryItem;
                  if (it.id_fact && !images[it.id_fact]) getPic(it.id_fact);
                }
                return (
                  <Box
                    key={String(idKey)}
                    sx={{
                      border: "1px solid #e0e0e0",
                      borderRadius: 8,
                      p: 1.25,
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                      height: 340,
                      overflow: "hidden",
                      //backgroundColor: "#fff",
                    }}
                  >
                    <Box
                      sx={{
                        aspectRatio: "1 / 1",
                        width: "50%",
                        mx: "auto",
                        borderRadius: 8,
                        border: "1px solid #eee",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#fafafa",
                      }}
                    >
                      {isSkeleton ? (
                        <Box sx={{ width: "100%", height: "100%", background: "#eee" }} />
                      ) : imgUrl ? (
                        <Box
                          component="img"
                          src={imgUrl}
                          alt="Product"
                          loading="lazy"
                          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.style.display = "none";
                          }}
                          onClick={() => handleViewImage(item as InventoryItem)}
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          No Image
                        </Typography>
                      )}
                    </Box>

                    {!isSkeleton && (
                      <>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 700, color: "#DAA520" }}
                          >
                            {(item as InventoryItem).Design_art || "-"} {` - ${(item as InventoryItem).Fournisseur?.TYPE_SUPPLIER}`}
                          </Typography>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => {
                              const it = item as InventoryItem;
                              setEditItem(it);
                              setEditDesignArt(it.Design_art || "");
                              setEditDialogOpen(true);
                            }}
                            aria-label="Edit Product Name"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Box>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, fontSize: 13 }}>
                          <Typography variant="caption">
                            <b>ID:</b> {(item as InventoryItem).id_fact}
                          </Typography>
                          <Typography variant="caption">
                            <b>Weight:</b> {(item as InventoryItem).qty}  g
                          </Typography>
                          
                          <Typography variant="caption" sx={{ width: "100%" }}>
                            <b>Brand:</b> {(item as InventoryItem).Fournisseur?.code_supplier + " - "}  {(item as InventoryItem).Fournisseur?.client_name || "-"}
                          </Typography>
                          <Typography variant="caption" sx={{ width: "100%" }}>
                            <b>PS:</b> {resolvePsLabel((item as InventoryItem).ps)}
                          </Typography>
                          
                          
                        </Box>
                        <Box sx={{ display: "flex", gap: 1, mt: 0.5, flexWrap: "wrap" }}>
                          <Tooltip title="View Image">
                            <span>
                              <IconButton
                                color="info"
                                size="small"
                                onClick={() => handleViewImage(item as InventoryItem)}
                                disabled={!(item as InventoryItem).id_fact || !images[(item as InventoryItem).id_fact]}
                              >
                                <PhotoIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          {canChangePs && (
                            <Tooltip title="Change Point of Sale">
                              <span>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() => handleOpenChangePsDialog(item as InventoryItem)}
                                  disabled={!psOptions.length}
                                  sx={{ textTransform: "none" }}
                                >
                                  Change PS
                                </Button>
                              </span>
                            </Tooltip>
                          )}
                        </Box>
                      </>
                    )}
                  </Box>
                );
              }
            )}
          </Box>
          {/* Footer pagination (sticky) */}
          <Box
            sx={{
              position: { xs: "static", md: "sticky" },
              bottom: 0,
              mt: 2,
              py: 1,
              px: 1.5,
              //backgroundColor: "#fff",
              borderTop: "1px solid #e0e0e0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1.5,
              zIndex: 1,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
              <TextField
                select
                label="Show per page"
                size="small"
                value={pageSize}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setPageSize(Number.isNaN(v) ? 8 : v);
                  setPageIndex(0);
                }}
                SelectProps={{ native: true }}
                sx={{ minWidth: 140 }}
              >
                <option value={0}>All</option>
                {[8, 12, 24, 48, 96].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </TextField>
              <Typography variant="body2" color="text.secondary">
                Items {totalItems === 0 ? 0 : pageStart + 1}-{pageEnd} of {totalItems}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <IconButton
                size="small"
                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                disabled={pageIndex <= 0}
              >
                <ChevronLeftIcon />
              </IconButton>
              <Typography variant="body2">
                Page {Math.min(pageIndex + 1, totalPages)} of {totalPages}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                disabled={pageIndex >= totalPages - 1}
              >
                <ChevronRightIcon />
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Box>
      {/* Export Filter Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => !exporting && setExportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Export Gold Inventory</DialogTitle>
        <DialogContent>
          <Box sx={{ display:'flex', flexDirection:'column', gap:2, mt:1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight:700 }}>Filter</Typography>
            <Box sx={{ display:'flex', gap:1, flexWrap:'wrap' }}>
              <Button size="small" variant={exportFilterType==='all'?'contained':'outlined'} onClick={()=>{setExportFilterType('all');}}>All</Button>
              <Button size="small" variant={exportFilterType==='brand'?'contained':'outlined'} onClick={()=>{setExportFilterType('brand');}}>By Brand</Button>
              <Button size="small" variant={exportFilterType==='name'?'contained':'outlined'} onClick={()=>{setExportFilterType('name');}}>By Name</Button>
            </Box>
            {exportFilterType==='brand' && (
              <TextField select label="Brand" size="small" value={exportBrand} onChange={e=>setExportBrand(e.target.value)} fullWidth>
                <MenuItem value="">(choose)</MenuItem>
                {distinctBrands.map(b=> <MenuItem key={b} value={b}>{b}</MenuItem>)}
              </TextField>
            )}
            {exportFilterType==='name' && (
              <TextField label="Product Name contains" size="small" value={exportName} onChange={e=>setExportName(e.target.value)} fullWidth />
            )}
            <Box sx={{ mt:1 }}>
              <Typography variant="caption" color="text.secondary">Images will be embedded (max {EXPORT_MAX_IMAGES}).</Typography>
            </Box>
            {exporting && (
              <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                <Box sx={{ flex:1, height:6, borderRadius:3, background:'#eee', overflow:'hidden' }}>
                  <Box sx={{ width: `${exportProgress}%`, height:'100%', background:'#1976d2', transition:'width .3s' }} />
                </Box>
                <Typography variant="caption">{exportProgress}%</Typography>
              </Box>
            )}
            {exportError && (
              <Typography variant="caption" color="error">{exportError}</Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=> setExportDialogOpen(false)} disabled={exporting} color="inherit">Cancel</Button>
          <Button onClick={handleExportExcel} disabled={exporting || (exportFilterType==='brand' && !exportBrand) || (exportFilterType==='name' && !exportName)} variant="contained">Export</Button>
        </DialogActions>
      </Dialog>
      {/* Change PS Dialog */}
      <Dialog open={psDialogOpen} onClose={handleClosePsDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Change Point of Sale</DialogTitle>
        <DialogContent>
          {psDialogItem && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="body2">
                Updating item #{psDialogItem.id_fact} ({psDialogItem.Design_art || "Product"})
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Current: {resolvePsLabel(psDialogItem.ps)}
              </Typography>
            </Box>
          )}
          <TextField
            select
            label="Point of Sale"
            value={psSelection}
            onChange={(e) => setPsSelection(e.target.value)}
            fullWidth
            size="small"
            helperText="Select where this item is assigned"
            disabled={!psOptions.length}
          >
            <MenuItem value="" disabled>
              Select...
            </MenuItem>
            {psOptions.map((opt) => (
              <MenuItem key={opt.id} value={opt.id}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          {psDialogError && (
            <Typography variant="caption" color="error" sx={{ display: "block", mt: 1 }}>
              {psDialogError}
            </Typography>
          )}
          {!psOptions.length && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              No points of sale available. Please try again later.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePsDialog} disabled={psSaving} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleSavePsChange}
            disabled={psSaving || !psSelection}
            variant="contained"
          >
            {psSaving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Edit Product Name Dialog */}
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
                (fam) => fam.desig_famille !== "طاقم" && fam.desig_famille !== "سيت"
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
              setLoading(true);
              setData((prev) =>
                prev.map((i) =>
                  i.id_fact === editItem.id_fact
                    ? { ...i, Design_art: editDesignArt }
                    : i
                )
              );
              setEditDialogOpen(false);
              try {
                const token = localStorage.getItem("token");
                if (editItem.id_fact) {
                  await axios.put(
                    `/purchases/Update/${editItem.id_fact}`,
                    { Design_art: editDesignArt },
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                }
              } catch {}
              try {
                await fetchData();
              } catch {}
              setLoading(false);
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

export default GInventory;
