import { useEffect, useState, useMemo } from "react";
import axios from "../../../api";
import {
  Box,
  Typography,
  Button,
  TextField,
  Autocomplete,
  Divider,
} from "@mui/material";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from "material-react-table";

type Supplier = {
  id_client: number;
  client_name: string;
  TYPE_SUPPLIER?: string;
};

type Vendor = {
  ExtraClient_ID: number;
  Client_Name: string;
};

type RowItem = {
  id?: string;
  type?: "payment" | "purchase" | "Opening Balance";
  date?: string;
  reference?: string;
  vendor?: string | Vendor;
  brand?: string | number;
  debit?: number;
  credit?: number;
  currency?: string;
  ExchangeRate?: number;
  ExchangeRateToLYD?: number;
  netAmountUSD?: number;
  netAmountLYD?: number;
  Paidby?: number;
  discount_by_vendor?: number;
};

const apiUrlPayments = "/Suppliersettlement";
const apiUrlPurchases = "/DOpurchases";
const apiUrlVendors = "/vendors";
const apiUrlBrands = "/suppliers";

const DVendorAccountStatement = () => {
  const [from, setFrom] = useState(() => {
    const year = new Date().getFullYear();
    return `${year}-01-01`;
  });
  const [to, setTo] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [brand, setBrand] = useState<Supplier | null>(null);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [brands, setBrands] = useState<Supplier[]>([]);
  const [rows, setRows] = useState<RowItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    axios
      .get(`${apiUrlVendors}/all`, { headers })
      .then((res) => setVendors(res.data));
    axios.get(`${apiUrlBrands}/all`, { headers }).then((res) => {
      const filtered = res.data.filter((s: Supplier) =>
        s.TYPE_SUPPLIER?.toLowerCase().includes("gold")
      );
      setBrands(filtered);
    });
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    try {
      const paymentsRes = await axios.get(`${apiUrlPayments}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const purchasesRes = await axios.get(`${apiUrlPurchases}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const payments: RowItem[] = paymentsRes.data.map((p: any) => ({
        id: "pay-" + p.id_settlement,
        type: "payment",
        date: p.date_settlement,
        reference: p.Reference_number,
        vendor:
          vendors.find((v) => v.ExtraClient_ID === p.Brand)?.Client_Name ||
          p.Brand,
        brand:
          brands.find((b) => b.id_client === p.client)?.client_name || p.client,
        debit: Number(-1 * p.Debit_Money) || 0,
        credit: 0,
        currency: p.currency,
        ExchangeRate: p.ExchangeRate,
        ExchangeRateToLYD: p.ExchangeRateToLYD,
        netAmountUSD:
          -1 *
          ((Number(p.Debit_Money) - Number(p.Credit_Money)) *
            (Number(p.ExchangeRate) || 1)),
        netAmountLYD:
          -1 *
          ((Number(p.Debit_Money) - Number(p.Credit_Money)) *
            (Number(p.ExchangeRate) || 1) *
            (Number(p.ExchangeRateToLYD) || 1)),
        Paidby: p.Paidby,
        discount_by_vendor: p.discount_by_vendor || 0,
      }));

      const purchases: RowItem[] = purchasesRes.data.map((p: any) => {
        // Always use price_per_carat * carat as the USD amount
        const ppc = Number(p.price_per_carat) || 0;
        const carat = Number(p.carat) || 0;
        const amountUSD = ppc * carat;
        const currency = "USD";
        const rateToLYD = Number(p.Rate) || 1;
        return {
          id: "pur-" + p.id_achat,
          type: "purchase",
          date: p.Date_Achat,
          reference: p.reference_number || "",
          vendor:
            vendors.find((v) => v.ExtraClient_ID === p.vendorsID)
              ?.Client_Name || p.vendorsID,
          brand:
            brands.find((b) => b.id_client === p.Brand)?.client_name || p.Brand,
          debit: amountUSD,
          credit: 0,
          currency,
          ExchangeRate: 1,
          ExchangeRateToLYD: rateToLYD,
          netAmountUSD: Math.abs(amountUSD * 1),
          netAmountLYD: Math.abs(amountUSD * 1 * rateToLYD),
          discount_by_vendor: p.discount_by_vendor || 0,
          comment: p.Comment_Achat || "",
        };
      });

      let merged = [...payments, ...purchases];
      if (!from || !to || !vendor) {
        setRows([]);
        setLoading(false);
        return;
      }
      let filtered = merged.filter(
        (r) =>
          (r as any).vendor === vendor.Client_Name ||
          (r as any).Paidby === vendor.ExtraClient_ID
      );
      if (brand) {
        filtered = filtered.filter(
          (r) => (r as any).brand === brand.client_name
        );
      }
      // Compute opening balances using the same logic as row balance processing
      // to ensure consistent signs and discount handling for purchases
      const openingRows = filtered.filter((r) => (r as any).date < from);
      const computeNet = (r: RowItem) => {
        const debit = Number(r.debit) || 0;
        const credit = Number(r.credit) || 0;
        const discount =
          r.discount_by_vendor !== undefined ? Number(r.discount_by_vendor) : 0;
        const adjDebit = r.type === "purchase" ? debit - discount : debit;
        const ex = Number(r.ExchangeRate) || 1;
        const exLyd = Number(r.ExchangeRateToLYD) || 1;
        const netUSD = (adjDebit - credit) * ex;
        const netLYD = (adjDebit - credit) * ex * exLyd;
        return { netUSD, netLYD };
      };
      const openingUSD = openingRows.reduce(
        (sum, r) => sum + computeNet(r).netUSD,
        0
      );
      const openingLYD = openingRows.reduce(
        (sum, r) => sum + computeNet(r).netLYD,
        0
      );
      const mainRows = filtered.filter(
        (r) => (r as any).date >= from && (r as any).date <= to
      );
      mainRows.sort((a, b) => ((a as any).date > (b as any).date ? 1 : -1));
      const openingRow: RowItem = {
        id: "opening-balance",
        type: "Opening Balance",
        date: from,
        reference: "",
        vendor: undefined,
        brand: undefined,
        debit: 0,
        credit: 0,
        currency: "",
        ExchangeRate: 1,
        ExchangeRateToLYD: 1,
        netAmountUSD: 0,
        netAmountLYD: 0,
      };
      setRows([openingRow, ...mainRows]);
      setOpeningBalances({ USD: openingUSD, LYD: openingLYD });
    } finally {
      setLoading(false);
    }
  };

  const [openingBalances, setOpeningBalances] = useState<{
    USD: number;
    LYD: number;
  }>({ USD: 0, LYD: 0 });

  const rowsWithBalance = useMemo(() => {
    let balanceAmount = 0;
    let balanceUSD = openingBalances.USD;
    let balanceLYD = openingBalances.LYD;
    return rows.map((row) => {
      if (row.id === "opening-balance") {
        return { ...row, balanceUSD, balanceLYD, balanceAmount } as any;
      }
      const debit = Number(row.debit) || 0;
      const credit = Number(row.credit) || 0;
      const discount =
        row.discount_by_vendor !== undefined
          ? Number(row.discount_by_vendor)
          : 0;
      let adjDebit = debit;
      if (row.type === "purchase") {
        adjDebit = debit - discount;
      }
      const netUSD = (adjDebit - credit) * (Number(row.ExchangeRate) || 1);
      const netLYD =
        (adjDebit - credit) *
        (Number(row.ExchangeRate) || 1) *
        (Number(row.ExchangeRateToLYD) || 1);
      balanceAmount += adjDebit - credit;
      balanceUSD += netUSD;
      balanceLYD += netLYD;
      return {
        ...row,
        balanceUSD,
        balanceLYD,
        balanceAmount,
        netAmountUSD: netUSD,
        netAmountLYD: netLYD,
      } as any;
    });
  }, [rows, openingBalances]);

  const columns = useMemo<MRT_ColumnDef<any>[]>(
    () => [
      {
        header: "Type / Date / Reference",
        id: "type_date_reference",
        size: 180,
        Cell: ({ row }) => {
          const type =
            row.original.type === "payment"
              ? "Payment"
              : row.original.type === "purchase"
                ? "Purchase"
                : row.original.type === "Opening Balance"
                  ? "Opening Balance"
                  : "";
          const date = row.original.date;
          const reference = row.original.reference;
          return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <span style={{ fontWeight: 500 }}>
                <span style={{ color: "#888", fontSize: 12 }}>Type:</span>{" "}
                {type}
              </span>
              <span style={{ fontWeight: 500 }}>
                <span style={{ color: "#888", fontSize: 12 }}>Date:</span>{" "}
                {date}
              </span>
              <span style={{ fontWeight: 500 }}>
                <span style={{ color: "#888", fontSize: 12 }}>Reference:</span>{" "}
                {reference}
              </span>
            </Box>
          );
        },
      },
      {
        header: "Brand / Vendor",
        id: "brand_vendor",
        size: 160,
        Cell: ({ row }) => {
          let brand = row.original.brand;
          let vendorLabel: string = "";
          const v = row.original.vendor;
          if (typeof v === "object" && v !== null && "Client_Name" in v) {
            vendorLabel = v.Client_Name;
          } else if (typeof v === "string" || typeof v === "number") {
            vendorLabel = String(v);
          }
          return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <span style={{ fontWeight: 500 }}>
                <span style={{ color: "#888", fontSize: 12 }}>Brand:</span>{" "}
                {brand}
              </span>
              <span style={{ fontWeight: 500 }}>
                <span style={{ color: "#888", fontSize: 12 }}>Vendor:</span>{" "}
                {vendorLabel}
              </span>
            </Box>
          );
        },
      },
      {
        accessorKey: "credit",
        header: "Debit / Credit / Discount",
        size: 140,
        Cell: ({ row }) => {
          const type = row.original.type;
          const raw = Number((row.original as any).debit) || 0;
          const discount =
            row.original.discount_by_vendor !== undefined
              ? Number(row.original.discount_by_vendor)
              : 0;
          // For display: payments reduce liability => show as Credit (absolute value)
          // Purchases increase liability => show as Debit (net after discount)
          let showDebit = 0;
          let showCredit = 0;
          if (type === "payment") {
            showCredit = Math.abs(raw);
          } else if (type === "purchase") {
            showDebit = Math.max(0, raw - discount);
          }
          if (!showDebit && !showCredit && !discount) return "";
          return (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
              }}
            >
              {showDebit !== 0 && (
                <span>
                  <span style={{ color: "#888", fontSize: 12 }}>Debit:</span>{" "}
                  {showDebit.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}{" "}
                  {row.original.currency}
                </span>
              )}
              {showCredit !== 0 && (
                <span>
                  <span style={{ color: "#888", fontSize: 12 }}>Credit:</span>{" "}
                  {showCredit.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}{" "}
                  {row.original.currency}
                </span>
              )}
              {discount !== 0 && type === "purchase" && (
                <span style={{ color: "#d84315", fontSize: 12 }}>
                  <span style={{ color: "#888", fontSize: 12 }}>Discount:</span>{" "}
                  {discount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}{" "}
                  {row.original.currency}
                </span>
              )}
            </Box>
          );
        },
      },
      {
        accessorKey: "balanceAmount",
        header: "Balance (Amount)",
        size: 120,
        Cell: ({ cell, row }) =>
          cell.getValue() !== undefined
            ? Number(cell.getValue()).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              }) +
              " " +
              (row.original.currency || "")
            : "",
        muiTableBodyCellProps: {
          sx: {
            fontWeight: "bold",
            color: "violet",
            backgroundColor: "inherit",
          },
        },
      },
      {
        accessorKey: "netAmountUSD",
        header: "Net Amount (USD)",
        size: 120,
        Cell: ({ cell }) =>
          cell.getValue()
            ? Number(cell.getValue()).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              }) + " USD"
            : "",
      },
      {
        accessorKey: "balanceUSD",
        header: "Balance (USD)",
        size: 120,
        Cell: ({ cell }) =>
          cell.getValue()
            ? Number(cell.getValue()).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              }) + " USD"
            : "",
        muiTableBodyCellProps: {
          sx: {
            fontWeight: "bold",
            color: "#1976d2",
            backgroundColor: "inherit",
          },
        },
      },
      {
        accessorKey: "netAmountLYD",
        header: "Net Amount (LYD)",
        size: 120,
        Cell: ({ cell }) =>
          cell.getValue()
            ? Number(cell.getValue()).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              }) + " LYD"
            : "",
      },
      {
        accessorKey: "balanceLYD",
        header: "Balance (LYD)",
        size: 120,
        Cell: ({ cell }) =>
          cell.getValue()
            ? Number(cell.getValue()).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              }) + " LYD"
            : "",
        muiTableBodyCellProps: {
          sx: {
            fontWeight: "bold",
            color: "#388e3c",
            backgroundColor: "inherit",
          },
        },
      },
      {
        accessorKey: "paidby",
        header: "Paid By",
        size: 120,
        Cell: ({ row }) => {
          if (row.original.type === "payment" && row.original.Paidby) {
            const paidByVendor = vendors.find(
              (v) => v.ExtraClient_ID === row.original.Paidby
            );
            return paidByVendor
              ? paidByVendor.Client_Name
              : row.original.Paidby;
          }
          return "";
        },
      },
      {
        accessorKey: "comment",
        header: "Comment",
        size: 200,
        Cell: ({ row }) => {
          const comment = row.original.comment || "";
          if (!comment) return "";
          return (
            <Box
              sx={{
                background: "inherit",
                borderRadius: 1,
                p: 1,
                whiteSpace: "pre-line",
                fontSize: 13,
                maxWidth: 320,
              }}
            >
              {comment}
            </Box>
          );
        },
      },
    ],
    [vendors]
  );

  const table = useMaterialReactTable({
    columns,
    data: rowsWithBalance,
    state: { isLoading: loading, density: "compact" },
    enableDensityToggle: false,
    enableColumnFilters: false,
    enableGlobalFilter: false,
    enableFullScreenToggle: false,
    enableHiding: false,
    enableSorting: false,
    muiTableBodyRowProps: ({ row }) =>
      row.original.id === "opening-balance"
        ? { sx: { background: "#e3f2fd" } }
        : {},
    muiTableBodyCellProps: ({ row, cell, table }) => {
      if (row.original.id === "opening-balance") {
        if (cell.column.id === "date") {
          return {
            colSpan: table.getAllColumns().length,
            align: "center",
            sx: { fontWeight: "bold", fontSize: 16 },
            children: `Opening Balance on : ${row.original.date} | USD: ${Number(openingBalances.USD).toLocaleString(undefined, { minimumFractionDigits: 2 })} | LYD: ${Number(openingBalances.LYD).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          } as any;
        } else {
          return { style: { display: "none" } } as any;
        }
      }
      return {} as any;
    },
  });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, [from, to, vendor, brand]);

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          mb: 2,
          flexWrap: "wrap",
        }}
      >
        <Typography
          color="text.primary"
          variant="h5"
          sx={{ fontWeight: "bold", mr: 2, mb: { xs: 1, sm: 0 } }}
        >
          Gold Vendor Account Statement
        </Typography>
        <Box
          sx={{
            display: "flex",
            gap: 2,
            flexWrap: "wrap",
            alignItems: "center",
            ml: 2,
          }}
        >
          <TextField
            label="From"
            type="date"
            size="small"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 120, maxWidth: 140 }}
          />
          <TextField
            label="To"
            type="date"
            size="small"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 120, maxWidth: 140 }}
          />
          <Autocomplete
            options={vendors}
            getOptionLabel={(o) => o.Client_Name}
            value={vendor}
            size="small"
            onChange={(_e, v) => setVendor(v)}
            renderInput={(p) => (
              <TextField
                {...p}
                label="Vendor"
                size="small"
                sx={{ minWidth: 260, maxWidth: 340 }}
              />
            )}
            sx={{ minWidth: 260, maxWidth: 340 }}
          />
          <Autocomplete
            options={brands}
            getOptionLabel={(o) => o.client_name}
            value={brand}
            size="small"
            onChange={(_e, v) => setBrand(v)}
            renderInput={(p) => (
              <TextField
                {...p}
                label="Brand"
                size="small"
                sx={{ minWidth: 260, maxWidth: 340 }}
              />
            )}
            sx={{ minWidth: 260, maxWidth: 340 }}
          />
          <Button variant="contained" color="info" onClick={fetchData}>
            Preview
          </Button>
        </Box>
      </Box>
      <Divider sx={{ mb: 2 }} />
      <Box>
        <MaterialReactTable table={table} />
        <Box
          sx={{ display: "flex", justifyContent: "flex-end", mt: 2, gap: 4 }}
        >
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: "bold", color: "#1976d2" }}
          >
            Final Balance (Amount):{" "}
            {rowsWithBalance.length > 0
              ? Number(
                  (rowsWithBalance as any)[rowsWithBalance.length - 1]
                    .balanceAmount
                ).toLocaleString(undefined, { minimumFractionDigits: 2 })
              : "0.00"}{" "}
            {rowsWithBalance.length > 0
              ? (rowsWithBalance as any)[rowsWithBalance.length - 1].currency
              : ""}
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: "bold", color: "#1976d2" }}
          >
            Final Balance (USD):{" "}
            {rowsWithBalance.length > 0
              ? Number(
                  (rowsWithBalance as any)[rowsWithBalance.length - 1]
                    .balanceUSD
                ).toLocaleString(undefined, { minimumFractionDigits: 2 })
              : "0.00"}{" "}
            USD
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: "bold", color: "#388e3c" }}
          >
            Final Balance (LYD):{" "}
            {rowsWithBalance.length > 0
              ? Number(
                  (rowsWithBalance as any)[rowsWithBalance.length - 1]
                    .balanceLYD
                ).toLocaleString(undefined, { minimumFractionDigits: 2 })
              : "0.00"}{" "}
            LYD
          </Typography>
        </Box>
        <style>{`
          .MuiTableCell-root { padding-top: 4px !important; padding-bottom: 4px !important; padding-left: 6px !important; padding-right: 6px !important; font-size: 13px !important; }
        `}</style>
      </Box>
    </Box>
  );
};

export default DVendorAccountStatement;
