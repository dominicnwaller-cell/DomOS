@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0BUILD-WINDOWS-UPDATER.ps1"
if errorlevel 1 (
  echo.
  echo ==========================================
  echo DOM.OS BUILD FAILED
  echo ==========================================
  echo Leave this window open and send a screenshot of the error.
  pause
  exit /b 1
)
