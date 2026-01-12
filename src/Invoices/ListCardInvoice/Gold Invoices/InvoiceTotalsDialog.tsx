import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  InputAdornment,
  Radio,
  RadioGroup,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import React from "react";
import api from "../../../api";

interface Client {
  id_client: number;
  client_name: string;
  tel_client: string;
}

interface Sm {
  id_SourceMark: number;
  SourceMarketing: string;
  Status: boolean;
}

interface InvoiceTotalsDialogProps {
  Type_Supplier: string;
  open: boolean;
  lastUsdRate?: number | null;
  lastEurRate?: number | null;
  totals: {
    total_remise_final: number;
    total_remise_final_lyd: number; // Added for LYD total
    amount_currency: number;
    amount_lyd: number;
    amount_EUR: number;
    amount_currency_LYD: number;
    amount_EUR_LYD: number;
    remise: number; // Discount Value
    remise_per: number; // Discount percentage
  };
  isSaving: boolean;
  onChange: (field: string, value: number) => void;
  onClose: () => void;
  onUpdate: () => void;
  onPrint?: () => void;
  SelectedInvoiceNum?: number;
  Sm: Sm[];
  customers: Client[];
  editInvoice: any;
  setEditInvoice: (fn: (prev: any) => any) => void;
  errors: { client: string };
  // Optional approval context (same approach as EditTotalRN)
  minPer?: number | null; // minimum allowed discount % before approval is required
  totalPrixVente?: number | null; // base total used to compute actual discount %
  referenceId?: number | null; // invoice reference (id_fact or num_fact) for approval request
}

const stripInternalCommentTags = (raw: any) => {
  const s = String(raw ?? "");
  return s
    .replace(/\s*\|\s*__META__\{[\s\S]*?\}\s*$/, "")
    .replace(/\s*\|\s*__DSMETA__\{[\s\S]*?\}\s*$/, "")
    .replace(/__META__\{[\s\S]*?\}\s*$/, "")
    .replace(/__DSMETA__\{[\s\S]*?\}\s*$/, "")
    .trim();
};

const extractInternalCommentTags = (raw: any) => {
  const s = String(raw ?? "");
  const m1 = s.match(/__META__\{[\s\S]*\}$/);
  const m2 = s.match(/__DSMETA__\{[\s\S]*\}$/);
  const tags: string[] = [];
  if (m1?.[0]) tags.push(m1[0]);
  if (m2?.[0]) tags.push(m2[0]);
  return tags;
};

// Helper to parse local formatted string to number
const parseNumber = (value: string) => {
  if (!value) return 0;
  // Remove commas, parse as float
  return parseFloat(value.replace(/,/g, "")) || 0;
};

const normalizePhone = (v: string) => String(v || "").replace(/\D/g, "").trim();
const normalizeName = (v: string) => String(v || "").trim().toLowerCase();

const isValidPhone = (raw: string) => {
  const v = String(raw || "").trim();
  if (!v) return false;
  if (v.startsWith("+")) {
    const rest = v.slice(1);
    return /^\d+$/.test(rest) && rest.length >= 6;
  }
  if (v.startsWith("00")) {
    const rest = v.slice(2);
    return /^\d+$/.test(rest) && rest.length >= 6;
  }
  return /^09\d{8}$/.test(v);
};

