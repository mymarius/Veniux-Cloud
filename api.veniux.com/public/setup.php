<?php
declare(strict_types=1);
require dirname(__DIR__).'/src/security.php';
securityHeaders();
ini_set('display_errors','0');
require dirname(__DIR__).'/src/installation.php';
header('Cache-Control: no-store');header('X-Robots-Tag: noindex, nofollow');
header('X-Frame-Options: DENY');header('Referrer-Policy: no-referrer');header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'none'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
$message='';$ready=false;$success=false;
try {
    if(production()&&($_SERVER['HTTPS']??'')!=='on')throw new RuntimeException('HTTPS gerekli.');
    $dir=dataDir();$accountFile=$dir.'/admin-setup.json';
    $lock=fopen($dir.'/web-install.lock','c+');
    if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))throw new RuntimeException('Başka bir kurulum işlemi sürüyor.');
    chmod($dir.'/web-install.lock',0600);
    if(is_file($dir.'/web-install.started')||!is_file($accountFile))throw new RuntimeException('Kurulum kapalı. Tamamlanmış veya yarım kalmış kurulum yeniden çalıştırılmaz.');
    if(filesize($accountFile)>1024)throw new RuntimeException('Kurulum bilgileri geçersiz.');
    $account=json_decode(file_get_contents($accountFile),true,16,JSON_THROW_ON_ERROR);
    if(!filter_var($account['email']??'',FILTER_VALIDATE_EMAIL)||strlen($account['password']??'')<14||strlen($account['password'])>72)throw new RuntimeException('Özel klasördeki yönetici bilgilerini kontrol edin. Şifre 14–72 karakter olmalı.');
    $sessions=$dir.'/sessions';if(!is_dir($sessions))mkdir($sessions,0700,true);
    ini_set('session.use_strict_mode','1');session_save_path($sessions);session_name('veniux_setup');
    session_set_cookie_params(['secure'=>production(),'httponly'=>true,'samesite'=>'Strict','path'=>'/setup.php']);session_start();
    $_SESSION['csrf']??=bin2hex(random_bytes(32));$ready=true;
    if($_SERVER['REQUEST_METHOD']==='POST') {
        if((int)($_SERVER['CONTENT_LENGTH']??0)>4096)throw new RuntimeException('İstek çok büyük.');
        if(!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['csrf'],$_POST['csrf']))throw new RuntimeException('Sayfayı yenileyip tekrar deneyin.');
        $attemptFile=$dir.'/web-install.attempts';$attempts=is_file($attemptFile)?json_decode(file_get_contents($attemptFile),true):[];
        if(time()-(int)($attempts['time']??0)>3600)$attempts=['time'=>time(),'count'=>0];
        if((int)($attempts['count']??0)>=5)throw new RuntimeException('Deneme sınırına ulaşıldı. Bir saat sonra deneyin.');
        $attempts['count']=(int)($attempts['count']??0)+1;file_put_contents($attemptFile,json_encode($attempts));chmod($attemptFile,0600);
        if(!is_string($_POST['email']??null)||!is_string($_POST['password']??null)||!hash_equals(strtolower($account['email']),strtolower(trim($_POST['email'])))||!hash_equals($account['password'],$_POST['password']))throw new RuntimeException('Yönetici bilgileri doğrulanamadı.');
        if(($_POST['confirm']??'')!=='1')throw new RuntimeException('İlk kurulum onayı gerekli.');
        // Verify the dedicated target before writing any DDL. MySQL DDL cannot be rolled back.
        if(db()->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql' && db()->query('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()')->fetchColumn())throw new RuntimeException('Hedef veritabanı boş değil. Hiçbir veri değiştirilmedi.');
        file_put_contents($dir.'/web-install.started',gmdate('c'),LOCK_EX);chmod($dir.'/web-install.started',0600);$ready=false;
        try { installAuthority($account); } catch(Throwable $e) { throw new RuntimeException('Kurulum tamamlanamadı. Hedef korunuyor; otomatik tekrar engellendi. PHP, MySQL ve OpenSSL ayarları incelenmeli.'); }
        // Remove the plaintext bootstrap credential by truncation; the password hash remains in admins.
        if(file_put_contents($accountFile,'')===false)throw new RuntimeException('Kurulum yapıldı fakat özel kurulum dosyası temizlenemedi. Plesk üzerinden içeriğini boşaltın.');
        $_SESSION=[];session_destroy();$success=true;$message='Lisans merkezi ve yönetici hesabı hazır. Kurulum tekrar çalıştırılamaz.';
    }
} catch(Throwable $e) {http_response_code(400);$message=get_class($e)===RuntimeException::class?$e->getMessage():'Sunucu hazırlığı doğrulanamadı. Yapılandırmayı kontrol edin.';}
function escapeSetup(string $s):string{return htmlspecialchars($s,ENT_QUOTES,'UTF-8');}
?>
<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Veniux · İlk kurulum</title><link rel="stylesheet" href="/setup.css"></head><body><main><span class="brand">VENIUX / LİSANS MERKEZİ</span><h1>Güvenli ilk kurulum</h1><p>Yalnız ayrı, boş lisans veritabanını hazırlar. Mevcut hedef silinmez.</p>
<?php if($message):?><div role="status"><?=escapeSetup($message)?></div><?php endif;?>
<?php if($success):?><a href="/login">Yönetici girişine geç →</a><?php elseif($ready):?>
<form method="post" action="/setup.php"><input type="hidden" name="csrf" value="<?=escapeSetup($_SESSION['csrf'])?>"><label>Yönetici e-postası<input name="email" type="email" required autocomplete="username" maxlength="190"></label><label>Özel kurulum dosyasına kaydettiğiniz şifre<input name="password" type="password" required minlength="14" maxlength="72" autocomplete="current-password"></label><label class="confirm"><input type="checkbox" name="confirm" value="1" required> Ayrı ve boş hedefte ilk kurulumu onaylıyorum.</label><button>Kurulumu tamamla →</button></form><small>Şifre ekranda veya hata çıktısında gösterilmez. Başarısız DDL sonrası tekrar kurulum engellenir.</small>
<?php endif;?></main></body></html>
