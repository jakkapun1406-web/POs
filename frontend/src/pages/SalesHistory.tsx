import React, { useState, useEffect } from 'react';
import { 
  Box, Paper, Typography, TextField, Button, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, Alert, Divider, List, ListItem, ListItemButton, ListItemText,
  Checkbox, FormControlLabel, IconButton
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';
import api from '../services/api';

interface SaleItem {
  id: number;
  product_id: number | null;
  custom_name: string | null;
  is_pack: boolean;
  sold_qty: number;
  sold_unit: string;
  qty_in_base_unit: number;
  unit_price: number;
  subtotal: number;
  product?: { name: string };
}

interface Sale {
  id: number;
  sale_no: string;
  employee_id: number;
  terminal_id: string;
  total_amount: number;
  discount_govt: number;
  cash_received: number;
  change_due: number;
  payment_type: string;
  status: string;
  created_at: string;
  employee?: { name: string };
  items: SaleItem[];
}

const SalesHistory: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchNo, setSearchNo] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Selected Sale Details popup
  const [detailsOpen, setDetailsOpen] = useState<boolean>(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Return dialog state
  const [returnOpen, setReturnOpen] = useState<boolean>(false);
  const [returnReason, setReturnReason] = useState<string>('');
  const [returnQtys, setReturnQtys] = useState<{ [itemId: number]: number }>({}); // maps sale_item.id -> return qty (base unit)

  useEffect(() => {
    loadSalesHistory();
  }, []);

  const loadSalesHistory = async () => {
    try {
      setError('');
      const params: any = {};
      if (searchNo.trim()) params.sale_no = searchNo.trim();
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await api.get('/sales/history', { params });
      setSales(res.data);
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการโหลดประวัติการขาย');
    }
  };

  const handleOpenDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setDetailsOpen(true);
  };

  const handleOpenReturn = () => {
    if (!selectedSale) return;
    setReturnReason('');
    
    // Initialize return quantities with 0 for all items
    const initialQtys: { [id: number]: number } = {};
    selectedSale.items.forEach(item => {
      initialQtys[item.id] = 0; // default 0 to return
    });
    
    setReturnQtys(initialQtys);
    setReturnOpen(true);
  };

  const handleReturnQtyChange = (itemId: number, maxBaseQty: number, val: string) => {
    const num = parseInt(val) || 0;
    setReturnQtys(prev => ({
      ...prev,
      [itemId]: Math.max(0, Math.min(maxBaseQty, num))
    }));
  };

  const handleReturnSubmit = async () => {
    if (!selectedSale) return;

    // Filter items with return qty > 0
    const itemsToReturn = Object.entries(returnQtys)
      .map(([itemId, qty]) => ({
        sale_item_id: parseInt(itemId),
        qty_returned: qty
      }))
      .filter(item => item.qty_returned > 0);

    if (itemsToReturn.length === 0) {
      alert('กรุณาเลือกจำนวนสินค้าที่ต้องการคืนอย่างน้อย 1 ชิ้น');
      return;
    }

    try {
      const res = await api.post('/sales/return', {
        sale_id: selectedSale.id,
        reason: returnReason.trim(),
        items: itemsToReturn
      });

      setReturnOpen(false);
      setDetailsOpen(false);
      showTimedSuccess(`ทำรายการคืนสินค้าเสร็จสิ้น คืนเงินสดให้ลูกค้า ฿${res.data.refund_amount.toFixed(2)} บาท และลิ้นชักเปิดอัตโนมัติ`);
      loadSalesHistory();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการทำรายการคืนเงิน');
    }
  };

  const showTimedSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 5000);
  };

  const getPaymentLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      cash: 'เงินสด',
      qr: 'สแกน QR Code',
      govt_welfare: 'สวัสดิการรัฐ'
    };
    return labels[type] || type;
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 3 }}>
        ตรวจสอบบิลและคืนสินค้า (TRANSACTION LOGS & RETURNS)
      </Typography>

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Filter Row */}
      <Paper elevation={3} sx={{ p: 2, mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <TextField
          label="ค้นหาด้วยรหัสใบเสร็จ (Sale No)"
          variant="outlined"
          size="small"
          value={searchNo}
          onChange={(e) => setSearchNo(e.target.value)}
          sx={{ minWidth: 220 }}
        />
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
        <Button variant="contained" color="primary" onClick={loadSalesHistory}>
          ค้นหาบิล
        </Button>
      </Paper>

      {/* Sales List */}
      <TableContainer component={Paper} elevation={3}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#f5f5f5' }}>
            <TableRow>
              <TableCell><strong>เลขที่ใบเสร็จ</strong></TableCell>
              <TableCell><strong>วันเวลาทำรายการ</strong></TableCell>
              <TableCell><strong>พนักงานขาย</strong></TableCell>
              <TableCell align="right"><strong>ยอดขายรวม</strong></TableCell>
              <TableCell align="right"><strong>ส่วนรัฐช่วย</strong></TableCell>
              <TableCell><strong>การชำระเงิน</strong></TableCell>
              <TableCell align="center"><strong>สถานะบิล</strong></TableCell>
              <TableCell align="center"><strong>ตรวจสอบ</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6 }}>ไม่พบประวัติบิลรายการขายตามช่วงเวลาดังกล่าว</TableCell>
              </TableRow>
            ) : (
              sales.map((sale) => (
                <TableRow key={sale.id} sx={{ '&:hover': { bgcolor: '#fafafa' }, bgcolor: sale.status === 'returned' ? '#ffebee' : 'inherit' }}>
                  <TableCell><strong>{sale.sale_no}</strong></TableCell>
                  <TableCell>{new Date(sale.created_at).toLocaleString('th-TH')}</TableCell>
                  <TableCell>{sale.employee?.name || `ID: ${sale.employee_id}`}</TableCell>
                  <TableCell align="right">฿{sale.total_amount.toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ color: '#2e7d32' }}>
                    {sale.discount_govt > 0 ? `-฿${sale.discount_govt.toFixed(2)}` : '฿0.00'}
                  </TableCell>
                  <TableCell>{getPaymentLabel(sale.payment_type)}</TableCell>
                  <TableCell align="center">
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 'bold', 
                        color: sale.status === 'completed' ? '#2e7d32' : '#d32f2f',
                        bgcolor: sale.status === 'completed' ? '#e8f5e9' : '#ffebee',
                        py: 0.5, borderRadius: 1
                      }}
                    >
                      {sale.status === 'completed' ? 'ปกติ (SUCCESS)' : 'คืนสินค้าแล้ว (RETURNED)'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton color="primary" onClick={() => handleOpenDetails(sale)}>
                      <VisibilityIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog: Invoice Details */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth>
        {selectedSale && (
          <>
            <DialogTitle sx={{ fontWeight: 'bold', bgcolor: selectedSale.status === 'returned' ? '#ffebee' : '#f5f5f5' }}>
              รายละเอียดใบเสร็จ {selectedSale.sale_no}
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Grid container spacing={1} sx={{ mb: 2 }}>
                <Grid size={6}>
                  <Typography variant="body2" color="textSecondary">เวลาทำรายการ:</Typography>
                  <Typography variant="body1"><strong>{new Date(selectedSale.created_at).toLocaleString('th-TH')}</strong></Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="body2" color="textSecondary">พนักงานแคชเชียร์:</Typography>
                  <Typography variant="body1"><strong>{selectedSale.employee?.name || 'N/A'}</strong></Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="body2" color="textSecondary">เครื่อง POS / Terminal:</Typography>
                  <Typography variant="body1">{selectedSale.terminal_id}</Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="body2" color="textSecondary">ช่องทางชำระเงิน:</Typography>
                  <Typography variant="body1">{getPaymentLabel(selectedSale.payment_type)}</Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>รายการสินค้า</Typography>

              {/* Items List */}
              <TableContainer sx={{ maxHeight: 200, mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>สินค้า</TableCell>
                      <TableCell align="center">จำนวน</TableCell>
                      <TableCell align="right">ราคาต่อหน่วย</TableCell>
                      <TableCell align="right">รวม</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedSale.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell><strong>{item.custom_name || item.product?.name}</strong></TableCell>
                        <TableCell align="center">{item.sold_qty} {item.sold_unit}</TableCell>
                        <TableCell align="right">฿{item.unit_price.toFixed(2)}</TableCell>
                        <TableCell align="right">฿{item.subtotal.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Divider sx={{ my: 2 }} />

              {/* Financial calculations */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 2, bgcolor: '#fafafa', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>ยอดขายรวมทั้งหมด:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>฿{selectedSale.total_amount.toFixed(2)}</Typography>
                </Box>
                {selectedSale.discount_govt > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', color: '#2e7d32' }}>
                    <Typography>รัฐช่วยจ่าย (คนละครึ่ง):</Typography>
                    <Typography>-฿{selectedSale.discount_govt.toFixed(2)}</Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>รับเงินสดมา (เฉพาะส่วนลูกค้าจ่าย):</Typography>
                  <Typography>฿{selectedSale.cash_received.toFixed(2)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', color: '#1565c0' }}>
                  <Typography><strong>เงินทอน:</strong></Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>฿{selectedSale.change_due.toFixed(2)}</Typography>
                </Box>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              {selectedSale.status === 'completed' && (
                <Button 
                  onClick={handleOpenReturn} 
                  variant="contained" 
                  color="error" 
                  startIcon={<SettingsBackupRestoreIcon />}
                  sx={{ mr: 'auto' }}
                >
                  คืนสินค้า (Refund)
                </Button>
              )}
              <Button onClick={() => setDetailsOpen(false)} variant="outlined">ปิดหน้าจอ</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Dialog: Process Return / Refund */}
      <Dialog open={returnOpen} onClose={() => setReturnOpen(false)} fullWidth maxWidth="xs">
        {selectedSale && (
          <>
            <DialogTitle sx={{ fontWeight: 'bold', color: '#d32f2f' }}>
              ยืนยันการคืนเงินและคืนสินค้าเข้าสต็อก
            </DialogTitle>
            <DialogContent sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" color="textSecondary">
                กรุณาระบุจำนวนสินค้าย่อยที่ลูกค้าต้องการนำมาคืน ระบบจะหักยอดเงินคืนอัตโนมัติ และอัปเดตสต็อกให้
              </Typography>
              
              <TextField
                label="เหตุผลในการคืน (เช่น ของชำรุด/เปลี่ยนสินค้า)"
                fullWidth
                size="small"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
              />

              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>จำนวนที่จะคืน (หน่วยย่อยสุด):</Typography>

              <List>
                {selectedSale.items.map((item) => (
                  <ListItem key={item.id} sx={{ p: 1, borderBottom: '1px solid #f5f5f5' }}>
                    <ListItemText
                      primary={<strong>{item.custom_name || item.product?.name}</strong>}
                      secondary={`ซื้อไป ${item.qty_in_base_unit} ชิ้น — ฿${item.subtotal.toFixed(2)}`}
                    />
                    <TextField
                      type="number"
                      label="คืน (ชิ้น)"
                      size="small"
                      sx={{ width: 90 }}
                      value={returnQtys[item.id] || 0}
                      onChange={(e) => handleReturnQtyChange(item.id, item.qty_in_base_unit, e.target.value)}
                      slotProps={{ htmlInput: { min: 0, max: item.qty_in_base_unit } }}
                    />
                  </ListItem>
                ))}
              </List>

              {/* Display total refund estimate */}
              <Box sx={{ p: 2, bgcolor: '#ffebee', borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: '#c62828', fontWeight: 'bold' }}>ประมาณการยอดคืนเงิน:</Typography>
                <Typography variant="h5" sx={{ color: '#c62828', fontWeight: 'bold' }}>
                  ฿{Object.entries(returnQtys).reduce((sum, [itemId, qty]) => {
                    const item = selectedSale.items.find(i => i.id === parseInt(itemId));
                    if (!item) return sum;
                    const pricePerBase = item.subtotal / item.qty_in_base_unit;
                    return sum + (pricePerBase * qty);
                  }, 0).toFixed(2)}
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setReturnOpen(false)}>ยกเลิก</Button>
              <Button onClick={handleReturnSubmit} variant="contained" color="error">
                ยืนยันการคืนเงินสด
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default SalesHistory;
