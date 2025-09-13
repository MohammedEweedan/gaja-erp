// src/Profile/Dashboard/AnalyticsOverview.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  LinearProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

// Icons
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import TimelineIcon from '@mui/icons-material/Timeline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import InsightsIcon from '@mui/icons-material/Insights';
import EqualizerIcon from '@mui/icons-material/Equalizer';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SavingsIcon from '@mui/icons-material/Savings';
import PieChartIcon from '@mui/icons-material/PieChart';
import StorefrontIcon from '@mui/icons-material/Storefront';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import BugReportIcon from '@mui/icons-material/BugReport';

// Recharts
import {
  ResponsiveContainer,
  LineChart as ReLineChart,
  Line,
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// ---- Roles (just like Home.tsx) ----
import { hasRole } from '../../Setup/getUserInfo';
const showOpurchasde = hasRole('Purchase');
const showReceiveProducts = hasRole('Receive Products');
const showInvoices = hasRole('General Invoices');
const showInventory = hasRole('inventory');
const showcashbook = hasRole('Cash Book');
const showFin = hasRole('Finance');
const showSales = hasRole('Sales Settings');

// Toggle to bypass role gates (useful for preview)
const forceAllVisible = false;

// ----------------- Helpers -----------------
function formatNumber(n: number, fractionDigits = 2) {
  if (!isFinite(n)) return '0';
  return n.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });
}
function getISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}
const toNumber = (v: any) => {
  const n = Number(v ?? 0);
  return isFinite(n) ? n : 0;
};

// safe getters for inventory
function getQty(item: any): number {
  return toNumber(item?.quantity ?? item?.qte ?? item?.stock ?? item?.qty);
}
function getCategory(item: any): string {
  const raw =
    item?.category ||
    item?.type ||
    item?.famille ||
    item?.family ||
    item?.group ||
    '';
  const v = String(raw).toLowerCase();
  if (v.includes('gold')) return 'gold';
  if (v.includes('diamond')) return 'diamond';
  if (v.includes('watch')) return 'watches';
  return raw || 'other';
}
function getStoreId(inv: any): number | string | null {
  return inv?.ps ?? inv?.Id_point ?? inv?.pos_id ?? null;
}
function getStoreNameFromList(psId: any, list: any[]): string {
  const f = list?.find((p) => p?.Id_point === psId);
  return f?.name_point || String(psId ?? '');
}

