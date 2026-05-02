import sqlite3
import json
import os
import sys
import csv
import random
import webbrowser
import subprocess
import threading
import time
import shutil
from datetime import datetime, timedelta
from flask import Flask, send_from_directory, jsonify, request, send_file
from flask_cors import CORS

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

app = Flask(__name__, static_folder="dist", static_url_path="")
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:8080", "http://localhost:8081", "http://localhost:8082", "http://localhost:5173", "http://localhost:4173", "http://127.0.0.1:5000"]}})

_db_lock = threading.Lock()
_active_conns = []

def get_db_path():
    if getattr(sys, 'frozen', False):
        base_path = os.path.dirname(sys.executable)
    else:
        base_path = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_path, "finance_data.db")

DB_PATH = get_db_path()
BACKUP_PATH = os.path.join(os.path.dirname(get_db_path()), "finance_data_backup.db")
BACKUPS_DIR = os.path.join(os.path.dirname(get_db_path()), "backups")
last_active_time = datetime.now()
auto_backup_interval_hours = 6
last_auto_backup_time = datetime.now()

os.makedirs(BACKUPS_DIR, exist_ok=True)

def get_conn():
    conn = sqlite3.connect(DB_PATH, timeout=10, check_same_thread=False)
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    conn.row_factory = sqlite3.Row
    _active_conns.append(conn)
    return conn

def _close_all_connections():
    global _active_conns
    for c in _active_conns:
        try:
            c.close()
        except:
            pass
    _active_conns = []
    time.sleep(0.5)

def checkpoint(conn):
    try:
        conn.execute("PRAGMA wal_checkpoint(FULL)")
    except sqlite3.OperationalError as e:
        if "not an error" not in str(e):
            raise

