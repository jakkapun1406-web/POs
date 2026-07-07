import logging
from escpos.printer import Network
from app.db.models import Sale, SaleItem, Setting, GovtWelfareTxn

logger = logging.getLogger("printer")

def kick_drawer_only(printer_ip: str, printer_port: int = 9100):
    """Sends only the drawer kick command to the network printer."""
    if not printer_ip:
        return False, "ไม่ได้ตั้งค่า IP เครื่องพิมพ์"
    try:
        printer = Network(printer_ip, port=printer_port, timeout=5)
        # ESC p m t1 t2: Kick drawer pin 2
        printer._raw(b'\x1b\x70\x00\x19\xfa')
        # Also kick drawer pin 5 just in case
        printer._raw(b'\x1b\x70\x01\x19\xfa')
        printer.close()
        return True, "ดีดลิ้นชักสำเร็จ"
    except Exception as e:
        logger.error(f"Failed to kick drawer: {e}")
        return False, f"ไม่สามารถดีดลิ้นชักได้: {str(e)}"

def print_receipt(sale: Sale, db_settings: Setting, welfare_txn: GovtWelfareTxn = None):
    """Prints a receipt to a network ESC/POS printer based on settings."""
    if not db_settings or not db_settings.printer_ip:
        logger.info("Printer IP not set. Dummy mode: printing to logs.")
        # Log representation of the receipt
        dummy_receipt = generate_dummy_receipt_text(sale, welfare_txn)
        logger.info(f"\n=== DUMMY RECEIPT ===\n{dummy_receipt}\n=====================")
        return True, "Dummy Mode: พิมพ์ออก logs สำเร็จ"

    try:
        printer = Network(db_settings.printer_ip, port=db_settings.printer_port, timeout=5)
        
        # Configure text sizes and alignment
        # 80mm printer has ~48 characters per line
        # 58mm printer has ~32 characters per line
        width = 80 if db_settings.receipt_width == "80mm" else 58
        char_limit = 48 if width == 80 else 32

        # Initialize
        printer.hw("INIT")
        
        # Header - Centered
        printer.set(align="center", font="a", text_type="B", width=2, height=2)
        # python-escpos needs custom encoding (e.g. cp874 for Thai)
        # We can send text encoded in CP874
        printer._raw(b'\x1b\x74\x2c') # Select CP874 table (Thai) if supported by printer
        
        printer.textln("GROCERY POS")
        printer.set(align="center", font="a", text_type="NORMAL", width=1, height=1)
        printer.textln("ร้านค้าชุมชน / grocery store")
        printer.textln("-" * char_limit)

        # Invoice details
        printer.set(align="left")
        printer.textln(f"เลขที่บิล/Bill: {sale.sale_no}")
        local_time = sale.created_at.strftime("%d/%m/%Y %H:%M:%S")
        printer.textln(f"เวลา/Time: {local_time}")
        printer.textln(f"พนักงาน/Cashier: {sale.employee.name if sale.employee else 'N/A'}")
        printer.textln(f"เครื่อง/Terminal: {sale.terminal_id}")
        printer.textln("-" * char_limit)

        # Table Header
        # Format columns: Name, Qty, Price, Subtotal
        if width == 80:
            # 80mm layout: Name (20 chars), Qty (8 chars), Price (10 chars), Sub (10 chars) = 48 chars
            header_str = f"{'รายการ/Item':<20}{'จำนวน/Qty':^8}{'ราคา/Price':^10}{'รวม/Sub':>10}"
        else:
            # 58mm layout: Name (12 chars), Qty (4 chars), Price (8 chars), Sub (8 chars) = 32 chars
            header_str = f"{'รายการ/Item':<12}{'จำนวน':^4}{'ราคา':^8}{'รวม':>8}"
            
        printer.textln(header_str)
        printer.textln("-" * char_limit)

        # Sale Items
        for item in sale.items:
            name = item.custom_name if item.product_id is None else item.product.name
            # Truncate name if it's too long
            name_limit = 20 if width == 80 else 12
            if len(name) > name_limit:
                name_display = name[:name_limit-3] + "..."
            else:
                name_display = name

            qty_str = f"{item.sold_qty} {item.sold_unit}"
            price_str = f"{item.unit_price:.2f}"
            sub_str = f"{item.subtotal:.2f}"

            if width == 80:
                item_line = f"{name_display:<20}{qty_str:^8}{price_str:^10}{sub_str:>10}"
            else:
                item_line = f"{name_display:<12}{qty_str:^4}{price_str:^8}{sub_str:>8}"
            
            # Print item line in Thai encoding CP874
            try:
                printer._raw(item_line.encode("cp874") + b"\n")
            except Exception:
                printer.textln(item_line)

        printer.textln("-" * char_limit)

        # Summary / Totals
        printer.set(align="right")
        printer.textln(f"ยอดรวมทั้งหมด/Total: {sale.total_amount:.2f} บาท")
        
        if sale.payment_type == "govt_welfare" and welfare_txn:
            printer.textln(f"สวัสดิการรัฐ ({welfare_txn.scheme_name}): -{sale.discount_govt:.2f} บาท")
            printer.textln(f"ยอดที่ลูกค้าต้องจ่ายจริง: {welfare_txn.customer_portion:.2f} บาท")
            
        printer.textln(f"รับเงินสด/Cash: {sale.cash_received:.2f} บาท")
        printer.textln(f"เงินทอน/Change: {sale.change_due:.2f} บาท")
        printer.textln("-" * char_limit)
        
        # Payment Type Label
        pay_labels = {"cash": "เงินสด (CASH)", "qr": "สแกน QR จ่าย (QR)", "govt_welfare": "สวัสดิการรัฐ (WELFARE)"}
        printer.set(align="center")
        printer.textln(f"ช่องทางชำระ: {pay_labels.get(sale.payment_type, sale.payment_type)}")
        printer.textln("ขอบคุณที่ใช้บริการ / Thank you")
        
        # Feed and Cut
        printer.cut()
        
        # Kick Cash Drawer
        # ESC p m t1 t2: 0x1b 0x70 0x00 0x19 0xfa
        printer._raw(b'\x1b\x70\x00\x19\xfa')
        
        printer.close()
        return True, "พิมพ์ใบเสร็จและดีดลิ้นชักสำเร็จ"
    except Exception as e:
        logger.error(f"Printer error: {e}")
        return False, f"ข้อผิดพลาดเครื่องพิมพ์: {str(e)}"

