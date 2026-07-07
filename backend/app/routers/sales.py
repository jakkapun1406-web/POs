import json
import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
from app.db.database import get_db
from app.db.models import Product, Sale, SaleItem, Employee, Setting, GovtWelfareTxn, SuspendedBill, Return, ReturnItem
from app.routers.auth import get_current_employee, get_current_admin
from app.utils.printer import print_receipt, kick_drawer_only

router = APIRouter(prefix="/sales", tags=["sales"])

# Schemas
class SaleItemCreate(BaseModel):
    product_id: Optional[int] = None # NULL for custom items
    custom_name: Optional[str] = None # Name if product_id is NULL
    is_pack: bool = False
    sold_qty: float = Field(..., gt=0.0)
    sold_unit: str
    unit_price: float = Field(..., ge=0.0)
    subtotal: float = Field(..., ge=0.0)

class SaleCreate(BaseModel):
    terminal_id: str
    payment_type: str # "cash", "qr", "govt_welfare"
    total_amount: float = Field(..., ge=0.0)
    discount_govt: float = Field(0.0, ge=0.0)
    cash_received: float = Field(..., ge=0.0)
    change_due: float = Field(0.0, ge=0.0)
    items: List[SaleItemCreate]

# Sale Item Response
class SaleItemResponse(BaseModel):
    id: int
    product_id: Optional[int]
    custom_name: Optional[str]
    is_pack: bool
    sold_qty: float
    sold_unit: str
    qty_in_base_unit: int
    unit_price: float
    subtotal: float
    
    class Config:
        orm_mode = True

# Sale Response
class SaleResponse(BaseModel):
    id: int
    sale_no: str
    employee_id: int
    terminal_id: str
    total_amount: float
    discount_govt: float
    cash_received: float
    change_due: float
    payment_type: str
    status: str
    created_at: datetime.datetime
    items: List[SaleItemResponse]

    class Config:
        orm_mode = True

# Suspend Bill Schemas
class SuspendRequest(BaseModel):
    hold_no: str
    cart_data: str # JSON representation of frontend cart

class SuspendedBillResponse(BaseModel):
    id: int
    hold_no: str
    created_at: datetime.datetime
    employee_id: int
    cart_data: str

    class Config:
        orm_mode = True

# Returns Schemas
class ReturnItemRequest(BaseModel):
    sale_item_id: int
    qty_returned: int # In base units

class ReturnRequest(BaseModel):
    sale_id: int
    reason: Optional[str] = None
    items: List[ReturnItemRequest]

