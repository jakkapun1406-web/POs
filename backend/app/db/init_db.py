import sys
import os
import bcrypt

# Add parent directory to sys.path so we can run this script directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.db.database import engine, SessionLocal, Base
from app.db.models import Employee, Product, Setting

def init_db():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # 1. Seed Employee if none exists
        if db.query(Employee).count() == 0:
            print("Seeding initial administrator...")
            # We use bcrypt directly to avoid passlib compatibility issues with bcrypt 4+ on Python 3.14
            admin_pin_hash = bcrypt.hashpw(b"9999", bcrypt.gensalt()).decode("utf-8")
            cashier_pin_hash = bcrypt.hashpw(b"1111", bcrypt.gensalt()).decode("utf-8")
            
            admin = Employee(code=admin_pin_hash, name="แอดมินระบบ (เจ้าของร้าน)", role="admin", active=True)
            cashier = Employee(code=cashier_pin_hash, name="แคชเชียร์หน้าร้าน", role="cashier", active=True)
            
            db.add(admin)
            db.add(cashier)
            print("Initial employees seeded: Admin PIN: 9999, Cashier PIN: 1111")
        
        # 2. Seed Default Settings
        if db.query(Setting).count() == 0:
            print("Seeding default settings...")
            default_setting = Setting(
                printer_ip="192.168.1.200",
                printer_port=9100,
                receipt_width="80mm",
                govt_percent=60.0,
                govt_daily_cap=150.0
            )
            db.add(default_setting)
            print("Default settings seeded.")
            
        # 3. Seed Sample Products if empty
        if db.query(Product).count() == 0:
            print("Seeding sample products...")
            p1 = Product(
                barcode="8850029010012",
                name="น้ำดื่มตราสิงห์ 600มล",
                category="เครื่องดื่ม",
                cost_price=4.0,
                sell_price=7.0,
                pack_sell_price=75.0, # 12 bottles = 75 Baht
                stock_qty=120,        # 120 bottles
                base_unit="ขวด",
                pack_unit="แพ็ค (12 ขวด)",
                pack_size=12,
                tax_percent=7.0,
                labor_cost=0.5,
                market_price_cap=10.0
            )
            p2 = Product(
                barcode="8850999111222",
                name="มาม่าต้มยำกุ้ง 60ก",
                category="อาหารสำเร็จรูป",
                cost_price=5.0,
                sell_price=7.0,
                pack_sell_price=180.0, # 30 packs = 180 Baht
                stock_qty=300,        # 300 packs
                base_unit="ซอง",
                pack_unit="กล่อง (30 ซอง)",
                pack_size=30,
                tax_percent=7.0,
                labor_cost=0.2,
                market_price_cap=8.0
            )
            p3 = Product(
                barcode="8851001234567",
                name="นมจืดโฟร์โมสต์ 225มล",
                category="เครื่องดื่ม",
                cost_price=9.5,
                sell_price=12.5,
                pack_sell_price=430.0, # 36 boxes = 430 Baht
                stock_qty=144,        # 144 boxes
                base_unit="กล่อง",
                pack_unit="ลัง (36 กล่อง)",
                pack_size=36,
                tax_percent=0.0,
                labor_cost=0.5,
                market_price_cap=15.0
            )
            db.add_all([p1, p2, p3])
            print("Sample products seeded.")
            
        db.commit()
        print("Database initialization completed successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error initializing database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
