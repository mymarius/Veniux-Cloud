<?php
declare(strict_types=1);
$config = require __DIR__ . '/config.php';
require_once __DIR__.'/requestFirewall.php';
veniuxRequestFirewall(dirname($config['request_dir']).'/request-firewall','site');
$config['app_url']='/indir';
require_once __DIR__ . '/pricing.php';
require_once __DIR__ . '/seo.php';
require_once __DIR__ . '/sponsor.php';
require_once __DIR__ . '/components/components.php';
require_once __DIR__ . '/components/objects.php';

function e(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
require_once __DIR__.'/whatsapp.php';

$pages = [
 '/surum-arsivi' => ['title'=>'Windows ve Android Sürüm Arşivi | Veniux Cloud','description'=>'Veniux Windows ve Android kurulum paketlerini sürüm numarası, dosya boyutu ve SHA-256 özetiyle inceleyin.','label'=>'Sürüm arşivi','headline'=>'','intro'=>''],
 '/sunucu-kurulumu' => ['title'=>'Veniux Kurulum Seçenekleri | Otomatik ve Ayrı Sunucu','description'=>'Veniux Windows kurulumunda otomatik yerel kurulum veya ayrı sunucu bağlantısını seçin. Hostimux sponsorlu tanıtımı ve sunucu hazırlık adımları.','label'=>'Sunucu kurulumu','headline'=>'','intro'=>''],
 '/guncelleme-notlari' => ['title'=>'Güncelleme Notları | Veniux Windows ve Android','description'=>'Veniux Windows, Android, site ve API güncelleme geçmişi. Yeni özellikleri, güncellenen işlevleri ve sürüm düzeltmelerini tarihleriyle inceleyin.','label'=>'Güncelleme notları','headline'=>'','intro'=>''],
 '/program-indir' => ['title'=>'Veniux İndir | Windows Stok Programı ve Android Uygulaması','description'=>'Veniux Windows stok ve depo programını, Android telefon/tablet uygulamasını indirin. Aynı işletme kayıtları, yerel ağ bağlantısı ve lisanslı kullanım.','label'=>'PROGRAM İNDİR','headline'=>'Bilgisayarda yönet.<br>Mobilde <em>takip et.</em>','intro'=>'Windows stok ve depo programı. Bilgisayardaki aynı verilere bağlanan Android telefon ve tablet uygulaması.'],
 '/fiyatlandirma' => ['title'=>'Veniux Fiyatlandırma | 3 Aylık ve Yıllık Stok Yönetim Planları','description'=>'Veniux Başlangıç, İşletme ve Kurumsal paketlerini karşılaştırın. 3 aylık ve yıllık TL fiyatlarını, depo ve kullanıcı sınırlarını inceleyin.','label'=>'Fiyatlandırma','headline'=>'İşinize uygun plan.','intro'=>'3 aylık ve yıllık Veniux Cloud paketleri.'],
 '/' => ['title'=>'Veniux Cloud | Stok Takip, Depo ve Kasa Programı','description'=>'Veniux Cloud ile ürün bitmeden haberiniz olsun: sipariş önerisi, sayım farkı ve kayıp şüphesi uyarısı, barkodlu hızlı sayım. Stok, depo ve kasa Windows ve Android üzerinde tek yerde. Demo isteyin.','label'=>'İŞİNİZİ DAHA İLERİYE TAŞIYIN','headline'=>'İşletmenizin tüm akışı.<br><span class="text-accent">Tek bir Veniux.</span>','intro'=>'Veniux; CRM, stok, depo, market/POS, satın alma, satış ve işletme yönetimini tek bir ekosistemde birleştirir. Operasyonlarınızı daha hızlı, kontrollü ve verimli yönetin.'],
 '/stok-yonetimi' => ['title'=>'Stok Takip Programı: Barkod ve Sipariş Önerisi | Veniux','description'=>'Barkodlu stok takibi, giriş-çıkış geçmişi, kritik seviye uyarısı ve tükenme hesabıyla sipariş önerisi. Veniux stok takip programını inceleyin.','label'=>'STOK YÖNETİMİ','headline'=>'Stoğu tahminle değil, kayıtla bilin.','intro'=>'Ürün kartı, barkod, giriş ve çıkış geçmişi tek yerde. Azalan ürün bitmeden önünüze gelir.'],
 '/depo-yonetimi' => ['title'=>'Depo Yönetim Programı: Mal Kabul ve Sayım | Veniux','description'=>'Mal kabul, raf yerleşimi, depolar arası transfer ve barkodlu hızlı sayım. Sayım farkını anında görün. Veniux depo yönetim programını inceleyin.','label'=>'DEPO YÖNETİMİ','headline'=>'Koli kapıya gelir, gerisi kayıtta.','intro'=>'Mal kabul, raf, toplama, sevkiyat ve transfer aynı akışta. Sayımda fark çıkarsa yönetici görür.'],
 '/lot-miat-takibi' => ['title'=>'Lot ve Son Kullanma Tarihi Takibi | Veniux','description'=>'Ürünleri parti ve son kullanma tarihiyle takip edin, yaklaşan tarihleri görün, lot ayrıntısına ulaşın. Veniux lot ve miat takibi.','label'=>'LOT VE MİAT TAKİBİ','headline'=>'Tarihi geçen mal rafta kalmasın.','intro'=>'Aynı ürünün partilerini ayrı izleyin, yaklaşan son kullanma tarihlerini zamanında görün.'],
 '/market-pos' => ['title'=>'Market Kasa Programı ve POS Satış Sistemi | Veniux','description'=>'Barkodlu satış, nakit, kart ve parçalı ödeme, vardiya, gün sonu ve iade. Kasadan yapılan satış stoktan anında düşer. Veniux market kasa programı.','label'=>'Market ve POS','headline'=>'Barkod okundu, stok düştü.','intro'=>'Kasiyer için hızlı, yönetici için kayıtlı. Vardiya, gün sonu ve iade aynı ekranda.'],
 '/yapay-zeka' => ['title'=>'Yapay Zekâ Destekli Operasyon Asistanı | Veniux','description'=>'Stok ve satış verileriniz hakkında soru sorun, önerilen işlemleri onaylayarak uygulayın. Değişiklikler onayınız olmadan yapılmaz.','label'=>'Operasyon asistanı','headline'=>'Kayıtlarınıza soru sorun.','intro'=>'Asistan stok, satın alma ve depo kayıtlarınızı özetler. Önerdiği işlemi ancak siz onaylarsanız yapar.'],
 '/demo' => ['title'=>'Veniux Demo | Stok ve Kasa Programını Deneyin','description'=>'Veniux ekosistemini birebir canlı demo görüşmesi ile işletmenizin süreçlerinde keşfedin.','label'=>'DEMO TALEP ET','headline'=>'Programı kendi işinizle görün.','intro'=>'Depo sayınızı ve ne aradığınızı yazın, Veniux’u sizin işinize göre gösterelim.']
];

$sectorPages = array_filter(require __DIR__.'/sector-pages.php', fn($p) => ($p['status'] ?? '') === 'published');
foreach($sectorPages as $route=>$sector){
    $pages[$route]=['title'=>$sector['title'],'description'=>$sector['description'],'label'=>$sector['headline'],'headline'=>$sector['headline'],'intro'=>$sector['subtitle'],'image'=>$sector['image'],'alt'=>$sector['alt'],'image_width'=>1366,'image_height'=>800];
}
$growthPages = require __DIR__.'/growth-pages.php';
foreach($growthPages as $route=>$guide){
    $pages[$route]=$guide;
    $pages[$route]['image_width']=1914;
    $pages[$route]['image_height']=860;
}
$pages['/depo-yonetimi']['image']='product-warehouse-v4.jpg';
$pages['/depo-yonetimi']['image_width']=1920;
$pages['/depo-yonetimi']['image_height']=863;
$pages['/depo-yonetimi']['alt']='Veniux depo ve tesis ekranı, sentetik örnek kayıtlar';
$pages['/lot-miat-takibi']['image']='product-lot-v4.jpg';
$pages['/lot-miat-takibi']['image_width']=1914;
$pages['/lot-miat-takibi']['image_height']=860;
$pages['/lot-miat-takibi']['alt']='Veniux ürün ekranında stok ve lot takibi paneli, sentetik örnek kayıtlar';

$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
if($path==='/eczane-stok-takibi'){header('Location: /stok-yonetimi',true,301);exit;}

$legalPages=require __DIR__.'/legal.php';
foreach($legalPages as $legalPath=>$legalPage){
    $pages[$legalPath]=[
        'title'=>$legalPage['title'].' | Veniux',
        'description'=>'Veniux '.$legalPage['title'].': site hesabı, hizmet kullanımı ve veri işleme hakkında bilgi.',
        'label'=>$legalPage['title'],
        'headline'=>'',
        'intro'=>''
    ];
}

$nonce = base64_encode(random_bytes(18));
$GLOBALS['nonce'] = $nonce;
$assetManifest=require __DIR__.'/asset-manifest.php';
$assetGroup=['/program-indir'=>'program','/fiyatlandirma'=>'pricing','/guncelleme-notlari'=>'notes','/surum-arsivi'=>'notes'][$path]??'main';

header_remove('X-Powered-By');
if(($_SERVER['HTTPS']??'')==='on')header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
$analyticsIds=require __DIR__.'/analytics-config.php';
$cspScript=$cspConnect=$cspImg='';
if(!empty($analyticsIds['ga'])){$cspScript.=' https://www.googletagmanager.com';$cspConnect.=' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com';$cspImg.=' https://www.google-analytics.com https://www.googletagmanager.com';}
if(!empty($analyticsIds['clarity'])){$cspScript.=' https://www.clarity.ms https://scripts.clarity.ms';$cspConnect.=' https://*.clarity.ms https://c.bing.com';$cspImg.=' https://*.clarity.ms https://c.bing.com';}
header("Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{$nonce}'{$cspScript}; connect-src 'self'{$cspConnect}; style-src 'self' 'nonce-{$nonce}'; img-src 'self' data:{$cspImg}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");

if ($path === '/robots.txt') { header('Content-Type: text/plain; charset=utf-8'); echo siteRobots($config); exit; }
if ($path === '/sitemap.xml') { header('Content-Type: application/xml; charset=utf-8'); echo siteSitemap($config,$pages); exit; }

$indexNowKey=getenv('VENIUX_INDEXNOW_KEY')?:'';
if(preg_match('/^[a-f0-9]{64}$/D',$indexNowKey)&&$path==='/'.$indexNowKey.'.txt'){
    header('X-Robots-Tag: noindex');header('Content-Type: text/plain; charset=utf-8');
    if(!in_array($_SERVER['REQUEST_METHOD'],['GET','HEAD'],true)){http_response_code(405);header('Allow: GET, HEAD');exit;}
    if($_SERVER['REQUEST_METHOD']==='GET')echo $indexNowKey;
    exit;
}

if ($path === '/structured-data.json') {
    header('Content-Type: application/ld+json; charset=utf-8');
    echo json_encode(['@context'=>'https://schema.org','@graph'=>[['@type'=>'Organization','@id'=>$config['url'].'/#organization','name'=>'Veniux','alternateName'=>'Veniux','url'=>$config['url'],'logo'=>$config['url'].'/assets/logo.png'],['@type'=>'WebSite','name'=>'Veniux','alternateName'=>'Veniux','url'=>$config['url'],'inLanguage'=>'tr-TR','publisher'=>['@id'=>$config['url'].'/#organization']]]], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    exit;
}

// Alan adının eski forum kullanımından kalan adresler (index.php?page=thread|category|profile...): kalıcı olarak kaldırıldı.
if (in_array($_SERVER['REQUEST_METHOD'],['GET','HEAD'],true) && $path==='/index.php' && isset($_GET['page'])) {
    http_response_code(410); header('X-Robots-Tag: noindex, nofollow'); header('Content-Type: text/plain; charset=utf-8'); echo "Bu adres kalıcı olarak kaldırıldı.
"; exit;
}

$trimmed = $path === '/' ? '/' : rtrim($path, '/');
if (in_array($_SERVER['REQUEST_METHOD'],['GET','HEAD'],true) && ($path==='/index.php' || ($trimmed!==$path && isset($pages[$trimmed])))) {
    header('Location: '.($path==='/index.php'?'/':$trimmed),true,301); exit;
}

if (!in_array($_SERVER['REQUEST_METHOD'],['GET','HEAD','POST'],true)) { http_response_code(405); header('Allow: GET, HEAD, POST'); exit; }
if ($_SERVER['REQUEST_METHOD']==='POST' && !in_array($path,['/','/kayit','/giris','/cikis','/demo'],true) && !str_starts_with($path,'/api/destek/')) { http_response_code(405); exit; }

ini_set('session.use_strict_mode','1');
$sessionDir=dirname($config['request_dir']).'/website-sessions';
if (!is_dir($sessionDir) && !@mkdir($sessionDir,0700,true)) { http_response_code(503); exit('Form güvenliği şu anda başlatılamıyor.'); }
session_save_path($sessionDir);
session_set_cookie_params(['httponly'=>true,'secure'=>($_SERVER['HTTPS']??'')==='on','samesite'=>'Lax']);
if (!@session_start()) { http_response_code(503); exit('Form güvenliği şu anda başlatılamıyor.'); }

$_SESSION['contact_token']=$_SESSION['contact_token']??bin2hex(random_bytes(32));
header('Cache-Control: no-store');

require_once __DIR__.'/accounts.php';
if(accountRoutes($path,$config))exit;
require_once __DIR__.'/livechat.php';
if(chatRoutes($path,$config))exit;

if ($path==='/contact-token' && $_SERVER['REQUEST_METHOD']==='GET') {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Robots-Tag: noindex, nofollow');
    echo json_encode(['token'=>$_SESSION['contact_token']]); exit;
}

require_once __DIR__.'/conversion.php';
$contactResult=null;$contactConversion=null;
if ($_SERVER['REQUEST_METHOD']==='POST') {
    require __DIR__.'/contact.php';
    $contactResult=contactSubmit($config);
    if($contactResult[0]){
        $_SESSION['contact_feedback']=$contactResult;
        header('Location: /?request=received#iletisim',true,303);
        exit;
    }
}elseif($path==='/'&&isset($_SESSION['contact_feedback'])){
    $contactResult=$_SESSION['contact_feedback'];
    unset($_SESSION['contact_feedback']);
    $contactConversion=siteTakeConversion();
}

$preserve=$contactResult && !$contactResult[0];
function formValue(string $key): string {
    global $preserve;
    return $preserve && is_string($_POST[$key]??null) ? e(substr($_POST[$key],0,254)) : '';
}

$notFound = !isset($pages[$path]);
if ($notFound) {
    http_response_code(404);
    $page=[
        'title'=>'Sayfa bulunamadı | Veniux',
        'description'=>'Aradığınız sayfa bulunamadı.',
        'label'=>'404',
        'headline'=>'Bu yol burada<br><em>sona eriyor.</em>',
        'intro'=>'Ana sayfadan Veniux çözümlerini keşfetmeye devam edin.'
    ];
} else {
    $page=$pages[$path];
}

$indexable = $config['indexable'] && !$notFound;
header('X-Robots-Tag: '.($indexable?'index, follow':'noindex, nofollow'));

$solutions=[
    ['01','Veniux CRM','Müşteri & Cari Takibi','Müşteri ilişkileri, potansiyel fırsatlar ve cari hesap yönetimi.','/stok-yonetimi'],
    ['02','Stok & Depo','Kusursuz Envanter','Ürün, barkod, lot/miat ve dinamik raf yönetimi.','/depo-yonetimi'],
    ['03','Market / POS','Hızlı & Güvenli Satış','Dokunmatik satış, barkodlu okuma, bilgi fişi yazdırma ve vardiya devri.','/market-pos']
];

$topics = [
 '/stok-yonetimi'=>['Stok yönetimini kayıtlarınızla birlikte düşünün.','Ürün kataloğunuzda barkod, birim ve fiyat bilgilerini bir arada tutun. Depo bazında miktarları inceleyin; stok hareketleri üzerinden ürünün giriş ve çıkış kayıtlarına ulaşın.','Satın alma ve ürün geçmişi','Satın alma siparişlerinin kabul adımlarını ve stok kayıtlarını takip edin. Lot bilgisi bulunan ürünlerde miktarın yanında parti ve son kullanma tarihini de değerlendirin. Barkod okuyucu bağlantısı, kullanılan cihaz ve platform desteğine bağlıdır.'],
 '/depo-yonetimi'=>['Mal kabulden sevkiyata kadar aynı kayıt zinciri.','Bir ürünün hangi depoya kabul edildiğini, nerede bulunduğunu ve hangi operasyonla taşındığını takip etmek depo düzeninin temelidir. Veniux, mal kabul, raf yerleşimi ve depolar arası transfer kayıtlarını aynı çalışma alanında sunar.','Sayım ve depo erişimi','Sayım sonuçlarını mevcut kayıtlarla karşılaştırın. Kullanıcıların depo erişimini firma ve depo kapsamıyla yönetin. Fiziksel okuyucu, terminal ve yazıcı kabulü kullanılan cihaz üzerinde ayrıca doğrulanmalıdır.'],
 '/lot-miat-takibi'=>['Lot ve miat, stok miktarının ayrılmaz parçası.','Ürünleri yalnız toplam miktarlarıyla değil, lot ve son kullanma tarihleriyle takip edin. Miat görünümü üzerinden yaklaşan tarihleri inceleyin; ürün kataloğu ve stok kayıtlarına birlikte ulaşın.','Kontrollü ürün ve stok aktarımı','Excel veya CSV ürün/stok dosyasını sütun eşleştirme, önizleme ve onay adımlarıyla değerlendirin. Ay/yıl biçimindeki tarihler için dönüşüm kuralı açıkça gösterilir. Hasta ve reçete alanları aktarım kapsamına alınmaz.'],
 '/market-pos'=>['Hızlı perakende akışı','Market, şarküteri ve mağazalarda barkodla veya görselli ürün kartlarıyla satış yapın. F6 ile ürün arayın, F8 ile ödeme alın. Nakit, kart, parçalı ve yetkili kullanıcılar için veresiye desteklenir.','Vardiya ve yetki','Satış için vardiya açılır, kapanışta özet alınır. İndirim ve fiyat değişikliği yönetici onayı ister. Yetersiz stoklu satış reddedilir, sepet korunur.'],
 '/yapay-zeka'=>['Önceliklerinizi özetler','Asistan, stok riski, açık uyarı ve geciken görevleri kayıtlarınızdan toplar. Sorularınızı Türkçe yanıtlar.','Onayınız olmadan işlem yapmaz','Değişiklik gerektiren işlemler önce size gösterilir. Stok öngörüsü asistandan bağımsız, son 30 günlük çıkış ve tedarik süresine dayalı bir hesaptır.'],
 '/demo'=>['Veniux ekosistemini birebir süreçlerinizde test edin.','İşletmenizin depo sayısı, kullanıcı ihtiyaçları ve cihaz gereksinimlerini birlikte değerlendirelim.','Canlı simülasyon ve soru-cevap','Uzman ekibimizle birlikte gerçekçi ürün senaryolarını inceleyin ve işletmeniz için en uygun operasyon modelini belirleyin.']
];

$schema=siteSeoGraph($config,$page,$path,$notFound);
?><!doctype html>
<html lang="tr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?=siteSeoHead($config,$page,$path,$indexable)?>
    <link rel="icon" type="image/webp" href="/assets/logo-40-v1.webp">
    <meta name="color-scheme" content="light">
    <meta name="theme-color" content="#f4eee2">
    <?php $vsOwn=$path==="/"||isset($topics[$path])||isset($growthPages[$path])||isset($sectorPages[$path])||isset($legalPages[$path])||in_array($path,["/program-indir","/fiyatlandirma","/surum-arsivi","/guncelleme-notlari","/sunucu-kurulumu"],true); if(!$vsOwn):?><link rel="stylesheet" href="/assets/<?=e($assetManifest[$assetGroup])?>"><?php endif;?>
    <link rel="stylesheet" href="/assets/veniux-site.css"><link rel="stylesheet" href="/assets/cookie-consent.css">
    <link rel="preload" href="/assets/archivo-latin-wdth-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/assets/home.css?v=20261113h"><script src="/assets/home.js?v=20261113e" defer></script><script src="/assets/chat.js?v=20261113e" defer></script>
    <script type="application/ld+json" nonce="<?=e($nonce)?>"><?=json_encode($schema, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT)?></script>
    <script src="/assets/<?=e($assetManifest['script'])?>" defer></script>
</head>
<body>
<a class="vs-skip" href="#main">İçeriğe geç</a>

<?php require __DIR__.'/components/navbar.php'; ?>

<main id="main">
<?php if(!$notFound && $path!=='/'):?>
    <nav class="breadcrumbs wrap dp-container" aria-label="Sayfa yolu">
        <a href="/">Ana sayfa</a>
        <span aria-hidden="true"> / </span>
        <span><?=e($page['label'])?></span>
    </nav>
<?php endif;?>

<?php $vsLegacy=!$vsOwn&&!$notFound; if($vsLegacy):?><div class="vs-legacy"><?php endif;?>
<?php if(isset($legalPages[$path])): ?>
    <?php require __DIR__."/legal-view.php"; ?>
<?php elseif($path==="/surum-arsivi"): ?>
    <?php require __DIR__."/release-archive-view.php"; ?>
<?php elseif($path==="/guncelleme-notlari"): ?>
    <?php require __DIR__."/release-notes-view.php"; ?>
<?php elseif($path==="/sunucu-kurulumu"): ?>
    <?php require __DIR__."/hosting-guide.php"; ?>
<?php elseif(isset($sectorPages[$path])): ?>
    <?php require __DIR__."/sector-view.php"; ?>
<?php elseif(isset($growthPages[$path])): ?>
    <?php require __DIR__."/growth-view.php"; ?>
<?php elseif($path==="/program-indir"): ?>
    <?php require __DIR__."/program-view.php"; ?>
<?php elseif($path==="/fiyatlandirma"): ?>
    <?php require __DIR__."/pricing-view.php"; ?>
<?php else: ?>

    <?php if($path==="/"){require __DIR__."/home-view.php";}else{require __DIR__."/solution-view.php";} ?>

    <!-- ==========================================================================
         LEAD CONTACT & DEMO REQUEST SECTION
         ========================================================================== -->
    <?php 
    $selectedPlan = sitePlanSelection($_POST["plan"]??$_GET["plan"]??null); 
    $initialFormType = in_array($_GET['request_type']??'', ['demo','quote','contact','partnership'], true) ? $_GET['request_type'] : ($selectedPlan ? 'quote' : 'contact'); 
    $initialSolution = in_array($_GET['solution']??'', ['stok','depo','lot'], true) ? $_GET['solution'] : ''; 
    ?>
    <section id="iletisim" class="dp-contact">
        <div class="dp-container">
            <div class="dp-contact-card">
                <div>
                    <p class="dp-eyebrow"><span class="dp-eyebrow-dot"></span> Demo veya teklif</p>
                    <h2 class="dp-h2">Bize yazın</h2>
                    <p>
                        İşletmenizi, depo sayınızı ve ne aradığınızı yazın. Size dönüp programı kendi işinize göre gösterelim.</p>
                    <?php require_once __DIR__.'/whatsapp.php'; ?><p class="wa-line"><a class="wa-btn" href="<?=e(whatsappUrl())?>" target="_blank" rel="noopener noreferrer"><?=whatsappIcon(22)?><span>WhatsApp'tan yazın</span></a><span class="wa-num">Hafta içi 09:00–18:00</span></p>
                </div>

                <div class="dp-contact-form-area">
                    <?php if($contactResult):?>
                        <div class="dp-toast <?=$contactResult[0]?'dp-toast--success':'dp-toast--error'?>" role="<?=$contactResult[0]?'status':'alert'?>">
                            <?=e($contactResult[1])?>
                        </div>
                    <?php endif;?>

                    <?php if($contactConversion):?>
                        <span hidden data-conversion-receipt="<?=e($contactConversion['receipt'])?>" data-conversion-event="<?=e($contactConversion['event'])?>" data-conversion-type="<?=e($contactConversion['form_type'])?>"></span>
                    <?php endif;?>

                    <form method="post" action="/#iletisim" class="dp-form contact-form">
                        <?php if($selectedPlan):?>
                            <div class="vs-plan-box">
                                <p class="vs-plan-kicker">SEÇTİĞİNİZ PLAN</p>
                                <strong><?=e($selectedPlan["name"])?> · <?=e($selectedPlan["period"])?></strong>
                                <p><?=siteMoney($selectedPlan["amount_try"])?> · %20 KDV dahil · Online ödeme alınmaz.</p>
                                <input type="hidden" name="plan" value="<?=e($selectedPlan["code"])?>">
                            </div>
                        <?php endif;?>

                        <input type="hidden" name="token" value="<?=e($_SESSION['contact_token'])?>">
                        <div class="honeypot" aria-hidden="true">
                            <label>Web sitesi<input name="website" tabindex="-1" autocomplete="off"></label>
                        </div>

                        <div class="vs-form-row">
                            <div class="dp-form-group">
                                <label class="dp-label">Adınız Soyadınız *</label>
                                <input class="dp-input" name="name" value="<?=formValue('name')?>" autocomplete="name" minlength="2" maxlength="100" required placeholder="Adınız Soyadınız">
                            </div>
                            <div class="dp-form-group">
                                <label class="dp-label">E-posta Adresiniz *</label>
                                <input class="dp-input" name="email" value="<?=formValue('email')?>" type="email" autocomplete="email" maxlength="254" required placeholder="isim@sirket.com">
                            </div>
                        </div>

                        <div class="dp-form-group">
                            <label class="dp-label">İşletme Adı (İsteğe bağlı)</label>
                            <input class="dp-input" name="company" value="<?=formValue('company')?>" autocomplete="organization" maxlength="160" placeholder="İşletmenizin adı">
                        </div>

                        <div class="vs-form-row">
                            <div class="dp-form-group">
                                <label class="dp-label">Talep Türü *</label>
                                <select class="dp-select" name="form_type" required>
                                    <?php foreach(['demo'=>'Ürün Demosu','quote'=>'Teklif İsteği','contact'=>'Bilgi & İletişim','partnership'=>'İş Ortaklığı Görüşmesi'] as $value=>$label):?>
                                        <option value="<?=$value?>" <?=(($preserve?($_POST['form_type']??'contact'):$initialFormType)===$value)?'selected':''?>><?=$label?></option>
                                    <?php endforeach;?>
                                </select>
                            </div>
                            <div class="dp-form-group">
                                <label class="dp-label">İlgilendiğiniz Çözüm *</label>
                                <select class="dp-select" name="interest" required>
                                    <option value="">Bir çözüm seçin</option>
                                    <?php foreach(['stok'=>'Stok ve Mağaza Yönetimi','kasa'=>'Kasa ve Satış','depo'=>'Depo Operasyonları (WMS)','lot'=>'Lot ve Miat Takibi'] as $value=>$label):?>
                                        <option value="<?=$value?>" <?=($preserve?($_POST['interest']??''):$initialSolution)===$value?'selected':''?>><?=$label?></option>
                                    <?php endforeach;?>
                                </select>
                            </div>
                        </div>

                        <div class="dp-form-row dp-demo-row">
                            <div class="dp-form-group">
                                <label class="dp-label" for="dp-sector">Sektör (isteğe bağlı)</label>
                                <select class="dp-select" id="dp-sector" name="sector">
                                    <option value="">Seçin</option>
                                    <?php foreach(['market'=>'Market / bakkal','kirtasiye'=>'Kırtasiye','hirdavat'=>'Hırdavat / nalbur','kafe'=>'Kafe / büfe','depo'=>'Depo / toptan','diger'=>'Diğer'] as $value=>$label):?>
                                        <option value="<?=$value?>" <?=$preserve&&($_POST['sector']??'')===$value?'selected':''?>><?=$label?></option>
                                    <?php endforeach;?>
                                </select>
                            </div>
                            <?php foreach(['warehouses'=>'Depo/şube sayısı','registers'=>'Kasa sayısı','users'=>'Kullanıcı sayısı'] as $name=>$label):?>
                            <div class="dp-form-group">
                                <label class="dp-label" for="dp-<?=$name?>"><?=$label?> (isteğe bağlı)</label>
                                <input class="dp-input" id="dp-<?=$name?>" name="<?=$name?>" type="number" min="0" max="5000" step="1" inputmode="numeric" value="<?=$preserve?formValue($name):''?>">
                            </div>
                            <?php endforeach;?>
                        </div>

                        <div class="dp-form-group" data-partner-field>
                            <label class="dp-label">Ortaklık Alanı (Yalnızca ortaklık talepleri için)</label>
                            <select class="dp-select" name="partner_type">
                                <option value="">Seçin</option>
                                <?php foreach(['hardware'=>'Donanım entegratörü','barcode'=>'Barkod ve el terminali','erp'=>'ERP çözüm ortağı','reseller'=>'Bayi','technology'=>'Teknoloji','referral'=>'Referans yönlendirme'] as $value=>$label):?>
                                    <option value="<?=$value?>" <?=$preserve&&($_POST['partner_type']??'')===$value?'selected':''?>><?=$label?></option>
                                <?php endforeach;?>
                            </select>
                        </div>

                        <div class="vs-consent">
                            <label>
                                <input type="checkbox" name="consent" value="1" required>
                                <span>Bilgilerimin bu görüşme talebini değerlendirmek ve benimle iletişim kurmak amacıyla kullanılmasını onaylıyorum.</span>
                            </label>
                        </div>

                        <button class="dp-btn dp-btn--accent" type="submit">
                            Gönder
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </section>

<?php endif; ?>
<?php if($vsLegacy):?></div><?php endif;?>
</main>

<?php require __DIR__.'/components/footer.php'; ?>

</body>
</html>
