from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./hotel.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String, unique=True, index=True)

class Income(Base):
    __tablename__ = "incomes"

    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String, index=True)
    amount = Column(Float)
    guests = Column(Integer, default=1)
    date = Column(DateTime, default=datetime.datetime.utcnow)
    rent_type = Column(String, default="full_day")
    hours = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)

Base.metadata.create_all(bind=engine)

def init_db():
    db = SessionLocal()
    if db.query(Room).count() == 0:
        rooms_list = ["202","301","302","303","304","305","401","402","403","404","405","406","407"]
        for r in rooms_list:
            db.add(Room(number=r))
        db.commit()
    db.close()

init_db()
