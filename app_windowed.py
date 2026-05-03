"""
店铺账目管理系统 - 窗口化启动脚本
使用 pywebview 创建原生应用窗口
窗口关闭时会自动保存数据并退出
"""

import webview
import threading
import time
import sys
import os

# 导入 Flask 应用
from main import app, init_db, DB_PATH, is_seeded, seed_data, _close_all_connections

def start_server():
    """在后台启动 Flask 服务器"""
    # 初始化数据库
    init_db()
    if not is_seeded():
        seed_data()
    
    # 启动服务器
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)

def on_window_closing():
    """窗口关闭时的回调函数"""
    print("\n😊 窗口正在关闭，正在保存数据...")
    time.sleep(1)
    _close_all_connections()
    print("✓ 已保存所有数据")
    print("✓ 已关闭数据库连接")
    print("✓ 感谢使用，再见！\n")

def main():
    """主函数"""
    print("=" * 60)
    print("店铺账目管理系统 v2.0.0 - 窗口版")
    print("关闭窗口将自动保存数据并退出")
    print("=" * 60)
    
    # 在后台线程启动服务器
    server_thread = threading.Thread(target=start_server, daemon=False)
    server_thread.start()
    
    # 等待服务器启动
    time.sleep(2)
    
    # 创建窗口
    window = webview.create_window(
        title='店铺账目管理系统',
        url='http://127.0.0.1:5000',
        width=1280,
        height=800,
        min_size=(800, 600),
        resizable=True,
        fullscreen=False,
    )
    
    # 注册窗口关闭事件
    try:
        window.events.closing += on_window_closing
    except AttributeError:
        pass
    
    # 启动窗口
    webview.start()
    
    # 窗口关闭后的清理
    print("\n😊 窗口已关闭，正在退出程序...")
    _close_all_connections()
    print("✓ 程序已安全退出\n")

if __name__ == '__main__':
    main()
