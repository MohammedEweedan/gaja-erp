import React, { forwardRef, useEffect, useState, useMemo } from "react";
import { useCallback } from "react";
import QRCode from "react-qr-code";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import { Invoice, Client } from "./PrintInvoiceDialog";
import axios from "../../../api";

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

interface Props {
  data: InvoicePrintData;
  num_fact?: number; // Add num_fact as an optional prop
  showImage?: boolean; // Add showImage prop
  showGoldUnitPrices?: boolean;
  createdBy?: string; // creator name passed from parent (SalesReportsTable -> PrintInvoiceDialog)
}

const WatchStandardInvoiceContent = forwardRef<HTMLDivElement, Props>(
  ({ data, num_fact, showImage = true, showGoldUnitPrices = true, createdBy }, ref) => {
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

    const moneyEps = 0.01;
    const normalizeLyd0 = (v: number) => Math.round(Number(v) || 0);

    const getPreferredImageKey = (kind: "gold" | "diamond" | "watch", id: any) =>
      `prefImg:${kind}:${String(id ?? "").trim()}`;

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
    }, [pdata, items]);

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
      const v = currentInvoiceData;
      const candidates = [v?.is_closed, v?.IS_CLOSED, v?.IS_OK, v?.is_ok];
      return candidates.some(
        (c: any) => c === true || c === 1 || c === "1" || c === "true"
      );
    })();

    const qrData = JSON.stringify({
      invoiceNo: invoice.num_fact,
      date: invoice.date_fact,
      customer: customer?.client_name,
      totalLYD: totalAmountLYD,
      totalUSD: totalAmountUSD,
      totalEUR: totalAmountEur,
      totalWeight,
      itemCount,
      items: items.map((i) => ({
        id: i.id_art,
        qty: i.qty,
        price: i.prix_vente,
        currency: i.currency,
      })),
    });

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

    // Typed fetch helper (watch | diamond) with dual base support
    const fetchImagesTyped = async (
      id: number | string,
      type: "watch" | "diamond"
    ): Promise<string[] | null> => {
      const token = localStorage.getItem("token");
      try {
        for (const base of IMAGE_BASES) {
          const url = `${base}/list/${type}/${id}`;
          try { console.log('[InvoiceImages:fetch] GET', url); } catch {}
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
            if (out.length) return out;
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
      // Diamond should not trigger for gold-only; honor explicit diamond type or detected diamond details without gold
      const isDiamond = !!(
        (typeinv && typeinv.toLowerCase().includes("diamond")) ||
        (hasDiamondData && !isGold)
      );
      if (!(isWatch || isDiamond || isGold)) return;

      // Build candidate ids
      let sourceIds: string[] = [];
      if (isWatch) {
        sourceIds = Object.keys(allWatchDetails);
        // Fallback: if no watch details yet, use invoice/item picint-based ids
        if (sourceIds.length === 0) {
          sourceIds = pdata
            .map((inv) => inv.picint)
            .filter(Boolean)
            .map(String);
          if (sourceIds.length === 0) {
            sourceIds = items
              .map((it: any) => it.picint || it.id_fact || it.id_achat)
              .filter(Boolean)
              .map(String);
          }
        }
      } else if (isDiamond) {
        sourceIds = Object.keys(allDiamondDetails);
        if (sourceIds.length === 0) {
          sourceIds = pdata.map((inv) => inv.picint).filter(Boolean);
        }
      } else if (isGold) {
        // For gold, images are stored per ACHAT id_achat; fetch by those ids.
        sourceIds = pdata
          .flatMap((inv) => (inv?.ACHATs || []).map((a: any) => a?.id_achat))
          .filter(Boolean)
          .map(String);
        if (sourceIds.length === 0) {
          sourceIds = (items || [])
            .flatMap((it: any) => (it?.ACHATs || []).map((a: any) => a?.id_achat))
            .filter(Boolean)
            .map(String);
        }
      }
      const unique = Array.from(new Set(sourceIds)).filter(Boolean);
      // Emit a clear log so we can see mode and ids considered
      console.log('[InvoiceImages:config]', { API_BASEImage, axiosBase: (axios as any)?.defaults?.baseURL });
      console.log('[InvoiceImages:init]', { isWatch, isGold, isDiamond, sourceCount: sourceIds.length, unique });
      (async () => {
        for (const id of unique) {
          if (!id) continue;
          if (imageUrls[id]) continue; // already have
          // Debug: trace image fetch attempts (use console.log to avoid stripped debug)
          console.log('[InvoiceImages] fetching for key', id, { typeinv, isWatch, isGold, isDiamond });
          if (isWatch) {
            // For watches, images are stored under id_achat on the server.
            // Map picint -> candidate id_achat values and fetch using those.
            const detail = allWatchDetails[id];
            const candidateIds: string[] = [];
            const pushId = (v: any) => {
              if (v !== undefined && v !== null) {
                const s = String(v).trim();
                if (s !== "" && !candidateIds.includes(s)) candidateIds.push(s);
              }
            };
            if (detail) {
              // common fields that may carry purchase id
              pushId(detail.id_achat);
              pushId(detail.ID_ACHAT);
              pushId(detail.purchase_id);
              pushId(detail.idAchat);
              pushId(detail.IDACHAT);
              // nested common shapes
              const nestedA = detail.OriginalAchat || detail.originalAchat || detail.achat || detail.Achat || detail.purchase || detail.Purchase;
              if (nestedA && typeof nestedA === 'object') {
                pushId(nestedA.id_achat);
                pushId(nestedA.ID_ACHAT);
                pushId(nestedA.idAchat);
                pushId(nestedA.IDACHAT);
                pushId(nestedA.purchase_id);
              }
            }
            // Also scan ACHAT rows from the matching invoice by picint
            pdata
              .filter((inv) => String(inv.picint) === String(id))
              .forEach((inv) => {
                (inv.ACHATs || []).forEach((a: any) => pushId(a?.id_achat));
              });

            let fetched = false;
            console.log('[InvoiceImages] watch candidateIds', candidateIds);
            for (const cid of candidateIds) {
              if (!cid) continue;
              console.log('[InvoiceImages] watch candidate id_achat', cid);
              // Avoid re-fetching if we already have URLs under this cid
              if (imageUrls[cid]) {
                setImageUrls((prev) => ({ ...prev, [id]: prev[cid] }));
                fetched = true;
                break;
              }
              let urls = await fetchImagesTyped(cid, "watch");
              // Fallback to default watch list if typed returns empty
              if (!urls || urls.length === 0) {
                try {
                  const token = localStorage.getItem('token');
                  const fUrl = `${API_BASEImage}/list/${cid}`;
                  try { console.log('[InvoiceImages:fetch-fallback] GET', fUrl); } catch {}
                  const r = await axios.get(fUrl, { headers: { Authorization: `Bearer ${token}` } });
                  if (Array.isArray(r.data) && r.data.length) urls = normalizeImageList(r.data);
                  try { console.log('[InvoiceImages:fetch-fallback] OK', { url: fUrl, count: Array.isArray(r.data) ? r.data.length : 0 }); } catch {}
                } catch {}
              }
              if (urls && urls.length) {
                // Store under both the picint key and id_achat key for easy lookup later
                setImageUrls((prev) => ({ ...prev, [id]: urls, [cid]: urls }));
                fetched = true;
                console.log('[InvoiceImages] watch fetched', { key: id, id_achat: cid, count: urls.length });
                break;
              }
            }
            // If no candidate id_achat found, last resort try the picint (legacy paths)
            if (!fetched) {
              console.log('[InvoiceImages] watch fallback picint', id);
              let urls = await fetchImagesTyped(id, "watch");
              if (!urls || urls.length === 0) {
                try {
                  const token = localStorage.getItem('token');
                  const fUrl = `${API_BASEImage}/list/${id}`;
                  try { console.log('[InvoiceImages:fetch-fallback] GET', fUrl); } catch {}
                  const r = await axios.get(fUrl, { headers: { Authorization: `Bearer ${token}` } });
                  if (Array.isArray(r.data) && r.data.length) urls = normalizeImageList(r.data);
                  try { console.log('[InvoiceImages:fetch-fallback] OK', { url: fUrl, count: Array.isArray(r.data) ? r.data.length : 0 }); } catch {}
                } catch {}
              }
              if (urls && urls.length) {
                setImageUrls((prev) => ({ ...prev, [id]: urls }));
                console.log('[InvoiceImages] watch fallback picint fetched', { key: id, count: urls.length });
              }
            }
          } else if (isDiamond) {
            // Try diamond by this id (picint) first
            let urls = await fetchImagesTyped(Number(id), "diamond");
            if (!urls || urls.length === 0) {
              // Fallback: attempt to find any id_achat inside diamond details object
              const detail = allDiamondDetails[id];
              const candidateIds: number[] = [];
              const pushId = (v: any) => {
                if (v && !isNaN(Number(v))) candidateIds.push(Number(v));
              };
              if (detail) {
                const unwrap =
                  detail.OriginalAchatDiamond ||
                  detail.purchaseD ||
                  detail.OriginalAchat ||
                  detail;
                pushId(unwrap?.id_achat);
                pushId(unwrap?.ID_ACHAT);
              }
              // Also scan ACHAT rows referencing this picint
              pdata
                .filter((inv) => String(inv.picint) === String(id))
                .forEach((inv) => {
                  (inv.ACHATs || []).forEach((a: any) => pushId(a?.id_achat));
                });
              for (const cid of candidateIds) {
                if (cid && !imageUrls[cid]) {
                  console.log('[InvoiceImages] diamond candidate id_achat', cid);
                  const u2 = await fetchImagesTyped(cid, "diamond");
                  if (u2 && u2.length) {
                    // store under both cid and original id so render fallback works
                    setImageUrls((prev) => ({ ...prev, [id]: u2, [cid]: u2 }));
                    urls = u2;
                    console.log('[InvoiceImages] diamond fetched', { key: id, id_achat: cid, count: u2.length });
                    break;
                  }
                }
              }
            } else {
              // urls is typed (string[] | null); ensure non-null for state shape
              setImageUrls((prev) => ({ ...prev, [id]: urls || [] }));
            }
          } else if (isGold) {
            // Gold images are stored per id_achat. Build candidates and fetch.
            const token = localStorage.getItem("token");
            // Here `id` is expected to already be an id_achat.
            const cid = String(id);
            let fetched = false;
            if (cid) {
              // If we already fetched for this cid, map it to this id and stop
              if (imageUrls[cid]) {
                setImageUrls((prev) => ({ ...prev, [id]: prev[cid] }));
                fetched = true;
              }
              try {
                console.log('[InvoiceImages] gold id_achat', cid);
                let urls: string[] = [];
                try {
                  for (const base of IMAGE_BASES) {
                    const gUrl = `${base}/list/gold/${cid}`;
                    try { console.log('[InvoiceImages:fetch-gold] GET', gUrl); } catch {}
                    try {
                      const r = await axios.get(gUrl,
                        { headers: { Authorization: `Bearer ${token}` } });
                      if (Array.isArray(r.data) && r.data.length) {
                        urls = normalizeImageList(r.data);
                        break;
                      }
                    } catch {
                      /* try next */
                    }
                  }
                } catch {}
                if (urls && urls.length) {
                  setImageUrls((prev) => ({ ...prev, [id]: urls, [cid]: urls }));
                  fetched = true;
                  console.log('[InvoiceImages] gold fetched', { id_achat: cid, count: urls.length });
                }
              } catch {}
            }
            if (!fetched) {
              setImageUrls((prev) => ({ ...prev, [id]: [] }));
            }
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
                .invoice-table, table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; }
                /* center most table cells for tidy print; details column remains left-aligned */
                .invoice-table td, .invoice-table th, td, th { word-break: break-word !important; overflow-wrap: break-word !important; vertical-align: middle !important; text-align: left !important; }
                .col-details, .invoice-table .col-details { text-align: left !important; vertical-align: top !important; }
                img { max-width: 100% !important; height: auto !important; display: block !important; }
                .no-break { page-break-inside: avoid !important; -webkit-page-break-inside: avoid !important; }
                .MuiBox-root, .MuiTypography-root { -webkit-print-color-adjust: exact; }

                /* Header layout for print: keep logo left and QR/customer right */
                .invoice-header { display: flex !important; justify-content: space-between !important; align-items: flex-start !important; gap: 8px !important; }
                .invoice-header-left { display: flex !important; flex-direction: column !important; align-items: flex-start !important; }
                .invoice-header-right { display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; min-width: 140px !important; }
                .invoice-header-right .MuiBox-root { width: 100% !important; }
                .invoice-header-right > * + * { margin-top: 8px !important; }
                /* Ensure customer info shows cleanly in print/PDF */
                .invoice-header-right .customer-box { border: none !important; background: #fff !important; padding: 8px !important; border-radius: 6px !important; -webkit-print-color-adjust: exact; width: 100% !important; }

                /* Logo and stamp sizing for print */
                .invoice-logo { width: 90px !important; height: auto !important; }
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
            }
            /* non-print sizes */
            .invoice-table td, .invoice-table th { text-align: center; }
            .col-details { text-align: left; }
            .col-sn { width: 90px; }
            .col-img { width: 120px; }
            .col-price { width: 80px; }
        `;

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
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            mb: 2,
            gap: 2,
          }}
        >
          <Box className="invoice-header-left">
            <img
              className="invoice-logo"
              src="/logo.png"
              alt="GAJA Logo"
              style={{
                width: 140,
                height: "auto",
                marginBottom: 8,
                borderRadius: 12,
                padding: 4,
                background: "#fff",
              }}
            />

            <Typography variant="h5" fontWeight="bold">
              {typeinv.toLowerCase().includes("gold")
                ? "Gold Invoice"
                : typeinv.toLowerCase().includes("watch")
                  ? "Watch Invoice"
                  : typeinv.toLowerCase().includes("diamond") || hasDiamondData
                    ? "Diamond Invoice"
                    : "Invoice"}
            </Typography>
            <Typography variant="subtitle1">
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
                    <span style={{ color: "#2e7d32", fontWeight: 700 }}>
                      (Closed)
                    </span>
                  ) : (
                    <span style={{ color: "#ed6c02", fontWeight: 700 }}>
                      (Open)
                    </span>
                  )}
                </>
              )}
            </Typography>
            <Typography variant="subtitle2">
              Date: {currentInvoiceData.date_fact || invoice.date_fact}
            </Typography>

            <Typography variant="subtitle2">{ps ? `PS: ${ps}` : ""}</Typography>
          </Box>
          <Box
            className="invoice-header-right"
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "#fff",
              p: 1,
              minWidth: 220,
              gap: 2,
            }}
          >
            {/* Customer info box above QR */}

            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <QRCode value={qrData} size={90} />
            </Box>
            <Box
              className="customer-box"
              sx={{
                mt: 1,
                p: 1,
                width: "100%",
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: "bold", color: "#1976d2" }}
              >
                Customer
              </Typography>
              <Box sx={{ mt: 0.5, display: "flex", flexDirection: "column", gap: 0.25 }}>
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
        </Box>
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
                      <TableRow key={idx} sx={{ background: "inherit" }}>
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
                              const rowId = parentInvoice?.picint;
                              const rowPicintKey =
                                rowId !== undefined && rowId !== null ? String(rowId) : "";
                              const rowAchatKey =
                                item?.id_achat !== undefined && item?.id_achat !== null
                                  ? String(item.id_achat)
                                  : "";
                              const invPicintKey =
                                invoice?.picint !== undefined && invoice?.picint !== null
                                  ? String(invoice.picint)
                                  : "";
                              const isGoldType = typeinv?.toLowerCase().includes("gold");
                              // Prefer the correct key per type; placeholder should only be used when there are truly no URLs.
                              let urls = [] as string[];
                              // Gold: images are stored per ACHAT id_achat
                              if (isGoldType && rowAchatKey && imageUrls[rowAchatKey]) {
                                urls = imageUrls[rowAchatKey];
                              }
                              // Non-gold (or fallback): allow picint-based lookup
                              if ((!urls || urls.length === 0) && rowPicintKey && imageUrls[rowPicintKey]) {
                                urls = imageUrls[rowPicintKey];
                              }
                              // Generic fallback: id_achat lookup if available
                              if ((!urls || urls.length === 0) && rowAchatKey && imageUrls[rowAchatKey]) {
                                urls = imageUrls[rowAchatKey];
                              }
                              // Try using current invoice picint as fallback key
                              if (
                                (!urls || urls.length === 0) &&
                                !!invPicintKey
                              ) {
                                if (imageUrls[invPicintKey]) urls = imageUrls[invPicintKey];
                              }
                              if (
                                urls.length === 0 &&
                                (typeinv?.toLowerCase().includes("diamond") ||
                                  typeinv?.toLowerCase().includes("gold") ||
                                  hasDiamondData)
                              ) {
                                const dDet =
                                  allDiamondDetails[rowId] ||
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
                              const isWatchType = typeinv?.toLowerCase().includes("watch");
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
                                        return `/images/${encodeURIComponent(idSeg)}/${encodeURIComponent(filename)}`;
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
                                        return `/images/${encodeURIComponent(idSeg)}/${encodeURIComponent(filename)}`;
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
                                    rowPicint: rowId,
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
                                      : "watch";
                                  const keyId = item?.id_achat ?? rowId ?? invoice?.picint;
                                  const pref = localStorage.getItem(getPreferredImageKey(kind, keyId));
                                  if (pref && candidateUrls.some((u) => String(u) === String(pref))) {
                                    preferredUrl = pref;
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
                              } else {
                                try {
                                  console.log('[InvoiceImages:render] no-image', {
                                    rowPicint: rowId,
                                    rowIdAchat: item?.id_achat,
                                    isGoldType,
                                    checkedKeys: [rowId, item?.id_achat, invoice?.picint]
                                  });
                                } catch {}
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
                  {showDiscount ? (
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
                  {showSurcharge ? (
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
                <Typography>
                  <span style={{ fontWeight: "bold" }}>Total LYD:</span>
                  <span style={{ fontFamily: "monospace" }}>
                    {fmt0(totalAmountLYD)}
                  </span>
                </Typography>
                <Typography>
                  <span style={{ fontWeight: "bold" }}>Total Weight:</span>
                  <span style={{ fontFamily: "monospace" }}>
                    {fmtWeight(totalWeight)} g
                  </span>
                </Typography>
              </>
            )}
            {typeinv && !typeinv.toLowerCase().includes("gold") && (
              <>
                {/* Total USD after discount */}
                <Typography>
                  <span style={{ fontWeight: "bold" }}>Total USD: </span>
                  <span style={{ fontFamily: "monospace" }}>
                    {TotalAmountFinal.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </Typography>

                {(() => {
                  const netValue = Number(data.remise) || 0;
                  const netPer = Number(data.remise_per) || 0;
                  const hasDiscount = netValue < 0 || netPer < 0;
                  const hasSurcharge = netValue > 0 || netPer > 0;
                  const absValue = Math.abs(netValue);
                  const absPer = Math.abs(netPer);

                  return (
                    <>
                      {hasDiscount ? (
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

                      {hasSurcharge ? (
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
                    {(
                      (Number(TotalAmountFinal) || 0) +
                      (Number(data.remise) || 0) +
                      (Number(TotalAmountFinal) || 0) * ((Number(data.remise_per) || 0) / 100)
                    ).toLocaleString(undefined, {
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
              const lyd = Number(amount_lyd) || 0;
              const usd = Number(amount_currency) || 0;
              const eur = Number(amount_EUR) || 0;
              const usdLyd = Number(paidUsdLyd) || 0;
              const eurLyd = Number(paidEurLyd) || 0;
              const paidTotalLydEquiv = lyd + usdLyd + eurLyd;

              const totalLyd = normalizeLyd0(Number(totalAmountLYD) || 0);
              const paidLyd0 = normalizeLyd0(paidTotalLydEquiv);
              const diff = totalLyd - paidLyd0;
              const isPaidInFull = Math.abs(diff) <= moneyEps;
              const hasRemainder = diff > moneyEps;
              const paidColor = isPaidInFull ? "#2e7d32" : (hasRemainder ? "#d04444ff" : "#d04444ff");

              const lines: Array<{ label: string; value: string }> = [];
              if (lyd > 0) lines.push({ label: "LYD", value: fmt0(lyd) });
              if (usd > 0) lines.push({ label: "USD", value: fmt0(usd) });
              if (eur > 0) lines.push({ label: "EUR", value: fmt0(eur) });
              if (lines.length === 0) lines.push({ label: "LYD", value: fmt0(paidTotalLydEquiv) });

              return (
                <>
                  <Typography>
                    <span style={{ fontWeight: "bold" }}>Payments:</span>
                  </Typography>
                  <Typography sx={{ mt: 0.5 }}>
                    <span style={{ fontWeight: "bold" }}>Paid (LYD equivalent):</span>{" "}
                    <span style={{ fontFamily: "monospace", color: paidColor }}>
                      {fmt0(paidTotalLydEquiv)} LYD
                    </span>
                  </Typography>
                  {hasRemainder && (
                    <Typography sx={{ mt: 0.25 }}>
                      <span style={{ fontWeight: "bold", color: "#d04444ff" }}>
                        Remainder:
                      </span>{" "}
                      <span style={{ fontFamily: "monospace", color: "#d04444ff" }}>
                        {fmt0(diff)} LYD
                      </span>
                    </Typography>
                  )}
                </>
              );
            })()}
          </Box>
        </Box>

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
        <div style={{ pageBreakBefore: "always" }}>
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
    );
  }
);

export default WatchStandardInvoiceContent;
