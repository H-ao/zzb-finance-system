#!/bin/bash
# 店铺账目管理系统 - PyInstaller 打包脚本

echo "======================================"
echo "店铺账目管理系统 - EXE 打包工具"
echo "======================================"

# 检查依赖
echo "检查依赖..."
pip install pywebview flask flask-cors pandas pyinstaller --break-system-packages

# 构建前端
echo "构建前端..."
npm run build

# 清理旧的构建文件
echo "清理旧的构建文件..."
rm -rf build/ dist/ *.spec

# 使用 PyInstaller 打包
echo "开始打包..."
pyinstaller \
    --name="店铺账目管理系统" \
    --windowed \
    --onefile \
    --icon="./logo.ico" \
    --add-data="dist:dist" \
    --add-data="finance_data.db:." \
    --hidden-import="flask" \
    --hidden-import="flask_cors" \
    --hidden-import="pandas" \
    --hidden-import="webview" \
    --collect-all="webview" \
    main.py

echo "======================================"
echo "✓ 打包完成！"
echo "======================================"
echo "可执行文件位置：dist/店铺账目管理系统.exe"
echo "======================================"

# 显示文件大小
if [ -f "dist/店铺账目管理系统.exe" ]; then
    ls -lh dist/店铺账目管理系统.exe
fi
