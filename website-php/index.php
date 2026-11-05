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

function e(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

$pages = [
 '/surum-arsivi' => ['title'=>'Windows ve Android Sürüm Arşivi | Veniux Cloud','description'=>'Veniux Windows ve Android kurulum paketlerini sürüm numarası, dosya boyutu ve SHA-256 özetiyle inceleyin.','label'=>'Sürüm arşivi','headline'=>'','intro'=>''],
 '/sunucu-kurulumu' => ['title'=>'Veniux Kurulum Seçenekleri | Otomatik ve Ayrı Sunucu','description'=>'Veniux Windows kurulumunda otomatik yerel kurulum veya ayrı sunucu bağlantısını seçin. Hostimux sponsorlu tanıtımı ve sunucu hazırlık adımları.','label'=>'Sunucu kurulumu','headline'=>'','intro'=>''],
 '/guncelleme-notlari' => ['title'=>'Güncelleme Notları | Veniux Windows ve Android','description'=>'Veniux Windows, Android, site ve API güncelleme geçmişi. Yeni özellikleri, güncellenen işlevleri ve sürüm düzeltmelerini tarihleriyle inceleyin.','label'=>'Güncelleme notları','headline'=>'','intro'=>''],
 '/program-indir' => ['title'=>'Veniux İndir | Windows Stok Programı ve Android Uygulaması','description'=>'Veniux Windows stok ve depo programını, Android telefon/tablet uygulamasını indirin. Aynı işletme kayıtları, yerel ağ bağlantısı ve lisanslı kullanım.','label'=>'PROGRAM İNDİR','headline'=>'Bilgisayarda yönet.<br>Mobilde <em>takip et.</em>','intro'=>'Windows stok ve depo programı. Bilgisayardaki aynı verilere bağlanan Android telefon ve tablet uygulaması.'],
 '/fiyatlandirma' => ['title'=>'Veniux Fiyatlandırma | 3 Aylık ve Yıllık Stok Yönetim Planları','description'=>'Veniux Başlangıç, İşletme ve Kurumsal paketlerini karşılaştırın. 3 aylık ve yıllık TL fiyatlarını, depo ve kullanıcı sınırlarını inceleyin.','label'=>'Fiyatlandırma','headline'=>'İşinize uygun plan.','intro'=>'3 aylık ve yıllık Veniux Cloud paketleri.'],
 '/' => ['title'=>'Veniux | İşletmenizin Tüm Akışı. Tek Bir Veniux.','description'=>'Veniux; CRM, stok, depo, market/POS, satış ve işletme yönetimini tek bir ekosistemde birleştirir. Operasyonlarınızı daha hızlı, kontrollü ve verimli yönetin.','label'=>'İŞİNİZİ DAHA İLERİYE TAŞIYIN','headline'=>'İşletmenizin tüm akışı.<br><span class="text-accent">Tek bir Veniux.</span>','intro'=>'Veniux; CRM, stok, depo, market/POS, satın alma, satış ve işletme yönetimini tek bir ekosistemde birleştirir. Operasyonlarınızı daha hızlı, kontrollü ve verimli yönetin.'],
 '/stok-yonetimi' => ['title'=>'Stok Yönetim Programı ve Barkodlu Takip | Veniux','description'=>'Veniux stok yönetim programı ile ürün, barkod, stok hareketi, lot ve satın alma kayıtlarını bir arada takip edin.','label'=>'STOK YÖNETİMİ','headline'=>'Stok yönetimi.<br>Her hareket <em>kayıt altında.</em>','intro'=>'Ürününüzün nereden geldiğini, hangi depoda olduğunu ve nasıl hareket ettiğini tek çalışma alanında takip edin.'],
 '/depo-yonetimi' => ['title'=>'Depo Yönetim Yazılımı ve Mal Kabul | Veniux','description'=>'Depo yönetiminde mal kabul, raf yerleşimi, transfer, sevkiyat ve sayım süreçlerini Veniux ile takip edin.','label'=>'DEPO YÖNETİMİ','headline'=>'Depo yönetimi.<br>Kabulden <em>sevkiyata.</em>','intro'=>'Mal kabulden sevkiyata kadar depo kayıtlarını, rafları ve transferleri aynı operasyon akışında bir araya getirin.'],
 '/lot-miat-takibi' => ['title'=>'Lot ve Miat Takibi | Veniux','description'=>'Veniux ile ürün kataloğu, lot ve son kullanma tarihi takibini keşfedin. Ürün ve stok dosyalarının kontrollü aktarımını inceleyin.','label'=>'LOT VE MİAT TAKİBİ','headline'=>'Lot ve miat takibi.<br>Partiyi <em>izleyin.</em>','intro'=>'Ürün kataloğunuz, lotlarınız ve son kullanma tarihleriniz birlikte. Stok kayıtlarına daha net bir bakış.'],
 '/market-pos' => ['title'=>'Market ve POS Satış Sistemi | Veniux','description'=>'Hızlı barkodlu satış, dokunmatik ekran POS ve kasa yönetimi ile perakende hız kazanın.','label'=>'MARKET / POS','headline'=>'Market / POS.<br>Hızlı satış, <em>güvenli kasa.</em>','intro'=>'Dokunmatik POS ekranı, hızlı barkod okuma ve fiş/fatura entegrasyonu ile satış süreçlerinizi hızlandırın.'],
 '/yapay-zeka' => ['title'=>'Veniux Intelligence | Yapay Zekâ Destekli İşletme Yönetimi','description'=>'İşletme verilerine dayalı analiz, stok tahminleri, operasyonel uyarılar ve karar desteği.','label'=>'VENIUX INTELLIGENCE','headline'=>'Veniux Intelligence.<br>Verinizle <em>akıllı kararlar.</em>','intro'=>'Stok tüketim öngörüleri, kritik seviye uyarıları ve operasyonel karar desteği sunan yeni nesil yapay zekâ asistanı.'],
 '/demo' => ['title'=>'Demo Talep Edin | Veniux','description'=>'Veniux ekosistemini birebir canlı demo görüşmesi ile işletmenizin süreçlerinde keşfedin.','label'=>'DEMO TALEP ET','headline'=>'Veniux\'u keşfedin.<br><em>Canlı demo görüşmesi.</em>','intro'=>'İşletmenizin ihtiyaçlarına özel ürün sunumu ve süreç simülasyonu için demo talebinizi iletin.']
];

$growthPages = require __DIR__.'/growth-pages.php';
foreach($growthPages as $route=>$guide){
    $pages[$route]=$guide;
    $pages[$route]['image_width']=1914;
    $pages[$route]['image_height']=860;
}
$pages['/depo-yonetimi']['image']='product-warehouse-v2.jpg';
$pages['/depo-yonetimi']['image_width']=1920;
$pages['/depo-yonetimi']['image_height']=863;
$pages['/depo-yonetimi']['alt']='Veniux mal kabul ekranı, sentetik örnek kayıtlar';
$pages['/lot-miat-takibi']['image']='product-lot-v2.jpg';
$pages['/lot-miat-takibi']['image_width']=1914;
$pages['/lot-miat-takibi']['image_height']=860;
$pages['/lot-miat-takibi']['alt']='Veniux lot ayrıntısı, sentetik örnek kayıtlar';

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

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header("Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{$nonce}'; style-src 'self' 'nonce-{$nonce}'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");

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

$trimmed = $path === '/' ? '/' : rtrim($path, '/');
if (in_array($_SERVER['REQUEST_METHOD'],['GET','HEAD'],true) && ($path==='/index.php' || ($trimmed!==$path && isset($pages[$trimmed])))) {
    header('Location: '.($path==='/index.php'?'/':$trimmed),true,301); exit;
}

if (!in_array($_SERVER['REQUEST_METHOD'],['GET','HEAD','POST'],true)) { http_response_code(405); header('Allow: GET, HEAD, POST'); exit; }
if ($_SERVER['REQUEST_METHOD']==='POST' && !in_array($path,['/','/kayit','/giris','/cikis','/demo'],true)) { http_response_code(405); exit; }

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
    ['03','Market / POS','Hızlı & Güvenli Satış','Dokunmatik satış, barkodlu okuma, fiş/fatura yazdırma ve kasa devri.','/market-pos']
];

