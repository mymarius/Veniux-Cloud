$ErrorActionPreference = 'Stop'
$env:VENIUX_UPDATE_URL = 'http://127.0.0.1:3000/api/updates/'
Push-Location $PSScriptRoot
try {
    npm run dist
    if ($LASTEXITCODE -ne 0) { throw 'Masaüstü paketlemesi başarısız.' }
} finally { Pop-Location }
