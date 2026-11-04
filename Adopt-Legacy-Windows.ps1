#requires -Version 7.0
param([Parameter(Mandatory)][string]$LegacyBackendDirectory,[string]$DataDirectory = (Join-Path $env:LOCALAPPDATA 'Veniux/data'))
$ErrorActionPreference = 'Stop'
$DataDirectory = [IO.Path]::GetFullPath($DataDirectory)
New-Item -ItemType Directory -Path $DataDirectory -Force | Out-Null
$Identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $DataDirectory /inheritance:r /grant:r "${Identity}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' /T /Q | Out-Null
if ($LASTEXITCODE) { throw 'Özel veri klasörü erişimi sınırlandırılamadı; işlem başlamadı.' }

& node (Join-Path $PSScriptRoot 'backend/scripts/manageDeployment.js') adopt --data-dir ([IO.Path]::GetFullPath($DataDirectory)) --legacy-backend ([IO.Path]::GetFullPath($LegacyBackendDirectory))
if ($LASTEXITCODE) { throw 'Taşıma tamamlanmadı. Eski veritabanı değişmedi. Hedef klasörü koruyun ve hata açıklamasını giderin.' }
$Identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls ([IO.Path]::GetFullPath($DataDirectory)) /inheritance:r /grant:r "${Identity}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' /T /Q | Out-Null
if ($LASTEXITCODE) { throw 'Veri klasörü erişim izinleri sınırlandırılamadı.' }
Write-Host 'Eski kullanıcılar ve dosyalar taşındı. Update-Windows.ps1 çalıştırın.'
