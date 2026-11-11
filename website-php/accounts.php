<?php
declare(strict_types=1);
require_once __DIR__.'/owner-identity.php';
require_once __DIR__.'/pricing.php';

// Download accounts are separate from the business users created inside the installed program.
function accountDirectory(array $config): string {
    $dir=(getenv('VENIUX_SITE_DATA_DIR')?:dirname(__DIR__).'/.local').'/website-accounts';
    if(!is_dir($dir)&&!mkdir($dir,0700,true))throw new RuntimeException('Account storage unavailable');
    $resolved=realpath($dir);$root=realpath($_SERVER['DOCUMENT_ROOT']??__DIR__);
    if(!$resolved||($root&&($resolved===$root||str_starts_with($resolved,$root.DIRECTORY_SEPARATOR))))throw new RuntimeException('Private account storage required');
    return $resolved;
}

function accountTransaction(string $dir,callable $action) {
    $lock=fopen($dir.'/accounts.lock','c+');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('Account storage busy');chmod($dir.'/accounts.lock',0600);
    try{
        $file=$dir.'/accounts.json';
        $accounts=is_file($file)?json_decode(file_get_contents($file),true,32,JSON_THROW_ON_ERROR):[];
        if(!is_array($accounts))throw new RuntimeException('Invalid storage');
        $before=$accounts;
        $result=$action($accounts);
        if($accounts!==$before){
            $temp=$file.'.'.bin2hex(random_bytes(8)).'.tmp';
            if(file_put_contents($temp,json_encode($accounts,JSON_THROW_ON_ERROR))===false)throw new RuntimeException('Account write failed');
            chmod($temp,0600);
            if(!rename($temp,$file))throw new RuntimeException('Account save failed');
        }
        return $result;
    }finally{
        flock($lock,LOCK_UN);fclose($lock);
    }
}

function accountRate(string $dir):bool {
    $file=$dir.'/attempt-'.hash('sha256',($_SERVER['REMOTE_ADDR']??'unknown').'|'.(string)intdiv(time(),900));
    $handle=fopen($file,'c+');if(!$handle||!flock($handle,LOCK_EX))throw new RuntimeException('Rate storage unavailable');
    try{
        $count=(int)stream_get_contents($handle)+1;
        rewind($handle);ftruncate($handle,0);
        fwrite($handle,(string)$count);
        fflush($handle);chmod($file,0600);
        return $count<=15;
    }finally{
        flock($handle,LOCK_UN);fclose($handle);
    }
}

// Server-side module permissions validation
function accountModulePermissions(string $planCode): array {
    $matrix = [
        'baslangic' => [
            'name' => 'Başlangıç',
            'crm' => true,
            'stok' => true,
            'depo' => true,
            'pos' => true,
            'satis' => true,
            'raporlar' => true,
            'intelligence' => false,
            'max_depo' => 1,
            'max_user' => 5,
            'max_devices' => 3
        ],
        'isletme' => [
            'name' => 'İşletme',
            'crm' => true,
            'stok' => true,
            'depo' => true,
            'pos' => true,
            'satis' => true,
            'raporlar' => true,
            'intelligence' => true,
            'max_depo' => 3,
            'max_user' => 15,
            'max_devices' => 10
        ],
        'kurumsal' => [
            'name' => 'Kurumsal',
            'crm' => true,
            'stok' => true,
            'depo' => true,
            'pos' => true,
            'satis' => true,
            'raporlar' => true,
            'intelligence' => true,
            'max_depo' => 50,
            'max_user' => 250,
            'max_devices' => 100
        ]
    ];
    return $matrix[$planCode] ?? $matrix['isletme'];
}

