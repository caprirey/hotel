from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List, Optional
import datetime
import os
import jwt
import bcrypt

from database import SessionLocal, engine, Room, Income, User

SECRET_KEY = "super-secret-hotel-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

app = FastAPI(title="Hotel Income Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            import bcrypt
            hashed = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode("utf-8")
            new_admin = User(username="admin", password_hash=hashed)
            db.add(new_admin)
            db.commit()
    finally:
        db.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
        
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

@app.post("/api/login")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

class IncomeCreate(BaseModel):
    room_number: str
    amount: float
    guests: int = 1
    date: str = None 
    rent_type: str = "full_day"
    hours: int = 0

class IncomeReset(BaseModel):
    room_number: str
    date: str = None
    
class IncomeCheckout(BaseModel):
    room_number: str
    date: str = None

class IncomeUpdate(BaseModel):
    amount: Optional[float] = None
    guests: Optional[int] = None
    rent_type: Optional[str] = None
    hours: Optional[int] = None

class IncomeHistoryResponse(BaseModel):
    id: int
    amount: float
    guests: int
    rent_type: str
    hours: int
    is_active: bool
    date: datetime.datetime

class RoomResponse(BaseModel):
    number: str
    status: str
    total_income_today: float

@app.put("/api/income/{income_id}")
def update_income(income_id: int, income_update: IncomeUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    record = db.query(Income).filter(Income.id == income_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
        
    if income_update.amount is not None:
        record.amount = income_update.amount
    if income_update.guests is not None:
        record.guests = income_update.guests
    if income_update.rent_type is not None:
        record.rent_type = income_update.rent_type
    if income_update.hours is not None:
        record.hours = income_update.hours
        
    db.commit()
    return {"message": "Record updated successfully"}

@app.delete("/api/income/{income_id}")
def delete_income(income_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    record = db.query(Income).filter(Income.id == income_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    db.delete(record)
    db.commit()
    return {"message": "Record deleted successfully"}

@app.get("/api/rooms", response_model=List[RoomResponse])
def get_rooms(date: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rooms = db.query(Room).all()
    
    if date:
        target_date = datetime.datetime.strptime(date, "%Y-%m-%d").date()
    else:
        target_date = datetime.datetime.utcnow().date()
        
    start_of_day = datetime.datetime.combine(target_date, datetime.time.min)
    end_of_day = datetime.datetime.combine(target_date, datetime.time.max)
    
    result = []
    for room in rooms:
        income_today = db.query(func.sum(Income.amount))\
                         .filter(Income.room_number == room.number)\
                         .filter(Income.date >= start_of_day)\
                         .filter(Income.date <= end_of_day)\
                         .scalar() or 0.0
                         
        active_income = db.query(Income).filter(
            Income.room_number == room.number,
            Income.date >= start_of_day,
            Income.date <= end_of_day,
            Income.is_active == True
        ).first()
        
        if active_income:
            status = "occupied_hourly" if active_income.rent_type == "hourly" else "occupied"
        else:
            status = "available"
        
        result.append({
            "number": room.number,
            "status": status,
            "total_income_today": income_today
        })
    return result

@app.post("/api/income")
def add_income(income: IncomeCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    room = db.query(Room).filter(Room.number == income.room_number).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if income.date:
        target_date = datetime.datetime.strptime(income.date, "%Y-%m-%d").date()
        target_datetime = datetime.datetime.combine(target_date, datetime.datetime.now().time())
    else:
        target_datetime = datetime.datetime.now()
        
    new_income = Income(
        room_number=income.room_number, 
        amount=income.amount,
        guests=income.guests,
        date=target_datetime,
        rent_type=income.rent_type,
        hours=income.hours,
        is_active=True
    )
    db.add(new_income)
    db.commit()
    return {"message": "Income recorded successfully"}

@app.post("/api/income/checkout")
def checkout_income(checkout_data: IncomeCheckout, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if checkout_data.date:
        target_date = datetime.datetime.strptime(checkout_data.date, "%Y-%m-%d").date()
    else:
        target_date = datetime.datetime.utcnow().date()
        
    start_of_day = datetime.datetime.combine(target_date, datetime.time.min)
    end_of_day = datetime.datetime.combine(target_date, datetime.time.max)
    
    active_incomes = db.query(Income).filter(
        Income.room_number == checkout_data.room_number,
        Income.date >= start_of_day,
        Income.date <= end_of_day,
        Income.is_active == True
    ).all()
    
    for inc in active_incomes:
        inc.is_active = False
        
    db.commit()
    return {"message": "Checkout successful"}

@app.post("/api/income/reset")
def reset_income(reset_data: IncomeReset, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if reset_data.date:
        target_date = datetime.datetime.strptime(reset_data.date, "%Y-%m-%d").date()
    else:
        target_date = datetime.datetime.utcnow().date()
        
    start_of_day = datetime.datetime.combine(target_date, datetime.time.min)
    end_of_day = datetime.datetime.combine(target_date, datetime.time.max)
    
    db.query(Income).filter(
        Income.room_number == reset_data.room_number,
        Income.date >= start_of_day,
        Income.date <= end_of_day
    ).delete()
    
    db.commit()
    return {"message": "Room reset successfully"}

@app.get("/api/income/{room_number}", response_model=List[IncomeHistoryResponse])
def get_room_history(room_number: str, date: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if date:
        target_date = datetime.datetime.strptime(date, "%Y-%m-%d").date()
    else:
        target_date = datetime.datetime.now().date()
        
    start_of_day = datetime.datetime.combine(target_date, datetime.time.min)
    end_of_day = datetime.datetime.combine(target_date, datetime.time.max)
    
    incomes = db.query(Income).filter(
        Income.room_number == room_number,
        Income.date >= start_of_day,
        Income.date <= end_of_day
    ).order_by(Income.date.asc()).all()
    
    return incomes

@app.get("/api/stats")
def get_stats(date: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if date:
        target_date = datetime.datetime.strptime(date, "%Y-%m-%d").date()
    else:
        target_date = datetime.datetime.utcnow().date()
        
    start_of_day = datetime.datetime.combine(target_date, datetime.time.min)
    end_of_day = datetime.datetime.combine(target_date, datetime.time.max)
    
    total_income = db.query(func.sum(Income.amount))\
                     .filter(Income.date >= start_of_day)\
                     .filter(Income.date <= end_of_day)\
                     .scalar() or 0.0
                     
    occupied_rooms = db.query(func.count(func.distinct(Income.room_number)))\
                       .filter(Income.date >= start_of_day)\
                       .filter(Income.date <= end_of_day)\
                       .filter(Income.is_active == True)\
                       .scalar() or 0
                       
    total_rooms = db.query(Room).count()
    
    return {
        "total_income_today": total_income,
        "occupied_rooms": occupied_rooms,
        "total_rooms": total_rooms
    }

@app.get("/api/analytics/trend")
def get_analytics_trend(
    group_by: str = "day", 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    now = datetime.datetime.now()
    if group_by == "day":
        start_date = now - datetime.timedelta(days=30)
    elif group_by == "week":
        start_date = now - datetime.timedelta(weeks=12)
    else:
        start_date = now - datetime.timedelta(days=365)
        
    dt_start = datetime.datetime.combine(start_date.date(), datetime.time.min)
    incomes = db.query(Income).filter(Income.date >= dt_start).all()
    
    data = {}
    for inc in incomes:
        if group_by == "day":
            key = inc.date.strftime("%Y-%m-%d")
        elif group_by == "week":
            # Fallback to year-week mapping format
            iso = inc.date.isocalendar()
            key = f"{iso[0]}-W{iso[1]:02d}"
        else:
            key = inc.date.strftime("%Y-%m")
            
        if key not in data:
            data[key] = {"income": 0.0, "unique_rooms": set()}
            
        data[key]["income"] += inc.amount
        data[key]["unique_rooms"].add(inc.room_number)
        
    results = []
    for k in sorted(data.keys()):
        results.append({
            "period": k,
            "income": data[k]["income"],
            "occupancy": len(data[k]["unique_rooms"])
        })
    return results

@app.get("/api/analytics/rooms")
def get_analytics_by_room(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    incomes = db.query(Income.room_number, func.sum(Income.amount).label("total"))\
                .group_by(Income.room_number).all()
    return [{"room_number": r[0], "total_income": r[1] or 0.0} for r in incomes]

frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
os.makedirs(frontend_dir, exist_ok=True)
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
