import React, { RefObject } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Checkbox,
  FormControlLabel,
  Radio,
  TextField,
} from "@mui/material";
import { Box } from "@mui/system";
import {
  Dialog as MuiDialog,
  DialogTitle as MuiDialogTitle,
  DialogContent as MuiDialogContent,
  DialogActions as MuiDialogActions,
} from "@mui/material";
import axios from "../../../api";

import WatchStandardInvoiceContent from "./WatchStandardInvoiceContent";

// Define minimal local types for Invoice and Client
export type Client = {
  id_client: number;
  client_name: string;
  tel_client: string;
};
export type Invoice = {
  id_fact: number;
  date_fact: string;
  client: number;
  num_fact: number;
  usr: number;
  d_time: string;
  IS_GIFT: boolean;
  id_art: number;
  prix_vente: number;
  prix_vente_remise: number;
  mode_fact: string;
  COMMENT: string;
  IS_OK: boolean;
  rate: number;
  remise: number;
  is_printed: boolean;
  ps: number;
  phone_client: string;
  total_remise: number;
  qty: number;
  total_remise_final: number;
  total_remise_final_after_discount?: number;
  currency: string;
  picint: number;
  ACHATs?: ACHATs[];
  ACHAT_pic?: ACHAT_pic[];

  // ...add more fields as needed for the dialog
  // optional remaining amounts
  rest_of_money?: number;
  rest_of_moneyUSD?: number;
  rest_of_moneyEUR?: number;
};
type ACHAT_pic = {
  id_art: number;
  ID_PIC: number;
  PIC1: string;
  PIC2: string;
  PIC3: string;
};

type ACHATs = {
  id_fact: number;
  Design_art: string;
  client: number;
  qty: number;
  TOTAL_INV_FROM_DIAMOND: number;
  Color_Gold: string;
  Color_Rush: string;
  Original_Invoice: string;
  Fournisseur?: {
    id_client: number;
    client_name: string;
    code_fournisseur: string;
    TYPE_SUPPLIER: string;
  };
  DistributionPurchase?: DistributionPurchase[];
};

type DistributionPurchase = {
  distributionID: number;
  ps?: number;
  Weight?: number;
  distributionDate?: string;
  usr?: number;
  PurchaseID?: number;
  CreationDate?: string;
  PurchaseType?: string;
  distributionISOK?: boolean;

  OriginalAchatWatch?: {
    id_achat: number;
    Brand: number;
    model: string;
    reference_number?: string;
    serial_number?: string;
    movement?: string;
    caliber?: string;
    gender?: string;
    condition?: string;
    diamond_total_carat?: number;
    diamond_quality?: string;
    diamond_setting?: string;
    number_of_diamonds?: number;
    custom_or_factory?: string;
    case_material?: string;
    case_size?: string;
    bezel?: string;
    bracelet_type?: string;
    bracelet_material?: string;
    dial_color?: string;
    dial_style?: string;
    crystal?: string;
    water_resistance?: string;
    functions?: string;
    power_reserve?: string;
    box_papers?: boolean;
    warranty?: string;
    retail_price?: number;
    sale_price?: number;
    image_url?: string;
    certificate_url?: string;
    Comment_Achat?: string;
    DocumentNo?: string;
    IsApprouved?: string;
    Approval_Date?: Date;
    ApprouvedBy?: string;
    Comment?: string;
    attachmentUrl?: string;
    Date_Achat?: string;
    Usr?: number;
    sharepoint_url?: string;
    MakingCharge?: number;
    ShippingCharge?: number;
    TravelExpesenes?: number;
    Rate?: number;
    Total_Price_LYD?: number;
    SellingPrice?: number;
  };
};
interface InvoicePrintData {
  invoice: Invoice;
  items: Invoice[];
  customer: Client | undefined;
  totalAmountLYD: number;
  totalAmountUSD: number;
  totalAmountEur: number;
  totalWeight: number;
  itemCount: number;
  amount_lyd?: number;
  amount_currency?: number;
  amount_EUR?: number;
  amount_currency_LYD: number;
  amount_EUR_LYD: number;
  type?: string;
  picint: number;
  Original_Invoice: string; // Add type to InvoicePrintData
  remise: number;
  remise_per: number;
}

interface PrintInvoiceDialogProps {
  open: boolean;
  invoice: Invoice | null;
  data: InvoicePrintData;
  printRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onInvoiceClosed?: () => void; // Parent page refresh
  onCartRefresh?: () => void; // Cart refresh
  showCloseInvoiceActions?: boolean;
  showCloseInvoice?: boolean; // NEW: control close actions visibility
  createdBy?: string; // pass created by from parent (SalesReportsTable)
}

