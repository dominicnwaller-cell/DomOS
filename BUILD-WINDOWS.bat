@echo off
title DOM.OS Windows Builder
cd /d "%~dp0"
echo.
echo ==========================================
echo        DOM.OS V6 Windows Builder
echo ==========================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)
where cargo >nul 2>nul
if errorlevel 1 (
  echo Rust is not installed.
  echo Install Rust from https://rustup.rs/
  pause
  exit /b 1
)
echo Installing project dependencies...
call npm install
if errorlevel 1 goto :fail
echo.
echo Building DOM.OS installer...
call npm run build
if errorlevel 1 goto :fail
echo.
echo BUILD COMPLETE.
echo Look inside:
echo src-tauri\target\release\bundle\nsis
echo and:
echo src-tauri\target\release\bundle\msi
echo.
pause
exit /b 0
:fail
echo.
echo Build failed. Leave this window open and send me a screenshot of the error.
pause
exit /b 1
