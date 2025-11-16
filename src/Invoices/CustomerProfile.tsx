import React from "react";
import { Box, Chip, CircularProgress, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody } from "@mui/material";
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
        },
      })
      .then((res) => setPayments(Array.isArray(res.data) ? res.data : []))
      .catch(() => setPayments([]));
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

  return (
    <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        Customer Profile
      </Typography>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
        <Chip label={`ID: ${id}`} />
        {loading ? (
          <CircularProgress size={18} />
        ) : (
          <>
            <Chip label={`Name: ${customer?.client_name || "—"}`} color="primary" />
            <Chip label={`Phone: ${customer?.tel_client || "—"}`} />
          </>
        )}
      </Box>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Chip label={`First purchase: ${analytics.firstPurchaseDate || "—"}`} />
        <Chip label={`Lifetime LYD: ${analytics.sumLYD.toLocaleString("en-US", { maximumFractionDigits: 2 })}`} />
        <Chip label={`Lifetime USD: ${analytics.sumUSD.toLocaleString("en-US", { maximumFractionDigits: 2 })}`} />
        <Chip label={`Lifetime EUR: ${analytics.sumEUR.toLocaleString("en-US", { maximumFractionDigits: 2 })}`} />
        <Chip label={`Gold grams: ${analytics.goldGrams.toFixed(2)}`} />
        <Chip label={`Diamond carats: ${analytics.diamondCarats.toFixed(2)}`} />
        <Chip label={`Watches USD: ${analytics.watchUSD.toLocaleString("en-US", { maximumFractionDigits: 2 })}`} />
        <Chip label={`Watches EUR: ${analytics.watchEUR.toLocaleString("en-US", { maximumFractionDigits: 2 })}`} />
        <Chip label={`Unpaid LYD: ${(analytics.sumLYD - analytics.paidLYD).toLocaleString("en-US", { maximumFractionDigits: 2 })}`} color={(analytics.sumLYD - analytics.paidLYD) > 0 ? "warning" : undefined} />
        <Chip label={`Unpaid USD: ${(analytics.sumUSD - analytics.paidUSD).toLocaleString("en-US", { maximumFractionDigits: 2 })}`} color={(analytics.sumUSD - analytics.paidUSD) > 0 ? "warning" : undefined} />
        <Chip label={`Unpaid EUR: ${(analytics.sumEUR - analytics.paidEUR).toLocaleString("en-US", { maximumFractionDigits: 2 })}`} color={(analytics.sumEUR - analytics.paidEUR) > 0 ? "warning" : undefined} />
      </Box>
      <Box>
        <CustomersReports focusCustomerId={id} />
      </Box>
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          All Transactions (lifetime)
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Invoice No</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">LYD</TableCell>
              <TableCell align="right">USD</TableCell>
              <TableCell align="right">EUR</TableCell>
              <TableCell>PS</TableCell>
              <TableCell>Chira</TableCell>
              <TableCell>Closed</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[...invoices]
              .sort((a, b) =>
                new Date(b.date_fact || b.date || 0).getTime() -
                new Date(a.date_fact || a.date || 0).getTime()
              )
              .map((row) => {
                const tRaw = row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || "";
                const t = String(tRaw).toLowerCase().includes("gold")
                  ? "Gold"
                  : String(tRaw).toLowerCase().includes("diamond")
                  ? "Diamond"
                  : String(tRaw).toLowerCase().includes("watch")
                  ? "Watch"
                  : tRaw;
                return (
                  <TableRow key={row.num_fact || row.id_fact || row.picint}>
                    <TableCell>{row.date_fact || row.date || ""}</TableCell>
                    <TableCell>{row.num_fact || ""}</TableCell>
                    <TableCell>{t}</TableCell>
                    <TableCell align="right">{Number(row.amount_lyd || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}</TableCell>
                    <TableCell align="right">{Number(row.amount_currency || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}</TableCell>
                    <TableCell align="right">{Number(row.amount_EUR || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}</TableCell>
                    <TableCell>{row.ps || ""}</TableCell>
                    <TableCell>{row.is_chira ? "Yes" : "No"}</TableCell>
                    <TableCell>{row.IS_OK ? "Yes" : "No"}</TableCell>
                  </TableRow>
                );
              })}
            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={9}>
                  <Box sx={{ p: 2, textAlign: "center", color: "text.secondary" }}>No invoices</Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Recent Payments
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell>Currency</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.slice(0, 10).map((p: any, idx: number) => (
              <TableRow key={idx}>
                <TableCell>{p.date ?? p.date_fact ?? p.created_at ?? ""}</TableCell>
                <TableCell>{p.ref ?? p.reference ?? p.id ?? ""}</TableCell>
                <TableCell>{p.currency ?? ""}</TableCell>
                <TableCell align="right">{Number(p.amount ?? p.amount_lyd ?? p.amount_usd ?? p.amount_eur ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}</TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Box sx={{ p: 2, textAlign: "center", color: "text.secondary" }}>No payments</Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
