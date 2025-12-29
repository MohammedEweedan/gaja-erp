  /* eslint-disable @typescript-eslint/no-unused-vars */
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
} from "@mui/material";
import axios from "../api";
import LockIcon from "@mui/icons-material/Lock";
import { useNavigate } from "react-router-dom";
import { buildEncryptedClientPath, buildEncryptedSellerPath } from "../utils/routeCrypto";
import FileCopyIcon from "@mui/icons-material/FileCopy";

import PrintInvoiceDialog from "../Invoices/ListCardInvoice/Gold Invoices/PrintInvoiceDialog";
import ChiraReturnPage from "./ChiraReturnPage";
import { FileDownload } from "@mui/icons-material";
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
  let typed: "watch" | "diamond" | "gold" | undefined;
  if (t.includes("watch")) typed = "watch";
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
                if (typed === "watch") {
                  if (mount.includes("uploads/watchpic")) {
                    u = `/images/watch/${encodeURIComponent(idSeg)}/${encodeURIComponent(filename)}`;
                  }
                }
              }
            } catch {
              /* ignore */
            }

            // Normalize watch routes (/images/:id/:file -> /images/watch/:id/:file)
            if (typed === "watch") {
              try {
                const obj = new URL(u, window.location.origin);
                const parts = obj.pathname.split("/");
                if (parts.length >= 4 && parts[1] === "images" && parts[2] !== "watch" && /^\d+$/.test(parts[2])) {
                  obj.pathname = ["", "images", "watch", parts[2], ...parts.slice(3)].join("/");
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

const typeOptions = [
  { label: "All", value: "all" },
  { label: "Gold", value: "gold" },
  { label: "Diamond", value: "diamond" },
  { label: "Watch", value: "watch" },
];

type Users = {
  id_user: number;
  name_user: string;
};

const SalesReportsTable = ({
  type: initialType,
}: {
  type?: "gold" | "diamond" | "watch";
}) => {
  // Fetch users on mount

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
  // Trigger refresh after closing an invoice
  const [invoiceRefreshFlag, setInvoiceRefreshFlag] = useState(0);
  const [chiraDialogOpen, setChiraDialogOpen] = useState(false);
  const [chiraDialogIdFact, setChiraDialogIdFact] = useState<any>(null);
  const [chiraRefreshFlag, setChiraRefreshFlag] = useState(0);
  const printRef = React.useRef(null);
  const [globalFilter, setGlobalFilter] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<
    "date_created" | "invoice_number" | "invoice_date" | "value"
  >("invoice_date");
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
  const [imageUrls, setImageUrls] = useState<Record<string, string[]>>({});
  // Blob/object URLs per picint/id_achat (used for display/export)
  const [imageBlobUrls, setImageBlobUrls] = useState<Record<string, string[]>>(
    {}
  );
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
      });
  }, []);

  // If the current user has ROLE_USER, force selectedPs to user's ps and keep the select disabled
  useEffect(() => {
    if (isUser) {
      const raw = localStorage.getItem("ps");
      if (raw) setSelectedPs(String(raw));
    }
  }, [isUser]);

  // Fetch all images for a given picint (or id_achat) with optional supplier type to select correct folder
  // Typed fetch similar to WatchStandardInvoiceContent: only attempt the explicit folder based on supplier type, with a legacy fallback if none
  const fetchImages = async (id: number, supplierType?: string) => {
    if (!id) return;
    if (imageUrls[id] !== undefined) return; // already fetched
    const token = localStorage.getItem("token");
    const normalizeEntryToString = (it: any): string => {
      if (typeof it === "string") return it;
      if (it && typeof it === "object") return it.url || it.path || it.href || it.src || "";
      return "";
    };
    const t = supplierType?.toLowerCase() || "";
    let typed: "watch" | "diamond" | "gold" | undefined;
    if (t.includes("watch")) typed = "watch";
    else if (t.includes("diamond")) typed = "diamond";
    else if (t.includes("gold")) typed = "gold";
    const endpoints = typed
      ? [
        `${API_BASEImage}/list/${typed}/${id}`,
        // legacy fallback (watch default)
        `${API_BASEImage}/list/${id}`
      ]
      : [`${API_BASEImage}/list/${id}`];
    for (const url of endpoints) {
      try {
        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (Array.isArray(res.data)) {
          const list = res.data
            .map((it: any) => {
              let u = normalizeEntryToString(it);
              if (!u) return "";
              // Normalize to a stable, base-path-independent form first.
              if (u.startsWith("images/") || u.startsWith("uploads/")) u = "/" + u;
              try {
                const urlObj = new URL(u, window.location.origin);
                if (urlObj.pathname.startsWith("/api/images/")) {
                  u = urlObj.pathname.replace(/^\/api/, "");
                } else if (urlObj.pathname.startsWith("/api/uploads/")) {
                  u = urlObj.pathname.replace(/^\/api/, "");
                } else if (urlObj.pathname.startsWith("/images/") || urlObj.pathname.startsWith("/uploads/")) {
                  u = urlObj.pathname;
                } else {
                  // keep absolute url as-is
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
                  if (typed === "watch") {
                    if (mount.includes("uploads/watchpic")) {
                      u = `/images/watch/${encodeURIComponent(idSeg)}/${encodeURIComponent(filename)}`;
                    }
                  }
                }
              } catch {
                /* ignore */
              }

              // If watch type, rewrite /images/:id/:filename -> /images/watch/:id/:filename
              if (typed === 'watch') {
                try {
                  const obj = new URL(u, window.location.origin);
                  const parts = obj.pathname.split('/');
                  // Expect ['', 'images', id, filename]
                  if (parts.length >= 4 && parts[1] === 'images' && /^\d+$/.test(parts[2]) && parts[3]) {
                    // Only rewrite if not already /images/watch
                    if (parts[2] !== 'watch') {
                      obj.pathname = ['', 'images', 'watch', parts[2], ...parts.slice(3)].join('/');
                      u = obj.toString();
                    }
                  }
                } catch { /* ignore */ }
              }
              const abs = toApiImageAbsolute(ensureHttps(u));
              return withToken(abs, token);
            })
            .filter(Boolean);
          setImageUrls((prev) => ({ ...prev, [id]: list }));
          return;
        }
      } catch {
        /* try fallback */
      }
    }
    setImageUrls((prev) => ({ ...prev, [id]: [] }));
  };

  // Helper to fetch image as blob and store object URL
  const fetchImageBlobs = async (picint: number, urls: string[]) => {
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
        // skip if failed
      }
    }
    setImageBlobUrls((prev) => ({ ...prev, [picint]: blobUrls }));
  };

  // Fetch blobs for protected images when imageUrls changes
  useEffect(() => {
    Object.entries(imageUrls).forEach(([picint, urls]) => {
      if (urls.length > 0 && !imageBlobUrls[picint]) {
        fetchImageBlobs(Number(picint), urls);
      }
    });
    // eslint-disable-next-line
  }, [imageUrls, imageBlobUrls]);

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
      setLoading(true);
      const token = localStorage.getItem("token");
      const typeFilters = (selectedTypes || []).filter((t) => t !== "all");

      // If "All" selected, fetch per point-of-sale and merge results since backend may not support global listing.
      if (selectedPs === "all") {
        try {
          // If psOptions not yet loaded, wait until they are.
          if (!psOptions || psOptions.length === 0) {
            setData([]);
            return;
          }
          const requests: Promise<any>[] = [];
          psOptions.forEach((p) => {
            if (typeFilters.length > 1) {
              typeFilters.forEach((t) => {
                requests.push(
                  axios.get(`/invoices/allDetailsP`, {
                    headers: { Authorization: token ? `Bearer ${token}` : undefined },
                    params: {
                      ps: p.Id_point,
                      type: t,
                      from: periodFrom || undefined,
                      to: periodTo || undefined,
                      usr: localStorage.getItem("Cuser") || '-1',
                    },
                  })
                );
              });
            } else {
              const singleType = typeFilters[0];
              requests.push(
                axios.get(`/invoices/allDetailsP`, {
                  headers: { Authorization: token ? `Bearer ${token}` : undefined },
                  params: {
                    ps: p.Id_point,
                    ...(singleType ? { type: singleType } : {}),
                    from: periodFrom || undefined,
                    to: periodTo || undefined,
                    usr: localStorage.getItem("Cuser") || '-1',
                  },
                })
              );
            }
          });
          const results = await Promise.allSettled(requests);
          const merged: any[] = [];
          results.forEach((r) => {
            if (r.status === "fulfilled" && Array.isArray(r.value.data)) {
              merged.push(...r.value.data);
            }
          });
          // Deduplicate by invoice number or picint
          const seen = new Set<string>();
          const dedup = merged.filter((row) => {
            const key = String(row.num_fact || row.id_fact || row.picint || Math.random());
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setData(dedup);
        } catch (err) {

          setData([]);
        } finally {
          setLoading(false);
        }
        return;
      }

      // Single PS (or undefined) fetch
      try {
        const psParam = selectedPs && selectedPs !== "all" ? selectedPs : undefined;
        if (typeFilters.length > 1) {
          const reqs = typeFilters.map((t) =>
            axios.get(`/invoices/allDetailsP`, {
              headers: { Authorization: token ? `Bearer ${token}` : undefined },
              params: {
                ...(psParam ? { ps: psParam } : {}),
                type: t,
                from: periodFrom || undefined,
                to: periodTo || undefined,
                usr: localStorage.getItem("Cuser") || '-1',
              },
            })
          );
          const results = await Promise.allSettled(reqs);
          const merged: any[] = [];
          results.forEach((r) => {
            if (r.status === "fulfilled" && Array.isArray(r.value.data)) {
              merged.push(...r.value.data);
            }
          });
          const seen = new Set<string>();
          const dedup = merged.filter((row) => {
            const key = String(row.num_fact || row.id_fact || row.picint || Math.random());
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setData(dedup);
        } else {
          const singleType = typeFilters[0];
          const res = await axios.get(`/invoices/allDetailsP`, {
            headers: { Authorization: token ? `Bearer ${token}` : undefined },
            params: {
              ...(psParam ? { ps: psParam } : {}),
              ...(singleType ? { type: singleType } : {}),
              from: periodFrom || undefined,
              to: periodTo || undefined,
              usr: localStorage.getItem("Cuser") || '-1',
            },
          });
          setData(res.data);
        }
      } catch (err) {
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedTypes, periodFrom, periodTo, selectedPs, chiraRefreshFlag, invoiceRefreshFlag, psOptions]);

  // Fetch watch details (OriginalAchatWatches) for watch invoices using invoice picint
  useEffect(() => {
    const fetchWatchDetails = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      // Only consider invoices where supplier type is watch
      const watchRows = (data || []).filter((row: any) => {
        const t = String(row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || "").toLowerCase();
        return t.includes("watch");
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
  const totalWatch = getMaxTotalByType("watch");

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
        if (typeLower.includes("watch")) {
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
        const idAchat =
          achat.id_achat ?? achat.ID_ACHAT ?? achat.Id_Achat ?? achat.idAchat ?? "";
        const picint = achat.picint ?? "";
        const imageId = (() => {
          // Gold/watch images are stored under purchase id_achat on the server.
          if (typeLower.includes("gold") || typeLower.includes("watch")) {
            return idAchat || achat.picint || row.picint || "";
          }
          // Diamonds (and others) often work by picint.
          return achat.picint || idAchat || row.picint || "";
        })();

        const IS_GIFT = row.IS_GIFT || "";

        // include common external reference fields so UI/export can access them
        const codeExternal =
          achat.CODE_EXTERNAL ||
          achat.code_external ||
          achat.CODE_EXTERNAL ||
          achat.ref ||
          achat.reference ||
          "";
        invoiceMap.get(numFact)._productDetails.push({
          design,
          weight,
          code,
          typeSupplier,
          picint,
          id_achat: idAchat,
          imageId,
          IS_GIFT,
          CODE_EXTERNAL: codeExternal,
          // Carry invoice-level selling price so downstream views can access it per detail
          prix_vente_remise: row.prix_vente_remise ?? null,
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
  useEffect(() => {
    const queued: { id: number; type?: string }[] = [];
    data.forEach((row: any) => {
      const supplierType = row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER;
      if (row.picint && String(supplierType || "").toLowerCase().includes("diamond")) {
        queued.push({ id: row.picint, type: supplierType });
      }
      (row.ACHATs || []).forEach((a: any) => {
        const t = String(a?.Fournisseur?.TYPE_SUPPLIER || supplierType || "").toLowerCase();
        const prodId =
          t.includes("gold") || t.includes("watch")
            ? a.id_achat || a.ID_ACHAT || a.Id_Achat || a.picint
            : a.picint || a.id_achat || a.ID_ACHAT || a.Id_Achat;
        if (prodId)
          queued.push({
            id: prodId,
            type: a?.Fournisseur?.TYPE_SUPPLIER || supplierType,
          });
      });
    });
    // Fetch distinct
    const seen = new Set<number>();
    queued.forEach((q) => {
      if (!seen.has(q.id)) {
        seen.add(q.id);
        fetchImages(q.id, q.type);
      }
    });
    // eslint-disable-next-line
  }, [sortedData]);

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
          t.includes("gold") || t.includes("watch")
            ? a.id_achat || a.ID_ACHAT || a.Id_Achat || a.picint
            : a.picint || a.id_achat || a.ID_ACHAT || a.Id_Achat;
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
        const blobUrls = imageBlobUrls[imageId] || [];
        let candidateUrls: string[] = [];
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
                    ${total ? `<div><b style='color:#1976d2'>Total Invoice:</b> ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${isGold ? "LYD" : "USD"} ${pricePerG ? `<span style='margin-left:8px;color:#388e3c;font-weight:600'>Price/g: ${pricePerG}</span>` : ""}</div>` : ""}
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
                        <td colspan="3" style="text-align:left; color:#1976d2;">${formatNumber(totalGold)} LYD</td>
                    </tr>
                    <tr style="background:#e3f2fd;font-weight:bold;">
                        <td colspan="5" style="text-align:right;">Total Diamond:</td>
                        <td colspan="3" style="text-align:left; color:#1976d2;">${formatNumber(totalDiamond)} USD</td>
                    </tr>
                    <tr style="background:#e3f2fd;font-weight:bold;">
                        <td colspan="5" style="text-align:right;">Total Watch:</td>
                        <td colspan="3" style="text-align:left; color:#1976d2;">${formatNumber(totalWatch)} USD</td>
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
    let typed: "watch" | "diamond" | "gold" | undefined;
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
                    ${total ? `<div><b style='color:#1976d2'>Total Invoice:</b> ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${isGold ? "LYD" : "USD"} ${pricePerG ? `<span style='margin-left:8px;color:#388e3c;font-weight:600'>Price/g: ${pricePerG}</span>` : ""}</div>` : ""}
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
        const av = Number(a?.num_fact ?? 0) || 0;
        const bv = Number(b?.num_fact ?? 0) || 0;
        return (av - bv) * dir;
      }
      if (sortBy === "date_created") {
        return (getCreatedTime(a) - getCreatedTime(b)) * dir;
      }
      if (sortBy === "invoice_date") {
        return (getInvoiceDate(a) - getInvoiceDate(b)) * dir;
      }
      // value
      return (getInvoiceTotalByCurrency(a, sortCurrency) - getInvoiceTotalByCurrency(b, sortCurrency)) * dir;
    });
    return base;
  }, [filteredData, sortBy, sortDir, sortCurrency]);
  // Totals of "rest" fields for the currently filtered dataset
  const totalRestLYD = React.useMemo(() => {
    return filteredData.reduce((sum, row) => {
      const v = Number(row.rest_of_money || 0);
      const restField = isNaN(v) ? 0 : v;
      if (restField > 0) return sum + restField;

      // Fallback: compute remaining from totals vs paid LYD-equivalent when rest fields aren't populated.
      const totalLyd = Number((row as any).total_remise_final_lyd ?? (row as any).total_remise_final_LYD ?? 0) || 0;
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
      const totalUsd = Number((row as any).total_remise_final ?? 0) || 0;
      const paidUsd = Number(row.amount_currency ?? 0) || 0;
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
      const totalEur = Number((row as any).totalAmountEur ?? (row as any).total_amount_eur ?? (row as any).total_remise_final_eur ?? 0) || 0;
      const paidEur = Number(row.amount_EUR ?? 0) || 0;
      const diff = totalEur - paidEur;
      if (!Number.isFinite(diff) || diff <= 0) return sum;
      return sum + diff;
    }, 0);
  }, [filteredData]);

  const summaryStats = React.useMemo(() => {
    const typeMaps: Record<"gold" | "diamond" | "watch", Map<string, number>> = {
      gold: new Map(),
      diamond: new Map(),
      watch: new Map(),
    };
    let itemCount = 0;
    let totalWeightFiltered = 0;

    filteredData.forEach((row: any) => {
      if (Array.isArray(row._productDetails)) {
        itemCount += row._productDetails.length;
      }

      const achats: any[] = row.ACHATs || [];
      if (achats.length === 0) {
        return;
      }

      const firstAchat = achats[0];
      const supplierTypeRaw = firstAchat?.Fournisseur?.TYPE_SUPPLIER || "";
      const supplierType = String(supplierTypeRaw).toLowerCase();

      if (supplierType.includes("gold")) {
        const qty = Number(firstAchat.qty);
        if (!isNaN(qty)) {
          totalWeightFiltered += qty;
        }
      }

      let targetType: "gold" | "diamond" | "watch" | null = null;
      if (supplierType.includes("gold")) targetType = "gold";
      else if (supplierType.includes("diamond")) targetType = "diamond";
      else if (supplierType.includes("watch")) targetType = "watch";

      if (!targetType) {
        return;
      }

      const numFact = row.num_fact;
      if (!numFact) {
        return;
      }

      const baseTotal = Number(row.total_remise_final) || 0;
      const remiseValue = Number(row.remise) || 0;
      const remisePerValue = Number(row.remise_per) || 0;
      let adjustedTotal = baseTotal;
      if (remiseValue > 0) {
        adjustedTotal = baseTotal - remiseValue;
      } else if (remisePerValue > 0) {
        adjustedTotal =
          baseTotal - (baseTotal * remisePerValue) / 100;
      }
      if (isNaN(adjustedTotal)) {
        return;
      }

      const map = typeMaps[targetType];
      if (!map.has(numFact) || (map.get(numFact) as number) < adjustedTotal) {
        map.set(numFact, adjustedTotal);
      }
    });

    const sumMap = (m: Map<string, number>) => {
      let sum = 0;
      m.forEach((v) => {
        sum += v;
      });
      return sum;
    };

    return {
      invoiceCount: filteredData.length,
      itemCount,
      totalWeight: totalWeightFiltered,
      totalGold: sumMap(typeMaps.gold),
      totalDiamond: sumMap(typeMaps.diamond),
      totalWatch: sumMap(typeMaps.watch),
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
    const user =
      row.Utilisateur && row.Utilisateur.name_user
        ? row.Utilisateur.name_user
        : "";
    const isChiraVal = row.is_chira === true || row.is_chira === 1;
    const returnChira = row.return_chira;
    const commentChira = row.comment_chira;
    const usrReceiveChira = row.usr_receive_chira;
    const invoiceComment = stripInternalMetaTags((row as any).COMMENT ?? "");

    // Primary label: show Chira No when chira=yes, otherwise Invoice No
    const primaryLabel = isChiraVal
      ? `Chira No: ${row.num_fact || row.num || row.id_fact || ""}`
      : `Invoice No: ${row.num_fact || row.num || row.id_fact || ""}`;

    // Find user name from users array by id_user
    let usrReceiveChiraName: any = usrReceiveChira;
    if (usrReceiveChira && Array.isArray(users) && users.length > 0) {
      const foundUser = users.find(
        (u) => String(u.id_user) === String(usrReceiveChira)
      );
      if (foundUser) {
        usrReceiveChiraName = foundUser.name_user;
      }
    }

    const isChiraFieldsEmpty =
      (!returnChira || returnChira === "0") &&
      (!commentChira || commentChira === "0") &&
      (!usrReceiveChira || usrReceiveChira === "0");

    const numFactAction = row?.num_fact ?? row?.num ?? row?.id_fact ?? null;
    const isReturning =
      numFactAction !== null && returningIds.includes(String(numFactAction));

    const clientValue = row.Client || row.client || null;
    let clientDisplay = "";
    if (clientValue && typeof clientValue === "object") {
      const name = clientValue.client_name || clientValue.name || "";
      const tel = clientValue.tel_client || clientValue.phone || "";
      clientDisplay = `${name}${name && tel ? " - " : ""}${tel}`;
    }
    const clientId =
      (clientValue &&
        (clientValue.id_client ||
          clientValue.Id_client ||
          clientValue.client_id)) ||
      row?.id_client ||
      row?.client_id ||
      row?.Id_client ||
      null;

    const totalRemiseFinal = row.total_remise_final ?? "";
    // amount fields are accessed directly from `row` where needed

    const details: any[] = row._productDetails || [];
    const invoicePrixVenteRemise = row.prix_vente_remise;

    const isClosed = !!row.IS_OK;
    // derive a short invoice type label from first product supplier type
    const rawTypeSupplier = row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || "";
    let invoiceTypeLabel = "";
    if (rawTypeSupplier) {
      const t = String(rawTypeSupplier).toLowerCase();
      if (t.includes("gold")) invoiceTypeLabel = "Gold";
      else if (t.includes("diamond")) invoiceTypeLabel = "Diamond";
      else if (t.includes("watch")) invoiceTypeLabel = "Watch";
      else invoiceTypeLabel = rawTypeSupplier;
    }
    return (
      <Card
        key={row.num_fact || row.id_fact || row.picint}
        sx={{
          borderRadius: 2,
          boxShadow: 2,
          display: "flex",
          flexDirection: "column",
          width: "100%",
          mb: 2, // add margin between cards
        }}
      >
        <CardContent
          sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
        >
          {/* Top: Invoice Info + State */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 1,
            }}
          >
            <Box
              sx={{
                fontSize: 12,
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              {/* Row 1: Primary labels */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  flexWrap: "wrap",
                }}
              >
                {invoiceTypeLabel ? (
                  <Chip
                    label={invoiceTypeLabel}
                    color="error"
                    sx={{ fontWeight: 700 }}
                  />
                ) : null}
                <Typography sx={{ fontSize: 16, fontWeight: 800 }}>
                  {primaryLabel}
                </Typography>
                {invoiceComment ? (
                  <Chip
                    label={`Comment: ${invoiceComment}`}
                    size="small"
                    variant="outlined"
                  />
                ) : null}
              </Box>

              {/* Row 2: Meta info */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  flexWrap: "wrap",
                }}
              >
                <Chip
                  label={`Date: ${date || "—"}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`Time: ${createdStr || "—"}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`Point of Sale: ${ps || "—"}`}
                  size="small"
                  variant="outlined"
                />
                {user ? (
                  <Chip
                    label={`Sold by: ${user}`}
                    size="small"
                    color="secondary"
                    onClick={() => {
                      let sellerId: number | null = null;
                      try {
                        sellerId = row?.Utilisateur?.id_user ?? null;
                      } catch { }
                      if (
                        !sellerId &&
                        Array.isArray(users) &&
                        users.length > 0
                      ) {
                        const found = users.find(
                          (u) => String(u.name_user) === String(user)
                        );
                        if (found) sellerId = Number(found.id_user);
                      }
                      if (sellerId) {
                        const path = buildEncryptedSellerPath(sellerId);
                        try {
                          if (typeof window !== "undefined") {
                            localStorage.setItem(
                              "sellerFocusId",
                              String(sellerId)
                            );
                            window.location.assign(path);
                          }
                        } catch {
                          navigate(path);
                        }
                      }
                    }}
                    clickable
                  />
                ) : (
                  <Chip label={`Sold by: —`} size="small" variant="outlined" />
                )}
                {isAdmin && (
                  <Button
                    variant="outlined"
                    size="small"
                    sx={{ ml: 0.5, fontSize: 11, py: 0.2, px: 0.8, textTransform: "none" }}
                    onClick={() => handleOpenEditSeller(row)}
                  >
                   Changing the seller
                  </Button>
                )}
              </Box>

              {/* Row 3: Client / Source / Chira / State */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  flexWrap: "wrap",
                }}
              >
                {clientDisplay ? (
                  <Chip
                    label={clientDisplay}
                    size="small"
                    color="primary"
                    onClick={() => {
                      const idNum = Number(clientId);
                      const namePart =
                        (clientValue &&
                          (clientValue.client_name || clientValue.name)) ||
                        String(clientDisplay).split(" - ")[0] ||
                        "";
                      try {
                        if (typeof window !== "undefined") {
                          if (Number.isFinite(idNum) && idNum > 0) {
                            localStorage.setItem("customerFocusId", String(idNum));
                          } else {
                            // Prevent stale focus id from forcing the previous customer.
                            localStorage.removeItem("customerFocusId");
                          }
                          if (namePart) {
                            localStorage.setItem("customerFocusName", String(namePart));
                          }
                          // Ensure we don't route by phone anymore
                          localStorage.removeItem("customerFocusPhone");
                        }
                      } catch { }
                      const path = "/invoice/customerProfile";
                      // Hard navigation so the profile always remounts and reads the latest focus id.
                      try {
                        if (typeof window !== "undefined") {
                          window.location.assign(path);
                          return;
                        }
                      } catch { }
                      navigate(path);
                    }}
                    clickable
                  />
                ) : (
                  <Chip label="Client: —" size="small" variant="outlined" />
                )}
                {row.SourceMark ? (
                  <Chip
                    label={`Source: ${String(row.SourceMark)}`}
                    size="small"
                    color="info"
                  />
                ) : (
                  <Chip label="Source: —" size="small" variant="outlined" />
                )}
                <Chip
                  label={`Chira: ${isChiraVal ? "Yes" : "No"}`}
                  size="small"
                  color={isChiraVal ? "success" : "default"}
                />
                {isClosed ? (
                  <Chip
                    icon={<LockIcon fontSize="small" />}
                    label="Closed Invoice"
                    size="small"
                    color="success"
                  />
                ) : (
                  <Chip
                    icon={<LockIcon fontSize="small" />}
                    label="Open Invoice"
                    size="small"
                    color="warning"
                  />
                )}
              </Box>
            </Box>

            <Box
              sx={{
                textAlign: "right",
                fontSize: 12,
                display: "flex",
                flexDirection: "column",
                gap: 1,
                alignItems: "flex-end",
              }}
            >
              {/* Amounts chip moved to the right side */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  justifyContent: "flex-end",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 0.25,
                    minHeight: 0,
                    fontSize: 11,
                  }}
                >
                  {(() => {
                    const lines: Array<{ key: string; node: React.ReactNode }> = [];

                    const moneyEps = 0.01;
                    const normalizeMoney = (v: number) =>
                      Math.round((Number(v) || 0) * 100) / 100;

                    const isGold =
                      !!row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes(
                        "gold"
                      );

                    const totalRemiseFinalLyd = row.total_remise_final_lyd ?? "";

                    // Prefer comparing in LYD equivalent when available.
                    const totalLyd = normalizeMoney(Number(totalRemiseFinalLyd) || 0);
                    const paidLydEquiv = normalizeMoney(
                      (Number(row.amount_lyd) || 0) +
                        (Number(row.amount_currency_LYD) || 0) +
                        (Number(row.amount_EUR_LYD) || 0)
                    );

                    // Match InvoiceTotalsDialog behavior for LYD: treat as whole LYD for paid-in-full status.
                    const totalLyd0 = normalizeLyd0(totalLyd);
                    const paidLydEquiv0 = normalizeLyd0(paidLydEquiv);

                    // Fallback comparison (when LYD total is missing): compare in base invoice currency.
                    const totalBase = normalizeMoney(Number(totalRemiseFinalLyd) || 0);
                    const paidBase = normalizeMoney(
                      isGold
                        ? (Number(row.amount_lyd) || 0)
                        : (Number(row.amount_currency) || 0)
                    );

                    const hasLydTotal = totalLyd > 0;
                    const diff = hasLydTotal
                      ? (isGold ? (totalLyd0 - paidLydEquiv0) : (totalLyd - paidLydEquiv))
                      : totalBase - paidBase;
                    const isPaidInFull = Math.abs(diff) <= moneyEps;
                    const isPartial = diff > moneyEps;
                    const statusColor = isPaidInFull ? "#2e7d32" : "#d04444ff";

                    const total = Number(totalRemiseFinal) || 0;
                    if (total) {
                      lines.push({
                        key: "total",
                        node: (
                          <span
                            style={{
                              fontWeight: 700,
                              color: statusColor,
                            }}
                          >
                            {isGold
                              ? `LYD ${Number(normalizeLyd0(total)).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                              : `${formatNumber(total)} USD`}
                          </span>
                        ),
                      });
                    }

                    const lyd = Number(row.amount_lyd) || 0;
                    if (lyd !== 0) {
                      lines.push({ key: "lyd", node: `LYD: ${formatNumber(lyd)}` });
                    }

                    const usd = Number(row.amount_currency) || 0;
                    if (usd !== 0) {
                      const usdEq = row.amount_currency_LYD
                        ? ` (${formatNumber(row.amount_currency_LYD)} LYD)`
                        : "";
                      lines.push({ key: "usd", node: `USD: ${formatNumber(usd)}${usdEq}` });
                    }

                    const eur = Number(row.amount_EUR) || 0;
                    if (eur !== 0) {
                      const eurEq = row.amount_EUR_LYD
                        ? ` (${formatNumber(row.amount_EUR_LYD)} LYD)`
                        : "";
                      lines.push({ key: "eur", node: `EUR: ${formatNumber(eur)}${eurEq}` });
                    }

                    if (isPartial) {
                      // Match InvoiceTotalsDialog-style whole-LYD remainder; don't display "0" remainders.
                      const remLyd0 = normalizeLyd0(Math.abs(diff));
                      if ((hasLydTotal || isGold) && remLyd0 <= 0) {
                        // no-op
                      } else {
                        lines.push({
                          key: "remainder",
                          node: (
                            <span style={{ color: "#d04444ff" }}>
                              {hasLydTotal || isGold
                                ? `Remainder: ${Number(remLyd0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} LYD`
                                : `Remainder: ${formatNumber(Math.abs(diff))} USD`}
                            </span>
                          ),
                        });
                      }
                    }

                    const restPieces: string[] = [];
                    const restLYD =
                      row.rest_of_money != null ? Number(row.rest_of_money) : 0;
                    const restUSD =
                      row.rest_of_moneyUSD != null
                        ? Number(row.rest_of_moneyUSD)
                        : 0;
                    const restEUR =
                      row.rest_of_moneyEUR != null
                        ? Number(row.rest_of_moneyEUR)
                        : 0;
                    if (!isNaN(restLYD) && restLYD !== 0)
                      restPieces.push(`LYD ${formatNumber(restLYD)}`);
                    if (!isNaN(restUSD) && restUSD !== 0)
                      restPieces.push(`USD ${formatNumber(restUSD)}`);
                    if (!isNaN(restEUR) && restEUR !== 0)
                      restPieces.push(`EUR ${formatNumber(restEUR)}`);
                    if (restPieces.length > 0) {
                      lines.push({
                        key: "restCombined",
                        node: (
                          <span style={{ color: "#d04444ff" }}>
                            {`Remaining: ${restPieces.join(" | ")}`}
                          </span>
                        ),
                      });
                    }

                    if (lines.length === 0) {
                      lines.push({ key: "empty", node: "Amounts" });
                    }

                    return lines.map((l) => (
                      <Typography
                        key={l.key}
                        sx={{
                          fontSize: 11,
                          lineHeight: 1.25,
                          background: "transparent",
                        }}
                      >
                        {l.node}
                      </Typography>
                    ));
                  })()}
                </Box>
              </Box>

              {!isChiraVal && !isChiraFieldsEmpty && (
                <Box
                  sx={{
                    mt: 0,
                    background: "#f9fbe7",
                    borderRadius: 1,
                    p: 1,
                    fontSize: 11,
                  }}
                >
                  <div>
                    <span style={{ fontWeight: "bold", color: "#388e3c" }}>
                      Return Date:
                    </span>
                    <span style={{ marginLeft: 6 }}>{returnChira || "-"}</span>
                  </div>
                  <div>
                    <span style={{ fontWeight: "bold", color: "#d32f2f" }}>
                      Return By:
                    </span>
                    <span style={{ marginLeft: 6 }}>
                      {usrReceiveChiraName || "-"}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontWeight: "bold", color: "#1976d2" }}>
                      Comment Chira:
                    </span>
                    <span style={{ marginLeft: 6 }}>{commentChira || "-"}</span>
                  </div>
                </Box>
              )}

              {/* client/amounts/source moved into the invoice info chips */}
            </Box>
          </Box>

          {/* Product Details + Images (grouped by supplier type) */}
          {details.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: "bold", fontSize: 12, mb: 0.5 }}
              >
                Product Details
              </Typography>

              {/* Group details by typeSupplier */}
              {(() => {
                const grouped: Record<string, any[]> = {};

                details.forEach((d) => {
                  const k =
                    (d.typeSupplier && String(d.typeSupplier)) || "Other";
                  if (!grouped[k]) grouped[k] = [];
                  grouped[k].push(d);
                });
                return Object.entries(grouped).map(([groupName, items]) => (
                  <Box
                    key={groupName}
                    sx={{
                      display: "flex",
                      flexDirection: "row",
                      gap: 2,
                      alignItems: "flex-start",
                      border: "1px solid #f0f0f0",
                      borderRadius: 1,
                      p: 1,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "row",
                        gap: 1,
                        flexWrap: "wrap",
                        flex: 1,
                      }}
                    >
                      {items.map((d: any, idx: number) => {
                        const productImageId = d.imageId ?? d.id_achat ?? d.picint;
                        const productBlobUrls = productImageId
                          ? imageBlobUrls[productImageId] || []
                          : [];
                        const invoiceIdForLine =
                          d.id_fact || row.id_fact || row.num_fact;
                        const rawPrice =
                          d.prix_vente_remise ??
                          invoicePrixVenteRemise ??
                          "";
                        const resolvedPriceLabel =
                          rawPrice !== "" && rawPrice !== null && rawPrice !== undefined
                            ? `${formatNumber(rawPrice)} ${d.typeSupplier
                              ?.toLowerCase()
                              .includes("gold")
                              ? "LYD"
                              : "USD"}`
                            : "—";
                        return (
                          <Box
                            key={idx}
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 1,
                              alignItems: "stretch",
                              border: "1px solid #eee",
                              borderRadius: 2,
                              p: 1,
                              width: 220,
                              minHeight: 260,
                              boxShadow: 0,
                              transition: "box-shadow 150ms ease",
                              "&:hover": { boxShadow: 3 },
                            }}
                          >
                            {/* Image on top */}
                            <Box
                              sx={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {productBlobUrls.length > 0 ? (
                                <img
                                  src={productBlobUrls[0]}
                                  alt={`Product Img`}
                                  style={{
                                    width: "100%",
                                    height: 140,
                                    objectFit: "fill",
                                    borderRadius: 6,
                                    border: "1px solid #eee",
                                    cursor: "pointer",
                                  }}
                                  onClick={(e) => {
                                    try {
                                      const src = (e.currentTarget as HTMLImageElement).src;
                                      setImageDialogUrl(src);
                                    } catch {
                                      setImageDialogUrl(productBlobUrls[0]);
                                    }
                                    setImageDialogOpen(true);
                                  }}
                                  onError={(e) => {
                                    // Attempt fallback only for watch items and only if current src has /images/watch
                                    try {
                                      if (String(d.typeSupplier || '').toLowerCase().includes('watch')) {
                                        const imgEl = e.currentTarget as HTMLImageElement;
                                        const tried = imgEl.getAttribute('data-fallback-tried');
                                        const origSrc = imgEl.getAttribute('data-orig-src') || imgEl.src;
                                        if (!tried && /\/images\/watch\//.test(origSrc)) {
                                          imgEl.setAttribute('data-orig-src', origSrc);
                                          // Build fallback chain
                                          const urlObj = new URL(origSrc, window.location.origin);
                                          const parts = urlObj.pathname.split('/'); // ['', 'images', 'watch', id, filename]
                                          if (parts.length >= 5) {
                                            const idPart = parts[3];
                                            const filenamePart = parts.slice(4).join('/').split('?')[0];
                                            const token = urlObj.searchParams.get('token');
                                            const generic = `${urlObj.protocol}//${urlObj.host}/images/${idPart}/${filenamePart}` + (token ? `?token=${encodeURIComponent(token)}` : '');
                                            const staticUrl = `${urlObj.protocol}//${urlObj.host}/uploads/WatchPic/${idPart}/${filenamePart}`;
                                            imgEl.setAttribute('data-fallback-tried', '1');
                                            // Try generic first
                                            imgEl.onerror = () => {
                                              imgEl.onerror = null; // final fallback
                                              imgEl.src = staticUrl;
                                            };
                                            imgEl.src = generic;
                                          }
                                        }
                                      }
                                    } catch {/* ignore */ }
                                  }}
                                />
                              ) : (
                                (() => {
                                  // Fallback: show first raw URL while blob is still loading (or if blob fetch failed)
                                  const productRawUrls = productImageId
                                    ? imageUrls[productImageId] || []
                                    : [];
                                  const first = (productRawUrls[0] || "").trim();
                                  if (first) {
                                    return (
                                      <img
                                        src={first}
                                        alt="Product Img"
                                        style={{
                                          width: "100%",
                                          height: 140,
                                          objectFit: "cover",
                                          borderRadius: 6,
                                          border: "1px solid #eee",
                                          cursor: "pointer",
                                        }}
                                        onClick={(e) => {
                                          try {
                                            const src = (e.currentTarget as HTMLImageElement).src;
                                            setImageDialogUrl(src);
                                          } catch {
                                            setImageDialogUrl(productRawUrls[0]);
                                          }
                                          setImageDialogOpen(true);
                                        }}
                                        onError={(e) => {
                                          try {
                                            if (String(d.typeSupplier || '').toLowerCase().includes('watch')) {
                                              const imgEl = e.currentTarget as HTMLImageElement;
                                              const tried = imgEl.getAttribute('data-fallback-tried');
                                              const origSrc = imgEl.getAttribute('data-orig-src') || imgEl.src;
                                              // Handle both /images/watch and /images direct paths
                                              if (!tried && /\/images\//.test(origSrc)) {
                                                imgEl.setAttribute('data-orig-src', origSrc);
                                                const urlObj = new URL(origSrc, window.location.origin);
                                                const p = urlObj.pathname.split('/');
                                                // Shapes:
                                                // ['', 'images', id, filename]
                                                // ['', 'images', 'watch', id, filename]
                                                let idPart: string | null = null;
                                                let filenamePart: string | null = null;
                                                if (p.length >= 4 && p[1] === 'images' && p[2] !== 'watch') {
                                                  idPart = p[2];
                                                  filenamePart = p.slice(3).join('/');
                                                } else if (p.length >= 5 && p[1] === 'images' && p[2] === 'watch') {
                                                  idPart = p[3];
                                                  filenamePart = p.slice(4).join('/');
                                                }
                                                if (idPart && filenamePart) {
                                                  filenamePart = filenamePart.split('?')[0];
                                                  const token = urlObj.searchParams.get('token');
                                                  // Build ordered fallbacks
                                                  const watchUrl = `${urlObj.protocol}//${urlObj.host}/images/watch/${idPart}/${filenamePart}` + (token ? `?token=${encodeURIComponent(token)}` : '');
                                                  const staticUrl = `${urlObj.protocol}//${urlObj.host}/uploads/WatchPic/${idPart}/${filenamePart}`;
                                                  imgEl.setAttribute('data-fallback-tried', '1');
                                                  // If we were already /images/watch/, skip directly to static
                                                  if (/\/images\/watch\//.test(origSrc)) {
                                                    imgEl.onerror = null;
                                                    imgEl.src = staticUrl;
                                                  } else {
                                                    imgEl.onerror = () => {
                                                      imgEl.onerror = null;
                                                      imgEl.src = staticUrl;
                                                    };
                                                    imgEl.src = watchUrl;
                                                  }
                                                }
                                              }
                                            }
                                          } catch {/* ignore */ }
                                        }}
                                      />
                                    );
                                  }
                                  return (
                                    <Box
                                      sx={{
                                        width: "100%",
                                        height: 140,
                                        border: "1px dashed #ccc",
                                        borderRadius: 2,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#aaa",
                                        fontSize: 12,
                                      }}
                                    >
                                      No Image
                                    </Box>
                                  );
                                })()
                              )}
                            </Box>

                            {/* Title */}
                            <Typography sx={{ fontWeight: 800, fontSize: 13 }}>
                              {d.design} {d.IS_GIFT === true ? "🎁" : ""}
                            </Typography>

                            {/* Price */}
                            <Typography
                              sx={{
                                fontWeight: 700,
                                fontSize: 13,
                                color: "primary.main",
                              }}
                            >
                              {resolvedPriceLabel}
                            </Typography>

                            {/* Details */}
                            <Typography sx={{ fontSize: 12, color: "#555" }}>
                              {d.typeSupplier} {d.weight ? `• ${d.weight}` : ""}{" "}
                              {d.code ? `• ${d.code}` : ""}
                              {String(d.typeSupplier || "")
                                .toLowerCase()
                                .includes("diamond") && d.CODE_EXTERNAL
                                ? ` • Ref: ${d.CODE_EXTERNAL}`
                                : ""}
                            </Typography>

                            {/* Actions */}
                            {isChiraVal && (
                              <Box sx={{ mt: "auto" }}>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  color="primary"
                                  fullWidth
                                  sx={{ fontSize: 11, py: 0.5, px: 1.5 }}
                                  onClick={() => {
                                    setChiraDialogIdFact(invoiceIdForLine);
                                    setChiraDialogOpen(true);
                                  }}
                                >
                                  Return Chira
                                </Button>
                              </Box>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                ));
              })()}
            </Box>
          )}

          {/* Amounts moved to top info row */}

          {/* Source Mark moved to top info row */}

          {/* Actions */}
          <Box
            sx={{
              mt: 1.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            {/* Left: Return to cart (ghost) 
            <Box>
              {isAdmin && numFactAction && (
                <Button
                  variant="outlined"
                  color="warning"
                  size="small"
                  sx={{ fontSize: 12, py: 0.5, px: 1.5 }}
                  disabled={isReturning}
                  onClick={() => handleReturnToCart(numFactAction)}
                >
                  {isReturning ? "Returning..." : "Return to cart"}
                </Button>
              )}
            </Box>*/}

            {/* Right: Confirm Order (solid) */}
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button
                variant="contained"
                color="primary"
                sx={{ padding: "6px 14px", fontSize: 12, fontWeight: 700 }}
                onClick={() => {
                  setSelectedInvoice(row);
                  setPrintDialogOpen(true);
                }}
              >
                Show Invoice
              </Button>
              <Button
                variant="contained"
                color="error"
                sx={{ padding: "6px 14px", fontSize: 12, fontWeight: 800 }}
                disabled={!!row?.IS_OK}
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

                  // Fetch full invoice rows so we can persist payment updates safely
                  try {
                    const token = localStorage.getItem("token");
                    const psParam = String(row?.ps ?? "");
                    const usrParam = String(row?.usr ?? "");
                    const nfParam = String(row?.num_fact ?? "");
                    if (!token || !psParam || !usrParam || !nfParam) return;
                    const verifyRes = await axios.get(`/invoices/Getinvoice/`, {
                      params: { ps: psParam, usr: usrParam, num_fact: nfParam },
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    setCloseInvoiceRows(Array.isArray(verifyRes.data) ? verifyRes.data : []);
                  } catch {
                    setCloseInvoiceRows([]);
                  }
                }}
              >
                Close Invoice
              </Button>
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

  const normalizeMoney = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

  const normalizeLyd0 = (v: number) => Math.round(Number(v) || 0);
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
    const inv = closeInvoice;
    if (!inv) return NaN;
    const usd = Number(inv?.amount_currency) || 0;
    const usdLyd = Number(inv?.amount_currency_LYD) || 0;
    if (usd > 0 && usdLyd > 0) {
      const r = usdLyd / usd;
      return Number.isFinite(r) && r > 0 ? r : NaN;
    }
    const r = Number(inv?.rate);
    return Number.isFinite(r) && r > 0 ? r : NaN;
  }, [closeInvoice]);

  const getEurRate = React.useCallback(() => {
    const inv = closeInvoice;
    if (!inv) return NaN;
    const eur = Number(inv?.amount_EUR) || 0;
    const eurLyd = Number(inv?.amount_EUR_LYD) || 0;
    if (eur > 0 && eurLyd > 0) {
      const r = eurLyd / eur;
      return Number.isFinite(r) && r > 0 ? r : NaN;
    }
    return NaN;
  }, [closeInvoice]);

  const closeTotals = React.useMemo(() => {
    const inv = closeInvoice;
    if (!inv) {
      return {
        totalLyd: 0,
        paidLydEquiv: 0,
        remainingLyd: 0,
        recorded: { lyd: 0, usd: 0, eur: 0, usdLyd: 0, eurLyd: 0 },
      };
    }
    const totalLyd = normalizeMoney(Number(inv?.total_remise_final_lyd ?? inv?.total_remise_final_LYD ?? 0) || 0);
    const recordedLyd = normalizeMoney(Number(inv?.amount_lyd ?? 0) || 0);
    const recordedUsd = Number(inv?.amount_currency ?? 0) || 0;
    const recordedUsdLyd = normalizeMoney(Number(inv?.amount_currency_LYD ?? 0) || 0);
    const recordedEur = Number(inv?.amount_EUR ?? 0) || 0;
    const recordedEurLyd = normalizeMoney(Number(inv?.amount_EUR_LYD ?? 0) || 0);
    const paidLydEquiv = normalizeMoney(recordedLyd + recordedUsdLyd + recordedEurLyd);
    const remainingLyd = Math.max(0, normalizeMoney(totalLyd - paidLydEquiv));
    return {
      totalLyd,
      paidLydEquiv,
      remainingLyd,
      recorded: { lyd: recordedLyd, usd: recordedUsd, eur: recordedEur, usdLyd: recordedUsdLyd, eurLyd: recordedEurLyd },
    };
  }, [closeInvoice]);

  const closeEntered = React.useMemo(() => {
    const lyd = normalizeMoney(parseAmt(closePayLydStr));
    const usd = parseAmt(closePayUsdStr);
    const usdLyd = normalizeMoney(parseAmt(closePayUsdLydStr));
    const eur = parseAmt(closePayEurStr);
    const eurLyd = normalizeMoney(parseAmt(closePayEurLydStr));
    const totalLydEquiv = normalizeMoney(lyd + usdLyd + eurLyd);
    return { lyd, usd, usdLyd, eur, eurLyd, totalLydEquiv };
  }, [closePayEurLydStr, closePayEurStr, closePayLydStr, closePayUsdLydStr, closePayUsdStr]);

  // Close invoice validation: entered amount should not exceed what was recorded at invoice creation.
  // Allow partial payment (less than recorded) or exact match, but never overpayment (more than recorded).
  const lydDiff = closeEntered.lyd - closeTotals.recorded.lyd;
  const usdDiff = closeEntered.usd - closeTotals.recorded.usd;
  const eurDiff = closeEntered.eur - closeTotals.recorded.eur;
  
  // Check for overpayment: entered > recorded in any currency
  const closeIsOverpay = lydDiff > moneyEps || usdDiff > moneyEps || eurDiff > moneyEps;
  const closeIsRemainder = lydDiff < -moneyEps || usdDiff < -moneyEps || eurDiff < -moneyEps;
  const closeMismatch = Math.abs(lydDiff) > moneyEps || Math.abs(usdDiff) > moneyEps || Math.abs(eurDiff) > moneyEps;
  
  const closeUsdEquivMissing = closeEntered.usd > moneyEps && closeEntered.usdLyd <= moneyEps;
  const closeEurEquivMissing = closeEntered.eur > moneyEps && closeEntered.eurLyd <= moneyEps;

  // Remaining/remainder after reconciliation per currency.
  const closeOverpayNow = { lyd: lydDiff, usd: usdDiff, eur: eurDiff };
  const closeIsOverpayNow = closeIsOverpay;
  const closeRemainingAfter = {
    lyd: Math.max(0, normalizeMoney(closeTotals.recorded.lyd - closeEntered.lyd)),
    usd: Math.max(0, closeTotals.recorded.usd - closeEntered.usd),
    eur: Math.max(0, closeTotals.recorded.eur - closeEntered.eur),
  };

  const handleConfirmCloseInvoice = async () => {
    const inv = closeInvoice;
    if (!inv) return;
    setCloseError("");

    console.log("[Close Invoice] Validation check:", {
      closeIsOverpayNow,
      lydDiff,
      usdDiff,
      eurDiff,
      entered: closeEntered,
      recorded: closeTotals.recorded,
    });

    // Allow remainder, but never allow overpayment.
    if (closeIsOverpayNow) {
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
      // For issued invoices, update payment amounts on each invoice row directly
      const nextAmountLyd = normalizeMoney(Number(closeEntered.lyd) || 0);
      const nextAmountUsd = normalizeMoney(Number(closeEntered.usd) || 0);
      const nextAmountUsdLyd = normalizeMoney(Number(closeEntered.usdLyd) || 0);
      const nextAmountEur = normalizeMoney(Number(closeEntered.eur) || 0);
      const nextAmountEurLyd = normalizeMoney(Number(closeEntered.eurLyd) || 0);

      console.log("[Close Invoice] Updating payment amounts on invoice rows...");
      
      // Update payment amounts on all rows of this invoice
      if (closeInvoiceRows && closeInvoiceRows.length > 0) {
        for (const row of closeInvoiceRows) {
          try {
            await axios.put(
              `/invoices/Update/${row.id_fact}`,
              {
                amount_lyd: nextAmountLyd,
                amount_currency: nextAmountUsd,
                amount_currency_LYD: nextAmountUsdLyd,
                amount_EUR: nextAmountEur,
                amount_EUR_LYD: nextAmountEurLyd,
              },
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
          } catch (rowErr: any) {
            console.warn(`[Close Invoice] Failed to update row ${row.id_fact}:`, rowErr);
            // Continue with other rows even if one fails
          }
        }
        console.log("[Close Invoice] Payment amounts updated on all invoice rows");
      } else {
        console.warn("[Close Invoice] No invoice rows found to update");
      }

      // Close invoice (triggers GL)
      console.log("[Close Invoice] Calling CloseNF endpoint...");
      const closeRes = await axios.get(`/invoices/CloseNF`, {
        params: {
          ps: psParam,
          usr: usrParam,
          num_fact: numFactParam,
          MakeCashVoucher: String(!!closeMakeCashVoucher),
          Type: String(inv?.type ?? inv?.Type ?? ""),
        },
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
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            mb: 2,
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <FormControl size="small" sx={{ minWidth: 180 }}>
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
                    <Chip key={value} label={typeOptions.find(o => o.value === value)?.label || value} size="small" />
                  ))}
                </Box>
              )}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="gold">Gold</MenuItem>
              <MenuItem value="diamond">Diamond</MenuItem>
              <MenuItem value="watch">Watch</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 220 }}>
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
          <FormControl size="small" sx={{ minWidth: 200 }}>
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

          <TextField
            label="From"
            type="date"
            size="small"
            sx={{ width: 140 }}
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To"
            type="date"
            size="small"
            sx={{ width: 140 }}
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
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

          {/* Rows-per-page selector moved to footer */}

          <Button
            variant="contained"
            color="info"
            sx={{ ml: 2, fontWeight: 600, boxShadow: 2 }}
            onClick={exportTableToHtml}
            startIcon={<FileDownload />}
          >
            HTML
          </Button>
          <Button
            variant="contained"
            color="success"
            sx={{ fontWeight: 600, boxShadow: 2 }}
            onClick={exportTableToExcel}
            startIcon={<FileCopyIcon />}
          >
            Excel
          </Button>
        </Box>

        {/* Global Search + Rest Totals */}
        <Box
          sx={{
            mb: 2,
            display: "flex",
            gap: 2,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <TextField
            label="Search in all data"
            size="small"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            sx={{ minWidth: 260 }}
          />

          <TextField
            label="Customer (name / ID / phone)"
            size="small"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            sx={{ minWidth: 260 }}
          />

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="sort-by-label">Sort By</InputLabel>
            <Select
              labelId="sort-by-label"
              value={sortBy}
              label="Sort By"
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <MenuItem value="invoice_date">Invoice Date</MenuItem>
              <MenuItem value="date_created">Date Created</MenuItem>
              <MenuItem value="invoice_number">Invoice Number</MenuItem>
              <MenuItem value="value">Value</MenuItem>
            </Select>
          </FormControl>

          {sortBy === "value" && (
            <FormControl size="small" sx={{ minWidth: 160 }}>
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
          )}

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="sort-dir-label">Order</InputLabel>
            <Select
              labelId="sort-dir-label"
              value={sortDir}
              label="Order"
              onChange={(e) => setSortDir(e.target.value as any)}
            >
              <MenuItem value="desc">High to Low / Newest</MenuItem>
              <MenuItem value="asc">Low to High / Oldest</MenuItem>
            </Select>
          </FormControl>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              flexWrap: "wrap",
              borderRadius: 1,
              p: 1,
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
              Total unpaid:
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "row", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap" }}>
              {totalRestLYD !== 0 && (() => {
                const s = splitMoney2(totalRestLYD);
                return (
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 120 }}>
                    <Typography variant="subtitle2" sx={{ color: "#6a1b9a", fontWeight: 700 }}>
                      LYD {Number(s.base).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                );
              })()}
              {totalRestUSD !== 0 && (() => {
                const s = splitMoney2(totalRestUSD);
                return (
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 120 }}>
                    <Typography variant="subtitle2" sx={{ color: "#1976d2", fontWeight: 700 }}>
                      USD {Number(s.base).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                );
              })()}
              {totalRestEUR !== 0 && (() => {
                const s = splitMoney2(totalRestEUR);
                return (
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 120 }}>
                    <Typography variant="subtitle2" sx={{ color: "#388e3c", fontWeight: 700 }}>
                      EUR {Number(s.base).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                );
              })()}
            </Box>
            {totalRestLYD === 0 && totalRestUSD === 0 && totalRestEUR === 0 && (
              <Typography variant="body2" sx={{ color: "#888" }}>
                No outstanding payments
              </Typography>
            )}
          </Box>

          <Typography variant="subtitle2" sx={{ fontWeight: "bold", ml: 2 }}>
            Invoice Count: {summaryStats.invoiceCount}
          </Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: "bold", ml: 2 }}>
            Item Count:{" "}
            {summaryStats.itemCount}
          </Typography>
          {summaryStats.totalWeight !== 0 && (
            <Typography variant="subtitle1" sx={{ fontWeight: "bold", ml: 2 }}>
              Total Weight (gram): {formatNumber(summaryStats.totalWeight)}
            </Typography>
          )}
          {summaryStats.totalGold !== 0 && (
            <Typography variant="subtitle2" sx={{ fontWeight: "bold", ml: 2 }}>
              Total (gold): {formatNumber(summaryStats.totalGold)} LYD
            </Typography>
          )}
          {summaryStats.totalDiamond !== 0 && (
            <Typography variant="subtitle2" sx={{ fontWeight: "bold", ml: 2 }}>
              Total (diamond): {formatNumber(summaryStats.totalDiamond)} USD
            </Typography>
          )}
          {summaryStats.totalWatch !== 0 && (
            <Typography variant="subtitle2" sx={{ fontWeight: "bold", ml: 2 }}>
              Total (watches): {formatNumber(summaryStats.totalWatch)} USD
            </Typography>
          )}
        </Box>

        {/* Cards container */}
        <Box id="export-table-container">
          {loading ? (
            <CircularProgress />
          ) : (
            <>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
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
              {pageCount > 1 && (
                <Box
                  sx={{
                    mt: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                  }}
                >
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={safePageIndex === 0}
                    onClick={() =>
                      setPageIndex((prev) => Math.max(0, prev - 1))
                    }
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
                    onClick={() =>
                      setPageIndex((prev) => Math.min(pageCount - 1, prev + 1))
                    }
                  >
                    Next
                  </Button>

                  {/* Rows-per-page selector placed next to pagination controls */}
                  <FormControl size="small" sx={{ minWidth: 160, ml: 2 }}>
                    <InputLabel id="rows-per-page-label">
                      Rows / Page
                    </InputLabel>
                    <Select
                      labelId="rows-per-page-label"
                      value={pageSize}
                      label="Rows / Page"
                      onChange={(e) => {
                        const raw = e.target.value;
                        // support 'All' expressed as a numeric value already computed
                        const v = Number(raw) || 1;
                        setPageSize(v);
                        setPageIndex(0);
                      }}
                    >
                      <MenuItem value={5}>5</MenuItem>
                      <MenuItem value={10}>10</MenuItem>
                      <MenuItem value={50}>50</MenuItem>
                      <MenuItem value={100}>100</MenuItem>
                      <MenuItem value={Math.max(1, filteredData.length)}>
                        All
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              )}
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
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Close Invoice</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
              <Typography sx={{ fontWeight: 800 }}>
                Invoice #{closeInvoice?.num_fact}
              </Typography>

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontWeight: 700 }}>Total (LYD)</Typography>
                {(() => {
                  return (
                    <Box sx={{ textAlign: "right" }}>
                      <Typography sx={{ fontWeight: 900 }}>
                        {Number(closeTotals.totalLyd).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </Typography>
                    </Box>
                  );
                })()}
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontWeight: 700 }}>Paid so far (LYD equiv)</Typography>
                {(() => {
                  return (
                    <Box sx={{ textAlign: "right" }}>
                      <Typography sx={{ fontWeight: 900 }}>
                        {Number(closeTotals.paidLydEquiv).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </Typography>
                    </Box>
                  );
                })()}
              </Box>

              <Box sx={{ textAlign: "center", mt: 0.5, p: 1, border: "1px solid #eee", borderRadius: 1, background: "#68a5bf" }}>
                <Typography sx={{ fontWeight: 900, fontSize: 16, mb: 0.5 }}>
                  Recorded at invoice creation
                </Typography>
                <Typography sx={{ fontSize: 16, color: "primary" }}>
                  LYD: {Number(closeTotals.recorded.lyd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  {"  "} | USD: {Number(closeTotals.recorded.usd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} (LYD {Number(closeTotals.recorded.usdLyd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                  {"  "} | EUR: {Number(closeTotals.recorded.eur || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} (LYD {Number(closeTotals.recorded.eurLyd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                </Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontWeight: 700 }}>Remaining (LYD)</Typography>
                {(() => {
                  return (
                    <Box sx={{ textAlign: "right" }}>
                      <Typography sx={{ fontWeight: 900, color: closeTotals.remainingLyd > 0 ? "error.main" : "success.main" }}>
                        {Number(closeTotals.remainingLyd).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </Typography>
                    </Box>
                  );
                })()}
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontWeight: 800 }}>Remaining after this payment</Typography>
                <Typography sx={{ fontWeight: 900, color: closeIsOverpayNow ? "error.main" : (closeRemainingAfter.lyd > 0 || closeRemainingAfter.usd > 0 || closeRemainingAfter.eur > 0) ? "warning.main" : "success.main" }}>
                  {closeIsOverpayNow ? (
                    <Box component="span">
                      Overpayment:
                      {closeOverpayNow.lyd > moneyEps && ` LYD ${Number(Math.abs(closeOverpayNow.lyd)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                      {closeOverpayNow.usd > moneyEps && ` USD ${Number(Math.abs(closeOverpayNow.usd)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                      {closeOverpayNow.eur > moneyEps && ` EUR ${Number(Math.abs(closeOverpayNow.eur)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                    </Box>
                  ) : (
                    <Box component="span">
                      {closeRemainingAfter.lyd > 0 && `LYD ${Number(closeRemainingAfter.lyd).toLocaleString(undefined, { maximumFractionDigits: 0 })} `}
                      {closeRemainingAfter.usd > 0 && `USD ${Number(closeRemainingAfter.usd).toLocaleString(undefined, { maximumFractionDigits: 2 })} `}
                      {closeRemainingAfter.eur > 0 && `EUR ${Number(closeRemainingAfter.eur).toLocaleString(undefined, { maximumFractionDigits: 2 })} `}
                      {closeRemainingAfter.lyd === 0 && closeRemainingAfter.usd === 0 && closeRemainingAfter.eur === 0 && '0'}
                    </Box>
                  )}
                </Typography>
              </Box>

              <Box sx={{ mt: 1, fontWeight: 900 }}>Enter payment now (partial allowed, no overpay)</Box>

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
              />
              <TextField
                label="Pay now (USD)"
                value={closePayUsdStr}
                onChange={(e) => setClosePayUsdStr(e.target.value)}
                onBlur={() => {
                  const usd = parseAmt(closePayUsdStr);
                  const r = getUsdRate();
                  setClosePayUsdStr(usd ? String(normalizeMoney(usd)) : "");
                  if (usd > 0 && (!parseAmt(closePayUsdLydStr) || parseAmt(closePayUsdLydStr) <= 0) && Number.isFinite(r) && r > 0) {
                    setClosePayUsdLydStr(String(normalizeMoney(usd * r)));
                  }
                }}
                size="small"
                fullWidth
                inputMode="decimal"
                inputProps={{ pattern: "[0-9.,-]*" }}
              />
              <TextField
                label="USD equiv (LYD)"
                value={closePayUsdLydStr}
                onChange={(e) => setClosePayUsdLydStr(e.target.value)}
                onBlur={() => {
                  const v = parseAmt(closePayUsdLydStr);
                  setClosePayUsdLydStr(v ? String(normalizeMoney(v)) : "");
                }}
                size="small"
                fullWidth
                inputMode="decimal"
                inputProps={{ pattern: "[0-9.,-]*" }}
              />
              <TextField
                label="Pay now (EUR)"
                value={closePayEurStr}
                onChange={(e) => setClosePayEurStr(e.target.value)}
                onBlur={() => {
                  const eur = parseAmt(closePayEurStr);
                  const r = getEurRate();
                  setClosePayEurStr(eur ? String(normalizeMoney(eur)) : "");
                  if (eur > 0 && (!parseAmt(closePayEurLydStr) || parseAmt(closePayEurLydStr) <= 0) && Number.isFinite(r) && r > 0) {
                    setClosePayEurLydStr(String(normalizeMoney(eur * r)));
                  }
                }}
                size="small"
                fullWidth
                inputMode="decimal"
                inputProps={{ pattern: "[0-9.,-]*" }}
              />
              <TextField
                label="EUR equiv (LYD)"
                value={closePayEurLydStr}
                onChange={(e) => setClosePayEurLydStr(e.target.value)}
                onBlur={() => {
                  const v = parseAmt(closePayEurLydStr);
                  setClosePayEurLydStr(v ? String(normalizeMoney(v)) : "");
                }}
                size="small"
                fullWidth
                inputMode="decimal"
                inputProps={{ pattern: "[0-9.,-]*" }}
              />

              <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
                <Typography sx={{ fontWeight: 800 }}>Entered (LYD equiv)</Typography>
                <Typography sx={{ fontWeight: 900, color: closeMismatch ? "error.main" : "text.primary" }}>
                  {closeEntered.totalLydEquiv.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontWeight: 800 }}>Compare vs recorded</Typography>
                <Typography sx={{ fontWeight: 900 }}>
                  {closeMismatch ? (
                    <Box component="span" sx={{ color: closeIsOverpay ? "error.main" : "warning.main" }}>
                      {closeIsOverpay ? "Overpayment" : "Remainder"}:
                      {Math.abs(lydDiff) > moneyEps && ` LYD ${Math.abs(lydDiff).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                      {Math.abs(usdDiff) > moneyEps && ` USD ${Math.abs(usdDiff).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                      {Math.abs(eurDiff) > moneyEps && ` EUR ${Math.abs(eurDiff).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                    </Box>
                  ) : (
                    <Box component="span" sx={{ color: "success.main" }}>
                      Match
                    </Box>
                  )}
                </Typography>
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
              disabled={closeLoading || closeIsOverpayNow || closeUsdEquivMissing || closeEurEquivMissing}
            >
              {closeLoading ? "Closing..." : "Close Invoice"}
            </Button>
          </DialogActions>
        </Dialog>
        {/* Chira Return Dialog */}
        <Dialog
          open={chiraDialogOpen}
          onClose={() => setChiraDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Return Chira</DialogTitle>
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
