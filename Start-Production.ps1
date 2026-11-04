#requires -Version 7.0
param([string]$DataDirectory = (Join-Path $env:LOCALAPPDATA 'Veniux/data'))
$ErrorActionPreference = 'Stop'
$DataDirectory = [IO.Path]::GetFullPath($DataDirectory)
& node (Join-Path $PSScriptRoot 'backend/scripts/manageDeployment.js') check --data-dir $DataDirectory
if ($LASTEXITCODE) { throw 'API başlatılmadı. Kurulum veya güncellemeyi tamamlayın.' }
# Run in this terminal so startup errors remain visible. Keep it open while using the application.
& node (Join-Path $PSScriptRoot 'backend/scripts/startProduction.js') --data-dir $DataDirectory
if ($LASTEXITCODE) { throw 'API başlatılamadı; yukarıdaki açıklamayı kontrol edin.' }
