import React from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Typography,
  Collapse,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import LockIcon from "@mui/icons-material/Lock";
import EditIcon from "@mui/icons-material/Edit";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { Link as RouterLink } from "react-router-dom";
import axios from "axios";

type InvoiceCardProps = {
  row: any;
  isAdmin: boolean;
  returningIds: string[];
  imageBlobUrls: Record<string, string[]>;
  imageUrls: Record<string, string[]>;
  setImageDialogUrl: (v: string) => void;
  setImageDialogOpen: (v: boolean) => void;
  setSelectedInvoice: (v: any) => void;
  setPrintDialogOpen: (v: boolean) => void;
  setCloseError: (v: string) => void;
  setClosePayLydStr: (v: string) => void;
  setClosePayUsdStr: (v: string) => void;
  setClosePayUsdLydStr: (v: string) => void;
  setClosePayEurStr: (v: string) => void;
  setClosePayEurLydStr: (v: string) => void;
  setCloseMakeCashVoucher: (v: boolean) => void;
  setCloseInvoice: (v: any) => void;
  setCloseDialogOpen: (v: boolean) => void;
  setCloseInvoiceRows: (v: any[]) => void;
  handleOpenEditSeller: (row: any) => void;
  setChiraDialogIdFact: (v: any) => void;
  setChiraDialogOpen: (v: boolean) => void;
  buildEncryptedSellerPath: (id: number) => string;
  buildEncryptedClientPath: (id: number) => string;
  formatDate: (v: any) => string;
  formatDateTime: (v: any) => string;
  resolvePointOfSaleCode: (v: any) => string;
  stripInternalMetaTags: (v: string) => string;
  computeInvoicePaySummary: (row: any) => any;
  getHeaderBgByStatus: (paySummary: any) => string;
  normalizeMoney: (v: any) => number;
  formatWholeAmount: (v: any) => string;
  formatNumber: (v: number) => string;
  pickFirstPositive: (arr: any[]) => number | null;
  toFiniteNumber: (v: any) => number | null;
  resolveTypeFromSupplierType: (v: any) => string;
  makeImgKey: (t: string, id: any) => string;
  MONEY_EPS: number;
  FALLBACK_ITEM_IMAGE: string;
};

