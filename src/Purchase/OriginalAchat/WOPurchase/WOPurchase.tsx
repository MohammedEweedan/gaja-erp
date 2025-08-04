import { useEffect, useState, useMemo, forwardRef } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from 'material-react-table';
import {
  Box, IconButton, Tooltip, Button, Dialog,
  DialogActions, DialogContent, DialogTitle, TextField,
  Divider, Typography, Autocomplete, Link, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';

import Snackbar from '@mui/material/Snackbar';
import MuiAlert, { AlertProps } from '@mui/material/Alert';

import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import AttachFileIcon from '@mui/icons-material/AttachFile';

import SharePointIcon from '@mui/icons-material/Share';

import EmailIcon from '@mui/icons-material/Email';
import * as XLSX from 'xlsx';
import Backdrop from '@mui/material/Backdrop';

import LinearProgress from '@mui/material/LinearProgress';
import Logo from '../../../ui-component/Logo';
import CheckCircleIcon from '@mui/icons-material/Verified';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { currencyList } from '../../../constants/currencies';

import ImageIcon from '@mui/icons-material/Image';
import ImgDialog from './ImgDialog';
import AttchWatchFiles from './AttchWatchFiles';

type Supplier = {
  id_client: number;
  client_name: string;
  TYPE_SUPPLIER?: string;
};



type Vendor = {
  ExtraClient_ID: number;
  Client_Name: string;

};




export type User = {
  id_user: number;
  name?: string;
  name_user?: string;
  email?: string;
};


type WatchPurchase = {
  id_achat: number;
  Brand: number;
  model: string;
  reference_number?: string;
  Usr?: number;
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

  retail_price?: number;
  sale_price?: number;
  image_url?: string;
  certificate_url?: string;
  Comment_Achat?: string;
  DocumentNo?: string;
  IsApprouved?: string;
  Approval_Date?: string;
  ApprouvedBy?: string;
  Comment?: string;
  attachmentUrl?: string;
  Date_Achat?: string;
  user?: User;
  supplier?: Supplier | null;
  MakingCharge?: number;
  ShippingCharge?: number;
  TravelExpesenes?: number;
  Rate?: number;
  Total_Price_LYD?: number;
  vendorsID?: number | null; // Vendor ID, can be null if not set
  vendor?: Vendor | null;
  manufactureDate?: string;
  currencyRetail?: string;
  reaRetail?: number;
  RateToLYD?: number;
  ExpiryDate?: string;
  warranty?: string;
  discount_by_vendor?: number;
  common_local_brand?: string; // New field to indicate if it's a common local brand
};

type DistributionPurchase = {
  distributionID: number;
  ps: number;
  Weight: number;
  distributionDate: string;
  usr: number;
  PurchaseID: number;
};

type Ps = {
  Id_point: number;
  name_point: string;
  Email: string;
};

const initialWatchState: WatchPurchase = {
  id_achat: 0,
  Brand: 0,
  model: '',
  reference_number: '',
  serial_number: '',
  movement: '',
  caliber: '',
  gender: '',
  condition: '',
  diamond_total_carat: undefined,
  diamond_quality: '',
  diamond_setting: '',
  number_of_diamonds: undefined,
  custom_or_factory: '',
  case_material: '',
  case_size: '',
  bezel: '',
  bracelet_type: '',
  bracelet_material: '',
  dial_color: '',
  dial_style: '',
  crystal: '',
  water_resistance: '',
  functions: '',
  power_reserve: '',
  box_papers: false,

  retail_price: undefined,
  sale_price: undefined,
  image_url: '',
  certificate_url: '',
  Comment_Achat: '',
  DocumentNo: '',
  IsApprouved: undefined,        // changed from '' to null
  Approval_Date: undefined,      // changed from '' to null
  ApprouvedBy: undefined,        // changed from '' to null
  Comment: '',
  attachmentUrl: '',
  Date_Achat: new Date().toISOString().slice(0, 10),
  manufactureDate: '',

  supplier: null,
  currencyRetail: '',
  reaRetail: 1,
  RateToLYD: 1,
  ExpiryDate: '',
  warranty: '',
  discount_by_vendor: 0,
  common_local_brand: '', // New field to indicate if it's a common local brand
};

const Alert = forwardRef<HTMLDivElement, AlertProps>(
  (props, ref) => <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />
);

const WOPurchase = () => {
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

  const [data, setData] = useState<WatchPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editOPurchase, setEditOPurchase] = useState<WatchPurchase | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [snackbar, setSnackbar] = useState<{
    open: boolean,
    message: string,
    severity: 'success' | 'error' | 'info' | 'warning',
    actionType?: string
  }>({ open: false, message: '', severity: 'success' });
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [attachmentDialog, setAttachmentDialog] = useState<{ open: boolean, row: WatchPurchase | null }>({ open: false, row: null });
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailProgress, setEmailProgress] = useState(0);
  const [distributionDialog, setDistributionDialog] = useState<{ open: boolean, purchase: WatchPurchase | null }>({ open: false, purchase: null });
  const [distributions, setDistributions] = useState<DistributionPurchase[]>([]);
  const [newDistribution, setNewDistribution] = useState<{ ps: number; distributionDate: string }>({ ps: 0, distributionDate: new Date().toISOString().slice(0, 10) });
  const [loadingDistributions, setLoadingDistributions] = useState(false);
  const [psList, setPsList] = useState<Ps[]>([]);
  const [pendingDeleteDist, setPendingDeleteDist] = useState<DistributionPurchase | null>(null);
  const [distributionReady, setDistributionReady] = useState(false);
  const [distributionErrors, setDistributionErrors] = useState<{ ps?: string }>({});
  const [pendingDistribution, setPendingDistribution] = useState(false);
  const [showNotif, setShowNotif] = useState(true);
  const [showOnlyNotDistributed, setShowOnlyNotDistributed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; row: WatchPurchase | null }>({
    open: false,
    row: null,
  });
  const [costDialog, setCostDialog] = useState<{ open: boolean, row: WatchPurchase | null }>({ open: false, row: null });
  const [costFields, setCostFields] = useState<{ MakingCharge?: number; ShippingCharge?: number; TravelExpesenes?: number; Rate?: number; Total_Price_LYD?: number }>({});
  const [imgDialogOpen, setImgDialogOpen] = useState(false);
  const [imgDialogIdAchat, setImgDialogIdAchat] = useState<number | null>(null);
  const navigate = useNavigate();
  const apiUrl = "http://102.213.182.8:9000/WOpurchases";


  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return navigate("/");

    try {
      const response = await axios.get<WatchPurchase[]>(`${apiUrl}/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (error: any) {
      if (error.response?.status === 401) navigate("/");
      else setSnackbar({ open: true, message: "Error loading data", severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    const apiUrlsuppliers = "http://102.213.182.8:9000/suppliers";
    const token = localStorage.getItem('token');
    try {
      setLoadingSuppliers(true);
      const res = await axios.get<Supplier[]>(`${apiUrlsuppliers}/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const goldSuppliers = res.data.filter(supplier =>
        supplier.TYPE_SUPPLIER?.toLowerCase().includes('watche')
      );
      setSuppliers(goldSuppliers);
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to fetch suppliers', severity: 'error' });
    } finally {
      setLoadingSuppliers(false);
    }
  };


  const fetchVendors = async () => {
    const apiUrlVendors = "http://102.213.182.8:9000/vendors";
    const token = localStorage.getItem('token');
    try {
      setLoadingSuppliers(true);
      const res = await axios.get<Vendor[]>(`${apiUrlVendors}/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });


      setVendors(res.data);
    } catch (error) {
      // setSnackbar({ open: true, message: 'Failed to fetch suppliers', severity: 'error' });
    } finally {
      setLoadingSuppliers(false);
    }
  };




  const fetchAllDistributions = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get('http://102.213.182.8:9000/Dpurchases/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDistributions(res.data.filter((d: any) => d.PurchaseType === 'Watche Purchase'));
    } catch {
      setSnackbar({ open: true, message: 'Failed to load distributions', severity: 'error' });
    }
  };

  useEffect(() => {
    fetchData();
    fetchSuppliers();
    fetchVendors();
  }, [navigate]);

  useEffect(() => {
    const fetchPsList = async () => {
      const token = localStorage.getItem('token');
      try {
        const res = await axios.get('http://102.213.182.8:9000/ps/all', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPsList(res.data);
      } catch {
        setSnackbar({ open: true, message: 'Failed to load points of sale', severity: 'error' });
      }
    };
    fetchPsList();
  }, []);

  useEffect(() => {
    fetchAllDistributions();
  }, []);

  // Refresh distributions whenever purchases data changes
  useEffect(() => {
    fetchAllDistributions();
  }, [data]);



  const handleEdit = (row: WatchPurchase) => {
    setEditOPurchase({
      ...row,
      supplier: suppliers.find(s => s.id_client === row.Brand) || null,
      vendor: vendors.find(v => v.ExtraClient_ID === row.vendorsID) || null
    });
    setIsEditMode(true);
    setOpenDialog(true);
  };

  const handleAddNew = () => {
    setEditOPurchase(initialWatchState);
    setIsEditMode(false);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditOPurchase(null);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: any = {};
    if (!editOPurchase?.model) newErrors.model = 'Required';
    if (!editOPurchase?.Brand) newErrors.Brand = 'Required';
    if (!editOPurchase?.Date_Achat) newErrors.Date_Achat = 'Required';
    if (!editOPurchase?.vendor) newErrors.vendor = 'Required';
    if (!editOPurchase?.supplier) newErrors.supplier = 'Required';
    if (!editOPurchase?.reference_number) newErrors.reference_number = 'Required';
    if (!editOPurchase?.serial_number) newErrors.serial_number = 'Required';
    if (!editOPurchase?.movement) newErrors.movement = 'Required';
    if (!editOPurchase?.caliber) newErrors.caliber = 'Required';
    if (!editOPurchase?.gender) newErrors.gender = 'Required';
    if (!editOPurchase?.manufactureDate) newErrors.manufactureDate = 'Required';
    // if (!editOPurchase?.condition) newErrors.condition = 'Required';
    //if (editOPurchase?.diamond_total_carat === undefined || editOPurchase.diamond_total_carat === null) newErrors.diamond_total_carat = 'Required';
    //if (!editOPurchase?.diamond_quality) newErrors.diamond_quality = 'Required';
    //if (!editOPurchase?.diamond_setting) newErrors.diamond_setting = 'Required';
    //if (editOPurchase?.number_of_diamonds === undefined || editOPurchase.number_of_diamonds === null) newErrors.number_of_diamonds = 'Required';
    // if (!editOPurchase?.custom_or_factory) newErrors.custom_or_factory = 'Required';
    // if (!editOPurchase?.case_material) newErrors.case_material = 'Required';
    // if (!editOPurchase?.case_size) newErrors.case_size = 'Required';
    //if (!editOPurchase?.bezel) newErrors.bezel = 'Required';
    //if (!editOPurchase?.bracelet_type) newErrors.bracelet_type = 'Required';
    //if (!editOPurchase?.bracelet_material) newErrors.bracelet_material = 'Required';
    // if (!editOPurchase?.dial_color) newErrors.dial_color = 'Required';
    // if (!editOPurchase?.dial_style) newErrors.dial_style = 'Required';
    // if (!editOPurchase?.crystal) newErrors.crystal = 'Required';
    // if (!editOPurchase?.water_resistance) newErrors.water_resistance = 'Required';
    //if (!editOPurchase?.functions) newErrors.functions = 'Required';
    //if (!editOPurchase?.power_reserve) newErrors.power_reserve = 'Required';
    //if (editOPurchase?.box_papers === undefined || editOPurchase.box_papers === null) newErrors.box_papers = 'Required';
    //if (!editOPurchase?.warranty) newErrors.warranty = 'Required';
    if (editOPurchase?.retail_price === undefined || editOPurchase.retail_price === null) newErrors.retail_price = 'Required';
    if (editOPurchase?.sale_price === undefined || editOPurchase.sale_price === null) newErrors.sale_price = 'Required';
    setErrors(newErrors);
    console.log('Validation errors:', newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !editOPurchase) return;
    const token = localStorage.getItem('token');

    // Format dates
    const formatDate = (dateStr?: string) => {
      if (!dateStr) return null;
      // Accepts 'YYYY-MM-DD', 'YYYY-MM-DDTHH:mm', 'YYYY-MM-DDTHH:mm:ss', or 'YYYY-MM-DDTHH:mm:ss.sssZ'
      // Returns 'YYYY-MM-DD'
      return dateStr.split('T')[0];
    };

    const formatDateTime = (dateStr?: string) => {
      if (!dateStr) return null;
      // Accepts 'YYYY-MM-DDTHH:mm', 'YYYY-MM-DDTHH:mm:ss', 'YYYY-MM-DDTHH:mm:ss.sssZ'
      // Returns 'YYYY-MM-DD HH:mm:ss'
      let [date, time] = dateStr.split('T');
      if (!time) return `${date} 00:00:00`;
      // Remove milliseconds and timezone if present
      time = time.replace(/\.\d+Z?$/, '');
      // Pad seconds if missing
      const timeParts = time.split(':');
      if (timeParts.length === 2) return `${date} ${time}:00`;
      if (timeParts.length === 3) return `${date} ${time}`;
      return `${date} 00:00:00`;
    };

    // Prepare data
    const payload = {
      ...editOPurchase,
      Brand: editOPurchase.supplier?.id_client,
      Usr: Cuser,
      Date_Achat: formatDate(editOPurchase.Date_Achat),
      Approval_Date: formatDateTime(editOPurchase.Approval_Date),
      // warranty: formatDate(editOPurchase.warranty),
    };




    try {
      if (isEditMode) {
        await axios.put(`${apiUrl}/Update/${editOPurchase.id_achat}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSnackbar({ open: true, message: 'Purchase updated successfully', severity: 'success' });
      } else {
        const { id_achat, supplier, ...purchaseData } = payload;
        await axios.post(`${apiUrl}/Add`, purchaseData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSnackbar({ open: true, message: 'Purchase added successfully', severity: 'success' });
      }
      await fetchData();
      handleCloseDialog();
    } catch (error: any) {
      setSnackbar({ open: true, message: error.response?.data?.message || 'Save failed', severity: 'error' });
    }
  };

  const handleDelete = async (row: WatchPurchase) => {
    // Instead of deleting immediately, show confirmation Snackbar
    setConfirmDelete({ open: true, row });
  };



  const formatAmount = (value?: number) =>
    typeof value === 'number'
      ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '';



  const handleRequestApproval = async (row: WatchPurchase) => {

    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    let userName = '';
    let psVal = '';
    if (userStr) {
      try {
        const userObj = JSON.parse(userStr);
        userName = userObj.name_user || '';
        psVal = userObj.ps || '';
      } catch { }
    }
    const request_by = `${userName} - ${psVal}`;
    const date_request = new Date().toISOString().slice(0, 10);
    const type_request = 'Watch Purchase';
    const status = 'pending';
    const AutoComment = 'Watch Purchase';
    const Refrences_Number = row.id_achat;
    const usr = Cuser;
    // Optionally add Is_view if your backend supports it
    try {
      await fetch('http://102.213.182.8:9000/ApprovalRequests/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          request_by,
          date_request,
          type_request,
          status,
          AutoComment,
          Refrences_Number,
          usr,
          Is_view:false
        }),
      });
    } catch (err) {
      // Optionally handle error
      console.error(  err);
    }







    const email = 'hasni.zied@gmail.com';
    if (!email) return;
    setSendingEmail(true);
    setEmailProgress(10);
    try {
      setEmailProgress(20);
      const payload = {
        id_achat: row.id_achat,
        email,
        purchaseInfo: {
          Comment_Achat: row.Comment_Achat,
          Date_Achat: row.Date_Achat,
          Supplier: suppliers.find(s => s.id_client === row.Brand)?.client_name || '',
          DocumentNo: row.DocumentNo,
          model: row.model,
          reference_number: row.reference_number,
          serial_number: row.serial_number,
          sale_price: row.sale_price,
          retail_price: row.retail_price,
          condition: row.condition,
          diamond_total_carat: row.diamond_total_carat,
          diamond_quality: row.diamond_quality,
          box_papers: row.box_papers,
        }
      };
      setEmailProgress(40);
      const token = localStorage.getItem('token');
      setEmailProgress(60);
      await axios.post("http://102.213.182.8:9000/WOpurchases/send-approval", payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmailProgress(90);
      setSnackbar({ open: true, message: 'Approval email sent!', severity: 'success' });
      setEmailProgress(100);
      setTimeout(() => setSendingEmail(false), 500);
      setTimeout(() => setEmailProgress(0), 1000);
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to send approval email', severity: 'error' });
      setEmailProgress(0);
      setSendingEmail(false);
    }
  };



  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    // Accepts 'YYYY-MM-DD', 'YYYY-MM-DDTHH:mm', 'YYYY-MM-DDTHH:mm:ss', or 'YYYY-MM-DDTHH:mm:ss.sssZ'
    // Returns 'YYYY-MM-DD'
    return dateStr.split('T')[0];
  };

  const formatUSD = (value: number | undefined) =>
    typeof value === 'number' && !isNaN(value)
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
      : '';


  // --- Attachment logic ---
  const handleOpenAttachmentDialog = (row: WatchPurchase) => {
    setAttachmentDialog({ open: true, row });
    setAttachment(null);
  };

  const handleCloseAttachmentDialog = () => {
    setAttachmentDialog({ open: false, row: null });
    setAttachment(null);
  };



  const handleConfirmDistribution = async () => {
    if (!distributionDialog.purchase) return;

    // Validate PS
    if (!newDistribution.ps || newDistribution.ps === 0) {
      setDistributionErrors({ ps: 'Point of Sale is required' });
      setPendingDistribution(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      // Find if a distribution already exists for this purchase
      const existingDist = distributions.find(
        (d) => d.PurchaseID === distributionDialog.purchase?.id_achat
      );

      if (existingDist) {
        // Only update if PS or date changed
        if (
          existingDist.ps !== newDistribution.ps ||
          existingDist.distributionDate?.slice(0, 10) !== newDistribution.distributionDate
        ) {
          await axios.put(`http://102.213.182.8:9000/Dpurchases/Update/${existingDist.distributionID}`, {
            PurchaseID: distributionDialog.purchase?.id_achat,
            ps: newDistribution.ps,
            distributionDate: newDistribution.distributionDate,
            Weight: 1,
            PurchaseType: 'Watche Purchase',
            usr: Cuser,
            distributionISOK: false,
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setSnackbar({ open: true, message: 'Distribution updated successfully', severity: 'success' });
        } else {
          setSnackbar({ open: true, message: 'No changes to update.', severity: 'info' });
        }
      } else {
        // Add a new distribution
        await axios.post('http://102.213.182.8:9000/Dpurchases/Add', {
          PurchaseID: distributionDialog.purchase?.id_achat,
          ps: newDistribution.ps,
          distributionDate: newDistribution.distributionDate,
          Weight: 1,
          PurchaseType: 'Watche Purchase',
          usr: Cuser,
          distributionISOK: false,
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSnackbar({ open: true, message: 'Distributed successfully', severity: 'success' });
      }

      setDistributionDialog({ open: false, purchase: null });
      await fetchData();
      await fetchAllDistributions();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Distribution failed', severity: 'error' });
    } finally {
      setPendingDistribution(false);
      setSnackbar(s => ({ ...s, actionType: undefined }));
    }
  };

  const handleOpenDistributionDialog = async (purchase: WatchPurchase) => {
    setDistributionDialog({ open: true, purchase });
    setLoadingDistributions(true);
    try {
      const token = localStorage.getItem('token');
      // Fetch all distributions for this purchase
      const res = await axios.get(`http://102.213.182.8:9000/Dpurchases/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter for this purchase and type
      const filtered = res.data.filter(
        (d: any) =>
          d.PurchaseID === purchase.id_achat &&
          d.PurchaseType === 'Watche Purchase'
      );
      // DO NOT setDistributions(filtered) here!
      setDistributionReady(filtered.some((d: any) => d.distributionISOK === true));

      // If already distributed, set the ps and date in the dialog
      if (filtered.length > 0) {
        setNewDistribution({
          ps: filtered[0].ps,
          distributionDate: filtered[0].distributionDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        });
      } else {
        setNewDistribution({
          ps: 0,
          distributionDate: new Date().toISOString().slice(0, 10),
        });
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to load distributions', severity: 'error' });
    } finally {
      setLoadingDistributions(false);
    }
  };

  // When closing the dialog, refresh distributions from DB
  const handleCloseDistributionDialog = async () => {
    setDistributionDialog({ open: false, purchase: null });
    await fetchAllDistributions();
  };


  // --- Update columns definition for price group ---
  const columns = useMemo<MRT_ColumnDef<WatchPurchase>[]>(() => [

    { accessorKey: 'id_achat', header: 'ID Achat', size: 60 },
    {
      header: 'Vendor',
      id: 'vendorsID',
      size: 100,
      Cell: ({ row }) => (
        <Box sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
          {vendors.find(s => s.ExtraClient_ID === row.original.vendorsID)?.Client_Name || ''}
        </Box>
      ),
    },

    {
      header: 'Brand',
      id: 'supplier',
      size: 100,
      Cell: ({ row }) => (
        <Box sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
          {suppliers.find(s => s.id_client === row.original.Brand)?.client_name || ''}
        </Box>
      ),
    },


    

    { accessorKey: 'common_local_brand', header: 'Local Brand', size: 80 },
    {
      accessorKey: 'user',
      header: 'Created By',
      size: 120,
      Cell: ({ row }) =>
        row.original.user?.name_user ||
        row.original.user?.name ||
        row.original.Usr ||
        '',
    },
    {
      accessorKey: 'model',
      header: 'Model',
      size: 120,
      Cell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {row.original.model}
          {row.original.IsApprouved === 'Accepted' ? (
            <Tooltip title="Approved">
              <CheckCircleIcon color="success" fontSize="small" />
            </Tooltip>
          ) : (
            <Tooltip title="In Progress">
              <HourglassEmptyIcon color="warning" fontSize="small" />
            </Tooltip>
          )}
        </Box>
      ),
    },

    {
      header: 'Reference # / Serial #',
      id: 'reference_serial',
      size: 160,
      Cell: ({ row }) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <span style={{ fontWeight: 500 }}>Ref: {row.original.reference_number || '-'}</span>
          <span style={{ color: '#666', fontSize: 13 }}>SN: {row.original.serial_number || '-'}</span>
        </Box>
      ),
    },

 

    { accessorKey: 'movement', header: 'Movement', size: 80 },
    { accessorKey: 'caliber', header: 'Caliber', size: 80 },
    { accessorKey: 'gender', header: 'Gender', size: 80 },
    { accessorKey: 'condition', header: 'Condition', size: 80 },
    { accessorKey: 'diamond_total_carat', header: 'Diamond Carat', size: 80 },
    { accessorKey: 'diamond_quality', header: 'Diamond Quality', size: 100 },
    { accessorKey: 'diamond_setting', header: 'Diamond Setting', size: 100 },
    { accessorKey: 'number_of_diamonds', header: '# Diamonds', size: 80 },
    { accessorKey: 'custom_or_factory', header: 'Custom/Factory', size: 100 },
    { accessorKey: 'case_material', header: 'Case Material', size: 100 },
    { accessorKey: 'case_size', header: 'Case Size', size: 80 },
    { accessorKey: 'bezel', header: 'Bezel', size: 80 },
    { accessorKey: 'bracelet_type', header: 'Bracelet Type', size: 100 },
    { accessorKey: 'bracelet_material', header: 'Bracelet Material', size: 100 },
    { accessorKey: 'dial_color', header: 'Dial Color', size: 80 },
    { accessorKey: 'dial_style', header: 'Dial Style', size: 100 },
    { accessorKey: 'crystal', header: 'Crystal', size: 80 },
    { accessorKey: 'water_resistance', header: 'Water Resistance', size: 100 },
    { accessorKey: 'functions', header: 'Functions', size: 120 },
    { accessorKey: 'power_reserve', header: 'Power Reserve', size: 100 },
    { accessorKey: 'box_papers', header: 'Box/Papers', size: 80, Cell: ({ cell }) => cell.getValue<boolean>() ? 'Yes' : 'No' },

    {
      accessorKey: 'retail_price',
      header: 'Retail Price / Discount',
      size: 120,
      Cell: ({ row }) => {
        const retail = row.original.retail_price;
        const discount = row.original.discount_by_vendor;
        const currency = row.original.currencyRetail;
        if ((retail === undefined || retail === null) && (discount === undefined || discount === null)) return '';
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span>
              <strong>Retail:</strong> {retail !== undefined && retail !== null ? `${retail} ${currency || ''}` : '-'}
            </span>
            <span>
              <strong>Discount:</strong> <span style={{ color: 'red' }}>{discount !== undefined && discount !== null ? `${discount} ${currency || ''}` : '-'}</span>
            </span>
          </Box>
        );
      },
    },



    {
      accessorKey: 'sale_price',
      header: 'Sale Price',
      size: 100,
      Cell: ({ cell }) => formatUSD(cell.getValue<number>())
    },
    {
      accessorKey: 'image_url',
      header: 'Image',
      size: 80,
      Cell: ({ cell }) => cell.getValue<string>() ? (
        <Link href={cell.getValue<string>()} target="_blank" rel="noopener noreferrer">Image</Link>
      ) : ''
    },
    {
      accessorKey: 'certificate_url',
      header: 'Certificate URL',
      size: 100,
      Cell: ({ cell }) => cell.getValue<string>() ? (
        <Link href={cell.getValue<string>()} target="_blank" rel="noopener noreferrer">Certificate</Link>
      ) : ''
    },
    { accessorKey: 'Comment_Achat', header: 'Comment Achat', size: 120 },
    { accessorKey: 'DocumentNo', header: 'Document No', size: 100 },
    { accessorKey: 'IsApprouved', header: 'Is Approved', size: 80 },
    { accessorKey: 'Approval_Date', header: 'Approval Date', size: 100, Cell: ({ cell }) => formatDate(cell.getValue<string>()) },
    { accessorKey: 'ApprouvedBy', header: 'Approved By', size: 100 },
    { accessorKey: 'Comment', header: 'Comment', size: 120 },
    {
      header: 'Attachment',
      id: 'attachment',
      size: 80,
      Cell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Tooltip title={row.original.attachmentUrl ? "Manage Attachments" : "Attach File"}>
            <IconButton
              color={row.original.attachmentUrl ? "success" : "primary"}
              onClick={() => handleOpenAttachmentDialog(row.original)}
              size="small"
            >
              <AttachFileIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },

    {
      header: 'Actions',
      id: 'actions',
      size: 80,
      Cell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          {/* Hide Edit if approved */}
          {row.original.IsApprouved !== 'Accepted' && (
            <Tooltip title="Edit">
              <IconButton color="primary" onClick={() => handleEdit(row.original)} size="small">
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {/* Hide Delete if approved */}
          {row.original.IsApprouved !== 'Accepted' && (
            <Tooltip title="Delete">
              <IconButton color="error" onClick={() => handleDelete(row.original)} size="small">
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {/* Show Distribute button only if IsApprouved is Accepted */}
          {row.original.IsApprouved === 'Accepted' && (
            <Tooltip title="Distribute">
              <IconButton color="info" onClick={() => handleOpenDistributionDialog(row.original)} size="small">
                <ImportExportIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {/* Hide Request Approval if already accepted */}
          {row.original.IsApprouved !== 'Accepted' && (
            <Tooltip title="Request Approval">
              <IconButton
                color="warning"
                onClick={() => handleRequestApproval(row.original)}
                size="small"
              >
                <EmailIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    },
    {
      header: 'Edit Cost',
      id: 'edit_cost',
      size: 80,
      Cell: ({ row }) => (
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            setCostDialog({ open: true, row: row.original });
            setCostFields({
              MakingCharge: row.original.MakingCharge ?? 0,
              ShippingCharge: row.original.ShippingCharge ?? 0,
              TravelExpesenes: row.original.TravelExpesenes ?? 0,
              Rate: row.original.Rate ?? 0,
              Total_Price_LYD: row.original.Total_Price_LYD ?? 0,
            });
          }}
        >
          Edit
        </Button>
      ),
    },

    {
      header: 'SharePoint',
      id: 'sharepoint_url',
      size: 70,
      Cell: ({ cell }) => {
        const url = cell.getValue<string>();
        if (!url) return null;

        let isImage = false;
        try {
          const urlObj = new URL(url);
          const idParam = urlObj.searchParams.get('id');
          if (idParam && /\.(jpg|jpeg|png|gif|bmp|webp|svg|png)$/i.test(decodeURIComponent(idParam))) {
            isImage = true;
          }
        } catch {
          // fallback: check for image extension anywhere in the url
          isImage = /\.(jpg|jpeg|png|gif|bmp|webp|svg|png)/i.test(url);
        }

        if (isImage) {
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>

              <Tooltip title="Open SharePoint Image">
                <IconButton
                  component="a"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  color="primary"
                  size="small"
                >
                  <SharePointIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          );
        }

        // Otherwise, show the icon link only
        return (
          <Tooltip title="Open SharePoint Link">
            <IconButton
              component="a"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              color="primary"
              size="small"
            >
              <SharePointIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        );
      },
      enableColumnFilter: false,
      enableSorting: false,
    },
    {
      header: 'Distribution Status',
      id: 'distribution_status',
      size: 180,
      Cell: ({ row }) => {
        const distribution = distributions.find(
          (d) => d.PurchaseID === row.original.id_achat
        );
        if (distribution) {
          const ps = psList.find((ps) => ps.Id_point === distribution.ps);
          return (
            <Box
              sx={{
                display: 'inline-block',
                px: 2,
                py: 0.5,
                bgcolor: 'rgba(76, 175, 80, 0.08)',
                color: 'inherit',
                borderRadius: '16px',
                border: '1px solid rgba(76, 175, 80, 0.2)',

                fontWeight: 600,
                fontSize: '0.95em',
                textAlign: 'center',
                minWidth: 120,
              }}
            >
              Distributed to {ps ? ps.name_point : `PS#${distribution.ps}`}
            </Box>
          );
        }
        return (
          <Box
            sx={{
              display: 'inline-block',
              px: 2,
              py: 0.5,
              bgcolor: 'rgba(255, 152, 0, 0.08)',
              border: '1px solid rgba(255, 152, 0, 0.2)',
              color: 'inherit',
              borderRadius: '16px',
              fontWeight: 600,
              fontSize: '0.95em',
              textAlign: 'center',
              minWidth: 120,
            }}
          >
            Not Distributed Yet
          </Box>
        );
      },
      accessorFn: row => {
        const distribution = distributions.find(
          (d) => d.PurchaseID === row.id_achat
        );
        if (distribution) {
          const ps = psList.find((ps) => ps.Id_point === distribution.ps);
          return `Distributed to ${ps ? ps.name_point : `PS#${distribution.ps}`}`;
        }
        return 'Not Distributed Yet';
      },
      enableColumnFilter: false,
      enableSorting: false,
    },


    {
      header: 'Image',
      id: 'image-action',
      size: 60,
      Cell: ({ row }) => {
        const [thumb, setThumb] = useState<string | null>(null);
        const [loading, setLoading] = useState(false);
        const id_achat = row.original.id_achat;
        useEffect(() => {
          let mounted = true;
          const fetchThumb = async () => {
            setLoading(true);
            const token = localStorage.getItem('token');
            try {
              const res = await axios.get(`http://102.213.182.8:9000/images/list/${id_achat}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              let images = res.data;
              if (Array.isArray(images) && images.length > 0 && typeof images[0] === 'object') {
                const key = Object.keys(images[0]).find(k => ['url', 'path', 'filename', 'name'].includes(k));
                if (key) images = images.map((img) => img[key]);
              }
              let imgUrl = images[0] ? images[0] : null;
              if (imgUrl) {
                // If not absolute, prepend API base
                if (!/^https?:\/\//i.test(imgUrl)) {
                  imgUrl = `http://102.213.182.8:9000/images/${imgUrl}`;
                }
                // Always append token as query param
                if (token) {
                  imgUrl += (imgUrl.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
                }
              }
              if (mounted) setThumb(imgUrl);
            } catch {
              if (mounted) setThumb(null);
            } finally {
              if (mounted) setLoading(false);
            }
          };
          fetchThumb();
          return () => { mounted = false; };
        }, [id_achat]);
        return (
          <IconButton onClick={() => { setImgDialogOpen(true); setImgDialogIdAchat(id_achat); }} color="primary">
            {loading ? (
              <Box sx={{ width: 50, height: 50, bgcolor: '#eee', borderRadius: 1 }} />
            ) : thumb ? (
              <Box component="img" src={thumb} alt="img"
                sx={{
                  width: {
                    xs: '100%',
                    sm: '48%',
                    md: '31%',
                  },

                  minWidth: 120,
                  maxWidth: 200,
                  mb: 2,
                  boxShadow: 2,
                  borderRadius: 2,
                  overflow: 'hidden',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'stretch',
                  transition: 'box-shadow 0.3s',

                }} />
            ) : (
              <ImageIcon />
            )}
          </IconButton>
        );
      },
      enableSorting: false,
      enableColumnFilter: false,
    },



  ], [suppliers, distributions, psList]);

  // Filtered data for table
  const filteredData = useMemo(
    () =>
      showOnlyNotDistributed
        ? data.filter(row => !distributions.find(d => d.PurchaseID === row.id_achat))
        : data,
    [data, distributions, showOnlyNotDistributed]
  );

  const table = useMaterialReactTable({
    columns,
    data: filteredData,
    state: { isLoading: loading, density: 'compact' },
    enableDensityToggle: true,
    muiTableBodyCellProps: {
      sx: {
        py: 0.5,
        px: 0.5,
      },
    },
    muiTableHeadCellProps: {
      sx: {
        py: 0.5,
        px: 0.5,
      },
    },
    initialState: {
      pagination: {
        pageSize: 3,
        pageIndex: 0
      },
      columnVisibility: {
        id_achat: false,
        model: true,
        reference_number: true,
        serial_number: true,
        movement: false,
        user: false,
        caliber: false,
        gender: false,
        condition: false,
        diamond_total_carat: false,
        diamond_quality: false,
        diamond_setting: false,
        number_of_diamonds: false,
        custom_or_factory: false,
        case_material: false,
        case_size: false,
        bezel: false,
        bracelet_type: false,
        bracelet_material: false,
        dial_color: false,
        dial_style: false,
        crystal: false,
        water_resistance: false,
        functions: false,
        power_reserve: false,
        box_papers: false,
        retail_price: true,
        sale_price: true,
        image_url: false,
        certificate_url: false,
        Comment_Achat: false,
        sharepoint_url: false,
        IsApprouved: false,
        Approval_Date: false,
        ApprouvedBy: false,
        Comment: false,
        attachmentUrl: false,
        Date_Achat: true,
        Brand: true,
        Usr: false,

      }
    }
  });

  const notDistributedRows = useMemo(
    () =>
      data.filter(row =>
        !distributions.find(d => d.PurchaseID === row.id_achat)
      ),
    [data, distributions]
  );

  return (
    <Box p={-0.5} >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
          Watch Purchase List
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>

          <Button
            variant="outlined"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddNew}
            sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 'bold', px: 3, py: 1 }}
          >
            New Purchase
          </Button>
        </Box>
      </Box>

      {/* Notification bar just above the table */}
      {showNotif && notDistributedRows.length > 0 && (
        <Box
          sx={{
            mb: 2,
            bgcolor: 'rgba(255, 68, 0, 0.31)',
            color: 'inherit',
            py: 2,
            px: 3,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <Box>
            <strong>
              {notDistributedRows.length} purchase{notDistributedRows.length > 1 ? 's' : ''} not distributed yet!
            </strong>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="warning"
              onClick={() => setShowOnlyNotDistributed(true)}
              sx={{ borderRadius: 2, fontWeight: 'bold' }}
              disabled={showOnlyNotDistributed}
            >
              Filter Not Distributed
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setShowOnlyNotDistributed(false)}
              sx={{ borderRadius: 2, fontWeight: 'bold' }}
              disabled={!showOnlyNotDistributed}
            >
              Show All
            </Button>
            <Button
              variant="contained"
              color="inherit"
              onClick={() => setShowNotif(false)}
              sx={{ backgroundColor: '#f44336', borderRadius: 2, fontWeight: 'bold', ml: 2 }}
            >
              Dismiss
            </Button>
          </Box>
        </Box>
      )}

      {sendingEmail && (
        <Backdrop open={sendingEmail} sx={{ zIndex: 2000, color: '#fff', flexDirection: 'column' }}>
          <Logo />
          <Typography variant="h6" sx={{ mb: 2 }}>Sending approval email...</Typography>
          <Box sx={{ width: 400, maxWidth: '90%' }}>
            <LinearProgress variant="determinate" value={emailProgress} />
          </Box>
          <Typography variant="body2" sx={{ mt: 1 }}>{emailProgress}%</Typography>
        </Backdrop>
      )}
      <MaterialReactTable table={table} />

      {/* --- Edit/Add Dialog --- */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {isEditMode ? 'Edit Watch Purchase' : 'New Watch Purchase'}
          <Divider sx={{ mb: 0 }} />
        </DialogTitle>


        <DialogContent>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
              mt: 2,
            }}
          >
            {/* Supplier (Vendor) */}
            <Autocomplete
              id="supplier-select"
              options={suppliers}
              autoHighlight
              getOptionLabel={(option) => option.client_name}
              value={editOPurchase?.supplier || null}
              onChange={(_event, newValue) => {
                setEditOPurchase(prev => prev && ({
                  ...prev,
                  supplier: newValue
                    ? {
                      id_client: newValue.id_client,
                      client_name: newValue.client_name,
                      TYPE_SUPPLIER: newValue.TYPE_SUPPLIER
                    }
                    : null,
                  Brand: newValue ? newValue.id_client : 0
                }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={<span style={{ color: errors.supplier ? '#d32f2f' : undefined }}>Brand (Vendor)</span>}
                  required
                  error={!!errors.supplier}
                  sx={!!errors.supplier ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
                // helperText={errors.supplier ? errors.supplier : "The legal entity or company from which the watch was purchased. Identified using the ISO 17442 Legal Entity Identifier (LEI), which is a unique 20-character code assigned to financial and non-financial institutions for global identification. This ensures traceability and compliance in international transactions."}
                />
              )}
            />




            <Autocomplete
              id="vendors-select"
              options={vendors}
              autoHighlight
              getOptionLabel={(option) => option.Client_Name}
              value={editOPurchase?.vendor || null}
              onChange={(_event, newValue) => {
                setEditOPurchase(prev => prev && ({
                  ...prev,
                  vendor: newValue
                    ? {
                      ExtraClient_ID: newValue.ExtraClient_ID,
                      Client_Name: newValue.Client_Name
                    }
                    : null,
                  vendorsID: newValue ? newValue.ExtraClient_ID : 0
                }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={<span style={{ color: errors.vendor ? '#d32f2f' : undefined }}>Vendor</span>}
                  required
                  error={!!errors.vendor}
                  sx={!!errors.vendor ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
                //  helperText={errors.supplier ? errors.supplier : "The legal entity or company from which the watch was purchased. Identified using the ISO 17442 Legal Entity Identifier (LEI), which is a unique 20-character code assigned to financial and non-financial institutions for global identification. This ensures traceability and compliance in international transactions."}
                />
              )}
            />




            {/* Local Brand */}
            <Autocomplete
              options={[
                'Batman', 'Pepsi', 'Bruce wayne', 'Blue', 'Day just Black index', 'Gray', 'Green', 'Sprite'
              ]}
              freeSolo
              value={editOPurchase?.common_local_brand || ''}
              onInputChange={(_e, v) => setEditOPurchase({ ...editOPurchase!, common_local_brand: v })}
              renderInput={params => (
                <TextField
                  {...params}
                  label={<span style={{ color: errors.model ? '#d32f2f' : undefined }}>Local Brand</span>}
                  required
                  error={!!errors.common_local_brand}
                  sx={!!errors.common_local_brand ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
                  helperText={errors.common_local_brand ? errors.common_local_brand : "The official model name or designation assigned by the manufacturer (e.g., Submariner, Datejust). This is used for cataloging and identification in accordance with manufacturer and industry standards."}
                />
              )}
            />



            {/* Date Achat */}
            <TextField
              label={<span style={{ color: errors.Date_Achat ? '#d32f2f' : undefined }}>Purchase date</span>}
              type="date"
              fullWidth
              required
              value={editOPurchase?.Date_Achat || ''}
              onChange={e => setEditOPurchase({ ...editOPurchase!, Date_Achat: e.target.value })}
              error={!!errors.Date_Achat}
              sx={!!errors.Date_Achat ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
              helperText={errors.Date_Achat ? errors.Date_Achat : "The date the watch was purchased, formatted according to ISO 8601 (YYYY-MM-DD), which is the international standard for date and time representation."}
              InputLabelProps={{ shrink: true }}
            />


 
            {/* Model */}
            <Autocomplete
              options={[
                'Submariner', 'Speedmaster', 'Royal Oak', 'Datejust', 'Seamaster', 'Nautilus', 'Carrera', 'Reverso'
              ]}
              freeSolo
              value={editOPurchase?.model || ''}
              onInputChange={(_e, v) => setEditOPurchase({ ...editOPurchase!, model: v })}
              renderInput={params => (
                <TextField
                  {...params}
                  label={<span style={{ color: errors.model ? '#d32f2f' : undefined }}>Model</span>}
                  required
                  error={!!errors.model}
                  sx={!!errors.model ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
                  helperText={errors.model ? errors.model : "The official model name or designation assigned by the manufacturer (e.g., Submariner, Datejust). This is used for cataloging and identification in accordance with manufacturer and industry standards."}
                />
              )}
            />




            <TextField
              label={<span style={{ color: errors.DocumentNo ? '#d32f2f' : undefined }}>Document Number</span>}
              fullWidth
              required
              value={editOPurchase?.DocumentNo || ''}
              onChange={e => setEditOPurchase({ ...editOPurchase!, DocumentNo: e.target.value })}
              inputProps={{ pattern: '[A-Za-z0-9-]+' }}
              error={!!errors.DocumentNo}
              sx={!!errors.DocumentNo ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
            // helperText={errors.DocumentNo ? errors.DocumentNo : "A unique alphanumeric code assigned by the manufacturer to identify a specific watch model or configuration. For dive watches, this may comply with ISO 6425, which standardizes requirements for diver's watches."}
            />



            {/* Reference Number */}
            <TextField
              label={<span style={{ color: errors.reference_number ? '#d32f2f' : undefined }}>Reference Number</span>}
              fullWidth
              required
              value={editOPurchase?.reference_number || ''}
              onChange={e => setEditOPurchase({ ...editOPurchase!, reference_number: e.target.value })}
              inputProps={{ pattern: '[A-Za-z0-9-]+' }}
              error={!!errors.reference_number}
              sx={!!errors.reference_number ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
              helperText={errors.reference_number ? errors.reference_number : "A unique alphanumeric code assigned by the manufacturer to identify a specific watch model or configuration. For dive watches, this may comply with ISO 6425, which standardizes requirements for diver's watches."}
            />

            {/* Serial Number */}
            <TextField
              label={<span style={{ color: errors.serial_number ? '#d32f2f' : undefined }}>Serial Number</span>}
              fullWidth
              required
              value={editOPurchase?.serial_number || ''}
              onChange={e => setEditOPurchase({ ...editOPurchase!, serial_number: e.target.value })}
              inputProps={{ pattern: '[A-Za-z0-9]+' }}
              error={!!errors.serial_number}
              sx={!!errors.serial_number ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
              helperText={errors.serial_number ? errors.serial_number : "A unique identifier assigned to each individual watch by the manufacturer, often used for warranty, authentication, and traceability. Serial numbers may follow ISO 7812 for unique identification."}
            />

            {/* Movement */}
            <Autocomplete
              options={['Automatic', 'Manual', 'Quartz', 'Spring Drive']}
              freeSolo
              value={editOPurchase?.movement || ''}
              onInputChange={(_e, v) => setEditOPurchase({ ...editOPurchase!, movement: v })}
              renderInput={params => (
                <TextField
                  {...params}
                  label={<span style={{ color: errors.movement ? '#d32f2f' : undefined }}>Movement</span>}
                  required
                  error={!!errors.movement}
                  sx={!!errors.movement ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
                  helperText={errors.movement ? errors.movement : "The mechanism that drives the watch hands and complications. Common types include Automatic (self-winding), Manual (hand-wound), Quartz (battery-powered), and Spring Drive. ISO 3157 defines terminology for horology."}
                />
              )}
            />

            {/* Caliber */}
            <TextField
              label={<span style={{ color: errors.caliber ? '#d32f2f' : undefined }}>Caliber</span>}
              fullWidth
              required
              value={editOPurchase?.caliber || ''}
              onChange={e => setEditOPurchase({ ...editOPurchase!, caliber: e.target.value })}
              error={!!errors.caliber}
              sx={!!errors.caliber ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
              helperText={errors.caliber ? errors.caliber : "The specific model or design of the movement inside the watch, as designated by the manufacturer (e.g., 3135, 1861). Caliber numbers are used for servicing, parts, and technical reference."}
            />

            {/* Gender */}
            <Autocomplete
              options={['Men', 'Women', 'Unisex']}
              value={editOPurchase?.gender || ''}
              onInputChange={(_e, v) => setEditOPurchase({ ...editOPurchase!, gender: v })}
              renderInput={params => (
                <TextField
                  {...params}
                  label={<span style={{ color: errors.gender ? '#d32f2f' : undefined }}>Gender</span>}
                  required
                  error={!!errors.gender}
                  sx={!!errors.gender ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
                  helperText={errors.gender ? errors.gender : "The intended wearer of the watch, classified as Men, Women, or Unisex. Gender classification may follow ISO 20275 for standardized terminology in product categorization."}
                />
              )}
            />

            {/* Condition */}
            <Autocomplete
              options={['New', 'Unworn', 'Excellent', 'Very Good', 'Good', 'Fair']}
              value={editOPurchase?.condition || ''}
              onInputChange={(_e, v) => setEditOPurchase({ ...editOPurchase!, condition: v })}
              renderInput={params => (
                <TextField
                  {...params}
                  label={<span style={{ color: errors.condition ? '#d32f2f' : undefined }}>Condition</span>}
                  required
                  error={!!errors.condition}
                  sx={!!errors.condition ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
                  helperText={errors.condition ? errors.condition : "Describes the physical state of the watch at the time of purchase. Standardized terms such as New, Unworn, Excellent, Very Good, Good, and Fair are used for consistency in the secondary market and may align with ISO 20275."}
                />
              )}
            />

            {/* Diamond Total Carat */}
            <TextField
              label={<span style={{ color: errors.diamond_total_carat ? '#d32f2f' : undefined }}>Diamond Total Carat</span>}
              type="number"
              fullWidth
              required
              value={editOPurchase?.diamond_total_carat ?? ''}
              onChange={e => setEditOPurchase({ ...editOPurchase!, diamond_total_carat: Number(e.target.value) })}
              error={!!errors.diamond_total_carat}
              sx={!!errors.diamond_total_carat ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
              helperText={errors.diamond_total_carat ? errors.diamond_total_carat : "The total carat weight of all diamonds set in the watch, measured according to ISO 8653, which specifies methods for determining the mass of precious stones."}
            />

            {/* Diamond Quality */}
            <Autocomplete
              options={['D', 'E', 'F', 'G', 'H', 'VS1', 'VS2', 'VVS1', 'VVS2', 'SI1', 'SI2']}
              freeSolo
              value={editOPurchase?.diamond_quality || ''}
              onInputChange={(_e, v) => setEditOPurchase({ ...editOPurchase!, diamond_quality: v })}
              renderInput={params => (
                <TextField
                  {...params}
                  label={<span style={{ color: errors.diamond_quality ? '#d32f2f' : undefined }}>Diamond Quality</span>}
                  required
                  error={!!errors.diamond_quality}
                  sx={!!errors.diamond_quality ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
                  helperText={errors.diamond_quality ? errors.diamond_quality : "The color and clarity grade of diamonds, using GIA (Gemological Institute of America) standards or ISO 24016 for grading polished diamonds. Examples: D (colorless), VS1 (Very Slightly Included)."}
                />
              )}
            />

            {/* Diamond Setting */}
            <Autocomplete
              options={['Pavé', 'Bezel', 'Channel', 'Prong', 'Invisible']}
              freeSolo
              value={editOPurchase?.diamond_setting || ''}
              onInputChange={(_e, v) => setEditOPurchase({ ...editOPurchase!, diamond_setting: v })}
              renderInput={params => (
                <TextField
                  {...params}
                  label={<span style={{ color: errors.diamond_setting ? '#d32f2f' : undefined }}>Diamond Setting</span>}
                  required
                  error={!!errors.diamond_setting}
                  sx={!!errors.diamond_setting ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
                  helperText={errors.diamond_setting ? errors.diamond_setting : "The technique used to secure diamonds in the watch, such as Pavé, Bezel, Channel, Prong, or Invisible. These are industry-standard terms for jewelry and watchmaking."}
                />
              )}
            />

            {/* Number of Diamonds */}
            <TextField
              label={<span style={{ color: errors.number_of_diamonds ? '#d32f2f' : undefined }}>Number of Diamonds</span>}
              type="number"
              fullWidth
              required
              value={editOPurchase?.number_of_diamonds ?? ''}
              onChange={e => setEditOPurchase({ ...editOPurchase!, number_of_diamonds: Number(e.target.value) })}
              error={!!errors.number_of_diamonds}
              sx={!!errors.number_of_diamonds ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
              helperText={errors.number_of_diamonds ? errors.number_of_diamonds : "The total count of individual diamonds set in the watch, used for valuation and certification."}
            />

            {/* Custom or Factory */}
            <Autocomplete
              options={['Custom', 'Factory']}
              value={editOPurchase?.custom_or_factory || ''}
              onInputChange={(_e, v) => setEditOPurchase({ ...editOPurchase!, custom_or_factory: v })}
              renderInput={params => (
                <TextField
                  {...params}
                  label={<span style={{ color: errors.custom_or_factory ? '#d32f2f' : undefined }}>Custom or Factory</span>}
                  required
                  error={!!errors.custom_or_factory}
                  sx={!!errors.custom_or_factory ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
                  helperText={errors.custom_or_factory ? errors.custom_or_factory : "Indicates whether the watch is in its original factory configuration or has been modified/customized after production (aftermarket). Important for authenticity and value."}
                />
              )}
            />

            {/* Case Material */}
            <Autocomplete
              options={[
                'Stainless Steel', 'Yellow Gold', 'White Gold', 'Rose Gold', 'Platinum', 'Titanium', 'Ceramic', 'Carbon'
              ]}
              freeSolo
              value={editOPurchase?.case_material || ''}
              onInputChange={(_e, v) => setEditOPurchase({ ...editOPurchase!, case_material: v })}
              renderInput={params => (
                <TextField
                  {...params}
                  label={<span style={{ color: errors.case_material ? '#d32f2f' : undefined }}>Case Material</span>}
                  required
                  error={!!errors.case_material}
                  sx={!!errors.case_material ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
                  helperText={errors.case_material ? errors.case_material : "The material used for the watch case, such as Stainless Steel, Gold (Yellow/White/Rose), Platinum, Titanium, Ceramic, or Carbon. ISO 8654 specifies the composition and marking of precious metals."}
                />
              )}
            />

            {/* Case Size */}
            <TextField
              label={<span style={{ color: errors.case_size ? '#d32f2f' : undefined }}>Case Size (mm)</span>}
              type="number"
              fullWidth
              required
              value={editOPurchase?.case_size || ''}
              onChange={e => setEditOPurchase({ ...editOPurchase!, case_size: e.target.value })}
              error={!!errors.case_size}
              sx={!!errors.case_size ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
              helperText={errors.case_size ? errors.case_size : "The diameter of the watch case, measured in millimeters (mm) according to ISO 286, which defines tolerances for linear dimensions."}
            />

            {/* Bezel */}
            <TextField
              label={<span style={{ color: errors.bezel ? '#d32f2f' : undefined }}>Bezel</span>}
              fullWidth
              required
              value={editOPurchase?.bezel || ''}
              onChange={e => setEditOPurchase({ ...editOPurchase!, bezel: e.target.value })}
              error={!!errors.bezel}
              sx={!!errors.bezel ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
              helperText={errors.bezel ? errors.bezel : "The type and function of the bezel, such as Rotating (for divers), Fixed, or Tachymeter (for chronographs). The bezel is the ring surrounding the watch crystal."}
            />

            {/* Bracelet Type */}
            <TextField
              label={<span style={{ color: errors.bracelet_type ? '#d32f2f' : undefined }}>Bracelet Type</span>}
              fullWidth
              required
              value={editOPurchase?.bracelet_type || ''}
              onChange={e => setEditOPurchase({ ...editOPurchase!, bracelet_type: e.target.value })}
              error={!!errors.bracelet_type}
              sx={!!errors.bracelet_type ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
              helperText={errors.bracelet_type ? errors.bracelet_type : "The style or construction of the bracelet, such as Oyster, Jubilee, Leather, Rubber, or Mesh. This affects comfort, appearance, and value."}
            />

            {/* Bracelet Material */}
            <TextField
              label={<span style={{ color: errors.bracelet_material ? '#d32f2f' : undefined }}>Bracelet Material</span>}
              fullWidth
              required
              value={editOPurchase?.bracelet_material || ''}
              onChange={e => setEditOPurchase({ ...editOPurchase!, bracelet_material: e.target.value })}
              error={!!errors.bracelet_material}
              sx={!!errors.bracelet_material ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
              helperText={errors.bracelet_material ? errors.bracelet_material : "The material of the bracelet, which may include metals (ISO 8654), leather, rubber, or fabric. Material impacts durability and aesthetics."}
            />

            {/* Dial Color */}
            <TextField
              label={<span style={{ color: errors.dial_color ? '#d32f2f' : undefined }}>Dial Color</span>}
              fullWidth
              required
              value={editOPurchase?.dial_color || ''}
              onChange={e => setEditOPurchase({ ...editOPurchase!, dial_color: e.target.value })}
              error={!!errors.dial_color}
              sx={!!errors.dial_color ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
              helperText={errors.dial_color ? errors.dial_color : "The color of the watch dial, described using standard color names or codes (ISO 11664 for colorimetry)."}
            />

            {/* Dial Style */}
            <TextField
              label={<span style={{ color: errors.dial_style ? '#d32f2f' : undefined }}>Dial Style</span>}
              fullWidth
              required
              value={editOPurchase?.dial_style || ''}
              onChange={e => setEditOPurchase({ ...editOPurchase!, dial_style: e.target.value })}
              error={!!errors.dial_style}
              sx={!!errors.dial_style ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
              helperText={errors.dial_style ? errors.dial_style : "The decorative style or finish of the dial, such as Sunburst, Guilloché, Skeleton, or Enamel. Dial style contributes to the watch's uniqueness and value."}
            />

            {/* Crystal */}
            <TextField
              label={<span style={{ color: errors.crystal ? '#d32f2f' : undefined }}>Crystal</span>}
              fullWidth
              required
              value={editOPurchase?.crystal || ''}
              onChange={e => setEditOPurchase({ ...editOPurchase!, crystal: e.target.value })}
              error={!!errors.crystal}
              sx={!!errors.crystal ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
              helperText={errors.crystal ? errors.crystal : "The transparent cover over the dial, made from materials such as Sapphire, Mineral Glass, or Acrylic. Crystal type affects scratch resistance and clarity."}
            />

            {/* Water Resistance */}
            <TextField
              label={<span style={{ color: errors.water_resistance ? '#d32f2f' : undefined }}>Water Resistance</span>}
              fullWidth
              required
              value={editOPurchase?.water_resistance || ''}
              onChange={e => setEditOPurchase({ ...editOPurchase!, water_resistance: e.target.value })}
              error={!!errors.water_resistance}
              sx={!!errors.water_resistance ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
              helperText={errors.water_resistance ? errors.water_resistance : "The watch's ability to resist water ingress, expressed in meters (m), atmospheres (ATM), or bar. ISO 22810 defines water resistance for watches."}
            />

            {/* Functions */}
            <TextField
              label={<span style={{ color: errors.functions ? '#d32f2f' : undefined }}>Functions</span>}
              fullWidth
              required
              value={editOPurchase?.functions || ''}
              onChange={e => setEditOPurchase({ ...editOPurchase!, functions: e.target.value })}
              error={!!errors.functions}
              sx={!!errors.functions ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
              helperText={errors.functions ? errors.functions : "Additional features beyond basic timekeeping, known as complications (e.g., Chronograph, GMT, Date, Moonphase)."}
            />

            {/* Power Reserve */}
            <TextField
              label={<span style={{ color: errors.power_reserve ? '#d32f2f' : undefined }}>Power Reserve</span>}
              fullWidth
              required
              value={editOPurchase?.power_reserve || ''}
              onChange={e => setEditOPurchase({ ...editOPurchase!, power_reserve: e.target.value })}
              error={!!errors.power_reserve}
              sx={!!errors.power_reserve ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
              helperText={errors.power_reserve ? errors.power_reserve : "The amount of time (in hours) the watch will run from full wind until it stops, indicating the energy storage capacity of the movement."}
            />

            {/* Box/Papers */}
            <Autocomplete
              options={[true, false]}
              getOptionLabel={option => option ? 'Yes' : 'No'}
              value={editOPurchase?.box_papers ?? false}
              onChange={(_e, v) => setEditOPurchase({ ...editOPurchase!, box_papers: v ?? false })}
              renderInput={params => (
                <TextField
                  {...params}
                  label={<span style={{ color: errors.box_papers ? '#d32f2f' : undefined }}>Box/Papers</span>}
                  required
                  error={!!errors.box_papers}
                  sx={!!errors.box_papers ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
                  helperText={errors.box_papers ? errors.box_papers : "Indicates whether the original manufacturer’s box and documentation (papers) are included. These items are important for authenticity, provenance, and resale value."}
                />
              )}
            />



            {/* Retail Price, Currency Retail, Rate Retail in the same row */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label={<span style={{ color: errors.retail_price ? '#d32f2f' : undefined }}>Retail Price</span>}
                type="number"
                fullWidth
                required
                value={editOPurchase?.retail_price ?? ''}
                onChange={e => setEditOPurchase({ ...editOPurchase!, retail_price: Number(e.target.value) })}
                inputProps={{ min: 0, step: 1 }}
                error={!!errors.retail_price}
                sx={{ flex: 1, ...(!!errors.retail_price ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}) }}
                helperText={errors.retail_price ? errors.retail_price : (
                  editOPurchase?.retail_price
                    ? `Formatted: ${formatUSD(editOPurchase.retail_price)}`
                    : "The official retail price of the watch, expressed in USD.")}
              />


              <TextField
                label={<span style={{ color: errors.discount_by_vendor ? '#d32f2f' : undefined }}>Discount</span>}
                type="number"
                fullWidth
                required
                value={editOPurchase?.discount_by_vendor ?? ''}
                onChange={e => setEditOPurchase({ ...editOPurchase!, discount_by_vendor: Number(e.target.value) })}
                inputProps={{ min: 0, step: 1 }}
                error={!!errors.discount_by_vendor}
                sx={{ flex: 1, ...(!!errors.discount_by_vendor ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}) }}
                helperText={errors.discount_by_vendor ? errors.discount_by_vendor : (
                  editOPurchase?.discount_by_vendor
                    ? `Formatted: ${formatUSD(editOPurchase.discount_by_vendor)}`
                    : "The official retail price of the watch, expressed in USD.")}
              />






            </Box>


            <Box sx={{ display: 'flex', gap: 2 }}>

              <FormControl fullWidth sx={{ flex: 1 }}>
                <Autocomplete
                  id="currency-retail-autocomplete"
                  options={currencyList}
                  getOptionLabel={option => `${option.flag} ${option.code} - ${option.name}`}
                  value={currencyList.find(cur => cur.code === (editOPurchase?.currencyRetail || '')) || null}
                  onChange={(_e, newValue) => setEditOPurchase(prev => prev ? { ...prev, currencyRetail: newValue ? newValue.code : '' } : prev)}
                  renderInput={params => (
                    <TextField {...params} label="Currency Retail" variant="outlined" />
                  )}
                  isOptionEqualToValue={(option, value) => option.code === value.code}
                />

              </FormControl>

            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>



              <TextField
                label={<span style={{ color: errors.reaRetail ? '#d32f2f' : undefined }}>Rate Retail</span>}
                type="number"
                fullWidth
                value={editOPurchase?.reaRetail ?? ''}
                onChange={e => setEditOPurchase({ ...editOPurchase!, reaRetail: Number(e.target.value) })}
                error={!!errors.reaRetail}
                sx={{ flex: 1, ...(!!errors.reaRetail ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}) }}
                helperText={errors.reaRetail}
              />
              <TextField
                label="USD Total"
                value={
                  editOPurchase && editOPurchase.retail_price && editOPurchase.reaRetail && editOPurchase.RateToLYD
                    ? (Number(editOPurchase.retail_price) * Number(editOPurchase.reaRetail)).toFixed(2)
                    : ''
                }
                InputProps={{ readOnly: true }}
                fullWidth
                sx={{ flex: 1, minWidth: 180 }}
              />
            </Box>



            <TextField
              label={<span style={{ color: errors.RateToLYD ? '#d32f2f' : undefined }}>Rate To LYD</span>}
              type="number"
              fullWidth
              value={editOPurchase?.RateToLYD ?? ''}
              onChange={e => setEditOPurchase({ ...editOPurchase!, RateToLYD: Number(e.target.value) })}
              error={!!errors.RateToLYD}
              sx={{ flex: 1, ...(!!errors.RateToLYD ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}) }}
              helperText={errors.RateToLYD}
            />


            <TextField
              label="LYD Total"
              value={
                editOPurchase && editOPurchase.retail_price && editOPurchase.reaRetail && editOPurchase.RateToLYD
                  ? (Number(editOPurchase.retail_price) * Number(editOPurchase.reaRetail) * Number(editOPurchase.RateToLYD)).toFixed(2)
                  : ''
              }
              InputProps={{ readOnly: true }}
              fullWidth
              sx={{ flex: 1, minWidth: 180 }}
            />
            {/* Manufacture Date */}
            <TextField
              label={<span style={{ color: errors.manufactureDate ? '#d32f2f' : undefined }}>Manufacture Date</span>}
              fullWidth
              type="date"
              InputLabelProps={{ shrink: true }}
              value={editOPurchase?.manufactureDate || ''}
              onChange={e => setEditOPurchase(prev => prev ? { ...prev, manufactureDate: e.target.value } : prev)}
              required
              error={!!errors.manufactureDate}
              sx={!!errors.manufactureDate ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
              helperText={errors.manufactureDate ? errors.manufactureDate : "The date the watch was manufactured, formatted according to ISO 8601 (YYYY-MM-DD). This information is crucial for determining the age and authenticity of the watch."}
            />


            <TextField
              label={<span style={{ color: errors.sale_price ? '#d32f2f' : undefined }}>Sales Price</span>}
              type="number"
              fullWidth
              required
              value={editOPurchase?.sale_price ?? ''}
              onChange={e => setEditOPurchase({ ...editOPurchase!, sale_price: Number(e.target.value) })}
              inputProps={{ min: 0, step: 1 }}
              error={!!errors.sale_price}
              sx={{ flex: 1, ...(!!errors.retail_sale_priceprice ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}) }}

            />


            {/* Expiry Date */}
            <TextField
              label={<span style={{ color: errors.ExpiryDate ? '#d32f2f' : undefined }}>Expiry Date</span>}
              type="date"
              fullWidth
              value={editOPurchase?.ExpiryDate || ''}
              onChange={e => setEditOPurchase({ ...editOPurchase!, ExpiryDate: e.target.value })}
              error={!!errors.ExpiryDate}
              sx={!!errors.ExpiryDate ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
              helperText={errors.ExpiryDate}
              InputLabelProps={{ shrink: true }}
            />
            {/* Warranty */}
            <TextField
              label={<span style={{ color: errors.warranty ? '#d32f2f' : undefined }}>Warranty</span>}
              fullWidth
              value={editOPurchase?.warranty || ''}
              onChange={e => setEditOPurchase({ ...editOPurchase!, warranty: e.target.value })}
              error={!!errors.warranty}
              sx={!!errors.warranty ? { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#d32f2f', borderWidth: 2 } } } : {}}
              helperText={errors.warranty}
            />
          </Box>
        </DialogContent>


        <DialogActions>
          <Button onClick={handleCloseDialog} color="secondary">
            Cancel
          </Button>
          <Button onClick={handleSave} color="primary">
            {isEditMode ? 'Save Changes' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* --- Attachment Dialog --- */}
      <AttchWatchFiles
        open={attachmentDialog.open}
        onClose={handleCloseAttachmentDialog}
        row={attachmentDialog.row}
        id_achat={attachmentDialog.row?.id_achat}
        onUploadSuccess={fetchData}
        token={localStorage.getItem('token') || ''}

      />

      {/* --- Distribution Dialog --- */}
      <Dialog open={distributionDialog.open} onClose={handleCloseDistributionDialog}>
        <DialogTitle>Distribute Product</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1, minWidth: 300 }}>
            <Autocomplete
              options={psList}
              getOptionLabel={option => option.name_point}
              value={psList.find(ps => ps.Id_point === newDistribution.ps) || null}
              onChange={(_e, v) => {
                setNewDistribution(nd => ({ ...nd, ps: v ? v.Id_point : 0 }));
                setDistributionErrors({});
              }}
              renderInput={params => (
                <TextField
                  {...params}
                  label="Point of Sale"
                  required
                  error={!!distributionErrors.ps}
                  helperText={distributionErrors.ps}
                />
              )}
            />
            <TextField
              label="Distribution Date"
              type="date"
              value={newDistribution.distributionDate}
              onChange={e => setNewDistribution(nd => ({ ...nd, distributionDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDistributionDialog({ open: false, purchase: null })} color="secondary">
            Cancel
          </Button>
          <Button
            onClick={async () => {
              let hasError = false;
              if (!newDistribution.ps) {
                setDistributionErrors({ ps: 'Point of Sale is required' });
                hasError = true;
              } else {
                setDistributionErrors({});
              }
              if (hasError || !distributionDialog.purchase || !newDistribution.distributionDate) return;

              setPendingDistribution(true);
              setSnackbar({
                open: true,
                message: 'Are you ready to distribute?',
                severity: 'warning',
                actionType: 'distributionConfirm'
              });
            }}
            color="primary"
            variant="contained"
            disabled={distributionReady}
          >
            Distribute
          </Button>
          {distributionReady && (
            <Typography color="error" sx={{ mt: 1 }}>
              This product has already been distributed and cannot be distributed again.
            </Typography>
          )}
        </DialogActions>
      </Dialog>




      <ImgDialog open={imgDialogOpen} onClose={() => setImgDialogOpen(false)} id_achat={imgDialogIdAchat} />

      {/* Snackbar for all alerts */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={snackbar.actionType === 'distributionConfirm' ? null : 6000}
        onClose={() => {
          setSnackbar({ open: false, message: '', severity: 'success', actionType: undefined });
          setPendingDistribution(false);
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => {
            setSnackbar({ open: false, message: '', severity: 'success', actionType: undefined });
            setPendingDistribution(false);
          }}
          severity={snackbar.severity}
          icon={pendingDistribution ? <ImportExportIcon /> : undefined}
          sx={{ width: '100%' }}
          action={
            snackbar.actionType === 'distributionConfirm' ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', mt: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    onClick={async () => {
                      await handleConfirmDistribution();
                      setSnackbar({ open: false, message: '', severity: 'success', actionType: undefined });
                      setPendingDistribution(false);
                    }}
                  >
                    OK
                  </Button>
                  <Button
                    variant="contained"
                    color="info"
                    size="small"
                    onClick={() => {
                      setSnackbar({ open: false, message: '', severity: 'success', actionType: undefined });
                      setPendingDistribution(false);
                    }}
                  >
                    Cancel
                  </Button>
                </Box>
              </Box>
            ) : null
          }
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Snackbar for delete confirmation */}
      <Snackbar
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, row: null })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity="warning"
          sx={{ width: '100%' }}
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                color="error"
                sx={{ bgcolor: '#f44336', color: '#fff' }}
                size="small"
                onClick={async () => {
                  if (confirmDelete.row) {
                    // Actually delete now
                    setSnackbar({ open: true, message: 'Deleting...', severity: 'info' });
                    const token = localStorage.getItem('token');
                    try {
                      await axios.delete(`${apiUrl}/Delete/${confirmDelete.row.id_achat}`, {
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      setSnackbar({ open: true, message: 'Purchase deleted successfully', severity: 'success' });
                      await fetchData();
                    } catch {
                      setSnackbar({ open: true, message: 'Delete failed', severity: 'error' });
                    }
                  }
                  setConfirmDelete({ open: false, row: null });
                }}
              >
                OK
              </Button>
              <Button
                sx={{ bgcolor: '#fff', color: '#000' }}
                color="inherit"
                size="small"
                onClick={() => setConfirmDelete({ open: false, row: null })}
              >
                Cancel
              </Button>
            </Box>
          }
        >
          Are you sure you want to delete this purchase?
        </Alert>
      </Snackbar>

      {/* --- Edit Cost Dialog --- */}
      <Dialog
        open={costDialog.open}
        onClose={() => setCostDialog({ open: false, row: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Cost Details</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mt: 1 }}>
            {/* Fields on the left */}
            <Box sx={{ flex: 1, minWidth: 240, maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h6" sx={{ mb: 0.75, fontWeight: 'bold', color: 'primary.main' }}>
                Charges :
                <Divider sx={{ my: 1, borderBottomWidth: 2 }} />
              </Typography>
              <TextField
                label="Making Charge"
                type="number"
                value={costFields.MakingCharge ?? ''}
                onChange={e => setCostFields(f => ({ ...f, MakingCharge: Number(e.target.value) }))}
                fullWidth
              />
              <TextField
                label="Shipping Charge"
                type="number"
                value={costFields.ShippingCharge ?? ''}
                onChange={e => setCostFields(f => ({ ...f, ShippingCharge: Number(e.target.value) }))}
                fullWidth
              />
              <TextField
                label="Travel Expenses"
                type="number"
                value={costFields.TravelExpesenes ?? ''}
                onChange={e => setCostFields(f => ({ ...f, TravelExpesenes: Number(e.target.value) }))}
                fullWidth
              />
              <TextField
                label="Rate"
                type="number"
                value={costFields.Rate ?? ''}
                onChange={e => setCostFields(f => ({ ...f, Rate: Number(e.target.value) }))}
                fullWidth
              />

            </Box>
            {/* Totals Box on the right */}
            <Box
              sx={{
                mt: { xs: 2, md: 0 },
                p: 4,
                minWidth: 340,
                maxWidth: 420,
                fontSize: 18,
                border: '2px solid rgba(76, 175, 80, 0.3)',
                color: 'inherit',
                backgroundColor: 'rgba(76, 175, 80, 0.10)',
                borderRadius: 3,
                mx: 'auto',
                flex: 1,
                alignSelf: 'flex-start'
              }}
            >
              <Typography variant="h5">
                Sale Price: <b>{costDialog.row?.sale_price ? costDialog.row.sale_price.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : '0 USD'}</b>
              </Typography>
              <Divider sx={{ my: 1, borderBottomWidth: 2 }} />
              <Typography variant="body2" sx={{ mt: 1 }}>
                <b>Total Price (USD):</b>{' '}
                {costDialog.row?.sale_price ? costDialog.row.sale_price.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : '0 USD'}
              </Typography>
              <Typography variant="body2">
                <b>Total Price (LYD):</b>{' '}
                {(costDialog.row?.sale_price ?? 0) * (costFields.Rate ?? 0) ? ((costDialog.row?.sale_price ?? 0) * (costFields.Rate ?? 0)).toLocaleString(undefined, { style: 'currency', currency: 'LYD' }) : '0 LYD'}
              </Typography>
              <Divider sx={{ my: 1, borderBottomWidth: 2 }} />
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Add Charges:
              </Typography>
              {[
                { label: 'Making Charge', value: costFields.MakingCharge },
                { label: 'Shipping Charge', value: costFields.ShippingCharge },
                { label: 'Travel Expenses', value: costFields.TravelExpesenes }
              ].map((item) => (
                <Typography variant="body2" key={item.label} sx={{ ml: 1 }}>
                  {item.label}: {formatAmount(item.value)} USD × {formatAmount(costFields.Rate)} = {formatAmount((item.value ?? 0) * (costFields.Rate ?? 0))} LYD
                </Typography>
              ))}
              <Divider sx={{ my: 1, borderBottomWidth: 2 }} />
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                Grand Total (USD): {(
                  (costDialog.row?.sale_price ?? 0) +
                  (costFields.MakingCharge ?? 0) +
                  (costFields.ShippingCharge ?? 0) +
                  (costFields.TravelExpesenes ?? 0)
                ).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                Grand Total (LYD): {(
                  (
                    (costDialog.row?.sale_price ?? 0) +
                    (costFields.MakingCharge ?? 0) +
                    (costFields.ShippingCharge ?? 0) +
                    (costFields.TravelExpesenes ?? 0)
                  ) * (costFields.Rate ?? 0)
                ).toLocaleString(undefined, { style: 'currency', currency: 'LYD' })}
              </Typography>
              <Divider sx={{ my: 1, borderBottomWidth: 2 }} />
              <Button sx={{ position: 'revert' }} variant='contained' onClick={() => { /* TODO: handle generate journal */ }} color="success">
                Generate Journal
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCostDialog({ open: false, row: null })} color="secondary">
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!costDialog.row) return;
              const token = localStorage.getItem('token');
              try {
                await axios.put(`${apiUrl}/Update/${costDialog.row.id_achat}`, {
                  ...costDialog.row,
                  ...costFields,
                }, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                setSnackbar({ open: true, message: 'Cost updated', severity: 'success' });
                await fetchData();
              } catch {
                setSnackbar({ open: true, message: 'Failed to update cost', severity: 'error' });
              }
              setCostDialog({ open: false, row: null });
            }}
            color="primary"
            variant="contained"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* --- Image Dialog --- */}

    </Box>
  );
};

export default WOPurchase;