import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, Grid, Paper, Typography, Button, TextField, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, IconButton, ButtonGroup,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel, Switch,
  Alert, Divider, List, ListItemText, ListItemButton, ListItemSecondaryAction,
  Card, CardContent, Chip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import LocalAtmIcon from '@mui/icons-material/LocalAtm';
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
  product_id: number | null;
  barcode?: string;
  name: string;
  is_pack: boolean;
  sold_qty: number;
  sold_unit: string;
  unit_price: number;
  subtotal: number;
  pack_size: number;
  base_sell_price?: number;
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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  
  const [paymentType, setPaymentType] = useState<string>('cash');
  const [useWelfare, setUseWelfare] = useState<boolean>(false);
  const [govtPercent, setGovtPercent] = useState<number>(60.0);
  const [govtDailyCap, setGovtDailyCap] = useState<number>(150.0);
  const [discountGovt, setDiscountGovt] = useState<number>(0.0);
  const [cashReceived, setCashReceived] = useState<string>('');

  // Dialogs
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

  useEffect(() => {
    api.get('/settings')
      .then((res) => {
        setGovtPercent(res.data.govt_percent);
        setGovtDailyCap(res.data.govt_daily_cap);
      })
      .catch((err) => console.error('Error loading settings', err));
      
    focusScanner();
  }, []);

  const focusScanner = () => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  const totalCartAmount = cart.reduce((sum, item) => sum + item.subtotal, 0);

  useEffect(() => {
    if (useWelfare) {
      const calcGov = totalCartAmount * (govtPercent / 100.0);
      setDiscountGovt(Math.min(calcGov, govtDailyCap));
    } else {
      setDiscountGovt(0);
    }
  }, [totalCartAmount, useWelfare, govtPercent, govtDailyCap]);

  const customerPortion = totalCartAmount - discountGovt;
  const cashNum = parseFloat(cashReceived) || 0;
  const computedChange = cashNum > 0 ? Math.max(0, cashNum - customerPortion) : 0;

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    try {
      const res = await api.get(`/products/barcode/${barcodeInput.trim()}`);
      const product: Product = res.data;
      addProductToCart(product);
      setBarcodeInput('');
    } catch (err: any) {
      if (err.response?.status === 404) {
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
        const updated = [...prevCart];
        updated[existingIdx].sold_qty += 1;
        updated[existingIdx].subtotal = updated[existingIdx].sold_qty * updated[existingIdx].unit_price;
        return updated;
      } else {
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

  const handleQuickAdd = (name: string, price: number, unit: string = 'ชิ้น') => {
    setCart((prevCart) => {
      const idx = prevCart.findIndex(item => item.product_id === null && item.name === name && item.unit_price === price);
      if (idx > -1) {
        const updated = [...prevCart];
        updated[idx].sold_qty += 1;
        updated[idx].subtotal = updated[idx].sold_qty * updated[idx].unit_price;
        return updated;
      } else {
        return [
          ...prevCart,
          {
            product_id: null,
            name,
            is_pack: false,
            sold_qty: 1,
            sold_unit: unit,
            unit_price: price,
            subtotal: price,
            pack_size: 1
          }
        ];
      }
    });
    showTimeAlert('success', `เพิ่มรายการด่วน ${name}`);
    focusScanner();
  };

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
        product_id: null,
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

  const handleTogglePack = (index: number) => {
    setCart((prevCart) => {
      const updated = [...prevCart];
      const item = updated[index];
      if (item.product_id === null) return prevCart;

      const newIsPack = !item.is_pack;
      item.is_pack = newIsPack;
      
      if (newIsPack) {
        item.sold_unit = item.pack_unit || 'แพ็ค';
        item.unit_price = item.pack_sell_price || (item.base_sell_price! * item.pack_size);
      } else {
        item.sold_unit = item.base_unit || 'ชิ้น';
        item.unit_price = item.base_sell_price!;
      }
      
      item.subtotal = item.sold_qty * item.unit_price;
      return updated;
    });
  };

  const handleRequestOverride = (action: 'price' | 'drawer', index: number | null = null) => {
    const role = localStorage.getItem('employee_role');
    if (role === 'admin') {
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
      terminal_id: 'POS-01',
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
    <Box sx={{ height: 'calc(100vh - 90px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {alertMsg && (
        <Alert 
          severity={alertMsg.type} 
          sx={{ position: 'fixed', top: 80, right: 20, zIndex: 9999, minWidth: 300, borderRadius: 3, boxShadow: '0 10px 20px rgba(0,0,0,0.3)' }}
        >
          {alertMsg.text}
        </Alert>
      )}

      <Grid container spacing={1.5} sx={{ height: '100%', overflow: 'hidden' }}>
        {/* Left Side: Cart & Quick item - zero scroll layout */}
        <Grid size={{ xs: 12, md: 8 }} sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Paper elevation={0} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#0f172a' }}>
            
            {/* Search Input (Fixed height) */}
            <Box component="form" onSubmit={handleBarcodeSubmit} sx={{ display: 'flex', gap: 1, mb: 1.5, height: 48, flexShrink: 0 }}>
              <TextField
                inputRef={barcodeInputRef}
                fullWidth
                variant="outlined"
                placeholder="🔍 สแกนบาร์โค้ด หรือ พิมพ์รหัสสั้น (เช่น 050) แล้วกด Enter"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                autoComplete="off"
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255,255,255,0.03)',
                    height: 48,
                    fontSize: '1rem',
                  }
                }}
              />
              <Button type="submit" variant="contained" color="primary" sx={{ px: 3, borderRadius: 3, height: '100%' }}>
                ค้นหา
              </Button>
            </Box>

            {/* Cart Table (Scrollable container taking remaining space) */}
            <TableContainer sx={{ flexGrow: 1, overflowY: 'auto', mb: 1.5, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 3, bgcolor: 'rgba(0,0,0,0.1)' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>สินค้า</TableCell>
                    <TableCell align="center">ราคา</TableCell>
                    <TableCell align="center">จำนวน</TableCell>
                    <TableCell align="center">หน่วยขาย</TableCell>
                    <TableCell align="right">ราคารวม</TableCell>
                    <TableCell align="center"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cart.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 6, color: '#64748b' }}>
                        <ShoppingCartIcon sx={{ fontSize: 50, mb: 1, opacity: 0.3 }} />
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>ยังไม่มีสินค้าในตะกร้า</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.8 }}>สแกนบาร์โค้ด หรือใช้แผงกดสินค้าด่วนเพื่อขาย</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    cart.map((item, index) => (
                      <TableRow key={index} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#fff' }}>
                            {item.name}
                          </Typography>
                          {item.barcode && (
                            <Chip label={item.barcode} size="small" variant="outlined" sx={{ height: 16, fontSize: '0.6rem', color: '#94a3b8', mt: 0.2 }} />
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Button 
                            variant="text" 
                            size="small"
                            onClick={() => handleRequestOverride('price', index)}
                            sx={{ color: '#60a5fa', textTransform: 'none', fontWeight: 800, fontSize: '0.9rem', py: 0 }}
                          >
                            ฿{item.unit_price.toFixed(2)}
                          </Button>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconButton 
                              size="small" 
                              onClick={() => handleUpdateQty(index, item.sold_qty - 1)}
                              sx={{ p: 0.3, border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}
                            >
                              <RemoveIcon fontSize="small" />
                            </IconButton>
                            <Typography sx={{ minWidth: 28, fontWeight: 800, fontSize: '0.95rem', color: '#fff', textAlign: 'center' }}>
                              {item.sold_qty}
                            </Typography>
                            <IconButton 
                              size="small" 
                              onClick={() => handleUpdateQty(index, item.sold_qty + 1)}
                              sx={{ p: 0.3, border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}
                            >
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          {item.product_id ? (
                            <Button 
                              variant="outlined" 
                              size="small"
                              onClick={() => handleTogglePack(index)}
                              sx={{ 
                                textTransform: 'none', 
                                fontWeight: 750,
                                borderRadius: 2,
                                py: 0,
                                fontSize: '0.75rem',
                                color: item.is_pack ? '#10b981' : '#94a3b8',
                                borderColor: item.is_pack ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)',
                                bgcolor: item.is_pack ? 'rgba(16,185,129,0.05)' : 'transparent',
                              }}
                            >
                              {item.sold_unit}
                            </Button>
                          ) : (
                            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                              {item.sold_unit}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff' }}>
                          ฿{item.subtotal.toFixed(2)}
                        </TableCell>
                        <TableCell align="center">
                          <IconButton color="error" size="small" onClick={() => handleRemoveItem(index)} sx={{ p: 0.5 }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Quick Item Grid (Fixed height) */}
            <Typography variant="caption" sx={{ mb: 0.5, fontWeight: 'bold', color: '#94a3b8', display: 'block', flexShrink: 0 }}>
              ⚡ รายการด่วนยอดนิยม / Quick Items
            </Typography>
            <Grid container spacing={0.8} sx={{ mb: 1.5, flexShrink: 0 }}>
              {[
                { name: 'ถุงหิ้วพลาสติก', price: 1, unit: 'ใบ', color: '#475569' },
                { name: 'น้ำแข็งเปล่า', price: 2, unit: 'แก้ว', color: '#0891b2' },
                { name: 'ไข่ไก่ดิบ', price: 5, unit: 'ฟอง', color: '#b45309' },
                { name: 'สินค้าด่วน 10 บ.', price: 10, unit: 'ชิ้น', color: '#0f766e' },
                { name: 'สินค้าด่วน 20 บ.', price: 20, unit: 'ชิ้น', color: '#1d4ed8' },
                { name: 'สินค้าด่วน 50 บ.', price: 50, unit: 'ชิ้น', color: '#701a75' },
                { name: 'สินค้าด่วน 100 บ.', price: 100, unit: 'ชิ้น', color: '#4c1d95' }
              ].map((q) => (
                <Grid size={{ xs: 3, sm: 1.71 }} key={q.name}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="small"
                    onClick={() => handleQuickAdd(q.name, q.price, q.unit)}
                    sx={{
                      bgcolor: q.color,
                      fontSize: '0.7rem',
                      py: 0.8,
                      borderRadius: 2,
                      boxShadow: 'none',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      '&:hover': { bgcolor: q.color, filter: 'brightness(1.15)' }
                    }}
                  >
                    {q.name.split(' ')[0]} ({q.price}.-)
                  </Button>
                </Grid>
              ))}
            </Grid>

            {/* Bottom holds controls (Fixed height) */}
            <Box sx={{ display: 'flex', gap: 1, height: 42, flexShrink: 0 }}>
              <Button 
                variant="outlined" 
                color="warning" 
                size="small"
                startIcon={<PauseIcon fontSize="small" />}
                onClick={handleOpenSuspend}
                disabled={cart.length === 0}
                sx={{ flexGrow: 1, borderRadius: 2.5 }}
              >
                พักบิล
              </Button>
              <Button 
                variant="outlined" 
                color="info" 
                size="small"
                startIcon={<PlayArrowIcon fontSize="small" />}
                onClick={() => { loadSuspendedBills(); setResumeOpen(true); }}
                sx={{ flexGrow: 1, borderRadius: 2.5 }}
              >
                ดึงบิลพัก ({suspendedBills.length})
              </Button>
              <Button 
                variant="outlined" 
                color="primary" 
                size="small"
                startIcon={<LockOpenIcon fontSize="small" />}
                onClick={() => handleRequestOverride('drawer')}
                sx={{ flexGrow: 1, borderRadius: 2.5 }}
              >
                ดีดลิ้นชัก
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Right Side: Total Summary / Checkout controls - zero scroll layout */}
        <Grid size={{ xs: 12, md: 4 }} sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Paper elevation={0} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#0f172a' }}>
            
            {/* Glowing neon total screen */}
            <Box 
              sx={{ 
                mb: 1.5, 
                p: 1.8, 
                bgcolor: '#020617', 
                borderRadius: 3.5, 
                textAlign: 'center', 
                border: '1px solid rgba(59, 130, 246, 0.25)',
                boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8), 0 0 15px rgba(59, 130, 246, 0.1)'
              }}
            >
              <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                ยอดชำระทั้งหมด / Grand Total
              </Typography>
              <Typography 
                variant="h3" 
                sx={{ 
                  fontWeight: 900, 
                  color: '#3b82f6', 
                  mt: 0.5,
                  fontFamily: 'Outfit',
                  textShadow: '0 0 8px rgba(59, 130, 246, 0.4)'
                }}
              >
                ฿{totalCartAmount.toFixed(2)}
              </Typography>
            </Box>

            {/* Welfare toggle config */}
            <Box sx={{ mb: 1.5, p: 1.2, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2.5, bgcolor: 'rgba(255,255,255,0.005)' }}>
              <FormControlLabel
                control={
                  <Switch 
                    checked={useWelfare} 
                    onChange={(e) => setUseWelfare(e.target.checked)} 
                    color="secondary"
                    size="small"
                  />
                }
                label={<strong style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>คนละครึ่ง (สวัสดิการรัฐ)</strong>}
                sx={{ m: 0 }}
              />
              {useWelfare && (
                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    * รัฐช่วย {govtPercent}% (ไม่เกิน ฿{govtDailyCap}/วัน)
                  </Typography>
                  <TextField
                    label="จำนวนรัฐออกให้"
                    type="number"
                    size="small"
                    value={discountGovt}
                    onChange={(e) => setDiscountGovt(Math.min(totalCartAmount, parseFloat(e.target.value) || 0))}
                  />
                  <Divider sx={{ my: 0.5, borderColor: 'rgba(255,255,255,0.06)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>ยอดเก็บสดหน้าร้านจริง:</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 800, color: '#ef4444' }}>
                      ฿{(customerPortion).toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>

            {/* Payment buttons */}
            <ButtonGroup fullWidth size="small" sx={{ mb: 1.5, '& .MuiButton-root': { py: 1, fontSize: '0.8rem' } }}>
              <Button 
                variant={paymentType === 'cash' ? 'contained' : 'outlined'} 
                onClick={() => setPaymentType('cash')}
                startIcon={<LocalAtmIcon fontSize="small" />}
              >
                เงินสด
              </Button>
              <Button 
                variant={paymentType === 'qr' ? 'contained' : 'outlined'} 
                onClick={() => setPaymentType('qr')}
                startIcon={<QrCodeScannerIcon fontSize="small" />}
              >
                สแกน QR
              </Button>
              <Button 
                variant={paymentType === 'govt_welfare' ? 'contained' : 'outlined'} 
                onClick={() => { setPaymentType('govt_welfare'); setUseWelfare(true); }}
                startIcon={<PointOfSaleIcon fontSize="small" />}
              >
                เป๋าตัง
              </Button>
            </ButtonGroup>

            {/* Cash details and Thai banknote buttons */}
            {paymentType === 'cash' && (
              <Box sx={{ mb: 1.5, display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                <TextField
                  label="รับเงินสดมา (Cash Received)"
                  variant="outlined"
                  type="number"
                  fullWidth
                  size="small"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  autoComplete="off"
                  slotProps={{ htmlInput: { style: { fontSize: '1.15rem', fontWeight: 800, color: '#fff', textAlign: 'right' } } }}
                />
                
                {/* Banknote Buttons styled like Thai bills */}
                <Grid container spacing={0.6}>
                  {[
                    { value: 20, bg: '#14532d', color: '#4ade80', label: '20' },
                    { value: 50, bg: '#172554', color: '#60a5fa', label: '50' },
                    { value: 100, bg: '#450a0a', color: '#f87171', label: '100' },
                    { value: 500, bg: '#3b0764', color: '#c084fc', label: '500' },
                    { value: 1000, bg: '#292524', color: '#f4ebe4', label: '1,000' }
                  ].map(b => (
                    <Grid size={2.4} key={b.value}>
                      <Button 
                        fullWidth 
                        size="small"
                        onClick={() => {
                          const currentVal = parseFloat(cashReceived) || 0;
                          setCashReceived((currentVal + b.value).toString());
                        }}
                        sx={{ 
                          bgcolor: b.bg, 
                          color: b.color, 
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          py: 0.8, 
                          borderRadius: 1.5,
                          border: `1px solid ${b.color}33`,
                          '&:hover': { bgcolor: b.bg, filter: 'brightness(1.2)' }
                        }}
                      >
                        +{b.label}
                      </Button>
                    </Grid>
                  ))}
                  <Grid size={12}>
                    <Button 
                      fullWidth 
                      variant="outlined" 
                      size="small"
                      onClick={() => setCashReceived(customerPortion.toString())}
                      sx={{ py: 0.5, fontSize: '0.7rem', color: '#64748b', borderColor: 'rgba(255,255,255,0.06)' }}
                    >
                      รับเงินสดพอดีคิดบิล (Exact: ฿{customerPortion.toFixed(2)})
                    </Button>
                  </Grid>
                </Grid>

                <Box sx={{ p: 1.5, bgcolor: '#020617', borderRadius: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(16,185,129,0.06)' }}>
                  <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 'bold' }}>เงินทอน / Change:</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: '#10b981', fontFamily: 'Outfit' }}>
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
              onClick={handleCheckout}
              sx={{ 
                py: 1.8, 
                fontSize: '1.15rem', 
                fontWeight: 900, 
                borderRadius: 3.5,
                bgcolor: '#10b981',
                boxShadow: '0 4px 15px rgba(16,185,129,0.2)',
                '&:hover': { bgcolor: '#059669', boxShadow: '0 4px 20px rgba(16,185,129,0.4)' }
              }}
            >
              ชำระเงินบิลนี้ (PAY NOW)
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Dialog: Add Custom Item */}
      <Dialog open={customItemOpen} onClose={() => { setCustomItemOpen(false); focusScanner(); }}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>สินค้านอกคลัง / พิมพ์ราคาเอง</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 320, pt: 1 }}>
          <Typography color="textSecondary" variant="body2">
            รหัสสินค้า/บาร์โค้ด: <strong>{customBarcode || 'ทั่วไป'}</strong>
          </Typography>
          <TextField
            label="ชื่อสินค้า"
            fullWidth
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            autoFocus
          />
          <TextField
            label="ราคาขาย (บาท)"
            type="number"
            fullWidth
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="จำนวน"
              type="number"
              value={customQty}
              onChange={(e) => setCustomQty(Math.max(1, parseInt(e.target.value) || 1))}
              sx={{ flexGrow: 1 }}
            />
            <TextField
              label="หน่วยขาย"
              value={customUnit}
              onChange={(e) => setCustomUnit(e.target.value)}
              sx={{ flexGrow: 1 }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => { setCustomItemOpen(false); focusScanner(); }} color="secondary">ยกเลิก</Button>
          <Button onClick={handleAddCustomItem} variant="contained" color="primary">เพิ่มเข้ารถเข็น</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Admin PIN Override */}
      <Dialog open={overrideOpen} onClose={() => { setOverrideOpen(false); focusScanner(); }}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>ยืนยันด้วย PIN ของ Admin</DialogTitle>
        <DialogContent sx={{ minWidth: 280, pt: 1 }}>
          <TextField
            label="รหัส PIN ผู้จัดการแอดมิน"
            type="password"
            fullWidth
            value={adminPin}
            onChange={(e) => setAdminPin(e.target.value)}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => { setOverrideOpen(false); focusScanner(); }}>ยกเลิก</Button>
          <Button onClick={handleOverrideSubmit} variant="contained" color="error">อนุมัติ</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Edit Price */}
      <Dialog open={editPriceOpen} onClose={() => { setEditPriceOpen(false); focusScanner(); }}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>แก้ไขราคาหน้าร้าน</DialogTitle>
        <DialogContent sx={{ minWidth: 300, pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="ราคาขายใหม่"
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
              label={<strong>บันทึกราคานี้เป็นราคาขายหลักถาวร</strong>}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => { setEditPriceOpen(false); focusScanner(); }}>ยกเลิก</Button>
          <Button onClick={handleSavePriceEdit} variant="contained" color="primary">บันทึก</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Suspend Name */}
      <Dialog open={suspendOpen} onClose={() => setSuspendOpen(false)}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>พักบิลคิดเงินชั่วคราว</DialogTitle>
        <DialogContent sx={{ minWidth: 280, pt: 1 }}>
          <TextField
            label="ตั้งชื่อบิลพัก (เช่น โต๊ะ 1, ชื่อลูกค้า)"
            fullWidth
            value={suspendName}
            onChange={(e) => setSuspendName(e.target.value)}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSuspendOpen(false)}>ยกเลิก</Button>
          <Button onClick={handleSuspendSubmit} variant="contained" color="warning">พักบิล</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Resume List */}
      <Dialog open={resumeOpen} onClose={() => { setResumeOpen(false); focusScanner(); }} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 'bold' }}>รายการบิลที่พักไว้ทั้งหมด</DialogTitle>
        <DialogContent>
          {suspendedBills.length === 0 ? (
            <Typography align="center" color="textSecondary" sx={{ py: 4 }}>
              ไม่มีบิลค้างพักไว้ในขณะนี้
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
                    sx={{ borderBottom: '1px solid rgba(255,255,255,0.06)', py: 1.5 }}
                  >
                    <ListItemText
                      primary={<strong>{bill.hold_no}</strong>}
                      secondary={`${itemsCount} รายการ — ยอดรวม ฿${billTotal.toFixed(2)}`}
                    />
                    <ListItemSecondaryAction sx={{ mr: 1 }}>
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
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => { setResumeOpen(false); focusScanner(); }}>ปิดหน้าต่าง</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default POS;
