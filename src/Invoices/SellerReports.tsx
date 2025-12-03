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
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@mui/material";
import axios from "../api";
import { decodeSellerToken } from "../utils/routeCrypto";

type Seller = {
  id_user: number;
  name_user: string;
};

export default function SellerReports() {
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<any[]>([]);
  const [sellerId, setSellerId] = React.useState<number | null>(null);
  const [sellerName, setSellerName] = React.useState<string>("");

  const [type, setType] = React.useState<"all" | "gold" | "diamond" | "watch">(
    "all"
  );
  const [currency, setCurrency] = React.useState<"all" | "LYD" | "USD" | "EUR">(
    "all"
  );

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const currentDate = `${yyyy}-${mm}-${dd}`;
  const [periodFrom, setPeriodFrom] = React.useState<string>(`${yyyy}-01-01`);
  const [periodTo, setPeriodTo] = React.useState<string>(currentDate);

  const [users, setUsers] = React.useState<Seller[]>([]);

  const fetchUsers = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get(`/users/ListUsers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (Array.isArray(res.data)) setUsers(res.data);
    } catch {
      /* ignore */
    }
  };

  // Resolve sellerId from /s/<token> or localStorage + load sellers list
  React.useEffect(() => {
    try {
      const path =
        typeof window !== "undefined" ? window.location.pathname : "";
      if (path.startsWith("/s/")) {
        const token = path.slice(3);
        const id = decodeSellerToken(token);
        if (id) {
          setSellerId(id);
          try {
            localStorage.setItem("sellerFocusId", String(id));
          } catch {}
        }
      } else {
        const idStr = localStorage.getItem("sellerFocusId");
        if (idStr) setSellerId(Number(idStr));
      }
    } catch {}
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update sellerName when sellerId or users change
  React.useEffect(() => {
    if (!sellerId) {
      setSellerName("");
      return;
    }
    const u = users.find((x) => Number(x.id_user) === Number(sellerId));
    if (u) setSellerName(u.name_user);
  }, [sellerId, users]);

  // Fetch invoices for current filters
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

      // Filter by seller (if focused)
      if (sellerId) {
        rows = rows.filter((r: any) => {
          const id = r?.Utilisateur?.id_user;
          return id && Number(id) === Number(sellerId);
        });
      }

      // Extra safety: type filter client-side
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

      // Currency filter
      if (currency !== "all") {
        rows = rows.filter((row: any) => {
          if (currency === "LYD") return Number(row.amount_lyd) > 0;
          if (currency === "USD") return Number(row.amount_currency) > 0;
          if (currency === "EUR") return Number(row.amount_EUR) > 0;
          return true;
        });
      }

      // De-duplicate: prefer invoice number when available; otherwise by date + totals
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

  const formatNumber = (value: any) => {
    const num = Number(value);
    if (isNaN(num)) return value ?? "";
    return num.toLocaleString("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
  };

  const safeData = Array.isArray(data) ? data : [];

  // --- Analytics (similar spirit to CustomerProfile) ---
  // First sale date
  const firstSaleDate = React.useMemo(() => {
    const toDate = (v: any) => {
      const d = v ? new Date(v) : null;
      return d && !isNaN(d as any) ? d : null;
    };
    const invoiceDates = safeData
      .filter((r: any) => r.date_fact)
      .map((r: any) => toDate(r.date_fact))
      .filter(Boolean) as Date[];
    if (invoiceDates.length === 0) return "";
    const min = new Date(Math.min(...invoiceDates.map((d) => d.getTime())));
    return min.toISOString().slice(0, 10);
  }, [safeData]);

  // Totals, per-type metrics
  const analytics = React.useMemo(() => {
    const byType = (row: any) =>
      String(
        row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || ""
      ).toLowerCase();

    let sumLYD = 0,
      sumUSD = 0,
      sumEUR = 0,
      goldGrams = 0,
      diamondCarats = 0,
      watchUSD = 0,
      watchEUR = 0;

    safeData.forEach((row: any) => {
      const t = byType(row);
      const aLYD = Number(row.amount_lyd) || 0;
      const aUSD = Number(row.amount_currency) || 0;
      const aEUR = Number(row.amount_EUR) || 0;
      sumLYD += aLYD;
      sumUSD += aUSD;
      sumEUR += aEUR;

      if (t.includes("gold")) {
        const achats = Array.isArray(row.ACHATs) ? row.ACHATs : [];
        achats.forEach((a: any) => {
          const q = Number(a.qty);
          if (!isNaN(q)) goldGrams += q;
        });
      } else if (t.includes("diamond")) {
        const achats = Array.isArray(row.ACHATs) ? row.ACHATs : [];
        achats.forEach((a: any) => {
          const keys = [
            "carat",
            "Carat",
            "crt",
            "CRT",
            "cts",
            "CTS",
            "carats",
            "Carats",
          ];
          for (const k of keys) {
            const v = Number((a as any)[k]);
            if (!isNaN(v) && v) {
              diamondCarats += v;
              break;
            }
          }
        });
      } else if (t.includes("watch")) {
        watchUSD += aUSD;
        watchEUR += aEUR;
      }
    });

    return {
      sumLYD,
      sumUSD,
      sumEUR,
      goldGrams,
      diamondCarats,
      watchUSD,
      watchEUR,
    };
  }, [safeData]);

  // Type counts for distribution
  const typeDistribution = React.useMemo(() => {
    const counts: Record<string, number> = {
      gold: 0,
      diamond: 0,
      watch: 0,
      other: 0,
    };
    safeData.forEach((row: any) => {
      const t = String(
        row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || ""
      ).toLowerCase();
      if (t.includes("gold")) counts.gold++;
      else if (t.includes("diamond")) counts.diamond++;
      else if (t.includes("watch")) counts.watch++;
      else counts.other++;
    });
    return counts;
  }, [safeData]);

  // Monthly stats (last 12 months)
  const monthlyStats = React.useMemo(() => {
    const map = new Map<string, number>();
    safeData.forEach((r: any) => {
      const d = r?.date_fact || r?.date;
      if (!d) return;
      const dt = new Date(d);
      if (isNaN(dt as any)) return;
      const key = `${dt.getFullYear()}-${String(
        dt.getMonth() + 1
      ).padStart(2, "0")}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    const now = new Date();
    const series: { key: string; label: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${dt.getFullYear()}-${String(
        dt.getMonth() + 1
      ).padStart(2, "0")}`;
      const label = dt.toLocaleString(undefined, { month: "short" });
      series.push({ key, label, count: map.get(key) || 0 });
    }
    return series;
  }, [safeData]);

  const maxMonthlyCount = React.useMemo(() => {
    const vals = monthlyStats.map((m) => m.count);
    return Math.max(1, ...(vals.length ? vals : [0]));
  }, [monthlyStats]);

  // Pie data
  const typePie = React.useMemo(() => {
    const segs = [
      { key: "gold", color: "#fbc02d", value: typeDistribution.gold },
      { key: "diamond", color: "#00acc1", value: typeDistribution.diamond },
      { key: "watch", color: "#7b1fa2", value: typeDistribution.watch },
      { key: "other", color: "#90a4ae", value: typeDistribution.other },
    ];
    const total = segs.reduce((s, x) => s + x.value, 0) || 1;
    let acc = 0;
    const parts: string[] = [];
    segs.forEach((s) => {
      const from = acc;
      const to = acc + (s.value / total) * 360;
      parts.push(`${s.color} ${from}deg ${to}deg`);
      acc = to;
    });
    return { segs, total, gradient: `conic-gradient(${parts.join(", ")})` };
  }, [typeDistribution]);

  // Flattened purchases (items) from invoices (like CustomerProfile)
  const purchases = React.useMemo(() => {
    const items: any[] = [];
    safeData.forEach((inv: any) => {
      const achats = Array.isArray(inv.ACHATs) ? inv.ACHATs : [];
      achats.forEach((a: any) => {
        items.push({
          invoice: {
            num_fact: inv.num_fact,
            date_fact: inv.date_fact,
            ps: inv.ps,
            client: inv.Client || null,
          },
          achat: a,
          supplier: a?.Fournisseur || null,
        });
      });
    });
    return items;
  }, [safeData]);

  return (
    <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header: Seller profile style */}
      <Paper
        elevation={2}
        sx={{
          background: "linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)",
          color: "white",
          p: 3,
          borderRadius: 2,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
          Seller Profile
        </Typography>

        {loading && safeData.length === 0 ? (
          <CircularProgress size={24} sx={{ color: "white" }} />
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 2,
            }}
          >
            <Box>
              <Typography
                variant="caption"
                sx={{
                  opacity: 0.9,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Seller Name
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {sellerName || (sellerId ? `Seller #${sellerId}` : "All Sellers")}
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="caption"
                sx={{
                  opacity: 0.9,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Seller ID
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {sellerId ?? "—"}
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="caption"
                sx={{
                  opacity: 0.9,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                First Sale
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {firstSaleDate || "—"}
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="caption"
                sx={{
                  opacity: 0.9,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Period
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {periodFrom} → {periodTo}
              </Typography>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Filter strip (Seller, Type, Currency, Date) */}
      <Paper
        elevation={1}
        sx={{
          p: 2,
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          alignItems: "center",
        }}
      >
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="seller-select-label">Seller</InputLabel>
          <Select
            labelId="seller-select-label"
            value={sellerId ?? ""}
            label="Seller"
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
            <MenuItem value="">
              <em>All Sellers</em>
            </MenuItem>
            {users.map((u) => (
              <MenuItem key={u.id_user} value={u.id_user}>
                {u.name_user}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

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
            <MenuItem value="all">All Types</MenuItem>
            <MenuItem value="gold">Gold</MenuItem>
            <MenuItem value="diamond">Diamond</MenuItem>
            <MenuItem value="watch">Watch</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="currency-select-label">Currency</InputLabel>
          <Select
            labelId="currency-select-label"
            value={currency}
            label="Currency"
            onChange={(e) =>
              setCurrency(e.target.value as "all" | "LYD" | "USD" | "EUR")
            }
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
          sx={{ width: 150 }}
          value={periodFrom}
          onChange={(e) => setPeriodFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="To"
          type="date"
          size="small"
          sx={{ width: 150 }}
          value={periodTo}
          onChange={(e) => setPeriodTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Paper>

      {/* Lifetime analytics grid (CustomerProfile-style) */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 2,
        }}
      >
        <Paper elevation={1} sx={{ p: 2, borderLeft: "4px solid #1976d2" }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            Total Sales LYD
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#1976d2" }}>
            {analytics.sumLYD.toLocaleString("en-US", {
              maximumFractionDigits: 2,
            })}
          </Typography>
        </Paper>
        <Paper elevation={1} sx={{ p: 2, borderLeft: "4px solid #388e3c" }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            Total Sales USD
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#388e3c" }}>
            {analytics.sumUSD.toLocaleString("en-US", {
              maximumFractionDigits: 2,
            })}
          </Typography>
        </Paper>
        <Paper elevation={1} sx={{ p: 2, borderLeft: "4px solid #f57c00" }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            Total Sales EUR
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#f57c00" }}>
            {analytics.sumEUR.toLocaleString("en-US", {
              maximumFractionDigits: 2,
            })}
          </Typography>
        </Paper>
        <Paper elevation={1} sx={{ p: 2, borderLeft: "4px solid #fbc02d" }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            Gold (grams)
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#fbc02d" }}>
            {analytics.goldGrams.toFixed(2)}
          </Typography>
        </Paper>
        <Paper elevation={1} sx={{ p: 2, borderLeft: "4px solid #00acc1" }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            Diamond (carats)
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#00acc1" }}>
            {analytics.diamondCarats.toFixed(2)}
          </Typography>
        </Paper>
        <Paper elevation={1} sx={{ p: 2, borderLeft: "4px solid #7b1fa2" }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            Watches USD
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#7b1fa2" }}>
            {analytics.watchUSD.toLocaleString("en-US", {
              maximumFractionDigits: 2,
            })}
          </Typography>
        </Paper>
        <Paper elevation={1} sx={{ p: 2, borderLeft: "4px solid #7b1fa2" }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            Watches EUR
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#7b1fa2" }}>
            {analytics.watchEUR.toLocaleString("en-US", {
              maximumFractionDigits: 2,
            })}
          </Typography>
        </Paper>
      </Box>

      {/* Charts row: Sales over time & product type distribution */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 2,
        }}
      >
        <Paper elevation={1} sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            Sales Over Time (last 12 months)
          </Typography>
          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <svg viewBox="0 0 600 220" width="100%" height="220">
              <rect x="0" y="0" width="600" height="220" fill="#fff" />
              <line
                x1="40"
                y1="180"
                x2="590"
                y2="180"
                stroke="#e0e0e0"
              />
              {monthlyStats.map((m, idx) => {
                const slots = monthlyStats.length || 1;
                const slotW = (550 - 0) / slots;
                const x = 40 + idx * slotW + 6;
                const barW = Math.max(6, slotW - 12);
                const h = Math.round((m.count / maxMonthlyCount) * 150);
                const y = 180 - h;
                return (
                  <g key={idx}>
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={h}
                      fill="#1976d2"
                      rx="3"
                    />
                    <text
                      x={x + barW / 2}
                      y={195}
                      fontSize="10"
                      textAnchor="middle"
                      fill="#666"
                    >
                      {m.label}
                    </text>
                    {h > 0 ? (
                      <text
                        x={x + barW / 2}
                        y={y - 4}
                        fontSize="10"
                        textAnchor="middle"
                        fill="#1976d2"
                      >
                        {m.count}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </Box>
        </Paper>

        <Paper elevation={1} sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            Product Type Distribution
          </Typography>
          <Box
            sx={{
              display: "flex",
              gap: 2,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Box
              sx={{
                width: 180,
                height: 180,
                borderRadius: "50%",
                background: typePie.gradient,
                boxShadow: 1,
              }}
            />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "auto auto",
                rowGap: 1,
                columnGap: 2,
              }}
            >
              {typePie.segs.map((s) => (
                <Box
                  key={s.key}
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: 0.5,
                      background: s.color,
                    }}
                  />
                  <Typography
                    variant="body2"
                    sx={{ minWidth: 90, color: "text.secondary" }}
                  >
                    {s.key.charAt(0).toUpperCase() + s.key.slice(1)}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {s.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* Purchases (items) table – analogous to CustomerProfile */}
      <Paper elevation={1} sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          All Sales (items)
        </Typography>
        {purchases.length === 0 ? (
          <Box sx={{ p: 2, color: "text.secondary" }}>No sales items</Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Invoice No</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Design</TableCell>
                <TableCell>Code</TableCell>
                <TableCell align="right">Qty/Weight</TableCell>
                <TableCell>PS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {purchases.map((it: any, idx: number) => {
                const inv = it.invoice || {};
                const a = it.achat || {};
                const s = it.supplier || {};
                const type = String(s?.TYPE_SUPPLIER || "");
                const client = inv.client
                  ? `${inv.client.client_name || ""}${
                      inv.client.client_name && inv.client.tel_client
                        ? " - "
                        : ""
                    }${inv.client.tel_client || ""}`
                  : "";
                return (
                  <TableRow key={idx}>
                    <TableCell>{inv.date_fact || ""}</TableCell>
                    <TableCell>{inv.num_fact || ""}</TableCell>
                    <TableCell>{client}</TableCell>
                    <TableCell>{type}</TableCell>
                    <TableCell>{a.Design_art || ""}</TableCell>
                    <TableCell>{a.CODE_EXTERNAL || a.id_art || ""}</TableCell>
                    <TableCell align="right">{a.qty ?? ""}</TableCell>
                    <TableCell>{inv.ps || ""}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
