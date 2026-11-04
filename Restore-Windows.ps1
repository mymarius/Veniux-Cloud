#requires -Version 7.0
param([Parameter(Mandatory)][string]$SnapshotDirectory,[string]$DataDirectory = (Join-Path $env:LOCALAPPDATA 'Veniux/data'),[switch]$RepairInterrupted)
$ErrorActionPreference = 'Stop'
$DataDirectory = [IO.Path]::GetFullPath($DataDirectory)
& (Join-Path $PSScriptRoot 'Stop-Production.ps1') -DataDirectory $DataDirectory
Write-Host 'Mevcut veriler değişecek. Yedekten sonra yapılan işlemler geri yüklenen durumda bulunmayacak.'
$Confirmation = Read-Host 'Onaylamak için VERİLERİ GERİ YÜKLE yazın'
$Command = if ($RepairInterrupted) { 'repair' } else { 'restore' }
& node (Join-Path $PSScriptRoot 'backend/scripts/manageDeployment.js') $Command --data-dir $DataDirectory --snapshot ([IO.Path]::GetFullPath($SnapshotDirectory)) --confirm $Confirmation
if ($LASTEXITCODE) { throw 'Geri yükleme tamamlanmadı. Önceki veriler ve güvenlik yedeği korunur; uygulamayı başlatmayın.' }
Write-Host 'Geri yükleme tamamlandı. Uyumlu sürümde Update-Windows.ps1 çalıştırıp sağlık kontrolünü doğrulayın.'
