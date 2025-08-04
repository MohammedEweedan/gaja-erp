import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Grid } from '@mui/material';
import axios from 'axios';
import WatchLaterIcon from '@mui/icons-material/WatchLater';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import EuroIcon from '@mui/icons-material/Euro';
 
 
import { Balance } from '@mui/icons-material';

 
type BalanceItem = {
  Acc_No: string;
  balance: number;
  balance_curr: number;
  Name_M?: string; // <-- Add this line
  coa?: { Acc_No: string; Name_M: string };
};
export default function Dashboard() {

  const apiIp = process.env.REACT_APP_API_IP;


const [balances, setBalances] = useState<BalanceItem[]>([]);  const [loading, setLoading] = useState(false);
  // Example: show balances for all accounts starting with '1' (or any prefix)
  const acc_no = '110101'; // Change as needed
  const lenghtleft = 6; // Change as needed

  useEffect(() => {
    const fetchBalances = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token') || '';
        const apiUrl = `http://${apiIp}/Gls/BlancesCash`;
        const res = await axios.get(apiUrl, {
          params: { acc_no, lenghtleft },
          headers: { Authorization: `Bearer ${token}` },
        });
        setBalances(Array.isArray(res.data) ? res.data : []);


        console.log('Fetched balances:', balances);
      } catch (error) {
        console.error('Error fetching balances:', error);
        setBalances([]);
      }
      setLoading(false);
    };
    fetchBalances();
  }, [acc_no, lenghtleft, apiIp]);

  // Prepare chart data for balances
  const chartLabels = balances.map(bal => bal.Name_M || bal.Acc_No);
  const chartDataLYD = balances.map(bal => bal.Name_M?.toUpperCase().includes('USD') || bal.Name_M?.toUpperCase().includes('EUR') ? 0 : bal.balance);
  const chartDataCurr = balances.map(bal => (bal.Name_M?.toUpperCase().includes('USD') || bal.Name_M?.toUpperCase().includes('EUR')) ? bal.balance_curr : 0);

  const data = {
    labels: chartLabels,
    datasets: [
      {
        label: 'LYD Balance',
        data: chartDataLYD,
        backgroundColor: 'rgba(56, 142, 60, 0.7)',
      },
      {
        label: 'Currency Balance',
        data: chartDataCurr,
        backgroundColor: 'rgba(25, 118, 210, 0.7)',
      },
    ],
  };
 
 

  return (
    <Box sx={{ flexGrow: 1, color: 'inherit', background: 'inherit', minHeight: '100vh' }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ color: 'primary.main', mb: 3, letterSpacing: 1 }}>
        Dashboard
      </Typography>
      <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ color: '#388e3c', mb: 2, letterSpacing: 1 }}>
        Watches Cash
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {balances.filter(bal => Number(bal.balance) !== 0 || Number(bal.balance_curr) !== 0).map((bal, idx) => (
          <Box key={bal.Acc_No || idx} sx={{ flex: '1 1 320px', minWidth: 300, maxWidth: 400 }}>
            <Card sx={{ boxShadow: 3, borderRadius: 2, background: 'inherit', height: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ display: 'flex', alignItems: 'center', fontWeight: 'bold', color: 'inherit' }}>
                    <WatchLaterIcon sx={{ mr: 1, color: 'inherit' }} />
                    {bal.Acc_No}
                  </span>
                  <span style={{ color: 'inherit', fontSize: 16, fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                    {bal.Name_M || ''}
                  </span>
                </Typography>
                {/* Conditional balance rendering */}
                {bal.Name_M?.toUpperCase().includes('USD') || bal.Name_M?.toUpperCase().includes('EUR') ? (
                  <Typography variant="body1" sx={{ mt: 1, color: 'inherit' }}>
                    Currency Balance:&nbsp;
                    <span style={{ fontWeight: 600, color: 'inherit', display: 'inline-flex', alignItems: 'center' }}>
                      {Number(bal.balance_curr || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                      {bal.Name_M?.toUpperCase().includes('USD') && <AttachMoneyIcon sx={{ ml: 1, fontSize: 20, color: 'inherit' }} />}
                      {bal.Name_M?.toUpperCase().includes('EUR') && <EuroIcon sx={{ ml: 1, fontSize: 20, color: 'inherit' }} />}
                    </span>
                  </Typography>
                ) : (
                  <Typography variant="body1" sx={{ mt: 1, color: 'inherit' }}>
                    LYD Balance:&nbsp;
                    <span style={{ fontWeight: 600, color: 'inherit', display: 'inline-flex', alignItems: 'center' }}>
                      {Number(bal.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                      <WatchLaterIcon sx={{ ml: 1, fontSize: 20, color: 'inherit' }} />
                    </span>
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>
     
    </Box>
  );
}