$topics = [
 '/stok-yonetimi'=>['Stok yönetimini kayıtlarınızla birlikte düşünün.','Ürün kataloğunuzda barkod, birim ve fiyat bilgilerini bir arada tutun. Depo bazında miktarları inceleyin; stok hareketleri üzerinden ürünün giriş ve çıkış kayıtlarına ulaşın.','Satın alma ve ürün geçmişi','Satın alma siparişlerinin kabul adımlarını ve stok kayıtlarını takip edin. Lot bilgisi bulunan ürünlerde miktarın yanında parti ve son kullanma tarihini de değerlendirin. Barkod okuyucu bağlantısı, kullanılan cihaz ve platform desteğine bağlıdır.'],
 '/depo-yonetimi'=>['Mal kabulden sevkiyata kadar aynı kayıt zinciri.','Bir ürünün hangi depoya kabul edildiğini, nerede bulunduğunu ve hangi operasyonla taşındığını takip etmek depo düzeninin temelidir. Veniux, mal kabul, raf yerleşimi ve depolar arası transfer kayıtlarını aynı çalışma alanında sunar.','Sayım ve depo erişimi','Sayım sonuçlarını mevcut kayıtlarla karşılaştırın. Kullanıcıların depo erişimini firma ve depo kapsamıyla yönetin. Fiziksel okuyucu, terminal ve yazıcı kabulü kullanılan cihaz üzerinde ayrıca doğrulanmalıdır.'],
 '/lot-miat-takibi'=>['Lot ve miat, stok miktarının ayrılmaz parçası.','Ürünleri yalnız toplam miktarlarıyla değil, lot ve son kullanma tarihleriyle takip edin. Miat görünümü üzerinden yaklaşan tarihleri inceleyin; ürün kataloğu ve stok kayıtlarına birlikte ulaşın.','Kontrollü ürün ve stok aktarımı','Excel veya CSV ürün/stok dosyasını sütun eşleştirme, önizleme ve onay adımlarıyla değerlendirin. Ay/yıl biçimindeki tarihler için dönüşüm kuralı açıkça gösterilir. Hasta ve reçete alanları aktarım kapsamına alınmaz.'],
 '/market-pos'=>['Hızlı perakende akışı, hatasız kasa mutabakatı.','Market, şarküteri, mağaza ve perakende satış noktalarında dokunmatik arayüz ile satışları saniyeler içinde tamamlayın.','Barkod ve yazıcı entegrasyonu','Seri veya USB barkod okuyucularla tam uyumlu çalışın; satış anında fiş ve fatura çıktılarınızı otomatik olarak üretin.'],
 '/yapay-zeka'=>['İşletmenizin operasyonel verileri akıllı kararlara dönüşsün.','Veniux Intelligence, stok devir hızlarınızı, tedarikçi teslim sürelerini ve satış ritminizi analiz ederek kritik kararlarınızda size rehberlik eder.','Akıllı stok önerileri ve anomali uyarıları','Tükenmek üzere olan ürünleri vaktinde sipariş verin, kasa hareketlerindeki beklenmeyen sapmaları anında tespit edin. Kararlarınızı tahminlere değil, verilere dayandırın.'],
 '/demo'=>['Veniux ekosistemini birebir süreçlerinizde test edin.','İşletmenizin depo sayısı, kullanıcı ihtiyaçları ve cihaz gereksinimlerini birlikte değerlendirelim.','Canlı simülasyon ve soru-cevap','Uzman ekibimizle birlikte gerçekçi ürün senaryolarını inceleyin ve işletmeniz için en uygun operasyon modelini belirleyin.']
];

$schema=siteSeoGraph($config,$page,$path,$notFound);
?><!doctype html>
<html lang="tr">
<head>
    <meta charset="utf-8">
    <link rel="preload" href="/assets/manrope-v1.woff2" as="font" type="font/woff2" crossorigin>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?=siteSeoHead($config,$page,$path,$indexable)?>
    <link rel="icon" type="image/webp" href="/assets/logo-40-v1.webp">
    <meta name="color-scheme" content="dark">
    <meta name="theme-color" content="#07111D">
    <link rel="stylesheet" href="/assets/precision.css">
    <link rel="stylesheet" href="/assets/<?=e($assetManifest[$assetGroup])?>">
    <link rel="stylesheet" href="/assets/premium-dark.css">
    <script type="application/ld+json" nonce="<?=e($nonce)?>"><?=json_encode($schema, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT)?></script>
    <script src="/assets/<?=e($assetManifest['script'])?>" defer></script>
</head>
<body>
<a class="skip" href="#main" style="position:absolute; top:-100px; left:20px; background:#1677C8; color:#fff; padding:8px 16px; z-index:9999;" onfocus="this.style.top='20px'" onblur="this.style.top='-100px'">İçeriğe geç</a>

<?php require __DIR__.'/components/navbar.php'; ?>

<main id="main">
<?php if(!$notFound && $path!=='/'):?>
    <nav class="breadcrumbs wrap dp-container" aria-label="Sayfa yolu" style="padding-top:20px;">
        <a href="/" style="color:#94A5B8;">Ana sayfa</a>
        <span aria-hidden="true" style="color:#263B50;"> / </span>
        <span style="color:#E8EDF4;"><?=e($page['label'])?></span>
    </nav>
<?php endif;?>

<?php if(isset($legalPages[$path])): ?>
    <?php require __DIR__."/legal-view.php"; ?>
<?php elseif($path==="/surum-arsivi"): ?>
    <?php require __DIR__."/release-archive-view.php"; ?>
<?php elseif($path==="/guncelleme-notlari"): ?>
    <?php require __DIR__."/release-notes-view.php"; ?>
<?php elseif($path==="/sunucu-kurulumu"): ?>
    <?php require __DIR__."/hosting-guide.php"; ?>
<?php elseif(isset($growthPages[$path])): ?>
    <?php require __DIR__."/growth-view.php"; ?>
<?php elseif($path==="/program-indir"): ?>
    <?php require __DIR__."/program-view.php"; ?>
