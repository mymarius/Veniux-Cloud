#requires -Version 7.0
param([string]$DataDirectory = (Join-Path $env:LOCALAPPDATA 'Veniux/data'),[switch]$DownloadWhatsAppBrowser)
$ErrorActionPreference = 'Stop'
$DataDirectory = [IO.Path]::GetFullPath($DataDirectory)
New-Item -ItemType Directory -Path $DataDirectory -Force | Out-Null
$Identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $DataDirectory /inheritance:r /grant:r "${Identity}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' /T /Q | Out-Null
if ($LASTEXITCODE) { throw 'Özel veri klasörü erişimi sınırlandırılamadı; işlem başlamadı.' }

$DataDirectory = [IO.Path]::GetFullPath($DataDirectory)
if ((& node -p "process.versions.node.split('.')[0]") -ne '24') { throw 'Node.js 24.x kurulmalı.' }
$ProjectDirectory = $PSScriptRoot
Push-Location (Join-Path $ProjectDirectory 'backend')
try {
 $PreviousBrowserDownload=$env:PUPPETEER_SKIP_DOWNLOAD
 $env:PUPPETEER_SKIP_DOWNLOAD=if($DownloadWhatsAppBrowser){'false'}else{'true'}
 try { & npm ci --omit=dev; if ($LASTEXITCODE) { throw 'API bağımlılıkları kurulamadı.' } }
 finally { if($null -eq $PreviousBrowserDownload){Remove-Item Env:PUPPETEER_SKIP_DOWNLOAD -ErrorAction SilentlyContinue}else{$env:PUPPETEER_SKIP_DOWNLOAD=$PreviousBrowserDownload} }
} finally { Pop-Location }
if(!$DownloadWhatsAppBrowser){Write-Host 'İsteğe bağlı Chromium indirilmedi. WhatsApp için mevcut Chrome/Edge veya özel WHATSAPP_BROWSER_PATH gerekir.'}
if (!(Test-Path -LiteralPath (Join-Path $ProjectDirectory 'frontend/dist/index.html'))) {
 Push-Location (Join-Path $ProjectDirectory 'frontend')
 try { & npm ci; if ($LASTEXITCODE) { throw 'Arayüz bağımlılıkları kurulamadı.' }; & npm run build; if ($LASTEXITCODE) { throw 'Arayüz derlenemedi.' } } finally { Pop-Location }
}
$Account = @{ companyName = (Read-Host 'Firma adı'); email = (Read-Host 'İlk yönetici e-postası'); fullName = (Read-Host 'Yönetici adı soyadı'); phone = (Read-Host 'Firma sahibi telefonu') }
$SecurePassword = Read-Host 'Şifre (en az 12 karakter, büyük/küçük harf ve rakam)' -AsSecureString
$PasswordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
try {
 $Account.password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($PasswordPointer)
 $Account | ConvertTo-Json -Compress | & node (Join-Path $ProjectDirectory 'backend/scripts/manageDeployment.js') init --data-dir $DataDirectory
 if ($LASTEXITCODE) { throw 'Kurulum tamamlanmadı. Hata açıklamasını kontrol edin.' }
} finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordPointer); $Account.Remove('password'); $SecurePassword.Dispose() }
# Private snapshots contain credentials and must remain restricted to the Windows account.
$Identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $DataDirectory /inheritance:r /grant:r "${Identity}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' /T /Q | Out-Null
if ($LASTEXITCODE) { throw 'Veri klasörü izinleri sınırlandırılamadı; başlatmadan önce izinleri düzeltin.' }
Write-Host 'Kurulum tamamlandı. Start-Production.ps1 ile başlatın.'
