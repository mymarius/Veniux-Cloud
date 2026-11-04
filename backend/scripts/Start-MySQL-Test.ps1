param([Parameter(Mandatory=$true)][string]$MySQLBaseDir)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$testRoot=Join-Path $projectRoot '.local/mysql-test'
$server=Join-Path ([IO.Path]::GetFullPath($MySQLBaseDir)) 'bin/mysqld.exe'
if(!(Test-Path -LiteralPath $server)){throw 'Resmi MySQL 8.4 bin/mysqld.exe yolu gerekli.'}
$probe=[Net.Sockets.TcpClient]::new()
try{$probe.Connect('127.0.0.1',33316);throw '33316 zaten kullanılıyor; mevcut sunucuya işlem yapılmadı.'}catch [Net.Sockets.SocketException]{}finally{$probe.Dispose()}
New-Item -ItemType Directory -Force -Path $testRoot,(Join-Path $testRoot 'app-data') | Out-Null
$data=Join-Path $testRoot 'data'
if(Test-Path -LiteralPath $data){throw 'Test veri klasörü zaten var. Mevcut test sunucusunu kullanın; bu komut veriyi silmez.'}
& $server --no-defaults --initialize-insecure "--basedir=$MySQLBaseDir" "--datadir=$data"
if($LASTEXITCODE -ne 0){throw 'Ayrı test MySQL başlangıcı başarısız.'}
$arguments=@('--no-defaults',('--basedir="'+$MySQLBaseDir+'"'),('--datadir="'+$data+'"'),'--bind-address=127.0.0.1','--port=33316','--mysqlx=OFF','--log-bin=veniux-test-bin','--log_bin_trust_function_creators=1','--console')
Start-Process -FilePath $server -ArgumentList $arguments -WindowStyle Hidden -RedirectStandardOutput (Join-Path $testRoot 'server.stdout.log') -RedirectStandardError (Join-Path $testRoot 'server.stderr.log') | Out-Null
# Bootstrap retries only the dedicated loopback port. Credentials never print.
$success=$false
for($attempt=0;$attempt -lt 20;$attempt++){
 & node (Join-Path $PSScriptRoot 'mysql_test_bootstrap.js')
 if($LASTEXITCODE -eq 0){$success=$true;break}
 Start-Sleep -Milliseconds 500
}
if(!$success){throw 'Test hesabı hazırlanamadı. Yalnız test sunucusunun hata kaydını kontrol edin.'}
& node (Join-Path $PSScriptRoot 'mysql_test_migrate.js')
if($LASTEXITCODE -ne 0){throw 'Test migration başarısız; operasyonlar kapalı.'}
Write-Output 'Ayrı MySQL test ortamı hazır: 127.0.0.1:33316. Üretim verisi kullanılmadı.'
