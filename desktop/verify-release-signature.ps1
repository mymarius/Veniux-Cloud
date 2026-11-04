param([Parameter(Mandatory=$true)][string]$Installer,[Parameter(Mandatory=$true)][string]$Application)
$ErrorActionPreference='Stop'
foreach($releasePath in @($Installer,$Application)) {
  $resolvedReleasePath=(Resolve-Path -LiteralPath $releasePath).Path
  $signature=Get-AuthenticodeSignature -LiteralPath $resolvedReleasePath
  if($signature.Status -ne 'Valid'){throw "Geçerli yayıncı imzası yok: $resolvedReleasePath ($($signature.Status))"}
  [pscustomobject]@{File=[System.IO.Path]::GetFileName($resolvedReleasePath);Status=$signature.Status;Publisher=$signature.SignerCertificate.Subject;Timestamped=[bool]$signature.TimeStamperCertificate}
  if(!$signature.TimeStamperCertificate){throw "Zaman damgası yok: $resolvedReleasePath"}
}
