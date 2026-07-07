import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { 
  AppBar, Toolbar, Typography, Button, Box, CssBaseline, 
  ThemeProvider, createTheme, Container, IconButton, Drawer, 
  List, ListItemText, useMediaQuery, ListItemButton, Divider
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import InventoryIcon from '@mui/icons-material/Inventory';
import AssessmentIcon from '@mui/icons-material/Assessment';
import HistoryIcon from '@mui/icons-material/History';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';

import PinPad from './components/PinPad';
import POS from './pages/POS';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import SalesHistory from './pages/SalesHistory';

// Premium Slate Dark Theme with Glowing cyan/blue accents
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#3b82f6', // Electric blue
      contrastText: '#fff',
    },
    secondary: {
      main: '#10b981', // Emerald green
    },
    error: {
      main: '#ef4444', // Crimson
    },
    warning: {
      main: '#f59e0b', // Amber
    },
    background: {
      default: '#070b13', // Deep slate dark
      paper: '#0f172a',   // Card slate dark
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
    },
  },
  typography: {
    fontFamily: '"Outfit", "Inter", "sans-serif"',
    h4: {
      fontWeight: 800,
      letterSpacing: '-0.02em',
    },
    h5: {
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    button: {
      fontWeight: 700,
      textTransform: 'none',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '10px 20px',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 20px rgba(59, 130, 246, 0.25)',
          },
          '&:active': {
            transform: 'translateY(1px)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundImage: 'none',
          backgroundColor: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          padding: '14px 16px',
        },
        head: {
          backgroundColor: '#1e293b',
          fontWeight: 700,
          color: '#f8fafc',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.08)',
            },
            '&:hover fieldset': {
              borderColor: '#3b82f6',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#3b82f6',
              boxShadow: '0 0 10px rgba(59, 130, 246, 0.15)',
            },
          },
        },
      },
    },
  },
});

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const empName = localStorage.getItem('employee_name') || 'พนักงาน';
  const empRole = localStorage.getItem('employee_role') || 'cashier';
  const isAdmin = empRole === 'admin';

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('employee_name');
    localStorage.removeItem('employee_role');
    localStorage.removeItem('employee_id');
    navigate('/login');
  };

  const navItems = [
    { label: 'คิดเงิน (POS)', path: '/pos', icon: <PointOfSaleIcon />, roles: ['cashier', 'admin'] },
    { label: 'รายงาน (Dashboard)', path: '/dashboard', icon: <AssessmentIcon />, roles: ['admin'] },
    { label: 'คลังสินค้า (Inventory)', path: '/inventory', icon: <InventoryIcon />, roles: ['admin'] },
    { label: 'ประวัติขาย & คืน (History)', path: '/history', icon: <HistoryIcon />, roles: ['admin', 'cashier'] },
  ];

  const visibleNavItems = navItems.filter(item => item.roles.includes(empRole));

  const drawer = (
    <Box onClick={() => setMobileOpen(false)} sx={{ textAlign: 'center', pt: 2, height: '100%', bgcolor: '#0b0f19' }}>
      <Typography variant="h6" sx={{ my: 2, fontWeight: 800, color: '#3b82f6', letterSpacing: '0.05em' }}>
        ⚡ GROCERY POS
      </Typography>
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
      <List>
        {visibleNavItems.map((item) => (
          <ListItemButton key={item.label} component={Link} to={item.path} sx={{ py: 1.5 }}>
            <Box sx={{ mr: 2, display: 'flex', color: location.pathname === item.path ? '#3b82f6' : '#94a3b8' }}>{item.icon}</Box>
            <ListItemText primary={<strong>{item.label}</strong>} />
          </ListItemButton>
        ))}
        <Divider sx={{ my: 2, borderColor: 'rgba(255, 255, 255, 0.08)' }} />
        <ListItemButton onClick={handleLogout} sx={{ py: 1.5 }}>
          <Box sx={{ mr: 2, display: 'flex', color: '#ef4444' }}><ExitToAppIcon /></Box>
          <ListItemText primary={<strong style={{ color: '#ef4444' }}>ออกจากระบบ</strong>} />
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#070b13' }}>
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)', bgcolor: '#0f172a' }}>
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          <PointOfSaleIcon sx={{ mr: 1.5, display: { xs: 'none', md: 'flex' }, color: '#3b82f6' }} />
          <Typography
            variant="h6"
            noWrap
            component={Link}
            to="/pos"
            sx={{
              mr: 4,
              display: 'flex',
              fontFamily: 'Outfit',
              fontWeight: 900,
              letterSpacing: '.05rem',
              color: '#fff',
              textDecoration: 'none',
              flexGrow: { xs: 1, md: 0 }
            }}
          >
            ⚡ GROCERY POS
          </Typography>

          {!isMobile && (
            <Box sx={{ flexGrow: 1, display: 'flex', gap: 1.5 }}>
              {visibleNavItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Button
                    key={item.label}
                    component={Link}
                    to={item.path}
                    startIcon={item.icon}
                    color="inherit"
                    sx={{
                      py: 1,
                      px: 2.5,
                      borderRadius: '10px',
                      opacity: isActive ? 1 : 0.7,
                      color: isActive ? '#3b82f6' : '#94a3b8',
                      bgcolor: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                      border: isActive ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid transparent',
                      '&:hover': { 
                        bgcolor: isActive ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                        color: isActive ? '#3b82f6' : '#fff'
                      }
                    }}
                  >
                    {item.label.split(' ')[0]}
                  </Button>
                );
              })}
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
            <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#fff' }}>
                {empName}
              </Typography>
              <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 600 }}>
                {isAdmin ? '🛡️ ผู้จัดการ (Admin)' : '👤 พนักงาน (Cashier)'}
              </Typography>
            </Box>
            {!isMobile && (
              <IconButton color="inherit" onClick={handleLogout} title="ออกจากระบบ" sx={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 2 }}>
                <ExitToAppIcon color="error" />
              </IconButton>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 250, borderRight: '1px solid rgba(255, 255, 255, 0.08)' },
        }}
      >
        {drawer}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, bgcolor: '#070b13', py: 3 }}>
        <Container maxWidth="xl">{children}</Container>
      </Box>
    </Box>
  );
};

const PrivateRoute: React.FC<{ children: React.ReactNode, adminOnly?: boolean }> = ({ children, adminOnly = false }) => {
  const token = localStorage.getItem('access_token');
  const role = localStorage.getItem('employee_role');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && role !== 'admin') {
    return <Navigate to="/pos" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
};

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route 
            path="/login" 
            element={
              localStorage.getItem('access_token') ? (
                <Navigate to="/pos" replace />
              ) : (
                <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#070b13' }}>
                  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
                  <PinPad onLoginSuccess={() => window.location.href = '#/pos'} />
                </Box>
              )
            } 
          />

          <Route 
            path="/pos" 
            element={
              <PrivateRoute>
                <POS />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <PrivateRoute adminOnly>
                <Dashboard />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/inventory" 
            element={
              <PrivateRoute adminOnly>
                <Inventory />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/history" 
            element={
              <PrivateRoute>
                <SalesHistory />
              </PrivateRoute>
            } 
          />

          <Route path="*" element={<Navigate to="/pos" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
};

export default App;
