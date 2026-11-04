$ErrorActionPreference = 'Stop'
$projectDirectory = $PSScriptRoot
$backendDirectory = Join-Path $projectDirectory 'backend'
$runtimeDirectory = Join-Path $projectDirectory '.local'
$healthUrl = 'http://127.0.0.1:3000/health'
function Start-Frontend {
    try {
        $siteResponse = Invoke-WebRequest 'http://127.0.0.1:5173/' -TimeoutSec 2
        if ($siteResponse.StatusCode -eq 200) { return }
    } catch {}
    $viteEntry = Join-Path $projectDirectory 'frontend/node_modules/vite/bin/vite.js'
    if (!(Test-Path -LiteralPath $viteEntry)) { throw 'Önce frontend klasöründe npm ci çalıştırın.' }
    New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
    $nodeExecutable = (Get-Command node -ErrorAction Stop).Source
    $siteProcess = Start-Process -FilePath $nodeExecutable -ArgumentList 'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort' -WorkingDirectory (Join-Path $projectDirectory 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDirectory 'site.log') -RedirectStandardError (Join-Path $runtimeDirectory 'site-error.log')
    Set-Content -LiteralPath (Join-Path $runtimeDirectory 'site.pid') -Value $siteProcess.Id
    for ($siteAttempt = 0; $siteAttempt -lt 15; $siteAttempt++) {
        Start-Sleep -Milliseconds 500
        if ($siteProcess.HasExited) { throw 'Site başlatılamadı. .local/site-error.log dosyasını kontrol edin.' }
        try {
            if ((Invoke-WebRequest 'http://127.0.0.1:5173/' -TimeoutSec 2).StatusCode -eq 200) { return }
        } catch {}
    }
    throw 'Site henüz yanıt vermiyor. .local/site-error.log dosyasını kontrol edin.'
}
Start-Frontend
try {
    $health = Invoke-RestMethod $healthUrl -TimeoutSec 2
    if ($health.status -eq 'ok') {
        Write-Output 'API zaten çalışıyor: http://127.0.0.1:3000'
        return
    }
} catch {}
if (!(Test-Path (Join-Path $backendDirectory 'node_modules/express'))) {
    throw 'Önce backend klasöründe npm ci çalıştırın.'
}
if (!(Test-Path (Join-Path $projectDirectory 'frontend/dist/index.html'))) {
    throw 'Önce frontend klasöründe npm ci ve npm run build çalıştırın.'
}
New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
$nodeExecutable = (Get-Command node -ErrorAction Stop).Source
$apiProcess = Start-Process -FilePath $nodeExecutable -ArgumentList '--env-file-if-exists=.env','scripts/startLocal.js' -WorkingDirectory $backendDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDirectory 'api.log') -RedirectStandardError (Join-Path $runtimeDirectory 'api-error.log')
Set-Content -LiteralPath (Join-Path $runtimeDirectory 'api.pid') -Value $apiProcess.Id
for ($attempt = 0; $attempt -lt 15; $attempt++) {
    Start-Sleep -Milliseconds 500
    if ($apiProcess.HasExited) { throw 'API başlatılamadı. .local/api-error.log dosyasını kontrol edin.' }
    try {
        $health = Invoke-RestMethod $healthUrl -TimeoutSec 2
        if ($health.status -eq 'ok') {
            Write-Output 'API ve panel hazır: http://127.0.0.1:3000'
            return
        }
    } catch {}
}
throw 'API henüz yanıt vermiyor. .local/api-error.log dosyasını kontrol edin.'
