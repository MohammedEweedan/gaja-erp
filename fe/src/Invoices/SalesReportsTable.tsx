import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Tooltip,
  IconButton,
  Collapse,
} from "@mui/material";
import axios from "../api";
import LockIcon from "@mui/icons-material/Lock";
import { useNavigate } from "react-router-dom";
import { buildEncryptedClientPath, buildEncryptedSellerPath } from "../utils/routeCrypto";
import { useTheme } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';
import FileCopyIcon from "@mui/icons-material/FileCopy";
import FileDownload from "@mui/icons-material/FileDownload";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

import PrintInvoiceDialog from "../Invoices/ListCardInvoice/Gold Invoices/PrintInvoiceDialog";
import ChiraReturnPage from "./ChiraReturnPage";

// Helper function to format date/time with proper timezone handling
const formatDateTime = (dateString: string | null) => {
  if (!dateString) return "";
  
  try {
    // Parse the date string and handle timezone properly
    const date = new Date(dateString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) return "";
    
    // Get the components in UTC to avoid timezone conversion issues
    let hours = date.getUTCHours();
    const minutes = date.getUTCMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    
    return `${hours}:${minutes} ${ampm}`;
  } catch (error) {
    console.error("Error formatting date:", error);
    return "";
  }
};

async function convertBlobToPngDataUrl(blob: Blob): Promise<string> {
  const drawOnCanvas = (img: CanvasImageSource, width: number, height: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = width || 1;
    canvas.height = height || 1;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  };

  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    return drawOnCanvas(bitmap, bitmap.width, bitmap.height);
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        resolve(drawOnCanvas(img, img.width, img.height));
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.src = objectUrl;
  });
}

async function convertAvifUrlToPngBase64(url: string, token?: string): Promise<string> {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(url, { mode: "cors", headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch AVIF image (${res.status})`);
  }
  const blob = await res.blob();
  return convertBlobToPngDataUrl(blob);
}

// Helper function to format date with proper timezone handling
const formatDate = (dateString: string | null) => {
  if (!dateString) return "";
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    
    // Return in DD-MM-YYYY format using UTC to avoid timezone issues
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = date.getUTCDate().toString().padStart(2, "0");
    
    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString || "";
  }
};

const stripInternalMetaTags = (raw: any): string => {
  let s = String(raw ?? "");
  const cut = (marker: string) => {
    const idx = s.lastIndexOf(marker);
    if (idx >= 0) s = s.slice(0, idx);
  };
  cut("__DSMETA__");
  cut("__META__");
  return s.replace(/\s*\|?\s*$/g, "").trim();
};

// Standard thumbnail size in on-screen table is 80px. For export we use smaller + caps to keep file size manageable.
const EXPORT_IMG_SIZE = 55; // px size for exported thumbnails (HTML + Excel)
const EXPORT_IMG_QUALITY = 0.7; // base JPEG quality for export
const EXPORT_MAX_IMAGES = 800; // global cap of embedded images across entire export
const EXPORT_FALLBACK_COLOR = "#f0f0f0";

const formatWholeAmount = (value: any, opts?: { allowNegative?: boolean }) => {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return "0";
  const normalized = opts?.allowNegative ? raw : Math.max(0, raw);
  // Remove decimals without changing the integer part (truncate toward 0).
  const whole = Math.trunc(normalized);
  return whole.toLocaleString(undefined, {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
};

const toFiniteNumber = (value: any): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[, ]+/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const PS_CODE_LOOKUP: Record<string, string> = {
  "0": "P0",
  "1": "P1",
  "2": "P2",
  "3": "P3",
  "4": "P4",
  P0: "P0",
  P1: "P1",
  P2: "P2",
  P3: "P3",
  P4: "P4",
  OG: "OG",
  "O.G": "OG",
  "ORIG": "OG",
  "ORIGINAL": "OG",
  "ORIGINAL GOLD": "OG",
};

const resolvePointOfSaleCode = (value: any): string => {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const normalized = raw.toUpperCase();
  if (PS_CODE_LOOKUP[normalized]) return PS_CODE_LOOKUP[normalized];
  const digits = normalized.replace(/\D/g, "");
  if (digits && PS_CODE_LOOKUP[digits]) return PS_CODE_LOOKUP[digits];
  if (normalized.includes("OG")) return "OG";
  if (/^P\d$/i.test(normalized)) return normalized.toUpperCase();
  return raw;
};

// Utility: fetch image URL (already tokenized) and downscale to fixed size JPEG base64 to reduce XLS size
async function fetchAndDownscaleToBase64(
  rawUrl: string,
  size: number
): Promise<string | null> {
  try {
    const resp = await fetch(rawUrl, { method: "GET" });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    // If already tiny just convert to base64 directly
    if (blob.size < 3500) {
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    }
    // (no filtering logic should be in this utility)
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
    // object-fit: cover logic
    const ratio = Math.max(size / img.width, size / img.height);
    const nw = img.width * ratio;
    const nh = img.height * ratio;
    const dx = (size - nw) / 2;
    const dy = (size - nh) / 2;
    ctx.fillStyle = EXPORT_FALLBACK_COLOR; // background to avoid black bars
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, dx, dy, nw, nh);
    let dataUrl = canvas.toDataURL("image/jpeg", EXPORT_IMG_QUALITY);
    URL.revokeObjectURL(img.src);
    // If still large, lower quality further
    if (dataUrl.length > 25000) dataUrl = canvas.toDataURL("image/jpeg", 0.55);
    if (dataUrl.length > 40000) dataUrl = canvas.toDataURL("image/jpeg", 0.4);
    return dataUrl;
  } catch {
    // fallback raw base64
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

// Direct fetch of image list for export (avoids relying solely on cached state when many rows)
async function fetchImageListForExport(
  id: number,
  supplierType?: string
): Promise<string[]> {
  const token = localStorage.getItem("token");
  const API_BASEImage = "/images";
  const IMAGE_BASES = (() => {
    try {
      const base = (axios as any)?.defaults?.baseURL;
      if (base) {
        const u = new URL(base, window.location.origin);
        const cleanPath = u.pathname.replace(/\/+$/, "");
        const origin = u.origin;
        const candidates: string[] = [];
        if (/\/api$/i.test(cleanPath)) {
          candidates.push(`${origin}${cleanPath}/images`.replace(/\/+$/, ""));
          candidates.push(`${origin}/images`);
        } else {
          candidates.push(`${origin}${cleanPath}/images`.replace(/\/+$/, ""));
          candidates.push(`${origin}/images`);
        }
        return Array.from(new Set(candidates.map((s) => s.replace(/\/+$/, ""))));
      }
      const o = new URL(window.location.origin);
      return [`${o.origin}/images`];
    } catch {
      return ["/images"];
    }
  })();
  const API_BASEImage_ABS = IMAGE_BASES[0] || "/images";
  const toApiImageAbsolute = (url: string): string => {
    try {
      if (!url) return url;
      if (url.startsWith("data:") || url.startsWith("blob:")) return url;
      if (/^https?:\/\//i.test(url) || url.startsWith("//")) return url;
      if (url.startsWith("/images/") || url.startsWith("/uploads/")) {
        const root = API_BASEImage_ABS.replace(/\/images\/?$/i, "");
        return `${root}${url}`;
      }
      return new URL(url, window.location.origin).toString();
    } catch {
      return url;
    }
  };
  const withToken = (rawUrl: string, token: string | null): string => {
    if (!token) return rawUrl;
    try {
      const u = new URL(rawUrl, window.location.origin);
      u.searchParams.delete("token");
      u.searchParams.append("token", token);
      return u.toString();
    } catch {
      if (!rawUrl) return rawUrl;
      if (/([?&])token=/.test(rawUrl)) return rawUrl;
      return rawUrl + (rawUrl.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
    }
  };
  const normalizeEntryToString = (it: any): string => {
    if (typeof it === "string") return it;
    if (it && typeof it === "object") return it.url || it.path || it.href || it.src || "";
    return "";
  };
  const t = supplierType?.toLowerCase() || "";
  let typed: "watches" | "diamond" | "gold" | undefined;
  if (t.includes("watches")) typed = "watches";
  else if (t.includes("diamond")) typed = "diamond";
  else if (t.includes("gold")) typed = "gold";
  const endpoints = typed
    ? [
      `${API_BASEImage}/list/${typed}/${id}`,
      `${API_BASEImage}/list/${id}`
    ]
    : [`${API_BASEImage}/list/${id}`];
  for (const url of endpoints) {
    try {
      const res = await axios.get(
        url,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );
      if (Array.isArray(res.data)) {
        return res.data
          .map((it: any) => {
            let u = normalizeEntryToString(it);
            if (!u) return "";
            if (u.startsWith("images/") || u.startsWith("uploads/")) u = "/" + u;
            try {
              const urlObj = new URL(u, window.location.origin);
              // Reduce to relative path when possible
              if (urlObj.pathname.startsWith("/api/images/")) {
                u = urlObj.pathname.replace(/^\/api/, "");
              } else if (urlObj.pathname.startsWith("/api/uploads/")) {
                u = urlObj.pathname.replace(/^\/api/, "");
              } else if (urlObj.pathname.startsWith("/images/") || urlObj.pathname.startsWith("/uploads/")) {
                u = urlObj.pathname;
              } else {
                u = urlObj.toString();
              }
            } catch {
              /* ignore */
            }

            // Rewrite legacy upload mounts to secure routes
            try {
              const t2 = new URL(u, window.location.origin);
              const parts = t2.pathname.split("/").filter(Boolean);
              const len = parts.length;
              if (len >= 3) {
                const filename = parts[len - 1];
                const idSeg = parts[len - 2];
                const mount = parts.slice(0, len - 2).join("/").toLowerCase();
                if (typed === "gold") {
                  if (mount.includes("uploads/goldpic") || mount.includes("uploads/opurchases/upload-attachment") || mount.includes("uploads/purchase")) {
                    u = `/images/gold/${encodeURIComponent(idSeg)}/${encodeURIComponent(filename)}`;
                  }
                }
                if (typed === "watches") {
                  if (mount.includes("uploads/watchpic")) {
                    u = `/images/watch/${encodeURIComponent(idSeg)}/${encodeURIComponent(filename)}`;
                  }
                }
              }
            } catch {
              /* ignore */
            }

            // Normalize watch routes (/images/:id/:file -> /images/watch/:id/:file)
            if (typed === "watches") {
              try {
                const obj = new URL(u, window.location.origin);
                const parts = obj.pathname.split("/");
                if (parts.length >= 4 && parts[1] === "images" && parts[2] !== "watches" && /^\d+$/.test(parts[2])) {
                  obj.pathname = ["", "images", "watches", parts[2], ...parts.slice(3)].join("/");
                  u = obj.pathname;
                }
              } catch {
                /* ignore */
              }
            }

            const abs = toApiImageAbsolute(u);
            return withToken(abs, token);
          })
          .filter(Boolean);
      }
    } catch {
      /* try next */
    }
  }
  return [];
}

/****************************************************************************************
 * 1) ADD THESE HELPERS / CONSTANTS (put near your other helpers, before SalesReportsTable)
 ****************************************************************************************/

const MONEY_EPS = 0.01;

const normalizeMoney = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const clamp0 = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

const pickNumber = (...values: any[]): number => {
  for (const val of values) {
    const num = toFiniteNumber(val);
    if (num !== null) return num;
  }
  return 0;
};

const pickFromKeys = (obj: any, keys: string[]): number => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v === undefined || v === null || v === "") continue;
    // Some endpoints return formatted numbers like "1,234.50". Handle that.
    const raw = typeof v === "string" ? v.replace(/,/g, "").trim() : v;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return 0;
};

const isAbsUrl = (u: string) => /^https?:\/\//i.test(u || "");
const BASE_URL: string = ""; // optionally: api.defaults.baseURL
const buildFileUrl = (maybeUrl?: string) => {
  const u = String(maybeUrl || "").trim();
  if (!u) return "";
  if (isAbsUrl(u)) return u;
  if (!BASE_URL) return u;
  return `${BASE_URL.replace(/\/$/, "")}/${u.replace(/^\//, "")}`;
};

function ImageWithFallback({
  src,
  alt,
  size = 52,
  onClick,
}: {
  src?: string | null;
  alt?: string;
  size?: number;
  onClick?: () => void;
}) {
  const [bad, setBad] = React.useState(false);

  const realSrc = !src || bad ? FALLBACK_IMG : src;

  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 2,
        overflow: "hidden",
        flexShrink: 0,
        bgcolor: "#f1f5f9",
        cursor: onClick ? "pointer" : "default",
        border: "1px solid #e2e8f0",
      }}
      onClick={onClick}
      title={onClick ? "Open image" : undefined}
    >
      <img
        src={realSrc}
        alt={alt || "item"}
        width={size}
        height={size}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        onError={() => setBad(true)}
      />
    </Box>
  );
}

const toNum = (x: any) => (Number.isFinite(Number(x)) ? Number(x) : 0);

const normTypeKey = (t: any) => String(t || "").toLowerCase().trim();

const makeImgKey = (type: any, id: any) => `${normTypeKey(type)}:${String(id ?? "")}`;

const resolveTypeFromSupplierType = (supplierType: any): "gold" | "diamond" | "watches" => {
  const t = String(supplierType || "").toLowerCase();
  if (t.includes("watch")) return "watches";
  if (t.includes("gold")) return "gold";
  return "diamond";
};

// Inline placeholder (no network)
// ---------- Helpers ----------
const FALLBACK_ITEM_IMAGE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="280" height="200">
    <rect width="100%" height="100%" fill="#f2f2f2"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#888" font-family="Arial" font-size="14">
      No Image
    </text>
  </svg>
`);

const FALLBACK_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
    <rect width="100%" height="100%" fill="#f1f5f9"/>
    <path d="M28 78l16-18 14 14 10-12 24 28H28z" fill="#94a3b8"/>
    <circle cx="44" cy="44" r="8" fill="#94a3b8"/>
    <text x="50%" y="92%" text-anchor="middle" font-size="10" fill="#64748b" font-family="Arial">No image</text>
  </svg>
`);

/**
 * IMPORTANT:
 * This must match your backend image "Type" expectation.
 * Keep stable: "gold" | "diamond" | "watches"
 */
const resolveImageType = (row: any, d?: any) => {
  const rowType = normTypeKey(row?.type ?? row?.Type ?? row?.invoice_type ?? "");
  const supplierType = normTypeKey(row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER ?? "");

  if (rowType.includes("watches") || supplierType.includes("watches")) return "watches";
  if (rowType.includes("diamond") || supplierType.includes("diamond")) return "diamond";
  if (rowType.includes("gold") || supplierType.includes("gold")) return "gold";

  const dType = normTypeKey(d?.typeSupplier ?? d?.TYPE_SUPPLIER ?? "");
  if (dType.includes("watches")) return "watches";
  if (dType.includes("diamond")) return "diamond";
  if (dType.includes("gold")) return "gold";

  return "diamond";
};

const fmt2 = (n: number) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const money0 = (n: any) => Number(n || 0);

// Normalize to 2 decimals like your existing normalizeMoney
// (If you already have normalizeMoney, use that instead)
const n2 = (n: number) => normalizeMoney ? normalizeMoney(n) : Math.round((n + Number.EPSILON) * 100) / 100;

// Prefer first positive number; fallback to first finite number.
const pickFirstPositive = (vals: any[]): number | null => {
  const positives = vals
    .map((v) => toFiniteNumber(v))
    .filter((v): v is number => v !== null && v > 0);
  if (positives.length) return positives[0];

  const anyFinite = vals
    .map((v) => toFiniteNumber(v))
    .filter((v): v is number => v !== null);
  return anyFinite.length ? anyFinite[0] : null;
};

type InvoicePaySummary = {
  isGold: boolean;
  isClosed: boolean;

  total: { lyd: number; usd: number; eur: number };
  paid: { lyd: number; usd: number; eur: number; usdLyd: number; eurLyd: number };
  remaining: { lyd: number; usd: number; eur: number; usdLyd: number; eurLyd: number };

  // Optional: show discount/surcharge breakdown when available
  totalBase?: { lyd: number; usd: number; eur: number };
  adjustment?: { lyd: number; usd: number; eur: number };

  // for status
  isFullyPaid: boolean;
  isPartial: boolean;
};

const computeInvoicePaySummary = (row: any): InvoicePaySummary => {
  const supplierType = String(row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || "").toLowerCase();
  const isGold = supplierType.includes("gold");
  const isClosed = !!row?.IS_OK;

  // -----------------------------
  // TOTALS (DON'T REUSE LYD TOTAL AS USD!)
  // -----------------------------
  const totalLydRaw = Number(row?.total_remise_final_lyd ?? row?.total_remise_final_LYD ?? 0) || 0;

  // These MUST come from real USD/EUR-total fields (or be 0).
  // Add/remove candidates to match your backend names.
  const totalUsdCandidate =
    (isGold
      ? pickNumber(
          row?.total_usd,
          row?.totalAmountUsd,
          row?.total_amount_usd,
          row?.total_remise_final_usd,
          row?.total_currency_usd
        )
      : pickNumber(
          // For non-gold invoices, backend often stores the USD final total in total_remise_final
          row?.total_remise_final,
          row?.total_usd,
          row?.totalAmountUsd,
          row?.total_amount_usd,
          row?.total_remise_final_usd,
          row?.total_currency_usd
        )) ?? 0;

  const totalEurCandidate =
    (isGold
      ? pickNumber(
          row?.total_eur,
          row?.totalAmountEur,
          row?.total_amount_eur,
          row?.total_remise_final_eur,
          row?.total_EUR
        )
      : pickNumber(
          row?.total_eur,
          row?.totalAmountEur,
          row?.total_amount_eur,
          row?.total_remise_final_eur,
          row?.total_EUR
        )) ?? 0;

  // PAID
  const paidLyd = Number(row?.amount_lyd ?? 0) || 0;
  const paidUsd = Number(row?.amount_currency ?? 0) || 0;
  const paidUsdLyd = Number(row?.amount_currency_LYD ?? 0) || 0;
  const paidEur = Number(row?.amount_EUR ?? 0) || 0;
  const paidEurLyd = Number(row?.amount_EUR_LYD ?? 0) || 0;

  const paidLydEquiv = n2(paidLyd + paidUsdLyd + paidEurLyd);

  // REST (backend) - use toFiniteNumber to handle formatted strings like "1,200"
  const restLydBackend =
    toFiniteNumber(row?.rest_of_money ?? row?.rest_of_moneyLYD ?? row?.rest_of_money_lyd) ?? 0;
  const restUsdBackend = toFiniteNumber(row?.rest_of_moneyUSD ?? row?.rest_of_money_usd) ?? 0;
  const restEurBackend = toFiniteNumber(row?.rest_of_moneyEUR ?? row?.rest_of_money_eur) ?? 0;
  const restUsdLydBackend = toFiniteNumber(row?.rest_of_moneyUSD_LYD ?? row?.rest_of_money_usd_lyd) ?? 0;
  const restEurLydBackend = toFiniteNumber(row?.rest_of_moneyEUR_LYD ?? row?.rest_of_money_eur_lyd) ?? 0;

  // Base totals before discount/surcharge (best effort)
  const totalBaseLyd = Number(row?.total_remise ?? row?.total_lyd ?? row?.totalAmountLYD ?? 0) || 0;
  const totalBaseUsd = Number(row?.total_usd ?? row?.totalAmountUsd ?? row?.total_amount_usd ?? 0) || 0;
  const totalBaseEur = Number(row?.total_eur ?? row?.totalAmountEur ?? row?.total_amount_eur ?? 0) || 0;

  // Adjustment (discount or surcharge) in LYD (best effort)
  const remiseValue = Number(row?.remise ?? 0) || 0;
  const remisePerValue = Number(row?.remise_per ?? 0) || 0;
  const adjustedFromPer = totalBaseLyd > 0 && remisePerValue ? (totalBaseLyd * remisePerValue) / 100 : 0;
  const adjustmentLyd = n2(remiseValue > 0 ? -remiseValue : remisePerValue > 0 ? -adjustedFromPer : 0);

  // Totals per currency (do NOT infer USD/EUR totals from LYD totals)
  let totalLyd = totalLydRaw;
  let totalUsd = totalUsdCandidate;
  let totalEur = totalEurCandidate;

  // Some invoices (especially Chira) come with missing totals (0) but have payments.
  // Infer totals from paid + rest fields.
  const hasAnyTotal = totalLyd > MONEY_EPS || totalUsd > MONEY_EPS || totalEur > MONEY_EPS;
  if (!hasAnyTotal) {
    // If rest_of_money equals paid LYD-equivalent (common backend bug), treat it as TOTAL not remaining.
    const restLooksLikePaid = restLydBackend > MONEY_EPS && Math.abs(n2(restLydBackend) - paidLydEquiv) <= 1;
    if (restLooksLikePaid) {
      totalLyd = paidLydEquiv;
    } else {
      totalLyd = n2(paidLydEquiv + (restLydBackend > MONEY_EPS ? restLydBackend : 0));
    }

    // Infer USD/EUR totals only from their own fields if present
    if (paidUsd > MONEY_EPS || restUsdBackend > MONEY_EPS) {
      totalUsd = n2(paidUsd + (restUsdBackend > MONEY_EPS ? restUsdBackend : 0));
    }
    if (paidEur > MONEY_EPS || restEurBackend > MONEY_EPS) {
      totalEur = n2(paidEur + (restEurBackend > MONEY_EPS ? restEurBackend : 0));
    }
  }

  // -----------------------------
  // REMAINING
  // -----------------------------
  let remLyd = 0, remUsd = 0, remEur = 0, remUsdLyd = 0, remEurLyd = 0;

  if (isGold) {
    const computedLyd = Math.max(0, totalLyd - (paidLyd + paidUsdLyd + paidEurLyd));
    // rest_of_money is unreliable for gold (often 1 LYD or discount). Only trust it if it matches computed.
    const useRestLyd =
      restLydBackend > MONEY_EPS &&
      Math.abs(n2(restLydBackend) - n2(computedLyd)) <= 1; // tolerate rounding + backend truncation
    remLyd = useRestLyd ? restLydBackend : computedLyd;

    // User request: show backend rest fields for USD/EUR too when present.
    // If backend fields are empty, fall back to computed per-currency remaining.
    const computedUsd = Math.max(0, totalUsd - paidUsd);
    const computedEur = Math.max(0, totalEur - paidEur);
    remUsd = restUsdBackend > MONEY_EPS ? restUsdBackend : computedUsd;
    remEur = restEurBackend > MONEY_EPS ? restEurBackend : computedEur;
    remUsdLyd = restUsdLydBackend;
    remEurLyd = restEurLydBackend;
  } else {
    // Non-gold (diamond/watches): remaining is per-currency face value.
    // Prefer backend rest fields when present, otherwise compute from totals - paid.
    const computedLyd = Math.max(0, totalLyd - paidLyd);
    const computedUsd = Math.max(0, totalUsd - paidUsd);
    const computedEur = Math.max(0, totalEur - paidEur);

    // If rest_of_money is equal to paid LYD-equivalent (backend bug), don't treat it as remaining.
    const restLooksLikePaid = restLydBackend > MONEY_EPS && Math.abs(n2(restLydBackend) - paidLydEquiv) <= 1;
    remLyd = restLooksLikePaid ? 0 : restLydBackend > MONEY_EPS ? restLydBackend : computedLyd;
    remUsd = restUsdBackend > MONEY_EPS ? restUsdBackend : computedUsd;
    remEur = restEurBackend > MONEY_EPS ? restEurBackend : computedEur;

    remUsdLyd = restUsdLydBackend;
    remEurLyd = restEurLydBackend;
  }

  const isFullyPaid = remLyd <= MONEY_EPS && remUsd <= MONEY_EPS && remEur <= MONEY_EPS;
  const isPartial = !isFullyPaid && (remLyd > MONEY_EPS || remUsd > MONEY_EPS || remEur > MONEY_EPS);

  return {
    isGold,
    isClosed,
    total: { lyd: totalLyd, usd: totalUsd, eur: totalEur },
    paid: { lyd: paidLyd, usd: paidUsd, eur: paidEur, usdLyd: paidUsdLyd, eurLyd: paidEurLyd },
    remaining: { lyd: remLyd, usd: remUsd, eur: remEur, usdLyd: remUsdLyd, eurLyd: remEurLyd },
    totalBase: { lyd: totalBaseLyd, usd: totalBaseUsd, eur: totalBaseEur },
    adjustment: { lyd: adjustmentLyd, usd: 0, eur: 0 },
    isFullyPaid,
    isPartial,
  };
};

