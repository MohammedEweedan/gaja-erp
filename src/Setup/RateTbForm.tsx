import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, CircularProgress, Box, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import axios from '../api';

interface RateTbFormProps {
  visible: boolean;
  onClose: () => void;
  editData?: any;
  onSuccess?: () => void;
}

const RateTbForm: React.FC<RateTbFormProps> = ({ visible, onClose, editData, onSuccess }) => {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editData) {
      setName(editData.name || '');
      setValue(editData.value || '');
    } else {
      setName('');
      setValue('');
    }
    setError('');
  }, [editData, visible]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !value) {
      setError('Please fill all fields');
      return;
    }
    setLoading(true);
    setError('');
    // Always send value as 3 decimal digits
    const formattedValue = Number(value).toFixed(3);
    try {
      if (editData) {
        await axios.put(`/rate-tb/${editData._id}`, { name, value: formattedValue });
      } else {
        await axios.post('/rate-tb', { name, value: formattedValue });
      }
      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      setError('Error saving rate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={visible} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{editData ? 'Edit Rate' : 'Add Rate'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <FormControl fullWidth margin="normal" required>
            <InputLabel id="currency-label">Currency</InputLabel>
            <Select
              labelId="currency-label"
              value={name}
              label="Currency"
              onChange={e => setName(e.target.value)}
            >
              <MenuItem value="USD">USD</MenuItem>
              <MenuItem value="EUR">EUR</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Rate Value"
            value={value}
            onChange={e => {
              // Only allow numbers and dot, and format to 3 decimals if possible
              let val = e.target.value;
              // Remove leading zeros
              if (/^0[0-9]/.test(val)) val = val.replace(/^0+/, '');
              // Only allow valid float
              if (/^\d*(\.\d{0,3})?$/.test(val)) {
                setValue(val);
              }
            }}
            onBlur={e => {
              // Format to 3 decimals on blur if not empty
              if (e.target.value) {
                setValue(Number(e.target.value).toFixed(3));
              }
            }}
            type="number"
            fullWidth
            margin="normal"
            required
            inputProps={{ step: '0.001' }}
          />
          {error && <Box color="error.main" mt={1}>{error}</Box>}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" variant="contained" color="primary" disabled={loading}>
            {loading ? <CircularProgress size={22} /> : (editData ? 'Update' : 'Add')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default RateTbForm;
