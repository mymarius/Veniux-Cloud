@echo off
cd /d "%~dp0desktop"
set ELECTRON_RUN_AS_NODE=
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0desktop\Start-Backend.ps1"
if errorlevel 1 (
 pause
 exit /b 1
)
if not exist "node_modules\electron\cli.js" (
 echo Once Veniux-Kurulum.cmd dosyasini acin. Electron hazir degil.
 pause
 exit /b 1
)
if not exist "..\frontend\dist\index.html" (
 echo Once Veniux-Kurulum.cmd dosyasinda ekrani hazirlayin.
 pause
 exit /b 1
)
call npm.cmd start
if errorlevel 1 pause
