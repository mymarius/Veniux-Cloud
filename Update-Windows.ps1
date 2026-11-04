#requires -Version 7.0
param([string]$DataDirectory = (Join-Path $env:LOCALAPPDATA 'Veniux/data'),[switch]$DownloadWhatsAppBrowser)
$ErrorActionPreference = 'Stop'
$DataDirectory = [IO.Path]::GetFullPath($DataDirectory)
& (Join-Path $PSScriptRoot 'Stop-Production.ps1') -DataDirectory $DataDirectory
Push-Location (Join-Path $PSScriptRoot 'backend')
try {
 $PreviousBrowserDownload=$env:PUPPETEER_SKIP_DOWNLOAD
 $env:PUPPETEER_SKIP_DOWNLOAD=if($DownloadWhatsAppBrowser){'false'}else{'true'}
 try { & npm ci --omit=dev; if ($LASTEXITCODE) { throw 'Yeni sürüm bağımlılıkları kurulamadı. Eski sürüm klasörü korunmalı.' } }
 finally { if($null -eq $PreviousBrowserDownload){Remove-Item Env:PUPPETEER_SKIP_DOWNLOAD -ErrorAction SilentlyContinue}else{$env:PUPPETEER_SKIP_DOWNLOAD=$PreviousBrowserDownload} }
} finally { Pop-Location }
if (!(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'frontend/dist/index.html'))) { throw 'Yeni sürümün derlenmiş arayüzü eksik; güncelleme yapılmadı.' }
& node (Join-Path $PSScriptRoot 'backend/scripts/manageDeployment.js') update --data-dir $DataDirectory
if ($LASTEXITCODE) { throw 'Güncelleme tamamlanmadı; uygulama açılmayacak. Kurtarma rehberini izleyin.' }
Write-Host 'Güncelleme tamamlandı. Start-Production.ps1 ile başlatın. Atama bekleyen kullanıcıları Ayarlar > Kullanıcılar ekranında kontrol edin.'
