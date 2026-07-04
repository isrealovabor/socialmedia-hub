@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
if exist client\node_modules rmdir /s /q client\node_modules
if exist client\package-lock.json del /q client\package-lock.json
"C:\Program Files\nodejs\npm.cmd" install --prefix client --ignore-scripts --cache "%~dp0work\npm-cache"
