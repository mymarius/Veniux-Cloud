$ErrorActionPreference='Stop'
$projectRoot=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$sdkRoot=Join-Path $projectRoot '.local/android-sdk'
$toolsRoot=Join-Path $sdkRoot 'build-tools/android-15'
$platformJar=Join-Path $sdkRoot 'platform/android-35/android.jar'
$javaRoot='C:/Program Files/Java/jdk-17'
$androidManifest=[xml](Get-Content -Raw -LiteralPath "$PSScriptRoot/AndroidManifest.xml")
$releaseVersion=$androidManifest.manifest.GetAttribute('versionName','http://schemas.android.com/apk/res/android')
$releaseCode=[int]$androidManifest.manifest.GetAttribute('versionCode','http://schemas.android.com/apk/res/android')
$outputRoot=Join-Path $projectRoot ('.local/android-build-'+$releaseVersion)
$signingRoot=Join-Path $projectRoot '.local/android-signing'
foreach($name in @('classes','generated','dex','assets')){
 $generatedPath=[System.IO.Path]::GetFullPath((Join-Path $outputRoot $name))
 if((Split-Path $generatedPath -Parent) -ne [System.IO.Path]::GetFullPath($outputRoot)){throw 'Generated path outside build directory'}
 if(Test-Path -LiteralPath $generatedPath){Remove-Item -LiteralPath $generatedPath -Recurse -Force}
}
New-Item -ItemType Directory -Force -Path "$outputRoot/res/drawable","$outputRoot/classes","$outputRoot/dex","$outputRoot/generated","$outputRoot/assets/ui",$signingRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'frontend/public/veniux-logo.png') -Destination "$outputRoot/res/drawable/logo.png"
Copy-Item -Path (Join-Path $projectRoot 'frontend/dist/*') -Destination "$outputRoot/assets/ui" -Recurse -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'mobile-boot.js') -Destination "$outputRoot/assets/ui/mobile-boot.js"
$html=Get-Content -Raw -LiteralPath "$outputRoot/assets/ui/index.html"
$html=$html.Replace('<head>','<head><base href="/"><script src="./mobile-boot.js"></script>')
$html=$html.Replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="default-src &apos;self&apos;; script-src &apos;self&apos;; style-src &apos;self&apos; &apos;unsafe-inline&apos;; img-src &apos;self&apos; data: blob:; font-src &apos;self&apos; data:; media-src &apos;self&apos; blob: data:; connect-src &apos;self&apos; blob: data:; frame-src &apos;none&apos;; object-src &apos;none&apos;; base-uri &apos;self&apos;">')
Copy-Item -LiteralPath "$PSScriptRoot/ZXING-LICENSE.txt" -Destination "$outputRoot/assets/ui/ZXING-LICENSE.txt"
Copy-Item -LiteralPath "$PSScriptRoot/ZXING-NOTICE.txt" -Destination "$outputRoot/assets/ui/ZXING-NOTICE.txt"
Set-Content -LiteralPath "$outputRoot/assets/ui/index.html" -Value $html -Encoding utf8NoBOM
Copy-Item -LiteralPath (Join-Path $projectRoot 'frontend/src/assets/hostimux-sponsor.png') -Destination "$outputRoot/res/drawable/hostimux.png"
Copy-Item -LiteralPath (Join-Path $projectRoot 'website-php/assets/manrope-v1.ttf') -Destination "$outputRoot/assets/Manrope.ttf"
function Run-Checked([string]$Program,[string[]]$Arguments){ & $Program @Arguments; if($LASTEXITCODE -ne 0){throw "Build step failed: $Program"} }
Run-Checked "$toolsRoot/aapt2.exe" @('compile','--dir',"$outputRoot/res",'-o',"$outputRoot/resources.zip")
Run-Checked "$toolsRoot/aapt2.exe" @('link','-o',"$outputRoot/resources.apk",'-I',$platformJar,'--manifest',"$PSScriptRoot/AndroidManifest.xml",'--java',"$outputRoot/generated",'--min-sdk-version','26','--target-sdk-version','35',"$outputRoot/resources.zip")
$sources=@(Get-ChildItem "$PSScriptRoot/src","$outputRoot/generated" -Recurse -Filter '*.java' | ForEach-Object FullName)
Run-Checked "$javaRoot/bin/javac.exe" (@('-encoding','UTF-8','-source','8','-target','8','-bootclasspath',"$platformJar;$toolsRoot/core-lambda-stubs.jar",'-classpath',"$PSScriptRoot/libs/zxing-core-3.5.3.jar",'-d',"$outputRoot/classes")+$sources)
Run-Checked "$javaRoot/bin/jar.exe" @('cf',"$outputRoot/classes.jar",'-C',"$outputRoot/classes",'.')
$env:JAVA_HOME=$javaRoot
Run-Checked "$toolsRoot/d8.bat" @('--lib',$platformJar,'--min-api','26','--output',"$outputRoot/dex", "$outputRoot/classes.jar", "$PSScriptRoot/libs/zxing-core-3.5.3.jar")
Add-Type -AssemblyName System.IO.Compression
Copy-Item -LiteralPath "$outputRoot/resources.apk" -Destination "$outputRoot/unsigned.apk" -Force
$apk=[System.IO.Compression.ZipFile]::Open("$outputRoot/unsigned.apk",[System.IO.Compression.ZipArchiveMode]::Update)
try {
 [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($apk,"$outputRoot/dex/classes.dex",'classes.dex') | Out-Null
 Get-ChildItem "$outputRoot/assets" -File -Recurse | ForEach-Object { $entryName='assets/'+[System.IO.Path]::GetRelativePath("$outputRoot/assets",$_.FullName).Replace('\','/'); [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($apk,$_.FullName,$entryName) | Out-Null }
}finally{$apk.Dispose()}
Run-Checked "$toolsRoot/zipalign.exe" @('-f','4',"$outputRoot/unsigned.apk","$outputRoot/aligned.apk")
$secretFile=Join-Path $signingRoot 'signing.json'
if(!(Test-Path -LiteralPath $secretFile)){ $password=[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32));@{password=$password}|ConvertTo-Json|Set-Content -LiteralPath $secretFile -Encoding utf8NoBOM }
$env:VNX_APK_PASSWORD=(Get-Content -Raw -LiteralPath $secretFile|ConvertFrom-Json).password
& icacls.exe $signingRoot /inheritance:r /grant:r ('{0}\{1}:(OI)(CI)F' -f $env:USERDOMAIN,$env:USERNAME) | Out-Null
$keyFile=Join-Path $signingRoot 'veniux-release.jks'
if(!(Test-Path -LiteralPath $keyFile)){Run-Checked "$javaRoot/bin/keytool.exe" @('-genkeypair','-keystore',$keyFile,'-alias','veniux','-keyalg','RSA','-keysize','3072','-validity','3650','-dname','CN=Veniux, OU=Mobile, O=Veniux, C=TR','-storepass:env','VNX_APK_PASSWORD','-keypass:env','VNX_APK_PASSWORD')}
$releaseFile=Join-Path $outputRoot ('Veniux-Android-'+$releaseVersion+'.apk')
Run-Checked "$toolsRoot/apksigner.bat" @('sign','--ks',$keyFile,'--ks-key-alias','veniux','--ks-pass','env:VNX_APK_PASSWORD','--key-pass','env:VNX_APK_PASSWORD','--out',$releaseFile,"$outputRoot/aligned.apk")
Run-Checked "$toolsRoot/apksigner.bat" @('verify','--verbose','--print-certs',$releaseFile)
Remove-Item Env:VNX_APK_PASSWORD
Get-Item -LiteralPath $releaseFile | Select-Object Name,Length


$releaseInfo=@{version=$releaseVersion;versionCode=$releaseCode;filename=(Split-Path $releaseFile -Leaf);bytes=(Get-Item $releaseFile).Length;sha256=(Get-FileHash $releaseFile -Algorithm SHA256).Hash.ToLowerInvariant()}
$releaseInfo|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $outputRoot 'android.json') -Encoding utf8NoBOM
