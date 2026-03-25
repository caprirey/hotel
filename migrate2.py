import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'hotel.db')

try:
    conn = sqlite3.connect(db_path)
    conn.execute("ALTER TABLE incomes ADD COLUMN rent_type VARCHAR DEFAULT 'full_day'")
    conn.execute("ALTER TABLE incomes ADD COLUMN hours INTEGER DEFAULT 0")
    conn.execute("ALTER TABLE incomes ADD COLUMN is_active BOOLEAN DEFAULT 1")
    conn.commit()
    print("Migration successful: Added rent_type, hours, is_active columns")
except sqlite3.OperationalError as e:
    print(f"Migration operational status: {e}")
finally:
    conn.close()