function accountRoutes(string $path,array $config):bool {
    if(!in_array($path,['/kayit','/giris','/indir','/hesap','/cikis','/dosya/windows','/dosya/android'],true))return false;
    if(($_SERVER['HTTPS']??'')!=='on'&&getenv('VENIUX_SITE_ENV')!=='development'){
        if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){http_response_code(403);echo 'Hesap işlemleri için HTTPS bağlantısı gerekli.';}
        else header('Location: '.$config['url'].$path,true,301);
        return true;
    }
    header_remove('X-Powered-By');header('X-Frame-Options: DENY');
    if(($_SERVER['HTTPS']??'')==='on')header('Strict-Transport-Security: max-age=31536000');
    header('X-Robots-Tag: noindex, nofollow');header('Cache-Control: no-store');
    $_SESSION['account_csrf']??=bin2hex(random_bytes(32));
    $error='';$post=($_SERVER['REQUEST_METHOD']??'GET')==='POST';
    if(isset($_SESSION['download_account'])&&time()-(int)($_SESSION['account_activity']??0)>7200)unset($_SESSION['download_account']);
    if(isset($_SESSION['download_account']))$_SESSION['account_activity']=time();
    
    try{
        $dir=accountDirectory($config);
        if($post){
            if(!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['account_csrf'],$_POST['csrf'])){
                http_response_code(403);$error='Sayfayı yenileyip tekrar deneyin.';
            }elseif(!in_array($path,['/kayit','/giris','/cikis'],true)){
                http_response_code(405);$error='İstek desteklenmiyor.';
            }elseif($path==='/cikis'){
                unset($_SESSION['download_account']);
                session_regenerate_id(true);
                $_SESSION['account_csrf']=bin2hex(random_bytes(32));
                header('Location: /giris',true,303);
                return true;
            }elseif(!accountRate($dir)){
                http_response_code(429);header('Retry-After: 900');
                $error='Deneme sınırına ulaşıldı. 15 dakika sonra tekrar deneyin.';
            }else{
                $email=is_string($_POST['email']??null)?strtolower(trim($_POST['email'])):'';
                $password=is_string($_POST['password']??null)?$_POST['password']:'';
                $company=is_string($_POST['company']??null)?trim($_POST['company']):'';
                
                if(!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($email)>190||mb_strlen($password,'UTF-8')<14||strlen($password)>72||($path==='/kayit'&&(!$company||strlen($company)>160))){
                    http_response_code(400);$error='Geçerli e-posta, işletme adı ve 14–72 karakterlik şifre girin.';
                }else{
                    $key=hash('sha256',$email);
                    if($email===siteOwnerEmail()){
                        $account=siteOwnerIdentity($email,$password);
                        if(!$account){http_response_code(401);$error='Merkezi sahip hesabı doğrulanamadı. API yönetim hesabınızla giriş yapın.';}
                    }elseif($path==='/kayit'){
                        $hash=password_hash($password,PASSWORD_DEFAULT);
                        $account=accountTransaction($dir,function(array &$accounts)use($key,$email,$company,$hash){
                            if(isset($accounts[$key]))return null;
                            $value=[
                                'id'=>bin2hex(random_bytes(16)),
                                'email'=>$email,
                                'company'=>$company,
                                'plan'=>'isletme',
                                'license_key'=>'VNX-'.strtoupper(bin2hex(random_bytes(6))).'-'.strtoupper(bin2hex(random_bytes(4))),
                                'password_hash'=>$hash,
                                'created_at'=>gmdate('c')
                            ];
                            $accounts[$key]=$value;
                            return $value;
                        });
                        if(!$account){http_response_code(409);$error='Kayıt tamamlanamadı. Bu e-posta ile hesabınız varsa giriş yapın.';}
                    }else{
                        $account=accountTransaction($dir,fn(array &$accounts)=>$accounts[$key]??null);
                        $dummy='$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi';
                        if(!password_verify($password,$account['password_hash']??$dummy)){
                            $account=null;http_response_code(401);$error='E-posta veya şifre doğrulanamadı.';
                        }
                    }
                    if($account){
                        session_regenerate_id(true);
                        $_SESSION['download_account']=[
                            'id'=>$account['id'],
                            'company'=>$account['company'],
                            'email'=>$account['email'],
                            'plan'=>$account['plan']??'isletme',
                            'license_key'=>$account['license_key']??('VNX-'.strtoupper(substr($account['id'],0,8))),
                            'is_owner'=>$account['is_owner']??false
                        ];
                        $_SESSION['account_activity']=time();
                        $_SESSION['account_csrf']=bin2hex(random_bytes(32));
                        header('Location: /indir',true,303);
                        return true;
                    }
                }
            }
        }
        $account=$_SESSION['download_account']??null;
        if(str_starts_with($path,'/dosya/')){
            if(!$account){header('Location: /giris',true,303);return true;}
            $platform=substr($path,7);$releaseFile=(getenv('VENIUX_SITE_DATA_DIR')?:dirname(__DIR__).'/.local').'/website-downloads/releases.json';$releases=is_file($releaseFile)?json_decode(file_get_contents($releaseFile),true,16,JSON_THROW_ON_ERROR):[];
            $entry=$releases[$platform]??null;
            $central=dirname(__DIR__).'/license-private/updates/'.($platform==='windows'?'windows.json':'android.json');
            if(in_array($platform,['windows','android'],true)&&is_file($central)){$releaseFile=$central;$entry=json_decode(file_get_contents($central),true,16,JSON_THROW_ON_ERROR);}
            $downloadBase=dirname($releaseFile);
            if(isset($_GET['surum'])){
                $version=$_GET['surum'];
                if(!is_string($version)||!preg_match('/\A\d+\.\d+\.\d+\z/D',$version)){http_response_code(400);echo 'Geçersiz sürüm numarası.';return true;}
                require_once __DIR__.'/release-archive.php';
                $entry=releaseArchiveFind($platform,$version);
                if(!$entry){http_response_code(404);echo 'Bu sürüm arşivde bulunamadı.';return true;}
                $downloadBase=dirname(releaseArchivePath()).'/updates';
            }
            $downloadDir=realpath($downloadBase);$file=$entry&&is_string($entry['filename']??null)&&preg_match('/^[A-Za-z0-9._-]+$/D',$entry['filename'])?realpath($downloadBase.'/'.$entry['filename']):false;
            if(!$file||!$downloadDir||dirname($file)!==$downloadDir||!is_file($file)){
                http_response_code(503);$error='İndirme dosyası şu anda hazırlanıyor. Lütfen daha sonra deneyin.';
            }else{
                session_write_close();ini_set('zlib.output_compression','0');
                while(ob_get_level()>0)ob_end_clean();
                header('Content-Type: '.($platform==='android'?'application/vnd.android.package-archive':'application/octet-stream'));
                header('Content-Disposition: attachment; filename="'.basename($file).'"');
                header('Content-Length: '.filesize($file));header('X-Content-Type-Options: nosniff');header('X-Accel-Buffering: no');
                if(($_SERVER['REQUEST_METHOD']??'GET')==='HEAD')return true;
                set_time_limit(0);$stream=fopen($file,'rb');
                if(!$stream)throw new RuntimeException('Download unavailable');
                while(!feof($stream)&&!connection_aborted()){echo fread($stream,1024*1024);flush();}
                fclose($stream);return true;
            }
        }
        if(($path==='/indir'||$path==='/hesap')&&!$account){
            header('Location: /kayit',true,303);
            return true;
        }
        if($path==='/cikis'&&!$post){
            http_response_code(405);$error='Çıkış için hesabınızdaki düğmeyi kullanın.';
        }
    }catch(Throwable $failure){
        http_response_code(503);$error='Hesap hizmeti şu anda kullanılamıyor. Daha sonra tekrar deneyin.';$account=null;
    }
    
    $register=$path==='/kayit';
    $isPortal=($path==='/indir'||$path==='/hesap')&&$account;
    $title=$isPortal?'Müşteri Paneli':($register?'Veniux hesabınızı oluşturun':'Veniux hesabınıza giriş yapın');
    $currentTab=$_GET['tab']??($path==='/indir'?'indirmeler':'genel-bakis');
    $activePlanCode=$account['plan']??'isletme';
    $permissions=accountModulePermissions($activePlanCode);
    $nonce=$GLOBALS['nonce']??base64_encode(random_bytes(16));
    $manifest=require __DIR__.'/asset-manifest.php';
