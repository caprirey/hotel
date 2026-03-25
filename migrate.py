import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'hotel.db')

try:
    conn = sqlite3.connect(db_path)
    conn.execute("ALTER TABLE incomes ADD COLUMN guests INTEGER DEFAULT 1")
    conn.commit()
    print("Migration successful: Added guests column")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e).lower():
        print("Migration skipped: Column guests already exists")
    else:
        print(f"Error during migration: {e}")
finally:
    conn.close()