// ----------------- Component -----------------
export default function AnalyticsOverview() {
  const theme = useTheme();
  const { t } = useTranslation();

  const apiIp = process.env.REACT_APP_API_IP;
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Aggregated values (by YYYY-MM-DD)
  const [salesHistory, setSalesHistory] = useState<Record<string, number>>({});
  const [revenueHistory, setRevenueHistory] = useState<Record<string, number>>(
    {},
  );
  const [expensesHistory, setExpensesHistory] = useState<
    Record<string, number>
  >({});
  const [purchasesHistory, setPurchasesHistory] = useState<
    Record<string, number>
  >({});

  // Per-store (last 30 days)
  const [storeSalesMap, setStoreSalesMap] = useState<
    Record<string | number, number>
  >({});

  // Inventory
  const [inventory, setInventory] = useState<any[]>([]);
  const [inventoryCount, setInventoryCount] = useState<number>(0);

  // Balances (cash/bank/other)
  const [balances, setBalances] = useState<{ cash?: number; bank?: number; other?: number }>({});

  // Real-time POS
  const [posTodayTotal, setPosTodayTotal] = useState<number>(0);
  const [posTodayCount, setPosTodayCount] = useState<number>(0);
  const pollRef = useRef<number | null>(null);

  // POS selector
  const [posOptions, setPosOptions] = useState<any[]>([]);
  const [selectedPs, setSelectedPs] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('selectedPs') : null;
    return saved ? Number(saved) : -1; // -1 means overall
  });

  // Accent color
  const accent =
    (theme.palette as any)?.gaja?.[100] ??
    (theme.palette.mode === 'dark' ? '#b7a27d' : '#b7a27d');

  const canSeeSales = forceAllVisible || showInvoices || showSales;
  const canSeeFin = forceAllVisible || showFin || showcashbook;
  const canSeeInventory = forceAllVisible || showInventory || showReceiveProducts || showOpurchasde;

  // ----------------- Initial data load -----------------
  useEffect(() => {
    let isMounted = true;

    const headers = { Authorization: `Bearer ${token}` };

    const fetchPOS = async () => {
      try {
        const res = await axios.get(`${apiIp}/ps/all`, { headers });
        if (Array.isArray(res.data) && isMounted) setPosOptions(res.data);
      } catch {
        /* ignore */
      }
    };

    const fetchBalances = async () => {
      try {
        // Adjust the endpoint/shape to your backend.
        const res = await axios.get(`${apiIp}/Finance/balances`, { headers });
        const cash = toNumber(res?.data?.cash ?? res?.data?.Cash);
        const bank = toNumber(res?.data?.bank ?? res?.data?.Bank);
        const other = toNumber(res?.data?.other ?? res?.data?.Wallet ?? 0);
        if (isMounted) setBalances({ cash, bank, other });
      } catch {
        if (isMounted) setBalances({});
      }
    };

    const fetchEverything = async () => {
      try {
        setLoading(true);
        setError(null);

        // Last 30 days range
        const today = new Date();
        const from = new Date();
        from.setDate(today.getDate() - 29);
        const qsFrom = getISODate(from);
        const qsTo = getISODate(today);

        const invParams: any = { from: qsFrom, to: qsTo };
        if (selectedPs !== -1) invParams.ps = selectedPs;

        const revParams: any = {};
        if (selectedPs !== -1) revParams.ps = selectedPs;

        const expParams: any = {};
        if (selectedPs !== -1) expParams.ps = selectedPs;

        const requests: Promise<any>[] = [
          axios.get(`${apiIp}/invoices/allDetailsP`, { params: invParams, headers }), // sales
          axios.get(`${apiIp}/Revenue/all`, { params: revParams, headers }), // revenue
          axios.get(`${apiIp}/Expense/all`, { params: expParams, headers }), // expenses
          axios.get(`${apiIp}/purchases/all`, { params: {}, headers }), // purchases
          axios.get(`${apiIp}/Inventory/list`, { headers }), // inventory
        ];

        const [salesRes, revenueRes, expensesRes, purchasesRes, inventoryRes] =
          await Promise.all(requests);

        // --- Aggregate by date ---
        const salesAgg: Record<string, number> = {};
        const storeAgg: Record<string | number, number> = {};
        if (Array.isArray(salesRes.data)) {
          for (const inv of salesRes.data) {
            const d = inv?.date_fact ? getISODate(new Date(inv.date_fact)) : null;
            const total = toNumber(inv?.total_remise_final_lyd ?? inv?.amount_lyd ?? inv?.total ?? 0);
            if (d) salesAgg[d] = (salesAgg[d] || 0) + total;

            const sid = getStoreId(inv);
            if (sid !== null) storeAgg[sid] = (storeAgg[sid] || 0) + total;
          }
        }

        const revAgg: Record<string, number> = {};
        if (Array.isArray(revenueRes.data)) {
          for (const r of revenueRes.data) {
            const d = r?.date ? getISODate(new Date(r.date)) : null;
            const total = toNumber(r?.montant ?? r?.montant_currency ?? r?.amount);
            if (d) revAgg[d] = (revAgg[d] || 0) + total;
          }
        }

        const expAgg: Record<string, number> = {};
        if (Array.isArray(expensesRes.data)) {
          for (const e of expensesRes.data) {
            const d = e?.date_trandsaction
              ? getISODate(new Date(e.date_trandsaction))
              : e?.date
              ? getISODate(new Date(e.date))
              : null;
            const total = toNumber(e?.montant_net ?? e?.montant ?? e?.amount);
            if (d) expAgg[d] = (expAgg[d] || 0) + total;
          }
        }

        const purAgg: Record<string, number> = {};
        if (Array.isArray(purchasesRes.data)) {
          for (const p of purchasesRes.data) {
            const d = p?.d_time
              ? getISODate(new Date(p.d_time))
              : p?.createdAt
              ? getISODate(new Date(p.createdAt))
              : null;
            const total = toNumber(p?.prix_achat ?? p?.total_price ?? p?.amount);
            if (d) purAgg[d] = (purAgg[d] || 0) + total;
          }
        }

        const invArr = Array.isArray(inventoryRes.data) ? inventoryRes.data : [];
        const invCount = invArr.length;

        if (!isMounted) return;
        setSalesHistory(salesAgg);
        setRevenueHistory(revAgg);
        setExpensesHistory(expAgg);
        setPurchasesHistory(purAgg);
        setInventory(invArr);
        setInventoryCount(invCount);
        setStoreSalesMap(storeAgg);
      } catch (err: any) {
        console.error('Analytics load error', err);
        if (isMounted) {
          setError(err?.response?.data?.message || err?.message || 'Error');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // POS list only matters if sales sections visible
    if (canSeeSales) fetchPOS();
    if (canSeeFin) fetchBalances();
    fetchEverything();

    return () => {
      isMounted = false;
    };
  }, [apiIp, token, selectedPs, canSeeSales, canSeeFin]);

  // ----------------- Real-time POS polling -----------------
  useEffect(() => {
    if (!canSeeSales) return;
    const headers = { Authorization: `Bearer ${token}` };
    const poll = async () => {
      try {
        const today = new Date();
        const qsFrom = getISODate(today);
        const invParams: any = { from: qsFrom, to: qsFrom };
        if (selectedPs !== -1) invParams.ps = selectedPs;
        const res = await axios.get(`${apiIp}/invoices/allDetailsP`, { params: invParams, headers });
        if (Array.isArray(res.data)) {
          let total = 0;
          let count = 0;
          for (const inv of res.data) {
            const amount = toNumber(inv?.total_remise_final_lyd ?? inv?.amount_lyd ?? inv?.total);
            if (amount > 0) {
              total += amount;
              count += 1;
            }
          }
          setPosTodayTotal(total);
          setPosTodayCount(count);
        }
      } catch {
        // ignore polling errors
      }
    };
    poll();
    const id = window.setInterval(poll, 5000);
    pollRef.current = id;
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [apiIp, token, selectedPs, canSeeSales]);

  // ----------------- Chart data -----------------
  const last30Dates = useMemo(() => {
    const arr: string[] = [];
    const d = new Date();
    for (let i = 29; i >= 0; i--) {
      const dt = new Date(d);
      dt.setDate(d.getDate() - i);
      arr.push(getISODate(dt));
    }
    return arr;
  }, []);

  const seriesSales = last30Dates.map((d) => salesHistory[d] || 0);
  const seriesRevenue = last30Dates.map((d) => revenueHistory[d] || 0);
  const seriesExpenses = last30Dates.map((d) => expensesHistory[d] || 0);
  const seriesPurchases = last30Dates.map((d) => purchasesHistory[d] || 0);
  const seriesProfit = last30Dates.map((_, i) => (seriesRevenue[i] || 0) - (seriesExpenses[i] || 0));

  const chartData = last30Dates.map((date, i) => ({
    date,
    sales: seriesSales[i],
    revenue: seriesRevenue[i],
    expenses: seriesExpenses[i],
    purchases: seriesPurchases[i],
    profit: seriesProfit[i],
  }));

  // ---- Store performance (top5) ----
  const storeRows = useMemo(() => {
    // convert map to array and decorate with names
    const rows = Object.entries(storeSalesMap).map(([sid, total]) => ({
      storeId: sid,
      storeName: getStoreNameFromList(sid, posOptions),
      sales: total,
    }));
    rows.sort((a, b) => b.sales - a.sales);
    return rows;
  }, [storeSalesMap, posOptions]);

  // ---- Inventory breakdown ----
  const invByCat = useMemo(() => {
    const m: Record<string, { qty: number; items: number }> = {};
    for (const it of inventory) {
      const c = getCategory(it);
      const q = getQty(it);
      if (!m[c]) m[c] = { qty: 0, items: 0 };
      m[c].qty += q;
      m[c].items += 1;
    }
    return m;
  }, [inventory]);

  const stockPieData = Object.entries(invByCat)
    .map(([k, v]) => ({ name: k, value: v.qty || v.items || 0 }))
    .filter((d) => d.value > 0);

  // ---- Low stock table (top 8) ----
  const lowStockRows = useMemo(() => {
    const rows = [...inventory]
      .map((it) => ({
        sku: it?.code || it?.sku || it?.barcode || it?.id || it?._id || '',
        name: it?.label || it?.name || it?.designation || it?.title || '',
        cat: getCategory(it),
        qty: getQty(it),
        min: toNumber(it?.min_stock ?? it?.min ?? 5),
      }))
      .filter((r) => r.qty <= r.min)
      .sort((a, b) => a.qty - b.qty)
      .slice(0, 8);
    return rows;
  }, [inventory]);

  // ---- Totals & KPIs ----
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  const totalSales30 = sum(seriesSales);
  const totalRevenue30 = sum(seriesRevenue);
  const totalExpenses30 = sum(seriesExpenses);
  const totalPurchases30 = sum(seriesPurchases);
  const totalProfit30 = totalRevenue30 - totalExpenses30;
  const profitMargin30 = totalRevenue30 > 0 ? (totalProfit30 / totalRevenue30) * 100 : 0;
  const avgTicket = posTodayCount > 0 ? posTodayTotal / posTodayCount : 0;

  // Last 7 vs previous 7 for quick trend arrows
  const last7 = chartData.slice(-7);
  const prev7 = chartData.slice(-14, -7);
  const delta = (cur: number, prev: number) => {
    if (prev === 0) return cur === 0 ? 0 : 100;
    return ((cur - prev) / prev) * 100;
  };
  const s7 = sum(last7.map((d) => d.sales));
  const s7p = sum(prev7.map((d) => d.sales));
  const s7Delta = delta(s7, s7p);

  const r7 = sum(last7.map((d) => d.revenue));
  const r7p = sum(prev7.map((d) => d.revenue));
  const r7Delta = delta(r7, r7p);

  const e7 = sum(last7.map((d) => d.expenses));
  const e7p = sum(prev7.map((d) => d.expenses));
  const e7Delta = delta(e7, e7p);

  const p7 = sum(last7.map((d) => d.profit));
  const p7p = sum(prev7.map((d) => d.profit));
  const p7Delta = delta(p7, p7p);

  // Tick color based on theme
  const tickFill = theme.palette.text.secondary;
  const gridStroke = theme.palette.divider;

  // Colors for pie slices (inherit theme)
  const pieColors = [
    accent,
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.info.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
  ];

  // KPI builder
const TrendChip = ({ value }: { value: number }) => (
  <Chip
    size="small"
    icon={value >= 0 ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
    label={`${value >= 0 ? '+' : ''}${formatNumber(value, 1)}%`}
    color={value >= 0 ? 'success' : 'error'}
    variant="filled"
    sx={{
      ml: 1,
      bgcolor: 'transparent',
      border: 'none',
      boxShadow: 'none',
      color: value >= 0 ? 'success.main' : 'error.main',
      '& .MuiChip-icon': { color: value >= 0 ? 'success.main' : 'error.main' },
    }}
  />
);


  // Role visibility
  const showKPISales = canSeeSales;
  const showKPIFin = canSeeFin;
  const showKPIInv = canSeeInventory;

  const nothingVisible =
    !showKPISales && !showKPIFin && !showKPIInv && !canSeeSales && !canSeeFin && !canSeeInventory;

  return (
    <Box sx={{ width: '100%', mb: 3 }}>
      {/* Title & POS filter (sales folks) */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 2, flexWrap: 'wrap' }}>
        <Typography
          variant="h5"
          fontWeight={700}
          sx={{ color: accent, display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <TimelineIcon sx={{ color: accent }} /> {t('analytics.title') || 'Analytics Overview'}
        </Typography>

        {canSeeSales && (
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel id="pos-select-label">{t('analytics.posSelect') || 'Point of Sale'}</InputLabel>
            <Select
              labelId="pos-select-label"
              value={selectedPs}
              label={t('analytics.posSelect') || 'Point of Sale'}
              onChange={(e) => {
                const val = Number(e.target.value);
                setSelectedPs(val);
                if (typeof window !== 'undefined') localStorage.setItem('selectedPs', String(val));
              }}
            >
              <MenuItem value={-1}>{t('analytics.posAll') || 'All Stores'}</MenuItem>
              {posOptions.map((ps: any) => (
                <MenuItem key={ps.Id_point} value={ps.Id_point}>
                  {ps.name_point}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {loading && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress />
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {/* KPIs */}
      {!loading && !error && (
        <>
          {/* SALES / TODAY */}
          {showKPISales && (
            <Box
              sx={{
                mt: 1,
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
              }}
            >
              <Card sx={{ border: '1px solid', borderColor: accent }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <ShoppingCartIcon sx={{ color: accent }} />
                    <Typography variant="body2" sx={{ color: accent, fontWeight: 600 }}>
                      {t('analytics.sales30') || 'Sales (30 days)'}
                    </Typography>
                    <TrendChip value={s7Delta} />
                  </Stack>
                  <Typography variant="h5" sx={{ mt: 1, color: accent, fontWeight: 700 }}>
                    {formatNumber(totalSales30)}
                  </Typography>
                </CardContent>
              </Card>

              <Card sx={{ border: '1px solid', borderColor: accent }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <AccessTimeIcon sx={{ color: accent }} />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
                      {t('analytics.posTodayTotal') || 'POS Today'}
                    </Typography>
                  </Stack>
                  <Typography variant="h6" sx={{ mt: 1, color: accent, fontWeight: 700 }}>
                    {formatNumber(posTodayTotal, 3)} {t('analytics.lyd') || 'LYD'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                    {t('analytics.posTodayCount') || 'Transactions'}: {posTodayCount} &nbsp;|&nbsp; {t('analytics.avgTicket') || 'Avg. ticket'}: {formatNumber(avgTicket, 2)}
                  </Typography>
                </CardContent>
              </Card>

              {/* STORE LEADERBOARD QUICK GLANCE */}
              <Card sx={{ border: '1px solid', borderColor: accent }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <LeaderboardIcon sx={{ color: accent }} />
                    <Typography variant="body2" sx={{ color: accent, fontWeight: 600 }}>
                      {t('analytics.topStores') || 'Top Stores'}
                    </Typography>
                  </Stack>
                  <Box sx={{ mt: 1 }}>
                    {storeRows.slice(0, 3).map((r, idx) => (
                      <Stack key={String(r.storeId)} direction="row" justifyContent="space-between" sx={{ py: 0.25 }}>
                        <Typography variant="body2">
                          {idx + 1}. {r.storeName}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {formatNumber(r.sales)}
                        </Typography>
                      </Stack>
                    ))}
                    {!storeRows.length && (
                      <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                        {t('analytics.noData') || 'No data available'}
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>

              {/* PURCHASES LAST 30 */}
              <Card sx={{ border: '1px solid', borderColor: accent }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <ReceiptLongIcon sx={{ color: accent }} />
                    <Typography variant="body2" sx={{ color: accent, fontWeight: 600 }}>
                      {t('analytics.purchases30') || 'Purchases (30 days)'}
                    </Typography>
                  </Stack>
                  <Typography variant="h5" sx={{ mt: 1, color: accent, fontWeight: 700 }}>
                    {formatNumber(totalPurchases30)}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* FINANCE */}
          {showKPIFin && (
            <Box
              sx={{
                mt: 2,
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
              }}
            >
              <Card sx={{ border: '1px solid', borderColor: accent }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <AttachMoneyIcon sx={{ color: accent }} />
                    <Typography variant="body2" sx={{ color: accent, fontWeight: 600 }}>
                      {t('analytics.revenue30') || 'Revenue (30 days)'}
                    </Typography>
                    <TrendChip value={r7Delta} />
                  </Stack>
                  <Typography variant="h5" sx={{ mt: 1, color: accent, fontWeight: 700 }}>
                    {formatNumber(totalRevenue30)}
                  </Typography>
                </CardContent>
              </Card>

              <Card sx={{ border: '1px solid', borderColor: accent }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <TrendingDownIcon sx={{ color: accent }} />
                    <Typography variant="body2" sx={{ color: accent, fontWeight: 600 }}>
                      {t('analytics.expenses30') || 'Expenses (30 days)'}
                    </Typography>
                    <TrendChip value={e7Delta} />
                  </Stack>
                  <Typography variant="h5" sx={{ mt: 1, color: accent, fontWeight: 700 }}>
                    {formatNumber(totalExpenses30)}
                  </Typography>
                </CardContent>
              </Card>

              <Card sx={{ border: '1px solid', borderColor: accent }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <EqualizerIcon sx={{ color: accent }} />
                    <Typography variant="body2" sx={{ color: accent, fontWeight: 600 }}>
                      {t('analytics.profit30') || 'Profit (30 days)'}
                    </Typography>
                    <TrendChip value={p7Delta} />
                  </Stack>
                  <Typography variant="h5" sx={{ mt: 1, color: totalProfit30 >= 0 ? accent : theme.palette.error.main, fontWeight: 700 }}>
                    {formatNumber(totalProfit30)} &nbsp;({formatNumber(profitMargin30, 1)}%)
                  </Typography>
                </CardContent>
              </Card>

              {/* BALANCES */}
              <Card sx={{ border: '1px solid', borderColor: accent }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <AccountBalanceIcon sx={{ color: accent }} />
                    <Typography variant="body2" sx={{ color: accent, fontWeight: 600 }}>
                      {t('analytics.balances') || 'Balances'}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <SavingsIcon fontSize="small" /> {t('analytics.cash') || 'Cash'}: <b>{formatNumber(toNumber(balances.cash))}</b>
                  </Typography>
                  <Typography variant="body2">
                    <AccountBalanceIcon fontSize="small" /> {t('analytics.bank') || 'Bank'}: <b>{formatNumber(toNumber(balances.bank))}</b>
                  </Typography>
                  <Typography variant="body2">
                    {t('analytics.other') || 'Other'}: <b>{formatNumber(toNumber(balances.other))}</b>
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* INVENTORY */}
          {showKPIInv && (
            <Box
              sx={{
                mt: 2,
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
              }}
            >
              {/* Stock composition & counts */}
              <Card sx={{ height: 360, border: '1px solid', borderColor: accent }}>
                <CardContent sx={{ height: 320 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PieChartIcon sx={{ color: accent }} />
                    <Typography variant="subtitle1" sx={{ color: accent, fontWeight: 600 }}>
                      {t('analytics.stockComposition') || 'Stock Composition (by qty/items)'}
                    </Typography>
                  </Stack>
                  <Box sx={{ mt: 1, height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stockPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={1}
                          label
                        >
                          {stockPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                          ))}
                        </Pie>
                        <ReTooltip
                          contentStyle={{
                            background: theme.palette.background.paper,
                            border: `1px solid ${theme.palette.divider}`,
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                    {t('analytics.inventoryItems') || 'Inventory items'}: <b>{formatNumber(inventoryCount, 0)}</b> &nbsp;|&nbsp;
                    Gold: <b>{formatNumber(invByCat?.gold?.qty ?? invByCat?.gold?.items ?? 0, 0)}</b> &nbsp;|&nbsp;
                    Diamonds: <b>{formatNumber(invByCat?.diamond?.qty ?? invByCat?.diamond?.items ?? 0, 0)}</b> &nbsp;|&nbsp;
                    Watches: <b>{formatNumber(invByCat?.watches?.qty ?? invByCat?.watches?.items ?? 0, 0)}</b>
                  </Typography>
                </CardContent>
              </Card>

              {/* Low stock */}
              <Card sx={{ height: 360, border: '1px solid', borderColor: accent }}>
                <CardContent sx={{ height: 320, display: 'flex', flexDirection: 'column' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <BugReportIcon sx={{ color: accent }} />
                    <Typography variant="subtitle1" sx={{ color: accent, fontWeight: 600 }}>
                      {t('analytics.lowStock') || 'Low Stock Alerts'}
                    </Typography>
                  </Stack>
                  <TableContainer component={Paper} sx={{ mt: 1, flex: 1, background: theme.palette.background.paper }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>{t('analytics.sku') || 'SKU'}</TableCell>
                          <TableCell>{t('analytics.item') || 'Item'}</TableCell>
                          <TableCell>{t('analytics.category') || 'Category'}</TableCell>
                          <TableCell align="right">{t('analytics.qty') || 'Qty'}</TableCell>
                          <TableCell align="right">{t('analytics.min') || 'Min'}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {lowStockRows.length ? (
                          lowStockRows.map((r) => (
                            <TableRow key={`${r.sku}-${r.name}`}>
                              <TableCell>{r.sku}</TableCell>
                              <TableCell>{r.name}</TableCell>
                              <TableCell sx={{ textTransform: 'capitalize' }}>{r.cat}</TableCell>
                              <TableCell align="right">{formatNumber(r.qty, 0)}</TableCell>
                              <TableCell align="right">{formatNumber(r.min, 0)}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5}>
                              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                                {t('analytics.noData') || 'No data available'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* CHARTS BLOCKS */}
          <Box
            sx={{
              mt: 2,
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr',
                lg: (canSeeSales && canSeeFin) ? '1fr 1fr' : '1fr',
              },
            }}
          >
            {/* Sales trend */}
            {canSeeSales && (
              <Card sx={{ height: 360, border: '1px solid', borderColor: accent }}>
                <CardContent sx={{ height: 320 }}>
                  <Typography variant="subtitle1" sx={{ color: accent, fontWeight: 600 }}>
                    {t('analytics.salesTrend') || 'Sales Trend (30 days)'}
                  </Typography>
                  <Box sx={{ mt: 1, height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ReLineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                        <XAxis dataKey="date" tick={{ fill: tickFill, fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fill: tickFill, fontSize: 10 }} width={56} />
                        <ReTooltip
                          contentStyle={{
                            background: theme.palette.background.paper,
                            border: `1px solid ${theme.palette.divider}`,
                          }}
                          labelStyle={{ color: tickFill }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="sales" name={t('analytics.sales') || 'Sales'} stroke={accent} strokeWidth={2} dot={false} />
                      </ReLineChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Profit trend */}
            {canSeeFin && (
              <Card sx={{ height: 360, border: '1px solid', borderColor: accent }}>
                <CardContent sx={{ height: 320 }}>
                  <Typography variant="subtitle1" sx={{ color: accent, fontWeight: 600 }}>
                    {t('analytics.profitTrend') || 'Profit Trend (30 days)'}
                  </Typography>
                  <Box sx={{ mt: 1, height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ReLineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                        <XAxis dataKey="date" tick={{ fill: tickFill, fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fill: tickFill, fontSize: 10 }} width={56} />
                        <ReTooltip
                          contentStyle={{
                            background: theme.palette.background.paper,
                            border: `1px solid ${theme.palette.divider}`,
                          }}
                          labelStyle={{ color: tickFill }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="profit" name={t('analytics.profit') || 'Profit'} stroke={theme.palette.success.main} strokeWidth={2} dot={false} />
                      </ReLineChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            )}
          </Box>

          {/* Revenue vs Expenses + Store performance */}
          <Box
            sx={{
              mt: 2,
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr',
                lg: (canSeeFin && canSeeSales) ? '1fr 1fr' : '1fr',
              },
            }}
          >
            {/* Revenue vs Expenses */}
            {canSeeFin && (
              <Card sx={{ height: 360, border: '1px solid', borderColor: accent }}>
                <CardContent sx={{ height: 320 }}>
                  <Typography variant="subtitle1" sx={{ color: accent, fontWeight: 600 }}>
                    {t('analytics.revVsExp') || 'Revenue vs Expenses'}
                  </Typography>
                  <Box sx={{ mt: 1, height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ReBarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                        <XAxis dataKey="date" tick={{ fill: tickFill, fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fill: tickFill, fontSize: 10 }} width={56} />
                        <ReTooltip
                          contentStyle={{
                            background: theme.palette.background.paper,
                            border: `1px solid ${theme.palette.divider}`,
                          }}
                          labelStyle={{ color: tickFill }}
                        />
                        <Legend />
                        <Bar dataKey="revenue" name={t('analytics.revenue') || 'Revenue'} fill={accent} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expenses" name={t('analytics.expenses') || 'Expenses'} fill={theme.palette.mode === 'dark' ? '#90caf9' : '#1976d2'} radius={[4, 4, 0, 0]} />
                      </ReBarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Store performance (bar) */}
            {canSeeSales && (
              <Card sx={{ height: 360, border: '1px solid', borderColor: accent }}>
                <CardContent sx={{ height: 320 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <StorefrontIcon sx={{ color: accent }} />
                    <Typography variant="subtitle1" sx={{ color: accent, fontWeight: 600 }}>
                      {t('analytics.storePerformance') || 'Store Performance (30 days)'}
                    </Typography>
                  </Stack>
                  <Box sx={{ mt: 1, height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ReBarChart
                        data={storeRows.map((r) => ({ name: r.storeName, sales: r.sales }))}
                        margin={{ top: 8, right: 8, left: 0, bottom: 40 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                        <XAxis dataKey="name" tick={{ fill: tickFill, fontSize: 10 }} angle={-15} textAnchor="end" interval={0} />
                        <YAxis tick={{ fill: tickFill, fontSize: 10 }} width={56} />
                        <ReTooltip
                          contentStyle={{
                            background: theme.palette.background.paper,
                            border: `1px solid ${theme.palette.divider}`,
                          }}
                          labelStyle={{ color: tickFill }}
                        />
                        <Legend />
                        <Bar dataKey="sales" name={t('analytics.sales') || 'Sales'} fill={accent} radius={[4, 4, 0, 0]} />
                      </ReBarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            )}
          </Box>

          {/* Store leaderboard full & insights */}
          <Box
            sx={{
              mt: 2,
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
            }}
          >
            {canSeeSales && (
              <Card sx={{ border: '1px solid', borderColor: accent }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ color: accent, fontWeight: 600 }}>
                    {t('analytics.storeLeaderboard') || 'Store Leaderboard'}
                  </Typography>
                  <TableContainer component={Paper} sx={{ mt: 1, background: theme.palette.background.paper }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>{t('analytics.store') || 'Store'}</TableCell>
                          <TableCell align="right">{t('analytics.sales') || 'Sales'}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {storeRows.length ? (
                          storeRows.map((r) => (
                            <TableRow key={String(r.storeId)}>
                              <TableCell>{r.storeName}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>{formatNumber(r.sales)}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={2}>
                              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                                {t('analytics.noData') || 'No data available'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            )}

            {/* AUTO INSIGHTS */}
            <Card sx={{ border: '1px solid', borderColor: accent }}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <InsightsIcon sx={{ color: accent }} />
                  <Typography variant="subtitle1" sx={{ color: accent, fontWeight: 600 }}>
                    {t('analytics.insights') || 'Insights'}
                  </Typography>
                </Stack>
                <Box sx={{ mt: 1 }}>
                  {/* Insight bullets — tweak as you like */}
                  {canSeeFin && (
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      • {t('analytics.ins.profit') || 'Profit'}: {formatNumber(totalProfit30)} ({formatNumber(profitMargin30, 1)}%) over last 30 days.
                    </Typography>
                  )}
                  {canSeeSales && (
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      • {t('analytics.ins.salesMomentum') || 'Sales momentum'}: {s7Delta >= 0 ? 'rising' : 'declining'} {formatNumber(Math.abs(s7Delta), 1)}% vs previous week.
                    </Typography>
                  )}
                  {canSeeSales && storeRows[0] && (
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      • {t('analytics.ins.topStore') || 'Top store'}: <b>{storeRows[0].storeName}</b> with {formatNumber(storeRows[0].sales)} in sales.
                    </Typography>
                  )}
                  {canSeeInventory && (
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      • {t('analytics.ins.stockFocus') || 'Stock focus'}: Gold {formatNumber(invByCat?.gold?.qty ?? invByCat?.gold?.items ?? 0, 0)} • Diamonds {formatNumber(invByCat?.diamond?.qty ?? invByCat?.diamond?.items ?? 0, 0)} • Watches {formatNumber(invByCat?.watches?.qty ?? invByCat?.watches?.items ?? 0, 0)}.
                    </Typography>
                  )}
                  {canSeeInventory && lowStockRows.length > 0 && (
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      • {t('analytics.ins.restock') || 'Restock'}: {lowStockRows.length} {t('analytics.ins.itemsBelowMin') || 'items below min'} — prioritize{' '}
                      <b>{lowStockRows[0].name || lowStockRows[0].sku}</b>.
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Box>
        </>
      )}

      {/* No visible content */}
      {!loading && !error && nothingVisible && (
        <Card sx={{ mt: 2, border: '1px solid', borderColor: accent }}>
          <CardContent>
            <Typography variant="h6" sx={{ color: accent, fontWeight: 700, mb: 1 }}>
              {t('analytics.noAccessTitle') || 'No dashboard sections available'}
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
              {t('analytics.noAccessBody') || 'Your account does not have access to any analytics sections. Please contact an administrator if you believe this is an error.'}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