@router.post("/", response_model=SaleResponse)
def create_sale(sale_data: SaleCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_emp: Employee = Depends(get_current_employee)):
    # 1. Generate unique invoice number: INV-YYYYMMDD-XXXX
    today_str = datetime.datetime.utcnow().strftime("%Y%m%d")
    # Find count of sales today to increment XXXX
    sales_today = db.query(Sale).filter(Sale.sale_no.like(f"INV-{today_str}-%")).count()
    sale_no = f"INV-{today_str}-{(sales_today + 1):04d}"

    # 2. Verify products exist and subtract stock
    db_items = []
    for item in sale_data.items:
        qty_in_base_unit = 0
        if item.product_id:
            # Registered product
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if not product:
                raise HTTPException(status_code=400, detail=f"ไม่พบรหัสสินค้า #{item.product_id}")
                
            qty_in_base_unit = int(item.sold_qty * product.pack_size) if item.is_pack else int(item.sold_qty)
            
            if product.stock_qty < qty_in_base_unit:
                raise HTTPException(status_code=400, detail=f"สินค้า '{product.name}' มีสต็อกไม่พอขาย (คงเหลือ {product.stock_qty} {product.base_unit})")
                
            # Subtract stock
            product.stock_qty -= qty_in_base_unit
        else:
            # Custom item
            if not item.custom_name:
                raise HTTPException(status_code=400, detail="กรุณากรอกชื่อสินค้าสำหรับรายการกำหนดเอง")
            qty_in_base_unit = int(item.sold_qty)

        # Create SaleItem DB object
        db_item = SaleItem(
            product_id=item.product_id,
            custom_name=item.custom_name,
            is_pack=item.is_pack,
            sold_qty=item.sold_qty,
            sold_unit=item.sold_unit,
            qty_in_base_unit=qty_in_base_unit,
            unit_price=item.unit_price,
            subtotal=item.subtotal
        )
        db_items.append(db_item)

    # 3. Create Sale object
    db_sale = Sale(
        sale_no=sale_no,
        employee_id=current_emp.id,
        terminal_id=sale_data.terminal_id,
        total_amount=sale_data.total_amount,
        discount_govt=sale_data.discount_govt,
        cash_received=sale_data.cash_received,
        change_due=sale_data.change_due,
        payment_type=sale_data.payment_type,
        status="completed",
        items=db_items
    )
    
    db.add(db_sale)
    db.flush() # Flush to get db_sale.id

    # 4. If government welfare payment, record details
    db_welfare = None
    if sale_data.payment_type == "govt_welfare" and sale_data.discount_govt > 0:
        db_welfare = GovtWelfareTxn(
            sale_id=db_sale.id,
            scheme_name="คนละครึ่ง",
            govt_portion=sale_data.discount_govt,
            customer_portion=sale_data.total_amount - sale_data.discount_govt
        )
        db.add(db_welfare)

    db.commit()
    db.refresh(db_sale)

    # 5. Load Settings and print receipt asynchronously (background task)
    settings = db.query(Setting).first()
    background_tasks.add_task(print_receipt, db_sale, settings, db_welfare)

    return db_sale

@router.get("/history", response_model=List[SaleResponse])
def get_sales_history(
    sale_no: Optional[str] = None,
    cashier_id: Optional[int] = None,
    start_date: Optional[str] = None, # YYYY-MM-DD
    end_date: Optional[str] = None, # YYYY-MM-DD
    db: Session = Depends(get_db),
    current_emp: Employee = Depends(get_current_employee)
):
    query = db.query(Sale)

    # Apply filters
    if sale_no:
        query = query.filter(Sale.sale_no.ilike(f"%{sale_no}%"))
    if cashier_id:
        query = query.filter(Sale.employee_id == cashier_id)
        
    if start_date:
        try:
            start_dt = datetime.datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(Sale.created_at >= start_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="รูปแบบวันที่เริ่มต้นไม่ถูกต้อง ควรเป็น YYYY-MM-DD")
            
    if end_date:
        try:
            end_dt = datetime.datetime.strptime(end_date, "%Y-%m-%d") + datetime.timedelta(days=1)
            query = query.filter(Sale.created_at < end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="รูปแบบวันที่สิ้นสุดไม่ถูกต้อง ควรเป็น YYYY-MM-DD")

    return query.order_by(Sale.created_at.desc()).all()

# Suspend & Resume Bills
@router.post("/suspend", response_model=SuspendedBillResponse)
def suspend_bill(req: SuspendRequest, db: Session = Depends(get_db), current_emp: Employee = Depends(get_current_employee)):
    # Check if hold_no already exists, delete it first (overwrite)
    existing = db.query(SuspendedBill).filter(SuspendedBill.hold_no == req.hold_no).first()
    if existing:
        db.delete(existing)
        
    db_bill = SuspendedBill(
        hold_no=req.hold_no,
        employee_id=current_emp.id,
        cart_data=req.cart_data
    )
    db.add(db_bill)
    db.commit()
    db.refresh(db_bill)
    return db_bill

@router.get("/suspended", response_model=List[SuspendedBillResponse])
def get_suspended_bills(db: Session = Depends(get_db), current_emp: Employee = Depends(get_current_employee)):
    return db.query(SuspendedBill).order_by(SuspendedBill.created_at.desc()).all()

