# GitHub Release 创建指南

## 📋 Release 信息

### Tag 版本
**v2.0.0** (已创建并推送)

### Release 标题
```
v2.0.0 - 窗口模式与 EXE 打包
```

### Release 说明

```markdown
## 🎉 重大更新

### ✨ 新增功能

#### 1. 窗口模式 (Windowed Mode)
- 原生应用窗口体验，类似桌面软件
- 支持调整窗口大小（最小 800x600）
- 独立窗口，不依赖浏览器
- 全屏模式支持

**运行方式**:
```bash
python3 main.py --windowed
# 或
python3 app_windowed.py
```

#### 2. EXE 打包支持
- 一键打包成独立可执行文件
- 无需 Python 环境即可运行
- 适合分发部署
- 支持 Linux/Windows/Mac

**打包命令**:
```bash
# Linux/Mac
./build_exe.sh

# Windows
build_exe.bat
```

#### 3. 快速启动脚本
一键启动，提供交互式菜单

**使用方式**:
```bash
./start.sh
```

### 🐛 Bug 修复

- 修复 `api.ts` 语法错误
- 修复 `BusinessSummaryCard.tsx` 重复导出
- 修复数据库连接泄漏

### 🚀 改进

- 三件套备份机制
- 输入验证装饰器
- API 重试机制
- 统一错误处理

### 📦 安装说明

#### 开发环境
```bash
pip install -r requirements.txt --break-system-packages
npm install
./start.sh
```

#### 使用 EXE (Linux)
```bash
./dist/店铺账目管理系统
```

### 📊 技术栈

- React 18 + TypeScript + Vite
- Flask + SQLite
- Shadcn/ui + TailwindCSS
- Recharts
- pywebview
- PyInstaller

### 📝 文档

- README.md - 使用说明
- PACKAGING_GUIDE.md - 打包指南
- DELIVERY_NOTES.md - 交付说明

---

**Full Changelog**: https://github.com/H-ao/zzb-finance-system/compare/v1.0.0...v2.0.0
```

---

## 📤 上传文件

### 方式 1: GitHub Web 界面（推荐）

1. 访问：https://github.com/H-ao/zzb-finance-system/releases/new
2. Tag version: 选择 `v2.0.0`
3. Release title: `v2.0.0 - 窗口模式与 EXE 打包`
4. 粘贴上面的 Release 说明
5. 上传文件：
   - `zzb-finance-system-v2.0.0.zip` (50MB)
6. 点击 "Publish release"

### 方式 2: GitHub CLI

如果已配置 gh CLI：

```bash
cd /workspace
gh release create v2.0.0 \
  --title "v2.0.0 - 窗口模式与 EXE 打包" \
  --notes-file - \
  zzb-finance-system-v2.0.0.zip << 'EOF'
[粘贴上面的 Release 说明]
EOF
```

### 方式 3: 使用 curl

```bash
# 1. 创建 Release
RELEASE_JSON=$(curl -X POST \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/H-ao/zzb-finance-system/releases \
  -d '{"tag_name":"v2.0.0","name":"v2.0.0 - 窗口模式与 EXE 打包","body":"[Release 说明]","draft":false,"prerelease":false}')

# 2. 获取 upload_url
UPLOAD_URL=$(echo $RELEASE_JSON | jq -r .upload_url | sed 's/{?name,label}//')

# 3. 上传文件
curl -X POST \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  -H "Content-Type: application/zip" \
  "$UPLOAD_URL?name=zzb-finance-system-v2.0.0.zip" \
  --data-binary @zzb-finance-system-v2.0.0.zip
```

---

## ✅ 已完成

- ✅ 代码已推送到 GitHub (commit: e947eff)
- ✅ Tag v2.0.0 已创建并推送
- ✅ 发布包已准备：`zzb-finance-system-v2.0.0.zip` (50MB)
- ✅ Release 说明已准备

## ⏳ 待完成

- ⏳ 手动创建 Release 页面
- ⏳ 上传发布包

---

## 📦 发布包内容

```
zzb-finance-system-v2.0.0.zip (50MB)
├── main.py                    # 主程序
├── app_windowed.py            # 窗口模式脚本
├── requirements.txt           # Python 依赖
├── dist/                      # 前端构建产物
│   ├── 店铺账目管理系统         # Linux EXE (50MB)
│   ├── index.html
│   └── assets/
├── start.sh                   # 快速启动脚本
├── build_exe.sh / .bat        # 打包脚本
├── README.md                  # 使用说明
├── PACKAGING_GUIDE.md         # 打包指南
├── DELIVERY_NOTES.md          # 交付说明
└── logo.ico                   # 图标
```

---

## 🔗 相关链接

- Repository: https://github.com/H-ao/zzb-finance-system
- Releases: https://github.com/H-ao/zzb-finance-system/releases
- Create Release: https://github.com/H-ao/zzb-finance-system/releases/new

---

**创建时间**: 2026-05-02  
**版本**: v2.0.0  
**发布包**: zzb-finance-system-v2.0.0.zip (50MB)