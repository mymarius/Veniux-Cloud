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
    <link rel="stylesheet" href="/assets/premium-dark.css">
    <link rel="stylesheet" href="/assets/veniux-site.css">
</head>
<body style="background-color:#12161f; color:#e8ecf4;">
<header class="dp-header">
    <div class="dp-container dp-nav">
        <a class="dp-brand" href="/" aria-label="Veniux ana sayfa">
            <img class="dp-brand-logo" src="/assets/logo-40-v1.webp" alt="Veniux logosu" width="36" height="36">
            <span>VENIUX</span>
        </a>
        <div class="dp-nav-actions">
            <?php if($account):?>
                <span class="dp-pill-text" style="color:#aab4c6; font-size:13px;"><?=e($account['company'])?></span>
                <form action="/cikis" method="post" style="margin:0; display:inline;">
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

<main class="dp-container dp-portal" id="main">
<?php if($isPortal):?>
    <div class="dp-portal-layout">
        <!-- Sidebar Navigation -->
        <aside class="dp-portal-nav">
            <div class="dp-portal-user-summary">
                <span class="dp-portal-user-company"><?=e($account['company'])?></span>
                <span class="dp-portal-user-email"><?=e($account['email'])?></span>
                <span style="display:inline-block; margin-top:8px; font-size:11px; padding:2px 8px; border-radius:9999px; background:#f2711c; color:#fff; font-weight:700;">
                    <?=e($permissions['name'])?> Paketi
                </span>
            </div>
            <nav class="dp-portal-menu" aria-label="Müşteri paneli bölümleri">
                <a class="dp-portal-menu-link <?=$currentTab==='genel-bakis'?'active':''?>" href="/hesap?tab=genel-bakis">
                    <span aria-hidden="true">▣</span> Genel Bakış
                </a>
                <a class="dp-portal-menu-link <?=$currentTab==='lisanslarim'?'active':''?>" href="/hesap?tab=lisanslarim">
                    <span aria-hidden="true">🔑</span> Lisanslarım
                </a>
                <a class="dp-portal-menu-link <?=$currentTab==='paketim'?'active':''?>" href="/hesap?tab=paketim">
                    <span aria-hidden="true">📦</span> Paketim
                </a>
                <a class="dp-portal-menu-link <?=$currentTab==='faturalarim'?'active':''?>" href="/hesap?tab=faturalarim">
                    <span aria-hidden="true">📑</span> Faturalarım
                </a>
                <a class="dp-portal-menu-link <?=$currentTab==='indirmeler'?'active':''?>" href="/indir">
                    <span aria-hidden="true">↓</span> İndirmeler
                </a>
                <a class="dp-portal-menu-link <?=$currentTab==='taleplerim'?'active':''?>" href="/hesap?tab=taleplerim">
                    <span aria-hidden="true">💬</span> Taleplerim
                </a>
                <a class="dp-portal-menu-link <?=$currentTab==='guvenlik'?'active':''?>" href="/hesap?tab=guvenlik">
                    <span aria-hidden="true">🛡️</span> Hesap Güvenliği
                </a>
                <a class="dp-portal-menu-link <?=$currentTab==='bildirimler'?'active':''?>" href="/hesap?tab=bildirimler">
                    <span aria-hidden="true">🔔</span> Bildirimler
                </a>
                <a class="dp-portal-menu-link <?=$currentTab==='destek'?'active':''?>" href="/hesap?tab=destek">
                    <span aria-hidden="true">🎧</span> Destek
                </a>
            </nav>
        </aside>

        <!-- Main Panel Content -->
        <div class="dp-portal-main">
            <?php if($error):?><div class="dp-toast dp-toast--error" style="background:#3a141a; border:1px solid #73232b; color:#ff9da8; padding:12px 18px; border-radius:10px; margin-bottom:20px;"><?=e($error)?></div><?php endif;?>

            <?php if($currentTab==='genel-bakis'):?>
                <section class="dp-panel-card">
                    <div class="dp-panel-header">
                        <h1 class="dp-panel-title">Genel Bakış</h1>
                        <span style="font-size:12px; color:#2CA58D; font-weight:700;">● Sistem Aktif & Lisanslı</span>
                    </div>
                    <p style="color:#aab4c6; font-size:14px; margin-bottom:24px;">Hoş geldiniz, <?=e($account['company'])?>. İşletmenizin Veniux kurulum detayları ve lisans durumu aşağıda özetlenmiştir.</p>
                    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:18px; margin-bottom:32px;">
                        <div style="background:#212838; padding:20px; border-radius:12px; border:1px solid #2d3547;">
                            <span style="font-size:11px; text-transform:uppercase; color:#aab4c6; font-weight:700;">Tanımlı Paket</span>
                            <strong style="display:block; font-size:20px; color:#e8ecf4; margin-top:6px;"><?=e($permissions['name'])?></strong>
                            <small style="color:#2CA58D; font-size:12px;">Yıllık Lisans Kapsamında</small>
                        </div>
                        <div style="background:#212838; padding:20px; border-radius:12px; border:1px solid #2d3547;">
                            <span style="font-size:11px; text-transform:uppercase; color:#aab4c6; font-weight:700;">Cihaz / Terminal Sınırı</span>
                            <strong style="display:block; font-size:20px; color:#e8ecf4; margin-top:6px;"><?=$permissions['max_devices']?> Terminal</strong>
                            <small style="color:#aab4c6; font-size:12px;">Windows & Android Bağlantısı</small>
                        </div>
                        <div style="background:#212838; padding:20px; border-radius:12px; border:1px solid #2d3547;">
                            <span style="font-size:11px; text-transform:uppercase; color:#aab4c6; font-weight:700;">Depo Kapsamı</span>
                            <strong style="display:block; font-size:20px; color:#e8ecf4; margin-top:6px;"><?=$permissions['max_depo']?> Depo</strong>
                            <small style="color:#aab4c6; font-size:12px;">Raf ve WMS Erişimi</small>
                        </div>
                    </div>
                    <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
                        <a href="/dosya/windows" class="dp-btn dp-btn--primary">Windows Programını İndir ↓</a>
                        <a href="/dosya/android" class="dp-btn dp-btn--outline">Android APK İndir ↓</a>
                        <a href="/hesap?tab=paketim" class="dp-btn dp-btn--ghost">Modül Yetkilerini İncele →</a>
                    </div>
                </section>

            <?php elseif($currentTab==='lisanslarim'):?>
                <section class="dp-panel-card">
                    <div class="dp-panel-header">
                        <h1 class="dp-panel-title">Lisanslarım</h1>
                        <span style="color:#2CA58D; font-size:12px; font-weight:700;">1 Aktif Anahtar</span>
                    </div>
                    <p style="color:#aab4c6; font-size:14px; margin-bottom:20px;">Veniux masaüstü programınızı veya mobil terminallerinizi etkinleştirmek için aşağıdaki anahtarı kullanın.</p>
                    <div style="background:#12161f; border:1px solid #2d3547; border-radius:12px; padding:24px; margin-bottom:24px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                            <div>
                                <span style="font-size:11px; color:#aab4c6; text-transform:uppercase; font-weight:700;">Birincil Ürün Anahtarı</span>
                                <div style="font-family:ui-monospace,monospace; font-size:18px; font-weight:750; color:#ff9a5c; margin-top:4px; letter-spacing:0.06em;">
                                    <?=e($account['license_key']??'VNX-2026-PRECISION-ENTERPRISE')?>
                                </div>
                            </div>
                            <span style="background:rgba(44,165,141,0.2); border:1px solid #2CA58D; color:#2CA58D; padding:6px 14px; border-radius:9999px; font-size:12px; font-weight:700;">
                                Etkin & Doğrulanmış
                            </span>
                        </div>
                        <div style="margin-top:18px; padding-top:16px; border-top:1px solid #212838; font-size:12px; color:#aab4c6; display:flex; gap:24px;">
                            <span>Cihaz Kotası: <strong><?=$permissions['max_devices']?> Cihaz</strong></span>
                            <span>Kullanıcı Sınırı: <strong><?=$permissions['max_user']?> Kullanıcı</strong></span>
                            <span>Durum: <strong>Süresiz / Kurumsal</strong></span>
                        </div>
                    </div>
                    <p style="font-size:12px; color:#64748B;">Lisans anahtarları donanım parmak izi (fingerprint) ile eşleşir ve yetkisiz kopyalamayı engellemek için merkezi sunucu üzerinden imzalanır.</p>
                </section>

            <?php elseif($currentTab==='paketim'):?>
                <section class="dp-panel-card">
                    <div class="dp-panel-header">
                        <h1 class="dp-panel-title">Paketim ve Modül Yetkileri</h1>
                        <span style="background:#212838; border:1px solid #2d3547; color:#e8ecf4; padding:4px 12px; border-radius:9999px; font-size:12px; font-weight:700;">
                            <?=e($permissions['name'])?> Seviyesi
                        </span>
                    </div>
                    <p style="color:#aab4c6; font-size:14px; margin-bottom:24px;">Bu hesap için sunucu tarafında doğrulanmış modül erişim tablosu aşağıdadır. Yetkiler lisans otoritesi tarafından kontrol edilir.</p>
                    <div style="border:1px solid #2d3547; border-radius:12px; overflow:hidden;">
                        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13.5px;">
                            <thead>
                                <tr style="background:#212838; color:#e8ecf4; border-bottom:1px solid #2d3547;">
                                    <th style="padding:14px 18px;">Modül Adı</th>
                                    <th style="padding:14px 18px;">İşlev Kapsamı</th>
                                    <th style="padding:14px 18px; text-align:right;">Yetki Durumu</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom:1px solid #212838;">
                                    <td style="padding:14px 18px; font-weight:650; color:#e8ecf4;">Veniux CRM</td>
                                    <td style="padding:14px 18px; color:#aab4c6;">Müşteri kartları, borç/alacak, görüşme ve satış fırsatları</td>
                                    <td style="padding:14px 18px; text-align:right; color:#2CA58D; font-weight:700;">✓ Erişilebilir</td>
                                </tr>
                                <tr style="border-bottom:1px solid #212838;">
                                    <td style="padding:14px 18px; font-weight:650; color:#e8ecf4;">Veniux Stok & Envanter</td>
                                    <td style="padding:14px 18px; color:#aab4c6;">Ürün barkod kataloğu, lot/miat, kritik seviye takibi</td>
                                    <td style="padding:14px 18px; text-align:right; color:#2CA58D; font-weight:700;">✓ Erişilebilir</td>
                                </tr>
                                <tr style="border-bottom:1px solid #212838;">
                                    <td style="padding:14px 18px; font-weight:650; color:#e8ecf4;">Veniux Depo & WMS</td>
                                    <td style="padding:14px 18px; color:#aab4c6;">Mal kabul, raf yerleşimi, palet barkodlama, transferler</td>
                                    <td style="padding:14px 18px; text-align:right; color:#2CA58D; font-weight:700;">✓ Erişilebilir</td>
                                </tr>
                                <tr style="border-bottom:1px solid #212838;">
                                    <td style="padding:14px 18px; font-weight:650; color:#e8ecf4;">Veniux Market / POS</td>
                                    <td style="padding:14px 18px; color:#aab4c6;">Dokunmatik hızlı satış, barkodlu okuma, fiş/fatura yazdırma</td>
                                    <td style="padding:14px 18px; text-align:right; color:#2CA58D; font-weight:700;">✓ Erişilebilir</td>
                                </tr>
                                <tr style="border-bottom:1px solid #212838;">
                                    <td style="padding:14px 18px; font-weight:650; color:#e8ecf4;">Veniux Satış Yönetimi</td>
                                    <td style="padding:14px 18px; color:#aab4c6;">B2B/B2C siparişler, teklifler, iskonto ve vade operasyonları</td>
                                    <td style="padding:14px 18px; text-align:right; color:#2CA58D; font-weight:700;">✓ Erişilebilir</td>
                                </tr>
                                <tr style="border-bottom:1px solid #212838;">
                                    <td style="padding:14px 18px; font-weight:650; color:#e8ecf4;">Veniux Raporlama</td>
                                    <td style="padding:14px 18px; color:#aab4c6;">Ciro grafikleri, net kârlılık, devir hızı ve gün sonu z-raporu</td>
                                    <td style="padding:14px 18px; text-align:right; color:#2CA58D; font-weight:700;">✓ Erişilebilir</td>
                                </tr>
                                <tr>
                                    <td style="padding:14px 18px; font-weight:650; color:#e8ecf4;">Veniux Intelligence</td>
                                    <td style="padding:14px 18px; color:#aab4c6;">Yapay zekâ stok tahminleri, anomali tespiti ve karar desteği</td>
                                    <td style="padding:14px 18px; text-align:right; color:<?=$permissions['intelligence']?'#2CA58D':'#aab4c6'?>; font-weight:700;">
                                        <?=$permissions['intelligence']?'✓ Erişilebilir':'Paket Yükseltme Gerekli'?>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

            <?php elseif($currentTab==='faturalarim'):?>
                <section class="dp-panel-card">
                    <div class="dp-panel-header">
                        <h1 class="dp-panel-title">Faturalarım ve Ödemeler</h1>
                        <span style="color:#aab4c6; font-size:12px;">Resmî e-Fatura Kayıtları</span>
                    </div>
                    <p style="color:#aab4c6; font-size:14px; margin-bottom:20px;">Veniux yazılım lisansı ve ek hizmet bedellerine ait faturalar aşağıda listelenmiştir.</p>
                    <div style="border:1px solid #2d3547; border-radius:12px; overflow:hidden;">
                        <table style="width:100%; border-collapse:collapse; font-size:13.5px; text-align:left;">
                            <thead>
                                <tr style="background:#212838; color:#e8ecf4;">
                                    <th style="padding:12px 16px;">Fatura No</th>
                                    <th style="padding:12px 16px;">Tarih</th>
                                    <th style="padding:12px 16px;">Açıklama</th>
                                    <th style="padding:12px 16px;">Tutar</th>
                                    <th style="padding:12px 16px; text-align:right;">Durum</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom:1px solid #212838;">
                                    <td style="padding:14px 16px; font-family:ui-monospace,monospace; color:#e8ecf4;">VNX-2026-0084</td>
                                    <td style="padding:14px 16px; color:#aab4c6;">18 Ekim 2026</td>
                                    <td style="padding:14px 16px; color:#e8ecf4;">Veniux İşletme Yıllık Lisansı (%20 KDV dahil)</td>
                                    <td style="padding:14px 16px; font-weight:700; color:#e8ecf4;">7.188 ₺</td>
                                    <td style="padding:14px 16px; text-align:right; color:#2CA58D; font-weight:700;">Ödendi ✓</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p style="font-size:12px; color:#64748B; margin-top:16px;">Online tahsilat yapılmaz; faturalar kurumsal banka havalesi / EFT mutabakatı sonrası muhasebeleştirilir.</p>
                </section>

            <?php elseif($currentTab==='indirmeler'):?>
                <section class="dp-panel-card">
                    <div class="dp-panel-header">
                        <h1 class="dp-panel-title">Programınızı İndirin</h1>
                        <span style="font-size:12px; color:#f2711c; font-weight:700;">Güncel Sürüm 2.4.38</span>
                    </div>
                    <p class="download-intro" style="color:#aab4c6; font-size:14px; margin-bottom:28px;">
                        Windows programı işletmenizin verilerini bilgisayarınızda tutar. Android telefon/tablet uygulaması aynı ağdaki bilgisayarınıza bağlanır.
                    </p>
                    <div class="download-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:32px;">
                        <article style="background:#212838; border:1px solid #2d3547; border-radius:14px; padding:28px;">
                            <span class="eyebrow" style="color:#f2711c; font-weight:700; font-size:11px; text-transform:uppercase;">BİLGİSAYAR</span>
                            <h2 style="font-size:22px; color:#e8ecf4; margin:8px 0 12px 0;">Veniux Windows</h2>
                            <p style="color:#aab4c6; font-size:13.5px; line-height:1.6; margin-bottom:20px;">
                                Windows 10/11, 64 bit. Stok ve depo yönetimi bilgisayarınızda. Yerel SQLite veya MySQL motoru desteği.
                            </p>
                            <a class="button primary dp-btn dp-btn--primary" href="/dosya/windows">Windows programını indir ↓</a>
                        </article>
                        <article style="background:#212838; border:1px solid #2d3547; border-radius:14px; padding:28px;">
                            <span class="eyebrow" style="color:#ff9a5c; font-weight:700; font-size:11px; text-transform:uppercase;">TELEFON, TABLET VE EL TERMİNALİ</span>
                            <h2 style="font-size:22px; color:#e8ecf4; margin:8px 0 12px 0;">Veniux Android</h2>
                            <p style="color:#aab4c6; font-size:13.5px; line-height:1.6; margin-bottom:20px;">
                                Android 8 ve üzeri. Barkod tarama destekli mobil terminal arayüzü ile sahadan anında stok girişi ve sayım.
                            </p>
                            <a class="button primary dp-btn dp-btn--accent" href="/dosya/android">Android uygulamasını indir ↓</a>
                        </article>
                    </div>
                    <div style="font-size:13px; color:#aab4c6; border-top:1px solid #2d3547; padding-top:18px;">
                        <a class="text-link" href="/guncelleme-notlari" style="color:#f2711c;">Güncelleme notlarını incele →</a> · 
                        <a class="text-link" href="/surum-arsivi" style="color:#f2711c;">Tüm sürümler</a>
                    </div>
                    <div style="margin-top:28px;">
                        <?php require __DIR__.'/terminal-guide.php'; ?>
                    </div>
                </section>

            <?php elseif($currentTab==='taleplerim'):?>
                <section class="dp-panel-card">
                    <div class="dp-panel-header">
                        <h1 class="dp-panel-title">Taleplerim</h1>
                        <span style="color:#aab4c6; font-size:12px;">Görüşme ve Destek Talepleri</span>
                    </div>
                    <p style="color:#aab4c6; font-size:14px; margin-bottom:20px;">Gönderdiğiniz demo talepleri, teklif başvuruları ve destek biletleri bu alanda listelenir.</p>
                    <div style="background:#12161f; border:1px solid #2d3547; border-radius:12px; padding:20px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <strong style="color:#e8ecf4; display:block; font-size:15px;">Kurulum & Entegrasyon Danışmanlığı</strong>
                                <small style="color:#aab4c6;">Talep ID: #REQ-<?=substr($account['id'],0,8)?> · Kayıt Tarihi: <?=substr($account['created_at']??'2026-10-20',0,10)?></small>
                            </div>
                            <span style="background:rgba(22,119,200,0.2); border:1px solid #f2711c; color:#f2711c; padding:4px 12px; border-radius:9999px; font-size:11.5px; font-weight:700;">
                                İnceleniyor
                            </span>
                        </div>
                    </div>
                </section>

            <?php elseif($currentTab==='guvenlik'):?>
                <section class="dp-panel-card">
                    <div class="dp-panel-header">
                        <h1 class="dp-panel-title">Hesap Güvenliği</h1>
                        <span style="color:#2CA58D; font-size:12px; font-weight:700;">Oturum Güvenli</span>
                    </div>
                    <p style="color:#aab4c6; font-size:14px; margin-bottom:24px;">Şifrenizi ve oturum erişim parametrelerinizi bu ekrandan yönetebilirsiniz.</p>
                    <div style="max-width:480px;">
                        <div class="dp-form-group">
                            <label class="dp-label">Mevcut E-posta Adresi</label>
                            <input class="dp-input" type="text" value="<?=e($account['email'])?>" disabled style="opacity:0.7;">
                        </div>
                        <div class="dp-form-group">
                            <label class="dp-label">Şifre Değiştirme</label>
                            <input class="dp-input" type="password" placeholder="Yeni şifrenizi girin (en az 14 karakter)">
                            <small style="color:#64748B; font-size:11.5px; display:block; margin-top:4px;">14–72 karakter uzunluğunda olmalıdır.</small>
                        </div>
                        <button type="button" class="dp-btn dp-btn--primary dp-btn--sm">Şifreyi Güncelle</button>
                    </div>
                </section>

            <?php elseif($currentTab==='bildirimler'):?>
                <section class="dp-panel-card">
                    <div class="dp-panel-header">
                        <h1 class="dp-panel-title">Bildirimler</h1>
                        <span style="color:#f2711c; font-size:12px; font-weight:700;">Sistem Güncel</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:14px;">
                        <div style="background:#212838; border:1px solid #2d3547; padding:16px 20px; border-radius:10px;">
                            <strong style="color:#e8ecf4; display:block; font-size:14px; margin-bottom:4px;">Veniux 2.4.38 Yayında</strong>
                            <p style="color:#aab4c6; font-size:12.5px; margin:0; line-height:1.5;">Dark Precision arayüz standartları, WMS lot kontrol iyileştirmeleri ve hızlandırılmış barkod tarama motoru dağıtıma eklendi.</p>
                            <small style="color:#64748B; font-size:11px; margin-top:6px; display:block;">19 Ekim 2026</small>
                        </div>
                    </div>
                </section>

            <?php elseif($currentTab==='destek'):?>
                <section class="dp-panel-card">
                    <div class="dp-panel-header">
                        <h1 class="dp-panel-title">Teknik Destek</h1>
                        <span style="color:#ff9a5c; font-size:12px; font-weight:700;">Doğrudan Erişim</span>
                    </div>
                    <p style="color:#aab4c6; font-size:14px; margin-bottom:24px;">Veniux teknik ekibiyle doğrudan iletişime geçin veya dokümantasyonu inceleyin.</p>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                        <div style="background:#212838; border:1px solid #2d3547; border-radius:12px; padding:20px;">
                            <h3 style="color:#e8ecf4; font-size:16px; margin:0 0 8px 0;">E-posta Desteği</h3>
                            <p style="color:#aab4c6; font-size:13px; margin:0 0 14px 0;">Kurulum, donanım köprüsü ve lisanslama ile ilgili sorularınız için.</p>
                            <a href="mailto:destek@veniux.com" class="dp-btn dp-btn--outline dp-btn--sm">destek@veniux.com</a>
                        </div>
                        <div style="background:#212838; border:1px solid #2d3547; border-radius:12px; padding:20px;">
                            <h3 style="color:#e8ecf4; font-size:16px; margin:0 0 8px 0;">Topluluk & Canlı Sohbet</h3>
                            <p style="color:#aab4c6; font-size:13px; margin:0 0 14px 0;">Resmî Discord sunucumuza katılarak teknik gelişmelerden haberdar olun.</p>
                            <a href="https://discord.gg/WQyxdp7MKW" target="_blank" rel="noopener noreferrer" class="dp-btn dp-btn--accent dp-btn--sm">Discord'a Katıl ↗</a>
                        </div>
                    </div>
                </section>
            <?php endif;?>
        </div>
    </div>

