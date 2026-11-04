<?php
declare(strict_types=1);
require dirname(__DIR__).'/release-archive.php';
$temp=tempnam(sys_get_temp_dir(),'veniux-archive-test-');
putenv('VENIUX_ARCHIVE_CATALOG='.$temp);
$checks=0;
function check(bool $ok,string $message):void{global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function catalog(array $rows):void{global $temp;file_put_contents($temp,json_encode(['schema'=>1,'releases'=>$rows],JSON_THROW_ON_ERROR));}
function rejected(array $rows,string $message):void{catalog($rows);try{releaseArchiveEntries();}catch(RuntimeException $e){check(true,$message);return;}check(false,$message);}
$row=['platform'=>'windows','version'=>'2.4.9','filename'=>'Veniux-Setup-2.4.9.exe','bytes'=>123,'sha256'=>str_repeat('a',64)];
try{
 $new=array_replace($row,['version'=>'2.4.38','filename'=>'Veniux-Setup-2.4.38.exe']);
 $android=array_replace($row,['platform'=>'android','version'=>'2.4.32','filename'=>'Veniux-Android-2.4.32.apk']);
 catalog([$row,$new,$android]);
 check(array_column(releaseArchiveEntries(),'version')===['2.4.38','2.4.32','2.4.9'],'Semantic ordering');
 check(releaseArchiveFind('android','2.4.32')['filename']===$android['filename'],'Correct platform lookup');
 check(releaseArchiveFind('windows','2.4.32')===null,'No cross-platform fallback');
 check(releaseArchiveFind('windows','9.0.0')===null,'Missing version');
 rejected([$row,$row],'Duplicate immutable version');
 rejected([array_replace($row,['filename'=>'../../private.env'])],'Path traversal');
 rejected([array_replace($row,['filename'=>'Veniux-Setup-2.4.10.exe'])],'Filename version mismatch');
 rejected([array_replace($row,['platform'=>'linux'])],'Platform whitelist');
 rejected([array_replace($row,['sha256'=>'invalid'])],'Hash validation');
 rejected([array_replace($row,['bytes'=>0])],'Positive file size');
 rejected([array_replace($row,['version'=>'2.4.9/../../'])],'Version traversal');
 $variant=array_replace($row,['filename'=>'Veniux-Setup-2.4.9-local-aaaaaaaaaaaa.exe']);catalog([$variant]);check(releaseArchiveFind('windows','2.4.9')['filename']===$variant['filename'],'Hash-addressed local variant');
 rejected([array_replace($variant,['filename'=>'Veniux-Setup-2.4.9-local-bbbbbbbbbbbb.exe'])],'Variant hash must match');
 file_put_contents($temp,'{"schema":2,"releases":[]}');
 try{releaseArchiveEntries();check(false,'Schema validation');}catch(RuntimeException $e){check(true,'Schema validation');}
 unlink($temp);check(releaseArchiveEntries()===[],'Missing catalogue');
 echo "PASS $checks release archive checks\n";
}finally{if(is_file($temp))unlink($temp);putenv('VENIUX_ARCHIVE_CATALOG');}
