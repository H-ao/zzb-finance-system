# 店铺账目管理系统

一个基于 Flask + React 的店铺账目管理系统，支持多店铺财务数据管理、备份恢复功能。

## 功能特性

- **店铺管理**：支持多店铺管理，3x3 网格布局展示
- **交易记录**：收入/支出记录管理，支持分类统计
- **备份恢复**：双轨互验备份机制，支持一键备份和恢复
- **自动备份**：可配置定时自动备份功能
- **数据统计**：仪表盘展示收支趋势和店铺对比

## 技术栈

- **前端**：React 18 + TypeScript + Vite
- **后端**：Flask + SQLite
- **UI**：Shadcn/ui + TailwindCSS
- **图表**：Chart.js

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

### 启动开发服务器

```bash
# 启动后端（端口 5000）
python main.py

# 启动前端（端口 8080）
npm run dev
```

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