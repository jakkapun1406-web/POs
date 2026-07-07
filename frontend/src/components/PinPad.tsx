import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Paper, Grid, MenuItem, Select, FormControl, InputLabel, Alert } from '@mui/material';
import api from '../services/api';

interface Employee {
  id: number;
  name: string;
  role: string;
}

interface PinPadProps {
  onLoginSuccess: (role: string, name: string) => void;
}

const PinPad: React.FC<PinPadProps> = ({ onLoginSuccess }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<number | ''>('');
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Fetch active employees list for dropdown
    api.get('/auth/employees')
      .then((res) => {
        setEmployees(res.data);
        if (res.data.length > 0) {
          setSelectedEmpId(res.data[0].id);
        }
      })
      .catch((err) => {
        console.error('Error fetching employees:', err);
        setError('ไม่สามารถโหลดข้อมูลพนักงานได้');
      });
  }, []);

  const handleNumberClick = (num: string) => {
    if (pin.length < 6) {
      setPin(pin + num);
      setError('');
    }
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  const handleLogin = async () => {
    if (!selectedEmpId) {
      setError('กรุณาเลือกพนักงาน');
      return;
    }
    if (pin.length < 4) {
      setError('กรุณากรอกรหัส PIN อย่างน้อย 4 หลัก');
      return;
    }

    try {
      const response = await api.post('/auth/login', {
        employee_id: selectedEmpId,
        pin: pin,
      });

      const { access_token, role, name, id } = response.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('employee_role', role);
      localStorage.setItem('employee_name', name);
      localStorage.setItem('employee_id', id.toString());
      
      onLoginSuccess(role, name);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'รหัส PIN ไม่ถูกต้อง');
      setPin('');
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '85vh',
        bgcolor: '#f5f5f5',
        p: 2,
      }}
    >
      <Paper
        elevation={6}
        sx={{
          p: 4,
          width: '100%',
          maxWidth: 400,
          borderRadius: 4,
          textAlign: 'center',
          boxShadow: '0px 10px 30px rgba(0, 0, 0, 0.08)',
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3, color: '#1976d2' }}>
          ระบบขายสินค้าหน้าร้าน (POS)
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
            {error}
          </Alert>
        )}

        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel id="employee-select-label">เลือกพนักงาน / Cashier</InputLabel>
          <Select
            labelId="employee-select-label"
            value={selectedEmpId}
            label="เลือกพนักงาน / Cashier"
            onChange={(e) => setSelectedEmpId(e.target.value as number)}
            sx={{ borderRadius: 2 }}
          >
            {employees.map((emp) => (
              <MenuItem key={emp.id} value={emp.id}>
                {emp.name} ({emp.role === 'admin' ? 'แอดมิน' : 'พนักงาน'})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* PIN Dot Display */}
        <Box
          sx={{
            mb: 4,
            p: 2,
            bgcolor: '#e0e0e0',
            borderRadius: 2,
            minHeight: 60,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Typography variant="h4" sx={{ letterSpacing: 8, fontFamily: 'monospace' }}>
            {pin ? '•'.repeat(pin.length) : 'ใส่รหัส PIN'}
          </Typography>
        </Box>

        {/* Keypad Grid */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <Grid size={4} key={num}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => handleNumberClick(num)}
                sx={{
                  py: 2,
                  fontSize: '1.5rem',
                  borderRadius: 2,
                  borderColor: '#bdbdbd',
                  color: '#424242',
                  '&:hover': {
                    bgcolor: '#eeeeee',
                    borderColor: '#1976d2',
                  },
                }}
              >
                {num}
              </Button>
            </Grid>
          ))}
          <Grid size={4}>
            <Button
              fullWidth
              variant="outlined"
              color="error"
              onClick={handleClear}
              sx={{ py: 2, fontSize: '1.25rem', borderRadius: 2 }}
            >
              C
            </Button>
          </Grid>
          <Grid size={4}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => handleNumberClick('0')}
              sx={{
                py: 2,
                fontSize: '1.5rem',
                borderRadius: 2,
                borderColor: '#bdbdbd',
                color: '#424242',
                '&:hover': { bgcolor: '#eeeeee' },
              }}
            >
              0
            </Button>
          </Grid>
          <Grid size={4}>
            <Button
              fullWidth
              variant="outlined"
              onClick={handleBackspace}
              sx={{ py: 2, fontSize: '1.25rem', borderRadius: 2, color: '#616161' }}
            >
              ⌫
            </Button>
          </Grid>
        </Grid>

        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleLogin}
          sx={{
            py: 2,
            fontSize: '1.1rem',
            borderRadius: 2,
            fontWeight: 'bold',
            boxShadow: '0px 4px 10px rgba(25, 118, 210, 0.3)',
          }}
        >
          เข้าสู่ระบบ (LOGIN)
        </Button>
      </Paper>
    </Box>
  );
};

export default PinPad;
