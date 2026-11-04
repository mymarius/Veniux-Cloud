<?php
declare(strict_types=1);
function updateDirectory(): string { $dir=dataDir().'/updates'; if(!is_dir($dir))mkdir($dir,0700,true);return $dir; }
function updateName(string $name): bool {return (bool)preg_match('/\A(?:Veniux-[A-Za-z0-9._-]+\.(?:exe|apk|blockmap)|windows\.json|android\.json|latest\.yml)\z/D',$name);}
function updateDispatch(string $path): void {
 $dir=updateDirectory();$method=$_SERVER['REQUEST_METHOD'];
 if($path==='/updates/session'&&$method==='POST'){
  $input=json_decode(file_get_contents('php://input',false,null,0,4097),true,16,JSON_THROW_ON_ERROR);
  $owner=verifyOwnerIdentity($input??[]);if(!$owner['valid'])jsonOut(['error'=>'Sahip hesabı doğrulanamadı.'],401);
  foreach(glob($dir.'/session-*') as $stale)if(filemtime($stale)<time()-3600)unlink($stale);
  foreach(glob($dir.'/upload-*.part') as $stale)if(filemtime($stale)<time()-86400)unlink($stale);
  $token=bin2hex(random_bytes(32));file_put_contents($dir.'/session-'.hash('sha256',$token),json_encode(['expires'=>time()+3600,'admin'=>$owner['id']]),LOCK_EX);jsonOut(['token'=>$token]);
 }
 if($method==='GET'&&str_starts_with($path,'/updates/files/')){
  $name=substr($path,15);if(!updateName($name)||!is_file($dir.'/'.$name))jsonOut(['error'=>'Bulunamadı.'],404);
  header('Content-Type: '.(str_ends_with($name,'.json')?'application/json':(str_ends_with($name,'.yml')?'text/yaml':'application/octet-stream')));
  // Large installers must not accumulate in PHP output buffers.
  $stream=fopen($dir.'/'.$name,'rb');if(!$stream)throw new RuntimeException('Download unavailable');
  while(ob_get_level()>0)ob_end_clean();
  header('Content-Length: '.filesize($dir.'/'.$name));header('X-Accel-Buffering: no');
  set_time_limit(0);
  while(!feof($stream)&&!connection_aborted()){echo fread($stream,1024*1024);flush();}
  fclose($stream);exit;
 }
 $token=$_SERVER['HTTP_X_VENIUX_PUBLISH_TOKEN']??preg_replace('/^Bearer /','',$_SERVER['HTTP_AUTHORIZATION']??'');
 $session=preg_match('/\A[a-f0-9]{64}\z/D',$token)?$dir.'/session-'.hash('sha256',$token):'';
 $identity=$session&&is_file($session)?json_decode(file_get_contents($session),true):null;
 if(!$identity||$identity['expires']<time()||!sql('SELECT id FROM admins WHERE id=? AND enabled=1',[$identity['admin']])->fetch())jsonOut(['error'=>'Yayın oturumunu yeniden açın.'],401);
 if($method==='GET'&&$path==='/updates/list'){
  $files=[];foreach(scandir($dir) as $name)if(updateName($name))$files[]=['name'=>$name,'bytes'=>filesize($dir.'/'.$name)];jsonOut(['files'=>$files]);
 }
 $chunk=preg_match('~\A/updates/chunk/([a-f0-9]{32})/(Veniux-[A-Za-z0-9._-]+\.(?:exe|apk|blockmap))/(\d+)\z~D',$path,$parts)&&$method==='PUT';
 $finish=preg_match('~\A/updates/finish/([a-f0-9]{32})/(Veniux-[A-Za-z0-9._-]+\.(?:exe|apk|blockmap))\z~D',$path,$finishParts)&&$method==='POST';
 if(!$chunk&&!$finish&&($method!=='PUT'||!str_starts_with($path,'/updates/upload/')))jsonOut(['error'=>'Bulunamadı.'],404);
 $name=$chunk?$parts[2]:($finish?$finishParts[2]:substr($path,16));if(!updateName($name)||$name==='latest.yml')jsonOut(['error'=>'Geçersiz dosya.'],400);
 $lock=fopen($dir.'/publish.lock','c');flock($lock,LOCK_EX);
 $partial=$chunk||$finish?$dir.'/upload-'.hash('sha256',$token).'-'.($chunk?$parts[1]:$finishParts[1]).'.part':null;
 $temp=$finish?$partial:$dir.'/'.bin2hex(random_bytes(16)).'.tmp';
 try{
  if($chunk){
   $offset=(int)$parts[3];$current=is_file($partial)?filesize($partial):0;
   if($offset!==$current||$offset>500*1048576)throw new InvalidArgumentException('Yükleme sırası geçersiz. Dosyayı tekrar yükleyin.');
   $in=fopen('php://input','rb');$out=fopen($partial,'ab');$length=stream_copy_to_stream($in,$out,4*1048576+1);fclose($in);
   if(!$length||$length>4*1048576||$offset+$length>500*1048576){ftruncate($out,$offset);fclose($out);throw new InvalidArgumentException('Dosya parçası fazla büyük.');}fclose($out);
   jsonOut(['success'=>true,'bytes'=>$offset+$length]);
  }
  if($finish){$input=json_decode(file_get_contents('php://input',false,null,0,1025),true,8,JSON_THROW_ON_ERROR);$bytes=is_file($temp)?filesize($temp):0;if(!is_int($input['bytes']??null)||$bytes!==$input['bytes'])throw new InvalidArgumentException('Dosya parçaları tamamlanmadı.');}
  else{$in=fopen('php://input','rb');$out=fopen($temp,'xb');$bytes=stream_copy_to_stream($in,$out,500*1048576+1);fclose($in);fclose($out);}
  if(!$bytes||$bytes>500*1048576)throw new InvalidArgumentException('Dosya boyutu geçersiz.');
  if(in_array($name,['windows.json','android.json'],true)){
   if($bytes>65536)throw new InvalidArgumentException('Sürüm bilgisi fazla büyük.');
   $m=json_decode(file_get_contents($temp),true,16,JSON_THROW_ON_ERROR);$windows=$name==='windows.json';$ext=$windows?'exe':'apk';
   if(!preg_match('/\A\d+\.\d+\.\d+\z/D',$m['version']??'')||!updateName($m['filename']??'')||!str_ends_with($m['filename'],'.'.$ext)||!is_int($m['bytes']??null))throw new InvalidArgumentException('Sürüm bilgisi geçersiz.');
   $file=$dir.'/'.$m['filename'];$actual=is_file($file)?filesize($file):0;
   if(!$actual)throw new InvalidArgumentException('Önce kurulum dosyasını yükleyin.');
   $digest=$windows?base64_encode(hash_file('sha512',$file,true)):hash_file('sha256',$file);
   if(!$actual||$actual!==$m['bytes']||!hash_equals($digest,$m[$windows?'sha512':'sha256']??''))throw new InvalidArgumentException('Kurulum dosyasının boyutu veya özeti eşleşmiyor.');
   if(!$windows&&(!is_int($m['versionCode']??null)||$m['versionCode']<1))throw new InvalidArgumentException('Android sürüm kodu gerekli.');
   $old=is_file($dir.'/'.$name)?json_decode(file_get_contents($dir.'/'.$name),true):null;
   if($old&&(version_compare($m['version'],$old['version'],'<=')||(!$windows&&$m['versionCode']<=$old['versionCode'])))throw new InvalidArgumentException('Yeni sürüm mevcut sürümden büyük olmalıdır.');
   if($windows){$yaml='version: '.$m['version']."\nfiles:\n  - url: ".$m['filename']."\n    sha512: ".$m['sha512']."\n    size: ".$m['bytes']."\npath: ".$m['filename']."\nsha512: ".$m['sha512']."\n";file_put_contents($dir.'/latest.next',$yaml);rename($dir.'/latest.next',$dir.'/latest.yml');}
   rename($temp,$dir.'/'.$name);audit('update.published',$m['version'],(int)$identity['admin']);
  }else{if(is_file($dir.'/'.$name))throw new InvalidArgumentException('Bu dosya zaten var. Yeni sürüm adı kullanın.');rename($temp,$dir.'/'.$name);}
  jsonOut(['success'=>true,'name'=>$name,'bytes'=>$bytes]);
 }finally{if(is_file($temp))unlink($temp);flock($lock,LOCK_UN);fclose($lock);}
}
