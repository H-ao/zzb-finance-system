@echo off

REM 输出彩色文本的函数
:ColorText
for /F "delims=^= tokens=1,2" %%a in ('findstr /b "%~1=" %~f0') do set "color=%%b"
echo.>&2
<nul set /p="%~2" >&2
color %color%
echo.%~2>&2
color 07
goto :eof

REM 主脚本开始
cls
echo 开始构建 Lovable 项目...
echo.>

REM 检查 npm 是否可用
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    call :ColorText RED "错误: npm 不可用，请确保 Node.js 已正确安装"
    pause
    exit /b 1
)

echo 正在执行 npm install...
echo.>
npm install

if %errorlevel% neq 0 (
    call :ColorText RED "错误: npm install 失败"
    pause
    exit /b 1
)

echo.>
echo 正在执行 npm run build...
echo.>
npm run build

if %errorlevel% neq 0 (
    call :ColorText RED "错误: npm run build 失败"
    pause
    exit /b 1
)

echo.>
call :ColorText GREEN "构建成功！"
echo.>
echo 生成的 dist 文件夹内容：
echo.>
dir dist

echo.>
call :ColorText YELLOW "构建完成，按任意键退出..."
pause >nul

REM 颜色定义
RED=0C
GREEN=0A
YELLOW=0E