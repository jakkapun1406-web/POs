from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import bcrypt
import datetime
from app.db.database import get_db
from app.db.models import Employee

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = "GROCERY_POS_SECRET_KEY_LOCAL"  # In production, load from env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 1

class LoginRequest(BaseModel):
    pin: str
    employee_id: Optional[int] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    name: str
    id: int

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    # Fetch active employees
    if req.employee_id:
        employees = db.query(Employee).filter(Employee.id == req.employee_id, Employee.active == True).all()
    else:
        employees = db.query(Employee).filter(Employee.active == True).all()
        
    matched_employee = None
    # Verify PIN using bcrypt directly
    for emp in employees:
        try:
            # We encode strings to bytes before passing to bcrypt
            if bcrypt.checkpw(req.pin.encode("utf-8"), emp.code.encode("utf-8")):
                matched_employee = emp
                break
        except Exception:
            # Fallback for plain-text PINs
            if emp.code == req.pin:
                matched_employee = emp
                break
                
    if not matched_employee:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="รหัส PIN ไม่ถูกต้อง",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token = create_access_token(
        data={"sub": str(matched_employee.id), "role": matched_employee.role, "name": matched_employee.name}
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": matched_employee.role,
        "name": matched_employee.name,
        "id": matched_employee.id
    }

# Helper dependency to get current logged in employee
def get_current_employee(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="ไม่สามารถยืนยันตัวตนได้",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        employee_id: str = payload.get("sub")
        if employee_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    employee = db.query(Employee).filter(Employee.id == int(employee_id), Employee.active == True).first()
    if employee is None:
        raise credentials_exception
    return employee

# Helper dependency to verify Admin role
def get_current_admin(current_employee: Employee = Depends(get_current_employee)):
    if current_employee.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ไม่มีสิทธิ์เข้าถึง - เฉพาะผู้จัดการ/แอดมินเท่านั้น"
        )
    return current_employee

# Admin override PIN verify endpoint
class OverrideRequest(BaseModel):
    pin: str

@router.post("/override")
def admin_override(req: OverrideRequest, db: Session = Depends(get_db)):
    # Find any active admin whose PIN matches
    admins = db.query(Employee).filter(Employee.role == "admin", Employee.active == True).all()
    matched_admin = None
    for admin in admins:
        try:
            if bcrypt.checkpw(req.pin.encode("utf-8"), admin.code.encode("utf-8")):
                matched_admin = admin
                break
        except Exception:
            if admin.code == req.pin:
                matched_admin = admin
                break
                
    if not matched_admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="รหัส PIN แอดมินไม่ถูกต้อง"
        )
    return {"status": "success", "admin_name": matched_admin.name}

@router.get("/employees")
def get_active_employees(db: Session = Depends(get_db)):
    # Returns active employee names and roles (without PIN codes) for the dropdown list
    employees = db.query(Employee).filter(Employee.active == True).all()
    return [{"id": emp.id, "name": emp.name, "role": emp.role} for emp in employees]
