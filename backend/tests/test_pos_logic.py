import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import Base
from app.db.models import Product, Sale, SaleItem, Employee, Setting, GovtWelfareTxn, SuspendedBill

# Use in-memory SQLite for testing logic
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        # Seed default settings
        setting = Setting(
            printer_ip="127.0.0.1",
            printer_port=9100,
            receipt_width="80mm",
            govt_percent=60.0,
            govt_daily_cap=150.0
        )
        # Seed employee
        emp = Employee(id=1, code="1234", name="Test cashier", role="cashier", active=True)
        # Seed product
        p = Product(
            id=1,
            barcode="1111",
            name="Test Product",
            cost_price=10.0,
            sell_price=15.0,
            pack_sell_price=140.0,
            stock_qty=100,
            base_unit="ชิ้น",
            pack_unit="แพ็ค",
            pack_size=10
        )
        db.add(setting)
        db.add(emp)
        db.add(p)
        db.commit()
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_welfare_calculation_logic(db_session):
    """Test government welfare calculation with 60% subsidy capped at 150 Baht."""
    settings = db_session.query(Setting).first()
    assert settings.govt_percent == 60.0
    assert settings.govt_daily_cap == 150.0

    # Case 1: Total bill is 100 Baht.
    # 60% of 100 is 60 Baht (under 150 cap)
    # Customer pays 40 Baht
    total_amount = 100.0
    govt_percent = settings.govt_percent
    govt_daily_cap = settings.govt_daily_cap

    calculated_govt = total_amount * (govt_percent / 100.0)
    discount_govt = min(calculated_govt, govt_daily_cap)
    customer_portion = total_amount - discount_govt

    assert discount_govt == 60.0
    assert customer_portion == 40.0

    # Change calculation
    cash_received = 50.0
    change_due = cash_received - customer_portion
    assert change_due == 10.0

    # Case 2: Total bill is 300 Baht.
    # 60% of 300 is 180 Baht (exceeds 150 cap)
    # Gov portion capped at 150. Customer pays 150 Baht
    total_amount2 = 300.0
    calculated_govt2 = total_amount2 * (govt_percent / 100.0)
    discount_govt2 = min(calculated_govt2, govt_daily_cap)
    customer_portion2 = total_amount2 - discount_govt2

    assert discount_govt2 == 150.0
    assert customer_portion2 == 150.0

def test_pack_unit_conversion_deduction(db_session):
    """Test that selling pack vs unit deducts correctly from base units stock."""
    product = db_session.query(Product).filter(Product.id == 1).first()
    assert product.stock_qty == 100
    assert product.pack_size == 10  # 10 base units in 1 pack

    # Case 1: Sell 2 pieces (base units)
    qty_sold_pieces = 2.0
    is_pack_pieces = False
    qty_deducted_pieces = int(qty_sold_pieces * product.pack_size) if is_pack_pieces else int(qty_sold_pieces)
    assert qty_deducted_pieces == 2
    product.stock_qty -= qty_deducted_pieces
    assert product.stock_qty == 98

    # Case 2: Sell 3 packs (pack units)
    qty_sold_packs = 3.0
    is_pack_packs = True
    qty_deducted_packs = int(qty_sold_packs * product.pack_size) if is_pack_packs else int(qty_sold_packs)
    assert qty_deducted_packs == 30
    product.stock_qty -= qty_deducted_packs
    assert product.stock_qty == 68

def test_suspend_resume_bill_serialization(db_session):
    """Test serializing and saving cart data for suspended bills."""
    cart = [
        {"product_id": 1, "name": "Test Product", "qty": 2, "is_pack": False, "price": 15.0},
        {"product_id": None, "name": "Custom Product", "qty": 1, "is_pack": False, "price": 50.0}
    ]
    cart_json = json_serialize(cart)
    
    suspended = SuspendedBill(
        hold_no="HOLD-01",
        employee_id=1,
        cart_data=cart_json
    )
    db_session.add(suspended)
    db_session.commit()

    retrieved = db_session.query(SuspendedBill).filter(SuspendedBill.hold_no == "HOLD-01").first()
    assert retrieved is not None
    loaded_cart = json_deserialize(retrieved.cart_data)
    assert len(loaded_cart) == 2
    assert loaded_cart[0]["product_id"] == 1
    assert loaded_cart[1]["product_id"] is None
    assert loaded_cart[1]["name"] == "Custom Product"

def json_serialize(data):
    import json
    return json.dumps(data)

def json_deserialize(data_str):
    import json
    return json.loads(data_str)
