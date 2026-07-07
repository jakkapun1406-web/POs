from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
import csv
import io
import datetime
from app.db.database import get_db
from app.db.models import Product, Employee, StockReceipt
from app.routers.auth import get_current_employee, get_current_admin

router = APIRouter(prefix="/products", tags=["products"])

class ProductBase(BaseModel):
    barcode: str
    name: str
    category: Optional[str] = None
    cost_price: float = Field(..., ge=0.0)
    sell_price: float = Field(..., ge=0.0)
    pack_sell_price: Optional[float] = Field(None, ge=0.0)
    stock_qty: int = Field(0, ge=0)
    base_unit: str = "ชิ้น"
    pack_unit: str = "แพ็ค"
    pack_size: int = Field(1, ge=1)
    tax_percent: float = Field(7.0, ge=0.0)
    labor_cost: float = Field(0.0, ge=0.0)
    market_price_cap: float = Field(0.0, ge=0.0)

class ProductCreate(ProductBase):
    pass

class ProductUpdate(ProductBase):
    pass

class ProductResponse(ProductBase):
    id: int
    updated_at: datetime.datetime
    recommended_price: float
    warning_price_cap: bool

    class Config:
        from_attributes = True

# Helper to calculate price recommendation
def get_price_recommendation(cost_price: float, tax_percent: float, labor_cost: float, market_price_cap: float):
    rec_price = cost_price + (cost_price * (tax_percent / 100.0)) + labor_cost
    warning = False
    if market_price_cap > 0 and rec_price > market_price_cap:
        warning = True
    return round(rec_price, 2), warning

@router.get("/", response_model=List[ProductResponse])
def get_products(db: Session = Depends(get_db), current_emp: Employee = Depends(get_current_employee)):
    products = db.query(Product).all()
    results = []
    for p in products:
        rec_price, warning = get_price_recommendation(p.cost_price, p.tax_percent, p.labor_cost, p.market_price_cap)
        p_dict = p.__dict__.copy()
        p_dict["recommended_price"] = rec_price
        p_dict["warning_price_cap"] = warning
        results.append(ProductResponse(**p_dict))
    return results

@router.get("/barcode/{barcode}", response_model=ProductResponse)
def get_product_by_barcode(barcode: str, db: Session = Depends(get_db), current_emp: Employee = Depends(get_current_employee)):
    p = db.query(Product).filter(Product.barcode == barcode).first()
    if not p:
        raise HTTPException(status_code=404, detail="ไม่พบสินค้าจากบาร์โค้ดนี้")
    rec_price, warning = get_price_recommendation(p.cost_price, p.tax_percent, p.labor_cost, p.market_price_cap)
    p_dict = p.__dict__.copy()
    p_dict["recommended_price"] = rec_price
    p_dict["warning_price_cap"] = warning
    return ProductResponse(**p_dict)

@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(product: ProductCreate, db: Session = Depends(get_db), current_admin: Employee = Depends(get_current_admin)):
    # Check duplicate barcode
    existing = db.query(Product).filter(Product.barcode == product.barcode).first()
    if existing:
        raise HTTPException(status_code=400, detail="รหัสบาร์โค้ดนี้มีอยู่ในระบบแล้ว")
        
    db_product = Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    
    rec_price, warning = get_price_recommendation(db_product.cost_price, db_product.tax_percent, db_product.labor_cost, db_product.market_price_cap)
    p_dict = db_product.__dict__.copy()
    p_dict["recommended_price"] = rec_price
    p_dict["warning_price_cap"] = warning
    return ProductResponse(**p_dict)

@router.put("/{product_id}", response_model=ProductResponse)
def update_product(product_id: int, product_data: ProductUpdate, db: Session = Depends(get_db), current_admin: Employee = Depends(get_current_admin)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="ไม่พบสินค้าที่ต้องการแก้ไข")
        
    # Check duplicate barcode if barcode is changed
    if db_product.barcode != product_data.barcode:
        existing = db.query(Product).filter(Product.barcode == product_data.barcode).first()
        if existing:
            raise HTTPException(status_code=400, detail="รหัสบาร์โค้ดใหม่นี้มีอยู่ในระบบแล้ว")

    # Update fields
    for key, value in product_data.model_dump().items():
        setattr(db_product, key, value)
        
    db.commit()
    db.refresh(db_product)
    
    rec_price, warning = get_price_recommendation(db_product.cost_price, db_product.tax_percent, db_product.labor_cost, db_product.market_price_cap)
    p_dict = db_product.__dict__.copy()
    p_dict["recommended_price"] = rec_price
    p_dict["warning_price_cap"] = warning
    return ProductResponse(**p_dict)

