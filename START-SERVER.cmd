@echo off
cd /d "%~dp0"
set "GROUP_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "GROUP_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not "%GROUP_NODE%"=="node" if not exist "%GROUP_NODE%" (
  echo Install Node.js 24.14 or later, then run this file again.
  pause
  exit /b 1
)
"%GROUP_NODE%" --env-file-if-exists=server/.env server/main.mjs
pause
