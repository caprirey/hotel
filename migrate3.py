import sqlite3
import os
import bcrypt

db_path = os.path.join(os.path.dirname(__file__), 'hotel.db')

def run_migration():
    conn = sqlite3.connect(db_path)
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR UNIQUE,
                password_hash VARCHAR
            )
        ''')
        
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE username = 'admin'")
        if cursor.fetchone() is None:
            hashed = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode("utf-8")
            conn.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", ("admin", hashed))
            print("Admin user created")
            
        conn.commit()
        print("Migration 3 successful (Users table)")
    except Exception as e:
        print(f"Migration error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
