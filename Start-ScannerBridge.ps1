#requires -Version 7.0
param([string]$DataDirectory = (Join-Path $env:LOCALAPPDATA 'Veniux/data'))
$ErrorActionPreference='Stop'
$bridgeDirectory=Join-Path $PSScriptRoot 'scanner-bridge'
$runtimeDirectory=Join-Path $PSScriptRoot '.local'
$PairingFile = Join-Path $bridgeDirectory 'pairing.json'
if (Test-Path -LiteralPath (Join-Path $DataDirectory 'install.env')) { $runtimeDirectory = Join-Path $DataDirectory 'storage/scanner-bridge'; $PairingFile = Join-Path $runtimeDirectory 'pairing.json'; $env:SCANNER_PAIRING_FILE = $PairingFile }
function Test-ScannerBridge {
    try {
        $pairing=Get-Content -LiteralPath $PairingFile -Raw | ConvertFrom-Json
        $response=Invoke-WebRequest 'http://127.0.0.1:17841/ports' -Headers @{Origin=$pairing.origins[0];Authorization=('Bearer '+$pairing.token)} -TimeoutSec 2
        return $response.StatusCode -eq 200
    } catch { return $false }
}
if(Test-ScannerBridge){Write-Output 'Yerel barkod bağlantısı zaten hazır.';return}
New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
if(!(Test-Path (Join-Path $bridgeDirectory 'node_modules/serialport'))){throw 'scanner-bridge klasöründe önce npm ci çalıştırın.'}
$bridgeProcess=Start-Process -FilePath (Get-Command node).Source -ArgumentList 'server.cjs' -WorkingDirectory $bridgeDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDirectory 'scanner-bridge.log') -RedirectStandardError (Join-Path $runtimeDirectory 'scanner-bridge-error.log')
Set-Content (Join-Path $runtimeDirectory 'scanner-bridge.pid') $bridgeProcess.Id
for($attempt=0;$attempt -lt 15;$attempt++){Start-Sleep -Milliseconds 500;if(Test-ScannerBridge){Write-Output 'Yerel barkod bağlantısı hazır. Ayarlardan bağlantı anahtarını ve portu seçin.';return};if($bridgeProcess.HasExited){throw 'Yerel bağlantı açılamadı. .local/scanner-bridge-error.log dosyasını inceleyin.'}}
throw 'Yerel bağlantı henüz yanıt vermiyor.'