def with_conn(func):
    def wrapper(*args, **kwargs):
        conn = get_conn()
        try:
            result = func(conn, *args, **kwargs)
            conn.commit()
            checkpoint(conn)
            return result
        except Exception as e:
            conn.rollback()
            raise
        finally:
            conn.close()
    return wrapper

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("PRAGMA synchronous = NORMAL")
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.execute("PRAGMA busy_timeout = 5000")

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS shops (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            createdAt TEXT NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            color TEXT NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            shopId TEXT,
            type TEXT NOT NULL,
            categoryId TEXT NOT NULL,
            paymentMethod TEXT NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL,
            exchangeRate REAL,
            amountCNY REAL NOT NULL,
            note TEXT,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (shopId) REFERENCES shops(id),
            FOREIGN KEY (categoryId) REFERENCES categories(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS seeded (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS advances (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            project TEXT NOT NULL,
            amount REAL NOT NULL,
            repaidAmount REAL NOT NULL DEFAULT 0,
            settled INTEGER NOT NULL DEFAULT 0,
            note TEXT,
            createdAt TEXT NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS currencies (
            code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            symbol TEXT NOT NULL,
            defaultRate REAL NOT NULL,
            isBase INTEGER NOT NULL DEFAULT 0
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS business_reconciliation (
            id TEXT PRIMARY KEY,
            shop_id TEXT NOT NULL,
            date TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit_cost REAL NOT NULL,
            unit_revenue REAL NOT NULL,
            unit_revenue_currency TEXT NOT NULL,
            unit_revenue_rate REAL,
            unit_revenue_original REAL NOT NULL,
            profit_rate REAL NOT NULL,
            note TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (shop_id) REFERENCES shops(id)
        )
    ''')

    conn.commit()
    checkpoint(conn)
    conn.close()

def is_seeded():
    conn = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM seeded WHERE key = 'ledger.seeded.v1'")
        result = cursor.fetchone()
        return result is not None and result[0] == "1"
    finally:
        conn.close()

def mark_seeded():
    conn = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("REPLACE INTO seeded (key, value) VALUES ('ledger.seeded.v1', '1')")
        conn.commit()
        checkpoint(conn)
    finally:
        conn.close()

def seed_data():
    conn = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM shops")
        if cursor.fetchone()[0] > 0:
            print("Data already exists, skipping seed...")
            conn.close()
            return

        shops = [
            ("shop_1", "南山旗舰店", "#3B5BFF", datetime.now().isoformat()),
            ("shop_2", "宝安分店", "#10B981", datetime.now().isoformat()),
            ("shop_3", "龙华社区店", "#F59E0B", datetime.now().isoformat()),
        ]
        cursor.executemany("INSERT INTO shops VALUES (?, ?, ?, ?)", shops)

        categories = [
            ("cat_1", "销售", "income", "#10B981"),
            ("cat_2", "其他收入", "income", "#06B6D4"),
            ("cat_3", "退款冲销", "income", "#84CC16"),
            ("cat_4", "租金", "expense", "#EF4444"),
            ("cat_5", "工资", "expense", "#F97316"),
            ("cat_6", "进货", "expense", "#8B5CF6"),
            ("cat_7", "水电", "expense", "#0EA5E9"),
            ("cat_8", "营销", "expense", "#EC4899"),
            ("cat_9", "其他支出", "expense", "#64748B"),
        ]
        cursor.executemany("INSERT INTO categories VALUES (?, ?, ?, ?)", categories)

        txs = []
        income_cats = ["cat_1", "cat_2", "cat_3"]
        expense_cats = ["cat_4", "cat_5", "cat_6", "cat_7", "cat_8", "cat_9"]
        methods = ["cash", "wechat", "alipay", "bank"]
        shops_list = ["shop_1", "shop_2", "shop_3"]

        for d in range(30):
            date = datetime.now()
            date = date.replace(day=max(1, date.day - d))
            iso_date = date.strftime("%Y-%m-%d")

            for shop_id in shops_list:
                income_count = 1 + random.randint(0, 2)
                for _ in range(income_count):
                    cat_id = random.choice(income_cats)
                    amt = round((300 + random.random() * 2700) * 100) / 100
                    tx_id = f"tx_{random.randint(100000, 999999)}_{d}_{shop_id}"
                    txs.append([
                        tx_id, iso_date, shop_id, "income", cat_id,
                        random.choice(methods), amt, "CNY", None, amt, None,
                        date.isoformat()
                    ])

                expense_count = random.randint(0, 2)
                for _ in range(expense_count):
                    cat_id = random.choice(expense_cats)
                    amt = round((100 + random.random() * 1500) * 100) / 100
                    tx_id = f"tx_{random.randint(100000, 999999)}_{d}_{shop_id}_e"
                    txs.append([
                        tx_id, iso_date, shop_id, "expense", cat_id,
                        random.choice(methods), amt, "CNY", None, amt, None,
                        date.isoformat()
                    ])

        cursor.executemany('''
            INSERT INTO transactions
            (id, date, shopId, type, categoryId, paymentMethod, amount,
             currency, exchangeRate, amountCNY, note, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', txs)

        conn.commit()
        checkpoint(conn)
        mark_seeded()
    finally:
        conn.close()

def uid():
    return f"{random.random().__str__()[2:10]}{datetime.now().timestamp().__str__()[:-8]}"

@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:path>")
def catch_all(path):
    return send_from_directory(app.static_folder, "index.html")

@app.errorhandler(404)
def not_found(e):
    return send_from_directory(app.static_folder, 'index.html')

@app.route("/api/shops", methods=["GET"])
def get_shops():
    conn = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM shops")
        rows = cursor.fetchall()
        result = [dict(row) for row in rows]
        return jsonify(result)
    finally:
        conn.close()

@app.route("/api/shops", methods=["POST"])
def set_shops():
    shops = request.get_json()
    conn = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM shops")
        for shop in shops:
            cursor.execute(
                "INSERT INTO shops (id, name, color, createdAt) VALUES (?, ?, ?, ?)",
                (shop["id"], shop["name"], shop["color"], shop["createdAt"])
            )
        conn.commit()
        checkpoint(conn)
        return jsonify({"status": "ok"})
    finally:
        conn.close()

@app.route("/api/categories", methods=["GET"])
def get_categories():
    conn = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM categories")
        rows = cursor.fetchall()
        result = [dict(row) for row in rows]
        return jsonify(result)
    finally:
        conn.close()

@app.route("/api/categories", methods=["POST"])
def set_categories():
    categories = request.get_json()
    conn = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM categories")
        for cat in categories:
            cursor.execute(
                "INSERT INTO categories (id, name, type, color) VALUES (?, ?, ?, ?)",
                (cat["id"], cat["name"], cat["type"], cat["color"])
            )
        conn.commit()
        checkpoint(conn)
        return jsonify({"status": "ok"})
    finally:
        conn.close()

@app.route("/api/transactions", methods=["GET"])
def get_transactions():
    conn = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM transactions ORDER BY date DESC, createdAt DESC")
        rows = cursor.fetchall()
        result = [dict(row) for row in rows]
        return jsonify(result)
    finally:
        conn.close()

@app.route("/api/transactions", methods=["POST"])
def set_transactions():
    transactions = request.get_json()
    conn = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM transactions")
        for tx in transactions:
            cursor.execute(
                '''INSERT INTO transactions
                   (id, date, shopId, type, categoryId, paymentMethod, amount,
                    currency, exchangeRate, amountCNY, note, createdAt)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (tx["id"], tx["date"], tx.get("shopId"), tx["type"], tx["categoryId"],
                 tx["paymentMethod"], tx["amount"], tx["currency"], tx.get("exchangeRate"),
                 tx["amountCNY"], tx.get("note"), tx["createdAt"])
            )
        conn.commit()
        checkpoint(conn)
        return jsonify({"status": "ok"})
    finally:
        conn.close()

@app.route("/api/export", methods=["POST"])
def export_transactions():
    transactions = request.get_json()
    conn = get_conn()
    try:
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM shops")
        shops = {row["id"]: row["name"] for row in cursor.fetchall()}

        cursor.execute("SELECT * FROM categories")
        categories = {row["id"]: row["name"] for row in cursor.fetchall()}

        payment_labels = {"cash": "现金", "wechat": "微信", "alipay": "支付宝", "bank": "银行"}
        type_labels = {"income": "收入", "expense": "支出"}

        output = []
        output.append(["日期", "店铺", "类型", "分类", "支付方式", "金额", "币种", "备注"])

        for tx in transactions:
            output.append([
                tx["date"],
                shops.get(tx["shopId"], tx["shopId"]),
                type_labels.get(tx["type"], tx["type"]),
                categories.get(tx["categoryId"], tx["categoryId"]),
                payment_labels.get(tx["paymentMethod"], tx["paymentMethod"]),
                tx["amount"],
                tx["currency"],
                tx.get("note", "") or ""
            ])

        export_path = "transactions_export.csv"
        with open(export_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerows(output)

        return jsonify({"status": "ok", "path": export_path})
    finally:
        conn.close()

@app.route("/api/export_all", methods=["GET"])
def export_all():
    conn = get_conn()
    try:
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM shops")
        shops = [dict(row) for row in cursor.fetchall()]

        cursor.execute("SELECT * FROM categories")
        categories = [dict(row) for row in cursor.fetchall()]

        cursor.execute("SELECT * FROM transactions ORDER BY date DESC, createdAt DESC")
        transactions = [dict(row) for row in cursor.fetchall()]

        cursor.execute("SELECT * FROM advances")
        advances = [dict(row) for row in cursor.fetchall()]

        cursor.execute("SELECT * FROM currencies")
        currencies = [dict(row) for row in cursor.fetchall()]

        data = {
            "version": "1.0",
            "exportTime": datetime.now().isoformat(),
            "shops": shops,
            "categories": categories,
            "transactions": transactions,
            "advances": advances,
            "currencies": currencies
        }

        export_path = "backup_data.json"
        with open(export_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return jsonify({"status": "ok", "path": export_path})
    finally:
        conn.close()

@app.route("/api/import_data", methods=["POST"])
def import_data():
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "没有数据"}), 400

    conn = get_conn()
    try:
        cursor = conn.cursor()

        if "shops" in data:
            cursor.execute("DELETE FROM shops")
            for shop in data["shops"]:
                cursor.execute(
                    "INSERT INTO shops (id, name, color, createdAt) VALUES (?, ?, ?, ?)",
                    (shop["id"], shop["name"], shop["color"], shop["createdAt"])
                )

        if "categories" in data:
            cursor.execute("DELETE FROM categories")
            for cat in data["categories"]:
                cursor.execute(
                    "INSERT INTO categories (id, name, type, color) VALUES (?, ?, ?, ?)",
                    (cat["id"], cat["name"], cat["type"], cat["color"])
                )

        if "transactions" in data:
            cursor.execute("DELETE FROM transactions")
            for tx in data["transactions"]:
                cursor.execute(
                    '''INSERT INTO transactions
                       (id, date, shopId, type, categoryId, paymentMethod, amount,
                        currency, exchangeRate, amountCNY, note, createdAt)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                    (tx["id"], tx["date"], tx.get("shopId"), tx["type"], tx["categoryId"],
                     tx["paymentMethod"], tx["amount"], tx["currency"], tx.get("exchangeRate"),
                     tx["amountCNY"], tx.get("note"), tx["createdAt"])
                )

        if "advances" in data:
            cursor.execute("DELETE FROM advances")
            for adv in data["advances"]:
                cursor.execute(
                    '''INSERT INTO advances
                       (id, date, project, amount, repaidAmount, settled, note, createdAt)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                    (adv["id"], adv["date"], adv["project"], adv["amount"],
                     adv.get("repaidAmount", 0), 1 if adv.get("settled") else 0,
                     adv.get("note"), adv["createdAt"])
                )

        if "currencies" in data:
            cursor.execute("DELETE FROM currencies")
            for c in data["currencies"]:
                cursor.execute(
                    "INSERT INTO currencies (code, name, symbol, defaultRate, isBase) VALUES (?, ?, ?, ?, ?)",
                    (c["code"], c["name"], c["symbol"], c["defaultRate"], 1 if c.get("isBase") else 0)
                )

        conn.commit()
        checkpoint(conn)

        return jsonify({"status": "ok", "message": "数据导入成功"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/advances", methods=["GET"])
def get_advances():
    conn = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM advances")
        rows = cursor.fetchall()
        result = [dict(row) for row in rows]
        return jsonify(result)
    finally:
        conn.close()

@app.route("/api/advances", methods=["POST"])
def set_advances():
    advances = request.get_json()
    conn = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM advances")
        for adv in advances:
            cursor.execute(
                '''INSERT INTO advances
                   (id, date, project, amount, repaidAmount, settled, note, createdAt)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                (adv["id"], adv["date"], adv["project"], adv["amount"],
                 adv.get("repaidAmount", 0), 1 if adv.get("settled") else 0,
                 adv.get("note"), adv["createdAt"])
            )
        conn.commit()
        checkpoint(conn)
        return jsonify({"status": "ok"})
    finally:
        conn.close()

@app.route("/api/currencies", methods=["GET"])
def get_currencies():
    conn = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM currencies")
        rows = cursor.fetchall()
        if rows:
            result = [dict(row) for row in rows]
            return jsonify(result)
        return jsonify([
            {"code": "CNY", "name": "人民币", "symbol": "¥", "defaultRate": 1, "isBase": True},
            {"code": "THB", "name": "泰铢", "symbol": "฿", "defaultRate": 0.21}
        ])
    finally:
        conn.close()

@app.route("/api/currencies", methods=["POST"])
def set_currencies():
    currencies = request.get_json()
    if currencies:
        conn = get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM currencies")
            for c in currencies:
                cursor.execute(
                    '''INSERT INTO currencies (code, name, symbol, defaultRate, isBase)
                       VALUES (?, ?, ?, ?, ?)''',
                    (c["code"], c["name"], c["symbol"], c["defaultRate"], 1 if c.get("isBase") else 0)
                )
            conn.commit()
            checkpoint(conn)
        finally:
            conn.close()
    return jsonify({"status": "ok"})

@app.route("/api/seed", methods=["GET"])
def api_seed():
    if not is_seeded():
        seed_data()
        return jsonify({"status": "seeded"})
    return jsonify({"status": "already_seeded"})

def auto_backup():
    global last_auto_backup_time
    while True:
        try:
            now = datetime.now()
            if (now - last_auto_backup_time).total_seconds() >= auto_backup_interval_hours * 3600:
                backup_name = f"finance_data_{now.strftime('%Y%m%d_%H%M%S')}.db"
                backup_path = os.path.join(BACKUPS_DIR, backup_name)
                shutil.copy2(DB_PATH, backup_path)
                if os.path.exists(DB_PATH + "-wal"):
                    shutil.copy2(DB_PATH + "-wal", backup_path + "-wal")
                if os.path.exists(DB_PATH + "-shm"):
                    shutil.copy2(DB_PATH + "-shm", backup_path + "-shm")
                last_auto_backup_time = now
                print(f"Auto backup completed: {backup_path}")
        except Exception as e:
            print(f"Auto backup error: {e}")
        time.sleep(3600)

@app.route("/api/backup", methods=["POST"])
def api_backup():
    if not PANDAS_AVAILABLE:
        return jsonify({"status": "error", "message": "pandas not available"}), 500
    
    try:
        print(f"[BACKUP] ====================================")
        print(f"[BACKUP] Backup started at: {datetime.now().isoformat()}")
        print(f"[BACKUP] Database path: {DB_PATH}")
        print(f"[BACKUP] ====================================")
        
        conn = get_conn()
        cursor = conn.cursor()
        
        print("[BACKUP] Step 1: Force sync - committing all pending changes...")
        conn.commit()
        checkpoint(conn)
        print("[BACKUP] Force sync completed")
        
        print("[BACKUP] Step 2: Calculating database file hash...")
        import hashlib
        with open(DB_PATH, 'rb') as f:
            db_hash = hashlib.sha256(f.read()).hexdigest()
        print(f"[BACKUP] Database SHA256: {db_hash}")
        
        print("[BACKUP] Step 3: Gathering table record counts...")
        tables = ['shops', 'categories', 'transactions', 'advances', 'currencies', 'business_reconciliation', 'seeded']
        table_counts = {}
        for table in tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                table_counts[table] = count
                print(f"[BACKUP]   {table}: {count} records")
            except Exception as e:
                print(f"[BACKUP]   {table}: 0 records (error: {e})")
                table_counts[table] = 0
        
        conn.close()
        
        print("[BACKUP] Step 4: Creating temporary backup directory...")
        timestamp = datetime.now().strftime("%Y_%m_%d_%H%M%S")
        temp_dir = os.path.join(BACKUPS_DIR, "temp")
        os.makedirs(temp_dir, exist_ok=True)
        
        temp_db_copy = os.path.join(temp_dir, "finance_data.db")
        print(f"[BACKUP] Copying database to: {temp_db_copy}")
        shutil.copy2(DB_PATH, temp_db_copy)
        
        csv_dir = os.path.join(temp_dir, "csv")
        os.makedirs(csv_dir, exist_ok=True)
        
        print("[BACKUP] Step 5: Exporting tables to CSV...")
        conn = get_conn()
        cursor = conn.cursor()
        for table in tables:
            cursor.execute(f"SELECT * FROM {table}")
            rows = cursor.fetchall()
            cols = [desc[0] for desc in cursor.description]
            df = pd.DataFrame([dict(zip(cols, row)) for row in rows]) if rows else pd.DataFrame(columns=cols)
            csv_path = os.path.join(csv_dir, f"{table}.csv")
            df.to_csv(csv_path, index=False)
            print(f"[BACKUP]   Exported {table} to {csv_path} ({len(df)} rows)")
        conn.close()
        
        print("[BACKUP] Step 6: Generating integrity.json...")
        integrity = {
            "version": "1.0",
            "backup_time": datetime.now().isoformat(),
            "db_file_hash": db_hash,
            "db_file_size": os.path.getsize(DB_PATH),
            "tables": table_counts
        }
        integrity_path = os.path.join(temp_dir, "integrity.json")
        with open(integrity_path, 'w', encoding='utf-8') as f:
            json.dump(integrity, f, indent=2, ensure_ascii=False)
        print(f"[BACKUP] Integrity data: {json.dumps(integrity, indent=2)}")
        
        print("[BACKUP] Step 7: Creating ZIP archive...")
        zip_filename = f"Backup_{timestamp}.zip"
        zip_filepath = os.path.join(BACKUPS_DIR, zip_filename)
        
        import zipfile
        with zipfile.ZipFile(zip_filepath, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(temp_db_copy, "finance_data.db")
            for csv_file in os.listdir(csv_dir):
                zipf.write(os.path.join(csv_dir, csv_file), f"csv/{csv_file}")
            zipf.write(integrity_path, "integrity.json")
        
        print(f"[BACKUP] ZIP archive created: {zip_filepath}")
        print(f"[BACKUP] ZIP file size: {os.path.getsize(zip_filepath)} bytes")
        
        print("[BACKUP] Step 8: Cleaning up temporary files...")
        shutil.rmtree(temp_dir, ignore_errors=True)
        
        print(f"[BACKUP] ====================================")
        print(f"[BACKUP] Backup completed successfully!")
        print(f"[BACKUP] Download path: {zip_filepath}")
        print(f"[BACKUP] Fingerprint: {db_hash[:16]}...")
        print(f"[BACKUP] ====================================")
        
        return send_file(zip_filepath, as_attachment=True, download_name=zip_filename)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[BACKUP] Backup error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/restore", methods=["POST"])
def api_restore():
    if not PANDAS_AVAILABLE:
        return jsonify({"status": "error", "message": "pandas not available"}), 500
    
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "没有上传文件"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"status": "error", "message": "文件名为空"}), 400
    
    max_retries = 3
    retry_delay = 0.5
    
    for attempt in range(max_retries):
        try:
            print(f"[RESTORE] ====================================")
            print(f"[RESTORE] Restore started at: {datetime.now().isoformat()}")
            print(f"[RESTORE] Target DB: {DB_PATH}")
            print(f"[RESTORE] Uploaded file: {file.filename}")
            print(f"[RESTORE] ====================================")
            
            with _db_lock:
                print("[RESTORE] Step 1: Closing all database connections...")
                _close_all_connections()
                time.sleep(1.0)
                
                wal_path = DB_PATH + "-wal"
                shm_path = DB_PATH + "-shm"
                
                for path in [wal_path, shm_path]:
                    if os.path.exists(path):
                        try:
                            os.remove(path)
                            print(f"[RESTORE] Removed {path}")
                        except Exception as e:
                            print(f"[RESTORE] Could not remove {path}: {e}")
                
                time.sleep(0.5)
                
                print("[RESTORE] Step 2: Creating temporary extraction directory...")
                temp_dir = os.path.join(BACKUPS_DIR, "temp_restore")
                os.makedirs(temp_dir, exist_ok=True)
                
                import zipfile
                print("[RESTORE] Step 3: Extracting ZIP file...")
                zip_path = os.path.join(temp_dir, "uploaded.zip")
                file.save(zip_path)
                
                try:
                    with zipfile.ZipFile(zip_path, 'r') as zipf:
                        zipf.extractall(temp_dir)
                        extracted_files = zipf.namelist()
                        print(f"[RESTORE] Extracted files: {extracted_files}")
                except zipfile.BadZipFile:
                    print("[RESTORE] Error: Invalid ZIP file format")
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    return jsonify({"status": "error", "message": "无效的ZIP文件格式"}), 400
                
                print("[RESTORE] Step 4: Locating backup files...")
                db_file_in_zip = None
                integrity_file = None
                
                for root, dirs, files in os.walk(temp_dir):
                    for f in files:
                        full_path = os.path.join(root, f)
                        rel_path = os.path.relpath(full_path, temp_dir)
                        if rel_path == "finance_data.db":
                            db_file_in_zip = full_path
                        elif rel_path == "integrity.json":
                            integrity_file = full_path
                
                if db_file_in_zip is None:
                    print("[RESTORE] Error: No finance_data.db found in ZIP")
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    return jsonify({"status": "error", "message": "ZIP中未找到finance_data.db文件"}), 400
                
                print(f"[RESTORE] Found DB file: {db_file_in_zip}")
                
                print("[RESTORE] Step 5: Verifying backup integrity...")
                if integrity_file and os.path.exists(integrity_file):
                    with open(integrity_file, 'r', encoding='utf-8') as f:
                        integrity = json.load(f)
                    
                    print(f"[RESTORE] Integrity check data: {json.dumps(integrity, indent=2)}")
                    
                    import hashlib
                    with open(db_file_in_zip, 'rb') as f:
                        current_hash = hashlib.sha256(f.read()).hexdigest()
                    
                    print(f"[RESTORE] Backup DB hash:   {integrity.get('db_file_hash', 'N/A')}")
                    print(f"[RESTORE] Extracted DB hash: {current_hash}")
                    
                    if current_hash != integrity.get('db_file_hash'):
                        print("[RESTORE] WARNING: Hash mismatch! Backup may be corrupted.")
                        print("[RESTORE] Proceeding anyway as requested...")
                    
                    print("[RESTORE] Step 6: Counting records in backup to verify...")
                    verify_conn = sqlite3.connect(db_file_in_zip)
                    verify_cursor = verify_conn.cursor()
                    
                    tables = ['shops', 'categories', 'transactions', 'advances', 'currencies', 'business_reconciliation', 'seeded']
                    record_counts = {}
                    for table in tables:
                        try:
                            verify_cursor.execute(f"SELECT COUNT(*) FROM {table}")
                            count = verify_cursor.fetchone()[0]
                            record_counts[table] = count
                            print(f"[RESTORE]   {table}: {count} records")
                        except Exception as e:
                            print(f"[RESTORE]   {table}: 0 (error: {e})")
                            record_counts[table] = 0
                    
                    verify_conn.close()
                    
                    if 'tables' in integrity:
                        print("[RESTORE] Comparing with integrity.json record counts...")
                        for table in tables:
                            expected = integrity['tables'].get(table, 0)
                            actual = record_counts.get(table, 0)
                            if expected != actual:
                                print(f"[RESTORE] WARNING: {table} count mismatch! Expected: {expected}, Actual: {actual}")
                    
                    print("[RESTORE] Integrity verification completed")
                else:
                    print("[RESTORE] No integrity.json found, skipping verification")
                
                print("[RESTORE] Step 7: Replacing current database with backup...")
                backup_path = DB_PATH + ".bak"
                if os.path.exists(backup_path):
                    try:
                        os.remove(backup_path)
                    except:
                        pass
                
                if os.path.exists(DB_PATH):
                    os.rename(DB_PATH, backup_path)
                
                shutil.copy2(db_file_in_zip, DB_PATH)
                print(f"[RESTORE] Copied backup DB to: {DB_PATH}")
                
                print("[RESTORE] Step 8: Cleaning up temporary files...")
                shutil.rmtree(temp_dir, ignore_errors=True)
                
                for path in [wal_path, shm_path]:
                    if os.path.exists(path):
                        try:
                            os.remove(path)
                        except:
                            pass
                
                print("[RESTORE] Step 9: Verifying restored database...")
                verify_conn2 = sqlite3.connect(DB_PATH, timeout=10)
                verify_cursor2 = verify_conn2.cursor()
                verify_cursor2.execute("SELECT COUNT(*) FROM transactions")
                trans_count = verify_cursor2.fetchone()[0]
                verify_conn2.close()
                print(f"[RESTORE] Verified: transactions table has {trans_count} records")
                
                print(f"[RESTORE] ====================================")
                print(f"[RESTORE] Restore completed successfully!")
                print(f"[RESTORE] ====================================")
                
                return jsonify({"status": "ok", "refresh": True, "message": "数据已恢复，请刷新页面"})
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"[RESTORE] Restore error (Attempt {attempt + 1}): {e}")
            
            if attempt < max_retries - 1:
                print(f"[RESTORE] Retrying in {retry_delay}s...")
                time.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, 3.0)
            else:
                print(f"[RESTORE] All attempts failed")
                return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/heartbeat", methods=["GET"])
def heartbeat():
    global last_active_time
    last_active_time = datetime.now()
    return jsonify({"status": "ok"})

@app.route("/api/config/backup", methods=["GET"])
def get_backup_config():
    global auto_backup_interval_hours
    return jsonify({
        "status": "ok",
        "auto_backup_enabled": auto_backup_interval_hours > 0,
        "auto_backup_interval_hours": auto_backup_interval_hours if auto_backup_interval_hours > 0 else 6
    })

@app.route("/api/config/backup", methods=["POST"])
def set_backup_config():
    global auto_backup_interval_hours
    data = request.get_json()
    if data is None:
        return jsonify({"status": "error", "message": "无效的JSON数据"}), 400
    
    enabled = data.get("enabled")
    interval = data.get("interval_hours")
    
    if enabled is not None:
        if enabled:
            if interval and interval in [6, 12, 24]:
                auto_backup_interval_hours = interval
            else:
                auto_backup_interval_hours = 6
        else:
            auto_backup_interval_hours = 0
    
    print(f"[CONFIG] Auto backup config updated: enabled={enabled}, interval_hours={auto_backup_interval_hours}")
    
    return jsonify({
        "status": "ok",
        "auto_backup_enabled": auto_backup_interval_hours > 0,
        "auto_backup_interval_hours": auto_backup_interval_hours if auto_backup_interval_hours > 0 else 6
    })

@app.route("/api/reconciliation/save", methods=["POST"])
def save_reconciliation():
    conn = get_conn()
    try:
        data = request.get_json()
        print(f"[RECONCILIATION] Received data: {data}")
        
        if not data:
            return jsonify({"status": "error", "message": "没有数据"}), 400

        cursor = conn.cursor()

        shop_id = data.get("shopId")
        date = data.get("date")
        quantity = data.get("quantity")
        unit_cost = data.get("unitCost")
        unit_revenue = data.get("unitRevenue")
        unit_revenue_currency = data.get("unitRevenueCurrency")
        unit_revenue_rate = data.get("unitRevenueRate")
        unit_revenue_original = data.get("unitRevenueOriginal")
        profit_rate = data.get("profitRate")
        note = data.get("note")

        print(f"[RECONCILIATION] Parsed values - shop_id: {shop_id}, date: {date}, quantity: {quantity}, unit_cost: {unit_cost}, profit_rate: {profit_rate}")
        
        if not all([shop_id, date, quantity is not None, unit_cost is not None, 
                    unit_revenue is not None, unit_revenue_currency, unit_revenue_original is not None, 
                    profit_rate is not None]):
            return jsonify({"status": "error", "message": "缺少必要字段"}), 400

        record_id = data.get("id")
        if record_id:
            cursor.execute('''
                UPDATE business_reconciliation
                SET shop_id = ?, date = ?, quantity = ?, unit_cost = ?,
                    unit_revenue = ?, unit_revenue_currency = ?, unit_revenue_rate = ?,
                    unit_revenue_original = ?, profit_rate = ?, note = ?
                WHERE id = ?
            ''', (shop_id, date, quantity, unit_cost, unit_revenue, unit_revenue_currency, 
                  unit_revenue_rate, unit_revenue_original, profit_rate, note, record_id))
        else:
            record_id = uid()
            cursor.execute('''
                INSERT INTO business_reconciliation
                (id, shop_id, date, quantity, unit_cost, unit_revenue, unit_revenue_currency,
                 unit_revenue_rate, unit_revenue_original, profit_rate, note, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (record_id, shop_id, date, quantity, unit_cost, unit_revenue, unit_revenue_currency,
                  unit_revenue_rate, unit_revenue_original, profit_rate, note, datetime.now().isoformat()))

        conn.commit()
        checkpoint(conn)

        return jsonify({"status": "ok", "id": record_id})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/dashboard/business_summary", methods=["GET"])
def get_business_summary():
    conn = get_conn()
    try:
        cursor = conn.cursor()

        cursor.execute('''
            SELECT SUM(quantity * unit_revenue * profit_rate) as total_estimated_rev,
                   SUM(quantity * unit_cost) as total_cost,
                   COUNT(*) as record_count
            FROM business_reconciliation
        ''')
        row = cursor.fetchone()

        total_estimated_rev = row["total_estimated_rev"] or 0
        total_cost = row["total_cost"] or 0
        
        result = {
            "total_estimated_profit": total_estimated_rev - total_cost,
            "total_estimated_rev": total_estimated_rev,
            "total_cost": total_cost,
            "record_count": row["record_count"] or 0
        }

        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/reconciliation/list", methods=["GET"])
def get_reconciliation_list():
    conn = get_conn()
    try:
        cursor = conn.cursor()

        cursor.execute('''
            SELECT * FROM business_reconciliation ORDER BY date DESC, created_at DESC
        ''')
        rows = cursor.fetchall()
        result = []
        for row in rows:
            result.append({
                "id": row["id"],
                "shopId": row["shop_id"],
                "date": row["date"],
                "quantity": row["quantity"],
                "unitCost": row["unit_cost"],
                "unitRevenue": row["unit_revenue"],
                "unitRevenueCurrency": row["unit_revenue_currency"],
                "unitRevenueRate": row["unit_revenue_rate"],
                "unitRevenueOriginal": row["unit_revenue_original"],
                "profitRate": row["profit_rate"],
                "note": row["note"],
                "createdAt": row["created_at"]
            })

        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/reconciliation/delete", methods=["POST"])
def delete_reconciliation():
    conn = get_conn()
    try:
        data = request.get_json()
        if not data or not data.get("id"):
            return jsonify({"status": "error", "message": "缺少ID"}), 400

        cursor = conn.cursor()

        cursor.execute('DELETE FROM business_reconciliation WHERE id = ?', (data["id"],))
        
        conn.commit()
        checkpoint(conn)

        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

def monitor_heartbeat():
    global last_active_time
    while True:
        time.sleep(10)
        elapsed = (datetime.now() - last_active_time).total_seconds()
        if elapsed > 30:
            print("No heartbeat for 30 seconds. Shutting down...")
            os._exit(0)

def main():
    print("=" * 60)
    print(f"CRITICAL: Database is running at: {DB_PATH}")
    print("=" * 60)
    init_db()

    if not is_seeded():
        print("Initializing sample data...")
        seed_data()
        print("Sample data initialized!")

    print("Heartbeat monitor disabled to prevent auto-shutdown")

    print(f"Starting auto backup thread (interval: {auto_backup_interval_hours} hours)...")
    auto_backup_thread = threading.Thread(target=auto_backup, daemon=True)
    auto_backup_thread.start()

    print("Starting Flask server...")

    # try:
    #     subprocess.run(['start', 'chrome', '--app=http://127.0.0.1:5000'], shell=True, check=True)
    #     print("Chrome app mode launched successfully!")
    # except Exception as e:
    #     print(f"Chrome not found, using default browser: {e}")
    #     webbrowser.open("http://127.0.0.1:5000")

    app.run(host="127.0.0.1", port=5000, debug=False)

if __name__ == "__main__":
    main()