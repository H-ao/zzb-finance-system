# 店铺账目管理系统

一个基于 Flask + React 的店铺账目管理系统，支持多店铺财务数据管理、备份恢复功能。

## 功能特性

- **店铺管理**：支持多店铺管理，3x3 网格布局展示
- **交易记录**：收入/支出记录管理，支持分类统计
- **备份恢复**：三件套备份机制（物理 + 逻辑 + 指纹），支持一键备份和恢复
- **自动备份**：可配置定时自动备份功能
- **数据统计**：仪表盘展示收支趋势和店铺对比
- **窗口模式**：支持原生应用窗口或浏览器模式
- **EXE 打包**：一键打包成独立可执行文件

## 技术栈

- **前端**：React 18 + TypeScript + Vite
- **后端**：Flask + SQLite
- **UI**：Shadcn/ui + TailwindCSS
- **图表**：Recharts
- **窗口框架**: pywebview

## 快速开始

### 环境要求

- Python 3.10+
- Node.js 18+

### 安装依赖

```bash
# 安装 Python 依赖
pip install -r requirements.txt

# 安装前端依赖
npm install
```

### 启动方式

#### 方式 1: 浏览器模式（默认）

```bash
python main.py
```

自动在浏览器中打开 http://127.0.0.1:5000

#### 方式 2: 窗口模式

```bash
python main.py --windowed
# 或
python app_windowed.py
```

创建独立的应用窗口（类似原生应用）

#### 方式 3: 自定义配置

```bash
python main.py --port 8080 --host 0.0.0.0
```

#### 方式 4: 使用 EXE（Windows）

```bash
# 双击运行
dist\店铺账目管理系统.exe
```

### 可选：打包成 EXE

**Windows 用户**:
```bash
# 双击运行打包脚本
build_exe.bat
```

**Mac/Linux 用户**:
```bash
chmod +x build_exe.sh
./build_exe.sh
```

打包完成后在 `dist/` 目录找到可执行文件。

详见：[PACKAGING_GUIDE.md](PACKAGING_GUIDE.md)

### 项目结构

```
.
├── main.py                 # Flask 后端入口
├── requirements.txt        # Python 依赖
├── package.json            # 前端依赖
├── src/                    # 前端源码
│   ├── pages/              # 页面组件
│   ├── components/         # UI 组件
│   ├── contexts/           # React Context
│   └── lib/                # 工具函数
└── backups/                # 备份文件目录
```

## API 接口

### 备份管理

- `POST /api/backup` - 创建备份（返回 ZIP 文件）
- `POST /api/restore` - 恢复备份（上传 ZIP 文件）
- `GET /api/config/backup` - 获取备份配置
- `POST /api/config/backup` - 设置自动备份配置

## 数据库结构

主要数据表：
- `shops` - 店铺信息
- `transactions` - 交易记录
- `categories` - 分类信息
- `currencies` - 货币配置

## 备份机制

系统采用双轨互验备份机制：
1. 复制 SQLite 数据库文件
2. 导出所有表为 CSV 文件
3. 生成 integrity.json 包含哈希校验和记录数
4. 打包为 ZIP 文件下载

## 许可证

MIT License