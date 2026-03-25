import sys
import os

sys.path.append(os.path.dirname(__file__))

from database import SessionLocal, Room

wanted_rooms = ["202","301","302","303","304","305","401","402","403","404","405","406","407"]

def sync_rooms():
    db = SessionLocal()
    # Wipe old rooms
    db.query(Room).delete()
    # Insert new specific rooms
    for r in wanted_rooms:
        db.add(Room(number=r))
    db.commit()
    db.close()
    print("Rooms synchronized successfully!")

if __name__ == "__main__":
    sync_rooms()
