<?php
declare(strict_types=1);
require dirname(__DIR__).'/src/security.php';
require dirname(__DIR__).'/src/requestFirewall.php';
securityHeaders();
require dirname(__DIR__).'/src/core.php';
require dirname(__DIR__).'/src/ownerIdentity.php';
require dirname(__DIR__).'/src/companion.php';
require dirname(__DIR__).'/src/updates.php';
ini_set('display_errors','0');
header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: no-referrer');header('X-Frame-Options: DENY');header('X-Robots-Tag: noindex, nofollow');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; form-action 'self'; base-uri 'none'");
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);$post=$_SERVER['REQUEST_METHOD']==='POST';
function jsonOut(array $body,int $status=200):void {http_response_code($status);header('Content-Type: application/json; charset=utf-8');echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
try{
    veniuxRequestFirewall(dataDir().'/request-firewall','api');
    if(production()&&($_SERVER['HTTPS']??'')!=='on'){http_response_code(503);exit('HTTPS gerekli.');}
    if($path==='/.well-known/security.txt'){
        header('Content-Type: text/plain; charset=utf-8');
        echo "Contact: https://veniux.com/#iletisim\nExpires: 2027-10-11T20:00:00Z\nPreferred-Languages: tr, en\nCanonical: https://api.veniux.com/.well-known/security.txt\n";
        exit;
    }
    if(str_starts_with($path,'/updates/'))updateDispatch($path);
    if((int)sql('SELECT MAX(version) FROM schema_versions')->fetchColumn()!==1)throw new RuntimeException('Schema unavailable');
    if($path==='/health')jsonOut(['status'=>'ok','service'=>'veniux-license-authority','schema'=>1]);
    if(str_starts_with($path,'/v1/')){
        if($path==='/v1/public-key'&&!$post){header('Content-Type: text/plain');echo file_get_contents(dataDir().'/signing-public.pem');exit;}
        if(!$post||!in_array($path,['/v1/activate','/v1/verify','/v1/owner/login','/v1/companion'],true))jsonOut(['error'=>'Bulunamadı.'],404);
        if((int)($_SERVER['CONTENT_LENGTH']??0)>4096)jsonOut(['error'=>'İstek fazla büyük.'],413);
        rate($path,$path==='/v1/activate'?30:3000);
        $raw=file_get_contents('php://input',false,null,0,4097);if(strlen($raw)>4096)jsonOut(['error'=>'İstek fazla büyük.'],413);
        $input=json_decode($raw,true,32,JSON_THROW_ON_ERROR);if(!is_array($input))throw new InvalidArgumentException('Geçersiz istek.');
        if($path==='/v1/activate'&&str_starts_with((string)($input['license_key']??''),'HW-'))jsonOut(['code'=>'DEVICE_ID_NOT_LICENSE','error'=>'HW- kodu cihaz kimliğidir. Girişten önce lisans merkezinden verilen geçerli VNX- lisans anahtarını etkinleştirin.'],403);
        if($path==='/v1/owner/login'){$identity=verifyOwnerIdentity($input);jsonOut($identity,$identity['valid']?200:401);}
        if($path==='/v1/companion'){rate('companion-activation',20);jsonOut(activateCompanion($input));}
        jsonOut($path==='/v1/activate'?activate($input):verifyDevice($input));
    }
    if(!in_array($path,['/','/login','/logout','/account','/terminals','/activity','/server','/licenses/create','/licenses/state','/devices/update'],true))jsonOut(['error'=>'Bulunamadı.'],404);
    ini_set('session.use_strict_mode','1');
    $sessions=dataDir().'/sessions';if(!is_dir($sessions))mkdir($sessions,0700,true);session_save_path($sessions);
    session_name('veniux_authority');session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>production(),'httponly'=>true,'samesite'=>'Strict']);session_start();
    $_SESSION['csrf']??=bin2hex(random_bytes(32));
    if(isset($_SESSION['admin']) && time()-(int)($_SESSION['last_activity']??0)>1800)unset($_SESSION['admin']);
    if(isset($_SESSION['admin'])){$admin=sql('SELECT id,email FROM admins WHERE id=? AND enabled=1',[$_SESSION['admin']])->fetch();if(!$admin)unset($_SESSION['admin']);else $_SESSION['last_activity']=time();}
    $message=null;
    if($post){
        if(!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['csrf'],$_POST['csrf'])){http_response_code(403);exit('İşlem doğrulanamadı. Sayfayı yenileyin.');}
        if($path==='/login'){
            rate('admin-login',5);$a=sql('SELECT * FROM admins WHERE email=? AND enabled=1',[strtolower(trim((string)($_POST['email']??'')))])->fetch();
            if(!$a||!password_verify((string)($_POST['password']??''),$a['password_hash'])){http_response_code(401);$message='E-posta veya şifre doğrulanamadı.';}
            else{session_regenerate_id(true);$_SESSION['admin']=(int)$a['id'];$_SESSION['last_activity']=time();$_SESSION['csrf']=bin2hex(random_bytes(32));audit('admin.login',(string)$a['id'],(int)$a['id']);header('Location: /');exit;}
        }else{
            if(empty($_SESSION['admin'])){http_response_code(401);exit('Yönetici oturumu gerekli.');}
            $actor=(int)$_SESSION['admin'];
            if($path==='/logout'){$_SESSION=[];session_destroy();header('Location: /login');exit;}
            if($path==='/account'){
                $email=strtolower(trim((string)($_POST['email']??'')));$password=(string)($_POST['password']??'');
                if($email!==ownerEmail()||mb_strlen($password)<14||strlen($password)>72||!hash_equals($password,(string)($_POST['confirm_password']??'')))throw new InvalidArgumentException('Sahip e-postası ve iki alanda aynı, 14–72 baytlık şifre gerekli.');
                sql('UPDATE admins SET email=?,password_hash=? WHERE id=? AND enabled=1',[$email,password_hash($password,PASSWORD_DEFAULT),$actor]);
                audit('admin.identity.changed',(string)$actor,$actor);$_SESSION=[];session_destroy();header('Location: /login');exit;
            }
            if($path==='/licenses/create'){$new=issueLicense((string)($_POST['company']??''),(string)($_POST['plan']??''),(int)($_POST['seats']??0),(string)($_POST['expires']??''),$actor);$_SESSION['issued_key']=$new['key'];}
            elseif($path==='/licenses/state')setLicenseState((int)($_POST['id']??0),(string)($_POST['state']??''),$actor);
            elseif($path==='/devices/update'){
                $alias=trim((string)($_POST['alias']??''));$enabled=(string)($_POST['enabled']??'');$id=(int)($_POST['id']??0);
                if(!$alias||mb_strlen($alias)>64||!in_array($enabled,['0','1'],true))throw new InvalidArgumentException('Terminal adı veya durum geçersiz.');
                atomic(function()use($alias,$enabled,$id,$actor){
                    $device=sql('SELECT * FROM devices WHERE id=?'.(db()->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql'?' FOR UPDATE':''),[$id])->fetch();if(!$device)throw new InvalidArgumentException('Terminal bulunamadı.');
                    $license=sql('SELECT * FROM licenses WHERE id=?'.(db()->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql'?' FOR UPDATE':''),[$device['license_id']])->fetch();
                    if($enabled==='1'&&!(int)$device['enabled']&&(int)sql('SELECT COUNT(*) FROM devices WHERE license_id=? AND enabled=1',[$license['id']])->fetchColumn()>=(int)$license['seats'])throw new InvalidArgumentException('Terminal sınırı dolu.');
                    sql('UPDATE devices SET alias=?,enabled=? WHERE id=?',[$alias,(int)$enabled,$id]);audit('device.updated',(string)$id,$actor);
                });
            }else{http_response_code(404);exit('Bulunamadı.');}
            $_SESSION['flash']='Değişiklik kaydedildi.';header('Location: '.($path==='/devices/update'?'/terminals':'/'));exit;
        }
    }
    if(empty($_SESSION['admin'])){$page='login';require dirname(__DIR__).'/src/views.php';exit;}
    if($path==='/account'){$page='account';require dirname(__DIR__).'/src/accountView.php';exit;}
    if(!in_array($path,['/','/terminals','/activity','/server'],true)){http_response_code(404);exit('Bulunamadı.');}
    $page=['/'=>'licenses','/terminals'=>'terminals','/activity'=>'activity','/server'=>'server'][$path];
    $licenses=sql('SELECT l.*, (SELECT COUNT(*) FROM devices d WHERE d.license_id=l.id AND d.enabled=1) AS used FROM licenses l ORDER BY l.id DESC')->fetchAll();
    $devices=sql('SELECT d.*,l.company,l.status AS license_status FROM devices d JOIN licenses l ON l.id=d.license_id ORDER BY d.last_seen DESC')->fetchAll();
    $events=sql('SELECT action,subject,created_at FROM audit ORDER BY id DESC LIMIT 60')->fetchAll();
    $issued=$_SESSION['issued_key']??null;unset($_SESSION['issued_key']);$message=$_SESSION['flash']??$message;unset($_SESSION['flash']);
    require dirname(__DIR__).'/src/views.php';
}catch(InvalidArgumentException|JsonException $e){if(str_starts_with($path,'/updates/'))jsonOut(['error'=>$e->getMessage()],400);if(str_starts_with($path,'/v1/'))jsonOut(['error'=>'Lisans veya terminal işlemi reddedildi.'],403);http_response_code(400);echo '<p>'.e($e->getMessage()).'</p><a href="/">Panele dön</a>';}
catch(Throwable $e){if(str_starts_with($path,'/updates/'))jsonOut(['error'=>$e->getMessage()==='RATE_LIMIT'?'İstek sınırı aşıldı.':'Güncelleme hizmeti şu anda kullanılamıyor.'],$e->getMessage()==='RATE_LIMIT'?429:503);if($e->getMessage()==='RATE_LIMIT'){http_response_code(429);header('Retry-After: 60');echo 'İstek sınırı aşıldı.';exit;}if(str_starts_with($path,'/v1/')||$path==='/health')jsonOut(['error'=>'Lisans merkezi şu anda doğrulanamıyor.'],503);http_response_code(503);echo 'Lisans merkezi hazırlanamadı. Sunucu yapılandırmasını kontrol edin.';}
