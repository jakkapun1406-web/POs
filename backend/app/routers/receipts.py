from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
import datetime
from app.db.database import get_db
from app.db.models import Product, StockReceipt, Employee
from app.routers.auth import get_current_employee

router = APIRouter(prefix="/receipts", tags=["receipts"])

class ReceiptCreate(BaseModel):
    product_id: int
    qty: float = Field(..., gt=0.0) # Quantity entered (can be pack quantity or base unit quantity)
    is_pack: bool = False
    cost_price: float = Field(..., ge=0.0) # Cost price of the selected unit (per unit or per pack)
    update_product_cost: bool = True

class ReceiptResponse(BaseModel):
    id: int
    product_id: int
    qty_added: int
    is_pack_receipt: bool
    received_pack_qty: Optional[int]
    cost_price_new: float
    employee_id: int
    received_at: datetime.datetime

    class Config:
        from_attributes = True

@router.post("/", response_model=ReceiptResponse, status_code=status.HTTP_201_CREATED)
def create_stock_receipt(receipt: ReceiptCreate, db: Session = Depends(get_db), current_emp: Employee = Depends(get_current_employee)):
    product = db.query(Product).filter(Product.id == receipt.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="ไม่พบสินค้านี้ในคลัง")
        
    # Calculate base units and unit cost
    if receipt.is_pack:
        qty_added = int(receipt.qty * product.pack_size)
        received_pack_qty = int(receipt.qty)
        cost_price_new = receipt.cost_price / product.pack_size
    else:
        qty_added = int(receipt.qty)
        received_pack_qty = None
        cost_price_new = receipt.cost_price
        
    # Create receipt record
    db_receipt = StockReceipt(
        product_id=receipt.product_id,
        qty_added=qty_added,
        is_pack_receipt=receipt.is_pack,
        received_pack_qty=received_pack_qty,
        cost_price_new=round(cost_price_new, 4),
        employee_id=current_emp.id
    )
    
    # Update main stock quantity
    product.stock_qty += qty_added
    
    # Update main cost price if requested
    if receipt.update_product_cost:
        product.cost_price = round(cost_price_new, 4)
        
    db.add(db_receipt)
    db.commit()
    db.refresh(db_receipt)
    
    return db_receipt

@router.get("/", response_model=List[ReceiptResponse])
def get_receipt_history(db: Session = Depends(get_db), current_emp: Employee = Depends(get_current_employee)):
    # Returns last 100 receipts
    return db.query(StockReceipt).order_by(StockReceipt.received_at.desc()).limit(100).all()