class PriceUpdate(BaseModel):
    sell_price: float = Field(..., ge=0.0)
    pack_sell_price: Optional[float] = Field(None, ge=0.0)

# Quick permanent update of sell price (used in POS admin override when permanent check is ticked)
@router.put("/{product_id}/price", response_model=ProductResponse)
def update_product_price_only(product_id: int, price_data: PriceUpdate, db: Session = Depends(get_db), current_admin: Employee = Depends(get_current_admin)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="ไม่พบสินค้า")
        
    db_product.sell_price = price_data.sell_price
    db_product.pack_sell_price = price_data.pack_sell_price
    db.commit()
    db.refresh(db_product)
    
    rec_price, warning = get_price_recommendation(db_product.cost_price, db_product.tax_percent, db_product.labor_cost, db_product.market_price_cap)
    p_dict = db_product.__dict__.copy()
    p_dict["recommended_price"] = rec_price
    p_dict["warning_price_cap"] = warning
    return ProductResponse(**p_dict)

@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db), current_admin: Employee = Depends(get_current_admin)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="ไม่พบสินค้าที่ต้องการลบ")
    db.delete(db_product)
    db.commit()
    return None

# Import CSV Endpoint
@router.post("/import")
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db), current_admin: Employee = Depends(get_current_admin)):
    contents = await file.read()
    string_io = io.StringIO(contents.decode("utf-8-sig")) # utf-8-sig handles BOM in Thai excel export
    reader = csv.DictReader(string_io)
    
    imported_count = 0
    updated_count = 0
    
    for row in reader:
        try:
            barcode = row["barcode"].strip()
            name = row["name"].strip()
            category = row.get("category", "").strip()
            cost_price = float(row.get("cost_price", 0.0))
            sell_price = float(row.get("sell_price", 0.0))
            pack_sell_price_val = row.get("pack_sell_price")
            pack_sell_price = float(pack_sell_price_val) if pack_sell_price_val else None
            stock_qty = int(row.get("stock_qty", 0))
            base_unit = row.get("base_unit", "ชิ้น").strip()
            pack_unit = row.get("pack_unit", "แพ็ค").strip()
            pack_size = int(row.get("pack_size", 1))
            tax_percent = float(row.get("tax_percent", 7.0))
            labor_cost = float(row.get("labor_cost", 0.0))
            market_price_cap = float(row.get("market_price_cap", 0.0))
            
            existing = db.query(Product).filter(Product.barcode == barcode).first()
            if existing:
                existing.name = name
                existing.category = category
                existing.cost_price = cost_price
                existing.sell_price = sell_price
                existing.pack_sell_price = pack_sell_price
                existing.stock_qty = stock_qty
                existing.base_unit = base_unit
                existing.pack_unit = pack_unit
                existing.pack_size = pack_size
                existing.tax_percent = tax_percent
                existing.labor_cost = labor_cost
                existing.market_price_cap = market_price_cap
                updated_count += 1
            else:
                new_product = Product(
                    barcode=barcode,
                    name=name,
                    category=category,
                    cost_price=cost_price,
                    sell_price=sell_price,
                    pack_sell_price=pack_sell_price,
                    stock_qty=stock_qty,
                    base_unit=base_unit,
                    pack_unit=pack_unit,
                    pack_size=pack_size,
                    tax_percent=tax_percent,
                    labor_cost=labor_cost,
                    market_price_cap=market_price_cap
                )
                db.add(new_product)
                imported_count += 1
        except Exception as e:
            # Continue import even if one row fails, in a real system we'd log this row number
            continue
            
    db.commit()
    return {"status": "success", "imported": imported_count, "updated": updated_count}
