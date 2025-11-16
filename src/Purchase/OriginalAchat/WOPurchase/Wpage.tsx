import React from "react";
import { Card, CardContent, Typography, Box, Button } from "@mui/material";
import WatchIcon from "@mui/icons-material/Watch";
import PaymentIcon from "@mui/icons-material/Payment";
import AssessmentIcon from "@mui/icons-material/Assessment";
import WOPurchase from "./WOPurchase";
import VendorsSettlment from "./VendorsSettlment";
import VendorAccountStatement from "./VendorAccountStatement";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const Wpage: React.FC = () => {
  const [showWOPurchase, setShowWOPurchase] = React.useState(false);
  const [showVendorsSettlment, setShowVendorsSettlment] = React.useState(false);
  const [showVendorAccountStatement, setShowVendorAccountStatement] =
    React.useState(false);

  const handleWatchPurchaseList = () => {
    setShowWOPurchase(true);
    setShowVendorsSettlment(false);
    setShowVendorAccountStatement(false);
  };

  const handleMakePayment = () => {
    setShowVendorsSettlment(true);
    setShowWOPurchase(false);
    setShowVendorAccountStatement(false);
  };

  const handleShowReports = () => {
    setShowVendorAccountStatement(true);
    setShowWOPurchase(false);
    setShowVendorsSettlment(false);
  };

  const handleBack = () => {
    setShowWOPurchase(false);
    setShowVendorsSettlment(false);
    setShowVendorAccountStatement(false);
  };

  return (
    <Box sx={{ p: 0.5 }}>
      <Box mb={2} display="flex" alignItems="center">
        {showWOPurchase && (
          <Button
            variant="contained"
            color="secondary"
            sx={{
              borderRadius: 3,
              textTransform: "none",
              fontWeight: "bold",
              px: 3,
              py: 1,
              mr: 2, // Add right margin to create space between button and title
            }}
            onClick={handleBack}
          >
            <ArrowBackIcon style={{ marginRight: 8 }} /> Back
          </Button>
        )}
        {showVendorsSettlment && (
          <Button
            variant="contained"
            color="secondary"
            sx={{
              borderRadius: 3,
              textTransform: "none",
              fontWeight: "bold",
              px: 3,
              py: 1,
              mr: 2, // Add right margin to create space between button and title
            }}
            onClick={handleBack}
          >
            <ArrowBackIcon style={{ marginRight: 8 }} /> Back
          </Button>
        )}
        {showVendorAccountStatement && (
          <Button
            variant="contained"
            color="secondary"
            sx={{
              borderRadius: 3,
              textTransform: "none",
              fontWeight: "bold",
              px: 3,
              py: 1,
              mr: 2, // Add right margin to create space between button and title
            }}
            onClick={handleBack}
          >
            <ArrowBackIcon style={{ marginRight: 8 }} /> Back
          </Button>
        )}
        <Typography
          variant="h4"
          color="text.primary"
          gutterBottom
          sx={{ m: 0 }}
        >
          Watches Management
        </Typography>
      </Box>
      {showWOPurchase ? (
        <WOPurchase />
      ) : showVendorsSettlment ? (
        <VendorsSettlment />
      ) : showVendorAccountStatement ? (
        <VendorAccountStatement />
      ) : (
        <>
          <Box
            display="flex"
            flexWrap="wrap"
            gap={4}
            justifyContent="center"
            pt={10}
          >
            <Box flex={1} minWidth={260} maxWidth={340}>
              <Card
                sx={{
                  cursor: "pointer",
                  transition: "0.2s",
                  "&:hover": { boxShadow: 6 },
                }}
                onClick={handleWatchPurchaseList}
              >
                <CardContent>
                  <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                  >
                    <WatchIcon sx={{ fontSize: 48, color: "primary.main" }} />
                    <Typography variant="h6" mt={2}>
                      Watch Purchase List
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      View and manage all watch purchases
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
                  <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                  >
                    <PaymentIcon
                      sx={{ fontSize: 48, color: "secondary.main" }}
                    />
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
                  <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                  >
                    <AssessmentIcon
                      sx={{ fontSize: 48, color: "success.main" }}
                    />
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
          {/* Add more space between cards and note */}
          <Box height={32} />
          {/* International Standard Notes */}
          {/* <Box
            mt={6}
            p={{ xs: 2, sm: 3, md: 4 }}
            sx={{
              borderRadius: 4,

              maxWidth: "100%",
              margin: "0 auto",
            }}
          >
            <Typography
              variant="h5"
              color="primary"
              gutterBottom
              sx={{ fontWeight: 700, mb: 3, letterSpacing: 1 }}
            >
              <span
                style={{ borderLeft: "5px solid #1976d2", paddingLeft: 14 }}
              >
                International Standard Notes
              </span>
            </Typography>
            <ul
              style={{
                marginLeft: 28,
                lineHeight: 1.7,
                fontSize: 14,
                color: "#2d3748",
                paddingRight: 8,
                paddingBottom: 0,
                marginBottom: 0,
              }}
            >
              <li style={{ marginBottom: 16 }}>
                <b style={{ color: "#1976d2", fontSize: 15 }}>
                  Watch Purchase List:
                </b>
                <span
                  style={{ color: "#374151", fontWeight: 400, fontSize: 14 }}
                >
                  {" "}
                  All records and transactions related to watch procurement
                  should comply with <b>ISO 9001:2015</b> for quality management
                  systems. This ensures that every purchase is traceable,
                  auditable, and meets internationally recognized standards for
                  documentation and process control. Maintaining detailed
                  records of suppliers, purchase orders, and product
                  specifications is essential for both internal audits and
                  external regulatory compliance. Additionally, organizations
                  should implement regular reviews and updates to procurement
                  procedures to align with evolving best practices and legal
                  requirements in the luxury goods sector.
                </span>
              </li>
              <li style={{ marginBottom: 16 }}>
                <b style={{ color: "#7b1fa2", fontSize: 15 }}>Make Payment:</b>
                <span
                  style={{ color: "#374151", fontWeight: 400, fontSize: 14 }}
                >
                  {" "}
                  All payment processes must adhere to <b>ISO 20022</b> for
                  electronic data interchange between financial institutions,
                  ensuring secure, standardized, and efficient financial
                  transactions. This includes the use of internationally
                  recognized payment messaging formats, robust authentication
                  protocols, and end-to-end encryption to protect sensitive
                  financial data. Organizations should also comply with
                  anti-money laundering (AML) and know your customer (KYC)
                  regulations, maintaining comprehensive records of all payment
                  activities and regularly auditing payment workflows to detect
                  and prevent fraudulent activities.
                </span>
              </li>
              <li>
                <b style={{ color: "#388e3c", fontSize: 15 }}>Reports:</b>
                <span
                  style={{ color: "#374151", fontWeight: 400, fontSize: 14 }}
                >
                  {" "}
                  Reporting and documentation should follow the guidelines of{" "}
                  <b>ISO 15489</b> for records management, which mandates the
                  creation, maintenance, and secure storage of all business
                  records. Reports should be clear, accurate, and accessible for
                  both operational decision-making and regulatory inspections.
                  Organizations are encouraged to implement digital archiving
                  solutions that support long-term retention, version control,
                  and secure access to sensitive information. Regular training
                  on records management best practices should be provided to all
                  staff involved in reporting and documentation processes.
                </span>
              </li>
            </ul>
          </Box> */}
        </>
      )}
    </Box>
  );
};

export default Wpage;
