import React, { useState, useEffect } from 'react';
import { 
  Box, Paper, Typography, Button, TextField, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog, 
  DialogTitle, DialogContent, DialogActions, Grid, Alert, Card, CardContent,
  Chip, Divider
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import api from '../services/api';

interface Product {
  id: number;
  barcode: string;
  name: string;
  category: string;
  cost_price: number;
  sell_price: number;
  pack_sell_price: number | null;
  stock_qty: number;
  base_unit: string;
  pack_unit: string;
  pack_size: number;
  tax_percent: number;
  labor_cost: number;
  market_price_cap: number;
  recommended_price: number;
  warning_price_cap: boolean;
}

const Inventory: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState<boolean>(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Form State
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [barcode, setBarcode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<string>('สินค้าทั่วไป');
  const [costPrice, setCostPrice] = useState<string>('0');
  const [sellPrice, setSellPrice] = useState<string>('0');
  const [packSellPrice, setPackSellPrice] = useState<string>('');
  const [stockQty, setStockQty] = useState<string>('0');
  const [baseUnit, setBaseUnit] = useState<string>('ชิ้น');
  const [packUnit, setPackUnit] = useState<string>('แพ็ค');
  const [packSize, setPackSize] = useState<string>('1');
  const [taxPercent, setTaxPercent] = useState<string>('7.0');
  const [laborCost, setLaborCost] = useState<string>('0');
  const [marketPriceCap, setMarketPriceCap] = useState<string>('0');

  // CSV Import State
  const [importOpen, setImportOpen] = useState<boolean>(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  useEffect(() => {
    const role = localStorage.getItem('employee_role');
    if (role !== 'admin') {
      setIsAdmin(false);
      return;
    }
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const res = await api.get('/products/');
      setProducts(res.data);
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า');
    }
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setBarcode('');
    setName('');
    setCategory('สินค้าทั่วไป');
    setCostPrice('0');
    setSellPrice('0');
    setPackSellPrice('');
    setStockQty('0');
    setBaseUnit('ชิ้น');
    setPackUnit('แพ็ค');
    setPackSize('1');
    setTaxPercent('7.0');
    setLaborCost('0');
    setMarketPriceCap('0');
    setDialogOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingId(p.id);
    setBarcode(p.barcode);
    setName(p.name);
    setCategory(p.category || 'สินค้าทั่วไป');
    setCostPrice(p.cost_price.toString());
    setSellPrice(p.sell_price.toString());
    setPackSellPrice(p.pack_sell_price ? p.pack_sell_price.toString() : '');
    setStockQty(p.stock_qty.toString());
    setBaseUnit(p.base_unit || 'ชิ้น');
    setPackUnit(p.pack_unit || 'แพ็ค');
    setPackSize(p.pack_size.toString());
    setTaxPercent(p.tax_percent.toString());
    setLaborCost(p.labor_cost.toString());
    setMarketPriceCap(p.market_price_cap.toString());
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!barcode.trim() || !name.trim()) {
      setError('กรุณากรอกรหัสบาร์โค้ดและชื่อสินค้า');
      return;
    }

    const payload = {
      barcode: barcode.trim(),
      name: name.trim(),
      category: category.trim(),
      cost_price: parseFloat(costPrice) || 0,
      sell_price: parseFloat(sellPrice) || 0,
      pack_sell_price: packSellPrice.trim() ? parseFloat(packSellPrice) : null,
      stock_qty: parseInt(stockQty) || 0,
      base_unit: baseUnit.trim(),
      pack_unit: packUnit.trim(),
      pack_size: parseInt(packSize) || 1,
      tax_percent: parseFloat(taxPercent) || 0,
      labor_cost: parseFloat(laborCost) || 0,
      market_price_cap: parseFloat(marketPriceCap) || 0
    };

    try {
      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
        showTimedSuccess('แก้ไขข้อมูลสินค้าสำเร็จ');
      } else {
        await api.post('/products/', payload);
        showTimedSuccess('เพิ่มสินค้าใหม่สำเร็จ');
      }
      setDialogOpen(false);
      loadProducts();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('คุณแน่ใจว่าต้องการลบสินค้าชิ้นนี้? การกระทำนี้ไม่สามารถย้อนกลับได้')) return;
    try {
      await api.delete(`/products/${id}`);
      showTimedSuccess('ลบสินค้าสำเร็จ');
      loadProducts();
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการลบสินค้า');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCsvFile(e.target.files[0]);
    }
  };

  const handleImportCSVSubmit = async () => {
    if (!csvFile) return;
    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const res = await api.post('/products/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportOpen(false);
      setCsvFile(null);
      showTimedSuccess(`นำเข้าสำเร็จ! เพิ่มใหม่ ${res.data.imported} รายการ, อัปเดต ${res.data.updated} รายการ`);
      loadProducts();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'นำเข้ารายงาน CSV ล้มเหลว');
    }
  };

  const showTimedSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const costNum = parseFloat(costPrice) || 0;
  const taxNum = parseFloat(taxPercent) || 0;
  const laborNum = parseFloat(laborCost) || 0;
  const capNum = parseFloat(marketPriceCap) || 0;
  const computedRecPrice = costNum + (costNum * (taxNum / 100.0)) + laborNum;
  const isCapExceeded = capNum > 0 && computedRecPrice > capNum;

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.barcode.includes(search) ||
    (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
  );

  if (!isAdmin) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>เข้าถึงข้อมูลไม่ได้ (Permission Denied)</Typography>
          หน้านี้จำกัดเฉพาะผู้จัดการหรือแอดมินเท่านั้น แคชเชียร์ทั่วไปไม่สามารถแก้ไขคลังสินค้าได้
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 900, mb: 4, letterSpacing: '-0.02em', color: '#fff' }}>
        จัดการคลังสินค้าและราคาทุน (INVENTORY CONTROL)
      </Typography>

      {success && <Alert severity="success" sx={{ mb: 3, borderRadius: 3 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{error}</Alert>}

      {/* Control bar */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 4, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', bgcolor: '#0f172a' }}>
        <TextField
          label="🔍 ค้นหาด้วย ชื่อ / บาร์โค้ด / หมวดหมู่สินค้า"
          variant="outlined"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 320 }}
        />
        <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpenAdd} sx={{ px: 3 }}>
          เพิ่มสินค้าใหม่
        </Button>
        <Button variant="outlined" color="info" startIcon={<UploadFileIcon />} onClick={() => setImportOpen(true)} sx={{ px: 3 }}>
          นำเข้าไฟล์ CSV
        </Button>
      </Paper>

      {/* Product List Table */}
      <TableContainer component={Paper} elevation={0} sx={{ bgcolor: '#0f172a' }}>
        <Table size="medium">
          <TableHead>
            <TableRow>
              <TableCell>บาร์โค้ด</TableCell>
              <TableCell>ชื่อสินค้า</TableCell>
              <TableCell>หมวดหมู่</TableCell>
              <TableCell align="right">ราคาทุน</TableCell>
              <TableCell align="right">ราคาขายปลีก</TableCell>
              <TableCell align="right">ราคาขายแพ็ค</TableCell>
              <TableCell align="center">สต็อกคงเหลือ</TableCell>
              <TableCell align="center">ราคาแนะนำ</TableCell>
              <TableCell align="center">การดำเนินการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 8, color: '#64748b' }}>ไม่พบรายการสินค้าที่ระบุ</TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((p) => (
                <TableRow key={p.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.01)' } }}>
                  <TableCell sx={{ color: '#94a3b8', fontFamily: 'monospace' }}>{p.barcode}</TableCell>
                  <TableCell><strong style={{ color: '#fff' }}>{p.name}</strong></TableCell>
                  <TableCell>
                    <Chip label={p.category || 'ทั่วไป'} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: '#94a3b8' }} />
                  </TableCell>
                  <TableCell align="right" sx={{ color: '#94a3b8' }}>฿{p.cost_price.toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#fff' }}>฿{p.sell_price.toFixed(2)} <span style={{ fontSize: '0.8rem', color: '#64748b' }}>/{p.base_unit}</span></TableCell>
                  <TableCell align="right" sx={{ color: '#94a3b8' }}>
                    {p.pack_sell_price ? (
                      <span><strong>฿{p.pack_sell_price.toFixed(2)}</strong> <span style={{ fontSize: '0.8rem', color: '#64748b' }}>/{p.pack_unit} ({p.pack_size})</span></span>
                    ) : (
                      <span style={{ color: '#475569' }}>-</span>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 800, 
                        color: p.stock_qty <= 10 ? '#ef4444' : '#10b981',
                        bgcolor: p.stock_qty <= 10 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                        py: 0.5, px: 1, borderRadius: 1.5, display: 'inline-block'
                      }}
                    >
                      {p.stock_qty} {p.base_unit}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip 
                      label={`฿${p.recommended_price.toFixed(2)}`} 
                      color={p.warning_price_cap ? 'error' : 'default'} 
                      variant={p.warning_price_cap ? 'filled' : 'outlined'}
                      size="small"
                      sx={{ fontWeight: 'bold' }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton color="primary" onClick={() => handleOpenEdit(p)} sx={{ mr: 0.5 }}>
                      <EditIcon />
                    </IconButton>
                    <IconButton color="error" onClick={() => handleDelete(p.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog: Add/Edit Product & Price Calculator */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, bgcolor: '#1e293b', color: '#fff', py: 2.5 }}>
          {editingId ? '📝 แก้ไขข้อมูลสินค้าในคลัง' : '✨ เพิ่มสินค้าใหม่เข้าระบบ'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3, bgcolor: '#0f172a' }}>
          <Grid container spacing={3}>
            {/* General Info */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, color: '#3b82f6' }}>📦 รายละเอียดสินค้าทั่วไป</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <TextField label="รหัสบาร์โค้ด / Barcode" fullWidth value={barcode} onChange={(e) => setBarcode(e.target.value)} />
                <TextField label="ชื่อสินค้า / Product Name" fullWidth value={name} onChange={(e) => setName(e.target.value)} />
                <TextField label="หมวดหมู่ / Category" fullWidth value={category} onChange={(e) => setCategory(e.target.value)} />
                <Grid container spacing={2}>
                  <Grid size={6}>
                    <TextField label="หน่วยย่อย (เช่น ชิ้น, ขวด)" fullWidth value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)} />
                  </Grid>
                  <Grid size={6}>
                    <TextField label="จำนวนในคลังเริ่มต้น" type="number" fullWidth value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
                  </Grid>
                </Grid>
              </Box>
            </Grid>

            {/* Pack configurations */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, color: '#10b981' }}>📦 ข้อมูลหน่วยสินค้าแบบขายแพ็ค (Pack config)</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Grid container spacing={2}>
                  <Grid size={6}>
                    <TextField label="หน่วยแพ็ค (เช่น แพ็ค, กล่อง)" fullWidth value={packUnit} onChange={(e) => setPackUnit(e.target.value)} />
                  </Grid>
                  <Grid size={6}>
                    <TextField label="ขนาดบรรจุ (ชิ้น/แพ็ค)" type="number" fullWidth value={packSize} onChange={(e) => setPackSize(e.target.value)} />
                  </Grid>
                </Grid>
                <TextField label="ราคาขายปลีกหน่วยย่อย (ชิ้น)" type="number" fullWidth value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
                <TextField label="ราคาขายส่งยกแพ็ค (ถ้าเว้นไว้ จะคิดราคาปลีก * ขนาดบรรจุ)" type="number" fullWidth value={packSellPrice} onChange={(e) => setPackSellPrice(e.target.value)} />
              </Box>
            </Grid>

            {/* Price Recommendation Calculator */}
            <Grid size={12}>
              <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.06)' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, color: '#f59e0b', mt: 1 }}>
                🧮 ระบบช่วยคำนวณและเสนอราคาแนะนำขาย (Price Calculator)
              </Typography>
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField label="ราคาทุนต่อชิ้นย่อย" type="number" fullWidth value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField label="ภาษีมูลค่าเพิ่ม (%)" type="number" fullWidth value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField label="ค่าแรง + ค่าขนส่ง / ชิ้น" type="number" fullWidth value={laborCost} onChange={(e) => setLaborCost(e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField label="เพดานราคาตลาดสูงสุด" type="number" fullWidth value={marketPriceCap} onChange={(e) => setMarketPriceCap(e.target.value)} />
                </Grid>
              </Grid>

              {/* Calculator Output */}
              <Card sx={{ 
                mt: 3, 
                bgcolor: isCapExceeded ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', 
                border: '1px solid', 
                borderColor: isCapExceeded ? '#ef4444' : '#f59e0b' 
              }}>
                <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: isCapExceeded ? '#f87171' : '#fbbf24' }}>
                    ผลการประเมิน: ราคาแนะนำขายปลีก = ฿{computedRecPrice.toFixed(2)} บาท
                  </Typography>
                  {isCapExceeded && (
                    <Typography variant="body2" color="error" sx={{ fontWeight: 'bold', mt: 1 }}>
                      ⚠️ คำเตือน: ราคาขายแนะนำสูงกว่าเพดานราคาตลาดที่ยอมรับได้ (฿{capNum.toFixed(2)}) กรุณาตรวจสอบและทบทวนราคาทุน/อัตรากำไรของคุณใหม่!
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, bgcolor: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <Button onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
          <Button onClick={handleSave} variant="contained" color="primary" sx={{ px: 4 }}>บันทึกข้อมูลสินค้า</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Import CSV */}
      <Dialog open={importOpen} onClose={() => setImportOpen(false)}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>นำเข้าข้อมูลสินค้าผ่านไฟล์ CSV</DialogTitle>
        <DialogContent sx={{ minWidth: 320, pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="textSecondary">
            กรุณาอัปโหลดไฟล์ `.csv` ที่มีโครงสร้างคอลัมน์ดังนี้: <br />
            <code>barcode, name, cost_price, sell_price, stock_qty, base_unit, pack_unit, pack_size</code>
          </Typography>
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileChange} 
            style={{ padding: '15px 0', color: '#94a3b8' }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setImportOpen(false)}>ยกเลิก</Button>
          <Button onClick={handleImportCSVSubmit} variant="contained" color="success" disabled={!csvFile}>
            อัปโหลดไฟล์ CSV
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Inventory;
