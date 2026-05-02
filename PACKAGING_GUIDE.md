# 店铺账目管理系统 - 打包说明

## 📦 打包方式

### 方式 1: 快速打包（推荐新手）

#### Windows 用户

1. **双击运行** `build_exe.bat`
2. 等待打包完成（约 2-5 分钟）
3. 在 `dist/` 目录找到 `店铺账目管理系统.exe`

#### Mac/Linux 用户

```bash
chmod +x build_exe.sh
./build_exe.sh
```

---

### 方式 2: 分步打包（推荐高级用户）

#### 1. 安装依赖

```bash
# 安装 Python 依赖
pip install pywebview flask flask-cors pandas pyinstaller --break-system-packages

# 安装前端依赖
npm install
```

#### 2. 构建前端

```bash
# 构建生产版本
npm run build
```

#### 3. 测试窗口模式

```bash
# 先测试窗口模式是否正常工作
python app_windowed.py
```

#### 4. 打包成 EXE

**Windows**:
```bash
pyinstaller --name="店铺账目管理系统" --windowed --onefile --icon="./logo.ico" --add-data="dist;dist" --add-data="finance_data.db;." --hidden-import="flask" --hidden-import="flask_cors" --hidden-import="pandas" --hidden-import="webview" --collect-all="webview" main.py
```

**Mac**:
```bash
pyinstaller --name="店铺账目管理系统" --windowed --onefile --icon="./logo.icns" --add-data="dist:dist" --add-data="finance_data.db:." --hidden-import="flask" --hidden-import="flask_cors" --hidden-import="pandas" --hidden-import="webview" --collect-all="webview" main.py
```

**Linux**:
```bash
pyinstaller --name="店铺账目管理系统" --windowed --onefile --add-data="dist:dist" --add-data="finance_data.db:." --hidden-import="flask" --hidden-import="flask_cors" --hidden-import="pandas" --hidden-import="webview" --collect-all="webview" main.py
```

---

## 🚀 使用方法

### 浏览器模式（默认）

```bash
python main.py
```

自动在浏览器中打开 http://127.0.0.1:5000

### 窗口模式

```bash
python main.py --windowed
# 或
python app_windowed.py
```

创建独立的 application 窗口

### 自定义端口

```bash
python main.py --port 8080 --windowed
```

---

## 📊 打包产物说明

打包完成后，`dist/` 目录下会生成：

```
dist/
└── 店铺账目管理系统.exe    # 单个可执行文件（约 150-200MB）
```

### 文件内容

这个 EXE 文件包含：
- Python 运行时
- Flask Web 服务器
- 前端静态文件
- SQLite 数据库
- pywebview 窗口框架

### 首次运行

1. **双击运行** `店铺账目管理系统.exe`
2. 程序会自动：
   - 初始化数据库（如需要）
   - 创建应用窗口
   - 启动本地服务器
3. 关闭窗口即可退出

### 数据位置

程序会在**同目录**下创建：
- `finance_data.db` - 数据库文件
- `backups/` - 自动备份目录

**建议**: 将 EXE 放在固定位置（如 `C:\Program Files\` 或 `~/Applications/`），避免移动导致数据丢失。

---

## ⚠️ 注意事项

### 1. 文件大小

- 打包后约 **150-200MB**
- 原因：包含完整的 Python 运行时和所有依赖
- 解决方案：使用虚拟环境打包可减小体积

### 2. 启动速度

- 首次启动较慢（5-10 秒）
- 原因：需要解压临时文件
- 后续启动会快一些

### 3. 杀毒软件

某些杀毒软件可能会报毒（误报），这是 PyInstaller 打包的常见问题。

**解决方案**:
- 添加到杀毒软件白名单
- 或向杀毒软件厂商报告误报

### 4. 系统兼容性

- **Windows**: Windows 7 及以上（64 位）
- **macOS**: macOS 10.13 及以上
- **Linux**: 大多数现代发行版

---

## 🔧 高级选项

### 减小文件体积

```bash
# 使用 UPX 压缩（可选）
pip install upx

pyinstaller \
    --name="店铺账目管理系统" \
    --windowed \
    --onefile \
    --icon="./logo.ico" \
    --add-data="dist;dist" \
    --add-data="finance_data.db;." \
    --hidden-import="flask" \
    --hidden-import="flask_cors" \
    --hidden-import="pandas" \
    --hidden-import="webview" \
    --collect-all="webview" \
    --upx-dir=/path/to/upx \
    main.py
```

### 添加版本信息

创建 `version_info.txt`:

```txt
VSVersionInfo(
  ffi=FixedFileInfo(
    filevers=(2, 0, 0, 0),
    prodvers=(2, 0, 0, 0),
    mask=0x3f,
    flags=0x0,
    OS=0x40004,
    fileType=0x1,
    subtype=0x0,
    date=(0, 0)
  ),
  kids=[
    StringFileInfo([
      StringTable(
        u'040904B0',
        [StringStruct(u'CompanyName', u'Your Company'),
         StringStruct(u'FileDescription', u'店铺账目管理系统'),
         StringStruct(u'FileVersion', u'2.0.0'),
         StringStruct(u'InternalName', u'FinanceLedger'),
         StringStruct(u'LegalCopyright', u'Copyright © 2024'),
         StringStruct(u'OriginalFilename', u'店铺账目管理系统.exe'),
         StringStruct(u'ProductName', u'店铺账目管理系统'),
         StringStruct(u'ProductVersion', u'2.0.0')])
    ]),
    VarFileInfo([VarStruct(u'Translation', [1033, 1200])])
  ]
)
```

然后添加到打包命令：
```bash
pyinstaller --version-info=version_info.txt ...其他参数
```

---

## 📝 故障排查

### 问题 1: 无法找到模块

```
ModuleNotFoundError: No module named 'xxx'
```

**解决**: 添加 `--hidden-import` 参数
```bash
pyinstaller --hidden-import="模块名" ...
```

### 问题 2: 数据文件丢失

```
FileNotFoundError: [Errno 2] No such file or directory: 'dist'
```

**解决**: 确保 `--add-data` 参数正确
- Windows: `--add-data="dist;dist"`
- Mac/Linux: `--add-data="dist:dist"`

### 问题 3: 无法创建窗口

```
webview.excptions.WebViewError: ...
```

**解决**: 
- Windows: 确保安装了 WebView2
- Mac: 确保是 10.13+ 系统
- Linux: 安装 `python3-webview` 和 WebKitGTK

### 问题 4: 杀毒软件拦截

**解决**:
1. 临时关闭杀毒软件
2. 将 EXE 添加到白名单
3. 或使用代码签名证书

---

## 📞 获取帮助

遇到问题时:
1. 查看控制台日志
2. 检查 `finance_data.db` 是否正确生成
3. 确保 `dist/` 目录包含构建的前端文件
4. 尝试以浏览器模式运行排除窗口问题

---

## 📄 许可证

MIT License - 仅供学习使用
