import React from "react";
import { Card, CardContent, Typography, Box, Button } from "@mui/material";
import DiamondIcon from "@mui/icons-material/Diamond";
import PaymentIcon from "@mui/icons-material/Payment";
import AssessmentIcon from "@mui/icons-material/Assessment";
import OVendorsSettlment from "./OVendorsSettlment";
import DVendorAccountStatement from "../OPurchase/OVendorAccountStatement";
import OPurchase from "./OPurchase";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const Opage: React.FC = () => {
  const [showPurchase, setShowPurchase] = React.useState(false);
  const [showSettlement, setShowSettlement] = React.useState(false);
  const [showStatement, setShowStatement] = React.useState(false);

  const handlePurchaseList = () => {
    setShowPurchase(true);
    setShowSettlement(false);
    setShowStatement(false);
  };

  const handleMakePayment = () => {
    setShowSettlement(true);
    setShowPurchase(false);
    setShowStatement(false);
  };

  const handleShowReports = () => {
    setShowStatement(true);
    setShowPurchase(false);
    setShowSettlement(false);
  };

  const handleBack = () => {
    setShowPurchase(false);
    setShowSettlement(false);
    setShowStatement(false);
  };

  return (
    <Box sx={{ p: 0.5 }}>
      <Box mb={2} display="flex" alignItems="center">
        {(showPurchase || showSettlement || showStatement) && (
          <Button
            variant="contained"
            color="secondary"
            sx={{
              borderRadius: 3,
              textTransform: "none",
              fontWeight: "bold",
              px: 3,
              py: 1,
              mr: 2,
            }}
            onClick={handleBack}
          >
            <ArrowBackIcon style={{ marginRight: 8 }} /> Back
          </Button>
        )}
        <Typography variant="h4" color="text.primary" gutterBottom sx={{ m: 0 }}>
          Gold Purchases
        </Typography>
      </Box>
      {showPurchase ? (
        <Box>
          <OPurchase />
        </Box>
      ) : showSettlement ? (
        <OVendorsSettlment />
      ) : showStatement ? (
        <DVendorAccountStatement />
      ) : (
        <>
          <Box display="flex" flexWrap="wrap" gap={4} justifyContent="center" pt={2}>
            <Box flex={1} minWidth={260} maxWidth={340}>
              <Card
                sx={{
                  cursor: "pointer",
                  transition: "0.2s",
                  "&:hover": { boxShadow: 6 },
                }}
                onClick={handlePurchaseList}
              >
                <CardContent>
                  <Box display="flex" flexDirection="column" alignItems="center">
                    <DiamondIcon sx={{ fontSize: 48, color: "primary.main" }} />
                    <Typography variant="h6" mt={2}>
                      Gold Purchases List
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      View and manage Gold Purchases
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
            <Box flex={1} minWidth={260} maxWidth={340}>
              <Card
                sx={{
                  cursor: "pointer",
                  transition: "0.2s",
                  "&:hover": { boxShadow: 6 },
                }}
                onClick={handleMakePayment}
              >
                <CardContent>
                  <Box display="flex" flexDirection="column" alignItems="center">
                    <PaymentIcon sx={{ fontSize: 48, color: "secondary.main" }} />
                    <Typography variant="h6" mt={2}>
                      Make Payment
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      Manage vendor settlements
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
            <Box flex={1} minWidth={260} maxWidth={340}>
              <Card
                sx={{
                  cursor: "pointer",
                  transition: "0.2s",
                  "&:hover": { boxShadow: 6 },
                }}
                onClick={handleShowReports}
              >
                <CardContent>
                  <Box display="flex" flexDirection="column" alignItems="center">
                    <AssessmentIcon sx={{ fontSize: 48, color: "success.main" }} />
                    <Typography variant="h6" mt={2}>
                      Reports
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      Vendor Account Statement
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

export default Opage;
