$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$project=Split-Path $PSScriptRoot -Parent
$settingsDirectory=Join-Path $project '.local'
$settingsFile=Join-Path $settingsDirectory 'desktop-connection.json'
$form=New-Object Windows.Forms.Form
$form.Text='Veniux · Kurulum ve bağlantı asistanı'
$form.Size=New-Object Drawing.Size(660,550)
$form.MinimumSize=$form.Size
$form.StartPosition='CenterScreen'
$form.BackColor=[Drawing.Color]::FromArgb(245,247,251)
$form.Font=New-Object Drawing.Font('Segoe UI',10)
function LabelAt($text,$x,$y,$width,$height) {
 $label=New-Object Windows.Forms.Label
 $label.Text=$text; $label.Location=New-Object Drawing.Point($x,$y)
 $label.Size=New-Object Drawing.Size($width,$height); $form.Controls.Add($label)
 return $label
}
$heading=LabelAt 'Veniux çalışma alanınızı hazırlayın' 28 24 590 38
$heading.Font=New-Object Drawing.Font('Segoe UI',19,[Drawing.FontStyle]::Bold)
$null=LabelAt 'Bu asistan geliştirme sürümünü hazırlar. Mevcut veritabanını değiştirmez.' 30 76 585 45
$null=LabelAt '1  ·  Uygulama dosyaları' 30 126 580 24
$runtimeStatus=LabelAt '' 30 157 585 45
$null=LabelAt '2  ·  Veniux sunucu adresi' 30 214 580 24
$api=New-Object Windows.Forms.TextBox
$api.Location=New-Object Drawing.Point(30,246); $api.Size=New-Object Drawing.Size(580,30)
$api.Text='http://127.0.0.1:3000/api'
if(Test-Path -LiteralPath $settingsFile){try{$api.Text=(Get-Content -LiteralPath $settingsFile -Raw|ConvertFrom-Json).apiBase}catch{}}
$form.Controls.Add($api)
$null=LabelAt 'XAMPP MySQL adresi buraya yazılmaz. Burada Veniux API sunucusu seçilir.' 30 280 585 40
$connectionStatus=LabelAt 'Bağlantı henüz kontrol edilmedi.' 30 323 585 58
function ButtonAt($text,$x,$y,$width) {
 $button=New-Object Windows.Forms.Button
 $button.Text=$text; $button.Location=New-Object Drawing.Point($x,$y)
 $button.Size=New-Object Drawing.Size($width,40); $form.Controls.Add($button)
 return $button
}
$prepare=ButtonAt 'Ekranı hazırla' 30 393 175
$check=ButtonAt 'Bağlantıyı kontrol et' 215 393 185
$launch=ButtonAt 'Kaydet ve Veniux u aç' 410 393 200
$hint=LabelAt 'Sonraki açılışlarda ana klasördeki Veniux-Baslat.cmd dosyasına çift tıklayın.' 30 452 590 45
function RefreshRuntime {
 $script:runtimeReady=(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules/electron/dist/electron.exe')) -and (Test-Path -LiteralPath (Join-Path $project 'frontend/dist/index.html'))
 $runtimeStatus.Text=if($script:runtimeReady){'Electron ve uygulama ekranı hazır.'}else{'Electron veya derlenmiş ekran eksik. Ekranı hazırla düğmesini kullanın.'}
 $launch.Enabled=$script:runtimeReady
}
function GetValidatedApi {
 $uri=$null
 if(![Uri]::TryCreate($api.Text.Trim(),[UriKind]::Absolute,[ref]$uri)){throw 'Geçerli bir sunucu adresi girin.'}
 if($uri.UserInfo -or $uri.Query -or $uri.Fragment -or ($uri.Scheme -ne 'https' -and !($uri.Scheme -eq 'http' -and $uri.IsLoopback))){throw 'Uzak sunucu HTTPS olmalı. Adrese şifre veya token eklemeyin.'}
 return $uri
}
$check.Add_Click({
 $check.Enabled=$false; $connectionStatus.Text='Sunucu kontrol ediliyor…'; $form.Refresh()
 try{
  $uri=GetValidatedApi
  $health=$uri.GetLeftPart([UriPartial]::Authority)+'/health'
  $response=Invoke-RestMethod -Uri $health -TimeoutSec 5
  if($response.status -ne 'ok'){throw 'Sunucu hazır değil; şema ve bağlantı doğrulanmalı.'}
  $connectionStatus.Text='Bağlantı doğrulandı. Veniux sunucusu hazır.'
 }catch{$connectionStatus.Text='Bağlantı doğrulanamadı. XAMPP tek başına yeterli değil; Veniux API sunucusu da çalışmalı.'}
 finally{$check.Enabled=$true}
})
$prepare.Add_Click({
 if(!(Get-Command npm.cmd -ErrorAction SilentlyContinue)){[Windows.Forms.MessageBox]::Show('Node.js bulunamadı. Önce Node.js kurulumunu tamamlayın.');return}
 $prepare.Enabled=$false; $runtimeStatus.Text='Hazırlanıyor; bu işlem biraz sürebilir.'; $form.Refresh()
 try{
  if(!(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules/electron/dist/electron.exe'))){throw 'Electron bağımlılığı eksik. desktop klasöründe npm ci çalıştırın.'}
  Push-Location (Join-Path $project 'frontend')
  try{ & npm.cmd run build; if($LASTEXITCODE -ne 0){throw 'Uygulama derlenemedi.'} }finally{Pop-Location}
  RefreshRuntime
 }catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message,'Veniux hazırlığı')}
 finally{$prepare.Enabled=$true}
})
$launch.Add_Click({
 try{
  $uri=GetValidatedApi
  New-Item -ItemType Directory -Path $settingsDirectory -Force|Out-Null
  @{apiBase=$uri.AbsoluteUri.TrimEnd('/')}|ConvertTo-Json|Set-Content -LiteralPath $settingsFile -Encoding UTF8
  $env:ELECTRON_RUN_AS_NODE=$null
  Start-Process -FilePath (Join-Path $PSScriptRoot 'node_modules/electron/dist/electron.exe') -ArgumentList '.' -WorkingDirectory $PSScriptRoot -WindowStyle Normal
  $form.Close()
 }catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message,'Veniux bağlantı ayarı')}
})
RefreshRuntime
[void]$form.ShowDialog()
