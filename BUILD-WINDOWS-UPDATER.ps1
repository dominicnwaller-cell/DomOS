$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$key = Join-Path $PSScriptRoot ".domos-signing\domos.key"
if (!(Test-Path $key)) { Write-Host "ERROR: updater signing key missing." -ForegroundColor Red; exit 1 }
$env:TAURI_SIGNING_PRIVATE_KEY = $key
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "BUILD FAILED during npm install." -ForegroundColor Red; exit $LASTEXITCODE }
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "BUILD FAILED. Do not use installers from this run." -ForegroundColor Red; exit $LASTEXITCODE }
Write-Host ""
Write-Host "BUILD COMPLETE" -ForegroundColor Green
Write-Host "NSIS installer + .sig: src-tauri\target\release\bundle\nsis"
Write-Host "MSI installer + .sig:  src-tauri\target\release\bundle\msi"
Pause