?><!doctype html>
<html lang="tr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title><?=e($title)?> | Veniux</title>
    <link rel="icon" type="image/webp" href="/assets/logo-40-v1.webp">
    <link rel="stylesheet" href="/assets/precision.css">
    <link rel="stylesheet" href="/assets/<?=e($manifest['accounts'])?>">
    <link rel="stylesheet" href="/assets/veniux-site.css"><link rel="stylesheet" href="/assets/cookie-consent.css">
    <link rel="stylesheet" href="/assets/home.css?v=20261112f"><script src="/assets/home.js?v=20261112f" defer></script><script src="/assets/chat.js?v=20261112f" defer></script>
</head>
<body>
<?php if(!$account): $path=$register?'/kayit':'/giris'; require __DIR__.'/components/navbar.php'; else:?>
<header class="dp-header">
    <div class="dp-container dp-nav">
        <a class="dp-brand" href="/" aria-label="Veniux ana sayfa">
            <img class="dp-brand-logo" src="/assets/logo-40-v1.webp" alt="Veniux logosu" width="36" height="36">
            <span>VENIUX</span>
        </a>
        <div class="dp-nav-actions">
            <?php if($account):?>
                <span class="dp-pill-text ap-company"><?=e($account['company'])?></span>
                <form action="/cikis" method="post">
                    <input type="hidden" name="csrf" value="<?=e($_SESSION['account_csrf'])?>">
                    <button type="submit" class="dp-btn dp-btn--outline dp-btn--sm">Çıkış Yap</button>
                </form>
            <?php else:?>
                <a href="/giris" class="dp-btn dp-btn--ghost dp-btn--sm">Giriş Yap</a>
                <a href="/kayit" class="dp-btn dp-btn--accent dp-btn--sm">Kayıt Ol</a>
            <?php endif;?>
        </div>
    </div>
