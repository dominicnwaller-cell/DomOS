$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "     DOM.OS V6.1 UPDATER SETUP" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
$owner = Read-Host "Your GitHub username"
$repo = Read-Host "GitHub repository name for DOM.OS"
if ([string]::IsNullOrWhiteSpace($owner) -or [string]::IsNullOrWhiteSpace($repo)) { throw "GitHub username and repository are required." }
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
$keyDir = Join-Path $PSScriptRoot ".domos-signing"
$key = Join-Path $keyDir "domos.key"
$pub = Join-Path $keyDir "domos.key.pub"
if (!(Test-Path $key)) { throw "Existing updater signing key not found. Copy your existing .domos-signing folder into this project first." }
if (!(Test-Path $pub)) { throw "Existing updater public key not found." }
$publicKey = (Get-Content $pub -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($publicKey)) { throw "Public signing key is empty." }
$configPath = Join-Path $PSScriptRoot "src-tauri\tauri.conf.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$config.plugins.updater.pubkey = $publicKey
$config.plugins.updater.endpoints = @("https://github.com/$owner/$repo/releases/latest/download/latest.json")
$json = $config | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText($configPath,$json,(New-Object System.Text.UTF8Encoding($false)))
# validate config immediately
$null = Get-Content $configPath -Raw | ConvertFrom-Json
@"
DOMOS_GITHUB_OWNER=$owner
DOMOS_GITHUB_REPO=$repo
TAURI_SIGNING_PRIVATE_KEY=$key
"@ | Set-Content ".domos-updater-config.txt"
Write-Host ""
Write-Host "Updater configured successfully." -ForegroundColor Green
Write-Host "GitHub endpoint: https://github.com/$owner/$repo/releases/latest/download/latest.json"
Write-Host ""
Write-Host "Existing signing key preserved." -ForegroundColor Green
Write-Host "Next: run BUILD-WINDOWS-UPDATER.bat"
Pause
