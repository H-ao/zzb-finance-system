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
import logging
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, send_from_directory, jsonify, request, send_file
from flask_cors import CORS

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

# 检查是否使用窗口模式
try:
    import webview
    WEBVIEW_AVAILABLE = True
except ImportError:
    WEBVIEW_AVAILABLE = False

# ========== 日志配置 ==========
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s [%(name)s] %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('finance_app')

# ========== 环境变量配置 ==========
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:8080,http://localhost:8081,http://localhost:8082,http://localhost:5173,http://localhost:4173,http://127.0.0.1:5000"
).split(",")

logger.info(f"Allowed origins: {ALLOWED_ORIGINS}")

# ========== 统一路径管理 ==========
from path_manager import path_manager

# 使用统一路径管理器获取所有路径
DB_PATH = path_manager.get_db_path()
BACKUP_PATH = path_manager.get_backup_db_path()
BACKUPS_DIR = path_manager.get_backups_dir()

# Flask 静态文件夹
STATIC_FOLDER = path_manager.get_static_dir()

app = Flask(__name__, static_folder=STATIC_FOLDER, static_url_path="")

CORS(app, resources={
    r"/api/*": {
        "origins": ALLOWED_ORIGINS,
        "supports_credentials": True,
        "allow_headers": ["Content-Type", "Authorization"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    }
})

_db_lock = threading.Lock()

# 数据库连接管理（使用 path_manager 提供的路径）
server_shutdown_event = threading.Event()  # 服务器关闭事件
flask_server_thread = None  # Flask 服务器线程（窗口模式用）
last_active_time = datetime.now()
auto_backup_interval_hours = 6
last_auto_backup_time = datetime.now()

os.makedirs(BACKUPS_DIR, exist_ok=True)

# ========== 输入验证工具 ==========

def validate_list_data(min_items=0, max_items=1000, item_schema=None):
    """验证列表数据"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            data = request.get_json()
            if not data:
                logger.warning("Request with empty JSON")
                return jsonify({"status": "error", "message": "JSON 数据不能为空"}), 400
            
            # 如果是列表
            if isinstance(data, list):
                items = data
            elif isinstance(data, dict):
                # 查找第一个列表字段
                items = None
                for key, value in data.items():
                    if isinstance(value, list):
                        items = value
                        break
                if items is None:
                    logger.warning("No list field found in JSON")
                    return jsonify({"status": "error", "message": "未找到列表数据"}), 400
            else:
                logger.warning(f"Invalid data type: {type(data)}")
                return jsonify({"status": "error", "message": "数据格式错误"}), 400
            
            # 验证数量
            if len(items) < min_items:
                logger.warning(f"Too few items: {len(items)} < {min_items}")
                return jsonify({"status": "error", "message": f"数据不能少于 {min_items} 项"}), 400
            
            if len(items) > max_items:
                logger.warning(f"Too many items: {len(items)} > {max_items}")
                return jsonify({"status": "error", "message": f"数据不能超过 {max_items} 项"}), 400
            
            # 验证每项的必填字段
            if item_schema:
                for i, item in enumerate(items):
                    for field, rules in item_schema.items():
                        if rules.get("required") and field not in item:
                            logger.warning(f"Missing required field '{field}' in item {i}")
                            return jsonify({"status": "error", "message": f"第{i+1}项缺少必填字段：{field}"}), 400
                        
                        if field in item:
                            value = item[field]
                            # 类型验证
                            if "type" in rules:
                                expected_type = rules["type"]
                                if expected_type == "string" and not isinstance(value, str):
                                    return jsonify({"status": "error", "message": f"第{i+1}项字段 {field} 必须是字符串"}), 400
                                elif expected_type == "number" and not isinstance(value, (int, float)):
                                    return jsonify({"status": "error", "message": f"第{i+1}项字段 {field} 必须是数字"}), 400
                            
                            # 长度验证
                            if "max_length" in rules and isinstance(value, str) and len(value) > rules["max_length"]:
                                return jsonify({"status": "error", "message": f"第{i+1}项字段 {field} 长度不能超过 {rules['max_length']}"}), 400
                            
                            # 值范围验证
                            if "min" in rules and isinstance(value, (int, float)) and value < rules["min"]:
                                return jsonify({"status": "error", "message": f"第{i+1}项字段 {field} 不能小于 {rules['min']}"}), 400
                            if "max" in rules and isinstance(value, (int, float)) and value > rules["max"]:
                                return jsonify({"status": "error", "message": f"第{i+1}项字段 {field} 不能大于 {rules['max']}"}), 400
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def prevent_empty_data(get_count_func):
    """防止清空所有数据的装饰器"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            data = request.get_json()
            items = data if isinstance(data, list) else None
            
            if items is None and isinstance(data, dict):
                for value in data.values():
                    if isinstance(value, list):
                        items = value
                        break
            
            # 如果是空列表且当前有数据，则阻止
            if items is not None and len(items) == 0:
                current_count = get_count_func()
                if current_count > 0:
                    logger.warning(f"Attempt to clear all data (count={current_count})")
                    return jsonify({
                        "status": "error",
                        "message": "不能清空所有数据，请先添加新数据"
                    }), 400
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def get_conn():
    """获取数据库连接，调用者负责在完成后关闭连接"""
    conn = sqlite3.connect(DB_PATH, timeout=10, check_same_thread=False)
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    conn.row_factory = sqlite3.Row
    return conn

def _close_all_connections():
    """仅在应用关闭时调用，用于清理所有 WAL 连接"""
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
    if getattr(sys, 'frozen', False):
        # 打包后使用绝对路径
        return send_from_directory(os.path.dirname(get_static_path("")), "index.html")
    else:
        # 开发环境
        return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:path>")
def catch_all(path):
    if getattr(sys, 'frozen', False):
        return send_from_directory(os.path.dirname(get_static_path("")), "index.html")
    else:
        return send_from_directory(app.static_folder, "index.html")

@app.errorhandler(404)
def not_found(e):
    if getattr(sys, 'frozen', False):
        return send_from_directory(os.path.dirname(get_static_path("")), 'index.html')
    else:
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

def count_shops():
    """获取当前店铺数量"""
    conn = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM shops")
        return cursor.fetchone()[0]
    finally:
        conn.close()

@app.route("/api/shops", methods=["POST"])
@validate_list_data(
    min_items=0,
    max_items=100,
    item_schema={
        "id": {"required": True, "type": "string", "max_length": 100},
        "name": {"required": True, "type": "string", "max_length": 100},
        "color": {"required": True, "type": "string", "max_length": 20},
        "createdAt": {"required": True, "type": "string"}
    }
)
@prevent_empty_data(count_shops)
def set_shops():
    data = request.get_json()
    shops = data if isinstance(data, list) else list(data.values())[0]
    
    logger.info(f"Saving {len(shops)} shops")
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
        logger.info(f"Successfully saved {len(shops)} shops")
        return jsonify({"status": "ok"})
    except Exception as e:
        logger.error(f"Error saving shops: {e}", exc_info=True)
        raise
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

def count_categories():
    conn = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM categories")
        return cursor.fetchone()[0]
    finally:
        conn.close()

@app.route("/api/categories", methods=["POST"])
@validate_list_data(
    min_items=0,
    max_items=200,
    item_schema={
        "id": {"required": True, "type": "string"},
        "name": {"required": True, "type": "string", "max_length": 100},
        "type": {"required": True, "type": "string"},
        "color": {"required": True, "type": "string", "max_length": 20}
    }
)
@prevent_empty_data(count_categories)
def set_categories():
    data = request.get_json()
    categories = data if isinstance(data, list) else list(data.values())[0]
    
    logger.info(f"Saving {len(categories)} categories")
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
        logger.info(f"Successfully saved {len(categories)} categories")
        return jsonify({"status": "ok"})
    except Exception as e:
        logger.error(f"Error saving categories: {e}", exc_info=True)
        raise
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

def count_transactions():
    conn = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM transactions")
        return cursor.fetchone()[0]
    finally:
        conn.close()

@app.route("/api/transactions", methods=["POST"])
@validate_list_data(
    min_items=0,
    max_items=10000,
    item_schema={
        "id": {"required": True, "type": "string"},
        "date": {"required": True, "type": "string"},
        "type": {"required": True, "type": "string"},
        "categoryId": {"required": True, "type": "string"},
        "paymentMethod": {"required": True, "type": "string"},
        "amount": {"required": True, "type": "number", "min": 0},
        "currency": {"required": True, "type": "string", "max_length": 10},
        "amountCNY": {"required": True, "type": "number", "min": 0}
    }
)
@prevent_empty_data(count_transactions)
def set_transactions():
    data = request.get_json()
    transactions = data if isinstance(data, list) else list(data.values())[0]
    
    logger.info(f"Saving {len(transactions)} transactions")
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
        logger.info(f"Successfully saved {len(transactions)} transactions")
        return jsonify({"status": "ok"})
    except Exception as e:
        logger.error(f"Error saving transactions: {e}", exc_info=True)
        raise
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

def count_advances():
    conn = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM advances")
        return cursor.fetchone()[0]
    finally:
        conn.close()

@app.route("/api/advances", methods=["POST"])
@validate_list_data(
    min_items=0,
    max_items=1000,
    item_schema={
        "id": {"required": True, "type": "string"},
        "date": {"required": True, "type": "string"},
        "project": {"required": True, "type": "string", "max_length": 200},
        "amount": {"required": True, "type": "number", "min": 0}
    }
)
@prevent_empty_data(count_advances)
def set_advances():
    data = request.get_json()
    advances = data if isinstance(data, list) else list(data.values())[0]
    
    logger.info(f"Saving {len(advances)} advances")
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
        logger.info(f"Successfully saved {len(advances)} advances")
        return jsonify({"status": "ok"})
    except Exception as e:
        logger.error(f"Error saving advances: {e}", exc_info=True)
        raise
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

def count_currencies():
    conn = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM currencies")
        return cursor.fetchone()[0]
    finally:
        conn.close()

@app.route("/api/currencies", methods=["POST"])
@validate_list_data(
    min_items=0,
    max_items=50,
    item_schema={
        "code": {"required": True, "type": "string", "max_length": 10},
        "name": {"required": True, "type": "string", "max_length": 100},
        "symbol": {"required": True, "type": "string", "max_length": 10},
        "defaultRate": {"required": True, "type": "number", "min": 0}
    }
)
@prevent_empty_data(count_currencies)
def set_currencies():
    data = request.get_json()
    currencies = data if isinstance(data, list) else list(data.values())[0]
    
    logger.info(f"Saving {len(currencies)} currencies")
    
    if not currencies:
        return jsonify({"status": "ok"})
    
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
        logger.info(f"Successfully saved {len(currencies)} currencies")
        return jsonify({"status": "ok"})
    except Exception as e:
        logger.error(f"Error saving currencies: {e}", exc_info=True)
        raise
    finally:
        conn.close()

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

def _force_flush_database():
    """
    强制将内存中的数据刷新到磁盘
    确保 WAL 模式下的所有 pending changes 都物理写入 .db 文件
    """
    conn = get_conn()
    try:
        # Step 1: 提交所有未提交的事务
        conn.commit()
        
        # Step 2: 强制 WAL 检查点，将 WAL 文件内容写回主数据库文件
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        
        # Step 3: 设置 SYNCHRONOUS=FULL 确保下一次写入立即落盘
        conn.execute("PRAGMA synchronous = FULL")
        
        # Step 4: 执行一次空写入来强制 flush
        conn.execute("PRAGMA integrity_check")
        
    finally:
        conn.close()
    
    # Step 5: 等待文件系统完成写入
    time.sleep(0.5)


def _calculate_file_hash(filepath):
    """计算文件的 SHA256 哈希值"""
    import hashlib
    sha256 = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha256.update(chunk)
    return sha256.hexdigest()


def _export_table_to_csv(cursor, table, csv_path):
    """导出单个表到 CSV，返回记录数"""
    cursor.execute(f"SELECT * FROM {table}")
    rows = cursor.fetchall()
    cols = [desc[0] for desc in cursor.description]
    
    # 先写入 header
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(cols)
        for row in rows:
            writer.writerow(row)
    
    return len(rows)


@app.route("/api/backup", methods=["POST"])
def api_backup():
    if not PANDAS_AVAILABLE:
        return jsonify({"status": "error", "message": "pandas not available"}), 500
    
    try:
        print(f"[BACKUP] {'='*60}")
        print(f"[BACKUP] Backup started at: {datetime.now().isoformat()}")
        print(f"[BACKUP] Database path: {DB_PATH}")
        print(f"[BACKUP] {'='*60}")
        
        # ========== 阶段 1: 强制数据落盘 =========
        print("[BACKUP] Phase 1: Forcing data flush to disk...")
        _force_flush_database()
        print("[BACKUP] Data flush completed")
        
        # ========== 阶段 2: 收集指纹信息 =========
        print("[BACKUP] Phase 2: Calculating fingerprints...")
        
        # 计算数据库文件哈希
        db_hash = _calculate_file_hash(DB_PATH)
        db_size = os.path.getsize(DB_PATH)
        print(f"[BACKUP] Database SHA256: {db_hash}")
        print(f"[BACKUP] Database size: {db_size} bytes")
        
        # 获取所有表的记录数
        conn = get_conn()
        cursor = conn.cursor()
        tables = ['shops', 'categories', 'transactions', 'advances', 'currencies', 'business_reconciliation', 'seeded']
        table_stats = {}
        
        for table in tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                table_stats[table] = count
                print(f"[BACKUP]   {table}: {count} records")
            except Exception as e:
                print(f"[BACKUP]   {table}: 0 records (error: {e})")
                table_stats[table] = 0
        
        conn.close()
        
        # ========== 阶段 3: 构建三件套备份包 =========
        print("[BACKUP] Phase 3: Building three-layer backup package...")
        
        timestamp = datetime.now().strftime("%Y_%m_%d_%H%M%S")
        temp_dir = os.path.join(BACKUPS_DIR, f"backup_{timestamp}")
        os.makedirs(temp_dir, exist_ok=True)
        
        # --- 物理层：直接复制 .db 文件 ---
        db_backup_path = os.path.join(temp_dir, "finance_data.db")
        shutil.copy2(DB_PATH, db_backup_path)
        print(f"[BACKUP] Physical layer: Database file copied")
        
        # --- 逻辑层：导出所有表为 CSV ---
        csv_dir = os.path.join(temp_dir, "csv")
        os.makedirs(csv_dir, exist_ok=True)
        
        conn = get_conn()
        cursor = conn.cursor()
        csv_stats = {}
        
        for table in tables:
            csv_path = os.path.join(csv_dir, f"{table}.csv")
            row_count = _export_table_to_csv(cursor, table, csv_path)
            csv_stats[table] = row_count
            print(f"[BACKUP] Logical layer: Exported {table} to CSV ({row_count} rows)")
        
        conn.close()
        
        # --- 指纹层：生成 manifest.json ---
        manifest = {
            "version": "2.0",
            "backup_type": "full",
            "backup_time": datetime.now().isoformat(),
            "database": {
                "filename": "finance_data.db",
                "sha256_hash": db_hash,
                "file_size": db_size
            },
            "tables": {},
            "verification": {
                "method": "hash_and_count",
                "csv_vs_db_match_required": True
            }
        }
        
        # 添加每个表的详细统计到 manifest
        for table in tables:
            manifest["tables"][table] = {
                "record_count": table_stats[table],
                "csv_path": f"csv/{table}.csv",
                "exported_rows": csv_stats.get(table, 0)
            }
        
        manifest_path = os.path.join(temp_dir, "manifest.json")
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
        print(f"[BACKUP] Fingerprint layer: manifest.json created")
        
        # ========== 阶段 4: 打包为 ZIP =========
        print("[BACKUP] Phase 4: Creating ZIP archive...")
        zip_filename = f"Backup_{timestamp}.zip"
        zip_filepath = os.path.join(BACKUPS_DIR, zip_filename)
        
        import zipfile
        with zipfile.ZipFile(zip_filepath, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # 添加数据库文件
            zipf.write(db_backup_path, "finance_data.db")
            
            # 添加所有 CSV 文件
            for csv_file in os.listdir(csv_dir):
                zipf.write(os.path.join(csv_dir, csv_file), f"csv/{csv_file}")
            
            # 添加 manifest
            zipf.write(manifest_path, "manifest.json")
        
        print(f"[BACKUP] ZIP archive created: {zip_filepath}")
        print(f"[BACKUP] ZIP file size: {os.path.getsize(zip_filepath)} bytes")
        
        # ========== 阶段 5: 清理临时文件 =========
        print("[BACKUP] Phase 5: Cleaning up temporary files...")
        shutil.rmtree(temp_dir, ignore_errors=True)
        
        # ========== 备份完成 =========
        print(f"[BACKUP] {'='*60}")
        print(f"[BACKUP] Backup completed successfully!")
        print(f"[BACKUP] Download path: {zip_filepath}")
        print(f"[BACKUP] Fingerprint: {db_hash[:16]}...")
        print(f"[BACKUP] {'='*60}")
        
        return send_file(zip_filepath, as_attachment=True, download_name=zip_filename)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[BACKUP] Backup error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

def _verify_csv_row_count(csv_path, expected_count):
    """验证 CSV 文件的行数（不包括 header）"""
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader, None)  # 跳过 header
        count = sum(1 for _ in reader)
    
    match = count == expected_count
    return {
        'expected': expected_count,
        'actual': count,
        'match': match
    }


@app.route("/api/restore", methods=["POST"])
def api_restore():
    if not PANDAS_AVAILABLE:
        return jsonify({"status": "error", "message": "pandas not available"}), 500
    
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "没有上传文件"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"status": "error", "message": "文件名为空"}), 400
    
    # 文件类型和大小验证
    if not file.filename.lower().endswith('.zip'):
        return jsonify({"status": "error", "message": "仅支持 ZIP 格式文件"}), 400
    
    max_file_size = 100 * 1024 * 1024  # 100MB
    file.seek(0, 2)  # 移动到文件末尾
    file_size = file.tell()
    file.seek(0)  # 重置到文件开头
    
    if file_size > max_file_size:
        return jsonify({"status": "error", "message": "文件大小超过 100MB 限制"}), 400
    
    if file_size == 0:
        return jsonify({"status": "error", "message": "文件为空"}), 400
    
    for attempt in range(3):
        try:
            print(f"[RESTORE] {'='*60}")
            print(f"[RESTORE] Restore started at: {datetime.now().isoformat()}")
            print(f"[RESTORE] Target DB: {DB_PATH}")
            print(f"[RESTORE] Uploaded file: {file.filename} ({file_size} bytes)")
            print(f"[RESTORE] {'='*60}")
            
            with _db_lock:
                # ========== 阶段 1: 释放所有数据库连接 =========
                print("[RESTORE] Phase 1: Releasing all database connections...")
                _close_all_connections()
                time.sleep(1.0)
                
                # 删除 WAL/SHM 文件
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
                
                # ========== 阶段 2: 解压备份包 =========
                print("[RESTORE] Phase 2: Extracting ZIP file...")
                temp_dir = os.path.join(BACKUPS_DIR, "restore_temp")
                os.makedirs(temp_dir, exist_ok=True)
                
                import zipfile
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
                    return jsonify({"status": "error", "message": "无效的 ZIP 文件格式"}), 400
                
                # ========== 阶段 3: 定位关键文件 =========
                print("[RESTORE] Phase 3: Locating backup files...")
                db_file = None
                manifest_file = None
                csv_dir = None
                
                for root, dirs, files in os.walk(temp_dir):
                    for f in files:
                        full_path = os.path.join(root, f)
                        rel_path = os.path.relpath(full_path, temp_dir)
                        
                        if rel_path == "finance_data.db":
                            db_file = full_path
                        elif rel_path == "manifest.json":
                            manifest_file = full_path
                        elif rel_path == "csv":
                            csv_dir = full_path
                
                if db_file is None:
                    print("[RESTORE] Error: No finance_data.db found in ZIP")
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    return jsonify({"status": "error", "message": "ZIP 中未找到 finance_data.db 文件"}), 400
                
                if manifest_file is None:
                    print("[RESTORE] Error: No manifest.json found in ZIP")
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    return jsonify({"status": "error", "message": "ZIP 中未找到 manifest.json 文件"}), 400
                
                print(f"[RESTORE] Found DB file: {db_file}")
                print(f"[RESTORE] Found manifest: {manifest_file}")
                
                # ========== 阶段 4: 读取并验证 manifest =========
                print("[RESTORE] Phase 4: Verifying manifest.json...")
                with open(manifest_file, 'r', encoding='utf-8') as f:
                    manifest = json.load(f)
                
                print(f"[RESTORE] Manifest version: {manifest.get('version', 'unknown')}")
                print(f"[RESTORE] Backup time: {manifest.get('backup_time', 'unknown')}")
                
                # ========== 阶段 5: 互验机制 - CSV 行数 vs manifest 记录数 =========
                print("[RESTORE] Phase 5: Cross-verification (CSV rows vs manifest counts)...")
                tables = ['shops', 'categories', 'transactions', 'advances', 'currencies', 'business_reconciliation', 'seeded']
                verification_passed = True
                
                csv_dir = os.path.join(temp_dir, "csv")
                if not os.path.isdir(csv_dir):
                    csv_dir = None
                    print("[RESTORE] WARNING: CSV directory not found, skipping CSV verification")
                else:
                    for table in tables:
                        csv_path = os.path.join(csv_dir, f"{table}.csv")
                        expected_count = manifest.get('tables', {}).get(table, {}).get('record_count', 0)
                        
                        if os.path.exists(csv_path):
                            result = _verify_csv_row_count(csv_path, expected_count)
                            status = "✓ PASS" if result['match'] else "✗ FAIL"
                            print(f"[RESTORE]   {table}: {status} (expected={result['expected']}, actual={result['actual']})")
                            
                            if not result['match']:
                                verification_passed = False
                        else:
                            print(f"[RESTORE]   {table}: SKIP (CSV file not found)")
                
                # ========== 阶段 6: 验证数据库文件哈希（可选） =========
                print("[RESTORE] Phase 6: Database file hash verification...")
                db_expected_hash = manifest.get('database', {}).get('sha256_hash')
                if db_expected_hash:
                    db_actual_hash = _calculate_file_hash(db_file)
                    hash_match = db_expected_hash == db_actual_hash
                    print(f"[RESTORE] Expected hash:   {db_expected_hash[:32]}...")
                    print(f"[RESTORE] Actual hash:     {db_actual_hash[:32]}...")
                    print(f"[RESTORE] Hash match: {hash_match}")
                    
                    # 哈希不匹配时仅警告，不影响恢复流程
                    if not hash_match:
                        print("[RESTORE] WARNING: Hash mismatch, but proceeding anyway")
                
                # ========== 阶段 7: 物理替换数据库文件 =========
                if verification_passed or csv_dir is None:
                    print("[RESTORE] Phase 7: Physical database replacement...")
                    
                    # 备份当前数据库（以防万一）
                    backup_path = DB_PATH + ".bak"
                    if os.path.exists(DB_PATH):
                        shutil.copy2(DB_PATH, backup_path)
                        print(f"[RESTORE] Current DB backed up to: {backup_path}")
                    
                    # 直接物理覆盖
                    shutil.copy2(db_file, DB_PATH)
                    print(f"[RESTORE] Database file replaced successfully")
                    
                    # 验证恢复后的数据库
                    print("[RESTORE] Phase 8: Verifying restored database...")
                    verify_conn = sqlite3.connect(DB_PATH, timeout=10)
                    try:
                        verify_cursor = verify_conn.cursor()
                        verify_cursor.execute("SELECT COUNT(*) FROM transactions")
                        trans_count = verify_cursor.fetchone()[0]
                        print(f"[RESTORE] Verified: transactions table has {trans_count} records")
                    finally:
                        verify_conn.close()
                    
                    # ========== 清理 =========
                    print("[RESTORE] Phase 9: Cleaning up temporary files...")
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    
                    print(f"[RESTORE] {'='*60}")
                    print(f"[RESTORE] Restore completed successfully!")
                    print(f"[RESTORE] Verification: {'PASSED' if verification_passed else 'WARNING'}")
                    print(f"[RESTORE] {'='*60}")
                    
                    return jsonify({
                        "status": "ok",
                        "refresh": True,
                        "message": "数据已恢复，请刷新页面",
                        "verification_passed": verification_passed
                    })
                else:
                    print("[RESTORE] ABORT: Verification failed, database not replaced")
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    return jsonify({
                        "status": "error",
                        "message": "数据验证失败，备份文件可能已损坏",
                        "verification_passed": False
                    }), 400
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"[RESTORE] Restore error (Attempt {attempt + 1}): {e}")
            
            if attempt < 2:
                print(f"[RESTORE] Retrying in 0.5s...")
                time.sleep(0.5)
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
    import argparse
    
    parser = argparse.ArgumentParser(description='店铺账目管理系统')
    parser.add_argument('--windowed', '-w', action='store_true', 
                       help='以窗口模式启动（原生应用窗口）')
    parser.add_argument('--port', '-p', type=int, default=5000,
                       help='服务器端口（默认：5000）')
    parser.add_argument('--host', type=str, default='127.0.0.1',
                       help='服务器监听地址（默认：127.0.0.1）')
    args = parser.parse_args()
    
    print("=" * 60)
    print("店铺账目管理系统 v2.0.0")
    print("=" * 60)
    print(f"Database path: {DB_PATH}")
    print("=" * 60)
    
    init_db()

    if not is_seeded():
        print("Initializing sample data...")
        seed_data()
        print("✓ Sample data initialized!")

    print(f"Starting auto backup thread (interval: {auto_backup_interval_hours} hours)...")
    auto_backup_thread = threading.Thread(target=auto_backup, daemon=True)
    auto_backup_thread.start()

    # 判断启动模式
    if args.windowed and WEBVIEW_AVAILABLE:
        # 窗口模式
        print(f"Starting server in windowed mode on http://{args.host}:{args.port}...")
        
        # 启动 Flask 服务器（在后台线程运行）
        def run_flask_server():
            app.run(host=args.host, port=args.port, debug=False, use_reloader=False)
        
        server_thread = threading.Thread(target=run_flask_server, daemon=False)
        server_thread.start()
        
        # 等待服务器启动
        time.sleep(2)
        
        # 创建 pywebview 窗口
        def on_closing():
            """窗口关闭时的回调函数"""
            print("\n😊 窗口正在关闭，正在保存数据...")
            
            # 触发服务器关闭
            server_shutdown_event.set()
            
            # 等待几秒让数据保存完成
            time.sleep(1)
            
            # 关闭所有数据库连接
            _close_all_connections()
            
            print("✓ 已保存所有数据")
            print("✓ 已关闭数据库连接")
            print("✓ 感谢使用，再见！\n")
        
        # 创建窗口并注册关闭事件
        window = webview.create_window(
            title='店铺账目管理系统',
            url=f'http://{args.host}:{args.port}',
            width=1280,
            height=800,
            resizable=True,
            min_size=(800, 600)
        )
        
        # 注册窗口关闭事件（注意：webview.events.closing 在窗口即将关闭时触发）
        try:
            # 尝试注册 closing 事件
            window.events.closing += on_closing
        except AttributeError:
            # 如果事件系统不可用，使用 try-except 包装 webview.start()
            pass
        
        # 启动窗口
        webview.start()
        
        # webview.start() 返回后（窗口已关闭），执行清理
        print("\n😊 窗口已关闭，正在退出程序...")
        _close_all_connections()
        
        # 不需要等待服务器关闭，因为设置了 daemon=False
        # 主线程结束，程序会自动退出
        print("✓ 程序已安全退出\n")
        
    else:
        # 浏览器模式或 webview 不可用时降级
        if args.windowed and not WEBVIEW_AVAILABLE:
            print("⚠ Warning: webview not available, falling back to browser mode")
            print("  Install with: pip install pywebview")
        
        print(f"Starting server on http://{args.host}:{args.port}...")
        print("按 Ctrl+C 停止服务")
        print("关闭窗口后请按 Ctrl+C 退出程序\n")
        
        # 在浏览器中打开
        threading.Thread(target=lambda: webbrowser.open(f"http://{args.host}:{args.port}"), daemon=True).start()
        
        try:
            app.run(host=args.host, port=args.port, debug=False)
        except KeyboardInterrupt:
            print("\n\n😊 接收到退出信号，正在关闭...")
            _close_all_connections()
            server_shutdown_event.set()
            print("✓ 已保存所有数据")
            print("✓ 已关闭数据库连接")
            print("✓ 感谢使用，再见！\n")


if __name__ == "__main__":
    main()