</header>
<?php endif;?>

<main class="dp-container dp-portal" id="main">
<?php if($isPortal):?>
    <?php $downloads=(require __DIR__.'/release-catalog.php')['downloads']; $legacyTabs=['lisanslarim'=>'lisans','paketim'=>'lisans','faturalarim'=>'faturalar','taleplerim'=>'talepler','bildirimler'=>'genel-bakis']; $currentTab=$legacyTabs[$currentTab]??$currentTab; ?>
    <div class="ap-layout">
        <aside class="ap-nav">
            <div class="ap-user"><b><?=e($account['company'])?></b><span><?=e($account['email'])?></span></div>
            <nav aria-label="Müşteri paneli bölümleri">
                <?php foreach([['genel-bakis','Genel bakış'],['lisans','Lisans ve paket'],['faturalar','Faturalar'],['indirmeler','İndirmeler'],['talepler','Talepler'],['guvenlik','Hesap güvenliği'],['destek','Destek']] as [$tab,$label]):?><a <?=$currentTab===$tab?'aria-current="page"':''?> href="<?=$tab==='indirmeler'?'/indir':'/hesap?tab='.$tab?>"><?=$label?></a><?php endforeach;?>
            </nav>
        </aside>
        <div class="ap-main">
            <?php if($error):?><div class="ac-error" role="alert"><?=e($error)?></div><?php endif;?>
            <?php if($currentTab==='lisans'):?>
                <h1>Lisans ve paket</h1>
                <p class="ap-lead">Site hesabı indirmeler içindir. Ücretli lisansı kendiliğinden açmaz.</p>
                <div class="ap-empty"><b>Bu hesapta gösterilecek lisans kaydı yok.</b><p>Lisansınız görüşme ve ödeme netleştikten sonra programın içinden etkinleştirilir. Durumunu programdaki lisans ekranından görebilirsiniz.</p><p class="ap-actions"><a class="hx-btn" href="/fiyatlandirma">Paketleri incele</a></p></div>
            <?php elseif($currentTab==='faturalar'):?>
                <h1>Faturalar</h1>
                <p class="ap-lead">Sitede online ödeme alınmaz.</p>
                <div class="ap-empty"><b>Bu hesapta fatura kaydı görünmüyor.</b><p>Fatura veya ödemeyle ilgili sorularınız için bize yazın.</p><p class="ap-actions"><a class="hx-btn" href="/?request_type=contact#iletisim">Bize yazın</a></p></div>
            <?php elseif($currentTab==='indirmeler'):?>
                <h1>Programı indirin</h1>
                <p class="ap-lead">Windows programı ve Android uygulaması aynı kayıtlarla çalışır.</p>
                <div class="pg-tickets ap-tickets">
                    <article class="pg-ticket"><div class="pg-ticket-main"><span class="pg-ticket-tag">Sürüm <?=e($downloads['windows'])?></span><h2>Windows</h2><p>Windows 10/11, 64 bit.</p></div><a class="pg-stub" href="/dosya/windows"><?=homeBarcode('panel-windows',60)?><b>İndir</b><span>Kurulum dosyası</span></a></article>
                    <article class="pg-ticket pg-ticket-orange"><div class="pg-ticket-main"><span class="pg-ticket-tag">Sürüm <?=e($downloads['android'])?></span><h2>Android</h2><p>Android 8 ve üzeri.</p></div><a class="pg-stub" href="/dosya/android"><?=homeBarcode('panel-android',60)?><b>İndir</b><span>Uygulama dosyası</span></a></article>
                </div>
                <aside class="pg-notice" aria-label="Windows kurulum uyarısı"><b>Önceden söyleyelim</b><p>Windows kurulum dosyasında henüz doğrulanmış yayıncı imzası yok; SmartScreen uyarısı çıkabilir.</p></aside>
                <p class="ap-links"><a href="/guncelleme-notlari">Güncelleme notları</a><a href="/surum-arsivi">Tüm sürümler</a></p>
                <div class="ap-guide"><?php require __DIR__.'/terminal-guide.php'; ?></div>
            <?php elseif($currentTab==='talepler'):?>
                <h1>Talepler</h1>
                <p class="ap-lead">Demo ve teklif talepleriniz e-postayla yanıtlanır; bu ekranda henüz listelenmez.</p>
                <div class="ap-empty"><b>Burada görüntülenecek talep yok.</b><p>Yeni bir talep için formu kullanabilirsiniz.</p><p class="ap-actions"><a class="hx-btn" href="/?request_type=contact#iletisim">Talep gönderin</a></p></div>
            <?php elseif($currentTab==='guvenlik'):?>
                <h1>Hesap güvenliği</h1>
                <dl class="ap-facts"><div><dt>E-posta</dt><dd><?=e($account['email'])?></dd></div></dl>
                <div class="ap-empty"><b>Şifre değiştirme bu ekrandan henüz yapılamıyor.</b><p>Şifrenizi değiştirmeniz gerekiyorsa bize yazın.</p><p class="ap-actions"><a class="hx-btn" href="/?request_type=contact#iletisim">Bize yazın</a></p></div>
            <?php elseif($currentTab==='destek'):?>
                <h1>Destek</h1>
                <p class="ap-lead">Kurulum, cihaz ve lisans sorularınız için bize ulaşın.</p>
                <div class="ap-cards">
                    <article><h2>Bize yazın</h2><p>Sorununuzu formdan iletin.</p><a class="hx-btn" href="/?request_type=contact#iletisim">Forma git</a></article>
                    <article><h2>Discord</h2><p>Topluluğa katılın, gelişmeleri takip edin.</p><a class="hx-btn" href="https://discord.gg/WQyxdp7MKW" target="_blank" rel="noopener noreferrer">Discord'a katıl</a></article>
                </div>
            <?php else:?>
                <h1>Hoş geldiniz, <?=e($account['company'])?>.</h1>
                <p class="ap-lead">Programı buradan indirebilirsiniz. Site hesabı ücretli lisansı kendiliğinden açmaz.</p>
                <div class="pg-tickets ap-tickets">
                    <article class="pg-ticket"><div class="pg-ticket-main"><span class="pg-ticket-tag">Sürüm <?=e($downloads['windows'])?></span><h2>Windows</h2><p>Kasa ve ofis için.</p></div><a class="pg-stub" href="/dosya/windows"><?=homeBarcode('genel-windows',60)?><b>İndir</b><span>Kurulum dosyası</span></a></article>
                    <article class="pg-ticket pg-ticket-orange"><div class="pg-ticket-main"><span class="pg-ticket-tag">Sürüm <?=e($downloads['android'])?></span><h2>Android</h2><p>Depo ve raf arası için.</p></div><a class="pg-stub" href="/dosya/android"><?=homeBarcode('genel-android',60)?><b>İndir</b><span>Uygulama dosyası</span></a></article>
                </div>
                <p class="ap-links"><a href="/hesap?tab=lisans">Lisans durumu</a><a href="/guncelleme-notlari">Güncelleme notları</a><a href="/hesap?tab=destek">Destek</a></p>
            <?php endif;?>
        </div>
    </div>