const InvoiceTotalsDialog: React.FC<InvoiceTotalsDialogProps> = ({
  open,
  lastUsdRate,
  lastEurRate,
  totals,
  isSaving,
  Type_Supplier,
  onChange,
  onClose,
  onUpdate,
  onPrint,
  SelectedInvoiceNum,
  Sm,
  customers,
  editInvoice,
  setEditInvoice,
  errors,
  minPer,
  totalPrixVente,
  referenceId,
}) => {
  const isGoldInvoice = Type_Supplier.toLowerCase().includes("gold");
  const baseCurrencyLabel = isGoldInvoice ? "LYD" : "USD";

  const getApprovalReferenceNumber = React.useCallback((): number => {
    const fromInvoice =
      (editInvoice && (editInvoice.num_fact || editInvoice.id_fact)) || 0;
    const fromProp = referenceId || 0;
    return Number(fromInvoice || fromProp || 0) || 0;
  }, [editInvoice, referenceId]);

  const getApprovalPendingKey = React.useCallback((): string => {
    const ref = getApprovalReferenceNumber();
    return `approval_pending_invoice_${String(ref || 0)}`;
  }, [getApprovalReferenceNumber]);

  const normalizeMoney = React.useCallback(
    (v: number) => Math.round((Number(v) || 0) * 100) / 100,
    []
  );
  const normalizeLyd0 = React.useCallback(
    (v: number) => Math.round(Number(v) || 0),
    []
  );
  const moneyEps = 0.01;

  const [paymentRemainderMsg, setPaymentRemainderMsg] = React.useState<string>("");
  const [paymentRemainderKind, setPaymentRemainderKind] = React.useState<
    "success" | "warning" | "error" | ""
  >("");
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [alertMsg, setAlertMsg] = React.useState("");
  const [tabIndex, setTabIndex] = React.useState(0);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {}
  );
  const [paymentTouched, setPaymentTouched] = React.useState(false);
  const [customerRequiredError, setCustomerRequiredError] =
    React.useState(false);
  const [sourceRequiredError, setSourceRequiredError] = React.useState(false);

  const [activeField, setActiveField] = React.useState<
    | null
    | "total_remise_final_lyd"
    | "amount_lyd"
    | "amount_currency"
    | "amount_currency_LYD"
    | "amount_EUR"
    | "amount_EUR_LYD"
  >(null);

  const [totalLydStr, setTotalLydStr] = React.useState<string>("");
  const [amountLydStr, setAmountLydStr] = React.useState<string>("");
  const [amountUsdStr, setAmountUsdStr] = React.useState<string>("");
  const [amountUsdLydStr, setAmountUsdLydStr] = React.useState<string>("");
  const [amountEurStr, setAmountEurStr] = React.useState<string>("");
  const [amountEurLydStr, setAmountEurLydStr] = React.useState<string>("");
  const [approvalWaitOpen, setApprovalWaitOpen] = React.useState(false);

  const [approvalGrantedOpen, setApprovalGrantedOpen] = React.useState(false);

  const [paymentType, setPaymentType] = React.useState<"cash" | "bank">("cash");

  React.useEffect(() => {
    if (!open) return;
    if (activeField === null || activeField !== "total_remise_final_lyd") {
      const v = Number(totals.total_remise_final_lyd);
      setTotalLydStr(
        Number.isFinite(v) && v !== 0
          ? String(normalizeMoney(v))
          : ""
      );
    }
    if (activeField === null || activeField !== "amount_lyd") {
      const v = Number(totals.amount_lyd);
      setAmountLydStr(Number.isFinite(v) && v !== 0 ? String(v) : "");
    }
    if (activeField === null || activeField !== "amount_currency") {
      const v = Number(totals.amount_currency);
      setAmountUsdStr(Number.isFinite(v) && v !== 0 ? String(v) : "");
    }
    if (activeField === null || activeField !== "amount_currency_LYD") {
      const v = Number(totals.amount_currency_LYD);
      setAmountUsdLydStr(Number.isFinite(v) && v !== 0 ? String(v) : "");
    }
    if (activeField === null || activeField !== "amount_EUR") {
      const v = Number(totals.amount_EUR);
      setAmountEurStr(Number.isFinite(v) && v !== 0 ? String(v) : "");
    }
    if (activeField === null || activeField !== "amount_EUR_LYD") {
      const v = Number(totals.amount_EUR_LYD);
      setAmountEurLydStr(Number.isFinite(v) && v !== 0 ? String(v) : "");
    }
  }, [open, totals, activeField]);

  const commitLiveInputsToTotals = React.useCallback(() => {
    // Commit any in-progress string edits so issuance uses what the user typed.
    // Only commit when user has a non-empty value (so we don't overwrite existing values with 0).
    alert("**********************" + editInvoice.client)
    const setIfPresent = (field: string, raw: string) => {
      const s = String(raw ?? "").trim();
      if (s === "") return;
      onChange(field, parseNumber(s));
    };

    // Commit payment amounts
    setIfPresent("total_remise_final_lyd", totalLydStr);
    setIfPresent("amount_lyd", amountLydStr);
    setIfPresent("amount_currency", amountUsdStr);
    setIfPresent("amount_currency_LYD", amountUsdLydStr);
    setIfPresent("amount_EUR", amountEurStr);
    setIfPresent("amount_EUR_LYD", amountEurLydStr);

    // Ensure customer data is committed to editInvoice
    if (editInvoice) {
      setEditInvoice((prev: any) => ({
        ...prev,
        // Ensure customer details are preserved
        customer: editInvoice.client,
        tel_client: prev?.tel_client || "",
        // Ensure payment details are preserved
        amount_lyd: parseNumber(amountLydStr) || prev?.amount_lyd || 0,
        amount_currency: parseNumber(amountUsdStr) || prev?.amount_currency || 0,
        amount_currency_LYD: parseNumber(amountUsdLydStr) || prev?.amount_currency_LYD || 0,
        amount_EUR: parseNumber(amountEurStr) || prev?.amount_EUR || 0,
        amount_EUR_LYD: parseNumber(amountEurLydStr) || prev?.amount_EUR_LYD || 0,
        total_remise_final_lyd: parseNumber(totalLydStr) || prev?.total_remise_final_lyd || 0,
        // Ensure discount values are preserved
        remise: prev?.remise || 0,
        remise_per: prev?.remise_per || 0,
        // Ensure other essential fields are preserved
        ps: prev?.ps || null,
        usr: prev?.usr || null,
        date_fact: prev?.date_fact || new Date().toISOString().split('T')[0],
      }));
    }
  }, [amountEurLydStr, amountEurStr, amountLydStr, amountUsdLydStr, amountUsdStr, onChange, totalLydStr, editInvoice, setEditInvoice]);

  const [localCustomers, setLocalCustomers] = React.useState<Client[]>(customers);
  const [createCustomerOpen, setCreateCustomerOpen] = React.useState(false);
  const [duplicateCustomerOpen, setDuplicateCustomerOpen] = React.useState(false);
  const [duplicateMatchedCustomer, setDuplicateMatchedCustomer] = React.useState<Client | null>(null);
  const [duplicateMatchedCustomers, setDuplicateMatchedCustomers] = React.useState<Client[]>([]);
  const [newCustomer, setNewCustomer] = React.useState({
    client_name: "",
    tel_client: "",
  });
  const [newCustomerErrors, setNewCustomerErrors] = React.useState<Record<string, string>>({});

  const [fullPaymentRequiredOpen, setFullPaymentRequiredOpen] = React.useState(false);

  React.useEffect(() => {
    setLocalCustomers(customers);
  }, [customers, open]);

  // Separate discount / surcharge values (same approach as EditTotalRN)
  const [remiseDiscount, setRemiseDiscount] = React.useState(0); // absolute discount value
  const [remiseSurcharge, setRemiseSurcharge] = React.useState(0); // absolute surcharge value
  const [remisePerDiscount, setRemisePerDiscount] = React.useState(0); // discount %
  const [remisePerSurcharge, setRemisePerSurcharge] = React.useState(0); // surcharge %

  const [discountComment, setDiscountComment] = React.useState<string>("");
  const [surchargeComment, setSurchargeComment] = React.useState<string>("");

  const didInitRemiseSplitsRef = React.useRef(false);

  // Initialize discount/surcharge splits from net remise / remise_per
  React.useEffect(() => {
    if (!open) return;
    // Only initialize once per dialog open so user can keep both discount & surcharge fields filled
    // without the UI collapsing them into a single net value.
    if (didInitRemiseSplitsRef.current) return;
    didInitRemiseSplitsRef.current = true;

    const netRemise = Number(totals.remise) || 0;
    setRemiseDiscount(netRemise < 0 ? Math.abs(netRemise) : 0);
    setRemiseSurcharge(netRemise > 0 ? netRemise : 0);

    const netRemisePer = Number(totals.remise_per) || 0;
    setRemisePerDiscount(netRemisePer < 0 ? Math.abs(netRemisePer) : 0);
    setRemisePerSurcharge(netRemisePer > 0 ? netRemisePer : 0);
  }, [open]);

  // Reset init flag when dialog closes
  React.useEffect(() => {
    if (open) return;
    didInitRemiseSplitsRef.current = false;
  }, [open]);

  // Compute final total after discount/surcharge (numeric, before LYD conversion)
  const getFinalTotalNumeric = React.useCallback(() => {
    const totalBase = Number(totals.total_remise_final) || 0;
    if (!totalBase) return 0;

    const disc = Number(remiseDiscount) || 0;
    const sur = Number(remiseSurcharge) || 0;
    const discPer = Number(remisePerDiscount) || 0;
    const surPer = Number(remisePerSurcharge) || 0;

    const afterValue = totalBase - disc + sur;
    const afterPercent =
      afterValue - totalBase * (discPer / 100) + totalBase * (surPer / 100);
    return afterPercent;
  }, [totals.total_remise_final, remiseDiscount, remiseSurcharge, remisePerDiscount, remisePerSurcharge]);

  // Compute discount percentage vs allowed minPer to know when approval is needed
  const approvalInfo = React.useMemo(() => {
    const baseTotal = typeof totalPrixVente === "number" ? totalPrixVente : 0;
    const minAllowedFromRole = typeof minPer === "number" ? minPer : 0;
    const minAllowed = Math.max(minAllowedFromRole, 2);
    const finalAfter = getFinalTotalNumeric();
    let diffPer = 0;
    if (baseTotal > 0) {
      diffPer = ((baseTotal - finalAfter) / baseTotal) * 100;
    }
    const approvalNeeded = minAllowed > 0 && diffPer > minAllowed;
    return { baseTotal, minAllowed, diffPer, approvalNeeded };
  }, [minPer, totalPrixVente, getFinalTotalNumeric]);


  const [approvalPending, setApprovalPending] = React.useState(false);
  const [approvalPolling, setApprovalPolling] = React.useState(false);
  const [approvalStatus, setApprovalStatus] = React.useState<"" | "pending" | "approved" | "rejected" | "timeout">("");

  React.useEffect(() => {
    if (!open) return;
    if (!approvalInfo.approvalNeeded) {
      setApprovalPending(false);
      setApprovalPolling(false);
      setApprovalStatus("");
      return;
    }
    try {
      const k = getApprovalPendingKey();
      const raw = localStorage.getItem(k);
      if (raw) {
        setApprovalPending(true);
        setApprovalStatus("pending");
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, approvalInfo.approvalNeeded]);

  // Helper to recompute Total Amount (LYD) based on current discounts/surcharges and type/rate
  const recomputeLydTotal = React.useCallback(() => {
      const finalAfterDiscountNumeric = getFinalTotalNumeric();
      const isGold = Type_Supplier.toLowerCase().includes("gold");
      let targetTotalLyd: number | null = null;

      if (isGold) {
        // Gold: Total Amount (LYD) = Final Total After Discount (LYD)
        targetTotalLyd = finalAfterDiscountNumeric;
      } else if (
        lastUsdRate != null &&
        Number.isFinite(Number(lastUsdRate)) &&
        finalAfterDiscountNumeric
      ) {
        // Non-gold (USD): Total Amount (LYD) = Final Total After Discount * Last USD rate
        targetTotalLyd = finalAfterDiscountNumeric * Number(lastUsdRate);
      }

      if (targetTotalLyd == null) return;
      const existing = Number(totals.total_remise_final_lyd) || 0;
      const next = normalizeMoney(targetTotalLyd);
      if (Math.abs(existing - next) > moneyEps) {
        onChange("total_remise_final_lyd", Number(next));
      }
    },
    [Type_Supplier, totals.total_remise_final_lyd, lastUsdRate, getFinalTotalNumeric, onChange, normalizeMoney]
  );

  // Validation handler for update
  const validateTotals = () => {
    // Compute final total after discount / surcharge (numeric)
    const finalAfterDiscountNumeric = getFinalTotalNumeric();

    // NOTE: For remainder/status we treat LYD as whole LYD (display + comparisons)
    // to avoid UI showing "Remainder: 0" due to float tails (e.g. 842.0000076).
    const totalLyd = normalizeLyd0(Number(totals.total_remise_final_lyd) || 0);
    const paidLyd = normalizeLyd0(Number(totals.amount_lyd) || 0);
    const paidUsd = Number(totals.amount_currency) || 0;
    const paidUsdLyd = normalizeLyd0(Number(totals.amount_currency_LYD) || 0);
    const paidEur = Number(totals.amount_EUR) || 0;
    const paidEurLyd = normalizeLyd0(Number(totals.amount_EUR_LYD) || 0);
    const sumPaid = paidLyd + paidUsdLyd + paidEurLyd;
    const diff = totalLyd - sumPaid;
    const alertList: string[] = [];
    const newFieldErrors: Record<string, string> = {};

    void finalAfterDiscountNumeric;
    
    setFieldErrors(newFieldErrors);

    // Keep the old top alert only for non-payment tabs.
    if (tabIndex !== 2 && alertList.length > 0) {
      setAlertMsg(alertList.map((msg) => `• ${msg}`).join("\n"));
      setAlertOpen(true);
      return false;
    }

    // On Payments tab: no top alert; full payment required (block partial + overpayment).
    setAlertOpen(false);
    setAlertMsg("");
    if (tabIndex === 2) {
      setFieldErrors(newFieldErrors);
      const blockingKeys = Object.keys(newFieldErrors);
      const mismatch = Math.abs(diff) > moneyEps;
      if (mismatch) return false;
      return blockingKeys.length === 0;
    }

    // Other tabs: if we didn't raise an alert, it's ok
    return true;
  };

  // Validate on any relevant change
  React.useEffect(() => {
    validateTotals();
    // eslint-disable-next-line
  }, [
    totals.total_remise_final_lyd,
    totals.amount_lyd,
    totals.amount_currency_LYD,
    totals.amount_EUR_LYD,
  ]);

  // Keep `total_remise_final_lyd` in sync with the computed final total after discount/surcharge
  // - For gold: use the final total after discount as LYD directly
  // - For non-gold (USD): use final total after discount * last USD rate (when available)
  React.useEffect(() => {
    recomputeLydTotal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Type_Supplier, totals.total_remise_final, lastUsdRate, remiseDiscount, remiseSurcharge, remisePerDiscount, remisePerSurcharge]);

  const applyCommentsToInvoice = React.useCallback(() => {
    const dc = String(discountComment || "").trim();
    const sc = String(surchargeComment || "").trim();

    if (!dc && !sc) return;
    const merged = [
      dc ? `Discount: ${dc}` : "",
      sc ? `Surcharge: ${sc}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    setEditInvoice((prev: any) => {
      const existingClean = stripInternalCommentTags(prev?.COMMENT ?? "");
      const next = existingClean
        ? (merged ? `${existingClean} | ${merged}` : existingClean)
        : merged;
      return {
        ...prev,
        COMMENT: next,
      };
    });
  }, [discountComment, surchargeComment, setEditInvoice]);

  // const finalizeAndIssueInvoice = React.useCallback(() => {
  //   // Ensure parent totals state contains latest values typed by the user.
  //   commitLiveInputsToTotals();
  //   applyCommentsToInvoice();

  //   // Create a comprehensive snapshot of all invoice data before issuance
  //   const invoiceSnapshot = {
  //     ...editInvoice,
  //     // Explicitly preserve all critical fields
  //     client: editInvoice?.client || null,
  //     Client: editInvoice?.Client || null,
  //     tel_client: editInvoice?.tel_client || editInvoice?.Client?.tel_client || "",
  //     phone_client: editInvoice?.phone_client || editInvoice?.Client?.tel_client || "",
  //     date_fact: editInvoice?.date_fact || new Date().toISOString().split('T')[0],
  //     mode_fact: editInvoice?.mode_fact || "Debitor",
  //     SourceMark: editInvoice?.SourceMark || null,
  //     is_chira: editInvoice?.is_chira || false,
  //     IS_WHOLE_SALE: editInvoice?.IS_WHOLE_SALE || false,
  //     COMMENT: editInvoice?.COMMENT || "",
  //     accept_discount: editInvoice?.accept_discount ?? false,
  //     ps: editInvoice?.ps || null,
  //     usr: editInvoice?.usr || null,
  //     // Payment fields from current totals
  //     total_remise_final_lyd: parseNumber(totalLydStr) || totals.total_remise_final_lyd,
  //     amount_lyd: parseNumber(amountLydStr) || totals.amount_lyd,
  //     amount_currency: parseNumber(amountUsdStr) || totals.amount_currency,
  //     amount_currency_LYD: parseNumber(amountUsdLydStr) || totals.amount_currency_LYD,
  //     amount_EUR: parseNumber(amountEurStr) || totals.amount_EUR,
  //     amount_EUR_LYD: parseNumber(amountEurLydStr) || totals.amount_EUR_LYD,
  //     remise: totals.remise,
  //     remise_per: totals.remise_per,
  //   };

  //   // Force update the editInvoice with the complete snapshot
  //   setEditInvoice((prev: any) => {
  //     const updated = { ...prev, ...invoiceSnapshot };
  //     console.log("Invoice snapshot before issuance:", updated);
  //     return updated;
  //   });

  //   // Close totals dialog and notify; then issue invoice number.
  //   setApprovalGrantedOpen(true);
  //   onClose();

  //   // Allow React state to flush to parent before issuing.
  //   setTimeout(() => {
  //     onUpdate();
  //   }, 150); // Increased timeout to ensure all state updates are flushed
  // }, [applyCommentsToInvoice, commitLiveInputsToTotals, onClose, onUpdate, editInvoice, setEditInvoice, totalLydStr, amountLydStr, amountUsdStr, amountUsdLydStr, amountEurStr, amountEurLydStr, totals]);

  const handleUpdate = () => {
    if (!validateTotals()) return;

    // Safety: if approval is required, do not proceed to onUpdate (which issues invoice number).
    if (approvalInfo.approvalNeeded) {
      setAlertMsg("Discount limit exceeded — approval is required before confirming checkout.");
      setAlertOpen(true);
      return;
    }

    // Payments tab: full payment required.
    if (tabIndex === 2) {
      const totalLyd = normalizeLyd0(Number(totals.total_remise_final_lyd) || 0);
      const sumPaid =
        normalizeLyd0(Number(totals.amount_lyd) || 0) +
        normalizeLyd0(Number(totals.amount_currency_LYD) || 0) +
        normalizeLyd0(Number(totals.amount_EUR_LYD) || 0);
      const diff = totalLyd - sumPaid;
      if (Math.abs(diff) > moneyEps) {
        setFullPaymentRequiredOpen(true);
        return;
      }
    }

    // Commit latest dialog edits before issuing.
    commitLiveInputsToTotals();

    // Persist updated comments before checkout
    applyCommentsToInvoice();

    onUpdate();
  };

  const validateNewCustomer = () => {
    const errs: Record<string, string> = {};
    const name = String(newCustomer.client_name || "").trim();
    const phone = String(newCustomer.tel_client || "").trim();

    if (!name) {
      errs.client_name = "Customer name is required";
    }
    if (!isValidPhone(phone)) {
      errs.tel_client = "Phone must be 09xxxxxxxx or start with 00 / +";
    }
    setNewCustomerErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const fetchCustomers = React.useCallback(async (): Promise<Client[]> => {
    const token = localStorage.getItem("token");
    if (!token) return [];
    const res = await api.get<Client[]>("/customers/all", {
      headers: { Authorization: `Bearer ${token}` },
    });
    setLocalCustomers(res.data);
    return res.data;
  }, [setLocalCustomers]);

  const handleCreateCustomer = async () => {
    if (!validateNewCustomer()) return;

    // Check duplicates locally first and allow selecting among multiple matches.
    // Match if either phone matches or name matches (case-insensitive).
    const desiredPhone = String(newCustomer.tel_client || "").trim();
    const desiredName = String(newCustomer.client_name || "").trim();
    const nPhone = normalizePhone(desiredPhone);
    const nName = normalizeName(desiredName);
    const matches = (localCustomers || []).filter((c) => {
      const cPhone = normalizePhone(c.tel_client);
      const cName = normalizeName(c.client_name);
      const phoneMatch = nPhone && cPhone && nPhone === cPhone;
      const nameMatch = nName && cName && nName === cName;
      return phoneMatch || nameMatch;
    });
    if (matches.length > 0) {
      setDuplicateMatchedCustomers(matches);
      setDuplicateMatchedCustomer(matches.length === 1 ? matches[0] : null);
      setDuplicateCustomerOpen(true);
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    let currentUser = "";
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        currentUser = u.name_user ?? u.name ?? "";
      } catch {
        currentUser = localStorage.getItem("name_user") || "";
      }
    }

    await api.post(
      "/customers/Add",
      { ...newCustomer, usr: currentUser },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const refreshed = await fetchCustomers();
    // Auto-select newly created customer (best effort)
    setEditInvoice((prev: any) => {
      const found = refreshed.find(
        (c) =>
          String(c.client_name || "").trim() ===
            String(newCustomer.client_name || "").trim() &&
          String(c.tel_client || "").trim() ===
            String(newCustomer.tel_client || "").trim()
      );
      if (!found) return prev;
      return {
        ...prev,
        client: found.id_client,
        Client: found,
      };
    });
    setCreateCustomerOpen(false);
    setNewCustomer({ client_name: "", tel_client: "" });
    setNewCustomerErrors({});
  };

  // When discount % exceeds minPer, send an approval request instead of normal checkout
  const handleRequestApproval = async () => {
    if (!validateTotals()) return;

    const refId = getApprovalReferenceNumber();
    if (!refId) {
      window.alert("Cannot request approval: missing invoice reference.");
      return;
    }

    // Persist latest dialog edits before requesting approval.
    commitLiveInputsToTotals();
    applyCommentsToInvoice();

    try {
      const userStr = localStorage.getItem("user");
      let userName = "";
      let psVal = "";
      let usr = "";

      if (userStr) {
        try {
          const u = JSON.parse(userStr as string);
          userName = u.name_user || "";
          psVal = u.ps || "";
          usr = String(u.id_user ?? u.usr ?? "");
        } catch {
          // ignore parse errors, fall back to defaults
        }
      }

      const request_by = `${userName} - ${psVal}`.trim() || "Unknown";
      const date_request = new Date().toISOString().slice(0, 10);
      const type_request = "Invoice";
      const status = "pending";
      const AutoComment = "Invoice discount exceeded limit";
      const Refrences_Number = refId;

      await api.post("/ApprovalRequests/create", {
        request_by,
        date_request,
        type_request,
        status,
        AutoComment,
        Refrences_Number,
        Is_view: false,
      });

      try {
        localStorage.setItem(getApprovalPendingKey(), JSON.stringify({ refId, ts: Date.now() }));
      } catch {
        // ignore
      }
      setApprovalPending(true);
      setApprovalStatus("pending");

      // show waiting UI + prevent issuing invoice now
      setApprovalWaitOpen(true);

      // optional: close the totals dialog so user can’t try to “Confirm Checkout”
      // (polling still continues in background because we removed the `open` guard)
      onClose();

    } catch (err) {
      console.error(err);
      window.alert("Failed to send approval request. Please try again.");
    }
  };

  const finalizeAndIssueInvoice = React.useCallback(() => {
    // Commit live inputs
    commitLiveInputsToTotals();
    applyCommentsToInvoice();

    // Check payment
    const totalLyd0 = normalizeLyd0(Number(totals.total_remise_final_lyd) || 0);

    const paidLydLive =
      String(amountLydStr ?? "").trim() !== ""
        ? parseNumber(amountLydStr)
        : Number(totals.amount_lyd) || 0;
    const paidUsdLydLive =
      String(amountUsdLydStr ?? "").trim() !== ""
        ? parseNumber(amountUsdLydStr)
        : Number(totals.amount_currency_LYD) || 0;
    const paidEurLydLive =
      String(amountEurLydStr ?? "").trim() !== ""
        ? parseNumber(amountEurLydStr)
        : Number(totals.amount_EUR_LYD) || 0;

    const sumPaid0 =
      normalizeLyd0(paidLydLive) +
      normalizeLyd0(paidUsdLydLive) +
      normalizeLyd0(paidEurLydLive);
    const diffLyd = totalLyd0 - sumPaid0;

    if (diffLyd > moneyEps) {
      window.alert("Payment is insufficient. Please adjust payments.");
      return;
    }

    // Then call onUpdate
    onUpdate();
  }, [totals, amountLydStr, amountUsdLydStr, amountEurLydStr, paymentType, commitLiveInputsToTotals, applyCommentsToInvoice, onUpdate, normalizeLyd0, parseNumber, moneyEps]);

  const pollApprovalAndProceed = React.useCallback(async () => {
    const refId = getApprovalReferenceNumber();
    if (!refId) return;
    if (approvalPolling) return;

    setApprovalPolling(true);
    setApprovalStatus("pending");

    const token = localStorage.getItem("token");
    const started = Date.now();
    const maxMs = 2 * 60 * 1000;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    try {
      while (Date.now() - started < maxMs) {
        try {
          // Use dedicated endpoint that returns latest request regardless of notification visibility.
          const res = await api.get(`/ApprovalRequests/byRef/${encodeURIComponent(String(refId))}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            params: { type: "Invoice" },
          });
          const match = (res as any)?.data?.data || null;
          if (match) {
            const st = String(match.status || "").toLowerCase();
            if (st === "accepted" || st === "approve" || st === "approved") {
              setApprovalStatus("approved");
              setApprovalPending(false);
              try {
                localStorage.removeItem(getApprovalPendingKey());
              } catch {
                // ignore
              }
              // Issue invoice using the same data the user entered in the dialog.
              setApprovalWaitOpen(false);
              finalizeAndIssueInvoice();
              return;
            }
            if (st === "refused" || st === "rejected" || st === "deny" || st === "denied") {
              setApprovalStatus("rejected");
              setApprovalPending(false);
              try {
                localStorage.removeItem(getApprovalPendingKey());
              } catch {
                // ignore
              }
              window.alert("Discount approval was refused.");
              return;
            }
          }
        } catch {
          // ignore
        }

        await sleep(4000);
      }
      setApprovalStatus("timeout");
      setApprovalPending(true);
      window.alert("Approval is still pending (polling timed out). You can try reaching out to management or try again later.");
    } finally {
      setApprovalPolling(false);
    }
  }, [approvalPolling, finalizeAndIssueInvoice, getApprovalPendingKey, getApprovalReferenceNumber]);

  React.useEffect(() => {
    if (!approvalInfo.approvalNeeded) return;
    if (!approvalPending) return;
    if (approvalStatus === "approved" || approvalStatus === "rejected") return;
    if (approvalPolling) return;
    pollApprovalAndProceed();
  }, [approvalInfo.approvalNeeded, approvalPending, approvalPolling, approvalStatus, pollApprovalAndProceed]);


  const handleNextTab = () => {
    // Tab 0: require a selected customer (and no client error)
    if (tabIndex === 0) {
      if (errors.client || !editInvoice?.client || !editInvoice?.SourceMark) {
        if (!editInvoice?.client) {
          setCustomerRequiredError(true);
        }
        if (!editInvoice?.SourceMark) {
          setSourceRequiredError(true);
        }
        return;
      }
      setCustomerRequiredError(false);
      setSourceRequiredError(false);
    }
    // Tab 1: only block when Total Amount (LYD) is 0
    if (tabIndex === 1) {
      const totalLyd = Number(totals.total_remise_final_lyd) || 0;
      if (totalLyd === 0) {
        setAlertMsg("Total Amount (LYD) must be greater than 0 before proceeding to Payments.");
        setAlertOpen(true);
        return;
      }
    }
    if (tabIndex < 2) {
      setTabIndex(tabIndex + 1);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { minWidth: 1100 } }}
      >
        <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
            <span>Confirm Checkout</span>
          </Box>
          <IconButton onClick={onClose} size="small" aria-label="close">
            <CloseIcon />
          </IconButton>
        </Box>
        {SelectedInvoiceNum !== undefined && (
          <span
            style={{
              fontWeight: 400,
              fontSize: 16,
              marginLeft: 12,
              color: "var(--mui-palette-text-secondary)",
            }}
          >
            (ID: {SelectedInvoiceNum})
          </span>
        )}
        </DialogTitle>
        <DialogContent>
        {/* Alert on top (only show on Order Details and Payments tabs) */}
        {tabIndex !== 0 &&
          (alertOpen ? (
            <Alert
              severity="error"
              sx={{ mb: 2, whiteSpace: "pre-line" }}
              onClose={() => setAlertOpen(false)}
            >
              {alertMsg}
            </Alert>
          ) : null)}
        {/* Approval warning if discount percent exceeds minPer (same approach as EditTotalRN) */}
        {approvalInfo.approvalNeeded && (
          <Alert
            severity="warning"
            sx={{ mb: 2, whiteSpace: "pre-line" }}
          >
            {"Discount limit exceeded — approval is now needed to checkout"}
            {"\n"}
            {
              "لقد تجاوزت صلاحياتك في التخفيض انت محتاج اعتماد الان"
            }
          </Alert>
        )}
        {approvalInfo.approvalNeeded && approvalPending && (
          <Alert
            severity={approvalStatus === "timeout" ? "error" : "info"}
            sx={{ mb: 2, whiteSpace: "pre-line" }}
          >
            {approvalStatus === "timeout"
              ? "Approval is still pending (polling timed out). You can try again."
              : approvalPolling
                ? "Approval requested. Waiting for approval..."
                : "Approval requested. Waiting for approval..."}
          </Alert>
        )}
        <Box sx={{ display: "flex", alignItems: "flex-start", mt: 1 }}>
          {/* Left: tabs content */}
          <Box sx={{ flex: 3, pr: 2 }}>
            <Tabs
              value={tabIndex}
              onChange={(_, v) => setTabIndex(v)}
              sx={{ mt: 1, borderBottom: "1px solid #e0e0e0" }}
              variant="fullWidth"
            >
              <Tab label="Basic Info" />
              <Tab label="Order Details" />
              <Tab label="Payment Method" />
            </Tabs>

            {tabIndex === 0 && (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  mt: 2,
                }}
              >
            {/* Tab 1: Invoice Type, Customer, Source Marketing */}
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                select
                label="Invoice Classification"
                value={(() => {
                  if (editInvoice.is_chira === 1) return "is_chira";
                  if (editInvoice.IS_WHOLE_SALE === 1) return "IS_WHOLE_SALE";
                  return "invoice";
                })()}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditInvoice((prev: any) => ({
                    ...prev,
                    is_chira: val === "is_chira" ? 1 : 0,
                    IS_WHOLE_SALE: val === "IS_WHOLE_SALE" ? 1 : 0,
                  }));
                }}
                fullWidth
                size="small"
                sx={{ minWidth: 180, maxWidth: 220 }}
                SelectProps={{ native: true }}
              >
                <option value="invoice">Invoice</option>
                <option value="is_chira">Chira</option>
                <option value="IS_WHOLE_SALE">Whole Sale</option>
              </TextField>
              <Box sx={{ display: "flex", alignItems: "stretch", gap: 1, flexGrow: 2, minWidth: 350 }}>
                <Autocomplete
                  id="customer-select"
                  sx={{ width: 350, flexGrow: 2 }}
                  options={localCustomers}
                autoHighlight
                getOptionLabel={(option: Client) =>
                  `${option.client_name} (${option.tel_client || "No Phone"})`
                }
                value={
                  editInvoice.Client ||
                  localCustomers.find(
                    (s: Client) => s.id_client === editInvoice.client
                  ) ||
                  null
                }
                onChange={(event: any, newValue: Client | null) => {
                  setEditInvoice((prev: any) => ({
                    ...prev,
                    client: newValue?.id_client ?? 0,
                    Client: newValue || undefined,
                  }));
                  if (newValue?.id_client) {
                    setCustomerRequiredError(false);
                  }
                }}
                renderOption={(props: any, option: Client) => (
                  <Box component="li" {...props} key={option.id_client}>
                    <strong>{option.client_name}</strong> —{" "}
                    <span
                      style={{ color: "var(--mui-palette-text-secondary)" }}
                    >
                      {option.tel_client || "No Phone"}
                    </span>
                  </Box>
                )}
                renderInput={(params: any) => (
                  <TextField
                    {...params}
                    label="Customer"
                    error={!!errors.client || customerRequiredError}
                    helperText={
                      errors.client ||
                      (customerRequiredError ? "Customer is required" : "")
                    }
                    required
                    size="small"
                  />
                )}
                />
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => setCreateCustomerOpen(true)}
                  sx={{ alignSelf: "center" }}
                  aria-label="create-customer"
                >
                  <AddIcon />
                </IconButton>
              </Box>
              <Autocomplete
                id="MS-select"
                sx={{ width: 220, flexShrink: 1 }}
                options={Sm}
                autoHighlight
                getOptionLabel={(option: Sm) => `${option.SourceMarketing}`}
                value={
                  Sm.find(
                    (s: Sm) => s.SourceMarketing === editInvoice.SourceMark
                  ) || null
                }
                onChange={(event: any, newValue: Sm | null) => {
                  setEditInvoice((prev: any) => ({
                    ...prev,
                    SourceMark: newValue?.SourceMarketing ?? "",
                    Sm: newValue || undefined,
                  }));
                  if (newValue?.SourceMarketing) {
                    setSourceRequiredError(false);
                  }
                }}
                renderOption={(props: any, option: Sm) => (
                  <Box component="li" {...props} key={option.SourceMarketing}>
                    <strong>{option.SourceMarketing}</strong>
                  </Box>
                )}
                renderInput={(params: any) => (
                  <TextField
                    {...params}
                    label="Source Marketing"
                    error={!!errors.client || sourceRequiredError}
                    helperText={
                      errors.client ||
                      (sourceRequiredError ? "Source Marketing is required" : "")
                    }
                    required
                    size="small"
                  />
                )}
              />
            </Box>

          </Box>
            )}

            {tabIndex === 1 && (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  mt: 2,
                }}
              >
            {/* Tab 2: Total amount, discounts, totals after discounts */}
            {/* Row 2: Total Amount (Base Currency) */}
            <Box
              sx={{
                display: "flex",
                gap: 2,
                flexWrap: "wrap",
                alignItems: "flex-end",
                mb: 2,
              }}
            >
              <Box
                sx={{
                  flex: "1 1 0",
                  minWidth: 260,
                  display: "flex",
                  gap: 2,
                  flexWrap: "wrap",
                }}
              >
                <Box sx={{ flex: "1 1 220px", minWidth: 220 }}>
                  <TextField
                    label="Discount Value"
                    type="text"
                    fullWidth
                    size="small"
                    value={remiseDiscount}
                    onChange={(e) => {
                      const value = parseNumber(e.target.value);
                      setRemiseDiscount(value);
                      const netRemise = (Number(remiseSurcharge) || 0) - value;
                      onChange("remise", netRemise);
                      recomputeLydTotal();
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          {baseCurrencyLabel}
                        </InputAdornment>
                      ),
                      inputProps: {
                        inputMode: "decimal",
                        pattern: "[0-9.,-]*",
                      },
                    }}
                  />
                </Box>

                <Box sx={{ flex: "1 1 180px", minWidth: 180 }}>
                  <TextField
                    label="Discount (%)"
                    type="text"
                    fullWidth
                    size="small"
                    value={remisePerDiscount}
                    onChange={(e) => {
                      const value = parseNumber(e.target.value);
                      setRemisePerDiscount(value);
                      const netPer = (Number(remisePerSurcharge) || 0) - value;
                      onChange("remise_per", netPer);
                      recomputeLydTotal();
                    }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">%</InputAdornment>
                      ),
                      inputProps: {
                        inputMode: "decimal",
                        pattern: "[0-9.,-]*",
                      },
                    }}
                  />
                </Box>

                <Box sx={{ flex: "1 1 220px", minWidth: 220 }}>
                  <TextField
                    label="Surcharge Value"
                    type="text"
                    fullWidth
                    size="small"
                    value={remiseSurcharge}
                    onChange={(e) => {
                      const value = parseNumber(e.target.value);
                      setRemiseSurcharge(value);
                      const netRemise = value - (Number(remiseDiscount) || 0);
                      onChange("remise", netRemise);
                      recomputeLydTotal();
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          {baseCurrencyLabel}
                        </InputAdornment>
                      ),
                      inputProps: {
                        inputMode: "decimal",
                        pattern: "[0-9.,-]*",
                      },
                    }}
                  />
                </Box>

                <Box sx={{ flex: "1 1 180px", minWidth: 180 }}>
                  <TextField
                    label="Surcharge (%)"
                    type="text"
                    fullWidth
                    size="small"
                    value={remisePerSurcharge}
                    onChange={(e) => {
                      const value = parseNumber(e.target.value);
                      setRemisePerSurcharge(value);
                      const netPer = value - (Number(remisePerDiscount) || 0);
                      onChange("remise_per", netPer);
                      recomputeLydTotal();
                    }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">%</InputAdornment>
                      ),
                      inputProps: {
                        inputMode: "decimal",
                        pattern: "[0-9.,-]*",
                      },
                    }}
                  />
                </Box>

                <Box sx={{ flex: "1 1 360px", minWidth: 280 }}>
                  <TextField
                    label="Discount Comment"
                    type="text"
                    fullWidth
                    size="small"
                    value={discountComment}
                    onChange={(e) => setDiscountComment(e.target.value)}
                    onBlur={applyCommentsToInvoice}
                  />
                </Box>

                <Box sx={{ flex: "1 1 360px", minWidth: 280 }}>
                  <TextField
                    label="Surcharge Comment"
                    type="text"
                    fullWidth
                    size="small"
                    value={surchargeComment}
                    onChange={(e) => setSurchargeComment(e.target.value)}
                    onBlur={applyCommentsToInvoice}
                  />
                </Box>
              </Box>
            </Box>

            {/* Row 4: Final Total After Discount and Total Amount (LYD) */}
            <Box
              sx={{
                display: "flex",
                gap: 2,
                flexWrap: "wrap",
                alignItems: "flex-end",
                mb: 2,
              }}
            >
              <Box sx={{ flex: "1 1 260px", minWidth: 220 }}>
                <TextField
                  label={`Final Total After Discount (${baseCurrencyLabel})`}
                  type="text"
                  fullWidth
                  size="small"
                  value={(() => {
                    const finalNumeric = getFinalTotalNumeric();
                    return finalNumeric.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    });
                  })()}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        {baseCurrencyLabel}
                      </InputAdornment>
                    ),
                    readOnly: true,
                  }}
                  disabled
                />
              </Box>

              <Box sx={{ flex: "1 1 260px", minWidth: 220 }}>
                <TextField
                  label="Total Amount (LYD)"
                  type="text"
                  fullWidth
                  size="small"
                  value={totalLydStr}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">LYD</InputAdornment>
                    ),
                    readOnly: true,
                  }}
                  error={!!fieldErrors.totalAmountLyd}
                  helperText={fieldErrors.totalAmountLyd || ""}
                />
              </Box>
            </Box>
          </Box>
            )}

            {tabIndex === 2 && (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  mt: 2,
                }}
              >
            {/* Tab 3: Methods of payments */}
            <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
              <TextField
                label="Amount Paid (LYD)"
                type="text"
                sx={{ width: "40%" }}
                size="small"
                value={amountLydStr}
                onFocus={() => setActiveField("amount_lyd")}
                onChange={(e) => {
                  setPaymentTouched(true);
                  setAmountLydStr(e.target.value);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.amountLyd;
                    return next;
                  });
                }}
                onBlur={() => {
                  setActiveField(null);
                  onChange("amount_lyd", normalizeMoney(parseNumber(amountLydStr)));
                  validateTotals();
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">LYD</InputAdornment>
                  ),
                  inputProps: {
                    inputMode: "decimal",
                    pattern: "[0-9.,-]*",
                  },
                }}
                error={!!fieldErrors.amountLyd}
                helperText={fieldErrors.amountLyd || ""}
              />
            </Box>

            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Amount Paid (USD)"
                type="text"
                fullWidth
                size="small"
                value={amountUsdStr}
                onFocus={() => setActiveField("amount_currency")}
                onChange={(e) => {
                  setPaymentTouched(true);
                  setAmountUsdStr(e.target.value);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.amountCurrency;
                    return next;
                  });
                }}
                onBlur={() => {
                  setActiveField(null);
                  const usd = parseNumber(amountUsdStr);
                  onChange("amount_currency", usd);
                  const rate = Number(lastUsdRate);
                  if (usd > 0 && Number.isFinite(rate) && rate > 0) {
                    const lyd = normalizeMoney(usd * rate);
                    setAmountUsdLydStr(String(lyd));
                    onChange("amount_currency_LYD", lyd);
                  }
                  validateTotals();
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">USD</InputAdornment>
                  ),
                  inputProps: {
                    inputMode: "decimal",
                    pattern: "[0-9.,-]*",
                  },
                }}
                error={!!fieldErrors.amountCurrency}
                helperText={fieldErrors.amountCurrency || ""}
              />
              <TextField
                label="Equivalent Amount Paid (USD to LYD)"
                type="text"
                fullWidth
                size="small"
                value={amountUsdLydStr}
                onFocus={() => setActiveField("amount_currency_LYD")}
                onChange={(e) => {
                  setPaymentTouched(true);
                  setAmountUsdLydStr(e.target.value);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.amountCurrencyLyd;
                    return next;
                  });
                }}
                onBlur={() => {
                  setActiveField(null);
                  const lyd = normalizeMoney(parseNumber(amountUsdLydStr));
                  onChange("amount_currency_LYD", lyd);
                  const rate = Number(lastUsdRate);
                  const currentUsd = Number(totals.amount_currency) || 0;
                  if (lyd > 0 && currentUsd === 0 && Number.isFinite(rate) && rate > 0) {
                    const usd = normalizeMoney(lyd / rate);
                    setAmountUsdStr(String(usd));
                    onChange("amount_currency", usd);
                  }
                  validateTotals();
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">LYD</InputAdornment>
                  ),
                  inputProps: {
                    inputMode: "decimal",
                    pattern: "[0-9.,-]*",
                  },
                }}
                error={!!fieldErrors.amountCurrencyLyd}
                helperText={fieldErrors.amountCurrencyLyd || ""}
              />
              {(() => {
                const usdToLyd = Number(totals.amount_currency_LYD);
                const usd = Number(totals.amount_currency);
                const exRate = usd > 0 ? usdToLyd / usd : NaN;
                return (
                  <Box
                    sx={{
                      ml: 2,
                      fontWeight: "bold",
                      color: "text.secondary",
                      minWidth: 120,
                    }}
                  >
                    Ex. rate ={" "}
                    {Number.isFinite(exRate)
                      ? exRate.toLocaleString("en-LY", {
                          minimumFractionDigits: 3,
                          maximumFractionDigits: 3,
                        })
                      : "-"}
                  </Box>
                );
              })()}
            </Box>

            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              <TextField
                label="Amount Paid (EUR)"
                type="text"
                fullWidth
                size="small"
                value={amountEurStr}
                onFocus={() => setActiveField("amount_EUR")}
                onChange={(e) => {
                  setPaymentTouched(true);
                  setAmountEurStr(e.target.value);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.amountEur;
                    return next;
                  });
                }}
                onBlur={() => {
                  setActiveField(null);
                  const eur = parseNumber(amountEurStr);
                  onChange("amount_EUR", eur);
                  const rate = Number(lastEurRate);
                  if (eur > 0 && Number.isFinite(rate) && rate > 0) {
                    const lyd = normalizeMoney(eur * rate);
                    setAmountEurLydStr(String(lyd));
                    onChange("amount_EUR_LYD", lyd);
                  }
                  validateTotals();
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">EUR</InputAdornment>
                  ),
                  inputProps: {
                    inputMode: "decimal",
                    pattern: "[0-9.,-]*",
                  },
                }}
                error={!!fieldErrors.amountEur}
                helperText={fieldErrors.amountEur || ""}
              />
              <TextField
                label="Equivalent Amount Paid (EUR to LYD)"
                type="text"
                fullWidth
                size="small"
                value={amountEurLydStr}
                onFocus={() => setActiveField("amount_EUR_LYD")}
                onChange={(e) => {
                  setPaymentTouched(true);
                  setAmountEurLydStr(e.target.value);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.amountEurLyd;
                    return next;
                  });
                }}
                onBlur={() => {
                  setActiveField(null);
                  const lyd = normalizeMoney(parseNumber(amountEurLydStr));
                  onChange("amount_EUR_LYD", lyd);
                  const rate = Number(lastEurRate);
                  const currentEur = Number(totals.amount_EUR) || 0;
                  if (lyd > 0 && currentEur === 0 && Number.isFinite(rate) && rate > 0) {
                    const eur = normalizeMoney(lyd / rate);
                    setAmountEurStr(String(eur));
                    onChange("amount_EUR", eur);
                  }
                  validateTotals();
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">LYD</InputAdornment>
                  ),
                  inputProps: {
                    inputMode: "decimal",
                    pattern: "[0-9.,-]*",
                  },
                }}
                error={!!fieldErrors.amountEurLyd}
                helperText={fieldErrors.amountEurLyd || ""}
              />
              {(() => {
                const eurToLyd = Number(totals.amount_EUR_LYD);
                const eur = Number(totals.amount_EUR);
                const exRate = eur > 0 ? eurToLyd / eur : NaN;
                return (
                  <Box
                    sx={{
                      ml: 2,
                      fontWeight: "bold",
                      color: "text.secondary",
                      minWidth: 120,
                    }}
                  >
                    Ex. rate ={" "}
                    {Number.isFinite(exRate)
                      ? exRate.toLocaleString("en-LY", {
                          minimumFractionDigits: 3,
                          maximumFractionDigits: 3,
                        })
                      : "-"}
                  </Box>
                );
              })()}

            </Box>

            <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
              {paymentRemainderMsg ? (
                <Chip
                  size="small"
                  color={
                    paymentRemainderKind === "success"
                      ? "success"
                      : paymentRemainderKind === "warning"
                        ? "warning"
                        : paymentRemainderKind === "error"
                          ? "error"
                          : "default"
                  }
                  label={paymentRemainderMsg}
                />
              ) : null}
            </Box>

            <Box sx={{ mt: 1 }}>
              {(() => {
                if (!paymentTouched) return null;
                const totalLyd = normalizeLyd0(Number(totals.total_remise_final_lyd) || 0);
                const sumPaid =
                  normalizeLyd0(Number(totals.amount_lyd) || 0) +
                  normalizeLyd0(Number(totals.amount_currency_LYD) || 0) +
                  normalizeLyd0(Number(totals.amount_EUR_LYD) || 0);
                const delta = sumPaid - totalLyd;
                const isOver = delta > moneyEps;
                const isPartial = delta < -moneyEps;

                const status = isOver ? "Overpaid" : isPartial ? "Partially Paid" : "Paid";

                const overcharged = Math.max(0, delta);
                const remainder = Math.max(0, -delta);
                const newTotal = totalLyd + overcharged;

                const fmt0 = (v: number) =>
                  v.toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  });

                return (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 0.75,
                      border: "1px solid",
                      borderColor: isOver
                        ? "success.main"
                        : isPartial
                          ? "warning.main"
                          : "success.main",
                      borderRadius: 1,
                      px: 1.5,
                      py: 1,
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Status
                      </Typography>
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography variant="body2">Total (LYD)</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {fmt0(totalLyd)}
                      </Typography>
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography variant="body2">Paid (LYD equiv)</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {fmt0(sumPaid)}
                      </Typography>
                    </Box>

                    {isPartial && (
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography
                          variant="body2"
                          sx={{ color: "warning.main", fontWeight: 700 }}
                        >
                          Remainder
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: "warning.main", fontWeight: 900 }}
                        >
                          {fmt0(remainder)} LYD
                        </Typography>
                      </Box>
                    )}

                    {isOver && (
                      <>
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                          <Typography
                            variant="body2"
                            sx={{ color: "success.main", fontWeight: 700 }}
                          >
                            Surcharge
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: "success.main", fontWeight: 900 }}
                          >
                            {fmt0(overcharged)} LYD
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            New Total
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 900 }}>
                            {fmt0(newTotal)} LYD
                          </Typography>
                        </Box>
                      </>
                    )}
                  </Box>
                );
              })()}
            </Box>

            <Box sx={{ mt: 2 }}>
              <TextField
                label="Comment"
                placeholder="Add internal notes or invoice comment"
                fullWidth
                size="small"
                multiline
                minRows={2}
                maxRows={4}
                value={stripInternalCommentTags(editInvoice?.COMMENT ?? "")}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditInvoice((prev: any) => ({
                    ...prev,
                    COMMENT: String(val ?? ""),
                  }));
                }}
              />
            </Box>

            <Box sx={{ mt: 2 }}>
              <FormControl component="fieldset">
                <FormLabel component="legend">Payment Type</FormLabel>
                <RadioGroup
                  row
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value as "cash" | "bank")}
                >
                  <FormControlLabel value="cash" control={<Radio />} label="Cash" />
                  <FormControlLabel value="bank" control={<Radio />} label="Bank Transfer" />
                </RadioGroup>
              </FormControl>
            </Box>
          </Box>
            )}
          </Box>

          {/* Right: summary chips */}
          <Box
            sx={{
              flex: 1,
              maxWidth: 280,
              pl: 2,
              borderLeft: "1px solid #e0e0e0",
              minWidth: 220,
            }}
          >
            {(() => {
              const isGold = Type_Supplier.toLowerCase().includes("gold");
              const currencyLabel = isGold ? "LYD" : "USD";

              const totalBase = Number(totals.total_remise_final) || 0;
              const discountValue = Number(remiseDiscount) || 0;
              const surchargeValue = Number(remiseSurcharge) || 0;
              const discountPer = Number(remisePerDiscount) || 0;
              const surchargePer = Number(remisePerSurcharge) || 0;
              const finalAfterDiscount = getFinalTotalNumeric();

              const totalLyd = Number(totals.total_remise_final_lyd) || 0;
              const paidLyd = Number(totals.amount_lyd) || 0;
              const paidUsd = Number(totals.amount_currency) || 0;
              const paidUsdLyd = Number(totals.amount_currency_LYD) || 0;
              const paidEur = Number(totals.amount_EUR) || 0;
              const paidEurLyd = Number(totals.amount_EUR_LYD) || 0;

              const sumPaidLyd =
                normalizeMoney(paidLyd) + normalizeMoney(paidUsdLyd) + normalizeMoney(paidEurLyd);

              const fmt = (val: number, frac: number = 2) =>
                val.toLocaleString("en-US", {
                  minimumFractionDigits: frac,
                  maximumFractionDigits: frac,
                });

              const round2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

              return (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <Box>
                    <Typography
                      variant="subtitle2"
                      sx={{ mb: 1, color: "primary.main" }}
                    >
                      Invoice Totals
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="body2">Total invoice</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {fmt(round2(totalBase))} {currencyLabel}
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="body2">Subtotal</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {fmt(round2(totalBase))} {currencyLabel}
                        </Typography>
                      </Box>
                      {(discountValue > 0 || discountPer > 0) && (
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            color: "warning.main",
                          }}
                        >
                          <Typography variant="body2">Discount</Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {(() => {
                              const parts: string[] = [];
                              if (discountValue > 0) {
                                const perc = totalBase ? (discountValue / totalBase) * 100 : 0;
                                parts.push(`${fmt(discountValue)} ${currencyLabel} (${fmt(perc, 2)}%)`);
                              }
                              if (discountPer > 0) {
                                const valFromPerc = totalBase ? totalBase * (discountPer / 100) : 0;
                                parts.push(`${fmt(discountPer, 2)}% (${fmt(valFromPerc)} ${currencyLabel})`);
                              }
                              return parts.join(" + ");
                            })()}
                          </Typography>
                        </Box>
                      )}
                      {(surchargeValue > 0 || surchargePer > 0) && (
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            color: "success.main",
                          }}
                        >
                          <Typography variant="body2">Surcharge</Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {(() => {
                              const parts: string[] = [];
                              if (surchargeValue > 0) {
                                const perc = totalBase ? (surchargeValue / totalBase) * 100 : 0;
                                parts.push(`${fmt(surchargeValue)} ${currencyLabel} (${fmt(perc, 2)}%)`);
                              }
                              if (surchargePer > 0) {
                                const valFromPerc = totalBase ? totalBase * (surchargePer / 100) : 0;
                                parts.push(`${fmt(surchargePer, 2)}% (${fmt(valFromPerc)} ${currencyLabel})`);
                              }
                              return parts.join(" + ");
                            })()}
                          </Typography>
                        </Box>
                      )}

                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="body2">Final after discount</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {fmt(round2(finalAfterDiscount))} {currencyLabel}
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="body2">Total amount (LYD)</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {fmt(normalizeMoney(totalLyd), 0)} LYD
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {tabIndex === 2 && (
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{ mb: 1, color: "secondary.main" }}
                      >
                        Payment Method
                      </Typography>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                          <Typography variant="body2">Subtotal (Paid)</Typography>
                          <Typography variant="body2" fontWeight={700}>
                            {fmt(normalizeMoney(sumPaidLyd), 0)} LYD
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                          <Typography variant="body2">LYD</Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {fmt(normalizeMoney(paidLyd), 0)} LYD
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                          <Typography variant="body2">USD & equiv</Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {fmt(round2(paidUsd))} ({fmt(normalizeMoney(paidUsdLyd), 0)} LYD)
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                          <Typography variant="body2">EUR & equiv</Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {fmt(round2(paidEur))} ({fmt(normalizeMoney(paidEurLyd), 0)} LYD)
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Box>
              );
            })()}
          </Box>
        </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between" }}>
        <Box>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setTabIndex((prev) => Math.max(0, prev - 1))}
            disabled={tabIndex === 0}
          >
            Previous
          </Button>
        </Box>

        <Box sx={{ display: "flex", gap: 1 }}>
          {tabIndex < 2 && (
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={handleNextTab}
            >
              Next
            </Button>
          )}
          {tabIndex === 2 &&
            (approvalInfo.approvalNeeded ? (
              <Button
                onClick={handleRequestApproval}
                variant="contained"
                color="warning"
                disabled={isSaving || approvalPolling || approvalPending}
              >
                Request Approval
              </Button>
            ) : (
              <Button
                onClick={handleUpdate}
                variant="contained"
                color="warning"
                disabled={(() => {
                  if (isSaving) return true;
                  const totalLyd0 = normalizeLyd0(Number(totals.total_remise_final_lyd) || 0);

                  const paidLydLive =
                    String(amountLydStr ?? "").trim() !== ""
                      ? parseNumber(amountLydStr)
                      : Number(totals.amount_lyd) || 0;
                  const paidUsdLydLive =
                    String(amountUsdLydStr ?? "").trim() !== ""
                      ? parseNumber(amountUsdLydStr)
                      : Number(totals.amount_currency_LYD) || 0;
                  const paidEurLydLive =
                    String(amountEurLydStr ?? "").trim() !== ""
                      ? parseNumber(amountEurLydStr)
                      : Number(totals.amount_EUR_LYD) || 0;

                  const sumPaid0 =
                    normalizeLyd0(paidLydLive) +
                    normalizeLyd0(paidUsdLydLive) +
                    normalizeLyd0(paidEurLydLive);
                  const diff0 = totalLyd0 - sumPaid0;
                  return diff0 > moneyEps;
                })()}
              >
                Confirm Checkout
              </Button>
            ))}
          {tabIndex === 2 && approvalInfo.approvalNeeded && approvalPending && approvalStatus === "timeout" && (
            <Button
              onClick={pollApprovalAndProceed}
              variant="outlined"
              color="warning"
              size="small"
              disabled={approvalPolling}
            >
              Retry Approval Check
            </Button>
          )}
        </Box>
        </DialogActions>

      </Dialog>

      <Dialog
        open={approvalGrantedOpen}
        onClose={() => setApprovalGrantedOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CheckCircleIcon color="success" />
            <span>Approval Granted</span>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Typography>
            Discount approval has been granted. The invoice number will now be issued.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setApprovalGrantedOpen(false)}>
            OK
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createCustomerOpen} onClose={() => setCreateCustomerOpen(false)}>
        <DialogTitle>New Customer</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1, minWidth: 420 }}>
            <TextField
              label="Client Name"
              value={newCustomer.client_name}
              onChange={(e) => setNewCustomer((p) => ({ ...p, client_name: e.target.value }))}
              error={!!newCustomerErrors.client_name}
              helperText={newCustomerErrors.client_name}
              size="small"
              fullWidth
            />
            <TextField
              label="Phone Number"
              value={newCustomer.tel_client}
              onChange={(e) => setNewCustomer((p) => ({ ...p, tel_client: e.target.value }))}
              error={!!newCustomerErrors.tel_client}
              helperText={newCustomerErrors.tel_client}
              size="small"
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateCustomerOpen(false)} variant="outlined" color="inherit">
            Close
          </Button>
          <Button onClick={handleCreateCustomer} variant="contained" color="primary">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={duplicateCustomerOpen} onClose={() => setDuplicateCustomerOpen(false)}>
        <DialogTitle>Customer Already Exists</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography>This customer already exists.</Typography>
          {duplicateMatchedCustomers.length > 1 ? (
            <Box sx={{ mt: 2, minWidth: 420 }}>
              <Typography sx={{ mb: 1 }}>
                Multiple customers match this name and/or phone. Please choose one:
              </Typography>
              <Autocomplete
                options={duplicateMatchedCustomers}
                autoHighlight
                getOptionLabel={(option: Client) =>
                  `${option.client_name} (${option.tel_client || "No Phone"})`
                }
                value={duplicateMatchedCustomer}
                onChange={(_, v) => setDuplicateMatchedCustomer(v)}
                renderInput={(params) => (
                  <TextField {...params} label="Choose Existing Customer" size="small" />
                )}
              />
            </Box>
          ) : duplicateMatchedCustomers.length === 1 && duplicateMatchedCustomers[0]?.id_client ? (
            <Box sx={{ mt: 1 }}>
              <Typography sx={{ fontWeight: 700 }}>
                {duplicateMatchedCustomers[0].client_name}
              </Typography>
              <Typography sx={{ color: "text.secondary" }}>
                {duplicateMatchedCustomers[0].tel_client}
              </Typography>
              <Typography sx={{ mt: 1 }}>
                Do you want to choose this existing customer?
              </Typography>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDuplicateCustomerOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              const selected =
                duplicateMatchedCustomer ||
                (duplicateMatchedCustomers.length === 1
                  ? duplicateMatchedCustomers[0]
                  : null);
              if (selected?.id_client) {
                setEditInvoice((prev: any) => ({
                  ...prev,
                  client: selected.id_client,
                  Client: selected,
                }));
                setCustomerRequiredError(false);
              }
              setDuplicateMatchedCustomer(null);
              setDuplicateMatchedCustomers([]);
              setDuplicateCustomerOpen(false);
              setCreateCustomerOpen(false);
              setNewCustomer({ client_name: "", tel_client: "" });
              setNewCustomerErrors({});
            }}
            disabled={
              duplicateMatchedCustomers.length > 1 && !duplicateMatchedCustomer
            }
          >
            Choose Customer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={fullPaymentRequiredOpen}
        onClose={() => setFullPaymentRequiredOpen(false)}
      >
        <DialogTitle>Full Payment Required</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography>
            The paid amount must match the invoice total before confirming checkout.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setFullPaymentRequiredOpen(false)}>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default InvoiceTotalsDialog;