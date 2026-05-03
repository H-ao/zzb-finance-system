#!/bin/bash
# 店铺账目管理系统 - PyInstaller 打包脚本
# 版本：v2.0.2

echo "======================================"
echo "店铺账目管理系统 - EXE 打包工具"
echo "版本：v2.0.2"
echo "======================================"
echo ""

# 检查 Python
echo "检查 Python 安装..."
if ! command -v python3 &> /dev/null; then
    echo "[错误] 未找到 Python3"
    exit 1
fi
echo "✓ Python 已安装"
python3 --version
echo ""

# 安装依赖
echo "安装/更新依赖..."
pip install -r requirements.txt pyinstaller --break-system-packages -q
if [ $? -ne 0 ]; then
    echo "[错误] 依赖安装失败"
    exit 1
fi
echo "✓ 依赖安装完成"
echo ""

# 构建前端
echo "构建前端..."
npm install --silent 2>/dev/null
npm run build --silent 2>/dev/null
if [ $? -ne 0 ]; then
    echo "[错误] 前端构建失败"
    exit 1
fi
echo "✓ 前端构建完成"
echo ""

# 清理
echo "清理旧的构建文件..."
rm -rf build/ dist/ *.spec
echo ""

# 打包
echo "开始打包 (可能需要 3-5 分钟)..."
pyinstaller \
    --name="店铺账目管理系统" \
    --windowed \
    --onefile \
    --icon="./logo.ico" \
    --add-data="dist:dist" \
    --hidden-import="flask" \
    --hidden-import="flask_cors" \
    --hidden-import="pandas" \
    --hidden-import="webview" \
    --collect-all="webview" \
    main.py

echo ""
# 检查结果
if [ -f "dist/店铺账目管理系统" ]; then
    echo "======================================"
    echo "✓ 打包完成！"
    echo "======================================"
    echo "可执行文件：dist/店铺账目管理系统"
    ls -lh dist/店铺账目管理系统
    echo "======================================"
    echo ""
    echo "测试运行..."
    ./dist/店铺账目管理系统 &
    echo "已启动测试，请关闭窗口测试是否正常退出"
else
    echo "======================================"
    echo "✗ 打包失败"
    echo "======================================"
    echo "请查看错误日志"
fi
echo ""
