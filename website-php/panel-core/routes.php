<?php
declare(strict_types=1);
// Panel giriş noktası: index.php oturumu başlattıktan sonra çağırır.
require_once __DIR__.'/bootstrap.php';
require_once __DIR__.'/ui.php';
require_once __DIR__.'/accounts-bridge.php';
require_once __DIR__.'/authority-sync.php';
require_once __DIR__.'/payments.php';
require_once __DIR__.'/notify.php';
require_once __DIR__.'/admin.php';
require_once __DIR__.'/client.php';

/** Ödeme sağlayıcısı geri dönüşleri: oturum ve CSRF gerektirmez, her biri kendi imzası/sorgusuyla doğrulanır. */
function vpPaymentRoutes(string $path): bool {
    header_remove('X-Powered-By');header('X-Robots-Tag: noindex, nofollow');header('Cache-Control: no-store');
    try{
        vp_db();vp_notify_flush_on_shutdown();
        if($path==='/odeme/paytr/bildirim'){
            if(!vp_is_post()){http_response_code(405);header('Allow: POST');echo 'POST only';return true;}
            vp_paytr_callback();return true;
        }
        if($path==='/odeme/iyzico/donus'){
            $iid=vp_iyzico_return();
            vp_redirect($iid?'/panel/faturalar/'.$iid.'?odeme=1':'/panel/faturalar');
        }
        if($path==='/odeme/sonuc'){
            // PayTR başarı/başarısız sayfası çerçevenin içinde açılır; üst pencereyi faturaya taşır.
            $oid=preg_replace('/[^A-Za-z0-9]/','',(string)($_GET['oid']??''));
            $a=$oid!==''?vp_row('SELECT invoice_id FROM payment_attempts WHERE oid=?',[$oid]):null;
            $to=$a?'/panel/faturalar/'.(int)$a['invoice_id'].'?odeme=1':'/panel/faturalar';
            $nonce=base64_encode(random_bytes(16));
            header("Content-Security-Policy: default-src 'none'; script-src 'nonce-{$nonce}'; style-src 'unsafe-inline'; frame-ancestors 'self' https://www.paytr.com; base-uri 'none'",true);
            header_remove('X-Frame-Options');header('Content-Type: text/html; charset=utf-8');
            echo '<!doctype html><html lang="tr"><meta charset="utf-8"><title>Ödeme</title><body style="font:16px system-ui;padding:24px;color:#17263a;background:#f4eee2"><p>Faturanıza yönlendiriliyorsunuz…</p><p><a href="'.e($to).'" target="_top">Devam etmek için tıklayın</a></p><script nonce="'.$nonce.'">try{window.top.location.href='.json_encode($to).';}catch(e){location.href='.json_encode($to).';}</script></body></html>';
            return true;
        }
        http_response_code(404);echo 'Bulunamadı';return true;
    }catch(Throwable $t){
        error_log('[veniux-panel] payment route: '.$t->getMessage());
        http_response_code(500);echo 'Hata';return true;
    }
}

function vpRoutes(string $path,array $config): bool {
    $isAdmin=$path==='/yonetim'||str_starts_with($path,'/yonetim/');
    $isClient=$path==='/panel'||str_starts_with($path,'/panel/');
    $acc=$_SESSION['download_account']??null;
    // Eski müşteri paneli adresleri yeni panele gider.
    if(in_array($_SERVER['REQUEST_METHOD']??'GET',['GET','HEAD'],true)){
        if($path==='/hesap'&&$acc){$map=['lisans'=>'/panel/lisanslar','lisanslarim'=>'/panel/lisanslar','faturalar'=>'/panel/faturalar','faturalarim'=>'/panel/faturalar','talepler'=>'/panel/destek','taleplerim'=>'/panel/destek','destek'=>'/panel/destek','guvenlik'=>'/panel/profil','indirmeler'=>'/panel/indirmeler'];vp_redirect($map[(string)($_GET['tab']??'')]??'/panel');}
        if($path==='/indir'&&$acc)vp_redirect('/panel/indirmeler');
    }
    if(str_starts_with($path,'/odeme/'))return vpPaymentRoutes($path);
    if(!$isAdmin&&!$isClient)return false;
    if(($_SERVER['HTTPS']??'')!=='on'&&getenv('VENIUX_SITE_ENV')!=='development'&&!in_array($_SERVER['REMOTE_ADDR']??'',['127.0.0.1','::1'],true)){
        if(vp_is_post()){http_response_code(403);echo 'Panel için HTTPS bağlantısı gerekli.';return true;}
        header('Location: '.$config['url'].$path,true,301);return true;
    }
    header_remove('X-Powered-By');
    try{
        vp_db();vp_notify_flush_on_shutdown();
        return $isAdmin?vpAdminRoute($path,$config):vpClientRoute($path,$config);
    }catch(Throwable $t){
        error_log('[veniux-panel] '.$t->getMessage().' @ '.$t->getFile().':'.$t->getLine());
        if(!headers_sent())http_response_code(503);
        vp_doc_start('Panel kullanılamıyor');
        echo '<main class="vp-content" id="vp-content">'.vp_empty('Panel şu anda kullanılamıyor.',getenv('VENIUX_SITE_ENV')==='development'||in_array($_SERVER['REMOTE_ADDR']??'',['127.0.0.1','::1'],true)?$t->getMessage():'Lütfen biraz sonra tekrar deneyin.','<a class="vp-btn" href="/">Siteye dön</a>').'</main></body></html>';
        return true;
    }
}
