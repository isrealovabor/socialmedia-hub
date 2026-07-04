@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
if not exist server\node_modules (
  "C:\Program Files\nodejs\npm.cmd" install --prefix server --ignore-scripts --cache "%~dp0work\npm-cache"
)
if not exist server\.env copy server\.env.example server\.env
cd /d "%~dp0server"
if not exist src\generated\marketplace\index.js (
  "C:\Program Files\nodejs\node.exe" node_modules\prisma\build\index.js generate
)
"C:\Program Files\nodejs\npm.cmd" run dev
