@echo off
title BuildMate server (keep this window open while using the app)
cd /d "%~dp0..\tools\mock-api"

where node >nul 2>&1
if errorlevel 1 (
  echo NODE_MISSING > "%~dp0server-log.txt"
  echo.
  echo  Node.js is not installed on this PC, so the BuildMate server cannot start.
  echo.
  pause
  exit /b 1
)

rem Stop an older BuildMate server still running on port 5080, so the updated one can start.
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5080 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo  BuildMate server is starting on port 5080...
echo  If Windows asks whether to allow Node.js on networks, tick "Private networks" and click Allow.
echo  Keep this window open while you use the app. Close it to stop the server.
echo.
node --version > "%~dp0server-log.txt" 2>&1
node server.mjs >> "%~dp0server-log.txt" 2>&1
echo SERVER_STOPPED >> "%~dp0server-log.txt"
echo  The server stopped. Details are in mobile\server-log.txt
pause
