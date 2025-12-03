import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Tabs, Tab, Paper, useTheme, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack } from '@mui/material';
import { useThemeContext } from '../../theme/ThemeProvider';
import CalendarLogScreen from '../../components/LeaveManagement/CalendarLogScreen';
import LeaveStatusScreen from '../../components/LeaveManagement/LeaveStatusScreen';
import LeaveRequestScreen from '../../components/LeaveManagement/LeaveRequestScreen';
import LeaveBalanceScreen from '../../components/LeaveManagement/LeaveBalanceScreen';
import LeaveCodesManagement from '../../components/LeaveManagement/LeaveCodesManagement';
import { Settings as SettingsIcon, Close as CloseIcon } from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`leave-tabpanel-${index}`}
      aria-labelledby={`leave-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `leave-tab-${index}`,
    'aria-controls': `leave-tabpanel-${index}`,
  };
}

const LeaveManagementScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { mode } = useThemeContext();
  const [value, setValue] = useState(0);
  const [codesOpen, setCodesOpen] = useState(false);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box 
      sx={{ 
        width: '100%',
        bgcolor: 'background.default',
        color: 'text.primary',
        minHeight: '100vh',
        p: 2
      }}
    >
      <Paper
        elevation={3}
        sx={{
          mb: 2,
          bgcolor: 'background.paper',
          borderRadius: 2,
          overflow: 'hidden',
          px: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Tabs
            value={value}
            onChange={handleChange}
            aria-label="leave management tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label={t('leave.tabs.calendar')} {...a11yProps(0)} />
            <Tab label={t('leave.tabs.status')} {...a11yProps(1)} />
            <Tab label={t('leave.tabs.request')} {...a11yProps(2)} />
            <Tab label={t('leave.tabs.balance')} {...a11yProps(3)} />
          </Tabs>
          <Tooltip title={t('codes.title', 'Codes Management') as string}>
            <IconButton color="primary" onClick={() => setCodesOpen(true)} aria-label="open-codes-settings">
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      <TabPanel value={value} index={0}>
        <CalendarLogScreen />
      </TabPanel>
      <TabPanel value={value} index={1}>
        <LeaveStatusScreen />
      </TabPanel>
      <TabPanel value={value} index={2}>
        <LeaveRequestScreen />
      </TabPanel>
      <TabPanel value={value} index={3}>
        <LeaveBalanceScreen />
      </TabPanel>

      {/* Codes Management dialog */}
      <Dialog open={codesOpen} onClose={() => setCodesOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle sx={{ pb: 0 }}>{t('codes.title', 'Codes Management')}</DialogTitle>
        <DialogContent dividers sx={{ pt: 1.5 }}>
          <LeaveCodesManagement />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCodesOpen(false)} startIcon={<CloseIcon />}>{t('common.close', 'Close')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LeaveManagementScreen;
