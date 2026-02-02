import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, CircularProgress, Box } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import axios from '../api';

interface Rate {
  _id: string;
  name: string;
  value: string;
  createdAt?: string;
}

interface RateTbListProps {
  open: boolean;
  onClose: () => void;
  onEdit: (rate: Rate) => void;
  onAdd?: () => void;
}

const RateTbList: React.FC<RateTbListProps> = ({ open, onClose, onEdit, onAdd }) => {
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      fetchRates();
    }
    // eslint-disable-next-line
  }, [open]);

  const fetchRates = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/rate-tb');
      // Map backend fields to frontend fields and sort by date (desc)
      const mapped = (res.data || [])
        .map((item: any) => ({
          _id: item.Id_Ex,
          name: item.currency,
          value: item.rate,
          createdAt: item.date_exchange
        }))
        .sort((a: Rate, b: Rate) => {
          const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return db - da; // newest first
        });
      setRates(mapped);
    } catch (err) {
      setError('Failed to load rates');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box component="span">Rates list</Box>
          {onAdd && (
            <Button
              variant="outlined"
              color="primary"
              onClick={() => {
                onAdd();
              }}
              sx={{ textTransform: 'none' }}
            >
              Add New Rate
            </Button>
          )}
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" my={3}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box color="error.main">{error}</Box>
        ) : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Edit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rates.map((rate) => (
                  <TableRow key={rate._id}>
                    <TableCell>{rate.name}</TableCell>
                    <TableCell>{Number(rate.value).toFixed(3)}</TableCell>
                    <TableCell>{rate.createdAt ? dayjs(rate.createdAt).format('DD-MMM-YYYY') : ''}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => onEdit(rate)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default RateTbList;
