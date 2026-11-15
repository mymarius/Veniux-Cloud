<?php
declare(strict_types=1);
// Yerel geliştirme sunucusunda (php -S) var olan statik dosyalar doğrudan sunulur; üretimde bunu .htaccess yapar.
if (PHP_SAPI === 'cli-server' && is_file(__DIR__ . parse_url((string) $_SERVER['REQUEST_URI'], PHP_URL_PATH)) && !str_ends_with((string) parse_url((string) $_SERVER['REQUEST_URI'], PHP_URL_PATH), '.php')) return false;
require_once dirname(__DIR__) . '/src/security.php';
require_once dirname(__DIR__) . '/src/data.php';
require_once dirname(__DIR__) . '/src/views.php';
require_once dirname(__DIR__) . '/src/charts.php';
require_once dirname(__DIR__) . '/src/authority.php';
require_once dirname(__DIR__) . '/src/views_licenses.php';

securityHeaders();
if (!ipAllowed()) { http_response_code(403); exit('Erişim yok.'); }
startSession();
$path = rtrim((string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH), '/') ?: '/';
$method = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($path === '/giris') {
    if ($method === 'POST') {
        csrfCheck();
        if (throttleBlocked()) { http_response_code(429); pageLogin('Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.'); exit; }
        if (attemptLogin((string) ($_POST['email'] ?? ''), (string) ($_POST['password'] ?? ''), preg_replace('/\s+/', '', (string) ($_POST['code'] ?? '')))) {
            session_regenerate_id(true); throttleClear();
            $_SESSION = ['owner_ok' => true, 'born' => time(), 'seen' => time(), 'csrf' => bin2hex(random_bytes(24))];
            auditLine('giris-basarili'); header('Location: /'); exit;
        }
        throttleFail(); auditLine('giris-basarisiz'); http_response_code(401); pageLogin('E-posta, parola veya doğrulama kodu hatalı.'); exit;
    }
    pageLogin(); exit;
}
if (!isLoggedIn()) { header('Location: /giris'); exit; }
if ($path === '/cikis' && $method === 'POST') { csrfCheck(); auditLine('cikis'); $_SESSION = []; session_destroy(); header('Location: /giris'); exit; }
// ---------- Lisans işlemleri (yazma): CSRF + gerekçe zorunlu; hata iletisi forma geri döner ----------
if ($method === 'POST' && (str_starts_with($path, '/lisanslar'))) {
    csrfCheck();
    if (!authorityConfigured()) { http_response_code(503); layout('Lisans merkezi', '<h1>Lisans merkezi bağlı değil</h1><p>authority.json tanımlı değil.</p>', '/lisanslar'); exit; }
    try {
        if ($path === '/lisanslar/yeni') {
            try { $r = issueAuthorityLicense($_POST); layout('Lisans oluşturuldu', pageLicenseKey($r, (string) $_POST['company']), '/lisanslar'); exit; }
            catch (InvalidArgumentException $e) { http_response_code(422); layout('Yeni lisans', pageLicenseNew($e->getMessage()), '/lisanslar'); exit; }
        }
        if (preg_match('#^/lisanslar/(\d{1,12})/(uzat|duzenle|durum|terminal)$#', $path, $m)) {
            $id = (int) $m[1];
            try {
                if ($m[2] === 'uzat') { $to = extendAuthorityLicense($id, (int) ($_POST['days'] ?? 0), (string) ($_POST['reason'] ?? '')); flashSet('ok', 'Lisans uzatıldı. Yeni bitiş: ' . substr($to, 0, 10)); }
                elseif ($m[2] === 'duzenle') { updateAuthorityLicense($id, $_POST, (string) ($_POST['reason'] ?? '')); flashSet('ok', 'Lisans güncellendi.'); }
                elseif ($m[2] === 'durum') {
                    $state = (string) ($_POST['state'] ?? '');
                    if ($state === 'REVOKED' && ($_POST['confirm'] ?? '') !== 'SONLANDIR') throw new InvalidArgumentException('Sonlandırmak için onay kutusuna SONLANDIR yazın.');
                    setAuthorityState($id, $state, (string) ($_POST['reason'] ?? '')); flashSet('ok', ['ACTIVE' => 'Lisans etkinleştirildi.', 'SUSPENDED' => 'Lisans askıya alındı.', 'REVOKED' => 'Lisans sonlandırıldı.'][$state]);
                } else { setAuthorityDevice($id, (int) ($_POST['device'] ?? 0), ($_POST['enabled'] ?? '') === '1', (string) ($_POST['reason'] ?? '')); flashSet('ok', 'Terminal güncellendi.'); }
            } catch (InvalidArgumentException $e) { flashSet('err', $e->getMessage()); }
            header('Location: ' . (($_POST['back'] ?? '') === 'yonetim' ? '/yonetim' : '/lisanslar/' . $id)); exit;
        }
        http_response_code(404); exit('Bulunamadı.');
    } catch (Throwable $e) { error_log('yonetim: ' . $e->getMessage()); http_response_code(500); layout('Hata', '<h1>İşlem yapılamadı</h1><p class="err">Lisans merkezi bağlantısını ve yetkileri kontrol edin.</p>', '/lisanslar'); exit; }
}
if ($method !== 'GET' && $method !== 'HEAD') { http_response_code(405); exit('İzin verilmeyen yöntem.'); }

