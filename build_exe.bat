@echo off
chcp 65001 >nul
echo ======================================
echo 店铺账目管理系统 - EXE 打包工具
echo ======================================
echo.

echo 检查依赖...
pip install pywebview flask flask-cors pandas pyinstaller --break-system-packages
echo.

echo 构建前端...
call npm run build
echo.

echo 清理旧的构建文件...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist *.spec del /q *.spec
echo.

echo 开始打包...
pyinstaller ^
    --name="店铺账目管理系统" ^
    --windowed ^
    --onefile ^
    --icon="./logo.ico" ^
    --add-data="dist;dist" ^
    --add-data="finance_data.db;." ^
    --hidden-import="flask" ^
    --hidden-import="flask_cors" ^
    --hidden-import="pandas" ^
    --hidden-import="webview" ^
    --collect-all="webview" ^
    main.py

echo.
echo ======================================
echo ✓ 打包完成！
echo ======================================
echo 可执行文件位置：dist\店铺账目管理系统.exe
echo ======================================
echo.

if exist "dist\店铺账目管理系统.exe" (
    dir /B "dist\店铺账目管理系统.exe"
)

pause
