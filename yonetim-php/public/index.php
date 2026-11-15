<?php
declare(strict_types=1);
// Yerel geliştirme sunucusunda (php -S) var olan statik dosyalar doğrudan sunulur; üretimde bunu .htaccess yapar.
if (PHP_SAPI === 'cli-server' && is_file(__DIR__ . parse_url((string) $_SERVER['REQUEST_URI'], PHP_URL_PATH)) && !str_ends_with((string) parse_url((string) $_SERVER['REQUEST_URI'], PHP_URL_PATH), '.php')) return false;
require_once dirname(__DIR__) . '/src/security.php';
require_once dirname(__DIR__) . '/src/data.php';
require_once dirname(__DIR__) . '/src/views.php';

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
if ($method !== 'GET' && $method !== 'HEAD') { http_response_code(405); exit('İzin verilmeyen yöntem.'); }

try {
    if ($path === '/') layout('Pano', pageDashboard(dashboard()), '/');
    elseif ($path === '/musteriler') { $q = trim((string) ($_GET['q'] ?? '')); $f = (string) ($_GET['durum'] ?? ''); layout('Müşteriler', pageCustomers(customers(mb_substr($q, 0, 80), $f), $q, $f), '/musteriler'); }
    elseif (preg_match('#^/musteriler/(\d{1,12})$#', $path, $m)) { $c = customerDetail((int) $m[1]); if (!$c) { http_response_code(404); layout('Bulunamadı', '<h1>Müşteri bulunamadı</h1>', '/musteriler'); } else layout($c['tenant']['company_name'], pageCustomer($c), '/musteriler'); }
    elseif ($path === '/satislar') { $days = in_array((int) ($_GET['gun'] ?? 30), [7, 30, 90, 365], true) ? (int) $_GET['gun'] : 30; layout('Satışlar', pageSales(salesByTenant($days), $days), '/satislar'); }
    elseif ($path === '/paketler') layout('Paketler', pagePackages(catalogue()), '/paketler');
    elseif ($path === '/sistem') layout('Sistem', pageSystem(systemInfo()), '/sistem');
    else { http_response_code(404); layout('Bulunamadı', '<h1>Sayfa bulunamadı</h1>'); }
} catch (Throwable $e) {
    error_log('yonetim: ' . $e->getMessage());
    http_response_code(500); layout('Hata', '<h1>Veri alınamadı</h1><p class="err">Veritabanı bağlantısını (db.json) ve yetkileri kontrol edin.</p>');
}