<?php elseif($path==="/fiyatlandirma"): ?>
    <?php require __DIR__."/pricing-view.php"; ?>
<?php else: ?>

    <?php if($path==="/"): ?>
        <!-- ==========================================================================
             HERO SECTION (DARK PRECISION WORKSTATION SHOWCASE)
             ========================================================================== -->
        <section class="dp-hero">
            <div class="dp-container">
                <div class="dp-hero-grid">
                    <div class="dp-hero-content">
                        <p class="dp-eyebrow"><span class="dp-eyebrow-dot"></span> Stok, depo ve kasa tek yerde</p>
                        <h1 class="dp-h1">Stoğunuz bitmeden<br><span class="text-accent">haberiniz olsun.</span></h1>
                        <p class="dp-lead">
                            Hangi ürünün kaç günde biteceğini ve ne kadar sipariş vermeniz gerektiğini Veniux hesaplar. Sayım farkını ve belgesiz stok düşüşünü bildirir, kasadan yapılan satışı stoktan anında düşer.
                        </p>
                        <div class="dp-hero-actions">
                            <a href="#ekosistem" class="dp-btn dp-btn--primary">
                                Çözümleri keşfet <span aria-hidden="true">→</span>
                            </a>
                            <a href="/?request_type=demo#iletisim" class="dp-btn dp-btn--outline">
                                <span aria-hidden="true">📅</span> Demo Talep Et
                            </a>
                        </div>
                        <div class="dp-hero-pills">
                            <div class="dp-pill-item">
                                <div class="dp-pill-icon">▦</div>
                                <div class="dp-pill-text">
                                    <strong>Tüm Modüller</strong>
                                    <span>Tek Platformda</span>
                                </div>
                            </div>
                            <div class="dp-pill-item">
                                <div class="dp-pill-icon">⚡</div>
                                <div class="dp-pill-text">
                                    <strong>Kolay Kullanım</strong>
                                    <span>Hızlı Eğitim</span>
                                </div>
                            </div>
                            <div class="dp-pill-item">
                                <div class="dp-pill-icon">📊</div>
                                <div class="dp-pill-text">
                                    <strong>Güçlü Raporlama</strong>
                                    <span>Gerçek Zamanlı Veri</span>
                                </div>
                            </div>
                            <div class="dp-pill-item">
                                <div class="dp-pill-icon">🧠</div>
                                <div class="dp-pill-text">
                                    <strong>Yapay Zeka Destekli</strong>
                                    <span>Akıllı Öneriler</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="dp-hero-stage">
                        <div class="vx-panel" role="img" aria-label="Veniux panelinin örnek verili görünümü">
                            <div class="vx-panel-head">Genel bakış <span>Örnek veriler</span></div>
                            <div class="vx-panel-kpis"><div class="warm">Stok değeri<b>₺101.542</b></div><div>Dönem çıkışı<b>219</b></div><div class="bad">Kritik ürün<b>4</b></div></div>
                            <svg class="vx-panel-chart" viewBox="0 0 300 70" preserveAspectRatio="none" aria-hidden="true"><polygon fill="#ff8a3d22" points="0,70 0,56 40,48 80,52 120,34 160,40 200,22 240,28 300,10 300,70"/><polyline fill="none" stroke="#ff9a5c" stroke-width="2" vector-effect="non-scaling-stroke" points="0,56 40,48 80,52 120,34 160,40 200,22 240,28 300,10"/></svg>
                            <ul class="vx-panel-list"><li class="bad">Filtre kahve 3 günde bitiyor<em>Sipariş: 80 adet</em></li><li class="bad">Sayım farkı: deterjan<em>5 adet eksik</em></li><li class="good">Kasa satışı stoktan düştü<em>−1 adet</em></li></ul>
                            <p class="vx-panel-note">Görsel temsilîdir; rakamlar örnektir.</p>
                        </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- ==========================================================================
             TRUST & QUALITY METRICS BAR
             ========================================================================== -->
        <section class="dp-trust-bar" aria-label="Sistem ve güvenilirlik metrikleri">
            <div class="dp-container">
                <div class="dp-trust-grid">
                    <div class="dp-trust-item">
                        <span class="dp-trust-val">14+</span>
                        <span class="dp-trust-label">Entegre Modül</span>
                    </div>
                    <div class="dp-trust-item">
                        <span class="dp-trust-val">Çift Yönlü</span>
                        <span class="dp-trust-label">Gerçek Zamanlı Senkron</span>
                    </div>
                    <div class="dp-trust-item">
                        <span class="dp-trust-flag">🇹🇷</span>
                        <span class="dp-trust-label">TÜRKİYE'DE GELİŞTİRİLDİ</span>
                    </div>
                    <div class="dp-trust-item">
                        <span class="dp-trust-val">Windows & Android</span>
                        <span class="dp-trust-label">Masaüstü ve Mobil Birlikte</span>
                    </div>
                    <div class="dp-trust-item">
                        <span class="dp-trust-val">∞</span>
                        <span class="dp-trust-label">Sürekli Gelişim</span>
                    </div>
                </div>
            </div>
        </section>

        <!-- ==========================================================================
             7-MODULE PRODUCT ECOSYSTEM
             ========================================================================== -->
        <section id="ekosistem" class="dp-ecosystem">
            <div class="dp-container">
                <div class="dp-section-header">
                    <p class="dp-eyebrow"><span class="dp-eyebrow-dot"></span> ÜRÜN EKOSİSTEMİ</p>
                    <h2 class="dp-h2">Birbirini tamamlayan modüller.<br><span class="text-accent">Eksiksiz bir operasyon.</span></h2>
                    <p class="dp-lead">İşletmenizin farklı operasyonları için aynı dili konuşan modüller. Her modül bir sonrakini besler, veriler tek merkezde toplanır.</p>
                </div>

                <div class="dp-modules-grid">
                    <!-- 1. Veniux CRM -->
                    <div class="dp-module-card">
                        <div class="dp-module-top">
                            <div class="dp-module-icon">👥</div>
                            <span class="dp-module-arrow">↗</span>
                        </div>
                        <h3 class="dp-module-title">Veniux CRM</h3>
                        <p class="dp-module-desc">Müşteri ilişkileri, potansiyel fırsatlar, görüşme notları ve cari hesap bakiyelerini kurumsal disiplinle yönetin.</p>
                        <div class="dp-module-preview">
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; margin-bottom:6px;">
                                <strong style="color:#E8EDF4;">Ahmet Yılmaz</strong>
                                <span style="color:#2CA58D; font-size:10.5px; font-weight:700;">Potansiyel Müşteri</span>
                            </div>
                            <div style="font-size:11px; color:#94A5B8; display:flex; gap:12px;">
                                <span>Son Görüşme: Dün</span>
                                <span>Açık Teklif: ₺24.650</span>
                            </div>
                        </div>
                        <p class="dp-preview-note">* Not: bu bölüm canlı CRM ekranı değildir, modülün işleyişini temsil eden arayüz modelidir.</p>
                    </div>

                    <!-- 2. Stok & Depo (Veniux Stok & Envanter) -->
                    <div class="dp-module-card dp-module-card--featured">
                        <div class="dp-module-top">
                            <div class="dp-module-icon">📦</div>
                            <span class="dp-module-arrow">↗</span>
                        </div>
                        <h3 class="dp-module-title">Stok &amp; Depo</h3>
                        <p class="dp-module-desc">Ürün, envanter, barkod, lot/miat takibi ve gelişmiş depo yönetimi. Kritik seviye uyarıları ile stoksuz kalmayın.</p>
                        <div class="dp-module-preview">
                            <div style="display:flex; justify-content:space-between; font-size:11.5px; margin-bottom:4px;">
                                <span style="color:#E8EDF4;">Parol 500 mg · Lot 2026-A</span>
                                <span style="color:#F17A38; font-weight:700;">Kritik: 8 Adet</span>
                            </div>
                            <div style="background:#14273A; height:6px; border-radius:3px; overflow:hidden;">
                                <div style="background:#F17A38; width:22%; height:100%;"></div>
                            </div>
                        </div>
                        <p class="dp-preview-note">* Ürün ve envanter kartları, son kullanma ve lot kontrolü tek çalışma alanında.</p>
                    </div>

                    <!-- 3. VENIUX WAREHOUSE (Veniux Depo & WMS) -->
                    <div class="dp-module-card">
                        <div class="dp-module-top">
                            <div class="dp-module-icon">🏭</div>
                            <span class="dp-module-arrow">↗</span>
                        </div>
                        <h3 class="dp-module-title">VENIUX WAREHOUSE</h3>
                        <p class="dp-module-desc">Mal kabulden sevkiyata dinamik raf adresleme, palet barkodlama, transferler ve terminalle hızlı sayım süreçleri.</p>
                        <div class="dp-module-preview">
                            <div style="display:flex; justify-content:space-between; font-size:11px; color:#94A5B8;">
                                <span>Raf: A-04-12</span>
                                <span>Palet: PLT-9021</span>
                                <span style="color:#2CA58D;">Kabul Edildi</span>
                            </div>
                        </div>
                        <p class="dp-preview-note">* Çoklu depo ve raf adresleri üzerinden kontrollü lojistik yönetimi.</p>
                    </div>

                    <!-- 4. Market / POS -->
                    <div class="dp-module-card">
                        <div class="dp-module-top">
                            <div class="dp-module-icon">🛒</div>
                            <span class="dp-module-arrow">↗</span>
                        </div>
                        <h3 class="dp-module-title">Market / POS</h3>
                        <p class="dp-module-desc">Hızlı ve kolay satış ekranı ile işletmenizde hız kazanın. Dokunmatik kasa, fiş/fatura yazdırma ve anında kasa devri.</p>
                        <div class="dp-module-preview">
                            <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700; color:#E8EDF4;">
                                <span>Sepet Toplamı (4 Kalem)</span>
                                <span style="color:#F17A38;">₺360,40</span>
                            </div>
                            <div style="display:flex; gap:8px; margin-top:6px;">
                                <span style="background:#1677C8; color:#fff; font-size:10px; padding:3px 8px; border-radius:4px;">Nakit</span>
                                <span style="background:#F17A38; color:#fff; font-size:10px; padding:3px 8px; border-radius:4px;">Kredi Kartı</span>
                            </div>
                        </div>
                        <p class="dp-preview-note">* Dokunmatik satış ekranı ve termal fiş yazıcılarla tam entegrasyon.</p>
                    </div>

                    <!-- 5. VENIUX SATIŞ YÖNETİMİ -->
                    <div class="dp-module-card">
                        <div class="dp-module-top">
                            <div class="dp-module-icon">📋</div>
                            <span class="dp-module-arrow">↗</span>
                        </div>
                        <h3 class="dp-module-title">VENIUX SATIŞ YÖNETİMİ</h3>
                        <p class="dp-module-desc">B2B ve B2C sipariş yönetimi, teklif hazırlama, çoklu fiyat listeleri, özel iskonto kuralları ve vade operasyonları.</p>
                        <div class="dp-module-preview">
                            <div style="display:flex; justify-content:space-between; font-size:11.5px; color:#E8EDF4;">
                                <span>Sipariş #ORD-2026-089</span>
                                <span style="color:#2CA58D;">Onaylandı</span>
                            </div>
                            <div style="font-size:11px; color:#94A5B8; margin-top:3px;">Müşteri: Doğu Dağıtım A.Ş. · Vade: 30 Gün</div>
                        </div>
                        <p class="dp-preview-note">* Satış teklifleri onaylandığı anda otomatik stok rezervasyonu devreye girer.</p>
                    </div>

                    <!-- 6. Veniux Raporlama -->
                    <div class="dp-module-card">
                        <div class="dp-module-top">
                            <div class="dp-module-icon">📈</div>
                            <span class="dp-module-arrow">↗</span>
                        </div>
                        <h3 class="dp-module-title">Raporlama</h3>
                        <p class="dp-module-desc">Detaylı analizler, grafikler ve anlaşılır raporlama ile daha doğru kararlar. Gerçek zamanlı ciro ve net kârlılık takibi.</p>
                        <div class="dp-module-preview">
                            <div style="display:flex; justify-content:space-between; font-size:11.5px; margin-bottom:4px;">
                                <span style="color:#94A5B8;">Aylık Kâr: <strong>₺96.430</strong></span>
                                <span style="color:#2CA58D; font-weight:700;">+%20,1</span>
                            </div>
                            <div style="display:flex; gap:3px; height:16px; align-items:flex-end;">
                                <div style="background:#1677C8; width:12%; height:40%;"></div>
                                <div style="background:#1677C8; width:12%; height:60%;"></div>
                                <div style="background:#1677C8; width:12%; height:55%;"></div>
                                <div style="background:#1677C8; width:12%; height:80%;"></div>
                                <div style="background:#1677C8; width:12%; height:70%;"></div>
                                <div style="background:#F17A38; width:12%; height:100%;"></div>
                                <div style="background:#1677C8; width:12%; height:90%;"></div>
                            </div>
                        </div>
                        <p class="dp-preview-note">* Not: bu bölüm canlı rapor ekranı değildir; analitik görselleştirme modelidir.</p>
                    </div>

                    <!-- 7. VENIUX INTELLIGENCE (Wide Card) -->
                    <div class="dp-module-card dp-module-card--wide" style="border-color:rgba(22,119,200,0.5);">
                        <div class="dp-module-top">
                            <div class="dp-module-icon" style="color:#1677C8;">🧠</div>
                            <span class="dp-badge" style="background:#14273A; color:#1677C8; padding:4px 10px; border-radius:9999px; font-size:11px; font-weight:700;">YAPAY ZEKÂ MOTORU</span>
                        </div>
                        <h3 class="dp-module-title">VENIUX INTELLIGENCE</h3>
                        <p class="dp-module-desc">İşletmenizin geçmiş satış temposunu, mevsimsel hareketleri ve tedarikçi gecikmelerini analiz ederek akıllı stok tedarik önerileri sunar. Kasa tutarsızlıklarını ve beklenmedik anormallikleri erken aşamada uyarır.</p>
                        <div class="dp-module-preview" style="background:#07111D; border:1px solid #14273A;">
                            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                                <span style="color:#F17A38;">⚠️ Akıllı Stok Uyarısı:</span>
                                <span style="color:#E8EDF4; font-size:12px;">"Selpak 3 Katlı" mevcut hızla 4 gün içinde tükenecek.</span>
                            </div>
                            <div style="font-size:11px; color:#94A5B8;">Önerilen sipariş miktarı: 50 Koli · Tedarikçi teslim süresi: 48 Saat</div>
                        </div>
                        <p class="dp-preview-note">* Not: Veniux Intelligence, yerel veriler üzerinde çalışan güvenli karar desteğidir; harici AI sağlayıcısının model API'siyle entegre olabilir.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- ==========================================================================
             5-STEP INTERACTIVE WORKFLOW TOUR
             ========================================================================== -->
        <section id="is-akisi" class="dp-workflow">
            <div class="dp-container">
                <div class="dp-section-header">
                    <p class="dp-eyebrow"><span class="dp-eyebrow-dot"></span> İŞ AKIŞI DENEYİMİ</p>
                    <h2 class="dp-h2">Operasyonun tüm aşamaları.<br><span class="text-accent">Eksiksiz tek bir zincir.</span></h2>
                    <p class="dp-lead">Ürün girişinden gün sonu raporuna kadar her adım birbiriyle konuşur. Hataları sıfıra indiren ve hızı artıran kesintisiz akış.</p>
                </div>

                <!-- 5 Steps Navigation -->
                <div class="dp-tour-nav" role="tablist" aria-label="Operasyon adımları">
                    <a href="#dp-panel-giris" id="dp-step-giris" class="dp-tour-step-btn active" role="tab" aria-selected="true" aria-controls="dp-panel-giris">
                        <span class="dp-tour-num">01 / ADIM</span>
                        <span class="dp-tour-title">Ürün Girişi & Kabul</span>
                    </a>
                    <a href="#dp-panel-stok" id="dp-step-stok" class="dp-tour-step-btn" role="tab" aria-selected="false" aria-controls="dp-panel-stok">
                        <span class="dp-tour-num">02 / ADIM</span>
                        <span class="dp-tour-title">Stok & Raf Güncelleme</span>
                    </a>
                    <a href="#dp-panel-satis" id="dp-step-satis" class="dp-tour-step-btn" role="tab" aria-selected="false" aria-controls="dp-panel-satis">
                        <span class="dp-tour-num">03 / ADIM</span>
                        <span class="dp-tour-title">Barkodlu Hızlı Satış</span>
                    </a>
                    <a href="#dp-panel-vardiya" id="dp-step-vardiya" class="dp-tour-step-btn" role="tab" aria-selected="false" aria-controls="dp-panel-vardiya">
                        <span class="dp-tour-num">04 / ADIM</span>
                        <span class="dp-tour-title">Kasa & Gün Sonu</span>
                    </a>
                    <a href="#dp-panel-rapor" id="dp-step-rapor" class="dp-tour-step-btn" role="tab" aria-selected="false" aria-controls="dp-panel-rapor">
                        <span class="dp-tour-num">05 / ADIM</span>
                        <span class="dp-tour-title">Raporlama & Kararlar</span>
                    </a>
                </div>

                <!-- 5 Workflow Panels (Accessible, progressive no-JS) -->
                <div class="dp-tour-panels-container" style="display:flex; flex-direction:column; gap:20px;">
                    <!-- Step 1: Mal Kabul -->
                    <div id="dp-panel-giris" class="dp-tour-panel active" role="tabpanel" aria-labelledby="dp-step-giris">
                        <div>
                            <span class="dp-eyebrow"><span class="dp-eyebrow-dot"></span> BİRİNCİ ADIM</span>
                            <h3 class="dp-h3">Ürün Girişi ve Mal Kabul</h3>
                            <p style="color:#94A5B8; font-size:14px; line-height:1.7;">
                                Tedarikçiden gelen ürünler irsaliye veya fatura ile eşleştirilerek depoya alınır. El terminali veya barkod okuyucu ile partinin lot ve son kullanma tarihi sisteme işlenir.
                            </p>
                            <ul style="color:#94A5B8; font-size:13px; line-height:1.8; margin-top:16px;">
                                <li>✓ Otomatik barkod ve seri numarası kontrolü</li>
                                <li>✓ FEFO / FIFO lot ve miat eşleştirmesi</li>
                                <li>✓ Tedarikçi borç bakiyesinin anında güncellenmesi</li>
                            </ul>
                        </div>
                        <div style="background:#0D1B2A; border:1px solid #263B50; border-radius:14px; padding:24px;">
                            <div style="font-size:12px; color:#1677C8; font-weight:700; margin-bottom:8px;">MAL KABUL TERMİNALİ</div>
                            <div style="display:flex; justify-content:space-between; padding:10px; background:#14273A; border-radius:8px; margin-bottom:8px;">
                                <span style="color:#E8EDF4;">Giriş Belgesi: #IRS-2026-440</span>
                                <span style="color:#2CA58D; font-weight:700;">240 Koli Kabul Edildi</span>
                            </div>
                            <small style="color:#64748B;">Sentetik operasyon verisi; cihaz entegrasyonu mevcuttur.</small>
                        </div>
                    </div>

                    <!-- Step 2: Stok & Raf -->
                    <div id="dp-panel-stok" class="dp-tour-panel" role="tabpanel" aria-labelledby="dp-step-stok">
                        <div>
                            <span class="dp-eyebrow"><span class="dp-eyebrow-dot"></span> İKİNCİ ADIM</span>
                            <h3 class="dp-h3">Stok Seviyeleri ve Dinamik Raf Yerleşimi</h3>
                            <p style="color:#94A5B8; font-size:14px; line-height:1.7;">
                                Mal kabulü onaylanan ürünler ilgili deponun koridor, raf ve göz adreslerine yönlendirilir. Tüm şube ve terminallerdeki stok miktarları anında güncellenir.
                            </p>
                            <ul style="color:#94A5B8; font-size:13px; line-height:1.8; margin-top:16px;">
                                <li>✓ Raf adresi ve palet konum takibi</li>
                                <li>✓ Şubeler ve depolar arası hızlı transfer</li>
                                <li>✓ Kritik eşik seviyesinde otomatik uyarı bildirimleri</li>
                            </ul>
                        </div>
                        <div style="background:#0D1B2A; border:1px solid #263B50; border-radius:14px; padding:24px;">
                            <div style="font-size:12px; color:#1677C8; font-weight:700; margin-bottom:8px;">WMS RAF DAĞILIMI</div>
                            <div style="display:flex; justify-content:space-between; padding:10px; background:#14273A; border-radius:8px; margin-bottom:8px;">
                                <span style="color:#E8EDF4;">Raf Konumu: A-KORİDOR / RAF-03</span>
                                <span style="color:#2CA58D; font-weight:700;">Yerleşim Tamam</span>
                            </div>
                            <small style="color:#64748B;">Depo yetkileri sunucu tarafında rol bazlı korunur.</small>
                        </div>
                    </div>

                    <!-- Step 3: Barkodlu Satış -->
                    <div id="dp-panel-satis" class="dp-tour-panel" role="tabpanel" aria-labelledby="dp-step-satis">
                        <div>
                            <span class="dp-eyebrow"><span class="dp-eyebrow-dot"></span> ÜÇÜNCÜ ADIM</span>
                            <h3 class="dp-h3">Barkodlu & Dokunmatik Hızlı Satış</h3>
                            <p style="color:#94A5B8; font-size:14px; line-height:1.7;">
                                Market veya perakende kasasında ürün barkodu okutulduğunda ürün anında sepete eklenir. Dokunmatik hızlı butonlar ve nakit/kart seçenekleriyle satış saniyeler sürer.
                            </p>
                            <ul style="color:#94A5B8; font-size:13px; line-height:1.8; margin-top:16px;">
                                <li>✓ Otomatik terazi ve barkod okuyucu uyumluluğu</li>
                                <li>✓ Parçalı ödeme (Nakit + Kart) desteği</li>
                                <li>✓ Satış anında stok miktarından anlık düşüş</li>
                            </ul>
                        </div>
                        <div style="background:#0D1B2A; border:1px solid #263B50; border-radius:14px; padding:24px;">
                            <div style="font-size:12px; color:#1677C8; font-weight:700; margin-bottom:8px;">POS KASA İŞLEMİ</div>
                            <div style="display:flex; justify-content:space-between; padding:10px; background:#14273A; border-radius:8px; margin-bottom:8px;">
                                <span style="color:#E8EDF4;">Fiş No: #F-2026-901</span>
                                <span style="color:#F17A38; font-weight:700;">Tahsil Edildi: ₺360,40</span>
                            </div>
                            <small style="color:#64748B;">Termal yazıcı fiş çıktısı milisaniyeler içinde üretilir.</small>
                        </div>
                    </div>

                    <!-- Step 4: Kasa & Vardiya -->
                    <div id="dp-panel-vardiya" class="dp-tour-panel" role="tabpanel" aria-labelledby="dp-step-vardiya">
                        <div>
                            <span class="dp-eyebrow"><span class="dp-eyebrow-dot"></span> DÖRDÜNCÜ ADIM</span>
                            <h3 class="dp-h3">Kasa Kapanışı ve Vardiya Devri</h3>
                            <p style="color:#94A5B8; font-size:14px; line-height:1.7;">
                                Vardiya veya gün sonunda kasa nakit sayımı yapılır. Sistemdeki beklenen tutar ile fiziki tutar karşılaştırılır; açık veya fazla anında tespit edilir.
                            </p>
                            <ul style="color:#94A5B8; font-size:13px; line-height:1.8; margin-top:16px;">
                                <li>✓ Kasiyer bazlı vardiya başlangıç ve bitiş raporu</li>
                                <li>✓ Pos slipleri ve nakit mutabakat özeti</li>
                                <li>✓ Kasa devir kayıtlarının güvenli arşivlenmesi</li>
                            </ul>
                        </div>
                        <div style="background:#0D1B2A; border:1px solid #263B50; border-radius:14px; padding:24px;">
                            <div style="font-size:12px; color:#1677C8; font-weight:700; margin-bottom:8px;">GÜN SONU KASA MUTABAKATI</div>
                            <div style="display:flex; justify-content:space-between; padding:10px; background:#14273A; border-radius:8px; margin-bottom:8px;">
                                <span style="color:#E8EDF4;">Kasa Toplamı: ₺18.450</span>
                                <span style="color:#2CA58D; font-weight:700;">Mutabakat Tamam (Fark: 0 ₺)</span>
                            </div>
                            <small style="color:#64748B;">Gün sonu z-raporu otomatik kayıt altına alınır.</small>
                        </div>
                    </div>

                    <!-- Step 5: Yönetim Raporlama -->
                    <div id="dp-panel-rapor" class="dp-tour-panel" role="tabpanel" aria-labelledby="dp-step-rapor">
                        <div>
                            <span class="dp-eyebrow"><span class="dp-eyebrow-dot"></span> BEŞİNCİ ADIM</span>
                            <h3 class="dp-h3">Yönetim Raporlama ve Stratejik Kararlar</h3>
                            <p style="color:#94A5B8; font-size:14px; line-height:1.7;">
                                Günün ve ayın tüm satış, kârlılık, maliyet ve fire verileri yöneticinin masaüstü ekranında konsolide edilir. Hangi ürünün kâr bıraktığı açıkça görülür.
                            </p>
                            <ul style="color:#94A5B8; font-size:13px; line-height:1.8; margin-top:16px;">
                                <li>✓ Gerçek zamanlı brüt ve net kârlılık oranları</li>
                                <li>✓ Ürün devir hızı ve ölü stok analizleri</li>
                                <li>✓ PDF ve Excel formatında dışa aktarım imkanı</li>
                            </ul>
                        </div>
                        <div style="background:#0D1B2A; border:1px solid #263B50; border-radius:14px; padding:24px;">
                            <div style="font-size:12px; color:#1677C8; font-weight:700; margin-bottom:8px;">YÖNETİM KONSOLU</div>
                            <div style="display:flex; justify-content:space-between; padding:10px; background:#14273A; border-radius:8px; margin-bottom:8px;">
                                <span style="color:#E8EDF4;">Aylık Ciro: ₺482.230</span>
                                <span style="color:#2CA58D; font-weight:700;">Net Kâr: ₺96.430</span>
                            </div>
                            <small style="color:#64748B;">Mali veriler yüksek güvenlikli şifreli depolanır.</small>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- ==========================================================================
             VENIUX INTELLIGENCE SPECIAL SHOWCASE
             ========================================================================== -->
        <section id="zeka" class="dp-intelligence">
            <div class="dp-container">
                <div class="dp-ai-card">
                    <div class="dp-ai-grid">
                        <div>
                            <p class="dp-eyebrow"><span class="dp-eyebrow-dot"></span> VENIUX INTELLIGENCE</p>
                            <h2 class="dp-h2" style="font-size:32px;">İşletmeniz için akıllı karar desteği.</h2>
                            <p style="color:#94A5B8; font-size:14.5px; line-height:1.7; margin-bottom:28px;">
                                Veniux Intelligence sıradan bir sohbet botu değildir. Stok kayıtlarınız, satış hızlarınız ve tedarikçi geçmişiniz üzerinde çalışan; somut, aksiyon alınabilir operasyonel uyarılar üreten akıllı analiz asistanıdır.
                            </p>
                            <a href="/yapay-zeka" class="dp-btn dp-btn--primary">
                                Intelligence Yeteneklerini İncele →
                            </a>
                        </div>
                        <div class="dp-ai-features">
                            <div class="dp-ai-feat-item">
                                <strong>Stok Tüketim Tahmini</strong>
                                <p>Geçmiş satış hızınıza göre hangi ürünün ne zaman biteceğini öngörür ve zamanında sipariş oluşturmanızı önerir.</p>
                            </div>
                            <div class="dp-ai-feat-item">
                                <strong>Kasa Sapma Alarmları</strong>
                                <p>Vardiyalardaki olağandışı iade oranlarını, kasa farklarını ve fiyat indirimlerini anında tespit edip raporlar.</p>
                            </div>
                            <div class="dp-ai-feat-item">
                                <strong>Tedarikçi Performansı</strong>
                                <p>Sipariş teslim sürelerini ve fiyat değişimlerini izleyerek en verimli tedarik kaynaklarını öne çıkarır.</p>
                            </div>
                            <div class="dp-ai-feat-item">
                                <strong>Kural Bazlı Karar Desteği</strong>
                                <p>Verileriniz işletmenizin kontrolünde kalır; harici AI sağlayıcısının güvenli API'si üzerinden analiz üretilir.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- ==========================================================================
             PRICING SECTION
             ========================================================================== -->
        <section id="fiyatlandirma" class="dp-pricing">
            <div class="dp-container">
                <div class="dp-section-header">
                    <p class="dp-eyebrow"><span class="dp-eyebrow-dot"></span> ŞEFFAF & KURUMSAL</p>
                    <h2 class="dp-h2">İşletmenize uygun plan.<br><span class="text-accent">Yıllık avantajlı kullanım.</span></h2>
                    <p class="dp-lead">İhtiyacınız olan depo ve terminal ölçeğini seçin. Başlangıç, İşletme veya Kurumsal planla hemen operasyonunuzu güçlendirin.</p>
                    <div class="dp-pricing-switch" role="group" aria-label="Ödeme dönemi">
                        <button type="button" class="dp-pricing-switch-btn active" onclick="document.querySelectorAll('.p-val-annual').forEach(el=>el.style.display='inline'); document.querySelectorAll('.p-val-quarter').forEach(el=>el.style.display='none'); this.classList.add('active'); this.nextElementSibling.classList.remove('active');">
                            Yıllık (Avantajlı)
                        </button>
                        <button type="button" class="dp-pricing-switch-btn" onclick="document.querySelectorAll('.p-val-annual').forEach(el=>el.style.display='none'); document.querySelectorAll('.p-val-quarter').forEach(el=>el.style.display='inline'); this.classList.add('active'); this.previousElementSibling.classList.remove('active');">
                            3 Aylık
                        </button>
                    </div>
                </div>

                <div class="dp-pricing-grid">
                    <?php 
                    $plans = sitePlans();
                    foreach($plans as $code => $plan): 
                    ?>
                    <article class="dp-price-card <?=$code==='isletme'?'dp-price-card--featured':''?>">
                        <?php if($code==='isletme'):?>
                            <span class="dp-price-badge">En Çok Tercih Edilen</span>
                        <?php endif;?>
                        <h3 class="dp-price-title"><?=e($plan['name'])?></h3>
                        <p class="dp-price-tagline"><?=e($plan['description'])?></p>
                        
                        <div class="dp-price-val">
                            <span class="dp-price-num p-val-annual"><?=number_format($plan['annual'],0,',','.')?> ₺</span>
                            <span class="dp-price-num p-val-quarter" style="display:none;"><?=number_format($plan['quarter'],0,',','.')?> ₺</span>
                            <span class="dp-price-period p-val-annual">/ Yıl</span>
                            <span class="dp-price-period p-val-quarter" style="display:none;">/ 3 Ay</span>
                        </div>
                        <p class="dp-price-sub">%20 KDV dahil toplam kullanım bedeli.</p>

                        <div class="dp-price-limits">
                            <span><strong><?=$plan['warehouses']?></strong> Depo</span> · 
                            <span><strong><?=$plan['users']?></strong> Kullanıcı</span> · 
                            <span><strong><?=$plan['devices']?></strong> Cihaz</span>
                        </div>

                        <ul class="dp-price-features">
                            <?php foreach($plan['features'] as $feat):?>
                                <li><span>✓</span> <?=e($feat)?></li>
                            <?php endforeach;?>
                        </ul>

                        <a href="/fiyatlandirma?donem=yillik&plan=<?=$code?>%3Ayillik#iletisim" class="dp-btn <?=$code==='isletme'?'dp-btn--accent':'dp-btn--primary'?>" style="width:100%;">
                            <?=e($plan['name'])?> Planı ile Başlayın →
                        </a>
                    </article>
                    <?php endforeach;?>
                </div>

                <p style="text-align:center; font-size:12px; color:#64748B; margin-top:32px;">
                    Online ödeme alınmaz; kapsam, faturalandırma ve lisans başlangıcı görüşmede netleştirilir.
                </p>
            </div>
        </section>

        <!-- ==========================================================================
             FAQ SECTION
             ========================================================================== -->
        <section id="sorular" class="section wrap dp-container faq" style="padding-top:48px; padding-bottom:64px;">
            <div class="dp-section-header">
                <p class="dp-eyebrow"><span class="dp-eyebrow-dot"></span> SIKÇA SORULAN SORULAR</p>
                <h2 class="dp-h2">Aklınızda soru kalmasın.</h2>
            </div>
            <div class="faq-list" style="max-width:800px; margin:0 auto; display:flex; flex-direction:column; gap:12px;">
                <details style="background:#0D1B2A; border:1px solid #263B50; border-radius:12px; padding:18px 24px;">
                    <summary style="font-weight:700; color:#E8EDF4; cursor:pointer;">Veniux hangi sektörler için uygundur?<span style="float:right; color:#F17A38;">+</span></summary>
                    <p style="color:#94A5B8; font-size:14px; margin-top:12px; line-height:1.6;">Market, toptan/perakende satış mağazaları, lojistik depolar, e-ticaret satıcıları, gıda ve barkodlu ürün satan tüm ticari işletmeler için uygundur.</p>
                </details>
                <details style="background:#0D1B2A; border:1px solid #263B50; border-radius:12px; padding:18px 24px;">
                    <summary style="font-weight:700; color:#E8EDF4; cursor:pointer;">Mevcut ürünlerimi ve carilerimi Excel ile aktarabilir miyim?<span style="float:right; color:#F17A38;">+</span></summary>
                    <p style="color:#94A5B8; font-size:14px; margin-top:12px; line-height:1.6;">Evet. Veniux gelişmiş Excel/CSV içeri aktarım sihirbazına sahiptir. Sütun eşleştirme ve önizleme ile dakikalar içinde binlerce ürün kartınızı aktarabilirsiniz.</p>
                </details>
                <details style="background:#0D1B2A; border:1px solid #263B50; border-radius:12px; padding:18px 24px;">
                    <summary style="font-weight:700; color:#E8EDF4; cursor:pointer;">İnternet kesildiğinde satış yapabilir miyim?<span style="float:right; color:#F17A38;">+</span></summary>
                    <p style="color:#94A5B8; font-size:14px; margin-top:12px; line-height:1.6;">Veniux hibrit çalışma mimarisini destekler. Veritabanınız yerel sunucunuzda tutulduğu sürece yerel ağınızda kesintisiz satış ve stok hareketi yapmaya devam edebilirsiniz.</p>
                </details>
            </div>
        </section>

    <?php else: ?>
        <!-- Generic Topic / Page Hero for Other Subpages -->
        <section class="dp-hero">
            <div class="dp-container">
                <div class="dp-hero-content" style="max-width:800px; margin:0 auto; text-align:center;">
                    <p class="dp-eyebrow"><span class="dp-eyebrow-dot"></span> <?=e($page['label'])?></p>
                    <h1 class="dp-h1"><?=$page['headline']?></h1>
                    <p class="dp-lead" style="margin-left:auto; margin-right:auto;"><?=e($page['intro'])?></p>
                    <div class="dp-hero-actions" style="justify-content:center;">
                        <a class="dp-btn dp-btn--primary" href="/?request_type=demo#iletisim">
                            Demo Görüşmesi İsteyin <span aria-hidden="true">→</span>
                        </a>
                        <a class="dp-btn dp-btn--outline" href="/#ekosistem">
                            Tüm Çözümler
                        </a>
                    </div>
                </div>
            </div>
        </section>

        <?php if(isset($topics[$path])): $topic=$topics[$path]; ?>
        <section class="section wrap dp-container" style="padding-top:40px; padding-bottom:60px;">
            <div style="background:#0D1B2A; border:1px solid #263B50; border-radius:20px; padding:48px;">
                <p class="dp-eyebrow"><span class="dp-eyebrow-dot"></span> ÇÖZÜMÜ YAKINDAN TANIYIN</p>
                <h2 class="dp-h2" style="font-size:32px;"><?=e($topic[0])?></h2>
                <p style="color:#94A5B8; font-size:15px; line-height:1.8; margin-bottom:32px;"><?=e($topic[1])?></p>
                <div style="background:#14273A; border:1px solid #263B50; border-radius:14px; padding:28px;">
                    <h3 class="dp-h3" style="font-size:22px; color:#E8EDF4;"><?=e($topic[2])?></h3>
                    <p style="color:#94A5B8; font-size:14px; line-height:1.7; margin:0;"><?=e($topic[3])?></p>
                </div>
            </div>
        </section>
        <?php endif;?>

    <?php endif; ?>

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
                    <p class="dp-eyebrow"><span class="dp-eyebrow-dot"></span> SIRADAKİ ADIM SİZİN</p>
                    <h2 class="dp-h2" style="font-size:34px;">İşletmenize yeni bir<br><span class="text-accent">alan açın.</span></h2>
                    <p style="color:#94A5B8; font-size:15px; line-height:1.8; margin-bottom:28px;">
                        Veniux ekosistemini işletmenizin ölçeği ve ihtiyaçlarıyla birlikte değerlendirelim. Formu doldurun, uzman ekibimiz en kısa sürede sizinle iletişime geçsin.
                    </p>
                    <div style="background:#07111D; border:1px solid #263B50; border-radius:14px; padding:20px;">
                        <strong style="color:#E8EDF4; display:block; font-size:14px; margin-bottom:6px;">Güvenli ve Doğrudan İletişim</strong>
                        <p style="color:#94A5B8; font-size:12.5px; margin:0; line-height:1.6;">Bilgileriniz KVKK standartlarına uygun olarak saklanır, 3. şahıslarla paylaşılmaz.</p>
                    </div>
                </div>

                <div class="dp-contact-form-area">
                    <?php if($contactResult):?>
                        <div class="dp-toast <?=$contactResult[0]?'dp-toast--success':'dp-toast--error'?>" style="background:<?=$contactResult[0]?'#0f3529':'#3a141a'?>; border:1px solid <?=$contactResult[0]?'#1d6b53':'#73232b'?>; color:<?=$contactResult[0]?'#a2f2d9':'#ff9da8'?>; padding:14px 18px; border-radius:10px; margin-bottom:20px;" role="<?=$contactResult[0]?'status':'alert'?>">
                            <?=e($contactResult[1])?>
                        </div>
                    <?php endif;?>

                    <?php if($contactConversion):?>
                        <span hidden data-conversion-receipt="<?=e($contactConversion['receipt'])?>" data-conversion-event="<?=e($contactConversion['event'])?>" data-conversion-type="<?=e($contactConversion['form_type'])?>"></span>
                    <?php endif;?>

                    <form method="post" action="/#iletisim" class="dp-form">
                        <?php if($selectedPlan):?>
                            <div style="background:#14273A; border:1px solid #1677C8; border-radius:10px; padding:14px; margin-bottom:18px;">
                                <p class="dp-eyebrow" style="margin-bottom:4px;">SEÇTİĞİNİZ PLAN</p>
                                <strong style="color:#E8EDF4;"><?=e($selectedPlan["name"])?> · <?=e($selectedPlan["period"])?></strong>
                                <p style="color:#94A5B8; font-size:12px; margin:2px 0 0 0;"><?=siteMoney($selectedPlan["amount_try"])?> · %20 KDV dahil · Online ödeme alınmaz.</p>
                                <input type="hidden" name="plan" value="<?=e($selectedPlan["code"])?>">
                            </div>
                        <?php endif;?>

                        <input type="hidden" name="token" value="<?=e($_SESSION['contact_token'])?>">
                        <div class="honeypot" style="display:none;" aria-hidden="true">
                            <label>Web sitesi<input name="website" tabindex="-1" autocomplete="off"></label>
                        </div>

                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
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

                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
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
                                    <?php foreach(['stok'=>'Stok ve Mağaza Yönetimi','depo'=>'Depo Operasyonları (WMS)','lot'=>'Lot ve Miat Takibi'] as $value=>$label):?>
                                        <option value="<?=$value?>" <?=($preserve?($_POST['interest']??''):$initialSolution)===$value?'selected':''?>><?=$label?></option>
                                    <?php endforeach;?>
                                </select>
                            </div>
                        </div>

                        <div class="dp-form-group" data-partner-field style="display:none;">
                            <label class="dp-label">Ortaklık Alanı (Yalnızca ortaklık talepleri için)</label>
                            <select class="dp-select" name="partner_type">
                                <option value="">Seçin</option>
                                <?php foreach(['hardware'=>'Donanım entegratörü','barcode'=>'Barkod ve el terminali','erp'=>'ERP çözüm ortağı','reseller'=>'Bayi','technology'=>'Teknoloji','referral'=>'Referans yönlendirme'] as $value=>$label):?>
                                    <option value="<?=$value?>" <?=$preserve&&($_POST['partner_type']??'')===$value?'selected':''?>><?=$label?></option>
                                <?php endforeach;?>
                            </select>
                        </div>

                        <div style="margin-bottom:20px;">
                            <label style="display:flex; align-items:flex-start; gap:10px; font-size:12.5px; color:#94A5B8; cursor:pointer;">
                                <input type="checkbox" name="consent" value="1" required style="margin-top:3px;">
                                <span>Bilgilerimin bu görüşme talebini değerlendirmek ve benimle iletişim kurmak amacıyla kullanılmasını onaylıyorum.</span>
                            </label>
                        </div>

                        <button class="dp-btn dp-btn--accent" type="submit" style="width:100%; justify-content:center;">
                            Görüşme Talebi Oluştur →
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </section>

<?php endif; ?>
</main>

<?php require __DIR__.'/components/footer.php'; ?>

</body>
</html>
