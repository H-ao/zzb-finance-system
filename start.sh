#!/bin/bash
# 店铺账目管理系统 - 快速启动脚本

echo "=================================================="
echo "店铺账目管理系统 v2.0.0"
echo "=================================================="
echo ""

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误：未找到 Python3"
    exit 1
fi

# 检查依赖
echo "检查依赖..."
python3 -c "import webview" 2>/dev/null || {
    echo "⚠️  未安装 pywebview，正在安装..."
    pip install pywebview --break-system-packages
}

# 检查前端构建
if [ ! -d "dist/assets" ]; then
    echo "⚠️  前端未构建，正在构建..."
    npm install
    npm run build
fi

echo ""
echo "选择启动方式:"
echo "1) 窗口模式 (推荐)"
echo "2) 浏览器模式"
echo "3) 使用已打包的 EXE"
echo ""
read -p "请选择 [1-3]: " choice

case $choice in
    1)
        echo ""
        echo "启动窗口模式..."
        python3 main.py --windowed
        ;;
    2)
        echo ""
        echo "启动浏览器模式..."
        python3 main.py
        ;;
    3)
        if [ -f "dist/店铺账目管理系统" ]; then
            echo ""
            echo "启动打包的 EXE..."
            ./dist/店铺账目管理系统
        else
            echo "❌ 错误：未找到打包的 EXE 文件"
            echo "请先运行 build_exe.sh 进行打包"
        fi
        ;;
    *)
        echo "无效选择"
        exit 1
        ;;
esac
