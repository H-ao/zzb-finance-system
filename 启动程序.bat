@echo off
chcp 65001 >nul
echo ==================================================
echo 店铺账目管理系统 v2.0.0
echo ==================================================
echo.

echo 检查 Python 安装...
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo [错误] 未找到 Python
    echo.
    echo 请先安装 Python 3.10+:
    echo https://www.python.org/downloads/
    echo.
    echo 安装时请勾选 "Add Python to PATH"
    echo.
    pause
    exit /b 1
)

echo ✓ Python 已安装
python --version
echo.

echo 安装依赖...
pip install -r requirements.txt -q
if errorlevel 1 (
    echo.
    echo [错误] 依赖安装失败
    echo 请手动运行：pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)
echo ✓ 依赖安装完成
echo.

echo ==================================================
echo 启动程序...
echo ==================================================
echo.
echo 即将打开浏览器，访问 http://127.0.0.1:5000
echo.
echo 按 Ctrl+C 停止程序
echo.

python main.py

pause
