/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from "react";
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
// privilege is read directly from localStorage.user

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
  const t = supplierType?.toLowerCase() || "";
  let typed: "watch" | "diamond" | undefined;
  if (t.includes("watch")) typed = "watch";
  else if (t.includes("diamond")) typed = "diamond";
  const endpoints = typed
    ? [`${API_BASEImage}/list/${typed}/${id}`, `${API_BASEImage}/list/${id}`]
    : [`${API_BASEImage}/list/${id}`];
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
              } catch {
                /* ignore */
              }
            }
            if (token) {
              const urlObj = new URL(u, window.location.origin);
              urlObj.searchParams.delete("token");
              urlObj.searchParams.append("token", token);
              u = urlObj.toString();
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

  const [type, setType] = useState<"all" | "gold" | "diamond" | "watch">(
    initialType || "all"
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
  // Trigger refresh after closing an invoice
  const [invoiceRefreshFlag, setInvoiceRefreshFlag] = useState(0);
  const [chiraDialogOpen, setChiraDialogOpen] = useState(false);
  const [chiraDialogIdFact, setChiraDialogIdFact] = useState<any>(null);
  const [chiraRefreshFlag, setChiraRefreshFlag] = useState(0);
  const printRef = React.useRef(null);
  const [globalFilter, setGlobalFilter] = useState<string>("");
  const [pageIndex, setPageIndex] = useState(0); // for card pagination
  const [restOnly, setRestOnly] = useState<boolean>(false);
  const [saleKinds, setSaleKinds] = useState<string[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<
    "all" | "paid" | "unpaid" | "partial"
  >("all");
  const [productTypes, setProductTypes] = useState<string[]>([]); // Gold, Diamond, Watch
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
      console.error("Error fetching Users:", error);
    } finally {
      // no-op
    }
  };

  // Navigate to Customer Profile from a row
  const openCustomerProfile = React.useCallback((row: any) => {
    let id: number | null = null;
    try {
      id = row?.Client?.id_client || row?.Client?.Id_client || row?.client || null;
      const name = row?.Client?.client_name || "";
      const phone = row?.Client?.tel_client || "";
      if (id) localStorage.setItem("customerFocusId", String(id));
      if (name) localStorage.setItem("customerFocusName", String(name));
      if (phone) localStorage.setItem("customerFocusPhone", String(phone));
    } catch {}
    // Prefer encrypted customer route to carry the id in URL
    if (id) {
      const path = buildEncryptedClientPath(Number(id));
      navigate(path);
    } else {
      navigate("/invoice/customerProfile");
    }
  }, [navigate]);

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
  // Raw URL lists per picint/id_achat
  const [imageUrls, setImageUrls] = useState<Record<string, string[]>>({});
  // Blob/object URLs per picint/id_achat (used for display/export)
  const [imageBlobUrls, setImageBlobUrls] = useState<Record<string, string[]>>(
    {}
  );
  // Keep a flat list of created object URLs so we can revoke them on unmount only
  const createdBlobUrlsRef = React.useRef<string[]>([]);
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
    const t = supplierType?.toLowerCase() || "";
    let typed: "watch" | "diamond" | undefined;
    if (t.includes("watch")) typed = "watch";
    else if (t.includes("diamond")) typed = "diamond";
    const endpoints = typed
      ? [`${API_BASEImage}/list/${typed}/${id}`, `${API_BASEImage}/list/${id}`]
      : [`${API_BASEImage}/list/${id}`];
    for (const url of endpoints) {
      try {
        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (Array.isArray(res.data)) {
          const list = res.data
            .map((u: string) => {
              if (typeof u !== "string") return "";
              // Always force https for system.gaja.ly to avoid redirect on preflight
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
              // If page is https and URL is plain http (any host), upgrade
              if (
                window?.location?.protocol === "https:" &&
                u.startsWith("http://")
              ) {
                try {
                  const after = u.substring("http://".length);
                  u = "https://" + after;
                } catch {
                  /* ignore */
                }
              }
              // Append token as query param to avoid Authorization header (which triggers preflight + redirect)
              if (token) {
                const urlObj = new URL(u, window.location.origin);
                // Remove existing token param to prevent duplication
                urlObj.searchParams.delete("token");
                urlObj.searchParams.append("token", token);
                u = urlObj.toString();
              }
              return u;
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
        const imgUrl = url.startsWith("http") ? url : `${API_BASEImage}/${url}`; // url already has ?token
        const resp = await fetch(imgUrl, { method: "GET" });
        if (!resp.ok) continue;
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        blobUrls.push(blobUrl);
        // track created object URLs so we can revoke them on unmount
        createdBlobUrlsRef.current.push(blobUrl);
      } catch {
        // fallback: skip or push empty
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
    setLoading(true);
    const token = localStorage.getItem("token");
    // When selectedPs === 'all' some backend endpoints expect a ps value (or the user's ps)
    // to avoid unintentionally filtering everything. Use the user's stored ps as a fallback.
    const userPsFallback = localStorage.getItem("ps") || undefined;
    const psParam =
      selectedPs && selectedPs !== "all" ? selectedPs : userPsFallback;

    axios
      .get(`/invoices/allDetailsP`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          ...(psParam ? { ps: psParam } : {}),
          ...(type !== "all" ? { type } : {}),
          from: periodFrom || undefined,
          to: periodTo || undefined,
        },
      })
      .then((res) => {
        setData(res.data);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [type, periodFrom, periodTo, selectedPs, chiraRefreshFlag, invoiceRefreshFlag]);

  // When filter criteria change (not internal refresh flags), clear cached images so they reload for the new dataset
  useEffect(() => {
    // Reset only on primary filter changes
    setImageUrls({});
    setImageBlobUrls({});
    setPageIndex(0);
  }, [type, periodFrom, periodTo, selectedPs]);
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
        const design = achat.Design_art || "";
        const code = achat.id_fact || "";
        const typeSupplier = achat.Fournisseur?.TYPE_SUPPLIER || "";
        let weight = "";
        if (typeSupplier.toLowerCase().includes("gold")) {
          weight = achat.qty?.toString() || "";
        }
        // Prefer achat.picint, then achat.id_achat, then invoice.picint
        const picint = achat.picint || achat.id_achat || row.picint || "";

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
          picint, // Add picint to product details
          IS_GIFT,
          CODE_EXTERNAL: codeExternal,
        });
      });
    });
    return Array.from(invoiceMap.values());
  }

  // Sort data by date_fact descending
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
      if (row.picint) queued.push({ id: row.picint, type: supplierType });
      (row.ACHATs || []).forEach((a: any) => {
        const prodId = a.picint || a.id_achat;
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
      if (row.picint && imageUrls[row.picint] === undefined)
        pending.push({ id: row.picint, type: supplierType });
      (row.ACHATs || []).forEach((a: any) => {
        const prodId = a.picint || a.id_achat;
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
    for (const row of sortedData) {
      if (truncated) break;
      if (!row?._productDetails) continue;
      for (const d of row._productDetails) {
        if (truncated) break;
        const picint = d.picint;
        if (!picint || processed.has(String(picint))) continue;
        processed.add(String(picint));
        if (globalImageCount >= EXPORT_MAX_IMAGES) {
          truncated = true;
          break;
        }
        const blobUrls = imageBlobUrls[picint] || [];
        let candidateUrls: string[] = [];
        if (blobUrls.length > 0) candidateUrls = blobUrls;
        else
          candidateUrls =
            imageUrls[picint] ||
            (await fetchImageListForExport(picint, d.typeSupplier));
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
        picintToBase64[picint] = base64List;
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
    sortedData.forEach((row: any) => {
      const client = row.Client
        ? `${row.Client.client_name || ""}${row.Client.client_name && row.Client.tel_client ? " - " : ""}${row.Client.tel_client || ""}`
        : "";

      // Build Invoice Info block (mimics on-screen cell)
      const created = row.d_time ? new Date(row.d_time) : null;
      let createdStr = "";
      if (created) {
        let hours = created.getHours();
        const minutes = created.getMinutes().toString().padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        hours = hours ? hours : 12;
        createdStr = `${hours}:${minutes} ${ampm}`;
      }
      const user =
        row.Utilisateur && row.Utilisateur.name_user
          ? row.Utilisateur.name_user
          : "";
      const isChiraFlag = row.is_chira === true || row.is_chira === 1;
      const returnChira = row.return_chira;
      const commentChira = row.comment_chira;
      const usrReceiveChira = row.usr_receive_chira;
      const invoiceInfoHtml = `
                <div style="font-size:12px;line-height:1.35">
                    <div><b>Date:</b> <span class="chip">${row.date_fact || ""}</span></div>
                    <div><b>Invoice No:</b> <span class="chip">${row.num_fact || ""}</span></div>
                    <div><b>Time:</b> ${createdStr}</div>
                    <div><b>Point Of Sale:</b> ${row.ps || ""}</div>
                    ${user ? `<div><b>Sold by:</b> ${user}</div>` : ""}
                    <div><b>Chira:</b> <span style="color:${isChiraFlag ? "#388e3c" : "#d32f2f"};font-weight:600">${isChiraFlag ? "Yes" : "No"}</span></div>
                    ${
                      !isChiraFlag &&
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
          const price = row.prix_vente_remise
            ? `${row.prix_vente_remise} ${d.typeSupplier?.toLowerCase().includes("gold") ? "LYD" : "USD"}`
            : "";
          // Include invoice id (id_fact or num_fact) near each product line
          const invoiceId = row.id_fact ?? "";
          const prefix = invoiceId ? `${invoiceId} | ` : "";
          const lineText = `${prefix}${d.design} | ${d.weight || ""} | ${d.code} | ${d.typeSupplier}${price ? " | " + price : ""}`;
          const refLine = String(d.typeSupplier || "")
            .toLowerCase()
            .includes("diamond")
            ? d.CODE_EXTERNAL || d.code || ""
            : "";
          const picint = d.picint;
          const urls =
            picint && picintToBase64[picint] ? picintToBase64[picint] : [];
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
    const needed: { picint: number; supplierType?: string }[] = [];
    sortedData.forEach((row: any) =>
      (row._productDetails || []).forEach((d: any) => {
        if (d.picint)
          needed.push({ picint: d.picint, supplierType: d.typeSupplier });
      })
    );
    const uniquePicints = Array.from(new Set(needed.map((n) => n.picint)));
    for (const picint of uniquePicints) {
      if (truncated) break;
      const pd = needed.find((n) => n.picint === picint);
      const blobUrls = imageBlobUrls[picint] || [];
      let candidateUrls: string[] = [];
      if (blobUrls.length > 0) candidateUrls = blobUrls;
      else
        candidateUrls =
          imageUrls[picint] ||
          (await fetchImageListForExport(picint, pd?.supplierType));
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
      picintToCidImages[String(picint)] = parts;
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

    sortedData.forEach((row: any) => {
      const client = row.Client
        ? `${row.Client.client_name || ""}${row.Client.client_name && row.Client.tel_client ? " - " : ""}${row.Client.tel_client || ""}`
        : "";
      const created = row.d_time ? new Date(row.d_time) : null;
      let createdStr = "";
      if (created) {
        let hours = created.getHours();
        const minutes = created.getMinutes().toString().padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        hours = hours ? hours : 12;
        createdStr = `${hours}:${minutes} ${ampm}`;
      }
      const user =
        row.Utilisateur && row.Utilisateur.name_user
          ? row.Utilisateur.name_user
          : "";
      const isChiraFlag = row.is_chira === true || row.is_chira === 1;
      const returnChira = row.return_chira;
      const commentChira = row.comment_chira;
      const usrReceiveChira = row.usr_receive_chira;
      const invoiceInfoHtml = `
                <div style="font-size:12px;line-height:1.35">
                    <div><b>Date:</b> <span class="chip">${row.date_fact || ""}</span></div>
                    <div><b>Invoice No:</b> <span class="chip">${row.num_fact || ""}</span></div>
                    <div><b>Time:</b> ${createdStr}</div>
                    <div><b>Point Of Sale:</b> ${row.ps || ""}</div>
                    ${user ? `<div><b>Sold by:</b> ${user}</div>` : ""}
                    <div><b>Chira:</b> <span style="color:${isChiraFlag ? "#388e3c" : "#d32f2f"};font-weight:600">${isChiraFlag ? "Yes" : "No"}</span></div>
                    ${
                      !isChiraFlag &&
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
          const price = row.prix_vente_remise
            ? `${row.prix_vente_remise} ${d.typeSupplier?.toLowerCase().includes("gold") ? "LYD" : "USD"}`
            : "";
          // Include invoice id (id_fact or num_fact) near each product line for export
          const invoiceId = row.id_fact ?? row.num_fact ?? "";
          const prefix = invoiceId ? `${invoiceId} | ` : "";
          const lineText = `${prefix}${d.design} | ${d.weight || ""} | ${d.code} | ${d.typeSupplier}${price ? " | " + price : ""}`;
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
      console.error("Failed to return invoice to cart", err);
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

  // --------- NEW: GLOBAL FILTER + CARD PAGINATION ---------
  const filteredData = React.useMemo(() => {
    let base = sortedData;
    if (globalFilter) {
      const term = globalFilter.toLowerCase();
      base = base.filter((row) =>
        JSON.stringify(row).toLowerCase().includes(term)
      );
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
          (Number(row.amount_lyd || 0) || 0) +
          (Number(row.amount_currency_LYD || 0) || 0) +
          (Number(row.amount_EUR_LYD || 0) || 0);
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
  }, [sortedData, globalFilter, saleKinds, paymentStatus, restOnly]);
  // Totals of "rest" fields for the currently filtered dataset
  const totalRestLYD = React.useMemo(() => {
    return filteredData.reduce((sum, row) => {
      const v = Number(row.rest_of_money || 0);
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
  }, [filteredData]);
  const totalRestUSD = React.useMemo(() => {
    return filteredData.reduce((sum, row) => {
      const v = Number(row.rest_of_moneyUSD || row.rest_of_money_usd || 0);
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
  }, [filteredData]);
  const totalRestEUR = React.useMemo(() => {
    return filteredData.reduce((sum, row) => {
      const v = Number(row.rest_of_moneyEUR || row.rest_of_money_eur || 0);
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
  }, [filteredData]);
  const [pageSize, setPageSize] = useState<number>(5);
  const pageCount = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const pagedData = filteredData.slice(
    safePageIndex * pageSize,
    safePageIndex * pageSize + pageSize
  );

  // Reset to first page when filters or search change
  useEffect(() => {
    setPageIndex(0);
  }, [globalFilter, type, periodFrom, periodTo, selectedPs, saleKinds, paymentStatus]);

  // ---- CARD RENDERER (replaces table row) ----
  const renderInvoiceCard = (row: any) => {
    const date = row.date_fact || "";
    const num = row.num_fact || "";
    const created = row.d_time ? new Date(row.d_time) : null;
    const ps = row.ps || "";
    let createdStr = "";
    if (created) {
      let hours = created.getHours();
      const minutes = created.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      createdStr = `${hours}:${minutes} ${ampm}`;
    }
    const user =
      row.Utilisateur && row.Utilisateur.name_user
        ? row.Utilisateur.name_user
        : "";
    const isChiraVal = row.is_chira === true || row.is_chira === 1;
    const returnChira = row.return_chira;
    const commentChira = row.comment_chira;
    const usrReceiveChira = row.usr_receive_chira;

    // Primary label: show Chira No when chira=yes, otherwise Invoice No
    const primaryLabel = isChiraVal
      ? `Chira No: ${returnChira || num}`
      : `Invoice No: ${num}`;

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
          clientValue.id ||
          clientValue.client_id)) ||
      row?.id_client ||
      row?.client_id ||
      row?.Id_client ||
      row?.id_cli ||
      row?.id_cl ||
      null;

    const totalRemiseFinal = row.total_remise_final ?? "";
    // amount fields are accessed directly from `row` where needed

    const details: any[] = row._productDetails || [];
    const prix_vente_remise = row.prix_vente_remise;

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
                      } catch {}
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
                      // Prefer encrypted dynamic customer path so Home router resolves directly
                      let path = "/invoice/customerProfile";
                      try {
                        if (typeof window !== "undefined") {
                          // Persist whatever we have immediately
                          if (clientId)
                            localStorage.setItem(
                              "customerFocusId",
                              String(clientId)
                            );
                          const namePart =
                            (clientValue &&
                              (clientValue.client_name || clientValue.name)) ||
                            String(clientDisplay).split(" - ")[0] ||
                            "";
                          const telPart =
                            (clientValue &&
                              (clientValue.tel_client || clientValue.phone)) ||
                            "";
                          if (namePart)
                            localStorage.setItem(
                              "customerFocusName",
                              String(namePart)
                            );
                          if (telPart)
                            localStorage.setItem(
                              "customerFocusPhone",
                              String(telPart)
                            );
                          // Build encrypted route when we have a concrete id
                          if (clientId) {
                            try {
                              path = buildEncryptedClientPath(Number(clientId));
                            } catch {}
                          }
                        }
                      } catch {}
                      // Enforce hard redirect and stop further handling to avoid router interference
                      try {
                        if (typeof window !== "undefined") {
                          (window as any).location.href = path;
                          return;
                        }
                      } catch {}
                      // Fallback: try assign, then SPA navigate
                      try {
                        if (typeof window !== "undefined") {
                          window.location.assign(path);
                          return;
                        }
                      } catch {}
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
                <Chip
                  label={(function buildAmountsChip() {
                    const parts: any[] = [];
                    const total = Number(totalRemiseFinal) || 0;
                    if (total) {
                      const isGold =
                        !!row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes(
                          "gold"
                        );
                      parts.push(
                        <div
                          key="total"
                          style={{ fontWeight: 700 }}
                        >{`${formatNumber(total)} ${isGold ? "LYD" : "USD"}`}</div>
                      );
                    }

                    const lyd = Number(row.amount_lyd) || 0;
                    if (lyd !== 0) {
                      parts.push(
                        <div key="lyd">{`LYD: ${formatNumber(lyd)}`}</div>
                      );
                    }

                    const usd = Number(row.amount_currency) || 0;
                    if (usd !== 0) {
                      const usdEq = row.amount_currency_LYD
                        ? ` (${formatNumber(row.amount_currency_LYD)} LYD)`
                        : "";
                      parts.push(
                        <div key="usd">{`USD: ${formatNumber(usd)}${usdEq}`}</div>
                      );
                    }

                    const eur = Number(row.amount_EUR) || 0;
                    if (eur !== 0) {
                      const eurEq = row.amount_EUR_LYD
                        ? ` (${formatNumber(row.amount_EUR_LYD)} LYD)`
                        : "";
                      parts.push(
                        <div key="eur">{`EUR: ${formatNumber(eur)}${eurEq}`}</div>
                      );
                    }

                    // Combine rest amounts (LYD / USD / EUR) into a single inline element
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
                    const restPieces: string[] = [];
                    if (!isNaN(restLYD) && restLYD !== 0)
                      restPieces.push(`LYD ${formatNumber(restLYD)}`);
                    if (!isNaN(restUSD) && restUSD !== 0)
                      restPieces.push(`USD ${formatNumber(restUSD)}`);
                    if (!isNaN(restEUR) && restEUR !== 0)
                      restPieces.push(`EUR ${formatNumber(restEUR)}`);
                    if (restPieces.length > 0) {
                      parts.push(
                        <div
                          key="restCombined"
                          style={{ color: "#d04444ff" }}
                        >{`Remaining: ${restPieces.join(" | ")}`}</div>
                      );
                    }

                    if (parts.length === 0) return "Amounts";
                    return (
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: 0,
                        }}
                      >
                        {parts.map((p, i) => (
                          <Typography key={i} sx={{ fontSize: 12 }}>
                            {p}
                          </Typography>
                        ))}
                      </Box>
                    );
                  })()}
                  size="small"
                  variant="outlined"
                  sx={{
                    minHeight: 80,
                    alignItems: "flex-start",
                    py: 1.5,
                    px: 2,
                    fontSize: 13,
                    border: "1px solid #05c535ff",
                    color: "#05c535ff",
                  }}
                />
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
                        const productPicint = d.picint;
                        const productBlobUrls = productPicint
                          ? imageBlobUrls[productPicint] || []
                          : [];
                        const invoiceIdForLine =
                          d.id_fact || row.id_fact || row.num_fact;
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
                                    objectFit: "cover",
                                    borderRadius: 6,
                                    border: "1px solid #eee",
                                    cursor: "pointer",
                                  }}
                                  onClick={() => {
                                    setImageDialogUrl(productBlobUrls[0]);
                                    setImageDialogOpen(true);
                                  }}
                                />
                              ) : (
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
                              {prix_vente_remise}{" "}
                              {d.typeSupplier?.toLowerCase().includes("gold")
                                ? "LYD"
                                : "USD"}
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
              justifyContent: "space-between",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            {/* Left: Return to cart (ghost) */}
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
            </Box>

            {/* Right: Confirm Order (solid) */}
            <Box>
              <Button
                variant="contained"
                color="primary"
                sx={{ padding: "6px 14px", fontSize: 12, fontWeight: 700 }}
                onClick={() => {
                  setSelectedInvoice(row);
                  setPrintDialogOpen(true);
                }}
              >
                Confirm Order
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
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
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="type-select-label">Type</InputLabel>
            <Select
              labelId="type-select-label"
              value={type}
              label="Type"
              onChange={(e) =>
                setType(e.target.value as "all" | "gold" | "diamond" | "watch")
              }
            >
              {typeOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
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
          {/* Product types multi-select */}
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="prod-type-label">Product types</InputLabel>
            <Select
              labelId="prod-type-label"
              multiple
              value={productTypes}
              label="Product types"
              onChange={(e) =>
                setProductTypes(
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
              <MenuItem value="Gold">Gold</MenuItem>
              <MenuItem value="Diamond">Diamond</MenuItem>
              <MenuItem value="Watch">Watch</MenuItem>
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
            sx={{ minWidth: 200, flex: 1 }}
          />
          <Box
            sx={{
              display: "flex",
              gap: 1,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
              Total unpaid:
            </Typography>
            {totalRestLYD !== 0 && (
              <Typography
                variant="subtitle2"
                sx={{ color: "#6a1b9a", fontWeight: 700 }}
              >
                LYD {formatNumber(totalRestLYD)}
              </Typography>
            )}
            {totalRestUSD !== 0 && (
              <Typography
                variant="subtitle2"
                sx={{ color: "#1976d2", fontWeight: 700 }}
              >
                USD {formatNumber(totalRestUSD)}
              </Typography>
            )}
            {totalRestEUR !== 0 && (
              <Typography
                variant="subtitle2"
                sx={{ color: "#388e3c", fontWeight: 700 }}
              >
                EUR {formatNumber(totalRestEUR)}
              </Typography>
            )}
            {totalRestLYD === 0 && totalRestUSD === 0 && totalRestEUR === 0 && (
              <Typography variant="body2" sx={{ color: "#888" }}>
                No outstanding payments
              </Typography>
            )}
          </Box>
        </Box>

        {/* Summary totals (moved to top after search) */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            mt: 0,
            mb: 2,
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: "bold", ml: 2 }}>
            Invoice Count: {sortedData.length}
          </Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: "bold", ml: 2 }}>
            Item Count:{" "}
            {sortedData.reduce(
              (sum, row) =>
                sum +
                (Array.isArray(row._productDetails)
                  ? row._productDetails.length
                  : 0),
              0
            )}
          </Typography>
          {totalWeight !== 0 && (
            <Typography variant="subtitle1" sx={{ fontWeight: "bold", ml: 2 }}>
              Total Weight (gram): {formatNumber(totalWeight)}
            </Typography>
          )}
          {totalGold !== 0 && (
            <Typography variant="subtitle2" sx={{ fontWeight: "bold", ml: 2 }}>
              Total (gold): {formatNumber(totalGold)} LYD
            </Typography>
          )}
          {totalDiamond !== 0 && (
            <Typography variant="subtitle2" sx={{ fontWeight: "bold", ml: 2 }}>
              Total (diamond): {formatNumber(totalDiamond)} USD
            </Typography>
          )}
          {totalWatch !== 0 && (
            <Typography variant="subtitle2" sx={{ fontWeight: "bold", ml: 2 }}>
              Total (watches): {formatNumber(totalWatch)} USD
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
              // Totals
              const totalAmountLYD = Number(invoice.amount_lyd) || 0;
              const totalAmountUSD = Number(invoice.amount_currency) || 0;
              const totalAmountEur = Number(invoice.amount_EUR) || 0;
              const totalWeight =
                invoice._productDetails?.reduce(
                  (sum: number, d: any) => sum + (Number(d.weight) || 0),
                  0
                ) || 0;
              const itemCount = invoice._productDetails?.length || 0;
              const amount_currency_LYD =
                Number(invoice.amount_currency_LYD) || 0;
              const amount_EUR_LYD = Number(invoice.amount_EUR_LYD) || 0;
              return {
                invoice,
                items,
                customer,
                totalAmountLYD,
                totalAmountUSD,
                totalAmountEur,
                totalWeight,
                itemCount,
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
            showCloseInvoiceActions={true}
            showCloseInvoice={
              selectedInvoice && selectedInvoice.IS_OK === false
            }
            createdBy={selectedInvoice?.Utilisateur?.name_user || ""}
          />
        )}
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