@router.delete("/suspended/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_suspended_bill(bill_id: int, db: Session = Depends(get_db), current_emp: Employee = Depends(get_current_employee)):
    db_bill = db.query(SuspendedBill).filter(SuspendedBill.id == bill_id).first()
    if not db_bill:
        raise HTTPException(status_code=404, detail="ไม่พบรายการบิลที่พักไว้")
    db.delete(db_bill)
    db.commit()
    return None

# Returns & Refunds
@router.post("/return")
def return_sale_items(req: ReturnRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_emp: Employee = Depends(get_current_employee)):
    sale = db.query(Sale).filter(Sale.id == req.sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="ไม่พบประวัติการขายนี้")
    if sale.status == "returned":
        raise HTTPException(status_code=400, detail="บิลนี้ทำรายการคืนสินค้าไปแล้ว")

    total_refund = 0.0
    return_items = []
    
    for req_item in req.items:
        # Find the sale item
        sale_item = db.query(SaleItem).filter(SaleItem.id == req_item.sale_item_id, SaleItem.sale_id == sale.id).first()
        if not sale_item:
            raise HTTPException(status_code=400, detail=f"ไม่พบรายการสินค้า #{req_item.sale_item_id} ในบิลนี้")

        # Validate return qty
        if req_item.qty_returned > sale_item.qty_in_base_unit:
            raise HTTPException(status_code=400, detail=f"จำนวนคืนสินค้ามากเกินไป (ซื้อมา {sale_item.qty_in_base_unit} แต่ระบุคืน {req_item.qty_returned})")

        # Add back to stock if registered product
        if sale_item.product_id:
            product = db.query(Product).filter(Product.id == sale_item.product_id).first()
            if product:
                product.stock_qty += req_item.qty_returned

        # Calculate refund subtotal
        # Price per base unit = sale_item.unit_price / pack_size (if it was a pack)
        # Actually sale_item.subtotal / sale_item.qty_in_base_unit gives accurate price per base unit
        price_per_base = sale_item.subtotal / sale_item.qty_in_base_unit
        item_refund = price_per_base * req_item.qty_returned
        total_refund += item_refund
        
        db_return_item = ReturnItem(
            product_id=sale_item.product_id,
            qty_returned=req_item.qty_returned,
            refund_subtotal=item_refund
        )
        return_items.append(db_return_item)

    # If partial return, we decrease total_amount, but let's record a dedicated return record
    db_return = Return(
        sale_id=sale.id,
        sale_no=sale.sale_no,
        employee_id=current_emp.id,
        refund_amount=total_refund,
        reason=req.reason,
        items=return_items
    )
    
    # Mark sale status as returned (or partially returned, for simplicity we update status to returned)
    sale.status = "returned"
    
    db.add(db_return)
    db.commit()
    
    # Kick drawer for cash return
    settings = db.query(Setting).first()
    if settings:
        background_tasks.add_task(kick_drawer_only, settings.printer_ip, settings.printer_port)
        
    return {
        "status": "success",
        "refund_amount": total_refund,
        "return_id": db_return.id
    }

# manual cash drawer kick API
@router.post("/kick-drawer")
def trigger_cash_drawer(db: Session = Depends(get_db), current_admin: Employee = Depends(get_current_admin)):
    settings = db.query(Setting).first()
    if not settings:
        raise HTTPException(status_code=400, detail="ไม่ได้ตั้งค่าเครื่องพิมพ์")
    success, msg = kick_drawer_only(settings.printer_ip, settings.printer_port)
    if not success:
        raise HTTPException(status_code=500, detail=msg)
    return {"status": "success", "detail": msg}

# Reprint Receipt API
@router.post("/{sale_id}/reprint")
def reprint_receipt(
    sale_id: int, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db), 
    current_emp: Employee = Depends(get_current_employee)
):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลบิลการขาย")
        
    settings = db.query(Setting).first()
    if not settings:
        raise HTTPException(status_code=400, detail="ไม่ได้ตั้งค่าเครื่องพิมพ์")
        
    welfare_txn = db.query(GovtWelfareTxn).filter(GovtWelfareTxn.sale_id == sale.id).first()
    
    background_tasks.add_task(print_receipt, sale, settings, welfare_txn)
    
    return {"status": "success", "detail": "กำลังพิมพ์ใบเสร็จซ้ำ..."}
