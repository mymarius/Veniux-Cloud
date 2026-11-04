#requires -Version 7.0
param([string]$DataDirectory = (Join-Path $env:LOCALAPPDATA 'Veniux/data'))
$ErrorActionPreference = 'Stop'
& node (Join-Path $PSScriptRoot 'backend/scripts/manageDeployment.js') stop --data-dir ([IO.Path]::GetFullPath($DataDirectory))
if ($LASTEXITCODE) { throw 'Sunucu durdurulamadı. Güncelleme başlatmayın.' }