<?php else:?>
    <div class="ac-wrap">
        <div class="ac-side" aria-hidden="true">
            <p class="ac-side-big"><?=$register?'Rafa yeni bir işletme.':'Tekrar hoş geldiniz.'?></p>
            <div class="ac-key"><b>VENIUX</b><span>Windows ve Android</span><?=function_exists('homeBarcode')?homeBarcode('hesap',40):''?></div>
        </div>
        <div class="ac-card">
            <h1><?=e($title)?></h1>
            <p class="ac-lead"><?=$register?'İşletmenizi kaydedin ve Veniux indirme merkezine hemen erişin.':'Hesabınıza giriş yaparak lisanslarınızı ve kurulum paketlerinizi yönetin.'?></p>
            <?php if($error):?><div class="ac-error" role="alert"><?=e($error)?></div><?php endif;?>
            <form class="ac-form" action="<?=$register?'/kayit':'/giris'?>" method="post">
                <input type="hidden" name="csrf" value="<?=e($_SESSION['account_csrf'])?>">
                <?php if($register):?><label>İşletme adı<input name="company" required maxlength="160" autocomplete="organization" placeholder="Firma veya mağaza adınız"></label><?php endif;?>
                <label>E-posta adresi<input name="email" type="email" required maxlength="190" autocomplete="email" placeholder="ornek@isletme.com"></label>
                <label>Şifre<input name="password" type="password" required minlength="14" maxlength="72" autocomplete="<?=$register?'new-password':'current-password'?>"><small>En az 14 karakter.</small></label>
                <button class="hx-btn" type="submit"><?=$register?'Hesap oluştur ve indirmelere geç':'Giriş yap'?></button>
                <p class="ac-switch"><?=$register?'Zaten bir hesabınız var mı?':'Henüz bir hesabınız yok mu?'?> <a href="<?=$register?'/giris':'/kayit'?>"><?=$register?'Giriş yapın':'Hemen kayıt olun'?></a></p>
            </form>
            <p class="ac-note">Müşteri hesapları sitedeki indirmeler içindir. Veniux sahibi siteye merkezi yönetici hesabıyla giriş yapar. İşletme kullanıcılarını programın içinde oluşturursunuz. E-posta ve işletme adınız hesap hizmeti için saklanır; şifreniz özetlenerek korunur.</p>
        </div>
    </div>
<?php endif;?>
</main>

<?php require __DIR__.'/components/footer.php'; ?>
</body>
</html><?php
    return true;
}