def generate_dummy_receipt_text(sale: Sale, welfare_txn: GovtWelfareTxn = None) -> str:
    """Helper to generate a formatted text receipt for debugging logs."""
    lines = []
    lines.append("        GROCERY POS STORE        ")
    lines.append("      ร้านค้าชุมชน / grocery store  ")
    lines.append("-" * 40)
    lines.append(f"Bill No: {sale.sale_no}")
    lines.append(f"Date: {sale.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"Cashier: {sale.employee.name if sale.employee else 'N/A'}")
    lines.append(f"Terminal: {sale.terminal_id}")
    lines.append("-" * 40)
    lines.append(f"{'Item':<18}{'Qty':^8}{'Price':^6}{'Sub':^8}")
    lines.append("-" * 40)
    for item in sale.items:
        name = item.custom_name if item.product_id is None else item.product.name
        if len(name) > 16:
            name = name[:13] + "..."
        qty_str = f"{item.sold_qty} {item.sold_unit}"
        lines.append(f"{name:<18}{qty_str:^8}{item.unit_price:^6.2f}{item.subtotal:^8.2f}")
    lines.append("-" * 40)
    lines.append(f"Total: {sale.total_amount:.2f} THB")
    if sale.payment_type == "govt_welfare" and welfare_txn:
        lines.append(f"Gov Portion: -{sale.discount_govt:.2f} THB")
        lines.append(f"Customer Portion: {welfare_txn.customer_portion:.2f} THB")
    lines.append(f"Cash Received: {sale.cash_received:.2f} THB")
    lines.append(f"Change Due: {sale.change_due:.2f} THB")
    lines.append(f"Payment Type: {sale.payment_type}")
    lines.append("-" * 40)
    lines.append("     Thank you / ขอบคุณที่ใช้บริการ     ")
    return "\n".join(lines)
