/* eslint-disable @typescript-eslint/no-unused-vars */
import React from "react";
import {
  Box,
  Typography,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@mui/material";
import axios from "../api";
import { decodeSellerToken } from "../utils/routeCrypto";

export default function SellerReports() {
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<any[]>([]);
  const [sellerId, setSellerId] = React.useState<number | null>(null);
  const [sellerName, setSellerName] = React.useState<string>("");
  const [type, setType] = React.useState<"all" | "gold" | "diamond" | "watch">("all");
  const [currency, setCurrency] = React.useState<"all" | "LYD" | "USD" | "EUR">("all");
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const currentDate = `${yyyy}-${mm}-${dd}`;
  const [periodFrom, setPeriodFrom] = React.useState<string>(`${yyyy}-01-01`);
  const [periodTo, setPeriodTo] = React.useState<string>(currentDate);

  const [users, setUsers] = React.useState<Array<{ id_user: number; name_user: string }>>([]);
  const fetchUsers = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get(`/users/ListUsers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (Array.isArray(res.data)) setUsers(res.data);
    } catch {}
  };

  React.useEffect(() => {
    try {
      const path = typeof window !== "undefined" ? window.location.pathname : "";
      if (path.startsWith("/s/")) {
        const token = path.slice(3);
        const id = decodeSellerToken(token);
        if (id) {
          setSellerId(id);
          try { localStorage.setItem("sellerFocusId", String(id)); } catch {}
        }
      } else {
        const idStr = localStorage.getItem("sellerFocusId");
        if (idStr) setSellerId(Number(idStr));
      }
    } catch {}
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!sellerId) return;
    const u = users.find((x) => Number(x.id_user) === Number(sellerId));
    if (u) setSellerName(u.name_user);
  }, [sellerId, users]);

  const fetchInvoices = React.useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get(`/invoices/allDetailsP`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          ...(type !== "all" ? { type } : {}),
          from: periodFrom || undefined,
          to: periodTo || undefined,
        },
      });
      let rows = Array.isArray(res.data) ? res.data : [];
      if (sellerId) {
        rows = rows.filter((r: any) => {
          const id = r?.Utilisateur?.id_user;
          return id && Number(id) === Number(sellerId);
        });
      }
      if (type !== "all") {
        rows = rows.filter((row: any) => {
          const raw = row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || "";
          const t = String(raw).toLowerCase();
          if (type === "gold") return t.includes("gold");
          if (type === "diamond") return t.includes("diamond");
          if (type === "watch") return t.includes("watch");
          return true;
        });
      }
      if (currency !== "all") {
        rows = rows.filter((row: any) => {
          if (currency === "LYD") return Number(row.amount_lyd) > 0;
          if (currency === "USD") return Number(row.amount_currency) > 0;
          if (currency === "EUR") return Number(row.amount_EUR) > 0;
          return true;
        });
      }
      // De-duplicate: prefer invoice number when available; otherwise by date + amounts
      // This removes repeated lines of the same sale that share the same date and totals
      {
        const seen = new Map<string, any>();
        for (const r of rows) {
          const date = String(r?.date_fact || "").slice(0, 10);
          const num = r?.num_fact ? String(r.num_fact) : "";
          const lyd = Number(r?.amount_lyd || 0).toFixed(2);
          const usd = Number(r?.amount_currency || 0).toFixed(2);
          const eur = Number(r?.amount_EUR || 0).toFixed(2);
          const key = num ? `${date}|${num}` : `${date}|${lyd}|${usd}|${eur}`;
          if (!seen.has(key)) seen.set(key, r);
        }
        rows = Array.from(seen.values());
      }
      setData(rows);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [sellerId, type, periodFrom, periodTo, currency]);

  React.useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const totals = React.useMemo(() => {
    const count = data.length;
    const sumLYD = data.reduce((s, r) => s + (Number(r.amount_lyd) || 0), 0);
    const sumUSD = data.reduce((s, r) => s + (Number(r.amount_currency) || 0), 0);
    const sumEUR = data.reduce((s, r) => s + (Number(r.amount_EUR) || 0), 0);
    const goldCount = data.filter((r) => String(r?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || "").toLowerCase().includes("gold")).length;
    const diamondCount = data.filter((r) => String(r?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || "").toLowerCase().includes("diamond")).length;
    const watchCount = data.filter((r) => String(r?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || "").toLowerCase().includes("watch")).length;
    return { count, sumLYD, sumUSD, sumEUR, goldCount, diamondCount, watchCount };
  }, [data]);

  // Thumbnails per invoice row (by product id), and minimal details for watch/diamond
  const [thumbs, setThumbs] = React.useState<Record<string, string>>({});
  const [watchDetails, setWatchDetails] = React.useState<Record<string, any>>({});
  const [diamondDetails, setDiamondDetails] = React.useState<Record<string, any>>({});

  // Helper to derive a representative product id for images/details
  const getProductId = React.useCallback((row: any): string | null => {
    const a0 = (row?.ACHATs || [])[0] || {};
    const id = row?.picint || a0?.picint || a0?.id_achat || row?.id_fact || row?.num_fact;
    return id ? String(id) : null;
  }, []);

  React.useEffect(() => {
    // Fetch minimal details and first thumbnail per row
    const token = localStorage.getItem("token");
    if (!Array.isArray(data) || data.length === 0) {
      setThumbs({});
      setWatchDetails({});
      setDiamondDetails({});
      return;
    }
    (async () => {
      for (const row of data) {
        const pid = getProductId(row);
        if (!pid) continue;
        const supplierType = String(row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || "").toLowerCase();
        // Fetch details for watch/diamond if not present
        try {
          if (supplierType.includes("watch") && watchDetails[pid] === undefined) {
            const res = await axios.get(`/WOpurchases/getitem/${pid}`, { headers: { Authorization: token ? `Bearer ${token}` : undefined } });
            setWatchDetails((p) => ({ ...p, [pid]: Array.isArray(res.data) ? res.data[0] : res.data }));
          }
        } catch {}
        try {
          if (supplierType.includes("diamond") && diamondDetails[pid] === undefined) {
            const res = await axios.get(`/DOpurchases/getitem/${pid}`, { headers: { Authorization: token ? `Bearer ${token}` : undefined } });
            setDiamondDetails((p) => ({ ...p, [pid]: Array.isArray(res.data) ? res.data[0] : res.data }));
          }
        } catch {}
        // Fetch first image thumbnail if missing
        if (thumbs[pid] === undefined) {
          const idNum = Number(pid);
          const endpoints: string[] = supplierType.includes("watch")
            ? [`/images/list/watch/${idNum}`, `/images/list/${idNum}`]
            : supplierType.includes("diamond")
            ? [`/images/list/diamond/${idNum}`, `/images/list/${idNum}`]
            : [`/images/list/${idNum}`];
          let firstUrl: string | null = null;
          for (const url of endpoints) {
            try {
              const r = await axios.get(url, { headers: { Authorization: token ? `Bearer ${token}` : undefined } });
              const arr = Array.isArray(r.data) ? r.data : [];
              if (arr.length) {
                let u = String(arr[0]);
                if (token && !u.includes("token=")) u += (u.includes("?") ? "&" : "?") + `token=${encodeURIComponent(token)}`;
                firstUrl = u;
                break;
              }
            } catch {}
          }
          if (firstUrl) setThumbs((p) => ({ ...p, [pid]: firstUrl as string }));
          else setThumbs((p) => ({ ...p, [pid]: "" }));
        }
      }
    })();
    // we purposely avoid thumbs/watchDetails/diamondDetails in deps to prevent loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, getProductId]);

  const maxCount = Math.max(totals.goldCount, totals.diamondCount, totals.watchCount, 1);
  const bar = (value: number, color: string) => (
    <Box sx={{ height: 10, width: `${Math.round((value / maxCount) * 100)}%`, background: color, borderRadius: 1 }} />
  );

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Seller Reports
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(200px, 1fr))",
            gap: 2,
          }}
        >
          <FormControl size="small">
            <InputLabel>Seller</InputLabel>
            <Select
              label="Seller"
              value={sellerId ?? ""}
              onChange={(e) => {
                const val = e.target.value as any;
                const newId = val === "" ? null : Number(val);
                setSellerId(newId);
                try {
                  if (newId)
                    localStorage.setItem("sellerFocusId", String(newId));
                  else localStorage.removeItem("sellerFocusId");
                } catch {}
              }}
            >
              <MenuItem value="">All</MenuItem>
              {users.map((u) => (
                <MenuItem key={u.id_user} value={u.id_user}>
                  {u.name_user}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>Type</InputLabel>
            <Select
              label="Type"
              value={type}
              onChange={(e) => setType(e.target.value as any)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="gold">Gold</MenuItem>
              <MenuItem value="diamond">Diamond</MenuItem>
              <MenuItem value="watch">Watch</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>Currency</InputLabel>
            <Select
              label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as any)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="LYD">LYD</MenuItem>
              <MenuItem value="USD">USD</MenuItem>
              <MenuItem value="EUR">EUR</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            type="date"
            label="From"
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            size="small"
            type="date"
            label="To"
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Box>
      </Paper>

      <Box
        sx={{
          display: "flex",
          gap: 1,
          alignItems: "center",
          flexWrap: "wrap",
          mb: 2,
        }}
      >
        <Chip label={`Invoices: ${totals.count}`} />
        <Chip
          label={`LYD: ${totals.sumLYD.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
        />
        <Chip
          label={`USD: ${totals.sumUSD.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
        />
        <Chip
          label={`EUR: ${totals.sumEUR.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
        />
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Products Mix
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 6fr",
            alignItems: "center",
            gap: 1,
            mb: 1,
          }}
        >
          <Typography variant="body2">Gold</Typography>
          {bar(totals.goldCount, "#FFD700")}
          <Typography variant="body2">Diamond</Typography>
          {bar(totals.diamondCount, "#B9F2FF")}
          <Typography variant="body2">Watch</Typography>
          {bar(totals.watchCount, "#888")}
        </Box>
      </Paper>

      <Paper sx={{ p: 0 }}>
        {loading ? (
          <Box
            sx={{
              p: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CircularProgress size={20} />
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Invoice No</TableCell>
                <TableCell>Invoice ID</TableCell>
                <TableCell>Image</TableCell>
                <TableCell>Spec</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Client</TableCell>
                {!sellerId && <TableCell>Seller</TableCell>}
                <TableCell align="right">LYD</TableCell>
                <TableCell align="right">USD</TableCell>
                <TableCell align="right">EUR</TableCell>
                <TableCell>PS</TableCell>
                <TableCell>Chira</TableCell>
                <TableCell>Closed</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row) => {
                const tRaw = row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || "";
                const t = String(tRaw).toLowerCase().includes("gold")
                  ? "Gold"
                  : String(tRaw).toLowerCase().includes("diamond")
                    ? "Diamond"
                    : String(tRaw).toLowerCase().includes("watch")
                      ? "Watch"
                      : tRaw;
                const client = row?.Client
                  ? `${row.Client.client_name || ""}${row.Client.client_name && row.Client.tel_client ? " - " : ""}${row.Client.tel_client || ""}`
                  : "";
                const pid = getProductId(row) || "";
                const invoiceId =
                  row?.id_fact ?? row?.Id_fact ?? row?.picint ?? "";
                const seller = row?.Utilisateur?.name_user || "";
                // Build spec based on type
                let spec = "";
                const typeLower = String(tRaw).toLowerCase();
                if (typeLower.includes("gold")) {
                  const w = (row?.ACHATs || []).reduce(
                    (sum: number, a: any) => {
                      const st = String(
                        a?.Fournisseur?.TYPE_SUPPLIER || ""
                      ).toLowerCase();
                      if (st.includes("gold")) {
                        const q = Number(a?.qty || 0);
                        if (!isNaN(q)) return sum + q;
                      }
                      return sum;
                    },
                    0
                  );
                  if (w > 0) spec = `Weight: ${w.toFixed(2)} g`;
                } else if (typeLower.includes("diamond")) {
                  const d = diamondDetails[pid] || {};
                  const unwrap =
                    d?.OriginalAchatDiamond ||
                    d?.purchaseD ||
                    d?.OriginalAchat ||
                    d ||
                    {};
                  let carat = unwrap?.carat;
                  if (carat === undefined) {
                    // fallback scan in ACHATs
                    for (const a of row?.ACHATs || []) {
                      if (a?.carat) {
                        carat = a.carat;
                        break;
                      }
                      const dp =
                        a?.DistributionPurchase ||
                        a?.distributionPurchase ||
                        {};
                      const od =
                        dp?.OriginalAchatDiamond ||
                        dp?.purchaseD ||
                        dp?.OriginalAchat ||
                        {};
                      if (od?.carat) {
                        carat = od.carat;
                        break;
                      }
                    }
                  }
                  if (carat !== undefined && carat !== null && carat !== "")
                    spec = `Carat: ${carat}`;
                } else if (typeLower.includes("watch")) {
                  const w = watchDetails[pid] || {};
                  const brand =
                    w?.Brand?.client_name ||
                    w?.brand?.client_name ||
                    w?.Brand ||
                    w?.brand ||
                    "";
                  const name = w?.Design_art || w?.design || "";
                  const ref = w?.reference_number || w?.reference || "";
                  const serial = w?.serial_number || w?.serial || "";
                  const parts = [
                    brand && `Brand: ${brand}`,
                    name && `Name: ${name}`,
                    ref && `Ref: ${ref}`,
                    serial && `S/N: ${serial}`,
                  ].filter(Boolean);
                  spec = parts.join(" | ");
                }
                return (
                  <TableRow key={row.num_fact || row.id_fact || row.picint}>
                    <TableCell>{row.date_fact || ""}</TableCell>
                    <TableCell>{row.num_fact || ""}</TableCell>
                    <TableCell>{invoiceId}</TableCell>
                    <TableCell>
                      {pid && thumbs[pid] ? (
                        <img
                          src={thumbs[pid]}
                          alt="thumb"
                          style={{
                            width: 56,
                            height: 56,
                            objectFit: "cover",
                            borderRadius: 6,
                            border: "1px solid #ddd",
                          }}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell>{spec}</TableCell>
                    <TableCell>{t}</TableCell>
                    <TableCell>{client}</TableCell>
                    {!sellerId && <TableCell>{seller}</TableCell>}
                    <TableCell align="right">
                      {Number(row.amount_lyd || 0).toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell align="right">
                      {Number(row.amount_currency || 0).toLocaleString(
                        "en-US",
                        { maximumFractionDigits: 2 }
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {Number(row.amount_EUR || 0).toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>{row.ps || ""}</TableCell>
                    <TableCell>{row.is_chira ? "Yes" : "No"}</TableCell>
                    <TableCell>{row.IS_OK ? "Yes" : "No"}</TableCell>
                  </TableRow>
                );
              })}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10}>
                    <Box
                      sx={{
                        p: 3,
                        textAlign: "center",
                        color: "text.secondary",
                      }}
                    >
                      No results
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
