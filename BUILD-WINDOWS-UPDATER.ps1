$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$key = Join-Path $PSScriptRoot ".domos-signing\domos.key"
if (!(Test-Path $key)) { throw "Updater signing key missing. Run SETUP-UPDATER.bat first." }
$env:TAURI_SIGNING_PRIVATE_KEY = $key
Write-Host "Building signed DOM.OS updater-enabled installer..." -ForegroundColor Green
npm install
npm run build
Write-Host ""
Write-Host "BUILD COMPLETE" -ForegroundColor Green
Write-Host "NSIS installer + .sig:"
Write-Host "src-tauri\target\release\bundle\nsis"
Write-Host ""
Write-Host "MSI installer + .sig:"
Write-Host "src-tauri\target\release\bundle\msi"
Pause
