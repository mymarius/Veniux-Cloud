$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$AndroidDir=Join-Path $projectRoot 'mobile/android'
$sdkRoot=Join-Path $projectRoot '.local/android-sdk'
$toolsRoot=Join-Path $sdkRoot 'build-tools/android-15'
$platformJar=Join-Path $sdkRoot 'platform/android-35/android.jar'
$javaRoot='C:/Program Files/Java/jdk-17'
$androidManifest=[xml](Get-Content -Raw -Encoding UTF8 -LiteralPath "$AndroidDir/AndroidManifest.xml")
$releaseVersion=$androidManifest.manifest.GetAttribute('versionName','http://schemas.android.com/apk/res/android')
$releaseCode=[int]$androidManifest.manifest.GetAttribute('versionCode','http://schemas.android.com/apk/res/android')
$outputRoot=Join-Path $projectRoot ('.local/android-build-'+$releaseVersion)
# Firebase (uygulama kapalıyken bildirim): .local/firebase/bundle ve firebase-config.json varsa derlemeye eklenir; yoksa derleme eskisi gibidir.
$fbBundle=Join-Path $projectRoot '.local/firebase/bundle'
$fbConfigFile=Join-Path $projectRoot '.local/firebase/firebase-config.json'
$useFirebase=(Test-Path -LiteralPath "$fbBundle/jars") -and (Test-Path -LiteralPath $fbConfigFile)
Write-Host ('Firebase: '+$(if($useFirebase){'AÇIK'}else{'kapalı (paket veya yapılandırma yok)'}))
$signingRoot=Join-Path $projectRoot '.local/android-signing'
foreach($name in @('classes','generated','dex','assets')){
 $generatedPath=[System.IO.Path]::GetFullPath((Join-Path $outputRoot $name))
 if((Split-Path $generatedPath -Parent) -ne [System.IO.Path]::GetFullPath($outputRoot)){throw 'Generated path outside build directory'}
 if(Test-Path -LiteralPath $generatedPath){Remove-Item -LiteralPath $generatedPath -Recurse -Force}
}
New-Item -ItemType Directory -Force -Path "$outputRoot/res/drawable","$outputRoot/classes","$outputRoot/dex","$outputRoot/generated","$outputRoot/assets/ui",$signingRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'frontend/public/veniux-logo.png') -Destination "$outputRoot/res/drawable/logo.png"
Copy-Item -Path (Join-Path $projectRoot 'frontend/dist/*') -Destination "$outputRoot/assets/ui" -Recurse -Force
Copy-Item -LiteralPath (Join-Path $AndroidDir 'mobile-boot.js') -Destination "$outputRoot/assets/ui/mobile-boot.js"
$html=Get-Content -Raw -Encoding UTF8 -LiteralPath "$outputRoot/assets/ui/index.html"
$html=$html.Replace('<head>','<head><base href="/"><script src="./mobile-boot.js"></script>')
$html=$html.Replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="default-src &apos;self&apos;; script-src &apos;self&apos;; style-src &apos;self&apos; &apos;unsafe-inline&apos;; img-src &apos;self&apos; data: blob:; font-src &apos;self&apos; data:; media-src &apos;self&apos; blob: data:; connect-src &apos;self&apos; blob: data:; frame-src &apos;none&apos;; object-src &apos;none&apos;; base-uri &apos;self&apos;">')
Copy-Item -LiteralPath "$AndroidDir/ZXING-LICENSE.txt" -Destination "$outputRoot/assets/ui/ZXING-LICENSE.txt"
Copy-Item -LiteralPath "$AndroidDir/ZXING-NOTICE.txt" -Destination "$outputRoot/assets/ui/ZXING-NOTICE.txt"
[IO.File]::WriteAllText([IO.Path]::GetFullPath("$outputRoot/assets/ui/index.html"),$html,(New-Object Text.UTF8Encoding($false)))
Copy-Item -LiteralPath (Join-Path $projectRoot 'frontend/src/assets/hostimux-sponsor.png') -Destination "$outputRoot/res/drawable/hostimux.png"
Copy-Item -LiteralPath (Join-Path $projectRoot 'website-php/assets/manrope-v1.ttf') -Destination "$outputRoot/assets/Manrope.ttf"
function Run-Checked([string]$Program,[string[]]$Arguments){ & $Program @Arguments; if($LASTEXITCODE -ne 0){throw "Build step failed: $Program"} }
Run-Checked "$toolsRoot/aapt2.exe" @('compile','--dir',"$outputRoot/res",'-o',"$outputRoot/resources.zip")
$manifestPath="$AndroidDir/AndroidManifest.xml";$linkExtra=@();$fbJars=@();$fbSources=@()
if($useFirebase){
 $manifestPath="$outputRoot/merged-manifest.xml"
 Run-Checked 'python' @((Join-Path $projectRoot 'tools/release/firebase-bundle.py'),'merge',"$AndroidDir/AndroidManifest.xml",$manifestPath)
 $linkExtra=@('--auto-add-overlay','--non-final-ids','--extra-packages',((Get-Content -Raw -LiteralPath "$fbBundle/extra-packages.txt").Trim()))+@(Get-ChildItem "$fbBundle/compiled" -Filter '*.zip' | ForEach-Object FullName)
 $fbJars=@(Get-ChildItem "$fbBundle/jars" -Filter '*.jar' | ForEach-Object FullName)
 $fb=Get-Content -Raw -LiteralPath $fbConfigFile | ConvertFrom-Json
 New-Item -ItemType Directory -Force -Path "$outputRoot/generated-fb/com/veniux/companion" | Out-Null
 $cfg="package com.veniux.companion;`nfinal class FirebaseConfig{static final String APP_ID=`"$($fb.app_id)`";static final String API_KEY=`"$($fb.api_key)`";static final String PROJECT_ID=`"$($fb.project_id)`";static final String SENDER_ID=`"$($fb.sender_id)`";}`n"
 [IO.File]::WriteAllText([IO.Path]::GetFullPath("$outputRoot/generated-fb/com/veniux/companion/FirebaseConfig.java"),$cfg,(New-Object Text.UTF8Encoding($false)))
 $fbSources=@(Get-ChildItem "$AndroidDir/firebase-src","$outputRoot/generated-fb" -Recurse -Filter '*.java' | ForEach-Object FullName)
}
Run-Checked "$toolsRoot/aapt2.exe" (@('link','-o',"$outputRoot/resources.apk",'-I',$platformJar,'--manifest',$manifestPath,'--java',"$outputRoot/generated",'--min-sdk-version','26','--target-sdk-version','35')+$linkExtra+@("$outputRoot/resources.zip"))
$sources=@(Get-ChildItem "$AndroidDir/src","$outputRoot/generated" -Recurse -Filter '*.java' | ForEach-Object FullName)+$fbSources
$classpath=(@("$AndroidDir/libs/zxing-core-3.5.3.jar")+$fbJars) -join ';'
Run-Checked "$javaRoot/bin/javac.exe" (@('-encoding','UTF-8','-source','8','-target','8','-bootclasspath',"$platformJar;$toolsRoot/core-lambda-stubs.jar",'-classpath',$classpath,'-d',"$outputRoot/classes")+$sources)
Run-Checked "$javaRoot/bin/jar.exe" @('cf',"$outputRoot/classes.jar",'-C',"$outputRoot/classes",'.')
$env:JAVA_HOME=$javaRoot
Run-Checked "$toolsRoot/d8.bat" (@('--lib',$platformJar,'--min-api','26','--output',"$outputRoot/dex","$outputRoot/classes.jar","$AndroidDir/libs/zxing-core-3.5.3.jar")+$fbJars)
Add-Type -AssemblyName System.IO.Compression;Add-Type -AssemblyName System.IO.Compression.FileSystem
Copy-Item -LiteralPath "$outputRoot/resources.apk" -Destination "$outputRoot/unsigned.apk" -Force
$apk=[System.IO.Compression.ZipFile]::Open([IO.Path]::GetFullPath("$outputRoot/unsigned.apk"),[System.IO.Compression.ZipArchiveMode]::Update)
try {
 Get-ChildItem "$outputRoot/dex" -Filter 'classes*.dex' | ForEach-Object { [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($apk,$_.FullName,$_.Name) | Out-Null }
 Get-ChildItem "$outputRoot/assets" -File -Recurse | ForEach-Object { $base=[IO.Path]::GetFullPath("$outputRoot/assets").TrimEnd('\')+'\';$entryName='assets/'+$_.FullName.Substring($base.Length).Replace('\','/'); [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($apk,$_.FullName,$entryName) | Out-Null }
}finally{$apk.Dispose()}
Run-Checked "$toolsRoot/zipalign.exe" @('-f','4',"$outputRoot/unsigned.apk","$outputRoot/aligned.apk")
$secretFile=Join-Path $signingRoot 'signing.json'
if(!(Test-Path -LiteralPath $secretFile)){throw 'Imza dosyasi yok'; $password=[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32));@{password=$password}|ConvertTo-Json|Set-Content -LiteralPath $secretFile -Encoding utf8NoBOM }
$env:VNX_APK_PASSWORD=(Get-Content -Raw -LiteralPath $secretFile|ConvertFrom-Json).password
$keyFile=Join-Path $signingRoot 'veniux-release.jks'
if(!(Test-Path -LiteralPath $keyFile)){throw 'Anahtar yok';Run-Checked "$javaRoot/bin/keytool.exe" @('-genkeypair','-keystore',$keyFile,'-alias','veniux','-keyalg','RSA','-keysize','3072','-validity','3650','-dname','CN=Veniux, OU=Mobile, O=Veniux, C=TR','-storepass:env','VNX_APK_PASSWORD','-keypass:env','VNX_APK_PASSWORD')}
$releaseFile=Join-Path $outputRoot ('Veniux-Android-'+$releaseVersion+'.apk')
Run-Checked "$toolsRoot/apksigner.bat" @('sign','--ks',$keyFile,'--ks-key-alias','veniux','--ks-pass','env:VNX_APK_PASSWORD','--key-pass','env:VNX_APK_PASSWORD','--out',$releaseFile,"$outputRoot/aligned.apk")
Run-Checked "$toolsRoot/apksigner.bat" @('verify','--verbose','--print-certs',$releaseFile)
Remove-Item Env:VNX_APK_PASSWORD
Get-Item -LiteralPath $releaseFile | Select-Object Name,Length


$releaseInfo=@{version=$releaseVersion;versionCode=$releaseCode;filename=(Split-Path $releaseFile -Leaf);bytes=(Get-Item $releaseFile).Length;sha256=(Get-FileHash $releaseFile -Algorithm SHA256).Hash.ToLowerInvariant()}
[IO.File]::WriteAllText([IO.Path]::GetFullPath((Join-Path $outputRoot 'android.json')),($releaseInfo|ConvertTo-Json),(New-Object Text.UTF8Encoding($false)))