const PrintInvoiceDialog: React.FC<PrintInvoiceDialogProps> = ({
  open,
  invoice,
  data,
  printRef,
  onClose,
  onInvoiceClosed,
  onCartRefresh,
  showCloseInvoiceActions = true,
  showCloseInvoice,
  createdBy,
}) => {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [paymentRequiredOpen, setPaymentRequiredOpen] = React.useState(false);
  const [paymentAction, setPaymentAction] = React.useState<"issue" | "close">("issue");
  const [payLydStr, setPayLydStr] = React.useState("");
  const [payUsdStr, setPayUsdStr] = React.useState("");
  const [payUsdLydStr, setPayUsdLydStr] = React.useState("");
  const [payEurStr, setPayEurStr] = React.useState("");
  const [payEurLydStr, setPayEurLydStr] = React.useState("");
  const [invoiceNumFact, setInvoiceNumFact] = React.useState<number | null>(
    null
  );
  const [makeTransactionToCashier, setMakeTransactionToCashier] =
    React.useState(false);
  const [showImage] = React.useState(true);
  const [showGoldUnitPrices, setShowGoldUnitPrices] = React.useState(false);
  const [showDiscountValues, setShowDiscountValues] = React.useState(true);
  const [showSurchargeValues, setShowSurchargeValues] = React.useState(true);

  // Initialize invoice number from the provided invoice when available
  React.useEffect(() => {
    if (invoice?.num_fact && Number(invoice.num_fact) > 0) {
      setInvoiceNumFact(Number(invoice.num_fact));
    }
  }, [invoice]);

  // Print only the DialogContent (invoice area)
  const handlePrint = () => {
    // Find the DialogContent DOM node
    const dialogContent = document.querySelector(".MuiDialogContent-root");
    if (!dialogContent) return;

    // Clone the content
    const printContents = dialogContent.innerHTML;

    // Get all stylesheets
    let styles = "";
    Array.from(
      document.querySelectorAll('link[rel="stylesheet"], style')
    ).forEach((node) => {
      styles += node.outerHTML;
    });

    // Open a new window for printing
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice Print</title>
          ${styles}
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            body, .MuiDialogContent-root, .invoice-content {
              background: #fff !important;
              color: #000 !important;
            }
            * { box-shadow: none !important; }
            html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .MuiDialogActions-root, .MuiDialogTitle-root { display: none !important; }
            /* Ensure tables and layout look good */
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 4px 8px; }
            /* Hide empty/filler cells (e.g., extra trailing column) */
            table td:empty, table th:empty { display: none !important; border: none !important; padding: 0 !important; }
            table tr > td:last-child:empty, table thead tr > th:last-child:empty { display: none !important; }
            .MuiTableCell-root:empty, .MuiTableCell-root[aria-hidden="true"] { display: none !important; border: none !important; padding: 0 !important; }
            /* Avoid page margins creating phantom columns */
            .invoice-content { overflow: hidden !important; }
            img { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            /* Add more print-specific styles as needed */
          </style>
        </head>
        <body>
          <div class="MuiDialogContent-root">${printContents}</div>
          <script>
            (function() {
              try {
                var root = document;
                var tables = root.querySelectorAll('table');
                tables.forEach(function(table) {
                  // Remove empty last TH in header if present
                  var theadTr = table.querySelector('thead tr');
                  if (theadTr) {
                    var lastTh = theadTr.querySelector('th:last-child');
                    if (lastTh && lastTh.children.length === 0 && lastTh.textContent.trim() === '') {
                      lastTh.remove();
                    }
                  }
                  // Remove empty last TD in each row
                  table.querySelectorAll('tr').forEach(function(tr) {
                    var lastTd = tr.querySelector('td:last-child');
                    if (lastTd && lastTd.children.length === 0 && lastTd.textContent.trim() === '') {
                      lastTd.remove();
                    }
                  });
                });
              } catch (e) { /* ignore */ }
            })();

            (function() {
              function waitForImages() {
                var imgs = Array.prototype.slice.call(document.images || []);
                if (!imgs.length) return Promise.resolve();
                return Promise.all(imgs.map(function(img) {
                  try {
                    if (img.complete && img.naturalWidth > 0) {
                      if (img.decode) return img.decode().catch(function(){ });
                      return Promise.resolve();
                    }
                    return new Promise(function(resolve) {
                      var done = function() { resolve(); };
                      img.addEventListener('load', done, { once: true });
                      img.addEventListener('error', done, { once: true });
                    });
                  } catch (e) {
                    return Promise.resolve();
                  }
                }));
              }

              function doPrint() {
                try { window.focus(); } catch (e) {}
                try { window.print(); } catch (e) {}
              }

              // Wait a bit for layout + fonts + images
              setTimeout(function() {
                waitForImages().then(function() {
                  setTimeout(doPrint, 100);
                });
              }, 250);
            })();
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    // printing is triggered inside the print window after images load
  };

  const goldWeightInfo = React.useMemo(() => {
    const directType = String((data as any)?.type || "").toLowerCase();
    const firstItem: any = data?.items?.[0];
    const supplierType =
      String(
        firstItem?.Fournisseur?.TYPE_SUPPLIER ||
          firstItem?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER ||
          ""
      ).toLowerCase();
    const isGold = directType.includes("gold") || supplierType.includes("gold");
    if (!isGold) return { totalWeight: 0, lydPerGram: 0 };

    const totalWeight = (data?.items || []).reduce((sum, row: any) => {
      // Prefer invoice qty for gold weight (this is what GNew_I shows as "Weight: {row.qty} g")
      const w =
        row?.qty ??
        row?.ACHATs?.[0]?.qty ??
        row?.ACHATs?.[0]?.DistributionPurchase?.[0]?.Weight ??
        row?.ACHATs?.[0]?.DistributionPurchase?.Weight ??
        row?.DistributionPurchase?.[0]?.Weight ??
        row?.DistributionPurchase?.Weight ??
        row?.Weight;
      const n = Number(w);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);

    const totalLyd = Number(data?.totalAmountLYD) || 0;
    const lydPerGram = totalWeight > 0 ? totalLyd / totalWeight : 0;

    return { totalWeight, lydPerGram };
  }, [data]);

  const isGoldInvoice = React.useMemo(() => {
    const directType = String((data as any)?.type || "").toLowerCase();
    const firstItem: any = data?.items?.[0];
    const supplierType =
      String(
        firstItem?.Fournisseur?.TYPE_SUPPLIER ||
          firstItem?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER ||
          ""
      ).toLowerCase();
    return directType.includes("gold") || supplierType.includes("gold");
  }, [data]);

  /*
   if (data && data.items && data.items.length > 0) {
     const type = (data.items[0] as any)?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase() || '';
     if (type.includes('diamond')) invoiceType = 'diamond';
     else if (type.includes('watche')) invoiceType = 'watch';
   }
 */
  // Always create a new object for dataWithTotalAmountFinal to force re-render
  const dataWithTotalAmountFinal = React.useMemo(
    () => ({
      ...data,
      num_fact: invoiceNumFact ?? invoice?.num_fact,
      TotalAmountFinal: data.items[0].total_remise_final,
      totalWeight:
        isGoldInvoice && Number(goldWeightInfo.totalWeight) > 0
          ? goldWeightInfo.totalWeight
          : data.totalWeight,
    }),
    [data, invoiceNumFact, invoice, goldWeightInfo.totalWeight, isGoldInvoice]
  );

  // Helper to derive invoice Type for backend GL account mapping
  const invoiceType: string | undefined = React.useMemo(() => {
    // Try direct data.type first if provided upstream
    const directType = (data as any)?.type;
    if (typeof directType === 'string' && directType.length > 0) {
      return directType.toLowerCase();
    }
    // Inspect first item supplier type if available
    const firstItem: any = data?.items?.[0];
    let supplierType: string | undefined = firstItem?.Fournisseur?.TYPE_SUPPLIER;
    // Fallback: some structures keep supplier under ACHATs array
    if (!supplierType && firstItem?.ACHATs && firstItem.ACHATs.length > 0) {
      supplierType = firstItem.ACHATs[0]?.Fournisseur?.TYPE_SUPPLIER;
    }
    if (supplierType) {
      const lower = supplierType.toLowerCase();
      if (lower.includes('diamond')) return 'diamond';
      if (lower.includes('watch')) return 'watch';
      if (lower.includes('gold')) return 'gold';
    }
    // Default to gold if nothing matches (adjust if needed)
    return 'gold';
  }, [data]);
 
  // Handler for closing this invoice
  const handleCloseInvoice = async () => {
    const token = localStorage.getItem("token");
    // Prefer ps/usr from current invoice when present
    const psParam = invoice?.ps != null ? String(invoice.ps) : String(ps ?? "");
    // Use current logged-in user's id_user from localStorage when available
    let usrFromStorage: string | null = null;
    const userLocalStr = localStorage.getItem("user");
    if (userLocalStr) {
      try {
        const u = JSON.parse(userLocalStr);
        usrFromStorage =
          u?.id_user != null
            ? String(u.id_user)
            : u?.Cuser != null
              ? String(u.Cuser)
              : null;
      } catch {
        usrFromStorage = localStorage.getItem("Cuser");
      }
    }
    // Always prefer the id_user from storage when generating numbers etc.,
    // but when closing an existing invoice we must use the invoice's `usr`
    // so the backend WHERE clause matches the invoice rows.
    const usrParam =
      usrFromStorage ??
      (invoice?.usr != null ? String(invoice.usr) : String(Cuser ?? ""));
    if (!psParam || !usrParam) {
      alert("User info missing. Cannot close invoice.");
      return;
    }
    try {
      // Optionally show a loading indicator here
      // Ensure we have a valid invoice number
      let num_fact: number | null =
        invoice && invoice.num_fact
          ? invoice.num_fact
          : (invoiceNumFact ?? null);
      if (!num_fact || Number(num_fact) === 0) {
        const newNum = await handleAddNew();
        if (!newNum) {
          alert("Failed to generate invoice number.");
          return;
        }
        num_fact = newNum;
      }

      // Use invoice's usr when available to ensure backend finds the invoice rows
      const closingUsr =
        invoice && invoice.usr != null ? String(invoice.usr) : usrParam;
      const closingPs =
        invoice && invoice.ps != null ? String(invoice.ps) : psParam;
      const paramsObj: any = {
        ps: closingPs,
        usr: closingUsr,
        num_fact: String(num_fact),
        MakeCashVoucher: String(!!makeTransactionToCashier),
        Type: invoiceType, // pass type for GL account mapping
      };
      // Log params for debugging to ensure rest_of_money is sent
      try {
        console.log("Closing invoice - CloseNF params:", paramsObj);
      } catch (e) {
        /* ignore logging errors */
      }
      const response = await axios.get(`${apiUrlinv}/CloseNF`, {
        params: paramsObj,
        headers: { Authorization: `Bearer ${token}` },
      });
      try {
        console.log("CloseNF response data:", response && response.data);
      } catch (e) {
        /* ignore logging errors */
      }

      const result = response.data;

      // Optionally update state/UI here
      if (result?.new_num_fact) setInvoiceNumFact(Number(result.new_num_fact));
      if (Number(result?.gltranRowsCreated ?? 0) <= 0) {
        console.warn("CloseNF completed but no journal entries were created.");
      }
      // Fetch the invoice from server to confirm rest_of_money was saved
      try {
        // Include usr filter to restrict fetched invoice details to current user context
        const verifyRes = await axios.get(`${apiUrlinv}/Getinvoice/`, {
          params: {
           // ps: psParam,
            num_fact: String(num_fact),
            usr: invoice?.usr,
          },
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log(
          "Verify invoice after CloseNF:",
          verifyRes && verifyRes.data
        );
      } catch (verifyErr) {
        console.warn("Error fetching invoice for verification:", verifyErr);
      }
      if (onInvoiceClosed) onInvoiceClosed(); // Refresh parent page
      if (onCartRefresh) onCartRefresh(); // Refresh cart
      onClose(); // Close the dialog
    } catch (error: any) {
      alert(`Error closing invoice: ${error.message}`);
    }
  };

  const apiIp = `${process.env.REACT_APP_API_IP}`;
  let ps: string | null = null;
  let Cuser: string | null = null;
  const userStr = localStorage.getItem("user");
  if (userStr) {
    try {
      const userObj = JSON.parse(userStr);
      ps = userObj.ps ?? localStorage.getItem("ps");
      Cuser = userObj.Cuser ?? localStorage.getItem("Cuser");
    } catch {
      ps = localStorage.getItem("ps");
      Cuser = localStorage.getItem("Cuser");
    }
  } else {
    ps = localStorage.getItem("ps");
    Cuser = localStorage.getItem("Cuser");
  }

  const apiUrlinv = `${apiIp}/invoices`;
  const handleAddNew = async (): Promise<number | null> => {
    const token = localStorage.getItem("token");
    const psParam = invoice?.ps != null ? String(invoice.ps) : String(ps ?? "");
    // Prefer id_user from localStorage when available
    let usrFromStorage: string | null = null;
    const userLocalStr = localStorage.getItem("user");
    if (userLocalStr) {
      try {
        const u = JSON.parse(userLocalStr);
        usrFromStorage =
          u?.id_user != null
            ? String(u.id_user)
            : u?.Cuser != null
              ? String(u.Cuser)
              : null;
      } catch {
        usrFromStorage = localStorage.getItem("Cuser");
      }
    }
    const usrParam =
      usrFromStorage ??
      (invoice?.usr != null ? String(invoice.usr) : String(Cuser ?? ""));
    try {
      const response = await axios.get(`${apiUrlinv}/SetNF`, {
        params: { ps: psParam, usr: usrParam },
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = response.data;
      setInvoiceNumFact(result.new_num_fact); // Set the new invoice number in state
      return Number(result.new_num_fact) || null;
    } catch (error) {
      console.error("Error creating new invoice:", error);
      return null;
    }
  };

  const handleGenerateNewNumberClick = () => setConfirmOpen(true);
  const handleConfirmClose = () => setConfirmOpen(false);

  const normalizeMoney = React.useCallback(
    (v: number) => Math.round((Number(v) || 0) * 100) / 100,
    []
  );
  const normalizeLyd0 = React.useCallback(
    (v: number) => Math.round(Number(v) || 0),
    []
  );
  const moneyEps = 0.01;

  const getUsdRate = React.useCallback(() => {
    const usd = Number((data as any)?.amount_currency) || 0;
    const usdLyd = Number((data as any)?.amount_currency_LYD) || 0;
    if (usd > 0 && usdLyd > 0) {
      const r = usdLyd / usd;
      return Number.isFinite(r) && r > 0 ? r : NaN;
    }
    const r = Number((invoice as any)?.rate);
    return Number.isFinite(r) && r > 0 ? r : NaN;
  }, [data, invoice]);

  const getEurRate = React.useCallback(() => {
    const eur = Number((data as any)?.amount_EUR) || 0;
    const eurLyd = Number((data as any)?.amount_EUR_LYD) || 0;
    if (eur > 0 && eurLyd > 0) {
      const r = eurLyd / eur;
      return Number.isFinite(r) && r > 0 ? r : NaN;
    }
    return NaN;
  }, [data]);

  const getRemainingLyd = React.useCallback(() => {
    const totalLyd = normalizeLyd0(Number(data?.totalAmountLYD) || 0);
    const paidLyd = normalizeLyd0(Number((data as any)?.amount_lyd) || 0);
    const paidUsdLyd = normalizeLyd0(Number((data as any)?.amount_currency_LYD) || 0);
    const paidEurLyd = normalizeLyd0(Number((data as any)?.amount_EUR_LYD) || 0);
    const diff = totalLyd - (paidLyd + paidUsdLyd + paidEurLyd);
    return Math.max(0, diff);
  }, [data, normalizeLyd0]);

  const isPartiallyPaid = React.useMemo(() => getRemainingLyd() > 0.01, [getRemainingLyd]);

  const parseAmt = (s: string) => {
    if (!s) return 0;
    const v = Number(String(s).replace(/,/g, "").trim());
    return Number.isFinite(v) ? v : 0;
  };

  const payLyd = parseAmt(payLydStr);
  const payUsd = parseAmt(payUsdStr);
  const payUsdLyd = parseAmt(payUsdLydStr);
  const payEur = parseAmt(payEurStr);
  const payEurLyd = parseAmt(payEurLydStr);

  const enteredLydEquivalent =
    normalizeLyd0(payLyd) + normalizeLyd0(payUsdLyd) + normalizeLyd0(payEurLyd);

  const remainingLyd = getRemainingLyd();
  const canConfirmPayment =
    enteredLydEquivalent >= remainingLyd - moneyEps && enteredLydEquivalent <= remainingLyd + moneyEps;

  const isOverpay = enteredLydEquivalent > remainingLyd + moneyEps;

  const usdEquivMissing = payUsd > 0 && payUsdLyd <= 0;
  const eurEquivMissing = payEur > 0 && payEurLyd <= 0;

  const persistExtraPayment = React.useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Missing token. Please login again.");
      return false;
    }
    const psVal = String(invoice?.ps ?? (data?.invoice as any)?.ps ?? (data as any)?.ps ?? "");
    const usrVal = String(invoice?.usr ?? (data?.invoice as any)?.usr ?? (data as any)?.usr ?? "");
    if (!psVal || !usrVal) {
      alert("User info missing. Cannot update payment.");
      return false;
    }

    const currentLyd = Number((data as any)?.amount_lyd) || 0;
    const currentUsd = Number((data as any)?.amount_currency) || 0;
    const currentEur = Number((data as any)?.amount_EUR) || 0;
    const currentUsdLyd = Number((data as any)?.amount_currency_LYD) || 0;
    const currentEurLyd = Number((data as any)?.amount_EUR_LYD) || 0;

    const body: any = {
      total_remise_final: Number(data?.totalAmountUSD) || 0,
      total_remise_final_lyd: Number(data?.totalAmountLYD) || 0,
      amount_currency: currentUsd + payUsd,
      amount_lyd: currentLyd + payLyd,
      amount_EUR: currentEur + payEur,
      amount_currency_LYD: currentUsdLyd + payUsdLyd,
      amount_EUR_LYD: currentEurLyd + payEurLyd,
      ps: psVal,
      usr: usrVal,
      customer: (data as any)?.invoice?.client ?? (invoice as any)?.client ?? 0,
      sm: (data as any)?.invoice?.SourceMark ?? (invoice as any)?.SourceMark ?? "",
      is_chira: (data as any)?.invoice?.is_chira ?? (invoice as any)?.is_chira ?? 0,
      IS_WHOLE_SALE: (data as any)?.invoice?.IS_WHOLE_SALE ?? (invoice as any)?.IS_WHOLE_SALE ?? false,
      remise: (data as any)?.remise ?? 0,
      remise_per: (data as any)?.remise_per ?? 0,
    };

    try {
      const currentNumFact = Number(invoiceNumFact ?? invoice?.num_fact ?? 0);
      if (currentNumFact > 0) {
        // Issued invoice: update each row by id_fact so payment persists.
        const rows: any[] = Array.isArray((data as any)?.items) ? (data as any).items : [];
        for (const r of rows) {
          if (!r?.id_fact) continue;
          await axios.put(
            `${apiUrlinv}/Update/${r.id_fact}`,
            {
              ...body,
              id_fact: r.id_fact,
              num_fact: currentNumFact,
            },
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
        }
      } else {
        // Cart invoice (num_fact=0): update all cart rows.
        await axios.put(`${apiUrlinv}/UpdateTotals/0`, body, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      return true;
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to update payment");
      return false;
    }
  }, [data, invoice, invoiceNumFact, payEur, payEurLyd, payLyd, payUsd, payUsdLyd]);

  const proceedIssue = React.useCallback(async () => {
    const nf = await handleAddNew();
    if (!nf) {
      alert("Failed to generate invoice number.");
      return;
    }
    // Issuing invoice should remove it from cart immediately on the cart page.
    if (onCartRefresh) onCartRefresh();
    onClose();
  }, [handleAddNew, onCartRefresh, onClose]);

  const proceedClose = React.useCallback(async () => {
    await handleCloseInvoice();
  }, [handleCloseInvoice]);

  React.useEffect(() => {
    if (!paymentRequiredOpen) return;
    if (remainingLyd <= moneyEps) {
      setPaymentRequiredOpen(false);
      setPayLydStr("");
      setPayUsdStr("");
      setPayUsdLydStr("");
      setPayEurStr("");
      setPayEurLydStr("");
    }
  }, [paymentRequiredOpen, remainingLyd]);

  React.useEffect(() => {
    // Avoid stale Payment Required dialog when switching invoices
    setPaymentRequiredOpen(false);
    setPayLydStr("");
    setPayUsdStr("");
    setPayUsdLydStr("");
    setPayEurStr("");
    setPayEurLydStr("");
  }, [invoice?.num_fact, invoice?.id_fact, open]);

  const handlePaymentRequiredConfirm = async () => {
    if (!canConfirmPayment) return;
    if (usdEquivMissing || eurEquivMissing) return;
    const ok = await persistExtraPayment();
    if (!ok) return;

    setPaymentRequiredOpen(false);
    setPayLydStr("");
    setPayUsdStr("");
    setPayUsdLydStr("");
    setPayEurStr("");
    setPayEurLydStr("");

    if (paymentAction === "issue") {
      await proceedIssue();
      return;
    }
    await proceedClose();
  };

  const handleConfirmYes = async () => {
    setConfirmOpen(false);
    // Generating invoice number is allowed even if partially paid.
    await proceedIssue();
  };

  const handleCloseInvoiceClick = async () => {
    const isGiftInvoice = !!invoice?.IS_GIFT;
    const isChiraInvoice = Number((invoice as any)?.is_chira ?? 0) === 1;
    const totalLyd = Number(data?.totalAmountLYD) || 0;
    const totalUsd = Number(data?.totalAmountUSD) || 0;
    const totalEur = Number(data?.totalAmountEur) || 0;

    const paidLyd = Number((data as any)?.amount_lyd) || 0;
    const paidUsd = Number((data as any)?.amount_currency) || 0;
    const paidEur = Number((data as any)?.amount_EUR) || 0;
    const sumPaid = paidLyd + paidUsd + paidEur;

    const remaining = getRemainingLyd();

    // Require entering missing payment before closing
    if (!isGiftInvoice && remaining > moneyEps) {
      setPaymentAction("close");
      setPaymentRequiredOpen(true);
      return;
    }

    if (!isGiftInvoice && !isChiraInvoice && sumPaid <= 0) {
      alert("Cannot close invoice: paid amounts are 0 (allowed only for Chira).");
      return;
    }

    if (!isGiftInvoice && totalLyd <= 0 && totalUsd <= 0 && totalEur <= 0) {
      alert("Cannot close invoice: totals are 0.");
      return;
    }
    await proceedClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ p: 3, background: "#fff", color: "#000" }}>
        <Box
          sx={{
            display: "flex",
            gap: 2,
            justifyContent: "flex-end",
            alignItems: "center",
            background: "#fff",
          }}
        >
          {isPartiallyPaid ? (
            <Box sx={{ mr: "auto", color: "#b26a00", fontWeight: 700 }}>
              This invoice is partially paid.
            </Box>
          ) : null}
          <FormControlLabel
            control={
              <Checkbox
                checked={showGoldUnitPrices}
                onChange={(e) => setShowGoldUnitPrices(e.target.checked)}
                size="small"
              />
            }
            label="Show price/g & price/piece"
            sx={{ mr: 1 }}
          />

          <FormControlLabel
            control={
              <Radio
                checked={showDiscountValues}
                onClick={() => setShowDiscountValues((v) => !v)}
                size="small"
              />
            }
            label="Show Discount"
            sx={{ mr: 1 }}
          />

          <FormControlLabel
            control={
              <Radio
                checked={showSurchargeValues}
                onClick={() => setShowSurchargeValues((v) => !v)}
                size="small"
              />
            }
            label="Show Surcharge"
            sx={{ mr: 1 }}
          />

          {/* {!showCloseInvoiceActions &&
            (!invoiceNumFact || invoiceNumFact === 0) && (
              <Button
                variant="contained"
                color="secondary"
                onClick={handleGenerateNewNumberClick}
              >
                Generate New Invoice Number
              </Button>
            )} */}

        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 3, background: "#fff", color: "#000" }}>
        <WatchStandardInvoiceContent
          ref={printRef as unknown as React.Ref<HTMLDivElement>}
          data={dataWithTotalAmountFinal}
          num_fact={invoiceNumFact ?? invoice?.num_fact}
          key={invoiceNumFact ?? invoice?.num_fact ?? "default"}
          showImage={showImage}
          showGoldUnitPrices={showGoldUnitPrices}
          showDiscountValues={showDiscountValues}
          showSurchargeValues={showSurchargeValues}
          createdBy={createdBy}
        />
      </DialogContent>
      <DialogActions sx={{ background: "info", color: "#000" }}>
        <Button onClick={onClose} variant="outlined" color="error">
          Cancel
        </Button>
        {!showCloseInvoiceActions && (!invoiceNumFact || invoiceNumFact === 0) ? (
          <Button
            variant="contained"
            color="secondary"
            onClick={handleGenerateNewNumberClick}
          >
            Generate Invoice Number
          </Button>
        ) : null}
        <Button
          variant="contained"
          color="primary"
          onClick={handlePrint}
          disabled={!invoiceNumFact || Number(invoiceNumFact) === 0}
        >
          Print
        </Button>
      </DialogActions>

      <MuiDialog open={paymentRequiredOpen} onClose={() => setPaymentRequiredOpen(false)}>
        <MuiDialogTitle>Payment Required</MuiDialogTitle>
        <MuiDialogContent>
          Remaining amount:
          <br />
          <span style={{ color: "red", fontWeight: 700 }}>
            {normalizeLyd0(remainingLyd).toLocaleString(undefined, { maximumFractionDigits: 0 })} LYD
          </span>
          <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
            <TextField
              label="Pay (LYD)"
              value={payLydStr}
              onChange={(e) => setPayLydStr(e.target.value)}
              onBlur={() => {
                const v = parseAmt(payLydStr);
                setPayLydStr(v ? String(normalizeLyd0(v)) : "");
              }}
              size="small"
              fullWidth
            />
            <TextField
              label="Pay (USD)"
              value={payUsdStr}
              onChange={(e) => setPayUsdStr(e.target.value)}
              onBlur={() => {
                const usd = parseAmt(payUsdStr);
                const r = getUsdRate();
                if (usd > 0 && (!parseAmt(payUsdLydStr) || parseAmt(payUsdLydStr) <= 0) && Number.isFinite(r) && r > 0) {
                  const lyd = normalizeLyd0(usd * r);
                  setPayUsdLydStr(String(lyd));
                }
              }}
              size="small"
              fullWidth
            />
            <TextField
              label="USD to LYD (equivalent)"
              value={payUsdLydStr}
              onChange={(e) => setPayUsdLydStr(e.target.value)}
              onBlur={() => {
                const lyd = parseAmt(payUsdLydStr);
                setPayUsdLydStr(lyd ? String(normalizeLyd0(lyd)) : "");
                const usd = parseAmt(payUsdStr);
                const r = getUsdRate();
                if (lyd > 0 && (!usd || usd <= 0) && Number.isFinite(r) && r > 0) {
                  const nextUsd = normalizeMoney(lyd / r);
                  setPayUsdStr(nextUsd ? String(nextUsd) : "");
                }
              }}
              size="small"
              fullWidth
              error={usdEquivMissing}
              helperText={usdEquivMissing ? "Enter USD equivalent in LYD" : ""}
            />
            <TextField
              label="Pay (EUR)"
              value={payEurStr}
              onChange={(e) => setPayEurStr(e.target.value)}
              onBlur={() => {
                const eur = parseAmt(payEurStr);
                const r = getEurRate();
                if (eur > 0 && (!parseAmt(payEurLydStr) || parseAmt(payEurLydStr) <= 0) && Number.isFinite(r) && r > 0) {
                  const lyd = normalizeLyd0(eur * r);
                  setPayEurLydStr(String(lyd));
                }
              }}
              size="small"
              fullWidth
            />
            <TextField
              label="EUR to LYD (equivalent)"
              value={payEurLydStr}
              onChange={(e) => setPayEurLydStr(e.target.value)}
              onBlur={() => {
                const lyd = parseAmt(payEurLydStr);
                setPayEurLydStr(lyd ? String(normalizeLyd0(lyd)) : "");
                const eur = parseAmt(payEurStr);
                const r = getEurRate();
                if (lyd > 0 && (!eur || eur <= 0) && Number.isFinite(r) && r > 0) {
                  const nextEur = normalizeMoney(lyd / r);
                  setPayEurStr(nextEur ? String(nextEur) : "");
                }
              }}
              size="small"
              fullWidth
              error={eurEquivMissing}
              helperText={eurEquivMissing ? "Enter EUR equivalent in LYD" : ""}
            />
            <Box sx={{ fontWeight: 700 }}>
              Entered (LYD equiv): {normalizeLyd0(enteredLydEquivalent).toLocaleString(undefined, { maximumFractionDigits: 0 })} LYD
            </Box>
            {isOverpay ? (
              <Box sx={{ color: "error.main", fontWeight: 700 }}>
                Overpayment is not allowed. Reduce the entered amount.
              </Box>
            ) : null}
          </Box>
        </MuiDialogContent>
        <MuiDialogActions>
          <Button
            onClick={() => {
              setPaymentRequiredOpen(false);
              setPayLydStr("");
              setPayUsdStr("");
              setPayUsdLydStr("");
              setPayEurStr("");
              setPayEurLydStr("");
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handlePaymentRequiredConfirm}
            color="primary"
            variant="contained"
            disabled={!canConfirmPayment || usdEquivMissing || eurEquivMissing}
          >
            Confirm Payment & Continue
          </Button>
        </MuiDialogActions>
      </MuiDialog>

      {/* Confirmation Dialog for Generate New Invoice Number */}
      <MuiDialog open={confirmOpen} onClose={handleConfirmClose}>
        <MuiDialogTitle>Confirmation</MuiDialogTitle>
        <MuiDialogContent>
          Issue this invoice? 
          <br />
          <span style={{ color: "red" }}>This is final and cannot be undone.</span>
        </MuiDialogContent>
        <MuiDialogActions>
          <Button onClick={handleConfirmClose}>Cancel</Button>
          <Button
            onClick={handleConfirmYes}
            color="primary"
            variant="contained"
          >
            Yes
          </Button>
        </MuiDialogActions>
      </MuiDialog>

    </Dialog>
  );
};

export default PrintInvoiceDialog;