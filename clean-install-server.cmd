@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
if exist server\node_modules rmdir /s /q server\node_modules
if exist server\package-lock.json del /q server\package-lock.json
"C:\Program Files\nodejs\npm.cmd" install --prefix server --ignore-scripts --cache "%~dp0work\npm-cache"
