import React, { useEffect, useState, useMemo, useCallback } from "react";
import axios from "../api";
import { useNavigate } from "react-router-dom";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from "material-react-table";
import {
  Box,
  IconButton,
  Button,
  Typography,
  TextField,
  MenuItem,
  CircularProgress,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";

import ImportExportIcon from "@mui/icons-material/ImportExport";

type PointOfSaleOption = {
  id: string;
  label: string;
};

type InventoryItem = {
  id_fact: number;
  desig_art: string;
  Design_art?: string;
  Model?: string;
  model?: string;
  qty: number;
  qty_difference: number;
  ps?: number | string | null;
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
  DistributionPurchase?: {
    OriginalAchatWatch?: Record<string, any>;
    // ...other fields if needed
  };
};

interface Props {
  Type?: string;
}

const API_BASEImage = "/api/images";

const WATCH_MODEL_OPTIONS: string[] = [
  "Submariner",
  "Speedmaster",
  "Royal Oak",
  "Datejust",
  "Seamaster",
  "Nautilus",
  "Carrera",
  "Reverso",
];

// --- Watch image URL helpers copied/adapted from GNew_I ---
// Normalize / rewrite watch image URLs to unified alias route
function normalizeWatchUrl(rawUrl: string, idAchat: number): string {
  if (!rawUrl) return rawUrl;
  try {
    // Work against a URL object to handle absolute and relative URLs uniformly
    const parsed = new URL(rawUrl, window.location.origin);
    let pathname = parsed.pathname; // '/images/254/foo.jpg'
    const fileName = pathname.split('/').pop() || '';

    // Add /api prefix when missing for known roots
    if ((pathname.startsWith('/images/') || pathname.startsWith('/uploads/')) && !pathname.startsWith('/api/')) {
      pathname = '/api' + pathname;
    }

    // Rewrite /api/images/<id>/... -> /api/images/watch/<id>/...
    const reId = new RegExp(`^/api/images/${idAchat}/`, 'i');
    if (reId.test(pathname) && !/\/api\/images\/watch\//i.test(pathname)) {
      pathname = pathname.replace(reId, `/api/images/watch/${idAchat}/`);
    }

    // Rewrite legacy uploads path
    if (/^\/api\/uploads\/WatchPic\//i.test(pathname)) {
      pathname = `/api/images/watch/${idAchat}/${fileName}`;
    }

    // Return absolute URL if input was absolute, else root-relative path
    if (/^https?:\/\//i.test(rawUrl)) {
      parsed.pathname = pathname;
      return parsed.toString();
    }
    return pathname;
  } catch {
    return rawUrl;
  }
}

// Force https for absolute http URLs
function ensureHttps(u: string): string {
  if (!u) return u;
  return u.startsWith('http://') ? 'https://' + u.substring('http://'.length) : u;
}

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

// Export image settings (mirrors SalesReportsTable approach for compatibility)
// Increased size/quality for sharper images in Excel exports
const EXPORT_IMG_SIZE = 160; // px size for exported thumbnails (was 55)
const EXPORT_MAX_IMAGES = 800; // global cap across export

// Downscale an image to fixed square and return data URL (JPEG) like SalesReportsTable
const EXPORT_IMG_QUALITY = 0.92; // higher base JPEG quality for clarity (was 0.7)
const EXPORT_FALLBACK_COLOR = "#f0f0f0";
async function fetchAndDownscaleToBase64(
  rawUrl: string,
  size: number
): Promise<string | null> {
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
    // Improve resampling quality
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
    // Gentle fallback compression only if very large
    if (dataUrl.length > 120000)
      dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    if (dataUrl.length > 200000)
      dataUrl = canvas.toDataURL("image/jpeg", 0.75);
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

// Fetch image list for export (adapted for watches)
async function fetchImageListForExport(id: number): Promise<string[]> {
  const token = localStorage.getItem("token");
  const API_BASEImage = "/api/images";
  const url = `${API_BASEImage}/list/${id}`;
  try {
    const res = await axios.get(
      url,
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
    );
    if (Array.isArray(res.data)) {
      const apiBase = (axios.defaults.baseURL || window.location.origin).replace(/\/+$/, "");
      return res.data
        .map((item: any) => {
          // Support both string URLs and objects like { url: "..." }
          let u = typeof item === "string" ? item : (item?.url || item?.href || "");
          if (!u || typeof u !== "string") return "";

          // Prefix legacy uploads path with /api
          if (u.startsWith("/uploads")) u = "/api" + u;
          if (u.startsWith("/images/")) u = "/api" + u;

          // Make absolute using axios base or window origin
          if (!/^https?:\/\//i.test(u)) {
            u = u.startsWith("/") ? apiBase + u : apiBase + "/" + u.replace(/^\/+/, "");
          }

          // Fix absolute URLs pointing at /images/... (missing /api)
          try {
            const uo = new URL(u);
            if (/^\/images\//i.test(uo.pathname)) {
              uo.pathname = '/api' + uo.pathname;
              u = uo.toString();
            }
          } catch { }

          // Enforce https when page is https
          if (window?.location?.protocol === "https:" && u.startsWith("http://")) {
            try { u = "https://" + u.substring("http://".length); } catch { }
          }

          // Append bearer token as query param if available
          if (token) {
            try {
              const urlObj = new URL(u);
              urlObj.searchParams.delete("token");
              urlObj.searchParams.append("token", token);
              u = urlObj.toString();
            } catch { /* ignore */ }
          }
          return u;
        })
        .filter(Boolean);
    }
  } catch {
    /* ignore error */
  }
  return [];
}

const WInventory = (props: Props) => {
  const { Type = "" } = props;
  let ps: string | null = null; // Removed unused Cuser
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

  const canChangePs = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const obj = JSON.parse(raw);
        const currentId = obj?.Cuser;
        if (currentId != null && String(currentId) === "68") return true;
      }
    } catch { }
    try {
      const fallback = localStorage.getItem("Cuser");
      if (fallback != null && String(fallback) === "68") return true;
    } catch { }
    return false;
  }, []);

  const [imageUrls, setImageUrls] = useState<Record<string, string[]>>({});
  const [images, setImages] = useState<Record<string, string[]>>({});
  // Removed carousel index state (single image index for now)

  const [psOptions, setPsOptions] = useState<PointOfSaleOption[]>([]);
  const [psDialogOpen, setPsDialogOpen] = useState(false);
  const [psDialogItem, setPsDialogItem] = useState<InventoryItem | null>(null);
  const [psSelection, setPsSelection] = useState("");
  const [psDialogError, setPsDialogError] = useState("");
  const [psSaving, setPsSaving] = useState(false);

  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [modelDialogItem, setModelDialogItem] = useState<InventoryItem | null>(
    null
  );
  const [modelSelection, setModelSelection] = useState("");
  const [modelDialogError, setModelDialogError] = useState("");
  const [modelSaving, setModelSaving] = useState(false);

  const navigate = useNavigate();
  const apiUrl = "/Inventory";
  const watchApiUrl = "/WOpurchases";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const load = async () => {
      try {
        const res = await axios.get("/ps/all", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const rows = Array.isArray(res.data) ? res.data : [];
        const opts: PointOfSaleOption[] = rows
          .map((r: any) => {
            const id =
              r.Id_point ??
              r.ID_POINT ??
              r.id_point ??
              r.id ??
              r.code ??
              null;
            const name =
              r.name_point ??
              r.NAME_POINT ??
              r.name ??
              r.label ??
              r.Email ??
              "";
            if (id == null) return null;
            return {
              id: String(id),
              label: String(name || id),
            };
          })
          .filter((o): o is PointOfSaleOption => !!o);
        setPsOptions(opts);
      } catch (e) {
        console.error("Failed to load PS options for WInventory", e);
      }
    };
    load();
  }, []);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/");

    try {
      const response = await axios.get<InventoryItem[]>(`${apiUrl}/allActive`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { ps, type_supplier: Type },
      });
      setData(response.data);

      console.log("Fetched data:", response.data);
    } catch (error: any) {
      if (error.response?.status === 401) navigate("/");
      else console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [navigate, ps, Type]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const psLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    psOptions.forEach((opt) => {
      map.set(opt.id, opt.label);
    });
    return map;
  }, [psOptions]);

  const resolvePsLabel = useCallback(
    (value: number | string | null | undefined): string => {
      if (value === null || typeof value === "undefined") return "";
      const key = String(value);
      return psLabelMap.get(key) || key;
    },
    [psLabelMap]
  );

  const handleOpenEditModelDialog = useCallback((item: InventoryItem) => {
    let watch: any = undefined;
    const dp: any = item.DistributionPurchase;
    if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
      watch = dp[0]?.OriginalAchatWatch;
    } else if (dp && typeof dp === "object") {
      watch = dp?.OriginalAchatWatch;
    }
    const currentModel =
      (watch?.model as string | undefined) ||
      (watch?.Model as string | undefined) ||
      item.Model ||
      item.model ||
      item.Design_art ||
      item.desig_art ||
      "";
    setModelDialogItem(item);
    setModelSelection(currentModel || "");
    setModelDialogError("");
    setModelDialogOpen(true);
  }, []);

  const handleOpenChangePsDialog = useCallback(
    (item: InventoryItem) => {
      setPsDialogItem(item);
      const current =
        item.ps != null
          ? String(item.ps)
          : psOptions.length
            ? psOptions[0].id
            : "";
      setPsSelection(current);
      setPsDialogError("");
      setPsDialogOpen(true);
    },
    [psOptions]
  );

  const handleClosePsDialog = () => {
    if (psSaving) return;
    setPsDialogOpen(false);
    setPsDialogItem(null);
    setPsSelection("");
    setPsDialogError("");
  };

  const handleSavePsChange = useCallback(async () => {
    if (!psDialogItem) return;
    if (!psSelection) {
      setPsDialogError("Please select a point of sale");
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) {
      setPsDialogError("Missing auth token");
      return;
    }
    setPsSaving(true);
    setPsDialogError("");
    try {
      const payloadPs = isNaN(Number(psSelection))
        ? psSelection
        : Number(psSelection);
      await axios.put(
        `/purchases/Update/${psDialogItem.id_fact}`,
        { ps: payloadPs },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setData((prev) =>
        prev.map((row) =>
          row.id_fact === psDialogItem.id_fact
            ? { ...row, ps: payloadPs }
            : row
        )
      );
      setPsDialogOpen(false);
      setPsDialogItem(null);
    } catch (e: any) {
      console.error("Failed to update PS for watch inventory", e);
      setPsDialogError(
        e?.response?.data?.message || "Failed to update point of sale"
      );
    } finally {
      setPsSaving(false);
    }
  }, [psDialogItem, psSelection]);

  const handleCloseModelDialog = () => {
    if (modelSaving) return;
    setModelDialogOpen(false);
    setModelDialogItem(null);
    setModelSelection("");
    setModelDialogError("");
  };

  const handleSaveModelChange = useCallback(async () => {
    if (!modelDialogItem) return;
    const trimmed = modelSelection.trim();
    if (!trimmed) {
      setModelDialogError("Please select or enter a model");
      return;
    }

    let dp: any = modelDialogItem.DistributionPurchase;
    let watch: any = undefined;
    if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
      watch = dp[0]?.OriginalAchatWatch;
    } else if (dp && typeof dp === "object") {
      watch = dp?.OriginalAchatWatch;
    }
    const idAchat = watch?.id_achat;
    if (!idAchat) {
      setModelDialogError("Cannot determine watch id for this item");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setModelDialogError("Missing auth token");
      return;
    }

    setModelSaving(true);
    setModelDialogError("");
    try {
      await axios.put(
        `${watchApiUrl}/Update/${idAchat}`,
        { model: trimmed },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setData((prev) =>
        prev.map((row) => {
          if (row.id_fact !== modelDialogItem.id_fact) return row;
          const updated: any = { ...row, Model: trimmed, model: trimmed };
          let rowDp: any = updated.DistributionPurchase;
          if (
            Array.isArray(rowDp) &&
            rowDp.length > 0 &&
            typeof rowDp[0] === "object"
          ) {
            const first = rowDp[0] || {};
            updated.DistributionPurchase = [
              {
                ...first,
                OriginalAchatWatch: {
                  ...(first.OriginalAchatWatch || {}),
                  model: trimmed,
                },
              },
              ...rowDp.slice(1),
            ];
          } else if (rowDp && typeof rowDp === "object") {
            updated.DistributionPurchase = {
              ...rowDp,
              OriginalAchatWatch: {
                ...(rowDp.OriginalAchatWatch || {}),
                model: trimmed,
              },
            };
          }
          return updated as InventoryItem;
        })
      );

      setModelDialogOpen(false);
      setModelDialogItem(null);
      setModelSelection("");
    } catch (e: any) {
      console.error("Failed to update model for watch inventory", e);
      setModelDialogError(
        e?.response?.data?.message || "Failed to update model"
      );
    } finally {
      setModelSaving(false);
    }
  }, [modelDialogItem, modelSelection]);

  const fetchImages = async (id_achat: number) => {
    const token = localStorage.getItem("token");
    if (!token || !id_achat) return;
    try {
      const res = await axios.get(`${API_BASEImage}/list/${id_achat}`, {
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
      // Normalize each URL to absolute HTTPS + append token query param for direct browser loading
      const apiBase = (axios.defaults.baseURL || (window.location.origin + "/api")).replace(/\/+$/, "");
      urls = urls.map((u) => {
        if (!u) return u;
        let full = u;
        // Prefix missing /api for legacy paths
        if (full.startsWith('/uploads')) full = '/api' + full;
        if (full.startsWith('/images/')) full = '/api' + full;
        // If absolute and path is /images/... without /api, insert /api
        try {
          const abs = new URL(full, apiBase + '/');
          if (/^\/images\//i.test(abs.pathname)) {
            abs.pathname = '/api' + abs.pathname;
            full = abs.toString();
          }
        } catch { }
        if (!/^https?:\/\//i.test(full)) {
          if (full.startsWith("/")) full = apiBase + full; else full = apiBase + "/" + full.replace(/^\/+/, "");
        }
        full = ensureHttps(full);
        if (token && !full.includes("token=")) {
          full += (full.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
        }
        return full;
      });
      setImageUrls((prev) => ({ ...prev, [id_achat]: urls }));
      // Fetch all images as blobs with auth
      const blobUrls = await Promise.all(
        urls.map((url) => fetchImageWithAuth(url, token))
      );
      setImages((prev) => ({
        ...prev,
        [id_achat]: blobUrls.filter((url): url is string => Boolean(url)),
      }));
    } catch (err) {
      setImages((prev) => ({ ...prev, [id_achat]: [] }));
      setImageUrls((prev) => ({ ...prev, [id_achat]: [] }));
    }
  };

  const columns = useMemo<MRT_ColumnDef<InventoryItem>[]>(
    () => [
      {
        header: "Image",
        id: "image",
        Cell: ({ row }) => {
          // Robustly determine imageKey for this row
          let imageKey: string | number | undefined = undefined;
          let watch: any = undefined;
          let dp: any = row.original.DistributionPurchase;
          if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
            watch = dp[0]?.OriginalAchatWatch;
            imageKey = watch?.id_achat;
          } else if (dp && typeof dp === "object") {
            watch = dp?.OriginalAchatWatch;
            imageKey = watch?.id_achat;
          }
          if (!imageKey) imageKey = row.original.id_fact;
          const imageKeyStr = String(imageKey);
          // Fetch images if not already fetched
          useEffect(() => {
            if (!images[imageKeyStr] && !imageUrls[imageKeyStr]) {
              fetchImages(Number(imageKey));
            }
          }, [imageKeyStr, imageKey]);
          const urls = imageUrls[imageKeyStr] || [];
          const blobList = images[imageKeyStr] || [];
          const idx = 0; // Single representative image for now
          const token = localStorage.getItem("token");
          // Carousel navigation handlers

          // Dialog open handler
          const handleOpenDialog = (imgIdx: number) => {
            // Prefer already-fetched blob/object URLs. If not available,
            // fall back to the original URLs (with token appended when needed).
            const availableImages: string[] =
              images[imageKeyStr] && images[imageKeyStr].length
                ? images[imageKeyStr]
                : urls
                  .map((u: string) => {
                    if (!u) return "";
                    let full = u;
                    if (token && !full.includes("token=")) {
                      full +=
                        (full.includes("?") ? "&" : "?") +
                        "token=" +
                        encodeURIComponent(token);
                    }
                    return full;
                  })
                  .filter(Boolean);

            setDialogImages(availableImages);
            const safeIndex =
              availableImages.length > 0
                ? Math.max(0, Math.min(imgIdx, availableImages.length - 1))
                : 0;
            setDialogIndex(safeIndex);
            setImageDialogOpen(true);
          };
          return (
            <Box
              sx={{
                width: 200,
                height: 220,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 2,
                overflow: "hidden",
                position: "relative",
                mr: 3,
              }}
            >
              {urls.length > 0 || blobList.length > 0 ? (
                (() => {
                  // If this row corresponds to a watch purchase, use advanced fallback chain like GNew_I
                  if (watch) {
                    const original = urls[idx] || blobList[idx];
                    const fileName = (original || '').split('?')[0].split('/').pop() || '';
                    const apiBaseRaw = (process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_IP || 'http://localhost:9000/api').replace(/\/+$/, '');
                    let origin = '';
                    try { origin = new URL(apiBaseRaw).origin; } catch { origin = window.location.origin; }
                    const originHttps = origin.replace(/^http:\/\//i, 'https://');
                    const primaryRaw = normalizeWatchUrl(original, Number(imageKey));
                    const primary = primaryRaw?.startsWith('/') ? originHttps + primaryRaw : ensureHttps(primaryRaw);
                    const generic = `${originHttps}/api/images/${imageKey}/${fileName}`;
                    const staticPath = `${originHttps}/api/uploads/WatchPic/${imageKey}/${fileName}`;
                    const chain = [primary, generic, staticPath].filter(Boolean);
                    const tokenParam = token ? `token=${encodeURIComponent(token)}` : '';
                    const withToken = (u: string) => (tokenParam ? u + (u.includes('?') ? '&' : '?') + tokenParam : u);
                    // Prefer blob if available; fall back to chain[0]
                    const displaySrc = blobList.length > 0 ? blobList[0] : withToken(chain[0]);
                    return (
                      <Box
                        sx={{
                          flex: 1,
                          height: 200,
                          minWidth: 120,
                          maxWidth: 200,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            component="img"
                            src={displaySrc}
                            data-fallback-index={0}
                            data-fallback-chain={chain.join('|')}
                            alt={`Image ${idx + 1}`}
                            loading="lazy"
                            sx={{
                              maxHeight: 180,
                              height: 180,
                              maxWidth: 180,
                              borderRadius: 8,
                              border: '1px solid #ccc',
                              cursor: 'pointer',
                              width: '100%',
                              objectFit: 'contain',
                              flex: 1,
                              display: 'block',
                              background: '#f9f9f9',
                              imageRendering: 'auto',
                              transition: 'transform 0.3s',
                              '&:hover': { transform: 'scale(1.04)' },
                            }}
                            onClick={() => handleOpenDialog(idx)}
                            onError={(e) => {
                              const img = e.currentTarget as HTMLImageElement;
                              // If we started with blob, attempt first chain URL, else progress chain
                              const startedBlob = blobList.length > 0 && img.src.startsWith('blob:');
                              const chainRaw = img.dataset.fallbackChain || '';
                              const parts = chainRaw.split('|').filter(Boolean);
                              const currentIdx = Number(img.dataset.fallbackIndex || '0');
                              if (startedBlob) {
                                img.dataset.fallbackIndex = '0';
                                img.src = withToken(parts[0]);
                                return;
                              }
                              const nextIdx = currentIdx + 1;
                              if (nextIdx < parts.length) {
                                img.dataset.fallbackIndex = String(nextIdx);
                                img.src = withToken(parts[nextIdx]);
                              } else {
                                img.onerror = null;
                                img.src = '/default-image.png';
                                console.warn('Image fallback exhausted for', original);
                              }
                            }}
                            title={original || 'No image URL'}
                          />
                        </Box>
                        <Typography variant="caption" sx={{ mt: 1 }}>
                          1 / {Math.max(blobList.length, urls.length)}
                        </Typography>
                      </Box>
                    );
                  }
                  // Non-watch items: retain original simple rendering
                  return (
                    <Box
                      sx={{
                        flex: 1,
                        height: 200,
                        minWidth: 120,
                        maxWidth: 200,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          component="img"
                          src={(() => {
                            if (blobList.length > 0) return blobList[0];
                            let url = urls[idx];
                            if (!url) return '';
                            if (token && !url.includes('token=')) {
                              url += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
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
                            border: '1px solid #ccc',
                            cursor: 'pointer',
                            width: '100%',
                            objectFit: 'contain',
                            flex: 1,
                            display: 'block',
                            background: '#f9f9f9',
                            imageRendering: 'auto',
                            transition: 'transform 0.3s',
                            '&:hover': { transform: 'scale(1.04)' },
                          }}
                          onClick={() => handleOpenDialog(idx)}
                          onError={(e) => {
                            // Fallback sequence: if blob failed, try original URL, else default
                            const img = e.currentTarget as HTMLImageElement;
                            if (blobList.length > 0 && img.src.startsWith('blob:') && urls.length > 0) {
                              let url = urls[0];
                              if (token && url && !url.includes('token=')) {
                                url += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
                              }
                              img.src = url;
                              return;
                            }
                            img.onerror = null;
                            img.src = '/default-image.png';
                          }}
                          title={urls[idx] || 'No image URL'}
                        />
                      </Box>
                      <Typography variant="caption" sx={{ mt: 1 }}>
                        1 / {Math.max(blobList.length, urls.length)}
                      </Typography>
                    </Box>
                  );
                })()
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 180,
                  }}
                >
                  <Box
                    component="img"
                    src="/default-image.png"
                    alt="No Image"
                    sx={{ maxHeight: 120, maxWidth: 120, opacity: 0.5, mb: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    No Image
                  </Typography>
                </Box>
              )}
            </Box>
          );
        },
      },
      {
        accessorKey: "ps",
        header: "PS",
        Cell: ({ row }) => (
          <Typography variant="body2">
            {resolvePsLabel(row.original.ps)}
          </Typography>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1 }}>
            {canChangePs && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleOpenChangePsDialog(row.original)}
                disabled={!psOptions.length}
              >
                Change PS
              </Button>
            )}
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleOpenEditModelDialog(row.original)}
            >
              Edit Model
            </Button>
          </Box>
        ),
      },
      {
        accessorKey: "id_fact",
        header: "ID",
        size: 30,
      },

      {
        header: "Model",
        size: 120,
        accessorFn: (row) => {
          let watch: any = undefined;
          const dp: any = row.DistributionPurchase;
          if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
            watch = dp[0]?.OriginalAchatWatch;
          } else if (dp && typeof dp === "object") {
            watch = dp?.OriginalAchatWatch;
          }
          return (
            (watch && (watch.model || watch.Model)) ||
            row.Model ||
            row.model ||
            row.Design_art ||
            row.desig_art ||
            ""
          );
        },
        Cell: ({ row }) => {
          let watch: any = undefined;
          const dp: any = row.original.DistributionPurchase;
          if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
            watch = dp[0]?.OriginalAchatWatch;
          } else if (dp && typeof dp === "object") {
            watch = dp?.OriginalAchatWatch;
          }
          const value =
            (watch && (watch.model || watch.Model)) ||
            row.original.Model ||
            row.original.model ||
            row.original.Design_art ||
            row.original.desig_art ||
            "";
          return <Typography variant="body2">{value || "-"}</Typography>;
        },
      },

      {
        accessorFn: (row) => row.Fournisseur?.client_name,
        header: "Brand",
        size: 120,
        Cell: ({ row }) => {
          const brand = row.original.Fournisseur?.client_name;
          // Safely extract watch details for nickname
          let watch: any = undefined;
          const dp: any = row.original.DistributionPurchase;
          if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
            watch = dp[0]?.OriginalAchatWatch;
          } else if (dp && typeof dp === "object") {
            watch = dp?.OriginalAchatWatch;
          }
          const nickname = watch?.common_local_brand;
          return (
            <Box
              sx={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {brand || "-"}
              </Typography>
              {nickname ? (
                <Typography variant="caption" color="text.secondary">
                  {nickname}
                </Typography>
              ) : null}
            </Box>
          );
        },
      },

      {
        header: "Nickname",
        size: 120,
        accessorFn: (row) => {
          let watch: any = undefined;
          const dp: any = row.DistributionPurchase;
          if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
            watch = dp[0]?.OriginalAchatWatch;
          } else if (dp && typeof dp === "object") {
            watch = dp?.OriginalAchatWatch;
          }
          return watch?.common_local_brand || "";
        },
        Cell: ({ row }) => {
          let watch: any = undefined;
          const dp: any = row.original.DistributionPurchase;
          if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
            watch = dp[0]?.OriginalAchatWatch;
          } else if (dp && typeof dp === "object") {
            watch = dp?.OriginalAchatWatch;
          }
          const nickname = watch?.common_local_brand;
          return (
            <Typography variant="body2">
              {nickname || "-"}
            </Typography>
          );
        },
      },

      {
        header: "Details",
        id: "details",
        size: 300,
        Cell: ({ row }) => {
          const watch = row.original.DistributionPurchase?.OriginalAchatWatch;
          if (!watch)
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
                gap: 1,
                alignItems: "center",
              }}
            >
              {watch.model && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Model:</b> {watch.model}
                </Typography>
              )}
              {watch.id_achat && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>system Original ref.:</b> {watch.id_achat}
                </Typography>
              )}
              {watch.reference_number && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Ref.:</b> {watch.reference_number}
                </Typography>
              )}
              {watch.serial_number && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Serial No.:</b> {watch.serial_number}
                </Typography>
              )}
              {watch.movement && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Movement:</b> {watch.movement}
                </Typography>
              )}
              {watch.caliber && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Caliber:</b> {watch.caliber}
                </Typography>
              )}
              {watch.gender && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Gender:</b> {watch.gender}
                </Typography>
              )}
              {watch.condition && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Condition:</b> {watch.condition}
                </Typography>
              )}
              {watch.diamond_total_carat && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Diamond Carat:</b> {watch.diamond_total_carat}
                </Typography>
              )}
              {watch.diamond_quality && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Diamond Quality:</b> {watch.diamond_quality}
                </Typography>
              )}
              {watch.diamond_setting && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Diamond Setting:</b> {watch.diamond_setting}
                </Typography>
              )}
              {watch.number_of_diamonds && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Diamonds #:</b> {watch.number_of_diamonds}
                </Typography>
              )}
              {watch.custom_or_factory && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Custom/Factory:</b> {watch.custom_or_factory}
                </Typography>
              )}
              {watch.case_material && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Case Material:</b> {watch.case_material}
                </Typography>
              )}
              {watch.case_size && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Case Size:</b> {watch.case_size}
                </Typography>
              )}
              {watch.bezel && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Bezel:</b> {watch.bezel}
                </Typography>
              )}
              {watch.bracelet_type && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Bracelet Type:</b> {watch.bracelet_type}
                </Typography>
              )}
              {watch.bracelet_material && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Bracelet Material:</b> {watch.bracelet_material}
                </Typography>
              )}
              {watch.dial_color && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Dial Color:</b> {watch.dial_color}
                </Typography>
              )}
              {watch.dial_style && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Dial Style:</b> {watch.dial_style}
                </Typography>
              )}
              {watch.crystal && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Crystal:</b> {watch.crystal}
                </Typography>
              )}
              {watch.water_resistance && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Water Resistance:</b> {watch.water_resistance}
                </Typography>
              )}
              {watch.functions && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Functions:</b> {watch.functions}
                </Typography>
              )}
              {watch.power_reserve && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Power Reserve:</b> {watch.power_reserve}
                </Typography>
              )}
              {typeof watch.box_papers !== "undefined" && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Box/Papers:</b> {watch.box_papers ? "Yes" : "No"}
                </Typography>
              )}
              {watch.warranty && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Warranty:</b> {watch.warranty}
                </Typography>
              )}
              {watch.common_local_brand && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Nickname:</b> {watch.common_local_brand}
                </Typography>
              )}
            </Box>
          );
        },
      },
    ],
    [
      images,
      imageUrls,
      resolvePsLabel,
      canChangePs,
      psOptions,
      handleOpenChangePsDialog,
      handleOpenEditModelDialog,
    ]
  );

  // Filter states (sidebar)
  const [brandFilter, setBrandFilter] = useState<string>("");
  const [productName, setProductName] = useState<string>("");
  const [refCode, setRefCode] = useState<string>("");
  const [costMin, setCostMin] = useState<string>("");
  const [costMax, setCostMax] = useState<string>("");

  // Permission: whether user can see and filter by cost (SellingPrice/price_per_carat)
  const [canSeeCost, setCanSeeCost] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadRoles = async () => {
      try {
        const res = await axios.get(`/me`);
        const payload = res?.data;
        const u = (payload as any) || {};
        const roles = u?.Action_user;

        let next = false;
        if (Array.isArray(roles)) {
          next = roles.some((r: any) =>
            String(r).toLowerCase().includes("show cost")
          );
        } else if (typeof roles === "string") {
          next = roles.toLowerCase().includes("show cost");
        }

        if (!cancelled) setCanSeeCost(next);
      } catch {
        // keep previous canSeeCost value on error
      }
    };

    // initial load
    loadRoles();

    // refresh every 10 seconds to reflect DB changes
    const id = setInterval(loadRoles, 10000);
    return () => {
      cancelled = true;
      clearInterval(id as unknown as number);
    };
  }, []);

  const distinctBrands = useMemo(() => {
    const s = new Set<string>();
    data.forEach((row) => {
      const b = row.Fournisseur?.client_name;
      if (b) s.add(b);
    });
    return Array.from(s).sort();
  }, [data]);

  // Apply simple filters for Watch inventory (brand, product name, reference)
  const filteredData = useMemo(() => {
    const brandQ = brandFilter.trim().toLowerCase();
    const nameQ = productName.trim().toLowerCase();
    const refQ = refCode.trim().toLowerCase();
    const min = costMin ? Number(costMin) : null;
    const max = costMax ? Number(costMax) : null;
    return data.filter((row) => {
      const watch: any =
        (Array.isArray(row.DistributionPurchase)
          ? row.DistributionPurchase[0]?.OriginalAchatWatch
          : row.DistributionPurchase?.OriginalAchatWatch) || {};
      const brand = (row.Fournisseur?.client_name || "").toLowerCase();
      const name = (
        row.desig_art ||
        watch.common_local_brand ||
        ""
      )
        .toString()
        .toLowerCase();
      const refVal = (watch.reference_number || "").toString().toLowerCase();
      const priceVal = (() => {
        const p = watch.SellingPrice ?? watch.price_per_carat ?? 0;
        const n =
          typeof p === "number"
            ? p
            : Number(String(p).replace(/[^0-9.-]/g, ""));
        return isNaN(n) ? 0 : n;
      })();
      const brandOk = !brandQ || brand.includes(brandQ);
      const nameOk = !nameQ || name.includes(nameQ);
      const refOk = !refQ || refVal.includes(refQ);
      const minOk = !canSeeCost || min === null || priceVal >= min;
      const maxOk = !canSeeCost || max === null || priceVal <= max;
      return brandOk && nameOk && refOk && minOk && maxOk;
    });
  }, [data, brandFilter, productName, refCode, costMin, costMax, canSeeCost]);

  const table = useMaterialReactTable({
    columns,
    data: filteredData,
    state: { isLoading: loading, density: "compact" },
    enableDensityToggle: true,
    initialState: {
      pagination: {
        pageSize: 5,
        pageIndex: 0,
      },
    },
  });

  const itemCount = useMemo(() => filteredData.length, [filteredData]);

  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [dialogImages, setDialogImages] = useState<string[]>([]);
  const [dialogIndex, setDialogIndex] = useState(0);

  // Helper to convert blob/object URL to base64 data URL (high quality, larger canvas)
  const getBase64FromUrl = (url: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "Anonymous";
      img.onload = function () {
        // Use a much larger canvas for better quality
        const canvas = document.createElement("canvas");
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, 300, 300);
          resolve(canvas.toDataURL("image/png", 1.0));
        } else {
          resolve(null);
        }
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = url;
    });
  };

  // (PDF export removed; Excel & HTML export retained)

  // HTML Export Handler
  const handleExportHTML = async () => {
    let html = `<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Watch Inventory List</title><style>
      body { font-family: Arial, sans-serif; background: #f7f7f7; margin: 0; padding: 24px; }
      h2 { color: #17618c; }
      table { border-collapse: collapse; width: 100%; background: #fff; box-shadow: 0 2px 8px #0001; }
      th, td { border: 1px solid #e0e0e0; padding: 10px 8px; text-align: center; }
      th { background: #17618c; color: #fff; font-size: 1.05em; }
      tr:nth-child(even) { background: #f3f8fa; }
      img { max-width: 90px; max-height: 90px; border-radius: 8px; border: 1px solid #ccc; background: #fafafa; }
      .details { text-align: left; font-size: 0.98em; }
    </style></head><body>`;
    html += `<h2>Watch Inventory List</h2>`;
    html += `<table><thead><tr>`;
    html += `<th style='width:90px;'>Image</th><th style='width:60px;'>ID</th><th style='width:90px;'>Brand</th><th style='width:90px;'>Type</th><th style='width:420px;'>Details</th>`;
    html += `</tr></thead><tbody>`;
    for (const row of data) {
      let imageKey;
      let watch;
      let dp = row.DistributionPurchase;
      if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
        watch = dp[0]?.OriginalAchatWatch;
        imageKey = watch?.id_achat;
      } else if (dp && typeof dp === "object") {
        watch = dp?.OriginalAchatWatch;
        imageKey = watch?.id_achat;
      }
      if (!imageKey) imageKey = row.id_fact;
      const imageKeyStr = String(imageKey);
      const imgUrl = images[imageKeyStr]?.[0];
      let imgTag = `<span style='color:#aaa;'>No Image</span>`;
      if (imgUrl) {
        // Convert to base64 for HTML export
        // eslint-disable-next-line no-await-in-loop
        const base64 = await getBase64FromUrl(imgUrl);
        if (base64) {
          imgTag = `<img src='${base64}' alt='' />`;
        }
      }
      let details = "";
      if (watch) {
        details =
          (watch.id_achat ? `| system Original ref.: ${watch.id_achat} ` : "") +
          (watch.reference_number ? `| Ref.: ${watch.reference_number} ` : "") +
          (watch.serial_number ? `| Serial No.: ${watch.serial_number} ` : "") +
          (watch.movement ? `| Movement: ${watch.movement} ` : "") +
          (watch.caliber ? `| Caliber: ${watch.caliber} ` : "") +
          (watch.gender ? `| Gender: ${watch.gender} ` : "") +
          (watch.condition ? `| Condition: ${watch.condition} ` : "") +
          (watch.diamond_total_carat
            ? `| Diamond Carat: ${watch.diamond_total_carat} `
            : "") +
          (watch.diamond_quality
            ? `| Diamond Quality: ${watch.diamond_quality} `
            : "") +
          (watch.diamond_setting
            ? `| Diamond Setting: ${watch.diamond_setting} `
            : "") +
          (watch.number_of_diamonds
            ? `| Diamonds #: ${watch.number_of_diamonds} `
            : "") +
          (watch.custom_or_factory
            ? `| Custom/Factory: ${watch.custom_or_factory} `
            : "") +
          (watch.case_material
            ? `| Case Material: ${watch.case_material} `
            : "") +
          (watch.case_size ? `| Case Size: ${watch.case_size} ` : "") +
          (watch.bezel ? `| Bezel: ${watch.bezel} ` : "") +
          (watch.bracelet_type
            ? `| Bracelet Type: ${watch.bracelet_type} `
            : "") +
          (watch.bracelet_material
            ? `| Bracelet Material: ${watch.bracelet_material} `
            : "") +
          (watch.dial_color ? `| Dial Color: ${watch.dial_color} ` : "") +
          (watch.dial_style ? `| Dial Style: ${watch.dial_style} ` : "") +
          (watch.crystal ? `| Crystal: ${watch.crystal} ` : "") +
          (watch.water_resistance
            ? `| Water Resistance: ${watch.water_resistance} `
            : "") +
          (watch.functions ? `| Functions: ${watch.functions} ` : "") +
          (watch.power_reserve
            ? `| Power Reserve: ${watch.power_reserve} `
            : "") +
          (typeof watch.box_papers !== "undefined"
            ? `| Box/Papers: ${watch.box_papers ? "Yes" : "No"} `
            : "") +
          (watch.warranty ? `| Warranty: ${watch.warranty} ` : "");
      }
      html += `<tr>`;
      html += `<td>${imgTag}</td>`;
      html += `<td style='width:60px;'>${row.id_fact}</td>`;
      html += `<td style='width:90px;'>${row.Fournisseur?.client_name || ""}</td>`;
      html += `<td style='width:90px;'>${row.Fournisseur?.TYPE_SUPPLIER || ""}</td>`;
      html += `<td class='details' style='width:420px;'>${details}</td>`;
      html += `</tr>`;
    }
    html += `</tbody></table></body></html>`;
    // Download
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory_list.html";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  // Export dialog state (pattern similar to GInventory)
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFilterType, setExportFilterType] = useState<"all" | "brand" | "model" | "ref">("all");
  const [exportBrand, setExportBrand] = useState("");
  const [exportModel, setExportModel] = useState("");
  const [exportRef, setExportRef] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState("");

  // Excel Export Handler (exports data with export dialog-specific filters applied)
  const handlePerformExportExcel = async () => {
    setExporting(true);
    setExportProgress(0);
    setExportError("");

    let exportData = filteredData;
    if (exportFilterType === 'brand' && exportBrand) {
      exportData = filteredData.filter(r => (r.Fournisseur?.client_name || '').toLowerCase() === exportBrand.toLowerCase());
    } else if (exportFilterType === 'model' && exportModel) {
      const q = exportModel.toLowerCase();
      exportData = filteredData.filter(r => {
        const m = (
          r.Model ||
          r.model ||
          r.Design_art ||
          r.desig_art ||
          ''
        )
          .toString()
          .toLowerCase();
        return m.includes(q);
      });
    } else if (exportFilterType === 'ref' && exportRef) {
      exportData = filteredData.filter(r => {
        const dp: any = r.DistributionPurchase;
        let watch: any = undefined;
        if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === 'object') watch = dp[0]?.OriginalAchatWatch;
        else if (dp && typeof dp === 'object') watch = dp?.OriginalAchatWatch;
        return (watch?.reference_number || '').toString().toLowerCase().includes(exportRef.toLowerCase());
      });
    }

    try {
      const generateExportMhtml = async (rows: any[]) => {
        const parseDataUrl = (dataUrl: string): { mime: string; base64: string } | null => {
          const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
          if (!match) return null;
          return { mime: match[1] || "image/jpeg", base64: match[2] };
        };

        const keyToCidImages: Record<string, { cid: string; mime: string; base64: string }[]> = {};
        const allImages: { cid: string; mime: string; base64: string }[] = [];
        let idx = 1;
        let globalImageCount = 0;
        let truncated = false;

        const neededKeys = new Set<string>();
        rows.forEach((row: any) => {
          let imageKey: any;
          const dp = row.DistributionPurchase;
          if (Array.isArray(dp) && dp.length > 0) imageKey = dp[0]?.OriginalAchatWatch?.id_achat;
          else if (dp && typeof dp === "object") imageKey = dp.OriginalAchatWatch?.id_achat;
          if (!imageKey) imageKey = row.id_fact;
          if (imageKey) neededKeys.add(String(imageKey));
        });

        const excelImgSize = EXPORT_IMG_SIZE;
        const defaultRowHeight = excelImgSize;

        for (const key of Array.from(neededKeys)) {
          if (truncated) break;
          const pic = Number(key);
          let candidateUrls: string[] = [];
          const preFetched = images[key];
          if (Array.isArray(preFetched) && preFetched.length) {
            candidateUrls = preFetched.slice();
          } else {
            candidateUrls = imageUrls[key] ? imageUrls[key].slice() : [];
          }
          if ((!candidateUrls || !candidateUrls.length) && pic) {
            try {
              candidateUrls = await fetchImageListForExport(pic);
            } catch {
              candidateUrls = [];
            }
          }

          const limited = candidateUrls.slice(0, 1); // Only first image for now
          const parts: { cid: string; mime: string; base64: string }[] = [];
          for (const rawUrl of limited) {
            if (globalImageCount >= EXPORT_MAX_IMAGES) {
              truncated = true;
              break;
            }
            try {
              let url = ensureHttps(rawUrl);
              const token = localStorage.getItem("token");
              if (token && !/^blob:|^data:/i.test(url)) {
                try {
                  const u = new URL(url, window.location.origin);
                  if (!u.searchParams.has("token")) u.searchParams.set("token", token);
                  url = u.toString();
                } catch {
                  url = url + (url.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
                }
              }
              const down = await fetchAndDownscaleToBase64(url, EXPORT_IMG_SIZE);
              if (!down) continue;
              const parsed = parseDataUrl(down);
              if (!parsed) continue;
              const cid = `image${String(idx++).padStart(4, "0")}`;
              const part = { cid, mime: parsed.mime, base64: parsed.base64 };
              parts.push(part);
              allImages.push(part);
              globalImageCount++;
            } catch {
              // skip
            }
          }
          keyToCidImages[key] = parts;
        }

        const headers = [
          "ID", "Model", "Brand", "Supplier Type", "Responsible", "Reference", "Serial", "Movement",
          "Caliber", "Gender", "Condition", "Case Size", "Case Material", "Bezel", "Bracelet Type",
          "Bracelet Material", "Dial Color", "Dial Style", "Crystal", "Water Resistance", "Functions",
          "Power Reserve", "Diamond Carat", "Diamond Quality", "Diamond Setting", "Diamonds #",
          "Custom/Factory", "Box/Papers", "Warranty", "Nickname"
        ];

        let html = `
        <html><head><meta charset="utf-8" /><title>Watch Inventory Export</title>
        <style>
          body { font-family: Roboto, 'Segoe UI', Arial, sans-serif; }
          table { width: 98%; margin: 8px auto; border-collapse: collapse; }
          th, td { border: 1px solid #e0e0e0; padding: 8px; vertical-align: top; }
          th { background: #f5f5f5; font-weight: 700; }
          .img-row img { width: ${excelImgSize}px; height: ${excelImgSize}px; object-fit: cover; border-radius:4px; border:1px solid #eee; }
        </style></head><body>
        <h2 style="margin-left:12px;color:#1976d2">Watch Inventory</h2>
        <table><thead><tr><th>Image</th>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>`;

        for (const row of rows) {
          let imageKey: any;
          const dp = row.DistributionPurchase;
          if (Array.isArray(dp) && dp.length > 0) imageKey = dp[0]?.OriginalAchatWatch?.id_achat;
          else if (dp && typeof dp === "object") imageKey = dp.OriginalAchatWatch?.id_achat;
          if (!imageKey) imageKey = row.id_fact;
          const key = String(imageKey);

          const watch = (Array.isArray(dp) && dp.length > 0)
            ? dp[0]?.OriginalAchatWatch
            : (dp && typeof dp === 'object' ? dp.OriginalAchatWatch : undefined);

          // Prefer the same source used by the table's Model column
          // (Design_art on Purchase), then fallback to Purchase.Model
          // and finally to the underlying watch model/common name.
          const modelValue =
            row.Design_art ||
            row.Model ||
            row.desig_art ||
            watch?.model ||
            watch?.Model ||
            watch?.common_local_brand ||
            "";

          const cellValues = [
            row.id_fact,
            modelValue,
            row.Fournisseur?.client_name || "", row.Fournisseur?.TYPE_SUPPLIER || "",
            row.user?.name_user || "", watch?.reference_number || "", watch?.serial_number || "", watch?.movement || "",
            watch?.caliber || "", watch?.gender || "", watch?.condition || "", watch?.case_size || "",
            watch?.case_material || "", watch?.bezel || "", watch?.bracelet_type || "", watch?.bracelet_material || "",
            watch?.dial_color || "", watch?.dial_style || "", watch?.crystal || "", watch?.water_resistance || "",
            watch?.functions || "", watch?.power_reserve || "", watch?.diamond_total_carat || "",
            watch?.diamond_quality || "", watch?.diamond_setting || "", watch?.number_of_diamonds || "",
            watch?.custom_or_factory || "", typeof watch?.box_papers !== "undefined" ? (watch.box_papers ? "Yes" : "No") : "",
            watch?.warranty || "", watch?.common_local_brand || ""
          ];

          const imgs = keyToCidImages[key] || [];
          let imagesHtml = "";
          if (imgs.length > 0) {
            imagesHtml = `<div class='img-row'><img src='cid:${imgs[0].cid}' alt='img' /></div>`;
          } else {
            imagesHtml = `<span style='color:#9e9e9e'>No Image</span>`;
          }

          html += `<tr style="height:${defaultRowHeight}px; mso-height-source:userset;"><td>${imagesHtml}</td>${cellValues.map((v) => `<td>${String(v ?? '')}</td>`).join("")}</tr>`;
        }

        html += `</tbody></table><div style="margin:12px;font-size:12px;color:#666">Generated on ${new Date().toLocaleString()}</div></body></html>`;

        const boundary = "----=_NextPart_000_0000";
        const EOL = "\r\n";
        let mhtml = `MIME-Version: 1.0${EOL}Content-Type: multipart/related; boundary="${boundary}"; type="text/html"${EOL}${EOL}`;
        mhtml += `--${boundary}${EOL}Content-Type: text/html; charset="utf-8"${EOL}Content-Transfer-Encoding: 8bit${EOL}${EOL}${html}${EOL}${EOL}`;

        allImages.forEach((img, i) => {
          mhtml += `--${boundary}${EOL}Content-Location: file:///image${i + 1}${EOL}Content-Transfer-Encoding: base64${EOL}Content-Type: ${img.mime}${EOL}Content-ID: <${img.cid}>${EOL}${EOL}`;
          for (let p = 0; p < img.base64.length; p += 76) {
            mhtml += img.base64.substring(p, p + 76) + EOL;
          }
          mhtml += EOL;
        });

        mhtml += `--${boundary}--${EOL}`;
        return { mhtml, diagnostics: { imageCount: globalImageCount, truncated } };
      };

      setExportProgress(10);
      const result = await generateExportMhtml(exportData);
      setExportProgress(90);
      const blob = new Blob([result.mhtml], { type: "application/vnd.ms-excel;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0];
      a.download = `watch_inventory_${stamp}.xls`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportProgress(100);
      setExporting(false);
    } catch (e: any) {
      setExportError(e?.message || "Export failed");
      setExporting(false);
    }
  };

  return (
    <Box p={0.5}>
      {/* Change PS Dialog */}
      <Dialog
        open={psDialogOpen}
        onClose={handleClosePsDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Change Point of Sale</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            margin="normal"
            label="Point of Sale"
            value={psSelection}
            onChange={(e) => {
              setPsSelection(e.target.value);
              setPsDialogError("");
            }}
            disabled={psSaving}
          >
            {psOptions.map((opt) => (
              <MenuItem key={opt.id} value={opt.id}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          {psDialogError && (
            <Typography color="error" variant="body2">
              {psDialogError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePsDialog} disabled={psSaving}>
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

      {/* Edit Model Dialog */}
      <Dialog
        open={modelDialogOpen}
        onClose={handleCloseModelDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Edit Watch Model</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={WATCH_MODEL_OPTIONS}
            freeSolo
            value={modelSelection}
            onInputChange={(_e, v) => {
              setModelSelection(v);
              setModelDialogError("");
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Model"
                required
                margin="normal"
                error={!!modelDialogError}
                helperText={
                  modelDialogError ||
                  "Choose a model from the list or type a custom one."
                }
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModelDialog} disabled={modelSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveModelChange}
            disabled={modelSaving || !modelSelection.trim()}
            variant="contained"
          >
            {modelSaving ? "Updating..." : "Update"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Dialog */}
      <Dialog
        open={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Product Images</DialogTitle>
        <DialogContent>
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
            {dialogImages.length > 0 ? (
              <>
                <IconButton
                  size="large"
                  sx={{
                    position: "absolute",
                    left: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                  onClick={() =>
                    setDialogIndex(
                      (idx) =>
                        (idx - 1 + dialogImages.length) % dialogImages.length
                    )
                  }
                  aria-label="Previous image"
                >
                  {"\u2039"}
                </IconButton>
                <img
                  src={dialogImages[dialogIndex]}
                  alt={`Product ${dialogIndex + 1}`}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "80vh",
                    objectFit: "contain",
                    margin: "0 auto",
                    display: "block",
                  }}
                />
                <IconButton
                  size="large"
                  sx={{
                    position: "absolute",
                    right: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                  onClick={() =>
                    setDialogIndex((idx) => (idx + 1) % dialogImages.length)
                  }
                  aria-label="Next image"
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
                  }}
                >
                  {dialogIndex + 1} / {dialogImages.length}
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

      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: "bold" }}>
          Watch Inventory List
        </Typography>
        <Box sx={{ display: "flex", gap: 2 }}>
          <Box
            sx={{
              backgroundColor: "error.main",
              color: "inherit",
              px: 1.5,
              py: 0.5,
              borderRadius: 4,
              fontSize: "0.9rem",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <Typography variant="body2" style={{ fontWeight: "500" }}>
              Items Count: {itemCount.toLocaleString()}
            </Typography>
          </Box>

          <Button
            variant="contained"
            color="success"
            onClick={handleExportHTML}
            sx={{
              borderRadius: 3,
              textTransform: "none",
              fontWeight: "bold",
              px: 3,
              py: 1,
              ml: 1,
              boxShadow: 2,
            }}
          >
            Export HTML
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<ImportExportIcon />}
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
        </Box>
      </Box>

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
            border: `1px solid ${theme.palette.divider}`,
          })}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            Filters
          </Typography>

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
              placeholder="e.g. Model X"
            />
          </Box>

          <Box>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, display: "block", mb: 0.5 }}
            >
              Reference
            </Typography>
            <TextField
              size="small"
              fullWidth
              value={refCode}
              onChange={(e) => setRefCode(e.target.value)}
              placeholder="Ref number"
            />
          </Box>

          <Box>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, display: "block", mb: 0.5 }}
            >
              Price
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

          <Button
            variant="contained"
            onClick={() => {
              setBrandFilter("");
              setProductName("");
              setRefCode("");
              setCostMin("");
              setCostMax("");
            }}
            sx={{ fontWeight: 700 }}
          >
            Reset Filters
          </Button>
        </Box>

        {/* Table area */}
        <Box sx={{ flex: 1 }}>
          {loading ? (
            <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
              <CircularProgress />
            </Box>
          ) : filteredData.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No items
            </Typography>
          ) : (
            <MaterialReactTable table={table} />
          )}
        </Box>
      </Box>
      {/* Export Filter Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Export Watch Inventory</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {exporting ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 3 }}>
                <CircularProgress />
                <Typography>Exporting... {exportProgress}%</Typography>
                {exportError && <Typography color="error">{exportError}</Typography>}
              </Box>
            ) : (
              <>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Filter (applies to current view)</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button size="small" variant={exportFilterType === 'all' ? 'contained' : 'outlined'} onClick={() => setExportFilterType('all')}>All</Button>
                  <Button size="small" variant={exportFilterType === 'brand' ? 'contained' : 'outlined'} onClick={() => setExportFilterType('brand')}>By Brand</Button>
                  <Button size="small" variant={exportFilterType === 'model' ? 'contained' : 'outlined'} onClick={() => setExportFilterType('model')}>By Model</Button>
                  <Button size="small" variant={exportFilterType === 'ref' ? 'contained' : 'outlined'} onClick={() => setExportFilterType('ref')}>By Reference</Button>
                </Box>
                {exportFilterType === 'brand' && (
                  <TextField select label="Brand" size="small" value={exportBrand} onChange={e => setExportBrand(e.target.value)} fullWidth>
                    <MenuItem value="">(choose)</MenuItem>
                    {distinctBrands.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                  </TextField>
                )}
                {exportFilterType === 'model' && (
                  <TextField label="Model contains" size="small" value={exportModel} onChange={e => setExportModel(e.target.value)} fullWidth />
                )}
                {exportFilterType === 'ref' && (
                  <TextField label="Reference contains" size="small" value={exportRef} onChange={e => setExportRef(e.target.value)} fullWidth />
                )}
                <Typography variant="caption" color="text.secondary">Images will be embedded in the exported file.</Typography>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)} color="inherit" disabled={exporting}>Cancel</Button>
          <Button
            onClick={handlePerformExportExcel}
            variant="contained"
            disabled={exporting || (exportFilterType === 'brand' && !exportBrand) || (exportFilterType === 'model' && !exportModel) || (exportFilterType === 'ref' && !exportRef)}
          >
            Export
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WInventory;
