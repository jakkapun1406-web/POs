import React, { useState, useEffect } from 'react';
import { 
  Box, Grid, Paper, Typography, Card, CardContent, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Button, Alert, Tab, Tabs
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
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
      // Summary
      const summaryRes = await api.get('/reports/summary', {
        params: { start_date: startDate, end_date: endDate }
      });
      setSummary(summaryRes.data);

      // Best Sellers
      const bestRes = await api.get('/reports/items/best', { params: { limit: 10 } });
      setBestSellers(bestRes.data);

      // Worst Sellers
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
    const url = `${api.defaults.baseURL}/reports/export?start_date=${startDate}&end_date=${endDate}`;
    // Access with Bearer token is tricky with standard anchor download, 
    // so we can fetch it via api client as blob and then save it!
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
        <Alert severity="error">
          <Typography variant="h6">เข้าถึงข้อมูลไม่ได้ (Permission Denied)</Typography>
          คุณไม่มีสิทธิ์เข้าถึงหน้าแดชบอร์ดสรุปยอดขาย หน้านี้จำกัดเฉพาะผู้จัดการหรือแอดมินเท่านั้น
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 3 }}>
        แดชบอร์ดรายงานยอดขาย (ADMIN SUMMARY)
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Date filter row */}
      <Paper elevation={3} sx={{ p: 2, mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
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
        <Button variant="contained" color="primary" onClick={loadReportData}>
          กรองรายงาน
        </Button>
        <Button variant="outlined" color="success" onClick={handleExportCSV}>
          ส่งออกรายงาน (CSV)
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" color="error" onClick={handleManualOpenDrawer}>
          สั่งเปิดลิ้นชักเก็บเงินสด
        </Button>
      </Paper>

      {/* Stats Cards Grid */}
      {summary && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {/* Card 1: Revenue */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card sx={{ bgcolor: '#e3f2fd', borderLeft: '5px solid #1976d2' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" variant="subtitle2">ยอดขายรวม / Total Sales</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 1 }}>
                    ฿{summary.total_sales.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
                <TrendingUpIcon sx={{ fontSize: 50, color: '#1976d2' }} />
              </CardContent>
            </Card>
          </Grid>

          {/* Card 2: Profit */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card sx={{ bgcolor: '#e8f5e9', borderLeft: '5px solid #2e7d32' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" variant="subtitle2">กำไรขั้นต้นแนะนำ / Gross Profit</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 1 }}>
                    ฿{summary.total_profit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
                <AttachMoneyIcon sx={{ fontSize: 50, color: '#2e7d32' }} />
              </CardContent>
            </Card>
          </Grid>

          {/* Card 3: Bill count */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card sx={{ bgcolor: '#fffde7', borderLeft: '5px solid #fbc02d' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" variant="subtitle2">จำนวนบิลคิดเงิน / Transaction Count</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 1 }}>
                    {summary.bill_count} บิล
                  </Typography>
                </Box>
                <ReceiptIcon sx={{ fontSize: 50, color: '#fbc02d' }} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Payment breakdown detail */}
      {summary && (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper elevation={3} sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: '#424242' }}>
                ช่องทางชำระ: เงินสด (CASH)
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#616161' }}>
                ฿{summary.payment_breakdown.cash.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper elevation={3} sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: '#0288d1' }}>
                ช่องทางชำระ: QR Code (PromptPay)
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#0288d1' }}>
                ฿{summary.payment_breakdown.qr.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper elevation={3} sx={{ p: 3, textAlign: 'center', border: '1px solid #c8e6c9', bgcolor: '#f1f8e9' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: '#2e7d32' }}>
                ช่องทางชำระ: สวัสดิการรัฐ (คนละครึ่ง)
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                ฿{summary.payment_breakdown.govt_welfare.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Best vs Worst Sellers Section */}
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
        วิเคราะห์รายการสินค้า (PRODUCT METRICS)
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val)}>
          <Tab label="สินค้าขายดี 10 อันดับแรก (Top Sellers)" />
          <Tab label="สินค้าค้างคลัง / ขายไม่ออก (Worst Sellers)" />
        </Tabs>
      </Box>

      {/* Tab 1: Top Sellers */}
      {activeTab === 0 && (
        <TableContainer component={Paper} elevation={3}>
          <Table>
            <TableHead sx={{ bgcolor: '#f5f5f5' }}>
              <TableRow>
                <TableCell><strong>รหัสสินค้า / Barcode</strong></TableCell>
                <TableCell><strong>ชื่อสินค้า / Product Name</strong></TableCell>
                <TableCell align="center"><strong>จำนวนที่ขายได้ / Qty Sold</strong></TableCell>
                <TableCell align="right"><strong>ยอดขายสะสม / Revenue</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bestSellers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">ไม่มีข้อมูลการเคลื่อนไหวในช่วงเวลานี้</TableCell>
                </TableRow>
              ) : (
                bestSellers.map((item, index) => (
                  <TableRow key={index} sx={{ '&:hover': { bgcolor: '#fafafa' } }}>
                    <TableCell>{item.barcode}</TableCell>
                    <TableCell><strong>{item.name}</strong></TableCell>
                    <TableCell align="center">{item.total_qty} ชิ้น</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
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
        <TableContainer component={Paper} elevation={3}>
          <Table>
            <TableHead sx={{ bgcolor: '#f5f5f5' }}>
              <TableRow>
                <TableCell><strong>รหัสสินค้า / Barcode</strong></TableCell>
                <TableCell><strong>ชื่อสินค้า / Product Name</strong></TableCell>
                <TableCell align="center"><strong>จำนวนยอดขาย / Sales</strong></TableCell>
                <TableCell align="center"><strong>สต็อกคงเหลือปัจจุบัน / Stock</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {worstSellers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">ไม่มีสินค้าคงเหลือค้างคลัง</TableCell>
                </TableRow>
              ) : (
                worstSellers.map((item, index) => (
                  <TableRow key={index} sx={{ '&:hover': { bgcolor: '#fafafa' } }}>
                    <TableCell>{item.barcode}</TableCell>
                    <TableCell><strong>{item.name}</strong></TableCell>
                    <TableCell align="center" sx={{ color: '#d32f2f' }}>
                      {item.total_qty} ชิ้น
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>
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
