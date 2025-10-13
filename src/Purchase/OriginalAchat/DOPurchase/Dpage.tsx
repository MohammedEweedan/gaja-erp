import React from 'react';
import { Card, CardContent, Typography, Box, Button } from '@mui/material';
import DiamondIcon from '@mui/icons-material/Diamond';
import PaymentIcon from '@mui/icons-material/Payment';
import AssessmentIcon from '@mui/icons-material/Assessment';
import DOPurchase from './DOPurchase';
import DVendorsSettlment from './DVendorsSettlment';
import DVendorAccountStatement from './DVendorAccountStatement';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const Dpage: React.FC = () => {
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
              textTransform: 'none',
              fontWeight: 'bold',
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
          Diamonds Management
        </Typography>
      </Box>
      {showPurchase ? (
        <DOPurchase />
      ) : showSettlement ? (
        <DVendorsSettlment />
      ) : showStatement ? (
        <DVendorAccountStatement />
      ) : (
        <>
          <Box display="flex" flexWrap="wrap" gap={4} justifyContent="center" pt={2}>
            <Box flex={1} minWidth={260} maxWidth={340}>
              <Card sx={{ cursor: 'pointer', transition: '0.2s', '&:hover': { boxShadow: 6 } }} onClick={handlePurchaseList}>
                <CardContent>
                  <Box display="flex" flexDirection="column" alignItems="center">
                    <DiamondIcon sx={{ fontSize: 48, color: 'primary.main' }} />
                    <Typography variant="h6" mt={2}>Diamond Purchase List</Typography>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      View and manage all diamond purchases
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
            <Box flex={1} minWidth={260} maxWidth={340}>
              <Card sx={{ cursor: 'pointer', transition: '0.2s', '&:hover': { boxShadow: 6 } }} onClick={handleMakePayment}>
                <CardContent>
                  <Box display="flex" flexDirection="column" alignItems="center">
                    <PaymentIcon sx={{ fontSize: 48, color: 'secondary.main' }} />
                    <Typography variant="h6" mt={2}>Make Payment</Typography>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      Manage diamond vendor settlements
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
            <Box flex={1} minWidth={260} maxWidth={340}>
              <Card sx={{ cursor: 'pointer', transition: '0.2s', '&:hover': { boxShadow: 6 } }} onClick={handleShowReports}>
                <CardContent>
                  <Box display="flex" flexDirection="column" alignItems="center">
                    <AssessmentIcon sx={{ fontSize: 48, color: 'success.main' }} />
                    <Typography variant="h6" mt={2}>Reports</Typography>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      Vendor Account Statement
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Box>
          {/* Spacer between cards and notes */}
          <Box height={32} />

          {/* International Diamond Notes & Warnings */}
          <Box
            mt={6}
            p={{ xs: 2, sm: 3, md: 4 }}
            sx={{ borderRadius: 4, maxWidth: '100%', m: '0 auto' }}
          >
            <Typography
              variant="h5"
              color="primary"
              gutterBottom
              sx={{ fontWeight: 700, mb: 3, letterSpacing: 1 }}
            >
              <span style={{ borderLeft: '5px solid #1976d2', paddingLeft: 14 }}>
                International Diamond Notes & Warnings
              </span>
            </Typography>
            <ul style={{ marginLeft: 28, lineHeight: 1.7, fontSize: 14, color: '#2d3748', paddingRight: 8, paddingBottom: 0, marginBottom: 0 }}>
              <li style={{ marginBottom: 16 }}>
                <b style={{ color: '#1976d2', fontSize: 15 }}>Diamond Purchase List:</b>{' '}
                <span style={{ color: '#374151', fontWeight: 400, fontSize: 14 }}>
                  Ensure every purchase aligns with the <b>Kimberley Process Certification Scheme (KPCS)</b> to prevent trade in conflict diamonds. Maintain supplier due diligence per the <b>OECD Due Diligence Guidance</b> and quality management under <b>ISO 9001:2015</b>. For grading terminology and reporting consistency, reference <b>ISO 24016:2020</b> (gem-quality diamond grading requirements).
                </span>
              </li>
              <li style={{ marginBottom: 16 }}>
                <b style={{ color: '#7b1fa2', fontSize: 15 }}>Make Payment:</b>{' '}
                <span style={{ color: '#374151', fontWeight: 400, fontSize: 14 }}>
                  Follow <b>AML</b>/<b>KYC</b> controls and retain verification records. Use standardized payment messaging (e.g., <b>ISO 20022</b>) and strong authentication. Reconcile vendor settlements to purchase references and preserve audit trails for regulatory inspections.
                </span>
              </li>
              <li style={{ marginBottom: 16 }}>
                <b style={{ color: '#388e3c', fontSize: 15 }}>Reports:</b>{' '}
                <span style={{ color: '#374151', fontWeight: 400, fontSize: 14 }}>
                  Statements and documentation should meet <b>ISO 15489</b> records management practices with secure retention, accessibility, and version control. Include currency/FX details, discounts, and vendor IDs to support transparency and audits.
                </span>
              </li>
            </ul>

            <Box mt={3} p={{ xs: 2, sm: 2.5 }} sx={{ borderRadius: 3, background: 'rgba(211, 47, 47, 0.08)', border: '1px solid rgba(211,47,47,0.25)' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#d32f2f', mb: 1.5 }}>
                Important Warnings
              </Typography>
              <ul style={{ marginLeft: 24, lineHeight: 1.7, fontSize: 14, color: '#2d3748', paddingRight: 8, paddingBottom: 0, marginBottom: 0 }}>
                <li style={{ marginBottom: 10 }}>
                  <b>Conflict & Sanctions Risk:</b> Reject any shipment lacking valid KPCS certificates or from sanctioned entities/regions.
                </li>
                <li style={{ marginBottom: 10 }}>
                  <b>Grading & Misrepresentation:</b> Record certificate numbers and labs. Flag discrepancies between physical stone and reported grade/measurements.
                </li>
                <li style={{ marginBottom: 10 }}>
                  <b>Valuation & FX Exposure:</b> Monitor exchange rates and discounts carefully; sudden FX shifts can materially impact liabilities and margins.
                </li>
                <li style={{ marginBottom: 0 }}>
                  <b>Security & Handling:</b> Apply secure handling/transport protocols and access control for inventory, attachments, and reports containing sensitive data.
                </li>
              </ul>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

export default Dpage;
