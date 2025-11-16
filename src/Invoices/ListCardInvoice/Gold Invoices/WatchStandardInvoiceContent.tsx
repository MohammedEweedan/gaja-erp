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
  createdBy?: string; // creator name passed from parent (SalesReportsTable -> PrintInvoiceDialog)
}

const WatchStandardInvoiceContent = forwardRef<HTMLDivElement, Props>(
  ({ data, num_fact, showImage = true, createdBy }, ref) => {
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
    } = data;
    let ps: string | null = null;
    // Cuser removed (unused)
    const userStr = localStorage.getItem("user");

    if (userStr) {
      try {
        const userObj = JSON.parse(userStr);
        ps = userObj.ps ?? localStorage.getItem("ps");
        // (removed unused Cuser extraction)
      } catch {
        ps = localStorage.getItem("ps");
      }
    } else {
      ps = localStorage.getItem("ps");
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

    // Debug one-liner to help verify detection in console
    useEffect(() => {
      if (pdata && pdata.length) {
        // eslint-disable-next-line no-console
        console.log(
          "[DiamondDetect] hasDiamondData=",
          hasDiamondData,
          "ACHAT count first invoice=",
          pdata[0]?.ACHATs?.length || 0
        );
        if (!hasDiamondData) {
          const sample = pdata[0]?.ACHATs?.[0];
          if (sample) {
            const shallow = Object.keys(sample).reduce((acc: any, k) => {
              acc[k] = sample[k];
              return acc;
            }, {});
            // eslint-disable-next-line no-console
            console.log("[DiamondDetect][SampleFirstACHAT]", shallow);
            const dp: any =
              sample?.DistributionPurchase ||
              sample?.DistributionPurchases ||
              sample?.distributionPurchase ||
              sample?.distributionPurchases;
            if (dp) {
              // eslint-disable-next-line no-console
              console.log("[DiamondDetect][SampleDistributionPurchase]", dp);
            }
          }
        }
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
          params: { ps: ps, num_fact: invoiceNumFact },
        });
        setPData(res.data);
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
        const diamondInvoice =
          typeinv && typeinv.toLowerCase().includes("diamond");
        if (diamondInvoice || hasDiamondData) {
          const uniqueDiamondPicints = Array.from(
            new Set(pdata.map((inv) => inv.picint).filter(Boolean))
          );
          // eslint-disable-next-line no-console
          console.log(
            "[DiamondFetch] uniqueDiamondPicints (picint-based)=",
            uniqueDiamondPicints
          );
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
                  // eslint-disable-next-line no-console
                  console.warn(
                    "[DiamondFetch] error fetching picint",
                    pic,
                    err
                  );
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

    const API_BASEImage = "/images";

    const [imageUrls, setImageUrls] = useState<Record<string, string[]>>({});

    // Typed fetch helper (watch | diamond)
    const fetchImagesTyped = async (
      id: number,
      type: "watch" | "diamond"
    ): Promise<string[] | null> => {
      const token = localStorage.getItem("token");
      try {
        const res = await axios.get(`${API_BASEImage}/list/${type}/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (Array.isArray(res.data) && res.data.length) return res.data;
        return [];
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[Images] fetch failed", type, id);
        return null;
      }
    };

    // Fetch images for watch or diamond when detected (typed endpoints)
    useEffect(() => {
      const isWatch = !!(typeinv && typeinv.toLowerCase().includes("watch"));
      const isDiamond = !!(
        (typeinv && typeinv.toLowerCase().includes("diamond")) ||
        hasDiamondData
      );
      if (!(isWatch || isDiamond)) return;

      // Build candidate ids
      let sourceIds: string[] = [];
      if (isWatch) {
        sourceIds = Object.keys(allWatchDetails);
      } else if (isDiamond) {
        sourceIds = Object.keys(allDiamondDetails);
        if (sourceIds.length === 0) {
          sourceIds = pdata.map((inv) => inv.picint).filter(Boolean);
        }
      }
      const unique = Array.from(new Set(sourceIds)).filter(Boolean);
      (async () => {
        for (const id of unique) {
          if (!id) continue;
          if (imageUrls[id]) continue; // already have
          if (isWatch) {
            const urls = await fetchImagesTyped(Number(id), "watch");
            if (urls && urls.length) {
              setImageUrls((prev) => ({ ...prev, [id]: urls }));
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
                  const u2 = await fetchImagesTyped(cid, "diamond");
                  if (u2 && u2.length) {
                    // store under both cid and original id so render fallback works
                    setImageUrls((prev) => ({ ...prev, [id]: u2, [cid]: u2 }));
                    urls = u2;
                    break;
                  }
                }
              }
            } else {
              // urls is typed (string[] | null); ensure non-null for state shape
              setImageUrls((prev) => ({ ...prev, [id]: urls || [] }));
            }
          }
        }
      })();
      // eslint-disable-next-line
    }, [pdata, allWatchDetails, allDiamondDetails, typeinv, hasDiamondData]);

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
                /* Ensure customer info shows as a visible box in print/PDF */
                .invoice-header-right .customer-box { border: 1px solid #bfbfbf !important; background: #fff !important; padding: 8px !important; border-radius: 6px !important; -webkit-print-color-adjust: exact; width: 100% !important; }

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
                mt: 0,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <QRCode value={qrData} size={120} />
            </Box>
            <Box
              className="customer-box"
              sx={{
                mt: 1,
                p: 1,
                border: "1px solid #eee",
                borderRadius: 2,
                width: "100%",
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: "bold", color: "#1976d2" }}
              >
                Customer
              </Typography>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 13,
                  listStyleType: "disc",
                }}
              >
                <li>
                  <span style={{ fontWeight: "bold" }}>Code:</span>{" "}
                  {pdata[0]?.client || pdata[0]?.Client?.num_client || "N/A"}
                </li>
                <li>
                  <span style={{ fontWeight: "bold" }}>Name:</span>{" "}
                  {pdata[0]?.Client?.client_name || "N/A"}
                </li>
                <li>
                  <span style={{ fontWeight: "bold" }}>Tel:</span>{" "}
                  {pdata[0]?.Client?.tel_client || "N/A"}
                </li>
              </ul>
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
                  <TableCell sx={{ color: "#000" }}>Weight</TableCell>
                  <TableCell sx={{ color: "#000" }}>Gold Color</TableCell>
                  <TableCell sx={{ color: "#000" }}>Rush Color</TableCell>
                  <TableCell sx={{ color: "#000" }}>Sise</TableCell>
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
                    const img = showImage ? 1 : 0; // Image column
                    const isGold =
                      typeinv && typeinv.toLowerCase().includes("gold");
                    const middle = isGold ? 4 : 2; // gold uses 4 columns (weight..size), non-gold uses Price + Details
                    const gift = 1; // IS_GIFT
                    return baseSN + img + middle + gift;
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
                      (typeinv && typeinv.toLowerCase().includes("diamond")) ||
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
                              // Fallback sequence for image source (row picint, direct id_achat, any diamond detail id)
                              let urls = imageUrls[rowId] || [];
                              if (urls.length === 0 && item.id_achat)
                                urls = imageUrls[item.id_achat] || urls;
                              if (
                                urls.length === 0 &&
                                (typeinv?.toLowerCase().includes("diamond") ||
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
                              const token = localStorage.getItem("token");
                              if (urls.length > 0) {
                                const imgUrl = urls[0];
                                let urlWithToken = imgUrl;
                                if (token) {
                                  urlWithToken +=
                                    (imgUrl.includes("?") ? "&" : "?") +
                                    "token=" +
                                    encodeURIComponent(token);
                                }
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
                                        "/default-image.png";
                                    }}
                                  />
                                );
                              } else {
                                return (
                                  <span style={{ color: "#bbb", fontSize: 10 }}>
                                    No Image
                                  </span>
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
                              {item.qty + " g"}
                            </TableCell>
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
                            <TableCell
                              sx={{
                                color: "#000",
                                fontSize: 11,
                                padding: "2px 6px",
                              }}
                            >
                              {item.Unite ?? ""}
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
                    {totalAmountLYD.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </Typography>
                <Typography>
                  <span style={{ fontWeight: "bold" }}>Total Weight:</span>
                  <span style={{ fontFamily: "monospace" }}>
                    {pdata
                      .flatMap((inv) => inv.ACHATs || [])
                      .reduce(
                        (sum, item) => sum + (parseFloat(item.qty) || 0),
                        0
                      )
                      .toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}{" "}
                    g
                  </span>
                </Typography>
                <Typography>
                  <span style={{ fontWeight: "bold" }}>Price /g:</span>
                  <span style={{ fontFamily: "monospace" }}>
                    {(() => {
                      const totalWeight = pdata
                        .flatMap((inv) => inv.ACHATs || [])
                        .reduce(
                          (sum, item) => sum + (parseFloat(item.qty) || 0),
                          0
                        );
                      return totalWeight > 0
                        ? (totalAmountLYD / totalWeight).toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )
                        : "0.00";
                    })()}{" "}
                    LYD
                  </span>
                </Typography>
              </>
            )}
            {typeinv && !typeinv.toLowerCase().includes("gold") && (
              <>
                {/* Total USD after discount */}
                <Typography>
                  <span style={{ fontWeight: "bold" }}>Total USD:</span>
                  <span style={{ fontFamily: "monospace" }}>
                    {TotalAmountFinal.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </Typography>

                {/* Discount display */}
                {data.remise && data.remise > 0 ? (
                  <Typography>
                    <span style={{ fontWeight: "bold" }}>Discount: </span>
                    <span style={{ fontFamily: "monospace", color: "#d32f2f" }}>
                      {data.remise.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </Typography>
                ) : data.remise_per && data.remise_per > 0 ? (
                  <Typography>
                    <span style={{ fontWeight: "bold" }}>
                      Discount ({data.remise_per}%):
                    </span>
                    <span style={{ fontFamily: "monospace", color: "#d32f2f" }}>
                      {(
                        (TotalAmountFinal * data.remise_per) /
                        100
                      ).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </Typography>
                ) : null}

                {/* Total USD after discount */}
                <Typography>
                  <span style={{ fontWeight: "bold" }}>Total Saved USD:</span>
                  <span style={{ fontFamily: "monospace" }}>
                    {(data.remise && data.remise > 0
                      ? TotalAmountFinal - data.remise
                      : data.remise_per && data.remise_per > 0
                        ? TotalAmountFinal -
                          (TotalAmountFinal * data.remise_per) / 100
                        : TotalAmountFinal
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
            <Typography>
              <span style={{ fontWeight: "bold" }}>LYD Paid:</span>{" "}
              <span style={{ fontFamily: "monospace" }}>
                {totalAmountLYD.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </Typography>
            <Typography>
              <span style={{ fontWeight: "bold" }}>USD Paid:</span>{" "}
              <span style={{ fontFamily: "monospace" }}>
                {totalAmountUSD.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </Typography>
            <Typography>
              <span style={{ fontWeight: "bold" }}>EUR Paid:</span>{" "}
              <span style={{ fontFamily: "monospace" }}>
                {totalAmountEur.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </Typography>
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
                  Created by:
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
                      Created by:
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