try {
    if ($path === '/') { $dd = dashboard(); $cc = dashboardCharts(); layout('Pano', pageDashboard($dd, $cc), '/', '<div class="ticker" aria-hidden="true"><div class="wrap"><span>MÜŞTERİ ' . num($dd['t']['n']) . '</span><span>GEÇERLİ LİSANS ' . num($cc['states']['Aktif'] + $cc['states']['Yakında bitiyor']) . '</span><span>ÇALIŞAN ' . num($dd['u']['n']) . '</span><span>TERMİNAL ' . num($dd['dev']['n']) . '</span><span>BUGÜN ' . e(money($dd['sToday']['total'])) . '</span></div></div>'); }
    elseif ($path === '/musteriler') { $q = trim((string) ($_GET['q'] ?? '')); $f = (string) ($_GET['durum'] ?? ''); layout('Müşteriler', pageCustomers(customers(mb_substr($q, 0, 80), $f), $q, $f), '/musteriler'); }
    elseif (preg_match('#^/musteriler/(\d{1,12})$#', $path, $m)) { $c = customerDetail((int) $m[1]); if (!$c) { http_response_code(404); layout('Bulunamadı', '<h1>Müşteri bulunamadı</h1>', '/musteriler'); } else layout($c['tenant']['company_name'], pageCustomer($c), '/musteriler'); }
    elseif ($path === '/satislar') { $g = (int) ($_GET['gun'] ?? 30); $days = in_array($g, [7, 30, 90, 365], true) ? $g : 30; layout('Satışlar', pageSales(salesByTenant($days), $days, salesRanking($days), dashboardCharts()['days']), '/satislar'); }
    elseif ($path === '/lisanslar') { if (!authorityConfigured()) layout('Lisanslar', '<h1>Lisanslar</h1><p class="err">Lisans merkezi veritabanı ayarı (authority.json) yok.</p>', '/lisanslar'); else layout('Lisanslar', pageLicenses(authorityLicenses(), preg_match('/^(aktif|bitecek|doldu|askida|sonlandirildi)$/', (string) ($_GET['durum'] ?? '')) ? (string) $_GET['durum'] : ''), '/lisanslar'); }
    elseif ($path === '/lisanslar/yeni') layout('Yeni lisans', pageLicenseNew(), '/lisanslar');
    elseif (preg_match('#^/lisanslar/(\d{1,12})$#', $path, $m)) { $l = authorityConfigured() ? authorityLicense((int) $m[1]) : null; if (!$l) { http_response_code(404); layout('Bulunamadı', '<h1>Lisans bulunamadı</h1>', '/lisanslar'); } else layout($l['company'], pageLicense($l), '/lisanslar'); }
    elseif ($path === '/yonetim') { $auth = authorityConfigured(); $all = $auth ? authorityLicenses() : []; $now = gmdate('Y-m-d H:i:s'); $in30 = gmdate('Y-m-d H:i:s', time() + 30 * 86400);
        $due = array_values(array_filter($all, fn($l) => $l['status'] === 'ACTIVE' && $l['expires_at'] <= $in30)); usort($due, fn($a, $b2) => strcmp($a['expires_at'], $b2['expires_at']));
        layout('Yönetim', pageManage($due, array_values(array_filter($all, fn($l) => $l['status'] === 'SUSPENDED')), $auth), '/yonetim'); }
    elseif ($path === '/paketler') layout('Paketler', pagePackages(catalogue()), '/paketler');
    elseif ($path === '/sistem') layout('Sistem', pageSystem(systemInfo()), '/sistem');
    else { http_response_code(404); layout('Bulunamadı', '<h1>Sayfa bulunamadı</h1>'); }
} catch (Throwable $e) {
    error_log('yonetim: ' . $e->getMessage());
    http_response_code(500); layout('Hata', '<h1>Veri alınamadı</h1><p class="err">Veritabanı bağlantısını (db.json) ve yetkileri kontrol edin.</p>');
}
