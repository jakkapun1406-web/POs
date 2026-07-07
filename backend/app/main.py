from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from app.db.database import get_db, engine, Base
from app.db.models import Setting, Employee
from app.routers import auth, products, receipts, sales, reports
from app.routers.auth import get_current_admin

# Create database tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Grocery Store POS API",
    description="Backend API for local multi-terminal grocery POS",
    version="1.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(receipts.router)
app.include_router(sales.router)
app.include_router(reports.router)

# Settings Schema
class SettingUpdate(BaseModel):
    printer_ip: Optional[str] = None
    printer_port: int = Field(9100, ge=1)
    receipt_width: str = Field("80mm", pattern="^(58mm|80mm)$")
    govt_percent: float = Field(60.0, ge=0.0, le=100.0)
    govt_daily_cap: float = Field(150.0, ge=0.0)

@app.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(Setting).first()
    if not settings:
        # Create default
        settings = Setting(
            printer_ip="192.168.1.200",
            printer_port=9100,
            receipt_width="80mm",
            govt_percent=60.0,
            govt_daily_cap=150.0
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@app.put("/settings")
def update_settings(data: SettingUpdate, db: Session = Depends(get_db), current_admin: Employee = Depends(get_current_admin)):
    settings = db.query(Setting).first()
    if not settings:
        settings = Setting()
        db.add(settings)
        
    settings.printer_ip = data.printer_ip
    settings.printer_port = data.printer_port
    settings.receipt_width = data.receipt_width
    settings.govt_percent = data.govt_percent
    settings.govt_daily_cap = data.govt_daily_cap
    
    db.commit()
    db.refresh(settings)
    return settings

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Grocery POS Server is running."}
