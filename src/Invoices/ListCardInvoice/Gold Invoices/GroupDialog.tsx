import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
} from "@mui/material";
import GroupIcon from "@mui/icons-material/Group";

interface GroupDialogProps {
  open: boolean;
  onClose: () => void;
  groupName?: string;
  items: any[];
  imageUrls?: Record<string, string[]>;
}

const GroupDialog: React.FC<GroupDialogProps> = ({
  open,
  onClose,
  groupName,
  items,
  imageUrls,
}) => {
  const [zoomDialogOpen, setZoomDialogOpen] = React.useState<boolean>(false);
  const [zoomImages, setZoomImages] = React.useState<string[]>([]);
  const [zoomIndex, setZoomIndex] = React.useState<number>(0);

  // Calculate total sales price
  const totalSalesPrice = React.useMemo(() => {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum: number, item: any) => {
      const diamond = item.DistributionPurchase?.OriginalAchatDiamond
        ? item.DistributionPurchase.OriginalAchatDiamond
        : item;
      let price = diamond.SellingPrice;
      if (price == null) return sum;
      const num = Number(String(price).replace(/[^0-9.-]/g, ""));
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
  }, [items]);

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
        <DialogTitle>
          <GroupIcon sx={{ mr: 1 }} />
          {groupName || "Group Items"}
          {items && items.length > 0 && (
            <span
              style={{
                marginLeft: 16,
                fontWeight: 600,
                color: "#1976d2",
                fontSize: 16,
              }}
            >
              {/* Show brand name, number of items, total sales price beside group name */}
              {(() => {
                const first = items[0];
                let brand = "";
                if (first) {
                  if (first.Fournisseur?.client_name)
                    brand = first.Fournisseur.client_name;
                  else if (first.Brand) brand = first.Brand;
                  else if (
                    first.DistributionPurchase?.OriginalAchatDiamond?.Brand
                  )
                    brand =
                      first.DistributionPurchase.OriginalAchatDiamond.Brand;
                }
                return brand ? `Brand: ${brand} | ` : "";
              })()}
              Number of Items: {items.length} | Total Sales Price:{" "}
              {new Intl.NumberFormat("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(totalSalesPrice)}{" "}
              USD
            </span>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "row", gap: 2 }}>
            {/* Left: item cards */}
            <Box sx={{ flex: 1 }}>
              {items && items.length > 0 ? (
                items.map((item: any, idx: number) => {
                  let imageUrl = "";
                  let arr: string[] = [];
                  if (imageUrls && item?.id_fact) {
                    const idStr = String(item.id_fact);
                    // Try namespaced keys first, then fallback to legacy
                    const candidates = [
                      `gold:${idStr}`,
                      `diamond:${idStr}`,
                      `watch:${idStr}`,
                      idStr,
                    ];
                    for (const k of candidates) {
                      if (imageUrls[k] && imageUrls[k]!.length) {
                        arr = imageUrls[k]!;
                        break;
                      }
                    }
                  }
                  arr = arr.length ? arr : item?.imageUrls || [];
                  if (
                    !arr.length &&
                    (item?.image || item?.Image || item?.imgUrl)
                  )
                    arr = [item.image || item.Image || item.imgUrl];
                  // Strictly show only the last image not containing 'group' in filename
                  const filteredArr = arr.filter((u: string) => {
                    const filename = u.split("/").pop() || "";
                    return filename && !/group/i.test(filename);
                  });
                  if (filteredArr.length) {
                    imageUrl = filteredArr[filteredArr.length - 1];
                  } else {
                    imageUrl = "";
                  }
                  const diamond = item.DistributionPurchase
                    ?.OriginalAchatDiamond
                    ? {
                        ...item.DistributionPurchase.OriginalAchatDiamond,
                        Brand: item.Fournisseur?.client_name,
                      }
                    : { ...item, Brand: item.Fournisseur?.client_name };
                  return (
                    <Box
                      key={idx}
                      sx={{
                        mb: 2,
                        p: 1,
                        border: "1px solid #eee",
                        borderRadius: 1,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 2,
                        bgcolor: "#e5e5e5",
                      }}
                    >
                      {/* Debug info for image key and URL count */}

                      {imageUrl ? (
                        <Box
                          component="img"
                          src={imageUrl}
                          alt="img"
                          sx={{
                            width: 100,
                            height: 100,
                            objectFit: "contain",
                            borderRadius: 1,
                            border: "1px solid #ccc",
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            // Only show filtered images in zoom
                            setZoomImages(filteredArr);
                            setZoomIndex(filteredArr.length - 1);
                            setZoomDialogOpen(true);
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: 100,
                            height: 100,
                            bgcolor: "#f5f5f5",
                            borderRadius: 1,
                            border: "1px solid #ccc",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            No Image
                          </Typography>
                        </Box>
                      )}
                      <Box sx={{ flex: 1 }}>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 600,
                            color: "warning.main",
                            mb: 0.5,
                          }}
                        >
                          <b>Product Name:</b>{" "}
                          {diamond.Design_art || diamond.desig_art || "-"}
                        </Typography>
                        <Box
                          sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 1,
                            alignItems: "center",
                            fontSize: 12,
                          }}
                        >
                          <span style={{ marginRight: 12 }}>
                            <b>System Original ref.:</b>{" "}
                            {diamond.id_achat || "-"}
                          </span>
                          <span style={{ marginRight: 12 }}>
                            <b>Ref Code:</b> {diamond.CODE_EXTERNAL || "-"}
                          </span>
                          <span style={{ marginRight: 12 }}>
                            <b>Color:</b> {diamond.color || "-"}
                          </span>
                          <span style={{ marginRight: 12 }}>
                            <b>Document No.:</b> {diamond.DocumentNo || "-"}
                          </span>
                          <span style={{ marginRight: 12 }}>
                            <b>Purchase Date:</b> {diamond.Date_Achat || "-"}
                          </span>
                          <span style={{ marginRight: 12 }}>
                            <b>Brand Name:</b> {diamond.Brand || "-"}
                          </span>
                        </Box>
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 800, color: "warning.main", mt: 1 }}
                        >
                          <b>Selling Price:</b>{" "}
                          {(() => {
                            const price = diamond.SellingPrice;
                            const num = price ? Number(price) : 0;
                            const formatted = new Intl.NumberFormat("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(num);
                            return `${formatted} USD`;
                          })()}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No items in this group.
                </Typography>
              )}
            </Box>
            {/* Right: group image(s) */}
            <Box
              sx={{
                width: "35%",
                height: "35%",
                minWidth: 180,
                minHeight: 180,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                alignItems: "center",
                justifyContent: "center",
                borderLeft: "4px solid red",
                px: 4,
                py: 2,
                position: "relative",
              }}
            >
              <Typography
                variant="h6"
                sx={{ mb: 2, color: "red", fontWeight: 700 }}
              >
                Image Group
              </Typography>
              {items &&
                items.length > 0 &&
                (() => {
                  const item = items[0];
                  let groupImages: string[] = [];
                  if (imageUrls && item?.id_fact) {
                    const idStr = String(item.id_fact);
                    const arr = imageUrls[`gold:${idStr}`] || imageUrls[`diamond:${idStr}`] || imageUrls[`watch:${idStr}`] || imageUrls[idStr];
                    if (arr && arr.length > 0)
                      groupImages = arr.filter((u: string) => {
                        const filename =
                          u.split("/").pop()?.split("?")[0] || "";
                        return filename.toLowerCase().includes("group");
                      });
                  }
                  return groupImages.map((img: string, gidx: number) => (
                    <Box
                      key={gidx}
                      sx={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                      }}
                    >
                      <Box
                        component="img"
                        src={img}
                        alt="img-group"
                        sx={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          borderRadius: 2,
                          border: "2px solid red",
                          cursor: "pointer",
                          boxShadow: 2,
                          display: "block",
                          mx: "auto",
                        }}
                        onClick={() => {
                          setZoomImages([img]);
                          setZoomIndex(0);
                          setZoomDialogOpen(true);
                        }}
                      />
                    </Box>
                  ));
                })()}
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
      {/* Image Zoom Dialog */}
      <Dialog
        open={zoomDialogOpen}
        onClose={() => setZoomDialogOpen(false)}
        maxWidth="md"
      >
        <DialogTitle>Images</DialogTitle>
        <DialogContent>
          {zoomImages.length > 0 ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              <Box
                sx={{
                  position: "relative",
                  width: 400,
                  height: 400,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "#fafafa",
                  borderRadius: 2,
                  border: "1px solid #ccc",
                }}
              >
                <img
                  src={zoomImages[zoomIndex]}
                  alt="zoom"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    position: "absolute",
                    bottom: 8,
                    right: 16,
                    background: "#0008",
                    color: "#fff",
                    px: 0.5,
                    borderRadius: 1,
                  }}
                >
                  {zoomIndex + 1}/{zoomImages.length}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    position: "absolute",
                    top: 8,
                    left: 16,
                    background: "#0008",
                    color: "#fff",
                    px: 0.5,
                    borderRadius: 1,
                  }}
                >
                  {(() => {
                    const url: string = zoomImages[zoomIndex];
                    if (!url) return "";
                    try {
                      const parts = url.split("/");
                      return parts[parts.length - 1].split("?")[0];
                    } catch {
                      return url;
                    }
                  })()}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                <button
                  disabled={zoomIndex === 0}
                  onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
                >
                  Prev
                </button>
                <button
                  disabled={zoomIndex === zoomImages.length - 1}
                  onClick={() =>
                    setZoomIndex((i) => Math.min(zoomImages.length - 1, i + 1))
                  }
                >
                  Next
                </button>
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No images available.
            </Typography>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GroupDialog;
