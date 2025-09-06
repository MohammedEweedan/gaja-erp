import React, { RefObject } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Checkbox, FormControlLabel } from '@mui/material';
import { Box } from '@mui/system';
import { Dialog as MuiDialog, DialogTitle as MuiDialogTitle, DialogContent as MuiDialogContent, DialogActions as MuiDialogActions } from '@mui/material';

import WatchStandardInvoiceContent from './WatchStandardInvoiceContent';
import { n } from 'framer-motion/dist/types.d-B50aGbjN';

// Define minimal local types for Invoice and Client
export type Client = {
  id_client: number;
  client_name: string;
  tel_client: string;
};
export type Invoice = {
  id_fact: number;
  date_fact: string;
  client: number;
  num_fact: number;
  usr: number;
  d_time: string;
  IS_GIFT: boolean;
  id_art: number;
  prix_vente: number;
  prix_vente_remise: number;
  mode_fact: string;
  COMMENT: string;
  IS_OK: boolean;
  rate: number;
  remise: number;
  is_printed: boolean;
  ps: number;
  phone_client: string;
  total_remise: number;
  qty: number;
  total_remise_final: number;
  currency: string;
  picint: number;
  ACHATs?: ACHATs[];
  ACHAT_pic?: ACHAT_pic[];

  // ...add more fields as needed for the dialog
}
type ACHAT_pic = {
  id_art: number;
  ID_PIC: number;
  PIC1: string;
  PIC2: string;
  PIC3: string;
};

type ACHATs = {
  id_fact: number;
  Design_art: string;
  client: number;
  qty: number;
  TOTAL_INV_FROM_DIAMOND: number;
  Color_Gold: string;
  Color_Rush: string;
  Original_Invoice: string;
  Fournisseur?: {
    id_client: number;
    client_name: string;
    code_fournisseur: string;
    TYPE_SUPPLIER: string;
  };
  DistributionPurchase?: DistributionPurchase[];

};



type DistributionPurchase = {
  distributionID: number;
  ps?: number;
  Weight?: number;
  distributionDate?: string;
  usr?: number;
  PurchaseID?: number;
  CreationDate?: string;
  PurchaseType?: string;
  distributionISOK?: boolean;


  OriginalAchatWatch?: {
    id_achat: number;
    Brand: number;
    model: string;
    reference_number?: string;
    serial_number?: string;
    movement?: string;
    caliber?: string;
    gender?: string;
    condition?: string;
    diamond_total_carat?: number;
    diamond_quality?: string;
    diamond_setting?: string;
    number_of_diamonds?: number;
    custom_or_factory?: string;
    case_material?: string;
    case_size?: string;
    bezel?: string;
    bracelet_type?: string;
    bracelet_material?: string;
    dial_color?: string;
    dial_style?: string;
    crystal?: string;
    water_resistance?: string;
    functions?: string;
    power_reserve?: string;
    box_papers?: boolean;
    warranty?: string;
    retail_price?: number;
    sale_price?: number;
    image_url?: string;
    certificate_url?: string;
    Comment_Achat?: string;
    DocumentNo?: string;
    IsApprouved?: string;
    Approval_Date?: Date;
    ApprouvedBy?: string;
    Comment?: string;
    attachmentUrl?: string;
    Date_Achat?: string;
    Usr?: number;
    sharepoint_url?: string;
    MakingCharge?: number;
    ShippingCharge?: number;
    TravelExpesenes?: number;
    Rate?: number;
    Total_Price_LYD?: number;
    SellingPrice?: number;
  };
};
interface InvoicePrintData {
  invoice: Invoice;
  items: Invoice[];
  customer: Client | undefined;
  totalAmountLYD: number;
  totalAmountUSD: number;
  totalAmountEur: number;
  totalWeight: number;
  itemCount: number;
  amount_currency_LYD: number;
  amount_EUR_LYD: number;
  type?: string;
  picint: number;
  Original_Invoice: string; // Add type to InvoicePrintData
  remise: number;
  remise_per: number;
}

interface PrintInvoiceDialogProps {
  open: boolean;
  invoice: Invoice | null;
  data: InvoicePrintData;
  printRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onInvoiceClosed?: () => void; // Parent page refresh
  onCartRefresh?: () => void; // Cart refresh
  showCloseInvoiceActions?: boolean;
  showCloseInvoice?: boolean; // NEW: control close actions visibility
}

