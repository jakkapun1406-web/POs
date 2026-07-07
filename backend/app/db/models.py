import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)  # PIN Code (4-6 digits)
    name = Column(String, nullable=False)
    role = Column(String, default="cashier")  # "cashier" or "admin"
    active = Column(Boolean, default=True)

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    barcode = Column(String, unique=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    cost_price = Column(Float, default=0.0)      # Cost price per base unit
    sell_price = Column(Float, default=0.0)      # Sell price per base unit
    pack_sell_price = Column(Float, nullable=True) # Sell price per pack
    stock_qty = Column(Integer, default=0)        # Stored in base units
    base_unit = Column(String, default="ชิ้น")     # e.g., "ชิ้น"
    pack_unit = Column(String, default="แพ็ค")     # e.g., "แพ็ค"
    pack_size = Column(Integer, default=1)        # e.g., 24 (units per pack)
    tax_percent = Column(Float, default=7.0)
    labor_cost = Column(Float, default=0.0)
    market_price_cap = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class StockReceipt(Base):
    __tablename__ = "stock_receipts"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    qty_added = Column(Integer)  # Amount added in base units
    is_pack_receipt = Column(Boolean, default=False)
    received_pack_qty = Column(Integer, nullable=True)
    cost_price_new = Column(Float)  # New cost price per base unit
    employee_id = Column(Integer, ForeignKey("employees.id"))
    received_at = Column(DateTime, default=datetime.datetime.utcnow)

    product = relationship("Product")
    employee = relationship("Employee")

class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    sale_no = Column(String, unique=True, index=True)  # INV-YYYYMMDD-XXXX
    employee_id = Column(Integer, ForeignKey("employees.id"))
    terminal_id = Column(String)  # POS-01, POS-02
    total_amount = Column(Float)  # Total amount before discounts
    discount_govt = Column(Float, default=0.0)  # Government subsidy portion
    cash_received = Column(Float)  # Cash received from customer
    change_due = Column(Float)  # Change due to customer
    payment_type = Column(String)  # "cash", "qr", "govt_welfare"
    status = Column(String, default="completed")  # "completed", "returned"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    employee = relationship("Employee")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")

class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"))
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True) # NULL for custom items
    custom_name = Column(String, nullable=True)  # If product_id is NULL
    is_pack = Column(Boolean, default=False)
    sold_qty = Column(Float)  # Qty entered
    sold_unit = Column(String)  # "ชิ้น", "แพ็ค"
    qty_in_base_unit = Column(Integer)  # To subtract from stock
    unit_price = Column(Float)  # Price per sold unit
    subtotal = Column(Float)

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product")

class Return(Base):
    __tablename__ = "returns"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"))
    sale_no = Column(String, nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    refund_amount = Column(Float)
    reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    employee = relationship("Employee")
    sale = relationship("Sale")
    items = relationship("ReturnItem", back_populates="product_return", cascade="all, delete-orphan")

class ReturnItem(Base):
    __tablename__ = "return_items"

    id = Column(Integer, primary_key=True, index=True)
    return_id = Column(Integer, ForeignKey("returns.id"))
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    qty_returned = Column(Integer)  # in base unit
    refund_subtotal = Column(Float)

    product_return = relationship("Return", back_populates="items")
    product = relationship("Product")

class SuspendedBill(Base):
    __tablename__ = "suspended_bills"

    id = Column(Integer, primary_key=True, index=True)
    hold_no = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    cart_data = Column(Text)  # JSON string

    employee = relationship("Employee")

class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    printer_ip = Column(String, nullable=True)
    printer_port = Column(Integer, default=9100)
    receipt_width = Column(String, default="80mm")  # "58mm" or "80mm"
    govt_percent = Column(Float, default=60.0)      # Gov subsidy percentage (e.g. 60% for 'คนละครึ่ง')
    govt_daily_cap = Column(Float, default=150.0)   # Gov daily cap per person

class GovtWelfareTxn(Base):
    __tablename__ = "govt_welfare_txns"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"))
    scheme_name = Column(String, default="คนละครึ่ง")
    govt_portion = Column(Float)
    customer_portion = Column(Float)

    sale = relationship("Sale")
