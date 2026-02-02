import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import axios from "../../api";
import WatchLaterIcon from '@mui/icons-material/WatchLater';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import EuroIcon from '@mui/icons-material/Euro';

type BalanceItem = {
  Acc_No: string;
  balance: number;
  balance_curr: number;
  Name_M?: string;
  coa?: { Acc_No: string; Name_M: string };
};

export default function Dashboard() {
  const apiIp = process.env.REACT_APP_API_IP;
  const theme = useTheme();
  const { t } = useTranslation();

  // Accent color: gold in dark mode, navy in light mode.
  // Prefer theme.palette.gaja when available, fallback to hex.
  const gaja = (theme.palette as any)?.gaja as Record<string, string> | undefined;
  const accent = theme.palette.mode === 'dark'
    ? (gaja?.[100] ?? '#b7a27d')
    : (gaja?.[50] ?? '#334d68');

  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const acc_no = '110101';
  const lenghtleft = 6;

  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const token = localStorage.getItem('token') || '';
        const apiUrl = `${apiIp}/Gls/BlancesCash`;
        const res = await axios.get(apiUrl, {
          params: { acc_no, lenghtleft },
          headers: { Authorization: `Bearer ${token}` },
        });
        setBalances(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error('Error fetching balances:', error);
        setBalances([]);
      }
    };
    fetchBalances();
  }, [acc_no, lenghtleft, apiIp]);

  // Chart data preparation can be uncommented when needed
  // const chartLabels = balances.map(bal => bal.Name_M || bal.Acc_No);
  // const chartDataLYD = balances.map(bal => 
  //   bal.Name_M?.toUpperCase().includes('USD') || bal.Name_M?.toUpperCase().includes('EUR') ? 0 : bal.balance
  // );
  // const chartDataCurr = balances.map(bal => 
  //   (bal.Name_M?.toUpperCase().includes('USD') || bal.Name_M?.toUpperCase().includes('EUR')) ? bal.balance_curr : 0
  // );

  return (
    <Box sx={{ 
      flexGrow: 1, 
      color: accent, 
      p: 3
    }}>
      {/* Analytics KPIs and charts */}
      
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mt: 3 }}>
        {balances.filter(bal => Number(bal.balance) !== 0 || Number(bal.balance_curr) !== 0).map((bal, idx) => (
          <Box key={bal.Acc_No || idx} sx={{ flex: '1 1 320px', minWidth: 300, maxWidth: 400 }}>
            <Card sx={{ 
              boxShadow: 3, 
              borderRadius: 2, 
              backgroundColor: 'background.paper',
              height: '100%',
              transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 6,
                borderColor: accent,
              }
            }}>
              <CardContent>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 'bold', 
                    color: accent, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'flex-start',
                    mb: 2
                  }}
                >
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    color: accent,
                    mb: 1
                  }}>
                    <WatchLaterIcon sx={{ mr: 1, color: 'inherit' }} />
                    {bal.Acc_No}
                  </Box>
                  <Box sx={{ 
                    color: accent, 
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    display: 'flex', 
                    alignItems: 'center' 
                  }}>
                    {bal.Name_M || ''}
                  </Box>
                </Typography>
                {/* Conditional balance rendering */}
                {bal.Name_M?.toUpperCase().includes('USD') || bal.Name_M?.toUpperCase().includes('EUR') ? (
                  <Typography variant="body1" sx={{ mt: 2, color: accent }}>
                    {t('dashboard.currencyBalance')}:&nbsp;
                    <Box component="span" sx={{ 
                      fontWeight: 600, 
                      color: accent,
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}>
                      {Number(bal.balance_curr || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                      {bal.Name_M?.toUpperCase().includes('USD') && <AttachMoneyIcon sx={{ ml: 1, fontSize: 20, color: 'inherit' }} />}
                      {bal.Name_M?.toUpperCase().includes('EUR') && <EuroIcon sx={{ ml: 1, fontSize: 20, color: 'inherit' }} />}
                    </Box>
                  </Typography>
                ) : (
                  <Typography variant="body1" sx={{ mt: 1, color: accent }}>
                    {t('dashboard.lydBalance')}:&nbsp;
                    <Box component="span" sx={{ 
                      fontWeight: 600, 
                      color: accent,
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}>
                      {Number(bal.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                      <WatchLaterIcon sx={{ ml: 1, fontSize: 20, color: 'inherit' }} />
                    </Box>
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
