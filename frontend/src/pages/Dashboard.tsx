import React, { useState, useEffect } from 'react';
import { 
  Box, Grid, Paper, Typography, Card, CardContent, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Button, Alert, Tab, Tabs
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ReceiptIcon from '@mui/icons-material/Receipt';
import api from '../services/api';

interface SummaryData {
  total_sales: number;
  total_profit: number;
  bill_count: number;
  payment_breakdown: {
    cash: number;
    qr: number;
    govt_welfare: number;
  };
}

interface BestSeller {
  product_id: number | null;
  barcode: string;
  name: string;
  total_qty: number;
  total_revenue: number;
}

interface WorstSeller {
  product_id: number;
  barcode: string;
  name: string;
  total_qty: number;
  total_revenue: number;
  current_stock: number;
  base_unit: string;
}

const Dashboard: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState<boolean>(true);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [bestSellers, setBestSellers] = useState<BestSeller[]>([]);
  const [worstSellers, setWorstSellers] = useState<WorstSeller[]>([]);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const role = localStorage.getItem('employee_role');
    if (role !== 'admin') {
      setIsAdmin(false);
      return;
    }
    loadReportData();
  }, []);

  const loadReportData = async () => {
    try {
      setError('');
      const summaryRes = await api.get('/reports/summary', {
        params: { start_date: startDate, end_date: endDate }
      });
      setSummary(summaryRes.data);

      const bestRes = await api.get('/reports/items/best', { params: { limit: 10 } });
      setBestSellers(bestRes.data);

      const worstRes = await api.get('/reports/items/worst', { params: { limit: 10 } });
      setWorstSellers(worstRes.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการโหลดข้อมูลสถิติ');
    }
  };

  const handleManualOpenDrawer = async () => {
    try {
      await api.post('/sales/kick-drawer');
      alert('สั่งเปิดลิ้นชักสำเร็จ');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'ไม่สามารถเปิดลิ้นชักได้');
    }
  };

  const handleExportCSV = () => {
    api.get('/reports/export', {
      params: { start_date: startDate, end_date: endDate },
      responseType: 'blob'
    })
    .then((res) => {
      const blob = new Blob([res.data], { type: 'text/csv' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `sales_report_${startDate}_to_${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    })
    .catch((err) => {
      console.error(err);
      setError('ส่งออกข้อมูลรายงาน CSV ล้มเหลว');
    });
  };

  if (!isAdmin) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>เข้าถึงข้อมูลไม่ได้ (Permission Denied)</Typography>
          คุณไม่มีสิทธิ์เข้าถึงหน้าแดชบอร์ดสรุปยอดขาย หน้านี้จำกัดเฉพาะผู้จัดการหรือแอดมินเท่านั้น
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 900, mb: 4, letterSpacing: '-0.02em', color: '#fff' }}>
        รายงานวิเคราะห์ยอดขาย (ADMIN ANALYTICS)
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{error}</Alert>}

      {/* Date filter toolbar */}
      <Paper elevation={0} sx={{ p: 3, mb: 4, display: 'flex', flexWrap: 'wrap', gap: 2.5, alignItems: 'center', bgcolor: '#0f172a' }}>
        <TextField
          label="วันที่เริ่มต้น"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          size="small"
        />
        <TextField
          label="วันที่สิ้นสุด"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          size="small"
        />
        <Button variant="contained" color="primary" onClick={loadReportData} sx={{ px: 3 }}>
          กรองรายงาน
        </Button>
        <Button variant="outlined" color="success" onClick={handleExportCSV} sx={{ px: 3 }}>
          ส่งออก CSV
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" color="error" onClick={handleManualOpenDrawer} sx={{ px: 3 }}>
          เปิดลิ้นชักเก็บเงินสด
        </Button>
      </Paper>

      {/* Gradient Stats Cards */}
      {summary && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Revenue */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
              color: '#fff',
              boxShadow: '0 10px 25px rgba(59, 130, 246, 0.2)'
            }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3 }}>
                <Box>
                  <Typography sx={{ opacity: 0.8, fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>ยอดขายรวม / Revenue</Typography>
                  <Typography variant="h3" sx={{ fontWeight: 900, mt: 1.5, fontFamily: 'Outfit' }}>
                    ฿{summary.total_sales.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
                <TrendingUpIcon sx={{ fontSize: 55, opacity: 0.25 }} />
              </CardContent>
            </Card>
          </Grid>

          {/* Profit */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)',
              color: '#fff',
              boxShadow: '0 10px 25px rgba(16, 185, 129, 0.2)'
            }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3 }}>
                <Box>
                  <Typography sx={{ opacity: 0.8, fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>กำไรขั้นต้นแนะนำ / Margin</Typography>
                  <Typography variant="h3" sx={{ fontWeight: 900, mt: 1.5, fontFamily: 'Outfit' }}>
                    ฿{summary.total_profit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
                <AttachMoneyIcon sx={{ fontSize: 55, opacity: 0.25 }} />
              </CardContent>
            </Card>
          </Grid>

          {/* Transactions */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #78350f 0%, #d97706 100%)',
              color: '#fff',
              boxShadow: '0 10px 25px rgba(217, 119, 6, 0.2)'
            }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3 }}>
                <Box>
                  <Typography sx={{ opacity: 0.8, fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>จำนวนบิล / Bills</Typography>
                  <Typography variant="h3" sx={{ fontWeight: 900, mt: 1.5, fontFamily: 'Outfit' }}>
                    {summary.bill_count}
                  </Typography>
                </Box>
                <ReceiptIcon sx={{ fontSize: 55, opacity: 0.25 }} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Payment breakdown detail */}
      {summary && (
        <Grid container spacing={3} sx={{ mb: 5 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper elevation={0} sx={{ p: 3.5, textAlign: 'center', bgcolor: '#0f172a', borderLeft: '4px solid #94a3b8' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', mb: 1 }}>
                เงินสด (CASH)
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#fff', fontFamily: 'Outfit' }}>
                ฿{summary.payment_breakdown.cash.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper elevation={0} sx={{ p: 3.5, textAlign: 'center', bgcolor: '#0f172a', borderLeft: '4px solid #3b82f6' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#3b82f6', textTransform: 'uppercase', mb: 1 }}>
                สแกน QR Code (PromptPay)
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#3b82f6', fontFamily: 'Outfit' }}>
                ฿{summary.payment_breakdown.qr.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper elevation={0} sx={{ p: 3.5, textAlign: 'center', bgcolor: 'rgba(16,185,129,0.02)', border: '1px solid rgba(16,185,129,0.1)', borderLeft: '4px solid #10b981' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#10b981', textTransform: 'uppercase', mb: 1 }}>
                สวัสดิการรัฐ (คนละครึ่ง)
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#10b981', fontFamily: 'Outfit' }}>
                ฿{summary.payment_breakdown.govt_welfare.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* Tabs list */}
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 3, color: '#fff' }}>
        วิเคราะห์รายการสินค้า (PRODUCT METRICS)
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.06)', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val)} sx={{ '& .MuiTab-root': { fontWeight: 'bold', fontSize: '1rem' } }}>
          <Tab label="สินค้าขายดี 10 อันดับแรก (Top Sellers)" />
          <Tab label="สินค้าค้างคลัง / ขายไม่ออก (Worst Sellers)" />
        </Tabs>
      </Box>

      {/* Tab 1: Top Sellers */}
      {activeTab === 0 && (
        <TableContainer component={Paper} elevation={0} sx={{ bgcolor: '#0f172a' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>รหัสสินค้า / Barcode</TableCell>
                <TableCell>ชื่อสินค้า / Product Name</TableCell>
                <TableCell align="center">จำนวนที่ขายได้ / Qty Sold</TableCell>
                <TableCell align="right">ยอดขายสะสม / Revenue</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bestSellers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 6, color: '#64748b' }}>ไม่มีข้อมูลการเคลื่อนไหวในช่วงเวลานี้</TableCell>
                </TableRow>
              ) : (
                bestSellers.map((item, index) => (
                  <TableRow key={index} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.01)' } }}>
                    <TableCell sx={{ color: '#94a3b8' }}>{item.barcode}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#fff' }}>{item.name}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>{item.total_qty} ชิ้น</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: '#10b981', fontSize: '1.05rem' }}>
                      ฿{item.total_revenue.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Tab 2: Worst Sellers */}
      {activeTab === 1 && (
        <TableContainer component={Paper} elevation={0} sx={{ bgcolor: '#0f172a' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>รหัสสินค้า / Barcode</TableCell>
                <TableCell>ชื่อสินค้า / Product Name</TableCell>
                <TableCell align="center">จำนวนยอดขาย / Sales</TableCell>
                <TableCell align="center">สต็อกคงเหลือปัจจุบัน / Stock</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {worstSellers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 6, color: '#64748b' }}>ไม่มีสินค้าคงเหลือค้างคลัง</TableCell>
                </TableRow>
              ) : (
                worstSellers.map((item, index) => (
                  <TableRow key={index} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.01)' } }}>
                    <TableCell sx={{ color: '#94a3b8' }}>{item.barcode}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#fff' }}>{item.name}</TableCell>
                    <TableCell align="center" sx={{ color: '#ef4444', fontWeight: 700 }}>
                      {item.total_qty} ชิ้น
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: item.current_stock <= 10 ? '#ef4444' : '#fff' }}>
                      {item.current_stock} {item.base_unit}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default Dashboard;