const PrintInvoiceDialog: React.FC<PrintInvoiceDialogProps> = ({
  open, invoice, data, printRef, onClose, onInvoiceClosed, onCartRefresh, showCloseInvoiceActions = true, showCloseInvoice
}) => {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [invoiceNumFact, setInvoiceNumFact] = React.useState<number | null>(null);
  const [makeTransactionToCashier, setMakeTransactionToCashier] = React.useState(false);
  const [closeWarningOpen, setCloseWarningOpen] = React.useState(false);
  const [showImage, setShowImage] = React.useState(true);

  // Initialize invoice number from the provided invoice when available
  React.useEffect(() => {
    if (invoice?.num_fact && Number(invoice.num_fact) > 0) {
      setInvoiceNumFact(Number(invoice.num_fact));
    }
  }, [invoice]);

  // Print only the DialogContent (invoice area)
  const handlePrint = () => {
    // Find the DialogContent DOM node
    const dialogContent = document.querySelector('.MuiDialogContent-root');
    if (!dialogContent) return;

    // Clone the content
    const printContents = dialogContent.innerHTML;

    // Get all stylesheets
    let styles = '';
    Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).forEach((node) => {
      styles += node.outerHTML;
    });

    // Open a new window for printing
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice Print</title>
          ${styles}
          <style>
            @page { size: A5 portrait; margin: 10mm; }
            body, .MuiDialogContent-root, .invoice-content {
              background: #fff !important;
              color: #000 !important;
            }
            * {
              color: #000 !important;
              background: transparent !important;
              box-shadow: none !important;
            }
            .MuiDialogActions-root, .MuiDialogTitle-root { display: none !important; }
            /* Ensure tables and layout look good */
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 4px 8px; }
            /* Add more print-specific styles as needed */
          </style>
        </head>
        <body>
          <div class="MuiDialogContent-root">${printContents}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      // printWindow.close();
    }, 300);
  };





  /*
   if (data && data.items && data.items.length > 0) {
     const type = (data.items[0] as any)?.Fournisseur?.TYPE_SUPPLIER?.toLowerCase() || '';
     if (type.includes('diamond')) invoiceType = 'diamond';
     else if (type.includes('watche')) invoiceType = 'watch';
   }
 */
  // Always create a new object for dataWithTotalAmountFinal to force re-render
  const dataWithTotalAmountFinal = React.useMemo(() => ({
    ...data,
    num_fact: invoiceNumFact ?? invoice?.num_fact,
    TotalAmountFinal: data.items[0].total_remise_final
  }), [data, invoiceNumFact, invoice]);


  // Handler for closing this invoice
  const handleCloseInvoice = async () => {
    const token = localStorage.getItem('token');
    // Prefer ps/usr from current invoice when present
    const psParam = invoice?.ps != null ? String(invoice.ps) : String(ps ?? '');
    const usrParam = invoice?.usr != null ? String(invoice.usr) : String(Cuser ?? '');
    if (!psParam || !usrParam) {
      alert('User info missing. Cannot close invoice.');
      return;
    }
    try {
      // Optionally show a loading indicator here
      // Ensure we have a valid invoice number
      let num_fact: number | null = (invoice && invoice.num_fact) ? invoice.num_fact : (invoiceNumFact ?? null);
      if (!num_fact || Number(num_fact) === 0) {
        const newNum = await handleAddNew();
        if (!newNum) {
          alert('Failed to generate invoice number.');
          return;
        }
        num_fact = newNum;
      }







      const qs = new URLSearchParams({
        ps: psParam,
        usr: usrParam,
        num_fact: String(num_fact),
        MakeCashVoucher: String(!!makeTransactionToCashier),
      });
      const response = await fetch(`${apiUrlinv}/CloseNF?${qs.toString()}`,
        { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to close invoice');
      }


      const result = await response.json();

      // Optionally update state/UI here
      if (result?.new_num_fact) setInvoiceNumFact(Number(result.new_num_fact));
      if (Number(result?.gltranRowsCreated ?? 0) <= 0) {
        console.warn('CloseNF completed but no journal entries were created.');
      }
      if (onInvoiceClosed) onInvoiceClosed(); // Refresh parent page
      if (onCartRefresh) onCartRefresh(); // Refresh cart
      onClose(); // Close the dialog
    } catch (error: any) {
      alert(`Error closing invoice: ${error.message}`);
    }
  };


  const apiIp = `${process.env.REACT_APP_API_IP}`;
  let ps: string | null = null;
  let Cuser: string | null = null;
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const userObj = JSON.parse(userStr);
      ps = userObj.ps ?? localStorage.getItem('ps');
      Cuser = userObj.Cuser ?? localStorage.getItem('Cuser');
    } catch {
      ps = localStorage.getItem('ps');
      Cuser = localStorage.getItem('Cuser');
    }
  } else {
    ps = localStorage.getItem('ps');
    Cuser = localStorage.getItem('Cuser');
  }




  const apiUrlinv = `http://${apiIp}/invoices`;
  const handleAddNew = async (): Promise<number | null> => {
    const token = localStorage.getItem('token');
    const psParam = invoice?.ps != null ? String(invoice.ps) : String(ps ?? '');
    const usrParam = invoice?.usr != null ? String(invoice.usr) : String(Cuser ?? '');
    try {
      const response = await fetch(`${apiUrlinv}/SetNF?ps=${encodeURIComponent(psParam)}&usr=${encodeURIComponent(usrParam)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch new invoice number");
      const result = await response.json();
      setInvoiceNumFact(result.new_num_fact); // Set the new invoice number in state
      return Number(result.new_num_fact) || null;
    } catch (error) {
      console.error("Error creating new invoice:", error);
      return null;
    }
  };

  const handleGenerateNewNumberClick = () => setConfirmOpen(true);
  const handleConfirmClose = () => setConfirmOpen(false);
  const handleConfirmYes = async () => {
    setConfirmOpen(false);
    const nf = await handleAddNew();
    if (!nf) {
      alert('Failed to generate invoice number.');
    }
  };

  const handleCloseInvoiceClick = () => setCloseWarningOpen(true);
  const handleCloseWarningCancel = () => setCloseWarningOpen(false);
  const handleCloseWarningConfirm = async () => {
    setCloseWarningOpen(false);
    await handleCloseInvoice();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ p: 3, background: '#fff', color: '#000' }}>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', alignItems: 'center', background: '#fff' }}>

          {/* Show Image Checkbox
          
            <FormControlLabel
            control={<Checkbox checked={showImage} onChange={e => setShowImage(e.target.checked)} size="small" color="primary" />}
            label="Do you want to show image?"
            sx={{ mr: 2 }}
          />
          
          */}


          {/* Show close invoice button if invoice is not closed */}
          {invoice && showCloseInvoice && (
            <>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={makeTransactionToCashier}
                    onChange={e => setMakeTransactionToCashier(e.target.checked)}
                    color="warning"
                    size="small"
                  />
                }
                label="Do you want to Receive money in cashbox?"
                sx={{
                  mb: 0,
                  fontSize: 14,
                  '.MuiFormControlLabel-label': { fontSize: 16 },
                  color: 'warning.main',
                  mr: 'auto', // push to left
                }}
              />

              <Button
                variant="contained"
                color="error"
                onClick={handleCloseInvoiceClick}
              >
                Close This Invoice
              </Button></>
          )}

          {!showCloseInvoiceActions && (!invoiceNumFact || invoiceNumFact === 0) && (
            <Button
              variant="contained"
              color="secondary"
              onClick={handleGenerateNewNumberClick}
            >
              Generate New Invoice Number
            </Button>
          )}

          {/* Only show close actions if prop is true */}
          {invoiceNumFact && !showCloseInvoiceActions ? (
            <>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={makeTransactionToCashier}
                    onChange={e => setMakeTransactionToCashier(e.target.checked)}
                    color="warning"
                    size="small"
                  />
                }
                label="Do you want to Receive money in cashbox?"
                sx={{
                  mb: 0,
                  fontSize: 14,
                  '.MuiFormControlLabel-label': { fontSize: 16 },
                  color: 'warning.main',
                  mr: 'auto', // push to left
                }}
              />
              <Button
                variant="contained"
                color="error"
                onClick={handleCloseInvoiceClick}
              >
                Close This Invoice
              </Button>
            </>
          ) : null}
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 3, background: '#fff', color: '#000' }}>

        <WatchStandardInvoiceContent
          ref={printRef}
          data={dataWithTotalAmountFinal}
          num_fact={invoiceNumFact ?? invoice?.num_fact}
          key={invoiceNumFact ?? invoice?.num_fact ?? 'default'}
          showImage={showImage}
        />
      </DialogContent>
      <DialogActions sx={{ background: 'info', color: '#000' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handlePrint}
          sx={{ ml: 2 }}
        >
          Print
        </Button>
      </DialogActions>

      {/* Confirmation Dialog for Generate New Invoice Number */}
      <MuiDialog open={confirmOpen} onClose={handleConfirmClose}>
        <MuiDialogTitle>Confirmation</MuiDialogTitle>
        <MuiDialogContent>Are you ready to generate new number?</MuiDialogContent>
        <MuiDialogActions>
          <Button onClick={handleConfirmClose}>Cancel</Button>
          <Button onClick={handleConfirmYes} color="primary" variant="contained">Yes</Button>
        </MuiDialogActions>
      </MuiDialog>

      {/* Warning Dialog for Close Invoice */}
      <MuiDialog open={closeWarningOpen} onClose={handleCloseWarningCancel}>
        <MuiDialogTitle sx={{ color: 'warning.main' }}>Warning</MuiDialogTitle>
        <MuiDialogContent>
          <span style={{ color: '#ed6c02', fontWeight: 600, fontSize: 18 }}>
            Do you want to close this invoice?
          </span>
        </MuiDialogContent>
        <MuiDialogActions>
          <Button onClick={handleCloseWarningCancel}>Cancel</Button>
          <Button onClick={handleCloseWarningConfirm} color="warning" variant="contained">Yes</Button>
        </MuiDialogActions>
      </MuiDialog>
    </Dialog>
  );
};

export default PrintInvoiceDialog;
