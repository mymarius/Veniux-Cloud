#requires -Version 7.0
param([string]$OutputDirectory = (Join-Path $PSScriptRoot 'artifacts/releases'))
$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot 'frontend')
try { & npm run build; if ($LASTEXITCODE) { throw 'Arayüz derlenemedi; paket hazırlanmadı.' } } finally { Pop-Location }
$Version = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'backend/package.json') -Raw | ConvertFrom-Json).version
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$ReleaseDirectory = Join-Path $OutputDirectory "veniux-$Version-security-dependencies-20261008-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path (Join-Path $ReleaseDirectory 'backend/scripts'), (Join-Path $ReleaseDirectory 'frontend') -Force | Out-Null
foreach ($Name in @('src','assets','package.json','package-lock.json','.env.example')) {
 $Source = Join-Path $PSScriptRoot "backend/$Name"
 if (Test-Path -LiteralPath $Source) { Copy-Item -LiteralPath $Source -Destination (Join-Path $ReleaseDirectory 'backend') -Recurse }
}
foreach ($Name in @('manageDeployment.js','startProduction.js')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot "backend/scripts/$Name") -Destination (Join-Path $ReleaseDirectory 'backend/scripts') }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'frontend/dist') -Destination (Join-Path $ReleaseDirectory 'frontend') -Recurse
New-Item -ItemType Directory -Path (Join-Path $ReleaseDirectory 'shared') -Force | Out-Null
Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'shared') -Filter '*.mjs' -File | Where-Object { $_.Name -notlike '*.test.mjs' } | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $ReleaseDirectory 'shared') }
New-Item -ItemType Directory -Path (Join-Path $ReleaseDirectory 'scanner-bridge') -Force | Out-Null
foreach ($Name in @('server.cjs','package.json','package-lock.json')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot "scanner-bridge/$Name") -Destination (Join-Path $ReleaseDirectory 'scanner-bridge') }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Start-ScannerBridge.ps1') -Destination $ReleaseDirectory

foreach ($Name in @('Install-Windows.ps1','Start-Production.ps1','Stop-Production.ps1','Update-Windows.ps1','Restore-Windows.ps1','Adopt-Legacy-Windows.ps1')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $Name) -Destination $ReleaseDirectory }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'docs/WINDOWS-DEPLOYMENT.md') -Destination $ReleaseDirectory
New-Item -ItemType Directory -Path (Join-Path $ReleaseDirectory 'docs') -Force | Out-Null
foreach ($Name in @('WINDOWS-DEPLOYMENT.md','DEPLOYMENT-VERIFICATION.md','PROJECT-CLOSURE-REPORT.md','RELEASE-NOTES-2026-10-08.md','WINDOWS-SECURITY-RELEASE-VERIFICATION.md','DEPENDENCY-SECURITY-REVIEW.md')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot "docs/$Name") -Destination (Join-Path $ReleaseDirectory 'docs') }
$MigrationFiles = Get-ChildItem -LiteralPath (Join-Path $ReleaseDirectory 'backend/src/database/migrations') -File | Sort-Object Name
$Manifest = @{ version = $Version; build_id = [IO.Path]::GetFileName($ReleaseDirectory); security_revision = '2026-10-08'; dependency_revision = '2026-10-08'; general_release_ready = $false; node_major = 24; created_at = [DateTime]::UtcNow.ToString('o'); migrations = @($MigrationFiles | ForEach-Object { @{ version = $_.Name; sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() } }) }
$Manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $ReleaseDirectory 'release.json') -Encoding utf8
$Archive = "$ReleaseDirectory.zip"
& node (Join-Path $PSScriptRoot 'desktop/distribution-safety.cjs') $ReleaseDirectory
if ($LASTEXITCODE) { throw 'Paket güvenlik denetimi başarısız; arşiv oluşturulmadı.' }
Compress-Archive -LiteralPath $ReleaseDirectory -DestinationPath $Archive
$Hash = (Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash
"$Hash  $([IO.Path]::GetFileName($Archive))" | Set-Content -LiteralPath "$Archive.sha256" -Encoding utf8
Write-Host "Kurulum paketi: $Archive"
