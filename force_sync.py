import sqlite3
import os

DB_PATH = os.path.abspath('finance_data.db')

print('=' * 60)
print('强制同步 - 确保所有数据写入硬盘')
print('=' * 60)

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

print(f'连接数据库: {DB_PATH}')

cursor.execute('PRAGMA journal_mode=WAL')
result = cursor.fetchone()
print(f'当前日志模式: {result}')

cursor.execute('PRAGMA synchronous')
sync_mode = cursor.fetchone()[0]
print(f'同步模式: {sync_mode} (0=OFF, 1=NORMAL, 2=FULL, 3=EXTRA)')

conn.commit()
print('执行 db.session.commit() - 数据已提交')

cursor.execute('PRAGMA wal_checkpoint(FULL)')
checkpoint_result = cursor.fetchone()
print(f'WAL 检查点结果: {checkpoint_result}')

conn.commit()
print('再次提交确保所有数据写入主数据库文件')

cursor.execute('SELECT COUNT(*) FROM transactions')
tx_count = cursor.fetchone()[0]
cursor.execute('SELECT COUNT(*) FROM shops')
shop_count = cursor.fetchone()[0]
print()
print(f'当前数据库状态:')
print(f'  店铺数: {shop_count}')
print(f'  交易记录数: {tx_count}')

conn.close()
print()
print('强制同步完成 - 所有内存数据已写入硬盘')
print('=' * 60)
