import React, { useState, useEffect } from 'react';
import { 
  Box, Paper, Typography, TextField, Button, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, Alert, Divider, List, ListItem, ListItemText,
  IconButton, Chip
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';
import PrintIcon from '@mui/icons-material/Print';
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

  const [detailsOpen, setDetailsOpen] = useState<boolean>(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const [returnOpen, setReturnOpen] = useState<boolean>(false);
  const [returnReason, setReturnReason] = useState<string>('');
  const [returnQtys, setReturnQtys] = useState<{ [itemId: number]: number }>({});

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

  const handleReprintReceipt = async () => {
    if (!selectedSale) return;
    try {
      await api.post(`/sales/${selectedSale.id}/reprint`);
      showTimedSuccess('สั่งพิมพ์ใบเสร็จซ้ำไปยังเครื่องพิมพ์แล้ว');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการสั่งพิมพ์ใบเสร็จ');
    }
  };

  const handleOpenReturn = () => {
    if (!selectedSale) return;
    setReturnReason('');
    
    const initialQtys: { [id: number]: number } = {};
    selectedSale.items.forEach(item => {
      initialQtys[item.id] = 0;
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
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 900, mb: 4, letterSpacing: '-0.02em', color: '#fff' }}>
        ตรวจสอบบิลและคืนสินค้า (TRANSACTION LOGS & RETURNS)
      </Typography>

      {success && <Alert severity="success" sx={{ mb: 3, borderRadius: 3 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{error}</Alert>}

      {/* Filter Row */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 4, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', bgcolor: '#0f172a' }}>
        <TextField
          label="🔍 ค้นหาด้วยรหัสใบเสร็จ (Sale No)"
          variant="outlined"
          size="small"
          value={searchNo}
          onChange={(e) => setSearchNo(e.target.value)}
          sx={{ minWidth: 260 }}
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
        <Button variant="contained" color="primary" onClick={loadSalesHistory} sx={{ px: 3 }}>
          ค้นหาบิล
        </Button>
      </Paper>

      {/* Sales List */}
      <TableContainer component={Paper} elevation={0} sx={{ bgcolor: '#0f172a' }}>
        <Table size="medium">
          <TableHead>
            <TableRow>
              <TableCell>เลขที่ใบเสร็จ</TableCell>
              <TableCell>วันเวลาทำรายการ</TableCell>
              <TableCell>พนักงานขาย</TableCell>
              <TableCell align="right">ยอดขายรวม</TableCell>
              <TableCell align="right">ส่วนรัฐช่วย</TableCell>
              <TableCell>การชำระเงิน</TableCell>
              <TableCell align="center">สถานะบิล</TableCell>
              <TableCell align="center">ตรวจสอบ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 8, color: '#64748b' }}>ไม่พบประวัติบิลรายการขายตามช่วงเวลาดังกล่าว</TableCell>
              </TableRow>
            ) : (
              sales.map((sale) => (
                <TableRow key={sale.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.01)' }, bgcolor: sale.status === 'returned' ? 'rgba(239,68,68,0.02)' : 'inherit' }}>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{sale.sale_no}</TableCell>
                  <TableCell sx={{ color: '#94a3b8' }}>{new Date(sale.created_at).toLocaleString('th-TH')}</TableCell>
                  <TableCell sx={{ color: '#94a3b8' }}>{sale.employee?.name || `ID: ${sale.employee_id}`}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#fff' }}>฿{sale.total_amount.toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ color: '#10b981', fontWeight: 600 }}>
                    {sale.discount_govt > 0 ? `-฿${sale.discount_govt.toFixed(2)}` : '฿0.00'}
                  </TableCell>
                  <TableCell sx={{ color: '#94a3b8' }}>{getPaymentLabel(sale.payment_type)}</TableCell>
                  <TableCell align="center">
                    <Chip 
                      label={sale.status === 'completed' ? 'ปกติ (SUCCESS)' : 'คืนสินค้า (RETURNED)'}
                      color={sale.status === 'completed' ? 'success' : 'error'}
                      variant="outlined"
                      size="small"
                      sx={{ fontWeight: 'bold' }}
                    />
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
            <DialogTitle sx={{ fontWeight: 'bold', bgcolor: selectedSale.status === 'returned' ? '#ffebee' : '#1e293b', color: selectedSale.status === 'returned' ? '#000' : '#fff' }}>
              รายละเอียดใบเสร็จ {selectedSale.sale_no}
            </DialogTitle>
            <DialogContent sx={{ pt: 3, bgcolor: '#0f172a' }}>
              <Grid container spacing={2.5} sx={{ mb: 3 }}>
                <Grid size={6}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold' }}>วันเวลาที่ขาย:</Typography>
                  <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold' }}>{new Date(selectedSale.created_at).toLocaleString('th-TH')}</Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold' }}>พนักงานแคชเชียร์:</Typography>
                  <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold' }}>{selectedSale.employee?.name || 'N/A'}</Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold' }}>เครื่อง POS / Terminal:</Typography>
                  <Typography variant="body1" sx={{ color: '#94a3b8' }}>{selectedSale.terminal_id}</Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold' }}>ช่องทางชำระเงิน:</Typography>
                  <Typography variant="body1" sx={{ color: '#94a3b8' }}>{getPaymentLabel(selectedSale.payment_type)}</Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.06)' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, color: '#3b82f6' }}>รายการสินค้าในบิล</Typography>

              {/* Items List */}
              <TableContainer sx={{ maxHeight: 200, mb: 3, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>สินค้า</TableCell>
                      <TableCell align="center">จำนวน</TableCell>
                      <TableCell align="right">ราคา/หน่วย</TableCell>
                      <TableCell align="right">รวม</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedSale.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell><strong style={{ color: '#fff' }}>{item.custom_name || item.product?.name}</strong></TableCell>
                        <TableCell align="center">{item.sold_qty} {item.sold_unit}</TableCell>
                        <TableCell align="right">฿{item.unit_price.toFixed(2)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#fff' }}>฿{item.subtotal.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.06)' }} />

              {/* Financial calculations */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2.5, bgcolor: '#020617', borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ color: '#94a3b8' }}>ยอดขายรวมทั้งหมด:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 800, color: '#fff' }}>฿{selectedSale.total_amount.toFixed(2)}</Typography>
                </Box>
                {selectedSale.discount_govt > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                    <Typography>รัฐช่วยจ่าย (คนละครึ่ง):</Typography>
                    <Typography>-฿{selectedSale.discount_govt.toFixed(2)}</Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ color: '#94a3b8' }}>รับเงินสดมา (ส่วนลูกค้าจ่าย):</Typography>
                  <Typography sx={{ color: '#fff' }}>฿{selectedSale.cash_received.toFixed(2)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', color: '#60a5fa' }}>
                  <Typography><strong>เงินทอน:</strong></Typography>
                  <Typography variant="body1" sx={{ fontWeight: 900 }}>฿{selectedSale.change_due.toFixed(2)}</Typography>
                </Box>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2.5, bgcolor: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
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
              <Button 
                onClick={handleReprintReceipt} 
                variant="contained" 
                color="info" 
                startIcon={<PrintIcon />}
                sx={{ mr: 1.5 }}
              >
                พิมพ์ใบเสร็จซ้ำ (Print)
              </Button>
              <Button onClick={() => setDetailsOpen(false)} variant="outlined">ปิดหน้าจอ</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Dialog: Process Return / Refund */}
      <Dialog open={returnOpen} onClose={() => setReturnOpen(false)} fullWidth maxWidth="xs">
        {selectedSale && (
          <>
            <DialogTitle sx={{ fontWeight: 'bold', color: '#ef4444', bgcolor: '#1e293b', py: 2.5 }}>
              ⚠️ ยืนยันการคืนเงินและคืนสินค้าเข้าสต็อก
            </DialogTitle>
            <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 2.5, bgcolor: '#0f172a' }}>
              <Typography variant="body2" color="textSecondary">
                กรุณาระบุจำนวนสินค้าย่อยที่ต้องการคืน ระบบจะเพิ่มสินค้าคืนคลัง และดีดลิ้นชักอัตโนมัติเพื่อให้พนักงานคืนเงินสดให้ลูกค้า
              </Typography>
              
              <TextField
                label="เหตุผลในการคืนสินค้า"
                fullWidth
                size="small"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
              />

              <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.06)' }} />
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#fff' }}>ระบุจำนวนคืน (หน่วยชิ้นย่อย):</Typography>

              <List sx={{ bgcolor: 'rgba(0,0,0,0.15)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
                {selectedSale.items.map((item) => (
                  <ListItem key={item.id} sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <ListItemText
                      primary={<strong style={{ color: '#fff' }}>{item.custom_name || item.product?.name}</strong>}
                      secondary={`ซื้อไป ${item.qty_in_base_unit} ชิ้น — ฿${item.subtotal.toFixed(2)}`}
                    />
                    <TextField
                      type="number"
                      label="จำนวนที่คืน"
                      size="small"
                      sx={{ width: 100 }}
                      value={returnQtys[item.id] || 0}
                      onChange={(e) => handleReturnQtyChange(item.id, item.qty_in_base_unit, e.target.value)}
                      slotProps={{ htmlInput: { min: 0, max: item.qty_in_base_unit } }}
                    />
                  </ListItem>
                ))}
              </List>

              {/* Display total refund estimate */}
              <Box sx={{ p: 2.5, bgcolor: 'rgba(239,68,68,0.08)', borderRadius: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(239,68,68,0.2)' }}>
                <Typography variant="body2" sx={{ color: '#f87171', fontWeight: 'bold' }}>ยอดเงินสดที่ต้องคืนลูกค้า:</Typography>
                <Typography variant="h5" sx={{ color: '#ef4444', fontWeight: 900, fontFamily: 'Outfit' }}>
                  ฿{Object.entries(returnQtys).reduce((sum, [itemId, qty]) => {
                    const item = selectedSale.items.find(i => i.id === parseInt(itemId));
                    if (!item) return sum;
                    const pricePerBase = item.subtotal / item.qty_in_base_unit;
                    return sum + (pricePerBase * qty);
                  }, 0).toFixed(2)}
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2.5, bgcolor: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <Button onClick={() => setReturnOpen(false)}>ยกเลิก</Button>
              <Button onClick={handleReturnSubmit} variant="contained" color="error" sx={{ px: 3 }}>
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
