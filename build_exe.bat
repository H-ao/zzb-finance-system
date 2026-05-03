@echo off
chcp 65001 >nul
echo ======================================
echo 店铺账目管理系统 - EXE 打包工具
echo 版本：v2.0.2
echo ======================================
echo.

echo 检查 Python 安装...
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python
    echo 请安装 Python 3.10+ 并添加到 PATH
    pause
    exit /b 1
)

echo ✓ Python 已安装
python --version
echo.

echo 安装/更新依赖...
pip install -r requirements.txt pyinstaller --break-system-packages -q
if errorlevel 1 (
    echo [错误] 依赖安装失败
    pause
    exit /b 1
)
echo ✓ 依赖安装完成
echo.

echo 构建前端...
call npm install --silent >nul 2>&1
call npm run build --silent >nul 2>&1
if errorlevel 1 (
    echo [错误] 前端构建失败
    pause
    exit /b 1
)
echo ✓ 前端构建完成
echo.

echo 清理旧的构建文件...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist *.spec del /q *.spec
echo.

echo 开始打包 (可能需要 3-5 分钟)...
pyinstaller ^
    --name="店铺账目管理系统" ^
    --windowed ^
    --onefile ^
    --icon="./logo.ico" ^
    --add-data="dist;dist" ^
    --hidden-import="flask" ^
    --hidden-import="flask_cors" ^
    --hidden-import="pandas" ^
    --hidden-import="webview" ^
    --collect-all="webview" ^
    main.py

echo.
if exist "dist\店铺账目管理系统.exe" (
    echo ======================================
    echo ✓ 打包完成！
    echo ======================================
    echo 可执行文件：dist\店铺账目管理系统.exe
    dir /B "dist\店铺账目管理系统.exe"
    echo ======================================
    echo.
    echo 测试运行...
    start "" "dist\店铺账目管理系统.exe"
    echo 已启动测试，请关闭窗口测试是否正常退出
) else (
    echo ======================================
    echo ✗ 打包失败
    echo ======================================
    echo 请查看错误日志
)

echo.
pause
