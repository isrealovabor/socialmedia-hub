@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
if not exist client\node_modules (
  "C:\Program Files\nodejs\npm.cmd" install --prefix client --ignore-scripts --cache "%~dp0work\npm-cache"
)
"C:\Program Files\nodejs\npm.cmd" run dev --prefix client
