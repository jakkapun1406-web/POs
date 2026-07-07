import React, { useState, useEffect } from 'react';
import { 
  Box, Paper, Typography, Button, TextField, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog, 
  DialogTitle, DialogContent, DialogActions, Grid, Divider, Alert, Card, CardContent
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

  // Price Calculation on the fly
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
        <Alert severity="error">
          <Typography variant="h6">เข้าถึงข้อมูลไม่ได้ (Permission Denied)</Typography>
          หน้านี้จำกัดเฉพาะผู้จัดการหรือแอดมินเท่านั้น แคชเชียร์ทั่วไปไม่สามารถแก้ไขคลังสินค้าได้
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 3 }}>
        จัดการคลังสินค้าและราคาทุน (INVENTORY CONTROL)
      </Typography>

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Control bar */}
      <Paper elevation={3} sx={{ p: 2, mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <TextField
          label="ค้นหาสินค้า (ชื่อ/บาร์โค้ด/หมวดหมู่)"
          variant="outlined"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 300 }}
        />
        <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpenAdd}>
          เพิ่มสินค้าใหม่
        </Button>
        <Button variant="outlined" color="info" startIcon={<UploadFileIcon />} onClick={() => setImportOpen(true)}>
          นำเข้าไฟล์ CSV
        </Button>
      </Paper>

      {/* Product List Table */}
      <TableContainer component={Paper} elevation={3}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#f5f5f5' }}>
            <TableRow>
              <TableCell><strong>บาร์โค้ด</strong></TableCell>
              <TableCell><strong>ชื่อสินค้า</strong></TableCell>
              <TableCell><strong>หมวดหมู่</strong></TableCell>
              <TableCell align="right"><strong>ราคาทุน</strong></TableCell>
              <TableCell align="right"><strong>ราคาขายปลีก</strong></TableCell>
              <TableCell align="right"><strong>ราคาขายแพ็ค</strong></TableCell>
              <TableCell align="center"><strong>สต็อกคงเหลือ</strong></TableCell>
              <TableCell align="center"><strong>คำแนะนำราคา</strong></TableCell>
              <TableCell align="center"><strong>ตัวควบคุม</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 6 }}>ไม่พบรายการสินค้าที่ระบุ</TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((p) => (
                <TableRow key={p.id} sx={{ '&:hover': { bgcolor: '#fafafa' } }}>
                  <TableCell>{p.barcode}</TableCell>
                  <TableCell><strong>{p.name}</strong></TableCell>
                  <TableCell>{p.category || 'ทั่วไป'}</TableCell>
                  <TableCell align="right">฿{p.cost_price.toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>฿{p.sell_price.toFixed(2)} / {p.base_unit}</TableCell>
                  <TableCell align="right">
                    {p.pack_sell_price ? `฿${p.pack_sell_price.toFixed(2)} / ${p.pack_unit}` : 'N/A'}
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', color: p.stock_qty <= 10 ? '#d32f2f' : '#000' }}>
                    {p.stock_qty} {p.base_unit}
                  </TableCell>
                  <TableCell align="center">
                    <Typography 
                      variant="body2" 
                      color={p.warning_price_cap ? 'error' : 'textSecondary'}
                      sx={{ fontWeight: p.warning_price_cap ? 'bold' : 'normal' }}
                    >
                      ฿{p.recommended_price.toFixed(2)} {p.warning_price_cap ? '⚠️' : ''}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton color="primary" onClick={() => handleOpenEdit(p)}>
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
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          {editingId ? 'แก้ไขข้อมูลสินค้า' : 'เพิ่มสินค้าใหม่'}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Grid container spacing={2}>
            {/* General Info */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, color: '#1976d2' }}>ข้อมูลทั่วไป</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField label="รหัสบาร์โค้ด / Barcode" fullWidth value={barcode} onChange={(e) => setBarcode(e.target.value)} />
                <TextField label="ชื่อสินค้า / Product Name" fullWidth value={name} onChange={(e) => setName(e.target.value)} />
                <TextField label="หมวดหมู่ / Category" fullWidth value={category} onChange={(e) => setCategory(e.target.value)} />
                <Grid container spacing={2}>
                  <Grid size={6}>
                    <TextField label="หน่วยฐาน (เช่น ชิ้น)" fullWidth value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)} />
                  </Grid>
                  <Grid size={6}>
                    <TextField label="สต็อกปัจจุบัน (หน่วยย่อย)" type="number" fullWidth value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
                  </Grid>
                </Grid>
              </Box>
            </Grid>

            {/* Pack configurations */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, color: '#2e7d32' }}>ข้อมูลหน่วยสินค้า (Pack config)</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Grid container spacing={2}>
                  <Grid size={6}>
                    <TextField label="หน่วยแพ็ค (เช่น แพ็ค/ลัง)" fullWidth value={packUnit} onChange={(e) => setPackUnit(e.target.value)} />
                  </Grid>
                  <Grid size={6}>
                    <TextField label="จำนวนย่อยต่อแพ็ค (Pack size)" type="number" fullWidth value={packSize} onChange={(e) => setPackSize(e.target.value)} />
                  </Grid>
                </Grid>
                <TextField label="ราคาขายปลีกชิ้นย่อย (Sell Price)" type="number" fullWidth value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
                <TextField label="ราคาขายส่งทั้งแพ็ค (Pack Sell Price - เว้นว่างได้)" type="number" fullWidth value={packSellPrice} onChange={(e) => setPackSellPrice(e.target.value)} />
              </Box>
            </Grid>

            {/* Price Recommendation Calculator */}
            <Grid size={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, color: '#e65100' }}>
                ระบบแนะนำและคำนวณราคาขาย (Price Calculator)
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField label="ราคาทุนต่อชิ้นย่อย" type="number" fullWidth value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField label="ภาษีมูลค่าเพิ่ม (%)" type="number" fullWidth value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField label="ค่าแรง/ต้นทุนขนส่งต่อชิ้น" type="number" fullWidth value={laborCost} onChange={(e) => setLaborCost(e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField label="เพดานราคาตลาด (สูงสุด)" type="number" fullWidth value={marketPriceCap} onChange={(e) => setMarketPriceCap(e.target.value)} />
                </Grid>
              </Grid>

              {/* Calculator Output */}
              <Card sx={{ mt: 2, bgcolor: isCapExceeded ? '#ffebee' : '#fff3e0', border: '1px solid', borderColor: isCapExceeded ? '#ef5350' : '#ffb74d' }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    ผลการคำนวณ: ราคาขายปลีกแนะนำ = ฿{computedRecPrice.toFixed(2)}
                  </Typography>
                  {isCapExceeded && (
                    <Typography variant="body2" color="error" sx={{ fontWeight: 'bold', mt: 1 }}>
                      ⚠️ คำเตือน: ราคาแนะนำสูงกว่าเพดานราคาตลาดที่กำหนดไว้ (฿{capNum.toFixed(2)}) กรุณาตรวจสอบราคาทุนใหม่!
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
          <Button onClick={handleSave} variant="contained" color="primary">บันทึกข้อมูล</Button>
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
            style={{ padding: '10px 0' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen(false)}>ยกเลิก</Button>
          <Button onClick={handleImportCSVSubmit} variant="contained" color="success" disabled={!csvFile}>
            อัปโหลดไฟล์
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Inventory;
