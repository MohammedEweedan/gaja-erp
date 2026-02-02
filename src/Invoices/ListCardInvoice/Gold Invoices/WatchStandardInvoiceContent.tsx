import React, { forwardRef, useEffect, useState, useMemo } from "react";
import { useCallback } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Divider,
  Chip,
} from "@mui/material";
import { Invoice, Client } from "./PrintInvoiceDialog";
import axios from "../../../api";

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

async function convertAvifUrlToPngBase64InBrowser(url: string, token?: string): Promise<string> {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(url, { mode: "cors", headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch AVIF image (${res.status})`);
  }
  const blob = await res.blob();
  return convertBlobToPngDataUrl(blob);
}

interface InvoicePrintData {
  invoice: Invoice;
  items: Invoice[];
  customer: Client | undefined;
  totalAmountLYD: number;
  totalAmountUSD: number;
  totalAmountEur: number;
  totalWeight: number;
  TotalAmountFinal: number;
  itemCount: number;
  amount_lyd?: number;
  amount_currency?: number;
  amount_EUR?: number;
  amount_currency_LYD: number;
  amount_EUR_LYD: number;
  picint: number;
  remise: number;
  remise_per: number;
}

export interface Props {
  data: InvoicePrintData;
  num_fact?: number; // Add num_fact as an optional prop
  showImage?: boolean; // Add showImage prop
  showGoldUnitPrices?: boolean;
  showDiscountValues?: boolean;
  showSurchargeValues?: boolean;
  createdBy?: string; // creator name passed from parent (SalesReportsTable -> PrintInvoiceDialog)
}

const WatchStandardInvoiceContent = forwardRef<HTMLDivElement, Props>(
  (
    {
      data,
      num_fact,
      showImage = true,
      showGoldUnitPrices = true,
      showDiscountValues = true,
      showSurchargeValues = true,
      createdBy,
    },
    ref
  ) => {
    const {
      TotalAmountFinal,
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
    } = data;

    const paidUsdLyd = (data as any)?.amount_currency_LYD;
    const paidEurLyd = (data as any)?.amount_EUR_LYD;

    const placeholderImgSrc = "/GJ LOGO.png";

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
              const converted = await convertAvifUrlToPngBase64InBrowser(raw, token);
              prepared.push(converted);
              continue;
            } catch (err) {
              console.warn("[InvoiceImages] Failed to convert AVIF", err);
            }
          }
          prepared.push(raw);
        }
        return prepared;
      },
      []
    );

    const moneyEps = 0.01;
    const normalizeLyd0 = (v: number) => Math.round(Number(v) || 0);

    const getPreferredImageKey = (kind: "gold" | "diamond" | "watch", id: any) =>
      `prefImg:${kind}:${String(id ?? "").trim()}`;

    const canonicalizePrefUrl = React.useCallback(
      (rawUrl: string, kind: "gold" | "diamond" | "watch", idKey: any): string => {
        if (!rawUrl) return "";
        try {
          let u = String(rawUrl);
          // Remove token query param for stable comparisons
          u = u.replace(/([?&])token=[^&]*(&?)/i, (_m, p1, p2) => (p2 ? p1 : ""));
          u = u.replace(/[?&]$/g, "");

          // For watch, normalize common legacy/alternate paths into /images/watch/<id>/<file>
          if (kind === "watch" && idKey != null) {
            try {
              const basePart = u.split("?")[0];
              const fileName = basePart.split("/").pop() || "";
              const id = encodeURIComponent(String(idKey));
              if (fileName) {
                u = `/images/watch/${id}/${encodeURIComponent(fileName)}`;
              }
            } catch {
              // ignore
            }
          }

          // Canonical form: pathname only (stable across origins)
          const urlObj = new URL(u, window.location.origin);
          return urlObj.pathname;
        } catch {
          return String(rawUrl || "");
        }
      },
      []
    );

    const fmt0 = (v: any) =>
      Math.ceil(Number(v) || 0).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });

    const fmtWeight = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? String(v) : "0";
    };

    const parseMetaFromComment = (raw: any): any | null => {
      const s = String(raw || "");
      const idx = s.lastIndexOf("__META__");
      if (idx < 0) return null;
      const jsonPart = s.slice(idx + "__META__".length);
      try {
        const obj = JSON.parse(jsonPart);
        if (obj && typeof obj === "object") return obj;
      } catch {
        return null;
      }
      return null;
    };

    const parseDsMetaFromComment = (raw: any): any | null => {
      const s = String(raw || "");
      const idx = s.lastIndexOf("__DSMETA__");
      if (idx < 0) return null;
      const jsonPart = s.slice(idx + "__DSMETA__".length);
      try {
        const obj = JSON.parse(jsonPart);
        if (obj && typeof obj === "object") return obj;
      } catch {
        return null;
      }
      return null;
    };
    let ps: string | null = null;
    let usr: string | null = null;
    const userStr = localStorage.getItem("user");

    if (userStr) {
      try {
        const userObj = JSON.parse(userStr);
        ps = userObj.ps ?? localStorage.getItem("ps");
        usr =
          userObj.id_user?.toString?.() ||
          userObj.Cuser?.toString?.() ||
          localStorage.getItem("Cuser");
      } catch {
        ps = localStorage.getItem("ps");
        usr = localStorage.getItem("Cuser");
      }
    } else {
      ps = localStorage.getItem("ps");
      usr = localStorage.getItem("Cuser");
    }

    const branchName = (() => {
      const psValue = (invoice as any)?.ps ?? ps;
      const p = String(psValue ?? "").trim().toUpperCase();
      if (p === "P1") return "Jraba Mall";
      if (p === "P2") return "Ben Ashour";
      if (p === "P3") return "Jraba Main";
      return p;
    })();

    const formatInvoiceDate = (raw: any): string => {
      const s = String(raw ?? "").trim();
      if (!s) return "";
      let d: Date | null = null;
      const m = /^\s*(\d{2})-(\d{2})-(\d{4})\s*$/.exec(s);
      if (m) {
        const dd = Number(m[1]);
        const mm = Number(m[2]);
        const yyyy = Number(m[3]);
        const tmp = new Date(yyyy, mm - 1, dd);
        d = Number.isFinite(tmp.getTime()) ? tmp : null;
      } else {
        const tmp = new Date(s);
        d = Number.isFinite(tmp.getTime()) ? tmp : null;
      }
      if (!d) return s;
      const day = d.getDate();
      const suffix = (() => {
        const mod100 = day % 100;
        if (mod100 >= 11 && mod100 <= 13) return "th";
        const mod10 = day % 10;
        if (mod10 === 1) return "st";
        if (mod10 === 2) return "nd";
        if (mod10 === 3) return "rd";
        return "th";
      })();
      const dayName = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d);
      const monthName = new Intl.DateTimeFormat(undefined, { month: "long" }).format(d);
      const year = d.getFullYear();
      return `${dayName}, ${day}${suffix} of ${monthName} ${year}`;
    };

    const [typeinv] = useState(() => {
      // Try to get TYPE_SUPPLIER from the first ACHATs item, fallback to Design_art if available
      if (invoice.ACHATs && invoice.ACHATs.length > 0) {
        return invoice.ACHATs[0]?.Fournisseur?.TYPE_SUPPLIER || "";
      }
      return "";
    });

    // Filter pdata by num_fact at the top of the component
    const [pdata, setPData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    // Detect diamond data regardless of TYPE_SUPPLIER text (robust multi-shape detection)
    const hasDiamondData = useMemo(() => {
      const diamondIndicatorKeys = [
        "carat",
        "cut",
        "clarity",
        "shape",
        "certificate_number",
        "certificate_lab",
        "color",
        "fluorescence",
        "measurements",
        "girdle",
        "polish",
        "symmetry",
        "depth_percent",
        "table_percent",
      ];
      const clarityValues = [
        "if",
        "vvs1",
        "vvs2",
        "vs1",
        "vs2",
        "si1",
        "si2",
        "i1",
        "i2",
        "i3",
      ];
      const shapeValues = [
        "round",
        "princess",
        "emerald",
        "oval",
        "pear",
        "marquise",
        "cushion",
        "radiant",
        "heart",
        "asscher",
      ];

      const valueSuggestsDiamond = (val: any): boolean => {
        if (!val) return false;
        if (typeof val === "string") {
          const lv = val.toLowerCase();
          if (clarityValues.includes(lv)) return true;
          if (shapeValues.includes(lv)) return true;
          if (/^g?ia\s?\d{5,}$/.test(lv)) return true; // possible certificate number
        }
        if (typeof val === "number") {
          // carat often between 0 and 30 (broad range) with decimal
          if (val > 0 && val < 50) return true; // heuristic; combined with key tests below
        }
        return false;
      };

      const checkDiamondObj = (obj: any, depth = 0): boolean => {
        if (!obj || typeof obj !== "object") return false;
        if (obj.OriginalAchatDiamond || obj.purchaseD || obj.OriginalAchat)
          return true;
        for (const key of Object.keys(obj)) {
          const val = obj[key];
          const lk = key.toLowerCase();
          if (lk.includes("diamond")) return true;
          if (diamondIndicatorKeys.some((k) => lk === k || lk.includes(k))) {
            if (val !== undefined && val !== null && val !== "") return true;
          }
          if (
            ["carat", "clarity", "cut", "shape"].some((k) => lk.includes(k)) &&
            valueSuggestsDiamond(val)
          )
            return true;
        }
        if (depth < 2) {
          // search deeper but limit to avoid cycles
          for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (val && typeof val === "object") {
              if (checkDiamondObj(val, depth + 1)) return true;
            }
          }
        }
        return false;
      };

      // 1. Quick fallback: items prop
      if (
        (!pdata || pdata.length === 0) &&
        Array.isArray(items) &&
        items.some((it) => checkDiamondObj(it))
      )
        return true;
      if (!pdata || pdata.length === 0) return false;

      const detected = pdata.some((inv) => {
        // Supplier type hint
        const supplierType =
          inv?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase?.() || "";
        const achatLevel = (inv.ACHATs || []).some((it: any) =>
          checkDiamondObj(it)
        );
        if (achatLevel || supplierType.includes("diamond")) return true;
        // Deep scan inside DistributionPurchase
        return (inv.ACHATs || []).some((it: any) => {
          const dp: any =
            it?.DistributionPurchase ||
            it?.DistributionPurchases ||
            it?.distributionPurchase ||
            it?.distributionPurchases;
          if (Array.isArray(dp)) return dp.some((dpo) => checkDiamondObj(dpo));
          return checkDiamondObj(dp);
        });
      });

      return detected;
    }, [pdata, items, invoice]);

    const invoiceTypeLabel = useMemo(() => {
      const t = String(typeinv || "").toLowerCase();
      if (t.includes("gold")) return "Gold";
      if (t.includes("watch")) return "Watches";
      if (t.includes("diamond") || hasDiamondData) return "Diamonds";
      return "Invoice";
    }, [typeinv, hasDiamondData]);

    // Minimal debug hook to trace data presence without unused variables
    useEffect(() => {
      if (pdata && pdata.length) {
        // no-op: keep this effect to allow quick debug additions if needed
      }
    }, [hasDiamondData, pdata]);
    const apiUrlinv = "/invoices";
    const apiUrlWatches = "/WOpurchases";
    const apiUrlDiamonds = "/DOpurchases"; // Added diamond endpoint

    // Use num_fact from props if provided, otherwise from data.invoice
    const invoiceNumFact =
      typeof num_fact !== "undefined" ? num_fact : invoice.num_fact;

    const fetchDataINV = async () => {
      const token = localStorage.getItem("token");
      setLoading(true);
      try {
        const res = await axios.get<any[]>(`${apiUrlinv}/allDetails`, {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            ps: invoice.ps,
            num_fact: invoiceNumFact,
          ...(usr ? { usr } : {}),
          },
        });



       
        // Client-side safeguard: filter by usr as well if present


        // If invoiceNumFact is 0, filter by usr only (in-progress invoice)
        let filtered;
        if (invoiceNumFact === 0) {
          filtered = usr
            ? res.data.filter((inv: any) => String(inv.usr) === String(usr))
            : res.data;


             setPData(filtered);
             
        } else {
               setPData(res.data);
        }
       
        /*const filtered = usr
          ? res.data.filter((inv: any) => String(inv.usr) === String(usr))
          : res.data;*/

         

   
      } catch (err: any) {
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      // Refetch details when invoice number changes so status reflects latest state
      fetchDataINV();
      // eslint-disable-next-line
    }, [invoiceNumFact]);

    // Find the invoice in pdata that matches the current invoice number
    const currentInvoiceData =
      pdata.find((inv: any) => inv.num_fact === invoiceNumFact) || {};

    // Derive closed status from current invoice data using common flags
    const isClosed = (() => {
      const v: any = currentInvoiceData || {};
      const candidates = [v?.is_closed, v?.IS_CLOSED, v?.IS_OK, v?.is_ok];
      for (const c of candidates) {
        if (c === true) return true;
        if (c === 1) return true;
        if (typeof c === "string" && c.trim() === "1") return true;
        if (typeof c === "string" && c.trim().toLowerCase() === "true") return true;
      }
      return false;
    })();

    // Store all watch & diamond details keyed by picint
    const [allWatchDetails, setAllWatchDetails] = useState<{
      [key: string]: any;
    }>({});
    const [allDiamondDetails, setAllDiamondDetails] = useState<{
      [key: string]: any;
    }>({});

    // Helper: normalize raw diamond-like object into canonical fields
    const normalizeDiamond = useCallback((raw: any): any | null => {
      if (!raw || typeof raw !== "object") return null;
      const out: any = {};
      const push = (k: string, v: any) => {
        if (v !== undefined && v !== null && v !== "") out[k] = v;
      };
      const pickFirst = (...cands: string[]) => {
        for (const c of cands) {
          if (raw[c] !== undefined && raw[c] !== null && raw[c] !== "")
            return raw[c];
        }
        // search case-insensitive
        const lowerMap: Record<string, string> = {};
        Object.keys(raw).forEach((k) => (lowerMap[k.toLowerCase()] = k));
        for (const c of cands) {
          const lc = c.toLowerCase();
          if (lowerMap[lc]) return raw[lowerMap[lc]];
        }
        return undefined;
      };
      push("id_achat", pickFirst("id_achat", "idAchat", "purchase_id"));
      push(
        "Design_art",
        pickFirst(
          "Design_art",
          "design_art",
          "design",
          "name",
          "product_name",
          "product"
        )
      );
      push(
        "carat",
        pickFirst("carat", "Carat", "cts", "carat_weight", "weight_carat")
      );
      push("cut", pickFirst("cut", "Cut", "cut_grade"));
      push("color", pickFirst("color", "Color", "colour"));
      push("clarity", pickFirst("clarity", "Clarity"));
      push("shape", pickFirst("shape", "Shape", "stone_shape"));
      push(
        "measurements",
        pickFirst(
          "measurements",
          "Measurements",
          "measurement",
          "meas",
          "dims",
          "dimensions"
        )
      );
      push("depth_percent", pickFirst("depth_percent", "depth", "Depth"));
      push("table_percent", pickFirst("table_percent", "table", "Table"));
      push("girdle", pickFirst("girdle", "Girdle"));
      push("culet", pickFirst("culet", "Culet"));
      push("polish", pickFirst("polish", "Polish"));
      push("symmetry", pickFirst("symmetry", "Symmetry"));
      push("fluorescence", pickFirst("fluorescence", "Fluorescence", "fluor"));
      push(
        "certificate_number",
        pickFirst(
          "certificate_number",
          "certificate",
          "cert_number",
          "cert_no",
          "gia_number",
          "gia_no",
          "gia"
        )
      );
      push(
        "certificate_lab",
        pickFirst("certificate_lab", "certificate_lab_name", "lab", "Lab")
      );
      push(
        "laser_inscription",
        pickFirst("laser_inscription", "laser", "laser_inscr")
      );
      push("origin_country", pickFirst("origin_country", "origin", "country"));
      // Newly added fields for diamond invoice display
      push(
        "CODE_EXTERNAL",
        pickFirst(
          "CODE_EXTERNAL",
          "code_external",
          "external_code",
          "ref_code",
          "reference_code",
          "reference"
        )
      ); // reference_number intentionally excluded (watch specific)
      push(
        "comment_edit",
        pickFirst(
          "comment_edit",
          "Comment_Edit",
          "sales_code",
          "salescode",
          "sales_code"
        )
      );
      if (Object.keys(out).length === 0) return null;
      return out;
    }, []);

    // Fetch all watch details for each row after pdata loads
    useEffect(() => {
      const fetchAllDetails = async () => {
        const token = localStorage.getItem("token");
        // WATCHES
        if (typeinv && typeinv.toLowerCase().includes("watch")) {
          const uniqueIds = Array.from(
            new Set(pdata.map((inv) => inv.picint).filter(Boolean))
          );
          const watchMap: { [key: string]: any } = {};
          await Promise.all(
            uniqueIds.map(async (id) => {
              try {
                const res = await axios.get(`${apiUrlWatches}/getitem/${id}`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                watchMap[id] = Array.isArray(res.data) ? res.data[0] : res.data;
              } catch {
                watchMap[id] = null;
              }
            })
          );
          setAllWatchDetails(watchMap);
        } else {
          setAllWatchDetails({});
        }

        // DIAMONDS (explicit invoice type or detected diamond data) now mimic watch logic using picint as unique key
        // Treat `gold` invoices similarly so gold images/details stored under picint are also fetched
        const diamondInvoice =
          typeinv && (typeinv.toLowerCase().includes("diamond") || typeinv.toLowerCase().includes("gold"));
        if (diamondInvoice || hasDiamondData) {
          const uniqueDiamondPicints = Array.from(
            new Set(pdata.map((inv) => inv.picint).filter(Boolean))
          );
          // eslint-disable-next-line no-console
         
          
          if (uniqueDiamondPicints.length === 0) {
            setAllDiamondDetails({});
          } else {
            const diamondMap: { [key: string]: any } = {};
            await Promise.all(
              uniqueDiamondPicints.map(async (pic) => {
                try {
                  const res = await axios.get(
                    `${apiUrlDiamonds}/getitem/${pic}`,
                    {
                      headers: { Authorization: `Bearer ${token}` },
                    }
                  );
                  diamondMap[pic] = Array.isArray(res.data)
                    ? res.data[0]
                    : res.data;
                } catch (err) {
                   
                  diamondMap[pic] = null; // fallback inline
                }
              })
            );
            setAllDiamondDetails(diamondMap);
          }
        } else {
          setAllDiamondDetails({});
        }
      };
      fetchAllDetails();
      // eslint-disable-next-line
    }, [pdata, typeinv, hasDiamondData]);

    // Build image base candidates from axios baseURL. Some deployments serve images at /api/images,
    // others at /images. We try both.
    const IMAGE_BASES = (() => {
      try {
        const base = (axios as any)?.defaults?.baseURL;
        if (base) {
          const u = new URL(base, window.location.origin);
          const cleanPath = u.pathname.replace(/\/+$/, "");
          const origin = u.origin;
          const candidates: string[] = [];
          // 1) /api/images when baseURL ends with /api
          if (/\/api$/i.test(cleanPath)) {
            candidates.push(`${origin}${cleanPath}/images`.replace(/\/+$/, ""));
            candidates.push(`${origin}/images`);
          } else {
            // 1) preserve base path + /images
            candidates.push(`${origin}${cleanPath}/images`.replace(/\/+$/, ""));
            // 2) also try origin /images
            candidates.push(`${origin}/images`);
          }
          return Array.from(new Set(candidates.map((s) => s.replace(/\/+$/, ""))));
        }
        const o = new URL(window.location.origin);
        return [`${o.origin}/images`];
      } catch {
        return ['/images'];
      }
    })();

    // Primary base used for URL prefixing.
    const API_BASEImage = IMAGE_BASES[0] || "/images";

    // Ensure any image URL is absolute (handles http://, https://, //, and /paths)
    // Keep the current protocol to avoid breaking local/dev environments.
    const toHttpsAbsolute = (url: string): string => {
      try {
        if (!url) return url;
        if (url.startsWith("data:")) return url;
        if (url.startsWith("blob:")) return url;

        if (/^https?:\/\//i.test(url)) {
          // Avoid mixed-content issues when the app runs on https.
          if (window?.location?.protocol === "https:" && /^http:\/\//i.test(url)) {
            return url.replace(/^http:\/\//i, "https://");
          }
          return url;
        }
        if (url.startsWith("//")) return `${window.location.protocol}${url}`;
        if (url.startsWith("/")) return `${window.location.origin}${url}`;
        return new URL(url, window.location.origin).toString();
      } catch {
        return url;
      }
    };

    // If we have a normalized secure route like /images/... we must prefix with API_BASEImage ROOT
    // to preserve any base path (e.g. /api).
    const toApiImageAbsolute = (url: string): string => {
      try {
        if (!url) return url;
        if (url.startsWith("data:") || url.startsWith("blob:")) return url;
        if (/^https?:\/\//i.test(url) || url.startsWith("//")) return toHttpsAbsolute(url);

        if (url.startsWith("/images/")) {
          // API_BASEImage is like http(s)://host[/api]/images
          const root = API_BASEImage.replace(/\/images\/?$/i, "");
          return `${root}${url}`;
        }

        if (url.startsWith("/uploads/")) {
          // Preserve API base path (e.g. /api) for legacy upload mounts
          const root = API_BASEImage.replace(/\/images\/?$/i, "");
          return `${root}${url}`;
        }

        // Fallback to browser origin
        return toHttpsAbsolute(url);
      } catch {
        return toHttpsAbsolute(url);
      }
    };

    const round2 = (n: any) => Math.round((Number(n) || 0) * 100) / 100;

const pickNumber = (...values: any[]) => {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
};

    /** 
     * Convert any returned upload path into your secure /images/* route.
     * Works for gold/watch/diamond when the API returns old upload paths.
     */
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

            // DIAMOND (if you have a diamond folder)
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

    const withToken = (rawUrl: string, token: string | null): string => {
      if (!token) return rawUrl;
      try {
        const u = new URL(rawUrl, window.location.origin);
        u.searchParams.delete("token");
        u.searchParams.append("token", token);
        return u.toString();
      } catch {
        // Fallback: best-effort append
        if (!rawUrl) return rawUrl;
        if (/([?&])token=/.test(rawUrl)) return rawUrl;
        return rawUrl + (rawUrl.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
      }
    };

    const [imageUrls, setImageUrls] = useState<Record<string, string[]>>({});

    const normalizeImageList = React.useCallback((arr: any): string[] => {
      if (!Array.isArray(arr)) return [];
      return arr
        .map((it: any) => {
          if (typeof it === "string") return it;
          if (it && typeof it === "object") return it.url || it.path || it.href || it.src || "";
          return "";
        })
        .filter(Boolean);
    }, []);

    // Typed fetch helper (watch | diamond | gold) with dual base support
    const fetchImagesTyped = async (
      id: number | string,
      type: "watch" | "diamond" | "gold"
    ): Promise<string[] | null> => {
      const token = localStorage.getItem("token");
      try {
        for (const base of IMAGE_BASES) {
          const url = `${base}/list/${type}/${id}`;
          try { console.log("[InvoiceImages:fetch] GET", url); } catch {}
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
              .filter(Boolean);

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
    };


    // Fetch images for watch, diamond, or gold when detected (typed endpoints)
    useEffect(() => {
      const isWatch = !!(typeinv && typeinv.toLowerCase().includes("watch"));
      const isGold = !!(typeinv && typeinv.toLowerCase().includes("gold"));
      const isDiamond = !!(
        (typeinv && typeinv.toLowerCase().includes("diamond")) ||
        (hasDiamondData && !isGold)
      );

      if (!(isWatch || isGold || isDiamond)) return;

      // Build candidate ids based on invoice type
      let sourceIds: string[] = [];

      if (isWatch) {
        sourceIds = Object.keys(allWatchDetails);
        if (sourceIds.length === 0) {
          sourceIds = pdata.map((inv) => inv.picint).filter(Boolean).map(String);
          if (sourceIds.length === 0) {
            sourceIds = items
              .map((it: any) => it.picint || it.id_fact || it.id_achat)
              .filter(Boolean)
              .map(String);
          }
        }
      }

      if (isDiamond) {
        sourceIds = Object.keys(allDiamondDetails);
        if (sourceIds.length === 0) {
          sourceIds = pdata.map((inv) => inv.picint).filter(Boolean).map(String);
        }
      }

      if (isGold) {
        // Gold images are stored per id_art (NOT id_achat)
        const collectGoldArtIds = (arr: any[]): string[] =>
          (arr || [])
            .flatMap((inv: any) => {
              const ids: any[] = [];

              // parent invoice row id_art (BEST)
              if (inv?.id_art != null) ids.push(inv.id_art);
              if (inv?.ID_ART != null) ids.push(inv.ID_ART);
              if (inv?.Id_Art != null) ids.push(inv.Id_Art);

              // sometimes item level has id_art
              (inv?.ACHATs || []).forEach((a: any) => {
                if (a?.id_art != null) ids.push(a.id_art);
                if (a?.ID_ART != null) ids.push(a.ID_ART);
                if (a?.Id_Art != null) ids.push(a.Id_Art);
              });

              return ids;
            })
            .filter((v) => v !== undefined && v !== null && String(v).trim() !== "")
            .map((v) => String(v));

        sourceIds = collectGoldArtIds(pdata);
        if (sourceIds.length === 0) {
          sourceIds = collectGoldArtIds(items || []);
        }
      }


      const unique = Array.from(new Set(sourceIds)).filter(Boolean);

      console.log("[InvoiceImages:init]", { isWatch, isGold, isDiamond, unique });

      (async () => {
        for (const id of unique) {
          if (!id) continue;
          if (imageUrls[id]) continue;

          console.log("[InvoiceImages] fetching", { id, isWatch, isGold, isDiamond });

          // WATCH
          if (isWatch) {
            // Your existing watch logic stays, but keep it simple:
            // fetch by id_achat candidates (best), fallback to legacy list.
            const detail = allWatchDetails[id];
            const candidateIds: string[] = [];

            const pushId = (v: any) => {
              if (v !== undefined && v !== null) {
                const s = String(v).trim();
                if (s && !candidateIds.includes(s)) candidateIds.push(s);
              }
            };

            if (detail) {
              pushId(detail.id_achat);
              pushId(detail.ID_ACHAT);
              pushId(detail.purchase_id);
              pushId(detail.idAchat);
              const nestedA =
                detail.OriginalAchat ||
                detail.originalAchat ||
                detail.achat ||
                detail.Achat ||
                detail.purchase ||
                detail.Purchase;
              if (nestedA && typeof nestedA === "object") {
                pushId(nestedA.id_achat);
                pushId(nestedA.ID_ACHAT);
                pushId(nestedA.purchase_id);
              }
            }

            // also scan pdata achat rows
            pdata
              .filter((inv) => String(inv.picint) === String(id))
              .forEach((inv) => (inv.ACHATs || []).forEach((a: any) => pushId(a?.id_achat)));

            for (const cid of candidateIds) {
              if (!cid) continue;

              let urls = await fetchImagesTyped(cid, "watch");

              // fallback legacy
              if (!urls || urls.length === 0) {
                try {
                  const token = localStorage.getItem("token");
                  const fUrl = `${API_BASEImage}/list/${cid}`;
                  const r = await axios.get(fUrl, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (Array.isArray(r.data) && r.data.length) {
                    const normalized = normalizeImageList(r.data).map(normalizeToSecureImagePath);
                    const converted = await convertItemsImagesToBase64(normalized);
                    urls = converted.length ? converted : normalized;
                  }
                } catch {}
              }

              if (urls && urls.length) {
                setImageUrls((prev) => ({ ...prev, [id]: urls, [cid]: urls }));
                break;
              }
            }
            continue;
          }

          // GOLD
          if (isGold) {
            const artId = String(id);
            let urls = await fetchImagesTyped(artId, "gold");

            // fallback legacy if your API also supports /list/:id
            if (!urls || urls.length === 0) {
              try {
                const token = localStorage.getItem("token");
                const legacyUrl = `${API_BASEImage}/list/${artId}`;
                const r2 = await axios.get(legacyUrl, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (Array.isArray(r2.data) && r2.data.length) {
                  const normalized = normalizeImageList(r2.data).map(normalizeToSecureImagePath);
                  const converted = await convertItemsImagesToBase64(normalized);
                  urls = converted.length ? converted : normalized;
                }
              } catch {}
            }

            setImageUrls((prev) => ({ ...prev, [artId]: urls || [] }));
            continue;
          }


          // DIAMOND
          if (isDiamond) {
            const cid = String(id);
            let urls = await fetchImagesTyped(cid, "diamond");

            // fallback legacy
            if (!urls || urls.length === 0) {
              try {
                const token = localStorage.getItem("token");
                const legacyUrl = `${API_BASEImage}/list/${cid}`;
                const r2 = await axios.get(legacyUrl, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (Array.isArray(r2.data) && r2.data.length) {
                  const normalized = normalizeImageList(r2.data).map(normalizeToSecureImagePath);
                  const converted = await convertItemsImagesToBase64(normalized);
                  urls = converted.length ? converted : normalized;
                }
              } catch {}
            }

            setImageUrls((prev) => ({ ...prev, [cid]: urls || [] }));
            continue;
          }
        }
      })();

      // eslint-disable-next-line
    }, [pdata, allWatchDetails, allDiamondDetails, typeinv, hasDiamondData, items]);

    // Inline print styles (kept local to component so production build includes them)
    const printStyles = `
            @media print {
                @page { size: A4; margin: 10mm; }
                html, body { background: #fff !important; color: #000 !important; -webkit-print-color-adjust: exact; }
                .invoice-root { width: 210mm !important; max-width: 210mm !important; margin: 0 auto !important; padding: 0 10mm !important; box-sizing: border-box !important; }
                .invoice-root { min-height: 277mm !important; display: flex !important; flex-direction: column !important; }
                .invoice-table, table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; }
                /* center most table cells for tidy print; details column remains left-aligned */
                .invoice-table td, .invoice-table th, td, th { word-break: break-word !important; overflow-wrap: break-word !important; vertical-align: middle !important; text-align: left !important; }
                .col-details, .invoice-table .col-details { text-align: left !important; vertical-align: top !important; }
                img { max-width: 100% !important; height: auto !important; display: block !important; }
                .no-break { page-break-inside: avoid !important; -webkit-page-break-inside: avoid !important; }
                .MuiBox-root, .MuiTypography-root { -webkit-print-color-adjust: exact; }

                /* Header layout for print: keep content compact and centered */
                .invoice-header { display: flex !important; flex-direction: column !important; align-items: stretch !important; gap: 8px !important; }
                .invoice-header { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                .invoice-header-left { display: flex !important; flex-direction: column !important; align-items: flex-start !important; }
                .invoice-header-right { display: flex !important; flex-direction: column !important; align-items: flex-end !important; justify-content: flex-start !important; min-width: 140px !important; }
                .invoice-header-right .MuiBox-root { width: 100% !important; }
                .invoice-header-right > * + * { margin-top: 8px !important; }
                /* Ensure customer info shows cleanly in print/PDF */
                .invoice-header-right .customer-box { border: none !important; background: #fff !important; padding: 8px !important; border-radius: 6px !important; -webkit-print-color-adjust: exact; width: 100% !important; }

                /* Logo and stamp sizing for print */
                .invoice-logo { width: 250px !important; height: auto !important; }
                .invoice-stamp { width: 72px !important; height: auto !important; }

                /* Key column sizes for print */
                .col-sn { width: 90px !important; min-width: 90px !important; }
                .col-img { width: 120px !important; min-width: 120px !important; }
                .col-price { width: 80px !important; min-width: 80px !important; }

                /* Footer layout: right-align created-by and stamp; stamp smaller to match preview */
                .invoice-footer { display: flex !important; justify-content: flex-end !important; align-items: center !important; width: 100% !important; }
                .invoice-footer .invoice-footer-content { display: flex !important; flex-direction: row !important; align-items: center !important; justify-content: flex-end !important; gap: 12px !important; }
                .invoice-footer .created-by { text-align: right !important; margin-right: 8px !important; }
                .invoice-footer .invoice-stamp { margin-left: 8px !important; width: 72px !important; height: auto !important; }

                /* Totals layout for print: left column (3 items) and right column (3 items) */
                .invoice-totals { display: flex !important; justify-content: space-between !important; align-items: flex-start !important; gap: 8mm !important; width: 100% !important; }
                .invoice-totals .totals-left, .invoice-totals .totals-right { display: flex !important; flex-direction: column !important; gap: 6px !important; width: 48% !important; box-sizing: border-box !important; }
                .invoice-totals .totals-left { align-items: flex-start !important; text-align: left !important; }
                .invoice-totals .totals-right { align-items: flex-end !important; text-align: right !important; }

                .invoice-items { display: flex !important; flex-direction: column !important; gap: 6px !important; }
                .invoice-item-card { page-break-inside: avoid !important; -webkit-page-break-inside: avoid !important; }
                .invoice-controls { display: none !important; }

                .invoice-bottom { margin-top: auto !important; }
            }
            /* non-print sizes */
            .invoice-table td, .invoice-table th { text-align: center; }
            .col-details { text-align: left; }
            .col-sn { width: 90px; }
            .col-img { width: 120px; }
            .col-price { width: 80px; }
        `;

    const useLegacyTableLayout = false;
    const computedGoldTotalWeight = useMemo(() => {
      if (!Array.isArray(pdata)) return 0;
      const invs = invoiceNumFact === 0
        ? (usr ? pdata.filter((inv: any) => String(inv?.usr) === String(usr)) : pdata)
        : pdata.filter((inv: any) => Number(inv?.num_fact) === Number(invoiceNumFact));
      return invs
        .flatMap((inv: any) => inv?.ACHATs || [])
        .reduce((sum: number, it: any) => sum + (Number(it?.qty) || 0), 0);
    }, [pdata, invoiceNumFact, usr]);

    const renderInvoiceItemImage = (item: any) => {
      try {
        const parentInvoice = item?._parent;
        const rowPicint = parentInvoice?.picint ?? item?.picint ?? invoice?.picint;
        const rowIdFact =
          item?.id_fact ?? parentInvoice?.id_fact ?? invoice?.id_fact ?? invoice?.num_fact;
        const rowGoldArtId =
          parentInvoice?.id_art ??
          parentInvoice?.ID_ART ??
          parentInvoice?.Id_Art ??
          item?.id_art ??
          item?.ID_ART ??
          item?.Id_Art ??
          invoice?.id_art;
        const rowIdAchatCandidate =
          item?.id_achat ??
          item?.ID_ACHAT ??
          item?.Id_Achat ??
          parentInvoice?.id_achat ??
          parentInvoice?.ID_ACHAT ??
          parentInvoice?.Id_Achat;

        const makeKey = (v: any) =>
          v !== undefined && v !== null && String(v).trim() !== "" ? String(v) : "";

        const isGoldType = typeinv?.toLowerCase().includes("gold");
        const isWatchType = typeinv?.toLowerCase().includes("watch");

        const orderedKeys = [
          makeKey(rowGoldArtId),
          makeKey(rowIdAchatCandidate),
          makeKey(rowPicint),
          makeKey(rowIdFact),
          makeKey(invoice?.picint),
          makeKey(invoice?.id_fact ?? invoice?.num_fact),
        ].filter(Boolean);

        let urls: string[] = [];
        for (const key of orderedKeys) {
          if (key && imageUrls[key] && imageUrls[key].length) {
            urls = imageUrls[key];
            break;
          }
        }
        urls = normalizeImageList(urls);

        const token = localStorage.getItem("token");
        const candidateUrls = Array.isArray(urls) ? urls.filter(Boolean) : [];
        if (!candidateUrls.length) return null;

        let preferredUrl: string | null = null;
        try {
          const kind: "gold" | "diamond" | "watch" = isGoldType
            ? "gold"
            : isWatchType
              ? "watch"
              : "diamond";
          const keyId = isGoldType
            ? rowGoldArtId ?? rowPicint ?? invoice?.picint
            : item?.id_achat ?? rowPicint ?? invoice?.picint;
          const prefRaw =
            localStorage.getItem(getPreferredImageKey(kind, keyId)) || "";
          const pref = canonicalizePrefUrl(prefRaw, kind, keyId);
          if (pref) {
            const idxPref = candidateUrls.findIndex(
              (u) => canonicalizePrefUrl(String(u), kind, keyId) === pref
            );
            if (idxPref >= 0) preferredUrl = candidateUrls[idxPref];
          }
        } catch {
          // ignore
        }

        const imgUrl =
          preferredUrl || candidateUrls[candidateUrls.length - 1] || candidateUrls[0];
        const httpsImg = toApiImageAbsolute(imgUrl);
        const urlWithToken = withToken(httpsImg, token);

        return (
          <Box
            component="img"
            src={urlWithToken}
            alt="Product"
            loading="lazy"
            sx={{
              width: 96,
              height: 96,
              objectFit: "cover",
              borderRadius: 2,
              border: "1px solid #eee",
              background: "#fff",
            }}
            onError={(
              e: React.SyntheticEvent<HTMLImageElement, Event>
            ) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = placeholderImgSrc;
            }}
          />
        );
      } catch {
        return null;
      }
    };

    const buildDetailsParts = (item: any): string[] => {
      try {
        if (typeinv && typeinv.toLowerCase().includes("watch")) {
          const parentInvoice = item?._parent;
          const rowId = parentInvoice?.picint;
          const rowDetails = allWatchDetails[rowId];
          if (!rowDetails) return [];
          const parts: string[] = [];
          if (rowDetails.Brand || rowDetails.brand)
            parts.push(
              `Brand: ${rowDetails.Brand?.client_name || rowDetails.brand?.client_name || rowDetails.Brand || rowDetails.brand}`
            );
          if (rowDetails.Design_art || rowDetails.design)
            parts.push(
              `Product name: ${rowDetails.Design_art || rowDetails.design || ""}`
            );
          if (rowDetails.Color) parts.push(`Color: ${rowDetails.Color}`);
          if (rowDetails.id_achat) parts.push(`Code: ${rowDetails.id_achat}`);
          if (rowDetails.reference_number)
            parts.push(`Reference Number: ${rowDetails.reference_number}`);
          if (rowDetails.serial_number)
            parts.push(`Serial Number: ${rowDetails.serial_number}`);
          if (rowDetails.model) parts.push(`Model: ${rowDetails.model}`);
          if (rowDetails.condition)
            parts.push(`Condition: ${rowDetails.condition}`);
          if (rowDetails.case_material)
            parts.push(`Case Material: ${rowDetails.case_material}`);
          if (rowDetails.case_size) parts.push(`Case Size: ${rowDetails.case_size}`);
          if (rowDetails.bracelet_type)
            parts.push(`Bracelet Type: ${rowDetails.bracelet_type}`);
          if (rowDetails.dial_color)
            parts.push(`Dial Color: ${rowDetails.dial_color}`);
          if (rowDetails.box_papers !== undefined)
            parts.push(`Box & Papers: ${rowDetails.box_papers ? "Yes" : "No"}`);
          return parts;
        }

        if (
          (typeinv &&
            (typeinv.toLowerCase().includes("diamond") ||
              typeinv.toLowerCase().includes("gold"))) ||
          hasDiamondData
        ) {
          const parentInvoice = item?._parent;
          const rowPic = parentInvoice?.picint;
          const picDetails = rowPic ? allDiamondDetails[rowPic] : null;
          let dNorm: any = null;
          if (picDetails) {
            dNorm = normalizeDiamond(
              picDetails.OriginalAchatDiamond ||
                picDetails.purchaseD ||
                picDetails.OriginalAchat ||
                picDetails
            );
          }
          if (!dNorm) {
            const candidateSources: any[] = [];
            if (picDetails) candidateSources.push(picDetails);
            const directById = allDiamondDetails[item?.id_achat];
            if (directById) candidateSources.push(directById);
            const dpAny: any =
              item?.DistributionPurchase ||
              item?.DistributionPurchases ||
              item?.distributionPurchase ||
              item?.distributionPurchases;
            if (Array.isArray(dpAny)) candidateSources.push(...dpAny);
            else if (dpAny) candidateSources.push(dpAny);
            candidateSources.push(item);
            for (const src of candidateSources) {
              if (!src) continue;
              const unwrap =
                src.OriginalAchatDiamond || src.purchaseD || src.OriginalAchat || src;
              const n = normalizeDiamond(unwrap);
              if (n) {
                dNorm = n;
                break;
              }
            }
          }
          if (!dNorm) return [];

          const parts: string[] = [];
          if (dNorm.Design_art) parts.push(`Product name: ${dNorm.Design_art}`);
          if (dNorm.CODE_EXTERNAL) parts.push(`Code: ${dNorm.CODE_EXTERNAL}`);
          if (dNorm.comment_edit) parts.push(`Sales Code: ${dNorm.comment_edit}`);
          if (dNorm.carat) parts.push(`Carat: ${dNorm.carat}`);
          if (dNorm.cut) parts.push(`Cut: ${dNorm.cut}`);
          if (dNorm.color) parts.push(`Color: ${dNorm.color}`);
          if (dNorm.clarity) parts.push(`Clarity: ${dNorm.clarity}`);
          if (dNorm.shape) parts.push(`Shape: ${dNorm.shape}`);
          if (dNorm.measurements) parts.push(`Measurements: ${dNorm.measurements}`);
          if (dNorm.certificate_number)
            parts.push(`Certificate #: ${dNorm.certificate_number}`);
          if (dNorm.certificate_lab) parts.push(`Lab: ${dNorm.certificate_lab}`);
          return parts;
        }

        return [];
      } catch {
        return [];
      }
    };

    return (
      <Box
        ref={ref}
        className="invoice-root"
        sx={{
          p: 1,
          background: "#fff",
          color: "#000",
          width: "100%",
          maxWidth: "210mm",
          boxSizing: "border-box",
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: printStyles }} />

        <Box
          className="invoice-header"
          sx={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            mb: 2,
            gap: 2,
            overflow: "hidden",
            borderRadius: 2,
          }}
        >
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: "url(/pattern.png)",
              backgroundRepeat: "repeat",
              backgroundSize: "cover",
              opacity: 0.15,
              pointerEvents: "none",
            }}
          />
          <Box sx={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "center" }}>
            <img
              className="invoice-logo"
              src="/Gaja Black.png"
              alt="GAJA Logo"
              style={{
                width: 250,
                height: "auto",
              }}
            />
          </Box>

          <Box sx={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", gap: 2 }}>
            <Box className="invoice-header-left" sx={{ display: "flex", flexDirection: "column", alignItems: "center" }} bgcolor="#ffffff" border="1px solid #ccc" borderRadius={2}>
              <Chip size="small" label={invoiceTypeLabel} color="primary" sx={{ fontWeight: 800, mb: 0.75 }} />

              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                Invoice No:{" "}
                {invoiceNumFact === 0 ? (
                  <span style={{ color: "red" }}>In Progress</span>
                ) : (
                  invoiceNumFact
                )}
                {invoiceNumFact !== 0 && (
                  <>
                    {" "}
                    {isClosed ? (
                      <span style={{ color: "#2e7d32", fontWeight: 700 }}>(Closed)</span>
                    ) : (
                      <span style={{ color: "#ed6c02", fontWeight: 700 }}>(Open)</span>
                    )}
                  </>
                )}
              </Typography>

              <Typography variant="subtitle2">
                Date: {formatInvoiceDate(currentInvoiceData.date_fact || invoice.date_fact)}
              </Typography>

              <Typography variant="subtitle2">
                {branchName ? `Branch: ${branchName}` : ""}
              </Typography>
            </Box>

            <Box
              className="invoice-header-right"
              bgcolor="#ffffff"
              border="1px solid #ccc"
              borderRadius={2}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                minWidth: 220,
                gap: 0.5,
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#1976d2" }}>
                Client details
              </Typography>
              <Typography sx={{ fontSize: 12 }}>
                <span style={{ fontWeight: "bold" }}>Code:</span>{" "}
                <span style={{ fontFamily: "monospace" }}>
                  {customer?.id_client ?? pdata[0]?.client ?? pdata[0]?.Client?.num_client ?? "N/A"}
                </span>
              </Typography>
              <Typography sx={{ fontSize: 12 }}>
                <span style={{ fontWeight: "bold" }}>Name:</span>{" "}
                <span style={{ fontFamily: "monospace" }}>
                  {customer?.client_name ?? pdata[0]?.Client?.client_name ?? "N/A"}
                </span>
              </Typography>
              <Typography sx={{ fontSize: 12 }}>
                <span style={{ fontWeight: "bold" }}>Tel:</span>{" "}
                <span style={{ fontFamily: "monospace" }}>
                  {customer?.tel_client ?? pdata[0]?.Client?.tel_client ?? "N/A"}
                </span>
              </Typography>
            </Box>
          </Box>
        </Box>
        {useLegacyTableLayout && (
        <Table
          className="invoice-table"
          size="small"
          sx={{ mb: 2, background: "#fff", fontSize: 11 }}
        >
          <TableHead sx={{ background: "#fff" }}>
            <TableRow>
              <TableCell
                className="col-sn"
                sx={{ color: "#000", width: 90, minWidth: 90 }}
              >
                S/N
              </TableCell>
              {typeinv && typeinv.toLowerCase().includes("gold") && (
                <TableCell sx={{ color: "#000", width: 90, minWidth: 90 }}>
                  ID
                </TableCell>
              )}
              {/* New Image column */}
              {showImage && (
                <TableCell
                  className="col-img"
                  sx={{ color: "#000", width: 120, minWidth: 120 }}
                >
                  Image
                </TableCell>
              )}

              {/* Hide Price column if gold */}
              {!(typeinv && typeinv.toLowerCase().includes("gold")) && (
                <TableCell
                  className="col-price"
                  sx={{ color: "#000", width: 80, minWidth: 80 }}
                >
                  Price
                </TableCell>
              )}
              {typeinv && typeinv.toLowerCase().includes("gold") && (
                <>
                  <TableCell sx={{ color: "#000" }}>Weight (g)</TableCell>
                  {showGoldUnitPrices ? (
                    <>
                      <TableCell sx={{ color: "#000" }}>Price /g</TableCell>
                      <TableCell sx={{ color: "#000" }}>Price /piece</TableCell>
                    </>
                  ) : null}
                  <TableCell sx={{ color: "#000" }}>Gold Color</TableCell>
                  <TableCell sx={{ color: "#000" }}>Rush Color</TableCell>
                </>
              )}
              {typeinv && !typeinv.toLowerCase().includes("gold") && (
                <TableCell
                  className="col-details"
                  sx={{ color: "#000", width: "auto" }}
                >
                  Details
                </TableCell>
              )}
              <TableCell
                sx={{ color: "#000", width: 40, minWidth: 40 }}
              ></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={(() => {
                    const baseSN = 1; // S/N
                    const goldId = typeinv && typeinv.toLowerCase().includes("gold") ? 1 : 0; // ID
                    const img = showImage ? 1 : 0; // Image column
                    const isGold =
                      typeinv && typeinv.toLowerCase().includes("gold");
                    const goldMid = showGoldUnitPrices ? 5 : 3; // weight + (price/g + price/piece?) + colors
                    const middle = isGold ? goldMid : 2; // non-gold uses Price + Details
                    const gift = 1; // IS_GIFT
                    return baseSN + goldId + img + middle + gift;
                  })()}
                  align="center"
                >
                  Loading data...
                </TableCell>
              </TableRow>
            ) : (
              <>
                {pdata
                  .flatMap((inv) =>
                    (inv.ACHATs || []).map((item: any) => ({
                      ...item,
                      _parent: inv,
                    }))
                  )
                  .map((item: any, idx: number) => {
                    if (!item) return null;
                    let detailsContent = null;
                    // Defensive: check if item.id_achat is defined
                    // Use the parent invoice's picint for mapping details for each row

                    if (typeinv && typeinv.toLowerCase().includes("watch")) {
                      const parentInvoice = item._parent;
                      const rowId = parentInvoice?.picint;

                      const rowDetails = allWatchDetails[rowId];

                      if (rowDetails) {
                        const parts: string[] = [];
                        if (rowDetails.Brand || rowDetails.brand)
                          parts.push(
                            `Brand: ${rowDetails.Brand?.client_name || rowDetails.brand?.client_name || rowDetails.Brand || rowDetails.brand}`
                          );
                        if (rowDetails.Design_art || rowDetails.design)
                          parts.push(
                            `Product name: ${rowDetails.Design_art || rowDetails.design || ""}`
                          );
                        if (rowDetails.Color)
                          parts.push(`Color: ${rowDetails.Color}`);
                        if (rowDetails.id_achat)
                          parts.push(`Code: ${rowDetails.id_achat}`);
                        if (rowDetails.reference_number)
                          parts.push(
                            `Reference Number: ${rowDetails.reference_number}`
                          );
                        if (rowDetails.serial_number)
                          parts.push(
                            `Serial Number: ${rowDetails.serial_number}`
                          );
                        if (rowDetails.model)
                          parts.push(`Model: ${rowDetails.model}`);
                        if (rowDetails.condition)
                          parts.push(`Condition: ${rowDetails.condition}`);
                        if (rowDetails.case_material)
                          parts.push(
                            `Case Material: ${rowDetails.case_material}`
                          );
                        if (rowDetails.case_size)
                          parts.push(`Case Size: ${rowDetails.case_size}`);
                        if (rowDetails.bracelet_type)
                          parts.push(
                            `Bracelet Type: ${rowDetails.bracelet_type}`
                          );
                        if (rowDetails.dial_color)
                          parts.push(`Dial Color: ${rowDetails.dial_color}`);
                        if (rowDetails.box_papers !== undefined)
                          parts.push(
                            `Box & Papers: ${rowDetails.box_papers ? "Yes" : "No"}`
                          );
                        detailsContent = (
                          <Box component="div">
                            <ul
                              style={{
                                margin: 0,
                                paddingLeft: 18,
                                fontSize: 11,
                              }}
                            >
                              {parts.map((p, i) => (
                                <li key={i}>{p}</li>
                              ))}
                            </ul>
                          </Box>
                        );
                      } else {
                        detailsContent = (
                          <Typography sx={{ fontSize: 11, color: "#888" }}>
                            No data
                          </Typography>
                        );
                      }
                    } else if (
                      (typeinv && (typeinv.toLowerCase().includes("diamond") || typeinv.toLowerCase().includes("gold"))) ||
                      hasDiamondData
                    ) {
                      // Diamond: first try parent picint-based map (mirroring watch logic)
                      const parentInvoice = item._parent;
                      const rowPic = parentInvoice?.picint;
                      const picDetails = rowPic
                        ? allDiamondDetails[rowPic]
                        : null;
                      let dNorm: any = null;
                      if (picDetails) {
                        dNorm = normalizeDiamond(
                          picDetails.OriginalAchatDiamond ||
                            picDetails.purchaseD ||
                            picDetails.OriginalAchat ||
                            picDetails
                        );
                      }
                      if (!dNorm) {
                        // fallback to previous candidate source aggregation
                        const candidateSources: any[] = [];
                        if (picDetails) candidateSources.push(picDetails);
                        const directById = allDiamondDetails[item.id_achat];
                        if (directById) candidateSources.push(directById);
                        const dpAny: any =
                          item.DistributionPurchase ||
                          item.DistributionPurchases ||
                          item.distributionPurchase ||
                          item.distributionPurchases;
                        if (Array.isArray(dpAny))
                          candidateSources.push(...dpAny);
                        else if (dpAny) candidateSources.push(dpAny);
                        candidateSources.push(item);
                        for (const src of candidateSources) {
                          if (!src) continue;
                          const unwrap =
                            src.OriginalAchatDiamond ||
                            src.purchaseD ||
                            src.OriginalAchat ||
                            src;
                          const n = normalizeDiamond(unwrap);
                          if (n) {
                            dNorm = n;
                            break;
                          }
                        }
                      }
                      if (dNorm) {
                        const parts: string[] = [];
                        if (dNorm.Design_art)
                          parts.push(`Product name: ${dNorm.Design_art}`);
                        if (dNorm.CODE_EXTERNAL)
                          parts.push(`Code: ${dNorm.CODE_EXTERNAL}`);
                        if (dNorm.comment_edit)
                          parts.push(`Sales Code: ${dNorm.comment_edit}`);
                        if (dNorm.carat) parts.push(`Carat: ${dNorm.carat}`);
                        if (dNorm.cut) parts.push(`Cut: ${dNorm.cut}`);
                        if (dNorm.color) parts.push(`Color: ${dNorm.color}`);
                        if (dNorm.clarity)
                          parts.push(`Clarity: ${dNorm.clarity}`);
                        if (dNorm.shape) parts.push(`Shape: ${dNorm.shape}`);
                        if (dNorm.measurements)
                          parts.push(`Measurements: ${dNorm.measurements}`);
                        if (dNorm.certificate_number)
                          parts.push(
                            `Certificate #: ${dNorm.certificate_number}`
                          );
                        if (dNorm.certificate_lab)
                          parts.push(`Lab: ${dNorm.certificate_lab}`);
                        detailsContent = (
                          <Box component="div">
                            <ul
                              style={{
                                margin: 0,
                                paddingLeft: 18,
                                fontSize: 11,
                              }}
                            >
                              {parts.map((p, i) => (
                                <li key={i}>{p}</li>
                              ))}
                            </ul>
                          </Box>
                        );
                      } else {
                        detailsContent = (
                          <Typography sx={{ fontSize: 11, color: "#888" }}>
                            No data
                          </Typography>
                        );
                      }
                    }

                    // Inject original watch data for each row if available

                    return (
                      <TableRow
                        key={String(item?.id_achat ?? item?.id_fact ?? item?._parent?.id_fact ?? idx)}
                        sx={{ background: "inherit" }}
                      >
                        <TableCell
                          className="col-sn"
                          sx={{
                            color: "#000",
                            fontSize: 11,
                            padding: "6px 8px",
                            width: 90,
                            minWidth: 90,
                          }}
                        >
                          {idx + 1}
                        </TableCell>
                        {typeinv && typeinv.toLowerCase().includes("gold") && (
                          <TableCell
                            sx={{
                              color: "#000",
                              fontSize: 11,
                              padding: "6px 8px",
                              width: 90,
                              minWidth: 90,
                            }}
                          >
                            {(() => {
                              const parent = item._parent;
                              return parent?.id_art ?? parent?.picint ?? "";
                            })()}
                          </TableCell>
                        )}
                        {/* New Image cell */}
                        {showImage && (
                          <TableCell
                            className="col-img"
                            sx={{
                              color: "#000",
                              fontSize: 11,
                              padding: "6px 8px",
                              minWidth: 120,
                              width: 120,
                            }}
                          >
                            {(() => {
                              const parentInvoice = item._parent;
                              const rowPicint = parentInvoice?.picint ?? item?.picint ?? invoice?.picint;
                              const rowIdFact =
                                item?.id_fact ??
                                parentInvoice?.id_fact ??
                                invoice?.id_fact ??
                                invoice?.num_fact;
                              const rowGoldArtId =
                                parentInvoice?.id_art ??
                                parentInvoice?.ID_ART ??
                                parentInvoice?.Id_Art ??
                                item?.id_art ??
                                item?.ID_ART ??
                                item?.Id_Art ??
                                invoice?.id_art;
                              const rowIdAchatCandidate =
                                item?.id_achat ??
                                item?.ID_ACHAT ??
                                item?.Id_Achat ??
                                parentInvoice?.id_achat ??
                                parentInvoice?.ID_ACHAT ??
                                parentInvoice?.Id_Achat;



                              const makeKey = (v: any) =>
                                v !== undefined && v !== null && String(v).trim() !== ""
                                  ? String(v)
                                  : "";

                              const isGoldType = typeinv?.toLowerCase().includes("gold");
                              const isWatchType = typeinv?.toLowerCase().includes("watch");
                              const isDiamondType = typeinv?.toLowerCase().includes("diamond");
                              
                              // Prefer the correct key per type; placeholder should only be used when there are truly no URLs.
                              let urls: string[] = [];

                              const orderedKeys = [
                                // GOLD MUST USE id_art FIRST
                                makeKey(rowGoldArtId),

                                // keep the rest for watch/diamond fallbacks
                                makeKey(rowIdAchatCandidate),
                                makeKey(rowPicint),
                                makeKey(rowIdFact),
                                makeKey(invoice?.picint),
                                makeKey(invoice?.id_fact ?? invoice?.num_fact),
                              ].filter(Boolean);


                              for (const key of orderedKeys) {
                                if (key && imageUrls[key] && imageUrls[key].length) {
                                  urls = imageUrls[key];
                                  break;
                                }
                              }

                              if (
                                urls.length === 0 &&
                                (typeinv?.toLowerCase().includes("diamond") ||
                                  typeinv?.toLowerCase().includes("gold") ||
                                  hasDiamondData)
                              ) {
                                const dDet =
                                  allDiamondDetails[rowPicint ?? ""] ||
                                  allDiamondDetails[item.id_achat];
                                const unwrap =
                                  dDet &&
                                  (dDet.OriginalAchatDiamond ||
                                    dDet.purchaseD ||
                                    dDet.OriginalAchat ||
                                    dDet);
                                const altId =
                                  unwrap?.id_achat || unwrap?.ID_ACHAT;
                                if (
                                  altId &&
                                  imageUrls[altId] &&
                                  imageUrls[altId].length
                                ) {
                                  urls = imageUrls[altId];
                                }
                              }
                              urls = normalizeImageList(urls);
                              const token = localStorage.getItem("token");
                              // Candidate images already fetched and stored in imageUrls
                              let candidateUrls = Array.isArray(urls) ? urls.filter(Boolean) : [];
                              // Neutral normalization based on source folder, independent of type
                              if (Array.isArray(candidateUrls) && candidateUrls.length) {
                                candidateUrls = candidateUrls.map((u) => {
                                  try {
                                    const t = new URL(u, window.location.origin);
                                    const parts = t.pathname.split('/').filter(Boolean);
                                    // Reduce any already-correct secure path to relative
                                    if (/^\/images\//.test(t.pathname)) return t.pathname;
                                    // Map known upload mounts to secure routes
                                    const len = parts.length;
                                    if (len >= 3) {
                                      const filename = parts[len - 1];
                                      const idSeg = parts[len - 2];
                                      const mount = parts.slice(0, len - 2).join('/').toLowerCase();
                                      if (mount.includes('uploads/goldpic') || mount.includes('uploads/opurchases/upload-attachment') || mount.includes('uploads/purchase')) {
                                        return `/images/gold/${encodeURIComponent(idSeg)}/${encodeURIComponent(filename)}`;
                                      }
                                      if (mount.includes('uploads/watchpic')) {
                                        return `/images/watch/${encodeURIComponent(idSeg)}/${encodeURIComponent(filename)}`;
                                      }
                                    }
                                  } catch {}
                                  return u;
                                });
                              }

                              // Normalize gold URLs to secure route like diamond: /images/gold/:id/:filename
                              if (isGoldType && Array.isArray(candidateUrls) && candidateUrls.length) {
                                candidateUrls = candidateUrls.map((u) => {
                                  try {
                                    // Normalize any absolute URL to relative secure route so we can prefix with API base later
                                    if (/\/images\/gold\//.test(u)) {
                                      const t = new URL(u, window.location.origin);
                                      return t.pathname;
                                    }
                                    const urlObj = new URL(u, window.location.origin);
                                    const parts = urlObj.pathname.split('/').filter(Boolean);
                                    // Expect patterns like /uploads/GoldPic/:id/:file or /uploads/Opurchases/upload-attachment/:id/:file or /uploads/purchase/:id/:file
                                    const len = parts.length;
                                    if (len >= 3) {
                                      const filename = parts[len - 1];
                                      const idSeg = parts[len - 2];
                                      if (idSeg) {
                                        return `/images/gold/${encodeURIComponent(idSeg)}/${encodeURIComponent(filename)}`;
                                      }
                                    }
                                  } catch {}
                                  return u;
                                });
                              }
                              // Normalize watch URLs to secure route: /images/:id/:filename
                              if (isWatchType && Array.isArray(candidateUrls) && candidateUrls.length) {
                                candidateUrls = candidateUrls.map((u) => {
                                  try {
                                    // Skip non-watch types
                                    if (/\/images\/(gold|diamond)\//.test(u)) return u;
                                    // If absolute, reduce to path to ensure API origin is applied later
                                    if (/^https?:\/\//i.test(u)) {
                                      const t = new URL(u);
                                      if (/^\/images\/[^/]+\/[^/]+/.test(t.pathname)) {
                                        return t.pathname;
                                      }
                                    }
                                    // If already relative like /images/:id/:file keep as-is
                                    if (/^\/images\/[^/]+\/[^/]+/.test(u)) return u;
                                    const urlObj = new URL(u, window.location.origin);
                                    const parts = urlObj.pathname.split('/').filter(Boolean);
                                    const len = parts.length;
                                    if (len >= 3) {
                                      const filename = parts[len - 1];
                                      const idSeg = parts[len - 2];
                                      if (idSeg) {
                                        return `/images/watch/${encodeURIComponent(idSeg)}/${encodeURIComponent(filename)}`;
                                      }
                                    }
                                  } catch {}
                                  return u;
                                });
                              }
                              if (candidateUrls.length > 0) {
                                try {
                                  console.log('[InvoiceImages:urls]', {
                                    type: isGoldType ? 'gold' : (isWatchType ? 'watch' : 'other'),
                                    rowPicint,
                                    rowIdAchat: item?.id_achat,
                                    urlsIn: urls,
                                    urlsNormalized: candidateUrls
                                  });
                                } catch {}
                                // If user chose a preferred image for this item, honor it.
                                let preferredUrl: string | null = null;
                                try {
                                  const kind: "gold" | "diamond" | "watch" = isGoldType
                                    ? "gold"
                                    : isWatchType
                                      ? "watch"
                                      : "diamond";

                                  // IMPORTANT:
                                  // - gold must key by id_art
                                  // - watch/diamond can key by id_achat (best) and fallback to picint
                                  const keyId = isGoldType
                                    ? (rowGoldArtId ?? item?.id_art ?? (parentInvoice as any)?.id_art ?? rowPicint ?? invoice?.picint)
                                    : (item?.id_achat ?? rowPicint ?? invoice?.picint);

                                  const prefRaw = localStorage.getItem(getPreferredImageKey(kind, keyId)) || "";
                                  const pref = canonicalizePrefUrl(prefRaw, kind, keyId);

                                  if (pref) {
                                    const idxPref = candidateUrls.findIndex(
                                      (u) => canonicalizePrefUrl(String(u), kind, keyId) === pref
                                    );
                                    if (idxPref >= 0) preferredUrl = candidateUrls[idxPref];
                                  }
                                } catch {
                                  // ignore
                                }

                                // Prefer chosen image; otherwise last candidate (often newest); fallback to first
                                const imgUrl =
                                  preferredUrl ||
                                  candidateUrls[candidateUrls.length - 1] ||
                                  candidateUrls[0];
                                // Ensure the URL targets the correct API base (preserve /api) when using /images/* routes
                                const httpsImg = toApiImageAbsolute(imgUrl);
                                const rowId = parentInvoice?.picint;
                                const urlWithToken = withToken(httpsImg, token);
                                try {
                                  console.log('[InvoiceImages:render] img', {
                                    rowPicint: rowId,
                                    rowIdAchat: item?.id_achat,
                                    isGoldType,
                                    imgUrl: httpsImg,
                                    urlWithToken
                                  });
                                } catch {}
                                return (
                                  <Box
                                    component="img"
                                    src={urlWithToken}
                                    alt="Product"
                                    loading="lazy"
                                    sx={{
                                      width: 100,
                                      height: 100,
                                      objectFit: "cover",
                                      borderRadius: 4,
                                      border: "1px solid #eee",
                                      background: "#fff",
                                    }}
                                    onError={(
                                      e: React.SyntheticEvent<
                                        HTMLImageElement,
                                        Event
                                      >
                                    ) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src =
                                        placeholderImgSrc;
                                    }}
                                  />
                                );
                              } else if (orderedKeys.length) {
                                return (
                                  <Box
                                    component="img"
                                    src={placeholderImgSrc}
                                    alt="Product"
                                    loading="lazy"
                                    sx={{
                                      width: 100,
                                      height: 100,
                                      objectFit: "contain",
                                      borderRadius: 4,
                                      border: "1px solid #eee",
                                      background: "#fff",
                                      p: 1,
                                    }}
                                  />
                                );
                              } else {
                                return null;
                              }
                            })()}
                          </TableCell>
                        )}

                        {/* Hide Price cell if gold */}
                        {!(
                          typeinv && typeinv.toLowerCase().includes("gold")
                        ) && (
                          <TableCell
                            className="col-price"
                            sx={{
                              color: "#000",
                              fontSize: 11,
                              padding: "2px 6px",
                              width: 80,
                              minWidth: 80,
                            }}
                          >
                            {(() => {
                              const isGold = typeinv
                                .toLowerCase()
                                .includes("gold");
                              if (isGold) {
                                return (
                                  (
                                    item.total_remise_final ??
                                    item._parent?.prix_vente ??
                                    0
                                  ).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }) + " LYD"
                                );
                              } else {
                                return (
                                  (
                                    item.total_remise_final ??
                                    item._parent?.prix_vente ??
                                    0
                                  ).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }) + " USD"
                                );
                              }
                            })()}
                          </TableCell>
                        )}
                        {typeinv && typeinv.toLowerCase().includes("gold") && (
                          <>
                            <TableCell
                              sx={{
                                color: "#000",
                                fontSize: 11,
                                padding: "2px 6px",
                              }}
                            >
                              {fmtWeight(item.qty)} g
                            </TableCell>

                            {showGoldUnitPrices ? (
                              <>
                                <TableCell
                                  sx={{
                                    color: "#000",
                                    fontSize: 11,
                                    padding: "2px 6px",
                                  }}
                                >
                                  {(() => {
                                    const parent = item._parent;
                                    const meta = parseMetaFromComment(parent?.COMMENT);
                                    const w = Number(item.qty || 0);
                                    const piece =
                                      meta?.price_per_piece != null
                                        ? Number(meta.price_per_piece)
                                        : Number(parent?.prix_vente_remise ?? parent?.prix_vente ?? 0);
                                    const perGram =
                                      meta?.price_per_gram != null
                                        ? Number(meta.price_per_gram)
                                        : w > 0
                                          ? piece / w
                                          : 0;
                                    return fmt0(perGram);
                                  })()}
                                </TableCell>

                                <TableCell
                                  sx={{
                                    color: "#000",
                                    fontSize: 11,
                                    padding: "2px 6px",
                                  }}
                                >
                                  {(() => {
                                    const parent = item._parent;
                                    const meta = parseMetaFromComment(parent?.COMMENT);
                                    const piece =
                                      meta?.price_per_piece != null
                                        ? Number(meta.price_per_piece)
                                        : Number(parent?.prix_vente_remise ?? parent?.prix_vente ?? 0);
                                    return <span style={{ fontFamily: "monospace" }}>{fmt0(piece)}</span>;
                                  })()}
                                </TableCell>
                              </>
                            ) : null}
                            <TableCell
                              sx={{
                                color: "#000",
                                fontSize: 11,
                                padding: "2px 6px",
                              }}
                            >
                              {item.Color_Gold ?? ""}
                            </TableCell>
                            <TableCell
                              sx={{
                                color: "#000",
                                fontSize: 11,
                                padding: "2px 6px",
                              }}
                            >
                              {item.Color_Rush ?? ""}
                            </TableCell>
                          </>
                        )}
                        {typeinv && !typeinv.toLowerCase().includes("gold") && (
                          <TableCell
                            sx={{
                              color: "#000",
                              minWidth: 120,
                              fontSize: 11,
                              padding: "2px 6px",
                            }}
                          >
                            {detailsContent}
                          </TableCell>
                        )}
                        <TableCell
                          sx={{
                            color: "#000",
                            fontSize: 11,
                            padding: "2px 6px",
                          }}
                        >
                          {item.IS_GIFT ? "Is Gift" : ""}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </>
            )}
          </TableBody>
        </Table>

        )}

        {!useLegacyTableLayout && (
          <Box className="invoice-items" sx={{ mb: 2, display: "flex", flexDirection: "column", gap: 1 }}>
            {loading ? (
              <Box sx={{ p: 1, border: "1px solid #eee", borderRadius: 2 }}>
                <Typography sx={{ fontSize: 12, color: "#666" }}>Loading data...</Typography>
              </Box>
            ) : (
              pdata
                .flatMap((inv: any) =>
                  (inv.ACHATs || []).map((item: any) => ({
                    ...item,
                    _parent: inv,
                  }))
                )
                .map((item: any, idx: number) => {
                  if (!item) return null;
                  const isGold = typeinv && typeinv.toLowerCase().includes("gold");
                  const detailsParts = buildDetailsParts(item);
                  const parent = item?._parent;
                  const goldRowId = parent?.id_art ?? parent?.picint ?? "";

                  const priceText = (() => {
                    const val =
                      item.total_remise_final ?? item._parent?.prix_vente ?? 0;
                    const n = Number(val) || 0;
                    const suffix = isGold ? "LYD" : "USD";
                    return (
                      n.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }) + ` ${suffix}`
                    );
                  })();

                  return (
                    <Box
                      key={String(item?.id_achat ?? item?.id_fact ?? item?._parent?.id_fact ?? idx)}
                      className="invoice-item-card"
                      sx={{
                        border: "1px solid #e9e9e9",
                        borderRadius: 2,
                        p: 1,
                        background: "#fff",
                      }}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "baseline" }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 800 }}>
                          #{idx + 1}
                          {isGold && goldRowId ? (
                            <span style={{ fontWeight: 400, color: "#666", marginLeft: 8 }}>
                              ID: <span style={{ fontFamily: "monospace" }}>{String(goldRowId)}</span>
                            </span>
                          ) : null}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1, alignItems: "baseline" }}>
                          {!isGold ? (
                            <Typography sx={{ fontSize: 12, fontFamily: "monospace", fontWeight: 800 }}>
                              {priceText}
                            </Typography>
                          ) : null}
                          {item.IS_GIFT ? (
                            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#ed6c02" }}>
                              Is Gift
                            </Typography>
                          ) : null}
                        </Box>
                      </Box>

                      <Divider sx={{ my: 0.75 }} />

                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: showImage ? "104px 1fr" : "1fr",
                          gap: 1,
                          alignItems: "start",
                        }}
                      >
                        {showImage ? (
                          <Box sx={{ display: "flex", justifyContent: "center" }}>
                            {renderInvoiceItemImage(item) || (
                              <Box
                                component="img"
                                src={placeholderImgSrc}
                                alt="Product"
                                loading="lazy"
                                sx={{
                                  width: 96,
                                  height: 96,
                                  objectFit: "contain",
                                  borderRadius: 2,
                                  border: "1px solid #eee",
                                  background: "#fff",
                                  p: 1,
                                }}
                              />
                            )}
                          </Box>
                        ) : null}

                        <Box sx={{ minWidth: 0 }}>
                          {isGold ? (
                            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
                              <Typography sx={{ fontSize: 11 }}>
                                <span style={{ fontWeight: 800 }}>Weight:</span>{" "}
                                <span style={{ fontFamily: "monospace" }}>{fmtWeight(item.qty)} g</span>
                              </Typography>
                              <Typography sx={{ fontSize: 11 }}>
                                <span style={{ fontWeight: 800 }}>Gold Color:</span>{" "}
                                <span style={{ fontFamily: "monospace" }}>{item.Color_Gold ?? ""}</span>
                              </Typography>

                              {showGoldUnitPrices ? (
                                <>
                                  <Typography sx={{ fontSize: 11 }}>
                                    <span style={{ fontWeight: 800 }}>Price /g:</span>{" "}
                                    <span style={{ fontFamily: "monospace" }}>
                                      {(() => {
                                        const meta = parseMetaFromComment(parent?.COMMENT);
                                        const w = Number(item.qty || 0);
                                        const piece =
                                          meta?.price_per_piece != null
                                            ? Number(meta.price_per_piece)
                                            : Number(parent?.prix_vente_remise ?? parent?.prix_vente ?? 0);
                                        const perGram =
                                          meta?.price_per_gram != null
                                            ? Number(meta.price_per_gram)
                                            : w > 0
                                              ? piece / w
                                              : 0;
                                        return fmt0(perGram);
                                      })()}
                                    </span>
                                  </Typography>
                                  <Typography sx={{ fontSize: 11 }}>
                                    <span style={{ fontWeight: 800 }}>Price /piece:</span>{" "}
                                    <span style={{ fontFamily: "monospace" }}>
                                      {(() => {
                                        const meta = parseMetaFromComment(parent?.COMMENT);
                                        const piece =
                                          meta?.price_per_piece != null
                                            ? Number(meta.price_per_piece)
                                            : Number(parent?.prix_vente_remise ?? parent?.prix_vente ?? 0);
                                        return fmt0(piece);
                                      })()}
                                    </span>
                                  </Typography>
                                </>
                              ) : null}

                              <Typography sx={{ fontSize: 11 }}>
                                <span style={{ fontWeight: 800 }}>Rush Color:</span>{" "}
                                <span style={{ fontFamily: "monospace" }}>{item.Color_Rush ?? ""}</span>
                              </Typography>
                            </Box>
                          ) : (
                            <>
                              {detailsParts.length ? (
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                                  {detailsParts.map((p, i) => (
                                    <Typography key={i} sx={{ fontSize: 11, lineHeight: 1.25 }}>
                                      {p}
                                    </Typography>
                                  ))}
                                </Box>
                              ) : (
                                <Typography sx={{ fontSize: 11, color: "#888" }}>No data</Typography>
                              )}
                            </>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  );
                })
            )}
          </Box>
        )}

        {typeinv && typeinv.toLowerCase().includes("gold") && (
          <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
            {(() => {
              const currentInvoiceData = pdata.find((inv: any) => inv.num_fact === invoiceNumFact) || {};
              const dsMeta = parseDsMetaFromComment(currentInvoiceData?.COMMENT || invoice?.COMMENT);

              const discValue = Number(dsMeta?.discount_value ?? 0) || 0;
              const surValue = Number(dsMeta?.surcharge_value ?? 0) || 0;
              const discPer = Number(dsMeta?.discount_per ?? 0) || 0;
              const surPer = Number(dsMeta?.surcharge_per ?? 0) || 0;

              const netValue = Number(data.remise) || 0;
              const netPer = Number(data.remise_per) || 0;

              const effectiveDiscValue = dsMeta ? discValue : (netValue < 0 ? Math.abs(netValue) : 0);
              const effectiveSurValue = dsMeta ? surValue : (netValue > 0 ? netValue : 0);
              const effectiveDiscPer = dsMeta ? discPer : (netPer < 0 ? Math.abs(netPer) : 0);
              const effectiveSurPer = dsMeta ? surPer : (netPer > 0 ? netPer : 0);

              const nonGiftAchat = pdata
                .flatMap((inv: any) => (inv.ACHATs || []).map((a: any) => ({ ...a, _p: inv })))
                .filter((a: any) => !a?._p?.IS_GIFT);

              const subtotalNonGift = nonGiftAchat.reduce((sum: number, a: any) => {
                const parent = a._p;
                const m = parseMetaFromComment(parent?.COMMENT);
                const piece =
                  m?.price_per_piece != null
                    ? Number(m.price_per_piece)
                    : Number(parent?.prix_vente_remise ?? parent?.prix_vente ?? 0);
                return sum + (Number(piece) || 0);
              }, 0);

              const discFromPercent = subtotalNonGift * (effectiveDiscPer / 100);
              const surFromPercent = subtotalNonGift * (effectiveSurPer / 100);

              const showDiscount = effectiveDiscValue > 0 || effectiveDiscPer > 0;
              const showSurcharge = effectiveSurValue > 0 || effectiveSurPer > 0;

              return (
                <>
                  {showDiscountValues && showDiscount ? (
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontWeight: 700, color: "#d32f2f" }}>
                        Discount
                      </Typography>
                      <Typography sx={{ fontFamily: "monospace", color: "#d32f2f" }}>
                        {(() => {
                          const parts: string[] = [];
                          if (effectiveDiscValue > 0) parts.push(fmt0(effectiveDiscValue));
                          if (effectiveDiscPer > 0) parts.push(`${fmt0(effectiveDiscPer)}% (${fmt0(discFromPercent)})`);
                          return parts.join(" + ");
                        })()}
                      </Typography>
                    </Box>
                  ) : null}
                  {showSurchargeValues && showSurcharge ? (
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontWeight: 700, color: "#2e7d32" }}>
                        Surcharge
                      </Typography>
                      <Typography sx={{ fontFamily: "monospace", color: "#2e7d32" }}>
                        {(() => {
                          const parts: string[] = [];
                          if (effectiveSurValue > 0) parts.push(fmt0(effectiveSurValue));
                          if (effectiveSurPer > 0) parts.push(`${fmt0(effectiveSurPer)}% (${fmt0(surFromPercent)})`);
                          return parts.join(" + ");
                        })()}
                      </Typography>
                    </Box>
                  ) : null}
                </>
              );
            })()}
          </Box>
        )}

        <Box
          className="invoice-totals"
          sx={{
            mt: 3,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            width: "100%",
          }}
        >
          <Box
            className="totals-left"
            sx={{ display: "flex", flexDirection: "column", gap: 1 }}
          >
            <Typography sx={{ fontWeight: "bold" }}>
              <span>Total Items:</span>{" "}
              <span style={{ fontFamily: "monospace", fontWeight: 400 }}>
                {itemCount.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </span>
            </Typography>
            {/* Always show Total LYD */}

            {typeinv && typeinv.toLowerCase().includes("gold") && (
              <>
                {(Number(totalAmountLYD) || 0) > moneyEps ? (
                  <Typography>
                    <span style={{ fontWeight: "bold" }}>Total LYD:</span>
                    <span style={{ fontFamily: "monospace" }}>
                      {fmt0(totalAmountLYD)}
                    </span>
                  </Typography>
                ) : null}
                <Typography>
                  <span style={{ fontWeight: "bold" }}>Total Weight:</span>
                  <span style={{ fontFamily: "monospace" }}>
                    {fmtWeight(computedGoldTotalWeight)} g
                  </span>
                </Typography>
              </>
            )}
            {typeinv && !typeinv.toLowerCase().includes("gold") && (
              <>
                {/* Total USD after discount */}
                {(Number(TotalAmountFinal) || 0) > 0 ? (
                  <Typography>
                    <span style={{ fontWeight: "bold" }}>Total USD: </span>
                    <span style={{ fontFamily: "monospace" }}>
                      {TotalAmountFinal.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </Typography>
                ) : null}

                {(() => {
                  const netValue = Number(data.remise) || 0;
                  const netPer = Number(data.remise_per) || 0;
                  const hasDiscount = netValue < 0 || netPer < 0;
                  const hasSurcharge = netValue > 0 || netPer > 0;
                  const absValue = Math.abs(netValue);
                  const absPer = Math.abs(netPer);

                  return (
                    <>
                      {showDiscountValues && hasDiscount ? (
                        <Typography>
                          <span style={{ fontWeight: "bold" }}>Discount:</span>{" "}
                          <span style={{ fontFamily: "monospace", color: "#d32f2f" }}>
                            {absValue > 0
                              ? absValue.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : absPer.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }) + "%"}
                          </span>
                        </Typography>
                      ) : null}

                      {showSurchargeValues && hasSurcharge ? (
                        <Typography>
                          <span style={{ fontWeight: "bold" }}>Surcharge:</span>{" "}
                          <span style={{ fontFamily: "monospace", color: "#2e7d32" }}>
                            {absValue > 0
                              ? absValue.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : absPer.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }) + "%"}
                          </span>
                        </Typography>
                      ) : null}
                    </>
                  );
                })()}

                {/* Total USD after discount */}
                <Typography>
                  <span style={{ fontWeight: "bold" }}>Final Price in USD: </span>
                  <span style={{ fontFamily: "monospace" }}>
                    {(Number(TotalAmountFinal) || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </Typography>
              </>
            )}
          </Box>
          <Box
            className="totals-right"
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              textAlign: "right",
            }}
          >
            {(() => {
              const pickNumber = (...values: any[]) => {
                for (const val of values) {
                  const num = Number(val);
                  if (Number.isFinite(num)) return num;
                }
                return 0;
              };

              const lyd = Number(amount_lyd) || 0;
              const usd = Number(amount_currency) || 0;
              const eur = Number(amount_EUR) || 0;
              const usdLyd = Number(paidUsdLyd) || 0;
              const eurLyd = Number(paidEurLyd) || 0;
              const paidTotalLydEquiv = lyd + usdLyd + eurLyd;

              const supplierType = String(typeinv || "").toLowerCase();
              const isGoldInv = supplierType.includes("gold");
              const restLydFromInvoice = pickNumber(
                (invoice as any)?.rest_of_money,
                (invoice as any)?.rest_of_moneyLYD,
                (invoice as any)?.rest_of_money_lyd
              );
              const restUsdFromInvoice = pickNumber(
                (invoice as any)?.rest_of_moneyUSD,
                (invoice as any)?.rest_of_money_usd
              );

              const totalUsd = pickNumber(
                invoice?.total_remise_final_after_discount,
                TotalAmountFinal,
                invoice?.total_remise_final,
                totalAmountUSD
              );
              const totalLyd = pickNumber(
                invoice?.total_remise_final,
                totalAmountLYD,
                totalAmountUSD
              );

              const usdRate = usd > 0 && usdLyd > 0 ? (usdLyd / usd) : NaN;

              const diffLyd = restLydFromInvoice
                ? normalizeLyd0(restLydFromInvoice)
                : normalizeLyd0(totalLyd) - normalizeLyd0(paidTotalLydEquiv);

              const computeDiscountValue = () => {
                if (restUsdFromInvoice != null) return 0;
                const netValue = Number(data?.remise) || 0;
                const netPer = Number(data?.remise_per) || 0;
                if (netValue < 0) return Math.abs(netValue);
                if (netPer < 0) {
                  const base = pickNumber(
                    invoice?.total_remise_final_after_discount,
                    TotalAmountFinal,
                    invoice?.total_remise_final,
                    totalAmountUSD
                  );
                  return Math.abs(netPer) > 0 ? base * (Math.abs(netPer) / 100) : 0;
                }
                return 0;
              };

              const rawDiffUsd = restUsdFromInvoice
                ? restUsdFromInvoice
                : (Number.isFinite(totalUsd) ? totalUsd : 0) - (Number.isFinite(usd) ? usd : 0);
              const discountAdjustment = computeDiscountValue();
              const diffUsdAdjusted =
                restUsdFromInvoice != null
                  ? rawDiffUsd
                  : rawDiffUsd - discountAdjustment;
              const diffUsd0 = Math.round((Number(diffUsdAdjusted) || 0) * 100) / 100;
              const hasRemainder = isGoldInv ? diffLyd > moneyEps : diffUsd0 > moneyEps;
              const isPaidInFull = isGoldInv ? Math.abs(diffLyd) <= moneyEps : Math.abs(diffUsd0) <= moneyEps;
              const paidColor = isPaidInFull ? "#2e7d32" : "#d04444ff";

              const lines: Array<{ label: string; amount: number; value: string; equivLyd?: number }> = [
                { label: "LYD", amount: lyd, value: fmt0(lyd) },
                { label: "USD", amount: usd, value: fmt0(usd), equivLyd: usdLyd },
                { label: "EUR", amount: eur, value: fmt0(eur), equivLyd: eurLyd },
              ].filter((l) => (Number(l.amount) || 0) > moneyEps);

              return (
                <>
                  {lines.length ? (
                    <Typography>
                      <span style={{ fontWeight: "bold" }}>Payments:</span>
                    </Typography>
                  ) : null}
                  {lines.map((l) => {
                    const suffix = l.label;
                    return (
                      <Typography key={l.label} sx={{ mt: 0.25 }}>
                        <span style={{ fontWeight: "bold" }}>{l.label}:</span>{" "}
                        <span style={{ fontFamily: "monospace" }}>{l.value} {suffix}</span>
                        {l.equivLyd && l.equivLyd > moneyEps ? (
                          <span style={{ color: "#666" }}> ({fmt0(l.equivLyd)} LYD)</span>
                        ) : null}
                      </Typography>
                    );
                  })}
                  {isGoldInv ? (
                    paidTotalLydEquiv > moneyEps ? (
                      <Typography sx={{ mt: 0.5 }}>
                        <span style={{ fontWeight: "bold" }}>Paid total:</span>{" "}
                        <span style={{ fontFamily: "monospace", color: paidColor }}>
                          {fmt0(paidTotalLydEquiv)} LYD
                        </span>
                      </Typography>
                    ) : null
                  ) : (
                    usd > moneyEps ? (
                      <Typography sx={{ mt: 0.5 }}>
                        <span style={{ fontWeight: "bold" }}>Paid total:</span>{" "}
                        <span style={{ fontFamily: "monospace", color: paidColor }}>
                          {fmt0(usd)} USD
                        </span>
                        {Number.isFinite(usdRate) && usdRate > 0 ? (
                          <span style={{ color: "#666" }}> ({fmt0(usd * usdRate)} LYD)</span>
                        ) : null}
                      </Typography>
                    ) : null
                  )}
                  {hasRemainder && (
                    <Typography sx={{ mt: 0.25 }}>
                      <span style={{ fontWeight: "bold", color: "#d04444ff" }}>
                        Remainder:
                      </span>{" "}
                      <span style={{ fontFamily: "monospace", color: "#d04444ff" }}>
                        {isGoldInv ? (
                          <>
                            {fmt0(diffLyd)} LYD
                          </>
                        ) : (
                          <>
                            {diffUsd0.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                            {Number.isFinite(usdRate) && usdRate > 0 ? (
                              <span style={{ color: "#666" }}> ({fmt0(diffUsd0 * usdRate)} LYD)</span>
                            ) : null}
                          </>
                        )}
                      </span>
                    </Typography>
                  )}
                </>
              );
            })()}
          </Box>
        </Box>

        <Box
          className="invoice-bottom"
          sx={{ display: "flex", flexDirection: "column" }}
        >

        <Box
          className="invoice-footer"
          sx={{
            mt: 4,
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "flex-end",
            width: "100%",
          }}
        >
          <Box
            className="invoice-footer-content"
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 2,
              mr: 2,
            }}
          >
            {/* Created by user section */}
            {createdBy && String(createdBy).trim() !== "" ? (
              <div
                className="created-by"
                style={{ display: "flex", alignItems: "center" }}
              >
                <span
                  style={{
                    fontWeight: "bold",
                    color: "inherit",
                    marginRight: 6,
                  }}
                >
                  Issued by:
                </span>
                <span style={{ color: "#666" }}>{createdBy}</span>
              </div>
            ) : (
              userStr &&
              (() => {
                let user = "";
                try {
                  const userObj = JSON.parse(userStr);
                  user = userObj.name_user;
                } catch {
                  user = userStr;
                }
                return (
                  <div
                    className="created-by"
                    style={{ display: "flex", alignItems: "center" }}
                  >
                    <span
                      style={{
                        fontWeight: "bold",
                        color: "inherit",
                        marginRight: 6,
                      }}
                    >
                      Issued by:
                    </span>
                    <span style={{ color: "#666" }}>{user}</span>
                  </div>
                );
              })()
            )}
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <img
                className="invoice-stamp"
                src="/stamps.png"
                alt="Stamp"
                style={{
                  width: 72,
                  height: "auto",
                  borderRadius: 6,
                  display: "block",
                  marginLeft: 6,
                }}
              />
            </Box>
          </Box>
        </Box>

        {/* Notes & Warnings: Render on a separate page for printing */}
        <div>
          <Box
            sx={{
              mt: 2,
              fontSize: 11,
              color: "#444",
              background: "#f9f9f9",
              borderRadius: 1,
              p: 2,
              border: "1px dashed #1976d2",
            }}
          >
            {(() => {
              if (typeinv && typeinv.toLowerCase().includes("gold")) {
                // Gold standard international sale conditions
                return (
                  <>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: "bold",
                        color: "#1976d2",
                        mb: 1,
                        fontSize: 12,
                      }}
                    >
                      Notes & Warnings (International Standard for Gold Sales)
                    </Typography>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11 }}>
                      <li>
                        This invoice is issued in accordance with international
                        gold trade standards and may be used for customs,
                        insurance, and legal purposes.
                      </li>
                      <li>
                        All gold weights, purities, and values are as per the
                        attached certificate and/or supplier declaration.
                      </li>
                      <li>
                        Buyers are advised to verify all details, including
                        certificate authenticity and gold specifications, before
                        finalizing any transaction.
                      </li>
                      <li>
                        Gold items are subject to natural variations; minor
                        differences in weight or purity may occur between
                        laboratories or manufacturers.
                      </li>
                      <li>
                        Returns, exchanges, or claims must be made within the
                        period and under the conditions stated in the company’s
                        policy.
                      </li>
                      <li>
                        For insurance, customs, or export, always refer to the
                        original certificate and this invoice together.
                      </li>
                      <li>
                        Warning: Gold may be subject to international trade
                        restrictions, sanctions, or reporting requirements.
                        Ensure compliance with all applicable laws and
                        standards.
                      </li>
                      <li>
                        For further information, contact our customer service or
                        visit our website.
                      </li>
                    </ul>
                    <Typography
                      sx={{
                        mt: 1,
                        color: "#d32f2f",
                        fontWeight: "bold",
                        fontSize: 11,
                      }}
                    >
                      Warning: Total price is valid for 24 hours; after that,
                      the total will be recalculated using the current rate at
                      the time of payment.
                    </Typography>
                  </>
                );
              } else if (typeinv && typeinv.toLowerCase().includes("watch")) {
                // Watch warning
                return (
                  <>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: "bold",
                        color: "#1976d2",
                        mb: 1,
                        fontSize: 12,
                      }}
                    >
                      Notes & Warnings (International Standard for Watches)
                    </Typography>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11 }}>
                      <li>
                        This invoice is issued in accordance with international
                        diamond watch trade standards and may be used for
                        customs, insurance, and legal purposes.
                      </li>
                      <li>
                        All diamond watch characteristics (carat, cut, color,
                        clarity, shape, measurements, movement, model, etc.) are
                        as per the attached certificate and/or supplier
                        declaration.
                      </li>
                      <li>
                        Buyers are advised to verify all details, including
                        certificate authenticity and watch specifications,
                        before finalizing any transaction.
                      </li>
                      <li>
                        Diamond watches are subject to natural variations; minor
                        differences in grading or craftsmanship may occur
                        between laboratories or manufacturers.
                      </li>
                      <li>
                        Returns, exchanges, or claims must be made within the
                        period and under the conditions stated in the company’s
                        policy.
                      </li>
                      <li>
                        For insurance, customs, or export, always refer to the
                        original certificate and this invoice together.
                      </li>
                      <li>
                        Warning: Diamond watches may be subject to international
                        trade restrictions, sanctions, or reporting
                        requirements. Ensure compliance with all applicable laws
                        and standards.
                      </li>
                      <li>
                        For further information, contact our customer service or
                        visit our website.
                      </li>
                    </ul>
                    <Typography
                      sx={{
                        mt: 1,
                        color: "#d32f2f",
                        fontWeight: "bold",
                        fontSize: 11,
                      }}
                    >
                      Warning: Total price is valid for 24 hours; after that,
                      the total will be recalculated using the current rate at
                      the time of payment.
                    </Typography>
                  </>
                );
              } else {
                // Diamond warning (existing)
                return (
                  <>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: "bold",
                        color: "#1976d2",
                        mb: 1,
                        fontSize: 12,
                      }}
                    >
                      Notes & Warnings (International Standard for Diamonds)
                    </Typography>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11 }}>
                      <li>
                        This invoice is issued in accordance with international
                        diamond trade standards and may be used for customs,
                        insurance, and legal purposes.
                      </li>
                      <li>
                        All diamond characteristics (carat, cut, color, clarity,
                        shape, measurements, etc.) are as per the attached
                        certificate and/or supplier declaration.
                      </li>
                      <li>
                        Buyers are advised to verify all details, including
                        certificate authenticity, before finalizing any
                        transaction.
                      </li>
                      <li>
                        Diamonds are subject to natural variations; minor
                        differences in grading may occur between laboratories.
                      </li>
                      <li>
                        Returns, exchanges, or claims must be made within the
                        period and under the conditions stated in the company’s
                        policy.
                      </li>
                      <li>
                        For insurance, customs, or export, always refer to the
                        original certificate and this invoice together.
                      </li>
                      <li>
                        Warning: Diamonds may be subject to international trade
                        restrictions, sanctions, or reporting requirements.
                        Ensure compliance with all applicable laws.
                      </li>
                      <li>
                        For further information, contact our customer service or
                        visit our website.
                      </li>
                    </ul>
                    <Typography
                      sx={{
                        mt: 1,
                        color: "#d32f2f",
                        fontWeight: "bold",
                        fontSize: 11,
                      }}
                    >
                      Warning: Total price is valid for 24 hours; after that,
                      the total will be recalculated using the current rate at
                      the time of payment.
                    </Typography>
                  </>
                );
              }
            })()}
          </Box>
        </div>

        </Box>
      </Box>
    );
  }
);

export default WatchStandardInvoiceContent; 