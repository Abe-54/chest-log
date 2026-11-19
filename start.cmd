@echo off
setlocal
pushd "%~dp0web" || exit /b 1
where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 22.12 or later to run Chest Log.
  goto :failed
)
if not exist node_modules\.bin\vite.cmd (
  call npm ci --no-audit --no-fund
  if errorlevel 1 goto :failed
)
if not exist dist\index.html (
  call npm run build
  if errorlevel 1 goto :failed
)
if /i not "%~1"=="--no-open" start "" http://127.0.0.1:4173/
node server.mjs
if errorlevel 1 goto :failed
popd
exit /b 0
:failed
popd
pause
exit /b 1
