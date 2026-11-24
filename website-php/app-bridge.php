<?php
declare(strict_types=1);
// Uygulama (app.veniux.com) sunucusunun, site hesabı e-posta ve parolasını doğrulatması için imzalı uç.
// Tarayıcıya açık değildir: ortak gizli anahtarla HMAC imzası, 2 dakikalık zaman penceresi ve e-posta başına deneme sınırı ister.
// Anahtar: ortam değişkeni VENIUX_SITE_BRIDGE_SECRET ya da veri klasöründeki app-bridge-secret.txt (en az 32 karakter).
require_once __DIR__.'/accounts.php';

function vxBridgeReply(int $status,array $body): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex, nofollow');
    echo json_encode($body,JSON_UNESCAPED_UNICODE);
}

function vxBridgeSecret(): string {
    $secret=trim((string)getenv('VENIUX_SITE_BRIDGE_SECRET'));
    if($secret==='')$secret=trim((string)@file_get_contents((getenv('VENIUX_SITE_DATA_DIR')?:dirname(__DIR__).'/.local').'/app-bridge-secret.txt'));
    return $secret;
}

/** Aynı e-postaya 15 dakikada en fazla 10 deneme; parola tahmini bu uçtan yapılamaz. */
function vxBridgeAttempt(string $dir,string $email): bool {
    $file=$dir.'/bridge-'.hash('sha256',$email.'|'.(string)intdiv(time(),900));
    $handle=fopen($file,'c+');if(!$handle||!flock($handle,LOCK_EX))throw new RuntimeException('Rate storage unavailable');
    try{
        $count=(int)stream_get_contents($handle)+1;
        rewind($handle);ftruncate($handle,0);fwrite($handle,(string)$count);fflush($handle);chmod($file,0600);
        return $count<=10;
    }finally{flock($handle,LOCK_UN);fclose($handle);}
}

function vxAppBridge(array $config): void {
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST'){header('Allow: POST');vxBridgeReply(405,['valid'=>false]);return;}
    if(($_SERVER['HTTPS']??'')!=='on'&&getenv('VENIUX_SITE_ENV')!=='development'){vxBridgeReply(403,['valid'=>false]);return;}
    $secret=vxBridgeSecret();
    if(strlen($secret)<32){vxBridgeReply(503,['valid'=>false]);return;}
    $body=(string)file_get_contents('php://input',false,null,0,4097);
    if($body===''||strlen($body)>4096){vxBridgeReply(400,['valid'=>false]);return;}
    $time=(string)($_SERVER['HTTP_X_VENIUX_TIMESTAMP']??'');
    $given=(string)($_SERVER['HTTP_X_VENIUX_SIGNATURE']??'');
    if(!ctype_digit($time)||abs(time()-(int)$time)>120||!hash_equals(hash_hmac('sha256',$time."\n".$body,$secret),$given)){vxBridgeReply(401,['valid'=>false]);return;}
    $data=json_decode($body,true);
    $email=is_array($data)&&is_string($data['email']??null)?strtolower(trim($data['email'])):'';
    $password=is_array($data)&&is_string($data['password']??null)?$data['password']:'';
    if($email===''||$password===''||strlen($email)>254||strlen($password)>200){vxBridgeReply(400,['valid'=>false]);return;}
    $dir=accountDirectory($config);
    if(!vxBridgeAttempt($dir,$email)){vxBridgeReply(429,['valid'=>false]);return;}
    $account=accountTransaction($dir,fn(array &$accounts)=>$accounts[hash('sha256',$email)]??null);
    $dummy='$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi';
    if(!password_verify($password,(string)($account['password_hash']??$dummy))||!$account){vxBridgeReply(200,['valid'=>false,'reason'=>'invalid']);return;}
    if(($account['verified']??true)===false){vxBridgeReply(200,['valid'=>false,'reason'=>'unverified']);return;}
    vxBridgeReply(200,['valid'=>true,'company'=>(string)($account['company']??'')]);
}
