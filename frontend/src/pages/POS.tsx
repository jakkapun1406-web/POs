import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, Grid, Paper, Typography, Button, TextField, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, IconButton, ButtonGroup,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel, Switch,
  Alert, Divider, List, ListItem, ListItemText, ListItemButton, ListItemSecondaryAction
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';
import LockOpenIcon from '@mui/icons-material/LockOpen';
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
}

interface CartItem {
  product_id: number | null; // null for custom items
  barcode?: string;
  name: string;
  is_pack: boolean;
  sold_qty: number;
  sold_unit: string;
  unit_price: number;
  subtotal: number;
  pack_size: number; // for calculation
  base_sell_price?: number; // backup for override
  pack_sell_price?: number | null;
  base_unit?: string;
  pack_unit?: string;
}

interface SuspendedBill {
  id: number;
  hold_no: string;
  created_at: string;
  cart_data: string;
}

const POS: React.FC = () => {
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  
  // Checkout & Welfare state
  const [paymentType, setPaymentType] = useState<string>('cash'); // 'cash', 'qr', 'govt_welfare'
  const [useWelfare, setUseWelfare] = useState<boolean>(false);
  const [govtPercent, setGovtPercent] = useState<number>(60.0);
  const [govtDailyCap, setGovtDailyCap] = useState<number>(150.0);
  const [discountGovt, setDiscountGovt] = useState<number>(0.0);
  const [cashReceived, setCashReceived] = useState<string>('');
  const [changeDue, setChangeDue] = useState<number>(0.0);

  // Popups & Dialogs
  const [customItemOpen, setCustomItemOpen] = useState<boolean>(false);
  const [customBarcode, setCustomBarcode] = useState<string>('');
  const [customName, setCustomName] = useState<string>('');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [customQty, setCustomQty] = useState<number>(1);
  const [customUnit, setCustomUnit] = useState<string>('ชิ้น');

  const [overrideOpen, setOverrideOpen] = useState<boolean>(false);
  const [adminPin, setAdminPin] = useState<string>('');
  const [overrideAction, setOverrideAction] = useState<'price' | 'drawer' | null>(null);
  const [selectedCartIndex, setSelectedCartIndex] = useState<number | null>(null);

  const [editPriceOpen, setEditPriceOpen] = useState<boolean>(false);
  const [newPrice, setNewPrice] = useState<string>('');
  const [editPermanent, setEditPermanent] = useState<boolean>(false);

  const [suspendOpen, setSuspendOpen] = useState<boolean>(false);
  const [suspendName, setSuspendName] = useState<string>('');
  const [suspendedBills, setSuspendedBills] = useState<SuspendedBill[]>([]);
  const [resumeOpen, setResumeOpen] = useState<boolean>(false);

  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Load Settings on start
  useEffect(() => {
    api.get('/settings')
      .then((res) => {
        setGovtPercent(res.data.govt_percent);
        setGovtDailyCap(res.data.govt_daily_cap);
      })
      .catch((err) => console.error('Error loading settings', err));
      
    // Focus barcode scanner input automatically
    focusScanner();
  }, []);

  const focusScanner = () => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  // Recalculate welfare discount when cart or useWelfare changes
  const totalCartAmount = cart.reduce((sum, item) => sum + item.subtotal, 0);

  useEffect(() => {
    if (useWelfare) {
      const calcGov = totalCartAmount * (govtPercent / 100.0);
      setDiscountGovt(Math.min(calcGov, govtDailyCap));
    } else {
      setDiscountGovt(0);
    }
  }, [totalCartAmount, useWelfare, govtPercent, govtDailyCap]);

  // Recalculate change due
  const customerPortion = totalCartAmount - discountGovt;
  const cashNum = parseFloat(cashReceived) || 0;
  const computedChange = cashNum > 0 ? Math.max(0, cashNum - customerPortion) : 0;

  // Handle barcode submission
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    try {
      const res = await api.get(`/products/barcode/${barcodeInput.trim()}`);
      const product: Product = res.data;
      
      // Add product to cart
      addProductToCart(product);
      setBarcodeInput('');
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Unknown barcode, open add custom item dialog
        setCustomBarcode(barcodeInput);
        setCustomName('');
        setCustomPrice('');
        setCustomQty(1);
        setCustomUnit('ชิ้น');
        setCustomItemOpen(true);
        setBarcodeInput('');
      } else {
        showTimeAlert('error', 'ข้อผิดพลาดการสแกนบาร์โค้ด');
      }
    }
  };

  const addProductToCart = (product: Product) => {
    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex(item => item.product_id === product.id && !item.is_pack);
      if (existingIdx > -1) {
        // Increment quantity
        const updated = [...prevCart];
        updated[existingIdx].sold_qty += 1;
        updated[existingIdx].subtotal = updated[existingIdx].sold_qty * updated[existingIdx].unit_price;
        return updated;
      } else {
        // Add new item
        return [...prevCart, {
          product_id: product.id,
          barcode: product.barcode,
          name: product.name,
          is_pack: false,
          sold_qty: 1,
          sold_unit: product.base_unit || 'ชิ้น',
          unit_price: product.sell_price,
          subtotal: product.sell_price,
          pack_size: product.pack_size,
          base_sell_price: product.sell_price,
          pack_sell_price: product.pack_sell_price,
          base_unit: product.base_unit,
          pack_unit: product.pack_unit
        }];
      }
    });
    showTimeAlert('success', `เพิ่ม ${product.name} เข้ารถเข็น`);
  };

  // Add Custom item freely
  const handleAddCustomItem = () => {
    if (!customName.trim() || !customPrice.trim()) {
      showTimeAlert('error', 'กรุณากรอกชื่อสินค้าและราคา');
      return;
    }

    const price = parseFloat(customPrice);
    if (isNaN(price) || price < 0) {
      showTimeAlert('error', 'ราคาไม่ถูกต้อง');
      return;
    }

    setCart((prevCart) => [
      ...prevCart,
      {
        product_id: null, // custom
        barcode: customBarcode || undefined,
        name: customName,
        is_pack: false,
        sold_qty: customQty,
        sold_unit: customUnit,
        unit_price: price,
        subtotal: price * customQty,
        pack_size: 1,
      }
    ]);
    
    setCustomItemOpen(false);
    showTimeAlert('success', `เพิ่มรายการอิสระ ${customName}`);
    focusScanner();
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    setCart((prevCart) => {
      const updated = [...prevCart];
      updated[index].sold_qty = newQty;
      updated[index].subtotal = newQty * updated[index].unit_price;
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setCart((prevCart) => prevCart.filter((_, i) => i !== index));
  };

  // Toggle Pack vs Unit
  const handleTogglePack = (index: number) => {
    setCart((prevCart) => {
      const updated = [...prevCart];
      const item = updated[index];
      if (item.product_id === null) return prevCart; // custom items don't have packs

      const newIsPack = !item.is_pack;
      item.is_pack = newIsPack;
      
      if (newIsPack) {
        item.sold_unit = item.pack_unit || 'แพ็ค';
        // If pack_sell_price is set, use it. Otherwise, unit_price * pack_size
        item.unit_price = item.pack_sell_price || (item.base_sell_price! * item.pack_size);
      } else {
        item.sold_unit = item.base_unit || 'ชิ้น';
        item.unit_price = item.base_sell_price!;
      }
      
      item.subtotal = item.sold_qty * item.unit_price;
      return updated;
    });
  };

  // Admin Override Flow
  const handleRequestOverride = (action: 'price' | 'drawer', index: number | null = null) => {
    const role = localStorage.getItem('employee_role');
    if (role === 'admin') {
      // Already admin, bypass PIN prompt
      if (action === 'price' && index !== null) {
        openEditPrice(index);
      } else if (action === 'drawer') {
        executeDrawerKick();
      }
    } else {
      setOverrideAction(action);
      setSelectedCartIndex(index);
      setAdminPin('');
      setOverrideOpen(true);
    }
  };

  const handleOverrideSubmit = async () => {
    try {
      const res = await api.post('/auth/override', { pin: adminPin });
      setOverrideOpen(false);
      showTimeAlert('success', `อนุมัติสำเร็จโดย Admin: ${res.data.admin_name}`);
      
      if (overrideAction === 'price' && selectedCartIndex !== null) {
        openEditPrice(selectedCartIndex);
      } else if (overrideAction === 'drawer') {
        executeDrawerKick();
      }
    } catch (err: any) {
      showTimeAlert('error', err.response?.data?.detail || 'รหัส PIN Admin ไม่ถูกต้อง');
    }
  };

  const openEditPrice = (index: number) => {
    setSelectedCartIndex(index);
    setNewPrice(cart[index].unit_price.toString());
    setEditPermanent(false);
    setEditPriceOpen(true);
  };

  const handleSavePriceEdit = async () => {
    if (selectedCartIndex === null) return;
    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) return;

    const item = cart[selectedCartIndex];

    if (editPermanent && item.product_id) {
      // Save permanently to database
      try {
        const payload = item.is_pack 
          ? { sell_price: item.base_sell_price!, pack_sell_price: price }
          : { sell_price: price, pack_sell_price: item.pack_sell_price };

        await api.put(`/products/${item.product_id}/price`, payload);
        showTimeAlert('success', 'อัปเดตราคาลงฐานข้อมูลถาวรแล้ว');
      } catch (err) {
        console.error('Error saving permanent price', err);
        showTimeAlert('error', 'ไม่สามารถบันทึกราคาถาวรลงระบบได้');
      }
    }

    // Update in-cart pricing
    setCart((prevCart) => {
      const updated = [...prevCart];
      const target = updated[selectedCartIndex];
      target.unit_price = price;
      target.subtotal = target.sold_qty * price;
      if (!editPermanent) {
        showTimeAlert('success', 'เปลี่ยนราคาชั่วคราวเฉพาะบิลนี้');
      }
      return updated;
    });

    setEditPriceOpen(false);
    setSelectedCartIndex(null);
    focusScanner();
  };

  const executeDrawerKick = async () => {
    try {
      await api.post('/sales/kick-drawer');
      showTimeAlert('success', 'สั่งเปิดลิ้นชักเก็บเงินแล้ว');
    } catch (err: any) {
      showTimeAlert('error', err.response?.data?.detail || 'ไม่สามารถเปิดลิ้นชักเก็บเงินได้');
    }
  };

  // Suspend Cart Flow
  const handleOpenSuspend = () => {
    if (cart.length === 0) return;
    setSuspendName(`HOLD-${(suspendedBills.length + 1).toString().padStart(2, '0')}`);
    setSuspendOpen(true);
  };

  const handleSuspendSubmit = async () => {
    try {
      await api.post('/sales/suspend', {
        hold_no: suspendName,
        cart_data: JSON.stringify(cart),
      });
      setCart([]);
      setSuspendOpen(false);
      showTimeAlert('success', `พักบิล ${suspendName} สำเร็จ`);
      loadSuspendedBills();
    } catch (err) {
      showTimeAlert('error', 'ไม่สามารถพักบิลได้');
    }
  };

  const loadSuspendedBills = async () => {
    try {
      const res = await api.get('/sales/suspended');
      setSuspendedBills(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleResumeBill = (bill: SuspendedBill) => {
    setCart(JSON.parse(bill.cart_data));
    api.delete(`/sales/suspended/${bill.id}`)
      .then(() => {
        loadSuspendedBills();
        setResumeOpen(false);
        showTimeAlert('success', `ดึงบิลพัก ${bill.hold_no} กลับมาเรียบร้อย`);
      })
      .catch(() => showTimeAlert('error', 'เกิดข้อผิดพลาดในการดึงบิล'));
  };

  // Finalize Sale Flow
  const handleCheckout = async () => {
    if (cart.length === 0) {
      showTimeAlert('error', 'ไม่มีสินค้าในตะกร้า');
      return;
    }
    if (paymentType === 'cash' && cashNum < customerPortion) {
      showTimeAlert('error', 'ยอดเงินสดที่รับมาไม่เพียงพอ');
      return;
    }

    const payload = {
      terminal_id: 'POS-01', // defaults to 1st machine
      payment_type: paymentType,
      total_amount: totalCartAmount,
      discount_govt: discountGovt,
      cash_received: paymentType === 'cash' ? cashNum : customerPortion,
      change_due: paymentType === 'cash' ? computedChange : 0,
      items: cart.map(item => ({
        product_id: item.product_id,
        custom_name: item.product_id ? null : item.name,
        is_pack: item.is_pack,
        sold_qty: item.sold_qty,
        sold_unit: item.sold_unit,
        unit_price: item.unit_price,
        subtotal: item.subtotal
      }))
    };

    try {
      const res = await api.post('/sales/', payload);
      showTimeAlert('success', `คิดเงินเสร็จสิ้น บิลเลขที่: ${res.data.sale_no}`);
      
      // Reset state for next customer
      setCart([]);
      setCashReceived('');
      setUseWelfare(false);
      setPaymentType('cash');
      focusScanner();
    } catch (err: any) {
      showTimeAlert('error', err.response?.data?.detail || 'เกิดข้อผิดพลาดในการคิดเงิน');
    }
  };

  const showTimeAlert = (type: 'success' | 'error', text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  return (
    <Box sx={{ p: 2 }}>
      {alertMsg && (
        <Alert 
          severity={alertMsg.type} 
          sx={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, minWidth: 250 }}
        >
          {alertMsg.text}
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* Left Side: Cart and Barcode scanner */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper elevation={3} sx={{ p: 2, height: '80vh', display: 'flex', flexDirection: 'column' }}>
            
            {/* Barcode scanner row */}
            <Box component="form" onSubmit={handleBarcodeSubmit} sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                inputRef={barcodeInputRef}
                fullWidth
                variant="outlined"
                placeholder="สแกนบาร์โค้ด หรือ พิมพ์รหัสสั้น (เช่น 050) แล้วกด Enter"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                sx={{ bgcolor: '#fff' }}
              />
              <Button type="submit" variant="contained" color="primary" sx={{ px: 4 }}>
                ยิงบาร์โค้ด
              </Button>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Cart Table */}
            <TableContainer sx={{ flexGrow: 1, overflowY: 'auto' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>สินค้า / Item</strong></TableCell>
                    <TableCell align="center"><strong>ราคา / Unit</strong></TableCell>
                    <TableCell align="center"><strong>จำนวน / Qty</strong></TableCell>
                    <TableCell align="center"><strong>หน่วย / Suffix</strong></TableCell>
                    <TableCell align="right"><strong>ราคารวม / Sub</strong></TableCell>
                    <TableCell align="center"><strong>ตัวควบคุม / Action</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cart.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 8, color: '#9e9e9e' }}>
                        ยังไม่มีสินค้าในรถเข็น สแกนบาร์โค้ดเพื่อเริ่มต้นขาย
                      </TableCell>
                    </TableRow>
                  ) : (
                    cart.map((item, index) => (
                      <TableRow key={index} sx={{ '&:hover': { bgcolor: '#f5f5f5' } }}>
                        {/* Item Name */}
                        <TableCell>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {item.name}
                          </Typography>
                          {item.barcode && (
                            <Typography variant="caption" color="textSecondary">
                              {item.barcode}
                            </Typography>
                          )}
                        </TableCell>
                        
                        {/* Price with override options */}
                        <TableCell align="center">
                          <Button 
                            variant="text" 
                            onClick={() => handleRequestOverride('price', index)}
                            sx={{ color: '#1976d2', textTransform: 'none', fontWeight: 'bold' }}
                          >
                            ฿{item.unit_price.toFixed(2)}
                          </Button>
                        </TableCell>
                        
                        {/* Quantity controls */}
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconButton 
                              size="small" 
                              onClick={() => handleUpdateQty(index, item.sold_qty - 1)}
                              sx={{ border: '1px solid #e0e0e0', mr: 1 }}
                            >
                              <RemoveIcon fontSize="small" />
                            </IconButton>
                            <Typography sx={{ minWidth: 30, fontWeight: 'bold' }}>
                              {item.sold_qty}
                            </Typography>
                            <IconButton 
                              size="small" 
                              onClick={() => handleUpdateQty(index, item.sold_qty + 1)}
                              sx={{ border: '1px solid #e0e0e0', ml: 1 }}
                            >
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>

                        {/* Unit / Pack Toggle */}
                        <TableCell align="center">
                          {item.product_id ? (
                            <Button 
                              variant="outlined" 
                              size="small"
                              onClick={() => handleTogglePack(index)}
                              sx={{ 
                                textTransform: 'none', 
                                color: item.is_pack ? '#2e7d32' : '#757575',
                                borderColor: item.is_pack ? '#a5d6a7' : '#e0e0e0',
                                bgcolor: item.is_pack ? '#e8f5e9' : 'transparent',
                                '&:hover': { bgcolor: item.is_pack ? '#c8e6c9' : '#eeeeee' }
                              }}
                            >
                              {item.sold_unit}
                            </Button>
                          ) : (
                            <Typography variant="body2" color="textSecondary">
                              {item.sold_unit}
                            </Typography>
                          )}
                        </TableCell>

                        {/* Subtotal */}
                        <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1rem' }}>
                          ฿{item.subtotal.toFixed(2)}
                        </TableCell>

                        {/* Delete */}
                        <TableCell align="center">
                          <IconButton color="error" size="small" onClick={() => handleRemoveItem(index)}>
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Quick action buttons bottom left */}
            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <Button 
                variant="outlined" 
                color="warning" 
                startIcon={<PauseIcon />}
                onClick={handleOpenSuspend}
                disabled={cart.length === 0}
                sx={{ py: 1.5, flexGrow: 1 }}
              >
                พักบิล (Hold Cart)
              </Button>
              <Button 
                variant="outlined" 
                color="info" 
                startIcon={<PlayArrowIcon />}
                onClick={() => { loadSuspendedBills(); setResumeOpen(true); }}
                sx={{ py: 1.5, flexGrow: 1 }}
              >
                ดึงบิลพัก (List Hold)
              </Button>
              <Button 
                variant="outlined" 
                color="primary" 
                startIcon={<LockOpenIcon />}
                onClick={() => handleRequestOverride('drawer')}
                sx={{ py: 1.5, flexGrow: 1 }}
              >
                ดีดลิ้นชัก (Open Drawer)
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Right Side: Total Summary / Checkout controls */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper elevation={3} sx={{ p: 3, height: '80vh', display: 'flex', flexDirection: 'column', bgcolor: '#fafafa' }}>
            <Typography variant="h5" align="center" sx={{ fontWeight: 'bold', mb: 3 }}>
              ยอดรวมบิล / CHECKOUT
            </Typography>

            <Box sx={{ mb: 3, p: 2, bgcolor: '#e3f2fd', borderRadius: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="textSecondary">ยอดรวมทั้งหมด / Total</Typography>
              <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#1565c0' }}>
                ฿{totalCartAmount.toFixed(2)}
              </Typography>
            </Box>

            {/* Government Welfare Scheme Switch */}
            <Box sx={{ mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 2, bgcolor: '#fff' }}>
              <FormControlLabel
                control={
                  <Switch 
                    checked={useWelfare} 
                    onChange={(e) => setUseWelfare(e.target.checked)} 
                    color="primary"
                  />
                }
                label={<strong>สิทธิ์สวัสดิการรัฐ (คนละครึ่ง)</strong>}
              />
              {useWelfare && (
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="body2" color="textSecondary">
                    *สัดส่วนรัฐช่วย {govtPercent}% (ไม่เกินวันละ {govtDailyCap} บาท)
                  </Typography>
                  <TextField
                    label="จำนวนเงินที่รัฐช่วย (แก้ไขได้)"
                    type="number"
                    size="small"
                    value={discountGovt}
                    onChange={(e) => setDiscountGovt(Math.min(totalCartAmount, parseFloat(e.target.value) || 0))}
                  />
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>
                    ยอดลูกค้าจ่ายจริง: ฿{(customerPortion).toFixed(2)}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Payment Type Selection */}
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>ช่องทางชำระเงิน / Payment Type</Typography>
            <ButtonGroup fullWidth variant="outlined" color="primary" sx={{ mb: 3, bgcolor: '#fff' }}>
              <Button 
                variant={paymentType === 'cash' ? 'contained' : 'outlined'} 
                onClick={() => setPaymentType('cash')}
              >
                เงินสด
              </Button>
              <Button 
                variant={paymentType === 'qr' ? 'contained' : 'outlined'} 
                onClick={() => setPaymentType('qr')}
              >
                สแกน QR
              </Button>
              <Button 
                variant={paymentType === 'govt_welfare' ? 'contained' : 'outlined'} 
                onClick={() => { setPaymentType('govt_welfare'); setUseWelfare(true); }}
              >
                เป๋าตัง
              </Button>
            </ButtonGroup>

            {/* Cash received calculator */}
            {paymentType === 'cash' && (
              <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="รับเงินสดมา / Cash Received"
                  variant="outlined"
                  type="number"
                  fullWidth
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  autoComplete="off"
                  slotProps={{ htmlInput: { style: { fontSize: '1.25rem', fontWeight: 'bold' } } }}
                />
                
                {/* Quick cash buttons */}
                <Grid container spacing={1}>
                  {[20, 50, 100, 500, 1000].map(val => (
                    <Grid size={2.4} key={val}>
                      <Button 
                        fullWidth 
                        variant="outlined"
                        onClick={() => setCashReceived((parseFloat(cashReceived) || 0 + val).toString())}
                        sx={{ fontSize: '0.85rem', p: 1 }}
                      >
                        +{val}
                      </Button>
                    </Grid>
                  ))}
                </Grid>

                <Box sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body1"><strong>เงินทอน / Change:</strong></Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                    ฿{computedChange.toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            )}

            <Box sx={{ flexGrow: 1 }} />

            <Button
              fullWidth
              variant="contained"
              color="success"
              size="large"
              onClick={handleCheckout}
              sx={{ py: 2, fontSize: '1.2rem', fontWeight: 'bold' }}
            >
              ยืนยันการขาย (PAY)
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Dialog: Add Custom Item */}
      <Dialog open={customItemOpen} onClose={() => { setCustomItemOpen(false); focusScanner(); }}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>สินค้านอกคลัง / พิมพ์ราคาเอง</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 320, pt: 1 }}>
          <Typography color="textSecondary" variant="body2">
            บาร์โค้ด: {customBarcode || 'ไม่มีบาร์โค้ด'}
          </Typography>
          <TextField
            label="ชื่อสินค้า / Product Name"
            fullWidth
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            autoFocus
          />
          <TextField
            label="ราคาขาย / Price"
            type="number"
            fullWidth
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="จำนวน / Qty"
              type="number"
              value={customQty}
              onChange={(e) => setCustomQty(Math.max(1, parseInt(e.target.value) || 1))}
              sx={{ flexGrow: 1 }}
            />
            <TextField
              label="หน่วย / Unit"
              value={customUnit}
              onChange={(e) => setCustomUnit(e.target.value)}
              sx={{ flexGrow: 1 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCustomItemOpen(false); focusScanner(); }} color="secondary">ยกเลิก</Button>
          <Button onClick={handleAddCustomItem} variant="contained" color="primary">เพิ่มรายการ</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Admin PIN Override */}
      <Dialog open={overrideOpen} onClose={() => { setOverrideOpen(false); focusScanner(); }}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>ยืนยันด้วย PIN ของ Admin</DialogTitle>
        <DialogContent sx={{ minWidth: 280, pt: 1 }}>
          <TextField
            label="รหัส PIN แอดมิน (4-6 หลัก)"
            type="password"
            fullWidth
            value={adminPin}
            onChange={(e) => setAdminPin(e.target.value)}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOverrideOpen(false); focusScanner(); }}>ยกเลิก</Button>
          <Button onClick={handleOverrideSubmit} variant="contained" color="error">ตรวจสอบ</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Edit Price */}
      <Dialog open={editPriceOpen} onClose={() => { setEditPriceOpen(false); focusScanner(); }}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>แก้ไขราคาสินค้า</DialogTitle>
        <DialogContent sx={{ minWidth: 300, pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="ราคาขายใหม่ / New Price"
            type="number"
            fullWidth
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            autoFocus
          />
          {selectedCartIndex !== null && cart[selectedCartIndex]?.product_id && (
            <FormControlLabel
              control={
                <Switch 
                  checked={editPermanent} 
                  onChange={(e) => setEditPermanent(e.target.checked)} 
                  color="error"
                />
              }
              label={<strong>อัปเดตราคาถาวรลงสต็อกสินค้าหลัก</strong>}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setEditPriceOpen(false); focusScanner(); }}>ยกเลิก</Button>
          <Button onClick={handleSavePriceEdit} variant="contained" color="primary">บันทึกราคา</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Suspend Name */}
      <Dialog open={suspendOpen} onClose={() => setSuspendOpen(false)}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>พักบิลสินค้า</DialogTitle>
        <DialogContent sx={{ minWidth: 280, pt: 1 }}>
          <TextField
            label="รหัสบิลพัก (Hold Name)"
            fullWidth
            value={suspendName}
            onChange={(e) => setSuspendName(e.target.value)}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuspendOpen(false)}>ยกเลิก</Button>
          <Button onClick={handleSuspendSubmit} variant="contained" color="warning">พักบิล</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Resume List */}
      <Dialog open={resumeOpen} onClose={() => { setResumeOpen(false); focusScanner(); }} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 'bold' }}>รายการบิลที่พักไว้ทั้งหมด</DialogTitle>
        <DialogContent>
          {suspendedBills.length === 0 ? (
            <Typography align="center" color="textSecondary" sx={{ py: 3 }}>
              ไม่มีบิลพักอยู่ในขณะนี้
            </Typography>
          ) : (
            <List>
              {suspendedBills.map((bill) => {
                const cartData: CartItem[] = JSON.parse(bill.cart_data);
                const itemsCount = cartData.reduce((sum, item) => sum + item.sold_qty, 0);
                const billTotal = cartData.reduce((sum, item) => sum + item.subtotal, 0);
                
                return (
                  <ListItemButton 
                    key={bill.id} 
                    onClick={() => handleResumeBill(bill)}
                    sx={{ borderBottom: '1px solid #f0f0f0' }}
                  >
                    <ListItemText
                      primary={<strong>{bill.hold_no}</strong>}
                      secondary={`${itemsCount} รายการ — ยอดรวม ฿${billTotal.toFixed(2)}`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" color="primary" onClick={() => handleResumeBill(bill)}>
                        <PlayArrowIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItemButton>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setResumeOpen(false); focusScanner(); }}>ปิด</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default POS;
