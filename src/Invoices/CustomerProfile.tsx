import React from "react";
import { Box, CircularProgress, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody } from "@mui/material";
import axios from "../api";
import { buildEncryptedClientPath } from "../utils/routeCrypto";
import CustomersReports from "./CustomersReports";

type Props = { id: number };

type Client = {
  id_client: number;
  client_name: string;
  tel_client: string;
};

export default function CustomerProfile({ id }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [customer, setCustomer] = React.useState<Client | null>(null);
  const [invoices, setInvoices] = React.useState<any[]>([]);
  const [payments, setPayments] = React.useState<any[]>([]);
  const [purchases, setPurchases] = React.useState<any[]>([]);
  const [analytics, setAnalytics] = React.useState({
    firstPurchaseDate: "",
    sumLYD: 0,
    sumUSD: 0,
    sumEUR: 0,
    paidLYD: 0,
    paidUSD: 0,
    paidEUR: 0,
    goldGrams: 0,
    diamondCarats: 0,
    watchUSD: 0,
    watchEUR: 0,
  });

  const apiIp = process.env.REACT_APP_API_IP;

  React.useEffect(() => {
    let mounted = true;
    const fetchCustomers = async () => {
      setLoading(true);
      const token = localStorage.getItem("token");
      try {
        const res = await axios.get<Client[]>(`${apiIp}/customers/all`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!mounted) return;
        if (Array.isArray(res.data)) {
          const match = res.data.find((c) => Number(c.id_client) === Number(id)) || null;
          setCustomer(match);
        }
      } catch {
        /* ignore */
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchCustomers();
    try {
      localStorage.setItem("customerFocusId", String(id));
    } catch {}
    // Canonicalize URL to /c/<token> for this customer id
    try {
      if (typeof window !== "undefined" && id) {
        const path = buildEncryptedClientPath(Number(id));
        if (window.location.pathname !== path) {
          window.history.replaceState(null, "", path);
          try {
            window.dispatchEvent(new PopStateEvent("popstate"));
          } catch {}
        }
      }
    } catch {}
    return () => {
      mounted = false;
    };
  }, [apiIp, id]);

  React.useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    if (!id) return;
    // Fetch invoices for this customer
    axios
      .get(`/invoices/allDetailsPC`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          client: id,
          _ts: Date.now(),
        },
      })
      .then((res) => {
        const rows = Array.isArray(res.data) ? res.data : [];
        setInvoices(rows);
      })
      .catch(() => setInvoices([]));
    // Fetch payments (revenue) for this customer
    axios
      .get(`/Revenue/allClient`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          id_client: id,
          _ts: Date.now(),
        },
      })
      .then((res) => setPayments(Array.isArray(res.data) ? res.data : []))
      .catch(() => setPayments([]));
    // Fetch purchases (flattened items across invoices) for this customer
    axios
      .get(`/invoices/customerPurchases`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { client: id, _ts: Date.now() },
      })
      .then((res) => setPurchases(Array.isArray(res.data) ? res.data : []))
      .catch(() => setPurchases([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => {
    // Compute analytics from invoices and payments
    const toDate = (v: any) => {
      const d = v ? new Date(v) : null;
      return isNaN(d as any) ? null : (d as Date);
    };
    let firstPurchaseDate = "";
    const invoiceDates = invoices
      .filter((r: any) => r.date_fact)
      .map((r: any) => toDate(r.date_fact))
      .filter(Boolean) as Date[];
    if (invoiceDates.length > 0) {
      const min = new Date(Math.min(...invoiceDates.map((d) => d.getTime())));
      firstPurchaseDate = min.toISOString().slice(0, 10);
    }

    const byType = (row: any) => String(row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || "").toLowerCase();
    let sumLYD = 0,
      sumUSD = 0,
      sumEUR = 0,
      goldGrams = 0,
      diamondCarats = 0,
      watchUSD = 0,
      watchEUR = 0;

    invoices.forEach((row: any) => {
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
          const keys = ["carat", "Carat", "crt", "CRT", "cts", "CTS", "carats", "Carats"]; 
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

    let paidLYD = 0,
      paidUSD = 0,
      paidEUR = 0;
    payments.forEach((p: any) => {
      const cur = (p.currency || "").toString().toUpperCase();
      const amt = Number(p.amount ?? p.amount_lyd ?? p.amount_usd ?? p.amount_eur) || 0;
      if (cur === "LYD") paidLYD += amt;
      else if (cur === "USD") paidUSD += amt;
      else if (cur === "EUR") paidEUR += amt;
    });

    setAnalytics({
      firstPurchaseDate,
      sumLYD,
      sumUSD,
      sumEUR,
      paidLYD,
      paidUSD,
      paidEUR,
      goldGrams,
      diamondCarats,
      watchUSD,
      watchEUR,
    });
  }, [invoices, payments]);

  // Derive purchases from invoices as a fallback if API returns empty
  const derivedPurchases = React.useMemo(() => {
    const items: any[] = [];
    invoices.forEach((inv: any) => {
      const achats = Array.isArray(inv.ACHATs) ? inv.ACHATs : [];
      achats.forEach((a: any) => {
        items.push({
          invoice: {
            num_fact: inv.num_fact,
            date_fact: inv.date_fact,
            ps: inv.ps,
          },
          achat: a,
          supplier: a?.Fournisseur || null,
        });
      });
    });
    return items;
  }, [invoices]);

  React.useEffect(() => {
    // If purchases API returned nothing but invoices have ACHATs, populate from derived
    if ((purchases?.length || 0) === 0 && (derivedPurchases?.length || 0) > 0) {
      setPurchases(derivedPurchases);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedPurchases]);

  // Charts data: purchases over time (last 12 months) and product type distribution
  const monthlyStats = React.useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach((r: any) => {
      const d = r?.date_fact || r?.date;
      if (!d) return;
      const dt = new Date(d);
      if (isNaN(dt as any)) return;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    const now = new Date();
    const series: { key: string; label: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      const label = dt.toLocaleString(undefined, { month: "short" });
      series.push({ key, label, count: map.get(key) || 0 });
    }
    return series;
  }, [invoices]);

  const maxMonthlyCount = React.useMemo(() => {
    const vals = monthlyStats.map((m) => m.count);
    return Math.max(1, ...(vals.length ? vals : [0]));
  }, [monthlyStats]);

  const typeDistribution = React.useMemo(() => {
    const counts: Record<string, number> = { gold: 0, diamond: 0, watch: 0, other: 0 };
    invoices.forEach((row: any) => {
      const t = String(row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || "").toLowerCase();
      if (t.includes("gold")) counts.gold++;
      else if (t.includes("diamond")) counts.diamond++;
      else if (t.includes("watch")) counts.watch++;
      else counts.other++;
    });
    return counts;
  }, [invoices]);

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

  return (
    <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Professional header with customer info */}
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
          Customer Profile
        </Typography>
        {loading ? (
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
              <Typography variant="caption" sx={{ opacity: 0.9, textTransform: "uppercase", letterSpacing: 1 }}>
                Customer Name
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {customer?.client_name || "—"}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.9, textTransform: "uppercase", letterSpacing: 1 }}>
                Phone
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {customer?.tel_client || "—"}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.9, textTransform: "uppercase", letterSpacing: 1 }}>
                Customer ID
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {id}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.9, textTransform: "uppercase", letterSpacing: 1 }}>
                First Purchase
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {analytics.firstPurchaseDate || "—"}
              </Typography>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Lifetime analytics grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 2,
        }}
      >
        <Paper elevation={1} sx={{ p: 2, borderLeft: "4px solid #1976d2" }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            Lifetime LYD
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#1976d2" }}>
            {analytics.sumLYD.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </Typography>
        </Paper>
        <Paper elevation={1} sx={{ p: 2, borderLeft: "4px solid #388e3c" }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            Lifetime USD
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#388e3c" }}>
            {analytics.sumUSD.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </Typography>
        </Paper>
        <Paper elevation={1} sx={{ p: 2, borderLeft: "4px solid #f57c00" }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            Lifetime EUR
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#f57c00" }}>
            {analytics.sumEUR.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </Typography>
        </Paper>
        <Paper elevation={1} sx={{ p: 2, borderLeft: "4px solid #d32f2f" }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            Unpaid LYD
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: (analytics.sumLYD - analytics.paidLYD) > 0 ? "#d32f2f" : "#616161" }}>
            {(analytics.sumLYD - analytics.paidLYD).toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </Typography>
        </Paper>
        <Paper elevation={1} sx={{ p: 2, borderLeft: "4px solid #d32f2f" }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            Unpaid USD
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: (analytics.sumUSD - analytics.paidUSD) > 0 ? "#d32f2f" : "#616161" }}>
            {(analytics.sumUSD - analytics.paidUSD).toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </Typography>
        </Paper>
        <Paper elevation={1} sx={{ p: 2, borderLeft: "4px solid #d32f2f" }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            Unpaid EUR
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: (analytics.sumEUR - analytics.paidEUR) > 0 ? "#d32f2f" : "#616161" }}>
            {(analytics.sumEUR - analytics.paidEUR).toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </Typography>
        </Paper>
        <Paper elevation={1} sx={{ p: 2, borderLeft: "4px solid #fbc02d" }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            Gold (grams)
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#fbc02d" }}>
            {analytics.goldGrams.toFixed(2)}
          </Typography>
        </Paper>
        <Paper elevation={1} sx={{ p: 2, borderLeft: "4px solid #00acc1" }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            Diamond (carats)
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#00acc1" }}>
            {analytics.diamondCarats.toFixed(2)}
          </Typography>
        </Paper>
        <Paper elevation={1} sx={{ p: 2, borderLeft: "4px solid #7b1fa2" }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            Watches USD
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#7b1fa2" }}>
            {analytics.watchUSD.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </Typography>
        </Paper>
        <Paper elevation={1} sx={{ p: 2, borderLeft: "4px solid #7b1fa2" }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            Watches EUR
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#7b1fa2" }}>
            {analytics.watchEUR.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </Typography>
        </Paper>
      </Box>

      {/* Charts */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 2,
        }}
      >
        <Paper elevation={1} sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            Purchases Over Time (last 12 months)
          </Typography>
          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <svg viewBox="0 0 600 220" width="100%" height="220">
              <rect x="0" y="0" width="600" height="220" fill="#fff" />
              <line x1="40" y1="180" x2="590" y2="180" stroke="#e0e0e0" />
              {monthlyStats.map((m, idx) => {
                const slots = monthlyStats.length || 1;
                const slotW = (550 - 0) / slots;
                const x = 40 + idx * slotW + 6;
                const barW = Math.max(6, slotW - 12);
                const h = Math.round((m.count / maxMonthlyCount) * 150);
                const y = 180 - h;
                return (
                  <g key={idx}>
                    <rect x={x} y={y} width={barW} height={h} fill="#1976d2" rx="3" />
                    <text x={x + barW / 2} y={195} fontSize="10" textAnchor="middle" fill="#666">{m.label}</text>
                    {h > 0 ? (
                      <text x={x + barW / 2} y={y - 4} fontSize="10" textAnchor="middle" fill="#1976d2">{m.count}</text>
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
          <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
            <Box sx={{ width: 180, height: 180, borderRadius: "50%", background: typePie.gradient, boxShadow: 1 }} />
            <Box sx={{ display: "grid", gridTemplateColumns: "auto auto", rowGap: 1, columnGap: 2 }}>
              {typePie.segs.map((s) => (
                <Box key={s.key} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: 0.5, background: s.color }} />
                  <Typography variant="body2" sx={{ minWidth: 90, color: "text.secondary" }}>
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

      {/* Purchases table */}
      <Paper elevation={1} sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          All Purchases (items)
        </Typography>
        {purchases.length === 0 ? (
          <Box sx={{ p: 2, color: "text.secondary" }}>No purchases</Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Invoice No</TableCell>
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
                return (
                  <TableRow key={idx}>
                    <TableCell>{inv.date_fact || ""}</TableCell>
                    <TableCell>{inv.num_fact || ""}</TableCell>
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

      {/* Full customer statement with all invoices, ACHAT details, and purchases */}
      <CustomersReports focusCustomerId={id} />
    </Box>
  );
}
