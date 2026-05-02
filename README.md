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
pip install -r requirements.txt --break-system-packages

# 安装前端依赖
npm install
```

### 🚀 一键启动（推荐）

```bash
# 使用快速启动脚本（提供交互式菜单）
./start.sh
```

### 启动方式

#### 方式 1: 浏览器模式（默认）

```bash
python3 main.py
```

自动在浏览器中打开 http://127.0.0.1:5000

#### 方式 2: 窗口模式（原生应用体验）

```bash
python3 main.py --windowed
# 或
python3 app_windowed.py
```

创建独立的应用窗口（类似原生应用）

#### 方式 3: 使用打包的 EXE（Linux）

```bash
./dist/店铺账目管理系统
```

#### 方式 4: 自定义配置

```bash
python3 main.py --port 8080 --host 0.0.0.0
```

### 📦 打包成 EXE

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

---

## 使用说明

### 店铺管理

- 最多支持 100 个店铺
- 3x3 网格布局展示
- 使用键盘 ← → 方向键快速翻页
- 点击店铺名称或代码进入订单簿

### 订单管理

- 添加发运：记录发货信息
- 修改发运：更新订单详情
- 删除发运：自动同步到核算 API

### 备份恢复

- **手动备份**：在设置页面点击"备份"按钮
- **恢复数据**：选择备份文件点击"恢复"
- **三件套验证**：物理 DB + CSV 导出 + 指纹清单

### 窗口模式

窗口模式提供类似原生桌面应用的体验：

```bash
# 窗口模式启动
python3 main.py --windowed

# 可选参数
python3 main.py --windowed --port 8080
```

窗口支持：
- 调整大小（最小 800x600）
- 全屏模式
- 原生标题栏

---

## 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--windowed, -w` | 以窗口模式启动 | - |
| `--port, -p` | 服务器端口 | 5000 |
| `--host` | 监听地址 | 127.0.0.1 |

---

## 项目结构

```
/workspace/
├── main.py                    # Flask 后端主程序
├── app_windowed.py            # 窗口模式专用脚本
├── start.sh                   # 快速启动脚本
├── build_exe.sh / .bat        # EXE 打包脚本
├── src/                       # React 前端源码
│   ├── components/           # UI 组件
│   ├── pages/                # 页面组件
│   ├── contexts/             # React Context
│   └── lib/                  # 工具库
├── dist/                      # 前端构建产物
├── finance_data.db            # SQLite 数据库
├── backups/                   # 自动备份目录
└── logs/                      # 日志目录
```

---

## 数据文件

| 文件 | 说明 | 位置 |
|------|------|------|
| `finance_data.db` | 主数据库 | 项目根目录 |
| `finance_data.db-wal` | WAL 日志 | 项目根目录 |
| `finance_data.db-shm` | 共享内存 | 项目根目录 |
| `backups/*.zip` | 备份文件 | `backups/` 目录 |
| `logs/*.log` | 日志文件 | `logs/` 目录 |

---

## 常见问题

### Q: 窗口模式无法启动？

**A**: 确保已安装 pywebview：
```bash
pip install pywebview --break-system-packages
```

### Q: 如何导出数据？

**A**: 备份功能会自动导出 CSV 文件，位置在备份 ZIP 包内。

### Q: 数据库文件在哪里？

**A**: 项目根目录的 `finance_data.db` 文件。

### Q: 可以多个设备共享数据吗？

**A**: 可以，将数据库文件放在共享目录（如网盘），其他设备访问同一文件即可。

### Q: 如何重置数据？

**A**: 删除 `finance_data.db` 文件，重启程序会自动初始化。

---

## 开发模式

### 启动开发服务器

```bash
# 后端（端口 5000）
python3 main.py

# 前端（端口 8080，热重载）
npm run dev
```

### 构建生产版本

```bash
# 构建前端静态文件
npm run build

# 启动后端（服务静态文件）
python3 main.py
```

---

## 相关文档

- [PACKAGING_GUIDE.md](PACKAGING_GUIDE.md) - EXE 打包详细指南
- [DELIVERY_NOTES.md](DELIVERY_NOTES.md) - 交付说明

---

## 更新日志

### v2.0.0 (2026-05-02)

**新增功能**
- ✅ 窗口模式支持（pywebview）
- ✅ EXE 打包支持（PyInstaller）
- ✅ 快速启动脚本
- ✅ 原生应用窗口体验

**Bug 修复**
- ✅ 修复 api.ts 语法错误
- ✅ 修复 BusinessSummaryCard 重复导出
- ✅ 修复数据库连接泄漏

**改进**
- ✅ 三件套备份机制（物理 + 逻辑 + 指纹）
- ✅ 输入验证装饰器
- ✅ API 重试机制
- ✅ 统一错误处理

---

## 许可证

MIT License - 仅供学习使用

## 技术支持

遇到问题时：
1. 查看控制台日志
2. 检查数据库文件权限
3. 确保端口未被占用
4. 重启程序尝试

---

**版本**: v2.0.0  
**构建日期**: 2026-05-02  
**平台支持**: Linux / Windows / Mac  
