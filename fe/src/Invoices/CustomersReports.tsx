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
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Button,
  Autocomplete,
} from "@mui/material";
import axios from "../api";
import { decodeClientToken } from "../utils/routeCrypto";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import ExcelJS from "exceljs";

import PrintInvoiceDialog from "../Invoices/ListCardInvoice/Gold Invoices/PrintInvoiceDialog";
interface Client {
  id_client: number;
  client_name: string;
  tel_client: string;
}

const MODEL_LABELS = {
  all: "All Types",
  gold: "Gold",
  diamond: "Diamond",
  watch: "Watch",
};

const typeOptions = [
  { label: "All", value: "all" },
  { label: "Gold", value: "gold" },
  { label: "Diamond", value: "diamond" },
  { label: "Watch", value: "watch" },
];

const CustomersReports = ({
  type: initialType,
  focusCustomerId,
}: {
  type?: "gold" | "diamond" | "watch";
  focusCustomerId?: number;
}) => {
  const [type, setType] = useState<"all" | "gold" | "diamond" | "watch">(
    initialType || "all"
  );
  const [currency, setCurrency] = useState<"all" | "LYD" | "USD" | "EUR">(
    "all"
  );
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // Set default periodFrom to January 1st of current year, periodTo to current date
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const currentDate = `${yyyy}-${mm}-${dd}`;
  const [periodFrom, setPeriodFrom] = useState(`${yyyy}-01-01`);
  const [periodTo, setPeriodTo] = useState(currentDate);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsData, setDetailsData] = useState<any>(null);
  const [isChira, setIsChira] = useState<"all" | "yes" | "no">("all");
  const [isWholeSale, setIsWholeSale] = useState<"all" | "yes" | "no">("all");
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const printRef = React.useRef(null);

  const [customers, setCustomers] = useState<Client[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Client | null>(null);

  const apiIp = process.env.REACT_APP_API_IP;
  const API_BASEImage = "/images";
  const apiUrlWatches = "/WOpurchases";
  const [imageUrls, setImageUrls] = useState<Record<string, string[]>>({});
  const [imageBlobUrls, setImageBlobUrls] = useState<Record<string, string[]>>(
    {}
  );
  // Watch details (OriginalAchatWatches) keyed by invoice picint
  const [watchDetailsMap, setWatchDetailsMap] = useState<Record<string, any>>(
    {}
  );

  const tryWatchFallback = (
    imgEl: HTMLImageElement,
    typeSupplier?: string
  ): boolean => {
    const type = typeSupplier?.toLowerCase() || "";
    if (!type.includes("watch")) return false;
    try {
      const originalSrc = imgEl.getAttribute("data-orig-src") || imgEl.src;
      if (!originalSrc || !/\/images\//.test(originalSrc)) return false;
      imgEl.setAttribute("data-orig-src", originalSrc);
      const urlObj = new URL(originalSrc, window.location.origin);
      const token = urlObj.searchParams.get("token");
      const host = `${urlObj.protocol}//${urlObj.host}`;
      const pathParts = urlObj.pathname.split("/");
      const alreadyTried = imgEl.getAttribute("data-fallback-tried") || "";
      if (
        pathParts.length >= 4 &&
        pathParts[1] === "images" &&
        pathParts[2] !== "watch" &&
        alreadyTried !== "watch"
      ) {
        const idPart = pathParts[2];
        const filenamePart = pathParts.slice(3).join("/").split("?")[0];
        const rewrittenPath = `/images/watch/${idPart}/${filenamePart}`;
        const nextUrl = token
          ? `${host}${rewrittenPath}?token=${encodeURIComponent(token)}`
          : `${host}${rewrittenPath}`;
        imgEl.setAttribute("data-fallback-tried", "watch");
        imgEl.onerror = () => {
          tryWatchFallback(imgEl, typeSupplier);
        };
        imgEl.src = nextUrl;
        return true;
      }
      if (
        pathParts.length >= 5 &&
        pathParts[1] === "images" &&
        pathParts[2] === "watch" &&
        alreadyTried !== "static"
      ) {
        const idPart = pathParts[3];
        const filenamePart = pathParts.slice(4).join("/").split("?")[0];
        const staticUrl = `${host}/uploads/WatchPic/${idPart}/${filenamePart}`;
        imgEl.setAttribute("data-fallback-tried", "static");
        imgEl.onerror = null;
        imgEl.src = staticUrl;
        return true;
      }
    } catch {
      return false;
    }
    return false;
  };

  const handleImageError = (
    event: React.SyntheticEvent<HTMLImageElement>,
    typeSupplier?: string
  ) => {
    const imgEl = event.currentTarget;
    if (tryWatchFallback(imgEl, typeSupplier)) {
      return;
    }
    imgEl.onerror = null;
  };
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

  const apiUrlcustomers = `${apiIp}/customers`;
  const apiUrlRevenue = "/Revenue";

  // Fetch customers
  const fetchCustomers = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get<Client[]>(`${apiUrlcustomers}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCustomers(res.data);
    } catch (error) {}
  };

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line
  }, []);

  // Apply focusCustomerId from props immediately when available (Timesheets-like behavior)
  useEffect(() => {
    if (typeof focusCustomerId === "number") {
      const match = customers.find((c) => Number(c.id_client) === Number(focusCustomerId)) || null;
      if (match) setSelectedCustomer(match);
      else setSelectedCustomer({ id_client: focusCustomerId, client_name: "", tel_client: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCustomerId, customers]);

  // On mount, if path is /c/<token>, decode and set focus id and provisional selection (skipped if prop provided)
  useEffect(() => {
    if (typeof focusCustomerId === "number") return;
    try {
      const path = typeof window !== "undefined" ? window.location.pathname : "";
      if (path.startsWith("/c/")) {
        const token = path.slice(3);
        const id = decodeClientToken(token);
        if (id) {
          try {
            localStorage.setItem("customerFocusId", String(id));
          } catch {}
          // set a minimal stub; detailed object will be set when customers load
          setSelectedCustomer((prev) => prev ?? { id_client: id, client_name: "", tel_client: "" });
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When customers list loads, preload selection from localStorage focus id set by encrypted route (/c/<token>)
  useEffect(() => {
    if (typeof focusCustomerId === "number") return; // prop takes precedence
    try {
      const idStr = localStorage.getItem("customerFocusId");
      if (idStr) {
        const id = Number(idStr);
        if (!isNaN(id)) {
          const match = customers.find((c) => Number(c.id_client) === id) || null;
          // If found, select the full customer; if not yet fetched, set a minimal stub to trigger fetching
          if (match) setSelectedCustomer(match);
          else setSelectedCustomer({ id_client: id, client_name: "", tel_client: "" });
        }
        // one-time use
        localStorage.removeItem("customerFocusId");
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

  // Fetch all images for a given picint (or id_achat)
  const fetchImages = async (picint: string, supplierType?: string) => {
    const token = localStorage.getItem("token");
    if (!picint) return;
    if (imageUrls[picint]) return;

    const numericPicint = Number(picint);
    const typeHint = supplierType?.toLowerCase() || "";
    let typed: "watch" | "diamond" | "gold" | undefined;
    if (typeHint.includes("watch")) typed = "watch";
    else if (typeHint.includes("diamond")) typed = "diamond";
    else if (typeHint.includes("gold")) typed = "gold";
    const isWatchLike = !typed && !isNaN(numericPicint) && numericPicint >= 500000;

    try {
      const endpoints =
        typed || isWatchLike
          ? [
            `${API_BASEImage}/list/${typed || "watch"}/${picint}`,
            `${API_BASEImage}/list/${picint}`,
          ]
          : [`${API_BASEImage}/list/${picint}`];

      for (const endpoint of endpoints) {
        try {
          const res = await axios.get(endpoint, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (Array.isArray(res.data)) {
            const normalized = res.data
              .map((u: string) => {
                if (typeof u !== "string") return "";
                let out = u;
                if (out.includes("system.gaja.ly")) {
                  try {
                    const hostIdx = out.indexOf("system.gaja.ly") + "system.gaja.ly".length;
                    const trailing = out.substring(hostIdx);
                    out = `http://localhost:9000/api${trailing}`;
                  } catch {
                    /* ignore */
                  }
                }
                if (window?.location?.protocol === "https:" && out.startsWith("http://")) {
                  try {
                    const after = out.substring("http://".length);
                    out = "https://" + after;
                  } catch {
                    /* ignore */
                  }
                }
                const needsWatchRewrite = (typed || (isWatchLike ? "watch" : undefined)) === "watch";
                if (needsWatchRewrite) {
                  try {
                    const obj = new URL(out, window.location.origin);
                    const parts = obj.pathname.split("/");
                    if (parts.length >= 4 && parts[1] === "images" && parts[2] !== "watch") {
                      obj.pathname = ["", "images", "watch", parts[2], ...parts.slice(3)].join("/");
                      out = obj.toString();
                    }
                  } catch {
                    /* ignore */
                  }
                }
                if (token) {
                  try {
                    const urlObj = new URL(out, window.location.origin);
                    urlObj.searchParams.delete("token");
                    urlObj.searchParams.append("token", token);
                    out = urlObj.toString();
                  } catch {
                    /* ignore */
                  }
                }
                return out;
              })
              .filter(Boolean);
            setImageUrls((prev) => ({ ...prev, [picint]: normalized }));
            return;
          }
        } catch {
          /* try next */
        }
      }

      setImageUrls((prev) => ({ ...prev, [picint]: [] }));
    } catch (err) {
      setImageUrls((prev) => ({ ...prev, [picint]: [] }));
    }
  };

  // Helper to fetch image as blob and store object URL
  const fetchImageBlobs = async (picint: number, urls: string[]) => {
    const blobUrls: string[] = [];
    for (const url of urls) {
      const cleanedUrl = (() => {
        if (/^https?:\/\//i.test(url)) return url;
        const normalized = url.replace(/^\/+/, "");
        return `${API_BASEImage}/${normalized}`;
      })();
      try {
        console.log("[fetchImageBlobs] Fetching blob for picint", picint, "url:", cleanedUrl);
        const resp = await fetch(cleanedUrl, { method: "GET" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        blobUrls.push(blobUrl);
      } catch (err) {
        console.error("[fetchImageBlobs] Error fetching blob for picint", picint, "url:", cleanedUrl, err);
      }
    }
    setImageBlobUrls((prev) => ({ ...prev, [picint]: blobUrls }));
    console.log("[fetchImageBlobs] Set blob URLs for picint", picint, blobUrls);
    return blobUrls;
  };

  // Fetch blobs for protected images when imageUrls changes
  useEffect(() => {
    Object.entries(imageUrls).forEach(([picint, urls]) => {
      if (urls.length > 0 && !imageBlobUrls[picint]) {
        fetchImageBlobs(Number(picint), urls);
      }
    });
    // eslint-disable-next-line
  }, [imageUrls]);

  // Cleanup blob URLs on unmount or when imageBlobUrls changes
  useEffect(() => {
    return () => {
      Object.values(imageBlobUrls)
        .flat()
        .forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageBlobUrls]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchRevenueData = React.useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    if (!selectedCustomer?.id_client) {
      setRevenueData([]);
      return;
    }
    try {
      const res = await axios.get(`${apiUrlRevenue}/allClient`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          ps,
          id_client: selectedCustomer.id_client,
          is_watches: type === "watch" || type === "all" ? 1 : 1,
        },
      });
      let revenueArray = Array.isArray(res.data) ? res.data : [];
      if (currency !== "all") {
        revenueArray = revenueArray.filter((row) => row.currency === currency);
      }
      setRevenueData(revenueArray);
    } catch (err) {
      setRevenueData([]);
    }
  }, [ps, selectedCustomer, type, currency]);

  useEffect(() => {
    setLoading(true);
    setErrorMsg(null);
    if (!selectedCustomer || !selectedCustomer.id_client) {
      setData([]);
      setLoading(false);
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) return;
    // Only fetch invoices for selected customer
    axios
      .get(`/invoices/allDetailsPC`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          ps: ps,
          ...(type !== "all" ? { type } : {}),
          ...(isChira !== "all" ? { is_chira: isChira === "yes" ? 1 : 0 } : {}),
          ...(isWholeSale !== "all"
            ? { is_whole_sale: isWholeSale === "yes" ? 1 : 0 }
            : {}),
          from: periodFrom || undefined,
          to: periodTo || undefined,
          ...(selectedCustomer && selectedCustomer.id_client
            ? { client: selectedCustomer.id_client }
            : {}),
        },
      })
      .then((res) => {
        // Detect if response is HTML (not JSON)
        if (
          typeof res.data === "string" &&
          res.data.trim().startsWith("<!DOCTYPE html")
        ) {
          setErrorMsg(
            "Server returned an HTML page instead of data. This may indicate a backend error, downtime, or invalid API endpoint."
          );
          setData([]);
          return;
        }
        let result = Array.isArray(res.data) ? res.data : [];
        // Do NOT filter by row.currency for invoices. Filtering is handled in filterInvoicesByCurrency below.
        setData(result);
      })
      .catch((err) => {
        setErrorMsg(
          "Failed to fetch data from server. Please check your connection or contact support."
        );
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [
    type,
    periodFrom,
    periodTo,
    ps,
    isChira,
    isWholeSale,
    selectedCustomer,
    currency,
  ]);

  const [revenueData, setRevenueData] = useState<any[]>([]);

  // Fetch revenue data

  // Fetch both invoices and revenue on filter change
  useEffect(() => {
    fetchRevenueData();
    setLoading(true);
    setErrorMsg(null);
    if (!selectedCustomer || !selectedCustomer.id_client) {
      setData([]);
      setLoading(false);
      return;
    }
    const token = localStorage.getItem("token");
    axios
      .get(`/invoices/allDetailsPC`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          ps: ps,
          ...(type !== "all" ? { type } : {}),
          ...(isChira !== "all" ? { is_chira: isChira === "yes" ? 1 : 0 } : {}),
          ...(isWholeSale !== "all"
            ? { is_whole_sale: isWholeSale === "yes" ? 1 : 0 }
            : {}),
          from: periodFrom || undefined,
          to: periodTo || undefined,
          ...(selectedCustomer && selectedCustomer.id_client
            ? { client: selectedCustomer.id_client }
            : {}),
        },
      })
      .then((res) => {
        // Detect if response is HTML (not JSON)
        if (
          typeof res.data === "string" &&
          res.data.trim().startsWith("<!DOCTYPE html")
        ) {
          setErrorMsg(
            "Server returned an HTML page instead of data. This may indicate a backend error, downtime, or invalid API endpoint."
          );
          setData([]);
          return;
        }
        let result = Array.isArray(res.data) ? res.data : [];

        setData(result);
      })
      .catch((err) => {
        setErrorMsg(
          "Failed to fetch data from server. Please check your connection or contact support."
        );
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [
    type,
    periodFrom,
    periodTo,
    ps,
    isChira,
    isWholeSale,
    selectedCustomer,
    currency,
  ]);

  // Defensive: ensure data is always an array
  const safeData = Array.isArray(data) ? data : [];

  // Calculate total weight in gram (sum of qty for all rows)

  // Calculate total invoice amounts by type (sum max per invoice)

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

  // Fetch watch details (OriginalAchatWatches) for watch invoices using invoice picint
  useEffect(() => {
    const fetchWatchDetails = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      // Only consider invoices where supplier type is watch
      const watchRows = (safeData || []).filter((row: any) => {
        const t = String(
          row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || ""
        ).toLowerCase();
        return t.includes("watch");
      });

      const ids = Array.from(
        new Set(
          watchRows
            .map((row: any) => row.picint)
            .filter(
              (id: any) => id && watchDetailsMap[String(id)] === undefined
            )
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
            next[String(id)] = Array.isArray(res.data)
              ? res.data[0]
              : res.data;
          } catch {
            next[String(id)] = null;
          }
        })
      );
      if (Object.keys(next).length > 0) {
        setWatchDetailsMap((prev) => ({ ...prev, ...next }));
      }
    };

    if (safeData && safeData.length > 0) {
      fetchWatchDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeData, watchDetailsMap]);

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
        const typeSupplier: string = achat.Fournisseur?.TYPE_SUPPLIER || "";
        const typeLower = typeSupplier.toLowerCase();

        // For watch items: prefer model from OriginalAchatWatches (via invoice picint),
        // then DistributionPurchase/OriginalAchatWatch, then ACHAT.Model/model.
        // For non-watch items keep Design_art/design.
        const invoicePicint = row.picint;
        const watchDetails =
          (invoicePicint !== undefined && invoicePicint !== null
            ? watchDetailsMap[String(invoicePicint)]
            : undefined) || undefined;

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

        let design: string;
        if (typeLower.includes("watch")) {
          const modelVal: string =
            (watchDetails?.model as string | undefined) ||
            (watchDetails?.Model as string | undefined) ||
            (watch?.model as string | undefined) ||
            (watch?.Model as string | undefined) ||
            (achat.Model as string | undefined) ||
            (achat.model as string | undefined) ||
            "";
          const serialVal: string =
            (watchDetails?.serial_number as string | undefined) ||
            (watch?.serial_number as string | undefined) ||
            (achat.serial_number as string | undefined) ||
            "";

          design = serialVal
            ? `${modelVal} | SN: ${serialVal}`.trim()
            : (modelVal || "");
        } else {
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
        // Prefer achat.picint/id_achat, fall back to invoice-level picint
        const picint =
          achat.picint || achat.id_achat || row.picint || "";

        const IS_GIFT = row.IS_GIFT || "";
        invoiceMap.get(numFact)._productDetails.push({
          design,
          weight,
          code,
          typeSupplier,
          picint, // Add picint to product details
          IS_GIFT,
        });
      });
    });
    return Array.from(invoiceMap.values());
  }

  // Filter invoices by selected currency (for invoice rows only, based on paid amount)
  function filterInvoicesByCurrency(invoices: any[], selectedCurrency: string) {
    if (selectedCurrency === "all") return invoices;
    if (selectedCurrency === "LYD") {
      return invoices.filter((inv) => Number(inv.amount_lyd) > 0);
    } else if (selectedCurrency === "USD") {
      return invoices.filter((inv) => Number(inv.amount_currency) > 0);
    } else if (selectedCurrency === "EUR") {
      return invoices.filter((inv) => Number(inv.amount_EUR) > 0);
    }
    return invoices;
  }

  // Apply currency filter only to invoice rows (must have ACHATs and num_fact), not revenue (credit)
  // Enforce product type filter client-side for invoice rows
  const typedInvoices = safeData.filter(
    (row) => Array.isArray(row.ACHATs) && row.ACHATs.length > 0 && row.num_fact
  ).filter((row) => {
    if (type === "all") return true;
    const raw = row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || "";
    const t = String(raw).toLowerCase();
    if (type === "gold") return t.includes("gold");
    if (type === "diamond") return t.includes("diamond");
    if (type === "watch") return t.includes("watch");
    return true;
  });
  const invoiceRows = filterInvoicesByCurrency(typedInvoices, currency);
  // Revenue rows: must NOT have ACHATs and must NOT have num_fact
  const revenueRows = safeData.filter(
    (row) => (!row.ACHATs || row.ACHATs.length === 0) && !row.num_fact
  );
  const mergedData = mergeRowsByInvoice(invoiceRows).concat(revenueRows);
  const sortedData = [...mergedData].sort((a, b) => {
    const dateA = new Date(a.date_fact || a.date).getTime();
    const dateB = new Date(b.date_fact || b.date).getTime();
    return dateB - dateA;
  });
  // Debug: log sortedData and _productDetails

  // Fetch images for all invoices in sortedData when data changes
  useEffect(() => {
    const picints: Set<number> = new Set();
    data.forEach((row: any) => {
      const supplierType = row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER;
      if (row.picint && !imageUrls[row.picint]) {
        picints.add(row.picint);
      }
      if (row.ACHATs) {
        row.ACHATs.forEach((achat: any) => {
          const p = achat?.picint || achat?.id_achat;
          if (p && !imageUrls[p]) {
            fetchImages(String(p), achat?.Fournisseur?.TYPE_SUPPLIER || supplierType);
          }
        });
      }
    });

    Array.from(picints).forEach((picint) => {
      const supplierType = data.find((row: any) => row.picint === picint)?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER;
      fetchImages(String(picint), supplierType);
    });
    // eslint-disable-next-line
  }, [sortedData]);

  // Fetch images for all product-level picints in sortedData when data changes
  useEffect(() => {
    const allPicints: Set<string> = new Set();
    sortedData.forEach((row: any) => {
      if (Array.isArray(row._productDetails)) {
        row._productDetails.forEach((d: any) => {
          const picint = d.picint;
          if (picint && !imageUrls[picint]) {
            allPicints.add(`${picint}:::${d.typeSupplier || ""}`);
          }
        });
      }
    });
    Array.from(allPicints).forEach((combo) => {
      const [picint, typeSupplier] = combo.split(":::");
      fetchImages(picint, typeSupplier || undefined);
    });
    // eslint-disable-next-line
  }, [sortedData, imageUrls]);

  // Explicit column definitions for full control

  // Helper to build PrintInvoiceDialog data (mimic GNew_I)
  function buildPrintDialogData(invoice: any) {
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
    const amount_currency_LYD = Number(invoice.amount_currency_LYD) || 0;
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
        invoice?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase() || "",
      picint: invoice.picint,
      Original_Invoice: invoice.Original_Invoice || "",
      remise: invoice.remise,
      remise_per: invoice.remise_per,
    };
  }

  // --- Export Table to Excel with embedded images ---
  async function exportTableToExcel() {
    try {
      if (!rowsWithBalance.length) {
        console.warn("No data to export");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "CustomersReports";
      workbook.created = new Date();
      const sheet = workbook.addWorksheet("Customer Statement");
      const imageColumnKeys = ["img1", "img2", "img3", "img4"];

      sheet.columns = [
        { header: "Type", key: "type", width: 16 },
        { header: "Date", key: "date", width: 16 },
        { header: "Reference", key: "reference", width: 18 },
        { header: "Point of Sale", key: "pos", width: 18 },
        { header: "Amounts", key: "amounts", width: 40 },
        { header: "Balance (LYD)", key: "balanceLyd", width: 20 },
        { header: "Balance (USD)", key: "balanceUsd", width: 20 },
        { header: "Balance (EUR)", key: "balanceEur", width: 20 },
        { header: "Description / Details", key: "details", width: 45 },
        ...imageColumnKeys.map((key, index) => ({
          header: `Image ${index + 1}`,
          key,
          width: 18,
        })),
      ];

      const firstImageColumnIndex = sheet.columns.length - imageColumnKeys.length + 1;

      sheet.getRow(1).eachCell((cell: any) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1976D2" },
        };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      });

      const isTruthy = (value: any) =>
        value === true || value === 1 || value === "1" || value === "true";

      const buildAmountsBlock = (row: any) => {
        if (row.id === "opening-balance") return "";
        const chunks: string[] = [];
        if (row.statementType === "debit") {
          const totalRemiseFinal = row.total_remise_final ?? "";
          const amountCurrency = row.amount_currency ?? "";
          const amountLyd = row.amount_lyd ?? "";
          const amountEur = row.amount_EUR ?? "";
          const amountCurrencyLyd = row.amount_currency_LYD ?? "";
          const amountEurLyd = row.amount_EUR_LYD ?? "";
          const remise = row.remise ?? 0;
          const remise_per = row.remise_per ?? 0;
          let savedTotal = totalRemiseFinal;
          if (remise > 0) savedTotal = Number(totalRemiseFinal) - Number(remise);
          else if (remise_per > 0)
            savedTotal =
              Number(totalRemiseFinal) -
              (Number(totalRemiseFinal) * Number(remise_per)) / 100;

          if (totalRemiseFinal !== 0) {
            const isGold = row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes("gold");
            chunks.push(
              `Total Invoice: ${formatNumber(totalRemiseFinal)} ${isGold ? "LYD" : "USD"}`
            );
          }
          if (remise > 0) {
            chunks.push(`Discount Value: ${formatNumber(remise)}`);
          }
          if (remise_per > 0) {
            chunks.push(`Discount %: ${formatNumber(remise_per)}`);
          }
          if (remise > 0 || remise_per > 0) {
            const isGold = row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes("gold");
            chunks.push(
              `Saved Total: ${formatNumber(savedTotal)} ${isGold ? "LYD" : "USD"}`
            );
          }
          if (amountLyd !== 0) chunks.push(`LYD Paid: ${formatNumber(amountLyd)}`);
          if (amountCurrency !== 0) {
            let line = `USD Paid: ${formatNumber(amountCurrency)}`;
            if (amountCurrencyLyd !== 0) {
              line += ` (Equiv. LYD: ${formatNumber(amountCurrencyLyd)})`;
            }
            chunks.push(line);
          }
          if (amountEur !== 0) {
            let line = `EUR Paid: ${formatNumber(amountEur)}`;
            if (amountEurLyd !== 0) {
              line += ` (Equiv. LYD: ${formatNumber(amountEurLyd)})`;
            }
            chunks.push(line);
          }
        } else if (row.statementType === "credit") {
          const montantCurrency = row.montant_currency ?? "";
          const montant = row.montant ?? "";
          if (montantCurrency !== 0) {
            chunks.push(`Amount: ${formatNumber(montantCurrency)} ${row.currency || ""}`);
          }
          if (montant !== 0) {
            chunks.push(`Amount (LYD): ${formatNumber(montant)} LYD`);
          }
        }
        return chunks.join("\n");
      };

      const buildDetailsBlock = (row: any) => {
        if (row.id === "opening-balance") return "Opening Balance";
        if (row.statementType === "debit") {
          if (!row._productDetails || row._productDetails.length === 0) return "";
          return row._productDetails
            .map((d: any) => {
              const giftMark = d.IS_GIFT ? " (Gift)" : "";
              return `${d.code || ""} ${d.design || ""} (${d.typeSupplier || ""})${giftMark}`.trim();
            })
            .join("\n");
        }
        const blocks: string[] = [];
        if (row.id_acc_cli) blocks.push(`Revenue ID: ${row.id_acc_cli}`);
        if (row.comment) blocks.push(`Comment: ${row.comment}`);
        if (row.currency) blocks.push(`Currency: ${row.currency}`);
        return blocks.join("\n");
      };

      const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
        const bytes = new Uint8Array(buffer);
        const chunkSize = 0x8000;
        let binary = "";
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(
            ...Array.from(bytes.subarray(i, i + chunkSize))
          );
        }
        return btoa(binary);
      };

      const blobUrlToBase64 = async (blobUrl: string) => {
        try {
          const resp = await fetch(blobUrl);
          if (!resp.ok) return null;
          const blob = await resp.blob();
          const base64 = arrayBufferToBase64(await blob.arrayBuffer());
          let ext: string = "png";
          if (/jpeg|jpg/i.test(blob.type)) ext = "jpeg";
          else if (/gif/i.test(blob.type)) ext = "gif";
          return { base64, ext };
        } catch (err) {
          console.error("Failed to convert blob URL to base64", err);
          return null;
        }
      };

      const picintBase64Cache = new Map<string, { base64: string; ext: string }[]>();

      const getImagesForPicint = async (picint: string) => {
        if (picintBase64Cache.has(picint)) return picintBase64Cache.get(picint)!;

        let blobSources = imageBlobUrls[picint];
        if ((!blobSources || blobSources.length === 0) && imageUrls[picint]?.length) {
          blobSources = await fetchImageBlobs(Number(picint), imageUrls[picint])
            .catch(() => [] as string[]);
        }

        const converted: { base64: string; ext: string }[] = [];
        if (blobSources && blobSources.length) {
          for (const blobUrl of blobSources) {
            const base64Result = await blobUrlToBase64(blobUrl);
            if (base64Result?.base64) converted.push(base64Result);
          }
        }
        picintBase64Cache.set(picint, converted);
        return converted;
      };

      const MAX_IMAGES_PER_ROW = imageColumnKeys.length;

      for (const row of rowsWithBalance) {
        const isOpening = row.id === "opening-balance";
        const isChiraFlag = isTruthy(row.is_chira ?? row.IS_CHIRA);
        const isWholeSaleFlag = isTruthy(row.is_whole_sale ?? row.IS_WHOLE_SALE);

        let typeLabel = row.type || "";
        if (row.statementType === "credit") typeLabel = "Revenue";
        else if (row.statementType === "debit") {
          if (isChiraFlag) typeLabel = "Chira";
          else if (isWholeSaleFlag) typeLabel = "WholeSale";
          else typeLabel = "Invoice";
        } else if (isOpening) {
          typeLabel = "Opening Balance";
        }

        const excelRow = sheet.addRow({
          type: typeLabel,
          date: row.date || "",
          reference: row.num_fact || row.id_acc_cli || (isOpening ? "Opening" : ""),
          pos: row.ps || "",
          amounts: buildAmountsBlock(row),
          balanceLyd: row.balance_lyd == null ? "" : `${formatNumber(row.balance_lyd)} LYD`,
          balanceUsd: row.balance_usd == null ? "" : `${formatNumber(row.balance_usd)} USD`,
          balanceEur: row.balance_eur == null ? "" : `${formatNumber(row.balance_eur)} EUR`,
          details: buildDetailsBlock(row),
        });

        excelRow.getCell(5).alignment = { wrapText: true, vertical: "top" } as any;
        excelRow.getCell(9).alignment = { wrapText: true, vertical: "top" } as any;

        const rowNumber = excelRow.number;
        sheet.getRow(rowNumber).height = 30;

        if (row.statementType === "debit" && Array.isArray(row._productDetails)) {
          const imagesForRow: { base64: string; ext: string }[] = [];
          for (const detail of row._productDetails) {
            if (!detail?.picint) continue;
            const base64List = await getImagesForPicint(String(detail.picint));
            for (const img of base64List) {
              imagesForRow.push(img);
              if (imagesForRow.length >= MAX_IMAGES_PER_ROW) break;
            }
            if (imagesForRow.length >= MAX_IMAGES_PER_ROW) break;
          }

          if (imagesForRow.length) {
            sheet.getRow(rowNumber).height = 100;
            imagesForRow.forEach((img, index) => {
              try {
                const colIndex = firstImageColumnIndex + index;
                if (colIndex <= 0) return;
                const imageId = workbook.addImage({
                  base64: img.base64,
                  extension: (img.ext as any) || "png",
                });
                sheet.addImage(imageId, {
                  tl: { col: colIndex - 1, row: rowNumber - 1 },
                  ext: { width: 90, height: 90 },
                });
              } catch (err) {
                console.error("Failed to embed image", err);
              }
            });
          }
        }
      }

      const customerName = (selectedCustomer?.client_name || "All").replace(/[\\/:*?"<>|]/g, "_");
      const filename = `CustomerStatement_${customerName}_${periodFrom}_${periodTo}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 0);
    } catch (error) {
      console.error("Failed to export statement to Excel", error);
    }
  }

  // State for image dialog
  const [imageDialogOpen, setImageDialogOpen] = React.useState(false);
  const [imageDialogUrl, setImageDialogUrl] = React.useState<string | null>(
    null
  );

  // --- Merge invoices and revenue for statement, add opening balance and running balance ---
  // Calculate opening balance (all transactions before periodFrom)
  const allStatementRows = [
    // Invoices as debit
    ...sortedData.map((inv) => {
      // Calculate Saved Total (after discount)
      const totalRemiseFinal = inv.amount_lyd ?? 0;
      const savedTotal = totalRemiseFinal;
      return {
        ...inv,
        statementType: "debit",
        date: inv.date_fact,
        debit: savedTotal, // Use saved total (after discount)
        credit: null,
        debit_lyd: savedTotal, // Use saved total for LYD as well
        credit_lyd: null,
        debit_usd: inv.amount_currency ?? 0,
        credit_usd: null,
        debit_eur: inv.amount_EUR ?? 0,
        credit_eur: null,
        description: `Invoice #${inv.num_fact}`,
      };
    }),
    // Revenue as credit
    ...revenueData.map((rev) => {
      // Determine which currency the revenue is in
      let credit_lyd = null,
        credit_usd = null,
        credit_eur = null;
      if (rev.currency === "LYD") {
        credit_lyd = rev.montant ?? 0;
      } else if (rev.currency === "USD") {
        credit_usd = rev.montant_currency ?? 0;
      } else if (rev.currency === "EUR") {
        credit_eur = rev.montant_currency ?? 0;
      }
      return {
        ...rev,
        statementType: "credit",
        date: rev.date,
        debit: null,
        credit: rev.montant, // for legacy
        debit_lyd: null,
        credit_lyd,
        debit_usd: null,
        credit_usd,
        debit_eur: null,
        credit_eur,
        description: rev.comment || "Revenue",
      };
    }),
  ];
  // Sort by date ascending
  allStatementRows.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateA - dateB;
  });
  // Opening balance: sum all before periodFrom
  const openingRows = allStatementRows.filter(
    (r) => new Date(r.date) < new Date(periodFrom)
  );
  // Opening balance for LYD: only LYD transactions
  const openingBalance = openingRows.reduce((sum, r) => {
    // For invoices (debit), only add LYD debit
    if (r.statementType === "debit" && r.debit_lyd) {
      return sum + r.debit_lyd;
    }
    // For revenue (credit), only subtract LYD credit
    if (r.statementType === "credit" && r.credit_lyd) {
      return sum - r.credit_lyd;
    }
    return sum;
  }, 0);
  // Opening balance for USD: only USD transactions
  const openingBalanceUsd = openingRows.reduce((sum, r) => {
    if (r.statementType === "debit" && r.debit_usd) {
      return sum + r.debit_usd;
    }
    if (r.statementType === "credit" && r.credit_usd) {
      return sum - r.credit_usd;
    }
    return sum;
  }, 0);
  // Opening balance for EUR: only EUR transactions
  const openingBalanceEur = openingRows.reduce((sum, r) => {
    if (r.statementType === "debit" && r.debit_eur) {
      return sum + r.debit_eur;
    }
    if (r.statementType === "credit" && r.credit_eur) {
      return sum - r.credit_eur;
    }
    return sum;
  }, 0);
  // Main period rows
  const mainRows = allStatementRows.filter(
    (r) =>
      new Date(r.date) >= new Date(periodFrom) &&
      new Date(r.date) <= new Date(periodTo)
  );
  // Running balances
  let runningBalance = openingBalance;
  let runningBalanceUsd = openingBalanceUsd;
  let runningBalanceEur = openingBalanceEur;
  let runningBalanceLyd = openingBalance; // Separate LYD running balance
  const rowsWithBalance = [
    {
      id: "opening-balance",
      type: "Opening Balance",
      date: periodFrom,
      description: "Opening Balance",
      debit: "",
      credit: "",
      balance: openingBalance,
      balance_lyd: openingBalance,
      balance_usd: openingBalanceUsd,
      balance_eur: openingBalanceEur,
    },
    ...mainRows.map((row, idx) => {
      let nextBalance = runningBalance + (row.debit || 0) - (row.credit || 0);
      let nextBalanceUsd = runningBalanceUsd;
      let nextBalanceEur = runningBalanceEur;
      let nextBalanceLyd = runningBalanceLyd;

      if (row.statementType === "debit") {
        nextBalanceUsd = runningBalanceUsd + (row.debit_usd || 0);
        nextBalanceEur = runningBalanceEur + (row.debit_eur || 0);
        nextBalanceLyd = runningBalanceLyd + (row.debit_lyd || 0);
      } else if (row.statementType === "credit") {
        // USD
        if (row.currency === "USD") {
          nextBalanceUsd = runningBalanceUsd - (row.credit_usd || 0);
        }
        // EUR
        if (row.currency === "EUR") {
          nextBalanceEur = runningBalanceEur - (row.credit_eur || 0);
        }
        // LYD
        if (row.currency === "LYD") {
          nextBalanceLyd = runningBalanceLyd - (row.credit_lyd || 0);
        }
      }
      runningBalance = nextBalance;
      runningBalanceUsd = nextBalanceUsd;
      runningBalanceEur = nextBalanceEur;
      runningBalanceLyd = nextBalanceLyd;
      return {
        ...row,
        balance: runningBalanceLyd,
        balance_lyd: runningBalanceLyd,
        balance_usd: runningBalanceUsd,
        balance_eur: runningBalanceEur,
      };
    }),
  ];

  // State to control visibility of balance columns
  const [showBalanceLyd, setShowBalanceLyd] = useState(true);
  const [showBalanceUsd, setShowBalanceUsd] = useState(true);
  const [showBalanceEur, setShowBalanceEur] = useState(true);

  // Columns for statement table
  const statementColumns: MRT_ColumnDef<any>[] = [
    {
      header: "Type / Date / Ref",
      id: "type_date_ref",
      size: 180,
      Cell: ({ row }) => {
        const isOpening = row.original.id === "opening-balance";
        const isTruthy = (value: any) =>
          value === true || value === 1 || value === "1" || value === "true";
        const isChiraFlag = isTruthy(
          row.original.is_chira ?? row.original.IS_CHIRA
        );
        const isWholeSaleFlag = isTruthy(
          row.original.is_whole_sale ?? row.original.IS_WHOLE_SALE
        );

        let type = row.original.type || "";
        if (row.original.statementType === "credit") {
          type = "Revenue";
        } else if (row.original.statementType === "debit") {
          if (isChiraFlag) type = "Chira";
          else if (isWholeSaleFlag) type = "WholeSale";
          else type = "Invoice";
        } else if (isOpening) {
          type = "Opening Balance";
        }
        const date = row.original.date;
        const ref = row.original.num_fact || row.original.id_acc_cli || "";
        const psVal = row.original.ps || "";
        return (
          <Box
            sx={{
              whiteSpace: "pre-line",
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
            }}
          >
            <span style={{ fontWeight: 500 }}>
              <span style={{ color: "#888", fontSize: 12 }}>Type:</span> {type}
            </span>
            <span style={{ fontWeight: 500 }}>
              <span style={{ color: "#888", fontSize: 12 }}>Date:</span> {date}
            </span>
            {!isOpening && (
              <span style={{ fontWeight: 500 }}>
                <span style={{ color: "#888", fontSize: 12 }}>Ref:</span> {ref}
              </span>
            )}
            {!isOpening && (
              <span style={{ fontWeight: 500 }}>
                <span style={{ color: "#888", fontSize: 12 }}>
                  Point of Sale:
                </span>{" "}
                {psVal}
              </span>
            )}
          </Box>
        );
      },
    },

    {
      header: "Account (Debit)",
      id: "debit_account",
      size: 160,
      Cell: ({ row }) => {
        const debit = row.original.DebitAccount;
        if (!debit)
          return (
            row.original.id !== "opening-balance" && (
              <>
                <Box
                  sx={{
                    whiteSpace: "pre-line",
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                  }}
                >
                  <div>
                    <b>Account:</b> {"[AR]"}
                  </div>
                  <div>
                    <b>Account Name:</b> {"Account Receivable"}
                  </div>
                </Box>
              </>
            )
          );

        return (
          <Box
            sx={{
              whiteSpace: "pre-line",
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
            }}
          >
            <div>
              <b>Account:</b> {debit.Acc_No || ""}
            </div>
            <div>
              <b>Account Name:</b> {debit.Name_M || ""}
            </div>
          </Box>
        );
      },
    },
    {
      header: "Account (Credit)",
      id: "credit_account",
      size: 160,
      Cell: ({ row }) => {
        const credit = row.original.CreditAccount;
        if (!credit)
          return (
            row.original.id !== "opening-balance" && (
              <>
                <Box
                  sx={{
                    whiteSpace: "pre-line",
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                  }}
                >
                  <div>
                    <b>Account:</b> {"[SR]"}
                  </div>
                  <div>
                    <b>Account Name:</b> {"Sales Revenue"}
                  </div>
                </Box>
              </>
            )
          );
        return (
          <Box
            sx={{
              whiteSpace: "pre-line",
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
            }}
          >
            <div>
              <b>Account:</b> {credit.Acc_No || ""}
            </div>
            <div>
              <b>Account Name:</b> {credit.Name_M || ""}
            </div>
          </Box>
        );
      },
    },

    {
      header: "Amounts",
      id: "debit_credit",
      size: 300,
      Cell: ({ row }) => {
        if (row.original.id === "opening-balance") return "";
        // For invoice (debit) rows, show the full invoice breakdown block
        if (row.original.statementType === "debit") {
          const totalRemiseFinal = row.original.total_remise_final ?? "";
          const amountCurrency = row.original.amount_currency ?? "";
          const amountLyd = row.original.amount_lyd ?? "";
          const amountEur = row.original.amount_EUR ?? "";
          const amountCurrencyLyd = row.original.amount_currency_LYD ?? "";
          const amountEurLyd = row.original.amount_EUR_LYD ?? "";
          const remise = row.original.remise ?? 0;
          const remise_per = row.original.remise_per ?? 0;
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
          // Calculate Saved Total
          let savedTotal = totalRemiseFinal;
          if (remise > 0) {
            savedTotal = Number(totalRemiseFinal) - Number(remise);
          } else if (remise_per > 0) {
            savedTotal =
              Number(totalRemiseFinal) -
              (Number(totalRemiseFinal) * Number(remise_per)) / 100;
          }
          return (
            <div style={{ whiteSpace: "pre-line", fontSize: 12 }}>
              {totalRemiseFinal !== 0 && (
                <div>
                  <span style={{ fontWeight: "bold", color: "#1976d2" }}>
                    Total Invoice:
                  </span>
                  <span style={{ marginLeft: 6 }}>
                    {row.original?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes(
                      "gold"
                    )
                      ? `${formatNumber(totalRemiseFinal)} LYD`
                      : `${formatNumber(totalRemiseFinal)} USD`}
                  </span>
                  {/* Price/g for gold only */}
                  {row.original?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes(
                    "gold"
                  ) &&
                    (() => {
                      const qty = Number(row.original?.ACHATs?.[0]?.qty);
                      const total = Number(row.original.total_remise_final);
                      if (
                        !isNaN(qty) &&
                        qty > 0 &&
                        !isNaN(total) &&
                        total > 0
                      ) {
                        return (
                          <span
                            style={{
                              marginLeft: 12,
                              color: "#388e3c",
                              fontWeight: "bold",
                            }}
                          >
                            Price/g: {formatNumber(total / qty)}
                          </span>
                        );
                      }
                      return null;
                    })()}
                </div>
              )}

              {/* Discount Value */}
              {remise > 0 && (
                <div>
                  <span style={{ fontWeight: "bold", color: "#d32f2f" }}>
                    Discount Value:
                  </span>
                  <span style={{ marginLeft: 6, color: "#d32f2f" }}>
                    {formatNumber(remise)}
                  </span>
                </div>
              )}
              {/* Discount Percentage */}
              {remise_per > 0 && (
                <div>
                  <span style={{ fontWeight: "bold", color: "#d32f2f" }}>
                    Discount %:
                  </span>
                  <span style={{ marginLeft: 6, color: "#d32f2f" }}>
                    {formatNumber(remise_per)}
                  </span>
                </div>
              )}

              {/* Saved Total */}
              {(remise > 0 || remise_per > 0) && (
                <div>
                  <span style={{ fontWeight: "bold", color: "#388e3c" }}>
                    Saved Total:
                  </span>
                  <span style={{ marginLeft: 6 }}>
                    {row.original?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase().includes(
                      "gold"
                    )
                      ? `${formatNumber(savedTotal)} LYD`
                      : `${formatNumber(savedTotal)} USD`}
                  </span>
                </div>
              )}

              {amountLyd !== 0 && (
                <div>
                  <span style={{ fontWeight: "bold", color: "#555" }}>
                    LYD paid:
                  </span>
                  <span style={{ marginLeft: 6 }}>
                    {formatNumber(amountLyd)}
                  </span>
                </div>
              )}
              {amountCurrency !== 0 && (
                <div>
                  <span style={{ fontWeight: "bold", color: "#555" }}>
                    USD paid:
                  </span>
                  <span style={{ marginLeft: 6 }}>
                    {formatNumber(amountCurrency)}
                  </span>
                  {amountCurrencyLyd !== 0 && (
                    <>
                      <span
                        style={{
                          fontWeight: "bold",
                          color: "#888",
                          marginLeft: 12,
                        }}
                      >
                        Equi. in LYD:
                      </span>
                      <span style={{ marginLeft: 6 }}>
                        {formatNumber(amountCurrencyLyd)}
                      </span>
                    </>
                  )}
                </div>
              )}
              {amountEur !== 0 && (
                <div>
                  <span style={{ fontWeight: "bold", color: "#555" }}>
                    EUR Paid:
                  </span>
                  <span style={{ marginLeft: 6 }}>
                    {formatNumber(amountEur)}
                  </span>
                  {amountEurLyd !== 0 && (
                    <>
                      <span
                        style={{
                          fontWeight: "bold",
                          color: "#888",
                          marginLeft: 12,
                        }}
                      >
                        Equi. in LYD:
                      </span>
                      <span style={{ marginLeft: 6 }}>
                        {formatNumber(amountEurLyd)}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        }
        // For revenue (credit) rows, keep as before
        if (row.original.statementType === "credit") {
          const montantCurrency = row.original.montant_currency ?? "";
          const montant = row.original.montant ?? "";
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
          return (
            <div style={{ whiteSpace: "pre-line", fontSize: 12 }}>
              {montantCurrency !== 0 && (
                <div>
                  <span style={{ fontWeight: "bold", color: "#1976d2" }}>
                    Amount:
                  </span>
                  <span style={{ marginLeft: 6 }}>
                    {formatNumber(montantCurrency)} {row.original.currency}
                  </span>
                </div>
              )}
              {montant !== 0 && (
                <div>
                  <span style={{ fontWeight: "bold", color: "#1976d2" }}>
                    Amount (LYD):
                  </span>
                  <span style={{ marginLeft: 6 }}>
                    {formatNumber(montant)} LYD
                  </span>
                </div>
              )}
            </div>
          );
        }
        return null;
      },
    },
    // Conditionally render Balance LYD
    ...(showBalanceLyd
      ? [
          {
            accessorKey: "balance",
            header: "Balance LYD",
            size: 160,
            Cell: ({ row }: { row: any }) => (
              <span style={{ fontWeight: "bold", color: "#1976d2" }}>
                {formatNumber(row.original.balance)} LYD
              </span>
            ),
          },
        ]
      : []),
    // Conditionally render Balance USD
    ...(showBalanceUsd
      ? [
          {
            accessorKey: "balance_usd",
            header: "Balance (USD)",
            size: 160,
            Cell: ({ row }: { row: any }) => (
              <span style={{ fontWeight: "bold", color: "#1976d2" }}>
                {formatNumber(row.original.balance_usd)} USD
              </span>
            ),
          },
        ]
      : []),
    // Conditionally render Balance EUR
    ...(showBalanceEur
      ? [
          {
            accessorKey: "balance_eur",
            header: "Balance (EUR)",
            size: 160,
            Cell: ({ row }: { row: any }) => (
              <span style={{ fontWeight: "bold", color: "#1976d2" }}>
                {formatNumber(row.original.balance_eur)} EUR
              </span>
            ),
          },
        ]
      : []),

    {
      header: "Description / Details",
      id: "desc_details1",
      size: 250,
      Cell: ({ row }) => {
        if (row.original.id === "opening-balance")
          return <span style={{ fontWeight: 600 }}>Opening Balance</span>;
        if (row.original.statementType === "debit") {
          // Invoice details: show product details, and if IS_GIFT, show icon and label
          return (
            <Box
              sx={{
                whiteSpace: "pre-line",
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
              }}
            >
              {row.original._productDetails?.length === 0 ? (
                <span style={{ color: "#aaa" }}> </span>
              ) : (
                row.original._productDetails.map((d: any, idx: number) => {
                  const idart = `${d.code || ""} ${d.design || ""} (${d.typeSupplier || ""})`;
                  const isGift = d.IS_GIFT;

                  return (
                    <div
                      key={idx}
                      style={{
                        marginBottom: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span
                        style={
                          isGift ? { color: "orangered", fontWeight: 500 } : {}
                        }
                      >
                        {idart}
                      </span>
                      {isGift && (
                        <span
                          title="Gift Product"
                          style={{
                            color: "orangered",
                            fontSize: 18,
                            display: "inline-flex",
                            alignItems: "center",
                            marginLeft: 1,
                          }}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="orangered"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="2" y="7" width="20" height="14" rx="2" />
                            <path d="M16 3a2 2 0 0 1 0 4c-2 0-4-2-4-2s2 2 4 2a2 2 0 0 0 0-4zM8 3a2 2 0 0 0 0 4c2 0 4-2 4-2s-2 2-4 2a2 2 0 0 1 0-4z" />
                          </svg>
                          <span
                            style={{
                              marginLeft: 1,
                              fontWeight: 500,
                              fontSize: 13,
                            }}
                          >
                            {" "}
                            Gift
                          </span>
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </Box>
          );
        } else {
          // Revenue details
          return (
            <Box
              sx={{
                whiteSpace: "pre-line",
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
              }}
            >
              <div>
                <b>Revenue ID:</b> {row.original.id_acc_cli}
              </div>
              <div>
                <b>Comment:</b> {row.original.comment}
              </div>
            </Box>
          );
        }
      },
    },
    {
      header: "Images",
      id: "desc_details",
      size: 250,
      Cell: ({ row }) => {
        if (row.original.id === "opening-balance")
          return <span style={{ fontWeight: 600 }}>Opening Balance</span>;
        if (row.original.statementType === "debit") {
          // Invoice details: show product picints and images
          return (
            <Box>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: 16,
                  marginTop: 4,
                  flexWrap: "wrap",
                }}
              >
                {row.original._productDetails?.length === 0 ? (
                  <span style={{ color: "#aaa" }}>No Picint</span>
                ) : (
                  row.original._productDetails.map((d: any, idx: number) => {
                    const picint = d.picint;

                    const idart = `${d.code || ""} ${d.design || ""} (${d.typeSupplier || ""})`;

                    const blobSources =
                      picint && imageBlobUrls[picint]
                        ? imageBlobUrls[picint]
                        : undefined;
                    const urls =
                      blobSources && blobSources.length > 0
                        ? blobSources
                        : picint && imageUrls[picint]
                          ? imageUrls[picint]
                          : [];

                    return (
                      <Box>
                        <Box
                          sx={{
                            display: "inline-flex",
                            flexDirection: "row",
                            gap: 2,
                            mt: 0.5,
                          }}
                        >
                          {urls.length > 0 ? (
                            urls.map((url: string, j: number) => (
                              <img
                                title={idart}
                                key={j}
                                src={url}
                                alt="Product"
                                style={{
                                  width: 100,
                                  height: 100,
                                  objectFit: "cover",
                                  borderRadius: 8,
                                  border: "1px solid #eee",
                                  marginRight: 4,
                                }}
                                data-orig-src={url}
                                onError={(e) => handleImageError(e, d.typeSupplier)}
                              />
                            ))
                          ) : (
                            <span style={{ color: "#aaa", fontSize: 10 }}>
                              No Image
                            </span>
                          )}
                        </Box>
                      </Box>
                    );
                  })
                )}
              </div>
            </Box>
          );
        } else {
          // Revenue details
          return <Box></Box>;
        }
      },
    },
  ];

  return (
    <Box>
      <React.Fragment>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            mb: 2,
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Typography variant="h5" sx={{ mr: 2 }}>
            {MODEL_LABELS[type]} - Customer Reports
          </Typography>
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
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="currency-select-label">Currency</InputLabel>
            <Select
              labelId="currency-select-label"
              value={currency}
              label="Currency"
              onChange={(e) => {
                const val = e.target.value as "all" | "LYD" | "USD" | "EUR";
                setCurrency(val);
                if (val === "all") {
                  setShowBalanceLyd(true);
                  setShowBalanceUsd(true);
                  setShowBalanceEur(true);
                } else if (val === "LYD") {
                  setShowBalanceLyd(true);
                  setShowBalanceUsd(false);
                  setShowBalanceEur(false);
                } else if (val === "USD") {
                  setShowBalanceLyd(false);
                  setShowBalanceUsd(true);
                  setShowBalanceEur(false);
                } else if (val === "EUR") {
                  setShowBalanceLyd(false);
                  setShowBalanceUsd(false);
                  setShowBalanceEur(true);
                }
              }}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="LYD">LYD</MenuItem>
              <MenuItem value="USD">USD</MenuItem>
              <MenuItem value="EUR">EUR</MenuItem>
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
          <Autocomplete
            id="customer-select"
            sx={{ width: "25%" }}
            options={customers}
            autoHighlight
            getOptionLabel={(option: Client) =>
              `${option.client_name} (${option.tel_client || "No Phone"})`
            }
            size="small"
            value={selectedCustomer}
            onChange={(_, value) => setSelectedCustomer(value)}
            renderOption={(props: any, option: Client) => (
              <Box component="li" {...props} key={option.id_client}>
                <strong>{option.client_name}</strong> —{" "}
                <span style={{ color: "gray" }}>
                  {option.tel_client || "No Phone"}
                </span>
              </Box>
            )}
            renderInput={(params: any) => (
              <TextField {...params} label="Customer" required />
            )}
          />
          <Button
            variant="contained"
            color="secondary"
            sx={{ fontWeight: 600, boxShadow: 2 }}
            onClick={() => {
              // Refresh data for selected customer and filters
              setLoading(true);
              setErrorMsg(null);
              if (!selectedCustomer || !selectedCustomer.id_client) {
                setData([]);
                setLoading(false);
                return;
              }
              const token = localStorage.getItem("token");
              if (!token) return;
              axios
                .get(`/invoices/allDetailsPC`, {
                  headers: { Authorization: `Bearer ${token}` },
                  params: {
                    ps: ps,
                    ...(type !== "all" ? { type } : {}),
                    ...(isChira !== "all"
                      ? { is_chira: isChira === "yes" ? 1 : 0 }
                      : {}),
                    ...(isWholeSale !== "all"
                      ? { is_whole_sale: isWholeSale === "yes" ? 1 : 0 }
                      : {}),
                    from: periodFrom || undefined,
                    to: periodTo || undefined,
                    ...(selectedCustomer && selectedCustomer.id_client
                      ? { client: selectedCustomer.id_client }
                      : {}),
                  },
                })
                .then((res) => {
                  if (
                    typeof res.data === "string" &&
                    res.data.trim().startsWith("<!DOCTYPE html")
                  ) {
                    setErrorMsg(
                      "Server returned an HTML page instead of data. This may indicate a backend error, downtime, or invalid API endpoint."
                    );
                    setData([]);
                    return;
                  }
                  let result = Array.isArray(res.data) ? res.data : [];

                  setData(result);
                })
                .catch((err) => {
                  setErrorMsg(
                    "Failed to fetch data from server. Please check your connection or contact support."
                  );
                  setData([]);
                })
                .finally(() => setLoading(false));
              // Also refresh revenue data
              fetchRevenueData();
            }}
          >
            Preview Data
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="contained"
            color="info"
            sx={{ fontWeight: 600, boxShadow: 2 }}
            onClick={exportTableToExcel}
          >
            Export to Excel
          </Button>
        </Box>
        {/* Unified Statement Table */}
        <MaterialReactTable
          columns={statementColumns}
          data={rowsWithBalance}
          enableColumnResizing
          enableStickyHeader
          initialState={{
            pagination: { pageSize: 5, pageIndex: 0 },
            density: "compact",
          }}
          enableFilters={false}
          enableGlobalFilter={false}
          enableFullScreenToggle={false}
          muiTableBodyRowProps={({ row }) =>
            row.original.id === "opening-balance"
              ? { sx: { background: "#e3f2fd" } }
              : {}
          }
          muiTableProps={{ size: "small" }}
        />
        {/* Final balances summary below the table (show only relevant currency) */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            mt: 2,
            gap: 4,
            flexWrap: "wrap",
          }}
        >
          {(currency === "all" || currency === "LYD") && (
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: "bold",
                color:
                  rowsWithBalance.length > 0 &&
                  rowsWithBalance[rowsWithBalance.length - 1].balance_lyd > 0
                    ? "red"
                    : "inherit",
              }}
            >
              Final Balance (LYD):{" "}
              {rowsWithBalance.length > 0
                ? formatNumber(
                    rowsWithBalance[rowsWithBalance.length - 1].balance_lyd
                  )
                : "0.00"}{" "}
              LYD
            </Typography>
          )}
          {(currency === "all" || currency === "USD") && (
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: "bold",
                color:
                  rowsWithBalance.length > 0 &&
                  rowsWithBalance[rowsWithBalance.length - 1].balance_usd > 0
                    ? "red"
                    : "inherit",
              }}
            >
              Final Balance (USD):{" "}
              {rowsWithBalance.length > 0
                ? formatNumber(
                    rowsWithBalance[rowsWithBalance.length - 1].balance_usd
                  )
                : "0.00"}{" "}
              USD
            </Typography>
          )}
          {(currency === "all" || currency === "EUR") && (
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: "bold",
                color:
                  rowsWithBalance.length > 0 &&
                  rowsWithBalance[rowsWithBalance.length - 1].balance_eur > 0
                    ? "red"
                    : "inherit",
              }}
            >
              Final Balance (EUR):{" "}
              {rowsWithBalance.length > 0
                ? formatNumber(
                    rowsWithBalance[rowsWithBalance.length - 1].balance_eur
                  )
                : "0.00"}{" "}
              EUR
            </Typography>
          )}
        </Box>
        {detailsOpen && (
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
        )}
        {printDialogOpen && selectedInvoice && (
          <PrintInvoiceDialog
            open={printDialogOpen}
            invoice={selectedInvoice}
            data={buildPrintDialogData(selectedInvoice)}
            printRef={printRef}
            onClose={() => setPrintDialogOpen(false)}
            showCloseInvoiceActions={true}
            showCloseInvoice={
              selectedInvoice && selectedInvoice.IS_OK === false
            }
          />
        )}
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

export default CustomersReports;
