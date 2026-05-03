@echo off
chcp 65001 >nul
echo ======================================
echo 店铺账目管理系统 - EXE 打包工具 (调试模式)
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

echo 开始打包 (调试模式 - 会显示控制台窗口)...
echo 注意：此模式会显示控制台窗口，便于查看错误日志
echo.
pyinstaller ^
    --name="店铺账目管理系统 - 调试版" ^
    --console ^
    --onefile ^
    --icon="./logo.ico" ^
    --add-data="dist;dist" ^
    --hidden-import="path_manager" ^
    --hidden-import="flask" ^
    --hidden-import="flask_cors" ^
    --hidden-import="pandas" ^
    --hidden-import="webview" ^
    --collect-all="webview" ^
    main.py

echo.
if exist "dist\店铺账目管理系统 - 调试版.exe" (
    echo ======================================
    echo ✓ 调试版打包完成！
    echo ======================================
    echo 可执行文件：dist\店铺账目管理系统 - 调试版.exe
    dir /B "dist\店铺账目管理系统 - 调试版.exe"
    echo ======================================
    echo.
    echo 请按以下步骤测试：
    echo 1. 双击运行 dist\店铺账目管理系统 - 调试版.exe
    echo 2. 观察黑色控制台窗口的输出
    echo 3. 如果看到 "Running on http://127.0.0.1:8080" 说明启动成功
    echo 4. 如果看到错误堆栈，请截图发给我
    echo.
    echo 是否现在运行测试？(Y/N)
    set /p run_now=
    if /i "%run_now%"=="Y" (
        echo 已启动测试...
        echo 请观察黑色控制台的输出，按 Ctrl+C 可以退出
        start "" "dist\店铺账目管理系统 - 调试版.exe"
    )
) else (
    echo ======================================
    echo ✗ 打包失败
    echo ======================================
    echo 请查看错误日志
)

echo.
pause
