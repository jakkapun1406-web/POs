import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { 
  AppBar, Toolbar, Typography, Button, Box, CssBaseline, 
  ThemeProvider, createTheme, Container, IconButton, Drawer, 
  List, ListItem, ListItemText, useMediaQuery, ListItemButton, Divider
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

// Premium Theme Design with Outfit font & curated colors
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // vibrant blue
      contrastText: '#fff',
    },
    secondary: {
      main: '#2e7d32', // rich emerald green
    },
    error: {
      main: '#d32f2f',
    },
    background: {
      default: '#f8fafc', // sleek light grey
    },
  },
  typography: {
    fontFamily: '"Outfit", "Roboto", "Helvetica", "Arial", sans-serif',
    button: {
      fontWeight: 'bold',
      textTransform: 'none',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});

// AppLayout wrapper containing navigation header
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
    { label: 'แดชบอร์ด (Dashboard)', path: '/dashboard', icon: <AssessmentIcon />, roles: ['admin'] },
    { label: 'คลังสินค้า (Inventory)', path: '/inventory', icon: <InventoryIcon />, roles: ['admin'] },
    { label: 'ประวัติขาย & คืนเงิน (History)', path: '/history', icon: <HistoryIcon />, roles: ['admin', 'cashier'] },
  ];

  // Filter items based on user role
  const visibleNavItems = navItems.filter(item => item.roles.includes(empRole));

  const drawer = (
    <Box onClick={() => setMobileOpen(false)} sx={{ textAlign: 'center', pt: 2 }}>
      <Typography variant="h6" sx={{ my: 2, fontWeight: 'bold', color: '#1976d2' }}>
        GROCERY POS
      </Typography>
      <Divider />
      <List>
        {visibleNavItems.map((item) => (
          <ListItemButton key={item.label} component={Link} to={item.path}>
            <Box sx={{ mr: 2, display: 'flex', color: '#616161' }}>{item.icon}</Box>
            <ListItemText primary={<strong>{item.label}</strong>} />
          </ListItemButton>
        ))}
        <Divider sx={{ my: 1 }} />
        <ListItemButton onClick={handleLogout}>
          <Box sx={{ mr: 2, display: 'flex', color: '#d32f2f' }}><ExitToAppIcon /></Box>
          <ListItemText primary={<strong style={{ color: '#d32f2f' }}>ออกจากระบบ</strong>} />
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="sticky" elevation={2}>
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

          <PointOfSaleIcon sx={{ mr: 1, display: { xs: 'none', md: 'flex' } }} />
          <Typography
            variant="h6"
            noWrap
            component={Link}
            to="/pos"
            sx={{
              mr: 2,
              display: 'flex',
              fontFamily: 'Outfit',
              fontWeight: 800,
              letterSpacing: '.1rem',
              color: 'inherit',
              textDecoration: 'none',
              flexGrow: { xs: 1, md: 0 }
            }}
          >
            GROCERY POS
          </Typography>

          {!isMobile && (
            <Box sx={{ flexGrow: 1, display: 'flex', gap: 1, ml: 3 }}>
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
                      opacity: isActive ? 1 : 0.8,
                      bgcolor: isActive ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                      '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' }
                    }}
                  >
                    {item.label.split(' ')[0]}
                  </Button>
                );
              })}
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' }, opacity: 0.9 }}>
              พนักงาน: <strong>{empName}</strong> ({isAdmin ? 'แอดมิน' : 'แคชเชียร์'})
            </Typography>
            {!isMobile && (
              <IconButton color="inherit" onClick={handleLogout} title="ออกจากระบบ">
                <ExitToAppIcon />
              </IconButton>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Drawer for Mobile Devices */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 250 },
        }}
      >
        {drawer}
      </Drawer>

      {/* Main Content Area */}
      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default', py: 2 }}>
        <Container maxWidth="xl">{children}</Container>
      </Box>
    </Box>
  );
};

// Route Guard to verify JWT tokens
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
          {/* Public Login Route */}
          <Route 
            path="/login" 
            element={
              localStorage.getItem('access_token') ? (
                <Navigate to="/pos" replace />
              ) : (
                <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                  {/* Google Font Outfit Loader */}
                  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet" />
                  <PinPad onLoginSuccess={(role) => window.location.href = '#/pos'} />
                </Box>
              )
            } 
          />

          {/* Protected Routes */}
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

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/pos" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
};

export default App;
