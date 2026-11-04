$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
$scriptPath=Join-Path $project '.local/start-xampp-backend.cjs'
if(!(Test-Path -LiteralPath $scriptPath)){throw 'Geliştirme sunucusu hazırlanmadı.'}
try {
 $health=Invoke-RestMethod 'http://127.0.0.1:3000/health' -TimeoutSec 2
 if($health.status -eq 'ok' -and $health.database -eq 'mysql'){Write-Output 'Veniux sunucusu çalışıyor.';exit 0}
 throw '3000 portundaki sunucu hazır değil. Mevcut süreç değiştirilmedi.'
} catch {
 if($_.Exception.Message -like '*Mevcut süreç*'){throw}
}
$nodePath=(Get-Command node.exe).Source
Start-Process -FilePath $nodePath -ArgumentList ('"'+$scriptPath+'"') -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput (Join-Path $project '.local/desktop-backend.stdout.log') -RedirectStandardError (Join-Path $project '.local/desktop-backend.stderr.log')|Out-Null
for($attempt=0;$attempt -lt 20;$attempt++){
 Start-Sleep -Milliseconds 500
 try{$health=Invoke-RestMethod 'http://127.0.0.1:3000/health' -TimeoutSec 1;if($health.status -eq 'ok' -and $health.database -eq 'mysql'){Write-Output 'Veniux sunucusu hazır.';exit 0}}catch{}
}
throw 'Veniux sunucusu açılamadı. XAMPP MySQL çalışıyor mu kontrol edin. Ayrıntı .local/desktop-backend.stderr.log dosyasında.'