export const InvoiceCard: React.FC<InvoiceCardProps> = (props) => {
  const {
    row,
    isAdmin,
    returningIds,
    imageBlobUrls,
    imageUrls,
    setImageDialogUrl,
    setImageDialogOpen,
    setSelectedInvoice,
    setPrintDialogOpen,
    setCloseError,
    setClosePayLydStr,
    setClosePayUsdStr,
    setClosePayUsdLydStr,
    setClosePayEurStr,
    setClosePayEurLydStr,
    setCloseMakeCashVoucher,
    setCloseInvoice,
    setCloseDialogOpen,
    setCloseInvoiceRows,
    handleOpenEditSeller,
    setChiraDialogIdFact,
    setChiraDialogOpen,
    buildEncryptedSellerPath,
    buildEncryptedClientPath,
    formatDate,
    formatDateTime,
    resolvePointOfSaleCode,
    stripInternalMetaTags,
    computeInvoicePaySummary,
    getHeaderBgByStatus,
    normalizeMoney,
    formatWholeAmount,
    formatNumber,
    pickFirstPositive,
    toFiniteNumber,
    resolveTypeFromSupplierType,
    makeImgKey,
    MONEY_EPS,
    FALLBACK_ITEM_IMAGE,
  } = props;

  const theme = useTheme();
  const nameColor = theme.palette.mode === "dark" ? "#fff" : "#000";

  const [showItems, setShowItems] = React.useState(false);

  const date = formatDate(row.date_fact) || "";
  const num = row.num_fact || "";
  const createdStr = formatDateTime(row.d_time);
  const ps = row.ps || "";
  const psCode = resolvePointOfSaleCode(ps);
  const user = row.Utilisateur?.name_user || "";
  const isChiraVal = row.is_chira === true || row.is_chira === 1;
  const invoiceComment = stripInternalMetaTags(row.COMMENT ?? "");

  const paySummary = computeInvoicePaySummary(row);
  const headerBg = getHeaderBgByStatus(paySummary);

  const eps = MONEY_EPS;

  const remaining = {
    lyd: Math.max(0, normalizeMoney(paySummary.remaining?.lyd || 0)),
    usd: Math.max(0, normalizeMoney(paySummary.remaining?.usd || 0)),
    eur: Math.max(0, normalizeMoney(paySummary.remaining?.eur || 0)),
  };

  const remainingUsdLyd = Math.max(0, normalizeMoney(paySummary.remaining?.usdLyd || 0));
  const remainingEurLyd = Math.max(0, normalizeMoney(paySummary.remaining?.eurLyd || 0));

  const fullyPaidNow = remaining.lyd <= eps && remaining.usd <= eps && remaining.eur <= eps;

  const statusLabel = !paySummary.isClosed
    ? "Open"
    : paySummary.isFullyPaid
      ? "Closed • Paid"
      : "Closed • Remainder";

  const clientValue = row.Client || row.client || null;
  const clientName =
    clientValue && typeof clientValue === "object" ? clientValue.client_name || clientValue.name || "" : "";
  const clientContact =
    clientValue && typeof clientValue === "object" ? clientValue.tel_client || clientValue.phone || "" : "";
  const customerIdRaw =
    row.Client?.id_client ??
    row.Client?.ID_CLIENT ??
    row.Client?.idClient ??
    row.client?.id_client ??
    row.client?.ID_CLIENT ??
    row.client?.idClient ??
    row.id_client ??
    row.ID_CLIENT ??
    row.Id_client ??
    row.client_id ??
    row.clientID ??
    row.ClientID ??
    null;

  const customerIdForLink =
    customerIdRaw !== null && customerIdRaw !== undefined ? Number(customerIdRaw) : NaN;
  const hasCustomerProfileLink = Number.isFinite(customerIdForLink);

  const details: any[] = row._productDetails || [];
  const isClosed = !!row.IS_OK;

  const numFactAction = row?.num_fact ?? row?.num ?? row?.id_fact ?? null;
  const isReturning = numFactAction !== null && returningIds.includes(String(numFactAction));

  const invoiceTypeStr =
    String(row?.ACHATs?.[0]?.Fournisseur?.TYPE_SUPPLIER || "") +
    " " +
    details.map((d) => String(d?.typeSupplier || "")).join(" ");

  const lowerType = invoiceTypeStr.toLowerCase();
  const hasGold = lowerType.includes("gold");
  const hasDiamond = lowerType.includes("diamond");
  const hasWatches = lowerType.includes("watches");

  const typeBadges: Array<{ label: string; bg: string; fg: string }> = [];
  if (hasGold) typeBadges.push({ label: "Gold", bg: "#FFD700", fg: "#111827" });
  if (hasDiamond) typeBadges.push({ label: "Diamond", bg: "#B9F2FF", fg: "#0b1220" });
  if (hasWatches) typeBadges.push({ label: "Watches", bg: "#DDA15E", fg: "#111827" });

  return (
    <Card
      sx={{
        mb: 3,
        borderRadius: 3,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        border: "1px solid #e5e7eb",
        overflow: "hidden",
        transition: "all 0.3s ease",
        "&:hover": {
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          transform: "translateY(-2px)",
        },
      }}
    >
      <Box
        sx={{
          background: headerBg,
          p: 2.25,
          color: "white",
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
              {isChiraVal ? `Chira #${num}` : `Invoice #${num}`}
            </Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
              <Chip
                icon={paySummary.isClosed ? <LockIcon fontSize="small" /> : undefined}
                label={statusLabel}
                size="small"
                sx={{
                  backgroundColor: "rgba(0,0,0,0.18)",
                  color: "white",
                  fontWeight: 800,
                }}
              />
              <Typography sx={{ fontSize: 13, opacity: 0.9 }}>
                {date} • {createdStr}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.75 }}>
            <Chip
              icon={isClosed ? <LockIcon fontSize="small" /> : undefined}
              label={isClosed ? "Closed" : "Open"}
              size="small"
              sx={{
                backgroundColor: isClosed ? "#10b981" : "#f59e0b",
                color: "white",
                fontWeight: 700,
              }}
            />

            {typeBadges.length > 0 && (
              <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {typeBadges.map((b) => (
                  <Chip
                    key={b.label}
                    label={b.label}
                    size="small"
                    sx={{
                      bgcolor: b.bg,
                      color: b.fg,
                      fontWeight: 900,
                      height: 24,
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Box>

        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", fontSize: 13, opacity: 0.95 }}>
          {psCode && (
            <Chip
              label={`${psCode}`}
              size="small"
              sx={{
                backgroundColor: "rgba(255,255,255,0.2)",
                color: "white",
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            />
          )}

          {(user || clientName || clientContact) && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              {user && row.Utilisateur?.id_user && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Button
                    component={RouterLink}
                    to={buildEncryptedSellerPath(Number(row.Utilisateur.id_user))}
                    size="small"
                    sx={{
                      p: 0.5,
                      minWidth: 0,
                      color: nameColor,
                      textTransform: "none",
                      fontWeight: 900,
                      background: "rgba(255,255,255,0.08)",
                      "&:hover": { textDecoration: "underline", background: "rgba(255,255,255,0.16)" },
                    }}
                  >
                    👤 {user}
                  </Button>
                  {isAdmin && (
                    <Tooltip title="Change seller">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenEditSeller(row)}
                        sx={{ color: "white", bgcolor: "rgba(0,0,0,0.2)", "&:hover": { bgcolor: "rgba(0,0,0,0.35)" } }}
                      >
                        <EditIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              )}

              {(clientName || clientContact) && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                  {clientName && hasCustomerProfileLink ? (
                    <Button
                      size="small"
                      component={RouterLink}
                      to={buildEncryptedClientPath(Number(customerIdForLink))}
                      sx={{
                        p: 0.5,
                        minWidth: 0,
                        color: nameColor,
                        textTransform: "none",
                        fontWeight: 900,
                        background: "rgba(255,255,255,0.08)",
                        "&:hover": { textDecoration: "underline", background: "rgba(255,255,255,0.16)" },
                      }}
                      onClick={() => {
                        try {
                          if (typeof window !== "undefined") {
                            localStorage.setItem("customerFocusId", String(customerIdForLink));
                            localStorage.setItem("customerFocusName", clientName);
                            if (clientContact) localStorage.setItem("customerFocusPhone", clientContact);
                          }
                        } catch {}
                      }}
                    >
                      🛍️ {clientName}
                    </Button>
                  ) : clientName ? (
                    <Typography sx={{ fontWeight: 900, color: nameColor }}>🛍️ {clientName}</Typography>
                  ) : null}

                  {clientContact && (
                    <Typography sx={{ fontSize: 12, opacity: 0.9, color: nameColor }}>
                      📞 {clientContact}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          )}
        </Box>

        {invoiceComment && (
          <Box sx={{ mt: 1, p: 1, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 1 }}>
            <Typography sx={{ fontSize: 12, fontStyle: "italic" }}>💬 {invoiceComment}</Typography>
          </Box>
        )}
      </Box>

      <CardContent sx={{ p: 3, display: "flex", flexDirection: "column" }}>
        <Box sx={{ mb: 2.5, p: 2, backgroundColor: "#f8fafc", borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.25, color: "#0f172a" }}>
            Payment Summary
          </Typography>

          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 1.5 }}>
            {paySummary.isGold ? (
              <Box>
                <Typography sx={{ fontSize: 11, color: "#64748b" }}>Invoice Total</Typography>
                <Typography sx={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
                  {formatWholeAmount(paySummary.total.lyd)} LYD
                </Typography>
              </Box>
            ) : (
              <Box>
                <Typography sx={{ fontSize: 11, color: "#64748b" }}>Invoice Total</Typography>
                <Typography sx={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
                  {formatWholeAmount(paySummary.total.usd)} USD
                </Typography>
                {paySummary.total.eur > MONEY_EPS && (
                  <Typography sx={{ fontSize: 12, color: "#64748b" }}>
                    Also tracked: {formatWholeAmount(paySummary.total.eur)} EUR
                  </Typography>
                )}
              </Box>
            )}

            {/* Payments section */}
            {(paySummary.paid.lyd > eps || paySummary.paid.usd > eps || paySummary.paid.eur > eps) && (
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid #e5e7eb" }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#374151", mb: 1 }}>Payments:</Typography>
                {paySummary.paid.lyd > eps && (
                  <Box>
                    <Typography sx={{ fontSize: 11, color: "#64748b" }}>Paid Amount (LYD)</Typography>
                    <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#10b981" }}>
                      {formatWholeAmount(paySummary.paid.lyd)} LYD
                    </Typography>
                  </Box>
                )}

                {paySummary.paid.usd > eps && (
                  <Box>
                    <Typography sx={{ fontSize: 11, color: "#64748b" }}>Paid Amount (USD)</Typography>
                    <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#10b981" }}>
                      {formatWholeAmount(paySummary.paid.usd)} USD
                    </Typography>
                    {paySummary.paid.usdLyd > eps && (
                      <Typography sx={{ fontSize: 12, color: "#64748b" }}>
                        ≈ {formatWholeAmount(paySummary.paid.usdLyd)} LYD
                      </Typography>
                    )}
                  </Box>
                )}

                {paySummary.paid.eur > eps && (
                  <Box>
                    <Typography sx={{ fontSize: 11, color: "#64748b" }}>Paid Amount (EUR)</Typography>
                    <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#10b981" }}>
                      {formatWholeAmount(paySummary.paid.eur)} EUR
                    </Typography>
                    {paySummary.paid.eurLyd > eps && (
                      <Typography sx={{ fontSize: 12, color: "#64748b" }}>
                        ≈ {formatWholeAmount(paySummary.paid.eurLyd)} LYD
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            )}

            {/* Remainder section */}
            {(remaining.lyd > eps || remaining.usd > eps || remaining.eur > eps) && (
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid #e5e7eb" }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#374151", mb: 1 }}>Remaining:</Typography>
                {remaining.lyd > eps && (
                  <Box>
                    <Typography sx={{ fontSize: 11, color: "#64748b" }}>Remaining Amount (LYD)</Typography>
                    <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#ef4444" }}>
                      {formatWholeAmount(remaining.lyd)} LYD
                    </Typography>
                  </Box>
                )}

                {remaining.usd > eps && (
                  <Box>
                    <Typography sx={{ fontSize: 11, color: "#64748b" }}>Remaining (USD)</Typography>
                    <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#ef4444" }}>
                      {formatWholeAmount(remaining.usd)} USD
                    </Typography>
                    {remainingUsdLyd > eps && (
                      <Typography sx={{ fontSize: 12, color: "#64748b" }}>
                        ≈ {formatWholeAmount(remainingUsdLyd)} LYD
                      </Typography>
                    )}
                  </Box>
                )}

                {remaining.eur > eps && (
                  <Box>
                    <Typography sx={{ fontSize: 11, color: "#64748b" }}>Remaining (EUR)</Typography>
                    <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#ef4444" }}>
                      {formatWholeAmount(remaining.eur)} EUR
                    </Typography>
                    {remainingEurLyd > eps && (
                      <Typography sx={{ fontSize: 12, color: "#64748b" }}>
                        ≈ {formatWholeAmount(remainingEurLyd)} LYD
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            )}

            {paySummary.isClosed && fullyPaidNow && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Chip label="✅ Fully Paid" size="small" sx={{ fontWeight: 900, bgcolor: "#dcfce7", color: "#166534" }} />
              </Box>
            )}
          </Box>
        </Box>

        {details.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Button
              variant="text"
              onClick={() => setShowItems((v) => !v)}
              startIcon={showItems ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{ textTransform: "none", fontWeight: 900, px: 0 }}
            >
              {showItems ? `Hide Items (${details.length})` : `Show Items (${details.length})`}
            </Button>
            <Divider sx={{ mt: 1 }} />
          </Box>
        )}

        <Collapse in={showItems} timeout="auto" unmountOnExit>
          {details.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: "text.primary", fontSize: 16 }}>
                Products ({details.length})
              </Typography>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                  gap: 1.5,
                }}
              >
                {details.map((d: any, idx: number) => {
                  const productImageId = d.imageId ?? d.id_achat ?? d.picint ?? d.id_art ?? d.ID_ART;

                  const imgType = resolveTypeFromSupplierType(d.typeSupplier);
                  const imgKey = productImageId ? makeImgKey(imgType, productImageId) : "";

                  const productBlobUrls =
                    (imgKey && imageBlobUrls[imgKey]) ||
                    (productImageId != null ? imageBlobUrls[String(productImageId)] : []) ||
                    [];

                  const productRawUrls =
                    (imgKey && imageUrls[imgKey]) ||
                    (productImageId != null ? imageUrls[String(productImageId)] : []) ||
                    [];

                  const primaryImg = productBlobUrls[0] || productRawUrls[0] || FALLBACK_ITEM_IMAGE;

                  const detailPriceCandidates = [
                    d.prix_vente_remise,
                    d.unitPrice,
                    ...(Array.isArray(d.priceCandidates) ? d.priceCandidates : []),
                  ];
                  const rawPrice = pickFirstPositive(detailPriceCandidates);
                  const lineTotalNumber = toFiniteNumber(d.lineTotal);
                  const qtyNumber = toFiniteNumber(d.quantityValue);
                  let resolvedNumericPrice = rawPrice;
                  let priceSource: "unit" | "derived" | "line" | null = rawPrice !== null ? "unit" : null;

                  if ((resolvedNumericPrice === null || resolvedNumericPrice === undefined) && lineTotalNumber !== null && lineTotalNumber > 0) {
                    if (qtyNumber !== null && qtyNumber > 0) {
                      resolvedNumericPrice = normalizeMoney(lineTotalNumber / qtyNumber);
                      priceSource = "derived";
                    } else {
                      resolvedNumericPrice = lineTotalNumber;
                      priceSource = "line";
                    }
                  }

                  const currencyLabel =
                    String(d.typeSupplier || "").toLowerCase().includes("gold") ? "LYD" : "USD";

                  const hasNumericPrice = resolvedNumericPrice !== null && resolvedNumericPrice !== undefined;
                  const resolvedPriceLabel = hasNumericPrice
                    ? `${formatNumber(resolvedNumericPrice as number)} ${currencyLabel}${
                        priceSource === "derived" ? " (est)" : priceSource === "line" ? " (line)" : ""
                      }`
                    : "—";

                  return (
                    <Card
                      key={idx}
                      variant="outlined"
                      sx={{
                        borderRadius: 2,
                        overflow: "hidden",
                        border: (theme) => `1px solid ${theme.palette.divider}`,
                        transition: "0.15s ease",
                        "&:hover": { boxShadow: 3, borderColor: (theme) => theme.palette.primary.main },
                      }}
                    >
                      <Box sx={{ display: "flex", gap: 2, p: 1.5, alignItems: "stretch" }}>
                        <Box
                          sx={{
                            width: 92,
                            height: 92,
                            borderRadius: 2,
                            overflow: "hidden",
                            flex: "0 0 auto",
                            bgcolor: (theme) => (theme.palette.mode === "dark" ? "#111827" : "#e2e8f0"),
                            border: "1px solid rgba(0,0,0,0.06)",
                            position: "relative",
                            cursor: primaryImg !== FALLBACK_ITEM_IMAGE ? "pointer" : "default",
                          }}
                          onClick={() => {
                            if (primaryImg && primaryImg !== FALLBACK_ITEM_IMAGE) {
                              setImageDialogUrl(primaryImg);
                              setImageDialogOpen(true);
                            }
                          }}
                        >
                          <img
                            src={primaryImg}
                            alt="Product"
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            onError={(e) => {
                              const img = e.currentTarget as HTMLImageElement;
                              img.src = FALLBACK_ITEM_IMAGE;
                            }}
                          />
                          {d.IS_GIFT && (
                            <Chip
                              label="🎁 Gift"
                              size="small"
                              sx={{
                                position: "absolute",
                                top: 6,
                                left: 6,
                                bgcolor: "#fbbf24",
                                color: "#111827",
                                fontWeight: 900,
                                height: 22,
                              }}
                            />
                          )}
                        </Box>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                            <Typography
                              sx={{
                                fontWeight: 900,
                                fontSize: 14,
                                color: "text.primary",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={d.design || ""}
                            >
                              {d.design || "Unnamed Product"}
                            </Typography>

                            <Typography sx={{ fontWeight: 900, fontSize: 14, color: "primary.main", flex: "0 0 auto" }}>
                              {resolvedPriceLabel}
                            </Typography>
                          </Box>

                          <Box sx={{ mt: 0.75, display: "flex", gap: 1, flexWrap: "wrap" }}>
                            <Chip
                              label={String(d.typeSupplier || "").trim() || "Type"}
                              size="small"
                              sx={{ fontWeight: 800 }}
                            />
                            {d.weight && <Chip label={`⚖️ ${d.weight}g`} size="small" sx={{ fontWeight: 800 }} />}
                            {d.code && <Chip label={`🔖 ${d.code}`} size="small" sx={{ fontWeight: 800 }} />}
                            {d.CODE_EXTERNAL && <Chip label={`Ref: ${d.CODE_EXTERNAL}`} size="small" sx={{ fontWeight: 800 }} />}
                            {productImageId && <Chip label={`ImgID: ${productImageId}`} size="small" sx={{ fontWeight: 800 }} />}
                          </Box>

                          {isChiraVal && (
                            <Button
                              variant="contained"
                              size="small"
                              fullWidth
                              sx={{ mt: 1.25, fontSize: 12, py: 0.75, textTransform: "none", fontWeight: 800 }}
                              onClick={() => {
                                const invoiceIdForLine = d.id_fact || row.id_fact || row.num_fact;
                                setChiraDialogIdFact(invoiceIdForLine);
                                setChiraDialogOpen(true);
                              }}
                            >
                              Return Chira
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </Card>
                  );
                })}
              </Box>
            </Box>
          )}
        </Collapse>

        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ mt: 3, display: "flex", gap: 2, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            startIcon={<FileCopyIcon />}
            onClick={() => {
              setSelectedInvoice(row);
              setPrintDialogOpen(true);
            }}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            View Invoice
          </Button>

          {!isClosed && (
            <Button
              variant="contained"
              color="error"
              onClick={async () => {
                setCloseError("");
                setClosePayLydStr("");
                setClosePayUsdStr("");
                setClosePayUsdLydStr("");
                setClosePayEurStr("");
                setClosePayEurLydStr("");
                setCloseMakeCashVoucher(true);
                setCloseInvoice(row);
                setCloseDialogOpen(true);

                try {
                  const token = localStorage.getItem("token");
                  const psParam = String(row?.ps ?? "");
                  const usrParam = String(row?.usr ?? "");
                  const nfParam = String(row?.num_fact ?? "");
                  if (token && psParam && usrParam && nfParam) {
                    const verifyRes = await axios.get(`/invoices/Getinvoice/`, {
                      params: { ps: psParam, usr: usrParam, num_fact: nfParam },
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    setCloseInvoiceRows(Array.isArray(verifyRes.data) ? verifyRes.data : []);
                  }
                } catch {
                  setCloseInvoiceRows([]);
                }
              }}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              Validate Payment
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};
