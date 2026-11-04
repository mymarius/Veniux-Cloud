param([Parameter(Mandatory=$true)][string]$OutputPath)
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$out=[IO.Path]::GetFullPath($OutputPath)
if(-not $out.StartsWith((Join-Path $root '.local/hardware-lab-runs')+[IO.Path]::DirectorySeparatorChar)){throw 'Probe output outside laboratory'}
$sdkRoots=@((Join-Path $root '.local/android-sdk'),(Join-Path $env:LOCALAPPDATA 'Android/Sdk'),$env:ANDROID_HOME,$env:ANDROID_SDK_ROOT) | Where-Object {$_} | Select-Object -Unique
$emulators=@();$adb=@()
foreach($sdk in $sdkRoots){foreach($file in @('emulator/emulator.exe','platform-tools/adb.exe')){$candidate=Join-Path $sdk $file;if(Test-Path -LiteralPath $candidate){if($file -like 'emulator*'){$emulators+=$candidate}else{$adb+=$candidate}}}}
foreach($name in @('emulator','adb')){$command=Get-Command $name -ErrorAction SilentlyContinue;if($command){if($name -eq 'emulator'){$emulators+=$command.Source}else{$adb+=$command.Source}}}
$installer=Join-Path $root '.local/desktop-installer-2.4.38/Veniux-Setup-2.4.38.exe'
$signature=if(Test-Path -LiteralPath $installer){[string](Get-AuthenticodeSignature -LiteralPath $installer).Status}else{'Missing'}
@{checked_at=(Get-Date).ToString('o');sdk_roots_checked=@($sdkRoots);emulator_paths=@($emulators);adb_paths=@($adb);windows_sandbox_executable=(Test-Path -LiteralPath (Join-Path $env:WINDIR 'System32/WindowsSandbox.exe'));virtual_machine_tools=@(foreach($name in @('VBoxManage','vmrun','Get-VM')){if(Get-Command $name -ErrorAction SilentlyContinue){$name}});windows_installer_signature=$signature;installer_executed=$false;physical_device_tested=$false} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $out -Encoding UTF8