const getHeaderBgByStatus = (s: InvoicePaySummary): string => {
  // requested: green if paid fully + closed, yellow/orange if open, red if remainder/partial
  if (!s.isClosed) return "#f59e0b";      // yellowish orange
  if (s.isFullyPaid) return "#10b981";    // green
  return "#ef4444";                        // red
};

const extractDateFromFilename = (filename: string): number => {
  const dateMatch = filename.match(/(\d{4})[-_]?((\d{2})[-_]?(\d{2}))/);
  if (dateMatch) {
    const year = dateMatch[1];
    const month = dateMatch[3];
    const day = dateMatch[4];
    if (year && month && day) {
      const parsed = Date.parse(`${year}-${month}-${day}`);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return filename ? filename.length : 0;
};

// You should already have something like these states:
/// const [imageUrls, setImageUrls] = React.useState<Record<string, string[]>>({});
/// const [imageBlobUrls, setImageBlobUrls] = React.useState<Record<string, string[]>>({});

const getNamePriorityFromUrl = (url: string): number => {
  try {
    const base = (url || "").split("?")[0];
    const file = base.split("/").pop() || base;
    const lower = file.toLowerCase();
    if (lower.includes("marketing")) return 0;
    if (lower.includes("invoice")) return 1;
  } catch {
    /* ignore */
  }
  return 2;
};

const typeOptions = [
  { label: "All", value: "all" },
  { label: "Gold", value: "gold" },
  { label: "Diamond", value: "diamond" },
  { label: "watches", value: "watches" },
];

type Users = {
  id_user: number;
  name_user: string;
};

const SalesReportsTable = ({
  type: initialType,
}: {
  type?: "gold" | "diamond" | "watches";
}) => {
  // Fetch users on mount

  const theme = useTheme();

  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    initialType ? [initialType] : ["all"]
  );
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // Set default periodFrom and periodTo to current date
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const currentDate = `${yyyy}-${mm}-${dd}`;
  const [periodFrom, setPeriodFrom] = useState(`${yyyy}-01-01`);
  const [periodTo, setPeriodTo] = useState(currentDate);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsData] = useState<any>(null);
  const [showTopSummaryDetails, setShowTopSummaryDetails] = useState(false);
  const [cardsPerRow, setCardsPerRow] = useState<number>(1);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeInvoice, setCloseInvoice] = useState<any | null>(null);
  const [closeInvoiceRows, setCloseInvoiceRows] = useState<any[]>([]);
  const [closeLoading, setCloseLoading] = useState(false);
  const [closePayLydStr, setClosePayLydStr] = useState("");
  const [closePayUsdStr, setClosePayUsdStr] = useState("");
  const [closePayUsdLydStr, setClosePayUsdLydStr] = useState("");
  const [closePayEurStr, setClosePayEurStr] = useState("");
  const [closePayEurLydStr, setClosePayEurLydStr] = useState("");
  const [closeError, setCloseError] = useState<string>("");
  const [closeMakeCashVoucher, setCloseMakeCashVoucher] = useState(false);
  const [itemImageCache, setItemImageCache] = React.useState<Record<string, string>>({});
  // Trigger refresh after closing an invoice
  const [invoiceRefreshFlag, setInvoiceRefreshFlag] = useState(0);
  const [chiraDialogOpen, setChiraDialogOpen] = useState(false);
  const [chiraDialogIdFact, setChiraDialogIdFact] = useState<any>(null);
  const [chiraRefreshFlag, setChiraRefreshFlag] = useState(0);
  const printRef = React.useRef(null);
  const [globalFilter, setGlobalFilter] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<
    "invoice_number" | "invoice_date" | "value"
  >("invoice_number");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [sortCurrency, setSortCurrency] = useState<"LYD" | "USD" | "EUR">(
    "USD"
  );
  const [pageIndex, setPageIndex] = useState(0); // for card pagination
  const [restOnly, setRestOnly] = useState<boolean>(false);
  const [saleKinds, setSaleKinds] = useState<string[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<
    "all" | "paid" | "unpaid" | "partial"
  >("all");

  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

  // --------- Queue images to fetch (restore old behavior + fix watch IDs) ----------
  const buildImageQueue = React.useCallback((rows: any[]) => {
    const queued: { type: string; id: number }[] = [];

    for (const row of rows || []) {
      const imgType = resolveImageType(row);

      // GOLD: restore original behavior (use id_achat)
      if (imgType === "gold") {
        const goldId = row?.ACHATs?.[0]?.id_achat ?? row?.id_achat ?? row?.ID_ACHAT;
        if (goldId) queued.push({ type: "gold", id: Number(goldId) });
        continue;
      }

      // WATCH: restore typical watch identifiers (picint / id_art)
      if (imgType === "watches") {
        const watchId =
          row?.picint ??
          row?.PICINT ??
          row?.id_art ??
          row?.ID_ART ??
          row?._productDetails?.[0]?.picint ??
          row?._productDetails?.[0]?.id_art;

        if (watchId) queued.push({ type: "watches", id: Number(watchId) });
        continue;
      }

      // DIAMOND / other: keep typical art id
      const diaId = row?.id_art ?? row?.ID_ART ?? row?.picint ?? row?.PICINT;
      if (diaId) queued.push({ type: imgType, id: Number(diaId) });
    }

    // de-dupe
    const seen = new Set<string>();
    return queued.filter((q) => {
      const k = makeImgKey(q.type, q.id);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, []);

  const navigate = useNavigate();

  const apiUrlusers = `/users`;
  const [users, setUsers] = useState<Users[]>([]);
  const fetchUsers = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get<Users[]>(`${apiUrlusers}/ListUsers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data);
    } catch (error) {

    } finally {
      // no-op
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Compute whether current user has the ROLE_ADMIN privilege.
  // This controls visibility of admin-only actions (e.g. Return to cart)
  const isAdmin = React.useMemo(() => {
    try {
      const userStr = localStorage.getItem("user");
      let privilege: any = null;
      if (userStr) {
        try {
          const userObj = JSON.parse(userStr);
          privilege =
            userObj.Prvilege ?? userObj.roles ?? localStorage.getItem("roles");
        } catch {
          privilege =
            localStorage.getItem("Prvilege") ?? localStorage.getItem("roles");
        }
      } else {
        privilege =
          localStorage.getItem("Prvilege") ?? localStorage.getItem("roles");
      }
      if (!privilege) return false;
      return typeof privilege === "string" && privilege.includes("ROLE_ADMIN");
    } catch {
      return false;
    }
  }, []);

  const API_BASEImage = "/images";

  const IMAGE_BASES = (() => {
    try {
      const base = (axios as any)?.defaults?.baseURL;
      if (base) {
        const u = new URL(base, window.location.origin);
        const cleanPath = u.pathname.replace(/\/+$/, "");
        const origin = u.origin;
        const candidates: string[] = [];
        if (/\/api$/i.test(cleanPath)) {
          candidates.push(`${origin}${cleanPath}/images`.replace(/\/+$/, ""));
          candidates.push(`${origin}/images`);
        } else {
          candidates.push(`${origin}${cleanPath}/images`.replace(/\/+$/, ""));
          candidates.push(`${origin}/images`);
        }
        return Array.from(new Set(candidates.map((s) => s.replace(/\/+$/, ""))));
      }
      const o = new URL(window.location.origin);
      return [`${o.origin}/images`];
    } catch {
      return ["/images"];
    }
  })();

  const API_BASEImage_ABS = IMAGE_BASES[0] || "/images";

  const ensureHttps = (u: string): string => {
    if (!u) return u;
    if (window?.location?.protocol === "https:" && u.startsWith("http://")) {
      try {
        return "https://" + u.substring("http://".length);
      } catch {
        return u;
      }
    }
    return u;
  };

  const toApiImageAbsolute = (url: string): string => {
    try {
      if (!url) return url;
      if (url.startsWith("data:") || url.startsWith("blob:")) return url;
      if (/^https?:\/\//i.test(url) || url.startsWith("//")) return ensureHttps(url);
      if (url.startsWith("/images/") || url.startsWith("/uploads/")) {
        const root = API_BASEImage_ABS.replace(/\/images\/?$/i, "");
        return `${root}${url}`;
      }
      return ensureHttps(new URL(url, window.location.origin).toString());
    } catch {
      return url;
    }
  };

  const withToken = (rawUrl: string, token: string | null): string => {
    if (!token) return rawUrl;
    try {
      const u = new URL(rawUrl, window.location.origin);
      u.searchParams.delete("token");
      u.searchParams.append("token", token);
      return u.toString();
    } catch {
      if (!rawUrl) return rawUrl;
      if (/([?&])token=/.test(rawUrl)) return rawUrl;
      return rawUrl + (rawUrl.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
    }
  };
  const apiUrlWatches = "/WOpurchases";
  // Raw URL lists per picint/id_achat
  const [imageUrls, setImageUrls] = React.useState<Record<string, string[]>>({});
  const [imageBlobUrls, setImageBlobUrls] = React.useState<Record<string, string[]>>({});
  // Keep a flat list of created object URLs so we can revoke them on unmount only
  const createdBlobUrlsRef = React.useRef<string[]>([]);
  // Watch details (OriginalAchatWatches) keyed by invoice picint
  const [watchDetailsMap, setWatchDetailsMap] = useState<Record<string, any>>({});
  // Selected Point-of-Sale filter (default to user's ps from localStorage/user if available)
  const getInitialPs = () => {
    // Return ps as a string id when possible, or 'all'
    let initial: string | "all" = "all";
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const userObj = JSON.parse(userStr);
        const raw = userObj.ps ?? localStorage.getItem("ps");
        initial =
          raw !== undefined && raw !== null && raw !== "" ? String(raw) : "all";
      } catch {
        const raw = localStorage.getItem("ps");
        initial =
          raw !== undefined && raw !== null && raw !== "" ? String(raw) : "all";
      }
    } else {
      const raw = localStorage.getItem("ps");
      initial =
        raw !== undefined && raw !== null && raw !== "" ? String(raw) : "all";
    }
    return initial;
  };
  const [selectedPs, setSelectedPs] = useState<string | "all">(getInitialPs);
  // Compute whether current user has the ROLE_USER privilege.
  // If ROLE_USER -> disable PS select and lock PS to user's stored ps. Otherwise, enable the select.
  const isUser = React.useMemo(() => {
    try {
      const userStr = localStorage.getItem("user");
      let privilege: any = null;
      if (userStr) {
        try {
          const userObj = JSON.parse(userStr);
          privilege =
            userObj.Prvilege ?? userObj.roles ?? localStorage.getItem("roles");
        } catch {
          privilege =
            localStorage.getItem("Prvilege") ?? localStorage.getItem("roles");
        }
      } else {
        privilege =
          localStorage.getItem("Prvilege") ?? localStorage.getItem("roles");
      }
      if (!privilege) return false;
      return typeof privilege === "string" && privilege.includes("ROLE_USER");
    } catch {
      return false;
    }
  }, []);
  const [psOptions, setPsOptions] = useState<
    Array<{ Id_point: number; name_point: string }>
  >([]);
  const [psOptionsLoaded, setPsOptionsLoaded] = useState(false);

  // Load available points of sale for the PS filter
  useEffect(() => {
    const token = localStorage.getItem("token");
    axios
      .get("/ps/all", {
        headers: { Authorization: token ? `Bearer ${token}` : undefined },
      })
      .then((res) => {
        if (Array.isArray(res.data)) setPsOptions(res.data);
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => setPsOptionsLoaded(true));
  }, []);

  // If the current user has ROLE_USER, force selectedPs to user's ps and keep the select disabled
  useEffect(() => {
    if (isUser) {
      const raw = localStorage.getItem("ps");
      if (raw) setSelectedPs(String(raw));
    }
  }, [isUser]);

  useEffect(() => {
    if (!psOptionsLoaded) return;
    if (selectedPs === "all") return;
    const available = new Set(psOptions.map((p) => String(p.Id_point)));
    if (!available.has(selectedPs)) {
      setSelectedPs("all");
    }
  }, [psOptionsLoaded, psOptions, selectedPs]);

  // Fetch all images for a given picint (or id_achat) with optional supplier type to select correct folder
  // Typed fetch similar to WatchStandardInvoiceContent: only attempt the explicit folder based on supplier type, with a legacy fallback if none
  // Remove the old fetchImages function and replace with this:
const fetchImages = useCallback(async (id: number, supplierType?: string) => {
  console.log('[fetchImages] START:', { id, supplierType });
  
  if (!id) {
    console.log('[fetchImages] No ID provided');
    return;
  }
  
  if (imageUrls[id] !== undefined) {
    console.log('[fetchImages] Already cached:', id);
    return;
  }
  
  const token = localStorage.getItem("token");
  const t = supplierType?.toLowerCase() || "";
  let typed: "watches" | "diamond" | "gold" | undefined;
  
  if (t.includes("watches")) typed = "watches";
  else if (t.includes("diamond")) typed = "diamond";
  else if (t.includes("gold")) typed = "gold";

  console.log('[fetchImages] Type detected:', typed);

  try {
    // Try all possible image endpoints
    const endpoints = [
      typed ? `${API_BASEImage}/list/${typed}/${id}` : undefined,
      `${API_BASEImage}/list/${id}`,
      `/api/images/list/${typed}/${id}`,
      `/api/images/list/${id}`,
      `/images/list/${typed}/${id}`,
      `/images/list/${id}`,
    ].filter((v): v is string => typeof v === 'string');

    console.log('[fetchImages] Trying endpoints:', endpoints);

    for (const endpoint of endpoints) {
      try {
        console.log('[fetchImages] Fetching:', endpoint);
        const res = await axios.get(endpoint, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        
        console.log('[fetchImages] Response:', res.data);

        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const urls = res.data
            .map((item: any) => {
              // Handle different response formats
              if (typeof item === 'string') return item;
              if (item?.url) return item.url;
              if (item?.path) return item.path;
              if (item?.href) return item.href;
              if (item?.src) return item.src;
              return null;
            })
            .filter(Boolean)
            .map((url: string) => {
              // Ensure absolute URLs with token
              if (url.startsWith('http://') || url.startsWith('https://')) {
                return withToken(url, token);
              }
              if (url.startsWith('/')) {
                return withToken(`${window.location.origin}${url}`, token);
              }
              return withToken(`${window.location.origin}/${url}`, token);
            });

          console.log('[fetchImages] Processed URLs:', urls);

          if (urls.length > 0) {
            setImageUrls((prev) => ({ ...prev, [id]: urls }));
            console.log('[fetchImages] SUCCESS - Set URLs for ID:', id);
            return;
          }
        }
      } catch (err) {
        console.log('[fetchImages] Endpoint failed:', endpoint, err);
        // Continue to next endpoint
      }
    }

    // If we get here, no endpoint worked
    console.log('[fetchImages] All endpoints failed for ID:', id);
    setImageUrls((prev) => ({ ...prev, [id]: [] }));
    
  } catch (error) {
    console.error('[fetchImages] Error:', error);
    setImageUrls((prev) => ({ ...prev, [id]: [] }));
  }
}, [API_BASEImage, imageUrls]);

// ---------- Fetch images (KEEP YOUR EXISTING ENDPOINTS) ----------
// IMPORTANT: keep your old endpoint + params EXACTLY.
// Only change how you STORE & KEY the results.
const fetchImagesForQueue = React.useCallback(
  async (queue: { type: string; id: number }[]) => {
    for (const q of queue) {
      const key = makeImgKey(q.type, q.id);

      // already have something stored? skip
      if (
        (imageBlobUrls?.[key] && imageBlobUrls[key].length) ||
        (imageUrls?.[key] && imageUrls[key].length)
      ) {
        continue;
      }

      try {
        const res = await axios.get("/files/GetImages", {
          params: { Type: q.type, Id: q.id },
        });

        const urlsArray: string[] = Array.isArray(res.data)
          ? res.data.filter(Boolean)
          : [];

        setImageUrls((prev) => ({ ...prev, [key]: urlsArray }));
      } catch {
        // store empty so we don't spam requests
        setImageUrls((prev) => ({ ...prev, [key]: [] }));
      }
    }
  },
  [imageBlobUrls, imageUrls]
);

// Simplify the blob URL conversion - don't use blobs, use direct URLs
useEffect(() => {
  console.log('[ImageUrls Updated]:', imageUrls);
}, [imageUrls]);

useEffect(() => {
  const idsMap = new Map<number, string>();
  
  data.forEach((row: any) => {
    // Process each ACHAT individually
    (row.ACHATs || []).forEach((achat: any) => {
      const supplierType = achat?.Fournisseur?.TYPE_SUPPLIER || '';
      const typeLower = String(supplierType).toLowerCase();
      
      // Get correct ID based on type
      let imageId = null;
      if (typeLower.includes('gold')) {
        imageId = achat.id_art || achat.ID_ART;
      } else if (typeLower.includes('watch')) {
        imageId = achat.id_achat || achat.ID_ACHAT;
      } else if (typeLower.includes('diamond')) {
        imageId = achat.picint;
      }
      
      if (imageId) {
        idsMap.set(Number(imageId), supplierType);
      }
    });
  });

  idsMap.forEach((type, id) => {
    fetchImages(id, type);
  });
}, [data, fetchImages]);

  // Add debug logging to see what's happening
useEffect(() => {
  console.log('[SalesReports] imageUrls state:', imageUrls);
  console.log('[SalesReports] imageBlobUrls state:', imageBlobUrls);
}, [imageUrls, imageBlobUrls]);

  // Helper to fetch image as blob and store object URL
  const fetchImageBlobs = async (key: string, urls: string[]) => {
    const blobUrls: string[] = [];
    for (const url of urls) {
      try {
        const imgUrl = toApiImageAbsolute(ensureHttps(url));
        const resp = await fetch(imgUrl, { method: "GET" });
        if (!resp.ok) continue;
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        blobUrls.push(blobUrl);
        createdBlobUrlsRef.current.push(blobUrl);
      } catch {
        // skip
      }
    }
    setImageBlobUrls((prev) => ({ ...prev, [key]: blobUrls }));
  };

  useEffect(() => {
    Object.entries(imageUrls).forEach(([key, urls]) => {
      if (urls.length > 0 && !imageBlobUrls[key]) {
        fetchImageBlobs(key, urls);
      }
    });
    // eslint-disable-next-line
  }, [imageUrls]);

  // Cleanup created blob URLs on unmount only. We track created URLs in a ref
  // to avoid revoking active object URLs when imageBlobUrls updates incrementally
  useEffect(() => {
    return () => {
      createdBlobUrlsRef.current.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* ignore */
        }
      });
      createdBlobUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
  const fetchData = async () => {
    if (!psOptionsLoaded) return;
    setLoading(true);
    const token = localStorage.getItem("token");
    const typeFilters = (selectedTypes || []).filter((t) => t !== "all");

    try {
      const dedupMap = new Map<string, any>();
      
      // Fetch ALL invoices without filters to get complete data
      const psToFetch = selectedPs === "all" ? psOptions.map(p => p.Id_point) : [selectedPs];
      
      for (const ps of psToFetch) {
        const requests: Promise<any>[] = [];
        
        if (typeFilters.length > 1 || typeFilters.length === 0) {
          // Fetch all types
          ['gold', 'diamond', 'watch'].forEach((t) => {
            requests.push(
              axios.get(`/invoices/allDetailsP`, {
                headers: { Authorization: token ? `Bearer ${token}` : undefined },
                params: {
                  ps: ps,
                  type: t,
                  // Remove date filters to get all items
                  // from: periodFrom || undefined,
                  // to: periodTo || undefined,
                  usr: localStorage.getItem("Cuser") || '-1',
                },
              }).catch(() => ({ data: [] }))
            );
          });
        } else {
          // Fetch single type
          const singleType = typeFilters[0];
          requests.push(
            axios.get(`/invoices/allDetailsP`, {
              headers: { Authorization: token ? `Bearer ${token}` : undefined },
              params: {
                ps: ps,
                type: singleType,
                // Remove date filters
                // from: periodFrom || undefined,
                // to: periodTo || undefined,
                usr: localStorage.getItem("Cuser") || '-1',
              },
            }).catch(() => ({ data: [] }))
          );
        }
        
        const results = await Promise.all(requests);
        const preferFields = [
          "amount_lyd",
          "amount_currency",
          "amount_currency_LYD",
          "amount_EUR",
          "amount_EUR_LYD",
          "rest_of_money",
          "rest_of_moneyLYD",
          "rest_of_money_lyd",
          "rest_of_moneyUSD",
          "rest_of_money_usd",
          "rest_of_moneyUSD_LYD",
          "rest_of_money_usd_lyd",
          "rest_of_moneyEUR",
          "rest_of_money_eur",
          "rest_of_moneyEUR_LYD",
          "rest_of_money_eur_lyd",
          "total_remise_final_lyd",
          "total_remise_final_LYD",
          "totalAmountUsd",
          "total_amount_usd",
          "totalAmountEur",
          "total_amount_eur",
          "usd_to_lyd_rate",
          "rate_usd",
          "currency_rate_usd",
          "exchange_rate_usd",
          "eur_to_lyd_rate",
          "rate_eur",
          "currency_rate_eur",
          "exchange_rate_eur",
        ];
        const cloneAchats = (achats: any) =>
          Array.isArray(achats) ? [...achats] : [];
        results.forEach((r) => {
          if (Array.isArray(r.data)) {
            r.data.forEach((row: any) => {
              const key = String(row.num_fact ?? row.id_fact ?? row.picint ?? Math.random());
              if (!dedupMap.has(key)) {
                dedupMap.set(key, {
                  ...row,
                  ACHATs: cloneAchats(row.ACHATs),
                });
              } else {
                // Merge ACHATs from multiple rows with the same num_fact
                const existing = dedupMap.get(key);
                const existingAchats = cloneAchats(existing.ACHATs);
                const incomingAchats = cloneAchats(row.ACHATs);
                existing.ACHATs = [...existingAchats, ...incomingAchats];
                preferFields.forEach((field) => {
                  const current = existing[field];
                  const incoming = row[field];
                  const hasCurrent =
                    current !== undefined &&
                    current !== null &&
                    !(typeof current === "number" && isNaN(current));
                  const hasIncoming =
                    incoming !== undefined &&
                    incoming !== null &&
                    !(typeof incoming === "number" && isNaN(incoming));
                  if (!hasCurrent && hasIncoming) {
                    existing[field] = incoming;
                  }
                });
              }
            });
          }
        });
      }
      
      const allInvoices = Array.from(dedupMap.values());
      
      console.log('[SalesReports] Fetched invoices:', allInvoices.length);
      
      // Now apply client-side filtering for date range
      const filtered = allInvoices.filter((row) => {
        const invoiceDate = new Date(row.date_fact);
        const fromDate = periodFrom ? new Date(periodFrom) : null;
        const toDate = periodTo ? new Date(periodTo) : null;
        
        if (fromDate && invoiceDate < fromDate) return false;
        if (toDate && invoiceDate > toDate) return false;
        
        return true;
      });
      
      console.log('[SalesReports] After date filter:', filtered.length);
      setData(filtered);
    } catch (err) {
      console.error('[SalesReports] Fetch error:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };
  
  if (psOptionsLoaded) {
    fetchData();
  }
}, [selectedTypes, periodFrom, periodTo, selectedPs, chiraRefreshFlag, invoiceRefreshFlag, psOptions, psOptionsLoaded]);

  // Fetch watch details (OriginalAchatWatches) for watch invoices using invoice picint
  useEffect(() => {
    const fetchWatchDetails = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      // Only consider invoices where supplier type is watch
      const watchRows = (data || []).filter((row: any) => {
        const t = String(row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || "").toLowerCase();
        return t.includes("watches");
      });

      const ids = Array.from(
        new Set(
          watchRows
            .map((row: any) => row.picint)
            .filter((id: any) => id && watchDetailsMap[String(id)] === undefined)
        )
      );
      if (ids.length === 0) return;

      const next: Record<string, any> = {};
      await Promise.all(
        ids.map(async (id: number) => {
          try {
            const res = await axios.get(`${apiUrlWatches}/getitem/${id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            next[String(id)] = Array.isArray(res.data) ? res.data[0] : res.data;
          } catch {
            next[String(id)] = null;
          }
        })
      );
      if (Object.keys(next).length > 0) {
        setWatchDetailsMap((prev) => ({ ...prev, ...next }));
      }
    };

    if (data && data.length > 0) {
      fetchWatchDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, watchDetailsMap]);

  // When filter criteria change (not internal refresh flags), clear cached images so they reload for the new dataset
  useEffect(() => {
    // Reset only on primary filter changes
    setImageUrls({});
    setImageBlobUrls({});
    setPageIndex(0);
  }, [selectedTypes, periodFrom, periodTo, selectedPs]);
  // Calculate total weight in gram (sum of qty for all rows)
  const totalWeight = data.reduce((sum, row) => {
    const achats = row.ACHATs || [];
    if (achats.length > 0) {
      const achat = achats[0];
      // Only sum qty if TYPE_SUPPLIER contains 'gold'
      const typeSupplier = achat.Fournisseur?.TYPE_SUPPLIER || "";
      if (typeSupplier.toLowerCase().includes("gold")) {
        const qty = Number(achat.qty);
        if (!isNaN(qty)) return sum + qty;
      }
    }
    return sum;
  }, 0);

  // Calculate total invoice amounts by type (sum max per invoice)
  function getMaxTotalByType(typeStr: string) {
    // Map from num_fact to max total_remise_final for that invoice and type
    const invoiceMap = new Map<string, number>();
    data.forEach((row: any) => {
      const achats = row.ACHATs || [];
      if (achats.length === 0) return;
      const typeSupplier = achats[0]?.Fournisseur?.TYPE_SUPPLIER || "";
      if (!String(typeSupplier).toLowerCase().includes(typeStr)) return;
      const numFact = row.num_fact;
      let val: number = Number(row.total_remise_final) || 0;
      if (row.remise > 0) {
        val = Number(row.total_remise_final) - Number(row.remise);
      } else if (row.remise_per > 0) {
        val = Number(row.total_remise_final) -
          (Number(row.total_remise_final) * Number(row.remise_per)) / 100;
      }
      if (!isNaN(val)) {
        if (!invoiceMap.has(numFact) || (invoiceMap.get(numFact) as number) < val) {
          invoiceMap.set(numFact, val);
        }
      }
    });
    // Sum the max values
    let sum = 0;
    Array.from(invoiceMap.values()).forEach((v) => {
      sum += v;
    });
    return sum;
  }
  const totalGold = getMaxTotalByType("gold");
  const totalDiamond = getMaxTotalByType("diamond");
  const totalWatch = getMaxTotalByType("watches");

  // Helper to format numbers with comma and point
  const formatNumber = (value: any) => {
    if (typeof value === "number") {
      return value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    if (typeof value === "string" && value !== "") {
      const num = Number(value);
      if (!isNaN(num)) {
        return num.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      }
      return value;
    }
    return value;
  };

  // --- Merge rows by num_fact and aggregate product details ---
  function mergeRowsByInvoice(data: any[]) {
  const invoiceMap = new Map<string, any>();
  
  data.forEach((row: any) => {
    const numFact = row.num_fact;
    
    if (!invoiceMap.has(numFact)) {
      // Clone the row and initialize product details list
      invoiceMap.set(numFact, { ...row, _productDetails: [] });
    }
    
    // Extract product details from ACHATs
    const achats: any[] = row.ACHATs || [];
    
    achats.forEach((achat: any) => {
      // For watch items: use model from OriginalAchatWatches via invoice picint/DistributionPurchase.
      // For non-watch items: keep existing Design_art/design name.
      let watch: any = undefined;
      const dp: any = (achat as any).DistributionPurchase;
      if (Array.isArray(dp) && dp.length > 0 && typeof dp[0] === "object") {
        watch = dp[0]?.OriginalAchatWatch;
      } else if (dp && typeof dp === "object") {
        watch = dp?.OriginalAchatWatch;
      }
      if (!watch && (achat as any).OriginalAchatWatch) {
        watch = (achat as any).OriginalAchatWatch;
      }

      const typeSupplier = achat.Fournisseur?.TYPE_SUPPLIER || "";
      const typeLower = String(typeSupplier).toLowerCase();

      // If it's a watch sale, show model (and serial number when available) as product name.
      // Prefer values from watchDetailsMap (OriginalAchatWatches),
      // then DistributionPurchase/ACHAT fields. Do NOT fall back to Design_art for watches.
      let design: string;
      if (typeLower.includes("watches")) {
        const invoicePicint = row.picint;
        const watchDetails =
          (invoicePicint !== undefined && invoicePicint !== null
            ? watchDetailsMap[String(invoicePicint)]
            : undefined) || undefined;
        const model =
          (watchDetails?.model as string | undefined) ||
          (watchDetails?.Model as string | undefined) ||
          (watch?.model as string | undefined) ||
          (watch?.Model as string | undefined) ||
          (achat.Model as string | undefined) ||
          (achat.model as string | undefined) ||
          "";
        const serial =
          (watchDetails?.serial_number as string | undefined) ||
          (watch?.serial_number as string | undefined) ||
          (achat.serial_number as string | undefined) ||
          "";

        design = serial ? `${model} | SN: ${serial}` : model;
      } else {
        // Non-watch (gold/diamond/etc.): keep previous behaviour using Design_art/design
        design =
          (achat.Design_art as string | undefined) ||
          (achat.design as string | undefined) ||
          "";
      }

      const code = achat.id_fact || "";
      let weight = "";
      if (typeLower.includes("gold")) {
        weight = achat.qty?.toString() || "";
      }
      
      // Extract purchase record properly
      const purchaseRecord = Array.isArray(dp) && dp.length > 0 
        ? (dp[0]?.purchase || dp[0]) 
        : (dp?.purchase || dp?.purchaseW || dp?.purchaseD || dp || null);
      const achatId = purchaseRecord?.id_achat || achat.id_achat || achat.ID_ACHAT || achat.picint;
      
      const picint = achat.picint ?? row.picint ?? "";
      
      // Get imageId based on supplier type
      const imageId = (() => {
        // Gold images are stored under id_art from the purchase record or ACHAT
        if (typeLower.includes("gold")) {
          const goldId = purchaseRecord?.id_art || achat.id_art || achat.ID_ART || achat.Id_Art || achatId || picint;
          console.log('[mergeRowsByInvoice] Gold imageId:', goldId, 'from purchase:', purchaseRecord);
          return goldId;
        }
        
        // Watch images are stored under id_achat from the purchase record or ACHAT
        if (typeLower.includes("watches")) {
          const watchId = purchaseRecord?.id_achat || achatId || picint || row.picint;
          console.log('[mergeRowsByInvoice] Watch imageId:', watchId, 'from purchase:', purchaseRecord);
          return watchId;
        }
        
        // Diamond images are stored under picint
        const diamondId = picint || achatId || row.picint;
        console.log('[mergeRowsByInvoice] Diamond imageId:', diamondId);
        return diamondId;
      })();

      console.log('[mergeRowsByInvoice] Product:', {
        design,
        imageId,
        typeSupplier,
        achat: { 
          id_art: achat.id_art, 
          id_achat: achatId, 
          picint: picint,
          purchaseRecord: purchaseRecord 
        }
      });

      const IS_GIFT = row.IS_GIFT || "";

      // include common external reference fields so UI/export can access them
      const codeExternal =
        achat.CODE_EXTERNAL ||
        achat.code_external ||
        achat.CODE_EXTERNAL ||
        achat.ref ||
        achat.reference ||
        "";
        
      const rawPriceCandidates = [
        achat?.prix_vente_remise,
        achat?.PRIX_VENTE_REMISE,
        achat?.prix_vente,
        achat?.PRIX_VENTE,
        achat?.prixVente,
        achat?.PrixVente,
        achat?.selling_price,
        achat?.Selling_price,
        achat?.SELLING_PRICE,
        achat?.price,
        achat?.Price,
        achat?.PRICE,
        achat?.total_remise,
        achat?.TOTAL_REMISE,
        purchaseRecord?.prix_vente_remise,
        purchaseRecord?.PRIX_VENTE_REMISE,
        purchaseRecord?.prix_vente,
        purchaseRecord?.PRIX_VENTE,
        purchaseRecord?.selling_price,
        purchaseRecord?.Selling_price,
        purchaseRecord?.price,
        purchaseRecord?.Price,
        purchaseRecord?.total_remise,
        purchaseRecord?.TOTAL_REMISE,
      ];

      // Add this console log before the normalization
      console.log('[mergeRowsByInvoice] Raw price candidates for', design, ':', {
        achat_fields: {
          prix_vente_remise: achat?.prix_vente_remise,
          PRIX_VENTE_REMISE: achat?.PRIX_VENTE_REMISE,
          prix_vente: achat?.prix_vente,
          selling_price: achat?.selling_price,
          price: achat?.price,
        },
        purchaseRecord_fields: purchaseRecord ? {
          prix_vente_remise: purchaseRecord?.prix_vente_remise,
          prix_vente: purchaseRecord?.prix_vente,
          selling_price: purchaseRecord?.selling_price,
        } : null,
        rawCandidates: rawPriceCandidates.filter(v => v !== undefined && v !== null),
      });

      const itemPrice = pickFirstPositive(rawPriceCandidates); // uses helpers above

      console.log('[mergeRowsByInvoice] Final item price:', itemPrice, 'from', rawPriceCandidates);

      invoiceMap.get(numFact)._productDetails.push({
        design,
        weight,
        code,
        typeSupplier,
        picint,
        id_achat: achatId,
        imageId,
        IS_GIFT,
        CODE_EXTERNAL: codeExternal,
        prix_vente_remise: itemPrice,
        unitPrice: itemPrice,
        priceCandidates: rawPriceCandidates,
      });
    });
  });
  
  return Array.from(invoiceMap.values());
}

  // Sort data by date_fact descending using UTC to avoid timezone issues
  const mergedData = mergeRowsByInvoice(data);
  const sortedData = [...mergedData].sort((a, b) => {
    const dateA = new Date(a.date_fact).getTime();
    const dateB = new Date(b.date_fact).getTime();
    return dateB - dateA;
  });


  // Fetch images for all invoices in sortedData when data changes
  // Fetch images for all invoices in sortedData when data changes
useEffect(() => {
  console.log('[SalesReports] Triggering image fetch for data:', data);
  const queued: { id: number; type?: string }[] = [];
  
  data.forEach((row: any) => {
    const supplierType = row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER;
    const typeLower = String(supplierType || "").toLowerCase();
    
    console.log('[SalesReports] Processing row:', { 
      num_fact: row.num_fact, 
      picint: row.picint, 
      supplierType,
      achats: row.ACHATs 
    });
    
    // For diamond invoices, use picint
    if (typeLower.includes("diamond") && row.picint) {
      queued.push({ id: row.picint, type: supplierType });
    }
    
    // Process each ACHAT
    (row.ACHATs || []).forEach((a: any) => {
      const achatType = String(a?.Fournisseur?.TYPE_SUPPLIER || supplierType || "").toLowerCase();
      
      // Extract purchase record correctly
      const dp = a.DistributionPurchase;
      const purchaseRecord = Array.isArray(dp) && dp.length > 0 
        ? (dp[0]?.purchase || dp[0]) 
        : (dp?.purchase || dp?.purchaseW || dp?.purchaseD || dp || null);
      
      console.log('[SalesReports] Purchase record:', purchaseRecord);
      
      if (achatType.includes("gold")) {
        const goldId = purchaseRecord?.id_achat || a.id_achat || a.ID_ACHAT;
        if (goldId) queued.push({ id: Number(goldId), type: a?.Fournisseur?.TYPE_SUPPLIER || supplierType });
      } else if (achatType.includes("watches")) {
        const watchId = purchaseRecord?.id_achat || a.id_achat || a.ID_ACHAT;
        if (watchId) {
          queued.push({ id: watchId, type: a?.Fournisseur?.TYPE_SUPPLIER || supplierType });
        }
      } else if (achatType.includes("diamond")) {
        const diamondId = a.picint || purchaseRecord?.picint;
        if (diamondId) {
          queued.push({ id: diamondId, type: a?.Fournisseur?.TYPE_SUPPLIER || supplierType });
        }
      }
    });
  });
  
  console.log('[SalesReports] Queued for fetch:', queued);
  
  // Fetch distinct
  const seen = new Set<number>();
  queued.forEach((q) => {
    if (!seen.has(q.id)) {
      seen.add(q.id);
      fetchImages(q.id, q.type);
    }
  });
}, [data]); // Only depend on data

  // Fetch images for all product-level picints in sortedData when data changes
  useEffect(() => {
    // (Keeping this effect for safety but main fetching now handled by previous effect)
    const pending: { id: number; type?: string }[] = [];
    sortedData.forEach((row: any) => {
      const supplierType = row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER;
      if (
        row.picint &&
        String(supplierType || "").toLowerCase().includes("diamond") &&
        imageUrls[row.picint] === undefined
      )
        pending.push({ id: row.picint, type: supplierType });
      (row.ACHATs || []).forEach((a: any) => {
        const t = String(a?.Fournisseur?.TYPE_SUPPLIER || supplierType || "").toLowerCase();
        const prodId =
          t.includes("gold") || t.includes("watches")
            ? a.id_art || a.ID_ART || a.id_art || a.id_art
            : a.id_art || a.id_achat || a.ID_ACHAT || a.Id_Achat;
        if (prodId && imageUrls[prodId] === undefined)
          pending.push({
            id: prodId,
            type: a?.Fournisseur?.TYPE_SUPPLIER || supplierType,
          });
      });
    });
    const unique = new Set<number>();
    pending.forEach((p) => {
      if (!unique.has(p.id)) {
        unique.add(p.id);
        fetchImages(p.id, p.type);
      }
    });
    // eslint-disable-next-line
  }, [sortedData]);

  const closeInvoicePaymentSource = React.useMemo(() => {
    if (Array.isArray(closeInvoiceRows) && closeInvoiceRows.length > 0) {
      const serverRow = closeInvoiceRows.find(
        (row) => row && typeof row === "object"
      );
      if (!closeInvoice) return serverRow || null;
      if (!serverRow) return closeInvoice;
      return { ...closeInvoice, ...serverRow };
    }
    return closeInvoice;
  }, [closeInvoice, closeInvoiceRows]);

  const closeLines: any[] =
    closeInvoice?.Details ||
    closeInvoice?.details ||
    closeInvoice?.FactureDetails ||
    closeInvoice?.facture_details ||
    closeInvoice?.items ||
    [];

  const getItemImageFetchTarget = React.useCallback((line: any) => {
    // WATCH
    const w =
      line?.Watch ||
      line?.watch ||
      line?.OriginalAchatWatch ||
      line?.DistributionPurchase?.OriginalAchatWatch ||
      null;

    if (w?.id_watch || w?.Id_watch || w?.id) {
      return { type: "watches" as const, id: Number(w?.id_watch ?? w?.Id_watch ?? w?.id) };
    }

    // DIAMOND
    const d = line?.Diamond || line?.diamond || line?.OriginalDiamond || null;
    if (d?.id_diamond || d?.Id_diamond || d?.id) {
      return { type: "diamond" as const, id: Number(d?.id_diamond ?? d?.Id_diamond ?? d?.id) };
    }

    // GOLD
    const g =
      line?.Gold ||
      line?.gold ||
      line?.OriginalAchatGold ||
      line?.DistributionPurchase?.OriginalAchatGold ||
      null;

    if (g?.id_gold || g?.Id_gold || g?.id) {
      return { type: "gold" as const, id: Number(g?.id_gold ?? g?.Id_gold ?? g?.id) };
    }

    // fallback: sometimes the line itself has an id
    const anyId = line?.id || line?.id_item || line?.id_fact_details;
    if (anyId) return { type: "gold" as const, id: Number(anyId) }; // harmless fallback

    return null;
  }, []);

  const getLineQty = React.useCallback((l: any) => {
    const v =
      Number(l?.qty ?? l?.qte ?? l?.quantity ?? l?.Qte ?? l?.QTY ?? l?.Count ?? l?.count ?? 0) || 0;

    // sometimes gold uses weight as quantity-like
    const w = Number(l?.weight ?? l?.poids ?? l?.Weight ?? 0) || 0;

    // prefer qty if present, else weight if present, else 1
    if (v > 0) return v;
    if (w > 0) return w;
    return 1;
  }, []);
  const getLineUnitPrice = React.useCallback((l: any) => {
    // common unit fields
    const unitCandidates = [
      l?.unit_price,
      l?.UnitPrice,
      l?.prix_unitaire,
      l?.prixUnit,
      l?.price,
      l?.Price,
      l?.SellingPrice,
      l?.sell_price,
      l?.total_price_unit,
    ];

    for (const c of unitCandidates) {
      const n = Number(c);
      if (Number.isFinite(n) && n > 0) return normalizeMoney(n);
    }

    // if only total exists, derive by qty
    const qty = getLineQty(l);
    const total = getLineTotal(l);
    if (qty > 0 && total > 0) return normalizeMoney(total / qty);

    return 0;
  }, [getLineQty]);
  
  const getLineTotal = React.useCallback((l: any) => {
    const totalCandidates = [
      l?.total,
      l?.Total,
      l?.total_price,
      l?.TotalPrice,
      l?.prix_total,
      l?.montant,
      l?.amount,
      l?.Amount,
      // watch/gold/diamond common totals
      l?.Total_Price_LYD,
      l?.total_remise_final_lyd,
      l?.total_remise_final_LYD,
      l?.line_total_lyd,
    ];

    for (const c of totalCandidates) {
      const n = Number(c);
      if (Number.isFinite(n) && n > 0) return normalizeMoney(n);
    }

    // fallback = qty * unit
    const qty = getLineQty(l);
    const unit = Number(l?.unit_price ?? l?.prix_unitaire ?? l?.price ?? 0) || 0;
    if (qty > 0 && unit > 0) return normalizeMoney(qty * unit);

    return 0;
  }, [getLineQty]);

  // Build styled HTML with embedded images for export (used by HTML and Excel exports)
  async function generateExportHtml(): Promise<string> {
    // On-demand image conversion with global cap.
    const picintToBase64: Record<string, string[]> = {};
    const processed = new Set<string>();
    let globalImageCount = 0;
    let truncated = false;
    for (const row of sortedFilteredData) {
      if (truncated) break;
      if (!row?._productDetails) continue;
      for (const d of row._productDetails) {
        if (truncated) break;
        const imageId = d.imageId ?? d.id_achat ?? d.picint;
        if (!imageId || processed.has(String(imageId))) continue;
        processed.add(String(imageId));
        if (globalImageCount >= EXPORT_MAX_IMAGES) {
          truncated = true;
          break;
        }
        const imgType = resolveTypeFromSupplierType(d.typeSupplier);
        const imgKey = makeImgKey(imgType, imageId);

        const blobUrls = imageBlobUrls[imgKey] || imageBlobUrls[String(imageId)] || [];
        let candidateUrls: string[] = [];

        if (blobUrls.length > 0) candidateUrls = blobUrls;
        else {
          candidateUrls =
            imageUrls[imgKey] ||
            imageUrls[String(imageId)] ||
            (await fetchImageListForExport(Number(imageId), d.typeSupplier));
        }

        if (blobUrls.length > 0) candidateUrls = blobUrls;
        else
          candidateUrls =
            imageUrls[imageId] ||
            (await fetchImageListForExport(Number(imageId), d.typeSupplier));
        const limited = candidateUrls.slice(0, 2);
        const base64List: string[] = [];
        for (const u of limited) {
          if (globalImageCount >= EXPORT_MAX_IMAGES) {
            truncated = true;
            break;
          }
          const b64 = await fetchAndDownscaleToBase64(u, EXPORT_IMG_SIZE);
          if (b64) {
            base64List.push(b64);
            globalImageCount++;
          }
        }
        picintToBase64[String(imageId)] = base64List;
      }
    }
    const logoUrl = "/logo.png";
    let html = `
        <html>
        <head>
            <meta charset="utf-8" />
            <title>Sales Report Export</title>
            <style>
                body { font-family: Roboto, 'Segoe UI', Arial, sans-serif; background: #fafafa; color: #212121; margin: 0; padding: 0; }
                .export-header { display: flex; align-items: center; gap: 16px; background: #fff; padding: 16px 24px; border-bottom: 1px solid #e0e0e0; }
                .export-logo { height: 48px; }
                .export-title { font-size: 1.5rem; font-weight: 600; color: #1976d2; letter-spacing: .3px; }
                .export-table { width: 98%; margin: 16px auto; border-collapse: collapse; background: #fff; border: 1px solid #e0e0e0; }
                .export-table th, .export-table td { border: 1px solid #e0e0e0; padding: 8px 12px; font-size: 0.95rem; vertical-align: top; }
                .export-table th { background: #f5f5f5; color: #424242; font-weight: 600; text-align: left; }
                .export-table tr:nth-child(even) { background: #fafafa; }
                .export-footer { margin: 16px auto 0 auto; text-align: center; color: #757575; font-size: 0.9rem; }
                .export-img-row { display: flex; flex-direction: row; gap: 6px; flex-wrap: wrap; }
                /* Use smaller fixed size for export images */
                .export-img-row img { width: ${EXPORT_IMG_SIZE}px; height: ${EXPORT_IMG_SIZE}px; object-fit: cover; border-radius: 4px; border: 1px solid #e0e0e0; }
                .export-product-table { width: 100%; border-collapse: collapse; margin: 0; }
                .export-product-table th, .export-product-table td { border: 1px solid #eeeeee; padding: 4px 6px; font-size: 0.9rem; }
                .export-product-table th { background: #f0f7ff; color: #1976d2; font-weight: 600; }
                .export-product-label { font-weight: 600; color: #1976d2; margin: 6px 0 4px; display: block; }
                .chip { display:inline-block; padding: 2px 6px; font-size:.8rem; border-radius: 12px; border:1px solid #e0e0e0; background:#fafafa; color:#616161 }
            </style>
        </head>
        <body>
            <div class="export-header">
                <img src="${logoUrl}" class="export-logo" alt="Logo" />
                <span class="export-title">Sales Report</span>
            </div>
            <table class="export-table">
                <thead>
                    <tr>
                        <th>Invoice Info</th>
                        <th>Product Details</th>
                        <th>Client</th>
                        <th>Is Closed</th>
                        <th>Amounts</th>
                        <th>Source Mark</th>
                    </tr>
                </thead>
                <tbody>
        `;
    sortedFilteredData.forEach((row: any) => {
      const client = row.Client
        ? `${row.Client.client_name || ""}${row.Client.client_name && row.Client.tel_client ? " - " : ""}${row.Client.tel_client || ""}`
        : "";

      // Build Invoice Info block (mimics on-screen cell)
      const createdStr = formatDateTime(row.d_time);
      const user =
        row.Utilisateur && row.Utilisateur.name_user
          ? row.Utilisateur.name_user
          : "";
      const invoiceComment = stripInternalMetaTags((row as any).COMMENT ?? "");
      const isChiraFlag = row.is_chira === true || row.is_chira === 1;
      const returnChira = row.return_chira;
      const commentChira = row.comment_chira;
      const usrReceiveChira = row.usr_receive_chira;
      const invoiceInfoHtml = `
                <div style="font-size:12px;line-height:1.35">
                    <div><b>Date:</b> <span class="chip">${formatDate(row.date_fact) || ""}</span></div>
                    <div><b>Invoice No:</b> <span class="chip">${row.num_fact || ""}</span></div>
                    <div><b>Time:</b> ${createdStr}</div>
                    <div><b>Point Of Sale:</b> ${row.ps || ""}</div>
                    ${user ? `<div><b>Sold by:</b> ${user}</div>` : ""}
                    ${invoiceComment ? `<div><b>Comment:</b> ${invoiceComment}</div>` : ""}
                    <div><b>Chira:</b> <span style="color:${isChiraFlag ? "#388e3c" : "#d32f2f"};font-weight:600">${isChiraFlag ? "Yes" : "No"}</span></div>
                    ${!isChiraFlag &&
          (returnChira || commentChira || usrReceiveChira)
          ? `
                        <div style="margin-top:4px;background:#f9fbe7;border-radius:4px;padding:6px 8px">
                            ${returnChira ? `<div><b style='color:#388e3c'>Return Date:</b> ${returnChira}</div>` : ""}
                            ${usrReceiveChira ? `<div><b style='color:#d32f2f'>Return By:</b> ${usrReceiveChira}</div>` : ""}
                            ${commentChira ? `<div><b style='color:#1976d2'>Comment Chira:</b> ${commentChira}</div>` : ""}
                        </div>`
          : ""
        }
                </div>
            `;

      // Product Details with inline images (mimics on-screen layout)
      let detailsHtml = "";
      if (row._productDetails && row._productDetails.length > 0) {
        detailsHtml = `<table class='export-product-table'><thead><tr><th>Design | Weight | Code | Type | Price</th></tr></thead><tbody>`;
        row._productDetails.forEach((d: any, idx: number) => {
          const priceValue =
            d.prix_vente_remise ?? row.prix_vente_remise ?? "";
          const formattedPrice =
            priceValue !== "" && priceValue !== null && priceValue !== undefined
              ? `${formatNumber(priceValue)} ${d.typeSupplier?.toLowerCase().includes("gold") ? "LYD" : "USD"}`
              : "";
          // Include invoice id (id_fact or num_fact) near each product line
          const invoiceId = row.id_fact ?? "";
          const prefix = invoiceId ? `${invoiceId} | ` : "";
          const lineText = `${prefix}${d.design} | ${d.weight || ""} | ${d.code} | ${d.typeSupplier}${formattedPrice ? " | " + formattedPrice : ""}`;
          const refLine = String(d.typeSupplier || "")
            .toLowerCase()
            .includes("diamond")
            ? d.CODE_EXTERNAL || d.code || ""
            : "";
          const picint = d.picint;
          const urls =
            picint && picintToBase64[picint]
              ? picintToBase64[picint]
              : [];
          const gift =
            d.IS_GIFT === true ? ' <span title="Gift">🎁</span>' : "";
          // Limit to first two images to mirror on-screen table; show +N if more
          let imagesRow = "";
          if (urls.length > 0) {
            const visible = urls.slice(0, 2);
            const extra = urls.length - visible.length;
            imagesRow =
              `<div class='export-img-row'>` +
              visible
                .map(
                  (u: string) =>
                    `<img src='${u}' alt='Product' width='${EXPORT_IMG_SIZE}' height='${EXPORT_IMG_SIZE}' style='width:${EXPORT_IMG_SIZE}px;height:${EXPORT_IMG_SIZE}px;object-fit:cover;border-radius:4px;border:1px solid #e0e0e0;mso-width-source:userset;mso-height-source:userset;' />`
                )
                .join("") +
              (extra > 0
                ? `<div style='width:${EXPORT_IMG_SIZE}px;height:${EXPORT_IMG_SIZE}px;display:flex;align-items:center;justify-content:center;background:#f5f5f5;border:1px solid #e0e0e0;border-radius:4px;font-size:12px;font-weight:600;color:#555;'>+${extra}</div>`
                : "") +
              `</div>`;
          } else {
            imagesRow = `<span style='color:#9e9e9e'>No Image</span>`;
          }
          detailsHtml += `<tr><td>${lineText}${gift}${refLine ? `<div style='color:#555;font-size:11px;margin-top:4px;'><b>Ref:</b> ${refLine}</div>` : ""}<div style='margin-top:4px'>${imagesRow}</div></td></tr>`;
        });
        detailsHtml += `</tbody></table>`;
      }

      const isClosed = row.IS_OK
        ? '<span style="color:#388e3c;font-weight:600">🔒 Closed Invoice</span>'
        : '<span style="color:#fbc02d;font-weight:600">🔓 Open invoice</span>';

      // Amounts block matches screen content
      const isGold =
        !!row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes(
          "gold"
        );
      const total = Number(row.total_remise_final) || 0;
      let pricePerG = "";
      if (isGold) {
        const qtyG = Number(row?.ACHATs?.[0]?.qty);
        if (!isNaN(qtyG) && qtyG > 0 && total > 0)
          pricePerG = (total / qtyG).toFixed(2);
      }
      const amountsHtml = `
                <div style='font-size:12px;line-height:1.4'>
              ${total ? `<div><b style='color:#1976d2'>Total Invoice:</b> ${formatWholeAmount(total)} ${isGold ? "LYD" : "USD"} ${pricePerG ? `<span style='margin-left:8px;color:#388e3c;font-weight:600'>Price/g: ${pricePerG}</span>` : ""}</div>` : ""}
                    ${row.remise > 0 ? `<div><b style='color:#d32f2f'>Discount Value:</b> ${Number(row.remise).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>` : ""}
                    ${row.remise_per > 0 ? `<div><b style='color:#d32f2f'>Discount %:</b> ${Number(row.remise_per).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>` : ""}
                    ${row.amount_lyd ? `<div><b>LYD Due:</b> ${Number(row.amount_lyd).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>` : ""}
                    ${row.amount_currency ? `<div><b>USD Due:</b> ${Number(row.amount_currency).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${row.amount_currency_LYD ? `<span style='margin-left:8px;color:#616161'><b>Equi. in LYD:</b> ${Number(row.amount_currency_LYD).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>` : ""}</div>` : ""}
                    ${row.amount_EUR ? `<div><b>EUR Due:</b> ${Number(row.amount_EUR).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${row.amount_EUR_LYD ? `<span style='margin-left:8px;color:#616161'><b>Equi. in LYD:</b> ${Number(row.amount_EUR_LYD).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>` : ""}</div>` : ""}
                    ${row.rest_of_money ? `<div><b style='color:#6a1b9a'>Rest Due:</b> ${Number(row.rest_of_money).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>` : ""}
                </div>`;

      html += `
                <tr>
                    <td>${invoiceInfoHtml}</td>
                    <td>${detailsHtml}</td>
                    <td>${client}</td>
                    <td>${isClosed}</td>
                    <td>${amountsHtml}</td>
                    <td>${row.SourceMark || ""}</td>
                </tr>
            `;
    });
    html += `
                </tbody>
                <tfoot>
                    <tr style="background:#e3f2fd;font-weight:bold;">
                        <td colspan="5" style="text-align:right;">Total Gold:</td>
                      <td colspan="3" style="text-align:left; color:#1976d2;">${formatWholeAmount(totalGold)} LYD</td>
                    </tr>
                    <tr style="background:#e3f2fd;font-weight:bold;">
                        <td colspan="5" style="text-align:right;">Total Diamond:</td>
                      <td colspan="3" style="text-align:left; color:#1976d2;">${formatWholeAmount(totalDiamond)} USD</td>
                    </tr>
                    <tr style="background:#e3f2fd;font-weight:bold;">
                        <td colspan="5" style="text-align:right;">Total Watch:</td>
                      <td colspan="3" style="text-align:left; color:#1976d2;">${formatWholeAmount(totalWatch)} USD</td>
                    </tr>
                    ${truncated ? `<tr><td colspan='8' style='text-align:center;font-size:12px;color:#d32f2f;'>Image export truncated after ${globalImageCount} images (max ${EXPORT_MAX_IMAGES}).</td></tr>` : ""}
                </tfoot>
            </table>
            <div class="export-footer">Generated on ${new Date().toLocaleString()}</div>
        </body>
        </html>
        `;
    return html;
  }

  // --- Export Table to HTML with all data, details, and images ---
  async function exportTableToHtml() {
    const html = await generateExportHtml();
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  // --- Export to Excel (.xls via HTML) with styles and images ---
  async function exportTableToExcel() {
    // Build MHTML so images render in Excel
    const mhtml = await generateExportMhtml();
    const blob = new Blob([mhtml], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0];
    link.href = url;
    link.download = `SalesReport_${stamp}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Generate an MHTML document with embedded images (cid) for Excel
  async function generateExportMhtml(): Promise<string> {
    let typed: "watches" | "diamond" | "gold" | undefined;
    // 1) Collect images as base64
    const parseDataUrl = (
      dataUrl: string
    ): { mime: string; base64: string } | null => {
      const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
      if (!match) return null;
      return { mime: match[1] || "image/png", base64: match[2] };
    };

    // Map picint -> [{ cid, mime, base64 }]
    const picintToCidImages: Record<
      string,
      { cid: string; mime: string; base64: string }[]
    > = {};
    const allImages: { cid: string; mime: string; base64: string }[] = [];
    let idx = 1;
    let globalImageCount = 0;
    let truncated = false;
    const needed: { imageId: number; supplierType?: string }[] = [];
    sortedFilteredData.forEach((row: any) =>
      (row._productDetails || []).forEach((d: any) => {
        const imageId = d.imageId ?? d.id_achat ?? d.picint;
        if (imageId) needed.push({ imageId: Number(imageId), supplierType: d.typeSupplier });
      })
    );
    const uniqueImageIds = Array.from(new Set(needed.map((n) => n.imageId)));
    for (const imageId of uniqueImageIds) {
      if (truncated) break;
      const pd = needed.find((n) => n.imageId === imageId);
      const blobUrls = imageBlobUrls[imageId] || [];
      let candidateUrls: string[] = [];
      if (blobUrls.length > 0) candidateUrls = blobUrls;
      else
        candidateUrls =
          imageUrls[imageId] ||
          (await fetchImageListForExport(imageId, pd?.supplierType));
      const limited = candidateUrls.slice(0, 2);
      const parts: { cid: string; mime: string; base64: string }[] = [];
      for (const raw of limited) {
        if (globalImageCount >= EXPORT_MAX_IMAGES) {
          truncated = true;
          break;
        }
        try {
          const down = await fetchAndDownscaleToBase64(raw, EXPORT_IMG_SIZE);
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
      picintToCidImages[String(imageId)] = parts;
    }

    // 2) Build HTML body that references images by cid
    // optional: embed a logo if desired by adding a cid image part and referencing it here
    const headerHtml = `
            <div class="export-header">
                <span class="export-title">Sales Report</span>
            </div>`;

    // Reuse same styles and table structure as generateExportHtml
    let htmlBody = `
        <html>
        <head>
            <meta charset="utf-8" />
            <title>Sales Report Export</title>
            <style>
                body { font-family: Roboto, 'Segoe UI', Arial, sans-serif; background: #fafafa; color: #212121; margin: 0; padding: 0; }
                .export-header { display: flex; align-items: center; gap: 16px; background: #fff; padding: 16px 24px; border-bottom: 1px solid #e0e0e0; }
                .export-title { font-size: 1.5rem; font-weight: 600; color: #1976d2; letter-spacing: .3px; }
                .export-table { width: 98%; margin: 16px auto; border-collapse: collapse; background: #fff; border: 1px solid #e0e0e0; }
                .export-table th, .export-table td { border: 1px solid #e0e0e0; padding: 8px 12px; font-size: 0.95rem; vertical-align: top; }
                .export-table th { background: #f5f5f5; color: #424242; font-weight: 600; text-align: left; }
                .export-table tr:nth-child(even) { background: #fafafa; }
                .export-footer { margin: 16px auto 0 auto; text-align: center; color: #757575; font-size: 0.9rem; }
                .export-img-row { display: flex; flex-direction: row; gap: 6px; flex-wrap: wrap; }
                .export-img-row img { width: ${EXPORT_IMG_SIZE}px; height: ${EXPORT_IMG_SIZE}px; object-fit: cover; border-radius: 4px; border: 1px solid #e0e0e0; }
                .export-product-table { width: 100%; border-collapse: collapse; margin: 0; }
                .export-product-table th, .export-product-table td { border: 1px solid #eeeeee; padding: 4px 6px; font-size: 0.9rem; }
                .export-product-table th { background: #f0f7ff; color: #1976d2; font-weight: 600; }
                .export-product-label { font-weight: 600; color: #1976d2; margin: 6px 0 4px; display: block; }
                .chip { display:inline-block; padding: 2px 6px; font-size:.8rem; border-radius: 12px; border:1px solid #e0e0e0; background:#fafafa; color:#616161 }
            </style>
        </head>
        <body>
            ${headerHtml}
            <table class="export-table">
                <thead>
                    <tr>
                        <th>Invoice Info</th>
                        <th>Product Details</th>
                        <th>Client</th>
                        <th>Is Closed</th>
                        <th>Amounts</th>
                        <th>Source Mark</th>
                    </tr>
                </thead>
                <tbody>`;

    sortedFilteredData.forEach((row: any) => {
      const client = row.Client
        ? `${row.Client.client_name || ""}${row.Client.client_name && row.Client.tel_client ? " - " : ""}${row.Client.tel_client || ""}`
        : "";
      const createdStr = formatDateTime(row.d_time);
      const user =
        row.Utilisateur && row.Utilisateur.name_user
          ? row.Utilisateur.name_user
          : "";
      const invoiceComment = stripInternalMetaTags((row as any).COMMENT ?? "");
      const isChiraFlag = row.is_chira === true || row.is_chira === 1;
      const returnChira = row.return_chira;
      const commentChira = row.comment_chira;
      const usrReceiveChira = row.usr_receive_chira;
      const invoiceInfoHtml = `
                <div style="font-size:12px;line-height:1.35">
                    <div><b>Date:</b> <span class="chip">${formatDate(row.date_fact) || ""}</span></div>
                    <div><b>Invoice No:</b> <span class="chip">${row.num_fact || ""}</span></div>
                    <div><b>Time:</b> ${createdStr}</div>
                    <div><b>Point Of Sale:</b> ${row.ps || ""}</div>
                    ${user ? `<div><b>Sold by:</b> ${user}</div>` : ""}
                    ${invoiceComment ? `<div><b>Comment:</b> ${invoiceComment}</div>` : ""}
                    <div><b>Chira:</b> <span style="color:${isChiraFlag ? "#388e3c" : "#d32f2f"};font-weight:600">${isChiraFlag ? "Yes" : "No"}</span></div>
                    ${!isChiraFlag &&
          (returnChira || commentChira || usrReceiveChira)
          ? `
                        <div style="margin-top:4px;background:#f9fbe7;border-radius:4px;padding:6px 8px">
                            ${returnChira ? `<div><b style='color:#388e3c'>Return Date:</b> ${returnChira}</div>` : ""}
                            ${usrReceiveChira ? `<div><b style='color:#d32f2f'>Return By:</b> ${usrReceiveChira}</div>` : ""}
                            ${commentChira ? `<div><b style='color:#1976d2'>Comment Chira:</b> ${commentChira}</div>` : ""}
                        </div>`
          : ""
        }
                </div>`;

      // Build details with cid images
      let detailsHtml = "";
      if (row._productDetails && row._productDetails.length > 0) {
        detailsHtml = `<table class='export-product-table'><thead><tr><th>Design | Weight | Code | Type | Price</th></tr></thead><tbody>`;
        row._productDetails.forEach((d: any) => {
          const priceValue =
            d.prix_vente_remise ?? row.prix_vente_remise ?? "";
          const formattedPrice =
            priceValue !== "" && priceValue !== null && priceValue !== undefined
              ? `${formatNumber(priceValue)} ${d.typeSupplier?.toLowerCase().includes("gold") ? "LYD" : "USD"}`
              : "";
          // Include invoice id (id_fact or num_fact) near each product line for export
          const invoiceId = row.id_fact ?? row.num_fact ?? "";
          const prefix = invoiceId ? `${invoiceId} | ` : "";
          const lineText = `${prefix}${d.design} | ${d.weight || ""} | ${d.code} | ${d.typeSupplier}${formattedPrice ? " | " + formattedPrice : ""}`;
          const refLine = String(d.typeSupplier || "")
            .toLowerCase()
            .includes("diamond")
            ? d.CODE_EXTERNAL || d.code || ""
            : "";
          const picint = d.picint;
          const imgs =
            picint && picintToCidImages[String(picint)]
              ? picintToCidImages[String(picint)]
              : [];
          const gift =
            d.IS_GIFT === true ? ' <span title="Gift">🎁</span>' : "";
          // Limit to first two images for Excel export as well, with +N indicator
          let imagesRow = "";
          if (imgs.length > 0) {
            const visible = imgs.slice(0, 2);
            const extra = imgs.length - visible.length;
            imagesRow =
              `<div class='export-img-row'>` +
              visible
                .map(
                  (p) =>
                    `<img src='cid:${p.cid}' alt='Product' width='${EXPORT_IMG_SIZE}' height='${EXPORT_IMG_SIZE}' style='width:${EXPORT_IMG_SIZE}px;height:${EXPORT_IMG_SIZE}px;object-fit:cover;border-radius:4px;border:1px solid #e0e0e0;mso-width-source:userset;mso-height-source:userset;' />`
                )
                .join("") +
              (extra > 0
                ? `<div style='width:${EXPORT_IMG_SIZE}px;height:${EXPORT_IMG_SIZE}px;display:flex;align-items:center;justify-content:center;background:#f5f5f5;border:1px solid #e0e0e0;border-radius:4px;font-size:12px;font-weight:600;color:#555;'>+${extra}</div>`
                : "") +
              `</div>`;
          } else {
            imagesRow = `<span style='color:#9e9e9e'>No Image</span>`;
          }
          detailsHtml += `<tr><td>${lineText}${gift}${refLine ? `<div style='color:#555;font-size:11px;margin-top:4px;'><b>Ref:</b> ${refLine}</div>` : ""}<div style='margin-top:4px'>${imagesRow}</div></td></tr>`;
        });
        detailsHtml += `</tbody></table>`;
      }

      const isClosed = row.IS_OK
        ? '<span style="color:#388e3c;font-weight:600">🔒 Closed Invoice</span>'
        : '<span style="color:#fbc02d;font-weight:600">🔓 Open invoice</span>';

      const isGold =
        !!row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes(
          "gold"
        );
      const total = Number(row.total_remise_final) || 0;
      let pricePerG = "";
      if (isGold) {
        const qtyG = Number(row?.ACHATs?.[0]?.qty);
        if (!isNaN(qtyG) && qtyG > 0 && total > 0)
          pricePerG = (total / qtyG).toFixed(2);
      }
      const amountsHtml = `
                <div style='font-size:12px;line-height:1.4'>
              ${total ? `<div><b style='color:#1976d2'>Total Invoice:</b> ${formatWholeAmount(total)} ${isGold ? "LYD" : "USD"} ${pricePerG ? `<span style='margin-left:8px;color:#388e3c;font-weight:600'>Price/g: ${pricePerG}</span>` : ""}</div>` : ""}
                    ${row.remise > 0 ? `<div><b style='color:#d32f2f'>Discount Value:</b> ${Number(row.remise).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>` : ""}
                    ${row.remise_per > 0 ? `<div><b style='color:#d32f2f'>Discount %:</b> ${Number(row.remise_per).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>` : ""}
                    ${row.amount_lyd ? `<div><b>LYD Due:</b> ${Number(row.amount_lyd).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>` : ""}
                    ${row.amount_currency ? `<div><b>USD Due:</b> ${Number(row.amount_currency).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${row.amount_currency_LYD ? `<span style='margin-left:8px;color:#616161'><b>Equi. in LYD:</b> ${Number(row.amount_currency_LYD).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>` : ""}</div>` : ""}
                    ${row.amount_EUR ? `<div><b>EUR Due:</b> ${Number(row.amount_EUR).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${row.amount_EUR_LYD ? `<span style='margin-left:8px;color:#616161'><b>Equi. in LYD:</b> ${Number(row.amount_EUR_LYD).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>` : ""}</div>` : ""}
                    ${row.rest_of_money ? `<div><b style='color:#6a1b9a'>Rest Due:</b> ${Number(row.rest_of_money).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>` : ""}
                </div>`;

      htmlBody += `
                <tr>
                    <td>${invoiceInfoHtml}</td>
                    <td>${detailsHtml}</td>
                    <td>${client}</td>
                    <td>${isClosed}</td>
                    <td>${amountsHtml}</td>
                    <td>${row.SourceMark || ""}</td>
                </tr>`;
    });

    htmlBody += `
                </tbody>
                <tfoot>
                    <tr style="background:#f0f7ff;font-weight:bold;">
                        <td colspan="4" style="text-align:right;">Total Gold:</td>
                        <td colspan="2" style="text-align:left; color:#1976d2;">${formatNumber(totalGold)} LYD</td>
                    </tr>
                    <tr style="background:#f0f7ff;font-weight:bold;">
                        <td colspan="4" style="text-align:right;">Total Diamond:</td>
                        <td colspan="2" style="text-align:left; color:#1976d2;">${formatNumber(totalDiamond)} USD</td>
                    </tr>
                    <tr style="background:#f0f7ff;font-weight:bold;">
                        <td colspan="4" style="text-align:right;">Total Watch:</td>
                        <td colspan="2" style="text-align:left; color:#1976d2;">${formatNumber(totalWatch)} USD</td>
                    </tr>
                    ${truncated ? `<tr><td colspan='6' style='text-align:center;font-size:12px;color:#d32f2f;'>Image export truncated after ${globalImageCount} images (max ${EXPORT_MAX_IMAGES}).</td></tr>` : ""}
                </tfoot>
            </table>
            <div class="export-footer">Generated on ${new Date().toLocaleString()}</div>
        </body>
        </html>`;

    // 3) Assemble MHTML
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
    mhtml += htmlBody + EOL + EOL;

    // Image parts
    allImages.forEach((img, i) => {
      mhtml += `--${boundary}` + EOL;
      mhtml += `Content-Location: file:///image${i + 1}` + EOL;
      mhtml += `Content-Transfer-Encoding: base64` + EOL;
      mhtml += `Content-Type: ${img.mime}` + EOL;
      mhtml += `Content-ID: <${img.cid}>` + EOL + EOL;
      // Excel tolerates unwrapped base64; still split by 76 chars for safety
      for (let p = 0; p < img.base64.length; p += 76) {
        mhtml += img.base64.substring(p, p + 76) + EOL;
      }
      mhtml += EOL;
    });

    // Closing boundary
    mhtml += `--${boundary}--` + EOL;
    return mhtml;
  }

  // State to track return-to-cart operations in progress (by num_fact string)
  const [returningIds, setReturningIds] = useState<string[]>([]);

  // Confirmation dialog state for Return to cart (styled centered dialog)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmTargetNum, setConfirmTargetNum] = useState<
    number | string | null
  >(null);

  // Open confirmation dialog (called from buttons)
  const handleReturnToCart = (num_fact: number | string) => {
    setConfirmTargetNum(num_fact);
    setConfirmDialogOpen(true);
  };

  // Perform the actual API call to return invoice to cart
  const performReturnToCart = async (num_fact: number | string | null) => {
    if (num_fact === null || num_fact === undefined) return;
    const rawNum = String(num_fact ?? "");
    if (!rawNum) {
      alert("Invalid invoice number");
      return;
    }
    try {
      setReturningIds((prev) => Array.from(new Set([...prev, rawNum])));
      const token = localStorage.getItem("token");
      await axios.put(
        `/invoices/ReturnToCart/${encodeURIComponent(rawNum)}`,
        {},
        { headers: { Authorization: token ? `Bearer ${token}` : undefined } }
      );
      setInvoiceRefreshFlag((f) => f + 1);
    } catch (err: any) {

      alert(
        "Failed to return invoice to cart: " + (err?.message || "unknown error")
      );
    } finally {
      setReturningIds((prev) => prev.filter((x) => x !== rawNum));
      setConfirmDialogOpen(false);
      setConfirmTargetNum(null);
    }
  };

  // State for image dialog
  const [imageDialogOpen, setImageDialogOpen] = React.useState(false);
  const [imageDialogUrl, setImageDialogUrl] = React.useState<string | null>(
    null
  );
  // Admin: edit seller dialog state
  const [editSellerOpen, setEditSellerOpen] = useState(false);
  const [editSellerTargetInvoice, setEditSellerTargetInvoice] = useState<any>(null);
  const [editSellerSelectedUserId, setEditSellerSelectedUserId] = useState<number | null>(null);

  const handleOpenEditSeller = (row: any) => {
    setEditSellerTargetInvoice(row);
    const currentId = Number(row?.Utilisateur?.id_user ?? 0) || null;
    setEditSellerSelectedUserId(currentId);
    setEditSellerOpen(true);
  };

  const handleConfirmEditSeller = async () => {
    // Persist seller change by num_fact; update UI on success
    if (!editSellerTargetInvoice || !editSellerSelectedUserId) {
      setEditSellerOpen(false);
      return;
    }
    const chosen = (Array.isArray(users) ? users : []).find(
      (u: any) => Number(u.id_user) === Number(editSellerSelectedUserId)
    );
    const newName = chosen?.name_user || `User ${editSellerSelectedUserId}`;
    const numFact = editSellerTargetInvoice?.num_fact || editSellerTargetInvoice?.id_fact || null;
    if (!numFact) {
      alert("Missing invoice number");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `/invoices/UpdateUserByNumFact/${encodeURIComponent(String(numFact))}`,
        { usr: Number(editSellerSelectedUserId) },
        { headers: { Authorization: token ? `Bearer ${token}` : undefined } }
      );
      // Update local UI to reflect new seller
      setData((prev) => {
        return prev.map((row: any) => {
          if (String(row?.num_fact) === String(numFact)) {
            const updated = { ...row };
            updated.usr = Number(editSellerSelectedUserId);
            updated.Utilisateur = {
              ...(row.Utilisateur || {}),
              id_user: Number(editSellerSelectedUserId),
              name_user: newName,
            };
            return updated;
          }
          return row;
        });
      });
      setInvoiceRefreshFlag((f) => f + 1);
    } catch (e: any) {

      alert("Failed to update seller: " + (e?.message || "unknown error"));
    } finally {
      setEditSellerOpen(false);
      setEditSellerTargetInvoice(null);
      setEditSellerSelectedUserId(null);
    }
  };

  // --------- NEW: GLOBAL FILTER + CARD PAGINATION ---------
  const filteredData = React.useMemo(() => {
    let base = sortedData;
    if (globalFilter) {
      const term = globalFilter.toLowerCase();
      base = base.filter((row) =>
        JSON.stringify(row).toLowerCase().includes(term)
      );
    }

    if (customerSearch) {
      const term = customerSearch.toLowerCase().trim();
      base = base.filter((row: any) => {
        const c = row?.Client || {};
        const name = String(c.client_name ?? c.name ?? "").toLowerCase();
        const tel = String(c.tel_client ?? c.phone ?? "").toLowerCase();
        const id = String(c.id_client ?? c.id ?? "").toLowerCase();
        return (
          name.includes(term) ||
          tel.includes(term) ||
          id.includes(term) ||
          String(row?.client ?? "").toLowerCase().includes(term)
        );
      });
    }
    // Multi-select type filter (gold/diamond/watch)
    if (selectedTypes.length > 0 && !selectedTypes.includes("all")) {
      base = base.filter((row) => {
        const typeSupplier = String(row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || "").toLowerCase();
        return selectedTypes.some((t) => typeSupplier.includes(t));
      });
    }
    // Multi-select sale kinds filter
    if (saleKinds.length > 0 && !saleKinds.includes("All")) {
      base = base.filter((row) => {
        const isChiraFlag = row.is_chira === true || row.is_chira === 1;
        const isWholesale = row.is_whole_sale === true || row.is_whole_sale === 1;
        const hasGift = (() => {
          if (row.IS_GIFT === true) return true;
          const details: any[] = row._productDetails || [];
          return details.some((d: any) => d?.IS_GIFT === true);
        })();
        const isNormal = !isChiraFlag && !isWholesale && !hasGift;
        const tags: string[] = [];
        if (isChiraFlag) tags.push("Chira");
        if (hasGift) tags.push("Gift");
        if (isWholesale) tags.push("Wholesale");
        if (isNormal) tags.push("Normal");
        return tags.some((t) => saleKinds.includes(t));
      });
    }
    // Payment status filter
    if (paymentStatus !== "all") {
      base = base.filter((row) => {
        const due =
          row.Utilisateur && row.Utilisateur.name_user
            ? row.Utilisateur.name_user
            : "";
        const outstanding =
          (Number(row.rest_of_money || 0) || 0) +
          (Number(row.rest_of_moneyUSD || row.rest_of_money_usd || 0) || 0) +
          (Number(row.rest_of_moneyEUR || row.rest_of_money_eur || 0) || 0);
        const totalOutstanding = outstanding || due;
        const isClosed = !!row.IS_OK;
        const status: "paid" | "unpaid" | "partial" =
          totalOutstanding <= 0
            ? "paid"
            : !isClosed
              ? "unpaid"
              : "partial";
        return status === paymentStatus;
      });
    }
    if (restOnly) {
      base = base.filter((row) => {
        const r1 = Number(row.rest_of_money || 0);
        const r2 = Number(row.rest_of_moneyUSD || row.rest_of_money_usd || 0);
        const r3 = Number(row.rest_of_moneyEUR || row.rest_of_money_eur || 0);
        const due =
          (Number(row.amount_lyd || 0) || 0) +
          (Number(row.amount_currency_LYD || 0) || 0) +
          (Number(row.amount_EUR_LYD || 0) || 0);
        return (
          r1 + r2 + r3 > 0 || due > 0
        );
      });
    }
    return base;
  }, [sortedData, globalFilter, customerSearch, selectedTypes, saleKinds, paymentStatus, restOnly]);


  // Trigger when filtered/paged data changes (or wherever you previously did it)
  React.useEffect(() => {
    // Use filteredData or pagedData depending on what you previously used
    const queue = buildImageQueue(filteredData || []);
    if (queue.length) fetchImagesForQueue(queue);
  }, [filteredData, buildImageQueue, fetchImagesForQueue]);

  const sortedFilteredData = React.useMemo(() => {
    const base = [...filteredData];

    const getInvoiceTotalByCurrency = (row: any, ccy: "LYD" | "USD" | "EUR"): number => {
      if (ccy === "LYD") {
        return Number(
          row?.total_remise_final_lyd ??
            row?.total_remise_final_LYD ??
            row?.total_remise_final_lyd_sum ??
            0
        ) || 0;
      }
      if (ccy === "EUR") {
        return Number(
          row?.totalAmountEur ??
            row?.total_amount_eur ??
            row?.total_remise_final_eur ??
            0
        ) || 0;
      }
      return Number(row?.total_remise_final ?? 0) || 0;
    };

    const getCreatedTime = (row: any): number => {
      const t = row?.d_time || row?.created_at || row?.createdAt;
      const v = t ? new Date(t).getTime() : NaN;
      if (Number.isFinite(v)) return v;
      const d = row?.date_fact ? new Date(row.date_fact).getTime() : NaN;
      return Number.isFinite(d) ? d : 0;
    };

    const getInvoiceDate = (row: any): number => {
      const d = row?.date_fact ? new Date(row.date_fact).getTime() : NaN;
      return Number.isFinite(d) ? d : 0;
    };

    const dir = sortDir === "asc" ? 1 : -1;

    base.sort((a: any, b: any) => {
      if (sortBy === "invoice_number") {
        const parseInv = (r: any): number => {
          const raw = String(r?.num_fact ?? "");
          const digits = raw.replace(/\D+/g, "");
          if (digits) return Number(digits) || 0;
          const n = Number(raw);
          return Number.isFinite(n) ? n : 0;
        };
        const av = parseInv(a);
        const bv = parseInv(b);
        return (av - bv) * dir;
      }
      if (sortBy === "invoice_date") {
        return (getInvoiceDate(a) - getInvoiceDate(b)) * dir;
      }
      // value
      return (getInvoiceTotalByCurrency(a, sortCurrency) - getInvoiceTotalByCurrency(b, sortCurrency)) * dir;
    });
    return base;
  }, [filteredData, sortBy, sortDir, sortCurrency]);

  const topSummary = React.useMemo(() => {
    const seen = new Set<string>();
    return filteredData.reduce(
      (acc, row) => {
        const invoiceKey = String(row?.num_fact ?? row?.id_fact ?? "");
        if (!invoiceKey) return acc;
        if (seen.has(invoiceKey)) return acc;
        seen.add(invoiceKey);

        const supplierType = String(row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || "").toLowerCase();
        const typeKey: "gold" | "diamond" | "watches" | "other" = supplierType.includes("gold")
          ? "gold"
          : supplierType.includes("diamond")
            ? "diamond"
            : supplierType.includes("watch")
              ? "watches"
              : "other";

        const s = computeInvoicePaySummary(row);

        // Prefer backend remainder fields when present (these are typically the authoritative "unpaid" figures)
        const unpaidLyd =
          toFiniteNumber(row?.rest_of_money ?? row?.rest_of_moneyLYD ?? row?.rest_of_money_lyd) ??
          (s.remaining?.lyd || 0);
        const unpaidUsd =
          toFiniteNumber(row?.rest_of_moneyUSD ?? row?.rest_of_money_usd) ??
          (s.remaining?.usd || 0);
        const unpaidEur =
          toFiniteNumber(row?.rest_of_moneyEUR ?? row?.rest_of_money_eur) ??
          (s.remaining?.eur || 0);

        acc.sales.lyd = normalizeMoney(acc.sales.lyd + (s.total?.lyd || 0));
        acc.sales.usd = normalizeMoney(acc.sales.usd + (s.total?.usd || 0));
        acc.sales.eur = normalizeMoney(acc.sales.eur + (s.total?.eur || 0));

        acc.unpaid.lyd = normalizeMoney(acc.unpaid.lyd + unpaidLyd);
        acc.unpaid.usd = normalizeMoney(acc.unpaid.usd + unpaidUsd);
        acc.unpaid.eur = normalizeMoney(acc.unpaid.eur + unpaidEur);

        acc.byType[typeKey].sales.lyd = normalizeMoney(acc.byType[typeKey].sales.lyd + (s.total?.lyd || 0));
        acc.byType[typeKey].sales.usd = normalizeMoney(acc.byType[typeKey].sales.usd + (s.total?.usd || 0));
        acc.byType[typeKey].sales.eur = normalizeMoney(acc.byType[typeKey].sales.eur + (s.total?.eur || 0));

        acc.byType[typeKey].unpaid.lyd = normalizeMoney(acc.byType[typeKey].unpaid.lyd + unpaidLyd);
        acc.byType[typeKey].unpaid.usd = normalizeMoney(acc.byType[typeKey].unpaid.usd + unpaidUsd);
        acc.byType[typeKey].unpaid.eur = normalizeMoney(acc.byType[typeKey].unpaid.eur + unpaidEur);

        const detailsArr: any[] = Array.isArray(row?._productDetails) ? row._productDetails : [];
        const achatsArr: any[] = Array.isArray(row?.ACHATs) ? row.ACHATs : [];
        const itemsSoldCount = detailsArr.length > 0 ? detailsArr.length : achatsArr.length;
        acc.byType[typeKey].itemsSold += itemsSoldCount;

        // Total grams sold (gold): sum qty across all achats on the invoice
        if (supplierType.includes("gold")) {
          const achats: any[] = Array.isArray(row?.ACHATs) ? row.ACHATs : [];
          for (const a of achats) {
            const q = toFiniteNumber(a?.qty);
            if (q !== null && q > 0) acc.totalGoldGrams += q;
          }
        }

        return acc;
      },
      {
        sales: { lyd: 0, usd: 0, eur: 0 },
        unpaid: { lyd: 0, usd: 0, eur: 0 },
        totalGoldGrams: 0,
        byType: {
          gold: { sales: { lyd: 0, usd: 0, eur: 0 }, unpaid: { lyd: 0, usd: 0, eur: 0 }, itemsSold: 0 },
          diamond: { sales: { lyd: 0, usd: 0, eur: 0 }, unpaid: { lyd: 0, usd: 0, eur: 0 }, itemsSold: 0 },
          watches: { sales: { lyd: 0, usd: 0, eur: 0 }, unpaid: { lyd: 0, usd: 0, eur: 0 }, itemsSold: 0 },
          other: { sales: { lyd: 0, usd: 0, eur: 0 }, unpaid: { lyd: 0, usd: 0, eur: 0 }, itemsSold: 0 },
        },
      } as {
        sales: { lyd: number; usd: number; eur: number };
        unpaid: { lyd: number; usd: number; eur: number };
        totalGoldGrams: number;
        byType: Record<
          "gold" | "diamond" | "watches" | "other",
          {
            sales: { lyd: number; usd: number; eur: number };
            unpaid: { lyd: number; usd: number; eur: number };
            itemsSold: number;
          }
        >;
      }
    );
  }, [filteredData, normalizeMoney]);
  // Totals of "rest" fields for the currently filtered dataset
  const totalRestLYD = React.useMemo(() => {
    return filteredData.reduce((sum, row) => {
      const v = Number(row.rest_of_money || 0);
      const restField = isNaN(v) ? 0 : v;
      if (restField > 0) return sum + restField;

      // Fallback: compute remaining from totals vs paid LYD-equivalent when rest fields aren't populated.
      // Debug: log all available fields
      console.log('[Financial Summary] Row fields:', {
        num_fact: row.num_fact,
        total_remise_final: row.total_remise_final,
        total_remise_final_lyd: row.total_remise_final_lyd,
        total_remise_final_LYD: row.total_remise_final_LYD,
        totalAmountUsd: row.totalAmountUsd,
        total_amount_usd: row.total_amount_usd,
        totalAmountEur: row.totalAmountEur,
        total_amount_eur: row.total_amount_eur,
        amount_lyd: row.amount_lyd,
        amount_currency: row.amount_currency,
        amount_EUR: row.amount_EUR,
      });

      const totalLyd = Number(row.total_remise_final_lyd || row.total_remise_final_LYD) || 0;
      const totalUsd = Number(row.total_remise_final) || 0; // Try this first
      const totalEur = Number(row.totalAmountEur || row.total_amount_eur) || 0;
      const paidLydEquiv =
        (Number(row.amount_lyd) || 0) +
        (Number(row.amount_currency_LYD) || 0) +
        (Number(row.amount_EUR_LYD) || 0);
      const diff = totalLyd - paidLydEquiv;
      if (!Number.isFinite(diff) || diff <= 0) return sum;
      return sum + diff;
    }, 0);
  }, [filteredData]);
  const totalRestUSD = React.useMemo(() => {
    return filteredData.reduce((sum, row) => {
      const v = Number(row.rest_of_moneyUSD || row.rest_of_money_usd || 0);
      const restField = isNaN(v) ? 0 : v;
      if (restField > 0) return sum + restField;

      // Fallback: compute remaining USD from totals vs paid USD when rest fields aren't populated.
      const paidUsd = Number(row.amount_currency ?? 0) || 0;
      const totalUsd = Number(row.total_remise_final) || 0; // Try this first
      const diff = totalUsd - paidUsd;
      if (!Number.isFinite(diff) || diff <= 0) return sum;
      return sum + diff;
    }, 0);
  }, [filteredData]);
  const totalRestEUR = React.useMemo(() => {
    return filteredData.reduce((sum, row) => {
      const v = Number(row.rest_of_moneyEUR || row.rest_of_money_eur || 0);
      const restField = isNaN(v) ? 0 : v;
      if (restField > 0) return sum + restField;

      // Fallback: compute remaining EUR from totals vs paid EUR when rest fields aren't populated.
      const paidEur = Number(row.amount_EUR ?? 0) || 0;
      const totalEur = Number(row.totalAmountEur || row.total_amount_eur) || 0;
      const diff = totalEur - paidEur;
      if (!Number.isFinite(diff) || diff <= 0) return sum;
      return sum + diff;
    }, 0);
  }, [filteredData]);

  const summaryStats = React.useMemo(() => {
    const seen = new Set<string>();
    let invoiceCount = 0;
    let itemCount = 0;
    let totalWeightFiltered = 0;
    let totalGold = 0;
    let totalDiamond = 0;
    let totalWatch = 0;

    filteredData.forEach((row: any) => {
      const invoiceKey = String(row?.num_fact ?? row?.id_fact ?? "");
      if (!invoiceKey) return;
      if (seen.has(invoiceKey)) return;
      seen.add(invoiceKey);
      invoiceCount += 1;

      const detailsArr: any[] = Array.isArray(row?._productDetails) ? row._productDetails : [];
      const achatsArr: any[] = Array.isArray(row?.ACHATs) ? row.ACHATs : [];
      itemCount += detailsArr.length > 0 ? detailsArr.length : achatsArr.length;

      const supplierType = String(row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || "").toLowerCase();
      const isGold = supplierType.includes("gold");
      const isDiamond = supplierType.includes("diamond");
      const isWatch = supplierType.includes("watch");

      // Total weight (grams): sum all gold achat qty values on the invoice
      if (isGold) {
        for (const a of achatsArr) {
          const q = toFiniteNumber(a?.qty);
          if (q !== null && q > 0) totalWeightFiltered += q;
        }
      }

      const s = computeInvoicePaySummary(row);
      if (isGold) totalGold += Number(s.total?.lyd || 0);
      else if (isDiamond) totalDiamond += Number(s.total?.usd || 0);
      else if (isWatch) totalWatch += Number(s.total?.usd || 0);
    });

    return {
      invoiceCount,
      itemCount,
      totalWeight: totalWeightFiltered,
      totalGold: normalizeMoney(totalGold),
      totalDiamond: normalizeMoney(totalDiamond),
      totalWatch: normalizeMoney(totalWatch),
    };
  }, [filteredData]);
  const [pageSize, setPageSize] = useState<number>(5);
  const pageCount = Math.max(1, Math.ceil(sortedFilteredData.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const pagedData = sortedFilteredData.slice(
    safePageIndex * pageSize,
    safePageIndex * pageSize + pageSize
  );

  // Reset to first page when filters or search change
  useEffect(() => {
    setPageIndex(0);
  }, [globalFilter, customerSearch, sortBy, sortDir, sortCurrency, selectedTypes, periodFrom, periodTo, selectedPs, saleKinds, paymentStatus]);

  // ---- CARD RENDERER (replaces table row) ----
  const renderInvoiceCard = (row: any) => {
  const date = formatDate(row.date_fact) || "";
  const num = row.num_fact || "";
  const createdStr = formatDateTime(row.d_time);
  const ps = row.ps || "";
  const psCode = resolvePointOfSaleCode(ps);
  const user = row.Utilisateur?.name_user || "";
  const isChiraVal = row.is_chira === true || row.is_chira === 1;
  const invoiceComment = stripInternalMetaTags(row.COMMENT ?? "");

  const paySummary = computeInvoicePaySummary(row);
  const statusAccent = getHeaderBgByStatus(paySummary);
  const headerBg = theme.palette.mode === "dark" ? "#000" : "#fff";
  const headerFg = theme.palette.mode === "dark" ? "#fff" : "#000";
  const headerMutedFg = theme.palette.mode === "dark" ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.65)";
  const headerChipBg = theme.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";

  const eps = MONEY_EPS;

  // Remaining must be: total - paid (per currency)
  const remaining = {
    lyd: Math.max(0, normalizeMoney(paySummary.remaining?.lyd || 0)),
    usd: Math.max(0, normalizeMoney(paySummary.remaining?.usd || 0)),
    eur: Math.max(0, normalizeMoney(paySummary.remaining?.eur || 0)),
  };

  const remainingUsdLyd = Math.max(0, normalizeMoney(paySummary.remaining?.usdLyd || 0));
  const remainingEurLyd = Math.max(0, normalizeMoney(paySummary.remaining?.eurLyd || 0));

  const fullyPaidNow =
    remaining.lyd <= eps &&
    remaining.usd <= eps &&
    remaining.eur <= eps;

  const statusLabel = !paySummary.isClosed
    ? "Open"
    : fullyPaidNow
      ? "Closed"
      : "Partially Paid";

  const hasDiscount = (Number(row?.remise ?? 0) || 0) > 0 || (Number(row?.remise_per ?? 0) || 0) > 0;
  
  const clientValue = row.Client || row.client || null;
  const clientName =
    clientValue && typeof clientValue === "object"
      ? clientValue.client_name || clientValue.name || ""
      : "";
  const clientContact =
    clientValue && typeof clientValue === "object"
      ? clientValue.tel_client || clientValue.phone || ""
      : "";
  const clientDisplay = clientName
    ? `${clientName}${clientContact ? ` - ${clientContact}` : ""}`
    : clientContact;
  const customerIdRaw =
    row.Client?.id_client ??
    row.Client?.ID_CLIENT ??
    row.Client?.idClient ??
    row.client?.id_client ??
    row.client?.ID_CLIENT ??
    row.client?.idClient ??
    row.id_client ??
    row.ID_CLIENT ??
    row.Id_client ??
    row.client_id ??
    row.clientID ??
    row.ClientID ??
    null;
  const customerIdForLink =
    customerIdRaw !== null && customerIdRaw !== undefined
      ? Number(customerIdRaw)
      : NaN;
  const hasCustomerProfileLink = Number.isFinite(customerIdForLink);
  
  const details: any[] = row._productDetails || [];
  const isClosed = !!row.IS_OK;
  
  const rawTypeSupplier = row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || "";
  let invoiceTypeLabel = "";
  let typeColor = "default";
  
  if (rawTypeSupplier) {
    const t = String(rawTypeSupplier).toLowerCase();
    if (t.includes("gold")) {
      invoiceTypeLabel = "Gold";
      typeColor = "#FFD700";
    } else if (t.includes("diamond")) {
      invoiceTypeLabel = "Diamond";
      typeColor = "#B9F2FF";
    } else if (t.includes("watches")) {
      invoiceTypeLabel = "Watches";
      typeColor = "#DDA15E";
    }
  }

  const numFactAction = row?.num_fact ?? row?.num ?? row?.id_fact ?? null;
  const isReturning = numFactAction !== null && returningIds.includes(String(numFactAction));

  const rowKey = String(row.num_fact || row.id_fact || row.picint || Math.random());
  const isProductsExpanded = expandedProducts[rowKey] ?? false;

  return (
    <Card
      key={row.num_fact || row.id_fact || row.picint}
      sx={{
        mb: 3,
        borderRadius: 3,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        transition: 'all 0.3s ease',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 6,
          background: statusAccent,
        },
        '&:hover': {
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          transform: 'translateY(-2px)',
        }
      }}
    >
      {/* Header Section */}
      <Box
        sx={{
          background: headerBg,
          p: 2.25,
          color: headerFg,
          pl: 2.75,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
              {isChiraVal ? `Chira #${num}` : `Invoice #${num}`}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
                <Chip
                  icon={paySummary.isClosed ? <LockIcon fontSize="small" /> : undefined}
                  label={statusLabel}
                  size="small"
                  sx={{
                    backgroundColor: headerChipBg,
                    color: headerFg,
                    fontWeight: 900,
                  }}
                />
                {hasDiscount && (
                  <Chip
                    label="Discount"
                    size="small"
                    variant="outlined"
                    sx={{
                      height: 22,
                      '& .MuiChip-label': { px: 1, fontSize: 11, fontWeight: 800 },
                      borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)',
                      color: headerFg,
                    }}
                  />
                )}
              </Box>

              {invoiceTypeLabel && (
                <Chip
                  label={invoiceTypeLabel}
                  size="small"
                  sx={{
                    backgroundColor: typeColor,
                    color: '#111827',
                    fontWeight: 900,
                  }}
                />
              )}

              <Typography sx={{ fontSize: 13, color: headerMutedFg }}>
                {date} • {createdStr}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ textAlign: 'right' }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Chip
                label={psCode ? `${psCode}` : "PS"}
                size="small"
                sx={{
                  backgroundColor: headerChipBg,
                  color: headerFg,
                  fontWeight: 800,
                }}
              />
            </Box>
          </Box>
        </Box>

        {/* Meta Info Row */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', fontSize: 13, opacity: 0.95 }}>
          {(user || clientName || clientContact) && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {/* User Section */}
              {user && row.Utilisateur?.id_user && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button
                    component={RouterLink}
                    to={buildEncryptedSellerPath(Number(row.Utilisateur.id_user))}
                    size="small"
                    sx={{
                      p: 0.5,
                      minWidth: 0,
                      color: theme.palette.mode === 'dark' ? '#93c5fd' : 'primary.main',
                      textTransform: 'none',
                      fontWeight: 700,
                      background: 'none',
                      '&:hover': { textDecoration: 'underline', background: 'none' },
                    }}
                  >
                    👤 {user}
                  </Button>
                  {isAdmin && (
                    <Tooltip title="Change seller">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenEditSeller(row)}
                        sx={{
                          color: headerFg,
                          bgcolor: headerChipBg,
                          '&:hover': { bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.10)' },
                        }}
                      >
                        <EditIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              )}

              {/* Customer Section */}
              {(clientName || clientContact) && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  {clientName && (
                    hasCustomerProfileLink ? (
                      <Button
                        size="small"
                        component={RouterLink}
                        to={buildEncryptedClientPath(Number(customerIdForLink))}
                        sx={{
                          p: 0.5,
                          minWidth: 0,
                          color: theme.palette.mode === 'dark' ? '#fbbf24' : '#92400e',
                          textTransform: 'none',
                          fontWeight: 700,
                          background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                          '&:hover': { textDecoration: 'underline', background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.06)' },
                        }}
                        onClick={() => {
                          try {
                            if (typeof window !== 'undefined') {
                              localStorage.setItem('customerFocusId', String(customerIdForLink));
                              localStorage.setItem('customerFocusName', clientName);
                              if (clientContact) localStorage.setItem('customerFocusPhone', clientContact);
                            }
                          } catch {}
                        }}
                      >
                        🛍️ {clientName}
                      </Button>
                    ) : (
                      <Typography sx={{ fontWeight: 600, color: theme.palette.mode === 'dark' ? '#fbbf24' : '#92400e' }}>
                        🛍️ {clientName}
                      </Typography>
                    )
                  )}
                  {clientContact && (
                    <Typography sx={{ fontSize: 12, color: headerMutedFg }}>📞 {clientContact}</Typography>
                  )}
                </Box>
              )}
            </Box>
          )}
        </Box>
        
        {invoiceComment && (
          <Box sx={{ mt: 1, p: 1, backgroundColor: headerChipBg, borderRadius: 1 }}>
            <Typography sx={{ fontSize: 12, fontStyle: 'italic' }}>
              💬 {invoiceComment}
            </Typography>
          </Box>
        )}
      </Box>

      <CardContent sx={{ p: 3, display: "flex", flexDirection: "column", flex: 1 }}>
        {/* Financial Summary */}
        <Box sx={{ mb: 3, p: 2, backgroundColor: '#f8fafc', borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.25, color: '#0f172a' }}>
            Payment Summary
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1.5,
              alignItems: 'start',
            }}
          >
            {/* TOTAL */}
            {paySummary.isGold ? (
              <Box>
                <Typography sx={{ fontSize: 11, color: '#64748b' }}>Invoice Total</Typography>
                <Typography sx={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                  {formatWholeAmount(paySummary.total.lyd)} LYD
                </Typography>
              </Box>
            ) : (
              <Box>
                <Typography sx={{ fontSize: 11, color: '#64748b' }}>Invoice Total</Typography>
                <Typography sx={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                  {formatWholeAmount(paySummary.total.usd)} USD
                </Typography>
                {paySummary.total.eur > MONEY_EPS && (
                  <Typography sx={{ fontSize: 12, color: '#64748b' }}>
                    Also tracked: {formatWholeAmount(paySummary.total.eur)} EUR
                  </Typography>
                )}
              </Box>
            )}

            {/* PAID */}
            {(paySummary.paid.lyd > eps) && (
              <Box>
                <Typography sx={{ fontSize: 11, color: "#64748b" }}>Amount due(LYD)</Typography>
                <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#10b981" }}>
                  {formatWholeAmount(paySummary.paid.lyd)} LYD
                </Typography>
              </Box>
            )}

            {(paySummary.paid.usd > eps) && (
              <Box>
                <Typography sx={{ fontSize: 11, color: "#64748b" }}>Amount due(USD)</Typography>
                <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#10b981" }}>
                  {formatWholeAmount(paySummary.paid.usd)} USD
                </Typography>
                {(paySummary.paid.usdLyd > eps) && (
                  <Typography sx={{ fontSize: 12, color: "#64748b" }}>
                    ≈ {formatWholeAmount(paySummary.paid.usdLyd)} LYD
                  </Typography>
                )}
              </Box>
            )}

            {(paySummary.paid.eur > eps) && (
              <Box>
                <Typography sx={{ fontSize: 11, color: "#64748b" }}>Amount due(EUR)</Typography>
                <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#10b981" }}>
                  {formatWholeAmount(paySummary.paid.eur)} EUR
                </Typography>
                {(paySummary.paid.eurLyd > eps) && (
                  <Typography sx={{ fontSize: 12, color: "#64748b" }}>
                    ≈ {formatWholeAmount(paySummary.paid.eurLyd)} LYD
                  </Typography>
                )}
              </Box>
            )}

            {/* REMAINING */}
            {(remaining.lyd > eps) && (
              <Box>
                <Typography sx={{ fontSize: 11, color: "#64748b" }}>Remaining Amount (LYD)</Typography>
                <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#ef4444" }}>
                  {formatWholeAmount(remaining.lyd)} LYD
                </Typography>
              </Box>
            )}

            {(remaining.usd > eps) && (
              <Box>
                <Typography sx={{ fontSize: 11, color: "#64748b" }}>Remaining (USD)</Typography>
                <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#ef4444" }}>
                  {formatWholeAmount(remaining.usd)} USD
                </Typography>
                {(remainingUsdLyd > eps) && (
                  <Typography sx={{ fontSize: 12, color: "#64748b" }}>
                    ≈ {formatWholeAmount(remainingUsdLyd)} LYD
                  </Typography>
                )}
              </Box>
            )}

            {(remaining.eur > eps) && (
              <Box>
                <Typography sx={{ fontSize: 11, color: "#64748b" }}>Remaining (EUR)</Typography>
                <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#ef4444" }}>
                  {formatWholeAmount(remaining.eur)} EUR
                </Typography>
                {(remainingEurLyd > eps) && (
                  <Typography sx={{ fontSize: 12, color: "#64748b" }}>
                    ≈ {formatWholeAmount(remainingEurLyd)} LYD
                  </Typography>
                )}
              </Box>
            )}

            {/* If fully paid show a clean badge */}
            {paySummary.isClosed && fullyPaidNow && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Chip
                  label="✅ Fully Paid"
                  size="small"
                  sx={{ fontWeight: 900, bgcolor: "#dcfce7", color: "#166534" }}
                />
              </Box>
            )}
          </Box>
        </Box>

        {/* Products Section */}
        {(() => {
          console.log('[Card Debug] Invoice:', num, 'Details count:', details.length, 'Details:', details);
          return null;
        })()}
        {details.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: 16 }}>
                Products ({details.length})
              </Typography>
              <IconButton
                size="small"
                onClick={() =>
                  setExpandedProducts((prev) => ({
                    ...prev,
                    [rowKey]: !isProductsExpanded,
                  }))
                }
              >
                {isProductsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>

            <Collapse in={isProductsExpanded} timeout="auto" unmountOnExit>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                  gap: 1.5,
                }}
              >
                {details.map((d: any, idx: number) => {
                  const productImageId = d.imageId ?? d.id_achat ?? d.picint ?? d.id_art ?? d.ID_ART;
                  const imgType = resolveTypeFromSupplierType(d.typeSupplier);
                  const imgKey = makeImgKey(imgType, productImageId);

                  const productBlobUrls =
                    (imgKey && imageBlobUrls[imgKey]) ||
                    (productImageId != null ? imageBlobUrls[String(productImageId)] : []) ||
                    [];

                  const productRawUrls =
                    (imgKey && imageUrls[imgKey]) ||
                    (productImageId != null ? imageUrls[String(productImageId)] : []) ||
                    [];

                  const primaryImg = productBlobUrls[0] || productRawUrls[0] || FALLBACK_ITEM_IMAGE;

                  const rawPrice = d.prix_vente_remise;
                  const currencyLabel =
                    String(d.typeSupplier || "").toLowerCase().includes("gold") ? "LYD" : "USD";
                  const resolvedPriceLabel =
                    rawPrice !== "" && rawPrice !== null && rawPrice !== undefined
                      ? `${formatNumber(rawPrice)} ${currencyLabel}`
                      : "—";

                  return (
                    <Card
                      key={idx}
                      variant="outlined"
                      sx={{
                        borderRadius: 2,
                        overflow: "hidden",
                        border: (theme) => `1px solid ${theme.palette.divider}`,
                        transition: "0.15s ease",
                        "&:hover": {
                          boxShadow: 3,
                          borderColor: (theme) => theme.palette.primary.main,
                        },
                      }}
                    >
                      <Box sx={{ display: "flex", gap: 2, p: 1.5, alignItems: "stretch" }}>
                        <Box
                          sx={{
                            width: 92,
                            height: 92,
                            borderRadius: 2,
                            overflow: "hidden",
                            flex: "0 0 auto",
                            bgcolor: (theme) => (theme.palette.mode === "dark" ? "#111827" : "#e2e8f0"),
                            border: "1px solid rgba(0,0,0,0.06)",
                            position: "relative",
                            cursor: primaryImg !== FALLBACK_ITEM_IMAGE ? "pointer" : "default",
                          }}
                          onClick={() => {
                            if (primaryImg && primaryImg !== FALLBACK_ITEM_IMAGE) {
                              setImageDialogUrl(primaryImg);
                              setImageDialogOpen(true);
                            }
                          }}
                        >
                          <img
                            src={primaryImg}
                            alt="Product"
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            onError={(e) => {
                              const img = e.currentTarget as HTMLImageElement;
                              img.src = FALLBACK_ITEM_IMAGE;
                            }}
                          />
                          {d.IS_GIFT && (
                            <Chip
                              label="🎁 Gift"
                              size="small"
                              sx={{
                                position: "absolute",
                                top: 6,
                                left: 6,
                                bgcolor: "#fbbf24",
                                color: "#111827",
                                fontWeight: 900,
                                height: 22,
                              }}
                            />
                          )}
                        </Box>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                            <Typography
                              sx={{
                                fontWeight: 900,
                                fontSize: 14,
                                color: "text.primary",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={d.design || ""}
                            >
                              {d.design || "Unnamed Product"}
                            </Typography>

                            <Typography sx={{ fontWeight: 900, fontSize: 14, color: "primary.main", flex: "0 0 auto" }}>
                              {resolvedPriceLabel}
                            </Typography>
                          </Box>

                          <Box sx={{ mt: 0.75, display: "flex", gap: 1, flexWrap: "wrap" }}>
                            <Chip
                              label={String(d.typeSupplier || "").replace(/^\s+|\s+$/g, "") || "Type"}
                              size="small"
                              sx={{ fontWeight: 800 }}
                            />
                            {d.weight && (
                              <Chip label={`⚖️ ${d.weight}g`} size="small" sx={{ fontWeight: 800 }} />
                            )}
                            {d.code && (
                              <Chip label={`🔖 ${d.code}`} size="small" sx={{ fontWeight: 800 }} />
                            )}
                            {d.CODE_EXTERNAL && (
                              <Chip label={`Ref: ${d.CODE_EXTERNAL}`} size="small" sx={{ fontWeight: 800 }} />
                            )}
                            {productImageId && (
                              <Chip label={`ImgID: ${productImageId}`} size="small" sx={{ fontWeight: 800 }} />
                            )}
                          </Box>

                          {isChiraVal && (
                            <Button
                              variant="contained"
                              size="small"
                              fullWidth
                              sx={{ mt: 1.25, fontSize: 12, py: 0.75, textTransform: "none", fontWeight: 800 }}
                              onClick={() => {
                                const invoiceIdForLine = d.id_fact || row.id_fact || row.num_fact;
                                setChiraDialogIdFact(invoiceIdForLine);
                                setChiraDialogOpen(true);
                              }}
                            >
                              Return Chira
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </Card>
                  );
                })}
              </Box>
            </Collapse>
          </Box>
        )}

        {/* Action Buttons */}
        <Box sx={{ mt: "auto", pt: 2 }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: !isClosed ? "1fr 1fr" : "1fr",
              gap: 1.5,
              alignItems: "stretch",
            }}
          >
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FileCopyIcon />}
              onClick={() => {
                setSelectedInvoice(row);
                setPrintDialogOpen(true);
              }}
              sx={{ textTransform: 'none', fontWeight: 700, py: 1.25 }}
            >
              View Invoice
            </Button>

            {!isClosed && (
              <Button
                fullWidth
                variant="contained"
                color="error"
                onClick={async () => {
                  setCloseError("");
                  setClosePayLydStr("");
                  setClosePayUsdStr("");
                  setClosePayUsdLydStr("");
                  setClosePayEurStr("");
                  setClosePayEurLydStr("");
                  setCloseMakeCashVoucher(true);
                  setCloseInvoice(row);
                  setCloseDialogOpen(true);

                  try {
                    const token = localStorage.getItem("token");
                    const psParam = String(row?.ps ?? "");
                    const usrParam = String(row?.usr ?? "");
                    const nfParam = String(row?.num_fact ?? "");
                    if (token && psParam && usrParam && nfParam) {
                      const verifyRes = await axios.get(`/invoices/Getinvoice/`, {
                        params: { ps: psParam, usr: usrParam, num_fact: nfParam },
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      setCloseInvoiceRows(Array.isArray(verifyRes.data) ? verifyRes.data : []);
                    }
                  } catch {
                    setCloseInvoiceRows([]);
                  }
                }}
                sx={{ textTransform: 'none', fontWeight: 800, py: 1.25 }}
              >
                Validate Payment
              </Button>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

  const parseAmt = (s: string) => {
    if (!s) return 0;
    const v = Number(String(s).replace(/,/g, "").trim());
    return Number.isFinite(v) ? v : 0;
  };

  const moneyEps = 0.01;

  const splitMoney2 = React.useCallback((raw: any) => {
    const n = Number(raw) || 0;
    const base = Math.floor(n);
    let rem = Math.round((n - base) * 100) / 100;
    // handle floating carry
    if (rem >= 1) {
      return { base: base + 1, rem: 0 };
    }
    if (rem < 0) rem = 0;
    return { base, rem };
  }, []);

  const getUsdRate = React.useCallback(() => {
    const inv = closeInvoicePaymentSource;
    if (!inv) return NaN;
    const usd = Number(inv?.amount_currency) || 0;
    const usdLyd =
      Number(
        inv?.amount_currency_LYD ??
          inv?.amount_currency_lyd ??
          inv?.paid_currency_LYD ??
          inv?.paid_currency_lyd ??
          0
      ) || 0;
    if (usd > 0 && usdLyd > 0) {
      const r = usdLyd / usd;
      return Number.isFinite(r) && r > 0 ? r : NaN;
    }
    const r = Number(inv?.rate_usd ?? inv?.rate ?? inv?.USD_Rate);
    return Number.isFinite(r) && r > 0 ? r : NaN;
  }, [closeInvoicePaymentSource]);

  const getEurRate = React.useCallback(() => {
    const inv = closeInvoicePaymentSource;
    if (!inv) return NaN;
    const eur = Number(inv?.amount_EUR) || 0;
    const eurLyd =
      Number(
        inv?.amount_EUR_LYD ??
          inv?.amount_EUR_lyd ??
          inv?.paid_EUR_LYD ??
          inv?.paid_EUR_lyd ??
          0
      ) || 0;
    if (eur > 0 && eurLyd > 0) {
      const r = eurLyd / eur;
      return Number.isFinite(r) && r > 0 ? r : NaN;
    }
    return NaN;
  }, [closeInvoicePaymentSource]);

  const convertItemsImagesToBase64 = useCallback(
    async (urls: string[]): Promise<string[]> => {
      if (!urls || !urls.length) return [];
      if (typeof window === "undefined" || typeof fetch !== "function") return urls;
      const token = localStorage.getItem("token") || undefined;
      const prepared: string[] = [];
      for (const raw of urls) {
        if (!raw) continue;
        const lower = raw.toLowerCase();
        if (raw.startsWith("data:")) {
          prepared.push(raw);
          continue;
        }
        if (lower.includes(".avif")) {
          try {
            const converted = await convertAvifUrlToPngBase64(raw, token);
            prepared.push(converted);
            continue;
          } catch (err) {
            console.warn("[SalesReports] Failed to convert AVIF", err);
          }
        }
        prepared.push(raw);
      }
      return prepared;
    },
    []
  );

  const normalizeToSecureImagePath = (rawUrl: string): string => {
    if (!rawUrl) return rawUrl;
    if (rawUrl.startsWith("data:") || rawUrl.startsWith("blob:")) return rawUrl;

    try {
      const u = new URL(rawUrl, window.location.origin);
      const parts = u.pathname.split("/").filter(Boolean);
      const len = parts.length;
      if (len >= 3) {
        const filename = parts[len - 1];
        const idSeg = parts[len - 2];
        const mount = parts.slice(0, len - 2).join("/").toLowerCase();

        // GOLD
        if (
          mount.includes("uploads/goldpic") ||
          mount.includes("uploads/opurchases/upload-attachment") ||
          mount.includes("uploads/purchase")
        ) {
          return `/images/gold/${encodeURIComponent(idSeg)}/${encodeURIComponent(filename)}`;
        }

        // WATCH
        if (mount.includes("uploads/watchpic")) {
          return `/images/watch/${encodeURIComponent(idSeg)}/${encodeURIComponent(filename)}`;
        }

        // DIAMOND
        if (mount.includes("uploads/diamondpic") || mount.includes("uploads/diamond")) {
          return `/images/diamond/${encodeURIComponent(idSeg)}/${encodeURIComponent(filename)}`;
        }
      }

      // already secure
      if (u.pathname.startsWith("/images/")) return u.pathname;

      return rawUrl;
    } catch {
      return rawUrl;
    }
  };

  const getItemImageUrl = React.useCallback(
    (line: any) => {
      // 1) direct url fields if they exist
      const direct =
        line?.pic ||
        line?.image ||
        line?.img ||
        line?.photo ||
        line?.Watch?.watchpic ||
        line?.Watch?.pic ||
        line?.Gold?.goldpic ||
        line?.Diamond?.diamondpic ||
        line?.DistributionPurchase?.OriginalAchatWatch?.watchpic ||
        line?.DistributionPurchase?.OriginalAchatGold?.goldpic ||
        "";

      const directNorm = direct ? normalizeToSecureImagePath(String(direct)) : "";

      if (directNorm) return directNorm;

      // 2) cached fetched image (base64 usually)
      const t = getItemImageFetchTarget(line);
      if (!t) return "";
      const cached = itemImageCache[`${t.type}:${t.id}`];
      return cached || "";
    },
    [getItemImageFetchTarget, itemImageCache, normalizeToSecureImagePath]
  );

  const fetchImagesTyped = useCallback(async (
    id: number | string,
    type: "watches" | "diamond" | "gold"
  ): Promise<string[] | null> => {
    const token = localStorage.getItem("token");
    try {
      for (const base of IMAGE_BASES) {
        const url = `${base}/list/${type}/${id}`;
        try {
          const res = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const outRaw = Array.isArray(res.data) ? res.data : [];
          const out = outRaw
            .map((it: any) => {
              if (typeof it === "string") return it;
              if (it && typeof it === "object") return it.url || it.path || it.href || it.src || "";
              return "";
            })
            .filter(Boolean)
            .map(normalizeToSecureImagePath);

          if (out.length) {
            return await convertItemsImagesToBase64(out);
          }
        } catch {
          /* try next base */
        }
      }
    } catch {
      // ignore
    }
    return null;
  }, [IMAGE_BASES, convertItemsImagesToBase64]);

  const prefetchCloseLineImages = React.useCallback(async (lines: any[]) => {
    const targets = (lines || [])
      .map(getItemImageFetchTarget)
      .filter(Boolean) as { type: "watches" | "diamond" | "gold"; id: number }[];

    if (!targets.length) return;

    // don’t refetch what we already have
    const toFetch = targets.filter((t) => !itemImageCache[`${t.type}:${t.id}`]);
    if (!toFetch.length) return;

    for (const t of toFetch) {
      try {
        const imgs = await fetchImagesTyped(t.id, t.type);
        const first = Array.isArray(imgs) && imgs.length ? imgs[0] : null;
        if (first) {
          setItemImageCache((prev) => ({ ...prev, [`${t.type}:${t.id}`]: first }));
        } else {
          // store empty so we don't spam requests
          setItemImageCache((prev) => ({ ...prev, [`${t.type}:${t.id}`]: "" }));
        }
      } catch {
        setItemImageCache((prev) => ({ ...prev, [`${t.type}:${t.id}`]: "" }));
      }
    }
  }, [fetchImagesTyped, getItemImageFetchTarget, itemImageCache]);

  React.useEffect(() => {
    if (!closeDialogOpen) return;
    prefetchCloseLineImages(closeLines);
  }, [closeDialogOpen, closeLines, prefetchCloseLineImages]);

  const closeTotals = React.useMemo(() => {
  const inv: any = closeInvoicePaymentSource;
   
  if (!inv) {
    return {
      invoice: { lyd: 0, usd: 0, eur: 0 },
      recorded: { lyd: 0, usd: 0, eur: 0, usdLyd: 0, eurLyd: 0 },
      remaining: { lyd: 0, usd: 0, eur: 0 },
      remainingLyd: 0,
      totalLyd: 0,
    };
  }

  // Invoice totals (try multiple spellings)
  let invoiceLyd = normalizeMoney(
    pickFromKeys(inv, [
      "total_remise_final_lyd",
      "total_remise_final_LYD",
      "totalAmountLyd",
      "total_amount_lyd",
      "total_lyd",
      "total_LYD",
      // sometimes totals are only stored in the generic field
      "total_remise_final",
    ])
  );

  const invoiceUsd = normalizeMoney(
    pickFromKeys(inv, [
      "total_usd",
      "total_USD",
      "total_currency_usd",
      "totalAmountUsd",
      "total_amount_usd",
      "total_remise_final_usd",
    ])
  );

  const invoiceEur = normalizeMoney(
    pickFromKeys(inv, [
      "total_eur",
      "total_EUR",
      "total_currency_eur",
      "totalAmountEur",
      "total_amount_eur",
      "total_remise_final_eur",
    ])
  );

  // Recorded
  const recordedLyd = normalizeMoney(
    pickFromKeys(inv, ["amount_lyd", "amount_LYD", "paid_lyd", "paid_LYD"])
  );

  let recordedUsd = normalizeMoney(pickFromKeys(inv, ["amount_usd", "amount_currency", "paid_usd", "paid_currency"]));
  let recordedEur = normalizeMoney(pickFromKeys(inv, ["amount_eur", "amount_EUR", "paid_eur", "paid_EUR"]));

  // fallback: single currency field + devise/currency
  const maybeOneCurrency = normalizeMoney(pickFromKeys(inv, ["amount_currency", "Amount_currency", "paid_currency"]));
  const cur = String(inv?.devise || inv?.currency || inv?.Currency || "").toUpperCase();
  if (maybeOneCurrency > 0) {
    if (!recordedUsd && cur === "USD") recordedUsd = maybeOneCurrency;
    if (!recordedEur && cur === "EUR") recordedEur = maybeOneCurrency;
  }

  const usdRate = Number.isFinite(getUsdRate?.()) ? Number(getUsdRate()) : 0;
  const eurRate = Number.isFinite(getEurRate?.()) ? Number(getEurRate()) : 0;

  if (invoiceLyd <= MONEY_EPS) {
    if (invoiceUsd > MONEY_EPS && usdRate > 0) {
      invoiceLyd = normalizeMoney(invoiceUsd * usdRate);
    } else if (invoiceEur > MONEY_EPS && eurRate > 0) {
      invoiceLyd = normalizeMoney(invoiceEur * eurRate);
    }
  }

  const recordedUsdLydExplicit =
    toFiniteNumber(inv?.amount_currency_LYD) ??
    toFiniteNumber(inv?.amount_currency_lyd) ??
    toFiniteNumber(inv?.paid_currency_LYD) ??
    toFiniteNumber(inv?.paid_currency_lyd) ??
    null;
  const recordedEurLydExplicit =
    toFiniteNumber(inv?.amount_EUR_LYD) ??
    toFiniteNumber(inv?.amount_EUR_lyd) ??
    toFiniteNumber(inv?.paid_EUR_LYD) ??
    toFiniteNumber(inv?.paid_EUR_lyd) ??
    null;

  const recordedUsdLyd = normalizeMoney(
    recordedUsdLydExplicit !== null
      ? recordedUsdLydExplicit
      : recordedUsd * (usdRate > 0 ? usdRate : 0)
  );
  const recordedEurLyd = normalizeMoney(
    recordedEurLydExplicit !== null
      ? recordedEurLydExplicit
      : recordedEur * (eurRate > 0 ? eurRate : 0)
  );

  const remainingUsdBackend = toFiniteNumber(
    inv?.rest_of_moneyUSD ?? inv?.rest_of_money_usd
  );
  const remainingEurBackend = toFiniteNumber(
    inv?.rest_of_moneyEUR ?? inv?.rest_of_money_eur
  );
  const remainingLydBackend = toFiniteNumber(
    inv?.rest_of_money ?? inv?.rest_of_moneyLYD ?? inv?.rest_of_money_lyd
  );

  // ✅ Remaining per currency (cannot exceed invoice totals)
  const remainingUsd =
    remainingUsdBackend !== null && remainingUsdBackend > MONEY_EPS
      ? clamp0(normalizeMoney(remainingUsdBackend))
      : clamp0(normalizeMoney(invoiceUsd - recordedUsd));
  const remainingEur =
    remainingEurBackend !== null && remainingEurBackend > MONEY_EPS
      ? clamp0(normalizeMoney(remainingEurBackend))
      : clamp0(normalizeMoney(invoiceEur - recordedEur));

  // ✅ Remaining LYD is LYD invoice minus LYD + equivalents (prefer backend remainder when present)
  const remainingLyd =
    remainingLydBackend !== null && remainingLydBackend >= 0
      ? clamp0(normalizeMoney(remainingLydBackend))
      : clamp0(
          normalizeMoney(
            invoiceLyd - (recordedLyd + recordedUsdLyd + recordedEurLyd)
          )
        );

  return {
    invoice: { lyd: invoiceLyd, usd: invoiceUsd, eur: invoiceEur },
    recorded: { lyd: recordedLyd, usd: recordedUsd, eur: recordedEur, usdLyd: recordedUsdLyd, eurLyd: recordedEurLyd },
    remaining: { lyd: remainingLyd, usd: remainingUsd, eur: remainingEur },
    remainingLyd,
    totalLyd: invoiceLyd,
  };
}, [closeInvoicePaymentSource, getUsdRate, getEurRate]);

  const closePayNow = React.useMemo(() => {
  const payLyd = normalizeMoney(parseAmt(closePayLydStr));
  const payUsd = normalizeMoney(parseAmt(closePayUsdStr));
  const payUsdLyd = normalizeMoney(parseAmt(closePayUsdLydStr));
  const payEur = normalizeMoney(parseAmt(closePayEurStr));
  const payEurLyd = normalizeMoney(parseAmt(closePayEurLydStr));

  const payNowLydEquiv = normalizeMoney(payLyd + payUsdLyd + payEurLyd);

  return { payLyd, payUsd, payUsdLyd, payEur, payEurLyd, payNowLydEquiv };
}, [closePayLydStr, closePayUsdStr, closePayUsdLydStr, closePayEurStr, closePayEurLydStr]);

  const closeEntered = React.useMemo(() => {
    const lyd = normalizeMoney(parseAmt(closePayLydStr));
    const usd = normalizeMoney(parseAmt(closePayUsdStr));
    const usdLyd = normalizeMoney(parseAmt(closePayUsdLydStr));
    const eur = normalizeMoney(parseAmt(closePayEurStr));
    const eurLyd = normalizeMoney(parseAmt(closePayEurLydStr));

    const totalLydEquiv = normalizeMoney(lyd + usdLyd + eurLyd);
    const usdEquivMissing = usd > MONEY_EPS && usdLyd <= MONEY_EPS;
    const eurEquivMissing = eur > MONEY_EPS && eurLyd <= MONEY_EPS;

    return {
      pay: { lyd, usd, eur, usdLyd, eurLyd },
      lyd,
      usd,
      usdLyd,
      eur,
      eurLyd,
      totalLydEquiv,
      usdEquivMissing,
      eurEquivMissing,
    };
  }, [
    closePayLydStr,
    closePayUsdStr,
    closePayUsdLydStr,
    closePayEurStr,
    closePayEurLydStr,
    parseAmt,
  ]);

  const closeUsdEquivMissing = closeEntered.usdEquivMissing;
  const closeEurEquivMissing = closeEntered.eurEquivMissing;

  const { usdDiff, eurDiff, lydDiff, closeMismatch, closeIsOverpay } = React.useMemo(() => {
    const usdTol = 0.01;
    const eurTol = 0.01;
    // Business rule: if LYD remainder is < 1, treat it as 0 (rounding)
    const lydTol = 1;

    // compare what user enters AGAINST REMAINING (not against recorded)
    const usdDiff = normalizeMoney(closeTotals.recorded.usd - closeEntered.pay.usd);
    const eurDiff = normalizeMoney(closeTotals.recorded.eur - closeEntered.pay.eur);
    // LYD comparison is based on invoice Total (LYD) vs Entered Total (LYD equiv)
    const lydDiff = normalizeMoney(closeTotals.totalLyd - closeEntered.totalLydEquiv);

    const closeMismatch =
      Math.abs(usdDiff) > usdTol || Math.abs(eurDiff) > eurTol || Math.abs(lydDiff) > lydTol;
    // overpay = entered more than remaining → diff becomes negative
    const closeIsOverpay = usdDiff < -usdTol || eurDiff < -eurTol || lydDiff < -lydTol;
    return { usdDiff, eurDiff, lydDiff, closeMismatch, closeIsOverpay };
  }, [closeTotals, closeEntered]);

  const alreadyPaid = closeTotals.recorded;

  const paidAfter = React.useMemo(() => {
    return {
      lyd: normalizeMoney(alreadyPaid.lyd + closeEntered.pay.lyd),
      usd: normalizeMoney(alreadyPaid.usd + closeEntered.pay.usd),
      usdLyd: normalizeMoney(alreadyPaid.usdLyd + closeEntered.pay.usdLyd),
      eur: normalizeMoney(alreadyPaid.eur + closeEntered.pay.eur),
      eurLyd: normalizeMoney(alreadyPaid.eurLyd + closeEntered.pay.eurLyd),
    };
  }, [alreadyPaid, closeEntered]);

  const invoiceTotals = closeTotals.invoice;

  const remainingAfter = React.useMemo(() => {
    // remaining is invoice totals - paid totals (per currency)
    const lyd = clamp0(
      normalizeMoney(invoiceTotals.lyd - (paidAfter.lyd + paidAfter.usdLyd + paidAfter.eurLyd))
    );
    const usd = clamp0(normalizeMoney(invoiceTotals.usd - paidAfter.usd));
    const eur = clamp0(normalizeMoney(invoiceTotals.eur - paidAfter.eur));
    return {
      lyd: lyd < 1 ? 0 : lyd,
      usd,
      eur,
    };
  }, [invoiceTotals, paidAfter]);
  
  // Check for overpayment: entered > recorded in any currency
  const closeIsRemainder = React.useMemo(() => {
    return closeEntered.totalLydEquiv + 0.01 < closeTotals.remainingLyd;
  }, [closeEntered.totalLydEquiv, closeTotals.remainingLyd]);
  
  const closeCustomerDisplay = React.useMemo(() => {
    const inv = closeInvoice;
    if (!inv) return "";
    const rawClient = inv.Client || inv.client || null;
    if (rawClient && typeof rawClient === "object") {
      const name =
        rawClient.client_name ||
        rawClient.name ||
        rawClient.name_client ||
        rawClient.ClientName ||
        rawClient.NAME_CLIENT ||
        rawClient.fullName ||
        "";
      const phone =
        rawClient.tel_client ||
        rawClient.phone ||
        rawClient.tel ||
        rawClient.telephone ||
        rawClient.contact ||
        "";
      const parts = [name, phone].filter(Boolean);
      if (parts.length) {
        return parts.join(" • ");
      }
    }
    const fallback =
      inv.client_name ||
      inv.ClientName ||
      inv.clientName ||
      inv.name_client ||
      inv.client ||
      "";
    return String(fallback || "").trim();
  }, [closeInvoice]);

  const closeIsFullyPaidNow =
    remainingAfter.lyd <= moneyEps &&
    remainingAfter.usd <= moneyEps &&
    remainingAfter.eur <= moneyEps;
  
  const closeRemainingAfter = React.useMemo(() => {
    const lyd = clamp0(normalizeMoney(closeTotals.remaining.lyd - closeEntered.totalLydEquiv));
    const usd = clamp0(normalizeMoney(closeTotals.remaining.usd - closeEntered.pay.usd));
    const eur = clamp0(normalizeMoney(closeTotals.remaining.eur - closeEntered.pay.eur));
    return {
      lyd: lyd < 1 ? 0 : lyd,
      usd,
      eur,
    };
  }, [closeTotals.remaining, closeEntered]);

  const handleConfirmCloseInvoice = async () => {
    const inv = closeInvoice;
    if (!inv) return;
    setCloseError("");

    console.log("[Close Invoice] Validation check:", {
      closeIsOverpay,
      lydDiff,
      usdDiff,
      eurDiff,
      entered: closeEntered,
      recorded: closeTotals.recorded,
    });

    // Allow remainder, but never allow overpayment.
    if (closeIsOverpay) {
      console.error("[Close Invoice] Overpayment detected!");
      setCloseError("Overpayment detected. Reduce the entered amount.");
      return;
    }
    if (closeUsdEquivMissing) {
      setCloseError("If you enter USD you must also enter the LYD equivalent.");
      return;
    }
    if (closeEurEquivMissing) {
      setCloseError("If you enter EUR you must also enter the LYD equivalent.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setCloseError("Missing token. Please login again.");
      return;
    }

    const psParam = String(inv?.ps ?? "");
    const usrParam = String(inv?.usr ?? "");
    const numFactParam = String(inv?.num_fact ?? "");
    if (!psParam || !usrParam || !numFactParam) {
      setCloseError("Invoice ps/usr/num_fact missing.");
      return;
    }

    setCloseLoading(true);
    try {
      // IMPORTANT:
      // On close, do NOT update USD/EUR payment fields (they can be duplicated by SUM across invoice rows).
      // Only persist IS_OK + remainders, via CloseNF so backend performs the update once.

      // Persist remainder based on invoice totals minus what user entered now.
      // This avoids relying on any backend-stored "remaining" fields which may be 0/empty.
      const clamp0 = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

      // IMPORTANT: equivalents may still be empty if the user didn't blur the input.
      // Compute them here so remainder is persisted correctly.
      const enteredPayLyd = clamp0(normalizeMoney(closeEntered.pay.lyd));
      const enteredPayUsd = clamp0(normalizeMoney(closeEntered.pay.usd));
      const enteredPayEur = clamp0(normalizeMoney(closeEntered.pay.eur));

      const usdRate = Number.isFinite(getUsdRate?.()) ? Number(getUsdRate()) : 0;
      const eurRate = Number.isFinite(getEurRate?.()) ? Number(getEurRate()) : 0;

      const enteredPayUsdLyd = clamp0(
        normalizeMoney(
          closeEntered.pay.usdLyd > MONEY_EPS
            ? closeEntered.pay.usdLyd
            : enteredPayUsd > MONEY_EPS && usdRate > 0
              ? enteredPayUsd * usdRate
              : 0
        )
      );

      const enteredPayEurLyd = clamp0(
        normalizeMoney(
          closeEntered.pay.eurLyd > MONEY_EPS
            ? closeEntered.pay.eurLyd
            : enteredPayEur > MONEY_EPS && eurRate > 0
              ? enteredPayEur * eurRate
              : 0
        )
      );

      const enteredTotalLydEquiv = clamp0(
        normalizeMoney(enteredPayLyd + enteredPayUsdLyd + enteredPayEurLyd)
      );
      const nextRestLyd = (() => {
        const v = clamp0(normalizeMoney(closeTotals.totalLyd - enteredTotalLydEquiv));
        return v < 1 ? 0 : v;
      })();
      const nextRestUsd = clamp0(normalizeMoney(closeTotals.invoice.usd - enteredPayUsd));
      const nextRestEur = clamp0(normalizeMoney(closeTotals.invoice.eur - enteredPayEur));

      const closeParams = {
        ps: psParam,
        usr: usrParam,
        num_fact: numFactParam,
        MakeCashVoucher: String(!!closeMakeCashVoucher),
        Type: String(inv?.type ?? inv?.Type ?? ""),
        rest_of_money: nextRestLyd,
        rest_of_moneyUSD: nextRestUsd,
        rest_of_moneyEUR: nextRestEur,
      };

      // Close invoice (triggers GL)
      console.log("[Close Invoice] Calling CloseNF endpoint...");
      console.log("[Close Invoice] Totals vs Entered:", {
        invoice: closeTotals.invoice,
        totalLyd: closeTotals.totalLyd,
        entered: {
          lyd: enteredPayLyd,
          usd: enteredPayUsd,
          usdLyd: enteredPayUsdLyd,
          eur: enteredPayEur,
          eurLyd: enteredPayEurLyd,
        },
        enteredTotalLydEquiv,
        computedRest: { lyd: nextRestLyd, usd: nextRestUsd, eur: nextRestEur },
      });
      console.log("[Close Invoice] CloseNF params:", closeParams);
      const closeRes = await axios.get(`/invoices/CloseNF`, {
        params: closeParams,
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("[Close Invoice] CloseNF response:", closeRes.data);

      setCloseDialogOpen(false);
      setCloseInvoice(null);
      setCloseInvoiceRows([]);
      setInvoiceRefreshFlag((f) => f + 1);
      console.log("[Close Invoice] Success! Invoice closed.");
    } catch (e: any) {
      console.error("[Close Invoice] Error:", e);
      setCloseError(e?.response?.data?.message || e?.message || "Failed to close invoice");
    } finally {
      setCloseLoading(false);
    }
  };

  return (
    <Box sx={{ mt: 4 }}>
      <React.Fragment>
        {/* Filters row */}
        <Card sx={{ mb: 2, borderRadius: 2, boxShadow: 1 }}>
          <CardContent sx={{ p: 2 }}>
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 2,
                alignItems: "center",
              }}
            >
              {/* Type */}
              <Box sx={{ flex: "1 1 220px", minWidth: 220, maxWidth: { md: 320 } }}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="type-select-label">Type</InputLabel>
                  <Select
                    labelId="type-select-label"
                    multiple
                    value={selectedTypes}
                    label="Type"
                    onChange={(e) =>
                      setSelectedTypes(
                        typeof e.target.value === "string"
                          ? e.target.value.split(",")
                          : (e.target.value as string[])
                      )
                    }
                    renderValue={(selected) => (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {(selected as string[]).map((value) => (
                          <Chip
                            key={value}
                            label={typeOptions.find((o) => o.value === value)?.label || value}
                            size="small"
                          />
                        ))}
                      </Box>
                    )}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="gold">Gold</MenuItem>
                    <MenuItem value="diamond">Diamond</MenuItem>
                    <MenuItem value="watches">Watch</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* Invoice classification */}
              <Box sx={{ flex: "1 1 260px", minWidth: 240, maxWidth: { md: 360 } }}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="sale-kind-label">Invoice classification</InputLabel>
                  <Select
                    labelId="sale-kind-label"
                    multiple
                    value={saleKinds}
                    label="Invoice classification"
                    onChange={(e) =>
                      setSaleKinds(
                        typeof e.target.value === "string"
                          ? e.target.value.split(",")
                          : (e.target.value as string[])
                      )
                    }
                    renderValue={(selected) => (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {(selected as string[]).map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    <MenuItem value="All">All</MenuItem>
                    <MenuItem value="Chira">Chira</MenuItem>
                    <MenuItem value="Gift">Gift</MenuItem>
                    <MenuItem value="Wholesale">Wholesale</MenuItem>
                    <MenuItem value="Normal">Normal Sale</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* PS */}
              <Box sx={{ flex: "1 1 220px", minWidth: 220, maxWidth: { md: 320 } }}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="ps-select-label">Point of Sale</InputLabel>
                  <Select
                    labelId="ps-select-label"
                    value={selectedPs}
                    label="Point of Sale"
                    onChange={(e) => setSelectedPs(e.target.value as string)}
                    disabled={isUser}
                  >
                    <MenuItem value="all">All</MenuItem>
                    {psOptions.map((opt) => (
                      <MenuItem key={opt.Id_point} value={String(opt.Id_point)}>
                        {opt.name_point}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {/* Payment Status */}
              <Box sx={{ flex: "1 1 220px", minWidth: 220, maxWidth: { md: 320 } }}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="payment-status-label">Payment status</InputLabel>
                  <Select
                    labelId="payment-status-label"
                    value={paymentStatus}
                    label="Payment status"
                    onChange={(e) => setPaymentStatus(e.target.value as any)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="paid">Paid</MenuItem>
                    <MenuItem value="unpaid">Unpaid</MenuItem>
                    <MenuItem value="partial">Partially paid</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* Dates */}
              <Box sx={{ flex: "1 1 160px", minWidth: 160, maxWidth: { md: 220 } }}>
                <TextField
                  label="From"
                  type="date"
                  size="small"
                  fullWidth
                  value={periodFrom}
                  onChange={(e) => setPeriodFrom(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>

              <Box sx={{ flex: "1 1 160px", minWidth: 160, maxWidth: { md: 220 } }}>
                <TextField
                  label="To"
                  type="date"
                  size="small"
                  fullWidth
                  value={periodTo}
                  onChange={(e) => setPeriodTo(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>

              {/* Sort */}
              <Box sx={{ flex: "1 1 220px", minWidth: 220, maxWidth: { md: 320 } }}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="sort-by-label">Sort by</InputLabel>
                  <Select
                    labelId="sort-by-label"
                    value={sortBy}
                    label="Sort by"
                    onChange={(e) => setSortBy(e.target.value as any)}
                  >
                    <MenuItem value="invoice_number">Invoice number</MenuItem>
                    <MenuItem value="value">Value</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ flex: "1 1 160px", minWidth: 160, maxWidth: { md: 220 } }}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="sort-dir-label">Direction</InputLabel>
                  <Select
                    labelId="sort-dir-label"
                    value={sortDir}
                    label="Direction"
                    onChange={(e) => setSortDir(e.target.value as any)}
                  >
                    <MenuItem value="desc">High to low</MenuItem>
                    <MenuItem value="asc">Low to high</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {sortBy === "value" && (
                <Box sx={{ flex: "1 1 160px", minWidth: 160, maxWidth: { md: 220 } }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel id="sort-currency-label">Currency</InputLabel>
                    <Select
                      labelId="sort-currency-label"
                      value={sortCurrency}
                      label="Currency"
                      onChange={(e) => setSortCurrency(e.target.value as any)}
                    >
                      <MenuItem value="LYD">LYD</MenuItem>
                      <MenuItem value="USD">USD</MenuItem>
                      <MenuItem value="EUR">EUR</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              )}

              {/* Search */}
              <Box sx={{ flex: "2 1 280px", minWidth: 240 }}>
                <TextField
                  label="Search in all data"
                  size="small"
                  fullWidth
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                />
              </Box>

              <Box sx={{ flex: "2 1 320px", minWidth: 260 }}>
                <TextField
                  label="Customer (name / ID / phone)"
                  size="small"
                  fullWidth
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
              </Box>

              {/* Export Buttons */}
              <Box
                sx={{
                  flex: "1 1 360px",
                  minWidth: 280,
                  marginLeft: { md: "auto" },
                }}
              >
                <Box sx={{ display: "flex", gap: 1.5 }}>
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel id="cards-per-row-label">Cards / Row</InputLabel>
                    <Select
                      labelId="cards-per-row-label"
                      value={cardsPerRow}
                      label="Cards / Row"
                      onChange={(e) => {
                        const v = Number(e.target.value) || 1;
                        setCardsPerRow(Math.min(4, Math.max(1, v)));
                      }}
                    >
                      <MenuItem value={1}>1</MenuItem>
                      <MenuItem value={2}>2</MenuItem>
                      <MenuItem value={3}>3</MenuItem>
                      <MenuItem value={4}>4</MenuItem>
                    </Select>
                  </FormControl>
                  <Button
                    fullWidth
                    variant="contained"
                    color="info"
                    onClick={exportTableToHtml}
                    startIcon={<FileDownload />}
                    sx={{ fontWeight: 700 }}
                  >
                    HTML
                  </Button>
                  <Button
                    fullWidth
                    variant="contained"
                    color="success"
                    onClick={exportTableToExcel}
                    startIcon={<FileCopyIcon />}
                    sx={{ fontWeight: 700 }}
                  >
                    Excel
                  </Button>
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2, borderRadius: 2, boxShadow: 1 }}>
          <CardContent sx={{ p: 2 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
                gap: 2,
                alignItems: "start",
              }}
            >
              <Box>
                <Typography variant="body2" color="textSecondary">Total unpaid</Typography>
                <Typography variant="h6" sx={{ fontWeight: 900, color: "error.main" }}>
                  LYD {formatNumber(topSummary.unpaid.lyd)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  USD {formatNumber(topSummary.unpaid.usd)}
                  {topSummary.unpaid.eur > MONEY_EPS ? ` • EUR ${formatNumber(topSummary.unpaid.eur)}` : ""}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="textSecondary">Invoice Count</Typography>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  {summaryStats.invoiceCount}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="textSecondary">Item Count</Typography>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  {summaryStats.itemCount}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="textSecondary">Total Weight (gram)</Typography>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  {formatNumber(summaryStats.totalWeight)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Gold grams sold: {formatNumber(topSummary.totalGoldGrams)} g
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="textSecondary">Total (gold)</Typography>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  {formatNumber(summaryStats.totalGold)} LYD
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Items sold: {topSummary.byType.gold.itemsSold}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="textSecondary">Total (diamond / watches)</Typography>
                <Typography variant="body2" sx={{ fontWeight: 900 }}>
                  Diamond: {formatNumber(summaryStats.totalDiamond)} USD
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 900 }}>
                  Watches: {formatNumber(summaryStats.totalWatch)} USD
                </Typography>
              </Box>
            </Box>

            <Box sx={{ mt: 1.5, display: "flex", justifyContent: "flex-end" }}>
              <Button
                size="small"
                variant="text"
                onClick={() => setShowTopSummaryDetails((v) => !v)}
                startIcon={showTopSummaryDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                {showTopSummaryDetails ? "Hide breakdown" : "Show breakdown"}
              </Button>
            </Box>

            <Collapse in={showTopSummaryDetails} timeout="auto" unmountOnExit>
              <Box
                sx={{
                  mt: 1.5,
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
                  gap: 2,
                }}
              >
                {/* GOLD */}
                <Card variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
                  <CardContent sx={{ p: 1.5 }}>
                    <Typography sx={{ fontWeight: 900, mb: 1, color: "#b45309" }}>Gold</Typography>

                    <Typography variant="body2" color="textSecondary">Items sold</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>
                      {topSummary.byType.gold.itemsSold}
                    </Typography>

                    <Typography variant="body2" color="textSecondary">Sales</Typography>
                    <Typography sx={{ fontWeight: 900 }}>
                      LYD {formatWholeAmount(topSummary.byType.gold.sales.lyd)}
                    </Typography>
                    {(topSummary.byType.gold.sales.usd > MONEY_EPS || topSummary.byType.gold.sales.eur > MONEY_EPS) && (
                      <Typography variant="body2" color="textSecondary">
                        {topSummary.byType.gold.sales.usd > MONEY_EPS ? `USD ${formatWholeAmount(topSummary.byType.gold.sales.usd)}` : ""}
                        {topSummary.byType.gold.sales.usd > MONEY_EPS && topSummary.byType.gold.sales.eur > MONEY_EPS ? " • " : ""}
                        {topSummary.byType.gold.sales.eur > MONEY_EPS ? `EUR ${formatWholeAmount(topSummary.byType.gold.sales.eur)}` : ""}
                      </Typography>
                    )}

                    <Divider sx={{ my: 1.25 }} />

                    <Typography variant="body2" color="textSecondary">Unpaid</Typography>
                    <Typography sx={{ fontWeight: 900, color: "error.main" }}>
                      LYD {formatWholeAmount(topSummary.byType.gold.unpaid.lyd)}
                    </Typography>
                    {(topSummary.byType.gold.unpaid.usd > MONEY_EPS || topSummary.byType.gold.unpaid.eur > MONEY_EPS) && (
                      <Typography variant="body2" color="textSecondary">
                        {topSummary.byType.gold.unpaid.usd > MONEY_EPS ? `USD ${formatWholeAmount(topSummary.byType.gold.unpaid.usd)}` : ""}
                        {topSummary.byType.gold.unpaid.usd > MONEY_EPS && topSummary.byType.gold.unpaid.eur > MONEY_EPS ? " • " : ""}
                        {topSummary.byType.gold.unpaid.eur > MONEY_EPS ? `EUR ${formatWholeAmount(topSummary.byType.gold.unpaid.eur)}` : ""}
                      </Typography>
                    )}
                  </CardContent>
                </Card>

                {/* DIAMOND */}
                <Card variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
                  <CardContent sx={{ p: 1.5 }}>
                    <Typography sx={{ fontWeight: 900, mb: 1, color: "#0ea5e9" }}>Diamond</Typography>

                    <Typography variant="body2" color="textSecondary">Items sold</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>
                      {topSummary.byType.diamond.itemsSold}
                    </Typography>

                    <Typography variant="body2" color="textSecondary">Sales</Typography>
                    <Typography sx={{ fontWeight: 900 }}>
                      USD {formatWholeAmount(topSummary.byType.diamond.sales.usd)}
                    </Typography>
                    {(topSummary.byType.diamond.sales.lyd > MONEY_EPS || topSummary.byType.diamond.sales.eur > MONEY_EPS) && (
                      <Typography variant="body2" color="textSecondary">
                        {topSummary.byType.diamond.sales.lyd > MONEY_EPS ? `LYD ${formatWholeAmount(topSummary.byType.diamond.sales.lyd)}` : ""}
                        {topSummary.byType.diamond.sales.lyd > MONEY_EPS && topSummary.byType.diamond.sales.eur > MONEY_EPS ? " • " : ""}
                        {topSummary.byType.diamond.sales.eur > MONEY_EPS ? `EUR ${formatWholeAmount(topSummary.byType.diamond.sales.eur)}` : ""}
                      </Typography>
                    )}

                    <Divider sx={{ my: 1.25 }} />

                    <Typography variant="body2" color="textSecondary">Unpaid</Typography>
                    <Typography sx={{ fontWeight: 900, color: (topSummary.byType.diamond.unpaid.usd > MONEY_EPS || topSummary.byType.diamond.unpaid.lyd > MONEY_EPS || topSummary.byType.diamond.unpaid.eur > MONEY_EPS) ? "error.main" : "text.primary" }}>
                      USD {formatWholeAmount(topSummary.byType.diamond.unpaid.usd)}
                    </Typography>
                    {(topSummary.byType.diamond.unpaid.lyd > MONEY_EPS || topSummary.byType.diamond.unpaid.eur > MONEY_EPS) && (
                      <Typography variant="body2" color="textSecondary">
                        {topSummary.byType.diamond.unpaid.lyd > MONEY_EPS ? `LYD ${formatWholeAmount(topSummary.byType.diamond.unpaid.lyd)}` : ""}
                        {topSummary.byType.diamond.unpaid.lyd > MONEY_EPS && topSummary.byType.diamond.unpaid.eur > MONEY_EPS ? " • " : ""}
                        {topSummary.byType.diamond.unpaid.eur > MONEY_EPS ? `EUR ${formatWholeAmount(topSummary.byType.diamond.unpaid.eur)}` : ""}
                      </Typography>
                    )}
                  </CardContent>
                </Card>

                {/* WATCHES */}
                <Card variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
                  <CardContent sx={{ p: 1.5 }}>
                    <Typography sx={{ fontWeight: 900, mb: 1, color: "#7c3aed" }}>Watches</Typography>

                    <Typography variant="body2" color="textSecondary">Items sold</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>
                      {topSummary.byType.watches.itemsSold}
                    </Typography>

                    <Typography variant="body2" color="textSecondary">Sales</Typography>
                    <Typography sx={{ fontWeight: 900 }}>
                      USD {formatWholeAmount(topSummary.byType.watches.sales.usd)}
                    </Typography>
                    {(topSummary.byType.watches.sales.lyd > MONEY_EPS || topSummary.byType.watches.sales.eur > MONEY_EPS) && (
                      <Typography variant="body2" color="textSecondary">
                        {topSummary.byType.watches.sales.lyd > MONEY_EPS ? `LYD ${formatWholeAmount(topSummary.byType.watches.sales.lyd)}` : ""}
                        {topSummary.byType.watches.sales.lyd > MONEY_EPS && topSummary.byType.watches.sales.eur > MONEY_EPS ? " • " : ""}
                        {topSummary.byType.watches.sales.eur > MONEY_EPS ? `EUR ${formatWholeAmount(topSummary.byType.watches.sales.eur)}` : ""}
                      </Typography>
                    )}

                    <Divider sx={{ my: 1.25 }} />

                    <Typography variant="body2" color="textSecondary">Unpaid</Typography>
                    <Typography sx={{ fontWeight: 900, color: (topSummary.byType.watches.unpaid.usd > MONEY_EPS || topSummary.byType.watches.unpaid.lyd > MONEY_EPS || topSummary.byType.watches.unpaid.eur > MONEY_EPS) ? "error.main" : "text.primary" }}>
                      USD {formatWholeAmount(topSummary.byType.watches.unpaid.usd)}
                    </Typography>
                    {(topSummary.byType.watches.unpaid.lyd > MONEY_EPS || topSummary.byType.watches.unpaid.eur > MONEY_EPS) && (
                      <Typography variant="body2" color="textSecondary">
                        {topSummary.byType.watches.unpaid.lyd > MONEY_EPS ? `LYD ${formatWholeAmount(topSummary.byType.watches.unpaid.lyd)}` : ""}
                        {topSummary.byType.watches.unpaid.lyd > MONEY_EPS && topSummary.byType.watches.unpaid.eur > MONEY_EPS ? " • " : ""}
                        {topSummary.byType.watches.unpaid.eur > MONEY_EPS ? `EUR ${formatWholeAmount(topSummary.byType.watches.unpaid.eur)}` : ""}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Box>
            </Collapse>
          </CardContent>
        </Card>

        {/* Cards container */}
        <Box id="export-table-container">
          {loading ? (
            <CircularProgress />
          ) : (
            <>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "repeat(1, minmax(0, 1fr))",
                    sm: `repeat(${Math.min(cardsPerRow, 2)}, minmax(0, 1fr))`,
                    md: `repeat(${cardsPerRow}, minmax(0, 1fr))`,
                  },
                  gap: 3,
                  pb: 1,
                }}
              >
                {pagedData.map((row) => renderInvoiceCard(row))}
              </Box>
              {pagedData.length === 0 && (
                <Typography sx={{ mt: 2, fontSize: 14, color: "#777" }}>
                  No invoices found.
                </Typography>
              )}

              {/* Pagination controls */}
              <Box
                sx={{
                  mt: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  flexWrap: "wrap",
                }}
              >
                {pageCount > 1 && (
                  <>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={safePageIndex === 0}
                      onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
                    >
                      Prev
                    </Button>
                    <Typography sx={{ fontSize: 13 }}>
                      Page {safePageIndex + 1} of {pageCount}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={safePageIndex >= pageCount - 1}
                      onClick={() => setPageIndex((prev) => Math.min(pageCount - 1, prev + 1))}
                    >
                      Next
                    </Button>
                  </>
                )}

                {/* Rows-per-page selector stays visible even when there is only 1 page */}
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="rows-per-page-label">Rows / Page</InputLabel>
                  <Select
                    labelId="rows-per-page-label"
                    value={pageSize}
                    label="Rows / Page"
                    onChange={(e) => {
                      const raw = e.target.value;
                      const v = Number(raw) || 1;
                      setPageSize(v);
                      setPageIndex(0);
                    }}
                  >
                    <MenuItem value={5}>5</MenuItem>
                    <MenuItem value={10}>10</MenuItem>
                    <MenuItem value={50}>50</MenuItem>
                    <MenuItem value={100}>100</MenuItem>
                    <MenuItem value={Math.max(1, filteredData.length)}>All</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </>
          )}
        </Box>

        {/* Summary totals moved to top after search fields */}

        <Dialog
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Details</DialogTitle>
          <DialogContent>
            <pre style={{ fontSize: 10, margin: 0 }}>
              {JSON.stringify(detailsData, null, 2)}
            </pre>
          </DialogContent>
        </Dialog>
        {printDialogOpen && selectedInvoice && (
          <PrintInvoiceDialog
            open={printDialogOpen}
            invoice={selectedInvoice}
            data={(function buildPrintDialogData(invoice: any) {
              // Find client info
              const customer = invoice.Client || undefined;
              // Items: for compatibility, pass as array with one invoice
              const items = [invoice];
              const isGold =
                !!invoice?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER
                  ?.toLowerCase()
                  .includes("gold");

              // Totals: IMPORTANT
              // `amount_lyd/amount_currency/amount_EUR` are PAID amounts.
              // The print view needs the INVOICE TOTAL to match checkout.
              const totalLydFromInvoice =
                Number(
                  (invoice as any).total_remise_final_lyd ??
                    (invoice as any).total_remise_final_LYD ??
                    0
                ) || 0;
              const totalUsdFromInvoice = Number((invoice as any).total_remise_final) || 0;

              const totalAmountLYD = isGold
                ? totalLydFromInvoice || totalUsdFromInvoice
                : totalLydFromInvoice;
              const totalAmountUSD = isGold ? 0 : totalUsdFromInvoice;
              const totalAmountEur = Number((invoice as any).totalAmountEur) || 0;
              const totalWeight =
                invoice._productDetails?.reduce(
                  (sum: number, d: any) => sum + (Number(d.weight) || 0),
                  0
                ) || 0;
              const itemCount = invoice._productDetails?.length || 0;
              const amount_currency_LYD =
                Number(invoice.amount_currency_LYD) || 0;
              const amount_EUR_LYD = Number(invoice.amount_EUR_LYD) || 0;
              
              // Include payment amounts
              const amount_lyd = Number(invoice.amount_lyd) || 0;
              const amount_currency = Number(invoice.amount_currency) || 0;
              const amount_EUR = Number(invoice.amount_EUR) || 0;
              
              return {
                invoice,
                items,
                customer,
                totalAmountLYD,
                totalAmountUSD,
                totalAmountEur,
                totalWeight,
                itemCount,
                amount_lyd,
                amount_currency,
                amount_EUR,
                amount_currency_LYD,
                amount_EUR_LYD,
                type:
                  invoice?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase() ||
                  "",
                picint: invoice.picint,
                Original_Invoice: invoice.Original_Invoice || "",
                remise: invoice.remise,
                remise_per: invoice.remise_per,
              };
            })(selectedInvoice)}
            printRef={printRef}
            onClose={() => setPrintDialogOpen(false)}
            onInvoiceClosed={() => setInvoiceRefreshFlag((f) => f + 1)}
            showCloseInvoiceActions={false}
            showCloseInvoice={false}
            createdBy={selectedInvoice?.Utilisateur?.name_user || ""}
          />
        )}

        <Dialog
          open={closeDialogOpen}
          onClose={() => {
            if (closeLoading) return;
            setCloseDialogOpen(false);
          }}
          maxWidth="md"
          fullWidth
        >
          <DialogContent sx={{ pt: 2 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {/* Invoice Summary */}
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>Invoice Summary</Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                  <Box sx={{ minWidth: 200 }}>
                    <Typography variant="body2" color="textSecondary">Customer</Typography>
                    <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                      {closeCustomerDisplay || "—"}
                    </Typography>
                  </Box>

                  <Box sx={{ minWidth: 140 }}>
                    <Typography variant="body2" color="textSecondary">Invoice #</Typography>
                    <Typography variant="h5" sx={{ fontWeight: "bold" }}>
                      {closeInvoice?.num_fact}
                    </Typography>
                  </Box>

                  <Box sx={{ minWidth: 180 }}>
                    <Typography variant="body2" color="textSecondary">Total (LYD)</Typography>
                    <Typography variant="h5" sx={{ fontWeight: "bold" }}>
                      {formatWholeAmount(closeTotals.totalLyd)}
                    </Typography>
                  </Box>

                  <Box sx={{ minWidth: 220 }}>
                    <Typography variant="body2" color="textSecondary">Remaining</Typography>
                    <Typography
                      variant="h5"
                      sx={{ fontWeight: "bold", color: closeTotals.remainingLyd > 0 ? "error.main" : "success.main" }}
                    >
                      LYD {formatWholeAmount(closeTotals.remainingLyd)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      USD {formatWholeAmount(closeTotals.remaining.usd)} · EUR {formatWholeAmount(closeTotals.remaining.eur)}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Divider />

              {/* Recorded Payments */}
              <Box>
                <Card
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 2,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 3,
                    }}
                  >
                    {/* LYD */}
                    <Box sx={{ minWidth: 160 }}>
                      <Typography variant="overline" color="textSecondary">
                        LYD
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        {formatWholeAmount(closeTotals.recorded.lyd || 0)}
                      </Typography>
                    </Box>

                    {/* USD */}
                    <Box sx={{ minWidth: 160 }}>
                      <Typography variant="overline" color="textSecondary">
                        USD
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        {formatWholeAmount(closeTotals.recorded.usd || 0)}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        ≈ LYD {formatWholeAmount(closeTotals.recorded.usdLyd || 0)}
                      </Typography>
                    </Box>

                    {/* EUR */}
                    <Box sx={{ minWidth: 160 }}>
                      <Typography variant="overline" color="textSecondary">
                        EUR
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        {formatWholeAmount(closeTotals.recorded.eur || 0)}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        ≈ LYD {formatWholeAmount(closeTotals.recorded.eurLyd || 0)}
                      </Typography>
                    </Box>
                  </Box>
                </Card>
              </Box>

              <Divider />

              {/* Payment Inputs */}
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>Amounts received</Typography>
                  {/* LYD column */}
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                  <Box sx={{ minWidth: 220, flex: "1 1 220px" }}>
                    <TextField
                      label="Pay now (LYD)"
                      value={closePayLydStr}
                      onChange={(e) => setClosePayLydStr(e.target.value)}
                      onBlur={() => {
                        const v = parseAmt(closePayLydStr);
                        setClosePayLydStr(v ? String(normalizeMoney(v)) : "");
                      }}
                      size="small"
                      fullWidth
                      inputMode="decimal"
                      inputProps={{ pattern: "[0-9.,-]*" }}
                      helperText="Enter amount in LYD"
                    />
                  </Box>

                  <Box sx={{ minWidth: 220, flex: "1 1 220px", display: "flex", flexDirection: "column", gap: 1 }}>
                    <TextField
                      label="Pay now (USD)"
                      value={closePayUsdStr}
                      onChange={(e) => setClosePayUsdStr(e.target.value)}
                      onBlur={() => {
                        const usd = parseAmt(closePayUsdStr);
                        const r = getUsdRate();
                        setClosePayUsdStr(usd ? String(normalizeMoney(usd)) : "");
                        if (
                          usd > 0 &&
                          (!parseAmt(closePayUsdLydStr) || parseAmt(closePayUsdLydStr) <= 0) &&
                          Number.isFinite(r) &&
                          r > 0
                        ) {
                          setClosePayUsdLydStr(String(normalizeMoney(usd * r)));
                        }
                      }}
                      size="small"
                      fullWidth
                      inputMode="decimal"
                      inputProps={{ pattern: "[0-9.,-]*" }}
                      helperText="USD amount"
                    />
                    <TextField
                      label="USD equiv (LYD)"
                      value={closePayUsdLydStr}
                      size="small"
                      fullWidth
                      InputProps={{ readOnly: true }}
                      helperText="LYD equivalent for USD (auto)"
                    />
                  </Box>

                  <Box sx={{ minWidth: 220, flex: "1 1 220px", display: "flex", flexDirection: "column", gap: 1 }}>
                    <TextField
                      label="Pay now (EUR)"
                      value={closePayEurStr}
                      onChange={(e) => setClosePayEurStr(e.target.value)}
                      onBlur={() => {
                        const eur = parseAmt(closePayEurStr);
                        const r = getEurRate();
                        setClosePayEurStr(eur ? String(normalizeMoney(eur)) : "");
                        if (
                          eur > 0 &&
                          (!parseAmt(closePayEurLydStr) || parseAmt(closePayEurLydStr) <= 0) &&
                          Number.isFinite(r) &&
                          r > 0
                        ) {
                          setClosePayEurLydStr(String(normalizeMoney(eur * r)));
                        }
                      }}
                      size="small"
                      fullWidth
                      inputMode="decimal"
                      inputProps={{ pattern: "[0-9.,-]*" }}
                      helperText="EUR amount"
                    />
                    <TextField
                      label="EUR equiv (LYD)"
                      value={closePayEurLydStr}
                      size="small"
                      fullWidth
                      InputProps={{ readOnly: true }}
                      helperText="LYD equivalent for EUR (auto)"
                    />
                  </Box>
                </Box>
              </Box>

              <Divider />
              {/* Validation */}
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>Validation</Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                  <Box sx={{ minWidth: 260 }}>
                    <Typography variant="body2" color="textSecondary">Entered Total (LYD equiv)</Typography>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: "bold", color: closeMismatch ? "error.main" : "text.primary" }}
                    >
                      LYD {formatWholeAmount(closeEntered.totalLydEquiv)}
                    </Typography>
                  </Box>

                  <Box sx={{ minWidth: 360 }}>
                    <Typography variant="body2" color="textSecondary">Comparison to Remaining</Typography>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: "bold",
                        color: closeMismatch ? (closeIsOverpay ? "error.main" : "warning.main") : "success.main",
                      }}
                    >
                      {closeMismatch
                        ? `${closeIsOverpay ? "Overpayment" : "Remainder"}: ` +
                          `${Math.abs(lydDiff) > 1 ? `LYD ${formatWholeAmount(Math.abs(lydDiff))} ` : ""}` +
                          `${Math.abs(usdDiff) > 0.01 ? `USD ${formatWholeAmount(Math.abs(usdDiff))} ` : ""}` +
                          `${Math.abs(eurDiff) > 0.01 ? `EUR ${formatWholeAmount(Math.abs(eurDiff))}` : ""}`.trim()
                        : "Match"}
                    </Typography>
                  </Box>
                </Box>
              </Box>
              <Divider />
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>Items</Typography>

                {
                closeLines.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">No items found.</Typography>
                ) : (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    {closeLines.map((l, idx) => {
                      const name =
                        l?.designation ||
                        l?.name ||
                        l?.Product?.name ||
                        l?.Watch?.name ||
                        l?.Diamond?.name ||
                        l?.Gold?.name ||
                        `Item ${idx + 1}`;

                      const img = getItemImageUrl(l);
                      const qty = getLineQty(l);
                      const unit = getLineUnitPrice(l);
                      const total = getLineTotal(l);

                      return (
                        <Card key={l?.id || l?.id_fact_details || idx} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                            <ImageWithFallback
                              src={img}
                              alt={name}
                              size={52}
                              onClick={() => {
                                // keep your existing big image dialog behavior
                                const srcToOpen = img || "";
                                if (!srcToOpen) return;
                                setImageDialogUrl(srcToOpen);
                                setImageDialogOpen(true);
                              }}
                            />

                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 800 }} noWrap>
                                {name}
                              </Typography>

                              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                                <Typography variant="body2" color="textSecondary">
                                  Qty: {qty}
                                </Typography>

                                <Typography variant="body2" color="textSecondary">
                                  Unit: {unit > 0 ? formatWholeAmount(unit) : "—"}
                                </Typography>

                                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                  Line: {total > 0 ? formatWholeAmount(total) : "—"}
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        </Card>
                      );
                    })}
                    </Box>
                )}
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCloseDialogOpen(false)} disabled={closeLoading}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleConfirmCloseInvoice}
              disabled={closeLoading || closeIsOverpay || closeUsdEquivMissing || closeEurEquivMissing}
            >
              {closeLoading ? "Closing..." : "Close Invoice"}
            </Button>
          </DialogActions>
        </Dialog>
        {/* Chira Return Dialog */}
        <Dialog
          open={chiraDialogOpen}
          onClose={() => setChiraDialogOpen(false)}
        >
          <DialogContent>
            {chiraDialogIdFact && (
              <ChiraReturnPage
                id_fact={chiraDialogIdFact}
                onClose={() => setChiraDialogOpen(false)}
                onUpdated={() => setChiraRefreshFlag((f) => f + 1)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Confirm Return to cart Dialog (styled, centered) */}
        <Dialog
          open={confirmDialogOpen}
          onClose={() => {
            setConfirmDialogOpen(false);
            setConfirmTargetNum(null);
          }}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Confirm Return to Cart</DialogTitle>
          <DialogContent>
            <Typography>Mark this invoice as returned to my cart?</Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setConfirmDialogOpen(false);
                setConfirmTargetNum(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="warning"
              onClick={() => performReturnToCart(confirmTargetNum)}
              disabled={
                confirmTargetNum === null ||
                returningIds.includes(String(confirmTargetNum))
              }
            >
              {confirmTargetNum !== null &&
                returningIds.includes(String(confirmTargetNum))
                ? "Returning..."
                : "Confirm"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Seller Dialog */}
        <Dialog open={editSellerOpen} onClose={() => setEditSellerOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Edit "Sold by"</DialogTitle>
          <DialogContent sx={{ minWidth: 300 }}>
            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <InputLabel id="edit-seller-select">Select User</InputLabel>
              <Select
                labelId="edit-seller-select"
                label="Select User"
                value={editSellerSelectedUserId ?? ""}
                onChange={(e) => {
                  const val: any = e.target.value;
                  setEditSellerSelectedUserId(val === "" ? null : Number(val));
                }}
              >
                {(Array.isArray(users) ? users : []).map((u: any) => (
                  <MenuItem key={String(u.id_user)} value={Number(u.id_user)}>
                    {u.name_user}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditSellerOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleConfirmEditSeller} disabled={!editSellerSelectedUserId}>
              Save
            </Button>
          </DialogActions>
        </Dialog>

        {/* Image Dialog for big image preview */}
        <Dialog
          open={imageDialogOpen}
          onClose={() => setImageDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Product Image</DialogTitle>
          <DialogContent
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: 400,
            }}
          >
            {imageDialogUrl ? (
              <img
                src={imageDialogUrl}
                alt="Big Product"
                style={{
                  maxWidth: "100%",
                  maxHeight: 500,
                  borderRadius: 8,
                  boxShadow: "0 2px 12px #0002",
                  display: "block",
                }}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                No image selected
              </Typography>
            )}
          </DialogContent>
        </Dialog>
      </React.Fragment>
    </Box>
  );
};

export default SalesReportsTable;