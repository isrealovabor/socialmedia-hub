@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0server"
if not exist .env copy .env.example .env
"C:\Program Files\nodejs\npm.cmd" install --ignore-scripts --cache "%~dp0work\npm-cache"
"C:\Program Files\nodejs\node.exe" node_modules\prisma\build\index.js generate
"C:\Program Files\nodejs\node.exe" node_modules\prisma\build\index.js migrate dev --name init
"C:\Program Files\nodejs\node.exe" node_modules\prisma\build\index.js db seed
"C:\Program Files\nodejs\npm.cmd" run test:sqlite-flow
