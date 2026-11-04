<?php
declare(strict_types=1);
// Application request guard. It does not replace a network firewall or DNS policy.
function veniuxFirewallPath(string $uri): bool {
 $path=explode('?',$uri,2)[0];
 if(strlen($uri)>8192||preg_match('/%(?![0-9a-f]{2})/i',$path))return false;
 for($i=0;$i<3;$i++){$decoded=rawurldecode($path);if($decoded===$path)break;$path=$decoded;}
 return !preg_match('~[\x00-\x1f\x7f\\\\]|(?:^|/)\.\.(?:/|$)|(?:^|/)(?:\.env(?:\.[^/]*)?|\.git|\.svn)(?:/|$)|(?:^|/)(?:wp-admin|wp-login\.php|xmlrpc\.php|phpmyadmin|vendor/phpunit)(?:/|$)~i',$path);
}
function veniuxFirewallQuota(string $directory,string $ip,int $limit=6000,int $burstLimit=600,?int $time=null): bool {
 $time=$time??time();if(!is_dir($directory)&&!mkdir($directory,0700,true))throw new RuntimeException('Security storage unavailable');
 $root=!empty($_SERVER['DOCUMENT_ROOT'])?realpath($_SERVER['DOCUMENT_ROOT']):false;$resolved=realpath($directory);
 if(!$resolved||($root&&($resolved===$root||str_starts_with($resolved,$root.DIRECTORY_SEPARATOR))))throw new RuntimeException('Private security storage required');
 $key=fopen($directory.'/key.bin','c+b');if(!$key||!flock($key,LOCK_EX))throw new RuntimeException('Security lock unavailable');
 try{rewind($key);$salt=stream_get_contents($key);if(strlen($salt)!==32){$salt=random_bytes(32);ftruncate($key,0);rewind($key);fwrite($key,$salt);fflush($key);}}finally{flock($key,LOCK_UN);fclose($key);}
 $id=hash_hmac('sha256',$ip,$salt);$file=$directory.'/bucket-'.substr($id,0,2).'.json';$stream=fopen($file,'c+b');
 if(!$stream||!flock($stream,LOCK_EX))throw new RuntimeException('Security lock unavailable');
 try{
  $raw=stream_get_contents($stream,1048577);if(strlen($raw)>1048576)throw new RuntimeException('Security state unavailable');$state=$raw===''?[]:json_decode($raw,true,16,JSON_THROW_ON_ERROR);
  foreach($state as $k=>$v)if(($v['expires']??0)<$time)unset($state[$k]);
  if(!isset($state[$id])&&count($state)>=256)array_shift($state);
  $window=intdiv($time,60);$burst=intdiv($time,10);$v=$state[$id]??[];
  $count=($v['window']??-1)===$window?($v['count']??0)+1:1;$quick=($v['burst']??-1)===$burst?($v['quick']??0)+1:1;
  $state[$id]=['window'=>$window,'count'=>min($count,$limit+1),'burst'=>$burst,'quick'=>min($quick,$burstLimit+1),'expires'=>$time+70];
  ftruncate($stream,0);rewind($stream);fwrite($stream,json_encode($state,JSON_THROW_ON_ERROR));fflush($stream);
  return $count<=$limit&&$quick<=$burstLimit;
 }finally{flock($stream,LOCK_UN);fclose($stream);}
}
function veniuxRequestFirewall(string $directory,string $context): void {
 $deny=function(int $status,string $reason):void{http_response_code($status);header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');header('X-Request-Id: '.bin2hex(random_bytes(8)));if($status===429)header('Retry-After: 60');echo json_encode(['error'=>$status===429?'İstek sınırına ulaşıldı. Bir dakika sonra tekrar deneyin.':'İstek güvenlik denetiminde reddedildi.','code'=>$reason],JSON_UNESCAPED_UNICODE);exit;};
 $uri=$_SERVER['REQUEST_URI']??'/';$method=$_SERVER['REQUEST_METHOD']??'GET';
 if(!veniuxFirewallPath($uri))$deny(403,'REQUEST_PATH');
 if(!in_array($method,$context==='api'?['GET','HEAD','POST','PUT']:['GET','HEAD','POST'],true))$deny(405,'REQUEST_METHOD');
 $path=explode('?',$uri,2)[0];$limit=$context==='api'?(str_starts_with($path,'/updates/chunk/')?4*1048576:(str_starts_with($path,'/updates/upload/')?8*1048576:65536)):65536;
 $length=$_SERVER['CONTENT_LENGTH']??'0';if(!ctype_digit((string)$length)||(float)$length>$limit)$deny(413,'REQUEST_SIZE');
 if(in_array($method,['POST','PUT'],true)&&($_SERVER['HTTP_SEC_FETCH_SITE']??'')==='cross-site')$deny(403,'REQUEST_ORIGIN');
 try{if(!veniuxFirewallQuota($directory,$_SERVER['REMOTE_ADDR']??'unknown'))$deny(429,'REQUEST_RATE');}catch(Throwable $e){$deny(503,'SECURITY_UNAVAILABLE');}
}
