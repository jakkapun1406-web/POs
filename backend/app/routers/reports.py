from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, and_, not_
from sqlalchemy.orm import Session
from typing import Optional
import datetime
import io
import csv
from app.db.database import get_db
from app.db.models import Sale, SaleItem, Product, Employee
from app.routers.auth import get_current_admin

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/summary")
def get_sales_summary(
    start_date: Optional[str] = None, # YYYY-MM-DD
    end_date: Optional[str] = None,   # YYYY-MM-DD
    db: Session = Depends(get_db),
    current_admin: Employee = Depends(get_current_admin)
):
    query = db.query(Sale).filter(Sale.status == "completed")
    
    if start_date:
        start_dt = datetime.datetime.strptime(start_date, "%Y-%m-%d")
        query = query.filter(Sale.created_at >= start_dt)
    if end_date:
        end_dt = datetime.datetime.strptime(end_date, "%Y-%m-%d") + datetime.timedelta(days=1)
        query = query.filter(Sale.created_at < end_dt)
        
    sales = query.all()
    
    total_sales = sum(s.total_amount for s in sales)
    bill_count = len(sales)
    
    # Calculate payment breakdown
    payment_breakdown = {"cash": 0.0, "qr": 0.0, "govt_welfare": 0.0}
    for s in sales:
        payment_breakdown[s.payment_type] = payment_breakdown.get(s.payment_type, 0.0) + s.total_amount
        
    # Calculate profit
    # Profit = Sum of (Item.subtotal - Item.qty_in_base_unit * Product.cost_price)
    total_profit = 0.0
    sale_ids = [s.id for s in sales]
    if sale_ids:
        sale_items = db.query(SaleItem).filter(SaleItem.sale_id.in_(sale_ids)).all()
        for item in sale_items:
            # Get cost price of base unit
            cost = 0.0
            if item.product_id:
                product = db.query(Product).filter(Product.id == item.product_id).first()
                if product:
                    cost = product.cost_price
            # Profit for this item line = subtotal - (qty_in_base_unit * cost_price)
            # For custom items, cost is assumed to be 0 (all revenue is profit) or we can assume no cost
            total_profit += (item.subtotal - (item.qty_in_base_unit * cost))
            
    return {
        "total_sales": round(total_sales, 2),
        "total_profit": round(total_profit, 2),
        "bill_count": bill_count,
        "payment_breakdown": payment_breakdown
    }

@router.get("/items/best")
def get_best_sellers(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_admin: Employee = Depends(get_current_admin)
):
    # Sum of items sold by qty, grouped by product
    best_selling = db.query(
        SaleItem.product_id,
        SaleItem.custom_name,
        func.sum(SaleItem.qty_in_base_unit).label("total_qty"),
        func.sum(SaleItem.subtotal).label("total_revenue")
    ).join(Sale).filter(Sale.status == "completed")\
     .group_by(SaleItem.product_id, SaleItem.custom_name)\
     .order_by(func.sum(SaleItem.qty_in_base_unit).desc())\
     .limit(limit).all()
     
    result = []
    for row in best_selling:
        name = row.custom_name
        barcode = "N/A"
        if row.product_id:
            product = db.query(Product).filter(Product.id == row.product_id).first()
            if product:
                name = product.name
                barcode = product.barcode
        result.append({
            "product_id": row.product_id,
            "barcode": barcode,
            "name": name,
            "total_qty": int(row.total_qty or 0),
            "total_revenue": round(row.total_revenue or 0.0, 2)
        })
    return result

@router.get("/items/worst")
def get_worst_sellers(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_admin: Employee = Depends(get_current_admin)
):
    # Find products with zero or very low sales
    # Subquery of products sold in completed bills
    sold_product_ids = db.query(SaleItem.product_id)\
        .join(Sale).filter(Sale.status == "completed", SaleItem.product_id.isnot(None))\
        .distinct().all()
    sold_ids = [row[0] for row in sold_product_ids]

    # Products with zero sales
    zero_sales = db.query(Product).filter(not_(Product.id.in_(sold_ids)))\
        .order_by(Product.stock_qty.desc())\
        .limit(limit).all()

    result = []
    # Add zero sales first
    for p in zero_sales:
        result.append({
            "product_id": p.id,
            "barcode": p.barcode,
            "name": p.name,
            "total_qty": 0,
            "total_revenue": 0.0,
            "current_stock": p.stock_qty,
            "base_unit": p.base_unit
        })

    # If limit is not reached, find products with least sales
    if len(result) < limit:
        remaining_limit = limit - len(result)
        low_sales = db.query(
            SaleItem.product_id,
            func.sum(SaleItem.qty_in_base_unit).label("total_qty"),
            func.sum(SaleItem.subtotal).label("total_revenue")
        ).join(Sale).filter(Sale.status == "completed", SaleItem.product_id.isnot(None))\
         .group_by(SaleItem.product_id)\
         .order_by(func.sum(SaleItem.qty_in_base_unit).asc())\
         .limit(remaining_limit).all()

        for row in low_sales:
            product = db.query(Product).filter(Product.id == row.product_id).first()
            if product:
                result.append({
                    "product_id": row.product_id,
                    "barcode": product.barcode,
                    "name": product.name,
                    "total_qty": int(row.total_qty or 0),
                    "total_revenue": round(row.total_revenue or 0.0, 2),
                    "current_stock": product.stock_qty,
                    "base_unit": product.base_unit
                })

    return result[:limit]

@router.get("/export")
def export_sales_csv(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: Employee = Depends(get_current_admin)
):
    query = db.query(Sale)
    if start_date:
        start_dt = datetime.datetime.strptime(start_date, "%Y-%m-%d")
        query = query.filter(Sale.created_at >= start_dt)
    if end_date:
        end_dt = datetime.datetime.strptime(end_date, "%Y-%m-%d") + datetime.timedelta(days=1)
        query = query.filter(Sale.created_at < end_dt)

    sales = query.order_by(Sale.created_at.desc()).all()

    # Create CSV file in memory
    output = io.StringIO()
    # Write UTF-8 BOM so Excel opens it with Thai language correctly
    output.write('\ufeff')
    writer = csv.writer(output)
    
    # Headers
    writer.writerow([
        "เลขที่บิล", "พนักงาน", "เครื่อง POS", "ยอดรวม", 
        "ส่วนลดสวัสดิการรัฐ", "ยอดรับเงินสด", "เงินทอน", "ช่องทางชำระ", "สถานะ", "เวลาทำรายการ"
    ])
    
    for s in sales:
        writer.writerow([
            s.sale_no,
            s.employee.name if s.employee else "N/A",
            s.terminal_id,
            f"{s.total_amount:.2f}",
            f"{s.discount_govt:.2f}",
            f"{s.cash_received:.2f}",
            f"{s.change_due:.2f}",
            s.payment_type,
            s.status,
            s.created_at.strftime("%Y-%m-%d %H:%M:%S")
        ])

    # Convert to bytes stream
    mem_file = io.BytesIO(output.getvalue().encode("utf-8"))
    
    headers = {
        "Content-Disposition": f"attachment; filename=sales_report_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    }
    return StreamingResponse(mem_file, headers=headers, media_type="text/csv")