<?php else:?>
    <!-- Unauthenticated Login / Register Form in Dark Precision -->
    <div style="max-width:440px; margin:40px auto; background:#1a2030; border:1px solid #2d3547; border-radius:20px; padding:40px; box-shadow:0 16px 48px rgba(0,0,0,0.6);">
        <p class="dp-eyebrow"><span class="dp-eyebrow-dot"></span> BİLGİSAYAR VE ANDROID</p>
        <h1 class="dp-h2" style="font-size:26px; margin-bottom:8px;"><?=e($title)?></h1>
        <p style="color:#aab4c6; font-size:13.5px; margin-bottom:28px;">
            <?=$register?'İşletmenizi kaydedin ve Veniux indirme merkezine hemen erişin.':'Hesabınıza giriş yaparak lisanslarınızı ve kurulum paketlerinizi yönetin.'?>
        </p>

        <?php if($error):?>
            <div style="background:#3a141a; border:1px solid #73232b; color:#ff9da8; padding:12px 16px; border-radius:10px; font-size:13px; margin-bottom:20px;" role="alert">
                <?=e($error)?>
            </div>
        <?php endif;?>

        <form class="account-form" action="<?=$register?'/kayit':'/giris'?>" method="post">
            <input type="hidden" name="csrf" value="<?=e($_SESSION['account_csrf'])?>">
            <?php if($register):?>
                <div class="dp-form-group">
                    <label class="dp-label">İşletme Adı</label>
                    <input class="dp-input" name="company" required maxlength="160" autocomplete="organization" placeholder="Firma veya mağaza adınız">
                </div>
            <?php endif;?>
            <div class="dp-form-group">
                <label class="dp-label">E-posta Adresi</label>
                <input class="dp-input" name="email" type="email" required maxlength="190" autocomplete="email" placeholder="ornek@isletme.com">
            </div>
            <div class="dp-form-group">
                <label class="dp-label">Şifre</label>
                <input class="dp-input" name="password" type="password" required minlength="14" maxlength="72" autocomplete="<?=$register?'new-password':'current-password'?>" placeholder="••••••••••••••">
                <small style="color:#64748B; font-size:11.5px; display:block; margin-top:4px;">En az 14 karakter uzunluğunda olmalıdır.</small>
            </div>
            <button class="dp-btn dp-btn--primary" style="width:100%; margin-top:8px;" type="submit">
                <?=$register?'Hesap Oluştur ve İndirmelere Geç':'Giriş Yap'?>
            </button>
            <p style="text-align:center; font-size:13px; color:#aab4c6; margin-top:20px;">
                <?=$register?'Zaten bir hesabınız var mı?':'Henüz bir hesabınız yok mu?'?>
                <a href="<?=$register?'/giris':'/kayit'?>" style="color:#ff9a5c; font-weight:700;">
                    <?=$register?'Giriş yapın':'Hemen kayıt olun'?>
                </a>
            </p>
        </form>

        <p class="download-note" style="margin-top:28px; padding-top:20px; border-top:1px solid #212838; font-size:11.5px; color:#64748B; line-height:1.6;">
            Müşteri hesapları sitedeki indirmeler içindir. Veniux sahibi siteye merkezi yönetici hesabıyla giriş yapar. İşletme kullanıcılarını programın içinde oluşturursunuz. E-posta ve işletme adınız hesap hizmeti için saklanır; şifreniz özetlenerek korunur.
        </p>
    </div>
<?php endif;?>
</main>

<footer class="dp-footer">
    <div class="dp-container dp-footer-bottom">
        <div>© <?=date('Y')?> Veniux. Tüm hakları saklıdır.</div>
        <div style="display:flex; gap:20px; flex-wrap:wrap;">
            <a href="/">Ana Sayfa</a>
            <a href="/fiyatlandirma">Fiyatlandırma</a>
            <a href="/program-indir">İndir</a>
            <a href="/kullanim-kosullari">Kullanım Koşulları</a>
            <a href="/gizlilik-politikasi">Gizlilik</a>
            <a href="/kvkk-aydinlatma">KVKK</a>
        </div>
    </div>
</footer>
<?php require __DIR__.'/cookie-consent.php'; ?>
</body>
</html><?php
    return true;
}
