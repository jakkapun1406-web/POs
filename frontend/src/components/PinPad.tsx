import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Paper, Grid, MenuItem, Select, FormControl, InputLabel, Alert, Divider } from '@mui/material';
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
        minHeight: '100vh',
        bgcolor: '#090d16',
        background: 'radial-gradient(circle at 50% 50%, #1e293b 0%, #090d16 100%)',
        p: 2,
      }}
    >
      <Paper
        elevation={24}
        sx={{
          p: 4,
          width: '100%',
          maxWidth: 400,
          borderRadius: 5,
          textAlign: 'center',
          bgcolor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
        }}
      >
        <Typography 
          variant="h4" 
          sx={{ 
            fontWeight: 900, 
            mb: 1.5, 
            fontFamily: 'Outfit',
            background: 'linear-gradient(45deg, #60a5fa 30%, #3b82f6 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 15px rgba(59, 130, 246, 0.2)'
          }}
        >
          ⚡ GROCERY POS
        </Typography>

        <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3.5, fontWeight: 'medium' }}>
          ระบบขายสินค้าหน้าร้าน / Grocery Store POS
        </Typography>

        {error && (
          <Alert 
            severity="error" 
            variant="filled"
            sx={{ 
              mb: 2.5, 
              textAlign: 'left', 
              borderRadius: 2, 
              bgcolor: 'rgba(239, 68, 68, 0.15)', 
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              '& .MuiAlert-icon': { color: '#f87171' }
            }}
          >
            {error}
          </Alert>
        )}

        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel id="employee-select-label" sx={{ color: '#64748b', '&.Mui-focused': { color: '#3b82f6' } }}>เลือกพนักงาน / Cashier</InputLabel>
          <Select
            labelId="employee-select-label"
            value={selectedEmpId}
            label="เลือกพนักงาน / Cashier"
            onChange={(e) => setSelectedEmpId(e.target.value as number)}
            sx={{ 
              borderRadius: 3,
              color: '#fff',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.1)' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.2)' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6' },
              '& .MuiSvgIcon-root': { color: '#64748b' }
            }}
          >
            {employees.map((emp) => (
              <MenuItem key={emp.id} value={emp.id}>
                {emp.name} ({emp.role === 'admin' ? 'ผู้จัดการแอดมิน' : 'พนักงานแคชเชียร์'})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* PIN Dot Display */}
        <Box
          sx={{
            mb: 3,
            p: 2,
            bgcolor: '#020617',
            borderRadius: 3,
            minHeight: 65,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            border: '1px solid rgba(59, 130, 246, 0.15)',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8)'
          }}
        >
          <Typography 
            variant="h4" 
            sx={{ 
              letterSpacing: pin ? 10 : 2, 
              fontFamily: 'monospace', 
              fontWeight: 900, 
              color: pin ? '#60a5fa' : '#475569',
              textShadow: pin ? '0 0 10px rgba(96, 165, 250, 0.5)' : 'none'
            }}
          >
            {pin ? '•'.repeat(pin.length) : 'ใส่รหัส PIN'}
          </Typography>
        </Box>

        {/* Keypad Grid */}
        <Grid container spacing={1.5} sx={{ mb: 3.5 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <Grid size={4} key={num}>
              <Button
                fullWidth
                onClick={() => handleNumberClick(num)}
                sx={{
                  py: 1.8,
                  fontSize: '1.6rem',
                  fontWeight: 800,
                  borderRadius: 3,
                  bgcolor: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  color: '#e2e8f0',
                  fontFamily: 'Outfit',
                  '&:hover': {
                    bgcolor: 'rgba(59, 130, 246, 0.1)',
                    borderColor: '#3b82f6',
                    color: '#fff',
                    transform: 'scale(1.02)'
                  },
                  '&:active': { transform: 'scale(0.98)' },
                  transition: 'all 0.15s ease'
                }}
              >
                {num}
              </Button>
            </Grid>
          ))}
          <Grid size={4}>
            <Button
              fullWidth
              onClick={handleClear}
              sx={{ 
                py: 1.8, 
                fontSize: '1.3rem', 
                fontWeight: 900, 
                borderRadius: 3, 
                bgcolor: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                fontFamily: 'Outfit',
                '&:hover': {
                  bgcolor: 'rgba(239, 68, 68, 0.15)',
                  borderColor: '#ef4444',
                  color: '#fff',
                  transform: 'scale(1.02)'
                },
                '&:active': { transform: 'scale(0.98)' },
                transition: 'all 0.15s ease'
              }}
            >
              C
            </Button>
          </Grid>
          <Grid size={4}>
            <Button
              fullWidth
              onClick={() => handleNumberClick('0')}
              sx={{
                py: 1.8,
                fontSize: '1.6rem',
                fontWeight: 800,
                borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                color: '#e2e8f0',
                fontFamily: 'Outfit',
                '&:hover': {
                  bgcolor: 'rgba(59, 130, 246, 0.1)',
                  borderColor: '#3b82f6',
                  color: '#fff',
                  transform: 'scale(1.02)'
                },
                '&:active': { transform: 'scale(0.98)' },
                transition: 'all 0.15s ease'
              }}
            >
              0
            </Button>
          </Grid>
          <Grid size={4}>
            <Button
              fullWidth
              onClick={handleBackspace}
              sx={{ 
                py: 1.8, 
                fontSize: '1.3rem', 
                fontWeight: 900, 
                borderRadius: 3, 
                bgcolor: 'rgba(245, 158, 11, 0.05)',
                border: '1px solid rgba(245, 158, 11, 0.15)',
                color: '#fbbf24',
                fontFamily: 'Outfit',
                '&:hover': {
                  bgcolor: 'rgba(245, 158, 11, 0.15)',
                  borderColor: '#f59e0b',
                  color: '#fff',
                  transform: 'scale(1.02)'
                },
                '&:active': { transform: 'scale(0.98)' },
                transition: 'all 0.15s ease'
              }}
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
            fontSize: '1.15rem',
            borderRadius: 3.5,
            fontWeight: 900,
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            boxShadow: '0px 6px 20px rgba(37, 99, 235, 0.25)',
            textTransform: 'uppercase',
            letterSpacing: 1,
            '&:hover': {
              background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
              boxShadow: '0px 8px 25px rgba(37, 99, 235, 0.4)',
              transform: 'scale(1.01)'
            },
            '&:active': { transform: 'scale(0.99)' },
            transition: 'all 0.15s ease'
          }}
        >
          เข้าสู่ระบบ (LOGIN)
        </Button>
      </Paper>
    </Box>
  );
};

export default PinPad;
