param([Parameter(Mandatory=$true)][string]$RuntimeDirectory)
$ErrorActionPreference='Stop'
$managed=Join-Path $RuntimeDirectory 'xampp'
$binary=Join-Path $managed 'mysql/bin/mysqld.exe'
function ConfirmMariaDb([string]$file) {
  if(!(Test-Path -LiteralPath $file -PathType Leaf)){return $false}
  $version=& $file --version 2>$null
  return $LASTEXITCODE -eq 0 -and $version -match '10\.4\.32-MariaDB'
}
# Existing binaries can be reused; their data directory and configuration are never used.
if(ConfirmMariaDb 'C:\xampp\mysql\bin\mysqld.exe') {
  [Console]::WriteLine('C:\xampp\mysql\bin'); exit 0
}
if(!(ConfirmMariaDb $binary)) {
  if(Test-Path -LiteralPath $managed){throw 'Yarım veya farklı XAMPP kurulumu bulundu. Otomatik üzerine yazma durduruldu.'}
  $installer=Join-Path $RuntimeDirectory 'xampp-8.2.12-installer.exe'
  # This pinned URL is linked by https://www.apachefriends.org/download.html.
  $url='https://downloads.sourceforge.net/project/xampp/XAMPP%20Windows/8.2.12/xampp-windows-x64-8.2.12-0-VS16-installer.exe'
  Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile ($installer+'.part')
  if((Get-Item -LiteralPath ($installer+'.part')).Length -lt 100MB){throw 'XAMPP indirmesi tamamlanmadı.'}
  # Published by Apache Friends on the pinned version's download row (11 Oct 2026).
  if((Get-FileHash -LiteralPath ($installer+'.part') -Algorithm SHA1).Hash.ToLowerInvariant() -ne 'b6549ee720dff786e95c2fc596c2d5221e4ef72f') { throw 'XAMPP dosyası resmî indirmeyle eşleşmiyor; çalıştırılmadı.' }
  Move-Item -LiteralPath ($installer+'.part') -Destination $installer -Force
  # InstallBuilder unattended mode: vendor documentation, not a guessed component list.
  $job=Start-Process -FilePath $installer -ArgumentList @('--mode','unattended','--unattendedmodeui','none','--prefix',('"'+$managed+'"')) -WindowStyle Hidden -Wait -PassThru
  if($job.ExitCode -ne 0 -or !(ConfirmMariaDb $binary)){throw 'XAMPP otomatik kurulumu doğrulanamadı.'}
  Remove-Item -LiteralPath $installer
}
[Console]::WriteLine((Join-Path $managed 'mysql/bin'))
