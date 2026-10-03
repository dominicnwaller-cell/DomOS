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

Write-Host "Installing updater build dependencies..."
npm install
New-Item -ItemType Directory -Force -Path ".domos-signing" | Out-Null

$key = Join-Path $PSScriptRoot ".domos-signing\domos.key"
$pub = "$key.pub"
if (!(Test-Path $key)) {
  Write-Host ""
  Write-Host "Creating your permanent DOM.OS updater signing key..." -ForegroundColor Yellow
  Write-Host "When Tauri asks for a password, you can choose one. DO NOT lose the key/password." -ForegroundColor Yellow
  npm run tauri signer generate -- -w $key
}
if (!(Test-Path $pub)) { throw "Public signing key was not created at $pub" }

$publicKey = (Get-Content $pub -Raw).Trim()
$configPath = Join-Path $PSScriptRoot "src-tauri\tauri.conf.json"
$config = Get-Content $configPath -Raw
$config = $config.Replace("__GITHUB_OWNER__", $owner).Replace("__GITHUB_REPO__", $repo).Replace("__DOMOS_UPDATER_PUBLIC_KEY__", $publicKey)
Set-Content -Path $configPath -Value $config -Encoding UTF8

@"
DOMOS_GITHUB_OWNER=$owner
DOMOS_GITHUB_REPO=$repo
TAURI_SIGNING_PRIVATE_KEY=$key
"@ | Set-Content ".domos-updater-config.txt"

Write-Host ""
Write-Host "Updater configured." -ForegroundColor Green
Write-Host "Repository endpoint: https://github.com/$owner/$repo/releases/latest/download/latest.json"
Write-Host ""
Write-Host "IMPORTANT: .domos-signing\domos.key is your permanent PRIVATE updater key." -ForegroundColor Yellow
Write-Host "Back it up somewhere safe and never upload it publicly." -ForegroundColor Yellow
Write-Host ""
Write-Host "Next: run BUILD-WINDOWS-UPDATER.bat"
Pause
